const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const sessionRoutes = require('./routes/session.routes');
const songRoutes = require('./routes/song.routes');
const { errorHandler } = require('./middlewares/error.middleware');

const app = express();

// Cấu hình CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'my-custom-header'],
  credentials: true
}));

app.use(express.json());

// Health check API
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/songs', songRoutes);

// Error handling
app.use(errorHandler);

module.exports = app; 