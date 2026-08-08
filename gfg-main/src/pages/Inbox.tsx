import React, { useState, useEffect } from 'react';
import { api, type InboxMessage } from '../api';
import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  Inbox as InboxIcon, RefreshCw, Mail, Flame, CheckCircle2, 
  ExternalLink, Sparkles, Send, User, Building2, Tag, Search, Filter
} from 'lucide-react';

export default function Inbox() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [selectedMsg, setSelectedMsg] = useState<InboxMessage | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const [draftingAI, setDraftingAI] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadInbox();
  }, []);

  const loadInbox = async () => {
    setLoading(true);
    try {
      const data = await api.getInboxMessages(100);
      setMessages(data);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to load inbox', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.syncInbox();
      toast({ title: 'Inbox Synced', description: res.message });
      loadInbox();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Sync Failed', description: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectMsg = (msg: InboxMessage) => {
    setSelectedMsg(msg);
    setReplyText('');
    if (!msg.is_read) {
      api.markInboxRead(msg.id).catch(() => {});
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: 1 } : m));
    }
  };

  const handleAIReplyDraft = async () => {
    if (!selectedMsg) return;
    setDraftingAI(true);
    try {
      const res = await api.aiReplyDraft({
        incomingSubject: selectedMsg.subject || '',
        incomingBody: selectedMsg.body_text || selectedMsg.body_html || '',
        senderEmail: selectedMsg.sender_email,
        contactFields: selectedMsg.contact_fields || {}
      });
      if (res.success && res.replyDraft) {
        setReplyText(res.replyDraft);
        toast({ title: 'AI Reply Drafted', description: 'Generated reply adhering to your AI rules.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'AI Draft Failed', description: err.message });
    } finally {
      setDraftingAI(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedMsg || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await api.replyToInboxMessage(selectedMsg.id, replyText);
      toast({ title: 'Reply Queued', description: res.message });
      setSelectedMsg(null);
      setReplyText('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Reply Failed', description: err.message });
    } finally {
      setSendingReply(false);
    }
  };

  const filteredMessages = messages.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.sender_email.toLowerCase().includes(q) ||
      (m.subject && m.subject.toLowerCase().includes(q)) ||
      (m.store_name && m.store_name.toLowerCase().includes(q))
    );
  });

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'hot_lead':
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1"><Flame className="h-3 w-3 fill-emerald-500" /> Hot Prospect</Badge>;
      case 'unsubscribe':
        return <Badge variant="outline" className="text-destructive border-destructive/40">Unsubscribe Request</Badge>;
      case 'question':
        return <Badge variant="outline" className="text-blue-500 border-blue-500/40">Inquiry / Question</Badge>;
      default:
        return <Badge variant="secondary" className="text-muted-foreground">General Reply</Badge>;
    }
  };

  return (
    <AppShell>
      <SEO title="Unified Inbox & Replies | Peak Xender" description="Two-Way prospect receiving, lead dossiers, and AI reply drafting." />

      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2">
              <InboxIcon className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-extrabold tracking-tight">Unified Prospect Inbox</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Receive, review, and reply to incoming prospect responses with automated lead dossiers.
            </p>
          </div>

          <Button
            onClick={handleSync}
            disabled={syncing}
            variant="outline"
            className="text-xs font-semibold gap-2 border-border"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing Messages...' : 'Sync Inbox'}
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search replies by email, subject, or store..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        {/* Messages List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading inbox messages...</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <Card className="border-border p-12 text-center">
            <InboxIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-base font-bold">No Prospect Replies Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              When prospects reply to your cold outreach campaigns, their responses and store dossiers will appear here.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredMessages.map((msg) => (
              <Card
                key={msg.id}
                onClick={() => handleSelectMsg(msg)}
                className={`border transition-all cursor-pointer hover:border-primary/50 ${
                  !msg.is_read ? 'bg-primary/5 border-primary/30 shadow-sm' : 'border-border bg-card'
                }`}
              >
                <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-primary" />
                        {msg.sender_email}
                      </span>
                      {getSentimentBadge(msg.sentiment)}
                      {!msg.is_read && (
                        <span className="text-[9px] font-extrabold bg-primary text-primary-foreground px-1.5 py-0.5 rounded uppercase">
                          New
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-semibold text-foreground truncate">
                      {msg.subject || '(No Subject)'}
                    </div>

                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {msg.body_text || msg.body_html || '(Empty Message Body)'}
                    </div>

                    {msg.store_url && (
                      <div className="flex items-center gap-1 text-[11px] text-primary hover:underline font-mono pt-1">
                        <Building2 className="h-3 w-3" />
                        <a href={msg.store_url.startsWith('http') ? msg.store_url : `https://${msg.store_url}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          {msg.store_name || msg.store_url}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    <span className="font-mono text-[11px]">
                      {new Date(msg.created_at).toLocaleDateString()} {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <Button variant="ghost" size="sm" className="text-xs font-bold text-primary">
                      View Dossier & Reply
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Message Dossier & Reply Modal */}
        <Dialog open={!!selectedMsg} onOpenChange={(open) => !open && setSelectedMsg(null)}>
          {selectedMsg && (
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold">Prospect Dossier & Message</DialogTitle>
                  {getSentimentBadge(selectedMsg.sentiment)}
                </div>
                <DialogDescription className="text-xs">
                  Review prospect details and reply directly or generate an AI draft.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 pt-2">
                {/* Enriched Prospect Dossier Card */}
                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                    Enriched Prospect Dossier
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Email:</span>{' '}
                      <span className="font-bold font-mono">{selectedMsg.sender_email}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Contact List:</span>{' '}
                      <span className="font-semibold">{selectedMsg.contact_list || 'Default'}</span>
                    </div>

                    {selectedMsg.store_url && (
                      <div className="col-span-1 sm:col-span-2">
                        <span className="text-muted-foreground">Store / Website:</span>{' '}
                        <a
                          href={selectedMsg.store_url.startsWith('http') ? selectedMsg.store_url : `https://${selectedMsg.store_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-primary hover:underline font-mono inline-flex items-center gap-1 ml-1"
                        >
                          {selectedMsg.store_url} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}

                    {selectedMsg.contact_fields && Object.keys(selectedMsg.contact_fields).length > 0 && (
                      <div className="col-span-1 sm:col-span-2 pt-2 border-t border-border/50">
                        <span className="text-muted-foreground block mb-1 font-bold">Extracted Prospect Fields:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(selectedMsg.contact_fields).map(([k, v]) => (
                            <Badge key={k} variant="outline" className="text-[10px] font-mono">
                              {k}: {String(v)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Message Body */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground">Message Content:</label>
                  <div className="p-4 rounded-xl border border-border bg-card text-xs font-sans whitespace-pre-wrap leading-relaxed">
                    {selectedMsg.body_text || selectedMsg.body_html || '(Empty Message Body)'}
                  </div>
                </div>

                {/* Reply Composer */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5 text-primary" />
                      Send Response
                    </label>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAIReplyDraft}
                      disabled={draftingAI}
                      className="text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                    >
                      {draftingAI ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      1-Click AI Reply Draft
                    </Button>
                  </div>

                  <Textarea
                    rows={5}
                    placeholder="Type your response or use '1-Click AI Reply Draft'..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="text-xs"
                  />

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setSelectedMsg(null)} className="text-xs">
                      Cancel
                    </Button>
                    <Button onClick={handleSendReply} disabled={sendingReply || !replyText.trim()} className="text-xs gap-1.5 font-bold">
                      {sendingReply ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send Reply
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </AppShell>
  );
}
