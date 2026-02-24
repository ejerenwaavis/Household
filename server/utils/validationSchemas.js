/**
 * Backend Validation Schemas
 * Joi schemas for validating all API requests
 */

const Joi = require('joi');

// Define common fields
const email = Joi.string().email().lowercase().trim().required().messages({
  'string.email': 'Email must be valid',
  'any.required': 'Email is required'
});

const password = Joi.string()
  .min(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
    'any.required': 'Password is required'
  });

const name = Joi.string().trim().min(2).max(100).required().messages({
  'string.min': 'Name must be at least 2 characters',
  'string.max': 'Name must not exceed 100 characters',
  'any.required': 'Name is required'
});

const amount = Joi.number()
  .positive()
  .precision(2)
  .required()
  .messages({
    'number.positive': 'Amount must be greater than 0',
    'any.required': 'Amount is required'
  });

const date = Joi.date().iso().required().messages({
  'date.base': 'Date must be valid',
  'any.required': 'Date is required'
});

const percentageNumber = Joi.number().min(0).max(100).required().messages({
  'number.min': 'Percentage must be at least 0',
  'number.max': 'Percentage must not exceed 100',
  'any.required': 'Percentage is required'
});

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .required()
  .messages({
    'string.pattern.base': 'Invalid ID format',
    'any.required': 'ID is required'
  });

// ========== AUTH SCHEMAS ==========

exports.authSchemas = {
  // Register validation
  register: Joi.object({
    email,
    password,
    firstName: name,
    lastName: name,
    householdName: Joi.string().trim().min(2).max(100).required().messages({
      'string.min': 'Household name must be at least 2 characters',
      'string.max': 'Household name must not exceed 100 characters',
      'any.required': 'Household name is required'
    })
  }).unknown(false),

  // Login validation
  login: Joi.object({
    email,
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    })
  }).unknown(false),

  // Refresh token validation
  refresh: Joi.object({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Refresh token is required'
    })
  }).unknown(false),

  // Change password validation
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: password,
    confirmPassword: Joi.string()
      .valid(Joi.ref('newPassword'))
      .required()
      .messages({
        'any.only': 'Passwords do not match',
        'any.required': 'Confirm password is required'
      })
  }).unknown(false)
};

// ========== HOUSEHOLD SCHEMAS ==========

exports.householdSchemas = {
  // Create household
  create: Joi.object({
    name,
    description: Joi.string().trim().max(500).optional()
  }).unknown(false),

  // Update household
  update: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional(),
    description: Joi.string().trim().max(500).optional()
  }).min(1).unknown(false),

  // Invite member
  inviteMember: Joi.object({
    email,
    role: Joi.string().valid('member', 'admin').default('member').messages({
      'any.only': 'Role must be member or admin'
    })
  }).unknown(false),

  // Update member role
  updateMemberRole: Joi.object({
    role: Joi.string().valid('member', 'admin').required().messages({
      'any.only': 'Role must be member or admin'
    })
  }).unknown(false)
};

// ========== CREDIT CARD SCHEMAS ==========

exports.creditCardSchemas = {
  // Create credit card
  create: Joi.object({
    cardholderName: name,
    cardNumber: Joi.string()
      .pattern(/^[0-9]{13,19}$/)
      .required()
      .messages({
        'string.pattern.base': 'Card number must be 13-19 digits',
        'any.required': 'Card number is required'
      }),
    expiryDate: Joi.string()
      .pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)
      .required()
      .messages({
        'string.pattern.base': 'Expiry date must be MM/YY format',
        'any.required': 'Expiry date is required'
      }),
    cvv: Joi.string()
      .pattern(/^[0-9]{3,4}$/)
      .required()
      .messages({
        'string.pattern.base': 'CVV must be 3 or 4 digits',
        'any.required': 'CVV is required'
      }),
    limit: amount,
    interestRate: percentageNumber,
    isActive: Joi.boolean().default(true)
  }).unknown(false),

  // Update credit card
  update: Joi.object({
    cardholderName: name.optional(),
    limit: amount.optional(),
    interestRate: percentageNumber.optional(),
    isActive: Joi.boolean().optional()
  }).min(1).unknown(false)
};

// ========== CARD STATEMENT SCHEMAS ==========

exports.cardStatementSchemas = {
  // Create card statement
  create: Joi.object({
    cardId: objectId,
    statementDate: date,
    openingBalance: Joi.number().required().messages({
      'any.required': 'Opening balance is required'
    }),
    purchases: amount.optional(),
    payments: amount.optional(),
    fees: amount.optional(),
    interest: amount.optional(),
    closingBalance: Joi.number().required().messages({
      'any.required': 'Closing balance is required'
    }),
    dueDate: date.optional(),
    notes: Joi.string().trim().max(1000).optional()
  }).unknown(false),

  // Update card statement
  update: Joi.object({
    statementDate: date.optional(),
    openingBalance: Joi.number().optional(),
    purchases: amount.optional(),
    payments: amount.optional(),
    fees: amount.optional(),
    interest: amount.optional(),
    closingBalance: Joi.number().optional(),
    dueDate: date.optional(),
    notes: Joi.string().trim().max(1000).optional()
  }).min(1).unknown(false)
};

// ========== DEBT PAYMENT SCHEMAS ==========

exports.debtPaymentSchemas = {
  // Create debt payment
  create: Joi.object({
    cardId: objectId,
    paymentDate: date,
    amount: amount,
    paymentMethod: Joi.string()
      .valid('cash', 'check', 'wire', 'ach', 'other')
      .required()
      .messages({
        'any.only': 'Invalid payment method'
      }),
    reference: Joi.string().trim().max(100).optional(),
    notes: Joi.string().trim().max(500).optional()
  }).unknown(false),

  // Update debt payment
  update: Joi.object({
    paymentDate: date.optional(),
    amount: amount.optional(),
    paymentMethod: Joi.string()
      .valid('cash', 'check', 'wire', 'ach', 'other')
      .optional(),
    reference: Joi.string().trim().max(100).optional(),
    notes: Joi.string().trim().max(500).optional()
  }).min(1).unknown(false)
};

// ========== QUERY SCHEMAS ==========

exports.querySchemas = {
  // Pagination query
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().optional(),
    search: Joi.string().trim().optional()
  }).unknown(false),

  // Date range query
  dateRange: Joi.object({
    startDate: date.optional(),
    endDate: date.optional(),
    month: Joi.string()
      .pattern(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional()
      .messages({
        'string.pattern.base': 'Month must be in YYYY-MM format'
      })
  }).unknown(false)
};

// ========== VALIDATION MIDDLEWARE FACTORY ==========

/**
 * Create validation middleware for request body
 */
exports.validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const messages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation Error',
        details: messages,
        statusCode: 400
      });
    }

    req.body = value;
    next();
  };
};

/**
 * Create validation middleware for query parameters
 */
exports.validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const messages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Query Validation Error',
        details: messages,
        statusCode: 400
      });
    }

    req.query = value;
    next();
  };
};

/**
 * Create validation middleware for URL parameters
 */
exports.validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const messages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Parameter Validation Error',
        details: messages,
        statusCode: 400
      });
    }

    req.params = value;
    next();
  };
};
