import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Send, Mail, Upload, X, MoreVertical, FileText, Save, Trash2, FlaskConical, RefreshCw, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { EmailTemplate } from '@/hooks/useTemplates';
import { extractEmailsFromText } from '@/hooks/useEmailList';
import { toast } from '@/hooks/use-toast';
import { PUBLIC_PROVIDERS } from '@/lib/publicProviders';
import { buildMailtoLink } from '@/lib/randomizeMailto';

interface FastMailSendProps {
  onAddEmails: (emails: string[]) => void;
  onFileUpload: (file: File) => void;
  emailText: string;
  onEmailTextChange: (text: string) => void;
  subject: string;
  onSubjectChange: (subject: string) => void;
  body: string;
  onBodyChange: (body: string) => void;
  validCount: number;
  invalidCount: number;
  onClear: () => void;
  onClearAllHistory: () => void;
  onValidate: () => void;
  templates: EmailTemplate[];
  onSaveTemplate: (name: string, subject: string, body: string) => void;
  onDeleteTemplate: (id: string) => void;
  onReplaceEmails: (text: string) => void;
  userName: string;
  onUserNameChange: (name: string) => void;
  onFilterList?: (predicate: (email: string) => boolean) => void;
  isUploading?: boolean;
  onGenerated?: () => void;
  cc: string;
  onCcChange: (cc: string) => void;
  bcc: string;
  onBccChange: (bcc: string) => void;
  myInboxTo: string;
  onMyInboxToChange: (to: string) => void;
  ccRoutingMode: 'reroute' | 'normal';
  onCcRoutingModeChange: (mode: 'reroute' | 'normal') => void;
  enableRandomization: boolean;
  onEnableRandomizationChange: (enabled: boolean) => void;
  bccBatchSize: number;
  onBccBatchSizeChange: (size: number) => void;
  bccBatchOpenCount: number;
  onBccBatchOpenCountChange: (count: number) => void;
}


