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
const getConsumersMock = vi.mocked(GetPVCConsumers);

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
    getConsumersMock.mockRejectedValue(new Error('pvc error'));
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: pvc error/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no consumers', async () => {
    getConsumersMock.mockResolvedValue([] as never);
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });
  });

  it('renders column headers when consumers exist', async () => {
    getConsumersMock.mockResolvedValue([
      { podName: 'my-pod', node: 'node-1', status: 'Running', refType: 'persistentVolumeClaim' },
    ] as never);
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('Pod')).toBeInTheDocument();
      expect(screen.getByText('Node')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Reference')).toBeInTheDocument();
    });
  });

  it('renders consumer pod rows', async () => {
    getConsumersMock.mockResolvedValue([
      { podName: 'pod-using-pvc', node: 'worker-1', status: 'Running', refType: 'persistentVolumeClaim' },
    ] as never);
    render(<PVCConsumersTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('pod-using-pvc')).toBeInTheDocument();
      expect(screen.getByText('worker-1')).toBeInTheDocument();
    });
  });

  it('does not call API when props are missing', () => {
    render(<PVCConsumersTab namespace="" pvcName="" />);
    expect(getConsumersMock).not.toHaveBeenCalled();
  });
});
