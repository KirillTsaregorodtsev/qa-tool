import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Spinner from '../shared/Spinner.jsx';
import ConfirmModal from '../shared/ConfirmModal.jsx';

const CLEANABLE_STATUSES = ['done', 'failed', 'cleaned'];

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
    marginBottom: '8px',
  },
  subtitle: {
    color: '#64748B',
    fontSize: '13px',
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
  deleteButton: {
    padding: '7px 14px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#DC2626',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  deleteButtonDisabled: {
    padding: '7px 14px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#F1F5F9',
    color: '#94A3B8',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    cursor: 'not-allowed',
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
  },
  listItemActive: {
    padding: '10px',
    border: '1px solid #0066FF55',
    borderRadius: '6px',
    cursor: 'pointer',
    background: '#EFF6FF',
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
  success: {
    background: '#22C55E15',
    border: '1px solid #22C55E40',
    color: '#15803D',
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
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    gap: '12px',
  },
  sectionLabel: {
    color: '#64748B',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '10px',
  },
};

const STATUS_COLOR = {
  done: '#15803D',
  failed: '#DC2626',
  cleaned: '#94A3B8',
  running: '#0066FF',
};

function statusBadge(status) {
  const color = STATUS_COLOR[status] ?? '#64748B';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: '600',
        background: `${color}18`,
        color,
        border: `1px solid ${color}40`,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {status}
    </span>
  );
}

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
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function shortId(value) {
  if (!value) return '—';
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

export default function CleanupScreen() {
  const [loadStatus, setLoadStatus] = useState('loading');
  const [runs, setRuns] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Per-run delete state keyed by run_id
  const [deleteState, setDeleteState] = useState({});
  // { [run_id]: { status: 'idle'|'loading'|'success'|'error', message: '' } }

  const filteredRuns = useMemo(
    () => runs.filter((r) => CLEANABLE_STATUSES.includes(r.status)),
    [runs],
  );

  const selectedRun = useMemo(
    () => filteredRuns.find((r) => r.run_id === selectedRunId) ?? filteredRuns[0] ?? null,
    [filteredRuns, selectedRunId],
  );

  const loadRuns = useCallback(() => {
    setLoadStatus((s) => (s === 'loaded' ? 'refreshing' : 'loading'));
    setLoadError('');
    fetch('/api/runs')
      .then((res) => {
        if (!res.ok) return parseError(res, 'Failed to load runs.');
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.runs ?? []);
        setRuns(list);
        const filtered = list.filter((r) => CLEANABLE_STATUSES.includes(r.status));
        setLoadStatus(filtered.length ? 'loaded' : 'empty');
        if (selectedRunId && !filtered.some((r) => r.run_id === selectedRunId)) {
          setSelectedRunId('');
        }
      })
      .catch((err) => {
        setLoadStatus('error');
        setLoadError(err.message || 'Failed to load runs.');
      });
  }, [selectedRunId]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Refresh: if a run is selected, refresh its instance statuses via POST; otherwise reload the full list.
  function handleRefresh() {
    if (!selectedRun) {
      loadRuns();
      return;
    }
    setRefreshing(true);
    fetch(`/api/runs/${selectedRun.run_id}/instances/refresh`, { method: 'POST' })
      .then((res) => {
        if (!res.ok) return parseError(res, 'Failed to refresh instances.');
        return res.json();
      })
      .then((updatedRun) => {
        setRuns((prev) =>
          prev.map((r) => (r.run_id === updatedRun.run_id ? updatedRun : r)),
        );
      })
      .catch((err) => {
        setLoadError(err.message || 'Failed to refresh instances.');
      })
      .finally(() => {
        setRefreshing(false);
      });
  }

  function handleDelete(runId) {
    setConfirmOpen(false);
    setDeleteState((prev) => ({ ...prev, [runId]: { status: 'loading', message: '' } }));
    fetch(`/api/runs/${runId}/instances`, { method: 'DELETE' })
      .then((res) => {
        if (!res.ok) {
          const fallback =
            res.status === 409
              ? 'Run is still running.'
              : res.status === 404
              ? 'Run not found.'
              : res.status === 503
              ? 'Config unavailable. Check settings.'
              : 'Failed to delete instances.';
          return parseError(res, fallback);
        }
        return res.json();
      })
      .then((data) => {
        const msg = `Deleted ${data.deleted}, failed ${data.failed}.`;
        setDeleteState((prev) => ({ ...prev, [runId]: { status: 'success', message: msg } }));
        loadRuns();
      })
      .catch((err) => {
        setDeleteState((prev) => ({
          ...prev,
          [runId]: { status: 'error', message: err.message || 'Failed to delete instances.' },
        }));
      });
  }

  const runDeleteState = selectedRun ? (deleteState[selectedRun.run_id] ?? { status: 'idle', message: '' }) : null;
  const isCleaned = selectedRun?.status === 'cleaned';
  const isDeleting = runDeleteState?.status === 'loading';
  const isRefreshing = refreshing || loadStatus === 'loading' || loadStatus === 'refreshing';

  const servers = selectedRun?.servers ?? [];
  const allDeleted = servers.length > 0 && servers.every((s) => s.status === 'deleted');

  return (
    <div style={styles.page}>
      <ConfirmModal
        isOpen={confirmOpen}
        title="Delete instances"
        message={`Delete all instances for run "${selectedRun?.jira_task_id || shortId(selectedRun?.run_id)}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => selectedRun && handleDelete(selectedRun.run_id)}
        onCancel={() => setConfirmOpen(false)}
      />

      <div style={styles.title}>Cleanup</div>
      <div style={styles.subtitle}>
        Delete BM instances for completed or failed runs. Running runs cannot be cleaned.
      </div>
      <div style={styles.layout}>
        <section style={styles.card}>
          <div style={styles.toolbar}>
            <button type="button" style={styles.button} onClick={handleRefresh} disabled={isRefreshing}>
              Refresh
            </button>
            {isRefreshing && <Spinner size={18} />}
          </div>

          {loadStatus === 'error' && (
            <div style={{ ...styles.message, ...styles.error }}>{loadError}</div>
          )}
          {loadStatus === 'empty' && (
            <div style={styles.empty}>No finished runs to clean up.</div>
          )}

          <div style={styles.list}>
            {filteredRuns.map((run) => (
              <div
                key={run.run_id}
                style={
                  selectedRun?.run_id === run.run_id ? styles.listItemActive : styles.listItem
                }
                onClick={() => setSelectedRunId(run.run_id)}
              >
                <div style={styles.rowTitle}>
                  {run.jira_task_id || shortId(run.run_id)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  {statusBadge(run.status)}
                  <span style={styles.text}>{run.servers_count} server(s)</span>
                </div>
                <div style={styles.text}>{formatDate(run.created_at)}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          {!selectedRun ? (
            <div style={styles.empty}>Select a run to view instances and delete them.</div>
          ) : (
            <>
              <div style={styles.detailHeader}>
                <div>
                  <div style={{ ...styles.rowTitle, marginBottom: '4px' }}>
                    {selectedRun.jira_task_id || shortId(selectedRun.run_id)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {statusBadge(selectedRun.status)}
                  </div>
                </div>

                {isCleaned ? (
                  <button type="button" style={styles.deleteButtonDisabled} disabled>
                    Already cleaned
                  </button>
                ) : allDeleted ? (
                  <button type="button" style={styles.deleteButtonDisabled} disabled>
                    All instances deleted
                  </button>
                ) : (
                  <button
                    type="button"
                    style={{
                      ...styles.deleteButton,
                      ...(isDeleting ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
                    }}
                    onClick={() => !isDeleting && setConfirmOpen(true)}
                    disabled={isDeleting}
                  >
                    {isDeleting && <Spinner size={14} color="#FFFFFF" />}
                    {isDeleting ? 'Deleting…' : 'Delete Instances'}
                  </button>
                )}
              </div>

              {runDeleteState?.status === 'success' && (
                <div style={{ ...styles.message, ...styles.success }}>
                  {runDeleteState.message}
                </div>
              )}
              {runDeleteState?.status === 'error' && (
                <div style={{ ...styles.message, ...styles.error }}>
                  {runDeleteState.message}
                </div>
              )}

              <div style={styles.metaGrid}>
                <div style={styles.metaItem}>
                  <span style={styles.label}>Run ID</span>
                  <span style={styles.value}>{selectedRun.run_id}</span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.label}>Region</span>
                  <span style={styles.value}>{selectedRun.region_id ?? '—'}</span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.label}>Flavor</span>
                  <span style={styles.value}>{selectedRun.flavor_id ?? '—'}</span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.label}>Created</span>
                  <span style={styles.value}>{formatDate(selectedRun.created_at)}</span>
                </div>
              </div>

              <div style={styles.sectionLabel}>Servers</div>
              {servers.length === 0 ? (
                <div style={styles.empty}>No server data available.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>#</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Instance ID</th>
                      <th style={styles.th}>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servers.map((server) => {
                      const isDeleted = server.status === 'deleted';
                      const tdDeleted = isDeleted
                        ? { ...styles.td, color: '#94A3B8' }
                        : styles.td;
                      const strikethrough = isDeleted
                        ? { textDecoration: 'line-through' }
                        : {};
                      return (
                        <tr key={server.index}>
                          <td style={tdDeleted}>{server.index}</td>
                          <td style={tdDeleted}>{statusBadge(server.status)}</td>
                          <td style={{ ...tdDeleted, ...strikethrough }}>
                            {server.instance_id || '—'}
                          </td>
                          <td style={{ ...tdDeleted, ...strikethrough }}>
                            {server.ip_address || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
