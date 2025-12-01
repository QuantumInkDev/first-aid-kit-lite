import React, { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { SearchFilters } from '../components/script/SearchFilters';
import { ScriptList } from '../components/script/ScriptList';
import { ConfirmationDialog } from '../components/script/ConfirmationDialog';
import { useScriptExecution } from '@/hooks/useScriptExecution';

interface Script {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedDuration: number;
}

export const Scripts: React.FC = () => {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Confirmation dialog state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);

  // Execution tracking
  const { startExecution, updateExecution, executions } = useScriptExecution();

  // Fetch scripts on mount
  useEffect(() => {
    const loadScripts = async () => {
      try {
        setLoading(true);
        setError(null);

        if (window.electronAPI?.getAvailableScripts) {
          const availableScripts = await window.electronAPI.getAvailableScripts();
          if (availableScripts.length === 0) {
            // Use mock data when API returns empty array (development mode)
            console.warn('No scripts from API, using mock data for development');
            setScripts(getMockScripts());
          } else {
            // Map API response to simplified Script interface
            setScripts(availableScripts.map((s: any) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              category: s.category,
              estimatedDuration: s.estimatedDuration
            })));
          }
        } else {
          // Fallback: Use mock data if API not available
          console.warn('Electron API not available, using mock data');
          setScripts(getMockScripts());
        }
      } catch (err) {
        console.error('Failed to load scripts:', err);
        setError('Failed to load scripts. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadScripts();
  }, []);

  // Listen for protocol requests from browser links
  useEffect(() => {
    if (!window.electronAPI?.onProtocolRequest) {
      console.warn('Protocol request listener not available');
      return;
    }

    const handleProtocolRequest = (request: { command: string; scriptId: string; parameters: Record<string, string>; rawUrl: string }) => {
      console.log('🔗 Protocol request received:', request);

      if (request.command !== 'run') {
        console.warn('Unknown protocol command:', request.command);
        return;
      }

      // Wait for scripts to be loaded before processing
      if (loading) {
        console.log('⏳ Scripts still loading, will retry protocol request...');
        // Retry after a short delay
        setTimeout(() => handleProtocolRequest(request), 500);
        return;
      }

      // Find the script by ID
      const script = scripts.find((s) => s.id === request.scriptId);

      if (!script) {
        console.error('❌ Script not found for protocol request:', request.scriptId);
        window.electronAPI?.showNotification('error', `Tool not found: ${request.scriptId}`);
        return;
      }

      console.log('✅ Found script for protocol request:', script.name);

      // Select the script and open confirmation dialog
      setSelectedScript(script);
      setConfirmDialogOpen(true);
    };

    window.electronAPI.onProtocolRequest(handleProtocolRequest);

    return () => {
      window.electronAPI?.removeProtocolListener?.();
    };
  }, [scripts, loading]);

  // Extract unique categories from scripts
  const categories = useMemo(() => {
    const uniqueCategories = new Set(scripts.map((script) => script.category));
    return Array.from(uniqueCategories).sort();
  }, [scripts]);

  // Get execution status for a script
  const getScriptExecutionStatus = (scriptId: string) => {
    const activeExecution = executions.find(
      (exec) => exec.scriptId === scriptId && (exec.status === 'running' || exec.status === 'pending')
    );
    return activeExecution?.status;
  };

  // Filter scripts based on search and filters
  const filteredScripts = useMemo(() => {
    return scripts.filter((script) => {
      // Search filter
      const matchesSearch =
        !searchQuery ||
        script.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        script.description.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      const matchesCategory = !selectedCategory || script.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [scripts, searchQuery, selectedCategory]);

  // Handle script execution button click - shows confirmation dialog
  const handleExecuteScript = (scriptId: string) => {
    const script = scripts.find((s) => s.id === scriptId);
    if (!script) {
      console.error('Script not found:', scriptId);
      return;
    }

    setSelectedScript(script);
    setConfirmDialogOpen(true);
  };

  // Handle confirmed script execution
  const handleConfirmExecution = async () => {
    if (!selectedScript) return;

    // Start execution tracking
    const executionId = startExecution(selectedScript.id, selectedScript.name);

    try {
      console.log('✅ Executing tool via IPC:', selectedScript);

      // Show native Windows notification for execution start
      window.electronAPI.showNotification('info', `Starting "${selectedScript.name}"...`);

      // Set up listener for real-time execution updates
      const updateHandler = (update: any) => {
        console.log('📡 Received execution update:', update);

        // Map the backend executionId to our frontend executionId
        if (update.scriptId === selectedScript.id) {
          updateExecution(executionId, {
            status: update.status,
            progress: update.progress,
            output: update.output,
            error: update.error
          });

          // Show native Windows notification on completion
          if (update.status === 'success') {
            window.electronAPI.showNotification('success', `"${selectedScript.name}" completed successfully!`);
          } else if (update.status === 'error') {
            window.electronAPI.showNotification('error', `"${selectedScript.name}" failed: ${update.error || 'Unknown error'}`);
          } else if (update.status === 'cancelled') {
            window.electronAPI.showNotification('warning', `"${selectedScript.name}" was cancelled.`);
          }

          // Clean up listener when execution completes
          if (update.status === 'success' || update.status === 'error' || update.status === 'cancelled') {
            console.log('🏁 Execution completed, removing listener');
            window.electronAPI.removeScriptExecutionListener();
          }
        }
      };

      // Register update listener
      window.electronAPI.onScriptExecutionUpdate(updateHandler);

      // Call actual PowerShell execution via IPC
      const result = await window.electronAPI.executeScript(selectedScript.id, {});

      console.log('🚀 Script execution started with ID:', result.id);

      // Close confirmation dialog
      setConfirmDialogOpen(false);
      setSelectedScript(null);
    } catch (err) {
      console.error('❌ Script execution failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      updateExecution(executionId, {
        status: 'error',
        error: errorMessage,
      });

      // Show native Windows error notification
      window.electronAPI.showNotification('error', `"${selectedScript.name}" failed to start: ${errorMessage}`);

      // Clean up and close dialog
      window.electronAPI.removeScriptExecutionListener();
      setConfirmDialogOpen(false);
      setSelectedScript(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Maintenance Tools</h1>
          <p className="mt-2 text-sm text-gray-600">
            Execute maintenance tools to keep your system running smoothly.
          </p>
        </div>

        {/* Stats */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-8 w-8 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Available Tools</p>
                  <p className="text-2xl font-semibold text-gray-900">{scripts.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-8 w-8 text-purple-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Categories</p>
                  <p className="text-2xl font-semibold text-gray-900">{categories.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <SearchFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          categories={categories}
        />

        {/* Results Count */}
        {!loading && !error && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{filteredScripts.length}</span> of{' '}
              <span className="font-medium">{scripts.length}</span> tools
            </p>
          </div>
        )}

        {/* Script List */}
        <ScriptList
          scripts={filteredScripts.map(script => ({
            ...script,
            executionStatus: getScriptExecutionStatus(script.id)
          }))}
          onExecute={handleExecuteScript}
          loading={loading}
          error={error}
        />

        {/* Confirmation Dialog */}
        {selectedScript && (
          <ConfirmationDialog
            isOpen={confirmDialogOpen}
            onClose={() => {
              setConfirmDialogOpen(false);
              setSelectedScript(null);
            }}
            onConfirm={handleConfirmExecution}
            scriptName={selectedScript.name}
            scriptDescription={selectedScript.description}
            estimatedDuration={selectedScript.estimatedDuration}
            category={selectedScript.category}
          />
        )}
      </div>
    </AppLayout>
  );
};

// Mock data for development when Electron API is not available
function getMockScripts(): Script[] {
  return [
    {
      id: 'clear-temp',
      name: 'Clear Temporary Files',
      description: 'Remove temporary system files to free up disk space',
      category: 'Cleanup',
      estimatedDuration: 5000,
    },
    {
      id: 'flush-dns',
      name: 'Flush DNS Cache',
      description: 'Clear DNS resolver cache to fix network issues',
      category: 'Network',
      estimatedDuration: 2000,
    },
    {
      id: 'restart-explorer',
      name: 'Restart Windows Explorer',
      description: 'Restart the Windows Explorer process',
      category: 'System',
      estimatedDuration: 3000,
    },
    {
      id: 'clean-prefetch',
      name: 'Clean Prefetch Data',
      description: 'Clear prefetch data to improve system performance',
      category: 'Cleanup',
      estimatedDuration: 4000,
    },
    {
      id: 'reset-network',
      name: 'Reset Network Configuration',
      description: 'Reset all network adapters to default settings',
      category: 'Network',
      estimatedDuration: 15000,
    },
    {
      id: 'optimize-drives',
      name: 'Optimize Drives',
      description: 'Run drive optimization and defragmentation',
      category: 'Maintenance',
      estimatedDuration: 60000,
    },
    {
      id: 'clear-event-logs',
      name: 'Clear Event Logs',
      description: 'Clear Windows Event Viewer logs',
      category: 'Cleanup',
      estimatedDuration: 5000,
    },
  ];
}
