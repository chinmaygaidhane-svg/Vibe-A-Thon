import { db, logEvent, createNotification, calculateDistanceKm, estimateTravelTimeMinutes } from '../database.js';
import { checkCompatibility } from './compatibilityService.js';
import { redirectInTransitAssignment } from './redirectService.js';

/**
 * Traffic Delay and Risk Handling Engine (Update 3)
 * Recomputes ETA from rider's CURRENT position every 30s.
 * Risk Levels:
 * - ON_TRACK: eta + 5 min buffer is > 10 min before safe_until
 * - AT_RISK: margin under 10 min
 * - WILL_MISS: eta + 5 min buffer is after safe_until
 */
export function recomputeAssignmentETA(assignmentId, io = null, customNow = null) {
  const now = customNow || Date.now();

  const asgn = db.prepare(`
    SELECT a.*,
           d.name AS meal_name, d.safe_until, d.pickup_lat, d.pickup_lng, d.donor_id,
           u_donor.name AS donor_name,
           u_rec.name AS receiver_name, rp.lat AS receiver_lat, rp.lng AS receiver_lng,
           rdp.current_lat AS rider_lat, rdp.current_lng AS rider_lng,
           r.receiver_id AS original_receiver_id
    FROM assignments a
    JOIN donations d ON a.donation_id = d.id
    JOIN users u_donor ON d.donor_id = u_donor.id
    JOIN requests r ON a.request_id = r.id
    JOIN users u_rec ON a.destination_receiver_id = u_rec.id
    LEFT JOIN receiver_profiles rp ON a.destination_receiver_id = rp.user_id
    LEFT JOIN rider_profiles rdp ON a.rider_id = rdp.user_id
    WHERE a.id = ?
  `).get(assignmentId);

  if (!asgn) return null;

  const safeUntilMs = new Date(asgn.safe_until).getTime();
  const safeUntilPassed = now >= safeUntilMs;

  // Safety guard: if current time is past safe_until, block delivery and expire
  if (safeUntilPassed && asgn.status !== 'DELIVERED' && asgn.status !== 'EXPIRED_IN_TRANSIT') {
    db.prepare(`
      UPDATE assignments
      SET status = 'EXPIRED_IN_TRANSIT', risk_level = 'WILL_MISS', last_eta_update = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(assignmentId);

    logEvent('CARGO_EXPIRED_IN_TRANSIT', `Safety lock: Assignment ${assignmentId} is past safe-use deadline (${asgn.safe_until}). Cargo must not be served. Marked EXPIRED_IN_TRANSIT.`, {
      assignmentId,
      safeUntil: asgn.safe_until
    });

    if (io) {
      io.emit('assignment.updated', {
        assignmentId,
        status: 'EXPIRED_IN_TRANSIT',
        risk_level: 'WILL_MISS',
        message: 'Past safe-use deadline: do not serve. Dispose safely.'
      });
      io.emit('alert.urgent', {
        type: 'critical',
        title: '⚠️ Food Safety Deadline Elapsed',
        message: `Delivery for "${asgn.meal_name}" has expired in transit. Do not serve. Dispose safely.`,
        assignmentId
      });
    }

    return {
      assignmentId,
      status: 'EXPIRED_IN_TRANSIT',
      risk_level: 'WILL_MISS',
      eta: 0,
      expired: true
    };
  }

  // Calculate distance from rider's current position to destination
  const riderLat = asgn.rider_lat || asgn.pickup_lat || 18.5284;
  const riderLng = asgn.rider_lng || asgn.pickup_lng || 73.8425;
  const destLat = asgn.receiver_lat || 18.5362;
  const destLng = asgn.receiver_lng || 73.8940;

  let distanceKm = 0;
  if (asgn.status === 'HEADING_TO_PICKUP') {
    const toPickup = calculateDistanceKm(riderLat, riderLng, asgn.pickup_lat, asgn.pickup_lng);
    const toDrop = calculateDistanceKm(asgn.pickup_lat, asgn.pickup_lng, destLat, destLng);
    distanceKm = toPickup + toDrop;
  } else {
    // PICKED_UP or IN_TRANSIT
    distanceKm = calculateDistanceKm(riderLat, riderLng, destLat, destLng);
  }

  // Base travel time at 25 km/h + handoff buffer + simulated delay
  const baseTravelMins = estimateTravelTimeMinutes(distanceKm, 25);
  const simulatedDelay = asgn.simulated_delay_mins || 0;
  const totalEtaMins = baseTravelMins + simulatedDelay;

  // Margin calculation:
  // eta + 5 min safety buffer compared to safe_until
  const bufferMins = 5;
  const arrivalWithBufferMs = now + (totalEtaMins + bufferMins) * 60 * 1000;
  const remainingMarginMs = safeUntilMs - arrivalWithBufferMs;
  const remainingMarginMins = Math.floor(remainingMarginMs / (60 * 1000));

  let newRiskLevel = 'ON_TRACK';
  if (remainingMarginMins < 0) {
    newRiskLevel = 'WILL_MISS';
  } else if (remainingMarginMins <= 10) {
    newRiskLevel = 'AT_RISK';
  } else {
    newRiskLevel = 'ON_TRACK';
  }

  const prevEta = asgn.eta || 15;
  const prevRisk = asgn.risk_level || 'ON_TRACK';
  const etaDiff = Math.abs(totalEtaMins - prevEta);
  const riskChanged = prevRisk !== newRiskLevel;

  // Update assignment in database
  db.prepare(`
    UPDATE assignments
    SET eta = ?, risk_level = ?, last_eta_update = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(totalEtaMins, newRiskLevel, assignmentId);

  // If risk level changed or ETA changed by 3+ mins, notify donor, receiver, rider
  if (riskChanged || etaDiff >= 3) {
    logEvent('ASSIGNMENT_ETA_UPDATED', `Assignment ${assignmentId} ETA changed to ${totalEtaMins}m (risk: ${newRiskLevel}). Margin: ${remainingMarginMins}m.`, {
      assignmentId,
      eta: totalEtaMins,
      prevEta,
      riskLevel: newRiskLevel,
      prevRisk,
      remainingMarginMins
    });

    if (io) {
      io.emit('assignment.updated', {
        assignmentId,
        eta: totalEtaMins,
        risk_level: newRiskLevel,
        status: asgn.status,
        remainingMarginMins
      });
    }

    // Create notifications for donor, receiver, rider
    createNotification(asgn.donor_id, `Delivery ETA Update: ${newRiskLevel}`, `Delivery ETA for ${asgn.meal_name} is now ${totalEtaMins}m (${newRiskLevel.replace('_', ' ')}).`, newRiskLevel === 'WILL_MISS' ? 'urgent' : 'warning');
    createNotification(asgn.destination_receiver_id, `Delivery ETA Update: ${newRiskLevel}`, `Incoming delivery for ${asgn.meal_name} is now ~${totalEtaMins}m (${newRiskLevel.replace('_', ' ')}).`, newRiskLevel === 'WILL_MISS' ? 'urgent' : 'warning');
    if (asgn.rider_id) {
      createNotification(asgn.rider_id, `Route Advisory: ${newRiskLevel}`, `Your delivery ETA is ~${totalEtaMins}m. Risk Level: ${newRiskLevel.replace('_', ' ')}.`, newRiskLevel === 'WILL_MISS' ? 'urgent' : 'warning');
    }
  }

  // Recovery when risk becomes WILL_MISS:
  // Search for alternative compatible receivers reachable before safe_until
  let recoveryResult = null;
  if (newRiskLevel === 'WILL_MISS' && asgn.status !== 'EXPIRING' && asgn.status !== 'EXPIRED_IN_TRANSIT') {
    recoveryResult = attemptAlternativeReroute(asgn, riderLat, riderLng, safeUntilMs, now, io);
  }

  return {
    assignmentId,
    eta: totalEtaMins,
    risk_level: newRiskLevel,
    remainingMarginMins,
    riskChanged,
    recoveryResult
  };
}

/**
 * Searches for alternative receivers reachable before safe_until and redirects,
 * or sets status to EXPIRING and raises red urgent recovery alert if none exists.
 */
export function attemptAlternativeReroute(asgn, riderLat, riderLng, safeUntilMs, now, io = null) {
  const donation = db.prepare('SELECT * FROM donations WHERE id = ?').get(asgn.donation_id);

  // Search candidate receivers
  const candidates = db.prepare(`
    SELECT u.id AS user_id, u.name, u.phone, rp.*
    FROM users u
    JOIN receiver_profiles rp ON u.id = rp.user_id
    WHERE u.role = 'receiver'
      AND u.id != ?
  `).all(asgn.destination_receiver_id);

  const viable = [];

  for (const cand of candidates) {
    // 1. Check demand for item
    const categoryDemand = db.prepare(`
      SELECT * FROM receiver_demand
      WHERE receiver_id = ? AND item_category = ?
    `).get(cand.user_id, donation.category);

    const hasDemand = categoryDemand ? categoryDemand.remaining_demand >= asgn.quantity : (cand.current_demand >= asgn.quantity);
    if (!hasDemand) continue;

    // 2. Compatibility check
    const compat = checkCompatibility({
      donation,
      receiver: cand,
      requestedQuantity: asgn.quantity
    });
    if (!compat.isCompatible) continue;

    // 3. Reachability from rider's CURRENT position before safe_until
    const distToCand = calculateDistanceKm(riderLat, riderLng, cand.lat, cand.lng);
    const etaMins = estimateTravelTimeMinutes(distToCand, 25);
    const arrivalCandMs = now + (etaMins + 5) * 60 * 1000;

    if (arrivalCandMs <= safeUntilMs) {
      viable.push({
        candidate: cand,
        distToCand,
        etaMins
      });
    }
  }

  // Rank by ETA (least travel time first)
  viable.sort((a, b) => a.etaMins - b.etaMins);

  if (viable.length > 0) {
    // Alternative exists -> redirect automatically
    const chosen = viable[0];
    const redirectRes = redirectInTransitAssignment({
      assignmentId: asgn.id,
      newReceiverId: chosen.candidate.user_id,
      io,
      reason: `Automated traffic delay recovery: Redirected to closer compatible shelter (${chosen.candidate.name}) to avoid safe deadline expiration.`
    });

    logEvent('DELAY_REROUTE_SUCCESS', `Assignment ${asgn.id} dynamically rerouted to alternative shelter ${chosen.candidate.name} (ETA ~${chosen.etaMins}m) to preserve food safety.`, {
      assignmentId: asgn.id,
      newReceiverId: chosen.candidate.user_id,
      etaMins: chosen.etaMins
    });

    return {
      redirected: true,
      newReceiverName: chosen.candidate.name,
      newReceiverId: chosen.candidate.user_id,
      etaMins: chosen.etaMins
    };
  } else {
    // No feasible alternative exists -> set status EXPIRING, show red urgent alert
    db.prepare(`
      UPDATE assignments
      SET status = 'EXPIRING', risk_level = 'WILL_MISS'
      WHERE id = ?
    `).run(asgn.id);

    logEvent('CARGO_EXPIRING_NO_ALTERNATIVE', `CRITICAL: Cargo in assignment ${asgn.id} (${asgn.meal_name}) cannot reach destination or any alternative shelter in time! Status set to EXPIRING.`, {
      assignmentId: asgn.id,
      donationId: asgn.donation_id
    });

    if (io) {
      io.emit('assignment.updated', {
        assignmentId: asgn.id,
        status: 'EXPIRING',
        risk_level: 'WILL_MISS'
      });
      io.emit('alert.urgent', {
        type: 'critical',
        title: '🚨 CRITICAL: Cargo Expiring — No Feasible Alternatives',
        message: `Mission ${asgn.id} for "${asgn.meal_name}" will miss safe delivery deadline. No alternative shelters can be reached in time. Immediate operational action required!`,
        assignmentId: asgn.id
      });
    }

    return {
      redirected: false,
      status: 'EXPIRING',
      message: 'No feasible alternative shelters found within safe-use window'
    };
  }
}

/**
 * 30-Second Traffic and Delay Monitoring Job
 */
export function runTrafficMonitorJob(io = null, customNow = null) {
  const now = customNow || Date.now();

  const activeAssignments = db.prepare(`
    SELECT id, status, last_progress_update, route_progress
    FROM assignments
    WHERE status IN ('HEADING_TO_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'EXPIRING')
  `).all();

  const results = [];

  for (const a of activeAssignments) {
    // Stuck detection: if rider has not progressed for 3 mins while IN_TRANSIT
    if (a.status === 'IN_TRANSIT' && a.last_progress_update) {
      const elapsedMs = now - new Date(a.last_progress_update).getTime();
      if (elapsedMs >= 3 * 60 * 1000 && a.route_progress < 0.95) {
        db.prepare('UPDATE assignments SET is_stuck = 1 WHERE id = ?').run(a.id);
        logEvent('RIDER_STUCK_DETECTED', `Rider on assignment ${a.id} has not progressed for >3 minutes. Flagged as stuck in traffic.`, { assignmentId: a.id });
      }
    }

    const recomputeRes = recomputeAssignmentETA(a.id, io, now);
    if (recomputeRes) results.push(recomputeRes);
  }

  return results;
}

/**
 * Rider reports stuck in traffic with estimated delay and reason
 */
export function reportRiderStuck({ assignmentId, reason, delayMinutes = 15, io = null }) {
  const delay = parseInt(delayMinutes) || 15;
  db.prepare(`
    UPDATE assignments
    SET is_stuck = 1,
        stuck_reason = ?,
        simulated_delay_mins = simulated_delay_mins + ?
    WHERE id = ?
  `).run(reason || 'Heavy traffic congestion', delay, assignmentId);

  logEvent('RIDER_REPORTED_STUCK', `Rider reported delay of +${delay}m on assignment ${assignmentId}. Reason: ${reason || 'Traffic'}`, {
    assignmentId,
    reason,
    delayMinutes: delay
  });

  // Recompute ETA immediately
  return recomputeAssignmentETA(assignmentId, io);
}

/**
 * Receiver reports concern (triggers immediate ETA/risk recheck, does NOT cancel)
 */
export function reportReceiverConcern({ assignmentId, notes = '', io = null }) {
  logEvent('RECEIVER_REPORTED_CONCERN', `Receiver reported delivery concern for assignment ${assignmentId}. Notes: ${notes}. Immediate ETA recheck triggered.`, {
    assignmentId,
    notes
  });

  return recomputeAssignmentETA(assignmentId, io);
}
