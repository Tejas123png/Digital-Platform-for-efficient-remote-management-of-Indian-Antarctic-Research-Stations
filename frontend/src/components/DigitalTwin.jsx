import React from 'react';
import { STATION_ROOMS } from '../data/stationRooms';

/**
 * ROOM ZONE COORDINATE SYSTEM
 * ─────────────────────────────────────────────────────────────────
 * All coordinates are expressed as PERCENTAGES of the station image's
 * NATURAL dimensions (1392 × 783 px).
 *
 * This guarantees alignment at any render size because the overlay
 * wrapper is always exactly the same size as the rendered image.
 *
 * Measured directly from the generated MAITRI 2D plan image.
 *
 * Image layout guide (% of 1392w × 783h):
 *   White border/frame:     ~1.5% each side
 *   Title text at top:      ~0–8%
 *   Main building interior: x 9–57%, y 37–58%
 *   Generator module (red): x 58–74%, y 8–38%
 *   Utility (green):        x 8–20%, y 63–82%
 *   Fuel tanks:             x 72–83%, y 25–57%
 * ─────────────────────────────────────────────────────────────────
 */

// Set to true to show coloured debug overlays with coordinates
const DEBUG = false;

const ROOM_ZONES = [
  // ── MAIN BUILDING INTERIOR ROOMS ─────────────────────────────
  {
    id: 'control',
    // Control Room — leftmost room inside main building
    left: '27.5%', top: '38.3%', width: '8.0%', height: '18.5%',
  },
  {
    id: 'living',
    // Living Quarters — second room inside main building
    left: '35.6%', top: '38.3%', width: '8.0%', height: '18.5%',
  },
  {
    id: 'laboratory',
    // Laboratory — third room inside main building
    left: '43.6%', top: '38.3%', width: '8.0%', height: '18.5%',
  },
  {
    id: 'canteen',
    // Canteen — between Laboratory and Medical
    left: '51.6%', top: '38.3%', width: '8.2%', height: '18.5%',
  },
  {
    id: 'medical',
    // Medical Center — between Canteen and Storage
    left: '59.8%', top: '38.3%', width: '8.2%', height: '18.5%',
  },
  {
    id: 'storage',
    // Storage — main building rightmost interior room
    left: '68.0%', top: '38.3%', width: '7.5%', height: '18.5%',
  },
  {
    id: 'power',
    // Power / Fuel Storage Tanks area right of main building
    left: '77.0%', top: '38.3%', width: '9.5%', height: '18.5%',
  },

  // ── EXTERNAL EQUIPMENT / CONTAINER MODULES ───────────────────
  {
    id: 'hvac',
    // Heating/HVAC Module — left blue container box above roof
    left: '52.8%', top: '29.8%', width: '7.0%', height: '7.2%',
    isCompact: true,
  },
  {
    id: 'pump',
    // Pump Module — right blue container box above roof
    left: '60.6%', top: '29.8%', width: '7.0%', height: '7.2%',
    isCompact: true,
  },

  // ── OTHER STRUCTURES ─────────────────────────────────────────
  {
    id: 'generator',
    // Generator Room — red building upper right quadrant
    left: '74.0%', top: '7.7%', width: '15.4%', height: '29.6%',
  },
  {
    id: 'utility',
    // Utility Building — green building lower left
    left: '11.1%', top: '62.8%', width: '9.7%', height: '18.6%',
  },
];

export default function DigitalTwin({ stationData, selectedRoom, onRoomSelect, alerts }) {
  const getRoomStatus = (roomId) => {
    const room = STATION_ROOMS.find((r) => r.id === roomId);
    if (!room || !stationData) return 'unknown';
    return room.statusLogic(stationData);
  };

  const getRoomName = (roomId) => {
    const room = STATION_ROOMS.find((r) => r.id === roomId);
    return room?.shortName || roomId;
  };

  const alertRoomIds = new Set(alerts.map((a) => a.roomId));

  return (
    <div className="ps-twin">
      <div className="ps-twin__label">
        MAITRI — SCHIRMACHER OASIS, ANTARCTICA — 70°45′52″S 11°44′03″E
      </div>

      <div className="ps-twin__wrapper">
        <img
          src="/maitri_station.jpg"
          alt="MAITRI Antarctic Research Station — 2D Plan View"
          className="ps-twin__img"
          draggable={false}
        />

        {/* Interactive hotspot overlay — exactly covers image */}
        <div className="ps-twin__overlays" aria-hidden={false}>
          {ROOM_ZONES.map((zone) => {
            const status = getRoomStatus(zone.id);
            const isSelected = selectedRoom === zone.id;
            const hasAlert = alertRoomIds.has(zone.id);
            const zoneStatus = hasAlert ? status : '';
            const compactClass = zone.isCompact ? 'compact' : '';

            return (
              <div
                key={zone.id}
                role="button"
                tabIndex={0}
                aria-label={`Select ${getRoomName(zone.id)}`}
                className={`ps-room-zone ${isSelected ? 'selected' : ''} ${zoneStatus} ${compactClass}`}
                style={{
                  left:   zone.left,
                  top:    zone.top,
                  width:  zone.width,
                  height: zone.height,
                }}
                title={getRoomName(zone.id)}
                onClick={() => onRoomSelect(isSelected ? null : zone.id)}
                onKeyDown={(e) => e.key === 'Enter' && onRoomSelect(isSelected ? null : zone.id)}
              >
                <div className="ps-room-zone__badge">
                  <span className={`ps-room-zone__dot ${status}`} />
                  <span className="ps-room-zone__label">{getRoomName(zone.id)}</span>
                </div>

                {/* Debug overlay — shows zone boundaries and coords */}
                {DEBUG && (
                  <span style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(255,100,0,0.25)',
                    border: '2px solid orange',
                    fontSize: 7,
                    color: 'orange',
                    padding: 1,
                    fontFamily: 'monospace',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    pointerEvents: 'none',
                  }}>
                    <strong>{zone.id}</strong>
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
  );
}
