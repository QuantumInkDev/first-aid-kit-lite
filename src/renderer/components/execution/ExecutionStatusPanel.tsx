import React, { useRef, useEffect, useState } from 'react';
import { useScriptExecution } from '@/hooks/useScriptExecution';
import { ExecutionStatusBadge } from './ExecutionStatusBadge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ExecutionStatusPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExecutionStatusPanel: React.FC<ExecutionStatusPanelProps> = ({ isOpen, onClose }) => {
  const { activeExecutions, recentExecutions, cancelExecution, clearExecution, clearAllCompleted } =
    useScriptExecution();
  const panelRef = useRef<HTMLDivElement>(null);
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null);

  const toggleOutputExpanded = (executionId: string) => {
    setExpandedOutput((prev) => (prev === executionId ? null : executionId));
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDuration = (startTime: Date, endTime?: Date): string => {
    const end = endTime || new Date();
    const durationMs = end.getTime() - startTime.getTime();
    const seconds = Math.floor(durationMs / 1000);

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const formatTime = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Script Executions</h3>
        <div className="flex items-center gap-2">
          {recentExecutions.length > 0 && (
            <button
              onClick={clearAllCompleted}
              className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              Clear All
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1">
        {/* Active Executions */}
        {activeExecutions.length > 0 && (
          <div className="p-4 border-b border-gray-200 bg-blue-50">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Active ({activeExecutions.length})
            </h4>
            <div className="space-y-3">
              {activeExecutions.map((execution) => (
                <div
                  key={execution.id}
                  className="bg-white rounded-lg border border-blue-200 p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {execution.scriptName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Started {formatTime(execution.startTime)} • {formatDuration(execution.startTime)}
                      </p>
                    </div>
                    <ExecutionStatusBadge status={execution.status} size="sm" />
                  </div>

                  {execution.progress !== undefined && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${execution.progress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{execution.progress}% complete</p>
                    </div>
                  )}

                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelExecution(execution.id)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    {execution.output && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleOutputExpanded(execution.id)}
                        className="text-xs"
                      >
                        {expandedOutput === execution.id ? 'Hide Output' : 'View Output'}
                      </Button>
                    )}
                  </div>

                  {/* Output Viewer */}
                  {expandedOutput === execution.id && execution.output && (
                    <div className="mt-3 rounded-md bg-gray-900 border border-gray-700 overflow-hidden">
                      <div className="px-3 py-1.5 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-mono">PowerShell Output</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(execution.output || '')}
                          className="text-gray-400 hover:text-gray-200 text-xs"
                          title="Copy to clipboard"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="p-3 text-xs text-green-400 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                        {execution.output}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Executions */}
        {recentExecutions.length > 0 && (
          <div className="p-4">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Recent
            </h4>
            <div className="space-y-2">
              {recentExecutions.map((execution) => (
                <div
                  key={execution.id}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    execution.status === 'success' && 'bg-green-50 border-green-200',
                    execution.status === 'error' && 'bg-red-50 border-red-200',
                    execution.status === 'cancelled' && 'bg-yellow-50 border-yellow-200'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {execution.scriptName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(execution.startTime)} • {formatDuration(execution.startTime, execution.endTime)}
                      </p>
                      {execution.error && (
                        <p className="text-xs text-red-600 mt-1 line-clamp-2">{execution.error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <ExecutionStatusBadge status={execution.status} size="sm" showIcon={false} />
                      <button
                        onClick={() => clearExecution(execution.id)}
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Clear execution"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* View Output Button */}
                  {execution.output && (
                    <div className="mt-2">
                      <button
                        onClick={() => toggleOutputExpanded(execution.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <svg
                          className={cn('w-3 h-3 transition-transform', expandedOutput === execution.id && 'rotate-90')}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {expandedOutput === execution.id ? 'Hide Output' : 'View Output'}
                      </button>
                    </div>
                  )}

                  {/* Output Viewer */}
                  {expandedOutput === execution.id && execution.output && (
                    <div className="mt-2 rounded-md bg-gray-900 border border-gray-700 overflow-hidden">
                      <div className="px-3 py-1.5 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-mono">PowerShell Output</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(execution.output || '')}
                          className="text-gray-400 hover:text-gray-200 text-xs"
                          title="Copy to clipboard"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="p-3 text-xs text-green-400 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                        {execution.output}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {activeExecutions.length === 0 && recentExecutions.length === 0 && (
          <div className="p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">No executions</h3>
            <p className="mt-1 text-sm text-gray-500">
              Script executions will appear here when you run them
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
