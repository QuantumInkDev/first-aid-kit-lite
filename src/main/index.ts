import { app, BrowserWindow, protocol, ipcMain } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';

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

declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  // Create the browser window with security-first configuration
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    minHeight: 600,
    minWidth: 800,
    title: 'First Aid Kit Lite',
    titleBarStyle: 'default',
    show: false, // Don't show until ready-to-show
    webPreferences: {
      // Security: Enable context isolation and disable node integration
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: false, // Disabled to allow preload script
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      // Additional security measures
      additionalArguments: ['--disable-dev-shm-usage'],
    },
  });

  // Load the index.html of the app
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      
      // Open DevTools in development
      if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Security: Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.warn('Blocked window.open() call to:', url);
    return { action: 'deny' };
  });

  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow navigation only to our own content
    if (parsedUrl.origin !== new URL(MAIN_WINDOW_WEBPACK_ENTRY).origin) {
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
app.whenReady().then(() => {
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
app.on('second-instance', (event, commandLine, workingDirectory) => {
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

// Development: Enable live reload for Electron too
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname, {
    electron: join(__dirname, '..', 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit',
  });
}

console.log('First Aid Kit Lite main process initialized');
console.log('Protocol handlers registered for: first-aid-kit://, fak://');
console.log('Environment:', process.env.NODE_ENV || 'production');