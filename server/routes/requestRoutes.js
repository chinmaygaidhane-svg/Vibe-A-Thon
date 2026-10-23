import express from 'express';
import { db, calculateDistanceKm, estimateTravelTimeMinutes } from '../database.js';
import { authenticateToken, requireRole } from '../auth.js';

const router = express.Router();

function broadcastUpdate(req, event, data) {
  if (req.app.get('broadcast')) {
    req.app.get('broadcast')({ event, data, timestamp: new Date().toISOString() });
  }
}

// GET all requests (filtered by user role for privacy & RBAC)
router.get('/', authenticateToken, (req, res) => {
  const { role, id } = req.user;
  let requests = db.getRequests();

  if (role === 'donor') {
    requests = requests.filter(r => r.donorId === id);
  } else if (role === 'receiver') {
    requests = requests.filter(r => r.receiverId === id);
  } else if (role === 'rider') {
    // Rider can see their own assigned requests or open available requests
    requests = requests.filter(r => r.assignedRiderId === id || !r.assignedRiderId);
  }

  res.json({ requests });
});

// GET single request
router.get('/:id', authenticateToken, (req, res) => {
  const request = db.getRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  // RBAC: Only authorized donor, receiver, or rider can view
  const user = req.user;
  if (
    user.role !== 'admin' &&
    request.donorId !== user.id &&
    request.receiverId !== user.id &&
    request.assignedRiderId !== user.id &&
    !(user.role === 'rider' && !request.assignedRiderId)
  ) {
    return res.status(403).json({ error: 'Unauthorized to view this delivery request.' });
  }

  res.json({ request });
});

