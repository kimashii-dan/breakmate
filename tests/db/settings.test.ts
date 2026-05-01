import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTesting } from '../../src/db/client';
import { get, update, initDefaults } from '../../src/db/queries/settings';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTesting();
});

describe('settings.initDefaults', () => {
  it('inserts default settings on first call', async () => {
    await initDefaults();
    const s = await get();
    expect(s).toBeDefined();
    expect(s!.id).toBe(1);
    expect(s!.reminder_interval_min).toBe(60);
    expect(s!.focus_mode_interval_min).toBe(90);
    expect(s!.focus_mode_enabled).toBe(false);
    expect(s!.default_break_type).toBe('eye');
    expect(s!.onboarding_completed).toBe(false);
    expect(s!.chronic_snoozer_flag).toBe(false);
  });

  it('is idempotent — second call does not overwrite', async () => {
    await initDefaults();
    await update({ reminder_interval_min: 45 });
    await initDefaults();
    const s = await get();
    expect(s!.reminder_interval_min).toBe(45);
  });
});

describe('settings.get', () => {
  it('returns undefined when store is empty', async () => {
    const s = await get();
    expect(s).toBeUndefined();
  });
});

describe('settings.update', () => {
  it('merges partial updates without losing other fields', async () => {
    await initDefaults();
    await update({ focus_mode_enabled: true, reminder_interval_min: 90 });
    const s = await get();
    expect(s!.focus_mode_enabled).toBe(true);
    expect(s!.reminder_interval_min).toBe(90);
    expect(s!.default_break_type).toBe('eye');
  });

  it('does nothing when settings have not been initialised', async () => {
    await update({ reminder_interval_min: 30 });
    const s = await get();
    expect(s).toBeUndefined();
  });
});
