import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const fmtCurrency = (value) => `$${(Number(value) || 0).toFixed(2)}`;
const TRANSACTION_CATEGORIES = ['Groceries', 'Dining', 'Gas', 'Medical', 'Shopping', 'Transportation', 'Subscriptions', 'Utilities', 'Housing', 'Transfer', 'Income', 'Other'];

function fmtSignedTransactionAmount(transaction) {
  const rawAmount = Number(transaction?.amount) || 0;
  const magnitude = Math.abs(rawAmount);
  const isCredit = transaction?.type === 'credit' || (!transaction?.type && rawAmount < 0);
  return `${isCredit ? '+' : '-'}$${magnitude.toFixed(2)}`;
}

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function last12Months() {
  const result = [];
  const today = new Date();
  for (let index = 0; index < 12; index += 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    result.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value = '') {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2);
}

function scoreTextMatch(left = '', right = '') {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (!leftTokens.length || !rightTokens.length) return 0;

  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  return overlap / Math.max(leftTokens.length, rightTokens.length);
}

function getGroupIdentityKey(group) {
  const bankKey = normalizeText(group.bankName) || 'uploaded-bank';
  const accountKey = normalizeText(group.accountName) || 'account';
  const mask = String(group.accountMask || '').slice(-4);
  return `${bankKey}|${mask || accountKey}`;
}

function previewMatch(group, linkedAccounts = [], manualAccounts = []) {
  const mask = String(group.accountMask || '').slice(-4);
  const derivedIdentityKey = getGroupIdentityKey(group);

  let bestLinked = null;
  let linkedScore = 0;
  linkedAccounts.forEach((account) => {
    let score = 0;
    if (mask && String(account.accountMask || '') === mask) score += 10;
    score += scoreTextMatch(group.bankName, account.accountName || '') * 4;
    score += scoreTextMatch(group.accountName, account.accountName || '') * 6;
    score += scoreTextMatch(group.accountName, account.accountOfficialName || '') * 6;
    if (score > linkedScore) {
      bestLinked = account;
      linkedScore = score;
    }
  });

  if (bestLinked && linkedScore >= 6) {
    return {
      type: 'linked',
      label: `${bestLinked.accountName}${bestLinked.accountMask ? ` ••${bestLinked.accountMask}` : ''}`,
    };
  }

  const matchedManual = manualAccounts.find((account) => account.accountIdentityKey === derivedIdentityKey);
  if (matchedManual) {
    return {
      type: 'manual',
      label: `${matchedManual.bankName}${matchedManual.accountMask ? ` ••${matchedManual.accountMask}` : ''}`,
    };
  }

  return {
    type: 'new',
    label: mask ? `New uploaded account ••${mask}` : 'New uploaded account',
  };
}

