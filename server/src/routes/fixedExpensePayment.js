import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import FixedExpensePayment from '../models/FixedExpensePayment.js';

const router = Router({ mergeParams: true });

// GET payments for a household (optionally filtered by month)
router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { month } = req.query; // Format: "2026-02"
    
    console.log('[fixedExpensePayment GET] fetching for:', { householdId, month });

    let query = { householdId };
    if (month) query.monthPaid = month;

    const payments = await FixedExpensePayment.find(query)
      .sort({ paymentDate: -1 })
      .populate('fixedExpenseId', 'name amount');

    const total = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    console.log('[fixedExpensePayment GET] found', payments.length, 'payments, total:', total);
    res.json({ householdId, payments, total });
  } catch (err) {
    console.error('[fixedExpensePayment GET] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// POST create a payment
router.post('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { fixedExpenseId, amount, paymentDate, method, notes } = req.body;
    
    console.log('[fixedExpensePayment POST] incoming', { householdId, fixedExpenseId, amount, paymentDate });

    if (!fixedExpenseId || !amount || !paymentDate) {
      return res.status(400).json({ error: 'fixedExpenseId, amount, and paymentDate required' });
    }

    // Extract monthPaid from paymentDate (YYYY-MM format)
    const date = new Date(paymentDate);
    const monthPaid = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const payment = await FixedExpensePayment.create({
      householdId,
      fixedExpenseId,
      amount: Number(amount),
      paymentDate: new Date(paymentDate),
      method: method || 'online',
      notes: notes || '',
      monthPaid,
    });

    console.log('[fixedExpensePayment POST] created', { id: payment._id });
    res.status(201).json({ payment });
  } catch (err) {
    console.error('[fixedExpensePayment POST] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// DELETE remove a payment
router.delete('/:householdId/:id', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;
    
    console.log('[fixedExpensePayment DELETE] incoming', { householdId, id });

    const payment = await FixedExpensePayment.findOne({ _id: id, householdId });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    await FixedExpensePayment.deleteOne({ _id: id });
    console.log('[fixedExpensePayment DELETE] success', { id });
    res.json({ success: true });
  } catch (err) {
    console.error('[fixedExpensePayment DELETE] error', err && (err.stack || err.message || err));
    next(err);
  }
});

export default router;
