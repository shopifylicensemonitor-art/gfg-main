import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft, FileText, LayoutGrid, Zap, Upload, Search, FlaskConical, Filter,
    AlertTriangle, HelpCircle, CheckCircle2, XCircle, Clock, Database
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Help() {
    return (
        <div className="min-h-screen bg-background pb-20">
            <Header />
            <main className="mx-auto max-w-4xl px-4 py-6 space-y-10">
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
                    <p className="text-muted-foreground">Master every feature of Peak-X Sender</p>
                </div>

                {/* Quick Navigation */}
                <nav className="flex flex-wrap gap-2 border-b border-border pb-4">
                    <a href="#getting-started" className="text-sm text-primary hover:underline">Getting Started</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#personalization" className="text-sm text-primary hover:underline">Personalization</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#search" className="text-sm text-primary hover:underline">Advanced Search</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#file-upload" className="text-sm text-primary hover:underline">File Uploads</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#performance" className="text-sm text-primary hover:underline">Performance</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#troubleshooting" className="text-sm text-primary hover:underline">Troubleshooting</a>
                    <span className="text-muted-foreground">•</span>
                    <a href="#faq" className="text-sm text-primary hover:underline">FAQs</a>
                </nav>

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
                                <li><strong>Paste or Upload Emails:</strong> Type email addresses directly into the textarea, or click <Badge variant="outline">Upload List</Badge> to import a file (.txt, .csv).</li>
                                <li><strong>Compose Your Template:</strong> Fill in the Subject and Body fields. Use variables like <code className="bg-muted px-1 rounded">{'{name}'}</code>, <code className="bg-muted px-1 rounded">{'{store}'}</code>, <code className="bg-muted px-1 rounded">{'{sname}'}</code>, or <code className="bg-muted px-1 rounded">{'{brand}'}</code> for personalization.</li>
                                <li><strong>Generate & Send:</strong> Click <Badge variant="secondary">Generate Emails</Badge>. Your list appears below. Click any email row to open your default mail client with the pre-filled message.</li>
                            </ol>
                            <p className="text-xs text-amber-600 flex items-center gap-2">
                                <AlertTriangle className="h-3 w-3" />
                                Peak-X Sender uses <code>mailto:</code> links. You must have a mail client configured (Gmail web, Outlook, Apple Mail, etc).
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
                            <CardDescription>Dynamic placeholders for hyper-targeted emails</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary/80">Automated Variables</h4>
                                    <ul className="space-y-3 text-sm">
                                        <li className="flex gap-2">
                                            <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-bold">{'{name}'}</code>
                                            <span className="text-muted-foreground">Local part of email (before @). <span className="text-[10px] opacity-70">john.doe@host.com → "john.doe"</span></span>
                                        </li>
                                        <li className="flex gap-2">
                                            <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-bold">{'{store}'}</code>
                                            <span className="text-muted-foreground">Full domain. <span className="text-[10px] opacity-70">info@apple.com → "apple.com"</span></span>
                                        </li>
                                        <li className="flex gap-2">
                                            <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-bold">{'{sname}'}</code>
                                            <span className="text-muted-foreground">Brand name only (no TLD). <span className="text-[10px] opacity-70">support@tesla.io → "tesla"</span></span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="bg-secondary/20 border border-border/50 rounded-lg p-4">
                                    <h4 className="text-xs font-bold uppercase tracking-widest mb-2">Custom Signature</h4>
                                    <div className="flex gap-2 text-sm">
                                        <code className="bg-primary/10 px-1.5 py-0.5 rounded text-primary font-bold">{'{brand}'}</code>
                                        <span className="text-muted-foreground">Maps to "My Identity / Name" field.</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-3 italic">Example: "Hi {'{name}'}, checking out {'{sname}'}. Best, {'{brand}'}"</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Advanced Search */}
                <section id="search" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Search className="h-5 w-5 text-blue-500" />
                                <CardTitle>Advanced Search</CardTitle>
                            </div>
                            <CardDescription>Filter your generated list with precision</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <p className="text-sm text-muted-foreground">Use the <strong>global search bar</strong> at the top, then choose a mode in the Generated Emails section:</p>
                            <div className="grid sm:grid-cols-3 gap-4 text-sm">
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <Badge variant="secondary" className="mb-2">Text</Badge>
                                    <p className="text-muted-foreground">Plain substring search. Matches any part of the email address.</p>
                                </div>
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <Badge variant="secondary" className="mb-2">@Domain</Badge>
                                    <p className="text-muted-foreground">Filter by domain only. Type "gmail" to show all @gmail.com addresses.</p>
                                </div>
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <Badge variant="secondary" className="mb-2">/Regex/</Badge>
                                    <p className="text-muted-foreground">Full regex support. Example: <code>^john.*@.*\.com$</code></p>
                                </div>
                            </div>
                            <p className="text-xs text-amber-600 flex items-center gap-2">
                                <AlertTriangle className="h-3 w-3" />
                                Invalid regex patterns will show an error and fallback to unfiltered results.
                            </p>
                        </CardContent>
                    </Card>
                </section>

                {/* Test Email */}
                <section id="test-email" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <FlaskConical className="h-5 w-5 text-purple-500" />
                                <CardTitle>Test Email</CardTitle>
                            </div>
                            <CardDescription>Preview your template before sending</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 text-sm text-muted-foreground space-y-3">
                            <p>Click the <Badge variant="outline">Test</Badge> button next to "Generate Emails" to open a dialog where you can:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Enter any test recipient email address</li>
                                <li>Preview the Subject and Body (variables shown literally)</li>
                                <li>Click "Send Test" to open your mail client with the test recipient</li>
                            </ul>
                            <p>This helps you verify formatting and content before mass outreach.</p>
                        </CardContent>
                    </Card>
                </section>

                {/* File Uploads */}
                <section id="file-upload" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Upload className="h-5 w-5 text-blue-500" />
                                <CardTitle>File Uploads: Strengths & Weaknesses</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 grid sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-success/5 border border-success/20">
                                <h4 className="font-bold text-sm flex items-center gap-2 text-success mb-2"><CheckCircle2 className="h-4 w-4" /> Strengths</h4>
                                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>Supports .txt and .csv files</li>
                                    <li>Smart CSV parsing (auto-detects email columns)</li>
                                    <li>Background processing via Web Worker — UI stays responsive</li>
                                    <li>Handles 20,000+ emails smoothly</li>
                                </ul>
                            </div>
                            <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                                <h4 className="font-bold text-sm flex items-center gap-2 text-destructive mb-2"><XCircle className="h-4 w-4" /> Weaknesses</h4>
                                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>Files larger than ~100MB may cause browser memory issues</li>
                                    <li>Binary formats (.xlsx, .docx) are NOT supported — export to .csv first</li>
                                    <li>LocalStorage has a 5MB limit — very large lists may fail to persist</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Performance */}
                <section id="performance" className="scroll-mt-20">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <LayoutGrid className="h-5 w-5 text-purple-500" />
                                <CardTitle>Performance & Scaling</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 text-sm text-muted-foreground space-y-3">
                            <p>Peak-X Sender is optimized for high-volume outreach:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li><strong>Virtualized List:</strong> Only visible rows are rendered — 50,000+ emails won't slow down scrolling.</li>
                                <li><strong>Web Worker Processing:</strong> Email parsing happens in the background, keeping the UI snappy.</li>
                                <li><strong>Memoized Filtering:</strong> Search and status filters are cached to avoid redundant calculations.</li>
                                <li><strong>Debounced Saves:</strong> LocalStorage writes are throttled to prevent keystroke lag.</li>
                            </ul>
                            <p className="text-xs text-amber-600 flex items-center gap-2">
                                <Clock className="h-3 w-3" />
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
                            <div className="space-y-3">
                                <div className="border-b border-border/30 pb-3">
                                    <h4 className="font-bold text-sm">Mailto not opening / Nothing happens on click</h4>
                                    <p className="text-sm text-muted-foreground">Ensure you have a default mail client configured in your OS or browser. For Gmail web users, set Gmail as default handler in Chrome settings.</p>
                                </div>
                                <div className="border-b border-border/30 pb-3">
                                    <h4 className="font-bold text-sm">Page becomes slow or unresponsive</h4>
                                    <p className="text-sm text-muted-foreground">This can happen with extremely large files (100MB+). Try splitting your list into smaller chunks. Also clear browser cache if needed.</p>
                                </div>
                                <div className="border-b border-border/30 pb-3">
                                    <h4 className="font-bold text-sm">List doesn't save / Disappears on refresh</h4>
                                    <p className="text-sm text-muted-foreground">LocalStorage may be full. Open DevTools → Application → LocalStorage and clear old data. Lists over 50k may exceed the 5MB limit.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm">Sent status resets unexpectedly</h4>
                                    <p className="text-sm text-muted-foreground">Clearing browser data or using incognito mode will reset all stored data. Peak-X Sender stores everything locally in your browser.</p>
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
                        <CardContent className="pt-4 space-y-4">
                            <div className="space-y-4 text-sm">
                                <div>
                                    <h4 className="font-bold">Is my data uploaded to any server?</h4>
                                    <p className="text-muted-foreground">No. All processing happens 100% client-side in your browser. No data ever leaves your machine.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold">How is "Sent" status tracked?</h4>
                                    <p className="text-muted-foreground">When you click an email row, it's immediately marked as "sent" in your browser's LocalStorage. This persists across page refreshes.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold">Can I use this on mobile?</h4>
                                    <p className="text-muted-foreground">Yes, but mailto behavior varies by device. iOS opens Apple Mail; Android may prompt for app selection.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold">What's the difference between "Extract Personal" and "Extract Providers"?</h4>
                                    <p className="text-muted-foreground">"Extract Personal" keeps only non-provider domains (business emails). "Extract Providers" keeps only common providers like Gmail, Yahoo, Outlook.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold">Can I export my list?</h4>
                                    <p className="text-muted-foreground">Not yet built-in. You can copy from the browser's DevTools → Application → LocalStorage for now. Export feature is planned.</p>
                                </div>
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
            </main>
        </div>
    );
}