// POST Receiver creates donation request
router.post('/', authenticateToken, requireRole(['receiver']), (req, res) => {
  try {
    const { donationId, requestedQuantity } = req.body;
    const receiver = db.getUserById(req.user.id);

    if (!donationId || !requestedQuantity) {
      return res.status(400).json({ error: 'Donation ID and requested quantity are required.' });
    }

    const qty = parseInt(requestedQuantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Valid requested quantity is required.' });
    }

    const donation = db.getDonationById(donationId);
    if (!donation) {
      return res.status(404).json({ error: 'Donation not found.' });
    }

    const now = Date.now();
    const deadlineTime = new Date(donation.safeUseDeadline).getTime();
    if (deadlineTime <= now) {
      return res.status(400).json({ error: 'Safety deadline has expired for this donation. Request rejected.' });
    }

    // Check available quantity (anti-overallocation)
    if (donation.availableQuantity < qty) {
      return res.status(400).json({
        error: `Requested quantity (${qty}) exceeds remaining available quantity (${donation.availableQuantity}).`
      });
    }

    // Facility Compatibility Check
    if (donation.foodCategory === 'raw_rations' && !receiver.cookingFacilities) {
      return res.status(400).json({
        error: 'Incompatible donation: Your shelter lacks active cooking facilities required for raw ration kits.'
      });
    }

    if (
      (donation.storageRequirements === 'refrigerated' || donation.storageRequirements === 'frozen') &&
      (!receiver.foodHandlingCapabilities || !receiver.foodHandlingCapabilities.includes('cold_storage'))
    ) {
      return res.status(400).json({
        error: 'Incompatible donation: Cold storage facilities are required for this perishable item.'
      });
    }

    // Distance and travel feasibility
    const distanceKm = calculateDistanceKm(
      receiver.lat || 18.5362,
      receiver.lng || 73.8940,
      donation.pickupLat || 18.5284,
      donation.pickupLng || 73.8425
    );
    const travelTimeMins = estimateTravelTimeMinutes(distanceKm);
    const remainingSafeMins = Math.floor((deadlineTime - now) / (60 * 1000));

    if (remainingSafeMins < travelTimeMins) {
      return res.status(400).json({
        error: `Feasibility check failed: Delivery estimated at ${travelTimeMins} mins, but only ${remainingSafeMins} mins remain before safe-use deadline.`
      });
    }

    // Check receiver capacity
    if (receiver.storageCapacity && qty > receiver.storageCapacity) {
      return res.status(400).json({
        error: `Requested quantity exceeds your shelter's storage capacity (${receiver.storageCapacity} servings).`
      });
    }

    // Reserve quantity
    const newAvailable = donation.availableQuantity - qty;
    const newReserved = donation.reservedQuantity + qty;
    const newDonationStatus = newAvailable === 0 ? 'FULLY_RESERVED' : 'PARTIALLY_RESERVED';

    db.updateDonation(donation.id, {
      availableQuantity: newAvailable,
      reservedQuantity: newReserved,
      status: newDonationStatus
    });

    // Find eligible rider
    const riders = db.getUsers().filter(u => u.role === 'rider' && u.availability === 'AVAILABLE');
    const eligibleRider = riders.find(r => r.maxCapacity >= qty) || riders[0] || null;

    const requestId = `req-${Date.now()}`;
    const newRequest = {
      id: requestId,
      donationId: donation.id,
      mealName: donation.mealName,
      foodCategory: donation.foodCategory,
      donorId: donation.donorId,
      donorName: donation.donorName,
      pickupAddress: donation.pickupAddress,
      pickupLat: donation.pickupLat,
      pickupLng: donation.pickupLng,
      receiverId: receiver.id,
      receiverName: receiver.name,
      receiverAddress: receiver.address,
      receiverLat: receiver.lat,
      receiverLng: receiver.lng,
      quantityRequested: qty,
      safeUseDeadline: donation.safeUseDeadline,
      distanceKm,
      pickupETA: travelTimeMins > 10 ? 8 : 5,
      deliveryETA: travelTimeMins,
      status: eligibleRider ? 'ASSIGNED' : 'REQUESTED',
      assignmentStatus: eligibleRider ? 'ASSIGNED' : 'AWAITING_RIDER',
      assignedRiderId: eligibleRider ? eligibleRider.id : null,
      assignedRiderName: eligibleRider ? eligibleRider.name : null,
      riderVehicle: eligibleRider ? eligibleRider.vehicleType : null,
      currentRiderLat: eligibleRider ? eligibleRider.currentLat : donation.pickupLat,
      currentRiderLng: eligibleRider ? eligibleRider.currentLng : donation.pickupLng,
      simulationStep: 0,
      reservedExpiresAt: new Date(now + 15 * 60 * 1000).toISOString(), // 15 min ghost reservation timeout
      requestedAt: new Date().toISOString(),
      receiptConfirmed: false,
      discrepancyReport: null,
      redirectHistory: []
    };

    db.addRequest(newRequest);

    db.addAuditLog('REQUEST_CREATED', `${receiver.name} requested ${qty} servings of ${donation.mealName} from ${donation.donorName}`, {
      requestId: newRequest.id,
      assignedRider: eligibleRider ? eligibleRider.name : 'Awaiting assignment'
    });

    // Notify Donor
    db.addNotification({
      role: 'donor',
      userId: donation.donorId,
      type: 'DONATION_REQUESTED',
      title: 'New Meal Request Received!',
      message: `${receiver.name} has requested ${qty} servings of ${donation.mealName}.`
    });

    // Notify Rider if assigned
    if (eligibleRider) {
      db.addNotification({
        role: 'rider',
        userId: eligibleRider.id,
        type: 'ASSIGNMENT_OFFERED',
        title: 'New Delivery Assignment Available!',
        message: `Pickup ${qty} servings of ${donation.mealName} from ${donation.donorName} for ${receiver.name}.`
      });
    }

    broadcastUpdate(req, 'REQUEST_CREATED', {
      request: newRequest,
      donation: db.getDonationById(donation.id)
    });

    return res.status(201).json({
      message: eligibleRider
        ? `Request accepted! Assigned to ${eligibleRider.name}.`
        : 'Request accepted! Queued for volunteer rider assignment.',
      request: newRequest
    });
  } catch (err) {
    console.error('Error creating request:', err);
    return res.status(500).json({ error: 'Failed to create donation request.' });
  }
});

