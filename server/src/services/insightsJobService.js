/**
 * Nightly Insights Job
 * Tasks 14.1-14.4: Scheduled insights generation with error handling & retries
 */

import cron from 'node-cron';
import Household from '../models/Household.js';
import { generateInsights, invalidateCache } from './aiInsightsService.js';

const MAX_RETRIES = 3;
const BATCH_SIZE = 10;

async function processHousehold(householdId, retries = 0) {
  try {
    await invalidateCache(householdId);
    await generateInsights(householdId);
    console.log(`[InsightsJob] ✓ Generated insights for ${householdId}`);
  } catch (err) {
    if (retries < MAX_RETRIES) {
      console.warn(`[InsightsJob] Retry ${retries + 1}/${MAX_RETRIES} for ${householdId}: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * (retries + 1))); // exponential backoff
      return processHousehold(householdId, retries + 1);
    }
    console.error(`[InsightsJob] ✗ Failed after ${MAX_RETRIES} retries for ${householdId}: ${err.message}`);
  }
}

async function runNightlyJob() {
  console.log('[InsightsJob] Starting nightly insights generation...');
  const startTime = Date.now();

  try {
    const households = await Household.find({}, 'householdId').lean();
    console.log(`[InsightsJob] Processing ${households.length} households`);

    // Process in batches to avoid memory/API rate issues
    for (let i = 0; i < households.length; i += BATCH_SIZE) {
      const batch = households.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(h => processHousehold(h.householdId)));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[InsightsJob] Completed in ${duration}s`);
  } catch (err) {
    console.error('[InsightsJob] Fatal error in nightly job:', err.message);
  }
}

export function initializeInsightsJob() {
  // Run at 2:00 AM every day
  cron.schedule('0 2 * * *', runNightlyJob, {
    timezone: 'America/New_York',
  });

  console.log('[InsightsJob] Nightly insights job scheduled for 2:00 AM ET');
}

// Allow manual trigger for testing
export { runNightlyJob };
