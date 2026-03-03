import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders, mockAppApi, resetMocks, flushPromises } from './test-utils.jsx';
import PodEventsTab from '../k8s/resources/pods/PodEventsTab.jsx';

describe('PodEventsTab', () => {
  beforeEach(() => { resetMocks(); });

  it('renders no events when GetPodEvents returns empty array', async () => {
    mockAppApi('GetPodEvents', async (ns, pod) => []);
    const { getByText, queryByText } = renderWithProviders(<PodEventsTab namespace="default" podName="mypod" />);
    // Initially may show Loading… then No events.
    await flushPromises();
    expect(queryByText('Loading…')).toBeNull();
    expect(getByText('No events.')).toBeTruthy();
  });

  it('renders events returned by GetPodEvents', async () => {
    mockAppApi('GetPodEvents', async () => ([
      { type: 'Normal', reason: 'Started', message: 'Started container', count: 1, lastTimestamp: Date.now() },
      { type: 'Warning', reason: 'Failed', message: 'CrashLoopBackOff', count: 3, lastTimestamp: Date.now() }
    ]));
    const { findByText } = renderWithProviders(<PodEventsTab namespace="default" podName="mypod" />);
    // wait for rendered rows
    await findByText('Started');
    await findByText('Failed');
    expect(await findByText('Started')).toBeTruthy();
  });
});
