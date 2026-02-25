/**
 * Form Validation Utilities
 * Provides reusable validation functions for the application
 */

export const validators = {
  /**
   * Email validation
   */
  email: (value) => {
    if (!value) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return 'Invalid email format';
    return null;
  },

  /**
   * Password validation
   */
  password: (value) => {
    if (!value) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(value)) return 'Password must contain uppercase letter';
    if (!/[a-z]/.test(value)) return 'Password must contain lowercase letter';
    if (!/[0-9]/.test(value)) return 'Password must contain digit';
    return null;
  },

  /**
   * Name validation
   */
  name: (value) => {
    if (!value) return 'Name is required';
    if (value.trim().length < 2) return 'Name must be at least 2 characters';
    if (value.trim().length > 100) return 'Name must not exceed 100 characters';
    return null;
  },

  /**
   * Currency amount validation
   */
  amount: (value) => {
    if (value === '' || value === null || value === undefined) return 'Amount is required';
    const num = parseFloat(value);
    if (isNaN(num)) return 'Amount must be a valid number';
    if (num <= 0) return 'Amount must be greater than 0';
    if (num > 999999999) return 'Amount exceeds maximum';
    return null;
  },

  /**
   * Percentage validation (0-100)
   */
  percentage: (value) => {
    if (value === '' || value === null || value === undefined) return 'Percentage is required';
    const num = parseFloat(value);
    if (isNaN(num)) return 'Percentage must be a valid number';
    if (num < 0 || num > 100) return 'Percentage must be between 0 and 100';
    return null;
  },

  /**
   * Credit card validation (basic)
   */
  creditCardNumber: (value) => {
    if (!value) return 'Card number is required';
    const sanitized = value.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(sanitized)) return 'Invalid card number';
    return null;
  },

  /**
   * Credit card expiry validation (MM/YY format)
   */
  cardExpiry: (value) => {
    if (!value) return 'Expiry date is required';
    const regex = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (!regex.test(value)) return 'Expiry must be MM/YY format';
    
    const [month, year] = value.split('/');
    const currentYear = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;
    
    const expYear = parseInt(year);
    const expMonth = parseInt(month);
    
    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      return 'Card has expired';
    }
    return null;
  },

  /**
   * Credit card CVV validation
   */
  cardCvv: (value) => {
    if (!value) return 'CVV is required';
    if (!/^\d{3,4}$/.test(value)) return 'CVV must be 3 or 4 digits';
    return null;
  },

  /**
   * Date validation
   */
  date: (value) => {
    if (!value) return 'Date is required';
    const date = new Date(value);
    if (isNaN(date.getTime())) return 'Invalid date';
    return null;
  },

  /**
   * URL validation
   */
  url: (value) => {
    if (!value) return 'URL is required';
    try {
      new URL(value);
      return null;
    } catch {
      return 'Invalid URL format';
    }
  },

  /**
   * Required field validation
   */
  required: (value) => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return 'This field is required';
    }
    return null;
  },

  /**
   * Min length validation
   */
  minLength: (minLen) => (value) => {
    if (!value) return null;
    if (value.length < minLen) return `Must be at least ${minLen} characters`;
    return null;
  },

  /**
   * Max length validation
   */
  maxLength: (maxLen) => (value) => {
    if (!value) return null;
    if (value.length > maxLen) return `Must not exceed ${maxLen} characters`;
    return null;
  },

  /**
   * Min value validation
   */
  minValue: (minVal) => (value) => {
    if (!value) return null;
    const num = parseFloat(value);
    if (num < minVal) return `Must be at least ${minVal}`;
    return null;
  },

  /**
   * Max value validation
   */
  maxValue: (maxVal) => (value) => {
    if (!value) return null;
    const num = parseFloat(value);
    if (num > maxVal) return `Must not exceed ${maxVal}`;
    return null;
  },

  /**
   * Match validation (e.g., password confirmation)
   */
  match: (fieldValue, matchValue, fieldName) => {
    if (fieldValue !== matchValue) return `${fieldName} does not match`;
    return null;
  },

  /**
   * Phone number validation
   */
  phone: (value) => {
    if (!value) return 'Phone number is required';
    const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
    if (!phoneRegex.test(value)) return 'Invalid phone number format';
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length < 10) return 'Phone must have at least 10 digits';
    return null;
  },

  /**
   * Username validation
   */
  username: (value) => {
    if (!value) return 'Username is required';
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 20) return 'Username must not exceed 20 characters';
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens';
    }
    return null;
  },

  /**
   * Strong password validation (includes special characters)
   */
  strongPassword: (value) => {
    if (!value) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(value)) return 'Password must contain uppercase letter';
    if (!/[a-z]/.test(value)) return 'Password must contain lowercase letter';
    if (!/[0-9]/.test(value)) return 'Password must contain number';
    if (!/[!@#$%^&*]/.test(value)) return 'Password must contain special character (!@#$%^&*)';
    return null;
  },

  /**
   * IBAN validation
   */
  iban: (value) => {
    if (!value) return 'IBAN is required';
    const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
    const cleaned = value.replace(/\s/g, '');
    if (!ibanRegex.test(cleaned)) return 'Invalid IBAN format';
    return null;
  },

  /**
   * Credit card with Luhn algorithm validation
   */
  luhnCardNumber: (value) => {
    if (!value) return 'Card number is required';
    const cleaned = value.replace(/\D/g, '');
    
    if (cleaned.length < 13 || cleaned.length > 19) {
      return 'Card number must be between 13 and 19 digits';
    }

    // Luhn algorithm
    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    if (sum % 10 !== 0) return 'Invalid card number';
    return null;
  }
};

