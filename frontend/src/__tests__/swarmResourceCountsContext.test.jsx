import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the swarm API
vi.mock('../docker/swarmApi.js', () => ({
  GetSwarmResourceCounts: vi.fn(() =>
    Promise.resolve({
      services: 3,
      tasks: 10,
      nodes: 2,
      networks: 5,
      configs: 2,
      secrets: 1,
      stacks: 1,
      volumes: 4,
    }),
  ),
  GetRegistries: vi.fn(() => Promise.resolve([])),
}));

// Mock wails runtime
vi.mock('../../wailsjs/runtime/runtime.js', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

import {
  SwarmResourceCountsProvider,
  useSwarmResourceCounts,
} from '../docker/SwarmResourceCountsContext.jsx';
import * as swarmApi from '../docker/swarmApi.js';

function TestConsumer() {
  const { counts } = useSwarmResourceCounts();
  return (
    <div>
      <span data-testid="services">{counts?.services ?? 'loading'}</span>
      <span data-testid="tasks">{counts?.tasks ?? 'loading'}</span>
      <span data-testid="nodes">{counts?.nodes ?? 'loading'}</span>
      <span data-testid="networks">{counts?.networks ?? 'loading'}</span>
      <span data-testid="configs">{counts?.configs ?? 'loading'}</span>
      <span data-testid="secrets">{counts?.secrets ?? 'loading'}</span>
      <span data-testid="stacks">{counts?.stacks ?? 'loading'}</span>
      <span data-testid="volumes">{counts?.volumes ?? 'loading'}</span>
    </div>
  );
}

describe('SwarmResourceCountsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and displays resource counts', async () => {
    render(
      <SwarmResourceCountsProvider>
        <TestConsumer />
      </SwarmResourceCountsProvider>,
    );

    // Initially shows loading
    expect(screen.getByTestId('services').textContent).toBe('loading');

    // After fetch completes
    await waitFor(() => {
      expect(screen.getByTestId('services').textContent).toBe('3');
    });

    expect(screen.getByTestId('tasks').textContent).toBe('10');
    expect(screen.getByTestId('nodes').textContent).toBe('2');
    expect(screen.getByTestId('networks').textContent).toBe('5');
    expect(screen.getByTestId('configs').textContent).toBe('2');
    expect(screen.getByTestId('secrets').textContent).toBe('1');
    expect(screen.getByTestId('stacks').textContent).toBe('1');
    expect(screen.getByTestId('volumes').textContent).toBe('4');
  });

  it('handles API errors gracefully', async () => {
    swarmApi.GetSwarmResourceCounts.mockRejectedValueOnce(
      new Error('Connection refused'),
    );

    render(
      <SwarmResourceCountsProvider>
        <TestConsumer />
      </SwarmResourceCountsProvider>,
    );

    // Should still render without crashing
    await waitFor(() => {
      // Counts remain loading/null when API fails
      expect(screen.getByTestId('services').textContent).toBe('loading');
    });
  });

  it('can be used without provider (returns empty context)', () => {
    // Test that useSwarmResourceCounts returns default values when no provider
    // This is expected behavior for optional features
    render(<TestConsumer />);
    expect(screen.getByTestId('services').textContent).toBe('loading');
  });
});
