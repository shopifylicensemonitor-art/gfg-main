import { useMemo } from 'react';
import { LayoutGrid, CheckCircle2, BarChart3, TrendingUp } from 'lucide-react';

interface LiveDashboardProps {
    sentCount: number;
    totalCount: number;
    cumulativeSent: number;
    cumulativeGenerated: number;
    count24h: number;
    weeklyStats: { day: string; date: string; count: number }[];
}

export function LiveDashboard({ sentCount, totalCount, cumulativeSent, cumulativeGenerated, count24h, weeklyStats }: LiveDashboardProps) {
    const displayTotal = cumulativeGenerated;
    const displayRemaining = totalCount - sentCount;
    const percentage = displayTotal > 0 ? Math.round((cumulativeSent / displayTotal) * 100) : 0;

    const maxWeeklyCount = useMemo(() => {
        const uniqueCounts = weeklyStats.map(d => d.count);
        return Math.max(...uniqueCounts, 10); // Minimum scale of 10 for better visuals on low counts
    }, [weeklyStats]);

    return (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <LayoutGrid className="h-4 w-4 text-primary" />
                    </div>
                    <h2 className="text-base font-semibold">Live Dashboard</h2>
                </div>
                {count24h > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                        <span className="text-[10px] font-medium text-emerald-500">Active</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-3 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Sent</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold tracking-tight text-foreground">{cumulativeSent.toLocaleString()}</span>
                            {count24h > 0 && <span className="text-xs text-emerald-500 font-medium">(+{count24h})</span>}
                        </div>
                    </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/50 p-3 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-2xl font-bold text-foreground">{displayRemaining.toLocaleString()}</p>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Remaining in List</p>
                </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/50 p-4 text-center mb-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-30" />
                <p className="text-3xl font-bold tracking-tight text-foreground">{displayTotal.toLocaleString()}</p>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-1">Total Emails Generated (Lifetime)</p>
            </div>

            {/* Enhanced Weekly Activity Chart */}
            <div className="rounded-lg border border-border/50 bg-background/30 p-4 mb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">7-Day Activity</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50">Last 7 Days</span>
                </div>

                <div className="flex items-end justify-between gap-2 h-24 pt-2">
                    {weeklyStats.map((stat, i) => {
                        const isToday = i === 6;
                        const height = Math.max(4, (stat.count / maxWeeklyCount) * 100);

                        return (
                            <div key={stat.date} className="flex-1 flex flex-col items-center gap-2 group relative">
                                {/* Tooltip */}
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                    {stat.count} emails
                                </div>

                                <div className="w-full relative flex-1 flex items-end">
                                    <div
                                        className={`w-full rounded-t-sm transition-all duration-500 ease-out 
                                            ${isToday
                                                ? 'bg-gradient-to-t from-primary/60 to-primary shadow-[0_0_10px_-2px_rgba(var(--primary),0.5)]'
                                                : 'bg-primary/20 hover:bg-primary/40'
                                            }`}
                                        style={{ height: `${height}%` }}
                                    >
                                        {stat.count > 0 && isToday && (
                                            <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/50 shadow-[0_0_5px_white]" />
                                        )}
                                    </div>
                                </div>
                                <span className={`text-[9px] font-medium uppercase tracking-wide ${isToday ? 'text-primary' : 'text-muted-foreground/60'}`}>
                                    {stat.day}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Circular Progress */}
            <div className="flex flex-col items-center justify-center p-2">
                <div className="relative h-24 w-24">
                    <div className="absolute inset-0 rounded-full border-4 border-muted/20" />
                    <svg className="h-full w-full -rotate-90 transform">
                        <circle
                            cx="48" cy="48" r="42"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${percentage * 2.64} 264`}
                            className="text-primary transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold">{percentage}%</span>
                        <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Goal</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
