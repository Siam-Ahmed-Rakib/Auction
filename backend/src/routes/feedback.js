const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Leave feedback
router.post('/:orderId', auth, [
  body('rating').isInt({ min: 1, max: 5 }),
  body('communication').optional().isInt({ min: 1, max: 5 }),
  body('shipping').optional().isInt({ min: 1, max: 5 }),
  body('description').optional().isInt({ min: 1, max: 5 }),
  body('comment').optional().trim()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    const isBuyer = order.buyerId === req.user.id;
    const isSeller = order.sellerId === req.user.id;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!['DELIVERED', 'COMPLETED'].includes(order.status)) {
      return res.status(400).json({ error: 'Order must be delivered before leaving feedback' });
    }

    const toUserId = isBuyer ? order.sellerId : order.buyerId;
    const type = isBuyer ? 'BUYER_TO_SELLER' : 'SELLER_TO_BUYER';

    const { rating, communication, shipping, description, comment } = req.body;

    const feedback = await prisma.feedback.create({
      data: {
        rating,
        communication,
        shipping,
        description,
        comment,
        type,
        orderId: order.id,
        fromUserId: req.user.id,
        toUserId
      }
    });

    // Update user rating
    const allFeedback = await prisma.feedback.findMany({
      where: { toUserId }
    });

    const avgRating = allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length;
    const positiveCount = allFeedback.filter(f => f.rating >= 4).length;

    await prisma.user.update({
      where: { id: toUserId },
      data: {
        rating: Math.round(avgRating * 10) / 10,
        totalRatings: allFeedback.length,
        positiveRate: Math.round((positiveCount / allFeedback.length) * 1000) / 10
      }
    });

    // Check if both parties have left feedback
    const otherFeedback = await prisma.feedback.findFirst({
      where: { orderId: order.id, fromUserId: toUserId }
    });

    if (otherFeedback) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED' }
      });
    }

    // Notify
    const { createNotification } = require('../services/notificationService');
    await createNotification({
      userId: toUserId,
      type: 'FEEDBACK_RECEIVED',
      title: 'New feedback received',
      message: `You received a ${rating}-star rating.`,
      data: { orderId: order.id }
    });

    res.status(201).json(feedback);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'You have already left feedback for this order' });
    }
    next(error);
  }
});

// Get feedback for a user
router.get('/user/:userId', async (req, res, next) => {
  try {
    const feedback = await prisma.feedback.findMany({
      where: { toUserId: req.params.userId },
      include: {
        fromUser: { select: { id: true, username: true } },
        order: {
          select: {
            auction: { select: { id: true, title: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(feedback);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
