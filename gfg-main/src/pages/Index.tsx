  import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { SearchBar } from '@/components/SearchBar';
import { FastMailSend } from '@/components/FastMailSend';
import { GeneratedEmails, type FilterType } from '@/components/GeneratedEmails';
import { AnimatedSection } from '@/components/AnimatedSection';
import { useEmailList, parseEmailsTextWithFields } from '@/hooks/useEmailList';
import { parseCSV, extractEmailsAndUrlsFromCell, suggestFieldMapping, normalizeHeaderKey, convertToCSV, type ParsedCSV } from '@/lib/csvParser';
import { ColumnMapper } from '@/components/ColumnMapper';
import { useTemplates } from '@/hooks/useTemplates';
import { useDailyCounter } from '@/hooks/useDailyCounter';
import { use24hTracker } from '@/hooks/use24hTracker';
import { useOutreachTracker } from '@/hooks/useOutreachTracker';
import { ArrowUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Confetti } from '@/components/Confetti';
import { GoalAlarm } from '@/components/GoalAlarm';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { api, type ContactListInfo } from '../api';

// Milestones scale from 10 to 10M+ with no cap
const MILESTONES = [
  10, 25, 50, 100, 250, 500, 1000, 2500, 5000,
  10000, 25000, 50000, 75000, 100000, 150000, 250000,
  500000, 750000, 1000000, 2000000, 3000000, 5000000, 10000000,
];
const MILESTONE_STORAGE_KEY = 'peakx-last-milestone';

const fmt = (n: number) => n >= 1000000 ? `${n / 1000000}M` : n >= 1000 ? `${n / 1000}K` : String(n);

const MILESTONE_MESSAGES: Record<number, { emoji: string; title: string; desc: string }> = {
  10: { emoji: '🚀', title: 'First 10!', desc: 'You\'re off to a great start!' },
  25: { emoji: '✨', title: '25 Sent!', desc: 'Getting into the groove!' },
  50: { emoji: '⚡', title: '50 Sent!', desc: 'Building real momentum!' },
  100: { emoji: '🔥', title: '100 Milestone!', desc: 'Triple digits — impressive!' },
  250: { emoji: '💪', title: '250 Sent!', desc: 'You\'re on a serious roll!' },
  500: { emoji: '🌟', title: '500 Milestone!', desc: 'Halfway to a thousand!' },
  1000: { emoji: '🏆', title: '1K Emails!', desc: 'You\'re a sending machine!' },
  2500: { emoji: '💎', title: '2.5K Sent!', desc: 'Elite outreach status!' },
  5000: { emoji: '👑', title: '5K Milestone!', desc: 'Legendary volume achieved!' },
  10000: { emoji: '🎯', title: '10K Emails!', desc: 'Absolute champion tier!' },
  25000: { emoji: '⭐', title: '25K Sent!', desc: 'You\'re unstoppable!' },
  50000: { emoji: '🌍', title: '50K Milestone!', desc: 'Global-scale outreach!' },
  75000: { emoji: '🔱', title: '75K Sent!', desc: 'Closing in on 100K!' },
  100000: { emoji: '💯', title: '100K Emails!', desc: 'Six figures — you\'re a legend!' },
  150000: { emoji: '🛡️', title: '150K Sent!', desc: 'Unstoppable force!' },
  250000: { emoji: '🏅', title: '250K Milestone!', desc: 'Quarter million — elite!' },
  500000: { emoji: '🌠', title: '500K Emails!', desc: 'Half a million — incredible!' },
  750000: { emoji: '🎖️', title: '750K Sent!', desc: 'Almost at a million!' },
  1000000: { emoji: '🏛️', title: '1M Emails!', desc: 'One million — you\'re in the hall of fame!' },
  2000000: { emoji: '🚀', title: '2M Milestone!', desc: 'Two million strong!' },
  3000000: { emoji: '⚡', title: '3M Sent!', desc: 'Three million — phenomenal!' },
  5000000: { emoji: '👑', title: '5M Emails!', desc: 'Five million — absolute royalty!' },
  10000000: { emoji: '🌟', title: '10M Milestone!', desc: 'Ten million — you\'ve made history!' },
};

// Storage keys for persistence
const TEXTAREA_STORAGE_KEY = 'peakx-email-textarea';
const SUBJECT_STORAGE_KEY = 'peakx-subject';
const BODY_STORAGE_KEY = 'peakx-body';
const FILTER_STORAGE_KEY = 'peakx-filter';
const USER_NAME_STORAGE_KEY = 'peakx-brand';
const CC_STORAGE_KEY = 'peakx-cc';
const BCC_STORAGE_KEY = 'peakx-bcc';
const MYINBOX_TO_STORAGE_KEY = 'peakx-myinbox-to';
const CC_ROUTING_MODE_STORAGE_KEY = 'peakx-cc-routing-mode';
const ENABLE_RANDOMIZATION_STORAGE_KEY = 'peakx-enable-randomization';
const ALARM_INTERVAL_STEP_KEY = 'peakx-alarm-interval-step';
const BCC_BATCH_SIZE_KEY = 'peakx-bcc-batch-size';
const BCC_BATCH_OPEN_COUNT_KEY = 'peakx-bcc-batch-open-count';

// Default values
const DEFAULT_SUBJECT = '';
const DEFAULT_BODY = '';
const DEFAULT_NAME = '';

