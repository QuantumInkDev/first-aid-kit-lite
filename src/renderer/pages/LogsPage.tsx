import React, { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { useScriptExecution } from '@/hooks/useScriptExecution';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/common/Card';
import { Button } from '@/components/ui/button';
import { ExecutionStatusBadge } from '../components/execution/ExecutionStatusBadge';
import { cn } from '@/lib/utils';

type FilterStatus = 'all' | 'success' | 'error' | 'running' | 'cancelled';
type ExportFormat = 'csv' | 'json';

// Unified execution type for display
interface DisplayExecution {
  id: string;
  scriptId: string;
  scriptName: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  output?: string;
  error?: string;
  progress?: number;
  source: 'memory' | 'database';
}

export const LogsPage: React.FC = () => {
  const { executions: memoryExecutions, clearAllCompleted } = useScriptExecution();
  const [dbLogs, setDbLogs] = useState<DisplayExecution[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Load logs from database on mount
  useEffect(() => {
    const loadDbLogs = async () => {
      try {
        if (window.electronAPI?.getExecutionLogs) {
          const logs = await window.electronAPI.getExecutionLogs();
          const formattedLogs: DisplayExecution[] = logs.map((log: any) => ({
            id: log.id,
            scriptId: log.scriptId,
            scriptName: log.scriptName,
            status: log.status,
            startTime: new Date(log.timestamp),
            endTime: log.duration ? new Date(new Date(log.timestamp).getTime() + log.duration) : undefined,
            output: log.output,
            error: log.error,
            source: 'database' as const,
          }));
          setDbLogs(formattedLogs);
        }
      } catch (err) {
        console.error('Failed to load logs from database:', err);
      } finally {
        setDbLoading(false);
      }
    };
    loadDbLogs();
  }, []);

  // Merge memory and database executions, preferring memory for running ones
  const executions = useMemo(() => {
    const memoryIds = new Set(memoryExecutions.map(e => e.id));

    // Convert memory executions to display format
    const memoryFormatted: DisplayExecution[] = memoryExecutions.map(e => ({
      id: e.id,
      scriptId: e.scriptId,
      scriptName: e.scriptName,
      status: e.status,
      startTime: e.startTime,
      endTime: e.endTime,
      output: e.output,
      error: e.error,
      progress: e.progress,
      source: 'memory' as const,
    }));

    // Add database logs that aren't in memory (to avoid duplicates)
    const dbOnlyLogs = dbLogs.filter(log => !memoryIds.has(log.id));

    // Combine and sort by start time (newest first)
    return [...memoryFormatted, ...dbOnlyLogs].sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );
  }, [memoryExecutions, dbLogs]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [clearingAllData, setClearingAllData] = useState(false);

  // Statistics
  const stats = useMemo(() => {
    const total = executions.length;
    const completed = executions.filter(e => ['success', 'error', 'cancelled'].includes(e.status));
    const successful = executions.filter(e => e.status === 'success').length;
    const failed = executions.filter(e => e.status === 'error').length;
    const running = executions.filter(e => e.status === 'running').length;

    const completedWithTime = completed.filter(e => e.endTime);
    const avgTime = completedWithTime.length > 0
      ? completedWithTime.reduce((sum, e) => {
          const duration = e.endTime!.getTime() - e.startTime.getTime();
          return sum + duration;
        }, 0) / completedWithTime.length / 1000
      : 0;

    const successRate = completed.length > 0 ? (successful / completed.length) * 100 : 0;

    return {
      total,
      successful,
      failed,
      running,
      successRate,
      avgTime,
    };
  }, [executions]);

  // Filtered executions
  const filteredExecutions = useMemo(() => {
    return executions.filter(execution => {
      // Status filter
      if (filterStatus !== 'all' && execution.status !== filterStatus) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          execution.scriptName.toLowerCase().includes(query) ||
          execution.id.toLowerCase().includes(query) ||
          execution.output?.toLowerCase().includes(query) ||
          execution.error?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [executions, filterStatus, searchQuery]);

  // Toggle row expansion
  const toggleRowExpansion = (executionId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(executionId)) {
      newExpanded.delete(executionId);
    } else {
      newExpanded.add(executionId);
    }
    setExpandedRows(newExpanded);
  };

  // Export functionality
  const handleExport = (format: ExportFormat) => {
    const data = filteredExecutions.map(e => ({
      id: e.id,
      scriptId: e.scriptId,
      scriptName: e.scriptName,
      status: e.status,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime?.toISOString() || null,
      duration: e.endTime ? `${((e.endTime.getTime() - e.startTime.getTime()) / 1000).toFixed(2)}s` : null,
      output: e.output || null,
      error: e.error || null,
    }));

    if (format === 'csv') {
      // CSV export
      const headers = ['ID', 'Script Name', 'Status', 'Start Time', 'End Time', 'Duration', 'Output', 'Error'];
      const csvRows = [
        headers.join(','),
        ...data.map(row => [
          row.id,
          `"${row.scriptName}"`,
          row.status,
          row.startTime,
          row.endTime || '',
          row.duration || '',
          `"${(row.output || '').replace(/"/g, '""')}"`,
          `"${(row.error || '').replace(/"/g, '""')}"`,
        ].join(','))
      ];
      const csv = csvRows.join('\n');
      downloadFile(csv, 'tool-run-history.csv', 'text/csv');
    } else {
      // JSON export
      const json = JSON.stringify(data, null, 2);
      downloadFile(json, 'tool-run-history.json', 'application/json');
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = async () => {
    // Clear from database
    if (window.electronAPI?.clearExecutionLogs) {
      try {
        await window.electronAPI.clearExecutionLogs();
      } catch (err) {
        console.error('Failed to clear logs from database:', err);
      }
    }
    // Clear from memory
    clearAllCompleted();
    // Clear local state
    setDbLogs([]);
    setShowClearConfirm(false);
    setExpandedRows(new Set());
  };

  const handleClearAllData = async () => {
    setClearingAllData(true);
    try {
      if (window.electronAPI?.clearAllData) {
        const result = await window.electronAPI.clearAllData();
        if (result.success) {
          // Reload the entire app to reinitialize with fresh database
          window.location.reload();
        } else {
          console.error('Failed to clear all data:', result.message);
          alert('Failed to clear data: ' + result.message);
          setClearingAllData(false);
          setShowClearAllConfirm(false);
        }
      }
    } catch (err) {
      console.error('Failed to clear all data:', err);
      alert('Failed to clear data. Please try again.');
      setClearingAllData(false);
      setShowClearAllConfirm(false);
    }
  };

  const formatDuration = (startTime: Date, endTime?: Date) => {
    if (!endTime) return '-';
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    if (duration < 60) return `${duration.toFixed(1)}s`;
    return `${Math.floor(duration / 60)}m ${(duration % 60).toFixed(0)}s`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Run History</h1>
            <p className="mt-2 text-sm text-gray-600">
              View detailed tool run history and export logs for auditing purposes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              className="text-sm"
              disabled={filteredExecutions.length === 0}
            >
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('json')}
              className="text-sm"
              disabled={filteredExecutions.length === 0}
            >
              Export JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowClearConfirm(true)}
              className="text-sm text-red-600 hover:text-red-700"
              disabled={executions.filter(e => ['success', 'error', 'cancelled'].includes(e.status)).length === 0}
            >
              Clear Completed
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowClearAllConfirm(true)}
              className="text-sm text-red-600 hover:text-red-700 border-red-300"
            >
              Clear All Data
            </Button>
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Runs"
            value={stats.total.toString()}
            icon="🔧"
            color="blue"
          />
          <StatCard
            title="Success Rate"
            value={`${stats.successRate.toFixed(1)}%`}
            icon="✅"
            color="green"
          />
          <StatCard
            title="Average Time"
            value={`${stats.avgTime.toFixed(1)}s`}
            icon="⏱️"
            color="purple"
          />
          <StatCard
            title="Currently Running"
            value={stats.running.toString()}
            icon="🔄"
            color="yellow"
          />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Search</label>
                <input
                  type="text"
                  placeholder="Search by tool name, ID, output, or error..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Status Filter */}
              <div className="sm:w-48">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                  <option value="running">Running</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Results Count */}
            <div className="mt-4 text-sm text-gray-600">
              Showing <span className="font-medium">{filteredExecutions.length}</span> of{' '}
              <span className="font-medium">{executions.length}</span> runs
            </div>
          </CardContent>
        </Card>

        {/* Tool Run History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Run History</CardTitle>
            <CardDescription>Detailed view of all tool runs</CardDescription>
          </CardHeader>
          <CardContent>
            {dbLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading run history...</p>
              </div>
            ) : filteredExecutions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🔧</div>
                <p className="text-gray-600 mb-2">No tool runs found</p>
                <p className="text-sm text-gray-500">
                  {executions.length === 0
                    ? 'Run a tool to see history here'
                    : 'Try adjusting your filters'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredExecutions.map((execution) => (
                  <div
                    key={execution.id}
                    className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors"
                  >
                    {/* Row Header */}
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleRowExpansion(execution.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          {/* Expand Icon */}
                          <button
                            type="button"
                            className="text-gray-400 hover:text-gray-600 transition-transform"
                            style={{
                              transform: expandedRows.has(execution.id) ? 'rotate(90deg)' : 'rotate(0deg)',
                            }}
                          >
                            ▶
                          </button>

                          {/* Script Name */}
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{execution.scriptName}</div>
                            <div className="text-xs text-gray-500 mt-1">ID: {execution.id}</div>
                          </div>

                          {/* Status Badge */}
                          <ExecutionStatusBadge status={execution.status} size="sm" />

                          {/* Time Info */}
                          <div className="text-sm text-gray-600 text-right min-w-[120px]">
                            <div>{execution.startTime.toLocaleTimeString()}</div>
                            <div className="text-xs text-gray-500">
                              {formatDuration(execution.startTime, execution.endTime)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar (for running executions) */}
                      {execution.status === 'running' && execution.progress !== undefined && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${execution.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {expandedRows.has(execution.id) && (
                      <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Script ID:</span>
                            <span className="ml-2 text-gray-600">{execution.scriptId}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Status:</span>
                            <span className="ml-2 text-gray-600">{execution.status}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Start Time:</span>
                            <span className="ml-2 text-gray-600">
                              {execution.startTime.toLocaleString()}
                            </span>
                          </div>
                          {execution.endTime && (
                            <div>
                              <span className="font-medium text-gray-700">End Time:</span>
                              <span className="ml-2 text-gray-600">
                                {execution.endTime.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Output */}
                        {execution.output && (
                          <div>
                            <div className="font-medium text-gray-700 mb-2">Output:</div>
                            <div className="bg-white border border-gray-200 rounded p-3 text-sm text-gray-800 font-mono whitespace-pre-wrap">
                              {execution.output}
                            </div>
                          </div>
                        )}

                        {/* Error */}
                        {execution.error && (
                          <div>
                            <div className="font-medium text-red-700 mb-2">Error:</div>
                            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 font-mono whitespace-pre-wrap">
                              {execution.error}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clear Confirmation Dialog */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Clear Completed Runs</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to clear all completed tool runs? This action cannot be undone.
                  Currently running tools will not be affected.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowClearConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleClearLogs}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Clear Logs
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clear All Data Confirmation Dialog */}
        {showClearAllConfirm && (
          <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-red-600 mb-2">⚠️ Clear All Application Data</h3>
                <p className="text-sm text-gray-600 mb-4">
                  This will permanently delete all application data including:
                </p>
                <ul className="text-sm text-gray-600 mb-4 list-disc list-inside space-y-1">
                  <li>All run history and logs</li>
                  <li>Saved settings and preferences</li>
                  <li>Database and cached data</li>
                </ul>
                <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> The app will reload after clearing data and you will be returned to the Dashboard.
                  </p>
                </div>
                <p className="text-sm text-red-600 font-medium mb-4">
                  This action cannot be undone!
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowClearAllConfirm(false)}
                    disabled={clearingAllData}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleClearAllData}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={clearingAllData}
                  >
                    {clearingAllData ? 'Clearing & Reloading...' : 'Clear All Data'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

// Statistics Card Component
interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'yellow';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  };

  return (
    <div className={cn('rounded-lg border p-4', colorClasses[color])}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className="text-3xl opacity-50">{icon}</div>
      </div>
    </div>
  );
};
