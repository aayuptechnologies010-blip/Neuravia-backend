const express = require('express');
const router = express.Router();
const Therapist = require('../models/Therapist');
const { protectAdmin } = require('../middleware/auth');

// Default initial therapists seeded with all 18 requested fields
const defaultTherapists = [
  {
    profilePhoto: 'https://images.unsplash.com/photo-1594824813637-8e6f14ddbd66?auto=format&fit=crop&w=600&q=80',
    name: 'Dr. Priya Sharma',
    title: 'Clinical Psychologist / Therapist',
    specialization: 'Anxiety, Stress & Relationship Therapy',
    experience: '6+ Years',
    qualification: 'M.A. Psychology, M.Phil Clinical Psychology',
    languages: ['Hindi', 'English'],
    sessionMode: 'Online / In-Person / Both',
    about: 'Dedicated clinical psychologist with over 6 years of experience helping individuals, teens, and couples navigate anxiety, stress, emotional blockages, and interpersonal conflicts through compassionate, structured therapy.',
    treats: ['Anxiety', 'Stress', 'Depression', 'Relationship Issues'],
    ageGroups: ['Teenagers', 'Adults', 'Couples'],
    therapyMethods: ['CBT', 'Mindfulness', 'Counseling'],
    sessionDuration: '45–60 Minutes',
    availability: 'Mon–Sat, 10 AM–8 PM',
    startingPrice: '₹499/session',
    pricePerSession: 499,
    rating: 4.8,
    totalSessions: '500+ Sessions Completed',
    isVerified: true,
    verifiedBadge: 'Neuravia Verified',
    isActive: true
  },
  {
    profilePhoto: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80',
    name: 'Dr. Ananya Sharma',
    title: 'Senior Clinical Psychologist (Ph.D.)',
    specialization: 'Trauma, Panic & Emotional Regulation',
    experience: '8+ Years',
    qualification: 'Ph.D. Clinical Psychology, NIMHANS Certified',
    languages: ['Hindi', 'English'],
    sessionMode: 'Online / In-Person / Both',
    about: 'Specializes in trauma-informed care and anxiety interventions. Warm, evidence-based approach designed to help you regain emotional stability and life clarity.',
    treats: ['Anxiety', 'Panic Attacks', 'Trauma Recovery', 'Self-Worth'],
    ageGroups: ['Adults', 'Couples'],
    therapyMethods: ['CBT', 'DBT', 'Mindfulness-Based Therapy'],
    sessionDuration: '50–60 Minutes',
    availability: 'Mon–Fri, 11 AM–7 PM',
    startingPrice: '₹499/session',
    pricePerSession: 499,
    rating: 4.9,
    totalSessions: '1,400+ Sessions Completed',
    isVerified: true,
    verifiedBadge: 'Neuravia Verified',
    isActive: true
  },
  {
    profilePhoto: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80',
    name: 'Dr. Rahul Verma',
    title: 'Counselling Psychologist',
    specialization: 'Work Burnout, Career Stress & Depression',
    experience: '6+ Years',
    qualification: 'M.Sc. Counselling Psychology, PG Diploma Guidance',
    languages: ['Hindi', 'English'],
    sessionMode: 'Online / Both',
    about: 'Provides a safe, non-judgmental space to unpack professional burnout, imposter syndrome, life crossroads, and mild to moderate depression.',
    treats: ['Depression', 'Work Burnout', 'Career Transitions', 'Low Self-Esteem'],
    ageGroups: ['Young Adults', 'Working Professionals'],
    therapyMethods: ['Person-Centered Counseling', 'Solution-Focused (SFBT)', 'CBT'],
    sessionDuration: '45–60 Minutes',
    availability: 'Mon–Sat, 12 PM–9 PM',
    startingPrice: '₹499/session',
    pricePerSession: 499,
    rating: 4.8,
    totalSessions: '920+ Sessions Completed',
    isVerified: true,
    verifiedBadge: 'Neuravia Verified',
    isActive: true
  },
  {
    profilePhoto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    name: 'Dr. Neha Singh',
    title: 'Consultant Clinical Psychologist',
    specialization: "Women's Wellbeing, Postpartum & OCD",
    experience: '7+ Years',
    qualification: 'M.Phil Clinical Psychology, RCI Registered',
    languages: ['Hindi', 'English'],
    sessionMode: 'Online / In-Person / Both',
    about: 'Deeply committed to maternal mental health, anxiety, and obsessive thoughts. Tailors practical coping exercises to each client’s daily rhythm.',
    treats: ["Women's Wellbeing", 'Postpartum Blues', 'OCD', 'Social Anxiety'],
    ageGroups: ['Teenagers', 'Adults'],
    therapyMethods: ['Exposure & Response Prevention (ERP)', 'CBT', 'Compassion Focused'],
    sessionDuration: '50–60 Minutes',
    availability: 'Tue–Sun, 10 AM–6 PM',
    startingPrice: '₹499/session',
    pricePerSession: 499,
    rating: 4.9,
    totalSessions: '1,100+ Sessions Completed',
    isVerified: true,
    verifiedBadge: 'Neuravia Verified',
    isActive: true
  }
];

