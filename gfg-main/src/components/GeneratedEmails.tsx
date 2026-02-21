import { useMemo, memo, CSSProperties, useState, useEffect, useCallback } from 'react';
import { Send, RefreshCw, Mail, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EmailEntry } from '@/hooks/useEmailList';
import { List } from 'react-window';
import { toast } from '@/hooks/use-toast';

export type FilterType = 'all' | 'sent' | 'pending';

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
    const { entries, subject, body, onSendClick, userName, sentStatus, searchQuery } = props;
    const entry = entries[index];
    if (!entry) return <></>;

    const isSent = !!sentStatus[entry.email];
    const isValid = entry.isValid;

    const handleClick = (e: React.MouseEvent) => {
      if (!isValid || isSent) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      window.location.href = mailtoLink;
      onSendClick(entry.email);
    };

    const [localPart, domainPart] = entry.email.split('@');
    const pSname = domainPart ? domainPart.split('.')[0] : '';

    const processedSubject = subject
      .replace(/{name}/g, localPart)
      .replace(/{store}/g, domainPart || '')
      .replace(/{sname}/g, pSname)
      .replace(/{brand}/g, userName);

    const processedBody = body
      .replace(/{name}/g, localPart)
      .replace(/{store}/g, domainPart || '')
      .replace(/{sname}/g, pSname)
      .replace(/{brand}/g, userName);

    const mailtoParams = new URLSearchParams();
    if (processedSubject) mailtoParams.append('subject', processedSubject);
    if (processedBody) mailtoParams.append('body', processedBody);

    const mailtoLink = isValid
      ? `mailto:${entry.email}?${mailtoParams.toString().replace(/\+/g, '%20')}`
      : '#';

    const textStyles = !isValid
      ? 'text-destructive opacity-80'
      : isSent
        ? 'text-accent font-medium'
        : 'text-foreground hover:text-primary';

    const LinkComponent = isValid && !isSent ? 'a' : 'div';

    return (
      <div style={style} {...ariaAttributes} className="px-1 box-border">
        <LinkComponent
          href={LinkComponent === 'a' ? mailtoLink : undefined}
          className={`group flex items-center justify-between px-2.5 rounded-sm border-b border-border/[0.03] h-full ${isValid && !isSent
            ? 'cursor-pointer hover:bg-muted/10'
            : 'bg-transparent'
            } ${isSent ? 'bg-accent-[0.02]' : ''}`}
          onClick={handleClick}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="text-[11px] font-mono text-muted-foreground/90 w-7 flex-shrink-0">
              {entry.sequenceId.toString().padStart(2, '0')}
            </span>
            <span className={`font-mono text-[12px] truncate ${textStyles}`}>
              <HighlightedEmail email={entry.email} query={searchQuery} />
            </span>
            {!isValid && (
              <Badge variant="outline" className="text-[7px] h-3 px-1 border-destructive/10 bg-destructive/[0.03] text-destructive font-normal">
                Invalid
              </Badge>
            )}
          </div>

          {isValid && (
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {isSent ? (
                <Badge variant="secondary" className="bg-accent-[0.03] text-accent border-none text-[7px] h-3.5 px-1 font-normal uppercase tracking-tighter">
                  SENT
                </Badge>
              ) : (
                <span className="text-[7px] text-primary font-medium flex items-center gap-1 uppercase tracking-tighter opacity-70">
                  Open
                  <Send className="h-1.5 w-1.5" />
                </span>
              )}
            </div>
          )}
        </LinkComponent>
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
}: GeneratedEmailsProps) {
  const [isOpeningBatch, setIsOpeningBatch] = useState(false);
  const [batchQueue, setBatchQueue] = useState<EmailEntry[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);

  const triggerEmail = (entry: EmailEntry) => {
    const [localPart, domainPart] = entry.email.split('@');
    const pSname = domainPart ? domainPart.split('.')[0] : '';
    const processedSubject = subject
      .replace(/{name}/g, localPart)
      .replace(/{store}/g, domainPart || '')
      .replace(/{sname}/g, pSname)
      .replace(/{brand}/g, userName);
    const processedBody = body
      .replace(/{name}/g, localPart)
      .replace(/{store}/g, domainPart || '')
      .replace(/{sname}/g, pSname)
      .replace(/{brand}/g, userName);

    const mailtoParams = new URLSearchParams();
    if (processedSubject) mailtoParams.append('subject', processedSubject);
    if (processedBody) mailtoParams.append('body', processedBody);
    const link = `mailto:${entry.email}?${mailtoParams.toString().replace(/\+/g, '%20')}`;

    window.open(link, '_blank');
    onSendClick(entry.email);
  };

  useEffect(() => {
    if (batchQueue.length > 0 && isOpeningBatch) {
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
  }, [batchQueue, isOpeningBatch, subject, body, userName]);

  // Layer 1: Search Filter (only re-runs when list or query changes)
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return emails;
    const query = searchQuery.toLowerCase();
    return emails.filter(e => e.email.toLowerCase().includes(query));
  }, [emails, searchQuery]);

  // Layer 2: Status Filter (re-runs when status changes, but only if filter is not 'all')
  const filteredEmails = useMemo(() => {
    if (filter === 'all') return searchFiltered;

    // Only perform status filtering if explicitly requested
    if (filter === 'pending') {
      return searchFiltered.filter(e => !sentStatus[e.email] && e.isValid);
    }
    if (filter === 'sent') {
      return searchFiltered.filter(e => !!sentStatus[e.email] && e.isValid);
    }
    return searchFiltered;
  }, [searchFiltered, filter, sentStatus]);

  const rowProps = useMemo<RowProps>(() => ({
    entries: filteredEmails,
    subject,
    body,
    onSendClick,
    userName,
    sentStatus,
    searchQuery,
  }), [filteredEmails, subject, body, onSendClick, userName, sentStatus, searchQuery]);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'sent', label: 'Sent' },
    { key: 'pending', label: 'Pending' },
  ];

  // Export current filtered list as CSV
  const handleExport = useCallback(() => {
    const csvContent = 'email,status\n' + filteredEmails.map(e =>
      `${e.email},${sentStatus[e.email] ? 'sent' : 'pending'}`
    ).join('\n');
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
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Generated Emails</h2>
          <Badge variant="secondary" className="text-[10px] font-normal">
            {filteredEmails.length}
          </Badge>
          {isOpeningBatch && batchTotal > 0 && (
            <Badge variant="outline" className="text-[10px] animate-pulse border-primary/30 text-primary">
              Sending {batchSent}/{batchTotal}...
            </Badge>
          )}
        </div>
        <div className="flex gap-1 items-center flex-wrap">
          {/* Export */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] sm:text-xs sm:h-7 text-muted-foreground hover:text-foreground px-2"
            onClick={handleExport}
            title="Export filtered list as CSV"
          >
            <Download className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] sm:text-xs sm:h-7 bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 px-2 sm:px-3"
            disabled={isOpeningBatch || emails.filter(e => !sentStatus[e.email]).length === 0}
            onClick={() => {
              const pending = emails.filter(e => !sentStatus[e.email] && e.isValid).slice(0, 5);
              if (pending.length === 0) return;
              setBatchTotal(pending.length);
              setIsOpeningBatch(true);
              const [first, ...rest] = pending;
              setBatchQueue(rest);
              triggerEmail(first);
            }}
          >
            <RefreshCw className={`h-3 w-3 ${isOpeningBatch ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-1.5">{isOpeningBatch ? `${batchSent}/${batchTotal}` : 'Open 5'}</span>
          </Button>
          {filters.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'secondary' : 'ghost'}
              size="sm"
              className={`h-6 sm:h-7 text-[10px] sm:text-xs px-2 sm:px-3 ${filter === f.key ? 'font-medium' : 'text-muted-foreground'}`}
              onClick={() => onFilterChange(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex-1 relative min-h-0 w-full overflow-hidden">
        {filteredEmails.length > 0 ? (
          <List
            rowCount={filteredEmails.length}
            rowHeight={36}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rowComponent={Row as any}
            rowProps={rowProps}
            className="scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/30 h-full"
            overscanCount={5}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...({ itemKey: (index: number) => filteredEmails[index]?.id || index } as any)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Mail className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-xs">No recipients match your filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
