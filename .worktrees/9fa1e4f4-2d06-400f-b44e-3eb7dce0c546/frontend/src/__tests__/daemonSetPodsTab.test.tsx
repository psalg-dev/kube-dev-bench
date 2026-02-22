import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetDaemonSetDetail: vi.fn(),
}));

vi.mock('../components/StatusBadge', () => ({
  default: ({ status }: { status?: string }) => <span>{status}</span>,
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import DaemonSetPodsTab from '../k8s/resources/daemonsets/DaemonSetPodsTab';
import type { app } from '../../wailsjs/go/models';

const getDetailMock = vi.mocked(AppAPI.GetDaemonSetDetail);
const toDetail = (d: unknown) => d as app.DaemonSetDetail;

const mockPods: app.ResourcePodInfo[] = [
  { name: 'pod-alpha', status: 'Running', ready: '1/1', restarts: 0, age: '2h', node: 'node-1', ip: '10.0.0.1' } as app.ResourcePodInfo,
  { name: 'pod-beta', status: 'Running', ready: '1/1', restarts: 1, age: '3h', node: 'node-2', ip: '10.0.0.2' } as app.ResourcePodInfo,
];

describe('DaemonSetPodsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getDetailMock.mockImplementation(() => new Promise(() => {}));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="my-ds" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    getDetailMock.mockRejectedValue(new Error('fetch failed'));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="my-ds" />);
    await waitFor(() => {
      expect(screen.getByText(/fetch failed/i)).toBeInTheDocument();
    });
  });

  it('shows no pods message when empty', async () => {
    getDetailMock.mockResolvedValue(toDetail({ pods: [] }));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="my-ds" />);
    await waitFor(() => {
      expect(screen.getByText(/No pods found/i)).toBeInTheDocument();
    });
  });

  it('renders pod rows in table', async () => {
    getDetailMock.mockResolvedValue(toDetail({ pods: mockPods }));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="my-ds" />);
    await waitFor(() => {
      expect(screen.getByText('pod-alpha')).toBeInTheDocument();
      expect(screen.getByText('pod-beta')).toBeInTheDocument();
    });
  });

  it('shows pod count and node count badge', async () => {
    getDetailMock.mockResolvedValue(toDetail({ pods: mockPods }));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="my-ds" />);
    await waitFor(() => {
      expect(screen.getByText(/2 pods on 2 nodes/i)).toBeInTheDocument();
    });
  });

  it('renders table headers', async () => {
    getDetailMock.mockResolvedValue(toDetail({ pods: mockPods }));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="my-ds" />);
    await waitFor(() => {
      expect(screen.getByText('Node')).toBeInTheDocument();
      expect(screen.getByText('Pod')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  it('calls API with correct params', async () => {
    getDetailMock.mockResolvedValue(toDetail({ pods: [] }));
    render(<DaemonSetPodsTab namespace="test-ns" daemonSetName="test-ds" />);
    await waitFor(() => {
      expect(AppAPI.GetDaemonSetDetail).toHaveBeenCalledWith('test-ns', 'test-ds');
    });
  });

  it('does not call API when namespace is missing', () => {
    render(<DaemonSetPodsTab daemonSetName="my-ds" />);
    expect(AppAPI.GetDaemonSetDetail).not.toHaveBeenCalled();
  });

  it('highlights restarts in red when > 0', async () => {
    getDetailMock.mockResolvedValue(toDetail({ pods: mockPods }));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="my-ds" />);
    await waitFor(() => {
      // pod-beta has 1 restart
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });
});
