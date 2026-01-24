import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../docker/swarmApi.js', () => ({
  GetSwarmVolumeUsage: vi.fn(),
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('VolumeUsedBySection', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading then renders sorted service list', async () => {
    const swarmApi = await import('../docker/swarmApi.js');
    swarmApi.GetSwarmVolumeUsage.mockResolvedValueOnce([
      { serviceId: 'b', serviceName: 'bbb' },
      { serviceId: 'a', serviceName: 'aaa' },
    ]);

    const { default: VolumeUsedBySection } = await import('../docker/resources/volumes/VolumeUsedBySection.jsx');

    render(<VolumeUsedBySection volumeName="myvol" />);

    expect(screen.getByText('Used By')).toBeTruthy();
    expect(screen.getByText(/Loading/i)).toBeTruthy();

    await waitFor(() => {
      expect(swarmApi.GetSwarmVolumeUsage).toHaveBeenCalledWith('myvol');
    });

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).toBeNull();
    });

    const items = screen.getAllByText(/aaa|bbb/).map((n) => n.textContent);
    expect(items).toEqual(['aaa', 'bbb']);
  });

  it('renders empty state when usage is not an array', async () => {
    const swarmApi = await import('../docker/swarmApi.js');
    swarmApi.GetSwarmVolumeUsage.mockResolvedValueOnce({});

    const { default: VolumeUsedBySection } = await import('../docker/resources/volumes/VolumeUsedBySection.jsx');

    render(<VolumeUsedBySection volumeName="myvol" />);

    expect(await screen.findByText('No services reference this volume.')).toBeTruthy();
  });

  it('renders error state when api fails', async () => {
    const swarmApi = await import('../docker/swarmApi.js');
    swarmApi.GetSwarmVolumeUsage.mockRejectedValueOnce(new Error('nope'));

    const { default: VolumeUsedBySection } = await import('../docker/resources/volumes/VolumeUsedBySection.jsx');

    render(<VolumeUsedBySection volumeName="myvol" />);

    expect(await screen.findByText(/Failed to load usage: nope/)).toBeTruthy();
  });

  it('does not throw if unmounted before request resolves', async () => {
    const swarmApi = await import('../docker/swarmApi.js');
    const d = deferred();
    swarmApi.GetSwarmVolumeUsage.mockReturnValueOnce(d.promise);

    const { default: VolumeUsedBySection } = await import('../docker/resources/volumes/VolumeUsedBySection.jsx');

    const { unmount } = render(<VolumeUsedBySection volumeName="myvol" />);

    unmount();
    d.resolve([{ serviceId: 'a', serviceName: 'aaa' }]);

    await Promise.resolve();
  });
});
