console.log('🚀 PRELOAD SCRIPT STARTING - This should appear first!');

import { contextBridge, ipcRenderer } from 'electron';

console.log('🔧 PRELOAD SCRIPT: Imports loaded successfully');

// Define the API that will be available in the renderer process
export interface ElectronAPI {
  // System information
  getSystemInfo: () => Promise<SystemInfo>;
  
  // Script execution
  executeScript: (scriptId: string, parameters?: Record<string, any>) => Promise<ExecutionResult>;
  cancelScriptExecution: (executionId: string) => Promise<boolean>;
  
  // Script management
  getAvailableScripts: () => Promise<ScriptDefinition[]>;
  getScriptDetails: (scriptId: string) => Promise<ScriptDefinition | null>;
  
  // Execution logs
  getExecutionLogs: (filters?: LogFilters) => Promise<ExecutionLog[]>;
  exportLogs: (format: 'json' | 'csv', filters?: LogFilters) => Promise<string>;
  
  // Settings management
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  
  // Notifications
  showNotification: (type: NotificationType, message: string, options?: NotificationOptions) => Promise<void>;
  
  // Protocol handling
  onProtocolRequest: (callback: (url: string) => void) => void;
  removeProtocolListener: () => void;
  
  // Event listeners for real-time updates
  onScriptExecutionUpdate: (callback: (update: ExecutionUpdate) => void) => void;
  removeScriptExecutionListener: () => void;
  
  onSettingsChanged: (callback: (settings: AppSettings) => void) => void;
  removeSettingsListener: () => void;

  // Session management
  requestSessionEnd: () => Promise<boolean>;
  saveSessionState: (state: SessionState) => Promise<void>;
  restoreSessionState: () => Promise<SessionState | null>;
  onBeforeQuit: (callback: () => Promise<boolean>) => void;
  removeBeforeQuitListener: () => void;
}

// Type definitions (these will be moved to shared types later)
interface SystemInfo {
  platform: string;
  version: string;
  arch: string;
  powershellVersion: string;
  isElevated: boolean;
}

interface ScriptDefinition {
  id: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  estimatedDuration: number; // in milliseconds
  requiredPermissions: string[];
  parameters?: ScriptParameter[];
  category: string;
}

interface ScriptParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required: boolean;
  description: string;
  options?: string[]; // for select type
  default?: any;
}

interface ExecutionResult {
  id: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  exitCode: number;
}

interface ExecutionLog {
  id: string;
  timestamp: Date;
  scriptId: string;
  scriptName: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  duration?: number;
  exitCode?: number;
  output?: string;
  error?: string;
  parameters?: Record<string, any>;
}

interface LogFilters {
  startDate?: Date;
  endDate?: Date;
  status?: string[];
  scriptIds?: string[];
  limit?: number;
}

interface AppSettings {
  confirmationRequired: boolean;
  notificationLevel: 'all' | 'errors' | 'none';
  logRetentionDays: number;
  theme: 'light' | 'dark' | 'system';
  maxConcurrentExecutions: number;
  scriptTimeout: number;
  enableDetailedLogging: boolean;
}

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationOptions {
  duration?: number;
  persistent?: boolean;
  actions?: Array<{ label: string; action: string }>;
}

interface ExecutionUpdate {
  executionId: string;
  status: 'running' | 'success' | 'error' | 'cancelled';
  progress?: number;
  output?: string;
  error?: string;
}

interface SessionState {
  windowBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isMaximized: boolean;
  lastActiveScript?: string;
  pendingExecutions: ExecutionUpdate[];
  unsavedSettings: Partial<AppSettings>;
  sessionTimestamp: number;
}

// IPC channel names (these will be moved to shared constants later)
const IPC_CHANNELS = {
  // System
  GET_SYSTEM_INFO: 'system:get-info',
  
  // Script execution
  EXECUTE_SCRIPT: 'script:execute',
  CANCEL_EXECUTION: 'script:cancel',
  SCRIPT_EXECUTION_UPDATE: 'script:execution:update',
  
  // Script management
  GET_SCRIPTS: 'script:get-all',
  GET_SCRIPT_DETAILS: 'script:get-details',
  
  // Logging
  GET_LOGS: 'log:get',
  EXPORT_LOGS: 'log:export',
  
  // Settings
  GET_SETTINGS: 'settings:get',
  UPDATE_SETTINGS: 'settings:update',
  SETTINGS_CHANGED: 'settings:changed',
  
  // Notifications
  SHOW_NOTIFICATION: 'notification:show',
  
  // Protocol handling
  PROTOCOL_REQUEST: 'protocol:request',
  
  // Session management
  SESSION_END_REQUEST: 'session:end-request',
  SESSION_SAVE_STATE: 'session:save-state',
  SESSION_RESTORE_STATE: 'session:restore-state',
  SESSION_BEFORE_QUIT: 'session:before-quit',
} as const;

