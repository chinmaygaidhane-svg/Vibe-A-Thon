import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);

  useEffect(() => {
    const socketInstance = io(window.location.origin, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    // Event listeners
    socketInstance.on('donation.created', data => {
      setLastMessage({ event: 'donation.created', data });
      addToast({
        title: '🍲 New Food Donation Announced',
        message: `${data.donation?.name} listed by ${data.donation?.donor_name || 'Donor'}.`,
        type: 'success'
      });
    });

    socketInstance.on('request.created', data => {
      setLastMessage({ event: 'request.created', data });
      addToast({
        title: '📦 New Meal Request Placed',
        message: `Shelter requested ${data.requestedQuantity} portions of food.`,
        type: 'info'
      });
    });

    socketInstance.on('assignment.updated', data => {
      setLastMessage({ event: 'assignment.updated', data });
      addToast({
        title: '🚚 Mission Status Updated',
        message: `Assignment ${data.assignmentId || ''} updated to ${data.status}.`,
        type: 'info'
      });
    });

    socketInstance.on('rider.location_updated', data => {
      setLastMessage({ event: 'rider.location_updated', data });
    });

    socketInstance.on('donation.hidden', data => {
      setLastMessage({ event: 'donation.hidden', data });
    });

    socketInstance.on('delivery.redirected', data => {
      setLastMessage({ event: 'delivery.redirected', data });
      setActiveAlert({
        title: '⚠️ Dynamic In-Transit Redirection Active',
        message: `Original demand fulfilled. Rider safely rerouted to ${data.newReceiverName} (${data.newAddress}). ETA: ${data.etaMins}m.`,
        type: 'warning'
      });
      addToast({
        title: '⚠️ Dynamic Redirection Alert',
        message: `Rider successfully rerouted to ${data.newReceiverName}!`,
        type: 'warning'
      });
    });

    socketInstance.on('reservation.released', data => {
      setLastMessage({ event: 'reservation.released', data });
      addToast({
        title: '⏱️ Ghost Reservation Recovered',
        message: 'Unresponsive courier reservation released. Quantity restored to donor available pool.',
        type: 'info'
      });
    });

    socketInstance.on('alert.urgent', data => {
      setLastMessage({ event: 'alert.urgent', data });
      setActiveAlert(data);
      addToast({
        title: data.title || '🚨 Urgent Alert',
        message: data.message,
        type: data.type === 'critical' ? 'critical' : 'warning'
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 4);
    const item = { id, ...toast, timestamp: new Date() };
    setNotifications(prev => [item, ...prev].slice(0, 8));

    setTimeout(() => {
      setNotifications(prev => prev.filter(t => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = (id) => {
    setNotifications(prev => prev.filter(t => t.id !== id));
  };

  const dismissActiveAlert = () => {
    setActiveAlert(null);
  };

  return (
    <SocketContext.Provider value={{
      socket,
      connected,
      lastMessage,
      notifications,
      addToast,
      dismissToast,
      activeAlert,
      dismissActiveAlert
    }}>
      {children}

      {/* Floating Active Urgent Alert Banner */}
      {activeAlert && (
        <div style={{
          position: 'fixed',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9998,
          maxWidth: '850px',
          width: '92%',
          background: activeAlert.type === 'critical' ? '#7f1d1d' : '#78350f',
          border: `2px solid ${activeAlert.type === 'critical' ? '#dc2626' : '#f59e0b'}`,
          borderRadius: '12px',
          padding: '14px 20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <strong style={{ fontSize: '0.96rem', display: 'block', marginBottom: '2px' }}>
              {activeAlert.title}
            </strong>
            <p style={{ margin: 0, fontSize: '0.84rem', opacity: 0.95 }}>
              {activeAlert.message}
            </p>
          </div>
          <button
            onClick={dismissActiveAlert}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              padding: '6px 12px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Toast Notification Container */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 9999,
        maxWidth: '380px',
        pointerEvents: 'none'
      }}>
        {notifications.map(n => (
          <div
            key={n.id}
            style={{
              pointerEvents: 'auto',
              background: n.type === 'critical' ? '#450a0a' : n.type === 'warning' ? '#451a03' : n.type === 'success' ? '#064e3b' : '#0f172a',
              color: '#ffffff',
              border: `1px solid ${n.type === 'critical' ? '#ef4444' : n.type === 'warning' ? '#f59e0b' : n.type === 'success' ? '#10b981' : '#38bdf8'}`,
              borderRadius: '12px',
              padding: '12px 16px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.88rem' }}>{n.title}</strong>
              <button
                onClick={() => dismissToast(n.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  opacity: 0.7,
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                &times;
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', opacity: 0.9, margin: 0 }}>{n.message}</p>
          </div>
        ))}
      </div>
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
