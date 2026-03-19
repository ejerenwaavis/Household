import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import CreditCard from '../models/CreditCard.js';
import LinkedAccount from '../models/LinkedAccount.js';

const router = Router();

// POST seed default credit cards (for testing/setup)
router.post('/:householdId/seed', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    
    // Check if cards already exist
    const existingCount = await CreditCard.countDocuments({ householdId });
    if (existingCount > 0) {
      return res.status(400).json({ 
        error: 'Credit cards already exist for this household. Delete them first if you want to re-seed.' 
      });
    }
    
    const seedCards = [
      {
        householdId,
        cardName: 'Chase',
        holder: 'Maria',
        originalBalance: 4393,
        currentBalance: 4393,
        minPayment: 125,
        plannedExtraPayment: 0,
        interestRate: 18.99,
        creditLimit: 5000,
        dueDay: 15
      },
      {
        householdId,
        cardName: 'Bank of America',
        holder: 'Maria',
        originalBalance: 2891,
        currentBalance: 2891,
        minPayment: 85,
        plannedExtraPayment: 0,
        interestRate: 21.24,
        creditLimit: 3500,
        dueDay: 22
      }
    ];
    
    const cards = await CreditCard.insertMany(seedCards);
    
    console.log('[CreditCard] Seeded:', cards.length, 'cards');
    res.status(201).json({ 
      success: true, 
      message: `Successfully seeded ${cards.length} credit cards`,
      cards 
    });
  } catch (error) {
    console.error('[CreditCard] Seed error:', error);
    next(error);
  }
});

// GET all credit cards for a household
router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;

    const manualCards = await CreditCard.find({ householdId })
      .sort({ createdAt: -1 });
    const assignedLinkedAccountIds = new Set(
      manualCards.map((card) => card.linkedAccountId).filter(Boolean).map(String)
    );

    const linkedCreditAccounts = await LinkedAccount.find({
      householdId,
      isActive: true,
      $or: [
        { accountType: 'credit' },
        { accountSubtype: 'credit card' },
      ],
    }).sort({ linkedAt: -1 });

    const availableLinkedCreditAccounts = linkedCreditAccounts.filter(
      (account) => !assignedLinkedAccountIds.has(String(account._id))
    );

    const syncedCards = availableLinkedCreditAccounts.map((account) => {
      const currentBalance = Number(account.currentBalance) || 0;
      const availableBalance = Number(account.availableBalance) || 0;
      const creditLimit = Number(account.creditLimit) || currentBalance + availableBalance;
      const utilizationPercent = creditLimit > 0 ? Math.round((currentBalance / creditLimit) * 100) : 0;

      return {
        _id: `linked-${account._id}`,
        linkedAccountId: String(account._id),
        cardName: account.accountOfficialName || account.accountName,
        holder: 'Plaid Sync',
        originalBalance: creditLimit,
        currentBalance,
        minPayment: 0,
        plannedExtraPayment: 0,
        interestRate: 0,
        creditLimit,
        availableBalance,
        accountMask: account.accountMask,
        accountSubtype: account.accountSubtype,
        accountType: account.accountType,
        linkedBankName: account.accountName,
        lastSyncedAt: account.lastSyncedAt,
        syncStatus: account.syncStatus,
        isSynced: true,
        sourceType: 'plaid',
        payoffPercent: Math.max(0, 100 - utilizationPercent),
        remaining: Math.max(0, availableBalance),
        utilizationPercent,
      };
    });

    const linkedAccountMap = new Map(linkedCreditAccounts.map((account) => [String(account._id), account]));

    const manualCardsWithMeta = manualCards.map((card) => {
      const linkedAccount = card.linkedAccountId ? linkedAccountMap.get(String(card.linkedAccountId)) : null;
      const currentBalance = linkedAccount ? (Number(linkedAccount.currentBalance) || 0) : (Number(card.currentBalance) || 0);
      const creditLimit = linkedAccount ? (Number(linkedAccount.creditLimit) || Number(card.creditLimit) || 0) : (Number(card.creditLimit) || 0);
      const availableBalance = linkedAccount
        ? (Number(linkedAccount.availableBalance) || Math.max(0, creditLimit - currentBalance))
        : Math.max(0, creditLimit - currentBalance);

      return {
        ...card.toObject(),
        currentBalance,
        creditLimit,
        availableBalance,
        accountMask: linkedAccount?.accountMask,
        accountSubtype: linkedAccount?.accountSubtype,
        accountType: linkedAccount?.accountType,
        linkedBankName: linkedAccount?.accountName || card.linkedBankName,
        lastSyncedAt: linkedAccount?.lastSyncedAt,
        syncStatus: linkedAccount?.syncStatus,
        isSynced: Boolean(linkedAccount),
        sourceType: linkedAccount ? 'manual-linked' : 'manual',
        utilizationPercent: creditLimit > 0
          ? Math.round((currentBalance / creditLimit) * 100)
          : 0,
      };
    });

    const cards = [...syncedCards, ...manualCardsWithMeta];

    const totalDebt = cards.reduce((sum, card) => sum + (Number(card.currentBalance) || 0), 0);
    const totalOriginal = cards.reduce((sum, card) => sum + (Number(card.originalBalance) || 0), 0);
    const totalPaid = cards.reduce((sum, card) => sum + (Number(card.availableBalance) || Math.max(0, (Number(card.originalBalance) || 0) - (Number(card.currentBalance) || 0))), 0);
    const totalCreditLimit = cards.reduce((sum, card) => sum + (Number(card.creditLimit) || 0), 0);
    const totalAvailableCredit = cards.reduce((sum, card) => sum + (Number(card.availableBalance) || 0), 0);
    const overallProgress = totalOriginal > 0 ? Math.round((totalPaid / totalOriginal) * 100) : 0;
    const overallUtilization = totalCreditLimit > 0 ? Math.round((totalDebt / totalCreditLimit) * 100) : 0;
    
    res.json({ 
      cards,
      summary: {
        totalDebt,
        totalOriginal,
        totalPaid,
        overallProgress,
        totalCreditLimit,
        totalAvailableCredit,
        overallUtilization,
        cardCount: cards.length,
        syncedCardCount: syncedCards.length,
        manualCardCount: manualCardsWithMeta.length,
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST create new credit card
router.post('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const cardData = { ...req.body, householdId };
    
    const card = await CreditCard.create(cardData);
    
    console.log('[CreditCard] Created:', card._id);
    res.status(201).json(card);
  } catch (error) {
    console.error('[CreditCard] Create error:', error);
    next(error);
  }
});

// PATCH update credit card
router.patch('/:householdId/:cardId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, cardId } = req.params;
    
    const card = await CreditCard.findOne({ _id: cardId, householdId });
    if (!card) {
      return res.status(404).json({ error: 'Credit card not found' });
    }
    
    Object.assign(card, req.body);
    card.updatedAt = new Date();
    await card.save();
    
    console.log('[CreditCard] Updated:', cardId);
    res.json(card);
  } catch (error) {
    console.error('[CreditCard] Update error:', error);
    next(error);
  }
});

// DELETE credit card
router.delete('/:householdId/:cardId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, cardId } = req.params;
    
    const card = await CreditCard.findOneAndDelete({ _id: cardId, householdId });
    if (!card) {
      return res.status(404).json({ error: 'Credit card not found' });
    }
    
    console.log('[CreditCard] Deleted:', cardId);
    res.json({ success: true, message: 'Credit card deleted' });
  } catch (error) {
    console.error('[CreditCard] Delete error:', error);
    next(error);
  }
});

export default router;
