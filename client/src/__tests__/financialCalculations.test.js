/**
 * Financial Calculations Tests
 * Critical tests for money calculations to ensure accuracy
 */

import {
  calculateTotal,
  calculateAverage,
  calculatePercentage,
  calculateRemaining,
  calculateProgressPercentage,
  calculateCompoundInterest,
  calculateMonthlyPayment,
  calculateCreditUtilization,
  calculateSavingsRate,
  calculateDebtToIncomeRatio,
  calculateMonthsToGoal,
  roundCurrency,
  calculateSplitAmount,
  calculateCategoryBreakdown,
  calculateRunningBalance
} from '../services/financialCalculations';

describe('Financial Calculations', () => {
  describe('calculateTotal', () => {
    test('should sum amounts from array', () => {
      const items = [
        { amount: 100 },
        { amount: 50 },
        { amount: 25 }
      ];
      expect(calculateTotal(items)).toBe(175);
    });

    test('should handle custom field names', () => {
      const items = [
        { price: 100 },
        { price: 50 }
      ];
      expect(calculateTotal(items, 'price')).toBe(150);
    });

    test('should return 0 for empty array', () => {
      expect(calculateTotal([])).toBe(0);
    });

    test('should return 0 for non-array input', () => {
      expect(calculateTotal(null)).toBe(0);
      expect(calculateTotal(undefined)).toBe(0);
    });

    test('should handle string numbers', () => {
      const items = [
        { amount: '100' },
        { amount: '50.50' }
      ];
      expect(calculateTotal(items)).toBe(150.5);
    });
  });

  describe('calculateAverage', () => {
    test('should calculate average of amounts', () => {
      const items = [
        { amount: 100 },
        { amount: 200 },
        { amount: 300 }
      ];
      expect(calculateAverage(items)).toBe(200);
    });

    test('should return 0 for empty array', () => {
      expect(calculateAverage([])).toBe(0);
    });

    test('should handle single item', () => {
      const items = [{ amount: 150 }];
      expect(calculateAverage(items)).toBe(150);
    });
  });

  describe('calculatePercentage', () => {
    test('should calculate percentage of total', () => {
      expect(calculatePercentage(25, 100)).toBe(25);
      expect(calculatePercentage(50, 200)).toBe(25);
    });

    test('should return 0 when total is 0', () => {
      expect(calculatePercentage(50, 0)).toBe(0);
    });

    test('should handle decimals', () => {
      expect(calculatePercentage(33.33, 100)).toBeCloseTo(33.33);
    });
  });

  describe('calculateRemaining', () => {
    test('should calculate remaining after spending', () => {
      expect(calculateRemaining(1000, 300)).toBe(700);
    });

    test('should return 0 when spent exceeds total', () => {
      expect(calculateRemaining(100, 200)).toBe(0);
    });

    test('should return total when spent is 0', () => {
      expect(calculateRemaining(500, 0)).toBe(500);
    });
  });

  describe('calculateProgressPercentage', () => {
    test('should calculate progress toward goal', () => {
      expect(calculateProgressPercentage(250, 1000)).toBe(25);
      expect(calculateProgressPercentage(500, 1000)).toBe(50);
      expect(calculateProgressPercentage(1000, 1000)).toBe(100);
    });

    test('should cap at 100%', () => {
      expect(calculateProgressPercentage(1500, 1000)).toBe(100);
    });

    test('should return 0 when target is 0', () => {
      expect(calculateProgressPercentage(100, 0)).toBe(0);
    });
  });

  describe('calculateCompoundInterest', () => {
    test('should calculate compound interest', () => {
      // $1000 at 5% annual rate for 1 year, compounded monthly
      const result = calculateCompoundInterest(1000, 0.05, 1, 12);
      expect(result).toBeCloseTo(1051.16, 1);
    });

    test('should handle annual compounding', () => {
      // $1000 at 5% annual, 1 year, compounded annually
      const result = calculateCompoundInterest(1000, 0.05, 1, 1);
      expect(result).toBeCloseTo(1050, 2);
    });

    test('should grow over multiple years', () => {
      const year1 = calculateCompoundInterest(1000, 0.05, 1);
      const year2 = calculateCompoundInterest(1000, 0.05, 2);
      expect(year2).toBeGreaterThan(year1);
    });
  });

  describe('calculateMonthlyPayment', () => {
    test('should calculate monthly loan payment', () => {
      // $200,000 loan at 4% annual interest for 30 years (360 months)
      const payment = calculateMonthlyPayment(200000, 0.04, 360);
      expect(payment).toBeCloseTo(954.83, 1);
    });

    test('should handle 0% interest', () => {
      // Should just divide principal by months
      expect(calculateMonthlyPayment(12000, 0, 12)).toBeCloseTo(1000);
    });

    test('should increase with higher interest rates', () => {
      const low = calculateMonthlyPayment(100000, 0.03, 360);
      const high = calculateMonthlyPayment(100000, 0.05, 360);
      expect(high).toBeGreaterThan(low);
    });
  });

  describe('calculateCreditUtilization', () => {
    test('should calculate utilization ratio', () => {
      const cards = [
        { limit: 10000, balance: 3000 },
        { limit: 5000, balance: 2000 }
      ];
      // Total: $5000 used of $15000 limit = 33.33%
      const utilization = calculateCreditUtilization(cards);
      expect(utilization).toBeCloseTo(33.33, 1);
    });

    test('should return 0 for no cards', () => {
      expect(calculateCreditUtilization([])).toBe(0);
      expect(calculateCreditUtilization(null)).toBe(0);
    });

    test('should return 0 when total limit is 0', () => {
      const cards = [{ limit: 0, balance: 0 }];
      expect(calculateCreditUtilization(cards)).toBe(0);
    });

    test('should handle 100% utilization', () => {
      const cards = [
        { limit: 5000, balance: 5000 }
      ];
      expect(calculateCreditUtilization(cards)).toBeCloseTo(100);
    });
  });

  describe('calculateSavingsRate', () => {
    test('should calculate savings rate', () => {
      // $5000 income - $3000 expenses = $2000 saved = 40%
      expect(calculateSavingsRate(5000, 3000)).toBeCloseTo(40);
    });

    test('should handle negative savings (deficit)', () => {
      // $3000 income - $4000 expenses = -$1000 = -33.33%
      expect(calculateSavingsRate(3000, 4000)).toBeCloseTo(-33.33, 1);
    });

    test('should return 0 when income is 0', () => {
      expect(calculateSavingsRate(0, 1000)).toBe(0);
    });

    test('should return 100 when no expenses', () => {
      expect(calculateSavingsRate(5000, 0)).toBe(100);
    });
  });

  describe('calculateDebtToIncomeRatio', () => {
    test('should calculate DTI ratio', () => {
      // $1500 monthly debt / $5000 monthly income = 30%
      expect(calculateDebtToIncomeRatio(1500, 5000)).toBe(30);
    });

    test('should return 0 when income is 0', () => {
      expect(calculateDebtToIncomeRatio(1000, 0)).toBe(0);
    });

    test('should handle high DTI', () => {
      // $2000 debt / $5000 income = 40%
      expect(calculateDebtToIncomeRatio(2000, 5000)).toBe(40);
    });
  });

  describe('calculateMonthsToGoal', () => {
    test('should calculate months to reach goal', () => {
      // $10000 remaining / $1000 per month = 10 months
      expect(calculateMonthsToGoal(10000, 1000)).toBe(10);
    });

    test('should round up fractional months', () => {
      // $10500 remaining / $1000 per month = 10.5 months → 11 months
      expect(calculateMonthsToGoal(10500, 1000)).toBe(11);
    });

    test('should return 0 when already at goal', () => {
      expect(calculateMonthsToGoal(0, 1000)).toBe(0);
      expect(calculateMonthsToGoal(-100, 1000)).toBe(0);
    });

    test('should return 0 with no contribution', () => {
      expect(calculateMonthsToGoal(10000, 0)).toBe(0);
    });
  });

  describe('roundCurrency', () => {
    test('should round to 2 decimal places', () => {
      expect(roundCurrency(99.999)).toBe(100);
      expect(roundCurrency(99.991)).toBe(99.99);
      expect(roundCurrency(100.124)).toBe(100.12);
      expect(roundCurrency(100.126)).toBe(100.13);
    });

    test('should handle whole numbers', () => {
      expect(roundCurrency(100)).toBe(100);
      expect(roundCurrency(100.0)).toBe(100);
    });
  });

  describe('calculateSplitAmount', () => {
    test('should split amount evenly', () => {
      expect(calculateSplitAmount(1000, 4)).toBe(250);
      expect(calculateSplitAmount(3000, 3)).toBe(1000);
    });

    test('should handle uneven splits', () => {
      // $100 / 3 = 33.33...
      const split = calculateSplitAmount(100, 3);
      expect(split).toBeCloseTo(33.33, 2);
    });

    test('should return 0 with no members', () => {
      expect(calculateSplitAmount(1000, 0)).toBe(0);
    });

    test('should round to 2 decimal places', () => {
      const split = calculateSplitAmount(100, 3);
      expect(split * 100 % 1).toBeLessThan(0.01); // Check decimal places
    });
  });

  describe('calculateCategoryBreakdown', () => {
    test('should breakdown expenses by category', () => {
      const expenses = [
        { category: 'Food', amount: 50 },
        { category: 'Food', amount: 30 },
        { category: 'Gas', amount: 60 },
        { category: 'Gas', amount: 40 }
      ];
      const breakdown = calculateCategoryBreakdown(expenses);
      expect(breakdown.Food).toBe(80);
      expect(breakdown.Gas).toBe(100);
    });

    test('should handle missing categories', () => {
      const expenses = [
        { category: 'Food', amount: 50 },
        { amount: 30 }
      ];
      const breakdown = calculateCategoryBreakdown(expenses);
      expect(breakdown.Food).toBe(50);
      expect(breakdown.Other).toBe(30);
    });

    test('should return empty object for invalid input', () => {
      expect(calculateCategoryBreakdown(null)).toEqual({});
      expect(calculateCategoryBreakdown(undefined)).toEqual({});
    });
  });

  describe('calculateRunningBalance', () => {
    test('should calculate running balance for transactions', () => {
      const transactions = [
        { type: 'income', amount: 1000 },
        { type: 'expense', amount: 300 },
        { type: 'expense', amount: 200 }
      ];
      const result = calculateRunningBalance(transactions, 0);
      
      expect(result[0].runningBalance).toBe(1000);
      expect(result[1].runningBalance).toBe(700);
      expect(result[2].runningBalance).toBe(500);
    });

    test('should handle starting balance', () => {
      const transactions = [
        { type: 'expense', amount: 100 }
      ];
      const result = calculateRunningBalance(transactions, 500);
      expect(result[0].runningBalance).toBe(400);
    });

    test('should handle mixed positive starting balance', () => {
      const transactions = [
        { type: 'income', amount: 500 },
        { type: 'expense', amount: 200 }
      ];
      const result = calculateRunningBalance(transactions, 300);
      
      expect(result[0].runningBalance).toBe(800);
      expect(result[1].runningBalance).toBe(600);
    });

    test('should handle negative running balance', () => {
      const transactions = [
        { type: 'income', amount: 100 },
        { type: 'expense', amount: 500 }
      ];
      const result = calculateRunningBalance(transactions, 0);
      
      expect(result[0].runningBalance).toBe(100);
      expect(result[1].runningBalance).toBe(-400);
    });
  });
});
