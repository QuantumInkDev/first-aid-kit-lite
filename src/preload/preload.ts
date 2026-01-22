console.log('🚀 PRELOAD SCRIPT STARTING - This should appear first!');

import { contextBridge, ipcRenderer } from 'electron';

console.log('🔧 PRELOAD SCRIPT: Imports loaded successfully');

// Protocol request from browser links
export interface ProtocolRequest {
  command: string;
  scriptId: string;
  parameters: Record<string, string>;
  rawUrl: string;
}

// Define the API that will be available in the renderer process
export interface ElectronAPI {
  // System information
  getSystemInfo: () => Promise<SystemInfo>;
  getDashboardInfo: () => Promise<DashboardInfo>;
  getRealtimeMetrics: () => Promise<RealtimeMetrics>;

  // Script execution
  executeScript: (scriptId: string, parameters?: Record<string, any>) => Promise<ExecutionResult>;
  cancelScriptExecution: (executionId: string) => Promise<boolean>;

  // Script management
  getAvailableScripts: () => Promise<ScriptDefinition[]>;
  getScriptDetails: (scriptId: string) => Promise<ScriptDefinition | null>;

  // Execution logs
  getExecutionLogs: (filters?: LogFilters) => Promise<ExecutionLog[]>;
  getExecutionStats: () => Promise<ExecutionStats>;
  clearExecutionLogs: () => Promise<{ success: boolean; cleared: number }>;
  exportLogs: (format: 'json' | 'csv', filters?: LogFilters) => Promise<string>;

  // Data management
  clearAllData: () => Promise<{ success: boolean; message: string }>;

  // Settings management
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;

  // Notifications
  showNotification: (type: NotificationType, message: string, options?: NotificationOptions) => Promise<void>;

  // Protocol handling
  onProtocolRequest: (callback: (request: ProtocolRequest) => void) => void;
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

  // Navigation (from tray menu)
  onNavigate: (callback: (path: string) => void) => void;
  removeNavigateListener: () => void;

  // Favorites
  getFavorites: () => Promise<string[]>;
  toggleFavorite: (scriptId: string) => Promise<{ success: boolean; isFavorite: boolean; favorites: string[] }>;
}

// Type definitions (these will be moved to shared types later)
interface SystemInfo {
  platform: string;
  version: string;
  arch: string;
  powershellVersion: string;
  isElevated: boolean;
}

// Dashboard types
interface DriveSpace {
  drive: string;
  total: number;
  used: number;
  available: number;
  percentUsed: number;
}

interface UptimeInfo {
  seconds: number;
  bootTime: string;
  formatted: string;
}

interface UserInfo {
  displayName: string;
  firstName: string;
  employeeId: string;
  samAccountName: string;
  email: string;
  source: 'active-directory' | 'cached' | 'unavailable';
  cachedAt?: number;
  passwordExpiration: {
    expiresAt: string | null;
    daysUntilExpiration: number | null;
    isExpired: boolean;
  } | null;
}

interface NetworkInfo {
  type: 'Ethernet' | 'WiFi' | 'Unknown' | 'Disconnected';
  ipAddress: string;
  adapterName: string;
}

interface BitLockerInfo {
  status: 'Encrypted' | 'Decrypted' | 'Encrypting' | 'Decrypting' | 'Unknown' | 'Error';
  protectionStatus: 'On' | 'Off' | 'Unknown';
  encryptionPercentage?: number;
}

interface DashboardInfo {
  driveSpace: DriveSpace | null;
  uptime: UptimeInfo;
  userInfo: UserInfo;
  lastSeen: string | null;
  assetSerial: string;
  osVersion: string;
  osBuild: string;
  network: NetworkInfo;
  bitLocker: BitLockerInfo;
  timestamp: number;
  refreshedAt: string;
}

interface RealtimeMetrics {
  ram: {
    total: number;
    used: number;
    free: number;
    percentUsed: number;
  };
  cpu: {
    percentUsed: number;
    cores: number;
    model: string;
    speed: number;
  };
  timestamp: number;
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
  order?: number;
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

interface ExecutionStats {
  total: number;
  successful: number;
  failed: number;
  available: boolean;
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
  GET_DASHBOARD_INFO: 'system:get-dashboard-info',
  GET_REALTIME_METRICS: 'system:get-realtime-metrics',

