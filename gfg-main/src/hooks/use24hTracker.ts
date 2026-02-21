import { useState, useEffect, useCallback } from 'react';

const TRACKER_24H_KEY = 'peakx-24h-tracker';
const DAY_MS = 24 * 60 * 60 * 1000;

export function use24hTracker() {
    const [timestamps, setTimestamps] = useState<number[]>([]);

    // Load and prune old timestamps on mount + cross-tab sync
    useEffect(() => {
        const load = (json: string | null) => {
            if (!json) return;
            try {
                const data: number[] = JSON.parse(json);
                const cutoff = Date.now() - DAY_MS;
                setTimestamps(data.filter(t => t > cutoff));
            } catch {
                localStorage.removeItem(TRACKER_24H_KEY);
            }
        };

        load(localStorage.getItem(TRACKER_24H_KEY));

        const onStorage = (e: StorageEvent) => {
            if (e.key === TRACKER_24H_KEY) load(e.newValue);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const trackClick = useCallback(() => {
        const now = Date.now();
        const cutoff = now - DAY_MS;
        setTimestamps(prev => {
            const updated = [...prev.filter(t => t > cutoff), now];
            localStorage.setItem(TRACKER_24H_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    return { count: timestamps.length, trackClick };
}
