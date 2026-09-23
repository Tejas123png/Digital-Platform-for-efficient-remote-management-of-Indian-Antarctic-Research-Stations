import React, { useState, useEffect, useCallback, useRef } from 'react';

import Header        from './components/Header';
import LeftPanel     from './components/LeftPanel';
import DigitalTwin        from './components/DigitalTwin';
import BharatiDigitalTwin from './components/BharatiDigitalTwin';
import RoomInfoPanel from './components/RoomInfoPanel';
import AlertPanel    from './components/AlertPanel';
import WeatherPanel  from './components/WeatherPanel';
import ChartsSection from './components/ChartsSection';
import LogsView      from './components/LogsView';

import { fetchStationData, fetchAnomalyEvents } from './services/api';
import { detectAlerts }     from './data/stationRooms';

const POLL_INTERVAL    = 2000;   // ms — matches simulator 2s interval
const MAX_HISTORY      = 30;     // rolling buffer size
const MAX_LOGS         = 100;    // max log entries to keep

function buildLogEntry(data, prevData) {
  const time = data.timestamp?.split(' ')[1]?.slice(0, 8) ?? '--:--:--';
  const entries = [];

  if (!prevData) {
    entries.push({ time, level: 'info', subsystem: 'CORE', message: 'Telemetry stream established' });
    return entries;
  }

  const genLoadDiff = Math.abs((data.generator_load ?? 0) - (prevData.generator_load ?? 0));
  if (genLoadDiff > 5) {
    const dir = data.generator_load > prevData.generator_load ? '▲' : '▼';
    entries.push({ time, level: 'info', subsystem: 'GEN', message: `Load ${dir} ${data.generator_load?.toFixed(1)}%` });
  }

  if (data.pump_status === 0 && prevData.pump_status !== 0) {
    entries.push({ time, level: 'critical', subsystem: 'PUMP', message: 'Cooling pump OFFLINE' });
  }
  if (data.pump_status === 1 && prevData.pump_status !== 1) {
    entries.push({ time, level: 'info', subsystem: 'PUMP', message: 'Cooling pump restored' });
  }

  if ((data.vibration ?? 0) > 7 && (prevData.vibration ?? 0) <= 7) {
    entries.push({ time, level: 'critical', subsystem: 'MECH', message: `High vibration: ${data.vibration?.toFixed(2)} mm/s` });
  }

  if ((data.battery_soc ?? 100) < 20 && (prevData.battery_soc ?? 100) >= 20) {
    entries.push({ time, level: 'warning', subsystem: 'BATT', message: `Low battery SOC: ${data.battery_soc?.toFixed(1)}%` });
  }

  if ((data.fuel_level ?? 100) < 20 && (prevData.fuel_level ?? 100) >= 20) {
    entries.push({ time, level: 'warning', subsystem: 'FUEL', message: `Fuel critical: ${data.fuel_level?.toFixed(1)}%` });
  }

  if (entries.length === 0) {
    entries.push({ time, level: 'info', subsystem: 'CORE', message: `Telemetry OK — energy ${data.energy?.toFixed(2)} kWh` });
  }

  return entries;
}

/* ── Logistics helpers ─────────────────────────────────────── */
function LogisticsStatus({ status }) {
  if (!status) return <span className="ps-logistics-status" style={{ color: 'var(--text-muted)' }}>● --</span>;
  const s = status.toUpperCase();
  let color = 'var(--status-normal)';
  let label = 'OK';
  if (s === 'CRITICAL') { color = 'var(--status-critical)'; label = 'CRIT'; }
  else if (s === 'WARNING' || s === 'ELEVATED' || s === 'LOW') { color = 'var(--status-warning)'; label = 'WARN'; }
  else if (s === 'NORMAL') { label = 'OK'; }
  else { label = s; }
  return <span className="ps-logistics-status" style={{ color }}>● {label}</span>;
}

function LogisticsRow({ label, qty, qtyUnit, days, status }) {
  const qtyStr = qty != null ? (typeof qty === 'number' ? Math.round(qty).toLocaleString() : qty) : '--';
  const daysStr = days != null ? `${days}d` : '--';
  return (
    <div className="ps-logistics-row">
      <span className="ps-logistics-label">{label}</span>
      <span className="ps-logistics-qty">{qtyStr} <span className="ps-logistics-unit">{qtyUnit}</span></span>
      <span className="ps-logistics-days">{daysStr}</span>
      <LogisticsStatus status={status} />
    </div>
  );
}

