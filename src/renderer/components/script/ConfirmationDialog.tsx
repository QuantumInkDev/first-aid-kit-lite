import React, { useEffect, useRef } from 'react';
import { RiskBadge } from '../common/Badge';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  scriptName: string;
  scriptDescription: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiredPermissions: string[];
  estimatedDuration: number;
  category: string;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  scriptName,
  scriptDescription,
  riskLevel,
  requiredPermissions,
  estimatedDuration,
  category,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  // Get risk level details
  const getRiskDetails = () => {
    switch (riskLevel) {
      case 'low':
        return {
          color: 'text-green-700',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: (
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          title: 'Low Risk',
          description: 'This script performs safe operations with minimal system impact.',
        };
      case 'medium':
        return {
          color: 'text-yellow-700',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          icon: (
            <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          title: 'Medium Risk',
          description: 'This script may modify system settings. Please review the details carefully.',
        };
      case 'high':
        return {
          color: 'text-red-700',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: (
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          title: 'High Risk',
          description: 'This script performs critical operations. Make sure you understand the impact before proceeding.',
        };
    }
  };

  const riskDetails = getRiskDetails();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 id="dialog-title" className="text-xl font-semibold text-gray-900">
                Execute Script?
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Please review the script details before executing
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-500 transition-colors"
              aria-label="Close dialog"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Script Info */}
          <div>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">{scriptName}</h3>
                <p className="text-sm text-gray-600 mt-1">{scriptDescription}</p>
              </div>
              <RiskBadge level={riskLevel} className="ml-4 flex-shrink-0" />
            </div>
            <div className="flex items-center text-sm text-gray-500 mt-2">
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              {category}
              <span className="mx-2">•</span>
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Est. {formatDuration(estimatedDuration)}
            </div>
          </div>

          {/* Risk Assessment */}
          <div className={cn('rounded-lg border-2 p-4', riskDetails.bgColor, riskDetails.borderColor)}>
            <div className="flex items-start">
              <div className="flex-shrink-0">{riskDetails.icon}</div>
              <div className="ml-3">
                <h4 className={cn('text-sm font-semibold', riskDetails.color)}>
                  {riskDetails.title}
                </h4>
                <p className={cn('text-sm mt-1', riskDetails.color)}>
                  {riskDetails.description}
                </p>
              </div>
            </div>
          </div>

          {/* Required Permissions */}
          {requiredPermissions.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5"
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
                <div className="ml-3 flex-1">
                  <h4 className="text-sm font-semibold text-gray-900">Required Permissions</h4>
                  <ul className="mt-2 space-y-1">
                    {requiredPermissions.map((permission, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-center">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                        {permission}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Warning Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This script will be executed with your current user permissions.
                  {riskLevel === 'high' && ' It is recommended to create a system restore point before proceeding.'}
                  {riskLevel === 'medium' && ' Make sure to save any unsaved work before executing.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              riskLevel === 'high' && 'bg-red-600 hover:bg-red-700',
              riskLevel === 'medium' && 'bg-yellow-600 hover:bg-yellow-700',
              riskLevel === 'low' && 'bg-green-600 hover:bg-green-700'
            )}
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            Execute Script
          </Button>
        </div>
      </div>
    </div>
  );
};
