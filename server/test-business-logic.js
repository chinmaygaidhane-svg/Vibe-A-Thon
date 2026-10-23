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

console.log('\n🎉 ALL 5 CORE BUSINESS LOGIC TESTS PASSED SUCCESSFULLY!\n');
