import React, { useState, useCallback, useEffect } from 'react';
import { STATION_ROOMS } from '../data/stationRooms';
import { analyzeAlert } from '../services/api';

function AiModal({ alert, analysis, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!alert) return null;

  return (
    <div className="ps-ai-modal-backdrop" onClick={onClose}>
      <div className="ps-ai-modal" onClick={e => e.stopPropagation()}>
        <div className="ps-ai-modal-header">
          <div className="ps-ai-modal-title">
            <span style={{ fontSize: '10px', fontWeight: 'bold', marginRight: '6px', border: '1px solid currentColor', padding: '1px 4px', borderRadius: '3px' }}>AI</span> ANALYSIS
          </div>
          <button className="ps-ai-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="ps-ai-modal-body">
          <div className="ps-ai-section">
            <div className="ps-ai-section-label">Alert</div>
            <div className="ps-ai-section-text" style={{ fontWeight: 700, color: alert.severity === 'critical' ? 'var(--status-critical)' : 'var(--status-warning)' }}>
              {alert.message}
            </div>
          </div>

          {!analysis || analysis.status === 'loading' ? (
            <div className="ps-ai-loading">
              <span className="ps-ai-spinner" style={{ marginRight: 8 }}></span>
              Analyzing with AI...
            </div>
          ) : analysis.status === 'error' ? (
            <div className="ps-ai-result ps-ai-error" style={{ border: 'none', background: 'transparent', padding: 0 }}>
              <div className="ps-ai-section">
                <div className="ps-ai-section-label" style={{ color: 'var(--status-warning)' }}>⚠️ AI ANALYSIS UNAVAILABLE</div>
                <div className="ps-ai-section-text">{analysis.data.summary}</div>
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
          ) : (
            <div className="ps-ai-result-content">
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
              {analysis.data.risk && (
                <div className="ps-ai-section">
                  <div className="ps-ai-section-label">Risk</div>
                  <div className="ps-ai-section-text">{analysis.data.risk}</div>
                </div>
              )}
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
        </div>
        
        <div className="ps-ai-modal-footer">
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Press <kbd>ESC</kbd> to close</span>
          <button className="ps-ai-modal-btn-close" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

// Human-readable labels for scenario types
const SCENARIO_LABELS = {
  EXTREME_COLD: 'Extreme Cold',
  EXTREME_WIND: 'Extreme Wind',
  PRESSURE_DROP: 'Pressure Drop',
  HUMIDITY_ANOMALY: 'Humidity Anomaly',
  GENERATOR_FAILURE: 'Generator Failure',
  COMMUNICATION_FAILURE: 'Communication Failure',
  EQUIPMENT_OVERHEAT: 'Equipment Overheat',
  HIGH_VIBRATION: 'High Vibration',
  HEATING_SURGE: 'Heating Surge',
  PUMP_FAILURE: 'Pump Failure',
  POWER_GENERATION_DROP: 'Power Generation Drop',
  POWER_CONSUMPTION_SPIKE: 'Power Consumption Spike',
  GENERATOR_LOAD_SPIKE: 'Generator Load Spike',
};

export default function AlertPanel({ alerts, anomalyEvents = [], onAlertClick, station = 'MAITRI' }) {
  // Track AI analysis state per alert id (for active alerts)
  const [analyses, setAnalyses] = useState({});   // { alertId: { status, data } }
  const [activeModalAlertId, setActiveModalAlertId] = useState(null);

  // Track AI analysis state per event id (for history events)
  const [eventAnalyses, setEventAnalyses] = useState({}); // { eventId: { status, data } }
  const [activeModalEventId, setActiveModalEventId] = useState(null);

  // --- Active alert analysis (unchanged logic) ---
  const handleAnalyze = useCallback(async (alert) => {
    const key = alert.id;
    
    if (analyses[key]?.status === 'loading' || analyses[key]?.status === 'done') return;

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

  // --- Event history analysis ---
  const handleEventAnalyze = useCallback(async (evt) => {
    const key = evt.id;
    
    if (eventAnalyses[key]?.status === 'loading' || eventAnalyses[key]?.status === 'done') return;

    setEventAnalyses((prev) => ({
      ...prev,
      [key]: { status: 'loading', data: null }
    }));

    try {
      const label = SCENARIO_LABELS[evt.type] || evt.type;
      const result = await analyzeAlert(evt.type, label, 'critical', evt.id);

      if (result.error) {
        setEventAnalyses((prev) => ({
          ...prev,
          [key]: { status: 'error', data: result }
        }));
      } else {
        setEventAnalyses((prev) => ({
          ...prev,
          [key]: { status: 'done', data: result }
        }));
      }
    } catch (err) {
      setEventAnalyses((prev) => ({
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
  }, [eventAnalyses]);

  // Build modal alert object for event history
  const activeModalEvent = activeModalEventId
    ? anomalyEvents.find(e => e.id === activeModalEventId)
    : null;

  const activeModalAlert = activeModalAlertId
    ? alerts.find(a => a.id === activeModalAlertId) || { id: activeModalAlertId, message: 'Unknown Alert', severity: 'warning' }
    : null;

  // Filter history to only resolved events (not currently active)
  const historyEvents = anomalyEvents.filter(e => e.status === 'RESOLVED' || eventAnalyses[e.id]?.status === 'done');

  const hasActiveAlerts = alerts.length > 0;
  const hasHistory = historyEvents.length > 0;

  return (
    <>
      {/* === ACTIVE ALERTS === */}
      <div className="ps-panel-section">
        <div className="ps-section-title">
          Active Alerts
          {hasActiveAlerts && (
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
          )}
        </div>

        {!hasActiveAlerts ? (
          <div className="ps-no-alerts">
            <div className="ps-no-alerts-ok">
              <span>●</span>
              <span>All Systems Nominal</span>
            </div>
          </div>
        ) : (
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                      <span className={`ps-severity-dot ${alert.severity}`} />
                      <span className={`ps-severity-label ${alert.severity}`}>
                        {alert.severity === 'critical' ? 'CRIT' : 'WARN'}
                      </span>
                    </div>
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

                  {/* AI Actions */}
                  {(!analysis || analysis.status === 'loading') ? (
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
                        <>AI ANALYZE</>
                      )}
                    </button>
                  ) : (
                    <button
                      className="ps-ai-details-btn"
                      onClick={(e) => { e.stopPropagation(); setActiveModalAlertId(alert.id); }}
                      title="View full AI analysis"
                    >
                      View Details →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* === ALERT HISTORY === */}
      {hasHistory && (
        <div className="ps-panel-section" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: '0 1 auto' }}>
          <div className="ps-section-title" style={{ flexShrink: 0 }}>
            Alert History
            <span
              style={{
                marginLeft: 4,
                background: 'var(--text-muted)',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 10,
                opacity: 0.7,
              }}
            >
              {historyEvents.length}
            </span>
          </div>
          <div className="ps-alert-history-scroll">
            <div className="ps-alert-list">
              {historyEvents.map((evt) => {
                const label = SCENARIO_LABELS[evt.type] || evt.type;
                const evtAnalysis = eventAnalyses[evt.id];
                const isAnalyzed = evtAnalysis?.status === 'done';

                const timeStr = evt.started_at?.split(' ')[1] || '';
                const endTimeStr = evt.ended_at?.split(' ')[1] || '';

                // Determine severity for visual coding
                const isCritical = ['GENERATOR_FAILURE', 'PUMP_FAILURE', 'EQUIPMENT_OVERHEAT', 'EXTREME_COLD', 'PRESSURE_DROP', 'POWER_GENERATION_DROP'].includes(evt.type);
                const severityClass = isCritical ? 'critical' : 'warning';
                const severityLabel = isCritical ? 'CRITICAL' : 'MODERATE';

                return (
                  <div key={evt.id} className="ps-alert-item-wrapper">
                    <div className={`ps-alert-item ${severityClass}`} style={{ padding: '4px 6px', gap: '5px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                        <span className={`ps-severity-dot ${severityClass}`} />
                      </div>
                      <div className="ps-alert-content">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span className={`ps-severity-label ${severityClass}`}>{severityLabel}</span>
                          <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text-muted)' }}>• {station}</span>
                          <span className={`ps-alert-status-badge ${isAnalyzed ? 'analyzed' : 'resolved'}`} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'var(--bg-card-hover)', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {isAnalyzed ? 'ANALYZED' : 'RESOLVED'}
                          </span>
                        </div>
                        <div className="ps-alert-title" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '1px' }}>
                          {label}
                        </div>
                        <div className="ps-alert-desc" style={{ fontSize: '10px' }}>
                          {timeStr}{endTimeStr ? ` → ${endTimeStr}` : ''}
                        </div>
                      </div>
                      {/* Inline compact analyze/view btn */}
                      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        {(!evtAnalysis || evtAnalysis.status === 'loading') ? (
                          <button
                            className={`ps-ai-btn ${evtAnalysis?.status === 'loading' ? 'loading' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleEventAnalyze(evt); }}
                            disabled={evtAnalysis?.status === 'loading'}
                            title="Analyze this resolved anomaly with AI"
                            style={{ width: 'auto', padding: '3px 8px', fontSize: '10px' }}
                          >
                            {evtAnalysis?.status === 'loading' ? (
                              <>
                                <span className="ps-ai-spinner" style={{ width: 8, height: 8 }} />
                              </>
                            ) : (
                              <>Analyze</>
                            )}
                          </button>
                        ) : (
                          <button
                            className="ps-ai-details-btn"
                            onClick={(e) => { e.stopPropagation(); setActiveModalEventId(evt.id); }}
                            title="View full AI analysis"
                            style={{ minWidth: 'auto', height: 'auto', padding: '3px 8px', fontSize: '10px' }}
                          >
                            View →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* AI Modal for active alerts */}
      {activeModalAlertId && (
        <AiModal
          alert={activeModalAlert}
          analysis={analyses[activeModalAlertId]}
          onClose={() => setActiveModalAlertId(null)}
        />
      )}

      {/* AI Modal for history events */}
      {activeModalEventId && activeModalEvent && (
        <AiModal
          alert={{
            id: activeModalEvent.id,
            message: SCENARIO_LABELS[activeModalEvent.type] || activeModalEvent.type,
            severity: 'critical',
          }}
          analysis={eventAnalyses[activeModalEventId]}
          onClose={() => setActiveModalEventId(null)}
        />
      )}
    </>
  );
}
