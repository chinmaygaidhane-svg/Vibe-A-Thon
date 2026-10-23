import express from 'express';
import { db, calculateDistanceKm, estimateTravelTimeMinutes } from '../database.js';
import { authenticateToken, requireRole } from '../auth.js';

const router = express.Router();

// Helper to broadcast changes via WebSocket (attached to app)
function broadcastUpdate(req, event, data) {
  if (req.app.get('broadcast')) {
    req.app.get('broadcast')({ event, data, timestamp: new Date().toISOString() });
  }
}

// GET all donations (with distance & safety calculations tailored to requesting receiver)
router.get('/', authenticateToken, (req, res) => {
  const { category, search, vegOnly, maxDistance, sort } = req.query;
  const now = Date.now();
  let donations = db.getDonations();

  // If receiver is querying, calculate distances and feasibility
  const isReceiver = req.user.role === 'receiver';
  const receiver = isReceiver ? db.getUserById(req.user.id) : null;

  let enriched = donations.map(don => {
    const deadlineTime = new Date(don.safeUseDeadline).getTime();
    const remainingMs = deadlineTime - now;
    const remainingMinutes = Math.max(0, Math.floor(remainingMs / (60 * 1000)));
    const isExpired = remainingMs <= 0;

    let distanceKm = 2.5;
    let travelTimeMins = 15;
    let isFeasible = true;
    let incompatibilityReason = null;

    if (receiver && receiver.lat && receiver.lng && don.pickupLat && don.pickupLng) {
      distanceKm = calculateDistanceKm(receiver.lat, receiver.lng, don.pickupLat, don.pickupLng);
      travelTimeMins = estimateTravelTimeMinutes(distanceKm);

      // Check travel time against remaining safe window
      if (remainingMinutes < travelTimeMins) {
        isFeasible = false;
        incompatibilityReason = `Cannot safely reach receiver in time. Estimated transit is ${travelTimeMins} mins, but only ${remainingMinutes} mins remain before safe-use deadline.`;
      }

      // Check facility compatibility
      if (don.foodCategory === 'raw_rations' && !receiver.cookingFacilities) {
        isFeasible = false;
        incompatibilityReason = `Incompatible: Shelter does not have active cooking facilities required for raw ration kits.`;
      }

      if (
        (don.storageRequirements === 'refrigerated' || don.storageRequirements === 'frozen') &&
        (!receiver.foodHandlingCapabilities || !receiver.foodHandlingCapabilities.includes('cold_storage'))
      ) {
        isFeasible = false;
        incompatibilityReason = `Incompatible: Requires cold storage facilities not present at this shelter.`;
      }
    }

    return {
      ...don,
      distanceKm,
      travelTimeMins,
      remainingMinutes,
      isExpired,
      isFeasible,
      incompatibilityReason
    };
  });

  // Filters
  if (category && category !== 'all') {
    enriched = enriched.filter(d => d.foodCategory === category);
  }

  if (vegOnly === 'true') {
    enriched = enriched.filter(d => d.isVegetarian);
  }

  if (search) {
    const q = search.toLowerCase();
    enriched = enriched.filter(
      d =>
        d.mealName.toLowerCase().includes(q) ||
        d.donorName.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
    );
  }

  if (maxDistance && !isNaN(parseFloat(maxDistance))) {
    const distLimit = parseFloat(maxDistance);
    enriched = enriched.filter(d => d.distanceKm <= distLimit);
  }

  // Sorting
  if (sort === 'urgent') {
    // Sort urgent feasible donations ahead of less urgent options
    enriched.sort((a, b) => {
      if (a.isFeasible && !b.isFeasible) return -1;
      if (!a.isFeasible && b.isFeasible) return 1;
      return a.remainingMinutes - b.remainingMinutes;
    });
  } else if (sort === 'distance') {
    enriched.sort((a, b) => a.distanceKm - b.distanceKm);
  } else if (sort === 'quantity') {
    enriched.sort((a, b) => b.availableQuantity - a.availableQuantity);
  } else {
    // Default: feasible urgent first, then newest
    enriched.sort((a, b) => {
      if (a.isFeasible && !b.isFeasible) return -1;
      if (!a.isFeasible && b.isFeasible) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  res.json({ donations: enriched });
});

// GET donor's dashboard statistics & live active items
router.get('/donor/dashboard-stats', authenticateToken, requireRole(['donor']), (req, res) => {
  const donorId = req.user.id;
  const allDonations = db.getDonations().filter(d => d.donorId === donorId);
  const allRequests = db.getRequests().filter(r => r.donorId === donorId);

  const now = Date.now();
  let totalCreated = allDonations.length;
  let totalAvailableQuantity = 0;
  let availableDonations = 0;
  let reservedDonations = 0;
  let pickupsInProgress = 0;
  let completedDeliveries = 0;
  let expiryAlertsCount = 0;

  allDonations.forEach(d => {
    totalAvailableQuantity += d.availableQuantity;
    if (d.availableQuantity > 0 && d.status === 'AVAILABLE') availableDonations++;
    if (d.status === 'PARTIALLY_RESERVED' || d.status === 'FULLY_RESERVED') reservedDonations++;

    const deadline = new Date(d.safeUseDeadline).getTime();
    const remainingMins = (deadline - now) / (60 * 1000);
    if (remainingMins > 0 && remainingMins <= 45 && d.availableQuantity > 0) {
      expiryAlertsCount++;
    }
  });

  allRequests.forEach(r => {
    if (r.assignmentStatus === 'RIDER_GOING_TO_PICKUP' || r.assignmentStatus === 'ASSIGNED') {
      pickupsInProgress++;
    }
    if (r.assignmentStatus === 'DELIVERED') {
      completedDeliveries++;
    }
  });

  res.json({
    stats: {
      totalCreated,
      totalAvailableQuantity,
      availableDonations,
      reservedDonations,
      pickupsInProgress,
      completedDeliveries,
      expiryAlertsCount
    },
    donations: allDonations,
    activeRequests: allRequests.filter(r => r.assignmentStatus !== 'DELIVERED' && r.assignmentStatus !== 'CANCELLED')
  });
});

// POST Create Donation (Donor only)
router.post('/', authenticateToken, requireRole(['donor']), (req, res) => {
  try {
    const {
      mealName,
      foodCategory,
      isVegetarian,
      description,
      totalQuantity,
      servingsCount,
      preparedAt,
      safeUseHours,
      safeUseDeadline,
      pickupAddress,
      pickupLat,
      pickupLng,
      storageRequirements,
      handlingInstructions,
      imageUrl
    } = req.body;

    if (!mealName || !totalQuantity) {
      return res.status(400).json({ error: 'Meal name and quantity are required.' });
    }

    const qty = parseInt(totalQuantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Valid total quantity number is required.' });
    }

    const now = Date.now();
    let calculatedDeadline;
    if (safeUseDeadline) {
      calculatedDeadline = new Date(safeUseDeadline).toISOString();
    } else {
      const hours = parseFloat(safeUseHours) || 2.5;
      calculatedDeadline = new Date(now + hours * 3600 * 1000).toISOString();
    }

    const donorUser = db.getUserById(req.user.id);
    const donationId = `don-${Date.now()}`;

    // Curated high quality food images fallback if none provided
    let fallbackImg = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80';
    if (foodCategory === 'bakery_packaged') {
      fallbackImg = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop&q=80';
    } else if (foodCategory === 'raw_rations') {
      fallbackImg = 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop&q=80';
    } else if (isVegetarian) {
      fallbackImg = 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80';
    }

    const newDonation = {
      id: donationId,
      donorId: req.user.id,
      donorName: donorUser.name,
      donorCategory: donorUser.donorCategory || 'Restaurant',
      mealName: mealName.trim(),
      foodCategory: foodCategory || 'cooked_meals',
      isVegetarian: isVegetarian !== undefined ? Boolean(isVegetarian) : true,
      description: description || 'Nutritious surplus meal packed hygienically.',
      totalQuantity: qty,
      availableQuantity: qty,
      reservedQuantity: 0,
      deliveredQuantity: 0,
      servingsCount: parseInt(servingsCount) || qty,
      preparedAt: preparedAt ? new Date(preparedAt).toISOString() : new Date().toISOString(),
      createdAt: new Date().toISOString(),
      safeUseDeadline: calculatedDeadline,
      pickupAddress: pickupAddress || donorUser.pickupAddress || 'Pune, Maharashtra',
      pickupLat: parseFloat(pickupLat) || donorUser.lat || 18.5284,
      pickupLng: parseFloat(pickupLng) || donorUser.lng || 73.8425,
      storageRequirements: storageRequirements || 'hot_insulated',
      handlingInstructions: handlingInstructions || 'Transport in insulated containers.',
      imageUrl: imageUrl && imageUrl.trim().length > 5 ? imageUrl.trim() : fallbackImg,
      status: 'AVAILABLE'
    };

    db.addDonation(newDonation);
    db.addAuditLog('DONATION_CREATED', `${donorUser.name} created donation: ${newDonation.mealName} (${qty} servings)`, {
      donationId: newDonation.id,
      deadline: newDonation.safeUseDeadline
    });

    db.addNotification({
      role: 'receiver',
      userId: 'all',
      type: 'NEW_DONATION',
      title: 'New Food Donation Available!',
      message: `${donorUser.name} posted ${qty} servings of ${newDonation.mealName}. Check your feed!`
    });

    broadcastUpdate(req, 'DONATION_CREATED', newDonation);

    return res.status(201).json({
      message: 'Donation created successfully and broadcast to all receivers!',
      donation: newDonation
    });
  } catch (err) {
    console.error('Error creating donation:', err);
    return res.status(500).json({ error: 'Failed to create donation.' });
  }
});

// GET single donation details
router.get('/:id', authenticateToken, (req, res) => {
  const don = db.getDonationById(req.params.id);
  if (!don) {
    return res.status(404).json({ error: 'Donation not found.' });
  }
  res.json({ donation: don });
});

export default router;
