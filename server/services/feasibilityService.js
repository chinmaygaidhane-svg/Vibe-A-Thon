import { db, calculateDistanceKm, estimateTravelTimeMinutes } from '../database.js';

/**
 * Feasibility Engine
 * Computes pickup_eta + delivery_eta using Haversine distance at configurable avg speed (default 25 km/h).
 * - pickup_eta = nearest available rider's time to donor, or 10 min default if no rider is free
 * - delivery_eta = Haversine distance from donor to receiver at 25 km/h
 * - safety_buffer = 5 min
 * Feasible ONLY IF: now + pickup_eta + delivery_eta + safety_buffer (5 min) <= safe_until.
 * Expired donations can NEVER be accepted or recommended.
 */
export function getNearestRiderPickupEta(pickupLat, pickupLng, avgSpeedKmH = 25) {
  try {
    const freeRiders = db.prepare(`
      SELECT rp.* FROM rider_profiles rp
      WHERE rp.availability = 1
        AND rp.user_id NOT IN (
          SELECT rider_id FROM assignments
          WHERE status IN ('ACCEPTED', 'HEADING_TO_PICKUP', 'PICKED_UP', 'IN_TRANSIT')
            AND rider_id IS NOT NULL
        )
    `).all();

    if (!freeRiders.length) {
      return 10; // 10 min default if no rider is free
    }

    let minDistance = Infinity;
    for (const rider of freeRiders) {
      const dist = calculateDistanceKm(rider.current_lat, rider.current_lng, pickupLat, pickupLng);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    const eta = estimateTravelTimeMinutes(minDistance, avgSpeedKmH);
    return Math.max(1, eta);
  } catch {
    return 10;
  }
}

export function checkFeasibility({
  donation,
  receiver,
  rider = null,
  now = Date.now(),
  avgSpeedKmH = 25,
  safetyBufferMinutes = 5
}) {
  const safeUntilMs = new Date(donation.safe_until).getTime();
  const remainingWindowMs = safeUntilMs - now;
  const remainingMinutes = Math.floor(remainingWindowMs / (60 * 1000));

  if (remainingMinutes <= 0) {
    return {
      isFeasible: false,
      reason: 'Donation has expired. Safe-use deadline elapsed.',
      pickupEtaMins: 0,
      deliveryEtaMins: 0,
      totalEtaMins: 0,
      remainingMinutes: 0,
      estimatedArrival: new Date(now).toISOString()
    };
  }

  // 1. Calculate pickup distance & time
  let pickupEtaMins = 10;
  if (rider) {
    const pickupDistanceKm = calculateDistanceKm(
      rider.current_lat,
      rider.current_lng,
      donation.pickup_lat,
      donation.pickup_lng
    );
    pickupEtaMins = estimateTravelTimeMinutes(pickupDistanceKm, avgSpeedKmH);
  } else {
    pickupEtaMins = getNearestRiderPickupEta(donation.pickup_lat, donation.pickup_lng, avgSpeedKmH);
  }

  // 2. Calculate delivery distance & time (from donation pickup to receiver)
  const deliveryDistanceKm = calculateDistanceKm(
    donation.pickup_lat,
    donation.pickup_lng,
    receiver.lat,
    receiver.lng
  );
  const deliveryEtaMins = estimateTravelTimeMinutes(deliveryDistanceKm, avgSpeedKmH);

  // 3. Estimated Arrival Timestamp
  const arrivalMs = now + (pickupEtaMins + deliveryEtaMins) * 60 * 1000;
  const estimatedArrival = new Date(arrivalMs).toISOString();

  // 4. Feasibility check: now + pickup_eta + delivery_eta + 5 <= safe_until
  const totalTransitMins = pickupEtaMins + deliveryEtaMins + safetyBufferMinutes;
  const isFeasible = (arrivalMs + safetyBufferMinutes * 60 * 1000) <= safeUntilMs;

  let reason = null;
  if (!isFeasible) {
    reason = `Infeasible timing: Total needed time (${pickupEtaMins}m pickup + ${deliveryEtaMins}m delivery + ${safetyBufferMinutes}m buffer = ${totalTransitMins}m) exceeds remaining safe window (${remainingMinutes}m).`;
  }

  return {
    isFeasible,
    reason,
    pickupEtaMins,
    deliveryEtaMins,
    totalEtaMins: pickupEtaMins + deliveryEtaMins,
    remainingMinutes,
    safetyBufferMinutes,
    deliveryDistanceKm,
    estimatedArrival
  };
}
