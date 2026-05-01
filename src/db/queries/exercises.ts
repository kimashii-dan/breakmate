import { getDb } from '../client';
import type { Exercise } from '../types';
import type { BreakType } from '../../types';

const DEFAULT_EXERCISES: Omit<Exercise, 'id'>[] = [
  {
    name: '20-20-20 Rule',
    type: 'eye',
    duration_seconds: 20,
    instructions: ['Look at an object ~6 m away', 'Hold gaze for 20 seconds'],
    enabled: true,
    sort_order: 1,
  },
  {
    name: 'Eye Rolling',
    type: 'eye',
    duration_seconds: 20,
    instructions: ['Look up, then slowly roll eyes clockwise', 'Repeat counter-clockwise'],
    enabled: true,
    sort_order: 2,
  },
  {
    name: 'Near-Far Focus',
    type: 'eye',
    duration_seconds: 20,
    instructions: [
      'Focus on your thumb 25 cm away',
      'Then focus on a wall object',
      'Alternate 5 times',
    ],
    enabled: true,
    sort_order: 3,
  },
  {
    name: 'Blinking',
    type: 'eye',
    duration_seconds: 20,
    instructions: ['Blink rapidly 20 times', 'Close eyes gently for 5 seconds'],
    enabled: true,
    sort_order: 4,
  },
  {
    name: 'Palming',
    type: 'eye',
    duration_seconds: 20,
    instructions: [
      'Rub palms together until warm',
      'Cup palms over closed eyes',
      'Breathe slowly',
    ],
    enabled: true,
    sort_order: 5,
  },
  {
    name: 'Neck Stretches',
    type: 'full_body',
    duration_seconds: 180,
    instructions: [
      'Tilt ear to shoulder (left then right, 10 s each)',
      'Look left, hold 10 s; look right, hold 10 s',
      'Chin to chest, hold 10 s',
    ],
    enabled: true,
    sort_order: 6,
  },
  {
    name: 'Shoulder Rolls',
    type: 'full_body',
    duration_seconds: 180,
    instructions: [
      'Roll shoulders forward 10 times',
      'Roll shoulders backward 10 times',
      'Reach arms overhead, interlace fingers, stretch up',
    ],
    enabled: true,
    sort_order: 7,
  },
  {
    name: 'Standing Walk',
    type: 'full_body',
    duration_seconds: 180,
    instructions: [
      'Stand up from your desk',
      'Walk around your space at a relaxed pace',
      'Return when timer ends',
    ],
    enabled: true,
    sort_order: 8,
  },
  {
    name: 'Desk Yoga',
    type: 'full_body',
    duration_seconds: 180,
    instructions: [
      'Seated twist: hand on opposite knee, hold 15 s each side',
      'Wrist circles 10× each direction',
      'Forward fold over legs, hold 20 s',
    ],
    enabled: true,
    sort_order: 9,
  },
];

export async function getAll(): Promise<Exercise[]> {
  const db = await getDb();
  return db.getAll('exercises');
}

export async function getEnabled(type: BreakType): Promise<Exercise[]> {
  const db = await getDb();
  const byType = await db.getAllFromIndex('exercises', 'type', type);
  return byType.filter((e) => e.enabled);
}

export async function setEnabled(id: number, enabled: boolean): Promise<void> {
  const db = await getDb();
  const exercise = await db.get('exercises', id);
  if (!exercise) return;
  await db.put('exercises', { ...exercise, enabled });
}

export async function seedDefaults(): Promise<void> {
  const db = await getDb();
  const count = await db.count('exercises');
  if (count > 0) return;
  const tx = db.transaction('exercises', 'readwrite');
  await Promise.all(DEFAULT_EXERCISES.map((e) => tx.store.add(e)));
  await tx.done;
}
