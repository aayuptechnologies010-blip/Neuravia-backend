const express = require('express');
const router = express.Router();
const Speciality = require('../models/Speciality');
const { createAndBroadcastNotification } = require('../utils/fcmService');

// @route   GET /api/specialities
// @desc    Get all active specialities
router.get('/', async (req, res) => {
  try {
    const specialities = await Speciality.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: specialities });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/specialities
// @desc    Create a new speciality
router.post('/', async (req, res) => {
  try {
    const { name, icon, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Speciality name is required' });
    }
    const existing = await Speciality.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Speciality already exists' });
    }
    const speciality = await Speciality.create({
      name: name.trim(),
      icon: icon || '🧠',
      description: description || ''
    });
    await createAndBroadcastNotification({
      title: `New Speciality: ${speciality.name}`,
      body: `Explore verified therapists for ${speciality.name} on Neuravia.`,
      type: 'therapist',
      targetId: speciality._id
    });
    res.status(201).json({ success: true, data: speciality });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE /api/specialities/:id
// @desc    Delete a speciality
router.delete('/:id', async (req, res) => {
  try {
    await Speciality.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Speciality deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
