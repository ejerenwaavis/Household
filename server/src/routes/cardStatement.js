import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import { cardStatementSchemas, validateBody } from '../utils/validationSchemas.js';
import { validateCardStatement } from '../utils/businessLogicValidators.js';
import CardStatement from '../models/CardStatement.js';
import CreditCard from '../models/CreditCard.js';

const router = Router();

// POST migrate statements to fix month values
router.post('/:householdId/migrate-fix-months', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    
    // Get all statements for this household
    const statements = await CardStatement.find({ householdId });
    
    let fixedCount = 0;
    
    for (const stmt of statements) {
      // Calculate correct month from statementDate
      const date = new Date(stmt.statementDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const correctMonth = `${year}-${month}`;
      
      // Only fix if month is different
      if (stmt.month !== correctMonth) {
        stmt.month = correctMonth;
        await stmt.save();
        fixedCount++;
      }
    }
    
    console.log('[CardStatement] Fixed months for', fixedCount, 'statements');
    res.json({ 
      success: true, 
      message: `Fixed month values for ${fixedCount} statements`
    });
  } catch (error) {
    console.error('[CardStatement] Migration error:', error);
    next(error);
  }
});

// POST seed default statements (for testing/setup)
router.post('/:householdId/seed', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    
    // Get existing credit cards
    const cards = await CreditCard.find({ householdId });
    if (cards.length === 0) {
      return res.status(400).json({ 
        error: 'No credit cards found. Create credit cards first before seeding statements.' 
      });
    }
    
    // Check if statements already exist
    const existingCount = await CardStatement.countDocuments({ householdId });
    if (existingCount > 0) {
      return res.status(400).json({ 
        error: 'Card statements already exist for this household. Delete them first if you want to re-seed.' 
      });
    }
    
    const seedStatements = [];
    const months = ['2024-01', '2024-02', '2024-03'];
    
    // Create statements for each card and month
    for (const card of cards) {
      let balance = card.originalBalance;
      for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const statementDate = new Date(`${month}-15`);
        const statementBalance = balance;
        // Simulate some payment each month
        const payment = card.minPayment + (card.plannedExtraPayment || 0);
        const currentBalance = Math.max(0, balance - payment);
        
        seedStatements.push({
          householdId,
          cardId: card._id,
          statementName: `${card.cardName} - ${month}`,
          month,
          statementDate,
          statementBalance,
          currentBalance
        });
        
        balance = currentBalance;
      }
    }
    
    const statements = await CardStatement.insertMany(seedStatements);
    
    console.log('[CardStatement] Seeded:', statements.length, 'statements');
    res.status(201).json({ 
      success: true, 
      message: `Successfully seeded ${statements.length} card statements`,
      statements 
    });
  } catch (error) {
    console.error('[CardStatement] Seed error:', error);
    next(error);
  }
});

// GET all statements for a household
router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { month, cardId } = req.query;
    
    const query = { householdId };
    if (month) query.month = month;
    if (cardId) query.cardId = cardId;
    
    const statements = await CardStatement.find(query)
      .populate('cardId', 'cardName holder')
      .sort({ month: -1, statementDate: -1 });
    
    // Group by month for summary
    const byMonth = {};
    statements.forEach(stmt => {
      console.log('[CardStatement] Statement month value:', {
        statementName: stmt.statementName,
        month: stmt.month,
        statementDate: stmt.statementDate
      });
      
      if (!byMonth[stmt.month]) {
        byMonth[stmt.month] = {
          month: stmt.month,
          statements: [],
          totalStatementBalance: 0,
          totalCurrentBalance: 0,
          totalPaid: 0
        };
      }
      byMonth[stmt.month].statements.push(stmt);
      byMonth[stmt.month].totalStatementBalance += stmt.statementBalance;
      byMonth[stmt.month].totalCurrentBalance += stmt.currentBalance;
      byMonth[stmt.month].totalPaid += (stmt.statementBalance - stmt.currentBalance);
    });
    
    const groupedByMonth = Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month));
    console.log('[CardStatement] Final grouped months:', groupedByMonth.map(g => g.month));
    
    res.json({ 
      statements,
      byMonth: groupedByMonth
    });
  } catch (error) {
    next(error);
  }
});

