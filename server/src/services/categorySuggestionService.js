/**
 * Category Suggestion Algorithm
 * Analyzes transaction details to suggest appropriate categories
 */

import mongoose from 'mongoose';
import PlaidTransaction from '../models/PlaidTransaction.js';
import logger from '../utils/logger.js';

const CATEGORY_KEYWORDS = {
  'Groceries': [
    'trader joe', 'whole foods', 'safeway', 'kroger', 'walmart', 'target',
    'grocery', 'supermarket', 'market', 'food store', 'foodland', 'publix',
    'instacart', 'amazon fresh', 'peapod', 'fresh direct'
  ],
  'Gas': [
    'shell', 'exxon', 'chevron', 'bp', 'mobil', 'texaco', 'sunoco',
    'citgo', 'speedway', 'loves', 'pilot', 'gas station', 'fuel',
    'petrol', 'pump', 'gas&shop', 'circle k'
  ],
  'Dining Out': [
    'restaurant', 'cafe', 'coffee', 'burger', 'pizza', 'chinese', 'thai',
    'sushi', 'grill', 'bbq', 'steakhouse', 'diner', 'bistro', 'bar & grill',
    'pub', 'tavern', 'doordash', 'uber eats', 'grubhub', 'postmates',
    'delivery', 'mcdonalds', 'subway', 'chipotle', 'taco bell'
  ],
  'Medical': [
    'pharmacy', 'doctor', 'hospital', 'clinic', 'dental', 'dentist',
    'cvs', 'walgreens', 'rite aid', 'medicine', 'medical', 'health',
    'veterinary', 'vet', 'urgent care', 'emergency', 'surgeon'
  ],
  'Entertainment': [
    'movie', 'cinema', 'theater', 'netflix', 'hulu', 'disney', 'spotify',
    'concert', 'ticket', 'show', 'game', 'steam', 'playstation', 'xbox',
    'amusement', 'theme park', 'zoo', 'museum', 'entertainment'
  ],
  'Shopping': [
    'amazon', 'ebay', 'mall', 'shop', 'store', 'outlet', 'boutique',
    'retail', 'best buy', 'apple store', 'gap', 'h&m', 'forever 21',
    'zara', 'clothing', 'apparel', 'fashion'
  ],
  'Gas': [
    'electric company', 'water department', 'gas utility', 'power',
    'utility', 'eversource', 'con edison', 'pg&e'
  ],
  'Transportation': [
    'uber', 'lyft', 'taxi', 'public transport', 'metro', 'bus',
    'parking', 'toll', 'car wash', 'auto', 'mechanic', 'repair',
    'tire', 'oil change', 'rental', 'hertz', 'avis'
  ],
  'Travel': [
    'airline', 'flight', 'hotel', 'airbnb', 'booking', 'kayak',
    'expedia', 'airport', 'resort', 'travel', 'luggage'
  ],
  'Business Services': [
    'office', 'software', 'subscription', 'saas', 'zoom', 'slack',
    'adobe', 'microsoft', 'google workspace', 'dropbox', 'aws', 'azure'
  ],
  'Personal': [
    'salon', 'barber', 'spa', 'gym', 'fitness', 'hair', 'beauty',
    'personal care', 'grooming'
  ]
};

/**
 * Calculate matching keywords for a transaction
 */
function calculateKeywordMatches(name, merchant, description = '') {
  const text = `${name} ${merchant} ${description}`.toLowerCase();
  const matches = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let matchCount = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      matches[category] = matchCount;
    }
  }

  return matches;
}

/**
 * Analyze historical transactions in a category
 */
async function analyzeTransactionPatterns(householdId, category, limit = 20) {
  try {
    const transactions = await PlaidTransaction.find({
      householdId,
      userCategory: category
    })
      .limit(limit)
      .lean();

    const patterns = {
      commonMerchants: {},
      commonWords: {},
      averageAmount: 0,
      transactionCount: transactions.length
    };

    let totalAmount = 0;

    for (const txn of transactions) {
      totalAmount += Math.abs(txn.amount);

      // Analyze merchant
      if (txn.merchant) {
        patterns.commonMerchants[txn.merchant] = (patterns.commonMerchants[txn.merchant] || 0) + 1;
      }

      // Extract words from transaction name
      const words = txn.name.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 3) { // Only consider words > 3 characters
          patterns.commonWords[word] = (patterns.commonWords[word] || 0) + 1;
        }
      }
    }

    patterns.averageAmount = transactions.length > 0 ? totalAmount / transactions.length : 0;

    return patterns;
  } catch (error) {
    logger.error('[CategorySuggestion] Error analyzing patterns:', error);
    return null;
  }
}

/**
 * Suggest category for a transaction
 * Returns array of suggestions with confidence scores
 */
