import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SettingsProvider, useSettings, useSetting, defaultSettings } from '../state/SettingsContext.jsx';

// Helper component to test useSettings hook
function SettingsConsumer({ onSettings }) {
  const settings = useSettings();
  onSettings?.(settings);
  return (
    <div>
      <span data-testid="fast-polling">{settings.settings.fastPollingInterval}</span>
      <span data-testid="slow-polling">{settings.settings.slowPollingInterval}</span>
      <span data-testid="theme">{settings.settings.theme}</span>
      <button onClick={() => settings.updateSetting('theme', 'dark')}>Set Dark</button>
      <button onClick={() => settings.updateSettings({ theme: 'light', animationsEnabled: false })}>Set Light</button>
      <button onClick={() => settings.resetSettings()}>Reset</button>
    </div>
  );
}

// Helper component to test useSetting hook
function SingleSettingConsumer({ settingKey }) {
  const value = useSetting(settingKey);
  return <span data-testid="setting-value">{String(value)}</span>;
}

describe('SettingsContext', () => {
  const localStorageMock = {
    store: {},
    getItem: vi.fn((key) => localStorageMock.store[key] || null),
    setItem: vi.fn((key, value) => {
      localStorageMock.store[key] = value;
    }),
    removeItem: vi.fn((key) => {
      delete localStorageMock.store[key];
    }),
    clear: vi.fn(() => {
      localStorageMock.store = {};
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.store = {};
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SettingsProvider', () => {
    it('provides default settings when no stored settings', () => {
      render(
        <SettingsProvider>
          <SettingsConsumer />
        </SettingsProvider>
      );

      expect(screen.getByTestId('fast-polling')).toHaveTextContent('1000');
      expect(screen.getByTestId('slow-polling')).toHaveTextContent('60000');
      expect(screen.getByTestId('theme')).toHaveTextContent('system');
    });

    it('loads stored settings from localStorage', () => {
      localStorageMock.store['kubedevbench_settings'] = JSON.stringify({
        theme: 'dark',
        fastPollingInterval: 2000,
      });

      render(
        <SettingsProvider>
          <SettingsConsumer />
        </SettingsProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('fast-polling')).toHaveTextContent('2000');
      // Non-stored values should still have defaults
      expect(screen.getByTestId('slow-polling')).toHaveTextContent('60000');
    });

    it('handles invalid JSON in localStorage gracefully', () => {
      localStorageMock.store['kubedevbench_settings'] = 'invalid json';

      render(
        <SettingsProvider>
          <SettingsConsumer />
        </SettingsProvider>
      );

      // Should fall back to defaults
      expect(screen.getByTestId('theme')).toHaveTextContent('system');
    });
  });

  describe('updateSetting', () => {
    it('updates a single setting', () => {
      render(
        <SettingsProvider>
          <SettingsConsumer />
        </SettingsProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('system');

      act(() => {
        screen.getByText('Set Dark').click();
      });

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    it('persists setting to localStorage', () => {
      render(
        <SettingsProvider>
          <SettingsConsumer />
        </SettingsProvider>
      );

      act(() => {
        screen.getByText('Set Dark').click();
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const savedSettings = JSON.parse(localStorageMock.store['kubedevbench_settings']);
      expect(savedSettings.theme).toBe('dark');
    });
  });

  describe('updateSettings', () => {
    it('updates multiple settings at once', () => {
      let settingsRef;
      render(
        <SettingsProvider>
          <SettingsConsumer onSettings={(s) => { settingsRef = s; }} />
        </SettingsProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('system');

      act(() => {
        screen.getByText('Set Light').click();
      });

      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(settingsRef.settings.animationsEnabled).toBe(false);
    });
  });

  describe('resetSettings', () => {
    it('resets all settings to defaults', () => {
      localStorageMock.store['kubedevbench_settings'] = JSON.stringify({
        theme: 'dark',
        fastPollingInterval: 5000,
      });

      render(
        <SettingsProvider>
          <SettingsConsumer />
        </SettingsProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');

      act(() => {
        screen.getByText('Reset').click();
      });

      expect(screen.getByTestId('theme')).toHaveTextContent('system');
      expect(screen.getByTestId('fast-polling')).toHaveTextContent('1000');
    });

    it('persists reset to localStorage', () => {
      localStorageMock.store['kubedevbench_settings'] = JSON.stringify({
        theme: 'dark',
      });

      render(
        <SettingsProvider>
          <SettingsConsumer />
        </SettingsProvider>
      );

      act(() => {
        screen.getByText('Reset').click();
      });

      const savedSettings = JSON.parse(localStorageMock.store['kubedevbench_settings']);
      expect(savedSettings.theme).toBe('system');
    });
  });

  describe('useSettings hook', () => {
    it('throws error when used outside provider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<SettingsConsumer />);
      }).toThrow('useSettings must be used within a SettingsProvider');

      consoleError.mockRestore();
    });

    it('provides settings and methods', () => {
      let settingsRef;
      render(
        <SettingsProvider>
          <SettingsConsumer onSettings={(s) => { settingsRef = s; }} />
        </SettingsProvider>
      );

      expect(settingsRef.settings).toBeDefined();
      expect(typeof settingsRef.updateSetting).toBe('function');
      expect(typeof settingsRef.updateSettings).toBe('function');
      expect(typeof settingsRef.resetSettings).toBe('function');
      expect(settingsRef.defaultSettings).toBeDefined();
    });
  });

  describe('useSetting hook', () => {
    it('returns setting value when inside provider', () => {
      render(
        <SettingsProvider>
          <SingleSettingConsumer settingKey="theme" />
        </SettingsProvider>
      );

      expect(screen.getByTestId('setting-value')).toHaveTextContent('system');
    });

    it('returns default value when outside provider', () => {
      render(<SingleSettingConsumer settingKey="theme" />);

      expect(screen.getByTestId('setting-value')).toHaveTextContent('system');
    });

    it('returns default for unknown setting', () => {
      render(
        <SettingsProvider>
          <SingleSettingConsumer settingKey="unknownKey" />
        </SettingsProvider>
      );

      expect(screen.getByTestId('setting-value')).toHaveTextContent('undefined');
    });
  });

  describe('defaultSettings export', () => {
    it('contains expected default values', () => {
      expect(defaultSettings.fastPollingInterval).toBe(1000);
      expect(defaultSettings.slowPollingInterval).toBe(60000);
      expect(defaultSettings.normalRefreshInterval).toBe(5000);
      expect(defaultSettings.showTimestampsRelative).toBe(true);
      expect(defaultSettings.tableRowsPerPage).toBe(50);
      expect(defaultSettings.animationsEnabled).toBe(true);
      expect(defaultSettings.verboseLogging).toBe(false);
      expect(defaultSettings.theme).toBe('system');
    });
  });

  describe('storage event listener', () => {
    it('updates settings when storage changes in another tab', async () => {
      render(
        <SettingsProvider>
          <SettingsConsumer />
        </SettingsProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('system');

      // Simulate storage change from another tab
      localStorageMock.store['kubedevbench_settings'] = JSON.stringify({
        theme: 'dark',
      });

      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'kubedevbench_settings',
          newValue: JSON.stringify({ theme: 'dark' }),
        }));
      });

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    it('ignores storage events for other keys', () => {
      render(
        <SettingsProvider>
          <SettingsConsumer />
        </SettingsProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('system');

      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'other_key',
          newValue: JSON.stringify({ theme: 'dark' }),
        }));
      });

      // Should remain unchanged
      expect(screen.getByTestId('theme')).toHaveTextContent('system');
    });
  });
});
