/**
 * API Documentation Setup
 * Swagger/OpenAPI documentation for the Household Finance API
 */

export const swaggerConfig = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Household Finance Management API',
      version: '1.0.0',
      description: 'Complete REST API for managing household finances, including income, expenses, credit cards, and financial goals',
      contact: {
        name: 'Support',
        email: process.env.SUPPORT_EMAIL || 'support@household-finance.app'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000/api',
        description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development server',
        variables: {
          protocol: {
            enum: ['http', 'https'],
            default: process.env.NODE_ENV === 'production' ? 'https' : 'http'
          },
          host: {
            default: process.env.API_HOST || 'localhost:5000'
          }
        }
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token in the Authorization header'
        }
      },
      schemas: {
        // Error Response
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            errorCode: {
              type: 'string',
              description: 'Error code for client-side handling'
            },
            statusCode: {
              type: 'integer',
              description: 'HTTP status code'
            }
          }
        },
        
        // User
        User: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Unique user identifier' },
            email: { type: 'string', format: 'email', description: 'User email' },
            name: { type: 'string', description: 'User full name' },
            role: { type: 'string', enum: ['owner', 'member'], description: 'User role in household' },
            createdAt: { type: 'string', format: 'date-time', description: 'Account creation date' }
          },
          required: ['userId', 'email', 'name']
        },

        // Household
        Household: {
          type: 'object',
          properties: {
            householdId: { type: 'string', description: 'Unique household identifier' },
            name: { type: 'string', description: 'Household name' },
            description: { type: 'string', description: 'Household description' },
            members: {
              type: 'array',
              items: { $ref: '#/components/schemas/User' },
              description: 'Array of household members'
            },
            currency: { type: 'string', default: 'USD', description: 'Currency code' },
            timezone: { type: 'string', default: 'UTC', description: 'Household timezone' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },

        // Income
        Income: {
          type: 'object',
          properties: {
            incomeId: { type: 'string' },
            householdId: { type: 'string' },
            userId: { type: 'string' },
            contributorName: { type: 'string' },
            month: { type: 'string', pattern: 'YYYY-MM' },
            week: { type: 'integer', minimum: 1, maximum: 4 },
            dailyBreakdown: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date' },
                  amount: { type: 'number', format: 'float' },
                  source: { type: 'string' }
                }
              }
            },
            weeklyTotal: { type: 'number', format: 'float' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },

        // Expense
        Expense: {
          type: 'object',
          properties: {
            expenseId: { type: 'string' },
            householdId: { type: 'string' },
            userId: { type: 'string' },
            amount: { type: 'number', format: 'float', minimum: 0 },
            category: { 
              type: 'string',
              enum: ['Groceries', 'Gas', 'Entertainment', 'Dining Out', 'Shopping', 'Medical', 'Other']
            },
            description: { type: 'string' },
            date: { type: 'string', format: 'date' },
            month: { type: 'string', pattern: 'YYYY-MM' },
            week: { type: 'integer' },
            source: { type: 'string', enum: ['manual', 'plaid', 'import'] },
            receipt: { type: 'string', format: 'uri', description: 'Receipt image URL' },
            createdAt: { type: 'string', format: 'date-time' }
          },
          required: ['amount', 'category', 'date']
        },

        // Fixed Expense
        FixedExpense: {
          type: 'object',
          properties: {
            fixedExpenseId: { type: 'string' },
            householdId: { type: 'string' },
            name: { type: 'string' },
            amount: { type: 'number', format: 'float', minimum: 0 },
            group: { 
              type: 'string',
              enum: ['Housing', 'Utilities', 'Transportation', 'Food', 'Insurance', 'Other']
            },
            frequency: { type: 'string', enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'] },
            dueDay: { type: 'integer', minimum: 1, maximum: 31 },
            isActive: { type: 'boolean', default: true },
            createdAt: { type: 'string', format: 'date-time' }
          },
          required: ['name', 'amount', 'frequency']
        },

        // Goal
        Goal: {
          type: 'object',
          properties: {
            goalId: { type: 'string' },
            householdId: { type: 'string' },
            name: { type: 'string' },
            type: { type: 'string', enum: ['Emergency', 'Project', 'Investment', 'Other'] },
            targetAmount: { type: 'number', format: 'float', minimum: 0 },
            currentBalance: { type: 'number', format: 'float', default: 0 },
            monthlyContribution: { type: 'number', format: 'float', minimum: 0 },
            deadline: { type: 'string', format: 'date' },
            isActive: { type: 'boolean', default: true },
            progressPercentage: { type: 'number', minimum: 0, maximum: 100 },
            createdAt: { type: 'string', format: 'date-time' }
          },
          required: ['name', 'type', 'targetAmount']
        },

        // Credit Card
        CreditCard: {
          type: 'object',
          properties: {
            cardId: { type: 'string' },
            householdId: { type: 'string' },
            cardName: { type: 'string' },
            holder: { type: 'string' },
            currentBalance: { type: 'number', format: 'float' },
            creditLimit: { type: 'number', format: 'float' },
            minPayment: { type: 'number', format: 'float' },
            interestRate: { type: 'number', format: 'float' },
            dueDay: { type: 'integer', minimum: 1, maximum: 31 },
            utilizationRatio: { type: 'number', minimum: 0, maximum: 100 }
          },
          required: ['cardName', 'holder', 'creditLimit']
        },

        // Card Statement
        CardStatement: {
          type: 'object',
          properties: {
            statementId: { type: 'string' },
            householdId: { type: 'string' },
            cardId: { type: 'string' },
            statementName: { type: 'string' },
            month: { type: 'string', pattern: 'YYYY-MM' },
            statementBalance: { type: 'number', format: 'float' },
            currentBalance: { type: 'number', format: 'float' },
            statementDate: { type: 'string', format: 'date-time' }
          }
        },

        // Debt Payment
        DebtPayment: {
          type: 'object',
          properties: {
            paymentId: { type: 'string' },
            householdId: { type: 'string' },
            cardId: { type: 'string' },
            statementId: { type: 'string' },
            amount: { type: 'number', format: 'float', minimum: 0 },
            paymentDate: { type: 'string', format: 'date' },
            paymentMethod: { type: 'string', enum: ['online', 'check', 'transfer', 'other'] },
            month: { type: 'string', pattern: 'YYYY-MM' }
          },
          required: ['cardId', 'amount', 'paymentDate']
        }
      }
    },
    security: [
      { bearerAuth: [] }
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          description: 'Check if the API is running',
          security: [],
          responses: {
            '200': {
              description: 'Server is running',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'Server running' },
                      timestamp: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/auth/register': {
        post: {
          summary: 'Register new household',
          description: 'Create a new household and register the owner',
          security: [],
          tags: ['Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', format: 'password' },
                    householdName: { type: 'string' },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' }
                  },
                  required: ['email', 'password', 'householdName', 'firstName', 'lastName']
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Registration successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string', description: 'JWT token' },
                      refreshToken: { type: 'string', description: 'Refresh token' },
                      user: { $ref: '#/components/schemas/User' },
                      household: { $ref: '#/components/schemas/Household' }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Invalid input or household already exists',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      },

      '/auth/login': {
        post: {
          summary: 'Login user',
          tags: ['Authentication'],
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', format: 'password' }
                  },
                  required: ['email', 'password']
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string' },
                      refreshToken: { type: 'string' },
                      user: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            },
            '401': {
              description: 'Invalid credentials',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      },

      '/households': {
        get: {
          summary: 'Get household',
          tags: ['Households'],
          responses: {
            '200': {
              description: 'Household data',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Household' } } }
            },
            '401': { description: 'Unauthorized' }
          }
        }
      },

      '/expenses': {
        get: {
          summary: 'Get all expenses',
          tags: ['Expenses'],
          parameters: [
            { name: 'month', in: 'query', schema: { type: 'string', pattern: 'YYYY-MM' } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 } }
          ],
          responses: {
            '200': {
              description: 'List of expenses',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      expenses: { type: 'array', items: { $ref: '#/components/schemas/Expense' } },
                      total: { type: 'integer' },
                      limit: { type: 'integer' },
                      skip: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Create expense',
          tags: ['Expenses'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Expense' }
              }
            }
          },
          responses: {
            '201': { description: 'Expense created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Expense' } } } },
            '400': { description: 'Invalid input', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },

      '/expenses/{id}': {
        get: {
          summary: 'Get expense by ID',
          tags: ['Expenses'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Expense data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Expense' } } } },
            '404': { description: 'Expense not found' }
          }
        },
        put: {
          summary: 'Update expense',
          tags: ['Expenses'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Expense' } } }
          },
          responses: {
            '200': { description: 'Expense updated' },
            '404': { description: 'Expense not found' }
          }
        },
        delete: {
          summary: 'Delete expense',
          tags: ['Expenses'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Expense deleted' },
            '404': { description: 'Expense not found' }
          }
        }
      },

      '/goals': {
        get: {
          summary: 'Get all goals',
          tags: ['Goals'],
          parameters: [
            { name: 'type', in: 'query', schema: { type: 'string' } },
            { name: 'isActive', in: 'query', schema: { type: 'boolean' } }
          ],
          responses: {
            '200': {
              description: 'List of goals',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Goal' }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Create goal',
          tags: ['Goals'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Goal' } } }
          },
          responses: {
            '201': { description: 'Goal created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Goal' } } } }
          }
        }
      },

      '/credit-cards': {
        get: {
          summary: 'Get all credit cards',
          tags: ['Credit Cards'],
          responses: {
            '200': {
              description: 'List of credit cards',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/CreditCard' }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Add credit card',
          tags: ['Credit Cards'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditCard' } } }
          },
          responses: {
            '201': { description: 'Credit card added', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditCard' } } } }
          }
        }
      }
    }
  },
  apis: [
    './src/routes/*.js'
  ]
};

export const swaggerOptions = {
  definition: swaggerConfig.definition,
  apis: swaggerConfig.apis
};

export default swaggerConfig;
