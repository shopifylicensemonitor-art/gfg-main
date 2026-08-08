import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { parseEmailsText } from '@/lib/emailParser';
import { parseCSV, suggestFieldMapping, normalizeHeaderKey, extractEmailsAndUrlsFromCell } from '@/lib/csvParser';

export interface EmailEntry {
  id: string;
  sequenceId: number;
  email: string;
  name?: string;
  isValid: boolean;
  fields?: Record<string, string>;
  listName?: string;
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

export function parseEmailsTextWithFields(text: string): EmailEntry[] {
  if (!text) return [];

  // Load csvMappings from localStorage to apply custom mapped variables
  let mappings: Record<string, string> = {};
  try {
    const stored = localStorage.getItem('peakx-csv-mappings');
    if (stored) mappings = JSON.parse(stored);
  } catch (e) {
    // Ignore JSON parsing issues
  }

  // Parse using client-side CSV parser
  const parsed = parseCSV(text);
  
  if (parsed.headers.length > 0 && parsed.rows.length > 0) {
    // 1. Detect the email column
    let emailCol = parsed.headers.find(h => suggestFieldMapping(h) === 'email');
    if (!emailCol) {
      emailCol = parsed.headers.find(h => h.toLowerCase().includes('email'));
    }
    if (!emailCol) {
      const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
      for (const header of parsed.headers) {
        const hasEmail = parsed.rows.slice(0, 5).some(row => emailRegex.test(row[header] || ''));
        if (hasEmail) {
          emailCol = header;
          break;
        }
      }
    }

    if (emailCol) {
      // Build headers mapping
      const finalMappings: Record<string, string> = {};
      parsed.headers.forEach(header => {
        if (mappings[header]) {
          finalMappings[header] = mappings[header];
        } else {
          if (header === emailCol) {
            finalMappings[header] = 'email';
          } else {
            const suggested = suggestFieldMapping(header);
            if (suggested && suggested !== 'email') {
              finalMappings[header] = suggested;
            } else {
              finalMappings[header] = normalizeHeaderKey(header);
            }
          }
        }
      });

      const emailColKey = emailCol;
      const firstNameCol = Object.keys(finalMappings).find(key => finalMappings[key] === 'first_name');
      const storeNameCol = Object.keys(finalMappings).find(key => finalMappings[key] === 'store_name');
      const nicheCol = Object.keys(finalMappings).find(key => finalMappings[key] === 'niche');
      const painPointCol = Object.keys(finalMappings).find(key => finalMappings[key] === 'pain_point');

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      let seq = 1;

      return parsed.rows.flatMap(row => {
        const rawEmailCell = row[emailColKey]?.trim() || '';
        if (!rawEmailCell) return [];

        const { emails: emailCandidates, url: extractedUrl } = extractEmailsAndUrlsFromCell(rawEmailCell);

        // Build fields
        const fields: Record<string, string> = {};
        if (firstNameCol) fields['first_name'] = row[firstNameCol] || '';
        if (storeNameCol) fields['store_name'] = row[storeNameCol] || '';
        if (nicheCol) fields['niche'] = row[nicheCol] || '';
        if (painPointCol) fields['pain_point'] = row[painPointCol] || '';

        if (extractedUrl) {
          fields['store_url'] = extractedUrl;
          if (!fields['store_name']) {
            fields['store_name'] = extractedUrl;
          }
        }

        // Copy custom columns
        Object.keys(finalMappings).forEach(key => {
          const val = finalMappings[key];
          if (val !== 'skip' && val !== 'email' && val !== 'first_name' && val !== 'store_name' && val !== 'niche' && val !== 'pain_point') {
            fields[val] = row[key] || '';
          }
        });

        const name = fields['first_name'] || undefined;
        if (emailCandidates.length === 0) return [];

        const combinedEmail = emailCandidates.join(', ');
        const isValid = emailCandidates.every(e => emailRegex.test(e));
        const currentSeq = seq++;

        return [{
          id: String(currentSeq),
          sequenceId: currentSeq,
          email: combinedEmail,
          name,
          isValid,
          fields: { ...fields }
        }];
      });
    }
  }

  // Fallback: parse using parseEmailsText
  const parsedSimple = parseEmailsText(text);
  return parsedSimple.map((p, idx) => {
    const seq = idx + 1;
    return {
      id: String(seq),
      sequenceId: seq,
      email: p.email,
      name: p.name,
      isValid: true,
    };
  });
}

// ── Compact LocalStorage Serialization Helpers ─────────────────────
function serializeEmails(entries: EmailEntry[]): string {
  return entries.map(e => {
    const fieldsStr = e.fields ? JSON.stringify(e.fields) : '';
    return `${e.sequenceId}|${e.email}|${e.name || ''}|${e.isValid ? 1 : 0}|${fieldsStr}|${e.listName || ''}`;
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
      const listName = parts[5] || undefined;
      entries.push({
        id: String(sequenceId),
        sequenceId,
        email,
        name,
        isValid,
        fields,
        listName
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

  const replaceEmails = useCallback((
    text: string, 
    onComplete?: (emails: EmailEntry[]) => void, 
    isCSV: boolean = false,
    filterSent: boolean = false
  ) => {
    const parsed = parseEmailsTextWithFields(text);
    
    // Create a map of existing emails to their entry
    const existingMap = new Map<string, EmailEntry>();
    emails.forEach(e => {
      existingMap.set(e.email.toLowerCase(), e);
    });

    let seq = 1;
    let newEntries: EmailEntry[] = parsed.map(p => {
      const emailLower = p.email.toLowerCase();
      const existing = existingMap.get(emailLower);
      return {
        id: '', // Will set below
        sequenceId: 0, // Will set below
        email: p.email,
        name: p.name || existing?.name,
        isValid: p.isValid,
        fields: p.fields || existing?.fields,
        listName: p.listName || existing?.listName || 'default',
      };
    });

    if (filterSent) {
      newEntries = newEntries.filter(e => {
        const activeListName = e.listName || 'default';
        const key = `${activeListName}:${e.email.toLowerCase()}`;
        return !sentStatus[key];
      });
    }

    // Assign IDs and sequence IDs
    newEntries = newEntries.map(e => {
      const currentSeq = seq++;
      return {
        ...e,
        id: String(currentSeq),
        sequenceId: currentSeq,
      };
    });

    setEmails(newEntries);
    setNextSequenceId(newEntries.length + 1);
    if (onComplete) onComplete(newEntries);
  }, [emails, sentStatus]);

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
      const matched = emails.find(e => e.email.toLowerCase() === email.toLowerCase());
      const activeListName = matched?.listName || 'default';
      const key = `${activeListName}:${email.toLowerCase()}`;
      
      if (prev[key]) return prev; // Already sent — no-op
      const next = Object.assign({}, prev);
      next[key] = true;
      setCumulativeSent(c => c + 1);
      return next;
    });
  }, [emails]);

  const markBatchAsSent = useCallback((emailsList: string[]) => {
    setSentStatus((prev) => {
      const next = Object.assign({}, prev);
      let count = 0;
      for (const email of emailsList) {
        const matched = emails.find(e => e.email.toLowerCase() === email.toLowerCase());
        const activeListName = matched?.listName || 'default';
        const key = `${activeListName}:${email.toLowerCase()}`;
        
        if (!next[key]) {
          next[key] = true;
          count++;
        }
      }
      if (count > 0) {
        setCumulativeSent(c => c + count);
        return next;
      }
      return prev;
    });
  }, [emails]);

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
      const activeListName = e.listName || 'default';
      const key = `${activeListName}:${e.email.toLowerCase()}`;
      if (sentStatus[key]) count++;
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
