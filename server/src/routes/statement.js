import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { createWorker } from 'tesseract.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.csv'];
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
    ];

    if (allowedExts.includes(ext) || allowedMimes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error('Only CSV, PDF, or image files are accepted for statement uploads'));
  },
});

const KNOWN_BANKS = [
  'bank of america',
  'wells fargo',
  'capital one',
  'american express',
  'amex',
  'chase',
  'citibank',
  'citi',
  'discover',
  'navy federal',
  'truist',
  'pnc',
  'td bank',
  'ally',
  'us bank',
  'regions',
  'fidelity',
  'charles schwab',
  'sofi',
  'paypal',
  'cash app',
];

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCell(value = '') {
  return String(value).replace(/^"|"$/g, '').replace(/""/g, '"').trim();
}

function splitCsvLine(line = '') {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(cleanCell(current));
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(cleanCell(current));
  return cells;
}

function guessCategory(description = '') {
  const text = description.toLowerCase();
  if (/grocery|grocer|supermarket|whole foods|walmart|target|kroger|publix|aldi|trader joe|food lion|sprouts/i.test(text)) return 'Groceries';
  if (/restaurant|cafe|coffee|starbucks|mcdonald|burger|pizza|taco|subway|diner|bistro|sushi|doordash|grubhub|uber eats|postmates/i.test(text)) return 'Dining';
  if (/shell|bp |exxon|chevron|marathon|sunoco|speedway|gas station|fuel/i.test(text)) return 'Gas';
  if (/pharmacy|drug|cvs|walgreen|rite aid|medicine|health|clinic|hospital|doctor|dental/i.test(text)) return 'Medical';
  if (/amazon|ebay|best buy|costco|shop|store|mall|retail|clothing|apparel/i.test(text)) return 'Shopping';
  if (/uber|lyft|transit|bus|taxi|metro|train|parking|toll/i.test(text)) return 'Transportation';
  if (/netflix|spotify|hulu|disney|apple|google|subscription|streaming/i.test(text)) return 'Subscriptions';
  if (/electric|water|gas bill|utility|internet|cable|at&t|verizon|comcast|t mobile|tmobile/i.test(text)) return 'Utilities';
  if (/mortgage|rent|hoa|apartment|lease/i.test(text)) return 'Housing';
  if (/transfer|zelle|venmo|paypal|cashapp|cash app|payment/i.test(text)) return 'Transfer';
  if (/payroll|direct deposit|salary|deposit|ach credit/i.test(text)) return 'Income';
  return 'Other';
}

