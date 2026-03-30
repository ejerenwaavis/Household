import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { syncAccountTransactions } from '../services/transactionSyncService.js';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { authMiddleware, verifyToken } from '../middleware/auth.js';
import { TokenRotationService } from '../services/tokenRotationService.js';
import { authSchemas, validateBody } from '../utils/validationSchemas.js';
import User from '../models/User.js';
import Household from '../models/Household.js';
import HouseholdInvite from '../models/HouseholdInvite.js';
import PasskeyChallenge from '../models/PasskeyChallenge.js';
import LinkedAccount from '../models/LinkedAccount.js';
import PlaidTransaction from '../models/PlaidTransaction.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import FixedExpense from '../models/FixedExpense.js';
import FixedExpensePayment from '../models/FixedExpensePayment.js';
import Goal from '../models/Goal.js';
import GoalContribution from '../models/GoalContribution.js';
import TaskReminder from '../models/TaskReminder.js';
import InsightCache from '../models/InsightCache.js';
import Subscription from '../models/Subscription.js';
import PlaidService from '../services/plaidService.js';
import * as StripeService from '../services/stripeService.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { createAuditLog } from '../services/auditService.js';
import { createRequestFingerprint } from '../utils/requestFingerprint.js';

const router = Router();

const COOKIE_SECURE = process.env.NODE_ENV === 'production';
const ACCESS_COOKIE_NAME = 'accessToken';
const REFRESH_COOKIE_NAME = 'refreshToken';

function setAuthCookies(res, accessToken, refreshToken) {
  if (accessToken) {
    res.cookie(ACCESS_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
  }

  if (refreshToken) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE_NAME, { path: '/' });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
}

