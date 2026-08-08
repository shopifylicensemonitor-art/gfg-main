import { useState, useEffect, useCallback, useMemo } from 'react';

const DAILY_COUNTER_KEY = 'peakx-daily-counter-v2';

interface DailyStats {
  [date: string]: number;
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useDailyCounter() {
  const [stats, setStats] = useState<DailyStats>({});

  // Load + Sync
  useEffect(() => {
    const load = (json: string | null) => {
      if (!json) return;
      try {
        const parsed = JSON.parse(json);
        // Keep 67 days of data (30 days for monthly view + 30 days for last month + 7 day buffer)
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 67);

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
    const today = formatDate(new Date());
    setStats(prev => {
      const newCount = (prev[today] || 0) + amount;
      const updated = { ...prev, [today]: newCount };
      localStorage.setItem(DAILY_COUNTER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Today's count
  const todayCount = stats[formatDate(new Date())] || 0;

  // Last 7 days for bar chart
  const weeklyStats = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({
        day: dayName,
        date: dateStr,
        count: stats[dateStr] || 0
      });
    }
    return days;
  }, [stats]);

  // This week total (Mon-Sun or last 7 days)
  const weekTotal = useMemo(() => {
    return weeklyStats.reduce((sum, d) => sum + d.count, 0);
  }, [weeklyStats]);

  // Last 30 days for monthly donut
  const monthlyStats = useMemo(() => {
    const days = [];
    let total = 0;
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      const count = stats[dateStr] || 0;
      total += count;
      days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        date: dateStr,
        count
      });
    }
    return { days, total };
  }, [stats]);

  // Yesterday's count
  const yesterdayCount = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return stats[formatDate(yesterday)] || 0;
  }, [stats]);

  // Last week's count (7 days prior to the last 7 days, i.e., days -13 to -7)
  const lastWeekCount = useMemo(() => {
    let total = 0;
    for (let i = 13; i >= 7; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      total += stats[formatDate(d)] || 0;
    }
    return total;
  }, [stats]);

  // Last month's count (30 days prior to the last 30 days, i.e., days -59 to -30)
  const lastMonthCount = useMemo(() => {
    let total = 0;
    for (let i = 59; i >= 30; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      total += stats[formatDate(d)] || 0;
    }
    return total;
  }, [stats]);

  return {
    count: todayCount,
    increment,
    weeklyStats,
    weekTotal,
    monthlyStats,
    yesterdayCount,
    lastWeekCount,
    lastMonthCount
  };
}
