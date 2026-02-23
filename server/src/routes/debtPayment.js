import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import DebtPayment from '../models/DebtPayment.js';
import CreditCard from '../models/CreditCard.js';
import CardStatement from '../models/CardStatement.js';

const router = Router();

// POST seed sample debt payments (for testing/setup)
router.post('/:householdId/seed', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    
    // Get existing credit cards
    const cards = await CreditCard.find({ householdId });
    if (cards.length === 0) {
      return res.status(400).json({ 
        error: 'No credit cards found. Create credit cards first before seeding payments.' 
      });
    }
    
    // Get existing statements
    const statements = await CardStatement.find({ householdId });
    
    // Check if payments already exist
    const existingCount = await DebtPayment.countDocuments({ householdId });
    if (existingCount > 0) {
      return res.status(400).json({ 
        error: 'Debt payments already exist for this household. Delete them first if you want to re-seed.' 
      });
    }
    
    const seedPayments = [];
    const months = ['2024-01', '2024-02', '2024-03'];
    
    // Create payments for each card and month
    for (const card of cards) {
      for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const paymentDate = new Date(`${month}-${card.dueDay || 15}`);
        const paymentAmount = (card.minPayment || 100) + (card.plannedExtraPayment || 0);
        
        // Try to find statement for this card/month
        const statement = statements.find(
          s => s.cardId.toString() === card._id.toString() && s.month === month
        );
        
        seedPayments.push({
          householdId,
          cardId: card._id,
          cardStatementId: statement?._id || null,
          month,
          paymentDate,
          amountPaid: paymentAmount,
          notes: `Payment for ${month}`
        });
      }
    }
    
    const payments = await DebtPayment.insertMany(seedPayments);
    
    console.log('[DebtPayment] Seeded:', payments.length, 'payments');
    res.status(201).json({ 
      success: true, 
      message: `Successfully seeded ${payments.length} debt payments`,
      payments 
    });
  } catch (error) {
    console.error('[DebtPayment] Seed error:', error);
    next(error);
  }
});

// GET all debt payments for a household
router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { month, cardId } = req.query;
    
    const query = { householdId };
    if (month) query.month = month;
    if (cardId) query.cardId = cardId;
    
    const payments = await DebtPayment.find(query)
      .populate('cardId', 'cardName holder')
      .populate('cardStatementId', 'statementName month')
      .sort({ paymentDate: -1 });
    
    // Group by month for summary
    const byMonth = {};
    payments.forEach(payment => {
      if (!byMonth[payment.month]) {
        byMonth[payment.month] = {
          month: payment.month,
          payments: [],
          totalPaid: 0,
          paymentCount: 0
        };
      }
      byMonth[payment.month].payments.push(payment);
      byMonth[payment.month].totalPaid += payment.amountPaid;
      byMonth[payment.month].paymentCount += 1;
    });
    
    const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
    
    res.json({ 
      payments,
      byMonth: Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month)),
      summary: {
        totalPaid,
        paymentCount: payments.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST create new debt payment
router.post('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const paymentData = { ...req.body, householdId };
    
    // Verify the card belongs to this household
    const card = await CreditCard.findOne({ 
      _id: paymentData.cardId, 
      householdId 
    });
    
    if (!card) {
      return res.status(404).json({ error: 'Credit card not found in this household' });
    }
    
    // Create the payment
    const payment = await DebtPayment.create(paymentData);
    
    // Update the credit card's current balance
    card.currentBalance = Math.max(0, card.currentBalance - payment.amountPaid);
    card.updatedAt = new Date();
    await card.save();
    
    // If linked to a statement, update statement's current balance
    if (payment.cardStatementId) {
      const statement = await CardStatement.findById(payment.cardStatementId);
      if (statement) {
        statement.currentBalance = Math.max(0, statement.currentBalance - payment.amountPaid);
        statement.updatedAt = new Date();
        await statement.save();
      }
    }
    
    const populated = await DebtPayment.findById(payment._id)
      .populate('cardId', 'cardName holder')
      .populate('cardStatementId', 'statementName month');
    
    console.log('[DebtPayment] Created:', payment._id, 'Updated card balance:', card.currentBalance);
    res.status(201).json(populated);
  } catch (error) {
    console.error('[DebtPayment] Create error:', error);
    next(error);
  }
});

// PATCH update debt payment
router.patch('/:householdId/:paymentId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, paymentId } = req.params;
    
    const payment = await DebtPayment.findOne({ _id: paymentId, householdId });
    if (!payment) {
      return res.status(404).json({ error: 'Debt payment not found' });
    }
    
    const oldAmount = payment.amountPaid;
    const newAmount = req.body.amountPaid !== undefined ? req.body.amountPaid : oldAmount;
    const amountDifference = newAmount - oldAmount;
    
    Object.assign(payment, req.body);
    payment.updatedAt = new Date();
    await payment.save();
    
    // Adjust credit card balance if amount changed
    if (amountDifference !== 0) {
      const card = await CreditCard.findById(payment.cardId);
      if (card) {
        card.currentBalance = Math.max(0, card.currentBalance - amountDifference);
        card.updatedAt = new Date();
        await card.save();
        console.log('[DebtPayment] Adjusted card balance by:', amountDifference, 'New balance:', card.currentBalance);
      }
      
      // Also adjust statement if linked
      if (payment.cardStatementId) {
        const statement = await CardStatement.findById(payment.cardStatementId);
        if (statement) {
          statement.currentBalance = Math.max(0, statement.currentBalance - amountDifference);
          statement.updatedAt = new Date();
          await statement.save();
        }
      }
    }
    
    const populated = await DebtPayment.findById(payment._id)
      .populate('cardId', 'cardName holder')
      .populate('cardStatementId', 'statementName month');
    
    console.log('[DebtPayment] Updated:', paymentId);
    res.json(populated);
  } catch (error) {
    console.error('[DebtPayment] Update error:', error);
    next(error);
  }
});

// DELETE debt payment
router.delete('/:householdId/:paymentId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, paymentId } = req.params;
    
    const payment = await DebtPayment.findOne({ _id: paymentId, householdId });
    if (!payment) {
      return res.status(404).json({ error: 'Debt payment not found' });
    }
    
    // Reverse the payment by adding back to card balance
    const card = await CreditCard.findById(payment.cardId);
    if (card) {
      card.currentBalance += payment.amountPaid;
      card.updatedAt = new Date();
      await card.save();
      console.log('[DebtPayment] Reversed payment, added back:', payment.amountPaid, 'New balance:', card.currentBalance);
    }
    
    // Also reverse statement if linked
    if (payment.cardStatementId) {
      const statement = await CardStatement.findById(payment.cardStatementId);
      if (statement) {
        statement.currentBalance += payment.amountPaid;
        statement.updatedAt = new Date();
        await statement.save();
      }
    }
    
    await payment.deleteOne();
    
    console.log('[DebtPayment] Deleted:', paymentId);
    res.json({ success: true, message: 'Debt payment deleted and balances adjusted' });
  } catch (error) {
    console.error('[DebtPayment] Delete error:', error);
    next(error);
  }
});

export default router;
