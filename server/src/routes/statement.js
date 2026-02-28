/**
 * Bank Statement Upload Route
 * Accepts PDF bank statements, runs Tesseract OCR, and returns a list of parsed transactions.
 * CSV files are parsed entirely client-side (PapaParse) — only PDFs go through this route.
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { createWorker } from 'tesseract.js';
import { authMiddleware } from '../middleware/auth.js';
import { createLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Accept images AND PDFs, up to 15 MB each, up to 10 files at once
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedExts.includes(ext) || allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF or image files are accepted for bank statements'));
    }
  },
});

/**
 * Category guesser — same patterns as receipt parser, extended with banking terms.
 */
function guessCategory(description) {
  const t = description.toLowerCase();
  if (/grocery|grocer|supermarket|whole foods|walmart|target|kroger|publix|aldi|trader joe|food lion|sprouts/i.test(t)) return 'Groceries';
  if (/restaurant|cafe|coffee|starbucks|mcdonald|burger|pizza|taco|subway|diner|bistro|sushi|doordash|grubhub|uber eats|postmates/i.test(t)) return 'Dining';
  if (/shell|bp |exxon|chevron|marathon|sunoco|speedway|gas station|fuel/i.test(t)) return 'Gas';
  if (/pharmacy|drug|cvs|walgreen|rite aid|medicine|health|clinic|hospital|doctor|dental/i.test(t)) return 'Medical';
  if (/amazon|ebay|best buy|costco|shop|store|mall|retail|clothing|apparel/i.test(t)) return 'Shopping';
  if (/uber|lyft|transit|bus|taxi|metro|train|parking|toll/i.test(t)) return 'Transportation';
  if (/netflix|spotify|hulu|disney|apple|google|subscription|streaming/i.test(t)) return 'Subscriptions';
  if (/electric|water|gas bill|utility|internet|cable|at&t|verizon|comcast|t-mobile/i.test(t)) return 'Utilities';
  if (/mortgage|rent|hoa|apartment|lease/i.test(t)) return 'Housing';
  if (/transfer|zelle|venmo|paypal|cashapp|payment/i.test(t)) return 'Transfer';
  if (/payroll|direct deposit|salary|deposit|ach credit/i.test(t)) return 'Income';
  return 'Other';
}

/**
 * Parse OCR text from a bank statement into an array of transaction objects.
 * Handles common bank statement formats: date + description + amount on each line.
 */
function parseStatementText(rawText, bankName) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 3);
  const transactions = [];

  // Patterns for a transaction line:
  // Date patterns: MM/DD/YYYY, MM/DD/YY, MM-DD-YYYY, YYYY-MM-DD, "Jan 15"
  const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})/i;
  // Amount patterns: $1,234.56 or -1234.56 or (1,234.56) for debits
  const amountRegex = /[-\(]?\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2}))\)?/;

  for (const line of lines) {
    const dateMatch = line.match(dateRegex);
    const amountMatch = line.match(amountRegex);

    if (!dateMatch || !amountMatch) continue;

    const rawAmount = amountMatch[0];
    const numericAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (!numericAmount || numericAmount < 0.01) continue;

    // Negative or parenthesized = debit/expense, positive = credit/income
    const isDebit = rawAmount.includes('-') || rawAmount.includes('(');

    // Description = everything between the date and amount
    let description = line
      .replace(dateMatch[0], '')
      .replace(amountMatch[0], '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!description) description = 'Transaction';

    transactions.push({
      date: dateMatch[0],
      description,
      amount: numericAmount,
      type: isDebit ? 'debit' : 'credit',
      category: guessCategory(description),
      bank: bankName,
    });
  }

  return transactions;
}

/**
 * POST /api/statements/upload
 * Accepts up to 10 PDF/image files. Returns parsed transactions per file.
 */
router.post('/upload', authMiddleware, createLimiter, upload.array('statements', 10), async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const results = [];

  for (const file of req.files) {
    const bankName = path.basename(file.originalname, path.extname(file.originalname));
    let worker;

    try {
      worker = await createWorker('eng', 1, { logger: () => {} });
      const { data: { text } } = await worker.recognize(file.buffer);
      await worker.terminate();

      const transactions = parseStatementText(text, bankName);

      results.push({
        filename: file.originalname,
        bank: bankName,
        transactionCount: transactions.length,
        transactions,
      });
    } catch (err) {
      if (worker) {
        try { await worker.terminate(); } catch (_) {}
      }
      // Don't fail the whole batch — report this file as errored
      results.push({
        filename: file.originalname,
        bank: bankName,
        transactionCount: 0,
        transactions: [],
        error: 'Failed to process file: ' + err.message,
      });
    }
  }

  res.json({ files: results });
});

export default router;
