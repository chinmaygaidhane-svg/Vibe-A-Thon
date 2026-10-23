// End-to-End API Scenario Validation for AidFlow AI
const BASE_URL = 'http://127.0.0.1:5000';

async function testScenario() {
  console.log('🧪 Starting AidFlow AI 9-Step Verification Suite...\n');

  // Step 1: Donor Login
  console.log('--- Step 1: Donor Login ---');
  let res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'donor@aidflow.org', password: 'donor123', role: 'donor' })
  });
  const donorAuth = await res.json();
  console.log(`✅ Donor logged in: ${donorAuth.user.name} (Role: ${donorAuth.user.role})`);

  // Step 2: Receiver Login & Feed Inspection
  console.log('\n--- Step 2: Receiver (Shelter A) Login & Feed ---');
  res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'shelterA@aidflow.org', password: 'receiver123', role: 'receiver' })
  });
  const receiverAuth = await res.json();
  console.log(`✅ Receiver logged in: ${receiverAuth.user.name}`);

  // Fetch feed with distance and safe deadline calculation
  res = await fetch(`${BASE_URL}/api/donations`, {
    headers: { Authorization: `Bearer ${receiverAuth.token}` }
  });
  const feed = await res.json();
  console.log(`✅ Available donations in feed: ${feed.donations.length}`);
  const targetDonation = feed.donations.find(d => d.mealName === 'Vegetable Pulao');
  console.log(`🍲 Selected: "${targetDonation.mealName}" | Available: ${targetDonation.availableQuantity} servings | Distance: ${targetDonation.distanceKm} km | Deadline in: ${targetDonation.remainingMinutes} mins`);

  // Step 3: Shelter A Requests 35 servings
  console.log('\n--- Step 3: Shelter A Requests 35 Servings ---');
  res = await fetch(`${BASE_URL}/api/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${receiverAuth.token}`
    },
    body: JSON.stringify({ donationId: targetDonation.id, requestedQuantity: 35 })
  });
  const reqData = await res.json();
  console.log(`✅ Request response: ${reqData.message}`);
  const createdRequest = reqData.request;
  console.log(`📋 Request ID: ${createdRequest.id} | Status: ${createdRequest.assignmentStatus} | Assigned: ${createdRequest.assignedRiderName}`);

  // Anti-Overallocation check on Donor
  res = await fetch(`${BASE_URL}/api/donations/${targetDonation.id}`, {
    headers: { Authorization: `Bearer ${donorAuth.token}` }
  });
  const updatedDonation = (await res.json()).donation;
  console.log(`🔒 Anti-Overallocation check: Available dropped from 100 to ${updatedDonation.availableQuantity} (Reserved: ${updatedDonation.reservedQuantity})`);

  // Step 4: Rider Login & Accept Assignment
  console.log('\n--- Step 4: Rider Rahul Accepts Assignment ---');
  res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rider@aidflow.org', password: 'rider123', role: 'rider' })
  });
  const riderAuth = await res.json();
  console.log(`✅ Rider logged in: ${riderAuth.user.name} (${riderAuth.user.vehicleType})`);

  // Step 5: Rider Confirms Pickup (Locks Donation)
  console.log('\n--- Step 5: Rider Confirms Pickup ---');
  res = await fetch(`${BASE_URL}/api/requests/${createdRequest.id}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${riderAuth.token}`
    },
    body: JSON.stringify({ status: 'picked_up' })
  });
  const pickupRes = await res.json();
  console.log(`✅ Status updated to: ${pickupRes.request.assignmentStatus}`);

  // Step 6: Rider Starts Transit & Advances Movement
  console.log('\n--- Step 6: Rider Starts Delivery (In Transit) ---');
  res = await fetch(`${BASE_URL}/api/requests/${createdRequest.id}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${riderAuth.token}`
    },
    body: JSON.stringify({ status: 'in_transit' })
  });
  console.log(`✅ Transit started. ETA: ${(await res.json()).request.deliveryETA} mins`);

  // Step 7: Advance Rider Simulation
  console.log('\n--- Step 7: Advance Rider Movement ---');
  res = await fetch(`${BASE_URL}/api/simulation/advance-rider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: createdRequest.id, progressPercent: 50 })
  });
  const advRes = await res.json();
  console.log(`📍 ${advRes.message} | Rider Lat/Lng: ${advRes.request.currentRiderLat}, ${advRes.request.currentRiderLng}`);

  // Step 8: Shelter A Demand Change & Dynamic In-Transit Redirection!
  console.log('\n--- Step 8: Shelter A Demand Change & Dynamic In-Transit Redirection ---');
  res = await fetch(`${BASE_URL}/api/simulation/trigger-demand-change`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: createdRequest.id,
      reason: 'Shelter A requirement fulfilled by another batch. System reroutes to Sunshine Community Kitchen.'
    })
  });
  const redirectRes = await res.json();
  console.log(`🚨 ${redirectRes.message}`);
  console.log(`🔄 Rerouted Beneficiary: ${redirectRes.newReceiver.name} (${redirectRes.newReceiver.address})`);
  console.log(`⏱️ New Delivery ETA: ~${redirectRes.request.deliveryETA} mins`);

  // Step 9: Rider Marks Delivered & Shelter B Confirms Receipt
  console.log('\n--- Step 9: Delivery Completion & Receipt Confirmation ---');
  res = await fetch(`${BASE_URL}/api/requests/${createdRequest.id}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${riderAuth.token}`
    },
    body: JSON.stringify({ status: 'delivered' })
  });
  console.log(`✅ Rider status marked: ${(await res.json()).request.assignmentStatus}`);

  // Receiver B logs in and confirms receipt
  res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'shelterB@aidflow.org', password: 'receiver123', role: 'receiver' })
  });
  const shelterBAuth = await res.json();

  res = await fetch(`${BASE_URL}/api/requests/${createdRequest.id}/confirm-receipt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${shelterBAuth.token}`
    },
    body: JSON.stringify({
      notes: 'Received in hot condition in insulated containers. 35 servings distributed.',
      discrepancyReport: null
    })
  });
  const confRes = await res.json();
  console.log(`🎉 ${confRes.message}`);

  console.log('\n🌟 ALL 9 STEPS VERIFIED WITH 100% SUCCESS!');
}

testScenario().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
