import React, { useEffect, useState } from 'react';
import type { SystemInfo } from '../../../preload/preload';
import { Badge } from '../common/Badge';
import { useScriptExecution } from '@/hooks/useScriptExecution';
import { ExecutionStatusPanel } from '../execution/ExecutionStatusPanel';

export const Header: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const { activeExecutions } = useScriptExecution();

  useEffect(() => {
    const loadSystemInfo = async () => {
      try {
        if (window.electronAPI) {
          const info = await window.electronAPI.getSystemInfo();
          setSystemInfo(info);
        }
      } catch (error) {
        console.error('Failed to load system info:', error);
      }
    };

    loadSystemInfo();
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">First Aid Kit Lite</h1>
              <p className="text-sm text-gray-500">PowerShell Maintenance Tools</p>
            </div>
            <Badge variant="info" className="ml-2">
              v0.1.0-alpha
            </Badge>
          </div>

          <div className="flex items-center space-x-4">
            {systemInfo && (
              <div className="flex items-center space-x-3 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">Platform:</span>
                  <span className="font-medium text-gray-900">
                    {systemInfo.platform} {systemInfo.arch}
                  </span>
                </div>
                <div className="h-4 w-px bg-gray-300" />
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">PowerShell:</span>
                  <span className="font-medium text-gray-900">
                    {systemInfo.powershellVersion}
                  </span>
                </div>
                <div className="h-4 w-px bg-gray-300" />
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">Admin:</span>
                  <Badge variant={systemInfo.isElevated ? 'success' : 'warning'}>
                    {systemInfo.isElevated ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
            )}

            {/* Execution Status Button */}
            <div className="relative">
              <button
                onClick={() => setShowExecutionPanel(!showExecutionPanel)}
                className="relative flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <span>Executions</span>
                {activeExecutions.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
                    {activeExecutions.length}
                  </span>
                )}
              </button>

              <ExecutionStatusPanel
                isOpen={showExecutionPanel}
                onClose={() => setShowExecutionPanel(false)}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
