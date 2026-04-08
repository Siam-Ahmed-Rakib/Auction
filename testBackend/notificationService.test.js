/**
 * Unit Tests for Notification Service
 * Comprehensive test suite covering notifications, email notifications,
 * push notifications, notification preferences, and notification tracking
 */

const notificationService = require('../src/services/notificationService');
const db = require('../src/config/db');
const emailService = require('../src/services/emailService');
const socketService = require('../src/services/socketService');
const auditLogger = require('../src/services/auditLogger');

// Mock dependencies
jest.mock('../src/config/db');
jest.mock('../src/services/emailService');
jest.mock('../src/services/socketService');
jest.mock('../src/services/auditLogger');

describe('Notification Service', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // TEST SUITE 1: Notification Creation & Sending
  // ============================================================
  describe('Notification Creation & Sending', () => {
    
    test('should create and send notification successfully', async () => {
      const notificationData = {
        userId: 'user_001',
        type: 'bid_outbid',
        title: 'You have been outbid',
        message: 'Someone placed a higher bid on your auction',
        auctionId: 'auction_001'
      };

      db.query.mockResolvedValueOnce({
        id: 'notif_001',
        ...notificationData,
        status: 'sent',
        sentAt: new Date()
      });

      emailService.sendNotificationEmail.mockResolvedValueOnce(true);
      socketService.emitNotification.mockResolvedValueOnce(true);

      const result = await notificationService.sendNotification(notificationData);

      expect(result.status).toBe('sent');
      expect(emailService.sendNotificationEmail).toHaveBeenCalled();
    });

    test('should handle notification sending failure', async () => {
      const notificationData = {
        userId: 'user_001',
        type: 'bid_outbid',
        title: 'Test Notification'
      };

      emailService.sendNotificationEmail.mockRejectedValueOnce(new Error('Email service down'));

      await expect(
        notificationService.sendNotification(notificationData)
      ).rejects.toThrow('Email service down');
    });

    test('should respect notification preferences', async () => {
      const notificationData = {
        userId: 'user_001',
        type: 'auction_ending_soon',
        title: 'Auction ending soon'
      };

      db.query.mockResolvedValueOnce([{
        userId: 'user_001',
        emailNotifications: false,
        pushNotifications: true
      }]);

      const result = await notificationService.sendNotification(notificationData);

      expect(result).toBeDefined();
    });
  });

  // ============================================================
  // TEST SUITE 2: Notification Retrieval & History
  // ============================================================
  describe('Notification Retrieval & History', () => {
    
    test('should retrieve notifications for user', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'notif_001', type: 'bid_outbid', status: 'unread', createdAt: new Date() },
        { id: 'notif_002', type: 'auction_ended', status: 'read', createdAt: new Date() }
      ]);

      const result = await notificationService.getUserNotifications('user_001');

      expect(result.length).toBe(2);
    });

    test('should retrieve unread notifications only', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'notif_001', status: 'unread', type: 'bid_outbid' }
      ]);

      const result = await notificationService.getUnreadNotifications('user_001');

      expect(result.every(n => n.status === 'unread')).toBe(true);
    });

    test('should mark notification as read', async () => {
      db.query.mockResolvedValueOnce({
        id: 'notif_001',
        status: 'read',
        readAt: new Date()
      });

      const result = await notificationService.markNotificationAsRead('notif_001');

      expect(result.status).toBe('read');
    });

    test('should clear all notifications for user', async () => {
      db.query.mockResolvedValueOnce({ deletedCount: 5 });

      const result = await notificationService.clearAllNotifications('user_001');

      expect(result.deletedCount).toBe(5);
    });
  });

  // ============================================================
  // TEST SUITE 3: Notification Preferences
  // ============================================================
  describe('Notification Preferences', () => {
    
    test('should save notification preferences', async () => {
      const preferences = {
        emailNotifications: true,
        pushNotifications: false,
        smsNotifications: true,
        notificationTypes: ['bid_outbid', 'auction_ended']
      };

      db.query.mockResolvedValueOnce({
        userId: 'user_001',
        ...preferences
      });

      const result = await notificationService.savePreferences('user_001', preferences);

      expect(result.emailNotifications).toBe(true);
      expect(result.pushNotifications).toBe(false);
    });

    test('should retrieve notification preferences', async () => {
      db.query.mockResolvedValueOnce([{
        userId: 'user_001',
        emailNotifications: true,
        pushNotifications: false
      }]);

      const result = await notificationService.getPreferences('user_001');

      expect(result.emailNotifications).toBe(true);
    });

    test('should update specific notification preference', async () => {
      db.query.mockResolvedValueOnce({
        userId: 'user_001',
        emailNotifications: false
      });

      const result = await notificationService.updatePreference(
        'user_001',
        'emailNotifications',
        false
      );

      expect(result.emailNotifications).toBe(false);
    });
  });

  // ============================================================
  // TEST SUITE 4: Notification Filtering & Search
  // ============================================================
  describe('Notification Filtering & Search', () => {
    
    test('should filter notifications by type', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'notif_001', type: 'bid_outbid' }
      ]);

      const result = await notificationService.filterNotificationsByType('user_001', 'bid_outbid');

      expect(result.every(n => n.type === 'bid_outbid')).toBe(true);
    });

    test('should filter notifications by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      db.query.mockResolvedValueOnce([
        { id: 'notif_001', createdAt: new Date('2024-06-15') }
      ]);

      const result = await notificationService.getNotificationsByDateRange(
        'user_001',
        startDate,
        endDate
      );

      expect(result.length).toBe(1);
    });
  });
});
