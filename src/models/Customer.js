const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  name: {
    type: String,
    default: '',
    trim: true
  },
  email: {
    type: String,
    default: '',
    trim: true
  },
  dob: {
    type: String,
    default: ''
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', ''],
    default: ''
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  fcmToken: {
    type: String,
    default: ''
  },
  walletBalance: {
    type: Number,
    default: 0
  },
  talkTimeMinutes: {
    type: Number,
    default: 0
  },
  remainingPlanSessions: {
    type: Number,
    default: 0
  },
  planSessionMinutes: {
    type: Number,
    default: 20
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  otpCode: {
    type: String,
    default: ''
  },
  otpExpiresAt: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
