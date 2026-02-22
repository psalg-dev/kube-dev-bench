import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders, mockAppApi, resetMocks, flushPromises } from './test-utils.jsx';
import { fireEvent } from '@testing-library/react';
import PodEventsTab from '../k8s/resources/pods/PodEventsTab.jsx';

describe('PodEventsTab - error and refresh paths', () => {
  beforeEach(() => { resetMocks(); });

  it('displays an error when GetPodEvents throws and recovers on Refresh', async () => {
    // First call throws
    mockAppApi('GetPodEvents', async () => { throw new Error('boom'); });
    const { getByText, queryByText } = renderWithProviders(<PodEventsTab namespace="default" podName="mypod" />);
    await flushPromises();
    expect(getByText(/Error:/)).toBeTruthy();
    expect(getByText(/boom/)).toBeTruthy();

    // Now mock a successful response and click Refresh
    mockAppApi('GetPodEvents', async () => []);
    const refreshBtn = getByText('Refresh');
    fireEvent.click(refreshBtn);
    await flushPromises();
    expect(queryByText(/Error:/)).toBeNull();
    expect(getByText('No events.')).toBeTruthy();
  });
});