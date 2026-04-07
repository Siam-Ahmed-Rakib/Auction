const express = require('express');
const prisma = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get user notifications
router.get('/', auth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { userId: req.user.id };
    if (unreadOnly === 'true') where.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user.id, read: false } })
    ]);

    res.json({ notifications, total, unreadCount });
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
router.put('/:id/read', auth, async (req, res, next) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true }
    });
    res.json(notification);
  } catch (error) {
    next(error);
  }
});

// Mark all as read
router.put('/read-all', auth, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true }
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