// POST Rider accepts an assignment
router.post('/:id/accept', authenticateToken, requireRole(['rider']), (req, res) => {
  const request = db.getRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  if (request.assignmentStatus !== 'AWAITING_RIDER' && request.assignmentStatus !== 'ASSIGNED') {
    return res.status(400).json({ error: `Cannot accept assignment with status '${request.assignmentStatus}'.` });
  }

  const rider = db.getUserById(req.user.id);
  if (rider.maxCapacity < request.quantityRequested) {
    return res.status(400).json({
      error: `Assignment exceeds your vehicle's maximum carrying capacity (${rider.maxCapacity} servings).`
    });
  }

  // Update request
  const updatedReq = db.updateRequest(request.id, {
    assignedRiderId: rider.id,
    assignedRiderName: rider.name,
    riderVehicle: rider.vehicleType,
    assignmentStatus: 'RIDER_GOING_TO_PICKUP',
    status: 'GOING_TO_PICKUP',
    currentRiderLat: rider.currentLat || request.pickupLat,
    currentRiderLng: rider.currentLng || request.pickupLng
  });

  // Mark rider status busy
  db.updateUser(rider.id, { availability: 'ON_DELIVERY' });

  db.addAuditLog('RIDER_ACCEPTED', `${rider.name} accepted delivery #${request.id} for ${request.mealName}`, {
    requestId: request.id
  });

  // Notify donor and receiver
  db.addNotification({
    role: 'donor',
    userId: request.donorId,
    type: 'RIDER_ASSIGNED',
    title: 'Rider On The Way For Pickup',
    message: `${rider.name} accepted the pickup for ${request.mealName} (ETA ~${request.pickupETA} mins).`
  });

  db.addNotification({
    role: 'receiver',
    userId: request.receiverId,
    type: 'RIDER_ASSIGNED',
    title: 'Rider Assigned To Your Request',
    message: `${rider.name} is heading to ${request.donorName} to collect your meal.`
  });

  broadcastUpdate(req, 'REQUEST_UPDATED', updatedReq);

  res.json({ message: 'Assignment accepted! Please head to the donor pickup location.', request: updatedReq });
});

