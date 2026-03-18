/**
 * Budget Alert Service
 * After new Plaid transactions are synced, checks if any spending category
 * has exceeded (or is close to) its budget and emails household members.
 */

import PlaidTransaction from '../models/PlaidTransaction.js';
import FixedExpense from '../models/FixedExpense.js';
import Expense from '../models/Expense.js';
import Household from '../models/Household.js';
import User from '../models/User.js';
import { sendBudgetAlertEmail } from './emailService.js';
import logger from '../utils/logger.js';

// Alert at 90 % of budget (warn) and 100 % (exceeded)
const WARN_THRESHOLD = 0.90;

/**
 * Category mapping: Plaid / categorySuggestion labels → FixedExpense group names
 * so we can match a bank transaction category to the right budget bucket.
 */
const CATEGORY_TO_GROUP = {
  'Groceries':        'Food',
  'Dining Out':       'Food',
  'Gas':              'Auto',
  'Transportation':   'Auto',
  'Medical':          'Other',
  'Entertainment':    'Entertainment',
  'Shopping':         'Other',
  'Utilities':        'Utilities',
  'Travel':           'Other',
  'Business Services':'Bills',
  'Personal':         'Other',
  'Subscriptions':    'Bills',
  'Insurance':        'Insurance',
  'Housing':          'Housing',
  'Savings':          'Savings',
  'Debt':             'Debt',
  'Other':            'Other',
};

/**
 * Get the current calendar month string (YYYY-MM).
 */
function thisMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Build the date range for the current month.
 */
function monthDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

/**
 * Sum all Plaid transactions for a household + category in the current month.
 */
async function monthlyPlaidSpend(householdId, category) {
  const { start, end } = monthDateRange();
  const result = await PlaidTransaction.aggregate([
    {
      $match: {
        householdId,
        $or: [{ userCategory: category }, { primaryCategory: category }],
        date: { $gte: start, $lte: end },
        amount: { $gt: 0 }, // debits only
        isDuplicate: { $ne: true },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result[0]?.total || 0;
}

/**
 * Sum all manual variable expenses for a household + category in the current month.
 */
async function monthlyManualSpend(householdId, category) {
  const month = thisMonth();
  const result = await Expense.aggregate([
    { $match: { householdId, category, month } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result[0]?.total || 0;
}

/**
 * Core check: given a set of new transaction categories, look at each unique
 * category, total up the month-to-date spend, compare against fixed-expense
 * budget, and fire alerts when thresholds are crossed.
 *
 * @param {string}   householdId
 * @param {string[]} newCategories  - categories from the just-synced transactions
 */
export async function checkBudgetAlerts(householdId, newCategories) {
  try {
    if (!newCategories?.length) return;

    // Deduplicate + resolve to group names
    const groups = [...new Set(newCategories.map(c => CATEGORY_TO_GROUP[c] || 'Other'))];

    // Load active fixed-expense budgets for this household
    const budgets = await FixedExpense.find({ householdId, isActive: true }).lean();
    if (!budgets.length) return;

    // Build a map: group → total budgeted
    const budgetByGroup = {};
    for (const b of budgets) {
      budgetByGroup[b.group] = (budgetByGroup[b.group] || 0) + b.amount;
    }

    // Load household + members for email delivery
    const household = await Household.findOne({ _id: householdId }).lean()
      || await Household.findOne({ householdId }).lean();
    if (!household) return;

    const memberIds = (household.members || []).map(m => m.userId);
    const members   = await User.find({ _id: { $in: memberIds } }).lean();
    const emails    = members.map(m => m.email).filter(Boolean);
    if (!emails.length) return;

    const householdName = household.name || 'Your Household';

    for (const group of groups) {
      const budget = budgetByGroup[group];
      if (!budget) continue; // No budget set for this group

      // Total spend = Plaid transactions + manual entries in this group's categories
      const relevantCategories = Object.entries(CATEGORY_TO_GROUP)
        .filter(([, g]) => g === group)
        .map(([c]) => c);

      let totalSpend = 0;
      for (const cat of relevantCategories) {
        totalSpend += await monthlyPlaidSpend(householdId, cat);
        totalSpend += await monthlyManualSpend(householdId, cat);
      }

      const ratio = totalSpend / budget;

      if (ratio >= 1) {
        // EXCEEDED
        logger.info(`[BudgetAlert] EXCEEDED – ${householdId} – ${group} – ${totalSpend}/${budget}`);
        await sendBudgetAlertEmail(emails, {
          householdName,
          category:  group,
          spent:     totalSpend,
          budget,
          percent:   Math.round(ratio * 100),
          status:    'exceeded',
        });
      } else if (ratio >= WARN_THRESHOLD) {
        // WARNING
        logger.info(`[BudgetAlert] WARNING – ${householdId} – ${group} – ${totalSpend}/${budget}`);
        await sendBudgetAlertEmail(emails, {
          householdName,
          category:  group,
          spent:     totalSpend,
          budget,
          percent:   Math.round(ratio * 100),
          status:    'warning',
        });
      }
    }
  } catch (err) {
    logger.error('[BudgetAlert] Error running budget checks:', err);
  }
}
