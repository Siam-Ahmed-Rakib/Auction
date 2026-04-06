const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { createNotification } = require('../services/notificationService');

// Open a dispute
router.post(
  '/',
  authenticate,
  [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('reason').notEmpty().withMessage('Reason is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { orderId, reason } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { buyer: true, seller: true },
      });

      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (order.buyerId !== req.user.id && order.sellerId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      if (!['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
        return res.status(400).json({ error: 'Cannot dispute this order' });
      }

      const existing = await prisma.dispute.findFirst({
        where: { orderId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      });
      if (existing) return res.status(400).json({ error: 'Active dispute already exists for this order' });

      const dispute = await prisma.dispute.create({
        data: {
          orderId,
          raisedById: req.user.id,
          reason,
          status: 'OPEN',
        },
      });

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'DISPUTED' },
      });

      // Notify the other party
      const otherUserId = order.buyerId === req.user.id ? order.sellerId : order.buyerId;
      await createNotification({
        userId: otherUserId,
        type: 'DISPUTE_OPENED',
        message: `A dispute has been opened for order #${order.orderNumber}`,
        auctionId: order.auctionId,
      });

      res.status(201).json(dispute);
    } catch (err) {
      next(err);
    }
  }
);

// Get disputes for user
router.get('/', authenticate, async (req, res, next) => {
  try {
    const disputes = await prisma.dispute.findMany({
      where: {
        OR: [
          { raisedById: req.user.id },
          { order: { buyerId: req.user.id } },
          { order: { sellerId: req.user.id } },
        ],
      },
      include: {
        order: {
          include: {
            auction: { select: { id: true, title: true, images: true } },
            buyer: { select: { id: true, username: true } },
            seller: { select: { id: true, username: true } },
          },
        },
        raisedBy: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(disputes);
  } catch (err) {
    next(err);
  }
});

// Get single dispute
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id: req.params.id },
      include: {
        order: {
          include: {
            auction: true,
            buyer: { select: { id: true, username: true, email: true } },
            seller: { select: { id: true, username: true, email: true } },
          },
        },
        raisedBy: { select: { id: true, username: true } },
      },
    });
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    // Check authorization
    const order = dispute.order;
    if (order.buyerId !== req.user.id && order.sellerId !== req.user.id && dispute.raisedById !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(dispute);
  } catch (err) {
    next(err);
  }
});

// Resolve dispute (mock admin action — in production, this would be admin-only)
router.put(
  '/:id/resolve',
  authenticate,
  [body('resolution').notEmpty().withMessage('Resolution is required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const dispute = await prisma.dispute.findUnique({
        where: { id: req.params.id },
        include: { order: true },
      });

      if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
      if (!['OPEN', 'UNDER_REVIEW'].includes(dispute.status)) {
        return res.status(400).json({ error: 'Dispute is already resolved' });
      }

      const updated = await prisma.dispute.update({
        where: { id: req.params.id },
        data: {
          status: 'RESOLVED',
          resolution: req.body.resolution,
          resolvedAt: new Date(),
        },
      });

      // Update order status back
      await prisma.order.update({
        where: { id: dispute.orderId },
        data: { status: 'COMPLETED' },
      });

      // Notify both parties
      const order = dispute.order;
      for (const userId of [order.buyerId, order.sellerId]) {
        await createNotification({
          userId,
          type: 'DISPUTE_OPENED', // Reusing type for resolution notification
          message: `Dispute for order #${order.orderNumber} has been resolved`,
          auctionId: order.auctionId,
        });
      }

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
