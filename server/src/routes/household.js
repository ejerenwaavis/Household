import { Router } from 'express';
import { householdAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import Household from '../models/Household.js';
import HouseholdInvite from '../models/HouseholdInvite.js';
import User from '../models/User.js';
import Income from '../models/Income.js';
import Expense from '../models/Expense.js';
import { sendInviteEmail, sendWelcomeEmail } from '../services/emailService.js';

const router = Router();

// PUBLIC: Get invite info from token (no auth required)
router.get('/invite-info/:inviteToken', async (req, res, next) => {
  try {
    const { inviteToken } = req.params;

    const invite = await HouseholdInvite.findOne({
      inviteToken,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    res.json({
      householdName: invite.householdName,
      invitedByName: invite.invitedByName,
      email: invite.email,
      expiresAt: invite.expiresAt
    });
  } catch (error) {
    next(error);
  }
});

// GET: Get all households for the current user
router.get('/user/my-households', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user._id?.toString();
    
    // Find all households where user is a member
    const households = await Household.find({
      'members.userId': userId
    }).select('householdId householdName members createdAt');

    console.log('[my-households] fetched', { userId, count: households.length });

    res.json({ 
      households,
      currentHouseholdId: req.user.householdId 
    });
  } catch (err) {
    console.error('[my-households] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// GET household details
router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const household = await Household.findOne({
      householdId: req.params.householdId,
    });

    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    res.json(household);
  } catch (error) {
    next(error);
  }
});

// Get household summary with income/expense totals
router.get('/:householdId/summary', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    // Get income totals - query by month string instead of date range
    const incomeData = await Income.aggregate([
      { $match: { householdId, month: monthStr } },
      { $group: { _id: null, total: { $sum: '$weeklyTotal' } } },
    ]);

    // Get expense totals - query by date range in dailyBreakdown
    const expenseData = await Expense.aggregate([
      { $match: { householdId, createdAt: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const totalIncome = incomeData[0]?.total || 0;
    const totalExpenses = expenseData[0]?.total || 0;

    res.json({
      householdId,
      month: monthStr,
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
    });
  } catch (error) {
    next(error);
  }
});

// POST: Send invite to join household (only head of house)
router.post('/:householdId/invite', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { email } = req.body;
    const invitedBy = req.user.userId;

    console.log('[household invite] incoming', { householdId, email, invitedBy });

    if (!email) {
      return res.status(400).json({ error: 'email required' });
    }

    // Get household
    const household = await Household.findOne({ householdId });
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    // Check if user is head of house
    // Support both headOfHouseId (new) and fallback to owner role in members array
    const userIdStr = req.user.userId || req.user._id?.toString();
    let isHeadOfHouse = household.headOfHouseId === userIdStr;
    
    // Fallback: if headOfHouseId is not set, check if user is owner in members array
    if (!household.headOfHouseId) {
      const ownerMember = household.members.find(m => m.role === 'owner' && m.userId === userIdStr);
      isHeadOfHouse = !!ownerMember;
      
      // Auto-fix: set headOfHouseId for this household
      if (isHeadOfHouse) {
        household.headOfHouseId = userIdStr;
        await household.save();
        console.log('[household] Auto-set headOfHouseId for household:', householdId);
      }
    }
    
    if (!isHeadOfHouse) {
      return res.status(403).json({ error: 'Only head of house can send invites' });
    }

    // Get inviter's name from household members
    const inviterMember = household.members.find(m => m.userId === invitedBy);
    const invitedByName = inviterMember?.name || 'Unknown';

    // Check if user already exists in system
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    const isExistingUser = !!existingUser;

    console.log('[household invite] user check', { email, exists: isExistingUser });

    // Check if invite already exists and is pending
    const existingInvite = await HouseholdInvite.findOne({
      householdId,
      email,
      status: 'pending',
    });

    if (existingInvite) {
      // Refresh the token and expiration
      existingInvite.updatedAt = new Date();
      existingInvite.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      existingInvite.isExistingUser = isExistingUser; // Update if status changed
      await existingInvite.save();
      return res.json({ 
        success: true, 
        msg: 'Invite refreshed',
        inviteToken: existingInvite.inviteToken,
        isExistingUser,
      });
    }

    // Create new invite
    const invite = await HouseholdInvite.create({
      householdId,
      householdName: household.householdName,
      invitedBy,
      invitedByName,
      email,
      isExistingUser, // Store whether user already has account
    });

    console.log('[household invite] created', { id: invite._id, email, token: invite.inviteToken, isExistingUser });
    
    // Send email with invite link (different for existing vs new users)
    const emailSent = await sendInviteEmail(
      email,
      household.householdName,
      invitedByName,
      invite.inviteToken,
      isExistingUser // Pass existing user flag
    );

    res.status(201).json({ 
      success: true,
      emailSent,
      isExistingUser, // Tell frontend if user already has account
      inviteType: isExistingUser ? 'login' : 'register', // 'login' = goes to /login, 'register' = goes to /register/:token
      invite: {
        id: invite._id,
        email: invite.email,
        inviteToken: invite.inviteToken,
        expiresAt: invite.expiresAt,
      }
    });
  } catch (err) {
    console.error('[household invite] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// GET: Get pending invites for household
router.get('/:householdId/invites', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;

    const invites = await HouseholdInvite.find({ householdId, status: 'pending' })
      .sort({ createdAt: -1 });

    res.json({ invites });
  } catch (err) {
    console.error('[household invites GET] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// GET: Get pending invites for current user (by email)
router.get('/user/pending-invites', authMiddleware, async (req, res, next) => {
  try {
    const userEmail = req.user.email.toLowerCase();

    const pendingInvites = await HouseholdInvite.find({ 
      email: userEmail,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    })
      .sort({ createdAt: -1 });

    console.log('[pending invites] fetched for user', { email: userEmail, count: pendingInvites.length });

    res.json({ pendingInvites });
  } catch (err) {
    console.error('[pending invites GET] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// POST: Accept invite using token (called by invited user)
router.post('/invite/accept/:inviteToken', authMiddleware, async (req, res, next) => {
  try {
    const { inviteToken } = req.params;
    const userId = req.user.userId;
    const userEmail = req.user.email;

    console.log('[invite accept] incoming', { inviteToken, userId, userEmail });

    // Find invite
    const invite = await HouseholdInvite.findOne({ 
      inviteToken,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    // Verify email matches
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({ error: 'Email does not match invite' });
    }

    // Get household by householdId (UUID string)
    const household = await Household.findOne({ householdId: invite.householdId });
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    // Get user details to add to household members
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add user to household members if not already there
    const memberExists = household.members.some(m => m.userId === userId);
    if (!memberExists) {
      household.members.push({
        userId,
        name: user.profile.name,
        email: userEmail,
        joinedAt: new Date(),
      });
      await household.save();
    }

    // Mark invite as accepted
    invite.status = 'accepted';
    invite.acceptedAt = new Date();
    await invite.save();

    // Send welcome email
    await sendWelcomeEmail(
      userEmail,
      user.profile.name,
      household.householdName
    );

    console.log('[invite accept] success', { userId, householdId: household.householdId });
    res.json({ 
      success: true, 
      household: { 
        householdId: household.householdId,
        householdName: household.householdName,
        members: household.members
      }
    });
  } catch (err) {
    console.error('[invite accept] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// POST: Decline invite
router.post('/invite/decline/:inviteToken', authMiddleware, async (req, res, next) => {
  try {
    const { inviteToken } = req.params;

    const invite = await HouseholdInvite.findOne({ inviteToken, status: 'pending' });
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    invite.status = 'declined';
    await invite.save();

    console.log('[invite decline] success', { inviteToken });
    res.json({ success: true });
  } catch (err) {
    console.error('[invite decline] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// DELETE: Cancel pending invite (head of house only)
router.delete('/:householdId/invites/:inviteId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, inviteId } = req.params;
    const userId = req.user._id;

    // Get household and check if user is head of house
    const household = await Household.findOne({ householdId });
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    // Check if user is head of house with fallback
    const userIdStr = req.user.userId || req.user._id?.toString();
    let isHeadOfHouse = household.headOfHouseId === userIdStr;
    
    if (!household.headOfHouseId) {
      const ownerMember = household.members.find(m => m.role === 'owner' && m.userId === userIdStr);
      isHeadOfHouse = !!ownerMember;
      if (isHeadOfHouse) {
        household.headOfHouseId = userIdStr;
        await household.save();
      }
    }
    
    if (!isHeadOfHouse) {
      return res.status(403).json({ error: 'Only head of house can cancel invites' });
    }

    // Find and delete the invite
    const invite = await HouseholdInvite.findById(inviteId);
    if (!invite || invite.householdId !== householdId) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    await HouseholdInvite.findByIdAndDelete(inviteId);

    console.log('[invite cancel] success', { inviteId, householdId });
    res.json({ success: true });
  } catch (err) {
    console.error('[invite cancel] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// DELETE: Remove member from household (head of house only)
router.delete('/:householdId/members/:memberId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, memberId } = req.params;
    const userId = req.user._id;

    // Get household and check if user is head of house
    const household = await Household.findOne({ householdId });
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    // Check if user is head of house with fallback
    const userIdStr = req.user.userId || req.user._id?.toString();
    let isHeadOfHouse = household.headOfHouseId === userIdStr;
    
    if (!household.headOfHouseId) {
      const ownerMember = household.members.find(m => m.role === 'owner' && m.userId === userIdStr);
      isHeadOfHouse = !!ownerMember;
      if (isHeadOfHouse) {
        household.headOfHouseId = userIdStr;
        await household.save();
      }
    }
    
    if (!isHeadOfHouse) {
      return res.status(403).json({ error: 'Only head of house can remove members' });
    }

    // Don't allow removing the owner
    const memberToRemove = household.members.find(m => m.userId?.toString() === memberId);
    if (memberToRemove?.role === 'owner') {
      return res.status(403).json({ error: 'Cannot remove household owner' });
    }

    // Remove member from household
    household.members = household.members.filter(m => m.userId?.toString() !== memberId);
    await household.save();

    console.log('[member remove] success', { memberId, householdId });
    res.json({ success: true });
  } catch (err) {
    console.error('[member remove] error', err && (err.stack || err.message || err));
    next(err);
  }
});

// PATCH: Update member details (role, responsibilities, income percentage) - head of house only
router.patch('/:householdId/members/:memberId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, memberId } = req.params;
    const { role, responsibilities, incomePercentage, incomeAmount } = req.body;
    const userIdStr = req.user.userId || req.user._id?.toString();

    // Get household
    const household = await Household.findOne({ householdId });
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    // Check if user is head of house
    let isHeadOfHouse = household.headOfHouseId === userIdStr;
    
    if (!household.headOfHouseId) {
      const ownerMember = household.members.find(m => m.role === 'owner' && m.userId === userIdStr);
      isHeadOfHouse = !!ownerMember;
      if (isHeadOfHouse) {
        household.headOfHouseId = userIdStr;
        await household.save();
      }
    }
    
    if (!isHeadOfHouse) {
      return res.status(403).json({ error: 'Only head of house can update member details' });
    }

    // Find and update member
    const member = household.members.find(m => m.userId?.toString() === memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Update fields if provided
    if (role && ['owner', 'co-owner', 'manager', 'member', 'viewer'].includes(role)) {
      member.role = role;
    }
    
    // Validate income percentage doesn't exceed 100% across all members
    if (typeof incomePercentage === 'number') {
      const otherMembersIncome = household.members
        .filter(m => m.userId?.toString() !== memberId)
        .reduce((sum, m) => sum + (m.incomePercentage || 0), 0);
      const totalIncome = otherMembersIncome + incomePercentage;
      if (totalIncome > 100) {
        return res.status(400).json({ 
          error: `Income percentage cannot exceed 100%. Other members: ${otherMembersIncome}% + assigned: ${incomePercentage}% = ${totalIncome}%`,
          otherMembersIncome,
          requested: incomePercentage,
          total: totalIncome
        });
      }
    }
    if (Array.isArray(responsibilities)) {
      member.responsibilities = responsibilities;
    }
    if (typeof incomePercentage === 'number') {
      member.incomePercentage = Math.min(100, Math.max(0, incomePercentage));
    }
    if (typeof incomeAmount === 'number') {
      member.incomeAmount = incomeAmount;
    }

    await household.save();

    console.log('[member update] success', { memberId, householdId, role, responsibilities, incomePercentage });
    res.json({ 
      success: true,
      member
    });
  } catch (err) {
    console.error('[member update] error', err && (err.stack || err.message || err));
    next(err);
  }
});

export default router;
