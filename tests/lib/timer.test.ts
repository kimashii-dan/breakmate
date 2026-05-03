import { describe, it, expect } from 'vitest';
import { shouldTrigger, effectiveInterval } from '../../src/lib/timer';

describe('shouldTrigger', () => {
  it('returns false when activeSeconds is 0', () => {
    expect(shouldTrigger(0, 60)).toBe(false);
  });

  it('returns false just below 60-min threshold (3599s)', () => {
    expect(shouldTrigger(3599, 60)).toBe(false);
  });

  it('returns true at exact 60-min threshold (3600s)', () => {
    expect(shouldTrigger(3600, 60)).toBe(true);
  });

  it('returns true above 60-min threshold (3601s)', () => {
    expect(shouldTrigger(3601, 60)).toBe(true);
  });

  it('works with 30-minute interval', () => {
    expect(shouldTrigger(1799, 30)).toBe(false);
    expect(shouldTrigger(1800, 30)).toBe(true);
  });

  it('works with 90-minute interval (focus mode)', () => {
    expect(shouldTrigger(5399, 90)).toBe(false);
    expect(shouldTrigger(5400, 90)).toBe(true);
  });
});

describe('effectiveInterval', () => {
  const base = { reminder_interval_min: 60, focus_mode_interval_min: 90 };

  it('returns reminder_interval_min when focus mode off', () => {
    expect(effectiveInterval({ ...base, focus_mode_enabled: false })).toBe(60);
  });

  it('returns focus_mode_interval_min when focus mode on', () => {
    expect(effectiveInterval({ ...base, focus_mode_enabled: true })).toBe(90);
  });
});
