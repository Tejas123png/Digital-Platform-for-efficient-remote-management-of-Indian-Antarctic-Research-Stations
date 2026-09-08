import React from 'react';

export default function VibrationCard({ vibration }) {
  const vibVal = vibration !== undefined && vibration !== null ? vibration : null;
  const isHighVib = vibVal !== null && vibVal > 5.0;
  const fillPercent = vibVal !== null ? Math.min(100, Math.max(0, (vibVal / 12) * 100)) : 40;

  return (
    <div className="metric-card" id="card-vibration">
      <div className="card-header">
        <span className="card-title">Vibration</span>
        <span className={`card-badge ${isHighVib ? 'red-badge' : ''}`}>Piezo Axis</span>
      </div>
      <div className="card-body">
        <div className="card-value-group">
          <span className="metric-value mono" id="vibration">
            {vibVal !== null ? vibVal : '--'}
          </span>
          <span className="metric-unit">mm/s</span>
        </div>
        <div className="metric-bar-bg">
          <div
            className={`metric-bar-fill purple-fill ${isHighVib ? 'red-fill' : ''}`}
            id="bar-vibration"
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      </div>
      <div className="card-footer">
        <span>Harmonic Threshold: 5.0</span>
        <span
          className="metric-delta"
          id="vib-status"
          style={{ color: isHighVib ? '#ef4444' : 'var(--accent-cyan)' }}
        >
          {vibVal !== null ? (isHighVib ? 'High Vibration' : 'Stable') : 'Checking...'}
        </span>
      </div>
    </div>
  );
}
