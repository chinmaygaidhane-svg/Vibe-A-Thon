import bcrypt from 'bcryptjs';
import { db, initDatabase, logEvent } from './database.js';

export function seedDatabase() {
  initDatabase();

  // Clear existing demo tables
  const deleteStmts = [
    'assignments',
    'requests',
    'donations',
    'receiver_demand',
    'rider_profiles',
    'receiver_profiles',
    'donor_profiles',
    'notifications',
    'event_log',
    'users'
  ];

  for (const table of deleteStmts) {
    db.prepare(`DELETE FROM ${table}`).run();
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('Demo@1234', salt);
  const now = Date.now();

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, role, name, phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertDonor = db.prepare(`
    INSERT INTO donor_profiles (user_id, org_name, category, pickup_address, lat, lng)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertReceiver = db.prepare(`
    INSERT INTO receiver_profiles (user_id, org_name, org_type, address, lat, lng, storage_capacity, clean_water, cooking_facilities, food_handling_capabilities, operating_hours, current_demand)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRider = db.prepare(`
    INSERT INTO rider_profiles (user_id, full_name, vehicle_type, max_capacity, operating_area, availability, location_sharing, current_lat, current_lng)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDemand = db.prepare(`
    INSERT INTO receiver_demand (id, receiver_id, item_category, needed_quantity, remaining_demand)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertDonation = db.prepare(`
    INSERT INTO donations (
      id, donor_id, name, category, veg_type, description, total_quantity, available_quantity, reserved_quantity,
      unit, prepared_at, safe_until, pickup_lat, pickup_lng, storage_requirements, handling_instructions,
      requires_cooking, requires_clean_water, item_type, image_url, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Seed Donors
  insertUser.run('u-donor-1', 'donor@aidflow.org', passwordHash, 'donor', 'ABC Restaurant', '+91 98230 11223');
  insertDonor.run('u-donor-1', 'ABC Restaurant', 'Restaurant', 'FC Road, Shivaji Nagar, Pune', 18.5284, 73.8425);

  insertUser.run('u-donor-2', 'hostel@aidflow.org', passwordHash, 'donor', 'College Hostel Mess', '+91 98230 44556');
  insertDonor.run('u-donor-2', 'College Hostel Mess', 'Mess / Hostel', 'Law College Road, Pune', 18.5170, 73.8320);

  insertUser.run('u-donor-3', 'bakery@aidflow.org', passwordHash, 'donor', 'XYZ Bakery', '+91 98230 77889');
  insertDonor.run('u-donor-3', 'XYZ Bakery', 'Bakery', 'MG Road, Pune Camp', 18.5140, 73.8790);

  // 2. Seed Receivers
  insertUser.run('u-receiver-1', 'shelterA@aidflow.org', passwordHash, 'receiver', 'Shelter A - Hope Haven', '+91 98901 22334');
  insertReceiver.run('u-receiver-1', 'Shelter A - Hope Haven', 'Night Shelter', 'Koregaon Park, Pune', 18.5362, 73.8940, 120, 1, 1, 'cooked,packaged,raw_ration', '06:00 - 23:00', 50);
  insertDemand.run('dem-1', 'u-receiver-1', 'cooked_meals', 50, 50);

  insertUser.run('u-receiver-2', 'shelterB@aidflow.org', passwordHash, 'receiver', 'Shelter B - Sunshine Community Kitchen', '+91 98901 55667');
  insertReceiver.run('u-receiver-2', 'Shelter B - Sunshine Community Kitchen', 'Community Kitchen', 'Camp, MG Road, Pune', 18.5140, 73.8790, 150, 1, 1, 'cooked,packaged', '00:00 - 23:59', 45);
  insertDemand.run('dem-2', 'u-receiver-2', 'cooked_meals', 45, 45);

  insertUser.run('u-receiver-3', 'reliefC@aidflow.org', passwordHash, 'receiver', 'Relief Camp C - Care Home', '+91 98901 88990');
  insertReceiver.run('u-receiver-3', 'Relief Camp C - Care Home', 'Relief Camp', 'Aundh, Pune', 18.5580, 73.8073, 60, 1, 0, 'cooked,packaged', '07:00 - 21:00', 30);
  insertDemand.run('dem-3', 'u-receiver-3', 'cooked_meals', 30, 30);

  // 3. Seed Riders
  insertUser.run('u-rider-1', 'rider@aidflow.org', passwordHash, 'rider', 'Rider Rahul', '+91 97654 32109');
  insertRider.run('u-rider-1', 'Rider Rahul', 'Two-Wheeler (Motorbike)', 40, 'Pune Central (FC Road, Shivaji Nagar)', 1, 1, 18.5240, 73.8480);

  insertUser.run('u-rider-2', 'rider2@aidflow.org', passwordHash, 'rider', 'Rider Priya', '+91 97654 88776');
  insertRider.run('u-rider-2', 'Rider Priya', 'Van / Mini-Truck', 120, 'Pune East (Koregaon Park, Camp)', 1, 1, 18.5300, 73.8600);

  insertUser.run('u-rider-3', 'rider3@aidflow.org', passwordHash, 'rider', 'Rider Amit', '+91 97654 44332');
  insertRider.run('u-rider-3', 'Rider Amit', 'Two-Wheeler (Scooter)', 50, 'Pune West (Aundh, Kothrud)', 1, 1, 18.5200, 73.8400);

  // 4. Seed Donations
  // A. 100 servings Vegetable Pulao (Safe deadline 3.5 hrs from now)
  insertDonation.run(
    'don-1',
    'u-donor-1',
    'Vegetable Pulao with Raita',
    'cooked_meals',
    'veg',
    'Freshly prepared aromatic basmati pulao with vegetables and curd raita in insulated containers.',
    100,
    100,
    0,
    'servings',
    new Date(now - 30 * 60 * 1000).toISOString(),
    new Date(now + 3.5 * 60 * 60 * 1000).toISOString(),
    18.5284,
    73.8425,
    'hot_insulated',
    'Keep warm above 60°C.',
    0,
    0,
    'cooked',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'AVAILABLE'
  );

  // B. Raw Ration Kits (Incompatible with Shelter C which lacks cooking facilities!)
  insertDonation.run(
    'don-2',
    'u-donor-2',
    'Nutritious Dal & Rice Ration Kits',
    'raw_rations',
    'veg',
    'Sealed grocery kits containing 5kg Rice, 2kg Toor Dal, and spices. Requires cooking facilities.',
    50,
    50,
    0,
    'packets',
    new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    18.5170,
    73.8320,
    'ambient',
    'Store in dry place.',
    1, // requires_cooking = 1!
    1,
    'raw_ration',
    'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop&q=80',
    'AVAILABLE'
  );

  // C. Pastries near deadline (Safe deadline 18 minutes from now -> critical/warning alert test!)
  insertDonation.run(
    'don-3',
    'u-donor-3',
    'Fresh Cream Fruit Pastries & Buns',
    'bakery_packaged',
    'veg',
    'Assorted fresh cream pastries and soft buns packed in bakery boxes.',
    40,
    40,
    0,
    'servings',
    new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    new Date(now + 18 * 60 * 1000).toISOString(), // 18 mins left!
    18.5140,
    73.8790,
    'refrigerated',
    'Keep chilled below 4°C.',
    0,
    0,
    'packaged',
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop&q=80',
    'AVAILABLE'
  );

  // D. Dal Khichdi (4.5 hours safe window)
  insertDonation.run(
    'don-4',
    'u-donor-1',
    'Moong Dal Khichdi with Ghee',
    'cooked_meals',
    'veg',
    'Mild comforting moong dal khichdi packed in hygienic insulated dispensers.',
    60,
    60,
    0,
    'servings',
    new Date(now - 15 * 60 * 1000).toISOString(),
    new Date(now + 4.5 * 60 * 60 * 1000).toISOString(),
    18.5284,
    73.8425,
    'hot_insulated',
    'Serve warm.',
    0,
    0,
    'cooked',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
    'AVAILABLE'
  );

  logEvent('DATABASE_SEEDED', 'AidFlow AI database seeded with demo accounts, profiles, and realistic test donations.');
  console.log('✅ AidFlow AI database successfully seeded with demo data!');
}

// Allow CLI execution: node seed.js
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase();
  process.exit(0);
}
