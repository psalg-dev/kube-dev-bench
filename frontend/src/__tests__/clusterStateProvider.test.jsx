import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { ClusterStateProvider, useClusterState } from '../state/ClusterStateContext.jsx';

// ---- Mocks ----
// Notification mocks (must match import path in provider: '../notification')
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn()
}));

// Backend kube API mock (define inside factory to avoid hoisting reference issues)
vi.mock('../k8s/resources/kubeApi.js', () => ({
  GetKubeConfigs: vi.fn(() => Promise.resolve([{ path: '/tmp/kubeconfig', name: 'kubeconfig', contexts: ['ctxA'] }])),
  GetKubeContexts: vi.fn(),
  GetNamespaces: vi.fn(),
  GetCurrentConfig: vi.fn(),
  SetCurrentKubeContext: vi.fn(() => Promise.resolve()),
  SetCurrentNamespace: vi.fn(() => Promise.resolve()),
  GetConnectionStatus: vi.fn(() => Promise.resolve({ connected: true })),
  SetPreferredNamespaces: vi.fn(() => Promise.resolve()),
}));

// Import mocks after they are defined
import * as kubeApi from '../k8s/resources/kubeApi.js';
import { showSuccess, showError as _showError, showWarning } from '../notification';

function Probe() {
  const state = useClusterState();
  return (
    <div>
      <pre data-testid="state">{JSON.stringify({
        contexts: state.contexts,
        namespaces: state.namespaces,
        selectedContext: state.selectedContext,
        selectedNamespaces: state.selectedNamespaces,
        showWizard: state.showWizard,
        initialized: state.initialized,
        loading: state.loading,
      })}</pre>
      <button onClick={() => state.actions.selectContext('ctxB')} data-testid="selectCtxB" />
      <button onClick={() => state.actions.selectNamespaces([])} data-testid="selectEmpty" />
    </div>
  );
}

function parseState() {
  return JSON.parse(screen.getByTestId('state').textContent);
}

async function renderAndWait() {
  await act(async () => { render(<ClusterStateProvider><Probe/></ClusterStateProvider>); });
  // Wait for the component to be initialized
  await waitFor(() => {
    const st = parseState();
    expect(st.initialized).toBe(true);
  }, { timeout: 3000 });
  // Give one more tick for any final state updates
  await act(async () => {});
}

beforeEach(() => {
  vi.clearAllMocks();
  // Also reset mock implementations to ensure clean state
  kubeApi.GetKubeContexts.mockReset();
  kubeApi.GetNamespaces.mockReset();
  kubeApi.GetCurrentConfig.mockReset();
  kubeApi.SetCurrentKubeContext.mockReset();
  kubeApi.SetCurrentNamespace.mockReset();
  kubeApi.GetConnectionStatus.mockReset();
  kubeApi.SetPreferredNamespaces.mockReset();
});

describe('ClusterStateProvider initialization', () => {
  it('shows wizard when no contexts', async () => {
    kubeApi.GetKubeContexts.mockResolvedValueOnce([]);
    kubeApi.GetCurrentConfig.mockResolvedValueOnce({ currentContext: '' });
    kubeApi.GetNamespaces.mockResolvedValueOnce([]);
    await renderAndWait();
    const st = parseState();
    expect(st.showWizard).toBe(true);
    expect(st.initialized).toBe(true);
    expect(showSuccess).not.toHaveBeenCalled();
  });

  it('auto-selects first context when currentContext invalid', async () => {
    kubeApi.GetCurrentConfig.mockResolvedValueOnce({ currentContext: 'missing', PreferredNamespaces: ['ns2'] });
    kubeApi.GetKubeContexts.mockResolvedValueOnce(['ctxA','ctxB']);
    kubeApi.GetNamespaces.mockResolvedValueOnce(['ns1','ns2']);
    await renderAndWait();
    // Wait for the async initialization to complete and state to be set
    await waitFor(() => {
      const st = parseState();
      expect(st.selectedContext).toBe('ctxA');
      expect(st.selectedNamespaces).toEqual(['ns2']);
    }, { timeout: 3000 });
    const st = parseState();
    expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining("Auto-selected context 'ctxA'"));
    expect(kubeApi.SetCurrentKubeContext).toHaveBeenCalledWith('ctxA');
    expect(kubeApi.SetCurrentNamespace).toHaveBeenCalledWith('ns2');
  });

  it('respects valid currentContext & preferred namespaces', async () => {
    kubeApi.GetCurrentConfig.mockResolvedValueOnce({ currentContext: 'ctx2', preferredNamespaces: ['ns2'] });
    kubeApi.GetKubeContexts.mockResolvedValueOnce(['ctx1','ctx2']);
    kubeApi.GetNamespaces.mockResolvedValueOnce(['ns1','ns2']);
    await renderAndWait();
    const st = parseState();
    expect(st.selectedContext).toBe('ctx2');
    expect(st.selectedNamespaces).toEqual(['ns2']);
    expect(showSuccess).not.toHaveBeenCalledWith(expect.stringContaining('Auto-selected context'));
  });

  it('warns when namespaces list is empty', async () => {
    kubeApi.GetCurrentConfig.mockResolvedValueOnce({ currentContext: 'ctx1' });
    kubeApi.GetKubeContexts.mockResolvedValueOnce(['ctx1']);
    kubeApi.GetNamespaces.mockResolvedValueOnce([]);
    await renderAndWait();
    // Wait for warning to be called
    await waitFor(() => {
      expect(showWarning).toHaveBeenCalledWith('No namespaces found for the selected context.');
    }, { timeout: 3000 });
    const st = parseState();
    expect(st.namespaces).toEqual([]);
    expect(st.selectedNamespaces).toEqual([]);
  });
});

describe('ClusterStateProvider actions', () => {
  async function initStandard() {
    kubeApi.GetCurrentConfig.mockResolvedValueOnce({ currentContext: 'ctxA' });
    kubeApi.GetKubeContexts.mockResolvedValueOnce(['ctxA','ctxB']);
    kubeApi.GetNamespaces.mockResolvedValueOnce(['ns1','ns2']);
    await renderAndWait();
  }

  it('selectContext switches context & resets namespaces', async () => {
    await initStandard();
    // prepare GetNamespaces for second context switch
    kubeApi.GetNamespaces.mockResolvedValueOnce(['nsX','nsY']);
    await act(async () => {
      screen.getByTestId('selectCtxB').click();
    });
    // Wait for the context switch to complete and state to update
    await waitFor(() => {
      const st = parseState();
      expect(st.selectedContext).toBe('ctxB');
      expect(st.selectedNamespaces).toEqual(['nsX']);
    }, { timeout: 3000 });
    expect(showSuccess).toHaveBeenCalledWith("Context switched to 'ctxB'.");
  });

  it('selectNamespaces warns on empty selection', async () => {
    await initStandard();
    await act(async () => { screen.getByTestId('selectEmpty').click(); });
    expect(showWarning).toHaveBeenCalledWith('At least one namespace must be selected.');
  });
});
