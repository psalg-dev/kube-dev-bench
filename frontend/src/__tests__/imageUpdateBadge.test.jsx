import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const notifications = vi.hoisted(() => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const swarmApi = vi.hoisted(() => ({
  CheckServiceImageUpdates: vi.fn(),
}));

vi.mock('../notification.js', () => notifications);
vi.mock('../docker/swarmApi.js', () => swarmApi);

import ImageUpdateBadge from '../docker/resources/services/ImageUpdateBadge.jsx';

beforeEach(() => {
  notifications.showError.mockReset();
  notifications.showSuccess.mockReset();
  swarmApi.CheckServiceImageUpdates.mockReset();
});

describe('ImageUpdateBadge', () => {
  it('renders disabled when serviceId is missing', () => {
    render(<ImageUpdateBadge value={{}} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('-');
  });

  it('click opens details (default), no API call', () => {
    const onOpenDetails = vi.fn();
    render(
      <ImageUpdateBadge
        value={{ serviceId: 'svc1', imageLocalDigest: 'sha256:aaa', imageRemoteDigest: 'sha256:bbb', imageUpdateAvailable: true }}
        onOpenDetails={onOpenDetails}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onOpenDetails).toHaveBeenCalledWith('svc1');
    expect(swarmApi.CheckServiceImageUpdates).not.toHaveBeenCalled();
  });

  it('shift-click runs quick check and shows success', async () => {
    swarmApi.CheckServiceImageUpdates.mockResolvedValueOnce({ svc1: {} });

    render(<ImageUpdateBadge value={{ serviceId: 'svc1' }} />);

    fireEvent.click(screen.getByRole('button'), { shiftKey: true });

    await waitFor(() => {
      expect(swarmApi.CheckServiceImageUpdates).toHaveBeenCalledWith(['svc1']);
      expect(notifications.showSuccess).toHaveBeenCalledWith('Image update check complete');
    });
  });

  it('shift-click shows backend error when response contains error', async () => {
    swarmApi.CheckServiceImageUpdates.mockResolvedValueOnce({ svc1: { error: 'no registry' } });

    render(<ImageUpdateBadge value={{ serviceId: 'svc1' }} />);
    fireEvent.click(screen.getByRole('button'), { shiftKey: true });

    await waitFor(() => {
      expect(notifications.showError).toHaveBeenCalledWith('Image update check failed: no registry');
    });
  });

  it('shift-click shows error when API throws', async () => {
    swarmApi.CheckServiceImageUpdates.mockRejectedValueOnce('boom');

    render(<ImageUpdateBadge value={{ serviceId: 'svc1' }} />);
    fireEvent.click(screen.getByRole('button'), { shiftKey: true });

    await waitFor(() => {
      expect(notifications.showError).toHaveBeenCalledWith('Image update check failed: boom');
    });
  });
});
