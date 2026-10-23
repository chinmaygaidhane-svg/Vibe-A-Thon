import express from 'express';
import { db, calculateDistanceKm, estimateTravelTimeMinutes } from '../database.js';
import { authenticateToken } from '../auth.js';

const router = express.Router();

function broadcastUpdate(req, event, data) {
  if (req.app.get('broadcast')) {
    req.app.get('broadcast')({ event, data, timestamp: new Date().toISOString() });
  }
}

// Linear interpolation between two coordinates
function interpolate(p1, p2, ratio) {
  return p1 + (p2 - p1) * ratio;
}

// 1. Advance Rider Along Route
router.post('/advance-rider', (req, res) => {
  const { requestId, progressPercent } = req.body;
  const requests = db.getRequests();
  const request = requestId
    ? db.getRequestById(requestId)
    : requests.find(r => r.assignmentStatus === 'IN_TRANSIT' || r.assignmentStatus === 'RIDER_GOING_TO_PICKUP' || r.assignmentStatus === 'PICKED_UP');

  if (!request) {
    return res.status(404).json({ error: 'No active delivery found to advance.' });
  }

  // Calculate new step
  let step = progressPercent !== undefined ? parseInt(progressPercent) : (request.simulationStep || 0) + 25;
  if (step > 100) step = 100;

  const ratio = step / 100;
  const newLat = interpolate(request.pickupLat, request.receiverLat, ratio);
  const newLng = interpolate(request.pickupLng, request.receiverLng, ratio);

  let newStatus = request.assignmentStatus;
  let remainingMins = Math.max(1, Math.round(request.deliveryETA * (1 - ratio)));

  if (step >= 20 && step < 40 && request.assignmentStatus === 'RIDER_GOING_TO_PICKUP') {
    newStatus = 'PICKED_UP';
  } else if (step >= 40 && step < 100) {
    newStatus = 'IN_TRANSIT';
  } else if (step === 100) {
    newStatus = 'DELIVERED';
    remainingMins = 0;
  }

  const updates = {
    simulationStep: step,
    currentRiderLat: parseFloat(newLat.toFixed(5)),
    currentRiderLng: parseFloat(newLng.toFixed(5)),
    deliveryETA: remainingMins,
    assignmentStatus: newStatus,
    status: newStatus
  };

  if (step >= 75 && step < 100) {
    db.addNotification({
      role: 'receiver',
      userId: request.receiverId,
      type: 'RIDER_NEARBY',
      title: 'Rider is Approaching!',
      message: `${request.assignedRiderName || 'Volunteer Rider'} is less than 3 minutes away with ${request.mealName}.`
    });
  }

  const updatedReq = db.updateRequest(request.id, updates);

  // Also update rider's user location
  if (request.assignedRiderId) {
    db.updateUser(request.assignedRiderId, {
      currentLat: updates.currentRiderLat,
      currentLng: updates.currentRiderLng
    });
  }

  db.addAuditLog('RIDER_SIMULATION_ADVANCED', `Rider advanced to ${step}% along route for Request #${request.id}`, {
    requestId: request.id,
    step,
    lat: updates.currentRiderLat,
    lng: updates.currentRiderLng
  });

  broadcastUpdate(req, 'REQUEST_UPDATED', updatedReq);

  res.json({
    message: `Rider advanced to ${step}% progress!`,
    request: updatedReq
  });
});

