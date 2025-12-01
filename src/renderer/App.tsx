import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import Pages
import { Scripts as ScriptsPage } from './pages/Scripts';
import { LogsPage } from './pages/LogsPage';
import { AboutPage } from './pages/AboutPage';
import { AppLayout } from './components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { ScriptExecutionProvider } from '@/hooks/useScriptExecution';
import { SettingsProvider } from '@/hooks/useSettings';

// Dashboard Page Component
const Dashboard: React.FC = () => {
  return (
    <AppLayout>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* System Status Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500 truncate">System Status</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">Ready</dd>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                First Aid Kit Lite is ready to execute maintenance tools.
              </p>
            </div>
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
                <dd className="mt-1 text-lg font-semibold text-gray-900">7 Available Tools</dd>
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
                ⚙️ More Tools →
              </Button>
            </div>
          </div>
        </div>

        {/* Development Status Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg lg:col-span-2">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500 truncate">Development Status</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">Phase 8: Protocol Integration (96% Complete)</dd>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-green-600">96%</span>
                <p className="text-xs text-gray-500">Overall Progress</p>
              </div>
            </div>
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '96%' }}></div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span>Phase 1: Project Foundation</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span>Phase 2: Core Infrastructure</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span>Phase 3: Tool Integration</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span>Phase 4: User Interface Development</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span>Phase 5: Tool Implementation</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span>Phase 6: UI Polish & Branding</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span>Phase 7: Notification System</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  <span>Phase 8: Protocol Integration (current)</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                  <span>Phase 9-10: Testing & Deployment</span>
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
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/about" element={<AboutPage />} />
            </Routes>
          </div>
          <Toaster />
        </Router>
      </ScriptExecutionProvider>
    </SettingsProvider>
  );
};