function parseCookies(cookieHeader = '') {
  return String(cookieHeader)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const idx = pair.indexOf('=');
      if (idx < 0) return acc;
      const key = pair.substring(0, idx).trim();
      const value = decodeURIComponent(pair.substring(idx + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

function getTokenFromRequest(req, type = 'access') {
  const cookies = parseCookies(req.headers.cookie || '');
  if (type === 'refresh') {
    return req.body?.refreshToken || cookies[REFRESH_COOKIE_NAME] || null;
  }
  return req.headers.authorization?.split(' ')[1] || cookies[ACCESS_COOKIE_NAME] || null;
}

// Register
router.post('/register', validateBody(authSchemas.register), async (req, res, next) => {
  try {
    const { email, password, name, householdName } = req.body;
    
    console.log('[AUTH] Registration attempt:', {
      email,
      name,
      householdName,
      hasPassword: !!password,
    });

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.warn('[AUTH] Registration failed: User already exists', { email });
      return res.status(409).json({ error: 'User already exists' });
    }

    // Generate a single userId and householdId so both records reference the same user
    const userId = uuidv4();
    const householdId = uuidv4();
    
    console.log('[AUTH] Creating new user and household:', { userId, householdId, email });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create household with the same userId in the members array
    const household = await Household.create({
      householdId,
      householdName,
      headOfHouseId: userId, // Set the creator as head of house
      currency: 'USD',
      language: 'en',
      members: [{ userId, role: 'owner', name, email, joinedAt: new Date() }],
      subscription: {
        planId: 'free',
        status: 'active',
        startDate: new Date(),
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    
    console.log('[AUTH] Household created:', { householdId, householdName });

    // Create user referencing that household
    const verifyToken = randomBytes(32).toString('hex');
    const verifyTokenHash = createHash('sha256').update(verifyToken).digest('hex');

    const user = await User.create({
      userId,
      email,
      password: hashedPassword,
      householdId,
      role: 'owner',
      profile: { name },
      tokenVersion: 0,
      lastLoginAt: new Date(),
      emailVerified: false,
      emailVerifyToken: verifyTokenHash,
      emailVerifyExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      emailFrozenAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),      // freeze after 7 days
    });
    
    console.log('[AUTH] User created successfully:', { userId, email, householdId });

    // Send verification email (non-blocking — don't fail registration if email fails)
    sendVerificationEmail(email, name, verifyToken).catch(err =>
      console.error('[AUTH] Verification email failed to send:', err.message)
    );

    // Generate tokens with rotation support
    const { hash: tokenFingerprint } = createRequestFingerprint(req);
    const accessToken = TokenRotationService.generateAccessToken({
      userId: user.userId,
      email: user.email,
      householdId: user.householdId,
      role: user.role,
      tokenFingerprint,
    });
    const refreshToken = TokenRotationService.generateRefreshToken(user._id, 0);

    setAuthCookies(res, accessToken, refreshToken);

    await createAuditLog({
      req,
      action: 'auth.register',
      status: 'success',
      userId: user.userId,
      householdId: user.householdId,
      targetType: 'user',
      targetId: user.userId,
      metadata: {
        email: user.email,
      },
    });

    res.status(201).json({
      user: { userId, email, name, householdId, householdName, onboardingCompleted: false, mfaEnabled: false, passkeyCount: 0, emailVerified: false },
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    });
  } catch (error) {
    console.error('[AUTH] Registration error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      details: error.details || 'No additional details',
    });
    await createAuditLog({
      req,
      action: 'auth.register',
      status: 'failure',
      metadata: {
        email: req.body?.email,
        message: error.message,
      },
    });
    next(error);
  }
});

// Login
router.post('/login', validateBody(authSchemas.login), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    console.log('[AUTH] Login attempt:', { email, hasPassword: !!password });

    const user = await User.findOne({ email });
    if (!user) {
      console.warn('[AUTH] Login failed: User not found', { email });
      await createAuditLog({
        req,
        action: 'auth.login',
        status: 'failure',
        metadata: { email, reason: 'USER_NOT_FOUND' },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.warn('[AUTH] Login failed: Invalid password', { email });
      await createAuditLog({
        req,
        action: 'auth.login',
        status: 'failure',
        userId: user.userId,
        householdId: user.householdId,
        metadata: { email, reason: 'INVALID_PASSWORD' },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If MFA is enabled, require a TOTP code
    if (user.mfaEnabled) {
      const { mfaToken } = req.body;
      if (!mfaToken) {
        return res.status(206).json({ mfaRequired: true });
      }
      const valid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: mfaToken,
        window: 1,
      });
      if (!valid) {
        await createAuditLog({
          req,
          action: 'auth.login',
          status: 'failure',
          userId: user.userId,
          householdId: user.householdId,
          metadata: { email, reason: 'INVALID_MFA' },
        });
        return res.status(401).json({ error: 'Invalid MFA code' });
      }
    }

    const household = await Household.findOne({ householdId: user.householdId });
    if (!household) {
      console.error('[AUTH] Login failed: Household not found', { userId: user.userId, householdId: user.householdId });
      return res.status(500).json({ error: 'Household not found' });
    }
    
    // Update login info
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    await user.save();
    
    // Generate tokens with rotation support
    const { hash: tokenFingerprint } = createRequestFingerprint(req);
    const accessToken = TokenRotationService.generateAccessToken({
      userId: user.userId,
      email: user.email,
      householdId: user.householdId,
      role: user.role,
      tokenFingerprint,
    });
    const refreshToken = TokenRotationService.generateRefreshToken(user._id, user.tokenVersion || 0);

    setAuthCookies(res, accessToken, refreshToken);
    
    // Get any pending invites for this user
    const pendingInvites = await HouseholdInvite.find({
      email: email.toLowerCase(),
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });
    
    // Check if account is frozen (unverified after 7 days)
    const now = new Date();
    const accountFrozen = !user.emailVerified && user.emailFrozenAt && user.emailFrozenAt <= now;

    console.log('[AUTH] Login successful:', { userId: user.userId, email, householdId: user.householdId, pendingInvites: pendingInvites.length });

    await createAuditLog({
      req,
      action: 'auth.login',
      status: 'success',
      userId: user.userId,
      householdId: user.householdId,
      targetType: 'user',
      targetId: user.userId,
      metadata: {
        mfaEnabled: user.mfaEnabled || false,
      },
    });

    // Non-blocking: fetch fresh transactions for this user's accounts in the background.
    // We don't await this — the login response goes back immediately.
    import('../models/LinkedAccount.js').then(({ default: LinkedAccount }) => {
      LinkedAccount.find({ householdId: user.householdId, isActive: true }).then(accounts => {
        for (const account of accounts) {
          syncAccountTransactions(account).catch(err =>
            console.error('[AUTH] Background sync failed for account:', account._id, err.message)
          );
        }
      });
    }).catch(() => {});

    res.json({
      user: {
        userId: user.userId,
        email: user.email,
        name: user.profile.name,
        householdId: user.householdId,
        householdName: household.householdName,
        onboardingCompleted: user.onboardingCompleted || false,
        mfaEnabled: user.mfaEnabled || false,
        passkeyCount: user.passkeys?.length || 0,
        emailVerified: user.emailVerified || false,
        accountFrozen: accountFrozen || false,
      },
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      pendingInvites: pendingInvites.map(inv => ({
        id: inv._id,
        householdName: inv.householdName,
        invitedByName: inv.invitedByName,
        inviteToken: inv.inviteToken,
        status: inv.status,
      })),
    });
  } catch (error) {
    console.error('[AUTH] Login error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    await createAuditLog({
      req,
      action: 'auth.login',
      status: 'failure',
      metadata: {
        email: req.body?.email,
        message: error.message,
      },
    });
    next(error);
  }
});

// ── GET /auth/verify-email/:token ─────────────────────────────────────────────
// Called when the user clicks the link in their verification email.
router.get('/verify-email/:token', async (req, res, next) => {
  try {
    const hash = createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ emailVerifyToken: hash });

    if (!user) {
      return res.status(400).json({ error: 'Verification link is invalid or has already been used.' });
    }

    user.emailVerified = true;
    user.emailVerifyToken = null;
    user.emailVerifyExpires = null;
    user.emailFrozenAt = null;
    await user.save();

    console.log('[AUTH] Email verified for user:', user.userId);
    res.json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    next(err);
  }
});

// ── POST /auth/resend-verification ────────────────────────────────────────────
// Re-sends the verification email (rate-limited by existing authLimiter on the router).
router.post('/resend-verification', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) return res.status(400).json({ error: 'Email is already verified.' });

    // Issue a fresh token — reset the 7-day clock from now
    const newToken = randomBytes(32).toString('hex');
    const newHash = createHash('sha256').update(newToken).digest('hex');

    user.emailVerifyToken = newHash;
    user.emailVerifyExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.emailFrozenAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(user.email, user.profile.name, newToken);
    res.json({ success: true, message: 'Verification email resent.' });
  } catch (err) {
    next(err);
  }
});

