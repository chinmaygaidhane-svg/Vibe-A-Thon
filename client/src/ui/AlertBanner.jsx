import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import Button from './Button';

export default function AlertBanner({
  type = 'info', // 'info' | 'warning' | 'critical' | 'success'
  title,
  message,
  actionLabel,
  onAction,
  className = '',
  style = {}
}) {
  const configs = {
    info: {
      bg: '#eff6ff',
      border: '#bfdbfe',
      text: '#1e40af',
      iconColor: '#3b82f6',
      Icon: Info,
      btnVariant: 'secondary'
    },
    warning: {
      bg: '#fffbeb',
      border: '#fde68a',
      text: '#92400e',
      iconColor: '#f59e0b',
      Icon: AlertTriangle,
      btnVariant: 'secondary'
    },
    critical: {
      bg: '#fef2f2',
      border: '#fecaca',
      text: '#991b1b',
      iconColor: '#dc2626',
      Icon: AlertCircle,
      btnVariant: 'danger'
    },
    success: {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      text: '#166534',
      iconColor: '#16a34a',
      Icon: CheckCircle2,
      btnVariant: 'secondary'
    }
  };

  const cfg = configs[type] || configs.info;
  const IconComp = cfg.Icon;

  return (
    <div
      role="alert"
      className={`ui-alert-banner ${className}`}
      style={{
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: '10px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        color: cfg.text,
        fontSize: '14px',
        ...style
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
        <IconComp size={18} style={{ color: cfg.iconColor, flexShrink: 0, marginTop: '2px' }} />
        <div>
          {title && <strong style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>{title}</strong>}
          <div>{message}</div>
        </div>
      </div>

      {actionLabel && onAction && (
        <Button
          size="sm"
          variant={cfg.btnVariant}
          onClick={onAction}
          style={{ flexShrink: 0 }}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
