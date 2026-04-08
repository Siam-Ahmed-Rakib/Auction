/**
 * Unit Tests for Auction Service
 * Comprehensive test suite covering auction creation, management,
 * scheduling, cancellation, and auction-related operations
 */

const auctionService = require('../src/services/auctionService');
const db = require('../src/config/db');
const schedulerService = require('../src/services/schedulerService');
const notificationService = require('../src/services/notificationService');
const auditLogger = require('../src/services/auditLogger');

// Mock dependencies
jest.mock('../src/config/db');
jest.mock('../src/services/schedulerService');
jest.mock('../src/services/notificationService');
jest.mock('../src/services/auditLogger');

describe('Auction Service', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // TEST SUITE 1: Auction Creation
  // ============================================================
  describe('Auction Creation', () => {
    
    test('should create auction with valid data', async () => {
      const auctionData = {
        sellerId: 'user_001',
        title: 'Vintage Watch',
        description: 'Rare vintage watch',
        startingBid: 100.00,
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        category: 'collectibles'
      };

      db.query.mockResolvedValueOnce({
        id: 'auction_001',
        ...auctionData,
        status: 'active'
      });

      schedulerService.scheduleAuctionEnd.mockResolvedValueOnce(true);

      const result = await auctionService.createAuction(auctionData);

      expect(result.id).toBe('auction_001');
      expect(result.status).toBe('active');
      expect(schedulerService.scheduleAuctionEnd).toHaveBeenCalled();
    });

    test('should reject auction with past end time', async () => {
      const auctionData = {
        sellerId: 'user_001',
        title: 'Old Item',
        startingBid: 50.00,
        endTime: new Date(Date.now() - 1000)
      };

      await expect(
        auctionService.createAuction(auctionData)
      ).rejects.toThrow('End time must be in the future');
    });

    test('should validate auction title', async () => {
      const auctionData = {
        sellerId: 'user_001',
        title: '',
        startingBid: 50.00,
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      await expect(
        auctionService.createAuction(auctionData)
      ).rejects.toThrow('Auction title is required');
    });
  });

  // ============================================================
  // TEST SUITE 2: Auction Retrieval & Status
  // ============================================================
  describe('Auction Retrieval & Status', () => {
    
    test('should retrieve auction by ID', async () => {
      const mockAuction = {
        id: 'auction_001',
        title: 'Vintage Watch',
        status: 'active',
        currentBid: 150.00,
        endTime: new Date()
      };

      db.query.mockResolvedValueOnce([mockAuction]);

      const result = await auctionService.getAuctionById('auction_001');

      expect(result.id).toBe('auction_001');
      expect(result.title).toBe('Vintage Watch');
    });

    test('should return active auctions list', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'auction_001', status: 'active', title: 'Item 1' },
        { id: 'auction_002', status: 'active', title: 'Item 2' }
      ]);

      const result = await auctionService.getActiveAuctions();

      expect(result.length).toBe(2);
      expect(result.every(a => a.status === 'active')).toBe(true);
    });

    test('should update auction status', async () => {
      db.query.mockResolvedValueOnce({ id: 'auction_001', status: 'closed' });

      const result = await auctionService.updateAuctionStatus('auction_001', 'closed');

      expect(result.status).toBe('closed');
    });
  });

  // ============================================================
  // TEST SUITE 3: Auction Cancellation
  // ============================================================
  describe('Auction Cancellation', () => {
    
    test('should cancel auction with valid reason', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'auction_001', status: 'active', bidCount: 0 }
      ]);

      db.query.mockResolvedValueOnce({ id: 'auction_001', status: 'cancelled' });

      const result = await auctionService.cancelAuction('auction_001', 'Item damaged');

      expect(result.status).toBe('cancelled');
    });

    test('should reject cancellation of auction with active bids', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'auction_001', status: 'active', bidCount: 5 }
      ]);

      await expect(
        auctionService.cancelAuction('auction_001', 'Reason')
      ).rejects.toThrow('Cannot cancel auction with active bids');
    });

    test('should reject cancellation of ended auction', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'auction_001', status: 'ended' }
      ]);

      await expect(
        auctionService.cancelAuction('auction_001', 'Reason')
      ).rejects.toThrow('Cannot cancel ended auction');
    });
  });

  // ============================================================
  // TEST SUITE 4: Auction Search & Filtering
  // ============================================================
  describe('Auction Search & Filtering', () => {
    
    test('should search auctions by title', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'auction_001', title: 'Vintage Watch', status: 'active' }
      ]);

      const result = await auctionService.searchAuctionsByTitle('Vintage');

      expect(result.length).toBe(1);
      expect(result[0].title).toContain('Vintage');
    });

    test('should filter auctions by category', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'auction_001', category: 'collectibles', status: 'active' }
      ]);

      const result = await auctionService.filterAuctionsByCategory('collectibles');

      expect(result.length).toBe(1);
      expect(result[0].category).toBe('collectibles');
    });

    test('should filter auctions by price range', async () => {
      db.query.mockResolvedValueOnce([
        { id: 'auction_001', startingBid: 150.00, status: 'active' }
      ]);

      const result = await auctionService.filterAuctionsByPriceRange(100, 200);

      expect(result.length).toBe(1);
    });
  });
});
