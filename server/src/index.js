import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRouter from './routes/auth.js';
import householdRouter from './routes/household.js';
import incomeRouter from './routes/income.js';
import expenseRouter from './routes/expense.js';
import fixedExpenseRouter from './routes/fixedExpense.js';
import goalRouter from './routes/goal.js';
import Household from './models/Household.js';
import Goal from './models/Goal.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/household')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  });

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'Server running', timestamp: new Date().toISOString() });
});

// Dev Only: Seed Goals from Notion data
app.post('/api/dev/seed-goals', async (req, res) => {
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

// Dev Only: Clear Database (remove in production)
app.post('/api/dev/clear-db', async (req, res) => {
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

// Routes
app.use('/api/auth', authRouter);
app.use('/api/households', householdRouter);
app.use('/api/income', incomeRouter);
app.use('/api/expenses', expenseRouter);
app.use('/api/fixed-expenses', fixedExpenseRouter);
app.use('/api/goals', goalRouter);

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
