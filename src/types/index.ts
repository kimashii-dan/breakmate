export type BreakType = 'eye' | 'full_body';
export type BreakOutcome = 'taken' | 'snoozed' | 'dismissed';
export type SnoozeDuration = 5 | 10 | 15;

export type Message =
  | { type: 'HEARTBEAT' }
  | { type: 'GET_STATE' }
  | { type: 'TOGGLE_FOCUS_MODE' }
  | { type: 'SNOOZE'; minutes: SnoozeDuration }
  | { type: 'BREAK_TAKEN'; exerciseId: number }
  | { type: 'BREAK_DISMISSED' }
  | { type: 'SETTINGS_CHANGED' };

export type TimerState = {
  activeSeconds: number;
  focusModeEnabled: boolean;
  reminderIntervalMin: number;
};
