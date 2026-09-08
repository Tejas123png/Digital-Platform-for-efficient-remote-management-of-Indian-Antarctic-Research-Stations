import React from 'react';
import { STATION_CONFIG } from '../data/stationRooms';

export default function WeatherPanel() {
  return (
    <div className="ps-weather">
      <div className="ps-section-title">Weather Conditions</div>
      <div className="ps-weather__pending">
        <span className="ps-weather__pending-icon">🌨️</span>
        <div className="ps-weather__pending-title">EXTERNAL WEATHER FEED</div>
        <div className="ps-weather__pending-desc">
          {STATION_CONFIG.fullName}
          <br />
          {STATION_CONFIG.coordinates.lat} {STATION_CONFIG.coordinates.lon}
          <br />
          Elevation: {STATION_CONFIG.elevation}
        </div>
        <div className="ps-weather__pending-dot">
          <span style={{ color: 'var(--status-offline)' }}>●</span>
          Awaiting weather feed integration
        </div>
      </div>
    </div>
  );
}
