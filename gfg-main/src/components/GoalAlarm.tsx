import { useState, useEffect, useRef } from 'react';
import { Bell, Target, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Web Audio API sound generator — no external files needed
// ---------------------------------------------------------------------------
function playSound(type: 'goal' | 'alarm' | 'warning' | 'followup', tone: 'classic' | 'digital' | 'melody') {
  const ACtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!ACtx) return;
  try {
    const ctx = new ACtx();
    const startTime = ctx.currentTime;
    
    // Celebration Goal (always runs ascending celebration scale)
    // Play for 10 seconds sequentially
    if (type === 'goal') {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      const repeatInterval = 1.2;
      const durationSec = 10;
      const repeatCount = Math.ceil(durationSec / repeatInterval);
      
      for (let r = 0; r < repeatCount; r++) {
        const loopStart = startTime + r * repeatInterval;
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = freq;
          const t = loopStart + i * 0.16;
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.3, t + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          osc.start(t);
          osc.stop(t + 0.55);
        });
      }
      return;
    }

    // Determine musical notes based on type and tone signature
    let freqs: number[] = [];
    let oscType: OscillatorType = 'sine';
    let noteSpacing = 0.15;
    let decayTime = 0.6;
    let volume = 0.25;

    if (tone === 'digital') {
      oscType = 'square';
      noteSpacing = 0.08;
      decayTime = 0.15;
      volume = 0.12; // lower volume for retro square wave to prevent loudness
      
      if (type === 'warning') {
        freqs = [1046.50, 1318.51]; // C6, E6
      } else if (type === 'alarm') {
        freqs = [1046.50, 1318.51, 1567.98, 2093.00]; // C6, E6, G6, C7
      } else {
        freqs = [1567.98, 1318.51]; // G6, E6
      }
    } else if (tone === 'melody') {
      oscType = 'triangle';
      noteSpacing = 0.14;
      decayTime = 0.45;
      volume = 0.25;

      if (type === 'warning') {
        freqs = [392.00, 493.88]; // G4, B4
      } else if (type === 'alarm') {
        freqs = [392.00, 493.88, 587.33, 783.99]; // G4, B4, D5, G5
      } else {
        freqs = [493.88, 392.00]; // B4, G4
      }
    } else {
      // 'classic' (Melodic Sine Chime - Default)
      oscType = 'sine';
      noteSpacing = 0.15;
      decayTime = 0.7;
      volume = 0.25;

      if (type === 'warning') {
        freqs = [698.46, 880.00]; // F5, A5
      } else if (type === 'alarm') {
        freqs = [698.46, 880.00, 1046.50]; // F5, A5, C6
      } else {
        freqs = [880.00, 698.46]; // A5, F5
      }
    }

    // Synthesize notes
    const patternDuration = freqs.length * noteSpacing + decayTime;
    const repeatInterval = Math.max(patternDuration + 0.4, 1.5);
    const totalDuration = (type === 'alarm') ? 10 : patternDuration; // Play for 10s if alarm, otherwise single play
    const repeatCount = (type === 'alarm') ? Math.ceil(totalDuration / repeatInterval) : 1;

    for (let r = 0; r < repeatCount; r++) {
      const loopStart = startTime + r * repeatInterval;
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = oscType;
        osc.frequency.value = freq;
        
        const startTimeNote = loopStart + i * noteSpacing;
        gain.gain.setValueAtTime(0, startTimeNote);
        gain.gain.linearRampToValueAtTime(volume, startTimeNote + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, startTimeNote + decayTime);
        
        osc.start(startTimeNote);
        osc.stop(startTimeNote + decayTime + 0.1);
      });
    }
  } catch {
    // AudioContext may be blocked - silently ignore
  }
}

// ---------------------------------------------------------------------------
// Persistence keys
// ---------------------------------------------------------------------------
const GOAL_KEY = 'peakx-send-goal';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface GoalAlarmProps {
  todayCount: number;
  intervalStep: string;
  onIntervalStepChange: (step: string) => void;
  goalInput: string;
  onGoalInputChange: (val: string) => void;
}

