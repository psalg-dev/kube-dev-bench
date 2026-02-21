import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { showError, showSuccess } from '../../../notification';

type HelmActionsProps = {
  releaseName: string;
  namespace: string;
  chart: string;
  onRefresh?: () => void;
};

export default function HelmActions({ releaseName, namespace, chart, onRefresh }: HelmActionsProps) {
  const [uninstalling, setUninstalling] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [showRollbackPicker, setShowRollbackPicker] = useState(false);
  const [rollbackOptions, setRollbackOptions] = useState<number[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [loadingRollbackOptions, setLoadingRollbackOptions] = useState(false);
  const rollbackPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showRollbackPicker) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        rollbackPickerRef.current &&
        event.target instanceof Node &&
        !rollbackPickerRef.current.contains(event.target)
      ) {
        setShowRollbackPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRollbackPicker]);

  const handleUninstall = async () => {
    if (!window.confirm(`Are you sure you want to uninstall "${releaseName}" from namespace "${namespace}"?`)) {
      return;
    }
    setUninstalling(true);
    try {
      await AppAPI.UninstallHelmRelease(namespace, releaseName);
      showSuccess(`Helm release '${releaseName}' uninstalled`);
      if (onRefresh) onRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to uninstall: ${message}`);
    } finally {
      setUninstalling(false);
    }
  };

  const openRollbackPicker = async () => {
    setLoadingRollbackOptions(true);
    try {
      const history = await AppAPI.GetHelmReleaseHistory(namespace, releaseName);
      const revisions = (history || []).map((h) => h.revision).filter((r) => Number.isInteger(r));
      if (revisions.length <= 1) {
        showError(`No previous revision available for '${releaseName}'`);
        return;
      }

      const currentRevision = revisions[0];
      const candidates = revisions.filter((r) => r !== currentRevision);
      if (candidates.length === 0) {
        showError(`No previous revision available for '${releaseName}'`);
        return;
      }

      setRollbackOptions(candidates);
      setSelectedRevision(candidates[0]);
      setShowRollbackPicker(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to load revisions: ${message}`);
    } finally {
      setLoadingRollbackOptions(false);
    }
  };

  const confirmRollback = async () => {
    if (!selectedRevision) return;
    if (!window.confirm(`Rollback "${releaseName}" to revision ${selectedRevision}?`)) {
      return;
    }
    setRollingBack(true);
    try {
      await AppAPI.RollbackHelmRelease(namespace, releaseName, selectedRevision);
      showSuccess(`Rolled back "${releaseName}" to revision ${selectedRevision}`);
      if (onRefresh) onRefresh();
      setShowRollbackPicker(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Rollback failed: ${message}`);
    } finally {
      setRollingBack(false);
    }
  };

  const handleUpgrade = () => {
    setShowUpgradeDialog(true);
  };

  return (
    <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
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
        onClick={openRollbackPicker}
        disabled={rollingBack || loadingRollbackOptions}
        style={{
          padding: '6px 12px',
          background: rollingBack || loadingRollbackOptions ? '#666' : 'var(--gh-btn-bg, #21262d)',
          color: 'var(--gh-btn-text, #c9d1d9)',
          border: '1px solid var(--gh-border, #30363d)',
          borderRadius: 6,
          cursor: rollingBack || loadingRollbackOptions ? 'not-allowed' : 'pointer',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        {rollingBack ? 'Rolling back...' : (loadingRollbackOptions ? 'Loading...' : 'Rollback')}
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

      {showRollbackPicker && (
        <div
          ref={rollbackPickerRef}
          style={{
            position: 'absolute',
            top: 42,
            right: 0,
            zIndex: 20,
            background: 'var(--gh-canvas-subtle, #161b22)',
            border: '1px solid var(--gh-border, #30363d)',
            borderRadius: 8,
            padding: 12,
            minWidth: 260,
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)'
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', marginBottom: 6 }}>
            Select revision
          </div>
          <select
            value={selectedRevision ?? ''}
            onChange={(e) => setSelectedRevision(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'var(--gh-canvas-default, #0d1117)',
              border: '1px solid var(--gh-border, #30363d)',
              borderRadius: 6,
              color: 'var(--gh-text, #c9d1d9)',
              fontSize: 13,
            }}
          >
            {rollbackOptions.map((rev) => (
              <option key={rev} value={rev}>{rev}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowRollbackPicker(false)}
              style={{
                padding: '6px 10px',
                background: 'var(--gh-btn-bg, #21262d)',
                color: 'var(--gh-btn-text, #c9d1d9)',
                border: '1px solid var(--gh-border, #30363d)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRollback}
              disabled={rollingBack || !selectedRevision}
              style={{
                padding: '6px 10px',
                background: rollingBack ? '#666' : '#9e6a03',
                border: '1px solid #d29922',
                color: '#fff',
                borderRadius: 6,
                cursor: rollingBack || !selectedRevision ? 'not-allowed' : 'pointer',
                fontSize: 12,
              }}
            >
              {rollingBack ? 'Rolling back...' : 'Rollback'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type HelmUpgradeDialogProps = {
  releaseName: string;
  namespace: string;
  chartName?: string;
  onClose: () => void;
  onSuccess: () => void;
};

function HelmUpgradeDialog({ releaseName, namespace, onClose, onSuccess }: HelmUpgradeDialogProps) {
  const [chartRef, setChartRef] = useState('');
  const [version, setVersion] = useState('');
  const [valuesYaml, setValuesYaml] = useState('');
  const [reuseValues, setReuseValues] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Helm v4 options
  const [waitStrategy, setWaitStrategy] = useState('legacy');
  const [timeout, setTimeout] = useState('300');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!chartRef.trim()) {
      setError('Chart reference is required (e.g., bitnami/nginx)');
      return;
    }

    setUpgrading(true);
    setError(null);

    try {
      const values: Record<string, string> = {};
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
          const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
          setError(`Failed to parse values YAML: ${message}`);
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
        waitStrategy,
        timeout: parseInt(timeout, 10) || 300,
      });
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to upgrade release');
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
