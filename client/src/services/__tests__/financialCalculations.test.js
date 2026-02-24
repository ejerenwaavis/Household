/**
 * Financial Calculations Tests
 * Critical tests for financial calculation accuracy
 */

import {
  calculateTotal,
  calculateAverage,
  calculatePercentage,
  calculateRemaining,
  calculateProgressPercentage,
  calculateCompoundInterest,
  calculateMonthlyPayment,
  calculateCreditUtilization
} from '../../services/financialCalculations';

describe('Total Calculation', () => {
  it('should calculate sum of items', () => {
    const items = [
      { amount: 100 },
      { amount: 200 },
      { amount: 150 }
    ];
    expect(calculateTotal(items)).toBe(450);
  });

  it('should calculate sum of specific field', () => {
    const items = [
      { price: 100 },
      { price: 200 },
      { price: 150 }
    ];
    expect(calculateTotal(items, 'price')).toBe(450);
  });

  it('should handle empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });

  it('should handle null/undefined amounts', () => {
    const items = [
      { amount: 100 },
      { amount: null },
      { amount: undefined },
      { amount: 200 }
    ];
    expect(calculateTotal(items)).toBe(300);
  });

  it('should handle string amounts', () => {
    const items = [
      { amount: '100' },
      { amount: '200' }
    ];
    expect(calculateTotal(items)).toBe(300);
  });

  it('should handle non-array input', () => {
    expect(calculateTotal(null)).toBe(0);
    expect(calculateTotal(undefined)).toBe(0);
  });
});

describe('Average Calculation', () => {
  it('should calculate average of items', () => {
    const items = [
      { amount: 100 },
      { amount: 200 },
      { amount: 300 }
    ];
    expect(calculateAverage(items)).toBe(200);
  });

  it('should handle single item', () => {
    const items = [{ amount: 500 }];
    expect(calculateAverage(items)).toBe(500);
  });

  it('should handle empty array', () => {
    expect(calculateAverage([])).toBe(0);
  });

  it('should calculate average of custom field', () => {
    const items = [
      { price: 100 },
      { price: 200 },
      { price: 300 }
    ];
    expect(calculateAverage(items, 'price')).toBe(200);
  });
});

describe('Percentage Calculation', () => {
  it('should calculate correct percentage', () => {
    expect(calculatePercentage(50, 200)).toBe(25);
  });

  it('should handle zero total', () => {
    expect(calculatePercentage(100, 0)).toBe(0);
  });

  it('should calculate 100 percent', () => {
    expect(calculatePercentage(200, 200)).toBe(100);
  });

  it('should calculate zero percent', () => {
    expect(calculatePercentage(0, 200)).toBe(0);
  });

  it('should calculate decimal percentages', () => {
    const result = calculatePercentage(1, 3);
    expect(result).toBeCloseTo(33.33, 1);
  });
});

describe('Remaining Amount Calculation', () => {
  it('should calculate remaining amount', () => {
    expect(calculateRemaining(1000, 300)).toBe(700);
  });

  it('should return zero when spent exceeds total', () => {
    expect(calculateRemaining(100, 500)).toBe(0);
  });

  it('should return full amount when nothing spent', () => {
    expect(calculateRemaining(1000, 0)).toBe(1000);
  });

  it('should handle negative numbers', () => {
    expect(calculateRemaining(100, -50)).toBe(150);
  });
});

describe('Progress Percentage Calculation', () => {
  it('should calculate progress toward goal', () => {
    expect(calculateProgressPercentage(500, 1000)).toBe(50);
  });

  it('should cap at 100 percent', () => {
    expect(calculateProgressPercentage(1500, 1000)).toBe(100);
  });

  it('should handle zero target', () => {
    expect(calculateProgressPercentage(500, 0)).toBe(0);
  });

  it('should calculate zero progress', () => {
    expect(calculateProgressPercentage(0, 1000)).toBe(0);
  });

  it('should handle complete progress', () => {
    expect(calculateProgressPercentage(1000, 1000)).toBe(100);
  });
});

describe('Compound Interest Calculation', () => {
  it('should calculate compound interest for monthly compounding', () => {
    // $1000 at 5% annual for 1 year, compounded monthly
    const result = calculateCompoundInterest(1000, 0.05, 1, 12);
    expect(result).toBeCloseTo(1051.14, 2);
  });

  it('should calculate compound interest for annual compounding', () => {
    // $1000 at 5% annual for 1 year, compounded annually
    const result = calculateCompoundInterest(1000, 0.05, 1, 1);
    expect(result).toBeCloseTo(1050, 2);
  });

  it('should handle multiple years', () => {
    const result = calculateCompoundInterest(1000, 0.05, 2, 1);
    expect(result).toBeCloseTo(1102.5, 2);
  });

  it('should handle zero interest', () => {
    const result = calculateCompoundInterest(1000, 0, 1, 12);
    expect(result).toBe(1000);
  });

  it('should use default compounding period', () => {
    const result = calculateCompoundInterest(1000, 0.05, 1);
    expect(result).toBeCloseTo(1051.14, 2);
  });
});

describe('Monthly Payment Calculation', () => {
  it('should calculate standard loan payment', () => {
    // $200,000 at 4% annual for 360 months (30 years)
    const payment = calculateMonthlyPayment(200000, 0.04, 360);
    expect(payment).toBeCloseTo(954.83, 2);
  });

  it('should calculate credit card payment', () => {
    // $5,000 at 18% annual interest for 24 months
    const payment = calculateMonthlyPayment(5000, 0.18, 24);
    expect(payment).toBeCloseTo(246.49, 2);
  });

  it('should handle zero interest rate', () => {
    const payment = calculateMonthlyPayment(12000, 0, 12);
    expect(payment).toBe(1000);
  });

  it('should handle short term', () => {
    const payment = calculateMonthlyPayment(1000, 0.1, 12);
    expect(payment).toBeCloseTo(87.92, 2);
  });

  it('should be higher with higher interest', () => {
    const low = calculateMonthlyPayment(10000, 0.02, 12);
    const high = calculateMonthlyPayment(10000, 0.10, 12);
    expect(high).toBeGreaterThan(low);
  });
});

describe('Credit Utilization Calculation', () => {
  it('should calculate utilization ratio', () => {
    const cards = [
      { limit: 5000, balance: 2500 },
      { limit: 10000, balance: 5000 }
    ];
    // Total balance: 7500, Total limit: 15000 = 50%
    expect(calculateCreditUtilization(cards)).toBe(50);
  });

  it('should handle zero utilization', () => {
    const cards = [
      { limit: 5000, balance: 0 },
      { limit: 10000, balance: 0 }
    ];
    expect(calculateCreditUtilization(cards)).toBe(0);
  });

  it('should handle high utilization', () => {
    const cards = [
      { limit: 5000, balance: 4500 },
      { limit: 10000, balance: 9500 }
    ];
    // Total balance: 14000, Total limit: 15000 = 93.33%
    expect(calculateCreditUtilization(cards)).toBeCloseTo(93.33, 1);
  });

  it('should handle single card', () => {
    const cards = [{ limit: 5000, balance: 2500 }];
    expect(calculateCreditUtilization(cards)).toBe(50);
  });

  it('should handle empty array', () => {
    expect(calculateCreditUtilization([])).toBe(0);
  });

  it('should handle null or undefined', () => {
    expect(calculateCreditUtilization(null)).toBe(0);
    expect(calculateCreditUtilization(undefined)).toBe(0);
  });
});

describe('Financial Calculations Integration', () => {
  it('should correctly calculate household expenses summary', () => {
    const expenses = [
      { amount: 500, category: 'rent' },
      { amount: 200, category: 'utilities' },
      { amount: 150, category: 'groceries' },
      { amount: 100, category: 'entertainment' }
    ];

    const total = calculateTotal(expenses);
    const average = calculateAverage(expenses);
    const groceryPercentage = calculatePercentage(150, total);

    expect(total).toBe(950);
    expect(average).toBe(237.5);
    expect(groceryPercentage).toBeCloseTo(15.79, 1);
  });

  it('should correctly calculate savings goal progress', () => {
    const currentSavings = 3500;
    const savingsGoal = 10000;
    const monthlyContribution = 500;

    const progress = calculateProgressPercentage(currentSavings, savingsGoal);
    const monthsNeeded = calculateRemaining(savingsGoal, currentSavings) / monthlyContribution;

    expect(progress).toBe(35);
    expect(monthsNeeded).toBe(13);
  });

  it('should correctly calculate debt payoff scenario', () => {
    const debtAmount = 5000;
    const interestRate = 0.18;
    const months = 24;

    const payoff = calculateMonthlyPayment(debtAmount, interestRate, months);
    const totalPaid = payoff * months;
    const interestPaid = totalPaid - debtAmount;

    expect(payoff).toBeCloseTo(246.49, 2);
    expect(totalPaid).toBeCloseTo(5915.76, 2);
    expect(interestPaid).toBeCloseTo(915.76, 2);
  });
});
