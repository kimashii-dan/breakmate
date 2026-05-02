import type { BreakRecord } from '../db/types';

export function calcStreak(breakRecords: BreakRecord[]): number {
  const takenDates = new Set(
    breakRecords
      .filter((r) => r.outcome === 'taken')
      .map((r) => new Date(r.triggered_at).toLocaleDateString('en-CA')),
  );

  let streak = 0;
  const cursor = new Date();
  while (takenDates.has(cursor.toLocaleDateString('en-CA'))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
