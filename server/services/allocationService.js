import { db, logEvent, createNotification } from '../database.js';
import { checkCompatibility } from './compatibilityService.js';
import { checkFeasibility } from './feasibilityService.js';

/**
 * Quantity Integrity and Request Allocation Service
 * Runs inside SQLite transactions to guarantee atomic allocations.
 */
export function createRequestAndAssignments({
  donationId,
  receiverId,
  requestedQuantity,
  notes = '',
  io = null
}) {
  const transaction = db.transaction(() => {
    // 1. Fetch donation with row lock check
    const donation = db.prepare('SELECT * FROM donations WHERE id = ?').get(donationId);
    if (!donation) {
      throw new Error('Donation not found.');
    }

    if (donation.status === 'EXPIRED' || new Date(donation.safe_until).getTime() <= Date.now()) {
      throw new Error('Donation is expired. Cannot accept new requests.');
    }

    if (requestedQuantity <= 0) {
      throw new Error('Requested quantity must be greater than zero.');
    }

    if (donation.available_quantity < requestedQuantity) {
      throw new Error(
        `Insufficient quantity available. Only ${donation.available_quantity} ${donation.unit} remain.`
      );
    }

    // 2. Fetch receiver profile
    const receiver = db.prepare(`
      SELECT u.id, u.name, u.email, rp.*
      FROM users u
      JOIN receiver_profiles rp ON u.id = rp.user_id
      WHERE u.id = ?
    `).get(receiverId);

    if (!receiver) {
      throw new Error('Receiver profile not found.');
    }

    // 3. Feasibility check (now + pickup_eta + delivery_eta + 5 <= safe_until)
    const feas = checkFeasibility({ donation, receiver });
    if (!feas.isFeasible) {
      throw new Error(feas.reason || 'Donation cannot reach your facility in time before the safe-use deadline.');
    }

    // 4. Compatibility check (facilities, sanitation, operating hours at estimated arrival)
    const compat = checkCompatibility({
      donation,
      receiver,
      requestedQuantity,
      estimatedArrival: feas.estimatedArrival
    });
    if (!compat.isCompatible) {
      throw new Error(compat.reason);
    }

    // 5. Check remaining category demand
    const categoryDemand = db.prepare(`
      SELECT * FROM receiver_demand
      WHERE receiver_id = ? AND item_category = ?
    `).get(receiverId, donation.category);
    if (categoryDemand && categoryDemand.remaining_demand < requestedQuantity) {
      throw new Error(`Requested quantity (${requestedQuantity}) exceeds shelter's remaining demand (${categoryDemand.remaining_demand}) for ${donation.category}.`);
    }

    // 5. Atomic quantity reserve
    const newAvailable = donation.available_quantity - requestedQuantity;
    const newReserved = donation.reserved_quantity + requestedQuantity;
    const newStatus = newAvailable === 0 ? 'RESERVED' : 'PARTIALLY_RESERVED';

    db.prepare(`
      UPDATE donations
      SET available_quantity = ?, reserved_quantity = ?, status = ?
      WHERE id = ?
    `).run(newAvailable, newReserved, newStatus, donationId);

    // 6. Create request record
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    db.prepare(`
      INSERT INTO requests (id, donation_id, receiver_id, requested_quantity, status, notes)
      VALUES (?, ?, ?, ?, 'AWAITING_ASSIGNMENT', ?)
    `).run(requestId, donationId, receiverId, requestedQuantity, notes);

    // 7. Find eligible available riders
    const availableRiders = db.prepare(`
      SELECT u.id, u.name, u.phone, rp.*
      FROM users u
      JOIN rider_profiles rp ON u.id = rp.user_id
      WHERE u.role = 'rider' AND rp.availability = 1
      ORDER BY rp.max_capacity DESC
    `).all();

    // Check feasible riders
    const eligibleRiders = availableRiders.filter(rider => {
      const riderFeas = checkFeasibility({ donation, receiver, rider });
      return riderFeas.isFeasible;
    });

    const assignmentsCreated = [];
    let remainingToAllocate = requestedQuantity;

    // 8. Split pickup logic across eligible riders
    if (eligibleRiders.length > 0) {
      for (const rider of eligibleRiders) {
        if (remainingToAllocate <= 0) break;

        const portion = Math.min(rider.max_capacity, remainingToAllocate);
        if (portion <= 0) continue;

        const assignmentId = `asgn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        db.prepare(`
          INSERT INTO assignments (
            id, donation_id, request_id, rider_id, quantity, status,
            destination_receiver_id, route_progress
          ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, 0.0)
        `).run(assignmentId, donationId, requestId, rider.id, portion, receiverId);

        remainingToAllocate -= portion;
        assignmentsCreated.push({
          id: assignmentId,
          riderId: rider.id,
          riderName: rider.name,
          quantity: portion
        });

        // Notify rider
        createNotification(
          rider.id,
          'New Delivery Assignment Offer',
          `New delivery mission available: ${portion} servings of ${donation.name} from ${donation.donor_id} to ${receiver.org_name}.`,
          'info',
          { assignmentId, requestId, donationId }
        );
      }
    }

    // Update request status if assignments were offered
    if (assignmentsCreated.length > 0) {
      db.prepare(`UPDATE requests SET status = 'ASSIGNED' WHERE id = ?`).run(requestId);
    }

    // 9. Log event
    logEvent('REQUEST_CREATED', `Request ${requestId} created for ${requestedQuantity} servings of ${donation.name} by ${receiver.org_name}`, {
      requestId,
      donationId,
      receiverId,
      requestedQuantity,
      assignments: assignmentsCreated
    });

    // 10. Notify Donor
    createNotification(
      donation.donor_id,
      'Food Ordered by Shelter',
      `${receiver.org_name} has ordered ${requestedQuantity} servings of ${donation.name}. Remaining available: ${newAvailable}.`,
      'success',
      { requestId, donationId, receiverId }
    );

    return {
      requestId,
      newAvailableQuantity: newAvailable,
      newReservedQuantity: newReserved,
      assignments: assignmentsCreated,
      status: assignmentsCreated.length > 0 ? 'ASSIGNED' : 'AWAITING_ASSIGNMENT'
    };
  });

  const result = transaction();

  // Socket.IO real-time emission
  if (io) {
    io.emit('request.created', {
      requestId: result.requestId,
      donationId,
      receiverId,
      requestedQuantity,
      status: result.status
    });
    io.emit('donation.updated', { donationId, availableQuantity: result.newAvailableQuantity });
  }

  return result;
}
