import { useState, useEffect, useRef } from 'react';
import * as settingsQueries from '../db/queries/settings';
import * as exercisesQueries from '../db/queries/exercises';
import { getStoredTheme, applyTheme, type Theme } from '../lib/theme';
import type { BreakType, Message } from '../types';
import type { Settings, Exercise } from '../db/types';

export interface SettingsPanelProps {
  onSettingsChange?: (patch: Partial<Settings>) => void;
}

// --- ExerciseRow ---------------------------------------------------------

interface ExerciseRowProps {
  exercise: Exercise;
  onToggle: (id: number, enabled: boolean) => void;
}

function ExerciseRow({ exercise, onToggle }: ExerciseRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-bm-text-primary">{exercise.name}</p>
        <p className="text-xs text-bm-text-muted">{exercise.duration_seconds}s</p>
      </div>
      <button
        onClick={() => exercise.id !== undefined && onToggle(exercise.id, !exercise.enabled)}
        aria-label={exercise.enabled ? 'Disable exercise' : 'Enable exercise'}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
          exercise.enabled ? 'bg-bm-accent' : 'bg-bm-border'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-bm-thumb shadow transition-transform duration-200 ${
            exercise.enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

// --- ExerciseGroup -------------------------------------------------------

interface ExerciseGroupProps {
  title: string;
  exercises: Exercise[];
  onToggle: (id: number, enabled: boolean) => void;
}

function ExerciseGroup({ title, exercises, onToggle }: ExerciseGroupProps) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-bm-text-muted uppercase tracking-wide">{title}</p>
      <div className="divide-y divide-bm-border">
        {exercises.map((e) => (
          <ExerciseRow key={e.id} exercise={e} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}

const THEME_LABELS: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };

// --- SettingsPanel -------------------------------------------------------

export function SettingsPanel({ onSettingsChange }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleThemeChange(t: Theme): void {
    setTheme(t);
    applyTheme(t);
  }

  useEffect(() => {
    void (async (): Promise<void> => {
      const [s, exs] = await Promise.all([settingsQueries.get(), exercisesQueries.getAll()]);
      if (s) setSettings(s);
      setExercises([...exs].sort((a, b) => a.sort_order - b.sort_order));
    })();
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleIntervalChange(value: number): void {
    setSettings((prev) => (prev ? { ...prev, reminder_interval_min: value } : prev));
    onSettingsChange?.({ reminder_interval_min: value });
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void (async (): Promise<void> => {
        await settingsQueries.update({ reminder_interval_min: value });
        await browser.runtime.sendMessage({ type: 'SETTINGS_CHANGED' } satisfies Message);
      })();
    }, 500);
  }

  function handleBreakTypeChange(value: BreakType): void {
    setSettings((prev) => (prev ? { ...prev, default_break_type: value } : prev));
    onSettingsChange?.({ default_break_type: value });
    void (async (): Promise<void> => {
      await settingsQueries.update({ default_break_type: value });
      await browser.runtime.sendMessage({ type: 'SETTINGS_CHANGED' } satisfies Message);
    })();
  }

  function handleExerciseToggle(id: number, enabled: boolean): void {
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, enabled } : e)));
    void exercisesQueries.setEnabled(id, enabled);
  }

  if (!settings) {
    return <p className="px-4 py-4 text-xs text-bm-text-muted">Loading…</p>;
  }

  const eyeExercises = exercises.filter((e) => e.type === 'eye');
  const bodyExercises = exercises.filter((e) => e.type === 'full_body');

  return (
    <div className="divide-y divide-bm-border">
      {/* Appearance */}
      <div className="px-4 py-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-bm-accent">Appearance</p>
        <div className="flex gap-2">
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => handleThemeChange(t)}
              className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                theme === t
                  ? 'border-bm-accent bg-[var(--bm-accent-subtle)] text-bm-accent'
                  : 'border-bm-border text-bm-text-muted hover:border-bm-accent hover:text-bm-accent'
              }`}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Reminder Interval */}
      <div className="px-4 py-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-bm-accent">Reminder Interval</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-bm-text-secondary">Remind me every</p>
            <span className="text-sm font-semibold text-bm-accent">{settings.reminder_interval_min} min</span>
          </div>
          <input
            type="range"
            min={5}
            max={120}
            step={1}
            value={settings.reminder_interval_min}
            onChange={(e) => handleIntervalChange(Number(e.target.value))}
            className="w-full accent-bm-accent"
          />
          <div className="flex justify-between text-xs text-bm-text-muted">
            <span>5 min</span>
            <span>120 min</span>
          </div>
        </div>
      </div>

      {/* Default Break Type */}
      <div className="px-4 py-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-bm-accent">Break Type</p>
        <div className="flex flex-col gap-2">
          {(['eye', 'full_body'] as BreakType[]).map((type) => (
            <label key={type} className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="break-type"
                value={type}
                checked={settings.default_break_type === type}
                onChange={() => handleBreakTypeChange(type)}
                className="accent-bm-accent"
              />
              <div>
                <p className="text-sm font-medium text-bm-text-primary">
                  {type === 'eye' ? 'Eye Break' : 'Full Body Break'}
                </p>
                <p className="text-xs text-bm-text-muted">
                  {type === 'eye' ? '20s guided eye rest' : '3 min stretches & movement'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Focus Mode */}
      <div className="px-4 py-4 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-bm-accent">Focus Mode</p>
        <p className="text-sm text-bm-text-secondary">
          Extends interval to{' '}
          <span className="font-medium text-bm-accent">{settings.focus_mode_interval_min} min</span>{' '}
          for uninterrupted work sessions.
        </p>
        <p className="text-xs text-bm-text-muted">Toggle via the side panel.</p>
      </div>

      {/* Exercise Library */}
      <div className="px-4 py-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-bm-accent">Exercise Library</p>
        <div className="space-y-4">
          {eyeExercises.length > 0 && (
            <ExerciseGroup title="Eye Breaks" exercises={eyeExercises} onToggle={handleExerciseToggle} />
          )}
          {bodyExercises.length > 0 && (
            <ExerciseGroup title="Full Body Breaks" exercises={bodyExercises} onToggle={handleExerciseToggle} />
          )}
        </div>
      </div>
    </div>
  );
}