// 2. Ghost Reservation Timeout Simulation
router.post('/trigger-ghost-timeout', (req, res) => {
  const { requestId } = req.body;
  const requests = db.getRequests();

  // Find a pending/assigned reservation that hasn't been picked up yet
  const request = requestId
    ? db.getRequestById(requestId)
    : requests.find(r => r.assignmentStatus === 'AWAITING_RIDER' || r.assignmentStatus === 'ASSIGNED' || r.assignmentStatus === 'RIDER_GOING_TO_PICKUP');

  if (!request) {
    return res.status(404).json({ error: 'No uncollected reservation found to timeout.' });
  }

  // Safety rule: NEVER release cargo already collected by a rider
  if (request.assignmentStatus === 'PICKED_UP' || request.assignmentStatus === 'IN_TRANSIT' || request.assignmentStatus === 'DELIVERED') {
    return res.status(400).json({
      error: 'CRITICAL SAFETY VIOLATION PREVENTED: Cannot release reservation! Food has already been collected by the rider.'
    });
  }

  // Release reservation and return quantity to donor
  const donation = db.getDonationById(request.donationId);
  if (donation) {
    const restoredAvailable = donation.availableQuantity + request.quantityRequested;
    const reducedReserved = Math.max(0, donation.reservedQuantity - request.quantityRequested);
    db.updateDonation(donation.id, {
      availableQuantity: restoredAvailable,
      reservedQuantity: reducedReserved,
      status: restoredAvailable > 0 ? 'AVAILABLE' : donation.status
    });
  }

  // Try to find another eligible rider or mark cancelled
  const updatedReq = db.updateRequest(request.id, {
    assignmentStatus: 'CANCELLED_TIMEOUT',
    status: 'TIMEOUT_RELEASED',
    deliveryNotes: 'Ghost reservation timeout detected. Rider was unresponsive before pickup; reserved quantity returned to donor feed.'
  });

  db.addAuditLog('GHOST_RESERVATION_TIMEOUT', `Ghost reservation timeout for Request #${request.id}. Released ${request.quantityRequested} servings back to donor.`, {
    requestId: request.id,
    donationId: request.donationId
  });

  db.addNotification({
    role: 'donor',
    userId: request.donorId,
    type: 'TIMEOUT_RECOVERY',
    title: 'Ghost Reservation Released',
    message: `Rider was unresponsive. ${request.quantityRequested} servings of ${request.mealName} have been restored to your available donation pool.`
  });

  db.addNotification({
    role: 'receiver',
    userId: request.receiverId,
    type: 'TIMEOUT_ALERT',
    title: 'Reservation Timeout',
    message: `Delivery for ${request.mealName} timed out before collection. You may request from available feed.`
  });

  broadcastUpdate(req, 'RESERVATION_TIMED_OUT', {
    request: updatedReq,
    donation: db.getDonationById(request.donationId)
  });

  res.json({
    message: `Ghost reservation detected and released successfully! Restored ${request.quantityRequested} servings to donor pool.`,
    request: updatedReq
  });
});