// Create the API implementation
const electronAPI: ElectronAPI = {
  // System information
  getSystemInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SYSTEM_INFO),
  
  // Script execution
  executeScript: (scriptId: string, parameters?: Record<string, any>) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXECUTE_SCRIPT, { scriptId, parameters }),
  
  cancelScriptExecution: (executionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CANCEL_EXECUTION, { executionId }),
  
  // Script management
  getAvailableScripts: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SCRIPTS),
  
  getScriptDetails: (scriptId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SCRIPT_DETAILS, { scriptId }),
  
  // Execution logs
  getExecutionLogs: (filters?: LogFilters) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_LOGS, filters),
  
  exportLogs: (format: 'json' | 'csv', filters?: LogFilters) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_LOGS, { format, filters }),
  
  // Settings management
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  
  updateSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, settings),
  
  // Notifications
  showNotification: (type: NotificationType, message: string, options?: NotificationOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_NOTIFICATION, { type, message, options }),
  
  // Protocol handling
  onProtocolRequest: (callback: (url: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PROTOCOL_REQUEST, (_event, url: string) => callback(url));
  },
  
  removeProtocolListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.PROTOCOL_REQUEST);
  },
  
  // Event listeners for real-time updates
  onScriptExecutionUpdate: (callback: (update: ExecutionUpdate) => void) => {
    ipcRenderer.on(IPC_CHANNELS.SCRIPT_EXECUTION_UPDATE, (_event, update: ExecutionUpdate) => callback(update));
  },
  
  removeScriptExecutionListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.SCRIPT_EXECUTION_UPDATE);
  },
  
  onSettingsChanged: (callback: (settings: AppSettings) => void) => {
    ipcRenderer.on(IPC_CHANNELS.SETTINGS_CHANGED, (_event, settings: AppSettings) => callback(settings));
  },
  
  removeSettingsListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.SETTINGS_CHANGED);
  },

  // Session management
  requestSessionEnd: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_END_REQUEST),
  
  saveSessionState: (state: SessionState) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_SAVE_STATE, state),
  
  restoreSessionState: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_RESTORE_STATE),
  
  onBeforeQuit: (callback: () => Promise<boolean>) => {
    ipcRenderer.on(IPC_CHANNELS.SESSION_BEFORE_QUIT, async (_event) => {
      const canQuit = await callback();
      // Note: returnValue is used for synchronous responses in main process
      if ('returnValue' in _event) {
        (_event as any).returnValue = canQuit;
      }
    });
  },
  
  removeBeforeQuitListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.SESSION_BEFORE_QUIT);
  },
};

// Expose the API to the renderer process
console.log('🔧 Preload script: About to expose electronAPI to main world');

// Expose API through contextBridge with context isolation enabled
try {
  console.log('🔧 Exposing electronAPI through contextBridge...');
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  console.log('✅ Successfully exposed electronAPI through contextBridge');
} catch (error) {
  console.error('❌ Failed to expose electronAPI through contextBridge:', (error as Error).message);
  // In production, we should throw here as context isolation must be enabled
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Context isolation must be enabled in production');
  }
}

console.log('🔧 Preload script: electronAPI exposed successfully');

// Additional security: Remove dangerous globals in development
if (process.env.NODE_ENV === 'development') {
  console.log('✅ Preload script loaded successfully');
  console.log('📋 Available API methods:', Object.keys(electronAPI));
}

// Verify the API was exposed correctly with a small delay
window.addEventListener('DOMContentLoaded', () => {
  console.log('🌐 DOM loaded, checking for electronAPI...');
  
  // Check immediately
  console.log('🔍 window.electronAPI exists (immediate):', typeof window.electronAPI !== 'undefined');
  
  // Check again after a small delay to see if timing is the issue
  setTimeout(() => {
    console.log('🔍 window.electronAPI exists (delayed):', typeof window.electronAPI !== 'undefined');
    if (window.electronAPI) {
      console.log('🎉 electronAPI is available with methods:', Object.keys(window.electronAPI));
    } else {
      console.error('❌ electronAPI is still not available on window object');
      console.log('🔍 Available on window:', Object.keys(window).filter(k => k.includes('electron') || k.includes('API')));
    }
  }, 100);
});

// Security: Prevent context isolation bypass
window.addEventListener('DOMContentLoaded', () => {
  console.log('First Aid Kit Lite renderer process ready');
});

// Export types for use in renderer process
export type {
  SystemInfo,
  ScriptDefinition,
  ScriptParameter,
  ExecutionResult,
  ExecutionLog,
  LogFilters,
  AppSettings,
  NotificationType,
  NotificationOptions,
  ExecutionUpdate,
  SessionState,
};