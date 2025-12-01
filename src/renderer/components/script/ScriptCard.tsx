import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../common/Card';
import { ExecutionStatusBadge } from '../execution/ExecutionStatusBadge';
import type { ScriptExecution } from '@/hooks/useScriptExecution';

export interface ScriptCardProps {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedDuration: number;
  executionStatus?: ScriptExecution['status'];
  onExecute: (scriptId: string) => void;
}

export const ScriptCard: React.FC<ScriptCardProps> = ({
  id,
  name,
  description,
  category,
  estimatedDuration,
  executionStatus,
  onExecute,
}) => {
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `~${minutes}m`;
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="group-hover:text-blue-600 transition-colors">
              {name}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center text-sm text-gray-600">
            <svg
              className="w-4 h-4 mr-2 text-gray-400"
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
            <span className="font-medium">{category}</span>
          </div>

          <div className="flex items-center text-sm text-gray-600">
            <svg
              className="w-4 h-4 mr-2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Est. {formatDuration(estimatedDuration)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {executionStatus && <ExecutionStatusBadge status={executionStatus} size="sm" />}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExecute(id);
            }}
            disabled={executionStatus === 'running' || executionStatus === 'pending'}
            className="ml-auto inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium bg-[#00468b] hover:bg-[#003d79] text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-4 h-4 mr-1.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            {executionStatus === 'running' || executionStatus === 'pending' ? 'Running...' : 'Run'}
          </button>
        </div>
      </CardFooter>
    </Card>
  );
};
