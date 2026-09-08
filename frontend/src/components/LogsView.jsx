import React, { useRef, useEffect, useState, useCallback } from 'react';

const LEVEL_META = {
  info:     { icon: '●', label: 'INFO',     color: 'var(--accent-blue)' },
  warning:  { icon: '▲', label: 'WARN',     color: 'var(--status-warning)' },
  critical: { icon: '■', label: 'CRITICAL', color: 'var(--status-critical)' },
};

function levelMeta(level) {
  return LEVEL_META[level] || LEVEL_META.info;
}

/* ── Compact log row (bottom bar) ──────────────────────── */
function LogRow({ entry, onClick }) {
  const meta = levelMeta(entry.level);
  return (
    <div
      className={`ps-log-entry log-entry-compact log-level-${entry.level}`}
      onClick={onClick}
      title="Click to view full log"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <span className="log-time">{entry.time}</span>
      <span className="log-badge" style={{ color: meta.color }}>
        {meta.icon} {meta.label}
      </span>
      <span className="log-sub">{entry.subsystem}</span>
      <span className="log-msg">{entry.message}</span>
    </div>
  );
}

/* ── Modal log row (popup, expanded) ───────────────────── */
function ModalLogRow({ entry, index }) {
  const meta = levelMeta(entry.level);
  return (
    <div className={`modal-log-row modal-log-${entry.level}`}>
      <span className="modal-log-index">#{index + 1}</span>
      <span className="modal-log-time">{entry.time}</span>
      <span className="modal-log-badge" style={{ color: meta.color }}>
        {meta.icon} {meta.label}
      </span>
      <span className="modal-log-sub">[{entry.subsystem}]</span>
      <span className="modal-log-msg">{entry.message}</span>
    </div>
  );
}

/* ── Log Modal ──────────────────────────────────────────── */
function LogModal({ logs, onClose }) {
  const bottomRef = useRef(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = logs.filter((e) => {
    if (filter !== 'all' && e.level !== filter) return false;
    if (search && !e.message?.toLowerCase().includes(search.toLowerCase())
      && !e.subsystem?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all:      logs.length,
    info:     logs.filter((e) => e.level === 'info').length,
    warning:  logs.filter((e) => e.level === 'warning').length,
    critical: logs.filter((e) => e.level === 'critical').length,
  };

  return (
    <div className="log-modal-backdrop" onClick={onClose}>
      <div className="log-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="log-modal-header">
          <div className="log-modal-title">
            <span className="log-modal-icon">📋</span>
            <span>STATION EVENT LOG</span>
            <span className="log-modal-count">{logs.length} events</span>
          </div>
          <button className="log-modal-close" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        {/* Toolbar */}
        <div className="log-modal-toolbar">
          {/* Level filters */}
          <div className="log-filter-tabs">
            {[
              { key: 'all',      label: 'All',      color: 'var(--text-secondary)' },
              { key: 'info',     label: 'INFO',     color: 'var(--accent-blue)' },
              { key: 'warning',  label: 'WARN',     color: 'var(--status-warning)' },
              { key: 'critical', label: 'CRITICAL', color: 'var(--status-critical)' },
            ].map((f) => (
              <button
                key={f.key}
                className={`log-filter-btn ${filter === f.key ? 'active' : ''}`}
                style={{ '--f-color': f.color }}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span className="log-filter-count">{counts[f.key]}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            className="log-search"
            type="text"
            placeholder="Search messages or subsystems…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* Log body */}
        <div className="log-modal-body">
          {filtered.length === 0 ? (
            <div className="log-modal-empty">No matching log entries</div>
          ) : (
            filtered.map((entry, i) => (
              <ModalLogRow key={i} entry={entry} index={i} />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div className="log-modal-footer">
          <span>Showing {filtered.length} of {logs.length} entries</span>
          <span>Press <kbd>Esc</kbd> or click outside to close</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Export ────────────────────────────────────────── */
export default function LogsView({ logs }) {
  const containerRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Auto-scroll compact view
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const openModal  = useCallback(() => setModalOpen(true),  []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const isEmpty = !logs || logs.length === 0;

  return (
    <>
      {/* Compact bar — click header or any row to open modal */}
      <div className="ps-logs" ref={containerRef}>
        {isEmpty ? (
          <div className="log-waiting">Waiting for telemetry stream…</div>
        ) : (
          logs.map((entry, i) => (
            <LogRow key={i} entry={entry} onClick={openModal} />
          ))
        )}
      </div>

      {/* "Open full log" hint at bottom */}
      {!isEmpty && (
        <button className="log-expand-btn" onClick={openModal} title="View full event log">
          <span>📋</span> VIEW FULL LOG ({logs.length})
        </button>
      )}

      {/* Full-screen modal */}
      {modalOpen && <LogModal logs={logs} onClose={closeModal} />}
    </>
  );
}