// Verify token
router.get('/me', (req, res) => {
  const token = getTokenFromRequest(req, 'access');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.json({ user: decoded });
});

// Refresh token endpoint
// Exchange refresh token for new access token (with token rotation)
router.post('/refresh', validateBody(authSchemas.refresh), async (req, res, next) => {
  try {
    const refreshToken = getTokenFromRequest(req, 'refresh');

    if (!refreshToken) {
      return res.status(400).json({ error: 'No refresh token provided' });
    }

    const { hash: tokenFingerprint } = createRequestFingerprint(req);

    const tokens = await TokenRotationService.rotateTokens(refreshToken, { tokenFingerprint });

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    await createAuditLog({
      req,
      action: 'auth.refresh',
      status: 'success',
    });

    console.log('[AUTH] Token rotation successful');
    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    console.error('[AUTH] Token refresh error:', error.message);
    await createAuditLog({
      req,
      action: 'auth.refresh',
      status: 'failure',
      metadata: { message: error.message },
    });
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Persist the active household selection and issue a fresh access token.
router.post('/switch-household', authMiddleware, async (req, res, next) => {
  try {
    const targetHouseholdId = String(req.body?.householdId || '').trim();
    if (!targetHouseholdId) {
      return res.status(400).json({ error: 'householdId is required' });
    }

    const household = await Household.findOne({
      householdId: targetHouseholdId,
      'members.userId': req.user.userId,
    });

    if (!household) {
      return res.status(403).json({ error: 'Not authorized for this household' });
    }

    const user = await User.findOne({ userId: req.user.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.householdId = targetHouseholdId;
    user.updatedAt = new Date();
    await user.save();

    const { hash: tokenFingerprint } = createRequestFingerprint(req);
    const accessToken = TokenRotationService.generateAccessToken({
      userId: user.userId,
      email: user.email,
      householdId: targetHouseholdId,
      role: user.role,
      tokenFingerprint,
    });

    setAuthCookies(res, accessToken, null);

    await createAuditLog({
      req,
      action: 'auth.switch_household',
      status: 'success',
      userId: user.userId,
      householdId: targetHouseholdId,
      targetType: 'household',
      targetId: targetHouseholdId,
    });

    res.json({
      user: {
        userId: user.userId,
        email: user.email,
        name: user.profile.name,
        householdId: targetHouseholdId,
        householdName: household.householdName,
      },
      accessToken,
    });
  } catch (error) {
    console.error('[AUTH] Switch household error:', error.message);
    await createAuditLog({
      req,
      action: 'auth.switch_household',
      status: 'failure',
      userId: req.user?.userId,
      householdId: req.user?.householdId,
      metadata: { message: error.message },
    });
    next(error);
  }
});

// Logout endpoint
// Invalidates all refresh tokens for the user
router.post('/logout', async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req, 'access');

    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Invalidate all tokens for this user
    await TokenRotationService.invalidateAllTokens(decoded.userId);
    clearAuthCookies(res);

    await createAuditLog({
      req,
      action: 'auth.logout',
      status: 'success',
      userId: decoded.userId,
      householdId: decoded.householdId,
    });

    console.log('[AUTH] User logged out successfully:', { userId: decoded.userId });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[AUTH] Logout error:', error.message);
    await createAuditLog({
      req,
      action: 'auth.logout',
      status: 'failure',
      metadata: { message: error.message },
    });
    next(error);
  }
});

/**
 * PATCH /auth/profile
 * Update the logged-in user's display name
 */
router.patch('/profile', authMiddleware, async (req, res, next) => {
  try {
    const { name } = req.body;
    const { userId, householdId } = req.user;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.profile.name = name.trim();
    user.updatedAt = new Date();
    await user.save();

    // Also update name in the household members array
    await Household.updateOne(
      { householdId, 'members.userId': userId },
      { $set: { 'members.$.name': name.trim() } }
    );

    console.log('[AUTH] Profile updated:', { userId, name: name.trim() });
    res.json({ message: 'Profile updated', name: user.profile.name });
  } catch (error) {
    console.error('[AUTH] Profile update error:', error.message);
    next(error);
  }
});

/**
 * PATCH /auth/change-password
 * Change password – requires current password verification
 */
router.patch('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { userId } = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.updatedAt = new Date();
    // Rotate token version to invalidate all existing tokens
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await createAuditLog({
      req,
      action: 'auth.password_changed',
      status: 'success',
      userId,
      householdId: user.householdId,
      targetType: 'user',
      targetId: userId,
    });

    console.log('[AUTH] Password changed:', { userId });
    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    console.error('[AUTH] Change password error:', error.message);
    await createAuditLog({
      req,
      action: 'auth.password_changed',
      status: 'failure',
      userId: req.user?.userId,
      householdId: req.user?.householdId,
      metadata: { message: error.message },
    });
    next(error);
  }
});

