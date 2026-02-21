import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../docker/resources/stacks/StackSummaryPanel', () => ({
  StackSummaryPanel: () => <div data-testid="stack-summary" />,
}));
vi.mock('../docker/resources/stacks/StackServicesTab', () => ({
  StackServicesTab: () => <div data-testid="stack-services" />,
}));
vi.mock('../docker/resources/stacks/StackResourcesTab', () => ({
  StackResourcesTab: () => <div data-testid="stack-resources" />,
}));
vi.mock('../docker/resources/stacks/StackComposeTab', () => ({
  StackComposeTab: () => <div data-testid="stack-compose" />,
}));
vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-panel" />,
}));
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

import {
  swarmStackColumns,
  swarmStackTabs,
  renderSwarmStackPanelContent,
} from '../config/resourceConfigs/swarm/stackConfig';

const holmesState = {
  key: '',
  response: null,
  loading: false,
  error: null,
  streamId: null,
  streamingText: '',
  reasoningText: '',
  toolEvents: [],
  contextSteps: [],
  queryTimestamp: null,
};

const mockRow = {
  name: 'my-stack',
  services: 3,
  orchestrator: 'swarm',
};

describe('swarmStackConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('exports at least 2 columns', () => {
      expect(swarmStackColumns.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected column keys', () => {
      const keys = swarmStackColumns.map((c) => c.key);
      expect(keys).toContain('name');
      expect(keys).toContain('services');
    });
  });

  describe('tabs', () => {
    it('exports at least 2 tabs', () => {
      expect(swarmStackTabs.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected tab keys', () => {
      const keys = swarmStackTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('services');
      expect(keys).toContain('compose');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmStackPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders services tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmStackPanelContent(mockRow, 'services', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders networks tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmStackPanelContent(mockRow, 'networks', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders compose tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmStackPanelContent(mockRow, 'compose', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders holmes tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmStackPanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmStackPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn(), {});
      expect(result).toBeNull();
    });
  });
});
