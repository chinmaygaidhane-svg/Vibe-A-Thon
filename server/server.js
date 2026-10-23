import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { initDatabase } from './database.js';
import { JWT_SECRET } from './middleware/auth.js';

import authRoutes from './routes/authRoutes.js';
import donationRoutes from './routes/donationRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import simulationRoutes from './routes/simulationRoutes.js';
import operationsRoutes from './routes/operationsRoutes.js';

import { runGhostRecoveryCheck } from './services/ghostRecoveryService.js';
import { runExpiryCheck } from './services/expiryService.js';

// Initialize SQLite Database schema
initDatabase();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Setup Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// Setup Socket.IO Server with JWT authentication
const io = new SocketIOServer(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

io.use((socket, next) => {
  // Extract token from handshake auth or cookie
  let token = socket.handshake.auth?.token;
  if (!token && socket.handshake.headers.cookie) {
    const cookies = Object.fromEntries(
      socket.handshake.headers.cookie.split('; ').map(c => c.split('='))
    );
    token = cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      socket.join(`user_${decoded.id}`);
    } catch {
      // Allow unauthenticated connection for public broadcasts
    }
  }
  next();
});

io.on('connection', socket => {
  socket.emit('connected', { message: 'AidFlow AI Real-Time Socket Connected' });

  // Allow client to subscribe to specific delivery mission room
  socket.on('join_delivery', ({ deliveryId }) => {
    if (deliveryId) {
      socket.join(`delivery_${deliveryId}`);
    }
  });

  socket.on('leave_delivery', ({ deliveryId }) => {
    if (deliveryId) {
      socket.leave(`delivery_${deliveryId}`);
    }
  });
});

app.set('io', io);

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/simulate', simulationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'AidFlow AI',
    timestamp: new Date().toISOString()
  });
});

// Periodic Background Jobs:
// 1. Ghost reservation recovery job every 15 seconds
const GHOST_JOB_INTERVAL_MS = 15 * 1000;
setInterval(() => {
  try {
    runGhostRecoveryCheck(io);
  } catch (err) {
    console.error('Ghost recovery job error:', err.message);
  }
}, GHOST_JOB_INTERVAL_MS);

// 2. Expiry monitor job every 30 seconds
const EXPIRY_JOB_INTERVAL_MS = 30 * 1000;
setInterval(() => {
  try {
    runExpiryCheck(io);
  } catch (err) {
    console.error('Expiry monitor job error:', err.message);
  }
}, EXPIRY_JOB_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`🚀 AidFlow AI Server running at http://localhost:${PORT}`);
  console.log(`⏱️ Ghost reservation recovery job running every 15s`);
  console.log(`⏱️ Expiry monitor job running every 30s`);
});
