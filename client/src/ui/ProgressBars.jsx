import React from 'react';

export function CapacityBar({ current, max, label = 'Capacity', unit = 'servings' }) {
  const percentage = Math.min(100, Math.round((current / (max || 1)) * 100));
  const isHigh = percentage > 85;
  const isMed = percentage > 60;

  const barColor = isHigh ? '#dc2626' : isMed ? '#f59e0b' : '#059669';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
          {current} / {max} {unit} ({percentage}%)
        </span>
      </div>
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: '#e2e8f0',
        borderRadius: '9999px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: barColor,
          borderRadius: '9999px',
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  );
}

export function ProgressBar({ progress = 0, color = '#2563eb', height = 6 }) {
  const p = Math.max(0, Math.min(100, progress * 100));
  return (
    <div style={{
      width: '100%',
      height: `${height}px`,
      backgroundColor: '#e2e8f0',
      borderRadius: '9999px',
      overflow: 'hidden'
    }}>
      <div style={{
        width: `${p}%`,
        height: '100%',
        backgroundColor: color,
        borderRadius: '9999px',
        transition: 'width 0.3s ease'
      }} />
    </div>
  );
}

export function SimulatedTag({ label = 'Simulated', style = {} }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        backgroundColor: '#f1f5f9',
        color: '#64748b',
        border: '1px solid #cbd5e1',
        ...style
      }}
    >
      ⚙️ {label}
    </span>
  );
}
