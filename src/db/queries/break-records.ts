import { getDb } from '../client';
import type { BreakRecord } from '../types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function insert(record: Omit<BreakRecord, 'id'>): Promise<number> {
  const db = await getDb();
  return db.add('break_records', record) as Promise<number>;
}

export async function getWeeklySummary(): Promise<{
  totalTaken: number;
  recentRecords: BreakRecord[];
}> {
  const db = await getDb();
  const since = Date.now() - SEVEN_DAYS_MS;
  const range = IDBKeyRange.lowerBound(since);
  const records = await db.getAllFromIndex('break_records', 'triggered_at', range);
  const totalTaken = records.filter((r) => r.outcome === 'taken').length;
  return { totalTaken, recentRecords: records };
}

export async function getRecentSnoozed(
  days: number,
  minSnoozeCount: number,
): Promise<BreakRecord[]> {
  const db = await getDb();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const range = IDBKeyRange.lowerBound(since);
  const records = await db.getAllFromIndex('break_records', 'triggered_at', range);
  return records.filter((r) => r.snooze_count >= minSnoozeCount);
}
