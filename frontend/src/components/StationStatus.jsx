import React from 'react';

export default function StationStatus({ data }) {
  const lastUpdated = data?.timestamp ?? "Waiting for data...";
  const runtime = data?.runtime !== undefined ? `${data.runtime} hrs` : "--";
  const generatorHealth = data?.generator_health !== undefined ? `${data.generator_health}%` : "--%";
  const isPumpOperational = data?.pump_status === 1;

  return (
    <section className="system-summary-bar">
      <div className="summary-item">
        <span className="summary-label">LAST UPDATED</span>
        <span className="summary-val mono" id="last-updated">{lastUpdated}</span>
      </div>
      <div className="summary-item">
        <span className="summary-label">STATION RUNTIME</span>
        <span className="summary-val mono" id="runtime">{runtime}</span>
      </div>
      <div className="summary-item">
        <span className="summary-label">CORE PUMP STATUS</span>
        <span
          className={`pump-pill ${data ? (isPumpOperational ? 'operational' : 'offline') : ''}`}
          id="pump-status"
        >
          {data ? (isPumpOperational ? 'Operational' : 'Offline / Fault') : 'Checking...'}
        </span>
      </div>
      <div className="summary-item">
        <span className="summary-label">GENERATOR HEALTH</span>
        <span className="summary-val mono" id="generator-health">{generatorHealth}</span>
      </div>
    </section>
  );
}
