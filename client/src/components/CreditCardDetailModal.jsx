import { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import api from '../services/api';
import PaymentSuggestionsWidget from './PaymentSuggestionsWidget';

const fmt = (n) => `$${(Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const currentYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function last24Months() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function fmtMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

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
  return 'Other';
}

const CATEGORIES = ['Groceries','Dining','Gas','Medical','Shopping','Transportation','Subscriptions','Utilities','Housing','Transfer','Income','Other'];

// ─── Sub-components ──────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
        active
          ? 'bg-indigo-600 text-white'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function CreditCardDetailModal({ card, householdId, onClose, onCardUpdated }) {
  const isSyncedCard = card?.isSynced || card?.sourceType === 'plaid';
  const [tab, setTab] = useState('transactions');
  const [month, setMonth] = useState(currentYM());
  const [search, setSearch] = useState('');

  // Transactions (CC statement rows)
  const [transactions, setTransactions] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);

  // Payments (DebtPayments)
  const [payments, setPayments] = useState([]);
  const [payLoading, setPayLoading] = useState(false);

  // Upload state
  const [reviewRows, setReviewRows] = useState([]);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [suggestionRefresh, setSuggestionRefresh] = useState(0);
  const fileInputRef = useRef(null);

  const months = last24Months();

  // ── Fetch transactions ───────────────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    setTxnLoading(true);
    try {
      if (isSyncedCard && card.linkedAccountId) {
        const res = await api.get(`/plaid/transactions?accountId=${card.linkedAccountId}&month=${month}&limit=500`);
        const mapped = (res.data.transactions || []).map((txn) => ({
          _id: txn._id,
          date: txn.date ? String(txn.date).substring(0, 10) : '',
          description: txn.merchant || txn.name || 'Bank transaction',
          category: txn.userCategory || txn.primaryCategory || 'Other',
          amount: Math.abs(Number(txn.amount) || 0),
          type: Number(txn.amount) < 0 ? 'credit' : 'debit',
          isSynced: true,
        }));
        setTransactions(mapped);
        return;
      }

      const res = await api.get(`/bank-transactions/${householdId}?sourceType=credit_card&creditCardId=${card._id}&month=${month}`);
      setTransactions(res.data.transactions || []);
    } catch {
      setTransactions([]);
    } finally {
      setTxnLoading(false);
    }
  }, [householdId, card._id, card.linkedAccountId, isSyncedCard, month]);

  // ── Fetch payments ───────────────────────────────────────────────────────
  const fetchPayments = useCallback(async () => {
    setPayLoading(true);
    try {
      if (isSyncedCard && card.linkedAccountId) {
        const res = await api.get(`/plaid/transactions?accountId=${card.linkedAccountId}&month=${month}&limit=500`);
        const paymentLike = (res.data.transactions || [])
          .filter((txn) => Number(txn.amount) < 0)
          .map((txn) => ({
            _id: txn._id,
            paymentDate: txn.date ? String(txn.date).substring(0, 10) : '',
            amountPaid: Math.abs(Number(txn.amount) || 0),
            notes: txn.merchant || txn.name || 'Account credit',
          }));
        setPayments(paymentLike);
        return;
      }

      const res = await api.get(`/debt-payments/${householdId}?cardId=${card._id}&month=${month}`);
      setPayments(res.data.payments || []);
    } catch {
      setPayments([]);
    } finally {
      setPayLoading(false);
    }
  }, [householdId, card._id, card.linkedAccountId, isSyncedCard, month]);

  useEffect(() => {
    fetchTransactions();
    fetchPayments();
    setReviewRows([]);
    setImportResult(null);
  }, [fetchTransactions, fetchPayments]);

  // ── CSV parsing ──────────────────────────────────────────────────────────
  const parseCSV = (file) => {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data;
          if (!rows || rows.length === 0) { resolve([]); return; }
          const clean = (v) => String(v || '').replace(/"/g, '').trim();
          const firstRow = rows[0].map(clean);
          const dateIdx = firstRow.findIndex(h => /date/i.test(h));
          const descIdx = firstRow.findIndex(h => /desc|narr|memo|payee|detail/i.test(h));
          const amtIdx  = firstRow.findIndex(h => /amount|amt|debit|credit/i.test(h));
          const typeIdx = firstRow.findIndex(h => /type|dr\/cr/i.test(h));
          const catIdx  = firstRow.findIndex(h => /category|cat/i.test(h));
          const hasHeader = dateIdx >= 0 || descIdx >= 0;
          const dataRows = hasHeader ? rows.slice(1) : rows;
          const idx = {
            date: dateIdx >= 0 ? dateIdx : 0,
            desc: descIdx >= 0 ? descIdx : 1,
            amt:  amtIdx  >= 0 ? amtIdx  : 2,
            type: typeIdx,
            cat:  catIdx,
          };
          const parsed = [];
          dataRows.forEach((row, i) => {
            const rawAmt = clean(row[idx.amt]);
            const amount = Math.abs(parseFloat(rawAmt.replace(/[,$]/g, '')) || 0);
            if (amount === 0 && !clean(row[idx.desc])) return;
            const rawType = idx.type >= 0 ? clean(row[idx.type]).toLowerCase() : '';
            const type = rawType.includes('credit') || rawAmt.includes('-') ? 'credit' : 'debit';
            const description = clean(row[idx.desc]);
            parsed.push({
              rowId: `${file.name}-${i}`,
              date: clean(row[idx.date]),
              description,
              amount,
              type,
              category: idx.cat >= 0 ? clean(row[idx.cat]) || guessCategory(description) : guessCategory(description),
              bank: file.name,
              source: 'csv',
              included: type !== 'credit',
            });
          });
          resolve(parsed);
        },
      });
    });
  };

  const handleFilesSelected = async (files) => {
    const fileList = Array.from(files);
    for (const file of fileList) {
      const ext = file.name.split('.').pop().toLowerCase();
      const fileEntry = { id: `${Date.now()}-${file.name}`, name: file.name, ext, status: 'processing', transactions: [] };
      setUploadFiles(prev => [...prev, fileEntry]);

      if (ext === 'csv') {
        const rows = await parseCSV(file);
        setUploadFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, status: rows.length ? 'done' : 'empty', transactions: rows } : f));
        if (rows.length) setReviewRows(prev => [...prev, ...rows]);
      } else if (ext === 'pdf') {
        setPdfLoading(true);
        try {
          const fd = new FormData();
          fd.append('file', file);
          const res = await api.post('/statements/parse-pdf', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          const rows = (res.data.transactions || []).map((t, i) => ({
            ...t,
            rowId: `${fileEntry.id}-${i}`,
            bank: file.name,
            included: t.type !== 'credit',
            category: t.category || guessCategory(t.description),
          }));
          setUploadFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, status: rows.length ? 'done' : 'empty', transactions: rows } : f));
          if (rows.length) setReviewRows(prev => [...prev, ...rows]);
        } catch (e) {
          setUploadFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, status: 'error', error: e.message } : f));
        } finally {
          setPdfLoading(false);
        }
      }
    }
  };

  const toggleRow = (rowId) => setReviewRows(prev => prev.map(r => r.rowId === rowId ? { ...r, included: !r.included } : r));
  const updateCategory = (rowId, cat) => setReviewRows(prev => prev.map(r => r.rowId === rowId ? { ...r, category: cat } : r));

  const handleSave = async () => {
    const toSave = reviewRows.filter(r => r.included);
    if (!toSave.length) return;
    setImporting(true);
    setImportResult(null);
    try {
      const payload = toSave.map(({ rowId, included, ...t }) => t);
      const res = await api.post(`/bank-transactions/${householdId}/import`, {
        transactions: payload,
        creditCardId: card._id,
      });
      setImportResult(res.data);
      setReviewRows(prev => prev.filter(r => !r.included));
      setUploadFiles([]);
      fetchTransactions();
      if (onCardUpdated) onCardUpdated();
    } catch (err) {
      setImportResult({ error: err?.response?.data?.error || 'Import failed.' });
    } finally {
      setImporting(false);
    }
  };

  // ── Filtered data ────────────────────────────────────────────────────────
  const filterSearch = (arr, fields) => {
    if (!search.trim()) return arr;
    const q = search.toLowerCase();
    return arr.filter(r => fields.some(f => (r[f] || '').toString().toLowerCase().includes(q)));
  };

  const filteredTxns = filterSearch(transactions, ['description', 'category', 'date']);
  const filteredPays = filterSearch(payments, ['notes', 'paymentDate']);

  const totalDebits = transactions.filter(t => t.type !== 'credit').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalPaid   = payments.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{card.cardName}</h2>
              <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium">
                {card.holder}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>Balance: <strong className="text-red-600 dark:text-red-400">{fmt(card.currentBalance)}</strong></span>
              {card.interestRate > 0 && <span>APR: {card.interestRate}%</span>}
              {card.dueDay && <span>Due day: {card.dueDay}</span>}
              {card.linkedBankName && <span>Linked bank: {card.linkedBankName}</span>}
              {isSyncedCard && card.accountMask && <span>Account: ••{card.accountMask}</span>}
            </div>
            {/* Progress bar */}
            <div className="mt-2 w-64">
              <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                <span>Payoff progress</span>
                <span>{card.payoffPercent || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-600"
                  style={{ width: `${Math.min(100, card.payoffPercent || 0)}%` }}
                />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none ml-4">×</button>
        </div>

        {/* ── Month selector + search ────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 flex-wrap">
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"
          >
            {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
          <input
            type="text"
            placeholder="Search transactions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[160px] px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-1">
            <TabButton active={tab === 'transactions'} onClick={() => setTab('transactions')}>
              Transactions {transactions.length > 0 && `(${transactions.length})`}
            </TabButton>
            <TabButton active={tab === 'payments'} onClick={() => setTab('payments')}>
              Payments {payments.length > 0 && `(${payments.length})`}
            </TabButton>
            {!isSyncedCard && (
              <TabButton active={tab === 'upload'} onClick={() => setTab('upload')}>
                Upload
              </TabButton>
            )}
          </div>
        </div>

        {/* ── Tab content ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Transactions tab ────────────────────────────────────────── */}
          {tab === 'transactions' && (
            <div>
              {transactions.length > 0 && (
                <div className="flex gap-4 mb-4 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Total charges: <span className="font-semibold text-red-600">{fmt(totalDebits)}</span>
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {filteredTxns.length} of {transactions.length} shown
                  </span>
                </div>
              )}
              {txnLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto" />
                </div>
              ) : filteredTxns.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-3">📂</div>
                  <p className="text-sm">No transactions for {fmtMonth(month)}.</p>
                  <p className="text-xs mt-1 text-gray-400">{isSyncedCard ? 'Transactions sync automatically from Plaid for this account.' : 'Upload a credit card statement on the Upload tab.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Date</th>
                        <th className="px-4 py-2 text-left font-medium">Description</th>
                        <th className="px-4 py-2 text-left font-medium">Category</th>
                        <th className="px-4 py-2 text-right font-medium">Amount</th>
                        <th className="px-4 py-2 text-center font-medium">Type</th>
                        <th className="px-4 py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {filteredTxns.map(txn => (
                        <tr key={txn._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{txn.date}</td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300 max-w-[220px] truncate">{txn.description}</td>
                          <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">{txn.category}</td>
                          <td className={`px-4 py-2 text-right font-semibold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                            {txn.type === 'credit' ? '+' : '-'}{fmt(txn.amount)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${txn.type === 'credit' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                              {txn.type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            {!isSyncedCard && (
                              <button
                                onClick={async () => {
                                  try {
                                    await api.delete(`/bank-transactions/${householdId}/${txn._id}`);
                                    setTransactions(prev => prev.filter(t => t._id !== txn._id));
                                  } catch { /* silent */ }
                                }}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                                title="Remove"
                              >×</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Payments tab ────────────────────────────────────────────── */}
          {tab === 'payments' && (
            <div>
              {!isSyncedCard && (
                <PaymentSuggestionsWidget
                  householdId={householdId}
                  onConfirmed={() => { fetchPayments(); setSuggestionRefresh(r => r + 1); }}
                />
              )}

              {payments.length > 0 && (
                <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  {isSyncedCard ? 'Total credits:' : 'Total paid:'} <span className="font-semibold text-green-600">{fmt(totalPaid)}</span> across {payments.length} {isSyncedCard ? 'credit' : 'payment'}{payments.length !== 1 ? 's' : ''}
                </div>
              )}

              {payLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto" />
                </div>
              ) : filteredPays.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-3">💸</div>
                  <p className="text-sm">{isSyncedCard ? 'No credits or payments found' : 'No payments recorded'} for {fmtMonth(month)}.</p>
                  <p className="text-xs mt-1 text-gray-400">{isSyncedCard ? 'Negative Plaid transactions show up here as payments, credits, or refunds.' : 'Upload a bank statement to auto-detect payments, or add one on the Debt Payments page.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Date</th>
                        <th className="px-4 py-2 text-right font-medium">Amount Paid</th>
                        <th className="px-4 py-2 text-left font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {filteredPays.map(p => (
                        <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{p.paymentDate?.substring(0, 10)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-green-600">{fmt(p.amountPaid)}</td>
                          <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs max-w-[240px] truncate">{p.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Upload tab ──────────────────────────────────────────────── */}
          {!isSyncedCard && tab === 'upload' && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Upload your <strong>{card.cardName}</strong> statement (CSV or PDF). Transactions will be tagged to this card and used in the Finance Report.
              </p>

              {/* Drop zone */}
              <div
                onDrop={e => { e.preventDefault(); handleFilesSelected(e.dataTransfer.files); }}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors mb-4"
              >
                <div className="text-3xl mb-2">📂</div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Drop CSV or PDF here, or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.pdf"
                  multiple
                  className="hidden"
                  onChange={e => { handleFilesSelected(e.target.files); e.target.value = ''; }}
                />
              </div>

              {/* File pills */}
              {uploadFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {uploadFiles.map(f => (
                    <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${f.status === 'processing' ? 'bg-amber-400 animate-pulse' : f.status === 'done' ? 'bg-green-400' : f.status === 'empty' ? 'bg-gray-400' : 'bg-red-400'}`} />
                      <span className="max-w-[140px] truncate">{f.name}</span>
                      {f.status === 'done' && <span className="text-gray-400">· {f.transactions.length} rows</span>}
                    </div>
                  ))}
                  {pdfLoading && (
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

              {/* Review table */}
              {reviewRows.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Review — {reviewRows.filter(r => r.included).length} of {reviewRows.length} selected
                    </p>
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => setReviewRows(prev => prev.map(r => ({ ...r, included: r.type !== 'credit' })))} className="text-indigo-500 hover:underline">Debits</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => setReviewRows(prev => prev.map(r => ({ ...r, included: true })))} className="text-indigo-500 hover:underline">All</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => setReviewRows(prev => prev.map(r => ({ ...r, included: false })))} className="text-gray-400 hover:underline">None</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700 max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 w-8 text-center">
                            <input type="checkbox" className="rounded"
                              checked={reviewRows.every(r => r.included)}
                              onChange={e => setReviewRows(prev => prev.map(r => ({ ...r, included: e.target.checked })))}
                            />
                          </th>
                          <th className="px-3 py-2 text-left font-medium">Date</th>
                          <th className="px-3 py-2 text-left font-medium">Description</th>
                          <th className="px-3 py-2 text-left font-medium">Category</th>
                          <th className="px-3 py-2 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {reviewRows.map(row => (
                          <tr key={row.rowId} className={`${row.included ? '' : 'opacity-40'} hover:bg-gray-50 dark:hover:bg-gray-800/50`}>
                            <td className="px-3 py-1.5 text-center">
                              <input type="checkbox" className="rounded" checked={row.included} onChange={() => toggleRow(row.rowId)} />
                            </td>
                            <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{row.date}</td>
                            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{row.description}</td>
                            <td className="px-3 py-1.5">
                              <select
                                value={row.category}
                                onChange={e => updateCategory(row.rowId, e.target.value)}
                                className="text-xs py-0.5 px-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                              >
                                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                              </select>
                            </td>
                            <td className={`px-3 py-1.5 text-right font-semibold ${row.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                              {row.type === 'credit' ? '+' : '-'}{fmt(row.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Save button */}
                  <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {reviewRows.filter(r => r.included).length} rows selected · {fmt(reviewRows.filter(r => r.included).reduce((s, r) => s + r.amount, 0))} total
                    </p>
                    <button
                      onClick={handleSave}
                      disabled={importing || reviewRows.filter(r => r.included).length === 0}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {importing ? (
                        <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Saving…</>
                      ) : (
                        <>Save {reviewRows.filter(r => r.included).length} transactions</>
                      )}
                    </button>
                  </div>

                  {importResult && (
                    <div className={`mt-2 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${importResult.error ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}>
                      {importResult.error ? (
                        <><span>⚠</span> {importResult.error}</>
                      ) : (
                        <><span>✓</span> Saved {importResult.imported} new · {importResult.duplicates} skipped · {importResult.statementsUpserted > 0 ? `${importResult.statementsUpserted} statement(s) updated` : ''}</>
                      )}
                      <button onClick={() => setImportResult(null)} className="ml-auto text-gray-400 hover:text-gray-600">×</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
