import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App.jsx';
import { renderWithProviders, resetMocks } from './test-utils.jsx';

// Smoke test for App negative paths
describe('App - negative cases', () => {
  beforeEach(() => { resetMocks(); });

  it('does not throw when navigate-to-resource event has unknown resource', async () => {
    const { container } = renderWithProviders(<App />);
    // dispatch unknown resource
    const ev = new CustomEvent('navigate-to-resource', { detail: { resource: 'UnknownType', name: 'x', namespace: 'y' } });
    // Should not throw
    window.dispatchEvent(ev);
    expect(container).toBeTruthy();
  });
});