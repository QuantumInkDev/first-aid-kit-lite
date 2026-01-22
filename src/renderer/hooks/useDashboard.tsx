import { useState, useEffect, useCallback, useRef } from 'react';
import type { DashboardInfo, RealtimeMetrics } from '../../preload/preload';

interface UseDashboardResult {
  dashboardInfo: DashboardInfo | null;
  realtimeMetrics: RealtimeMetrics | null;
  isLoading: boolean;
  error: string | null;
  lastRefresh: Date | null;
  refreshDashboard: () => Promise<void>;
}

// Refresh intervals
const DASHBOARD_REFRESH_MS = 60000; // 60 seconds for full dashboard
const REALTIME_REFRESH_MS = 5000;   // 5 seconds for CPU/RAM metrics

/**
 * Hook for managing System Dashboard data with auto-refresh
 */
export const useDashboard = (): UseDashboardResult => {
  const [dashboardInfo, setDashboardInfo] = useState<DashboardInfo | null>(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState<RealtimeMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Refs for interval cleanup
  const dashboardIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch full dashboard info (slower ops: AD, BitLocker, drive space)
  const fetchDashboardInfo = useCallback(async () => {
    try {
      const info = await window.electronAPI.getDashboardInfo();
      setDashboardInfo(info);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard info:', err);
      setError('Failed to load system information');
    }
  }, []);

  // Fetch realtime metrics (fast: CPU, RAM only)
  const fetchRealtimeMetrics = useCallback(async () => {
    try {
      const metrics = await window.electronAPI.getRealtimeMetrics();
      setRealtimeMetrics(metrics);
    } catch (err) {
      console.error('Failed to fetch realtime metrics:', err);
      // Don't set error for realtime metrics - not critical
    }
  }, []);

  // Manual refresh function
  const refreshDashboard = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchDashboardInfo(), fetchRealtimeMetrics()]);
    setIsLoading(false);
  }, [fetchDashboardInfo, fetchRealtimeMetrics]);

  // Initial load and set up intervals
  useEffect(() => {
    // Initial fetch
    const initialize = async () => {
      setIsLoading(true);
      await Promise.all([fetchDashboardInfo(), fetchRealtimeMetrics()]);
      setIsLoading(false);
    };
    initialize();

    // Set up dashboard refresh interval (60 seconds)
    dashboardIntervalRef.current = setInterval(() => {
      fetchDashboardInfo();
    }, DASHBOARD_REFRESH_MS);

    // Set up realtime metrics interval (5 seconds)
    realtimeIntervalRef.current = setInterval(() => {
      fetchRealtimeMetrics();
    }, REALTIME_REFRESH_MS);

    // Cleanup on unmount
    return () => {
      if (dashboardIntervalRef.current) {
        clearInterval(dashboardIntervalRef.current);
      }
      if (realtimeIntervalRef.current) {
        clearInterval(realtimeIntervalRef.current);
      }
    };
  }, [fetchDashboardInfo, fetchRealtimeMetrics]);

  return {
    dashboardInfo,
    realtimeMetrics,
    isLoading,
    error,
    lastRefresh,
    refreshDashboard,
  };
};

export default useDashboard;
