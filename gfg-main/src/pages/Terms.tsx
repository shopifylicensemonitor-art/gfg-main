import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Scale, Gavel, AlertCircle, FileText } from "lucide-react";
import { SEO } from "@/components/SEO";
import { AppShell } from "@/components/AppShell";

export default function Terms() {
    return (
        <AppShell>
            <SEO
                title="Terms of Service - Outreach Compliance Guidelines"
                description="Read the Terms of Service for Peak Xender. Learn about our terms, usage agreements, anti-spam compliance, and limitations of liability."
                keywords={['Peak Xender terms', 'anti spam compliance', 'email outreach legal rules']}
                schema={{
                  '@context': 'https://schema.org',
                  '@type': 'WebPage',
                  'name': 'Terms of Service - Peak Xender',
                  'description': 'Read the Terms of Service for Peak Xender. Learn about our terms, usage agreements, anti-spam compliance, and limitations of liability.'
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
                            <h1 className="text-4xl font-black tracking-tighter">Terms of Service</h1>
                            <p className="text-sm text-muted-foreground">Last updated: June 2026 • Version 4.0.0</p>
                        </div>

                        <div className="prose prose-invert max-w-none space-y-10 text-foreground/90">
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <FileText className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">1. Our Services</h2>
                                </div>
                                <p className="leading-relaxed">
                                    Peak Xender is an email campaign management platform. We provide tools to connect SMTP servers or Google accounts (via OAuth2) to dispatch, personalize, and track marketing/outreach campaigns.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Scale className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">2. User Responsibilities & Compliance</h2>
                                </div>
                                <p className="leading-relaxed">
                                    You represent that you have consent or valid legal grounds to email the contacts in your campaigns. You must follow the relevant legislation of the territories where you and your contacts reside (e.g. CAN-SPAM in the US, GDPR in Europe, CASL in Canada). Peak Xender is not responsible for any violations of these regulations.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <AlertCircle className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">3. Anti-Spam & Limits</h2>
                                </div>
                                <p className="leading-relaxed">
                                    You agree not to use Peak Xender to send spam, phishing links, malware, or unsolicited bulk emails to recipients who have not opted in. We reserve the right to limit access or terminate accounts if high bounce rates, spam reports, or illegal activities are detected.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Gavel className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">4. Google API & Credential Security</h2>
                                </div>
                                <p className="leading-relaxed">
                                    When you link a Google Account to Peak Xender, you authorize us to securely store access and refresh tokens. Peak Xender's use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <h2 className="text-xl font-bold uppercase tracking-wider">5. Disclaimer of Liabilities</h2>
                                <p className="leading-relaxed">
                                    Peak Xender is provided "as is", without warranty of any kind. Under no circumstances shall developers be liable for any direct, indirect, special, or consequential damages arising from the use of the platform (including, but not limited to, email Workspace suspensions, deliverability drops, or financial losses).
                                </p>
                            </section>
                        </div>

                        <div className="pt-10 border-t border-border/50 text-center">
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">End of Terms of Service</p>
                        </div>
                        </div>
                    </div>
    </AppShell>
  );
}
