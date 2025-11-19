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
  riskLevel: 'low' | 'medium' | 'high';
  category: string;
  estimatedDuration: number;
  requiredPermissions: string[];
}

export const Scripts: React.FC = () => {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('');

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
            setScripts(availableScripts);
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

      // Risk level filter
      const matchesRiskLevel = !selectedRiskLevel || script.riskLevel === selectedRiskLevel;

      return matchesSearch && matchesCategory && matchesRiskLevel;
    });
  }, [scripts, searchQuery, selectedCategory, selectedRiskLevel]);

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
      console.log('Executing script:', selectedScript);

      // TODO: Implement actual script execution via IPC (Phase 5)
      // For now, always use simulated execution in development
      // Actual PowerShell execution will be implemented in Phase 5
      console.warn('Using simulated execution for development (Phase 5 not yet implemented)');

      // Simulate execution with progress for development
      for (let i = 0; i <= 100; i += 20) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        updateExecution(executionId, { progress: i });
      }

      // Simulate 80% success, 20% error for demo
      const isSuccess = Math.random() > 0.2;

      if (isSuccess) {
        updateExecution(executionId, {
          status: 'success',
          progress: 100,
          output: `Script "${selectedScript.name}" completed successfully.`
        });
      } else {
        updateExecution(executionId, {
          status: 'error',
          error: 'Simulated error: Script execution failed for demonstration purposes.'
        });
      }
    } catch (err) {
      console.error('Script execution failed:', err);
      updateExecution(executionId, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">PowerShell Scripts</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage and execute maintenance scripts with confidence. All scripts are validated
            and sandboxed for security.
          </p>
        </div>

        {/* Stats */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <p className="text-sm font-medium text-gray-500">Total Scripts</p>
                  <p className="text-2xl font-semibold text-gray-900">{scripts.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-8 w-8 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Low Risk</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {scripts.filter((s) => s.riskLevel === 'low').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-8 w-8 text-yellow-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Medium Risk</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {scripts.filter((s) => s.riskLevel === 'medium').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-8 w-8 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">High Risk</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {scripts.filter((s) => s.riskLevel === 'high').length}
                  </p>
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
          selectedRiskLevel={selectedRiskLevel}
          onRiskLevelChange={setSelectedRiskLevel}
          categories={categories}
        />

        {/* Results Count */}
        {!loading && !error && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{filteredScripts.length}</span> of{' '}
              <span className="font-medium">{scripts.length}</span> scripts
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
            riskLevel={selectedScript.riskLevel}
            requiredPermissions={selectedScript.requiredPermissions}
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
      riskLevel: 'low',
      category: 'Cleanup',
      estimatedDuration: 5000,
      requiredPermissions: ['Read', 'Write', 'Delete'],
    },
    {
      id: 'flush-dns',
      name: 'Flush DNS Cache',
      description: 'Clear DNS resolver cache to fix network issues',
      riskLevel: 'low',
      category: 'Network',
      estimatedDuration: 2000,
      requiredPermissions: ['Administrator'],
    },
    {
      id: 'restart-explorer',
      name: 'Restart Windows Explorer',
      description: 'Restart the Windows Explorer process',
      riskLevel: 'medium',
      category: 'System',
      estimatedDuration: 3000,
      requiredPermissions: ['Administrator'],
    },
    {
      id: 'clean-prefetch',
      name: 'Clean Prefetch Data',
      description: 'Clear prefetch data to improve system performance',
      riskLevel: 'low',
      category: 'Cleanup',
      estimatedDuration: 4000,
      requiredPermissions: ['Read', 'Write', 'Delete'],
    },
    {
      id: 'reset-network',
      name: 'Reset Network Configuration',
      description: 'Reset all network adapters to default settings',
      riskLevel: 'high',
      category: 'Network',
      estimatedDuration: 15000,
      requiredPermissions: ['Administrator'],
    },
    {
      id: 'optimize-drives',
      name: 'Optimize Drives',
      description: 'Run drive optimization and defragmentation',
      riskLevel: 'low',
      category: 'Maintenance',
      estimatedDuration: 60000,
      requiredPermissions: ['Administrator'],
    },
    {
      id: 'clear-event-logs',
      name: 'Clear Event Logs',
      description: 'Clear Windows Event Viewer logs',
      riskLevel: 'medium',
      category: 'Cleanup',
      estimatedDuration: 5000,
      requiredPermissions: ['Administrator'],
    },
  ];
}
