import React from 'react';

export default function StatCard({
  icon: Icon,
  label,
  value,
  caption,
  trend,
  color = '#059669',
  className = '',
  onClick
}) {
  return (
    <div
      onClick={onClick}
      className={`ui-stat-card ${className}`}
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>{label}</span>
        {Icon && (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: `${color}15`,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Icon size={16} />
          </div>
        )}
      </div>

      <div style={{
        fontSize: '28px',
        fontWeight: 700,
        color: '#0f172a',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.15
      }}>
        {value}
      </div>

      {(caption || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
          {trend && (
            <span style={{
              fontWeight: 600,
              color: trend.startsWith('+') ? '#16a34a' : trend.startsWith('-') ? '#dc2626' : '#64748b'
            }}>
              {trend}
            </span>
          )}
          {caption && <span>{caption}</span>}
        </div>
      )}
    </div>
  );
}
