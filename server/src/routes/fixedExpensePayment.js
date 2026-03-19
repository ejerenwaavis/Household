import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import FixedExpensePayment from '../models/FixedExpensePayment.js';
import Goal from '../models/Goal.js';
import GoalContribution from '../models/GoalContribution.js';
import LinkedAccount from '../models/LinkedAccount.js';
import { createFixedExpensePaymentAndMirror } from '../services/fixedExpensePaymentService.js';
import { getFixedExpenseReviewCandidates } from '../services/fixedExpensePaymentService.js';
import PlaidTransaction from '../models/PlaidTransaction.js';

const router = Router({ mergeParams: true });

function isLiabilityLinkedAccount(account) {
  const type = String(account?.accountType || '').toLowerCase();
  const subtype = String(account?.accountSubtype || '').toLowerCase();
  return type === 'loan' || subtype.includes('mortgage') || subtype.includes('loan');
}

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

// GET near-match candidates for manual review
router.get('/:householdId/review-candidates', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month is required' });

    const candidates = await getFixedExpenseReviewCandidates(householdId, month);
    res.json({ householdId, month, candidates });
  } catch (err) {
    console.error('[fixedExpensePayment REVIEW] error', err && (err.stack || err.message || err));
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

    const { payment } = await createFixedExpensePaymentAndMirror({
      householdId,
      fixedExpenseId,
      amount,
      paymentDate,
      method,
      notes,
      source: 'manual',
    });

    console.log('[fixedExpensePayment POST] created', { id: payment._id });
    res.status(201).json({ payment });
  } catch (err) {
    console.error('[fixedExpensePayment POST] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// POST confirm a suggested payment candidate
router.post('/:householdId/confirm-candidate', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { fixedExpenseId, plaidTransactionId } = req.body;
    if (!fixedExpenseId || !plaidTransactionId) {
      return res.status(400).json({ error: 'fixedExpenseId and plaidTransactionId required' });
    }

    const transaction = await PlaidTransaction.findOne({ _id: plaidTransactionId, householdId });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const result = await createFixedExpensePaymentAndMirror({
      householdId,
      fixedExpenseId,
      amount: Number(transaction.amount),
      paymentDate: transaction.date,
      method: transaction.paymentMethod === 'in store' ? 'other' : 'online',
      notes: `Confirmed from Plaid review queue: ${transaction.merchant || transaction.name}`,
      source: 'plaid_auto',
      plaidTransactionId: transaction._id,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('[fixedExpensePayment CONFIRM] error', err && (err.stack || err.message || err));
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

    const mirroredContributions = await GoalContribution.find({ fixedExpensePaymentId: payment._id, householdId });
    for (const contribution of mirroredContributions) {
      const goal = await Goal.findOne({ _id: contribution.goalId, householdId });
      if (goal) {
        goal.currentBalance += Number(contribution.amount) || 0;
        await goal.save();
      }
      await GoalContribution.deleteOne({ _id: contribution._id });
    }

    await FixedExpensePayment.deleteOne({ _id: id });
    console.log('[fixedExpensePayment DELETE] success', { id });
    res.json({ success: true });
  } catch (err) {
    console.error('[fixedExpensePayment DELETE] error', err && (err.stack || err.message || err));
    next(err);
  }
});

export default router;
