import { getDb } from '../client';
import type { Badge, UserBadge } from '../types';

const DEFAULT_BADGES: Omit<Badge, 'id'>[] = [
  {
    name: 'First Step',
    description: 'Completed your very first break.',
    condition_type: 'first_break',
    condition_value: 1,
    icon_key: 'star',
  },
  {
    name: 'Getting Started',
    description: 'Completed 10 breaks.',
    condition_type: 'total_breaks',
    condition_value: 10,
    icon_key: 'trophy',
  },
  {
    name: 'Regular',
    description: 'Completed 25 breaks.',
    condition_type: 'total_breaks',
    condition_value: 25,
    icon_key: 'trophy',
  },
  {
    name: 'Dedicated',
    description: 'Completed 50 breaks.',
    condition_type: 'total_breaks',
    condition_value: 50,
    icon_key: 'trophy',
  },
  {
    name: 'One Week Strong',
    description: 'Maintained a 7-day break streak.',
    condition_type: 'streak_days',
    condition_value: 7,
    icon_key: 'fire',
  },
  {
    name: 'Two Week Champion',
    description: 'Maintained a 14-day break streak.',
    condition_type: 'streak_days',
    condition_value: 14,
    icon_key: 'fire',
  },
];

export async function getAll(): Promise<Badge[]> {
  const db = await getDb();
  return db.getAll('badges');
}

export async function getEarned(): Promise<{ badge: Badge; earnedAt: number }[]> {
  const db = await getDb();
  const userBadges = await db.getAll('user_badges');
  const results = await Promise.all(
    userBadges.map(async (ub: UserBadge) => {
      const badge = await db.get('badges', ub.badge_id);
      return badge ? { badge, earnedAt: ub.earned_at } : null;
    }),
  );
  return results.filter((r): r is { badge: Badge; earnedAt: number } => r !== null);
}

export async function award(badgeId: number): Promise<void> {
  const db = await getDb();
  const existing = await db.getAllFromIndex('user_badges', 'badge_id', badgeId);
  if (existing.length > 0) return;
  await db.add('user_badges', { badge_id: badgeId, earned_at: Date.now() });
}

export async function seedBadges(): Promise<void> {
  const db = await getDb();
  const count = await db.count('badges');
  if (count > 0) return;
  const tx = db.transaction('badges', 'readwrite');
  await Promise.all(DEFAULT_BADGES.map((b) => tx.store.add(b)));
  await tx.done;
}
