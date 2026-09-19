import React, { useState, useEffect } from 'react';
import { STATION_ROOMS, detectAlerts } from '../data/stationRooms';
import { API_URL } from '../services/api';

/**
 * BHARATI DIGITAL TWIN — HOTSPOT ZONE CONFIGURATION
 * ─────────────────────────────────────────────────────────────────
 * Calibrated directly to `bharati-map.jpg` (1024 × 626 px).
 * Coordinates are expressed as PERCENTAGES of the background image.
 *
 * Each hotspot mirrors the interactive DigitalTwin pattern:
 * - Green (Nominal) / Amber (Warning) / Red (Critical) status indicators
 * - Click-to-open RoomInfoPanel inspector
 * - Synchronized live telemetry fields from station=BHARATI
 * ─────────────────────────────────────────────────────────────────
 */

// Set to true to display visual debug overlays with bounding boxes and coords
const DEBUG = false;

export const BHARATI_ROOM_ZONES = [
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
    left: '7.5%',
    top: '7.5%',
    width: '12.5%',
    height: '38.0%',
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.communication_equipment_status === 'OFFLINE') return 'critical';
      if (data.communication_equipment_status === 'DEGRADED' || data.network_status === 'SLOW') return 'warning';
      return 'normal';
    },
  },
  {
    id: 'living',
    name: 'Living Quarters',
    shortName: 'Living',
    category: 'habitat',
    icon: '🏠',
    description: 'Crew accommodation, berthing modules, and thermal climate zone',
    telemetryFields: ['heating', 'equipment_temperature', 'backup_heater_health', 'backup_heater_active'],
    left: '23.0%',
    top: '20.0%',
    width: '23.0%',
    height: '21.0%',
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.heating > 65) return 'critical';
      if (data.heating > 45 || data.backup_heater_active) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'laboratory',
    name: 'Laboratories',
    shortName: 'Labs',
    category: 'science',
    icon: '🔬',
    description: 'Atmospheric physics, oceanography, and environmental analysis laboratory',
    telemetryFields: ['equipment_temperature', 'humidity', 'air_pressure', 'temperature', 'wind_speed'],
    left: '52.5%',
    top: '20.5%',
    width: '17.0%',
    height: '21.0%',
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.equipment_temperature > 65 || data.equipment_temperature < 15) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'dining',
    name: 'Dining / Recreation',
    shortName: 'Dining',
    category: 'habitat',
    icon: '🍽️',
    description: 'Expedition mess hall, kitchen, and fresh food cold storage tracking',
    telemetryFields: [
      'food_stock_kg',
      'food_days_remaining',
      'food_consumption_daily_kg',
      'food_storage_temperature',
      'food_status',
    ],
    left: '69.0%',
    top: '23.0%',
    width: '23.0%',
    height: '22.0%',
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.food_status === 'CRITICAL' || data.food_expiry_risk > 1) return 'critical';
      if (data.food_status === 'LOW' || data.food_expiry_risk === 1) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'entrance',
    name: 'Main Entrance',
    shortName: 'Entrance',
    category: 'operations',
    icon: '🚪',
    description: 'Central pressurized airlock, entryway staircase, and weather telemetry',
    telemetryFields: ['temperature', 'wind_speed', 'air_pressure', 'humidity', 'critical_systems_powered'],
    left: '46.0%',
    top: '20.5%',
    width: '7.0%',
    height: '25.0%',
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.critical_systems_powered === false) return 'critical';
      if (data.wind_speed > 100 || data.temperature < -40) return 'warning';
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
    telemetryFields: [
      'generator_fuel_reserve_l',
      'generator_fuel_reserve_days_remaining',
      'fuel_level',
      'resupply_risk',
    ],
    left: '14.0%',
    top: '55.5%',
    width: '11.0%',
    height: '20.5%',
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
    left: '38.5%',
    top: '58.0%',
    width: '14.0%',
    height: '20.0%',
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.fuel_level < 20) return 'critical';
      if (data.fuel_level < 40) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'generator',
    name: 'Generator Room',
    shortName: 'Generator',
    category: 'power',
    icon: '⚡',
    description: 'Main diesel generator sets (3x 100kVA), control panels, and battery bank',
    telemetryFields: [
      'generator_status',
      'generator_load',
      'power_generation',
      'power_consumption',
      'battery_soc',
      'generator_health',
      'vibration',
      'runtime',
    ],
    left: '61.0%',
    top: '60.0%',
    width: '13.5%',
    height: '19.0%',
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.generator_status !== 'RUNNING' || data.generator_load > 90 || data.vibration > 7) return 'critical';
      if (data.generator_load > 80 || data.generator_health < 80 || data.battery_soc < 40) return 'warning';
      return 'normal';
    },
  },
  {
    id: 'store',
    name: 'Store',
    shortName: 'Store',
    category: 'logistics',
    icon: '📦',
    description: 'Pharmaceutical cold store, medical provisions, and technical replacement spares',
    telemetryFields: [
      'medicine_stock_units',
      'medicine_days_remaining',
      'medicine_consumption_daily',
      'medicine_storage_temperature',
      'medicine_status',
      'resupply_risk',
    ],
    left: '79.0%',
    top: '63.0%',
    width: '11.0%',
    height: '17.0%',
    statusLogic: (data) => {
      if (!data) return 'unknown';
      if (data.medicine_status === 'CRITICAL' || data.medicine_expiry_risk > 1) return 'critical';
      if (data.medicine_status === 'LOW' || data.medicine_expiry_risk === 1) return 'warning';
      return 'normal';
    },
  },
];

