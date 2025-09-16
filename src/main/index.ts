import { app, BrowserWindow, protocol } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Security: Register schemes as privileged before app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'first-aid-kit',
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: false,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: false,
      stream: false,
    },
  },
  {
    scheme: 'fak',
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: false,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: false,
      stream: false,
    },
  },
]);

// Development/production mode detection
const isDevelopment = process.env.NODE_ENV === 'development';

// Paths for Vite builds  
import { resolve } from 'path';
const preloadPath = resolve(__dirname, '../preload/preload.js');
const rendererUrl = isDevelopment 
  ? 'http://localhost:5173'
  : resolve(__dirname, '../renderer/index.html');

console.log('🔧 Main process: Preload path (resolve):', preloadPath);
console.log('🔧 Main process: __dirname:', __dirname);

// Check if preload file exists
import { existsSync } from 'fs';
if (existsSync(preloadPath)) {
  console.log('✅ Preload file exists at:', preloadPath);
} else {
  console.error('❌ Preload file NOT found at:', preloadPath);
}

// Note: preload script should only run in preload context, not main process

let mainWindow: BrowserWindow | null = null;

// Session management
let isQuitting = false;
let sessionStateFile: string;
const pendingOperations: Set<Promise<any>> = new Set();

// Session management functions
const initializeSessionManagement = () => {
  sessionStateFile = join(app.getPath('userData'), 'session-state.json');
  console.log('📁 Session state file:', sessionStateFile);
};

const saveSessionState = (customState?: any) => {
  if (!mainWindow) return;
  
  try {
    const bounds = mainWindow.getBounds();
    const sessionState = {
      windowBounds: bounds,
      isMaximized: mainWindow.isMaximized(),
      sessionTimestamp: Date.now(),
      lastActiveScript: null,
      pendingExecutions: [],
      unsavedSettings: {},
      ...customState
    };
    
    writeFileSync(sessionStateFile, JSON.stringify(sessionState, null, 2));
    console.log('💾 Session state saved');
  } catch (error) {
    console.error('❌ Failed to save session state:', error);
  }
};

const restoreSessionState = () => {
  try {
    if (!existsSync(sessionStateFile)) {
      console.log('📝 No previous session state found');
      return null;
    }
    
    const sessionData = JSON.parse(readFileSync(sessionStateFile, 'utf8'));
    console.log('📂 Session state restored');
    return sessionData;
  } catch (error) {
    console.error('❌ Failed to restore session state:', error);
    return null;
  }
};

const performGracefulShutdown = async (): Promise<boolean> => {
  console.log('🔄 Starting graceful shutdown sequence...');
  
  try {
    // Save current session state
    saveSessionState();
    
    // Wait for any pending operations to complete
    if (pendingOperations.size > 0) {
      console.log(`⏳ Waiting for ${pendingOperations.size} pending operations...`);
      await Promise.allSettled([...pendingOperations]);
    }
    
    // Notify renderer about shutdown
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('session:before-quit');
    }
    
    console.log('✅ Graceful shutdown completed');
    return true;
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    return false;
  }
};

