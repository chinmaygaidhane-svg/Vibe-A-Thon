import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import SharedLiveMap from './SharedLiveMap';
import StatusTimeline from './StatusTimeline';
import {
  Utensils,
  Search,
  Filter,
  Clock,
  MapPin,
  Truck,
  CheckCircle,
  AlertTriangle,
  Layers,
  Inbox,
  ShieldCheck,
  FileCheck,
  Building,
  Bell,
  RefreshCw,
  Info
} from 'lucide-react';

export default function ReceiverDashboard() {
  const { user, token } = useAuth();
  const { lastMessage, addToast } = useSocket();

  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'requests' | 'incoming' | 'history' | 'requirements' | 'notifications'
  const [donations, setDonations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [vegOnly, setVegOnly] = useState(false);
  const [sortOption, setSortOption] = useState('urgent');

  // Request Modal State
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [requestedQty, setRequestedQty] = useState('35');
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  // Receipt confirmation modal
  const [confirmingRequest, setConfirmingRequest] = useState(null);
  const [receiptNotes, setReceiptNotes] = useState('');
  const [discrepancy, setDiscrepancy] = useState('');

  const fetchDonations = async () => {
    try {
      const params = new URLSearchParams({
        search: searchQuery,
        category: selectedCategory,
        vegOnly: vegOnly.toString(),
        sort: sortOption
      });

      const res = await fetch(`/api/donations?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setDonations(data.donations || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const refreshAll = () => {
    fetchDonations();
    fetchRequests();
    fetchNotifications();
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, [token, selectedCategory, vegOnly, sortOption]);

  useEffect(() => {
    const delay = setTimeout(fetchDonations, 300);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  // WebSocket updates
  useEffect(() => {
    if (lastMessage) {
      fetchDonations();
      fetchRequests();
      fetchNotifications();
    }
  }, [lastMessage]);

  const handleOpenRequestModal = (donation) => {
    setSelectedDonation(donation);
    // default request up to 35 servings or available quantity
    const defaultQty = Math.min(35, donation.availableQuantity);
    setRequestedQty(defaultQty.toString());
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!selectedDonation) return;

    setRequestSubmitting(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          donationId: selectedDonation.id,
          requestedQuantity: parseInt(requestedQty)
        })
      });
      const data = await res.json();

      if (res.ok) {
        addToast({ title: 'Request Placed!', message: data.message, type: 'success' });
        setSelectedDonation(null);
        setActiveTab('incoming');
        refreshAll();
      } else {
        alert(data.error || 'Failed to place request');
      }
    } catch {
      alert('Error submitting request');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleConfirmReceipt = async (e) => {
    e.preventDefault();
    if (!confirmingRequest) return;

    try {
      const res = await fetch(`/api/requests/${confirmingRequest.id}/confirm-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          notes: receiptNotes,
          discrepancyReport: discrepancy.trim() ? discrepancy : null
        })
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ title: 'Receipt Confirmed', message: data.message, type: 'success' });
        setConfirmingRequest(null);
        refreshAll();
      } else {
        alert(data.error || 'Failed to confirm receipt');
      }
    } catch {
      alert('Error confirming receipt');
    }
  };

  const incomingDeliveries = requests.filter(
    r => r.assignmentStatus !== 'DELIVERED' && r.assignmentStatus !== 'CANCELLED_TIMEOUT'
  );
  const deliveredHistory = requests.filter(
    r => r.assignmentStatus === 'DELIVERED' || r.assignmentStatus === 'CANCELLED_TIMEOUT'
  );

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="role-badge receiver">Receiver Dashboard</span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{user?.name || 'Shelter A - Hope Haven'}</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            Browse live verified donor supplies, coordinate deliveries, and monitor arrival safely.
          </p>
        </div>

        <button onClick={refreshAll} className="btn btn-secondary">
          <RefreshCw size={15} /> Refresh Feed
        </button>
      </div>

      {/* Navigation Tabs (Sections 1-6) */}
      <div className="nav-tabs" style={{ marginBottom: '24px' }}>
        <button
          id="tab-available-donations"
          onClick={() => setActiveTab('available')}
          className={`nav-tab-item ${activeTab === 'available' ? 'active' : ''}`}
        >
          <Utensils size={16} /> 1. Available Donations ({donations.filter(d => d.availableQuantity > 0).length})
        </button>
        <button
          id="tab-my-requests"
          onClick={() => setActiveTab('requests')}
          className={`nav-tab-item ${activeTab === 'requests' ? 'active' : ''}`}
        >
          <Inbox size={16} /> 2. My Requests ({requests.length})
        </button>
        <button
          id="tab-incoming-deliveries"
          onClick={() => setActiveTab('incoming')}
          className={`nav-tab-item ${activeTab === 'incoming' ? 'active' : ''}`}
        >
          <Truck size={16} /> 3. Incoming Deliveries ({incomingDeliveries.length})
        </button>
        <button
          id="tab-delivery-history"
          onClick={() => setActiveTab('history')}
          className={`nav-tab-item ${activeTab === 'history' ? 'active' : ''}`}
        >
          <FileCheck size={16} /> 4. Delivery History ({deliveredHistory.length})
        </button>
        <button
          id="tab-shelter-reqs"
          onClick={() => setActiveTab('requirements')}
          className={`nav-tab-item ${activeTab === 'requirements' ? 'active' : ''}`}
        >
          <Building size={16} /> 5. Shelter Requirements
        </button>
        <button
          id="tab-notifications"
          onClick={() => setActiveTab('notifications')}
          className={`nav-tab-item ${activeTab === 'notifications' ? 'active' : ''}`}
        >
          <Bell size={16} /> 6. Notifications ({notifications.length})
        </button>
      </div>

      {/* SECTION 1: AVAILABLE DONATIONS FEED */}
      {activeTab === 'available' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Filters Bar */}
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                id="input-search-feed"
                type="text"
                placeholder="Search meals, donor, description..."
                className="form-input"
                style={{ paddingLeft: '38px', width: '100%' }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                id="select-category-filter"
                className="form-select"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Food Categories</option>
                <option value="cooked_meals">Cooked Meals</option>
                <option value="bakery_packaged">Bakery & Packaged</option>
                <option value="raw_rations">Raw Ration Kits</option>
                <option value="fresh_produce">Fresh Groceries</option>
              </select>

              <select
                id="select-sort-filter"
                className="form-select"
                value={sortOption}
                onChange={e => setSortOption(e.target.value)}
              >
                <option value="urgent">Sort: Urgent Feasible First</option>
                <option value="distance">Sort: Nearest Distance</option>
                <option value="quantity">Sort: Highest Quantity</option>
              </select>

              <button
                onClick={() => setVegOnly(!vegOnly)}
                className={`btn btn-sm ${vegOnly ? 'btn-primary' : 'btn-secondary'}`}
              >
                🥬 Veg Only
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="donations-grid">
            {donations.map(don => {
              const remainingHours = Math.floor(don.remainingMinutes / 60);
              const remainingMins = don.remainingMinutes % 60;
              const timeDisplay = don.remainingMinutes > 60
                ? `${remainingHours}h ${remainingMins}m`
                : `${don.remainingMinutes}m`;

              const isUrgent = don.remainingMinutes < 30;
              const isWarning = don.remainingMinutes < 60;

              return (
                <div key={don.id} className="glass-panel donation-card">
                  <div className="card-img-wrapper">
                    <img src={don.imageUrl} alt={don.mealName} />
                    <div className="card-badge">
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '2px',
                        background: don.isVegetarian ? '#10b981' : '#f43f5e',
                        display: 'inline-block'
                      }} />
                      {don.foodCategory.replace('_', ' ').toUpperCase()}
                    </div>

                    <div className={`card-time-badge ${isUrgent ? 'urgent' : isWarning ? 'warning' : 'safe'}`}>
                      <Clock size={13} /> {don.isExpired ? 'EXPIRED' : `${timeDisplay} left`}
                    </div>
                  </div>

                  <div className="card-body">
                    <div>
                      <span style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 600 }}>
                        🏪 {don.donorName} ({don.donorCategory})
                      </span>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '2px 0 6px' }}>{don.mealName}</h3>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        {don.description}
                      </p>
                    </div>

                    {/* Metadata: Distance, Handling, ETA */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '10px',
                      borderRadius: '8px',
                      fontSize: '0.78rem'
                    }}>
                      <div className="card-meta-row">
                        <span>📍 Approx Distance:</span>
                        <strong style={{ color: 'var(--text-main)' }}>{don.distanceKm} km away</strong>
                      </div>
                      <div className="card-meta-row">
                        <span>🛵 Estimated Delivery:</span>
                        <strong style={{ color: '#60a5fa' }}>~{don.travelTimeMins} minutes</strong>
                      </div>
                      <div className="card-meta-row">
                        <span>📦 Storage:</span>
                        <span>{don.storageRequirements.replace('_', ' ')}</span>
                      </div>
                    </div>

                    {/* Incompatibility / Unsafe Alert if any */}
                    {!don.isFeasible && (
                      <div style={{
                        background: 'rgba(244, 63, 94, 0.15)',
                        border: '1px solid rgba(244, 63, 94, 0.35)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        fontSize: '0.76rem',
                        color: '#fecdd3',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px'
                      }}>
                        <AlertTriangle size={14} style={{ color: '#f43f5e', flexShrink: 0, marginTop: '2px' }} />
                        <span>{don.incompatibilityReason}</span>
                      </div>
                    )}

                    {/* Footer Quantity & Request Button */}
                    <div style={{
                      marginTop: 'auto',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Available</span>
                        <strong style={{ fontSize: '1.15rem', color: '#34d399' }}>{don.availableQuantity}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> servings</span>
                      </div>

                      <button
                        id={`btn-request-${don.id}`}
                        onClick={() => handleOpenRequestModal(don)}
                        disabled={!don.isFeasible || don.availableQuantity <= 0 || don.isExpired}
                        className={`btn btn-sm ${don.isFeasible && don.availableQuantity > 0 && !don.isExpired ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ opacity: don.isFeasible && don.availableQuantity > 0 && !don.isExpired ? 1 : 0.5 }}
                      >
                        {don.isExpired ? 'Expired' : !don.isFeasible ? 'Incompatible' : '🛒 Order Food'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: MY REQUESTS */}
      {activeTab === 'requests' && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Requested Meal Allocations</h3>

          {requests.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No requests placed yet. Browse the Available Donations feed to request meals.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {requests.map(r => (
                <div
                  key={r.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{r.mealName}</h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Donor: {r.donorName} • Quantity: <strong style={{ color: '#34d399' }}>{r.quantityRequested} servings</strong>
                    </span>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-dim)', margin: '4px 0 0' }}>
                      Requested: {new Date(r.requestedAt).toLocaleTimeString()}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      background: 'rgba(99, 102, 241, 0.2)',
                      color: '#a5b4fc',
                      border: '1px solid rgba(99, 102, 241, 0.4)'
                    }}>
                      {r.assignmentStatus}
                    </span>

                    <button
                      onClick={() => setActiveTab('incoming')}
                      className="btn btn-sm btn-secondary"
                    >
                      Track Delivery
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: INCOMING DELIVERIES WITH SHARED LIVE MAP */}
      {activeTab === 'incoming' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {incomingDeliveries.length === 0 ? (
            <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
              <Truck size={42} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No Incoming Deliveries In Progress</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '6px' }}>
                Request meals from the feed above to watch real-time pickup and live transit.
              </p>
              <button onClick={() => setActiveTab('available')} className="btn btn-primary" style={{ marginTop: '16px' }}>
                Browse Food Feed
              </button>
            </div>
          ) : (
            incomingDeliveries.map(del => (
              <div key={del.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="pulsing-dot indigo"></span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Incoming: {del.mealName}</h3>
                    </div>
                    <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      Donor: {del.donorName} • Quantity: <strong style={{ color: '#34d399' }}>{del.quantityRequested} servings</strong>
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      padding: '6px 14px',
                      borderRadius: '999px',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.4)'
                    }}>
                      Status: {del.assignmentStatus}
                    </span>
                  </div>
                </div>

                {/* Status Timeline */}
                <StatusTimeline status={del.assignmentStatus} />

                {/* Rider Telemetry Info */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '16px',
                  borderRadius: '12px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Courier</span>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fcd34d' }}>
                      🛵 {del.assignedRiderName || 'Searching nearby riders...'}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Vehicle: {del.riderVehicle || 'Two-Wheeler'}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Arrival</span>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399' }}>
                      ~{del.deliveryETA} minutes
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Distance: ~{del.distanceKm} km
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Safe-Use Window</span>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#60a5fa' }}>
                      Target: Safe for consumption
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Deadline: {new Date(del.safeUseDeadline).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Redirection Notice if dynamically rerouted */}
                {del.redirectHistory && del.redirectHistory.length > 0 && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontSize: '0.84rem'
                  }}>
                    <strong style={{ color: '#fbbf24' }}>⚠️ Route Reassignment Active:</strong>
                    <p style={{ margin: '4px 0 0', color: '#f3f4f6' }}>{del.deliveryNotes}</p>
                  </div>
                )}

                {/* Shared Map */}
                <SharedLiveMap request={del} role="receiver" />

                {/* Action if Delivered */}
                {del.assignmentStatus === 'DELIVERED' && !del.receiptConfirmed && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    padding: '16px',
                    borderRadius: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div>
                      <h4 style={{ color: '#34d399', fontWeight: 700 }}>Rider Has Arrived!</h4>
                      <p style={{ fontSize: '0.82rem', margin: '2px 0 0', color: 'var(--text-muted)' }}>
                        Please inspect meal temperature/packaging and confirm delivery receipt.
                      </p>
                    </div>

                    <button
                      onClick={() => setConfirmingRequest(del)}
                      className="btn btn-primary"
                    >
                      <CheckCircle size={16} /> Confirm Receipt & Quality
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* SECTION 4: DELIVERY HISTORY */}
      {activeTab === 'history' && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Past Completed Deliveries</h3>

          {deliveredHistory.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No completed deliveries recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {deliveredHistory.map(h => (
                <div
                  key={h.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{h.mealName}</h4>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Donor: {h.donorName} • Delivered: <strong style={{ color: '#34d399' }}>{h.quantityRequested} servings</strong>
                    </span>
                    <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '4px 0 0' }}>
                      Rider: {h.assignedRiderName || 'Courier'} • {h.deliveryNotes || 'Received in good order'}
                    </p>
                  </div>

                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399'
                  }}>
                    {h.assignmentStatus}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 5: SHELTER REQUIREMENTS */}
      {activeTab === 'requirements' && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Shelter Capacity & Safety Requirements</h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Storage Capacity</span>
              <h4 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{user?.storageCapacity || 120} Servings</h4>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Cooking Facilities</span>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: user?.cookingFacilities ? '#34d399' : '#f43f5e' }}>
                {user?.cookingFacilities ? '✅ Operational Kitchen' : '❌ No Kitchen (Cooked Meals Only)'}
              </h4>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Clean Water Availability</span>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: user?.cleanWater ? '#34d399' : '#f43f5e' }}>
                {user?.cleanWater ? '✅ Verified Clean Source' : '❌ Limited Supply'}
              </h4>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Operating Hours</span>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#60a5fa' }}>
                {user?.operatingHours || '6:00 AM - 11:00 PM'}
              </h4>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Operational Alerts & Activity Feed</h3>

          {notifications.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No notifications yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notifications.map(n => (
                <div
                  key={n.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#f3f4f6' }}>{n.title}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {new Date(n.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: 0 }}>{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Request Meal Confirmation */}
      {selectedDonation && (
        <div className="modal-overlay" onClick={() => setSelectedDonation(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>🛒 Order Food from Donor</h3>
              <button
                onClick={() => setSelectedDonation(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitRequest}>
              <div className="modal-body">
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedDonation.mealName}</h4>
                  <span style={{ fontSize: '0.82rem', color: '#a5b4fc' }}>
                    Offered by: {selectedDonation.donorName} ({selectedDonation.donorCategory})
                  </span>
                </div>

                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  padding: '14px',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '0.82rem'
                }}>
                  <div className="card-meta-row">
                    <span>Available Quantity:</span>
                    <strong style={{ color: '#34d399' }}>{selectedDonation.availableQuantity} servings</strong>
                  </div>
                  <div className="card-meta-row">
                    <span>Pickup Point:</span>
                    <span>{selectedDonation.pickupAddress}</span>
                  </div>
                  <div className="card-meta-row">
                    <span>Estimated Transit:</span>
                    <span style={{ color: '#60a5fa' }}>~{selectedDonation.travelTimeMins} mins ({selectedDonation.distanceKm} km)</span>
                  </div>
                  <div className="card-meta-row">
                    <span>Safe-Use Window:</span>
                    <span style={{ color: '#fbbf24' }}>{selectedDonation.remainingMinutes} minutes remaining</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Quantity to Order (Servings) * (Max: {selectedDonation.availableQuantity})
                  </label>
                  <input
                    id="input-request-servings"
                    type="number"
                    required
                    min="1"
                    max={selectedDonation.availableQuantity}
                    className="form-input"
                    value={requestedQty}
                    onChange={e => setRequestedQty(e.target.value)}
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    AidFlow AI coordinates with nearby volunteer riders to pick up and deliver this order to your shelter.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setSelectedDonation(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  id="btn-confirm-request"
                  type="submit"
                  disabled={requestSubmitting}
                  className="btn btn-primary"
                >
                  {requestSubmitting ? 'Placing Order...' : 'Confirm & Place Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Receipt & Discrepancies */}
      {confirmingRequest && (
        <div className="modal-overlay" onClick={() => setConfirmingRequest(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Confirm Meal Receipt</h3>
              <button
                onClick={() => setConfirmingRequest(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmReceipt}>
              <div className="modal-body">
                <p style={{ fontSize: '0.88rem' }}>
                  Please confirm that you have received <strong>{confirmingRequest.quantityRequested} servings</strong> of <strong>{confirmingRequest.mealName}</strong> from Rider <strong>{confirmingRequest.assignedRiderName}</strong>.
                </p>

                <div className="form-group">
                  <label className="form-label">Quality & Receipt Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Received warm in sealed containers"
                    value={receiptNotes}
                    onChange={e => setReceiptNotes(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Discrepancy Report (Optional)</label>
                  <textarea
                    rows="2"
                    className="form-textarea"
                    placeholder="Report damaged containers, missing items, or delays if any"
                    value={discrepancy}
                    onChange={e => setDiscrepancy(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setConfirmingRequest(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Confirmation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
