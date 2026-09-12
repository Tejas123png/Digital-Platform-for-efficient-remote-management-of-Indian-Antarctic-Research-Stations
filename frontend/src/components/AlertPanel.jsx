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
            <span>🤖</span> AI ANALYSIS
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
        </div>
        
        <div className="ps-ai-modal-footer">
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Press <kbd>ESC</kbd> to close</span>
          <button className="ps-ai-modal-btn-close" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

export default function AlertPanel({ alerts, onAlertClick }) {
  // Track AI analysis state per alert id
  const [analyses, setAnalyses] = useState({});   // { alertId: { status, data } }
  const [activeModalAlertId, setActiveModalAlertId] = useState(null);

  const handleAnalyze = useCallback(async (alert) => {
    const key = alert.id;
    
    // Don't re-trigger if already loading or done
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

  const activeModalAlert = activeModalAlertId ? alerts.find(a => a.id === activeModalAlertId) || { id: activeModalAlertId, message: 'Unknown Alert', severity: 'warning' } : null;

  return (
    <>
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
                      <>🤖 AI ANALYZE</>
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
      </div>

      {activeModalAlertId && (
        <AiModal
          alert={activeModalAlert}
          analysis={analyses[activeModalAlertId]}
          onClose={() => setActiveModalAlertId(null)}
        />
      )}
    </>
  );
}
