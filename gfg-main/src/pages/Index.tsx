import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { SearchBar } from '@/components/SearchBar';
import { FastMailSend } from '@/components/FastMailSend';
import { GeneratedEmails, type FilterType } from '@/components/GeneratedEmails';
import { LiveDashboard } from '@/components/LiveDashboard';
import { Tracker24h } from '@/components/Tracker24h';
import { useEmailList } from '@/hooks/useEmailList';
import { useTemplates } from '@/hooks/useTemplates';
import { useDailyCounter } from '@/hooks/useDailyCounter';
import { use24hTracker } from '@/hooks/use24hTracker';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Confetti } from '@/components/Confetti';

const MILESTONES = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const MILESTONE_STORAGE_KEY = 'peakx-last-milestone';

const MILESTONE_MESSAGES: Record<number, { emoji: string; title: string; desc: string }> = {
  10: { emoji: '🚀', title: 'First 10!', desc: 'You\'re off to a great start!' },
  50: { emoji: '⚡', title: '50 Sent!', desc: 'Building momentum!' },
  100: { emoji: '🔥', title: '100 Milestone!', desc: 'Triple digits — impressive!' },
  250: { emoji: '💪', title: '250 Sent!', desc: 'You\'re on a roll!' },
  500: { emoji: '🌟', title: '500 Milestone!', desc: 'Halfway to a thousand!' },
  1000: { emoji: '🏆', title: '1K Emails!', desc: 'You\'re a sending machine!' },
  2500: { emoji: '💎', title: '2.5K Sent!', desc: 'Elite outreach status!' },
  5000: { emoji: '👑', title: '5K Milestone!', desc: 'Legendary volume!' },
  10000: { emoji: '🎯', title: '10K Emails!', desc: 'Absolute champion!' },
};

// Storage keys for persistence
const TEXTAREA_STORAGE_KEY = 'peakx-email-textarea';
const SUBJECT_STORAGE_KEY = 'peakx-subject';
const BODY_STORAGE_KEY = 'peakx-body';
const FILTER_STORAGE_KEY = 'peakx-filter';
const USER_NAME_STORAGE_KEY = 'peakx-brand';

// Default values
const DEFAULT_SUBJECT = '';
const DEFAULT_BODY = '';
const DEFAULT_NAME = '';

