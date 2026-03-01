import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders } from './test-utils.jsx';
import { useClusterState } from '../state/ClusterStateContext.jsx';

function Probe() {
  const state = useClusterState();
  return <div data-testid="initialized">{String(!!state.initialized)}</div>;
}

describe('test-utils wrapper', () => {
  it('provides ClusterStateProvider to components', () => {
    const { getByTestId } = renderWithProviders(<Probe />);
    expect(getByTestId('initialized').textContent).toBe('false');
  });
});
