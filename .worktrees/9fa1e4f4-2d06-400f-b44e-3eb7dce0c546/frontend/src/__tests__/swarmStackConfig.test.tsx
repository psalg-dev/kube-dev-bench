import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ResourceRow } from '../types/resourceConfigs';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import {
  swarmStackColumns,
  swarmStackTabs,
  swarmStackConfig,
  renderSwarmStackPanelContent,
} from '../config/resourceConfigs/swarm/stackConfig';

vi.mock('../docker/resources/stacks/StackSummaryPanel', () => ({
  StackSummaryPanel: () => <div data-testid="stack-summary-panel" />,
}));
vi.mock('../docker/resources/stacks/StackServicesTab', () => ({
  StackServicesTab: () => <div data-testid="stack-services-tab" />,
}));
vi.mock('../docker/resources/stacks/StackResourcesTab', () => ({
  StackResourcesTab: () => <div data-testid="stack-resources-tab" />,
}));
vi.mock('../docker/resources/stacks/StackComposeTab', () => ({
  StackComposeTab: () => <div data-testid="stack-compose-tab" />,
}));
vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-bottom-panel" />,
}));

const mockHolmesState: HolmesAnalysisState = {
  loading: false,
  response: null,
  error: null,
  key: null,
  streamId: null,
  streamingText: '',
  reasoningText: '',
  queryTimestamp: null,
  contextSteps: [],
  toolEvents: [],
};

const mockRow: ResourceRow = {
  name: 'my-stack',
  services: 3,
  orchestrator: 'Swarm',
};

describe('swarmStackConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('has the expected column keys', () => {
      const keys = swarmStackColumns.map((c) => c.key);
      expect(keys).toContain('name');
      expect(keys).toContain('services');
      expect(keys).toContain('orchestrator');
    });

    it('has correct labels for columns', () => {
      const nameCol = swarmStackColumns.find((c) => c.key === 'name');
      expect(nameCol?.label).toBe('Name');
      const servicesCol = swarmStackColumns.find((c) => c.key === 'services');
      expect(servicesCol?.label).toBe('Services');
    });
  });

  describe('tabs', () => {
    it('has the expected tab keys', () => {
      const keys = swarmStackTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('services');
      expect(keys).toContain('networks');
      expect(keys).toContain('volumes');
      expect(keys).toContain('configs');
      expect(keys).toContain('secrets');
      expect(keys).toContain('compose');
      expect(keys).toContain('holmes');
    });
  });

  describe('config object', () => {
    it('has correct resourceType and title', () => {
      expect(swarmStackConfig.resourceType).toBe('swarm-stack');
      expect(swarmStackConfig.title).toBe('Swarm Stacks');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without crashing', () => {
      render(<>{renderSwarmStackPanelContent(mockRow, 'summary', mockHolmesState, undefined, undefined)}</>);
      expect(screen.getByTestId('stack-summary-panel')).toBeInTheDocument();
    });

    it('renders services tab without crashing', () => {
      render(<>{renderSwarmStackPanelContent(mockRow, 'services', mockHolmesState, undefined, undefined)}</>);
      expect(screen.getByTestId('stack-services-tab')).toBeInTheDocument();
    });

    it('renders networks tab without crashing', () => {
      render(<>{renderSwarmStackPanelContent(mockRow, 'networks', mockHolmesState, undefined, undefined)}</>);
      expect(screen.getByTestId('stack-resources-tab')).toBeInTheDocument();
    });

    it('renders volumes tab without crashing', () => {
      render(<>{renderSwarmStackPanelContent(mockRow, 'volumes', mockHolmesState, undefined, undefined)}</>);
      expect(screen.getByTestId('stack-resources-tab')).toBeInTheDocument();
    });

    it('renders configs tab without crashing', () => {
      render(<>{renderSwarmStackPanelContent(mockRow, 'configs', mockHolmesState, undefined, undefined)}</>);
      expect(screen.getByTestId('stack-resources-tab')).toBeInTheDocument();
    });

    it('renders secrets tab without crashing', () => {
      render(<>{renderSwarmStackPanelContent(mockRow, 'secrets', mockHolmesState, undefined, undefined)}</>);
      expect(screen.getByTestId('stack-resources-tab')).toBeInTheDocument();
    });

    it('renders compose tab without crashing', () => {
      render(<>{renderSwarmStackPanelContent(mockRow, 'compose', mockHolmesState, undefined, undefined)}</>);
      expect(screen.getByTestId('stack-compose-tab')).toBeInTheDocument();
    });

    it('renders holmes tab without crashing', () => {
      render(<>{renderSwarmStackPanelContent(mockRow, 'holmes', mockHolmesState, undefined, undefined)}</>);
      expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmStackPanelContent(mockRow, 'unknown', mockHolmesState, undefined, undefined);
      expect(result).toBeNull();
    });
  });
});
