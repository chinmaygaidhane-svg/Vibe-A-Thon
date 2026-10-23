import jwt from 'jsonwebtoken';
import { db } from '../database.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'aidflow-secret-super-secure-key-2026';

/**
 * Authentication Middleware
 * Extracts token from httpOnly cookie or Authorization header.
 * Verifies token and populates req.user.
 */
export function authenticate(req, res, next) {
  let token = null;

  // 1. Check httpOnly cookie
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Check Authorization Bearer header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, role, name, phone FROM users WHERE id = ?').get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User session invalid. Account not found.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
}

/**
 * Role-Based Access Control Middleware
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({
        error: `Access denied. Requires one of the following roles: [${roles.join(', ')}]. Your account role is '${req.user.role}'.`
      });
    }

    next();
  };
}

/**
 * Helper to generate JWT
 */
export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
