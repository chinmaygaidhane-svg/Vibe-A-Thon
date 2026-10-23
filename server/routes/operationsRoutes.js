import express from 'express';
import { db } from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/operations (Operations center dashboard data)
router.get('/', authenticate, (req, res) => {
  // 1. Live assignments with full details
  const assignments = db.prepare(`
    SELECT a.*, d.name AS meal_name, d.safe_until, d.category,
           u_donor.name AS donor_name,
           u_rec.name AS receiver_name,
           u_rider.name AS rider_name
    FROM assignments a
    JOIN donations d ON a.donation_id = d.id
    JOIN users u_donor ON d.donor_id = u_donor.id
    JOIN users u_rec ON a.destination_receiver_id = u_rec.id
    LEFT JOIN users u_rider ON a.rider_id = u_rider.id
    ORDER BY a.created_at DESC
    LIMIT 50
  `).all();

  // 2. Event log feed
  const eventLogs = db.prepare(`
    SELECT * FROM event_log
    ORDER BY created_at DESC
    LIMIT 60
  `).all();

  // 3. At-risk donations (< 30 minutes safe_until remaining and not delivered/expired)
  const now = Date.now();
  const allActiveDonations = db.prepare(`
    SELECT d.*, u.name AS donor_name
    FROM donations d
    JOIN users u ON d.donor_id = u.id
    WHERE d.status IN ('AVAILABLE', 'PARTIALLY_RESERVED', 'RESERVED')
  `).all();

  const atRiskDonations = allActiveDonations
    .map(d => {
      const remainingMinutes = Math.max(0, Math.floor((new Date(d.safe_until).getTime() - now) / 60000));
      return { ...d, remainingMinutes };
    })
    .filter(d => d.remainingMinutes <= 30);

  // 4. Meals saved count (total delivered quantity)
  const mealsSavedRow = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS total_meals_saved
    FROM assignments
    WHERE status = 'DELIVERED'
  `).get();

  // 5. Active deliveries count
  const activeDeliveriesCount = db.prepare(`
    SELECT COUNT(*) AS active_count
    FROM assignments
    WHERE status IN ('ACCEPTED', 'HEADING_TO_PICKUP', 'PICKED_UP', 'IN_TRANSIT')
  `).get().active_count;

  res.json({
    stats: {
      activeDeliveries: activeDeliveriesCount,
      atRiskItems: atRiskDonations.length,
      mealsSaved: mealsSavedRow.total_meals_saved,
      totalEvents: eventLogs.length
    },
    assignments,
    eventLogs,
    atRiskDonations
  });
});

// GET /api/operations/notifications (User's notifications)
router.get('/notifications', authenticate, (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(req.user.id);

  res.json({ notifications });
});

// POST /api/operations/notifications/:id/read
router.post('/notifications/:id/read', authenticate, (req, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
  res.json({ message: 'Marked as read' });
});

export default router;
