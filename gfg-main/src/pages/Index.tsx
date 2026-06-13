import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { SearchBar } from '@/components/SearchBar';
import { FastMailSend } from '@/components/FastMailSend';
import { GeneratedEmails, type FilterType } from '@/components/GeneratedEmails';
import { useEmailList } from '@/hooks/useEmailList';
import { parseCSV, type ParsedCSV } from '@/lib/csvParser';
import { ColumnMapper } from '@/components/ColumnMapper';
import { useTemplates } from '@/hooks/useTemplates';
import { useDailyCounter } from '@/hooks/useDailyCounter';
import { use24hTracker } from '@/hooks/use24hTracker';
import { useOutreachTracker } from '@/hooks/useOutreachTracker';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Confetti } from '@/components/Confetti';
import { GoalAlarm } from '@/components/GoalAlarm';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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
  const [showConfetti, setShowConfetti] = useState(false);
  const [isMapperOpen, setIsMapperOpen] = useState(false);
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV>({ headers: [], rows: [] });
  const [uploadedFileName, setUploadedFileName] = useState('');
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

  // ── Ref Hooks ──────────────────────────────────────────────────────────────
  const resultsSectionRef = useRef<HTMLDivElement>(null);

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
      toast({ title: '🎉 Installed!', description: 'Peakconix Sender has been added to your home screen.' });
    }
  }, [install]);

  // Scroll to results section after generation
  const scrollToResults = useCallback(() => {
    setTimeout(() => {
      resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, []);

  const handleClearAllHistory = () => {
    if (!window.confirm('Clear all history? This will remove all emails, sent status, and counters. This cannot be undone.')) return;
    clearAllEmails();
    resetSentStatus();
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    setFilter('all');
    setLastMilestone(0); // Reset milestones so they can re-trigger
    
    // Reset configurations to default
    setMyInboxTo('');
    setCcRoutingMode('reroute');
    setEnableRandomization(true);
    setAlarmIntervalStep('200');
    setBccBatchSize(20);
    setBccBatchOpenCount(5);

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
  }, [markAsSent, incrementDaily, trackClick, emails, addLog]);

  const handleSendBatchClick = useCallback((batchEmails: string[]) => {
    markBatchAsSent(batchEmails);
    incrementDaily(batchEmails.length);
    trackClick(batchEmails.length);

    // Find lead details in current list to enrich tracking logs
    const newLogs = batchEmails.map(email => {
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
  }, [markBatchAsSent, incrementDaily, trackClick, emails, addLogs]);

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

  const handleConfirmMapping = (mappings: Record<string, string>) => {
    setIsMapperOpen(false);

    // Identify which CSV column maps to the required target variables
    const emailCol = Object.keys(mappings).find(key => mappings[key] === 'email')!;
    const firstNameCol = Object.keys(mappings).find(key => mappings[key] === 'first_name');
    const storeNameCol = Object.keys(mappings).find(key => mappings[key] === 'store_name');
    const nicheCol = Object.keys(mappings).find(key => mappings[key] === 'niche');
    const painPointCol = Object.keys(mappings).find(key => mappings[key] === 'pain_point');

    let seq = 1;
    const entries = parsedCSV.rows.map(row => {
      const email = row[emailCol]?.trim().toLowerCase() || '';
      // Only process valid email syntax
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValid = emailRegex.test(email);

      const fields: Record<string, string> = {};
      if (firstNameCol) fields['first_name'] = row[firstNameCol] || '';
      if (storeNameCol) fields['store_name'] = row[storeNameCol] || '';
      if (nicheCol) fields['niche'] = row[nicheCol] || '';
      if (painPointCol) fields['pain_point'] = row[painPointCol] || '';

      // Copy custom columns as well
      Object.keys(mappings).forEach(key => {
        const val = mappings[key];
        if (val !== 'skip' && val !== 'email' && val !== 'first_name' && val !== 'store_name' && val !== 'niche' && val !== 'pain_point') {
          fields[val] = row[key] || '';
        }
      });

      const name = fields['first_name'] || undefined;
      const currentSeq = seq++;

      return {
        id: String(currentSeq),
        sequenceId: currentSeq,
        email,
        name,
        isValid,
        fields
      };
    }).filter(e => e.email !== ''); // Filter out empty email rows

    replaceEmailEntries(entries);

    // Update email text editor view
    const displayEmails = entries.slice(0, 1000).map(e => e.email);
    const header = `# Uploaded CSV: ${uploadedFileName} (${entries.length.toLocaleString()} leads mapped)\n`;
    const moreNote = entries.length > 1000
      ? `# Showing first 1,000 emails — all ${entries.length.toLocaleString()} leads with fields are loaded\n`
      : '';
    setEmailText(header + moreNote + displayEmails.join('\n'));

    // Scroll to results
    setTimeout(() => {
      const el = document.getElementById('generated-emails-section');
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

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
          replaceEmails(text, (processedEmails) => {
            if (processedEmails.length > 0) {
              const MAX_DISPLAY = 10000;
              const displayEmails = processedEmails.slice(0, MAX_DISPLAY).map(e => e.email);
              const header = `# Uploaded: ${file.name} (${processedEmails.length.toLocaleString()} emails total)\n`;
              const moreNote = processedEmails.length > MAX_DISPLAY
                ? `# Showing first ${MAX_DISPLAY.toLocaleString()} — all ${processedEmails.length.toLocaleString()} are loaded\n`
                : '';
              setEmailText(header + moreNote + displayEmails.join('\n'));

              toast({
                title: "File Imported",
                description: `Successfully loaded ${processedEmails.length.toLocaleString()} emails.`
              });
              setTimeout(() => {
                const el = document.getElementById('generated-emails-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            } else {
              toast({
                title: "No emails found",
                description: "No valid emails found in file.",
                variant: "destructive"
              });
            }
            setIsProcessing(false);
          }, false);
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
        keywords={[
          'free bulk email generator',
          'client-side bulk email sender',
          'local browser email outreach tool',
          'cold email personalization generator',
          'mailto bulk generator',
          'private cold outreach builder',
          'Peakconix Sender dashboard'
        ]}
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          'name': 'Peakconix Sender',
          'alternateName': 'Peakconix Bulk Email Outreach Tool',
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
            'name': 'Peakconix',
            'email': 'peakconix@gmail.com'
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
        <SearchBar value={searchQuery} onChange={setSearchQuery} />



        {/* Fast Mail Send */}
        <ErrorBoundary>
          <FastMailSend
            onReplaceEmails={replaceEmails}
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
          />
        </ErrorBoundary>

        {/* Goal & Alarm */}
        <GoalAlarm 
          todayCount={dailyCount} 
          intervalStep={alarmIntervalStep}
          onIntervalStepChange={setAlarmIntervalStep}
        />

        {/* Activity Dashboard (24h) - MOVED TO DASHBOARD PAGE */}
        <div ref={resultsSectionRef} />

        {/* Generated Emails */}
        <div id="generated-emails-section">
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
            />
          </ErrorBoundary>
        </div>



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
                Peakconix Sender Achievement
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
