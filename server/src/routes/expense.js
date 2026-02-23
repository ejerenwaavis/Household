import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import Expense from '../models/Expense.js';
import { translateText } from '../services/translationService.js';

const router = Router({ mergeParams: true });

// Log expense
router.post('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { amount, category, description, contributorName, date: customDate } = req.body;

    if (!amount || !category) {
      return res.status(400).json({ error: 'Amount and category required' });
    }

    // Use custom date if provided, else current date
    let expenseDate = new Date();
    if (customDate) {
      expenseDate = new Date(customDate);
    }

    // Derive month (YYYY-MM) and week
    const year = expenseDate.getFullYear();
    const monthNum = expenseDate.getMonth() + 1;
    const monthStr = `${year}-${String(monthNum).padStart(2, '0')}`;
    const day = expenseDate.getDate();
    const week = Math.min(4, Math.ceil(day / 7));

    const expense = await Expense.create({
      householdId,
      userId: req.user.userId,
      contributorName: contributorName || 'Unknown',
      amount: Number(amount),
      category,
      description: description || '',
      date: expenseDate,
      week,
      month: monthStr,
      source: 'manual',
    });

    console.log('[expense POST] created', expense && { id: expense._id, month: expense.month, week: expense.week });
    res.status(201).json({ id: expense._id, expense });
  } catch (error) {
    next(error);
  }
});

// Get monthly expenses with category breakdown
router.get('/:householdId/:month', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, month } = req.params;
    const { lang = 'en' } = req.query; // Get language from query param
    
    const [year, monthNum] = month.split('-').map(Number);
    
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0);

    let expenses = await Expense.find({
      householdId,
      date: { $gte: monthStart, $lte: monthEnd },
    }).sort({ date: -1 });

    // Add translations if language is Spanish
    if (lang === 'es') {
      expenses = await Promise.all(
        expenses.map(async (expense) => {
          const doc = expense.toObject();
          doc.description_es = await translateText(doc.description, 'es', 'en');
          doc.category_es = await translateText(doc.category, 'es', 'en');
          return doc;
        })
      );
    }

    // Calculate category totals (use translated names if available)
    const byCategory = {};
    expenses.forEach((exp) => {
      const catName = lang === 'es' && exp.category_es ? exp.category_es : exp.category;
      byCategory[catName] = (byCategory[catName] || 0) + exp.amount;
    });

    const total = Object.values(byCategory).reduce((sum, val) => sum + val, 0);

    res.json({
      month,
      expenses,
      byCategory,
      total,
    });
  } catch (error) {
    next(error);
  }
});

// Delete expense
router.delete('/:householdId/:expenseId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, expenseId } = req.params;

    const expense = await Expense.findOneAndDelete({
      _id: expenseId,
      householdId,
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    console.log('[expense DELETE] removed', { id: expense._id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Update expense (partial updates)
router.patch('/:householdId/:expenseId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, expenseId } = req.params;
    const updates = req.body || {};

    const expense = await Expense.findOne({ _id: expenseId, householdId });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    // Allow updating amount, category, description, contributorName
    if (typeof updates.amount !== 'undefined') expense.amount = Number(updates.amount);
    if (updates.category) expense.category = updates.category;
    if (updates.description !== undefined) expense.description = updates.description;
    if (updates.contributorName) expense.contributorName = updates.contributorName;
    if (updates.date) {
      expense.date = new Date(updates.date);
      // Recalculate month and week
      const year = expense.date.getFullYear();
      const monthNum = expense.date.getMonth() + 1;
      expense.month = `${year}-${String(monthNum).padStart(2, '0')}`;
      const day = expense.date.getDate();
      expense.week = Math.min(4, Math.ceil(day / 7));
    }

    await expense.save();
    console.log('[expense PATCH] saved', { id: expense._id });
    res.json({ expense });
  } catch (err) {
    console.error('[expense PATCH] error', err && (err.stack || err.message || err));
    next(err);
  }
});

export default router;