function inferBankName(rawText = '', filename = '') {
  const haystack = normalizeText(`${rawText}\n${path.basename(filename, path.extname(filename))}`);
  const known = KNOWN_BANKS.find((bank) => haystack.includes(bank));
  if (known) {
    return known
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  const base = path.basename(filename, path.extname(filename)).replace(/[_-]+/g, ' ').trim();
  if (base) return base;

  return 'Uploaded Bank';
}

function extractAccountMask(rawText = '', filename = '') {
  const sources = [rawText, filename];
  const patterns = [
    /(?:account|acct|ending|ends)\s*(?:number|no\.?|#)?\s*[:\-]?\s*(?:x+|\*+)?\s*(\d{4,})/i,
    /(?:\*{2,}|x{2,})\s*(\d{4})/i,
    /(?:account|acct)\s*[:#]?\s*(\d{4})$/im,
  ];

  for (const source of sources) {
    for (const pattern of patterns) {
      const match = String(source || '').match(pattern);
      if (match?.[1]) {
        return match[1].slice(-4);
      }
    }
  }

  const nameDigits = path.basename(filename, path.extname(filename)).match(/(\d{4})(?!.*\d)/);
  return nameDigits?.[1] || '';
}

function extractAccountName(rawText = '', filename = '') {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const accountLine = lines.find((line) => /(checking|savings|credit|business|money market|account)/i.test(line));
  if (accountLine) {
    return accountLine.substring(0, 80);
  }

  return path.basename(filename, path.extname(filename)).replace(/[_-]+/g, ' ').trim();
}

function buildAccountIdentityKey(bankName = '', accountMask = '', accountName = '') {
  const normalizedBank = normalizeText(bankName) || 'uploaded-bank';
  const normalizedAccount = normalizeText(accountName) || 'account';
  const mask = String(accountMask || '').slice(-4);
  return `${normalizedBank}|${mask || normalizedAccount}`;
}

function isDateString(value) {
  const dateCandidate = String(value || '').trim();
  return /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})$/.test(dateCandidate);
}

function parseAmountCell(raw) {
  if (raw == null) return 0;
  const normalized = String(raw).replace(/[,$()\s]/g, '').replace('--', '-');
  const value = parseFloat(normalized);
  return Number.isNaN(value) ? 0 : value;
}

function isSummaryLine(line) {
  const low = line.toLowerCase();
  return /beginning balance|total credits|total debits|ending balance|summary|running balance/i.test(low);
}

function normalizeHeaderValue(value) {
  return String(value || '').toLowerCase().replace(/[\s_]+/g, ' ').trim();
}

function dynamicRowParser(lines) {
  const rows = lines.map(splitCsvLine).filter((cells) => cells.length > 0);
  if (rows.length === 0) return [];

  // Find first row where first column is a valid date
  let start = rows.findIndex((r) => isDateString(r[0]));

  // If the first row is a header row with words, use it
  let headerRow = null;
  if (start === -1 && rows.length > 0) {
    const h = rows[0].map(normalizeHeaderValue);
    if (h.some((c) => /date|desc|amount|debit|credit|transaction/.test(c))) {
      headerRow = h;
      start = 1;
    }
  }

  if (start === -1) {
    // Fallback: try to find any row with date in any col
    start = rows.findIndex((r) => r.some((cell) => isDateString(cell)));
  }

  if (start === -1) return [];

  const sampleRow = rows[start];
  let dateCol = 0;
  let descCol = 1;
  let amountCol = 2;
  let runningBalanceCol = -1;

  if (headerRow) {
    headerRow.forEach((col, idx) => {
      if (/date|transaction date|post date|trans date/.test(col)) dateCol = idx;
      else if (/description|memo|details|payee/.test(col)) descCol = idx;
      else if (/amount|trans amount|transaction amount/.test(col)) amountCol = idx;
      else if (/running balance|balance/.test(col)) runningBalanceCol = idx;
    });
  } else if (sampleRow.length >= 4) {
    // handle BOA style: date, description, amount, running balance
    if (isDateString(sampleRow[0]) && !isNaN(parseAmountCell(sampleRow[2]))) {
      dateCol = 0;
      descCol = 1;
      amountCol = 2;
      runningBalanceCol = 3;
    }

    // handle Wells Fargo style: date, amount, *, *, description
    if (isDateString(sampleRow[0]) && !isNaN(parseAmountCell(sampleRow[1])) && sampleRow.length >= 5) {
      dateCol = 0;
      amountCol = 1;
      descCol = 4;
    }
  }

  const txs = [];
  for (let i = start; i < rows.length; i += 1) {
    const cells = rows[i];
    if (cells.length < 2) continue;
    if (isSummaryLine(cells.join(' '))) continue;

    let date = cells[dateCol] || '';
    let description = (cells[descCol] || '') || '';
    let amount = 0;

    // amount may be in a single column or separate debit/credit columns
    if (amountCol >= 0 && amountCol < cells.length) {
      amount = parseAmountCell(cells[amountCol]);
    } else {
      const debitCell = cells.find((cell) => /debit/i.test(cell));
      const creditCell = cells.find((cell) => /credit/i.test(cell));
      if (debitCell || creditCell) {
        amount = parseAmountCell(creditCell || 0) - parseAmountCell(debitCell || 0);
      }
    }

    if (!date || !isDateString(date)) {
      // try to find date in row
      const dateCandidate = cells.find((c) => isDateString(c));
      if (dateCandidate) date = dateCandidate;
      else continue;
    }

    if (typeof amount !== 'number' || Number.isNaN(amount)) continue;

    txs.push({
      date,
      description: description.trim(),
      amount: Math.abs(amount),
      type: amount < 0 ? 'debit' : 'credit',
      runningBalance: runningBalanceCol >= 0 && runningBalanceCol < cells.length ? cells[runningBalanceCol] : '',
    });
  }

  return txs;
}

function parseCsvText(rawText, fileName) {
  const lines = String(rawText || '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  const goodLines = lines.filter((line) => !isSummaryLine(line));
  const bankName = inferBankName(rawText, fileName);
  const accountMask = extractAccountMask(rawText, fileName);
  const accountName = extractAccountName(rawText, fileName);

  const transactions = dynamicRowParser(goodLines);

  return {
    filename: fileName,
    bankName,
    accountMask,
    accountName,
    accountIdentityKey: buildAccountIdentityKey(bankName, accountMask, accountName),
    transactionCount: transactions.length,
    transactions,
  };
}

function parseStatementText(rawText, fileName) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const transactionLines = lines.filter((line) => !isSummaryLine(line));

  const bankName = inferBankName(rawText, fileName);
  const accountMask = extractAccountMask(rawText, fileName);
  const accountName = extractAccountName(rawText, fileName);

  const transactions = dynamicRowParser(transactionLines);

  return {
    filename: fileName,
    bankName,
    accountMask,
    accountName,
    accountIdentityKey: buildAccountIdentityKey(bankName, accountMask, accountName),
    transactionCount: transactions.length,
    transactions,
  };
}

async function parseUploadedFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.csv' || file.mimetype === 'text/csv' || file.mimetype === 'application/csv' || file.mimetype === 'application/vnd.ms-excel') {
    return parseCsvText(file.buffer.toString('utf8'), file.originalname);
  }

  let worker;
  try {
    worker = await createWorker('eng', 1, { logger: () => {} });
    const { data: { text } } = await worker.recognize(file.buffer);
    return parseStatementText(text, file.originalname);
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
      }
    }
  }
}

router.post('/upload', authMiddleware, uploadLimiter, upload.array('statements', 20), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    for (const file of req.files) {
      try {
        results.push(await parseUploadedFile(file));
      } catch (error) {
        results.push({
          filename: file.originalname,
          bankName: inferBankName('', file.originalname),
          accountMask: extractAccountMask('', file.originalname),
          accountName: extractAccountName('', file.originalname),
          accountIdentityKey: buildAccountIdentityKey(inferBankName('', file.originalname), extractAccountMask('', file.originalname), extractAccountName('', file.originalname)),
          transactionCount: 0,
          transactions: [],
          error: `Failed to process file: ${error.message}`,
        });
      }
    }

    res.json({ files: results });
  } catch (error) {
    next(error);
  }
});

router.post('/parse-pdf', authMiddleware, uploadLimiter, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const parsed = await parseUploadedFile(req.file);
    res.json(parsed);
  } catch (error) {
    next(error);
  }
});

export default router;
