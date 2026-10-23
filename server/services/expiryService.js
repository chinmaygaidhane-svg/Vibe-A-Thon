import { db, logEvent } from '../database.js';

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

  return updates;
}
