import React, { useState, useEffect, useCallback } from 'react';
import { api, type ContactListInfo, type Contact } from '../api';
import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Users, Upload, Trash2, Plus, UserPlus, Search, ListFilter, AlertTriangle, FileSpreadsheet, Info, History, Mail, MessageSquare, CheckCircle2, ShieldAlert, X } from 'lucide-react';

interface ContactsProps {
  requirePin?: (label: string, action: () => void) => void;
}

export default function Contacts({ requirePin }: ContactsProps) {
  const [lists, setLists] = useState<ContactListInfo[]>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingLists, setLoadingLists] = useState<boolean>(false);
  const [loadingContacts, setLoadingContacts] = useState<boolean>(false);
  
  // CSV Import State
  const [newListName, setNewListName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  // Manual Contact Entry State
  const [manualEmail, setManualEmail] = useState<string>('');
  const [addingManual, setAddingManual] = useState<boolean>(false);

  // Filter Query
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Contact History State
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);
  const [historyData, setHistoryData] = useState<{
    sends: any[];
    logs: any[];
    replies: any[];
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const data = await api.getContactLists();
      setLists(data);
      if (data.length > 0 && !selectedList) {
        setSelectedList(data[0].list_name);
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading contact lists',
        description: e.message || 'Could not fetch list statistics.'
      });
    } finally {
      setLoadingLists(false);
    }
  }, [selectedList]);

  const loadContacts = async (listName: string) => {
    setLoadingContacts(true);
    try {
      const data = await api.getContacts(listName);
      setContacts(data);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: `Error loading contacts for "${listName}"`,
        description: e.message
      });
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleOpenHistory = async (contact: Contact) => {
    setHistoryContact(contact);
    setLoadingHistory(true);
    try {
      const data = await api.getContactHistory(contact.email);
      setHistoryData(data);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading contact history',
        description: err.message || 'Could not fetch history.'
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (selectedList) {
      loadContacts(selectedList);
    } else {
      setContacts([]);
    }
  }, [selectedList]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      // If list name is empty, auto-populate with file name (sans extension)
      if (!newListName) {
        const baseName = e.target.files[0].name.replace(/\.[^/.]+$/, "");
        // Clean list name to make it friendly
        setNewListName(baseName.replace(/[^a-zA-Z0-9_\-\s]/g, ''));
      }
    }
  };

  const handleUploadCSV = () => {
    const action = async () => {
      if (!selectedFile || !newListName.trim()) {
        toast({
          variant: 'destructive',
          title: 'Missing upload fields',
          description: 'Provide a list name and choose a CSV file.'
        });
        return;
      }

      setUploading(true);
      try {
        toast({
          title: 'Parsing and uploading CSV...',
          description: 'This may take a moment for larger spreadsheets.'
        });
        const res = await api.uploadContacts(newListName.trim(), selectedFile);
        toast({
          title: 'CSV uploaded successfully',
          description: `Added ${res.added} contacts. Skipped ${res.skipped} duplicates.`
        });
        
        // Reset states
        setSelectedFile(null);
        setNewListName('');
        // Clear file input manually
        const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        // Select the newly uploaded list and refresh lists
        setSelectedList(newListName.trim());
        await loadLists();
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'CSV upload failed',
          description: e.message || 'Check CSV layout is valid.'
        });
      } finally {
        setUploading(false);
      }
    };

    if (requirePin) {
      requirePin('import contact list', action);
    } else {
      action();
    }
  };

  const handleAddManual = async () => {
    if (!selectedList) {
      toast({
        variant: 'destructive',
        title: 'No list selected',
        description: 'Choose or upload a list before manually adding individual emails.'
      });
      return;
    }

    if (!manualEmail.trim() || !manualEmail.includes('@')) {
      toast({
        variant: 'destructive',
        title: 'Invalid Email Address',
        description: 'Enter a valid email address.'
      });
      return;
    }

    setAddingManual(true);
    try {
      await api.addContact(selectedList, manualEmail.trim());
      toast({
        title: 'Contact added',
        description: `Successfully added ${manualEmail} to "${selectedList}".`
      });
      setManualEmail('');
      loadContacts(selectedList);
      loadLists(); // Update list count stats
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error adding contact',
        description: e.message
      });
    } finally {
      setAddingManual(false);
    }
  };

  const handleDeleteList = (listName: string) => {
    const action = async () => {
      if (!window.confirm(`Permanently delete the entire contact list "${listName}"? This action is irreversible.`)) return;
      try {
        await api.deleteContactList(listName);
        toast({
          title: 'List deleted',
          description: `"${listName}" and all its recipients were removed.`
        });
        
        if (selectedList === listName) {
          setSelectedList(null);
        }
        loadLists();
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Error deleting list',
          description: e.message
        });
      }
    };

    if (requirePin) {
      requirePin('delete list of contacts', action);
    } else {
      action();
    }
  };

  const handleDeleteSingle = (id: number, email: string) => {
    const action = async () => {
      if (!selectedList) return;
      if (!window.confirm(`Remove email "${email}" from list "${selectedList}"?`)) return;
      try {
        await api.deleteContact(selectedList, id);
        toast({
          title: 'Contact removed',
          description: `${email} was deleted.`
        });
        loadContacts(selectedList);
        loadLists(); // Update list count stats
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Error deleting contact',
          description: e.message
        });
      }
    };

    if (requirePin) {
      requirePin('delete individual contact', action);
    } else {
      action();
    }
  };

  // Filter contacts by query
  const filteredContacts = contacts.filter(c => 
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell>
      <SEO
        title="Manage Contact Lists - Peak Xender"
        description="Upload spreadsheets, filter duplicate emails, and configure target list divisions for cold email sending."
        noindex={true}
      />
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            Leads &amp; Contact Lists
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Upload spreadsheets, divisions, and build targets for automated email campaigns.
          </p>
        </div>

        {/* Grid Layout: Left import details, Right Lists explorer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Import / Manual Actions */}
          <div className="md:col-span-1 space-y-6">
            
            {/* CSV Upload Card */}
            <Card className="glass-card border-border/10 shadow-lg">
              <CardHeader className="pb-3 border-b border-border/5">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Upload className="h-4 w-4 text-primary" />
                  Import CSV List
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Create lists by uploading spreadsheets.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">List Division Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Q3 SaaS Leads"
                    value={newListName}
                    onChange={e => setNewListName(e.target.value)}
                    className="w-full bg-muted text-xs rounded-xl border border-input px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">CSV Spreadsheet</label>
                  <div className="relative border border-dashed border-input rounded-xl p-4 text-center hover:bg-muted/30 transition-colors cursor-pointer">
                    <input
                      id="csv-file-input"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileSpreadsheet className="h-6 w-6 mx-auto mb-2 text-primary/75" />
                    <span className="text-[10px] font-semibold text-foreground truncate block max-w-full">
                      {selectedFile ? selectedFile.name : 'Choose CSV file'}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleUploadCSV}
                  disabled={uploading || !selectedFile || !newListName.trim()}
                  className="w-full h-9 text-xs gap-1.5 font-semibold"
                >
                  {uploading ? 'Processing CSV...' : 'Import Recipients'}
                </Button>
              </CardContent>
            </Card>

            {/* Manual Add Card */}
            <Card className="glass-card border-border/10 shadow-lg">
              <CardHeader className="pb-3 border-b border-border/5">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4 text-primary" />
                  Add Recipient
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Add single contact to currently active list.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    placeholder="leads@targetdomain.com"
                    value={manualEmail}
                    onChange={e => setManualEmail(e.target.value)}
                    disabled={!selectedList}
                    className="w-full bg-muted text-xs rounded-xl border border-input px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
                  />
                </div>
                <Button
                  onClick={handleAddManual}
                  disabled={addingManual || !manualEmail.trim() || !selectedList}
                  className="w-full h-9 text-xs gap-1.5 font-semibold"
                >
                  <span>Insert Contact</span>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Columns: Lists & Data Explorer */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Lists Selector Tabs */}
            <Card className="glass-card border-border/10 shadow-lg">
              <CardHeader className="border-b border-border/10 pb-4">
                <CardTitle className="text-sm font-bold text-foreground">Select Contacts List</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {loadingLists ? (
                  <p className="text-xs text-center text-muted-foreground py-4">Loading divisions...</p>
                ) : lists.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground py-4">No lists loaded. Import a CSV to start.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {lists.map(item => (
                      <div 
                        key={item.list_name} 
                        className={`flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl border text-[11px] font-bold tracking-tight select-none cursor-pointer transition-all duration-200 ${
                          selectedList === item.list_name
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted text-muted-foreground hover:text-foreground border-border/40 hover:bg-muted/70'
                        }`}
                        onClick={() => setSelectedList(item.list_name)}
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>{item.list_name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${
                          selectedList === item.list_name 
                            ? 'bg-primary-foreground text-primary font-black' 
                            : 'bg-primary/10 text-primary border border-primary/20'
                        }`}>
                          {item.count}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteList(item.list_name);
                          }}
                          className={`h-5 w-5 rounded-md p-0 ${
                            selectedList === item.list_name
                              ? 'hover:bg-primary-foreground/20 text-primary-foreground/90 hover:text-primary-foreground'
                              : 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
                          }`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contacts Data Explorer */}
            {selectedList && (
              <Card className="glass-card border-border/10 shadow-lg overflow-hidden">
                
                {/* Explorer Header */}
                <div className="px-4 py-3 bg-muted/40 border-b border-border/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ListFilter className="h-4.5 w-4.5 text-primary" />
                    <span className="text-xs font-black text-foreground">Explorer: {selectedList}</span>
                  </div>
                  
                  {/* Search Field */}
                  <div className="relative w-full sm:w-60">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search emails..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-background text-[11px] rounded-lg border border-input pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <CardContent className="p-0 max-h-[300px] overflow-y-auto divide-y divide-border/5 scrollbar-thin">
                  {loadingContacts ? (
                    <p className="text-xs text-center text-muted-foreground py-12">Loading email lists...</p>
                  ) : filteredContacts.length === 0 ? (
                    <p className="text-xs text-center text-muted-foreground py-12">No contacts matched search or list is empty.</p>
                  ) : (
                    filteredContacts.map((c, index) => (
                      <div key={c.id} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-muted/5 font-medium transition-colors">
                        <div
                          onClick={() => handleOpenHistory(c)}
                          className="flex items-center gap-2.5 truncate cursor-pointer flex-1 group"
                        >
                          <span className="text-[10px] text-muted-foreground font-mono w-6 text-right shrink-0">{index + 1}</span>
                          <span className="text-foreground truncate group-hover:text-primary transition-colors">{c.email}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            View History
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenHistory(c)}
                            title="View sent email history & replies"
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteSingle(c.id, c.email)}
                            title="Delete contact"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
          </div>

        </div>
      </div>

      {/* Contact History & Thread Dialog */}
      {historyContact && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex justify-center z-50 overflow-y-auto p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="my-auto bg-card text-card-foreground border border-border shadow-2xl rounded-2xl p-6 max-w-2xl w-full animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-bold text-foreground">Email Activity &amp; Reply History</h3>
                  <p className="text-xs font-mono text-muted-foreground">{historyContact.email}</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setHistoryContact(null)} className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {loadingHistory ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Loading history records for {historyContact.email}...
              </div>
            ) : !historyData ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No activity history found.
              </div>
            ) : (
              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
                
                {/* Sent Emails Queue */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    Sent &amp; Scheduled Emails ({historyData.sends.length})
                  </h4>
                  {historyData.sends.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic bg-muted/20 p-3 rounded-xl border border-border/40">
                      No emails queued or sent to this contact yet.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {historyData.sends.map(s => (
                        <div key={s.id} className="border border-border/60 bg-muted/10 rounded-xl p-3.5 space-y-2 text-xs">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="font-bold text-foreground">Campaign: {s.campaign_name || `#${s.campaign_id}`}</span>
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                              s.status === 'sent'
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}>
                              {s.status}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Subject</span>
                            <p className="font-bold text-foreground">{s.final_subject || 'No Subject'}</p>
                          </div>
                          {s.final_body && (
                            <div>
                              <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Body Content</span>
                              <div
                                className="bg-background p-2.5 rounded-lg border border-border text-[11px] leading-relaxed max-h-32 overflow-y-auto text-foreground font-mono"
                                dangerouslySetInnerHTML={{ __html: s.final_body }}
                              />
                            </div>
                          )}
                          <div className="text-[9px] text-muted-foreground/60 pt-1 flex justify-between">
                            <span>Scheduled: {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : 'N/A'}</span>
                            {s.sent_at && <span>Sent: {new Date(s.sent_at).toLocaleString()}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prospect Replies */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                    Prospect Replies ({historyData.replies.length})
                  </h4>
                  {historyData.replies.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic bg-muted/20 p-3 rounded-xl border border-border/40">
                      No prospect replies received from this email address yet.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {historyData.replies.map(r => (
                        <div key={r.id} className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-3.5 space-y-2 text-xs">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-emerald-600">From: {r.sender_email}</span>
                            <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                          </div>
                          <p className="font-bold text-foreground">{r.subject}</p>
                          <p className="bg-background p-2.5 rounded-lg border border-border text-foreground leading-relaxed whitespace-pre-wrap">
                            {r.body_text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-border">
              <Button onClick={() => setHistoryContact(null)} className="text-xs font-semibold">
                Close History
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
