import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, mockAppApi, resetMocks, flushPromises } from './test-utils.jsx';
import PortForwardDialog from '../k8s/resources/pods/PortForwardDialog.jsx';
import { fireEvent } from '@testing-library/react';

describe('PortForwardDialog - error and invalid inputs', () => {
  beforeEach(() => { resetMocks(); });

  it('shows error when GetPodContainerPorts throws', async () => {
    window.go = { main: { App: { GetPodContainerPorts: async () => { throw new Error('nogo'); } } } };
    const { findByText } = renderWithProviders(<PortForwardDialog open={true} podName="mypod" />);
    // wait for loading and error
    await findByText(/Error:/);
    expect(await findByText(/nogo/)).toBeTruthy();
  });

  it('disables Start when target port invalid or source missing', async () => {
    // Provide empty detected ports
    window.go = { main: { App: { GetPodContainerPorts: async () => [] } } };
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { getByText, getByLabelText } = renderWithProviders(<PortForwardDialog open={true} podName="mypod" onConfirm={onConfirm} onCancel={onCancel} />);
    // Wait for ports fetch to finish
    await flushPromises();
    // Set source port to a valid number but set target port to invalid (e.g., 100)
    const sourceInput = getByLabelText(/Source port/i);
    const targetInput = getByLabelText(/Target port/i);
    fireEvent.change(sourceInput, { target: { value: '8080' } });
    fireEvent.change(targetInput, { target: { value: '100' } });
    const startBtn = getByText('Start');
    expect(startBtn).toBeTruthy();
    expect(startBtn).toBeDisabled();
  });
});