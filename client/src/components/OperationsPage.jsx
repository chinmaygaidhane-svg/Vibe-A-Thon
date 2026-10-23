import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Truck,
  Heart,
  RefreshCw,
  Clock,
  MapPin,
  ShieldAlert,
  Sliders,
  FastForward,
  RotateCcw
} from 'lucide-react';

export default function OperationsPage() {
  const { token } = useAuth();
  const { lastMessage, addToast } = useSocket();

  const [opsData, setOpsData] = useState({
    stats: {
      activeDeliveries: 0,
      atRiskItems: 0,
      mealsSaved: 0,
      totalEvents: 0
    },
    assignments: [],
    eventLogs: [],
    atRiskDonations: []
  });

  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('ALL');

  const fetchOpsData = async () => {
    try {
      const res = await fetch('/api/operations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setOpsData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpsData();
  }, [token]);

  useEffect(() => {
    if (lastMessage) {
      fetchOpsData();
    }
  }, [lastMessage]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
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
            <span style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: 800,
              letterSpacing: '0.05em'
            }}>OPERATIONS CENTER</span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Live Coordination & Audit Feed
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            City-wide oversight of active missions, safety buffers, at-risk surplus food, and tamper-evident audit logs.
          </p>
        </div>

        <button onClick={fetchOpsData} className="btn btn-secondary">
          <RefreshCw size={15} /> Refresh Operations
        </button>
      </div>

      {/* Metric KPI Cards */}
      <div className="stats-grid" style={{ marginBottom: '28px' }}>
        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Active Deliveries</span>
            <Truck size={20} style={{ color: '#60a5fa' }} />
          </div>
          <span className="stat-val" style={{ color: '#60a5fa' }}>{opsData.stats.activeDeliveries}</span>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Couriers currently on mission</span>
        </div>

        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">At-Risk Batches</span>
            <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
          </div>
          <span className="stat-val" style={{ color: '#f59e0b' }}>{opsData.stats.atRiskItems}</span>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Under 30 mins safe window</span>
        </div>

        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Meals Saved & Delivered</span>
            <Heart size={20} style={{ color: '#34d399' }} />
          </div>
          <span className="stat-val" style={{ color: '#34d399' }}>{opsData.stats.mealsSaved}</span>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Successfully delivered to shelters</span>
        </div>

        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Logged System Events</span>
            <Activity size={20} style={{ color: '#a78bfa' }} />
          </div>
          <span className="stat-val" style={{ color: '#a78bfa' }}>{opsData.stats.totalEvents}</span>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Audit trail operations</span>
        </div>
      </div>

      {/* Two Column Layout: Active Deliveries & At-Risk Items vs Real-Time Event Audit Log */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Left Column: Live Assignments & At-Risk Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Active Deliveries Table */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Live Mission Assignments</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {opsData.assignments.length} total entries
              </span>
            </div>

            {opsData.assignments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No active assignments currently in flight.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {opsData.assignments.map(a => {
                  const statusColors = {
                    PENDING: '#9ca3af',
                    ACCEPTED: '#f59e0b',
                    HEADING_TO_PICKUP: '#3b82f6',
                    PICKED_UP: '#8b5cf6',
                    IN_TRANSIT: '#2563eb',
                    DELIVERED: '#10b981',
                    RELEASED: '#ef4444'
                  };

                  return (
                    <div
                      key={a.id}
                      style={{
                        background: '#F8FAFC',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                          {a.meal_name} ({a.quantity} servings)
                        </span>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          background: `${statusColors[a.status] || '#6b7280'}22`,
                          color: statusColors[a.status] || '#9ca3af',
                          border: `1px solid ${statusColors[a.status] || '#6b7280'}44`
                        }}>
                          {a.status}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <div>🏪 <strong>Donor:</strong> {a.donor_name}</div>
                        <div>🏠 <strong>Destination:</strong> {a.receiver_name}</div>
                        <div>🛵 <strong>Rider:</strong> {a.rider_name || 'Unassigned'}</div>
                        <div>⏱️ <strong>Deadline:</strong> {new Date(a.safe_until).toLocaleTimeString()}</div>
                      </div>

                      {a.redirect_reason && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#fbbf24',
                          background: 'rgba(245, 158, 11, 0.1)',
                          padding: '4px 8px',
                          borderRadius: '6px'
                        }}>
                          ⚠️ Dynamic Reroute: {a.redirect_reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* At-Risk Items Section */}
          {opsData.atRiskDonations.length > 0 && (
            <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <ShieldAlert size={20} style={{ color: '#ef4444' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fca5a5' }}>
                  At-Risk Donations (Under 30 Min Safe Window)
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {opsData.atRiskDonations.map(d => (
                  <div
                    key={d.id}
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: '#fecdd3' }}>{d.name}</strong>
                      <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        Offered by {d.donor_name} • {d.available_quantity} available
                      </span>
                    </div>

                    <span style={{
                      color: '#f87171',
                      fontWeight: 800,
                      fontSize: '0.85rem'
                    }}>
                      ⏱️ {d.remainingMinutes}m left
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Real-Time Event Audit Log */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Event Log & Audit Trail</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Tamper-evident
            </span>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '650px',
            overflowY: 'auto',
            paddingRight: '6px'
          }}>
            {opsData.eventLogs.map(log => {
              const isUrgent = log.event_type.includes('EXPIRED') || log.event_type.includes('FAILED');
              const isWarning = log.event_type.includes('REDIRECT') || log.event_type.includes('GHOST');

              return (
                <div
                  key={log.id}
                  style={{
                    background: isUrgent
                      ? '#FEF2F2'
                      : isWarning
                      ? '#FFFBEB'
                      : '#F8FAFC',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{
                      fontSize: '0.8rem',
                      color: isUrgent ? '#DC2626' : isWarning ? '#D97706' : '#2563EB'
                    }}>
                      {log.event_type}
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#e2e8f0', margin: 0 }}>
                    {log.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
