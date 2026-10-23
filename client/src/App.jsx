import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import DemoScenarioRunner from './components/DemoScenarioRunner';
import LandingPage from './components/LandingPage';
import AuthView from './components/AuthView';
import DonorDashboard from './components/DonorDashboard';
import ReceiverDashboard from './components/ReceiverDashboard';
import RiderDashboard from './components/RiderDashboard';
import OperationsPage from './components/OperationsPage';
import TrackingPage from './components/TrackingPage';
import { Shield, LogOut, HelpCircle, Activity, Heart, CheckCircle2 } from 'lucide-react';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading session...</div>;
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

function NavBar({ onOpenGuide }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--emerald-500), var(--teal-500))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '18px'
          }}>
            ⚡
          </span>
          <span className="brand" style={{ margin: 0 }}>
            AidFlow <span className="brand-gradient">AI</span>
          </span>
        </Link>

        {user && (
          <span className={`role-badge ${user.role}`}>
            {user.role.toUpperCase()} MODE
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          id="btn-open-guide"
          onClick={onOpenGuide}
          className="btn btn-sm btn-secondary"
          title="Step-by-step hackathon demo walkthrough"
        >
          <HelpCircle size={15} /> Demo Guide
        </button>

        <Link to="/operations" className="btn btn-sm btn-secondary" title="Operations and Event Audit Feed">
          <Activity size={15} /> Operations Center
        </Link>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, display: 'block', color: 'var(--text-main)' }}>
                {user.name}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {user.email}
              </span>
            </div>

            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="btn btn-sm btn-secondary"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <Link to="/login/donor" className="btn btn-sm btn-primary">
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}

function MainApp() {
  const { user } = useAuth();
  const [showGuideModal, setShowGuideModal] = useState(false);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Top Demo Simulation Bar */}
      <DemoScenarioRunner />

      {/* 2. Main Navigation Header */}
      <NavBar onOpenGuide={() => setShowGuideModal(true)} />

      {/* 3. Main Content Routed Pages */}
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={user ? <Navigate to={`/${user.role}`} replace /> : <LandingPage />} />
          <Route path="/login/:role" element={<AuthView defaultRegister={false} />} />
          <Route path="/register/:role" element={<AuthView defaultRegister={true} />} />

          {/* Role Dashboards */}
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* 4. Footer */}
      <footer style={{
        padding: '24px 20px',
        borderTop: '1px solid var(--border-subtle)',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.84rem'
      }}>
        AidFlow AI • Three-Role Real-Time Surplus Food Coordination Platform • SQLite WAL + Socket.IO + React + Leaflet
      </footer>

      {/* Demo Scenario Guide Modal */}
      {showGuideModal && (
        <div className="modal-overlay" onClick={() => setShowGuideModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>🏆 Hackathon Required Demo Walkthrough</h3>
              <button
                onClick={() => setShowGuideModal(false)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.86rem' }}>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Follow these exact steps to demonstrate all 9 phases of the AidFlow AI platform:
              </p>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px' }}>
                <strong style={{ color: '#34d399' }}>Step 1: Donor Broadcasts Food</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
                  Log in as <strong>ABC Restaurant</strong>. Notice 100 servings Vegetable Pulao listed with 3.5h safe deadline. Or click "+ Broadcast Food" to add another batch.
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px' }}>
                <strong style={{ color: '#818cf8' }}>Step 2 & 3: Shelter Orders Meals</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
                  Switch to <strong>Shelter A</strong>. Browse Available Donations. Click "🛒 Order Food" on Vegetable Pulao and order 35 servings. Notice remaining quantity decreases to 65.
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px' }}>
                <strong style={{ color: '#fbbf24' }}>Step 4 & 5: Rider Rahul Accepts Assignment</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
                  Switch to <strong>Rider Rahul</strong>. See the order in "Delivery Missions". Click "Accept Assignment".
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px' }}>
                <strong style={{ color: '#60a5fa' }}>Step 6 & 7: Pickup & Transit Simulation</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
                  Rahul clicks "2. Confirm Pickup (Locks Donation)", then "3. Start Delivery (Transit)". Click "Rider Move (+25%)" in the top bar to simulate live GPS movement on the map.
                </p>
              </div>

              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '12px 16px', borderRadius: '8px' }}>
                <strong style={{ color: '#fbbf24' }}>Step 8: Dynamic In-Transit Redirection!</strong>
                <p style={{ margin: '4px 0 0', color: '#f3f4f6' }}>
                  While IN_TRANSIT, click <strong>"Step 8: Demand Filled Redirect"</strong> in the top sandbox bar. The system calculates candidate shelters, finds feasible <strong>Shelter B</strong>, and immediately redirects the rider!
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px' }}>
                <strong style={{ color: '#34d399' }}>Step 9: Delivery Complete & Receipt Confirmation</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
                  Rahul clicks "Mark Delivered". Switch to Shelter B &rarr; click "Confirm Receipt". Quantities and audit logs update immediately.
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
