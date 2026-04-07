const express = require('express');
const { body } = require('express-validator');
const prisma = require('../config/db');
const { auth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Process payment for an order
router.post('/:orderId/pay', auth, [
  body('method').isIn(['card', 'paypal', 'googlepay', 'applepay']),
  body('couponCode').optional().trim()
], async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: { auction: true }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (order.status !== 'PENDING_PAYMENT') return res.status(400).json({ error: 'Order already paid' });

    const { method, couponCode } = req.body;

    // Apply coupon discount (mock)
    let discount = 0;
    if (couponCode) {
      // Simple mock coupon system
      if (couponCode.toUpperCase() === 'SAVE10') discount = order.totalAmount * 0.1;
      else if (couponCode.toUpperCase() === 'SAVE5') discount = order.totalAmount * 0.05;
    }

    const finalAmount = order.totalAmount - discount;

    // Simulate payment processing
    const transactionId = `TXN-${uuidv4().substr(0, 12).toUpperCase()}`;

    const [payment, updatedOrder] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          amount: finalAmount,
          method,
          status: 'HELD',
          transactionId,
          heldUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Hold for 14 days
          orderId: order.id
        }
      }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          discountAmount: discount,
          totalAmount: finalAmount
        }
      })
    ]);

    // Notify seller
    const { createNotification } = require('../services/notificationService');
    await createNotification({
      userId: order.sellerId,
      type: 'PAYMENT_RECEIVED',
      title: 'Payment received!',
      message: `Payment of $${finalAmount.toFixed(2)} received for "${order.auction.title}". Please ship the item.`,
      data: { orderId: order.id }
    });

    res.json({
      payment,
      order: updatedOrder,
      message: 'Payment processed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get payment details
router.get('/:orderId', auth, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: { payment: true }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.id && order.sellerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(order.payment);
  } catch (error) {
    next(error);
  }
});

// Request refund
router.post('/:orderId/refund', auth, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: { payment: true }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (!order.payment || order.payment.status === 'REFUNDED') {
      return res.status(400).json({ error: 'Cannot refund' });
    }

    const [payment, updatedOrder] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: order.payment.id },
        data: { status: 'REFUNDED' }
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { status: 'REFUNDED' }
      })
    ]);

    res.json({ payment, order: updatedOrder });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
