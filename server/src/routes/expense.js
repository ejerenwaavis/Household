import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import Expense from '../models/Expense.js';

const router = Router({ mergeParams: true });

// Log expense
router.post('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { amount, category, description } = req.body;

    if (!amount || !category) {
      return res.status(400).json({ error: 'Amount and category required' });
    }

    const expense = await Expense.create({
      householdId,
      userId: req.user.userId,
      amount: Number(amount),
      category,
      description: description || '',
      date: new Date(),
      source: 'manual',
    });

    res.status(201).json({ id: expense._id, expense });
  } catch (error) {
    next(error);
  }
});

// Get monthly expenses with category breakdown
router.get('/:householdId/:month', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, month } = req.params;
    const [year, monthNum] = month.split('-').map(Number);
    
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0);

    const expenses = await Expense.find({
      householdId,
      date: { $gte: monthStart, $lte: monthEnd },
    }).sort({ date: -1 });

    // Calculate category totals
    const byCategory = {};
    expenses.forEach((exp) => {
      byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
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

    res.json({ message: 'Expense deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
