/**
 * Financial Calculation Utilities
 * Critical calculations for household finance tracking
 */

/**
 * Calculate total from array of items
 * @param {Array} items - Items to sum
 * @param {string} field - Field name to sum
 * @returns {number} - Total amount
 */
export const calculateTotal = (items, field = 'amount') => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const amount = parseFloat(item[field]) || 0;
    return sum + amount;
  }, 0);
};

/**
 * Calculate average from array of items
 * @param {Array} items - Items to average
 * @param {string} field - Field name to average
 * @returns {number} - Average amount
 */
export const calculateAverage = (items, field = 'amount') => {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const total = calculateTotal(items, field);
  return total / items.length;
};

/**
 * Calculate percentage of total
 * @param {number} amount - Amount to calculate percentage of
 * @param {number} total - Total amount
 * @returns {number} - Percentage (0-100)
 */
export const calculatePercentage = (amount, total) => {
  if (total === 0) return 0;
  return (amount / total) * 100;
};

/**
 * Calculate remaining amount after subtraction
 * @param {number} total - Original total
 * @param {number} spent - Amount spent
 * @returns {number} - Remaining amount
 */
export const calculateRemaining = (total, spent) => {
  return Math.max(0, total - spent);
};

/**
 * Calculate percentage toward goal
 * @param {number} current - Current amount
 * @param {number} target - Target amount
 * @returns {number} - Percentage toward goal (0-100)
 */
export const calculateProgressPercentage = (current, target) => {
  if (target === 0) return 0;
  return Math.min(100, (current / target) * 100);
};

/**
 * Calculate compound interest
 * @param {number} principal - Initial amount
 * @param {number} rate - Annual interest rate (as decimal, e.g., 0.05 for 5%)
 * @param {number} years - Number of years
 * @param {number} compounds - Times compounded per year (default: 12 for monthly)
 * @returns {number} - Final amount
 */
export const calculateCompoundInterest = (principal, rate, years, compounds = 12) => {
  return principal * Math.pow(1 + rate / compounds, compounds * years);
};

/**
 * Calculate monthly payment for loan
 * @param {number} principal - Loan amount
 * @param {number} rate - Annual interest rate (as decimal)
 * @param {number} months - Number of months
 * @returns {number} - Monthly payment
 */
export const calculateMonthlyPayment = (principal, rate, months) => {
  const monthlyRate = rate / 12;
  if (monthlyRate === 0) return principal / months;
  
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
};

/**
 * Calculate credit utilization ratio
 * @param {Array} cards - Credit card objects with { limit, balance }
 * @returns {number} - Utilization ratio (0-100)
 */
export const calculateCreditUtilization = (cards) => {
  if (!Array.isArray(cards) || cards.length === 0) return 0;
  
  const totalLimit = calculateTotal(cards, 'limit');
  const totalBalance = calculateTotal(cards, 'balance');
  
  if (totalLimit === 0) return 0;
  return (totalBalance / totalLimit) * 100;
};

/**
 * Calculate savings rate
 * @param {number} income - Total income
 * @param {number} expenses - Total expenses
 * @returns {number} - Savings rate as percentage (0-100)
 */
export const calculateSavingsRate = (income, expenses) => {
  if (income === 0) return 0;
  const savings = income - expenses;
  return (savings / income) * 100;
};

/**
 * Calculate debt-to-income ratio
 * @param {number} monthlyDebtPayments - Total monthly debt payments
 * @param {number} monthlyIncome - Monthly gross income
 * @returns {number} - DTI ratio (0-100)
 */
export const calculateDebtToIncomeRatio = (monthlyDebtPayments, monthlyIncome) => {
  if (monthlyIncome === 0) return 0;
  return (monthlyDebtPayments / monthlyIncome) * 100;
};

/**
 * Calculate months to goal
 * @param {number} remaining - Amount remaining to goal
 * @param {number} monthlyContribution - Monthly contribution amount
 * @returns {number} - Months to reach goal (0 if already reached)
 */
export const calculateMonthsToGoal = (remaining, monthlyContribution) => {
  if (monthlyContribution === 0 || remaining <= 0) return 0;
  return Math.ceil(remaining / monthlyContribution);
};

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: 'USD')
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

/**
 * Round to 2 decimal places (common for currency)
 * @param {number} amount - Amount to round
 * @returns {number} - Rounded amount
 */
export const roundCurrency = (amount) => {
  return Math.round(amount * 100) / 100;
};

/**
 * Calculate split amount evenly among members
 * @param {number} total - Total amount to split
 * @param {number} memberCount - Number of members
 * @returns {number} - Amount per member
 */
export const calculateSplitAmount = (total, memberCount) => {
  if (memberCount === 0) return 0;
  return roundCurrency(total / memberCount);
};

/**
 * Calculate expense breakdown by category
 * @param {Array} expenses - Array of expenses with { category, amount }
 * @returns {Object} - Object with categories as keys and totals as values
 */
export const calculateCategoryBreakdown = (expenses) => {
  if (!Array.isArray(expenses)) return {};
  
  return expenses.reduce((breakdown, expense) => {
    const category = expense.category || 'Other';
    const amount = parseFloat(expense.amount) || 0;
    breakdown[category] = (breakdown[category] || 0) + amount;
    return breakdown;
  }, {});
};

/**
 * Calculate running balance (for transaction history)
 * @param {Array} transactions - Sorted transactions with { amount, type }
 * @param {number} startingBalance - Starting balance
 * @returns {Array} - Transactions with running balance
 */
export const calculateRunningBalance = (transactions, startingBalance = 0) => {
  if (!Array.isArray(transactions)) return [];
  
  let runningBalance = startingBalance;
  return transactions
    .map(transaction => {
      const amount = parseFloat(transaction.amount) || 0;
      const change = transaction.type === 'income' ? amount : -amount;
      runningBalance += change;
      
      return {
        ...transaction,
        runningBalance: roundCurrency(runningBalance)
      };
    });
};

export default {
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
  formatCurrency,
  roundCurrency,
  calculateSplitAmount,
  calculateCategoryBreakdown,
  calculateRunningBalance
};
