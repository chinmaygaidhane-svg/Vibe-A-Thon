import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data.json');

// Haversine formula to compute distance in km
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 2.5; // fallback
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

// Estimate travel time in minutes based on distance (km) and vehicle
export function estimateTravelTimeMinutes(distanceKm, vehicleType = 'Two-Wheeler') {
  let avgSpeedKmH = 25; // default bike speed in city
  if (vehicleType.toLowerCase().includes('bicycle')) avgSpeedKmH = 15;
  if (vehicleType.toLowerCase().includes('car')) avgSpeedKmH = 22; // city traffic
  if (vehicleType.toLowerCase().includes('van')) avgSpeedKmH = 20;
  
  const timeHours = distanceKm / avgSpeedKmH;
  const timeMinutes = Math.ceil(timeHours * 60) + 5; // +5 mins buffer for pickup/drop handoff
  return Math.max(timeMinutes, 5);
}

// Pre-seeded Initial Data
export function getInitialData() {
  const salt = bcrypt.genSaltSync(10);
  const hashedDonorPass = bcrypt.hashSync('donor123', salt);
  const hashedReceiverPass = bcrypt.hashSync('receiver123', salt);
  const hashedRiderPass = bcrypt.hashSync('rider123', salt);

  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  return {
    users: [
      {
        id: 'u-donor-1',
        email: 'donor@aidflow.org',
        password: hashedDonorPass,
        role: 'donor',
        name: 'ABC Restaurant',
        phone: '+91 98230 11223',
        donorCategory: 'Restaurant',
        pickupAddress: 'FC Road, Shivaji Nagar, Pune, Maharashtra',
        lat: 18.5284,
        lng: 73.8425,
        createdAt: new Date(now - 86400000).toISOString()
      },
      {
        id: 'u-donor-2',
        email: 'hostel@aidflow.org',
        password: hashedDonorPass,
        role: 'donor',
        name: 'College Hostel Mess',
        phone: '+91 98230 44556',
        donorCategory: 'Mess / Hostel',
        pickupAddress: 'Senapati Bapat Road, Pune, Maharashtra',
        lat: 18.5350,
        lng: 73.8290,
        createdAt: new Date(now - 86400000).toISOString()
      },
      {
        id: 'u-donor-3',
        email: 'bakery@aidflow.org',
        password: hashedDonorPass,
        role: 'donor',
        name: 'XYZ Bakery',
        phone: '+91 98230 77889',
        donorCategory: 'Bakery',
        pickupAddress: 'Kothrud, Pune, Maharashtra',
        lat: 18.5074,
        lng: 73.8077,
        createdAt: new Date(now - 86400000).toISOString()
      },
      {
        id: 'u-receiver-1',
        email: 'shelterA@aidflow.org',
        password: hashedReceiverPass,
        role: 'receiver',
        name: 'Shelter A - Hope Haven',
        phone: '+91 98901 22334',
        orgType: 'Night Shelter',
        address: 'Koregaon Park, Pune, Maharashtra',
        lat: 18.5362,
        lng: 73.8940,
        storageCapacity: 120,
        cleanWater: true,
        cookingFacilities: true,
        foodHandlingCapabilities: ['cooked_meals', 'raw_rations', 'bakery_packaged'],
        operatingHours: '6:00 AM - 11:00 PM',
        currentDemand: 50,
        createdAt: new Date(now - 86400000).toISOString()
      },
      {
        id: 'u-receiver-2',
        email: 'shelterB@aidflow.org',
        password: hashedReceiverPass,
        role: 'receiver',
        name: 'Shelter B - Sunshine Community Kitchen',
        phone: '+91 98901 55667',
        orgType: 'Community Kitchen',
        address: 'Camp, MG Road, Pune, Maharashtra',
        lat: 18.5140,
        lng: 73.8790,
        storageCapacity: 150,
        cleanWater: true,
        cookingFacilities: true,
        foodHandlingCapabilities: ['cooked_meals', 'bakery_packaged'],
        operatingHours: '24 Hours',
        currentDemand: 45,
        createdAt: new Date(now - 86400000).toISOString()
      },
      {
        id: 'u-receiver-3',
        email: 'shelterC@aidflow.org',
        password: hashedReceiverPass,
        role: 'receiver',
        name: 'Shelter C - Care & Comfort Children Home',
        phone: '+91 98901 88990',
        orgType: 'Orphanage',
        address: 'Aundh, Pune, Maharashtra',
        lat: 18.5580,
        lng: 73.8073,
        storageCapacity: 60,
        cleanWater: true,
        cookingFacilities: false, // Incompatible with raw ration kits!
        foodHandlingCapabilities: ['cooked_meals', 'bakery_packaged'],
        operatingHours: '7:00 AM - 9:00 PM',
        currentDemand: 30,
        createdAt: new Date(now - 86400000).toISOString()
      },
      {
        id: 'u-rider-1',
        email: 'rider@aidflow.org',
        password: hashedRiderPass,
        role: 'rider',
        name: 'Rider Rahul',
        phone: '+91 97654 32109',
        vehicleType: 'Two-Wheeler (Motorbike)',
        maxCapacity: 80,
        preferredArea: 'Central Pune (Shivaji Nagar, FC Road, Camp)',
        availability: 'AVAILABLE',
        locationSharing: true,
        currentLat: 18.5240,
        currentLng: 73.8480,
        createdAt: new Date(now - 86400000).toISOString()
      },
      {
        id: 'u-rider-2',
        email: 'rider2@aidflow.org',
        password: hashedRiderPass,
        role: 'rider',
        name: 'Rider Priya',
        phone: '+91 97654 88776',
        vehicleType: 'Van / Mini-Truck',
        maxCapacity: 200,
        preferredArea: 'Pune West & Kothrud',
        availability: 'AVAILABLE',
        locationSharing: true,
        currentLat: 18.5120,
        currentLng: 73.8200,
        createdAt: new Date(now - 86400000).toISOString()
      }
    ],
    donations: [
      {
        id: 'don-1',
        donorId: 'u-donor-1',
        donorName: 'ABC Restaurant',
        donorCategory: 'Restaurant',
        mealName: 'Vegetable Pulao',
        foodCategory: 'cooked_meals',
        isVegetarian: true,
        description: 'Freshly prepared aromatic basmati rice with mixed vegetables, paneer cubes, and mild spices. Packed in insulated food-grade containers.',
        totalQuantity: 100,
        availableQuantity: 100,
        reservedQuantity: 0,
        deliveredQuantity: 0,
        servingsCount: 100,
        preparedAt: new Date(now - 30 * 60 * 1000).toISOString(),
        createdAt: new Date(now - 25 * 60 * 1000).toISOString(),
        safeUseDeadline: new Date(now + 2.5 * oneHour).toISOString(),
        pickupAddress: 'FC Road, Shivaji Nagar, Pune',
        pickupLat: 18.5284,
        pickupLng: 73.8425,
        storageRequirements: 'hot_insulated',
        handlingInstructions: 'Keep in insulated boxes above 60°C. Transport with care.',
        imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
        status: 'AVAILABLE'
      },
      {
        id: 'don-2',
        donorId: 'u-donor-2',
        donorName: 'College Hostel Mess',
        mealName: 'Chapati and Vegetable Curry',
        foodCategory: 'cooked_meals',
        isVegetarian: true,
        description: 'Soft whole wheat chapatis with freshly cooked mixed vegetable and dal curry from the evening student dinner surplus.',
        totalQuantity: 40,
        availableQuantity: 40,
        reservedQuantity: 0,
        deliveredQuantity: 0,
        servingsCount: 40,
        preparedAt: new Date(now - 45 * 60 * 1000).toISOString(),
        createdAt: new Date(now - 40 * 60 * 1000).toISOString(),
        safeUseDeadline: new Date(now + 1.8 * oneHour).toISOString(),
        pickupAddress: 'Senapati Bapat Road, Pune',
        pickupLat: 18.5350,
        pickupLng: 73.8290,
        storageRequirements: 'hot_insulated',
        handlingInstructions: 'Double bagged in clean stainless canisters.',
        imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=800&auto=format&fit=crop&q=80',
        status: 'AVAILABLE'
      },
      {
        id: 'don-3',
        donorId: 'u-donor-3',
        donorName: 'XYZ Bakery',
        mealName: 'Whole Wheat Bread & Muffin Packets',
        foodCategory: 'bakery_packaged',
        isVegetarian: true,
        description: 'Packaged whole wheat bread loaves and banana walnut muffins baked fresh today.',
        totalQuantity: 30,
        availableQuantity: 30,
        reservedQuantity: 0,
        deliveredQuantity: 0,
        servingsCount: 30,
        preparedAt: new Date(now - 3 * oneHour).toISOString(),
        createdAt: new Date(now - 2 * oneHour).toISOString(),
        safeUseDeadline: new Date(now + 24 * oneHour).toISOString(),
        pickupAddress: 'Kothrud, Pune',
        pickupLat: 18.5074,
        pickupLng: 73.8077,
        storageRequirements: 'ambient',
        handlingInstructions: 'Dry storage, protect from moisture.',
        imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop&q=80',
        status: 'AVAILABLE'
      },
      {
        id: 'don-4',
        donorId: 'u-donor-1',
        donorName: 'ABC Restaurant',
        mealName: 'Raw Ration Kit (Rice, Dal, Oil & Spices)',
        foodCategory: 'raw_rations',
        isVegetarian: true,
        description: 'Uncooked raw grocery kits containing 5kg rice, 2kg lentils, cooking oil, and salt. Requires active kitchen/cooking facility.',
        totalQuantity: 20,
        availableQuantity: 20,
        reservedQuantity: 0,
        deliveredQuantity: 0,
        servingsCount: 80,
        preparedAt: new Date(now - 12 * oneHour).toISOString(),
        createdAt: new Date(now - 10 * oneHour).toISOString(),
        safeUseDeadline: new Date(now + 7 * 24 * oneHour).toISOString(),
        pickupAddress: 'FC Road, Shivaji Nagar, Pune',
        pickupLat: 18.5284,
        pickupLng: 73.8425,
        storageRequirements: 'ambient',
        handlingInstructions: 'Requires cooking facilities. Moisture sensitive.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop&q=80',
        status: 'AVAILABLE'
      }
    ],
    requests: [],
    notifications: [
      {
        id: 'notif-welcome-1',
        userId: 'u-donor-1',
        role: 'donor',
        type: 'SYSTEM',
        title: 'Welcome to AidFlow AI',
        message: 'Your donor account is active. Surplus food donations can now be listed for local shelters.',
        timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
        read: false
      },
      {
        id: 'notif-welcome-2',
        userId: 'u-receiver-1',
        role: 'receiver',
        type: 'SYSTEM',
        title: 'Welcome to AidFlow AI',
        message: 'Your receiver dashboard is connected. Real-time food feeds from verified donors are live.',
        timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
        read: false
      }
    ],
    auditLogs: [
      {
        id: 'log-init',
        timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
        eventType: 'SYSTEM_BOOTSTRAP',
        description: 'AidFlow AI platform initialized with verified donors, receivers, and volunteer riders.',
        metadata: { city: 'Pune' }
      }
    ]
  };
}

