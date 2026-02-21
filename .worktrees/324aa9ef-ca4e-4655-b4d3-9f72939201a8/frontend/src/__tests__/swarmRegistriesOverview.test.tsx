import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const notifications = vi.hoisted(() => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const swarmApi = vi.hoisted(() => ({
  GetRegistries: vi.fn(),
  RemoveRegistry: vi.fn(),
}));

const swarmCounts = vi.hoisted(() => ({
  refetch: vi.fn(),
}));

vi.mock('../notification', () => notifications);
vi.mock('../docker/swarmApi', () => swarmApi);
vi.mock('../docker/SwarmResourceCountsContext', () => ({
  useSwarmResourceCounts: () => swarmCounts,
}));

vi.mock('../layout/bottompanel/BottomPanel', () => ({
  default: ({ open, children, headerRight, onClose }: {
    open: boolean;
    children: React.ReactNode;
    headerRight?: React.ReactNode;
    onClose: () => void;
  }) => {
    if (!open) return null;
    return (
      <div className="bottom-panel">
        <button onClick={onClose}>Close Bottom Panel</button>
        {headerRight}
        {children}
      </div>
    );
  },
}));

vi.mock('../docker/registry/AddRegistryModal', () => ({
  default: ({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) => {
    if (!open) return null;
    return (
      <div data-testid="add-registry-modal">
        <button onClick={onSaved}>Saved</button>
        <button onClick={onClose}>Close</button>
      </div>
    );
  },
}));

vi.mock('../docker/registry/RegistryBrowser', () => ({
  default: ({ registryName, registryType }: { registryName: string; registryType: string }) => (
    <div data-testid="registry-browser">{registryName}::{registryType}</div>
  ),
}));

import SwarmRegistriesOverview from '../docker/registry/SwarmRegistriesOverview';

beforeEach(() => {
  notifications.showError.mockReset();
  notifications.showSuccess.mockReset();
  swarmCounts.refetch.mockReset();
  swarmApi.GetRegistries.mockReset();
  swarmApi.RemoveRegistry.mockReset();
});

describe('SwarmRegistriesOverview', () => {
  it('loads registries, opens bottom panel, and can remove a registry', async () => {
    swarmApi.GetRegistries
      .mockResolvedValueOnce([
        { name: 'Docker Hub', type: 'dockerhub', url: 'https://registry-1.docker.io' },
        { name: 'Generic', type: 'generic_v2', url: 'https://reg.example.com' },
        { name: 'ECR', type: 'ecr', url: '' },
        { name: 'Custom', type: 'foo', url: 'http://custom' },
      ])
      .mockResolvedValueOnce([
        { name: 'Generic', type: 'generic_v2', url: 'https://reg.example.com' },
      ]);

    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    swarmApi.RemoveRegistry.mockResolvedValueOnce(undefined);

    render(<SwarmRegistriesOverview />);

    // Initial load
    await screen.findByText('https://registry-1.docker.io');
    expect(swarmApi.GetRegistries).toHaveBeenCalledTimes(1);
    expect(swarmCounts.refetch).toHaveBeenCalledWith({ forceRegistries: true });

    // Type label formatting branches
    expect(screen.getAllByText('Docker Hub').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Generic v2')).toBeTruthy();
    expect(screen.getAllByText('ECR').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('foo')).toBeTruthy();

    // Open bottom panel by clicking the first row
    const dockerHubRow = screen.getByText('https://registry-1.docker.io').closest('tr');
    expect(dockerHubRow).toBeTruthy();
    fireEvent.click(dockerHubRow as HTMLElement);
    expect(await screen.findByTestId('registry-browser')).toHaveTextContent('Docker Hub::dockerhub');

    // Remove
    fireEvent.click(screen.getByTitle('Remove registry'));

    await waitFor(() => {
      expect(swarmApi.RemoveRegistry).toHaveBeenCalledWith('Docker Hub');
      expect(notifications.showSuccess).toHaveBeenCalledWith('Removed registry Docker Hub');
    });

    // After removal, it reloads
    await waitFor(() => {
      expect(swarmApi.GetRegistries).toHaveBeenCalledTimes(2);
    });

    // And closes bottom panel
    await waitFor(() => {
      expect(screen.queryByTestId('registry-browser')).toBeNull();
    });
  });

  it('opens the add registry modal', async () => {
    swarmApi.GetRegistries.mockResolvedValueOnce([]);

    render(<SwarmRegistriesOverview />);
    await screen.findByText('No registries configured.');

    fireEvent.click(screen.getByLabelText('Add registry'));
    expect(await screen.findByTestId('add-registry-modal')).toBeTruthy();
  });
});
