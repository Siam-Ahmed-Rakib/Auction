require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { initSocket } = require('./socket');
const { startAuctionScheduler } = require('./services/auctionScheduler');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const auctionRoutes = require('./routes/auctions');
const bidRoutes = require('./routes/bids');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const feedbackRoutes = require('./routes/feedback');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/users');
const searchRoutes = require('./routes/search');
const disputeRoutes = require('./routes/disputes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/disputes', disputeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Start auction scheduler
startAuctionScheduler();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };
