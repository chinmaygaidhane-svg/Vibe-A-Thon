import express from 'express';
import { db, logEvent, createNotification } from '../database.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/assignments (Rider sees their assignments + available open assignments)
router.get('/', authenticate, (req, res) => {
  const user = req.user;

  let query = `
    SELECT a.*, d.name AS meal_name, d.category, d.veg_type, d.safe_until,
           d.pickup_lat, d.pickup_lng, d.donor_id,
           u_donor.name AS donor_name, dp.pickup_address,
           u_rec.name AS receiver_name, rp.address AS receiver_address,
           rp.lat AS receiver_lat, rp.lng AS receiver_lng,
           u_rider.name AS rider_name, u_rider.phone AS rider_phone
    FROM assignments a
    JOIN donations d ON a.donation_id = d.id
    JOIN users u_donor ON d.donor_id = u_donor.id
    LEFT JOIN donor_profiles dp ON d.donor_id = dp.user_id
    JOIN users u_rec ON a.destination_receiver_id = u_rec.id
    LEFT JOIN receiver_profiles rp ON a.destination_receiver_id = rp.user_id
    LEFT JOIN users u_rider ON a.rider_id = u_rider.id
    WHERE 1=1
  `;
  const params = [];

  if (user.role === 'rider') {
    // Rider sees their own assignments OR unassigned/pending assignments
    query += ' AND (a.rider_id = ? OR a.status = "PENDING")';
    params.push(user.id);
  } else if (user.role === 'donor') {
    query += ' AND d.donor_id = ?';
    params.push(user.id);
  } else if (user.role === 'receiver') {
    query += ' AND a.destination_receiver_id = ?';
    params.push(user.id);
  }

  query += ' ORDER BY a.created_at DESC';

  const assignments = db.prepare(query).all(...params);
  res.json({ assignments });
});

// POST /api/assignments/:id/accept (Rider accepts assignment)
router.post('/:id/accept', authenticate, requireRole('rider'), (req, res) => {
  const { id } = req.params;

  const asgn = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  if (!asgn) {
    return res.status(404).json({ error: 'Assignment not found.' });
  }

  if (asgn.status !== 'PENDING') {
    return res.status(400).json({ error: `Assignment cannot be accepted. Current status is '${asgn.status}'.` });
  }

  const nowIso = new Date().toISOString();
  db.prepare(`
    UPDATE assignments
    SET rider_id = ?, status = 'ACCEPTED', accepted_at = ?, last_rider_ping = ?
    WHERE id = ?
  `).run(req.user.id, nowIso, nowIso, id);

  logEvent('ASSIGNMENT_ACCEPTED', `Rider ${req.user.name} accepted assignment ${id} (${asgn.quantity} servings)`, {
    assignmentId: id,
    riderId: req.user.id
  });

  const io = req.app.get('io');
  if (io) {
    io.emit('assignment.updated', {
      assignmentId: id,
      riderId: req.user.id,
      riderName: req.user.name,
      status: 'ACCEPTED'
    });
  }

  res.json({ message: 'Assignment successfully accepted!', assignmentId: id });
});

