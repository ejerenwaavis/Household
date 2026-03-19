import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import Goal from '../models/Goal.js';
import LinkedAccount from '../models/LinkedAccount.js';
import FixedExpense from '../models/FixedExpense.js';
import { getLiabilityReport } from '../services/liabilityReportService.js';

const router = Router({ mergeParams: true });

function shouldAutoSyncLinkedAccount(account) {
  return Boolean(account && account.isActive);
}

function buildLinkedAccountLabel(account) {
  if (!account) return null;
  return `${account.accountName}${account.accountMask ? ` ••${account.accountMask}` : ''}`;
}

function isLiabilityLinkedAccount(account) {
  const type = String(account?.accountType || '').toLowerCase();
  const subtype = String(account?.accountSubtype || '').toLowerCase();
  return type === 'loan' || subtype.includes('mortgage') || subtype.includes('loan');
}

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveLinkedFixedExpense(householdId, goalDoc, linkedAccount) {
  if (!isLiabilityLinkedAccount(linkedAccount)) return null;

  if (goalDoc.linkedFixedExpenseId) {
    return FixedExpense.findOne({ _id: goalDoc.linkedFixedExpenseId, householdId, isActive: true })
      .select('name amount group')
      .lean();
  }

  const fixedExpenses = await FixedExpense.find({ householdId, isActive: true })
    .select('name amount group')
    .lean();

  const goalText = normalizeText(`${goalDoc.name || ''} ${linkedAccount?.accountName || ''} ${linkedAccount?.accountOfficialName || ''} ${linkedAccount?.accountSubtype || ''}`);
  const monthlyContribution = Number(goalDoc.monthlyContribution || 0);

  const ranked = fixedExpenses
    .map((expense) => {
      const expenseName = normalizeText(expense.name);
      let score = 0;

      if (monthlyContribution > 0 && Math.abs((Number(expense.amount) || 0) - monthlyContribution) <= 0.01) score += 5;
      if (goalText.includes(expenseName) || expenseName.includes(goalText)) score += 4;
      if (expense.group === 'Housing') score += 2;
      if (expense.group === 'Debt') score += 1;

      return { expense, score };
    })
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  if (!best || best.score <= 0) return null;

  await Goal.updateOne(
    { _id: goalDoc._id },
    {
      linkedFixedExpenseId: String(best.expense._id),
      linkedFixedExpenseName: best.expense.name,
    }
  );

  goalDoc.linkedFixedExpenseId = String(best.expense._id);
  goalDoc.linkedFixedExpenseName = best.expense.name;
  return best.expense;
}

function getGoalProgressPercent(goalDoc, linkedAccount) {
  const target = Number(goalDoc.target || 0);
  const currentBalance = Number(goalDoc.currentBalance || 0);

  if (target <= 0) return null;
  if (isLiabilityLinkedAccount(linkedAccount)) {
    return Math.max(0, Math.min(100, Math.round(((target - currentBalance) / target) * 100)));
  }

  return Math.min(100, Math.round((currentBalance / target) * 100));
}

