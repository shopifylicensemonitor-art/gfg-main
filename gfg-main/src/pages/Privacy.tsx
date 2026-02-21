import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
    return (
        <div className="min-h-screen bg-background p-8">
            <div className="mx-auto max-w-3xl space-y-8">
                <Link to="/">
                    <Button variant="ghost" className="pl-0 hover:pl-2 transition-all">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to App
                    </Button>
                </Link>

                <div className="space-y-4">
                    <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
                    <p className="text-sm text-muted-foreground">Last updated: February 2026</p>
                </div>

                <div className="prose prose-invert max-w-none space-y-6 text-foreground/90">
                    <section className="space-y-2">
                        <h2 className="text-xl font-semibold">1. Data Handling</h2>
                        <p>
                            Peak-X Sender is a client-side application. <strong>We do not store your uploaded email lists or generated content on any server.</strong> All processing happens locally in your browser.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-xl font-semibold">2. Local Storage</h2>
                        <p>
                            We use your browser's Local Storage to persist your settings (theme, partial usage stats, and draft templates). You can clear this at any time by clearing your browser cache.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-xl font-semibold">3. Third-Party Services</h2>
                        <p>
                            We may use generic analytics tools (like countapi) strictly for usage counting (e.g., "Total emails sent globally"). No personal identifiable information (PII) is transmitted.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
