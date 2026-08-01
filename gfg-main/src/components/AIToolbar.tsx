import React, { useState } from 'react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Sparkles, RefreshCw, Layers, Wand2, FileText } from 'lucide-react';

interface AIToolbarProps {
  onInsertGenerated: (subject: string, bodyHtml: string) => void;
  currentSubject?: string;
  currentBody?: string;
  onUpdateBody?: (body: string) => void;
  onUpdateSubject?: (subject: string) => void;
  contactFields?: Record<string, string>;
}

export function AIToolbar({
  onInsertGenerated,
  currentSubject = '',
  currentBody = '',
  onUpdateBody,
  onUpdateSubject,
  contactFields = {}
}: AIToolbarProps) {
  const [promptOpen, setPromptOpen] = useState<boolean>(false);
  const [subjectOpen, setSubjectOpen] = useState<boolean>(false);
  const [promptText, setPromptText] = useState<string>('');
  const [stage, setStage] = useState<string>('initial');
  const [loading, setLoading] = useState<boolean>(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(false);

  const handleGenerate = async () => {
    if (!promptText.trim()) return;
    setLoading(true);
    try {
      const res = await api.aiGenerate({
        prompt: promptText,
        stage,
        contactFields
      });
      if (res.success) {
        onInsertGenerated(res.subject, res.body_html);
        toast({ title: 'AI Email Generated', description: 'Subject and body populated successfully.' });
        setPromptOpen(false);
        setPromptText('');
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Generation Failed', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRewrite = async () => {
    if (!currentBody.trim()) {
      toast({ variant: 'destructive', title: 'No Content', description: 'Please enter an email body first to rewrite.' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.aiRewrite({
        subject: currentSubject,
        body: currentBody,
        instruction: 'Maximize response rate and polish copy'
      });
      if (res.success && onUpdateBody) {
        onUpdateBody(res.body_html);
        if (res.subject && onUpdateSubject) onUpdateSubject(res.subject);
        toast({ title: 'AI Copy Polished', description: 'Email copy rewritten for peak conversion.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Rewrite Failed', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSpintax = async () => {
    if (!currentBody.trim()) {
      toast({ variant: 'destructive', title: 'No Content', description: 'Please enter an email body first to convert to spintax.' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.aiSpintax(currentBody);
      if (res.success && res.spintax && onUpdateBody) {
        onUpdateBody(res.spintax);
        toast({ title: 'Converted to Spintax', description: 'Phrases replaced with {option1|option2} syntax.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Spintax Failed', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFetchSubjects = async () => {
    if (!currentBody.trim()) {
      toast({ variant: 'destructive', title: 'No Content', description: 'Enter email body first to generate subject variants.' });
      return;
    }
    setSubjectOpen(true);
    setLoadingSubjects(true);
    try {
      const res = await api.aiSubjects(currentBody, 5);
      if (res.success && res.subjects) {
        setSubjects(res.subjects);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to generate subjects', description: err.message });
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleSelectSubject = (selected: string) => {
    if (onUpdateSubject) {
      onUpdateSubject(selected);
      toast({ title: 'Subject Applied', description: `Set subject to: "${selected}"` });
    }
    setSubjectOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap py-2 border-b border-border mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary animate-pulse" />
          AI Copywriter:
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPromptOpen(true)}
          disabled={loading}
          className="text-xs h-7 gap-1 text-primary border-primary/30 hover:bg-primary/10"
        >
          <Wand2 className="h-3 w-3" />
          Generate Email
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRewrite}
          disabled={loading}
          className="text-xs h-7 gap-1 text-foreground hover:bg-muted"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Polish Copy
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSpintax}
          disabled={loading}
          className="text-xs h-7 gap-1 text-foreground hover:bg-muted"
        >
          <Layers className="h-3 w-3 text-emerald-500" />
          Convert to Spintax
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleFetchSubjects}
          disabled={loading}
          className="text-xs h-7 gap-1 text-foreground hover:bg-muted"
        >
          <FileText className="h-3 w-3 text-blue-500" />
          Subject Variants
        </Button>
      </div>

      {/* Generate Prompt Dialog */}
      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Generate Cold Email with AI
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter your campaign objective or goal. AI will write the subject and body using your AI Rules.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Campaign Stage:</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-border bg-card"
              >
                <option value="initial">Initial Outreach</option>
                <option value="followup_1">Follow-Up 1</option>
                <option value="followup_2">Follow-Up 2</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Prompt / Goal:</label>
              <Input
                type="text"
                placeholder="e.g. Outreach to Shopify store owners selling fashion accessories..."
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setPromptOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={loading || !promptText.trim()} className="text-xs gap-1.5 font-bold">
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Generate & Insert
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subject Variants Dialog */}
      <Dialog open={subjectOpen} onOpenChange={setSubjectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Select Subject Line Variant
            </DialogTitle>
            <DialogDescription className="text-xs">
              Click any AI-generated subject line to apply it to your current campaign.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-2">
            {loadingSubjects ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <span className="ml-2 text-xs text-muted-foreground">Generating subjects...</span>
              </div>
            ) : subjects.map((subj, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSubject(subj)}
                className="w-full text-left p-2.5 rounded-lg border border-border hover:border-primary hover:bg-primary/5 text-xs font-semibold transition-all"
              >
                {subj}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
