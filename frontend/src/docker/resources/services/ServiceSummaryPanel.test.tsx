import '../../../__tests__/wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ServiceSummaryPanel from './ServiceSummaryPanel';
import type { docker } from '../../../../wailsjs/go/models';

const { UpdateSwarmServiceImage, ScaleSwarmService } = vi.hoisted(() => ({
  UpdateSwarmServiceImage: vi.fn(),
  ScaleSwarmService: vi.fn(),
}));
const { showSuccess, showError } = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../../swarmApi', () => ({ UpdateSwarmServiceImage, ScaleSwarmService }));
vi.mock('../../../notification', () => ({ showSuccess, showError }));

const row = {
  id: 'svc-1',
  name: 'my-service',
  image: 'nginx:alpine',
  mode: 'replicated',
  replicas: 2,
} as unknown as docker.SwarmServiceInfo;

describe('ServiceSummaryPanel – update image', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens the update-image modal from the button', () => {
    render(<ServiceSummaryPanel row={row} />);
    fireEvent.click(document.getElementById('swarm-service-update-image-btn')!);
    expect(screen.getByText(`Update Service Image: ${row.name}`)).toBeInTheDocument();
  });

  it('confirming calls UpdateSwarmServiceImage, shows success and refreshes', async () => {
    UpdateSwarmServiceImage.mockResolvedValue(undefined);
    const onRefresh = vi.fn();
    render(<ServiceSummaryPanel row={row} onRefresh={onRefresh} />);

    fireEvent.click(document.getElementById('swarm-service-update-image-btn')!);
    const input = document.getElementById('swarm-service-update-image-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'nginx:1.25-alpine' } });
    fireEvent.click(document.getElementById('swarm-service-update-image-confirm-btn')!);

    await waitFor(() => expect(UpdateSwarmServiceImage).toHaveBeenCalledWith('svc-1', 'nginx:1.25-alpine'));
    expect(showSuccess).toHaveBeenCalledWith(expect.stringMatching(/updated/i));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });
});
