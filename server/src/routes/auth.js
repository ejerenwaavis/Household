import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateToken, verifyToken } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { TokenRotationService } from '../services/tokenRotationService.js';
import { authSchemas, validateBody } from '../utils/validationSchemas.js';
import User from '../models/User.js';
import Household from '../models/Household.js';
import HouseholdInvite from '../models/HouseholdInvite.js';

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
      user: { userId, email, name, householdId, householdName },
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

export default router;
