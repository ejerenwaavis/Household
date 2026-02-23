import Translation from '../models/Translation.js';

// Simple translation service using Google Translate API
// For the free tier, we'll use a lightweight npm package that doesn't require authentication
// Install: npm install google-translate-api-x

export async function translateText(text, targetLanguage = 'es', sourceLanguage = 'en') {
  // If target language is same as source, return original
  if (targetLanguage === sourceLanguage || !text) {
    return text;
  }

  try {
    // Check cache first
    const cached = await Translation.findOne({
      text,
      sourceLanguage,
      targetLanguage,
    });

    if (cached) {
      console.log('[translateText] cache hit for:', text);
      return cached.translatedText;
    }

    // If not in cache, use translation service
    // For now, we'll use a simple implementation with fallback
    // You can replace this with actual Google Translate API later
    
    let translatedText = text;

    try {
      // Try to use google-translate-api-x if installed
      const translate = (await import('google-translate-api-x')).default;
      const result = await translate({
        text,
        from: sourceLanguage,
        to: targetLanguage,
      });
      translatedText = result.text;
    } catch (err) {
      console.warn('[translateText] translation service unavailable, falling back to basic translation');
      // Basic fallback if Google Translate not available
      translatedText = await basicTranslation(text, sourceLanguage, targetLanguage);
    }

    // Store in cache
    try {
      await Translation.create({
        text,
        sourceLanguage,
        targetLanguage,
        translatedText,
      });
    } catch (cacheErr) {
      // Cache error is non-critical, just log it
      console.warn('[translateText] cache storage failed:', cacheErr.message);
    }

    return translatedText;
  } catch (err) {
    console.error('[translateText] error:', err);
    // On error, return original text
    return text;
  }
}

// Basic translation fallback with common expense/income names
function basicTranslation(text, sourceLanguage, targetLanguage) {
  if (targetLanguage !== 'es') return text;

  const translations = {
    // Common fixed expenses
    'rent': 'alquiler',
    'mortgage': 'hipoteca',
    'car payment': 'pago del auto',
    'car payments': 'pagos del auto',
    'insurance': 'seguro',
    'electricity': 'electricidad',
    'water': 'agua',
    'internet': 'internet',
    'phone': 'teléfono',
    'gas': 'gas',
    'trash': 'basura',
    'subscription': 'suscripción',
    'streaming': 'streaming',
    'gym': 'gimnasio',
    'daycare': 'guardería',
    'tuition': 'matrícula',
    
    // Common income sources
    'salary': 'salario',
    'freelance': 'freelance',
    'investment': 'inversión',
    'bonus': 'bonificación',
    'side hustle': 'trabajo adicional',
    'commission': 'comisión',
    
    // Common expense categories
    'food': 'comida',
    'groceries': 'compras',
    'dining': 'restaurantes',
    'gas': 'gasolina',
    'transportation': 'transporte',
    'entertainment': 'entretenimiento',
    'shopping': 'compras',
    'medical': 'médico',
    'utilities': 'servicios',
  };

  const lower = text.toLowerCase();
  return translations[lower] || text;
}

export async function translateObject(obj, targetLanguage = 'es', fieldsToTranslate = ['name', 'description', 'source', 'category']) {
  if (!obj || targetLanguage === 'en') {
    return obj;
  }

  const translated = { ...obj };

  for (const field of fieldsToTranslate) {
    if (translated[field] && typeof translated[field] === 'string') {
      translated[`${field}_${targetLanguage}`] = await translateText(translated[field], targetLanguage);
    }
  }

  return translated;
}

export async function cacheTranslation(text, translatedText, targetLanguage = 'es', sourceLanguage = 'en') {
  try {
    await Translation.findOneAndUpdate(
      { text, sourceLanguage, targetLanguage },
      { translatedText },
      { upsert: true }
    );
  } catch (err) {
    console.warn('[cacheTranslation] error:', err.message);
  }
}
