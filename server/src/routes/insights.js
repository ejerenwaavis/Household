/**
 * AI Insights Routes
 * Serves household financial insights
 */

import { Router } from 'express';
import { authMiddleware, resolveActiveHouseholdId } from '../middleware/auth.js';
import { requireFeature } from '../middleware/featureGate.js';
import * as AIInsightsService from '../services/aiInsightsService.js';

const router = Router();
router.use(authMiddleware);

// GET /api/insights — Generate/fetch insights for household
router.get('/', async (req, res) => {
  try {
    const householdId = resolveActiveHouseholdId(req);
    const insights = await AIInsightsService.generateInsights(householdId);
    res.json({
      insights,
      generatedAt: insights.generatedAt,
      aiEnabled: insights.aiEnabled,
    });
  } catch (err) {
    console.error('[Insights GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/insights/refresh — Force refresh (clears cache)
router.post('/refresh', async (req, res) => {
  try {
    const householdId = resolveActiveHouseholdId(req);
    await AIInsightsService.invalidateCache(householdId);
    const insights = await AIInsightsService.generateInsights(householdId);
    res.json({
      insights,
      generatedAt: insights.generatedAt,
      aiEnabled: insights.aiEnabled,
    });
  } catch (err) {
    console.error('[Insights Refresh]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
