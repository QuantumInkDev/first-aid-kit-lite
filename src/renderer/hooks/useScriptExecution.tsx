import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ScriptExecution {
  id: string;
  scriptId: string;
  scriptName: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  progress?: number;
  output?: string;
  error?: string;
}

interface ScriptExecutionContextValue {
  executions: ScriptExecution[];
  activeExecutions: ScriptExecution[];
  recentExecutions: ScriptExecution[];
  startExecution: (scriptId: string, scriptName: string) => string;
  updateExecution: (executionId: string, updates: Partial<ScriptExecution>) => void;
  cancelExecution: (executionId: string) => void;
  clearExecution: (executionId: string) => void;
  clearAllCompleted: () => void;
}

const ScriptExecutionContext = createContext<ScriptExecutionContextValue | undefined>(undefined);

export const ScriptExecutionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [executions, setExecutions] = useState<ScriptExecution[]>([]);

  // Start a new execution
  const startExecution = useCallback((scriptId: string, scriptName: string): string => {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newExecution: ScriptExecution = {
      id: executionId,
      scriptId,
      scriptName,
      status: 'running',
      startTime: new Date(),
    };

    setExecutions((prev) => [newExecution, ...prev]);

    return executionId;
  }, []);

  // Update an existing execution
  const updateExecution = useCallback((executionId: string, updates: Partial<ScriptExecution>) => {
    setExecutions((prev) =>
      prev.map((exec) =>
        exec.id === executionId
          ? {
              ...exec,
              ...updates,
              endTime: updates.status && ['success', 'error', 'cancelled'].includes(updates.status)
                ? new Date()
                : exec.endTime,
            }
          : exec
      )
    );
  }, []);

  // Cancel an execution
  const cancelExecution = useCallback((executionId: string) => {
    updateExecution(executionId, { status: 'cancelled' });

    // Call the actual cancel API
    if (window.electronAPI?.cancelScriptExecution) {
      window.electronAPI.cancelScriptExecution(executionId).catch((err) => {
        console.error('Failed to cancel script execution:', err);
      });
    }
  }, [updateExecution]);

  // Clear a single execution from the list
  const clearExecution = useCallback((executionId: string) => {
    setExecutions((prev) => prev.filter((exec) => exec.id !== executionId));
  }, []);

  // Clear all completed executions
  const clearAllCompleted = useCallback(() => {
    setExecutions((prev) => prev.filter((exec) => exec.status === 'running' || exec.status === 'pending'));
  }, []);

  // Get active executions (running or pending)
  const activeExecutions = executions.filter(
    (exec) => exec.status === 'running' || exec.status === 'pending'
  );

  // Get recent executions (completed in last 5 minutes, max 10)
  const recentExecutions = executions
    .filter((exec) => exec.status !== 'running' && exec.status !== 'pending')
    .slice(0, 10);

  const value: ScriptExecutionContextValue = {
    executions,
    activeExecutions,
    recentExecutions,
    startExecution,
    updateExecution,
    cancelExecution,
    clearExecution,
    clearAllCompleted,
  };

  return (
    <ScriptExecutionContext.Provider value={value}>
      {children}
    </ScriptExecutionContext.Provider>
  );
};

// Hook to use the script execution context
export const useScriptExecution = (): ScriptExecutionContextValue => {
  const context = useContext(ScriptExecutionContext);
  if (!context) {
    throw new Error('useScriptExecution must be used within a ScriptExecutionProvider');
  }
  return context;
};
