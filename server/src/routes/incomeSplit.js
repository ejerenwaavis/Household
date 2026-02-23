import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import IncomeSplit from '../models/IncomeSplit.js';
import Household from '../models/Household.js';

const router = Router({ mergeParams: true });

// GET all income splits for a household
router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    
    console.log('[incomeSplit GET] fetching for:', { householdId });

    const splits = await IncomeSplit.find({ householdId })
      .populate('userId', 'name email')
      .sort({ isHeadOfHouse: -1, createdAt: 1 });

    const totalSplit = splits.reduce((sum, s) => sum + (s.splitPercentage || 0), 0);

    console.log('[incomeSplit GET] found', splits.length, 'splits, total:', totalSplit);
    res.json({ splits, totalSplit });
  } catch (err) {
    console.error('[incomeSplit GET] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// POST create or update a split for a member
router.post('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { userId, splitPercentage } = req.body;
    
    console.log('[incomeSplit POST] incoming', { householdId, userId, splitPercentage });

    if (!userId || splitPercentage === undefined) {
      return res.status(400).json({ error: 'userId and splitPercentage required' });
    }

    if (splitPercentage < 0 || splitPercentage > 100) {
      return res.status(400).json({ error: 'splitPercentage must be between 0 and 100' });
    }

    let split = await IncomeSplit.findOne({ householdId, userId });
    
    if (split) {
      split.splitPercentage = splitPercentage;
      split.updatedAt = new Date();
      await split.save();
      console.log('[incomeSplit POST] updated', { id: split._id });
    } else {
      split = await IncomeSplit.create({
        householdId,
        userId,
        splitPercentage,
      });
      console.log('[incomeSplit POST] created', { id: split._id });
    }

    res.status(201).json({ split });
  } catch (err) {
    console.error('[incomeSplit POST] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// PATCH update split percentage
router.patch('/:householdId/:userId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, userId } = req.params;
    const { splitPercentage } = req.body;
    
    console.log('[incomeSplit PATCH] incoming', { householdId, userId, splitPercentage });

    if (splitPercentage === undefined) {
      return res.status(400).json({ error: 'splitPercentage required' });
    }

    if (splitPercentage < 0 || splitPercentage > 100) {
      return res.status(400).json({ error: 'splitPercentage must be between 0 and 100' });
    }

    const split = await IncomeSplit.findOne({ householdId, userId });
    if (!split) return res.status(404).json({ error: 'Income split not found' });

    split.splitPercentage = splitPercentage;
    split.updatedAt = new Date();
    await split.save();

    console.log('[incomeSplit PATCH] updated', { id: split._id });
    res.json({ split });
  } catch (err) {
    console.error('[incomeSplit PATCH] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// DELETE remove a split
router.delete('/:householdId/:userId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, userId } = req.params;
    
    console.log('[incomeSplit DELETE] incoming', { householdId, userId });

    const split = await IncomeSplit.findOne({ householdId, userId });
    if (!split) return res.status(404).json({ error: 'Income split not found' });

    await IncomeSplit.deleteOne({ _id: split._id });
    console.log('[incomeSplit DELETE] success', { id: split._id });
    res.json({ success: true });
  } catch (err) {
    console.error('[incomeSplit DELETE] error', err && (err.stack || err.message || err));
    next(err);
  }
});

export default router;
