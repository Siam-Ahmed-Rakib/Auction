/**
 * Unit Tests for User Service
 * Comprehensive test suite covering user management, profiles,
 * preferences, and user-related operations
 */

const userService = require('../src/services/userService');
const db = require('../src/config/db');
const emailService = require('../src/services/emailService');
const auditLogger = require('../src/services/auditLogger');

// Mock dependencies
jest.mock('../src/config/db');
jest.mock('../src/services/emailService');
jest.mock('../src/services/auditLogger');

describe('User Service', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // TEST SUITE 1: User Profile Management
  // ============================================================
  describe('User Profile Management', () => {
    
    test('should successfully retrieve user profile by ID', async () => {
      const mockUser = {
        id: 'user_001',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '1234567890',
        profileImage: 'avatar.jpg',
        createdAt: new Date()
      };

      db.query.mockResolvedValueOnce([mockUser]);

      const result = await userService.getUserProfile('user_001');

      expect(result.id).toBe('user_001');
      expect(result.email).toBe('john@example.com');
      expect(db.query).toHaveBeenCalled();
    });

    test('should update user profile information', async () => {
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '9876543210'
      };

      db.query.mockResolvedValueOnce({ id: 'user_001', ...updateData });

      const result = await userService.updateProfile('user_001', updateData);

      expect(result.firstName).toBe('Jane');
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([...Object.values(updateData), 'user_001'])
      );
    });

    test('should handle profile not found error', async () => {
      db.query.mockResolvedValueOnce([]);

      await expect(
        userService.getUserProfile('invalid_id')
      ).rejects.toThrow('User profile not found');
    });
  });

  // ============================================================
  // TEST SUITE 2: User Authentication & Verification
  // ============================================================
  describe('User Authentication & Verification', () => {
    
    test('should verify user email successfully', async () => {
      db.query.mockResolvedValueOnce([{ id: 'user_001', emailVerified: true }]);

      const result = await userService.verifyUserEmail('user_001', 'valid_token');

      expect(result.emailVerified).toBe(true);
    });

    test('should reject invalid email verification token', async () => {
      db.query.mockResolvedValueOnce([]);

      await expect(
        userService.verifyUserEmail('user_001', 'invalid_token')
      ).rejects.toThrow('Invalid or expired verification token');
    });

    test('should handle already verified email', async () => {
      db.query.mockResolvedValueOnce([{ id: 'user_001', emailVerified: true }]);

      const result = await userService.checkEmailVerification('user_001');

      expect(result.emailVerified).toBe(true);
    });
  });

  // ============================================================
  // TEST SUITE 3: User Search & Filtering
  // ============================================================
  describe('User Search & Filtering', () => {
    
    test('should search users by email', async () => {
      const mockUsers = [
        { id: 'user_001', email: 'john@example.com', firstName: 'John' }
      ];

      db.query.mockResolvedValueOnce(mockUsers);

      const result = await userService.searchUsersByEmail('john@example.com');

      expect(result.length).toBe(1);
      expect(result[0].email).toBe('john@example.com');
    });

    test('should filter users by registration date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      db.query.mockResolvedValueOnce([
        { id: 'user_001', email: 'john@example.com', createdAt: new Date('2024-06-15') }
      ]);

      const result = await userService.filterUsersByDateRange(startDate, endDate);

      expect(result.length).toBe(1);
    });
  });

  // ============================================================
  // TEST SUITE 4: User Preferences & Settings
  // ============================================================
  describe('User Preferences & Settings', () => {
    
    test('should save user preferences', async () => {
      const preferences = {
        emailNotifications: true,
        smsNotifications: false,
        theme: 'dark'
      };

      db.query.mockResolvedValueOnce({ id: 'user_001', ...preferences });

      const result = await userService.saveUserPreferences('user_001', preferences);

      expect(result.theme).toBe('dark');
      expect(result.emailNotifications).toBe(true);
    });

    test('should retrieve user preferences', async () => {
      db.query.mockResolvedValueOnce([{
        userId: 'user_001',
        emailNotifications: true,
        theme: 'light'
      }]);

      const result = await userService.getUserPreferences('user_001');

      expect(result.emailNotifications).toBe(true);
      expect(result.theme).toBe('light');
    });
  });
});
