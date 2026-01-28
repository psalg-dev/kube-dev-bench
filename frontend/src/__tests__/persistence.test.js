import { describe, it, expect, vi, beforeEach } from 'vitest';
import { persistNamespaces } from '../utils/persistence.js';

// Mock kubeApi SetCurrentNamespace
vi.mock('../k8s/resources/kubeApi', () => ({
  SetCurrentNamespace: vi.fn(() => Promise.resolve()),
}));

const { SetCurrentNamespace } = await import('../k8s/resources/kubeApi');

beforeEach(() => {
  vi.clearAllMocks();
  // Provide window.go preferred function mock
  global.window = global.window || {};
  window.go = {
    main: { App: { SetPreferredNamespaces: vi.fn(() => Promise.resolve()) } },
  };
});

describe('persistNamespaces', () => {
  it('calls both preferred and current namespace setters', async () => {
    await persistNamespaces(['ns1', 'ns2'], 'ns1');
    expect(window.go.main.App.SetPreferredNamespaces).toHaveBeenCalledWith([
      'ns1',
      'ns2',
    ]);
    expect(SetCurrentNamespace).toHaveBeenCalledWith('ns1');
  });

  it('handles missing preferred function gracefully', async () => {
    delete window.go.main.App.SetPreferredNamespaces;
    await persistNamespaces(['ns1'], 'ns1');
    expect(SetCurrentNamespace).toHaveBeenCalledWith('ns1');
  });

  it('swallows internal errors', async () => {
    window.go.main.App.SetPreferredNamespaces = vi.fn(() =>
      Promise.reject(new Error('fail')),
    );
    SetCurrentNamespace.mockImplementationOnce(() =>
      Promise.reject(new Error('fail2')),
    );
    await expect(persistNamespaces(['ns1'], 'ns1')).resolves.toBeUndefined();
  });

  it('skips current namespace when empty', async () => {
    await persistNamespaces(['ns1'], '');
    expect(SetCurrentNamespace).not.toHaveBeenCalled();
  });
});
