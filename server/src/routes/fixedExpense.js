import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import FixedExpense from '../models/FixedExpense.js';
import { translateText } from '../services/translationService.js';

const router = Router({ mergeParams: true });

// Get all fixed expenses for a household
router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { lang = 'en' } = req.query; // Get language from query param
    
    console.log('[fixedExpense GET] fetching for householdId:', householdId, 'lang:', lang);

    let expenses = await FixedExpense.find({ householdId, isActive: true }).sort({ group: 1, name: 1 });
    
    // Add translations if language is Spanish
    if (lang === 'es') {
      expenses = await Promise.all(
        expenses.map(async (expense) => {
          const doc = expense.toObject();
          doc.name_es = await translateText(doc.name, 'es', 'en');
          doc.group_es = await translateText(doc.group, 'es', 'en');
          return doc;
        })
      );
    }

    const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Group by category
    const byGroup = {};
    expenses.forEach((e) => {
      // Use translated group name if available
      const groupName = lang === 'es' && e.group_es ? e.group_es : e.group;
      if (!byGroup[groupName]) byGroup[groupName] = [];
      byGroup[groupName].push(e);
    });

    console.log('[fixedExpense GET] found', expenses.length, 'expenses, total:', total);
    res.json({
      householdId,
      expenses,
      byGroup,
      total,
    });
  } catch (error) {
    console.error('[fixedExpense GET] error', error && (error.stack || error.message || error));
    next(error);
  }
});

// Create a fixed expense
router.post('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { name, nameES, amount, group, frequency, dueDay } = req.body;
    console.log('[fixedExpense POST] incoming', { householdId, user: req.user?.userId, body: req.body });

    if (!name || !amount) {
      return res.status(400).json({ error: 'Name and amount required' });
    }

    const expense = await FixedExpense.create({
      householdId,
      userId: req.user.userId,
      name,
      nameES: nameES || '',
      amount: Number(amount),
      group: group || 'Other',
      frequency: frequency || 'monthly',
      dueDay: dueDay || 1,
      isActive: true,
    });

    console.log('[fixedExpense POST] created', expense && { id: expense._id, name: expense.name, amount: expense.amount });
    res.status(201).json({ id: expense._id, expense });
  } catch (error) {
    console.error('[fixedExpense POST] error', error && (error.stack || error.message || error));
    next(error);
  }
});

// Update a fixed expense
router.patch('/:householdId/:id', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;
    const updates = req.body || {};
    console.log('[fixedExpense PATCH] incoming', { householdId, id, user: req.user?.userId, updates });

    const expense = await FixedExpense.findOne({ _id: id, householdId });
    if (!expense) return res.status(404).json({ error: 'Fixed expense not found' });

    // Allow updating name, amount, group, frequency, dueDay, isActive
    if (updates.name) expense.name = updates.name;
    if (updates.nameES) expense.nameES = updates.nameES;
    if (typeof updates.amount !== 'undefined') expense.amount = Number(updates.amount);
    if (updates.group) expense.group = updates.group;
    if (updates.frequency) expense.frequency = updates.frequency;
    if (typeof updates.dueDay !== 'undefined') expense.dueDay = updates.dueDay;
    if (typeof updates.isActive !== 'undefined') expense.isActive = updates.isActive;

    await expense.save();
    console.log('[fixedExpense PATCH] saved', { id: expense._id });
    res.json({ expense });
  } catch (err) {
    console.error('[fixedExpense PATCH] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// Soft delete (mark inactive)
router.delete('/:householdId/:id', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;
    console.log('[fixedExpense DELETE] incoming', { householdId, id, user: req.user?.userId });

    const expense = await FixedExpense.findOne({ _id: id, householdId });
    if (!expense) return res.status(404).json({ error: 'Fixed expense not found' });

    expense.isActive = false;
    await expense.save();
    console.log('[fixedExpense DELETE] marked inactive', { id: expense._id });
    res.json({ success: true });
  } catch (err) {
    console.error('[fixedExpense DELETE] error', err && (err.stack || err.message || err));
    next(err);
  }
});

export default router;
