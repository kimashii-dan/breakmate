import { useState, useEffect } from 'react';
import * as settingsQueries from '../../db/queries/settings';
import * as breakRecordsQueries from '../../db/queries/break-records';
import * as badgesQueries from '../../db/queries/badges';
import { calcStreak } from '../../lib/streak';
import { effectiveInterval } from '../../lib/timer';
import { SettingsPanel } from '../../components/SettingsPanel';
import type { Message, TimerState } from '../../types';
import type { Settings, Badge } from '../../db/types';

type LoadStatus = 'loading' | 'error' | 'ready';
type View = 'main' | 'settings';

interface SidebarData {
  timerState: TimerState;
  settings: Settings;
  totalTaken: number;
  streak: number;
  earnedBadges: { badge: Badge; earnedAt: number }[];
  syncedAt: number;
}

const ICON_MAP: Record<string, string> = {
  star: '⭐',
  trophy: '🏆',
  fire: '🔥',
};

function getBadgeIcon(iconKey: string): string {
  return ICON_MAP[iconKey] ?? '🎖️';
}

// --- TimerDisplay --------------------------------------------------------

interface TimerDisplayProps {
  activeSeconds: number;
  isSystemActive: boolean;
  intervalMin: number;
  snoozeEndsAt: number | null;
  snoozeTotalSec: number | null;
  syncedAt: number;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m}m ${s}s`;
}

function TimerDisplay({
  activeSeconds,
  isSystemActive,
  intervalMin,
  snoozeEndsAt,
  snoozeTotalSec,
  syncedAt,
}: TimerDisplayProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (snoozeEndsAt !== null) {
    const snoozeSecondsLeft = Math.max(0, Math.round((snoozeEndsAt - now) / 1000));
    const total = snoozeTotalSec ?? 1;
    const pct = Math.min(((total - snoozeSecondsLeft) / total) * 100, 100);

    return (
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-bm-warning">Break snoozed</p>
          <p className="text-xs text-bm-text-muted">resumes in</p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-bm-warning">
          {formatTime(snoozeSecondsLeft)}
        </p>
        <div className="h-1.5 w-full rounded-full bg-bm-border">
          <div
            className="h-1.5 rounded-full bg-bm-warning transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  const liveActiveSeconds = isSystemActive
    ? activeSeconds + Math.floor((now - syncedAt) / 1000)
    : activeSeconds;
  const intervalSeconds = intervalMin * 60;
  const remainingSeconds = Math.max(intervalSeconds - liveActiveSeconds, 0);
  const pct = Math.min((liveActiveSeconds / intervalSeconds) * 100, 100);
  const isOverdue = liveActiveSeconds >= intervalSeconds;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-bm-text-muted">Next break in</p>
        <p className="text-xs text-bm-text-muted">
          {isSystemActive ? `${formatTime(liveActiveSeconds)} active` : 'paused'}
        </p>
      </div>
      <p
        className={`text-2xl font-bold tabular-nums ${isOverdue ? 'text-bm-warning' : 'text-bm-accent'}`}
      >
        {isOverdue ? 'Break time!' : formatTime(remainingSeconds)}
      </p>
      <div className="h-1.5 w-full rounded-full bg-bm-border">
        <div
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: isOverdue
              ? 'var(--bm-warning)'
              : 'linear-gradient(90deg, var(--bm-accent-muted), var(--bm-accent))',
            boxShadow: isOverdue ? 'none' : '0 0 6px var(--bm-accent)',
          }}
        />
      </div>
    </div>
  );
}

// --- BadgeGrid -----------------------------------------------------------

interface BadgeGridProps {
  earnedBadges: { badge: Badge; earnedAt: number }[];
}

function BadgeGrid({ earnedBadges }: BadgeGridProps) {
  if (earnedBadges.length === 0) {
    return <p className="text-sm text-bm-text-muted">Complete breaks to earn badges.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {earnedBadges.map(({ badge }) => (
        <div
          key={badge.id}
          title={badge.description}
          className="flex flex-col items-center rounded-xl border border-bm-border bg-bm-bg p-2 text-center"
        >
          <span className="text-2xl">{getBadgeIcon(badge.icon_key)}</span>
          <span className="mt-1 text-xs font-medium text-bm-text-secondary leading-tight">
            {badge.name}
          </span>
        </div>
      ))}
    </div>
  );
}

// --- App -----------------------------------------------------------------

async function loadData(): Promise<SidebarData> {
  const [timerStateRaw, s, weekly, earned] = await Promise.all([
    browser.runtime.sendMessage({ type: 'GET_STATE' } satisfies Message),
    settingsQueries.get(),
    breakRecordsQueries.getWeeklySummary(),
    badgesQueries.getEarned(),
  ]);
  if (!s) throw new Error('Settings not found');
  return {
    timerState: timerStateRaw as TimerState,
    settings: s,
    totalTaken: weekly.totalTaken,
    streak: calcStreak(weekly.recentRecords),
    earnedBadges: earned,
    syncedAt: Date.now(),
  };
}

export default function App(): JSX.Element {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [data, setData] = useState<SidebarData | null>(null);
  const [view, setView] = useState<View>('main');

  useEffect(() => {
    void loadData()
      .then((d) => {
        setData(d);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  // Refresh timer state every 30 s — sidebar stays open indefinitely
  useEffect(() => {
    const id = setInterval(() => {
      void browser.runtime
        .sendMessage({ type: 'GET_STATE' } satisfies Message)
        .then((raw) =>
          setData((prev) => (prev ? { ...prev, timerState: raw as TimerState, syncedAt: Date.now() } : prev))
        )
        .catch(() => undefined);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  function handleFocusToggle(): void {
    setData((prev) => {
      if (!prev) return prev;
      const nowEnabled = !prev.settings.focus_mode_enabled;
      return {
        ...prev,
        settings: { ...prev.settings, focus_mode_enabled: nowEnabled },
        timerState: {
          ...prev.timerState,
          focusModeEnabled: nowEnabled,
          reminderIntervalMin: effectiveInterval({ ...prev.settings, focus_mode_enabled: nowEnabled }),
        },
      };
    });
    void browser.runtime.sendMessage({ type: 'TOGGLE_FOCUS_MODE' } satisfies Message);
  }

  if (status === 'loading') {
    return (
      <div className="flex w-full min-h-screen items-center justify-center bg-bm-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-bm-accent border-t-transparent" />
      </div>
    );
  }

  if (status === 'error' || data === null) {
    return (
      <div className="w-full min-h-screen p-4 bg-bm-surface">
        <p className="text-sm text-bm-warning">Failed to load. Please reopen the extension.</p>
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div className="w-full min-h-screen bg-bm-surface flex flex-col">
        <div className="flex items-center gap-2 border-b border-bm-border px-4 py-3 flex-shrink-0">
          <button
            onClick={() => setView('main')}
            aria-label="Back"
            className="rounded-full p-1 text-bm-text-muted transition-colors hover:bg-bm-elevated hover:text-bm-text-secondary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <h2 className="text-sm font-semibold text-bm-text-primary">Settings</h2>
        </div>
        <div className="overflow-y-auto flex-1 scrollbar-hide">
          <SettingsPanel
            onSettingsChange={(patch) =>
              setData((prev) => {
                if (!prev) return prev;
                const newSettings = { ...prev.settings, ...patch };
                return {
                  ...prev,
                  settings: newSettings,
                  timerState: {
                    ...prev.timerState,
                    reminderIntervalMin: effectiveInterval(newSettings),
                  },
                };
              })
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-bm-surface flex flex-col">
      {/* Header */}
      <div className="border-b border-bm-border px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base font-semibold text-bm-text-primary">BreakMate</h1>
          {data.settings.focus_mode_enabled && (
            <span className="rounded-full bg-[var(--bm-accent-subtle)] px-2 py-0.5 text-xs font-medium text-bm-accent">
              Focus Mode
            </span>
          )}
        </div>
        <TimerDisplay
          activeSeconds={data.timerState.activeSeconds}
          isSystemActive={data.timerState.isSystemActive}
          intervalMin={data.timerState.reminderIntervalMin}
          snoozeEndsAt={data.timerState.snoozeEndsAt}
          snoozeTotalSec={data.timerState.snoozeTotalSec}
          syncedAt={data.syncedAt}
        />
      </div>

      <div className="px-4 py-3 space-y-4 flex-1">
        {/* Weekly Stats */}
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-xl border border-bm-border bg-bm-elevated p-3 text-center">
            <p className="text-3xl font-bold text-bm-accent">{data.totalTaken}</p>
            <p className="mt-0.5 text-xs text-bm-text-muted">breaks this week</p>
          </div>
          <div className="flex-1 rounded-xl border border-bm-border bg-bm-elevated p-3 text-center">
            <p className="text-3xl font-bold text-bm-accent">{data.streak}</p>
            <p className="mt-0.5 text-xs text-bm-text-muted">day streak 🔥</p>
          </div>
        </div>

        {/* Chronic Snoozer Banner */}
        {data.settings.chronic_snoozer_flag && (
          <div className="rounded-xl border border-bm-warning bg-[var(--bm-warning-subtle)] px-3 py-3 text-sm text-bm-warning">
            <p className="font-medium">You snooze breaks frequently.</p>
            <p className="mt-0.5 text-xs opacity-80">
              Try increasing your interval or enabling Focus Mode.
            </p>
          </div>
        )}

        {/* Focus Mode Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-bm-text-primary">Focus Mode</p>
            <p className="text-xs text-bm-text-muted">
              Extends interval to {data.settings.focus_mode_interval_min} min
            </p>
          </div>
          <button
            onClick={handleFocusToggle}
            aria-label={
              data.settings.focus_mode_enabled ? 'Disable Focus Mode' : 'Enable Focus Mode'
            }
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              data.settings.focus_mode_enabled ? 'bg-bm-accent' : 'bg-bm-border'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-bm-thumb shadow transition-transform duration-200 ${
                data.settings.focus_mode_enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Badges */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bm-accent">
            Badges
          </p>
          <BadgeGrid earnedBadges={data.earnedBadges} />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-bm-border px-4 py-3">
        <button
          onClick={() => setView('settings')}
          className="w-full text-center text-sm text-bm-accent hover:text-bm-accent-hover transition-colors"
        >
          Open Settings →
        </button>
      </div>
    </div>
  );
}