// POST create new card statement
router.post('/:householdId', authMiddleware, householdAuthMiddleware, validateBody(cardStatementSchemas.create), async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const statementData = { ...req.body, householdId };
    
    // Verify the card belongs to this household
    const card = await CreditCard.findOne({ 
      _id: statementData.cardId, 
      householdId 
    });
    
    if (!card) {
      return res.status(404).json({ error: 'Credit card not found in this household' });
    }
    
    // Check if a statement already exists for this card and month
    const existingStatement = await CardStatement.findOne({
      householdId,
      cardId: statementData.cardId,
      month: statementData.month
    });
    
    if (existingStatement) {
      return res.status(409).json({ 
        error: `A statement for ${card.cardName} in this month already exists. Please edit the existing statement instead.`,
        existingStatement,
        code: 'DUPLICATE_STATEMENT'
      });
    }

    // Validate business logic rules
    const businessLogicResult = await validateCardStatement(statementData, card, null);
    if (!businessLogicResult.valid) {
      return res.status(400).json({
        error: 'Business logic validation failed',
        details: businessLogicResult.errors,
        statusCode: 400
      });
    }
    
    const statement = await CardStatement.create(statementData);
    const populated = await CardStatement.findById(statement._id).populate('cardId', 'cardName holder');
    
    console.log('[CardStatement] Created:', statement._id);
    res.status(201).json(populated);
  } catch (error) {
    console.error('[CardStatement] Create error:', error);
    next(error);
  }
});

// PATCH update card statement
router.patch('/:householdId/:statementId', authMiddleware, householdAuthMiddleware, validateBody(cardStatementSchemas.update), async (req, res, next) => {
  try {
    const { householdId, statementId } = req.params;
    
    const statement = await CardStatement.findOne({ _id: statementId, householdId });
    if (!statement) {
      return res.status(404).json({ error: 'Card statement not found' });
    }
    
    // If month is being changed, check for duplicates
    if (req.body.month && req.body.month !== statement.month) {
      const existingStatement = await CardStatement.findOne({
        householdId,
        cardId: statement.cardId,
        month: req.body.month,
        _id: { $ne: statementId } // Exclude current statement
      });
      
      if (existingStatement) {
        return res.status(409).json({
          error: `A statement for this card in that month already exists.`,
          code: 'DUPLICATE_STATEMENT'
        });
      }
    }

    // Get card for business logic validation
    const card = await CreditCard.findOne({ _id: statement.cardId, householdId });
    
    // Merge current and updated data for validation
    const updatedStatement = { ...statement.toObject(), ...req.body };
    
    // Validate business logic rules
    const businessLogicResult = await validateCardStatement(updatedStatement, card, null);
    if (!businessLogicResult.valid) {
      return res.status(400).json({
        error: 'Business logic validation failed',
        details: businessLogicResult.errors,
        statusCode: 400
      });
    }
    
    Object.assign(statement, req.body);
    statement.updatedAt = new Date();
    await statement.save();
    
    const populated = await CardStatement.findById(statement._id).populate('cardId', 'cardName holder');
    
    console.log('[CardStatement] Updated:', statementId);
    res.json(populated);
  } catch (error) {
    console.error('[CardStatement] Update error:', error);
    next(error);
  }
});

// DELETE card statement
router.delete('/:householdId/:statementId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, statementId } = req.params;
    
    const statement = await CardStatement.findOneAndDelete({ _id: statementId, householdId });
    if (!statement) {
      return res.status(404).json({ error: 'Card statement not found' });
    }
    
    console.log('[CardStatement] Deleted:', statementId);
    res.json({ success: true, message: 'Card statement deleted' });
  } catch (error) {
    console.error('[CardStatement] Delete error:', error);
    next(error);
  }
});

export default router;
