import React, { useState, useEffect } from 'react';
import { STATION_CONFIG } from '../data/stationRooms';

export default function Header({
  connectionStatus,
  lastUpdated,
  activeStation,
  onStationChange,
  networkBandwidth,
  networkStatus,
}) {
  const [utcTime, setUtcTime] = useState('--:--:--');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().split(' ')[4] + ' UTC');
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const connLabel =
    connectionStatus === 'connected'
      ? 'SIMULATOR ONLINE'
      : connectionStatus === 'connecting'
      ? 'CONNECTING…'
      : 'OFFLINE';

  // Determine Network Speed indicator state
  let netClass = 'offline';
  let speedText = '--';
  let statusText = 'OFFLINE';

  if (connectionStatus === 'connected' && networkBandwidth != null) {
    const status = (networkStatus || 'NORMAL').toUpperCase();
    statusText = status;
    netClass = status === 'SLOW' ? 'slow' : 'normal';
    speedText = typeof networkBandwidth === 'number'
      ? `${networkBandwidth.toFixed(1)} Mbps`
      : `${networkBandwidth} Mbps`;
  }

  return (
    <header className="ps-header">
      {/* Brand */}
      <div className="ps-header__brand">
        <div className="ps-header__logo">❄</div>
        <div className="ps-header__wordmark">
          <span className="ps-header__title">POLAR SYNC</span>
          <span className="ps-header__subtitle">Antarctic Station Management</span>
        </div>
      </div>

      {/* Center — Station & Selector */}
      <div className="ps-header__center">
        <div className="ps-station-id">
          <span className="ps-station-id__flag">🇮🇳</span>
          <div>
            <div className="ps-station-id__name">{STATION_CONFIG.name}</div>
            <div className="ps-station-id__sub">{STATION_CONFIG.location}</div>
          </div>
        </div>

        <div className="ps-station-selector">
          {['MAITRI', 'BHARATI'].map((s) => (
            <button
              key={s}
              className={`ps-station-btn ${
                activeStation === s ? 'active' : s === 'BHARATI' ? 'inactive' : ''
              }`}
              onClick={() => s !== 'BHARATI' && onStationChange(s)}
              title={s === 'BHARATI' ? 'Coming soon' : s}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Right — Connection + Network Speed + Clock */}
      <div className="ps-header__right">
        <div className={`ps-connection-badge ${connectionStatus}`}>
          <span className="ps-status-dot" />
          {connLabel}
        </div>

        <div className={`ps-network-badge ${netClass}`} title={`Network Status: ${statusText}`}>
          <span className="ps-net-icon">⇅</span>
          <span className="ps-net-speed">{speedText}</span>
          <span className="ps-net-status">[{statusText}]</span>
        </div>

        <div className="ps-header__clock">
          <div className="ps-header__clock-label">STATION UTC</div>
          <div className="mono">{utcTime}</div>
          {lastUpdated && (
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              SIM: {lastUpdated.split(' ')[1] ?? lastUpdated}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
