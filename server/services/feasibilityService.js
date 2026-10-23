import { calculateDistanceKm, estimateTravelTimeMinutes } from '../database.js';

/**
 * Feasibility Engine
 * Computes pickup_eta + delivery_eta using Haversine distance at configurable avg speed (default 25 km/h).
 * Feasible ONLY IF: now + pickup_eta + delivery_eta + safety buffer (5 min) <= safe_until.
 * Expired donations can NEVER be accepted or recommended.
 */
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
      remainingMinutes: 0
    };
  }

  // Calculate pickup distance & time
  let pickupDistanceKm = 0;
  let pickupEtaMins = 0;

  if (rider) {
    pickupDistanceKm = calculateDistanceKm(
      rider.current_lat,
      rider.current_lng,
      donation.pickup_lat,
      donation.pickup_lng
    );
    pickupEtaMins = estimateTravelTimeMinutes(pickupDistanceKm, avgSpeedKmH);
  }

  // Calculate delivery distance & time (from donation pickup to receiver)
  const deliveryDistanceKm = calculateDistanceKm(
    donation.pickup_lat,
    donation.pickup_lng,
    receiver.lat,
    receiver.lng
  );
  const deliveryEtaMins = estimateTravelTimeMinutes(deliveryDistanceKm, avgSpeedKmH);

  const totalTransitMins = pickupEtaMins + deliveryEtaMins + safetyBufferMinutes;
  const isFeasible = totalTransitMins <= remainingMinutes;

  let reason = null;
  if (!isFeasible) {
    reason = `Infeasible timing: Required transit (${pickupEtaMins}m pickup + ${deliveryEtaMins}m delivery + ${safetyBufferMinutes}m safety buffer = ${totalTransitMins}m) exceeds remaining safe window (${remainingMinutes}m).`;
  }

  return {
    isFeasible,
    reason,
    pickupDistanceKm,
    deliveryDistanceKm,
    pickupEtaMins,
    deliveryEtaMins,
    totalEtaMins: pickupEtaMins + deliveryEtaMins,
    remainingMinutes,
    safetyBufferMinutes
  };
}
