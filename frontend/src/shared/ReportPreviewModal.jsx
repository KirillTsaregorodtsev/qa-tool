import React, { useEffect, useState } from 'react';
import Spinner from './Spinner.jsx';

// Minimal CSV parser that handles quoted fields (including quoted newlines).
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // Peek ahead for escaped quote
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i += 1;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        i += 1;
      } else if (ch === '\r' && text[i + 1] === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i += 2;
      } else if (ch === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i += 1;
      } else {
        field += ch;
        i += 1;
      }
    }
  }

  // Flush last field/row
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop trailing empty row (common when file ends with newline)
  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }

  return rows;
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '32px 16px',
    overflowY: 'auto',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    width: '100%',
    minWidth: '80vw',
    maxWidth: '1200px',
    boxShadow: '0 8px 32px rgba(15, 23, 42, 0.15)',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #E2E8F0',
    flexShrink: 0,
  },
  title: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1A1D23',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginRight: '12px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#64748B',
    fontSize: '20px',
    lineHeight: 1,
    padding: '2px 6px',
    borderRadius: '4px',
    flexShrink: 0,
  },
  body: {
    padding: '16px 20px',
    overflowX: 'auto',
    flexGrow: 1,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '12px 20px',
    borderTop: '1px solid #E2E8F0',
    flexShrink: 0,
  },
  closeFooterBtn: {
    padding: '7px 20px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#F1F5F9',
    color: '#334155',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  spinnerWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 0',
  },
  errorMsg: {
    padding: '12px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    background: '#EF444415',
    border: '1px solid #EF444440',
    color: '#DC2626',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
    tableLayout: 'auto',
  },
  th: {
    textAlign: 'left',
    padding: '7px 10px',
    borderBottom: '2px solid #E2E8F0',
    color: '#64748B',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    background: '#F8FAFC',
  },
  td: {
    padding: '6px 10px',
    borderBottom: '1px solid #F1F5F9',
    color: '#1A1D23',
    verticalAlign: 'top',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  rowEven: {
    background: '#FAFBFC',
  },
};

export default function ReportPreviewModal({ isOpen, filename, onClose }) {
  const [state, setState] = useState('idle'); // idle | loading | error | loaded
  const [rows, setRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen || !filename) return;

    setState('loading');
    setRows([]);
    setErrorMsg('');

    fetch(`/api/reports/${encodeURIComponent(filename)}/download`)
      .then((res) => {
        if (!res.ok) return res.text().then((t) => { throw new Error(t || `HTTP ${res.status}`); });
        return res.text();
      })
      .then((text) => {
        const parsed = parseCSV(text);
        setRows(parsed);
        setState('loaded');
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Failed to load report.');
        setState('error');
      });
  }, [isOpen, filename]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.title}>{filename}</div>
          <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div style={styles.body}>
          {state === 'loading' && (
            <div style={styles.spinnerWrap}>
              <Spinner size={24} />
            </div>
          )}
          {state === 'error' && (
            <div style={styles.errorMsg}>{errorMsg}</div>
          )}
          {state === 'loaded' && rows.length === 0 && (
            <div style={{ color: '#94A3B8', fontSize: '13px' }}>Report is empty.</div>
          )}
          {state === 'loaded' && rows.length > 0 && (
            <table style={styles.table}>
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, ri) => (
                  <tr key={ri} style={ri % 2 === 1 ? styles.rowEven : undefined}>
                    {headers.map((_, ci) => (
                      <td key={ci} style={styles.td}>{row[ci] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={styles.footer}>
          <button type="button" style={styles.closeFooterBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
