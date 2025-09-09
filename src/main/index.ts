import { app, BrowserWindow, protocol, ipcMain } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

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
      // Security: Temporarily disable context isolation for debugging
      contextIsolation: false, // TODO: Re-enable after fixing API exposure
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: false, // Disabled to allow preload script
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      preload: preloadPath,
      // Additional security measures
      additionalArguments: ['--disable-dev-shm-usage'],
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

// IPC Handlers - Basic implementation for testing
ipcMain.handle('system:get-info', async () => {
  console.log('📡 IPC: system:get-info called');
  return {
    platform: process.platform,
    version: process.version,
    arch: process.arch,
    powershellVersion: 'Unknown',
    isElevated: false,
  };
});

console.log('First Aid Kit Lite main process initialized');
console.log('Protocol handlers registered for: first-aid-kit://, fak://');
console.log('Environment:', process.env.NODE_ENV || 'production');