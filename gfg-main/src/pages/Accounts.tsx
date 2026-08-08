import { useState, useEffect } from 'react';
import { api, type Account } from '../api';
import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Mail, Plus, Trash2, RefreshCw, Play, Pause, User, Sparkles, CheckCircle2, AlertTriangle, Info, Server } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface AccountsProps {
  requirePin?: (label: string, action: () => void) => void;
}

export default function Accounts({ requirePin }: AccountsProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [editingName, setEditingName] = useState<Record<number, string>>({});
  const [savingNameId, setSavingNameId] = useState<number | null>(null);

  // SMTP Form State
  const [showSmtpModal, setShowSmtpModal] = useState<boolean>(false);
  const [smtpEmail, setSmtpEmail] = useState<string>('');
  const [smtpHost, setSmtpHost] = useState<string>('');
  const [smtpPort, setSmtpPort] = useState<string>('587');
  const [smtpUser, setSmtpUser] = useState<string>('');
  const [smtpPass, setSmtpPass] = useState<string>('');
  const [smtpSecure, setSmtpSecure] = useState<boolean>(false);
  const [smtpDisplayName, setSmtpDisplayName] = useState<string>('');
  const [smtpTesting, setSmtpTesting] = useState<boolean>(false);

  const loadAccounts = async () => {
    try {
      const data = await api.getAccounts();
      setAccounts(data);
      const names: Record<number, string> = {};
      data.forEach(a => {
        names[a.id] = a.display_name || '';
      });
      setEditingName(names);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading accounts',
        description: e.message || 'Could not reach server.'
      });
    }
  };

  useEffect(() => {
    loadAccounts();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        toast({
          title: 'Gmail Connected!',
          description: `Connected ${event.data.email} successfully.`
        });
        loadAccounts();
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        toast({
          variant: 'destructive',
          title: 'Gmail Connection Failed',
          description: event.data.error || 'OAuth authorization failed.'
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnect = () => {
    const action = async () => {
      try {
        setLoading(true);
        toast({
          title: 'Generating Google OAuth link...',
          description: 'Please complete the login in the new window.'
        });
        const res = await api.getAuthUrl();
        window.open(res.url, '_blank');
        
        // Poll for updates every 3 seconds for 30 seconds
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          await loadAccounts();
          if (attempts > 10) clearInterval(interval);
        }, 3000);
        
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Connection failed',
          description: e.message || 'Could not retrieve authentication link.'
        });
      } finally {
        setLoading(false);
      }
    };

    if (requirePin) {
      requirePin('connect new account', action);
    } else {
      action();
    }
  };

  const handleConnectSmtp = () => {
    const action = async () => {
      if (!smtpEmail || !smtpHost || !smtpUser || !smtpPass) {
        toast({
          variant: 'destructive',
          title: 'Missing fields',
          description: 'Please fill in all required fields (Email, Host, Username, Password).'
        });
        return;
      }
      try {
        setSmtpTesting(true);
        toast({
          title: 'Verifying SMTP connection...',
          description: 'Testing credentials and server connection.'
        });
        const res = await api.connectSmtp({
          email: smtpEmail,
          smtp_host: smtpHost,
          smtp_port: parseInt(String(smtpPort)) || 587,
          smtp_user: smtpUser,
          smtp_pass: smtpPass,
          smtp_secure: smtpSecure,
          display_name: smtpDisplayName || undefined
        });
        if (res.success) {
          toast({
            title: 'SMTP Account Connected',
            description: res.message || 'Successfully connected SMTP server.'
          });
          setShowSmtpModal(false);
          // Reset form
          setSmtpEmail('');
          setSmtpHost('');
          setSmtpPort('587');
          setSmtpUser('');
          setSmtpPass('');
          setSmtpSecure(false);
          setSmtpDisplayName('');
          loadAccounts();
        }
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'SMTP Connection failed',
          description: e.message || 'Could not connect to SMTP server.'
        });
      } finally {
        setSmtpTesting(false);
      }
    };

    if (requirePin) {
      requirePin('connect SMTP account', action);
    } else {
      action();
    }
  };

  const handleDelete = (id: number, email: string) => {
    const action = async () => {
      if (!window.confirm(`Disconnect and remove account "${email}"?`)) return;
      try {
        await api.deleteAccount(id);
        toast({
          title: 'Account disconnected',
          description: `${email} was removed successfully.`
        });
        loadAccounts();
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Error removing account',
          description: e.message
        });
      }
    };

    if (requirePin) {
      requirePin('remove connected account', action);
    } else {
      action();
    }
  };

  const handleReset = (id: number) => {
    const action = async () => {
      try {
        await api.resetAccount(id);
        toast({
          title: 'Sent counter reset',
          description: 'Daily sending quota has been reset to 0.'
        });
        loadAccounts();
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Error resetting counter',
          description: e.message
        });
      }
    };

    if (requirePin) {
      requirePin('reset account metrics', action);
    } else {
      action();
    }
  };

  const handleToggleStatus = (id: number, currentStatus: 'active' | 'paused') => {
    const action = async () => {
      try {
        if (currentStatus === 'active') {
          await api.pauseAccount(id);
          toast({
            title: 'Account paused',
            description: 'This email account is suspended from the scheduler queue.'
          });
        } else {
          await api.resumeAccount(id);
          toast({
            title: 'Account resumed',
            description: 'This email account is now active and will receive queue items.'
          });
        }
        loadAccounts();
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Error updating status',
          description: e.message
        });
      }
    };

    if (requirePin) {
      requirePin('change account status', action);
    } else {
      action();
    }
  };

  const handleSaveName = async (id: number) => {
    try {
      setSavingNameId(id);
      await api.updateDisplayName(id, editingName[id] || '');
      toast({
        title: 'Display name updated',
        description: `Emails will now show as "${editingName[id]}".`
      });
      loadAccounts();
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error saving display name',
        description: e.message
      });
    } finally {
      setSavingNameId(null);
    }
  };

  const getInitials = (email: string) => {
    const username = email.split('@')[0];
    const parts = username.split(/[._-]/);
    return parts.map(p => p[0]?.toUpperCase() || '').join('').slice(0, 2) || email.slice(0, 2).toUpperCase();
  };

  const activeCount = accounts.filter(a => a.status === 'active').length;
  const pausedCount = accounts.filter(a => a.status === 'paused').length;
  const totalSentToday = accounts.reduce((sum, a) => sum + (a.daily_sent || 0), 0);

  return (
    <AppShell>
      <SEO
        title="Manage Senders - Peak Xender"
        description="Connect and configure rotating Gmail and SMTP accounts with automated daily caps and name personalization."
        noindex={true}
      />
      <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
                Sender Accounts Rotation
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Connect and manage multiple Gmail and custom SMTP accounts to distribute sending volumes.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleConnect}
                disabled={loading}
                className="h-10 gap-2 rounded-xl peak-gradient-bg border-none text-white font-semibold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity animate-fade-in"
              >
                <Mail className="h-4 w-4" />
                <span>Connect Gmail</span>
              </Button>
              <Button
                onClick={() => setShowSmtpModal(true)}
                disabled={loading}
                variant="outline"
                className="h-10 gap-2 rounded-xl border-border/40 font-semibold shadow-sm hover:bg-muted/80 transition-colors"
              >
                <Server className="h-4 w-4" />
                <span>Connect SMTP</span>
              </Button>
            </div>
          </div>

          {/* Aggregate Quota Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="glass-card border-border/10">
              <CardContent className="p-4 text-center space-y-1">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{accounts.length}</span>
                <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Accounts</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-border/10">
              <CardContent className="p-4 text-center space-y-1">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-primary">{activeCount}</span>
                <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Rotation</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-border/10">
              <CardContent className="p-4 text-center space-y-1">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{totalSentToday}</span>
                <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Sent Today</p>
              </CardContent>
            </Card>
          </div>

          {/* Info Banner */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex gap-3 text-xs text-primary leading-relaxed shadow-sm">
            <Info className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-bold">Automated Round-Robin Sending Mechanics</p>
              <p>
                Outgoing emails are automatically load-balanced across all <strong>active</strong> senders. 
                Gmail accounts have a strict sending limit: 500 emails/day for free Gmail accounts, and 2,000/day for Google Workspace. 
                Pause accounts to preserve sender reputation, or reset counters manually if desired.
              </p>
            </div>
          </div>

          {/* Connected Senders List */}
          <Card className="glass-card border-border/10 shadow-lg">
            <CardHeader className="border-b border-border/10 pb-4">
              <CardTitle className="text-base font-bold text-foreground">Connected Senders ({accounts.length})</CardTitle>
              <CardDescription className="text-xs">Configure display names and status overrides per mailbox.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/10">
              {accounts.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground text-xs space-y-2">
                  <Mail className="h-8 w-8 mx-auto opacity-30 text-muted-foreground" />
                  <p>No connected Gmail senders. Click "Connect Gmail Account" to link your first mailbox.</p>
                </div>
              ) : (
                accounts.map(acct => (
                  <div key={acct.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-muted/10">
                    
                    {/* Left: Account Details */}
                    <div className="flex items-start gap-4">
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border shadow-inner ${
                        acct.status === 'paused' 
                          ? 'bg-destructive/10 text-destructive border-destructive/20' 
                          : 'bg-primary/10 text-primary border-primary/20'
                      }`}>
                        {getInitials(acct.email)}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-foreground">{acct.email}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            acct.type === 'smtp'
                              ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }`}>
                            {acct.type === 'smtp' ? 'SMTP' : 'GMAIL'}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            acct.status === 'active' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-destructive/10 text-destructive border-destructive/20'
                          }`}>
                            {acct.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {acct.daily_sent || 0} sent today 
                          {acct.last_reset ? ` · Reset: ${new Date(acct.last_reset).toLocaleDateString()}` : ''}
                          {acct.type === 'smtp' && ` · SMTP: ${acct.smtp_host}:${acct.smtp_port}`}
                        </p>
                        
                        {/* Display Name Input */}
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Set display name (e.g. Sales Team)"
                            value={editingName[acct.id] || ''}
                            onChange={e => setEditingName({ ...editingName, [acct.id]: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && handleSaveName(acct.id)}
                            className="bg-muted text-[10px] sm:text-xs rounded-lg border border-input px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary w-48 sm:w-56"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveName(acct.id)}
                            disabled={savingNameId === acct.id}
                            className="h-7 text-[10px] px-2"
                          >
                            {savingNameId === acct.id ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                        {acct.display_name && (
                          <div className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3" />
                            Sends as: <span className="underline">{acct.display_name}</span> &lt;{acct.email}&gt;
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleStatus(acct.id, acct.status)}
                        className={`h-8 gap-1 rounded-lg text-xs font-semibold ${
                          acct.status === 'active'
                            ? 'hover:bg-amber-500/10 hover:text-amber-500 border-amber-500/20'
                            : 'hover:bg-emerald-500/10 hover:text-emerald-500 border-emerald-500/20'
                        }`}
                      >
                        {acct.status === 'active' ? (
                          <>
                            <Pause className="h-3.5 w-3.5" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" />
                            <span>Resume</span>
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReset(acct.id)}
                        className="h-8 gap-1 rounded-lg text-xs font-semibold hover:bg-muted/80 border-border/40"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Reset Limit</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(acct.id, acct.email)}
                        className="h-8 gap-1 rounded-lg text-xs font-semibold hover:bg-destructive/10 hover:text-destructive border-destructive/20 text-destructive/90"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Disconnect</span>
                      </Button>
                    </div>

                  </div>
                ))
              )}
            </CardContent>
          </Card>
      </div>

      {/* SMTP Configuration Dialog */}
      <Dialog open={showSmtpModal} onOpenChange={setShowSmtpModal}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl border border-border/10 bg-background shadow-2xl p-6">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" /> Connect Custom SMTP
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add any custom SMTP mailbox (e.g. Outlook, SendGrid, Amazon SES, or custom domains) to your sender pool.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 text-xs sm:text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Display Name</label>
                <Input
                  placeholder="e.g. John Doe"
                  value={smtpDisplayName}
                  onChange={e => setSmtpDisplayName(e.target.value)}
                  className="rounded-xl border-border/40 focus-visible:ring-primary h-10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sender Email*</label>
                <Input
                  type="email"
                  placeholder="e.g. john@yourdomain.com"
                  value={smtpEmail}
                  onChange={e => setSmtpEmail(e.target.value)}
                  className="rounded-xl border-border/40 focus-visible:ring-primary h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">SMTP Host*</label>
                <Input
                  placeholder="e.g. smtp.mailgun.org"
                  value={smtpHost}
                  onChange={e => setSmtpHost(e.target.value)}
                  className="rounded-xl border-border/40 focus-visible:ring-primary h-10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Port*</label>
                <Input
                  placeholder="e.g. 587"
                  value={smtpPort}
                  onChange={e => setSmtpPort(e.target.value)}
                  className="rounded-xl border-border/40 focus-visible:ring-primary h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">SMTP Username*</label>
                <Input
                  placeholder="e.g. john@yourdomain.com"
                  value={smtpUser}
                  onChange={e => setSmtpUser(e.target.value)}
                  className="rounded-xl border-border/40 focus-visible:ring-primary h-10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">SMTP Password*</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={smtpPass}
                  onChange={e => setSmtpPass(e.target.value)}
                  className="rounded-xl border-border/40 focus-visible:ring-primary h-10"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="smtp-secure"
                checked={smtpSecure}
                onChange={e => setSmtpSecure(e.target.checked)}
                className="h-4 w-4 rounded border-border/40 text-primary focus:ring-primary bg-background"
              />
              <label htmlFor="smtp-secure" className="text-xs font-semibold text-foreground select-none cursor-pointer">
                Use SSL/TLS (Required for Port 465)
              </label>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSmtpModal(false)}
              className="rounded-xl border-border/40 font-semibold h-10 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnectSmtp}
              disabled={smtpTesting}
              className="rounded-xl peak-gradient-bg border-none text-white font-semibold h-10 px-6 w-full sm:w-auto shadow-md shadow-primary/20 flex items-center justify-center gap-2"
            >
              {smtpTesting ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              <span>{smtpTesting ? 'Verifying...' : 'Verify & Save'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