export default function BharatiDigitalTwin({
  stationData: propStationData,
  selectedRoom,
  onRoomSelect,
  alerts: propAlerts = [],
}) {
  const [bharatiData, setBharatiData] = useState(null);
  const [bharatiAlerts, setBharatiAlerts] = useState([]);

  // Fetch station=BHARATI from the API backend
  useEffect(() => {
    let isMounted = true;

    const fetchBharati = async () => {
      try {
        const res = await fetch(`${API_URL}/api/data?station=BHARATI`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          setBharatiData(data);
          setBharatiAlerts(detectAlerts(data));
        }
      } catch (err) {
        // Retain previous state if network poll fails
      }
    };

    fetchBharati();
    const interval = setInterval(fetchBharati, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Active data: prioritize prop if for BHARATI, otherwise internal fetched data
  const currentData =
    propStationData && propStationData.station_id === 'BHARATI'
      ? propStationData
      : (bharatiData || propStationData);

  const activeAlerts =
    propAlerts && propAlerts.length > 0 && propStationData?.station_id === 'BHARATI'
      ? propAlerts
      : bharatiAlerts;

  const alertRoomIds = new Set(activeAlerts.map((a) => a.roomId));

  const getRoomStatus = (zone) => {
    if (!currentData) return 'unknown';
    if (typeof zone.statusLogic === 'function') {
      return zone.statusLogic(currentData);
    }
    const room = STATION_ROOMS.find((r) => r.id === zone.id);
    if (!room) return 'unknown';
    return room.statusLogic(currentData);
  };

  const getRoomName = (zone) => {
    return zone.shortName || zone.name || zone.id;
  };

  return (
    <div className="ps-twin">
      <div className="ps-twin__label">
        BHARATI — LARSEMANN HILLS, ANTARCTICA — 69°24′29″S 76°11′14″E
      </div>

      <div
        className="ps-twin__wrapper ps-twin__wrapper--bharati"
        style={{
          overflow: 'hidden',
          aspectRatio: '1024 / 472',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1024 / 547',
          }}
        >
          <img
            src="/bharati-map.jpg"
            alt="BHARATI Antarctic Research Station — 3D Axonometric Map"
            className="ps-twin__img"
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'cover',
              objectPosition: 'top',
            }}
          />

          {/* Interactive hotspot overlay — covers the image 1:1 */}
          <div className="ps-twin__overlays" aria-hidden={false}>
            {BHARATI_ROOM_ZONES.map((zone) => {
              const status = getRoomStatus(zone);
              const isSelected = selectedRoom === zone.id;
              const hasAlert = alertRoomIds.has(zone.id);
              const zoneStatus = hasAlert ? status : '';
              const compactClass = zone.isCompact ? 'compact' : '';

              return (
                <div
                  key={zone.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${getRoomName(zone)}`}
                  className={`ps-room-zone ${isSelected ? 'selected' : ''} ${zoneStatus} ${compactClass}`}
                  style={{
                    left: zone.left,
                    top: zone.top,
                    width: zone.width,
                    height: zone.height,
                  }}
                  title={zone.name}
                  onClick={() => onRoomSelect(isSelected ? null : zone.id)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && onRoomSelect(isSelected ? null : zone.id)
                  }
                >
                  <div className="ps-room-zone__badge">
                    <span className={`ps-room-zone__dot ${status}`} />
                    <span className="ps-room-zone__label">{getRoomName(zone)}</span>
                  </div>

                  {/* Debug overlay — shows zone boundaries and coords when DEBUG=true */}
                  {DEBUG && (
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0, 200, 255, 0.25)',
                        border: '2px solid cyan',
                        fontSize: 8,
                        color: 'cyan',
                        padding: 2,
                        fontFamily: 'monospace',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        pointerEvents: 'none',
                      }}
                    >
                      <strong>{zone.name}</strong>
                      <span>L:{zone.left} T:{zone.top}</span>
                      <span>W:{zone.width} H:{zone.height}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
