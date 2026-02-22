import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DaemonSetNodeCoverageTab from '../k8s/resources/daemonsets/DaemonSetNodeCoverageTab';
import type { app } from '../../wailsjs/go/models';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetDaemonSetNodeCoverage: vi.fn(),
}));

import { GetDaemonSetNodeCoverage } from '../../wailsjs/go/main/App';

const getDaemonSetNodeCoverageMock = vi.mocked(GetDaemonSetNodeCoverage);
const toCoverage = (data: unknown) => data as app.DaemonSetNodeCoverage;

describe('DaemonSetNodeCoverageTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading indicator initially', () => {
      getDaemonSetNodeCoverageMock.mockImplementation(() => new Promise(() => {}));

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      getDaemonSetNodeCoverageMock.mockRejectedValue(new Error('Connection failed'));

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      await waitFor(() => {
        expect(screen.getByText(/Error: Connection failed/)).toBeInTheDocument();
      });
    });

    it('handles non-Error exceptions', async () => {
      getDaemonSetNodeCoverageMock.mockRejectedValue('Some error');

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      await waitFor(() => {
        expect(screen.getByText(/Error: Some error/)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows no nodes message when nodes array is empty', async () => {
      getDaemonSetNodeCoverageMock.mockResolvedValue(toCoverage({ nodes: [] }));

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      await waitFor(() => {
        expect(screen.getByText('No nodes found.')).toBeInTheDocument();
      });
    });

    it('shows no nodes message when data is null', async () => {
      getDaemonSetNodeCoverageMock.mockResolvedValue(toCoverage(null));

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      await waitFor(() => {
        expect(screen.getByText('No nodes found.')).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays table with node coverage data', async () => {
      getDaemonSetNodeCoverageMock.mockResolvedValue(toCoverage({
        nodes: [
          { node: 'node-1', hasPod: true, podName: 'nginx-ds-abc', podStatus: 'Running', ready: 'True' },
          { node: 'node-2', hasPod: false, podName: '', podStatus: '', ready: 'True' },
        ],
      }));

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      await waitFor(() => {
        expect(screen.getByText('node-1')).toBeInTheDocument();
        expect(screen.getByText('node-2')).toBeInTheDocument();
      });
    });

    it('shows Covered for nodes with pods', async () => {
      getDaemonSetNodeCoverageMock.mockResolvedValue(toCoverage({
        nodes: [
          { node: 'node-1', hasPod: true, podName: 'nginx-ds-abc', podStatus: 'Running', ready: 'True' },
        ],
      }));

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      await waitFor(() => {
        expect(screen.getByText('Covered')).toBeInTheDocument();
      });
    });

    it('shows Missing for nodes without pods', async () => {
      getDaemonSetNodeCoverageMock.mockResolvedValue(toCoverage({
        nodes: [
          { node: 'node-2', hasPod: false, podName: '', podStatus: '', ready: 'True' },
        ],
      }));

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      await waitFor(() => {
        expect(screen.getByText('Missing')).toBeInTheDocument();
      });
    });

    it('displays pod name when available', async () => {
      getDaemonSetNodeCoverageMock.mockResolvedValue(toCoverage({
        nodes: [
          { node: 'node-1', hasPod: true, podName: 'nginx-ds-xyz123', podStatus: 'Running', ready: 'True' },
        ],
      }));

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      await waitFor(() => {
        expect(screen.getByText('nginx-ds-xyz123')).toBeInTheDocument();
      });
    });

    it('displays pod status', async () => {
      getDaemonSetNodeCoverageMock.mockResolvedValue(toCoverage({
        nodes: [
          { node: 'node-1', hasPod: true, podName: 'nginx-ds-abc', podStatus: 'Running', ready: 'True' },
        ],
      }));

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      await waitFor(() => {
        expect(screen.getByText('Running')).toBeInTheDocument();
      });
    });

    it('displays ready status', async () => {
      getDaemonSetNodeCoverageMock.mockResolvedValue(toCoverage({
        nodes: [
          { node: 'node-1', hasPod: true, podName: 'nginx-ds-abc', podStatus: 'Running', ready: 'True' },
        ],
      }));

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      await waitFor(() => {
        expect(screen.getByText('True')).toBeInTheDocument();
      });
    });

    it('shows dash for missing pod name', async () => {
      getDaemonSetNodeCoverageMock.mockResolvedValue(toCoverage({
        nodes: [
          { node: 'node-1', hasPod: false, podName: '', podStatus: '', ready: 'True' },
        ],
      }));

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      await waitFor(() => {
        const cells = screen.getAllByText('-');
        expect(cells.length).toBeGreaterThan(0);
      });
    });
  });

  describe('API integration', () => {
    it('calls API with correct namespace and daemonSetName', async () => {
      getDaemonSetNodeCoverageMock.mockResolvedValue(toCoverage({ nodes: [] }));

      render(<DaemonSetNodeCoverageTab namespace="kube-system" daemonSetName="kube-proxy" />);

      await waitFor(() => {
        expect(GetDaemonSetNodeCoverage).toHaveBeenCalledWith('kube-system', 'kube-proxy');
      });
    });

    it('does not call API when namespace is missing', () => {
      render(<DaemonSetNodeCoverageTab namespace="" daemonSetName="nginx-ds" />);

      expect(GetDaemonSetNodeCoverage).not.toHaveBeenCalled();
    });

    it('does not call API when daemonSetName is missing', () => {
      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="" />);

      expect(GetDaemonSetNodeCoverage).not.toHaveBeenCalled();
    });
  });

  describe('table headers', () => {
    it('renders all column headers', async () => {
      getDaemonSetNodeCoverageMock.mockResolvedValue(toCoverage({
        nodes: [{ node: 'node-1', hasPod: true, podName: 'pod-1', podStatus: 'Running', ready: 'True' }],
      }));

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      await waitFor(() => {
        expect(screen.getByText('Node')).toBeInTheDocument();
        expect(screen.getByText('Coverage')).toBeInTheDocument();
        expect(screen.getByText('Pod')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Ready')).toBeInTheDocument();
      });
    });
  });

  describe('alternative data format (capitalized fields)', () => {
    it('handles Node/Nodes capitalized format', async () => {
      getDaemonSetNodeCoverageMock.mockResolvedValue(toCoverage({
        Nodes: [
          { Node: 'node-1', HasPod: true, PodName: 'nginx-ds-abc', PodStatus: 'Running', Ready: 'True' },
        ],
      }));

      render(<DaemonSetNodeCoverageTab namespace="default" daemonSetName="nginx-ds" />);

      await waitFor(() => {
        expect(screen.getByText('node-1')).toBeInTheDocument();
        expect(screen.getByText('nginx-ds-abc')).toBeInTheDocument();
        expect(screen.getByText('Covered')).toBeInTheDocument();
      });
    });
  });
});

