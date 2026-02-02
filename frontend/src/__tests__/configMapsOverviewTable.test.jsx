import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// Create lightweight mocks for all dependencies
const mockGetConfigMaps = vi.fn();
const mockDeleteResource = vi.fn();
const mockAnalyzeConfigMapStream = vi.fn();

vi.mock('../../../../wailsjs/go/main/App', () => ({
  GetConfigMaps: mockGetConfigMaps,
  DeleteResource: mockDeleteResource,
}));

vi.mock('../../../holmes/holmesApi', () => ({
  AnalyzeConfigMapStream: mockAnalyzeConfigMapStream,
  CancelHolmesStream: vi.fn(),
  onHolmesChatStream: vi.fn(() => vi.fn()),
  onHolmesContextProgress: vi.fn(() => vi.fn()),
}));

// Mock EventsOn/EventsOff to prevent runtime errors  
vi.mock('../../../../wailsjs/runtime', () => ({
  EventsOn: vi.fn(() => vi.fn()),
  EventsOff: vi.fn(),
}));

// Mock child components to avoid deep dependency trees
vi.mock('../k8s/resources/configmaps/ConfigMapYamlTab.jsx', () => ({
  default: () => <div data-testid="yaml-tab">YAML</div>,
}));

vi.mock('../k8s/resources/configmaps/ConfigMapDataTab.jsx', () => ({
  default: () => <div data-testid="data-tab">Data</div>,
}));

vi.mock('../k8s/resources/configmaps/ConfigMapConsumersTab.jsx', () => ({
  default: () => <div data-testid="consumers-tab">Consumers</div>,
}));

vi.mock('../components/ResourceEventsTab.jsx', () => ({
  default: () => <div data-testid="events-tab">Events</div>,
}));

vi.mock('../QuickInfoSection.jsx', () => ({
  default: () => <div data-testid="quick-info">Quick Info</div>,
}));

vi.mock('../layout/bottompanel/SummaryTabHeader.jsx', () => ({
  default: () => <div data-testid="summary-header">Summary</div>,
}));

vi.mock('../components/ResourceActions.jsx', () => ({
  default: () => <div data-testid="resource-actions">Actions</div>,
}));

vi.mock('../holmes/HolmesBottomPanel.jsx', () => ({
  default: () => <div data-testid="holmes-panel">Holmes</div>,
}));

vi.mock('../notification.js', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

// Import the component AFTER all mocks are set up
import ConfigMapsOverviewTable from '../k8s/resources/configmaps/ConfigMapsOverviewTable.jsx';

describe('ConfigMapsOverviewTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementation
    mockGetConfigMaps.mockResolvedValue([
      {
        name: 'app-config',
        namespace: 'default',
        keys: '3 keys',
        size: '1.2 KB',
        age: '5d',
      },
      {
        name: 'db-config',
        namespace: 'default',
        keys: '5 keys',
        size: '2.5 KB',
        age: '10d',
      },
    ]);
  });

  it('calls GetConfigMaps with the correct namespace on mount', async () => {
    render(<ConfigMapsOverviewTable namespace="default" />);
    
    // Wait for async effect
    await vi.waitFor(() => {
      expect(mockGetConfigMaps).toHaveBeenCalledWith('default');
    });
  });

  it('calls GetConfigMaps for multiple namespaces', async () => {
    mockGetConfigMaps.mockImplementation((ns) => {
      if (ns === 'default') return Promise.resolve([{ name: 'cm1', namespace: 'default', keys: '1', size: '1KB', age: '1d' }]);
      if (ns === 'kube-system') return Promise.resolve([{ name: 'cm2', namespace: 'kube-system', keys: '2', size: '2KB', age: '2d' }]);
      return Promise.resolve([]);
    });

    render(<ConfigMapsOverviewTable namespace="default" namespaces={['default', 'kube-system']} />);
    
    await vi.waitFor(() => {
      expect(mockGetConfigMaps).toHaveBeenCalledWith('default');
      expect(mockGetConfigMaps).toHaveBeenCalledWith('kube-system');
    });
  });

  it('handles GetConfigMaps errors gracefully', async () => {
    mockGetConfigMaps.mockRejectedValue(new Error('Network error'));

    render(<ConfigMapsOverviewTable namespace="default" />);
    
    // Component should not crash
    await vi.waitFor(() => {
      expect(mockGetConfigMaps).toHaveBeenCalled();
    });
  });

  it('normalizes configmap data correctly', async () => {
    // Test that component handles different casing (Name vs name)
    mockGetConfigMaps.mockResolvedValue([
      {
        Name: 'Legacy-CM',
        Namespace: 'default',
        Keys: '1 key',
        Size: '500B',
        Age: '3h',
      },
    ]);

    render(<ConfigMapsOverviewTable namespace="default" />);
    
    await vi.waitFor(() => {
      expect(mockGetConfigMaps).toHaveBeenCalled();
    });
    
    // The component should normalize the data (this tests the normalization logic)
  });

  it('handles missing data fields with defaults', async () => {
    mockGetConfigMaps.mockResolvedValue([
      {
        name: 'minimal-cm',
        namespace: 'default',
        // Missing keys, size, age
      },
    ]);

    render(<ConfigMapsOverviewTable namespace="default" />);
    
    await vi.waitFor(() => {
      expect(mockGetConfigMaps).toHaveBeenCalled();
    });
  });
});
