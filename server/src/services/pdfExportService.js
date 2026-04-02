/**
 * PDF Export Service
 * Generates a monthly financial summary PDF using pdfkit.
 */

import PDFDocument from 'pdfkit';
import { getFinancialSummary } from './financialSummaryService.js';
import logger from '../utils/logger.js';

const fmtCurrency = (value) => `$${(Number(value) || 0).toFixed(2)}`;

/**
 * Generate a monthly report PDF as a Buffer.
 * @param {string} householdId
 * @param {string} month  YYYY-MM
 * @returns {Promise<Buffer>}
 */
export async function generateMonthlyPDF(householdId, month) {
  const summary = await getFinancialSummary(householdId, month);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const ACCENT = '#4F46E5'; // indigo-600
    const GRAY = '#6B7280';
    const BLACK = '#111827';

    // ── Header ───────────────────────────────────────────────
    doc.fontSize(22).fillColor(ACCENT).text('Household Finance Report', { align: 'center' });
    doc.fontSize(12).fillColor(GRAY).text(month, { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(560, doc.y).strokeColor(ACCENT).lineWidth(1.5).stroke();
    doc.moveDown();

    // ── Summary Stats ────────────────────────────────────────
    doc.fontSize(14).fillColor(ACCENT).text('Financial Summary');
    doc.moveDown(0.5);

    const stats = [
      ['Gross Income', fmtCurrency(summary.grossIncome)],
      ['Real Income (after transfers)', fmtCurrency(summary.realIncome)],
      ['Total Expenses', fmtCurrency(summary.realExpenses)],
      ['Net Saved', fmtCurrency(summary.netSaved)],
      ['Transfer Volume', fmtCurrency(summary.transferVolume)],
    ];

    for (const [label, value] of stats) {
      doc.fontSize(10).fillColor(GRAY).text(label, 50, doc.y, { continued: true, width: 250 });
      doc.fillColor(BLACK).text(value, { align: 'right' });
    }
    doc.moveDown();

    // ── Spending by Category ─────────────────────────────────
    const byCat = summary.byCategory || {};
    const sortedCategories = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

    if (sortedCategories.length > 0) {
      doc.fontSize(14).fillColor(ACCENT).text('Spending by Category');
      doc.moveDown(0.5);

      // Table header
      doc.fontSize(9).fillColor(GRAY)
        .text('Category', 50, doc.y, { continued: true, width: 250 })
        .text('Amount', { align: 'right' });
      doc.moveTo(50, doc.y).lineTo(560, doc.y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
      doc.moveDown(0.3);

      for (const [category, amount] of sortedCategories) {
        doc.fontSize(10).fillColor(BLACK)
          .text(category, 50, doc.y, { continued: true, width: 250 })
          .fillColor(amount > 0 ? '#DC2626' : BLACK)
          .text(fmtCurrency(amount), { align: 'right' });
      }
      doc.moveDown();
    }

    // ── Transfer Breakdown ───────────────────────────────────
    if (summary.incomeTransfersExcluded > 0 || summary.expenseInternalTransfersExcluded > 0) {
      doc.fontSize(14).fillColor(ACCENT).text('Transfer Breakdown');
      doc.moveDown(0.5);

      const transferStats = [
        ['Income transfers excluded', fmtCurrency(summary.incomeTransfersExcluded)],
        ['Expense transfers excluded', fmtCurrency(summary.expenseInternalTransfersExcluded)],
        ['External transfer outflows', fmtCurrency(summary.externalTransferOutflowsTotal)],
      ];

      for (const [label, value] of transferStats) {
        doc.fontSize(10).fillColor(GRAY).text(label, 50, doc.y, { continued: true, width: 250 });
        doc.fillColor(BLACK).text(value, { align: 'right' });
      }
      doc.moveDown();
    }

    // ── Footer ───────────────────────────────────────────────
    doc.fontSize(8).fillColor(GRAY)
      .text(`Generated ${new Date().toLocaleString()}`, 50, 720, { align: 'center', width: 510 });

    doc.end();
  });
}
