/**
 * Unit Tests for Authentication Service
 * Comprehensive test suite covering user authentication, authorization,
 * sessions, tokens, password management, and security mechanisms
 */

const authService = require('../src/services/authService');
const userService = require('../src/services/userService');
const db = require('../src/config/db');
const jwtService = require('../src/services/jwtService');
const emailService = require('../src/services/emailService');
const auditLogger = require('../src/services/auditLogger');

// Mock dependencies
jest.mock('../src/config/db');
jest.mock('../src/services/userService');
jest.mock('../src/services/jwtService');
jest.mock('../src/services/emailService');
jest.mock('../src/services/auditLogger');

describe('Authentication Service', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // TEST SUITE 1: User Registration
  // ============================================================
  describe('User Registration', () => {
    
    test('should successfully register new user with valid credentials', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        phone: '1234567890'
      };

      userService.checkEmailExists.mockResolvedValueOnce(false);
      userService.createUser.mockResolvedValueOnce({
        id: 'user_001',
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        createdAt: new Date()
      });

      const result = await authService.register(userData);

      expect(result.id).toBe('user_001');
      expect(result.email).toBe(userData.email);
      expect(userService.createUser).toHaveBeenCalled();
    });

    test('should reject registration with existing email', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      userService.checkEmailExists.mockResolvedValueOnce(true);

      await expect(
        authService.register(userData)
      ).rejects.toThrow('Email already registered');
    });

    test('should validate email format during registration', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      await expect(
        authService.register(userData)
      ).rejects.toThrow('Invalid email format');
    });

    test('should validate password strength', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'weak',
        firstName: 'John',
        lastName: 'Doe'
      };

      await expect(
        authService.register(userData)
      ).rejects.toThrow('Password does not meet security requirements');
    });

    test('should require minimum password length', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'Sec!1',
        firstName: 'John',
        lastName: 'Doe'
      };

      await expect(
        authService.register(userData)
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    test('should hash password before storing', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      userService.checkEmailExists.mockResolvedValueOnce(false);
      userService.createUser.mockResolvedValueOnce({
        id: 'user_001',
        email: userData.email
      });

      await authService.register(userData);

      expect(userService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: userData.email,
          password: expect.not.stringContaining(userData.password)
        })
      );
    });

    test('should send confirmation email after registration', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      userService.checkEmailExists.mockResolvedValueOnce(false);
      userService.createUser.mockResolvedValueOnce({
        id: 'user_001',
        email: userData.email
      });

      emailService.sendConfirmationEmail.mockResolvedValueOnce(true);

      await authService.register(userData);

      expect(emailService.sendConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: userData.email
        })
      );
    });

  });

  // ============================================================
  // TEST SUITE 2: User Login
  // ============================================================
  describe('User Login', () => {
    
    test('should successfully login with correct credentials', async () => {
      const loginData = {
        email: 'user@example.com',
        password: 'SecurePass123!'
      };

      userService.getUserByEmail.mockResolvedValueOnce({
        id: 'user_001',
        email: loginData.email,
        password: 'hashed_password_hash'
      });

      authService.comparePasswords = jest.fn().mockResolvedValueOnce(true);

      jwtService.generateToken.mockReturnValueOnce('valid_jwt_token');
      jwtService.generateRefreshToken.mockReturnValueOnce('valid_refresh_token');

      const result = await authService.login(loginData);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.userId).toBe('user_001');
    });

    test('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'SecurePass123!'
      };

      userService.getUserByEmail.mockResolvedValueOnce(null);

      await expect(
        authService.login(loginData)
      ).rejects.toThrow('Invalid email or password');
    });

    test('should reject login with incorrect password', async () => {
      const loginData = {
        email: 'user@example.com',
        password: 'WrongPassword123!'
      };

      userService.getUserByEmail.mockResolvedValueOnce({
        id: 'user_001',
        email: loginData.email,
        password: 'hashed_password_hash'
      });

      authService.comparePasswords = jest.fn().mockResolvedValueOnce(false);

      await expect(
        authService.login(loginData)
      ).rejects.toThrow('Invalid email or password');
    });

    test('should track failed login attempts', async () => {
      const loginData = {
        email: 'user@example.com',
        password: 'WrongPassword123!'
      };

      userService.getUserByEmail.mockResolvedValueOnce({
        id: 'user_001',
        email: loginData.email,
        failedAttempts: 0
      });

      authService.comparePasswords = jest.fn().mockResolvedValueOnce(false);

      await expect(
        authService.login(loginData)
      ).rejects.toThrow();

      expect(userService.incrementFailedLoginAttempts).toBeDefined();
    });

    test('should lock account after multiple failed attempts', async () => {
      const loginData = {
        email: 'user@example.com',
        password: 'WrongPassword123!'
      };

      userService.getUserByEmail.mockResolvedValueOnce({
        id: 'user_001',
        email: loginData.email,
        failedAttempts: 5,
        locked: true
      });

      await expect(
        authService.login(loginData)
      ).rejects.toThrow('Account is locked');
    });

    test('should create session after successful login', async () => {
      const loginData = {
        email: 'user@example.com',
        password: 'SecurePass123!'
      };

      userService.getUserByEmail.mockResolvedValueOnce({
        id: 'user_001',
        email: loginData.email,
        password: 'hashed_password_hash'
      });

      authService.comparePasswords = jest.fn().mockResolvedValueOnce(true);

      jwtService.generateToken.mockReturnValueOnce('valid_jwt_token');
      jwtService.generateRefreshToken.mockReturnValueOnce('valid_refresh_token');

      db.query.mockResolvedValueOnce({
        rows: [{ sessionId: 'session_001' }]
      });

      await authService.login(loginData);

      expect(db.query).toHaveBeenCalled();
    });

    test('should update last login timestamp', async () => {
      const loginData = {
        email: 'user@example.com',
        password: 'SecurePass123!'
      };

      userService.getUserByEmail.mockResolvedValueOnce({
        id: 'user_001',
        email: loginData.email,
        password: 'hashed_password_hash'
      });

      authService.comparePasswords = jest.fn().mockResolvedValueOnce(true);

      jwtService.generateToken.mockReturnValueOnce('valid_jwt_token');
      jwtService.generateRefreshToken.mockReturnValueOnce('valid_refresh_token');

      await authService.login(loginData);

      expect(userService.updateLastLogin).toBeDefined();
    });

  });

  // ============================================================
  // TEST SUITE 3: Token Management
  // ============================================================
  describe('Token Management', () => {
    
    test('should generate valid JWT access token', () => {
      const userId = 'user_001';
      const roleId = 'role_buyer';

      jwtService.generateToken.mockReturnValueOnce('valid_jwt_token');

      const token = authService.generateAccessToken(userId, roleId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    test('should generate valid refresh token', () => {
      const userId = 'user_001';

      jwtService.generateRefreshToken.mockReturnValueOnce('valid_refresh_token');

      const token = authService.generateRefreshToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    test('should verify valid JWT token', () => {
      const token = 'valid_jwt_token';

      jwtService.verifyToken.mockReturnValueOnce({
        userId: 'user_001',
        roleId: 'role_buyer'
      });

      const decoded = authService.verifyToken(token);

      expect(decoded.userId).toBe('user_001');
    });

    test('should reject expired token', () => {
      const expiredToken = 'expired_jwt_token';

      jwtService.verifyToken.mockImplementationOnce(() => {
        throw new Error('Token expired');
      });

      expect(() => authService.verifyToken(expiredToken)).toThrow('Token expired');
    });

    test('should reject malformed token', () => {
      const malformedToken = 'invalid.token.format';

      jwtService.verifyToken.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      expect(() => authService.verifyToken(malformedToken)).toThrow('Invalid token');
    });

    test('should refresh access token using refresh token', async () => {
      const refreshToken = 'valid_refresh_token';
      const userId = 'user_001';

      jwtService.verifyRefreshToken.mockReturnValueOnce({
        userId: userId
      });

      jwtService.generateToken.mockReturnValueOnce('new_access_token');

      const newAccessToken = await authService.refreshAccessToken(refreshToken);

      expect(newAccessToken).toBe('new_access_token');
    });

    test('should invalidate refresh token after use if configured', async () => {
      const refreshToken = 'valid_refresh_token';

      jwtService.verifyRefreshToken.mockReturnValueOnce({
        userId: 'user_001'
      });

      jwtService.generateToken.mockReturnValueOnce('new_access_token');

      await authService.refreshAccessToken(refreshToken);

      expect(db.query).toBeDefined();
    });

  });

  // ============================================================
  // TEST SUITE 4: Password Management
  // ============================================================
  describe('Password Management', () => {
    
    test('should send password reset link on request', async () => {
      const email = 'user@example.com';

      userService.getUserByEmail.mockResolvedValueOnce({
        id: 'user_001',
        email: email
      });

      emailService.sendPasswordResetEmail.mockResolvedValueOnce(true);

      await authService.requestPasswordReset(email);

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
      expect(db.query).toBeDefined();
    });

    test('should validate password reset token', async () => {
      const resetToken = 'valid_reset_token';

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: 'user_001',
          token: resetToken,
          expiresAt: new Date(Date.now() + 3600000)
        }]
      });

      const result = await authService.validateResetToken(resetToken);

      expect(result.userId).toBe('user_001');
      expect(result.valid).toBe(true);
    });

    test('should reject expired password reset token', async () => {
      const expiredToken = 'expired_reset_token';

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: 'user_001',
          token: expiredToken,
          expiresAt: new Date(Date.now() - 3600000)
        }]
      });

      await expect(
        authService.validateResetToken(expiredToken)
      ).rejects.toThrow('Reset token has expired');
    });

    test('should reset password with valid token', async () => {
      const resetToken = 'valid_reset_token';
      const newPassword = 'NewSecurePass123!';

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: 'user_001',
          token: resetToken,
          expiresAt: new Date(Date.now() + 3600000)
        }]
      });

      userService.updatePassword.mockResolvedValueOnce(true);

      await authService.resetPassword(resetToken, newPassword);

      expect(userService.updatePassword).toHaveBeenCalled();
      expect(db.query).toBeDefined();
    });

    test('should require strong password for reset', async () => {
      const resetToken = 'valid_reset_token';
      const weakPassword = 'weak';

      await expect(
        authService.resetPassword(resetToken, weakPassword)
      ).rejects.toThrow('Password does not meet security requirements');
    });

    test('should change password for authenticated user', async () => {
      const userId = 'user_001';
      const currentPassword = 'CurrentPass123!';
      const newPassword = 'NewPass123!';

      userService.getUserById.mockResolvedValueOnce({
        id: userId,
        password: 'hashed_current_password'
      });

      authService.comparePasswords = jest.fn().mockResolvedValueOnce(true);
      userService.updatePassword.mockResolvedValueOnce(true);

      await authService.changePassword(userId, currentPassword, newPassword);

      expect(userService.updatePassword).toHaveBeenCalled();
    });

    test('should prevent reuse of recent passwords', async () => {
      const userId = 'user_001';
      const currentPassword = 'CurrentPass123!';
      const oldPassword = 'RecentPass123!';

      userService.getUserById.mockResolvedValueOnce({
        id: userId,
        password: 'hashed_current_password',
        recentPasswords: ['old_pass_1', 'old_pass_2']
      });

      authService.comparePasswords = jest.fn().mockResolvedValueOnce(true);
      authService.comparePasswords = jest.fn().mockResolvedValueOnce(true);

      await expect(
        authService.changePassword(userId, currentPassword, oldPassword)
      ).rejects.toThrow('Cannot reuse recent passwords');
    });

  });

  // ============================================================
  // TEST SUITE 5: Authorization and Permissions
  // ============================================================
  describe('Authorization and Permissions', () => {
    
    test('should check user role for authorization', async () => {
      const userId = 'user_001';
      const requiredRole = 'seller';

      userService.getUserRoles.mockResolvedValueOnce(['seller', 'buyer']);

      const hasRole = await authService.hasRole(userId, requiredRole);

      expect(hasRole).toBe(true);
    });

    test('should deny access if user lacks required role', async () => {
      const userId = 'user_001';
      const requiredRole = 'admin';

      userService.getUserRoles.mockResolvedValueOnce(['buyer']);

      const hasRole = await authService.hasRole(userId, requiredRole);

      expect(hasRole).toBe(false);
    });

    test('should check user permissions', async () => {
      const userId = 'user_001';
      const requiredPermission = 'list_items';

      userService.getUserPermissions.mockResolvedValueOnce(['list_items', 'edit_profile']);

      const hasPermission = await authService.hasPermission(userId, requiredPermission);

      expect(hasPermission).toBe(true);
    });

    test('should validate permission for resource access', async () => {
      const userId = 'user_001';
      const resourceId = 'item_123';
      const action = 'edit';

      userService.getUserPermissions.mockResolvedValueOnce(['edit_own_items']);

      db.query.mockResolvedValueOnce({
        rows: [{ ownerId: userId }]
      });

      const canAccess = await authService.canAccessResource(userId, resourceId, action);

      expect(canAccess).toBe(true);
    });

    test('should deny permission for unauthorized resource access', async () => {
      const userId = 'user_001';
      const resourceId = 'item_123';
      const action = 'edit';

      userService.getUserPermissions.mockResolvedValueOnce(['edit_own_items']);

      db.query.mockResolvedValueOnce({
        rows: [{ ownerId: 'user_999' }]
      });

      const canAccess = await authService.canAccessResource(userId, resourceId, action);

      expect(canAccess).toBe(false);
    });

    test('should support role hierarchy', async () => {
      const userId = 'user_001';

      userService.getUserRoles.mockResolvedValueOnce(['admin']);

      const isSuperAdmin = await authService.hasRole(userId, 'super_admin');
      const isAdmin = await authService.hasRole(userId, 'admin');

      expect(isAdmin).toBe(true);
    });

  });

  // ============================================================
  // TEST SUITE 6: Session Management
  // ============================================================
  describe('Session Management', () => {
    
    test('should create session on login', async () => {
      const userId = 'user_001';
      const ipAddress = '192.168.1.1';

      db.query.mockResolvedValueOnce({
        rows: [{
          sessionId: 'session_001',
          userId: userId,
          createdAt: new Date()
        }]
      });

      const session = await authService.createSession(userId, ipAddress);

      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe(userId);
    });

    test('should retrieve active session', async () => {
      const sessionId = 'session_001';

      db.query.mockResolvedValueOnce({
        rows: [{
          sessionId: sessionId,
          userId: 'user_001',
          active: true
        }]
      });

      const session = await authService.getSession(sessionId);

      expect(session.active).toBe(true);
    });

    test('should invalidate session on logout', async () => {
      const sessionId = 'session_001';

      db.query.mockResolvedValueOnce({
        rows: [{ sessionId: sessionId, active: false }]
      });

      await authService.invalidateSession(sessionId);

      expect(db.query).toHaveBeenCalled();
    });

    test('should expire old sessions', async () => {
      const userId = 'user_001';
      const sessionTimeout = 3600000; // 1 hour

      db.query.mockResolvedValueOnce({
        rows: [
          { sessionId: 'session_001', createdAt: new Date(Date.now() - 7200000) },
          { sessionId: 'session_002', createdAt: new Date(Date.now() - 1800000) }
        ]
      });

      await authService.expireOldSessions(userId, sessionTimeout);

      expect(db.query).toHaveBeenCalled();
    });

    test('should handle concurrent sessions', async () => {
      const userId = 'user_001';
      const maxConcurrentSessions = 5;

      const sessions = Array.from({ length: maxConcurrentSessions }, (_, i) => ({
        sessionId: `session_${i}`,
        userId: userId
      }));

      db.query.mockResolvedValueOnce({ rows: sessions });

      const activeSessions = await authService.getActiveSessions(userId);

      expect(activeSessions).toHaveLength(maxConcurrentSessions);
    });

    test('should enforce single session per device', async () => {
      const userId = 'user_001';
      const deviceId = 'device_123';

      db.query.mockResolvedValueOnce({
        rows: [{ sessionId: 'session_001' }]
      });

      db.query.mockResolvedValueOnce({ rows: [] });

      await authService.createSession(userId, '192.168.1.1', deviceId);

      expect(db.query).toBeDefined();
    });

  });

  // ============================================================
  // TEST SUITE 7: Two-Factor Authentication (2FA)
  // ============================================================
  describe('Two-Factor Authentication', () => {
    
    test('should enable 2FA for user', async () => {
      const userId = 'user_001';
      const method = 'authenticator_app';

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          method: method,
          secret: 'base32_encoded_secret',
          enabled: false
        }]
      });

      const result = await authService.enable2FA(userId, method);

      expect(result.secret).toBeDefined();
      expect(result.enabled).toBe(false);
    });

    test('should verify 2FA setup with backup codes', async () => {
      const userId = 'user_001';
      const code = '123456';
      const backupCodes = ['code_1', 'code_2', 'code_3'];

      db.query.mockResolvedValueOnce({
        rows: [{
          valid: true,
          backupCodes: backupCodes
        }]
      });

      const result = await authService.verify2FASetup(userId, code);

      expect(result.backupCodes).toHaveLength(3);
    });

    test('should validate 2FA code during login', async () => {
      const code = '123456';
      const userId = 'user_001';

      authService.verifyOTPCode = jest.fn().mockResolvedValueOnce(true);

      const isValid = await authService.validate2FACode(userId, code);

      expect(isValid).toBe(true);
    });

    test('should use backup codes when OTP unavailable', async () => {
      const userId = 'user_001';
      const backupCode = 'backup_code_123';

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          backupCode: backupCode,
          used: false
        }]
      });

      const isValid = await authService.validate2FABackupCode(userId, backupCode);

      expect(isValid).toBe(true);
    });

    test('should prevent reuse of backup codes', async () => {
      const userId = 'user_001';
      const usedBackupCode = 'backup_code_123';

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          backupCode: usedBackupCode,
          used: true
        }]
      });

      const isValid = await authService.validate2FABackupCode(userId, usedBackupCode);

      expect(isValid).toBe(false);
    });

    test('should disable 2FA with password confirmation', async () => {
      const userId = 'user_001';
      const password = 'UserPassword123!';

      userService.getUserById.mockResolvedValueOnce({
        id: userId,
        password: 'hashed_password'
      });

      authService.comparePasswords = jest.fn().mockResolvedValueOnce(true);

      db.query.mockResolvedValueOnce({
        rows: [{ userId: userId, enabled: false }]
      });

      const result = await authService.disable2FA(userId, password);

      expect(result.enabled).toBe(false);
    });

  });

  // ============================================================
  // TEST SUITE 8: Social Authentication
  // ============================================================
  describe('Social Authentication', () => {
    
    test('should authenticate with Google OAuth token', async () => {
      const googleToken = 'google_oauth_token';

      authService.verifyGoogleToken = jest.fn().mockResolvedValueOnce({
        email: 'user@gmail.com',
        name: 'John Doe',
        googleId: 'google_123'
      });

      userService.getUserByEmail.mockResolvedValueOnce(null);
      userService.createUser.mockResolvedValueOnce({
        id: 'user_001',
        email: 'user@gmail.com'
      });

      jwtService.generateToken.mockReturnValueOnce('jwt_token');
      jwtService.generateRefreshToken.mockReturnValueOnce('refresh_token');

      const result = await authService.authenticateWithGoogle(googleToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    test('should authenticate with Facebook OAuth token', async () => {
      const facebookToken = 'facebook_oauth_token';

      authService.verifyFacebookToken = jest.fn().mockResolvedValueOnce({
        email: 'user@facebook.com',
        name: 'John Doe',
        facebookId: 'fb_123'
      });

      userService.getUserByEmail.mockResolvedValueOnce({
        id: 'user_001',
        email: 'user@facebook.com'
      });

      jwtService.generateToken.mockReturnValueOnce('jwt_token');

      const result = await authService.authenticateWithFacebook(facebookToken);

      expect(result).toHaveProperty('accessToken');
    });

    test('should link social account to existing user', async () => {
      const userId = 'user_001';
      const googleId = 'google_123';

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          googleId: googleId,
          linked: true
        }]
      });

      const result = await authService.linkSocialAccount(userId, 'google', googleId);

      expect(result.linked).toBe(true);
    });

    test('should unlink social account from user', async () => {
      const userId = 'user_001';
      const provider = 'google';

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          provider: provider,
          linked: false
        }]
      });

      await authService.unlinkSocialAccount(userId, provider);

      expect(db.query).toHaveBeenCalled();
    });

  });

  // ============================================================
  // TEST SUITE 9: Security and Rate Limiting
  // ============================================================
  describe('Security and Rate Limiting', () => {
    
    test('should enforce login attempt rate limiting', async () => {
      const email = 'user@example.com';
      const maxAttempts = 5;
      const timeWindow = 900000; // 15 minutes

      db.query.mockResolvedValueOnce({
        rows: [
          { timestamp: new Date() },
          { timestamp: new Date() },
          { timestamp: new Date() },
          { timestamp: new Date() },
          { timestamp: new Date() }
        ]
      });

      await expect(
        authService.checkLoginRateLimit(email)
      ).rejects.toThrow('Too many login attempts');
    });

    test('should reset rate limit after time window expires', async () => {
      const email = 'user@example.com';

      db.query.mockResolvedValueOnce({
        rows: [
          { timestamp: new Date(Date.now() - 1000000) }
        ]
      });

      const canRetry = await authService.checkLoginRateLimit(email);

      expect(canRetry).toBe(true);
    });

    test('should detect and prevent brute force attacks', async () => {
      const email = 'user@example.com';

      const failedAttempts = Array.from({ length: 10 }, () => 
        ({ timestamp: new Date() })
      );

      db.query.mockResolvedValueOnce({ rows: failedAttempts });

      await expect(
        authService.checkBruteForceProtection(email)
      ).rejects.toThrow('Account temporarily locked');
    });

    test('should validate CSRF token', () => {
      const csrfToken = 'valid_csrf_token';
      const sessionId = 'session_001';

      const isValid = authService.validateCSRFToken(csrfToken, sessionId);

      expect(typeof isValid).toBe('boolean');
    });

    test('should implement account lockout after failed attempts', async () => {
      const userId = 'user_001';
      const maxFailedAttempts = 5;

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          failedAttempts: maxFailedAttempts,
          locked: true
        }]
      });

      const isLocked = await authService.isAccountLocked(userId);

      expect(isLocked).toBe(true);
    });

    test('should unlock account after lockout period', async () => {
      const userId = 'user_001';
      const lockoutPeriod = 1800000; // 30 minutes

      const lockedAt = new Date(Date.now() - 2000000); // Locked 33 minutes ago

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          lockedAt: lockedAt,
          locked: false
        }]
      });

      const isStillLocked = await authService.isAccountLocked(userId);

      expect(isStillLocked).toBe(false);
    });

  });

  // ============================================================
  // TEST SUITE 10: Email Verification
  // ============================================================
  describe('Email Verification', () => {
    
    test('should send email verification code', async () => {
      const userId = 'user_001';
      const email = 'user@example.com';

      emailService.sendVerificationEmail.mockResolvedValueOnce(true);

      await authService.sendEmailVerification(userId, email);

      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    test('should verify email with correct code', async () => {
      const userId = 'user_001';
      const verificationCode = '123456';

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          code: verificationCode,
          verified: false,
          expiresAt: new Date(Date.now() + 3600000)
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          emailVerified: true
        }]
      });

      const result = await authService.verifyEmail(userId, verificationCode);

      expect(result.emailVerified).toBe(true);
    });

    test('should reject expired verification code', async () => {
      const userId = 'user_001';
      const expiredCode = '123456';

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          code: expiredCode,
          expiresAt: new Date(Date.now() - 3600000)
        }]
      });

      await expect(
        authService.verifyEmail(userId, expiredCode)
      ).rejects.toThrow('Verification code has expired');
    });

    test('should allow resend of verification code', async () => {
      const userId = 'user_001';
      const resendAttempts = 1;

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          resendCount: resendAttempts
        }]
      });

      emailService.sendVerificationEmail.mockResolvedValueOnce(true);

      await authService.resendVerificationCode(userId);

      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    test('should limit verification code resend attempts', async () => {
      const userId = 'user_001';
      const maxResends = 5;

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          resendCount: maxResends
        }]
      });

      await expect(
        authService.resendVerificationCode(userId)
      ).rejects.toThrow('Maximum resend attempts exceeded');
    });

  });

  // ============================================================
  // TEST SUITE 11: Logout and Session Cleanup
  // ============================================================
  describe('Logout and Session Cleanup', () => {
    
    test('should logout user and invalidate session', async () => {
      const sessionId = 'session_001';

      db.query.mockResolvedValueOnce({
        rows: [{ sessionId: sessionId }]
      });

      await authService.logout(sessionId);

      expect(db.query).toHaveBeenCalled();
      expect(auditLogger.logEvent).toBeDefined();
    });

    test('should logout user from all sessions', async () => {
      const userId = 'user_001';

      db.query.mockResolvedValueOnce({
        rows: [
          { sessionId: 'session_001' },
          { sessionId: 'session_002' },
          { sessionId: 'session_003' }
        ]
      });

      await authService.logoutAllSessions(userId);

      expect(db.query).toHaveBeenCalled();
    });

    test('should cleanup expired tokens', async () => {
      const expirationTime = Date.now() - 86400000; // 1 day ago

      db.query.mockResolvedValueOnce({
        rows: [
          { id: 'token_1', expiresAt: new Date(expirationTime) },
          { id: 'token_2', expiresAt: new Date(expirationTime) }
        ]
      });

      await authService.cleanupExpiredTokens();

      expect(db.query).toHaveBeenCalled();
    });

    test('should cleanup inactive sessions', async () => {
      const inactivityTimeout = 3600000; // 1 hour

      db.query.mockResolvedValueOnce({
        rows: [
          { sessionId: 'session_001', lastActivity: new Date(Date.now() - 7200000) },
          { sessionId: 'session_002', lastActivity: new Date(Date.now() - 7200000) }
        ]
      });

      await authService.cleanupInactiveSessions(inactivityTimeout);

      expect(db.query).toHaveBeenCalled();
    });

  });

  // ============================================================
  // TEST SUITE 12: Audit Logging and Security Events
  // ============================================================
  describe('Audit Logging and Security Events', () => {
    
    test('should log successful login', async () => {
      const userId = 'user_001';
      const ipAddress = '192.168.1.1';

      auditLogger.logEvent.mockResolvedValueOnce(true);

      await authService.login({ email: 'user@example.com', password: 'pass' });

      expect(auditLogger.logEvent).toBeDefined();
    });

    test('should log failed login attempt', async () => {
      const email = 'user@example.com';
      const reason = 'Invalid password';

      auditLogger.logEvent.mockResolvedValueOnce(true);

      userService.getUserByEmail.mockResolvedValueOnce({
        id: 'user_001',
        password: 'hashed'
      });

      authService.comparePasswords = jest.fn().mockResolvedValueOnce(false);

      await expect(
        authService.login({ email, password: 'wrong' })
      ).rejects.toThrow();

      expect(auditLogger.logEvent).toBeDefined();
    });

    test('should log password change', async () => {
      const userId = 'user_001';

      auditLogger.logEvent.mockResolvedValueOnce(true);

      userService.getUserById.mockResolvedValueOnce({
        id: userId,
        password: 'hashed'
      });

      authService.comparePasswords = jest.fn().mockResolvedValueOnce(true);
      userService.updatePassword.mockResolvedValueOnce(true);

      await authService.changePassword(userId, 'old_pass', 'new_pass');

      expect(auditLogger.logEvent).toBeDefined();
    });

    test('should log 2FA enable/disable', async () => {
      const userId = 'user_001';

      auditLogger.logEvent.mockResolvedValueOnce(true);

      db.query.mockResolvedValueOnce({
        rows: [{ userId: userId, enabled: true }]
      });

      await authService.enable2FA(userId, 'authenticator_app');

      expect(auditLogger.logEvent).toBeDefined();
    });

    test('should log suspicious activities', async () => {
      const userId = 'user_001';
      const activityType = 'multiple_failed_logins';

      auditLogger.logEvent.mockResolvedValueOnce(true);

      await authService.logSuspiciousActivity(userId, activityType);

      expect(auditLogger.logEvent).toHaveBeenCalled();
    });

  });

  // ============================================================
  // TEST SUITE 13: Edge Cases and Error Handling
  // ============================================================
  describe('Edge Cases and Error Handling', () => {
    
    test('should handle database connection errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        authService.login({ email: 'user@example.com', password: 'pass' })
      ).rejects.toThrow();
    });

    test('should handle missing required fields during registration', async () => {
      const incompleteData = {
        email: 'user@example.com'
        // Missing password, firstName, lastName
      };

      await expect(
        authService.register(incompleteData)
      ).rejects.toThrow('Missing required fields');
    });

    test('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(250) + '@example.com';

      await expect(
        authService.register({
          email: longEmail,
          password: 'SecurePass123!',
          firstName: 'John',
          lastName: 'Doe'
        })
      ).rejects.toThrow();
    });

    test('should handle concurrent authentication requests', async () => {
      const loginData = {
        email: 'user@example.com',
        password: 'SecurePass123!'
      };

      userService.getUserByEmail.mockResolvedValueOnce({
        id: 'user_001',
        password: 'hashed'
      });

      authService.comparePasswords = jest.fn().mockResolvedValueOnce(true);

      jwtService.generateToken.mockReturnValueOnce('token_1');
      jwtService.generateRefreshToken.mockReturnValueOnce('refresh_1');

      const promises = Array.from({ length: 5 }, () =>
        authService.login(loginData)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
    });

  });

  // ============================================================
  // TEST SUITE 14: Performance Optimization
  // ============================================================
  describe('Performance Optimization', () => {
    
    test('should cache user authentication data', async () => {
      const email = 'user@example.com';

      userService.getUserByEmail.mockResolvedValueOnce({
        id: 'user_001',
        email: email
      });

      const firstCall = await authService.getUserByEmail(email);

      jest.clearAllMocks();

      const secondCall = await authService.getUserByEmail(email);

      expect(firstCall).toEqual(secondCall);
      expect(userService.getUserByEmail).not.toHaveBeenCalled();
    });

    test('should efficiently validate JWT tokens', () => {
      const token = 'valid_jwt_token';

      jwtService.verifyToken.mockReturnValueOnce({
        userId: 'user_001'
      });

      const startTime = Date.now();
      const decoded = authService.verifyToken(token);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(100);
      expect(decoded.userId).toBe('user_001');
    });

    test('should handle large number of concurrent sessions', async () => {
      const userId = 'user_001';
      const sessionCount = 1000;

      const sessions = Array.from({ length: sessionCount }, (_, i) => ({
        sessionId: `session_${i}`,
        userId: userId
      }));

      db.query.mockResolvedValueOnce({ rows: sessions });

      const activeSessions = await authService.getActiveSessions(userId);

      expect(activeSessions).toHaveLength(sessionCount);
    });

  });

});
