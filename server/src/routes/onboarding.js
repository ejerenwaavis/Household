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
    const { income, weeklyActuals = [], fixedExpenses = [], goals = [] } = req.body;

    const promises = [];

    // ── Income ──────────────────────────────────────────────────────────────
    // Seed one Income document per week the user confirmed receiving pay.
    // weeklyActuals = [{week, amount, contributorName}] — only past/current weeks,
    // actual amounts the user entered. Nothing is assumed or projected forward.
    if (weeklyActuals.length > 0) {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      for (const { week, amount, contributorName: cn } of weeklyActuals) {
        if (!amount || Number(amount) <= 0) continue;
        const weekStartDay = (week - 1) * 7 + 1;
        const entryDate = new Date(`${month}-${String(weekStartDay).padStart(2, '0')}T12:00:00Z`);
        const amt = Math.round(Number(amount) * 100) / 100; // precision to the cent
        promises.push(
          Income.findOneAndUpdate(
            { householdId, month, week },
            {
              $setOnInsert: {
                householdId,
                userId,
                contributorName: cn || income?.contributorName || 'Primary',
                week,
                month,
                weeklyTotal: amt,
                dailyBreakdown: [{ date: entryDate.toISOString(), amount: amt, source: 'onboarding' }],
                projection: { currentPace: amt, confidence: 1 },
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
