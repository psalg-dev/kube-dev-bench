import { describe, it, expect } from 'vitest';
import {
  clusterStateReducer as reducer,
  initialState,
} from '../state/ClusterStateContext.jsx';

function reduce(actions, start = initialState) {
  return actions.reduce((s, a) => reducer(s, a), start);
}

describe('clusterStateReducer', () => {
  it('sets loading flag', () => {
    const state = reducer(initialState, { type: 'SET_LOADING', loading: true });
    expect(state.loading).toBe(true);
  });

  it('sets contexts and enables context select', () => {
    const ctxs = ['c1', 'c2'];
    const state = reducer(initialState, {
      type: 'SET_CONTEXTS',
      contexts: ctxs,
    });
    expect(state.contexts).toEqual(ctxs);
    expect(state.contextDisabled).toBe(false);
  });

  it('sets namespaces and enables namespace select', () => {
    const nss = ['default', 'kube-system'];
    const state = reducer(initialState, {
      type: 'SET_NAMESPACES',
      namespaces: nss,
    });
    expect(state.namespaces).toEqual(nss);
    expect(state.namespaceDisabled).toBe(false);
  });

  it('selects context & namespaces', () => {
    const state = reduce([
      { type: 'SET_SELECTED_CONTEXT', value: 'c1' },
      { type: 'SET_SELECTED_NAMESPACES', values: ['ns1', 'ns2'] },
    ]);
    expect(state.selectedContext).toBe('c1');
    expect(state.selectedNamespaces).toEqual(['ns1', 'ns2']);
  });

  it('disables namespaces', () => {
    const state = reducer(initialState, { type: 'DISABLE_NAMESPACES' });
    expect(state.namespaceDisabled).toBe(true);
  });

  it('sets connection status', () => {
    const statusObj = { isInsecure: true };
    const state = reducer(initialState, {
      type: 'SET_CONNECTION_STATUS',
      status: statusObj,
    });
    expect(state.connectionStatus).toBe(statusObj);
  });

  it('sets wizard visibility', () => {
    const state = reducer(initialState, {
      type: 'SET_SHOW_WIZARD',
      value: true,
    });
    expect(state.showWizard).toBe(true);
  });

  it('marks initialized', () => {
    const state = reducer(initialState, { type: 'SET_INITIALIZED' });
    expect(state.initialized).toBe(true);
  });

  it('returns existing state for unknown action', () => {
    const state = reducer(initialState, { type: 'UNKNOWN_ACTION' });
    expect(state).toBe(initialState);
  });
});
