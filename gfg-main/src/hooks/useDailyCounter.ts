import { useState, useEffect, useCallback, useMemo } from 'react';

const DAILY_COUNTER_KEY = 'peakx-daily-counter-v2';

interface DailyStats {
  [date: string]: number;
}

export function useDailyCounter() {
  const [stats, setStats] = useState<DailyStats>({});

  const getTodayDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Load + Sync
  useEffect(() => {
    const load = (json: string | null) => {
      if (!json) return;
      try {
        const parsed = JSON.parse(json);
        // Prune entries older than 30 days
        const now = new Date();
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - 30);

        const cleaned: DailyStats = {};
        Object.entries(parsed).forEach(([date, count]) => {
          if (new Date(date) > cutoff) {
            cleaned[date] = Number(count);
          }
        });
        setStats(cleaned);
      } catch {
        localStorage.removeItem(DAILY_COUNTER_KEY);
      }
    };

    load(localStorage.getItem(DAILY_COUNTER_KEY));

    const onStorage = (e: StorageEvent) => {
      if (e.key === DAILY_COUNTER_KEY) load(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const increment = useCallback((amount: number = 1) => {
    const today = getTodayDate();
    setStats(prev => {
      const newCount = (prev[today] || 0) + amount;
      const updated = { ...prev, [today]: newCount };
      localStorage.setItem(DAILY_COUNTER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const weeklyStats = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({
        day: dayName,
        date: dateStr,
        count: stats[dateStr] || 0
      });
    }
    return days;
  }, [stats]);

  return {
    count: stats[getTodayDate()] || 0,
    increment,
    weeklyStats
  };
}
