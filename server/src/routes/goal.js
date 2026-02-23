import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import Goal from '../models/Goal.js';

const router = Router({ mergeParams: true });

// GET all goals for a household
router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    console.log('[goals GET] fetching for householdId:', householdId);

    const goals = await Goal.find({ householdId, isActive: true }).sort({ type: 1, name: 1 });

    const goalsWithProgress = goals.map((g) => {
      const doc = g.toObject();
      doc.progressPercent = doc.target > 0
        ? Math.min(100, Math.round((doc.currentBalance / doc.target) * 100))
        : null;
      return doc;
    });

    const totalMonthlyContribution = goals.reduce((sum, g) => sum + (g.monthlyContribution || 0), 0);

    console.log('[goals GET] found', goals.length, 'goals, totalMonthly:', totalMonthlyContribution);
    res.json({ householdId, goals: goalsWithProgress, totalMonthlyContribution });
  } catch (err) {
    console.error('[goals GET] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// POST create a goal
router.post('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { name, monthlyContribution, target, currentBalance, type } = req.body;
    console.log('[goals POST] incoming', { householdId, user: req.user?.userId, body: req.body });

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Goal name required' });
    }

    const goal = await Goal.create({
      householdId,
      userId: req.user.userId,
      name: name.trim(),
      monthlyContribution: Number(monthlyContribution) || 0,
      target: Number(target) || 0,
      currentBalance: Number(currentBalance) || 0,
      type: type || 'Other',
    });

    const doc = goal.toObject();
    doc.progressPercent = doc.target > 0
      ? Math.min(100, Math.round((doc.currentBalance / doc.target) * 100))
      : null;

    console.log('[goals POST] created', { id: goal._id, name: goal.name });
    res.status(201).json({ goal: doc });
  } catch (err) {
    console.error('[goals POST] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// PATCH update a goal
router.patch('/:householdId/:id', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;
    const updates = req.body || {};
    console.log('[goals PATCH] incoming', { householdId, id, updates });

    const goal = await Goal.findOne({ _id: id, householdId });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    if (updates.name) goal.name = updates.name.trim();
    if (typeof updates.monthlyContribution !== 'undefined') goal.monthlyContribution = Number(updates.monthlyContribution);
    if (typeof updates.target !== 'undefined') goal.target = Number(updates.target);
    if (typeof updates.currentBalance !== 'undefined') goal.currentBalance = Number(updates.currentBalance);
    if (updates.type) goal.type = updates.type;

    await goal.save();

    const doc = goal.toObject();
    doc.progressPercent = doc.target > 0
      ? Math.min(100, Math.round((doc.currentBalance / doc.target) * 100))
      : null;

    console.log('[goals PATCH] saved', { id: goal._id });
    res.json({ goal: doc });
  } catch (err) {
    console.error('[goals PATCH] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// DELETE (soft) a goal
router.delete('/:householdId/:id', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;
    console.log('[goals DELETE] incoming', { householdId, id });

    const goal = await Goal.findOne({ _id: id, householdId });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    goal.isActive = false;
    await goal.save();
    console.log('[goals DELETE] marked inactive', { id: goal._id });
    res.json({ success: true });
  } catch (err) {
    console.error('[goals DELETE] error', err && (err.stack || err.message || err));
    next(err);
  }
});

export default router;
