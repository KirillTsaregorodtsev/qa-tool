import React, { useEffect, useId } from 'react';

export default function Spinner({ size = 24, color = '#0066FF' }) {
  const animId = useId().replace(/:/g, '');

  const keyframeStyle = `
    @keyframes spin_${animId} {
      to { transform: rotate(360deg); }
    }
  `;

  return (
    <>
      <style>{keyframeStyle}</style>
      <span
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          borderRadius: '50%',
          border: `2px solid ${color}22`,
          borderTopColor: color,
          animation: `spin_${animId} 0.7s linear infinite`,
          flexShrink: 0,
        }}
        role="status"
        aria-label="Loading"
      />
    </>
  );
}
