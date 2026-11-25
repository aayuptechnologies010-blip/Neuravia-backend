const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  therapistId: {
    type: String,
    required: true
  },
  therapistName: {
    type: String,
    required: true
  },
  durationSeconds: {
    type: Number,
    default: 0
  },
  minutesDeducted: {
    type: Number,
    default: 0
  },
  amountDeducted: {
    type: Number,
    default: 0
  },
  maskedNumber: {
    type: String,
    default: '+91 98XXX XXX45 (Masked Bridge)'
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('CallLog', callLogSchema);
