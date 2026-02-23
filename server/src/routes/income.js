import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import Income from '../models/Income.js';
import { translateText } from '../services/translationService.js';

const router = Router({ mergeParams: true });

// Log daily income
router.post('/:householdId/daily', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { amount, source, description, date: customDate, week: customWeek, contributorName } = req.body;
    console.log('[income POST] incoming', { householdId, user: req.user?.userId, body: req.body });

    if (!amount) {
      return res.status(400).json({ error: 'Amount required' });
    }

    // Use custom date if provided (YYYY-MM-DD), else current date
    let incomeDate = new Date();
    if (customDate) {
      incomeDate = new Date(customDate);
    }

    // derive month (YYYY-MM) and week (1-4 or 5)
    const year = incomeDate.getFullYear();
    const monthNum = incomeDate.getMonth() + 1;
    const monthStr = `${year}-${String(monthNum).padStart(2, '0')}`;
    
    let week;
    if (customWeek === 'current' || !customWeek) {
      // compute from date
      const day = incomeDate.getDate();
      week = Math.min(5, Math.ceil(day / 7));
    } else if (typeof customWeek === 'number') {
      week = Math.min(5, Math.max(1, customWeek));
    } else {
      // fallback
      const day = incomeDate.getDate();
      week = Math.min(5, Math.ceil(day / 7));
    }

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
      contributorName: contributorName || 'Unknown',
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
    const { lang = 'en' } = req.query; // Get language from query param

    // Query documents by the stored month string (format YYYY-MM)
    let incomes = await Income.find({ householdId, month }).sort({ createdAt: 1 });

    // Add translations if language is Spanish
    if (lang === 'es') {
      incomes = await Promise.all(
        incomes.map(async (income) => {
          const doc = income.toObject();
          
          // Translate contributed name if it's not 'Unknown'
          if (doc.contributorName && doc.contributorName !== 'Unknown') {
            doc.contributorName_es = await translateText(doc.contributorName, 'es', 'en');
          }
          
          // Translate source from daily breakdown
          if (Array.isArray(doc.dailyBreakdown) && doc.dailyBreakdown.length > 0) {
            doc.dailyBreakdown = await Promise.all(
              doc.dailyBreakdown.map(async (entry) => {
                return {
                  ...entry,
                  source_es: await translateText(entry.source || 'manual', 'es', 'en'),
                  description_es: entry.description ? await translateText(entry.description, 'es', 'en') : undefined,
                };
              })
            );
          }
          
          return doc;
        })
      );
    }

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

    // Update contributorName if provided
    if (updates.contributorName) income.contributorName = updates.contributorName;

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

