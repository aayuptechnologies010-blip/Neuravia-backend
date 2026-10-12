const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  therapistChoice: {
    type: String,
    required: true
  },
  therapistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Therapist',
    default: null
  },
  client: {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    city: { type: String, required: true },
    pincode: { type: String, required: true },
    helpCategory: { type: String, required: true },
    concernDescription: { type: String, required: true }
  },
  amount: {
    type: Number,
    default: 499
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Confirmed', 'Completed', 'Cancelled'],
    default: 'Confirmed'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'paid'
  },
  paymentMethod: {
    type: String,
    default: 'razorpay'
  },
  razorpayOrderId: {
    type: String,
    default: ''
  },
  razorpayPaymentId: {
    type: String,
    default: ''
  },
  razorpaySignature: {
    type: String,
    default: ''
  },
  meetingLink: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
