import React from 'react';

export default function Sidebar({ activeTab = 'overview', onTabChange = () => {} }) {
  const navItems = [
    { id: 'overview', label: 'Telemetry Overview', icon: '📊' },
    { id: 'power', label: 'Power & Grid', icon: '⚡' },
    { id: 'lifesupport', label: 'Life Support & Climate', icon: '🌡️' },
    { id: 'diagnostics', label: 'Diagnostics & Stress', icon: '🔧' },
    { id: 'logs', label: 'Outpost Logs', icon: '📜' },
  ];

  return (
    <aside className="station-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">❄</div>
        <div>
          <div className="sidebar-title">OUTPOST IV</div>
          <div className="sidebar-subtitle">Sector 7 Base</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-title">STATION TELEMETRY</div>
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-status-indicator">
          <span>●</span>
          <span>Station Operational</span>
        </div>
        <div>Firmware: v4.8.2-polar</div>
        <div>Lat: 89°59′S Long: 139°16′W</div>
      </div>
    </aside>
  );
}
