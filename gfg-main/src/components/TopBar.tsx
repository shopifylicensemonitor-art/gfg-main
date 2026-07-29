import { useState, useEffect, useRef } from 'react';
import { Bell, Search, ChevronDown, User, Lock, Settings, Menu, ShieldAlert, CheckCircle2, Download } from 'lucide-react';
import { api, type LogItem } from '@/api';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { toast } from '@/hooks/use-toast';

interface TopBarProps {
  onOpenSidebar: () => void;
}

export function TopBar({ onOpenSidebar }: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [recentLogs, setRecentLogs] = useState<LogItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [user, setUser] = useState<{ id: number; email: string; name: string; role: string; picture?: string } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', picture: '' });
  const [settingsForm, setSettingsForm] = useState({
    ADMIN_EMAIL: '',
    TRACKING_BASE_URL: '',
    SCHEDULER_BATCH_SIZE: '',
    DAILY_LIMIT_DEFAULT: '',
  });
  const [schedulerEnabled, setSchedulerEnabled] = useState<boolean | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const { canInstall, install } = usePWAInstall();

  const handleInstall = async () => {
    const accepted = await install();
    if (accepted) {
      toast({
        title: '🎉 Installed!',
        description: 'Peak Xender has been added to your home screen.'
      });
    }
  };

  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const fetchUser = async () => {
    try {
      const u = await api.getCurrentUser();
      setUser(u);
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    // Load recent logs to display as notifications
    const fetchLogs = async () => {
      try {
        const logs = await api.getRecentLogs(5);
        setRecentLogs(logs || []);
        // Set unread count based on failed/warning logs
        const failedLogs = logs.filter(l => l.status === 'failed' || l.status === 'error');
        setUnreadCount(failedLogs.length > 0 ? failedLogs.length : (logs.length > 0 ? 2 : 0));
      } catch (err) {
        console.error('Error fetching notifications logs:', err);
      }
    };
    fetchLogs();
    // Poll every 30 seconds for live notifications
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleOpenProfile = () => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        picture: user.picture || '',
      });
      setShowProfileModal(true);
      setShowProfileMenu(false);
    }
  };

  const handleOpenSettings = async () => {
    setShowProfileMenu(false);
    setShowSettingsModal(true);
    try {
      const s = await api.getSettings();
      setSchedulerEnabled(s.SCHEDULER_ENABLED === 'true');
      setSettingsForm({
        ADMIN_EMAIL: s.ADMIN_EMAIL || '',
        TRACKING_BASE_URL: s.TRACKING_BASE_URL || '',
        SCHEDULER_BATCH_SIZE: String(s.SCHEDULER_BATCH_SIZE || ''),
        DAILY_LIMIT_DEFAULT: String(s.DAILY_LIMIT_DEFAULT || ''),
      });
    } catch (err) {
      console.error('Failed to load system configurations:', err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.updateProfile(profileForm.name, profileForm.picture);
      toast({
        title: 'Success',
        description: 'Profile updated successfully.'
      });
      setShowProfileModal(false);
      fetchUser();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update profile.',
        variant: 'destructive'
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.updateSettings({
        ADMIN_EMAIL: settingsForm.ADMIN_EMAIL,
        TRACKING_BASE_URL: settingsForm.TRACKING_BASE_URL,
        SCHEDULER_BATCH_SIZE: settingsForm.SCHEDULER_BATCH_SIZE,
        DAILY_LIMIT_DEFAULT: settingsForm.DAILY_LIMIT_DEFAULT,
      });
      toast({
        title: 'Success',
        description: 'System configurations updated successfully.'
      });
      setShowSettingsModal(false);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save settings.',
        variant: 'destructive'
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  };

  const handleClearNotifications = () => {
    setUnreadCount(0);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/60 px-6 backdrop-blur-md">
      {/* Left side: Hamburger menu & Search */}
      <div className="flex flex-1 items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative w-full max-w-xs md:max-w-sm hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Quick search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-border bg-muted/40 py-1.5 pl-10 pr-4 text-xs text-foreground placeholder-muted-foreground/50 transition-all focus:border-primary/50 focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Right side: Notifications, Profile */}
      <div className="flex items-center gap-4">
        {canInstall && (
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 text-xs font-semibold border border-primary/20 transition-all hover:scale-[1.02]"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Install App</span>
            <span className="sm:hidden">Install</span>
          </button>
        )}

        {/* Notification Bell */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-background">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-card p-2 shadow-xl animate-card-enter">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 pb-2">
                <span className="text-xs font-bold text-foreground">Recent Activity</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleClearNotifications}
                    className="text-[10px] font-medium text-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {recentLogs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No recent events.
                  </div>
                ) : (
                  recentLogs.map((log) => (
                    <div key={log.id} className="flex gap-2.5 border-b border-border/40 px-3 py-2 text-left hover:bg-muted/30 transition-colors last:border-b-0">
                      <div className="mt-0.5 shrink-0">
                        {log.status === 'sent' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 text-rose-500" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-medium text-foreground truncate">
                          {log.recipient_email || 'System'}
                        </span>
                        <span className="text-[10px] text-muted-foreground line-clamp-2">
                          {log.message || (log.status === 'sent' ? 'Email sent successfully' : 'Delivery failed')}
                        </span>
                        <span className="text-[9px] text-muted-foreground/50 mt-0.5">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {user ? (
              <>
                <div className="h-8 w-8 rounded-full overflow-hidden shadow-sm ring-1 ring-border shrink-0">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-[11px] font-bold text-white">
                      {getInitials(user.name)}
                    </div>
                  )}
                </div>
                <span className="hidden text-xs font-semibold text-foreground md:block truncate max-w-[100px]">
                  {user.name}
                </span>
              </>
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl animate-card-enter">
              <div className="border-b border-border px-3 py-2 pb-2 mb-1">
                <p className="text-xs font-bold text-foreground truncate">{user?.name || 'Administrator'}</p>
                <p className="text-[9px] text-muted-foreground truncate">{user?.email || 'admin@peakxender.com'}</p>
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={handleOpenProfile}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>My Profile</span>
                </button>
                <button
                  onClick={handleOpenSettings}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile Settings Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border shadow-2xl rounded-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold tracking-tight mb-1">Admin Profile Settings</h3>
            <p className="text-xs text-muted-foreground mb-4">Update your administrative profile details.</p>
            
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-muted focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Profile Photo URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={profileForm.picture}
                  onChange={e => setProfileForm({ ...profileForm, picture: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-muted focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-0.5">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-border bg-muted/40 text-muted-foreground cursor-not-allowed outline-none"
                />
                <span className="text-[10px] text-muted-foreground/60">Email address is managed via your Google account credentials.</span>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-input hover:bg-muted text-foreground transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 transition disabled:opacity-50"
                >
                  {savingProfile ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* System Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border shadow-2xl rounded-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold tracking-tight mb-1">System Control Panel</h3>
            <p className="text-xs text-muted-foreground mb-4">Configure system parameters and deployment settings.</p>
            <div className={`rounded-2xl border p-4 mb-4 ${schedulerEnabled === null ? 'bg-muted/30 border-border text-muted-foreground' : schedulerEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide">Background Scheduler</p>
              <p className="mt-1 text-[11px] leading-5">
                {schedulerEnabled === null
                  ? 'Loading scheduler status…'
                  : schedulerEnabled
                    ? 'Scheduler is enabled on this server. Campaign launch actions may proceed.'
                    : 'Scheduler is disabled on this server. Campaign launch actions are blocked until it is enabled.'
                }
              </p>
            </div>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Authorized Admin Email</label>
                <input
                  type="email"
                  placeholder="admin@example.com"
                  value={settingsForm.ADMIN_EMAIL}
                  onChange={e => setSettingsForm({ ...settingsForm, ADMIN_EMAIL: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-muted focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none"
                />
                <span className="text-[10px] text-muted-foreground/60">Restricts Google logins to this email address. Leave blank for unrestricted access.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Tracking Base URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://mailflow.onrender.com"
                  value={settingsForm.TRACKING_BASE_URL}
                  onChange={e => setSettingsForm({ ...settingsForm, TRACKING_BASE_URL: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-muted focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none"
                />
                <span className="text-[10px] text-muted-foreground/60">External address used for link redirection and pixel open-tracking callbacks.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Scheduler Batch Size</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={settingsForm.SCHEDULER_BATCH_SIZE}
                    onChange={e => setSettingsForm({ ...settingsForm, SCHEDULER_BATCH_SIZE: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-muted focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Default Daily limit</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={settingsForm.DAILY_LIMIT_DEFAULT}
                    onChange={e => setSettingsForm({ ...settingsForm, DAILY_LIMIT_DEFAULT: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-muted focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-input hover:bg-muted text-foreground transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 transition disabled:opacity-50"
                >
                  {savingSettings ? 'Saving Configurations...' : 'Save Configurations'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
