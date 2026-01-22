import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

// Import Pages
import { Scripts as ScriptsPage } from './pages/Scripts';
import { LogsPage } from './pages/LogsPage';
import { AboutPage } from './pages/AboutPage';
import { AppLayout } from './components/layout/AppLayout';
import { Toaster } from '@/components/ui/toaster';
import { ScriptExecutionProvider } from '@/hooks/useScriptExecution';
import { SettingsProvider } from '@/hooks/useSettings';

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV;

// Script interface for Quick Actions
interface QuickScript {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedDuration: number;
  order?: number;
}

// Import components needed for Dashboard
import { ConfirmationDialog } from './components/script/ConfirmationDialog';
import { useScriptExecution } from '@/hooks/useScriptExecution';
import { SystemInfoPanel } from './components/dashboard/SystemInfoPanel';

// Stats interface
interface ExecutionStats {
  total: number;
  successful: number;
  failed: number;
  available: boolean;
}

// Dashboard Page Component
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [scripts, setScripts] = useState<QuickScript[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedScript, setSelectedScript] = useState<QuickScript | null>(null);
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const { startExecution, updateExecution, openPanel } = useScriptExecution();

  // Load scripts and favorites dynamically
  useEffect(() => {
    const loadScriptsAndFavorites = async () => {
      try {
        // Load favorites first
        if (window.electronAPI?.getFavorites) {
          try {
            const loadedFavorites = await window.electronAPI.getFavorites();
            setFavorites(loadedFavorites || []);
          } catch (favErr) {
            console.warn('Failed to load favorites for dashboard:', favErr);
          }
        }

        if (window.electronAPI?.getAvailableScripts) {
          const availableScripts = await window.electronAPI.getAvailableScripts();
          setScripts(availableScripts.map((s: any) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            category: s.category,
            estimatedDuration: s.estimatedDuration,
            order: s.order
          })));
        }
      } catch (err) {
        console.error('Failed to load scripts for dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    loadScriptsAndFavorites();
  }, []);

  // Load execution stats from database
  useEffect(() => {
    const loadStats = async () => {
      try {
        if (window.electronAPI?.getExecutionStats) {
          const executionStats = await window.electronAPI.getExecutionStats();
          setStats(executionStats);
        }
      } catch (err) {
        console.error('Failed to load execution stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, []);

  // Refresh stats after successful execution
  const refreshStats = async () => {
    try {
      if (window.electronAPI?.getExecutionStats) {
        const executionStats = await window.electronAPI.getExecutionStats();
        setStats(executionStats);
      }
    } catch (err) {
      console.error('Failed to refresh stats:', err);
    }
  };

  // Handle Quick Action click
  const handleQuickAction = (script: QuickScript) => {
    setSelectedScript(script);
    setConfirmDialogOpen(true);
  };

  // Handle favorite toggle
  const handleToggleFavorite = async (scriptId: string) => {
    try {
      if (window.electronAPI?.toggleFavorite) {
        const newFavorites = await window.electronAPI.toggleFavorite(scriptId);
        setFavorites(newFavorites || []);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // Handle confirmed script execution
  const handleConfirmExecution = async (showOutput: boolean = false) => {
    if (!selectedScript) return;

    const executionId = startExecution(selectedScript.id, selectedScript.name);

    if (showOutput) {
      openPanel();
    }

    try {
      window.electronAPI.showNotification('info', `Starting "${selectedScript.name}"...`);

      const updateHandler = (update: any) => {
        if (update.scriptId === selectedScript.id) {
          updateExecution(executionId, {
            status: update.status,
            progress: update.progress,
            output: update.output,
            error: update.error
          });

          if (update.status === 'success') {
            window.electronAPI.showNotification('success', `"${selectedScript.name}" completed successfully!`);
            refreshStats(); // Refresh stats after successful execution
          } else if (update.status === 'error') {
            window.electronAPI.showNotification('error', `"${selectedScript.name}" failed: ${update.error || 'Unknown error'}`);
            refreshStats(); // Refresh stats after failed execution
          } else if (update.status === 'cancelled') {
            window.electronAPI.showNotification('warning', `"${selectedScript.name}" was cancelled.`);
          }

          if (update.status === 'success' || update.status === 'error' || update.status === 'cancelled') {
            window.electronAPI.removeScriptExecutionListener();
          }
        }
      };

      window.electronAPI.onScriptExecutionUpdate(updateHandler);
      await window.electronAPI.executeScript(selectedScript.id, {});

      setConfirmDialogOpen(false);
      setSelectedScript(null);
    } catch (err) {
      console.error('Script execution failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      updateExecution(executionId, {
        status: 'error',
        error: errorMessage,
      });

      window.electronAPI.showNotification('error', `"${selectedScript.name}" failed to start: ${errorMessage}`);
      window.electronAPI.removeScriptExecutionListener();
      setConfirmDialogOpen(false);
      setSelectedScript(null);
    }
  };

  // Get top 8 scripts for quick actions with priority: pinned+favorited > pinned > favorited > default order
  const quickActions = [...scripts]
    .sort((a, b) => {
      const aFav = favorites.includes(a.id);
      const bFav = favorites.includes(b.id);
      const aPinned = a.order === 0;
      const bPinned = b.order === 0;

      // Priority 1: Pinned AND favorited
      const aBoth = aPinned && aFav;
      const bBoth = bPinned && bFav;
      if (aBoth && !bBoth) return -1;
      if (!aBoth && bBoth) return 1;

      // Priority 2: Pinned only (not favorited)
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // Priority 3: Favorited only (not pinned)
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;

      // Priority 4: Default order from JSON metadata, then alphabetically
      const orderA = a.order ?? 99;
      const orderB = b.order ?? 99;
      if (orderA !== orderB) return orderA - orderB;

      return a.name.localeCompare(b.name);
    })
    .slice(0, 8);

  return (
    <AppLayout>
      <div className="grid grid-cols-1 gap-6">
        {/* System Info Panel */}
        <SystemInfoPanel />

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
            <div>
              {loading ? (
                <div className="text-sm text-gray-500">Loading tools...</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {quickActions.map((script) => {
                      const isFavorite = favorites.includes(script.id);
                      const isPinned = script.order === 0;
                      return (
                        <button
                          key={script.id}
                          type="button"
                          className="text-left px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-[#00468b] hover:text-white hover:border-[#00468b] transition-colors cursor-pointer flex items-center gap-2"
                          onClick={() => handleQuickAction(script)}
                        >
                          {isPinned ? (
                            <svg
                              className="w-4 h-4 text-[#00468b] flex-shrink-0"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                              title="Pinned"
                            >
                              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                            </svg>
                          ) : isFavorite ? (
                            <svg
                              className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                              />
                            </svg>
                          ) : null}
                          <span className="truncate">{script.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="w-full mt-2 text-left px-4 py-3 text-sm font-medium text-[#00468b] bg-gray-50 border border-gray-200 rounded-md hover:bg-[#00468b] hover:text-white hover:border-[#00468b] transition-colors cursor-pointer"
                    onClick={() => navigate('/scripts')}
                  >
                    View All ({scripts.length}) Tools →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation Dialog */}
        {selectedScript && (
          <ConfirmationDialog
            isOpen={confirmDialogOpen}
            onClose={() => {
              setConfirmDialogOpen(false);
              setSelectedScript(null);
            }}
            onConfirm={() => handleConfirmExecution(false)}
            onConfirmAndView={() => handleConfirmExecution(true)}
            scriptId={selectedScript.id}
            scriptName={selectedScript.name}
            scriptDescription={selectedScript.description}
            estimatedDuration={selectedScript.estimatedDuration}
            category={selectedScript.category}
            order={selectedScript.order}
            isFavorite={favorites.includes(selectedScript.id)}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {/* Usage Statistics Card - Production only */}
        {!isDevelopment && (
          <div className="bg-white overflow-hidden shadow rounded-lg">
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
                {statsLoading ? (
                  <div className="text-center text-gray-500">Loading statistics...</div>
                ) : stats?.available ? (
                  <>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-3xl font-bold text-[#00468b]">{stats.total}</p>
                        <p className="text-sm text-gray-500">Total Executions</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-green-600">{stats.successful}</p>
                        <p className="text-sm text-gray-500">Successful</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
                        <p className="text-sm text-gray-500">Failed</p>
                      </div>
                    </div>
                    {stats.total === 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-500 text-center">
                          Run your first tool to see statistics here.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <div className="grid grid-cols-3 gap-4 text-center mb-4">
                      <div>
                        <p className="text-3xl font-bold text-gray-300">--</p>
                        <p className="text-sm text-gray-500">Total Executions</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-gray-300">--</p>
                        <p className="text-sm text-gray-500">Successful</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-gray-300">--</p>
                        <p className="text-sm text-gray-500">Failed</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">
                      Database not available. Statistics cannot be tracked.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
};

// Navigation listener component (must be inside Router)
const NavigationListener: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (window.electronAPI?.onNavigate) {
      window.electronAPI.onNavigate((path: string) => {
        console.log('🧭 Navigation requested from tray:', path);
        navigate(path);
      });
    }

    return () => {
      if (window.electronAPI?.removeNavigateListener) {
        window.electronAPI.removeNavigateListener();
      }
    };
  }, [navigate]);

  return null;
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
          <p className="mt-4 text-gray-600">Loading First Aid Kit...</p>
          <p className="text-sm text-gray-500">Phase 1: Foundation Setup</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsProvider>
      <ScriptExecutionProvider>
        <Router>
          <NavigationListener />
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