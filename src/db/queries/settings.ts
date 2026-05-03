import { getDb } from '../client';
import type { Settings } from '../types';

export async function get(): Promise<Settings | undefined> {
  const db = await getDb();
  return db.get('settings', 1);
}

export async function update(partial: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const db = await getDb();
  const existing = await db.get('settings', 1);
  if (!existing) return;
  await db.put('settings', { ...existing, ...partial });
}

export async function initDefaults(): Promise<void> {
  const db = await getDb();
  const existing = await db.get('settings', 1);
  if (existing) return;
  const defaults: Settings = {
    id: 1,
    reminder_interval_min: 60,
    focus_mode_interval_min: 90,
    focus_mode_enabled: false,
    default_break_type: 'eye',
    chronic_snoozer_flag: false,
    onboarding_completed: false,
  };
  await db.put('settings', defaults);
}
