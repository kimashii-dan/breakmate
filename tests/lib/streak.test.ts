import { describe, it, expect } from 'vitest';
import { calcStreak } from '../../src/lib/streak';
import type { BreakRecord } from '../../src/db/types';

const DAY = 24 * 60 * 60 * 1000;

function makeRecord(
  daysAgo: number,
  outcome: BreakRecord['outcome'],
): Omit<BreakRecord, 'id'> {
  const triggeredAt = Date.now() - daysAgo * DAY;
  return {
    triggered_at: triggeredAt,
    break_type: 'eye',
    outcome,
    snooze_count: 0,
    exercise_id: null,
    completed_at: outcome === 'taken' ? triggeredAt + 20_000 : null,
  };
}

describe('calcStreak', () => {
  it('returns 0 for empty array', () => {
    expect(calcStreak([])).toBe(0);
  });

  it('returns 0 when no record has outcome=taken', () => {
    const records = [
      makeRecord(0, 'dismissed'),
      makeRecord(1, 'snoozed'),
      makeRecord(2, 'dismissed'),
    ];
    expect(calcStreak(records as BreakRecord[])).toBe(0);
  });

  it('returns 1 when today has one taken record', () => {
    const records = [makeRecord(0, 'taken')];
    expect(calcStreak(records as BreakRecord[])).toBe(1);
  });

  it('returns 2 for taken records on today and yesterday', () => {
    const records = [makeRecord(0, 'taken'), makeRecord(1, 'taken')];
    expect(calcStreak(records as BreakRecord[])).toBe(2);
  });

  it('two taken records on the same day count as one streak day', () => {
    const records = [makeRecord(0, 'taken'), makeRecord(0, 'taken')];
    expect(calcStreak(records as BreakRecord[])).toBe(1);
  });

  it('breaks streak when yesterday is missing', () => {
    const records = [makeRecord(0, 'taken'), makeRecord(2, 'taken')];
    expect(calcStreak(records as BreakRecord[])).toBe(1);
  });

  it('returns 0 when last taken record was yesterday (no taken today)', () => {
    const records = [makeRecord(1, 'taken'), makeRecord(2, 'taken')];
    expect(calcStreak(records as BreakRecord[])).toBe(0);
  });

  it('ignores dismissed and snoozed records in streak count', () => {
    const records = [
      makeRecord(0, 'taken'),
      makeRecord(0, 'dismissed'),
      makeRecord(1, 'taken'),
      makeRecord(1, 'snoozed'),
    ];
    expect(calcStreak(records as BreakRecord[])).toBe(2);
  });

  it('returns 3 for three consecutive days of taken records', () => {
    const records = [
      makeRecord(0, 'taken'),
      makeRecord(1, 'taken'),
      makeRecord(2, 'taken'),
    ];
    expect(calcStreak(records as BreakRecord[])).toBe(3);
  });
});
