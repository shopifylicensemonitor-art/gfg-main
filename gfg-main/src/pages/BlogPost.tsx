import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, Calendar, Clock, User, Share2, 
  CheckCircle, ShieldAlert, Cpu, Heart, Check, BookOpen, ExternalLink
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [likes, setLikes] = useState(24);
  const [liked, setLiked] = useState(false);

  // Redirect if slug is not the dummy post
  useEffect(() => {
    if (slug !== 'mastering-cold-email-deliverability') {
      const timer = setTimeout(() => {
        navigate('/blog');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [slug, navigate]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast({
      title: "Link Copied!",
      description: "Post URL copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLike = () => {
    if (liked) {
      setLikes(prev => prev - 1);
      setLiked(false);
    } else {
      setLikes(prev => prev + 1);
      setLiked(true);
      toast({
        title: "Thanks for reading!",
        description: "Post added to your favorites.",
      });
    }
  };

  if (slug !== 'mastering-cold-email-deliverability') {
    return null;
  }

  return (
    <AppShell>
      <SEO
        title="Mastering Cold Email Deliverability in 2026 - Guide"
        description="Achieve 99% email deliverability. Learn the SPF, DKIM, and DMARC protocols, mailbox warmups, and client-side sender rotations to protect domain health."
        keywords={['cold email deliverability', 'email authentication protocols', 'SPF DKIM DMARC configuration', 'inbox placement warmup']}
      />

      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Back and Share Row */}
        <div className="flex items-center justify-between">
          <Link to="/blog">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground cursor-pointer -ml-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLike}
              className={`h-8 gap-1.5 rounded-lg text-xs transition-all ${
                liked ? 'border-red-500 bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'text-muted-foreground'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${liked ? 'fill-red-400 text-red-400' : ''}`} />
              <span>{likes}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Share2 className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Share'}</span>
            </Button>
          </div>
        </div>

        {/* Hero Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-primary/10 text-primary border border-primary/20 font-bold uppercase tracking-wider text-[9px]">
              Deliverability
            </Badge>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> June 20, 2026
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> 6 min read
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-foreground">
            Mastering Cold Email Deliverability in 2026: The Ultimate Guide
          </h1>
          <div className="flex items-center gap-3 pt-2">
            <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white border border-border/40">
              OE
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Outreach Expert</p>
              <p className="text-[10px] text-muted-foreground">Deliverability Engineer @ Peak Xender</p>
            </div>
          </div>
        </div>

        {/* Cover visual decorative box */}
        <div className="h-44 sm:h-64 rounded-2xl border border-border/40 bg-gradient-to-br from-primary/10 via-indigo-500/5 to-card/5 flex flex-col justify-center items-center relative overflow-hidden shadow-inner text-center p-6 sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(14,165,233,0.08),transparent_50%)] pointer-events-none" />
          <Cpu className="h-16 w-16 text-primary mb-3 sm:mb-4 animate-pulse" />
          <h3 className="text-base sm:text-xl font-bold tracking-tight text-white max-w-md uppercase font-mono">
            Inbox Placement Architecture
          </h3>
          <p className="text-xs text-slate-400 mt-2 max-w-sm sm:max-w-md">
            Learn the protocols, rotation parameters, and copywriting strategies that guarantee direct inbox delivery.
          </p>
        </div>

        {/* Article Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
          {/* Main content body (Span 8) */}
          <div className="lg:col-span-8 space-y-8 text-foreground/90 leading-relaxed font-sans">
            <p className="text-sm sm:text-base text-slate-300 font-semibold italic">
              "Deliverability is not a one-time setup. It is a continuous loop of building reputation, configuring strict protocols, and pacing your outbound volume."
            </p>

            <section className="space-y-4">
              <h2 className="text-lg sm:text-xl font-black text-foreground border-b border-border/30 pb-2">
                1. The Core Infrastructure (The Pillars)
              </h2>
              <p className="text-xs sm:text-sm">
                Before sending a single email, you must prove to receiving mail servers (Gmail, Outlook) that you are the legitimate owner of the domain. In 2026, receiving servers block unauthorized bulk emails without hesitation. Ensure you have the following records active:
              </p>
              <div className="space-y-3.5">
                <div className="flex gap-3 items-start bg-card/45 border border-border/40 p-4 rounded-xl">
                  <CheckCircle className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">SPF (Sender Policy Framework)</h4>
                    <p className="text-xs text-muted-foreground leading-normal">
                      Specifies which mail servers are authorized to send email on behalf of your domain. Only one SPF record should exist per domain.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start bg-card/45 border border-border/40 p-4 rounded-xl">
                  <CheckCircle className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">DKIM (DomainKeys Identified Mail)</h4>
                    <p className="text-xs text-muted-foreground leading-normal">
                      Adds a cryptographic digital signature to your email headers, verifying that the email was sent by the domain owner and has not been altered in transit.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start bg-card/45 border border-border/40 p-4 rounded-xl">
                  <CheckCircle className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">DMARC (Domain-based Message Authentication)</h4>
                    <p className="text-xs text-muted-foreground leading-normal">
                      Tells receiving servers what to do if SPF or DKIM checks fail. Start with a policy of <code>p=none</code> and graduate to <code>p=reject</code>.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg sm:text-xl font-black text-foreground border-b border-border/30 pb-2">
                2. Senders Rotation (Protecting Box Health)
              </h2>
              <p className="text-xs sm:text-sm">
                A single mailbox sending 500 emails a day is a red flag. The secret to scaling cold outreach is to **distribute the load**.
              </p>
              <p className="text-xs sm:text-sm">
                Using Peak Xender's <strong>Gmail Rotation Accounts</strong> feature, you can connect multiple sender profiles. The scheduler automatically cycles campaigns across your active accounts (e.g. email 1 from sender A, email 2 from sender B). This keeps individual mailbox volumes below the daily limit threshold, preventing spam flagging.
              </p>
              <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex gap-3 text-xs text-amber-500">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Reputation Warning:</strong> Do not send outreach from your primary business domain. Create secondary domain aliases (e.g., if primary is <code>mycompany.com</code>, use <code>getmycompany.com</code>) to shield your corporate email from potential blocklisting.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg sm:text-xl font-black text-foreground border-b border-border/30 pb-2">
                3. Micro-Personalization & Link Shuffling
              </h2>
              <p className="text-xs sm:text-sm">
                Spam filters use hash algorithms to check message body similarity. If they see 100 identical emails, they flag them as spam.
              </p>
              <p className="text-xs sm:text-sm">
                Peak Xender combats this by randomizing space encodings (shuffling between `+` and `%20` parameters) and substituting variables:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-muted-foreground ml-2">
                <li>Dynamic variables like <code className="bg-muted px-1 rounded">{`{name}`}</code>, <code className="bg-muted px-1 rounded">{`{store}`}</code>, and <code className="bg-muted px-1 rounded">{`{sname}`}</code> ensure every email is textually unique.</li>
                <li>Adding small dynamic signatures or custom parameters prevents filters from caching identical body templates.</li>
              </ul>
            </section>

            <section className="space-y-4 pt-2">
              <h2 className="text-lg sm:text-xl font-black text-foreground border-b border-border/30 pb-2">
                Summary Deliverability Checklist
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <li className="flex gap-2 items-center text-muted-foreground bg-muted/10 p-2.5 rounded-lg border border-border/30">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Setup SPF, DKIM, and DMARC</span>
                </li>
                <li className="flex gap-2 items-center text-muted-foreground bg-muted/10 p-2.5 rounded-lg border border-border/30">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Warm up domains for 14+ days</span>
                </li>
                <li className="flex gap-2 items-center text-muted-foreground bg-muted/10 p-2.5 rounded-lg border border-border/30">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Rotate multiple sender accounts</span>
                </li>
                <li className="flex gap-2 items-center text-muted-foreground bg-muted/10 p-2.5 rounded-lg border border-border/30">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Use custom variables &amp; encoding options</span>
                </li>
              </ul>
            </section>
          </div>

          {/* Sidebar Recommendations (Span 4) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Box 1: RFC References */}
            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Protocol Specifications</h4>
              <div className="space-y-3 text-xs">
                <p className="text-muted-foreground leading-normal">
                  Our system relies on the standardized Mailto URI scheme. Learn more by reading the official internet protocol RFC.
                </p>
                <a
                  href="https://datatracker.ietf.org/doc/html/rfc6068"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-primary hover:underline font-semibold"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Read RFC 6068 Spec</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Box 2: Quick Links */}
            <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Related Resources</h4>
              <div className="space-y-2 text-xs">
                <Link to="/help" className="block text-muted-foreground hover:text-foreground hover:underline">
                  • System Guide &amp; Setup FAQ
                </Link>
                <Link to="/about" className="block text-muted-foreground hover:text-foreground hover:underline">
                  • About Peak Xender Privacy
                </Link>
                <Link to="/contact" className="block text-muted-foreground hover:text-foreground hover:underline">
                  • System Support Desk
                </Link>
              </div>
            </div>

            {/* Box 3: Author Bio */}
            <div className="border border-border/50 rounded-xl p-5 bg-gradient-to-t from-primary/[0.02] to-transparent space-y-3 text-center">
              <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center font-black text-white border border-border/30 mx-auto text-sm">
                OE
              </div>
              <h5 className="text-xs font-bold text-white">Outreach Expert</h5>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Outreach Expert builds automation schedules and optimizes email delivery networks for high-volume outreach campaigns.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
