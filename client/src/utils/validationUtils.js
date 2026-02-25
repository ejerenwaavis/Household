/**
 * Form Validation Utilities
 * Comprehensive validation functions for common form fields
 */

// Email validation
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return { valid: false, error: 'Email is required' };
  if (!emailRegex.test(email)) return { valid: false, error: 'Invalid email format' };
  return { valid: true };
};

// Password validation
export const validatePassword = (password) => {
  const errors = [];

  if (!password) return { valid: false, error: 'Password is required' };
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least one number');
  if (!/[!@#$%^&*]/.test(password)) errors.push('At least one special character (!@#$%^&*)');

  if (errors.length > 0) {
    return {
      valid: false,
      error: 'Password must contain:',
      requirements: errors
    };
  }

  return { valid: true };
};

// Password strength indicator
export const getPasswordStrength = (password) => {
  let strength = 0;

  if (!password) return { score: 0, label: 'None', color: 'gray' };

  if (password.length >= 8) strength += 20;
  if (password.length >= 12) strength += 20;
  if (/[a-z]/.test(password)) strength += 15;
  if (/[A-Z]/.test(password)) strength += 15;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[!@#$%^&*]/.test(password)) strength += 15;

  let label, color;
  if (strength < 40) { label = 'Weak'; color = 'red'; }
  else if (strength < 70) { label = 'Fair'; color = 'yellow'; }
  else if (strength < 90) { label = 'Good'; color = 'blue'; }
  else { label = 'Strong'; color = 'green'; }

  return { score: strength, label, color };
};

// Money validation (currency)
export const validateMoney = (amount, minAmount = 0, maxAmount = Infinity) => {
  if (amount === '' || amount === null || amount === undefined) {
    return { valid: false, error: 'Amount is required' };
  }

  const num = parseFloat(amount);
  if (isNaN(num)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }

  if (num < minAmount) {
    return { valid: false, error: `Amount must be at least ${minAmount}` };
  }

  if (num > maxAmount) {
    return { valid: false, error: `Amount must not exceed ${maxAmount}` };
  }

  // Check decimal places (max 2 for currency)
  if (!/^\d+(\.\d{0,2})?$/.test(num.toString())) {
    return { valid: false, error: 'Amount must have at most 2 decimal places' };
  }

  return { valid: true, value: num };
};

// Date validation
export const validateDate = (dateString) => {
  if (!dateString) return { valid: false, error: 'Date is required' };

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  return { valid: true, value: date };
};

// Date range validation
export const validateDateRange = (startDate, endDate) => {
  const startVal = new Date(startDate);
  const endVal = new Date(endDate);

  if (isNaN(startVal.getTime())) {
    return { valid: false, error: 'Invalid start date' };
  }

  if (isNaN(endVal.getTime())) {
    return { valid: false, error: 'Invalid end date' };
  }

  if (startVal > endVal) {
    return { valid: false, error: 'Start date must be before end date' };
  }

  return { valid: true };
};

// Required field validation
export const validateRequired = (value, fieldName = 'Field') => {
  if (value === '' || value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  return { valid: true };
};

// Min length validation
export const validateMinLength = (value, minLength, fieldName = 'Field') => {
  if (!value || value.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  return { valid: true };
};

// Max length validation
export const validateMaxLength = (value, maxLength, fieldName = 'Field') => {
  if (value && value.length > maxLength) {
    return { valid: false, error: `${fieldName} must not exceed ${maxLength} characters` };
  }

  return { valid: true };
};

// URL validation
export const validateURL = (url) => {
  if (!url) return { valid: false, error: 'URL is required' };

  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
};

// Phone number validation
export const validatePhone = (phone) => {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  if (!phone) return { valid: false, error: 'Phone is required' };
  if (!phoneRegex.test(phone)) return { valid: false, error: 'Invalid phone format' };
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 10) return { valid: false, error: 'Phone must have at least 10 digits' };

  return { valid: true };
};

// Username validation
export const validateUsername = (username) => {
  if (!username) return { valid: false, error: 'Username is required' };
  if (username.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
  if (username.length > 20) return { valid: false, error: 'Username must not exceed 20 characters' };
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }

  return { valid: true };
};

// Percentage validation (0-100)
export const validatePercentage = (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return { valid: false, error: 'Percentage must be a valid number' };
  if (num < 0 || num > 100) return { valid: false, error: 'Percentage must be between 0 and 100' };

  return { valid: true, value: num };
};

// IBAN validation (simplified)
export const validateIBAN = (iban) => {
  if (!iban) return { valid: false, error: 'IBAN is required' };

  const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
  if (!ibanRegex.test(iban.replace(/\s/g, ''))) {
    return { valid: false, error: 'Invalid IBAN format' };
  }

  return { valid: true };
};

// Credit card validation (Luhn algorithm)
export const validateCreditCard = (cardNumber) => {
  if (!cardNumber) return { valid: false, error: 'Card number is required' };

  const cleaned = cardNumber.replace(/\D/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) {
    return { valid: false, error: 'Card number must be between 13 and 19 digits' };
  }

  // Luhn algorithm
  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  if (sum % 10 !== 0) {
    return { valid: false, error: 'Invalid card number' };
  }

  return { valid: true };
};

/**
 * Combined field validation
 * Validates multiple rules on a single field
 */
export const validateField = (value, rules) => {
  for (const rule of rules) {
    const result = rule(value);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
};

/**
 * Form-level validation
 * Validates all fields in a form
 */
export const validateForm = (formData, schema) => {
  const errors = {};
  let isValid = true;

  for (const [fieldName, rules] of Object.entries(schema)) {
    const result = validateField(formData[fieldName], rules);
    if (!result.valid) {
      errors[fieldName] = result.error;
      isValid = false;
    }
  }

  return { isValid, errors };
};

export default {
  validateEmail,
  validatePassword,
  getPasswordStrength,
  validateMoney,
  validateDate,
  validateDateRange,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  validateURL,
  validatePhone,
  validateUsername,
  validatePercentage,
  validateIBAN,
  validateCreditCard,
  validateField,
  validateForm
};
