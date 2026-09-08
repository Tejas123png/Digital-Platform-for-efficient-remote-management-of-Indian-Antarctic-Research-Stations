import React from 'react';
import StatCard from './StatCard';

export default function FuelCard({ fuelLevel }) {
  return (
    <StatCard
      id="card-fuel-level"
      title="Fuel Level"
      badgeText="Jet-A Arctic"
      valueId="fuel-level"
      value={fuelLevel !== undefined ? `${fuelLevel}%` : undefined}
      fillPercent={fuelLevel ?? 75}
      footerLeft="Sub-surface Bunker 2"
      footerRight="Burn Rate: Auto"
    />
  );
}
