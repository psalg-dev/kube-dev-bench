import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock CreateManifestOverlay to a lightweight stub
vi.mock('../CreateManifestOverlay', () => ({
  __esModule: true,
  default: ({ open, kind, platform }) => open ? <div data-testid="create-overlay">overlay-{platform}-{kind}</div> : null,
}));

vi.mock('../notification.js', () => ({
  __esModule: true,
  showNotification: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../docker/SwarmStateContext.jsx', () => ({
  __esModule: true,
  useSwarmState: () => ({
    connected: true,
  }),
}));

vi.mock('../docker/swarmApi.js', () => ({
  __esModule: true,
  GetSwarmStacks: vi.fn(() => Promise.resolve([
    { name: 'demo', services: 2, orchestrator: 'Swarm' },
  ])),
  RemoveSwarmStack: vi.fn(() => Promise.resolve()),
}));

// Import component under test AFTER mocks
import SwarmStacksOverviewTable from '../docker/resources/stacks/SwarmStacksOverviewTable.jsx';
import { showNotification } from '../notification.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('SwarmStacksOverviewTable', () => {
  it('opens stack create overlay when + clicked', async () => {
    render(<SwarmStacksOverviewTable />);

    // Table shows stack row
    expect(await screen.findByText('demo')).toBeInTheDocument();

    const plusBtn = screen.getByRole('button', { name: /create new/i });
    fireEvent.click(plusBtn);

    expect(showNotification).not.toHaveBeenCalled();
    expect(screen.getByTestId('create-overlay')).toHaveTextContent('overlay-swarm-stack');
  });
});
