import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import DemoScenarioRunner from './components/DemoScenarioRunner';
import LandingPage from './components/LandingPage';
import AuthView from './components/AuthView';
import DonorDashboard from './components/DonorDashboard';
import ReceiverDashboard from './components/ReceiverDashboard';
import RiderDashboard from './components/RiderDashboard';
import OperationsPage from './components/OperationsPage';
import TrackingPage from './components/TrackingPage';
import {
  Building,
  Heart,
  Bike,
  Activity,
  LogOut,
  HelpCircle,
  Menu,
  X,
  Compass,
  Radio,
  Clock,
  CheckCircle,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>Loading session...</div>;
  }

  if (!user) {
    const targetRole = allowedRoles ? allowedRoles[0] : 'donor';
    return <Navigate to={`/login/${targetRole}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== 'admin') {
    return <Navigate to={`/${user.role}`} replace />;
  }

  return children;
}

function SidebarLayout({ children, onOpenGuide }) {
  const { user, logout, switchDemoRole } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const roleColors = {
    donor: '#EA580C',
    receiver: '#4F46E5',
    rider: '#0891B2'
  };

  const roleBadges = {
    donor: { label: 'Commercial Donor', icon: <Building size={14} />, color: '#EA580C', bg: '#FFF7ED', border: '#FDBA74' },
    receiver: { label: 'Shelter / NGO', icon: <Heart size={14} />, color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' },
    rider: { label: 'Volunteer Rider', icon: <Bike size={14} />, color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' }
  };

  const currentBadge = user ? roleBadges[user.role] : null;

  // Role-specific nav items
  const navItems = user?.role === 'donor'
    ? [
        { label: 'Donor Command Center', path: '/donor', icon: <Building size={18} /> },
        { label: 'Operations & Audit Feed', path: '/operations', icon: <Activity size={18} /> }
      ]
    : user?.role === 'receiver'
    ? [
        { label: 'Available Food Feed', path: '/receiver', icon: <Heart size={18} /> },
        { label: 'Operations & Audit Feed', path: '/operations', icon: <Activity size={18} /> }
      ]
    : user?.role === 'rider'
    ? [
        { label: 'Rider Missions & Route', path: '/rider', icon: <Bike size={18} /> },
        { label: 'Operations & Audit Feed', path: '/operations', icon: <Activity size={18} /> }
      ]
    : [
        { label: 'Operations Center', path: '/operations', icon: <Activity size={18} /> }
      ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      {/* 1. Left Navy Sidebar */}
      <aside
        style={{
          width: '260px',
          backgroundColor: '#0F172A',
          color: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid #1E293B',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 950,
          transition: 'transform 0.25s ease'
        }}
        className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Brand header */}
          <div style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid #1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #059669, #10B981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '16px',
                boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)'
              }}>
                ⚡
              </span>
              <div>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', display: 'block', lineHeight: 1.1 }}>
                  AidFlow <span style={{ color: '#10B981' }}>AI</span>
                </span>
                <span style={{ fontSize: '0.68rem', color: '#94A3B8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Surplus Food Grid
                </span>
              </div>
            </Link>

            <button
              onClick={() => setMobileOpen(false)}
              className="mobile-close-btn"
              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'none' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Current Role Pill */}
          {currentBadge && (
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1E293B' }}>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                Active Persona
              </span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: currentBadge.bg,
                color: currentBadge.color,
                border: `1px solid ${currentBadge.border}`,
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700
              }}>
                {currentBadge.icon}
                <span>{currentBadge.label}</span>
              </div>
            </div>
          )}

          {/* Navigation Items */}
          <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 10px 8px' }}>
              Console Navigation
            </span>

            {navItems.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: active ? 700 : 500,
                    textDecoration: 'none',
                    color: active ? '#FFFFFF' : '#94A3B8',
                    backgroundColor: active ? '#1E293B' : 'transparent',
                    borderLeft: active ? `3px solid #10B981` : '3px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ color: active ? '#10B981' : '#64748B' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Judge Persona Switcher Box */}
          <div style={{
            margin: '8px 12px 16px',
            padding: '12px',
            backgroundColor: '#1E293B',
            borderRadius: '10px',
            border: '1px solid #334155'
          }}>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
              ⚡ 1-Click Persona Switch
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                onClick={() => { switchDemoRole('donor'); navigate('/donor'); }}
                style={{
                  background: user?.role === 'donor' ? '#EA580C' : '#0F172A',
                  color: '#FFFFFF',
                  border: '1px solid #334155',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                🏪 Donor
              </button>

              <button
                onClick={() => { switchDemoRole('receiver_a'); navigate('/receiver'); }}
                style={{
                  background: user?.email === 'shelter.a@demo.com' ? '#4F46E5' : '#0F172A',
                  color: '#FFFFFF',
                  border: '1px solid #334155',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                🏠 Shelter A
              </button>

              <button
                onClick={() => { switchDemoRole('receiver_b'); navigate('/receiver'); }}
                style={{
                  background: user?.email === 'shelter.b@demo.com' ? '#4F46E5' : '#0F172A',
                  color: '#FFFFFF',
                  border: '1px solid #334155',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                🍲 Shelter B
              </button>

              <button
                onClick={() => { switchDemoRole('rider'); navigate('/rider'); }}
                style={{
                  background: user?.role === 'rider' ? '#0891B2' : '#0F172A',
                  color: '#FFFFFF',
                  border: '1px solid #334155',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                🛵 Rider
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Profile card */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid #1E293B',
          backgroundColor: '#0A0F1D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: roleColors[user?.role] || '#059669',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem',
              flexShrink: 0
            }}>
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.name || 'AidFlow User'}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.email}
              </span>
            </div>
          </div>

          <button
            onClick={() => { logout(); navigate('/'); }}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px'
            }}
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* 2. Main Viewport (offset by 260px on desktop) */}
      <div style={{ flex: 1, marginLeft: '260px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }} className="app-main-viewport">
        {/* Top Sandbox Bar */}
        <DemoScenarioRunner />

        {/* Top Subheader */}
        <header style={{
          height: '56px',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: '41px',
          zIndex: 900
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setMobileOpen(true)}
              className="mobile-hamburger"
              style={{ background: 'none', border: 'none', color: '#0F172A', cursor: 'pointer', display: 'none' }}
            >
              <Menu size={20} />
            </button>

            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B' }}>
              AidFlow AI Network
            </span>
            <span style={{ color: '#CBD5E1' }}>/</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>
              {user?.name || 'Dashboard'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onOpenGuide}
              className="btn btn-sm btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <HelpCircle size={14} /> Demo Walkthrough Guide
            </button>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '9999px',
              backgroundColor: connected ? '#ECFDF5' : '#FFFBEB',
              border: `1px solid ${connected ? '#A7F3D0' : '#FDE68A'}`,
              fontSize: '0.74rem',
              fontWeight: 700,
              color: connected ? '#059669' : '#D97706'
            }}>
              <span className={`pulsing-dot ${connected ? 'green' : 'amber'}`}></span>
              <span>{connected ? 'LIVE NETWORK' : 'CONNECTING'}</span>
            </div>
          </div>
        </header>

        {/* Main Content Component */}
        <main style={{ flex: 1, padding: '24px 20px' }}>
          {children}
        </main>

        {/* Minimal Footer */}
        <footer style={{
          padding: '16px 24px',
          borderTop: '1px solid #E2E8F0',
          textAlign: 'center',
          color: '#64748B',
          fontSize: '0.8rem',
          backgroundColor: '#FFFFFF'
        }}>
          AidFlow AI • Civic Surplus Food Distribution Grid • SQLite WAL + Socket.IO + React + Leaflet
        </footer>
      </div>
    </div>
  );
}

function MainApp() {
  const { user } = useAuth();
  const [showGuideModal, setShowGuideModal] = useState(false);

  return (
    <div>
      {/* If logged in, wrap inside SidebarLayout */}
      {user ? (
        <SidebarLayout onOpenGuide={() => setShowGuideModal(true)}>
          <Routes>
            <Route path="/donor" element={
              <ProtectedRoute allowedRoles={['donor']}>
                <DonorDashboard />
              </ProtectedRoute>
            } />

            <Route path="/receiver" element={
              <ProtectedRoute allowedRoles={['receiver']}>
                <ReceiverDashboard />
              </ProtectedRoute>
            } />

            <Route path="/rider" element={
              <ProtectedRoute allowedRoles={['rider']}>
                <RiderDashboard />
              </ProtectedRoute>
            } />

            <Route path="/operations" element={
              <ProtectedRoute>
                <OperationsPage />
              </ProtectedRoute>
            } />

            <Route path="/tracking/:id" element={
              <ProtectedRoute>
                <TrackingPage />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to={`/${user.role}`} replace />} />
          </Routes>
        </SidebarLayout>
      ) : (
        /* If not logged in, full width public view */
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC' }}>
          <header style={{
            height: '64px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px'
          }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #059669, #10B981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '16px'
              }}>
                ⚡
              </span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                AidFlow <span style={{ color: '#059669' }}>AI</span>
              </span>
            </Link>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Link to="/login/donor" className="btn btn-sm btn-secondary">
                Sign In
              </Link>
              <Link to="/register/donor" className="btn btn-sm btn-primary">
                Register Food Donor
              </Link>
            </div>
          </header>

          <main style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login/:role" element={<AuthView defaultRegister={false} />} />
              <Route path="/register/:role" element={<AuthView defaultRegister={true} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <footer style={{
            padding: '24px 20px',
            borderTop: '1px solid #E2E8F0',
            textAlign: 'center',
            color: '#64748B',
            fontSize: '0.84rem',
            backgroundColor: '#FFFFFF'
          }}>
            AidFlow AI • Civic Surplus Food Distribution Grid • SQLite WAL + Socket.IO + React + Leaflet
          </footer>
        </div>
      )}

      {/* Demo Scenario Guide Modal */}
      {showGuideModal && (
        <div className="modal-overlay" onClick={() => setShowGuideModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>🏆 Hackathon Required Demo Walkthrough</h3>
              <button
                onClick={() => setShowGuideModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.86rem' }}>
              <p style={{ color: '#64748B', margin: 0 }}>
                Follow these exact steps to demonstrate all phases of the AidFlow AI platform:
              </p>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: '8px' }}>
                <strong style={{ color: '#EA580C' }}>Step 1: Donor Broadcasts Food</strong>
                <p style={{ margin: '4px 0 0', color: '#64748B' }}>
                  Log in as <strong>ABC Restaurant</strong>. Notice servings listed with safe deadlines. Click "+ Broadcast Food" to add another batch.
                </p>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: '8px' }}>
                <strong style={{ color: '#4F46E5' }}>Step 2 & 3: Shelter Orders Meals</strong>
                <p style={{ margin: '4px 0 0', color: '#64748B' }}>
                  Switch to <strong>Shelter A</strong>. Browse Available Donations. Click "🛒 Order Food" and request portions. Notice remaining quantity decreases in real-time.
                </p>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: '8px' }}>
                <strong style={{ color: '#0891B2' }}>Step 4 & 5: Rider Accepts Assignment</strong>
                <p style={{ margin: '4px 0 0', color: '#64748B' }}>
                  Switch to <strong>Rider Rahul</strong>. See the order in "Delivery Missions". Click "Accept Assignment".
                </p>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: '8px' }}>
                <strong style={{ color: '#2563EB' }}>Step 6 & 7: Pickup & Transit Simulation</strong>
                <p style={{ margin: '4px 0 0', color: '#64748B' }}>
                  Rahul clicks "2. Confirm Pickup (Locks Donation)", then "3. Start Delivery (Transit)". Click "Rider Move (+25%)" in the top bar to simulate live GPS movement on the map.
                </p>
              </div>

              <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', padding: '12px 16px', borderRadius: '8px' }}>
                <strong style={{ color: '#B45309' }}>Step 8: Dynamic In-Transit Redirection!</strong>
                <p style={{ margin: '4px 0 0', color: '#78350F' }}>
                  While IN_TRANSIT, click <strong>"Step 8: Demand Filled Redirect"</strong> in the top sandbox bar. The system calculates candidate shelters, finds feasible <strong>Shelter B</strong>, and immediately redirects the rider!
                </p>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: '8px' }}>
                <strong style={{ color: '#059669' }}>Step 9: Delivery Complete & Receipt Confirmation</strong>
                <p style={{ margin: '4px 0 0', color: '#64748B' }}>
                  Rahul marks delivered with the 4-digit code. Switch to Shelter B &rarr; click "Confirm Receipt".
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowGuideModal(false)} className="btn btn-primary" style={{ width: '100%' }}>
                Got It, Let's Test!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <MainApp />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
