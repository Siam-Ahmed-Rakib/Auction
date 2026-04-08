/**
 * Unit Tests for Search Service
 * Comprehensive test suite covering auction search, filtering,
 * faceted search, search history, and search optimization
 */

const searchService = require('../src/services/searchService');
const db = require('../src/config/db');
const elasticsearchService = require('../src/services/elasticsearchService');
const cacheService = require('../src/services/cacheService');
const auditLogger = require('../src/services/auditLogger');

// Mock dependencies
jest.mock('../src/config/db');
jest.mock('../src/services/elasticsearchService');
jest.mock('../src/services/cacheService');
jest.mock('../src/services/auditLogger');

describe('Search Service', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // TEST SUITE 1: Basic Search
  // ============================================================
  describe('Basic Search', () => {
    
    test('should search auctions by keyword', async () => {
      const searchQuery = {
        keyword: 'vintage watch',
        limit: 10,
        offset: 0
      };

      cacheService.get.mockResolvedValueOnce(null);

      elasticsearchService.search.mockResolvedValueOnce({
        results: [
          { id: 'auction_001', title: 'Vintage Watch 1950s', score: 0.98 }
        ],
        total: 1
      });

      const result = await searchService.searchAuctions(searchQuery);

      expect(result.results.length).toBe(1);
      expect(result.results[0].title).toContain('Vintage');
    });

    test('should handle empty search results', async () => {
      const searchQuery = {
        keyword: 'nonexistent_item_xyz',
        limit: 10
      };

      elasticsearchService.search.mockResolvedValueOnce({
        results: [],
        total: 0
      });

      const result = await searchService.searchAuctions(searchQuery);

      expect(result.results.length).toBe(0);
    });

    test('should perform case-insensitive search', async () => {
      const searchQuery = {
        keyword: 'VINTAGE',
        limit: 10
      };

      elasticsearchService.search.mockResolvedValueOnce({
        results: [
          { id: 'auction_001', title: 'vintage watch' }
        ],
        total: 1
      });

      const result = await searchService.searchAuctions(searchQuery);

      expect(result.results.length).toBe(1);
    });
  });

  // ============================================================
  // TEST SUITE 2: Advanced Filtering
  // ============================================================
  describe('Advanced Filtering', () => {
    
    test('should filter search by category', async () => {
      const searchQuery = {
        keyword: 'watch',
        category: 'collectibles',
        limit: 10
      };

      elasticsearchService.search.mockResolvedValueOnce({
        results: [
          { id: 'auction_001', category: 'collectibles', title: 'Vintage Watch' }
        ],
        total: 1
      });

      const result = await searchService.searchAuctions(searchQuery);

      expect(result.results[0].category).toBe('collectibles');
    });

    test('should filter search by price range', async () => {
      const searchQuery = {
        keyword: 'watch',
        minPrice: 100,
        maxPrice: 500,
        limit: 10
      };

      elasticsearchService.search.mockResolvedValueOnce({
        results: [
          { id: 'auction_001', startingBid: 150.00, title: 'Vintage Watch' }
        ],
        total: 1
      });

      const result = await searchService.searchAuctions(searchQuery);

      expect(result.results.length).toBe(1);
    });

    test('should filter by status (active, closed, etc)', async () => {
      const searchQuery = {
        keyword: 'watch',
        status: 'active',
        limit: 10
      };

      elasticsearchService.search.mockResolvedValueOnce({
        results: [
          { id: 'auction_001', status: 'active' }
        ],
        total: 1
      });

      const result = await searchService.searchAuctions(searchQuery);

      expect(result.results[0].status).toBe('active');
    });

    test('should filter by seller rating', async () => {
      const searchQuery = {
        keyword: 'watch',
        minSellerRating: 4.5,
        limit: 10
      };

      elasticsearchService.search.mockResolvedValueOnce({
        results: [
          { id: 'auction_001', sellerRating: 4.8 }
        ],
        total: 1
      });

      const result = await searchService.searchAuctions(searchQuery);

      expect(result.results[0].sellerRating).toBeGreaterThanOrEqual(4.5);
    });
  });

  // ============================================================
  // TEST SUITE 3: Search History & Saved Searches
  // ============================================================
  describe('Search History & Saved Searches', () => {
    
    test('should save search to history', async () => {
      const searchQuery = {
        keyword: 'vintage watch',
        userId: 'user_001'
      };

      db.query.mockResolvedValueOnce({
        id: 'search_hist_001',
        ...searchQuery,
        timestamp: new Date()
      });

      const result = await searchService.saveSearchHistory(searchQuery);

      expect(result.keyword).toBe('vintage watch');
    });

    test('should retrieve user search history', async () => {
      db.query.mockResolvedValueOnce([
        { keyword: 'vintage watch', timestamp: new Date() },
        { keyword: 'antique coins', timestamp: new Date() }
      ]);

      const result = await searchService.getSearchHistory('user_001');

      expect(result.length).toBe(2);
    });

    test('should save search for later', async () => {
      const searches = {
        userId: 'user_001',
        name: 'My Favorite Watches',
        searchQuery: { keyword: 'vintage watch', category: 'collectibles' }
      };

      db.query.mockResolvedValueOnce({
        id: 'saved_search_001',
        ...searches
      });

      const result = await searchService.saveSearch(searches);

      expect(result.name).toBe('My Favorite Watches');
    });
  });

  // ============================================================
  // TEST SUITE 4: Search Performance & Caching
  // ============================================================
  describe('Search Performance & Caching', () => {
    
    test('should cache popular searches', async () => {
      const searchQuery = {
        keyword: 'popular item',
        limit: 10
      };

      cacheService.get.mockResolvedValueOnce({
        results: [{ id: 'auction_001', title: 'Popular item' }],
        total: 1
      });

      const result = await searchService.searchAuctions(searchQuery);

      expect(cacheService.get).toHaveBeenCalled();
      expect(result.results.length).toBe(1);
    });

    test('should invalidate cache on auction update', async () => {
      cacheService.invalidate.mockResolvedValueOnce(true);

      await searchService.invalidateSearchCache('vintage watch');

      expect(cacheService.invalidate).toHaveBeenCalled();
    });
  });
});
