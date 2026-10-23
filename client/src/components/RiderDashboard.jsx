import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import SharedLiveMap from './SharedLiveMap';
import StatusTimeline from './StatusTimeline';
import {
  Bike,
  Navigation,
  CheckCircle,
  PackageCheck,
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  RefreshCw,
  Shield,
  Layers,
  FastForward,
  Utensils,
  Search,
  Check,
  Inbox
} from 'lucide-react';
import { Modal, Button, AlertBanner } from '../ui';

export default function RiderDashboard() {
  const { user, token } = useAuth();
  const { lastMessage, addToast } = useSocket();

  const [activeTab, setActiveTab] = useState('missions'); // 'missions' | 'food_broadcasts'
  const [requests, setRequests] = useState([]);
  const [donations, setDonations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Stuck in traffic state
  const [showStuckModal, setShowStuckModal] = useState(false);
  const [stuckReason, setStuckReason] = useState('Heavy traffic congestion on main route');
  const [stuckDelayMinutes, setStuckDelayMinutes] = useState(15);
  const [submittingStuck, setSubmittingStuck] = useState(false);

  // Verification code modal state (Update 4)
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [codeModalAction, setCodeModalAction] = useState('picked_up'); // 'picked_up' | 'delivered'
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);

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

  const fetchDonations = async () => {
    try {
      const res = await fetch('/api/donations', {
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

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([fetchRequests(), fetchDonations()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, [token]);

  useEffect(() => {
    if (lastMessage) {
      fetchRequests();
      fetchDonations();
    }
  }, [lastMessage]);

  const activeAssignment = requests.find(
    r =>
      r.assignedRiderId === user?.id &&
      r.assignmentStatus !== 'DELIVERED' &&
      r.assignmentStatus !== 'CANCELLED_TIMEOUT'
  );

  const availableAssignments = requests.filter(
    r => (r.assignmentStatus === 'AWAITING_RIDER' || (!r.assignedRiderId && r.assignmentStatus === 'REQUESTED'))
  );

  const completedAssignments = requests.filter(
    r => r.assignedRiderId === user?.id && r.assignmentStatus === 'DELIVERED'
  );

  const handleAcceptAssignment = async (requestId) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ title: 'Assignment Accepted!', message: data.message, type: 'success' });
        refreshAll();
        setActiveTab('missions');
      } else {
        alert(data.error || 'Failed to accept assignment');
      }
    } catch {
      alert('Error accepting assignment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (requestId, nextStatus) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ title: 'Status Updated!', message: data.message, type: 'info' });
        fetchRequests();
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch {
      alert('Error updating status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvanceSimulation = async () => {
    if (!activeAssignment) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/simulation/advance-rider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: activeAssignment.id })
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ title: 'Rider Location Advanced', message: data.message, type: 'info' });
        fetchRequests();
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportStuck = async () => {
    if (!activeAssignment) return;
    const asgnId = activeAssignment.assignmentId || activeAssignment.assignments?.[0]?.id;
    if (!asgnId) return;
    setSubmittingStuck(true);
    try {
      const res = await fetch(`/api/assignments/${asgnId}/stuck`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: stuckReason,
          delayMinutes: parseInt(stuckDelayMinutes) || 15
        })
      });
      const data = await res.json();
      if (res.ok) {
        addToast({
          title: 'Traffic Delay Logged',
          message: data.message || `Risk level evaluated to ${data.risk_level}`,
          type: data.risk_level === 'WILL_MISS' ? 'critical' : 'warning'
        });
        setShowStuckModal(false);
        fetchRequests();
      } else {
        alert(data.error || 'Failed to report delay');
      }
    } catch {
      alert('Error reporting traffic delay');
    } finally {
      setSubmittingStuck(false);
    }
  };

  // Filter donations for the Food Broadcasts tab
  const handleOpenCodeModal = (action) => {
    setCodeModalAction(action);
    setVerificationCode('');
    setVerificationError('');
    setCodeModalOpen(true);
  };

  const handleVerifyAndSubmitCode = async () => {
    if (!verificationCode || verificationCode.trim().length !== 4) {
      setVerificationError('Please enter a 4-digit numeric verification code.');
      return;
    }
    if (!activeAssignment) return;
    setVerifyingCode(true);
    setVerificationError('');
    try {
      const res = await fetch(`/api/requests/${activeAssignment.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: codeModalAction,
          code: verificationCode.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        addToast({
          title: codeModalAction === 'picked_up' ? 'Pickup Verified!' : 'Delivery Verified!',
          message: data.message || 'Verification code confirmed.',
          type: 'success'
        });
        setCodeModalOpen(false);
        setVerificationCode('');
        setVerificationError('');
        fetchRequests();
      } else {
        setVerificationError(data.error || 'Verification code failed');
      }
    } catch {
      setVerificationError('Network error verifying code');
    } finally {
      setVerifyingCode(false);
    }
  };

  const filteredDonations = donations.filter(don => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      don.mealName.toLowerCase().includes(q) ||
      don.donorName.toLowerCase().includes(q) ||
      don.foodCategory.toLowerCase().includes(q) ||
      don.pickupAddress.toLowerCase().includes(q)
    );
  });

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
            <span className="role-badge rider">Rider Dashboard</span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{user?.name || 'Rider Rahul'}</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            Vehicle: <strong>{user?.vehicleType || 'Two-Wheeler'}</strong> • Max Capacity: <strong>{user?.maxCapacity || 80} servings</strong>
          </p>
        </div>

        <button onClick={refreshAll} className="btn btn-secondary">
          <RefreshCw size={15} /> Refresh Dashboard
        </button>
      </div>

      {/* Coordination Flow Banner */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.12), rgba(16, 185, 129, 0.12))',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '12px',
        padding: '12px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '0.86rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem' }}>📡</span>
          <span>
            <strong>Three-Role Network:</strong> Donors tell surplus food ➔ Receivers order needed portions ➔ Riders view broadcasts and deliver orders.
          </span>
        </div>
        <span style={{ color: '#34d399', fontWeight: 700, fontSize: '0.82rem' }}>
          ⚡ Live WebSocket Sync Active
        </span>
      </div>

      {/* Navigation Tabs */}
      <div className="nav-tabs" style={{ marginBottom: '24px' }}>
        <button
          id="tab-rider-missions"
          onClick={() => setActiveTab('missions')}
          className={`nav-tab-item ${activeTab === 'missions' ? 'active' : ''}`}
        >
          <Truck size={16} /> 1. Delivery Missions ({availableAssignments.length} available{activeAssignment ? ' • 1 Active' : ''})
        </button>
        <button
          id="tab-food-broadcasts"
          onClick={() => setActiveTab('food_broadcasts')}
          className={`nav-tab-item ${activeTab === 'food_broadcasts' ? 'active' : ''}`}
        >
          <Utensils size={16} /> 2. Food Told by Donors ({donations.length} batches)
        </button>
      </div>

      {/* TAB 1: DELIVERY MISSIONS */}
      {activeTab === 'missions' && (
        <div style={{ display: 'grid', gridTemplateColumns: activeAssignment ? '1.2fr 1fr' : '1fr', gap: '24px' }}>
          {/* Active Mission Workflow */}
          {activeAssignment ? (
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="pulsing-dot green"></span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Active Delivery Mission</h3>
                </div>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#fcd34d',
                  border: '1px solid rgba(245, 158, 11, 0.4)'
                }}>
                  {activeAssignment.assignmentStatus}
                </span>
              </div>

              {/* Stepper Timeline */}
              <StatusTimeline status={activeAssignment.assignmentStatus} />

              {/* In-Transit Redirection Banner if applicable */}
              {activeAssignment.redirectHistory && activeAssignment.redirectHistory.length > 0 && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid #f59e0b',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}>
                  <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: '#fbbf24', fontSize: '0.92rem' }}>⚠️ Dynamic In-Transit Rerouting Active!</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#f3f4f6' }}>
                      Original receiver demand was fulfilled. You have been safely rerouted to{' '}
                      <strong>{activeAssignment.receiverName}</strong> ({activeAssignment.receiverAddress}).
                    </p>
                  </div>
                </div>
              )}

              {/* Telemetry Summary */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                background: '#F8FAFC',
                border: '1px solid var(--border-subtle)',
                padding: '16px',
                borderRadius: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pickup Restaurant</span>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#059669' }}>
                    🏪 {activeAssignment.donorName}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {activeAssignment.pickupAddress}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Destination Shelter</span>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#4F46E5' }}>
                    🏠 {activeAssignment.receiverName}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {activeAssignment.receiverAddress}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cargo Load</span>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>
                    {activeAssignment.quantityRequested} Servings
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#D97706' }}>
                    {activeAssignment.mealName}
                  </span>
                </div>
              </div>

              {/* Live Shared Map */}
              <SharedLiveMap request={activeAssignment} role="rider" />

              {/* Delivery Workflow Action Controls */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Delivery Workflow Actions:
                </span>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {activeAssignment.assignmentStatus === 'ASSIGNED' && (
                    <button
                      id="btn-head-to-pickup"
                      onClick={() => handleUpdateStatus(activeAssignment.id, 'going_to_pickup')}
                      disabled={actionLoading}
                      className="btn btn-primary"
                    >
                      <Navigation size={15} /> 1. Head to Pickup Point
                    </button>
                  )}

                  {(activeAssignment.assignmentStatus === 'RIDER_GOING_TO_PICKUP' || activeAssignment.assignmentStatus === 'ASSIGNED') && (
                    <button
                      id="btn-confirm-pickup"
                      onClick={() => handleUpdateStatus(activeAssignment.id, 'picked_up')}
                      disabled={actionLoading}
                      className="btn btn-warning"
                    >
                      <PackageCheck size={15} /> 2. Confirm Pickup (Locks Donation)
                    </button>
                  )}

                  {activeAssignment.assignmentStatus === 'PICKED_UP' && (
                    <button
                      id="btn-start-delivery"
                      onClick={() => handleUpdateStatus(activeAssignment.id, 'in_transit')}
                      disabled={actionLoading}
                      className="btn btn-primary"
                    >
                      <Truck size={15} /> 3. Start Delivery (Transit)
                    </button>
                  )}

                  {activeAssignment.assignmentStatus === 'IN_TRANSIT' && (
                    <>
                      <button
                        id="btn-report-stuck"
                        onClick={() => setShowStuckModal(true)}
                        disabled={actionLoading}
                        className="btn btn-warning"
                        style={{ background: '#d97706', borderColor: '#b45309' }}
                      >
                        <AlertTriangle size={15} /> Stuck in traffic / delayed
                      </button>

                      <button
                        id="btn-advance-rider-step"
                        onClick={handleAdvanceSimulation}
                        disabled={actionLoading}
                        className="btn btn-accent"
                      >
                        <FastForward size={15} /> Simulate Route Movement (+25%)
                      </button>

                      {activeAssignment.safeUseDeadline && new Date(activeAssignment.safeUseDeadline).getTime() <= Date.now() ? (
                        <div style={{
                          background: '#fef2f2',
                          border: '1px solid #f87171',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          color: '#b91c1c',
                          fontSize: '0.84rem',
                          fontWeight: 700
                        }}>
                          ⚠️ Past safe-use deadline: do not serve. Dispose safely. Delivery blocked.
                        </div>
                      ) : (
                        <button
                          id="btn-mark-delivered"
                          onClick={() => handleUpdateStatus(activeAssignment.id, 'delivered')}
                          disabled={actionLoading}
                          className="btn btn-primary"
                        >
                          <CheckCircle size={15} /> 4. Mark Delivered at Destination
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
              <Bike size={44} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>You Have No Active Delivery</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '6px' }}>
                Check available assignments below or browse food broadcasts announced by donors.
              </p>
            </div>
          )}

          {/* Available Assignments Feed */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Orders Ready for Delivery</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Food ordered by shelters waiting for rider pickup
                </p>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {availableAssignments.length} open
              </span>
            </div>

            {availableAssignments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No unassigned delivery missions currently waiting.
                </p>
                <button
                  onClick={() => setActiveTab('food_broadcasts')}
                  className="btn btn-sm btn-secondary"
                  style={{ marginTop: '10px' }}
                >
                  <Utensils size={14} /> View Food Told by Donors ({donations.length})
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {availableAssignments.map(a => {
                  const canCarry = (user?.maxCapacity || 80) >= a.quantityRequested;

                  return (
                    <div
                      key={a.id}
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
                      <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{a.mealName}</h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Quantity Ordered: <strong style={{ color: '#059669' }}>{a.quantityRequested} servings</strong>
                        </span>
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        background: '#FFFFFF',
                        border: '1px solid var(--border-subtle)',
                        padding: '8px 12px',
                        borderRadius: '8px'
                      }}>
                        <div>🏪 <strong>Pickup (Donor):</strong> {a.donorName} (~{a.distanceKm || 2} km away)</div>
                        <div>🏠 <strong>Destination (Receiver):</strong> {a.receiverName} (~{a.deliveryETA || 15} mins transit)</div>
                        <div>⏱️ <strong>Safe Deadline:</strong> {new Date(a.safeUseDeadline).toLocaleTimeString()}</div>
                      </div>

                      {!canCarry && (
                        <span style={{ fontSize: '0.75rem', color: '#f43f5e', fontWeight: 600 }}>
                          ⚠️ Exceeds your carrying capacity ({user?.maxCapacity || 80} servings)
                        </span>
                      )}

                      <button
                        id={`btn-accept-${a.id}`}
                        onClick={() => handleAcceptAssignment(a.id)}
                        disabled={!canCarry || !!activeAssignment || actionLoading}
                        className="btn btn-sm btn-primary"
                        style={{ marginTop: '4px', alignSelf: 'flex-start' }}
                      >
                        {activeAssignment ? 'Complete Active Job First' : 'Accept Assignment'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Completed History section */}
            {completedAssignments.length > 0 && (
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px' }}>
                  Your Completed Missions ({completedAssignments.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {completedAssignments.slice(0, 3).map(c => (
                    <div
                      key={c.id}
                      style={{
                        fontSize: '0.78rem',
                        padding: '8px 12px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        borderRadius: '6px',
                        color: '#d1fae5'
                      }}
                    >
                      ✅ Delivered {c.quantityRequested} servings of {c.mealName} to {c.receiverName}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE FOOD TOLD BY DONORS */}
      {activeTab === 'food_broadcasts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header & Search */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  🍲 Surplus Food Announced by Donors
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                  All surplus food batches told by local restaurants and mess kitchens. Receivers order from this pool, creating delivery jobs for you.
                </p>
              </div>

              <div style={{ position: 'relative', minWidth: '280px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by food name, donor, location..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredDonations.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <Utensils size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No Food Broadcasts Found</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                When donors post food, batches will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="donations-grid">
              {filteredDonations.map(don => {
                const remainingMins = don.remainingMinutes || 0;
                const hours = Math.floor(remainingMins / 60);
                const mins = remainingMins % 60;
                const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                const isUrgent = remainingMins < 30;
                const isWarning = remainingMins >= 30 && remainingMins < 60;

                // Check if any open request exists for this food
                const matchingOpenReq = requests.find(
                  r => r.donationId === don.id && (r.assignmentStatus === 'AWAITING_RIDER' || (!r.assignedRiderId && r.assignmentStatus === 'REQUESTED'))
                );

                const isAssignedToMe = requests.some(
                  r => r.donationId === don.id && r.assignedRiderId === user?.id && r.assignmentStatus !== 'DELIVERED'
                );

                return (
                  <div key={don.id} className="glass-panel donation-card">
                    {/* Food Image */}
                    <div className="card-image-wrap">
                      <img src={don.imageUrl} alt={don.mealName} className="card-image" />
                      <div className="card-badge-top">
                        {don.isVegetarian ? '🟢 VEG' : '🔴 NON-VEG'} • {don.foodCategory.replace('_', ' ').toUpperCase()}
                      </div>
                      <div className={`card-time-badge ${don.isExpired ? 'urgent' : isUrgent ? 'urgent' : isWarning ? 'warning' : 'safe'}`}>
                        <Clock size={13} /> {don.isExpired ? 'EXPIRED' : `${timeDisplay} left`}
                      </div>
                    </div>

                    {/* Card Body */}
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

                      {/* Distance & Telemetry for Rider */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        background: '#F8FAFC',
                        border: '1px solid var(--border-subtle)',
                        padding: '10px',
                        borderRadius: '8px',
                        fontSize: '0.78rem'
                      }}>
                        <div className="card-meta-row">
                          <span>📍 Donor Pickup Point:</span>
                          <span style={{ color: 'var(--text-main)', textAlign: 'right', maxWidth: '60%' }}>
                            {don.pickupAddress}
                          </span>
                        </div>
                        <div className="card-meta-row">
                          <span>🛵 Distance from You:</span>
                          <strong style={{ color: '#2563EB' }}>~{don.distanceKm} km ({don.travelTimeMins} mins ride)</strong>
                        </div>
                        <div className="card-meta-row">
                          <span>📦 Storage Required:</span>
                          <span>{don.storageRequirements.replace('_', ' ')}</span>
                        </div>
                      </div>

                      {/* Status / Order Callout */}
                      {matchingOpenReq ? (
                        <div style={{
                          background: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          fontSize: '0.8rem',
                          color: '#1E40AF',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                            <span className="pulsing-dot green"></span>
                            <span>Ordered by {matchingOpenReq.receiverName}!</span>
                          </div>
                          <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                            {matchingOpenReq.quantityRequested} servings ordered • Awaiting rider pickup
                          </span>
                          <button
                            onClick={() => handleAcceptAssignment(matchingOpenReq.id)}
                            disabled={!!activeAssignment || actionLoading}
                            className="btn btn-sm btn-primary"
                            style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                          >
                            {activeAssignment ? 'Complete Active Mission First' : 'Accept Delivery Mission'}
                          </button>
                        </div>
                      ) : isAssignedToMe ? (
                        <div style={{
                          background: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          fontSize: '0.78rem',
                          color: '#065F46',
                          fontWeight: 600
                        }}>
                          🛵 You are currently on delivery mission for this batch.
                        </div>
                      ) : (
                        <div style={{
                          background: '#F8FAFC',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          fontSize: '0.76rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span>📢 Announced by donor • Waiting for shelter to order servings.</span>
                        </div>
                      )}

                      {/* Footer Quantity */}
                      <div style={{
                        marginTop: 'auto',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Available Servings</span>
                          <strong style={{ fontSize: '1.15rem', color: '#059669' }}>{don.availableQuantity}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> / {don.totalQuantity} total</span>
                        </div>

                        <span style={{
                          fontSize: '0.75rem',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: '#F1F5F9',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-muted)'
                        }}>
                          Batch #{don.id}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stuck in Traffic Modal */}
      <Modal
        isOpen={showStuckModal}
        onClose={() => setShowStuckModal(false)}
        title="Report Traffic Congestion / Delay"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.88rem', color: '#64748B', margin: 0 }}>
            Report road delay or congestion. AidFlow will recalculate mission ETA and automatically alert dispatch, donor, and the destination shelter.
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Reason for Delay
            </label>
            <input
              type="text"
              className="form-input"
              value={stuckReason}
              onChange={e => setStuckReason(e.target.value)}
              placeholder="e.g. Signal outage, waterlogging, accident detour"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Estimated Added Delay (Minutes)
            </label>
            <input
              type="number"
              min="5"
              max="120"
              className="form-input"
              value={stuckDelayMinutes}
              onChange={e => setStuckDelayMinutes(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button variant="ghost" onClick={() => setShowStuckModal(false)}>
              Cancel
            </Button>
            <Button
              variant="warning"
              onClick={handleReportStuck}
              loading={submittingStuck}
            >
              Submit Traffic Delay
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
