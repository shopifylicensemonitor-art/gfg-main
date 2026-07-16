import { Link } from 'react-router-dom';
import { Mail, MessageCircle, HelpCircle, Shield, FileText, Info, Home, Instagram, Facebook, BarChart3, BookOpen } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full py-12 mt-20 border-t border-border/40 bg-card/30 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Brand Column */}
        <div className="space-y-3 text-center md:text-left">
          <p className="text-sm font-semibold tracking-tight text-foreground/90">Peak Xender</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto md:mx-0 leading-relaxed">
            Lightning-fast bulk email outreach tool designed for speed and simplicity. 100% client-side and privacy-focused.
          </p>
          <p className="text-[10px] text-muted-foreground/60 pt-2">
            Accelerated email outreach v3.4.0
          </p>
        </div>

        {/* Navigation Column */}
        <div className="flex flex-col items-center md:items-start space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Navigation</h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-center md:text-left">
            <Link to="/send" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 justify-center md:justify-start">
              <Home className="h-3 w-3" /> Home
            </Link>
            <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 justify-center md:justify-start">
              <BarChart3 className="h-3 w-3" /> Dashboard
            </Link>
            <Link to="/tracker" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 justify-center md:justify-start">
              <FileText className="h-3 w-3" /> Tracker
            </Link>
            <Link to="/help" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 justify-center md:justify-start">
              <HelpCircle className="h-3 w-3" /> Help
            </Link>
            <Link to="/about" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 justify-center md:justify-start">
              <Info className="h-3 w-3" /> About Us
            </Link>
            <Link to="/contact" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 justify-center md:justify-start">
              <Mail className="h-3 w-3" /> Contact
            </Link>
            <Link to="/privacy" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 justify-center md:justify-start">
              <Shield className="h-3 w-3" /> Privacy
            </Link>
            <Link to="/terms" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 justify-center md:justify-start">
              <FileText className="h-3 w-3" /> Terms
            </Link>
            <Link to="/blog" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 justify-center md:justify-start">
              <BookOpen className="h-3 w-3" /> Blog
            </Link>
            <Link to="/blog/mastering-cold-email-deliverability" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 justify-center md:justify-start">
              <FileText className="h-3 w-3" /> Outreach Guide
            </Link>
          </div>
        </div>

        {/* Contact Column */}
        <div className="flex flex-col items-center md:items-start space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Get In Touch</h4>
          <div className="space-y-2 w-full max-w-[240px]">
            <a 
              href="mailto:peakconix@gmail.com" 
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/60 bg-card/50 hover:bg-primary/5 hover:border-primary/30 transition-all group"
            >
              <Mail className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors truncate">
                peakxender@gmail.com
              </span>
            </a>
            <a 
              href="https://wa.me/2347058176122" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/60 bg-card/50 hover:bg-emerald-500/5 hover:border-emerald-500/30 transition-all group"
            >
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
              <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                +234 705 817 6122
              </span>
            </a>
            <a 
              href="https://www.instagram.com/peakconix" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/60 bg-card/50 hover:bg-pink-500/5 hover:border-pink-500/30 transition-all group"
            >
              <Instagram className="h-3.5 w-3.5 text-muted-foreground group-hover:text-pink-500 transition-colors" />
              <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                @peakxender
              </span>
            </a>
            <a 
              href="https://www.facebook.com/share/18ci8zQYkf/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/60 bg-card/50 hover:bg-blue-600/5 hover:border-blue-600/30 transition-all group"
            >
              <Facebook className="h-3.5 w-3.5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
              <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                Facebook Page
              </span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
