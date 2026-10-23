import { db, logEvent, createNotification } from '../database.js';
import { checkFeasibility } from './feasibilityService.js';

export const GHOST_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes default

/**
 * Ghost Reservation Recovery Job
 * Runs every 15s. Scans for ACCEPTED or HEADING_TO_PICKUP assignments where rider is unresponsive.
 * NEVER releases assignments that are PICKED_UP or IN_TRANSIT.
 */
export function runGhostRecoveryCheck(io = null, timeoutMs = GHOST_TIMEOUT_MS) {
  const now = Date.now();
  const thresholdIso = new Date(now - timeoutMs).toISOString();

  // Find unresponsive assignments (accepted or heading to pickup, but no ping or progress)
  const staleAssignments = db.prepare(`
    SELECT a.*, d.donor_id, d.name AS donation_name, d.safe_until, d.pickup_lat, d.pickup_lng,
           u.name AS rider_name, rec.name AS receiver_name
    FROM assignments a
    JOIN donations d ON a.donation_id = d.id
    JOIN users u ON a.rider_id = u.id
    JOIN users rec ON a.destination_receiver_id = rec.id
    WHERE a.status IN ('ACCEPTED', 'HEADING_TO_PICKUP')
      AND (
        (a.last_rider_ping IS NOT NULL AND a.last_rider_ping < ?)
        OR (a.last_rider_ping IS NULL AND a.accepted_at < ?)
      )
  `).all(thresholdIso, thresholdIso);

  for (const asgn of staleAssignments) {
    recoverStaleAssignment(asgn, io, 'Inactivity timeout (no rider telemetry ping in >2 minutes)');
  }

  return staleAssignments.length;
}

export function recoverStaleAssignment(asgn, io = null, reason = 'Rider unresponsive') {
  const transaction = db.transaction(() => {
    // 1. Mark assignment RELEASED
    db.prepare(`
      UPDATE assignments
      SET status = 'RELEASED', redirect_reason = ?
      WHERE id = ?
    `).run(reason, asgn.id);

    // 2. Fetch current donation state
    const don = db.prepare('SELECT * FROM donations WHERE id = ?').get(asgn.donation_id);
    if (don) {
      // 3. Restore available quantity and deduct reserved
      const restoredAvailable = don.available_quantity + asgn.quantity;
      const restoredReserved = Math.max(0, don.reserved_quantity - asgn.quantity);
      const newStatus = restoredAvailable === don.total_quantity ? 'AVAILABLE' : 'PARTIALLY_RESERVED';

      db.prepare(`
        UPDATE donations
        SET available_quantity = ?, reserved_quantity = ?, status = ?
        WHERE id = ?
      `).run(restoredAvailable, restoredReserved, newStatus, asgn.donation_id);
    }

    // 4. Log event
    logEvent('GHOST_RESERVATION_RELEASED', `Ghost reservation recovered for assignment ${asgn.id}: ${asgn.quantity} servings restored to donation. Reason: ${reason}`, {
      assignmentId: asgn.id,
      donationId: asgn.donation_id,
      riderId: asgn.rider_id,
      quantity: asgn.quantity,
      reason
    });

    // 5. Notify receiver
    if (asgn.destination_receiver_id) {
      createNotification(
        asgn.destination_receiver_id,
        'Rider Reassignment in Progress',
        `Assigned courier ${asgn.rider_name || 'volunteer'} became unresponsive. Cargo reservation was safely recovered. Re-assigning to new courier.`,
        'warning',
        { assignmentId: asgn.id }
      );
    }

    // 6. Notify donor
    const donorId = asgn.donor_id || don?.donor_id;
    if (donorId) {
      createNotification(
        donorId,
        'Reservation Restored',
        `Courier for ${asgn.quantity} servings was unresponsive. Quantity restored to available pool.`,
        'info',
        { donationId: asgn.donation_id }
      );
    }
  });

  transaction();

  if (io) {
    io.emit('reservation.released', {
      assignmentId: asgn.id,
      donationId: asgn.donation_id,
      reason
    });
    io.emit('alert.urgent', {
      title: 'Ghost Reservation Recovered',
      message: `Assignment ${asgn.id} was released due to rider inactivity.`,
      type: 'warning'
    });
  }
}
