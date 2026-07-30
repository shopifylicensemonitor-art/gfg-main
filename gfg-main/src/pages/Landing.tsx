import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PinModal from '@/components/PinModal';
import { 
  Send, Sparkles, ShieldCheck, FileSpreadsheet, Lock, 
  BarChart3, RefreshCw, Layers, CheckCircle2, Terminal, 
  ArrowRight, Globe, HelpCircle, Key, Cpu, Zap
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface DemoLead {
  email: string;
  name: string;
  store: string;
  niche: string;
}

const DEMO_LEADS: DemoLead[] = [
  { email: 'alex@hostinger.com', name: 'Alex', store: 'hostinger.com', niche: 'Web Hosting' },
  { email: 'julia@nike.com', name: 'Julia', store: 'nike.com', niche: 'Athletic Wear' },
  { email: 'marcus@notion.so', name: 'Marcus', store: 'notion.so', niche: 'Productivity SaaS' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<DemoLead>(DEMO_LEADS[0]);
  const [sentLeads, setSentLeads] = useState<Record<string, boolean>>({});
  
  // Interactive variables demo state
  const [demoSubject, setDemoSubject] = useState('Quick question for {name} ({store})');
  const [demoBody, setDemoBody] = useState('Hey {name},\n\nWe love what you guys are building in the {niche} vertical. Are you currently accepting guest pitches?');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-active');
          }
        });
      },
      { threshold: 0.1 }
    );
    const sections = document.querySelectorAll('.reveal-section');
    sections.forEach((section) => observer.observe(section));
    return () => {
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);

  const handleLaunchConsole = () => {
    navigate('/send');
  };

  const handlePinSuccess = (pin: string) => {
    setShowPinModal(false);
    toast({
      title: 'Authentication Granted',
      description: 'Access authorized. Opening sending console...',
    });
    navigate('/send');
  };

  // Replace placeholders helper for demo
  const getDemoPreview = (text: string, lead: DemoLead) => {
    return text
      .replace(/{name}/g, lead.name)
      .replace(/{store}/g, lead.store)
      .replace(/{niche}/g, lead.niche);
  };

  const simulateSend = (email: string) => {
    setSentLeads(prev => ({ ...prev, [email]: true }));
    toast({
      title: 'Outbound Mail Dispatched',
      description: `Simulated mailto generated for ${email}`,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-primary/30 relative overflow-hidden scrolling-watermark">
      <SEO
        title="Peak Xender - Automated Email Outreach & Campaign Management Platform"
        description="Peak Xender is an automated email outreach platform. Connect your Gmail account via Google OAuth to personalize, schedule, and send targeted email campaigns."
        keywords={['Peak Xender', 'cold outreach', 'Gmail OAuth email sender', 'email outreach platform', 'multi-smtp warm-up']}
        canonicalUrl="https://send.peakconix.site/"
        schema={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            'name': 'Peak Xender',
            'url': 'https://send.peakconix.site/',
            'description': 'Automated email outreach and campaign management platform.'
          },
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            'name': 'Peak Xender',
            'applicationCategory': 'BusinessApplication',
            'operatingSystem': 'Web, Android, Desktop',
            'offers': {
              '@type': 'Offer',
              'price': '0.00',
              'priceCurrency': 'USD'
            }
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            'name': 'Peak Xender',
            'url': 'https://send.peakconix.site/',
            'logo': 'https://send.peakconix.site/logo-dark.jpg'
          }
        ]}
      />

      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shadow-inner">
              <img src="/logo-dark.jpg" alt="Peak Xender Logo" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="text-base font-bold tracking-tight text-white gradient-text">Peak Xender</span>
              <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-widest">Outreach Console</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#demo" className="hover:text-white transition-colors">Interactive Demo</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <Link to="/blog" className="hover:text-white transition-colors">Blog</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleLaunchConsole}
              className="h-9 gap-1.5 rounded-lg bg-primary text-white border-none font-medium px-4 shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity text-xs"
            >
              <Key className="h-3.5 w-3.5" />
              Launch Console
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 reveal-section">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold animate-pulse">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Peak Xender — Email Outreach & Campaign Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
          Peak Xender: Automated Email Outreach.<br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-emerald-400">
            Connect Gmail via OAuth & Scale Delivery.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">
          Peak Xender is an automated email outreach and campaign management platform. Connect your Gmail account securely via Google OAuth to personalize templates, manage contact lists, and schedule automated outreach campaigns.
        </p>

        <div className="flex flex-wrap justify-center gap-3 pt-3">
          <Button
            size="lg"
            onClick={handleLaunchConsole}
            className="h-11 rounded-lg px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-md transition-all flex items-center gap-2 text-xs"
          >
            Access Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
          <a href="#demo">
            <Button
              size="lg"
              variant="outline"
              className="h-11 rounded-lg px-6 border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-900 hover:text-white transition-all text-xs"
            >
              Try Interactive Demo
            </Button>
          </a>
        </div>

        {/* Dashboard Preview / Card Mockup */}
        <div className="pt-8 sm:pt-12 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-slate-900 bg-slate-950 p-1.5 shadow-2xl relative">
            <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-2xl -z-10 opacity-70" />
            <div className="rounded-xl overflow-hidden bg-slate-900/60 border border-slate-800/80 p-4 sm:p-6 text-left space-y-6">
              {/* Mock App Window Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="text-[10px] font-mono text-slate-500 ml-2">console.peakxender.app</span>
                </div>
                <Badge variant="outline" className="border-slate-800 bg-slate-950/60 text-slate-400 text-[9px] font-mono">
                  Live Analytics Active
                </Badge>
              </div>

              {/* Simulated Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Outbox Sends', val: '4,821', trend: '+14% vs avg', icon: Send, color: 'text-primary bg-primary/10' },
                  { label: 'Spam Bypass Rate', val: '99.4%', trend: 'Optimal health', icon: ShieldCheck, color: 'text-emerald-400 bg-emerald-500/10' },
                  { label: 'Active Senders', val: '12 SMTPs', trend: 'Rotations secure', icon: Cpu, color: 'text-indigo-400 bg-indigo-500/10' },
                  { label: 'Bounces Prevented', val: '143', trend: 'Auto-retries active', icon: RefreshCw, color: 'text-pink-400 bg-pink-500/10' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-slate-950/50 border border-slate-800/40 rounded-xl p-3.5 space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{item.label}</span>
                      <div className={`p-1 rounded-md ${item.color}`}>
                        <item.icon className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white">{item.val}</h4>
                      <p className="text-[9px] text-slate-500 font-semibold">{item.trend}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart Mockup */}
              <div className="bg-slate-950/40 border border-slate-800/40 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <h5 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Delivery Timeline (Rotated Batches)</h5>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="h-24 flex items-end gap-1.5 pt-4">
                  {[35, 60, 45, 90, 75, 120, 110, 80, 130, 95, 140, 160].map((h, i) => (
                    <div key={i} className="flex-1 bg-slate-950 rounded-t overflow-hidden h-full flex flex-col justify-end">
                      <div 
                        className="w-full bg-gradient-to-t from-primary to-indigo-400/80 rounded-t-sm transition-all duration-700" 
                        style={{ height: `${(h / 180) * 100}%` }} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Showcase */}
      <section id="features" className="py-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-y border-slate-900 relative reveal-section">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(124,58,237,0.06),transparent_50%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-primary font-bold">Engineered for Volume</h2>
            <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">Advanced Anti-Spam Tooling</h3>
            <p className="text-slate-400 max-w-xl mx-auto text-xs sm:text-sm">
              Standard email senders trigger fingerprint limits. Peak Xender reorganizes code structure locally to bypass automatic filtering.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento Card 1: Anti-Spam */}
            <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-6 space-y-4 hover:border-primary/30 transition-all group">
              <div className="p-3 w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-lg font-bold text-white">Smart Anti-Spam Shuffling</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Automatically randomizes space encodings (shuffling between `+` and `%20`), reorders URL parameters, and injects zero-width whitespace to destroy email copy similarity hashes.
                </p>
              </div>
            </div>

            {/* Bento Card 2: Headerless CSV Engine */}
            <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-6 space-y-4 hover:border-primary/30 transition-all group">
              <div className="p-3 w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-lg font-bold text-white">Headerless CSV Import Engine</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Imports lead lists of any layout. Automatically detects if headers are missing, checks first-row values for emails, generates unique keys, and maps variables with zero data loss.
                </p>
              </div>
            </div>

            {/* Bento Card 3: 100% Client-Side */}
            <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-6 space-y-4 hover:border-primary/30 transition-all group">
              <div className="p-3 w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Lock className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-lg font-bold text-white">100% Private & Local</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Nothing is uploaded to an external database. All parser logic, lead mappings, and email dispatch sequences execute entirely inside your own browser window.
                </p>
              </div>
            </div>

            {/* Bento Card 4: Rotated Senders */}
            <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-6 space-y-4 hover:border-primary/30 transition-all group md:col-span-2">
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                <div className="p-3 w-12 h-12 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
                  <RefreshCw className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-lg font-bold text-white">SMTP & OAuth Rotator</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Connect multiple senders securely using standard SMTP or Google OAuth. Peak Xender automatically cycles through your active sender accounts to distribute load and preserve mailbox health scores.
                  </p>
                </div>
              </div>
            </div>

            {/* Bento Card 5: Smart BCC Batches */}
            <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-6 space-y-4 hover:border-primary/30 transition-all group">
              <div className="space-y-4">
                <div className="p-3 w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Layers className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-lg font-bold text-white">Smart BCC Batching</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Send to multiple target recipients simultaneously in private BCC queues. Configurable batch sizes and self-rerouting structures automate outbox dispatch loops.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Editor Demo Section */}
      <section id="demo" className="py-20 bg-gradient-to-b from-slate-950 to-slate-900 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 reveal-section">
        <div className="text-center space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-emerald-400 font-bold">Interactive Sandbox</h2>
          <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">Live Variable Replacer</h3>
          <p className="text-slate-400 max-w-xl mx-auto text-xs sm:text-sm">
            Select a demo lead below to see placeholders replaced instantly. Generate simulated drafts locally.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left panel: editor fields (Span 5) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400">1. Select Demo Lead:</label>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_LEADS.map(lead => (
                  <button
                    key={lead.email}
                    onClick={() => setSelectedLead(lead)}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      selectedLead.email === lead.email
                        ? 'border-primary bg-primary/10 text-white'
                        : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <p className="font-bold">{lead.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{lead.store}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400">2. Subject Line Template:</label>
              <input
                type="text"
                value={demoSubject}
                onChange={e => setDemoSubject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl h-10 px-3 text-xs text-white focus:outline-none focus:border-primary font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400">3. Body Template:</label>
              <textarea
                value={demoBody}
                onChange={e => setDemoBody(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary font-mono h-32 resize-none"
              />
            </div>
          </div>

          {/* Right panel: Live compilation & simulated action (Span 7) */}
          <div className="lg:col-span-7 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500">Live Personalization Output</span>
                <span className="text-[10px] font-mono text-emerald-400">Variables replaced OK</span>
              </div>

              <div className="space-y-2.5 bg-slate-950 p-4 rounded-xl border border-slate-900/60 font-mono text-xs">
                <p className="text-slate-400"><strong className="text-slate-500">To:</strong> {selectedLead.email}</p>
                <p className="text-slate-400"><strong className="text-slate-500">Subject:</strong> {getDemoPreview(demoSubject, selectedLead)}</p>
                <div className="h-px bg-slate-900 my-2" />
                <p className="text-slate-300 whitespace-pre-wrap">{getDemoPreview(demoBody, selectedLead)}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[11px] text-slate-500">
                Placeholders used: <code className="text-primary">{`{name}`}</code>, <code className="text-primary">{`{store}`}</code>, <code className="text-primary">{`{niche}`}</code>
              </div>
              
              <Button
                disabled={!!sentLeads[selectedLead.email]}
                onClick={() => simulateSend(selectedLead.email)}
                className={`w-full sm:w-auto h-9.5 text-xs font-semibold px-5 rounded-lg flex items-center justify-center gap-1.5 ${
                  sentLeads[selectedLead.email]
                    ? 'bg-slate-800 text-slate-500 border-none'
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
              >
                {sentLeads[selectedLead.email] ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Mail Sent (Simulated)
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Dispatch Simulated Link
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Security Gating Details */}
      <section id="security" className="py-20 bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-900 relative reveal-section">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <div className="h-14 w-14 bg-primary/10 border border-primary/20 text-primary rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-inner">
            <Lock className="h-7 w-7 animate-pulse" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white">Secure Access PIN Gate</h3>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-xl mx-auto">
            Peak Xender runs as an enclosed environment. All administrative endpoints, sending lists, connected SMTP accounts, and background schedules are fully encrypted behind your local 4-digit PIN.
          </p>
          <div className="pt-2">
            <Button
              onClick={handleLaunchConsole}
              className="h-10 px-6 font-bold text-xs bg-primary hover:bg-primary/95 text-white shadow-lg"
            >
              Verify PIN to Access App
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 reveal-section">
        <div className="text-center space-y-3">
          <HelpCircle className="h-6 w-6 text-primary mx-auto" />
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white">Frequently Asked Questions</h3>
        </div>

        <div className="space-y-4">
          {[
            {
              q: 'Why run email outreach client-side?',
              a: 'Running outreach client-side allows you to personalize and build outreach sequences with zero overhead. There are no expensive monthly database fees or external cloud storages holding your contact lists. You bypass standard API limits by generating customized mailto sequences directly inside your browser window.'
            },
            {
              q: 'How does the SMTP/OAuth Rotation work?',
              a: 'You can hook up multiple SMTP configurations or connect securely using Google OAuth callback routes. Once linked, the Peak Xender automation scheduler rotates through your verified email accounts to send emails, ensuring no single mailbox is flagged for bulk outreach.'
            },
            {
              q: 'What is the purpose of the Security PIN?',
              a: 'The local Security PIN acts as an access token to gate admin functions. This prevents unauthorized users from opening your outbox console, modifying connected SMTP keys, or accessing active campaigns.'
            },
            {
              q: 'Is there any limit to the CSV parsing size?',
              a: 'None! Since the CSV parsing algorithm executes in a Web Worker, it can handle cold lists of 5,000+ leads without freezing the main browser thread. It automatically standardizes headers and removes malformed rows.'
            }
          ].map((faq, i) => (
            <div key={i} className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                <span className="text-primary font-mono">Q.</span> {faq.q}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-8 text-center text-[10px] text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span>Peak Xender Outreach Console v3.4.0</span>
          </div>
          <div className="flex gap-4">
            <Link to="/blog" className="hover:text-slate-300">Blog</Link>
            <Link to="/privacy" className="hover:text-slate-300">Privacy</Link>
            <Link to="/terms" className="hover:text-slate-300">Terms</Link>
            <Link to="/contact" className="hover:text-slate-300">Support</Link>
          </div>
        </div>
      </footer>

      {/* PIN Gate Dialog */}
      {showPinModal && (
        <PinModal
          onSuccess={handlePinSuccess}
          onCancel={() => setShowPinModal(false)}
          actionLabel="login to Peak Xender outreach console"
        />
      )}
    </div>
  );
}
