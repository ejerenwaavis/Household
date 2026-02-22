import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import Income from '../models/Income.js';

const router = Router({ mergeParams: true });

// Log daily income
router.post('/:householdId/daily', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { amount, source, description } = req.body;
    console.log('[income POST] incoming', { householdId, user: req.user?.userId, body: req.body });

    if (!amount) {
      return res.status(400).json({ error: 'Amount required' });
    }

    const incomeDate = new Date();

    // derive month (YYYY-MM) and week (1-4)
    const year = incomeDate.getFullYear();
    const monthNum = incomeDate.getMonth() + 1;
    const monthStr = `${year}-${String(monthNum).padStart(2, '0')}`;
    const day = incomeDate.getDate();
    const week = Math.min(4, Math.ceil(day / 7));

    // Build daily breakdown entry (simple representation)
    const dailyEntry = {
      date: incomeDate.toISOString(),
      amount: Number(amount),
      source: source || 'manual',
      description,
    };

    const incomeDoc = await Income.create({
      householdId,
      userId: req.user.userId,
      month: monthStr,
      week,
      dailyBreakdown: [dailyEntry],
      weeklyTotal: Number(amount),
      projection: { currentPace: Number(amount), confidence: 0.5 },
    });
    console.log('[income POST] created', incomeDoc && { id: incomeDoc._id, month: incomeDoc.month, week: incomeDoc.week });

    res.status(201).json({ id: incomeDoc._id, income: incomeDoc });
  } catch (error) {
    console.error('[income POST] error:', error && (error.stack || error.message || error));
    next(error);
  }
});

// Get monthly income with weekly breakdown
router.get('/:householdId/:month', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, month } = req.params;

    // Query documents by the stored month string (format YYYY-MM)
    const incomes = await Income.find({ householdId, month }).sort({ createdAt: 1 });

    // Aggregate weekly totals using the `week` and `weeklyTotal` fields when present.
    const weeks = [0, 0, 0, 0];
    incomes.forEach((doc) => {
      const w = Number(doc.week) || 1;
      const idx = Math.min(3, Math.max(0, w - 1));
      const wt = Number(doc.weeklyTotal) || 0;
      weeks[idx] += wt;
    });

    const total = weeks.reduce((a, b) => a + b, 0);

    res.json({
      month,
      income: incomes,
      weeklyTotals: weeks,
      total,
      projectedTotal: weeks[0] * 4,
    });
  } catch (error) {
    console.error('[income GET] error', error && (error.stack || error.message || error));
    next(error);
  }
});

// Update an income entry (partial updates supported)
router.patch('/:householdId/:id', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;
    const updates = req.body || {};
    console.log('[income PATCH] incoming', { householdId, id, user: req.user?.userId, updates });

    const income = await Income.findOne({ _id: id, householdId });
    if (!income) return res.status(404).json({ error: 'Income not found' });

    // If amount provided, update weeklyTotal and first dailyBreakdown
    if (typeof updates.amount !== 'undefined') {
      const amt = Number(updates.amount) || 0;
      income.weeklyTotal = amt;
      if (!Array.isArray(income.dailyBreakdown)) income.dailyBreakdown = [];
      if (income.dailyBreakdown.length === 0) {
        income.dailyBreakdown.push({ date: new Date().toISOString(), amount: amt, source: updates.source || 'manual', description: updates.description || '' });
      } else {
        income.dailyBreakdown[0].amount = amt;
        if (updates.source) income.dailyBreakdown[0].source = updates.source;
        if (updates.description) income.dailyBreakdown[0].description = updates.description;
        if (updates.date) income.dailyBreakdown[0].date = updates.date;
      }
    } else {
      // allow updating source/description/date on first breakdown even if amount not updated
      if (updates.source && Array.isArray(income.dailyBreakdown) && income.dailyBreakdown.length) income.dailyBreakdown[0].source = updates.source;
      if (updates.description && Array.isArray(income.dailyBreakdown) && income.dailyBreakdown.length) income.dailyBreakdown[0].description = updates.description;
      if (updates.date && Array.isArray(income.dailyBreakdown) && income.dailyBreakdown.length) income.dailyBreakdown[0].date = updates.date;
    }

    if (updates.projection) income.projection = { ...income.projection, ...updates.projection };

    await income.save();
    console.log('[income PATCH] saved', { id: income._id });
    res.json({ income });
  } catch (err) {
    console.error('[income PATCH] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// Delete an income entry
router.delete('/:householdId/:id', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;
    console.log('[income DELETE] incoming', { householdId, id, user: req.user?.userId });
    const doc = await Income.findOneAndDelete({ _id: id, householdId });
    if (!doc) return res.status(404).json({ error: 'Income not found' });
    console.log('[income DELETE] removed', { id: doc._id });
    res.json({ success: true });
  } catch (err) {
    console.error('[income DELETE] error', err && (err.stack || err.message || err));
    next(err);
  }
});

export default router;

