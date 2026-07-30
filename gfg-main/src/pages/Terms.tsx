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
                            <h1 className="text-4xl font-black tracking-tighter">Terms of Service - Peak Xender</h1>
                            <p className="text-sm text-muted-foreground">Domain: send.peakconix.site • Last updated: July 2026 • Version 4.1.0</p>
                        </div>

                        <div className="prose prose-invert max-w-none space-y-10 text-foreground/90">
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <FileText className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">1. Our Services</h2>
                                </div>
                                <p className="leading-relaxed">
                                    Peak Xender is an automated email campaign management platform. We provide tools to connect custom SMTP servers or Google accounts (via OAuth 2.0) to dispatch, personalize, schedule, and track targeted email campaigns.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Scale className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">2. User Responsibilities & Outreach Compliance</h2>
                                </div>
                                <p className="leading-relaxed">
                                    You represent that you have consent or valid legal grounds to email the contacts in your campaigns. You must follow all relevant laws and regulations governing electronic communications in your jurisdiction (such as CAN-SPAM in the US, GDPR in Europe, and CASL in Canada). Peak Xender is not liable for user non-compliance.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <AlertCircle className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">3. Anti-Spam Policy & Service Limits</h2>
                                </div>
                                <p className="leading-relaxed">
                                    You explicitly agree not to use Peak Xender to send unsolicited spam, deceptive subject lines, malware, or phishing campaigns. Accounts engaging in high bounce rates, abusive sending patterns, or illegal activity are subject to immediate suspension.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Gavel className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">4. Google API & Token Governance</h2>
                                </div>
                                <p className="leading-relaxed">
                                    When you link a Google account to Peak Xender, you authorize us to manage OAuth tokens solely to dispatch scheduled emails at your direction. Peak Xender's use and transfer of information received from Google APIs will strictly adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Google API Services User Data Policy</a>, including the Limited Use requirements.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <h2 className="text-xl font-bold uppercase tracking-wider">5. Disclaimer & Support</h2>
                                <p className="leading-relaxed">
                                    Peak Xender is provided "as is". For support inquiries or terms clarification, reach out to us at <a href="mailto:peakconix@gmail.com" className="text-primary hover:underline">peakconix@gmail.com</a>.
                                </p>
                            </section>
                        </div>

                        <div className="pt-10 border-t border-border/50 text-center space-y-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">End of Terms of Service — Peak Xender</p>
                            <p className="text-[10px] text-muted-foreground">© 2026 Peak Xender. All rights reserved.</p>
                        </div>
                        </div>
                    </div>
    </AppShell>
  );
}
