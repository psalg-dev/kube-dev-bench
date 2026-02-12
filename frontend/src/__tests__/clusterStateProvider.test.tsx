import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../wailsjs/go/models';
import { ClusterStateProvider, useClusterState } from '../state/ClusterStateContext';

// ---- Mocks ----
// Notification mocks (must match import path in provider: '../notification')
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
}));

// Backend kube API mock (define inside factory to avoid hoisting reference issues)
vi.mock('../k8s/resources/kubeApi', () => ({
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
import * as kubeApi from '../k8s/resources/kubeApi';
import { showSuccess, showWarning } from '../notification';

const kubeApiMocks = vi.mocked(kubeApi);

const createAppConfig = (overrides: Partial<app.AppConfig> = {}): app.AppConfig => app.AppConfig.createFrom({
  currentContext: '',
  currentNamespace: '',
  preferredNamespaces: [],
  rememberContext: false,
  rememberNamespace: false,
  kubeConfigPath: '',
  proxyURL: '',
  proxyAuthType: '',
  proxyUsername: '',
  proxyPassword: '',
  holmesConfig: undefined,
  ...overrides,
});

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
  await act(async () => { render(<ClusterStateProvider><Probe /></ClusterStateProvider>); });
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
  kubeApiMocks.GetKubeContexts.mockReset();
  kubeApiMocks.GetNamespaces.mockReset();
  kubeApiMocks.GetCurrentConfig.mockReset();
  kubeApiMocks.SetCurrentKubeContext.mockReset();
  kubeApiMocks.SetCurrentNamespace.mockReset();
  kubeApiMocks.GetConnectionStatus.mockReset();
  kubeApiMocks.SetPreferredNamespaces.mockReset();
});

describe('ClusterStateProvider initialization', () => {
  it('shows wizard when no contexts', async () => {
    kubeApiMocks.GetKubeContexts.mockResolvedValueOnce([]);
    kubeApiMocks.GetCurrentConfig.mockResolvedValueOnce(createAppConfig({ currentContext: '' }));
    kubeApiMocks.GetNamespaces.mockResolvedValueOnce([]);
    await renderAndWait();
    const st = parseState();
    expect(st.showWizard).toBe(true);
    expect(st.initialized).toBe(true);
    expect(showSuccess).not.toHaveBeenCalled();
  });

  it('auto-selects first context when currentContext invalid', async () => {
    kubeApiMocks.GetCurrentConfig.mockResolvedValueOnce(createAppConfig({ currentContext: 'missing', preferredNamespaces: ['ns2'] }));
    kubeApiMocks.GetKubeContexts.mockResolvedValueOnce(['ctxA', 'ctxB']);
    kubeApiMocks.GetNamespaces.mockResolvedValueOnce(['ns1', 'ns2']);
    await renderAndWait();
    // Wait for the async initialization to complete and state to be set
    await waitFor(() => {
      const st = parseState();
      expect(st.selectedContext).toBe('ctxA');
      expect(st.selectedNamespaces).toEqual(['ns2']);
    }, { timeout: 3000 });
    expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining("Auto-selected context 'ctxA'"));
    expect(kubeApi.SetCurrentKubeContext).toHaveBeenCalledWith('ctxA');
    expect(kubeApi.SetCurrentNamespace).toHaveBeenCalledWith('ns2');
  });

  it('respects valid currentContext & preferred namespaces', async () => {
    kubeApiMocks.GetCurrentConfig.mockResolvedValueOnce(createAppConfig({ currentContext: 'ctx2', preferredNamespaces: ['ns2'] }));
    kubeApiMocks.GetKubeContexts.mockResolvedValueOnce(['ctx1', 'ctx2']);
    kubeApiMocks.GetNamespaces.mockResolvedValueOnce(['ns1', 'ns2']);
    await renderAndWait();
    const st = parseState();
    expect(st.selectedContext).toBe('ctx2');
    expect(st.selectedNamespaces).toEqual(['ns2']);
    expect(showSuccess).not.toHaveBeenCalledWith(expect.stringContaining('Auto-selected context'));
  });

  it('warns when namespaces list is empty', async () => {
    kubeApiMocks.GetCurrentConfig.mockResolvedValueOnce(createAppConfig({ currentContext: 'ctx1' }));
    kubeApiMocks.GetKubeContexts.mockResolvedValueOnce(['ctx1']);
    kubeApiMocks.GetNamespaces.mockResolvedValueOnce([]);
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
    kubeApiMocks.GetCurrentConfig.mockResolvedValueOnce(createAppConfig({ currentContext: 'ctxA' }));
    kubeApiMocks.GetKubeContexts.mockResolvedValueOnce(['ctxA', 'ctxB']);
    kubeApiMocks.GetNamespaces.mockResolvedValueOnce(['ns1', 'ns2']);
    await renderAndWait();
  }

  it('selectContext switches context & resets namespaces', async () => {
    await initStandard();
    // prepare GetNamespaces for second context switch
    kubeApiMocks.GetNamespaces.mockResolvedValueOnce(['nsX', 'nsY']);
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