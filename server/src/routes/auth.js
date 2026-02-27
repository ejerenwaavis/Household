import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { generateToken, verifyToken } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { TokenRotationService } from '../services/tokenRotationService.js';
import { authSchemas, validateBody } from '../utils/validationSchemas.js';
import User from '../models/User.js';
import Household from '../models/Household.js';
import HouseholdInvite from '../models/HouseholdInvite.js';
import PasskeyChallenge from '../models/PasskeyChallenge.js';

const router = Router();

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
    const user = await User.create({
      userId,
      email,
      password: hashedPassword,
      householdId,
      role: 'owner',
      profile: { name },
      tokenVersion: 0,
      lastLoginAt: new Date(),
    });
    
    console.log('[AUTH] User created successfully:', { userId, email, householdId });

    // Generate tokens with rotation support
    const accessToken = TokenRotationService.generateAccessToken({
      userId: user.userId,
      email: user.email,
      householdId: user.householdId,
      role: user.role
    });
    const refreshToken = TokenRotationService.generateRefreshToken(user._id, 0);

    res.status(201).json({
      user: { userId, email, name, householdId, householdName, onboardingCompleted: false },
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
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.warn('[AUTH] Login failed: Invalid password', { email });
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
    const accessToken = TokenRotationService.generateAccessToken({
      userId: user.userId,
      email: user.email,
      householdId: user.householdId,
      role: user.role
    });
    const refreshToken = TokenRotationService.generateRefreshToken(user._id, user.tokenVersion || 0);
    
    // Get any pending invites for this user
    const pendingInvites = await HouseholdInvite.find({
      email: email.toLowerCase(),
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });
    
    console.log('[AUTH] Login successful:', { userId: user.userId, email, householdId: user.householdId, pendingInvites: pendingInvites.length });

    res.json({
      user: {
        userId: user.userId,
        email: user.email,
        name: user.profile.name,
        householdId: user.householdId,
        householdName: household.householdName,
        onboardingCompleted: user.onboardingCompleted || false,
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
    next(error);
  }
});

// Verify token
router.get('/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

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
    const { refreshToken } = req.body;

    const tokens = await TokenRotationService.rotateTokens(refreshToken);

    console.log('[AUTH] Token rotation successful');
    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    console.error('[AUTH] Token refresh error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Logout endpoint
// Invalidates all refresh tokens for the user
router.post('/logout', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Invalidate all tokens for this user
    await TokenRotationService.invalidateAllTokens(decoded.userId);

    console.log('[AUTH] User logged out successfully:', { userId: decoded.userId });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[AUTH] Logout error:', error.message);
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

    console.log('[AUTH] Password changed:', { userId });
    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    console.error('[AUTH] Change password error:', error.message);
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

    res.json({ message: 'MFA enabled successfully' });
  } catch (error) {
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

    res.json({ message: 'MFA disabled successfully' });
  } catch (error) {
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

    const tokenPayload = {
      userId: user.userId,
      email: user.email,
      householdId: user.householdId,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = generateToken(tokenPayload, '15m');
    const refreshToken = generateToken({ ...tokenPayload, type: 'refresh' }, '7d');

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

export default router;
