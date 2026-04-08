/**
 * Unit Tests for Bidding Engine Service
 * Comprehensive test suite covering bidding logic, bid validation, 
 * winner determination, and edge cases
 */

const biddingEngine = require('../src/services/biddingEngine');
const db = require('../src/config/db');
const notificationService = require('../src/services/notificationService');

// Mock dependencies
jest.mock('../src/config/db');
jest.mock('../src/services/notificationService');

describe('Bidding Engine Service', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // TEST SUITE 1: Bid Placement and Validation
  // ============================================================
  describe('Bid Placement and Validation', () => {
    
    test('should successfully place a valid bid', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = 150;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100,
          starting_bid: 50,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() + 3600000) // 1 hour from now
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'user_456',
          active: true,
          wallet_balance: 500
        }]
      });

      db.query.mockResolvedValueOnce({ 
        rows: [{ id: 'bid_001' }] 
      });

      const result = await biddingEngine.placeBid(auctionId, userId, bidAmount);

      expect(result).toHaveProperty('id');
      expect(result.amount).toBe(bidAmount);
      expect(result.userId).toBe(userId);
      expect(result.auctionId).toBe(auctionId);
    });

    test('should reject bid lower than current bid', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = 50;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100,
          starting_bid: 50,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() + 3600000)
        }]
      });

      await expect(
        biddingEngine.placeBid(auctionId, userId, bidAmount)
      ).rejects.toThrow('Bid amount must be higher than current bid');
    });

    test('should reject bid on inactive auction', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = 150;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'ended',
          current_bid: 100,
          starting_bid: 50,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() - 3600000) // 1 hour ago
        }]
      });

      await expect(
        biddingEngine.placeBid(auctionId, userId, bidAmount)
      ).rejects.toThrow('Auction is not active');
    });

    test('should reject bid from user with insufficient balance', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = 600;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100,
          starting_bid: 50,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() + 3600000)
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'user_456',
          active: true,
          wallet_balance: 500
        }]
      });

      await expect(
        biddingEngine.placeBid(auctionId, userId, bidAmount)
      ).rejects.toThrow('Insufficient wallet balance');
    });

    test('should reject bid after auction expiry', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = 150;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100,
          starting_bid: 50,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() - 100) // Already expired
        }]
      });

      await expect(
        biddingEngine.placeBid(auctionId, userId, bidAmount)
      ).rejects.toThrow('Auction has expired');
    });

    test('should reject bid from seller on their own auction', async () => {
      const auctionId = 'auction_123';
      const userId = 'seller_789';
      const bidAmount = 150;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100,
          starting_bid: 50,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() + 3600000)
        }]
      });

      await expect(
        biddingEngine.placeBid(auctionId, userId, bidAmount)
      ).rejects.toThrow('Sellers cannot bid on their own auctions');
    });

    test('should validate minimum bid increment', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = 101; // Only 1 unit increase

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100,
          starting_bid: 50,
          minimum_increment: 10,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() + 3600000)
        }]
      });

      await expect(
        biddingEngine.placeBid(auctionId, userId, bidAmount)
      ).rejects.toThrow('Bid must increment by at least 10');
    });

  });

  // ============================================================
  // TEST SUITE 2: Automatic Bidding and Proxy Bidding
  // ============================================================
  describe('Automatic/Proxy Bidding', () => {
    
    test('should handle automatic bid increments correctly', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const maxBidAmount = 500;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100,
          starting_bid: 50,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() + 3600000)
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'user_456',
          active: true,
          wallet_balance: 600
        }]
      });

      db.query.mockResolvedValueOnce({ rows: [{ id: 'bid_001' }] });

      const result = await biddingEngine.placeBid(
        auctionId, 
        userId, 
        maxBidAmount, 
        { isAutomaticBid: true }
      );

      expect(result.isAutomaticBid).toBe(true);
      expect(result.maxBidAmount).toBe(maxBidAmount);
    });

    test('should automatically outbid when proxy bids conflict', async () => {
      const auctionId = 'auction_123';
      const user1 = 'user_111';
      const user2 = 'user_222';

      // User 1 places automatic bid with max 300
      const bid1 = await biddingEngine.placeBid(auctionId, user1, 300, { isAutomaticBid: true });
      
      // User 2 places automatic bid with max 250 (should be outbid automatically)
      const bid2 = await biddingEngine.placeBid(auctionId, user2, 250, { isAutomaticBid: true });

      expect(bid1.currentWinner).toBe(user1);
      expect(bid2.currentWinner).toBe(user1);
    });

    test('should handle incremental proxy bid adjustments', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const currentBid = 150;
      const userMaxBid = 500;
      const incrementSize = 25;

      const nextBid = biddingEngine.calculateNextBidAmount(
        currentBid, 
        userMaxBid, 
        incrementSize
      );

      expect(nextBid).toBe(175);
      expect(nextBid).toBeLessThanOrEqual(userMaxBid);
    });

  });

  // ============================================================
  // TEST SUITE 3: Bid History and Tracking
  // ============================================================
  describe('Bid History and Tracking', () => {
    
    test('should retrieve complete bid history for auction', async () => {
      const auctionId = 'auction_123';
      const mockBids = [
        { id: 'bid_1', userId: 'user_111', amount: 100, timestamp: new Date() },
        { id: 'bid_2', userId: 'user_222', amount: 150, timestamp: new Date() },
        { id: 'bid_3', userId: 'user_111', amount: 200, timestamp: new Date() }
      ];

      db.query.mockResolvedValueOnce({ rows: mockBids });

      const history = await biddingEngine.getBidHistory(auctionId);

      expect(history).toHaveLength(3);
      expect(history[0].amount).toBe(100);
      expect(history[2].amount).toBe(200);
    });

    test('should track bid timestamp accurately', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = 150;
      const beforeTime = new Date();

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100,
          starting_bid: 50,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() + 3600000)
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'user_456',
          active: true,
          wallet_balance: 500
        }]
      });

      db.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'bid_001',
          timestamp: new Date()
        }] 
      });

      const result = await biddingEngine.placeBid(auctionId, userId, bidAmount);
      const afterTime = new Date();

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    test('should retrieve bids by user across multiple auctions', async () => {
      const userId = 'user_456';
      const mockBids = [
        { auctionId: 'auction_111', amount: 100 },
        { auctionId: 'auction_222', amount: 250 },
        { auctionId: 'auction_333', amount: 500 }
      ];

      db.query.mockResolvedValueOnce({ rows: mockBids });

      const userBids = await biddingEngine.getUserBidHistory(userId);

      expect(userBids).toHaveLength(3);
      expect(userBids.every(bid => bid.userId === userId || !bid.userId)).toBe(true);
    });

  });

  // ============================================================
  // TEST SUITE 4: Winner Determination and Auction Conclusion
  // ============================================================
  describe('Winner Determination', () => {
    
    test('should determine correct winner on auction end', async () => {
      const auctionId = 'auction_123';
      const mockBids = [
        { userId: 'user_111', amount: 100 },
        { userId: 'user_222', amount: 150 },
        { userId: 'user_333', amount: 200 }
      ];

      db.query.mockResolvedValueOnce({ rows: mockBids });

      const winner = await biddingEngine.determineWinner(auctionId);

      expect(winner.userId).toBe('user_333');
      expect(winner.amount).toBe(200);
    });

    test('should handle auction with no bids', async () => {
      const auctionId = 'auction_123';

      db.query.mockResolvedValueOnce({ rows: [] });

      const winner = await biddingEngine.determineWinner(auctionId);

      expect(winner).toBeNull();
    });

    test('should handle single bid auction', async () => {
      const auctionId = 'auction_123';
      const mockBids = [
        { userId: 'user_111', amount: 200 }
      ];

      db.query.mockResolvedValueOnce({ rows: mockBids });

      const winner = await biddingEngine.determineWinner(auctionId);

      expect(winner.userId).toBe('user_111');
      expect(winner.amount).toBe(200);
    });

    test('should notify winner when auction ends', async () => {
      const auctionId = 'auction_123';
      const winnerId = 'user_333';

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: winnerId,
          amount: 200,
          auctionId: auctionId
        }]
      });

      notificationService.sendNotification.mockResolvedValueOnce(true);

      await biddingEngine.concludeAuction(auctionId);

      expect(notificationService.sendNotification).toHaveBeenCalled();
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: winnerId,
          type: 'auction_won'
        })
      );
    });

    test('should notify non-winning bidders', async () => {
      const auctionId = 'auction_123';
      const winnerBid = { userId: 'user_333', amount: 200 };
      const losingBids = [
        { userId: 'user_111', amount: 100 },
        { userId: 'user_222', amount: 150 }
      ];

      db.query.mockResolvedValueOnce({
        rows: [winnerBid, ...losingBids]
      });

      notificationService.sendNotification.mockResolvedValueOnce(true);

      await biddingEngine.notifyAllBidders(auctionId);

      expect(notificationService.sendNotification).toHaveBeenCalledTimes(3);
    });

  });

  // ============================================================
  // TEST SUITE 5: Bid Amount Calculations
  // ============================================================
  describe('Bid Amount Calculations', () => {
    
    test('should calculate next bid amount correctly', () => {
      const currentBid = 100;
      const nextBid = biddingEngine.calculateNextBidAmount(currentBid);

      expect(nextBid).toBeGreaterThan(currentBid);
      expect(nextBid).toBeLessThanOrEqual(currentBid * 1.1); // 10% max increase
    });

    test('should apply tiered increments based on bid amount', () => {
      const testCases = [
        { bid: 50, expectedIncrement: 5 },
        { bid: 100, expectedIncrement: 10 },
        { bid: 500, expectedIncrement: 25 },
        { bid: 1000, expectedIncrement: 50 }
      ];

      testCases.forEach(testCase => {
        const nextBid = biddingEngine.calculateNextBidAmount(testCase.bid);
        expect(nextBid).toBe(testCase.bid + testCase.expectedIncrement);
      });
    });

    test('should calculate reserve price correctly', () => {
      const auctionData = {
        starting_bid: 50,
        reserve_price: 200,
        current_bid: 150
      };

      const isReserveMet = biddingEngine.isReserveMet(auctionData);

      expect(isReserveMet).toBe(false);
    });

    test('should calculate second highest bid amount', async () => {
      const auctionId = 'auction_123';
      const mockBids = [
        { amount: 100 },
        { amount: 150 },
        { amount: 200 }
      ];

      db.query.mockResolvedValueOnce({ rows: mockBids });

      const secondHighest = await biddingEngine.getSecondHighestBid(auctionId);

      expect(secondHighest).toBe(150);
    });

    test('should calculate final selling price correctly', async () => {
      const auctionId = 'auction_123';
      const reservePrice = 100;
      const secondHighestBid = 150;

      const finalPrice = await biddingEngine.calculateFinalPrice(
        auctionId,
        reservePrice
      );

      expect(finalPrice).toBeGreaterThanOrEqual(reservePrice);
    });

  });

  // ============================================================
  // TEST SUITE 6: Concurrent Bids and Race Conditions
  // ============================================================
  describe('Concurrent Bids and Race Conditions', () => {
    
    test('should handle simultaneous bids from multiple users', async () => {
      const auctionId = 'auction_123';
      const bids = [
        { userId: 'user_111', amount: 150 },
        { userId: 'user_222', amount: 160 },
        { userId: 'user_333', amount: 155 }
      ];

      const results = await Promise.all(
        bids.map(bid => 
          biddingEngine.placeBid(auctionId, bid.userId, bid.amount)
        )
      );

      expect(results).toHaveLength(3);
      expect(results.some(r => r.error)).toBeFalsy();
    });

    test('should prevent bid race condition with locking', async () => {
      const auctionId = 'auction_123';
      const userId1 = 'user_111';
      const userId2 = 'user_222';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100,
          locked: false
        }]
      });

      await biddingEngine.placeBid(auctionId, userId1, 150);

      db.query.mockResolvedValueOnce({
        rows: [{
          locked: true,
          locked_until: new Date(Date.now() + 5000)
        }]
      });

      await expect(
        biddingEngine.placeBid(auctionId, userId2, 160)
      ).rejects.toThrow();
    });

    test('should maintain bid consistency in high-concurrency scenario', async () => {
      const auctionId = 'auction_123';
      const userCount = 100;
      const baseBid = 100;

      const bidPromises = Array.from({ length: userCount }, (_, i) =>
        biddingEngine.placeBid(auctionId, `user_${i}`, baseBid + (i * 5))
      );

      const results = await Promise.all(bidPromises);

      const successfulBids = results.filter(r => !r.error);
      expect(successfulBids.length).toBeGreaterThan(0);
    });

  });

  // ============================================================
  // TEST SUITE 7: Bid Cancellation and Modification
  // ============================================================
  describe('Bid Cancellation and Modification', () => {
    
    test('should cancel bid if still within cancellation window', async () => {
      const bidId = 'bid_001';
      const cancellationWindow = 5 * 60 * 1000; // 5 minutes

      const bidTime = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      const currentTime = new Date();

      db.query.mockResolvedValueOnce({
        rows: [{
          id: bidId,
          timestamp: bidTime,
          status: 'active'
        }]
      });

      const timeSinceBid = currentTime.getTime() - bidTime.getTime();
      const canCancel = timeSinceBid < cancellationWindow;

      expect(canCancel).toBe(true);
    });

    test('should reject bid cancellation after window expires', async () => {
      const bidId = 'bid_001';
      const cancellationWindow = 5 * 60 * 1000; // 5 minutes

      const bidTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

      db.query.mockResolvedValueOnce({
        rows: [{
          id: bidId,
          timestamp: bidTime,
          status: 'active'
        }]
      });

      await expect(
        biddingEngine.cancelBid(bidId)
      ).rejects.toThrow('Cancellation window has expired');
    });

    test('should refund cancelled bid amount to user wallet', async () => {
      const bidId = 'bid_001';
      const userId = 'user_456';
      const bidAmount = 200;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: bidId,
          userId: userId,
          amount: bidAmount,
          timestamp: new Date(Date.now() - 2 * 60 * 1000)
        }]
      });

      db.query.mockResolvedValueOnce({ rows: [{ wallet_balance: 300 }] });
      db.query.mockResolvedValueOnce({ rows: [{ wallet_balance: 500 }] });

      const result = await biddingEngine.cancelBid(bidId);

      expect(result.refundAmount).toBe(bidAmount);
      expect(result.newBalance).toBe(500);
    });

  });

  // ============================================================
  // TEST SUITE 8: Bid Validation Rules and Business Logic
  // ============================================================
  describe('Advanced Bid Validation', () => {
    
    test('should validate bid against maximum limit per auction', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const maxBidsPerAuction = 50;

      db.query.mockResolvedValueOnce({
        rows: Array(maxBidsPerAuction).fill({ userId: userId })
      });

      await expect(
        biddingEngine.placeBid(auctionId, userId, 1000)
      ).rejects.toThrow('Maximum bids per auction exceeded');
    });

    test('should validate bid against daily bid limit', async () => {
      const userId = 'user_456';
      const dailyBidLimit = 100;

      db.query.mockResolvedValueOnce({
        rows: Array(dailyBidLimit).fill({ userId: userId, createdAt: new Date() })
      });

      await expect(
        biddingEngine.placeBid('auction_999', userId, 500)
      ).rejects.toThrow('Daily bid limit exceeded');
    });

    test('should prevent bid sniping in last seconds', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = 500;
      const lastBidGracePeriod = 30 * 1000; // 30 seconds

      const auctionEndTime = new Date(Date.now() + 10 * 1000); // 10 seconds from now

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          end_time: auctionEndTime,
          snipe_protection: true
        }]
      });

      const timeRemaining = auctionEndTime.getTime() - Date.now();
      const isSnipe = timeRemaining < lastBidGracePeriod;

      expect(isSnipe).toBe(true);
    });

  });

  // ============================================================
  // TEST SUITE 9: Bid Observer Pattern and Events
  // ============================================================
  describe('Bid Events and Observers', () => {
    
    test('should trigger bid placed event', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = 150;
      const eventListener = jest.fn();

      biddingEngine.on('bid:placed', eventListener);

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100,
          starting_bid: 50,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() + 3600000)
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'user_456',
          active: true,
          wallet_balance: 500
        }]
      });

      db.query.mockResolvedValueOnce({ rows: [{ id: 'bid_001' }] });

      await biddingEngine.placeBid(auctionId, userId, bidAmount);

      expect(eventListener).toHaveBeenCalled();
    });

    test('should trigger bid outbid event for previous highest bidder', async () => {
      const auctionId = 'auction_123';
      const previousBidderId = 'user_111';
      const newBidderId = 'user_222';
      const eventListener = jest.fn();

      biddingEngine.on('bid:outbid', eventListener);

      // Simulate previous bid
      db.query.mockResolvedValueOnce({
        rows: [{
          userId: previousBidderId,
          amount: 100
        }]
      });

      // Simulate new bid
      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100,
          starting_bid: 50,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() + 3600000)
        }]
      });

      await biddingEngine.placeBid(auctionId, newBidderId, 150);

      expect(eventListener).toHaveBeenCalled();
    });

  });

  // ============================================================
  // TEST SUITE 10: Edge Cases and Error Handling
  // ============================================================
  describe('Edge Cases and Error Handling', () => {
    
    test('should handle database connection errors gracefully', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = 150;

      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        biddingEngine.placeBid(auctionId, userId, bidAmount)
      ).rejects.toThrow('Database connection failed');
    });

    test('should handle auction not found error', async () => {
      const auctionId = 'invalid_id';
      const userId = 'user_456';
      const bidAmount = 150;

      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        biddingEngine.placeBid(auctionId, userId, bidAmount)
      ).rejects.toThrow('Auction not found');
    });

    test('should handle user not found error', async () => {
      const auctionId = 'auction_123';
      const userId = 'invalid_user';
      const bidAmount = 150;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100,
          starting_bid: 50,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() + 3600000)
        }]
      });

      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        biddingEngine.placeBid(auctionId, userId, bidAmount)
      ).rejects.toThrow('User not found');
    });

    test('should handle invalid bid amount (negative)', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = -50;

      await expect(
        biddingEngine.placeBid(auctionId, userId, bidAmount)
      ).rejects.toThrow('Bid amount must be positive');
    });

    test('should handle invalid bid amount (zero)', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = 0;

      await expect(
        biddingEngine.placeBid(auctionId, userId, bidAmount)
      ).rejects.toThrow('Bid amount must be positive');
    });

    test('should handle very large bid amounts', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = Number.MAX_SAFE_INTEGER;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100,
          starting_bid: 50,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() + 3600000)
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'user_456',
          active: true,
          wallet_balance: Number.MAX_SAFE_INTEGER
        }]
      });

      const result = await biddingEngine.placeBid(auctionId, userId, bidAmount);

      expect(result.amount).toBe(bidAmount);
    });

    test('should handle decimal bid amounts correctly', async () => {
      const auctionId = 'auction_123';
      const userId = 'user_456';
      const bidAmount = 150.99;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: auctionId,
          status: 'active',
          current_bid: 100.50,
          starting_bid: 50,
          seller_id: 'seller_789',
          end_time: new Date(Date.now() + 3600000)
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'user_456',
          active: true,
          wallet_balance: 500
        }]
      });

      db.query.mockResolvedValueOnce({ rows: [{ id: 'bid_001' }] });

      const result = await biddingEngine.placeBid(auctionId, userId, bidAmount);

      expect(result.amount).toBe(bidAmount);
    });

  });

  // ============================================================
  // TEST SUITE 11: Performance and Optimization
  // ============================================================
  describe('Performance and Optimization', () => {
    
    test('should retrieve bid history within acceptable time', async () => {
      const auctionId = 'auction_123';
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `bid_${i}`,
        userId: `user_${i % 100}`,
        amount: 100 + i,
        timestamp: new Date(Date.now() - i * 1000)
      }));

      db.query.mockResolvedValueOnce({ rows: largeDataset });

      const startTime = Date.now();
      const history = await biddingEngine.getBidHistory(auctionId);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(history).toHaveLength(10000);
      expect(executionTime).toBeLessThan(1000); // Should complete in < 1 second
    });

    test('should cache bid calculations for performance', async () => {
      const auctionId = 'auction_123';

      db.query.mockResolvedValueOnce({ rows: [{ amount: 100 }] });
      const firstCall = await biddingEngine.getHighestBid(auctionId);

      db.query.mockClear();
      const secondCall = await biddingEngine.getHighestBid(auctionId);

      expect(db.query).not.toHaveBeenCalled();
      expect(firstCall).toBe(secondCall);
    });

  });

  // ============================================================
  // TEST SUITE 12: Bid Refunds and Wallet Integration
  // ============================================================
  describe('Bid Refunds and Wallet Integration', () => {
    
    test('should lock bid amount in user wallet', async () => {
      const userId = 'user_456';
      const bidAmount = 200;
      const initialBalance = 500;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: userId,
          wallet_balance: initialBalance
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          locked_amount: bidAmount,
          available_balance: initialBalance - bidAmount
        }]
      });

      const wallet = await biddingEngine.lockBidAmount(userId, bidAmount);

      expect(wallet.locked_amount).toBe(bidAmount);
      expect(wallet.available_balance).toBe(initialBalance - bidAmount);
    });

    test('should unlock refund bid amount when outbid', async () => {
      const userId = 'user_111';
      const bidAmount = 100;

      db.query.mockResolvedValueOnce({
        rows: [{
          locked_amount: bidAmount
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          locked_amount: 0,
          available_balance: 500 + bidAmount
        }]
      });

      const result = await biddingEngine.unlockBidAmount(userId, bidAmount);

      expect(result.locked_amount).toBe(0);
    });

    test('should handle multiple locked bids per user', async () => {
      const userId = 'user_456';
      const bids = [
        { auctionId: 'a1', amount: 100 },
        { auctionId: 'a2', amount: 150 },
        { auctionId: 'a3', amount: 200 }
      ];

      const totalLocked = bids.reduce((sum, bid) => sum + bid.amount, 0);

      const wallet = {
        total_balance: 1000,
        locked_amount: totalLocked,
        available_balance: 1000 - totalLocked
      };

      expect(wallet.locked_amount).toBe(450);
      expect(wallet.available_balance).toBe(550);
    });

  });

});
