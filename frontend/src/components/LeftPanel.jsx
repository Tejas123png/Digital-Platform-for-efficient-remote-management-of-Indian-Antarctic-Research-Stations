import React from 'react';
import { TELEMETRY_LABELS } from '../data/stationRooms';

/* ── Helpers ─────────────────────────────────────────────── */
function barColor(field, value) {
  if (value === undefined || value === null) return 'var(--accent-blue)';
  const map = {
    generator_load:    value > 90 ? 'var(--status-critical)' : value > 80 ? 'var(--status-warning)' : 'var(--accent-blue)',
    generator_health:  value < 80 ? 'var(--status-warning)' : 'var(--status-normal)',
    battery_soc:       value < 20 ? 'var(--status-critical)' : value < 40 ? 'var(--status-warning)' : 'var(--status-normal)',
    fuel_level:        value < 20 ? 'var(--status-critical)' : value < 40 ? 'var(--status-warning)' : 'var(--accent-blue)',
    power_consumption: value > 100 ? 'var(--status-critical)' : value > 80 ? 'var(--status-warning)' : 'var(--accent-blue)',
    heating:           value > 65  ? 'var(--status-critical)' : value > 40 ? 'var(--status-warning)' : 'var(--accent-blue)',
    vibration:         value > 7   ? 'var(--status-critical)' : value > 5  ? 'var(--status-warning)' : 'var(--status-normal)',
  };
  return map[field] ?? 'var(--accent-blue)';
}

function valueColor(field, value) {
  if (value === undefined || value === null) return 'var(--text-secondary)';
  const map = {
    generator_load:    value > 90 ? 'var(--status-critical)' : value > 80 ? 'var(--status-warning)' : 'var(--text-primary)',
    generator_health:  value < 80 ? 'var(--status-warning)' : 'var(--status-normal)',
    battery_soc:       value < 20 ? 'var(--status-critical)' : value < 40 ? 'var(--status-warning)' : 'var(--status-normal)',
    fuel_level:        value < 20 ? 'var(--status-critical)' : value < 40 ? 'var(--status-warning)' : 'var(--text-primary)',
    power_consumption: value > 100 ? 'var(--status-critical)' : value > 80 ? 'var(--status-warning)' : 'var(--text-primary)',
    vibration:         value > 7   ? 'var(--status-critical)' : value > 5  ? 'var(--status-warning)' : 'var(--text-primary)',
  };
  return map[field] ?? 'var(--text-primary)';
}

/* ── MetricBlock — full-width card with big value + bar ─── */
function MetricBlock({ field, value }) {
  const meta = TELEMETRY_LABELS[field] || { label: field, unit: '', precision: 2 };

  if (meta.isBool) {
    const isOn = value === 1;
    return (
      <div className="lp-metric-block">
        <div className="lp-metric-label">{meta.label.toUpperCase()}</div>
        <div className={`ps-pump-badge ${isOn ? 'operational' : 'fault'}`} style={{ fontSize: 13, padding: '4px 10px' }}>
          <span className="ps-status-dot" />
          {isOn ? 'OPERATIONAL' : 'FAULT — OFFLINE'}
        </div>
      </div>
    );
  }

  const display = value !== undefined && value !== null
    ? (typeof value === 'number' ? value.toFixed(meta.precision ?? 2) : value)
    : '—';

  const pct = meta.max && value !== undefined
    ? Math.min(100, Math.max(0, (value / meta.max) * 100))
    : null;

  const bc = barColor(field, value);
  const vc = valueColor(field, value);

  return (
    <div className="lp-metric-block">
      <div className="lp-metric-row">
        <span className="lp-metric-label">{meta.label.toUpperCase()}</span>
        <span className="lp-metric-value" style={{ color: vc }}>
          {display}
          {meta.unit && <span className="lp-metric-unit">{meta.unit}</span>}
        </span>
      </div>
      {pct !== null && (
        <div className="lp-bar-track">
          <div className="lp-bar-fill" style={{ width: `${pct}%`, background: bc }} />
        </div>
      )}
    </div>
  );
}

/* ── NetBalance mini-badge ──────────────────────────────── */
function NetBalance({ gen, con }) {
  if (gen === undefined || con === undefined) return null;
  const net = gen - con;
  const positive = net >= 0;
  return (
    <div className="lp-metric-block">
      <div className="lp-metric-row">
        <span className="lp-metric-label">NET BALANCE</span>
        <span className="lp-metric-value" style={{ color: positive ? 'var(--status-normal)' : 'var(--status-warning)' }}>
          {positive ? '+' : ''}{net.toFixed(1)}
          <span className="lp-metric-unit"> kW</span>
        </span>
      </div>
      <div className="lp-net-badge" style={{ borderColor: positive ? 'var(--status-normal)' : 'var(--status-warning)', color: positive ? 'var(--status-normal)' : 'var(--status-warning)' }}>
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
export default function LeftPanel({ data }) {
  const d = data || {};

  return (
    <div className="lp-root">

      <Section title="Station Status">
        <MetricBlock field="energy"           value={d.energy} />
        <MetricBlock field="battery_soc"      value={d.battery_soc} />
        <MetricBlock field="fuel_level"       value={d.fuel_level} />
        <MetricBlock field="generator_health" value={d.generator_health} />
      </Section>

      <Section title="Power">
        <MetricBlock field="power_generation"  value={d.power_generation} />
        <MetricBlock field="power_consumption" value={d.power_consumption} />
        <MetricBlock field="generator_load"    value={d.generator_load} />
        <NetBalance gen={d.power_generation} con={d.power_consumption} />
      </Section>

      <Section title="Environment">
        <MetricBlock field="equipment_temperature" value={d.equipment_temperature} />
        <MetricBlock field="heating"               value={d.heating} />
        <MetricBlock field="vibration"             value={d.vibration} />
      </Section>

      <Section title="Infrastructure">
        <MetricBlock field="pump_status" value={d.pump_status} />
        <MetricBlock field="runtime"     value={d.runtime} />
      </Section>

    </div>
  );
}
