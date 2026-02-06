import { useEffect, useState } from 'react';
import { showError, showSuccess, showWarning } from '../notification';
import {
  ResizePersistentVolumeClaim,
  ResumeCronJob,
  ScaleResource,
  StartJob,
  StartJobFromCronJob,
  SuspendCronJob,
} from '../k8s/resources/kubeApi';

const SCALE_VISIBLE = new Set(['deployment', 'statefulset', 'replicaset', 'daemonset']);
const SCALE_EDITABLE = new Set(['deployment', 'statefulset', 'replicaset']);

const sanitizeReplicaString = (value: number | string) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return '0';
  return String(Math.max(0, Math.round(num)));
};

const parseReplicaValue = (value: number | string) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.max(0, Math.round(num));
};

type ConfirmType = 'restart' | 'delete' | null;

type ResourceActionsProps = {
  resourceType: string;
  name: string;
  namespace?: string;
  onRestart?: (name: string, namespace?: string) => Promise<void> | void;
  onDelete?: (name: string, namespace?: string) => Promise<void> | void;
  disabled?: boolean;
  replicaCount?: number;
};

export default function ResourceActions({
  resourceType,
  name,
  namespace,
  onRestart,
  onDelete,
  disabled = false,
  replicaCount = 0,
}: ResourceActionsProps) {
  const [confirm, setConfirm] = useState<{ type: ConfirmType; expires: number }>({
    type: null,
    expires: 0,
  });
  const [scaleMode, setScaleMode] = useState(false);
  const [scaleValue, setScaleValue] = useState(() => sanitizeReplicaString(replicaCount));
  const [scaleBusy, setScaleBusy] = useState(false);
  const [resizeMode, setResizeMode] = useState(false);
  const [resizeValue, setResizeValue] = useState('');
  const [resizeBusy, setResizeBusy] = useState(false);
  const CONFIRM_WINDOW = 3500; // ms
  const hasRestart = typeof onRestart === 'function';
  const hasDelete = typeof onDelete === 'function';
  const normalizedType = (resourceType || '').toLowerCase();
  const showScaleButton = SCALE_VISIBLE.has(normalizedType);
  const canEditScale =
    showScaleButton &&
    SCALE_EDITABLE.has(normalizedType) &&
    typeof namespace === 'string' &&
    !!namespace &&
    typeof name === 'string' &&
    !!name;
  const canResizePVC =
    normalizedType === 'pvc' &&
    typeof namespace === 'string' &&
    !!namespace &&
    typeof name === 'string' &&
    !!name;

  // Reset confirmation automatically when window expires
  useEffect(() => {
    if (!confirm.type) return;
    const id = setTimeout(
      () => setConfirm({ type: null, expires: 0 }),
      Math.max(0, confirm.expires - Date.now())
    );
    return () => clearTimeout(id);
  }, [confirm]);

  // Reset scale UI when resource changes
  useEffect(() => {
    setScaleMode(false);
    setScaleBusy(false);
    setScaleValue(sanitizeReplicaString(replicaCount));
    setResizeMode(false);
    setResizeBusy(false);
    setResizeValue('');
  }, [name, namespace, replicaCount]);

  useEffect(() => {
    if (!canEditScale && scaleMode) {
      setScaleMode(false);
    }
  }, [canEditScale, scaleMode]);

  const beginConfirm = (type: Exclude<ConfirmType, null>) => {
    setConfirm({ type, expires: Date.now() + CONFIRM_WINDOW });
    showWarning(
      `${type === 'delete' ? 'Delete' : 'Restart'} ${resourceType.toLowerCase()} '${name}': click again to confirm`,
      { duration: 2500 }
    );
  };

  const handleAction = async (actionType: Exclude<ConfirmType, null>) => {
    if (disabled) return;
    if (actionType === 'restart' && !hasRestart) return;
    if (actionType === 'delete' && !hasDelete) return;
    // First click -> enter confirm mode
    if (confirm.type !== actionType) {
      beginConfirm(actionType);
      return;
    }
    // Second click within window executes
    try {
      if (actionType === 'restart') {
        await onRestart?.(name, namespace);
        showSuccess(`${resourceType} '${name}' restarted`);
      } else if (actionType === 'delete') {
        await onDelete?.(name, namespace);
        showSuccess(`${resourceType} '${name}' deleted`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to ${actionType} ${resourceType.toLowerCase()} '${name}': ${message}`);
    } finally {
      setConfirm({ type: null, expires: 0 });
    }
  };

  // New handlers for Job and CronJob actions
  const handleStartJob = async () => {
    if (!namespace) return;
    try {
      await StartJob(namespace, name);
      showSuccess(`Job '${name}' started`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to start Job '${name}': ${message}`);
    }
  };

  const handleSuspendCronJob = async () => {
    if (!namespace) return;
    try {
      await SuspendCronJob(namespace, name);
      showSuccess(`CronJob '${name}' suspended`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to suspend CronJob '${name}': ${message}`);
    }
  };

  const handleResumeCronJob = async () => {
    if (!namespace) return;
    try {
      await ResumeCronJob(namespace, name);
      showSuccess(`CronJob '${name}' resumed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to resume CronJob '${name}': ${message}`);
    }
  };

  const handleStartJobFromCronJob = async () => {
    if (!namespace) return;
    try {
      await StartJobFromCronJob(namespace, name);
      showSuccess(`Job started from CronJob '${name}'`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to start Job from CronJob '${name}': ${message}`);
    }
  };

  const toggleScale = () => {
    if (!canEditScale || disabled) return;
    if (!scaleMode) {
      setScaleValue(sanitizeReplicaString(replicaCount));
    }
    setScaleMode(!scaleMode);
  };

  const submitScale = async () => {
    if (!canEditScale || disabled) return;
    const desired = parseReplicaValue(scaleValue);
    setScaleBusy(true);
    try {
      await ScaleResource(resourceType, namespace, name, desired);
      showSuccess(`Scaled ${resourceType} '${name}' to ${desired} replicas`);
      setScaleMode(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to scale ${resourceType} '${name}': ${message}`);
    } finally {
      setScaleBusy(false);
    }
  };

  const submitResizePVC = async () => {
    if (!canResizePVC || disabled) return;
    const nextSize = String(resizeValue || '').trim();
    if (!nextSize) {
      showError('Enter a size (e.g. 5Gi)');
      return;
    }
    setResizeBusy(true);
    try {
      await ResizePersistentVolumeClaim(namespace, name, nextSize);
      showSuccess(`Resize requested for PVC '${name}' to ${nextSize}`);
      setResizeMode(false);
      setResizeValue('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to resize PVC '${name}': ${message}`);
    } finally {
      setResizeBusy(false);
    }
  };

  const restartPending = confirm.type === 'restart';
  const deletePending = confirm.type === 'delete';

  const baseBtn: React.CSSProperties = {
    padding: '4px 10px',
    fontSize: 12,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 4,
    border: '1px solid #3c3c3c',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
  };

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {/* Job actions */}
      {resourceType === 'job' && (
        <button
          type="button"
          disabled={disabled}
          onClick={handleStartJob}
          title={`Start Job '${name}' (re-run)`}
          style={{ ...baseBtn, background: '#3c3c3c', color: '#fff' }}
        >
          <span aria-hidden="true" style={{ lineHeight: 1 }}>
            ▶
          </span>
          Start
        </button>
      )}
      {/* CronJob actions */}
      {resourceType === 'cronjob' && (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={handleStartJobFromCronJob}
            title={`Start Job from CronJob '${name}' (manual trigger)`}
            style={{ ...baseBtn, background: '#3c3c3c', color: '#fff' }}
          >
            <span aria-hidden="true" style={{ lineHeight: 1 }}>
              ▶
            </span>
            Start
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={handleSuspendCronJob}
            title={`Suspend CronJob '${name}'`}
            style={{ ...baseBtn, background: '#b22222', color: '#fff' }}
          >
            <span aria-hidden="true" style={{ lineHeight: 1 }}>
              ⏸
            </span>
            Suspend
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={handleResumeCronJob}
            title={`Resume CronJob '${name}'`}
            style={{ ...baseBtn, background: '#228B22', color: '#fff' }}
          >
            <span aria-hidden="true" style={{ lineHeight: 1 }}>
              ▶
            </span>
            Resume
          </button>
        </>
      )}
      {/* Existing actions */}
      {hasRestart && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction('restart')}
          title={
            restartPending
              ? `Click to confirm restart of ${resourceType} '${name}'`
              : `Restart ${resourceType} '${name}' (rollout restart)`
          }
          style={{
            ...baseBtn,
            background: restartPending ? '#9e6a03' : '#2d323b',
            borderColor: restartPending ? '#d29922' : '#353a42',
            color: '#fff',
          }}
        >
          <span aria-hidden="true" style={{ lineHeight: 1 }}>
            ⟳
          </span>
          {restartPending ? 'Confirm' : 'Restart'}
        </button>
      )}
      {hasDelete && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction('delete')}
          title={
            deletePending
              ? `Click to confirm delete of ${resourceType} '${name}'`
              : `Delete ${resourceType} '${name}'`
          }
          style={{
            ...baseBtn,
            background: deletePending ? '#f85149' : '#b22222',
            borderColor: deletePending ? '#f85149' : '#853131',
            color: '#fff',
          }}
        >
          <span aria-hidden="true" style={{ lineHeight: 1 }}>
            🗑
          </span>
          {deletePending ? 'Confirm' : 'Delete'}
        </button>
      )}
      {canResizePVC && !resizeMode && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setResizeMode(true)}
          title={`Request storage expansion for PVC '${name}'`}
          style={{
            ...baseBtn,
            background: '#1f6feb',
            borderColor: '#388bfd',
            color: '#fff',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          Resize
        </button>
      )}
      {canResizePVC && resizeMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span>Size</span>
            <input
              type="text"
              value={resizeValue}
              onChange={(event) => setResizeValue(event.target.value)}
              placeholder="e.g. 5Gi"
              style={{
                width: 110,
                padding: '4px 6px',
                borderRadius: 4,
                border: '1px solid #3c3c3c',
                background: '#181818',
                color: '#fff',
              }}
            />
          </label>
          <button
            type="button"
            onClick={submitResizePVC}
            disabled={disabled || resizeBusy}
            style={{ ...baseBtn, background: '#0e639c', borderColor: '#1177bb', color: '#fff' }}
          >
            {resizeBusy ? 'Applying…' : 'Apply'}
          </button>
          <button
            type="button"
            onClick={() => {
              setResizeMode(false);
              setResizeValue('');
            }}
            disabled={resizeBusy}
            style={{ ...baseBtn, background: '#3c3c3c', color: '#fff' }}
          >
            Cancel
          </button>
        </div>
      )}
      {showScaleButton && !scaleMode && (
        <button
          type="button"
          disabled={disabled || !canEditScale}
          onClick={toggleScale}
          title={
            canEditScale
              ? `Scale ${resourceType} '${name}'`
              : normalizedType === 'daemonset'
                ? 'DaemonSets run one pod per matching node; change node labels to affect count'
                : `Scaling not available for ${resourceType}`
          }
          style={{
            ...baseBtn,
            background: '#1f6feb',
            borderColor: '#388bfd',
            color: '#fff',
            opacity: disabled || !canEditScale ? 0.6 : 1,
            cursor: disabled || !canEditScale ? 'not-allowed' : baseBtn.cursor,
          }}
        >
          <span aria-hidden="true" style={{ lineHeight: 1 }}>
            ⤢
          </span>
          Scale
        </button>
      )}
      {canEditScale && scaleMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <span>Replicas</span>
            <input
              type="number"
              min={0}
              step={1}
              value={scaleValue}
              onChange={(event) => setScaleValue(event.target.value)}
              style={{
                width: 70,
                padding: '4px 6px',
                borderRadius: 4,
                border: '1px solid #3c3c3c',
                background: '#181818',
                color: '#fff',
              }}
            />
          </label>
          <button
            type="button"
            onClick={submitScale}
            disabled={disabled || scaleBusy}
            style={{ ...baseBtn, background: '#0e639c', borderColor: '#1177bb', color: '#fff' }}
          >
            {scaleBusy ? 'Scaling…' : 'Apply'}
          </button>
          <button
            type="button"
            onClick={() => {
              setScaleMode(false);
              setScaleValue(sanitizeReplicaString(replicaCount));
            }}
            disabled={scaleBusy}
            style={{ ...baseBtn, background: '#3c3c3c', color: '#fff' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
