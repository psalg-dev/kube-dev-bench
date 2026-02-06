import { ConnectionsStateProvider, useConnectionsState, type SelectedSection } from './ConnectionsStateContext';
import ConnectionsSidebar from './ConnectionsSidebar';
import ConnectionsMainView from './ConnectionsMainView';
import './ConnectionWizard.css';

type ConnectionWizardLayoutProps = {
  onComplete?: () => void;
};

function ConnectionWizardLayout({ onComplete }: ConnectionWizardLayoutProps) {
  return (
    <div id="layout" className="connection-wizard-layout">
      <aside id="sidebar" className="connection-wizard-sidebar">
        <ConnectionsSidebar onConnect={onComplete} />
        <button
          id="sidebar-toggle"
          title="Collapse Sidebar"
          onClick={(e) => {
            const sidebar = (e.target as HTMLElement).closest('#sidebar');
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
        <div id="main-panels" className="connection-wizard-panels">
          <ConnectionsMainView onConnect={onComplete} />
        </div>
      </main>
      <footer id="footer" className="connection-wizard-footer">
        <ConnectionsFooter />
      </footer>
    </div>
  );
}

function ConnectionsFooter() {
  const { kubeConfigCount, swarmConnectionCount } = useConnectionsState();

  return (
    <div className="connection-wizard-footer-content">
      <span>
        {kubeConfigCount} kubeconfig{kubeConfigCount !== 1 ? 's' : ''} • {swarmConnectionCount} Docker connection
        {swarmConnectionCount !== 1 ? 's' : ''}
      </span>
      <span>Select a connection to continue</span>
    </div>
  );
}

type ConnectionWizardProps = {
  onComplete?: () => void;
  initialSection?: SelectedSection;
};

const ConnectionWizard = ({ onComplete, initialSection }: ConnectionWizardProps) => {
  return (
    <ConnectionsStateProvider initialSelectedSection={initialSection}>
      <ConnectionWizardLayout onComplete={onComplete} />
    </ConnectionsStateProvider>
  );
};

export default ConnectionWizard;

