import React from 'react';

export default function StatusPill({ status, label, color, size = 'md', className = '' }) {
  const norm = (status || '').toUpperCase();

  let bg = '#f1f5f9';
  let text = '#475569';
  let dot = '#94a3b8';
  let displayLabel = label || status;

  if (color) {
    dot = color;
    bg = `${color}18`;
    text = color;
  } else if (norm === 'AVAILABLE' || norm === 'ON_TRACK') {
    dot = '#16a34a';
    bg = '#dcfce7';
    text = '#15803d';
    displayLabel = label || (norm === 'ON_TRACK' ? 'On Track' : 'Available');
  } else if (norm === 'RESERVED' || norm === 'AT_RISK' || norm === 'PARTIALLY_RESERVED' || norm === 'AWAITING_ASSIGNMENT' || norm === 'AWAITING_RIDER' || norm === 'HEADING_TO_PICKUP') {
    dot = '#f59e0b';
    bg = '#fef3c7';
    text = '#b45309';
    displayLabel = label || (norm === 'AT_RISK' ? 'At Risk' : norm === 'HEADING_TO_PICKUP' ? 'Heading to Pickup' : 'Reserved');
  } else if (norm === 'IN_TRANSIT' || norm === 'PICKED_UP' || norm === 'ASSIGNED' || norm === 'ACCEPTED') {
    dot = '#2563eb';
    bg = '#dbeafe';
    text = '#1d4ed8';
    displayLabel = label || (norm === 'IN_TRANSIT' ? 'In Transit' : norm === 'PICKED_UP' ? 'Picked Up' : 'Accepted');
  } else if (norm === 'DELIVERED' || norm === 'COMPLETED') {
    dot = '#0d9488';
    bg = '#ccfbf1';
    text = '#0f766e';
    displayLabel = label || 'Delivered';
  } else if (norm === 'EXPIRED' || norm === 'WILL_MISS' || norm === 'CANCELLED' || norm === 'EXPIRED_IN_TRANSIT' || norm === 'EXPIRING' || norm === 'CRITICAL') {
    dot = '#dc2626';
    bg = '#fee2e2';
    text = '#b91c1c';
    displayLabel = label || (norm === 'WILL_MISS' ? 'Will Miss Deadline' : norm === 'EXPIRING' ? 'Expiring Soon' : norm === 'EXPIRED_IN_TRANSIT' ? 'Expired In Transit' : 'Expired');
  }

  return (
    <span
      className={`ui-status-pill ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: '9999px',
        fontSize: size === 'sm' ? '11px' : '12px',
        fontWeight: 600,
        backgroundColor: bg,
        color: text,
        border: `1px solid ${dot}40`,
        whiteSpace: 'nowrap',
        lineHeight: 1.2
      }}
    >
      <span
        style={{
          width: size === 'sm' ? '6px' : '7px',
          height: size === 'sm' ? '6px' : '7px',
          borderRadius: '50%',
          backgroundColor: dot,
          flexShrink: 0
        }}
      />
      {displayLabel}
    </span>
  );
}
