import { useState, useEffect, useCallback } from 'react';

export interface TrackingLog {
  id: string;
  email: string;
  name?: string;
  storeName?: string;
  niche?: string;
  timestamp: number;
  type: 'individual' | 'bcc';
}

const STORAGE_KEY = 'peakx-outreach-logs';

export function useOutreachTracker() {
  const [logs, setLogs] = useState<TrackingLog[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addLog = useCallback((log: Omit<TrackingLog, 'id' | 'timestamp'>) => {
    setLogs(prev => {
      const newLog: TrackingLog = {
        ...log,
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now()
      };
      const updated = [newLog, ...prev].slice(0, 5000); // limit to 5000 logs to fit localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const addLogs = useCallback((newLogs: Omit<TrackingLog, 'id' | 'timestamp'>[]) => {
    setLogs(prev => {
      const timestamp = Date.now();
      const mapped = newLogs.map(l => ({
        ...l,
        id: Math.random().toString(36).substring(2, 9) + '-' + Math.random().toString(36).substring(2, 5),
        timestamp
      }));
      const updated = [...mapped, ...prev].slice(0, 5000);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteLog = useCallback((id: string) => {
    setLogs(prev => {
      const updated = prev.filter(l => l.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Real-time tab sync
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          setLogs(e.newValue ? JSON.parse(e.newValue) : []);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return { logs, addLog, addLogs, deleteLog, clearLogs };
}