/**
 * POST /auth/mfa/setup
 * Generate a new TOTP secret and return QR code for the user to scan
 */
router.post('/mfa/setup', authMiddleware, async (req, res, next) => {
  try {
    const { userId, email } = req.user;
    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const secret = speakeasy.generateSecret({
      name: `Household Budget (${email})`,
      issuer: 'Household Budget',
      length: 20,
    });

    // Store secret temporarily (not enabled yet until verified)
    user.mfaSecret = secret.base32;
    await user.save();

    const qrCodeDataURL = await QRCode.toDataURL(secret.otpauth_url);

    res.json({ qrCode: qrCodeDataURL, secret: secret.base32 });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/mfa/verify
 * Verify TOTP token and enable MFA for the account
 */
router.post('/mfa/verify', authMiddleware, async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const user = await User.findOne({ userId });
    if (!user || !user.mfaSecret) return res.status(400).json({ error: 'MFA setup not initiated' });

    const valid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) return res.status(401).json({ error: 'Invalid code, please try again' });

    user.mfaEnabled = true;
    await user.save();

    await createAuditLog({
      req,
      action: 'auth.mfa_enabled',
      status: 'success',
      userId,
      householdId: user.householdId,
      targetType: 'user',
      targetId: userId,
    });

    res.json({ message: 'MFA enabled successfully' });
  } catch (error) {
    await createAuditLog({
      req,
      action: 'auth.mfa_enabled',
      status: 'failure',
      userId: req.user?.userId,
      householdId: req.user?.householdId,
      metadata: { message: error.message },
    });
    next(error);
  }
});

