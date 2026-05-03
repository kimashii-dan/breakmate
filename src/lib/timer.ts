export function shouldTrigger(activeSeconds: number, intervalMin: number): boolean {
  return activeSeconds >= intervalMin * 60;
}

export function effectiveInterval(s: {
  focus_mode_enabled: boolean;
  focus_mode_interval_min: number;
  reminder_interval_min: number;
}): number {
  return s.focus_mode_enabled ? s.focus_mode_interval_min : s.reminder_interval_min;
}
