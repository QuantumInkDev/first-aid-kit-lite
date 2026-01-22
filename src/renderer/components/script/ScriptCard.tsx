import React, { useState } from 'react';
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
  isFavorite?: boolean;
  order?: number;
  onExecute: (scriptId: string) => void;
  onToggleFavorite?: (scriptId: string) => void;
}

// Animated Star Component
const FavoriteStar: React.FC<{
  isFavorite: boolean;
  onClick: (e: React.MouseEvent) => void;
  isAnimating: boolean;
}> = ({ isFavorite, onClick, isAnimating }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative p-1.5 rounded-full transition-all duration-200
        hover:bg-yellow-50 hover:scale-110 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1
        ${isAnimating ? 'animate-bounce' : ''}
      `}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      {/* Burst effect on click */}
      {isAnimating && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="absolute w-8 h-8 bg-yellow-300 rounded-full animate-ping opacity-50" />
          {/* Sparkle particles */}
          <span className="absolute w-1 h-1 bg-yellow-400 rounded-full animate-sparkle-1" style={{ top: '0', left: '50%' }} />
          <span className="absolute w-1 h-1 bg-yellow-400 rounded-full animate-sparkle-2" style={{ top: '50%', right: '0' }} />
          <span className="absolute w-1 h-1 bg-yellow-400 rounded-full animate-sparkle-3" style={{ bottom: '0', left: '50%' }} />
          <span className="absolute w-1 h-1 bg-yellow-400 rounded-full animate-sparkle-4" style={{ top: '50%', left: '0' }} />
        </span>
      )}

      <svg
        className={`
          w-5 h-5 transition-all duration-300 ease-out
          ${isFavorite
            ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]'
            : 'text-gray-300 fill-transparent hover:text-yellow-300'
          }
          ${isAnimating ? 'scale-125' : ''}
        `}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    </button>
  );
};

// Pin Icon Component
const PinIcon: React.FC = () => (
  <svg
    className="w-4 h-4 text-[#00468b]"
    fill="currentColor"
    viewBox="0 0 24 24"
    title="Pinned"
  >
    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
  </svg>
);

export const ScriptCard: React.FC<ScriptCardProps> = ({
  id,
  name,
  description,
  category,
  estimatedDuration,
  executionStatus,
  isFavorite = false,
  order,
  onExecute,
  onToggleFavorite,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `~${minutes}m`;
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      setIsAnimating(true);
      onToggleFavorite(id);
      // Reset animation after it completes
      setTimeout(() => setIsAnimating(false), 600);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow relative">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-2">
            <CardTitle>
              <span className="flex items-center gap-1.5">
                {order === 0 && <PinIcon />}
                {name}
              </span>
            </CardTitle>
            <CardDescription className="line-clamp-3 min-h-[3.75rem]">{description}</CardDescription>
          </div>
          {onToggleFavorite && (
            <FavoriteStar
              isFavorite={isFavorite}
              onClick={handleFavoriteClick}
              isAnimating={isAnimating}
            />
          )}
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

      {/* CSS for sparkle animations */}
      <style>{`
        @keyframes sparkle-1 {
          0% { transform: translate(-50%, 0) scale(0); opacity: 1; }
          100% { transform: translate(-50%, -12px) scale(1); opacity: 0; }
        }
        @keyframes sparkle-2 {
          0% { transform: translate(0, -50%) scale(0); opacity: 1; }
          100% { transform: translate(12px, -50%) scale(1); opacity: 0; }
        }
        @keyframes sparkle-3 {
          0% { transform: translate(-50%, 0) scale(0); opacity: 1; }
          100% { transform: translate(-50%, 12px) scale(1); opacity: 0; }
        }
        @keyframes sparkle-4 {
          0% { transform: translate(0, -50%) scale(0); opacity: 1; }
          100% { transform: translate(-12px, -50%) scale(1); opacity: 0; }
        }
        .animate-sparkle-1 { animation: sparkle-1 0.4s ease-out forwards; }
        .animate-sparkle-2 { animation: sparkle-2 0.4s ease-out 0.05s forwards; }
        .animate-sparkle-3 { animation: sparkle-3 0.4s ease-out 0.1s forwards; }
        .animate-sparkle-4 { animation: sparkle-4 0.4s ease-out 0.15s forwards; }
      `}</style>
    </Card>
  );
};
