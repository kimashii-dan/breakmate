import type { BreakRecord } from '../db/types';

export function isChronicSnoozer(recentRecords: BreakRecord[]): boolean {
  return recentRecords.filter((r) => r.snooze_count >= 3).length >= 3;
}
