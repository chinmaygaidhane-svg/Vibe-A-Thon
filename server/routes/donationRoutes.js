import express from 'express';
import { db, logEvent, calculateDistanceKm, estimateTravelTimeMinutes } from '../database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { checkFeasibility } from '../services/feasibilityService.js';
import { checkCompatibility } from '../services/compatibilityService.js';

const router = express.Router();

// GET /donations/available & GET /api/donations/available
// Receivers must see ONLY donations that can feasibly reach them before safe-use deadline.
// Infeasible donations are filtered out on the server.
router.get('/available', authenticate, requireRole('receiver'), (req, res) => {
  try {
    const receiverId = req.user.id;
    const receiverProfile = db.prepare('SELECT * FROM receiver_profiles WHERE user_id = ?').get(receiverId);

    if (!receiverProfile) {
      return res.status(404).json({ error: 'Receiver profile not found.' });
    }

    // Check receiver demand records
    const demandRecords = db.prepare('SELECT * FROM receiver_demand WHERE receiver_id = ?').all(receiverId);
    const now = Date.now();

    // Query active available donations
    const rawDonations = db.prepare(`
      SELECT d.*, u.name AS donor_name, dp.pickup_address
      FROM donations d
      JOIN users u ON d.donor_id = u.id
      LEFT JOIN donor_profiles dp ON d.donor_id = dp.user_id
      WHERE d.status = 'AVAILABLE'
        AND d.available_quantity > 0
        AND d.safe_until > datetime('now')
    `).all();

    const feasibleList = [];

    for (const don of rawDonations) {
      // 1. Feasibility check: now + pickup_eta + delivery_eta + 5 min safety buffer <= safe_until
      const feas = checkFeasibility({ donation: don, receiver: receiverProfile, now });
      if (!feas.isFeasible) continue;

      // 2. Compatibility check (cooking, clean water, storage capacity, operating hours at estimated arrival)
      const compat = checkCompatibility({
        donation: don,
        receiver: receiverProfile,
        requestedQuantity: 1, // checking minimum viability
        estimatedArrival: feas.estimatedArrival
      });
      if (!compat.isCompatible) continue;

      // 3. Demand check: receiver has remaining demand for this item
      // If demand records exist for this category, check remaining_demand > 0
      const categoryDemand = demandRecords.find(d => d.item_category === don.category);
      if (categoryDemand && categoryDemand.remaining_demand <= 0) {
        continue;
      }
      if (receiverProfile.current_demand !== undefined && receiverProfile.current_demand <= 0) {
        continue;
      }

      feasibleList.push({
        ...don,
        mealName: don.name,
        imageUrl: don.image_url,
        isVegetarian: don.veg_type === 'veg',
        foodCategory: don.category,
        totalQuantity: don.total_quantity,
        availableQuantity: don.available_quantity,
        reservedQuantity: don.reserved_quantity,
        safeUseDeadline: don.safe_until,
        pickupAddress: don.pickup_address || `${don.donor_name} Pickup Location`,
        pickup_eta: feas.pickupEtaMins,
        delivery_eta: feas.deliveryEtaMins,
        pickupEtaMins: feas.pickupEtaMins,
        deliveryEtaMins: feas.deliveryEtaMins,
        estimated_arrival: feas.estimatedArrival,
        estimatedArrival: feas.estimatedArrival,
        remainingMinutes: feas.remainingMinutes,
        distanceKm: feas.deliveryDistanceKm,
        isFeasible: true,
        isCompatible: true
      });
    }

    // Sort by least time remaining first
    feasibleList.sort((a, b) => a.remainingMinutes - b.remainingMinutes);

    res.json({ donations: feasibleList });
  } catch (err) {
    console.error('Error in GET /donations/available:', err);
    res.status(500).json({ error: 'Failed to fetch available donations.' });
  }
});

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
      mealName: don.name,
      imageUrl: don.image_url,
      isVegetarian: don.veg_type === 'veg',
      foodCategory: don.category,
      totalQuantity: don.total_quantity,
      availableQuantity: don.available_quantity,
      reservedQuantity: don.reserved_quantity,
      safeUseDeadline: don.safe_until,
      pickupAddress: don.donor_name ? `${don.donor_name} Pickup Location` : 'Pickup Location',
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

