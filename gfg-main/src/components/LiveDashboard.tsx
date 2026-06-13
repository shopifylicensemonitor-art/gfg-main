import { useState, useMemo } from 'react';
import { LayoutGrid, CheckCircle2, BarChart3, TrendingUp, Activity, List, PieChart, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AnalyticsTab = 'daily' | 'weekly' | 'monthly';

interface MonthlyStats {
    days: { label: string; date: string; count: number }[];
    total: number;
}

interface LiveDashboardProps {
    sentCount: number;
    totalCount: number;
    cumulativeSent: number;
    cumulativeGenerated: number;
    count24h: number;
    weeklyStats: { day: string; date: string; count: number }[];
    weekTotal: number;
    todayCount: number;
    monthlyStats: MonthlyStats;
    timestamps: number[];
    yesterdayCount: number;
    lastWeekCount: number;
    lastMonthCount: number;
}

// Donut chart colors
const DONUT_COLORS = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

function DonutChart({ data }: { data: { label: string; count: number; color: string; pct: number }[] }) {
    const [hovered, setHovered] = useState<number | null>(null);
    const total = data.reduce((s, d) => s + d.count, 0);
    const radius = 70;
    const strokeWidth = 22;
    const circumference = 2 * Math.PI * radius;

    // Build segments
    let accumulated = 0;
    const segments = data.map((d, i) => {
        const pct = total > 0 ? d.count / total : 0;
        const dashLen = pct * circumference;
        const gap = circumference - dashLen;
        const offset = -accumulated * circumference + circumference * 0.25; // start from top
        accumulated += pct;
        return { ...d, dashLen, gap, offset, index: i };
    });

    return (
        <div className="relative flex flex-col items-center">
            <svg width="180" height="180" viewBox="0 0 180 180" className="transform -rotate-90">
                {/* Background ring */}
                <circle cx="90" cy="90" r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
                    className="text-muted/10" />
                {/* Data segments */}
                {segments.map((seg) => (
                    <circle
                        key={seg.index}
                        cx="90" cy="90" r={radius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={hovered === seg.index ? strokeWidth + 4 : strokeWidth}
                        strokeDasharray={`${seg.dashLen} ${seg.gap}`}
                        strokeDashoffset={seg.offset}
                        className="transition-all duration-300 cursor-pointer"
                        style={{ opacity: hovered !== null && hovered !== seg.index ? 0.4 : 1 }}
                        onMouseEnter={() => setHovered(seg.index)}
                        onMouseLeave={() => setHovered(null)}
                    />
                ))}
            </svg>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {hovered !== null ? (
                    <>
                        <span className="text-xl font-bold">{data[hovered].count.toLocaleString()}</span>
                        <span className="text-[9px] text-muted-foreground max-w-[80px] text-center leading-tight">{data[hovered].label}</span>
                    </>
                ) : (
                    <>
                        <span className="text-2xl font-bold">{total.toLocaleString()}</span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Total</span>
                    </>
                )}
            </div>
        </div>
    );
}

function DonutLegend({ data }: { data: { label: string; count: number; color: string; pct: number }[] }) {
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4 border-b border-border/20 pb-3">
            {data.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-muted-foreground truncate">{d.label}</span>
                    <span className="ml-auto font-semibold text-foreground">{d.pct}%</span>
                </div>
            ))}
        </div>
    );
}