export function FastMailSend({
  onAddEmails,
  onFileUpload,
  emailText,
  onEmailTextChange,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  validCount,
  invalidCount,
  onClear,
  onClearAllHistory,
  onValidate,
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onReplaceEmails,
  userName,
  onUserNameChange,
  onFilterList,
  isUploading,
  onGenerated,
  cc,
  onCcChange,
  bcc,
  onBccChange,
  myInboxTo,
  onMyInboxToChange,
  ccRoutingMode,
  onCcRoutingModeChange,
  enableRandomization,
  onEnableRandomizationChange,
  bccBatchSize,
  onBccBatchSizeChange,
  bccBatchOpenCount,
  onBccBatchOpenCountChange,
}: FastMailSendProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);


  // Compute preview with replaced variables for test email
  const testPreview = useMemo(() => {
    const email = testRecipient.trim() || 'john.doe@example.com';
    const [localPart, domainPart] = email.split('@');
    const sname = domainPart ? domainPart.split('.')[0] : 'example';
    const previewSubject = subject
      .replace(/{name}/g, localPart || 'john.doe')
      .replace(/{store}/g, domainPart || 'example.com')
      .replace(/{sname}/g, sname)
      .replace(/{brand}/g, userName || 'YourBrand');
    const previewBody = body
      .replace(/{name}/g, localPart || 'john.doe')
      .replace(/{store}/g, domainPart || 'example.com')
      .replace(/{sname}/g, sname)
      .replace(/{brand}/g, userName || 'YourBrand');
    return { subject: previewSubject, body: previewBody };
  }, [testRecipient, subject, body, userName]);

  const handleExtractPersonal = useCallback(() => {
    if (onFilterList) {
      onFilterList((email) => {
        const domain = email.split('@')[1]?.toLowerCase();
        return domain ? !PUBLIC_PROVIDERS.has(domain) : false;
      });
      toast({ title: "Filter Applied", description: "Kept only Personal/Business domains." });
    }
  }, [onFilterList]);

  const handleExtractProviders = useCallback(() => {
    if (onFilterList) {
      onFilterList((email) => {
        const domain = email.split('@')[1]?.toLowerCase();
        return domain ? PUBLIC_PROVIDERS.has(domain) : false;
      });
      toast({ title: "Filter Applied", description: "Kept only Email Providers (Gmail, Yahoo, etc)." });
    }
  }, [onFilterList]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = '';
      toast({
        title: "File uploaded",
        description: "Processing emails from file...",
      });
    }
  }, [onFileUpload]);

  /* Removed local parseEmails in favor of shared utility */
  const handleGenerate = useCallback(() => {
    if (emailText.trim()) {
      // Pass the raw text directly to the worker-backed hook
      onReplaceEmails(emailText);
      toast({
        title: "List Generated",
        description: "Processing list in background...",
      });
      onGenerated?.();
    } else {
      toast({
        title: "No emails found",
        description: "Please paste valid email addresses.",
        variant: "destructive",
      });
    }
  }, [emailText, onReplaceEmails, onGenerated]);

  // Keyboard shortcut: Ctrl+Enter to generate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGenerate]);

  const handleSave = useCallback(() => {
    if (newTemplateName.trim() && (subject.trim() || body.trim())) {
      onSaveTemplate(newTemplateName.trim(), subject, body);
      setNewTemplateName('');
      setIsSaveDialogOpen(false);
    }
  }, [newTemplateName, subject, body, onSaveTemplate, setNewTemplateName, setIsSaveDialogOpen]);

  const handleSelectTemplate = useCallback((template: EmailTemplate) => {
    onSubjectChange(template.subject);
    onBodyChange(template.body);
    toast({
      title: "Template loaded",
      description: `"${template.name}" template applied.`,
    });
  }, [onSubjectChange, onBodyChange]);

  return (
    <div id="main-input-section" className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Fast Mail Send</h2>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }} className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground">
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Upload List
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FileText className="mr-2 h-4 w-4" />
                  Templates
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  {templates.length === 0 ? (
                    <DropdownMenuItem disabled>No templates</DropdownMenuItem>
                  ) : (
                    templates.map(t => (
                      <DropdownMenuItem key={t.id} onClick={() => handleSelectTemplate(t)} className="justify-between">
                        <span className="truncate">{t.name}</span>
                        <Trash2
                          className="h-3 w-3 text-destructive opacity-50 hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); onDeleteTemplate(t.id); }}
                        />
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem onClick={() => setIsSaveDialogOpen(true)}>
                <Save className="mr-2 h-4 w-4" />
                Save Template
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClearAllHistory} className="text-destructive focus:text-destructive">
                <X className="mr-2 h-4 w-4" />
                Clear All History
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Recipients Email */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            Target Recipients
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-success font-medium">Valid: {validCount}</span>
            <span className="text-destructive font-medium">Invalid: {invalidCount}</span>
          </div>
        </label>
        <Textarea
          placeholder="Paste email list here..."
          value={emailText}
          onChange={(e) => onEmailTextChange(e.target.value)}
          className="min-h-[120px] resize-none font-mono text-xs sm:text-sm border-muted transition-all focus:border-primary"
        />
        {emailText && (
          <div className="flex justify-end">
            <span className="text-[10px] text-muted-foreground">
              {emailText.split('\n').filter(l => l.trim()).length} lines
            </span>
          </div>
        )}
      </div>

      {/* Subject Line */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Subject Line</label>
        <Input
          placeholder="Use {name}, {store}, {sname}..."
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          className="bg-background"
        />
      </div>

      {/* Message Body */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium">Message Body</label>
        </div>
        <Textarea
          ref={bodyRef}
          placeholder="Type your message here... Supports {name}, {store}, {sname} or {{first_name}}, {{store_name}}..."
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          className="min-h-[150px] resize-none bg-background"
        />
        <div className="flex flex-wrap items-center gap-1.5 pt-1 select-none">
          <span className="text-[10px] text-muted-foreground mr-1">Insert variable:</span>
          {[
            { tag: '{{first_name}}' },
            { tag: '{{store_name}}' },
            { tag: '{{niche}}' },
            { tag: '{{pain_point}}' },
            { tag: '{name}' },
            { tag: '{store}' },
            { tag: '{sname}' },
            { tag: '{brand}' }
          ].map(item => (
            <Badge
              key={item.tag}
              variant="secondary"
              className="font-mono text-[9px] px-1.5 py-0.5 border border-border bg-card hover:bg-primary/10 hover:text-primary transition-all cursor-pointer"
              onClick={() => {
                const textarea = bodyRef.current;
                if (!textarea) return;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                const before = text.substring(0, start);
                const after = text.substring(end, text.length);
                onBodyChange(before + item.tag + after);
                setTimeout(() => {
                  textarea.focus();
                  textarea.setSelectionRange(start + item.tag.length, start + item.tag.length);
                }, 0);
              }}
            >
              {item.tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Collapsible Outreach & Spam Settings Panel */}
      <div className="border border-border/85 rounded-lg overflow-hidden bg-muted/10">
        <button
          type="button"
          onClick={() => setIsSettingsOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary animate-spin-slow" />
            <span className="text-xs font-semibold">Outreach &amp; Anti-Spam Settings</span>
            {(((cc && cc.trim()) || (bcc && bcc.trim()) || (myInboxTo && myInboxTo.trim()) || enableRandomization)) && (
              <Badge variant="secondary" className="text-[9px] scale-90 px-1 py-0 h-4 bg-primary/10 text-primary hover:bg-primary/20 border-none font-normal">
                Active
              </Badge>
            )}
          </div>
          {isSettingsOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {isSettingsOpen && (
          <div className="px-4 pb-4 pt-2 border-t border-border/40 space-y-4 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Row 1: Identity & My Inbox */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  My Identity / Name ({`{brand}`})
                </label>
                <Input
                  placeholder="e.g. Hostinger / John Doe"
                  value={userName}
                  onChange={(e) => onUserNameChange(e.target.value)}
                  className="bg-background h-8 text-xs border-muted/80 focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  To (My Inbox / Send to Self)
                  {myInboxTo && myInboxTo.trim() && (
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-emerald-500/30 text-emerald-500 bg-emerald-500/5 font-normal">
                      Rerouting Active
                    </Badge>
                  )}
                </label>
                <Input
                  placeholder="your.inbox@example.com"
                  value={myInboxTo}
                  onChange={(e) => onMyInboxToChange(e.target.value)}
                  className="bg-background h-8 text-xs border-muted/80 focus:border-primary"
                />
                <p className="text-[9px] text-muted-foreground/80 leading-tight">
                  If filled, emails are sent TO this inbox, with target customers moved to BCC.
                </p>
              </div>
            </div>

            {/* Row 2: CC / BCC */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  CC Recipient
                </label>
                <Input
                  id="email-cc"
                  placeholder="cc@example.com"
                  value={cc}
                  onChange={(e) => onCcChange(e.target.value)}
                  className="bg-background h-8 text-xs border-muted/80 focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1">
                  BCC Recipient <span className="text-muted-foreground/75 font-normal">(Auto-BCC copy)</span>
                </label>
                <Input
                  id="email-bcc"
                  placeholder="bcc@example.com"
                  value={bcc}
                  onChange={(e) => onBccChange(e.target.value)}
                  className="bg-background h-8 text-xs border-muted/80 focus:border-primary"
                />
              </div>
            </div>

            {/* Row 3: CC routing mode & Anti-spam */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/20">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  CC Routing Mode
                </label>
                <select
                  value={ccRoutingMode}
                  onChange={(e) => onCcRoutingModeChange(e.target.value as 'reroute' | 'normal')}
                  className="w-full bg-background border border-muted/80 rounded-md h-8 text-xs px-2 focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="reroute">Route CC to BCC (Private Copy - Recommended)</option>
                  <option value="normal">Keep CC visible (Public Copy)</option>
                </select>
              </div>

              <div className="space-y-2 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={enableRandomization}
                    onChange={(e) => onEnableRandomizationChange(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                  />
                  <span>Bypass Spam Tracking (Randomization)</span>
                </label>
                <p className="text-[9px] text-muted-foreground/80 leading-normal">
                  Shuffles URL parameters, randomizes space encoding (+ vs %20), and injects zero-width whitespace to disrupt automated email fingerprints.
                </p>
              </div>
            </div>

            {/* Row 4: BCC Batching Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/20">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  BCC Batch Size (recipients per email)
                </label>
                <Input
                  type="number"
                  min={2}
                  max={100}
                  value={bccBatchSize}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') { onBccBatchSizeChange(0 as unknown as number); return; }
                    const parsed = parseInt(raw, 10);
                    if (!isNaN(parsed)) onBccBatchSizeChange(parsed);
                  }}
                  onBlur={() => {
                    if (!bccBatchSize || bccBatchSize < 2) onBccBatchSizeChange(2);
                    else if (bccBatchSize > 100) onBccBatchSizeChange(100);
                  }}
                  className="bg-background h-8 text-xs border-muted/80 focus:border-primary"
                />
                <p className="text-[9px] text-muted-foreground/80 leading-tight">
                  Sets the number of comma-separated recipients in the BCC field of each batch. Max 100 recommended.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Max BCC Batches to Open at Once
                </label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={bccBatchOpenCount}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') { onBccBatchOpenCountChange(0 as unknown as number); return; }
                    const parsed = parseInt(raw, 10);
                    if (!isNaN(parsed)) onBccBatchOpenCountChange(parsed);
                  }}
                  onBlur={() => {
                    if (!bccBatchOpenCount || bccBatchOpenCount < 1) onBccBatchOpenCountChange(1);
                    else if (bccBatchOpenCount > 20) onBccBatchOpenCountChange(20);
                  }}
                  className="bg-background h-8 text-xs border-muted/80 focus:border-primary"
                />
                <p className="text-[9px] text-muted-foreground/80 leading-tight">
                  How many separate BCC email windows to open sequentially in a single automated loop.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleGenerate} disabled={isUploading} className="flex-1 peak-gradient-bg text-white shadow-md border-none hover:opacity-90">
          {isUploading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Generate Emails
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsTestDialogOpen(true)}
          className="px-3 border-primary/30 text-primary hover:bg-primary/10"
          title="Send Test Email"
        >
          <FlaskConical className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center -mt-2">Ctrl+Enter to generate</p>

      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Template Name"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
            />
            <Button onClick={handleSave} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="sm:max-w-md top-[8%] translate-y-0 data-[state=open]:slide-in-from-top-[4%] data-[state=closed]:slide-out-to-top-[4%]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Send Test Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Test Recipient Email</label>
              <Input
                type="email"
                placeholder="your.email@example.com"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
              />
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
              <p className="font-medium text-sm">Live Preview:</p>
              <p className="text-muted-foreground"><strong>Subject:</strong> {testPreview.subject || '(empty)'}</p>
              <p className="text-muted-foreground whitespace-pre-wrap max-h-28 overflow-auto"><strong>Body:</strong> {testPreview.body || '(empty)'}</p>
              <p className="text-[10px] text-success mt-1">Variables are replaced with values from the test recipient above.</p>
            </div>
            <Button
              className="w-full"
              disabled={!testRecipient.trim()}
              onClick={() => {
                const link = buildMailtoLink({
                  recipient: testRecipient,
                  subject: testPreview.subject,
                  body: testPreview.body,
                  cc,
                  bcc,
                  myInboxTo,
                  ccRoutingMode,
                  enableRandom: enableRandomization,
                });
                window.location.href = link;
                setIsTestDialogOpen(false);
                toast({ title: "Test email opened", description: `Opening mailto for ${testRecipient}` });
              }}
            >
              <Send className="mr-2 h-4 w-4" />
              Send Test
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
