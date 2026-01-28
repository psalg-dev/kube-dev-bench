import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the App API
const mockGetDeploymentDetail = vi.fn();
const mockGetStatefulSetDetail = vi.fn();
const mockGetDaemonSetDetail = vi.fn();
const mockGetReplicaSetDetail = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetDeploymentDetail: (...args) => mockGetDeploymentDetail(...args),
  GetStatefulSetDetail: (...args) => mockGetStatefulSetDetail(...args),
  GetDaemonSetDetail: (...args) => mockGetDaemonSetDetail(...args),
  GetReplicaSetDetail: (...args) => mockGetReplicaSetDetail(...args),
}));

import ResourcePodsTab from '../components/ResourcePodsTab';

describe('ResourcePodsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockGetDeploymentDetail.mockReturnValue(new Promise(() => {}));

    render(
      <ResourcePodsTab
        namespace="default"
        resourceName="test-deploy"
        resourceKind="Deployment"
      />,
    );

    expect(screen.getByText(/loading pods/i)).toBeInTheDocument();
  });

  it('renders pods for Deployment', async () => {
    const mockDetail = {
      pods: [
        {
          name: 'test-deploy-abc123',
          status: 'Running',
          ready: '1/1',
          restarts: 0,
          age: '2h',
          node: 'node-1',
        },
        {
          name: 'test-deploy-def456',
          status: 'Running',
          ready: '1/1',
          restarts: 1,
          age: '2h',
          node: 'node-2',
        },
      ],
    };

    mockGetDeploymentDetail.mockResolvedValue(mockDetail);

    render(
      <ResourcePodsTab
        namespace="default"
        resourceName="test-deploy"
        resourceKind="Deployment"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('test-deploy-abc123')).toBeInTheDocument();
    });

    expect(screen.getByText('test-deploy-def456')).toBeInTheDocument();
    expect(mockGetDeploymentDetail).toHaveBeenCalledWith(
      'default',
      'test-deploy',
    );
  });

  it('renders pods for StatefulSet', async () => {
    const mockDetail = {
      pods: [
        {
          name: 'test-sts-0',
          status: 'Running',
          ready: '1/1',
          restarts: 0,
          age: '1h',
          node: 'node-1',
        },
        {
          name: 'test-sts-1',
          status: 'Running',
          ready: '1/1',
          restarts: 0,
          age: '1h',
          node: 'node-2',
        },
      ],
    };

    mockGetStatefulSetDetail.mockResolvedValue(mockDetail);

    render(
      <ResourcePodsTab
        namespace="default"
        resourceName="test-sts"
        resourceKind="StatefulSet"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('test-sts-0')).toBeInTheDocument();
    });

    expect(screen.getByText('test-sts-1')).toBeInTheDocument();
    expect(mockGetStatefulSetDetail).toHaveBeenCalledWith(
      'default',
      'test-sts',
    );
  });

  it('renders pods for DaemonSet', async () => {
    const mockDetail = {
      pods: [
        {
          name: 'test-ds-abc',
          status: 'Running',
          ready: '1/1',
          restarts: 0,
          age: '3h',
          node: 'worker-1',
        },
        {
          name: 'test-ds-def',
          status: 'Running',
          ready: '1/1',
          restarts: 0,
          age: '3h',
          node: 'worker-2',
        },
      ],
    };

    mockGetDaemonSetDetail.mockResolvedValue(mockDetail);

    render(
      <ResourcePodsTab
        namespace="kube-system"
        resourceName="test-ds"
        resourceKind="DaemonSet"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('test-ds-abc')).toBeInTheDocument();
    });

    expect(screen.getByText('worker-1')).toBeInTheDocument();
    expect(mockGetDaemonSetDetail).toHaveBeenCalledWith(
      'kube-system',
      'test-ds',
    );
  });

  it('renders pods for ReplicaSet', async () => {
    const mockDetail = {
      pods: [
        {
          name: 'test-rs-xyz',
          status: 'Running',
          ready: '1/1',
          restarts: 0,
          age: '30m',
          node: 'node-1',
        },
      ],
    };

    mockGetReplicaSetDetail.mockResolvedValue(mockDetail);

    render(
      <ResourcePodsTab
        namespace="default"
        resourceName="test-rs"
        resourceKind="ReplicaSet"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('test-rs-xyz')).toBeInTheDocument();
    });

    expect(mockGetReplicaSetDetail).toHaveBeenCalledWith('default', 'test-rs');
  });

  it('renders empty state when no pods', async () => {
    mockGetDeploymentDetail.mockResolvedValue({ pods: [] });

    render(
      <ResourcePodsTab
        namespace="default"
        resourceName="empty-deploy"
        resourceKind="Deployment"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/no pods running/i)).toBeInTheDocument();
    });
  });

  it('renders error state when API fails', async () => {
    mockGetDeploymentDetail.mockRejectedValue(
      new Error('Failed to fetch pods'),
    );

    render(
      <ResourcePodsTab
        namespace="default"
        resourceName="failing-deploy"
        resourceKind="Deployment"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Failed to fetch pods/)).toBeInTheDocument();
  });

  it('shows pod status with color coding', async () => {
    const mockDetail = {
      pods: [
        {
          name: 'running-pod',
          status: 'Running',
          ready: '1/1',
          restarts: 0,
          age: '1h',
          node: 'node-1',
        },
        {
          name: 'pending-pod',
          status: 'Pending',
          ready: '0/1',
          restarts: 0,
          age: '5m',
          node: '',
        },
        {
          name: 'failed-pod',
          status: 'Failed',
          ready: '0/1',
          restarts: 3,
          age: '10m',
          node: 'node-2',
        },
      ],
    };

    mockGetDeploymentDetail.mockResolvedValue(mockDetail);

    render(
      <ResourcePodsTab
        namespace="default"
        resourceName="mixed-deploy"
        resourceKind="Deployment"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('running-pod')).toBeInTheDocument();
    });

    expect(screen.getByText('pending-pod')).toBeInTheDocument();
    expect(screen.getByText('failed-pod')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('displays pod count in header', async () => {
    const mockDetail = {
      pods: [
        {
          name: 'pod-1',
          status: 'Running',
          ready: '1/1',
          restarts: 0,
          age: '1h',
          node: 'node-1',
        },
        {
          name: 'pod-2',
          status: 'Running',
          ready: '1/1',
          restarts: 0,
          age: '1h',
          node: 'node-2',
        },
        {
          name: 'pod-3',
          status: 'Running',
          ready: '1/1',
          restarts: 0,
          age: '1h',
          node: 'node-3',
        },
      ],
    };

    mockGetDeploymentDetail.mockResolvedValue(mockDetail);

    render(
      <ResourcePodsTab
        namespace="default"
        resourceName="multi-pod-deploy"
        resourceKind="Deployment"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/3 pod/i)).toBeInTheDocument();
    });
  });
});
