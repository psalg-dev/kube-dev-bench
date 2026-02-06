import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import JobPodsTab from '../k8s/resources/jobs/JobPodsTab';

const mockGetJobDetail = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetJobDetail: (...args: unknown[]) => mockGetJobDetail(...args),
}));

describe('JobPodsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      mockGetJobDetail.mockImplementation(() => new Promise(() => {}));

      render(<JobPodsTab namespace="default" jobName="my-job" />);

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      mockGetJobDetail.mockRejectedValue(new Error('Connection failed'));

      render(<JobPodsTab namespace="default" jobName="my-job" />);

      await waitFor(() => {
        expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
      });
    });

    it('shows generic error when no message provided', async () => {
      mockGetJobDetail.mockRejectedValue({});

      render(<JobPodsTab namespace="default" jobName="my-job" />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch job details/i)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows no pods message when pods array is empty', async () => {
      mockGetJobDetail.mockResolvedValue({ pods: [] });

      render(<JobPodsTab namespace="default" jobName="my-job" />);

      await waitFor(() => {
        expect(screen.getByText(/No pods found for this job/i)).toBeInTheDocument();
      });
    });

    it('handles null pods', async () => {
      mockGetJobDetail.mockResolvedValue({ pods: null });

      render(<JobPodsTab namespace="default" jobName="my-job" />);

      await waitFor(() => {
        expect(screen.getByText(/No pods found for this job/i)).toBeInTheDocument();
      });
    });

    it('handles null response', async () => {
      mockGetJobDetail.mockResolvedValue(null);

      render(<JobPodsTab namespace="default" jobName="my-job" />);

      await waitFor(() => {
        expect(screen.getByText(/No pods found for this job/i)).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    const mockDetail = {
      pods: [
        { name: 'job-pod-1', status: 'Succeeded', ready: '0/1', restarts: 0, age: '5m', node: 'node-1' },
        { name: 'job-pod-2', status: 'Running', ready: '1/1', restarts: 0, age: '2m', node: 'node-2' },
        { name: 'job-pod-3', status: 'Failed', ready: '0/1', restarts: 1, age: '10m', node: 'node-1' },
      ],
      conditions: [
        { type: 'Complete', status: 'True', reason: 'Finished', message: 'Job completed successfully' },
      ],
    };

    it('displays pods in table', async () => {
      mockGetJobDetail.mockResolvedValue(mockDetail);

      render(<JobPodsTab namespace="default" jobName="my-job" />);

      await waitFor(() => {
        expect(screen.getByText('job-pod-1')).toBeInTheDocument();
        expect(screen.getByText('job-pod-2')).toBeInTheDocument();
        expect(screen.getByText('job-pod-3')).toBeInTheDocument();
      });
    });

    it('displays pod status badges', async () => {
      mockGetJobDetail.mockResolvedValue(mockDetail);

      render(<JobPodsTab namespace="default" jobName="my-job" />);

      await waitFor(() => {
        expect(screen.getByText('Succeeded')).toBeInTheDocument();
        expect(screen.getByText('Running')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });
    });

    it('displays pod node names', async () => {
      mockGetJobDetail.mockResolvedValue(mockDetail);

      render(<JobPodsTab namespace="default" jobName="my-job" />);

      await waitFor(() => {
        expect(screen.getAllByText('node-1').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('node-2')).toBeInTheDocument();
      });
    });

    it('displays conditions section when available', async () => {
      mockGetJobDetail.mockResolvedValue(mockDetail);

      render(<JobPodsTab namespace="default" jobName="my-job" />);

      await waitFor(() => {
        expect(screen.getByText('Conditions')).toBeInTheDocument();
        expect(screen.getByText('Complete')).toBeInTheDocument();
      });
    });
  });

  describe('sorting', () => {
    const mockDetail = {
      pods: [
        { name: 'pod-b', status: 'Running', ready: '1/1', restarts: 0, age: '5m', node: 'node-1' },
        { name: 'pod-a', status: 'Running', ready: '1/1', restarts: 2, age: '10m', node: 'node-2' },
        { name: 'pod-c', status: 'Succeeded', ready: '0/1', restarts: 0, age: '15m', node: 'node-1' },
      ],
      conditions: [],
    };

    it('can sort by name column', async () => {
      mockGetJobDetail.mockResolvedValue(mockDetail);

      render(<JobPodsTab namespace="default" jobName="my-job" />);

      await waitFor(() => {
        expect(screen.getByText('pod-a')).toBeInTheDocument();
      });

      const nameHeader = screen.getByRole('button', { name: /Name/ });
      fireEvent.click(nameHeader);
    });

    it('can sort by status column', async () => {
      mockGetJobDetail.mockResolvedValue(mockDetail);

      render(<JobPodsTab namespace="default" jobName="my-job" />);

      await waitFor(() => {
        expect(screen.getByText('pod-a')).toBeInTheDocument();
      });

      const statusHeader = screen.getByRole('button', { name: /Status/ });
      fireEvent.click(statusHeader);
    });
  });

  describe('API calls', () => {
    it('calls GetJobDetail with correct params', async () => {
      mockGetJobDetail.mockResolvedValue({ pods: [] });

      render(<JobPodsTab namespace="test-ns" jobName="test-job" />);

      await waitFor(() => {
        expect(mockGetJobDetail).toHaveBeenCalledWith('test-ns', 'test-job');
      });
    });

    it('does not call API when namespace is missing', () => {
      render(<JobPodsTab namespace="" jobName="my-job" />);

      expect(mockGetJobDetail).not.toHaveBeenCalled();
    });

    it('does not call API when jobName is missing', () => {
      render(<JobPodsTab namespace="default" jobName="" />);

      expect(mockGetJobDetail).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      mockGetJobDetail.mockResolvedValue({ pods: [] });

      const { rerender } = render(<JobPodsTab namespace="ns1" jobName="job1" />);

      await waitFor(() => {
        expect(mockGetJobDetail).toHaveBeenCalledWith('ns1', 'job1');
      });

      rerender(<JobPodsTab namespace="ns2" jobName="job2" />);

      await waitFor(() => {
        expect(mockGetJobDetail).toHaveBeenCalledWith('ns2', 'job2');
      });
    });
  });
});
