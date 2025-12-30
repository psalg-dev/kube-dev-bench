import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the App API
const mockGetReplicaSetDetail = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetReplicaSetDetail: (...args) => mockGetReplicaSetDetail(...args),
}));

import ReplicaSetOwnerTab from '../k8s/resources/replicasets/ReplicaSetOwnerTab';

describe('ReplicaSetOwnerTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockGetReplicaSetDetail.mockReturnValue(new Promise(() => {}));

    render(
      <ReplicaSetOwnerTab
        namespace="default"
        replicaSetName="test-rs"
      />
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders owner info when loaded', async () => {
    const mockDetail = {
      ownerKind: 'Deployment',
      ownerName: 'test-deployment',
    };

    mockGetReplicaSetDetail.mockResolvedValue(mockDetail);

    render(
      <ReplicaSetOwnerTab
        namespace="default"
        replicaSetName="test-rs"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test-deployment')).toBeInTheDocument();
    });

    expect(screen.getByText('Deployment')).toBeInTheDocument();
  });

  it('renders no owner state when ReplicaSet has no owner', async () => {
    mockGetReplicaSetDetail.mockResolvedValue({
      ownerKind: '',
      ownerName: '',
    });

    render(
      <ReplicaSetOwnerTab
        namespace="default"
        replicaSetName="standalone-rs"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/no owner/i)).toBeInTheDocument();
    });
  });

  it('renders error state when API fails', async () => {
    mockGetReplicaSetDetail.mockRejectedValue(new Error('Network error'));

    render(
      <ReplicaSetOwnerTab
        namespace="default"
        replicaSetName="failing-rs"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it('calls API with correct parameters', async () => {
    mockGetReplicaSetDetail.mockResolvedValue({ ownerKind: '', ownerName: '' });

    render(
      <ReplicaSetOwnerTab
        namespace="my-ns"
        replicaSetName="my-rs"
      />
    );

    await waitFor(() => {
      expect(mockGetReplicaSetDetail).toHaveBeenCalledWith('my-ns', 'my-rs');
    });
  });

  it('displays owner kind badge correctly', async () => {
    const mockDetail = {
      ownerKind: 'Deployment',
      ownerName: 'nginx-deployment',
    };

    mockGetReplicaSetDetail.mockResolvedValue(mockDetail);

    render(
      <ReplicaSetOwnerTab
        namespace="default"
        replicaSetName="nginx-rs-abc123"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Deployment')).toBeInTheDocument();
    });

    expect(screen.getByText('nginx-deployment')).toBeInTheDocument();
  });

  it('shows explanation text about ReplicaSet owners', async () => {
    mockGetReplicaSetDetail.mockResolvedValue({
      ownerKind: 'Deployment',
      ownerName: 'my-app',
    });

    render(
      <ReplicaSetOwnerTab
        namespace="default"
        replicaSetName="my-app-rs"
      />
    );

    await waitFor(() => {
      // Should show the owner kind badge
      expect(screen.getAllByText(/deployment/i).length).toBeGreaterThan(0);
    });

    // Should show the owner label
    expect(screen.getByText(/owner/i)).toBeInTheDocument();
  });
});
