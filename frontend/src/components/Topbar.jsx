import React, { useState, useEffect } from 'react';

export default function Topbar({ isConnected }) {
  const [stationTime, setStationTime] = useState('--:--:--');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setStationTime(now.toUTCString().split(' ')[4] + ' UTC');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="station-header">
      <div className="station-brand">
        <div className="station-logo">
          <span className="logo-icon">❄</span>
        </div>
        <div className="station-meta">
          <h1>AMUNDSEN-SCOTT OUTPOST IV</h1>
          <p className="subtitle">Antarctic Sector 7 • Autonomous Power & Life-Support Telemetry</p>
        </div>
      </div>

      <div className="header-controls">
        {/* Connection Status Badge */}
        <div
          id="connection-container"
          className={`status-badge ${isConnected ? 'connected' : 'disconnected'}`}
        >
          <span className="status-dot"></span>
          <span id="connection-status">
            {isConnected ? 'Simulator Connected' : 'Simulator Disconnected'}
          </span>
        </div>

        {/* Station UTC Clock */}
        <div className="clock-badge">
          <span className="clock-label">STATION UTC</span>
          <span className="clock-value" id="station-clock">{stationTime}</span>
        </div>
      </div>
    </header>
  );
}