// POST /api/assignments/:id/status (Workflow step controls)
router.post('/:id/status', authenticate, requireRole('rider'), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['HEADING_TO_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
  const normalizedStatus = status.toUpperCase().replace(/\s+/g, '_');

  if (!validStatuses.includes(normalizedStatus)) {
    return res.status(400).json({
      error: `Invalid status '${status}'. Must be one of [${validStatuses.join(', ')}].`
    });
  }

  const asgn = db.prepare('SELECT * FROM assignments WHERE id = ? AND rider_id = ?').get(id, req.user.id);
  if (!asgn) {
    return res.status(404).json({ error: 'Assignment not found or unauthorized.' });
  }

  const nowIso = new Date().toISOString();
  let query = 'UPDATE assignments SET status = ?, last_rider_ping = ?';
  const params = [normalizedStatus, nowIso];

  if (normalizedStatus === 'PICKED_UP') {
    query += ', picked_up_at = ?';
    params.push(nowIso);

    // Update donation status to PICKED_UP
    db.prepare(`UPDATE donations SET status = 'PICKED_UP' WHERE id = ?`).run(asgn.donation_id);
  } else if (normalizedStatus === 'DELIVERED') {
    // Safety guard: if current time is past safe_until, block Mark Delivered
    const donation = db.prepare('SELECT safe_until, name FROM donations WHERE id = ?').get(asgn.donation_id);
    if (donation && new Date(donation.safe_until).getTime() <= Date.now()) {
      db.prepare(`
        UPDATE assignments
        SET status = 'EXPIRED_IN_TRANSIT', risk_level = 'WILL_MISS', last_eta_update = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(id);

      logEvent('DELIVERY_BLOCKED_EXPIRED', `Safety rule violation blocked: Delivery attempt for assignment ${id} (${donation.name}) is past safe-use deadline (${donation.safe_until}). Marked EXPIRED_IN_TRANSIT.`, {
        assignmentId: id,
        donationId: asgn.donation_id,
        safeUntil: donation.safe_until
      });

      const io = req.app.get('io');
      if (io) {
        io.emit('assignment.updated', {
          assignmentId: id,
          status: 'EXPIRED_IN_TRANSIT',
          risk_level: 'WILL_MISS'
        });
        io.emit('alert.urgent', {
          type: 'critical',
          title: '⚠️ Food Safety Deadline Elapsed',
          message: `Delivery for "${donation.name}" has expired in transit. Do not serve. Dispose safely.`,
          assignmentId: id
        });
      }

      return res.status(400).json({
        error: 'Past safe-use deadline: do not serve. Dispose safely.'
      });
    }

    query += ', delivered_at = ?, route_progress = 1.0';
    params.push(nowIso);

    // Mark parent request DELIVERED
    db.prepare(`UPDATE requests SET status = 'DELIVERED' WHERE id = ?`).run(asgn.request_id);
  }

  query += ' WHERE id = ?';
  params.push(id);

  db.prepare(query).run(...params);

  logEvent('ASSIGNMENT_STATUS_UPDATED', `Assignment ${id} updated to ${normalizedStatus} by rider ${req.user.name}`, {
    assignmentId: id,
    status: normalizedStatus
  });

  const io = req.app.get('io');
  if (io) {
    io.emit('assignment.updated', {
      assignmentId: id,
      status: normalizedStatus,
      riderId: req.user.id
    });
  }

  res.json({ message: `Assignment status updated to ${normalizedStatus}`, status: normalizedStatus });
});

// POST /api/assignments/:id/stuck (Rider reports stuck in traffic)
router.post('/:id/stuck', authenticate, requireRole('rider'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Heavy traffic congestion', delayMinutes = 15 } = req.body;
    const { reportRiderStuck } = await import('../services/trafficDelayService.js');
    const io = req.app.get('io');
    const result = reportRiderStuck({ assignmentId: id, reason, delayMinutes, io });
    res.json({ message: 'Traffic delay reported and route re-evaluated.', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/assignments/:id/report-concern (Receiver reports concern)
router.post('/:id/report-concern', authenticate, requireRole('receiver'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes = 'Delivery seems delayed' } = req.body;
    const { reportReceiverConcern } = await import('../services/trafficDelayService.js');
    const io = req.app.get('io');
    const result = reportReceiverConcern({ assignmentId: id, notes, io });
    res.json({ message: 'Delivery concern logged and ETA rechecked.', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/assignments/:id/ping (Heartbeat)
router.post('/:id/ping', authenticate, (req, res) => {
  const { id } = req.params;
  db.prepare(`UPDATE assignments SET last_rider_ping = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
  res.json({ message: 'Ping acknowledged' });
});

export default router;
