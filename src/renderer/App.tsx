import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

// Import Pages
import { Scripts as ScriptsPage } from './pages/Scripts';
import { LogsPage } from './pages/LogsPage';
import { AboutPage } from './pages/AboutPage';
import { AppLayout } from './components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { ScriptExecutionProvider } from '@/hooks/useScriptExecution';
import { SettingsProvider } from '@/hooks/useSettings';

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV;

// Script interface for Quick Actions
interface QuickScript {
  id: string;
  name: string;
  category: string;
}

// Dashboard Page Component
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [scripts, setScripts] = useState<QuickScript[]>([]);
  const [loading, setLoading] = useState(true);

  // Load scripts dynamically
  useEffect(() => {
    const loadScripts = async () => {
      try {
        if (window.electronAPI?.getAvailableScripts) {
          const availableScripts = await window.electronAPI.getAvailableScripts();
          setScripts(availableScripts.map((s: any) => ({
            id: s.id,
            name: s.name,
            category: s.category
          })));
        }
      } catch (err) {
        console.error('Failed to load scripts for dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    loadScripts();
  }, []);

  // Get top 4 scripts for quick actions (or all if less than 4)
  const quickActions = scripts.slice(0, 4);

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

        {/* Quick Actions Card - Dynamically loaded */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-[#00468b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500 truncate">Quick Actions</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">
                  {loading ? 'Loading...' : `${scripts.length} Available Tools`}
                </dd>
              </div>
            </div>
            <div className="space-y-2">
              {loading ? (
                <div className="text-sm text-gray-500">Loading tools...</div>
              ) : (
                <>
                  {quickActions.map((script) => (
                    <Button
                      key={script.id}
                      variant="outline"
                      className="w-full justify-start text-sm"
                      onClick={() => navigate('/scripts')}
                    >
                      {script.name}
                    </Button>
                  ))}
                  {scripts.length > 4 && (
                    <Button
                      variant="outline"
                      className="w-full justify-start text-sm text-[#00468b]"
                      onClick={() => navigate('/scripts')}
                    >
                      View All {scripts.length} Tools →
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Usage Statistics Card - Production only */}
        {!isDevelopment && (
          <div className="bg-white overflow-hidden shadow rounded-lg lg:col-span-2">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-[#00468b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500 truncate">Usage Statistics</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">Tool Execution History</dd>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-3xl font-bold text-[#00468b]">--</p>
                    <p className="text-sm text-gray-500">Total Executions</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-600">--</p>
                    <p className="text-sm text-gray-500">Successful</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-red-600">--</p>
                    <p className="text-sm text-gray-500">Failed</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500 text-center">
                    Usage statistics will be available once the database is connected.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Development Status Card - Development only */}
        {isDevelopment && (
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
                    <dd className="mt-1 text-lg font-semibold text-gray-900">Phase 8 Complete - Ready for Phase 9</dd>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-green-600">98%</span>
                  <p className="text-xs text-gray-500">Overall Progress</p>
                </div>
              </div>
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '98%' }}></div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    <span>Phase 1-7: Foundation through Notifications</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    <span>Phase 8: Protocol Integration</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    <span>Phase 9: Testing & QA (current)</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                    <span>Phase 10: Packaging & Deployment</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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