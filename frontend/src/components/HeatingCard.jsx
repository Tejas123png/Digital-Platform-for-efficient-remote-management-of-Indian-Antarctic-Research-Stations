import React from 'react';
import StatCard from './StatCard';

export default function HeatingCard({ heating }) {
  const fillPercent = heating !== undefined ? (heating / 100) * 100 : 30;

  return (
    <StatCard
      id="card-heating"
      title="Heating System"
      badgeText="Habitat Climate"
      valueId="heating"
      value={heating}
      unit="kW"
      fillPercent={fillPercent}
      fillClass="orange-fill"
      footerLeft="Thermal Compensator"
      footerRight="Target: +18°C"
    />
  );
}
