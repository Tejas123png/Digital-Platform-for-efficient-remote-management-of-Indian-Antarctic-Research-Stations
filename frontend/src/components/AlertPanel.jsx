import React from 'react';
import { STATION_ROOMS } from '../data/stationRooms';

export default function AlertPanel({ alerts, onAlertClick }) {
  if (alerts.length === 0) {
    return (
      <div className="ps-panel-section">
        <div className="ps-section-title">Active Alerts</div>
        <div className="ps-no-alerts">
          <div className="ps-no-alerts-ok">
            <span>●</span>
            <span>All Systems Nominal</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ps-panel-section">
      <div className="ps-section-title">
        Active Alerts
        <span
          style={{
            marginLeft: 4,
            background: 'var(--status-critical)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 10,
          }}
        >
          {alerts.length}
        </span>
      </div>
      <div className="ps-alert-list">
        {alerts.map((alert) => {
          const room = STATION_ROOMS.find((r) => r.id === alert.roomId);
          return (
            <div
              key={alert.id}
              className={`ps-alert-item ${alert.severity}`}
              onClick={() => onAlertClick && onAlertClick(alert.roomId)}
              title={`Click to inspect ${room?.name || alert.roomId}`}
            >
              <span className="ps-alert-icon">
                {alert.severity === 'critical' ? '🔴' : '⚠️'}
              </span>
              <div className="ps-alert-content">
                <div className="ps-alert-title">{alert.message}</div>
                <div className="ps-alert-desc">{alert.description}</div>
                {room && (
                  <div className="ps-alert-room">
                    {room.icon} {room.name} — click to inspect
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
