/**
 * Finance Meeting Report Page
 * Produces a clean, print-ready monthly financial report for household meetings.
 * Supports multi-file bank statement upload (CSV parsed client-side, PDF via server OCR).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import api from '../services/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n) => `$${(Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtMonth = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
};
const currentYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function guessCategory(desc) {
  const t = (desc || '').toLowerCase();
  if (/grocery|grocer|supermarket|whole foods|walmart|target|kroger|publix|aldi|trader joe|food lion/i.test(t)) return 'Groceries';
  if (/restaurant|cafe|coffee|starbucks|mcdonald|burger|pizza|taco|subway|diner|doordash|grubhub|uber eats/i.test(t)) return 'Dining';
  if (/shell|bp |exxon|chevron|gas station|fuel/i.test(t)) return 'Gas';
  if (/pharmacy|cvs|walgreen|rite aid|hospital|medical|dental/i.test(t)) return 'Medical';
  if (/amazon|ebay|best buy|costco|shop|retail|clothing/i.test(t)) return 'Shopping';
  if (/uber|lyft|transit|bus|taxi|parking|toll/i.test(t)) return 'Transportation';
  if (/netflix|spotify|hulu|disney|subscription|streaming/i.test(t)) return 'Subscriptions';
  if (/electric|water|gas bill|utility|internet|cable|at&t|verizon|comcast/i.test(t)) return 'Utilities';
  if (/mortgage|rent|hoa|lease/i.test(t)) return 'Housing';
  if (/payroll|direct deposit|salary|ach credit/i.test(t)) return 'Income';
  return 'Other';
}

const CATEGORIES = ['Groceries','Dining','Gas','Medical','Shopping','Transportation','Subscriptions','Utilities','Housing','Transfer','Income','Other'];

// Generate last 12 months as YYYY-MM options
function last12Months() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(ym);
  }
  return months;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }) {
  return (
    <div className="flex items-baseline justify-between mb-3 print:mb-2">
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 print:text-black">{title}</h2>
      {subtitle && <span className="text-xs text-gray-400 dark:text-gray-500 print:text-gray-500">{subtitle}</span>}
    </div>
  );
}

function ReportSection({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 print:rounded-none print:border-gray-200 print:bg-white print:p-0 print:border-0 print:border-b print:pb-4 print:mb-4 ${className}`}>
      {children}
    </div>
  );
}

function StatusBadge({ paid }) {
  return paid
    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full print:bg-transparent print:text-green-700">✓ Paid</span>
    : <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full print:bg-transparent print:text-red-700">✗ Unpaid</span>;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function FinanceMeetingReportPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState(searchParams.get('month') || currentYM());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Report data
  const [income, setIncome] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [fixedPayments, setFixedPayments] = useState([]);
  const [varExpenses, setVarExpenses] = useState([]);
  const [goals, setGoals] = useState([]);
  const [splits, setSplits] = useState([]);
  const [summary, setSummary] = useState(null);

  // Upload state
  const [uploadFiles, setUploadFiles] = useState([]); // [{id, name, ext, status, transactions, error}]
  const [reviewRows, setReviewRows] = useState([]);    // all parsed transactions across files
  const [uploadExpanded, setUploadExpanded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadPdfLoading, setUploadPdfLoading] = useState(false);
  const fileInputRef = useRef(null);

  // ── Fetch report data ──────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    if (!user?.householdId) return;
    setLoading(true);
    setError(null);
    try {
      const hid = user.householdId;
      const [incRes, varRes, fixedRes, fixPayRes, goalsRes, splitsRes, summaryRes] = await Promise.all([
        api.get(`/income/${hid}`),
        api.get(`/expenses/${hid}`),
        api.get(`/fixed-expenses/${hid}`),
        api.get(`/fixed-expense-payments/${hid}?month=${selectedMonth}`),
        api.get(`/goals/${hid}`),
        api.get(`/income-splits/${hid}`),
        api.get(`/households/${hid}/summary`).catch(() => ({ data: {} })),
      ]);

      const allIncome = incRes.data.incomes || [];
      const allVar = varRes.data.expenses || [];
      const allFixed = fixedRes.data.expenses || [];
      const allFixPay = fixPayRes.data.payments || [];
      const allGoals = goalsRes.data.goals || [];
      const allSplits = splitsRes.data.splits || [];

      // Filter to selected month
      setIncome(allIncome.filter(i => i.month === selectedMonth));
      setVarExpenses(allVar.filter(e => (e.month || (e.date || '').substring(0, 7)) === selectedMonth));
      // Fixed expenses are not month-specific — all are recurring; filter payments to month
      setFixedExpenses(allFixed);
      setFixedPayments(allFixPay.filter(p => (p.month || (p.paymentDate || '').substring(0, 7)) === selectedMonth));
      setGoals(allGoals);
      setSplits(allSplits);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error('[FinanceMeeting] fetch error:', err);
      setError('Failed to load report data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.householdId, selectedMonth]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // ── Derived totals ─────────────────────────────────────────────────────────
  const totalIncome = income.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  // Fixed expenses: mark each as paid if there's a matching payment for the month
  const fixedWithStatus = fixedExpenses.map(fe => ({
    ...fe,
    paid: fixedPayments.some(p => String(p.fixedExpenseId) === String(fe._id)),
    paymentAmount: fixedPayments.find(p => String(p.fixedExpenseId) === String(fe._id))?.amount,
  }));
  const totalFixedPaid = fixedWithStatus.filter(f => f.paid).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const totalFixedUnpaid = fixedWithStatus.filter(f => !f.paid).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const totalFixed = totalFixedPaid + totalFixedUnpaid;

  // Variable expenses grouped by category
  const varByCategory = {};
  varExpenses.forEach(e => {
    const cat = e.category || 'Other';
    if (!varByCategory[cat]) varByCategory[cat] = { total: 0, items: [] };
    varByCategory[cat].total += Number(e.amount) || 0;
    varByCategory[cat].items.push(e);
  });
  const totalVar = varExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Imported statement transactions by category (only checked debit rows)
  const importedDebits = reviewRows.filter(r => r.included && r.type !== 'credit');
  const importedByCategory = {};
  importedDebits.forEach(r => {
    const cat = r.category || 'Other';
    if (!importedByCategory[cat]) importedByCategory[cat] = 0;
    importedByCategory[cat] += Number(r.amount) || 0;
  });
  const totalImported = importedDebits.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const totalExpenses = totalFixed + totalVar + totalImported;
  const netRemaining = totalIncome - totalExpenses;
  const toSavings = goals.reduce((s, g) => s + (Number(g.monthlyContribution) || 0), 0);

  // ── CSV parsing (client-side) ──────────────────────────────────────────────
  const parseCSV = (file) => {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data;
          const transactions = rows.map(row => {
            // Try common column names across banks
            const date = row.Date || row.date || row['Transaction Date'] || row['Posted Date'] || '';
            const desc = row.Description || row.description || row.Memo || row.memo || row.Name || row.name || '';
            // Amount: some banks use separate Debit/Credit columns
            let amount = 0;
            let type = 'debit';
            if (row.Amount !== undefined) {
              const raw = String(row.Amount).replace(/[$,\s]/g, '');
              amount = Math.abs(parseFloat(raw) || 0);
              type = parseFloat(raw) < 0 ? 'debit' : 'credit';
            } else if (row.Debit !== undefined || row.debit !== undefined) {
              const debitVal = String(row.Debit || row.debit || '0').replace(/[$,\s]/g, '');
              const creditVal = String(row.Credit || row.credit || '0').replace(/[$,\s]/g, '');
              if (parseFloat(debitVal) > 0) { amount = parseFloat(debitVal); type = 'debit'; }
              else { amount = parseFloat(creditVal) || 0; type = 'credit'; }
            }
            return { date, description: desc, amount, type, category: guessCategory(desc), bank: file.name };
          }).filter(t => t.amount > 0 && t.date);
          resolve(transactions);
        },
        error: () => resolve([]),
      });
    });
  };

  // ── File drop / selection handler ─────────────────────────────────────────
  const handleFilesSelected = async (files) => {
    const fileArr = Array.from(files);
    const newEntries = fileArr.map(f => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      name: f.name,
      ext: f.name.split('.').pop().toLowerCase(),
      status: 'processing',
      transactions: [],
      error: null,
      file: f,
    }));

    setUploadFiles(prev => [...prev, ...newEntries.map(({ file: _, ...rest }) => rest)]);
    setUploadExpanded(true);

    // PDF files — send to server; CSV files — parse locally
    const pdfFiles = newEntries.filter(e => e.ext === 'pdf');
    const csvFiles = newEntries.filter(e => e.ext === 'csv');

    // Process CSV files locally
    for (const entry of csvFiles) {
      const transactions = await parseCSV(entry.file);
      setUploadFiles(prev => prev.map(f =>
        f.id === entry.id
          ? { ...f, status: transactions.length > 0 ? 'done' : 'empty', transactions }
          : f
      ));
      setReviewRows(prev => [
        ...prev,
        ...transactions.map((t, i) => ({ ...t, rowId: `${entry.id}-${i}`, included: t.type === 'debit' })),
      ]);
    }

    // Process PDF files via server
    if (pdfFiles.length > 0) {
      setUploadPdfLoading(true);
      try {
        const formData = new FormData();
        pdfFiles.forEach(entry => formData.append('statements', entry.file));
        const res = await api.post('/statements/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const fileResults = res.data.files || [];
        for (const result of fileResults) {
          const entry = pdfFiles.find(e => e.name === result.filename);
          if (!entry) continue;
          setUploadFiles(prev => prev.map(f =>
            f.id === entry.id
              ? { ...f, status: result.error ? 'error' : result.transactionCount > 0 ? 'done' : 'empty', transactions: result.transactions, error: result.error || null }
              : f
          ));
          setReviewRows(prev => [
            ...prev,
            ...result.transactions.map((t, i) => ({ ...t, rowId: `${entry.id}-${i}`, included: t.type === 'debit' })),
          ]);
        }
      } catch (err) {
        pdfFiles.forEach(entry => {
          setUploadFiles(prev => prev.map(f =>
            f.id === entry.id ? { ...f, status: 'error', error: 'Upload failed' } : f
          ));
        });
      } finally {
        setUploadPdfLoading(false);
      }
    }
  };

  const toggleRow = (rowId) => setReviewRows(prev => prev.map(r => r.rowId === rowId ? { ...r, included: !r.included } : r));
  const updateRowCategory = (rowId, cat) => setReviewRows(prev => prev.map(r => r.rowId === rowId ? { ...r, category: cat } : r));
  const removeFile = (id) => {
    const file = uploadFiles.find(f => f.id === id);
    setUploadFiles(prev => prev.filter(f => f.id !== id));
    if (file) setReviewRows(prev => prev.filter(r => !r.rowId.startsWith(id)));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFilesSelected(e.dataTransfer.files);
  };

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => window.print();

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Building your finance report…</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={fetchReport} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Retry</button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #finance-report, #finance-report * { visibility: visible; }
          #finance-report { position: absolute; top: 0; left: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
          .print-page-break { page-break-before: always; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>

      <Layout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

          {/* ── Toolbar (no-print) ─────────────────────────────────────── */}
          <div className="no-print mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Finance Meeting Report</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Monthly household financial summary for your review meeting</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {last12Months().map(ym => (
                  <option key={ym} value={ym}>{fmtMonth(ym)}</option>
                ))}
              </select>
              <button
                onClick={() => setUploadExpanded(v => !v)}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Statements {uploadFiles.length > 0 && `(${uploadFiles.length})`}
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / Save PDF
              </button>
            </div>
          </div>

          {/* ── Bank Statement Upload Panel (no-print) ────────────────── */}
          {uploadExpanded && (
            <div className="no-print mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">Upload Bank Statements</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Upload CSV or PDF statements from multiple banks. CSV is recommended for accuracy.</p>
                </div>
                <button onClick={() => setUploadExpanded(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Drop zone */}
              <div
                className="m-4 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <span className="text-indigo-500 font-medium">Click to select</span> or drag &amp; drop
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">CSV and PDF — up to 10 files at once</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.pdf"
                  multiple
                  className="hidden"
                  onChange={e => handleFilesSelected(e.target.files)}
                />
              </div>

              {/* File status pills */}
              {uploadFiles.length > 0 && (
                <div className="px-4 pb-3 flex flex-wrap gap-2">
                  {uploadFiles.map(f => (
                    <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium
                      bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        f.status === 'processing' ? 'bg-amber-400 animate-pulse' :
                        f.status === 'done' ? 'bg-green-400' :
                        f.status === 'empty' ? 'bg-gray-400' : 'bg-red-400'
                      }`} />
                      <span className="max-w-[160px] truncate">{f.name}</span>
                      {f.status === 'done' && <span className="text-gray-400">· {f.transactions.length} rows</span>}
                      {f.status === 'error' && <span className="text-red-500">error</span>}
                      {f.status === 'empty' && <span className="text-gray-400">no transactions found</span>}
                      <button onClick={() => removeFile(f.id)} className="text-gray-400 hover:text-red-500 ml-1">×</button>
                    </div>
                  ))}
                  {uploadPdfLoading && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs text-gray-500 border-gray-200">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Processing PDF…
                    </div>
                  )}
                </div>
              )}

              {/* Transaction review table */}
              {reviewRows.length > 0 && (
                <div className="px-4 pb-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Review Transactions — {reviewRows.filter(r => r.included).length} of {reviewRows.length} selected
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setReviewRows(prev => prev.map(r => ({ ...r, included: r.type !== 'credit' })))} className="text-xs text-indigo-500 hover:underline">Select debits</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => setReviewRows(prev => prev.map(r => ({ ...r, included: true })))} className="text-xs text-indigo-500 hover:underline">All</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => setReviewRows(prev => prev.map(r => ({ ...r, included: false })))} className="text-xs text-gray-400 hover:underline">None</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        <tr>
                          <th className="px-3 py-2 w-8 text-center">
                            <input type="checkbox" className="rounded"
                              checked={reviewRows.every(r => r.included)}
                              onChange={e => setReviewRows(prev => prev.map(r => ({ ...r, included: e.target.checked })))}
                            />
                          </th>
                          <th className="px-3 py-2 text-left font-medium">Bank</th>
                          <th className="px-3 py-2 text-left font-medium">Date</th>
                          <th className="px-3 py-2 text-left font-medium">Description</th>
                          <th className="px-3 py-2 text-left font-medium">Category</th>
                          <th className="px-3 py-2 text-right font-medium">Amount</th>
                          <th className="px-3 py-2 text-center font-medium">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {reviewRows.map(row => (
                          <tr key={row.rowId} className={`${row.included ? '' : 'opacity-40'} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" className="rounded" checked={row.included} onChange={() => toggleRow(row.rowId)} />
                            </td>
                            <td className="px-3 py-2 text-gray-500 max-w-[90px] truncate">{row.bank?.split('.')[0]}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{row.date}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[180px] truncate">{row.description}</td>
                            <td className="px-3 py-2">
                              <select
                                value={row.category}
                                onChange={e => updateRowCategory(row.rowId, e.target.value)}
                                className="text-xs py-0.5 px-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                              >
                                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                              </select>
                            </td>
                            <td className={`px-3 py-2 text-right font-medium ${row.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                              {row.type === 'credit' ? '+' : '-'}{fmt(row.amount)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${row.type === 'credit' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {row.type}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importedDebits.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
                      {importedDebits.length} debit transactions · Total: <span className="font-semibold text-red-600">{fmt(totalImported)}</span> — included in report summary below
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              REPORT CONTENT — everything below here prints
          ══════════════════════════════════════════════════════════════════ */}
          <div id="finance-report" className="space-y-5">

            {/* ── Report Header ─────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-xl p-6 text-white print:rounded-none print:from-white print:to-white print:text-black print:border print:border-gray-300 print:p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center print:hidden">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    <span className="text-white/80 text-sm font-medium print:text-gray-500">Household Budget</span>
                  </div>
                  <h1 className="text-2xl font-bold print:text-2xl print:text-gray-900">Monthly Finance Report</h1>
                  <p className="text-white/90 text-lg font-medium mt-0.5 print:text-gray-700">{fmtMonth(selectedMonth)}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/70 text-xs print:text-gray-400">Generated</p>
                  <p className="text-white text-sm font-medium print:text-gray-700">{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  {uploadFiles.filter(f => f.status === 'done').length > 0 && (
                    <p className="text-white/70 text-xs mt-1 print:text-gray-400">
                      + {uploadFiles.filter(f => f.status === 'done').length} bank statement{uploadFiles.filter(f => f.status === 'done').length > 1 ? 's' : ''} uploaded
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Summary Box ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Income', value: fmt(totalIncome), color: 'green', icon: '↑' },
                { label: 'Total Expenses', value: fmt(totalExpenses), color: 'red', icon: '↓' },
                { label: 'Net Remaining', value: fmt(netRemaining), color: netRemaining >= 0 ? 'blue' : 'red', icon: '=' },
                { label: 'To Savings', value: fmt(toSavings), color: 'purple', icon: '🏦' },
              ].map(card => (
                <div key={card.label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 print:rounded-none print:bg-white print:border-gray-200`}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 print:text-gray-500">{card.label}</p>
                  <p className={`text-xl font-bold text-${card.color}-600 print:text-${card.color}-600`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* ── 1. Income Received ────────────────────────────────────── */}
            <ReportSection>
              <SectionHeader title="1. Income Received" subtitle={`${income.length} entries`} />
              {income.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No income recorded for {fmtMonth(selectedMonth)}.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 print:border-gray-200">
                      <th className="pb-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Contributor</th>
                      <th className="pb-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Source</th>
                      <th className="pb-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Week</th>
                      <th className="pb-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50 print:divide-gray-100">
                    {income.map((inc, i) => (
                      <tr key={inc._id || i}>
                        <td className="py-2 text-gray-700 dark:text-gray-300 print:text-gray-800">{inc.contributorName || '—'}</td>
                        <td className="py-2 text-gray-500 dark:text-gray-400 print:text-gray-600">{inc.source || '—'}</td>
                        <td className="py-2 text-gray-400 print:text-gray-500">Wk {inc.week || '—'}</td>
                        <td className="py-2 text-right font-semibold text-green-600">{fmt(inc.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-gray-600 print:border-gray-300">
                      <td colSpan={3} className="pt-2 font-bold text-gray-700 dark:text-gray-200 print:text-gray-800">Total Income</td>
                      <td className="pt-2 text-right font-bold text-green-600 text-base">{fmt(totalIncome)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </ReportSection>

            {/* ── 2. Fixed Expenses ─────────────────────────────────────── */}
            <ReportSection>
              <SectionHeader title="2. Fixed Expenses" subtitle={`${fixedWithStatus.filter(f => f.paid).length} paid · ${fixedWithStatus.filter(f => !f.paid).length} unpaid`} />
              {fixedWithStatus.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No fixed expenses found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 print:border-gray-200">
                      <th className="pb-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                      <th className="pb-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Category</th>
                      <th className="pb-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                      <th className="pb-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50 print:divide-gray-100">
                    {fixedWithStatus.map((fe, i) => (
                      <tr key={fe._id || i}>
                        <td className="py-2 text-gray-700 dark:text-gray-300 print:text-gray-800">{fe.name}</td>
                        <td className="py-2 text-gray-400 print:text-gray-500">{fe.category || '—'}</td>
                        <td className="py-2 text-center"><StatusBadge paid={fe.paid} /></td>
                        <td className="py-2 text-right font-semibold text-red-600">{fmt(fe.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-100 dark:border-gray-700 print:border-gray-200">
                      <td colSpan={3} className="pt-2 text-sm text-gray-500 print:text-gray-600">Paid</td>
                      <td className="pt-2 text-right text-sm font-semibold text-green-600">{fmt(totalFixedPaid)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-1 text-sm text-gray-500 print:text-gray-600">Still Owed</td>
                      <td className="py-1 text-right text-sm font-semibold text-amber-600">{fmt(totalFixedUnpaid)}</td>
                    </tr>
                    <tr className="border-t-2 border-gray-200 dark:border-gray-600 print:border-gray-300">
                      <td colSpan={3} className="pt-2 font-bold text-gray-700 dark:text-gray-200 print:text-gray-800">Total Fixed</td>
                      <td className="pt-2 text-right font-bold text-red-600 text-base">{fmt(totalFixed)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </ReportSection>

            {/* ── 3. Variable Expenses ──────────────────────────────────── */}
            <ReportSection>
              <SectionHeader title="3. Variable Expenses" subtitle={`${varExpenses.length} transactions`} />
              {Object.keys(varByCategory).length === 0 && importedDebits.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No variable expenses for {fmtMonth(selectedMonth)}.</p>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700 print:border-gray-200">
                        <th className="pb-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Category</th>
                        <th className="pb-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide"># Items</th>
                        <th className="pb-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50 print:divide-gray-100">
                      {Object.entries(varByCategory).sort((a,b) => b[1].total - a[1].total).map(([cat, data]) => (
                        <tr key={cat}>
                          <td className="py-2 text-gray-700 dark:text-gray-300 print:text-gray-800">{cat}</td>
                          <td className="py-2 text-right text-gray-400 print:text-gray-500">{data.items.length}</td>
                          <td className="py-2 text-right font-semibold text-orange-600">{fmt(data.total)}</td>
                        </tr>
                      ))}
                      {/* Imported from statements */}
                      {Object.entries(importedByCategory).sort((a,b) => b[1] - a[1]).map(([cat, total]) => (
                        <tr key={`imported-${cat}`} className="bg-indigo-50/40 dark:bg-indigo-900/20 print:bg-transparent">
                          <td className="py-2 text-gray-700 dark:text-gray-300 print:text-gray-800">
                            {cat}
                            <span className="ml-2 text-xs text-indigo-500 print:text-indigo-600">(from statement)</span>
                          </td>
                          <td className="py-2 text-right text-gray-400">—</td>
                          <td className="py-2 text-right font-semibold text-orange-600">{fmt(total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 dark:border-gray-600 print:border-gray-300">
                        <td colSpan={2} className="pt-2 font-bold text-gray-700 dark:text-gray-200 print:text-gray-800">Total Variable</td>
                        <td className="pt-2 text-right font-bold text-orange-600 text-base">{fmt(totalVar + totalImported)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}
            </ReportSection>

            {/* ── 4. Credit & Debt ──────────────────────────────────────── */}
            {summary?.creditCards && summary.creditCards.length > 0 && (
              <ReportSection>
                <SectionHeader title="4. Credit &amp; Debt" />
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 print:border-gray-200">
                      <th className="pb-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Card</th>
                      <th className="pb-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Balance</th>
                      <th className="pb-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Limit</th>
                      <th className="pb-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50 print:divide-gray-100">
                    {summary.creditCards.map((card, i) => {
                      const util = card.creditLimit > 0 ? ((card.currentBalance / card.creditLimit) * 100).toFixed(0) : 0;
                      return (
                        <tr key={card._id || i}>
                          <td className="py-2 text-gray-700 dark:text-gray-300 print:text-gray-800">{card.cardName || card.name}</td>
                          <td className="py-2 text-right font-semibold text-red-600">{fmt(card.currentBalance)}</td>
                          <td className="py-2 text-right text-gray-400">{fmt(card.creditLimit)}</td>
                          <td className="py-2 text-right">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${util > 70 ? 'bg-red-50 text-red-700' : util > 30 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                              {util}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ReportSection>
            )}

            {/* ── 5. Savings & Goals ────────────────────────────────────── */}
            {goals.length > 0 && (
              <ReportSection>
                <SectionHeader title="5. Savings &amp; Goals" subtitle={`${goals.length} goals`} />
                <div className="space-y-4">
                  {goals.map((goal, i) => {
                    const pct = goal.target > 0 ? Math.min((goal.currentBalance / goal.target) * 100, 100) : 0;
                    return (
                      <div key={goal._id || i} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 print:border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 print:text-gray-900">{goal.name}</p>
                            <p className="text-xs text-gray-400">{goal.type}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-teal-600">{fmt(goal.currentBalance)}</p>
                            <p className="text-xs text-gray-400">of {fmt(goal.target)}</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 print:bg-gray-200">
                          <div
                            className="bg-teal-500 h-2 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-gray-400">{pct.toFixed(0)}% complete</span>
                          {goal.monthlyContribution > 0 && (
                            <span className="text-xs text-gray-400">Monthly contribution: {fmt(goal.monthlyContribution)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between print:border-gray-200">
                  <span className="font-bold text-gray-700 dark:text-gray-200 print:text-gray-800">Total Monthly Contributions</span>
                  <span className="font-bold text-teal-600">{fmt(toSavings)}</span>
                </div>
              </ReportSection>
            )}

            {/* ── 6. Income Split ──────────────────────────────────────── */}
            {splits.length > 0 && (
              <ReportSection>
                <SectionHeader title="6. Household Income Split" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {splits.map((split, i) => {
                    const monthly = (netRemaining * split.splitPercentage) / 100;
                    const weekly = monthly / 4.33;
                    return (
                      <div key={split._id || i} className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-lg p-4 print:bg-transparent print:border print:border-gray-200">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-gray-800 dark:text-gray-100 print:text-gray-900">{split.userName}</span>
                          <span className="text-sm font-medium text-indigo-600 print:text-indigo-700">{split.splitPercentage}%</span>
                        </div>
                        <div className="flex gap-4">
                          <div>
                            <p className="text-xs text-gray-400">Monthly share</p>
                            <p className="font-bold text-indigo-600">{fmt(monthly)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Weekly</p>
                            <p className="font-bold text-purple-600">{fmt(weekly)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ReportSection>
            )}

            {/* ── Final Summary Banner ──────────────────────────────────── */}
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-5 border border-gray-200 dark:border-gray-700 print:border-gray-300 print:bg-white">
              <h2 className="font-bold text-gray-700 dark:text-gray-200 print:text-gray-800 mb-4 text-base">Summary</h2>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Total Income', val: fmt(totalIncome), color: 'text-green-600' },
                  { label: 'Fixed Expenses', val: fmt(totalFixed), color: 'text-red-600' },
                  { label: 'Variable Expenses', val: fmt(totalVar + totalImported), color: 'text-orange-600' },
                  { label: 'Total Expenses', val: fmt(totalExpenses), color: 'text-red-700', bold: true },
                  { label: 'Net Remaining', val: fmt(netRemaining), color: netRemaining >= 0 ? 'text-blue-600' : 'text-red-600', bold: true },
                  { label: 'Savings Contributions', val: fmt(toSavings), color: 'text-teal-600' },
                  { label: 'After Savings', val: fmt(netRemaining - toSavings), color: 'text-indigo-600', bold: true },
                ].map(row => (
                  <div key={row.label} className={`flex justify-between items-center ${row.bold ? 'border-t border-gray-200 dark:border-gray-600 pt-2 mt-2 print:border-gray-200' : ''}`}>
                    <span className={`${row.bold ? 'font-bold text-gray-800 dark:text-gray-100 print:text-gray-900' : 'text-gray-600 dark:text-gray-400 print:text-gray-600'}`}>{row.label}</span>
                    <span className={`font-semibold ${row.color} ${row.bold ? 'text-base' : ''}`}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Print footer ──────────────────────────────────────────── */}
            <div className="hidden print:block text-center mt-8 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-400">Household Budget · {fmtMonth(selectedMonth)} Finance Meeting · Generated {new Date().toLocaleDateString()}</p>
            </div>

          </div>
          {/* end #finance-report */}

        </div>
      </Layout>
    </>
  );
}
