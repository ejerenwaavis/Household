import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import Household from '../models/Household.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';

const router = Router();

// Get household details
router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const household = await Household.findOne({
      householdId: req.params.householdId,
    });

    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    res.json(household);
  } catch (error) {
    next(error);
  }
});

// Get household summary with income/expense totals
router.get('/:householdId/summary', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get income totals
    const incomeData = await Income.aggregate([
      { $match: { householdId, date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    // Get expense totals
    const expenseData = await Expense.aggregate([
      { $match: { householdId, date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const totalIncome = incomeData[0]?.total || 0;
    const totalExpenses = expenseData[0]?.total || 0;

    res.json({
      householdId,
      month: monthStart.toISOString().slice(0, 7),
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
