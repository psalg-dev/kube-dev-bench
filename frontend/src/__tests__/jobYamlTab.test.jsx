import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JobYamlTab from '../k8s/resources/jobs/JobYamlTab';

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetJobYAML: vi.fn(),
}));

// Mock clipboard
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, writable: true });

import * as AppAPI from '../../wailsjs/go/main/App';

describe('JobYamlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      AppAPI.GetJobYAML.mockImplementation(() => new Promise(() => {}));
      
      render(<JobYamlTab namespace="default" name="my-job" />);
      
      expect(screen.getByText(/loading yaml/i)).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    it('displays job name in header', async () => {
      AppAPI.GetJobYAML.mockResolvedValue('');
      
      render(<JobYamlTab namespace="default" name="batch-job" />);
      
      expect(screen.getByText(/YAML for batch-job/)).toBeInTheDocument();
    });

    it('displays action buttons', async () => {
      AppAPI.GetJobYAML.mockResolvedValue('');
      
      render(<JobYamlTab namespace="default" name="my-job" />);
      
      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      AppAPI.GetJobYAML.mockRejectedValue(new Error('Job not found'));
      
      render(<JobYamlTab namespace="default" name="my-job" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Job not found/)).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls API on refresh button click', async () => {
      AppAPI.GetJobYAML.mockResolvedValue('completions: 1');
      
      render(<JobYamlTab namespace="default" name="my-job" />);
      
      await waitFor(() => {
        expect(AppAPI.GetJobYAML).toHaveBeenCalledWith('default', 'my-job');
      });

      fireEvent.click(screen.getByText('Refresh'));
      
      await waitFor(() => {
        expect(AppAPI.GetJobYAML).toHaveBeenCalledTimes(2);
      });
    });

    it('copies content to clipboard on copy button click', async () => {
      const mockYaml = 'apiVersion: batch/v1\nkind: Job';
      AppAPI.GetJobYAML.mockResolvedValue(mockYaml);
      
      render(<JobYamlTab namespace="default" name="my-job" />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading yaml/i)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Copy'));
      
      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockYaml);
    });
  });

  describe('API calls', () => {
    it('does not call API when namespace is missing', async () => {
      render(<JobYamlTab namespace="" name="my-job" />);
      
      await new Promise(r => setTimeout(r, 50));
      
      expect(AppAPI.GetJobYAML).not.toHaveBeenCalled();
    });

    it('does not call API when name is missing', async () => {
      render(<JobYamlTab namespace="default" name="" />);
      
      await new Promise(r => setTimeout(r, 50));
      
      expect(AppAPI.GetJobYAML).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      AppAPI.GetJobYAML.mockResolvedValue('yaml: content');
      
      const { rerender } = render(<JobYamlTab namespace="ns1" name="job-1" />);
      
      await waitFor(() => {
        expect(AppAPI.GetJobYAML).toHaveBeenCalledWith('ns1', 'job-1');
      });

      rerender(<JobYamlTab namespace="ns2" name="job-2" />);
      
      await waitFor(() => {
        expect(AppAPI.GetJobYAML).toHaveBeenCalledWith('ns2', 'job-2');
      });
    });
  });
});
