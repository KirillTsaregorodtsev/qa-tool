import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Spinner from '../shared/Spinner.jsx';

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
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    padding: '20px',
    maxWidth: '760px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
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
    outline: 'none',
    minHeight: '34px',
  },
  selectDisabled: {
    padding: '7px 12px',
    fontSize: '13px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    background: '#F8F9FA',
    color: '#94A3B8',
    outline: 'none',
    minHeight: '34px',
    cursor: 'not-allowed',
  },
  numberInput: {
    padding: '7px 12px',
    fontSize: '13px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    background: '#FFFFFF',
    color: '#1A1D23',
    outline: 'none',
    minHeight: '18px',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '20px',
  },
  startButton: {
    padding: '7px 18px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#0066FF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    height: '34px',
  },
  startButtonDisabled: {
    padding: '7px 18px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#94A3B8',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'not-allowed',
    height: '34px',
  },
  message: {
    marginTop: '14px',
    padding: '10px 14px',
    borderRadius: '6px',
    fontSize: '13px',
  },
  error: {
    background: '#EF444415',
    border: '1px solid #EF444440',
    color: '#DC2626',
  },
  info: {
    background: '#3B82F615',
    border: '1px solid #3B82F640',
    color: '#2563EB',
  },
  projectBanner: {
    marginBottom: '16px',
    padding: '10px 14px',
    background: '#F8F9FA',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#1A1D23',
  },
  projectMuted: {
    color: '#64748B',
  },
  hint: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#64748B',
  },
  imageBlock: {
    marginTop: '16px',
    padding: '10px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
  },
  imageWarning: {
    marginTop: '16px',
    padding: '10px 14px',
    background: '#FFF7ED',
    border: '1px solid #FDBA7440',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#C2410C',
  },
  imageSub: {
    fontSize: '11px',
    color: '#64748B',
    marginTop: '2px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '10px',
    fontSize: '13px',
    color: '#1A1D23',
    userSelect: 'none',
  },
  checkbox: {
    width: '14px',
    height: '14px',
    margin: 0,
  },
  refreshBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 4px',
    color: '#64748B',
    lineHeight: 1,
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
  },
};

function parseError(res, fallback) {
  return res.text().then((text) => {
    try {
      const data = JSON.parse(text);
      let message;
      if (Array.isArray(data.detail)) {
        message = data.detail.map((item) => item.msg || JSON.stringify(item)).join('; ') || fallback;
      } else {
        message = data.detail || fallback;
      }
      throw new Error(message);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(text || fallback);
      }
      throw err;
    }
  });
}

function regionLabel(r) {
  const parts = [];
  const name = r.display_name || r.name;
  if (name) parts.push(name);
  if (r.keystone_name) parts.push(r.keystone_name);
  parts.push(r.id);
  return parts.join(' · ');
}

function formatFlavor(flavor) {
  const details = [
    flavor.vcpus ? `${flavor.vcpus} CPU` : null,
    flavor.ram ? `${flavor.ram} RAM` : null,
    flavor.disk ? `${flavor.disk} disk` : null,
    flavor.capacity !== null && flavor.capacity !== undefined ? `capacity ${flavor.capacity}` : null,
  ].filter(Boolean);
  const label = details.length ? `${flavor.name} (${details.join(', ')})` : flavor.name;
  return label;
}

