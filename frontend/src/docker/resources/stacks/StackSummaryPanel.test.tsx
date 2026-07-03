import '../../../__tests__/wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StackSummaryPanel from './StackSummaryPanel';
import type { docker } from '../../../../wailsjs/go/models';

const { GetSwarmStackComposeYAML, CreateSwarmStack, RollbackSwarmStack } = vi.hoisted(() => ({
  GetSwarmStackComposeYAML: vi.fn(),
  CreateSwarmStack: vi.fn(),
  RollbackSwarmStack: vi.fn(),
}));
const { showSuccess, showError } = vi.hoisted(() => ({ showSuccess: vi.fn(), showError: vi.fn() }));

vi.mock('../../swarmApi', () => ({ GetSwarmStackComposeYAML, CreateSwarmStack, RollbackSwarmStack }));
vi.mock('../../../notification', () => ({ showSuccess, showError }));

const row = { name: 'my-stack', services: 1 } as unknown as docker.SwarmStackInfo;

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

describe('StackSummaryPanel – actions', () => {
  it('export fetches compose and shows success', async () => {
    GetSwarmStackComposeYAML.mockResolvedValue('services:\n  web: {}');
    render(<StackSummaryPanel row={row} />);
    fireEvent.click(document.getElementById('swarm-stack-export-btn')!);
    await waitFor(() => expect(GetSwarmStackComposeYAML).toHaveBeenCalledWith('my-stack'));
    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith('Exported stack "my-stack" compose'));
  });

  it('update opens modal and confirming redeploys + refreshes', async () => {
    GetSwarmStackComposeYAML.mockResolvedValue('services:\n  web: {}');
    CreateSwarmStack.mockResolvedValue(undefined);
    const onRefresh = vi.fn();
    render(<StackSummaryPanel row={row} onRefresh={onRefresh} />);

    fireEvent.click(document.getElementById('swarm-stack-update-btn')!);
    await waitFor(() => expect(screen.getByText('Update Stack: my-stack')).toBeInTheDocument());

    // Confirm is gated on the yaml changing (canSave), so edit it first.
    fireEvent.change(document.getElementById('swarm-stack-update-yaml')!, {
      target: { value: 'services:\n  web:\n    image: nginx:1.21' },
    });
    fireEvent.click(document.getElementById('swarm-stack-update-confirm-btn')!);
    await waitFor(() => expect(CreateSwarmStack).toHaveBeenCalledWith('my-stack', expect.any(String)));
    expect(showSuccess).toHaveBeenCalledWith('Updated stack "my-stack"');
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });
});
