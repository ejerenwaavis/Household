/**
 * Validation Service Tests
 * Tests for frontend validation utilities
 */

import { validators, getPasswordStrength, formatCurrency, parseCurrency } from '../../services/validationService';

describe('Email Validation', () => {
  it('should validate correct email', () => {
    const result = validators.email('user@example.com');
    expect(result).toBeNull();
  });

  it('should reject invalid email', () => {
    const result = validators.email('invalid-email');
    expect(result).not.toBeNull();
  });

  it('should reject empty email', () => {
    const result = validators.email('');
    expect(result).not.toBeNull();
  });
});

describe('Password Validation', () => {
  it('should validate strong password', () => {
    const result = validators.password('SecurePass123!');
    expect(result).toBeNull();
  });

  it('should reject short password', () => {
    const result = validators.password('Pass1!');
    expect(result).not.toBeNull();
  });

  it('should reject password without uppercase', () => {
    const result = validators.password('securepass123!');
    expect(result).not.toBeNull();
  });

  it('should reject password without lowercase', () => {
    const result = validators.password('SECUREPASS123!');
    expect(result).not.toBeNull();
  });

  it('should reject password without number', () => {
    const result = validators.password('SecurePass!abc');
    expect(result).not.toBeNull();
  });

  it('should reject password without special character', () => {
    const result = validators.password('SecurePass123');
    expect(result).not.toBeNull();
  });
});

describe('Password Strength', () => {
  it('should rate weak password', () => {
    const strength = getPasswordStrength('Pass1!');
    expect(strength.label).toBe('Weak');
  });

  it('should rate fair password', () => {
    const strength = getPasswordStrength('Password123!');
    expect(strength.label).toMatch(/Fair|Good/);
  });

  it('should rate strong password', () => {
    const strength = getPasswordStrength('VerySecurePassword123!@#');
    expect(strength.label).toBe('Strong');
  });

  it('should return None for empty password', () => {
    const strength = getPasswordStrength('');
    expect(strength.label).toBe('None');
  });
});

describe('Amount Validation', () => {
  it('should validate positive amount', () => {
    const result = validators.amount('150.50');
    expect(result).toBeNull();
  });

  it('should reject zero amount', () => {
    const result = validators.amount('0');
    expect(result).not.toBeNull();
  });

  it('should reject negative amount', () => {
    const result = validators.amount('-50');
    expect(result).not.toBeNull();
  });

  it('should reject non-numeric amount', () => {
    const result = validators.amount('abc');
    expect(result).not. toBeNull();
  });

  it('should reject excessive decimals', () => {
    const result = validators.amount('150.555');
    expect(result).not.toBeNull();
  });
});

describe('Date Validation', () => {
  it('should validate valid date', () => {
    const result = validators.date('2026-02-24');
    expect(result).toBeNull();
  });

  it('should reject invalid date', () => {
    const result = validators.date('2026-13-45');
    expect(result).not.toBeNull();
  });

  it('should reject empty date', () => {
    const result = validators.date('');
    expect(result).not.toBeNull();
  });
});

describe('Credit Card Validation', () => {
  it('should validate correct card number', () => {
    const result = validators.creditCardNumber('4532015112830366');
    expect(result).toBeNull();
  });

  it('should reject short card number', () => {
    const result = validators.creditCardNumber('1234');
    expect(result).not.toBeNull();
  });

  it('should accept card with spaces', () => {
    const result = validators.creditCardNumber('4532 0151 1283 0366');
    expect(result).toBeNull();
  });
});

describe('Currency Formatting', () => {
  it('should format amount as currency', () => {
    const formatted = formatCurrency(1234.56);
    expect(formatted).toContain('1,234.56');
  });

  it('should format zero', () => {
    const formatted = formatCurrency(0);
    expect(formatted).toContain('0.00');
  });

  it('should handle empty value', () => {
    const formatted = formatCurrency(null);
    expect(formatted).toBe('');
  });
});

describe('Currency Parsing', () => {
  it('should parse formatted currency', () => {
    const parsed = parseCurrency('$1,234.56');
    expect(parsed).toBe(1234.56);
  });

  it('should parse plain number', () => {
    const parsed = parseCurrency('1234.56');
    expect(parsed).toBe(1234.56);
  });

  it('should handle empty value', () => {
    const parsed = parseCurrency('');
    expect(parsed).toBe(0);
  });
});

describe('Required Field Validation', () => {
  it('should accept non-empty value', () => {
    const result = validators.required('some value');
    expect(result).toBeNull();
  });

  it('should reject empty string', () => {
    const result = validators.required('');
    expect(result).not.toBeNull();
  });

  it('should reject null', () => {
    const result = validators.required(null);
    expect(result).not.toBeNull();
  });

  it('should reject whitespace only', () => {
    const result = validators.required('   ');
    expect(result).not.toBeNull();
  });
});

describe('Min/Max Length Validation', () => {
  it('should validate within length bounds', () => {
    const minResult = validators.minLength(2)('hello');
    const maxResult = validators.maxLength(10)('hello');
    expect(minResult).toBeNull();
    expect(maxResult).toBeNull();
  });

  it('should reject too short', () => {
    const result = validators.minLength(5)('hi');
    expect(result).not.toBeNull();
  });

  it('should reject too long', () => {
    const result = validators.maxLength(5)('toolong');
    expect(result).not.toBeNull();
  });
});
