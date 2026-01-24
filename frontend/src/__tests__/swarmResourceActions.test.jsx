import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const showWarningMock = vi.fn();

// Cover both specifier styles (with and without .js)
vi.mock('../notification', () => ({
  showWarning: (...args) => showWarningMock(...args),
}));
vi.mock('../notification.js', () => ({
  showWarning: (...args) => showWarningMock(...args),
}));

import SwarmResourceActions from '../docker/resources/SwarmResourceActions.jsx';

describe('SwarmResourceActions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('scales a resource and closes the dialog', async () => {
    const onScale = vi.fn().mockResolvedValue(undefined);

    render(
      <SwarmResourceActions
        resourceType="service"
        name="svc"
        canScale
        currentReplicas={2}
        onScale={onScale}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Scale' }));

    expect(screen.getByText('Scale service: svc')).toBeTruthy();

    const heading = screen.getByRole('heading', { name: /Scale\s+service:\s+svc/i });
    const modal = heading.closest('div');
    if (!modal) throw new Error('Scale modal container not found');

    const input = within(modal).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '3' } });

    fireEvent.click(within(modal).getByRole('button', { name: 'Scale' }));

    await waitFor(() => {
      expect(onScale).toHaveBeenCalledWith(3);
    });

    await waitFor(() => {
      expect(screen.queryByText('Scale service: svc')).toBeNull();
    });
  });

  it('blocks negative scale values with a warning', async () => {
    const onScale = vi.fn().mockResolvedValue(undefined);

    render(
      <SwarmResourceActions
        resourceType="service"
        name="svc"
        canScale
        currentReplicas={2}
        onScale={onScale}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Scale' }));

    const heading = screen.getByRole('heading', { name: /Scale\s+service:\s+svc/i });
    const modal = heading.closest('div');
    if (!modal) throw new Error('Scale modal container not found');

    const input = within(modal).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '-1' } });

    fireEvent.click(within(modal).getByRole('button', { name: 'Scale' }));

    expect(showWarningMock).toHaveBeenCalledWith('Replicas cannot be negative');
    expect(onScale).not.toHaveBeenCalled();
  });

  it('restarts immediately via onRestart', async () => {
    const onRestart = vi.fn().mockResolvedValue(undefined);

    render(
      <SwarmResourceActions
        resourceType="service"
        name="svc"
        onRestart={onRestart}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));

    await waitFor(() => {
      expect(onRestart).toHaveBeenCalledTimes(1);
    });
  });

  it('opens delete confirmation dialog and calls onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <SwarmResourceActions
        resourceType="service"
        name="svc"
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete service?')).toBeTruthy();

    // cancel closes
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Delete service?')).toBeNull());

    // reopen and confirm delete
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).slice(-1)[0]);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.queryByText('Delete service?')).toBeNull();
    });
  });

  it('shows node availability actions based on availability', () => {
    const onDrain = vi.fn();
    const onActivate = vi.fn();

    const { rerender } = render(
      <SwarmResourceActions
        resourceType="node"
        name="node-1"
        availability="active"
        onDrain={onDrain}
        onActivate={onActivate}
      />
    );

    expect(screen.getByRole('button', { name: 'Drain' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();

    rerender(
      <SwarmResourceActions
        resourceType="node"
        name="node-1"
        availability="drain"
        onDrain={onDrain}
        onActivate={onActivate}
      />
    );

    expect(screen.queryByRole('button', { name: 'Drain' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Activate' })).toBeTruthy();
  });
});