const createWindow = (): void => {
  // Restore previous session state
  const sessionState = restoreSessionState();
  let windowOptions: any = {
    height: 800,
    width: 1200,
    minHeight: 600,
    minWidth: 800,
    title: 'First Aid Kit Lite',
    titleBarStyle: 'default',
    show: false, // Don't show until ready-to-show
  };

  // Apply restored window bounds if available
  if (sessionState?.windowBounds) {
    windowOptions = {
      ...windowOptions,
      x: sessionState.windowBounds.x,
      y: sessionState.windowBounds.y,
      width: sessionState.windowBounds.width,
      height: sessionState.windowBounds.height,
    };
    console.log('🪟 Restoring window bounds from previous session');
  }

  // Create the browser window with security-first configuration
  mainWindow = new BrowserWindow({
    ...windowOptions,
    webPreferences: {
      // Security: Enable context isolation for production security
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: false, // Disabled to allow preload script access to Node.js APIs
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      preload: preloadPath,
      // Additional security measures
      additionalArguments: ['--disable-dev-shm-usage'],
      // Security: Disable dangerous features
      enableWebSQL: false,
      // Security: Content Security Policy handled in HTML
    },
  });

  // Load the index.html of the app
  if (isDevelopment) {
    mainWindow.loadURL(rendererUrl);
  } else {
    mainWindow.loadFile(rendererUrl);
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      console.log('🪟 Window ready to show, displaying window');
      mainWindow.show();
      
      // Restore maximized state if needed
      if (sessionState?.isMaximized) {
        mainWindow.maximize();
        console.log('🪟 Window maximized from previous session');
      }
      
      // Open DevTools in development
      if (process.env.NODE_ENV === 'development') {
        console.log('🛠️ Opening DevTools for debugging');
        mainWindow.webContents.openDevTools();
      }
    }
  });

  // Debug renderer console messages
  mainWindow.webContents.on('console-message', (_, level, message) => {
    console.log(`🌐 RENDERER: [${level}] ${message}`);
  });

  // Handle window close request
  mainWindow.on('close', async (event) => {
    if (!isQuitting) {
      event.preventDefault();
      console.log('🚪 Window close requested, performing graceful shutdown...');
      
      isQuitting = true;
      const shutdownSuccess = await performGracefulShutdown();
      
      if (shutdownSuccess) {
        mainWindow?.destroy();
      } else {
        isQuitting = false;
        console.warn('⚠️ Shutdown was not completed successfully');
      }
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Auto-save session state periodically
  const autoSaveInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveSessionState();
    } else {
      clearInterval(autoSaveInterval);
    }
  }, 30000); // Save every 30 seconds

  // Security: Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.warn('Blocked window.open() call to:', url);
    return { action: 'deny' };
  });

  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow navigation only to our own content
    if (isDevelopment && parsedUrl.origin !== new URL(rendererUrl).origin) {
      event.preventDefault();
      console.warn('Blocked navigation to:', navigationUrl);
    } else if (!isDevelopment && !navigationUrl.startsWith('file://')) {
      event.preventDefault();
      console.warn('Blocked navigation to:', navigationUrl);
    }
  });
};

// Protocol handler for first-aid-kit:// and fak:// URLs
const handleProtocolUrl = (url: string): void => {
  console.log('Protocol URL received:', url);
  
  // TODO: Implement protocol handling logic
  // This will be implemented in Phase 7: Protocol Integration
  
  // For now, just log the URL and show the window
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  } else {
    createWindow();
  }
};

// App event handlers
app.whenReady().then(async () => {
  // Install DevTools extensions in development
  if (isDevelopment) {
    try {
      const installExtension = (await import('electron-devtools-installer')).default;
      const { REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } = await import('electron-devtools-installer');
      
      console.log('🛠️ Installing DevTools extensions...');
      
      await installExtension([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS], {
        loadExtensionOptions: { allowFileAccess: true },
        forceDownload: false,
      });
      
      console.log('✅ DevTools extensions installed successfully');
    } catch (error) {
      console.warn('⚠️ Failed to install DevTools extensions:', error);
    }
  }

  createWindow();

  // Initialize core services after window creation
  await initializeServices();

  // Register protocol handlers
  if (!app.isDefaultProtocolClient('first-aid-kit')) {
    app.setAsDefaultProtocolClient('first-aid-kit');
  }
  
  if (!app.isDefaultProtocolClient('fak')) {
    app.setAsDefaultProtocolClient('fak');
  }

  // Handle protocol URLs on app activation (macOS)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Handle protocol URLs on Windows/Linux
app.on('second-instance', (_, commandLine) => {
  // Someone tried to run a second instance, focus our window instead
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }

  // Check for protocol URLs in command line arguments
  const protocolUrl = commandLine.find(arg => 
    arg.startsWith('first-aid-kit://') || arg.startsWith('fak://')
  );
  
  if (protocolUrl) {
    handleProtocolUrl(protocolUrl);
  }
});

// Handle protocol URLs when app is already running (Windows/Linux)
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent renderer process crashes from taking down main process
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in Main Process:', error);
  
  // TODO: Implement proper error reporting in Phase 2
  // For now, just log the error and continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in Main Process:', reason, promise);
  
  // TODO: Implement proper error reporting in Phase 2
  // For now, just log the error and continue
});

