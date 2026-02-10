import { useState, useEffect, type FormEvent } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import type { app } from '../../../../wailsjs/go/models';

type HelmInstallDialogProps = {
	namespace?: string;
	onClose?: () => void;
	onSuccess?: () => void;
};

export default function HelmInstallDialog({ namespace, onClose, onSuccess }: HelmInstallDialogProps) {
  const [step, setStep] = useState('search'); // 'search' | 'configure'
  const [repos, setRepos] = useState<app.HelmRepositoryInfo[]>([]);
  const [charts, setCharts] = useState<app.HelmChartInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChart, setSelectedChart] = useState<app.HelmChartInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Install form state
  const [releaseName, setReleaseName] = useState('');
  const [targetNamespace, setTargetNamespace] = useState(namespace || 'default');
  const [version, setVersion] = useState('');
  const [valuesYaml, setValuesYaml] = useState('');
  const [createNamespace, setCreateNamespace] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Helm v4 options
  const [waitStrategy, setWaitStrategy] = useState('legacy');
  const [timeout, setTimeout] = useState('300');

  // Load repos on mount
  useEffect(() => {
    loadRepos();
  }, []);

  const loadRepos = async () => {
    try {
      const data = await AppAPI.GetHelmRepositories();
      setRepos(data || []);
    } catch (err) {
      console.error('Failed to load repos:', err);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await AppAPI.SearchHelmCharts(searchQuery);
      setCharts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search charts');
      setCharts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChart = (chart: app.HelmChartInfo) => {
    setSelectedChart(chart);
    setReleaseName(chart.name);
    setVersion(chart.version);
    setStep('configure');
  };

  const handleInstall = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!releaseName.trim()) {
      setError('Release name is required');
      return;
    }
    if (!selectedChart) {
      setError('No chart selected');
      return;
    }

    setInstalling(true);
    setError(null);

    try {
      const values: Record<string, string> = {};
      if (valuesYaml.trim()) {
        // Simple YAML parsing
        const lines = valuesYaml.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const colonIdx = trimmed.indexOf(':');
            if (colonIdx > 0) {
              const key = trimmed.substring(0, colonIdx).trim();
              const val = trimmed.substring(colonIdx + 1).trim();
              values[key] = val;
            }
          }
        }
      }

      const timeoutSeconds = parseInt(timeout, 10) || 300;
      await AppAPI.InstallHelmChart({
        releaseName: releaseName.trim(),
        namespace: targetNamespace.trim(),
        chartRef: `${selectedChart.repo}/${selectedChart.name}`,
        version: version.trim() || '',
        values,
        createNamespace,
        waitStrategy,
        timeout: timeoutSeconds,
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install chart');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--gh-canvas-subtle, #161b22)',
          border: '1px solid var(--gh-border, #30363d)',
          borderRadius: 8,
          padding: 24,
          width: 700,
          maxHeight: '85vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: 'var(--gh-text, #c9d1d9)' }}>
            {step === 'search' ? 'Install Helm Chart' : `Configure: ${selectedChart?.name}`}
          </h3>
          {step === 'configure' && (
            <button
              onClick={() => setStep('search')}
              style={{
                padding: '4px 10px',
                background: 'transparent',
                color: 'var(--gh-text-muted, #8b949e)',
                border: '1px solid var(--gh-border, #30363d)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Back to Search
            </button>
          )}
        </div>

        {step === 'search' && (
          <>
            {repos.length === 0 && (
              <div style={{ marginBottom: 16, padding: 12, background: 'rgba(230, 184, 0, 0.1)', border: '1px solid #e6b800', borderRadius: 6, color: '#e6b800', fontSize: 13 }}>
                No Helm repositories configured. Add a repository first to search for charts.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search charts..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'var(--gh-canvas-default, #0d1117)',
                  border: '1px solid var(--gh-border, #30363d)',
                  borderRadius: 6,
                  color: 'var(--gh-text, #c9d1d9)',
                  fontSize: 14,
                }}
              />
              <button
                onClick={handleSearch}
                disabled={loading || repos.length === 0}
                style={{
                  padding: '8px 16px',
                  background: loading ? '#666' : 'var(--gh-btn-bg, #238636)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: loading || repos.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                }}
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: 12, background: 'rgba(215, 58, 73, 0.1)', border: '1px solid #d73a49', borderRadius: 6, color: '#d73a49', fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {charts.length === 0 && !loading && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--gh-text-muted, #8b949e)' }}>
                  {searchQuery ? 'No charts found. Try a different search term.' : 'Enter a search term to find charts.'}
                </div>
              )}
              {charts.map((chart) => (
                <div
                  key={`${chart.repo}/${chart.name}`}
                  onClick={() => handleSelectChart(chart)}
                  style={{
                    padding: 12,
                    borderBottom: '1px solid var(--gh-border, #30363d)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ color: 'var(--gh-text, #c9d1d9)', fontWeight: 600, marginBottom: 4 }}>
                        {chart.repo}/{chart.name}
                      </div>
                      <div style={{ color: 'var(--gh-text-muted, #8b949e)', fontSize: 13, marginBottom: 4 }}>
                        {chart.description || 'No description'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', color: 'var(--gh-text-muted, #8b949e)', fontSize: 12 }}>
                      <div>v{chart.version}</div>
                      {chart.appVersion && <div>App: {chart.appVersion}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 'configure' && selectedChart && (
          <form onSubmit={handleInstall}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text, #c9d1d9)', fontSize: 13 }}>
                Release Name *
              </label>
              <input
                type="text"
                value={releaseName}
                onChange={(e) => setReleaseName(e.target.value)}
                placeholder="my-release"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--gh-canvas-default, #0d1117)',
                  border: '1px solid var(--gh-border, #30363d)',
                  borderRadius: 6,
                  color: 'var(--gh-text, #c9d1d9)',
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text, #c9d1d9)', fontSize: 13 }}>
                Namespace
              </label>
              <input
                type="text"
                value={targetNamespace}
                onChange={(e) => setTargetNamespace(e.target.value)}
                placeholder="default"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--gh-canvas-default, #0d1117)',
                  border: '1px solid var(--gh-border, #30363d)',
                  borderRadius: 6,
                  color: 'var(--gh-text, #c9d1d9)',
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text, #c9d1d9)', fontSize: 13 }}>
                Version
              </label>
              <select
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--gh-canvas-default, #0d1117)',
                  border: '1px solid var(--gh-border, #30363d)',
                  borderRadius: 6,
                  color: 'var(--gh-text, #c9d1d9)',
                  fontSize: 14,
                }}
              >
                {(selectedChart.versions || [selectedChart.version]).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gh-text, #c9d1d9)', fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={createNamespace}
                  onChange={(e) => setCreateNamespace(e.target.checked)}
                />
                Create namespace if it doesn&apos;t exist
              </label>
            </div>

            {/* Helm v4 Advanced Options */}
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(88, 166, 255, 0.1)', border: '1px solid rgba(88, 166, 255, 0.3)', borderRadius: 6 }}>
              <div style={{ marginBottom: 12, color: 'var(--gh-text, #c9d1d9)', fontSize: 13, fontWeight: 500 }}>
                Advanced Options (Helm v4)
              </div>
              
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text-muted, #8b949e)', fontSize: 12 }}>
                    Wait Strategy
                  </label>
                  <select
                    value={waitStrategy}
                    onChange={(e) => setWaitStrategy(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--gh-canvas-default, #0d1117)',
                      border: '1px solid var(--gh-border, #30363d)',
                      borderRadius: 6,
                      color: 'var(--gh-text, #c9d1d9)',
                      fontSize: 13,
                    }}
                  >
                    <option value="none">No Wait</option>
                    <option value="legacy">Legacy (Poll-based)</option>
                    <option value="watcher">Watcher (Real-time)</option>
                  </select>
                  <div style={{ marginTop: 4, color: 'var(--gh-text-muted, #8b949e)', fontSize: 11 }}>
                    Watcher provides better real-time status updates
                  </div>
                </div>

                <div style={{ flex: '1 1 120px' }}>
                  <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text-muted, #8b949e)', fontSize: 12 }}>
                    Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    value={timeout}
                    onChange={(e) => setTimeout(e.target.value)}
                    min="0"
                    max="3600"
                    disabled={waitStrategy === 'none'}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: waitStrategy === 'none' ? 'var(--gh-canvas-subtle, #161b22)' : 'var(--gh-canvas-default, #0d1117)',
                      border: '1px solid var(--gh-border, #30363d)',
                      borderRadius: 6,
                      color: waitStrategy === 'none' ? 'var(--gh-text-muted, #8b949e)' : 'var(--gh-text, #c9d1d9)',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text, #c9d1d9)', fontSize: 13 }}>
                Values (YAML)
              </label>
              <textarea
                value={valuesYaml}
                onChange={(e) => setValuesYaml(e.target.value)}
                placeholder="# key: value"
                rows={8}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--gh-canvas-default, #0d1117)',
                  border: '1px solid var(--gh-border, #30363d)',
                  borderRadius: 6,
                  color: 'var(--gh-text, #c9d1d9)',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  resize: 'vertical',
                }}
              />
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: 12, background: 'rgba(215, 58, 73, 0.1)', border: '1px solid #d73a49', borderRadius: 6, color: '#d73a49', fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  color: 'var(--gh-text, #c9d1d9)',
                  border: '1px solid var(--gh-border, #30363d)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={installing}
                style={{
                  padding: '8px 16px',
                  background: installing ? '#666' : 'var(--gh-btn-bg, #238636)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: installing ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {installing ? 'Installing...' : 'Install'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}