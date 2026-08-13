import React from 'react';

export default function EmptyState({ message, children }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '48px 24px',
        color: '#94A3B8',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: '28px', lineHeight: 1 }}>&#9723;</span>
      <p style={{ fontSize: '14px', margin: 0, maxWidth: '320px' }}>{message}</p>
      {children && <div>{children}</div>}
    </div>
  );
}
