import express from 'express';
import { db, logEvent, createNotification } from '../database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createRequestAndAssignments } from '../services/allocationService.js';

const router = express.Router();

// POST /api/requests (Receiver only: atomic allocation, split pickups, feasibility, compatibility)
router.post('/', authenticate, requireRole('receiver'), (req, res) => {
  try {
    const { donationId, requestedQuantity, notes } = req.body;

    if (!donationId || !requestedQuantity) {
      return res.status(400).json({ error: 'donationId and requestedQuantity are required.' });
    }

    const qty = parseInt(requestedQuantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'requestedQuantity must be a positive number.' });
    }

    const io = req.app.get('io');
    const result = createRequestAndAssignments({
      donationId,
      receiverId: req.user.id,
      requestedQuantity: qty,
      notes,
      io
    });

    return res.status(201).json({
      message: 'Meal order confirmed! Volunteer riders notified.',
      ...result
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/requests (Ownership checks)
router.get('/', authenticate, (req, res) => {
  const user = req.user;

  let query = `
    SELECT r.*, d.name AS meal_name, d.category, d.veg_type, d.safe_until, d.pickup_lat, d.pickup_lng,
           d.storage_requirements, d.donor_id,
           u_donor.name AS donor_name, dp.pickup_address,
           u_rec.name AS receiver_name, rp.address AS receiver_address,
           rp.lat AS receiver_lat, rp.lng AS receiver_lng,
           rp.storage_capacity, rp.cooking_facilities, rp.clean_water
    FROM requests r
    JOIN donations d ON r.donation_id = d.id
    JOIN users u_donor ON d.donor_id = u_donor.id
    LEFT JOIN donor_profiles dp ON d.donor_id = dp.user_id
    JOIN users u_rec ON r.receiver_id = u_rec.id
    LEFT JOIN receiver_profiles rp ON r.receiver_id = rp.user_id
    WHERE 1=1
  `;
  const params = [];

  // Ownership enforcement
  if (user.role === 'receiver') {
    query += ' AND r.receiver_id = ?';
    params.push(user.id);
  } else if (user.role === 'donor') {
    query += ' AND d.donor_id = ?';
    params.push(user.id);
  } else if (user.role === 'rider') {
    query += ` AND r.id IN (SELECT request_id FROM assignments WHERE rider_id = ? OR status = 'PENDING')`;
    params.push(user.id);
  }

  query += ' ORDER BY r.created_at DESC';

  const requests = db.prepare(query).all(...params);

  // Attach assignments for each request
  const enriched = requests.map(reqItem => {
    const assignments = db.prepare(`
      SELECT a.*, u.name AS rider_name, u.phone AS rider_phone,
             rp.vehicle_type, rp.max_capacity, rp.current_lat, rp.current_lng
      FROM assignments a
      LEFT JOIN users u ON a.rider_id = u.id
      LEFT JOIN rider_profiles rp ON a.rider_id = rp.user_id
      WHERE a.request_id = ?
    `).all(reqItem.id);

    const firstAssign = assignments[0];
    const status = firstAssign?.status || reqItem.status;

    let redirectHistory = [];
    if (firstAssign?.redirect_reason) {
      redirectHistory.push({ reason: firstAssign.redirect_reason });
    }

    return {
      ...reqItem,
      donationId: reqItem.donation_id,
      mealName: reqItem.meal_name,
      quantityRequested: reqItem.requested_quantity,
      receiverAddress: reqItem.receiver_address || 'Shelter Location',
      receiverLat: reqItem.receiver_lat || 18.5204,
      receiverLng: reqItem.receiver_lng || 73.8567,
      pickupAddress: reqItem.pickup_address || 'Donor Location',
      pickupLat: reqItem.pickup_lat || 18.5284,
      pickupLng: reqItem.pickup_lng || 73.8425,
      currentLat: firstAssign?.current_lat || reqItem.pickup_lat || 18.5284,
      currentLng: firstAssign?.current_lng || reqItem.pickup_lng || 73.8425,
      assignmentId: firstAssign?.id || null,
      pickupETA: firstAssign?.eta ? Math.max(5, Math.floor(firstAssign.eta / 2)) : 10,
      deliveryETA: firstAssign?.eta ?? 15,
      riskLevel: firstAssign?.risk_level || 'ON_TRACK',
      isStuck: Boolean(firstAssign?.is_stuck),
      stuckReason: firstAssign?.stuck_reason || null,
      riderVehicle: firstAssign?.vehicle_type || 'Two-Wheeler',
      assignments: assignments.map(a => {
        // Strip sensitive codes from rider/public views
        const sanitized = { ...a };
        if (user.role === 'rider') {
          delete sanitized.pickup_code;
          delete sanitized.delivery_code;
        } else if (user.role === 'receiver') {
          delete sanitized.pickup_code;
        } else if (user.role === 'donor') {
          delete sanitized.delivery_code;
        }
        return sanitized;
      }),
      pickupCode: user.role === 'donor' ? firstAssign?.pickup_code : undefined,
      deliveryCode: user.role === 'receiver' ? firstAssign?.delivery_code : undefined,
      assignedRiderId: firstAssign?.rider_id || null,
      assignedRiderName: firstAssign?.rider_name || null,
      assignmentStatus: status,
      routeProgress: firstAssign?.route_progress || 0.0,
      redirectHistory,
      deliveryNotes: firstAssign?.redirect_reason ? `Rerouted: ${firstAssign.redirect_reason}` : ''
    };
  });

  res.json({ requests: enriched });
});

// POST /api/requests/:id/confirm-receipt (Receiver confirms receipt)
router.post('/:id/confirm-receipt', authenticate, requireRole('receiver'), (req, res) => {
  const { id } = req.params;
  const { notes = '', discrepancy = '' } = req.body;

  const request = db.prepare('SELECT * FROM requests WHERE id = ? AND receiver_id = ?').get(id, req.user.id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found or access denied.' });
  }

  db.prepare(`
    UPDATE requests
    SET status = 'DELIVERED', discrepancy_reported = ?
    WHERE id = ?
  `).run(discrepancy || null, id);

  db.prepare(`
    UPDATE assignments
    SET status = 'DELIVERED', delivered_at = CURRENT_TIMESTAMP
    WHERE request_id = ?
  `).run(id);

  logEvent('RECEIPT_CONFIRMED', `Receiver ${req.user.name} confirmed receipt for request ${id}. Notes: ${notes}. Discrepancy: ${discrepancy || 'None'}`, {
    requestId: id,
    receiverId: req.user.id,
    discrepancy
  });

  const io = req.app.get('io');
  if (io) {
    io.emit('assignment.updated', { requestId: id, status: 'DELIVERED' });
  }

  res.json({ message: 'Receipt confirmed successfully!', requestId: id });
});

// POST /api/requests/:id/status (Rider status updates via requestId)
router.post('/:id/status', authenticate, requireRole('rider'), (req, res) => {
  const { id } = req.params;
  const { status, code } = req.body;

  const assignment = db.prepare(`
    SELECT * FROM assignments
    WHERE (request_id = ? OR id = ?) AND (rider_id = ? OR rider_id IS NULL)
  `).get(id, id, req.user.id);

  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found for this request or unauthorized.' });
  }

  // Forward to assignment status logic
  const validStatuses = ['HEADING_TO_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
  const normalizedStatus = status.toUpperCase().replace(/\s+/g, '_');

  if (!validStatuses.includes(normalizedStatus)) {
    return res.status(400).json({
      error: `Invalid status '${status}'. Must be one of [${validStatuses.join(', ')}].`
    });
  }

  const nowIso = new Date().toISOString();
  let query = 'UPDATE assignments SET status = ?, last_rider_ping = ?';
  const params = [normalizedStatus, nowIso];

  if (normalizedStatus === 'PICKED_UP') {
    query += ', picked_up_at = ?';
    params.push(nowIso);
    db.prepare(`UPDATE donations SET status = 'PICKED_UP' WHERE id = ?`).run(assignment.donation_id);
  } else if (normalizedStatus === 'DELIVERED') {
    const donation = db.prepare('SELECT safe_until, name FROM donations WHERE id = ?').get(assignment.donation_id);
    if (donation && new Date(donation.safe_until).getTime() <= Date.now()) {
      db.prepare(`
        UPDATE assignments
        SET status = 'EXPIRED_IN_TRANSIT', risk_level = 'WILL_MISS', last_eta_update = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(assignment.id);

      logEvent('DELIVERY_BLOCKED_EXPIRED', `Safety rule violation blocked: Delivery attempt for assignment ${assignment.id} (${donation.name}) is past safe-use deadline (${donation.safe_until}). Marked EXPIRED_IN_TRANSIT.`, {
        assignmentId: assignment.id,
        donationId: assignment.donation_id,
        safeUntil: donation.safe_until
      });

      const io = req.app.get('io');
      if (io) {
        io.emit('assignment.updated', {
          assignmentId: assignment.id,
          status: 'EXPIRED_IN_TRANSIT',
          risk_level: 'WILL_MISS'
        });
        io.emit('alert.urgent', {
          type: 'critical',
          title: '⚠️ Food Safety Deadline Elapsed',
          message: `Delivery for "${donation.name}" has expired in transit. Do not serve. Dispose safely.`,
          assignmentId: assignment.id
        });
      }

      return res.status(400).json({
        error: 'Past safe-use deadline: do not serve. Dispose safely.'
      });
    }

    query += ', delivered_at = ?, route_progress = 1.0';
    params.push(nowIso);
    db.prepare(`UPDATE requests SET status = 'DELIVERED' WHERE id = ?`).run(assignment.request_id);
  }

  query += ' WHERE id = ?';
  params.push(assignment.id);
  db.prepare(query).run(...params);

  logEvent('ASSIGNMENT_STATUS_UPDATED', `Assignment ${assignment.id} (request ${id}) updated to ${normalizedStatus} by rider ${req.user.name}`, {
    assignmentId: assignment.id,
    requestId: id,
    status: normalizedStatus
  });

  const io = req.app.get('io');
  if (io) {
    io.emit('assignment.updated', {
      assignmentId: assignment.id,
      requestId: id,
      status: normalizedStatus,
      riderId: req.user.id
    });
  }

  res.json({ message: `Assignment status updated to ${normalizedStatus}`, status: normalizedStatus });
});

export default router;
