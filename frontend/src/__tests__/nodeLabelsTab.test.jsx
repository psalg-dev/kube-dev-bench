import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { swarmApiMocks, notificationMocks } = vi.hoisted(() => {
  return {
    swarmApiMocks: {
      UpdateSwarmNodeLabels: vi.fn(),
    },
    notificationMocks: {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    },
  };
});

vi.mock('../docker/swarmApi.js', () => swarmApiMocks);
vi.mock('../notification.js', () => notificationMocks);

// Make KeyValueEditor deterministic and easy to manipulate.
vi.mock('../components/forms/KeyValueEditor.jsx', () => ({
  default: function KeyValueEditorMock({ rows, onChange }) {
    return (
      <div>
        <div data-testid="kv-count">{rows.length}</div>
        <button
          type="button"
          onClick={() => {
            onChange([
              { id: '1', key: 'env', value: 'prod' },
              { id: '2', key: 'zone', value: 'a' },
            ]);
          }}
        >
          Set Labels
        </button>
      </div>
    );
  },
}));

import NodeLabelsTab from '../docker/resources/nodes/NodeLabelsTab.jsx';

describe('NodeLabelsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('save/reset disabled when not dirty; becomes enabled after edit; save calls API', async () => {
    swarmApiMocks.UpdateSwarmNodeLabels.mockResolvedValue(undefined);

    render(<NodeLabelsTab nodeId="node1" initialLabels={{ env: 'prod' }} />);

    const reset = screen.getByRole('button', { name: 'Reset' });
    const save = screen.getByRole('button', { name: 'Save' });

    expect(reset).toBeDisabled();
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Set Labels' }));

    expect(reset).not.toBeDisabled();
    expect(save).not.toBeDisabled();

    fireEvent.click(save);

    await waitFor(() =>
      expect(swarmApiMocks.UpdateSwarmNodeLabels).toHaveBeenCalledWith(
        'node1',
        { env: 'prod', zone: 'a' },
      ),
    );
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith(
      'Node labels updated',
    );
  });

  it('shows error when API fails', async () => {
    swarmApiMocks.UpdateSwarmNodeLabels.mockRejectedValue('nope');

    render(<NodeLabelsTab nodeId="node1" initialLabels={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Set Labels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(notificationMocks.showError).toHaveBeenCalled());
    expect(notificationMocks.showError.mock.calls[0][0]).toContain(
      'Failed to update node labels',
    );
  });
});
