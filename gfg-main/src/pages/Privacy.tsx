import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Lock, EyeOff, Server, HardDrive } from "lucide-react";
import { SEO } from "@/components/SEO";
import { AppShell } from "@/components/AppShell";

export default function Privacy() {
    return (
        <AppShell>
            <SEO
                title="Privacy Policy - 100% Client-Side Local Data Handling"
                description="Read the Privacy Policy of Peakconix Sender. Understand how we ensure 100% client-side privacy, running parsing entirely in browser memory with zero tracking servers."
                keywords={['Peakconix Sender privacy policy', 'client-side data safety', 'no server bulk email']}
                schema={{
                  '@context': 'https://schema.org',
                  '@type': 'WebPage',
                  'name': 'Privacy Policy - Peakconix Sender',
                  'description': 'Read the Privacy Policy of Peakconix Sender. Understand how we ensure 100% client-side privacy, running parsing entirely in browser memory with zero tracking servers.'
                }}
            />
                    <div className="p-4 sm:p-8">
                        <div className="mx-auto max-w-3xl space-y-10">
                        <Link to="/">
                            <Button variant="ghost" className="pl-0 hover:pl-2 transition-all text-muted-foreground hover:text-foreground cursor-pointer">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Dashboard
                            </Button>
                        </Link>

                        <div className="space-y-4">
                            <h1 className="text-4xl font-black tracking-tighter">Privacy Policy</h1>
                            <p className="text-sm text-muted-foreground">Last updated: May 2026 • Version 3.4.0</p>
                        </div>

                        <div className="prose prose-invert max-w-none space-y-10 text-foreground/90">
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <EyeOff className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">1. Your data never leaves your device</h2>
                                </div>
                                <p className="leading-relaxed">
                                    Peakconix Sender runs entirely inside your browser. Your email lists, subject lines, and message bodies never hit a server — ours or anyone else's. Everything is processed locally, in memory, and stays there.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <HardDrive className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">2. What we save locally</h2>
                                </div>
                                <p className="leading-relaxed">
                                    We use <code>localStorage</code> to remember your work between sessions:
                                </p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li>Your current email template (subject and body)</li>
                                    <li>The email list you're working with</li>
                                    <li>Your send history for the past 37 days</li>
                                    <li>Your theme preference and UI settings</li>
                                </ul>
                                <p>This stays on your device and never gets sent anywhere. You can wipe it any time via "Clear All History" in the app, or by clearing your browser's storage.</p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Server className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">3. Analytics (Microsoft Clarity)</h2>
                                </div>
                                <p className="leading-relaxed">
                                    We use <strong>Microsoft Clarity</strong> to understand how people move around the app — things like where buttons are hard to find, or whether a section is being ignored. It captures heatmaps and session replays.
                                </p>
                                <p className="leading-relaxed">
                                    Clarity never sees your email lists or templates. It only sees how you interact with the interface itself. You can read more about how they handle data on the <a href="https://clarity.microsoft.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Microsoft Clarity site</a>.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Shield className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">4. Offline Mode & PWA</h2>
                                </div>
                                <p className="leading-relaxed">
                                    If you install this as an app on your phone or desktop, a Service Worker caches the app files so it loads offline. Those files are just HTML, CSS, and JS — nothing personal.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Lock className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">5. Kids</h2>
                                </div>
                                <p className="leading-relaxed">
                                    This tool is for professional outreach. It's not built for or aimed at anyone under 13, and we don't knowingly collect information from children.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <h2 className="text-xl font-bold uppercase tracking-wider">6. Updates to This Policy</h2>
                                <p className="leading-relaxed">
                                    If we change something important, we'll update this page and bump the date at the top. Check back if you're curious.
                                </p>
                            </section>
                        </div>

                        <div className="pt-10 border-t border-border/50 text-center">
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">End of Privacy Policy</p>
                        </div>
                        </div>
                    </div>
    </AppShell>
  );
}
