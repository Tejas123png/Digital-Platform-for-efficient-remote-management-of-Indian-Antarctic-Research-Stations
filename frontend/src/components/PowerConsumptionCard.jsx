import React from 'react';
import StatCard from './StatCard';

export default function PowerConsumptionCard({ powerConsumption, powerGeneration }) {
  const fillPercent = powerConsumption !== undefined ? (powerConsumption / 140) * 100 : 55;

  let balanceText = "Net: -- kW";
  let balanceColor = "var(--accent-cyan)";
  if (powerGeneration !== undefined && powerConsumption !== undefined) {
    const diff = (powerGeneration - powerConsumption).toFixed(1);
    balanceText = diff >= 0 ? `Net: +${diff} kW (Surplus)` : `Net: ${diff} kW (Deficit)`;
    balanceColor = diff >= 0 ? "#34d399" : "#fbbf24";
  }

  return (
    <StatCard
      id="card-power-consumption"
      title="Power Consumption"
      badgeText="Outpost Load"
      badgeClass="orange-badge"
      valueId="power-consumption"
      value={powerConsumption}
      unit="kW"
      fillPercent={fillPercent}
      fillClass="orange-fill"
      footerLeft="Life Support & Labs"
      footerRight={balanceText}
      footerRightStyle={{ color: balanceColor }}
    />
  );
}
