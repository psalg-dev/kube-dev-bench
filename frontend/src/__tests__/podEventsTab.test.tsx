import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PodEventsTab from '../k8s/resources/pods/PodEventsTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetPodEvents: vi.fn(),
}));

import { GetPodEvents } from '../../wailsjs/go/main/App';
const getPodEventsMock = vi.mocked(GetPodEvents);

describe('PodEventsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading indicator while fetching events', () => {
    getPodEventsMock.mockImplementation(() => new Promise(() => {}));
    render(<PodEventsTab namespace="default" podName="my-pod" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error when API call fails', async () => {
    getPodEventsMock.mockRejectedValue(new Error('Events fetch failed'));
    render(<PodEventsTab namespace="default" podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: Events fetch failed/)).toBeInTheDocument();
    });
  });

  it('shows Events for pod name header', () => {
    getPodEventsMock.mockImplementation(() => new Promise(() => {}));
    render(<PodEventsTab namespace="default" podName="test-pod" />);
    expect(screen.getByText(/Events for test-pod/)).toBeInTheDocument();
  });

  it('shows Refresh button', () => {
    getPodEventsMock.mockImplementation(() => new Promise(() => {}));
    render(<PodEventsTab namespace="default" podName="my-pod" />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('shows no events message when events are empty', async () => {
    getPodEventsMock.mockResolvedValue([] as never);
    render(<PodEventsTab namespace="default" podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText('No events.')).toBeInTheDocument();
    });
  });

  it('renders table column headers', async () => {
    getPodEventsMock.mockResolvedValue([] as never);
    render(<PodEventsTab namespace="default" podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Reason')).toBeInTheDocument();
      expect(screen.getByText('Message')).toBeInTheDocument();
      expect(screen.getByText('Count')).toBeInTheDocument();
      expect(screen.getByText('Last Seen')).toBeInTheDocument();
    });
  });

  it('renders event data rows', async () => {
    getPodEventsMock.mockResolvedValue([
      { type: 'Normal', reason: 'Scheduled', message: 'Assigned to node-1', count: 1, lastTimestamp: '2024-01-01T00:00:00Z' },
    ] as never);
    render(<PodEventsTab namespace="default" podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText('Normal')).toBeInTheDocument();
      expect(screen.getByText('Scheduled')).toBeInTheDocument();
      expect(screen.getByText('Assigned to node-1')).toBeInTheDocument();
    });
  });

  it('calls API with correct namespace and podName', async () => {
    getPodEventsMock.mockResolvedValue([] as never);
    render(<PodEventsTab namespace="kube-system" podName="coredns-pod" />);
    await waitFor(() => {
      expect(getPodEventsMock).toHaveBeenCalledWith('kube-system', 'coredns-pod');
    });
  });

  it('does not call API when podName is empty', () => {
    render(<PodEventsTab namespace="default" podName="" />);
    expect(getPodEventsMock).not.toHaveBeenCalled();
  });
});
