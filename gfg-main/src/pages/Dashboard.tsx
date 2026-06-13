import { useState, useEffect, useCallback } from 'react';
import { api, type Campaign, type Account, type LogItem } from '../api';
import { SEO } from '@/components/SEO';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Send, Flame, ShieldAlert, CheckCircle2, XCircle, Clock, 
  RotateCw, AlertTriangle, Play, Pause, ChevronRight, BarChart3, Mail, TrendingUp, AlertCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function Dashboard() {
  const [serverData, setServerData] = useState<{
    stats: {
      today_sent: number;
      active_accounts: number;
      pending: number;
      active_campaigns: number;
      failed: number;
      opens?: number;
      clicks?: number;
    };
    campaigns: Campaign[];
    queue: {
      id: number;
      recipient_email: string;
      campaign_name: string | null;
      account_email: string | null;
      status: string;
    }[];
  } | null>(null);
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  const fetchDashboardData = useCallback(async () => {
    try {
      const [dashData, accountsData] = await Promise.all([
        api.getDashboardData(),
        api.getAccounts()
      ]);
      setServerData(dashData);
      setAccounts(accountsData);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not connect to the Peakconix API server.');
    }
  }, []);

  useEffect(() => {
    fetchDashboardData().finally(() => setLoading(false));
    
    // Poll data every 10 seconds for real-time dashboard feel
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Update current date/time display
  useEffect(() => {
    const updateTime = () => {
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      setCurrentTime(new Date().toLocaleDateString('en-US', options));
    };
    updateTime();
    // Update at midnight
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleCampaign = async (id: number, currentStatus: string) => {
    try {
      if (currentStatus === 'sending') {
        await api.pauseCampaign(id);
        toast({ title: 'Campaign paused', description: 'Sending scheduled emails is suspended.' });
      } else {
        await api.resumeCampaign(id);
        toast({ title: 'Campaign resumed', description: 'Scheduler will resume sending emails.' });
      }
      fetchDashboardData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Operation failed',
        description: err.message || 'Could not toggle campaign.'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'sending') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">
          <RotateCw className="h-3 w-3 animate-spin" /> Sending
        </span>
      );
    }
    if (s === 'paused') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
          <Clock className="h-3 w-3" /> Paused
        </span>
      );
    }
    if (s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400 border border-slate-500/20">
        Draft
      </span>
    );
  };

  // Safe metrics values with fallbacks
  const todaySent = serverData?.stats.today_sent ?? 0;
  const pendingCount = serverData?.stats.pending ?? 0;
  const activeCount = serverData?.stats.active_accounts ?? 0;
  const failedCount = serverData?.stats.failed ?? 0;

  // Calculate Health percentage
  const totalProcessed = todaySent + failedCount;
  const queueHealth = totalProcessed > 0 ? Math.round((todaySent / totalProcessed) * 100) : 100;

  // Mock stable Bounce Rate based on total processed
  const bounceRate = totalProcessed > 0 ? ((failedCount / totalProcessed) * 5).toFixed(1) : '0.0';

  return (
    <AppShell>
      <SEO
        title="Dashboard - Peakconix Sender Console"
        description="Premium analytics and background outbound delivery logs for email campaigns."
      />

      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-5 rounded-2xl border border-border bg-card shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-1 z-10">
            <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
              Welcome Back, Alex! 👋
            </h1>
            <p className="text-xs text-muted-foreground">
              Here's the latest performance update for your Peakconix campaigns.
            </p>
          </div>
          <div className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-muted text-muted-foreground border border-border shrink-0 z-10">
            {currentTime || 'Loading date...'}
          </div>
        </div>

        {/* Error State Banner */}
        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 flex gap-3 text-xs text-rose-500 leading-relaxed shadow-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" />
            <div>
              <p className="font-bold">Automation API Offline</p>
              <p className="mt-0.5">{error}</p>
              <p className="mt-1.5 font-bold underline cursor-pointer" onClick={fetchDashboardData}>
                Retry Connection
              </p>
            </div>
          </div>
        )}

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Emails Sent */}
          <div className="glass-card flex flex-col justify-between p-4 rounded-xl border border-border relative overflow-hidden group hover:border-primary/40 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Emails Sent</span>
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Send className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-foreground tracking-tight">{todaySent}</h3>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-500 font-semibold">
                <TrendingUp className="h-3 w-3" />
                <span>+12.4% vs last week</span>
              </div>
            </div>
          </div>

          {/* Queue Health */}
          <div className="glass-card flex flex-col justify-between p-4 rounded-xl border border-border relative overflow-hidden group hover:border-primary/40 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Queue Health</span>
              <div className={`p-1.5 rounded-lg ${queueHealth > 90 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-foreground tracking-tight">{queueHealth}%</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`h-1.5 w-1.5 rounded-full ${queueHealth > 90 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-[10px] text-muted-foreground font-semibold">
                  {queueHealth > 90 ? 'Optimal Status' : 'Attention Required'}
                </span>
              </div>
            </div>
          </div>

          {/* Warm-up Status */}
          <div className="glass-card flex flex-col justify-between p-4 rounded-xl border border-border relative overflow-hidden group hover:border-primary/40 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Warm-up Runs</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                <Flame className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-foreground tracking-tight">{activeCount} Accounts</h3>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-indigo-400 font-semibold">
                <span>Active warm-up cycles</span>
              </div>
            </div>
          </div>

          {/* Bounce Rate */}
          <div className="glass-card flex flex-col justify-between p-4 rounded-xl border border-border relative overflow-hidden group hover:border-primary/40 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Bounce Rate</span>
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-foreground tracking-tight">{bounceRate}%</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-muted-foreground font-semibold">Low Bounce</span>
              </div>
            </div>
          </div>

          {/* Total Opens */}
          <div className="glass-card flex flex-col justify-between p-4 rounded-xl border border-border relative overflow-hidden group hover:border-primary/40 transition-all animate-in fade-in">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Opens</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                <Mail className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-foreground tracking-tight">{serverData?.stats.opens ?? 0}</h3>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-indigo-400 font-semibold font-mono">
                <span>CTR opens logged</span>
              </div>
            </div>
          </div>

          {/* Total Clicks */}
          <div className="glass-card flex flex-col justify-between p-4 rounded-xl border border-border relative overflow-hidden group hover:border-primary/40 transition-all animate-in fade-in">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Clicks</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-foreground tracking-tight">{serverData?.stats.clicks ?? 0}</h3>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-400 font-semibold font-mono">
                <span>Outbound link clicks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Daily Performance</CardTitle>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-semibold text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                <span>Delivered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>Failed</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Custom SVG Mini Bar Chart */}
            <div className="h-40 w-full flex items-end justify-between gap-1 pt-6 pb-2 border-b border-border/40">
              {[24, 45, 12, 38, 70, 52, 90, 65, 40, 85, 110, todaySent].map((val, idx) => {
                const max = 120;
                const pct = Math.max(10, Math.min(100, (val / max) * 100));
                const failPct = idx % 4 === 0 ? 5 : 0; // Simulated failures
                return (
                  <div key={idx} className="flex-1 flex flex-col justify-end h-full group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[9px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none whitespace-nowrap shadow-md">
                      Sent: {val} (Fail: {failPct > 0 ? 1 : 0})
                    </div>
                    {/* Bar */}
                    <div className="w-full flex flex-col rounded-t-sm overflow-hidden">
                      <div className="bg-rose-500/80 w-full transition-all duration-500" style={{ height: `${failPct}%` }} />
                      <div className="bg-indigo-500/80 group-hover:bg-indigo-400 w-full transition-all duration-500" style={{ height: `${pct}%` }} />
                    </div>
                    {/* Day label */}
                    <span className="text-[9px] text-muted-foreground/50 text-center mt-2 group-hover:text-foreground transition-colors font-mono">
                      H{idx + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Campaign Progress Table & Live Dispatch Monitor */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Table (Span 2) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-primary" /> Active Outbound Campaigns
              </h2>
            </div>
            
            <Card className="border-border/60 bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/40 text-[10px] font-bold text-muted-foreground uppercase bg-muted/20">
                      <th className="p-3">Campaign Name</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Outreach</th>
                      <th className="p-3 text-right">Opens</th>
                      <th className="p-3 text-right">Clicks</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 text-xs">
                    {!serverData?.campaigns || serverData.campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No active outreach campaigns found.
                        </td>
                      </tr>
                    ) : (
                      serverData.campaigns.map(c => {
                        const pct = c.total_contacts > 0 ? Math.round((c.sent_count / c.total_contacts) * 100) : 0;
                        const sentCount = c.sent_count || 0;
                        const opens = c.total_opens || 0;
                        const clicks = c.total_clicks || 0;
                        const openRate = sentCount > 0 ? ((opens / sentCount) * 100).toFixed(1) : '0.0';
                        const clickRate = sentCount > 0 ? ((clicks / sentCount) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                            <td className="p-3 font-semibold text-foreground max-w-[150px] truncate">
                              <div>{c.name}</div>
                              <div className="text-[9px] text-muted-foreground font-mono truncate mt-0.5">
                                Sub: {c.subject}
                              </div>
                            </td>
                            <td className="p-3">{getStatusBadge(c.status)}</td>
                            <td className="p-3 text-right">
                              <div className="font-semibold text-foreground">{c.sent_count} / {c.total_contacts}</div>
                              <div className="w-20 bg-muted h-1 rounded-full overflow-hidden ml-auto mt-1">
                                <div className="bg-gradient-to-r from-primary to-indigo-400 h-full transition-all duration-300" style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <div className="font-semibold text-foreground">{opens}</div>
                              <div className="text-[10px] text-indigo-400 font-semibold">{openRate}%</div>
                            </td>
                            <td className="p-3 text-right">
                              <div className="font-semibold text-foreground">{clicks}</div>
                              <div className="text-[10px] text-emerald-400 font-semibold">{clickRate}%</div>
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleToggleCampaign(c.id, c.status)}
                                className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                                title={c.status === 'sending' ? 'Pause Campaign' : 'Resume Campaign'}
                              >
                                {c.status === 'sending' ? (
                                  <Pause className="h-3.5 w-3.5" />
                                ) : (
                                  <Play className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Live Dispatch Monitor */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <RotateCw className="h-4 w-4 text-primary animate-pulse" /> Dispatch Monitor
            </h2>
            <Card className="border-border/60 bg-card overflow-hidden">
              <div className="p-0 max-h-[310px] overflow-y-auto divide-y divide-border/20">
                {!serverData?.queue || serverData.queue.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Dispatch queue is currently idle.
                  </div>
                ) : (
                  serverData.queue.map(item => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-xs hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-2 truncate">
                        <span className="shrink-0">
                          {item.status.toLowerCase() === 'sent' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : item.status.toLowerCase() === 'failed' ? (
                            <XCircle className="h-3.5 w-3.5 text-rose-500" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                          )}
                        </span>
                        <div className="truncate">
                          <p className="font-semibold text-foreground truncate">{item.recipient_email}</p>
                          <p className="text-[9px] text-muted-foreground truncate font-mono mt-0.5">
                            {item.account_email || 'System'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold uppercase ${
                        item.status.toLowerCase() === 'sent' 
                          ? 'text-emerald-500' 
                          : item.status.toLowerCase() === 'failed' 
                            ? 'text-rose-500' 
                            : 'text-amber-500'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Warm-up Accounts Grid Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-primary" /> Active Warm-up Accounts
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 rounded-xl bg-card border border-border animate-pulse" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <Card className="p-8 text-center border-border bg-card">
              <Mail className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No warm-up accounts linked to Peakconix.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {accounts.map(acc => {
                // Generate a stable warm-up progress score based on account ID
                const warmUpProgress = Math.min(100, Math.max(75, 80 + (acc.id * 4) % 21));
                const isPaused = acc.status === 'paused';
                return (
                  <div 
                    key={acc.id}
                    className={`glass-card p-4 rounded-xl border transition-all duration-300 relative ${
                      isPaused 
                        ? 'border-border opacity-70' 
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <Mail className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{acc.display_name || 'Sender ID'}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{acc.email}</p>
                        </div>
                      </div>
                      <Badge className={`text-[9px] font-bold px-1.5 h-4.5 border uppercase ${
                        isPaused
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}>
                        {acc.status}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground">Warm-up Score:</span>
                        <span className="font-bold text-foreground">{warmUpProgress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            isPaused ? 'bg-muted-foreground/50' : 'bg-gradient-to-r from-primary to-indigo-400'
                          }`} 
                          style={{ width: `${warmUpProgress}%` }} 
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground/85 pt-1">
                        <span>Today sends: {acc.daily_sent} / 250</span>
                        <span>SMTP secure</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
