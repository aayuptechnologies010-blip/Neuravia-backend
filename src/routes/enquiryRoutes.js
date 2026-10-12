const express = require('express');
const router = express.Router();
const Enquiry = require('../models/Enquiry');
const { protectAdmin } = require('../middleware/auth');

// @route   POST /api/enquiries
// @desc    Submit new enquiry / contact message (Public)
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, category, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Please provide name, email and message' });
    }
    const enquiry = await Enquiry.create({
      name,
      email,
      phone: phone || '',
      subject: subject || 'General Query',
      category: category || 'General',
      message
    });
    res.status(201).json({ success: true, message: 'Enquiry submitted successfully', data: enquiry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   GET /api/enquiries
// @desc    Get all enquiries (Admin)
router.get('/', protectAdmin, async (req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.json({ success: true, count: enquiries.length, data: enquiries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/enquiries/:id/status
// @desc    Update enquiry status and admin reply (Admin)
router.put('/:id/status', protectAdmin, async (req, res) => {
  try {
    const { status, adminReply } = req.body;
    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.id,
      { $set: { ...(status && { status }), ...(adminReply !== undefined && { adminReply }) } },
      { new: true }
    );
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    res.json({ success: true, data: enquiry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/enquiries/:id
// @desc    Delete enquiry (Admin)
router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    res.json({ success: true, message: 'Enquiry deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
