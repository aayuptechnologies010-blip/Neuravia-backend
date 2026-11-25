const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const Customer = require('../models/Customer');
const WalletTransaction = require('../models/WalletTransaction');
const CallLog = require('../models/CallLog');
const Booking = require('../models/Booking');
const Therapist = require('../models/Therapist');
const Notification = require('../models/Notification');
const SiteContent = require('../models/SiteContent');
const { createAndBroadcastNotification, sendNotificationToCustomer } = require('../utils/fcmService');

// Middleware: Verify customer JWT
const protectCustomer = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const customer = await Customer.findById(decoded.id).select('-otpCode -otpExpiresAt');
    if (!customer) {
      return res.status(401).json({ success: false, message: 'Customer not found' });
    }
    req.customer = customer;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// @route   POST /api/customer/fcm-token
// @desc    Save or update customer's FCM token
router.post('/fcm-token', protectCustomer, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'fcmToken required' });
    }
    req.customer.fcmToken = fcmToken;
    await req.customer.save();
    console.log(`✅ Saved FCM token for ${req.customer.phone || req.customer.email}`);
    res.json({ success: true, message: 'FCM token updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/customer/wallet
// @desc    Get wallet balance, talkTimeMinutes & recent transactions
router.get('/wallet', protectCustomer, async (req, res) => {
  try {
    const transactions = await WalletTransaction.find({ customerId: req.customer._id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({
      success: true,
      walletBalance: req.customer.walletBalance || 0,
      talkTimeMinutes: req.customer.talkTimeMinutes || 0,
      transactions
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   POST /api/customer/wallet/recharge
// @desc    Recharge wallet balance
router.post('/wallet/recharge', protectCustomer, async (req, res) => {
  try {
    const { amount } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid recharge amount required' });
    }

    req.customer.walletBalance = (req.customer.walletBalance || 0) + numAmount;
    await req.customer.save();

    const tx = await WalletTransaction.create({
      customerId: req.customer._id,
      type: 'credit',
      amount: numAmount,
      title: 'Wallet Top-up'
    });

    await createAndBroadcastNotification({
      title: 'Wallet Recharged!',
      body: `₹${numAmount} has been added to your Neuravia Wallet.`,
      type: 'wallet'
    });

    res.json({
      success: true,
      message: `₹${numAmount} added to wallet!`,
      walletBalance: req.customer.walletBalance,
      transaction: tx
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   POST /api/customer/plans/purchase
// @desc    Purchase a session plan & credit talkTimeMinutes
router.post('/plans/purchase', protectCustomer, async (req, res) => {
  try {
    const { planName, price, totalMinutes } = req.body;
    const numPrice = Number(price) || 0;
    const numMinutes = Number(totalMinutes) || 50;

    req.customer.talkTimeMinutes = (req.customer.talkTimeMinutes || 0) + numMinutes;
    await req.customer.save();

    await WalletTransaction.create({
      customerId: req.customer._id,
      type: 'debit',
      amount: numPrice,
      minutesAdded: numMinutes,
      title: `Plan Purchased: ${planName || 'Session Plan'}`
    });

    res.json({
      success: true,
      message: `${planName || 'Plan'} activated! ${numMinutes} mins credited.`,
      talkTimeMinutes: req.customer.talkTimeMinutes
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   GET /api/customer/history
// @desc    Get customer's bookings & call tracking logs
router.get('/history', protectCustomer, async (req, res) => {
  try {
    const phone = req.customer.phone;
    const email = req.customer.email;
    const bookingQuery = [];
    if (phone) bookingQuery.push({ 'client.phone': phone }, { phone });
    if (email) bookingQuery.push({ 'client.email': email }, { email });

    const bookings = bookingQuery.length > 0
      ? await Booking.find({ $or: bookingQuery }).sort({ createdAt: -1 }).limit(30)
      : [];

    const callLogs = await CallLog.find({ customerId: req.customer._id })
      .sort({ createdAt: -1 })
      .limit(30);

    res.json({
      success: true,
      talkTimeMinutes: req.customer.talkTimeMinutes || 0,
      walletBalance: req.customer.walletBalance || 0,
      bookings,
      callLogs
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   POST /api/customer/calls/log
// @desc    Log a masked call, deduct talk time/wallet & save rating
router.post('/calls/log', protectCustomer, async (req, res) => {
  try {
    const { therapistId, therapistName, bookingId, durationSeconds, ratePerMinute, rating, feedback } = req.body;
    const secs = Number(durationSeconds) || 60;
    const mins = Math.max(1, Math.ceil(secs / 60));
    const rate = Number(ratePerMinute) || 25;
    let amountDeducted = 0;

    // Deduct exact seconds from specific booking if bookingId provided (for Pause & Resume)
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        const currentRemSecs = typeof booking.remainingSeconds === 'number'
          ? booking.remainingSeconds
          : ((booking.remainingMinutes ?? booking.bookedMinutes ?? 50) * 60);
        const updatedSecs = Math.max(0, currentRemSecs - secs);
        booking.remainingSeconds = updatedSecs;
        booking.remainingMinutes = Math.ceil(updatedSecs / 60);
        if (updatedSecs <= 0) {
          booking.status = 'Completed';
          await createAndBroadcastNotification({
            title: 'Session Completed',
            body: `Your therapy session with ${therapistName || 'Therapist'} is completed.`,
            type: 'history'
          });
        } else if (updatedSecs <= 300) {
          await createAndBroadcastNotification({
            title: 'Low Talk Time Alert',
            body: `Under 5 minutes left in your session with ${therapistName || 'Therapist'}.`,
            type: 'history'
          });
        }
        await booking.save();
      }
    }

    if ((req.customer.talkTimeMinutes || 0) >= mins) {
      req.customer.talkTimeMinutes -= mins;
    } else {
      const remainingMins = mins - (req.customer.talkTimeMinutes || 0);
      req.customer.talkTimeMinutes = 0;
      amountDeducted = remainingMins * rate;
      req.customer.walletBalance = Math.max(0, (req.customer.walletBalance || 0) - amountDeducted);
      if (amountDeducted > 0) {
        await WalletTransaction.create({
          customerId: req.customer._id,
          type: 'debit',
          amount: amountDeducted,
          title: `Session with ${therapistName || 'Therapist'}`
        });
      }
    }
    await req.customer.save();

    const log = await CallLog.create({
      customerId: req.customer._id,
      therapistId: therapistId || 'unknown',
      therapistName: therapistName || 'Therapist',
      durationSeconds: secs,
      minutesDeducted: mins,
      amountDeducted,
      rating: rating ? Number(rating) : undefined,
      feedback: feedback || ''
    });

    // Dynamically recalculate Therapist average rating & totalReviews
    if (rating && therapistId && therapistId !== 'unknown') {
      const ratedLogs = await CallLog.find({
        therapistId,
        rating: { $exists: true, $ne: null }
      });
      if (ratedLogs.length > 0) {
        const sum = ratedLogs.reduce((acc, item) => acc + Number(item.rating), 0);
        const avg = Number((sum / ratedLogs.length).toFixed(1));
        await Therapist.findByIdAndUpdate(therapistId, {
          rating: avg,
          totalReviews: ratedLogs.length
        }).catch(() => {});
      }
    }

    res.status(201).json({
      success: true,
      message: 'Call logged successfully',
      log,
      talkTimeMinutes: req.customer.talkTimeMinutes,
      walletBalance: req.customer.walletBalance
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   POST /api/customer/therapist-apply
// @desc    Submit therapist registration from app (pending admin approval)
router.post('/therapist-apply', async (req, res) => {
  try {
    const { name, title, experience, qualification, languages, specialization, startingPrice, about, profilePhoto } = req.body;
    if (!name || !title) {
      return res.status(400).json({ success: false, message: 'Name and professional title are required' });
    }

    const therapist = await Therapist.create({
      name: name.trim(),
      title: title.trim(),
      experience: experience || '1+ Years',
      qualification: qualification || '',
      languages: Array.isArray(languages) ? languages : ['Hindi', 'English'],
      specialization: specialization || 'Anxiety & Panic',
      startingPrice: startingPrice ? `₹${startingPrice}/min` : '₹25/min',
      about: about || '',
      profilePhoto: profilePhoto || '',
      isVerified: false,
      isActive: false // Pending admin approval
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted! Pending admin approval.',
      data: therapist
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   POST /api/customer/razorpay/create-order
// @desc    Create a Razorpay order for app checkout
router.post('/razorpay/create-order', protectCustomer, async (req, res) => {
  try {
    const { amount } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.create({
      amount: Math.round(numAmount * 100), // in paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   POST /api/customer/book-therapist
// @desc    Pay for talk time & book a therapist session
router.post('/book-therapist', protectCustomer, async (req, res) => {
  try {
    const { therapistId, therapistName, concern, amount, totalMinutes, usePlanSession, date, timeSlot } = req.body;
    let numAmount = Number(amount) || 499;
    let numMinutes = Number(totalMinutes) || 50;

    if (usePlanSession) {
      if ((req.customer.remainingPlanSessions || 0) <= 0) {
        return res.status(400).json({ success: false, message: 'No active plan sessions remaining' });
      }
      req.customer.remainingPlanSessions -= 1;
      numMinutes = req.customer.planSessionMinutes || 20;
      numAmount = 0;
    } else {
      req.customer.talkTimeMinutes = (req.customer.talkTimeMinutes || 0) + numMinutes;
    }
    await req.customer.save();

    const booking = await Booking.create({
      bookingId: `BK-${Date.now().toString().slice(-6)}`,
      therapistChoice: therapistName || 'Therapist',
      therapistId: therapistId || undefined,
      date: date || new Date().toISOString().split('T')[0],
      time: timeSlot || 'Instant / Flexible',
      amount: numAmount,
      bookedMinutes: numMinutes,
      remainingMinutes: numMinutes,
      remainingSeconds: numMinutes * 60,
      status: 'Confirmed',
      client: {
        fullName: req.customer.name || 'Customer',
        email: req.customer.email || `${req.customer.phone || 'user'}@neuravia.in`,
        phone: req.customer.phone || '0000000000',
        city: 'India',
        pincode: '110001',
        helpCategory: concern || 'Therapy Session',
        concernDescription: `Talk-time booking (${numMinutes} mins) with ${therapistName || 'Therapist'}`
      }
    });

    await WalletTransaction.create({
      customerId: req.customer._id,
      type: 'debit',
      amount: numAmount,
      minutesAdded: numMinutes,
      title: `Booked ${therapistName || 'Therapist'} (${numMinutes} mins)`
    });

    await createAndBroadcastNotification({
      title: 'Booking Confirmed!',
      body: `Your ${numMinutes}-min session with ${therapistName || 'Therapist'} is confirmed.`,
      type: 'history'
    });

    res.status(201).json({
      success: true,
      message: `Booked ${therapistName}! ${numMinutes} mins talk time credited.`,
      booking,
      talkTimeMinutes: req.customer.talkTimeMinutes
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   POST /api/customer/razorpay/create-order
// @desc    Create a Razorpay order for app checkout
router.post('/razorpay/create-order', protectCustomer, async (req, res) => {
  try {
    const { amount } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.create({
      amount: Math.round(numAmount * 100), // in paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   POST /api/customer/book-therapist
// @desc    Pay for talk time & book a therapist session
router.post('/book-therapist', protectCustomer, async (req, res) => {
  try {
    const { therapistId, therapistName, concern, amount, totalMinutes, usePlanSession, date, timeSlot } = req.body;
    let numAmount = Number(amount) || 499;
    let numMinutes = Number(totalMinutes) || 50;

    if (usePlanSession) {
      if ((req.customer.remainingPlanSessions || 0) <= 0) {
        return res.status(400).json({ success: false, message: 'No active plan sessions remaining' });
      }
      req.customer.remainingPlanSessions -= 1;
      numMinutes = req.customer.planSessionMinutes || 20;
      numAmount = 0;
    } else {
      req.customer.talkTimeMinutes = (req.customer.talkTimeMinutes || 0) + numMinutes;
    }
    await req.customer.save();

    const booking = await Booking.create({
      bookingId: `BK-${Date.now().toString().slice(-6)}`,
      therapistChoice: therapistName || 'Therapist',
      therapistId: therapistId || undefined,
      date: date || new Date().toISOString().split('T')[0],
      time: timeSlot || 'Instant / Flexible',
      amount: numAmount,
      bookedMinutes: numMinutes,
      remainingMinutes: numMinutes,
      remainingSeconds: numMinutes * 60,
      status: 'Confirmed',
      client: {
        fullName: req.customer.name || 'Customer',
        email: req.customer.email || `${req.customer.phone || 'user'}@neuravia.in`,
        phone: req.customer.phone || '0000000000',
        city: 'India',
        pincode: '110001',
        helpCategory: concern || 'Therapy Session',
        concernDescription: `Talk-time booking (${numMinutes} mins) with ${therapistName || 'Therapist'}`
      }
    });

    await WalletTransaction.create({
      customerId: req.customer._id,
      type: 'debit',
      amount: numAmount,
      minutesAdded: numMinutes,
      title: `Booked ${therapistName || 'Therapist'} (${numMinutes} mins)`
    });

    await createAndBroadcastNotification({
      title: 'Booking Confirmed!',
      body: `Your ${numMinutes}-min session with ${therapistName || 'Therapist'} is confirmed.`,
      type: 'history'
    });

    res.status(201).json({
      success: true,
      message: `Booked ${therapistName}! ${numMinutes} mins talk time credited.`,
      booking,
      talkTimeMinutes: req.customer.talkTimeMinutes
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   GET /api/customer/admin/reports
// @desc    Admin Panel: Real dynamic analytics & reports from MongoDB
router.get('/admin/reports', async (req, res) => {
  try {
    const [bookings, customers, therapists, callLogs, transactions] = await Promise.all([
      Booking.find().sort({ createdAt: -1 }),
      Customer.find().select('name phone walletBalance remainingPlanSessions createdAt'),
      Therapist.find().select('name title rating totalReviews isActive'),
      CallLog.find().sort({ createdAt: -1 }),
      WalletTransaction.find().sort({ createdAt: -1 }).limit(30)
    ]);

    const totalRevenue = bookings.reduce((sum, b) => sum + (b.amount || 0), 0);
    const completedBookings = bookings.filter((b) => b.status === 'Completed').length;
    const totalCallSeconds = callLogs.reduce((sum, l) => sum + (l.durationSeconds || 0), 0);

    // Therapist-wise revenue & sessions
    const therapistMap = {};
    bookings.forEach((b) => {
      const name = b.therapistChoice || 'Therapist';
      if (!therapistMap[name]) {
        therapistMap[name] = { name, bookings: 0, revenue: 0 };
      }
      therapistMap[name].bookings += 1;
      therapistMap[name].revenue += (b.amount || 0);
    });

    res.json({
      success: true,
      summary: {
        totalRevenue,
        totalBookings: bookings.length,
        completedBookings,
        totalCustomers: customers.length,
        totalTherapists: therapists.length,
        activeTherapists: therapists.filter((t) => t.isActive).length,
        totalCalls: callLogs.length,
        totalCallMinutes: Math.round(totalCallSeconds / 60)
      },
      therapistBreakdown: Object.values(therapistMap).sort((a, b) => b.revenue - a.revenue),
      recentTransactions: transactions
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/customer/admin/customers
// @desc    Admin Panel: List all customers with summary stats
router.get('/admin/customers', async (req, res) => {
  try {
    const customers = await Customer.find().select('-otpCode -otpExpiresAt').sort({ createdAt: -1 });
    res.json({ success: true, data: customers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/customer/admin/reports
// @desc    Admin Panel: Real dynamic analytics & reports from MongoDB
router.get('/admin/reports', async (req, res) => {
  try {
    const [bookings, customers, therapists, callLogs, transactions] = await Promise.all([
      Booking.find().sort({ createdAt: -1 }),
      Customer.find().select('name phone walletBalance remainingPlanSessions createdAt'),
      Therapist.find().select('name title rating totalReviews isActive'),
      CallLog.find().sort({ createdAt: -1 }),
      WalletTransaction.find().sort({ createdAt: -1 }).limit(30)
    ]);

    const totalRevenue = bookings.reduce((sum, b) => sum + (b.amount || 0), 0);
    const completedBookings = bookings.filter((b) => b.status === 'Completed').length;
    const totalCallSeconds = callLogs.reduce((sum, l) => sum + (l.durationSeconds || 0), 0);

    // Therapist-wise revenue & sessions
    const therapistMap = {};
    bookings.forEach((b) => {
      const name = b.therapistChoice || 'Therapist';
      if (!therapistMap[name]) {
        therapistMap[name] = { name, bookings: 0, revenue: 0 };
      }
      therapistMap[name].bookings += 1;
      therapistMap[name].revenue += (b.amount || 0);
    });

    res.json({
      success: true,
      summary: {
        totalRevenue,
        totalBookings: bookings.length,
        completedBookings,
        totalCustomers: customers.length,
        totalTherapists: therapists.length,
        activeTherapists: therapists.filter((t) => t.isActive).length,
        totalCalls: callLogs.length,
        totalCallMinutes: Math.round(totalCallSeconds / 60)
      },
      therapistBreakdown: Object.values(therapistMap).sort((a, b) => b.revenue - a.revenue),
      recentTransactions: transactions
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/customer/admin/customers/:id
// @desc    Admin Panel: Get full customer details, bookings, call logs & transactions
router.get('/admin/customers/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).select('-otpCode -otpExpiresAt');
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const bookingQuery = [];
    if (customer.phone) bookingQuery.push({ 'client.phone': customer.phone }, { phone: customer.phone });
    if (customer.email) bookingQuery.push({ 'client.email': customer.email }, { email: customer.email });

    const bookings = bookingQuery.length > 0
      ? await Booking.find({ $or: bookingQuery }).sort({ createdAt: -1 })
      : [];
    const callLogs = await CallLog.find({ customerId: customer._id }).sort({ createdAt: -1 });
    const transactions = await WalletTransaction.find({ customerId: customer._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      customer,
      bookings,
      callLogs,
      transactions
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/customer/notifications/send-to-customer
// @desc    Send notification to a specific customer
router.post('/notifications/send-to-customer', async (req, res) => {
  try {
    const { customerId, title, body, type } = req.body;
    if (!customerId || !title || !body) {
      return res.status(400).json({ success: false, message: 'Customer, title, and body are required' });
    }
    const notif = await sendNotificationToCustomer({
      customerId,
      title,
      body,
      type: type || 'offer'
    });
    res.status(201).json({ success: true, message: 'Notification sent to customer!', data: notif });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/customer/legal
// @desc    Get Privacy Policy, Terms & About content
router.get('/legal', async (req, res) => {
  try {
    let doc = await SiteContent.findOne({ key: 'main' });
    if (!doc) {
      doc = await SiteContent.create({ key: 'main' });
    }
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/customer/legal
// @desc    Update Privacy Policy, Terms & About content from Admin Panel
router.put('/legal', async (req, res) => {
  try {
    const { aboutApp, termsConditions, privacyPolicy } = req.body;
    let doc = await SiteContent.findOne({ key: 'main' });
    if (!doc) {
      doc = await SiteContent.create({ key: 'main', aboutApp, termsConditions, privacyPolicy });
    } else {
      if (aboutApp !== undefined) doc.aboutApp = aboutApp;
      if (termsConditions !== undefined) doc.termsConditions = termsConditions;
      if (privacyPolicy !== undefined) doc.privacyPolicy = privacyPolicy;
      await doc.save();
    }
    res.json({ success: true, message: 'Legal pages updated!', data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/customer/therapist-analytics/:therapistId
// @desc    Admin Panel: Get Therapist Analytics (Sessions, Talk Time, Customers, Revenue)
router.get('/therapist-analytics/:therapistId', async (req, res) => {
  try {
    const { therapistId } = req.params;
    const therapist = await Therapist.findById(therapistId);
    if (!therapist) {
      return res.status(404).json({ success: false, message: 'Therapist not found' });
    }

    const bookings = await Booking.find({
      $or: [{ therapistId }, { therapistChoice: therapist.name }]
    }).sort({ createdAt: -1 });

    const callLogs = await CallLog.find({
      $or: [{ therapistId }, { therapistName: therapist.name }]
    }).sort({ createdAt: -1 });

    const completedSessions = bookings.filter((b) => b.status === 'Completed').length;
    const totalTalkSeconds = callLogs.reduce((sum, l) => sum + (l.durationSeconds || 0), 0);
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.amount || 0), 0);

    const uniqueCustomerKeys = new Set();
    bookings.forEach((b) => {
      if (b.client?.phone) uniqueCustomerKeys.add(b.client.phone);
      else if (b.client?.email) uniqueCustomerKeys.add(b.client.email);
    });
    callLogs.forEach((l) => {
      if (l.customerId) uniqueCustomerKeys.add(String(l.customerId));
    });

    res.json({
      success: true,
      therapist,
      stats: {
        totalBookings: bookings.length,
        completedSessions,
        totalTalkSeconds,
        uniqueCustomersCount: uniqueCustomerKeys.size,
        totalRevenue
      },
      bookings,
      callLogs
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/customer/notifications
// @desc    Get all notifications from MongoDB
router.get('/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: notifications });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   PUT /api/customer/notifications/read-all
// @desc    Mark all notifications as read
router.put('/notifications/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   PUT /api/customer/notifications/:id/read
// @desc    Mark a single notification as read
router.put('/notifications/:id/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   PUT /api/customer/notifications/:id/read
// @desc    Mark a single notification as read
router.put('/notifications/:id/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

// @route   POST /api/customer/notifications/broadcast
// @desc    Admin broadcast custom offer/notification via FCM + DB
router.post('/notifications/broadcast', async (req, res) => {
  try {
    const { title, body, type } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }
    const notif = await createAndBroadcastNotification({
      title,
      body,
      type: type || 'offer'
    });
    res.status(201).json({ success: true, data: notif });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({
      success: false,
      message: err.error?.description || err.message || 'Could not create Razorpay order'
    });
  }
});

module.exports = router;
