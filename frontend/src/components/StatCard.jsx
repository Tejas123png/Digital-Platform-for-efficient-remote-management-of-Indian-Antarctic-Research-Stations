import React from 'react';

export default function StatCard({
  id,
  title,
  badgeText,
  badgeClass = '',
  valueId,
  value,
  unit = '',
  fillPercent = 50,
  fillClass = '',
  footerLeft,
  footerRight,
  footerRightStyle = {}
}) {
  return (
    <div className="metric-card" id={id}>
      <div className="card-header">
        <span className="card-title">{title}</span>
        {badgeText && (
          <span className={`card-badge ${badgeClass}`}>{badgeText}</span>
        )}
      </div>
      <div className="card-body">
        <div className="card-value-group">
          <span className="metric-value mono" id={valueId}>
            {value !== undefined && value !== null ? value : '--'}
          </span>
          {unit && <span className="metric-unit">{unit}</span>}
        </div>
        <div className="metric-bar-bg">
          <div
            className={`metric-bar-fill ${fillClass}`}
            style={{ width: `${Math.min(100, Math.max(0, fillPercent))}%` }}
          />
        </div>
      </div>
      <div className="card-footer">
        <span>{footerLeft}</span>
        <span className="metric-delta" style={footerRightStyle}>
          {footerRight}
        </span>
      </div>
    </div>
  );
}
