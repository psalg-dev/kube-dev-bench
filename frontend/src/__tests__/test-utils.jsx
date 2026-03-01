// Shared testing utilities for frontend unit tests
import React from 'react';
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClusterStateProvider } from '../state/ClusterStateContext.jsx';
import { resetAllMocks, appApiMocks, genericAPIMock, triggerRuntimeEvent, emitRuntimeEvent } from './wailsMocks.js';

// Default wrapper that provides common app providers (ClusterStateProvider, Router)
export function renderWithProviders(ui, { route = '/' } = {}) {
  const Wrapper = ({ children }) => (
    <MemoryRouter initialEntries={[route]}>
      <ClusterStateProvider>{children}</ClusterStateProvider>
    </MemoryRouter>
  );
  return render(ui, { wrapper: Wrapper });
}

// Reset centralized mocks to known defaults between tests
export function resetMocks() {
  resetAllMocks();
}

// Helper to set specific App API mock implementations in tests
export function mockAppApi(name, impl) {
  if (!appApiMocks[name]) {
    // create a default mock in the registry if it does not exist
    appApiMocks[name] = vi.fn((...args) => genericAPIMock(name, ...args));
  }
  appApiMocks[name].mockImplementation(impl);
  return appApiMocks[name];
}

// Expose a small delay helper
export const flushPromises = () => new Promise((r) => setTimeout(r, 0));

// Re-export runtime event helpers for convenience in tests
export { triggerRuntimeEvent, emitRuntimeEvent };

