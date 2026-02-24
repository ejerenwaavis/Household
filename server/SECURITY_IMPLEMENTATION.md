/**
 * Backend Integration Guide
 * Document showing how to integrate security features into the main app.js
 */

// ============================================================
// STEP 1: Install required packages
// ============================================================
/*
npm install express-rate-limit helmet swagger-ui-express swagger-jsdoc
*/

// ============================================================
// STEP 2: Update index.js to include security middleware
// ============================================================

/*
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

// Import security middleware
import { 
  generalLimiter, 
  authLimiter, 
  createLimiter, 
  passwordResetLimiter 
} from './middleware/rateLimiter.js';
import { 
  securityHeaders, 
  corsConfig, 
  sanitizeInput 
} from './middleware/securityHeaders.js';
import swaggerConfig from './config/swagger.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// Security Middleware Stack
// ============================================================

// 1. Security headers
app.use(securityHeaders);

// 2. Helmet - comprehensive security headers (alternative to manual headers)
// app.use(helmet({ contentSecurityPolicy: false })); // Uncomment if preferring helmet

// 3. CORS with security config
app.use(cors(corsConfig));

// 4. Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 5. Input sanitization
app.use(sanitizeInput);

// 6. General rate limiting for all routes
app.use(generalLimiter);

// ============================================================
// Swagger/OpenAPI Documentation
// ============================================================

const specs = swaggerJsdoc(swaggerConfig);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Household Finance API'
}));

// ============================================================
// Database Connection
// ============================================================

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/household')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  });

// ============================================================
// Public Routes (Health check, not rate limited for critical monitoring)
// ============================================================

app.get('/health', (req, res) => {
  res.json({ status: 'Server running', timestamp: new Date().toISOString() });
});

// ============================================================
// Auth Routes (strict rate limiting)
// ============================================================

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', generalLimiter); // Slightly less strict than login
app.use('/api/auth/password-reset', passwordResetLimiter);

// Import routes
import authRouter from './routes/auth.js';
import householdRouter from './routes/household.js';
// ... other route imports ...

// ============================================================
// API Routes (with appropriate rate limiting)
// ============================================================

// Auth routes
app.use('/api/auth', authRouter);

// Household routes - moderate limiting
app.use('/api/households', generalLimiter, householdRouter);

// CRUD operations - moderate limiting
app.use('/api/income', createLimiter, incomeRouter);
app.use('/api/expenses', createLimiter, expenseRouter);
app.use('/api/goals', createLimiter, goalRouter);
app.use('/api/credit-cards', createLimiter, creditCardRouter);
// ... other routes with appropriate limiters ...

// ============================================================
// Error Handler (with security in mind)
// ============================================================

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Don't leak sensitive information in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error'
    : err.message;
  
  res.status(err.status || 500).json({ 
    error: message,
    // Only include stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================================
// 404 Handler
// ============================================================

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============================================================
// Start Server
// ============================================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
});

export default app;
*/

// ============================================================
// ENVIRONMENT VARIABLES REQUIRED
// ============================================================

/*

# .env file should contain:

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ADMIN_URL=http://localhost:3000
API_URL=http://localhost:5000/api
API_HOST=localhost:5000
SUPPORT_EMAIL=support@household-finance.app

# Database
MONGO_URI=mongodb://localhost:27017/household

# JWT (for token management)
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
JWT_EXPIRY=1h
JWT_REFRESH_EXPIRY=7d

# Security
BCRYPT_ROUNDS=10
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Optional: Third-party services
SENTRY_DSN=
PLAID_CLIENT_ID=
PLAID_SECRET=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
OPENAI_API_KEY=

*/

// ============================================================
// RATE LIMITING STRATEGY
// ============================================================

/*

Endpoint Rate Limiting Guide:

GENERAL (100 requests/15 min):
- GET /api/households
- GET /api/expenses
- GET /api/income
- GET /api/credit-cards
- GET /api/goals
- DELETE operations

AUTH STRICT (5 requests/15 min):
- POST /api/auth/login
- POST /api/auth/register
- POST /api/auth/password-reset

CREATE/UPDATE (30 requests/15 min):
- POST /api/expenses
- PUT /api/expenses/:id
- POST /api/income
- POST /api/goals
- POST /api/credit-cards

SENSITIVE (10 requests/hour):
- POST /api/dev/seed-all (development only)
- POST /api/dev/clear-db (development only)
- DELETE /api/households/:id

*/

// ============================================================
// SECURITY HEADERS EXPLAINED
// ============================================================

/*

1. Content-Security-Policy (CSP)
   - Prevents XSS attacks by controlling which resources can be loaded
   - Restrict to 'self' for production

2. X-Content-Type-Options: nosniff
   - Prevents MIME type sniffing
   - Browser must respect Content-Type header

3. X-Frame-Options: DENY
   - Prevents clickjacking attacks
   - Prevents page from being loaded in iframe

4. X-XSS-Protection
   - Enables XSS filter in older browsers
   - 1; mode=block stops rendering if attack detected

5. Referrer-Policy
   - Controls referrer information sent with requests
   - strict-origin-when-cross-origin for balance between privacy and usability

6. Strict-Transport-Security (HSTS)
   - Forces HTTPS connections
   - Only enabled in production
   - Includes subdomains and preload list

7. Permissions-Policy
   - Disables unused browser features
   - Prevents access to camera, microphone, geolocation, etc.

*/

// ============================================================
// TESTING RATE LIMITS
// ============================================================

/*

Testing rate limiting with curl:

# Make multiple requests to test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123"}'
  echo ""
  sleep 0.5
done

# Check rate limit headers in response
curl -i http://localhost:5000/api/expenses

# Look for headers:
# RateLimit-Limit: 100
# RateLimit-Remaining: 99
# RateLimit-Reset: 1234567890

*/

// ============================================================
// MONITORING AND ALERTS
// ============================================================

/*

Recommended monitoring for production:

1. Sentry Integration (error tracking)
   - Sign up at sentry.io
   - Add SENTRY_DSN to .env
   - Import Sentry and wrap routes

2. Rate Limit Monitoring
   - Track when users hit rate limits
   - Alert on unusual patterns
   - Consider implementing adaptive rate limiting

3. Security Headers Validation
   - Use https://securityheaders.com to check headers
   - Regular audits of CSP rules
   - Monitor for CSP violations

4. Access Logs
   - Log all API access
   - Track authentication attempts
   - Monitor failed login attempts

*/

export default {};
