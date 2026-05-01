import { openDB, type IDBPDatabase } from 'idb';
import type { BreakMateDB } from './types';

let dbPromise: Promise<IDBPDatabase<BreakMateDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<BreakMateDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BreakMateDB>('breakmate', 1, {
      upgrade(db) {
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

        db.createObjectStore('badges', { keyPath: 'id', autoIncrement: true });

        const userBadgeStore = db.createObjectStore('user_badges', {
          keyPath: 'id',
          autoIncrement: true,
        });
        userBadgeStore.createIndex('badge_id', 'badge_id');
      },
    });
  }
  return dbPromise;
}

export function resetDbForTesting(): void {
  dbPromise = null;
}