function mergeParsedFiles(existingGroups, parsedFiles) {
  const next = new Map(existingGroups.map((group) => [group.accountIdentityKey, group]));

  parsedFiles.forEach((fileResult) => {
    const key = fileResult.accountIdentityKey || `${normalizeText(fileResult.bankName)}|${fileResult.accountMask || normalizeText(fileResult.accountName)}`;
    const existing = next.get(key) || {
      accountIdentityKey: key,
      bankName: fileResult.bankName || 'Uploaded Bank',
      accountMask: fileResult.accountMask || '',
      accountName: fileResult.accountName || '',
      sourceFiles: [],
      transactions: [],
    };

    existing.sourceFiles = [...new Set([...existing.sourceFiles, fileResult.filename].filter(Boolean))];
    existing.bankName = existing.bankName || fileResult.bankName || 'Uploaded Bank';
    existing.accountMask = existing.accountMask || fileResult.accountMask || '';
    existing.accountName = existing.accountName || fileResult.accountName || '';

    const newTransactions = (fileResult.transactions || []).map((transaction, index) => ({
      rowId: `${key}-${fileResult.filename}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      date: transaction.date || '',
      description: transaction.description || '',
      amount: Number(transaction.amount) || 0,
      type: transaction.type || 'debit',
      category: transaction.category || 'Other',
      source: transaction.source || fileResult.filename?.split('.').pop()?.toLowerCase() || 'csv',
      sourceDocumentName: fileResult.filename,
      included: true,
    }));

    existing.transactions = [...existing.transactions, ...newTransactions];
    next.set(key, existing);
  });

  return [...next.values()].sort((left, right) => left.bankName.localeCompare(right.bankName));
}

export default function TransactionReviewPage() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [manualAccounts, setManualAccounts] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [savedTransactions, setSavedTransactions] = useState([]);
  const [syncedTransactions, setSyncedTransactions] = useState([]);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [reviewGroups, setReviewGroups] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showUploadTool, setShowUploadTool] = useState(false);
  const [importedEditMode, setImportedEditMode] = useState(false);
  const [importedDrafts, setImportedDrafts] = useState({});
  const [syncedEditMode, setSyncedEditMode] = useState(false);
  const [syncedDrafts, setSyncedDrafts] = useState({});
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const fetchPageData = useCallback(async () => {
    if (!user?.householdId) return;
    setLoading(true);
    setError(null);
    try {
      const householdId = user.householdId;
      const [linkedRes, manualRes, fixedRes, savedRes, syncedRes] = await Promise.all([
        api.get('/plaid/linked-accounts').catch(() => ({ data: { linkedAccounts: [] } })),
        api.get(`/bank-transactions/${householdId}/accounts`).catch(() => ({ data: { accounts: [] } })),
        api.get(`/fixed-expenses/${householdId}`).catch(() => ({ data: { expenses: [] } })),
        api.get(`/bank-transactions/${householdId}?month=${selectedMonth}&limit=500`).catch(() => ({ data: { transactions: [] } })),
        api.get(`/plaid/transactions?month=${selectedMonth}&limit=250`).catch(() => ({ data: { transactions: [] } })),
      ]);

      setLinkedAccounts(linkedRes.data.linkedAccounts || []);
      setManualAccounts(manualRes.data.accounts || []);
      setFixedExpenses(fixedRes.data.expenses || []);
      setSavedTransactions(savedRes.data.transactions || []);
      setSyncedTransactions(syncedRes.data.transactions || []);
    } catch (requestError) {
      console.error('[TransactionReviewPage] fetch error:', requestError);
      setError('Failed to load transaction workspace.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, user?.householdId]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  const reviewedGroupCount = useMemo(
    () => reviewGroups.filter((group) => group.transactions.some((transaction) => transaction.included)).length,
    [reviewGroups]
  );
  const reviewedTransactionCount = useMemo(
    () => reviewGroups.reduce((sum, group) => sum + group.transactions.filter((transaction) => transaction.included).length, 0),
    [reviewGroups]
  );
  const reviewedAmount = useMemo(
    () => reviewGroups.reduce((sum, group) => sum + group.transactions.filter((transaction) => transaction.included).reduce((groupSum, transaction) => groupSum + (Number(transaction.amount) || 0), 0), 0),
    [reviewGroups]
  );

  const decoratedGroups = useMemo(
    () => reviewGroups.map((group) => ({
      ...group,
      matchPreview: previewMatch(group, linkedAccounts, manualAccounts),
    })),
    [linkedAccounts, manualAccounts, reviewGroups]
  );

  const handleFilesSelected = async (files) => {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;

    const pendingEntries = selectedFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      status: 'processing',
      error: null,
    }));

    setUploadFiles((current) => [...current, ...pendingEntries]);
    setImportResult(null);
    setShowUploadTool(true);
    setUploading(true);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append('statements', file));
      const response = await api.post('/statements/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const parsedFiles = response.data.files || [];
      setUploadFiles((current) => current.map((entry) => {
        const result = parsedFiles.find((file) => file.filename === entry.name);
        if (!result) return entry;
        return {
          ...entry,
          status: result.error ? 'error' : result.transactionCount > 0 ? 'done' : 'empty',
          error: result.error || null,
        };
      }));

      const successfulFiles = parsedFiles.filter((file) => !file.error && (file.transactions || []).length > 0);
      if (successfulFiles.length > 0) {
        setReviewGroups((current) => mergeParsedFiles(current, successfulFiles));
        setExpandedGroups((current) => successfulFiles.reduce((next, file) => ({
          ...next,
          [file.accountIdentityKey]: true,
        }), { ...current }));
      }
    } catch (uploadError) {
      console.error('[TransactionReviewPage] upload error:', uploadError);
      setUploadFiles((current) => current.map((entry) => (
        pendingEntries.some((pending) => pending.id === entry.id)
          ? { ...entry, status: 'error', error: uploadError?.response?.data?.error || 'Upload failed' }
          : entry
      )));
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    handleFilesSelected(event.dataTransfer.files);
  };

  const toggleTransaction = (groupKey, rowId) => {
    setReviewGroups((current) => current.map((group) => (
      group.accountIdentityKey !== groupKey
        ? group
        : {
            ...group,
            transactions: group.transactions.map((transaction) => (
              transaction.rowId === rowId
                ? { ...transaction, included: !transaction.included }
                : transaction
            )),
          }
    )));
  };

  const findCandidateInReview = (currentGroups, sourceGroupKey, sourceRow) => {
    const candidates = [];
    const sourceAmount = Number(sourceRow.amount) || 0;
    const sourceDate = sourceRow.date ? new Date(sourceRow.date) : null;

    currentGroups.forEach((group) => {
      group.transactions.forEach((transaction) => {
        if (group.accountIdentityKey === sourceGroupKey && transaction.rowId === sourceRow.rowId) return;
        if (Math.abs(Number(transaction.amount) || 0) !== Math.abs(sourceAmount)) return;
        if (transaction.type === sourceRow.type) return; // require opposite sign
        if (sourceDate && transaction.date) {
          const tDate = new Date(transaction.date);
          const diff = Math.abs(tDate.getTime() - sourceDate.getTime());
          if (diff > 2 * 24 * 60 * 60 * 1000) return; // more than 2 days
        }
        candidates.push({ group, transaction });
      });
    });

    return candidates;
  };

  const handleMarkAsTransfer = async (groupKey, rowId) => {
    const current = reviewGroups;
    const sourceGroup = current.find((g) => g.accountIdentityKey === groupKey);
    if (!sourceGroup) return alert('Source group not found');
    const source = sourceGroup.transactions.find((t) => t.rowId === rowId);
    if (!source) return alert('Transaction not found');

    // find local candidates first
    const candidates = findCandidateInReview(current, groupKey, source);
    if (candidates.length === 1) {
      const match = candidates[0];
      if (!window.confirm(`Link this transaction as transfer with ${match.group.bankName} ••${match.group.accountMask} - ${match.transaction.description || ''}?`)) return;
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      setReviewGroups((prev) => prev.map((g) => {
        if (g.accountIdentityKey === groupKey) {
          return { ...g, transactions: g.transactions.map((t) => t.rowId === rowId ? { ...t, transferId: tempId, transferMeta: { matchedBy: 'manual' } } : t) };
        }
        if (g.accountIdentityKey === match.group.accountIdentityKey) {
          return { ...g, transactions: g.transactions.map((t) => t.rowId === match.transaction.rowId ? { ...t, transferId: tempId, transferMeta: { matchedBy: 'manual' } } : t) };
        }
        return g;
      }));
      return;
    }

    if (candidates.length > 1) {
      const list = candidates.map((c, idx) => `${idx + 1}: ${c.group.bankName} ••${c.group.accountMask} - ${c.transaction.description} (${c.transaction.date}) [id=${c.transaction.rowId}]`).join('\n');
      const pick = window.prompt(`Multiple candidates found:\n${list}\n\nEnter the id (e.g. [id=...]) of the target transaction to link:`);
      if (!pick) return;
      const targetId = pick.replace(/[^[0-9a-zA-Z\-]/g, '');
      // find accepting target
      let found = null;
      for (const c of candidates) {
        if (c.transaction.rowId.includes(targetId) || c.transaction.rowId === targetId) { found = c; break; }
      }
      if (!found) return alert('No matching candidate selected');
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      setReviewGroups((prev) => prev.map((g) => {
        if (g.accountIdentityKey === groupKey) {
          return { ...g, transactions: g.transactions.map((t) => t.rowId === rowId ? { ...t, transferId: tempId, transferMeta: { matchedBy: 'manual' } } : t) };
        }
        if (g.accountIdentityKey === found.group.accountIdentityKey) {
          return { ...g, transactions: g.transactions.map((t) => t.rowId === found.transaction.rowId ? { ...t, transferId: tempId, transferMeta: { matchedBy: 'manual' } } : t) };
        }
        return g;
      }));
      return;
    }

    // no local candidate, offer to ask for external transaction id (for already-saved txns)
    const external = window.prompt('No local candidate found. If linking to an existing saved transaction, paste its DB id here (or cancel):');
    if (!external) return;
    // Attempt server-side linking if user provided an id
    try {
      const targetTransactionId = external.trim();
      const response = await api.post(`/bank-transactions/${user.householdId}/${external.trim()}/link-transfer`, { targetTransactionId });
      if (response.data?.success) {
        alert('Linked successfully (server-side).');
      }
    } catch (err) {
      console.error('link error', err);
      alert('Failed to link on server.');
    }
  };

  const updateTransactionCategory = (groupKey, rowId, category) => {
    setReviewGroups((current) => current.map((group) => (
      group.accountIdentityKey !== groupKey
        ? group
        : {
            ...group,
            transactions: group.transactions.map((transaction) => (
              transaction.rowId === rowId
                ? { ...transaction, category }
                : transaction
            )),
          }
    )));
  };

  const updateGroupDetails = (groupKey, field, value) => {
    setReviewGroups((current) => current.map((group) => (
      group.accountIdentityKey !== groupKey
        ? group
        : {
            ...group,
            [field]: field === 'accountMask' ? String(value || '').replace(/\D/g, '').slice(-4) : value,
          }
    )));
  };

  const removeGroup = (groupKey) => {
    setReviewGroups((current) => current.filter((group) => group.accountIdentityKey !== groupKey));
    setExpandedGroups((current) => {
      const next = { ...current };
      delete next[groupKey];
      return next;
    });
  };

  const downloadReviewJson = () => {
    const payload = decoratedGroups.map((group) => ({
      bankName: group.bankName,
      accountMask: group.accountMask,
      accountName: group.accountName,
      accountIdentityKey: getGroupIdentityKey(group),
      sourceFiles: group.sourceFiles,
      matchPreview: group.matchPreview,
      transactions: {
        debitTransactions: group.transactions.filter((transaction) => transaction.type === 'debit'),
        creditTransactions: group.transactions.filter((transaction) => transaction.type === 'credit'),
      },
    }));

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `transaction-upload-review-${selectedMonth}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!user?.householdId) return;

    const transactionGroups = reviewGroups
      .map((group) => ({
        bankName: group.bankName,
        accountMask: group.accountMask,
        accountName: group.accountName,
        accountIdentityKey: getGroupIdentityKey(group),
        sourceFiles: group.sourceFiles,
        transactions: group.transactions
          .filter((transaction) => transaction.included)
          .map(({ rowId, included, ...rest }) => rest),
      }))
      .filter((group) => group.transactions.length > 0);

    if (!transactionGroups.length) return;

    setImporting(true);
    setImportResult(null);
    try {
      const response = await api.post(`/bank-transactions/${user.householdId}/import`, { transactionGroups });
      setImportResult(response.data);
      setReviewGroups([]);
      setUploadFiles([]);
      await fetchPageData();
    } catch (importError) {
      console.error('[TransactionReviewPage] import error:', importError);
      setImportResult({ error: importError?.response?.data?.error || 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  const upsertImportedDraft = (transaction, patch) => {
    setImportedDrafts((current) => {
      const existing = current[transaction._id] || {
        category: transaction.category || 'Other',
        assignedFixedExpenseId: transaction.assignedFixedExpenseId || '',
        saving: false,
      };

      return {
        ...current,
        [transaction._id]: {
          ...existing,
          ...patch,
        },
      };
    });
  };

  const clearImportedDraft = (transactionId) => {
    setImportedDrafts((current) => {
      const next = { ...current };
      delete next[transactionId];
      return next;
    });
  };

  const upsertSyncedDraft = (transaction, patch) => {
    setSyncedDrafts((current) => {
      const existing = current[transaction._id] || {
        userCategory: transaction.userCategory || transaction.primaryCategory || 'Other',
        saving: false,
      };
      return { ...current, [transaction._id]: { ...existing, ...patch } };
    });
  };

  const clearSyncedDraft = (transactionId) => {
    setSyncedDrafts((current) => {
      const next = { ...current };
      delete next[transactionId];
      return next;
    });
  };

  const saveSyncedTransaction = async (transaction) => {
    if (!user?.householdId) return;
    const draft = syncedDrafts[transaction._id];
    if (!draft) return;

    upsertSyncedDraft(transaction, { saving: true });
    try {
      const response = await api.patch(`/plaid/transactions/${transaction._id}`, {
        userCategory: draft.userCategory,
        isReconciled: true,
      });
      const updated = response.data.transaction;
      setSyncedTransactions((current) =>
        current.map((row) => (row._id === transaction._id ? { ...row, ...updated } : row))
      );
      clearSyncedDraft(transaction._id);
    } catch (saveError) {
      console.error('[TransactionReviewPage] save synced transaction error:', saveError);
      upsertSyncedDraft(transaction, { saving: false });
    }
  };

  const getAssignedExpenseName = (transaction) => {
    const assignedId = String(transaction.assignedFixedExpenseId || '');
    if (!assignedId) return '—';
    const expense = fixedExpenses.find((item) => String(item._id) === assignedId);
    return expense?.name || '—';
  };

  const saveImportedTransaction = async (transaction) => {
    if (!user?.householdId) return;
    const draft = importedDrafts[transaction._id];
    if (!draft) return;

    upsertImportedDraft(transaction, { saving: true });

    try {
      const payload = {
        category: draft.category,
        assignedFixedExpenseId: draft.assignedFixedExpenseId || null,
      };

      const response = await api.patch(`/bank-transactions/${user.householdId}/${transaction._id}`, payload);
      const updated = response.data.transaction;

      setSavedTransactions((current) => current.map((row) => (
        row._id === transaction._id ? { ...row, ...updated } : row
      )));

      clearImportedDraft(transaction._id);
    } catch (saveError) {
      console.error('[TransactionReviewPage] save imported transaction error:', saveError);
      upsertImportedDraft(transaction, { saving: false });
    }
  };

  const createFixedExpenseFromTransaction = async (transaction) => {
    if (!user?.householdId) return null;

    const fallbackName = (transaction.description || 'New Fixed Expense').split(' ').slice(0, 4).join(' ');
    const name = window.prompt('Name for new fixed expense:', fallbackName || 'New Fixed Expense');
    if (!name || !name.trim()) return null;

    const defaultAmount = Math.abs(Number(transaction.amount) || 0).toFixed(2);
    const amountInput = window.prompt('Monthly amount:', defaultAmount);
    if (!amountInput) return null;

    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Please enter a valid amount greater than zero.');
      return null;
    }

    const dueDayInput = window.prompt('Due day (1-31):', '1');
    const parsedDueDay = Number(dueDayInput);
    const dueDay = Number.isFinite(parsedDueDay) && parsedDueDay >= 1 && parsedDueDay <= 31 ? parsedDueDay : 1;

    try {
      const response = await api.post(`/fixed-expenses/${user.householdId}`, {
        name: name.trim(),
        amount,
        group: 'Other',
        frequency: 'monthly',
        dueDay,
        merchantAliases: transaction.description ? [transaction.description] : [],
      });

      const createdExpense = response?.data?.expense;
      if (!createdExpense?._id) return null;

      setFixedExpenses((current) => [...current, createdExpense].sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''))));
      return String(createdExpense._id);
    } catch (creationError) {
      console.error('[TransactionReviewPage] create fixed expense error:', creationError);
      alert(creationError?.response?.data?.error || 'Failed to create fixed expense.');
      return null;
    }
  };

  const handleAssignedExpenseChange = async (transaction, value) => {
    if (value !== '__create_new__') {
      upsertImportedDraft(transaction, { assignedFixedExpenseId: value });
      return;
    }

    const createdExpenseId = await createFixedExpenseFromTransaction(transaction);
    if (createdExpenseId) {
      upsertImportedDraft(transaction, { assignedFixedExpenseId: createdExpenseId });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-10">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-64" />
            <div className="h-24 bg-gray-200 rounded-2xl" />
            <div className="h-96 bg-gray-200 rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Transactions Workspace</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Upload multiple CSV, PDF, or image statements, group them by bank and account, and import only what is not already synced.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            >
              {last12Months().map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
            <button
              onClick={downloadReviewJson}
              disabled={!reviewGroups.length}
              className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
            >
              Download Review JSON
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Upload Statements
            </button>
            <button
              onClick={() => setShowUploadTool((current) => !current)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            >
              {showUploadTool ? 'Hide Upload Tool' : 'Show Upload Tool'}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <p className="text-xs uppercase tracking-wide text-blue-700">Linked Accounts</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{linkedAccounts.length}</p>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
            <p className="text-xs uppercase tracking-wide text-orange-700">Uploaded Accounts</p>
            <p className="text-2xl font-bold text-orange-900 mt-1">{manualAccounts.length}</p>
          </div>
          <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
            <p className="text-xs uppercase tracking-wide text-green-700">Synced This Month</p>
            <p className="text-2xl font-bold text-green-900 mt-1">{syncedTransactions.length}</p>
          </div>
          <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4">
            <p className="text-xs uppercase tracking-wide text-purple-700">Imported This Month</p>
            <p className="text-2xl font-bold text-purple-900 mt-1">{savedTransactions.length}</p>
          </div>
        </div>

        <div className={`rounded-2xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden ${showUploadTool ? '' : 'hidden'}`}>
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Upload Queue</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Select multiple files at once. The platform will group uploaded transactions by detected bank and account before import.
              </p>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Accepted: CSV, PDF, JPG, PNG
            </div>
          </div>

          <div className="p-5">
            <div
              onDrop={handleDrop}
              onDragOver={(event) => event.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 px-6 py-10 text-center hover:border-indigo-400 hover:bg-indigo-50"
            >
              <div className="text-4xl mb-3">📂</div>
              <p className="text-base font-medium text-gray-900">Drop statements here or click to browse</p>
              <p className="text-sm text-gray-500 mt-2">Use one upload for many files. Matching and manual account creation happen during import.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.pdf,.jpg,.jpeg,.png"
                multiple
                className="hidden"
                onChange={(event) => handleFilesSelected(event.target.files)}
              />
            </div>

            {(uploading || uploadFiles.length > 0) && (
              <div className="mt-5 space-y-2">
                {uploadFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                      {file.error && <p className="text-red-600 text-xs mt-1">{file.error}</p>}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      file.status === 'done'
                        ? 'bg-green-100 text-green-700'
                        : file.status === 'error'
                        ? 'bg-red-100 text-red-700'
                        : file.status === 'empty'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {file.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-2xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden ${showUploadTool ? '' : 'hidden'}`}>
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Grouped Review</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Each upload is grouped by detected bank and account before import.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-600 dark:text-gray-400">{reviewedGroupCount} account groups</span>
              <span className="text-gray-600 dark:text-gray-400">{reviewedTransactionCount} selected transactions</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtCurrency(reviewedAmount)}</span>
              <button
                onClick={handleImport}
                disabled={importing || reviewedTransactionCount === 0}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Import Selected'}
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {importResult && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${
                importResult.error
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-green-200 bg-green-50 text-green-700'
              }`}>
                {importResult.error ? importResult.error : (
                  <div className="flex flex-wrap gap-4">
                    <span>Imported: {importResult.imported || 0}</span>
                    <span>Duplicate uploads: {importResult.duplicateBankTransactions || 0}</span>
                    <span>Matched to Plaid: {importResult.duplicatePlaidTransactions || 0}</span>
                    <span>New manual accounts: {importResult.createdManualAccounts || 0}</span>
                  </div>
                )}
              </div>
            )}

            {decoratedGroups.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                Upload one or more statement files to review grouped accounts here.
              </div>
            ) : decoratedGroups.map((group) => {
              const debitCount = group.transactions.filter((transaction) => transaction.type === 'debit').length;
              const creditCount = group.transactions.filter((transaction) => transaction.type === 'credit').length;
              const selectedCount = group.transactions.filter((transaction) => transaction.included).length;
              const selectedAmount = group.transactions.filter((transaction) => transaction.included).reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
              const isExpanded = Boolean(expandedGroups[group.accountIdentityKey]);

              return (
                <div key={group.accountIdentityKey} className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-4 bg-gray-50 dark:bg-gray-900/30 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{group.bankName}</h3>
                        {group.accountMask && (
                          <span className="px-2.5 py-1 rounded-full bg-gray-200 text-gray-700 text-xs font-medium dark:bg-gray-700 dark:text-gray-200">
                            ••{group.accountMask}
                          </span>
                        )}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          group.matchPreview.type === 'linked'
                            ? 'bg-blue-100 text-blue-700'
                            : group.matchPreview.type === 'manual'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {group.matchPreview.type === 'linked' ? 'Matched linked account' : group.matchPreview.type === 'manual' ? 'Matched uploaded account' : 'Will create uploaded account'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{group.matchPreview.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Files: {group.sourceFiles.join(', ')}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span>{debitCount} debits</span>
                      <span>{creditCount} credits</span>
                      <span>{selectedCount} selected</span>
                      <span className="font-semibold">{fmtCurrency(selectedAmount)}</span>
                      <button
                        onClick={() => setExpandedGroups((current) => ({ ...current, [group.accountIdentityKey]: !current[group.accountIdentityKey] }))}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        {isExpanded ? 'Hide rows' : 'Show rows'}
                      </button>
                      <button
                        onClick={() => removeGroup(group.accountIdentityKey)}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div>
                      <div className="grid grid-cols-1 gap-3 px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 md:grid-cols-3">
                        <label className="text-sm">
                          <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Bank name</span>
                          <input
                            type="text"
                            value={group.bankName}
                            onChange={(event) => updateGroupDetails(group.accountIdentityKey, 'bankName', event.target.value)}
                            placeholder="Add bank name"
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Account name</span>
                          <input
                            type="text"
                            value={group.accountName}
                            onChange={(event) => updateGroupDetails(group.accountIdentityKey, 'accountName', event.target.value)}
                            placeholder="Checking, Savings, Credit Card"
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Account mask</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={group.accountMask}
                            onChange={(event) => updateGroupDetails(group.accountIdentityKey, 'accountMask', event.target.value)}
                            placeholder="Last 4 digits"
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                          />
                        </label>
                        <div className="md:col-span-3 text-xs text-gray-500 dark:text-gray-400">
                          Use these fields when the CSV export omits the bank name or account label. The values here are what will be saved on import and used for matching.
                        </div>
                      </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left">Keep</th>
                            <th className="px-4 py-3 text-left">Date</th>
                            <th className="px-4 py-3 text-left">Description</th>
                            <th className="px-4 py-3 text-left">Type</th>
                            <th className="px-4 py-3 text-left">Category</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {group.transactions.map((transaction) => (
                            <tr key={transaction.rowId} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                              <td className="px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={transaction.included}
                                  onChange={() => toggleTransaction(group.accountIdentityKey, transaction.rowId)}
                                />
                              </td>
                              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{transaction.date || '—'}</td>
                              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                                <div className="font-medium">{transaction.description || 'Transaction'}</div>
                                <div className="text-xs text-gray-500">{transaction.sourceDocumentName}</div>
                              </td>
                              <td className="px-4 py-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${transaction.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {transaction.type}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <select
                                  value={transaction.category}
                                  onChange={(event) => updateTransactionCategory(group.accountIdentityKey, transaction.rowId, event.target.value)}
                                  className="px-2 py-1 rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700"
                                >
                                  {TRANSACTION_CATEGORIES.map((category) => (
                                    <option key={category} value={category}>{category}</option>
                                  ))}
                                </select>
                              </td>
                                <td className="px-4 py-2">
                                  <button
                                    onClick={() => handleMarkAsTransfer(group.accountIdentityKey, transaction.rowId)}
                                    className="px-2 py-1 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs"
                                  >
                                    Mark as transfer
                                  </button>
                                </td>
                              <td className={`px-4 py-2 text-right font-semibold ${transaction.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>
                                {fmtSignedTransactionAmount(transaction)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {!showUploadTool && (
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-6 text-sm text-gray-600">
            Upload tool is hidden. Click "Show Upload Tool" to open Upload Queue and Grouped Review.
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Imported Transactions for {selectedMonth}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Manual imports stay separate from Plaid but are matched against linked accounts during import.</p>
            </div>
            <button
              onClick={() => setImportedEditMode((current) => !current)}
              className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
            >
              {importedEditMode ? 'Done Editing' : 'Enable Edit'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/30">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Bank</th>
                  <th className="px-4 py-3 text-left">Account</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Assigned Expense</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {savedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No imported transactions saved for this month yet.
                    </td>
                  </tr>
                ) : savedTransactions.map((transaction) => {
                  const draft = importedDrafts[transaction._id] || null;
                  const isSaving = Boolean(draft?.saving);
                  const hasDraft = Boolean(draft);
                  const draftCategory = draft?.category || transaction.category || 'Other';
                  const draftAssignedExpenseId = draft?.assignedFixedExpenseId ?? (transaction.assignedFixedExpenseId || '');

                  return (
                    <tr key={transaction._id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                      <td className="px-4 py-2">{transaction.date || '—'}</td>
                      <td className="px-4 py-2">{transaction.bank || 'Uploaded Bank'}</td>
                      <td className="px-4 py-2">
                        {transaction.linkedAccount?.accountName || transaction.manualAccount?.accountName || transaction.manualAccount?.bankName || (transaction.accountMask ? `••${transaction.accountMask}` : '—')}
                      </td>
                      <td className="px-4 py-2">{transaction.description}</td>
                      <td className="px-4 py-2">
                        {importedEditMode ? (
                          <select
                            value={draftCategory}
                            onChange={(event) => upsertImportedDraft(transaction, { category: event.target.value })}
                            className="px-2 py-1 rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700"
                          >
                            {TRANSACTION_CATEGORIES.map((category) => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                        ) : (transaction.category || 'Other')}
                      </td>
                      <td className="px-4 py-2">
                        {importedEditMode ? (
                          <select
                            value={draftAssignedExpenseId}
                            onChange={(event) => handleAssignedExpenseChange(transaction, event.target.value)}
                            className="px-2 py-1 rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700"
                          >
                            <option value="">None</option>
                            <option value="__create_new__">+ Create new fixed expense...</option>
                            {fixedExpenses.map((expense) => (
                              <option key={expense._id} value={expense._id}>{expense.name}</option>
                            ))}
                          </select>
                        ) : getAssignedExpenseName(transaction)}
                      </td>
                      <td className="px-4 py-2">
                        {importedEditMode ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveImportedTransaction(transaction)}
                              disabled={!hasDraft || isSaving}
                              className="px-2 py-1 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => clearImportedDraft(transaction._id)}
                              disabled={!hasDraft || isSaving}
                              className="px-2 py-1 rounded border border-gray-300 text-gray-700 text-xs hover:bg-gray-50 disabled:opacity-50"
                            >
                              Reset
                            </button>
                          </div>
                        ) : '—'}
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold ${transaction.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>
                        {fmtSignedTransactionAmount(transaction)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Plaid Synced Transactions for {selectedMonth}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                AI-suggested categories are pre-filled. Review and confirm to mark as reconciled.
              </p>
            </div>
            <button
              onClick={() => setSyncedEditMode((current) => !current)}
              className="px-3 py-1.5 rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 text-sm"
            >
              {syncedEditMode ? 'Done Editing' : 'Review Categories'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/30">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Merchant</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  {syncedEditMode && <th className="px-4 py-3 text-left">Actions</th>}
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {syncedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={syncedEditMode ? 7 : 6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No Plaid synced transactions for this month yet.
                    </td>
                  </tr>
                ) : syncedTransactions.map((transaction) => {
                  const draft = syncedDrafts[transaction._id] || null;
                  const isSaving = Boolean(draft?.saving);
                  const hasDraft = Boolean(draft);
                  const effectiveCategory = draft?.userCategory || transaction.userCategory || transaction.primaryCategory || 'Other';
                  const isReviewed = transaction.isReconciled;
                  const aiSuggestion = transaction.userCategory && !isReviewed ? transaction.userCategory : null;

                  return (
                    <tr key={transaction._id} className={`hover:bg-gray-50 dark:hover:bg-gray-900/20 ${!isReviewed ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''}`}>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{transaction.date ? new Date(transaction.date).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{transaction.merchant || '—'}</td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{transaction.description || transaction.name || '—'}</td>
                      <td className="px-4 py-2">
                        {syncedEditMode ? (
                          <select
                            value={effectiveCategory}
                            onChange={(event) => upsertSyncedDraft(transaction, { userCategory: event.target.value })}
                            className="px-2 py-1 rounded border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 text-sm"
                          >
                            {aiSuggestion && (
                              <option value={aiSuggestion}>✨ {aiSuggestion} (AI suggested)</option>
                            )}
                            {TRANSACTION_CATEGORIES.map((category) => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            {effectiveCategory}
                            {aiSuggestion && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">AI</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {isReviewed ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Reviewed</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending</span>
                        )}
                      </td>
                      {syncedEditMode && (
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveSyncedTransaction(transaction)}
                              disabled={!hasDraft || isSaving}
                              className="px-2 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700 disabled:opacity-50"
                            >
                              {isSaving ? 'Saving...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => clearSyncedDraft(transaction._id)}
                              disabled={!hasDraft || isSaving}
                              className="px-2 py-1 rounded border border-gray-300 text-gray-700 text-xs hover:bg-gray-50 disabled:opacity-50"
                            >
                              Reset
                            </button>
                          </div>
                        </td>
                      )}
                      <td className={`px-4 py-2 text-right font-semibold ${transaction.amount < 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {transaction.amount < 0 ? '+' : '-'}${Math.abs(Number(transaction.amount) || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
