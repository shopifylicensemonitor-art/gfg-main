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

  const { canInstall, install } = usePWAInstall();

  const handleInstall = async () => {
    const accepted = await install();
    if (accepted) {
      toast({
        title: '🎉 Installed!',
        description: 'Peakconix Sender has been added to your home screen.'
      });
    }
  };

  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

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

  const handleLockConsole = () => {
    sessionStorage.removeItem('access_pin');
    window.location.reload();
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
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-[11px] font-bold text-white shadow-sm ring-1 ring-border">
              AR
            </div>
            <span className="hidden text-xs font-semibold text-foreground md:block">Alex R.</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl animate-card-enter">
              <div className="border-b border-border px-3 py-2 pb-2 mb-1">
                <p className="text-xs font-bold text-foreground">Alex R.</p>
                <p className="text-[9px] text-muted-foreground">admin@peakconix.com</p>
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => alert('Profile settings are simulated for sandbox environment.')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>My Profile</span>
                </button>
                <button
                  onClick={() => alert('General system settings are currently managed via config files.')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={handleLockConsole}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Lock Console</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
