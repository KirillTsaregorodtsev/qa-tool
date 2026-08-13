import React, { useState, useEffect, useCallback } from 'react';
import Spinner from '../shared/Spinner.jsx';
import Badge from '../shared/Badge.jsx';

const styles = {
  page: {
    padding: '24px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1A1D23',
    marginBottom: '20px',
    flexShrink: 0,
  },
  formCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    padding: '16px 20px',
    flexShrink: 0,
  },
  formRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '16px',
    flexWrap: 'wrap',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  label: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  select: {
    padding: '7px 12px',
    fontSize: '13px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    background: '#FFFFFF',
    color: '#1A1D23',
    width: '220px',
    outline: 'none',
    cursor: 'pointer',
  },
  selectDisabled: {
    padding: '7px 12px',
    fontSize: '13px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    background: '#F8F9FA',
    color: '#94A3B8',
    width: '220px',
    outline: 'none',
    cursor: 'not-allowed',
  },
  numberInput: {
    padding: '7px 12px',
    fontSize: '13px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    background: '#FFFFFF',
    color: '#1A1D23',
    width: '80px',
    outline: 'none',
  },
  numberInputDisabled: {
    padding: '7px 12px',
    fontSize: '13px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    background: '#F8F9FA',
    color: '#94A3B8',
    width: '80px',
    outline: 'none',
    cursor: 'not-allowed',
  },
  checkButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 18px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#0066FF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    flexShrink: 0,
    height: '34px',
  },
  checkButtonDisabled: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 18px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#94A3B8',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'not-allowed',
    flexShrink: 0,
    height: '34px',
  },
  inlineError: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#DC2626',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  retryLink: {
    color: '#0066FF',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: '12px',
    background: 'none',
    border: 'none',
    padding: '0',
  },
  errorBanner: {
    marginTop: '12px',
    padding: '10px 14px',
    background: '#EF444415',
    border: '1px solid #EF444440',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#DC2626',
    flexShrink: 0,
  },
  resultsCard: {
    marginTop: '16px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    overflow: 'hidden',
    flexShrink: 0,
  },
  quotaRow: {
    display: 'grid',
    gridTemplateColumns: '180px 1fr 72px 100px 72px',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 20px',
    borderBottom: '1px solid #E2E8F0',
  },
  quotaRowLast: {
    display: 'grid',
    gridTemplateColumns: '180px 1fr 72px 100px 72px',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 20px',
  },
  quotaLabel: {
    fontSize: '13px',
    color: '#1A1D23',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  progressTrack: {
    height: '6px',
    borderRadius: '3px',
    background: '#E2E8F0',
    overflow: 'hidden',
  },
  usageText: {
    fontSize: '12px',
    color: '#64748B',
    whiteSpace: 'nowrap',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '180px 1fr 72px 100px 72px',
    alignItems: 'center',
    gap: '16px',
    padding: '9px 20px',
    borderBottom: '1px solid #E2E8F0',
    background: '#FFFFFF',
  },
  th: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  thRight: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    textAlign: 'right',
  },
  banner: {
    padding: '12px 20px',
    fontSize: '13px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  proceedButton: {
    marginTop: '12px',
    padding: '7px 16px',
    fontSize: '13px',
    fontWeight: '500',
    background: 'transparent',
    color: '#0066FF',
    border: '1px solid #0066FF',
    borderRadius: '6px',
    cursor: 'pointer',
    flexShrink: 0,
  },
};

function regionLabel(r) {
  const parts = [];
  const name = r.display_name || r.name;
  if (name) parts.push(name);
  if (r.keystone_name) parts.push(r.keystone_name);
  parts.push(r.id);
  return parts.join(' · ');
}

