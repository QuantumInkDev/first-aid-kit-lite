import React from 'react';
import { useDashboard } from '@/hooks/useDashboard';

// Helper to format bytes to readable size
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Progress bar component
const ProgressBar: React.FC<{ value: number; className?: string }> = ({ value, className = '' }) => {
  const getColor = () => {
    if (value > 90) return 'bg-red-500';
    if (value > 75) return 'bg-yellow-500';
    return 'bg-[#00468b]';
  };

  return (
    <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
      <div
        className={`h-2 rounded-full transition-all duration-300 ${getColor()}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
};

// Password expiration helpers
const getOrdinalSuffix = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

const getExpirationColor = (days: number | null, isExpired: boolean): string => {
  if (isExpired) return 'text-red-600 font-semibold';
  if (days !== null && days <= 3) return 'text-red-600';
  if (days !== null && days <= 7) return 'text-yellow-600';
  return 'text-gray-600';
};

interface PasswordExpiration {
  expiresAt: string | null;
  daysUntilExpiration: number | null;
  isExpired: boolean;
}

const PasswordExpirationLine: React.FC<{ expiration: PasswordExpiration }> = ({ expiration }) => {
  if (!expiration.expiresAt) return null;

  const date = new Date(expiration.expiresAt);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const ordinal = getOrdinalSuffix(day);
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const days = expiration.daysUntilExpiration;

  const handlePasswordChangeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open('https://acmpm/HPM/', '_blank');
  };

  return (
    <p className={`text-sm mt-0.5 ${getExpirationColor(days, expiration.isExpired)}`}>
      Your LAN Password Expires on {dayName}, {month} {day}{ordinal}, {year} @ {time}
      {days !== null && (
        <>
          {' '}
          <a
            href="https://acmpm/HPM/"
            onClick={handlePasswordChangeClick}
            className="underline hover:text-[#00468b] cursor-pointer"
          >
            ({days} {days === 1 ? 'day' : 'days'})
          </a>
        </>
      )}
    </p>
  );
};

// Icons
const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export const SystemInfoPanel: React.FC = () => {
  const { dashboardInfo, realtimeMetrics, isLoading, error, refreshDashboard } = useDashboard();

  // Loading state
  if (isLoading && !dashboardInfo) {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-6 py-4">
          <div className="flex items-center justify-center h-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00468b] mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading system info...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !dashboardInfo) {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-6 py-4">
          <div className="flex items-center justify-center h-24">
            <div className="text-center">
              <svg className="h-8 w-8 text-red-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="mt-2 text-sm text-red-600">{error}</p>
              <button onClick={refreshDashboard} className="mt-2 text-sm text-[#00468b] hover:text-[#003366] font-medium">
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const info = dashboardInfo!;
  const metrics = realtimeMetrics;

  // Format last seen
  const formatLastSeen = () => {
    if (!info.lastSeen) return 'First visit';
    try {
      const date = new Date(info.lastSeen);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Unknown';
    }
  };

  // Network type icon
  const getNetworkIcon = () => {
    if (info.network.type === 'WiFi') {
      return (
        <svg className="w-4 h-4 text-[#00468b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-[#00468b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
      </svg>
    );
  };

  // Source indicator
  const getSourceIndicator = () => {
    if (info.userInfo.source === 'cached') {
      return <span className="text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">(cached)</span>;
    }
    if (info.userInfo.source === 'unavailable') {
      return <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">(offline)</span>;
    }
    return null;
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      {/* Header */}
      <div className="px-4 py-5 sm:p-6 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-[#00468b] rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {(() => {
                const parts = info.userInfo.displayName.split(' ');
                const firstInitial = parts[0]?.charAt(0)?.toUpperCase() || '';
                const lastInitial = parts.length > 1 ? parts[parts.length - 1]?.charAt(0)?.toUpperCase() || '' : '';
                return firstInitial + lastInitial;
              })()}
            </div>
          </div>
          <div className="ml-4">
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold text-gray-900">
                Hello, {info.userInfo.firstName || info.userInfo.displayName.split(' ')[0]}!
              </p>
              <span className="text-lg text-gray-500">EID: {info.userInfo.employeeId}</span>
              {getSourceIndicator()}
            </div>
            {info.userInfo.passwordExpiration?.expiresAt && (
              <PasswordExpirationLine expiration={info.userInfo.passwordExpiration} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Updated: {info.refreshedAt}</span>
          <button
            onClick={refreshDashboard}
            className="p-1.5 text-gray-400 hover:text-[#00468b] hover:bg-gray-100 rounded-md transition-colors"
            title="Refresh"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      {/* Content - Horizontal Layout */}
      <div className="px-4 py-5 sm:p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {/* Device & Network */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Device</p>
            <p className="text-sm font-medium text-gray-900">{info.assetSerial}</p>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              {getNetworkIcon()}
              <span>{info.network.type}</span>
              <span className="text-gray-400">|</span>
              <span className="text-xs">{info.network.ipAddress}</span>
            </div>
          </div>

          {/* Storage */}
          {info.driveSpace && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Storage (C:)</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <ProgressBar value={info.driveSpace.percentUsed} />
                </div>
                <span className="text-sm font-medium text-gray-900">{info.driveSpace.percentUsed}%</span>
              </div>
              <p className="text-xs text-gray-500">
                {formatBytes(info.driveSpace.available)} free of {formatBytes(info.driveSpace.total)}
              </p>
            </div>
          )}

          {/* Performance - RAM */}
          {metrics && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">RAM</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <ProgressBar value={metrics.ram.percentUsed} />
                </div>
                <span className="text-sm font-medium text-gray-900">{metrics.ram.percentUsed}%</span>
              </div>
              <p className="text-xs text-gray-500">
                {formatBytes(metrics.ram.used)} / {formatBytes(metrics.ram.total)}
              </p>
            </div>
          )}

          {/* Performance - CPU */}
          {metrics && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">CPU ({metrics.cpu.cores} cores)</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <ProgressBar value={metrics.cpu.percentUsed} />
                </div>
                <span className="text-sm font-medium text-gray-900">{metrics.cpu.percentUsed}%</span>
              </div>
              <p className="text-xs text-gray-500 truncate" title={`${(metrics.cpu.speed / 1000).toFixed(1)} GHz / ${metrics.cpu.model}`}>
                {(metrics.cpu.speed / 1000).toFixed(1)} GHz / {metrics.cpu.model}
              </p>
            </div>
          )}

          {/* OS Info */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Operating System</p>
            <p className="text-sm font-medium text-gray-900">{info.osVersion}</p>
            <p className="text-xs text-gray-500">{info.osBuild}</p>
          </div>

          {/* Session Status */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Uptime:</span>
              <span className="text-sm text-gray-700">{info.uptime.formatted}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Last seen:</span>
              <span className="text-sm text-gray-700">{formatLastSeen()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemInfoPanel;
