import express from 'express';
import bcrypt from 'bcryptjs';
import { db, logEvent } from '../database.js';
import { authenticate, generateToken } from '../middleware/auth.js';

const router = express.Router();

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

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required fields.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const userId = `u-${role}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const transaction = db.transaction(() => {
      // 1. Insert user
      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, name, phone)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, email, passwordHash, role, name, phone || '');

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

// POST /auth/login { email, password, role }
// Reject if account role does not match the login page used
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. Account not found.' });
    }

    // Role verification: Reject if account role does not match login entry point
    if (role && user.role !== role) {
      return res.status(403).json({
        error: `Account role mismatch: This account is registered as '${user.role.toUpperCase()}', not '${role.toUpperCase()}'. Please use the ${user.role} login portal.`
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
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

    logEvent('USER_LOGIN', `User logged in: ${user.name} (${user.email}) as ${user.role}`, { userId: user.id });

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
