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

  // Full alert history modal
  const [allHistoryOpen, setAllHistoryOpen] = useState(false);

  // Close full-history modal on Escape
  useEffect(() => {
    function handleEsc(e) { if (e.key === 'Escape') setAllHistoryOpen(false); }
    if (allHistoryOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [allHistoryOpen]);

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
          <div className="ps-alert-list" style={{ maxHeight: '200px', overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
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
      <div className="ps-panel-section" style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto' }}>
        <div className="ps-section-title" style={{ flexShrink: 0, marginBottom: '6px' }}>
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

        {/* ── VIEW ALL HISTORY button ── */}
        <button
          onClick={() => setAllHistoryOpen(true)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '6px 0',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '3px',
            color: 'var(--accent-blue)',
            fontSize: '10px',
            fontWeight: '600',
            letterSpacing: '0.05em',
            cursor: 'pointer',
            textTransform: 'uppercase',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)';       e.currentTarget.style.borderColor = 'var(--border)'; }}
          title="View all alert history"
        >
          <span style={{ fontSize: '11px' }}>🗂</span>
          Click to view alert history
          <span style={{ fontSize: '11px' }}>→</span>
        </button>
      </div>

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

      {/* ── FULL ALERT HISTORY MODAL ── */}
      {allHistoryOpen && (
        <div
          onClick={() => setAllHistoryOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'ps-fade-in 0.18s ease-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '620px',
              maxHeight: '82vh',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.9)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              animation: 'ps-modal-up 0.22s ease-out',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px' }}>🗂</span>
                <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Alert History
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  ({anomalyEvents.length} records)
                </span>
              </div>
              <button
                onClick={() => setAllHistoryOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 2px' }}
                title="Close"
              >✕</button>
            </div>

            {/* Stats bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              {[
                { label: 'Total',    val: anomalyEvents.length,                                                                                   color: 'var(--text-secondary)' },
                { label: 'Critical', val: anomalyEvents.filter(e => ['GENERATOR_FAILURE','PUMP_FAILURE','EQUIPMENT_OVERHEAT','EXTREME_COLD','PRESSURE_DROP','POWER_GENERATION_DROP'].includes(e.type)).length, color: 'var(--status-critical)' },
                { label: 'Moderate', val: anomalyEvents.filter(e => !['GENERATOR_FAILURE','PUMP_FAILURE','EQUIPMENT_OVERHEAT','EXTREME_COLD','PRESSURE_DROP','POWER_GENERATION_DROP'].includes(e.type)).length, color: 'var(--status-warning)' },
                { label: 'Resolved', val: anomalyEvents.filter(e => e.status === 'RESOLVED').length,                                             color: 'var(--status-normal)' },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, padding: '6px 8px', borderRight: i < 3 ? '1px solid var(--border)' : 'none', textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: '700', color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '64px 1fr 60px 52px 90px',
              gap: '4px', padding: '5px 14px',
              borderBottom: '1px solid var(--border)',
              fontSize: '9px', fontWeight: '700', letterSpacing: '0.08em',
              color: 'var(--text-muted)', textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              <span>Time</span>
              <span>Event</span>
              <span>Station</span>
              <span style={{ textAlign: 'center' }}>Status</span>
              <span style={{ textAlign: 'center' }}>AI</span>
            </div>

            {/* Scrollable rows */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '4px 14px 10px' }}>
              {anomalyEvents.length > 0 ? anomalyEvents.map(evt => {
                const label = SCENARIO_LABELS[evt.type] || evt.type;
                const timeStr = evt.started_at?.split(' ')[1] || evt.started_at || '';
                const isCritical = ['GENERATOR_FAILURE','PUMP_FAILURE','EQUIPMENT_OVERHEAT','EXTREME_COLD','PRESSURE_DROP','POWER_GENERATION_DROP'].includes(evt.type);
                const sevColor = isCritical ? 'var(--status-critical)' : 'var(--status-warning)';
                const isResolved = evt.status === 'RESOLVED';
                const evtAnalysis = eventAnalyses[evt.id];
                const isLoading  = evtAnalysis?.status === 'loading';
                const isDone     = evtAnalysis?.status === 'done' || evtAnalysis?.status === 'error';
                return (
                  <div key={evt.id} style={{
                    display: 'grid', gridTemplateColumns: '64px 1fr 60px 52px 90px',
                    gap: '4px', alignItems: 'center',
                    padding: '5px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '11px',
                  }}>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{timeStr}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: sevColor, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{station}</span>
                    <span style={{ textAlign: 'center', color: isResolved ? 'var(--status-normal)' : 'var(--status-warning)', fontWeight: '600', fontSize: '10px' }}>
                      {isResolved ? '✓ Done' : 'Active'}
                    </span>
                    {/* AI Analyze / View button */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      {!isDone ? (
                        <button
                          onClick={e => { e.stopPropagation(); handleEventAnalyze(evt); }}
                          disabled={isLoading}
                          style={{
                            padding: '2px 7px',
                            fontSize: '9px', fontWeight: '700', letterSpacing: '0.04em',
                            background: isLoading ? 'var(--bg-card)' : 'rgba(var(--accent-blue-rgb,59,130,246),0.12)',
                            border: '1px solid var(--accent-blue)',
                            borderRadius: '3px',
                            color: 'var(--accent-blue)',
                            cursor: isLoading ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px',
                            whiteSpace: 'nowrap',
                          }}
                          title="Run AI analysis on this event"
                        >
                          {isLoading ? (
                            <><span className="ps-ai-spinner" style={{ width: 8, height: 8 }} /> …</>
                          ) : (
                            <>AI Analyze</>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setActiveModalEventId(evt.id); }}
                          style={{
                            padding: '2px 7px',
                            fontSize: '9px', fontWeight: '700', letterSpacing: '0.04em',
                            background: 'rgba(var(--status-normal-rgb,34,197,94),0.10)',
                            border: '1px solid var(--status-normal)',
                            borderRadius: '3px',
                            color: 'var(--status-normal)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          title="View AI analysis result"
                        >
                          View →
                        </button>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontSize: '11px' }}>No alert history records</div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '8px 14px',
              borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Press <kbd style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1px 4px', fontSize: '9px' }}>Esc</kbd> or click outside to close
              </span>
              <button
                onClick={() => setAllHistoryOpen(false)}
                style={{ padding: '4px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.05em', cursor: 'pointer', textTransform: 'uppercase', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
              >Close</button>
            </div>
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes ps-fade-in  { from { opacity:0; }                                          to { opacity:1; } }
            @keyframes ps-modal-up { from { opacity:0; transform:translateY(16px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
          `}} />
        </div>
      )}
    </>
  );
}
