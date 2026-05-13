// ── Domain interfaces ──────────────────────────────────────────────────────

interface RankEntry {
  minLevel: number;
  rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  title: string;
}

interface GoalConfig {
  name: string;
  base: number;
  step: number;
  cap: number;
}

type StatKey = 'strength' | 'core' | 'power' | 'endurance';
type StatMap = Record<StatKey, number>;

type ExerciseType = 'reps' | 'time';

interface ExerciseScale {
  base: number;
  step: number;
  cap: number;
}

interface BaseExercise {
  name: string;
  type: ExerciseType;
  cfgIdx?: number;
  scale?: ExerciseScale;
  stat: StatKey;
}

interface Exercise extends BaseExercise {
  step: number;
  min: number;
}

type ChallengeExercise = BaseExercise;

interface Challenge {
  name: string;
  stat: StatKey;
  exercises: ChallengeExercise[];
}

interface SoloState {
  mode: 'solo';
  ex: Exercise;
  sets: number;
  target: number;
  currentSet: number;
  setsCompleted: number;
  reps: number;
  timeLeft: number;
}

interface ChallengeState {
  mode: 'challenge';
  challenge: Challenge;
  rounds: number;
  currentRound: number;
  exIdx: number;
  ex: ChallengeExercise;
  sets: number;
  target: number;
  currentSet: number;
  setsCompleted: number;
  reps: number;
  timeLeft: number;
}

type TrialState = SoloState | ChallengeState;

interface NotificationTime {
  hour: number;
  minute: number;
}

// ── Jest interop ───────────────────────────────────────────────────────────
// Allows `if (typeof module !== 'undefined') { module.exports = ... }`
// and `global.fn = fn` in global-script files to compile under "module": "none".
declare var module: NodeModule | undefined;
// eslint-disable-next-line no-var
declare var global: Record<string, unknown>;
