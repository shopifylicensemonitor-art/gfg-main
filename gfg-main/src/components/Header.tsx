import { memo, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HelpCircle, Download, LayoutGrid, Shield, Scale, Building2, Mail, Menu, Home, FileText, BarChart3, Bell, Users, Send, Layout, History, BookOpen } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useDailyCounter } from '@/hooks/useDailyCounter';

interface HeaderProps {
  canInstall?: boolean;
  onInstall?: () => void;
}

export const Header = memo(function Header({ canInstall, onInstall }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const [isOpen, setIsOpen] = useState(false);
  const { count: dailyCount } = useDailyCounter();

  const navItems = [
    { path: '/send', label: 'Home', icon: LayoutGrid },
    { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/accounts', label: 'Accounts', icon: Mail },
    { path: '/campaigns', label: 'Campaigns', icon: Send },
    { path: '/templates', label: 'Templates', icon: Layout },
    { path: '/contacts', label: 'Leads', icon: Users },
    { path: '/logs', label: 'Audit Logs', icon: History },
    { path: '/tracker', label: 'Tracker', icon: FileText },
    { path: '/help', label: 'Guide', icon: HelpCircle },
    { path: '/blog', label: 'Blog', icon: BookOpen },
    { path: '/privacy', label: 'Privacy', icon: Shield },
    { path: '/terms', label: 'Terms', icon: Scale },
    { path: '/about', label: 'About', icon: Building2 },
    { path: '/contact', label: 'Contact', icon: Mail },
  ];

  const handleNavigateToSection = (sectionId: string) => {
    if (location.pathname === '/send') {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      navigate(`/send?scroll=${sectionId}`);
    }
  };

  return (
    <header className="w-full border-b border-border/10 bg-background/0 px-3 sm:px-4 py-3 sm:py-4">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <div className="glass-card rounded-2xl px-4 py-2 flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center shrink-0 rounded-lg overflow-hidden bg-card">
            <img 
              src="/logo-light.jpg" 
              alt="Peak Xender Logo" 
              className="h-full w-full object-contain dark:hidden" 
            />
            <img 
              src="/logo-dark.jpg" 
              alt="Peak Xender Logo" 
              className="h-full w-full object-contain hidden dark:block" 
            />
          </div>
          <div className="flex flex-col -space-y-1">
            <span className="text-lg font-bold tracking-tight gradient-text">Peak Xender</span>
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Sender</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {canInstall && (
            <Button
              size="sm"
              onClick={onInstall}
              className="h-8 gap-1.5 rounded-xl peak-gradient-bg border-none text-white font-medium px-3 shadow-md shadow-primary/20 hover:opacity-90 transition-opacity text-[11px]"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Install App</span>
              <span className="sm:hidden">Install</span>
            </Button>
          )}
          <Link to="/help" title="Detailed System Guide" className="hidden sm:inline-block">
            <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-primary transition-colors pr-3 opacity-90 hover:opacity-100">
              <HelpCircle className="h-4.5 w-4.5" />
              <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider">Full Guide</span>
            </Button>
          </Link>
          <Badge className="glass-card bg-primary/5 text-primary border-primary/20 text-[9px] px-2 h-6 sm:text-[10px] sm:px-3 sm:h-7 hidden sm:inline-flex">v3.4.0</Badge>
          <div className="h-8 w-px bg-border/50 mx-1 hidden sm:block" />
          <ThemeToggle />

          {/* Navigation Hamburger Menu */}
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                aria-label="Open menu"
                aria-expanded={isOpen}
                aria-controls="nav-dialog"
                id="nav-trigger"
                className="h-8 w-8 rounded-xl hover:bg-muted/50 border border-border/20 text-muted-foreground hover:text-foreground relative transition-colors sm:hidden"
                title="Open Menu"
              >
                <Menu className="h-4.5 w-4.5" aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <DialogContent id="nav-dialog" className="sm:max-w-md border-border bg-background/95 backdrop-blur-md p-5 rounded-2xl animate-in zoom-in-95 duration-200">
              <div className="space-y-4 pt-2">
                {/* Brand Header */}
                <div className="flex items-center gap-3 pb-3 border-b border-border/40">
                  <div className="flex h-9 w-9 items-center justify-center shrink-0 rounded-lg overflow-hidden bg-card">
                    <img 
                      src="/logo-light.jpg" 
                      alt="Peak Xender Logo" 
                      className="h-full w-full object-contain dark:hidden" 
                    />
                    <img 
                      src="/logo-dark.jpg" 
                      alt="Peak Xender Logo" 
                      className="h-full w-full object-contain hidden dark:block" 
                    />
                  </div>
                  <div className="flex flex-col -space-y-1">
                    <span className="text-base font-bold tracking-tight gradient-text">Peak Xender Console</span>
                    <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-widest">Outreach Console Menu</span>
                  </div>
                </div>

                {/* Dashboard / Main Actions */}
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-1.5">Outreach Dashboard Tools</p>
                  <div className="grid grid-cols-1 gap-1">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        if (location.pathname !== '/send') {
                          navigate('/send');
                        } else {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors text-left"
                    >
                      <Home className="h-4 w-4 text-primary" />
                      <span>Outreach Home &amp; Stats</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsOpen(false);
                        handleNavigateToSection('main-input-section');
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors text-left"
                    >
                      <FileText className="h-4 w-4 text-primary" />
                      <span>Import CSV &amp; Templates</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsOpen(false);
                        handleNavigateToSection('generated-emails-section');
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors text-left"
                    >
                      <Mail className="h-4 w-4 text-primary" />
                      <span>List &amp; Leads Preview</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/dashboard');
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors text-left"
                    >
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <span>Live Analytics Dashboard</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/accounts');
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors text-left"
                    >
                      <Mail className="h-4 w-4 text-primary" />
                      <span>Gmail Rotation Accounts</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/campaigns');
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors text-left"
                    >
                      <Send className="h-4 w-4 text-primary" />
                      <span>Campaigns Scheduler</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/templates');
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors text-left"
                    >
                      <Layout className="h-4 w-4 text-primary" />
                      <span>Templates Library</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/contacts');
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors text-left"
                    >
                      <Users className="h-4 w-4 text-primary" />
                      <span>Leads &amp; Lists Manager</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/logs');
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors text-left"
                    >
                      <History className="h-4 w-4 text-primary" />
                      <span>Scheduler Audit Logs</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/tracker');
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors text-left"
                    >
                      <FileText className="h-4 w-4 text-primary" />
                      <div className="flex items-center justify-between w-full">
                        <span>Outreach Sent Tracker</span>
                        {dailyCount > 0 && (
                          <Badge variant="outline" className="text-[9px] h-4.5 px-1 border-primary/20 text-primary bg-primary/5 shrink-0">
                            {dailyCount} sent
                          </Badge>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsOpen(false);
                        handleNavigateToSection('goal-alarm-section');
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors text-left"
                    >
                      <Bell className="h-4 w-4 text-primary" />
                      <span>Goal &amp; Alarm Status</span>
                    </button>
                  </div>
                </div>

                {/* General Pages */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-1.5">General Pages</p>
                  <div className="grid grid-cols-2 gap-1">
                    <Link
                      to="/help"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>System Guide</span>
                    </Link>
                    <Link
                      to="/about"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>About Us</span>
                    </Link>
                    <Link
                      to="/contact"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Contact</span>
                    </Link>
                    <Link
                      to="/privacy"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Privacy Policy</span>
                    </Link>
                    <Link
                      to="/terms"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <Scale className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Terms of Use</span>
                    </Link>
                    <Link
                      to="/blog"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Blog &amp; Resources</span>
                    </Link>
                  </div>
                </div>

                <div className="text-[9px] text-muted-foreground text-center font-mono pt-1">
                  Peak Xender v3.4.0 • Local Client-Side Exec
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Horizontally scrollable navigation row - hidden on mobile (under 640px) */}
      <div className="mx-auto max-w-4xl mt-3.5 hidden sm:block">
        <div 
          className="flex items-center gap-1 overflow-x-auto py-1.5 bg-muted/40 dark:bg-muted/15 backdrop-blur-md rounded-2xl border border-border/20 shadow-sm px-1.5 scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-200 shrink-0 select-none cursor-pointer border ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 border-primary scale-[1.02]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {item.path === '/tracker' && dailyCount > 0 && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                    isActive 
                      ? 'bg-primary-foreground text-primary' 
                      : 'bg-primary/10 text-primary border border-primary/20'
                  }`}>
                    {dailyCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
});
