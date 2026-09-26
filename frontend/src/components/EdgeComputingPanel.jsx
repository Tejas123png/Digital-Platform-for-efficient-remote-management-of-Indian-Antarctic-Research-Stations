import React, { useState, useEffect } from 'react';
import { fetchEdgeStatus, fetchEdgeQueue, fetchEdgeHistory, fetchSyncStatus } from '../services/api';

export default function EdgeComputingPanel({ station }) {
  const [edgeStatus, setEdgeStatus] = useState(null);
  const [edgeQueue, setEdgeQueue] = useState(null);
  const [edgeHistory, setEdgeHistory] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    async function poll() {
      try {
        const [status, queue, history, sync] = await Promise.all([
          fetchEdgeStatus(),
          fetchEdgeQueue(),
          fetchEdgeHistory(20), // get 20, we can scroll
          fetchSyncStatus()
        ]);
        if (!mounted) return;
        setEdgeStatus(status);
        setEdgeQueue(queue);
        setEdgeHistory(history);
        setSyncStatus(sync);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err.message);
      }
    }
    
    poll();
    const intervalId = setInterval(poll, 2500);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  if (!edgeStatus && !error) {
    return (
      <div className="ps-right-section ps-edge-section">
        <div className="ps-right-section__title">PRIORITY QUEUE</div>
        <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '11px' }}>Loading...</div>
      </div>
    );
  }

  const netMode = edgeStatus?.network_mode || 'OFFLINE';
  const isOnline = netMode === 'ONLINE';
  const totalPending = edgeQueue?.total_pending || 0;
  
  const p1 = edgeQueue?.priorities?.P1 || 0;
  const p2 = edgeQueue?.priorities?.P2 || 0;
  const p3 = edgeQueue?.priorities?.P3 || 0;
  const maxQ = Math.max(p1, p2, p3, 10);

  return (
    <>
      <div className="ps-right-section ps-edge-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '8px' }}>
        <div className="ps-right-section__title">PRIORITY QUEUE</div>
        
        {error && (
          <div style={{ padding: '8px', color: 'var(--status-warning)', fontSize: '11px', borderBottom: '1px solid var(--border)' }}>
            ⚠ Edge API unavailable
          </div>
        )}

        <div style={{ padding: '4px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px' }}>
              <div style={{ width: '50px', color: 'var(--status-critical)' }}>P1 Crit</div>
              <div style={{ flex: 1, backgroundColor: 'var(--bg-panel-2)', height: '6px', margin: '0 8px', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${(p1 / maxQ) * 100}%`, height: '100%', backgroundColor: 'var(--status-critical)', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ width: '20px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{p1}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px' }}>
              <div style={{ width: '50px', color: 'var(--status-warning)' }}>P2 Mod</div>
              <div style={{ flex: 1, backgroundColor: 'var(--bg-panel-2)', height: '6px', margin: '0 8px', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${(p2 / maxQ) * 100}%`, height: '100%', backgroundColor: 'var(--status-warning)', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ width: '20px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{p2}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px' }}>
              <div style={{ width: '50px', color: 'var(--status-normal)' }}>P3 Norm</div>
              <div style={{ flex: 1, backgroundColor: 'var(--bg-panel-2)', height: '6px', margin: '0 8px', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${(p3 / maxQ) * 100}%`, height: '100%', backgroundColor: 'var(--status-normal)', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ width: '20px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{p3}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            {isOnline && totalPending > 0 && (
              <div style={{ fontSize: '10px', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                SYNCING: P1 → P2 → P3
              </div>
            )}
            {isOnline && totalPending === 0 && (
              <div style={{ fontSize: '10px', color: 'var(--status-normal)' }}>✓ SYNC COMPLETE</div>
            )}

            {syncStatus?.backoff_seconds > 0 && (
              <div style={{ color: 'var(--status-warning)', fontSize: '10px' }}>
                RETRY IN ~{Math.ceil(syncStatus.backoff_seconds)}s
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ps-right-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '8px' }}>
        <div className="ps-right-section__title">EDGE HISTORY</div>
        <div style={{ padding: '4px 12px' }}>
          <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
            {edgeHistory?.length > 0 ? edgeHistory.map(evt => {
              const timeStr = new Date(evt.timestamp * 1000).toLocaleTimeString([], { hour12: false });
              const pColor = evt.priority === 1 ? 'var(--status-critical)' : evt.priority === 2 ? 'var(--status-warning)' : 'var(--status-normal)';
              return (
                <div key={evt.id} style={{ display: 'grid', gridTemplateColumns: '45px 20px 50px 1fr', gap: '4px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{timeStr}</span>
                  <span style={{ color: pColor, fontWeight: 'bold' }}>P{evt.priority}</span>
                  <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{evt.type === 'TELEMETRY' ? 'TELEM' : evt.type}</span>
                  <span style={{ color: evt.status === 'SYNCED' ? 'var(--status-normal)' : 'var(--text-muted)', textAlign: 'right' }}>
                    {evt.status === 'SYNCED' ? 'Synced' : 'Stored'}
                  </span>
                </div>
              );
            }) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>No recent activity</div>
            )}
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 100% { transform: rotate(360deg); } }`}} />
    </>
  );
}

