import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Lock, EyeOff, Server, HardDrive } from "lucide-react";
import { SEO } from "@/components/SEO";
import { AppShell } from "@/components/AppShell";

export default function Privacy() {
    return (
        <AppShell>
            <SEO
                title="Privacy Policy - Google API and Campaign Data Protection"
                description="Read the Privacy Policy of Peak Xender. Learn how we securely access your Gmail account via OAuth, process campaign data, and ensure data privacy."
                keywords={['Peak Xender privacy policy', 'Google OAuth privacy', 'email marketing data safety']}
                schema={{
                  '@context': 'https://schema.org',
                  '@type': 'WebPage',
                  'name': 'Privacy Policy - Peak Xender',
                  'description': 'Read the Privacy Policy of Peak Xender. Learn how we securely access your Gmail account via OAuth, process campaign data, and ensure data privacy.'
                }}
            />
                    <div className="p-4 sm:p-8">
                        <div className="mx-auto max-w-3xl space-y-10">
                        <div className="flex flex-wrap items-center gap-3">
                            <Link to="/">
                                <Button variant="outline" className="text-xs font-semibold cursor-pointer">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Home Page
                                </Button>
                            </Link>
                            <Link to="/campaigns">
                                <Button variant="ghost" className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                                    Outreach Console
                                </Button>
                            </Link>
                        </div>

                        <div className="space-y-4">
                            <h1 className="text-4xl font-black tracking-tighter">Privacy Policy - Peak Xender</h1>
                            <p className="text-sm text-muted-foreground">Domain: send.peakconix.site • Last updated: July 2026 • Version 4.1.0</p>
                        </div>

                        <div className="prose prose-invert max-w-none space-y-10 text-foreground/90">
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Shield className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">1. Google User Data & OAuth Scopes</h2>
                                </div>
                                <p className="leading-relaxed">
                                    Peak Xender accesses your Google account securely via the official OAuth 2.0 authentication protocol. We explicitly request access to the following Google OAuth scopes:
                                </p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li><code>https://www.googleapis.com/auth/gmail.send</code>: Enables Peak Xender to send authorized outbound outreach campaign emails directly from your Gmail account at your command.</li>
                                    <li><code>https://www.googleapis.com/auth/userinfo.email</code>: Identifies your connected Gmail address to display within your secure account dashboard.</li>
                                    <li><code>https://www.googleapis.com/auth/userinfo.profile</code>: Accesses your basic profile information (such as profile picture and account name) to personalize your account workspace.</li>
                                </ul>
                                <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 text-sm leading-relaxed font-semibold text-primary">
                                    Peak Xender's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Google API Services User Data Policy</a>, including the Limited Use requirements.
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <HardDrive className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">2. Data Collection, Storage & Encryption</h2>
                                </div>
                                <p className="leading-relaxed">
                                    To schedule, queue, and dispatch cold email campaigns, Peak Xender securely stores the following data:
                                </p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li><strong>Connected Accounts:</strong> Gmail addresses, encrypted OAuth refresh and access tokens, token expiration timestamps, and optional custom SMTP server credentials.</li>
                                    <li><strong>Recipient Lists:</strong> Recipient email addresses, names, company details, and custom tag variables uploaded via CSV files.</li>
                                    <li><strong>Email Content & Templates:</strong> Saved email subjects, message body layouts, and spintax variations created by users.</li>
                                    <li><strong>Delivery Logs:</strong> Queued message statuses, dispatch timestamps, open tracking, and click tracking metrics.</li>
                                </ul>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Lock className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">3. Purpose & Data Usage</h2>
                                </div>
                                <p className="leading-relaxed">
                                    Your Google account data and OAuth credentials are used exclusively to operate the core email dispatch functionality of Peak Xender. We do not inspect your private personal inbox messages, read incoming emails, or scan your personal Google Drive files. Your OAuth tokens are stored in encrypted format to enable background queue dispatch for scheduled campaigns.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Server className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">4. Third-Party Data Sharing Non-Disclosure</h2>
                                </div>
                                <p className="leading-relaxed">
                                    Peak Xender strictly forbids sharing, selling, renting, or leasing user data, email lists, campaign templates, or Google user credentials to advertising networks, third-party data brokers, or external AI model trainers. Information received via Google APIs is never shared with third parties except as necessary to send authorized emails directly through Google's official API servers.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <EyeOff className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">5. User Data Retention & Account Deletion</h2>
                                </div>
                                <p className="leading-relaxed">
                                    You maintain complete ownership of your data. You can disconnect connected Google accounts or remove campaign data at any time from your Peak Xender dashboard. Deleting a connected account immediately revokes and removes stored OAuth tokens from our active database.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <h2 className="text-xl font-bold uppercase tracking-wider">6. Contact & Privacy Inquiries</h2>
                                <p className="leading-relaxed">
                                    If you have questions regarding this Privacy Policy or your Google OAuth data protection, please contact our support team at:
                                </p>
                                <div className="p-3 bg-slate-900 rounded border border-slate-800 text-xs font-mono">
                                    Website: <a href="https://send.peakconix.site/" className="text-primary hover:underline">https://send.peakconix.site/</a><br />
                                    App Name: Peak Xender<br />
                                    Email: <a href="mailto:peakconix@gmail.com" className="text-primary hover:underline">peakconix@gmail.com</a>
                                </div>
                            </section>
                        </div>

                        <div className="pt-10 border-t border-border/50 text-center space-y-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">End of Privacy Policy — Peak Xender</p>
                            <p className="text-[10px] text-muted-foreground">© 2026 Peak Xender. All rights reserved.</p>
                        </div>
                        </div>
                    </div>
    </AppShell>
  );
}
