import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
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
                    <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
                    <p className="text-sm text-muted-foreground">Last updated: February 2026</p>
                </div>

                <div className="prose prose-invert max-w-none space-y-6 text-foreground/90">
                    <section className="space-y-2">
                        <h2 className="text-xl font-semibold">1. Usage Agreement</h2>
                        <p>
                            By using Peak-X Sender, you agree to use this tool responsibly. You must comply with all applicable anti-spam laws (such as CAN-SPAM, GDPR) in your jurisdiction.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-xl font-semibold">2. Liability</h2>
                        <p>
                            The creators of Peak-X Sender are not liable for any damages, legal consequences, or account bans resulting from the use of this tool. Use at your own risk.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-xl font-semibold">3. Prohibited Use</h2>
                        <p>
                            You may not use this tool for harassment, phishing, or sending unsolicited bulk email (spam) to individuals who have not consented to contact.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
