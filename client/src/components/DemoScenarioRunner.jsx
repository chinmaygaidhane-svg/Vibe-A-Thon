import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { FastForward, AlertTriangle, ShieldAlert, RotateCcw, Clock, Compass } from 'lucide-react';

export default function DemoScenarioRunner({ onActionComplete }) {
  const { user, token, switchDemoRole } = useAuth();
  const { connected, addToast } = useSocket();
  const [loadingAction, setLoadingAction] = useState(false);

  // Helper to find first active/in-transit assignment id for simulation actions
  const getActiveAssignmentId = async () => {
    try {
      const res = await fetch('/api/assignments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.assignments && data.assignments.length > 0) {
        // Look for in-transit or accepted assignment
        const inTransit = data.assignments.find(a => a.status === 'IN_TRANSIT');
        if (inTransit) return inTransit.id;

        const accepted = data.assignments.find(a => a.status === 'ACCEPTED' || a.status === 'HEADING_TO_PICKUP');
        if (accepted) return accepted.id;

        return data.assignments[0].id;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const handleAdvanceRider = async () => {
    setLoadingAction(true);
    try {
      const asgnId = await getActiveAssignmentId();
      if (!asgnId) {
        alert('No active assignment found to simulate. First place an order from Shelter A and have Rider accept it!');
        return;
      }

      const res = await fetch('/simulate/rider-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: asgnId, step: 0.25 })
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ title: 'Rider Movement Advanced (+25%)', message: data.message, type: 'info' });
        if (onActionComplete) onActionComplete();
      } else {
        alert(data.error || 'Failed to advance rider');
      }
    } catch {
      alert('Error advancing simulation');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleTriggerDemandChange = async () => {
    setLoadingAction(true);
    try {
      const asgnId = await getActiveAssignmentId();
      if (!asgnId) {
        alert('No assignment found. For the redirect scenario: 1) Shelter A requests meals, 2) Rider Rahul accepts and clicks Start Delivery (IN_TRANSIT), then 3) Click this button!');
        return;
      }

      const res = await fetch('/simulate/receiver-demand-filled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: asgnId })
      });
      const data = await res.json();
      if (res.ok) {
        addToast({
          title: '🚨 Step 8 Redirection Triggered!',
          message: `Rider successfully rerouted to ${data.newReceiverName || 'Shelter B'}!`,
          type: 'warning'
        });
        if (onActionComplete) onActionComplete();
      } else {
        alert(data.error || 'Failed to redirect delivery');
      }
    } catch {
      alert('Error triggering demand change');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleGhostTimeout = async () => {
    setLoadingAction(true);
    try {
      const asgnId = await getActiveAssignmentId();
      if (!asgnId) {
        alert('No pending reservation found. Place a meal order to create a reservation first!');
        return;
      }

      const res = await fetch('/simulate/rider-timeout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: asgnId })
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ title: 'Ghost Timeout Recovered', message: data.message, type: 'info' });
        if (onActionComplete) onActionComplete();
      } else {
        alert(data.error || 'Could not trigger ghost timeout');
      }
    } catch {
      alert('Error simulating timeout');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleFastForwardTime = async (minutes) => {
    setLoadingAction(true);
    try {
      const res = await fetch('/simulate/fast-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      });
      const data = await res.json();
      if (res.ok) {
        addToast({
          title: `⏱️ Fast-Forwarded +${minutes}m`,
          message: `Time advanced to test expiry triggers. ${data.expiredUpdates?.length || 0} items expired.`,
          type: 'warning'
        });
        if (onActionComplete) onActionComplete();
      }
    } catch {
      alert('Error fast forwarding time');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleTrafficDelay = async (minutes = 15) => {
    setLoadingAction(true);
    try {
      const asgnId = await getActiveAssignmentId();
      if (!asgnId) {
        alert('No active assignment found to simulate delay on. First create an in-transit delivery!');
        return;
      }

      const res = await fetch('/simulate/traffic-delay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: asgnId,
          minutes,
          reason: 'Severe traffic congestion on arterial bypass'
        })
      });
      const data = await res.json();
      if (res.ok) {
        addToast({
          title: `🚦 Traffic Delay (+${minutes}m) Added`,
          message: data.message || `Risk level is now ${data.risk_level}`,
          type: data.risk_level === 'WILL_MISS' ? 'critical' : 'warning'
        });
        if (onActionComplete) onActionComplete();
      } else {
        alert(data.error || 'Failed to simulate traffic delay');
      }
    } catch {
      alert('Error simulating traffic delay');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="demo-bar" id="demo-scenario-runner" style={{
      background: 'rgba(15, 23, 42, 0.95)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '10px',
      fontSize: '0.82rem',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      {/* Left: Role Quick Switchers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          JUDGE SANDBOX:
        </span>
        <button
          id="btn-switch-donor"
          onClick={() => switchDemoRole('donor')}
          className={`btn btn-sm ${user?.role === 'donor' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '3px 8px', fontSize: '0.76rem' }}
        >
          🏪 Donor (ABC Rest.)
        </button>
        <button
          id="btn-switch-shelter-a"
          onClick={() => switchDemoRole('receiver_a')}
          className={`btn btn-sm ${user?.email === 'sheltera@aidflow.org' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '3px 8px', fontSize: '0.76rem' }}
        >
          🏠 Shelter A
        </button>
        <button
          id="btn-switch-shelter-b"
          onClick={() => switchDemoRole('receiver_b')}
          className={`btn btn-sm ${user?.email === 'shelterb@aidflow.org' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '3px 8px', fontSize: '0.76rem' }}
        >
          🍲 Shelter B
        </button>
        <button
          id="btn-switch-rider"
          onClick={() => switchDemoRole('rider')}
          className={`btn btn-sm ${user?.role === 'rider' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '3px 8px', fontSize: '0.76rem' }}
        >
          🛵 Rider Rahul
        </button>
      </div>

      {/* Right: Failure Mode Simulation Triggers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          id="btn-sim-advance-rider"
          onClick={handleAdvanceRider}
          disabled={loadingAction}
          className="btn btn-sm btn-accent"
          style={{ padding: '3px 9px', fontSize: '0.76rem' }}
          title="Advances rider 25% along pickup/delivery route with live map interpolation"
        >
          <FastForward size={13} /> Rider Move (+25%)
        </button>

        <button
          id="btn-sim-step8-redirect"
          onClick={handleTriggerDemandChange}
          disabled={loadingAction}
          className="btn btn-sm btn-warning"
          style={{ padding: '3px 9px', fontSize: '0.76rem' }}
          title="Step 8: Shelter A demand met -> auto-find compatible Shelter B & redirect rider in transit"
        >
          <AlertTriangle size={13} /> Step 8: Demand Filled Redirect
        </button>

        <button
          id="btn-sim-ghost-timeout"
          onClick={handleGhostTimeout}
          disabled={loadingAction}
          className="btn btn-sm btn-secondary"
          style={{ padding: '3px 9px', fontSize: '0.76rem' }}
          title="Simulate unresponsive courier timeout and automatic restitution to donor"
        >
          <ShieldAlert size={13} /> Ghost Timeout
        </button>

        <button
          id="btn-sim-fast-forward"
          onClick={() => handleFastForwardTime(30)}
          disabled={loadingAction}
          className="btn btn-sm btn-secondary"
          style={{ padding: '3px 9px', fontSize: '0.76rem' }}
          title="Fast-forward time 30 mins to trigger expiry alerts"
        >
          <Clock size={13} /> Fast-Forward (+30m)
        </button>

        <button
          id="btn-sim-traffic-delay"
          onClick={() => handleTrafficDelay(15)}
          disabled={loadingAction}
          className="btn btn-sm btn-warning"
          style={{ padding: '3px 9px', fontSize: '0.76rem' }}
          title="Simulate severe traffic delay (+15m) triggering risk re-evaluation and auto-redirect"
        >
          <AlertTriangle size={13} /> Traffic Delay (+15m)
        </button>

        {/* Real-time Socket Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 8px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '999px',
          fontSize: '0.7rem'
        }}>
          <span className={`pulsing-dot ${connected ? 'green' : 'amber'}`}></span>
          <span style={{ color: connected ? '#34d399' : '#f59e0b', fontWeight: 700 }}>
            {connected ? 'SOCKET.IO LIVE' : 'CONNECTING...'}
          </span>
        </div>
      </div>
    </div>
  );
}
