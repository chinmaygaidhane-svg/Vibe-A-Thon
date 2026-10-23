# ⚡ AidFlow AI

> **Real-Time Surplus Food Donation & Rapid Courier Coordination Platform**  
> Built for zero food waste, emergency humanitarian logistics, and failure-resilient surplus meal distribution.

---

## 🌟 Tech Stack

* **Frontend**: React (Vite) + Tailwind CSS + React Router + Leaflet (`react-leaflet`) with OpenStreetMap tiles
* **Backend**: Node.js + Express + Socket.IO (with room-isolated real-time synchronization)
* **Database**: SQLite via `better-sqlite3` (WAL mode enabled, zero-setup, encapsulated in a single database layer for seamless migration to PostgreSQL)
* **Authentication**: bcrypt password hashing + JWT in `httpOnly` cookie with role verification
* **Architecture**: Monorepo (`/client` and `/server`), with unified launch script

---

## 🚀 Quick Start Guide

### 1. Prerequisites
* Node.js v18+ (tested and verified on Node.js v24)
* npm v9+

### 2. Setup & Seeding
In the project root, seed the database with initial demo accounts, facilities, and realistic donations:

```bash
# Seed the SQLite database with demo accounts & food batches
npm run seed
```

### 3. Run Both Server & Website
Launch both backend and frontend simultaneously with a single command:

```bash
npm run dev
# or
npm start
```

* **Frontend Website**: [http://localhost:3000](http://localhost:3000)
* **Backend API & WebSocket**: [http://localhost:5000](http://localhost:5000)

---

## 🧪 Automated Business Logic Tests

To run the automated test suite verifying all 5 core engines (feasibility timing, facility compatibility rejection, atomic quantity integrity, ghost reservation recovery, and in-transit dynamic rerouting):

```bash
npm test
```

---

## 👥 Demo Accounts (Password for all: `Demo@1234`)

| Role | Organization / Name | Email | Password | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Donor** | ABC Restaurant | `donor@aidflow.org` | `Demo@1234` | FC Road, Pune • Restaurant |
| **Donor** | College Hostel Mess | `hostel@aidflow.org` | `Demo@1234` | Law College Road • Mess Kitchen |
| **Donor** | XYZ Bakery | `bakery@aidflow.org` | `Demo@1234` | MG Road Camp • Bakery |
| **Receiver** | Shelter A - Hope Haven | `shelterA@aidflow.org` | `Demo@1234` | Koregaon Park • Cooking: YES • Water: YES |
| **Receiver** | Shelter B - Sunshine Kitchen | `shelterB@aidflow.org` | `Demo@1234` | MG Road Camp • Cooking: YES • Water: YES |
| **Receiver** | Relief Camp C - Care Home | `reliefC@aidflow.org` | `Demo@1234` | Aundh • Cooking: **NO** (tests raw ration rejection) |
| **Rider** | Rider Rahul | `rider@aidflow.org` | `Demo@1234` | Motorbike • Capacity: 40 servings |
| **Rider** | Rider Priya | `rider2@aidflow.org` | `Demo@1234` | Mini-Truck • Capacity: 120 servings |
| **Rider** | Rider Amit | `rider3@aidflow.org` | `Demo@1234` | Scooter • Capacity: 50 servings |

> 💡 **Tip:** You can also use the one-click **JUDGE SANDBOX** switcher bar pinned to the top of the screen to switch between roles instantly without typing credentials!

---

## 🏆 Required Demo Scenario (Walkthrough for Judges)

Follow these step-by-step instructions to demonstrate the full end-to-end failure handling and delivery coordination:

### Step 1: Donor Broadcasts Food
1. Login or click **"🏪 Donor (ABC Rest.)"** in the top sandbox bar.
2. View **Vegetable Pulao with Raita (100 servings)** prepared with a safe-until deadline.
3. (Optional) Click **"+ Broadcast Food (Tell Receivers & Riders)"** to publish a new batch with custom safe-use window.

### Step 2 & 3: Shelter A Orders Meals
1. Switch to **"🏠 Shelter A"** using the top sandbox bar.
2. In the **Available Donations** feed, locate Vegetable Pulao.
3. Click **"🛒 Order Food"**, enter **35 servings**, and confirm.
4. Notice that remaining quantity atomically decrements to **65 servings**.

### Step 4 & 5: Rider Rahul Accepts Assignment
1. Switch to **"🛵 Rider Rahul"** using the top sandbox bar.
2. Under **"1. Delivery Missions"**, observe the newly created delivery assignment for 35 servings.
3. Click **"Accept Assignment"**. Both Donor and Receiver dashboards synchronize to show Rahul as the assigned courier.

### Step 6 & 7: Pickup & Live Transit Simulation
1. Rahul clicks **"1. Head to Pickup Point"**, then **"2. Confirm Pickup (Locks Donation)"**.
2. Rahul clicks **"3. Start Delivery (Transit)"** &rarr; status updates to **`IN_TRANSIT`**.
3. Click **"Rider Move (+25%)"** in the top sandbox bar. Notice the rider's marker smoothly advance along the route on the interactive Leaflet map.

### Step 8: Dynamic In-Transit Redirection! 🚨
1. While the mission is `IN_TRANSIT`, click **"Step 8: Demand Filled Redirect"** in the top sandbox bar.
2. AidFlow AI calculates alternative candidate shelters from the rider's current computed coordinates.
3. The system finds compatible **Shelter B**, automatically redirects the rider, recalculates distance and ETA, and displays a prominent warning banner across all three dashboards.

### Step 9: Delivery Complete & Receipt Confirmation
1. As Rider Rahul, click **"4. Mark Delivered at Destination"**.
2. Switch to **Shelter B** &rarr; click **"Confirm Receipt"** (with optional discrepancy report).
3. Open the **Operations Center** (`/operations`) to view the complete tamper-evident audit log of the mission.

---

## 🛡️ Failure Scenarios Demonstrated

* **Ghost Reservation Timeout Recovery**: If a courier accepts a reservation but goes unresponsive for >2 minutes, the system automatically recovers the reservation, restores available quantity to the donor, and reassigns.
* **Incompatible Facility Rejection**: If Relief Camp C (which lacks cooking facilities) attempts to order Raw Ration Kits, the system automatically rejects the request with an explicit compatibility error.
* **Overallocation Prevention**: Database transactions ensure multiple concurrent requests cannot over-subscribe donor inventory.
* **Expiry Window Enforcement**: Expired items are strictly blocked from new order placement, and countdown timers dynamically alert couriers under 30 and 10 minutes.
