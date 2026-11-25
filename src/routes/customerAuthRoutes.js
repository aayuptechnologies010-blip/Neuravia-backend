const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

// Helper: Generate JWT for customer
const generateToken = (id) => {
  return jwt.sign({ id, role: 'customer' }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

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

// @route   POST /api/customer/send-otp
// @desc    Send OTP to mobile number & check if user exists in DB
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number is required' });
    }

    const cleanPhone = phone.trim();
    let customer = await Customer.findOne({ phone: cleanPhone });
    const isExistingUser = Boolean(customer && customer.isProfileComplete);

    // Generate 4-digit OTP (in dev mode use 1234 or random)
    const otp = process.env.NODE_ENV === 'production'
      ? Math.floor(1000 + Math.random() * 9000).toString()
      : '1234';

    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    if (!customer) {
      customer = await Customer.create({
        phone: cleanPhone,
        otpCode: otp,
        otpExpiresAt
      });
    } else {
      customer.otpCode = otp;
      customer.otpExpiresAt = otpExpiresAt;
      await customer.save();
    }

    res.json({
      success: true,
      message: 'OTP sent successfully',
      isExistingUser,
      ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {})
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/customer/verify-otp
// @desc    Verify OTP, save FCM token, return JWT & profile status
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp, fcmToken } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    const customer = await Customer.findOne({ phone: phone.trim() });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found. Please request OTP again.' });
    }

    if (customer.otpCode !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (customer.otpExpiresAt && customer.otpExpiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please resend.' });
    }

    // Clear OTP & update FCM token if provided
    customer.otpCode = '';
    if (fcmToken) {
      customer.fcmToken = fcmToken;
    }
    await customer.save();

    const token = generateToken(customer._id);

    res.json({
      success: true,
      message: 'OTP verified successfully',
      token,
      isProfileComplete: customer.isProfileComplete,
      user: {
        id: customer._id,
        phone: customer.phone,
        name: customer.name,
        dob: customer.dob,
        gender: customer.gender,
        profilePhoto: customer.profilePhoto,
        walletBalance: customer.walletBalance,
        talkTimeMinutes: customer.talkTimeMinutes,
        isProfileComplete: customer.isProfileComplete
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/customer/complete-profile
// @desc    Complete basic profile details & profile photo after OTP
router.post('/complete-profile', protectCustomer, async (req, res) => {
  try {
    const { name, dob, gender, profilePhoto, fcmToken } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }

    const customer = req.customer;
    customer.name = name.trim();
    if (dob !== undefined) customer.dob = dob;
    if (gender !== undefined) customer.gender = gender;
    if (profilePhoto !== undefined) customer.profilePhoto = profilePhoto;
    if (fcmToken) customer.fcmToken = fcmToken;
    customer.isProfileComplete = true;

    await customer.save();

    res.json({
      success: true,
      message: 'Profile completed successfully',
      user: {
        id: customer._id,
        phone: customer.phone,
        name: customer.name,
        dob: customer.dob,
        gender: customer.gender,
        profilePhoto: customer.profilePhoto,
        walletBalance: customer.walletBalance,
        talkTimeMinutes: customer.talkTimeMinutes,
        isProfileComplete: customer.isProfileComplete
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/customer/google-login
// @desc    Login or register customer via Google Sign-In
router.post('/google-login', async (req, res) => {
  try {
    const { email, name, profilePhoto, fcmToken } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Google email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let customer = await Customer.findOne({ email: cleanEmail });

    if (!customer) {
      customer = await Customer.create({
        email: cleanEmail,
        name: name || '',
        profilePhoto: profilePhoto || '',
        fcmToken: fcmToken || '',
        isProfileComplete: false
      });
    } else {
      if (fcmToken) customer.fcmToken = fcmToken;
      if (!customer.name && name) customer.name = name;
      if (!customer.profilePhoto && profilePhoto) customer.profilePhoto = profilePhoto;
      await customer.save();
    }

    const token = generateToken(customer._id);
    const needsPhone = !customer.phone || customer.phone.trim() === '';

    res.json({
      success: true,
      message: 'Google login successful',
      token,
      needsPhone,
      isProfileComplete: customer.isProfileComplete,
      user: {
        id: customer._id,
        phone: customer.phone || '',
        email: customer.email,
        name: customer.name,
        dob: customer.dob,
        gender: customer.gender,
        profilePhoto: customer.profilePhoto,
        walletBalance: customer.walletBalance,
        talkTimeMinutes: customer.talkTimeMinutes,
        isProfileComplete: customer.isProfileComplete
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/customer/link-phone
// @desc    Link phone number after Google login (merges if phone already exists)
router.post('/link-phone', protectCustomer, async (req, res) => {
  try {
    const { phone, otp, fcmToken } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    const cleanPhone = phone.trim();
    const currentGoogleUser = req.customer;

    // Check OTP record on the phone number (created by /send-otp)
    const phoneRecord = await Customer.findOne({ phone: cleanPhone });

    if (!phoneRecord) {
      return res.status(400).json({ success: false, message: 'Please request OTP first' });
    }
    if (phoneRecord.otpCode !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    if (phoneRecord.otpExpiresAt && phoneRecord.otpExpiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please resend.' });
    }

    // Case B: Phone already belongs to another existing account -> Merge!
    if (phoneRecord._id.toString() !== currentGoogleUser._id.toString()) {
      const mergedExisting = phoneRecord.isProfileComplete;
      phoneRecord.email = currentGoogleUser.email || phoneRecord.email;
      if (!phoneRecord.name && currentGoogleUser.name) phoneRecord.name = currentGoogleUser.name;
      if (!phoneRecord.profilePhoto && currentGoogleUser.profilePhoto) phoneRecord.profilePhoto = currentGoogleUser.profilePhoto;
      if (fcmToken) phoneRecord.fcmToken = fcmToken;
      phoneRecord.otpCode = '';
      await phoneRecord.save();

      // Remove temporary Google-only account if it had no phone
      if (!currentGoogleUser.phone) {
        await Customer.findByIdAndDelete(currentGoogleUser._id);
      }

      const newToken = generateToken(phoneRecord._id);
      return res.json({
        success: true,
        merged: mergedExisting,
        message: mergedExisting
          ? 'Google account linked to your existing Neuravia account!'
          : 'Phone verified successfully!',
        token: newToken,
        isProfileComplete: phoneRecord.isProfileComplete,
        user: {
          id: phoneRecord._id,
          phone: phoneRecord.phone,
          email: phoneRecord.email,
          name: phoneRecord.name,
          dob: phoneRecord.dob,
          gender: phoneRecord.gender,
          profilePhoto: phoneRecord.profilePhoto,
          walletBalance: phoneRecord.walletBalance,
          talkTimeMinutes: phoneRecord.talkTimeMinutes,
          isProfileComplete: phoneRecord.isProfileComplete
        }
      });
    }

    // Case A: Same user
    phoneRecord.otpCode = '';
    if (fcmToken) phoneRecord.fcmToken = fcmToken;
    await phoneRecord.save();

    res.json({
      success: true,
      merged: false,
      message: 'Phone linked successfully',
      token: generateToken(phoneRecord._id),
      isProfileComplete: phoneRecord.isProfileComplete,
      user: phoneRecord
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/customer/me
// @desc    Get current logged-in customer profile
router.get('/me', protectCustomer, async (req, res) => {
  res.json({ success: true, user: req.customer });
});

module.exports = router;
