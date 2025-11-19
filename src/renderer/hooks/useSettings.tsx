import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface AppSettings {
  // General Settings
  theme: 'light' | 'dark' | 'system';
  enableNotifications: boolean;
  enableAutoUpdate: boolean;
  minimizeToTray: boolean;
  startMinimized: boolean;

  // Security Settings
  requireConfirmation: boolean;
  showRiskWarnings: boolean;
  blockHighRiskScripts: boolean;
  enableAuditLogging: boolean;
  executionTimeout: number; // in seconds

  // Script Management
  autoDiscoverScripts: boolean;
  validateScriptsOnStartup: boolean;
  maxConcurrentExecutions: number;
  showScriptOutput: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  // General Settings
  theme: 'system',
  enableNotifications: true,
  enableAutoUpdate: true,
  minimizeToTray: false,
  startMinimized: false,

  // Security Settings
  requireConfirmation: true,
  showRiskWarnings: true,
  blockHighRiskScripts: false,
  enableAuditLogging: true,
  executionTimeout: 300, // 5 minutes

  // Script Management
  autoDiscoverScripts: true,
  validateScriptsOnStartup: true,
  maxConcurrentExecutions: 3,
  showScriptOutput: true,
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'first-aid-kit-settings';

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Load settings from localStorage on mount
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
    }
    return DEFAULT_SETTINGS;
  });

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
