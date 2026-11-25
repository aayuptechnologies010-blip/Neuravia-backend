const mongoose = require('mongoose');

const specialitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  icon: {
    type: String,
    default: '🧠'
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Speciality', specialitySchema);
