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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net", // May need to adjust for your needs
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' data: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https:",
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
      'usb=()'
    ].join(', ')
  );

  // Strict-Transport-Security - Forces HTTPS connections
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Public-Key-Pins - Optional: Pin SSL certificates (use with caution)
  // Uncomment only if you have certificate pinning strategy

  next();
};

/**
 * CORS configuration with security in mind
 */
export const corsConfig = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      process.env.ADMIN_URL || 'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5000',
      'http://10.221.178.187:5173',
      'http://10.221.178.187:5000',
    ];

    // Allow requests with no origin (mobile apps, Postman, curl requests)
    // In development, also allow any localhost/internal IP origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'development' && origin && /^http:\/\/(localhost|127\.0\.0\.1|10\.)/.test(origin)) {
      // In development, allow all localhost and internal IPs
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
};

/**
 * Request sanitization middleware
 * Removes potentially dangerous characters from inputs
 */
export const sanitizeInput = (req, res, next) => {
  // Simple sanitization - remove script tags and SQL injection attempts
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove script tags and common SQL keywords in suspicious contexts
      return obj
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/(\bOR\b|\bAND\b|\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b)/gi, 
          (match) => /^[0-9]/.test(match) ? match : '') // Keep if part of word
        .trim();
    } else if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        obj[key] = sanitize(obj[key]);
      });
    }
    return obj;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  
  next();
};

/**
 * Helmet-like headers (if helmet package isn't available)
 * Sets multiple security-related HTTP headers
 */
export const basicSecurityHeaders = (req, res, next) => {
  // Prevent browsers from MIME-sniffing a response away from the declared Content-Type
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable the XSS filter built into some browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control how much referrer information is shared
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Prevent browsers from automatically detecting MIME type
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Hide server version
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');

  next();
};

export default {
  securityHeaders,
  corsConfig,
  sanitizeInput,
  basicSecurityHeaders
};
