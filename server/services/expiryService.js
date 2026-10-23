import { db, logEvent } from '../database.js';
import { checkFeasibility } from './feasibilityService.js';
import { checkCompatibility } from './compatibilityService.js';

let expiryAlertsLogged = new Set();

/**
 * Expiry Monitor Job (runs every 30s)
 * Scans active donations, flags near-deadline alerts, and expires elapsed items.
 */
export function runExpiryCheck(io = null, now = Date.now()) {
  const activeDonations = db.prepare(`
    SELECT * FROM donations
    WHERE status IN ('AVAILABLE', 'PARTIALLY_RESERVED', 'RESERVED')
  `).all();

  const updates = [];

  for (const don of activeDonations) {
    const deadlineMs = new Date(don.safe_until).getTime();
    const remainingMs = deadlineMs - now;
    const remainingMins = Math.floor(remainingMs / (60 * 1000));

    if (remainingMs <= 0) {
      // Mark donation as EXPIRED
      db.prepare(`
        UPDATE donations
        SET status = 'EXPIRED'
        WHERE id = ?
      `).run(don.id);

      logEvent('DONATION_EXPIRED', `Donation ${don.id} (${don.name}) has expired. Safe-use deadline elapsed. All new assignments blocked.`, {
        donationId: don.id,
        availableQuantity: don.available_quantity,
        reservedQuantity: don.reserved_quantity
      });

      updates.push({ id: don.id, status: 'EXPIRED', remainingMins: 0 });

      if (io) {
        io.emit('alert.urgent', {
          title: 'Donation Expired',
          message: `Food item "${don.name}" has expired and is no longer available for order.`,
          donationId: don.id,
          type: 'error'
        });
      }
    } else if (remainingMins < 10) {
      // Critical Alert (< 10 mins)
      const alertKey = `${don.id}_critical`;
      if (!expiryAlertsLogged.has(alertKey)) {
        expiryAlertsLogged.add(alertKey);
        logEvent('EXPIRY_CRITICAL', `CRITICAL: Donation ${don.id} (${don.name}) has only ${remainingMins} minutes left before safe-use deadline!`, {
          donationId: don.id,
          remainingMins
        });

        if (io) {
          io.emit('alert.urgent', {
            title: 'Critical Expiry Alert (<10m)',
            message: `"${don.name}" expires in ${remainingMins} minutes! Immediate consumption or distribution required.`,
            donationId: don.id,
            remainingMins,
            type: 'critical'
          });
        }
      }
    } else if (remainingMins < 30) {
      // Warning Alert (< 30 mins)
      const alertKey = `${don.id}_warning`;
      if (!expiryAlertsLogged.has(alertKey)) {
        expiryAlertsLogged.add(alertKey);
        logEvent('EXPIRY_WARNING', `WARNING: Donation ${don.id} (${don.name}) has ${remainingMins} minutes remaining.`, {
          donationId: don.id,
          remainingMins
        });
      }
    }
  }

  // Re-evaluate feasibility for all receivers for live donations
  try {
    const receivers = db.prepare('SELECT * FROM receiver_profiles').all();
    const availableDonations = db.prepare(`
      SELECT * FROM donations
      WHERE status = 'AVAILABLE' AND available_quantity > 0 AND safe_until > datetime('now')
    `).all();

    for (const rec of receivers) {
      for (const don of availableDonations) {
        const feas = checkFeasibility({ donation: don, receiver: rec, now });
        const compat = checkCompatibility({
          donation: don,
          receiver: rec,
          requestedQuantity: 1,
          estimatedArrival: feas.estimatedArrival
        });

        if (!feas.isFeasible || !compat.isCompatible) {
          if (io) {
            io.to(`user_${rec.user_id}`).emit('donation.hidden', {
              donationId: don.id,
              receiverId: rec.user_id,
              reason: feas.reason || compat.reason || 'Donation cannot reach in time'
            });
            io.emit('donation.hidden', {
              donationId: don.id,
              receiverId: rec.user_id,
              reason: feas.reason || compat.reason || 'Donation cannot reach in time'
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error re-evaluating receiver feasibility:', err.message);
  }

  return updates;
}
