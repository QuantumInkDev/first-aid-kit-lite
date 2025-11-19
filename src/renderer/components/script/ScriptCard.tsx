import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../common/Card';
import { RiskBadge } from '../common/Badge';
import { Button } from '../ui/button';
import { ExecutionStatusBadge } from '../execution/ExecutionStatusBadge';
import type { ScriptExecution } from '@/hooks/useScriptExecution';

export interface ScriptCardProps {
  id: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  category: string;
  estimatedDuration: number;
  requiredPermissions: string[];
  executionStatus?: ScriptExecution['status'];
  onExecute: (scriptId: string) => void;
}

export const ScriptCard: React.FC<ScriptCardProps> = ({
  id,
  name,
  description,
  riskLevel,
  category,
  estimatedDuration,
  requiredPermissions,
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
          <RiskBadge level={riskLevel} className="ml-4 flex-shrink-0" />
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

          {requiredPermissions.length > 0 && (
            <div className="flex items-start text-sm text-gray-600">
              <svg
                className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <div className="flex-1">
                <span className="block font-medium">Permissions:</span>
                <span className="text-xs text-gray-500">
                  {requiredPermissions.join(', ')}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {executionStatus && <ExecutionStatusBadge status={executionStatus} size="sm" />}
          </div>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onExecute(id);
            }}
            className="ml-auto"
            disabled={executionStatus === 'running' || executionStatus === 'pending'}
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {executionStatus === 'running' || executionStatus === 'pending' ? 'Running...' : 'Execute'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
