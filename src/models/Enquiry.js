const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    default: ''
  },
  subject: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: 'General'
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['New', 'In Progress', 'Resolved', 'Closed'],
    default: 'New'
  },
  adminReply: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Enquiry', enquirySchema);
