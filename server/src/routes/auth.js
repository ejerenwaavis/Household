import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateToken, verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';
import Household from '../models/Household.js';

const router = Router();

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, householdName } = req.body;

    if (!email || !password || !name || !householdName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Generate a single userId and householdId so both records reference the same user
    const userId = uuidv4();
    const householdId = uuidv4();

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

    // Create user referencing that household
    const user = await User.create({
      userId,
      email,
      password: hashedPassword,
      householdId,
      role: 'owner',
      profile: { name },
    });

    const token = generateToken(user);

    res.status(201).json({
      user: { userId, email, name, householdId, householdName },
      token,
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const household = await Household.findOne({ householdId: user.householdId });
    const token = generateToken(user);

    res.json({
      user: {
        userId: user.userId,
        email: user.email,
        name: user.profile.name,
        householdId: user.householdId,
        householdName: household.householdName,
      },
      token,
    });
  } catch (error) {
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

export default router;
