# Google Translate API Setup Guide

## Installation

The translation system is now integrated into your Household app with the following setup:

### Option 1: Using Fallback Translation Service (Default - No Setup Required)

The app includes a **basic fallback translation service** that works immediately without any configuration. It translates common expense and income names:

- Fixed Expenses: "rent" → "alquiler", "car payment" → "pago del auto", etc.
- Income Sources: "salary" → "salario", "freelance" → "freelance", etc.
- Categories: "groceries" → "compras", "utilities" → "servicios", etc.

**This is sufficient for most common use cases and requires zero setup.**

---

### Option 2: Using Google Translate API (For Full Translation Support)

If you want automatic translation of ANY text (not just common keywords), follow these steps:

#### Step 1: Install the Google Translate Package

```bash
cd server
npm install google-translate-api-x
```

#### Step 2: Create a GCP Service Account (Optional for API Key Auth)

If you want to use the official Google Cloud Translation API with authentication:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing one)
3. Enable the "Cloud Translation API"
4. Create a service account with "Cloud Translation API Admin" role
5. Download the key as JSON
6. Save it as `server/credentials.json`

#### Step 3: Update Environment Variables

Create a `.env` file in the server directory:

```env
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
GOOGLE_TRANSLATE_API_KEY=your_api_key_here  # Optional: if using API key instead of service account
```

#### Step 4: Restart the Server

```bash
npm run dev
```

---

## How It Works

### Backend Flow:
1. When a user switches language, the frontend sends `?lang=es` in API requests
2. Backend checks if translation exists in the `Translation` collection (cache)
3. If found, returns cached translation
4. If not found:
   - Tries to use Google Translate API (if installed)
   - Falls back to basic translation dictionary
   - Caches the result for future requests

### Frontend Flow:
1. Language switcher at bottom-left sidebar (🇺🇸 / 🇪🇸)
2. User clicks language, triggers refetch of all data with language parameter
3. Translated names display automatically

---

## What Gets Translated

| Item | Translated Fields |
|------|------------------|
| **Fixed Expenses** | Name, Category |
| **Variable Expenses** | Description, Category |
| **Income** | Source, Contributor Name |

---

## Translation Cache

Translations are automatically cached in the `Translation` MongoDB collection to minimize API calls:

- **Cache duration**: 30 days (auto-expires)
- **Storage**: Each unique translation (e.g., "Car Payment" → "Pago del Auto")
- **Performance**: ~200-500ms for first translation, instant for cached

---

## Cost Estimate

- **Free Tier (Fallback)**: $0 - always available
- **Google Translate API**: ~$0.000015 per character
  - ~1000 unique expenses/income = $0.15-0.30 one-time
  - Recurring: ~$1-2/month for active users

---

## Testing

To test translations:

1. Add a fixed expense named "Car Payment"
2. Switch language to Spanish (🇪🇸)
3. Should display as "Pago del Auto" (or similar translation)
4. Switch back to English (🇺🇸)
5. Should display as "Car Payment"

---

## Troubleshooting

**Translations not showing?**
- Check browser console for errors
- Verify language parameter is being sent: `?lang=es`
- Check server logs: `[translateText]` messages

**Google Translate not working?**
- Ensure `google-translate-api-x` is installed: `npm list google-translate-api-x`
- Check if credentials.json or API key is configured
- Verify "Cloud Translation API" is enabled in GCP console

**Want to add more languages?**
- Update the basic translation dictionary in `translationService.js`
- Update language switcher in `Sidebar.jsx`
- Add new language to switch statement in components

---

## Summary

✅ **Bilingual support is NOW ACTIVE**
- English/Spanish language switcher in sidebar
- Automatic translation of expense/income names
- Free fallback service included
- Optional Google Translate API for more languages

**Next steps:**
1. Test the language switcher
2. Add/edit expenses and check if names translate
3. (Optional) Set up Google Translate API for advanced features
