/**
 * Export Service - Utility functions for exporting data as CSV and JSON
 */

// Download helper function
const downloadFile = (content, filename, mimeType = 'text/csv') => {
  const element = document.createElement('a');
  element.setAttribute('href', `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`);
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

// Convert data to CSV format
export const exportToCSV = (data, filename, headers = null) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from first object or use provided headers
  const csvHeaders = headers || Object.keys(data[0]);
  const csvContent = [
    csvHeaders.join(','),
    ...data.map(row =>
      csvHeaders.map(header => {
        const value = row[header];
        // Handle values with commas, quotes, or newlines
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    ),
  ].join('\n');

  downloadFile(csvContent, filename, 'text/csv');
};

// Export credit cards data
export const exportCreditCards = (cards, summary) => {
  const data = cards.map(card => ({
    'Card Name': card.cardName,
    'Holder': card.holder,
    'Current Balance': `$${card.currentBalance.toFixed(2)}`,
    'Original Balance': `$${card.originalBalance.toFixed(2)}`,
    'Min Payment': `$${card.minPayment}`,
    'Interest Rate': `${card.interestRate}%`,
    'Credit Limit': `$${card.creditLimit}`,
    'Due Day': card.dueDay,
  }));

  // Add summary row
  if (summary) {
    data.push({
      'Card Name': 'TOTAL',
      'Holder': '',
      'Current Balance': `$${summary.totalDebt?.toFixed(2)}`,
      'Original Balance': `$${summary.totalOriginal?.toFixed(2)}`,
      'Min Payment': '',
      'Interest Rate': '',
      'Credit Limit': `$${summary.totalOriginal?.toFixed(2)}`,
      'Due Day': '',
    });
  }

  exportToCSV(data, `credit-cards-${new Date().toISOString().split('T')[0]}.csv`);
};

// Export card statements
export const exportCardStatements = (statements) => {
  const data = statements.map(stmt => ({
    'Card Name': stmt.cardId?.cardName || 'N/A',
    'Statement Name': stmt.statementName,
    'Month': stmt.month,
    'Statement Date': new Date(stmt.statementDate).toLocaleDateString(),
    'Statement Balance': `$${stmt.statementBalance.toFixed(2)}`,
    'Current Balance': `$${stmt.currentBalance.toFixed(2)}`,
    'Amount Paid': `$${(stmt.amountPaid || 0).toFixed(2)}`,
  }));

  exportToCSV(data, `card-statements-${new Date().toISOString().split('T')[0]}.csv`);
};

// Export debt payments
export const exportDebtPayments = (payments) => {
  const data = payments.map(payment => ({
    'Card Name': payment.cardId?.cardName || 'N/A',
    'Amount': `$${payment.amount.toFixed(2)}`,
    'Payment Date': new Date(payment.paymentDate).toLocaleDateString(),
    'Payment Method': payment.paymentMethod,
    'Month': payment.month,
  }));

  exportToCSV(data, `debt-payments-${new Date().toISOString().split('T')[0]}.csv`);
};

// Export monthly overview
export const exportMonthlyOverview = (monthlyData) => {
  const data = monthlyData.map(month => ({
    'Month': month.month,
    'Total Income': `$${month.totalIncome.toFixed(2)}`,
    'Total Expenses': `$${month.totalExpenses.toFixed(2)}`,
    'Remaining': `$${month.remaining.toFixed(2)}`,
    'Weekly Allowance': `$${month.weeklyAllowance.toFixed(2)}`,
  }));

  exportToCSV(data, `monthly-overview-${new Date().toISOString().split('T')[0]}.csv`);
};

// Export to JSON
export const exportToJSON = (data, filename) => {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, 'application/json');
};

// Generate and export financial report
export const exportFinancialReport = (reportData) => {
  const report = `
Financial Report
Generated: ${new Date().toLocaleString()}

SUMMARY
-------
Total Income: ${reportData.totalIncome}
Total Fixed Expenses: ${reportData.totalFixedExpenses}
Total Variable Expenses: ${reportData.totalVariableExpenses}
Total Credit Card Debt: ${reportData.totalDebt}
Available: ${reportData.available}

DETAILS
-------
${reportData.details}
`;

  downloadFile(report, `financial-report-${new Date().toISOString().split('T')[0]}.txt`, 'text/plain');
};
