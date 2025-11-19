import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import types from preload script
import type { SystemInfo } from '../preload/preload';

// Import Pages
import { Scripts as ScriptsPage } from './pages/Scripts';
import { SettingsPage } from './pages/SettingsPage';
import { LogsPage } from './pages/LogsPage';
import { AppLayout } from './components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ScriptExecutionProvider } from '@/hooks/useScriptExecution';
import { SettingsProvider } from '@/hooks/useSettings';

// Dashboard Page Component
const Dashboard: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSystemInfo = async () => {
      try {
        if (window.electronAPI) {
          const info = await window.electronAPI.getSystemInfo();
          setSystemInfo(info);
        } else {
          throw new Error('Electron API not available');
        }
      } catch (err) {
        console.error('Failed to load system info:', err);
        setError('Failed to load system information');
      } finally {
        setLoading(false);
      }
    };

    loadSystemInfo();
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading system information...</span>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* System Information Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500 truncate">System Status</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">Ready</dd>
              </div>
            </div>
            {systemInfo && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Platform:</span>
                  <span className="font-medium">{systemInfo.platform} {systemInfo.arch}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Version:</span>
                  <span className="font-medium">{systemInfo.version}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">PowerShell:</span>
                  <span className="font-medium">{systemInfo.powershellVersion}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Elevated:</span>
                  <span className={`font-medium ${systemInfo.isElevated ? 'text-green-600' : 'text-yellow-600'}`}>
                    {systemInfo.isElevated ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500 truncate">Quick Actions</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">7 Available Scripts</dd>
              </div>
            </div>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start text-sm">
                🧹 Clear Temporary Files
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm">
                🌐 Flush DNS Cache
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm">
                🔄 Restart Explorer
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm">
                ⚙️ More Scripts →
              </Button>
            </div>
          </div>
        </div>

        {/* Development Status Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg lg:col-span-2">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500 truncate">Development Status</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">Phase 1: Foundation Complete</dd>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span>✅ Project planning and documentation complete</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span>✅ Git repository initialized with proper structure</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span>✅ Electron project with React TypeScript configured</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span>✅ Security-first architecture implemented</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  <span>🔄 Basic UI framework established (current)</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                  <span>⏳ Protocol handlers (next: Phase 2)</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                  <span>⏳ PowerShell integration (Phase 3)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

// Main App component
export const App: React.FC = () => {
  console.log('🚀 REACT APP: Component started, electronReady state initialization');
  const [electronReady, setElectronReady] = useState(true); // Force to true for debugging

  useEffect(() => {
    // Check if electron API is available
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total
    
    const checkElectronAPI = () => {
      attempts++;
      console.log(`⏳ REACT: Checking for Electron API (attempt ${attempts}/${maxAttempts})...`);
      console.log('🔍 REACT: typeof window.electronAPI:', typeof window.electronAPI);
      console.log('🔍 REACT: window.electronAPI exists:', !!window.electronAPI);
      
      if (window.electronAPI) {
        setElectronReady(true);
        console.log('✅ Electron API ready');
        console.log('🎉 Available methods:', Object.keys(window.electronAPI));
      } else if (attempts < maxAttempts) {
        console.log(`⏳ Waiting for Electron API... (${attempts}/${maxAttempts})`);
        setTimeout(checkElectronAPI, 100);
      } else {
        console.error('❌ Electron API never became available after 5 seconds');
        console.log('🔍 Window properties containing "electron":', 
          Object.keys(window).filter(k => k.toLowerCase().includes('electron')));
        setElectronReady(true); // Show UI anyway for debugging
      }
    };

    checkElectronAPI();
  }, []);

  if (!electronReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading First Aid Kit Lite...</p>
          <p className="text-sm text-gray-500">Phase 1: Foundation Setup</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsProvider>
      <ScriptExecutionProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/scripts" element={<ScriptsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/logs" element={<LogsPage />} />
            </Routes>
          </div>
        </Router>
      </ScriptExecutionProvider>
    </SettingsProvider>
  );
};