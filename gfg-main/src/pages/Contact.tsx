import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, MessageCircle, Send, Sparkles, Instagram, Facebook } from "lucide-react";
import { SEO } from "@/components/SEO";
import { AppShell } from "@/components/AppShell";

export default function Contact() {
  return (
    <AppShell>
      <SEO
        title="Contact Support - Direct Feedback & Custom Coding"
        description="Get in touch with Peakconix Sender team. Reach out via email support or direct WhatsApp chat for rapid feedback, business integrations, custom development, or general inquiries."
        keywords={[
          'contact Peakconix Sender',
          'email outreach support',
          'Peakconix custom development',
          'direct WhatsApp outreach tool'
        ]}
        schema={{
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          'name': 'Contact Peakconix Sender',
          'description': 'Get in touch with the Peakconix Sender team via support email or direct WhatsApp chat.',
          'contactPoint': [
            {
              '@type': 'ContactPoint',
              'contactType': 'customer support',
              'email': 'peakconix@gmail.com',
              'availableLanguage': ['English']
            },
            {
              '@type': 'ContactPoint',
              'contactType': 'WhatsApp developer chat',
              'telephone': '+2347058176122',
              'availableLanguage': ['English']
            }
          ]
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
                <h1 className="text-4xl font-black tracking-tighter">Contact Us</h1>
                <p className="text-sm text-muted-foreground">Have questions, feedback, or need custom development? Get in touch with us directly.</p>
              </div>
 
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                {/* Email card */}
                <div className="p-6 rounded-xl border border-border/80 bg-card/40 hover:bg-card/60 hover:border-blue-500/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all duration-300 space-y-4 flex flex-col justify-between group cursor-default relative z-10">
                  <div className="space-y-3">
                    <div className="p-3 w-12 h-12 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                      <Mail className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold">Email Support</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Send us a direct email for business inquiries, custom features, integrations, or support requests.
                    </p>
                  </div>
                  <a href="mailto:peakconix@gmail.com" className="block pt-2">
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md border-none flex items-center justify-center gap-2 transition-all cursor-pointer">
                      <Send className="h-4 w-4" />
                      peakconix@gmail.com
                    </Button>
                  </a>
                </div>
 
                {/* WhatsApp card */}
                <div className="p-6 rounded-xl border border-border/80 bg-card/40 hover:bg-card/60 hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(34,197,94,0.1)] transition-all duration-300 space-y-4 flex flex-col justify-between group cursor-default relative z-10">
                  <div className="space-y-3">
                    <div className="p-3 w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold">WhatsApp Chat</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Connect with us on WhatsApp for rapid responses, quick feedback, or general project conversations.
                    </p>
                  </div>
                  <a href="https://wa.me/2347058176122" target="_blank" rel="noopener noreferrer" className="block pt-2">
                    <Button className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md border-none flex items-center justify-center gap-2 transition-all cursor-pointer">
                      <MessageCircle className="h-4 w-4" />
                      Chat on WhatsApp
                    </Button>
                  </a>
                </div>

                {/* Instagram card */}
                <div className="p-6 rounded-xl border border-border/80 bg-card/40 hover:bg-card/60 hover:border-pink-500/40 hover:shadow-[0_0_20px_rgba(236,72,153,0.1)] transition-all duration-300 space-y-4 flex flex-col justify-between group cursor-default relative z-10">
                  <div className="space-y-3">
                    <div className="p-3 w-12 h-12 rounded-xl bg-pink-500/15 text-pink-400 border border-pink-500/25 flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.15)]">
                      <Instagram className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold">Instagram Profile</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Follow our official Instagram for feature announcements, visual workflows, updates, and outreach tips.
                    </p>
                  </div>
                  <a href="https://www.instagram.com/peakconix?utm_source=qr&igsh=Y2xoanAxN3RjM2oy" target="_blank" rel="noopener noreferrer" className="block pt-2">
                    <Button className="w-full bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-700 hover:to-pink-600 text-white shadow-md border-none flex items-center justify-center gap-2 transition-all cursor-pointer">
                      <Instagram className="h-4 w-4" />
                      Follow @peakconix
                    </Button>
                  </a>
                </div>
 
                {/* Facebook page card */}
                <div className="p-6 rounded-xl border border-border/80 bg-card/40 hover:bg-card/60 hover:border-blue-600/40 hover:shadow-[0_0_20px_rgba(37,99,235,0.1)] transition-all duration-300 space-y-4 flex flex-col justify-between group cursor-default relative z-10">
                  <div className="space-y-3">
                    <div className="p-3 w-12 h-12 rounded-xl bg-blue-600/15 text-blue-500 border border-blue-600/25 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.15)]">
                      <Facebook className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold">Facebook Page</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Connect with our Facebook page community, read reviews, find guides, and contact our team.
                    </p>
                  </div>
                  <a href="https://www.facebook.com/share/18ci8zQYkf/" target="_blank" rel="noopener noreferrer" className="block pt-2">
                    <Button className="w-full bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white shadow-md border-none flex items-center justify-center gap-2 transition-all cursor-pointer">
                      <Facebook className="h-4 w-4" />
                      Visit Facebook Page
                    </Button>
                  </a>
                </div>
              </div>
 
              <div className="p-5 rounded-xl border border-border/40 bg-card/10 flex items-center gap-3 relative z-10">
                <Sparkles className="h-5 w-5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">
                  We usually respond within 24 hours. Don't hesitate to reach out if you have any questions or feature suggestions!
                </p>
              </div>
            </div>
          </div>
    </AppShell>
  );
}