// GET /api/donations/donor/dashboard-stats
// Returns { stats, donations, activeRequests } for the logged-in donor
router.get('/donor/dashboard-stats', authenticate, requireRole('donor'), (req, res) => {
  try {
    const donorId = req.user.id;

    // Fetch all donations belonging to this donor
    const rawDonations = db.prepare(`
      SELECT d.*, u.name AS donor_name, dp.pickup_address
      FROM donations d
      JOIN users u ON d.donor_id = u.id
      LEFT JOIN donor_profiles dp ON d.donor_id = dp.user_id
      WHERE d.donor_id = ?
      ORDER BY d.created_at DESC
    `).all(donorId);

    const now = Date.now();
    let totalAvailableQuantity = 0;
    let availableCount = 0;
    let reservedCount = 0;
    let expiryAlertsCount = 0;

    const mappedDonations = rawDonations.map(d => {
      const remainingMs = new Date(d.safe_until).getTime() - now;
      const remainingMinutes = Math.max(0, Math.floor(remainingMs / (60 * 1000)));
      const isExpired = remainingMs <= 0 || d.status === 'EXPIRED';

      if (d.status === 'AVAILABLE' && d.available_quantity > 0) {
        availableCount++;
        totalAvailableQuantity += d.available_quantity;
      }
      if (d.status === 'RESERVED' || d.available_quantity < d.total_quantity) {
        reservedCount++;
      }
      if (!isExpired && remainingMinutes < 45 && d.available_quantity > 0) {
        expiryAlertsCount++;
      }

      return {
        ...d,
        mealName: d.name,
        imageUrl: d.image_url,
        isVegetarian: d.veg_type === 'veg',
        foodCategory: d.category,
        totalQuantity: d.total_quantity,
        availableQuantity: d.available_quantity,
        reservedQuantity: d.reserved_quantity,
        safeUseDeadline: d.safe_until,
        pickupAddress: d.pickup_address || 'FC Road, Shivaji Nagar, Pune',
        isExpired,
        remainingMinutes
      };
    });

    // Fetch active requests / deliveries for this donor's donations
    const activeReqRows = db.prepare(`
      SELECT r.*, d.name AS meal_name, d.safe_until, d.pickup_lat, d.pickup_lng,
             dp.pickup_address,
             u_rec.name AS receiver_name, rp.address AS receiver_address,
             rp.lat AS receiver_lat, rp.lng AS receiver_lng
      FROM requests r
      JOIN donations d ON r.donation_id = d.id
      LEFT JOIN donor_profiles dp ON d.donor_id = dp.user_id
      JOIN users u_rec ON r.receiver_id = u_rec.id
      LEFT JOIN receiver_profiles rp ON r.receiver_id = rp.user_id
      WHERE d.donor_id = ?
      ORDER BY r.created_at DESC
    `).all(donorId);

    let pickupsInProgress = 0;
    let completedDeliveries = 0;

    const activeRequests = activeReqRows.map(reqItem => {
      const assignments = db.prepare(`
        SELECT a.*, u.name AS rider_name, u.phone AS rider_phone,
               rp.vehicle_type, rp.max_capacity, rp.current_lat, rp.current_lng
        FROM assignments a
        LEFT JOIN users u ON a.rider_id = u.id
        LEFT JOIN rider_profiles rp ON a.rider_id = rp.user_id
        WHERE a.request_id = ?
      `).all(reqItem.id);

      const firstAssign = assignments[0];
      const status = firstAssign?.status || reqItem.status;

      if (['ASSIGNED', 'HEADING_TO_PICKUP', 'PICKED_UP', 'IN_TRANSIT'].includes(status)) {
        pickupsInProgress++;
      }
      if (status === 'DELIVERED') {
        completedDeliveries++;
      }

      let redirectHistory = [];
      if (firstAssign?.redirect_reason) {
        redirectHistory.push({ reason: firstAssign.redirect_reason });
      }

      return {
        ...reqItem,
        mealName: reqItem.meal_name,
        quantityRequested: reqItem.requested_quantity,
        assignedRiderId: firstAssign?.rider_id || null,
        assignedRiderName: firstAssign?.rider_name || null,
        riderVehicle: firstAssign?.vehicle_type || 'Two-Wheeler',
        assignmentStatus: status,
        pickupETA: 10,
        deliveryETA: 15,
        pickupAddress: reqItem.pickup_address || 'Pune Central',
        receiverAddress: reqItem.receiver_address || 'Shelter Location',
        pickupLat: reqItem.pickup_lat || 18.5284,
        pickupLng: reqItem.pickup_lng || 73.8425,
        receiverLat: reqItem.receiver_lat || 18.5204,
        receiverLng: reqItem.receiver_lng || 73.8567,
        currentLat: firstAssign?.current_lat || reqItem.pickup_lat || 18.5284,
        currentLng: firstAssign?.current_lng || reqItem.pickup_lng || 73.8425,
        redirectHistory,
        deliveryNotes: firstAssign?.redirect_reason ? `Rerouted: ${firstAssign.redirect_reason}` : ''
      };
    });

    const stats = {
      totalCreated: mappedDonations.length,
      totalAvailableQuantity,
      availableDonations: availableCount,
      reservedDonations: reservedCount,
      pickupsInProgress,
      completedDeliveries,
      expiryAlertsCount
    };

    res.json({
      stats,
      donations: mappedDonations,
      activeRequests
    });
  } catch (err) {
    console.error('Error fetching donor stats:', err);
    res.status(500).json({ error: 'Failed to fetch donor dashboard stats.' });
  }
});

