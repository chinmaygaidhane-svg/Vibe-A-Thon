import React from 'react';

export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size = 'md', // 'sm' | 'md' | 'lg'
  isLoading = false,
  disabled = false,
  icon: Icon = null,
  onClick,
  type = 'button',
  className = '',
  style = {},
  id,
  title
}) {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.65 : 1,
    transition: 'all 0.15s ease',
    border: '1px solid transparent',
    textDecoration: 'none',
    fontFamily: 'inherit',
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style
  };

  return (
    <button
      id={id}
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      title={title}
      className={`ui-btn ui-btn-${variant} ${className}`}
      style={baseStyle}
    >
      {isLoading ? (
        <span className="ui-spinner" style={{
          width: '14px',
          height: '14px',
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'spin 0.6s linear infinite'
        }} />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
      ) : null}
      {children}
    </button>
  );
}

const sizeStyles = {
  sm: { padding: '6px 12px', fontSize: '13px' },
  md: { padding: '8px 16px', fontSize: '14px' },
  lg: { padding: '12px 24px', fontSize: '15px' }
};

const variantStyles = {
  primary: {
    backgroundColor: '#059669',
    color: '#ffffff',
    borderColor: '#059669'
  },
  secondary: {
    backgroundColor: '#f1f5f9',
    color: '#0f172a',
    borderColor: '#cbd5e1'
  },
  danger: {
    backgroundColor: '#dc2626',
    color: '#ffffff',
    borderColor: '#dc2626'
  },
  ghost: {
    backgroundColor: 'transparent',
    color: '#475569',
    borderColor: 'transparent'
  },
  outline: {
    backgroundColor: '#ffffff',
    color: '#059669',
    borderColor: '#059669'
  }
};
