import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders, resetMocks, triggerRuntimeEvent, mockAppApi, flushPromises } from './test-utils.jsx';
import PortForwardOutput from '../k8s/resources/pods/PortForwardOutput.jsx';

describe('PortForwardOutput', () => {
  beforeEach(() => { resetMocks(); });

  it('shows message when no pod selected', () => {
    const { getByText } = renderWithProviders(<PortForwardOutput namespace="ns" podName={null} localPort={30000} remotePort={80} />);
    expect(getByText('Select a pod to view port-forward output.')).toBeTruthy();
  });

  it('registers events and displays output lines', async () => {
    const namespace = 'default';
    const podName = 'mypod';
    const localPort = 30000;
    const remotePort = 80;
    const { findByText } = renderWithProviders(<PortForwardOutput namespace={namespace} podName={podName} localPort={localPort} remotePort={remotePort} />);
    // trigger ready and output events
    const key = `${namespace}/${podName}:${localPort}:${remotePort}`;
    triggerRuntimeEvent(`portforward:${key}:ready`);
    triggerRuntimeEvent(`portforward:${key}:output`, 'hello world');
    triggerRuntimeEvent(`portforward:${key}:error`, 'oops');
    triggerRuntimeEvent(`portforward:${key}:exit`);
    // flush promises
    await flushPromises();
    // verify lines appeared
    await findByText('[ready] Forwarding 30000 -> 80');
    await findByText('hello world');
    await findByText('[error] oops');
    await findByText('[exit] port-forward ended');
  });
});