// Development: Electron live reload is handled by electron-vite

// Initialize core services
import { createServiceLogger } from './services/logger';
import { getDatabaseService } from './services/database';
import { createValidatedIpcHandler } from './services/ipc-validator';
import { getScriptRegistryService } from './services/script-registry';
import { getPowerShellExecutorService } from './services/powershell-executor';
import ScriptValidatorService from './services/script-validator';

const mainLogger = createServiceLogger('main-process');

// Initialize services after app is ready
const initializeServices = async (): Promise<void> => {
  try {
    mainLogger.info('Initializing core services...');
    
    // Initialize database service
    const db = getDatabaseService();
    const dbHealth = db.healthCheck();
    if (dbHealth.status !== 'healthy') {
      throw new Error(`Database unhealthy: ${dbHealth.details}`);
    }
    mainLogger.info('Database service initialized successfully');

    // Initialize script registry service
    const scriptRegistry = getScriptRegistryService();
    if (!scriptRegistry.isInitialized()) {
      throw new Error('Script registry failed to initialize');
    }
    mainLogger.info('Script registry service initialized successfully');

    // Initialize PowerShell executor service
    getPowerShellExecutorService();
    mainLogger.info('PowerShell executor service initialized successfully');

    // Initialize session management
    initializeSessionManagement();
    mainLogger.info('Session management initialized successfully');

    // Set up validated IPC handlers
    setupIpcHandlers();
    mainLogger.info('IPC handlers setup completed');

    mainLogger.info('All core services initialized successfully');
    
  } catch (error) {
    mainLogger.error('Failed to initialize core services', { 
      error: (error as Error).message 
    });
    throw error;
  }
};

