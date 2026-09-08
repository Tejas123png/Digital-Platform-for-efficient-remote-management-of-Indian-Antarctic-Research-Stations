import React from 'react';
import StatCard from './StatCard';

export default function GeneratorCard({ generatorLoad }) {
  const isHigh = generatorLoad > 85;
  const status = isHigh ? "High Load" : "Nominal";
  const statusColor = isHigh ? "#ef4444" : "var(--accent-cyan)";

  return (
    <StatCard
      id="card-generator-load"
      title="Generator Load"
      badgeText="Turbine Alpha"
      valueId="generator-load"
      value={generatorLoad !== undefined ? `${generatorLoad}%` : undefined}
      fillPercent={generatorLoad ?? 60}
      footerLeft="Operating range: 20% – 90%"
      footerRight={status}
      footerRightStyle={{ color: statusColor }}
    />
  );
}
