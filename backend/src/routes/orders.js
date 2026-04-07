const express = require('express');
const { body } = require('express-validator');
const prisma = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get user's orders (as buyer)
router.get('/buying', auth, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { buyerId: req.user.id },
      include: {
        auction: { select: { id: true, title: true, images: true, category: true } },
        seller: { select: { id: true, username: true, rating: true } },
        payment: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// Get user's orders (as seller)
router.get('/selling', auth, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { sellerId: req.user.id },
      include: {
        auction: { select: { id: true, title: true, images: true, category: true } },
        buyer: { select: { id: true, username: true, rating: true } },
        payment: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// Get single order
router.get('/:id', auth, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        auction: true,
        buyer: { select: { id: true, username: true, name: true, email: true, address: true, city: true, state: true, zipCode: true, country: true } },
        seller: { select: { id: true, username: true, name: true, email: true } },
        payment: true,
        feedback: true,
        dispute: true
      }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.id && order.sellerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Update shipping info (seller)
router.put('/:id/ship', auth, [
  body('trackingNumber').notEmpty().trim(),
  body('shippingCarrier').notEmpty().trim()
], async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.sellerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (order.status !== 'PAID') return res.status(400).json({ error: 'Order must be paid first' });

    const { trackingNumber, shippingCarrier, estimatedDelivery } = req.body;

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        trackingNumber,
        shippingCarrier,
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'SHIPPED'
      }
    });

    // Notify buyer
    const { createNotification } = require('../services/notificationService');
    await createNotification({
      userId: order.buyerId,
      type: 'ITEM_SHIPPED',
      title: 'Your item has shipped!',
      message: `Tracking: ${trackingNumber} via ${shippingCarrier}`,
      data: { orderId: order.id }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Confirm delivery (buyer)
router.post('/:id/deliver', auth, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { payment: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (order.status !== 'SHIPPED') return res.status(400).json({ error: 'Order must be shipped first' });

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date()
      }
    });

    // Release payment
    if (order.payment) {
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: { status: 'RELEASED', releasedAt: new Date() }
      });
    }

    // Notify seller
    const { createNotification } = require('../services/notificationService');
    await createNotification({
      userId: order.sellerId,
      type: 'ITEM_DELIVERED',
      title: 'Item delivered!',
      message: `Your item has been delivered. Payment has been released.`,
      data: { orderId: order.id }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
