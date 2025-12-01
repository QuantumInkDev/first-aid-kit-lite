import React, { createContext, useContext, ReactNode } from 'react';

// Simplified settings - all hardcoded values
export interface AppSettings {
  // Fixed settings
  theme: 'light';
  enableNotifications: true;
  autoDiscoverScripts: true;
  maxConcurrentExecutions: 3;

  // Other operational defaults
  requireConfirmation: true;
  enableAuditLogging: true;
  executionTimeout: 300; // 5 minutes
  showScriptOutput: true;
}

// Hardcoded settings - no user configuration
const FIXED_SETTINGS: AppSettings = {
  theme: 'light',
  enableNotifications: true,
  autoDiscoverScripts: true,
  maxConcurrentExecutions: 3,
  requireConfirmation: true,
  enableAuditLogging: true,
  executionTimeout: 300,
  showScriptOutput: true,
};

interface SettingsContextType {
  settings: AppSettings;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Return fixed settings - no state management needed
  return (
    <SettingsContext.Provider value={{ settings: FIXED_SETTINGS }}>
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
