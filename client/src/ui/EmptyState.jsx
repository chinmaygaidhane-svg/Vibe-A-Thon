import React from 'react';
import Button from './Button';

export default function EmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
  className = ''
}) {
  return (
    <div
      className={`ui-empty-state ${className}`}
      style={{
        backgroundColor: '#ffffff',
        border: '1px dashed #cbd5e1',
        borderRadius: '12px',
        padding: '48px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        maxWidth: '520px',
        margin: '20px auto'
      }}
    >
      {Icon && (
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#f1f5f9',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '4px'
        }}>
          <Icon size={28} />
        </div>
      )}

      {title && (
        <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
          {title}
        </h4>
      )}

      {message && (
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: 1.5, maxWidth: '400px' }}>
          {message}
        </p>
      )}

      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction} style={{ marginTop: '8px' }}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
