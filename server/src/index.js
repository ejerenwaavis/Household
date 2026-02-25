import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

// Import security middleware
import { 
  generalLimiter, 
  authLimiter, 
  createLimiter,
  strictLimiter
} from './middleware/rateLimiter.js';
import { 
  securityHeaders, 
  corsConfig, 
  sanitizeInput 
} from './middleware/securityHeaders.js';
import swaggerConfig from './config/swagger.js';

// Import background jobs
import { initializeTransactionSyncJob } from './services/transactionSyncService.js';
import { initializeInsightsJob } from './services/insightsJobService.js';

// Import routes
import authRouter from './routes/auth.js';
import householdRouter from './routes/household.js';
import incomeRouter from './routes/income.js';
import incomeSplitRouter from './routes/incomeSplit.js';
import expenseRouter from './routes/expense.js';
import fixedExpenseRouter from './routes/fixedExpense.js';
import fixedExpensePaymentRouter from './routes/fixedExpensePayment.js';
import goalRouter from './routes/goal.js';
import goalContributionRouter from './routes/goalContribution.js';
import creditCardRouter from './routes/creditCard.js';
import cardStatementRouter from './routes/cardStatement.js';
import debtPaymentRouter from './routes/debtPayment.js';
import creditCardStatementRouter from './routes/creditCardStatement.js';
import taskReminderRouter from './routes/taskReminder.js';
import plaidRouter from './routes/plaid.js';
import subscriptionRouter from './routes/subscription.js';
import insightsRouter from './routes/insights.js';
import webhookRouter from './routes/webhook.js';

// Import models
import Household from './models/Household.js';
import Goal from './models/Goal.js';
import IncomeSplit from './models/IncomeSplit.js';
import FixedExpense from './models/FixedExpense.js';
import Income from './models/Income.js';
import Expense from './models/Expense.js';
import CreditCard from './models/CreditCard.js';
import CardStatement from './models/CardStatement.js';
import DebtPayment from './models/DebtPayment.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// Stripe Webhook (MUST be before express.json() - needs raw body)
// ============================================================
app.use('/api/webhooks', webhookRouter);

// ============================================================
// Security Middleware Stack (in correct order)
// ============================================================

// 1. Security headers
app.use(securityHeaders);

// 2. Helmet - comprehensive security headers
app.use(helmet({ contentSecurityPolicy: false }));

// 3. CORS with security config
app.use(cors(corsConfig));

// 4. Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 5. Input sanitization
app.use(sanitizeInput);

// 6. General rate limiting for all routes
app.use(generalLimiter);

// ============================================================
// Swagger/OpenAPI Documentation
// ============================================================

const specs = swaggerJsdoc(swaggerConfig);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Household Finance API'
}));

// ============================================================
// Database Connection
// ============================================================
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/household')
  .then(() => {
    console.log('✅ MongoDB connected');
    
    // Initialize background jobs after database connection
    try {
      initializeTransactionSyncJob();
    } catch (err) {
      console.error('❌ Failed to initialize transaction sync job:', err.message);
    }

    try {
      initializeInsightsJob();
    } catch (err) {
      console.error('❌ Failed to initialize insights job:', err.message);
    }
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  });

// ============================================================
// Public Routes (Health check, not rate limited for monitoring)
// ============================================================

app.get('/health', (req, res) => {
  res.json({ status: 'Server running', timestamp: new Date().toISOString() });
});

// ============================================================
// Auth Routes (strict rate limiting)
// ============================================================

app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRouter);

// ============================================================
// Protected Routes (with appropriate rate limiting)
// ============================================================

// Household routes - general limiting
app.use('/api/households', generalLimiter, householdRouter);

