import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SwarmEventsTab from '../docker/resources/SwarmEventsTab';

// Mock the swarm API
vi.mock('../docker/swarmApi', () => ({
  GetSwarmEvents: vi.fn(),
  GetSwarmServiceEvents: vi.fn(),
}));

import * as SwarmAPI from '../docker/swarmApi';
import type { docker } from '../../wailsjs/go/models';

const getSwarmEventsMock = vi.mocked(SwarmAPI.GetSwarmEvents);
const getSwarmServiceEventsMock = vi.mocked(SwarmAPI.GetSwarmServiceEvents);

describe('SwarmEventsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('loading state', () => {
    it('shows loading message while fetching events', () => {
      getSwarmEventsMock.mockImplementation(() => new Promise(() => {}));

      render(<SwarmEventsTab />);

      expect(screen.getByText(/Loading events/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      getSwarmEventsMock.mockRejectedValue(new Error('Connection failed'));

      render(<SwarmEventsTab />);

      await waitFor(() => {
        expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
      });
    });

    it('shows generic error for empty error message', async () => {
      getSwarmEventsMock.mockRejectedValue({});

      render(<SwarmEventsTab />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load events/)).toBeInTheDocument();
      });
    });

    it('has retry button on error', async () => {
      getSwarmEventsMock.mockRejectedValue(new Error('Connection failed'));

      render(<SwarmEventsTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('retries on retry button click', async () => {
      getSwarmEventsMock.mockRejectedValue(new Error('Connection failed'));

      render(<SwarmEventsTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      getSwarmEventsMock.mockResolvedValue([]);
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(SwarmAPI.GetSwarmEvents).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('empty state', () => {
    it('shows empty message when no events', async () => {
      getSwarmEventsMock.mockResolvedValue([]);

      render(<SwarmEventsTab />);

      await waitFor(() => {
        expect(screen.getByText(/No Events/)).toBeInTheDocument();
        expect(screen.getByText(/No events found/)).toBeInTheDocument();
      });
    });

    it('shows custom time range in empty message', async () => {
      getSwarmEventsMock.mockResolvedValue([]);

      render(<SwarmEventsTab sinceMinutes={60} />);

      await waitFor(() => {
        expect(screen.getByText(/No events found in the last 60 minutes/)).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays events when loaded', async () => {
      const mockEvents = [
        { id: '1', type: 'service', action: 'update', actor: 'my-service', time: '2024-01-01T10:00:00Z', timeUnix: 1704103200 },
        { id: '2', type: 'container', action: 'start', actor: 'container-1', time: '2024-01-01T09:00:00Z', timeUnix: 1704099600 },
      ];
      getSwarmEventsMock.mockResolvedValue(mockEvents as unknown as docker.SwarmEvent[]);

      render(<SwarmEventsTab />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/No Events/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('calls GetSwarmEvents with sinceMinutes', async () => {
      getSwarmEventsMock.mockResolvedValue([]);

      render(<SwarmEventsTab sinceMinutes={45} />);

      await waitFor(() => {
        expect(SwarmAPI.GetSwarmEvents).toHaveBeenCalledWith(45);
      });
    });

    it('calls GetSwarmServiceEvents when serviceId is provided', async () => {
      getSwarmServiceEventsMock.mockResolvedValue([]);

      render(<SwarmEventsTab serviceId="svc-123" sinceMinutes={30} />);

      await waitFor(() => {
        expect(SwarmAPI.GetSwarmServiceEvents).toHaveBeenCalledWith('svc-123', 30);
      });
      expect(SwarmAPI.GetSwarmEvents).not.toHaveBeenCalled();
    });

    it('uses default sinceMinutes of 30', async () => {
      getSwarmEventsMock.mockResolvedValue([]);

      render(<SwarmEventsTab />);

      await waitFor(() => {
        expect(SwarmAPI.GetSwarmEvents).toHaveBeenCalledWith(30);
      });
    });
  });
});
