/**
 * Integration tests for financialSummaryService
 *
 * Uses Jest module mocks to simulate the unified income/expense services
 * so these tests run without a real MongoDB connection.
 */

// Mock the unified services before importing the module under test
jest.mock('../unifiedIncomeService.js', () => ({
  getUnifiedMonthlyIncome: jest.fn(),
}));
jest.mock('../unifiedExpenseService.js', () => ({
  getUnifiedMonthlyVariableExpenses: jest.fn(),
}));

import { getUnifiedMonthlyIncome } from '../unifiedIncomeService.js';
import { getUnifiedMonthlyVariableExpenses } from '../unifiedExpenseService.js';
import { getFinancialSummary } from '../financialSummaryService.js';

const HOUSEHOLD_ID = 'test-household-123';
const MONTH = '2025-01';

const mockIncomeResult = {
  total: 5000,             // used as grossIncome (already transfer-excluded by unified service)
  excludedInternalTransfers: 2,
  excludedInternalTransfersTotal: 200,
  weeklyTotals: [1250, 1250, 1250, 1250],
};

const mockExpenseResult = {
  total: 3000,             // used as rawExpenses (already transfer-excluded by unified service)
  byCategory: { Groceries: 500, Dining: 300, Utilities: 200, Other: 2000 },
  excludedInternalTransfers: 1,
  excludedInternalTransfersTotal: 100,
  externalTransferOutflows: 0,
  externalTransferOutflowsTotal: 0,
};

beforeEach(() => {
  getUnifiedMonthlyIncome.mockResolvedValue(mockIncomeResult);
  getUnifiedMonthlyVariableExpenses.mockResolvedValue(mockExpenseResult);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('getFinancialSummary', () => {
  it('returns grossIncome from unified income service', async () => {
    const result = await getFinancialSummary(HOUSEHOLD_ID, MONTH);
    expect(result.grossIncome).toBe(5000);
  });

  it('computes realIncome = grossIncome (transfers already excluded by unified service)', async () => {
    const result = await getFinancialSummary(HOUSEHOLD_ID, MONTH);
    expect(result.realIncome).toBe(5000);
  });

  it('returns rawExpenses from unified expense service', async () => {
    const result = await getFinancialSummary(HOUSEHOLD_ID, MONTH);
    expect(result.rawExpenses).toBe(3000);
  });

  it('computes realExpenses = rawExpenses (transfers already excluded by unified service)', async () => {
    const result = await getFinancialSummary(HOUSEHOLD_ID, MONTH);
    expect(result.realExpenses).toBe(3000);
  });

  it('computes netSaved = realIncome - realExpenses', async () => {
    const result = await getFinancialSummary(HOUSEHOLD_ID, MONTH);
    expect(result.netSaved).toBe(5000 - 3000);
  });

  it('computes transferVolume = income excluded total + expense excluded total + external outflows', async () => {
    const result = await getFinancialSummary(HOUSEHOLD_ID, MONTH);
    expect(result.transferVolume).toBe(200 + 100 + 0);
  });

  it('includes byCategory from expense service', async () => {
    const result = await getFinancialSummary(HOUSEHOLD_ID, MONTH);
    expect(result.byCategory).toEqual({ Groceries: 500, Dining: 300, Utilities: 200, Other: 2000 });
  });

  it('includes weeklyIncomeBreakdown from income service', async () => {
    const result = await getFinancialSummary(HOUSEHOLD_ID, MONTH);
    expect(result.weeklyIncomeBreakdown).toEqual([1250, 1250, 1250, 1250]);
  });

  it('calls income service with correct householdId and month', async () => {
    await getFinancialSummary(HOUSEHOLD_ID, MONTH);
    expect(getUnifiedMonthlyIncome).toHaveBeenCalledWith(HOUSEHOLD_ID, MONTH);
  });

  it('calls expense service with correct householdId and month', async () => {
    await getFinancialSummary(HOUSEHOLD_ID, MONTH);
    expect(getUnifiedMonthlyVariableExpenses).toHaveBeenCalledWith(HOUSEHOLD_ID, MONTH);
  });

  it('handles zero income gracefully', async () => {
    getUnifiedMonthlyIncome.mockResolvedValue({ total: 0, excludedInternalTransfersTotal: 0, weeklyTotals: [0, 0, 0, 0] });
    const result = await getFinancialSummary(HOUSEHOLD_ID, MONTH);
    expect(result.grossIncome).toBe(0);
    expect(result.realIncome).toBe(0);
  });

  it('handles service errors by propagating them', async () => {
    getUnifiedMonthlyIncome.mockRejectedValue(new Error('DB connection failed'));
    await expect(getFinancialSummary(HOUSEHOLD_ID, MONTH)).rejects.toThrow('DB connection failed');
  });
});
