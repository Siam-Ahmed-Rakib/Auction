/**
 * Unit Tests for Order Service
 * Comprehensive test suite covering order creation, management,
 * order status tracking, fulfillment, and order analytics
 */

const orderService = require('../src/services/orderService');
const db = require('../src/config/db');
const paymentService = require('../src/services/paymentService');
const shippingService = require('../src/services/shippingService');
const notificationService = require('../src/services/notificationService');
const auditLogger = require('../src/services/auditLogger');

// Mock dependencies
jest.mock('../src/config/db');
jest.mock('../src/services/paymentService');
jest.mock('../src/services/shippingService');
jest.mock('../src/services/notificationService');
jest.mock('../src/services/auditLogger');

describe('Order Service', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // TEST SUITE 1: Order Creation
  // ============================================================
  describe('Order Creation', () => {
    
    test('should create order after successful auction', async () => {
      const orderData = {
        auctionId: 'auction_001',
        buyerId: 'user_002',
        sellerId: 'user_001',
        finalBid: 250.00,
        shippingAddress: '123 Main St, City, State 12345'
      };

      db.query.mockResolvedValueOnce({
        id: 'order_001',
        ...orderData,
        status: 'pending',
        createdAt: new Date()
      });

      notificationService.sendNotification.mockResolvedValueOnce(true);

      const result = await orderService.createOrder(orderData);

      expect(result.id).toBe('order_001');
      expect(result.status).toBe('pending');
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });

    test('should validate required order fields', async () => {
      const orderData = {
        auctionId: 'auction_001',
        buyerId: 'user_002',
        finalBid: 250.00
      };

      await expect(
        orderService.createOrder(orderData)
      ).rejects.toThrow('Seller information is required');
    });

    test('should prevent duplicate orders for same auction', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'order_001', auctionId: 'auction_001' }
      ]);

      await expect(
        orderService.createOrder({
          auctionId: 'auction_001',
          buyerId: 'user_002',
          sellerId: 'user_001',
          finalBid: 250.00
        })
      ).rejects.toThrow('Order already exists for this auction');
    });
  });

  // ============================================================
  // TEST SUITE 2: Order Status & Tracking
  // ============================================================
  describe('Order Status & Tracking', () => {
    
    test('should retrieve order by ID', async () => {
      const mockOrder = {
        id: 'order_001',
        buyerId: 'user_002',
        sellerId: 'user_001',
        status: 'processing',
        finalBid: 250.00
      };

      db.query.mockResolvedValueOnce([mockOrder]);

      const result = await orderService.getOrderById('order_001');

      expect(result.id).toBe('order_001');
      expect(result.status).toBe('processing');
    });

    test('should retrieve orders for user', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'order_001', status: 'shipped', createdAt: new Date() },
        { id: 'order_002', status: 'delivered', createdAt: new Date() }
      ]);

      const result = await orderService.getUserOrders('user_002');

      expect(result.length).toBe(2);
    });

    test('should update order status', async () => {
      db.query.mockResolvedValueOnce({
        id: 'order_001',
        status: 'shipped',
        trackingNumber: 'TRACK123'
      });

      const result = await orderService.updateOrderStatus('order_001', 'shipped', {
        trackingNumber: 'TRACK123'
      });

      expect(result.status).toBe('shipped');
    });

    test('should get order timeline', async () => {
      db.query.mockResolvedValueOnce([
        { status: 'pending', timestamp: new Date() },
        { status: 'processing', timestamp: new Date() },
        { status: 'shipped', timestamp: new Date() }
      ]);

      const result = await orderService.getOrderTimeline('order_001');

      expect(result.length).toBe(3);
    });
  });

  // ============================================================
  // TEST SUITE 3: Order Fulfillment
  // ============================================================
  describe('Order Fulfillment', () => {
    
    test('should process payment for order', async () => {
      paymentService.processPayment.mockResolvedValueOnce({
        status: 'succeeded',
        transactionId: 'txn_001'
      });

      db.query.mockResolvedValueOnce({ id: 'order_001', status: 'paid' });

      const result = await orderService.processOrderPayment('order_001');

      expect(result.status).toBe('paid');
      expect(paymentService.processPayment).toHaveBeenCalled();
    });

    test('should generate shipping label', async () => {
      shippingService.generateLabel.mockResolvedValueOnce({
        labelId: 'label_001',
        trackingNumber: 'TRACK123'
      });

      const result = await orderService.generateShippingLabel('order_001');

      expect(result.trackingNumber).toBe('TRACK123');
    });

    test('should mark order as shipped', async () => {
      db.query.mockResolvedValueOnce({
        id: 'order_001',
        status: 'shipped',
        trackingNumber: 'TRACK123',
        shippedAt: new Date()
      });

      const result = await orderService.markOrderShipped('order_001', 'TRACK123');

      expect(result.status).toBe('shipped');
    });

    test('should mark order as delivered', async () => {
      db.query.mockResolvedValueOnce({
        id: 'order_001',
        status: 'delivered',
        deliveredAt: new Date()
      });

      const result = await orderService.markOrderDelivered('order_001');

      expect(result.status).toBe('delivered');
    });
  });

  // ============================================================
  // TEST SUITE 4: Order Cancellation & Returns
  // ============================================================
  describe('Order Cancellation & Returns', () => {
    
    test('should cancel pending order', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'order_001', status: 'pending' }
      ]);

      db.query.mockResolvedValueOnce({
        id: 'order_001',
        status: 'cancelled',
        cancelledAt: new Date()
      });

      const result = await orderService.cancelOrder('order_001', 'Changed mind');

      expect(result.status).toBe('cancelled');
    });

    test('should reject cancellation of shipped order', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'order_001', status: 'shipped' }
      ]);

      await expect(
        orderService.cancelOrder('order_001', 'Reason')
      ).rejects.toThrow('Cannot cancel shipped order');
    });

    test('should initiate return process', async () => {
      const returnData = {
        orderId: 'order_001',
        reason: 'Item defective',
        returnReason: 'Quality'
      };

      db.query.mockResolvedValueOnce({
        id: 'return_001',
        orderId: 'order_001',
        status: 'initiated'
      });

      const result = await orderService.initiateReturn(returnData);

      expect(result.status).toBe('initiated');
    });
  });
});
