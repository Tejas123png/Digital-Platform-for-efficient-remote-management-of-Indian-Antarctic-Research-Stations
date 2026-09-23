import React from 'react';
import { TELEMETRY_LABELS } from '../data/stationRooms';

/* ── Helpers ─────────────────────────────────────────────── */

function getFieldAlert(field, alerts, value) {
  // Check central alerts first
  if (alerts) {
    const alert = alerts.find((a) => a.field === field);
    if (alert) return alert;
  }
  
  // Generator Health doesn't have a central alert rule but was explicitly requested to highlight
  // based on existing severity/state logic if it drops.
  if (field === 'generator_health') {
    if (value < 50) return { severity: 'critical', message: 'CRITICAL' };
    if (value < 80) return { severity: 'warning', message: 'WARNING' };
  }
  
  return null;
}

/* ── MetricBlock — full-width card with big value + bar ─── */
function MetricBlock({ field, value, alerts }) {
  const meta = TELEMETRY_LABELS[field] || { label: field, unit: '', precision: 2 };
  
  const alert = getFieldAlert(field, alerts, value);
  const isCrit = alert?.severity === 'critical';
  const isWarn = alert?.severity === 'warning';

  let vc = 'var(--text-primary)';
  let bc = 'var(--accent-blue)';
  
  if (isCrit) {
    vc = 'var(--status-critical)';
    bc = 'var(--status-critical)';
  } else if (isWarn) {
    vc = 'var(--status-warning)';
    bc = 'var(--status-warning)';
  }

  const badge = alert ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
      <span className={`ps-severity-dot ${alert.severity}`} />
      <span className={`ps-severity-label ${alert.severity}`}>
        {isCrit ? 'CRITICAL' : 'WARNING'}
      </span>
    </div>
  ) : null;

  if (meta.isBool) {
    const isOn = value === 1;
    // If pump status has an alert, it means failure
    const isPumpFault = alert && isCrit;
    return (
      <div className="lp-metric-block">
        <div className="lp-metric-label">{meta.label.toUpperCase()}</div>
        <div className={`ps-pump-badge ${isPumpFault || !isOn ? 'fault' : 'operational'}`} style={{ fontSize: 13, padding: '4px 10px', marginTop: '4px' }}>
          <span className="ps-status-dot" />
          {isPumpFault || !isOn ? 'FAULT — OFFLINE' : 'OPERATIONAL'}
        </div>
        {badge}
      </div>
    );
  }

  const display = value !== undefined && value !== null
    ? (typeof value === 'number' ? value.toFixed(meta.precision ?? 2) : value)
    : '—';

  const pct = meta.max && value !== undefined
    ? Math.min(100, Math.max(0, (value / meta.max) * 100))
    : null;

  return (
    <div className="lp-metric-block">
      <div className="lp-metric-row">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="lp-metric-label">{meta.label.toUpperCase()}</span>
          {badge}
        </div>
        <span className="lp-metric-value" style={{ color: vc }}>
          {display}
          {meta.unit && <span className="lp-metric-unit">{meta.unit}</span>}
        </span>
      </div>
      {pct !== null && (
        <div className="lp-bar-track">
          <div className="lp-bar-fill" style={{ width: `${pct}%`, background: bc, transition: 'all 0.5s ease-out' }} />
        </div>
      )}
    </div>
  );
}

/* ── NetBalance mini-badge ──────────────────────────────── */
function NetBalance({ gen, con, alerts }) {
  if (gen === undefined || con === undefined) return null;
  const net = gen - con;
  const positive = net >= 0;
  
  // Check if there are critical power alerts contributing to a deficit
  const hasPowerAlert = alerts?.some(a => a.field === 'power_generation' || a.field === 'power_consumption' || a.field === 'generator_load');
  const isCriticalDeficit = !positive && hasPowerAlert;
  
  const color = positive 
    ? 'var(--status-normal)' 
    : isCriticalDeficit 
      ? 'var(--status-critical)' 
      : 'var(--status-warning)';

  return (
    <div className="lp-metric-block">
      <div className="lp-metric-row">
        <span className="lp-metric-label">NET BALANCE</span>
        <span className="lp-metric-value" style={{ color }}>
          {positive ? '+' : ''}{net.toFixed(1)}
          <span className="lp-metric-unit"> kW</span>
        </span>
      </div>
      <div className="lp-net-badge" style={{ borderColor: color, color }}>
        {positive ? '▲ SURPLUS' : '▼ DEFICIT'}
      </div>
    </div>
  );
}

/* ── Section Heading ────────────────────────────────────── */
function Section({ title, children }) {
  return (
    <div className="lp-section">
      <div className="lp-section-title">{title}</div>
      <div className="lp-section-body">{children}</div>
    </div>
  );
}

/* ── Main Export ────────────────────────────────────────── */
export default function LeftPanel({ data, alerts }) {
  const d = data || {};

  return (
    <div className="lp-root">

      <Section title="Station Status">
        <MetricBlock field="energy"           value={d.energy}           alerts={alerts} />
        <MetricBlock field="battery_soc"      value={d.battery_soc}      alerts={alerts} />
        <MetricBlock field="fuel_level"       value={d.fuel_level}       alerts={alerts} />
        <MetricBlock field="generator_health" value={d.generator_health} alerts={alerts} />
      </Section>

      <Section title="Power">
        <MetricBlock field="power_generation"  value={d.power_generation}  alerts={alerts} />
        <MetricBlock field="power_consumption" value={d.power_consumption} alerts={alerts} />
        <MetricBlock field="generator_load"    value={d.generator_load}    alerts={alerts} />
        <NetBalance gen={d.power_generation} con={d.power_consumption} alerts={alerts} />
      </Section>

      <Section title="Environment">
        <MetricBlock field="equipment_temperature" value={d.equipment_temperature} alerts={alerts} />
        <MetricBlock field="heating"               value={d.heating}               alerts={alerts} />
        <MetricBlock field="vibration"             value={d.vibration}             alerts={alerts} />
      </Section>

      <Section title="Infrastructure">
        <MetricBlock field="pump_status" value={d.pump_status} alerts={alerts} />
        <MetricBlock field="runtime"     value={d.runtime}     alerts={alerts} />
      </Section>

    </div>
  );
}
