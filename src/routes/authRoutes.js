const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { protectAdmin } = require('../middleware/auth');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'neuravia_jwt_secret', {
    expiresIn: '30d'
  });
};

// @route   POST /api/auth/login
// @desc    Admin login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const defaultAdminEmail = (process.env.ADMIN_EMAIL || 'admin@neuravia.in').toLowerCase();
    const defaultAdminPass = process.env.ADMIN_PASSWORD || 'admin123456';

    // Check DB first
    let admin = null;
    try {
      admin = await Admin.findOne({ email: email.toLowerCase() });
    } catch (e) {
      // If DB error, fallback
    }

    if (admin) {
      const isMatch = await admin.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
      return res.json({
        success: true,
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          avatar: admin.avatar || '',
          phone: admin.phone || '',
          bio: admin.bio || '',
          title: admin.title || ''
        },
        token: generateToken(admin._id)
      });
    }

    // Fallback default admin check
    if (email.toLowerCase() === defaultAdminEmail && password === defaultAdminPass) {
      // Auto-create or ensure in DB if connected
      let fallbackAdmin = null;
      try {
        fallbackAdmin = await Admin.findOne({ email: defaultAdminEmail });
        if (!fallbackAdmin) {
          fallbackAdmin = await Admin.create({
            name: 'Super Admin',
            email: defaultAdminEmail,
            password: defaultAdminPass,
            role: 'superadmin',
            title: 'Lead Administrator & Care Director'
          });
        }
      } catch (err) {
        // DB not connected or error
      }

      const adminId = fallbackAdmin ? fallbackAdmin._id : 'admin_master_1';
      return res.json({
        success: true,
        admin: {
          id: adminId,
          name: fallbackAdmin ? fallbackAdmin.name : 'Super Admin',
          email: defaultAdminEmail,
          role: 'superadmin',
          avatar: fallbackAdmin ? fallbackAdmin.avatar : '',
          phone: fallbackAdmin ? fallbackAdmin.phone : '+91 98765 43210',
          bio: fallbackAdmin ? fallbackAdmin.bio : 'Dedicated to clinical excellence at Neuravia.',
          title: fallbackAdmin ? fallbackAdmin.title : 'Lead Administrator'
        },
        token: generateToken(adminId)
      });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/auth/profile
// @desc    Get current admin profile
router.get('/profile', protectAdmin, async (req, res) => {
  try {
    const adminId = req.admin?.id;
    let admin = null;
    if (adminId && adminId !== 'admin_master_1') {
      admin = await Admin.findById(adminId).select('-password');
    }
    if (!admin) {
      // fallback to first admin or default
      const defaultEmail = (process.env.ADMIN_EMAIL || 'admin@neuravia.in').toLowerCase();
      admin = await Admin.findOne({ email: defaultEmail }).select('-password');
      if (!admin) {
        return res.json({
          success: true,
          admin: {
            id: 'admin_master_1',
            name: 'Super Admin',
            email: defaultEmail,
            role: 'superadmin',
            avatar: '',
            phone: '+91 98765 43210',
            title: 'Lead Administrator & Care Director',
            bio: 'Dedicated to upholding clinical excellence and patient care across Neuravia.'
          }
        });
      }
    }

    res.json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        avatar: admin.avatar || '',
        phone: admin.phone || '',
        title: admin.title || '',
        bio: admin.bio || ''
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update admin profile & photo / password
router.put('/profile', protectAdmin, async (req, res) => {
  try {
    const adminId = req.admin?.id;
    let admin = null;

    if (adminId && adminId !== 'admin_master_1') {
      admin = await Admin.findById(adminId);
    }

    if (!admin) {
      const defaultEmail = (process.env.ADMIN_EMAIL || 'admin@neuravia.in').toLowerCase();
      admin = await Admin.findOne({ email: defaultEmail });
      if (!admin) {
        admin = new Admin({
          name: req.body.name || 'Super Admin',
          email: defaultEmail,
          password: process.env.ADMIN_PASSWORD || 'admin123456',
          role: 'superadmin'
        });
      }
    }

    const { name, email, phone, bio, title, avatar, currentPassword, newPassword } = req.body;

    if (name) admin.name = name;
    if (email) admin.email = email.toLowerCase();
    if (phone !== undefined) admin.phone = phone;
    if (bio !== undefined) admin.bio = bio;
    if (title !== undefined) admin.title = title;
    if (avatar !== undefined) admin.avatar = avatar;

    // Handle password change if requested
    if (newPassword) {
      if (currentPassword) {
        const isMatch = await admin.matchPassword(currentPassword);
        if (!isMatch) {
          return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }
      }
      admin.password = newPassword;
    }

    await admin.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        avatar: admin.avatar || '',
        phone: admin.phone || '',
        title: admin.title || '',
        bio: admin.bio || ''
      },
      token: generateToken(admin._id)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
