import { TrendingUp, Calendar } from 'lucide-react';

interface Tracker24hProps {
    count24h: number;
    todayCount: number;
}

export function Tracker24h({ count24h, todayCount }: Tracker24hProps) {
    return (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-base font-semibold">Activity Tracker</h2>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                    <p className="text-2xl font-black text-primary tracking-tight">{todayCount}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        Today (00:00+)
                    </p>
                </div>
                <div>
                    <p className="text-2xl font-black text-primary/70 tracking-tight">{count24h}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                        <TrendingUp className="h-3 w-3" />
                        Last 24h
                    </p>
                </div>
            </div>
        </div>
    );
}
