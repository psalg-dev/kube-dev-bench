import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmVolumeUsage: vi.fn(),
}));

function deferred<T>() {
  let resolve: (_value: T) => void;
  let reject: (_reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

describe('VolumeUsedBySection', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading then renders sorted service list', async () => {
    const swarmApi = await import('../docker/swarmApi');
    const getSwarmVolumeUsageMock = vi.mocked(swarmApi.GetSwarmVolumeUsage);
    getSwarmVolumeUsageMock.mockResolvedValueOnce([
      { serviceId: 'b', serviceName: 'bbb' },
      { serviceId: 'a', serviceName: 'aaa' },
    ]);

    const { default: VolumeUsedBySection } = await import('../docker/resources/volumes/VolumeUsedBySection');

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
    const swarmApi = await import('../docker/swarmApi');
    const getSwarmVolumeUsageMock = vi.mocked(swarmApi.GetSwarmVolumeUsage);
    getSwarmVolumeUsageMock.mockResolvedValueOnce({} as unknown as Array<{ serviceId: string; serviceName: string }>);

    const { default: VolumeUsedBySection } = await import('../docker/resources/volumes/VolumeUsedBySection');

    render(<VolumeUsedBySection volumeName="myvol" />);

    expect(await screen.findByText('Not in use')).toBeTruthy();
    expect(screen.getByText('No services currently reference this volume.')).toBeTruthy();
  });

  it('renders error state when api fails', async () => {
    const swarmApi = await import('../docker/swarmApi');
    const getSwarmVolumeUsageMock = vi.mocked(swarmApi.GetSwarmVolumeUsage);
    getSwarmVolumeUsageMock.mockRejectedValueOnce(new Error('nope'));

    const { default: VolumeUsedBySection } = await import('../docker/resources/volumes/VolumeUsedBySection');

    render(<VolumeUsedBySection volumeName="myvol" />);

    expect(await screen.findByText(/Failed to load usage: nope/)).toBeTruthy();
  });

  it('does not throw if unmounted before request resolves', async () => {
    const swarmApi = await import('../docker/swarmApi');
    const d = deferred<Array<{ serviceId: string; serviceName: string }>>();
    const getSwarmVolumeUsageMock = vi.mocked(swarmApi.GetSwarmVolumeUsage);
    getSwarmVolumeUsageMock.mockReturnValueOnce(d.promise);

    const { default: VolumeUsedBySection } = await import('../docker/resources/volumes/VolumeUsedBySection');

    const { unmount } = render(<VolumeUsedBySection volumeName="myvol" />);

    unmount();
    d.resolve([{ serviceId: 'a', serviceName: 'aaa' }]);

    await Promise.resolve();
  });
});
