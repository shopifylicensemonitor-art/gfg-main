import { useMemo, memo, CSSProperties, useState, useEffect, useCallback } from 'react';
import { Send, RefreshCw, Mail, Download, ArrowUpAZ, ArrowDownZA, Globe, Building2, List, Layers, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EmailEntry } from '@/hooks/useEmailList';
import { List as VList } from 'react-window';
import { toast } from '@/hooks/use-toast';
import { PUBLIC_PROVIDERS } from '@/lib/publicProviders';
import { buildMailtoLink } from '@/lib/randomizeMailto';

export type FilterType = 'all' | 'sent' | 'pending';
export type DomainFilterType = 'all' | 'public' | 'personal';
export type SortType = 'default' | 'az' | 'za';

interface GeneratedEmailsProps {
  emails: EmailEntry[];
  subject: string;
  body: string;
  onSendClick: (email: string) => void;
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  searchQuery: string;
  userName: string;
  sentStatus: Record<string, boolean>;
  cc: string;
  bcc: string;
  myInboxTo: string;
  ccRoutingMode: 'reroute' | 'normal';
  enableRandomization: boolean;
  onSendBatchClick: (emails: string[]) => void;
  bccBatchSize: number;
  bccBatchOpenCount: number;
  dailyCount: number;
  goalInput: string;
}

