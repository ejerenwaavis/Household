/**
 * Business Logic Validators
 * Enforces domain-specific business rules for financial data
 */

/**
 * Validate card statement business logic
 */
export const validateCardStatement = async (statement, card, previousStatement) => {
  const errors = [];

  // Rule 1: Closing balance cannot be negative
  if (statement.closingBalance < 0) {
    errors.push('Closing balance cannot be negative');
  }

  // Rule 2: Opening balance matches previous closing balance
  if (previousStatement && statement.openingBalance !== previousStatement.closingBalance) {
    errors.push(
      `Opening balance (${statement.openingBalance}) must match previous closing balance (${previousStatement.closingBalance})`
    );
  }

  // Rule 3: Closing balance formula: opening + purchases + interest + fees - payments
  const expectedClosing = 
    (statement.openingBalance || 0) +
    (statement.purchases || 0) +
    (statement.interest || 0) +
    (statement.fees || 0) -
    (statement.payments || 0);

  const tolerance = 0.01; // Allow for rounding differences
  if (Math.abs(expectedClosing - statement.closingBalance) > tolerance) {
    errors.push(
      `Closing balance (${statement.closingBalance}) doesn't match calculated value (${expectedClosing.toFixed(2)}). ` +
      `Formula: opening balance + purchases + interest + fees - payments`
    );
  }

  // Rule 4: Cannot exceed credit limit
  if (card && statement.closingBalance > card.limit) {
    errors.push(
      `Closing balance (${statement.closingBalance}) exceeds credit limit (${card.limit})`
    );
  }

  // Rule 5: All amount fields must be >= 0
  if (statement.purchases && statement.purchases < 0) {
    errors.push('Purchases amount cannot be negative');
  }
  if (statement.payments && statement.payments < 0) {
    errors.push('Payments amount cannot be negative');
  }
  if (statement.fees && statement.fees < 0) {
    errors.push('Fees amount cannot be negative');
  }
  if (statement.interest && statement.interest < 0) {
    errors.push('Interest amount cannot be negative');
  }

  // Rule 6: Opening balance cannot be negative
  if (statement.openingBalance < 0) {
    errors.push('Opening balance cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate debt payment business logic
 */
export const validateDebtPayment = async (payment, card, statement) => {
  const errors = [];

  // Rule 1: Payment amount must be positive
  if (payment.amount <= 0) {
    errors.push('Payment amount must be greater than 0');
  }

  // Rule 2: Payment cannot exceed statement balance
  if (statement && payment.amount > statement.closingBalance) {
    errors.push(
      `Payment amount (${payment.amount}) cannot exceed card balance (${statement.closingBalance})`
    );
  }

  // Rule 3: Payment date should be on or after statement date
  if (statement) {
    const paymentDate = new Date(payment.paymentDate);
    const statementDate = new Date(statement.statementDate);
    
    if (paymentDate < statementDate) {
      errors.push('Payment date cannot be before statement date');
    }
  }

  // Rule 4: Payment date should not be in future (allow current day)
  const paymentDate = new Date(payment.paymentDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  if (paymentDate > today) {
    errors.push('Payment date cannot be in the future');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate household member assignment
 */
export const validateHouseholdMember = (member, household) => {
  const errors = [];

  // Rule 1: Household must have at least one admin
  const existingAdmins = household.members.filter(m => m.role === 'admin' || m.role === 'owner');
  if (existingAdmins.length === 0 && member.role !== 'admin' && member.role !== 'owner') {
    errors.push('Household must have at least one admin');
  }

  // Rule 2: Cannot have duplicate email in household
  const duplicateEmail = household.members.some(
    m => m.email.toLowerCase() === member.email.toLowerCase() && m.userId !== member.userId
  );
  if (duplicateEmail) {
    errors.push('Member with this email already exists in household');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate credit card creation
 */
export const validateCreditCard = (card) => {
  const errors = [];

  // Rule 1: Credit limit must be positive
  if (card.limit <= 0) {
    errors.push('Credit limit must be greater than 0');
  }

  // Rule 2: Interest rate must be between 0 and 100
  if (card.interestRate < 0 || card.interestRate > 100) {
    errors.push('Interest rate must be between 0 and 100 percent');
  }

  // Rule 3: Card expiry must be in future
  const now = new Date();
  const [month, year] = card.expiryDate.split('/');
  const expireDate = new Date(2000 + parseInt(year), parseInt(month) - 1, 1);
  
  if (expireDate <= now) {
    errors.push('Card expiry date must be in the future');
  }

  // Rule 4: CVV must be 3 or 4 digits
  if (!/^\d{3,4}$/.test(card.cvv)) {
    errors.push('CVV must be 3 or 4 digits');
  }

  // Rule 5: Card number passes Luhn check
  if (!luhnCheck(card.cardNumber)) {
    errors.push('Invalid card number (failed Luhn check)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate purchase/transaction amount
 */
export const validateAmount = (amount, min = 0.01, max = 999999999) => {
  const errors = [];

  if (amount < min) {
    errors.push(`Amount must be at least ${min}`);
  }

  if (amount > max) {
    errors.push(`Amount must not exceed ${max}`);
  }

  if (amount % 0.01 !== 0) {
    errors.push('Amount must have at most 2 decimal places');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate date range (startDate <= endDate)
 */
export const validateDateRange = (startDate, endDate, maxDays = 366) => {
  const errors = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    errors.push('Start date must be before end date');
  }

  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  if (days > maxDays) {
    errors.push(`Date range cannot exceed ${maxDays} days`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate balance consistency
 * Ensures running balance is mathematically correct
 */
export const validateBalanceConsistency = (statements) => {
  const errors = [];

  for (let i = 1; i < statements.length; i++) {
    const prev = statements[i - 1];
    const current = statements[i];

    if (current.openingBalance !== prev.closingBalance) {
      errors.push(
        `Statement ${i}: Opening balance (${current.openingBalance}) doesn't match ` +
        `previous closing balance (${prev.closingBalance})`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Luhn algorithm implementation for credit card validation
 */
function luhnCheck(cardNumber) {
  const digits = cardNumber.replace(/\D/g, '');
  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

export default {
  validateCardStatement,
  validateDebtPayment,
  validateHouseholdMember,
  validateCreditCard,
  validateAmount,
  validateDateRange,
  validateBalanceConsistency
};
