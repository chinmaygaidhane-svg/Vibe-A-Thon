import React from 'react';
import { MapPin, Navigation, Utensils, Package, ShieldCheck, Thermometer } from 'lucide-react';
import StatusPill from './StatusPill';
import CountdownTimer from './CountdownTimer';
import Button from './Button';

export default function DonationCard({
  donation,
  onAction,
  actionLabel = 'Request Servings',
  actionDisabled = false,
  role = 'receiver',
  className = ''
}) {
  const isVeg = donation.isVegetarian ?? (donation.veg_type === 'veg');
  const mealName = donation.mealName || donation.name || 'Surplus Meal';
  const donorName = donation.donor_name || donation.donorName || 'Donor Partner';
  const availQty = donation.availableQuantity ?? donation.available_quantity ?? 0;
  const totalQty = donation.totalQuantity ?? donation.total_quantity ?? 0;
  const deadline = donation.safeUseDeadline || donation.safe_until;
  const distanceKm = donation.distanceKm || (donation.distance ? (donation.distance / 1000).toFixed(1) : null);
  const deliveryEta = donation.deliveryEtaMins || donation.travelTimeMins || null;

  return (
    <div
      className={`ui-donation-card ${className}`}
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.15s ease'
      }}
    >
      {/* Top Media / Header */}
      <div style={{ position: 'relative', height: '140px', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
        {donation.imageUrl || donation.image_url ? (
          <img
            src={donation.imageUrl || donation.image_url}
            alt={mealName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8'
          }}>
            <Utensils size={36} />
          </div>
        )}

        {/* Veg badge */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          backgroundColor: 'rgba(255,255,255,0.95)',
          padding: '3px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 700,
          color: isVeg ? '#15803d' : '#b91c1c',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '2px',
            backgroundColor: isVeg ? '#16a34a' : '#dc2626'
          }} />
          {isVeg ? 'VEG' : 'NON-VEG'}
        </div>

        {/* Countdown Badge */}
        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <CountdownTimer deadline={deadline} size="sm" />
        </div>
      </div>

      {/* Card Body */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
              {mealName}
            </h4>
            <StatusPill status={donation.status || 'AVAILABLE'} size="sm" />
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={12} /> {donorName}
          </p>
        </div>

        {/* Handling & Storage Tag */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <span style={{
            fontSize: '11px',
            padding: '2px 6px',
            backgroundColor: '#f1f5f9',
            borderRadius: '4px',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}>
            <Thermometer size={10} />
            {donation.storage_requirements ? donation.storage_requirements.replace('_', ' ') : 'Hot Insulated'}
          </span>
          {distanceKm && (
            <span style={{
              fontSize: '11px',
              padding: '2px 6px',
              backgroundColor: '#eff6ff',
              borderRadius: '4px',
              color: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              <Navigation size={10} />
              ~{distanceKm} km
            </span>
          )}
          {deliveryEta && (
            <span style={{
              fontSize: '11px',
              padding: '2px 6px',
              backgroundColor: '#f0fdf4',
              borderRadius: '4px',
              color: '#15803d'
            }}>
              ETA ~{deliveryEta}m
            </span>
          )}
        </div>

        {/* Quantity Info & Action Button */}
        <div style={{
          marginTop: 'auto',
          paddingTop: '12px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Available</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
              {availQty} <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>/ {totalQty} serv</span>
            </span>
          </div>

          {onAction && (
            <Button
              size="sm"
              variant="primary"
              disabled={actionDisabled || availQty <= 0}
              onClick={() => onAction(donation)}
            >
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
