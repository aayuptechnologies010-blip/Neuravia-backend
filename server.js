require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./src/config/db');

// Connect to Database
connectDB();

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health Check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Neuravia Backend API is operational',
    timestamp: new Date().toISOString()
  });
});

// Serve static uploaded files
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount Routes
app.use('/api/upload', require('./src/routes/uploadRoutes'));
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/therapists', require('./src/routes/therapistRoutes'));
app.use('/api/bookings', require('./src/routes/bookingRoutes'));
app.use('/api/enquiries', require('./src/routes/enquiryRoutes'));
app.use('/api/plans', require('./src/routes/planRoutes'));
app.use('/api/dashboard', require('./src/routes/dashboardRoutes'));

// 404 Route
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API Route not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Neuravia Backend Server running on port ${PORT}`);
});
