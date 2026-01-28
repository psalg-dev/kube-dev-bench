import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StackComposeTab from '../docker/resources/stacks/StackComposeTab';

// Mock swarmApi
vi.mock('../docker/swarmApi.js', () => ({
  GetSwarmStackComposeYAML: vi.fn(),
}));

// Mock YamlTab
vi.mock('../layout/bottompanel/YamlTab.jsx', () => ({
  default: ({ content, loading, error }) => (
    <div data-testid="yaml-tab">
      {loading && <div>Loading yaml...</div>}
      {error && <div>Error: {error}</div>}
      {!loading && !error && <pre data-testid="yaml-content">{content}</pre>}
    </div>
  ),
}));

import { GetSwarmStackComposeYAML } from '../docker/swarmApi.js';

describe('StackComposeTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      GetSwarmStackComposeYAML.mockImplementation(() => new Promise(() => {}));
      
      render(<StackComposeTab stackName="my-stack" />);
      
      expect(screen.getByText(/Loading yaml/)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      GetSwarmStackComposeYAML.mockRejectedValue(new Error('Stack not found'));
      
      render(<StackComposeTab stackName="my-stack" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Stack not found/)).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays the disclaimer message', async () => {
      GetSwarmStackComposeYAML.mockResolvedValue('version: "3.8"');
      
      render(<StackComposeTab stackName="my-stack" />);
      
      expect(screen.getByText(/derived from current service specs/)).toBeInTheDocument();
      expect(screen.getByText(/not source-of-truth/)).toBeInTheDocument();
    });

    it('displays compose YAML content', async () => {
      const mockYaml = 'version: "3.8"\nservices:\n  web:\n    image: nginx';
      GetSwarmStackComposeYAML.mockResolvedValue(mockYaml);
      
      render(<StackComposeTab stackName="my-stack" />);
      
      await waitFor(() => {
        const content = screen.getByTestId('yaml-content');
        expect(content.textContent).toBe(mockYaml);
      });
    });
  });

  describe('API calls', () => {
    it('calls API with correct stackName', async () => {
      GetSwarmStackComposeYAML.mockResolvedValue('');
      
      render(<StackComposeTab stackName="test-stack" />);
      
      await waitFor(() => {
        expect(GetSwarmStackComposeYAML).toHaveBeenCalledWith('test-stack');
      });
    });

    it('re-fetches when stackName changes', async () => {
      GetSwarmStackComposeYAML.mockResolvedValue('');
      
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