// CRUD operations - moderate limiting
app.use('/api/income', createLimiter, incomeRouter);
app.use('/api/income-splits', createLimiter, incomeSplitRouter);
app.use('/api/expenses', createLimiter, expenseRouter);
app.use('/api/fixed-expenses', createLimiter, fixedExpenseRouter);
app.use('/api/fixed-expense-payments', createLimiter, fixedExpensePaymentRouter);
app.use('/api/goals', createLimiter, goalRouter);
app.use('/api/goal-contributions', createLimiter, goalContributionRouter);
app.use('/api/credit-cards', createLimiter, creditCardRouter);
app.use('/api/card-statements', createLimiter, cardStatementRouter);
app.use('/api/debt-payments', createLimiter, debtPaymentRouter);
app.use('/api/credit-card-statements', createLimiter, creditCardStatementRouter);
app.use('/api/tasks', createLimiter, taskReminderRouter);
app.use('/api/plaid', createLimiter, plaidRouter);
app.use('/api/subscription', createLimiter, subscriptionRouter);
app.use('/api/insights', createLimiter, insightsRouter);

// ============================================================
// Development-only Routes (strict limiting)
// ============================================================
app.post('/api/dev/seed-goals', strictLimiter, async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }
  try {
    // Find the first household in the DB
    const household = await Household.findOne({});
    if (!household) return res.status(404).json({ error: 'No household found. Register first.' });

    const householdId = household.householdId;
    const owner = household.members?.[0];
    const userId = owner?.userId || 'seed';

    // Remove existing goals for this household so we don't double-seed
    await Goal.deleteMany({ householdId });

    const notionGoals = [
      {
        name: 'Emergency Fund / Fondo de Emergencia',
        type: 'Emergency',
        monthlyContribution: 500,
        target: 5000,
        currentBalance: 100,
      },
      {
        name: 'Project Fund / Fondo de Proyecto',
        type: 'Project',
        monthlyContribution: 500,
        target: 25000,
        currentBalance: 0,
      },
      {
        name: 'Investment Fund / Fondo de Inversión',
        type: 'Investment',
        monthlyContribution: 300,
        target: 0,
        currentBalance: 0,
      },
    ];

    const created = await Goal.insertMany(
      notionGoals.map((g) => ({ ...g, householdId, userId, isActive: true }))
    );

    res.json({ success: true, householdId, count: created.length, goals: created.map(g => g.name) });
  } catch (err) {
    console.error('[seed-goals] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Dev Only: Seed Income Splits (60/40 split for head of house + spouse)
app.post('/api/dev/seed-income-splits', strictLimiter, async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }
  try {
    // Find the first household in the DB
    const household = await Household.findOne({});
    if (!household) return res.status(404).json({ error: 'No household found. Register first.' });

    const householdId = household.householdId;
    const members = household.members || [];

    // Remove existing splits for this household
    await IncomeSplit.deleteMany({ householdId });

    // For demo: assign 60% to first member (head of house), 40% to others combined or create second member with 40%
    const splits = [];
    
    if (members.length >= 1) {
      // Head of house gets 60%
      splits.push({
        householdId,
        userId: members[0].userId,
        userName: members[0].name,
        splitPercentage: 60,
        isHeadOfHouse: true,
      });
    }

    if (members.length >= 2) {
      // Second member gets 40%
      splits.push({
        householdId,
        userId: members[1].userId,
        userName: members[1].name,
        splitPercentage: 40,
        isHeadOfHouse: false,
      });
    } else if (members.length === 1) {
      // If only one member, they get 100% (full responsibility)
      await IncomeSplit.updateOne(
        { householdId, userId: members[0].userId },
        { $set: { splitPercentage: 100 } }
      );
      return res.json({ 
        success: true, 
        householdId, 
        msg: 'Only 1 member: assigned 100% to head of house',
        splits: [{ name: members[0].name, percentage: 100 }]
      });
    }

    const created = await IncomeSplit.insertMany(splits);

    res.json({ 
      success: true, 
      householdId, 
      count: created.length, 
      splits: created.map(s => ({ name: s.userName, percentage: s.splitPercentage }))
    });
  } catch (err) {
    console.error('[seed-income-splits] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Dev Only: Clear Database (remove in production)
app.post('/api/dev/clear-db', strictLimiter, async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }
  
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    for (const col of collections) {
      await db.dropCollection(col.name);
    }
    
    res.json({ success: true, message: 'Database cleared', collections: collections.map(c => c.name) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dev Only: Master Seed Endpoint - Comprehensive test data
app.post('/api/dev/seed-all', strictLimiter, async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }

  try {
    const results = {
      household: null,
      goals: 0,
      incomeSplits: 0,
      fixedExpenses: 0,
      incomeEntries: 0,
      expenseEntries: 0,
      creditCards: 0,
      cardStatements: 0,
      debtPayments: 0,
    };

    // Find or create household
    let household = await Household.findOne({});
    if (!household) {
      return res.status(400).json({ error: 'Please register a household first via /api/auth/register' });
    }
    results.household = { householdId: household.householdId, name: household.name };
    const householdId = household.householdId;
    const members = household.members || [];
    const userId = members[0]?.userId || 'seed';

    // 1. Seed Goals
    await Goal.deleteMany({ householdId });
    const goals = await Goal.insertMany([
      { householdId, userId, name: 'Emergency Fund', type: 'Emergency', target: 5000, currentBalance: 1200, monthlyContribution: 500, isActive: true },
      { householdId, userId, name: 'Vacation Fund', type: 'Other', target: 3000, currentBalance: 800, monthlyContribution: 300, isActive: true },
      { householdId, userId, name: 'Home Repair Fund', type: 'Project', target: 10000, currentBalance: 2500, monthlyContribution: 400, isActive: true },
    ]);
    results.goals = goals.length;

    // 2. Seed Income Splits
    await IncomeSplit.deleteMany({ householdId });
    if (members.length > 0) {
      const splits = members.map((member, idx) => ({
        householdId,
        userId: member.userId,
        userName: member.name,
        splitPercentage: members.length === 1 ? 100 : (idx === 0 ? 60 : 40),
        isHeadOfHouse: idx === 0,
      }));
      const createdSplits = await IncomeSplit.insertMany(splits);
      results.incomeSplits = createdSplits.length;
    }

    // 3. Seed Fixed Expenses
    await FixedExpense.deleteMany({ householdId });
    const now = new Date();
    const fixedExpenses = [
      { householdId, userId, name: 'Rent', amount: 1500, group: 'Housing', frequency: 'monthly', dueDay: 1, isActive: true },
      { householdId, userId, name: 'Electricity', amount: 120, group: 'Utilities', frequency: 'monthly', dueDay: 15, isActive: true },
      { householdId, userId, name: 'Internet', amount: 80, group: 'Utilities', frequency: 'monthly', dueDay: 15, isActive: true },
      { householdId, userId, name: 'Water', amount: 40, group: 'Utilities', frequency: 'monthly', dueDay: 20, isActive: true },
      { householdId, userId, name: 'Car Insurance', amount: 95, group: 'Transportation', frequency: 'monthly', dueDay: 10, isActive: true },
      { householdId, userId, name: 'Groceries Budget', amount: 600, group: 'Food', frequency: 'monthly', dueDay: 1, isActive: true },
    ];
    const createdFixedExpenses = await FixedExpense.insertMany(fixedExpenses);
    results.fixedExpenses = createdFixedExpenses.length;

    // 4. Seed Income Entries (last 6 months)
    await Income.deleteMany({ householdId });
    const incomeData = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      incomeData.push({
        householdId,
        userId,
        contributorName: members[0]?.name || 'Primary Earner',
        month: monthStr,
        week: 1,
        dailyBreakdown: [{ date: date.toISOString(), amount: 4500, source: 'Salary', description: 'Monthly Salary' }],
        weeklyTotal: 4500,
        projection: { currentPace: 4500, confidence: 0.95 },
      });
    }
    const createdIncomes = await Income.insertMany(incomeData);
    results.incomeEntries = createdIncomes.length;

    // 5. Seed Variable Expenses (last 3 months)
    await Expense.deleteMany({ householdId });
    const expenses = [];
    const expenseCategories = ['Groceries', 'Gas', 'Entertainment', 'Dining Out', 'Shopping', 'Medical'];
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const category = expenseCategories[Math.floor(Math.random() * expenseCategories.length)];
      const amount = Math.round((Math.random() * 200 + 20) * 100) / 100;
      expenses.push({
        householdId,
        userId,
        contributorName: members[0]?.name || 'Contributor',
        amount,
        category,
        description: `${category} expense`,
        date,
        month: monthStr,
        week: Math.ceil(date.getDate() / 7),
        source: 'manual',
      });
    }
    const createdExpenses = await Expense.insertMany(expenses);
    results.expenseEntries = createdExpenses.length;

    // 6. Seed Credit Cards
    await CreditCard.deleteMany({ householdId });
    const creditCards = await CreditCard.insertMany([
      {
        householdId,
        userId,
        cardName: 'Chase Sapphire',
        holder: members[0]?.name || 'Primary Member',
        originalBalance: 5000,
        currentBalance: 2400,
        minPayment: 150,
        plannedExtraPayment: 300,
        interestRate: 18.5,
        creditLimit: 15000,
        dueDay: 15,
      },
      {
        householdId,
        userId,
        cardName: 'AmEx Blue',
        holder: members[0]?.name || 'Primary Member',
        originalBalance: 3000,
        currentBalance: 1200,
        minPayment: 100,
        plannedExtraPayment: 200,
        interestRate: 19.2,
        creditLimit: 10000,
        dueDay: 20,
      },
    ]);
    results.creditCards = creditCards.length;

    // 7. Seed Card Statements
    await CardStatement.deleteMany({ householdId });
    const statements = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      creditCards.forEach((card) => {
        statements.push({
          householdId,
          cardId: card._id,
          statementName: `${card.cardName} - ${monthStr}`,
          month: monthStr,
          statementDate: date,
          statementBalance: card.originalBalance * 0.5 + Math.random() * 500,
          currentBalance: card.currentBalance + Math.random() * 200,
        });
      });
    }
    const createdStatements = await CardStatement.insertMany(statements);
    results.cardStatements = createdStatements.length;

    // 8. Seed Debt Payments
    await DebtPayment.deleteMany({ householdId });
    const payments = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getTime() - i * 30 * 24 * 60 * 60 * 1000);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const card = creditCards[i % creditCards.length];
      const statement = createdStatements.find(s => s.cardId.toString() === card._id.toString());
      if (statement) {
        payments.push({
          householdId,
          cardId: card._id,
          statementId: statement._id,
          amount: 500 + Math.random() * 300,
          paymentDate: date,
          paymentMethod: ['online', 'check', 'transfer'][Math.floor(Math.random() * 3)],
          month: monthStr,
        });
      }
    }
    const createdPayments = await DebtPayment.insertMany(payments);
    results.debtPayments = createdPayments.length;

    res.json({
      success: true,
      message: 'Comprehensive test data seeded successfully',
      results,
    });
  } catch (error) {
    console.error('[seed-all] error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Dev Only: Test Email Configuration
app.post('/api/dev/test-email', strictLimiter, async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }

  try {
    const { testEmail } = req.body;
    if (!testEmail) {
      return res.status(400).json({ error: 'testEmail is required' });
    }

    // Import email service
    const { testEmailConfiguration } = await import('./services/emailService.js');
    const result = await testEmailConfiguration(testEmail);

    res.json(result);
  } catch (error) {
    console.error('[test-email] error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Error Handler (with security in mind - don't leak sensitive info)
// ============================================================

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Don't leak sensitive information in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error'
    : err.message;
  
  res.status(err.status || 500).json({ 
    error: message,
    // Only include stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================================
// 404 Handler
// ============================================================

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
