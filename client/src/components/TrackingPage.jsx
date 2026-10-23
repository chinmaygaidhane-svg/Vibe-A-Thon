import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import SharedLiveMap from './SharedLiveMap';
import StatusTimeline from './StatusTimeline';
import { Truck, ArrowLeft, Clock, MapPin, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function TrackingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { lastMessage } = useSocket();

  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAssignment = async () => {
    try {
      const res = await fetch('/api/assignments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.assignments) {
        const found = data.assignments.find(a => a.id === id || a.request_id === id);
        setAssignment(found || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignment();
  }, [id, token]);

  useEffect(() => {
    if (lastMessage) {
      fetchAssignment();
    }
  }, [lastMessage]);

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading live tracking...</div>;
  }

  if (!assignment) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '32px', textAlign: 'center' }} className="glass-panel">
        <Truck size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Delivery Mission Not Found</h2>
        <p style={{ color: 'var(--text-muted)', margin: '8px 0 24px' }}>
          This mission may have been completed, released, or access is restricted.
        </p>
        <button onClick={() => navigate(-1)} className="btn btn-secondary">
          <ArrowLeft size={15} /> Return to Dashboard
        </button>
      </div>
    );
  }

  const remainingMinutes = Math.max(0, Math.floor((new Date(assignment.safe_until).getTime() - Date.now()) / 60000));
  const isUrgent = remainingMinutes < 30;

  // Format request object for SharedLiveMap
  const mapData = {
    pickupLat: assignment.pickup_lat,
    pickupLng: assignment.pickup_lng,
    donorName: assignment.donor_name,
    pickupAddress: assignment.pickup_address,
    mealName: assignment.meal_name,
    quantityRequested: assignment.quantity,
    receiverLat: assignment.receiver_lat,
    receiverLng: assignment.receiver_lng,
    receiverName: assignment.receiver_name,
    receiverAddress: assignment.receiver_address,
    currentRiderLat: assignment.pickup_lat + (assignment.receiver_lat - assignment.pickup_lat) * (assignment.route_progress || 0),
    currentRiderLng: assignment.pickup_lng + (assignment.receiver_lng - assignment.pickup_lng) * (assignment.route_progress || 0),
    assignedRiderName: assignment.rider_name || 'Volunteer Rider',
    simulationStep: Math.round((assignment.route_progress || 0) * 100)
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>
      <button
        onClick={() => navigate(-1)}
        className="btn btn-sm btn-secondary"
        style={{ marginBottom: '20px' }}
      >
        <ArrowLeft size={14} /> Back
      </button>

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
            <span className="pulsing-dot green"></span>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Live Shared Mission Tracking</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '4px' }}>
            Mission #{assignment.id} • {assignment.meal_name} ({assignment.quantity} servings)
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: isUrgent ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${isUrgent ? '#ef4444' : '#10b981'}`,
          borderRadius: '10px',
          padding: '8px 14px'
        }}>
          <Clock size={16} style={{ color: isUrgent ? '#ef4444' : '#10b981' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isUrgent ? '#fca5a5' : '#6ee7b7' }}>
            Safe Window: {remainingMinutes} mins remaining
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Left: Map & Route Progress */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SharedLiveMap request={mapData} role={user?.role || 'donor'} />

          {/* Progress bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              <span>Route Progress</span>
              <strong style={{ color: '#38bdf8' }}>{Math.round((assignment.route_progress || 0) * 100)}% Completed</strong>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.round((assignment.route_progress || 0) * 100)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #059669, #2563EB)',
                transition: 'width 0.4s ease'
              }}></div>
            </div>
          </div>
        </div>

        {/* Right: Status Timeline & Metadata */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Delivery Workflow Timeline</h3>
          <StatusTimeline status={assignment.status} />

          {/* Redirection Alert if any */}
          {assignment.redirect_reason && (
            <div style={{
              background: '#FEF3C7',
              border: '1px solid #FDE68A',
              padding: '12px 16px',
              borderRadius: '10px',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start'
            }}>
              <AlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.85rem', color: '#B45309' }}>Dynamic In-Transit Redirection</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#78350F' }}>
                  {assignment.redirect_reason}
                </p>
              </div>
            </div>
          )}

          {/* Telemetry info */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: '#F8FAFC',
            border: '1px solid var(--border-subtle)',
            padding: '16px',
            borderRadius: '10px',
            fontSize: '0.84rem'
          }}>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Pickup Location (Donor)</span>
              <strong style={{ display: 'block', color: '#059669' }}>🏪 {assignment.donor_name}</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{assignment.pickup_address}</span>
            </div>

            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Dropoff Location (Receiver)</span>
              <strong style={{ display: 'block', color: '#4F46E5' }}>🏠 {assignment.receiver_name}</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{assignment.receiver_address}</span>
            </div>

            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Assigned Courier</span>
              <strong style={{ display: 'block', color: '#D97706' }}>🛵 {assignment.rider_name || 'Unassigned'}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
