const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  sessionsCount: {
    type: Number,
    required: true
  },
  effectivePrice: {
    type: String,
    required: true
  },
  savings: {
    type: String,
    default: null
  },
  subtitle: {
    type: String,
    default: ''
  },
  badge: {
    type: String,
    default: null
  },
  isBestValue: {
    type: Boolean,
    default: false
  },
  features: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
