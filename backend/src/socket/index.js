const { Server } = require('socket.io');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join auction room for live updates
    socket.on('join-auction', (auctionId) => {
      socket.join(`auction:${auctionId}`);
    });

    socket.on('leave-auction', (auctionId) => {
      socket.leave(`auction:${auctionId}`);
    });

    // Join user room for personal notifications
    socket.on('join-user', (userId) => {
      socket.join(`user:${userId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initSocket, getIO };
