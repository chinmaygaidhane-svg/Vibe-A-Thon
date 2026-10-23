import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from './database.js';
import { authenticateToken } from './auth.js';

import authRoutes from './routes/authRoutes.js';
import donationRoutes from './routes/donationRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import simulationRoutes from './routes/simulationRoutes.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Setup WebSocket Server
const wss = new WebSocketServer({ server });

function broadcast(payload) {
  const messageStr = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// Make broadcast available across route handlers
app.set('broadcast', broadcast);

wss.on('connection', ws => {
  // Send initial handshake
  ws.send(JSON.stringify({
    event: 'CONNECTED',
    message: 'AidFlow AI Real-Time WebSocket Synchronization Connected',
    timestamp: new Date().toISOString()
  }));

  ws.on('message', message => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch {
      // ignore
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/simulation', simulationRoutes);

// Notifications endpoint
app.get('/api/notifications', authenticateToken, (req, res) => {
  const notifs = db.getNotifications(req.user.id, req.user.role);
  res.json({ notifications: notifs });
});

// Audit logs endpoint
app.get('/api/logs', authenticateToken, (req, res) => {
  const logs = db.getAuditLogs(100);
  res.json({ logs });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'AidFlow AI',
    timestamp: new Date().toISOString(),
    connectedSockets: wss.clients.size,
    donationsCount: db.getDonations().length,
    requestsCount: db.getRequests().length
  });
});

// Background Safety Monitor (Checks expiry and ghost reservations periodically)
setInterval(() => {
  const now = Date.now();
  let changed = false;

  // 1. Expiry Check
  db.getDonations().forEach(d => {
    if (d.status === 'AVAILABLE' || d.status === 'PARTIALLY_RESERVED') {
      const deadline = new Date(d.safeUseDeadline).getTime();
      if (deadline <= now) {
        db.updateDonation(d.id, { status: 'EXPIRED' });
        db.addAuditLog('DONATION_EXPIRED', `Donation ${d.mealName} passed its safe-use deadline and was marked EXPIRED.`, {
          donationId: d.id
        });
        changed = true;
      }
    }
  });

  // 2. Ghost Reservation Detection Check
  db.getRequests().forEach(r => {
    if (r.assignmentStatus === 'AWAITING_RIDER' || r.assignmentStatus === 'ASSIGNED') {
      const expiry = new Date(r.reservedExpiresAt).getTime();
      if (expiry <= now) {
        // Auto release ghost reservation
        const don = db.getDonationById(r.donationId);
        if (don) {
          db.updateDonation(don.id, {
            availableQuantity: don.availableQuantity + r.quantityRequested,
            reservedQuantity: Math.max(0, don.reservedQuantity - r.quantityRequested),
            status: 'AVAILABLE'
          });
        }
        db.updateRequest(r.id, {
          assignmentStatus: 'CANCELLED_TIMEOUT',
          status: 'TIMEOUT_RELEASED',
          deliveryNotes: 'Auto-released by background safety monitor due to inactivity.'
        });
        db.addAuditLog('AUTO_GHOST_TIMEOUT', `Ghost reservation #${r.id} auto-released. Quantity returned to donor.`, {
          requestId: r.id
        });
        changed = true;
      }
    }
  });

  if (changed) {
    broadcast({ event: 'BACKGROUND_SAFETY_AUDIT_COMPLETED', timestamp: new Date().toISOString() });
  }
}, 20000); // every 20 seconds

server.listen(PORT, () => {
  console.log(`🚀 AidFlow AI Backend & WebSocket Server active on http://localhost:${PORT}`);
});
