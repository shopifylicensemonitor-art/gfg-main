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
                        <Link to="/campaigns">
                            <Button variant="ghost" className="pl-0 hover:pl-2 transition-all text-muted-foreground hover:text-foreground cursor-pointer">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Campaigns
                            </Button>
                        </Link>

                        <div className="space-y-4">
                            <h1 className="text-4xl font-black tracking-tighter">Privacy Policy</h1>
                            <p className="text-sm text-muted-foreground">Last updated: June 2026 • Version 4.0.0</p>
                        </div>

                        <div className="prose prose-invert max-w-none space-y-10 text-foreground/90">
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Shield className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">1. Google User Data & OAuth Scopes</h2>
                                </div>
                                <p className="leading-relaxed">
                                    Peak Xender accesses your Google accounts via OAuth2 protocol. Specifically, we request permission to use:
                                </p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li><code>https://www.googleapis.com/auth/gmail.send</code>: To send campaign emails on your behalf at your request.</li>
                                    <li><code>https://www.googleapis.com/auth/userinfo.email</code>: To identify and display your connected Gmail address within the dashboard.</li>
                                </ul>
                                <p className="leading-relaxed font-semibold text-primary">
                                    Peak Xender's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <HardDrive className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">2. Data We Collect and Store</h2>
                                </div>
                                <p className="leading-relaxed">
                                    To schedule and execute cold outreach campaigns, we store the following data securely on our database server:
                                </p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li><strong>Connected Sender Profiles:</strong> Connected Gmail email addresses, encrypted OAuth access/refresh tokens, token expiry dates, and SMTP credentials.</li>
                                    <li><strong>Contact Lists:</strong> Recipient names, email addresses, and custom merge fields uploaded by you.</li>
                                    <li><strong>Email Templates:</strong> Saved subject lines and body layouts (HTML and plain text).</li>
                                    <li><strong>Campaign Config & History:</strong> Settings, queued emails, sending status, tracking metrics (opens/clicks), and audit logs.</li>
                                </ul>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Lock className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">3. How Your Data is Used</h2>
                                </div>
                                <p className="leading-relaxed">
                                    Your data is used solely to provide and run the email outreach tool. Your OAuth tokens are stored securely to allow the background worker/scheduler to refresh credentials and execute scheduled mail campaigns automatically.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Server className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">4. Third-Party Sharing & Disclosure</h2>
                                </div>
                                <p className="leading-relaxed">
                                    We do not share, sell, distribute, or lease your personal information, contact lists, templates, or Google user credentials to any third-party marketing companies, brokers, or external applications. Your data is only transmitted directly to Google API endpoints or your custom SMTP servers to send emails at your command.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <EyeOff className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">5. Control & Data Deletion</h2>
                                </div>
                                <p className="leading-relaxed">
                                    You have full control over your data. You can disconnect any Google or SMTP accounts, delete campaigns, clear your contact lists, or remove templates at any time directly from the dashboard. Once deleted, these items are permanently removed from our active database.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <h2 className="text-xl font-bold uppercase tracking-wider">6. Updates to This Policy</h2>
                                <p className="leading-relaxed">
                                    We may update this policy periodically to reflect changes in compliance requirements or application features. We will update the version number and date at the top of this page whenever updates occur.
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
