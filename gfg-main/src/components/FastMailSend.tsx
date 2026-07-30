import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Send, Mail, Upload, X, MoreVertical, FileText, Save, Trash2, FlaskConical, RefreshCw, Settings, ChevronDown, ChevronUp, Cloud, Loader2, AlertTriangle } from 'lucide-react';
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
import type { ContactListInfo } from '@/api';
import { toast } from '@/hooks/use-toast';
import { PUBLIC_PROVIDERS } from '@/lib/publicProviders';
import { buildMailtoLink } from '@/lib/randomizeMailto';
import { CSVPreview } from './CSVPreview';

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
  activeVariables?: string[];
  savedLists?: ContactListInfo[];
  onLoadSavedList?: (listName: string) => void;
  autoScroll: boolean;
  onAutoScrollChange: (enabled: boolean) => void;
  parsedCSV?: any;
  uploadedFileName?: string;
  csvMappings?: Record<string, string>;
  onClearPreview?: () => void;
  /** Callback to send the current email list + subject + body to the backend as a campaign */
  onSendViaBackend?: () => void;
  /** Whether a backend campaign send is in progress */
  isSendingBackend?: boolean;
  /** Whether the background scheduler is enabled on the server */
  schedulerEnabled?: boolean;
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
  activeVariables = [],
  savedLists = [],
  onLoadSavedList,
  autoScroll,
  onAutoScrollChange,
  parsedCSV,
  uploadedFileName,
  csvMappings,
  onClearPreview,
  onSendViaBackend,
  isSendingBackend = false,
  schedulerEnabled = true,
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
    let previewSubject = subject
      .replace(/{name}/g, localPart || 'john.doe')
      .replace(/{store}/g, domainPart || 'example.com')
      .replace(/{sname}/g, sname)
      .replace(/{brand}/g, userName || 'YourBrand');
    let previewBody = body
      .replace(/{name}/g, localPart || 'john.doe')
      .replace(/{store}/g, domainPart || 'example.com')
      .replace(/{sname}/g, sname)
      .replace(/{brand}/g, userName || 'YourBrand');

    // Also resolve {{variable}} placeholders with demo fallbacks
    const resolvePreviewVar = (key: string): string => {
      const normKey = key.toLowerCase();
      if (normKey === 'email') return email;
      if (normKey === 'name' || normKey === 'first_name') return localPart || 'john.doe';
      if (normKey === 'store' || normKey === 'store_name') return domainPart || 'example.com';
      if (normKey === 'sname') return sname;
      if (normKey === 'brand') return userName || 'YourBrand';
      if (normKey === 'niche') return 'ecommerce';
      if (normKey === 'pain_point') return 'growth';
      return `[${key}]`;
    };
    previewSubject = previewSubject.replace(/\{\{(\w+)\}\}/g, (_, key) => resolvePreviewVar(key));
    previewBody = previewBody.replace(/\{\{(\w+)\}\}/g, (_, key) => resolvePreviewVar(key));

    return { subject: previewSubject, body: previewBody };
  }, [testRecipient, subject, body, userName]);

  const variablesToDisplay = useMemo(() => {
    const filteredActive = activeVariables.filter(v => v !== 'email' && v !== 'skip');
    if (filteredActive.length > 0) {
      const activeTags = filteredActive.map(v => ({ tag: `{{${v}}}` }));
      if (!filteredActive.includes('brand')) {
        activeTags.push({ tag: '{{brand}}' });
      }
      return activeTags;
    }
    return [
      { tag: '{{first_name}}' },
      { tag: '{{store_name}}' },
      { tag: '{{niche}}' },
      { tag: '{{pain_point}}' },
      { tag: '{{brand}}' }
    ];
  }, [activeVariables]);

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
    <div id="main-input-section" className="space-y-5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-primary/20 hover:shadow-2xl">
      {/* Top gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-indigo-500 to-emerald-500 opacity-80" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Send className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground">Direct Send Panel</h2>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-mono font-bold text-primary/80">Peak Xender Direct Outreach</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }} 
            className="text-xs h-8 px-3 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-lg transition-all duration-200"
          >
            <Upload className="mr-1.5 h-3.5 w-3.5 text-primary" />
            Upload List
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-border bg-popover/95 backdrop-blur-md rounded-xl shadow-lg">
              <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-2.5 py-2">Actions</DropdownMenuLabel>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs px-2.5 py-2">
                  <Mail className="mr-2 h-4 w-4 text-primary" />
                  Load Saved List
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48 border-border bg-popover/95 backdrop-blur-md rounded-xl shadow-lg">
                  {savedLists.length === 0 ? (
                    <DropdownMenuItem disabled className="text-xs">No saved lists</DropdownMenuItem>
                  ) : (
                    savedLists.map(list => (
                      <DropdownMenuItem key={list.list_name} onClick={() => onLoadSavedList?.(list.list_name)} className="text-xs px-2.5 py-2">
                        <span className="truncate">{list.list_name} ({list.count})</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs px-2.5 py-2">
                  <FileText className="mr-2 h-4 w-4 text-primary" />
                  Templates
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48 border-border bg-popover/95 backdrop-blur-md rounded-xl shadow-lg">
                  {templates.length === 0 ? (
                    <DropdownMenuItem disabled className="text-xs">No templates</DropdownMenuItem>
                  ) : (
                    templates.map(t => (
                      <DropdownMenuItem key={t.id} onClick={() => handleSelectTemplate(t)} className="justify-between text-xs px-2.5 py-2">
                        <span className="truncate">{t.name}</span>
                        <Trash2
                          className="h-3.5 w-3.5 text-destructive opacity-50 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); onDeleteTemplate(t.id); }}
                        />
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem onClick={() => setIsSaveDialogOpen(true)} className="text-xs px-2.5 py-2">
                <Save className="mr-2 h-4 w-4 text-primary" />
                Save Template
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-border/40" />
              <DropdownMenuItem onClick={onClearAllHistory} className="text-xs px-2.5 py-2 text-destructive focus:text-destructive focus:bg-destructive/5">
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
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-primary" />
            Target Recipients
          </div>
          <div className="flex items-center gap-3 font-semibold">
            <span className="text-success flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Valid: {validCount}
            </span>
            {invalidCount > 0 && (
              <span className="text-destructive flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                Invalid: {invalidCount}
              </span>
            )}
          </div>
        </label>
        <Textarea
          placeholder="Paste email list here... (one per line, format: email, or name:email, or custom CSV mappings)"
          value={emailText}
          onChange={(e) => onEmailTextChange(e.target.value)}
          className="min-h-[120px] resize-none font-mono text-xs sm:text-sm border-muted/85 bg-background/30 transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl leading-relaxed"
        />
        {emailText && (
          <div className="flex justify-end">
            <span className="text-[10px] font-mono text-muted-foreground/60">
              {emailText.split('\n').filter(l => l.trim()).length} lines detected
            </span>
          </div>
        )}
        {parsedCSV && parsedCSV.headers && parsedCSV.headers.length > 0 && (
          <div className="mt-3">
            <CSVPreview
              parsedCSV={parsedCSV}
              fileName={uploadedFileName || ''}
              mappings={csvMappings}
              onClearPreview={onClearPreview}
            />
          </div>
        )}
      </div>

      {/* Subject Line */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject Line</label>
        <Input
          placeholder="Use {{first_name}}, {{store_name}}, {{niche}}, {{pain_point}}..."
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          className="bg-background/30 border-muted/80 transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl h-10 text-xs sm:text-sm"
        />
      </div>

      {/* Message Body */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Message Body</label>
        <Textarea
          ref={bodyRef}
          placeholder="Type your message here... Supports {{first_name}}, {{store_name}}, {{niche}}, {{pain_point}}, {{brand}}..."
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          className="min-h-[160px] resize-none bg-background/30 border-muted/80 transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl text-xs sm:text-sm leading-relaxed"
        />
        <div className="flex flex-wrap items-center gap-1.5 pt-1 select-none">
          <span className="text-[10px] text-muted-foreground/70 font-mono mr-1">Variables:</span>
          {variablesToDisplay.map(item => (
            <Badge
              key={item.tag}
              variant="secondary"
              className="font-mono text-[9px] px-2 py-0.5 border border-border bg-card/50 text-foreground hover:bg-primary/15 hover:text-primary hover:border-primary/20 transition-all cursor-pointer rounded"
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
      <div className="border border-border/80 rounded-xl overflow-hidden bg-muted/5 backdrop-blur-sm transition-all duration-300">
        <button
          type="button"
          onClick={() => setIsSettingsOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Settings className="h-4 w-4 text-primary animate-spin-slow" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Outreach &amp; Anti-Spam Settings</span>
            {(((cc && cc.trim()) || (bcc && bcc.trim()) || (myInboxTo && myInboxTo.trim()) || enableRandomization)) && (
              <Badge variant="secondary" className="text-[9px] scale-95 px-2 py-0 h-4 bg-primary/10 text-primary border-none font-semibold">
                Active Settings
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
          <div className="px-4 pb-4 pt-2 border-t border-border/20 space-y-4 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
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
                  className="bg-background/40 h-8 text-xs border-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  To (My Inbox / Send to Self)
                  {myInboxTo && myInboxTo.trim() && (
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1.5 border-emerald-500/30 text-emerald-500 bg-emerald-500/5 font-semibold">
                      Rerouting Active
                    </Badge>
                  )}
                </label>
                <Input
                  placeholder="your.inbox@example.com"
                  value={myInboxTo}
                  onChange={(e) => onMyInboxToChange(e.target.value)}
                  className="bg-background/40 h-8 text-xs border-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg"
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
                  className="bg-background/40 h-8 text-xs border-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg"
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
                  className="bg-background/40 h-8 text-xs border-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg"
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
                  className="w-full bg-background border border-muted/80 rounded-lg h-8 text-xs px-2 focus:ring-2 focus:ring-primary/10 focus:outline-none"
                >
                  <option value="reroute">Route CC to BCC (Private Copy - Recommended)</option>
                  <option value="normal">Keep CC visible (Public Copy)</option>
                </select>
              </div>

              <div className="space-y-3 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={enableRandomization}
                    onChange={(e) => onEnableRandomizationChange(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                  />
                  <span>Bypass Spam Tracking (Randomization)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => onAutoScrollChange(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                  />
                  <span>Auto-scroll to Generated Emails</span>
                </label>
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
                  className="bg-background/40 h-8 text-xs border-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg"
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
                  className="bg-background/40 h-8 text-xs border-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg"
                />
                <p className="text-[9px] text-muted-foreground/80 leading-tight">
                  How many separate BCC email windows to open sequentially in a single automated loop.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2.5">
        <Button 
          onClick={handleGenerate} 
          disabled={isUploading} 
          className="flex-1 h-11 text-xs sm:text-sm font-bold uppercase tracking-wider peak-gradient-bg text-white shadow-lg border-none hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 rounded-xl"
        >
          {isUploading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Processing List...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Compile &amp; Generate Emails
            </>
          )}
        </Button>
        {onSendViaBackend && (
          <Button
            onClick={onSendViaBackend}
            disabled={isSendingBackend || !schedulerEnabled}
            className={`h-11 px-3 sm:px-4 text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all duration-200 ${
              schedulerEnabled
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg border-none'
                : 'bg-muted text-muted-foreground cursor-not-allowed border border-border'
            }`}
            title={!schedulerEnabled ? 'Background scheduler is disabled — enable it on the server' : 'Send via backend campaign scheduler'}
          >
            {isSendingBackend ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Cloud className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{isSendingBackend ? 'Sending...' : 'Send via Backend'}</span>
            <span className="inline sm:hidden">{isSendingBackend ? '...' : 'Backend'}</span>
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => setIsTestDialogOpen(true)}
          className="px-3 sm:px-4 h-11 rounded-xl border-primary/20 text-primary hover:bg-primary/5 hover:text-primary transition-all duration-200 flex items-center gap-2 font-bold text-xs uppercase tracking-wider"
          title="Send Test Email"
        >
          <FlaskConical className="h-5 w-5 animate-float-slow" />
          <span className="inline sm:hidden">Test</span>
          <span className="hidden sm:inline">Test Draft</span>
        </Button>
      </div>
      <div className="flex items-center justify-center gap-3 text-[9px] font-mono text-muted-foreground -mt-2">
        <span>Pro tip: Press <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border">Ctrl+Enter</kbd> to compile instantly</span>
        {!schedulerEnabled && (
          <span className="inline-flex items-center gap-1 text-amber-500 font-bold">
            <AlertTriangle className="h-3 w-3" />
            Scheduler OFF
          </span>
        )}
      </div>

      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="rounded-2xl border border-primary/20 bg-slate-950/95 backdrop-blur-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Save Campaign Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="e.g. Hostinger Warm Outreach"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="rounded-xl border-muted bg-background/50 text-xs sm:text-sm h-10 transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
            <Button onClick={handleSave} className="w-full h-10 font-bold uppercase tracking-wider peak-gradient-bg text-white border-none rounded-xl">Save Template</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="sm:max-w-md top-[8%] translate-y-0 data-[state=open]:slide-in-from-top-[4%] data-[state=closed]:slide-out-to-top-[4%] border border-primary/20 bg-slate-950/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <FlaskConical className="h-5 w-5 text-primary animate-pulse" />
              Send Test Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3 text-xs">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Test Recipient Email</label>
              <Input
                type="email"
                placeholder="your.email@example.com"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                className="rounded-xl border-muted bg-background/50 h-10 transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 text-xs sm:text-sm"
              />
            </div>
            <div className="rounded-xl border border-border/80 bg-background/40 p-4 space-y-2.5 font-mono text-[11px] leading-relaxed shadow-inner">
              <p className="font-bold text-xs text-primary uppercase tracking-widest">Live Sandbox Preview</p>
              <p className="text-muted-foreground"><strong className="text-foreground">Subject:</strong> {testPreview.subject || '(empty)'}</p>
              <p className="text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                <strong className="text-foreground">Body:</strong> {testPreview.body || '(empty)'}
              </p>
              <p className="text-[9px] text-emerald-400 font-semibold mt-2">✨ Variables are dynamically replaced using the recipient above.</p>
            </div>
            <Button
              className="w-full h-11 font-bold uppercase tracking-wider peak-gradient-bg text-white border-none rounded-xl shadow-md"
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
              Dispatch Test Draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
