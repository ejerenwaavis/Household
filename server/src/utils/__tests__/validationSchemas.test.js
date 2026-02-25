/**
 * Validation Schemas Tests
 * Tests for Joi validation schemas
 */

const { authSchemas, validateBody, creditCardSchemas, cardStatementSchemas } = require('../../src/utils/validationSchemas');

describe('Auth Schemas Validation', () => {
  describe('Register Schema', () => {
    it('should validate correct registration data', () => {
      const validData = {
        email: 'user@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
        householdName: 'Test Household'
      };

      const { error } = authSchemas.register.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        name: 'John Doe',
        householdName: 'Test Household'
      };

      const { error } = authSchemas.register.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.message).toContain('email');
    });

    it('should reject weak password', () => {
      const invalidData = {
        email: 'user@example.com',
        password: 'weak',
        name: 'John Doe',
        householdName: 'Test Household'
      };

      const { error } = authSchemas.register.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should reject missing required fields', () => {
      const incompleteData = {
        email: 'user@example.com',
        password: 'SecurePass123!'
        // Missing name and householdName
      };

      const { error } = authSchemas.register.validate(incompleteData);
      expect(error).toBeDefined();
    });
  });

  describe('Login Schema', () => {
    it('should validate correct login data', () => {
      const validData = {
        email: 'user@example.com',
        password: 'YourPassword123'
      };

      const { error } = authSchemas.login.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should require email', () => {
      const invalidData = {
        password: 'YourPassword123'
      };

      const { error } = authSchemas.login.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should require password', () => {
      const invalidData = {
        email: 'user@example.com'
      };

      const { error } = authSchemas.login.validate(invalidData);
      expect(error).toBeDefined();
    });
  });

  describe('Refresh Token Schema', () => {
    it('should validate refresh token', () => {
      const validData = {
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      };

      const { error } = authSchemas.refresh.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject missing refresh token', () => {
      const invalidData = {};

      const { error } = authSchemas.refresh.validate(invalidData);
      expect(error).toBeDefined();
    });
  });
});

describe('Credit Card Schemas Validation', () => {
  describe('Create Card Schema', () => {
    it('should validate correct card data', () => {
      const validData = {
        cardholderName: 'John Doe',
        cardNumber: '4532015112830366',
        expiryDate: '12/25',
        cvv: '123',
        limit: 5000,
        interestRate: 18.5,
        isActive: true
      };

      const { error } = creditCardSchemas.create.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid card number', () => {
      const invalidData = {
        cardholderName: 'John Doe',
        cardNumber: '1234',
        expiryDate: '12/25',
        cvv: '123',
        limit: 5000,
        interestRate: 18.5
      };

      const { error } = creditCardSchemas.create.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should reject invalid expiry date format', () => {
      const invalidData = {
        cardholderName: 'John Doe',
        cardNumber: '4532015112830366',
        expiryDate: '2025-12',
        cvv: '123',
        limit: 5000,
        interestRate: 18.5
      };

      const { error } = creditCardSchemas.create.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should reject invalid CVV', () => {
      const invalidData = {
        cardholderName: 'John Doe',
        cardNumber: '4532015112830366',
        expiryDate: '12/25',
        cvv: 'abc',
        limit: 5000,
        interestRate: 18.5
      };

      const { error } = creditCardSchemas.create.validate(invalidData);
      expect(error).toBeDefined();
    });
  });
});

describe('Card Statement Schemas Validation', () => {
  describe('Create Statement Schema', () => {
    it('should validate correct statement data', () => {
      const validData = {
        cardId: '507f1f77bcf86cd799439011',
        statementDate: '2026-02-24',
        openingBalance: 1000,
        purchases: 500,
        payments: 200,
        fees: 10,
        interest: 15,
        closingBalance: 1325,
        dueDate: '2026-03-23',
        notes: 'February statement'
      };

      const { error } = cardStatementSchemas.create.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid card ID', () => {
      const invalidData = {
        cardId: 'invalid-id',
        statementDate: '2026-02-24',
        openingBalance: 1000,
        closingBalance: 1325
      };

      const { error } = cardStatementSchemas.create.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should reject invalid date', () => {
      const invalidData = {
        cardId: '507f1f77bcf86cd799439011',
        statementDate: '2026-13-45',
        openingBalance: 1000,
        closingBalance: 1325
      };

      const { error } = cardStatementSchemas.create.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should allow optional fields to be omitted', () => {
      const validData = {
        cardId: '507f1f77bcf86cd799439011',
        statementDate: '2026-02-24',
        openingBalance: 1000,
        closingBalance: 1325
      };

      const { error } = cardStatementSchemas.create.validate(validData);
      expect(error).toBeUndefined();
    });
  });
});
