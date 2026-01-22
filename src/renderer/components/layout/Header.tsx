import React from 'react';
import { Badge } from '../common/Badge';
import { useScriptExecution } from '@/hooks/useScriptExecution';
import { ExecutionStatusPanel } from '../execution/ExecutionStatusPanel';
import companyLogo from '@assets/HBCBSNJ.png';
import appLogo from '@assets/fakl.png';

export const Header: React.FC = () => {
  const { activeExecutions, showPanel, openPanel, closePanel } = useScriptExecution();

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
              alt="First Aid Kit"
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-3xl font-bold text-primary">First Aid Kit</h1>
            </div>
            <Badge variant="info" className="ml-2">
              v{__APP_VERSION__}
            </Badge>
          </div>

          <div className="flex items-center space-x-4">
            {/* Active Runs Button */}
            <div className="relative">
              <button
                onClick={() => showPanel ? closePanel() : openPanel()}
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
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Active Runs</span>
                {activeExecutions.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary rounded-full">
                    {activeExecutions.length}
                  </span>
                )}
              </button>

              <ExecutionStatusPanel
                isOpen={showPanel}
                onClose={closePanel}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
