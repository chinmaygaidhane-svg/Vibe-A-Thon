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
      pickupETA: 10,
      deliveryETA: 15,
      riderVehicle: firstAssign?.vehicle_type || 'Two-Wheeler',
      assignments,
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

export default router;
