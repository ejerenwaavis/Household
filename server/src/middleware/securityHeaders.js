/**
 * Security Headers Middleware
 * Sets essential security headers to protect against common web vulnerabilities
 */

/**
 * Apply security headers to all responses
 */
export const securityHeaders = (req, res, next) => {
  // Content Security Policy - Prevents XSS attacks
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdn.sentry.io",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' data: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );

  // X-Content-Type-Options - Prevents MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options - Prevents clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection - Enables XSS protection in older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy - Controls what referrer information is shared
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy - Controls browser features and APIs
  res.setHeader(
    'Permissions-Policy',
    [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'usb=()',
      'picture-in-picture=()',
      'sync-xhr=()'
    ].join(', ')
  );

  // Strict-Transport-Security - Forces HTTPS connections
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Remove sensitive headers
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');

  next();
};

/**
 * Enhanced CORS configuration with comprehensive security
 */
export const corsConfig = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      process.env.ADMIN_URL || 'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5000',
      'http://10.221.178.187:5173',
      'http://10.221.178.187:5000',
    ];

    // Add production origins if configured
    if (process.env.PRODUCTION_ORIGINS) {
      const prodOrigins = process.env.PRODUCTION_ORIGINS.split(',').map(o => o.trim());
      allowedOrigins.push(...prodOrigins);
    }

    // Allow requests with no origin (mobile apps, Postman, curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'development' && /^http:\/\/(localhost|127\.0\.0\.1|10\.)/.test(origin)) {
      // In development, allow all localhost and internal IPs
      callback(null, true);
    } else {
      console.warn('[CORS] Rejected request from origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'Accept',
    'Accept-Encoding',
    'Accept-Language'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Number',
    'X-Page-Size',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset'
  ],
  maxAge: 86400 // 24 hours
};

/**
 * Request sanitization middleware
 * Removes potentially dangerous characters from inputs
 */
export const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove script tags
      let cleaned = obj.replace(/<script[^>]*>.*?<\/script>/gi, '');
      
      // Remove potential NoSQL injection attempts
      cleaned = cleaned.replace(/[\$\{\}]/g, '');
      
      return cleaned.trim();
    } else if (Array.isArray(obj)) {
      return obj.map(item => sanitize(item));
    } else if (typeof obj === 'object' && obj !== null) {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  
  next();
};

/**
 * Security headers specific to API responses
 */
export const apiSecurityHeaders = (req, res, next) => {
  // Prevent caching of sensitive API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Prevent browsers from executing content as HTML
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  next();
};

/**
 * Origin tracking middleware for security logging
 */
export const trackOrigin = (req, res, next) => {
  const origin = req.headers.origin || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  // Log suspicious origins only in production
  if (process.env.NODE_ENV === 'production') {
    if (origin !== 'unknown' && !process.env.FRONTEND_URL?.includes(new URL(origin).hostname)) {
      console.warn('[Security] Request from external origin:', {
        origin,
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString(),
        ip: req.ip
      });
    }
  }
  
  next();
};

export default {
  securityHeaders,
  corsConfig,
  sanitizeInput,
  apiSecurityHeaders,
  trackOrigin
};
