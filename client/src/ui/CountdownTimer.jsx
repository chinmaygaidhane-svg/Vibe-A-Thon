import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function CountdownTimer({ deadline, className = '', showIcon = true, size = 'md' }) {
  const [timeLeft, setTimeLeft] = useState(calcRemaining(deadline));

  useEffect(() => {
    setTimeLeft(calcRemaining(deadline));
    const timer = setInterval(() => {
      setTimeLeft(calcRemaining(deadline));
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  function calcRemaining(target) {
    if (!target) return { totalMs: 0, expired: true, text: 'No deadline' };
    const diff = new Date(target).getTime() - Date.now();
    if (diff <= 0) {
      return { totalMs: 0, expired: true, text: 'Expired' };
    }
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;

    let text = '';
    if (hrs > 0) {
      text = `${hrs}h ${remMins}m left`;
    } else {
      text = `${mins}m ${secs < 10 ? '0' : ''}${secs}s left`;
    }

    return {
      totalMs: diff,
      mins,
      expired: false,
      text
    };
  }

  // Color thresholds:
  // > 30 mins: green (#16a34a)
  // 10 - 30 mins: amber (#f59e0b)
  // < 10 mins: red (#dc2626) gently pulsing
  // Expired: red (#dc2626)
  let color = '#16a34a';
  let bg = '#dcfce7';
  let border = '#86efac';
  let isPulsing = false;

  if (timeLeft.expired) {
    color = '#dc2626';
    bg = '#fee2e2';
    border = '#fca5a5';
  } else if (timeLeft.mins < 10) {
    color = '#dc2626';
    bg = '#fee2e2';
    border = '#fca5a5';
    isPulsing = true;
  } else if (timeLeft.mins <= 30) {
    color = '#d97706';
    bg = '#fef3c7';
    border = '#fde68a';
  }

  return (
    <span
      className={`ui-countdown ${isPulsing ? 'ui-pulse-red' : ''} ${className}`}
      title={deadline ? new Date(deadline).toLocaleString() : ''}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: '9999px',
        fontSize: size === 'sm' ? '11px' : '12px',
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        backgroundColor: bg,
        color: color,
        border: `1px solid ${border}`,
        whiteSpace: 'nowrap'
      }}
    >
      {showIcon && <Clock size={size === 'sm' ? 12 : 13} style={{ flexShrink: 0 }} />}
      <span>{timeLeft.text}</span>
    </span>
  );
}
