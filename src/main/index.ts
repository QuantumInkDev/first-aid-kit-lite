import { app, BrowserWindow, protocol, Menu, Notification, Tray, nativeImage } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Set AppUserModelId for Windows notifications to work properly
app.setAppUserModelId('com.horizonblue.first-aid-kit-v3');

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

// =============================================================================
// DEBUG LOGGING - Streams main process logs to renderer DevTools console
// =============================================================================
// This allows viewing main process logs in the packaged app by opening DevTools (Ctrl+Shift+I)
const debugLog = (category: string, message: string, data?: any): void => {
  const timestamp = new Date().toISOString().split('T')[1].replace('Z', '');
  const logEntry = {
    timestamp,
    category,
    message,
    data,
    source: 'main-process'
  };

  // Always log to console (visible when running from command line)
  console.log(`[${timestamp}] [${category}] ${message}`, data ? JSON.stringify(data, null, 2) : '');

  // Send to renderer if window exists (visible in DevTools)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('debug:main-process-log', logEntry);
  }
};

// Paths for Vite builds
import { resolve } from 'path';
const preloadPath = resolve(__dirname, '../preload/preload.js');
const rendererUrl = isDevelopment 
  ? 'http://localhost:5173'
  : resolve(__dirname, '../renderer/index.html');

console.log('🔧 Main process: Preload path (resolve):', preloadPath);
console.log('🔧 Main process: __dirname:', __dirname);

// Helper function to get asset paths (works in both dev and production)
const getAssetPath = (assetName: string): string => {
  if (app.isPackaged) {
    // Production: assets are in resources/assets
    return join(process.resourcesPath, 'assets', assetName);
  }
  // Development: assets are in src/assets
  return join(__dirname, '../../src/assets', assetName);
};

// Windows Toast Notification helper using Electron's native Notification API
const showWindowsToast = (title: string, message: string, iconPath?: string): void => {
  try {
    const notification = new Notification({
      title,
      body: message,
      icon: iconPath || getAssetPath('fakl.png'),
      silent: true,
      timeoutType: 'default' // Auto-dismiss after default timeout
    });

    notification.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });

    notification.show();
    mainLogger.debug('Windows notification shown via Electron API', { title, message });
  } catch (error) {
    mainLogger.error('Failed to show notification:', { error: (error as Error).message });
  }
};

// Check if preload file exists
import { existsSync } from 'fs';
if (existsSync(preloadPath)) {
  console.log('✅ Preload file exists at:', preloadPath);
} else {
  console.error('❌ Preload file NOT found at:', preloadPath);
}

// Note: preload script should only run in preload context, not main process

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

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

// Create system tray
const createTray = (): void => {
  const iconPath = getAssetPath('fakl.ico');
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon);
  tray.setToolTip('First Aid Kit');

  // Create minimal context menu (no quit option - users can't easily close the app)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open First Aid Kit',
      click: () => {
        showMainWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'About',
      click: () => {
        showMainWindow();
        // Navigate to about page after window is shown
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('navigate', '/about');
          }
        }, 500);
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Double-click to restore window
  tray.on('double-click', () => {
    showMainWindow();
  });

  console.log('📌 System tray created');
};

