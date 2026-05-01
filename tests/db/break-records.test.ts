import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTesting } from '../../src/db/client';
import { insert, getWeeklySummary, getRecentSnoozed } from '../../src/db/queries/break-records';
import type { BreakRecord } from '../../src/db/types';

const DAY = 24 * 60 * 60 * 1000;

function makeRecord(
  daysAgo: number,
  outcome: BreakRecord['outcome'],
  snoozeCount = 0,
): Omit<BreakRecord, 'id'> {
  return {
    triggered_at: Date.now() - daysAgo * DAY,
    break_type: 'eye',
    outcome,
    snooze_count: snoozeCount,
    exercise_id: null,
    completed_at: outcome === 'taken' ? Date.now() - daysAgo * DAY + 20_000 : null,
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTesting();
});

describe('insert', () => {
  it('returns a numeric id', async () => {
    const id = await insert(makeRecord(0, 'taken'));
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });
});

describe('getWeeklySummary', () => {
  it('returns 0 totalTaken and empty records when store is empty', async () => {
    const { totalTaken, recentRecords } = await getWeeklySummary();
    expect(totalTaken).toBe(0);
    expect(recentRecords).toHaveLength(0);
  });

  it('counts only taken outcomes within last 7 days', async () => {
    await insert(makeRecord(1, 'taken'));
    await insert(makeRecord(2, 'taken'));
    await insert(makeRecord(3, 'snoozed'));
    await insert(makeRecord(3, 'dismissed'));
    const { totalTaken, recentRecords } = await getWeeklySummary();
    expect(totalTaken).toBe(2);
    expect(recentRecords).toHaveLength(4);
  });

  it('excludes records older than 7 days', async () => {
    await insert(makeRecord(8, 'taken'));
    await insert(makeRecord(1, 'taken'));
    const { totalTaken } = await getWeeklySummary();
    expect(totalTaken).toBe(1);
  });
});

describe('getRecentSnoozed', () => {
  it('returns empty array when no records match', async () => {
    const result = await getRecentSnoozed(7, 3);
    expect(result).toHaveLength(0);
  });

  it('returns records with snooze_count >= minSnoozeCount', async () => {
    await insert(makeRecord(1, 'snoozed', 3));
    await insert(makeRecord(2, 'snoozed', 4));
    await insert(makeRecord(3, 'snoozed', 2));
    const result = await getRecentSnoozed(7, 3);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.snooze_count >= 3)).toBe(true);
  });

  it('excludes records outside the day window', async () => {
    await insert(makeRecord(10, 'snoozed', 5));
    await insert(makeRecord(1, 'snoozed', 5));
    const result = await getRecentSnoozed(7, 3);
    expect(result).toHaveLength(1);
  });
});
