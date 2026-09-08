/**
 * MAITRI Station Room Configuration
 * Maps physical station areas to telemetry fields from the Python simulator.
 * The digital twin uses this to determine which data to show per room.
 */

export const STATION_CONFIG = {
  id: 'MAITRI',
  name: 'MAITRI',
  fullName: 'Maitri Indian Antarctic Research Station',
  location: 'Schirmacher Oasis, Antarctica',
  coordinates: { lat: '70°45′52″S', lon: '11°44′03″E' },
  elevation: '130m ASL',
};

export const STATION_ROOMS = [
  {
    id: 'generator',
    name: 'Generator Room',
    shortName: 'Generator',
    category: 'power',
    icon: '⚡',
    description: 'Primary power generation — diesel generators and fuel systems',
    telemetryFields: [
      'generator_load',
      'power_generation',
      'generator_health',
      'fuel_level',
      'runtime',
      'equipment_temperature',
      'vibration',
    ],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.generator_load > 90) return 'critical';
      if (data.vibration > 7) return 'critical';
      if (data.generator_health < 80) return 'warning';
      if (data.generator_load > 80) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'power',
    name: 'Power Room',
    shortName: 'Power',
    category: 'energy',
    icon: '🔋',
    description: 'Energy distribution, battery storage and consumption monitoring',
    telemetryFields: ['energy', 'power_generation', 'power_consumption', 'battery_soc'],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.power_consumption > 100) return 'critical';
      if (data.battery_soc < 20) return 'critical';
      if (data.battery_soc < 40) return 'warning';
      if (data.power_consumption > 80) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'pump',
    name: 'Pump Room',
    shortName: 'Pump',
    category: 'lifesupport',
    icon: '💧',
    description: 'Water treatment and coolant circulation pump systems',
    telemetryFields: ['pump_status'],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.pump_status === 0) return 'critical';
      return 'normal';
    },
  },
  {
    id: 'hvac',
    name: 'Heating / HVAC',
    shortName: 'HVAC',
    category: 'environment',
    icon: '🌡️',
    description: 'Habitat heating and climate control systems',
    telemetryFields: ['heating', 'equipment_temperature'],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.heating > 65) return 'critical';
      if (data.equipment_temperature > 60) return 'warning';
      if (data.heating > 40) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'control',
    name: 'Control Room',
    shortName: 'Control',
    category: 'operations',
    icon: '🖥️',
    description: 'Station command and monitoring center — all systems overview',
    telemetryFields: [
      'energy',
      'battery_soc',
      'fuel_level',
      'generator_health',
      'power_generation',
      'power_consumption',
    ],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      return 'normal';
    },
  },
  {
    id: 'laboratory',
    name: 'Laboratory',
    shortName: 'Lab',
    category: 'science',
    icon: '🔬',
    description: 'Scientific research and analysis facilities',
    telemetryFields: ['equipment_temperature'],
    statusLogic: (data) => 'normal',
  },
  {
    id: 'living',
    name: 'Living Quarters',
    shortName: 'Living',
    category: 'habitat',
    icon: '🏠',
    description: 'Crew accommodation and rest areas',
    telemetryFields: ['heating', 'equipment_temperature'],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.heating > 65) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'storage',
    name: 'Storage',
    shortName: 'Storage',
    category: 'logistics',
    icon: '📦',
    description: 'Equipment and supplies storage — fuel drums and provisions',
    telemetryFields: ['fuel_level'],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.fuel_level < 20) return 'critical';
      if (data.fuel_level < 40) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'utility',
    name: 'Utility Building',
    shortName: 'Utility',
    category: 'support',
    icon: '🔧',
    description: 'Workshops, maintenance and support systems',
    telemetryFields: ['equipment_temperature', 'vibration'],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.vibration > 7) return 'warning';
      return 'normal';
    },
  },
];

