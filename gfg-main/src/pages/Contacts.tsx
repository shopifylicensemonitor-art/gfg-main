import React, { useState, useEffect, useCallback } from 'react';
import { api, type ContactListInfo, type Contact } from '../api';
import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Users, Upload, Trash2, Plus, UserPlus, Search, ListFilter, AlertTriangle, FileSpreadsheet, Info } from 'lucide-react';

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
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="text-[10px] text-muted-foreground font-mono w-6 text-right shrink-0">{index + 1}</span>
                          <span className="text-foreground truncate">{c.email}</span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteSingle(c.id, c.email)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
          </div>

        </div>
      </div>
    </AppShell>
  );
}
