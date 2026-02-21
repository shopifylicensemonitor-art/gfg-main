import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Send, Mail, Upload, X, MoreVertical, FileText, Save, Trash2, Filter, FlaskConical, RefreshCw } from 'lucide-react';
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
  userName: string;
  onUserNameChange: (name: string) => void;
  onFilterList?: (predicate: (email: string) => boolean) => void;
  isUploading?: boolean;
  onGenerated?: () => void;
}

const COMMON_PROVIDERS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 'yandex.com', 'mail.com', 'gmx.com'];

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
}: FastMailSendProps & { onReplaceEmails: (text: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

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
  }, []);

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
        return domain ? !COMMON_PROVIDERS.includes(domain) : false;
      });
      toast({ title: "Filter Applied", description: "Kept only Personal/Business domains." });
    }
  }, [onFilterList]);

  const handleExtractProviders = useCallback(() => {
    if (onFilterList) {
      onFilterList((email) => {
        const domain = email.split('@')[1]?.toLowerCase();
        return domain ? COMMON_PROVIDERS.includes(domain) : false;
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
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
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
              <DropdownMenuLabel>Extract Filters</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleExtractPersonal}>
                <Filter className="mr-2 h-4 w-4" />
                Personal Domains Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExtractProviders}>
                <Filter className="mr-2 h-4 w-4" />
                Email Providers Only
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Stats (Current Input)
              </DropdownMenuLabel>
              <DropdownMenuItem disabled className="justify-between cursor-default opacity-100">
                <span>Valid</span>
                <span className="text-xs font-mono">{validCount}</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="justify-between cursor-default opacity-100">
                <span>Invalid</span>
                <span className="text-xs font-mono">{invalidCount}</span>
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

      {/* User Name / Brand */}
      <div className="space-y-2">
        <label className="text-sm font-medium">My Identity / Name ({`{brand}`})</label>
        <Input
          placeholder="e.g. Hostinger / John Doe"
          value={userName}
          onChange={(e) => onUserNameChange(e.target.value)}
          className="bg-background"
        />
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
        <label className="text-sm font-medium">Message Body</label>
        <Textarea
          placeholder="Type your message here... Supports {name}, {store}, {sname}"
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          className="min-h-[150px] resize-none bg-background"
        />
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
        <Button variant="outline" onClick={() => setIsTestDialogOpen(true)} className="border-primary/30 text-primary hover:bg-primary/10">
          <FlaskConical className="mr-2 h-4 w-4" />
          Test
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
        <DialogContent className="sm:max-w-md">
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
                const mailtoParams = new URLSearchParams();
                if (testPreview.subject) mailtoParams.append('subject', testPreview.subject);
                if (testPreview.body) mailtoParams.append('body', testPreview.body);
                window.location.href = `mailto:${testRecipient}?${mailtoParams.toString().replace(/\+/g, '%20')}`;
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
