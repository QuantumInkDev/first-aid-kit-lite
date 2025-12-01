import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockElectronAPI } from '../setup';

describe('Electron API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('System Info', () => {
    it('should retrieve system information', async () => {
      const systemInfo = await window.electronAPI.getSystemInfo();

      expect(systemInfo).toBeDefined();
      expect(systemInfo.platform).toBe('win32');
      expect(systemInfo.arch).toBe('x64');
      expect(systemInfo.isElevated).toBe(false);
    });
  });

  describe('Script Management', () => {
    it('should retrieve available scripts', async () => {
      const scripts = await window.electronAPI.getAvailableScripts();

      expect(scripts).toBeInstanceOf(Array);
      expect(scripts.length).toBeGreaterThan(0);
      expect(scripts[0]).toHaveProperty('id');
      expect(scripts[0]).toHaveProperty('name');
      expect(scripts[0]).toHaveProperty('category');
    });

    it('should have scripts with required properties', async () => {
      const scripts = await window.electronAPI.getAvailableScripts();

      scripts.forEach((script) => {
        expect(script).toHaveProperty('id');
        expect(script).toHaveProperty('name');
        expect(script).toHaveProperty('description');
        expect(script).toHaveProperty('riskLevel');
        expect(script).toHaveProperty('estimatedDuration');
        expect(script).toHaveProperty('category');
        expect(['low', 'medium', 'high']).toContain(script.riskLevel);
      });
    });
  });

  describe('Script Execution', () => {
    it('should execute a script successfully', async () => {
      const result = await window.electronAPI.executeScript('clear-temp');

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('duration');
    });

    it('should execute script with parameters', async () => {
      const params = { path: 'C:/temp' };
      const result = await window.electronAPI.executeScript('clear-temp', params);

      expect(mockElectronAPI.executeScript).toHaveBeenCalledWith('clear-temp', params);
      expect(result.success).toBe(true);
    });

    it('should be able to cancel script execution', async () => {
      const cancelled = await window.electronAPI.cancelScriptExecution('test-execution-id');

      expect(cancelled).toBe(true);
      expect(mockElectronAPI.cancelScriptExecution).toHaveBeenCalledWith('test-execution-id');
    });
  });

  describe('Settings Management', () => {
    it('should retrieve application settings', async () => {
      const settings = await window.electronAPI.getSettings();

      expect(settings).toBeDefined();
      expect(settings).toHaveProperty('confirmationRequired');
      expect(settings).toHaveProperty('notificationLevel');
      expect(settings).toHaveProperty('theme');
      expect(settings).toHaveProperty('maxConcurrentExecutions');
      expect(settings).toHaveProperty('scriptTimeout');
    });

    it('should update settings', async () => {
      const newSettings = { theme: 'dark' as const };
      await window.electronAPI.updateSettings(newSettings);

      expect(mockElectronAPI.updateSettings).toHaveBeenCalledWith(newSettings);
    });
  });

  describe('Notifications', () => {
    it('should show notifications', async () => {
      await window.electronAPI.showNotification('success', 'Test message');

      expect(mockElectronAPI.showNotification).toHaveBeenCalledWith(
        'success',
        'Test message'
      );
    });

    it('should show notifications with options', async () => {
      const options = { duration: 5000, persistent: true };
      await window.electronAPI.showNotification('info', 'Test message', options);

      expect(mockElectronAPI.showNotification).toHaveBeenCalledWith(
        'info',
        'Test message',
        options
      );
    });
  });

  describe('Session Management', () => {
    it('should save session state', async () => {
      const sessionState = {
        windowBounds: { x: 100, y: 100, width: 800, height: 600 },
        isMaximized: false,
        pendingExecutions: [],
        unsavedSettings: {},
        sessionTimestamp: Date.now(),
      };

      await window.electronAPI.saveSessionState(sessionState);

      expect(mockElectronAPI.saveSessionState).toHaveBeenCalledWith(sessionState);
    });

    it('should restore session state', async () => {
      const state = await window.electronAPI.restoreSessionState();

      expect(mockElectronAPI.restoreSessionState).toHaveBeenCalled();
    });

    it('should request session end', async () => {
      const canEnd = await window.electronAPI.requestSessionEnd();

      expect(canEnd).toBe(true);
      expect(mockElectronAPI.requestSessionEnd).toHaveBeenCalled();
    });
  });

  describe('Event Listeners', () => {
    it('should register protocol request listener', () => {
      const callback = vi.fn();
      window.electronAPI.onProtocolRequest(callback);

      expect(mockElectronAPI.onProtocolRequest).toHaveBeenCalledWith(callback);
    });

    it('should remove protocol listener', () => {
      window.electronAPI.removeProtocolListener();

      expect(mockElectronAPI.removeProtocolListener).toHaveBeenCalled();
    });

    it('should register script execution update listener', () => {
      const callback = vi.fn();
      window.electronAPI.onScriptExecutionUpdate(callback);

      expect(mockElectronAPI.onScriptExecutionUpdate).toHaveBeenCalledWith(callback);
    });

    it('should register navigation listener', () => {
      const callback = vi.fn();
      window.electronAPI.onNavigate(callback);

      expect(mockElectronAPI.onNavigate).toHaveBeenCalledWith(callback);
    });
  });

  describe('Execution Logs', () => {
    it('should retrieve execution logs', async () => {
      const logs = await window.electronAPI.getExecutionLogs();

      expect(logs).toBeInstanceOf(Array);
      expect(mockElectronAPI.getExecutionLogs).toHaveBeenCalled();
    });

    it('should retrieve logs with filters', async () => {
      const filters = { status: ['success'] };
      await window.electronAPI.getExecutionLogs(filters);

      expect(mockElectronAPI.getExecutionLogs).toHaveBeenCalledWith(filters);
    });

    it('should export logs', async () => {
      await window.electronAPI.exportLogs('json');

      expect(mockElectronAPI.exportLogs).toHaveBeenCalledWith('json');
    });
  });
});
