import { useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

export default function HelmActions({ releaseName, namespace, chart, onRefresh }) {
  const [uninstalling, setUninstalling] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const handleUninstall = async () => {
    if (!window.confirm(`Are you sure you want to uninstall "${releaseName}" from namespace "${namespace}"?`)) {
      return;
    }
    setUninstalling(true);
    try {
      await AppAPI.UninstallHelmRelease(namespace, releaseName);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Failed to uninstall: ${err.message || err}`);
    } finally {
      setUninstalling(false);
    }
  };

  const handleUpgrade = () => {
    setShowUpgradeDialog(true);
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={handleUpgrade}
        disabled={false}
        style={{
          padding: '6px 12px',
          background: 'var(--gh-btn-bg, #21262d)',
          color: 'var(--gh-btn-text, #c9d1d9)',
          border: '1px solid var(--gh-border, #30363d)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        Upgrade
      </button>
      <button
        onClick={handleUninstall}
        disabled={uninstalling}
        style={{
          padding: '6px 12px',
          background: uninstalling ? '#666' : '#d73a49',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: uninstalling ? 'not-allowed' : 'pointer',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        {uninstalling ? 'Uninstalling...' : 'Uninstall'}
      </button>

      {showUpgradeDialog && (
        <HelmUpgradeDialog
          releaseName={releaseName}
          namespace={namespace}
          chartName={chart}
          onClose={() => setShowUpgradeDialog(false)}
          onSuccess={() => {
            setShowUpgradeDialog(false);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}

function HelmUpgradeDialog({ releaseName, namespace, chartName: _chartName, onClose, onSuccess }) {
  const [chartRef, setChartRef] = useState('');
  const [version, setVersion] = useState('');
  const [valuesYaml, setValuesYaml] = useState('');
  const [reuseValues, setReuseValues] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!chartRef.trim()) {
      setError('Chart reference is required (e.g., bitnami/nginx)');
      return;
    }

    setUpgrading(true);
    setError(null);

    try {
      const values = {};
      if (valuesYaml.trim()) {
        // Parse YAML values - simple key:value parsing for now
        try {
          // This is a simple parser; for complex YAML, you'd want a proper library
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
        } catch (parseErr) {
          setError(`Failed to parse values YAML: ${parseErr.message}`);
          setUpgrading(false);
          return;
        }
      }

      await AppAPI.UpgradeHelmRelease({
        releaseName,
        namespace,
        chartRef: chartRef.trim(),
        version: version.trim() || '',
        values,
        reuseValues,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to upgrade release');
    } finally {
      setUpgrading(false);
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
          width: 500,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', color: 'var(--gh-text, #c9d1d9)' }}>
          Upgrade Release: {releaseName}
        </h3>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text, #c9d1d9)', fontSize: 13 }}>
              Chart Reference *
            </label>
            <input
              type="text"
              value={chartRef}
              onChange={(e) => setChartRef(e.target.value)}
              placeholder="e.g., bitnami/nginx or /path/to/chart"
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
              Version (optional)
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="Leave empty for latest"
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gh-text, #c9d1d9)', fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={reuseValues}
                onChange={(e) => setReuseValues(e.target.checked)}
              />
              Reuse existing values
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text, #c9d1d9)', fontSize: 13 }}>
              Additional Values (YAML)
            </label>
            <textarea
              value={valuesYaml}
              onChange={(e) => setValuesYaml(e.target.value)}
              placeholder="key: value"
              rows={6}
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
              disabled={upgrading}
              style={{
                padding: '8px 16px',
                background: upgrading ? '#666' : 'var(--gh-btn-bg, #238636)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: upgrading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {upgrading ? 'Upgrading...' : 'Upgrade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
