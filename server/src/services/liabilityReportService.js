import Goal from '../models/Goal.js';
import GoalContribution from '../models/GoalContribution.js';
import LinkedAccount from '../models/LinkedAccount.js';
import FixedExpensePayment from '../models/FixedExpensePayment.js';
import FixedExpense from '../models/FixedExpense.js';

function isLiabilityLinkedAccount(account) {
  const type = String(account?.accountType || '').toLowerCase();
  const subtype = String(account?.accountSubtype || '').toLowerCase();
  return type === 'loan' || subtype.includes('mortgage') || subtype.includes('loan');
}

function buildMonthString(date) {
  const parsedDate = new Date(date);
  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
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

export async function getLiabilityReport(householdId, selectedMonth = null) {
  const goals = await Goal.find({ householdId, isActive: true }).lean();
  const linkedAccountIds = goals.map((goal) => goal.linkedAccountId).filter(Boolean);
  const linkedAccounts = await LinkedAccount.find({
    _id: { $in: linkedAccountIds },
    householdId,
    isActive: true,
  }).lean();

  const accountMap = new Map(linkedAccounts.map((account) => [String(account._id), account]));
  const liabilityGoals = goals.filter((goal) => isLiabilityLinkedAccount(accountMap.get(String(goal.linkedAccountId))));
  const liabilityGoalIds = liabilityGoals.map((goal) => goal._id);
  const [contributions, allFixedExpensePayments] = await Promise.all([
    GoalContribution.find({
      householdId,
      goalId: { $in: liabilityGoalIds },
    })
      .sort({ contributionDate: -1 })
      .populate({
        path: 'fixedExpensePaymentId',
        populate: { path: 'fixedExpenseId', select: 'name amount' },
      })
      .lean(),
    FixedExpensePayment.find({ householdId }).lean(),
  ]);

  const fixedExpensePaymentIds = contributions.map((contribution) => contribution.fixedExpensePaymentId?._id).filter(Boolean);
  const fixedExpensePayments = allFixedExpensePayments.filter((payment) => (
    fixedExpensePaymentIds.some((id) => String(id) === String(payment._id)) || payment.fixedExpenseId
  ));
  const fixedExpensePaymentMap = new Map(fixedExpensePayments.map((payment) => [String(payment._id), payment]));
  const fixedExpensePaymentsByExpenseId = new Map();

  for (const payment of allFixedExpensePayments) {
    const expenseId = String(payment.fixedExpenseId);
    if (!fixedExpensePaymentsByExpenseId.has(expenseId)) fixedExpensePaymentsByExpenseId.set(expenseId, []);
    fixedExpensePaymentsByExpenseId.get(expenseId).push(payment);
  }

  const contributionsByGoalId = new Map();
  const monthlyTotals = {};

  for (const contribution of contributions) {
    const goalId = String(contribution.goalId);
    if (!contributionsByGoalId.has(goalId)) contributionsByGoalId.set(goalId, []);
    contributionsByGoalId.get(goalId).push(contribution);

    const month = buildMonthString(contribution.contributionDate || contribution.createdAt);
    if (!monthlyTotals[month]) {
      monthlyTotals[month] = { paid: 0, planned: 0, remainingDue: 0, paymentCount: 0 };
    }
    monthlyTotals[month].paid += Number(contribution.amount) || 0;
    monthlyTotals[month].paymentCount += 1;
  }

  const now = new Date();
  const currentMonth = selectedMonth || buildMonthString(now);
  const currentMonthReport = monthlyTotals[currentMonth] || { paid: 0, planned: 0, remainingDue: 0, paymentCount: 0 };

  const liabilities = await Promise.all(liabilityGoals.map(async (goal) => {
    const goalContributions = contributionsByGoalId.get(String(goal._id)) || [];
    const linkedAccount = accountMap.get(String(goal.linkedAccountId)) || null;
    const linkedFixedExpense = await resolveLinkedFixedExpense(householdId, goal, linkedAccount);
    const linkedExpensePayments = linkedFixedExpense
      ? (fixedExpensePaymentsByExpenseId.get(String(linkedFixedExpense._id)) || [])
      : [];
    const mirroredPaymentIds = new Set(
      goalContributions
        .map((contribution) => contribution.fixedExpensePaymentId?._id || contribution.fixedExpensePaymentId)
        .filter(Boolean)
        .map(String)
    );
    const directExpensePayments = linkedExpensePayments.filter((payment) => !mirroredPaymentIds.has(String(payment._id)));
    const target = Number(goal.target || 0);
    const currentBalance = Number(goal.currentBalance || 0);
    const monthlyPayment = Number(goal.monthlyContribution || 0);
    const paidDown = Math.max(0, target - currentBalance);
    const payoffPercent = target > 0 ? Math.max(0, Math.min(100, Math.round((paidDown / target) * 100))) : 0;
    const monthsRemaining = monthlyPayment > 0 ? Math.ceil(currentBalance / monthlyPayment) : null;
    const estimatedPayoffDate = monthsRemaining != null ? addMonths(now, monthsRemaining) : null;
    const contributionPaidThisMonth = goalContributions
      .filter((contribution) => buildMonthString(contribution.contributionDate || contribution.createdAt) === currentMonth)
      .reduce((sum, contribution) => sum + (Number(contribution.amount) || 0), 0);
    const fixedExpensePaidThisMonth = directExpensePayments
      .filter((payment) => buildMonthString(payment.paymentDate || payment.createdAt) === currentMonth)
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const thisMonthPaid = contributionPaidThisMonth + fixedExpensePaidThisMonth;
    const remainingThisMonth = Math.max(0, monthlyPayment - thisMonthPaid);
    const paymentHistory = [
      ...goalContributions.map((contribution) => {
        const linkedPayment = contribution.fixedExpensePaymentId || fixedExpensePaymentMap.get(String(contribution.fixedExpensePaymentId));
        return {
          _id: contribution._id,
          amount: Number(contribution.amount) || 0,
          contributionDate: contribution.contributionDate,
          source: contribution.source || 'manual',
          method: contribution.method || 'bank',
          notes: contribution.notes || '',
          fixedExpensePaymentId: contribution.fixedExpensePaymentId?._id || contribution.fixedExpensePaymentId || null,
          fixedExpenseName: linkedPayment?.fixedExpenseId?.name || goal.linkedFixedExpenseName || linkedFixedExpense?.name || null,
          paymentSourceLabel: contribution.source === 'fixed_expense_payment' ? 'Fixed expense sync' : 'Manual payment',
          canDelete: contribution.source !== 'fixed_expense_payment',
        };
      }),
      ...directExpensePayments.map((payment) => ({
        _id: `direct-${payment._id}`,
        amount: Number(payment.amount) || 0,
        contributionDate: payment.paymentDate,
        source: 'fixed_expense_payment',
        method: payment.method || 'bank',
        notes: payment.notes || '',
        fixedExpensePaymentId: payment._id,
        fixedExpenseName: linkedFixedExpense?.name || goal.linkedFixedExpenseName || null,
        paymentSourceLabel: 'Fixed expense payment',
        canDelete: false,
      })),
    ].sort((left, right) => new Date(right.contributionDate || 0) - new Date(left.contributionDate || 0));

    for (const payment of directExpensePayments) {
      const monthKey = buildMonthString(payment.paymentDate || payment.createdAt);
      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = { paid: 0, planned: 0, remainingDue: 0, paymentCount: 0 };
      }
      monthlyTotals[monthKey].paid += Number(payment.amount) || 0;
      monthlyTotals[monthKey].paymentCount += 1;
    }

    return {
      ...goal,
      isLiabilityTracked: true,
      linkedFixedExpense,
      linkedFixedExpenseName: goal.linkedFixedExpenseName || linkedFixedExpense?.name || null,
      progressPercent: payoffPercent,
      linkedAccount,
      payoffMetrics: {
        originalBalance: target,
        remainingBalance: currentBalance,
        paidDown,
        payoffPercent,
        scheduledPayment: monthlyPayment,
        monthsRemaining,
        estimatedPayoffDate,
        thisMonthPaid,
        remainingThisMonth,
      },
      paymentHistory: paymentHistory.slice(0, 5),
    };
  }));

  const totalScheduledPayment = liabilities.reduce((sum, liability) => sum + (Number(liability.payoffMetrics.scheduledPayment) || 0), 0);
  const totalRemainingBalance = liabilities.reduce((sum, liability) => sum + (Number(liability.payoffMetrics.remainingBalance) || 0), 0);
  const totalOriginalBalance = liabilities.reduce((sum, liability) => sum + (Number(liability.payoffMetrics.originalBalance) || 0), 0);
  const totalPaidDown = liabilities.reduce((sum, liability) => sum + (Number(liability.payoffMetrics.paidDown) || 0), 0);
  const totalPaidThisMonth = liabilities.reduce((sum, liability) => sum + (Number(liability.payoffMetrics.thisMonthPaid) || 0), 0);
  const totalRemainingThisMonth = liabilities.reduce((sum, liability) => sum + (Number(liability.payoffMetrics.remainingThisMonth) || 0), 0);

  for (const month of Object.keys(monthlyTotals)) {
    monthlyTotals[month].planned = totalScheduledPayment;
    monthlyTotals[month].remainingDue = Math.max(0, totalScheduledPayment - monthlyTotals[month].paid);
  }
  currentMonthReport.planned = totalScheduledPayment;
  currentMonthReport.remainingDue = totalRemainingThisMonth;

  return {
    liabilities,
    summary: {
      liabilityCount: liabilities.length,
      totalOriginalBalance,
      totalRemainingBalance,
      totalPaidDown,
      overallPayoffPercent: totalOriginalBalance > 0 ? Math.round((totalPaidDown / totalOriginalBalance) * 100) : 0,
      totalScheduledPayment,
      totalPaidThisMonth,
      totalRemainingThisMonth,
    },
    monthlyTotals,
    month: currentMonth,
    monthSummary: currentMonthReport,
  };
}