import * as settingsQueries from '../db/queries/settings';
import * as breakRecordsQueries from '../db/queries/break-records';
import * as badgesQueries from '../db/queries/badges';
import * as exercisesQueries from '../db/queries/exercises';
import { getDb } from '../db/client';
import { calcStreak } from '../lib/streak';
import { isChronicSnoozer } from '../lib/snoozer';
import { shouldTrigger, shouldPause } from '../lib/timer';
import type { BreakType, Message, SnoozeDuration, TimerState } from '../types';
import type { BreakRecord } from '../db/types';

const ALARM_IDLE_CHECK = 'idle-check';
const ALARM_SNOOZE = 'snooze';

interface PendingBreak {
  triggered_at: number;
  break_type: BreakType;
  snooze_count: number;
}

let activeSeconds: number = 0;
let lastHeartbeatAt: number = 0;
let reminderIntervalMin: number = 60;
let focusModeEnabled: boolean = false;
let reminderWindowId: number | null = null;
let pendingBreak: PendingBreak | null = null;

function isMessage(value: unknown): value is Message {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as Record<string, unknown>).type === 'string'
  );
}

async function ensureIdleCheckAlarm(): Promise<void> {
  await browser.alarms.create(ALARM_IDLE_CHECK, { periodInMinutes: 0.5 });
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

async function getAllBreakRecords(): Promise<BreakRecord[]> {
  const db = await getDb();
  return db.getAll('break_records');
}

async function checkAndAwardBadges(): Promise<void> {
  const allRecords = await getAllBreakRecords();
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
  if (shouldPause(lastHeartbeatAt)) return;
  if (shouldTrigger(activeSeconds, reminderIntervalMin) && pendingBreak === null) {
    const s = await settingsQueries.get();
    const breakType: BreakType = s?.default_break_type ?? 'eye';
    pendingBreak = { triggered_at: Date.now(), break_type: breakType, snooze_count: 0 };
    await openReminderWindow(breakType);
  }
}

async function handleSnoozeExpiry(): Promise<void> {
  if (pendingBreak === null) return;
  await openReminderWindow(pendingBreak.break_type);
}

async function handleToggleFocusMode(): Promise<void> {
  const s = await settingsQueries.get();
  if (!s) return;
  const newEnabled = !s.focus_mode_enabled;
  await settingsQueries.update({ focus_mode_enabled: newEnabled });
  focusModeEnabled = newEnabled;
  reminderIntervalMin = newEnabled ? s.focus_mode_interval_min : s.reminder_interval_min;
}

async function handleSnooze(minutes: SnoozeDuration): Promise<void> {
  if (pendingBreak === null) return;
  pendingBreak.snooze_count += 1;
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
  await closeReminderWindow();
  pendingBreak = null;
}

async function handleSettingsChanged(): Promise<void> {
  const s = await settingsQueries.get();
  if (!s) return;
  focusModeEnabled = s.focus_mode_enabled;
  reminderIntervalMin = s.focus_mode_enabled ? s.focus_mode_interval_min : s.reminder_interval_min;
}

function dispatchMessage(
  message: Message,
  sendResponse: (response?: unknown) => void
): boolean | void {
  switch (message.type) {
    case 'HEARTBEAT':
      console.log('heartbeat received', activeSeconds);
      activeSeconds += 5;
      lastHeartbeatAt = Date.now();
      return;

    case 'GET_STATE': {
      const resp: TimerState = { activeSeconds, focusModeEnabled, reminderIntervalMin };
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
  reminderIntervalMin = s.focus_mode_enabled ? s.focus_mode_interval_min : s.reminder_interval_min;
}

async function onInstalled(): Promise<void> {
  await settingsQueries.initDefaults();
  await exercisesQueries.seedDefaults();
  await badgesQueries.seedBadges();
  await loadSettings();
  await ensureIdleCheckAlarm();
}

async function onStartup(): Promise<void> {
  await loadSettings();
  await ensureIdleCheckAlarm();
}

async function init(): Promise<void> {
  await settingsQueries.initDefaults();
  await exercisesQueries.seedDefaults();
  await badgesQueries.seedBadges();
  await loadSettings();
  await ensureIdleCheckAlarm();
}

function registerListeners(): void {
  browser.runtime.onInstalled.addListener(() => void onInstalled());
  browser.runtime.onStartup.addListener(() => void onStartup());
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
