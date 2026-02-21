import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PodEventsTab from '../k8s/resources/pods/PodEventsTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetPodEvents: vi.fn(),
}));

import { GetPodEvents } from '../../wailsjs/go/main/App';
const getEventsMock = vi.mocked(GetPodEvents);

describe('PodEventsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getEventsMock.mockImplementation(() => new Promise(() => {}));
    render(<PodEventsTab namespace="default" podName="my-pod" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    getEventsMock.mockRejectedValue(new Error('events error'));
    render(<PodEventsTab namespace="default" podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText(/Error:/i)).toBeInTheDocument();
    });
  });

  it('shows no events message when list is empty', async () => {
    getEventsMock.mockResolvedValue([] as never);
    render(<PodEventsTab namespace="default" podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText(/No events/i)).toBeInTheDocument();
    });
  });

  it('renders column headers', async () => {
    getEventsMock.mockResolvedValue([] as never);
    render(<PodEventsTab namespace="default" podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Reason')).toBeInTheDocument();
      expect(screen.getByText('Message')).toBeInTheDocument();
      expect(screen.getByText('Count')).toBeInTheDocument();
      expect(screen.getByText('Last Seen')).toBeInTheDocument();
    });
  });

  it('renders pod name in header', async () => {
    getEventsMock.mockResolvedValue([] as never);
    render(<PodEventsTab namespace="default" podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText(/Events for my-pod/i)).toBeInTheDocument();
    });
  });

  it('renders event rows', async () => {
    getEventsMock.mockResolvedValue([
      { type: 'Normal', reason: 'Scheduled', message: 'Pod assigned to node', count: 1, lastTimestamp: '2024-01-01T00:00:00Z' },
    ] as never);
    render(<PodEventsTab namespace="default" podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByText('Normal')).toBeInTheDocument();
      expect(screen.getByText('Scheduled')).toBeInTheDocument();
      expect(screen.getByText('Pod assigned to node')).toBeInTheDocument();
    });
  });

  it('renders Refresh button', async () => {
    getEventsMock.mockResolvedValue([] as never);
    render(<PodEventsTab namespace="default" podName="my-pod" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
    });
  });
});
