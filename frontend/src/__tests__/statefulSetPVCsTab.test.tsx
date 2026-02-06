import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockGetStatefulSetDetail = vi.fn();

// Mock the App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetStatefulSetDetail: (...args: unknown[]) => mockGetStatefulSetDetail(...args),
}));

import StatefulSetPVCsTab from '../k8s/resources/statefulsets/StatefulSetPVCsTab';

describe('StatefulSetPVCsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockGetStatefulSetDetail.mockReturnValue(new Promise(() => {}));

    render(
      <StatefulSetPVCsTab
        namespace="default"
        statefulSetName="test-sts"
      />
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders PVCs when loaded', async () => {
    const mockDetail = {
      pvcs: [
        { name: 'data-test-sts-0', status: 'Bound', capacity: '10Gi', accessModes: 'ReadWriteOnce', volumeName: 'pv-123' },
        { name: 'data-test-sts-1', status: 'Bound', capacity: '10Gi', accessModes: 'ReadWriteOnce', volumeName: 'pv-456' },
      ],
    };

    mockGetStatefulSetDetail.mockResolvedValue(mockDetail);

    render(
      <StatefulSetPVCsTab
        namespace="default"
        statefulSetName="test-sts"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('data-test-sts-0')).toBeInTheDocument();
    });

    expect(screen.getByText('data-test-sts-1')).toBeInTheDocument();
    expect(screen.getAllByText('Bound')).toHaveLength(2);
    expect(screen.getAllByText('10Gi')).toHaveLength(2);
  });

  it('renders empty state when no PVCs', async () => {
    mockGetStatefulSetDetail.mockResolvedValue({ pvcs: [] });

    render(
      <StatefulSetPVCsTab
        namespace="default"
        statefulSetName="empty-sts"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/no pvcs found/i)).toBeInTheDocument();
    });
  });

  it('renders error state when API fails', async () => {
    mockGetStatefulSetDetail.mockRejectedValue(new Error('Connection failed'));

    render(
      <StatefulSetPVCsTab
        namespace="default"
        statefulSetName="failing-sts"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
  });

  it('calls API with correct parameters', async () => {
    mockGetStatefulSetDetail.mockResolvedValue({ pvcs: [] });

    render(
      <StatefulSetPVCsTab
        namespace="my-namespace"
        statefulSetName="my-statefulset"
      />
    );

    await waitFor(() => {
      expect(mockGetStatefulSetDetail).toHaveBeenCalledWith('my-namespace', 'my-statefulset');
    });
  });

  it('displays PVC status with appropriate styling', async () => {
    const mockDetail = {
      pvcs: [
        { name: 'bound-pvc', status: 'Bound', storage: '5Gi', accessModes: 'ReadWriteOnce', volumeName: 'pv-bound' },
        { name: 'pending-pvc', status: 'Pending', storage: '5Gi', accessModes: 'ReadWriteOnce', volumeName: '' },
      ],
    };

    mockGetStatefulSetDetail.mockResolvedValue(mockDetail);

    render(
      <StatefulSetPVCsTab
        namespace="default"
        statefulSetName="mixed-sts"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('bound-pvc')).toBeInTheDocument();
    });

    expect(screen.getByText('pending-pvc')).toBeInTheDocument();
    expect(screen.getByText('Bound')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows PVC count in header', async () => {
    const mockDetail = {
      pvcs: [
        { name: 'pvc-0', status: 'Bound', storage: '1Gi', accessModes: 'RWO', volumeName: 'pv-0' },
        { name: 'pvc-1', status: 'Bound', storage: '1Gi', accessModes: 'RWO', volumeName: 'pv-1' },
        { name: 'pvc-2', status: 'Bound', storage: '1Gi', accessModes: 'RWO', volumeName: 'pv-2' },
      ],
    };

    mockGetStatefulSetDetail.mockResolvedValue(mockDetail);

    render(
      <StatefulSetPVCsTab
        namespace="default"
        statefulSetName="three-replica-sts"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 pvc/i)).toBeInTheDocument();
    });
  });
});