function ProgressBar({ usage, limit }) {
  const pct = limit > 0 ? Math.min((usage / limit) * 100, 100) : 0;
  const isHigh = pct >= 80;

  return (
    <div style={styles.progressTrack}>
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: '3px',
          background: isHigh ? '#F59E0B' : '#0066FF',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

function QuotaRow({ quota, isLast }) {
  const rowStyle = isLast ? styles.quotaRowLast : styles.quotaRow;
  const headroomLabel = quota.headroom > 0 ? `+${quota.headroom} available` : '0 available';
  const headroomStatus = quota.sufficient ? 'success' : 'error';
  const sufficientStatus = quota.sufficient ? 'success' : 'error';
  const sufficientLabel = quota.sufficient ? 'OK' : 'Insufficient';

  return (
    <div style={rowStyle}>
      <span style={styles.quotaLabel}>{quota.label}</span>
      <ProgressBar usage={quota.usage} limit={quota.limit} />
      <span style={styles.usageText}>{quota.usage} / {quota.limit}</span>
      <Badge status={headroomStatus} label={headroomLabel} />
      <Badge status={sufficientStatus} label={sufficientLabel} />
    </div>
  );
}

export default function QuotasScreen({ onNavigate }) {
  // regions state
  const [regionsStatus, setRegionsStatus] = useState('loading'); // loading | error | loaded
  const [regions, setRegions] = useState([]);
  const [regionsError, setRegionsError] = useState('');

  // form state
  const [selectedRegion, setSelectedRegion] = useState('');
  const [serversCount, setServersCount] = useState(1);

  // quota check state
  const [checkStatus, setCheckStatus] = useState('idle'); // idle | loading | error | done
  const [quotaResult, setQuotaResult] = useState(null);
  const [quotaError, setQuotaError] = useState('');

  const fetchRegions = useCallback(() => {
    setRegionsStatus('loading');
    setRegionsError('');

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
        const baremetalOnly = list.filter((r) => r.has_baremetal === true);
        setRegions(baremetalOnly);
        setRegionsStatus('loaded');
      })
      .catch((err) => {
        setRegionsError(err.message || 'Failed to load regions.');
        setRegionsStatus('error');
      });
  }, []);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  function handleCheck() {
    if (!selectedRegion || checkStatus === 'loading') return;

    setCheckStatus('loading');
    setQuotaError('');
    setQuotaResult(null);

    fetch(`/api/quotas?region_id=${selectedRegion}&servers_count=${serversCount}`)
      .then((res) => {
        if (!res.ok) {
          return res.text().then((text) => {
            throw new Error(`Server error ${res.status}: ${text || res.statusText}`);
          });
        }
        return res.json();
      })
      .then((data) => {
        setQuotaResult(data);
        setCheckStatus('done');
      })
      .catch((err) => {
        setQuotaError(err.message || 'Failed to check quotas.');
        setCheckStatus('error');
      });
  }

  const formDisabled = regionsStatus !== 'loaded' || checkStatus === 'loading';
  const checkDisabled = formDisabled || !selectedRegion;

  return (
    <div style={styles.page}>
      <div style={styles.title}>Quotas</div>

      {/* Form card */}
      <div style={styles.formCard}>
        <div style={styles.formRow}>
          {/* Region dropdown */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Region</label>
            {regionsStatus === 'loading' ? (
              <select disabled style={styles.selectDisabled}>
                <option>Loading regions...</option>
              </select>
            ) : (
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                disabled={formDisabled}
                style={formDisabled ? styles.selectDisabled : styles.select}
              >
                <option value="">Select a region</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {regionLabel(r)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Servers count */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Servers</label>
            <input
              type="number"
              min={1}
              value={serversCount}
              onChange={(e) => setServersCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              disabled={formDisabled}
              style={formDisabled ? styles.numberInputDisabled : styles.numberInput}
            />
          </div>

          {/* Check button */}
          <button
            onClick={handleCheck}
            disabled={checkDisabled}
            style={checkDisabled ? styles.checkButtonDisabled : styles.checkButton}
          >
            {checkStatus === 'loading' && <Spinner size={14} color="#FFFFFF" />}
            Check Quotas
          </button>

          {/* Proceed button — only when last result is all-sufficient */}
          {checkStatus === 'done' && quotaResult?.overall_sufficient === true && (
            <button
              style={styles.proceedButton}
              onClick={() => onNavigate && onNavigate('new-run')}
            >
              Proceed to New Run
            </button>
          )}
        </div>

        {/* Inline regions error */}
        {regionsStatus === 'error' && (
          <div style={styles.inlineError}>
            <span>{regionsError || 'Failed to load regions.'}</span>
            <button style={styles.retryLink} onClick={fetchRegions}>Retry</button>
          </div>
        )}
      </div>

      {/* Quota API error banner */}
      {checkStatus === 'error' && (
        <div style={styles.errorBanner}>
          {quotaError || 'Failed to check quotas.'}
        </div>
      )}

      {/* Results card */}
      {checkStatus === 'done' && quotaResult && (
        <div style={styles.resultsCard}>
          {/* Column headers */}
          <div style={styles.tableHeader}>
            <span style={styles.th}>Quota</span>
            <span style={styles.th}>Usage</span>
            <span style={styles.thRight}>Used / Limit</span>
            <span style={styles.th}>Headroom</span>
            <span style={styles.th}>Status</span>
          </div>

          {/* Quota rows */}
          {quotaResult.quotas.map((q, i) => (
            <QuotaRow
              key={q.name}
              quota={q}
              isLast={i === quotaResult.quotas.length - 1}
            />
          ))}

          {/* Overall banner */}
          {quotaResult.overall_sufficient ? (
            <div
              style={{
                ...styles.banner,
                background: '#22C55E15',
                borderTop: '1px solid #22C55E30',
                color: '#16A34A',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#16A34A" strokeWidth="1.5"/>
                <path d="M5 8l2 2 4-4" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Ready to run — all quotas have headroom
            </div>
          ) : (
            <div
              style={{
                ...styles.banner,
                background: '#EF444415',
                borderTop: '1px solid #EF444430',
                color: '#DC2626',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#DC2626" strokeWidth="1.5"/>
                <line x1="8" y1="5" x2="8" y2="9" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11.5" r="0.75" fill="#DC2626"/>
              </svg>
              Quota insufficient — reduce server count or choose a different region
            </div>
          )}
        </div>
      )}
    </div>
  );
}