// ---------------------------------------------------------------------------
// Component Constants & Component
// ---------------------------------------------------------------------------
const PRESETS = ['50', '100', '200', '500', '1000'];

export function GoalAlarm({
  todayCount,
  intervalStep,
  onIntervalStepChange,
  goalInput,
  onGoalInputChange,
}: GoalAlarmProps) {
  // Preset options synchronization
  const isPreset = PRESETS.includes(intervalStep);
  const [selectValue, setSelectValue] = useState(isPreset ? intervalStep : 'custom');

  useEffect(() => {
    const isPres = PRESETS.includes(intervalStep);
    setSelectValue(isPres ? intervalStep : 'custom');
  }, [intervalStep]);

  // ── Daily Sending Target ─────────────────────────────────────────────────────
  const [goalReached, setGoalReached] = useState(false);

  const goal = parseInt(goalInput, 10);
  const validGoal = !isNaN(goal) && goal > 0;
  const progress = validGoal ? Math.min((todayCount / goal) * 100, 100) : 0;

  // Fire celebration when target crossed
  useEffect(() => {
    if (validGoal && todayCount >= goal && !goalReached) {
      setGoalReached(true);
      playSound('goal', 'classic');
      toast({
        title: `🎯 Target Reached! ${goal.toLocaleString()} emails today!`,
        description: 'Excellent — keep the momentum going!',
      });
    }
    if (validGoal && todayCount < goal) setGoalReached(false);
  }, [todayCount, goal, validGoal, goalReached]);

  // ── Count-Based Interval Alarm Settings ────────────────────────────────────
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [warningBuffer, setWarningBuffer] = useState(() => {
    const val = localStorage.getItem('peakx-alarm-warning-buffer');
    return val !== null ? parseInt(val, 10) : 5;
  });
  const [enableExact, setEnableExact] = useState(() => {
    const val = localStorage.getItem('peakx-alarm-enable-exact');
    return val !== 'false';
  });
  const [followupBuffer, setFollowupBuffer] = useState(() => {
    const val = localStorage.getItem('peakx-alarm-followup-buffer');
    return val !== null ? parseInt(val, 10) : 5;
  });
  const [cooldownSec, setCooldownSec] = useState(() => {
    const val = localStorage.getItem('peakx-alarm-cooldown-sec');
    return val !== null ? parseInt(val, 10) : 10;
  });
  const [alarmTone, setAlarmTone] = useState<'classic' | 'digital' | 'melody'>(() => {
    return (localStorage.getItem('peakx-alarm-tone') as 'classic' | 'digital' | 'melody') || 'classic';
  });

  // Save settings when changed
  useEffect(() => { localStorage.setItem('peakx-alarm-warning-buffer', String(warningBuffer)); }, [warningBuffer]);
  useEffect(() => { localStorage.setItem('peakx-alarm-enable-exact', String(enableExact)); }, [enableExact]);
  useEffect(() => { localStorage.setItem('peakx-alarm-followup-buffer', String(followupBuffer)); }, [followupBuffer]);
  useEffect(() => { localStorage.setItem('peakx-alarm-cooldown-sec', String(cooldownSec)); }, [cooldownSec]);
  useEffect(() => { localStorage.setItem('peakx-alarm-tone', alarmTone); }, [alarmTone]);

  const step = parseInt(intervalStep, 10) || 200;
  const lastFiredWarning = useRef<number>(-1);
  const lastFiredExact = useRef<number>(-1);
  const lastFiredFollowup = useRef<number>(-1);
  const lastChimeTime = useRef<number>(0);

  useEffect(() => {
    if (todayCount === 0) {
      lastFiredWarning.current = -1;
      lastFiredExact.current = -1;
      lastFiredFollowup.current = -1;
      return;
    }

    // Calculate current milestone index & crossed milestone values precisely
    const currentMilestoneIndex = Math.floor(todayCount / step);
    const crossedMilestone = currentMilestoneIndex * step;
    const nextMilestone = (currentMilestoneIndex + 1) * step;

    const now = Date.now();
    const isCooldownActive = now - lastChimeTime.current < cooldownSec * 1000;

    // 1. Warning Trigger (when count enters the warning zone of nextMilestone)
    if (warningBuffer > 0 && todayCount >= nextMilestone - warningBuffer && todayCount < nextMilestone) {
      if (lastFiredWarning.current !== nextMilestone) {
        lastFiredWarning.current = nextMilestone;
        if (!isCooldownActive) {
          playSound('warning', alarmTone);
          lastChimeTime.current = now;
        }
        toast({
          title: `⏰ Pre-Milestone Warning!`,
          description: `Just ${nextMilestone - todayCount} more to reach ${nextMilestone} emails!`,
        });
      }
    }

    // 2. Exact Milestone Trigger (when we reach or cross crossedMilestone)
    if (enableExact && crossedMilestone > 0 && todayCount >= crossedMilestone) {
      if (lastFiredExact.current !== crossedMilestone) {
        lastFiredExact.current = crossedMilestone;
        if (!isCooldownActive) {
          playSound('alarm', alarmTone);
          lastChimeTime.current = now;
        }
        toast({
          title: `🎉 Milestone Reached!`,
          description: `Crossed exactly ${crossedMilestone} emails sent today!`,
        });
      }
    }

    // 3. Followup Trigger (when count enters or crosses the followup zone of crossedMilestone)
    if (followupBuffer > 0 && crossedMilestone > 0 && todayCount >= crossedMilestone + followupBuffer) {
      if (lastFiredFollowup.current !== crossedMilestone) {
        lastFiredFollowup.current = crossedMilestone;
        if (!isCooldownActive) {
          playSound('followup', alarmTone);
          lastChimeTime.current = now;
        }
        toast({
          title: `📈 Milestone Cleared!`,
          description: `Sent ${todayCount - crossedMilestone} after crossing ${crossedMilestone} emails!`,
        });
      }
    }
  }, [todayCount, step, warningBuffer, enableExact, followupBuffer, cooldownSec, alarmTone]);

  const nextAlarm = (Math.floor(todayCount / step) + 1) * step;

  return (
    <div id="goal-alarm-section" className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Target className="h-4 w-4 text-primary animate-pulse" />
          <h3 className="text-sm font-semibold">Goal &amp; Alarm Status</h3>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="ml-auto h-7 px-2 text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/10 hover:bg-muted/30 transition-all duration-200"
          onClick={() => playSound('alarm', alarmTone)}
          title="Test Selected Chime Sound"
        >
          <Volume2 className="h-5 w-5 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Test Sound</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* ── Daily Sending Target ── */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Target className="h-3 w-3" />
            Daily Target Goal
          </label>

          <div className="flex gap-2 items-center">
            <Input
              id="goal-target-input"
              type="number"
              min="1"
              placeholder="e.g. 10000"
              value={goalInput}
              onChange={(e) => { onGoalInputChange(e.target.value); setGoalReached(false); }}
              className="bg-background h-8 text-xs"
            />
            {validGoal && (
              <Badge
                variant="outline"
                className={`text-[10px] shrink-0 h-8 px-2 font-mono ${
                  goalReached
                    ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10'
                    : 'border-primary/30 text-primary'
                }`}
              >
                {goalReached ? '✓' : `${todayCount}/${goal}`}
              </Badge>
            )}
          </div>

          {/* Progress bar */}
          {validGoal && (
            <>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    goalReached ? 'bg-emerald-500' : 'bg-primary'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {goalReached
                  ? `🎉 Target of ${goal.toLocaleString()} reached today!`
                  : `${Math.max(0, goal - todayCount).toLocaleString()} more to reach target`}
              </p>
            </>
          )}
        </div>

        {/* ── Count-Based Interval Alarm ── */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Bell className="h-3 w-3" />
            Milestone Alarm Interval
          </label>

          <div className="space-y-2">
            <select
              value={selectValue}
              onChange={(e) => {
                const val = e.target.value;
                setSelectValue(val);
                if (val !== 'custom') {
                  onIntervalStepChange(val);
                }
              }}
              className="w-full bg-background border border-input rounded-md h-8 px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            >
              <option value="50">50 emails</option>
              <option value="100">100 emails</option>
              <option value="200">200 emails (Default)</option>
              <option value="500">500 emails</option>
              <option value="1000">1000 emails</option>
              <option value="custom">⚙️ Custom Interval...</option>
            </select>

            {selectValue === 'custom' && (
              <div className="relative animate-in slide-in-from-top-1 duration-200">
                <Input
                  id="alarm-interval-input"
                  type="number"
                  min="10"
                  step="10"
                  placeholder="Enter custom interval"
                  value={intervalStep}
                  onChange={(e) => onIntervalStepChange(e.target.value)}
                  className="bg-background h-8 text-xs pr-14"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                  emails
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-tight">
              Sent: <span className="font-semibold text-foreground">{todayCount}</span>. Next alarm chime at:{' '}
              <span className="font-mono font-semibold text-primary">{nextAlarm}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Collapsible Alarm Settings Drawer */}
      <div className="border border-border/85 rounded-lg overflow-hidden bg-muted/10">
        <button
          type="button"
          onClick={() => setIsOptionsOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/20 transition-colors text-xs font-semibold text-foreground"
        >
          <div className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <span>Customize Chimes &amp; Cooldown</span>
          </div>
          {isOptionsOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {isOptionsOpen && (
          <div className="px-3 pb-3.5 pt-2 border-t border-border/40 space-y-3.5 text-[11px] animate-in fade-in duration-100">
            {/* Tone Selector */}
            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground">Chime Sound Signature</label>
              <select
                value={alarmTone}
                onChange={(e) => setAlarmTone(e.target.value as 'classic' | 'digital' | 'melody')}
                className="w-full bg-background border border-border/80 rounded-md h-8 px-1.5 focus:outline-none text-[11px]"
              >
                <option value="classic">🔔 Classic Bell (Ascending Sine)</option>
                <option value="digital">📟 Digital Alert (Triple Square Beeps)</option>
                <option value="melody">🎵 Synthesizer Melody (Ascending Triangle)</option>
              </select>
            </div>

            {/* Warning & Follow-up buffers */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground flex items-center gap-1">
                  Warning Offset
                </label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={warningBuffer}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setWarningBuffer(isNaN(val) ? 0 : val);
                  }}
                  className="bg-background h-7 text-[11px]"
                  title="Chime this many emails BEFORE milestone"
                />
                <p className="text-[9px] text-muted-foreground/80 leading-none">Emails before target</p>
              </div>
              
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground flex items-center gap-1">
                  Follow-up Offset
                </label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={followupBuffer}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setFollowupBuffer(isNaN(val) ? 0 : val);
                  }}
                  className="bg-background h-7 text-[11px]"
                  title="Chime this many emails AFTER milestone"
                />
                <p className="text-[9px] text-muted-foreground/80 leading-none">Emails after target</p>
              </div>
            </div>

            {/* Cooldown and Exact Toggle */}
            <div className="grid grid-cols-2 gap-2.5 pt-1.5">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Alarm Cooldown</label>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={cooldownSec}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setCooldownSec(isNaN(val) ? 1 : val);
                    }}
                    className="bg-background h-7 text-[11px] pr-7"
                    title="Minimum seconds between sound alerts"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground pointer-events-none font-mono">sec</span>
                </div>
              </div>
              
              <div className="flex flex-col justify-end pb-1 select-none">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={enableExact}
                    onChange={(e) => setEnableExact(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                  />
                  <span>Chime Exact Target</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
