/**
 * Validation Service Tests
 * Tests validators and form validation logic
 */

import { validators, validateForm, validateField, validationSchemas } from '../services/validationService';

describe('Validators', () => {
  describe('email', () => {
    test('should accept valid email', () => {
      expect(validators.email('test@example.com')).toBeNull();
    });

    test('should reject invalid email', () => {
      expect(validators.email('invalid-email')).toBe('Invalid email format');
    });

    test('should reject empty email', () => {
      expect(validators.email('')).toBe('Email is required');
    });
  });

  describe('password', () => {
    test('should accept valid password', () => {
      expect(validators.password('ValidPass123')).toBeNull();
    });

    test('should reject short password', () => {
      expect(validators.password('Pass1')).toBe('Password must be at least 8 characters');
    });

    test('should reject password without uppercase', () => {
      expect(validators.password('validpass123')).toBe('Password must contain uppercase letter');
    });

    test('should reject password without lowercase', () => {
      expect(validators.password('VALIDPASS123')).toBe('Password must contain lowercase letter');
    });

    test('should reject password without digit', () => {
      expect(validators.password('ValidPass')).toBe('Password must contain digit');
    });
  });

  describe('amount', () => {
    test('should accept valid amount', () => {
      expect(validators.amount('100.50')).toBeNull();
    });

    test('should reject zero amount', () => {
      expect(validators.amount('0')).toBe('Amount must be greater than 0');
    });

    test('should reject negative amount', () => {
      expect(validators.amount('-50')).toBe('Amount must be greater than 0');
    });

    test('should reject non-numeric amount', () => {
      expect(validators.amount('abc')).toBe('Amount must be a valid number');
    });

    test('should reject empty amount', () => {
      expect(validators.amount('')).toBe('Amount is required');
    });

    test('should reject excessive amount', () => {
      expect(validators.amount('9999999999')).toBe('Amount exceeds maximum');
    });
  });

  describe('percentage', () => {
    test('should accept valid percentage', () => {
      expect(validators.percentage('50')).toBeNull();
      expect(validators.percentage('0')).toBeNull();
      expect(validators.percentage('100')).toBeNull();
    });

    test('should reject percentage > 100', () => {
      expect(validators.percentage('101')).toBe('Percentage must be between 0 and 100');
    });

    test('should reject negative percentage', () => {
      expect(validators.percentage('-1')).toBe('Percentage must be between 0 and 100');
    });

    test('should reject non-numeric percentage', () => {
      expect(validators.percentage('abc')).toBe('Percentage must be a valid number');
    });
  });

  describe('creditCardNumber', () => {
    test('should accept valid card number', () => {
      expect(validators.creditCardNumber('4532015112830366')).toBeNull();
    });

    test('should accept card number with spaces', () => {
      expect(validators.creditCardNumber('4532 0151 1283 0366')).toBeNull();
    });

    test('should reject short card number', () => {
      expect(validators.creditCardNumber('123')).toContain('Invalid card number');
    });

    test('should reject empty card number', () => {
      expect(validators.creditCardNumber('')).toBe('Card number is required');
    });
  });

  describe('cardExpiry', () => {
    test('should accept valid expiry date', () => {
      const futureYear = (new Date().getFullYear() + 1).toString().slice(-2);
      expect(validators.cardExpiry(`12/${futureYear}`)).toBeNull();
    });

    test('should reject invalid format', () => {
      expect(validators.cardExpiry('12-25')).toContain('MM/YY format');
    });

    test('should reject expired card', () => {
      expect(validators.cardExpiry('01/20')).toBe('Card has expired');
    });

    test('should reject invalid month', () => {
      expect(validators.cardExpiry('13/25')).toContain('MM/YY format');
    });
  });

  describe('date', () => {
    test('should accept valid date', () => {
      expect(validators.date('2024-12-25')).toBeNull();
    });

    test('should reject invalid date', () => {
      expect(validators.date('invalid')).toBe('Invalid date');
    });

    test('should reject empty date', () => {
      expect(validators.date('')).toBe('Date is required');
    });
  });

  describe('minLength', () => {
    test('should accept string longer than min length', () => {
      expect(validators.minLength(3)('hello')).toBeNull();
    });

    test('should reject string shorter than min length', () => {
      expect(validators.minLength(5)('hi')).toBe('Must be at least 5 characters');
    });
  });

  describe('maxLength', () => {
    test('should accept string shorter than max length', () => {
      expect(validators.maxLength(10)('hello')).toBeNull();
    });

    test('should reject string longer than max length', () => {
      expect(validators.maxLength(3)('hello')).toBe('Must not exceed 3 characters');
    });
  });

  describe('match', () => {
    test('should accept matching values', () => {
      expect(validators.match('password', 'password', 'Password')).toBeNull();
    });

    test('should reject non-matching values', () => {
      expect(validators.match('password1', 'password2', 'Password')).toBe(
        'Password does not match'
      );
    });
  });
});

describe('validateForm', () => {
  test('should validate form with no errors', () => {
    const formData = {
      email: 'test@example.com',
      password: 'ValidPass123'
    };

    const schema = {
      email: validators.email,
      password: validators.password
    };

    const errors = validateForm(formData, schema);
    expect(errors).toEqual({});
  });

  test('should collect all form errors', () => {
    const formData = {
      email: 'invalid-email',
      password: 'weak'
    };

    const schema = {
      email: validators.email,
      password: validators.password
    };

    const errors = validateForm(formData, schema);
    expect(Object.keys(errors).length).toBeGreaterThan(0);
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
  });

  test('should handle multiple validators per field', () => {
    const formData = {
      password: 'pass'
    };

    const schema = {
      password: [validators.required, validators.minLength(8)]
    };

    const errors = validateForm(formData, schema);
    expect(errors.password).toBeDefined();
  });
});

describe('validateField', () => {
  test('should validate single field', () => {
    const error = validateField('email', 'invalid', validators.email);
    expect(error).toBeDefined();
  });

  test('should return null for valid field', () => {
    const error = validateField('email', 'test@example.com', validators.email);
    expect(error).toBeNull();
  });

  test('should handle multiple validators', () => {
    const error = validateField('password', 'weak', [
      validators.required,
      validators.minLength(8)
    ]);
    expect(error).toBeDefined();
  });
});

describe('validationSchemas', () => {
  test('should have login schema', () => {
    expect(validationSchemas.login).toBeDefined();
    expect(validationSchemas.login.email).toBeDefined();
    expect(validationSchemas.login.password).toBeDefined();
  });

  test('should have register schema', () => {
    expect(validationSchemas.register).toBeDefined();
    expect(validationSchemas.register.email).toBeDefined();
    expect(validationSchemas.register.password).toBeDefined();
    expect(validationSchemas.register.firstName).toBeDefined();
    expect(validationSchemas.register.lastName).toBeDefined();
  });

  test('should have income schema', () => {
    expect(validationSchemas.income).toBeDefined();
    expect(validationSchemas.income.amount).toBeDefined();
    expect(validationSchemas.income.description).toBeDefined();
  });

  test('should have expense schema', () => {
    expect(validationSchemas.expense).toBeDefined();
    expect(validationSchemas.expense.amount).toBeDefined();
    expect(validationSchemas.expense.category).toBeDefined();
  });
});