// Custom Premium SVG Line Chart
function SVGLineChart({ data, maxVal }: { data: { label: string; count: number }[]; maxVal: number }) {
    const width = 500;
    const height = 120;
    const padding = 15;
    
    const points = data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - (maxVal > 0 ? (d.count / maxVal) : 0) * (height - 2 * padding);
        return { x, y, label: d.label, count: d.count };
    });
    
    const pathD = points.reduce((acc, p, i) => {
        return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');
    
    const areaD = points.length > 0 
        ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z` 
        : '';
        
    return (
        <div className="w-full relative group py-1">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible">
                <defs>
                    <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.00" />
                    </linearGradient>
                </defs>
                
                {/* Horizontal grid lines */}
                {[0, 0.5, 1].map((r, idx) => {
                    const y = padding + r * (height - 2 * padding);
                    return (
                        <line 
                            key={idx} 
                            x1={padding} 
                            y1={y} 
                            x2={width - padding} 
                            y2={y} 
                            stroke="currentColor" 
                            strokeWidth="0.5" 
                            strokeDasharray="4 4" 
                            className="text-muted-foreground/15" 
                        />
                    );
                })}
                
                {/* Area under line */}
                {areaD && <path d={areaD} fill="url(#chart-area-grad)" className="transition-all duration-300 hidden sm:block" />}
                
                {/* Main line path */}
                {pathD && (
                    <path 
                        d={pathD} 
                        fill="none" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        className="transition-all duration-300"
                    />
                )}
                
                {/* Dots and interactive tooltips */}
                {points.map((p, idx) => (
                    <g key={idx} className="group/dot cursor-pointer">
                        <circle 
                            cx={p.x} 
                            cy={p.y} 
                            r="4" 
                            fill="hsl(var(--background))" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth="2.5" 
                            className="transition-all duration-200 group-hover/dot:r-5 group-hover/dot:fill-primary"
                        />
                        <title>{`${p.label}: ${p.count} emails`}</title>
                    </g>
                ))}
            </svg>
            <div className="flex justify-between text-[8px] text-muted-foreground/80 font-semibold px-1 mt-1 font-mono">
                <span>{data[0]?.label}</span>
                <span>{data[Math.floor(data.length / 2)]?.label}</span>
                <span>{data[data.length - 1]?.label}</span>
            </div>
        </div>
    );
}

// Custom Premium SVG Bar Chart
function SVGBarChart({ data, maxVal }: { data: { label: string; count: number }[]; maxVal: number }) {
    const width = 500;
    const height = 120;
    const padding = 15;
    const barSpacing = data.length > 15 ? 2 : 5;
    const chartWidth = width - 2 * padding;
    const barWidth = (chartWidth - barSpacing * (data.length - 1)) / data.length;
    
    return (
        <div className="w-full relative group py-1">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible">
                {/* Horizontal grid lines */}
                {[0, 0.5, 1].map((r, idx) => {
                    const y = padding + r * (height - 2 * padding);
                    return (
                        <line 
                            key={idx} 
                            x1={padding} 
                            y1={y} 
                            x2={width - padding} 
                            y2={y} 
                            stroke="currentColor" 
                            strokeWidth="0.5" 
                            strokeDasharray="4 4" 
                            className="text-muted-foreground/15" 
                        />
                    );
                })}
                
                {/* Bars */}
                {data.map((d, i) => {
                    const x = padding + i * (barWidth + barSpacing);
                    const barHeight = (maxVal > 0 ? (d.count / maxVal) : 0) * (height - 2 * padding);
                    const y = height - padding - barHeight;
                    const hasActive = d.count > 0;
                    
                    return (
                        <g key={i} className="group/bar cursor-pointer">
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(2, barHeight)}
                                rx={Math.max(1, Math.min(2, barWidth / 2))}
                                className={`transition-all duration-300 ${
                                    hasActive 
                                        ? "fill-primary hover:fill-primary/80" 
                                        : "fill-muted-foreground/10 hover:fill-muted-foreground/20"
                                }`}
                            />
                            <title>{`${d.label}: ${d.count} emails`}</title>
                        </g>
                    );
                })}
            </svg>
            <div className="flex justify-between text-[8px] text-muted-foreground/80 font-semibold px-1 mt-1 font-mono">
                <span>{data[0]?.label}</span>
                <span>{data[Math.floor(data.length / 2)]?.label}</span>
                <span>{data[data.length - 1]?.label}</span>
            </div>
        </div>
    );
}

export function LiveDashboard({
    sentCount, totalCount, cumulativeSent, cumulativeGenerated,
    count24h, weeklyStats, weekTotal, todayCount, monthlyStats, timestamps,
    yesterdayCount, lastWeekCount, lastMonthCount
}: LiveDashboardProps) {
    const [activeTab, setActiveTab] = useState<AnalyticsTab>('weekly');
    const [dailyViewType, setDailyViewType] = useState<'progress' | 'chart'>('progress');
    const [chartType, setChartType] = useState<'line' | 'bar' | 'pie'>(() => {
        return (localStorage.getItem('peakx-dashboard-chart-type') as 'line' | 'bar' | 'pie') || 'bar';
    });

    // Outreach Goal Targets & Persistence
    const [dailyTarget, setDailyTarget] = useState<number>(() => {
        return Number(localStorage.getItem('peakx-daily-target')) || 50;
    });
    const [monthlyTarget, setMonthlyTarget] = useState<number>(() => {
        return Number(localStorage.getItem('peakx-monthly-target')) || 1500;
    });
    const [dailyTargetUpdatedAt, setDailyTargetUpdatedAt] = useState<number | null>(() => {
        const stored = localStorage.getItem('peakx-daily-target-updated-at');
        return stored ? Number(stored) : null;
    });

    const [isEditingTargets, setIsEditingTargets] = useState(false);
    const [tempDailyTarget, setTempDailyTarget] = useState(dailyTarget);
    const [tempMonthlyTarget, setTempMonthlyTarget] = useState(monthlyTarget);

    const canChangeDailyTarget = useMemo(() => {
        if (!dailyTargetUpdatedAt) return true;
        const lastUpdateDate = new Date(dailyTargetUpdatedAt).toDateString();
        const todayDate = new Date().toDateString();
        return lastUpdateDate !== todayDate;
    }, [dailyTargetUpdatedAt]);

    const handleSaveTargets = () => {
        const dTarget = Number(tempDailyTarget);
        const mTarget = Number(tempMonthlyTarget);

        if (isNaN(dTarget) || dTarget <= 0 || isNaN(mTarget) || mTarget <= 0) {
            toast({
                title: "Invalid Input",
                description: "Target values must be positive integers.",
                variant: "destructive"
            });
            return;
        }

        let dailyChanged = false;
        if (dTarget !== dailyTarget) {
            if (!canChangeDailyTarget) {
                toast({
                    title: "Action Locked",
                    description: "Daily target can only be changed once a day. You have already changed it today!",
                    variant: "destructive"
                });
                return;
            }
            localStorage.setItem('peakx-daily-target', dTarget.toString());
            localStorage.setItem('peakx-daily-target-updated-at', Date.now().toString());
            setDailyTarget(dTarget);
            setDailyTargetUpdatedAt(Date.now());
            dailyChanged = true;
        }

        localStorage.setItem('peakx-monthly-target', mTarget.toString());
        setMonthlyTarget(mTarget);
        setIsEditingTargets(false);

        toast({
            title: "🎯 Targets Saved Successfully",
            description: dailyChanged 
                ? `Set Daily Target to ${dTarget} (locked for today) and Monthly to ${mTarget}.`
                : `Set Monthly Target to ${mTarget}. Daily target remains unchanged.`
        });
    };

    const displayTotal = cumulativeGenerated;
    const displayRemaining = totalCount - sentCount;
    const percentage = displayTotal > 0 ? Math.round((cumulativeSent / displayTotal) * 100) : 0;

    const maxWeeklyCount = useMemo(() => {
        return Math.max(...weeklyStats.map(d => d.count), 10);
    }, [weeklyStats]);

    // Group 24h timestamps into hourly bins relative to the current hour
    const hourly24hData = useMemo(() => {
        const buckets = Array(24).fill(0);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        timestamps.forEach(t => {
            const age = now - t;
            if (age >= 0 && age < 24 * oneHour) {
                const bucketIndex = 23 - Math.floor(age / oneHour);
                if (bucketIndex >= 0 && bucketIndex < 24) {
                    buckets[bucketIndex]++;
                }
            }
        });
        
        return buckets.map((count, i) => {
            const dateObj = new Date(now - (23 - i) * oneHour);
            const hourVal = dateObj.getHours();
            const label = `${hourVal.toString().padStart(2, '0')}:00`;
            return { label, count };
        });
    }, [timestamps]);

    const maxHourlyCount = useMemo(() => {
        return Math.max(...hourly24hData.map(d => d.count), 1);
    }, [hourly24hData]);

    const hourlyStatsSummary = useMemo(() => {
        let maxCount = -1;
        let maxLabel = 'N/A';
        let minCount = Infinity;
        let minLabel = 'N/A';
        let hasData = false;

        hourly24hData.forEach(d => {
            if (d.count > 0) hasData = true;
            if (d.count > maxCount) {
                maxCount = d.count;
                maxLabel = d.label;
            }
            if (d.count < minCount) {
                minCount = d.count;
                minLabel = d.label;
            }
        });

        return {
            highest: hasData ? `${maxLabel} (${maxCount})` : 'N/A',
            lowest: hasData ? `${minLabel} (${minCount === Infinity ? 0 : minCount})` : 'N/A',
            hasData
        };
    }, [hourly24hData]);

    // Top days for donut chart (top 7 days with most activity from last 30)
    const donutData = useMemo(() => {
        const activeDays = monthlyStats.days.filter(d => d.count > 0);
        if (activeDays.length === 0) return [];

        const sorted = [...activeDays].sort((a, b) => b.count - a.count);
        const top = sorted.slice(0, 7);
        const othersCount = sorted.slice(7).reduce((s, d) => s + d.count, 0);
        const total = monthlyStats.total;

        const items = top.map((d, i) => ({
            label: d.label,
            count: d.count,
            color: DONUT_COLORS[i % DONUT_COLORS.length],
            pct: total > 0 ? Math.round((d.count / total) * 100) : 0
        }));

        if (othersCount > 0) {
            items.push({
                label: 'Others',
                count: othersCount,
                color: '#6b7280',
                pct: total > 0 ? Math.round((othersCount / total) * 100) : 0
            });
        }

        return items;
    }, [monthlyStats]);

    // Weekly donut data
    const weeklyDonutData = useMemo(() => {
        const total = weeklyStats.reduce((s, d) => s + d.count, 0);
        return weeklyStats.map((d, i) => ({
            label: d.day,
            count: d.count,
            color: DONUT_COLORS[i % DONUT_COLORS.length],
            pct: total > 0 ? Math.round((d.count / total) * 100) : 0
        })).filter(d => d.count > 0);
    }, [weeklyStats]);

    // Daily donut data (grouped active hours)
    const dailyDonutData = useMemo(() => {
        const activeHours = hourly24hData.filter(d => d.count > 0);
        const total = activeHours.reduce((s, d) => s + d.count, 0);
        if (activeHours.length === 0) return [];
        const sorted = [...activeHours].sort((a, b) => b.count - a.count);
        const top = sorted.slice(0, 7);
        const othersCount = sorted.slice(7).reduce((s, d) => s + d.count, 0);
        
        const items = top.map((d, i) => ({
            label: d.label,
            count: d.count,
            color: DONUT_COLORS[i % DONUT_COLORS.length],
            pct: total > 0 ? Math.round((d.count / total) * 100) : 0
        }));
        
        if (othersCount > 0) {
            items.push({
                label: 'Other Hours',
                count: othersCount,
                color: '#6b7280',
                pct: total > 0 ? Math.round((othersCount / total) * 100) : 0
            });
        }
        return items;
    }, [hourly24hData]);

    const maxMonthlyCount = useMemo(() => {
        return Math.max(...monthlyStats.days.map(d => d.count), 1);
    }, [monthlyStats.days]);

    const { todayDiff, weekDiff, monthDiff } = useMemo(() => {
        let tDiff = 0;
        if (yesterdayCount === 0) {
            tDiff = todayCount > 0 ? 100 : 0;
        } else {
            tDiff = Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);
        }
        
        let wDiff = 0;
        if (lastWeekCount === 0) {
            wDiff = weekTotal > 0 ? 100 : 0;
        } else {
            wDiff = Math.round(((weekTotal - lastWeekCount) / lastWeekCount) * 100);
        }
        
        let mDiff = 0;
        if (lastMonthCount === 0) {
            mDiff = monthlyStats.total > 0 ? 100 : 0;
        } else {
            mDiff = Math.round(((monthlyStats.total - lastMonthCount) / lastMonthCount) * 100);
        }
        
        return { todayDiff: tDiff, weekDiff: wDiff, monthDiff: mDiff };
    }, [todayCount, yesterdayCount, weekTotal, lastWeekCount, monthlyStats.total, lastMonthCount]);

    const tabs: { key: AnalyticsTab; label: string }[] = [
        { key: 'daily', label: 'Daily' },
        { key: 'weekly', label: 'Weekly' },
        { key: 'monthly', label: 'Monthly' },
    ];

    return (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
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

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background p-3 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Sent</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold tracking-tight">{cumulativeSent.toLocaleString()}</span>
                            {count24h > 0 && <span className="text-xs text-emerald-500 font-medium">(+{count24h})</span>}
                        </div>
                    </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-background p-3 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                    <p className="text-2xl font-bold">{displayRemaining.toLocaleString()}</p>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Remaining</p>
                </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-background p-4 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent hidden sm:block" />
                <p className="text-3xl font-bold tracking-tight">{displayTotal.toLocaleString()}</p>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-1">Total Generated (Lifetime)</p>
            </div>

            {/* Analytics & Insights Section */}
            <div className="rounded-lg border border-border/50 bg-background sm:bg-background/30 p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary/70" />
                        <span className="text-sm font-semibold">Analytics &amp; Insights</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-4 bg-muted/30 rounded-lg p-1 w-fit">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                                ${activeTab === tab.key
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Summary Cards Row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className={`rounded-lg border p-3 text-center transition-all duration-200 flex flex-col justify-between items-center ${activeTab === 'daily' ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-border/50 bg-background'}`}>
                        <div>
                            <p className="text-xl sm:text-2xl font-bold tracking-tight text-primary">{todayCount.toLocaleString()}</p>
                            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Today</p>
                        </div>
                        <div className="mt-1.5 flex items-center justify-center shrink-0">
                            <Badge 
                                variant="outline" 
                                className={`text-[8px] h-4.5 px-1 font-mono font-medium border-none shadow-none leading-none shrink-0 ${
                                    todayDiff >= 0 
                                        ? 'text-emerald-500 bg-emerald-500/[0.06]' 
                                        : 'text-destructive bg-destructive/[0.06]'
                                }`}
                            >
                                {todayDiff >= 0 ? `+${todayDiff}%` : `${todayDiff}%`} DoD
                            </Badge>
                        </div>
                    </div>
                    <div className={`rounded-lg border p-3 text-center transition-all duration-200 flex flex-col justify-between items-center ${activeTab === 'weekly' ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-border/50 bg-background'}`}>
                        <div>
                            <p className="text-xl sm:text-2xl font-bold tracking-tight text-primary">{weekTotal.toLocaleString()}</p>
                            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">This Week</p>
                        </div>
                        <div className="mt-1.5 flex items-center justify-center shrink-0">
                            <Badge 
                                variant="outline" 
                                className={`text-[8px] h-4.5 px-1 font-mono font-medium border-none shadow-none leading-none shrink-0 ${
                                    weekDiff >= 0 
                                        ? 'text-emerald-500 bg-emerald-500/[0.06]' 
                                        : 'text-destructive bg-destructive/[0.06]'
                                }`}
                            >
                                {weekDiff >= 0 ? `+${weekDiff}%` : `${weekDiff}%`} WoW
                            </Badge>
                        </div>
                    </div>
                    <div className={`rounded-lg border p-3 text-center transition-all duration-200 flex flex-col justify-between items-center ${activeTab === 'monthly' ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-border/50 bg-background'}`}>
                        <div>
                            <p className="text-xl sm:text-2xl font-bold tracking-tight text-primary">{monthlyStats.total.toLocaleString()}</p>
                            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">This Month</p>
                        </div>
                        <div className="mt-1.5 flex items-center justify-center shrink-0">
                            <Badge 
                                variant="outline" 
                                className={`text-[8px] h-4.5 px-1 font-mono font-medium border-none shadow-none leading-none shrink-0 ${
                                    monthDiff >= 0 
                                        ? 'text-emerald-500 bg-emerald-500/[0.06]' 
                                        : 'text-destructive bg-destructive/[0.06]'
                                }`}
                            >
                                {monthDiff >= 0 ? `+${monthDiff}%` : `${monthDiff}%`} MoM
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'daily' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-muted/20 rounded-md p-1 w-fit mx-auto text-[10px] select-none">
                            <button 
                                onClick={() => setDailyViewType('progress')} 
                                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${dailyViewType === 'progress' ? 'bg-background shadow-sm text-foreground font-semibold' : 'text-muted-foreground'}`}
                            >
                                Target Progress
                            </button>
                            <button 
                                onClick={() => setDailyViewType('chart')} 
                                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${dailyViewType === 'chart' ? 'bg-background shadow-sm text-foreground font-semibold' : 'text-muted-foreground'}`}
                            >
                                24h Hourly Activity
                            </button>
                        </div>

                        {dailyViewType === 'progress' ? (
                            <div className="text-center py-4 animate-fade-in">
                                <div className="relative h-28 w-28 mx-auto mb-3">
                                    <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 120 120">
                                        <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/10" />
                                        <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
                                            strokeDasharray={`${Math.min(todayCount / dailyTarget, 1) * 314} 314`}
                                            className="text-primary transition-all duration-1000 ease-out" />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-bold">{Math.round((todayCount / dailyTarget) * 100)}%</span>
                                        <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Daily Goal</span>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    <span className="font-semibold text-foreground">{todayCount.toLocaleString()}</span> of <span className="font-semibold text-foreground">{dailyTarget.toLocaleString()}</span> emails sent today
                                    {count24h > 0 && <span className="text-emerald-500"> • {count24h} in last 24h</span>}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3 pt-2 animate-fade-in">
                                <div className="flex items-center justify-between select-none">
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <span>📈 24h Distribution</span>
                                        <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-normal border-primary/20 text-primary bg-primary/5">
                                            Last 24 Hours
                                        </Badge>
                                    </span>
                                    
                                    {/* 3-Way Chart Switcher */}
                                    <div className="flex gap-1 bg-muted/40 rounded p-0.5 select-none shrink-0">
                                        <button 
                                            onClick={() => { setChartType('line'); localStorage.setItem('peakx-dashboard-chart-type', 'line'); }} 
                                            className={`px-2.5 py-0.5 rounded transition-all flex items-center gap-1 text-[9px] cursor-pointer ${chartType === 'line' ? 'bg-background shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                                            title="Line Chart"
                                        >
                                            <TrendingUp className="h-2.5 w-2.5" />
                                            <span className="hidden sm:inline">Line</span>
                                        </button>
                                        <button 
                                            onClick={() => { setChartType('bar'); localStorage.setItem('peakx-dashboard-chart-type', 'bar'); }} 
                                            className={`px-2.5 py-0.5 rounded transition-all flex items-center gap-1 text-[9px] cursor-pointer ${chartType === 'bar' ? 'bg-background shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                                            title="Bar Chart"
                                        >
                                            <BarChart3 className="h-2.5 w-2.5" />
                                            <span className="hidden sm:inline">Bar</span>
                                        </button>
                                        <button 
                                            onClick={() => { setChartType('pie'); localStorage.setItem('peakx-dashboard-chart-type', 'pie'); }} 
                                            className={`px-2.5 py-0.5 rounded transition-all flex items-center gap-1 text-[9px] cursor-pointer ${chartType === 'pie' ? 'bg-background shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                                            title="Pie Chart"
                                        >
                                            <PieChart className="h-2.5 w-2.5" />
                                            <span className="hidden sm:inline">Pie</span>
                                        </button>
                                    </div>
                                </div>
                                
                                {chartType === 'line' && (
                                    <SVGLineChart data={hourly24hData} maxVal={maxHourlyCount} />
                                )}
                                {chartType === 'bar' && (
                                    <SVGBarChart data={hourly24hData} maxVal={maxHourlyCount} />
                                )}
                                {chartType === 'pie' && (
                                    dailyDonutData.length > 0 ? (
                                        <div className="py-2">
                                            <DonutChart data={dailyDonutData} />
                                            <DonutLegend data={dailyDonutData} />
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground text-xs font-mono">
                                            No active sends in the last 24h to display in Pie chart
                                        </div>
                                    )
                                )}

                                {/* High/Low Indicators */}
                                <div className="grid grid-cols-2 gap-2.5 pt-2 text-[10px] border-t border-border/40 font-mono leading-tight">
                                    <div className="bg-muted/10 p-2 rounded border border-border/20 text-center">
                                        <p className="text-muted-foreground uppercase text-[8px] tracking-wider font-semibold">Peak Active Hour</p>
                                        <p className="font-bold text-primary mt-0.5">{hourlyStatsSummary.highest}</p>
                                    </div>
                                    <div className="bg-muted/10 p-2 rounded border border-border/20 text-center">
                                        <p className="text-muted-foreground uppercase text-[8px] tracking-wider font-semibold">Lowest Active Hour</p>
                                        <p className="font-bold text-foreground mt-0.5">{hourlyStatsSummary.lowest}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'weekly' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between select-none">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/75" />
                                <span>7-Day Activity</span>
                            </span>
                            
                            {/* 3-Way Chart Switcher */}
                            <div className="flex gap-1 bg-muted/40 rounded p-0.5 select-none shrink-0">
                                <button 
                                    onClick={() => { setChartType('line'); localStorage.setItem('peakx-dashboard-chart-type', 'line'); }} 
                                    className={`px-2.5 py-0.5 rounded transition-all flex items-center gap-1 text-[9px] cursor-pointer ${chartType === 'line' ? 'bg-background shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                                    title="Line Chart"
                                >
                                    <TrendingUp className="h-2.5 w-2.5" />
                                    <span className="hidden sm:inline">Line</span>
                                </button>
                                <button 
                                    onClick={() => { setChartType('bar'); localStorage.setItem('peakx-dashboard-chart-type', 'bar'); }} 
                                    className={`px-2.5 py-0.5 rounded transition-all flex items-center gap-1 text-[9px] cursor-pointer ${chartType === 'bar' ? 'bg-background shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                                    title="Bar Chart"
                                >
                                    <BarChart3 className="h-2.5 w-2.5" />
                                    <span className="hidden sm:inline">Bar</span>
                                </button>
                                <button 
                                    onClick={() => { setChartType('pie'); localStorage.setItem('peakx-dashboard-chart-type', 'pie'); }} 
                                    className={`px-2.5 py-0.5 rounded transition-all flex items-center gap-1 text-[9px] cursor-pointer ${chartType === 'pie' ? 'bg-background shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                                    title="Pie Chart"
                                >
                                    <PieChart className="h-2.5 w-2.5" />
                                    <span className="hidden sm:inline">Pie</span>
                                </button>
                            </div>
                        </div>

                        {chartType === 'line' && (
                            <SVGLineChart data={weeklyStats.map(s => ({ label: s.day, count: s.count }))} maxVal={maxWeeklyCount} />
                        )}
                        {chartType === 'bar' && (
                            <div className="flex items-stretch justify-between gap-2 h-28 pt-2 animate-fade-in">
                                {weeklyStats.map((stat, i) => {
                                    const isToday = i === 6;
                                    const height = Math.max(4, (stat.count / maxWeeklyCount) * 100);
                                    return (
                                        <div key={stat.date} className="flex-1 flex flex-col justify-end items-center gap-2 group relative h-full">
                                            {/* Tooltip */}
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 font-mono">
                                                {stat.count.toLocaleString()} emails
                                            </div>
                                            <div className="w-full relative flex-1 flex items-end mb-1">
                                                <div
                                                    className={`w-full rounded-t transition-[height] duration-300 ease-out
                                                        ${isToday
                                                            ? 'bg-gradient-to-t from-primary/80 to-primary shadow-sm'
                                                            : stat.count > 0
                                                                ? 'bg-primary/25 hover:bg-primary/45'
                                                                : 'bg-muted/20'
                                                        }`}
                                                    style={{ height: `${height}%` }}
                                                />
                                            </div>
                                            <span className={`text-[10px] font-semibold tracking-wide
                                                ${isToday ? 'text-primary' : 'text-muted-foreground/70'}`}>
                                                {stat.day}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {chartType === 'pie' && (
                            weeklyDonutData.length > 0 ? (
                                <div className="py-2">
                                    <DonutChart data={weeklyDonutData} />
                                    <DonutLegend data={weeklyDonutData} />
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground text-xs font-mono">
                                    No active sends this week to display in Pie chart
                                </div>
                            )
                        )}

                        {/* Weekly Goal Progress */}
                        {(() => {
                            const weeklyTarget = dailyTarget * 7;
                            const weeklyPct = Math.round((weekTotal / weeklyTarget) * 100);
                            return (
                                <div className="pt-3.5 border-t border-border/40 space-y-1.5">
                                    <div className="flex justify-between items-center text-[10px] font-mono leading-none">
                                        <span className="text-muted-foreground uppercase font-semibold">🎯 Weekly Target Progress</span>
                                        <span className="font-bold text-primary">{weekTotal.toLocaleString()} / {weeklyTarget.toLocaleString()} emails ({weeklyPct}%)</span>
                                    </div>
                                    <div className="w-full bg-muted/20 h-1.5 rounded-full overflow-hidden border border-border/30">
                                        <div 
                                            className="bg-gradient-to-r from-primary/75 to-primary h-full rounded-full transition-all duration-500" 
                                            style={{ width: `${Math.min(weeklyPct, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'monthly' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between select-none">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Activity className="h-3.5 w-3.5 text-muted-foreground/75" />
                                <span>30-Day Activity</span>
                            </span>
                            
                            {/* 3-Way Chart Switcher */}
                            <div className="flex gap-1 bg-muted/40 rounded p-0.5 select-none shrink-0">
                                <button 
                                    onClick={() => { setChartType('line'); localStorage.setItem('peakx-dashboard-chart-type', 'line'); }} 
                                    className={`px-2.5 py-0.5 rounded transition-all flex items-center gap-1 text-[9px] cursor-pointer ${chartType === 'line' ? 'bg-background shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                                    title="Line Chart"
                                >
                                    <TrendingUp className="h-2.5 w-2.5" />
                                    <span className="hidden sm:inline">Line</span>
                                </button>
                                <button 
                                    onClick={() => { setChartType('bar'); localStorage.setItem('peakx-dashboard-chart-type', 'bar'); }} 
                                    className={`px-2.5 py-0.5 rounded transition-all flex items-center gap-1 text-[9px] cursor-pointer ${chartType === 'bar' ? 'bg-background shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                                    title="Bar Chart"
                                >
                                    <BarChart3 className="h-2.5 w-2.5" />
                                    <span className="hidden sm:inline">Bar</span>
                                </button>
                                <button 
                                    onClick={() => { setChartType('pie'); localStorage.setItem('peakx-dashboard-chart-type', 'pie'); }} 
                                    className={`px-2.5 py-0.5 rounded transition-all flex items-center gap-1 text-[9px] cursor-pointer ${chartType === 'pie' ? 'bg-background shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                                    title="Pie Chart"
                                >
                                    <PieChart className="h-2.5 w-2.5" />
                                    <span className="hidden sm:inline">Pie</span>
                                </button>
                            </div>
                        </div>

                        {monthlyStats.total > 0 ? (
                            <>
                                {chartType === 'line' && (
                                    <SVGLineChart data={monthlyStats.days.map(d => ({ label: d.label, count: d.count }))} maxVal={maxMonthlyCount} />
                                )}
                                {chartType === 'bar' && (
                                    <SVGBarChart data={monthlyStats.days.map(d => ({ label: d.label, count: d.count }))} maxVal={maxMonthlyCount} />
                                )}
                                {chartType === 'pie' && (
                                    <div className="py-2 animate-fade-in">
                                        <DonutChart data={donutData} />
                                        <DonutLegend data={donutData} />
                                    </div>
                                )}
                                
                                {/* Monthly Goal Progress Bar */}
                                {(() => {
                                    const monthlyPct = Math.round((monthlyStats.total / monthlyTarget) * 100);
                                    return (
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[10px] font-mono leading-none">
                                                <span className="text-muted-foreground uppercase font-semibold">🎯 Monthly Target Progress</span>
                                                <span className="font-bold text-primary">{monthlyStats.total.toLocaleString()} / {monthlyTarget.toLocaleString()} emails ({monthlyPct}%)</span>
                                            </div>
                                            <div className="w-full bg-muted/20 h-1.5 rounded-full overflow-hidden border border-border/30">
                                                <div 
                                                    className="bg-gradient-to-r from-primary/75 to-primary h-full rounded-full transition-all duration-500" 
                                                    style={{ width: `${Math.min(monthlyPct, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}
                                
                                {/* Monthly Performance & Growth Insights */}
                                {(() => {
                                    const activeDays = monthlyStats.days.filter(d => d.count > 0);
                                    const activeDaysCount = activeDays.length || 1;
                                    const activeDayAverage = Math.round(monthlyStats.total / activeDaysCount);
                                    
                                    // Deterministic growth percentage based on monthly total so it doesn't flicker/change randomly
                                    const seededRandomMultiplier = 1 + 0.05 + ((monthlyStats.total % 100) / 2000); // between 5.0% and 10.0%
                                    
                                    const safeBaseline = Math.round(activeDayAverage * 0.90);
                                    const proposedTarget = Math.round(activeDayAverage * seededRandomMultiplier);
                                    
                                    return (
                                        <div className="pt-3.5 border-t border-border/40 space-y-2">
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <span>📊 Monthly Efficiency Insights</span>
                                                <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-normal border-primary/20 text-primary bg-primary/5">
                                                    Growth Projections
                                                </Badge>
                                            </p>
                                            <div className="grid grid-cols-3 gap-2 text-center font-mono">
                                                <div className="bg-muted/10 p-2.5 rounded border border-border/20">
                                                    <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Active Day Avg</p>
                                                    <p className="text-sm font-bold text-primary mt-0.5">{activeDayAverage.toLocaleString()}</p>
                                                    <p className="text-[7px] text-muted-foreground/70 mt-0.5 leading-tight">emails / active day</p>
                                                </div>
                                                <div className="bg-muted/10 p-2.5 rounded border border-border/20">
                                                    <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Safe Baseline</p>
                                                    <p className="text-sm font-bold text-foreground mt-0.5">{safeBaseline.toLocaleString()}</p>
                                                    <p className="text-[7px] text-destructive/85 font-medium mt-0.5 leading-tight">do not drop below</p>
                                                </div>
                                                <div className="bg-muted/10 p-2.5 rounded border border-border/20">
                                                    <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Growth Target</p>
                                                    <p className="text-sm font-bold text-emerald-500 mt-0.5">{proposedTarget.toLocaleString()}</p>
                                                    <p className="text-[7px] text-emerald-600/85 font-medium mt-0.5 leading-tight flex items-center justify-center gap-0.5">
                                                        <span>+{Math.round((seededRandomMultiplier - 1) * 100)}% increase</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">No activity in the last 30 days</p>
                                <p className="text-[10px] text-muted-foreground/50 mt-1">Start sending emails to see your monthly breakdown</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Outreach Goals & Targets Settings Panel */}
            <div className="rounded-lg border border-border/50 bg-background sm:bg-background/50 p-4 space-y-3 relative overflow-hidden group">
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary/70" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">🎯 Outreach Goals &amp; Targets</span>
                    </div>
                    {!isEditingTargets && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[10px] px-2 cursor-pointer font-semibold hover:bg-muted/80"
                            onClick={() => {
                                setTempDailyTarget(dailyTarget);
                                setTempMonthlyTarget(monthlyTarget);
                                setIsEditingTargets(true);
                            }}
                        >
                            Configure
                        </Button>
                    )}
                </div>

                {!isEditingTargets ? (
                    <div className="grid grid-cols-3 gap-2.5 text-center font-mono">
                        <div className="bg-muted/10 p-2.5 rounded border border-border/20 relative">
                            <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Daily Target</p>
                            <p className="text-sm font-bold text-primary mt-0.5">{dailyTarget.toLocaleString()}</p>
                            <div className="text-[7px] text-muted-foreground/70 mt-0.5 leading-tight flex items-center justify-center gap-0.5">
                                {!canChangeDailyTarget ? (
                                    <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                                        <Lock className="h-1.5 w-1.5" /> Locked today
                                    </span>
                                ) : (
                                    <span className="text-emerald-500 font-medium">Editable</span>
                                )}
                            </div>
                        </div>
                        <div className="bg-muted/10 p-2.5 rounded border border-border/20">
                            <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Weekly Target</p>
                            <p className="text-sm font-bold text-foreground mt-0.5">{(dailyTarget * 7).toLocaleString()}</p>
                            <p className="text-[7px] text-muted-foreground/60 mt-0.5 leading-tight">calculated locally</p>
                        </div>
                        <div className="bg-muted/10 p-2.5 rounded border border-border/20">
                            <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Monthly Target</p>
                            <p className="text-sm font-bold text-emerald-500 mt-0.5">{monthlyTarget.toLocaleString()}</p>
                            <p className="text-[7px] text-muted-foreground/60 mt-0.5 leading-tight">editable anytime</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3 bg-muted/20 p-3 rounded-lg border border-border/30 animate-fade-in">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 select-none">
                                    <span>Daily Target</span>
                                    {!canChangeDailyTarget && (
                                        <Badge variant="outline" className="text-[7px] h-3.5 px-1 border-amber-500/30 text-amber-500 bg-amber-500/[0.03] font-normal leading-none gap-0.5">
                                            <Lock className="h-1.5 w-1.5" /> Locked
                                        </Badge>
                                    )}
                                </label>
                                <Input
                                    type="number"
                                    min="1"
                                    disabled={!canChangeDailyTarget}
                                    value={tempDailyTarget}
                                    onChange={(e) => setTempDailyTarget(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="h-7 text-xs px-2"
                                />
                                <span className="text-[7px] text-muted-foreground block leading-tight">
                                    {!canChangeDailyTarget 
                                        ? "🔒 Already updated today. Re-opens tomorrow."
                                        : "Limit: Once per calendar day."}
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Monthly Target</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={tempMonthlyTarget}
                                    onChange={(e) => setTempMonthlyTarget(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="h-7 text-xs px-2"
                                />
                                <span className="text-[7px] text-muted-foreground block leading-tight">
                                    Calculates weekly stats and targets automatically.
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-1">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 text-xs px-3 cursor-pointer"
                                onClick={() => setIsEditingTargets(false)}
                            >
                                Cancel
                            </Button>
                            <Button 
                                variant="default" 
                                size="sm" 
                                className="h-7 text-xs px-3 cursor-pointer"
                                onClick={handleSaveTargets}
                            >
                                Save Targets
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
