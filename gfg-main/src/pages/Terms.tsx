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
                description="Read the Terms of Service for Peakconix Sender. Learn about our terms, usage agreements, anti-spam compliance, and limitations of liability."
                keywords={['Peakconix Sender terms', 'anti spam compliance', 'email outreach legal rules']}
                schema={{
                  '@context': 'https://schema.org',
                  '@type': 'WebPage',
                  'name': 'Terms of Service - Peakconix Sender',
                  'description': 'Read the Terms of Service for Peakconix Sender. Learn about our terms, usage agreements, anti-spam compliance, and limitations of liability.'
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
                            <h1 className="text-4xl font-black tracking-tighter">Terms of Service</h1>
                            <p className="text-sm text-muted-foreground">Last updated: May 2026 • Version 3.4.0</p>
                        </div>

                        <div className="prose prose-invert max-w-none space-y-10 text-foreground/90">
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <FileText className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">1. What This Tool Does</h2>
                                </div>
                                <p className="leading-relaxed">
                                    Peakconix Sender helps you generate personalized email templates from a contact list and open them in your own mail client. That's it. We don't send emails on your behalf, and we don't touch your data. The tool is provided as-is — use it, it works.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Scale className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">2. Your Responsibility</h2>
                                </div>
                                <p className="leading-relaxed">
                                    You're in charge of who you contact and how. Make sure you're following the rules in your country — CAN-SPAM in the US, GDPR in Europe, CASL in Canada. We can't send emails for you, so we also can't be responsible for how you use the mailto links this tool generates.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <AlertCircle className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">3. What You Can't Use This For</h2>
                                </div>
                                <p className="leading-relaxed">
                                    Don't use Peakconix Sender to:
                                </p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li>Spam people — unsolicited bulk email to people who didn't ask for it</li>
                                    <li>Phishing, scams, harassment, or anything illegal</li>
                                    <li>Violate someone else's privacy or intellectual property</li>
                                </ul>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Gavel className="h-5 w-5" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">4. Liability</h2>
                                </div>
                                <p className="leading-relaxed">
                                    We built this tool and made it free. If something goes wrong when you use it — a missed email, a wrong address, a campaign that didn't land — that's on you, not us. We're not liable for any losses, missed opportunities, or anything else that comes from using Peakconix Sender.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <h2 className="text-xl font-bold uppercase tracking-wider">5. Our Work</h2>
                                <p className="leading-relaxed">
                                    The design, code, and brand behind Peakconix Sender belong to us. You're welcome to use the tool for your personal outreach or inside your business — just don't copy and redistribute it as your own.
                                </p>
                            </section>

                            <section className="space-y-4">
                                <h2 className="text-xl font-bold uppercase tracking-wider">6. Governing Law</h2>
                                <p className="leading-relaxed">
                                    These terms fall under the laws of your own jurisdiction. If you're using this tool somewhere, the rules where you are apply to how you use it.
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