/**
 * POST /auth/mfa/disable
 * Disable MFA — requires password confirmation
 */
router.post('/mfa/disable', authMiddleware, async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Incorrect password' });

    user.mfaEnabled = false;
    user.mfaSecret = null;
    await user.save();

    await createAuditLog({
      req,
      action: 'auth.mfa_disabled',
      status: 'success',
      userId,
      householdId: user.householdId,
      targetType: 'user',
      targetId: userId,
    });

    res.json({ message: 'MFA disabled successfully' });
  } catch (error) {
    await createAuditLog({
      req,
      action: 'auth.mfa_disabled',
      status: 'failure',
      userId: req.user?.userId,
      householdId: req.user?.householdId,
      metadata: { message: error.message },
    });
    next(error);
  }
});

/**
 * GET /auth/mfa/status
 * Return whether MFA is enabled for current user
 */
router.get('/mfa/status', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ mfaEnabled: user.mfaEnabled });
  } catch (error) {
    next(error);
  }
});

// ─── Passkey / WebAuthn Routes ───────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== 'production';
const RP_ID = process.env.RP_ID || (isDev ? 'localhost' : 'household.aceddivision.com');
const RP_NAME = 'Household Budget';
const ORIGIN = process.env.FRONTEND_URL || (isDev ? 'http://localhost:5173' : 'https://household.aceddivision.com');

/**
 * POST /auth/passkey/register/start
 * Generate registration options (user must be logged in)
 */
