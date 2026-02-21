import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/10 bg-background/0 backdrop-blur-md px-3 sm:px-4 py-3 sm:py-4">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <div className="glass-card rounded-2xl px-4 py-2 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
            <span className="text-primary-foreground text-md font-bold">X</span>
          </div>
          <div className="flex flex-col -space-y-1">
            <span className="text-lg font-bold tracking-tight gradient-text">Peak-X</span>
            <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-widest">Sender</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/help" title="Detailed System Guide">
            <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-primary transition-colors pr-3 opacity-90 hover:opacity-100">
              <HelpCircle className="h-4.5 w-4.5" />
              <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider">Full Guide</span>
            </Button>
          </Link>
          <Badge className="glass-card bg-primary/5 text-primary border-primary/20 text-[9px] px-2 h-6 sm:text-[10px] sm:px-3 sm:h-7">v3.2.0</Badge>
          <div className="h-8 w-px bg-border/50 mx-1" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

