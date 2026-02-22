import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetStatefulSetDetail: vi.fn(),
}));

vi.mock('../components/StatusBadge', () => ({
  default: ({ status }: { status?: string }) => <span>{status}</span>,
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import StatefulSetDetailTab from '../k8s/resources/statefulsets/StatefulSetDetailTab';

const getDetailMock = vi.mocked(AppAPI.GetStatefulSetDetail);

const mockDetail = {
  pods: [
    { name: 'sts-pod-0', status: 'Running', ready: '1/1', restarts: 0, age: '1d', node: 'node-1' },
    { name: 'sts-pod-1', status: 'Running', ready: '1/1', restarts: 0, age: '1d', node: 'node-2' },
  ],
  pvcs: [
    { name: 'data-sts-pod-0', status: 'Bound', capacity: '10Gi', accessModes: 'RWO', storageClass: 'standard', age: '1d' },
  ],
};

describe('StatefulSetDetailTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getDetailMock.mockImplementation(() => new Promise(() => {}));
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    getDetailMock.mockRejectedValue(new Error('sts fetch failed'));
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    await waitFor(() => {
      expect(screen.getByText(/sts fetch failed/i)).toBeInTheDocument();
    });
  });

  it('shows pods section by default', async () => {
    getDetailMock.mockResolvedValue(mockDetail);
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    await waitFor(() => {
      expect(screen.getByText('sts-pod-0')).toBeInTheDocument();
      expect(screen.getByText('sts-pod-1')).toBeInTheDocument();
    });
  });

  it('renders pods and pvcs section toggle buttons', async () => {
    getDetailMock.mockResolvedValue(mockDetail);
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pods/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pvcs/i })).toBeInTheDocument();
    });
  });

  it('switches to PVCs section on button click', async () => {
    getDetailMock.mockResolvedValue(mockDetail);
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pvcs/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /pvcs/i }));
    await waitFor(() => {
      expect(screen.getByText('data-sts-pod-0')).toBeInTheDocument();
    });
  });

  it('shows "No pods found" when pods array is empty', async () => {
    getDetailMock.mockResolvedValue({ pods: [], pvcs: [] });
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    await waitFor(() => {
      expect(screen.getByText(/No pods found/i)).toBeInTheDocument();
    });
  });

  it('calls GetStatefulSetDetail with correct params', async () => {
    getDetailMock.mockResolvedValue({ pods: [], pvcs: [] });
    render(<StatefulSetDetailTab namespace="test-ns" statefulSetName="test-sts" />);
    await waitFor(() => {
      expect(AppAPI.GetStatefulSetDetail).toHaveBeenCalledWith('test-ns', 'test-sts');
    });
  });

  it('does not call API when namespace is missing', () => {
    render(<StatefulSetDetailTab statefulSetName="my-sts" />);
    expect(AppAPI.GetStatefulSetDetail).not.toHaveBeenCalled();
  });

  it('shows No PVCs message when switching to pvcs section with empty pvcs', async () => {
    getDetailMock.mockResolvedValue({ pods: [], pvcs: [] });
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pvcs/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /pvcs/i }));
    await waitFor(() => {
      expect(screen.getByText(/No PVCs found/i)).toBeInTheDocument();
    });
  });
});
