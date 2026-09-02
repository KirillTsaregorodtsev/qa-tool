import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Spinner from '../shared/Spinner.jsx';
import ConfirmModal from '../shared/ConfirmModal.jsx';

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 2h4a1 1 0 0 1 1 1H5a1 1 0 0 1 1-1Z" fill="currentColor"/>
      <path d="M2 4h12v1H3l.8 9.06A1 1 0 0 0 4.8 15h6.4a1 1 0 0 0 .997-.94L13 5h1v-1H2v1Zm2.2 1h7.6l-.72 8H4.92L4.2 6Z" fill="currentColor"/>
    </svg>
  );
}

const styles = {
  page: {
    padding: '24px',
    height: '100%',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1A1D23',
    marginBottom: '20px',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 360px) minmax(360px, 1fr)',
    gap: '16px',
    alignItems: 'start',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    padding: '16px',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  button: {
    padding: '7px 14px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#0066FF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  mutedButton: {
    padding: '7px 14px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#F1F5F9',
    color: '#334155',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  listItem: {
    padding: '10px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    cursor: 'pointer',
    background: '#FFFFFF',
    position: 'relative',
  },
  listItemActive: {
    padding: '10px',
    border: '1px solid #0066FF55',
    borderRadius: '6px',
    cursor: 'pointer',
    background: '#EFF6FF',
    position: 'relative',
  },
  deleteBtn: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    padding: '0',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#94A3B8',
    lineHeight: 1,
  },
  deleteBtnHover: {
    background: '#FEE2E2',
    border: '1px solid #FCA5A5',
    color: '#DC2626',
  },
  deleteBtnDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
    pointerEvents: 'none',
  },
  cancelButton: {
    padding: '7px 14px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#FFFFFF',
    color: '#DC2626',
    border: '1px solid #DC2626',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  cancelButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  deleteError: {
    marginTop: '4px',
    fontSize: '11px',
    color: '#DC2626',
  },
  rowTitle: {
    color: '#1A1D23',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '4px',
  },
  text: {
    color: '#64748B',
    fontSize: '12px',
    lineHeight: 1.45,
  },
  message: {
    padding: '10px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    marginTop: '10px',
  },
  error: {
    background: '#EF444415',
    border: '1px solid #EF444440',
    color: '#DC2626',
  },
  empty: {
    color: '#94A3B8',
    fontSize: '13px',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '10px',
    marginBottom: '16px',
  },
  metaItem: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    padding: '10px',
  },
  label: {
    display: 'block',
    color: '#94A3B8',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
  },
  value: {
    color: '#1A1D23',
    fontSize: '13px',
    overflowWrap: 'anywhere',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '8px',
    borderBottom: '1px solid #E2E8F0',
    color: '#64748B',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  td: {
    padding: '8px',
    borderBottom: '1px solid #F1F5F9',
    color: '#1A1D23',
    verticalAlign: 'top',
    overflowWrap: 'anywhere',
  },
  tdIndex: {
    padding: '8px',
    borderBottom: '1px solid #F1F5F9',
    color: '#1A1D23',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
    width: '1%',
  },
};

