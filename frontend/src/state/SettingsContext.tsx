import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * Default application settings.
 */
const defaultSettings = {
  // Polling intervals (milliseconds)
  fastPollingInterval: 1000,      // For newly created resources
  slowPollingInterval: 60000,     // For stable resources after first minute
  normalRefreshInterval: 5000,    // Standard refresh rate

  // UI preferences
  showTimestampsRelative: true,   // Show "2 minutes ago" vs "2024-01-15 10:30:00"
  tableRowsPerPage: 50,           // Default rows per page in tables
  animationsEnabled: true,        // Enable/disable UI animations

  // Logging
  verboseLogging: false,          // Enable verbose console logging

  // Theme (for future use)
  theme: 'system',                // 'light', 'dark', 'system'
};

type Settings = typeof defaultSettings;

const STORAGE_KEY = 'kubedevbench_settings';

type SettingsContextValue = {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  resetSettings: () => void;
  defaultSettings: Settings;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Load settings from localStorage.
 * @returns {Object} Merged settings (defaults + stored)
 */
function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Settings>;
      return { ...defaultSettings, ...parsed };
    }
  } catch {
    // Ignore parse errors, return defaults
  }
  return { ...defaultSettings };
}

/**
 * Save settings to localStorage.
 * @param {Object} settings - Settings to save
 */
function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

/**
 * SettingsProvider component.
 * Provides application-wide settings context.
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(loadSettings);

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettingsState((prev) => {
      const next = { ...prev, [key]: value } as Settings;
      saveSettings(next);
      return next;
    });
  }, []);

  // Update multiple settings at once
  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...updates } as Settings;
      saveSettings(next);
      return next;
    });
  }, []);

  // Reset all settings to defaults
  const resetSettings = useCallback(() => {
    setSettingsState({ ...defaultSettings });
    saveSettings(defaultSettings);
  }, []);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setSettingsState(loadSettings());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value: SettingsContextValue = {
    settings,
    updateSetting,
    updateSettings,
    resetSettings,
    defaultSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Hook to access settings context.
 * @returns {{ settings: Object, updateSetting: Function, updateSettings: Function, resetSettings: Function }}
 */
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

/**
 * Hook to get a specific setting value with a fallback to default.
 * Useful when settings context might not be available.
 * @param {string} key - Setting key
 * @returns {*} The setting value
 */
export function useSetting<K extends keyof Settings>(key: K) {
  const context = useContext(SettingsContext);
  if (context) {
    return context.settings[key] ?? defaultSettings[key];
  }
  return defaultSettings[key];
}

export { defaultSettings };
export default SettingsContext;