import React from 'react';

export default function TemperatureCard({ temperature }) {
  const tempVal = temperature !== undefined && temperature !== null ? temperature : null;
  const isOverheating = tempVal !== null && tempVal > 50.0;
  const fillPercent = tempVal !== null ? Math.min(100, Math.max(0, ((tempVal - 15) / 65) * 100)) : 45;

  return (
    <div className="metric-card" id="card-temperature">
      <div className="card-header">
        <span className="card-title">Equipment Temperature</span>
        <span className={`card-badge ${isOverheating ? 'red-badge' : ''}`}>Sensors T-01</span>
      </div>
      <div className="card-body">
        <div className="card-value-group">
          <span className="metric-value mono" id="temperature">
            {tempVal !== null ? `${tempVal} °C` : '-- °C'}
          </span>
        </div>
        <div className="metric-bar-bg">
          <div
            className={`metric-bar-fill ${isOverheating ? 'red-fill' : ''}`}
            id="bar-temperature"
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      </div>
      <div className="card-footer">
        <span>Optimal: 30.0°C – 45.0°C</span>
        <span
          className="metric-delta"
          id="temp-status"
          style={{ color: isOverheating ? '#ef4444' : 'var(--accent-cyan)' }}
        >
          {tempVal !== null ? (isOverheating ? 'Overheating' : 'Normal') : 'Checking...'}
        </span>
      </div>
    </div>
  );
}
