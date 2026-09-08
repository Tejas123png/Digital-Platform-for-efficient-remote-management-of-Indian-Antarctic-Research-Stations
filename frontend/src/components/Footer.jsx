import React from 'react';
import { API_URL } from '../services/api';

export default function Footer() {
  return (
    <footer className="station-footer">
      <div className="footer-content">
        <span>Antarctic Scientific Research Station • Outpost IV Telemetry Feed</span>
        <span className="mono">FLASK REST API • {API_URL}/api/data</span>
      </div>
    </footer>
  );
}
