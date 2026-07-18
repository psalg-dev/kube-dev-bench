import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalProvider, showModalConfirm, showModalPrompt, __resetModalQueuesForTests } from '../components/ModalProvider';

describe('ModalProvider', () => {
  beforeEach(() => {
    __resetModalQueuesForTests();
  });

  it('shows a confirm dialog and resolves true on Confirm', async () => {
    render(<ModalProvider />);
    const result = showModalConfirm('Remove thing?');
    expect(await screen.findByText('Remove thing?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await expect(result).resolves.toBe(true);
  });

  it('resolves false on Cancel', async () => {
    render(<ModalProvider />);
    const result = showModalConfirm('Sure?');
    await screen.findByText('Sure?');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(result).resolves.toBe(false);
  });

  it('shows a prompt with default value and resolves the edited value on OK', async () => {
    render(<ModalProvider />);
    const result = showModalPrompt('Local port:', '20000');
    const input = (await screen.findByLabelText('Local port:')) as HTMLInputElement;
    expect(input.value).toBe('20000');
    fireEvent.change(input, { target: { value: '8081' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await expect(result).resolves.toBe('8081');
  });

  it('resolves null when the prompt is cancelled', async () => {
    render(<ModalProvider />);
    const result = showModalPrompt('Name:');
    await screen.findByLabelText('Name:');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(result).resolves.toBeNull();
  });

  it('queues a second confirm behind the first', async () => {
    render(<ModalProvider />);
    const first = showModalConfirm('first');
    const second = showModalConfirm('second');
    await screen.findByText('first');
    expect(screen.queryByText('second')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await expect(first).resolves.toBe(true);
    await waitFor(() => expect(screen.getByText('second')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(second).resolves.toBe(false);
  });
});
