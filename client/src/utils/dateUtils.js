/**
 * Format a month string (YYYY-MM) into a readable month/year display
 * Avoids timezone issues by not using Date object parsing
 * @param {string} monthStr - Month in "YYYY-MM" format (e.g., "2026-02")
 * @param {string} locale - Locale for month name (default: undefined = browser locale)
 * @returns {string} Formatted month name and year (e.g., "February 2026")
 */
export function formatMonth(monthStr, locale = undefined) {
  if (!monthStr || typeof monthStr !== 'string') {
    return 'Unknown';
  }

  const [yearStr, monthNum] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNum, 10) - 1; // JavaScript months are 0-indexed

  // Create a date object on the 1st of each month at noon UTC to avoid timezone shifts
  const date = new Date(year, month, 1, 12, 0, 0, 0);

  // Format using locale
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long'
  });
}

/**
 * Get current month in YYYY-MM format
 * @returns {string} Current month (e.g., "2026-02")
 */
export function getCurrentMonthString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Extract month from a date string (YYYY-MM-DD)
 * @param {string} dateStr - Date in "YYYY-MM-DD" format
 * @returns {string} Month in "YYYY-MM" format
 */
export function extractMonth(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return getCurrentMonthString();
  }
  const [year, month] = dateStr.split('-');
  return `${year}-${month}`;
}
