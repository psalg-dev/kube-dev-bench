import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, mockAppApi, resetMocks, flushPromises } from './test-utils.jsx';
import PortForwardDialog from '../k8s/resources/pods/PortForwardDialog.jsx';
import { fireEvent } from '@testing-library/react';

describe('PortForwardDialog', () => {
  beforeEach(() => { resetMocks(); });

  it('returns null when open is false', () => {
    const { queryByText } = renderWithProviders(<PortForwardDialog open={false} podName="mypod" />);
    expect(queryByText('Port Forward')).toBeNull();
  });

  it('fetches ports and allows starting when valid', async () => {
    // PortForwardDialog expects window.go.main.App.GetPodContainerPorts; provide it here
    window.go = { main: { App: { GetPodContainerPorts: async (podName) => [8080, 9090] } } };
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { findByText, getByText } = renderWithProviders(<PortForwardDialog open={true} podName="mypod" onConfirm={onConfirm} onCancel={onCancel} />);
    await flushPromises();
    // detected ports buttons appear
    const portButton = await findByText('8080');
    expect(portButton).toBeTruthy();
    // click port button sets source port
    fireEvent.click(portButton);
    // Start button should be enabled (has text Start)
    const startBtn = getByText('Start');
    expect(startBtn).toBeTruthy();
    // click Start should call onConfirm with numeric ports
    fireEvent.click(startBtn);
    expect(onConfirm).toHaveBeenCalled();
  });
});
