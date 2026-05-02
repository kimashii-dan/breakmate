import { useState, useEffect, useRef } from 'react';
import * as exercisesQueries from '../../db/queries/exercises';
import type { BreakType, Message, SnoozeDuration } from '../../types';
import type { Exercise } from '../../db/types';

type Phase = 'loading' | 'choosing' | 'exercising' | 'done';

const BADGE_LABELS: Record<BreakType, string> = {
  eye: 'Eye Break',
  full_body: 'Full Body Break',
};

const BREAK_DESCRIPTIONS: Record<BreakType, string> = {
  eye: 'Rest your eyes with a short guided exercise',
  full_body: 'Stretch and move with a full-body workout',
};

const SNOOZE_OPTIONS: SnoozeDuration[] = [5, 10, 15];

// --- ExerciseTimer -------------------------------------------------------

interface ExerciseTimerProps {
  exercise: Exercise;
  onComplete: (id: number) => void;
}

function ExerciseTimer({ exercise, onComplete }: ExerciseTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(exercise.duration_seconds);
  const [finished, setFinished] = useState<boolean>(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  const stepCount = exercise.instructions.length;
  const stepDuration = exercise.duration_seconds / stepCount;
  const elapsed = exercise.duration_seconds - secondsLeft;
  const currentStep = Math.min(Math.floor(elapsed / stepDuration), stepCount - 1);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeDisplay =
    mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secondsLeft}s`;

  const progressPct =
    ((exercise.duration_seconds - secondsLeft) / exercise.duration_seconds) * 100;

  function handleDone(): void {
    if (exercise.id === undefined) return;
    onComplete(exercise.id);
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="border-b border-gray-100 px-6 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-teal-600">
          {exercise.type === 'eye' ? 'Eye Break' : 'Full Body Break'}
        </p>
        <h2 className="mt-0.5 text-base font-semibold text-gray-900">{exercise.name}</h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
        <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-teal-400 bg-teal-50">
          <span className="text-3xl font-bold tabular-nums text-teal-700">{timeDisplay}</span>
        </div>

        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-teal-400 transition-all duration-1000"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-6 py-4 text-center">
          <p className="mb-1 text-xs font-medium text-gray-400">
            Step {currentStep + 1} of {stepCount}
          </p>
          <p className="text-sm font-medium text-gray-700">
            {exercise.instructions[currentStep]}
          </p>
        </div>

        {finished && (
          <button
            onClick={handleDone}
            className="w-full rounded-xl bg-teal-500 py-3 text-base font-semibold text-white transition-colors hover:bg-teal-600 active:bg-teal-700"
          >
            {"I'm done! ✓"}
          </button>
        )}
      </div>
    </div>
  );
}

// --- ChoosingPhase -------------------------------------------------------

interface ChoosingPhaseProps {
  breakType: BreakType;
  onStart: () => void;
  onSnooze: (minutes: SnoozeDuration) => void;
  onDismiss: () => void;
}

function ChoosingPhase({ breakType, onStart, onSnooze, onDismiss }: ChoosingPhaseProps) {
  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="flex items-center justify-between px-6 pt-6">
        <span className="inline-flex items-center rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-800">
          {BADGE_LABELS[breakType]}
        </span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
        <h1 className="text-2xl font-bold text-gray-900">Time for a break!</h1>
        <p className="text-center text-sm text-gray-500">{BREAK_DESCRIPTIONS[breakType]}</p>
        <button
          onClick={onStart}
          className="w-full max-w-xs rounded-xl bg-teal-500 py-3 text-base font-semibold text-white transition-colors hover:bg-teal-600 active:bg-teal-700"
        >
          Start Break
        </button>
      </div>

      <div className="border-t border-gray-100 px-6 py-4">
        <p className="mb-2 text-center text-xs font-medium text-gray-400">Snooze for…</p>
        <div className="flex justify-center gap-3">
          {SNOOZE_OPTIONS.map((m) => (
            <button
              key={m}
              onClick={() => onSnooze(m)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-teal-300 hover:text-teal-600"
            >
              {m} min
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- DonePhase -----------------------------------------------------------

function DonePhase() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-white">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-16 w-16 text-teal-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h1 className="text-xl font-bold text-teal-600">Great job!</h1>
      <p className="text-sm text-gray-500">Break complete. Window closing…</p>
    </div>
  );
}

// --- App -----------------------------------------------------------------

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [breakType, setBreakType] = useState<BreakType>('eye');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('type');
    if (t === 'eye' || t === 'full_body') {
      setBreakType(t);
    }
    setPhase('choosing');
  }, []);

  function handleStart(): void {
    void (async (): Promise<void> => {
      const exercises = await exercisesQueries.getEnabled(breakType);
      if (exercises.length === 0) return;
      const exercise = exercises[Math.floor(Math.random() * exercises.length)];
      setSelectedExercise(exercise);
      setPhase('exercising');
    })();
  }

  function handleSnooze(minutes: SnoozeDuration): void {
    void browser.runtime.sendMessage({ type: 'SNOOZE', minutes } satisfies Message);
  }

  function handleDismiss(): void {
    void browser.runtime.sendMessage({ type: 'BREAK_DISMISSED' } satisfies Message);
  }

  function handleDone(exerciseId: number): void {
    void browser.runtime.sendMessage({ type: 'BREAK_TAKEN', exerciseId } satisfies Message);
    setPhase('done');
  }

  if (phase === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-400 border-t-transparent" />
      </div>
    );
  }

  if (phase === 'exercising' && selectedExercise !== null) {
    return <ExerciseTimer exercise={selectedExercise} onComplete={handleDone} />;
  }

  if (phase === 'done') {
    return <DonePhase />;
  }

  return (
    <ChoosingPhase
      breakType={breakType}
      onStart={handleStart}
      onSnooze={handleSnooze}
      onDismiss={handleDismiss}
    />
  );
}
