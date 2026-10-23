import { db, logEvent, createNotification, calculateDistanceKm, estimateTravelTimeMinutes } from '../database.js';
import { checkCompatibility } from './compatibilityService.js';
import { checkFeasibility } from './feasibilityService.js';

/**
 * In-Transit Dynamic Redirection Engine
 * Triggered when a receiver's demand is filled/cancelled while delivery is IN_TRANSIT.
 * Finds candidate receivers from the rider's current computed location.
 */
export function redirectInTransitAssignment({ assignmentId, io = null, reason = 'Original receiver demand fulfilled' }) {
  const asgn = db.prepare(`
    SELECT a.*, d.name AS donation_name, d.safe_until, d.pickup_lat, d.pickup_lng,
           d.requires_cooking, d.requires_clean_water, d.item_type, d.category, d.donor_id,
           u.name AS rider_name, u.phone AS rider_phone,
           rp.current_lat AS rider_lat, rp.current_lng AS rider_lng, rp.vehicle_type,
           rec.name AS original_receiver_name
    FROM assignments a
    JOIN donations d ON a.donation_id = d.id
    JOIN users u ON a.rider_id = u.id
    JOIN rider_profiles rp ON u.id = rp.user_id
    JOIN users rec ON a.destination_receiver_id = rec.id
    WHERE a.id = ?
  `).get(assignmentId);

  if (!asgn) {
    throw new Error('Assignment not found');
  }

  if (asgn.status !== 'IN_TRANSIT') {
    throw new Error(`Cannot redirect: Assignment status is '${asgn.status}', must be 'IN_TRANSIT'.`);
  }

  // Compute rider's current interpolated position along route progress
  const origReceiverProfile = db.prepare('SELECT * FROM receiver_profiles WHERE user_id = ?').get(asgn.destination_receiver_id);
  const startLat = asgn.pickup_lat;
  const startLng = asgn.pickup_lng;
  const endLat = origReceiverProfile ? origReceiverProfile.lat : asgn.pickup_lat;
  const endLng = origReceiverProfile ? origReceiverProfile.lng : asgn.pickup_lng;

  const currentRiderLat = startLat + (endLat - startLat) * (asgn.route_progress || 0.5);
  const currentRiderLng = startLng + (endLng - startLng) * (asgn.route_progress || 0.5);

  // Find candidate receivers (excluding original receiver)
  const candidateReceivers = db.prepare(`
    SELECT u.id, u.name, u.email, rp.*, rd.remaining_demand
    FROM users u
    JOIN receiver_profiles rp ON u.id = rp.user_id
    LEFT JOIN receiver_demand rd ON u.id = rd.receiver_id
    WHERE u.id != ? AND u.role = 'receiver'
  `).all(asgn.destination_receiver_id);

  const now = Date.now();
  const safeUntilMs = new Date(asgn.safe_until).getTime();
  const remainingMinutes = Math.floor((safeUntilMs - now) / (60 * 1000));

  const eligibleCandidates = [];

  for (const cand of candidateReceivers) {
    // 1. Compatibility check
    const compat = checkCompatibility({
      donation: {
        requires_cooking: asgn.requires_cooking,
        requires_clean_water: asgn.requires_clean_water,
        item_type: asgn.item_type
      },
      receiver: cand,
      requestedQuantity: asgn.quantity
    });

    if (!compat.isCompatible) continue;

    // 2. Feasibility from current rider position to candidate
    const distToCandKm = calculateDistanceKm(currentRiderLat, currentRiderLng, cand.lat, cand.lng);
    const etaMins = estimateTravelTimeMinutes(distToCandKm, 25);
    const totalRequiredMins = etaMins + 5; // +5 min buffer

    if (totalRequiredMins <= remainingMinutes) {
      eligibleCandidates.push({
        receiver: cand,
        distanceKm: distToCandKm,
        etaMins,
        remainingMinutes
      });
    }
  }

  // Rank by nearest ETA
  eligibleCandidates.sort((a, b) => a.etaMins - b.etaMins);

  if (eligibleCandidates.length === 0) {
    // No alternative feasible shelter found! Raise URGENT recovery alert!
    logEvent('REDIRECT_FAILED_NO_CANDIDATE', `Redirection failed for assignment ${assignmentId}: No alternative feasible receiver within safety deadline (${remainingMinutes}m).`, {
      assignmentId,
      currentPosition: { lat: currentRiderLat, lng: currentRiderLng },
      remainingMinutes
    });

    createNotification(
      asgn.rider_id,
      '🚨 Urgent: Delivery Destination Cancelled',
      `Original shelter cannot accept cargo. No nearby shelter can receive within safe deadline. Hold cargo and await emergency instructions.`,
      'urgent',
      { assignmentId }
    );

    createNotification(
      asgn.donor_id,
      '🚨 Emergency Cargo Alert',
      `Cargo of ${asgn.quantity} servings (${asgn.donation_name}) in-transit could not be redirected. Safe window expiring soon.`,
      'urgent',
      { assignmentId }
    );

    if (io) {
      io.emit('alert.urgent', {
        title: '🚨 Urgent In-Transit Recovery Required!',
        message: `Delivery ${assignmentId} (${asgn.donation_name}) has no feasible alternate receiver. Safe deadline is critically near!`,
        assignmentId,
        type: 'critical'
      });
    }

    return {
      success: false,
      redirected: false,
      reason: 'No alternative compatible shelter is reachable before the safe-use deadline.',
      candidatesFound: 0
    };
  }

  // Redirect to top ranked candidate
  const chosen = eligibleCandidates[0];
  const newReceiver = chosen.receiver;

  db.prepare(`
    UPDATE assignments
    SET destination_receiver_id = ?,
        redirect_from_receiver_id = ?,
        redirect_reason = ?
    WHERE id = ?
  `).run(newReceiver.id, asgn.destination_receiver_id, reason, assignmentId);

  // Update request record destination
  db.prepare(`
    UPDATE requests
    SET notes = 'Redirected to ' || ?
    WHERE id = ?
  `).run(newReceiver.name, asgn.request_id);

  logEvent('DELIVERY_REDIRECTED', `Assignment ${assignmentId} successfully redirected from ${asgn.original_receiver_name} to ${newReceiver.org_name}. ETA: ${chosen.etaMins} mins.`, {
    assignmentId,
    previousReceiver: asgn.destination_receiver_id,
    newReceiver: newReceiver.id,
    etaMins: chosen.etaMins,
    reason
  });

  // Notify Rider
  createNotification(
    asgn.rider_id,
    '⚠️ In-Transit Destination Updated',
    `You have been safely rerouted to ${newReceiver.org_name} (${newReceiver.address}). ETA is ~${chosen.etaMins} mins.`,
    'warning',
    { assignmentId, newReceiverId: newReceiver.id, newAddress: newReceiver.address }
  );

  // Notify Donor
  createNotification(
    asgn.donor_id,
    'Delivery Rerouted in Transit',
    `Cargo for ${asgn.donation_name} has been rerouted to ${newReceiver.org_name} due to: ${reason}.`,
    'info',
    { assignmentId, newReceiverId: newReceiver.id }
  );

  // Notify New Receiver
  createNotification(
    newReceiver.id,
    'Incoming Rerouted Food Delivery',
    `${asgn.rider_name} has been rerouted to your shelter with ${asgn.quantity} servings of ${asgn.donation_name}. Estimated arrival in ${chosen.etaMins} mins.`,
    'success',
    { assignmentId, riderName: asgn.rider_name, etaMins: chosen.etaMins }
  );

  if (io) {
    io.emit('delivery.redirected', {
      assignmentId,
      previousReceiverId: asgn.destination_receiver_id,
      previousReceiverName: asgn.original_receiver_name,
      newReceiverId: newReceiver.id,
      newReceiverName: newReceiver.org_name,
      newAddress: newReceiver.address,
      etaMins: chosen.etaMins,
      reason
    });
  }

  return {
    success: true,
    redirected: true,
    newReceiverId: newReceiver.id,
    newReceiverName: newReceiver.org_name,
    etaMins: chosen.etaMins,
    distanceKm: chosen.distanceKm
  };
}
