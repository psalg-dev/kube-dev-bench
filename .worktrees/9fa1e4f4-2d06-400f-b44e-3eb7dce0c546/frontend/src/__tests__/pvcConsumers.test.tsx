import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetPVCConsumers: vi.fn(),
}));

vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import PVCConsumersTab from '../k8s/resources/persistentvolumeclaims/PVCConsumersTab';

const getConsumersMock = vi.mocked(AppAPI.GetPVCConsumers);

const mockConsumers = [
  { podName: 'data-pod-1', node: 'node-1', status: 'Running', refType: 'volume' },
  { podName: 'data-pod-2', node: 'node-2', status: 'Pending', refType: 'volume' },
];

describe('PVCConsumersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getConsumersMock.mockImplementation(() => new Promise(() => {}));
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    getConsumersMock.mockRejectedValue(new Error('pvc consumer error'));
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText(/pvc consumer error/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no consumers', async () => {
    getConsumersMock.mockResolvedValue([]);
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      // EmptyTabContent is rendered; just verify loading stopped
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });
  });

  it('renders consumer pod names', async () => {
    getConsumersMock.mockResolvedValue(mockConsumers);
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('data-pod-1')).toBeInTheDocument();
      expect(screen.getByText('data-pod-2')).toBeInTheDocument();
    });
  });

  it('renders node names', async () => {
    getConsumersMock.mockResolvedValue(mockConsumers);
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('node-1')).toBeInTheDocument();
      expect(screen.getByText('node-2')).toBeInTheDocument();
    });
  });

  it('renders table headers: Pod, Node, Status, Reference', async () => {
    getConsumersMock.mockResolvedValue(mockConsumers);
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('Pod')).toBeInTheDocument();
      expect(screen.getByText('Node')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Reference')).toBeInTheDocument();
    });
  });

  it('calls GetPVCConsumers with correct params', async () => {
    getConsumersMock.mockResolvedValue([]);
    render(<PVCConsumersTab namespace="test-ns" pvcName="test-pvc" />);
    await waitFor(() => {
      expect(AppAPI.GetPVCConsumers).toHaveBeenCalledWith('test-ns', 'test-pvc');
    });
  });

  it('does not call API when namespace is missing', () => {
    render(<PVCConsumersTab pvcName="my-pvc" />);
    expect(AppAPI.GetPVCConsumers).not.toHaveBeenCalled();
  });

  it('renders pod status values', async () => {
    getConsumersMock.mockResolvedValue(mockConsumers);
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });
});
