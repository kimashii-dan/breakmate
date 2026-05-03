import * as settingsQueries from '../db/queries/settings';
import * as breakRecordsQueries from '../db/queries/break-records';
import * as badgesQueries from '../db/queries/badges';
import * as exercisesQueries from '../db/queries/exercises';
import { getDb } from '../db/client';
import { calcStreak } from '../lib/streak';
import { isChronicSnoozer } from '../lib/snoozer';
import { shouldTrigger, effectiveInterval } from '../lib/timer';
import type { BreakType, Message, SnoozeDuration, TimerState } from '../types';

const ALARM_IDLE_CHECK = 'idle-check';
const ALARM_SNOOZE = 'snooze';
const IDLE_DETECTION_INTERVAL_SECONDS = 60;
const ALARM_PERIOD_SECONDS = 30; // alarm fires every 0.5 min = 30s

interface PendingBreak {
  triggered_at: number;
  break_type: BreakType;
  snooze_count: number;
}

let activeSeconds: number = 0;
let isSystemActive: boolean = true;
let reminderIntervalMin: number = 60;
let focusModeEnabled: boolean = false;
let reminderWindowId: number | null = null;
let pendingBreak: PendingBreak | null = null;
let snoozeEndsAt: number | null = null;
let snoozeTotalSec: number | null = null;

const VALID_MESSAGE_TYPES = new Set<string>([
  'GET_STATE',
  'TOGGLE_FOCUS_MODE',
  'SNOOZE',
  'BREAK_TAKEN',
  'BREAK_DISMISSED',
  'SETTINGS_CHANGED',
]);

function isMessage(value: unknown): value is Message {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as Record<string, unknown>).type === 'string' &&
    VALID_MESSAGE_TYPES.has((value as Record<string, unknown>).type as string)
  );
}

async function ensureIdleCheckAlarm(): Promise<void> {
  await browser.alarms.create(ALARM_IDLE_CHECK, { periodInMinutes: 0.5 });
}

type SidePanel = { setPanelBehavior: (o: { openPanelOnActionClick: boolean }) => Promise<void> };

async function enableSidebarOnClick(): Promise<void> {
  const sp = (globalThis as unknown as { chrome?: { sidePanel?: SidePanel } }).chrome?.sidePanel;
  if (sp) await sp.setPanelBehavior({ openPanelOnActionClick: true });
}

async function openReminderWindow(breakType: BreakType): Promise<void> {
  await closeReminderWindow();
  const url = browser.runtime.getURL('/reminder.html') + `?type=${breakType}`;
  const win = await browser.windows.create({
    url,
    type: 'popup',
    width: 480,
    height: 600,
    focused: true,
  });
  reminderWindowId = win?.id ?? null;
}

async function closeReminderWindow(): Promise<void> {
  if (reminderWindowId === null) return;
  try {
    await browser.windows.remove(reminderWindowId);
  } catch {
    // Window may have been closed by the user
  }
  reminderWindowId = null;
}

async function checkAndAwardBadges(): Promise<void> {
  const allRecords = await (await getDb()).getAll('break_records');
  const allTimeTaken = allRecords.filter((r) => r.outcome === 'taken').length;
  const streak = calcStreak(allRecords);
  const allBadges = await badgesQueries.getAll();
  const earned = await badgesQueries.getEarned();
  const earnedIds = new Set(earned.map((e) => e.badge.id!));

  for (const badge of allBadges) {
    if (badge.id === undefined || earnedIds.has(badge.id)) continue;
    let qualifies = false;
    switch (badge.condition_type) {
      case 'first_break':
        qualifies = allTimeTaken >= 1;
        break;
      case 'total_breaks':
        qualifies = allTimeTaken >= badge.condition_value;
        break;
      case 'streak_days':
        qualifies = streak >= badge.condition_value;
        break;
    }
    if (qualifies) {
      await badgesQueries.award(badge.id);
    }
  }
}

async function updateChronicSnoozerFlag(): Promise<void> {
  const recentSnoozed = await breakRecordsQueries.getRecentSnoozed(7, 3);
  if (isChronicSnoozer(recentSnoozed)) {
    await settingsQueries.update({ chronic_snoozer_flag: true });
  }
}

async function handleIdleCheck(): Promise<void> {
  if (!isSystemActive) return;
  if (pendingBreak !== null) return;

  activeSeconds += ALARM_PERIOD_SECONDS;

  if (shouldTrigger(activeSeconds, reminderIntervalMin)) {
    const s = await settingsQueries.get();
    const breakType: BreakType = s?.default_break_type ?? 'eye';
    pendingBreak = { triggered_at: Date.now(), break_type: breakType, snooze_count: 0 };
    await openReminderWindow(breakType);
  }
}

