import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import UpdateServiceImageModal from '../docker/resources/services/UpdateServiceImageModal.jsx';

describe('UpdateServiceImageModal', () => {
  it('renders null when closed', () => {
    const { container } = render(
      <UpdateServiceImageModal open={false} currentImage="nginx:1" serviceName="svc" onClose={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(container.textContent).toBe('');
  });

  it('requires a changed image to enable update and confirms trimmed value', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <UpdateServiceImageModal
        open={true}
        currentImage="nginx:1"
        serviceName="svc"
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    const input = document.querySelector('#swarm-service-update-image-input');
    expect(input.value).toBe('nginx:1');

    const updateBtn = screen.getByText('Update');
    expect(updateBtn).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, ' nginx:2  ');
    expect(updateBtn).not.toBeDisabled();

    fireEvent.click(updateBtn);
    expect(onConfirm).toHaveBeenCalledWith('nginx:2');
  });
});
