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

import { fetchStationData } from './services/api';
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

export default function App() {
  const [stationData,       setStationData]       = useState(null);
  const [history,           setHistory]           = useState([]);
  const [logs,              setLogs]              = useState([]);
  const [alerts,            setAlerts]            = useState([]);
  const [connectionStatus,  setConnectionStatus]  = useState('connecting');
  const [selectedRoom,      setSelectedRoom]      = useState(null);
  const [activeStation,     setActiveStation]     = useState('MAITRI');

  const prevDataRef = useRef(null);

  const poll = useCallback(async () => {
    try {
      const data = await fetchStationData(activeStation);
      if (!data) return;

      setStationData(data);
      setConnectionStatus('connected');

      // Update rolling history
      setHistory((h) => {
        const next = [...h, data];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });

      // Generate log entries
      const newEntries = buildLogEntry(data, prevDataRef.current);
      setLogs((l) => {
        const next = [...l, ...newEntries];
        return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
      });

      // Detect alerts
      setAlerts(detectAlerts(data));

      prevDataRef.current = data;
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
    setHistory([]);
    setLogs([]);
    prevDataRef.current = null;
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
          <LeftPanel data={stationData} />
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

        {/* RIGHT PANEL — Alerts + Room Inspector */}
        <div className="ps-right">
          <AlertPanel alerts={alerts} onAlertClick={handleAlertClick} />
          <div className="ps-panel-section">
            <div className="ps-section-title">Room Inspector</div>
          </div>
          <RoomInfoPanel
            selectedRoomId={selectedRoom}
            stationData={stationData}
            onClose={handleRoomClose}
          />
        </div>

        {/* BOTTOM — Charts + Logs */}
        <div className="ps-bottom">
          <ChartsSection history={history} />

          <div className="ps-bottom-section">
            <div className="ps-bottom-section__title">Event Log</div>
            <LogsView logs={logs} />
          </div>
        </div>
      </div>
    </div>
  );
}
