import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

export interface EmailEntry {
  id: string;
  sequenceId: number;
  email: string;
  isValid: boolean;
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

export function useEmailList() {
  const [emails, setEmails] = useState<EmailEntry[]>(() => {
    const storedEmails = localStorage.getItem(EMAILS_STORAGE_KEY);
    if (storedEmails) {
      try {
        return JSON.parse(storedEmails) as EmailEntry[];
      } catch {
        localStorage.removeItem(EMAILS_STORAGE_KEY);
      }
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
      try {
        return JSON.parse(stored);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    return {};
  });

  // Worker reference
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('../workers/email-processor.worker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch (err) {
      console.error('Failed to initialize worker:', err);
    }
    return () => { workerRef.current?.terminate(); };
  }, []);

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
          localStorage.setItem(EMAILS_STORAGE_KEY, JSON.stringify(emails));
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
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sentStatus));
        }
      } catch (e) {
        console.warn('Failed to persist sentStatus (quota likely exceeded):', e);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [sentStatus]);

  const replaceEmails = useCallback((text: string, onComplete?: (emails: EmailEntry[]) => void, isCSV: boolean = false) => {
    if (!workerRef.current) {
      const rawEmails = extractEmailsFromText(text);
      const now = Date.now();
      const newEntries: EmailEntry[] = rawEmails.map((email, i) => ({
        id: `${email}-${now}-${Math.random()}`,
        sequenceId: i + 1,
        email,
        isValid: true,
      }));
      setEmails(newEntries);
      setNextSequenceId(newEntries.length + 1);
      if (onComplete) onComplete(newEntries);
      return;
    }

    workerRef.current.onmessage = (e) => {
      const { emails: newEmails, nextSequenceId: newSeq } = e.data;
      setEmails(newEmails);
      setNextSequenceId(newSeq);
      if (onComplete) onComplete(newEmails);
    };

    workerRef.current.postMessage({ text, nextSequenceId: 1, sentStatus, isCSV });
  }, [sentStatus]);

  const addEmailsFromList = useCallback((emailList: string[], onComplete?: (emails: EmailEntry[]) => void) => {
    if (!workerRef.current) {
      const rawEmails = extractEmailsFromText(emailList.join('\n'));
      const now = Date.now();
      const newEntries: EmailEntry[] = rawEmails.map((email, i) => ({
        id: `${email}-${now}-${Math.random()}`,
        sequenceId: nextSequenceId + i,
        email,
        isValid: true,
      }));
      setEmails(prev => [...prev, ...newEntries]);
      setNextSequenceId(prev => prev + newEntries.length);
      if (onComplete) onComplete(newEntries);
      return;
    }

    workerRef.current.onmessage = (e) => {
      const { emails: newEmails, nextSequenceId: newSeq } = e.data;
      setEmails(prev => [...prev, ...newEmails]);
      setNextSequenceId(newSeq);
      if (onComplete) onComplete(newEmails);
    };

    workerRef.current.postMessage({ text: emailList.join('\n'), nextSequenceId, sentStatus });
  }, [sentStatus, nextSequenceId]);

  const markAsSent = useCallback((email: string) => {
    setSentStatus((prev) => {
      if (prev[email]) return prev; // Already sent — no-op, no new object
      const next = Object.assign({}, prev);
      next[email] = true;
      setCumulativeSent(c => c + 1);
      return next;
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
    emails, sentCount, totalCount, addEmailsFromList, replaceEmails,
    markAsSent, clearAllEmails, resetSentStatus, setSentStatus,
    sentStatus, cumulativeGenerated, cumulativeSent, filterList
  };
}
