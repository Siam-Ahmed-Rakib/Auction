const prisma = require('../config/db');

async function createNotification({ userId, type, title, message, data }) {
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, message, data: data || {} }
    });

    // Try to emit via socket
    try {
      const { getIO } = require('../socket');
      const io = getIO();
      io.to(`user:${userId}`).emit('notification', notification);
    } catch (e) {
      // Socket not initialized yet
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error.message);
  }
}

module.exports = { createNotification };
