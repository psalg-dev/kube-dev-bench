import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../docker/swarmApi.js', () => ({
  GetSwarmVolumeInspectJSON: vi.fn(),
}));

vi.mock('../layout/bottompanel/TextViewerTab.jsx', () => ({
  default: ({ content, loading, error, loadingLabel, filename }) => (
    <div data-testid="text-viewer">
      <div data-testid="tv-loading">{String(loading)}</div>
      <div data-testid="tv-error">{error ? String(error) : ''}</div>
      <div data-testid="tv-label">{loadingLabel}</div>
      <div data-testid="tv-filename">{filename}</div>
      <pre data-testid="tv-content">{String(content ?? '')}</pre>
    </div>
  ),
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

describe('VolumeInspectTab', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading initially and passes stable props to TextViewerTab', async () => {
    const swarmApi = await import('../docker/swarmApi.js');
    swarmApi.GetSwarmVolumeInspectJSON.mockImplementation(
      () => new Promise(() => {}),
    );

    const { default: VolumeInspectTab } =
      await import('../docker/resources/volumes/VolumeInspectTab.jsx');

    render(<VolumeInspectTab volumeName="myvol" />);

    expect(screen.getByTestId('tv-loading').textContent).toBe('true');
    expect(screen.getByTestId('tv-label').textContent).toBe(
      'Loading volume inspect...',
    );
    expect(screen.getByTestId('tv-filename').textContent).toBe('myvol.json');

    await waitFor(() => {
      expect(swarmApi.GetSwarmVolumeInspectJSON).toHaveBeenCalledWith('myvol');
    });
  });

  it('renders content on success', async () => {
    const swarmApi = await import('../docker/swarmApi.js');
    swarmApi.GetSwarmVolumeInspectJSON.mockResolvedValueOnce(
      '{"Name":"myvol"}',
    );

    const { default: VolumeInspectTab } =
      await import('../docker/resources/volumes/VolumeInspectTab.jsx');

    render(<VolumeInspectTab volumeName="myvol" />);

    await waitFor(() => {
      expect(screen.getByTestId('tv-loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('tv-error').textContent).toBe('');
    expect(screen.getByTestId('tv-content').textContent).toBe(
      '{"Name":"myvol"}',
    );
  });

  it('renders empty content for null-ish results', async () => {
    const swarmApi = await import('../docker/swarmApi.js');
    swarmApi.GetSwarmVolumeInspectJSON.mockResolvedValueOnce(null);

    const { default: VolumeInspectTab } =
      await import('../docker/resources/volumes/VolumeInspectTab.jsx');

    render(<VolumeInspectTab volumeName="myvol" />);

    await waitFor(() => {
      expect(screen.getByTestId('tv-loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('tv-content').textContent).toBe('');
  });

  it('renders error on failure', async () => {
    const swarmApi = await import('../docker/swarmApi.js');
    swarmApi.GetSwarmVolumeInspectJSON.mockRejectedValueOnce(new Error('boom'));

    const { default: VolumeInspectTab } =
      await import('../docker/resources/volumes/VolumeInspectTab.jsx');

    render(<VolumeInspectTab volumeName="myvol" />);

    await waitFor(() => {
      expect(screen.getByTestId('tv-loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('tv-error').textContent).toBe('boom');
  });

  it('does not throw if unmounted before request resolves', async () => {
    const swarmApi = await import('../docker/swarmApi.js');
    const d = deferred();
    swarmApi.GetSwarmVolumeInspectJSON.mockReturnValueOnce(d.promise);

    const { default: VolumeInspectTab } =
      await import('../docker/resources/volumes/VolumeInspectTab.jsx');

    const { unmount } = render(<VolumeInspectTab volumeName="myvol" />);

    unmount();
    d.resolve('{"Name":"myvol"}');

    await Promise.resolve();
  });
});
