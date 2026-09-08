import React from 'react';
import StatCard from './StatCard';

export default function EnergyCard({ energy }) {
  const fillPercent = energy !== undefined ? (energy / 1000) * 100 : 50;

  return (
    <StatCard
      id="card-energy"
      title="Energy Level"
      badgeText="Grid Reserve"
      valueId="energy"
      value={energy}
      unit="kWh"
      fillPercent={fillPercent}
      footerLeft="Capacity: 1000 kWh"
      footerRight="Main Bus"
    />
  );
}