async function handleSnoozeExpiry(): Promise<void> {
  if (pendingBreak === null) return;
  snoozeEndsAt = null;
  snoozeTotalSec = null;
  await openReminderWindow(pendingBreak.break_type);
}

async function handleToggleFocusMode(): Promise<void> {
  const s = await settingsQueries.get();
  if (!s) return;
  const newEnabled = !s.focus_mode_enabled;
  await settingsQueries.update({ focus_mode_enabled: newEnabled });
  focusModeEnabled = newEnabled;
  reminderIntervalMin = effectiveInterval({ ...s, focus_mode_enabled: newEnabled });
}

async function handleSnooze(minutes: SnoozeDuration): Promise<void> {
  if (pendingBreak === null) return;
  pendingBreak.snooze_count += 1;
  snoozeEndsAt = Date.now() + minutes * 60_000;
  snoozeTotalSec = minutes * 60;
  await browser.alarms.create(ALARM_SNOOZE, { delayInMinutes: minutes });
  await closeReminderWindow();
}

async function handleBreakTaken(exerciseId: number): Promise<void> {
  if (pendingBreak === null) return;
  await breakRecordsQueries.insert({
    triggered_at: pendingBreak.triggered_at,
    break_type: pendingBreak.break_type,
    outcome: 'taken',
    snooze_count: pendingBreak.snooze_count,
    exercise_id: exerciseId,
    completed_at: Date.now(),
  });
  activeSeconds = 0;
  snoozeEndsAt = null;
  snoozeTotalSec = null;
  await closeReminderWindow();
  pendingBreak = null;
  await checkAndAwardBadges();
  await updateChronicSnoozerFlag();
}

async function handleBreakDismissed(): Promise<void> {
  if (pendingBreak === null) return;
  await breakRecordsQueries.insert({
    triggered_at: pendingBreak.triggered_at,
    break_type: pendingBreak.break_type,
    outcome: 'dismissed',
    snooze_count: pendingBreak.snooze_count,
    exercise_id: null,
    completed_at: null,
  });
  activeSeconds = 0;
  snoozeEndsAt = null;
  snoozeTotalSec = null;
  await closeReminderWindow();
  pendingBreak = null;
}

async function handleSettingsChanged(): Promise<void> {
  const s = await settingsQueries.get();
  if (!s) return;
  focusModeEnabled = s.focus_mode_enabled;
  reminderIntervalMin = effectiveInterval(s);
}

function dispatchMessage(
  message: Message,
  sendResponse: (response?: unknown) => void
): boolean | void {
  switch (message.type) {
    case 'GET_STATE': {
      const resp: TimerState = { activeSeconds, isSystemActive, focusModeEnabled, reminderIntervalMin, snoozeEndsAt, snoozeTotalSec };
      sendResponse(resp);
      return;
    }

    case 'TOGGLE_FOCUS_MODE':
      void handleToggleFocusMode();
      return;

    case 'SNOOZE':
      void handleSnooze(message.minutes);
      return;

    case 'BREAK_TAKEN':
      void handleBreakTaken(message.exerciseId);
      return;

    case 'BREAK_DISMISSED':
      void handleBreakDismissed();
      return;

    case 'SETTINGS_CHANGED':
      void handleSettingsChanged();
      return;
  }
}

async function loadSettings(): Promise<void> {
  const s = await settingsQueries.get();
  if (!s) return;
  focusModeEnabled = s.focus_mode_enabled;
  reminderIntervalMin = effectiveInterval(s);
}

function registerIdleListener(): void {
  browser.idle.setDetectionInterval(IDLE_DETECTION_INTERVAL_SECONDS);
  browser.idle.onStateChanged.addListener((newState) => {
    isSystemActive = newState === 'active';
  });
  // Sync initial state so the flag is accurate before the first alarm fires
  void (async (): Promise<void> => {
    const state = await browser.idle.queryState(IDLE_DETECTION_INTERVAL_SECONDS);
    isSystemActive = state === 'active';
  })();
}

async function init(): Promise<void> {
  await settingsQueries.initDefaults();
  await exercisesQueries.seedDefaults();
  await badgesQueries.seedBadges();
  await loadSettings();
  await ensureIdleCheckAlarm();
  await enableSidebarOnClick();
}

function registerListeners(): void {
  registerIdleListener();
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_IDLE_CHECK) {
      void handleIdleCheck();
    } else if (alarm.name === ALARM_SNOOZE) {
      void handleSnoozeExpiry();
    }
  });
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isMessage(message)) return;
    return dispatchMessage(message, sendResponse);
  });
}

export default defineBackground({
  main() {
    registerListeners();
    void init();
  },
});
