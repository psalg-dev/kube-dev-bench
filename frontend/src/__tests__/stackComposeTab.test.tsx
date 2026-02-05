import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StackComposeTab from '../docker/resources/stacks/StackComposeTab';

// Mock swarmApi
vi.mock('../docker/swarmApi', () => ({
  GetSwarmStackComposeYAML: vi.fn(),
}));

// Mock YamlTab
vi.mock('../layout/bottompanel/YamlTab', () => ({
  default: ({ content, loading, error }: { content?: string; loading?: boolean; error?: string }) => (
    <div data-testid="yaml-tab">
      {loading && <div>Loading yaml...</div>}
      {error && <div>Error: {error}</div>}
      {!loading && !error && <pre data-testid="yaml-content">{content}</pre>}
    </div>
  ),
}));

import { GetSwarmStackComposeYAML } from '../docker/swarmApi';

const getSwarmStackComposeMock = vi.mocked(GetSwarmStackComposeYAML);

describe('StackComposeTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      getSwarmStackComposeMock.mockImplementation(() => new Promise(() => {}));

      render(<StackComposeTab stackName="my-stack" />);

      expect(screen.getByText(/Loading yaml/)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      getSwarmStackComposeMock.mockRejectedValue(new Error('Stack not found'));

      render(<StackComposeTab stackName="my-stack" />);

      await waitFor(() => {
        expect(screen.getByText(/Stack not found/)).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays the disclaimer message', async () => {
      getSwarmStackComposeMock.mockResolvedValue('version: "3.8"');

      render(<StackComposeTab stackName="my-stack" />);

      await waitFor(() => {
        expect(screen.getByText(/derived from current service specs/)).toBeInTheDocument();
        expect(screen.getByText(/not source-of-truth/)).toBeInTheDocument();
      });
    });

    it('displays compose YAML content', async () => {
      const mockYaml = 'version: "3.8"\nservices:\n  web:\n    image: nginx';
      getSwarmStackComposeMock.mockResolvedValue(mockYaml);

      render(<StackComposeTab stackName="my-stack" />);

      await waitFor(() => {
        const content = screen.getByTestId('yaml-content');
        expect(content.textContent).toBe(mockYaml);
      });
    });
  });

  describe('API calls', () => {
    it('calls API with correct stackName', async () => {
      getSwarmStackComposeMock.mockResolvedValue('');

      render(<StackComposeTab stackName="test-stack" />);

      await waitFor(() => {
        expect(GetSwarmStackComposeYAML).toHaveBeenCalledWith('test-stack');
      });
    });

    it('re-fetches when stackName changes', async () => {
      getSwarmStackComposeMock.mockResolvedValue('');

      const { rerender } = render(<StackComposeTab stackName="stack-1" />);

      await waitFor(() => {
        expect(GetSwarmStackComposeYAML).toHaveBeenCalledWith('stack-1');
      });

      rerender(<StackComposeTab stackName="stack-2" />);

      await waitFor(() => {
        expect(GetSwarmStackComposeYAML).toHaveBeenCalledWith('stack-2');
      });
    });
  });
});
