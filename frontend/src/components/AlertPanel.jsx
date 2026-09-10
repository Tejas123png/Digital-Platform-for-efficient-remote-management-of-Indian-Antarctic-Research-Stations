import React, { useState, useCallback } from 'react';
import { STATION_ROOMS } from '../data/stationRooms';
import { analyzeAlert } from '../services/api';

export default function AlertPanel({ alerts, onAlertClick }) {
  // Track AI analysis state per alert id
  const [analyses, setAnalyses] = useState({});   // { alertId: { status, data } }

  const handleAnalyze = useCallback(async (alert) => {
    const key = alert.id;

    // Don't re-trigger if already loading
    if (analyses[key]?.status === 'loading') return;

    setAnalyses((prev) => ({
      ...prev,
      [key]: { status: 'loading', data: null }
    }));

    try {
      const result = await analyzeAlert(alert.id, alert.message, alert.severity);

      if (result.error) {
        setAnalyses((prev) => ({
          ...prev,
          [key]: { status: 'error', data: result }
        }));
      } else {
        setAnalyses((prev) => ({
          ...prev,
          [key]: { status: 'done', data: result }
        }));
      }
    } catch (err) {
      setAnalyses((prev) => ({
        ...prev,
        [key]: {
          status: 'error',
          data: {
            summary: 'AI analysis unavailable — unable to reach the backend.',
            possible_causes: [],
            affected_systems: [],
            risk: 'Cannot connect to AI service.',
            recommended_actions: ['Ensure the Python backend is running.', 'Check Ollama service status.']
          }
        }
      }));
    }
  }, [analyses]);

  if (alerts.length === 0) {
    return (
      <div className="ps-panel-section">
        <div className="ps-section-title">Active Alerts</div>
        <div className="ps-no-alerts">
          <div className="ps-no-alerts-ok">
            <span>●</span>
            <span>All Systems Nominal</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ps-panel-section">
      <div className="ps-section-title">
        Active Alerts
        <span
          style={{
            marginLeft: 4,
            background: 'var(--status-critical)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 10,
          }}
        >
          {alerts.length}
        </span>
      </div>
      <div className="ps-alert-list">
        {alerts.map((alert) => {
          const room = STATION_ROOMS.find((r) => r.id === alert.roomId);
          const analysis = analyses[alert.id];

          return (
            <div key={alert.id} className="ps-alert-item-wrapper">
              <div
                className={`ps-alert-item ${alert.severity}`}
                onClick={() => onAlertClick && onAlertClick(alert.roomId)}
                title={`Click to inspect ${room?.name || alert.roomId}`}
              >
                <span className="ps-alert-icon">
                  {alert.severity === 'critical' ? '🔴' : '⚠️'}
                </span>
                <div className="ps-alert-content">
                  <div className="ps-alert-title">{alert.message}</div>
                  <div className="ps-alert-desc">{alert.description}</div>
                  {room && (
                    <div className="ps-alert-room">
                      {room.icon} {room.name} — click to inspect
                    </div>
                  )}
                </div>
              </div>

              {/* AI Analyze button */}
              <button
                className={`ps-ai-btn ${analysis?.status === 'loading' ? 'loading' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleAnalyze(alert); }}
                disabled={analysis?.status === 'loading'}
                title="Request AI analysis of this alert"
              >
                {analysis?.status === 'loading' ? (
                  <>
                    <span className="ps-ai-spinner"></span>
                    Analyzing...
                  </>
                ) : (
                  <>🤖 AI ANALYZE</>
                )}
              </button>

              {/* AI Analysis Result */}
              {analysis?.status === 'done' && analysis.data && (
                <div className="ps-ai-result">
                  <div className="ps-ai-result-header">
                    <span>🤖</span> AI ANALYSIS
                  </div>

                  <div className="ps-ai-section">
                    <div className="ps-ai-section-label">Summary</div>
                    <div className="ps-ai-section-text">{analysis.data.summary}</div>
                  </div>

                  {analysis.data.possible_causes?.length > 0 && (
                    <div className="ps-ai-section">
                      <div className="ps-ai-section-label">Possible Causes</div>
                      <ul className="ps-ai-list">
                        {analysis.data.possible_causes.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}

                  {analysis.data.affected_systems?.length > 0 && (
                    <div className="ps-ai-section">
                      <div className="ps-ai-section-label">Affected Systems</div>
                      <ul className="ps-ai-list">
                        {analysis.data.affected_systems.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="ps-ai-section">
                    <div className="ps-ai-section-label">Risk</div>
                    <div className="ps-ai-section-text">{analysis.data.risk}</div>
                  </div>

                  {analysis.data.recommended_actions?.length > 0 && (
                    <div className="ps-ai-section">
                      <div className="ps-ai-section-label">Recommended Actions</div>
                      <ul className="ps-ai-list">
                        {analysis.data.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* AI Error State */}
              {analysis?.status === 'error' && analysis.data && (
                <div className="ps-ai-result ps-ai-error">
                  <div className="ps-ai-result-header">
                    <span>⚠️</span> AI ANALYSIS UNAVAILABLE
                  </div>
                  <div className="ps-ai-section">
                    <div className="ps-ai-section-text">{analysis.data.summary}</div>
                  </div>
                  {analysis.data.recommended_actions?.length > 0 && (
                    <div className="ps-ai-section">
                      <ul className="ps-ai-list">
                        {analysis.data.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
