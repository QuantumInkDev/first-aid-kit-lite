import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.electronAPI for renderer tests
const mockElectronAPI = {
  getSystemInfo: vi.fn().mockResolvedValue({
    platform: 'win32',
    version: '10.0.22631',
    arch: 'x64',
    powershellVersion: '5.1',
    isElevated: false,
  }),
  executeScript: vi.fn().mockResolvedValue({
    id: 'test-execution-id',
    success: true,
    output: 'Script executed successfully',
    duration: 1000,
    exitCode: 0,
  }),
  cancelScriptExecution: vi.fn().mockResolvedValue(true),
  getAvailableScripts: vi.fn().mockResolvedValue([
    {
      id: 'clear-temp',
      name: 'Clear Temporary Files',
      description: 'Removes temporary files from the system',
      riskLevel: 'low',
      estimatedDuration: 5000,
      requiredPermissions: [],
      category: 'Cleanup',
    },
    {
      id: 'flush-dns',
      name: 'Flush DNS Cache',
      description: 'Clears the DNS resolver cache',
      riskLevel: 'low',
      estimatedDuration: 2000,
      requiredPermissions: [],
      category: 'Network',
    },
  ]),
  getScriptDetails: vi.fn().mockResolvedValue(null),
  getExecutionLogs: vi.fn().mockResolvedValue([]),
  exportLogs: vi.fn().mockResolvedValue(''),
  getSettings: vi.fn().mockResolvedValue({
    confirmationRequired: true,
    notificationLevel: 'all',
    logRetentionDays: 30,
    theme: 'system',
    maxConcurrentExecutions: 3,
    scriptTimeout: 300000,
    enableDetailedLogging: true,
  }),
  updateSettings: vi.fn().mockResolvedValue(undefined),
  showNotification: vi.fn().mockResolvedValue(undefined),
  onProtocolRequest: vi.fn(),
  removeProtocolListener: vi.fn(),
  onScriptExecutionUpdate: vi.fn(),
  removeScriptExecutionListener: vi.fn(),
  onSettingsChanged: vi.fn(),
  removeSettingsListener: vi.fn(),
  requestSessionEnd: vi.fn().mockResolvedValue(true),
  saveSessionState: vi.fn().mockResolvedValue(undefined),
  restoreSessionState: vi.fn().mockResolvedValue(null),
  onBeforeQuit: vi.fn(),
  removeBeforeQuitListener: vi.fn(),
  onNavigate: vi.fn(),
  removeNavigateListener: vi.fn(),
};

// Assign to window
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Export for use in tests
export { mockElectronAPI };
