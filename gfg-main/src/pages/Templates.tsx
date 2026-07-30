import React, { useState, useEffect, useRef } from 'react';
import { api, type Template } from '../api';
import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Layout, Plus, Trash2, Edit, ChevronDown, ChevronUp, Save, Eye, Sparkles, FileText, Info } from 'lucide-react';

interface TemplatesProps {
  requirePin?: (label: string, action: () => void) => void;
}

const defaultHtml = `<h2 style="color:#111;">Hello there!</h2>
<p>This is your email content. You can use HTML to style it.</p>
<p>Add images, buttons, links and more.</p>
<a href="https://yoursite.com" style="display:inline-block;padding:10px 20px;background:#111;color:#fff;border-radius:6px;text-decoration:none;">Click here</a>
<p style="color:#888;font-size:12px;margin-top:24px;">To unsubscribe, reply to this email.</p>`;

const defaultPlain = `Hello there!\n\nThis is your email content.\n\nTo unsubscribe, reply to this email.`;

export default function Templates({ requirePin }: TemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form State
  const [name, setName] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [bodyHtml, setBodyHtml] = useState<string>('');
  const [bodyPlain, setBodyPlain] = useState<string>('');
  
  const previewRef = useRef<HTMLIFrameElement | null>(null);

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading templates',
        description: e.message || 'Could not fetch templates.'
      });
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Sync iframe preview
  useEffect(() => {
    if (previewRef.current && (showForm || editingTemplate)) {
      previewRef.current.srcdoc = `
        <html>
          <body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:16px;margin:0;font-size:13px;line-height:1.7;color:#111;">
            ${bodyHtml || '<p style="color:#888;font-style:italic">Email preview content goes here...</p>'}
          </body>
        </html>`;
    }
  }, [bodyHtml, showForm, editingTemplate]);

  const handleOpenNewForm = () => {
    setName('');
    setSubject('');
    setBodyHtml(defaultHtml);
    setBodyPlain(defaultPlain);
    setEditingTemplate(null);
    setShowForm(true);
  };

  const handleOpenEditForm = (t: Template) => {
    setName(t.name);
    setSubject(t.subject);
    setBodyHtml(t.body_html);
    setBodyPlain(t.body_plain);
    setEditingTemplate(t);
    setShowForm(true);
  };

  const handleSave = () => {
    const action = async () => {
      if (!name || !subject) {
        toast({
          variant: 'destructive',
          title: 'Missing fields',
          description: 'Template name and email subject line are required.'
        });
        return;
      }

      try {
        if (editingTemplate) {
          await api.updateTemplate(editingTemplate.id, {
            name, subject, body_html: bodyHtml, body_plain: bodyPlain
          });
          toast({
            title: 'Template updated',
            description: `Changes to "${name}" were saved.`
          });
        } else {
          await api.createTemplate({
            name, subject, body_html: bodyHtml, body_plain: bodyPlain
          });
          toast({
            title: 'Template saved',
            description: `"${name}" was created successfully.`
          });
        }
        setShowForm(false);
        loadTemplates();
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Error saving template',
          description: e.message
        });
      }
    };

    if (requirePin) {
      requirePin('save templates changes', action);
    } else {
      action();
    }
  };

  const handleDelete = (id: number, name: string) => {
    const action = async () => {
      if (!window.confirm(`Permanently delete template "${name}"?`)) return;
      try {
        await api.deleteTemplate(id);
        toast({
          title: 'Template deleted',
          description: `"${name}" was deleted successfully.`
        });
        loadTemplates();
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Error deleting template',
          description: e.message
        });
      }
    };

    if (requirePin) {
      requirePin('delete outreach templates', action);
    } else {
      action();
    }
  };

  return (
    <AppShell>
      <SEO
        title="Email Outreach Templates - Peak Xender"
        description="Design reusable cold outreach HTML layouts with live preview frames and plain-text fallbacks."
        noindex={true}
      />
      <div className="space-y-6 font-sans">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
                Outreach Templates Library
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Design responsive, highly-converting HTML and plain-text layouts.
              </p>
            </div>
            {!showForm && (
              <Button
                onClick={handleOpenNewForm}
                className="h-10 gap-2 rounded-xl peak-gradient-bg border-none text-white font-semibold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                <span>New Template</span>
              </Button>
            )}
          </div>

          {/* Guidelines Banner */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex gap-3 text-xs text-primary leading-relaxed shadow-sm">
            <Info className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
            <div className="space-y-1">
              <p className="font-bold">Avoid spam folders using rotating content</p>
              <p>
                When launching campaign flows, you can specify multiple templates. Peak Xender dynamically rotates these layouts so that each recipient receives a slightly randomized version, disrupting signature filters and increasing inbox rates.
              </p>
            </div>
          </div>

          {/* Form Composer (Show when creating/editing) */}
          {showForm && (
            <Card className="glass-card border-border/10 shadow-2xl p-6 space-y-4 animate-in slide-in-from-top duration-300">
              <div className="flex justify-between items-center pb-3 border-b border-border/10">
                <h3 className="text-base font-bold text-foreground">
                  {editingTemplate ? 'Edit Template Details' : 'Design New Template'}
                </h3>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} className="gap-1.5 font-semibold">
                    <Save className="h-4 w-4" />
                    <span>Save Template</span>
                  </Button>
                </div>
              </div>

              {/* Title & Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Template Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sales Intro - Type A"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-muted text-xs sm:text-sm rounded-xl border border-input px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Email Subject Line</label>
                  <input
                    type="text"
                    placeholder="e.g. Quick question about {{email}}"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full bg-muted text-xs sm:text-sm rounded-xl border border-input px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Editor Workspace */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  HTML Content &amp; Realtime Visualizer
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-input rounded-xl overflow-hidden bg-card">
                  {/* Left: Code Editor */}
                  <div className="flex flex-col border-b md:border-b-0 md:border-r border-input">
                    <div className="bg-muted px-4 py-2 border-b border-input text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      HTML Source Editor
                    </div>
                    <textarea
                      value={bodyHtml}
                      onChange={e => setBodyHtml(e.target.value)}
                      placeholder="Enter HTML layout..."
                      spellCheck={false}
                      className="w-full p-4 font-mono text-[11px] sm:text-xs leading-relaxed resize-y h-64 focus:outline-none bg-background text-foreground"
                    />
                  </div>
                  {/* Right: IFrame Preview */}
                  <div className="flex flex-col">
                    <div className="bg-muted px-4 py-2 border-b border-input text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Eye className="h-3 w-3 text-primary" />
                      Live Sandbox Preview
                    </div>
                    <iframe
                      ref={previewRef}
                      title="visual-preview"
                      sandbox="allow-same-origin"
                      className="w-full h-64 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Plain Text Fallback */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Plain-Text Alternative Quota (Spam Guard Fallback)
                </label>
                <textarea
                  value={bodyPlain}
                  onChange={e => setBodyPlain(e.target.value)}
                  placeholder="Enter fallback text email content..."
                  className="w-full bg-muted text-xs sm:text-sm rounded-xl border border-input p-3.5 min-h-[90px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary leading-relaxed"
                />
              </div>
            </Card>
          )}

          {/* Saved Templates List */}
          <Card className="glass-card border-border/10 shadow-lg">
            <CardHeader className="border-b border-border/10 pb-4">
              <CardTitle className="text-base font-bold text-foreground">Saved Templates ({templates.length})</CardTitle>
              <CardDescription className="text-xs">Browse templates or click on them to preview code structures.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/10">
              {templates.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground text-xs space-y-2">
                  <Layout className="h-8 w-8 mx-auto opacity-30" />
                  <p>No template layouts created. Add one to design reusable templates.</p>
                </div>
              ) : (
                templates.map(t => {
                  const isExpanded = expandedId === t.id;
                  return (
                    <div key={t.id} className="transition-colors hover:bg-muted/5">
                      {/* Row Header */}
                      <div className="p-4 flex items-center justify-between gap-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : t.id)}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 bg-primary/10 text-primary border border-primary/20 rounded-xl flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs sm:text-sm text-foreground truncate">{t.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              Subject: {t.subject} · Created: {new Date(t.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        {/* Actions & Chevron */}
                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEditForm(t)}
                            className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg border border-border/20"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(t.id, t.name)}
                            className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-lg border border-destructive/20"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setExpandedId(isExpanded ? null : t.id)}
                            className="h-8 w-8 text-muted-foreground rounded-lg border border-border/20"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Preview Sandbox */}
                      {isExpanded && (
                        <div className="px-4 pb-4 animate-in fade-in duration-200">
                          <div className="rounded-xl border border-border bg-white overflow-hidden shadow-inner">
                            <div className="bg-muted border-b border-border px-3.5 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                              Visual Live Sandbox Frame
                            </div>
                            <iframe
                              srcDoc={`
                                <html>
                                  <body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:16px;margin:0;font-size:13px;line-height:1.7;color:#111;">
                                    ${t.body_html}
                                  </body>
                                </html>`}
                              title={`preview-${t.id}`}
                              sandbox="allow-same-origin"
                              className="w-full h-48 bg-white border-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
      </div>
    </AppShell>
  );
}
