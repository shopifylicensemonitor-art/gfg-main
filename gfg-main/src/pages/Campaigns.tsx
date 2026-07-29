import React, { useState, useEffect } from 'react';
import { api, type Campaign, type ContactListInfo, type Template } from '../api';
import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  Send, Plus, Trash2, Play, Pause, FileText, Info,
  Clock, Zap, CheckCircle2, ChevronRight, BarChart3, RotateCw 
} from 'lucide-react';

interface CampaignsProps {
  requirePin?: (label: string, action: () => void) => void;
}

const speedOptions = [
  { label: 'Safe Quota', sub: '60s delay', value: 60 },
  { label: 'Balanced', sub: '30s delay', value: 30 },
  { label: 'Fast Blast', sub: '10s delay', value: 10 },
];

export default function Campaigns({ requirePin }: CampaignsProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [lists, setLists] = useState<ContactListInfo[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [schedulerEnabled, setSchedulerEnabled] = useState<boolean>(true);

  // Spintax & Preview States
  const [listTokens, setListTokens] = useState<string[]>([]);
  const [previewItems, setPreviewItems] = useState<{ subject: string; body_html: string; recipient_email: string; sender_email: string | null }[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  // Form State
  const [name, setName] = useState<string>('');
  const [selectedList, setSelectedList] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [bodyHtml, setBodyHtml] = useState<string>('');
  const [bodyPlain, setBodyPlain] = useState<string>('');
  const [speed, setSpeed] = useState<number>(30);
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('22:00');

  // Rotation states
  const [contentMode, setContentMode] = useState<'single' | 'rotation'>('single');
  const [variations, setVariations] = useState<{ subject: string; body_html: string }[]>([
    { subject: '', body_html: '' }
  ]);

  useEffect(() => {
    if (selectedList) {
      api.getContacts(selectedList).then(contacts => {
        if (contacts.length > 0 && contacts[0].fields) {
          const keys = Object.keys(contacts[0].fields);
          setListTokens(keys);
        } else {
          setListTokens([]);
        }
      }).catch(() => {
        setListTokens([]);
      });
    } else {
      setListTokens([]);
    }
  }, [selectedList]);

  const handlePreview = async (id: number) => {
    setLoadingPreview(true);
    try {
      const data = await api.previewCampaign(id, 3);
      setPreviewItems(data);
      setIsPreviewOpen(true);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to load preview',
        description: e.message || 'Could not fetch resolved templates.'
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const loadData = async () => {
    try {
      const [cRes, lRes, tRes, sRes] = await Promise.all([
        api.getCampaigns(),
        api.getContactLists(),
        api.getTemplates(),
        api.getSettings()
      ]);
      setCampaigns(cRes);
      setLists(lRes);
      setTemplates(tRes);
      // Settings endpoint returns SCHEDULER_ENABLED as 'true'|'false'
      setSchedulerEnabled(sRes && sRes.SCHEDULER_ENABLED === 'true');
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error syncing campaigns',
        description: e.message || 'Could not fetch database entries.'
      });
    }
  };

  useEffect(() => {
    loadData();
    // Poll progress updates every 10 seconds for active campaigns
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const t = templates.find(temp => temp.id === Number(templateId));
    if (t) {
      setSubject(t.subject);
      setBodyHtml(t.body_html);
      setBodyPlain(t.body_plain);
      toast({
        title: 'Template loaded',
        description: `Subject and bodies updated with "${t.name}" content.`
      });
    }
  };

  const handleCreate = async (launchImmediately: boolean = false) => {
    const action = async () => {
      if (!name || !selectedList) {
        toast({
          variant: 'destructive',
          title: 'Missing information',
          description: 'Campaign Name and Recipient List are required fields.'
        });
        return;
      }

      let finalSubject = subject;
      let finalBodyHtml = bodyHtml;
      let finalBodyPlain = bodyPlain;

      if (contentMode === 'rotation') {
        const invalid = variations.some(v => !v.subject || !v.body_html);
        if (invalid || variations.length === 0) {
          toast({
            variant: 'destructive',
            title: 'Empty variations',
            description: 'All rotational variations must have a subject line and body content.'
          });
          return;
        }
        finalSubject = variations[0].subject;
        finalBodyHtml = variations[0].body_html;
        finalBodyPlain = '';
      } else {
        if (!subject) {
          toast({
            variant: 'destructive',
            title: 'Missing subject line',
            description: 'Provide a Subject Line for the email campaign.'
          });
          return;
        }
        if (!bodyHtml && !bodyPlain) {
          toast({
            variant: 'destructive',
            title: 'Empty email content',
            description: 'Provide HTML or Plain Text fallback body content.'
          });
          return;
        }
      }

      setLoading(true);
      try {
        const res = await api.createCampaign({
          name,
          subject: finalSubject,
          body_html: finalBodyHtml,
          body_plain: finalBodyPlain,
          contact_list: selectedList,
          delay_seconds: speed,
          start_time: startTime,
          end_time: endTime,
          content_mode: contentMode,
          content_variations: contentMode === 'rotation' ? (variations as any) : null
        });

        toast({
          title: 'Campaign created',
          description: `"${name}" was saved as draft.`
        });

        if (launchImmediately) {
            if (!schedulerEnabled) {
              toast({
                variant: 'destructive',
                title: 'Launch blocked',
                description: 'Background scheduler is disabled on the server. Enable it before launching campaigns.'
              });
            } else {
              await api.launchCampaign(res.id);
              toast({
                title: 'Campaign launched',
                description: `Queue processing began for "${name}".`
              });
            }
        }

        // Reset
        setShowForm(false);
        setName('');
        setSelectedList('');
        setSelectedTemplateId('');
        setSubject('');
        setBodyHtml('');
        setBodyPlain('');
        setSpeed(30);
        setStartTime('08:00');
        setEndTime('22:00');
        setContentMode('single');
        setVariations([{ subject: '', body_html: '' }]);
        loadData();
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Campaign creation failed',
          description: e.message
        });
      } finally {
        setLoading(false);
      }
    };

    if (requirePin) {
      requirePin('configure new email campaign', action);
    } else {
      action();
    }
  };

  const handleLaunch = (id: number) => {
    const action = async () => {
      try {
        if (!schedulerEnabled) {
          toast({
            variant: 'destructive',
            title: 'Launch blocked',
            description: 'Background scheduler is disabled on the server. Enable it before launching campaigns.'
          });
          return;
        }

        await api.launchCampaign(id);
        toast({
          title: 'Campaign launched',
          description: 'Emails added to the active scheduler queue.'
        });
        loadData();
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Launch failed',
          description: e.message
        });
      }
    };

    if (requirePin) {
      requirePin('launch campaign', action);
    } else {
      action();
    }
  };

  const handlePause = (id: number) => {
    const action = async () => {
      try {
        await api.pauseCampaign(id);
        toast({
          title: 'Sending suspended',
          description: 'Scheduler skipped pending sends for this campaign.'
        });
        loadData();
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Pause failed',
          description: e.message
        });
      }
    };

    if (requirePin) {
      requirePin('pause campaign sends', action);
    } else {
      action();
    }
  };

  const handleResume = (id: number) => {
    const action = async () => {
      try {
        await api.resumeCampaign(id);
        toast({
          title: 'Sending resumed',
          description: 'Active queue scheduled sends resumed.'
        });
        loadData();
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Resume failed',
          description: e.message
        });
      }
    };

    if (requirePin) {
      requirePin('resume campaign sends', action);
    } else {
      action();
    }
  };

  const handleDelete = (id: number) => {
    const action = async () => {
      if (!window.confirm('Delete this campaign and all its pending queue items?')) return;
      try {
        await api.deleteCampaign(id);
        toast({
          title: 'Campaign deleted',
          description: 'All records and queue records cleared.'
        });
        loadData();
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Delete failed',
          description: e.message
        });
      }
    };

    if (requirePin) {
      requirePin('delete campaign logs', action);
    } else {
      action();
    }
  };

  const getPct = (c: Campaign) => {
    return c.total_contacts > 0 ? Math.round((c.sent_count / c.total_contacts) * 100) : 0;
  };

  return (
    <AppShell>
      <SEO
        title="Campaigns Scheduler - Peak Xender"
        description="Compose bulk email sequences, set time schedules, adjust rotation speeds, and launch cold outreach."
      />
      <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
                Outreach Campaigns
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Build targeted flows, throttle sending speed, and automate rotating blasts.
              </p>
            </div>
            {!schedulerEnabled && (
              <div className="mt-3 sm:mt-0 sm:ml-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                Background scheduler is disabled on the server. Launch actions are blocked until the scheduler is enabled.
              </div>
            )}
            {!showForm && (
              <Button
                onClick={() => setShowForm(true)}
                className="h-10 gap-2 rounded-xl peak-gradient-bg border-none text-white font-semibold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                <span>New Campaign</span>
              </Button>
            )}
          </div>

          {/* Form Card */}
          {showForm && (
            <Card className="glass-card border-border/10 shadow-2xl p-6 space-y-4 animate-in slide-in-from-top duration-300">
              <div className="flex justify-between items-center pb-3 border-b border-border/10">
                <h3 className="text-base font-bold text-foreground">Launch New Campaign Flow</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>

              {/* Step 1: Meta and Contact List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Campaign Name</label>
                  <input
                    type="text"
                    placeholder="e.g. cold-outreach-tier-1"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-muted text-xs sm:text-sm rounded-xl border border-input px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recipient Contact List</label>
                  <select
                    value={selectedList}
                    onChange={e => setSelectedList(e.target.value)}
                    className="w-full bg-muted text-xs sm:text-sm rounded-xl border border-input px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Choose a contact list division...</option>
                    {lists.map(l => (
                      <option key={l.list_name} value={l.list_name}>
                        {l.list_name} ({l.count} recipients)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Option to load template directly */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Load content template (optional)</label>
                <select
                  value={selectedTemplateId}
                  onChange={e => handleTemplateSelect(e.target.value)}
                  className="w-full bg-muted text-xs sm:text-sm rounded-xl border border-input px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="">Select a templates layout to populate...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Dynamic Tokens & Spintax Helper */}
              {selectedList && (
                <div className="bg-primary/[0.03] border border-primary/10 rounded-xl p-3.5 space-y-3.5">
                  <div className="flex flex-col gap-1">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" /> Available Tokens for Personalization
                    </h4>
                    <p className="text-[10px] text-muted-foreground">
                      Use double curly braces in your subject or body. They will be auto-replaced for each contact.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="font-mono text-[9px] px-2 py-0.5 border border-border bg-card text-foreground rounded-md">
                      {"{{email}}"}
                    </span>
                    <span className="font-mono text-[9px] px-2 py-0.5 border border-border bg-card text-foreground rounded-md">
                      {"{{date}}"}
                    </span>
                    {listTokens.map(token => (
                      <span key={token} className="font-mono text-[9px] px-2 py-0.5 border border-primary/20 text-primary bg-card rounded-md">
                        {`{{${token}}}`}
                      </span>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-primary/10 flex flex-col gap-1">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary">Spintax Content Rotation Syntax</h4>
                    <p className="text-[10px] text-muted-foreground">
                      Rotate phrases using <code>{"{phrase1|phrase2}"}</code> format to ensure outgoing emails are unique. Supports nested syntax.
                    </p>
                    <div className="text-[10px] bg-muted/60 p-2.5 rounded-lg font-mono text-muted-foreground">
                      Example: <code>{"{Hi|Hello} {{first_name}}, {I was checking out|I noticed} your store..."}</code>
                    </div>
                  </div>
                </div>
              )}

              {/* Content Delivery Mode Toggles */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Content Delivery Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setContentMode('single')}
                    className={`border p-3 rounded-xl cursor-pointer text-center select-none transition-all ${
                      contentMode === 'single'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border/40 hover:bg-muted/40'
                    }`}
                  >
                    <span className={`text-xs font-bold block ${contentMode === 'single' ? 'text-primary' : 'text-foreground'}`}>Single Layout</span>
                    <span className="text-[10px] text-muted-foreground">Standard email layout for all recipients</span>
                  </div>
                  <div
                    onClick={() => setContentMode('rotation')}
                    className={`border p-3 rounded-xl cursor-pointer text-center select-none transition-all ${
                      contentMode === 'rotation'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border/40 hover:bg-muted/40'
                    }`}
                  >
                    <span className={`text-xs font-bold block ${contentMode === 'rotation' ? 'text-primary' : 'text-foreground'}`}>Rotational Variations</span>
                    <span className="text-[10px] text-muted-foreground">Cycle multiple subject/body styles</span>
                  </div>
                </div>
              </div>

              {/* Single Mode Fields */}
              {contentMode === 'single' && (
                <div className="space-y-4">
                  {/* Subject */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Subject Line</label>
                    <input
                      type="text"
                      placeholder="e.g. Quick question regarding {{email}}"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full bg-muted text-xs sm:text-sm rounded-xl border border-input px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  {/* Body Composer */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email HTML Body</label>
                    <textarea
                      placeholder="<h2>Greeting!</h2> <p>Start composing HTML formatting...</p>"
                      value={bodyHtml}
                      onChange={e => setBodyHtml(e.target.value)}
                      className="w-full bg-muted text-xs rounded-xl border border-input p-3 min-h-[120px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                    />
                  </div>

                  {/* Body Plain compose */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Plain Text Fallback (Spam Filter Guard)</label>
                    <textarea
                      placeholder="Plain text content fallback..."
                      value={bodyPlain}
                      onChange={e => setBodyPlain(e.target.value)}
                      className="w-full bg-muted text-xs sm:text-sm rounded-xl border border-input p-3 min-h-[70px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {/* Rotational Mode Fields */}
              {contentMode === 'rotation' && (
                <div className="space-y-4 border border-border/20 rounded-xl p-4 bg-muted/20">
                  <div className="flex justify-between items-center pb-2 border-b border-border/10">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <RotateCw className="h-3.5 w-3.5 text-primary" />
                      Content Variations ({variations.length})
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => setVariations([...variations, { subject: '', body_html: '' }])}
                      className="h-7 text-[10px] font-bold gap-1 rounded-lg"
                    >
                      <Plus className="h-3 w-3" /> Add Variation
                    </Button>
                  </div>

                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {variations.map((v, idx) => (
                      <div key={idx} className="space-y-2.5 p-3 border border-border/10 bg-background rounded-xl relative shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Variation #{idx + 1}</span>
                          {variations.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              onClick={() => {
                                const newV = [...variations];
                                newV.splice(idx, 1);
                                setVariations(newV);
                              }}
                              className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md flex items-center justify-center"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Subject Line</label>
                          <input
                            type="text"
                            placeholder="e.g. Quick question regarding {{email}}"
                            value={v.subject}
                            onChange={e => {
                              const newV = [...variations];
                              newV[idx].subject = e.target.value;
                              setVariations(newV);
                            }}
                            className="w-full bg-muted text-xs rounded-lg border border-input px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">HTML Body</label>
                          <textarea
                            placeholder="e.g. <p>Hello, this is content variation...</p>"
                            value={v.body_html}
                            onChange={e => {
                              const newV = [...variations];
                              newV[idx].body_html = e.target.value;
                              setVariations(newV);
                            }}
                            className="w-full bg-muted text-[11px] rounded-lg border border-input p-2.5 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Speed & Delays */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Dispatch Frequency Speed</label>
                <div className="grid grid-cols-3 gap-2">
                  {speedOptions.map(opt => (
                    <div
                      key={opt.value}
                      onClick={() => setSpeed(opt.value)}
                      className={`border p-3 rounded-xl cursor-pointer text-center select-none transition-all ${
                        speed === opt.value
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border/40 hover:bg-muted/40'
                      }`}
                    >
                      <span className={`text-xs font-bold block ${speed === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.sub}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Speed & Time Settings */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Custom Delay (sec)</label>
                  <input
                    type="number"
                    value={speed}
                    onChange={e => setSpeed(Number(e.target.value))}
                    className="w-full bg-muted text-xs sm:text-sm rounded-xl border border-input px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sending Starts</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-muted text-xs sm:text-sm rounded-xl border border-input px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sending Stops</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full bg-muted text-xs sm:text-sm rounded-xl border border-input px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2.5 justify-end pt-2 border-t border-border/10">
                <Button 
                  variant="outline" 
                  onClick={() => handleCreate(false)} 
                  disabled={loading}
                  className="h-10 text-xs font-semibold"
                >
                  Save as Draft
                </Button>
                <Button 
                  onClick={() => handleCreate(true)} 
                  disabled={loading || !schedulerEnabled}
                  className="h-10 text-xs gap-1.5 font-semibold"
                >
                  <Zap className="h-4 w-4" />
                  <span>Launch Campaign</span>
                </Button>
              </div>
            </Card>
          )}

          {/* Active Campaigns Tracker List */}
          <Card className="glass-card border-border/10 shadow-lg">
            <CardHeader className="border-b border-border/10 pb-4">
              <CardTitle className="text-base font-bold text-foreground">Campaign Dashboard ({campaigns.length})</CardTitle>
              <CardDescription className="text-xs">Monitor running batches or launch pending drafts.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/10">
              {campaigns.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground text-xs space-y-2">
                  <BarChart3 className="h-8 w-8 mx-auto opacity-30" />
                  <p>No outreach campaigns registered. Click "New Campaign" to set up your first blast.</p>
                </div>
              ) : (
                campaigns.map(c => {
                  const pct = getPct(c);
                  return (
                    <div key={c.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-muted/5">
                      
                      {/* Left Side: Campaign stats & bar */}
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-foreground truncate">{c.name}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            c.content_mode === 'rotation'
                              ? 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                              : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                          }`}>
                            {c.content_mode === 'rotation' ? 'ROTATION' : 'SINGLE'}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            c.status === 'sending'
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : c.status === 'paused'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                : c.status === 'completed'
                                  ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                  : 'bg-muted text-muted-foreground border-border/40'
                          }`}>
                            {c.status.toUpperCase()}
                          </span>
                        </div>
                        
                        <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
                          <span>List: <span className="underline">{c.contact_list}</span></span>
                          <span>·</span>
                          {c.content_mode === 'rotation' && (
                            <>
                              <span>Variations: {(() => {
                                try {
                                  return JSON.parse(c.content_variations || '[]').length;
                                } catch {
                                  return 0;
                                }
                              })()}</span>
                              <span>·</span>
                            </>
                          )}
                          <span>Delay: {c.delay_seconds}s</span>
                          <span>·</span>
                          <span>Sent: {c.sent_count}/{c.total_contacts}</span>
                          {c.failed_count > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-destructive font-semibold">Failed: {c.failed_count}</span>
                            </>
                          )}
                        </div>

                        {/* Progress Bar wrapper */}
                        <div className="flex items-center gap-3 w-full sm:w-80">
                          <div className="h-2 w-full bg-muted border border-border/20 rounded-full overflow-hidden shrink-0">
                            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-foreground shrink-0">{pct}%</span>
                        </div>
                      </div>

                      {/* Right Side: Action Control Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 self-end md:self-center">
                        {c.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLaunch(c.id)}
                            disabled={!schedulerEnabled}
                            className="h-8 gap-1 rounded-lg text-xs font-semibold hover:bg-emerald-500/10 hover:text-emerald-500 border-emerald-500/20"
                          >
                            <Play className="h-3.5 w-3.5" />
                            <span>Launch</span>
                          </Button>
                        )}
                        {c.status === 'sending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePause(c.id)}
                            className="h-8 gap-1 rounded-lg text-xs font-semibold hover:bg-amber-500/10 hover:text-amber-500 border-amber-500/20"
                          >
                            <Pause className="h-3.5 w-3.5" />
                            <span>Pause</span>
                          </Button>
                        )}
                        {c.status === 'paused' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResume(c.id)}
                            className="h-8 gap-1 rounded-lg text-xs font-semibold hover:bg-emerald-500/10 hover:text-emerald-500 border-emerald-500/20"
                          >
                            <Play className="h-3.5 w-3.5" />
                            <span>Resume</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePreview(c.id)}
                          disabled={loadingPreview}
                          className="h-8 gap-1 rounded-lg text-xs font-semibold"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Preview</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(c.id)}
                          className="h-8 gap-1 rounded-lg text-xs font-semibold hover:bg-destructive/10 hover:text-destructive border-destructive/20 text-destructive/90"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </Button>
                      </div>

                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
      </div>

      {/* Campaign Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl bg-background border-border p-6 rounded-2xl animate-in zoom-in-95 duration-200">
          <DialogHeader className="pb-3 border-b border-border/40">
            <DialogTitle className="flex items-center gap-2 text-lg font-black tracking-tight">
              <Zap className="h-5 w-5 text-primary" />
              <span>Email Execution Preview (Resolved Spintax &amp; Tokens)</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Below are 3 sample rendered outputs demonstrating how variables and rotation syntax resolve for individual leads.
            </p>
          </DialogHeader>

          <div className="space-y-6 pt-4 max-h-[65vh] overflow-y-auto pr-1">
            {previewItems.map((item, idx) => (
              <div key={idx} className="border border-border/60 bg-muted/5 rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border/40 grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground">
                  <div>
                    <span className="font-bold text-foreground">To: </span>
                    <span>{item.recipient_email}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-foreground">From: </span>
                    <span>{item.sender_email || 'Round-Robin Rotation'}</span>
                  </div>
                </div>

                <div className="px-4 py-2.5 border-b border-border/20 text-xs font-bold text-foreground">
                  <span className="text-muted-foreground font-mono mr-2">Subject:</span>
                  {item.subject}
                </div>

                <div className="p-4 text-xs text-foreground bg-card overflow-x-auto min-h-[100px] leading-relaxed">
                  <div dangerouslySetInnerHTML={{ __html: item.body_html || '<p class="text-muted-foreground italic">No HTML content provided.</p>' }} />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border/40 flex justify-end">
            <Button onClick={() => setIsPreviewOpen(false)} className="text-xs">
              Close Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
