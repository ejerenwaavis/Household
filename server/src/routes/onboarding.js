/**
 * Onboarding Route
 * Accepts a single payload containing income, fixed expenses, and goals
 * so the wizard can submit everything in one request, then marks onboarding complete.
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import User from '../models/User.js';
import Income from '../models/Income.js';
import FixedExpense from '../models/FixedExpense.js';
import Goal from '../models/Goal.js';

const router = Router();

// POST /api/onboarding/complete
// Body: { income, fixedExpenses, goals }
router.post('/complete', authMiddleware, async (req, res, next) => {
  try {
    const { userId, householdId } = req.user;
    const { income, fixedExpenses = [], goals = [] } = req.body;

    const promises = [];

    // ── Income ──────────────────────────────────────────────────────────────
    if (income && income.amount > 0) {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Calculate weekly amounts based on frequency
      let weeklyAmount = 0;
      switch (income.frequency) {
        case 'weekly':      weeklyAmount = income.amount; break;
        case 'biweekly':    weeklyAmount = income.amount / 2; break;
        case 'monthly':     weeklyAmount = income.amount / 4; break;
        case 'semimonthly': weeklyAmount = income.amount / 2; break;
        default:            weeklyAmount = income.amount / 4;
      }

      // Create income entries for all 4 weeks of the current month
      for (let week = 1; week <= 4; week++) {
        promises.push(
          Income.findOneAndUpdate(
            { householdId, month, week },
            {
              $setOnInsert: {
                householdId,
                userId,
                contributorName: income.contributorName || 'Primary',
                week,
                month,
                weeklyTotal: weeklyAmount,
                dailyBreakdown: [],
                projection: { currentPace: weeklyAmount * 4, confidence: 'high' },
                createdAt: new Date(),
              }
            },
            { upsert: true, new: true }
          )
        );
      }
    }

    // ── Fixed Expenses ───────────────────────────────────────────────────────
    for (const fe of fixedExpenses) {
      if (fe.name && fe.amount > 0) {
        promises.push(
          FixedExpense.create({
            householdId,
            userId,
            name: fe.name,
            amount: fe.amount,
            group: fe.group || 'Other',
            frequency: fe.frequency || 'monthly',
            dueDay: fe.dueDay || 1,
            isActive: true,
          })
        );
      }
    }

    // ── Goals ────────────────────────────────────────────────────────────────
    for (const g of goals) {
      if (g.name && (g.target > 0 || g.monthlyContribution > 0)) {
        promises.push(
          Goal.create({
            householdId,
            userId,
            name: g.name,
            target: g.target || 0,
            monthlyContribution: g.monthlyContribution || 0,
            currentBalance: g.currentBalance || 0,
            type: g.type || 'Other',
            isActive: true,
          })
        );
      }
    }

    await Promise.all(promises);

    // Mark onboarding as complete
    await User.findOneAndUpdate({ userId }, { onboardingCompleted: true });

    res.json({ success: true, message: 'Onboarding complete' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/onboarding/skip — skip onboarding without entering data
router.patch('/skip', authMiddleware, async (req, res, next) => {
  try {
    const { userId } = req.user;
    await User.findOneAndUpdate({ userId }, { onboardingCompleted: true });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
