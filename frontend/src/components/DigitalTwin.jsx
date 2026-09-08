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
  // ── MAIN BUILDING INTERIOR ───────────────────────────────────
  // 6 rooms span x 9–57%, y 37–58%  (wall thickness included in rooms)

  {
    id: 'control',
    // Control Room — leftmost room in main building
    // Measured: inner x ≈ 285–445px, inner y ≈ 300–445px
    left: '20.4%', top: '38.3%', width: '11.4%', height: '18.5%',
  },
  {
    id: 'living',
    // Living Quarters — second room
    // Measured: inner x ≈ 450–595px, inner y ≈ 300–445px
    left: '32.3%', top: '38.3%', width: '10.3%', height: '18.5%',
  },
  {
    id: 'laboratory',
    // Laboratory — third room (largest single room label visible)
    // Measured: inner x ≈ 600–730px, inner y ≈ 300–445px
    left: '43.1%', top: '38.3%', width: '9.3%', height: '18.5%',
  },
  {
    id: 'hvac',
    // Canteen area — mapped to HVAC (no separate HVAC room labeled)
    // Measured: inner x ≈ 735–835px, inner y ≈ 300–445px
    left: '52.8%', top: '38.3%', width: '7.2%', height: '18.5%',
  },
  {
    id: 'pump',
    // Medical area — mapped to Pump system (mechanical support room)
    // Measured: inner x ≈ 840–940px, inner y ≈ 300–445px
    left: '60.3%', top: '38.3%', width: '7.2%', height: '18.5%',
  },
  {
    id: 'storage',
    // Storage — rightmost room in main building
    // Measured: inner x ≈ 945–1075px, inner y ≈ 300–445px
    left: '67.9%', top: '38.3%', width: '9.3%', height: '18.5%',
  },

  // ── RIGHT WING — POWER + GENERATOR ──────────────────────────
  {
    id: 'power',
    // Power/connection section — right end of main building, links to generator
    // Measured: inner x ≈ 1080–1155px, y ≈ 300–445px
    left: '77.6%', top: '38.3%', width: '5.5%', height: '18.5%',
  },
  {
    id: 'generator',
    // Generator Room — red building upper right quadrant
    // Measured: outer x ≈ 1030–1245px, outer y ≈ 60–295px
    left: '74.0%', top: '7.7%', width: '15.4%', height: '29.6%',
  },

  // ── SEPARATE STRUCTURES ──────────────────────────────────────
  {
    id: 'utility',
    // Utility Building — green building, lower left
    // Measured: outer x ≈ 155–290px, outer y ≈ 492–638px
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

      {/*
        ┌── ps-twin__wrapper (position: relative, inline-block) ──┐
        │  ┌── img (width: 100%, height: auto) ──────────────────┐ │
        │  │  Station image fills wrapper width exactly           │ │
        │  └──────────────────────────────────────────────────────┘ │
        │  ┌── ps-twin__overlays (position: absolute, inset: 0) ─┐ │
        │  │  Covers EXACTLY the same pixels as the image         │ │
        │  └──────────────────────────────────────────────────────┘ │
        └─────────────────────────────────────────────────────────┘

        The wrapper is inline-block so it hugs the image tightly.
        The overlays are absolute over the wrapper = over the image.
        Zone % coords are relative to the wrapper = image dimensions.
        Works at any size / on any screen.
      */}
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

            return (
              <div
                key={zone.id}
                role="button"
                tabIndex={0}
                aria-label={`Select ${getRoomName(zone.id)}`}
                className={`ps-room-zone ${isSelected ? 'selected' : ''} ${zoneStatus}`}
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
                <span className="ps-room-zone__label">{getRoomName(zone.id)}</span>
                <span className={`ps-room-zone__dot ${status}`} />

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
