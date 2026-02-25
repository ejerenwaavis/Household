/**
 * Error Logging Service
 * Captures and logs errors for monitoring and debugging
 * Extensible for Sentry integration
 */

// Generate unique error ID
const generateErrorId = () => {
  return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Store errors in memory (production: send to Sentry/server)
const errorLog = [];
const MAX_ERRORS_IN_MEMORY = 50;

/**
 * Log an error with context
 * @param {Error} error - The error object
 * @param {Object} context - Additional context (componentStack, userAction, etc)
 * @returns {string} - Error ID for reference
 */
export const logError = (error, context = {}) => {
  const errorId = generateErrorId();
  
  const errorEntry = {
    id: errorId,
    message: error?.message || 'Unknown error',
    stack: error?.stack || '',
    type: error?.name || 'Error',
    timestamp: new Date().toISOString(),
    context: {
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...context
    },
    user: {
      id: localStorage.getItem('userId') || 'anonymous',
      household: localStorage.getItem('householdId') || 'unknown'
    }
  };

  // Store locally
  errorLog.unshift(errorEntry);
  if (errorLog.length > MAX_ERRORS_IN_MEMORY) {
    errorLog.pop();
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${errorId}]`, error, context);
  }

  // TODO: Send to Sentry for production
  // if (process.env.NODE_ENV === 'production') {
  //   Sentry.captureException(error, { tags: { errorId }, extra: context });
  // }

  // TODO: Send to backend for analytics
  // sendErrorToBackend(errorEntry).catch(err => 
  //   console.error('Failed to send error to backend:', err)
  // );

  return errorId;
};

/**
 * Log API errors
 * @param {Error} error - The error from API call
 * @param {Object} requestContext - API call details (endpoint, method, status, etc)
 */
export const logApiError = (error, requestContext = {}) => {
  return logError(error, {
    type: 'API_ERROR',
    ...requestContext
  });
};

/**
 * Log validation errors
 * @param {Object} errors - Validation errors object
 * @param {string} formName - Name of the form
 */
export const logValidationError = (errors, formName) => {
  const error = new Error(`Validation failed for ${formName}`);
  return logError(error, {
    type: 'VALIDATION_ERROR',
    formName,
    errors
  });
};

/**
 * Get errors from memory (for debugging)
 * @returns {Array} - Array of error entries
 */
export const getErrorLog = () => {
  return [...errorLog];
};

/**
 * Clear error log
 */
export const clearErrorLog = () => {
  errorLog.length = 0;
};

/**
 * Send error to backend for analytics (optional)
 * Implement when backend endpoint is ready
 */
export const sendErrorToBackend = async (errorEntry) => {
  try {
    // Example implementation:
    // await axios.post('/api/errors', errorEntry, {
    //   timeout: 5000
    // });
    console.debug('Error logged:', errorEntry.id);
  } catch (err) {
    console.error('Failed to send error to backend:', err);
    // Fail silently - don't create recursive error loops
  }
};

export default {
  logError,
  logApiError,
  logValidationError,
  getErrorLog,
  clearErrorLog,
  sendErrorToBackend
};
