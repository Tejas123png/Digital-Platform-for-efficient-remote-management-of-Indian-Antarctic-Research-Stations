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
    name: 'Storage & Resources',
    shortName: 'Storage',
    category: 'logistics',
    icon: '📦',
    description: 'Station supplies — fuel reserves, food provisions, and medicine stock',
    telemetryFields: [
      'fuel_level',
      'generator_fuel_reserve_l',
      'generator_fuel_reserve_days_remaining',
      'resupply_risk',
      'food_stock_kg',
      'food_days_remaining',
      'food_consumption_daily_kg',
      'food_storage_temperature',
      'food_status',
      'medicine_stock_units',
      'medicine_days_remaining',
      'medicine_consumption_daily',
      'medicine_storage_temperature',
      'medicine_status',
    ],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.fuel_level < 20 || data.food_status === 'CRITICAL' || data.medicine_status === 'CRITICAL') return 'critical';
      if (data.fuel_level < 40 || data.food_status === 'LOW' || data.medicine_status === 'LOW') return 'warning';
      return 'normal';
    },
  },
  {
    id: 'canteen',
    name: 'Canteen',
    shortName: 'Canteen',
    category: 'habitat',
    icon: '🍽️',
    description: 'Crew dining area and food storage tracking',
    telemetryFields: ['food_stock_kg', 'food_days_remaining', 'food_consumption_daily_kg', 'food_storage_temperature', 'food_status'],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.food_status === 'CRITICAL') return 'critical';
      if (data.food_status === 'LOW') return 'warning';
      return 'normal';
    },
  },
  {
    id: 'medical',
    name: 'Medical Center',
    shortName: 'Medical',
    category: 'support',
    icon: '⚕️',
    description: 'Station medical facilities, life support, and emergency equipment',
    telemetryFields: ['medicine_stock_units', 'medicine_days_remaining', 'medicine_consumption_daily', 'critical_medicine_items', 'low_medicine_items', 'medicine_storage_temperature', 'medicine_status'],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.medicine_status === 'CRITICAL') return 'critical';
      if (data.medicine_status === 'LOW') return 'warning';
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
  // ── BHARATI SPECIFIC ZONES ──────────────────────────────────────
  {
    id: 'comms',
    name: 'Communication Room',
    shortName: 'Comms',
    category: 'operations',
    icon: '📡',
    description: 'Radome, satellite tracking terminal, VHF/HF transceiver, and antenna mast',
    telemetryFields: [
      'communication_equipment_status',
      'communication_equipment_health',
      'network_status',
      'network_bandwidth',
      'network_latency',
      'packet_loss',
      'signal_strength',
    ],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.communication_equipment_status === 'OFFLINE') return 'critical';
      if (data.communication_equipment_status === 'DEGRADED' || data.network_status === 'SLOW') return 'warning';
      return 'normal';
    },
  },
  {
    id: 'entrance',
    name: 'Main Entrance',
    shortName: 'Entrance',
    category: 'operations',
    icon: '🚪',
    description: 'Central pressurized airlock, decontamination foyer, and weather telemetry',
    telemetryFields: ['temperature', 'wind_speed', 'air_pressure', 'humidity', 'critical_systems_powered'],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.critical_systems_powered === false) return 'critical';
      if (data.wind_speed > 100 || data.temperature < -40) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'dining',
    name: 'Dining / Recreation',
    shortName: 'Dining',
    category: 'habitat',
    icon: '🍽️',
    description: 'Expedition mess hall, galley, and fresh food cold storage tracking',
    telemetryFields: ['food_stock_kg', 'food_days_remaining', 'food_consumption_daily_kg', 'food_storage_temperature', 'food_status'],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.food_status === 'CRITICAL') return 'critical';
      if (data.food_status === 'LOW') return 'warning';
      return 'normal';
    },
  },
  {
    id: 'fuel_storage_building',
    name: 'Fuel Storage (Building)',
    shortName: 'Fuel Bunker',
    category: 'energy',
    icon: '🛢️',
    description: 'Sub-surface primary bulk fuel bunker and distribution pumping station',
    telemetryFields: ['generator_fuel_reserve_l', 'generator_fuel_reserve_days_remaining', 'fuel_level', 'resupply_risk'],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.resupply_risk === 'CRITICAL' || data.fuel_level < 15) return 'critical';
      if (data.resupply_risk === 'ELEVATED' || data.fuel_level < 35) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'fuel_storage_tanks',
    name: 'Fuel Storage (Tanks)',
    shortName: 'Fuel Tanks',
    category: 'energy',
    icon: '⛽',
    description: 'External day fuel storage tanks and active feed lines to generators',
    telemetryFields: ['fuel_level', 'generator_fuel_reserve_l', 'generator_fuel_reserve_days_remaining'],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.fuel_level < 20) return 'critical';
      if (data.fuel_level < 40) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'store',
    name: 'Store',
    shortName: 'Store',
    category: 'logistics',
    icon: '📦',
    description: 'Pharmaceutical cold store, medical equipment, and critical replacement spares',
    telemetryFields: [
      'medicine_stock_units',
      'medicine_days_remaining',
      'medicine_consumption_daily',
      'medicine_storage_temperature',
      'medicine_status',
      'resupply_risk',
    ],
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.medicine_status === 'CRITICAL') return 'critical';
      if (data.medicine_status === 'LOW') return 'warning';
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
  food_stock_kg: { label: 'Food Stock', unit: 'kg', precision: 0, max: 5000 },
  food_days_remaining: { label: 'Food Days Remaining', unit: 'days', precision: 0 },
  food_consumption_daily_kg: { label: 'Food Consumption', unit: 'kg/day', precision: 1 },
  food_storage_temperature: { label: 'Food Storage Temp', unit: '°C', precision: 1 },
  food_status: { label: 'Food Status', unit: '', precision: 0 },
  medicine_stock_units: { label: 'Medicine Stock', unit: 'units', precision: 0 },
  medicine_days_remaining: { label: 'Medicine Days Remaining', unit: 'days', precision: 0 },
  medicine_consumption_daily: { label: 'Medicine Consumption', unit: 'units/day', precision: 1 },
  critical_medicine_items: { label: 'Critical Meds', unit: 'items', precision: 0 },
  low_medicine_items: { label: 'Low Meds', unit: 'items', precision: 0 },
  medicine_storage_temperature: { label: 'Medicine Storage Temp', unit: '°C', precision: 1 },
  medicine_status: { label: 'Medicine Status', unit: '', precision: 0 },
  communication_equipment_status: { label: 'Comms Status', unit: '' },
  communication_equipment_health: { label: 'Comms Health', unit: '%', precision: 1, max: 100 },
  network_status: { label: 'Network Mode', unit: '' },
  network_bandwidth: { label: 'Bandwidth', unit: 'Mbps', precision: 1 },
  network_latency: { label: 'Latency', unit: 'ms', precision: 0 },
  packet_loss: { label: 'Packet Loss', unit: '%', precision: 1 },
  signal_strength: { label: 'Signal Strength', unit: '%', precision: 0 },
  generator_fuel_reserve_l: { label: 'Bulk Fuel Reserve', unit: 'L', precision: 0 },
  generator_fuel_reserve_days_remaining: { label: 'Fuel Reserve Days', unit: 'days', precision: 0 },
  resupply_risk: { label: 'Resupply Risk', unit: '' },
  critical_systems_powered: { label: 'Critical Power', unit: '', isBool: true },
  backup_heater_health: { label: 'Backup Heater Health', unit: '%', precision: 1, max: 100 },
  backup_heater_active: { label: 'Backup Heater', unit: '', isBool: true },
  temperature: { label: 'Ambient Temp', unit: '°C', precision: 1 },
  wind_speed: { label: 'Wind Speed', unit: 'km/h', precision: 1 },
  air_pressure: { label: 'Air Pressure', unit: 'hPa', precision: 1 },
  humidity: { label: 'Humidity', unit: '%', precision: 1 },
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
    id: 'equipment_overheat',
    field: 'equipment_temperature',
    condition: (v) => v > 50,
    severity: 'critical',
    message: 'EQUIPMENT OVERHEAT',
    description: (v) => `Equipment temperature at ${v} °C — exceeds 50 °C safe threshold`,
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