router.post('/passkey/register/start', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new TextEncoder().encode(user.userId),
      userName: user.email,
      userDisplayName: user.profile.name,
      attestationType: 'none',
      excludeCredentials: user.passkeys.map(pk => ({
        id: pk.credentialID,
        transports: pk.transports,
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
    });

    await PasskeyChallenge.findOneAndUpdate(
      { userId: user.userId },
      { challenge: options.challenge },
      { upsert: true, new: true }
    );

    res.json(options);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/passkey/register/finish
 * Verify registration and save credential
 */
router.post('/passkey/register/finish', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const challengeDoc = await PasskeyChallenge.findOne({ userId: user.userId });
    if (!challengeDoc) return res.status(400).json({ error: 'Challenge expired, please try again' });

    const { name, ...credential } = req.body;

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challengeDoc.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    await PasskeyChallenge.deleteOne({ userId: user.userId });

    if (!verification.verified) return res.status(400).json({ error: 'Verification failed' });

    const { registrationInfo } = verification;
    user.passkeys.push({
      credentialID: registrationInfo.credential.id,
      publicKey: Buffer.from(registrationInfo.credential.publicKey).toString('base64'),
      counter: registrationInfo.credential.counter,
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
      transports: credential.response?.transports ?? [],
      name: name || 'Passkey',
    });
    await user.save();

    res.json({ message: 'Passkey registered successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/passkey/login/start
 * Generate authentication options (no auth required — this IS the login)
 */
router.post('/passkey/login/start', async (req, res, next) => {
  try {
    const { email } = req.body;

    // If email provided, scope to that user's credentials; otherwise discoverable
    let allowCredentials = [];
    let challengeUserId = 'anonymous';

    if (email) {
      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (user && user.passkeys.length > 0) {
        allowCredentials = user.passkeys.map(pk => ({
          id: pk.credentialID,
          transports: pk.transports,
        }));
        challengeUserId = user.userId;
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'required',
      allowCredentials,
    });

    await PasskeyChallenge.findOneAndUpdate(
      { userId: challengeUserId },
      { challenge: options.challenge },
      { upsert: true, new: true }
    );

    res.json({ ...options, challengeUserId });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/passkey/login/finish
 * Verify authentication and issue JWT
 */
router.post('/passkey/login/finish', async (req, res, next) => {
  try {
    const { challengeUserId, ...credential } = req.body;

    // Find user by credential ID
    const user = await User.findOne({ 'passkeys.credentialID': credential.id });
    if (!user) return res.status(401).json({ error: 'Passkey not recognised' });

    const passkey = user.passkeys.find(pk => pk.credentialID === credential.id);

    const lookupId = challengeUserId || user.userId;
    const challengeDoc = await PasskeyChallenge.findOne({ userId: lookupId });
    if (!challengeDoc) return res.status(400).json({ error: 'Challenge expired, please try again' });

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challengeDoc.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: passkey.credentialID,
          publicKey: Buffer.from(passkey.publicKey, 'base64'),
          counter: passkey.counter,
          transports: passkey.transports,
        },
      });
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }

    await PasskeyChallenge.deleteOne({ userId: lookupId });

    if (!verification.verified) return res.status(401).json({ error: 'Authentication failed' });

    // Update counter to prevent replay attacks
    passkey.counter = verification.authenticationInfo.newCounter;
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    await user.save();

    const household = await Household.findOne({ householdId: user.householdId });

    const { hash: tokenFingerprint } = createRequestFingerprint(req);
    const accessToken = TokenRotationService.generateAccessToken({
      userId: user.userId,
      email: user.email,
      householdId: user.householdId,
      role: user.role,
      tokenFingerprint,
    });
    const refreshToken = TokenRotationService.generateRefreshToken(user._id, user.tokenVersion || 0);

    setAuthCookies(res, accessToken, refreshToken);

    await createAuditLog({
      req,
      action: 'auth.passkey_login',
      status: 'success',
      userId: user.userId,
      householdId: user.householdId,
      targetType: 'user',
      targetId: user.userId,
    });

    res.json({
      user: {
        userId: user.userId,
        email: user.email,
        name: user.profile.name,
        role: user.role,
        householdId: user.householdId,
        householdName: household?.householdName,
      },
      accessToken,
      refreshToken,
      pendingInvites: [],
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: 'auth.passkey_login',
      status: 'failure',
      metadata: { message: error.message },
    });
    next(error);
  }
});

/**
 * GET /auth/passkey/list
 * List registered passkeys for the logged-in user
 */
router.get('/passkey/list', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.passkeys.map(pk => ({
      credentialID: pk.credentialID,
      name: pk.name,
      deviceType: pk.deviceType,
      backedUp: pk.backedUp,
      createdAt: pk.createdAt,
    })));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /auth/passkey/:credentialID
 * Remove a passkey
 */
router.delete('/passkey/:credentialID', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const before = user.passkeys.length;
    user.passkeys = user.passkeys.filter(pk => pk.credentialID !== req.params.credentialID);
    if (user.passkeys.length === before) return res.status(404).json({ error: 'Passkey not found' });

    await user.save();
    res.json({ message: 'Passkey removed' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /auth/account
 * Permanently delete the calling user's account.
 * Steps:
 *   1. Verify password
 *   2. Revoke all Plaid access tokens linked to this user
 *   3. If user is the household owner → cancel Stripe subscription + delete household data
 *      Otherwise → remove user from household member list
 *   4. Delete all user-scoped documents
 *   5. Delete User record
 */
router.delete('/account', authMiddleware, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required to delete your account' });

    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Incorrect password' });

    const { userId, householdId } = user;

    // ── 1. Revoke Plaid access tokens ────────────────────────────────────────
    const linkedAccounts = await LinkedAccount.find({ userId });
    // Collect unique access tokens and revoke them
    const uniqueTokens = [...new Set(linkedAccounts.map(a => a.plaidAccessToken).filter(Boolean))];
    await Promise.allSettled(uniqueTokens.map(token => PlaidService.removeItem(token)));

    // ── 2. Household handling ─────────────────────────────────────────────────
    const household = await Household.findOne({ householdId });
    const isOwner = household?.members?.some(m => m.userId === userId && m.role === 'owner');
    const otherMembers = household?.members?.filter(m => m.userId !== userId) || [];

    if (isOwner && otherMembers.length === 0) {
      // Sole owner — cancel Stripe subscription and delete household
      try {
        await StripeService.cancelSubscription(householdId);
      } catch (_) { /* no subscription is fine */ }
      await Household.deleteOne({ householdId });
      await Subscription.deleteOne({ householdId });
      // Household-scoped data
      await PlaidTransaction.deleteMany({ householdId });
      await FixedExpensePayment.deleteMany({ householdId });
      await GoalContribution.deleteMany({ householdId });
      await InsightCache.deleteMany({ householdId });
    } else if (household) {
      // Member (or owner with other members) — just remove from member list
      household.members = otherMembers;
      // Transfer ownership if this was the owner
      if (isOwner && otherMembers.length > 0) {
        household.members[0].role = 'owner';
      }
      await household.save();
    }

    // ── 3. Delete user-scoped documents ──────────────────────────────────────
    await Promise.all([
      Income.deleteMany({ userId }),
      Expense.deleteMany({ userId }),
      FixedExpense.deleteMany({ userId }),
      Goal.deleteMany({ userId }),
      TaskReminder.deleteMany({ assignedTo: userId }),
      LinkedAccount.deleteMany({ userId }),
      PasskeyChallenge.deleteMany({ userId }),
      HouseholdInvite.deleteMany({ email: user.email }),
    ]);

    // ── 4. Delete user ────────────────────────────────────────────────────────
    await User.deleteOne({ userId });

    await createAuditLog({
      req,
      action: 'auth.account_deleted',
      status: 'success',
      userId,
      householdId,
      targetType: 'user',
      targetId: userId,
    });

    console.log('[AUTH] Account deleted:', { userId, householdId });
    res.json({ message: 'Account permanently deleted' });
  } catch (error) {
    await createAuditLog({
      req,
      action: 'auth.account_deleted',
      status: 'failure',
      userId: req.user?.userId,
      householdId: req.user?.householdId,
      metadata: { message: error.message },
    });
    next(error);
  }
});

export default router;
