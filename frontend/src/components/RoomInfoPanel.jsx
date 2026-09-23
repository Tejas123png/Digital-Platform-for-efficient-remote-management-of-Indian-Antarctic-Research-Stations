import React, { useEffect } from 'react';
import { STATION_ROOMS, TELEMETRY_LABELS } from '../data/stationRooms';

function TelField({ field, value }) {
  const meta = TELEMETRY_LABELS[field] || { label: field, unit: '' };

  if (meta.isBool) {
    const isOn = value === 1;
    return (
      <div className="ps-telem-row">
        <span className="ps-telem-label">{meta.label}</span>
        <span className={`ps-pump-badge ${isOn ? 'operational' : 'fault'}`}>
          <span className="ps-status-dot" />
          {isOn ? 'Operational' : 'FAULT'}
        </span>
      </div>
    );
  }

  const display =
    value !== undefined && value !== null
      ? typeof value === 'number'
        ? value.toFixed(meta.precision ?? 2)
        : value
      : '--';

  const pct =
    meta.max && value !== undefined ? Math.min(100, Math.max(0, (value / meta.max) * 100)) : 0;

  return (
    <div>
      <div className="ps-telem-row">
        <span className="ps-telem-label">{meta.label}</span>
        <span>
          <span className="ps-telem-value">{display}</span>
          {meta.unit && <span className="ps-telem-unit">{meta.unit}</span>}
        </span>
      </div>
      {meta.max && (
        <div className="ps-telem-bar">
          <div className="ps-telem-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function RoomInfoPanel({ selectedRoomId, stationData, onClose }) {
  const room = STATION_ROOMS.find((r) => r.id === selectedRoomId);

  // Close on ESC key
  useEffect(() => {
    if (!room) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [room, onClose]);

  if (!room) return null;

  const status = room.statusLogic(stationData);

  return (
    <div className="ps-ai-modal-backdrop" onClick={onClose}>
      <div className="ps-room-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ps-ai-modal-header">
          <div className="ps-ai-modal-title">
            <span style={{ fontSize: '18px' }}>{room.icon}</span>
            {room.name.toUpperCase()}
          </div>
          <button className="ps-ai-modal-close" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="ps-ai-modal-body">
          {/* Room info card */}
          <div style={{
            padding: '10px 12px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            marginBottom: '14px',
            borderLeft: status === 'critical' ? '3px solid var(--status-critical)' : status === 'warning' ? '3px solid var(--status-warning)' : '3px solid var(--status-normal)'
          }}>
            <div className="ps-room-panel__desc" style={{ fontSize: '11px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              {room.description}
            </div>
            <span className={`ps-status-badge ${status}`}>
              <span className="ps-status-dot" />
              {status === 'normal' ? 'OPERATIONAL' : status.toUpperCase()}
            </span>
          </div>

          {/* Telemetry Fields */}
          {stationData ? (
            room.telemetryFields.map((field) => (
              <TelField key={field} field={field} value={stationData[field]} />
            ))
          ) : (
            <div style={{ padding: '8px 0', color: 'var(--text-muted)', fontSize: 11 }}>
              Waiting for telemetry…
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ps-ai-modal-footer">
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Press <kbd>ESC</kbd> to close</span>
          <button className="ps-ai-modal-btn-close" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}