// Helper to normalize therapist payload
const normalizeTherapistData = (body) => {
  const data = { ...body };
  if (typeof data.languages === 'string') {
    data.languages = data.languages.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (typeof data.treats === 'string') {
    data.treats = data.treats.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (typeof data.ageGroups === 'string') {
    data.ageGroups = data.ageGroups.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (typeof data.therapyMethods === 'string') {
    data.therapyMethods = data.therapyMethods.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (typeof data.specialties === 'string') {
    data.specialties = data.specialties.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (data.startingPrice && typeof data.startingPrice === 'string') {
    const num = parseInt(data.startingPrice.replace(/[^\d]/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      data.pricePerSession = num;
    }
  } else if (data.pricePerSession && !data.startingPrice) {
    data.startingPrice = `₹${data.pricePerSession}/session`;
  }
  return data;
};

// @route   GET /api/therapists
// @desc    Get all active therapists (public)
router.get('/', async (req, res) => {
  try {
    let therapists = [];
    try {
      therapists = await Therapist.find({ isActive: true }).sort({ createdAt: -1 });
    } catch (e) {}

    if (therapists.length === 0) {
      try {
        therapists = await Therapist.insertMany(defaultTherapists);
      } catch (err) {
        therapists = defaultTherapists.map((t, idx) => ({ ...t, _id: `seed_${idx + 1}` }));
      }
    }
    res.json({ success: true, count: therapists.length, data: therapists });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/therapists/admin/all
// @desc    Get all therapists including inactive (Admin)
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    let therapists = [];
    try {
      therapists = await Therapist.find().sort({ createdAt: -1 });
    } catch (e) {}

    if (therapists.length === 0) {
      try {
        therapists = await Therapist.insertMany(defaultTherapists);
      } catch (err) {
        therapists = defaultTherapists.map((t, idx) => ({ ...t, _id: `seed_${idx + 1}` }));
      }
    }
    res.json({ success: true, count: therapists.length, data: therapists });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/therapists/:id
// @desc    Get single therapist by ID
router.get('/:id', async (req, res) => {
  try {
    const therapist = await Therapist.findById(req.params.id);
    if (!therapist) return res.status(404).json({ success: false, message: 'Therapist not found' });
    res.json({ success: true, data: therapist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/therapists
// @desc    Create therapist (Admin)
router.post('/', protectAdmin, async (req, res) => {
  try {
    const data = normalizeTherapistData(req.body);
    const therapist = await Therapist.create(data);
    res.status(201).json({ success: true, data: therapist });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/therapists/:id
// @desc    Update therapist (Admin)
router.put('/:id', protectAdmin, async (req, res) => {
  try {
    const data = normalizeTherapistData(req.body);
    const therapist = await Therapist.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!therapist) return res.status(404).json({ success: false, message: 'Therapist not found' });
    res.json({ success: true, data: therapist });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/therapists/:id
// @desc    Delete therapist (Admin)
router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    const therapist = await Therapist.findByIdAndDelete(req.params.id);
    if (!therapist) return res.status(404).json({ success: false, message: 'Therapist not found' });
    res.json({ success: true, message: 'Therapist deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
