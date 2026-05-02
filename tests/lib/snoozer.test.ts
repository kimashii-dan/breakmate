import { describe, it, expect } from 'vitest';
import { isChronicSnoozer } from '../../src/lib/snoozer';
import type { BreakRecord } from '../../src/db/types';

function makeRecord(snoozeCount: number, outcome: BreakRecord['outcome'] = 'snoozed'): BreakRecord {
  return {
    id: 1,
    triggered_at: Date.now(),
    break_type: 'eye',
    outcome,
    snooze_count: snoozeCount,
    exercise_id: null,
    completed_at: null,
  };
}

describe('isChronicSnoozer', () => {
  it('returns false for empty array', () => {
    expect(isChronicSnoozer([])).toBe(false);
  });

  it('returns false when no records have snooze_count >= 3', () => {
    const records = [makeRecord(2), makeRecord(1), makeRecord(0)];
    expect(isChronicSnoozer(records)).toBe(false);
  });

  it('returns false when exactly 2 records have snooze_count >= 3 (boundary)', () => {
    const records = [makeRecord(3), makeRecord(3), makeRecord(2)];
    expect(isChronicSnoozer(records)).toBe(false);
  });

  it('returns true when exactly 3 records have snooze_count >= 3 (boundary)', () => {
    const records = [makeRecord(3), makeRecord(3), makeRecord(3)];
    expect(isChronicSnoozer(records)).toBe(true);
  });

  it('returns true when more than 3 records have snooze_count >= 3', () => {
    const records = [makeRecord(5), makeRecord(4), makeRecord(3), makeRecord(3)];
    expect(isChronicSnoozer(records)).toBe(true);
  });

  it('snooze_count = 2 is below threshold and does not count', () => {
    const records = [makeRecord(2), makeRecord(2), makeRecord(2), makeRecord(3)];
    expect(isChronicSnoozer(records)).toBe(false);
  });

  it('snooze_count = 3 is exactly at threshold and counts', () => {
    const records = [makeRecord(3), makeRecord(3), makeRecord(3), makeRecord(2)];
    expect(isChronicSnoozer(records)).toBe(true);
  });

  it('outcome field does not affect the result', () => {
    const records = [
      makeRecord(3, 'taken'),
      makeRecord(3, 'dismissed'),
      makeRecord(3, 'snoozed'),
    ];
    expect(isChronicSnoozer(records)).toBe(true);
  });
});
