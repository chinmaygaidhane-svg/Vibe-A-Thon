import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import SharedLiveMap from './SharedLiveMap';
import StatusTimeline from './StatusTimeline';
import {
  Plus,
  Clock,
  MapPin,
  Truck,
  CheckCircle,
  AlertTriangle,
  Layers,
  ShieldCheck,
  RefreshCw,
  Phone,
  Navigation
} from 'lucide-react';

export default function DonorDashboard() {
  const { user, token } = useAuth();
  const { lastMessage, addToast } = useSocket();

  const [stats, setStats] = useState({
    totalCreated: 0,
    totalAvailableQuantity: 0,
    availableDonations: 0,
    reservedDonations: 0,
    pickupsInProgress: 0,
    completedDeliveries: 0,
    expiryAlertsCount: 0
  });

  const [donations, setDonations] = useState([]);
  const [activeRequests, setActiveRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // New Donation Form state
  const [formData, setFormData] = useState({
    mealName: '',
    foodCategory: 'cooked_meals',
    isVegetarian: true,
    totalQuantity: '50',
    servingsCount: '50',
    safeUseHours: '2.5',
    description: '',
    pickupAddress: user?.pickupAddress || 'FC Road, Shivaji Nagar, Pune',
    storageRequirements: 'hot_insulated',
    handlingInstructions: 'Keep in insulated containers above 60°C.',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'
  });

  const fetchData = async () => {
    try {
      const res = await fetch('/api/donations/donor/dashboard-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        setDonations(data.donations);
        setActiveRequests(data.activeRequests);
        if (data.activeRequests.length > 0 && !selectedRequest) {
          setSelectedRequest(data.activeRequests[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // WebSocket live updates
  useEffect(() => {
    if (lastMessage) {
      fetchData();
    }
  }, [lastMessage]);

  const handleCreateDonation = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.mealName,
        mealName: formData.mealName,
        total_quantity: parseInt(formData.totalQuantity),
        totalQuantity: parseInt(formData.totalQuantity),
        servingsCount: parseInt(formData.totalQuantity),
        category: formData.foodCategory,
        foodCategory: formData.foodCategory,
        veg_type: formData.isVegetarian ? 'veg' : 'non-veg',
        isVegetarian: formData.isVegetarian,
        safe_use_hours: parseFloat(formData.safeUseHours),
        safeUseHours: parseFloat(formData.safeUseHours),
        description: formData.description,
        pickup_address: formData.pickupAddress,
        pickupAddress: formData.pickupAddress,
        storage_requirements: formData.storageRequirements,
        storageRequirements: formData.storageRequirements,
        handling_instructions: formData.handlingInstructions,
        handlingInstructions: formData.handlingInstructions,
        image_url: formData.imageUrl,
        imageUrl: formData.imageUrl
      };

      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ title: 'Donation Listed!', message: data.message, type: 'success' });
        setShowAddModal(false);
        setFormData({
          mealName: '',
          foodCategory: 'cooked_meals',
          isVegetarian: true,
          totalQuantity: '50',
          servingsCount: '50',
          safeUseHours: '2.5',
          description: '',
          pickupAddress: user?.pickupAddress || 'FC Road, Shivaji Nagar, Pune',
          storageRequirements: 'hot_insulated',
          handlingInstructions: 'Keep in insulated containers above 60°C.',
          imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'
        });
        fetchData();
      } else {
        alert(data.error || 'Failed to create donation');
      }
    } catch {
      alert('Error creating donation');
    }
  };

  // Safe countdown formatting
  const getRemainingTimeText = (deadlineIso) => {
    const remainingMs = new Date(deadlineIso).getTime() - Date.now();
    if (remainingMs <= 0) return { text: 'EXPIRED', class: 'urgent' };
    const mins = Math.floor(remainingMs / (60 * 1000));
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    if (mins < 30) return { text: `${mins}m remaining`, class: 'urgent' };
    if (mins < 60) return { text: `${mins}m remaining`, class: 'warning' };
    return { text: `${hours}h ${m}m remaining`, class: 'safe' };
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="role-badge donor">Donor Dashboard</span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{user?.name || 'ABC Restaurant'}</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            Coordinate and track surplus food distribution with local shelters & riders in real-time.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchData} className="btn btn-secondary">
            <RefreshCw size={15} /> Refresh
          </button>
          <button id="btn-open-add-donation" onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus size={16} /> Broadcast Food (Tell Receivers & Riders)
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <span className="stat-label">Total Created</span>
          <span className="stat-val">{stats.totalCreated}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Donation batches</span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Available Servings</span>
          <span className="stat-val" style={{ color: '#34d399' }}>{stats.totalAvailableQuantity}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ready for pickup</span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Pickups In Progress</span>
          <span className="stat-val" style={{ color: '#f59e0b' }}>{stats.pickupsInProgress}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Riders dispatched</span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Completed Deliveries</span>
          <span className="stat-val" style={{ color: '#818cf8' }}>{stats.completedDeliveries}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Shelters served</span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Expiry Alerts</span>
          <span className="stat-val" style={{ color: stats.expiryAlertsCount > 0 ? '#f43f5e' : 'var(--text-muted)' }}>
            {stats.expiryAlertsCount}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>&lt; 45 mins left</span>
        </div>
      </div>

      {/* Main Grid: Active Deliveries & Tracking vs Donations List */}
      <div style={{ display: 'grid', gridTemplateColumns: activeRequests.length > 0 ? '1.2fr 1fr' : '1fr', gap: '24px' }}>
        {/* Left Column: Live Delivery Tracking */}
        {activeRequests.length > 0 && (
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="pulsing-dot green"></span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Live Donation Tracking</h3>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {activeRequests.length} active delivery
              </span>
            </div>

            {/* Request Selector Tabs if multiple */}
            {activeRequests.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {activeRequests.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRequest(r)}
                    className={`btn btn-sm ${selectedRequest?.id === r.id ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {r.mealName} ({r.quantityRequested} serv.)
                  </button>
                ))}
              </div>
            )}

            {selectedRequest && (
              <>
                {/* Status Timeline */}
                <StatusTimeline status={selectedRequest.assignmentStatus} />

                {/* Handover Pickup Verification Code (Update 4) */}
                {selectedRequest.pickupCode && (
                  <div style={{
                    background: '#FFF7ED',
                    border: '1px solid #FFEDD5',
                    borderRadius: '12px',
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Handover Pickup Verification Code
                      </span>
                      <p style={{ margin: '3px 0 0', fontSize: '0.84rem', color: '#1E293B' }}>
                        Provide this 4-digit code to the rider at food collection to verify handover:
                      </p>
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '1.6rem',
                      fontWeight: 800,
                      letterSpacing: '6px',
                      background: '#FFFFFF',
                      color: '#EA580C',
                      padding: '6px 18px',
                      borderRadius: '8px',
                      border: '2px dashed #FB923C'
                    }}>
                      {selectedRequest.pickupCode}
                    </div>
                  </div>
                )}

                {/* Telemetry info cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  background: '#F8FAFC',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Rider</span>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#D97706' }}>
                      🛵 {selectedRequest.assignedRiderName || 'Awaiting assignment'}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Vehicle: {selectedRequest.riderVehicle || 'Two-Wheeler'}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target Beneficiary</span>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#4F46E5' }}>
                      🏠 {selectedRequest.receiverName}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Req: {selectedRequest.quantityRequested} servings
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated ETAs</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#059669' }}>
                        Pickup: ~{selectedRequest.pickupETA}m
                      </span>
                      <span>•</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563EB' }}>
                        Drop: ~{selectedRequest.deliveryETA}m
                      </span>
                    </div>
                  </div>
                </div>

                {/* In-Transit Redirection Banner if applicable */}
                {selectedRequest.redirectHistory && selectedRequest.redirectHistory.length > 0 && (
                  <div style={{
                    background: '#FEF3C7',
                    border: '1px solid #FDE68A',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontSize: '0.84rem'
                  }}>
                    <strong style={{ color: '#B45309' }}>⚠️ In-Transit Redirection Recorded:</strong>
                    <p style={{ margin: '4px 0 0', color: '#78350F' }}>
                      {selectedRequest.deliveryNotes}
                    </p>
                  </div>
                )}

                {/* Live Leaflet Map */}
                <SharedLiveMap request={selectedRequest} role="donor" />
              </>
            )}
          </div>
        )}

        {/* Right Column: Your Donations List */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Your Food Donations</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{donations.length} records</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '600px', overflowY: 'auto' }}>
            {donations.map(d => {
              const countdown = getRemainingTimeText(d.safeUseDeadline);
              return (
                <div
                  key={d.id}
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '2px',
                          background: d.isVegetarian ? '#16a34a' : '#dc2626',
                          display: 'inline-block'
                        }} title={d.isVegetarian ? 'Vegetarian' : 'Non-Vegetarian'} />
                        <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{d.mealName}</h4>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <MapPin size={12} /> {d.pickupAddress}
                      </span>
                    </div>

                    <span className={`card-time-badge ${countdown.class}`} style={{ position: 'static' }}>
                      <Clock size={12} /> {countdown.text}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: '#475569', margin: 0 }}>
                    {d.description}
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.8rem',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-subtle)'
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Available: </span>
                      <strong style={{ color: '#059669' }}>{d.availableQuantity}</strong>
                      <span style={{ color: 'var(--text-muted)' }}> / {d.totalQuantity} servings</span>
                    </div>

                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: d.status === 'AVAILABLE' ? '#ECFDF5' : '#EEF2FF',
                      color: d.status === 'AVAILABLE' ? '#059669' : '#4F46E5',
                      border: `1px solid ${d.status === 'AVAILABLE' ? '#A7F3D0' : '#C7D2FE'}`
                    }}>
                      {d.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal: Add Donation */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>📢 Broadcast Food (Tell Receivers & Riders)</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Notifies shelters to order portions and riders to coordinate delivery in real time.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateDonation}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Meal or Supply Name *</label>
                  <input
                    id="input-meal-name"
                    type="text"
                    required
                    placeholder="e.g. Vegetable Pulao, Paneer Masala, Bread Loaves"
                    className="form-input"
                    value={formData.mealName}
                    onChange={e => setFormData({ ...formData, mealName: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Food Category *</label>
                    <select
                      className="form-select"
                      value={formData.foodCategory}
                      onChange={e => setFormData({ ...formData, foodCategory: e.target.value })}
                    >
                      <option value="cooked_meals">Cooked Meals</option>
                      <option value="bakery_packaged">Bakery & Packaged</option>
                      <option value="raw_rations">Raw Ration Kits</option>
                      <option value="fresh_produce">Fresh Groceries</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Dietary Type</label>
                    <select
                      className="form-select"
                      value={formData.isVegetarian ? 'veg' : 'non-veg'}
                      onChange={e => setFormData({ ...formData, isVegetarian: e.target.value === 'veg' })}
                    >
                      <option value="veg">Vegetarian</option>
                      <option value="non-veg">Non-Vegetarian</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Quantity (Servings) *</label>
                    <input
                      id="input-quantity"
                      type="number"
                      required
                      min="1"
                      className="form-input"
                      value={formData.totalQuantity}
                      onChange={e => setFormData({ ...formData, totalQuantity: e.target.value, servingsCount: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Configurable Safe-Use Window *</label>
                    <select
                      id="select-safe-hours"
                      className="form-select"
                      value={formData.safeUseHours}
                      onChange={e => setFormData({ ...formData, safeUseHours: e.target.value })}
                    >
                      <option value="1">1 Hour (High Urgency)</option>
                      <option value="2.5">2.5 Hours (Standard Cooked)</option>
                      <option value="4">4 Hours (Insulated Cooked)</option>
                      <option value="12">12 Hours (Bakery/Packaged)</option>
                      <option value="72">3 Days (Raw Rations)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Pickup Address *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={formData.pickupAddress}
                    onChange={e => setFormData({ ...formData, pickupAddress: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Storage & Special Handling Requirements</label>
                  <select
                    className="form-select"
                    value={formData.storageRequirements}
                    onChange={e => setFormData({ ...formData, storageRequirements: e.target.value })}
                  >
                    <option value="hot_insulated">Hot Insulated (&gt; 60°C)</option>
                    <option value="ambient">Ambient / Room Temperature</option>
                    <option value="refrigerated">Refrigerated (&lt; 4°C)</option>
                    <option value="frozen">Frozen (&lt; -18°C)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Description & Handling Details</label>
                  <textarea
                    rows="3"
                    className="form-textarea"
                    placeholder="Details about preparation, food containers, allergens, etc."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button id="btn-submit-donation" type="submit" className="btn btn-primary">
                  📢 Broadcast Food (Tell Receivers & Riders)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