// POST Update delivery status: 'going_to_pickup' | 'picked_up' | 'in_transit' | 'delivered'
router.post('/:id/status', authenticateToken, requireRole(['rider']), (req, res) => {
  const { status } = req.body;
  const request = db.getRequestById(req.params.id);

  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  if (request.assignedRiderId !== req.user.id) {
    return res.status(403).json({ error: 'Only the assigned rider can update this delivery status.' });
  }

  const validTransitions = {
    going_to_pickup: 'RIDER_GOING_TO_PICKUP',
    picked_up: 'PICKED_UP',
    in_transit: 'IN_TRANSIT',
    delivered: 'DELIVERED'
  };

  const newStatus = validTransitions[status.toLowerCase()];
  if (!newStatus) {
    return res.status(400).json({ error: `Invalid status '${status}'. Must be one of: going_to_pickup, picked_up, in_transit, delivered.` });
  }

  const updates = {
    assignmentStatus: newStatus,
    status: newStatus
  };

  // Status specific updates
  if (newStatus === 'PICKED_UP') {
    updates.currentRiderLat = request.pickupLat;
    updates.currentRiderLng = request.pickupLng;
    updates.simulationStep = 20;

    // Update donation status
    db.updateDonation(request.donationId, { status: 'PICKED_UP' });

    db.addNotification({
      role: 'donor',
      userId: request.donorId,
      type: 'PICKUP_CONFIRMED',
      title: 'Meal Picked Up!',
      message: `${request.assignedRiderName} has collected the ${request.mealName}.`
    });

    db.addNotification({
      role: 'receiver',
      userId: request.receiverId,
      type: 'PICKUP_CONFIRMED',
      title: 'Meal Collected from Donor!',
      message: `${request.assignedRiderName} picked up your meal from ${request.donorName}. Ready for transit.`
    });
  } else if (newStatus === 'IN_TRANSIT') {
    updates.simulationStep = 40;
    updates.deliveryETA = Math.max(request.deliveryETA - 3, 8);

    db.addNotification({
      role: 'receiver',
      userId: request.receiverId,
      type: 'IN_TRANSIT',
      title: 'Delivery In Transit!',
      message: `${request.assignedRiderName} is driving towards your location with the food.`
    });
  } else if (newStatus === 'DELIVERED') {
    updates.simulationStep = 100;
    updates.currentRiderLat = request.receiverLat;
    updates.currentRiderLng = request.receiverLng;

    // Update donation counters
    const donation = db.getDonationById(request.donationId);
    if (donation) {
      const remainingReserved = Math.max(0, donation.reservedQuantity - request.quantityRequested);
      const newDelivered = donation.deliveredQuantity + request.quantityRequested;
      db.updateDonation(donation.id, {
        reservedQuantity: remainingReserved,
        deliveredQuantity: newDelivered,
        status: donation.availableQuantity === 0 && remainingReserved === 0 ? 'DELIVERED' : donation.status
      });
    }

    // Release rider to AVAILABLE
    db.updateUser(req.user.id, { availability: 'AVAILABLE' });

    db.addNotification({
      role: 'receiver',
      userId: request.receiverId,
      type: 'DELIVERED',
      title: 'Donation Delivered!',
      message: `${request.assignedRiderName} has arrived at your destination with ${request.quantityRequested} servings of ${request.mealName}. Please confirm receipt.`
    });

    db.addNotification({
      role: 'donor',
      userId: request.donorId,
      type: 'DELIVERY_COMPLETED',
      title: 'Donation Successfully Delivered!',
      message: `Your donation of ${request.quantityRequested} servings reached ${request.receiverName}.`
    });
  }

  const updatedReq = db.updateRequest(request.id, updates);

  db.addAuditLog('DELIVERY_STATUS_CHANGED', `Request #${request.id} status changed to ${newStatus} by ${req.user.name}`, {
    requestId: request.id,
    newStatus
  });

  broadcastUpdate(req, 'REQUEST_UPDATED', updatedReq);

  res.json({ message: `Status updated to ${newStatus}`, request: updatedReq });
});

// POST Receiver confirms receipt & discrepancy report
router.post('/:id/confirm-receipt', authenticateToken, requireRole(['receiver']), (req, res) => {
  const { discrepancyReport, notes } = req.body;
  const request = db.getRequestById(req.params.id);

  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  if (request.receiverId !== req.user.id) {
    return res.status(403).json({ error: 'Only the receiving shelter can confirm receipt.' });
  }

  const updatedReq = db.updateRequest(request.id, {
    receiptConfirmed: true,
    discrepancyReport: discrepancyReport || null,
    deliveryNotes: notes || 'Received in good condition'
  });

  db.addAuditLog('RECEIPT_CONFIRMED', `${req.user.name} confirmed receipt for delivery #${request.id}`, {
    requestId: request.id,
    discrepancy: discrepancyReport || 'None'
  });

  db.addNotification({
    role: 'donor',
    userId: request.donorId,
    type: 'RECEIPT_CONFIRMED',
    title: 'Receipt Confirmed by Shelter',
    message: `${req.user.name} confirmed receiving ${request.quantityRequested} servings of ${request.mealName}.`
  });

  broadcastUpdate(req, 'REQUEST_UPDATED', updatedReq);

  res.json({ message: 'Receipt confirmed successfully! Thank you for coordinating with AidFlow AI.', request: updatedReq });
});

export default router;
