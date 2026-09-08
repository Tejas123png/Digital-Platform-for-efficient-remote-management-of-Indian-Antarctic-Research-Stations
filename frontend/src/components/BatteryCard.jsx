import React from 'react';
import StatCard from './StatCard';

export default function BatteryCard({ batterySoc }) {
  const isLow = batterySoc < 30;
  const status = isLow ? "Low Reserve" : "Optimal";
  const statusColor = isLow ? "#f87171" : "var(--accent-cyan)";

  return (
    <StatCard
      id="card-battery-soc"
      title="Battery State of Charge"
      badgeText="Li-FePO4 Bank"
      valueId="battery-soc"
      value={batterySoc !== undefined ? `${batterySoc}%` : undefined}
      fillPercent={batterySoc ?? 90}
      fillClass="cyan-fill"
      footerLeft="Cold-Spec Thermal Pack"
      footerRight={status}
      footerRightStyle={{ color: statusColor }}
    />
  );
}
