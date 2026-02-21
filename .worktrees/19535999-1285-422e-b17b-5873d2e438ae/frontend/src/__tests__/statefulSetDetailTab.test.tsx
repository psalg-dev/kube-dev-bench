import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StatefulSetDetailTab from '../k8s/resources/statefulsets/StatefulSetDetailTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetStatefulSetDetail: vi.fn(),
}));

import { GetStatefulSetDetail } from '../../wailsjs/go/main/App';
const getDetailMock = vi.mocked(GetStatefulSetDetail);

describe('StatefulSetDetailTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getDetailMock.mockImplementation(() => new Promise(() => {}));
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    getDetailMock.mockRejectedValue(new Error('sts error'));
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: sts error/i)).toBeInTheDocument();
    });
  });

  it('renders PODS and PVCS section buttons', async () => {
    getDetailMock.mockResolvedValue({ pods: [], pvcs: [] } as never);
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pods/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pvcs/i })).toBeInTheDocument();
    });
  });

  it('shows no pods message when pods array is empty', async () => {
    getDetailMock.mockResolvedValue({ pods: [], pvcs: [] } as never);
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    await waitFor(() => {
      expect(screen.getByText(/No pods found/i)).toBeInTheDocument();
    });
  });

  it('renders pod column headers when pods exist', async () => {
    getDetailMock.mockResolvedValue({
      pods: [{ name: 'pod-0', status: 'Running', ready: '1/1', restarts: 0, age: '1d', node: 'node-1' }],
      pvcs: [],
    } as never);
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });

  it('renders pod rows', async () => {
    getDetailMock.mockResolvedValue({
      pods: [{ name: 'my-sts-0', status: 'Running', ready: '1/1', restarts: 0, age: '3h', node: 'node-1' }],
      pvcs: [],
    } as never);
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    await waitFor(() => {
      expect(screen.getByText('my-sts-0')).toBeInTheDocument();
    });
  });

  it('switches to PVCs section on click', async () => {
    getDetailMock.mockResolvedValue({
      pods: [{ name: 'my-sts-0', status: 'Running', ready: '1/1', restarts: 0, age: '1h', node: 'n1' }],
      pvcs: [{ name: 'data-my-sts-0', status: 'Bound', capacity: '1Gi', accessModes: 'RWO', storageClass: 'standard', age: '1d' }],
    } as never);
    render(<StatefulSetDetailTab namespace="default" statefulSetName="my-sts" />);
    await waitFor(() => {
      expect(screen.getByText('my-sts-0')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /pvcs/i }));
    await waitFor(() => {
      expect(screen.getByText('data-my-sts-0')).toBeInTheDocument();
    });
  });

  it('does not call API when props are missing', () => {
    render(<StatefulSetDetailTab namespace="" statefulSetName="" />);
    expect(getDetailMock).not.toHaveBeenCalled();
  });
});
