import { openDB, type IDBPDatabase } from 'idb';
import type { BreakMateDB } from './types';

let dbPromise: Promise<IDBPDatabase<BreakMateDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<BreakMateDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BreakMateDB>('breakmate', 2, {
      async upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion === 0) {
          // Fresh v2 install — create v2 schema directly
          db.createObjectStore('settings', { keyPath: 'id' });

          const breakStore = db.createObjectStore('break_records', {
            keyPath: 'id',
            autoIncrement: true,
          });
          breakStore.createIndex('triggered_at', 'triggered_at');

          const exerciseStore = db.createObjectStore('exercises', {
            keyPath: 'id',
            autoIncrement: true,
          });
          exerciseStore.createIndex('type', 'type');
          return;
        }

        if (oldVersion < 2) {
          // Upgrade from v1 — drop badge stores, migrate settings and exercises
          const anyDb = db as unknown as IDBDatabase;
          if (anyDb.objectStoreNames.contains('badges')) anyDb.deleteObjectStore('badges');
          if (anyDb.objectStoreNames.contains('user_badges')) anyDb.deleteObjectStore('user_badges');

          const anyTx = transaction as unknown as IDBTransaction;

          // Migrate settings: strip removed fields, add new category flags
          const settingsStore = anyTx.objectStore('settings');
          await new Promise<void>((resolve, reject) => {
            const req = settingsStore.get(1);
            req.onsuccess = () => {
              const s = req.result;
              if (!s) { resolve(); return; }
              const putReq = settingsStore.put({
                id: 1,
                reminder_interval_min: s.reminder_interval_min ?? 60,
                default_break_type: s.default_break_type ?? 'eye',
                onboarding_completed: s.onboarding_completed ?? false,
                eye_exercises_enabled: true,
                full_body_exercises_enabled: true,
              });
              putReq.onsuccess = () => resolve();
              putReq.onerror = () => reject(putReq.error);
            };
            req.onerror = () => reject(req.error);
          });

          // Migrate exercises: add completion_count and skip_count = 0
          const exerciseStore = anyTx.objectStore('exercises');
          await new Promise<void>((resolve, reject) => {
            const req = exerciseStore.getAll();
            req.onsuccess = () => {
              const exercises: any[] = req.result;
              let pending = exercises.length;
              if (pending === 0) { resolve(); return; }
              exercises.forEach((e) => {
                const putReq = exerciseStore.put({ ...e, completion_count: 0, skip_count: 0 });
                putReq.onsuccess = () => { if (--pending === 0) resolve(); };
                putReq.onerror = () => reject(putReq.error);
              });
            };
            req.onerror = () => reject(req.error);
          });
        }
      },
    });
  }
  return dbPromise;
}

export function resetDbForTesting(): void {
  dbPromise = null;
}
