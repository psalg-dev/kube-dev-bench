import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DaemonSetPodsTab from '../k8s/resources/daemonsets/DaemonSetPodsTab';
import type { app } from '../../wailsjs/go/models';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetDaemonSetDetail: vi.fn(),
}));

import { GetDaemonSetDetail } from '../../wailsjs/go/main/App';
const getDaemonSetDetailMock = vi.mocked(GetDaemonSetDetail);

const toDetail = (data: unknown) => data as app.DaemonSetDetail;

describe('DaemonSetPodsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getDaemonSetDetailMock.mockImplementation(() => new Promise(() => {}));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="nginx-ds" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error message when API call fails', async () => {
    getDaemonSetDetailMock.mockRejectedValue(new Error('API error'));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="nginx-ds" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: API error/)).toBeInTheDocument();
    });
  });

  it('shows no pods found message when detail is null', async () => {
    getDaemonSetDetailMock.mockResolvedValue(toDetail(null));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="nginx-ds" />);
    await waitFor(() => {
      expect(screen.getByText(/No pods found for this DaemonSet/)).toBeInTheDocument();
    });
  });

  it('shows no pods found when pods array is empty', async () => {
    getDaemonSetDetailMock.mockResolvedValue(toDetail({ pods: [] }));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="nginx-ds" />);
    await waitFor(() => {
      expect(screen.getByText(/No pods found for this DaemonSet/)).toBeInTheDocument();
    });
  });

  it('renders table columns when pods are present', async () => {
    getDaemonSetDetailMock.mockResolvedValue(toDetail({
      pods: [
        { name: 'nginx-ds-abc', node: 'node-1', status: 'Running', ready: '1/1', restarts: 0, age: '2d', ip: '10.0.0.1' },
      ],
    }));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="nginx-ds" />);
    await waitFor(() => {
      expect(screen.getByText('Node')).toBeInTheDocument();
      expect(screen.getByText('Pod')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  it('renders pod rows with correct data', async () => {
    getDaemonSetDetailMock.mockResolvedValue(toDetail({
      pods: [
        { name: 'nginx-ds-xyz', node: 'worker-node', status: 'Running', ready: '1/1', restarts: 0, age: '1d', ip: '10.0.0.5' },
      ],
    }));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="nginx-ds" />);
    await waitFor(() => {
      expect(screen.getByText('nginx-ds-xyz')).toBeInTheDocument();
      expect(screen.getByText('worker-node')).toBeInTheDocument();
    });
  });

  it('shows pod count badge', async () => {
    getDaemonSetDetailMock.mockResolvedValue(toDetail({
      pods: [
        { name: 'pod-1', node: 'node-1', status: 'Running', ready: '1/1', restarts: 0, age: '1d', ip: '10.0.0.1' },
        { name: 'pod-2', node: 'node-2', status: 'Running', ready: '1/1', restarts: 0, age: '1d', ip: '10.0.0.2' },
      ],
    }));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="nginx-ds" />);
    await waitFor(() => {
      expect(screen.getByText(/2 pods on/)).toBeInTheDocument();
    });
  });

  it('does not call API when namespace is missing', () => {
    render(<DaemonSetPodsTab daemonSetName="nginx-ds" />);
    expect(getDaemonSetDetailMock).not.toHaveBeenCalled();
  });

  it('does not call API when daemonSetName is missing', () => {
    render(<DaemonSetPodsTab namespace="default" />);
    expect(getDaemonSetDetailMock).not.toHaveBeenCalled();
  });

  it('calls API with correct arguments', async () => {
    getDaemonSetDetailMock.mockResolvedValue(toDetail({ pods: [] }));
    render(<DaemonSetPodsTab namespace="kube-system" daemonSetName="kube-proxy" />);
    await waitFor(() => {
      expect(getDaemonSetDetailMock).toHaveBeenCalledWith('kube-system', 'kube-proxy');
    });
  });
});
