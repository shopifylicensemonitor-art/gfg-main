import { useState, useEffect } from 'react';
import { api, type LogItem } from '../api';
import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { FileText, RefreshCw, Send, CheckCircle, XCircle, AlertCircle, Filter, Calendar } from 'lucide-react';

export default function Logs() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [limit, setLimit] = useState<number>(50);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getRecentLogs(limit);
      setLogs(data);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading logs',
        description: e.message || 'Could not fetch active email transactions.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [limit]);

  const filteredLogs = logs.filter(log => {
    if (statusFilter === 'all') return true;
    return log.status.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <AppShell>
      <SEO
        title="Outreach Dispatch Logs - Peakconix"
        description="Verify delivery audits, track Gmail rotating records, and inspect error details for cold email sends."
      />
      <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
                Outreach Audit Logs
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Trace real-time email transactions, delivery receipts, and error messages.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                className="bg-muted text-xs rounded-xl border border-input px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value={20}>Show 20</option>
                <option value={50}>Show 50</option>
                <option value={100}>Show 100</option>
              </select>
              <Button
                variant="outline"
                onClick={loadLogs}
                disabled={loading}
                className="h-9 gap-1.5 rounded-xl border-border/40 text-xs font-semibold"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Logs</span>
              </Button>
            </div>
          </div>

          {/* Filtering row */}
          <div className="flex gap-2">
            {['all', 'sent', 'failed'].map(status => (
              <Button
                key={status}
                size="sm"
                variant={statusFilter === status ? 'default' : 'outline'}
                onClick={() => setStatusFilter(status)}
                className={`h-8 rounded-lg text-xs font-semibold ${
                  statusFilter === status 
                    ? '' 
                    : 'text-muted-foreground border-border/40 hover:bg-muted/40'
                }`}
              >
                <span>{status.toUpperCase()}</span>
              </Button>
            ))}
          </div>

          {/* Logs Table Card */}
          <Card className="glass-card border-border/10 shadow-lg overflow-hidden">
            <CardHeader className="border-b border-border/10 pb-4">
              <CardTitle className="text-base font-bold text-foreground">Transaction Trace Logs ({filteredLogs.length})</CardTitle>
              <CardDescription className="text-xs">
                Detailed audit trace of Gmail API rotating requests.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredLogs.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground text-xs space-y-2">
                  <FileText className="h-8 w-8 mx-auto opacity-30 text-muted-foreground" />
                  <p>No recent email logs recorded. Active campaigns populate entries here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/10 text-muted-foreground font-bold uppercase tracking-wider text-[9px]">
                        <th className="p-3 w-10 text-center">Status</th>
                        <th className="p-3 w-40">Recipient</th>
                        <th className="p-3 w-40">Sender (Account)</th>
                        <th className="p-3">Campaign / Details</th>
                        <th className="p-3 w-28 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/5">
                      {filteredLogs.map(log => {
                        const isSent = log.status.toLowerCase() === 'sent';
                        return (
                          <tr key={log.id} className="hover:bg-muted/5 font-medium transition-colors">
                            <td className="p-3 text-center">
                              {isSent ? (
                                <CheckCircle className="h-4.5 w-4.5 text-emerald-500 mx-auto" />
                              ) : (
                                <XCircle className="h-4.5 w-4.5 text-destructive mx-auto" />
                              )}
                            </td>
                            <td className="p-3 font-semibold text-foreground break-all">
                              {log.recipient_email}
                            </td>
                            <td className="p-3 text-muted-foreground truncate max-w-[160px]">
                              {log.sender_email || '—'}
                            </td>
                            <td className="p-3 space-y-0.5">
                              <div className="text-foreground font-bold">
                                {log.campaign_name || 'Individual Send'}
                              </div>
                              <div className={`text-[10px] ${isSent ? 'text-muted-foreground' : 'text-destructive font-semibold'}`}>
                                {log.message}
                              </div>
                            </td>
                            <td className="p-3 text-right text-muted-foreground whitespace-nowrap text-[10px]">
                              <span className="flex items-center justify-end gap-1.5 font-mono">
                                <Calendar className="h-3 w-3" />
                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
      </div>
    </AppShell>
  );
}
