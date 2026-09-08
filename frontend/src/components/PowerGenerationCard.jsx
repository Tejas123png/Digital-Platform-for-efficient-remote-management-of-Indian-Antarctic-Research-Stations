import React from 'react';
import StatCard from './StatCard';

export default function PowerGenerationCard({ powerGeneration }) {
  const fillPercent = powerGeneration !== undefined ? (powerGeneration / 120) * 100 : 65;

  return (
    <StatCard
      id="card-power-generation"
      title="Power Generation"
      badgeText="Output"
      badgeClass="green-badge"
      valueId="power-generation"
      value={powerGeneration}
      unit="kW"
      fillPercent={fillPercent}
      fillClass="green-fill"
      footerLeft="Thermal & Micro-Gen"
      footerRight="Active"
    />
  );
}
