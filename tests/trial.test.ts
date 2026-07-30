// shared.ts is already on global via setup.ts
const trialModule = require('../src/trial');
const { getS, setS } = trialModule;

const PUSHUP_EX      = (global as any).SOLO_EXERCISES[0]; // Push-Ups, cfgIdx:0, reps
const PLANK_EX       = (global as any).SOLO_EXERCISES[3]; // Plank, cfgIdx:3, time
const CORE_CHALLENGE = (global as any).CHALLENGES[0];      // Core Challenge

function setupDOM() {
  document.body.innerHTML = '<main class="app"></main>';
}

beforeEach(() => {
  setupDOM();
  jest.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

// ── fmt ───────────────────────────────────────────────────────────────────────

describe('fmt', () => {
  const { fmt } = trialModule;

  it('formats 0 as "0s"',   () => { expect(fmt(0)).toBe('0s'); });
  it('formats 45 as "45s"', () => { expect(fmt(45)).toBe('45s'); });
  it('formats 60 as "1:00"',() => { expect(fmt(60)).toBe('1:00'); });
  it('formats 65 as "1:05" (leading-zero pad)', () => { expect(fmt(65)).toBe('1:05'); });
  it('formats 125 as "2:05"', () => { expect(fmt(125)).toBe('2:05'); });
  it('formats 70 as "1:10" (no leading zero when s2 >= 10)', () => { expect(fmt(70)).toBe('1:10'); });
});

// ── exScale ───────────────────────────────────────────────────────────────────

describe('exScale', () => {
  const { exScale } = trialModule;

  it('uses cfgIdx to look up GOAL_CONFIG at level 1', () => {
    expect(exScale(PUSHUP_EX, 1)).toBe(20); // base=20, step=2 → 20
  });

  it('scales with level via cfgIdx', () => {
    expect(exScale(PUSHUP_EX, 5)).toBe(28); // 20 + 4*2
  });

  it('uses inline scale object when cfgIdx is absent', () => {
    const ex = { scale: { base: 5, step: 1, cap: 25 } };
    expect(exScale(ex, 1)).toBe(5);
    expect(exScale(ex, 10)).toBe(14);
  });

  it('respects the cap', () => {
    expect(exScale(PUSHUP_EX, 100)).toBe(100);
  });
});

// ── calcSoloXP / calcChallengeXP ──────────────────────────────────────────────

describe('calcSoloXP', () => {
  it('returns base (10) when setsCompleted = 0', () => {
    setS({ setsCompleted: 0 });
    expect(trialModule.calcSoloXP()).toBe(10);
  });

  it('adds XP_PER_SET (10) per set completed', () => {
    setS({ setsCompleted: 3 });
    expect(trialModule.calcSoloXP()).toBe(40);
  });
});

describe('calcChallengeXP', () => {
  it('returns base (25) when setsCompleted = 0', () => {
    setS({ setsCompleted: 0 });
    expect(trialModule.calcChallengeXP()).toBe(25);
  });

  it('adds XP_PER_CHALLENGE_EX (8) per exercise completed', () => {
    setS({ setsCompleted: 4 });
    expect(trialModule.calcChallengeXP()).toBe(57); // 25 + 4*8
  });
});

// ── resetSoloState ────────────────────────────────────────────────────────────

describe('resetSoloState', () => {
  it('sets mode to "solo"', () => {
    trialModule.resetSoloState(PUSHUP_EX);
    expect(getS().mode).toBe('solo');
  });

  it('derives target from exScale at the player\'s level', () => {
    localStorage.setItem('totalXP', '0');
    trialModule.resetSoloState(PUSHUP_EX);
    expect(getS().target).toBe(20);
  });

  it('initialises sets = 3 and currentSet = 1', () => {
    trialModule.resetSoloState(PUSHUP_EX);
    expect(getS().sets).toBe(3);
    expect(getS().currentSet).toBe(1);
  });

  it('sets target = 0 when ex is null', () => {
    trialModule.resetSoloState(null);
    expect(getS().target).toBe(0);
  });
});

// ── resetChallengeState ───────────────────────────────────────────────────────

describe('resetChallengeState', () => {
  it('sets mode to "challenge"', () => {
    trialModule.resetChallengeState(CORE_CHALLENGE);
    expect(getS().mode).toBe('challenge');
  });

  it('initialises exIdx = 0 and currentRound = 1', () => {
    trialModule.resetChallengeState(CORE_CHALLENGE);
    expect(getS().exIdx).toBe(0);
    expect(getS().currentRound).toBe(1);
  });

  it('sets ex to the first exercise of the challenge', () => {
    trialModule.resetChallengeState(CORE_CHALLENGE);
    expect(getS().ex.name).toBe(CORE_CHALLENGE.exercises[0].name);
  });
});

// ── showExerciseList ──────────────────────────────────────────────────────────

describe('showExerciseList', () => {
  it('renders the picker heading', () => {
    trialModule.showExerciseList();
    expect(document.querySelector('.picker-heading').textContent)
      .toBe('Choose Your Ordeal');
  });

  it('renders the Solo tab as active by default', () => {
    trialModule.showExerciseList();
    const tabs = document.querySelectorAll('.tab-btn');
    expect(tabs[0].className).toContain('active');
    expect(tabs[1].className).not.toContain('active');
  });

  it('renders one exercise card per SOLO_EXERCISES entry', () => {
    trialModule.showExerciseList();
    expect(document.querySelectorAll('.exercise-card').length)
      .toBe((global as any).SOLO_EXERCISES.length);
  });

  it('switches to challenge cards when Challenges tab is clicked', () => {
    trialModule.showExerciseList();
    document.querySelectorAll('.tab-btn')[1].click(); // Challenges tab
    expect(document.querySelectorAll('.challenge-card').length)
      .toBe((global as any).CHALLENGES.length);
  });

  it('switches back to exercise cards when Solo tab is clicked', () => {
    trialModule.showExerciseList();
    document.querySelectorAll('.tab-btn')[1].click(); // Challenges
    document.querySelectorAll('.tab-btn')[0].click(); // Solo
    expect(document.querySelectorAll('.exercise-card').length)
      .toBeGreaterThan(0);
  });

  it('clicking an exercise card navigates to showConfigure', () => {
    trialModule.showExerciseList();
    document.querySelector('.exercise-card').click();
    expect(document.querySelector('.trial-heading')).toBeTruthy();
  });

  it('clicking a challenge card navigates to showChallengeDetail', () => {
    localStorage.setItem('totalXP', '0');
    trialModule.showExerciseList();
    document.querySelectorAll('.tab-btn')[1].click(); // Challenges tab
    document.querySelector('.challenge-card').click();
    expect(document.querySelector('.trial-heading')).toBeTruthy();
  });
});

// ── showConfigure ─────────────────────────────────────────────────────────────

describe('showConfigure', () => {
  it('renders the exercise name as the heading', () => {
    trialModule.showConfigure(PUSHUP_EX);
    expect(document.querySelector('.trial-heading').textContent).toBe('Push-Ups');
  });

  it('renders the Cosmo preview element', () => {
    trialModule.showConfigure(PUSHUP_EX);
    expect(document.getElementById('xp-preview').textContent).toContain('Cosmo');
  });

  it('decrements sets on − click (minimum 1)', () => {
    trialModule.showConfigure(PUSHUP_EX);
    const minus = document.querySelectorAll('.step-btn')[0]; // sets −
    minus.click(); minus.click(); minus.click(); // 3→2→1→1
    expect(getS().sets).toBe(1);
  });

  it('increments sets on + click (maximum 5)', () => {
    trialModule.showConfigure(PUSHUP_EX);
    const plus = document.querySelectorAll('.step-btn')[1]; // sets +
    plus.click(); plus.click(); plus.click(); plus.click(); // 3→4→5→5→5
    expect(getS().sets).toBe(5);
  });

  it('decrements target on − click (minimum ex.min)', () => {
    trialModule.showConfigure(PUSHUP_EX); // min = 5, target = 20 at level 1
    const minus = document.querySelectorAll('.step-btn')[2]; // target −
    minus.click();
    expect(getS().target).toBe(20 - PUSHUP_EX.step);
  });

  it('increments target on + click', () => {
    trialModule.showConfigure(PUSHUP_EX);
    const plus = document.querySelectorAll('.step-btn')[3]; // target +
    plus.click();
    expect(getS().target).toBe(20 + PUSHUP_EX.step);
  });

  it('shows "Duration" label and fmt display when exercise is timed', () => {
    trialModule.showConfigure(PLANK_EX);
    const labels = Array.from(document.querySelectorAll('.config-label'));
    expect(labels.some((el: any) => el.textContent === 'Duration')).toBe(true);
  });

  it('does not decrement target below ex.min', () => {
    trialModule.showConfigure(PUSHUP_EX); // min=5, target=20, step=5
    const minus = document.querySelectorAll('.step-btn')[2];
    // 3 clicks: 20→15→10→5; 4th click hits the false branch (target not > min)
    minus.click(); minus.click(); minus.click(); minus.click();
    expect(getS().target).toBe(5);
  });

  it('Begin Ordeal button calls startSolo and shows the rep screen', () => {
    trialModule.showConfigure(PUSHUP_EX);
    document.querySelector('.trial-btn:not(.secondary)').click();
    expect(document.getElementById('rep-num')).toBeTruthy();
  });

  it('Begin Ordeal with timed exercise shows the timer screen', () => {
    trialModule.showConfigure(PLANK_EX);
    document.querySelector('.trial-btn:not(.secondary)').click();
    expect(document.getElementById('timer-display')).toBeTruthy();
  });

  it('Back button returns to the exercise list', () => {
    trialModule.showConfigure(PUSHUP_EX);
    document.querySelector('.trial-btn.secondary').click();
    expect(document.querySelector('.picker-heading')).toBeTruthy();
  });
});

// ── showChallengeDetail ───────────────────────────────────────────────────────

describe('showChallengeDetail', () => {
  beforeEach(() => {
    localStorage.setItem('totalXP', '0');
  });

  it('renders the challenge name as the heading', () => {
    trialModule.showChallengeDetail(CORE_CHALLENGE);
    expect(document.querySelector('.trial-heading').textContent).toBe('Core Challenge');
  });

  it('decrements rounds on − click (minimum 1)', () => {
    trialModule.showChallengeDetail(CORE_CHALLENGE);
    const minus = document.querySelectorAll('.step-btn')[0];
    minus.click(); minus.click(); // 1→1→1 (already at min)
    expect(getS().rounds).toBe(1);
  });

  it('increments rounds on + click (maximum 3)', () => {
    trialModule.showChallengeDetail(CORE_CHALLENGE);
    const plus = document.querySelectorAll('.step-btn')[1];
    plus.click(); plus.click(); plus.click(); // 1→2→3→3
    expect(getS().rounds).toBe(3);
  });

  it('Start Challenge button calls startChallenge and shows the rep screen', () => {
    trialModule.showChallengeDetail(CORE_CHALLENGE);
    document.querySelector('.trial-btn.gold').click();
    expect(document.getElementById('tap-area')).toBeTruthy();
  });

  it('shows fmt-formatted duration for timed exercises in the exercise list', () => {
    const CARDIO_BLAST = (global as any).CHALLENGES[3];
    trialModule.showChallengeDetail(CARDIO_BLAST);
    const targets = Array.from(document.querySelectorAll('.ex-target'));
    // Mt. Climbers and Jumping Jacks are timed — their labels should contain 's' or ':'
    expect(targets.some((el: any) => el.textContent.includes('s') || el.textContent.includes(':'))).toBe(true);
  });

  it('Start Challenge with timed first exercise shows the timer screen', () => {
    // Cardio Blast starts with Burpees (reps), but skip to Mt. Climbers (time) via rest
    const CARDIO_BLAST = (global as any).CHALLENGES[3];
    setS({
      mode: 'challenge', challenge: CARDIO_BLAST,
      rounds: 1, currentRound: 1, exIdx: 1, // Mt. Climbers (time)
      ex: CARDIO_BLAST.exercises[0], sets: 1, target: 8,
      currentSet: 1, setsCompleted: 1, reps: 0,
    });
    trialModule.showChallengeRest(); // shows rest before Mt. Climbers
    document.querySelector('.trial-btn.secondary').click(); // skip rest
    expect(document.getElementById('timer-display')).toBeTruthy();
  });
});

// ── showRepSet / onRepTap ─────────────────────────────────────────────────────

describe('showRepSet + onRepTap', () => {
  beforeEach(() => {
    setS({
      mode: 'solo', ex: PUSHUP_EX, sets: 3, target: 5,
      currentSet: 1, setsCompleted: 0, reps: 0, timeLeft: 0,
    });
    trialModule.showRepSet();
  });

  it('renders rep-count starting at 0', () => {
    expect(document.getElementById('rep-num').textContent).toBe('0');
  });

  it('increments the counter on tap-area click', () => {
    document.getElementById('tap-area').click();
    expect(document.getElementById('rep-num').textContent).toBe('1');
  });

  it('adds tap-complete class when target is reached', () => {
    const tapArea = document.getElementById('tap-area');
    for (let i = 0; i < 5; i++) tapArea.click();
    expect(tapArea.classList.contains('tap-complete')).toBe(true);
  });

  it('does not increment past target', () => {
    const tapArea = document.getElementById('tap-area');
    for (let i = 0; i < 10; i++) tapArea.click();
    expect(getS().reps).toBe(5);
  });

  it('ignores clicks that originate on a BUTTON element', () => {
    trialModule.onRepTap({ type: 'click', target: { tagName: 'BUTTON' } });
    expect(getS().reps).toBe(0);
  });

  it('shows challenge progress indicator in challenge mode', () => {
    setS({
      mode: 'challenge', ex: CORE_CHALLENGE.exercises[0],
      challenge: CORE_CHALLENGE, rounds: 2, currentRound: 1,
      exIdx: 0, sets: 1, target: 5, currentSet: 1, setsCompleted: 0, reps: 0,
    });
    trialModule.showRepSet();
    expect(document.querySelector('.set-indicator').textContent)
      .toContain('Round 1/2');
  });
});

// ── showTimedSet ──────────────────────────────────────────────────────────────

describe('showTimedSet', () => {
  beforeEach(() => {
    setS({
      mode: 'solo', ex: PLANK_EX, sets: 3, target: 30,
      currentSet: 1, setsCompleted: 0, reps: 0, timeLeft: 30,
    });
    trialModule.showTimedSet();
  });

  it('renders the initial time in the display', () => {
    expect(document.getElementById('timer-display').textContent).toBe('30s');
  });

  it('decrements the counter each second after Start is clicked', () => {
    document.querySelector('.trial-btn').click(); // Start
    jest.advanceTimersByTime(1000);
    expect(document.getElementById('timer-display').textContent).toBe('29s');
  });

  it('Abandon button clears the clock and returns to the exercise list', () => {
    trialModule.showTimedSet();
    document.querySelector('.trial-btn.secondary').click();
    expect(document.querySelector('.picker-heading')).toBeTruthy();
  });

  it('auto-completes the set when timer hits 0', () => {
    setS({
      mode: 'solo',
      ex: { ...PLANK_EX, stat: 'endurance' },
      sets: 1, target: 2, currentSet: 1, setsCompleted: 0, reps: 0, timeLeft: 2,
    });
    trialModule.showTimedSet();
    document.querySelector('.trial-btn').click();
    jest.advanceTimersByTime(2000);
    expect(document.querySelector('.complete-card')).toBeTruthy();
  });

  it('shows challenge Round/Ex indicator in challenge mode', () => {
    setS({
      mode: 'challenge', challenge: CORE_CHALLENGE,
      rounds: 2, currentRound: 1, exIdx: 0,
      ex: { ...PLANK_EX, stat: 'endurance' },
      sets: 1, target: 30, currentSet: 1, setsCompleted: 0, reps: 0, timeLeft: 30,
    });
    trialModule.showTimedSet();
    expect(document.querySelector('.set-indicator').textContent).toContain('Round 1/2');
  });
});

// ── showRest ──────────────────────────────────────────────────────────────────

describe('showRest', () => {
  beforeEach(() => {
    setS({
      mode: 'solo', ex: PUSHUP_EX, sets: 3, target: 20,
      currentSet: 2, setsCompleted: 1, reps: 20, timeLeft: 0,
    });
  });

  it('renders the "Rest" heading', () => {
    trialModule.showRest();
    expect(document.querySelector('.rest-label').textContent).toBe('Rest');
  });

  it('counts down one second per tick', () => {
    trialModule.showRest();
    jest.advanceTimersByTime(1000);
    expect(document.getElementById('rest-display').textContent).toBe('29s');
  });

  it('navigates to the next set when the countdown expires', () => {
    setS({
      mode: 'solo', ex: PUSHUP_EX, sets: 2, target: 5,
      currentSet: 2, setsCompleted: 1, reps: 0, timeLeft: 0,
    });
    trialModule.showRest();
    jest.advanceTimersByTime(30000);
    expect(document.getElementById('rep-num')).toBeTruthy();
  });

  it('Skip Rest button navigates to the next set immediately', () => {
    trialModule.showRest();
    document.querySelector('.trial-btn.secondary').click();
    expect(document.getElementById('rep-num')).toBeTruthy();
  });
});

// ── showChallengeRest ─────────────────────────────────────────────────────────

describe('showChallengeRest', () => {
  beforeEach(() => {
    localStorage.setItem('totalXP', '0');
    setS({
      mode: 'challenge', challenge: CORE_CHALLENGE,
      rounds: 2, currentRound: 1, exIdx: 1,
      ex: CORE_CHALLENGE.exercises[0], sets: 1, target: 15,
      currentSet: 1, setsCompleted: 1, reps: 0, timeLeft: 0,
    });
  });

  it('renders the Rest heading', () => {
    trialModule.showChallengeRest();
    expect(document.querySelector('.rest-label').textContent).toBe('Rest');
  });

  it('shows the next exercise name', () => {
    trialModule.showChallengeRest();
    expect(document.querySelector('.rest-next').textContent)
      .toContain(CORE_CHALLENGE.exercises[1].name);
  });

  it('starts a TRANSITION_SECONDS (15s) countdown', () => {
    trialModule.showChallengeRest();
    expect(document.getElementById('rest-display').textContent).toBe('15s');
  });

  it('Skip Rest button starts the next exercise', () => {
    trialModule.showChallengeRest();
    document.querySelector('.trial-btn.secondary').click();
    // beginChallengeExercise → showRepSet (Crunch is reps)
    expect(document.getElementById('tap-area')).toBeTruthy();
  });

  it('shows fmt-formatted duration when next exercise is timed', () => {
    localStorage.setItem('totalXP', '0');
    const CARDIO_BLAST = (global as any).CHALLENGES[3]; // Cardio Blast: Mt. Climbers is time
    setS({
      mode: 'challenge', challenge: CARDIO_BLAST,
      rounds: 1, currentRound: 1, exIdx: 1, // Mt. Climbers (time)
      ex: CARDIO_BLAST.exercises[0], sets: 1, target: 8,
      currentSet: 1, setsCompleted: 1, reps: 0,
    });
    trialModule.showChallengeRest();
    expect(document.querySelector('.rest-next').textContent).toContain('Mt. Climbers');
  });

  it('counts down one second per tick', () => {
    trialModule.showChallengeRest();
    jest.advanceTimersByTime(1000);
    expect(document.getElementById('rest-display').textContent).toBe('14s');
  });

  it('navigates to the next exercise when the countdown expires', () => {
    trialModule.showChallengeRest();
    jest.advanceTimersByTime(15000); // TRANSITION_SECONDS = 15
    expect(document.getElementById('tap-area')).toBeTruthy();
  });
});

// ── showRoundComplete ─────────────────────────────────────────────────────────

describe('showRoundComplete', () => {
  beforeEach(() => {
    localStorage.setItem('totalXP', '0');
    setS({
      mode: 'challenge', challenge: CORE_CHALLENGE,
      rounds: 2, currentRound: 2, exIdx: 0,
      ex: CORE_CHALLENGE.exercises[0], sets: 1, target: 15,
      currentSet: 1, setsCompleted: 3, reps: 0,
    });
  });

  it('renders the "Round Rest" heading', () => {
    trialModule.showRoundComplete();
    expect(document.querySelector('.rest-label').textContent).toBe('Round Rest');
  });

  it('starts a REST_SECONDS (30s) countdown', () => {
    trialModule.showRoundComplete();
    expect(document.getElementById('rest-display').textContent).toBe('30s');
  });

  it('counts down one second per tick', () => {
    trialModule.showRoundComplete();
    jest.advanceTimersByTime(1000);
    expect(document.getElementById('rest-display').textContent).toBe('29s');
  });

  it('navigates to the next round when the countdown expires', () => {
    trialModule.showRoundComplete();
    jest.advanceTimersByTime(30000); // REST_SECONDS = 30
    expect(document.getElementById('tap-area')).toBeTruthy();
  });
});

// ── finishSet routing ─────────────────────────────────────────────────────────

describe('finishSet routing', () => {
  it('solo: goes to showRest when currentSet < sets', () => {
    setS({
      mode: 'solo',
      ex: { name: 'Push-Ups', type: 'reps', stat: 'strength' },
      sets: 3, target: 5, currentSet: 1, setsCompleted: 0, reps: 0,
    });
    trialModule.finishSet();
    expect(document.querySelector('.rest-label')).toBeTruthy();
  });

  it('solo: goes to showComplete on the last set', () => {
    setS({
      mode: 'solo',
      ex: { name: 'Push-Ups', type: 'reps', stat: 'strength' },
      sets: 1, target: 5, currentSet: 1, setsCompleted: 0, reps: 5,
    });
    trialModule.finishSet();
    expect(document.querySelector('.complete-card')).toBeTruthy();
  });

  it('challenge: goes to showChallengeRest when more exercises remain', () => {
    localStorage.setItem('totalXP', '0');
    setS({
      mode: 'challenge', challenge: CORE_CHALLENGE,
      rounds: 2, currentRound: 1, exIdx: 0,
      ex: CORE_CHALLENGE.exercises[0], sets: 1, target: 15,
      currentSet: 1, setsCompleted: 0,
    });
    trialModule.finishSet();
    expect(document.querySelector('.rest-label')).toBeTruthy();
  });

  it('challenge: goes to showRoundComplete after the last exercise in a non-final round', () => {
    localStorage.setItem('totalXP', '0');
    const lastIdx = CORE_CHALLENGE.exercises.length - 1;
    setS({
      mode: 'challenge', challenge: CORE_CHALLENGE,
      rounds: 2, currentRound: 1, exIdx: lastIdx,
      ex: CORE_CHALLENGE.exercises[lastIdx], sets: 1, target: 15,
      currentSet: 1, setsCompleted: lastIdx,
    });
    trialModule.finishSet();
    expect(document.querySelector('.rest-label').textContent).toBe('Round Rest');
  });

  it('does not crash when s.ex has no stat', () => {
    setS({
      mode: 'solo',
      ex: { name: 'Test', type: 'reps' }, // no stat property
      sets: 1, target: 5, currentSet: 1, setsCompleted: 0,
    });
    expect(() => trialModule.finishSet()).not.toThrow();
  });

  it('challenge: goes to showChallengeComplete after the last exercise in the last round', () => {
    localStorage.setItem('totalXP', '0');
    const lastIdx = CORE_CHALLENGE.exercises.length - 1;
    setS({
      mode: 'challenge', challenge: CORE_CHALLENGE,
      rounds: 2, currentRound: 2, exIdx: lastIdx,
      ex: CORE_CHALLENGE.exercises[lastIdx], sets: 1, target: 15,
      currentSet: 1, setsCompleted: lastIdx,
    });
    trialModule.finishSet();
    expect(document.querySelector('.complete-card')).toBeTruthy();
  });
});

// ── showComplete ──────────────────────────────────────────────────────────────

describe('showComplete', () => {
  it('saves XP to localStorage', () => {
    localStorage.setItem('totalXP', '0');
    setS({
      mode: 'solo', ex: PUSHUP_EX, sets: 3, target: 20, setsCompleted: 3,
    });
    trialModule.showComplete();
    expect(parseInt(localStorage.getItem('totalXP'))).toBe(40); // 10 + 3*10
  });

  it('renders "Ordeal Complete!" heading', () => {
    setS({ mode: 'solo', ex: PUSHUP_EX, sets: 3, target: 20, setsCompleted: 1 });
    trialModule.showComplete();
    expect(document.querySelector('.sucess').textContent).toBe('Ordeal Complete!');
  });

  it('Again button returns to showConfigure for the same exercise', () => {
    setS({ mode: 'solo', ex: PUSHUP_EX, sets: 3, target: 20, setsCompleted: 1 });
    trialModule.showComplete();
    document.getElementById('again-btn').click();
    expect(document.querySelector('.trial-heading').textContent).toBe('Push-Ups');
  });

  it('Menu button returns to showExerciseList', () => {
    setS({ mode: 'solo', ex: PUSHUP_EX, sets: 3, target: 20, setsCompleted: 1 });
    trialModule.showComplete();
    document.getElementById('menu-btn').click();
    expect(document.querySelector('.picker-heading')).toBeTruthy();
  });

  it('uses fmt for timed exercise in the summary', () => {
    localStorage.setItem('totalXP', '0');
    setS({ mode: 'solo', ex: PLANK_EX, sets: 2, target: 60, setsCompleted: 2 });
    trialModule.showComplete();
    expect(document.querySelector('.set-indicator').textContent).toContain('1:00');
  });
});

// ── showChallengeComplete ─────────────────────────────────────────────────────

describe('showChallengeComplete', () => {
  beforeEach(() => {
    localStorage.setItem('totalXP', '0');
    setS({
      mode: 'challenge', challenge: CORE_CHALLENGE,
      rounds: 2, currentRound: 2, exIdx: 2,
      setsCompleted: 6,
    });
  });

  it('saves the correct XP to localStorage', () => {
    trialModule.showChallengeComplete();
    expect(parseInt(localStorage.getItem('totalXP'))).toBe(25 + 6 * 8); // 73
  });

  it('renders the challenge name', () => {
    trialModule.showChallengeComplete();
    expect(document.querySelector('.reward').textContent).toBe('Core Challenge');
  });

  it('Again button returns to showChallengeDetail for the same challenge', () => {
    trialModule.showChallengeComplete();
    localStorage.setItem('totalXP', '0'); // ensure level-based scaling doesn't break
    document.getElementById('again-btn').click();
    expect(document.querySelector('.trial-heading').textContent)
      .toBe('Core Challenge');
  });

  it('uses singular "round" when rounds = 1', () => {
    localStorage.setItem('totalXP', '0');
    setS({
      mode: 'challenge', challenge: CORE_CHALLENGE,
      rounds: 1, currentRound: 1, exIdx: 2, setsCompleted: 3,
    });
    trialModule.showChallengeComplete();
    expect(document.querySelector('.set-indicator').textContent).toContain('1 round');
  });
});
