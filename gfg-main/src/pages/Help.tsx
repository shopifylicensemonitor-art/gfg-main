import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft, Zap, Upload, Search, FlaskConical,
    AlertTriangle, HelpCircle, CheckCircle2, XCircle, Clock,
    Download, BarChart3, Keyboard, Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Help() {
    return (
        <AppShell>
            <SEO
                title="Full Guide & FAQ - Bulk Email Outreach Tips"
                description="Learn how to master Peakconix Sender. Read step-by-step guides on bulk email uploads, custom variable replacements, performance optimization, keyboard shortcuts, and FAQs."
                keywords={[
                  'Peakconix Sender guide',
                  'bulk email outreach tips',
                  'cold email FAQ',
                  'email outreach variable help',
                  'PWA email install guide'
                ]}
                schema={{
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  'mainEntity': [
                    {
                      '@type': 'Question',
                      'name': 'Is my data uploaded to any server?',
                      'acceptedAnswer': {
                        '@type': 'Answer',
                        'text': 'No. All processing happens 100% client-side. No data ever leaves your machine.'
                      }
                    },
                    {
                      '@type': 'Question',
                      'name': 'How is \'Sent\' status tracked?',
                      'acceptedAnswer': {
                        '@type': 'Answer',
                        'text': 'When you click an email row, it\'s marked as \'sent\' in LocalStorage. This persists across refreshes.'
                      }
                    },
                    {
                      '@type': 'Question',
                      'name': 'Can I use this on mobile?',
                      'acceptedAnswer': {
                        '@type': 'Answer',
                        'text': 'Yes. Install it as a PWA (Progressive Web App) for the best experience. Mailto behavior varies by device.'
                      }
                    },
                    {
                      '@type': 'Question',
                      'name': 'Can I export my list?',
                      'acceptedAnswer': {
                        '@type': 'Answer',
                        'text': 'Yes! Use the Download button in the Generated Emails section to export as CSV. You can filter by All, Sent, or Pending before exporting.'
                      }
                    },
                    {
                      '@type': 'Question',
                      'name': 'What happens when I clear all history?',
                      'acceptedAnswer': {
                        '@type': 'Answer',
                        'text': 'A confirmation dialog will appear first. Clearing removes all emails, sent status, counters, and milestone progress. Your template text is preserved.'
                      }
                    },
                    {
                      '@type': 'Question',
                      'name': 'How long is analytics data stored?',
                      'acceptedAnswer': {
                        '@type': 'Answer',
                        'text': 'Daily activity is stored for 37 days (30 days for the monthly view + 7-day buffer). Older data is automatically pruned.'
                      }
                    },
                    {
                      '@type': 'Question',
                      'name': 'Why were spaces showing as "+" in my emails?',
                      'acceptedAnswer': {
                        '@type': 'Answer',
                        'text': 'This was a bug in v3.3.0 where the anti-spam randomizer encoded spaces as "+" instead of "%20". The mailto: URI spec requires %20 for spaces. Fixed in v3.4.0.'
                      }
                    },
                    {
                      '@type': 'Question',
                      'name': 'I see visual glitches or static lines on my phone. What do I do?',
                      'acceptedAnswer': {
                        '@type': 'Answer',
                        'text': 'This was a GPU rendering issue on some Android devices caused by semi-transparent backgrounds. Fixed in v3.4.0. Clear your browser cache and reload to get the latest version.'
                      }
                    }
                  ]
                }}
            />
            <div className="space-y-10">
                {/* Back & Title */}
                <div className="flex flex-col gap-2">
                    <Link to="/">
                        <Button variant="ghost" size="sm" className="w-fit -ml-2 text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Dashboard
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-black tracking-tighter sm:text-4xl mt-2">
                        Complete User Guide
                    </h1>
                    <p className="text-muted-foreground">Everything you need to know about using Peakconix Sender v3.4.0</p>
                </div>

                {/* Quick Navigation */}
                <nav className="flex flex-wrap gap-2 border-b border-border pb-4">
                    <a href="#whats-new" className="text-sm text-primary hover:underline">What's New</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#getting-started" className="text-sm text-primary hover:underline">Getting Started</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#personalization" className="text-sm text-primary hover:underline">Personalization</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#search" className="text-sm text-primary hover:underline">Search & Filter</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#file-upload" className="text-sm text-primary hover:underline">File Uploads</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#analytics" className="text-sm text-primary hover:underline">Analytics</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#export" className="text-sm text-primary hover:underline">Export</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#pwa" className="text-sm text-primary hover:underline">Install as App</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#shortcuts" className="text-sm text-primary hover:underline">Shortcuts</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#performance" className="text-sm text-primary hover:underline">Performance</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#troubleshooting" className="text-sm text-primary hover:underline">Troubleshooting</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#faq" className="text-sm text-primary hover:underline">FAQ</a>
                </nav>

                {/* What's New in v3.4.0 */}
                <section id="whats-new" className="scroll-mt-20">
                    <Card className="border-primary/30 shadow-sm bg-primary/[0.02]">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-primary" />
                                <CardTitle>What's New in v3.4.0</CardTitle>
                            </div>
                            <CardDescription>Released May 2026</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3 text-sm text-muted-foreground">
                            <div className="flex gap-2">
                                <Badge variant="secondary" className="shrink-0 h-5">Fix</Badge>
                                <p><strong>Mailto space encoding:</strong> Resolved an issue where spaces in email subjects and bodies appeared as "+" signs in certain mail clients (Gmail, Outlook mobile). Spaces are now always encoded as %20 per RFC 6068.</p>
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="secondary" className="shrink-0 h-5">Fix</Badge>
                                <p><strong>Mobile rendering:</strong> Fixed a visual glitch on some Android devices where horizontal static lines appeared over the Live Dashboard cards due to GPU compositor issues with transparent backgrounds.</p>
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="secondary" className="shrink-0 h-5">New</Badge>
                                <p><strong>SEO optimization:</strong> Added dynamic page-level metadata, Open Graph tags, Twitter Cards, and structured JSON-LD schemas (WebApplication, FAQPage, ContactPage) across all pages for improved search engine visibility.</p>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Getting Started */}
                <section id="getting-started" className="scroll-mt-20">
                    <Card className="border-primary/20 shadow-sm">
                        <CardHeader className="bg-primary/[0.03]">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-success" />
                                <CardTitle>Getting Started</CardTitle>
                            </div>
                            <CardDescription>Your first outreach in 3 steps</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                                <li><strong>Paste or Upload Emails:</strong> Type email addresses directly into the textarea, or click <Badge variant="outline">Upload List</Badge> to import a .txt or .csv file.</li>
                                <li><strong>Compose Your Template:</strong> Fill in the Subject and Body fields. Use variables like <code className="bg-muted px-1 rounded">{'{name}'}</code>, <code className="bg-muted px-1 rounded">{'{store}'}</code>, <code className="bg-muted px-1 rounded">{'{sname}'}</code>, or <code className="bg-muted px-1 rounded">{'{brand}'}</code> for personalization.</li>
                                <li><strong>Generate & Send:</strong> Click <Badge variant="secondary">Generate Emails</Badge> (or press <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">Ctrl+Enter</kbd>). Your list appears below. Click any email row to open your mail client with the pre-filled message.</li>
                            </ol>
                            <p className="text-xs text-amber-600 flex items-center gap-2">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                Peakconix uses <code>mailto:</code> links. You must have a mail client configured (Gmail, Outlook, Apple Mail, etc).
                            </p>
                        </CardContent>
                    </Card>
                </section>

                {/* Personalization Variables */}
                <section id="personalization" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-primary" />
                                <CardTitle>Personalization Variables</CardTitle>
                            </div>
                            <CardDescription>Personalize messages using contact details</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary/80">Automated Variables</h4>
                                    <ul className="space-y-3 text-sm">
                                        <li className="flex gap-2">
                                            <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-bold shrink-0">{'{name}'}</code>
                                            <span className="text-muted-foreground">Local part of email. <span className="text-[10px] opacity-70">john@host.com → "john"</span></span>
                                        </li>
                                        <li className="flex gap-2">
                                            <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-bold shrink-0">{'{store}'}</code>
                                            <span className="text-muted-foreground">Full domain. <span className="text-[10px] opacity-70">info@apple.com → "apple.com"</span></span>
                                        </li>
                                        <li className="flex gap-2">
                                            <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-bold shrink-0">{'{sname}'}</code>
                                            <span className="text-muted-foreground">Brand name (no TLD). <span className="text-[10px] opacity-70">hi@tesla.io → "tesla"</span></span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="bg-secondary/20 border border-border/50 rounded-lg p-4">
                                    <h4 className="text-xs font-bold uppercase tracking-widest mb-2">Custom Signature</h4>
                                    <div className="flex gap-2 text-sm">
                                        <code className="bg-primary/10 px-1.5 py-0.5 rounded text-primary font-bold shrink-0">{'{brand}'}</code>
                                        <span className="text-muted-foreground">Maps to the "My Identity / Name" field.</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-3 italic">Example: "Hi {'{name}'}, checking out {'{sname}'}. Best, {'{brand}'}"</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Search & Filter */}
                <section id="search" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Search className="h-5 w-5 text-blue-500" />
                                <CardTitle>Search & Filter</CardTitle>
                            </div>
                            <CardDescription>Find any email in your generated list instantly</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <p className="text-sm text-muted-foreground">Use the <strong>global search bar</strong> at the top to filter your email list. Text matching highlights results in the list.</p>
                            <div className="grid sm:grid-cols-3 gap-3 text-sm">
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <Badge variant="secondary" className="mb-2">All</Badge>
                                    <p className="text-muted-foreground">Show all emails in the generated list.</p>
                                </div>
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <Badge variant="secondary" className="mb-2">Sent</Badge>
                                    <p className="text-muted-foreground">Show only emails already marked as sent.</p>
                                </div>
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <Badge variant="secondary" className="mb-2">Pending</Badge>
                                    <p className="text-muted-foreground">Show only unsent emails remaining.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Test Email */}
                <section id="test-email" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <FlaskConical className="h-5 w-5 text-purple-500" />
                                <CardTitle>Test Email Preview</CardTitle>
                            </div>
                            <CardDescription>Preview your template before mass sending</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 text-sm text-muted-foreground space-y-3">
                            <p>Click the <Badge variant="outline">Test</Badge> button to open a preview dialog:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Enter any test recipient email address</li>
                                <li>Preview shows the Subject and Body with variables replaced using data from the test email</li>
                                <li>Click "Send Test" to open your mail client with the pre-filled message</li>
                            </ul>
                        </CardContent>
                    </Card>
                </section>

                {/* File Uploads */}
                <section id="file-upload" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Upload className="h-5 w-5 text-blue-500" />
                                <CardTitle>File Uploads</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 grid sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-success/5 border border-success/20">
                                <h4 className="font-bold text-sm flex items-center gap-2 text-success mb-2"><CheckCircle2 className="h-4 w-4" /> Strengths</h4>
                                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>Supports .txt and .csv files</li>
                                    <li>Smart CSV parsing (auto-detects email columns)</li>
                                    <li>Background processing via Web Worker</li>
                                    <li>Handles 20,000+ emails smoothly</li>
                                </ul>
                            </div>
                            <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                                <h4 className="font-bold text-sm flex items-center gap-2 text-destructive mb-2"><XCircle className="h-4 w-4" /> Limitations</h4>
                                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>Files over ~100MB may cause memory issues</li>
                                    <li>Binary formats (.xlsx, .docx) not supported</li>
                                    <li>LocalStorage has a 5MB limit for persistence</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Analytics */}
                <section id="analytics" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-primary" />
                                <CardTitle>Analytics & Insights</CardTitle>
                            </div>
                            <CardDescription>Track your outreach performance</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 text-sm text-muted-foreground space-y-3">
                            <p>The <strong>Live Dashboard</strong> provides real-time insights with three views:</p>
                            <div className="grid sm:grid-cols-3 gap-3">
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <h4 className="font-bold text-foreground mb-1">Daily</h4>
                                    <p>Circular progress showing today's sent percentage and 24-hour activity count.</p>
                                </div>
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <h4 className="font-bold text-foreground mb-1">Weekly</h4>
                                    <p>Bar chart showing the last 7 days of email activity with hover tooltips.</p>
                                </div>
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <h4 className="font-bold text-foreground mb-1">Monthly</h4>
                                    <p>Donut chart with your top active days and percentage breakdown over 30 days.</p>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground/70">Analytics data is stored locally for 37 days and automatically pruned.</p>
                        </CardContent>
                    </Card>
                </section>

                {/* Export */}
                <section id="export" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Download className="h-5 w-5 text-emerald-500" />
                                <CardTitle>Export as CSV</CardTitle>
                            </div>
                            <CardDescription>Download your filtered email list</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 text-sm text-muted-foreground space-y-3">
                            <p>Click the <Badge variant="outline">Download</Badge> button in the Generated Emails section to export your current filtered list as a CSV file.</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>The export respects your active filter (All, Sent, or Pending)</li>
                                <li>Filename includes the filter type for easy identification</li>
                                <li>Includes email address, sequence ID, and validation status</li>
                            </ul>
                        </CardContent>
                    </Card>
                </section>

                {/* PWA Install */}
                <section id="pwa" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-primary" />
                                <CardTitle>Install as App (PWA)</CardTitle>
                            </div>
                            <CardDescription>Use Peakconix Sender like a native app</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 text-sm text-muted-foreground space-y-3">
                            <p>When your browser supports it, a green <Badge variant="secondary">Install App</Badge> button appears in the header.</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Works offline after installation (cached via Service Worker)</li>
                                <li>Opens in its own window like a native app</li>
                                <li>Available on desktop (Chrome, Edge) and mobile (Android Chrome)</li>
                                <li>Automatic updates when you're online</li>
                            </ul>
                        </CardContent>
                    </Card>
                </section>

                {/* Keyboard Shortcuts */}
                <section id="shortcuts" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Keyboard className="h-5 w-5 text-orange-500" />
                                <CardTitle>Keyboard Shortcuts</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center p-2 rounded bg-muted/20">
                                    <span className="text-muted-foreground">Generate Emails</span>
                                    <kbd className="bg-muted px-2 py-0.5 rounded text-xs font-mono">Ctrl + Enter</kbd>
                                </div>
                                <div className="flex justify-between items-center p-2 rounded bg-muted/20">
                                    <span className="text-muted-foreground">Generate Emails (Mac)</span>
                                    <kbd className="bg-muted px-2 py-0.5 rounded text-xs font-mono">⌘ + Enter</kbd>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Performance */}
                <section id="performance" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-purple-500" />
                                <CardTitle>Performance & Scaling</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 text-sm text-muted-foreground space-y-3">
                            <p>Peakconix Sender is designed to remain fast even with large lists:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li><strong>Virtualized List:</strong> Only visible rows are drawn, so lists of up to 50,000 emails scroll smoothly.</li>
                                <li><strong>Background Parsing:</strong> Email files are parsed in the background to prevent page freezes.</li>
                                <li><strong>Lazy Loading:</strong> Lighter initial load by only downloading extra pages when clicked.</li>
                                <li><strong>Cached Filters:</strong> Searches and filters are computed efficiently to avoid lag.</li>
                                <li><strong>Auto-scroll:</strong> Automatically scrolls down to the generated list after importing.</li>
                            </ul>
                            <p className="text-xs text-amber-600 flex items-center gap-2">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                For best performance, keep individual lists under 50,000 entries.
                            </p>
                        </CardContent>
                    </Card>
                </section>

                {/* Troubleshooting */}
                <section id="troubleshooting" className="scroll-mt-20">
                    <Card className="border-destructive/20 shadow-sm">
                        <CardHeader className="bg-destructive/[0.03]">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                <CardTitle>Troubleshooting</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="space-y-3 text-sm">
                                <div className="border-b border-border/30 pb-3">
                                    <h4 className="font-bold">Mailto not opening / Nothing happens on click</h4>
                                    <p className="text-muted-foreground">Ensure you have a default mail client configured. For Gmail web, set Gmail as default handler in Chrome settings.</p>
                                </div>
                                <div className="border-b border-border/30 pb-3">
                                    <h4 className="font-bold">Page becomes slow</h4>
                                    <p className="text-muted-foreground">This can happen with very large files (100MB+). Split your list into smaller chunks or clear browser cache.</p>
                                </div>
                                <div className="border-b border-border/30 pb-3">
                                    <h4 className="font-bold">List disappears on refresh</h4>
                                    <p className="text-muted-foreground">LocalStorage may be full. Open DevTools → Application → LocalStorage and clear old data. Lists over 50k may exceed the 5MB limit.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold">Sent status resets</h4>
                                    <p className="text-muted-foreground">Clearing browser data or using incognito resets all data. Peakconix stores everything locally.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* FAQs */}
                <section id="faq" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <HelpCircle className="h-5 w-5 text-primary" />
                                <CardTitle>Frequently Asked Questions</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4 text-sm">
                            <div>
                                <h4 className="font-bold">Is my data uploaded to any server?</h4>
                                <p className="text-muted-foreground">No. All processing happens 100% client-side. No data ever leaves your machine.</p>
                            </div>
                            <div>
                                <h4 className="font-bold">How is "Sent" status tracked?</h4>
                                <p className="text-muted-foreground">When you click an email row, it's marked as "sent" in LocalStorage. This persists across refreshes.</p>
                            </div>
                            <div>
                                <h4 className="font-bold">Can I use this on mobile?</h4>
                                <p className="text-muted-foreground">Yes. Install it as a PWA for the best experience. Mailto behavior varies by device.</p>
                            </div>
                            <div>
                                <h4 className="font-bold">Can I export my list?</h4>
                                <p className="text-muted-foreground">Yes! Use the Download button in the Generated Emails section to export as CSV. You can filter by All, Sent, or Pending before exporting.</p>
                            </div>
                            <div>
                                <h4 className="font-bold">What happens when I clear all history?</h4>
                                <p className="text-muted-foreground">A confirmation dialog will appear first. Clearing removes all emails, sent status, counters, and milestone progress. Your template text is preserved.</p>
                            </div>
                            <div>
                                <h4 className="font-bold">How long is analytics data stored?</h4>
                                <p className="text-muted-foreground">Daily activity is stored for 37 days (30 days for the monthly view + 7-day buffer). Older data is automatically pruned.</p>
                            </div>
                            <div>
                                <h4 className="font-bold">Why were spaces showing as "+" in my emails?</h4>
                                <p className="text-muted-foreground">This was a bug in v3.3.0 where the anti-spam randomizer encoded spaces as "+" instead of "%20". The mailto: URI spec requires %20 for spaces. Fixed in v3.4.0.</p>
                            </div>
                            <div>
                                <h4 className="font-bold">I see visual glitches / static lines on my phone. What do I do?</h4>
                                <p className="text-muted-foreground">This was a GPU rendering issue on some Android devices caused by semi-transparent backgrounds. Fixed in v3.4.0. Clear your browser cache and reload to get the latest version.</p>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Back to Top */}
                <div className="flex justify-center pt-4">
                    <Button variant="outline" className="rounded-full gap-2 px-8" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        Back to Top
                    </Button>
                </div>
            </div>
        </AppShell>
    );
}
