import { useState, useMemo } from 'react';
import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { useOutreachTracker, type TrackingLog } from '@/hooks/useOutreachTracker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  TrendingUp, 
  Trash2, 
  Search, 
  Download, 
  Trash, 
  Layers, 
  CheckCircle2, 
  Mail, 
  ExternalLink,
  Calendar,
  AlertCircle
} from 'lucide-react';

export default function Tracker() {
  const { logs, deleteLog, clearLogs } = useOutreachTracker();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'individual' | 'bcc'>('all');

  // Calculate stats
  const stats = useMemo(() => {
    const total = logs.length;
    const individualCount = logs.filter(l => l.type === 'individual').length;
    const bccCount = logs.filter(l => l.type === 'bcc').length;

    // Filter by today
    const todayStr = new Date().toDateString();
    const todayCount = logs.filter(l => new Date(l.timestamp).toDateString() === todayStr).length;

    return { total, individualCount, bccCount, todayCount };
  }, [logs]);

  // Handle Search and Type Filters
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      // Type filter
      if (typeFilter !== 'all' && l.type !== typeFilter) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        l.email.toLowerCase().includes(q) ||
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.storeName && l.storeName.toLowerCase().includes(q)) ||
        (l.niche && l.niche.toLowerCase().includes(q))
      );
    });
  }, [logs, searchQuery, typeFilter]);

  // Export Tracking Logs to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast({
        title: "No logs to export",
        description: "Your outreach sent logs history is currently empty.",
        variant: "destructive"
      });
      return;
    }

    const headers = 'ID,Email,Name,Store/Website,Niche,Type,Time Sent\n';
    const rows = logs.map(l => {
      const dateStr = new Date(l.timestamp).toISOString();
      const escapedName = l.name ? `"${l.name.replace(/"/g, '""')}"` : '';
      const escapedStore = l.storeName ? `"${l.storeName.replace(/"/g, '""')}"` : '';
      const escapedNiche = l.niche ? `"${l.niche.replace(/"/g, '""')}"` : '';
      return `${l.id},${l.email},${escapedName},${escapedStore},${escapedNiche},${l.type},${dateStr}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `peakxender-outreach-sent-history-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Logs Exported Successfully",
      description: `${logs.length} tracking logs downloaded as CSV.`
    });
  };

  // Clear tracking history
  const handleClearHistory = () => {
    if (!window.confirm("Are you sure you want to clear your entire tracking history? This will permanently delete all sent logs. This action cannot be undone and does not affect your active email lists.")) return;
    clearLogs();
    toast({
      title: "Tracking History Cleared",
      description: "All outreach sent tracking logs have been successfully removed."
    });
  };

  // Format date helper
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Get recipient initials for avatar
  const getInitials = (email: string, name?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <AppShell>
      <SEO
        title="Outreach Tracker - Peak Xender"
        description="View your outreach logs, track sent emails, see timestamps and send modes, search logs, and export your history to CSV."
      />
      <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                Outreach Tracker Logs
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                A persistent record of emails triggered through mailto links and BCC batches.
              </p>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px] px-3 font-semibold border-border/40 hover:bg-muted"
                onClick={handleExportCSV}
                title="Export sent history to CSV file"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export CSV
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-[11px] px-3 font-semibold"
                onClick={handleClearHistory}
                title="Clear tracking history logs"
              >
                <Trash className="h-3.5 w-3.5 mr-1.5" />
                Clear Logs
              </Button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3 relative overflow-hidden group">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Sent</p>
                <p className="text-xl font-bold tracking-tight">{stats.total.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3 relative overflow-hidden group">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                <Calendar className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Sent Today</p>
                <p className="text-xl font-bold tracking-tight">{stats.todayCount.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3 relative overflow-hidden group">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                <Mail className="h-4.5 w-4.5 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Individual</p>
                <p className="text-xl font-bold tracking-tight">{stats.individualCount.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3 relative overflow-hidden group">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
                <Layers className="h-4.5 w-4.5 text-purple-500" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">BCC Batches</p>
                <p className="text-xl font-bold tracking-tight">{stats.bccCount.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Search, Filters, and Table container */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4 flex flex-col h-[520px]">
            {/* Filter controls row */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search logs by email, name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>

              <div className="flex gap-1.5 w-full sm:w-auto bg-muted/40 p-0.5 rounded-lg border border-border/10">
                <Button
                  variant={typeFilter === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`h-7 text-[10px] sm:text-xs flex-1 sm:flex-initial px-3 font-semibold ${
                    typeFilter === 'all' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                  onClick={() => setTypeFilter('all')}
                >
                  All Logs
                </Button>
                <Button
                  variant={typeFilter === 'individual' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`h-7 text-[10px] sm:text-xs flex-1 sm:flex-initial px-3 font-semibold ${
                    typeFilter === 'individual' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                  onClick={() => setTypeFilter('individual')}
                >
                  Individual
                </Button>
                <Button
                  variant={typeFilter === 'bcc' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`h-7 text-[10px] sm:text-xs flex-1 sm:flex-initial px-3 font-semibold ${
                    typeFilter === 'bcc' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                  onClick={() => setTypeFilter('bcc')}
                >
                  BCC
                </Button>
              </div>
            </div>

            {/* Logs List Table */}
            <div className="flex-grow min-h-0 overflow-y-auto border border-border/40 rounded-lg bg-background/50 pr-1 scrollbar-thin">
              {filteredLogs.length > 0 ? (
                <div className="divide-y divide-border/20">
                  {filteredLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/10 transition-colors group text-[11px] sm:text-xs"
                    >
                      <div className="flex items-center gap-3 overflow-hidden pr-2">
                        {/* Custom initials avatar */}
                        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-mono font-bold shrink-0 text-[10px] sm:text-[11px]">
                          {getInitials(log.email, log.name)}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            {log.name ? (
                              <span className="font-bold text-foreground truncate max-w-[120px]">
                                {log.name}
                              </span>
                            ) : (
                              <span className="font-mono text-muted-foreground/60">
                                Anonymous
                              </span>
                            )}
                            <a
                              href={`mailto:${log.email}`}
                              className="font-mono text-muted-foreground/80 hover:text-primary transition-colors flex items-center gap-0.5 truncate hover:underline"
                              title="Click to trigger mailto"
                            >
                              &lt;{log.email}&gt;
                              <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          </div>

                          {/* Enrichment metadata pills */}
                          {(log.storeName || log.niche) && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-muted-foreground/60 select-none">
                              {log.storeName && (
                                <Badge variant="outline" className="h-4.5 py-0 px-1.5 border-border/20 bg-muted/30 font-normal truncate max-w-[130px]">
                                  🏢 {log.storeName}
                                </Badge>
                              )}
                              {log.niche && (
                                <Badge variant="outline" className="h-4.5 py-0 px-1.5 border-border/20 bg-muted/30 font-normal italic truncate max-w-[100px]">
                                  🏷️ {log.niche}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Hand Controls (Badge, Date, Trash) */}
                      <div className="flex items-center gap-3 shrink-0 select-none font-mono">
                        <Badge 
                          className={`text-[9px] h-4.5 px-1.5 border-none font-semibold ${
                            log.type === 'individual' 
                              ? 'bg-blue-500/10 text-blue-500' 
                              : 'bg-purple-500/10 text-purple-500'
                          }`}
                        >
                          {log.type === 'individual' ? 'INDIVIDUAL' : 'BCC BATCH'}
                        </Badge>
                        
                        <span className="text-[10px] text-muted-foreground/70" title={new Date(log.timestamp).toLocaleString()}>
                          {formatTime(log.timestamp)}
                        </span>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                          onClick={() => deleteLog(log.id)}
                          title="Delete log entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
                  <Mail className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-xs font-semibold">No Sent Logs Found</p>
                  <p className="text-[10px] text-muted-foreground/60 max-w-xs mt-1 leading-normal">
                    {searchQuery.trim() || typeFilter !== 'all'
                      ? "Try tweaking your search terms or filters."
                      : "Outreach history logs appear here automatically as soon as you trigger client-side sending from the Home page."}
                  </p>
                </div>
              )}
            </div>
            
            {/* Info Badge */}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80 bg-muted/20 border border-border/10 p-2.5 rounded-lg select-none shrink-0 leading-normal">
              <AlertCircle className="h-4 w-4 text-primary shrink-0" />
              <span>
                <strong>Note</strong>: Sent history tracking relies entirely on local storage in your browser for absolute data privacy. It registers a log whenever you click a mailto link or trigger a BCC batch.
              </span>
            </div>
          </div>
      </div>
    </AppShell>
  );
}
