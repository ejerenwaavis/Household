import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export function generateToken(user) {
  return jwt.sign(
    { 
      userId: user.userId, 
      email: user.email, 
      householdId: user.householdId, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = decoded;
  next();
};

export const householdAuthMiddleware = (req, res, next) => {
  const { householdId } = req.params;

  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (req.user.householdId !== householdId) {
    return res.status(403).json({ error: 'Not authorized for this household' });
  }

  next();
};
