import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const notifications = vi.hoisted(() => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const swarmApi = vi.hoisted(() => ({
  CheckServiceImageUpdates: vi.fn(),
  UpdateSwarmServiceImage: vi.fn(),
}));

vi.mock('../notification', () => notifications);
vi.mock('../docker/swarmApi', () => swarmApi);

import ImageUpdateModal from '../docker/resources/services/ImageUpdateModal';

beforeEach(() => {
  notifications.showError.mockReset();
  notifications.showSuccess.mockReset();
  swarmApi.CheckServiceImageUpdates.mockReset();
  swarmApi.UpdateSwarmServiceImage.mockReset();
});

describe('ImageUpdateModal', () => {
  it('renders null when closed', () => {
    const { container } = render(
      <ImageUpdateModal open={false} service={{}} onClose={vi.fn()} />
    );
    expect(container.textContent).toBe('');
  });

  it('shows unknown state when digests missing', () => {
    render(
      <ImageUpdateModal
        open={true}
        service={{ id: 's1', name: 'svc', image: 'nginx:latest' }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Unknown')).toBeTruthy();
    expect(screen.getByText('Image Updates')).toBeTruthy();
  });

  it('check now shows success when no error', async () => {
    swarmApi.CheckServiceImageUpdates.mockResolvedValueOnce({ s1: {} });

    render(
      <ImageUpdateModal
        open={true}
        service={{ id: 's1', name: 'svc', image: 'nginx:latest' }}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Check now'));

    await waitFor(() => {
      expect(swarmApi.CheckServiceImageUpdates).toHaveBeenCalledWith(['s1']);
      expect(notifications.showSuccess).toHaveBeenCalledWith('Image update check complete');
    });
  });

  it('check now shows error when response includes error', async () => {
    swarmApi.CheckServiceImageUpdates.mockResolvedValueOnce({ s1: { error: 'bad auth' } });

    render(
      <ImageUpdateModal
        open={true}
        service={{ id: 's1', name: 'svc', image: 'nginx:latest' }}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Check now'));

    await waitFor(() => {
      expect(notifications.showError).toHaveBeenCalledWith('Image update check failed: bad auth');
    });
  });

  it('update now triggers update and closes', async () => {
    const onClose = vi.fn();
    swarmApi.UpdateSwarmServiceImage.mockResolvedValueOnce(undefined);

    render(
      <ImageUpdateModal
        open={true}
        service={{
          id: 's1',
          name: 'svc',
          image: 'nginx:latest',
          imageLocalDigest: 'sha256:aaa',
          imageRemoteDigest: 'sha256:bbb',
          imageUpdateAvailable: true,
        }}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText('Update now'));

    await waitFor(() => {
      expect(swarmApi.UpdateSwarmServiceImage).toHaveBeenCalledWith('s1', 'nginx:latest');
      expect(notifications.showSuccess).toHaveBeenCalledWith('Triggered update for svc');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('update now shows error on failure', async () => {
    swarmApi.UpdateSwarmServiceImage.mockRejectedValueOnce('boom');

    render(
      <ImageUpdateModal
        open={true}
        service={{ id: 's1', name: 'svc', image: 'nginx:latest' }}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Update now'));

    await waitFor(() => {
      expect(notifications.showError).toHaveBeenCalledWith('Failed to trigger update: boom');
    });
  });
});
