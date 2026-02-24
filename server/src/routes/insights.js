/**
 * AI Insights Routes
 * Serves household financial insights
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireFeature } from '../middleware/featureGate.js';
import * as AIInsightsService from '../services/aiInsightsService.js';

const router = Router();
router.use(authMiddleware);

// GET /api/insights — Generate/fetch insights for household
router.get('/', async (req, res) => {
  try {
    const insights = await AIInsightsService.generateInsights(req.user.householdId);
    res.json({ insights });
  } catch (err) {
    console.error('[Insights GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/insights/refresh — Force refresh (clears cache)
router.post('/refresh', async (req, res) => {
  try {
    await AIInsightsService.invalidateCache(req.user.householdId);
    const insights = await AIInsightsService.generateInsights(req.user.householdId);
    res.json({ insights });
  } catch (err) {
    console.error('[Insights Refresh]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
