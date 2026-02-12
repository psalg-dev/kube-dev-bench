import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistNamespaces } from '../utils/persistence';

// Mock kubeApi SetCurrentNamespace
vi.mock('../k8s/resources/kubeApi', () => ({
  SetCurrentNamespace: vi.fn(() => Promise.resolve()),
}));

const { SetCurrentNamespace } = await import('../k8s/resources/kubeApi');
const setCurrentNamespaceMock = SetCurrentNamespace as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // Provide window.go preferred function mock
  const windowObj = window as typeof window & {
    go?: { main?: { App?: { SetPreferredNamespaces?: (_names: string[]) => Promise<void> } } };
  };
  windowObj.go = {
    main: {
      App: { SetPreferredNamespaces: vi.fn(() => Promise.resolve()) },
    },
  } as unknown as Window['go'];
});

describe('persistNamespaces', () => {
  it('calls both preferred and current namespace setters', async () => {
    const windowObj = window as typeof window & {
      go?: { main?: { App?: { SetPreferredNamespaces?: (_names: string[]) => Promise<void> } } };
    };
    await persistNamespaces(['ns1', 'ns2'], 'ns1');
    expect(windowObj.go?.main?.App?.SetPreferredNamespaces).toHaveBeenCalledWith(['ns1', 'ns2']);
    expect(setCurrentNamespaceMock).toHaveBeenCalledWith('ns1');
  });

  it('handles missing preferred function gracefully', async () => {
    const windowObj = window as typeof window & {
      go?: { main?: { App?: { SetPreferredNamespaces?: (_names: string[]) => Promise<void> } } };
    };
    if (windowObj.go?.main?.App) {
      delete windowObj.go.main.App.SetPreferredNamespaces;
    }
    await persistNamespaces(['ns1'], 'ns1');
    expect(setCurrentNamespaceMock).toHaveBeenCalledWith('ns1');
  });

  it('swallows internal errors', async () => {
    const windowObj = window as typeof window & {
      go?: { main?: { App?: { SetPreferredNamespaces?: (_names: string[]) => Promise<void> } } };
    };
    if (windowObj.go?.main?.App) {
      windowObj.go.main.App.SetPreferredNamespaces = vi.fn(() => Promise.reject(new Error('fail')));
    }
    setCurrentNamespaceMock.mockImplementationOnce(() => Promise.reject(new Error('fail2')));
    await expect(persistNamespaces(['ns1'], 'ns1')).resolves.toBeUndefined();
  });

  it('skips current namespace when empty', async () => {
    await persistNamespaces(['ns1'], '');
    expect(setCurrentNamespaceMock).not.toHaveBeenCalled();
  });
});
