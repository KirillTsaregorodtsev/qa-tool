import React, { useCallback, useEffect, useState } from 'react';
import Spinner from '../shared/Spinner.jsx';
import ConfirmModal from '../shared/ConfirmModal.jsx';
import ReportPreviewModal from '../shared/ReportPreviewModal.jsx';

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
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    padding: '16px',
    maxWidth: '980px',
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
  downloadButton: {
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '500',
    background: 'transparent',
    color: '#0066FF',
    border: '1px solid #0066FF',
    borderRadius: '4px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  viewButton: {
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '500',
    background: 'transparent',
    color: '#475569',
    border: '1px solid #94A3B8',
    borderRadius: '4px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  deleteButton: {
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '500',
    background: 'transparent',
    color: '#DC2626',
    border: '1px solid #FCA5A5',
    borderRadius: '4px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  actionsCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
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
    verticalAlign: 'middle',
    overflowWrap: 'anywhere',
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
};

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export default function ReportsScreen() {
  const [status, setStatus] = useState('loading');
  const [reports, setReports] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingDeleteFile, setPendingDeleteFile] = useState(null);
  const [deletingFile, setDeletingFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);

  const loadReports = useCallback(() => {
    setStatus('loading');
    setErrorMsg('');
    fetch('/api/reports')
      .then((res) => {
        if (!res.ok) return res.text().then((t) => { throw new Error(t || 'Failed to load reports.'); });
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.reports ?? []);
        setReports(list);
        setStatus(list.length ? 'loaded' : 'empty');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.message || 'Failed to load reports.');
      });
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  function handleDownload(filename) {
    window.open(`/api/reports/${encodeURIComponent(filename)}/download`, '_blank');
  }

  function handleDelete(filename) {
    setPendingDeleteFile(null);
    setDeletingFile(filename);
    fetch(`/api/reports/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      .then((res) => {
        if (res.status === 204) {
          setReports((prev) => prev.filter((r) => r.filename !== filename));
        } else {
          return res.text().then((t) => { throw new Error(t || `Delete failed (${res.status})`); });
        }
        return undefined;
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Delete failed.');
      })
      .finally(() => setDeletingFile(null));
  }

  return (
    <div style={styles.page}>
      <div style={styles.title}>Reports</div>
      <div style={styles.subtitle}>
        CSV reports generated after each completed or failed run. Stored under the mounted reports volume.
      </div>
      <section style={styles.card}>
        <div style={styles.toolbar}>
          <button type="button" style={styles.button} onClick={loadReports}>Refresh</button>
          {status === 'loading' && <Spinner size={18} />}
        </div>

        {status === 'error' && (
          <div style={{ ...styles.message, ...styles.error }}>{errorMsg}</div>
        )}
        {(status === 'empty' || (status === 'loaded' && reports.length === 0)) && (
          <div style={styles.empty}>No reports yet. Reports are created automatically when a run finishes.</div>
        )}
        {status === 'loaded' && reports.length > 0 && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Filename</th>
                <th style={styles.th}>Size</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.filename}>
                  <td style={styles.td}>{r.filename}</td>
                  <td style={styles.td}>{formatBytes(r.size_bytes)}</td>
                  <td style={styles.td}>{formatDate(r.created_at)}</td>
                  <td style={styles.td}>
                    <div style={styles.actionsCell}>
                      <button type="button" style={styles.viewButton} onClick={() => setPreviewFile(r.filename)}>
                        View
                      </button>
                      <button type="button" style={styles.downloadButton} onClick={() => handleDownload(r.filename)}>
                        Download
                      </button>
                      <button
                        type="button"
                        style={{ ...styles.deleteButton, ...(deletingFile === r.filename ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                        disabled={deletingFile === r.filename}
                        onClick={() => setPendingDeleteFile(r.filename)}
                      >
                        {deletingFile === r.filename ? <Spinner size={11} /> : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ConfirmModal
        isOpen={pendingDeleteFile !== null}
        title="Delete Report"
        message={`Delete "${pendingDeleteFile}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => handleDelete(pendingDeleteFile)}
        onCancel={() => setPendingDeleteFile(null)}
      />

      <ReportPreviewModal
        isOpen={previewFile !== null}
        filename={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