export default function App() {
  const [stationData,       setStationData]       = useState(null);
  const [history,           setHistory]           = useState({ MAITRI: [], BHARATI: [] });
  const [logs,              setLogs]              = useState({ MAITRI: [], BHARATI: [] });
  const [alerts,            setAlerts]            = useState([]);
  const [anomalyEvents,     setAnomalyEvents]     = useState({ MAITRI: [], BHARATI: [] });
  const [connectionStatus,  setConnectionStatus]  = useState('connecting');
  const [selectedRoom,      setSelectedRoom]      = useState(null);
  const [activeStation,     setActiveStation]     = useState('MAITRI');

  const prevDataRef = useRef({ MAITRI: null, BHARATI: null });

  const poll = useCallback(async () => {
    try {
      const data = await fetchStationData(activeStation);
      if (!data) return;

      setStationData(data);
      setConnectionStatus('connected');

      // Update rolling history for the active station
      setHistory((h) => {
        const currentHist = h[activeStation] || [];
        const next = [...currentHist, data];
        return {
          ...h,
          [activeStation]: next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
        };
      });

      // Generate log entries using station-specific previous data
      const prevData = prevDataRef.current[activeStation];
      const newEntries = buildLogEntry(data, prevData);
      setLogs((l) => {
        const currentLogs = l[activeStation] || [];
        const next = [...currentLogs, ...newEntries];
        return {
          ...l,
          [activeStation]: next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next
        };
      });

      // Detect alerts
      setAlerts(detectAlerts(data));

      // Poll anomaly events for alert history
      try {
        const events = await fetchAnomalyEvents(activeStation);
        setAnomalyEvents((prev) => ({ ...prev, [activeStation]: events }));
      } catch (_) { /* non-critical */ }

      prevDataRef.current[activeStation] = data;
    } catch (err) {
      setConnectionStatus('disconnected');
    }
  }, [activeStation]);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [poll]);

  const handleStationChange = useCallback((station) => {
    setActiveStation(station);
    setSelectedRoom(null);
    // Removed setHistory([]) and setLogs([]) so graphs and logs persist per station
  }, []);

  const handleRoomSelect = useCallback((roomId) => {
    setSelectedRoom(roomId);
  }, []);

  const handleAlertClick = useCallback((roomId) => {
    setSelectedRoom(roomId);
  }, []);

  const handleRoomClose = useCallback(() => {
    setSelectedRoom(null);
  }, []);

  return (
    <div className="ps-app">
      <Header
        connectionStatus={connectionStatus}
        lastUpdated={stationData?.timestamp}
        activeStation={activeStation}
        onStationChange={handleStationChange}
        networkBandwidth={stationData?.network_bandwidth}
        networkStatus={stationData?.network_status}
      />

      <div className="ps-layout">
        {/* LEFT PANEL */}
        <div className="ps-left">
          <LeftPanel data={stationData} alerts={alerts} />
          <WeatherPanel station={activeStation} />
        </div>

        {/* CENTER — Digital Twin */}
        <div className="ps-center">
          {activeStation === 'BHARATI' ? (
            <BharatiDigitalTwin
              stationData={stationData}
              selectedRoom={selectedRoom}
              onRoomSelect={handleRoomSelect}
              alerts={alerts}
            />
          ) : (
            <DigitalTwin
              stationData={stationData}
              selectedRoom={selectedRoom}
              onRoomSelect={handleRoomSelect}
              alerts={alerts}
            />
          )}
        </div>

        {/* RIGHT PANEL — Alerts + Logistics */}
        <div className="ps-right">
          <AlertPanel station={activeStation} alerts={alerts} anomalyEvents={anomalyEvents[activeStation] || []} onAlertClick={handleAlertClick} />
          
          <div className="ps-right-section ps-logistics-section">
            <div className="ps-right-section__title">Logistics</div>
            <div className="ps-logistics">
              <LogisticsRow
                label="FOOD"
                qty={stationData?.food_stock_kg}
                qtyUnit="kg"
                days={stationData?.food_days_remaining}
                status={stationData?.food_status}
              />
              <LogisticsRow
                label="MEDICINE"
                qty={stationData?.medicine_stock_units}
                qtyUnit="u"
                days={stationData?.medicine_days_remaining}
                status={stationData?.medicine_status}
              />
              <LogisticsRow
                label="FUEL"
                qty={stationData?.generator_fuel_reserve_l}
                qtyUnit="L"
                days={stationData?.generator_fuel_reserve_days_remaining}
                status={stationData?.fuel_level != null && stationData.fuel_level < 20 ? 'WARNING' : 'NORMAL'}
              />
              <div className="ps-logistics-row" style={{ marginTop: '2px', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
                <span className="ps-logistics-label">RESUPPLY</span>
                <span style={{ flex: 1 }} />
                <LogisticsStatus status={stationData?.resupply_risk} />
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM — Charts + Logs */}
        <div className="ps-bottom">
          <ChartsSection history={history[activeStation] || []} />

          <div className="ps-bottom-section">
            <div className="ps-bottom-section__title">Event Log</div>
            <LogsView logs={logs[activeStation] || []} />
          </div>
        </div>
      </div>

      {/* Room Inspector Modal — rendered outside the grid layout */}
      {selectedRoom && (
        <RoomInfoPanel
          selectedRoomId={selectedRoom}
          stationData={stationData}
          onClose={handleRoomClose}
        />
      )}
    </div>
  );
}
