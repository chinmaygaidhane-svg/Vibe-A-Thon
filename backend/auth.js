import jwt from 'jsonwebtoken';
import { db } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'aidflow_super_secret_jwt_key_hackathon_2025';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Middleware: Verify JWT Token
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    const user = db.getUserById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    req.user = sanitizeUser(user);
    next();
  });
}

// Middleware: Role-Based Access Control (RBAC)
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access restricted. Your role '${req.user.role}' cannot perform this action.`
      });
    }

    next();
  };
}

// Sanitize user profile for frontend output (removes password)
export function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}
