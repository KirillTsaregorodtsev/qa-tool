import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Spinner from '../shared/Spinner.jsx';
import EmptyState from '../shared/EmptyState.jsx';

const styles = {
  page: {
    padding: '24px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    flexShrink: 0,
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1A1D23',
  },
  searchInput: {
    padding: '7px 12px',
    fontSize: '13px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    background: '#FFFFFF',
    color: '#1A1D23',
    width: '220px',
    outline: 'none',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    overflow: 'hidden',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  tableWrapper: {
    overflow: 'auto',
    flex: 1,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    position: 'sticky',
    top: 0,
    background: '#FFFFFF',
    padding: '10px 16px',
    textAlign: 'left',
    fontWeight: '600',
    fontSize: '11px',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #E2E8F0',
    whiteSpace: 'nowrap',
    zIndex: 1,
    userSelect: 'none',
    cursor: 'pointer',
  },
  thNum: {
    position: 'sticky',
    top: 0,
    background: '#FFFFFF',
    padding: '10px 16px',
    textAlign: 'right',
    fontWeight: '600',
    fontSize: '11px',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #E2E8F0',
    whiteSpace: 'nowrap',
    zIndex: 1,
    width: '48px',
  },
  td: {
    padding: '10px 16px',
    borderBottom: '1px solid #E2E8F0',
    color: '#1A1D23',
    verticalAlign: 'middle',
  },
  tdMono: {
    padding: '10px 16px',
    borderBottom: '1px solid #E2E8F0',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '12px',
    color: '#1A1D23',
    verticalAlign: 'middle',
    cursor: 'pointer',
    position: 'relative',
    whiteSpace: 'nowrap',
  },
  tdNum: {
    padding: '10px 16px',
    borderBottom: '1px solid #E2E8F0',
    color: '#94A3B8',
    verticalAlign: 'middle',
    width: '48px',
    textAlign: 'right',
    fontSize: '12px',
  },
  tooltip: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#1A1D23',
    color: '#FFFFFF',
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '4px',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    zIndex: 10,
  },
  loadingCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '48px',
  },
  retryButton: {
    padding: '7px 16px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#0066FF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  count: {
    fontSize: '12px',
    color: '#94A3B8',
  },
};

// Sort indicator — shows active direction or neutral dots when inactive
function SortIcon({ active, direction }) {
  if (active) {
    return (
      <span style={{ marginLeft: '4px', display: 'inline-block', lineHeight: 1 }}>
        {direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  }
  return (
    <span style={{ marginLeft: '4px', display: 'inline-block', lineHeight: 1, opacity: 0.3 }}>
      ↕
    </span>
  );
}

function SortableTh({ label, colKey, sortCol, sortDir, onSort, style }) {
  const active = sortCol === colKey;
  return (
    <th
      style={{ ...styles.th, ...style }}
      onClick={() => onSort(colKey)}
    >
      {label}
      <SortIcon active={active} direction={sortDir} />
    </th>
  );
}

function CopyableCell({ value, isLast }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tdStyle = isLast ? { ...styles.tdMono, borderBottom: 'none' } : styles.tdMono;

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 1500);
    });
  }

  return (
    <td style={tdStyle} onClick={handleCopy} title="Click to copy">
      {value}
      {showTooltip && <span style={styles.tooltip}>Copied!</span>}
    </td>
  );
}

function RegionRow({ index, region, isLast }) {
  const [hovered, setHovered] = useState(false);

  const tdStyle = isLast ? { ...styles.td, borderBottom: 'none' } : styles.td;
  const tdNumStyle = isLast ? { ...styles.tdNum, borderBottom: 'none' } : styles.tdNum;

  return (
    <tr
      style={{ background: hovered ? '#F8F9FA' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={tdNumStyle}>{index}</td>
      <CopyableCell value={String(region.id)} isLast={isLast} />
      <td style={tdStyle}>{region.display_name || region.name || '—'}</td>
      <td style={{ ...tdStyle, color: region.keystone_name ? '#1A1D23' : '#CBD5E1' }}>
        {region.keystone_name || '—'}
      </td>
    </tr>
  );
}

function sortRegions(list, col, dir) {
  return [...list].sort((a, b) => {
    let av, bv;
    if (col === 'id') {
      av = a.id;
      bv = b.id;
    } else if (col === 'display_name') {
      av = (a.display_name || a.name || '').toLowerCase();
      bv = (b.display_name || b.name || '').toLowerCase();
    } else if (col === 'keystone_name') {
      av = (a.keystone_name || '').toLowerCase();
      bv = (b.keystone_name || '').toLowerCase();
    } else {
      return 0;
    }
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

export default function RegionsScreen() {
  const [status, setStatus] = useState('loading');
  const [regions, setRegions] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('id');
  const [sortDir, setSortDir] = useState('asc');

  const fetchRegions = useCallback(() => {
    setStatus('loading');
    setErrorMsg('');

    fetch('/api/regions')
      .then((res) => {
        if (!res.ok) {
          return res.text().then((text) => {
            throw new Error(`Server error ${res.status}: ${text || res.statusText}`);
          });
        }
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.regions ?? data.results ?? []);
        if (list.length === 0) {
          setStatus('empty');
        } else {
          setRegions(list);
          setStatus('loaded');
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Failed to load regions.');
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const displayed = useMemo(() => {
    const filtered = regions.filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        String(r.id).includes(q) ||
        (r.display_name || r.name || '').toLowerCase().includes(q) ||
        (r.keystone_name || '').toLowerCase().includes(q)
      );
    });
    return sortRegions(filtered, sortCol, sortDir);
  }, [regions, search, sortCol, sortDir]);

  const sortProps = { sortCol, sortDir, onSort: handleSort };

  if (status === 'loading') {
    return (
      <div style={styles.page}>
        <div style={styles.header}><span style={styles.title}>Regions</span></div>
        <div style={{ ...styles.card, ...styles.loadingCenter }}><Spinner size={32} /></div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={styles.page}>
        <div style={styles.header}><span style={styles.title}>Regions</span></div>
        <div style={{ ...styles.card, ...styles.loadingCenter }}>
          <EmptyState message={errorMsg || 'Failed to load regions.'}>
            <button style={styles.retryButton} onClick={fetchRegions}>Retry</button>
          </EmptyState>
        </div>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div style={styles.page}>
        <div style={styles.header}><span style={styles.title}>Regions</span></div>
        <div style={{ ...styles.card, ...styles.loadingCenter }}>
          <EmptyState message="No regions available." />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={styles.title}>Regions</span>
          <span style={styles.count}>
            {displayed.length === regions.length
              ? `${regions.length} total`
              : `${displayed.length} of ${regions.length}`}
          </span>
        </div>
        <input
          type="text"
          placeholder="Filter by name, ID, keystone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.card}>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.thNum}>#</th>
                <SortableTh label="Region ID" colKey="id" {...sortProps} />
                <SortableTh label="Name" colKey="display_name" {...sortProps} />
                <SortableTh label="Keystone Name" colKey="keystone_name" {...sortProps} />
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...styles.td, textAlign: 'center', color: '#94A3B8', borderBottom: 'none' }}>
                    No results match your filter.
                  </td>
                </tr>
              ) : (
                displayed.map((region, i) => (
                  <RegionRow
                    key={region.id}
                    index={i + 1}
                    region={region}
                    isLast={i === displayed.length - 1}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