const Index = () => {
  const [searchParams] = useSearchParams();

  // Scroll to section based on ?scroll=... query parameter (used by navigation links)
  useEffect(() => {
    const scrollToId = searchParams.get('scroll');
    if (scrollToId) {
      const el = document.getElementById(scrollToId);
      if (el) {
        const timer = setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
        return () => clearTimeout(timer);
      }
    }
  }, [searchParams]);

  // ── Custom Hooks ───────────────────────────────────────────────────────────
  const { canInstall, install } = usePWAInstall();
  const {
    emails,
    sentCount,
    totalCount,
    addEmailsFromList,
    markAsSent,
    clearAllEmails,
    resetSentStatus,
    setSentStatus,
    sentStatus,
    cumulativeGenerated,
    cumulativeSent,
    replaceEmails,
    replaceEmailEntries,
    filterList,
    markBatchAsSent,
  } = useEmailList();
  const { templates, saveTemplate, deleteTemplate } = useTemplates();
  const {
    count: dailyCount,
    increment: incrementDaily,
    weeklyStats,
    weekTotal,
    monthlyStats,
    yesterdayCount,
    lastWeekCount,
    lastMonthCount
  } = useDailyCounter();
  const { count: count24h, trackClick, timestamps } = use24hTracker();
  const { addLog, addLogs } = useOutreachTracker();

  // ── State Hooks ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMapperOpen, setIsMapperOpen] = useState(false);
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV>(() => {
    const stored = localStorage.getItem('peakx-parsed-csv');
    return stored ? JSON.parse(stored) : { headers: [], rows: [] };
  });
  const [uploadedFileName, setUploadedFileName] = useState(() => {
    return localStorage.getItem('peakx-uploaded-filename') || '';
  });
  const [csvMappings, setCsvMappings] = useState<Record<string, string>>(() => {
    const stored = localStorage.getItem('peakx-csv-mappings');
    return stored ? JSON.parse(stored) : {};
  });
  const [showConfetti, setShowConfetti] = useState(false);
  const [reachedMilestoneInfo, setReachedMilestoneInfo] = useState<{ emoji: string; title: string; desc: string; value: number } | null>(null);
  const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false);
  const [lastMilestone, setLastMilestone] = useState(() => {
    const stored = localStorage.getItem(MILESTONE_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const [userName, setUserName] = useState(() => {
    const stored = localStorage.getItem(USER_NAME_STORAGE_KEY);
    return stored || DEFAULT_NAME;
  });
  const [cc, setCc] = useState(() => localStorage.getItem(CC_STORAGE_KEY) || '');
  const [bcc, setBcc] = useState(() => localStorage.getItem(BCC_STORAGE_KEY) || '');
  const [myInboxTo, setMyInboxTo] = useState(() => localStorage.getItem(MYINBOX_TO_STORAGE_KEY) || '');
  const [ccRoutingMode, setCcRoutingMode] = useState<'reroute' | 'normal'>(() => 
    (localStorage.getItem(CC_ROUTING_MODE_STORAGE_KEY) as 'reroute' | 'normal') || 'reroute'
  );
  const [enableRandomization, setEnableRandomization] = useState(() => 
    localStorage.getItem(ENABLE_RANDOMIZATION_STORAGE_KEY) === 'false' ? false : true
  );
  const [alarmIntervalStep, setAlarmIntervalStep] = useState(() => 
    localStorage.getItem(ALARM_INTERVAL_STEP_KEY) || '200'
  );
  const [bccBatchSize, setBccBatchSize] = useState<number>(() => {
    const stored = localStorage.getItem(BCC_BATCH_SIZE_KEY);
    return stored ? parseInt(stored, 10) : 20;
  });
  const [bccBatchOpenCount, setBccBatchOpenCount] = useState<number>(() => {
    const stored = localStorage.getItem(BCC_BATCH_OPEN_COUNT_KEY);
    return stored ? parseInt(stored, 10) : 5;
  });
  const [goalInput, setGoalInput] = useState(() => localStorage.getItem('peakx-send-goal') || '');
  const [autoScroll, setAutoScroll] = useState(() => {
    const stored = localStorage.getItem('peakx-auto-scroll');
    return stored === 'false' ? false : true;
  });
  const [emailText, setEmailText] = useState(() => {
    const stored = localStorage.getItem(TEXTAREA_STORAGE_KEY);
    return stored || '';
  });
  const [subject, setSubject] = useState(() => {
    const stored = localStorage.getItem(SUBJECT_STORAGE_KEY);
    return stored || DEFAULT_SUBJECT;
  });
  const [body, setBody] = useState(() => {
    const stored = localStorage.getItem(BODY_STORAGE_KEY);
    return stored || DEFAULT_BODY;
  });
  const [filter, setFilter] = useState<FilterType>(() => {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    return (stored as FilterType) || 'all';
  });
  const [activeVariables, setActiveVariables] = useState<string[]>([]);
  const [savedLists, setSavedLists] = useState<ContactListInfo[]>([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [pendingImportContacts, setPendingImportContacts] = useState<any[]>([]);
  const [pendingImportListName, setPendingImportListName] = useState('');
  const [importChunkSize, setImportChunkSize] = useState<number>(5000);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; added: number; skipped: number } | null>(null);
  
  const [isSegmentDialogOpen, setIsSegmentDialogOpen] = useState(false);
  const [segmentListName, setSegmentListName] = useState('');
  const [segmentListTotalCount, setSegmentListTotalCount] = useState(0);
  const [schedulerEnabled, setSchedulerEnabled] = useState<boolean>(true);
  const [isSendingBackend, setIsSendingBackend] = useState<boolean>(false);
  const [segmentSize, setSegmentSize] = useState<number>(10000);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number>(0);
  const [isIncompleteDialogOpen, setIsIncompleteDialogOpen] = useState(false);
  const [incompleteInfo, setIncompleteInfo] = useState<{
    total: number;
    complete: number;
    incomplete: number;
    missingVars: string[];
    pendingEntries: any[];
  } | null>(null);

  useEffect(() => {
    localStorage.setItem('peakx-send-goal', goalInput);
  }, [goalInput]);

  useEffect(() => {
    localStorage.setItem('peakx-auto-scroll', String(autoScroll));
  }, [autoScroll]);

  // ── Ref Hooks ──────────────────────────────────────────────────────────────
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const rawCsvTextRef = useRef<string>('');
  const isInitialLoad = useRef<boolean>(true);

  // ── Effects & Callbacks ────────────────────────────────────────────────────
  // Auto-scroll to activity section on page load when emails exist
  useEffect(() => {
    if (emails.length > 0) {
      requestAnimationFrame(() => {
        resultsSectionRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Retrieve workspace state from Supabase on mount
  useEffect(() => {
    let deviceId = localStorage.getItem('peakx-device-id');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('peakx-device-id', deviceId);
    }

    setIsProcessing(true);
    api.getDeviceState(deviceId)
      .then(state => {
        if (state) {
          // Restore all state variables
          if (state.emailText !== undefined) setEmailText(state.emailText);
          if (state.subject !== undefined) setSubject(state.subject);
          if (state.body !== undefined) setBody(state.body);
          if (state.userName !== undefined) setUserName(state.userName);
          if (state.cc !== undefined) setCc(state.cc);
          if (state.bcc !== undefined) setBcc(state.bcc);
          if (state.myInboxTo !== undefined) setMyInboxTo(state.myInboxTo);
          if (state.ccRoutingMode !== undefined) setCcRoutingMode(state.ccRoutingMode);
          if (state.enableRandomization !== undefined) setEnableRandomization(state.enableRandomization);
          if (state.bccBatchSize !== undefined) setBccBatchSize(state.bccBatchSize);
          if (state.bccBatchOpenCount !== undefined) setBccBatchOpenCount(state.bccBatchOpenCount);
          if (state.autoScroll !== undefined) setAutoScroll(state.autoScroll);
          if (state.goalInput !== undefined) setGoalInput(state.goalInput);
          if (state.alarmIntervalStep !== undefined) setAlarmIntervalStep(state.alarmIntervalStep);
          if (state.csvMappings !== undefined) setCsvMappings(state.csvMappings);
          if (state.uploadedFileName !== undefined) setUploadedFileName(state.uploadedFileName);
          if (state.parsedCSV !== undefined) setParsedCSV(state.parsedCSV);
          if (state.activeVariables !== undefined) setActiveVariables(state.activeVariables);

          // Re-parse emails list if emailText was loaded
          if (state.emailText) {
            const parsedEntries = parseEmailsTextWithFields(state.emailText);
            replaceEmailEntries(parsedEntries);
          }
          
          toast({
            title: "Workspace Restored",
            description: "Successfully loaded your outreach configuration from Supabase.",
          });
        }
      })
      .catch(err => {
        console.error("Failed to retrieve state from Supabase:", err);
      })
      .finally(() => {
        setIsProcessing(false);
        isInitialLoad.current = false; // Mark initial load as completed
      });
  }, [replaceEmailEntries]);

  // Debounced auto-sync watcher to save configuration state to Supabase on change
  useEffect(() => {
    if (isInitialLoad.current) return;

    const timer = setTimeout(() => {
      const combinedState = {
        emailText,
        subject,
        body,
        userName,
        cc,
        bcc,
        myInboxTo,
        ccRoutingMode,
        enableRandomization,
        bccBatchSize,
        bccBatchOpenCount,
        autoScroll,
        goalInput,
        alarmIntervalStep,
        csvMappings,
        uploadedFileName,
        parsedCSV,
        activeVariables,
      };

      const deviceId = localStorage.getItem('peakx-device-id');
      if (deviceId) {
        api.saveDeviceState(deviceId, combinedState)
          .catch(err => console.error("Failed to auto-sync state to Supabase:", err));
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [
    emailText,
    subject,
    body,
    userName,
    cc,
    bcc,
    myInboxTo,
    ccRoutingMode,
    enableRandomization,
    bccBatchSize,
    bccBatchOpenCount,
    autoScroll,
    goalInput,
    alarmIntervalStep,
    csvMappings,
    uploadedFileName,
    parsedCSV,
    activeVariables,
  ]);

  useEffect(() => {
    api.getContactLists()
      .then(setSavedLists)
      .catch(err => console.error("Error fetching contact lists:", err));
    
    // Fetch scheduler status
    api.getSettings()
      .then(s => setSchedulerEnabled(s.SCHEDULER_ENABLED === 'true'))
      .catch(() => {});
  }, []);

  // Reconstruct activeVariables from persisted emails on mount
  // This ensures variable buttons survive a page refresh
  useEffect(() => {
    if (emails.length > 0 && activeVariables.length === 0) {
      const allKeys = new Set<string>();
      for (const entry of emails) {
        if (entry.fields) {
          Object.keys(entry.fields).forEach(k => allKeys.add(k));
        }
      }
      if (allKeys.size > 0) {
        setActiveVariables(Array.from(new Set(['first_name', 'store_name', 'niche', ...allKeys])));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Save to localStorage on change
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(TEXTAREA_STORAGE_KEY, emailText);
    }, 1000); // Debounce to prevent keystroke lag
    return () => clearTimeout(timer);
  }, [emailText]);

  useEffect(() => {
    localStorage.setItem(SUBJECT_STORAGE_KEY, subject);
  }, [subject]);

  useEffect(() => {
    localStorage.setItem(BODY_STORAGE_KEY, body);
  }, [body]);

  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, filter);
  }, [filter]);

  useEffect(() => {
    localStorage.setItem(USER_NAME_STORAGE_KEY, userName);
  }, [userName]);

  useEffect(() => { localStorage.setItem(CC_STORAGE_KEY, cc); }, [cc]);
  useEffect(() => { localStorage.setItem(BCC_STORAGE_KEY, bcc); }, [bcc]);
  useEffect(() => { localStorage.setItem(MYINBOX_TO_STORAGE_KEY, myInboxTo); }, [myInboxTo]);
  useEffect(() => { localStorage.setItem(CC_ROUTING_MODE_STORAGE_KEY, ccRoutingMode); }, [ccRoutingMode]);
  useEffect(() => { localStorage.setItem(ENABLE_RANDOMIZATION_STORAGE_KEY, String(enableRandomization)); }, [enableRandomization]);
  useEffect(() => { localStorage.setItem(ALARM_INTERVAL_STEP_KEY, alarmIntervalStep); }, [alarmIntervalStep]);
  useEffect(() => { localStorage.setItem(BCC_BATCH_SIZE_KEY, String(bccBatchSize)); }, [bccBatchSize]);
  useEffect(() => { localStorage.setItem(BCC_BATCH_OPEN_COUNT_KEY, String(bccBatchOpenCount)); }, [bccBatchOpenCount]);

  useEffect(() => {
    try {
      if (parsedCSV.headers.length > 0) {
        localStorage.setItem('peakx-parsed-csv', JSON.stringify(parsedCSV));
      } else {
        localStorage.removeItem('peakx-parsed-csv');
      }
    } catch (e) {
      console.warn('Failed to persist parsedCSV:', e);
    }
  }, [parsedCSV]);

  useEffect(() => {
    if (uploadedFileName) {
      localStorage.setItem('peakx-uploaded-filename', uploadedFileName);
    } else {
      localStorage.removeItem('peakx-uploaded-filename');
    }
  }, [uploadedFileName]);

  useEffect(() => {
    try {
      if (Object.keys(csvMappings).length > 0) {
        localStorage.setItem('peakx-csv-mappings', JSON.stringify(csvMappings));
      } else {
        localStorage.removeItem('peakx-csv-mappings');
      }
    } catch (e) {
      console.warn('Failed to persist csvMappings:', e);
    }
  }, [csvMappings]);

  // Milestone celebration — find highest reached milestone, persist, show custom message
  useEffect(() => {
    const reached = MILESTONES.filter(m => cumulativeSent >= m && m > lastMilestone);
    if (reached.length > 0) {
      const highest = reached[reached.length - 1]; // Last element = highest
      setLastMilestone(highest);
      localStorage.setItem(MILESTONE_STORAGE_KEY, String(highest));
      setShowConfetti(true);
      const msg = MILESTONE_MESSAGES[highest] || { emoji: '🎉', title: 'Milestone!', desc: `You've sent ${highest} emails!` };
      setReachedMilestoneInfo({ ...msg, value: highest });
      setIsMilestoneDialogOpen(true);
      toast({
        title: `${msg.emoji} ${msg.title}`,
        description: msg.desc,
      });
    }
  }, [cumulativeSent, lastMilestone]);

  const installPWA = useCallback(async () => {
    const accepted = await install();
    if (accepted) {
      toast({ title: '🎉 Installed!', description: 'Peak Xender has been added to your home screen.' });
    }
  }, [install]);

  // Scroll to results section after generation
  const scrollToResults = useCallback(() => {
    if (!autoScroll) return;
    setTimeout(() => {
      resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [autoScroll]);

  const handleClearPreview = () => {
    setParsedCSV({ headers: [], rows: [] });
    setUploadedFileName('');
    setCsvMappings({});
    localStorage.removeItem('peakx-parsed-csv');
    localStorage.removeItem('peakx-uploaded-filename');
    localStorage.removeItem('peakx-csv-mappings');
    clearAllEmails();
    setEmailText('');
    toast({
      title: "CSV Unloaded",
      description: "CSV preview and contacts list have been cleared.",
    });
  };

  const handleClearAllHistory = () => {
    if (!window.confirm('Clear all history? This will remove all emails, sent status, and counters. This cannot be undone.')) return;
    clearAllEmails();
    resetSentStatus();
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    setFilter('all');
    setLastMilestone(0); // Reset milestones so they can re-trigger
    setActiveVariables([]);
    setParsedCSV({ headers: [], rows: [] });
    setUploadedFileName('');
    setCsvMappings({});
    
    // Reset configurations to default
    setMyInboxTo('');
    setCcRoutingMode('reroute');
    setEnableRandomization(true);
    setAlarmIntervalStep('200');
    setBccBatchSize(20);
    setBccBatchOpenCount(5);
    setGoalInput('');
    setAutoScroll(true);

    // Clear potential storage keys (EXCEPT Text area)
    const keysToClear = [
      SUBJECT_STORAGE_KEY,
      BODY_STORAGE_KEY,
      FILTER_STORAGE_KEY,
      MILESTONE_STORAGE_KEY,
      'bulk-email-list',
      'bulk-email-sent-status',
      'bulk-email-cumulative-generated',
      'bulk-email-cumulative-sent',
      'peakx-24h-tracker',
      MYINBOX_TO_STORAGE_KEY,
      CC_ROUTING_MODE_STORAGE_KEY,
      ENABLE_RANDOMIZATION_STORAGE_KEY,
      ALARM_INTERVAL_STEP_KEY,
      BCC_BATCH_SIZE_KEY,
      BCC_BATCH_OPEN_COUNT_KEY,
      'peakx-send-goal',
      'peakx-auto-scroll',
      'peakx-parsed-csv',
      'peakx-uploaded-filename',
      'peakx-csv-mappings',
    ];

    keysToClear.forEach(key => localStorage.removeItem(key));

    toast({
      title: "History Cleared Successfully",
      description: "Stats, settings, and generated emails have been reset. Input text preserved.",
    });
  };

  const emailCounts = useMemo(() => {
    const valid = emails.filter(e => e.isValid).length;
    const invalid = emails.length - valid;
    return { valid, invalid, total: emails.length, duplicates: 0 };
  }, [emails]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSendClick = useCallback((email: string) => {
    const goal = parseInt(goalInput, 10);
    const validGoal = !isNaN(goal) && goal > 0;
    if (validGoal && dailyCount >= goal) {
      toast({
        title: "Daily Limit Reached",
        description: `You have reached your daily sending target limit of ${goal} emails.`,
        variant: "destructive"
      });
      return;
    }

    markAsSent(email);
    incrementDaily();
    trackClick();

    // Find lead details in current list to enrich tracking logs
    const entry = emails.find(e => e.email === email);
    addLog({
      email,
      name: entry?.name || entry?.fields?.first_name,
      storeName: entry?.fields?.store_name,
      niche: entry?.fields?.niche,
      type: 'individual'
    });
  }, [markAsSent, incrementDaily, trackClick, emails, addLog, goalInput, dailyCount]);

  const handleSendBatchClick = useCallback((batchEmails: string[]) => {
    const goal = parseInt(goalInput, 10);
    const validGoal = !isNaN(goal) && goal > 0;
    if (validGoal && dailyCount >= goal) {
      toast({
        title: "Daily Limit Reached",
        description: `You have reached your daily sending target limit of ${goal} emails.`,
        variant: "destructive"
      });
      return;
    }

    // Truncate batch size if it would exceed target
    let emailsToTrigger = batchEmails;
    if (validGoal && dailyCount + batchEmails.length > goal) {
      const allowedCount = goal - dailyCount;
      emailsToTrigger = batchEmails.slice(0, allowedCount);
      toast({
        title: "Batch Partially Opened",
        description: `Opening first ${allowedCount} emails to stay precisely within your daily target limit.`,
      });
    }

    markBatchAsSent(emailsToTrigger);
    incrementDaily(emailsToTrigger.length);
    trackClick(emailsToTrigger.length);

    // Find lead details in current list to enrich tracking logs
    const newLogs = emailsToTrigger.map(email => {
      const entry = emails.find(e => e.email === email);
      return {
        email,
        name: entry?.name || entry?.fields?.first_name,
        storeName: entry?.fields?.store_name,
        niche: entry?.fields?.niche,
        type: 'bcc'
      };
    });
    addLogs(newLogs);
  }, [markBatchAsSent, incrementDaily, trackClick, emails, addLogs, goalInput, dailyCount]);

  const handleSaveTemplate = (name: string, subj: string, bodyText: string) => {
    saveTemplate(name, subj, bodyText);
    toast({
      title: "Template saved",
      description: `"${name}" has been saved.`,
    });
  };

  const handleDeleteTemplate = (id: string) => {
    deleteTemplate(id);
    toast({
      title: "Template deleted",
      description: "Template has been removed.",
    });
  };

  const validateAndReplaceEmails = useCallback((allEntries: any[]) => {
    if (allEntries.length === 0) {
      replaceEmailEntries([]);
      return;
    }

    // Extract placeholders from subject and body
    const extractDoubleBraceVars = (str: string): string[] => {
      const vars = new Set<string>();
      const regex = /\{\{([^}]+)\}\}/g;
      let match;
      while ((match = regex.exec(str)) !== null) {
        vars.add(match[1].trim());
      }
      return Array.from(vars);
    };

    const usedVars = Array.from(new Set([
      ...extractDoubleBraceVars(subject),
      ...extractDoubleBraceVars(body)
    ]));

    // Replicate resolveVar logic to check if fields are missing
    const resolveVarForEntry = (key: string, entry: any, uName: string): string => {
      const normKey = key.toLowerCase();
      const [localPart, domainPart] = entry.email.split('@');
      const pSname = domainPart ? domainPart.split('.')[0] : '';
      const displayName = entry.name || localPart;

      if (normKey === 'email') return entry.email;
      if (normKey === 'name' || normKey === 'first_name') return displayName;
      if (normKey === 'store' || normKey === 'store_name') return entry.fields?.store_name || domainPart || '';
      if (normKey === 'sname') return pSname;
      if (normKey === 'brand') return uName;
      if (normKey === 'niche') return entry.fields?.niche || '';
      if (normKey === 'pain_point') return entry.fields?.pain_point || '';
      if (entry.fields?.[key] !== undefined) return entry.fields[key];
      if (entry.fields?.[normKey] !== undefined) return entry.fields[normKey];
      return '';
    };

    const missingVarsSet = new Set<string>();
    const completeEntries: any[] = [];
    const incompleteEntries: any[] = [];

    allEntries.forEach(entry => {
      const missingForThisEntry = usedVars.filter(v => {
        const val = resolveVarForEntry(v, entry, userName);
        return !val || val.trim() === '';
      });

      if (missingForThisEntry.length > 0) {
        incompleteEntries.push(entry);
        missingForThisEntry.forEach(v => missingVarsSet.add(v));
      } else {
        completeEntries.push(entry);
      }
    });

    if (incompleteEntries.length > 0) {
      setIncompleteInfo({
        total: allEntries.length,
        complete: completeEntries.length,
        incomplete: incompleteEntries.length,
        missingVars: Array.from(missingVarsSet),
        pendingEntries: completeEntries
      });
      setIsIncompleteDialogOpen(true);
    } else {
      const sequenced = allEntries.map((e, idx) => ({
        ...e,
        id: String(idx + 1),
        sequenceId: idx + 1
      }));
      replaceEmailEntries(sequenced);
    }
  }, [subject, body, userName, replaceEmailEntries]);

  const processCSVData = (parsed: ParsedCSV, fileName: string, customMappings?: Record<string, string>, rawCsvText?: string) => {
    if (parsed.headers.length === 0 || parsed.rows.length === 0) return;

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
    if (!emailCol) {
      emailCol = parsed.headers[0];
    }

    // 2. Build the mappings
    const mappings: Record<string, string> = {};
    if (customMappings) {
      Object.assign(mappings, customMappings);
    } else {
      parsed.headers.forEach(header => {
        if (header === emailCol) {
          mappings[header] = 'email';
        } else {
          const suggested = suggestFieldMapping(header);
          if (suggested && suggested !== 'email') {
            mappings[header] = suggested;
          } else {
            mappings[header] = normalizeHeaderKey(header);
          }
        }
      });
    }

    const emailColKey = Object.keys(mappings).find(key => mappings[key] === 'email') || emailCol;
    const firstNameCol = Object.keys(mappings).find(key => mappings[key] === 'first_name');
    const storeNameCol = Object.keys(mappings).find(key => mappings[key] === 'store_name');
    const nicheCol = Object.keys(mappings).find(key => mappings[key] === 'niche');
    const painPointCol = Object.keys(mappings).find(key => mappings[key] === 'pain_point');

    let seq = 1;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const entries = parsed.rows.flatMap(row => {
      const rawEmailCell = row[emailColKey]?.trim() || '';
      if (!rawEmailCell) return [];

      const { emails: emailCandidates, url: extractedUrl } = extractEmailsAndUrlsFromCell(rawEmailCell);

      // Build shared fields from this row
      const fields: Record<string, string> = {};
      if (firstNameCol) fields['first_name'] = row[firstNameCol] || '';
      if (storeNameCol) fields['store_name'] = row[storeNameCol] || '';
      if (nicheCol) fields['niche'] = row[nicheCol] || '';
      if (painPointCol) fields['pain_point'] = row[painPointCol] || '';

      // Set store_url and store_name if URL is extracted
      if (extractedUrl) {
        fields['store_url'] = extractedUrl;
        if (!fields['store_name']) {
          fields['store_name'] = extractedUrl;
        }
      }

      // Copy custom columns as well
      Object.keys(mappings).forEach(key => {
        const val = mappings[key];
        if (val !== 'skip' && val !== 'email' && val !== 'first_name' && val !== 'store_name' && val !== 'niche' && val !== 'pain_point') {
          fields[val] = row[key] || '';
        }
      });

      const name = fields['first_name'] || undefined;

      return emailCandidates.map(email => {
        const isValid = emailRegex.test(email);
        const currentSeq = seq++;
        return {
          id: String(currentSeq),
          sequenceId: currentSeq,
          email,
          name,
          isValid,
          fields: { ...fields },
          listName: fileName, // Set listName to file name
        };
      });
    }).filter(e => e.email !== '');

    // Filter out already-sent emails so only pending recipients are shown
    const pendingEntries = entries.filter(e => !sentStatus[`${fileName}:${e.email.toLowerCase()}`]);
    const skippedSent = entries.length - pendingEntries.length;

    // Re-sequence IDs after filtering
    let pendingSeq = 1;
    const resequenced = pendingEntries.map(e => ({
      ...e,
      id: String(pendingSeq),
      sequenceId: pendingSeq++,
    }));

    validateAndReplaceEmails(resequenced);

    // Save mapped variable categories for dynamic textbox buttons display
    const mappedTargets = Object.values(mappings).filter(v => v !== 'skip');
    setActiveVariables(Array.from(new Set(mappedTargets)));

    // Update email text editor view
    if (rawCsvText) {
      setEmailText(rawCsvText);
    } else {
      const csvStr = convertToCSV(parsed.headers, parsed.rows);
      setEmailText(csvStr);
    }

    toast({
      title: "CSV Import Success",
      description: `Loaded ${parsed.rows.length.toLocaleString()} leads from ${fileName}.`
    });

    // Scroll to results
    if (autoScroll) {
      setTimeout(() => {
        const el = document.getElementById('generated-emails-section');
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  };

  const handleConfirmMapping = (mappings: Record<string, string>) => {
    setIsMapperOpen(false);
    setCsvMappings(mappings);
    processCSVData(parsedCSV, uploadedFileName, mappings, rawCsvTextRef.current);
  };

  const loadListSegment = async (listName: string, total: number, limit: number, offset: number) => {
    setIsProcessing(true);
    try {
      const fetchedContacts = await api.getContacts(listName, limit, offset);
      if (fetchedContacts.length === 0) {
        toast({
          title: "No contacts found",
          description: `The contact list "${listName}" segment is empty.`,
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }

      let seq = 1;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const entries = fetchedContacts.map(c => {
        const isValid = emailRegex.test(c.email);
        const currentSeq = seq++;
        
        // Extract fields
        const fields = c.fields || {};
        const name = fields.first_name || fields.name || undefined;
        
        return {
          id: String(currentSeq),
          sequenceId: currentSeq,
          email: c.email,
          name,
          isValid,
          fields,
          listName: listName, // Set listName
        };
      });

      // Filter out already-sent emails so only pending recipients are shown
      const pendingEntries = entries.filter(e => !sentStatus[`${listName}:${e.email.toLowerCase()}`]);
      const skippedSent = entries.length - pendingEntries.length;

      // Re-sequence IDs after filtering
      let pendingSeq = 1;
      const resequenced = pendingEntries.map(e => ({
        ...e,
        id: String(pendingSeq),
        sequenceId: pendingSeq++,
      }));

      validateAndReplaceEmails(resequenced);

      // Extract active variables from all entries (scan all, not just first)
      const allFieldKeys = new Set<string>();
      for (const entry of resequenced) {
        if (entry.fields) {
          Object.keys(entry.fields).forEach(k => allFieldKeys.add(k));
        }
      }
      const fieldKeysArray = Array.from(allFieldKeys);
      setActiveVariables(Array.from(new Set(['first_name', 'store_name', 'niche', ...fieldKeysArray])));

      // Convert database contacts to ParsedCSV format for preview
      const dbParsedCSV: ParsedCSV = {
        headers: ['email', ...fieldKeysArray],
        rows: resequenced.map(e => ({
          email: e.email,
          ...(e.fields || {})
        }))
      };

      const dbMappings: Record<string, string> = { email: 'email' };
      fieldKeysArray.forEach(k => {
        dbMappings[k] = k;
      });

      setParsedCSV(dbParsedCSV);
      
      // Label lists with segment range if pagination was applied
      const rangeLabel = total > limit 
        ? `${listName} (Leads ${offset + 1} - ${Math.min(offset + limit, total)})`
        : listName;
      setUploadedFileName(rangeLabel);
      setCsvMappings(dbMappings);

      // Set text in text area to raw CSV representation
      const csvStr = convertToCSV(dbParsedCSV.headers, dbParsedCSV.rows);
      setEmailText(csvStr);

      toast({
        title: "List Loaded",
        description: skippedSent > 0
          ? `Loaded ${resequenced.length.toLocaleString()} pending contacts from "${rangeLabel}". Skipped ${skippedSent.toLocaleString()} already sent.`
          : `Successfully loaded ${resequenced.length.toLocaleString()} contacts from "${rangeLabel}".`
      });

      // Scroll to generated emails section
      if (autoScroll) {
        setTimeout(() => {
          const el = document.getElementById('generated-emails-section');
          el?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }

    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error loading contact list",
        description: err.message || "Failed to fetch contact details from database."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSavedList = async (listName: string) => {
    if (!listName) return;
    
    // Find the total count from savedLists
    const listInfo = savedLists.find(l => l.list_name === listName);
    const totalCount = listInfo ? listInfo.count : 0;
    
    if (totalCount > 10000) {
      setSegmentListName(listName);
      setSegmentListTotalCount(totalCount);
      setSegmentSize(10000);
      setSelectedSegmentIndex(0);
      setIsSegmentDialogOpen(true);
      return;
    }
    
    await loadListSegment(listName, totalCount, 10000, 0);
  };

  const handleReplaceEmails = useCallback((text: string) => {
    if (!text.trim()) {
      replaceEmails(text);
      return;
    }

    const allEntries = parseEmailsTextWithFields(text);
    if (allEntries.length > 10000) {
      setPendingImportContacts(allEntries);
      setPendingImportListName('Pasted Leads List');
      setIsImportDialogOpen(true);
      return;
    }

    validateAndReplaceEmails(allEntries);
  }, [validateAndReplaceEmails, replaceEmails]);

  const handleConfirmSkipGenerate = useCallback(() => {
    if (!incompleteInfo) return;
    
    // Re-assign sequenceIds sequentially for the complete entries
    const sequenced = incompleteInfo.pendingEntries.map((e, idx) => ({
      ...e,
      id: String(idx + 1),
      sequenceId: idx + 1
    }));
    
    replaceEmailEntries(sequenced);
    setIsIncompleteDialogOpen(false);

    toast({
      title: "Emails Generated",
      description: `Generated ${sequenced.length.toLocaleString()} outreach emails. Skipped ${incompleteInfo.incomplete.toLocaleString()} incomplete recipients.`
    });

    // Scroll to generated emails section
    if (autoScroll) {
      setTimeout(() => {
        const el = document.getElementById('generated-emails-section');
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [incompleteInfo, replaceEmailEntries, autoScroll]);

  const handleSendViaBackend = useCallback(async () => {
    if (!emails.length) {
      toast({
        title: "No Recipients",
        description: "Add recipient emails first before sending via backend.",
        variant: "destructive"
      });
      return;
    }

    setIsSendingBackend(true);
    try {
      // Build recipients array with all fields
      const recipients = emails
        .filter(e => e.isValid)
        .map(e => ({
          email: e.email,
          ...(e.fields || {}),
          ...(e.name ? { first_name: e.name } : {})
        }));

      if (recipients.length === 0) {
        toast({
          title: "No Valid Recipients",
          description: "No valid email addresses found in the list.",
          variant: "destructive"
        });
        setIsSendingBackend(false);
        return;
      }

      const campaignName = `Fast Send - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      const res = await api.createCampaignFromCsv({
        name: campaignName,
        subjects: [subject || 'No Subject'],
        recipients,
        html_template: body || '',
        delay_seconds: 30,
        start_time: '08:00',
        end_time: '22:00',
      });

      toast({
        title: "Campaign Created!",
        description: res.message || `Campaign #${res.campaign_id} created with ${recipients.length} recipients. The scheduler will process them automatically.`,
      });

      // Optionally auto-launch the campaign
      try {
        const launchRes = await api.launchCampaign(res.campaign_id);
        toast({
          title: "Campaign Launched",
          description: launchRes.message || `Campaign #${res.campaign_id} is now sending. Queue items have been populated.`,
        });
      } catch (launchErr: any) {
        toast({
          title: "Campaign Saved as Draft",
          description: `Campaign #${res.campaign_id} was created but auto-launch failed: ${launchErr.message}. Launch it manually from Campaigns page.`,
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "Backend Campaign Failed",
        description: err.message || "Could not send campaign to backend server. Is the server running?",
        variant: "destructive"
      });
    } finally {
      setIsSendingBackend(false);
    }
  }, [emails, subject, body]);

  const handleFileUpload = (file: File) => {
    setIsProcessing(true);
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (isCSV) {
      toast({ title: "Parsing CSV", description: "Reading CSV data..." });
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsed = parseCSV(text);
          if (parsed.headers.length === 0 || parsed.rows.length === 0) {
            toast({
              title: "Empty or invalid CSV",
              description: "We could not find any headers or rows in this CSV.",
              variant: "destructive"
            });
            setIsProcessing(false);
            return;
          }
          rawCsvTextRef.current = text;
          
          const allEntries = parseEmailsTextWithFields(text);
          if (allEntries.length > 10000) {
            setPendingImportContacts(allEntries);
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            setPendingImportListName(baseName);
            setIsImportDialogOpen(true);
            setIsProcessing(false);
            return;
          }

          setParsedCSV(parsed);
          setUploadedFileName(file.name);
          setIsMapperOpen(true);
        } catch (err) {
          console.error("CSV parsing error:", err);
          toast({ title: "Error", description: "Failed to parse CSV.", variant: "destructive" });
        }
        setIsProcessing(false);
      };
      reader.onerror = () => {
        toast({ title: "Error", description: "Failed to read file.", variant: "destructive" });
        setIsProcessing(false);
      };
      reader.readAsText(file);
    } else {
      // Plain text file import
      toast({ title: "Reading File", description: "Processing file content..." });
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const allEntries = parseEmailsTextWithFields(text);
          if (allEntries.length > 10000) {
            setPendingImportContacts(allEntries);
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            setPendingImportListName(baseName);
            setIsImportDialogOpen(true);
            setIsProcessing(false);
            return;
          }

          replaceEmails(text, (processedEmails) => {
            if (processedEmails.length > 0) {
              const MAX_DISPLAY = 10000;
              const displayEmails = processedEmails.slice(0, MAX_DISPLAY).map(e => e.email);
              const header = `# Uploaded: ${file.name} (${processedEmails.length.toLocaleString()} pending emails loaded)\n`;
              const moreNote = processedEmails.length > MAX_DISPLAY
                ? `# Showing first ${MAX_DISPLAY.toLocaleString()} — all ${processedEmails.length.toLocaleString()} are loaded\n`
                : '';
              setEmailText(header + moreNote + displayEmails.join('\n'));

              toast({
                title: "File Imported",
                description: `Successfully loaded ${processedEmails.length.toLocaleString()} emails.`
              });
              if (autoScroll) {
                setTimeout(() => {
                  const el = document.getElementById('generated-emails-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            } else {
              toast({
                title: "No emails found",
                description: "No valid or pending emails found in file.",
                variant: "destructive"
              });
            }
            setIsProcessing(false);
          }, false, true);
        } catch (error) {
          console.error("File import error:", error);
          toast({ title: "Error", description: "Import failed.", variant: "destructive" });
          setIsProcessing(false);
        }
      };
      reader.readAsText(file);
    }
  };


  return (
    <AppShell>
      <SEO
        title="Dashboard - Cold Email Personalization & Bulk Sender"
        description="Lightning-fast bulk email outreach and personalization tool. Paste lists, set custom placeholders (name, store, sname), and generate mailto links inside your browser. 100% private, client-side execution."
        noindex={true}
        keywords={[
          'free bulk email generator',
          'client-side bulk email sender',
          'local browser email outreach tool',
          'cold email personalization generator',
          'mailto bulk generator',
          'private cold outreach builder',
          'Peak Xender dashboard'
        ]}
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          'name': 'Peak Xender',
          'alternateName': 'Peak Xender Bulk Email Outreach Tool',
          'description': 'Lightning-fast bulk email outreach and personalization tool designed for speed and simplicity. 100% client-side and privacy-focused, running entirely in your browser.',
          'applicationCategory': 'BusinessApplication, CommunicationApplication',
          'operatingSystem': 'All (Web, Windows, macOS, Linux, iOS, Android)',
          'browserRequirements': 'Requires HTML5, LocalStorage, Web Workers, and JavaScript support.',
          'offers': {
            '@type': 'Offer',
            'price': '0.00',
            'priceCurrency': 'USD'
          },
          'featureList': [
            'Bulk email parser and validation',
            'Dynamic variable replacement ({name}, {store}, {sname})',
            '100% Client-side processing and strict privacy focus',
            'Live activity dashboard tracking sent emails',
            'Fast CSV and TXT email list upload support',
            'Save and reuse personalized email outreach templates'
          ],
          'author': {
            '@type': 'Organization',
            'name': 'Peak Xender',
            'email': 'peakxender@gmail.com'
          }
        }}
      />
      <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />

      <ColumnMapper
        isOpen={isMapperOpen}
        onClose={() => setIsMapperOpen(false)}
        parsedCSV={parsedCSV}
        fileName={uploadedFileName}
        onConfirm={handleConfirmMapping}
      />

      <div className="space-y-6">
        {/* Search Bar */}
        <AnimatedSection delay={0.05}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </AnimatedSection>

        {/* Fast Mail Send */}
        <AnimatedSection delay={0.1}>
          <ErrorBoundary>
          <FastMailSend
            onReplaceEmails={handleReplaceEmails}
            onAddEmails={addEmailsFromList}
            onFilterList={filterList}
            onFileUpload={handleFileUpload}
            emailText={emailText}
            onEmailTextChange={setEmailText}
            subject={subject}
            onSubjectChange={setSubject}
            body={body}
            onBodyChange={setBody}
            validCount={emailCounts.valid}
            invalidCount={emailCounts.invalid}
            onClear={clearAllEmails}
            onClearAllHistory={handleClearAllHistory}
            onValidate={() => { }}
            templates={templates}
            onSaveTemplate={handleSaveTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            userName={userName}
            onUserNameChange={setUserName}
            cc={cc}
            onCcChange={setCc}
            bcc={bcc}
            onBccChange={setBcc}
            isUploading={isProcessing}
            onGenerated={scrollToResults}
            myInboxTo={myInboxTo}
            onMyInboxToChange={setMyInboxTo}
            ccRoutingMode={ccRoutingMode}
            onCcRoutingModeChange={setCcRoutingMode}
            enableRandomization={enableRandomization}
            onEnableRandomizationChange={setEnableRandomization}
            bccBatchSize={bccBatchSize}
            onBccBatchSizeChange={setBccBatchSize}
            bccBatchOpenCount={bccBatchOpenCount}
            onBccBatchOpenCountChange={setBccBatchOpenCount}
            activeVariables={activeVariables}
            savedLists={savedLists}
            onLoadSavedList={handleLoadSavedList}
            autoScroll={autoScroll}
            onAutoScrollChange={setAutoScroll}
            parsedCSV={parsedCSV}
            uploadedFileName={uploadedFileName}
            csvMappings={csvMappings}
            onClearPreview={handleClearPreview}
            onSendViaBackend={handleSendViaBackend}
            isSendingBackend={isSendingBackend}
            schedulerEnabled={schedulerEnabled}
          />
        </ErrorBoundary>
        </AnimatedSection>

        {/* Goal & Alarm */}
        <AnimatedSection delay={0.15}>
          <GoalAlarm 
            todayCount={dailyCount} 
            intervalStep={alarmIntervalStep}
            onIntervalStepChange={setAlarmIntervalStep}
            goalInput={goalInput}
            onGoalInputChange={setGoalInput}
          />
        </AnimatedSection>

        {/* Activity Dashboard (24h) - MOVED TO DASHBOARD PAGE */}
        <div ref={resultsSectionRef} />

        {/* Generated Emails */}
        <AnimatedSection id="generated-emails-section" delay={0.2}>
          <ErrorBoundary>
            <GeneratedEmails
              emails={emails}
              subject={subject}
              body={body}
              userName={userName}
              onSendClick={handleSendClick}
              filter={filter}
              onFilterChange={setFilter}
              searchQuery={searchQuery}
              sentStatus={sentStatus}
              cc={cc}
              bcc={bcc}
              myInboxTo={myInboxTo}
              ccRoutingMode={ccRoutingMode}
              enableRandomization={enableRandomization}
              onSendBatchClick={handleSendBatchClick}
              bccBatchSize={bccBatchSize}
              bccBatchOpenCount={bccBatchOpenCount}
              dailyCount={dailyCount}
              goalInput={goalInput}
            />
          </ErrorBoundary>
        </AnimatedSection>



      </div>

      {/* Milestone Celebration Dialog */}
      <Dialog open={isMilestoneDialogOpen} onOpenChange={setIsMilestoneDialogOpen}>
        <DialogContent className="sm:max-w-md border-primary/25 bg-background shadow-2xl p-6 text-center rounded-xl animate-in zoom-in-95 duration-200">
          <div className="space-y-5 pt-4">
            <div className="text-6xl animate-bounce duration-1000 select-none">
              {reachedMilestoneInfo?.emoji || '🏆'}
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-foreground">
                {reachedMilestoneInfo?.title || 'Milestone Reached!'}
              </h2>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono font-bold text-primary/80">
                Peak Xender Achievement
              </p>
            </div>
            <div className="p-4 rounded-xl bg-primary/[0.04] border border-primary/10 shadow-inner">
              <p className="text-sm font-medium text-foreground italic">
                "{reachedMilestoneInfo?.desc}"
              </p>
              <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                Total outreach generated: <span className="font-bold text-primary">{reachedMilestoneInfo?.value?.toLocaleString()}</span> emails
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => setIsMilestoneDialogOpen(false)} 
                className="w-full peak-gradient-bg text-white shadow-md border-none font-semibold hover:opacity-90 transition-opacity"
              >
                Awesome, Keep Sending!
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Incomplete Recipient Details Warning Dialog */}
      <Dialog open={isIncompleteDialogOpen} onOpenChange={setIsIncompleteDialogOpen}>
        <DialogContent className="rounded-2xl border border-amber-500/20 bg-slate-950/95 backdrop-blur-xl shadow-2xl p-6 max-w-md animate-in zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
              Incomplete Recipient Details
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              Some rows in your recipient list are missing values for variables used in your message template.
            </DialogDescription>
          </DialogHeader>

          {incompleteInfo && (
            <div className="space-y-4 my-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-900/60 rounded-xl p-3 border border-border/40 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
                  <div className="text-lg font-bold text-slate-200 mt-1">{incompleteInfo.total}</div>
                </div>
                <div className="bg-emerald-950/20 rounded-xl p-3 border border-emerald-500/20 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-400">Complete</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">{incompleteInfo.complete}</div>
                </div>
                <div className="bg-amber-950/20 rounded-xl p-3 border border-amber-500/20 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-amber-400">Incomplete</div>
                  <div className="text-lg font-bold text-amber-400 mt-1">{incompleteInfo.incomplete}</div>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-border/40 rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-slate-300">Missing Template Placeholders:</div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {incompleteInfo.missingVars.map(v => (
                    <Badge key={v} variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded text-[10px] font-mono">
                      {"{{" + v + "}}"}
                    </Badge>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed pt-1.5 border-t border-border/30 mt-2">
                  Incomplete recipients will be skipped to prevent sending emails with blank personalization fields.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsIncompleteDialogOpen(false)}
              className="flex-1 rounded-xl border-slate-800 text-slate-300 hover:bg-slate-900"
            >
              Cancel &amp; Edit List
            </Button>
            <Button
              onClick={handleConfirmSkipGenerate}
              disabled={!incompleteInfo || incompleteInfo.complete === 0}
              className="flex-1 rounded-xl peak-gradient-bg text-white border-none shadow-lg shadow-primary/20 hover:opacity-95"
            >
              Skip &amp; Generate ({incompleteInfo?.complete})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Large List Import Dialog — Chunked Upload */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => { if (!isProcessing) { setIsImportDialogOpen(open); if (!open) { setImportProgress(null); } } }}>
        <DialogContent className="rounded-2xl border border-primary/20 bg-slate-950/95 backdrop-blur-xl shadow-2xl p-6 max-w-md animate-in zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <AlertTriangle className="h-5 w-5 text-amber-500 animate-pulse" />
              Large List Detected
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              This list contains <strong>{pendingImportContacts.length.toLocaleString()}</strong> contacts. We'll split it into chunks and upload them sequentially.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-3">
              <p className="text-xs text-slate-300">
                The file will be split into chunks and uploaded batch-by-batch to avoid size limits. You can then load segments for manual sending.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Save List As:</label>
                  <Input
                    type="text"
                    placeholder="e.g. Q3 Large Leads List"
                    value={pendingImportListName}
                    onChange={e => setPendingImportListName(e.target.value)}
                    disabled={isProcessing}
                    className="bg-background/40 h-10 text-xs border-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Chunk Size:</label>
                  <select
                    value={importChunkSize}
                    onChange={e => setImportChunkSize(parseInt(e.target.value, 10))}
                    disabled={isProcessing}
                    className="w-full bg-background border border-muted/80 rounded-lg h-10 text-xs px-2.5 focus:ring-2 focus:ring-primary/10 focus:outline-none text-foreground"
                  >
                    <option value={1000}>1,000 per batch</option>
                    <option value={2000}>2,000 per batch</option>
                    <option value={5000}>5,000 per batch</option>
                    <option value={10000}>10,000 per batch</option>
                  </select>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                This will send <strong>{Math.ceil(pendingImportContacts.length / importChunkSize)}</strong> batch{Math.ceil(pendingImportContacts.length / importChunkSize) !== 1 ? 'es' : ''} of up to {importChunkSize.toLocaleString()} contacts each.
              </div>
            </div>

            {/* Progress bar */}
            {importProgress && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400">Uploading batch {importProgress.current} of {importProgress.total}...</span>
                  <span className="text-primary font-bold">{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${(importProgress.current / importProgress.total) * 100}%`,
                      background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))'
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Added: <span className="text-emerald-400 font-bold">{importProgress.added.toLocaleString()}</span></span>
                  <span>Skipped: <span className="text-amber-400 font-bold">{importProgress.skipped.toLocaleString()}</span></span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false);
                setPendingImportContacts([]);
                setImportProgress(null);
              }}
              disabled={isProcessing}
              className="flex-1 rounded-xl border-slate-800 text-slate-300 hover:bg-slate-900"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!pendingImportListName.trim()) {
                  toast({
                    title: "List Name Required",
                    description: "Please specify a name for this contact list.",
                    variant: "destructive"
                  });
                  return;
                }
                setIsProcessing(true);
                const listName = pendingImportListName.trim();
                const allContacts = pendingImportContacts.map(c => ({ email: c.email, fields: c.fields }));
                const totalChunks = Math.ceil(allContacts.length / importChunkSize);
                let totalAdded = 0;
                let totalSkipped = 0;

                setImportProgress({ current: 0, total: totalChunks, added: 0, skipped: 0 });

                try {
                  for (let i = 0; i < totalChunks; i++) {
                    const chunk = allContacts.slice(i * importChunkSize, (i + 1) * importChunkSize);
                    const res = await api.importBulkContacts(listName, chunk);
                    totalAdded += res.added;
                    totalSkipped += res.skipped;
                    setImportProgress({ current: i + 1, total: totalChunks, added: totalAdded, skipped: totalSkipped });
                  }

                  toast({
                    title: "Import Complete",
                    description: `Saved ${totalAdded.toLocaleString()} contacts in ${totalChunks} batch${totalChunks !== 1 ? 'es' : ''}. Skipped ${totalSkipped.toLocaleString()} duplicates.`
                  });

                  handleClearPreview();
                  setIsImportDialogOpen(false);
                  setPendingImportContacts([]);
                  setImportProgress(null);

                  const updated = await api.getContactLists();
                  setSavedLists(updated);
                } catch (err: any) {
                  toast({
                    title: "Import Failed",
                    description: `Failed at batch ${(importProgress?.current || 0) + 1}: ${err.message || 'Unknown error'}. ${totalAdded} contacts were saved before the error.`,
                    variant: "destructive"
                  });
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing || !pendingImportListName.trim()}
              className="flex-1 rounded-xl peak-gradient-bg text-white border-none shadow-lg shadow-primary/20 hover:opacity-95"
            >
              {isProcessing
                ? `Uploading ${importProgress?.current || 0}/${importProgress?.total || '...'}...`
                : `Split & Import (${Math.ceil(pendingImportContacts.length / importChunkSize)} batches)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Segment Selector Dialog */}
      <Dialog open={isSegmentDialogOpen} onOpenChange={setIsSegmentDialogOpen}>
        <DialogContent className="rounded-2xl border border-primary/20 bg-slate-950/95 backdrop-blur-xl shadow-2xl p-6 max-w-md animate-in zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Segmented List Loading
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              The list "{segmentListName}" has <strong>{segmentListTotalCount.toLocaleString()}</strong> contacts. Select a segment to load.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Segment Size</label>
                <select
                  value={segmentSize}
                  onChange={e => {
                    setSegmentSize(parseInt(e.target.value, 10));
                    setSelectedSegmentIndex(0);
                  }}
                  className="w-full bg-background border border-muted/80 rounded-lg h-9 text-xs px-2.5 focus:ring-2 focus:ring-primary/10 focus:outline-none"
                >
                  <option value={1000}>1,000 contacts</option>
                  <option value={5000}>5,000 contacts</option>
                  <option value={10000}>10,000 contacts (Max)</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Select Range</label>
                <select
                  value={selectedSegmentIndex}
                  onChange={e => setSelectedSegmentIndex(parseInt(e.target.value, 10))}
                  className="w-full bg-background border border-muted/80 rounded-lg h-9 text-xs px-2.5 focus:ring-2 focus:ring-primary/10 focus:outline-none text-foreground"
                >
                  {Array.from({ length: Math.ceil(segmentListTotalCount / segmentSize) }).map((_, idx) => {
                    const start = idx * segmentSize + 1;
                    const end = Math.min((idx + 1) * segmentSize, segmentListTotalCount);
                    return (
                      <option key={idx} value={idx}>
                        Part {idx + 1} ({start.toLocaleString()} - {end.toLocaleString()})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsSegmentDialogOpen(false)}
              className="flex-1 rounded-xl border-slate-800 text-slate-300 hover:bg-slate-900"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setIsSegmentDialogOpen(false);
                const offset = selectedSegmentIndex * segmentSize;
                await loadListSegment(segmentListName, segmentListTotalCount, segmentSize, offset);
              }}
              className="flex-1 rounded-xl peak-gradient-bg text-white border-none shadow-lg shadow-primary/20 hover:opacity-95"
            >
              Load Segment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scroll to Top Button */}
      <Button
        size="icon"
        className="fixed bottom-20 right-4 h-12 w-12 rounded-full bg-secondary hover:bg-secondary/90 shadow-lg"
        onClick={scrollToTop}
      >
        <ArrowUp className="h-5 w-5" />
      </Button>

    </AppShell>

  );
};

export default Index;