const Index = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastMilestone, setLastMilestone] = useState(() => {
    const stored = localStorage.getItem(MILESTONE_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  // Scroll to results section after generation
  const scrollToResults = useCallback(() => {
    setTimeout(() => {
      resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, []);

  // Persist user name
  const [userName, setUserName] = useState(() => {
    const stored = localStorage.getItem(USER_NAME_STORAGE_KEY);
    return stored || DEFAULT_NAME;
  });

  // Persist email textarea
  const [emailText, setEmailText] = useState(() => {
    const stored = localStorage.getItem(TEXTAREA_STORAGE_KEY);
    return stored || '';
  });

  // Persist subject with default
  const [subject, setSubject] = useState(() => {
    const stored = localStorage.getItem(SUBJECT_STORAGE_KEY);
    return stored || DEFAULT_SUBJECT;
  });

  // Persist body with default
  const [body, setBody] = useState(() => {
    const stored = localStorage.getItem(BODY_STORAGE_KEY);
    return stored || DEFAULT_BODY;
  });

  // Persist filter
  const [filter, setFilter] = useState<FilterType>(() => {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    return (stored as FilterType) || 'all';
  });

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
    filterList,
  } = useEmailList();

  // Milestone celebration — find highest reached milestone, persist, show custom message
  useEffect(() => {
    // Find the highest milestone the user has reached that they haven't celebrated yet
    const reached = MILESTONES.filter(m => cumulativeSent >= m && m > lastMilestone);
    if (reached.length > 0) {
      const highest = reached[reached.length - 1]; // Last element = highest
      setLastMilestone(highest);
      localStorage.setItem(MILESTONE_STORAGE_KEY, String(highest));
      setShowConfetti(true);
      const msg = MILESTONE_MESSAGES[highest] || { emoji: '🎉', title: 'Milestone!', desc: `You've sent ${highest} emails!` };
      toast({
        title: `${msg.emoji} ${msg.title}`,
        description: msg.desc,
      });
    }
  }, [cumulativeSent, lastMilestone]);

  // Cross-tab synchronization is now handled via 'storage' event listeners in individual hooks
  // to ensure real-time updates and better performance.

  // Clear all history function — with confirmation
  const handleClearAllHistory = () => {
    if (!window.confirm('Clear all history? This will remove all emails, sent status, and counters. This cannot be undone.')) return;
    clearAllEmails();
    resetSentStatus();
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    setFilter('all');
    setLastMilestone(0); // Reset milestones so they can re-trigger

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
    ];

    keysToClear.forEach(key => localStorage.removeItem(key));

    toast({
      title: "History Cleared Successfully",
      description: "Stats and generated emails have been reset. Input text preserved.",
    });
  };

  const { templates, saveTemplate, deleteTemplate } = useTemplates();
  const { count: dailyCount, increment: incrementDaily, weeklyStats } = useDailyCounter();
  const { count: count24h, trackClick } = use24hTracker();

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
  }, [markAsSent, incrementDaily, trackClick]);

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

  const handleFileUpload = (file: File) => {
    setIsProcessing(true);
    toast({ title: "Reading File", description: "Processing file content..." });

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const isCSV = file.name.toLowerCase().endsWith('.csv');

      try {
        replaceEmails(text, (processedEmails) => {
          if (processedEmails.length > 0) {
            setEmailText(isCSV ? `Uploaded: ${file.name} (${processedEmails.length} emails)` : text);
            toast({
              title: "File Imported",
              description: `Successfully processed ${processedEmails.length} emails in background.`
            });
            // Auto-scroll logic
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
        }, isCSV);
      } catch (error) {
        console.error("File processing crash:", error);
        toast({ title: "Error", description: "Processing failed.", variant: "destructive" });
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      toast({ title: "Error", description: "Failed to read file.", variant: "destructive" });
      setIsProcessing(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
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
            isUploading={isProcessing}
            onGenerated={scrollToResults}
          />
        </ErrorBoundary>

        {/* Activity Dashboard (24h) */}
        <div ref={resultsSectionRef}>
          {emails.length > 0 && (
            <Tracker24h count24h={count24h} todayCount={dailyCount} />
          )}
        </div>

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
            />
          </ErrorBoundary>
        </div>

        {/* Live Dashboard (Cumulative) */}
        {emails.length > 0 && (
          <LiveDashboard
            sentCount={sentCount}
            totalCount={totalCount}
            cumulativeSent={cumulativeSent}
            cumulativeGenerated={cumulativeGenerated}
            count24h={count24h}
            weeklyStats={weeklyStats}
          />
        )}

      </main>

      {/* Scroll to Top Button */}
      <Button
        size="icon"
        className="fixed bottom-20 right-4 h-12 w-12 rounded-full bg-secondary hover:bg-secondary/90 shadow-lg"
        onClick={scrollToTop}
      >
        <ArrowUp className="h-5 w-5" />
      </Button>

      {/* Footer */}
      <footer className="w-full py-8 mt-12 border-t border-border/40 bg-background/50 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <p className="text-xs font-semibold text-foreground/80">Peak-X Sender</p>
            <p className="text-[10px] text-muted-foreground">Accelerated email outreach v3.2.0</p>
          </div>
          <div className="flex gap-4">
            <Link to="/privacy">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-primary">Privacy</Button>
            </Link>
            <Link to="/terms">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-primary">Terms</Button>
            </Link>
            <Link to="/help">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-primary">Help</Button>
            </Link>
          </div>
        </div>
      </footer>
    </div>

  );
};

export default Index;
