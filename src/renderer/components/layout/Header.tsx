import React, { useState } from 'react';
import { Badge } from '../common/Badge';
import { useScriptExecution } from '@/hooks/useScriptExecution';
import { ExecutionStatusPanel } from '../execution/ExecutionStatusPanel';
import companyLogo from '@assets/HBCBSNJ.png';
import appLogo from '@assets/fakl.png';

export const Header: React.FC = () => {
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const { activeExecutions } = useScriptExecution();

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Company Logo */}
            <img
              src={companyLogo}
              alt="HBC BSN J"
              className="h-10 w-auto"
            />
            {/* App Logo */}
            <img
              src={appLogo}
              alt="First Aid Kit Lite"
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-3xl font-bold text-primary">First Aid Kit Lite</h1>
            </div>
            <Badge variant="info" className="ml-2">
              v0.1.0-alpha
            </Badge>
          </div>

          <div className="flex items-center space-x-4">
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
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary rounded-full">
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