// 3. Receiver Demand Change & In-Transit Redirection (Step 8 Scenario)
router.post('/trigger-demand-change', (req, res) => {
  const { requestId, reason } = req.body;
  const requests = db.getRequests();

  // Find an active in-transit request
  const request = requestId
    ? db.getRequestById(requestId)
    : requests.find(r => r.assignmentStatus === 'IN_TRANSIT' || r.assignmentStatus === 'PICKED_UP');

  if (!request) {
    return res.status(404).json({ error: 'No in-transit delivery found to redirect.' });
  }

  const originalReceiverId = request.receiverId;
  const originalReceiverName = request.receiverName;

  // Search for an alternative compatible receiver in database
  const allReceivers = db.getUsers().filter(u => u.role === 'receiver' && u.id !== originalReceiverId);

  // Filter compatible shelters with remaining demand and facilities
  const now = Date.now();
  const deadlineTime = new Date(request.safeUseDeadline).getTime();
  const remainingSafeMins = Math.floor((deadlineTime - now) / (60 * 1000));

  let eligibleAlternative = null;
  let candidateReason = '';

  for (const shelter of allReceivers) {
    const distFromRider = calculateDistanceKm(
      request.currentRiderLat || request.pickupLat,
      request.currentRiderLng || request.pickupLng,
      shelter.lat,
      shelter.lng
    );
    const newTransitMins = estimateTravelTimeMinutes(distFromRider);

    // Check deadline
    if (newTransitMins > remainingSafeMins) {
      continue;
    }

    // Check cooking facility if raw rations
    if (request.foodCategory === 'raw_rations' && !shelter.cookingFacilities) {
      continue;
    }

    // Candidate found!
    eligibleAlternative = shelter;
    candidateReason = `Shelter has active demand (${shelter.currentDemand || 45} servings), compatible facilities, and is within safe delivery range (${distFromRider} km, ~${newTransitMins} mins).`;
    break;
  }

  if (!eligibleAlternative) {
    db.addAuditLog('REDIRECTION_FAILED', `No feasible alternative shelter found for in-transit delivery #${request.id}`, {
      requestId: request.id
    });
    return res.status(409).json({
      error: 'URGENT RECOVERY ALERT: No compatible shelter found within the remaining safety deadline window.'
    });
  }

  const newDistance = calculateDistanceKm(
    request.currentRiderLat || request.pickupLat,
    request.currentRiderLng || request.pickupLng,
    eligibleAlternative.lat,
    eligibleAlternative.lng
  );
  const newDeliveryETA = estimateTravelTimeMinutes(newDistance);

  // Update request with redirection
  const redirectEntry = {
    fromReceiverId: originalReceiverId,
    fromReceiverName: originalReceiverName,
    toReceiverId: eligibleAlternative.id,
    toReceiverName: eligibleAlternative.name,
    reason: reason || 'Original shelter requirement satisfied by an alternative donation in Pune area.',
    timestamp: new Date().toISOString()
  };

  const updatedReq = db.updateRequest(request.id, {
    receiverId: eligibleAlternative.id,
    receiverName: eligibleAlternative.name,
    receiverAddress: eligibleAlternative.address,
    receiverLat: eligibleAlternative.lat,
    receiverLng: eligibleAlternative.lng,
    deliveryETA: newDeliveryETA,
    distanceKm: newDistance,
    redirectHistory: [...(request.redirectHistory || []), redirectEntry],
    deliveryNotes: `IN-TRANSIT REDIRECTED: Sent to ${eligibleAlternative.name} because ${originalReceiverName}'s demand was fulfilled.`
  });

  db.addAuditLog('DELIVERY_REDIRECTED', `In-transit delivery #${request.id} dynamically redirected from ${originalReceiverName} to ${eligibleAlternative.name}`, {
    requestId: request.id,
    newReceiver: eligibleAlternative.name,
    candidateReason
  });

  // Notifications
  db.addNotification({
    role: 'rider',
    userId: request.assignedRiderId,
    type: 'DELIVERY_REDIRECTED',
    title: '⚠️ Route Update: Delivery Redirected!',
    message: `${originalReceiverName} demand was fulfilled. You have been rerouted to ${eligibleAlternative.name} (${eligibleAlternative.address}). ETA ~${newDeliveryETA} mins.`
  });

  db.addNotification({
    role: 'receiver',
    userId: originalReceiverId,
    type: 'DEMAND_SATISFIED',
    title: 'Demand Fulfilled',
    message: `Your requirement has been marked satisfied. Food has been safely rerouted to another shelter in need.`
  });

  db.addNotification({
    role: 'receiver',
    userId: eligibleAlternative.id,
    type: 'INCOMING_REDIRECT',
    title: 'Surprise Meal Coming Your Way!',
    message: `${request.quantityRequested} servings of ${request.mealName} rerouted to your shelter. ETA ~${newDeliveryETA} mins!`
  });

  db.addNotification({
    role: 'donor',
    userId: request.donorId,
    type: 'DELIVERY_REDIRECTED',
    title: 'Beneficiary Update',
    message: `Your donation was seamlessly rerouted to ${eligibleAlternative.name} to avoid food waste.`
  });

  broadcastUpdate(req, 'REQUEST_REDIRECTED', {
    request: updatedReq,
    alternative: eligibleAlternative
  });

  res.json({
    message: `Dynamic redirection successful! Rerouted rider to ${eligibleAlternative.name}.`,
    request: updatedReq,
    newReceiver: eligibleAlternative
  });
});

// 4. Reset Demo State
router.post('/reset-demo', (req, res) => {
  const freshData = db.reset();
  broadcastUpdate(req, 'DEMO_RESET', {});
  db.addAuditLog('DEMO_RESET', 'Demonstration data was reset to pristine hackathon initial state.');
  res.json({ message: 'AidFlow AI demo data reset to clean initial state!', data: freshData });
});

export default router;
