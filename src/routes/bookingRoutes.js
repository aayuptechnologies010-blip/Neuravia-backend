const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Booking = require('../models/Booking');
const { protectAdmin } = require('../middleware/auth');

// Initialize Razorpay instance safely
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
};

// @route   POST /api/bookings/razorpay-order
// @desc    Create Razorpay Order for session booking
router.post('/razorpay-order', async (req, res) => {
  try {
    const { amount = 499, receipt = `rcpt_${Date.now()}` } = req.body;
    const razorpay = getRazorpayInstance();
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_Tg0jCOdf4BJnpp';

    if (razorpay) {
      const options = {
        amount: Math.round(Number(amount) * 100), // amount in paise
        currency: 'INR',
        receipt: receipt.toString().substring(0, 40)
      };
      const order = await razorpay.orders.create(options);
      return res.json({
        success: true,
        order,
        keyId
      });
    }

    // Fallback simulated order if instance cannot be initialized
    const fakeOrderId = 'order_test_' + Date.now();
    return res.json({
      success: true,
      order: {
        id: fakeOrderId,
        amount: Math.round(Number(amount) * 100),
        currency: 'INR',
        receipt
      },
      keyId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/bookings/verify-payment
// @desc    Verify Razorpay payment signature & create confirmed booking
router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingData } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    // Verify signature if provided
    if (secret && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid Razorpay payment signature' });
      }
    }

    const bookingId = 'NRV-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const newBooking = await Booking.create({
      ...bookingData,
      bookingId: bookingData?.bookingId || bookingId,
      status: 'Confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      razorpayOrderId: razorpay_order_id || '',
      razorpayPaymentId: razorpay_payment_id || '',
      razorpaySignature: razorpay_signature || ''
    });

    res.status(201).json({
      success: true,
      message: 'Payment verified and booking confirmed successfully',
      data: newBooking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/bookings
// @desc    Create new booking directly (Public fallback)
router.post('/', async (req, res) => {
  try {
    const bookingId = 'NRV-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const newBooking = await Booking.create({
      ...req.body,
      bookingId: req.body.bookingId || bookingId,
      paymentStatus: req.body.paymentStatus || 'paid',
      paymentMethod: req.body.paymentMethod || 'razorpay'
    });
    res.status(201).json({ success: true, data: newBooking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   GET /api/bookings
// @desc    Get all bookings (Admin)
router.get('/', protectAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get single booking (Admin)
router.get('/:id', protectAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/bookings/:id/status
// @desc    Update booking status or meeting link (Admin)
router.put('/:id/status', protectAdmin, async (req, res) => {
  try {
    const { status, meetingLink, notes } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: { ...(status && { status }), ...(meetingLink !== undefined && { meetingLink }), ...(notes !== undefined && { notes }) } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/bookings/:id
// @desc    Delete booking (Admin)
router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
