const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const sessionRoutes = require('./routes/session.routes');
const songRoutes = require('./routes/song.routes');
const { errorHandler } = require('./middlewares/error.middleware');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/songs', songRoutes);

// Kiểm tra API
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API is running' });
});

// Error handling middleware
app.use(errorHandler);

module.exports = app; 