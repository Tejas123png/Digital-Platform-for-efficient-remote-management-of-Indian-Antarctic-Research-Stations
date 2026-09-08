import React from 'react';
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

  if (!room) {
    return (
      <div className="ps-room-panel">
        <div className="ps-section-title">Room Inspector</div>
        <div className="ps-room-panel__empty">
          <span className="ps-room-panel__empty-icon">🗺️</span>
          <div className="ps-room-panel__empty-text">
            Select a room or system area on the digital twin to inspect its live telemetry.
          </div>
        </div>
      </div>
    );
  }

  const status = room.statusLogic(stationData);

  return (
    <div className="ps-room-panel">
      <div className="ps-room-panel__header">
        <span className="ps-room-panel__icon">{room.icon}</span>
        <div className="ps-room-panel__name">{room.name.toUpperCase()}</div>
        <div className="ps-room-panel__desc">{room.description}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className={`ps-status-badge ${status}`}>
            <span className="ps-status-dot" />
            {status === 'normal' ? 'OPERATIONAL' : status.toUpperCase()}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
            }}
            title="Deselect room"
          >
            ✕
          </button>
        </div>
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
  );
}
