import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db, logEvent } from '../database.js';
import { authenticate, generateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Normalizes Indian mobile number:
 * Strips spaces, dashes, parentheses, +91, 91, and leading 0.
 * Must result in 10 digits starting with 6-9.
 */
export function normalizeIndianPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return null;
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

// Rate limiter: 5 failed attempts per 15 minutes per identifier
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const raw = req.body?.identifier || req.body?.email || req.body?.phone || 'anonymous';
    return String(raw).toLowerCase().trim();
  },
  skipSuccessfulRequests: true,
  message: { error: 'Too many failed login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false }
});

// Helper to sanitize user object
function getFullUserProfile(userId, role) {
  const user = db.prepare('SELECT id, email, role, name, phone, created_at FROM users WHERE id = ?').get(userId);
  if (!user) return null;

  let profile = null;
  if (role === 'donor') {
    profile = db.prepare('SELECT * FROM donor_profiles WHERE user_id = ?').get(userId);
  } else if (role === 'receiver') {
    profile = db.prepare('SELECT * FROM receiver_profiles WHERE user_id = ?').get(userId);
  } else if (role === 'rider') {
    profile = db.prepare('SELECT * FROM rider_profiles WHERE user_id = ?').get(userId);
  }

  return { ...user, profile };
}

// POST /auth/register/:role (Role fixed by route, NEVER from client body)
router.post('/register/:role', async (req, res) => {
  const { role } = req.params;

  if (!['donor', 'receiver', 'rider'].includes(role)) {
    return res.status(400).json({ error: 'Invalid registration role specified in route.' });
  }

  try {
    const { email, password, name, phone, ...rest } = req.body;

    if (!email || !password || !name || !phone) {
      return res.status(400).json({ error: 'Name, email, phone number, and password are all required.' });
    }

    const normPhone = normalizeIndianPhoneNumber(phone);
    if (!normPhone) {
      return res.status(400).json({ error: 'Invalid phone number. Must be a 10-digit Indian mobile number starting with 6-9.' });
    }

    const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (existingEmail) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(normPhone);
    if (existingPhone) {
      return res.status(409).json({ error: 'An account with this phone number already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const userId = `u-${role}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const transaction = db.transaction(() => {
      // 1. Insert user
      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, name, phone)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, email.toLowerCase().trim(), passwordHash, role, name, normPhone);

      // 2. Insert role-specific profile
      if (role === 'donor') {
        db.prepare(`
          INSERT INTO donor_profiles (user_id, org_name, category, pickup_address, lat, lng)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          rest.orgName || name,
          rest.category || 'restaurant',
          rest.pickupAddress || 'Pune, Maharashtra',
          parseFloat(rest.lat) || 18.5204,
          parseFloat(rest.lng) || 73.8567
        );
      } else if (role === 'receiver') {
        db.prepare(`
          INSERT INTO receiver_profiles (
            user_id, org_name, org_type, address, lat, lng,
            storage_capacity, clean_water, cooking_facilities,
            food_handling_capabilities, operating_hours, current_demand
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          rest.orgName || name,
          rest.orgType || 'night shelter',
          rest.address || 'Pune, Maharashtra',
          parseFloat(rest.lat) || 18.5204,
          parseFloat(rest.lng) || 73.8567,
          parseInt(rest.storageCapacity) || 100,
          rest.cleanWater !== undefined ? (rest.cleanWater ? 1 : 0) : 1,
          rest.cookingFacilities !== undefined ? (rest.cookingFacilities ? 1 : 0) : 1,
          rest.foodHandlingCapabilities || 'cooked,packaged',
          rest.operatingHours || '08:00 - 22:00',
          parseInt(rest.currentDemand) || 50
        );

        db.prepare(`
          INSERT INTO receiver_demand (id, receiver_id, item_category, needed_quantity, remaining_demand)
          VALUES (?, ?, ?, ?, ?)
        `).run(`dem-${Date.now()}`, userId, 'cooked_meals', parseInt(rest.currentDemand) || 50, parseInt(rest.currentDemand) || 50);
      } else if (role === 'rider') {
        db.prepare(`
          INSERT INTO rider_profiles (
            user_id, full_name, vehicle_type, max_capacity,
            operating_area, availability, location_sharing, current_lat, current_lng
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          rest.fullName || name,
          rest.vehicleType || 'Two-Wheeler',
          parseInt(rest.maxCapacity) || 40,
          rest.operatingArea || 'Pune Central',
          rest.availability !== undefined ? (rest.availability ? 1 : 0) : 1,
          rest.locationSharing !== undefined ? (rest.locationSharing ? 1 : 0) : 1,
          parseFloat(rest.lat) || 18.5204,
          parseFloat(rest.lng) || 73.8567
        );
      }

      logEvent('USER_REGISTERED', `New ${role} registered: ${name} (${email})`, { userId, role });
    });

    transaction();

    const userWithProfile = getFullUserProfile(userId, role);
    const token = generateToken(userWithProfile);

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(201).json({
      message: `${role.toUpperCase()} account created successfully.`,
      token,
      user: userWithProfile
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Server error during registration.' });
  }
});

// POST /auth/login { identifier, password, role }
// If identifier contains "@", look up by email; otherwise normalize and look up by phone.
// Still reject if the account role does not match the login page.
// Use one generic "Invalid credentials" error for all failures.
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const rawId = req.body.identifier || req.body.email || req.body.phone;
    const { password, role } = req.body;

    if (!rawId || !password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const trimmed = String(rawId).trim();
    let user = null;

    if (trimmed.includes('@')) {
      user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(trimmed);
    } else {
      const normPhone = normalizeIndianPhoneNumber(trimmed);
      if (normPhone) {
        user = db.prepare('SELECT * FROM users WHERE phone = ?').get(normPhone);
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Role check: reject if role mismatch with generic error
    if (role && user.role !== role) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userWithProfile = getFullUserProfile(user.id, user.role);
    const token = generateToken(userWithProfile);

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logEvent('USER_LOGIN', `User logged in: ${user.name} (${user.email} / ${user.phone}) as ${user.role}`, { userId: user.id });

    return res.json({
      message: 'Login successful!',
      token,
      user: userWithProfile
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully.' });
});

// GET /auth/me
router.get('/me', authenticate, (req, res) => {
  const userWithProfile = getFullUserProfile(req.user.id, req.user.role);
  if (!userWithProfile) {
    return res.status(404).json({ error: 'User profile not found.' });
  }
  res.json({ user: userWithProfile });
});

// GET /auth/demo-accounts
router.get('/demo-accounts', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.phone,
      COALESCE(dp.category, rp.org_type, rdp.vehicle_type) AS subtitle,
      COALESCE(dp.pickup_address, rp.address, rdp.operating_area) AS location
    FROM users u
    LEFT JOIN donor_profiles dp ON u.id = dp.user_id
    LEFT JOIN receiver_profiles rp ON u.id = rp.user_id
    LEFT JOIN rider_profiles rdp ON u.id = rdp.user_id
  `).all();

  res.json({ demoAccounts: users, demoPassword: 'Demo@1234' });
});

export default router;
