import { memo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  LayoutDashboard, Send, Users, Flame, Layout, Inbox,
  BarChart3, Settings, History, FileText, HelpCircle,
  Shield, Scale, Building2, Mail, ChevronLeft, ChevronRight, X,
  Home, Zap
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const mainNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/campaigns', label: 'Campaigns', icon: Send },
  { path: '/contacts', label: 'Prospects', icon: Users },
  { path: '/accounts', label: 'Warm-up', icon: Flame },
  { path: '/templates', label: 'Templates', icon: Layout },
  { path: '/logs', label: 'Inbox', icon: Inbox },
  { path: '/tracker', label: 'Reports', icon: BarChart3 },
];

const secondaryNavItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/help', label: 'Guide', icon: HelpCircle },
  { path: '/about', label: 'About', icon: Building2 },
  { path: '/contact', label: 'Contact', icon: Mail },
  { path: '/privacy', label: 'Privacy', icon: Shield },
  { path: '/terms', label: 'Terms', icon: Scale },
];

export const Sidebar = memo(function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  const renderNavItem = (item: { path: string; label: string; icon: any }, isActive: boolean) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={onClose}
        title={collapsed ? item.label : undefined}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 relative ${
          isActive
            ? 'bg-primary/10 text-primary font-semibold'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
        }`}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
        )}
        <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'} transition-colors`} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {isActive && !collapsed && item.path === '/dashboard' && (
          <span className="ml-auto text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md uppercase tracking-wider">
            Active
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand Logo */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-4 py-5 border-b border-sidebar-border`}>
        <div className="h-9 w-9 rounded-lg overflow-hidden bg-card shrink-0 flex items-center justify-center">
          <img src="/logo-light.jpg" alt="Peakconix" className="h-full w-full object-contain dark:hidden" />
          <img src="/logo-dark.jpg" alt="Peakconix" className="h-full w-full object-contain hidden dark:block" />
        </div>
        {!collapsed && (
          <div className="flex flex-col -space-y-0.5 min-w-0">
            <span className="text-base font-extrabold tracking-tight text-foreground">Peakconix</span>
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">Sender Console</span>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] px-3 mb-2">
            Main Menu
          </p>
        )}
        {mainNavItems.map(item => renderNavItem(item, currentPath === item.path))}

        {/* Divider */}
        <div className="my-4 border-t border-sidebar-border" />

        {!collapsed && (
          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] px-3 mb-2">
            General
          </p>
        )}
        {secondaryNavItems.map(item => renderNavItem(item, currentPath === item.path))}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-2">
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-muted-foreground">System Online</span>
          </div>
        )}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-2`}>
          <ThemeToggle />
          {!collapsed && (
            <span className="text-[9px] font-mono text-muted-foreground/50">v3.4.0</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border z-40 transition-all duration-300 ${
          collapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        {sidebarContent}
        {/* Collapse Toggle */}
        <button
          onClick={onToggleCollapse}
          className="absolute -right-3 top-7 h-6 w-6 rounded-full border border-sidebar-border bg-sidebar flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors z-50 shadow-sm"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Mobile Overlay Drawer */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
            onClick={onClose}
          />
          <aside className="fixed left-0 top-0 h-screen w-72 bg-sidebar border-r border-sidebar-border z-50 lg:hidden animate-slide-in shadow-2xl">
            <button
              onClick={onClose}
              className="absolute right-3 top-4 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
});