// POST /api/donations (Donor only: configurable safe_until, NEVER fixed duration)
router.post('/', authenticate, requireRole('donor'), (req, res) => {
  try {
    const name = req.body.name || req.body.mealName;
    const total_quantity = req.body.total_quantity || req.body.totalQuantity || req.body.servingsCount;
    const category = req.body.category || req.body.foodCategory || 'cooked_meals';
    const veg_type = req.body.veg_type || (req.body.isVegetarian === false ? 'non-veg' : 'veg');
    const description = req.body.description || '';
    const unit = req.body.unit || 'servings';
    const safe_until = req.body.safe_until;
    const safe_use_hours = req.body.safe_use_hours || req.body.safeUseHours;
    const storage_requirements = req.body.storage_requirements || req.body.storageRequirements || 'hot_insulated';
    const handling_instructions = req.body.handling_instructions || req.body.handlingInstructions || '';
    const requires_cooking = req.body.requires_cooking || false;
    const requires_clean_water = req.body.requires_clean_water || false;
    const item_type = req.body.item_type || (category === 'cooked_meals' ? 'cooked' : 'packaged');
    const image_url = req.body.image_url || req.body.imageUrl;
    const pickup_lat = req.body.pickup_lat || req.body.pickupLat;
    const pickup_lng = req.body.pickup_lng || req.body.pickupLng;

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

    const newDonation = db.prepare(`
      SELECT d.*, u.name AS donor_name, dp.pickup_address
      FROM donations d
      JOIN users u ON d.donor_id = u.id
      LEFT JOIN donor_profiles dp ON d.donor_id = dp.user_id
      WHERE d.id = ?
    `).get(donationId);

    const mappedNewDonation = {
      ...newDonation,
      mealName: newDonation.name,
      imageUrl: newDonation.image_url,
      isVegetarian: newDonation.veg_type === 'veg',
      foodCategory: newDonation.category,
      totalQuantity: newDonation.total_quantity,
      availableQuantity: newDonation.available_quantity,
      reservedQuantity: newDonation.reserved_quantity,
      safeUseDeadline: newDonation.safe_until,
      pickupAddress: newDonation.pickup_address || 'FC Road, Shivaji Nagar, Pune',
      isExpired: false,
      remainingMinutes: Math.max(0, Math.floor((safeUntilDate.getTime() - Date.now()) / (60 * 1000)))
    };

    // Socket.IO broadcast
    const io = req.app.get('io');
    if (io) {
      io.emit('donation.created', { donation: mappedNewDonation });
    }

    return res.status(201).json({
      message: 'Donation successfully published to receiver and rider network!',
      donation: mappedNewDonation
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
