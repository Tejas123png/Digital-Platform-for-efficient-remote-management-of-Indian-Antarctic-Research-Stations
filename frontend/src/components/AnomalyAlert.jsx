import React from 'react';

export default function AnomalyAlert({ data }) {
  if (!data) return null;

  const anomalies = [];
  if (data.pump_status === 0) {
    anomalies.push("Cooling Pump Offline / Failure detected");
  }
  if (data.vibration > 7.0) {
    anomalies.push(`Excessive mechanical vibration (${data.vibration} mm/s)`);
  }
  if (data.generator_load > 90.0) {
    anomalies.push(`Generator overload spike (${data.generator_load}%)`);
  }
  if (data.heating > 65.0) {
    anomalies.push(`Habitat heating thermal surge (${data.heating} kW)`);
  }
  if (data.power_generation < 40.0) {
    anomalies.push(`Power generation drop detected (${data.power_generation} kW)`);
  }
  if (data.power_consumption > 100.0) {
    anomalies.push(`Power consumption spike detected (${data.power_consumption} kW)`);
  }

  if (anomalies.length === 0) return null;

  return (
    <div id="anomaly-banner" className="anomaly-banner">
      <div className="anomaly-icon">⚠️</div>
      <div className="anomaly-content">
        <span className="anomaly-title" id="anomaly-title">CRITICAL SYSTEM ALERT</span>
        <span className="anomaly-desc" id="anomaly-desc">{anomalies.join(" • ")}</span>
      </div>
    </div>
  );
}