  // Script execution
  EXECUTE_SCRIPT: 'script:execute',
  CANCEL_EXECUTION: 'script:cancel',
  SCRIPT_EXECUTION_UPDATE: 'script:execution:update',
  
  // Script management
  GET_SCRIPTS: 'script:get-all',
  GET_SCRIPT_DETAILS: 'script:get-details',
  
  // Logging
  GET_LOGS: 'log:get',
  GET_STATS: 'log:stats',
  CLEAR_LOGS: 'log:clear',
  EXPORT_LOGS: 'log:export',

  // Data management
  CLEAR_ALL_DATA: 'data:clear-all',
  
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

  // Navigation
  NAVIGATE: 'navigate',

  // Favorites
  GET_FAVORITES: 'favorites:get',
  TOGGLE_FAVORITE: 'favorites:toggle',

  // Debug logging (main process -> renderer)
  DEBUG_MAIN_PROCESS_LOG: 'debug:main-process-log',
} as const;

// Create the API implementation
const electronAPI: ElectronAPI = {
  // System information
  getSystemInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SYSTEM_INFO),
  getDashboardInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DASHBOARD_INFO),
  getRealtimeMetrics: () => ipcRenderer.invoke(IPC_CHANNELS.GET_REALTIME_METRICS),

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

  getExecutionStats: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_STATS),

  clearExecutionLogs: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_LOGS),

  exportLogs: (format: 'json' | 'csv', filters?: LogFilters) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_LOGS, { format, filters }),

  // Data management
  clearAllData: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_ALL_DATA),

  // Settings management
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  
  updateSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, settings),
  
  // Notifications
  showNotification: (type: NotificationType, message: string, options?: NotificationOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_NOTIFICATION, { type, message, options }),
  
  // Protocol handling
  onProtocolRequest: (callback: (request: ProtocolRequest) => void) => {
    ipcRenderer.on(IPC_CHANNELS.PROTOCOL_REQUEST, (_event, request: ProtocolRequest) => callback(request));
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

  // Navigation (from tray menu)
  onNavigate: (callback: (path: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.NAVIGATE, (_event, path: string) => callback(path));
  },

  removeNavigateListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.NAVIGATE);
  },

  // Favorites
  getFavorites: () => ipcRenderer.invoke(IPC_CHANNELS.GET_FAVORITES),

  toggleFavorite: (scriptId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_FAVORITE, { scriptId }),
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
  console.log('First Aid Kit renderer process ready');
});

// =============================================================================
// DEBUG LOGGING - Listen for main process logs and display in DevTools console
// =============================================================================
ipcRenderer.on(IPC_CHANNELS.DEBUG_MAIN_PROCESS_LOG, (_event, logEntry: {
  timestamp: string;
  category: string;
  message: string;
  data?: any;
  source: string;
}) => {
  const style = {
    'PROTOCOL': 'color: #00ff00; font-weight: bold;',
    'EXECUTE': 'color: #ff9900; font-weight: bold;',
    'POWERSHELL': 'color: #00ccff; font-weight: bold;',
    'ERROR': 'color: #ff0000; font-weight: bold;',
  }[logEntry.category] || 'color: #888888;';

  console.log(
    `%c[MAIN][${logEntry.timestamp}][${logEntry.category}] ${logEntry.message}`,
    style
  );
  if (logEntry.data) {
    console.log('%c  └─ Data:', 'color: #666666;', logEntry.data);
  }
});

// Export types for use in renderer process
export type {
  SystemInfo,
  ScriptDefinition,
  ScriptParameter,
  ExecutionResult,
  ExecutionLog,
  LogFilters,
  ExecutionStats,
  AppSettings,
  NotificationType,
  NotificationOptions,
  ExecutionUpdate,
  SessionState,
  // Dashboard types
  DriveSpace,
  UptimeInfo,
  UserInfo,
  NetworkInfo,
  BitLockerInfo,
  DashboardInfo,
  RealtimeMetrics,
};