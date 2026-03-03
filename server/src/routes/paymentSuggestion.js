import { Router } from 'express';
import { authMiddleware, householdAuthMiddleware } from '../middleware/auth.js';
import PaymentSuggestion from '../models/PaymentSuggestion.js';
import DebtPayment from '../models/DebtPayment.js';
import CreditCard from '../models/CreditCard.js';

const router = Router({ mergeParams: true });

// ── GET /:householdId  — list pending (or all) suggestions ───────────────────

router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { status = 'pending' } = req.query;

    const query = { householdId };
    if (status !== 'all') query.status = status;

    const suggestions = await PaymentSuggestion.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ suggestions, count: suggestions.length });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /:householdId/:id/confirm  — create DebtPayment + mark confirmed ───

router.patch('/:householdId/:id/confirm', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;

    const suggestion = await PaymentSuggestion.findOne({ _id: id, householdId, status: 'pending' });
    if (!suggestion) return res.status(404).json({ error: 'Suggestion not found or already actioned' });

    // Create the DebtPayment — the model middleware auto-adjusts card balance
    const payment = await DebtPayment.create({
      householdId,
      cardId: suggestion.cardId,
      paymentDate: suggestion.date || new Date().toISOString().substring(0, 10),
      month: suggestion.month,
      amountPaid: suggestion.amount,
      notes: `Auto-detected from bank statement: ${suggestion.description}`,
      createdBy: req.user.userId,
    });

    suggestion.status = 'confirmed';
    suggestion.debtPaymentId = payment._id;
    await suggestion.save();

    res.json({ success: true, payment, suggestion });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /:householdId/:id/reject  — dismiss suggestion ─────────────────────

router.patch('/:householdId/:id/reject', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;

    const suggestion = await PaymentSuggestion.findOneAndUpdate(
      { _id: id, householdId, status: 'pending' },
      { status: 'rejected', updatedAt: new Date() },
      { new: true }
    );
    if (!suggestion) return res.status(404).json({ error: 'Suggestion not found or already actioned' });

    res.json({ success: true, suggestion });
  } catch (err) {
    next(err);
  }
});

export default router;
