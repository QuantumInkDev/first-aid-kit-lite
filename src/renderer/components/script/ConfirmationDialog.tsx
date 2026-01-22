import React, { useEffect, useRef, useState } from 'react';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onConfirmAndView: () => void;
  scriptId: string;
  scriptName: string;
  scriptDescription: string;
  estimatedDuration: number;
  category: string;
  order?: number;
  isFavorite?: boolean;
  onToggleFavorite?: (scriptId: string) => void;
}

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
      {isAnimating && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="absolute w-8 h-8 bg-yellow-300 rounded-full animate-ping opacity-50" />
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

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onConfirmAndView,
  scriptId,
  scriptName,
  scriptDescription,
  estimatedDuration,
  category,
  order,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      setIsAnimating(true);
      onToggleFavorite(scriptId);
      setTimeout(() => setIsAnimating(false), 600);
    }
  };

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 id="dialog-title" className="text-xl font-semibold text-gray-900">
                Execute Tool?
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Please confirm you want to run this tool
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
        <div className="px-6 py-4 space-y-4">
          {/* Script Info */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-1.5">
                {order === 0 && <PinIcon />}
                {scriptName}
              </h3>
              {onToggleFavorite && (
                <FavoriteStar
                  isFavorite={isFavorite}
                  onClick={handleFavoriteClick}
                  isAnimating={isAnimating}
                />
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">{scriptDescription}</p>
            <div className="flex items-center text-sm text-gray-500 mt-3">
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

          {/* Info Notice */}
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
                  This tool will run with your current user context. You can monitor progress in the Active Runs panel.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-medium border-2 border-red-400 text-red-600 bg-white hover:bg-red-50 hover:border-red-500 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-medium border-2 border-[#00468b] text-[#00468b] bg-white hover:bg-blue-50 cursor-pointer transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Run
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmAndView();
              onClose();
            }}
            className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-medium bg-[#00468b] hover:bg-[#003d79] text-white cursor-pointer transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Run &amp; View Output
          </button>
        </div>
      </div>
    </div>
  );
};