export default function NewRunScreen({ onNavigate }) {
  const [regionsStatus, setRegionsStatus] = useState('loading');
  const [regions, setRegions] = useState([]);
  const [flavorsStatus, setFlavorsStatus] = useState('idle');
  const [flavors, setFlavors] = useState([]);
  const [regionId, setRegionId] = useState('');
  const [flavorId, setFlavorId] = useState('');
  const [serversCount, setServersCount] = useState(1);
  const [jiraTicketId, setJiraTicketId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitPhase, setSubmitPhase] = useState(''); // '' | 'defaults' | 'run'
  const [runResult, setRunResult] = useState(null); // { run_id, status, ... } on success
  const [showUnavailableFlavors, setShowUnavailableFlavors] = useState(false);
  const [project, setProject] = useState({ project_id: null, project_name: null });
  const [images, setImages] = useState([]);
  const [imagesStatus, setImagesStatus] = useState('idle'); // 'idle' | 'loading' | 'loaded' | 'error'
  const [imagesError, setImagesError] = useState('');
  const [imageName, setImageName] = useState('');
  const [imageId, setImageId] = useState(null);

  const selectedRegionId = regionId ? Number(regionId) : null;

  const selectedFlavorExists = useMemo(
    () => flavors.some(
      (flavor) => String(flavor.id) === String(flavorId)
        && (showUnavailableFlavors || flavor.capacity !== 0),
    ),
    [flavors, flavorId, showUnavailableFlavors],
  );

  const visibleFlavors = useMemo(
    () => showUnavailableFlavors
      ? flavors
      : flavors.filter((flavor) => flavor.capacity !== 0),
    [flavors, showUnavailableFlavors],
  );

  const loadSettings = useCallback(() => {
    return fetch('/api/settings')
      .then((res) => {
        if (!res.ok) {
          return parseError(res, 'Failed to load settings.');
        }
        return res.json();
      })
      .catch(() => ({ run_defaults: {} }));
  }, []);

  const loadRegions = useCallback(() => {
    setRegionsStatus('loading');
    return fetch('/api/regions')
      .then((res) => {
        if (!res.ok) {
          return parseError(res, 'Failed to load regions.');
        }
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.regions ?? data.results ?? []);
        const baremetalOnly = list.filter((region) => region.has_baremetal === true);
        setRegions(baremetalOnly);
        setRegionsStatus(baremetalOnly.length ? 'loaded' : 'empty');
        return baremetalOnly;
      });
  }, []);

  useEffect(() => {
    Promise.all([loadSettings(), loadRegions()])
      .then(([settings]) => {
        setProject(settings.project ?? { project_id: null, project_name: null });
        const defaults = settings.run_defaults ?? {};
        setImageName(settings.image_name ?? '');
        if (defaults.region_id) {
          setRegionId(String(defaults.region_id));
        }
        if (defaults.flavor_id) {
          setFlavorId(String(defaults.flavor_id));
        }
        setServersCount(defaults.servers_count ?? 1);
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Failed to load New Run data.');
        setRegionsStatus('error');
      });
  }, [loadRegions, loadSettings]);

  useEffect(() => {
    if (!selectedRegionId) {
      setFlavors([]);
      setFlavorsStatus('idle');
      setFlavorId('');
      return;
    }

    setFlavorsStatus('loading');
    setErrorMsg('');

    fetch(`/api/flavors?region_id=${encodeURIComponent(selectedRegionId)}`)
      .then((res) => {
        if (!res.ok) {
          return parseError(res, 'Failed to load flavors.');
        }
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.flavors ?? data.results ?? []);
        setFlavors(list);
        setFlavorsStatus(list.length ? 'loaded' : 'empty');
      })
      .catch((err) => {
        setFlavors([]);
        setFlavorsStatus('error');
        setErrorMsg(err.message || 'Failed to load flavors.');
      });
  }, [selectedRegionId]);

  const loadImages = useCallback((regionId, refresh = false) => {
    if (!regionId) {
      setImages([]);
      setImagesStatus('idle');
      setImagesError('');
      setImageId(null);
      return;
    }
    setImagesStatus('loading');
    setImagesError('');
    fetch(`/api/images?region_id=${encodeURIComponent(regionId)}${refresh ? '&refresh=true' : ''}`)
      .then((res) => {
        if (!res.ok) return parseError(res, 'Failed to load images.');
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.images ?? data.results ?? []);
        setImages(list);
        setImagesStatus('loaded');
      })
      .catch((err) => {
        setImages([]);
        setImagesStatus('error');
        setImagesError(err.message || 'Failed to load images.');
        setImageId(null);
      });
  }, []);

  useEffect(() => {
    loadImages(selectedRegionId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegionId]);

  useEffect(() => {
    if (imagesStatus !== 'loaded') return;
    const match = images.find((img) => img.name === imageName);
    setImageId(match ? match.id : null);
  }, [images, imagesStatus, imageName]);

  useEffect(() => {
    if (flavorsStatus === 'loaded' && flavorId && !selectedFlavorExists) {
      setFlavorId('');
    }
  }, [flavorId, flavorsStatus, selectedFlavorExists]);

  function validate() {
    if (!regionId) return 'Region is required.';
    if (!flavorId) return 'Flavor is required.';
    if (!Number.isInteger(Number(serversCount)) || Number(serversCount) < 1) {
      return 'Server count must be at least 1.';
    }
    if (Number(serversCount) > 50) {
      return 'Server count must be at most 50.';
    }
    if (!jiraTicketId.trim()) return 'Jira task ID is required.';
    return '';
  }

  function handleStart(event) {
    event.preventDefault();
    const validationError = validate();
    setErrorMsg('');
    setRunResult(null);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSubmitPhase('defaults');

    fetch('/api/settings/run-defaults', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        region_id: Number(regionId),
        flavor_id: flavorId,
        servers_count: Number(serversCount),
      }),
    })
      .catch(() => {}) // best-effort — don't block run start on defaults save failure
      .then(() => {
        setSubmitPhase('run');
        return fetch('/api/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            region_id: Number(regionId),
            flavor_id: flavorId,
            servers_count: Number(serversCount),
            jira_task_id: jiraTicketId.trim(),
            image_id: imageId ?? null,
          }),
        });
      })
      .then((res) => {
        if (!res.ok) return parseError(res, 'Failed to start run.');
        return res.json();
      })
      .then((data) => {
        setRunResult(data);
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Failed to start run.');
      })
      .finally(() => {
        setSubmitPhase('');
      });
  }

  const regionSelectStyle = regionsStatus === 'loaded' ? styles.select : styles.selectDisabled;
  const flavorSelectStyle = flavorsStatus === 'loaded' ? styles.select : styles.selectDisabled;
  const submitting = submitPhase !== '';
  const canSubmit = !submitting && regionsStatus === 'loaded' && flavorsStatus === 'loaded';
  const startLabel = submitPhase === 'defaults' ? 'Saving...' : submitPhase === 'run' ? 'Starting...' : 'Start';

  return (
    <div style={styles.page}>
      <div style={styles.title}>New Run</div>
      <form style={styles.card} onSubmit={handleStart}>
        <div style={styles.projectBanner}>
          <span style={styles.projectMuted}>Project: </span>
          {project.project_id
            ? `${project.project_name || 'Unnamed project'} (${project.project_id})`
            : 'Not selected. Open Settings and choose a project before running.'}
        </div>
        <div style={styles.grid}>
          <label style={styles.fieldGroup}>
            <span style={styles.label}>Region</span>
            <select
              style={regionSelectStyle}
              value={regionId}
              disabled={regionsStatus !== 'loaded'}
              onChange={(event) => {
                setRegionId(event.target.value);
                setFlavorId('');
                setRunResult(null);
              }}
            >
              <option value="">
                {regionsStatus === 'loading' ? 'Loading regions...' : 'Select region'}
              </option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {regionLabel(region)}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.fieldGroup}>
            <span style={styles.label}>Flavor</span>
            <select
              style={flavorSelectStyle}
              value={flavorId}
              disabled={flavorsStatus !== 'loaded'}
              onChange={(event) => {
                setFlavorId(event.target.value);
                setRunResult(null);
              }}
            >
              <option value="">
                {flavorsStatus === 'loading'
                  ? 'Loading flavors...'
                  : selectedRegionId
                  ? 'Select flavor'
                  : 'Select region first'}
              </option>
              {visibleFlavors.map((flavor) => (
                <option
                  key={flavor.id}
                  value={flavor.id}
                  disabled={flavor.capacity === 0}
                  style={flavor.capacity === 0 ? { color: '#94A3B8' } : undefined}
                >
                  {formatFlavor(flavor)}
                </option>
              ))}
            </select>
            {flavorsStatus === 'empty' && (
              <span style={styles.hint}>No flavors returned for this region.</span>
            )}
            <label style={styles.checkboxLabel}>
              <input
                style={styles.checkbox}
                type="checkbox"
                checked={showUnavailableFlavors}
                onChange={(event) => {
                  setShowUnavailableFlavors(event.target.checked);
                }}
              />
              Show unavailable flavors
            </label>
          </label>

          <label style={styles.fieldGroup}>
            <span style={styles.label}>Servers</span>
            <input
              style={styles.numberInput}
              type="number"
              min="1"
              step="1"
              value={serversCount}
              onChange={(event) => {
                setServersCount(event.target.value);
              }}
            />
          </label>

          <label style={styles.fieldGroup}>
            <span style={styles.label}>Jira Ticket</span>
            <input
              style={styles.numberInput}
              type="text"
              placeholder="GCLOUD2-12345"
              value={jiraTicketId}
              onChange={(event) => setJiraTicketId(event.target.value)}
            />
          </label>
        </div>

        {selectedRegionId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
            <span style={styles.label}>Image</span>
            {imagesStatus === 'loading' && <Spinner size={12} />}
            <button
              type="button"
              title="Refresh images"
              style={imagesStatus === 'loading'
                ? { ...styles.refreshBtn, opacity: 0.4, cursor: 'not-allowed' }
                : styles.refreshBtn}
              disabled={imagesStatus === 'loading'}
              onClick={() => loadImages(selectedRegionId, true)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          </div>
        )}
        {selectedRegionId && imagesStatus === 'loaded' && imageName && imageId && (
          <div style={styles.imageBlock}>
            <span style={{ ...styles.label, display: 'block', marginBottom: '4px' }}>Image</span>
            <div style={{ fontSize: '13px', color: '#1A1D23' }}>{imageName}</div>
            <div style={styles.imageSub}>ID: {imageId}</div>
          </div>
        )}
        {selectedRegionId && imagesStatus === 'loaded' && imageName && !imageId && (
          <div style={styles.imageWarning}>
            Image '{imageName}' not found in this region
          </div>
        )}
        {selectedRegionId && imagesStatus === 'error' && (
          <div style={{ ...styles.message, ...styles.error, marginTop: '12px' }}>Could not load images for this region.</div>
        )}

        <div style={styles.actions}>
          <button
            type="submit"
            style={canSubmit ? styles.startButton : styles.startButtonDisabled}
            disabled={!canSubmit}
          >
            {startLabel}
          </button>
          {(regionsStatus === 'loading' || flavorsStatus === 'loading' || submitting) && (
            <Spinner size={18} />
          )}
        </div>

        {errorMsg && <div style={{ ...styles.message, ...styles.error }}>{errorMsg}</div>}
        {runResult && (
          <div style={{ ...styles.message, ...styles.info }}>
            Run started
            {runResult.run_id != null ? ` — ID: ${runResult.run_id}` : ''}
            {runResult.status ? ` — ${runResult.status}` : ''}
            {onNavigate && (
              <button
                type="button"
                style={{ ...styles.startButton, marginLeft: '12px', padding: '4px 12px', height: '28px', fontSize: '12px' }}
                onClick={() => onNavigate('run-progress')}
              >
                View Progress
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