/**
 * Validate form data against validation schema
 * @param {Object} data - Form data to validate
 * @param {Object} schema - Validation schema { fieldName: validatorFunction }
 * @returns {Object} - Errors object { fieldName: errorMessage }
 */
export const validateForm = (data, schema) => {
  const errors = {};
  
  Object.keys(schema).forEach(field => {
    const validatorOrValidators = schema[field];
    const validators_array = Array.isArray(validatorOrValidators) ? validatorOrValidators : [validatorOrValidators];
    
    for (const validator of validators_array) {
      const error = validator(data[field], data);
      if (error) {
        errors[field] = error;
        break; // Stop at first error for this field
      }
    }
  });
  
  return errors;
};

/**
 * Validate a single field
 * @param {string} fieldName - Field name
 * @param {any} value - Field value
 * @param {Function|Array} validatorOrValidators - Validator function(s)
 * @returns {string|null} - Error message or null
 */
export const validateField = (fieldName, value, validatorOrValidators, formData = {}) => {
  const validators_array = Array.isArray(validatorOrValidators) ? validatorOrValidators : [validatorOrValidators];
  
  for (const validator of validators_array) {
    const error = validator(value, formData);
    if (error) return error;
  }
  
  return null;
};

/**
 * Common validation schemas
 */
export const validationSchemas = {
  login: {
    email: validators.email,
    password: validators.required
  },

  register: {
    email: validators.email,
    password: validators.password,
    firstName: validators.name,
    lastName: validators.name
  },

  income: {
    amount: validators.amount,
    description: validators.required,
    date: validators.date
  },

  expense: {
    amount: validators.amount,
    category: validators.required,
    date: validators.date
  },

  goal: {
    name: validators.name,
    targetAmount: validators.amount,
    deadline: validators.date
  },

  creditCard: {
    cardholderName: validators.name,
    cardNumber: validators.creditCardNumber,
    expiryDate: validators.cardExpiry,
    cvv: validators.cardCvv
  },

  household: {
    name: validators.name,
    description: validators.minLength(5)
  },

  member: {
    email: validators.email,
    firstName: validators.name,
    lastName: validators.name
  }
};

/**
 * Calculate password strength score (0-100)
 */
export const getPasswordStrength = (password) => {
  let strength = 0;

  if (!password) return { score: 0, label: 'None', color: 'gray' };

  if (password.length >= 8) strength += 15;
  if (password.length >= 12) strength += 10;
  if (password.length >= 16) strength += 10;
  if (/[a-z]/.test(password)) strength += 15;
  if (/[A-Z]/.test(password)) strength += 15;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[!@#$%^&*]/.test(password)) strength += 15;

  let label, color;
  if (strength < 30) { label = 'Weak'; color = 'red'; }
  else if (strength < 60) { label = 'Fair'; color = 'orange'; }
  else if (strength < 85) { label = 'Good'; color = 'blue'; }
  else { label = 'Strong'; color = 'green'; }

  return { score: strength, label, color };
};

/**
 * Format currency value for display
 */
export const formatCurrency = (value) => {
  if (!value && value !== 0) return '';
  return parseFloat(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Parse currency string value
 */
export const parseCurrency = (value) => {
  if (!value) return 0;
  return parseFloat(value.replace(/[$,]/g, ''));
};

export default {
  validators,
  validateForm,
  validateField,
  validationSchemas,
  getPasswordStrength,
  formatCurrency,
  parseCurrency
};
