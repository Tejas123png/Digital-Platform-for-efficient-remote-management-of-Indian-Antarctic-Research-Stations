import React, { useState, useEffect, useRef } from 'react';
import { fetchEdgeStatus, fetchEdgeQueue, fetchEdgeHistory, fetchEdgeStats, fetchSyncStatus } from '../services/api';

export default function EdgeComputingControl() {
  const [isOpen, setIsOpen]               = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [fullHistory, setFullHistory]     = useState([]);
  const [edgeStatus, setEdgeStatus]       = useState(null);
  const [edgeQueue, setEdgeQueue]         = useState(null);
  const [edgeHistory, setEdgeHistory]     = useState([]);
  const [edgeStats, setEdgeStats]         = useState(null);
  const [syncStatus, setSyncStatus]       = useState(null);
  const [isHovered, setIsHovered]         = useState(false);
  const [isActive, setIsActive]           = useState(false);
  const popupRef                          = useRef(null);
  const modalRef                          = useRef(null);

  /* ── polling ─────────────────────────────────────── */
  useEffect(() => {
    let mounted = true;
    async function poll() {
      try {
        const [status, queue, history, stats, sync] = await Promise.all([
          fetchEdgeStatus(),
          fetchEdgeQueue(),
          fetchEdgeHistory(10),
          fetchEdgeStats(),
          fetchSyncStatus()
        ]);
        if (!mounted) return;
        setEdgeStatus(status);
        setEdgeQueue(queue);
        setEdgeHistory(history);
        setEdgeStats(stats);
        setSyncStatus(sync);
      } catch (_) {}
    }
    poll();
    const id = setInterval(poll, 2500);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  /* ── click-outside / Escape for dropdown ─────────── */
  useEffect(() => {
    function outside(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function esc(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsHistoryOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', outside);
      document.addEventListener('keydown', esc);
    }
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [isOpen]);

  /* ── click-outside for history modal ─────────────── */
  useEffect(() => {
    function outsideModal(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        setIsHistoryOpen(false);
      }
    }
    function esc(e) {
      if (e.key === 'Escape') setIsHistoryOpen(false);
    }
    if (isHistoryOpen) {
      document.addEventListener('mousedown', outsideModal);
      document.addEventListener('keydown', esc);
    }
    return () => {
      document.removeEventListener('mousedown', outsideModal);
      document.removeEventListener('keydown', esc);
    };
  }, [isHistoryOpen]);

  /* ── open history modal — fetch 100 records ──────── */
  async function openHistory() {
    try {
      const all = await fetchEdgeHistory(100);
      setFullHistory(all);
    } catch (_) {
      setFullHistory(edgeHistory);
    }
    setIsHistoryOpen(true);
  }

  /* ── helpers ─────────────────────────────────────── */
  const formatBytes = (bytes) => {
    if (bytes == null || bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatSeconds = (s) => {
    if (s == null) return 'None';
    if (s < 60) return `${Math.round(s)}s`;
    const m = Math.floor(s / 60), r = Math.round(s % 60);
    return `${m.toString().padStart(2,'0')}:${r.toString().padStart(2,'0')}`;
  };

  const netMode      = edgeStatus?.network_mode || 'ONLINE';
  const isOnline     = netMode === 'ONLINE';
  const isDegraded   = netMode === 'DEGRADED';
  const networkColor = isOnline ? 'var(--status-normal)' : isDegraded ? 'var(--status-warning)' : 'var(--status-critical)';
  const syncState    = edgeStatus?.sync?.status || 'ACTIVE';
  const totalPending = edgeQueue?.total_pending || 0;

  // Dynamic status text & color
  let syncLabel = 'SYNC ACTIVE';
  let syncColor = 'var(--status-normal)';

  if (netMode === 'OFFLINE') {
    syncLabel = 'SYNC OFFLINE';
    syncColor = 'var(--status-critical)';
  } else if (netMode === 'DEGRADED' || syncState === 'THROTTLED') {
    syncLabel = 'SYNC DEGRADED';
    syncColor = 'var(--status-warning)';
  } else if (syncState === 'PAUSED') {
    syncLabel = 'SYNC IDLE';
    syncColor = 'var(--text-muted)';
  } else {
    syncLabel = 'SYNC ACTIVE';
    syncColor = 'var(--status-normal)';
  }

  /* ── shared row renderer for popup ───────────────── */
  function HistoryRow({ evt }) {
    const timeStr = new Date(evt.timestamp * 1000).toLocaleTimeString([], { hour12: false });
    const pColor  = evt.priority === 1 ? 'var(--status-critical)' : evt.priority === 2 ? 'var(--status-warning)' : 'var(--status-normal)';
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '55px 22px 52px 1fr', gap: '6px', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '10px' }}>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{timeStr}</span>
        <span style={{ color: pColor, fontWeight: 'bold' }}>P{evt.priority}</span>
        <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {evt.type === 'TELEMETRY' ? 'TELEM' : evt.type}
        </span>
        <span style={{ color: evt.status === 'SYNCED' ? 'var(--status-normal)' : 'var(--text-muted)', textAlign: 'right' }}>
          {evt.status === 'SYNCED' ? 'Synced' : 'Stored'}
        </span>
      </div>
    );
  }

  /* ── priority counts for full history modal header ─ */
  const syncedCount = fullHistory.filter(e => e.status === 'SYNCED').length;

  return (
    <>
      {/* ── HEADER SYNC CONTROL BUTTON ───────────────────── */}
      <div style={{ position: 'relative' }} ref={popupRef}>
        <button
          onClick={() => setIsOpen(o => !o)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => { setIsHovered(false); setIsActive(false); }}
          onMouseDown={() => setIsActive(true)}
          onMouseUp={() => setIsActive(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            backgroundColor: isActive
              ? 'var(--bg-card-hover)'
              : isOpen || isHovered
              ? '#1c2838'
              : 'var(--bg-card)',
            border: isOpen || isHovered
              ? '1px solid var(--accent-blue)'
              : '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '10px',
            fontWeight: '600',
            letterSpacing: '0.04em',
            cursor: 'pointer',
            outline: 'none',
            userSelect: 'none',
            transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease',
            transform: isActive ? 'scale(0.98)' : 'none',
            boxShadow: isOpen ? '0 0 8px rgba(88, 166, 255, 0.25)' : 'none',
          }}
          title="Click to view detailed synchronization status"
        >
          <span style={{ fontSize: '12px', color: syncColor, display: 'inline-flex', alignItems: 'center' }}>
            ⇄
          </span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '0.05em' }}>
            {syncLabel}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginLeft: '2px',
              display: 'inline-block',
              transition: 'transform 0.15s ease',
              transform: isOpen ? 'rotate(90deg)' : 'none',
            }}
          >
            ›
          </span>
        </button>

        {/* ── COMPACT DROPDOWN POPUP ─────────────────────── */}
        {isOpen && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              width: '280px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.85), 0 0 1px rgba(255,255,255,0.1)',
              zIndex: 2000,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px',
              animation: 'ps-slide-down 0.18s ease-out',
            }}
          >
            {/* Title Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '0.06em',
                paddingBottom: '6px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ color: 'var(--accent-blue)', fontSize: '13px' }}>⇄</span>
              SYNC STATUS
            </div>

            {/* SYNC STATUS grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '5px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase' }}>NETWORK</span>
                <span style={{ color: networkColor, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: networkColor, display: 'inline-block' }} />
                  {netMode}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase' }}>PROCESSING</span>
                <span style={{ color: 'var(--status-normal)', fontWeight: 'bold' }}>✓ ACTIVE</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase' }}>SYNC STATE</span>
                <span style={{
                  fontWeight: 'bold',
                  color: syncState === 'ACTIVE' ? 'var(--accent-blue)' : syncState === 'PAUSED' ? 'var(--text-muted)' : 'var(--status-warning)'
                }}>
                  {syncState === 'PAUSED' ? '⏸ PAUSED' : syncState === 'THROTTLED' ? '⚠ THROTTLED' : '⟳ ACTIVE'}
                </span>
              </div>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border)' }} />

            {/* LOCAL BUFFER section */}
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '10px', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                LOCAL BUFFER
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', backgroundColor: 'var(--bg-panel-2)', padding: '6px 8px', borderRadius: '4px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase' }}>Pending</span>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{totalPending}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase' }}>Storage</span>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{formatBytes(edgeStats?.database_size_bytes)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase' }}>Oldest</span>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{formatSeconds(edgeStats?.oldest_pending_age_seconds)}</span>
                </div>
              </div>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border)' }} />

            {/* SYNC COMPLETION / RETRY INDICATOR */}
            <div>
              {syncStatus?.backoff_seconds > 0 && (
                <div style={{ color: 'var(--status-warning)', fontSize: '10px', fontWeight: 600 }}>
                  ⚠ RETRY IN ~{Math.ceil(syncStatus.backoff_seconds)}s
                </div>
              )}
              {isOnline && totalPending > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--accent-blue)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                  SYNCING: P1 → P2 → P3
                </div>
              )}
              {isOnline && totalPending === 0 && (
                <div style={{ fontSize: '11px', color: 'var(--status-normal)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ✓ SYNC COMPLETE
                </div>
              )}
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border)' }} />

            {/* RECENT SYNC ACTIVITY */}
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '10px', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                RECENT SYNC ACTIVITY
              </div>
              <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '2px' }}>
                {edgeHistory?.length > 0 ? (
                  edgeHistory.slice(0, 5).map(evt => (
                    <HistoryRow key={evt.id} evt={evt} />
                  ))
                ) : (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0', fontSize: '10px' }}>No recent activity</div>
                )}
              </div>

              {/* View all history button */}
              <button
                onClick={openHistory}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '5px 0',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '3px',
                  color: 'var(--accent-blue)',
                  fontSize: '10px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)';       e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <span>🗂</span>
                View All Sync History →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── FULL EDGE HISTORY MODAL (Modal Overlay) ──────── */}
      {isHistoryOpen && (
        <div
          onClick={() => setIsHistoryOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'ps-fade-in 0.18s ease-out',
          }}
        >
          <div
            ref={modalRef}
            onClick={e => e.stopPropagation()}
            style={{
              width: '600px',
              maxHeight: '80vh',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.9)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'ps-slide-down 0.2s ease-out',
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>⚡</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em' }}>
                  EDGE STORAGE LOG (LAST 100 RECORDS)
                </span>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  fontSize: '16px', cursor: 'pointer', padding: '2px 6px',
                  borderRadius: '3px', transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                ✕
              </button>
            </div>

            {/* Stats strip */}
            <div style={{
              display: 'flex', gap: '16px', padding: '8px 16px',
              backgroundColor: 'var(--bg-panel-2)',
              borderBottom: '1px solid var(--border)',
              fontSize: '11px', flexShrink: 0,
            }}>
              <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{fullHistory.length}</strong></span>
              <span>Synced: <strong style={{ color: 'var(--status-normal)' }}>{syncedCount}</strong></span>
              <span>Pending: <strong style={{ color: 'var(--status-warning)' }}>{fullHistory.length - syncedCount}</strong></span>
            </div>

            {/* Table Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '70px 40px 80px 1fr 70px', gap: '8px',
              padding: '6px 16px', backgroundColor: 'var(--bg-card)',
              fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <span>Time</span>
              <span>Prio</span>
              <span>Type</span>
              <span>Record UID</span>
              <span style={{ textAlign: 'right' }}>Status</span>
            </div>

            {/* Table Rows */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px' }}>
              {fullHistory.length > 0 ? (
                fullHistory.map(evt => {
                  const timeStr = new Date(evt.timestamp * 1000).toLocaleTimeString([], { hour12: false });
                  const pColor = evt.priority === 1 ? 'var(--status-critical)' : evt.priority === 2 ? 'var(--status-warning)' : 'var(--status-normal)';
                  return (
                    <div
                      key={evt.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '70px 40px 80px 1fr 70px', gap: '8px',
                        alignItems: 'center', padding: '6px 0',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontSize: '11px',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{timeStr}</span>
                      <span style={{ color: pColor, fontWeight: 700 }}>P{evt.priority}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{evt.type}</span>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {evt.record_uid || evt.id}
                      </span>
                      <span style={{
                        textAlign: 'right', fontWeight: 600,
                        color: evt.status === 'SYNCED' ? 'var(--status-normal)' : 'var(--status-warning)',
                      }}>
                        {evt.status === 'SYNCED' ? '✓ Synced' : '⏳ Stored'}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No history records found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
