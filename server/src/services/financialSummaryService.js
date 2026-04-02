import { getUnifiedMonthlyIncome } from './unifiedIncomeService.js';
import { getUnifiedMonthlyVariableExpenses } from './unifiedExpenseService.js';

/**
 * Computes a full reconciliation-ready financial summary for a household month.
 * Uses both unified services so transfer exclusion logic is consistent everywhere.
 *
 * @param {string} householdId
 * @param {string} month - "YYYY-MM" format
 * @returns {Promise<object>} financial summary with dollar amounts for all components
 */
export async function getFinancialSummary(householdId, month) {
  const [incomeResult, expenseResult] = await Promise.all([
    getUnifiedMonthlyIncome(householdId, month),
    getUnifiedMonthlyVariableExpenses(householdId, month),
  ]);

  const grossIncome = incomeResult.total || 0;
  const incomeTransfersExcluded = incomeResult.excludedInternalTransfersTotal || 0;
  const realIncome = grossIncome; // transfers are excluded before total is computed in unifiedIncomeService

  const rawExpenses = expenseResult.total || 0;
  const expenseInternalTransfersExcluded = expenseResult.excludedInternalTransfersTotal || 0;
  const externalTransferOutflowsTotal = expenseResult.externalTransferOutflowsTotal || 0;
  const realExpenses = rawExpenses; // transfers are excluded before total is computed in unifiedExpenseService

  const netSaved = realIncome - realExpenses;
  const transferVolume = incomeTransfersExcluded + expenseInternalTransfersExcluded + externalTransferOutflowsTotal;

  return {
    month,

    // Income side
    grossIncome,
    incomeTransfersExcluded,
    realIncome,

    // Expense side
    rawExpenses,
    expenseInternalTransfersExcluded,
    externalTransferOutflowsTotal,
    realExpenses,

    // Net
    netSaved,

    // Total transfer volume (all money excluded from both sides combined)
    transferVolume,

    // Expense breakdown by category
    byCategory: expenseResult.byCategory || {},

    // Weekly income breakdown [week1, week2, week3, week4]
    weeklyIncomeBreakdown: incomeResult.weeklyTotals || [0, 0, 0, 0],

    // Raw counts for diagnostics
    counts: {
      incomeTransactionsExcluded: incomeResult.excludedInternalTransfers || 0,
      expenseTransactionsExcluded: expenseResult.excludedInternalTransfers || 0,
      externalTransferOutflows: expenseResult.externalTransferOutflows || 0,
    },
  };
}
