import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import GoalContribution from '../models/GoalContribution.js';
import Goal from '../models/Goal.js';

const router = Router({ mergeParams: true });

// GET contributions for a goal
router.get('/:householdId/:goalId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, goalId } = req.params;
    
    console.log('[goalContribution GET] fetching for:', { householdId, goalId });

    const contributions = await GoalContribution.find({ householdId, goalId })
      .sort({ contributionDate: -1 });

    const total = contributions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    console.log('[goalContribution GET] found', contributions.length, 'contributions, total:', total);
    res.json({ contributions, total });
  } catch (err) {
    console.error('[goalContribution GET] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// POST create a contribution (and update goal's currentBalance)
router.post('/:householdId/:goalId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, goalId } = req.params;
    const { amount, contributionDate, method, notes } = req.body;
    
    console.log('[goalContribution POST] incoming', { householdId, goalId, amount, contributionDate });

    if (!amount || !contributionDate) {
      return res.status(400).json({ error: 'amount and contributionDate required' });
    }

    // Verify goal exists and belongs to household
    const goal = await Goal.findOne({ _id: goalId, householdId });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    // Create contribution
    const contribution = await GoalContribution.create({
      householdId,
      goalId,
      amount: Number(amount),
      contributionDate: new Date(contributionDate),
      method: method || 'bank',
      notes: notes || '',
    });

    // Update goal's currentBalance
    goal.currentBalance += Number(amount);
    await goal.save();

    // Recalculate progressPercent
    const doc = goal.toObject();
    doc.progressPercent = doc.target > 0
      ? Math.min(100, Math.round((doc.currentBalance / doc.target) * 100))
      : null;

    console.log('[goalContribution POST] created', { id: contribution._id, newBalance: goal.currentBalance });
    res.status(201).json({ contribution, goal: doc });
  } catch (err) {
    console.error('[goalContribution POST] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// DELETE remove a contribution (and update goal's currentBalance)
router.delete('/:householdId/:goalId/:id', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, goalId, id } = req.params;
    
    console.log('[goalContribution DELETE] incoming', { householdId, goalId, id });

    const contribution = await GoalContribution.findOne({ _id: id, householdId, goalId });
    if (!contribution) return res.status(404).json({ error: 'Contribution not found' });

    const amount = contribution.amount;

    // Update goal's currentBalance
    const goal = await Goal.findOne({ _id: goalId, householdId });
    if (goal) {
      goal.currentBalance = Math.max(0, goal.currentBalance - amount);
      await goal.save();
    }

    await GoalContribution.deleteOne({ _id: id });
    console.log('[goalContribution DELETE] success', { id, reversedAmount: amount });
    res.json({ success: true });
  } catch (err) {
    console.error('[goalContribution DELETE] error', err && (err.stack || err.message || err));
    next(err);
  }
});

export default router;