export async function suggestCategory(transaction, householdId) {
  try {
    const { name, merchant_name: merchant, description, amount, personal_finance_category } = transaction;

    // Start with Plaid's own categorization if available
    const suggestions = [];

    if (personal_finance_category?.primary) {
      suggestions.push({
        category: personal_finance_category.primary,
        confidence: 0.8,
        source: 'plaid'
      });
    }

    // Calculate keyword matches
    const keywordMatches = calculateKeywordMatches(name, merchant, description);

    // Add keyword-based suggestions
    const sortedMatches = Object.entries(keywordMatches)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // Top 3 matches

    for (const [category, matchCount] of sortedMatches) {
      const confidence = Math.min(0.5 + (matchCount * 0.1), 0.95);
      suggestions.push({
        category,
        confidence,
        source: 'keyword_matching',
        matchCount
      });
    }

    // Analyze amount patterns (if similar amounts suggest same category)
    const amountThreshold = Math.abs(amount) * 0.2; // ±20% variance
    const similarTransactions = await PlaidTransaction.find({
      householdId,
      amount: {
        $gte: amount - amountThreshold,
        $lte: amount + amountThreshold
      },
      userCategory: { $exists: true, $ne: null }
    })
      .limit(10)
      .lean();

    if (similarTransactions.length > 0) {
      const categoryCounts = {};
      for (const txn of similarTransactions) {
        categoryCounts[txn.userCategory] = (categoryCounts[txn.userCategory] || 0) + 1;
      }

      const topCategory = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])[0];

      if (topCategory) {
        const confidence = Math.min((topCategory[1] / similarTransactions.length) * 0.7, 0.85);
        suggestions.push({
          category: topCategory[0],
          confidence,
          source: 'amount_pattern',
          similarTransactionCount: topCategory[1]
        });
      }
    }

    // Sort by confidence and deduplicate
    const uniqueSuggestions = {};
    for (const suggestion of suggestions) {
      if (!uniqueSuggestions[suggestion.category] || suggestion.confidence > uniqueSuggestions[suggestion.category].confidence) {
        uniqueSuggestions[suggestion.category] = suggestion;
      }
    }

    const finalSuggestions = Object.values(uniqueSuggestions)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Top 5 suggestions

    logger.info('[CategorySuggestion] Generated suggestions:', {
      transactionName: name,
      suggestionsCount: finalSuggestions.length,
      topSuggestion: finalSuggestions[0]?.category,
      topConfidence: finalSuggestions[0]?.confidence
    });

    return finalSuggestions;
  } catch (error) {
    logger.error('[CategorySuggestion] Error suggesting category:', error);
    return [];
  }
}

/**
 * Batch suggest categories for multiple transactions
 */
export async function suggestCategoriesBatch(transactions, householdId) {
  try {
    const suggestions = {};

    for (const txn of transactions) {
      suggestions[txn.transaction_id] = await suggestCategory(txn, householdId);
    }

    return suggestions;
  } catch (error) {
    logger.error('[CategorySuggestion] Error batch suggesting categories:', error);
    return {};
  }
}

/**
 * Get category analysis for user insights
 */
export async function getCategoryAnalysis(householdId, months = 3) {
  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Aggregate transactions by category
    const analysis = await PlaidTransaction.aggregate([
      {
        $match: {
          householdId: new mongoose.Types.ObjectId(householdId),
          date: { $gte: startDate, $lte: endDate },
          userCategory: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$userCategory',
          count: { $sum: 1 },
          totalAmount: { $sum: { $abs: '$amount' } },
          avgAmount: { $avg: { $abs: '$amount' } },
          minAmount: { $min: { $abs: '$amount' } },
          maxAmount: { $max: { $abs: '$amount' } }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    return analysis;
  } catch (error) {
    logger.error('[CategorySuggestion] Error analyzing categories:', error);
    return [];
  }
}

/**
 * Export suggestions via API endpoint
 * Called when syncing new transactions
 */
export async function storeTransactionWithSuggestions(plaidTransaction, linkedAccount) {
  try {
    const { householdId, plaidAccessToken, plaidAccountId } = linkedAccount;

    // Suggest categories
    const suggestions = await suggestCategory(plaidTransaction, householdId);

    // Store transaction with top suggestion
    const topSuggestion = suggestions[0];

    const transaction = await PlaidTransaction.create({
      householdId,
      userId: linkedAccount.userId,
      linkedAccountId: linkedAccount._id,
      plaidTransactionId: plaidTransaction.transaction_id,
      plaidAccountId,
      
      // Transaction details
      date: new Date(plaidTransaction.date),
      amount: plaidTransaction.amount,
      name: plaidTransaction.name,
      merchant: plaidTransaction.merchant_name,
      description: plaidTransaction.merchant_name || plaidTransaction.name,
      isPending: plaidTransaction.pending,
      paymentMethod: plaidTransaction.payment_method,
      
      // Categories
      primaryCategory: plaidTransaction.personal_finance_category?.primary,
      detailedCategory: plaidTransaction.personal_finance_category?.detailed,
      userCategory: topSuggestion?.category, // Auto-set top suggestion
      
      // Status
      syncedAt: new Date(),
      isReconciled: false,
      categoryConfidence: topSuggestion?.confidence
    });

    return transaction;
  } catch (error) {
    logger.error('[CategorySuggestion] Error storing transaction with suggestions:', error);
    throw error;
  }
}

export default {
  suggestCategory,
  suggestCategoriesBatch,
  getCategoryAnalysis,
  storeTransactionWithSuggestions,
  analyzeTransactionPatterns
};
