import React from 'react';
import { Check, Clock, AlertCircle } from 'lucide-react';

export default function Timeline({
  status, // 'ACCEPTED' | 'HEADING_TO_PICKUP' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED'
  history = [],
  timestamps = {},
  isExpiring = false,
  className = ''
}) {
  const steps = [
    { key: 'ACCEPTED', label: 'Accepted by Rider' },
    { key: 'HEADING_TO_PICKUP', label: 'Heading to Pickup' },
    { key: 'PICKED_UP', label: 'Picked Up from Donor' },
    { key: 'IN_TRANSIT', label: 'In Transit to Shelter' },
    { key: 'DELIVERED', label: 'Delivered Safely' }
  ];

  const norm = (status || '').toUpperCase();
  const stepKeys = steps.map(s => s.key);
  let currentIndex = stepKeys.indexOf(norm);
  if (norm === 'ASSIGNED') currentIndex = 0;
  if (norm === 'CANCELLED' || norm === 'EXPIRED_IN_TRANSIT') currentIndex = -1;

  return (
    <div className={`ui-timeline ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {steps.map((step, idx) => {
        const isCompleted = currentIndex > idx || norm === 'DELIVERED';
        const isCurrent = currentIndex === idx && norm !== 'DELIVERED';
        const isPending = currentIndex < idx && norm !== 'DELIVERED';

        let iconBg = '#e2e8f0';
        let iconColor = '#94a3b8';
        let borderColor = '#e2e8f0';

        if (isCompleted) {
          iconBg = '#059669';
          iconColor = '#ffffff';
          borderColor = '#059669';
        } else if (isCurrent) {
          iconBg = isExpiring ? '#dc2626' : '#2563eb';
          iconColor = '#ffffff';
          borderColor = isExpiring ? '#dc2626' : '#2563eb';
        }

        const timestamp = timestamps[step.key.toLowerCase()] || (isCurrent ? 'Now' : null);

        return (
          <div key={step.key} style={{ display: 'flex', gap: '14px', position: 'relative' }}>
            {/* Left connector column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: iconBg,
                color: iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
                zIndex: 1,
                boxShadow: isCurrent ? '0 0 0 3px rgba(37,99,235,0.2)' : 'none'
              }}>
                {isCompleted ? <Check size={14} /> : isCurrent ? <Clock size={14} /> : idx + 1}
              </div>

              {idx < steps.length - 1 && (
                <div style={{
                  width: '2px',
                  flex: 1,
                  minHeight: '28px',
                  backgroundColor: isCompleted ? '#059669' : '#e2e8f0',
                  margin: '4px 0'
                }} />
              )}
            </div>

            {/* Right details column */}
            <div style={{ paddingBottom: idx === steps.length - 1 ? '0' : '16px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: isCurrent ? 700 : isCompleted ? 600 : 400,
                  color: isCurrent ? '#0f172a' : isCompleted ? '#334155' : '#94a3b8'
                }}>
                  {step.label}
                </span>
                {timestamp && (
                  <span style={{ fontSize: '11px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                    {timestamp}
                  </span>
                )}
              </div>
              {isCurrent && isExpiring && (
                <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                  ⚠️ Critical delay: Expiry window closing
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
