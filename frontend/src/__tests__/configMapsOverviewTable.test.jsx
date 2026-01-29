import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';

const { runtimeHandlers, appApiMocks, holmesApiMocks, notificationMocks } = vi.hoisted(() => {
  return {
    runtimeHandlers: new Map(),
    appApiMocks: {
      GetConfigMaps: vi.fn(),
      DeleteResource: vi.fn(),
      AnalyzeConfigMapStream: vi.fn(),
    },
    holmesApiMocks: {
      AnalyzeConfigMapStream: vi.fn(),
      CancelHolmesStream: vi.fn(),
      onHolmesChatStream: vi.fn(() => vi.fn()),
      onHolmesContextProgress: vi.fn(() => vi.fn()),
    },
    notificationMocks: {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    },
  };
});

vi.mock('../../../../wailsjs/go/main/App', () => appApiMocks);
vi.mock('../../../holmes/holmesApi', () => holmesApiMocks);

vi.mock('../../../../wailsjs/runtime', () => ({
  EventsOn: vi.fn((eventName, cb) => {
    runtimeHandlers.set(eventName, cb);
    return vi.fn();
  }),
  EventsOff: vi.fn(),
}));

// Mock OverviewTableWithPanel to exercise column/action rendering
vi.mock('../../../layout/overview/OverviewTableWithPanel.jsx', () => ({
  default: function OverviewTableWithPanelMock(props) {
    const { title, columns, data, getRowActions, renderPanelContent, tabs } = props;

    return (
      <div data-testid="overview-table">
        <div data-testid="title">{title}</div>

        <div data-testid="rows">
          {(data || []).map((row) => {
            const actions = typeof getRowActions === 'function' ? getRowActions(row, {
              openDetails: (tabKey) => {
                // Simulate opening details panel
                const content = renderPanelContent?.(row, tabKey || tabs?.[0]?.key);
                if (content) {
                  const container = document.createElement('div');
                  container.setAttribute('data-testid', 'panel-content');
                  document.body.appendChild(container);
                }
              }
            }) : [];
            
            return (
              <div key={row.name} data-testid={`row-${row.name}`}>
                <div data-testid={`row-name-${row.name}`}>{row.name}</div>

                <div data-testid={`row-cells-${row.name}`}>
                  {(columns || []).map((col) => {
                    const value = row[col.key];
                    return (
                      <div key={col.key} data-testid={`cell-${row.name}-${col.key}`}>
                        {value ?? '-'}
                      </div>
                    );
                  })}
                </div>

                <div data-testid={`actions-${row.name}`}>
                  {actions.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      disabled={Boolean(a.disabled)}
                      onClick={a.onClick}
                    >
                      {a.icon} {a.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
}));

// Mock child tab components
vi.mock('../k8s/resources/configmaps/ConfigMapYamlTab.jsx', () => ({
  default: function ConfigMapYamlTabMock() {
    return <div data-testid="configmap-yaml-tab" />;
  },
}));

vi.mock('../k8s/resources/configmaps/ConfigMapDataTab.jsx', () => ({
  default: function ConfigMapDataTabMock() {
    return <div data-testid="configmap-data-tab" />;
  },
}));

vi.mock('../k8s/resources/configmaps/ConfigMapConsumersTab.jsx', () => ({
  default: function ConfigMapConsumersTabMock() {
    return <div data-testid="configmap-consumers-tab" />;
  },
}));

vi.mock('../components/ResourceEventsTab.jsx', () => ({
  default: function ResourceEventsTabMock() {
    return <div data-testid="resource-events-tab" />;
  },
}));

vi.mock('../QuickInfoSection.jsx', () => ({
  default: function QuickInfoSectionMock() {
    return <div data-testid="quick-info-section" />;
  },
}));

vi.mock('../layout/bottompanel/SummaryTabHeader.jsx', () => ({
  default: function SummaryTabHeaderMock({ name, actions }) {
    return (
      <div data-testid="summary-tab-header">
        <div>{name}</div>
        <div>{actions}</div>
      </div>
    );
  },
}));

vi.mock('../components/ResourceActions.jsx', () => ({
  default: function ResourceActionsMock() {
    return <div data-testid="resource-actions" />;
  },
}));

vi.mock('../holmes/HolmesBottomPanel.jsx', () => ({
  default: function HolmesBottomPanelMock({ kind, namespace, name, onAnalyze }) {
    return (
      <div data-testid="holmes-bottom-panel">
        <div>Holmes for {kind}: {namespace}/{name}</div>
        <button onClick={onAnalyze}>Analyze</button>
      </div>
    );
  },
}));

vi.mock('../notification.js', () => notificationMocks);

import ConfigMapsOverviewTable from '../k8s/resources/configmaps/ConfigMapsOverviewTable.jsx';

function emit(eventName, payload) {
  const cb = runtimeHandlers.get(eventName);
  if (!cb) throw new Error(`No handler registered for ${eventName}`);
  cb(payload);
}

describe('ConfigMapsOverviewTable', () => {
  beforeEach(() => {
    runtimeHandlers.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();

    appApiMocks.GetConfigMaps.mockResolvedValue([
      {
        name: 'app-config',
        namespace: 'default',
        keys: '3 keys',
        size: '1.2 KB',
        age: '5d',
        labels: { app: 'myapp' },
      },
      {
        name: 'db-config',
        namespace: 'default',
        keys: '5 keys',
        size: '2.5 KB',
        age: '10d',
        labels: { component: 'database' },
      },
    ]);

    appApiMocks.DeleteResource.mockResolvedValue(undefined);
    holmesApiMocks.AnalyzeConfigMapStream.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('data loading and rendering', () => {
    it('loads configmaps and renders rows/cells', async () => {
      render(<ConfigMapsOverviewTable namespace="default" />);

      expect(await screen.findByTestId('row-app-config')).toBeInTheDocument();
      expect(screen.getByTestId('row-name-app-config')).toHaveTextContent('app-config');

      // Check column cells
      expect(screen.getByTestId('cell-app-config-name')).toHaveTextContent('app-config');
      expect(screen.getByTestId('cell-app-config-namespace')).toHaveTextContent('default');
      expect(screen.getByTestId('cell-app-config-keys')).toHaveTextContent('3 keys');
      expect(screen.getByTestId('cell-app-config-size')).toHaveTextContent('1.2 KB');
      expect(screen.getByTestId('cell-app-config-age')).toHaveTextContent('5d');

      expect(appApiMocks.GetConfigMaps).toHaveBeenCalledWith('default');
    });

    it('renders multiple configmaps', async () => {
      render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-app-config');
      expect(screen.getByTestId('row-db-config')).toBeInTheDocument();
      expect(screen.getByTestId('cell-db-config-keys')).toHaveTextContent('5 keys');
    });

    it('loads configmaps from multiple namespaces', async () => {
      appApiMocks.GetConfigMaps.mockImplementation((ns) => {
        if (ns === 'default') return Promise.resolve([
          { name: 'default-cm', namespace: 'default', keys: '2', size: '1KB', age: '1d' }
        ]);
        if (ns === 'kube-system') return Promise.resolve([
          { name: 'system-cm', namespace: 'kube-system', keys: '3', size: '2KB', age: '2d' }
        ]);
        return Promise.resolve([]);
      });

      render(<ConfigMapsOverviewTable namespace="default" namespaces={['default', 'kube-system']} />);

      await screen.findByTestId('row-default-cm');
      expect(screen.getByTestId('row-system-cm')).toBeInTheDocument();

      expect(appApiMocks.GetConfigMaps).toHaveBeenCalledWith('default');
      expect(appApiMocks.GetConfigMaps).toHaveBeenCalledWith('kube-system');
    });

    it('normalizes configmap data with fallback values', async () => {
      appApiMocks.GetConfigMaps.mockResolvedValue([
        {
          Name: 'legacy-cm', // Capital case
          Namespace: 'default',
          Keys: '1 key',
          Size: '500B',
          Age: '3h',
        },
      ]);

      render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-legacy-cm');
      expect(screen.getByTestId('cell-legacy-cm-name')).toHaveTextContent('legacy-cm');
      expect(screen.getByTestId('cell-legacy-cm-namespace')).toHaveTextContent('default');
    });

    it('handles missing data with default values', async () => {
      appApiMocks.GetConfigMaps.mockResolvedValue([
        {
          name: 'minimal-cm',
          namespace: 'default',
          // Missing keys, size, age
        },
      ]);

      render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-minimal-cm');
      expect(screen.getByTestId('cell-minimal-cm-keys')).toHaveTextContent('-');
      expect(screen.getByTestId('cell-minimal-cm-size')).toHaveTextContent('-');
      expect(screen.getByTestId('cell-minimal-cm-age')).toHaveTextContent('-');
    });
  });

  describe('row actions', () => {
    it('includes Ask Holmes action', async () => {
      render(<ConfigMapsOverviewTable namespace="default" />);

      const row = await screen.findByTestId('row-app-config');
      expect(row).toBeInTheDocument();

      const actions = within(screen.getByTestId('actions-app-config'));
      expect(actions.getByRole('button', { name: /Ask Holmes/i })).toBeInTheDocument();
    });

    it('includes Delete action', async () => {
      render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-app-config');

      const actions = within(screen.getByTestId('actions-app-config'));
      expect(actions.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    });

    it('calls DeleteResource when Delete action clicked', async () => {
      render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-app-config');

      const actions = screen.getByTestId('actions-app-config');
      const deleteButton = within(actions).getByRole('button', { name: /Delete/i });

      await act(async () => {
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(appApiMocks.DeleteResource).toHaveBeenCalledWith('configmap', 'default', 'app-config');
      });
      expect(notificationMocks.showSuccess).toHaveBeenCalledWith("ConfigMap 'app-config' deleted");
    });

    it('handles delete error gracefully', async () => {
      appApiMocks.DeleteResource.mockRejectedValue(new Error('Permission denied'));

      render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-app-config');

      const actions = screen.getByTestId('actions-app-config');
      const deleteButton = within(actions).getByRole('button', { name: /Delete/i });

      await act(async () => {
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(notificationMocks.showError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to delete ConfigMap')
        );
      });
    });

    it('triggers Holmes analysis when Ask Holmes clicked', async () => {
      render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-app-config');

      const actions = screen.getByTestId('actions-app-config');
      const holmesButton = within(actions).getByRole('button', { name: /Ask Holmes/i });

      await act(async () => {
        fireEvent.click(holmesButton);
      });

      await waitFor(() => {
        expect(holmesApiMocks.AnalyzeConfigMapStream).toHaveBeenCalledWith(
          'default',
          'app-config',
          expect.any(String)
        );
      });
    });

    it('disables Ask Holmes button while analyzing', async () => {
      holmesApiMocks.AnalyzeConfigMapStream.mockImplementation(() => {
        return new Promise(() => {}); // Never resolves to keep analyzing state
      });

      render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-app-config');

      const actions = screen.getByTestId('actions-app-config');
      const holmesButton = within(actions).getByRole('button', { name: /Ask Holmes/i });

      await act(async () => {
        fireEvent.click(holmesButton);
      });

      await waitFor(() => {
        const updatedButton = within(screen.getByTestId('actions-app-config')).getByRole('button', { name: /Analyzing/i });
        expect(updatedButton).toBeDisabled();
      });
    });
  });

  describe('event handling', () => {
    it('refreshes on resource-updated event for configmap', async () => {
      render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-app-config');

      // Clear initial call
      appApiMocks.GetConfigMaps.mockClear();

      // Add new configmap to response
      appApiMocks.GetConfigMaps.mockResolvedValue([
        {
          name: 'app-config',
          namespace: 'default',
          keys: '3 keys',
          size: '1.2 KB',
          age: '5d',
        },
        {
          name: 'new-config',
          namespace: 'default',
          keys: '1 key',
          size: '100B',
          age: '1s',
        },
      ]);

      // Emit resource-updated event
      act(() => {
        emit('resource-updated', { resource: 'configmap', namespace: 'default' });
      });

      await waitFor(() => {
        expect(appApiMocks.GetConfigMaps).toHaveBeenCalled();
      });

      expect(await screen.findByTestId('row-new-config')).toBeInTheDocument();
    });

    it('ignores resource-updated events for other resources', async () => {
      render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-app-config');
      appApiMocks.GetConfigMaps.mockClear();

      act(() => {
        emit('resource-updated', { resource: 'secret', namespace: 'default' });
      });

      // Should not call GetConfigMaps
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(appApiMocks.GetConfigMaps).not.toHaveBeenCalled();
    });

    it('handles configmaps:update event with snapshot data', async () => {
      render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-app-config');

      // Emit direct update with new data
      act(() => {
        emit('configmaps:update', [
          {
            name: 'snapshot-cm',
            namespace: 'default',
            keys: '2 keys',
            size: '800B',
            age: '2s',
          },
        ]);
      });

      expect(await screen.findByTestId('row-snapshot-cm')).toBeInTheDocument();
    });

    it('filters snapshot updates by namespace', async () => {
      render(<ConfigMapsOverviewTable namespace="default" namespaces={['default']} />);

      await screen.findByTestId('row-app-config');

      // Emit update with different namespace
      act(() => {
        emit('configmaps:update', [
          {
            name: 'other-ns-cm',
            namespace: 'kube-system',
            keys: '1 key',
            size: '100B',
            age: '1d',
          },
        ]);
      });

      // Should not appear
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(screen.queryByTestId('row-other-ns-cm')).not.toBeInTheDocument();
    });
  });

  describe('polling behavior', () => {
    it('starts fast polling on mount', async () => {
      render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-app-config');

      // Initial call
      expect(appApiMocks.GetConfigMaps).toHaveBeenCalledTimes(1);

      // Clear and advance timer
      appApiMocks.GetConfigMaps.mockClear();
      
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should poll again after 1 second
      await waitFor(() => {
        expect(appApiMocks.GetConfigMaps).toHaveBeenCalled();
      });
    });

    it('clears timers on unmount', async () => {
      const { unmount } = render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-app-config');

      unmount();

      appApiMocks.GetConfigMaps.mockClear();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should not poll after unmount
      expect(appApiMocks.GetConfigMaps).not.toHaveBeenCalled();
    });
  });

  describe('title and structure', () => {
    it('renders correct title', async () => {
      render(<ConfigMapsOverviewTable namespace="default" />);

      await screen.findByTestId('row-app-config');
      expect(screen.getByTestId('title')).toHaveTextContent('Config Maps');
    });
  });
});