export function resolveProspectUrl(entry: EmailEntry): string {
  const fields = entry.fields || {};
  let rawUrl = fields.store_url || fields.domain_url || fields.website || fields.domain || fields.store_name || '';

  if (rawUrl && !rawUrl.includes('.') && !rawUrl.startsWith('http')) {
    rawUrl = '';
  }

  if (!rawUrl) {
    const firstEmail = entry.email.split(',')[0].trim();
    const domain = firstEmail.split('@')[1]?.toLowerCase();
    if (domain && !PUBLIC_PROVIDERS.has(domain)) {
      rawUrl = domain;
    }
  }

  if (!rawUrl) return '';

  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

// Row component for react-window v2.2.5
interface RowProps {
  entries: EmailEntry[];
  subject: string;
  body: string;
  onSendClick: (email: string) => void;
  userName: string;
  sentStatus: Record<string, boolean>;
  searchQuery: string;
  cc: string;
  bcc: string;
  myInboxTo: string;
  ccRoutingMode: 'reroute' | 'normal';
  enableRandomization: boolean;
  isOverLimit: boolean;
  actionMode?: 'email' | 'url';
}

// Helper to highlight search matches in email text
function HighlightedEmail({ email, query }: { email: string; query: string }) {
  if (!query.trim()) return <>{email}</>;
  const lowerEmail = email.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerEmail.indexOf(lowerQuery);
  if (idx === -1) return <>{email}</>;
  return (
    <>
      {email.slice(0, idx)}
      <mark className="bg-primary/25 text-inherit rounded-sm px-[1px]">
        {email.slice(idx, idx + query.length)}
      </mark>
      {email.slice(idx + query.length)}
    </>
  );
}

const Row = memo(
  ({ index, style, ariaAttributes, ...props }: { index: number; style: CSSProperties; ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" } } & RowProps) => {
    const { entries, subject, body, onSendClick, userName, sentStatus, searchQuery, cc, bcc, myInboxTo, ccRoutingMode, enableRandomization, isOverLimit, actionMode = 'email' } = props;
    const entry = entries[index];
    if (!entry) return <></>;

    const activeListName = entry.listName || 'default';
    const isSent = !!sentStatus[`${activeListName}:${entry.email.toLowerCase()}`];
    const isValid = entry.isValid;
    const targetUrl = resolveProspectUrl(entry);
    const hasUrl = !!targetUrl;

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (actionMode === 'url') {
        if (!hasUrl) {
          toast({
            title: "No Website URL",
            description: `No website domain found for ${entry.email}`,
            variant: "destructive"
          });
          return;
        }
        window.open(targetUrl, '_blank');
        toast({
          title: "Opening Website",
          description: `Opened ${targetUrl} in new browser tab.`
        });
        return;
      }

      if (!isValid || isSent) return;
      if (isOverLimit) {
        toast({
          title: "Daily Limit Reached",
          description: "You have reached your daily sending target limit.",
          variant: "destructive"
        });
        return;
      }
      window.location.href = mailtoLink;
      onSendClick(entry.email);
    };

    const firstEmail = entry.email.split(',')[0].trim();
    const [localPart, domainPart] = firstEmail.split('@');
    const pSname = domainPart ? domainPart.split('.')[0] : '';
    const displayName = entry.name || localPart;

    let processedSubject = subject
      .replace(/{name}/g, displayName)
      .replace(/{store}/g, domainPart || '')
      .replace(/{sname}/g, pSname)
      .replace(/{brand}/g, userName);

    let processedBody = body
      .replace(/{name}/g, displayName)
      .replace(/{store}/g, domainPart || '')
      .replace(/{sname}/g, pSname)
      .replace(/{brand}/g, userName);

    // Double curly brace {{variable}} replacements with built-in fallbacks
    const resolveVar = (key: string): string => {
      const normKey = key.toLowerCase();
      // Built-in fallbacks (mirror scheduler.js)
      if (normKey === 'email') return entry.email;
      if (normKey === 'name' || normKey === 'first_name') return displayName;
      if (normKey === 'store' || normKey === 'store_name') return entry.fields?.store_name || domainPart || '';
      if (normKey === 'sname') return pSname;
      if (normKey === 'brand') return userName;
      if (normKey === 'niche') return entry.fields?.niche || '';
      if (normKey === 'pain_point') return entry.fields?.pain_point || '';
      // Custom fields from CSV
      if (entry.fields?.[key] !== undefined) return entry.fields[key];
      if (entry.fields?.[normKey] !== undefined) return entry.fields[normKey];
      return '';
    };
    processedSubject = processedSubject.replace(/\{\{(\w+)\}\}/g, (_, key) => resolveVar(key));
    processedBody = processedBody.replace(/\{\{(\w+)\}\}/g, (_, key) => resolveVar(key));

    const mailtoLink = isValid
      ? buildMailtoLink({
          recipient: entry.email,
          subject: processedSubject,
          body: processedBody,
          cc,
          bcc,
          myInboxTo,
          ccRoutingMode,
          enableRandom: enableRandomization,
        })
      : '#';

    const textStyles = !isValid
      ? 'text-destructive opacity-80'
      : isSent
        ? 'text-accent font-semibold'
        : 'text-foreground hover:text-primary transition-colors';

    const isPublic = domainPart ? PUBLIC_PROVIDERS.has(domainPart.toLowerCase()) : false;

    return (
      <div style={style} {...ariaAttributes} className="px-2 py-1 box-border">
        <div
          className={`group flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent transition-all duration-300 h-full animate-row-entrance cursor-pointer hover:bg-muted/15 hover:border-primary/15 hover:shadow-md hover:translate-x-[2px] ${
            isSent ? 'bg-primary/[0.01]' : ''
          }`}
          onClick={handleClick}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="text-[10px] font-mono text-muted-foreground/60 w-6 flex-shrink-0">
              {entry.sequenceId.toString().padStart(2, '0')}
            </span>
            <span className={`font-mono text-[12px] truncate ${textStyles}`}>
              {entry.name ? (
                <span className="flex items-center gap-1.5">
                  <span className="font-bold text-foreground truncate max-w-[120px]">{entry.name}</span>
                  <span className="text-muted-foreground/50 text-[10px]">&lt;<HighlightedEmail email={entry.email} query={searchQuery} />&gt;</span>
                </span>
              ) : (
                <HighlightedEmail email={entry.email} query={searchQuery} />
              )}
            </span>
            {entry.fields && (
              <span className="hidden sm:inline-flex items-center gap-1.5 ml-3 text-[9px] font-mono text-muted-foreground/60 border border-border/10 px-2 py-0.5 rounded-md bg-muted/30">
                {entry.fields.first_name && <span className="font-semibold text-foreground">{entry.fields.first_name}</span>}
                {entry.fields.store_name && <span className="text-primary/75">🏢 {entry.fields.store_name}</span>}
                {entry.fields.niche && <span className="italic text-emerald-500/80">🏷️ {entry.fields.niche}</span>}
              </span>
            )}
            {!isValid && (
              <Badge variant="outline" className="text-[7px] h-4 px-1.5 border-destructive/10 bg-destructive/[0.03] text-destructive font-semibold">
                Invalid
              </Badge>
            )}
            {isValid && (
              <span title={isPublic ? 'Public provider' : 'Personal/Business domain'} className="shrink-0">
                {isPublic ? (
                  <Globe className="h-3 w-3 text-blue-400/50" />
                ) : (
                  <Building2 className="h-3 w-3 text-emerald-400/50" />
                )}
              </span>
            )}
          </div>

          {actionMode === 'url' ? (
            <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 transform translate-x-0 sm:translate-x-2 sm:group-hover:translate-x-0">
              {hasUrl ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-[9px] font-bold text-emerald-400 border border-emerald-500/20 transition-all hover:bg-emerald-500 hover:text-white hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-105 active:scale-95">
                  Visit Site
                  <Globe className="h-2.5 w-2.5" />
                </span>
              ) : (
                <Badge variant="outline" className="text-[8px] h-5 px-1.5 text-muted-foreground/50 border-border/40">
                  No URL
                </Badge>
              )}
            </div>
          ) : isValid ? (
            <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 transform translate-x-0 sm:translate-x-2 sm:group-hover:translate-x-0">
              {isSent ? (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] h-6.5 px-2 font-bold uppercase tracking-wider animate-bounce-spring flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Sent
                </Badge>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-[9px] font-bold text-primary border border-primary/10 transition-all duration-200 hover:bg-primary hover:text-primary-foreground hover:shadow-lg hover:shadow-primary/30 hover:scale-105 active:scale-95">
                  Open Draft
                  <Send className="h-2.5 w-2.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
);

export function GeneratedEmails({
  emails,
  subject,
  body,
  onSendClick,
  filter,
  onFilterChange,
  searchQuery,
  userName,
  sentStatus,
  cc,
  bcc,
  myInboxTo,
  ccRoutingMode,
  enableRandomization,
  onSendBatchClick,
  bccBatchSize,
  bccBatchOpenCount,
  dailyCount,
  goalInput,
}: GeneratedEmailsProps) {
  const [actionMode, setActionMode] = useState<'email' | 'url'>('email');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isOpeningBccBatches, setIsOpeningBccBatches] = useState(false);
  const [bccBatchQueue, setBccBatchQueue] = useState<EmailEntry[][]>([]);
  const [bccBatchTotal, setBccBatchTotal] = useState(0);
  const [isOpeningBatch, setIsOpeningBatch] = useState(false);
  const [batchQueue, setBatchQueue] = useState<EmailEntry[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [domainFilter, setDomainFilter] = useState<DomainFilterType>('all');
  const [sort, setSort] = useState<SortType>('default');

  const goal = parseInt(goalInput, 10);
  const validGoal = !isNaN(goal) && goal > 0;
  const isOverLimit = validGoal && dailyCount >= goal;

  const triggerEmail = useCallback((entry: EmailEntry) => {
    if (isOverLimit) {
      toast({
        title: "Daily Limit Reached",
        description: "Stopping auto-open sequence.",
        variant: "destructive"
      });
      setIsOpeningBatch(false);
      setBatchQueue([]);
      return;
    }
    const firstEmail = entry.email.split(',')[0].trim();
    const [localPart, domainPart] = firstEmail.split('@');
    const pSname = domainPart ? domainPart.split('.')[0] : '';
    const displayName = entry.name || localPart;
    let processedSubject = subject
      .replace(/{name}/g, displayName)
      .replace(/{store}/g, domainPart || '')
      .replace(/{sname}/g, pSname)
      .replace(/{brand}/g, userName);
    let processedBody = body
      .replace(/{name}/g, displayName)
      .replace(/{store}/g, domainPart || '')
      .replace(/{sname}/g, pSname)
      .replace(/{brand}/g, userName);

    // Double curly brace {{variable}} replacements with built-in fallbacks
    const resolveVar = (key: string): string => {
      const normKey = key.toLowerCase();
      if (normKey === 'email') return entry.email;
      if (normKey === 'name' || normKey === 'first_name') return displayName;
      if (normKey === 'store' || normKey === 'store_name') return entry.fields?.store_name || domainPart || '';
      if (normKey === 'sname') return pSname;
      if (normKey === 'brand') return userName;
      if (normKey === 'niche') return entry.fields?.niche || '';
      if (normKey === 'pain_point') return entry.fields?.pain_point || '';
      if (entry.fields?.[key] !== undefined) return entry.fields[key];
      if (entry.fields?.[normKey] !== undefined) return entry.fields[normKey];
      return '';
    };
    processedSubject = processedSubject.replace(/\{\{(\w+)\}\}/g, (_, key) => resolveVar(key));
    processedBody = processedBody.replace(/\{\{(\w+)\}\}/g, (_, key) => resolveVar(key));

    const link = buildMailtoLink({
      recipient: entry.email,
      subject: processedSubject,
      body: processedBody,
      cc,
      bcc,
      myInboxTo,
      ccRoutingMode,
      enableRandom: enableRandomization,
    });

    window.open(link, '_blank');
    onSendClick(entry.email);
  }, [subject, body, userName, onSendClick, cc, bcc, myInboxTo, ccRoutingMode, enableRandomization, isOverLimit]);

  useEffect(() => {
    if (batchQueue.length > 0 && isOpeningBatch) {
      if (isOverLimit) {
        toast({
          title: "Daily Limit Reached",
          description: "Auto-open sequence stopped.",
          variant: "destructive"
        });
        setIsOpeningBatch(false);
        setBatchQueue([]);
        return;
      }
      const handleFocus = () => {
        const timer = setTimeout(() => {
          setBatchQueue(prev => {
            if (prev.length === 0) {
              setIsOpeningBatch(false);
              return prev;
            }
            const [next, ...rest] = prev;
            triggerEmail(next);
            if (rest.length === 0) setIsOpeningBatch(false);
            return rest;
          });
        }, 800);
        return () => clearTimeout(timer);
      };

      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }
  }, [batchQueue.length, isOpeningBatch, triggerEmail, isOverLimit]);

  const triggerBccBatch = useCallback((batch: EmailEntry[]) => {
    if (batch.length === 0) return;
    if (isOverLimit) {
      toast({
        title: "Daily Limit Reached",
        description: "Stopping batch sequence.",
        variant: "destructive"
      });
      setIsOpeningBccBatches(false);
      setBccBatchQueue([]);
      return;
    }

    const recipient = myInboxTo ? myInboxTo.trim() : '';
    let targetBcc = batch.map(e => e.email).join(',');

    if (bcc.trim()) {
      targetBcc = `${targetBcc},${bcc.trim()}`;
    }

    let processedSubject = subject
      .replace(/{name}/g, 'Team')
      .replace(/{store}/g, 'your website')
      .replace(/{sname}/g, 'your website')
      .replace(/{brand}/g, userName);

    let processedBody = body
      .replace(/{name}/g, 'Team')
      .replace(/{store}/g, 'your website')
      .replace(/{sname}/g, 'your website')
      .replace(/{brand}/g, userName);

    // Double curly brace {{variable}} replacements fallback for BCC batches
    processedSubject = processedSubject
      .replace(/\{\{first_name\}\}/g, 'Team')
      .replace(/\{\{store_name\}\}/g, 'your website')
      .replace(/\{\{niche\}\}/g, 'niche')
      .replace(/\{\{pain_point\}\}/g, 'outreach')
      .replace(/\{\{(\w+)\}\}/g, '');

    processedBody = processedBody
      .replace(/\{\{first_name\}\}/g, 'Team')
      .replace(/\{\{store_name\}\}/g, 'your website')
      .replace(/\{\{niche\}\}/g, 'niche')
      .replace(/\{\{pain_point\}\}/g, 'outreach')
      .replace(/\{\{(\w+)\}\}/g, '');

    const link = buildMailtoLink({
      recipient,
      subject: processedSubject,
      body: processedBody,
      cc,
      bcc: targetBcc,
      myInboxTo: '',
      ccRoutingMode,
      enableRandom: enableRandomization,
    });

    window.open(link, '_blank');
    
    const emailsInBatch = batch.map(e => e.email);
    onSendBatchClick(emailsInBatch);
  }, [subject, body, userName, onSendBatchClick, cc, bcc, myInboxTo, ccRoutingMode, enableRandomization, isOverLimit]);

  useEffect(() => {
    if (bccBatchQueue.length > 0 && isOpeningBccBatches) {
      if (isOverLimit) {
        toast({
          title: "Daily Limit Reached",
          description: "Batch sequence stopped.",
          variant: "destructive"
        });
        setIsOpeningBccBatches(false);
        setBccBatchQueue([]);
        return;
      }
      const handleFocus = () => {
        const timer = setTimeout(() => {
          setBccBatchQueue(prev => {
            if (prev.length === 0) {
              setIsOpeningBccBatches(false);
              return prev;
            }
            const [next, ...rest] = prev;
            triggerBccBatch(next);
            if (rest.length === 0) setIsOpeningBccBatches(false);
            return rest;
          });
        }, 800);
        return () => clearTimeout(timer);
      };

      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }
  }, [bccBatchQueue.length, isOpeningBccBatches, triggerBccBatch, isOverLimit]);

  // Layer 1: Search Filter (only re-runs when list or query changes)
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return emails;
    const query = searchQuery.toLowerCase();
    return emails.filter(e => e.email.toLowerCase().includes(query));
  }, [emails, searchQuery]);

  const pendingValid = useMemo(() => {
    return searchFiltered.filter(e => {
      const activeListName = e.listName || 'default';
      const key = `${activeListName}:${e.email.toLowerCase()}`;
      return !sentStatus[key] && e.isValid;
    });
  }, [searchFiltered, sentStatus]);

  // Pre-computed static batches of all valid emails to prevent dynamic list-shifting
  const fixedBatches = useMemo(() => {
    const validEmails = searchFiltered.filter(e => e.isValid);
    const result: EmailEntry[][] = [];
    for (let i = 0; i < validEmails.length; i += bccBatchSize) {
      result.push(validEmails.slice(i, i + bccBatchSize));
    }
    return result;
  }, [searchFiltered, bccBatchSize]);

  // Dynamic filter for batches (All / Sent / Pending)
  const filteredBatches = useMemo(() => {
    if (filter === 'all') return fixedBatches;
    return fixedBatches.filter(batch => {
      const isBatchSent = batch.every(e => {
        const activeListName = e.listName || 'default';
        const key = `${activeListName}:${e.email.toLowerCase()}`;
        return sentStatus[key];
      });
      if (filter === 'sent') return isBatchSent;
      if (filter === 'pending') return !isBatchSent;
      return true;
    });
  }, [fixedBatches, filter, sentStatus]);

  // List of active pending batches for the "Open Batches" sequential trigger
  const pendingBatches = useMemo(() => {
    return fixedBatches.filter(batch => !batch.every(e => {
      const activeListName = e.listName || 'default';
      const key = `${activeListName}:${e.email.toLowerCase()}`;
      return sentStatus[key];
    }));
  }, [fixedBatches, sentStatus]);

  // Layer 2: Status Filter (re-runs when status changes, but only if filter is not 'all')
  const statusFiltered = useMemo(() => {
    if (filter === 'all') return searchFiltered;
    if (filter === 'pending') {
      return searchFiltered.filter(e => {
        const activeListName = e.listName || 'default';
        const key = `${activeListName}:${e.email.toLowerCase()}`;
        return !sentStatus[key] && e.isValid;
      });
    }
    if (filter === 'sent') {
      return searchFiltered.filter(e => {
        const activeListName = e.listName || 'default';
        const key = `${activeListName}:${e.email.toLowerCase()}`;
        return !!sentStatus[key] && e.isValid;
      });
    }
    return searchFiltered;
  }, [searchFiltered, filter, sentStatus]);

  // Layer 3: Domain Filter (public vs personal/business)
  const domainFiltered = useMemo(() => {
    if (domainFilter === 'all') return statusFiltered;
    return statusFiltered.filter(e => {
      const domain = e.email.split('@')[1]?.toLowerCase();
      if (!domain) return false;
      const isPublic = PUBLIC_PROVIDERS.has(domain);
      return domainFilter === 'public' ? isPublic : !isPublic;
    });
  }, [statusFiltered, domainFilter]);

  // Layer 4: Sort
  const filteredEmails = useMemo(() => {
    if (sort === 'default') return domainFiltered;
    const sorted = [...domainFiltered].sort((a, b) =>
      a.email.localeCompare(b.email, undefined, { sensitivity: 'base' })
    );
    return sort === 'za' ? sorted.reverse() : sorted;
  }, [domainFiltered, sort]);

  // Domain counts for badges
  const domainCounts = useMemo(() => {
    let pub = 0, priv = 0;
    for (const e of statusFiltered) {
      const domain = e.email.split('@')[1]?.toLowerCase();
      if (domain && PUBLIC_PROVIDERS.has(domain)) pub++; else priv++;
    }
    return { public: pub, personal: priv };
  }, [statusFiltered]);

  const rowProps = useMemo<RowProps>(() => ({
    entries: filteredEmails,
    subject,
    body,
    onSendClick,
    userName,
    sentStatus,
    searchQuery,
    cc,
    bcc,
    myInboxTo,
    ccRoutingMode,
    enableRandomization,
    isOverLimit,
    actionMode,
  }), [filteredEmails, subject, body, onSendClick, userName, sentStatus, searchQuery, cc, bcc, myInboxTo, ccRoutingMode, enableRandomization, isOverLimit, actionMode]);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'sent', label: 'Sent' },
    { key: 'pending', label: 'Pending' },
  ];

  // Cycle sort: default → az → za → default
  const cycleSort = useCallback(() => {
    setSort(prev => prev === 'default' ? 'az' : prev === 'az' ? 'za' : 'default');
  }, []);

  // Export current filtered list as CSV (includes all custom fields)
  const handleExport = useCallback(() => {
    // Collect all unique custom field keys across all entries
    const customKeys = new Set<string>();
    for (const e of filteredEmails) {
      if (e.fields) {
        Object.keys(e.fields).forEach(k => customKeys.add(k));
      }
    }
    const customKeysArr = Array.from(customKeys);

    // Build header row
    const headerCols = ['email', 'status', 'domain_type', ...customKeysArr];
    const headerRow = headerCols.join(',');

    // Build data rows
    const dataRows = filteredEmails.map(e => {
      const domain = e.email.split('@')[1]?.toLowerCase();
      const type = domain && PUBLIC_PROVIDERS.has(domain) ? 'public' : 'personal';
      const activeListName = e.listName || 'default';
      const status = sentStatus[`${activeListName}:${e.email.toLowerCase()}`] ? 'sent' : 'pending';

      const baseCols = [e.email, status, type];
      const customCols = customKeysArr.map(k => {
        const val = e.fields?.[k] || '';
        // Escape values containing commas or quotes
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });

      return [...baseCols, ...customCols].join(',');
    }).join('\n');

    const csvContent = headerRow + '\n' + dataRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `peakx-emails-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${filteredEmails.length} ${filter} emails exported as CSV.` });
  }, [filteredEmails, sentStatus, filter]);

  // Batch progress
  const batchSent = batchTotal - batchQueue.length;

  // Empty state when no emails at all
  if (emails.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-border/60 bg-card/50 p-8 flex flex-col items-center text-center">
        <div className="p-4 rounded-full bg-primary/5">
          <Mail className="h-10 w-10 text-primary/30" />
        </div>
        <h3 className="text-base font-semibold text-muted-foreground">No Emails Yet</h3>
        <p className="text-xs text-muted-foreground/70 max-w-sm">
          Paste email addresses above or upload a file, then click <strong>Generate Emails</strong> to start your outreach.
        </p>
        <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground/50">
          <span>📋 Paste a list</span>
          <span>📁 Upload .csv / .txt</span>
          <span>⌨️ Ctrl+Enter</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm h-[600px] flex flex-col relative overflow-hidden">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Generated Emails</h2>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {isBatchMode 
                ? `${filteredBatches.length} ${filteredBatches.length === 1 ? 'Batch' : 'Batches'}` 
                : `${filteredEmails.length} ${filteredEmails.length === 1 ? 'Email' : 'Emails'}`}
            </Badge>

            {/* Mode Switcher: Send Emails vs Open Store URLs */}
            <div className="flex bg-muted/40 p-0.5 rounded-lg border border-border/20 ml-1">
              <Button
                variant={actionMode === 'email' ? 'secondary' : 'ghost'}
                size="sm"
                className={`h-6 text-[10px] px-2 rounded-md font-bold flex items-center gap-1 ${
                  actionMode === 'email' ? 'text-primary bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActionMode('email')}
                title="Send outreach emails via mailto: links"
              >
                <Mail className="h-3 w-3 text-primary" />
                <span>Send Emails</span>
              </Button>
              <Button
                variant={actionMode === 'url' ? 'secondary' : 'ghost'}
                size="sm"
                className={`h-6 text-[10px] px-2 rounded-md font-bold flex items-center gap-1 ${
                  actionMode === 'url' ? 'text-emerald-400 bg-emerald-500/10 shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActionMode('url')}
                title="Open prospect store/website URLs in new browser tabs"
              >
                <Globe className="h-3 w-3 text-emerald-400" />
                <span>Open Store URLs</span>
              </Button>
            </div>
            {isOpeningBatch && batchTotal > 0 && (
              <Badge variant="outline" className="text-[10px] animate-pulse border-primary/30 text-primary">
                Sending {batchSent}/{batchTotal}...
              </Badge>
            )}
            {isOpeningBccBatches && bccBatchTotal > 0 && (
              <Badge variant="outline" className="text-[10px] animate-pulse border-primary/30 text-primary">
                Opening {bccBatchTotal - bccBatchQueue.length}/{bccBatchTotal}...
              </Badge>
            )}
          </div>
          
          {/* Sort toggle on Mobile top right for perfect compactness */}
          {!isBatchMode && (
            <Button
              variant={sort !== 'default' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 text-[10px] px-2 sm:hidden border border-border/40"
              onClick={cycleSort}
              title={sort === 'default' ? 'Sort A→Z' : sort === 'az' ? 'Sort Z→A' : 'Default order'}
            >
              {sort === 'za' ? (
                <ArrowDownZA className="h-3.5 w-3.5" />
              ) : sort === 'az' ? (
                <ArrowUpAZ className="h-3.5 w-3.5" />
              ) : (
                <ArrowUpAZ className="h-3.5 w-3.5 opacity-50" />
              )}
            </Button>
          )}
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-col sm:flex-row gap-2 items-center w-full sm:w-auto justify-start sm:justify-end">
          
          {/* Action Row: Mode & Export (Stretches on mobile, standard on desktop) */}
          <div className="flex w-full sm:w-auto gap-2">
            {/* BCC Batching Mode Toggle */}
            <Button
              variant={isBatchMode ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 sm:flex-none h-8 sm:h-7 text-[10px] sm:text-xs px-2.5 border border-border/40 sm:border-transparent"
              onClick={() => setIsBatchMode(prev => !prev)}
              title="Toggle between individual and BCC batch sending modes"
            >
              <Layers className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
              <span className="text-[10px] sm:text-xs font-semibold">{isBatchMode ? 'Individual Mode' : 'BCC Batches'}</span>
            </Button>

            {/* Sequential Auto-Open Toggle in Individual Mode */}
            {!isBatchMode && pendingValid.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none h-8 sm:h-7 text-[10px] sm:text-xs px-2.5 border border-primary/20 hover:bg-primary/5 text-primary"
                onClick={() => {
                  if (isOpeningBatch) {
                    setIsOpeningBatch(false);
                    setBatchQueue([]);
                  } else {
                    const toSend = searchFiltered.filter(e => !sentStatus[e.email] && e.isValid);
                    setBatchQueue(toSend);
                    setBatchTotal(toSend.length);
                    setIsOpeningBatch(true);
                    if (toSend.length > 0) {
                      triggerEmail(toSend[0]);
                      setBatchQueue(toSend.slice(1));
                    }
                  }
                }}
              >
                <Send className="h-3 w-3 mr-1 text-primary shrink-0" />
                <span className="text-[10px] sm:text-xs font-semibold">
                  {isOpeningBatch ? 'Stop Auto-Open' : `Open Pending (${pendingValid.length})`}
                </span>
              </Button>
            )}

            {/* Sequential Auto-Open Toggle in Batch Mode */}
            {isBatchMode && pendingBatches.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none h-8 sm:h-7 text-[10px] sm:text-xs px-2.5 border border-primary/20 hover:bg-primary/5 text-primary"
                onClick={() => {
                  if (isOpeningBccBatches) {
                    setIsOpeningBccBatches(false);
                    setBccBatchQueue([]);
                  } else {
                    const limitToOpen = pendingBatches.slice(0, bccBatchOpenCount);
                    setBccBatchQueue(limitToOpen);
                    setBccBatchTotal(limitToOpen.length);
                    setIsOpeningBccBatches(true);
                    if (limitToOpen.length > 0) {
                      triggerBccBatch(limitToOpen[0]);
                      setBccBatchQueue(limitToOpen.slice(1));
                    }
                  }
                }}
              >
                <Send className="h-3 w-3 mr-1 text-primary shrink-0" />
                <span className="text-[10px] sm:text-xs font-semibold">
                  {isOpeningBccBatches ? 'Stop Auto-Open' : `Open Batches (${pendingBatches.length})`}
                </span>
              </Button>
            )}

            {/* Export */}
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 sm:flex-none h-8 sm:h-7 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground px-2.5 border border-border/40 sm:border-transparent"
              onClick={handleExport}
              title="Export filtered list as CSV"
            >
              <Download className="h-3.5 w-3.5 mr-1 shrink-0" />
              <span className="text-[10px] sm:text-xs font-semibold">Export CSV</span>
            </Button>

            {/* Sort toggle (Desktop only, rendered inline) */}
            {!isBatchMode && (
              <Button
                variant={sort !== 'default' ? 'secondary' : 'ghost'}
                size="sm"
                className="hidden sm:flex h-7 px-2"
                onClick={cycleSort}
                title={sort === 'default' ? 'Sort A→Z' : sort === 'az' ? 'Sort Z→A' : 'Default order'}
              >
                {sort === 'za' ? (
                  <ArrowDownZA className="h-3.5 w-3.5" />
                ) : sort === 'az' ? (
                  <ArrowUpAZ className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUpAZ className="h-3.5 w-3.5 opacity-50" />
                )}
              </Button>
            )}
          </div>

          {/* Segmented Filter Control Bar (Stretches on mobile, standard on desktop) */}
          <div className="flex w-full sm:w-auto bg-muted/40 sm:bg-transparent p-1 sm:p-0 rounded-xl sm:rounded-none gap-1 border border-border/20 sm:border-none">
            {filters.map((f) => (
              <Button
                key={f.key}
                variant={filter === f.key ? 'secondary' : 'ghost'}
                size="sm"
                className={`flex-1 sm:flex-none h-7 sm:h-7 text-[10px] sm:text-xs px-2.5 sm:px-3 cursor-pointer rounded-lg sm:rounded-none ${
                  filter === f.key 
                    ? 'font-semibold text-primary bg-primary/10 sm:bg-secondary' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => onFilterChange(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Domain filter row */}
      {!isBatchMode && (
        <div className="flex flex-wrap items-center gap-1.5 shrink-0 py-1">
          <span className="text-[10px] text-muted-foreground/70 mr-1">Domain:</span>
        <Button
          variant={domainFilter === 'all' ? 'secondary' : 'ghost'}
          size="sm"
          className={`h-5 text-[9px] sm:text-[10px] px-2 gap-1 ${domainFilter === 'all' ? 'font-medium' : 'text-muted-foreground'}`}
          onClick={() => setDomainFilter('all')}
        >
          <List className="h-2.5 w-2.5" />
          All
        </Button>
        <Button
          variant={domainFilter === 'public' ? 'secondary' : 'ghost'}
          size="sm"
          className={`h-5 text-[9px] sm:text-[10px] px-2 gap-1 ${domainFilter === 'public' ? 'font-medium' : 'text-muted-foreground'}`}
          onClick={() => setDomainFilter('public')}
        >
          <Globe className="h-2.5 w-2.5 text-blue-400" />
          Public
          <Badge variant="outline" className="text-[7px] h-3 px-1 ml-0.5 font-normal">{domainCounts.public}</Badge>
        </Button>
        <Button
          variant={domainFilter === 'personal' ? 'secondary' : 'ghost'}
          size="sm"
          className={`h-5 text-[9px] sm:text-[10px] px-2 gap-1 ${domainFilter === 'personal' ? 'font-medium' : 'text-muted-foreground'}`}
          onClick={() => setDomainFilter('personal')}
        >
          <Building2 className="h-2.5 w-2.5 text-emerald-400" />
          Personal
          <Badge variant="outline" className="text-[7px] h-3 px-1 ml-0.5 font-normal">{domainCounts.personal}</Badge>
        </Button>
        </div>
      )}

      {/* List/Grid Container */}
      {isBatchMode ? (
        <div className="flex-1 overflow-y-auto min-h-0 w-full pr-1 space-y-2.5 scrollbar-thin">
          {/* Info panel */}
          <div className="bg-primary/[0.03] rounded-lg border border-primary/10 p-3 pt-2.5 pb-2.5 space-y-1 text-xs text-muted-foreground leading-normal">
            <p className="font-semibold text-primary flex items-center gap-1.5">
              <span>💡 BCC Batch Sending Mode</span>
              <Badge variant="secondary" className="text-[8px] h-3.5 px-1 font-normal bg-primary/10 text-primary border-none">
                {bccBatchSize} per batch
              </Badge>
            </p>
            <p>
              Bundle multiple recipients in BCC to send in bulk. If a <strong>"To (My Inbox)"</strong> address is specified in settings, it will be used as the primary recipient with all targets in BCC. Otherwise, the primary recipient (<strong>To</strong>) is left blank and all targets are routed to the <strong>BCC</strong> field.
            </p>
            <p className="text-[10px] text-amber-500/90 font-medium">
              ⚠️ Personalization variables ({`{name}`}, {`{store}`}) use generic fallbacks like "Team" in BCC.
            </p>
          </div>

          {filteredBatches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
              {filteredBatches.map((batch) => {
                const originalIndex = fixedBatches.indexOf(batch);
                const batchNum = originalIndex !== -1 ? originalIndex + 1 : 1;
                const hasSent = batch.every(e => sentStatus[e.email]);
                return (
                  <div
                    key={batchNum}
                    className={`border border-border/85 rounded-lg p-3.5 space-y-2.5 transition-all ${
                      hasSent 
                        ? 'bg-muted/10 opacity-70 border-muted' 
                        : 'bg-card hover:border-primary/30 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground">
                        Batch {batchNum}
                      </span>
                      <Badge variant={hasSent ? 'secondary' : 'outline'} className="text-[9px] h-4.5 px-1 border-primary/20 text-primary bg-primary/5">
                        {batch.length} Emails
                      </Badge>
                    </div>
                    <div className="max-h-24 overflow-y-auto text-[10px] text-muted-foreground/95 bg-muted/20 p-2 rounded border border-border/40 font-mono space-y-0.5 scrollbar-none">
                      {batch.map((e, idx) => (
                        <div key={idx} className="truncate">
                          {idx + 1}. {e.email}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="flex-1 text-xs h-7.5 cursor-pointer"
                        variant={hasSent ? 'ghost' : 'outline'}
                        disabled={hasSent}
                        onClick={() => triggerBccBatch(batch)}
                      >
                        <Send className="h-3 w-3 mr-1.5" />
                        {hasSent ? 'Batch Sent' : `Send Batch ${batchNum}`}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7.5 w-7.5 p-0 shrink-0 border border-border/40 hover:bg-muted cursor-pointer"
                        title="Copy BCC recipient list to clipboard"
                        onClick={() => {
                          const emailsStr = batch.map(e => e.email).join(',');
                          navigator.clipboard.writeText(emailsStr);
                          toast({ title: 'Copied to clipboard', description: `Batch ${batchNum} recipients copied.` });
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Mail className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-xs">No batches match your active filter</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 relative min-h-0 w-full overflow-hidden">
          {filteredEmails.length > 0 ? (
            <VList
              rowCount={filteredEmails.length}
              rowHeight={48}
              defaultHeight={400}
              rowComponent={Row as React.ComponentType}
              rowProps={rowProps}
              className="scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/30 h-full"
              overscanCount={5}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Mail className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-xs">No recipients match your filter</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
