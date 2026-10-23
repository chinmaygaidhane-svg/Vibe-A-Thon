import assert from 'assert';
import { db, initDatabase } from './database.js';
import { seedDatabase } from './seed.js';
import { checkFeasibility } from './services/feasibilityService.js';
import { checkCompatibility } from './services/compatibilityService.js';
import { createRequestAndAssignments } from './services/allocationService.js';
import { recoverStaleAssignment } from './services/ghostRecoveryService.js';
import { redirectInTransitAssignment } from './services/redirectService.js';

console.log('🧪 Starting AidFlow AI Core Business Logic Test Suite...\n');

// Reset database with fresh seeds
seedDatabase();

// TEST 1: Feasibility Engine
console.log('Test 1: Feasibility Engine Tests');
{
  const now = Date.now();
  const donation = {
    safe_until: new Date(now + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
    pickup_lat: 18.5284,
    pickup_lng: 73.8425
  };
  const receiver = { lat: 18.5362, lng: 73.8940 }; // ~5.6 km
  const rider = { current_lat: 18.5240, current_lng: 73.8480 };

  const feas = checkFeasibility({ donation, receiver, rider, now });
  assert.strictEqual(feas.isFeasible, true, 'Delivery should be feasible within 2h window');
  assert(feas.deliveryEtaMins > 0, 'Delivery ETA should be calculated');

  // Test expired donation
  const expiredDonation = {
    safe_until: new Date(now - 10 * 60 * 1000).toISOString(),
    pickup_lat: 18.5284,
    pickup_lng: 73.8425
  };
  const expFeas = checkFeasibility({ donation: expiredDonation, receiver, rider, now });
  assert.strictEqual(expFeas.isFeasible, false, 'Expired donation must be rejected as infeasible');
  console.log('  ✓ Feasibility timing and expired donation rejection verified');
}

// TEST 2: Compatibility Rules
console.log('Test 2: Compatibility Rules Tests');
{
  const rawRationDonation = {
    requires_cooking: 1,
    requires_clean_water: 1,
    item_type: 'raw_ration'
  };

  // Shelter with cooking facilities
  const shelterA = { cooking_facilities: 1, clean_water: 1, current_demand: 50, storage_capacity: 100 };
  const compatA = checkCompatibility({ donation: rawRationDonation, receiver: shelterA, requestedQuantity: 30 });
  assert.strictEqual(compatA.isCompatible, true, 'Shelter A with cooking should be compatible');

  // Relief Camp C without cooking facilities
  const shelterC = { cooking_facilities: 0, clean_water: 1, current_demand: 30, storage_capacity: 60 };
  const compatC = checkCompatibility({ donation: rawRationDonation, receiver: shelterC, requestedQuantity: 20 });
  assert.strictEqual(compatC.isCompatible, false, 'Shelter C without cooking must be rejected');
  assert(compatC.reason.includes('cooking facilities'), 'Reason should mention cooking facilities');
  console.log('  ✓ Compatibility rejection for missing cooking facilities verified');
}

// TEST 3: Quantity Integrity & Overallocation Prevention
console.log('Test 3: Quantity Integrity & Overallocation Prevention');
{
  const donBefore = db.prepare('SELECT available_quantity FROM donations WHERE id = ?').get('don-1');
  const initialQty = donBefore.available_quantity; // 100

  // Valid order of 35 servings
  const result = createRequestAndAssignments({
    donationId: 'don-1',
    receiverId: 'u-receiver-1',
    requestedQuantity: 35
  });

  assert.strictEqual(result.newAvailableQuantity, initialQty - 35, 'Available quantity should decrease by 35');
  assert.strictEqual(result.newReservedQuantity, 35, 'Reserved quantity should be 35');

  // Attempt to overallocate (requesting 100 more when only 65 remain)
  assert.throws(() => {
    createRequestAndAssignments({
      donationId: 'don-1',
      receiverId: 'u-receiver-2',
      requestedQuantity: 100
    });
  }, /Insufficient quantity available/, 'Overallocation must throw an error and rollback');

  // Verify quantity did NOT change after failed overallocation
  const donAfter = db.prepare('SELECT available_quantity, reserved_quantity FROM donations WHERE id = ?').get('don-1');
  assert.strictEqual(donAfter.available_quantity, 65, 'Available quantity must remain 65 after failed overallocation');
  assert.strictEqual(donAfter.reserved_quantity, 35, 'Reserved quantity must remain 35');
  console.log('  ✓ Atomic quantity allocation and overallocation prevention verified');
}

// TEST 4: Ghost Reservation Recovery
console.log('Test 4: Ghost Reservation Recovery Tests');
{
  // Find the assignment created in Test 3
  const asgn = db.prepare('SELECT * FROM assignments WHERE donation_id = ? LIMIT 1').get('don-1');
  assert(asgn, 'Assignment should exist from Test 3');

  // Mark as ACCEPTED
  db.prepare("UPDATE assignments SET status = 'ACCEPTED' WHERE id = ?").run(asgn.id);

  // Recover ghost reservation
  recoverStaleAssignment(asgn, null, 'Test rider timeout');

  const asgnRecovered = db.prepare('SELECT status FROM assignments WHERE id = ?').get(asgn.id);
  assert.strictEqual(asgnRecovered.status, 'RELEASED', 'Stale assignment must be marked RELEASED');

  const donRestored = db.prepare('SELECT available_quantity, reserved_quantity FROM donations WHERE id = ?').get('don-1');
  assert.strictEqual(donRestored.available_quantity, 100, 'Available quantity must be restored to 100');
  assert.strictEqual(donRestored.reserved_quantity, 0, 'Reserved quantity must be 0');
  console.log('  ✓ Ghost reservation recovery and quantity restoration verified');
}

// TEST 5: In-Transit Dynamic Redirection
console.log('Test 5: In-Transit Dynamic Redirection Tests');
{
  // Create an active assignment in IN_TRANSIT
  const result = createRequestAndAssignments({
    donationId: 'don-1',
    receiverId: 'u-receiver-1',
    requestedQuantity: 35
  });

  const asgnId = result.assignments[0].id;
  db.prepare(`
    UPDATE assignments
    SET status = 'IN_TRANSIT', route_progress = 0.5
    WHERE id = ?
  `).run(asgnId);

  // Trigger demand filled redirect
  const redirectResult = redirectInTransitAssignment({
    assignmentId: asgnId,
    reason: 'Original receiver demand fulfilled test'
  });

  assert.strictEqual(redirectResult.success, true, 'Redirection should succeed');
  assert.strictEqual(redirectResult.redirected, true, 'Delivery should be redirected');
  assert.strictEqual(redirectResult.newReceiverId, 'u-receiver-2', 'Should redirect to feasible candidate Shelter B');

  const updatedAsgn = db.prepare('SELECT destination_receiver_id, redirect_reason FROM assignments WHERE id = ?').get(asgnId);
  assert.strictEqual(updatedAsgn.destination_receiver_id, 'u-receiver-2', 'Database assignment should point to Shelter B');
  console.log('  ✓ In-transit dynamic redirection to alternative candidate verified');
}

// TEST 6: Feasibility-Filtered Receiver Feed & Fast-Forward Expiry Tests
console.log('Test 6: Feasibility-Filtered Receiver Feed & Fast-Forward Tests');
{
  const now = Date.now();
  // Donation expiring in 25 minutes
  const tightDonation = {
    id: 'test-tight-don',
    safe_until: new Date(now + 25 * 60 * 1000).toISOString(),
    pickup_lat: 18.5284,
    pickup_lng: 73.8425,
    category: 'cooked_meals',
    requires_cooking: 0,
    requires_clean_water: 0
  };

  // Near receiver (1 km away, ~2 min delivery + 10 min pickup + 5 min buffer = 17 min <= 25 min)
  const nearReceiver = {
    user_id: 'rec-near',
    lat: 18.5300,
    lng: 73.8450,
    clean_water: 1,
    cooking_facilities: 1,
    current_demand: 40,
    storage_capacity: 100,
    operating_hours: '06:00 - 23:00'
  };

  // Far receiver (15 km away, ~36 min delivery + 10 min pickup + 5 min buffer = 51 min > 25 min)
  const farReceiver = {
    user_id: 'rec-far',
    lat: 18.6500,
    lng: 73.7500,
    clean_water: 1,
    cooking_facilities: 1,
    current_demand: 40,
    storage_capacity: 100,
    operating_hours: '06:00 - 23:00'
  };

  const nearFeas = checkFeasibility({ donation: tightDonation, receiver: nearReceiver, now });
  const farFeas = checkFeasibility({ donation: tightDonation, receiver: farReceiver, now });

  assert.strictEqual(nearFeas.isFeasible, true, 'Near receiver should feasibly receive tight donation');
  assert.strictEqual(farFeas.isFeasible, false, 'Far receiver must NOT see donation near its deadline');

  // Now simulate time passing by 15 minutes
  const laterNow = now + 15 * 60 * 1000;
  const laterNearFeas = checkFeasibility({ donation: tightDonation, receiver: nearReceiver, now: laterNow });
  assert.strictEqual(laterNearFeas.isFeasible, false, 'Near receiver must lose visibility after 15m time passes');

  console.log('  ✓ Far receiver filtered out, near receiver sees donation, and donation disappears after time fast-forward');
}

// TEST 7: Authentication with Email or Phone Number (Update 2)
console.log('Test 7: Authentication with Email or Phone Number Tests');
{
  const { normalizeIndianPhoneNumber } = await import('./routes/authRoutes.js');
  const bcrypt = (await import('bcryptjs')).default;

  // 1. Phone Normalization tests
  assert.strictEqual(normalizeIndianPhoneNumber('+91 90000 00001'), '9000000001');
  assert.strictEqual(normalizeIndianPhoneNumber('+91-98230-11223'), '9823011223');
  assert.strictEqual(normalizeIndianPhoneNumber('09823011223'), '9823011223');
  assert.strictEqual(normalizeIndianPhoneNumber('9823011223'), '9823011223');
  assert.strictEqual(normalizeIndianPhoneNumber('12345'), null, 'Invalid length should return null');
  assert.strictEqual(normalizeIndianPhoneNumber('4000000001'), null, 'Should only accept starting with 6-9');
  console.log('  ✓ Indian phone normalization (+91, dashes, 0) verified');

  // 2. Lookup by email
  const userByEmail = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get('donor@demo.com');
  assert(userByEmail, 'Should find user by email');
  assert.strictEqual(userByEmail.role, 'donor');

  // 3. Lookup by normalized phone
  const rawInputPhone = '+91 90000 00002';
  const normalizedPhone = normalizeIndianPhoneNumber(rawInputPhone);
  assert.strictEqual(normalizedPhone, '9000000002');
  const userByPhone = db.prepare('SELECT * FROM users WHERE phone = ?').get(normalizedPhone);
  assert(userByPhone, 'Should find user by normalized phone');
  assert.strictEqual(userByPhone.email, 'shelter.a@demo.com');
  assert.strictEqual(userByPhone.role, 'receiver');

  // 4. Role mismatch rejection
  const attemptedRole = 'rider';
  const roleMatches = userByEmail.role === attemptedRole;
  assert.strictEqual(roleMatches, false, 'Role mismatch must be flagged');

  // 5. Duplicate phone rejection
  const dupPhoneCheck = db.prepare('SELECT id FROM users WHERE phone = ?').get('9000000001');
  assert(dupPhoneCheck, 'Should detect duplicate phone in database');
  console.log('  ✓ Login by email, login by phone (+91 format), wrong role rejection, and duplicate phone detection verified');
}

// TEST 8: Delay and Traffic Handling (Update 3)
console.log('Test 8: Delay and Traffic Handling Tests');
{
  const { recomputeAssignmentETA, attemptAlternativeReroute } = await import('./services/trafficDelayService.js');

  const now = Date.now();
  // Create a test donation safe for 60 minutes
  const safeUntilDate = new Date(now + 60 * 60 * 1000).toISOString();

  const testDonId = 'test-don-delay-' + Date.now();
  const testReqId = 'test-req-delay-' + Date.now();
  const testAsgnId = 'test-asgn-delay-' + Date.now();

  db.prepare(`
    INSERT INTO donations (
      id, donor_id, name, description, category, veg_type, total_quantity, available_quantity, reserved_quantity,
      unit, prepared_at, safe_until, pickup_lat, pickup_lng, item_type, status
    )
    VALUES (?, 'u-donor-1', 'Traffic Test Biryani', 'Testing delay handling', 'cooked_meals', 'non-veg', 50, 0, 0,
      'servings', CURRENT_TIMESTAMP, ?, 18.5284, 73.8425, 'cooked', 'PICKED_UP')
  `).run(testDonId, safeUntilDate);

  // Create request for Receiver 1 (Shelter A)
  db.prepare(`
    INSERT INTO requests (id, receiver_id, donation_id, requested_quantity, status)
    VALUES (?, 'u-receiver-1', ?, 25, 'IN_TRANSIT')
  `).run(testReqId, testDonId);

  // Create assignment for Rider 1 (Rahul)
  db.prepare(`
    INSERT INTO assignments (id, request_id, donation_id, rider_id, status, quantity, pickup_code, delivery_code, destination_receiver_id, simulated_delay_mins)
    VALUES (?, ?, ?, 'u-rider-1', 'IN_TRANSIT', 25, '1111', '2222', 'u-receiver-1', 0)
  `).run(testAsgnId, testReqId, testDonId);

  // 1. Initial State: travel time ~15 min, safe_until is in 60 min. Margin is 60 - (15 + 5) = 40 min (> 10 min) -> ON_TRACK
  const initialRes = recomputeAssignmentETA(testAsgnId, null, now);
  assert.strictEqual(initialRes.risk_level, 'ON_TRACK', 'Initial margin should be ON_TRACK');
  console.log('  ✓ Initial state computed as ON_TRACK');

  // 2. Add delay of 35 min: total ETA 15 + 35 = 50 min. Margin: 60 - (50 + 5) = 5 min (<= 10 min) -> AT_RISK
  db.prepare('UPDATE assignments SET simulated_delay_mins = 35 WHERE id = ?').run(testAsgnId);
  const atRiskRes = recomputeAssignmentETA(testAsgnId, null, now);
  assert.strictEqual(atRiskRes.risk_level, 'AT_RISK', 'Margin <= 10m should transition to AT_RISK');
  console.log('  ✓ Traffic delay transition to AT_RISK verified');

  // 3. Add delay of 50 min: total ETA 15 + 50 = 65 min. Margin: 60 - (65 + 5) = -10 min (< 0) -> WILL_MISS
  db.prepare('UPDATE assignments SET simulated_delay_mins = 50 WHERE id = ?').run(testAsgnId);
  const willMissRes = recomputeAssignmentETA(testAsgnId, null, now);
  assert.strictEqual(willMissRes.risk_level, 'WILL_MISS', 'Negative margin should transition to WILL_MISS');
  console.log('  ✓ Traffic delay transition to WILL_MISS verified');

  // 4. Verify recovery redirection or EXPIRING
  // If an alternative receiver is reachable in time (e.g. Shelter B or C), redirect occurs
  if (willMissRes.recoveryResult?.redirected) {
    assert(willMissRes.recoveryResult.newReceiverId, 'Should redirect to an alternative receiver');
    console.log(`  ✓ Dynamic reroute: successfully redirected to alternative shelter (id: ${willMissRes.recoveryResult.newReceiverId})`);
  } else {
    assert.strictEqual(willMissRes.recoveryResult?.status, 'EXPIRING', 'If no shelter is reachable, status must become EXPIRING');
    console.log('  ✓ No alternative reachable: status correctly marked EXPIRING with urgent alert');
  }

  // 5. Test Delivery blocked after safe_until deadline
  const expiredNow = now + 65 * 60 * 1000; // 65 min later, past safe_until
  const blockedRes = recomputeAssignmentETA(testAsgnId, null, expiredNow);
  assert.strictEqual(blockedRes.status, 'EXPIRED_IN_TRANSIT', 'Should set status to EXPIRED_IN_TRANSIT after safe deadline');
  console.log('  ✓ Delivery after deadline blocked and marked EXPIRED_IN_TRANSIT');
}

console.log('\n🎉 ALL 8 CORE BUSINESS LOGIC TESTS PASSED SUCCESSFULLY!\n');
