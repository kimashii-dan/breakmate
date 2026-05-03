import type { DBSchema } from 'idb';
import type { BreakType, BreakOutcome } from '../types';

export type BadgeConditionType = 'total_breaks' | 'streak_days' | 'first_break';

export interface Settings {
  id: 1;
  reminder_interval_min: number;
  focus_mode_interval_min: number;
  focus_mode_enabled: boolean;
  default_break_type: BreakType;
  chronic_snoozer_flag: boolean;
  onboarding_completed: boolean;
}

export interface BreakRecord {
  id?: number;
  triggered_at: number;
  break_type: BreakType;
  outcome: BreakOutcome;
  snooze_count: number;
  exercise_id: number | null;
  completed_at: number | null;
}

export interface Exercise {
  id?: number;
  name: string;
  type: BreakType;
  duration_seconds: number;
  instructions: string[];
  enabled: boolean;
  sort_order: number;
}

export interface Badge {
  id?: number;
  name: string;
  description: string;
  condition_type: BadgeConditionType;
  condition_value: number;
  icon_key: string;
}

export interface UserBadge {
  id?: number;
  badge_id: number;
  earned_at: number;
}

export interface BreakMateDB extends DBSchema {
  settings: {
    key: number;
    value: Settings;
  };
  break_records: {
    key: number;
    value: BreakRecord;
    indexes: { triggered_at: number };
  };
  exercises: {
    key: number;
    value: Exercise;
    indexes: { type: BreakType };
  };
  badges: {
    key: number;
    value: Badge;
  };
  user_badges: {
    key: number;
    value: UserBadge;
    indexes: { badge_id: number };
  };
}
