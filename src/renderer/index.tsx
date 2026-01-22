import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Import global styles
import './styles/globals.css';

// Declare the electron API that's injected by preload script
declare global {
  interface Window {
    electronAPI: import('@preload/preload').ElectronAPI;
  }
}

// Create React root
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);

// Render the app
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Development: Log when renderer process is ready
if (process.env.NODE_ENV === 'development') {
  console.log('First Aid Kit renderer started');
  console.log('Electron API available:', !!window.electronAPI);
  
  // Test electron API availability
  if (window.electronAPI) {
    console.log('Testing system info API...');
    window.electronAPI.getSystemInfo()
      .then(info => console.log('System info:', info))
      .catch(err => console.warn('System info not yet available:', err));
  }
}

// Handle hot module replacement in development
if (import.meta.hot) {
  import.meta.hot.accept('./App', (newModule) => {
    if (newModule) {
      const NextApp = newModule.App;
      root.render(
        <React.StrictMode>
          <NextApp />
        </React.StrictMode>
      );
    }
  });
}