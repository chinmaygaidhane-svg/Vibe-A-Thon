import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'aidflow.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('donor', 'receiver', 'rider', 'admin')),
      name TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS donor_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      org_name TEXT NOT NULL,
      category TEXT NOT NULL,
      pickup_address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS receiver_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      org_name TEXT NOT NULL,
      org_type TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      storage_capacity INTEGER NOT NULL DEFAULT 100,
      clean_water INTEGER NOT NULL DEFAULT 1,
      cooking_facilities INTEGER NOT NULL DEFAULT 1,
      food_handling_capabilities TEXT NOT NULL DEFAULT 'cooked,packaged',
      operating_hours TEXT NOT NULL DEFAULT '08:00 - 22:00',
      current_demand INTEGER NOT NULL DEFAULT 50,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rider_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      vehicle_type TEXT NOT NULL,
      max_capacity INTEGER NOT NULL DEFAULT 40,
      operating_area TEXT NOT NULL DEFAULT 'Pune Central',
      availability INTEGER NOT NULL DEFAULT 1,
      location_sharing INTEGER NOT NULL DEFAULT 1,
      current_lat REAL NOT NULL DEFAULT 18.5204,
      current_lng REAL NOT NULL DEFAULT 73.8567,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS receiver_demand (
      id TEXT PRIMARY KEY,
      receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_category TEXT NOT NULL,
      needed_quantity INTEGER NOT NULL,
      remaining_demand INTEGER NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      donor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      veg_type TEXT NOT NULL CHECK(veg_type IN ('veg', 'non-veg')),
      description TEXT,
      total_quantity INTEGER NOT NULL,
      available_quantity INTEGER NOT NULL,
      reserved_quantity INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'servings',
      prepared_at DATETIME NOT NULL,
      safe_until DATETIME NOT NULL,
      pickup_lat REAL NOT NULL,
      pickup_lng REAL NOT NULL,
      storage_requirements TEXT NOT NULL DEFAULT 'hot_insulated',
      handling_instructions TEXT,
      requires_cooking INTEGER NOT NULL DEFAULT 0,
      requires_clean_water INTEGER NOT NULL DEFAULT 0,
      item_type TEXT NOT NULL CHECK(item_type IN ('cooked', 'packaged', 'raw_ration', 'infant_formula', 'medical')),
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE', 'RESERVED', 'PARTIALLY_RESERVED', 'PICKED_UP', 'COMPLETED', 'EXPIRED', 'CANCELLED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      donation_id TEXT NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
      receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requested_quantity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'AWAITING_ASSIGNMENT' CHECK(status IN ('AWAITING_ASSIGNMENT', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'PARTIALLY_FULFILLED')),
      notes TEXT,
      discrepancy_reported TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      donation_id TEXT NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
      request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      rider_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'HEADING_TO_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'RELEASED', 'EXPIRING', 'EXPIRED_IN_TRANSIT')),
      accepted_at DATETIME,
      picked_up_at DATETIME,
      delivered_at DATETIME,
      last_rider_ping DATETIME,
      route_progress REAL NOT NULL DEFAULT 0.0,
      destination_receiver_id TEXT NOT NULL REFERENCES users(id),
      redirect_from_receiver_id TEXT,
      redirect_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info' CHECK(type IN ('info', 'success', 'warning', 'urgent', 'error')),
      is_read INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_log (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
    CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
    CREATE INDEX IF NOT EXISTS idx_assignments_rider ON assignments(rider_id);
    CREATE INDEX IF NOT EXISTS idx_requests_receiver ON requests(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);

  // Column migrations for Update 3, 4, 5
  const migrationCols = [
    "ALTER TABLE assignments ADD COLUMN eta INTEGER DEFAULT 15",
    "ALTER TABLE assignments ADD COLUMN risk_level TEXT DEFAULT 'ON_TRACK'",
    "ALTER TABLE assignments ADD COLUMN last_eta_update DATETIME",
    "ALTER TABLE assignments ADD COLUMN last_progress_update DATETIME",
    "ALTER TABLE assignments ADD COLUMN is_stuck INTEGER DEFAULT 0",
    "ALTER TABLE assignments ADD COLUMN stuck_reason TEXT",
    "ALTER TABLE assignments ADD COLUMN simulated_delay_mins INTEGER DEFAULT 0",
    "ALTER TABLE assignments ADD COLUMN pickup_code TEXT",
    "ALTER TABLE assignments ADD COLUMN delivery_code TEXT",
    "ALTER TABLE assignments ADD COLUMN failed_code_attempts INTEGER DEFAULT 0",
    "ALTER TABLE assignments ADD COLUMN code_locked_until DATETIME",
    "ALTER TABLE rider_profiles ADD COLUMN accepted_count INTEGER DEFAULT 0",
    "ALTER TABLE rider_profiles ADD COLUMN completed_count INTEGER DEFAULT 0",
    "ALTER TABLE rider_profiles ADD COLUMN timed_out_count INTEGER DEFAULT 0",
    "ALTER TABLE rider_profiles ADD COLUMN late_count INTEGER DEFAULT 0",
    "ALTER TABLE rider_profiles ADD COLUMN cancelled_count INTEGER DEFAULT 0",
    "ALTER TABLE rider_profiles ADD COLUMN reliability_score INTEGER DEFAULT 70"
  ];
  for (const sql of migrationCols) {
    try {
      db.prepare(sql).run();
    } catch {
      // Column already exists, safe to ignore
    }
  }

  // Ensure assignments table check constraint includes EXPIRING, EXPIRED_IN_TRANSIT
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='assignments'").get();
    if (tableInfo && tableInfo.sql && !tableInfo.sql.includes('EXPIRED_IN_TRANSIT')) {
      db.exec(`
        PRAGMA foreign_keys=OFF;
        CREATE TABLE assignments_migrated (
          id TEXT PRIMARY KEY,
          donation_id TEXT NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
          request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
          rider_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          quantity INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'HEADING_TO_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'RELEASED', 'EXPIRING', 'EXPIRED_IN_TRANSIT')),
          accepted_at DATETIME,
          picked_up_at DATETIME,
          delivered_at DATETIME,
          last_rider_ping DATETIME,
          route_progress REAL NOT NULL DEFAULT 0.0,
          destination_receiver_id TEXT NOT NULL REFERENCES users(id),
          redirect_from_receiver_id TEXT,
          redirect_reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          eta INTEGER DEFAULT 15,
          risk_level TEXT DEFAULT 'ON_TRACK',
          last_eta_update DATETIME,
          last_progress_update DATETIME,
          is_stuck INTEGER DEFAULT 0,
          stuck_reason TEXT,
          simulated_delay_mins INTEGER DEFAULT 0,
          pickup_code TEXT,
          delivery_code TEXT,
          failed_code_attempts INTEGER DEFAULT 0,
          code_locked_until DATETIME
        );
        INSERT INTO assignments_migrated SELECT id, donation_id, request_id, rider_id, quantity, status, accepted_at, picked_up_at, delivered_at, last_rider_ping, route_progress, destination_receiver_id, redirect_from_receiver_id, redirect_reason, created_at, COALESCE(eta, 15), COALESCE(risk_level, 'ON_TRACK'), last_eta_update, last_progress_update, COALESCE(is_stuck, 0), stuck_reason, COALESCE(simulated_delay_mins, 0), pickup_code, delivery_code, COALESCE(failed_code_attempts, 0), code_locked_until FROM assignments;
        DROP TABLE assignments;
        ALTER TABLE assignments_migrated RENAME TO assignments;
        CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
        CREATE INDEX IF NOT EXISTS idx_assignments_rider ON assignments(rider_id);
        PRAGMA foreign_keys=ON;
      `);
    }
  } catch (err) {
    // Migration handled
  }
}

// Haversine distance in km
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 2.5;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

// Estimate travel time in minutes based on distance and speed (default 25 km/h)
export function estimateTravelTimeMinutes(distanceKm, avgSpeedKmH = 25) {
  const timeHours = distanceKm / avgSpeedKmH;
  return Math.ceil(timeHours * 60) + 5; // +5 mins handoff buffer
}

// Helper to log event to event_log
export function logEvent(eventType, description, payload = {}) {
  const id = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const stmt = db.prepare(`
    INSERT INTO event_log (id, event_type, description, payload)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, eventType, description, JSON.stringify(payload));
  return id;
}

// Helper to create notification
export function createNotification(userId, title, message, type = 'info', metadata = {}) {
  const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const stmt = db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, userId, title, message, type, JSON.stringify(metadata));
  return { id, userId, title, message, type, metadata, created_at: new Date().toISOString() };
}
