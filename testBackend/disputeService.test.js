/**
 * Unit Tests for Dispute Service
 * Comprehensive test suite covering dispute creation, management,
 * resolution, evidence handling, and dispute analytics
 */

const disputeService = require('../src/services/disputeService');
const db = require('../src/config/db');
const mediationService = require('../src/services/mediationService');
const notificationService = require('../src/services/notificationService');
const paymentService = require('../src/services/paymentService');
const auditLogger = require('../src/services/auditLogger');

// Mock dependencies
jest.mock('../src/config/db');
jest.mock('../src/services/mediationService');
jest.mock('../src/services/notificationService');
jest.mock('../src/services/paymentService');
jest.mock('../src/services/auditLogger');

describe('Dispute Service', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // TEST SUITE 1: Dispute Creation & Filing
  // ============================================================
  describe('Dispute Creation & Filing', () => {
    
    test('should create dispute with valid data', async () => {
      const disputeData = {
        orderId: 'order_001',
        filedBy: 'user_002',
        category: 'item_not_received',
        description: 'Item was not received after 30 days',
        evidence: ['photo1.jpg', 'tracking_screenshot.jpg']
      };

      db.query.mockResolvedValueOnce({
        id: 'dispute_001',
        ...disputeData,
        status: 'open',
        createdAt: new Date()
      });

      notificationService.sendNotification.mockResolvedValueOnce(true);

      const result = await disputeService.createDispute(disputeData);

      expect(result.id).toBe('dispute_001');
      expect(result.status).toBe('open');
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });

    test('should validate dispute category', async () => {
      const disputeData = {
        orderId: 'order_001',
        filedBy: 'user_002',
        category: 'invalid_category',
        description: 'Test'
      };

      await expect(
        disputeService.createDispute(disputeData)
      ).rejects.toThrow('Invalid dispute category');
    });

    test('should require dispute description', async () => {
      const disputeData = {
        orderId: 'order_001',
        filedBy: 'user_002',
        category: 'item_not_received',
        description: ''
      };

      await expect(
        disputeService.createDispute(disputeData)
      ).rejects.toThrow('Dispute description is required');
    });

    test('should prevent duplicate disputes for same order', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'dispute_001', orderId: 'order_001', status: 'open' }
      ]);

      await expect(
        disputeService.createDispute({
          orderId: 'order_001',
          filedBy: 'user_002',
          category: 'item_not_received',
          description: 'Test'
        })
      ).rejects.toThrow('An open dispute already exists for this order');
    });
  });

  // ============================================================
  // TEST SUITE 2: Dispute Retrieval & Status
  // ============================================================
  describe('Dispute Retrieval & Status', () => {
    
    test('should retrieve dispute by ID', async () => {
      const mockDispute = {
        id: 'dispute_001',
        orderId: 'order_001',
        filedBy: 'user_002',
        status: 'open',
        category: 'item_not_received'
      };

      db.query.mockResolvedValueOnce([mockDispute]);

      const result = await disputeService.getDisputeById('dispute_001');

      expect(result.id).toBe('dispute_001');
      expect(result.status).toBe('open');
    });

    test('should retrieve disputes for user', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'dispute_001', status: 'open', category: 'item_not_received' },
        { id: 'dispute_002', status: 'resolved', category: 'wrong_item' }
      ]);

      const result = await disputeService.getUserDisputes('user_002');

      expect(result.length).toBe(2);
    });

    test('should get open disputes count', async () => {
      db.query.mockResolvedValueOnce([{ count: 5 }]);

      const result = await disputeService.getOpenDisputesCount();

      expect(result).toBe(5);
    });

    test('should update dispute status', async () => {
      db.query.mockResolvedValueOnce({
        id: 'dispute_001',
        status: 'in_progress'
      });

      const result = await disputeService.updateDisputeStatus('dispute_001', 'in_progress');

      expect(result.status).toBe('in_progress');
    });
  });

  // ============================================================
  // TEST SUITE 3: Evidence Management
  // ============================================================
  describe('Evidence Management', () => {
    
    test('should add evidence to dispute', async () => {
      const evidenceData = {
        disputeId: 'dispute_001',
        type: 'photo',
        fileName: 'evidence.jpg',
        fileSize: 2048
      };

      db.query.mockResolvedValueOnce({
        id: 'evidence_001',
        ...evidenceData,
        uploadedAt: new Date()
      });

      const result = await disputeService.addEvidence(evidenceData);

      expect(result.fileName).toBe('evidence.jpg');
    });

    test('should retrieve dispute evidence', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'evidence_001', type: 'photo', fileName: 'photo1.jpg' },
        { id: 'evidence_002', type: 'document', fileName: 'receipt.pdf' }
      ]);

      const result = await disputeService.getDisputeEvidence('dispute_001');

      expect(result.length).toBe(2);
    });

    test('should remove evidence from dispute', async () => {
      db.query.mockResolvedValueOnce({ id: 'evidence_001', deleted: true });

      const result = await disputeService.removeEvidence('evidence_001');

      expect(result.deleted).toBe(true);
    });

    test('should validate evidence file size', async () => {
      const evidenceData = {
        disputeId: 'dispute_001',
        type: 'photo',
        fileName: 'large_file.jpg',
        fileSize: 100 * 1024 * 1024
      };

      await expect(
        disputeService.addEvidence(evidenceData)
      ).rejects.toThrow('File size exceeds maximum limit');
    });
  });

  // ============================================================
  // TEST SUITE 4: Dispute Resolution
  // ============================================================
  describe('Dispute Resolution', () => {
    
    test('should resolve dispute with buyer win', async () => {
      const resolutionData = {
        disputeId: 'dispute_001',
        resolution: 'buyer_win',
        refundAmount: 250.00,
        notes: 'Item was not received'
      };

      paymentService.processRefund.mockResolvedValueOnce({
        status: 'succeeded',
        refundId: 'refund_001'
      });

      db.query.mockResolvedValueOnce({
        id: 'dispute_001',
        status: 'resolved',
        resolution: 'buyer_win'
      });

      const result = await disputeService.resolveDispute(resolutionData);

      expect(result.resolution).toBe('buyer_win');
      expect(paymentService.processRefund).toHaveBeenCalled();
    });

    test('should resolve dispute with seller win', async () => {
      const resolutionData = {
        disputeId: 'dispute_001',
        resolution: 'seller_win',
        notes: 'Buyer allegations unsubstantiated'
      };

      db.query.mockResolvedValueOnce({
        id: 'dispute_001',
        status: 'resolved',
        resolution: 'seller_win'
      });

      const result = await disputeService.resolveDispute(resolutionData);

      expect(result.resolution).toBe('seller_win');
    });

    test('should resolve dispute with mutual agreement', async () => {
      const resolutionData = {
        disputeId: 'dispute_001',
        resolution: 'mutual_agreement',
        refundAmount: 100.00,
        notes: 'Both parties agreed'
      };

      db.query.mockResolvedValueOnce({
        id: 'dispute_001',
        status: 'resolved',
        resolution: 'mutual_agreement'
      });

      const result = await disputeService.resolveDispute(resolutionData);

      expect(result.resolution).toBe('mutual_agreement');
    });

    test('should handle eskalation to mediation', async () => {
      mediationService.requestMediation.mockResolvedValueOnce({
        mediationId: 'med_001',
        status: 'requested'
      });

      db.query.mockResolvedValueOnce({
        id: 'dispute_001',
        status: 'escalated_to_mediation'
      });

      const result = await disputeService.escalateToMediation('dispute_001');

      expect(result.status).toBe('escalated_to_mediation');
      expect(mediationService.requestMediation).toHaveBeenCalled();
    });
  });

  // ============================================================
  // TEST SUITE 5: Dispute Analytics
  // ============================================================
  describe('Dispute Analytics', () => {
    
    test('should get dispute statistics', async () => {
      db.query.mockResolvedValueOnce({
        totalDisputes: 50,
        resolvedDisputes: 35,
        openDisputes: 12,
        averageResolutionTime: 5
      });

      const result = await disputeService.getDisputeStatistics();

      expect(result.totalDisputes).toBe(50);
      expect(result.resolvedDisputes).toBe(35);
    });

    test('should get dispute breakdown by category', async () => {
      db.query.mockResolvedValueOnce({
        'item_not_received': 20,
        'wrong_item': 15,
        'item_damaged': 10,
        'not_as_described': 5
      });

      const result = await disputeService.getDisputesByCategory();

      expect(result['item_not_received']).toBe(20);
    });

    test('should get dispute trends', async () => {
      db.query.mockResolvedValueOnce([
        { month: '2024-01', count: 10 },
        { month: '2024-02', count: 12 },
        { month: '2024-03', count: 8 }
      ]);

      const result = await disputeService.getDisputeTrends(3);

      expect(result.length).toBe(3);
    });
  });
});
