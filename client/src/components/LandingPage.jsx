import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Heart, Bike, ArrowRight, ShieldCheck, Clock, MapPin, CheckCircle, Sparkles, Award } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    mealsSaved: 420,
    deliveriesCompleted: 38,
    activeShelters: 12,
    activeRiders: 24
  });

  useEffect(() => {
    fetch('/api/operations/summary')
      .then(res => res.json())
      .then(data => {
        if (data.metrics) {
          setStats({
            mealsSaved: data.metrics.totalServingsDelivered || 420,
            deliveriesCompleted: data.metrics.completedDeliveries || 38,
            activeShelters: 12,
            activeRiders: data.metrics.activeRidersCount || 24
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 24px' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: '#ECFDF5',
          color: '#059669',
          padding: '6px 16px',
          borderRadius: '9999px',
          fontSize: '0.85rem',
          fontWeight: 700,
          marginBottom: '20px',
          border: '1px solid #A7F3D0'
        }}>
          <Sparkles size={15} /> Real-Time Civic Surplus Food Coordination
        </div>

        <h1 style={{
          fontSize: '3.25rem',
          fontWeight: 900,
          lineHeight: '1.15',
          letterSpacing: '-0.03em',
          color: '#0F172A',
          marginBottom: '16px'
        }}>
          Zero food waste. <br />
          <span style={{ color: '#059669' }}>Every minute counts.</span>
        </h1>

        <p style={{
          fontSize: '1.15rem',
          color: '#64748B',
          maxWidth: '680px',
          margin: '0 auto 32px',
          lineHeight: '1.6'
        }}>
          AidFlow AI coordinates surplus meals between commercial donors, verified shelters, and volunteer riders with intelligent transit feasibility, automated split couriers, and in-transit rerouting.
        </p>

        {/* Live Counter Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '20px 24px',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
          maxWidth: '920px',
          margin: '0 auto'
        }}>
          <div>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#059669', display: 'block' }}>
              {stats.mealsSaved.toLocaleString()}+
            </span>
            <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Meals Rescued & Served
            </span>
          </div>

          <div>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', display: 'block' }}>
              {stats.deliveriesCompleted}
            </span>
            <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Completed Missions
            </span>
          </div>

          <div>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#4F46E5', display: 'block' }}>
              100%
            </span>
            <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Safe-Window Feasibility
            </span>
          </div>

          <div>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#EA580C', display: 'block' }}>
              &lt; 28 min
            </span>
            <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Avg Safe Transit Time
            </span>
          </div>
        </div>
      </div>

      {/* 3-Step Explainer Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        marginBottom: '56px'
      }}>
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: '#FFF7ED',
            color: '#EA580C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            fontWeight: 800,
            fontSize: '18px'
          }}>
            1
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>1. Donate Surplus Food</h3>
          <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: '1.5' }}>
            Restaurants and caterers post excess food with configurable safe-use deadlines, categories, and temperature handling needs.
          </p>
        </div>

        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: '#EEF2FF',
            color: '#4F46E5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            fontWeight: 800,
            fontSize: '18px'
          }}>
            2
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>2. Request with Feasibility</h3>
          <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: '1.5' }}>
            Shelters only see food that can feasibly reach them in time. Incompatible or expired items are filtered out on the server.
          </p>
        </div>

        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: '#ECFEFF',
            color: '#0891B2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            fontWeight: 800,
            fontSize: '18px'
          }}>
            3
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>3. Deliver & Verify</h3>
          <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: '1.5' }}>
            Volunteer riders accept assignments, navigate live with telemetry, and complete pickups and deliveries using 4-digit verification codes.
          </p>
        </div>
      </div>

      {/* Role Selection Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px'
      }}>
        {/* Donor Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderTop: '4px solid #EA580C',
          borderRadius: '12px',
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)'
        }}>
          <div>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#FFF7ED',
              color: '#EA580C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Building size={24} />
            </div>

            <span style={{ fontSize: '0.78rem', color: '#EA580C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              For Food Donors
            </span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '4px 0 8px', color: '#0F172A' }}>
              Food Donor Portal
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: '1.5', marginBottom: '24px' }}>
              Broadcast surplus food batches with verified safe countdowns, auto-split couriers, and secure pickup verification codes.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate('/login/donor')}
              className="btn btn-primary"
              style={{ flex: 1, background: '#EA580C', borderColor: '#EA580C' }}
            >
              Donor Login
            </button>
            <button
              onClick={() => navigate('/register/donor')}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Register
            </button>
          </div>
        </div>

        {/* Receiver Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderTop: '4px solid #4F46E5',
          borderRadius: '12px',
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)'
        }}>
          <div>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#EEF2FF',
              color: '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Heart size={24} />
            </div>

            <span style={{ fontSize: '0.78rem', color: '#4F46E5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              For Shelters & NGOs
            </span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '4px 0 8px', color: '#0F172A' }}>
              Shelter & Receiver Portal
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: '1.5', marginBottom: '24px' }}>
              Order incoming meals with feasibility engine protection, live rider map tracking, and handover delivery codes.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate('/login/receiver')}
              className="btn btn-primary"
              style={{ flex: 1, background: '#4F46E5', borderColor: '#4F46E5' }}
            >
              Shelter Login
            </button>
            <button
              onClick={() => navigate('/register/receiver')}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Register
            </button>
          </div>
        </div>

        {/* Rider Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderTop: '4px solid #0891B2',
          borderRadius: '12px',
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)'
        }}>
          <div>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#ECFEFF',
              color: '#0891B2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Bike size={24} />
            </div>

            <span style={{ fontSize: '0.78rem', color: '#0891B2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              For Volunteer Riders
            </span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '4px 0 8px', color: '#0F172A' }}>
              Volunteer Rider Portal
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: '1.5', marginBottom: '24px' }}>
              Claim delivery missions, build your reliability score, track live routes, and enter handover codes on the go.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate('/login/rider')}
              className="btn btn-primary"
              style={{ flex: 1, background: '#0891B2', borderColor: '#0891B2' }}
            >
              Rider Login
            </button>
            <button
              onClick={() => navigate('/register/rider')}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Register
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