// Set up IPC handlers with validation
const setupIpcHandlers = (): void => {
  // System information handler
  createValidatedIpcHandler('system:get-info', async () => {
    mainLogger.debug('System info requested');
    return {
      platform: process.platform,
      version: process.version,
      arch: process.arch,
      powershellVersion: 'Unknown', // TODO: Implement PowerShell version detection
      isElevated: false, // TODO: Implement elevation detection
    };
  });

  // Settings handlers
  createValidatedIpcHandler('settings:get', async () => {
    const db = getDatabaseService();
    const settings = db.getAllSettings();
    mainLogger.debug('Settings retrieved');
    return settings;
  });

  createValidatedIpcHandler('settings:update', async (settings) => {
    const db = getDatabaseService();
    for (const [key, value] of Object.entries(settings)) {
      db.setSetting(key, value);
    }
    mainLogger.info('Settings updated', { updatedKeys: Object.keys(settings) });
    
    // Notify renderer of settings change
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings:changed', db.getAllSettings());
    }
  });

  // Session management handlers
  createValidatedIpcHandler('session:save-state', async (state) => {
    saveSessionState(state);
    mainLogger.debug('Session state saved via IPC');
    return true;
  });

  createValidatedIpcHandler('session:restore-state', async () => {
    const state = restoreSessionState();
    mainLogger.debug('Session state restored via IPC');
    return state;
  });

  createValidatedIpcHandler('session:end-request', async () => {
    mainLogger.info('Session end requested via IPC');
    const success = await performGracefulShutdown();
    if (success) {
      app.quit();
    }
    return success;
  });

  // Script management handlers
  createValidatedIpcHandler('script:get-all', async () => {
    const scriptRegistry = getScriptRegistryService();
    const scripts = scriptRegistry.getAllScripts();
    mainLogger.debug('All scripts retrieved', { count: scripts.length });
    return scripts;
  });

  createValidatedIpcHandler('script:get-details', async (data: { scriptId: string }) => {
    const scriptRegistry = getScriptRegistryService();
    const script = scriptRegistry.getScript(data.scriptId);
    
    if (!script) {
      throw new Error(`Script not found: ${data.scriptId}`);
    }

    // Get validation result for the script
    const validationResult = await ScriptValidatorService.validateScript(script);
    
    mainLogger.debug('Script details retrieved', { 
      scriptId: data.scriptId,
      securityLevel: validationResult.securityLevel
    });

    return {
      ...script,
      validation: validationResult
    };
  });

  createValidatedIpcHandler('script:execute', async (data: { scriptId: string; parameters?: Record<string, any> }) => {
    const scriptRegistry = getScriptRegistryService();
    const psExecutor = getPowerShellExecutorService();
    
    // Get script definition
    const scriptDef = scriptRegistry.getScript(data.scriptId);
    if (!scriptDef) {
      throw new Error(`Script not found: ${data.scriptId}`);
    }

    // Validate script before execution
    const validationResult = await ScriptValidatorService.validateScript(scriptDef);
    
    // Create execution request
    const executionRequest = {
      scriptId: data.scriptId,
      scriptDefinition: scriptDef,
      parameters: data.parameters,
      validationResult,
      requestId: '', // Will be generated by executor
      source: 'manual' as const
    };

    // Execute script
    const executionId = await psExecutor.executeScript(executionRequest);
    
    mainLogger.info('Script execution initiated', {
      scriptId: data.scriptId,
      executionId,
      hasParameters: !!data.parameters
    });

    return { executionId };
  });

  createValidatedIpcHandler('script:cancel', async (data: { executionId: string }) => {
    const psExecutor = getPowerShellExecutorService();
    const success = psExecutor.cancelExecution(data.executionId, 'user_request');
    
    mainLogger.info('Script execution cancellation requested', {
      executionId: data.executionId,
      success
    });

    return { success };
  });

  createValidatedIpcHandler('log:get', async (filters?: any) => {
    const db = getDatabaseService();
    const logs = db.getExecutionLogs(filters?.limit || 100, filters?.offset || 0);
    
    mainLogger.debug('Execution logs retrieved', { 
      count: logs.length,
      hasFilters: !!filters
    });

    return logs;
  });

  createValidatedIpcHandler('log:export', async (data: { format: 'json' | 'csv'; filters?: any }) => {
    const db = getDatabaseService();
    const logs = db.getExecutionLogs(1000, 0); // Get more logs for export
    
    let exportData: string;
    
    if (data.format === 'csv') {
      // Convert to CSV format
      const headers = ['ID', 'Timestamp', 'Script ID', 'Script Name', 'Status', 'Duration', 'Exit Code', 'Output', 'Error'];
      const csvRows = [headers.join(',')];
      
      for (const log of logs) {
        const row = [
          log.id,
          new Date(log.timestamp).toISOString(),
          log.script_id,
          `"${log.script_name.replace(/"/g, '""')}"`,
          log.status,
          log.duration || '',
          log.exit_code || '',
          `"${(log.output || '').replace(/"/g, '""').substring(0, 100)}"`,
          `"${(log.error || '').replace(/"/g, '""').substring(0, 100)}"`
        ];
        csvRows.push(row.join(','));
      }
      
      exportData = csvRows.join('\n');
    } else {
      // JSON format
      exportData = JSON.stringify(logs, null, 2);
    }

    mainLogger.info('Logs exported', {
      format: data.format,
      logCount: logs.length,
      dataSize: exportData.length
    });

    return exportData;
  });
};

console.log('First Aid Kit Lite main process initialized');
console.log('Protocol handlers registered for: first-aid-kit://, fak://');
console.log('Environment:', process.env.NODE_ENV || 'production');