export const TELEMETRY_LABELS = {
  energy: { label: 'Energy', unit: 'kWh', precision: 2, max: 1000 },
  generator_load: { label: 'Generator Load', unit: '%', precision: 2, max: 100 },
  power_generation: { label: 'Power Generation', unit: 'kW', precision: 2, max: 120 },
  power_consumption: { label: 'Power Consumption', unit: 'kW', precision: 2, max: 140 },
  fuel_level: { label: 'Fuel Level', unit: '%', precision: 2, max: 100 },
  battery_soc: { label: 'Battery SOC', unit: '%', precision: 2, max: 100 },
  heating: { label: 'Heating Output', unit: 'kW', precision: 2, max: 100 },
  generator_health: { label: 'Generator Health', unit: '%', precision: 2, max: 100 },
  pump_status: { label: 'Pump Status', unit: '', precision: 0, isBool: true },
  equipment_temperature: { label: 'Equipment Temp', unit: '°C', precision: 2, max: 80 },
  vibration: { label: 'Vibration', unit: 'mm/s', precision: 2, max: 12 },
  runtime: { label: 'Runtime', unit: 'hrs', precision: 0, max: 99999 },
  timestamp: { label: 'Last Updated', unit: '', isTimestamp: true },
};

export const ALERT_RULES = [
  {
    id: 'gen_overload',
    field: 'generator_load',
    condition: (v) => v > 90,
    severity: 'critical',
    message: 'HIGH GENERATOR LOAD',
    description: (v) => `Generator load at ${v}% — exceeds 90% threshold`,
    roomId: 'generator',
  },
  {
    id: 'low_gen',
    field: 'power_generation',
    condition: (v) => v < 40,
    severity: 'critical',
    message: 'LOW POWER GENERATION',
    description: (v) => `Generation at ${v} kW — below 40 kW minimum`,
    roomId: 'generator',
  },
  {
    id: 'high_consumption',
    field: 'power_consumption',
    condition: (v) => v > 100,
    severity: 'warning',
    message: 'HIGH POWER CONSUMPTION',
    description: (v) => `Consumption at ${v} kW — exceeds 100 kW threshold`,
    roomId: 'power',
  },
  {
    id: 'vibration',
    field: 'vibration',
    condition: (v) => v > 7,
    severity: 'critical',
    message: 'HIGH VIBRATION',
    description: (v) => `Vibration at ${v} mm/s — exceeds 7.0 safe threshold`,
    roomId: 'generator',
  },
  {
    id: 'pump_failure',
    field: 'pump_status',
    condition: (v) => v === 0,
    severity: 'critical',
    message: 'PUMP FAILURE',
    description: () => 'Cooling pump offline — immediate inspection required',
    roomId: 'pump',
  },
  {
    id: 'heating_surge',
    field: 'heating',
    condition: (v) => v > 65,
    severity: 'warning',
    message: 'HEATING SURGE',
    description: (v) => `Heating output at ${v} kW — thermal surge detected`,
    roomId: 'hvac',
  },
  {
    id: 'low_battery',
    field: 'battery_soc',
    condition: (v) => v < 20,
    severity: 'critical',
    message: 'LOW BATTERY RESERVE',
    description: (v) => `Battery SOC at ${v}% — critically low`,
    roomId: 'power',
  },
  {
    id: 'low_fuel',
    field: 'fuel_level',
    condition: (v) => v < 20,
    severity: 'warning',
    message: 'LOW FUEL LEVEL',
    description: (v) => `Fuel at ${v}% — resupply required`,
    roomId: 'storage',
  },
];

export function getRoomById(id) {
  return STATION_ROOMS.find((r) => r.id === id) || null;
}

export function detectAlerts(data) {
  if (!data) return [];
  return ALERT_RULES.filter((rule) => {
    const value = data[rule.field];
    return value !== undefined && rule.condition(value);
  }).map((rule) => ({
    ...rule,
    value: data[rule.field],
    description: rule.description(data[rule.field]),
  }));
}
