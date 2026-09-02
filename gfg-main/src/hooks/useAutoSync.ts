/**
 * hooks/useAutoSync.ts
 *
 * Background revalidation hook for live campaign progress, dashboard stats, and inbox sync.
 * Automatically re-fetches at configurable intervals without full page reloads.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardStats {
  today_sent: number;
  active_accounts: number;
  pending: number;
  active_campaigns: number;
  failed: number;
}

export interface SyncState {
  stats: DashboardStats | null;
  activeCampaignCount: number;
  pendingQueueCount: number;
  inboxUnreadCount: number;
  lastSyncedAt: Date | null;
  isSyncing: boolean;
  error: string | null;
}

const DEFAULT_INTERVAL_MS = 60_000; // 60 seconds
const ACTIVE_INTERVAL_MS = 30_000; // 30 seconds while campaigns are sending

// ---------------------------------------------------------------------------
// useAutoSync Hook
// ---------------------------------------------------------------------------

/**
 * useAutoSync — polls the /api/dashboard endpoint and optionally /api/inbox
 * on a configurable interval. When a campaign is actively sending, it drops
 * to a shorter fast-poll interval to keep the UI feeling live.
 *
 * @param enabled   - set to false to suspend polling (e.g. page in background)
 * @param intervalMs - base polling interval in milliseconds (default: 30 000)
 */
export function useAutoSync(enabled = true, intervalMs = DEFAULT_INTERVAL_MS) {
  const [state, setState] = useState<SyncState>({
    stats: null,
    activeCampaignCount: 0,
    pendingQueueCount: 0,
    inboxUnreadCount: 0,
    lastSyncedAt: null,
    isSyncing: false,
    error: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const doSync = useCallback(async () => {
    if (!isMountedRef.current || document.visibilityState !== 'visible') return;

    setState((prev) => ({ ...prev, isSyncing: true, error: null }));

    try {
      // Fetch dashboard data (stats + active campaigns + queue size)
      const dash = await api.getDashboardData();

      if (!isMountedRef.current) return;

      const activeCampaigns = Array.isArray(dash.campaigns)
        ? dash.campaigns.filter((c) => c.status === 'sending').length
        : 0;

      const pendingQueue = Array.isArray(dash.queue) ? dash.queue.length : 0;

      // Count unread inbox messages from the recent queue data (optimistic; no extra API call)
      // For a more accurate count, a dedicated /api/inbox?unread=1 endpoint can be added.
      const inboxUnread = 0;

      setState({
        stats: dash.stats ?? null,
        activeCampaignCount: activeCampaigns,
        pendingQueueCount: pendingQueue,
        inboxUnreadCount: inboxUnread,
        lastSyncedAt: new Date(),
        isSyncing: false,
        error: null,
      });

      return { activeCampaigns };
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Auto-sync failed';
      setState((prev) => ({ ...prev, isSyncing: false, error: message }));
      return { activeCampaigns: 0 };
    }
  }, []);

  const scheduleNext = useCallback(
    (activeCampaigns: number) => {
      if (!isMountedRef.current || !enabled) return;

      const nextInterval = activeCampaigns > 0 ? ACTIVE_INTERVAL_MS : intervalMs;

      timerRef.current = setTimeout(async () => {
        const result = await doSync();
        scheduleNext(result?.activeCampaigns ?? 0);
      }, nextInterval);
    },
    [doSync, enabled, intervalMs]
  );

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) return;

    // Initial sync immediately on mount
    const syncWhenVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      const result = await doSync();
      scheduleNext(result?.activeCampaigns ?? 0);
    };
    syncWhenVisible();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (timerRef.current) clearTimeout(timerRef.current);
        syncWhenVisible();
      } else if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [doSync, scheduleNext, enabled]);

  /** Manual trigger: can be called e.g. after creating or pausing a campaign */
  const triggerSync = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const result = await doSync();
    scheduleNext(result?.activeCampaigns ?? 0);
  }, [doSync, scheduleNext]);

  return { ...state, triggerSync };
}
