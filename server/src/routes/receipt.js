/**
 * Receipt Upload & OCR Route
 * Accepts an image upload, runs Tesseract OCR, and returns parsed receipt data.
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { createWorker } from 'tesseract.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Store uploads in memory (no disk write needed — we process and discard)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|bmp|tiff/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext) && allowed.test(file.mimetype.split('/')[1])) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * Parse raw OCR text into structured receipt fields.
 * Looks for common receipt patterns: totals, dates, merchant names.
 */
function parseReceiptText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // ── Amount ────────────────────────────────────────────────────────────────
  // Look for "total", "amount due", "balance due" lines first, then any dollar amount
  let amount = null;
  const totalPatterns = [
    /(?:total|amount\s*due|balance\s*due|grand\s*total|subtotal)[^\d]*\$?\s*(\d+[.,]\d{2})/i,
    /\$\s*(\d+[.,]\d{2})/,
    /(\d+[.,]\d{2})/,
  ];
  for (const pattern of totalPatterns) {
    for (const line of lines) {
      const m = line.match(pattern);
      if (m) {
        amount = parseFloat(m[1].replace(',', '.'));
        break;
      }
    }
    if (amount !== null) break;
  }

  // ── Date ──────────────────────────────────────────────────────────────────
  let date = null;
  const datePatterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}/i,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      date = match[0];
      break;
    }
  }

  // ── Merchant / Description ────────────────────────────────────────────────
  // Usually the first non-empty, non-numeric line is the store name
  const skipPatterns = /^(\d|receipt|invoice|order|#|\$|tel|phone|thank|www|http)/i;
  const merchant = lines.find(l => l.length > 2 && !skipPatterns.test(l)) || '';

  // ── Category guess ────────────────────────────────────────────────────────
  const lowerText = text.toLowerCase();
  let category = 'Other';
  if (/grocery|grocer|supermarket|whole foods|walmart|target|kroger|publix|aldi|trader joe/i.test(lowerText)) category = 'Groceries';
  else if (/restaurant|cafe|coffee|starbucks|mcdonald|burger|pizza|taco|subway|diner|bistro|sushi/i.test(lowerText)) category = 'Dining';
  else if (/gas|fuel|shell|bp |exxon|chevron|marathon|sunoco|speedway/i.test(lowerText)) category = 'Gas';
  else if (/pharmacy|drug|cvs|walgreen|rite aid|medicine|health/i.test(lowerText)) category = 'Medical';
  else if (/amazon|ebay|best buy|costco|shop|store|mall|retail/i.test(lowerText)) category = 'Shopping';
  else if (/uber|lyft|transit|bus|taxi|metro|train|parking/i.test(lowerText)) category = 'Transportation';

  return { amount, date, merchant, category, rawText: text };
}

// POST /api/receipts/scan
router.post('/scan', authMiddleware, upload.single('receipt'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  let worker;
  try {
    worker = await createWorker('eng', 1, {
      logger: () => {}, // suppress progress logs
    });

    const { data: { text } } = await worker.recognize(req.file.buffer);
    await worker.terminate();

    const parsed = parseReceiptText(text);
    res.json(parsed);
  } catch (err) {
    if (worker) {
      try { await worker.terminate(); } catch (_) {}
    }
    next(err);
  }
});

export default router;
