const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['plan', 'therapist', 'wallet', 'history', 'offer'],
    default: 'offer'
  },
  targetId: {
    type: String,
    default: ''
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
