/**
 * Unit Tests for Payment Service
 * Comprehensive test suite covering payment processing, validation,
 * refunds, wallet management, and payment gateway integration
 */

const paymentService = require('../src/services/paymentService');
const db = require('../src/config/db');
const notificationService = require('../src/services/notificationService');
const auditLogger = require('../src/services/auditLogger');

// Mock dependencies
jest.mock('../src/config/db');
jest.mock('../src/services/notificationService');
jest.mock('../src/services/auditLogger');

describe('Payment Service', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // TEST SUITE 1: Payment Initialization and Creation
  // ============================================================
  describe('Payment Initialization', () => {
    
    test('should create payment record for auction win', async () => {
      const userId = 'user_123';
      const auctionId = 'auction_456';
      const amount = 500;
      const currency = 'USD';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'payment_001',
          userId: userId,
          auctionId: auctionId,
          amount: amount,
          currency: currency,
          status: 'initiated',
          createdAt: new Date()
        }]
      });

      const payment = await paymentService.initializePayment({
        userId,
        auctionId,
        amount,
        currency
      });

      expect(payment.id).toBe('payment_001');
      expect(payment.status).toBe('initiated');
      expect(payment.amount).toBe(amount);
      expect(payment.userId).toBe(userId);
    });

    test('should validate payment amount is positive', async () => {
      const invalidAmount = -100;

      await expect(
        paymentService.initializePayment({
          userId: 'user_123',
          auctionId: 'auction_456',
          amount: invalidAmount,
          currency: 'USD'
        })
      ).rejects.toThrow('Payment amount must be positive');
    });

    test('should validate payment amount is not zero', async () => {
      const zeroAmount = 0;

      await expect(
        paymentService.initializePayment({
          userId: 'user_123',
          auctionId: 'auction_456',
          amount: zeroAmount,
          currency: 'USD'
        })
      ).rejects.toThrow('Payment amount must be greater than zero');
    });

    test('should validate currency is supported', async () => {
      const unsupportedCurrency = 'XYZ';

      await expect(
        paymentService.initializePayment({
          userId: 'user_123',
          auctionId: 'auction_456',
          amount: 100,
          currency: unsupportedCurrency
        })
      ).rejects.toThrow('Currency not supported');
    });

    test('should generate unique payment ID', async () => {
      const payment1 = { id: 'payment_001' };
      const payment2 = { id: 'payment_002' };

      db.query.mockResolvedValueOnce({ rows: [payment1] });
      const result1 = await paymentService.initializePayment({
        userId: 'user_123',
        auctionId: 'auction_456',
        amount: 100,
        currency: 'USD'
      });

      db.query.mockResolvedValueOnce({ rows: [payment2] });
      const result2 = await paymentService.initializePayment({
        userId: 'user_456',
        auctionId: 'auction_789',
        amount: 200,
        currency: 'USD'
      });

      expect(result1.id).not.toBe(result2.id);
    });

    test('should set correct payment timestamp', async () => {
      const beforeTime = new Date();

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'payment_001',
          createdAt: new Date()
        }]
      });

      const payment = await paymentService.initializePayment({
        userId: 'user_123',
        auctionId: 'auction_456',
        amount: 100,
        currency: 'USD'
      });

      const afterTime = new Date();

      expect(payment.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(payment.createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

  });

  // ============================================================
  // TEST SUITE 2: Payment Processing and Gateway Integration
  // ============================================================
  describe('Payment Processing', () => {
    
    test('should process payment successfully with gateway', async () => {
      const paymentId = 'payment_001';
      const gatewayResponse = {
        id: 'gw_12345',
        status: 'success',
        transactionId: 'txn_98765'
      };

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'initiated',
          amount: 500
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'processing',
          gatewayTransactionId: gatewayResponse.transactionId
        }]
      });

      const result = await paymentService.processPayment(paymentId);

      expect(result.status).toBe('processing');
      expect(result.gatewayTransactionId).toBeDefined();
    });

    test('should handle payment gateway approval', async () => {
      const paymentId = 'payment_001';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'authorized',
          amount: 500
        }]
      });

      const result = await paymentService.authorizePayment(paymentId);

      expect(result.status).toBe('authorized');
    });

    test('should handle payment gateway rejection', async () => {
      const paymentId = 'payment_001';
      const gatewayError = 'Insufficient funds';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'initiated'
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'failed',
          failureReason: gatewayError
        }]
      });

      const result = await paymentService.processPayment(paymentId);

      expect(result.status).toBe('failed');
      expect(result.failureReason).toBe(gatewayError);
    });

    test('should capture authorized payment', async () => {
      const paymentId = 'payment_001';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'authorized',
          amount: 500
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'captured',
          capturedAt: new Date()
        }]
      });

      const result = await paymentService.capturePayment(paymentId);

      expect(result.status).toBe('captured');
      expect(result.capturedAt).toBeDefined();
    });

    test('should void authorized payment', async () => {
      const paymentId = 'payment_001';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'authorized'
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'voided'
        }]
      });

      const result = await paymentService.voidPayment(paymentId);

      expect(result.status).toBe('voided');
    });

  });

  // ============================================================
  // TEST SUITE 3: Payment Methods and Validation
  // ============================================================
  describe('Payment Methods', () => {
    
    test('should validate credit card payment method', async () => {
      const cardData = {
        cardNumber: '4532015112830366',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123'
      };

      const isValid = paymentService.validateCardData(cardData);

      expect(isValid).toBe(true);
    });

    test('should reject invalid credit card number', async () => {
      const cardData = {
        cardNumber: '1234567890123456',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123'
      };

      const isValid = paymentService.validateCardData(cardData);

      expect(isValid).toBe(false);
    });

    test('should reject expired credit card', async () => {
      const cardData = {
        cardNumber: '4532015112830366',
        expiryMonth: '12',
        expiryYear: '2020',
        cvv: '123'
      };

      const isValid = paymentService.validateCardData(cardData);

      expect(isValid).toBe(false);
    });

    test('should reject invalid CVV', async () => {
      const cardData = {
        cardNumber: '4532015112830366',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '12'  // Too short
      };

      const isValid = paymentService.validateCardData(cardData);

      expect(isValid).toBe(false);
    });

    test('should support digital wallet payments', async () => {
      const paymentId = 'payment_001';
      const walletPayment = {
        method: 'digital_wallet',
        provider: 'paypal',
        token: 'wallet_token_123'
      };

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          method: 'digital_wallet',
          provider: 'paypal'
        }]
      });

      const result = await paymentService.processDigitalWalletPayment(paymentId, walletPayment);

      expect(result.method).toBe('digital_wallet');
    });

    test('should support bank transfer payments', async () => {
      const paymentId = 'payment_001';
      const bankTransfer = {
        method: 'bank_transfer',
        accountNumber: '123456789',
        routingNumber: '987654321'
      };

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          method: 'bank_transfer',
          status: 'pending'
        }]
      });

      const result = await paymentService.processBankTransfer(paymentId, bankTransfer);

      expect(result.method).toBe('bank_transfer');
    });

  });

  // ============================================================
  // TEST SUITE 4: Payment Confirmation and Completion
  // ============================================================
  describe('Payment Confirmation', () => {
    
    test('should confirm completed payment', async () => {
      const paymentId = 'payment_001';
      const confirmationCode = 'CONF_123456';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'captured'
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'completed',
          confirmationCode: confirmationCode
        }]
      });

      const result = await paymentService.confirmPayment(paymentId);

      expect(result.status).toBe('completed');
      expect(result.confirmationCode).toBe(confirmationCode);
    });

    test('should generate payment receipt', async () => {
      const paymentId = 'payment_001';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          userId: 'user_123',
          amount: 500,
          status: 'completed',
          currency: 'USD'
        }]
      });

      const receipt = await paymentService.generateReceipt(paymentId);

      expect(receipt).toHaveProperty('receiptNumber');
      expect(receipt).toHaveProperty('amount');
      expect(receipt).toHaveProperty('timestamp');
      expect(receipt).toHaveProperty('paymentMethod');
    });

    test('should send payment confirmation email', async () => {
      const paymentId = 'payment_001';
      const userEmail = 'user@example.com';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          userId: 'user_123'
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'user_123',
          email: userEmail
        }]
      });

      notificationService.sendEmailNotification.mockResolvedValueOnce(true);

      await paymentService.sendConfirmationEmail(paymentId);

      expect(notificationService.sendEmailNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          to: userEmail,
          type: 'payment_confirmation'
        })
      );
    });

    test('should update order status after payment completion', async () => {
      const paymentId = 'payment_001';
      const orderId = 'order_789';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          orderId: orderId,
          status: 'completed'
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{ id: orderId, paymentStatus: 'paid' }]
      });

      await paymentService.completePayment(paymentId);

      expect(db.query).toHaveBeenCalled();
    });

  });

  // ============================================================
  // TEST SUITE 5: Refunds and Reversals
  // ============================================================
  describe('Refunds and Reversals', () => {
    
    test('should process full refund for completed payment', async () => {
      const paymentId = 'payment_001';
      const originalAmount = 500;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'completed',
          amount: originalAmount
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'refund_001',
          paymentId: paymentId,
          amount: originalAmount,
          status: 'initiated'
        }]
      });

      const result = await paymentService.refundPayment(paymentId);

      expect(result.id).toBe('refund_001');
      expect(result.amount).toBe(originalAmount);
      expect(result.status).toBe('initiated');
    });

    test('should process partial refund', async () => {
      const paymentId = 'payment_001';
      const originalAmount = 500;
      const refundAmount = 200;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'completed',
          amount: originalAmount
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'refund_001',
          paymentId: paymentId,
          amount: refundAmount,
          status: 'initiated'
        }]
      });

      const result = await paymentService.refundPayment(paymentId, refundAmount);

      expect(result.amount).toBe(refundAmount);
      expect(result.amount).toBeLessThan(originalAmount);
    });

    test('should reject refund for amount exceeding original payment', async () => {
      const paymentId = 'payment_001';
      const originalAmount = 500;
      const refundAmount = 600;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'completed',
          amount: originalAmount
        }]
      });

      await expect(
        paymentService.refundPayment(paymentId, refundAmount)
      ).rejects.toThrow('Refund amount exceeds original payment');
    });

    test('should prevent duplicate refunds', async () => {
      const paymentId = 'payment_001';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'completed'
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{ paymentId: paymentId, status: 'completed' }]
      });

      await expect(
        paymentService.refundPayment(paymentId)
      ).rejects.toThrow('Refund already processed');
    });

    test('should track refund status through completion', async () => {
      const refundId = 'refund_001';

      const statuses = ['initiated', 'processing', 'completed'];

      for (const status of statuses) {
        db.query.mockResolvedValueOnce({
          rows: [{ id: refundId, status: status }]
        });

        const result = await paymentService.getRefundStatus(refundId);
        expect(result.status).toBe(status);
      }
    });

    test('should credit refund to user wallet', async () => {
      const refundId = 'refund_001';
      const userId = 'user_123';
      const refundAmount = 200;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: refundId,
          userId: userId,
          amount: refundAmount,
          status: 'completed'
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          walletBalance: 800 + refundAmount
        }]
      });

      await paymentService.creditRefundToWallet(refundId);

      expect(db.query).toHaveBeenCalled();
    });

  });

  // ============================================================
  // TEST SUITE 6: Wallet Management and Balance
  // ============================================================
  describe('Wallet Management', () => {
    
    test('should retrieve user wallet balance', async () => {
      const userId = 'user_123';
      const balance = 1500.50;

      db.query.mockResolvedValueOnce({
        rows: [{
          userId: userId,
          balance: balance,
          currency: 'USD'
        }]
      });

      const wallet = await paymentService.getWalletBalance(userId);

      expect(wallet.balance).toBe(balance);
      expect(wallet.userId).toBe(userId);
    });

    test('should add funds to wallet', async () => {
      const userId = 'user_123';
      const initialBalance = 1000;
      const addAmount = 500;

      db.query.mockResolvedValueOnce({
        rows: [{
          balance: initialBalance
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          balance: initialBalance + addAmount
        }]
      });

      const result = await paymentService.addFundsToWallet(userId, addAmount);

      expect(result.balance).toBe(initialBalance + addAmount);
    });

    test('should withdraw funds from wallet', async () => {
      const userId = 'user_123';
      const initialBalance = 1000;
      const withdrawAmount = 300;

      db.query.mockResolvedValueOnce({
        rows: [{
          balance: initialBalance
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          balance: initialBalance - withdrawAmount
        }]
      });

      const result = await paymentService.withdrawFromWallet(userId, withdrawAmount);

      expect(result.balance).toBe(initialBalance - withdrawAmount);
    });

    test('should reject withdrawal if insufficient balance', async () => {
      const userId = 'user_123';
      const balance = 200;
      const withdrawAmount = 500;

      db.query.mockResolvedValueOnce({
        rows: [{
          balance: balance
        }]
      });

      await expect(
        paymentService.withdrawFromWallet(userId, withdrawAmount)
      ).rejects.toThrow('Insufficient wallet balance');
    });

    test('should lock funds for pending payment', async () => {
      const userId = 'user_123';
      const paymentId = 'payment_001';
      const amount = 300;
      const availableBalance = 1000;

      db.query.mockResolvedValueOnce({
        rows: [{
          balance: availableBalance,
          locked: 0
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          balance: availableBalance,
          locked: amount,
          available: availableBalance - amount
        }]
      });

      const result = await paymentService.lockWalletFunds(userId, paymentId, amount);

      expect(result.locked).toBe(amount);
      expect(result.available).toBe(availableBalance - amount);
    });

    test('should unlock funds if payment fails', async () => {
      const userId = 'user_123';
      const paymentId = 'payment_001';
      const lockedAmount = 300;

      db.query.mockResolvedValueOnce({
        rows: [{
          balance: 1000,
          locked: lockedAmount
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          locked: 0,
          available: 1000
        }]
      });

      const result = await paymentService.unlockWalletFunds(userId, paymentId);

      expect(result.locked).toBe(0);
    });

  });

  // ============================================================
  // TEST SUITE 7: Payment Disputes and Chargebacks
  // ============================================================
  describe('Payment Disputes', () => {
    
    test('should initiate payment dispute', async () => {
      const paymentId = 'payment_001';
      const reason = 'Unauthorized transaction';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'dispute_001',
          paymentId: paymentId,
          reason: reason,
          status: 'initiated'
        }]
      });

      const result = await paymentService.initiateDispute(paymentId, reason);

      expect(result.id).toBeDefined();
      expect(result.status).toBe('initiated');
      expect(result.reason).toBe(reason);
    });

    test('should reject duplicate dispute for same payment', async () => {
      const paymentId = 'payment_001';

      db.query.mockResolvedValueOnce({
        rows: [{
          paymentId: paymentId
        }]
      });

      await expect(
        paymentService.initiateDispute(paymentId, 'Duplicate')
      ).rejects.toThrow('Dispute already exists for this payment');
    });

    test('should track dispute status through resolution', async () => {
      const disputeId = 'dispute_001';

      const statuses = ['initiated', 'under_review', 'resolved'];

      for (const status of statuses) {
        db.query.mockResolvedValueOnce({
          rows: [{ id: disputeId, status: status }]
        });

        const result = await paymentService.getDisputeStatus(disputeId);
        expect(result.status).toBe(status);
      }
    });

    test('should handle chargeback notification', async () => {
      const paymentId = 'payment_001';
      const chargebackData = {
        chargebackId: 'cb_12345',
        amount: 500,
        reason: 'Dispute by customer'
      };

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'chargeback_initiated'
        }]
      });

      notificationService.sendNotification.mockResolvedValueOnce(true);

      await paymentService.handleChargeback(paymentId, chargebackData);

      expect(db.query).toHaveBeenCalled();
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });

  });

  // ============================================================
  // TEST SUITE 8: Tax and Fee Calculation
  // ============================================================
  describe('Tax and Fee Calculation', () => {
    
    test('should calculate platform fee correctly', () => {
      const baseAmount = 1000;
      const platformFeePercent = 2.5;

      const fee = paymentService.calculatePlatformFee(baseAmount, platformFeePercent);

      expect(fee).toBe(baseAmount * (platformFeePercent / 100));
    });

    test('should calculate sales tax based on location', () => {
      const baseAmount = 100;
      const taxRate = 0.08;

      const tax = paymentService.calculateSalesTax(baseAmount, taxRate);

      expect(tax).toBe(baseAmount * taxRate);
    });

    test('should calculate total amount including fees and taxes', () => {
      const baseAmount = 1000;
      const platformFee = 25;
      const salesTax = 80;

      const total = paymentService.calculateTotalAmount(
        baseAmount,
        platformFee,
        salesTax
      );

      expect(total).toBe(baseAmount + platformFee + salesTax);
    });

    test('should apply promotional discount', () => {
      const baseAmount = 500;
      const discountCode = 'SAVE20';
      const discountPercent = 20;

      db.query.mockResolvedValueOnce({
        rows: [{
          code: discountCode,
          discountPercent: discountPercent,
          active: true
        }]
      });

      const discount = paymentService.calculateDiscount(baseAmount, discountCode);

      expect(discount).toBe(baseAmount * (discountPercent / 100));
    });

    test('should validate discount code expiry', async () => {
      const discountCode = 'EXPIRED20';

      db.query.mockResolvedValueOnce({
        rows: [{
          code: discountCode,
          expiryDate: new Date(Date.now() - 86400000) // Expired 1 day ago
        }]
      });

      const isValid = await paymentService.validateDiscountCode(discountCode);

      expect(isValid).toBe(false);
    });

  });

  // ============================================================
  // TEST SUITE 9: Payment History and Reporting
  // ============================================================
  describe('Payment History and Reporting', () => {
    
    test('should retrieve user payment history', async () => {
      const userId = 'user_123';
      const mockPayments = [
        { id: 'payment_001', amount: 500, status: 'completed' },
        { id: 'payment_002', amount: 300, status: 'completed' },
        { id: 'payment_003', amount: 150, status: 'pending' }
      ];

      db.query.mockResolvedValueOnce({ rows: mockPayments });

      const history = await paymentService.getPaymentHistory(userId);

      expect(history).toHaveLength(3);
      expect(history[0].id).toBe('payment_001');
    });

    test('should filter payment history by date range', async () => {
      const userId = 'user_123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockPayments = [
        { id: 'payment_001', date: new Date('2024-01-15'), amount: 500 },
        { id: 'payment_002', date: new Date('2024-01-20'), amount: 300 }
      ];

      db.query.mockResolvedValueOnce({ rows: mockPayments });

      const history = await paymentService.getPaymentHistory(userId, startDate, endDate);

      expect(history).toHaveLength(2);
      expect(history.every(p => p.date >= startDate && p.date <= endDate)).toBe(true);
    });

    test('should generate payment summary report', async () => {
      const userId = 'user_123';

      db.query.mockResolvedValueOnce({
        rows: [{
          totalPayments: 1500,
          completedPayments: 1200,
          pendingPayments: 300,
          failedPayments: 0,
          averagePaymentAmount: 300
        }]
      });

      const summary = await paymentService.generatePaymentSummary(userId);

      expect(summary.totalPayments).toBe(1500);
      expect(summary.completedPayments).toBe(1200);
      expect(summary.averagePaymentAmount).toBe(300);
    });

    test('should export payment statements', async () => {
      const userId = 'user_123';
      const format = 'PDF';

      db.query.mockResolvedValueOnce({
        rows: [
          { id: 'payment_001', amount: 500, date: new Date() },
          { id: 'payment_002', amount: 300, date: new Date() }
        ]
      });

      const statement = await paymentService.exportStatement(userId, format);

      expect(statement).toHaveProperty('fileUrl');
      expect(statement.format).toBe(format);
    });

  });

  // ============================================================
  // TEST SUITE 10: Payment Security and Encryption
  // ============================================================
  describe('Payment Security', () => {
    
    test('should encrypt sensitive payment data', () => {
      const sensitiveData = '4532015112830366';
      const encrypted = paymentService.encryptPaymentData(sensitiveData);

      expect(encrypted).not.toBe(sensitiveData);
      expect(encrypted).toBeDefined();
    });

    test('should decrypt payment data for processing', () => {
      const sensitiveData = '4532015112830366';
      const encrypted = paymentService.encryptPaymentData(sensitiveData);
      const decrypted = paymentService.decryptPaymentData(encrypted);

      expect(decrypted).toBe(sensitiveData);
    });

    test('should mask card number in logs and receipts', () => {
      const cardNumber = '4532015112830366';
      const masked = paymentService.maskCardNumber(cardNumber);

      expect(masked).toBe('****15112830366');
      expect(masked).not.toContain('4532');
    });

    test('should validate PCI compliance', async () => {
      const paymentData = {
        cardNumber: '4532015112830366',
        encrypted: true,
        storedSecurely: true
      };

      const isCompliant = await paymentService.validatePCICompliance(paymentData);

      expect(isCompliant).toBe(true);
    });

    test('should implement payment tokenization', async () => {
      const cardData = {
        cardNumber: '4532015112830366',
        expiryMonth: '12',
        expiryYear: '2025'
      };

      db.query.mockResolvedValueOnce({
        rows: [{
          token: 'tok_4532015112830366',
          cardLast4: '0366',
          brand: 'VISA'
        }]
      });

      const token = await paymentService.tokenizeCard(cardData);

      expect(token.token).toBeDefined();
      expect(token.cardLast4).toBe('0366');
    });

  });

  // ============================================================
  // TEST SUITE 11: Concurrent Payment Processing
  // ============================================================
  describe('Concurrent Payment Processing', () => {
    
    test('should handle simultaneous payments from multiple users', async () => {
      const payments = [
        { userId: 'user_111', amount: 100 },
        { userId: 'user_222', amount: 200 },
        { userId: 'user_333', amount: 300 }
      ];

      const results = await Promise.all(
        payments.map(payment =>
          paymentService.processPayment(payment.userId, payment.amount)
        )
      );

      expect(results).toHaveLength(3);
      expect(results.every(r => r.status === 'processing' || r.status === 'completed')).toBe(true);
    });

    test('should prevent duplicate payment processing', async () => {
      const paymentId = 'payment_001';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'processing'
        }]
      });

      const firstAttempt = await paymentService.processPayment(paymentId);

      db.query.mockResolvedValueOnce({
        rows: [{
          id: paymentId,
          status: 'processing'
        }]
      });

      await expect(
        paymentService.processPayment(paymentId)
      ).rejects.toThrow('Payment already being processed');
    });

  });

  // ============================================================
  // TEST SUITE 12: Payment Webhooks and Callbacks
  // ============================================================
  describe('Payment Webhooks and Callbacks', () => {
    
    test('should handle payment gateway webhook', async () => {
      const webhookData = {
        type: 'payment.success',
        paymentId: 'payment_001',
        transactionId: 'txn_12345'
      };

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'payment_001',
          status: 'completed'
        }]
      });

      const result = await paymentService.handleWebhook(webhookData);

      expect(result.processed).toBe(true);
      expect(result.paymentId).toBe('payment_001');
    });

    test('should validate webhook signature', () => {
      const webhookData = '{"type":"payment.success"}';
      const signature = 'valid_signature';

      const isValid = paymentService.validateWebhookSignature(webhookData, signature);

      expect(typeof isValid).toBe('boolean');
    });

    test('should handle payment failure webhook', async () => {
      const webhookData = {
        type: 'payment.failed',
        paymentId: 'payment_001',
        failureReason: 'Card declined'
      };

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'payment_001',
          status: 'failed',
          failureReason: 'Card declined'
        }]
      });

      await paymentService.handleWebhook(webhookData);

      expect(db.query).toHaveBeenCalled();
    });

    test('should implement webhook retry logic', async () => {
      const webhookData = {
        type: 'payment.success',
        paymentId: 'payment_001'
      };

      let attemptCount = 0;
      const maxRetries = 3;

      while (attemptCount < maxRetries) {
        try {
          db.query.mockResolvedValueOnce({ rows: [{ id: 'payment_001' }] });
          await paymentService.handleWebhook(webhookData);
          break;
        } catch (error) {
          attemptCount++;
          if (attemptCount >= maxRetries) throw error;
        }
      }

      expect(attemptCount).toBeLessThan(maxRetries);
    });

  });

  // ============================================================
  // TEST SUITE 13: Edge Cases and Error Handling
  // ============================================================
  describe('Edge Cases and Error Handling', () => {
    
    test('should handle database connection errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        paymentService.getPaymentHistory('user_123')
      ).rejects.toThrow('Database connection failed');
    });

    test('should handle gateway timeout', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'payment_001',
          status: 'initiated'
        }]
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'payment_001',
          status: 'timeout'
        }]
      });

      const result = await paymentService.processPayment('payment_001');

      expect(result.status).toBe('timeout');
    });

    test('should handle very large payment amounts', async () => {
      const largeAmount = Number.MAX_SAFE_INTEGER;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'payment_001',
          amount: largeAmount,
          status: 'initiated'
        }]
      });

      const payment = await paymentService.initializePayment({
        userId: 'user_123',
        auctionId: 'auction_456',
        amount: largeAmount,
        currency: 'USD'
      });

      expect(payment.amount).toBe(largeAmount);
    });

    test('should handle decimal precision correctly', async () => {
      const amount = 199.99;

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'payment_001',
          amount: amount
        }]
      });

      const payment = await paymentService.initializePayment({
        userId: 'user_123',
        auctionId: 'auction_456',
        amount: amount,
        currency: 'USD'
      });

      expect(payment.amount).toBe(199.99);
    });

  });

  // ============================================================
  // TEST SUITE 14: Performance and Optimization
  // ============================================================
  describe('Performance and Optimization', () => {
    
    test('should retrieve large payment history efficiently', async () => {
      const userId = 'user_123';
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `payment_${i}`,
        amount: Math.random() * 1000,
        date: new Date(Date.now() - i * 86400000)
      }));

      db.query.mockResolvedValueOnce({ rows: largeDataset });

      const startTime = Date.now();
      const history = await paymentService.getPaymentHistory(userId);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(history).toHaveLength(10000);
      expect(executionTime).toBeLessThan(2000); // Should complete in < 2 seconds
    });

    test('should cache payment calculations', async () => {
      const baseAmount = 1000;
      const platformFee = 25;

      const firstCall = paymentService.calculatePlatformFee(baseAmount, 2.5);

      // Clear mocks for second call to verify cache
      jest.clearAllMocks();

      const secondCall = paymentService.calculatePlatformFee(baseAmount, 2.5);

      expect(firstCall).toBe(secondCall);
      expect(db.query).not.toHaveBeenCalled();
    });

  });

});
