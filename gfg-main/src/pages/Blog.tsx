import { Link } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ArrowRight, ExternalLink, Calendar, Clock, User, HelpCircle, ArrowLeft } from 'lucide-react';

interface BlogPost {
  title: string;
  slug: string;
  description: string;
  date: string;
  readTime: string;
  author: string;
  tag: string;
  linkType: 'internal' | 'external' | 'help';
  url: string;
}

const POSTS: BlogPost[] = [
  {
    title: "Mastering Cold Email Deliverability in 2026",
    slug: "mastering-cold-email-deliverability",
    description: "Learn the secrets to achieving a 99% deliverability rate, optimizing SMTP settings, avoiding spam filters, and maximizing your email campaign outreach success.",
    date: "June 20, 2026",
    readTime: "6 min read",
    author: "Outreach Expert",
    tag: "Deliverability",
    linkType: "internal",
    url: "/blog/mastering-cold-email-deliverability",
  },
  {
    title: "Bypassing Spam Filters with Smart Encoding",
    slug: "bypassing-spam-filters-encoding",
    description: "Dive deep into the algorithms of Peak Xender. Discover how randomizing space encodings, shuffling params, and zero-width whitespaces destroy similarity hashes.",
    date: "June 15, 2026",
    readTime: "4 min read",
    author: "Peak Team",
    tag: "Security & Tech",
    linkType: "help",
    url: "/help",
  },
  {
    title: "RFC 6068: The Mailto URI Scheme Spec",
    slug: "rfc-6068-mailto-spec",
    description: "Read the official Internet Engineering Task Force (IETF) specification for Mailto URIs. Understand query parameters, encoding rules, and implementation standards.",
    date: "May 28, 2026",
    readTime: "12 min read",
    author: "IETF Standards",
    tag: "Protocol Spec",
    linkType: "external",
    url: "https://datatracker.ietf.org/doc/html/rfc6068",
  },
  {
    title: "Setting Up Google OAuth for Rotating Mailboxes",
    slug: "setup-google-oauth-sending",
    description: "A comprehensive walkthrough on configuring Google Cloud Console, setting up OAuth consent screen, and generating keys for rotating Gmail mailboxes securely.",
    date: "May 10, 2026",
    readTime: "8 min read",
    author: "Dev Ops",
    tag: "Integration Guide",
    linkType: "help",
    url: "/help",
  },
];

export default function Blog() {
  return (
    <AppShell>
      <SEO
        title="Resources & Blog - Cold Email Tips & System Updates"
        description="Learn tips, tricks, and specifications for cold outreach. Read guides on mailto URI RFC 6068, spam-bypass encoding, Google OAuth rotation configuration, and email marketing."
        keywords={['Peak Xender blog', 'cold email guide', 'mailto RFC 6068', 'bypass email spam filters', 'Google OAuth setup']}
      />

      <div className="space-y-10">
        {/* Header Section */}
        <div className="flex flex-col gap-2">
          <Link to="/send">
            <Button variant="ghost" size="sm" className="w-fit -ml-2 text-muted-foreground hover:text-foreground cursor-pointer">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <div className="h-10 w-10 bg-primary/10 border border-primary/20 text-primary rounded-xl flex items-center justify-center shadow-inner">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-3xl font-black tracking-tighter sm:text-4xl">
                Resources &amp; Blog
              </h1>
              <p className="text-muted-foreground text-sm">Outreach secrets, technical standards, and Peak Xender tips</p>
            </div>
          </div>
        </div>

        {/* Featured Post Card */}
        <div className="reveal-section border-primary/20 border rounded-2xl bg-gradient-to-r from-primary/[0.04] to-indigo-500/[0.02] overflow-hidden shadow-sm relative group">
          <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start justify-between relative z-10">
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/20 font-bold uppercase tracking-wider text-[9px]">
                  Featured Post
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
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground group-hover:text-primary transition-colors leading-tight">
                Mastering Cold Email Deliverability in 2026: The Ultimate Guide
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Achievement of high deliverability is the holy grail of cold outreach. In this comprehensive guide, we cover SPF, DKIM, DMARC configurations, mailbox warmup strategies, and how to utilize client-side rotations to protect domain reputation.
              </p>
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-white">
                  OE
                </div>
                <span className="text-xs font-semibold text-muted-foreground">Written by Outreach Expert</span>
              </div>
            </div>
            <Link to="/blog/mastering-cold-email-deliverability" className="shrink-0 mt-4 md:mt-0">
              <Button className="rounded-xl group shadow-lg peak-gradient-bg text-white border-none gap-2 hover:opacity-95 font-semibold text-xs py-5 px-6">
                Read Post
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Blog Post Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {POSTS.filter(p => p.slug !== "mastering-cold-email-deliverability").map((post) => (
            <Card key={post.slug} className="border-border/60 hover:border-primary/30 bg-card/20 backdrop-blur-sm shadow-sm transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge variant="outline" className="border-border/60 text-muted-foreground font-semibold text-[10px] tracking-wider uppercase">
                    {post.tag}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                    <Clock className="h-3 w-3" /> {post.readTime}
                  </div>
                </div>
                <CardTitle className="text-base font-black leading-tight text-foreground group-hover:text-primary transition-colors">
                  {post.title}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {post.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 border-t border-border/30 mt-auto py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                  <User className="h-3 w-3" /> {post.author}
                </div>
                {post.linkType === 'external' ? (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline cursor-pointer"
                  >
                    <span>Read RFC Spec</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : post.linkType === 'help' ? (
                  <Link
                    to={post.url}
                    className="inline-flex items-center gap-1 text-xs text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    <span>Help Guide</span>
                    <HelpCircle className="h-3 w-3" />
                  </Link>
                ) : (
                  <Link
                    to={post.url}
                    className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline cursor-pointer"
                  >
                    <span>Read Post</span>
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
