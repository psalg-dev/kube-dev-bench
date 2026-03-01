import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, resetMocks, triggerRuntimeEvent, flushPromises } from './test-utils.jsx';
import PortForwardOutput from '../k8s/resources/pods/PortForwardOutput.jsx';
import { fireEvent } from '@testing-library/react';

describe('PortForwardOutput - negative and boundary cases', () => {
  beforeEach(() => { resetMocks(); });

  it('Open button remains disabled until ready; Stop invokes StopPortForward', async () => {
    const namespace = 'default';
    const podName = 'mypod';
    const localPort = 30000;
    const remotePort = 80;

    // Provide a StopPortForward implementation
    const stopMock = vi.fn(async () => { /* simulate stop */ });
    window.go = { main: { App: { StopPortForward: stopMock } } };

    const { getByText, findByText } = renderWithProviders(<PortForwardOutput namespace={namespace} podName={podName} localPort={localPort} remotePort={remotePort} />);

    // Initially, waiting for output message
    await findByText('Waiting for output...');

    // Open should be disabled
    const openBtn = getByText('Open');
    expect(openBtn).toBeDisabled();

    // Trigger ready event so Open becomes enabled
    const key = `${namespace}/${podName}:${localPort}:${remotePort}`;
    triggerRuntimeEvent(`portforward:${key}:ready`);
    await flushPromises();
    // Now Open should be enabled
    expect(openBtn).not.toBeDisabled();

    // Click Stop and verify StopPortForward called
    const stopBtn = getByText('Stop');
    fireEvent.click(stopBtn);
    // await next tick
    await flushPromises();
    expect(stopMock).toHaveBeenCalledWith(namespace, podName, localPort);
  });

  it('handles error event payloads of unexpected types', async () => {
    const namespace = 'default';
    const podName = 'mypod2';
    const localPort = 30001;
    const remotePort = 81;
    const { findByText } = renderWithProviders(<PortForwardOutput namespace={namespace} podName={podName} localPort={localPort} remotePort={remotePort} />);

    const key = `${namespace}/${podName}:${localPort}:${remotePort}`;
    // Send an object as error payload - should be stringified
    triggerRuntimeEvent(`portforward:${key}:error`, { code: 123, msg: 'boom' });
    await flushPromises();
    await findByText(/\[error\] /);
  });
});