// Configure auto-start on Windows boot
const configureAutoStart = (): void => {
  // Only enable auto-start in production
  if (!isDevelopment) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true, // Start minimized to tray
      path: process.execPath,
      args: ['--hidden']
    });
    console.log('🚀 Auto-start configured for Windows boot');
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
    title: 'First Aid Kit',
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
    icon: getAssetPath('fakl.ico'),
    autoHideMenuBar: true,
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

  // Set up minimal menu with keyboard shortcuts only
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'View',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { role: 'toggleDevTools', accelerator: 'CmdOrCtrl+Shift+I' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Load the index.html of the app
  if (isDevelopment) {
    mainWindow.loadURL(rendererUrl);
  } else {
    mainWindow.loadFile(rendererUrl);
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      // In production: always start minimized to system tray
      // In development: show the window normally
      if (!isDevelopment) {
        console.log('📌 App started minimized to system tray (production mode)');
        mainWindow.setSkipTaskbar(true); // Hide from taskbar when minimized to tray
        // Don't show the window, keep it hidden in tray
      } else {
        console.log('🪟 Window ready to show, displaying window');
        mainWindow.show();

        // Restore maximized state if needed
        if (sessionState?.isMaximized) {
          mainWindow.maximize();
          console.log('🪟 Window maximized from previous session');
        }
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
    // In production: minimize to tray instead of quitting
    // In development: allow normal close behavior
    if (!isDevelopment && !isQuitting) {
      event.preventDefault();
      console.log('🔽 Minimizing to system tray (production mode)');
      mainWindow?.hide();
      mainWindow?.setSkipTaskbar(true); // Hide from taskbar when minimized to tray
      return;
    }

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
const handleProtocolUrl = async (url: string): Promise<void> => {
  debugLog('PROTOCOL', '========== PROTOCOL URL RECEIVED ==========', { url });
  mainLogger.info('Protocol URL received:', { url });

  try {
    // Parse the protocol URL
    // Format: first-aid-kit://run/<script-id>?param1=value1&param2=value2
    // or: fak://run/<script-id>
    const parsedUrl = new URL(url);
    const protocolName = parsedUrl.protocol.replace(':', ''); // 'first-aid-kit' or 'fak'
    const command = parsedUrl.hostname; // 'run', 'help', etc.
    const scriptId = parsedUrl.pathname.replace(/^\//, ''); // Remove leading slash

    debugLog('PROTOCOL', 'URL parsed', {
      protocol: protocolName,
      command,
      scriptId,
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
      searchParams: parsedUrl.searchParams.toString()
    });

    // Parse query parameters
    const parameters: Record<string, string> = {};
    debugLog('PROTOCOL', 'Extracting query parameters...');

    parsedUrl.searchParams.forEach((value, key) => {
      parameters[key] = value;
      debugLog('PROTOCOL', `Parameter extracted: "${key}"`, {
        key,
        rawValue: value,
        decodedValue: decodeURIComponent(value),
        valueLength: value.length
      });
      mainLogger.debug('Protocol URL parameter extracted:', { key, value, decodedValue: decodeURIComponent(value) });
    });

    debugLog('PROTOCOL', 'All parameters extracted', {
      parameterCount: Object.keys(parameters).length,
      parameterKeys: Object.keys(parameters),
      parameters: parameters
    });

    mainLogger.info('Parsed protocol request:', {
      protocol: protocolName,
      command,
      scriptId,
      parameters,
      parameterKeys: Object.keys(parameters),
      rawSearch: parsedUrl.search
    });

    // Validate command
    if (command !== 'run') {
      debugLog('PROTOCOL', 'Unknown command - showing window', { command });
      mainLogger.warn('Unknown protocol command:', { command });
      showMainWindow();
      return;
    }

    // Validate script ID
    if (!scriptId) {
      debugLog('PROTOCOL', 'No script ID provided');
      mainLogger.warn('No script ID provided in protocol URL');
      showMainWindow();
      return;
    }

    // Ensure script registry is initialized before proceeding
    try {
      debugLog('PROTOCOL', 'Waiting for script registry initialization...');
      const scriptRegistry = getScriptRegistryService();
      await scriptRegistry.waitForInitialization();
      debugLog('PROTOCOL', 'Script registry initialized');
      mainLogger.info('Script registry initialized for protocol request');
    } catch (initError) {
      debugLog('PROTOCOL', 'Script registry initialization FAILED', { error: String(initError) });
      mainLogger.error('Failed to initialize script registry:', { error: initError });
      showWindowsToast('Initialization Error', 'Failed to initialize script registry. Please restart the app.', getAssetPath('fakl.png'));
      return;
    }

    // Execute the script directly without showing the window
    debugLog('PROTOCOL', 'Calling executeScriptFromProtocol', { scriptId, parameters });
    await executeScriptFromProtocol(scriptId, parameters);

  } catch (error) {
    debugLog('PROTOCOL', 'FATAL ERROR parsing protocol URL', { url, error: String(error) });
    mainLogger.error('Failed to parse protocol URL:', { url, error });
    showWindowsToast('Protocol Error', `Failed to process protocol request: ${error instanceof Error ? error.message : 'Unknown error'}`, getAssetPath('fakl.png'));
  }
};

// Execute script from protocol URL (runs silently without showing UI)
const executeScriptFromProtocol = async (scriptId: string, parameters: Record<string, string>): Promise<void> => {
  debugLog('EXECUTE', '========== executeScriptFromProtocol ==========', { scriptId, parameters });

  const scriptRegistry = getScriptRegistryService();
  const psExecutor = getPowerShellExecutorService();

  // Get script definition
  const scriptDef = scriptRegistry.getScript(scriptId);
  const allScripts = scriptRegistry.getAllScripts();

  debugLog('EXECUTE', 'Script lookup result', {
    scriptId,
    found: !!scriptDef,
    scriptName: scriptDef?.name,
    scriptPath: scriptDef?.scriptPath,
    availableScriptIds: allScripts.map(s => s.id)
  });

  mainLogger.debug('Script lookup result:', {
    scriptId,
    found: !!scriptDef,
    availableScripts: allScripts.map(s => s.id),
    registryInitialized: scriptRegistry.isInitialized()
  });

  if (!scriptDef) {
    debugLog('EXECUTE', 'ERROR: Script not found!', { scriptId });
    mainLogger.error('Script not found for protocol execution:', {
      scriptId,
      availableScripts: allScripts.map(s => s.id)
    });
    showWindowsToast('Tool Not Found', `Could not find tool: ${scriptId}`, getAssetPath('fakl.png'));
    return;
  }

  // Log script definition details including expected parameters
  debugLog('EXECUTE', 'Script definition loaded', {
    id: scriptDef.id,
    name: scriptDef.name,
    scriptPath: scriptDef.scriptPath,
    expectedParameters: scriptDef.parameters?.map(p => ({
      name: p.name,
      type: p.type,
      required: p.required,
      default: p.default
    }))
  });

  // Compare incoming parameters with expected parameters
  debugLog('EXECUTE', 'Parameter comparison BEFORE normalization', {
    incomingParameterKeys: Object.keys(parameters),
    incomingParameters: parameters,
    expectedParameterNames: scriptDef.parameters?.map(p => p.name) || [],
    fileRestorePathCheck: scriptId === 'file-restore' ? {
      hasPath: 'Path' in parameters,
      hasPathLower: 'path' in parameters,
      pathValue: parameters['Path'] || parameters['path'] || 'NOT FOUND'
    } : 'N/A'
  });

  // FIX: Normalize parameter keys to match script definition casing
  // This ensures URL parameters like 'path' map to script definition 'Path'
  if (scriptDef.parameters && scriptDef.parameters.length > 0) {
    const normalizedParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(parameters)) {
      // Find matching parameter definition (case-insensitive)
      const matchingDef = scriptDef.parameters.find(
        p => p.name.toLowerCase() === key.toLowerCase()
      );
      // Use the definition's casing if found, otherwise keep original
      const normalizedKey = matchingDef ? matchingDef.name : key;
      normalizedParams[normalizedKey] = value;

      debugLog('EXECUTE', `Parameter key normalization: "${key}" -> "${normalizedKey}"`, {
        originalKey: key,
        normalizedKey,
        value,
        matchedDefinition: matchingDef ? matchingDef.name : 'NONE'
      });
    }
    parameters = normalizedParams;

    debugLog('EXECUTE', 'Parameters AFTER normalization', {
      normalizedKeys: Object.keys(parameters),
      normalizedParameters: parameters
    });
  }

  mainLogger.info('Executing script from protocol:', { scriptId, scriptName: scriptDef.name });

  // Show starting notification
  const iconPath = getAssetPath('fakl.png');
  const iconExists = existsSync(iconPath);

  // Show Windows toast notification for script start
  setTimeout(() => {
    try {
      showWindowsToast('Tool Starting', `Running "${scriptDef.name}"...`);
    } catch (notifError) {
      debugLog('EXECUTE', 'Notification error', { error: (notifError as Error).message });
    }
  }, 500);

  try {
    // Validate script before execution
    debugLog('EXECUTE', 'Validating script...');
    const validationResult = await ScriptValidatorService.validateScript(scriptDef);
    debugLog('EXECUTE', 'Validation complete', {
      securityLevel: validationResult.securityLevel,
      violationCount: validationResult.violations?.length || 0
    });

    const executionRequest = {
      scriptId,
      scriptDefinition: scriptDef,
      parameters,
      validationResult,
      requestId: '',
      source: 'protocol' as const
    };

    debugLog('EXECUTE', 'Execution request built', {
      scriptId: executionRequest.scriptId,
      parametersInRequest: executionRequest.parameters,
      parameterKeys: Object.keys(executionRequest.parameters)
    });

    // Execute the script
    debugLog('EXECUTE', 'Calling psExecutor.executeScript...');
    const executionId = await psExecutor.executeScript(executionRequest);
    debugLog('EXECUTE', 'Execution started', { executionId });
    mainLogger.info('Protocol script execution started:', { executionId, scriptId });

    // Send initial execution started event to UI (same as normal execution)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('script:execution:update', {
        executionId,
        scriptId,
        scriptName: scriptDef.name,
        status: 'running',
        progress: 0
      });
    }

    // Set up polling to check execution status and send UI updates
    const updateInterval = setInterval(() => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        clearInterval(updateInterval);
        return;
      }

      const execution = (psExecutor as any).activeExecutions?.get(executionId);
      if (!execution) {
        clearInterval(updateInterval);
        return;
      }

      // Send progress update
      const elapsed = Date.now() - execution.startTime;
      const estimated = scriptDef.estimatedDuration || 5000;
      const progress = Math.min(Math.floor((elapsed / estimated) * 90), 90);

      mainWindow.webContents.send('script:execution:update', {
        executionId,
        scriptId,
        scriptName: scriptDef.name,
        status: 'running',
        progress
      });
    }, 500);

    // Set up real-time callbacks for script completion
    psExecutor.setExecutionCallbacks(executionId, {
      onProgress: (output: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('script:execution:update', {
            executionId,
            scriptId,
            scriptName: scriptDef.name,
            status: 'running',
            output
          });
        }
      },
      onComplete: (result) => {
        clearInterval(updateInterval);

        // Send completion to UI
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('script:execution:update', {
            executionId,
            scriptId,
            scriptName: scriptDef.name,
            status: result.success ? 'success' : 'error',
            progress: 100,
            output: result.output || `Script "${scriptDef.name}" completed`,
            error: result.error,
            duration: result.duration,
            exitCode: result.exitCode
          });
        }

        // Show Windows toast notification for completion
        showWindowsToast(
          result.success ? 'Tool Completed' : 'Tool Failed',
          result.success
            ? `"${scriptDef.name}" completed successfully`
            : `"${scriptDef.name}" failed: ${result.error || 'Unknown error'}`,
          iconExists ? iconPath : undefined
        );

        mainLogger.info('Protocol script execution completed', {
          executionId,
          scriptId,
          success: result.success,
          duration: result.duration
        });
      }
    });

  } catch (error) {
    mainLogger.error('Failed to execute script from protocol:', { scriptId, error });
    showWindowsToast(
      'Tool Failed',
      `"${scriptDef.name}" failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`,
      getAssetPath('fakl.png')
    );
  }
};

