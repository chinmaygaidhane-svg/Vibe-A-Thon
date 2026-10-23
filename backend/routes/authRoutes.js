import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database.js';
import { generateToken, authenticateToken, sanitizeUser } from '../auth.js';

const router = express.Router();

// Register new user (Donor, Receiver, or Rider)
router.post('/register', async (req, res) => {
  try {
    const {
      role,
      email,
      password,
      name,
      phone,
      // Donor specific
      donorCategory,
      pickupAddress,
      lat,
      lng,
      // Receiver specific
      orgType,
      address,
      storageCapacity,
      cleanWater,
      cookingFacilities,
      foodHandlingCapabilities,
      operatingHours,
      // Rider specific
      vehicleType,
      maxCapacity,
      preferredArea,
      locationSharing
    } = req.body;

    if (!role || !['donor', 'receiver', 'rider'].includes(role)) {
      return res.status(400).json({ error: 'Valid role (donor, receiver, rider) is required.' });
    }

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userId = `u-${role}-${Date.now()}`;
    const newUser = {
      id: userId,
      role,
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      name: name.trim(),
      phone: phone || '',
      createdAt: new Date().toISOString()
    };

    if (role === 'donor') {
      newUser.donorCategory = donorCategory || 'Restaurant';
      newUser.pickupAddress = pickupAddress || address || 'Pune, Maharashtra';
      newUser.lat = parseFloat(lat) || 18.5204;
      newUser.lng = parseFloat(lng) || 73.8567;
    } else if (role === 'receiver') {
      newUser.orgType = orgType || 'Night Shelter';
      newUser.address = address || 'Pune, Maharashtra';
      newUser.lat = parseFloat(lat) || 18.5204;
      newUser.lng = parseFloat(lng) || 73.8567;
      newUser.storageCapacity = parseInt(storageCapacity) || 100;
      newUser.cleanWater = cleanWater !== undefined ? Boolean(cleanWater) : true;
      newUser.cookingFacilities = cookingFacilities !== undefined ? Boolean(cookingFacilities) : true;
      newUser.foodHandlingCapabilities = Array.isArray(foodHandlingCapabilities)
        ? foodHandlingCapabilities
        : ['cooked_meals', 'bakery_packaged'];
      newUser.operatingHours = operatingHours || '8:00 AM - 10:00 PM';
      newUser.currentDemand = 50;
    } else if (role === 'rider') {
      newUser.vehicleType = vehicleType || 'Two-Wheeler';
      newUser.maxCapacity = parseInt(maxCapacity) || 60;
      newUser.preferredArea = preferredArea || 'Pune Central';
      newUser.availability = 'AVAILABLE';
      newUser.locationSharing = locationSharing !== undefined ? Boolean(locationSharing) : true;
      newUser.currentLat = parseFloat(lat) || 18.5240;
      newUser.currentLng = parseFloat(lng) || 73.8480;
    }

    db.addUser(newUser);
    db.addAuditLog('USER_REGISTERED', `New ${role} registered: ${newUser.name} (${newUser.email})`, {
      userId: newUser.id,
      role
    });

    const token = generateToken(newUser);
    return res.status(201).json({
      message: 'Registration successful!',
      token,
      user: sanitizeUser(newUser)
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    // Role check if supplied
    if (role && user.role !== role) {
      return res.status(403).json({
        error: `Account role mismatch: This account is registered as '${user.role.toUpperCase()}', not '${role.toUpperCase()}'. Please select the correct role tab.`
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
    }

    const token = generateToken(user);
    db.addAuditLog('USER_LOGIN', `${user.name} logged in as ${user.role}`, { userId: user.id });

    return res.json({
      message: 'Login successful!',
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Quick switch / demo login for hackathon walkthrough
router.post('/demo-login', (req, res) => {
  const { demoRole } = req.body; // 'donor' | 'receiver' | 'receiver_b' | 'rider'
  let targetUser = null;

  if (demoRole === 'donor') {
    targetUser = db.getUserByEmail('donor@aidflow.org');
  } else if (demoRole === 'receiver' || demoRole === 'receiver_a') {
    targetUser = db.getUserByEmail('shelterA@aidflow.org');
  } else if (demoRole === 'receiver_b') {
    targetUser = db.getUserByEmail('shelterB@aidflow.org');
  } else if (demoRole === 'receiver_c') {
    targetUser = db.getUserByEmail('shelterC@aidflow.org');
  } else if (demoRole === 'rider') {
    targetUser = db.getUserByEmail('rider@aidflow.org');
  } else {
    return res.status(400).json({ error: 'Invalid demo role requested.' });
  }

  if (!targetUser) {
    return res.status(404).json({ error: 'Demo user account not found.' });
  }

  const token = generateToken(targetUser);
  return res.json({
    message: `Logged in as demo ${targetUser.role.toUpperCase()}: ${targetUser.name}`,
    token,
    user: sanitizeUser(targetUser)
  });
});

// Demo accounts list
router.get('/demo-accounts', (req, res) => {
  const users = db.getUsers().map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    category: u.donorCategory || u.orgType || u.vehicleType
  }));
  res.json({ demoAccounts: users });
});

// Get current profile
router.get('/me', authenticateToken, (req, res) => {
  const user = db.getUserById(req.user.id);
  res.json({ user: sanitizeUser(user) });
});

export default router;
