import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the App API before importing the component
vi.mock('../../wailsjs/go/main/App', () => ({
  GetResourceEvents: vi.fn(),
}));

// Import after mock is set up
import ResourceEventsTab from '../components/ResourceEventsTab';
import * as AppAPI from '../../wailsjs/go/main/App';

describe('ResourceEventsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    AppAPI.GetResourceEvents.mockReturnValue(new Promise(() => {})); // Never resolves

    render(
      <ResourceEventsTab
        namespace="default"
        kind="Deployment"
        name="test-deploy"
      />
    );

    expect(screen.getByText(/loading events/i)).toBeInTheDocument();
  });

  it('renders events when loaded successfully', async () => {
    const mockEvents = [
      {
        type: 'Normal',
        reason: 'ScalingReplicaSet',
        message: 'Scaled up replica set test-deploy-abc123 to 3',
        count: 1,
        lastTimestamp: '2025-12-30T10:00:00Z',
        source: 'deployment-controller',
      },
      {
        type: 'Warning',
        reason: 'FailedScheduling',
        message: 'No nodes available',
        count: 5,
        lastTimestamp: '2025-12-30T09:55:00Z',
        source: 'default-scheduler',
      },
    ];

    AppAPI.GetResourceEvents.mockResolvedValue(mockEvents);

    render(
      <ResourceEventsTab
        namespace="default"
        kind="Deployment"
        name="test-deploy"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('ScalingReplicaSet')).toBeInTheDocument();
    });

    expect(screen.getByText('FailedScheduling')).toBeInTheDocument();
    expect(screen.getByText(/Scaled up replica set/)).toBeInTheDocument();
    expect(screen.getByText(/No nodes available/)).toBeInTheDocument();
  });

  it('renders empty state when no events', async () => {
    AppAPI.GetResourceEvents.mockResolvedValue([]);

    render(
      <ResourceEventsTab
        namespace="test-ns"
        kind="StatefulSet"
        name="test-sts"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/no events/i)).toBeInTheDocument();
    });
  });

  it('renders error state when API fails', async () => {
    AppAPI.GetResourceEvents.mockRejectedValue(new Error('API connection failed'));

    render(
      <ResourceEventsTab
        namespace="default"
        kind="DaemonSet"
        name="test-ds"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/API connection failed/)).toBeInTheDocument();
  });

  it('calls API with correct parameters', async () => {
    AppAPI.GetResourceEvents.mockResolvedValue([]);

    render(
      <ResourceEventsTab
        namespace="my-namespace"
        kind="ReplicaSet"
        name="my-replicaset"
      />
    );

    await waitFor(() => {
      expect(AppAPI.GetResourceEvents).toHaveBeenCalledWith(
        'my-namespace',
        'ReplicaSet',
        'my-replicaset'
      );
    });
  });

  it('displays event type badges correctly', async () => {
    const mockEvents = [
      {
        type: 'Normal',
        reason: 'Created',
        message: 'Pod created',
        count: 1,
        lastTimestamp: '2025-12-30T10:00:00Z',
        source: 'kubelet',
      },
      {
        type: 'Warning',
        reason: 'BackOff',
        message: 'Back-off restarting failed container',
        count: 3,
        lastTimestamp: '2025-12-30T10:05:00Z',
        source: 'kubelet',
      },
    ];

    AppAPI.GetResourceEvents.mockResolvedValue(mockEvents);

    render(
      <ResourceEventsTab
        namespace="default"
        kind="Pod"
        name="test-pod"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Normal')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });
  });

  it('supports resourceKind and resourceName alias props', async () => {
    AppAPI.GetResourceEvents.mockResolvedValue([]);

    render(
      <ResourceEventsTab
        namespace="default"
        resourceKind="Job"
        resourceName="test-job"
      />
    );

    await waitFor(() => {
      expect(AppAPI.GetResourceEvents).toHaveBeenCalledWith(
        'default',
        'Job',
        'test-job'
      );
    });
  });

  it('handles null events response', async () => {
    AppAPI.GetResourceEvents.mockResolvedValue(null);

    render(
      <ResourceEventsTab
        namespace="default"
        kind="CronJob"
        name="test-cronjob"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/no events/i)).toBeInTheDocument();
    });
  });
});
