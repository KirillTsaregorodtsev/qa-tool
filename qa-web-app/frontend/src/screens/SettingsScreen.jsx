import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
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
  input: {
    padding: '7px 12px',
    fontSize: '13px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    background: '#FFFFFF',
    color: '#1A1D23',
    outline: 'none',
    minHeight: '18px',
  },
  hint: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#64748B',
  },
  sectionDivider: {
    borderTop: '1px solid #E2E8F0',
    marginTop: '18px',
    paddingTop: '16px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1A1D23',
    marginBottom: '12px',
  },
  fieldError: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#DC2626',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '20px',
  },
  button: {
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
  buttonDisabled: {
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
  safeConfig: {
    marginTop: '18px',
    paddingTop: '16px',
    borderTop: '1px solid #E2E8F0',
  },
  safeConfigTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1A1D23',
    marginBottom: '8px',
  },
  safeConfigList: {
    margin: 0,
    paddingLeft: '18px',
    color: '#64748B',
    fontSize: '13px',
    lineHeight: 1.6,
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
      throw new Error(data.detail || fallback);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(text || fallback);
      }
      throw err;
    }
  });
}

export default function SettingsScreen() {
  const [projectsStatus, setProjectsStatus] = useState('loading');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Tracks the project_id that was last loaded/saved, used to detect project changes on submit.
  const savedProjectIdRef = useRef('');

  // Image selection state
  const [imageName, setImageName] = useState('');
  const [defaultRegionId, setDefaultRegionId] = useState(null);
  const [images, setImages] = useState([]);
  const [imagesStatus, setImagesStatus] = useState('idle'); // idle | loading | loaded | error
  const [imagesError, setImagesError] = useState('');

  const selectedProject = useMemo(
    () => projects.find((project) => String(project.id) === String(projectId)),
    [projectId, projects],
  );

  const loadSettings = useCallback(() => {
    return fetch('/api/settings')
      .then((res) => {
        if (!res.ok) return parseError(res, 'Failed to load settings.');
        return res.json();
      })
      .then((data) => {
        const project = data.project ?? {};
        const loadedProjectId = project.project_id ? String(project.project_id) : '';
        setProjectId(loadedProjectId);
        savedProjectIdRef.current = loadedProjectId;
        setProjectName(project.project_name ?? '');
        setImageName(data.image_name ?? '');
        const regionId = data.run_defaults?.region_id ?? null;
        setDefaultRegionId(regionId);
        return regionId;
      });
  }, []);

  const loadProjects = useCallback(() => {
    setProjectsStatus('loading');
    return fetch('/api/projects')
      .then((res) => {
        if (!res.ok) return parseError(res, 'Failed to load projects.');
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.projects ?? data.results ?? []);
        setProjects(list);
        setProjectsStatus(list.length ? 'loaded' : 'empty');
      })
      .catch(() => {
        setProjectsStatus('error');
      });
  }, []);

  const loadImages = useCallback((regionId, refresh = false) => {
    if (!regionId) return;
    setImagesStatus('loading');
    setImagesError('');
    fetch(`/api/images?region_id=${encodeURIComponent(regionId)}${refresh ? '&refresh=true' : ''}`)
      .then((res) => {
        if (!res.ok) return parseError(res, 'Failed to load images.');
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.images ?? []);
        setImages(list);
        setImagesStatus(list.length ? 'loaded' : 'empty');
      })
      .catch((err) => {
        setImages([]);
        setImagesStatus('error');
        setImagesError(err.message || 'Failed to load images.');
      });
  }, []);

  useEffect(() => {
    Promise.all([loadSettings(), loadProjects()])
      .then(([regionId]) => {
        if (regionId) {
          loadImages(regionId);
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Failed to load settings.');
      });
  }, [loadProjects, loadSettings, loadImages]);

  useEffect(() => {
    if (selectedProject) {
      setProjectName(selectedProject.name);
    }
  }, [selectedProject]);

  function validate() {
    if (!projectId) return 'Project ID is required.';
    if (!Number.isInteger(Number(projectId))) return 'Project ID must be a number.';
    return '';
  }

  function handleSubmit(event) {
    event.preventDefault();
    const validationError = validate();
    setInfoMsg('');
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSaving(true);
    setErrorMsg('');

    const saveProject = fetch('/api/settings/project', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: Number(projectId),
        project_name: projectName || null,
      }),
    }).then((res) => {
      if (!res.ok) return parseError(res, 'Failed to save project settings.');
      return res.json();
    });

    const saveImage = imageName
      ? fetch('/api/settings/image', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_name: imageName }),
        }).then((res) => {
          if (!res.ok) return parseError(res, 'Failed to save image settings.');
          return res.json();
        })
      : Promise.resolve();

    Promise.all([saveProject, saveImage])
      .then(() => {
        setInfoMsg('Settings saved.');
        const projectChanged = String(projectId) !== savedProjectIdRef.current;
        savedProjectIdRef.current = String(projectId);
        if (defaultRegionId && projectChanged) {
          loadImages(defaultRegionId, true);
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Failed to save settings.');
      })
      .finally(() => {
        setSaving(false);
      });
  }

  return (
    <div style={styles.page}>
      <div style={styles.title}>Settings</div>
      <form style={styles.card} onSubmit={handleSubmit}>
        <div style={styles.grid}>
          <label style={styles.fieldGroup}>
            <span style={styles.label}>Project</span>
            <select
              style={styles.select}
              value={selectedProject ? String(selectedProject.id) : ''}
              disabled={projectsStatus !== 'loaded'}
              onChange={(event) => {
                const value = event.target.value;
                const project = projects.find((item) => String(item.id) === value);
                setProjectId(value);
                setProjectName(project?.name ?? '');
                setInfoMsg('');
              }}
            >
              <option value="">
                {projectsStatus === 'loading' ? 'Loading projects...' : 'Select project'}
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.id})
                </option>
              ))}
            </select>
            {projectsStatus === 'error' && (
              <span style={styles.hint}>Project list failed to load. Enter project ID manually.</span>
            )}
            {projectsStatus === 'empty' && (
              <span style={styles.hint}>No projects returned. Enter project ID manually.</span>
            )}
          </label>

        </div>

        <div style={styles.sectionDivider}>
          <div style={styles.sectionTitle}>Default Image</div>
          <div style={styles.grid}>
            {defaultRegionId ? (
              <div style={styles.fieldGroup}>
                <div style={styles.labelRow}>
                  <span style={styles.label}>Image</span>
                  <button
                    type="button"
                    title="Refresh images"
                    style={imagesStatus === 'loading'
                      ? { ...styles.refreshBtn, opacity: 0.4, cursor: 'not-allowed' }
                      : styles.refreshBtn}
                    disabled={imagesStatus === 'loading'}
                    onClick={() => loadImages(defaultRegionId, true)}
                  >
                    {imagesStatus === 'loading'
                      ? <Spinner size={13} />
                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10"/>
                          <polyline points="1 20 1 14 7 14"/>
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                    }
                  </button>
                </div>
                <select
                  style={imagesStatus === 'loaded' ? styles.select : styles.selectDisabled}
                  value={imageName}
                  disabled={imagesStatus !== 'loaded'}
                  onChange={(event) => {
                    setImageName(event.target.value);
                    setInfoMsg('');
                  }}
                >
                  <option value="">
                    {imagesStatus === 'loading' ? 'Loading images...' : 'Select image'}
                  </option>
                  {images.map((image) => (
                    <option key={image.id} value={image.name}>
                      {image.name}
                    </option>
                  ))}
                </select>
                {imagesStatus === 'empty' && (
                  <span style={styles.hint}>No images returned for this region.</span>
                )}
                {imagesStatus === 'error' && (
                  <span style={styles.fieldError}>{imagesError}</span>
                )}
              </div>
            ) : (
              <div style={styles.fieldGroup}>
                <span style={styles.label}>Image</span>
                <input
                  style={styles.input}
                  value={imageName}
                  onChange={(event) => {
                    setImageName(event.target.value);
                    setInfoMsg('');
                  }}
                  placeholder="ubuntu-22.04-x64-ironic"
                />
                <span style={styles.hint}>Set a default region first to browse available images.</span>
              </div>
            )}
          </div>
        </div>

        <div style={styles.actions}>
          <button
            type="submit"
            style={saving ? styles.buttonDisabled : styles.button}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {projectsStatus === 'loading' && <Spinner size={18} />}
        </div>

        {errorMsg && <div style={{ ...styles.message, ...styles.error }}>{errorMsg}</div>}
        {infoMsg && <div style={{ ...styles.message, ...styles.info }}>{infoMsg}</div>}

        <section style={styles.safeConfig}>
          <div style={styles.safeConfigTitle}>Safe runtime configuration</div>
          <ul style={styles.safeConfigList}>
            <li>API key: configured only through backend environment; value is never requested or displayed.</li>
            <li>SSH private key: mounted in backend volume if needed; file contents are never requested or displayed.</li>
            <li>Reports: run records are read through backend API and persisted under the backend reports volume.</li>
          </ul>
        </section>
      </form>
    </div>
  );
}