// Helper to show and focus the main window
const showMainWindow = (): void => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.setSkipTaskbar(false); // Show in taskbar when window is visible
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
};

// App event handlers
app.whenReady().then(async () => {
  // Install DevTools extensions in development
  // TEMPORARILY DISABLED - Causing segfaults
  /*
  if (isDevelopment) {
    try {
      const installExtension = (await import('electron-devtools-installer')).default;
      const { REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } = await import('electron-devtools-installer');

      console.log('🛠️ Installing DevTools extensions...');

      await installExtension([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS], {
        loadExtensionOptions: { allowFileAccess: true},
        forceDownload: false,
      });

      console.log('✅ DevTools extensions installed successfully');
    } catch (error) {
      console.warn('⚠️ Failed to install DevTools extensions:', error);
    }
  }
  */

  // Create system tray first
  createTray();

  // Configure auto-start on Windows boot (production only)
  configureAutoStart();

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
  // Check for protocol URLs in command line arguments
  const protocolUrl = commandLine.find(arg =>
    arg.startsWith('first-aid-kit://') || arg.startsWith('fak://')
  );

  if (protocolUrl) {
    // Protocol URL found - execute silently without showing window
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

// Quit when all windows are closed (except on macOS and production mode with tray)
app.on('window-all-closed', () => {
  // In production: keep running in tray even when window is closed
  // In development: quit normally
  if (isDevelopment && process.platform !== 'darwin') {
    app.quit();
  }
  // Production mode: app stays running in system tray
  if (!isDevelopment) {
    console.log('📌 App continues running in system tray');
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
import { getDatabaseService, isDatabaseAvailable } from './services/database';
import { createValidatedIpcHandler } from './services/ipc-validator';
import { getScriptRegistryService } from './services/script-registry';
import { getPowerShellExecutorService } from './services/powershell-executor';
import ScriptValidatorService from './services/script-validator';
import { getSystemInfoService } from './services/system-info';
import { initializeSignatureVerifier } from './services/signature-verifier';

const mainLogger = createServiceLogger('main-process');

// Initialize services after app is ready
const initializeServices = async (): Promise<void> => {
  try {
    mainLogger.info('Initializing core services...');

    // Initialize database service (optional - app can run without it)
    try {
      if (isDatabaseAvailable()) {
        const db = getDatabaseService();
        const dbHealth = db.healthCheck();
        if (dbHealth.status !== 'healthy') {
          throw new Error(`Database unhealthy: ${dbHealth.details}`);
        }
        mainLogger.info('Database service initialized successfully');
      } else {
        mainLogger.warn('Database service unavailable - app will run without persistence', {
          reason: 'Native module may not be compatible with this Electron version'
        });
      }
    } catch (dbError) {
      // Allow app to run without database in all modes
      mainLogger.warn('Database service unavailable - continuing without persistence', {
        error: (dbError as Error).message
      });
    }

    // Initialize signature verifier service
    // IMPORTANT: Add your enterprise certificate thumbprint here
    // Get it by running: pnpm sign-scripts:verify
    // TODO: Enable enforcement once code signing certificate is obtained
    initializeSignatureVerifier({
      trustedThumbprints: [
        // Add your certificate thumbprint(s) here when available:
        // 'EBF2340A1A656243DD8A7B5BBB576C4E502EB414'
      ],
      // Temporarily disabled until code signing certificate is obtained
      enforceSignatures: false,
    });
    mainLogger.info('Signature verifier service initialized', {
      enforceSignatures: false,
      note: 'Signature enforcement disabled - awaiting code signing certificate'
    });

    // Initialize script registry service
    const scriptRegistry = getScriptRegistryService();
    await scriptRegistry.waitForInitialization();
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

  // Dashboard info handler (full system data - 60 second refresh)
  createValidatedIpcHandler('system:get-dashboard-info', async () => {
    mainLogger.debug('Dashboard info requested');
    const systemInfo = getSystemInfoService();
    return await systemInfo.getDashboardInfo();
  });

  // Realtime metrics handler (CPU/RAM only - 5 second refresh)
  createValidatedIpcHandler('system:get-realtime-metrics', async () => {
    const systemInfo = getSystemInfoService();
    return systemInfo.getRealtimeMetrics();
  });

  // Settings handlers
  createValidatedIpcHandler('settings:get', async () => {
    if (!isDatabaseAvailable()) {
      mainLogger.warn('Settings requested but database unavailable');
      return {}; // Return empty settings
    }
    const db = getDatabaseService();
    const settings = db.getAllSettings();
    mainLogger.debug('Settings retrieved');
    return settings;
  });

  createValidatedIpcHandler('settings:update', async (settings) => {
    if (!isDatabaseAvailable()) {
      mainLogger.warn('Settings update requested but database unavailable');
      return; // Silently skip
    }
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

    // Create execution request with callbacks for real-time updates
    const executionRequest = {
      scriptId: data.scriptId,
      scriptDefinition: scriptDef,
      parameters: data.parameters,
      validationResult,
      requestId: '', // Will be generated by executor
      source: 'manual' as const
    };

    // Execute script and get the execution ID immediately
    const executionId = await psExecutor.executeScript(executionRequest);

    // Send initial execution started event
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('script:execution:update', {
        executionId,
        scriptId: data.scriptId,
        status: 'running',
        progress: 0
      });
    }

    mainLogger.info('Script execution initiated', {
      scriptId: data.scriptId,
      executionId,
      hasParameters: !!data.parameters
    });

    // Set up polling to check execution status and send updates
    const updateInterval = setInterval(() => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        clearInterval(updateInterval);
        return;
      }

      const execution = (psExecutor as any).activeExecutions?.get(executionId);
      if (!execution) {
        // Execution completed or not found, stop polling
        clearInterval(updateInterval);
        return;
      }

      // Send progress update (we'll estimate progress based on elapsed time)
      const elapsed = Date.now() - execution.startTime;
      const estimated = scriptDef.estimatedDuration || 5000;
      const progress = Math.min(Math.floor((elapsed / estimated) * 90), 90); // Cap at 90% until complete

      mainWindow.webContents.send('script:execution:update', {
        executionId,
        scriptId: data.scriptId,
        status: 'running',
        progress
      });
    }, 500);

    // Set up real-time callbacks for script completion with actual output
    psExecutor.setExecutionCallbacks(executionId, {
      onProgress: (output: string) => {
        // Stream output to renderer in real-time
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('script:execution:update', {
            executionId,
            scriptId: data.scriptId,
            status: 'running',
            output: output
          });
        }
      },
      onComplete: (result) => {
        // Stop polling
        clearInterval(updateInterval);

        // Send actual completion result with real output
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('script:execution:update', {
            executionId,
            scriptId: data.scriptId,
            status: result.success ? 'success' : 'error',
            progress: 100,
            output: result.output || `Script "${scriptDef.name}" completed`,
            error: result.error,
            duration: result.duration,
            exitCode: result.exitCode
          });
        }

        mainLogger.info('Script execution completed with real output', {
          executionId,
          success: result.success,
          outputLength: result.output?.length || 0,
          duration: result.duration
        });
      }
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
    if (!isDatabaseAvailable()) {
      mainLogger.warn('Logs requested but database unavailable');
      return []; // Return empty logs
    }
    const db = getDatabaseService();
    const logs = db.getExecutionLogs(filters?.limit || 100, filters?.offset || 0);

    mainLogger.debug('Execution logs retrieved', {
      count: logs.length,
      hasFilters: !!filters
    });

    return logs;
  });

  createValidatedIpcHandler('log:stats', async () => {
    if (!isDatabaseAvailable()) {
      mainLogger.warn('Stats requested but database unavailable');
      return { total: 0, successful: 0, failed: 0, available: false };
    }
    const db = getDatabaseService();
    const logs = db.getExecutionLogs(10000, 0); // Get all logs for stats

    const stats = {
      total: logs.length,
      successful: logs.filter(l => l.status === 'success').length,
      failed: logs.filter(l => l.status === 'error').length,
      available: true
    };

    mainLogger.debug('Execution stats retrieved', stats);
    return stats;
  });

  createValidatedIpcHandler('log:clear', async () => {
    if (!isDatabaseAvailable()) {
      mainLogger.warn('Clear logs requested but database unavailable');
      return { success: false, cleared: 0 };
    }
    const db = getDatabaseService();
    const cleared = db.clearCompletedLogs();

    mainLogger.info('Cleared completed execution logs', { cleared });
    return { success: true, cleared };
  });

  // Clear all application data (database, logs, etc.)
  createValidatedIpcHandler('data:clear-all', async () => {
    mainLogger.info('Clear all data requested');

    try {
      // Close database connection first
      if (isDatabaseAvailable()) {
        const db = getDatabaseService();
        db.close();
        mainLogger.info('Database connection closed');
      }

      // Small delay to ensure file handles are released
      await new Promise(resolve => setTimeout(resolve, 200));

      // Delete database files
      const dbPath = join(app.getPath('userData'), 'database');
      const { rmSync, existsSync: fsExistsSync } = require('fs');

      if (fsExistsSync(dbPath)) {
        rmSync(dbPath, { recursive: true, force: true });
        mainLogger.info('Database directory deleted', { path: dbPath });
      }

      // Reinitialize database (this will recreate the directory and tables)
      const db = getDatabaseService();
      db.reinitialize();

      mainLogger.info('All data cleared and database reinitialized');
      return { success: true, message: 'All data cleared successfully' };
    } catch (error) {
      mainLogger.error('Failed to clear all data', { error: (error as Error).message, stack: (error as Error).stack });
      return { success: false, message: (error as Error).message };
    }
  });

  createValidatedIpcHandler('log:export', async (data: { format: 'json' | 'csv'; filters?: any }) => {
    if (!isDatabaseAvailable()) {
      mainLogger.warn('Log export requested but database unavailable');
      return data.format === 'json' ? '[]' : 'No data available - database unavailable';
    }
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

  // Native Windows notification handler
  createValidatedIpcHandler('notification:show', async (data: { type: string; message: string; options?: any }) => {
    // Check if notifications are supported
    if (!Notification.isSupported()) {
      mainLogger.warn('Native notifications not supported on this platform');
      return { success: false, reason: 'not_supported' };
    }

    // Map notification types to appropriate titles
    const titles: Record<string, string> = {
      success: 'Tool Completed',
      error: 'Tool Failed',
      warning: 'Warning',
      info: 'First Aid Kit'
    };

    const title = titles[data.type] || 'First Aid Kit';

    // Create and show native notification
    const notification = new Notification({
      title: title,
      body: data.message,
      icon: getAssetPath('fakl.png'),
      silent: false,
      urgency: data.type === 'error' ? 'critical' : 'normal',
      timeoutType: 'default'
    });

    // Handle notification click - bring app to focus
    notification.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
    });

    notification.show();

    mainLogger.debug('Native notification shown', {
      type: data.type,
      title,
      messageLength: data.message.length
    });

    return { success: true };
  });

  // Favorites handlers
  createValidatedIpcHandler('favorites:get', async () => {
    if (!isDatabaseAvailable()) {
      mainLogger.warn('Favorites requested but database unavailable');
      return []; // Return empty array
    }
    const db = getDatabaseService();
    const favorites = db.getSetting<string[]>('favorites', []);
    mainLogger.debug('Favorites retrieved', { count: favorites?.length || 0 });
    return favorites || [];
  });

  createValidatedIpcHandler('favorites:toggle', async (data: { scriptId: string }) => {
    if (!isDatabaseAvailable()) {
      mainLogger.warn('Favorites toggle requested but database unavailable');
      return { success: false, isFavorite: false };
    }
    const db = getDatabaseService();
    const favorites = db.getSetting<string[]>('favorites', []) || [];

    const index = favorites.indexOf(data.scriptId);
    let isFavorite: boolean;

    if (index === -1) {
      // Add to favorites
      favorites.push(data.scriptId);
      isFavorite = true;
      mainLogger.info('Script added to favorites', { scriptId: data.scriptId });
    } else {
      // Remove from favorites
      favorites.splice(index, 1);
      isFavorite = false;
      mainLogger.info('Script removed from favorites', { scriptId: data.scriptId });
    }

    db.setSetting('favorites', favorites);
    return { success: true, isFavorite, favorites };
  });
};

console.log('First Aid Kit main process initialized');
console.log('Protocol handlers registered for: first-aid-kit://, fak://');
console.log('Environment:', process.env.NODE_ENV || 'production');