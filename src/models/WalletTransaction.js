const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  minutesAdded: {
    type: Number,
    default: 0
  },
  title: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: 'Success'
  }
}, { timestamps: true });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
