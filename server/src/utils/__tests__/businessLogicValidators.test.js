/**
 * Business Logic Validators Tests
 * Tests for financial constraint validation
 */

const {
  validateCardStatement,
  validateDebtPayment,
  validateAmount,
  validateDateRange,
  validateCreditCard
} = require('../../utils/businessLogicValidators');

describe('Card Statement Business Logic Validation', () => {
  const mockCard = {
    limit: 5000,
    interestRate: 18.5
  };

  describe('Balance Formula Validation', () => {
    it('should validate correct balance formula', async () => {
      const statement = {
        openingBalance: 1000,
        purchases: 500,
        payments: 200,
        fees: 10,
        interest: 15,
        closingBalance: 1325 // 1000 + 500 + 15 + 10 - 200
      };

      const result = await validateCardStatement(statement, mockCard, null);
      expect(result.valid).toBe(true);
    });

    it('should reject incorrect balance formula', async () => {
      const statement = {
        openingBalance: 1000,
        purchases: 500,
        payments: 200,
        fees: 10,
        interest: 15,
        closingBalance: 2000 // Wrong amount
      };

      const result = await validateCardStatement(statement, mockCard, null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Closing balance'));
    });
  });

  describe('Credit Limit Validation', () => {
    it('should reject closing balance exceeding limit', async () => {
      const statement = {
        openingBalance: 1000,
        purchases: 4500,
        payments: 0,
        fees: 0,
        interest: 0,
        closingBalance: 5500 // Exceeds 5000 limit
      };

      const result = await validateCardStatement(statement, mockCard, null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('exceeds credit limit'));
    });

    it('should allow closing balance at or below limit', async () => {
      const statement = {
        openingBalance: 1000,
        purchases: 3000,
        payments: 0,
        fees: 0,
        interest: 0,
        closingBalance: 4000
      };

      const result = await validateCardStatement(statement, mockCard, null);
      expect(result.valid).toBe(true);
    });
  });

  describe('Negative Amount Validation', () => {
    it('should reject negative closing balance', async () => {
      const statement = {
        openingBalance: 100,
        purchases: 0,
        payments: 500,
        fees: 0,
        interest: 0,
        closingBalance: -400
      };

      const result = await validateCardStatement(statement, mockCard, null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('negative'));
    });

    it('should reject negative purchases', async () => {
      const statement = {
        openingBalance: 1000,
        purchases: -500,
        payments: 0,
        fees: 0,
        interest: 0,
        closingBalance: 500
      };

      const result = await validateCardStatement(statement, mockCard, null);
      expect(result.valid).toBe(false);
    });
  });

  describe('Previous Statement Validation', () => {
    it('should validate opening balance matches previous closing', async () => {
      const previousStatement = {
        closingBalance: 1000
      };

      const statement = {
        openingBalance: 1000,
        purchases: 500,
        payments: 200,
        fees: 10,
        interest: 15,
        closingBalance: 1325
      };

      const result = await validateCardStatement(statement, mockCard, previousStatement);
      expect(result.valid).toBe(true);
    });

    it('should reject mismatched opening balance', async () => {
      const previousStatement = {
        closingBalance: 1000
      };

      const statement = {
        openingBalance: 2000, // Doesn't match previous closing
        purchases: 500,
        payments: 200,
        fees: 10,
        interest: 15,
        closingBalance: 2325
      };

      const result = await validateCardStatement(statement, mockCard, previousStatement);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('must match'));
    });
  });
});

describe('Debt Payment Business Logic Validation', () => {
  const mockStatement = {
    closingBalance: 1000,
    statementDate: '2026-02-01'
  };

  describe('Payment Amount Validation', () => {
    it('should reject zero payment', async () => {
      const payment = {
        amount: 0,
        paymentDate: '2026-02-24',
        paymentMethod: 'cash'
      };

      const result = await validateDebtPayment(payment, null, mockStatement);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('greater than 0'));
    });

    it('should reject payment exceeding balance', async () => {
      const payment = {
        amount: 1500,
        paymentDate: '2026-02-24',
        paymentMethod: 'cash'
      };

      const result = await validateDebtPayment(payment, null, mockStatement);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('cannot exceed'));
    });

    it('should allow payment within balance', async () => {
      const payment = {
        amount: 500,
        paymentDate: '2026-02-24',
        paymentMethod: 'cash'
      };

      const result = await validateDebtPayment(payment, null, mockStatement);
      expect(result.valid).toBe(true);
    });
  });

  describe('Payment Date Validation', () => {
    it('should reject payment before statement date', async () => {
      const payment = {
        amount: 500,
        paymentDate: '2026-01-01',
        paymentMethod: 'cash'
      };

      const result = await validateDebtPayment(payment, null, mockStatement);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('cannot be before statement date'));
    });

    it('should allow payment on or after statement date', async () => {
      const payment = {
        amount: 500,
        paymentDate: '2026-02-01',
        paymentMethod: 'cash'
      };

      const result = await validateDebtPayment(payment, null, mockStatement);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Amount Validation', () => {
  it('should accept valid amount', () => {
    const result = validateAmount(150.50);
    expect(result.valid).toBe(true);
  });

  it('should reject negative amount', () => {
    const result = validateAmount(-50);
    expect(result.valid).toBe(false);
  });

  it('should reject amount exceeding max', () => {
    const result = validateAmount(1000000000);
    expect(result.valid).toBe(false);
  });

  it('should reject amount with excessive decimals', () => {
    const result = validateAmount(150.555);
    expect(result.valid).toBe(false);
  });
});

describe('Date Range Validation', () => {
  it('should accept valid date range', () => {
    const result = validateDateRange('2026-01-01', '2026-02-01');
    expect(result.valid).toBe(true);
  });

  it('should reject reversed date range', () => {
    const result = validateDateRange('2026-02-01', '2026-01-01');
    expect(result.valid).toBe(false);
  });

  it('should reject range exceeding max days', () => {
    const result = validateDateRange('2025-01-01', '2027-01-01', 30);
    expect(result.valid).toBe(false);
  });
});

describe('Credit Card Validation', () => {
  it('should accept valid card', () => {
    const card = {
      limit: 5000,
      interestRate: 18.5,
      expiryDate: '12/28',
      cvv: '123',
      cardNumber: '4532015112830366'
    };

    const result = validateCreditCard(card);
    expect(result.valid).toBe(true);
  });

  it('should reject zero or negative limit', () => {
    const card = {
      limit: 0,
      interestRate: 18.5,
      expiryDate: '12/28',
      cvv: '123',
      cardNumber: '4532015112830366'
    };

    const result = validateCreditCard(card);
    expect(result.valid).toBe(false);
  });

  it('should reject invalid interest rate', () => {
    const card = {
      limit: 5000,
      interestRate: 150, // Exceeds 100%
      expiryDate: '12/28',
      cvv: '123',
      cardNumber: '4532015112830366'
    };

    const result = validateCreditCard(card);
    expect(result.valid).toBe(false);
  });
});
