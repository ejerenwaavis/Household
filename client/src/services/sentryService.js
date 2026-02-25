import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry for error tracking and monitoring
 * Call this early in your application startup
 */
export function initializeSentry(environment = 'production') {
  // Only initialize if DSN is provided and not in development
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!sentryDsn) {
    console.warn('[Sentry] DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    // Sentry DSN from environment variables
    dsn: sentryDsn,
    
    // Environment
    environment: environment || import.meta.env.MODE || 'production',
    
    // Release version (optional - set during build)
    release: import.meta.env.VITE_VERSION || '1.0.0',
    
    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    
    // Replays sample rate
    replaysSessionSampleRate: 0.1,
    
    // Error replay capture rate
    replaysOnErrorSampleRate: 1.0,
    
    // Ignore errors from specific patterns
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'chrome-extension://',
      'moz-extension://',
      
      // Random plugins/extensions
      'Can\'t find variable: ZiteReader',
      'jigsaw is not defined',
      'ComboSearch is not defined',
      
      // Network errors
      'NetworkError',
      'Network request failed',
      
      // Common browser errors
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
    
    // Deny certain error messages
    denyUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
    ],
    
    // Integrations
    integrations: [
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
      new Sentry.CaptureConsole({
        levels: ['error', 'warn'],
      }),
    ],
    
    // Before sending
    beforeSend(event) {
      // Filter out known non-critical errors
      if (event.exception) {
        const error = event.exception.values?.[0];
        if (error?.value?.includes('ResizeObserver')) {
          return null;
        }
      }
      return event;
    },
  });

  console.log('[Sentry] Initialized successfully in', environment, 'environment');
}

/**
 * Capture an error and send to Sentry
 */
export function captureError(error, context = {}) {
  if (window.Sentry) {
    Sentry.captureException(error, {
      contexts: { custom: context },
      level: 'error',
    });
  }
  console.error('[ErrorTracking] Captured error:', error, context);
}

/**
 * Capture a message and send to Sentry
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (window.Sentry) {
    Sentry.captureMessage(message, {
      level,
      contexts: { custom: context },
    });
  }
  console.log(`[ErrorTracking] Captured ${level}:`, message, context);
}

/**
 * Set user context for error tracking
 */
export function setSentryUser(userId, email, username = null) {
  if (window.Sentry) {
    Sentry.setUser({
      id: userId,
      email,
      username: username || email,
    });
  }
}

/**
 * Clear user context
 */
export function clearSentryUser() {
  if (window.Sentry) {
    Sentry.setUser(null);
  }
}

/**
 * Set additional context for debugging
 */
export function setSentryContext(key, context) {
  if (window.Sentry) {
    Sentry.setContext(key, context);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addSentryBreadcrumb(message, category = 'user-action', level = 'info', data = {}) {
  if (window.Sentry) {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  }
}

/**
 * Start a new transaction for performance monitoring
 */
export function startSentryTransaction(name, op = 'http.request') {
  if (window.Sentry) {
    return Sentry.startTransaction({
      name,
      op,
    });
  }
  return null;
}

export default Sentry;
