import express from 'express';
import { db, logEvent, calculateDistanceKm, estimateTravelTimeMinutes } from '../database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { checkFeasibility } from '../services/feasibilityService.js';
import { checkCompatibility } from '../services/compatibilityService.js';

const router = express.Router();

// GET /api/donations
// Receivers get feasibility & compatibility calculations tailored to their shelter
// Riders get distance & ride ETA from their location
// Donors with query ?mine=true see only their own donations (ownership check)
router.get('/', authenticate, (req, res) => {
  const { category, search, vegOnly, mine } = req.query;
  const user = req.user;

  let query = 'SELECT d.*, u.name AS donor_name FROM donations d JOIN users u ON d.donor_id = u.id WHERE 1=1';
  const params = [];

  // Ownership check
  if (user.role === 'donor' && mine === 'true') {
    query += ' AND d.donor_id = ?';
    params.push(user.id);
  }

  if (category && category !== 'all') {
    query += ' AND d.category = ?';
    params.push(category);
  }

  if (vegOnly === 'true') {
    query += ' AND d.veg_type = ?';
    params.push('veg');
  }

  query += ' ORDER BY d.created_at DESC';

  let donations = db.prepare(query).all(...params);

  // If search filter applied
  if (search) {
    const s = search.toLowerCase();
    donations = donations.filter(d =>
      d.name.toLowerCase().includes(s) ||
      d.donor_name.toLowerCase().includes(s) ||
      d.category.toLowerCase().includes(s)
    );
  }

  // Profile context for receiver or rider
  const receiverProfile = user.role === 'receiver'
    ? db.prepare('SELECT * FROM receiver_profiles WHERE user_id = ?').get(user.id)
    : null;

  const riderProfile = user.role === 'rider'
    ? db.prepare('SELECT * FROM rider_profiles WHERE user_id = ?').get(user.id)
    : null;

  const now = Date.now();

  const enriched = donations.map(don => {
    const deadlineMs = new Date(don.safe_until).getTime();
    const remainingMs = deadlineMs - now;
    const remainingMinutes = Math.max(0, Math.floor(remainingMs / (60 * 1000)));
    const isExpired = remainingMs <= 0 || don.status === 'EXPIRED';

    let isFeasible = !isExpired;
    let feasibilityReason = null;
    let isCompatible = true;
    let compatibilityReason = null;
    let distanceKm = 2.5;
    let travelTimeMins = 15;

    // Tailor calculations for Receiver
    if (receiverProfile) {
      const feas = checkFeasibility({ donation: don, receiver: receiverProfile, now });
      isFeasible = feas.isFeasible;
      feasibilityReason = feas.reason;
      distanceKm = feas.deliveryDistanceKm;
      travelTimeMins = feas.deliveryEtaMins;

      const compat = checkCompatibility({ donation: don, receiver: receiverProfile });
      isCompatible = compat.isCompatible;
      compatibilityReason = compat.reason;
    }

    // Tailor calculations for Rider
    if (riderProfile) {
      distanceKm = calculateDistanceKm(
        riderProfile.current_lat,
        riderProfile.current_lng,
        don.pickup_lat,
        don.pickup_lng
      );
      travelTimeMins = estimateTravelTimeMinutes(distanceKm, 25);
    }

    return {
      ...don,
      isExpired,
      remainingMinutes,
      isFeasible,
      feasibilityReason,
      isCompatible,
      compatibilityReason,
      distanceKm,
      travelTimeMins
    };
  });

  res.json({ donations: enriched });
});

// POST /api/donations (Donor only: configurable safe_until, NEVER fixed duration)
router.post('/', authenticate, requireRole('donor'), (req, res) => {
  try {
    const {
      name,
      category = 'cooked_meals',
      veg_type = 'veg',
      description = '',
      total_quantity,
      unit = 'servings',
      safe_until,
      safe_use_hours,
      storage_requirements = 'hot_insulated',
      handling_instructions = '',
      requires_cooking = false,
      requires_clean_water = false,
      item_type = 'cooked',
      image_url,
      pickup_lat,
      pickup_lng
    } = req.body;

    if (!name || !total_quantity) {
      return res.status(400).json({ error: 'Name and total quantity are required.' });
    }

    const qty = parseInt(total_quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Total quantity must be a positive integer.' });
    }

    // Configurable safe_until deadline (never fixed duration)
    let safeUntilDate;
    if (safe_until) {
      safeUntilDate = new Date(safe_until);
    } else if (safe_use_hours) {
      safeUntilDate = new Date(Date.now() + parseFloat(safe_use_hours) * 60 * 60 * 1000);
    } else {
      safeUntilDate = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3h default if unspecified
    }

    // Fetch donor profile for pickup coords
    const donorProfile = db.prepare('SELECT * FROM donor_profiles WHERE user_id = ?').get(req.user.id);
    const lat = pickup_lat ? parseFloat(pickup_lat) : (donorProfile ? donorProfile.lat : 18.5284);
    const lng = pickup_lng ? parseFloat(pickup_lng) : (donorProfile ? donorProfile.lng : 73.8425);

    const donationId = `don-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    db.prepare(`
      INSERT INTO donations (
        id, donor_id, name, category, veg_type, description,
        total_quantity, available_quantity, reserved_quantity, unit,
        prepared_at, safe_until, pickup_lat, pickup_lng,
        storage_requirements, handling_instructions,
        requires_cooking, requires_clean_water, item_type, image_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')
    `).run(
      donationId,
      req.user.id,
      name,
      category,
      veg_type,
      description,
      qty,
      qty,
      unit,
      new Date().toISOString(),
      safeUntilDate.toISOString(),
      lat,
      lng,
      storage_requirements,
      handling_instructions,
      requires_cooking ? 1 : 0,
      requires_clean_water ? 1 : 0,
      item_type,
      image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'
    );

    logEvent('DONATION_CREATED', `Donation ${donationId} created: ${qty} ${unit} of ${name} by ${req.user.name}`, {
      donationId,
      donorId: req.user.id,
      quantity: qty,
      safeUntil: safeUntilDate.toISOString()
    });

    const newDonation = db.prepare('SELECT * FROM donations WHERE id = ?').get(donationId);

    // Socket.IO broadcast
    const io = req.app.get('io');
    if (io) {
      io.emit('donation.created', { donation: newDonation });
    }

    return res.status(201).json({
      message: 'Donation successfully published to receiver and rider network!',
      donation: newDonation
    });
  } catch (err) {
    console.error('Error creating donation:', err);
    return res.status(500).json({ error: 'Server error while publishing donation.' });
  }
});

// GET /api/donations/:id
router.get('/:id', authenticate, (req, res) => {
  const donation = db.prepare(`
    SELECT d.*, u.name AS donor_name, dp.pickup_address, dp.category AS donor_category
    FROM donations d
    JOIN users u ON d.donor_id = u.id
    LEFT JOIN donor_profiles dp ON d.donor_id = dp.user_id
    WHERE d.id = ?
  `).get(req.params.id);

  if (!donation) {
    return res.status(404).json({ error: 'Donation not found.' });
  }

  res.json({ donation });
});

export default router;
