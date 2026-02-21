import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PVCConsumersTab from '../k8s/resources/persistentvolumeclaims/PVCConsumersTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetPVCConsumers: vi.fn(),
}));

vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import { GetPVCConsumers } from '../../wailsjs/go/main/App';
const getPVCConsumersMock = vi.mocked(GetPVCConsumers);

describe('PVCConsumersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getPVCConsumersMock.mockImplementation(() => new Promise(() => {}));
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error when API call fails', async () => {
    getPVCConsumersMock.mockRejectedValue(new Error('PVC error'));
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: PVC error/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no consumers', async () => {
    getPVCConsumersMock.mockResolvedValue([] as never);
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('renders table columns when consumers exist', async () => {
    getPVCConsumersMock.mockResolvedValue([
      { podName: 'data-pod', node: 'node-1', status: 'Running', refType: 'volume' },
    ] as never);
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('Pod')).toBeInTheDocument();
      expect(screen.getByText('Node')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Reference')).toBeInTheDocument();
    });
  });

  it('renders pod name in table', async () => {
    getPVCConsumersMock.mockResolvedValue([
      { podName: 'database-pod-0', node: 'worker-1', status: 'Running', refType: 'volume' },
    ] as never);
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('database-pod-0')).toBeInTheDocument();
    });
  });

  it('renders node name in table', async () => {
    getPVCConsumersMock.mockResolvedValue([
      { podName: 'my-pod', node: 'node-abc', status: 'Running', refType: 'volume' },
    ] as never);
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('node-abc')).toBeInTheDocument();
    });
  });

  it('does not call API when namespace is missing', () => {
    render(<PVCConsumersTab pvcName="my-pvc" />);
    expect(getPVCConsumersMock).not.toHaveBeenCalled();
  });

  it('does not call API when pvcName is missing', () => {
    render(<PVCConsumersTab namespace="default" />);
    expect(getPVCConsumersMock).not.toHaveBeenCalled();
  });

  it('calls API with correct arguments', async () => {
    getPVCConsumersMock.mockResolvedValue([] as never);
    render(<PVCConsumersTab namespace="test-ns" pvcName="test-pvc" />);
    await waitFor(() => {
      expect(getPVCConsumersMock).toHaveBeenCalledWith('test-ns', 'test-pvc');
    });
  });
});
