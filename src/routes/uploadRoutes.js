const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure base uploads directory exists
const baseUploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(baseUploadsDir)) {
  fs.mkdirSync(baseUploadsDir, { recursive: true });
}

// Helper to sanitize category name (prevent directory traversal)
const getSanitizedCategory = (cat) => {
  if (!cat || typeof cat !== 'string') return 'general';
  const sanitized = cat.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim();
  return sanitized || 'general';
};

// Multer Disk Storage Configuration with Dynamic Categories
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = getSanitizedCategory(req.query.category || req.body.category);
    const targetDir = path.join(baseUploadsDir, category);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const category = getSanitizedCategory(req.query.category || req.body.category);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${category}-${uniqueSuffix}${ext}`);
  }
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif|svg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only image files (jpeg, jpg, png, webp, gif, svg) are allowed!'));
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter
});

// Helper to format full public URL
const getFileUrl = (req, category, fileName) => {
  const host = req.get('host');
  const protocol = req.protocol;
  return `${protocol}://${host}/uploads/${category}/${fileName}`;
};

// @route   POST /api/upload
// @desc    Upload file via multipart/form-data
router.post('/', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    const category = getSanitizedCategory(req.query.category || req.body.category);
    const fileName = req.file.filename;
    const fileUrl = getFileUrl(req, category, fileName);
    const relativePath = `/uploads/${category}/${fileName}`;

    res.status(201).json({
      success: true,
      message: `Image uploaded to ${category} folder successfully`,
      data: {
        category,
        fileName,
        fileUrl,
        relativePath
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/upload/base64
// @desc    Upload image from cropped canvas/base64 data URL
router.post('/base64', (req, res) => {
  try {
    const { image, base64, category: rawCat } = req.body;
    const dataUri = image || base64;

    if (!dataUri) {
      return res.status(400).json({ success: false, message: 'Base64 image data is required' });
    }

    const category = getSanitizedCategory(rawCat);
    const targetDir = path.join(baseUploadsDir, category);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Match mime type and base64 string
    const matches = dataUri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    let ext = '.jpg';

    if (matches && matches.length === 3) {
      const mime = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
      if (mime.includes('png')) ext = '.png';
      else if (mime.includes('webp')) ext = '.webp';
      else if (mime.includes('gif')) ext = '.gif';
      else if (mime.includes('svg')) ext = '.svg';
    } else {
      buffer = Buffer.from(dataUri, 'base64');
    }

    const fileName = `${category}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    const filePath = path.join(targetDir, fileName);

    fs.writeFileSync(filePath, buffer);

    const fileUrl = getFileUrl(req, category, fileName);
    const relativePath = `/uploads/${category}/${fileName}`;

    res.status(201).json({
      success: true,
      message: `Image saved to ${category} folder successfully`,
      data: {
        category,
        fileName,
        fileUrl,
        relativePath
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
