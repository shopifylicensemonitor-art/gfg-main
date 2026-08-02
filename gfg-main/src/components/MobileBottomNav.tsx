import { memo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Send, LayoutDashboard, RefreshCw, Inbox, MoreHorizontal,
  Users, Flame, Layout, Sparkles, BarChart3, Settings, Home,
  HelpCircle, Building2, Mail, Shield, Scale, X
} from 'lucide-react';

const primaryTabs = [
  { path: '/send', label: 'Send', icon: Send },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/campaigns', label: 'Campaigns', icon: RefreshCw },
  { path: '/inbox', label: 'Inbox', icon: Inbox },
];

const moreItems = [
  { path: '/contacts', label: 'Prospects', icon: Users },
  { path: '/accounts', label: 'Warm-up', icon: Flame },
  { path: '/templates', label: 'Templates', icon: Layout },
  { path: '/ai-settings', label: 'AI & SOP', icon: Sparkles },
  { path: '/tracker', label: 'Reports', icon: BarChart3 },
  { path: '/', label: 'Home', icon: Home },
  { path: '/help', label: 'Guide', icon: HelpCircle },
  { path: '/about', label: 'About', icon: Building2 },
  { path: '/contact', label: 'Contact', icon: Mail },
  { path: '/privacy', label: 'Privacy', icon: Shield },
  { path: '/terms', label: 'Terms', icon: Scale },
];

export const MobileBottomNav = memo(function MobileBottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;
  const [showMore, setShowMore] = useState(false);

  // Check if "More" section has any active item
  const isMoreActive = moreItems.some(item => currentPath === item.path);

  return (
    <>
      {/* More Sheet Overlay */}
      {showMore && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90] lg:hidden animate-fade-in"
            onClick={() => setShowMore(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[91] lg:hidden animate-slide-up">
            <div className="bg-card border-t border-x border-border rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto">
              {/* Sheet Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">More Options</h3>
                <button
                  onClick={() => setShowMore(false)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Grid of Items */}
              <div className="grid grid-cols-4 gap-1 p-4">
                {moreItems.map(item => {
                  const Icon = item.icon;
                  const isActive = currentPath === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setShowMore(false)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all active:scale-95 ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-[10px] font-medium leading-tight text-center">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Bottom safe area */}
              <div className="h-[env(safe-area-inset-bottom,0px)]" />
            </div>
          </div>
        </>
      )}

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[80] lg:hidden">
        <div className="bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <div className="flex items-stretch justify-around px-1">
            {primaryTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = currentPath === tab.path;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[64px] relative transition-all active:scale-95 ${
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  {/* Active indicator dot */}
                  {isActive && (
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-primary rounded-full animate-scale-in" />
                  )}
                  <Icon className={`h-5 w-5 transition-all ${isActive ? 'scale-110' : ''}`} />
                  <span className={`text-[10px] leading-tight font-medium ${isActive ? 'font-bold' : ''}`}>
                    {tab.label}
                  </span>
                </Link>
              );
            })}

            {/* More Tab */}
            <button
              onClick={() => setShowMore(true)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[64px] relative transition-all active:scale-95 ${
                isMoreActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              {isMoreActive && (
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-primary rounded-full animate-scale-in" />
              )}
              <MoreHorizontal className={`h-5 w-5 transition-all ${isMoreActive ? 'scale-110' : ''}`} />
              <span className={`text-[10px] leading-tight font-medium ${isMoreActive ? 'font-bold' : ''}`}>
                More
              </span>
            </button>
          </div>

          {/* Safe area padding for notched phones */}
          <div className="h-[env(safe-area-inset-bottom,0px)] bg-card/95" />
        </div>
      </nav>
    </>
  );
});
