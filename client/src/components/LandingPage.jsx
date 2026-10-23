import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Building, Bike, ShieldCheck, Zap, Activity, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { switchDemoRole } = useAuth();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(5, 150, 105, 0.15)',
          color: '#34d399',
          padding: '6px 16px',
          borderRadius: '999px',
          fontSize: '0.84rem',
          fontWeight: 700,
          marginBottom: '16px',
          border: '1px solid rgba(5, 150, 105, 0.3)'
        }}>
          <Zap size={14} /> Real-Time Food Coordination Network
        </div>

        <h1 style={{
          fontSize: '3rem',
          fontWeight: 900,
          lineHeight: '1.2',
          letterSpacing: '-0.02em',
          marginBottom: '16px'
        }}>
          Zero Food Waste. Zero Waiting. <br />
          <span style={{
            background: 'linear-gradient(135deg, #10b981 0%, #38bdf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Coordinated Live in Real-Time.
          </span>
        </h1>

        <p style={{
          fontSize: '1.1rem',
          color: 'var(--text-muted)',
          maxWidth: '680px',
          margin: '0 auto 24px',
          lineHeight: '1.6'
        }}>
          AidFlow AI coordinates surplus cooked food and groceries between verified food donors, shelters, and volunteer riders with intelligent transit feasibility, dynamic in-transit rerouting, and ghost-reservation recovery.
        </p>
      </div>

      {/* Role Selection Cards (Three Entry Points) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        marginBottom: '48px'
      }}>
        {/* Donor Card */}
        <div
          onClick={() => navigate('/login/donor')}
          className="glass-panel"
          style={{
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid rgba(234, 88, 12, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.25s ease'
          }}
        >
          <div>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'rgba(234, 88, 12, 0.15)',
              color: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <Building size={26} />
            </div>

            <span style={{ fontSize: '0.8rem', color: '#ea580c', fontWeight: 800, textTransform: 'uppercase' }}>
              Role 1 • Donors
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '6px 0 10px' }}>
              Login as Food Donor
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '20px' }}>
              For restaurants, hotel mess kitchens, bakeries, and banquet caterers ready to broadcast surplus food with verified safe countdowns.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} style={{ color: '#ea580c' }} /> Configurable safe-until deadlines
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} style={{ color: '#ea580c' }} /> Automated rider allocation & split pickups
              </li>
            </ul>
          </div>

          <button className="btn btn-primary" style={{ background: '#ea580c', borderColor: '#ea580c', width: '100%', justifyContent: 'center' }}>
            Enter Donor Portal <ArrowRight size={16} />
          </button>
        </div>

        {/* Receiver Card */}
        <div
          onClick={() => navigate('/login/receiver')}
          className="glass-panel"
          style={{
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid rgba(79, 70, 229, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.25s ease'
          }}
        >
          <div>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'rgba(79, 70, 229, 0.15)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <Heart size={26} />
            </div>

            <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 800, textTransform: 'uppercase' }}>
              Role 2 • Receivers
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '6px 0 10px' }}>
              Login as Shelter / Receiver
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '20px' }}>
              For night shelters, NGOs, community kitchens, and relief camps looking to order verified hot meals and raw grocery kits.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} style={{ color: '#818cf8' }} /> Feasibility engine (blocks infeasible items)
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} style={{ color: '#818cf8' }} /> Compatibility checks (water, cooking, capacity)
              </li>
            </ul>
          </div>

          <button className="btn btn-primary" style={{ background: '#4f46e5', borderColor: '#4f46e5', width: '100%', justifyContent: 'center' }}>
            Enter Receiver Portal <ArrowRight size={16} />
          </button>
        </div>

        {/* Rider Card */}
        <div
          onClick={() => navigate('/login/rider')}
          className="glass-panel"
          style={{
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid rgba(8, 145, 178, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.25s ease'
          }}
        >
          <div>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'rgba(8, 145, 178, 0.15)',
              color: '#0891b2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <Bike size={26} />
            </div>

            <span style={{ fontSize: '0.8rem', color: '#0891b2', fontWeight: 800, textTransform: 'uppercase' }}>
              Role 3 • Volunteer Riders
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '6px 0 10px' }}>
              Login as Volunteer Rider
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '20px' }}>
              For volunteer drivers and two-wheeler couriers claiming feasible pickup missions with step-by-step telemetry routing.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} style={{ color: '#0891b2' }} /> View surplus food broadcasts across city
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} style={{ color: '#0891b2' }} /> Dynamic in-transit reroute alerts
              </li>
            </ul>
          </div>

          <button className="btn btn-primary" style={{ background: '#0891b2', borderColor: '#0891b2', width: '100%', justifyContent: 'center' }}>
            Enter Rider Portal <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
