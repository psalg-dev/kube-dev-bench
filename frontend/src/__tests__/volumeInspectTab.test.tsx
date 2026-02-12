import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmVolumeInspectJSON: vi.fn(),
}));

vi.mock('../layout/bottompanel/TextViewerTab', () => ({
  default: ({ content, loading, error, loadingLabel, filename }: {
    content?: string | null;
    loading: boolean;
    error?: string | Error | null;
    loadingLabel?: string;
    filename?: string;
  }) => (
    <div data-testid="text-viewer">
      <div data-testid="tv-loading">{String(loading)}</div>
      <div data-testid="tv-error">{error ? String(error) : ''}</div>
      <div data-testid="tv-label">{loadingLabel}</div>
      <div data-testid="tv-filename">{filename}</div>
      <pre data-testid="tv-content">{String(content ?? '')}</pre>
    </div>
  ),
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

describe('VolumeInspectTab', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading initially and passes stable props to TextViewerTab', async () => {
    const swarmApi = await import('../docker/swarmApi');
    const getSwarmVolumeInspectMock = vi.mocked(swarmApi.GetSwarmVolumeInspectJSON);
    getSwarmVolumeInspectMock.mockImplementation(() => new Promise(() => {}));

    const { default: VolumeInspectTab } = await import('../docker/resources/volumes/VolumeInspectTab');

    render(<VolumeInspectTab volumeName="myvol" />);

    expect(screen.getByTestId('tv-loading').textContent).toBe('true');
    expect(screen.getByTestId('tv-label').textContent).toBe('Loading volume inspect...');
    expect(screen.getByTestId('tv-filename').textContent).toBe('myvol.json');

    await waitFor(() => {
      expect(swarmApi.GetSwarmVolumeInspectJSON).toHaveBeenCalledWith('myvol');
    });
  });

  it('renders content on success', async () => {
    const swarmApi = await import('../docker/swarmApi');
    const getSwarmVolumeInspectMock = vi.mocked(swarmApi.GetSwarmVolumeInspectJSON);
    getSwarmVolumeInspectMock.mockResolvedValueOnce('{"Name":"myvol"}');

    const { default: VolumeInspectTab } = await import('../docker/resources/volumes/VolumeInspectTab');

    render(<VolumeInspectTab volumeName="myvol" />);

    await waitFor(() => {
      expect(screen.getByTestId('tv-loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('tv-error').textContent).toBe('');
    expect(screen.getByTestId('tv-content').textContent).toBe('{"Name":"myvol"}');
  });

  it('renders empty content for null-ish results', async () => {
    const swarmApi = await import('../docker/swarmApi');
    const getSwarmVolumeInspectMock = vi.mocked(swarmApi.GetSwarmVolumeInspectJSON);
    getSwarmVolumeInspectMock.mockResolvedValueOnce(null as unknown as string);

    const { default: VolumeInspectTab } = await import('../docker/resources/volumes/VolumeInspectTab');

    render(<VolumeInspectTab volumeName="myvol" />);

    await waitFor(() => {
      expect(screen.getByTestId('tv-loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('tv-content').textContent).toBe('');
  });

  it('renders error on failure', async () => {
    const swarmApi = await import('../docker/swarmApi');
    const getSwarmVolumeInspectMock = vi.mocked(swarmApi.GetSwarmVolumeInspectJSON);
    getSwarmVolumeInspectMock.mockRejectedValueOnce(new Error('boom'));

    const { default: VolumeInspectTab } = await import('../docker/resources/volumes/VolumeInspectTab');

    render(<VolumeInspectTab volumeName="myvol" />);

    await waitFor(() => {
      expect(screen.getByTestId('tv-loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('tv-error').textContent).toBe('boom');
  });

  it('does not throw if unmounted before request resolves', async () => {
    const swarmApi = await import('../docker/swarmApi');
    const d = deferred<string>();
    const getSwarmVolumeInspectMock = vi.mocked(swarmApi.GetSwarmVolumeInspectJSON);
    getSwarmVolumeInspectMock.mockReturnValueOnce(d.promise);

    const { default: VolumeInspectTab } = await import('../docker/resources/volumes/VolumeInspectTab');

    const { unmount } = render(<VolumeInspectTab volumeName="myvol" />);

    unmount();
    d.resolve('{"Name":"myvol"}');

    await Promise.resolve();
  });
});