router.get('/:householdId/liability-report', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { month } = req.query;
    const report = await getLiabilityReport(householdId, month || null);
    res.json({ householdId, ...report });
  } catch (err) {
    console.error('[goals liability-report] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// GET all goals for a household
router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    console.log('[goals GET] fetching for householdId:', householdId);

    const goals = await Goal.find({ householdId, isActive: true }).sort({ type: 1, name: 1 });

    const goalsWithProgress = await Promise.all(goals.map(async (g) => {
      const doc = g.toObject();
      let linkedAccount = null;

      // Attach live linked-account data if one is configured
      if (doc.linkedAccountId) {
        try {
          const acct = await LinkedAccount.findOne({ _id: doc.linkedAccountId, householdId, isActive: true })
            .select('accountName accountOfficialName accountMask currentBalance availableBalance accountSubtype accountType isActive');

          if (acct && shouldAutoSyncLinkedAccount(acct)) {
            const liveBalance = Number(acct.currentBalance) || 0;
            if (Number(doc.currentBalance || 0) !== liveBalance) {
              await Goal.updateOne({ _id: g._id }, { currentBalance: liveBalance, linkedAccountName: buildLinkedAccountLabel(acct) });
              doc.currentBalance = liveBalance;
            }
          }

          linkedAccount = acct ? acct.toObject() : null;
          doc.linkedAccount = linkedAccount;
        } catch (_) {
          doc.linkedAccount = null;
        }
      }

      const linkedFixedExpense = await resolveLinkedFixedExpense(householdId, doc, linkedAccount);
      doc.linkedFixedExpense = linkedFixedExpense;

      doc.isLiabilityTracked = isLiabilityLinkedAccount(linkedAccount);
      doc.progressPercent = getGoalProgressPercent(doc, linkedAccount);
      return doc;
    }));

    const totalMonthlyContribution = goalsWithProgress
      .filter((goal) => !goal.isLiabilityTracked)
      .reduce((sum, goal) => sum + (Number(goal.monthlyContribution) || 0), 0);
    const totalMonthlyLiabilityPayment = goalsWithProgress
      .filter((goal) => goal.isLiabilityTracked)
      .reduce((sum, goal) => sum + (Number(goal.monthlyContribution) || 0), 0);

    console.log('[goals GET] found', goals.length, 'goals, totalMonthly:', totalMonthlyContribution);
    res.json({ householdId, goals: goalsWithProgress, totalMonthlyContribution, totalMonthlyLiabilityPayment });
  } catch (err) {
    console.error('[goals GET] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// POST create a goal
router.post('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { name, monthlyContribution, target, currentBalance, type, linkedAccountId, linkedFixedExpenseId } = req.body;
    console.log('[goals POST] incoming', { householdId, user: req.user?.userId, body: req.body });

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Goal name required' });
    }

    // Resolve linked account display name
    let linkedAccountName = null;
    if (linkedAccountId) {
      const acct = await LinkedAccount.findOne({ _id: linkedAccountId, householdId, isActive: true })
        .select('accountName institutionName accountMask');
      if (acct) linkedAccountName = `${acct.institutionName || acct.accountName}${acct.accountMask ? ` ••${acct.accountMask}` : ''}`;
    }

    let linkedFixedExpenseName = null;
    if (linkedFixedExpenseId) {
      const fixedExpense = await FixedExpense.findOne({ _id: linkedFixedExpenseId, householdId, isActive: true })
        .select('name');
      if (fixedExpense) linkedFixedExpenseName = fixedExpense.name;
    }

    const goal = await Goal.create({
      householdId,
      userId: req.user.userId,
      name: name.trim(),
      monthlyContribution: Number(monthlyContribution) || 0,
      target: Number(target) || 0,
      currentBalance: Number(currentBalance) || 0,
      type: type || 'Other',
      linkedAccountId: linkedAccountId || null,
      linkedAccountName,
      linkedFixedExpenseId: linkedFixedExpenseId || null,
      linkedFixedExpenseName,
    });

    const doc = goal.toObject();
    doc.progressPercent = getGoalProgressPercent(doc, null);

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
    // Handle linked account update
    if (typeof updates.linkedAccountId !== 'undefined') {
      goal.linkedAccountId = updates.linkedAccountId || null;
      if (updates.linkedAccountId) {
        const acct = await LinkedAccount.findOne({ _id: updates.linkedAccountId, householdId, isActive: true })
          .select('accountName institutionName accountMask');
        goal.linkedAccountName = acct
          ? `${acct.institutionName || acct.accountName}${acct.accountMask ? ` ••${acct.accountMask}` : ''}`
          : null;
      } else {
        goal.linkedAccountName = null;
      }
    }
    if (typeof updates.linkedFixedExpenseId !== 'undefined') {
      goal.linkedFixedExpenseId = updates.linkedFixedExpenseId || null;
      if (updates.linkedFixedExpenseId) {
        const fixedExpense = await FixedExpense.findOne({ _id: updates.linkedFixedExpenseId, householdId, isActive: true })
          .select('name');
        goal.linkedFixedExpenseName = fixedExpense ? fixedExpense.name : null;
      } else {
        goal.linkedFixedExpenseName = null;
      }
    }

    await goal.save();

    const doc = goal.toObject();
    doc.progressPercent = getGoalProgressPercent(doc, null);

    console.log('[goals PATCH] saved', { id: goal._id });
    res.json({ goal: doc });
  } catch (err) {
    console.error('[goals PATCH] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// POST sync goal balance from linked bank account
router.post('/:householdId/:id/sync-balance', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;
    const goal = await Goal.findOne({ _id: id, householdId });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (!goal.linkedAccountId) return res.status(400).json({ error: 'No linked account on this goal' });

    const acct = await LinkedAccount.findOne({ _id: goal.linkedAccountId, householdId, isActive: true });
    if (!acct) return res.status(404).json({ error: 'Linked account not found or inactive' });

    const syncedBalance = acct.currentBalance || 0;
    goal.currentBalance = syncedBalance;
    await goal.save();

    const doc = goal.toObject();
    doc.isLiabilityTracked = isLiabilityLinkedAccount(acct);
    doc.progressPercent = getGoalProgressPercent(doc, acct);
    doc.linkedAccount = acct.toObject();

    console.log('[goals sync-balance] synced', { id: goal._id, syncedBalance });
    res.json({ goal: doc, syncedBalance });
  } catch (err) {
    console.error('[goals sync-balance] error', err && (err.stack || err.message || err));
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