class Database {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.reset();
      }
    } catch (err) {
      console.error('Error loading database file, resetting to initial state:', err);
      this.reset();
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving to database file:', err);
    }
  }

  reset() {
    this.data = getInitialData();
    this.save();
    return this.data;
  }

  // User queries
  getUsers() {
    return this.data.users;
  }

  getUserById(id) {
    return this.data.users.find(u => u.id === id);
  }

  getUserByEmail(email) {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  addUser(user) {
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(id, updates) {
    const user = this.getUserById(id);
    if (!user) return null;
    Object.assign(user, updates);
    this.save();
    return user;
  }

  // Donation queries
  getDonations() {
    return this.data.donations;
  }

  getDonationById(id) {
    return this.data.donations.find(d => d.id === id);
  }

  addDonation(donation) {
    this.data.donations.unshift(donation);
    this.save();
    return donation;
  }

  updateDonation(id, updates) {
    const don = this.getDonationById(id);
    if (!don) return null;
    Object.assign(don, updates);
    this.save();
    return don;
  }

  // Request queries
  getRequests() {
    return this.data.requests;
  }

  getRequestById(id) {
    return this.data.requests.find(r => r.id === id);
  }

  addRequest(req) {
    this.data.requests.unshift(req);
    this.save();
    return req;
  }

  updateRequest(id, updates) {
    const req = this.getRequestById(id);
    if (!req) return null;
    Object.assign(req, updates);
    this.save();
    return req;
  }

  // Notifications
  addNotification(notif) {
    const item = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      read: false,
      ...notif
    };
    this.data.notifications.unshift(item);
    this.save();
    return item;
  }

  getNotifications(userId, role) {
    return this.data.notifications.filter(n => n.userId === userId || n.role === role || n.role === 'all');
  }

  // Audit Logs
  addAuditLog(eventType, description, metadata = {}) {
    const log = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      eventType,
      description,
      metadata
    };
    this.data.auditLogs.unshift(log);
    this.save();
    return log;
  }

  getAuditLogs(limit = 50) {
    return this.data.auditLogs.slice(0, limit);
  }
}

export const db = new Database();
