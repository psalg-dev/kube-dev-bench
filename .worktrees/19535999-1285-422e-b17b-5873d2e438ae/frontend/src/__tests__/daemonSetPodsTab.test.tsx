import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DaemonSetPodsTab from '../k8s/resources/daemonsets/DaemonSetPodsTab';
import type { app } from '../../wailsjs/go/models';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetDaemonSetDetail: vi.fn(),
}));

import { GetDaemonSetDetail } from '../../wailsjs/go/main/App';
const getDetailMock = vi.mocked(GetDaemonSetDetail);
const toDetail = (d: unknown) => d as app.DaemonSetDetail;

describe('DaemonSetPodsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getDetailMock.mockImplementation(() => new Promise(() => {}));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="my-ds" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error message on API failure', async () => {
    getDetailMock.mockRejectedValue(new Error('fetch failed'));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="my-ds" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: fetch failed/i)).toBeInTheDocument();
    });
  });

  it('shows no pods message when pods array is empty', async () => {
    getDetailMock.mockResolvedValue(toDetail({ pods: [] }));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="my-ds" />);
    await waitFor(() => {
      expect(screen.getByText(/No pods found/i)).toBeInTheDocument();
    });
  });

  it('renders table column headers when pods exist', async () => {
    getDetailMock.mockResolvedValue(toDetail({
      pods: [{ name: 'pod-1', status: 'Running', ready: '1/1', restarts: 0, age: '1h', node: 'node-1', ip: '10.0.0.1' }],
    }));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="my-ds" />);
    await waitFor(() => {
      expect(screen.getByText('Node')).toBeInTheDocument();
      expect(screen.getByText('Pod')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });

  it('renders pod rows', async () => {
    getDetailMock.mockResolvedValue(toDetail({
      pods: [
        { name: 'ds-pod-abc', status: 'Running', ready: '1/1', restarts: 0, age: '2h', node: 'node-1', ip: '10.0.0.2' },
      ],
    }));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="my-ds" />);
    await waitFor(() => {
      expect(screen.getByText('ds-pod-abc')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
    });
  });

  it('shows pods on N nodes badge', async () => {
    getDetailMock.mockResolvedValue(toDetail({
      pods: [
        { name: 'pod-a', status: 'Running', ready: '1/1', restarts: 0, age: '1h', node: 'node-1', ip: '10.0.0.1' },
        { name: 'pod-b', status: 'Running', ready: '1/1', restarts: 0, age: '1h', node: 'node-2', ip: '10.0.0.2' },
      ],
    }));
    render(<DaemonSetPodsTab namespace="default" daemonSetName="my-ds" />);
    await waitFor(() => {
      expect(screen.getByText(/2 pods on 2 nodes/i)).toBeInTheDocument();
    });
  });

  it('does not call API when props are missing', () => {
    render(<DaemonSetPodsTab namespace="" daemonSetName="" />);
    expect(getDetailMock).not.toHaveBeenCalled();
  });
});
