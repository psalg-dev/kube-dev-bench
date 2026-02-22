import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const notifications = vi.hoisted(() => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const swarmApi = vi.hoisted(() => ({
  GetImageUpdateSettings: vi.fn(),
  SetImageUpdateSettings: vi.fn(),
}));

vi.mock('../notification', () => notifications);
vi.mock('../docker/swarmApi', () => swarmApi);

import ImageUpdateSettingsModal from '../docker/resources/services/ImageUpdateSettingsModal';

beforeEach(() => {
  notifications.showError.mockReset();
  notifications.showSuccess.mockReset();
  swarmApi.GetImageUpdateSettings.mockReset();
  swarmApi.SetImageUpdateSettings.mockReset();
});

describe('ImageUpdateSettingsModal', () => {
  it('loads settings on open and populates fields', async () => {
    swarmApi.GetImageUpdateSettings.mockResolvedValueOnce({ enabled: true, intervalSeconds: 600 });

    render(<ImageUpdateSettingsModal open={true} onClose={vi.fn()} />);

    const enabled = await screen.findByLabelText('Enable auto-check');
    expect(enabled).toBeTruthy();
    expect(enabled).toBeChecked();

    const interval = document.querySelector<HTMLInputElement>('#swarm-image-update-interval');
    expect(interval).toBeTruthy();
    expect(interval?.value).toBe('10');
  });

  it('saves settings (minutes -> seconds) and closes', async () => {
    const onClose = vi.fn();
    swarmApi.GetImageUpdateSettings.mockResolvedValueOnce({ enabled: false, intervalSeconds: 300 });
    swarmApi.SetImageUpdateSettings.mockResolvedValueOnce(undefined);

    render(<ImageUpdateSettingsModal open={true} onClose={onClose} />);

    const enabled = await screen.findByLabelText('Enable auto-check');
    fireEvent.click(enabled);
    expect(enabled).toBeChecked();

    const interval = document.querySelector<HTMLInputElement>('#swarm-image-update-interval');
    expect(interval).toBeTruthy();

    await userEvent.clear(interval as HTMLInputElement);
    await userEvent.type(interval as HTMLInputElement, '2');

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(swarmApi.SetImageUpdateSettings).toHaveBeenCalledWith({ enabled: true, intervalSeconds: 120 });
      expect(notifications.showSuccess).toHaveBeenCalledWith('Image update settings saved');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows load error', async () => {
    swarmApi.GetImageUpdateSettings.mockRejectedValueOnce('boom');

    render(<ImageUpdateSettingsModal open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(notifications.showError).toHaveBeenCalledWith('Failed to load image update settings: boom');
    });
  });

  it('shows save error', async () => {
    swarmApi.GetImageUpdateSettings.mockResolvedValueOnce({ enabled: false, intervalSeconds: 300 });
    swarmApi.SetImageUpdateSettings.mockRejectedValueOnce('nope');

    render(<ImageUpdateSettingsModal open={true} onClose={vi.fn()} />);

    await screen.findByLabelText('Enable auto-check');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(notifications.showError).toHaveBeenCalledWith('Failed to save image update settings: nope');
    });
  });
});
