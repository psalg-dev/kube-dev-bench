import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StatefulSetDetailTab from '../k8s/resources/statefulsets/StatefulSetDetailTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetStatefulSetDetail: vi.fn(),
}));

import { GetStatefulSetDetail } from '../../wailsjs/go/main/App';
const getStatefulSetDetailMock = vi.mocked(GetStatefulSetDetail);

describe('StatefulSetDetailTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getStatefulSetDetailMock.mockImplementation(() => new Promise(() => {}));
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-ss" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error when API call fails', async () => {
    getStatefulSetDetailMock.mockRejectedValue(new Error('StatefulSet not found'));
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-ss" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: StatefulSet not found/)).toBeInTheDocument();
    });
  });

  it('renders pods and pvcs section buttons', async () => {
    getStatefulSetDetailMock.mockResolvedValue({ pods: [], pvcs: [] } as never);
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-ss" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pods/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pvcs/i })).toBeInTheDocument();
    });
  });

  it('shows no pods found when pods array is empty', async () => {
    getStatefulSetDetailMock.mockResolvedValue({ pods: [], pvcs: [] } as never);
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-ss" />);
    await waitFor(() => {
      expect(screen.getByText(/No pods found/)).toBeInTheDocument();
    });
  });

  it('renders pod names when pods exist', async () => {
    getStatefulSetDetailMock.mockResolvedValue({
      pods: [
        { name: 'my-ss-0', status: 'Running', ready: '1/1', restarts: 0, age: '1d', node: 'node-1' },
      ],
      pvcs: [],
    } as never);
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-ss" />);
    await waitFor(() => {
      expect(screen.getByText('my-ss-0')).toBeInTheDocument();
    });
  });

  it('shows no PVCs message when switching to pvcs tab', async () => {
    getStatefulSetDetailMock.mockResolvedValue({ pods: [], pvcs: [] } as never);
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-ss" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const pvcsButton = screen.getByText(/pvcs/i);
    fireEvent.click(pvcsButton);
    expect(screen.getByText(/No PVCs found for this StatefulSet/)).toBeInTheDocument();
  });

  it('renders PVC data when switching to pvcs tab', async () => {
    getStatefulSetDetailMock.mockResolvedValue({
      pods: [],
      pvcs: [
        { name: 'data-my-ss-0', status: 'Bound', capacity: '10Gi', accessModes: 'RWO', storageClass: 'standard', age: '7d' },
      ],
    } as never);
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-ss" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const pvcsButton = screen.getByText(/pvcs/i);
    fireEvent.click(pvcsButton);

    expect(screen.getByText('data-my-ss-0')).toBeInTheDocument();
  });

  it('does not call API when namespace is missing', () => {
    render(<StatefulSetDetailTab statefulSetName="my-ss" />);
    expect(getStatefulSetDetailMock).not.toHaveBeenCalled();
  });

  it('calls API with correct arguments', async () => {
    getStatefulSetDetailMock.mockResolvedValue({ pods: [], pvcs: [] } as never);
    render(<StatefulSetDetailTab namespace="test-ns" statefulSetName="test-ss" />);
    await waitFor(() => {
      expect(getStatefulSetDetailMock).toHaveBeenCalledWith('test-ns', 'test-ss');
    });
  });
});
