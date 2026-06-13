import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { parseEmailsText } from '@/lib/emailParser';

export interface EmailEntry {
  id: string;
  sequenceId: number;
  email: string;
  name?: string;
  isValid: boolean;
  fields?: Record<string, string>;
}

const STORAGE_KEY = 'bulk-email-sent-status';
const EMAILS_STORAGE_KEY = 'bulk-email-list';
const CUMULATIVE_SENT_KEY = 'bulk-email-cumulative-sent';

export const extractEmailsFromText = (text: string): string[] => {
  if (!text) return [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  return Array.from(new Set(matches.map(email => email.trim().toLowerCase())));
};

// ── Compact LocalStorage Serialization Helpers ─────────────────────
function serializeEmails(entries: EmailEntry[]): string {
  return entries.map(e => {
    const fieldsStr = e.fields ? JSON.stringify(e.fields) : '';
    return `${e.sequenceId}|${e.email}|${e.name || ''}|${e.isValid ? 1 : 0}|${fieldsStr}`;
  }).join('\n');
}

function deserializeEmails(stored: string): EmailEntry[] {
  if (!stored) return [];
  if (stored.startsWith('[')) {
    try {
      return JSON.parse(stored) as EmailEntry[];
    } catch {
      // Fall through to compact parsing
    }
  }
  const lines = stored.split('\n');
  const entries: EmailEntry[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split('|');
    if (parts.length >= 2) {
      const sequenceId = parseInt(parts[0], 10) || 1;
      const email = parts[1];
      const name = parts[2] || undefined;
      const isValid = parts[3] === '1';
      let fields: Record<string, string> | undefined = undefined;
      if (parts[4]) {
        try {
          fields = JSON.parse(parts[4]);
        } catch {
          // Ignore parsing issues
        }
      }
      entries.push({
        id: String(sequenceId),
        sequenceId,
        email,
        name,
        isValid,
        fields
      });
    }
  }
  return entries;
}

function serializeSentStatus(status: Record<string, boolean>): string {
  return Object.keys(status).filter(k => status[k]).join(',');
}

function deserializeSentStatus(stored: string): Record<string, boolean> {
  if (!stored) return {};
  if (stored.startsWith('{')) {
    try {
      return JSON.parse(stored);
    } catch (_e) {
      // Fall through to compact parsing
    }
  }
  const status: Record<string, boolean> = {};
  const emails = stored.split(',');
  for (const email of emails) {
    if (email.trim()) {
      status[email] = true;
    }
  }
  return status;
}

export function useEmailList() {
  const [emails, setEmails] = useState<EmailEntry[]>(() => {
    const storedEmails = localStorage.getItem(EMAILS_STORAGE_KEY);
    if (storedEmails) {
      return deserializeEmails(storedEmails);
    }
    return [];
  });

  const [nextSequenceId, setNextSequenceId] = useState(() => {
    if (emails.length > 0) {
      return Math.max(...emails.map(e => e.sequenceId || 0)) + 1;
    }
    return 1;
  });

  const [cumulativeSent, setCumulativeSent] = useState(() => {
    return parseInt(localStorage.getItem(CUMULATIVE_SENT_KEY) || '0', 10);
  });

  const [sentStatus, setSentStatus] = useState<Record<string, boolean>>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return deserializeSentStatus(stored);
    }
    return {};
  });

  // Persist cumulativeSent
  useEffect(() => {
    try {
      localStorage.setItem(CUMULATIVE_SENT_KEY, cumulativeSent.toString());
    } catch (e) {
      console.warn('Failed to persist cumulativeSent:', e);
    }
  }, [cumulativeSent]);

  // Save emails to localStorage (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (emails.length > 0) {
          localStorage.setItem(EMAILS_STORAGE_KEY, serializeEmails(emails));
        } else {
          localStorage.removeItem(EMAILS_STORAGE_KEY);
        }
      } catch (e) {
        console.warn('Failed to persist emails (quota likely exceeded):', e);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [emails]);

  // Save sent status to localStorage (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (Object.keys(sentStatus).length > 0) {
          localStorage.setItem(STORAGE_KEY, serializeSentStatus(sentStatus));
        }
      } catch (e) {
        console.warn('Failed to persist sentStatus (quota likely exceeded):', e);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [sentStatus]);

  const replaceEmails = useCallback((text: string, onComplete?: (emails: EmailEntry[]) => void, isCSV: boolean = false) => {
    const parsed = parseEmailsText(text, isCSV);
    let seq = 1;
    const newEntries: EmailEntry[] = parsed.map(p => {
      const currentSeq = seq++;
      return {
        id: String(currentSeq),
        sequenceId: currentSeq,
        email: p.email,
        name: p.name,
        isValid: true,
      };
    });
    setEmails(newEntries);
    setNextSequenceId(newEntries.length + 1);
    if (onComplete) onComplete(newEntries);
  }, []);

  const replaceEmailEntries = useCallback((entries: EmailEntry[], onComplete?: (emails: EmailEntry[]) => void) => {
    setEmails(entries);
    setNextSequenceId(entries.length + 1);
    if (onComplete) onComplete(entries);
  }, []);

  const addEmailsFromList = useCallback((emailList: string[], onComplete?: (emails: EmailEntry[]) => void) => {
    const parsed = parseEmailsText(emailList.join('\n'));
    let seq = nextSequenceId;
    const newEntries: EmailEntry[] = parsed.map(p => {
      const currentSeq = seq++;
      return {
        id: String(currentSeq),
        sequenceId: currentSeq,
        email: p.email,
        name: p.name,
        isValid: true,
      };
    });
    setEmails(prev => [...prev, ...newEntries]);
    setNextSequenceId(seq);
    if (onComplete) onComplete(newEntries);
  }, [nextSequenceId]);

  const markAsSent = useCallback((email: string) => {
    setSentStatus((prev) => {
      if (prev[email]) return prev; // Already sent — no-op, no new object
      const next = Object.assign({}, prev);
      next[email] = true;
      setCumulativeSent(c => c + 1);
      return next;
    });
  }, []);

  const markBatchAsSent = useCallback((emailsList: string[]) => {
    setSentStatus((prev) => {
      const next = Object.assign({}, prev);
      let count = 0;
      for (const email of emailsList) {
        if (!next[email]) {
          next[email] = true;
          count++;
        }
      }
      if (count > 0) {
        setCumulativeSent(c => c + count);
        return next;
      }
      return prev;
    });
  }, []);

  const clearAllEmails = useCallback(() => {
    setEmails([]);
    setNextSequenceId(1);
  }, []);

  const resetSentStatus = useCallback(() => {
    setSentStatus({});
    setCumulativeSent(0);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CUMULATIVE_SENT_KEY);
  }, []);

  const { sentCount, totalCount } = useMemo(() => {
    let count = 0;
    for (const e of emails) {
      if (sentStatus[e.email]) count++;
    }
    return { sentCount: count, totalCount: emails.length };
  }, [emails, sentStatus]);

  const cumulativeGenerated = useMemo(() => {
    return cumulativeSent + (totalCount - sentCount);
  }, [cumulativeSent, totalCount, sentCount]);

  const filterList = useCallback((predicate: (email: string) => boolean) => {
    setEmails(prev => {
      const filtered = prev.filter(entry => predicate(entry.email));
      if (filtered.length !== prev.length) {
        toast({
          title: "List Filtered",
          description: `Removed ${prev.length - filtered.length} emails. Remaining: ${filtered.length}`,
        });
      } else {
        toast({ title: "No change", description: "No emails matched criteria to remove." });
      }
      return filtered;
    });
  }, []);

  return {
    emails, sentCount, totalCount, addEmailsFromList, replaceEmails, replaceEmailEntries,
    markAsSent, markBatchAsSent, clearAllEmails, resetSentStatus, setSentStatus,
    sentStatus, cumulativeGenerated, cumulativeSent, filterList
  };
}
