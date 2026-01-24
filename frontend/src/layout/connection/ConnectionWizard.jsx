import { ConnectionsStateProvider, useConnectionsState } from './ConnectionsStateContext.jsx';
import ConnectionsSidebar from './ConnectionsSidebar.jsx';
import ConnectionsMainView from './ConnectionsMainView.jsx';

/**
 * ConnectionWizardLayout - Uses the same layout structure as AppLayout
 * for a consistent look and feel.
 */
function ConnectionWizardLayout({ onComplete }) {
  return (
    <div id="layout" className="connection-wizard-layout">
      <aside id="sidebar" className="connection-wizard-sidebar">
        <ConnectionsSidebar onConnect={onComplete} />
        <button
          id="sidebar-toggle"
          title="Collapse Sidebar"
          onClick={(e) => {
            const sidebar = e.target.closest('#sidebar');
            if (sidebar) {
              sidebar.classList.toggle('collapsed');
              const collapsed = sidebar.classList.contains('collapsed');
              e.currentTarget.innerHTML = collapsed
                ? '<span>▶</span><span>Show Sidebar</span>'
                : '<span>◀</span><span>Hide Sidebar</span>';
            }
          }}
        >
          <span>◀</span>
          <span>Hide Sidebar</span>
        </button>
      </aside>
      <main id="maincontent" className="connection-wizard-main">
        <div id="error-container" />
        <div id="main-panels" style={{ height: '100%' }}>
          <ConnectionsMainView onConnect={onComplete} />
        </div>
      </main>
      <footer id="footer" className="connection-wizard-footer">
        <ConnectionsFooter />
      </footer>
    </div>
  );
}

/**
 * Simple footer for the connection wizard
 */
function ConnectionsFooter() {
  const { kubeConfigCount, swarmConnectionCount } = useConnectionsState();

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 16px',
        fontSize: 12,
        color: 'var(--gh-text-muted, #8b949e)',
        height: '100%',
      }}
    >
      <span>
        {kubeConfigCount} kubeconfig{kubeConfigCount !== 1 ? 's' : ''} •{' '}
        {swarmConnectionCount} Docker connection{swarmConnectionCount !== 1 ? 's' : ''}
      </span>
      <span>Select a connection to continue</span>
    </div>
  );
}

/**
 * Main ConnectionWizard component wrapped with provider
 */
const ConnectionWizard = ({ onComplete, initialSection }) => {
  return (
    <ConnectionsStateProvider initialSelectedSection={initialSection}>
      <ConnectionWizardLayout onComplete={onComplete} />
    </ConnectionsStateProvider>
  );
};

export default ConnectionWizard;