function parseError(res, fallback) {
  return res.text().then((text) => {
    try {
      const data = JSON.parse(text);
      throw new Error(data.detail || fallback);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(text || fallback);
      }
      throw err;
    }
  });
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function shortId(value) {
  if (!value) return '—';
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

export default function RunProgressScreen() {
  const [status, setStatus] = useState('loading');
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState(null);
  const [deleteErrors, setDeleteErrors] = useState({});
  const [hoveredDeleteId, setHoveredDeleteId] = useState(null);
  const [pendingDeleteRunId, setPendingDeleteRunId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const selectedRun = useMemo(
    () => runs.find((run) => run.run_id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  );

  const loadRuns = useCallback(() => {
    setStatus((current) => (current === 'loaded' ? 'refreshing' : 'loading'));
    setErrorMsg('');
    return fetch('/api/runs')
      .then((res) => {
        if (!res.ok) return parseError(res, 'Failed to load runs.');
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.runs ?? []);
        setRuns(list);
        setStatus(list.length ? 'loaded' : 'empty');
        if (selectedRunId && !list.some((run) => run.run_id === selectedRunId)) {
          setSelectedRunId('');
        }
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.message || 'Failed to load runs.');
      });
  }, [selectedRunId]);

  const cancelRun = useCallback((runId) => {
    setCancelling(true);
    setCancelError('');
    fetch(`/api/runs/${runId}/cancel`, { method: 'PATCH' })
      .then((res) => {
        if (!res.ok) return parseError(res, `Cancel failed (${res.status})`);
        return undefined;
      })
      .then(() => loadRuns())
      .catch((err) => {
        setCancelError(err.message || 'Cancel failed');
      })
      .finally(() => {
        setCancelling(false);
      });
  }, [loadRuns]);

  const deleteRun = useCallback((runId) => {
    setPendingDeleteRunId(null);
    setDeletingRunId(runId);
    setDeleteErrors((prev) => { const next = { ...prev }; delete next[runId]; return next; });
    fetch(`/api/runs/${runId}`, { method: 'DELETE' })
      .then((res) => {
        if (res.status === 204) {
          setRuns((prev) => prev.filter((r) => r.run_id !== runId));
          setSelectedRunId((prev) => (prev === runId ? '' : prev));
        } else if (res.status === 409) {
          setDeleteErrors((prev) => ({ ...prev, [runId]: 'Cannot delete a running run' }));
        } else {
          return parseError(res, `Delete failed (${res.status})`).catch((err) => {
            setDeleteErrors((prev) => ({ ...prev, [runId]: err.message }));
          });
        }
        return undefined;
      })
      .catch((err) => {
        setDeleteErrors((prev) => ({ ...prev, [runId]: err.message || 'Delete failed' }));
      })
      .finally(() => {
        setDeletingRunId(null);
      });
  }, []);

  useEffect(() => {
    setCancelError('');
  }, [selectedRunId]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(loadRuns, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadRuns]);

  return (
    <div style={styles.page}>
      <div style={styles.title}>Run Progress</div>
      <div style={styles.layout}>
        <section style={styles.card}>
          <div style={styles.toolbar}>
            <button type="button" style={styles.button} onClick={loadRuns}>Refresh</button>
            {(status === 'loading' || status === 'refreshing') && <Spinner size={18} />}
          </div>
          <label style={{ ...styles.text, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
            Auto-refresh every 5s
          </label>
          {errorMsg && <div style={{ ...styles.message, ...styles.error }}>{errorMsg}</div>}
          {status === 'empty' && <div style={styles.empty}>No runs yet. Start one from New Run.</div>}
          <div style={styles.list}>
            {runs.map((run) => {
              const isActive = selectedRun?.run_id === run.run_id;
              const isRunning = run.status === 'running';
              const isDeleting = deletingRunId === run.run_id;
              const isHovered = hoveredDeleteId === run.run_id;
              const deleteError = deleteErrors[run.run_id];
              const deleteBtnStyle = {
                ...styles.deleteBtn,
                ...(isRunning || isDeleting ? styles.deleteBtnDisabled : {}),
                ...(isHovered && !isRunning && !isDeleting ? styles.deleteBtnHover : {}),
              };
              return (
                <div
                  key={run.run_id}
                  style={isActive ? styles.listItemActive : styles.listItem}
                  onClick={() => setSelectedRunId(run.run_id)}
                >
                  <div style={{ paddingRight: '28px' }}>
                    <div style={styles.rowTitle}>{run.jira_task_id || shortId(run.run_id)}</div>
                    <div style={styles.text}>{run.status} · {run.servers_count} server(s)</div>
                    <div style={styles.text}>{formatDate(run.created_at)}</div>
                    {deleteError && <div style={styles.deleteError}>{deleteError}</div>}
                  </div>
                  <button
                    type="button"
                    title={isRunning ? 'Cannot delete a running run' : 'Delete run'}
                    disabled={isRunning || isDeleting}
                    style={deleteBtnStyle}
                    onClick={(e) => { e.stopPropagation(); setPendingDeleteRunId(run.run_id); }}
                    onMouseEnter={() => setHoveredDeleteId(run.run_id)}
                    onMouseLeave={() => setHoveredDeleteId(null)}
                  >
                    {isDeleting ? <Spinner size={11} /> : <TrashIcon />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section style={styles.card}>
          {!selectedRun ? (
            <div style={styles.empty}>Select a run to view status and logs.</div>
          ) : (
            <>
              <div style={styles.metaGrid}>
                <div style={styles.metaItem}><span style={styles.label}>Run ID</span><span style={styles.value}>{selectedRun.run_id}</span></div>
                <div style={styles.metaItem}><span style={styles.label}>Status</span><span style={styles.value}>{selectedRun.status}</span></div>
                <div style={styles.metaItem}><span style={styles.label}>Jira</span><span style={styles.value}>{selectedRun.jira_task_id || '—'}</span></div>
                <div style={styles.metaItem}><span style={styles.label}>Region</span><span style={styles.value}>{selectedRun.region_id}</span></div>
                <div style={styles.metaItem}><span style={styles.label}>Flavor</span><span style={styles.value}>{selectedRun.flavor_id}</span></div>
                <div style={styles.metaItem}><span style={styles.label}>Image ID</span><span style={styles.value}>{selectedRun.image_id || '—'}</span></div>
                <div style={styles.metaItem}><span style={styles.label}>Updated</span><span style={styles.value}>{formatDate(selectedRun.updated_at)}</span></div>
              </div>
              {selectedRun.status === 'running' && (
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    disabled={cancelling}
                    style={{ ...styles.cancelButton, ...(cancelling ? styles.cancelButtonDisabled : {}) }}
                    onClick={() => cancelRun(selectedRun.run_id)}
                  >
                    {cancelling ? <Spinner size={13} /> : 'Cancel Run'}
                  </button>
                  {cancelError && <span style={{ fontSize: '12px', color: '#DC2626' }}>{cancelError}</span>}
                </div>
              )}
              {selectedRun.error && <div style={{ ...styles.message, ...styles.error }}>{selectedRun.error}</div>}
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, whiteSpace: 'nowrap', width: '1%' }}>#</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Task</th>
                    <th style={styles.th}>Instance</th>
                    <th style={styles.th}>IP</th>
                    <th style={styles.th}>Log / error</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedRun.servers ?? []).map((server) => (
                    <tr key={server.index}>
                      <td style={styles.tdIndex}>{server.index}</td>
                      <td style={styles.td}>{server.status}</td>
                      <td style={styles.td}>{server.name || '—'}</td>
                      <td style={styles.td}>{server.task_id || '—'}</td>
                      <td style={styles.td}>{server.instance_id || '—'}</td>
                      <td style={styles.td}>{server.ip_address || '—'}</td>
                      <td style={styles.td}>{server.error || 'No error reported'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>

      {(() => {
        const run = runs.find((r) => r.run_id === pendingDeleteRunId);
        const label = run ? (run.jira_task_id || shortId(run.run_id)) : '';
        return (
          <ConfirmModal
            isOpen={pendingDeleteRunId !== null}
            title="Delete Run"
            message={`Delete run "${label}"? This cannot be undone.`}
            confirmLabel="Delete"
            danger
            onConfirm={() => deleteRun(pendingDeleteRunId)}
            onCancel={() => setPendingDeleteRunId(null)}
          />
        );
      })()}
    </div>
  );
}
