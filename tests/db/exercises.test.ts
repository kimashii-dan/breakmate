import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTesting } from '../../src/db/client';
import { getAll, getEnabled, setEnabled, seedDefaults } from '../../src/db/queries/exercises';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTesting();
});

describe('seedDefaults', () => {
  it('inserts 9 exercises (5 eye + 4 full_body) on first call', async () => {
    await seedDefaults();
    const all = await getAll();
    expect(all).toHaveLength(9);
    expect(all.filter((e) => e.type === 'eye')).toHaveLength(5);
    expect(all.filter((e) => e.type === 'full_body')).toHaveLength(4);
  });

  it('is idempotent — second call does not add duplicates', async () => {
    await seedDefaults();
    await seedDefaults();
    const all = await getAll();
    expect(all).toHaveLength(9);
  });
});

describe('getAll', () => {
  it('returns empty array when store is empty', async () => {
    const all = await getAll();
    expect(all).toHaveLength(0);
  });
});

describe('getEnabled', () => {
  it('returns only enabled exercises of the given type', async () => {
    await seedDefaults();
    const eye = await getEnabled('eye');
    expect(eye.length).toBeGreaterThan(0);
    expect(eye.every((e) => e.type === 'eye' && e.enabled)).toBe(true);
  });

  it('excludes disabled exercises', async () => {
    await seedDefaults();
    const all = await getAll();
    const eyeExercise = all.find((e) => e.type === 'eye')!;
    await setEnabled(eyeExercise.id!, false);
    const enabled = await getEnabled('eye');
    expect(enabled.find((e) => e.id === eyeExercise.id)).toBeUndefined();
  });
});

describe('setEnabled', () => {
  it('toggles an exercise enabled state', async () => {
    await seedDefaults();
    const all = await getAll();
    const target = all[0];
    await setEnabled(target.id!, false);
    const updated = await getAll();
    expect(updated.find((e) => e.id === target.id)!.enabled).toBe(false);
    await setEnabled(target.id!, true);
    const restored = await getAll();
    expect(restored.find((e) => e.id === target.id)!.enabled).toBe(true);
  });

  it('does nothing for a non-existent id', async () => {
    await seedDefaults();
    await setEnabled(9999, false);
    const all = await getAll();
    expect(all.every((e) => e.enabled)).toBe(true);
  });
});
