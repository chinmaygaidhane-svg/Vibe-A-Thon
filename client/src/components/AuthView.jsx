import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, Phone, MapPin, Truck, Building, Heart, Bike, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function AuthView({ defaultRegister = false }) {
  const { role: routeRole } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [activeRole, setActiveRole] = useState(routeRole || 'donor');
  const [isRegister, setIsRegister] = useState(defaultRegister || window.location.pathname.includes('/register'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (routeRole && ['donor', 'receiver', 'rider'].includes(routeRole)) {
      setActiveRole(routeRole);
    }
    setIsRegister(defaultRegister || window.location.pathname.includes('/register'));
  }, [routeRole, defaultRegister]);

  // Form Fields
  const [formData, setFormData] = useState({
    email: '',
    password: 'Demo@1234',
    name: '',
    phone: '+91 98230 11223',
    // Donor specific
    donorCategory: 'Restaurant',
    pickupAddress: 'FC Road, Shivaji Nagar, Pune',
    lat: '18.5284',
    lng: '73.8425',
    // Receiver specific
    orgType: 'Night Shelter',
    address: 'Koregaon Park, Pune',
    storageCapacity: '120',
    cleanWater: true,
    cookingFacilities: true,
    foodHandlingCapabilities: 'cooked,packaged',
    operatingHours: '06:00 - 23:00',
    currentDemand: '50',
    // Rider specific
    vehicleType: 'Two-Wheeler (Motorbike)',
    maxCapacity: '40',
    preferredArea: 'Pune Central (FC Road, Shivaji Nagar)',
    availability: true,
    locationSharing: true
  });

  // Prefill realistic credentials for demo
  useEffect(() => {
    if (!isRegister) {
      if (activeRole === 'donor') {
        setFormData(prev => ({ ...prev, email: 'donor@aidflow.org', password: 'Demo@1234' }));
      } else if (activeRole === 'receiver') {
        setFormData(prev => ({ ...prev, email: 'shelterA@aidflow.org', password: 'Demo@1234' }));
      } else if (activeRole === 'rider') {
        setFormData(prev => ({ ...prev, email: 'rider@aidflow.org', password: 'Demo@1234' }));
      }
    }
  }, [activeRole, isRegister]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Role fixed by route on register
    const endpoint = isRegister ? `/api/auth/register/${activeRole}` : '/api/auth/login';
    const payload = isRegister
      ? { ...formData, role: activeRole, orgName: formData.name, fullName: formData.name }
      : { email: formData.email, password: formData.password, role: activeRole };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        login(data.token, data.user);
        navigate(`/${data.user.role}`);
      } else {
        setError(data.error || 'Authentication failed. Please check credentials.');
      }
    } catch {
      setError('Connection error. Server may be offline.');
    } finally {
      setLoading(false);
    }
  };

  const roleColors = {
    donor: '#ea580c',
    receiver: '#4f46e5',
    rider: '#0891b2'
  };

  const roleIcons = {
    donor: <Building size={20} />,
    receiver: <Heart size={20} />,
    rider: <Bike size={20} />
  };

  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 20px' }}>
      <button
        onClick={() => navigate('/')}
        className="btn btn-sm btn-secondary"
        style={{ marginBottom: '20px' }}
      >
        <ArrowLeft size={14} /> Back to Role Selection
      </button>

      <div className="glass-panel" style={{ padding: '32px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: `${roleColors[activeRole]}20`,
            color: roleColors[activeRole],
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            {roleIcons[activeRole]}
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 6px' }}>
            {isRegister ? `Register as ${activeRole.toUpperCase()}` : `${activeRole.toUpperCase()} Login`}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            {isRegister
              ? `Create your verified ${activeRole} account with custom operational capacity.`
              : `Access your ${activeRole} coordination dashboard.`}
          </p>
        </div>

        {/* Role Switcher Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '8px',
          background: 'rgba(255,255,255,0.03)',
          padding: '6px',
          borderRadius: '10px',
          marginBottom: '24px'
        }}>
          {['donor', 'receiver', 'rider'].map(r => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setActiveRole(r);
                navigate(isRegister ? `/register/${r}` : `/login/${r}`);
              }}
              style={{
                background: activeRole === r ? roleColors[r] : 'transparent',
                color: activeRole === r ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.2s ease'
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '0.84rem',
            color: '#fca5a5',
            marginBottom: '20px'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Common Fields */}
          {isRegister && (
            <div className="form-group">
              <label className="form-label">
                {activeRole === 'donor' ? 'Organization / Restaurant Name *' : activeRole === 'receiver' ? 'Shelter / NGO Name *' : 'Full Name *'}
              </label>
              <input
                type="text"
                required
                className="form-input"
                placeholder={activeRole === 'donor' ? 'e.g. ABC Restaurant' : activeRole === 'receiver' ? 'e.g. Hope Haven Shelter' : 'e.g. Rahul Sharma'}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input
              type="email"
              required
              className="form-input"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              type="password"
              required
              className="form-input"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
            />
            {!isRegister && (
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Hint: Demo accounts use password: <strong style={{ color: '#38bdf8' }}>Demo@1234</strong>
              </span>
            )}
          </div>

          {/* Role-Specific Registration Fields */}
          {isRegister && activeRole === 'donor' && (
            <>
              <div className="form-group">
                <label className="form-label">Donor Category *</label>
                <select
                  className="form-select"
                  value={formData.donorCategory}
                  onChange={e => setFormData({ ...formData, donorCategory: e.target.value })}
                >
                  <option value="Restaurant">Restaurant</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Hostel Mess">Hostel Mess</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Grocery">Grocery / Supermarket</option>
                  <option value="Caterer">Caterer / Banquet Hall</option>
                  <option value="Other">Other</option>
                </select>
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
            </>
          )}

          {isRegister && activeRole === 'receiver' && (
            <>
              <div className="form-group">
                <label className="form-label">Shelter Organization Type *</label>
                <select
                  className="form-select"
                  value={formData.orgType}
                  onChange={e => setFormData({ ...formData, orgType: e.target.value })}
                >
                  <option value="Night Shelter">Night Shelter</option>
                  <option value="Community Kitchen">Community Kitchen</option>
                  <option value="Orphanage">Orphanage</option>
                  <option value="Relief Camp">Relief Camp</option>
                  <option value="NGO">Registered NGO</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Storage Capacity (Portions)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.storageCapacity}
                    onChange={e => setFormData({ ...formData, storageCapacity: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Current Demand</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.currentDemand}
                    onChange={e => setFormData({ ...formData, currentDemand: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', padding: '10px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.cleanWater}
                    onChange={e => setFormData({ ...formData, cleanWater: e.target.checked })}
                  />
                  Potable Clean Water Available
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.cookingFacilities}
                    onChange={e => setFormData({ ...formData, cookingFacilities: e.target.checked })}
                  />
                  Cooking Facilities Available
                </label>
              </div>
            </>
          )}

          {isRegister && activeRole === 'rider' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Vehicle Type *</label>
                  <select
                    className="form-select"
                    value={formData.vehicleType}
                    onChange={e => setFormData({ ...formData, vehicleType: e.target.value })}
                  >
                    <option value="Two-Wheeler (Motorbike)">Two-Wheeler (Motorbike)</option>
                    <option value="Two-Wheeler (Scooter)">Two-Wheeler (Scooter)</option>
                    <option value="Bicycle">Bicycle</option>
                    <option value="Van / Mini-Truck">Van / Mini-Truck</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Max Carrying Capacity (Servings) *</label>
                  <input
                    type="number"
                    required
                    className="form-input"
                    value={formData.maxCapacity}
                    onChange={e => setFormData({ ...formData, maxCapacity: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Operating Area *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={formData.preferredArea}
                  onChange={e => setFormData({ ...formData, preferredArea: e.target.value })}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              background: roleColors[activeRole],
              borderColor: roleColors[activeRole],
              width: '100%',
              justifyContent: 'center',
              marginTop: '10px'
            }}
          >
            {loading ? 'Authenticating...' : isRegister ? `Create ${activeRole.toUpperCase()} Account` : `Sign in as ${activeRole.toUpperCase()}`}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
          {isRegister ? (
            <span>
              Already registered?{' '}
              <Link to={`/login/${activeRole}`} style={{ color: roleColors[activeRole], fontWeight: 700 }}>
                Sign in here
              </Link>
            </span>
          ) : (
            <span>
              Don't have an account?{' '}
              <Link to={`/register/${activeRole}`} style={{ color: roleColors[activeRole], fontWeight: 700 }}>
                Register as {activeRole}
              </Link>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
