import type { ReactNode } from 'react';
import { useContext } from 'react';
import { SwarmSidebarSections } from '../docker/SwarmSidebarSections';
import SwarmStateContext from '../docker/SwarmStateContext';
import { useMCP } from '../mcp/MCPContext';
import FooterBar from './FooterBar';
import SidebarSections from './SidebarSections';

type DockerSwarmSidebarProps = {
  selectedSection: string;
  onSelectSection: (_section: string) => void;
  onOpenConnectionsWizard?: () => void;
};
function DockerSwarmSidebar({
  selectedSection,
  onSelectSection,
  onOpenConnectionsWizard,
}: DockerSwarmSidebarProps) {
  // Use context directly to avoid error if not wrapped in provider
  const swarmContext = useContext(SwarmStateContext);

  // If no context available, don't render Docker Swarm sidebar
  if (!swarmContext) {
    return null;
  }

  const { connected, swarmActive, serverVersion } = swarmContext;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 14, color: 'var(--gh-text-secondary, #ccc)' }}>Swarm</span>
        <button
          id="swarm-show-wizard-btn"
          onClick={() => onOpenConnectionsWizard && onOpenConnectionsWizard()}
          style={{
            background: 'transparent',
            border: '1px solid var(--gh-border, #444)',
            color: 'var(--gh-text-secondary, #ccc)',
            padding: '4px 8px',
            borderRadius: 0,
            cursor: 'pointer',
            fontSize: 12,
          }}
          title="Connections.."
        >
          🐳
        </button>
      </div>
      {connected ? (
        <>
          <div style={{ padding: '4px 0 8px', fontSize: 12, color: 'var(--gh-text-secondary, #888)' }}>
            {serverVersion} {swarmActive ? '(Swarm)' : '(Standalone)'}
          </div>
          <SwarmSidebarSections selected={selectedSection} onSelect={onSelectSection} />
        </>
      ) : (
        <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--gh-text-secondary, #666)' }}>
          Not connected
        </div>
      )}
    </div>
  );
}

/**
 * AppLayout replicates the previously imperative HTML structure so existing logic
 * that queries by id (#kubecontext-root, #namespace-root, #sidebar-sections, etc.) continues to work.
 * Future phases will replace these id-based mutations with declarative React state.
 */
export function AppLayout({
  kubernetesAvailable,
  contextSelectEl,
  namespaceSelectEl,
  selectedSection,
  onSelectSection,
  mainContentEl,
  onOpenConnectionsWizard,
  onOpenSwarmConnectionsWizard,
  onToggleHolmes,
  holmesPanelVisible,
  onToggleMCP,
}: {
  kubernetesAvailable?: boolean;
  contextSelectEl?: ReactNode;
  namespaceSelectEl?: ReactNode;
  selectedSection: string;
  onSelectSection: (_section: string) => void;
  mainContentEl?: ReactNode;
  onOpenConnectionsWizard?: () => void;
  onOpenSwarmConnectionsWizard?: () => void;
  onToggleHolmes?: () => void;
  holmesPanelVisible?: boolean;
  onToggleMCP?: () => void;
}) {
  const hideKubernetesSelectors = kubernetesAvailable === false;
  const swarmContext = useContext(SwarmStateContext);
  const swarmConnected = Boolean(swarmContext?.connected);
  const activeConnectionCount = (kubernetesAvailable !== false ? 1 : 0) + (swarmConnected ? 1 : 0);
  const showSidebarSeparators = activeConnectionCount > 1;
  const { state: mcpState } = useMCP();
  const mcpRunning = mcpState.status?.running ?? false;
  return (
    <div id="layout">
      <aside id="sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: 'var(--gh-text-secondary, #ccc)' }}>Connection</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              id="holmes-toggle-btn"
              onClick={onToggleHolmes}
              title="Toggle Holmes AI (Ctrl+Shift+H)"
              style={{
                background: holmesPanelVisible ? 'var(--gh-accent, #238636)' : 'transparent',
                border: '1px solid var(--gh-border, #444)',
                color: holmesPanelVisible ? '#ffffff' : 'var(--gh-text-secondary, #ccc)',
                padding: '4px 8px',
                borderRadius: 0,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              🔍
            </button>
            <button
              id="mcp-config-btn"
              onClick={onToggleMCP}
              title={mcpRunning ? 'MCP Server Running' : 'MCP Server Configuration'}
              style={{
                background: mcpRunning ? 'var(--gh-accent, #238636)' : 'transparent',
                border: '1px solid var(--gh-border, #444)',
                color: mcpRunning ? '#ffffff' : 'var(--gh-text-secondary, #ccc)',
                padding: '4px 8px',
                borderRadius: 0,
                cursor: 'pointer',
                fontSize: 12,
                position: 'relative',
              }}
            >
              🔌{mcpRunning && <span style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#3fb950',
                border: '1px solid #238636',
              }} />}
            </button>
            <button
              id="show-wizard-btn"
              onClick={onOpenConnectionsWizard}
              style={{
                background: 'transparent',
                border: '1px solid var(--gh-border, #444)',
                color: 'var(--gh-text-secondary, #ccc)',
                padding: '4px 8px',
                borderRadius: 0,
                cursor: 'pointer',
                fontSize: 12,
              }}
              title="Show Connection Wizard"
            >
              ⚙️
            </button>
          </div>
        </div>
        <label htmlFor="kubecontext-root" style={hideKubernetesSelectors ? { display: 'none' } : undefined}>
          Context:
        </label>
        <div className="input" id="kubecontext-root" style={hideKubernetesSelectors ? { display: 'none' } : undefined}>
          {contextSelectEl}
        </div>
        <label htmlFor="namespace-root" style={hideKubernetesSelectors ? { display: 'none' } : undefined}>
          Namespaces:
        </label>
        <div className="input" id="namespace-root" style={hideKubernetesSelectors ? { display: 'none' } : undefined}>
          {namespaceSelectEl}
        </div>
        {showSidebarSeparators && <hr className="sidebar-separator" />}
        <div id="sidebar-sections" style={{ flex: 1 }}>
          {kubernetesAvailable !== false && (
            <>
              <SidebarSections selected={selectedSection} onSelect={onSelectSection} />
              {showSidebarSeparators && <hr className="sidebar-separator" />}
            </>
          )}
          <DockerSwarmSidebar
            selectedSection={selectedSection}
            onSelectSection={onSelectSection}
            onOpenConnectionsWizard={onOpenSwarmConnectionsWizard}
          />
        </div>
        <button id="sidebar-toggle" title="Collapse Sidebar">
          <span>◀</span>
          <span>Hide Sidebar</span>
        </button>
      </aside>
      <main id="maincontent">
        <div id="error-container" />
        <div id="main-panels">{mainContentEl}</div>
      </main>
      <footer id="footer">
        <FooterBar />
      </footer>
    </div>
  );
}
export default AppLayout;
