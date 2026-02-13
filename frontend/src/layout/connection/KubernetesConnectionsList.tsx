import { useEffect, useRef, useState } from 'react';
import { useConnectionsState, type KubeConfigEntry, type PinnedConnection } from './ConnectionsStateContext';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import './ConnectionsList.css';

type KubernetesConnectionsListProps = {
  onConnect?: () => void;
  filterConfig?: PinnedConnection;
};

type HookEntry = {
  scope?: string;
  connectionType?: string;
  connectionId?: string;
};

type KindProgressPayload = {
  percent?: number;
  message?: string;
  stage?: string;
  done?: boolean;
};

const kindStages = [
  { id: 'discovery', label: 'Discovery' },
  { id: 'pull', label: 'Image Pull' },
  { id: 'kubeconfig', label: 'Kubeconfig' },
  { id: 'done', label: 'Ready' },
];

const stageIndexById = new Map(kindStages.map((stage, index) => [stage.id, index]));
const stageLabelById = new Map(kindStages.map((stage) => [stage.id, stage.label]));

function KubernetesConnectionsList({ onConnect, filterConfig }: KubernetesConnectionsListProps) {
  const { kubeConfigs, selectedKubeConfig, loading, error, pinnedConnections, hooks, actions } =
    useConnectionsState();

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [creatingKind, setCreatingKind] = useState(false);
  const [kindProgress, setKindProgress] = useState<KindProgressPayload | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const lastStageRef = useRef<string>('discovery');
  const kindCanceledRef = useRef<boolean>(false);

  const displayConfigs = filterConfig
    ? kubeConfigs.filter((c: KubeConfigEntry) => c.path === filterConfig.path)
    : kubeConfigs;

  useEffect(() => {
    let off: (() => void) | undefined;
    try {
      off = EventsOn('kind:progress', (payload: KindProgressPayload | null) => {
        if (kindCanceledRef.current) {
          return;
        }
        const percent = Math.max(0, Math.min(100, Number(payload?.percent ?? 0)));
        const message = String(payload?.message || 'Setting up KinD cluster...');
        const done = Boolean(payload?.done);
        const incomingStage = payload?.stage;
        if (incomingStage && incomingStage !== 'error') {
          lastStageRef.current = incomingStage;
        }
        setKindProgress({ percent, message, stage: incomingStage, done });

        if (done) {
          if (progressTimerRef.current) {
            window.clearTimeout(progressTimerRef.current);
          }
          progressTimerRef.current = window.setTimeout(() => {
            setKindProgress(null);
            progressTimerRef.current = null;
          }, 2000);
        }
      });
    } catch {
      // ignore; EventsOn may not be available in some test environments
    }

    return () => {
      if (off) {
        try {
          off();
        } catch {
          // ignore
        }
      }
      if (progressTimerRef.current) {
        window.clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, []);

  const handleConnect = async (config: KubeConfigEntry) => {
    const success = await actions.connectKubeConfig(config);
    if (success && onConnect) {
      onConnect();
    }
  };

  const handleCreateKind = async () => {
    if (creatingKind) return;
    kindCanceledRef.current = false;
    setCreatingKind(true);
    setKindProgress({ percent: 5, message: 'Starting KinD setup...', stage: 'discovery', done: false });
    lastStageRef.current = 'discovery';
    try {
      await actions.createKindCluster();
    } finally {
      setCreatingKind(false);
    }
  };

  const handleCancelKind = async () => {
    if (!creatingKind) return;
    kindCanceledRef.current = true;
    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setKindProgress(null);
    setCreatingKind(false);
    lastStageRef.current = 'discovery';
    await actions.cancelKindCluster();
  };

  const showKindProgress = creatingKind || !!kindProgress;
  const progressPercent = Math.max(0, Math.min(100, kindProgress?.percent ?? (creatingKind ? 10 : 0)));
  const progressMessage = kindProgress?.message || 'Setting up KinD cluster...';
  const isErrorStage = kindProgress?.stage === 'error';
  const currentStageId = kindProgress?.stage ?? (creatingKind ? 'discovery' : undefined);
  const resolvedStageId = isErrorStage ? lastStageRef.current : currentStageId;
  const activeStageIndex = stageIndexById.get(resolvedStageId ?? '') ?? 0;
  const resolvedStageLabel = stageLabelById.get(resolvedStageId ?? '') || 'Discovery';
  const progressLabel = showKindProgress
    ? `KinD setup: ${resolvedStageLabel} (${Math.round(progressPercent)}%) - ${progressMessage}`
    : 'Loading kubeconfig files...';

  const isPinned = (config: KubeConfigEntry) => {
    return pinnedConnections.some((c: PinnedConnection) => c.type === 'kubernetes' && c.id === config.path);
  };

  const handleTogglePin = (e: React.MouseEvent, config: KubeConfigEntry) => {
    e.stopPropagation();
    actions.togglePin('kubernetes', config.path, {
      name: config.name,
      path: config.path,
      contexts: config.contexts || [],
    });
  };

  const handleProxySettings = (e: React.MouseEvent, config: KubeConfigEntry) => {
    e.stopPropagation();
    actions.showProxySettings(true, { type: 'kubernetes', ...config });
  };

  const handleHooksSettings = (e: React.MouseEvent, config: KubeConfigEntry) => {
    e.stopPropagation();
    actions.showHooksSettings(true, { type: 'kubernetes', id: config.path, ...config });
  };

  const hookCountFor = (config: KubeConfigEntry) => {
    const id = config.path;
    const list = Array.isArray(hooks) ? (hooks as HookEntry[]) : [];
    return list.filter((h) => {
      const scope = h?.scope || 'global';
      if (scope === 'global') return true;
      return h?.scope === 'connection' && h?.connectionType === 'kubernetes' && h?.connectionId === id;
    }).length;
  };

  return (
    <div className="connections-list">
      <div className="connections-header">
        <div className="connections-header-text">
          <h2>☸️ Kubernetes Connections</h2>
          <p>Select a kubeconfig to connect to your cluster</p>
        </div>
        <div className="connections-header-actions">
          <button
            id="create-kind-btn"
            className="connections-button secondary"
            onClick={handleCreateKind}
            disabled={loading || creatingKind}
          >
            {creatingKind ? '⏳ Creating KinD...' : '🧪 Spin up KinD'}
          </button>
          {creatingKind && (
            <button
              id="cancel-kind-btn"
              className="connections-button secondary cancel"
              onClick={handleCancelKind}
              disabled={loading}
            >
              ✖ Cancel
            </button>
          )}
          <button
            id="browse-kubeconfig-btn"
            className="connections-button secondary"
            onClick={() => actions.browseKubeConfigFile()}
            disabled={loading}
          >
            📁 Browse
          </button>
          <button
            id="add-kubeconfig-btn"
            className="connections-button primary"
            onClick={() => actions.showAddKubeConfigOverlay(true)}
            disabled={loading}
          >
            ➕ Add Config
          </button>
        </div>
      </div>

      {showKindProgress && (
        <div className="connections-kind-progress" aria-live="polite">
          <div className="connections-kind-progress__label">{progressMessage}</div>
          <div className="connections-kind-progress__track">
            <div className="connections-kind-progress__fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="connections-kind-progress__phases" role="list">
            {kindStages.map((stage, index) => {
              const isDone = currentStageId === 'done';
              const isComplete = isDone || index < activeStageIndex;
              const isActive = !isDone && index === activeStageIndex;
              const phaseClassName = [
                'connections-kind-progress__phase',
                isComplete ? 'is-complete' : '',
                isActive ? 'is-active' : '',
                isActive && isErrorStage ? 'is-error' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div key={stage.id} className={phaseClassName} role="listitem">
                  <span className="connections-kind-progress__dot" />
                  <span>{stage.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <div className="connections-alert">{error}</div>}

      {loading && <div className="connections-loading">{progressLabel}</div>}

      {!loading && displayConfigs.length === 0 && (
        <div className="connections-empty">
          <div className="connections-empty-icon">☸️</div>
          <h3 className="connections-empty-title">No Kubeconfig Files Found</h3>
          <p>Add a kubeconfig to connect to your Kubernetes clusters</p>
          <button className="connections-button primary" onClick={() => actions.showAddKubeConfigOverlay(true)}>
            ➕ Add Your First Kubeconfig
          </button>
        </div>
      )}

      {!loading && displayConfigs.length > 0 && (
        <div className="connections-card-list">
          {displayConfigs.map((config: KubeConfigEntry, index: number) => {
            const isSelected = selectedKubeConfig?.path === config.path;
            const isHovered = hoveredIndex === index;
            const pinned = isPinned(config);
            const cardClassName = [
              'connections-card',
              isSelected ? 'is-selected' : '',
              !isSelected && isHovered ? 'is-hovered' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div
                key={config.path}
                className={cardClassName}
                onClick={() => actions.selectKubeConfig(config)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="connections-card-row">
                  <div className="connections-card-main">
                    <div className="connections-card-title">
                      {config.name}
                      {pinned && <span>📌</span>}
                    </div>
                    <div className="connections-card-path">{config.path}</div>
                    <div className="connections-card-meta">
                      Contexts: {(config.contexts || []).join(', ') || 'None'}
                    </div>
                  </div>
                  <div className="connections-card-actions">
                    <button
                      onClick={(e) => handleTogglePin(e, config)}
                      className={`connections-icon-button${pinned ? ' pinned' : ''}`}
                      title={pinned ? 'Unpin' : 'Pin to sidebar'}
                    >
                      📌
                    </button>
                    <button
                      onClick={(e) => handleProxySettings(e, config)}
                      className="connections-icon-button"
                      title="Proxy settings"
                    >
                      🌐
                    </button>

                    <button
                      id={`kube-hooks-btn-${String(config.path).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`}
                      onClick={(e) => handleHooksSettings(e, config)}
                      className="connections-icon-button"
                      title="Hooks"
                    >
                      🪝
                      {hookCountFor(config) > 0 && (
                        <span className="connections-badge">{hookCountFor(config)}</span>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConnect(config);
                      }}
                      className="connections-button primary small"
                    >
                      Connect
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default KubernetesConnectionsList;
