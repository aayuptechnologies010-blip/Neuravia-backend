const express = require('express');
const router = express.Router();
const Plan = require('../models/Plan');
const { protectAdmin } = require('../middleware/auth');

const defaultPlans = [
  {
    name: "Single Session",
    price: 499,
    sessionsCount: 1,
    effectivePrice: "₹499 / session",
    savings: null,
    subtitle: "Start with one session.",
    badge: null,
    isBestValue: false,
    features: [
      "Up to 50 minutes each",
      "Online sessions",
      "Confidential & private",
      "Flexible scheduling"
    ],
    isActive: true
  },
  {
    name: "6 Session Plan",
    price: 2500,
    sessionsCount: 6,
    effectivePrice: "₹417 / session",
    savings: "Save ₹494",
    subtitle: "Support for ongoing challenges.",
    badge: "POPULAR",
    isBestValue: false,
    features: [
      "Up to 50 minutes each",
      "Online sessions",
      "Confidential & private",
      "Flexible scheduling"
    ],
    isActive: true
  },
  {
    name: "12 Session Plan",
    price: 4500,
    sessionsCount: 12,
    effectivePrice: "₹375 / session",
    savings: "Save ₹1,488",
    subtitle: "Comprehensive deep progress.",
    badge: "BEST VALUE",
    isBestValue: true,
    features: [
      "Up to 50 minutes each",
      "Online sessions",
      "Confidential & private",
      "Flexible scheduling"
    ],
    isActive: true
  },
  {
    name: "20 Session Plan",
    price: 8000,
    sessionsCount: 20,
    effectivePrice: "₹400 / session",
    savings: "Save ₹1,980",
    subtitle: "Long-term therapeutic journey.",
    badge: null,
    isBestValue: false,
    features: [
      "Up to 50 minutes each",
      "Online sessions",
      "Confidential & private",
      "Flexible scheduling"
    ],
    isActive: true
  }
];

// @route   GET /api/plans
// @desc    Get all active plans (Public)
router.get('/', async (req, res) => {
  try {
    let plans = [];
    try {
      plans = await Plan.find({ isActive: true }).sort({ price: 1 });
    } catch (e) {}

    if (plans.length === 0) {
      try {
        plans = await Plan.insertMany(defaultPlans);
      } catch (err) {
        plans = defaultPlans.map((p, idx) => ({ ...p, _id: `seed_plan_${idx + 1}` }));
      }
    }
    res.json({ success: true, count: plans.length, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/plans/admin/all
// @desc    Get all plans (Admin)
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const plans = await Plan.find().sort({ price: 1 });
    res.json({ success: true, count: plans.length, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/plans
// @desc    Create new plan (Admin)
router.post('/', protectAdmin, async (req, res) => {
  try {
    const plan = await Plan.create(req.body);
    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/plans/:id
// @desc    Update plan (Admin)
router.put('/:id', protectAdmin, async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/plans/:id
// @desc    Delete plan (Admin)
router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
