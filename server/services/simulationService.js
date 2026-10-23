import { db, logEvent } from '../database.js';
import { redirectInTransitAssignment } from './redirectService.js';
import { recoverStaleAssignment } from './ghostRecoveryService.js';
import { runExpiryCheck } from './expiryService.js';

let simulatedTimeOffsetMs = 0;

export function getSimulatedTime() {
  return Date.now() + simulatedTimeOffsetMs;
}

/**
 * Calculates unified rider position along route_progress between pickup and dropoff coordinates
 */
export function calculateRiderCoordinates(startLat, startLng, endLat, endLng, progress) {
  const p = Math.max(0, Math.min(1, progress));
  return {
    lat: parseFloat((startLat + (endLat - startLat) * p).toFixed(6)),
    lng: parseFloat((startLng + (endLng - startLng) * p).toFixed(6)),
    progress: p,
    isSimulated: true
  };
}

/**
 * Advance rider movement along active route
 */
export function advanceRiderSimulation({ assignmentId, step = 0.25, io = null }) {
  const asgn = db.prepare(`
    SELECT a.*, d.pickup_lat, d.pickup_lng, rp.lat AS dest_lat, rp.lng AS dest_lng
    FROM assignments a
    JOIN donations d ON a.donation_id = d.id
    JOIN receiver_profiles rp ON a.destination_receiver_id = rp.user_id
    WHERE a.id = ?
  `).get(assignmentId);

  if (!asgn) {
    throw new Error('Assignment not found');
  }

  const newProgress = Math.min(1.0, (asgn.route_progress || 0) + step);
  const nowIso = new Date().toISOString();

  // Update assignment and rider profile
  db.prepare(`
    UPDATE assignments
    SET route_progress = ?, last_rider_ping = ?
    WHERE id = ?
  `).run(newProgress, nowIso, assignmentId);

  const coords = calculateRiderCoordinates(
    asgn.pickup_lat,
    asgn.pickup_lng,
    asgn.dest_lat,
    asgn.dest_lng,
    newProgress
  );

  if (asgn.rider_id) {
    db.prepare(`
      UPDATE rider_profiles
      SET current_lat = ?, current_lng = ?
      WHERE user_id = ?
    `).run(coords.lat, coords.lng, asgn.rider_id);
  }

  logEvent('RIDER_POSITION_SIMULATED', `Rider position advanced to ${(newProgress * 100).toFixed(0)}% for assignment ${assignmentId}`, {
    assignmentId,
    progress: newProgress,
    coords
  });

  if (io) {
    io.emit('rider.location_updated', {
      assignmentId,
      riderId: asgn.rider_id,
      progress: newProgress,
      lat: coords.lat,
      lng: coords.lng,
      isSimulated: true
    });
  }

  return {
    assignmentId,
    progress: newProgress,
    coords
  };
}

/**
 * Trigger demand filled & dynamic in-transit redirect scenario
 */
export function triggerDemandFilledScenario({ assignmentId, io = null }) {
  return redirectInTransitAssignment({
    assignmentId,
    io,
    reason: 'Shelter original demand fulfilled by another volunteer agency'
  });
}

/**
 * Trigger ghost reservation timeout scenario
 */
export function triggerGhostTimeoutScenario({ assignmentId, io = null }) {
  const asgn = db.prepare(`
    SELECT a.*, d.donor_id, d.name AS donation_name, u.name AS rider_name
    FROM assignments a
    JOIN donations d ON a.donation_id = d.id
    JOIN users u ON a.rider_id = u.id
    WHERE a.id = ?
  `).get(assignmentId);

  if (!asgn) throw new Error('Assignment not found');

  if (asgn.status === 'PICKED_UP' || asgn.status === 'IN_TRANSIT') {
    throw new Error('Safety rule: Cargo is already picked up or in transit and CANNOT be released as ghost reservation.');
  }

  recoverStaleAssignment(asgn, io, 'Simulated rider timeout failure test');
  return { success: true, message: `Ghost reservation recovered for assignment ${assignmentId}` };
}

/**
 * Fast-forward simulated time to test expiry windows
 */
export function fastForwardTime({ minutes = 30, io = null }) {
  simulatedTimeOffsetMs += minutes * 60 * 1000;
  const currentSimTime = getSimulatedTime();
  const updates = runExpiryCheck(io, currentSimTime);

  logEvent('TIME_FAST_FORWARDED', `Simulated time shifted forward by ${minutes} minutes.`, {
    offsetMinutes: simulatedTimeOffsetMs / (60 * 1000),
    simulatedNow: new Date(currentSimTime).toISOString(),
    expiredCount: updates.length
  });

  return {
    offsetMinutesTotal: simulatedTimeOffsetMs / (60 * 1000),
    simulatedTime: new Date(currentSimTime).toISOString(),
    expiredUpdates: updates
  };
}
