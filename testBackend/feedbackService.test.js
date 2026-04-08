/**
 * Unit Tests for Feedback Service
 * Comprehensive test suite covering feedback submission, ratings,
 * feedback moderation, and feedback analytics
 */

const feedbackService = require('../src/services/feedbackService');
const db = require('../src/config/db');
const notificationService = require('../src/services/notificationService');
const moderationService = require('../src/services/moderationService');
const auditLogger = require('../src/services/auditLogger');

// Mock dependencies
jest.mock('../src/config/db');
jest.mock('../src/services/notificationService');
jest.mock('../src/services/moderationService');
jest.mock('../src/services/auditLogger');

describe('Feedback Service', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // TEST SUITE 1: Feedback Submission
  // ============================================================
  describe('Feedback Submission', () => {
    
    test('should submit feedback with valid data', async () => {
      const feedbackData = {
        transactionId: 'txn_001',
        reviewerId: 'user_002',
        ratedUserId: 'user_001',
        rating: 5,
        comment: 'Excellent seller, fast shipping',
        categories: ['communication', 'item_quality', 'shipping']
      };

      db.query.mockResolvedValueOnce({
        id: 'feedback_001',
        ...feedbackData,
        status: 'pending',
        createdAt: new Date()
      });

      const result = await feedbackService.submitFeedback(feedbackData);

      expect(result.id).toBe('feedback_001');
      expect(result.rating).toBe(5);
    });

    test('should validate rating between 1 and 5', async () => {
      const feedbackData = {
        transactionId: 'txn_001',
        reviewerId: 'user_002',
        ratedUserId: 'user_001',
        rating: 6,
        comment: 'Test'
      };

      await expect(
        feedbackService.submitFeedback(feedbackData)
      ).rejects.toThrow('Rating must be between 1 and 5');
    });

    test('should prevent duplicate feedback for same transaction', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'feedback_001', transactionId: 'txn_001' }
      ]);

      await expect(
        feedbackService.submitFeedback({
          transactionId: 'txn_001',
          reviewerId: 'user_002',
          rating: 5
        })
      ).rejects.toThrow('Feedback already exists for this transaction');
    });

    test('should require minimum comment length', async () => {
      const feedbackData = {
        transactionId: 'txn_001',
        reviewerId: 'user_002',
        ratedUserId: 'user_001',
        rating: 5,
        comment: 'OK'
      };

      await expect(
        feedbackService.submitFeedback(feedbackData)
      ).rejects.toThrow('Comment must be at least 10 characters');
    });
  });

  // ============================================================
  // TEST SUITE 2: Feedback Retrieval & Analytics
  // ============================================================
  describe('Feedback Retrieval & Analytics', () => {
    
    test('should retrieve feedback for a user', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'feedback_001', ratedUserId: 'user_001', rating: 5, status: 'approved' },
        { id: 'feedback_002', ratedUserId: 'user_001', rating: 4, status: 'approved' }
      ]);

      const result = await feedbackService.getUserFeedback('user_001');

      expect(result.length).toBe(2);
    });

    test('should calculate average rating for user', async () => {
      db.query.mockResolvedValueOnce([
        { rating: 5 },
        { rating: 4 },
        { rating: 5 }
      ]);

      const result = await feedbackService.getAverageRating('user_001');

      expect(result).toBe(4.67);
    });

    test('should get rating breakdown', async () => {
      db.query.mockResolvedValueOnce({
        '5': 45,
        '4': 30,
        '3': 15,
        '2': 8,
        '1': 2
      });

      const result = await feedbackService.getRatingBreakdown('user_001');

      expect(result['5']).toBe(45);
      expect(result['1']).toBe(2);
    });

    test('should list feedback for specific transaction', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'feedback_001', transactionId: 'txn_001', rating: 5 }
      ]);

      const result = await feedbackService.getTransactionFeedback('txn_001');

      expect(result.length).toBe(1);
      expect(result[0].transactionId).toBe('txn_001');
    });
  });

  // ============================================================
  // TEST SUITE 3: Feedback Moderation
  // ============================================================
  describe('Feedback Moderation', () => {
    
    test('should approve feedback', async () => {
      db.query.mockResolvedValueOnce({
        id: 'feedback_001',
        status: 'approved',
        approvedAt: new Date()
      });

      const result = await feedbackService.approveFeedback('feedback_001');

      expect(result.status).toBe('approved');
    });

    test('should reject inappropriate feedback', async () => {
      const rejectionData = {
        feedbackId: 'feedback_001',
        reason: 'Contains profanity'
      };

      db.query.mockResolvedValueOnce({
        id: 'feedback_001',
        status: 'rejected',
        rejectionReason: rejectionData.reason
      });

      const result = await feedbackService.rejectFeedback(
        rejectionData.feedbackId,
        rejectionData.reason
      );

      expect(result.status).toBe('rejected');
    });

    test('should flag feedback for review', async () => {
      moderationService.reviewContent.mockResolvedValueOnce({
        flagged: true,
        reason: 'Potential spam'
      });

      const result = await feedbackService.flagFeedback('feedback_001');

      expect(result.flagged).toBe(true);
    });
  });

  // ============================================================
  // TEST SUITE 4: Seller Response to Feedback
  // ============================================================
  describe('Seller Response to Feedback', () => {
    
    test('should allow seller to respond to feedback', async () => {
      const responseData = {
        feedbackId: 'feedback_001',
        sellerId: 'user_001',
        response: 'Thank you for your feedback!'
      };

      db.query.mockResolvedValueOnce({
        id: 'feedback_001',
        sellerResponse: responseData.response,
        respondedAt: new Date()
      });

      const result = await feedbackService.respondToFeedback(responseData);

      expect(result.sellerResponse).toBe(responseData.response);
    });

    test('should validate seller is the correct user', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'feedback_001', ratedUserId: 'user_001' }
      ]);

      await expect(
        feedbackService.respondToFeedback({
          feedbackId: 'feedback_001',
          sellerId: 'user_002',
          response: 'Response'
        })
      ).rejects.toThrow('Only the rated user can respond to this feedback');
    });
  });
});
