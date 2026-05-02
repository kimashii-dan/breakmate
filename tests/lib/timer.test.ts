import { describe, it, expect } from 'vitest';
import { shouldTrigger, shouldPause } from '../../src/lib/timer';

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

describe('shouldPause', () => {
  it('returns false when lastHeartbeatAt is very recent (1ms ago)', () => {
    expect(shouldPause(Date.now() - 1)).toBe(false);
  });

  it('returns false just below 60-second threshold (59999ms ago)', () => {
    expect(shouldPause(Date.now() - 59_999)).toBe(false);
  });

  it('returns true at exact 60-second threshold (60000ms ago)', () => {
    expect(shouldPause(Date.now() - 60_000)).toBe(true);
  });

  it('returns true above threshold (61000ms ago)', () => {
    expect(shouldPause(Date.now() - 61_000)).toBe(true);
  });

  it('returns true when lastHeartbeatAt is 0 (uninitialized)', () => {
    expect(shouldPause(0)).toBe(true);
  });
});
