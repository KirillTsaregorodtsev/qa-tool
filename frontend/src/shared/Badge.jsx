import React from 'react';

const STATUS_MAP = {
  success: { bg: '#22C55E26', color: '#16A34A' },
  error:   { bg: '#EF444426', color: '#DC2626' },
  warning: { bg: '#F59E0B26', color: '#D97706' },
  info:    { bg: '#3B82F626', color: '#2563EB' },
  neutral: { bg: '#94A3B826', color: '#64748B' },
};

export default function Badge({ status = 'neutral', label }) {
  const { bg, color } = STATUS_MAP[status] ?? STATUS_MAP.neutral;

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: '500',
        lineHeight: '18px',
        background: bg,
        color: color,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
