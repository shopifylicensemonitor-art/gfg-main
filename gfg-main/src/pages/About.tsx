import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Info, Cpu, Sparkles, ShieldCheck } from "lucide-react";
import { SEO } from "@/components/SEO";
import { AppShell } from "@/components/AppShell";

export default function About() {
  return (
    <AppShell>
      <SEO
        title="About Us - How Peak Xender Works"
        description="Learn what Peak Xender is, why we built it, and how it keeps your contact lists completely private — all inside your own browser."
        keywords={[
          'about Peak Xender',
          'client-side outreach tool',
          'private email tools',
          'free email outreach'
        ]}
        schema={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          'name': 'About Peak Xender',
          'description': 'Peak Xender is a browser-based tool for sending personalized bulk email outreach through your own mail client — with zero servers involved.',
          'publisher': {
            '@type': 'Organization',
            'name': 'Peak Xender',
            'logo': {
              '@type': 'ImageObject',
              'url': 'https://peakxender.lovable.app/peak-xender-logo.svg'
            }
          },
          'mainEntity': {
            '@type': 'SoftwareApplication',
            'name': 'Peak Xender',
            'applicationCategory': 'BusinessApplication',
            'operatingSystem': 'Any modern browser',
            'offers': {
              '@type': 'Offer',
              'price': '0.00',
              'priceCurrency': 'USD'
            }
          }
        }}
      />
      <div className="p-4 sm:p-8">
        <div className="mx-auto max-w-3xl space-y-10">
              <Link to="/send">
                <Button variant="ghost" className="pl-0 hover:pl-2 transition-all text-muted-foreground hover:text-foreground cursor-pointer">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>

              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Version 3.4.0</span>
                </div>
                <h1 className="text-4xl font-black tracking-tighter">About Peak Xender</h1>
                <p className="text-sm text-muted-foreground">Built for people who send a lot of emails and don't want to pay monthly for the privilege.</p>
              </div>

              <div className="prose prose-invert max-w-none space-y-10 text-foreground/90">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Cpu className="h-5 w-5" />
                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">What This Is</h2>
                  </div>
                  <p className="leading-relaxed text-sm sm:text-base">
                    Peak Xender started as a simple question: why do you need a subscription, an API key, and a server just to send 200 cold emails? You already have a mail client. You already have a contact list. You just need something to connect the two — fast.
                  </p>
                  <p className="leading-relaxed text-sm sm:text-base">
                    So we built this. Paste your list, set your template, hit send. Everything runs in your browser — your mail app handles the actual sending, same as it always would.
                  </p>
                </section>

                <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                  <div className="p-5 rounded-xl border border-border/80 bg-card/40 space-y-3">
                    <div className="p-2.5 w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold">Your data stays with you</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Nothing leaves your device. Your contact list, your subject lines, your message body — all of it stays inside your browser. We never see any of it, because it never touches our servers.
                    </p>
                  </div>

                  <div className="p-5 rounded-xl border border-border/80 bg-card/40 space-y-3">
                    <div className="p-2.5 w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold">Personalization that works</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Use <code>{`{name}`}</code>, <code>{`{store}`}</code>, and <code>{`{sname}`}</code> in your templates. The tool pulls the name and domain from each email address automatically — no spreadsheet formulas needed.
                    </p>
                  </div>
                </section>

                <section className="space-y-4 pt-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Info className="h-5 w-5" />
                    <h2 className="text-xl font-bold uppercase tracking-wider m-0">Why Not Just Use a Normal Tool?</h2>
                  </div>
                  <p className="leading-relaxed text-sm sm:text-base">
                    Most bulk email tools want you to configure SMTP servers, hand over your API keys, or upload your contact list to their cloud. That's overhead nobody needs for everyday outreach. Peak Xender works the moment you open it — on web, mobile, or desktop. Paste your list and you're done in seconds, not hours.
                  </p>
                </section>
              </div>
            </div>
        </div>
    </AppShell>
  );
}

