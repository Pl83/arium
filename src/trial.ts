// shared.js loaded first — GOAL_CONFIG, goalTarget, getTotalXP, etc. are global

const XP_BASE_TRIAL       = 10;
const XP_PER_SET          = 10;
const XP_BASE_CHALLENGE   = 25;
const XP_PER_CHALLENGE_EX = 8;
const REST_SECONDS        = 30;
const TRANSITION_SECONDS  = 15;

// ── Exercise catalogue ────────────────────────────────────────────────────

function exScale(ex: BaseExercise, level: number): number {
  const cfg = ex.cfgIdx !== undefined ? GOAL_CONFIG[ex.cfgIdx] : ex.scale!;
  return goalTarget(cfg, level);
}

const SOLO_EXERCISES: Exercise[] = [
  { name: 'Push-Ups',     type: 'reps', cfgIdx: 0, step: 5,  min: 5,  stat: 'strength' },
  { name: 'Sit-Ups',      type: 'reps', cfgIdx: 1, step: 5,  min: 5,  stat: 'core'     },
  { name: 'Squats',       type: 'reps', cfgIdx: 2, step: 5,  min: 5,  stat: 'power'    },
  { name: 'Plank',        type: 'time', cfgIdx: 3, step: 15, min: 15, stat: 'endurance' },
  { name: 'Pull-Ups',     type: 'reps', scale: { base: 5,  step: 1, cap: 25 }, step: 1,  min: 3,  stat: 'strength' },
  { name: 'Burpees',      type: 'reps', scale: { base: 8,  step: 1, cap: 30 }, step: 1,  min: 4,  stat: 'power'    },
  { name: 'Lunges',       type: 'reps', scale: { base: 15, step: 2, cap: 55 }, step: 2,  min: 6,  stat: 'power'    },
  { name: 'Dips',         type: 'reps', scale: { base: 10, step: 1, cap: 35 }, step: 1,  min: 5,  stat: 'strength' },
  { name: 'Mt. Climbers', type: 'time', scale: { base: 20, step: 3, cap: 75 }, step: 5,  min: 10, stat: 'endurance' },
];

const CHALLENGES: Challenge[] = [
  {
    name: 'Core Challenge',
    stat: 'core',
    exercises: [
      { name: 'Crunch',        type: 'reps', scale: { base: 15, step: 2, cap: 45 }, stat: 'core' },
      { name: 'Russian Twist', type: 'reps', scale: { base: 15, step: 2, cap: 45 }, stat: 'core' },
      { name: 'Leg Raise',     type: 'reps', scale: { base: 10, step: 1, cap: 35 }, stat: 'core' },
    ],
  },
  {
    name: 'Upper Body Burn',
    stat: 'strength',
    exercises: [
      { name: 'Push-Ups', type: 'reps', cfgIdx: 0,                                    stat: 'strength' },
      { name: 'Dips',     type: 'reps', scale: { base: 10, step: 1, cap: 35 },        stat: 'strength' },
      { name: 'Pull-Ups', type: 'reps', scale: { base: 5,  step: 1, cap: 25 },        stat: 'strength' },
    ],
  },
  {
    name: 'Leg Day',
    stat: 'power',
    exercises: [
      { name: 'Squats',  type: 'reps', cfgIdx: 2,                                    stat: 'power' },
      { name: 'Lunges',  type: 'reps', scale: { base: 15, step: 2, cap: 55 },        stat: 'power' },
      { name: 'Burpees', type: 'reps', scale: { base: 8,  step: 1, cap: 30 },        stat: 'power' },
    ],
  },
  {
    name: 'Cardio Blast',
    stat: 'endurance',
    exercises: [
      { name: 'Burpees',       type: 'reps', scale: { base: 8,  step: 1, cap: 30 }, stat: 'power'     },
      { name: 'Mt. Climbers',  type: 'time', scale: { base: 20, step: 3, cap: 75 }, stat: 'endurance' },
      { name: 'Jumping Jacks', type: 'time', scale: { base: 25, step: 3, cap: 75 }, stat: 'endurance' },
    ],
  },
];

// ── State ─────────────────────────────────────────────────────────────────

let s: TrialState = {} as SoloState;
let clock: ReturnType<typeof setInterval> | null = null;
let activeTab = 'solo';

function resetSoloState(ex: Exercise): void {
  clearClock();
  const level = getLevel(getTotalXP());
  s = {
    mode:          'solo',
    ex,
    sets:          3,
    target:        ex ? exScale(ex, level) : 0,
    currentSet:    1,
    setsCompleted: 0,
    reps:          0,
    timeLeft:      0,
  };
}

function resetChallengeState(ch: Challenge): void {
  clearClock();
  const level   = getLevel(getTotalXP());
  const firstEx = ch.exercises[0];
  s = {
    mode:          'challenge',
    challenge:     ch,
    rounds:        2,
    currentRound:  1,
    exIdx:         0,
    ex:            firstEx,
    sets:          1,
    target:        exScale(firstEx, level),
    currentSet:    1,
    setsCompleted: 0,
    reps:          0,
    timeLeft:      0,
  };
}

function clearClock(): void {
  if (clock !== null) clearInterval(clock);
  clock = null;
}

// ── DOM helpers ───────────────────────────────────────────────────────────

function main(): Element {
  return document.querySelector('.app') as Element;
}

function make(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  /* istanbul ignore else */ if (cls)  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function btn(text: string, cls: string, fn: () => void): HTMLButtonElement {
  const b = make('button', cls, text) as HTMLButtonElement;
  b.addEventListener('click', fn);
  return b;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60), s2 = sec % 60;
  return m > 0 ? m + ':' + (s2 < 10 ? '0' : '') + s2 : sec + 's';
}

function calcSoloXP(): number      { return XP_BASE_TRIAL     + s.setsCompleted * XP_PER_SET;          }
function calcChallengeXP(): number { return XP_BASE_CHALLENGE  + s.setsCompleted * XP_PER_CHALLENGE_EX; }

// ── Screen 1 · Picker (Solo / Challenges tabs) ────────────────────────────

function showExerciseList(): void {
  clearClock();
  s = {} as SoloState;
  const m = main();
  m.innerHTML = '';

  m.appendChild(make('h2', 'picker-heading', 'Choose Your Trial'));

  const tabBar = make('div', 'tab-bar');
  const soloTab = btn('Solo', 'tab-btn' + (activeTab === 'solo' ? ' active' : ''), () => {
    activeTab = 'solo'; showExerciseList();
  });
  const chalTab = btn('Challenges', 'tab-btn' + (activeTab === 'challenges' ? ' active' : ''), () => {
    activeTab = 'challenges'; showExerciseList();
  });
  tabBar.appendChild(soloTab);
  tabBar.appendChild(chalTab);
  m.appendChild(tabBar);

  const level = getLevel(getTotalXP());

  if (activeTab === 'solo') {
    const grid = make('div', 'exercise-grid');
    SOLO_EXERCISES.forEach(ex => {
      const tgt   = exScale(ex, level);
      const label = ex.type === 'reps' ? tgt + ' reps' : fmt(tgt);
      const card  = make('div', 'exercise-card');
      card.setAttribute('data-stat', ex.stat);
      card.innerHTML =
        '<span class="ex-name">'   + ex.name  + '</span>' +
        '<span class="ex-stat stat-' + ex.stat + '">' + ex.stat + '</span>' +
        '<span class="ex-target">Lv.' + level + ' · ' + label + '</span>';
      card.addEventListener('click', () => showConfigure(ex));
      grid.appendChild(card);
    });
    m.appendChild(grid);
  } else {
    const list = make('div', 'challenge-list');
    CHALLENGES.forEach(ch => {
      const names = ch.exercises.map(e => e.name).join(' · ');
      const card  = make('div', 'challenge-card');
      card.setAttribute('data-stat', ch.stat);
      card.innerHTML =
        '<div class="challenge-card-header">' +
          '<span class="challenge-name">' + ch.name + '</span>' +
          '<span class="challenge-badge stat-' + ch.stat + '">' + ch.stat + '</span>' +
        '</div>' +
        '<span class="challenge-exercises">' + names + '</span>';
      card.addEventListener('click', () => showChallengeDetail(ch));
      list.appendChild(card);
    });
    m.appendChild(list);
  }
}

// ── Screen 2a · Configure solo ────────────────────────────────────────────

function showConfigure(ex: Exercise): void {
  resetSoloState(ex);
  const m = main();
  m.innerHTML = '';

  m.appendChild(make('h2', 'trial-heading', ex.name));

  const form = make('div', 'config-form');
  form.appendChild(stepper('Sets', 'sets-val',
    () => s.sets,
    () => { if (s.sets > 1) { s.sets--;   refreshConfig(); } },
    () => { if (s.sets < 5) { s.sets++;   refreshConfig(); } }
  ));
  const rowLabel = ex.type === 'reps' ? 'Reps' : 'Duration';
  form.appendChild(stepper(rowLabel, 'target-val',
    () => ex.type === 'reps' ? s.target : fmt(s.target),
    () => { if (s.target > ex.min) { s.target -= ex.step; refreshConfig(); } },
    () => { s.target += ex.step; refreshConfig(); }
  ));
  m.appendChild(form);

  const xpEl = make('p', 'xp-preview');
  xpEl.id = 'xp-preview';
  m.appendChild(xpEl);
  refreshConfig();

  m.appendChild(btn('Start Trial', 'trial-btn',           startSolo));
  m.appendChild(btn('Back',        'trial-btn secondary', showExerciseList));
}

function stepper(label: string, valId: string, getVal: () => string | number, onMinus: () => void, onPlus: () => void): HTMLElement {
  const row = make('div', 'config-row');
  row.innerHTML =
    '<span class="config-label">' + label + '</span>' +
    '<div class="config-stepper">' +
      '<button class="step-btn">−</button>' +
      '<span id="' + valId + '" class="step-val">' + getVal() + '</span>' +
      '<button class="step-btn">+</button>' +
    '</div>';
  row.querySelectorAll('.step-btn')[0].addEventListener('click', onMinus);
  row.querySelectorAll('.step-btn')[1].addEventListener('click', onPlus);
  return row;
}

function refreshConfig(): void {
  if (s.mode !== 'solo') return;
  const setsEl   = document.getElementById('sets-val');
  const targetEl = document.getElementById('target-val');
  const xpEl     = document.getElementById('xp-preview');
  /* istanbul ignore else */ if (setsEl)   setsEl.textContent   = String(s.sets);
  /* istanbul ignore else */ if (targetEl) targetEl.textContent = s.ex.type === 'reps' ? String(s.target) : fmt(s.target);
  /* istanbul ignore else */ if (xpEl)     xpEl.textContent     = 'Reward: ' + (XP_BASE_TRIAL + s.sets * XP_PER_SET) + ' XP';
}

// ── Screen 2b · Challenge detail ──────────────────────────────────────────

function showChallengeDetail(ch: Challenge): void {
  resetChallengeState(ch);
  const level = getLevel(getTotalXP());
  const m = main();
  m.innerHTML = '';

  m.appendChild(make('h2', 'trial-heading', ch.name));

  const exList = make('div', 'challenge-ex-list');
  ch.exercises.forEach(ex => {
    const tgt   = exScale(ex, level);
    const label = ex.type === 'reps' ? tgt + ' reps' : fmt(tgt);
    const row   = make('div', 'challenge-ex-row');
    row.innerHTML =
      '<span class="config-label">' + ex.name + '</span>' +
      '<span class="ex-target">'    + label   + '</span>';
    exList.appendChild(row);
  });
  m.appendChild(exList);

  const form = make('div', 'config-form');
  form.appendChild(stepper('Rounds', 'rounds-val',
    () => (s as ChallengeState).rounds,
    () => { if ((s as ChallengeState).rounds > 1) { (s as ChallengeState).rounds--; refreshChallengeConfig(); } },
    () => { if ((s as ChallengeState).rounds < 3) { (s as ChallengeState).rounds++; refreshChallengeConfig(); } }
  ));
  m.appendChild(form);

  const xpEl = make('p', 'xp-preview');
  xpEl.id = 'ch-xp-preview';
  m.appendChild(xpEl);
  refreshChallengeConfig();

  m.appendChild(btn('Start Challenge', 'trial-btn gold', startChallenge));
  m.appendChild(btn('Back',            'trial-btn secondary', showExerciseList));
}

function refreshChallengeConfig(): void {
  if (s.mode !== 'challenge') return;
  const roundsEl = document.getElementById('rounds-val');
  const xpEl     = document.getElementById('ch-xp-preview');
  /* istanbul ignore else */ if (roundsEl) roundsEl.textContent = String(s.rounds);
  /* istanbul ignore else */ if (xpEl) {
    const totalExs = s.rounds * s.challenge.exercises.length;
    xpEl.textContent = 'Reward: ' + (XP_BASE_CHALLENGE + totalExs * XP_PER_CHALLENGE_EX) + ' XP';
  }
}

// ── Solo workout ──────────────────────────────────────────────────────────

function startSolo(): void {
  s.currentSet    = 1;
  s.setsCompleted = 0;
  beginSet();
}

function beginSet(): void {
  s.ex.type === 'time' ? showTimedSet() : showRepSet();
}

// ── Challenge workout ─────────────────────────────────────────────────────

function startChallenge(): void {
  if (s.mode !== 'challenge') return;
  s.currentRound  = 1;
  s.exIdx         = 0;
  s.setsCompleted = 0;
  beginChallengeExercise();
}

function beginChallengeExercise(): void {
  if (s.mode !== 'challenge') return;
  const level = getLevel(getTotalXP());
  const ex    = s.challenge.exercises[s.exIdx];
  s.ex        = ex;
  s.target    = exScale(ex, level);
  s.sets      = 1;
  s.currentSet = 1;
  ex.type === 'time' ? showTimedSet() : showRepSet();
}

// ── Screen 3a · Reps ──────────────────────────────────────────────────────

function showRepSet(): void {
  s.reps = 0;
  const m = main();
  m.innerHTML = '';

  m.appendChild(make('h2', 'trial-heading', s.ex.name));

  const indicator = s.mode === 'challenge'
    ? 'Round ' + s.currentRound + '/' + s.rounds + '  ·  Ex ' + (s.exIdx + 1) + '/' + s.challenge.exercises.length
    : 'Set ' + s.currentSet + ' / ' + s.sets;
  m.appendChild(make('p', 'set-indicator', indicator));

  const tapArea = make('div', 'tap-area');
  tapArea.id = 'tap-area';

  const numEl  = make('span', 'rep-count', '0');
  numEl.id     = 'rep-num';
  const maxEl  = make('span', 'rep-max', '/ ' + s.target);
  const hint   = make('p', 'tap-hint', 'tap anywhere');

  const numWrap = make('div', 'rep-wrap');
  numWrap.appendChild(numEl);
  numWrap.appendChild(maxEl);
  tapArea.appendChild(numWrap);
  tapArea.appendChild(hint);
  m.appendChild(tapArea);

  tapArea.addEventListener('touchstart', onRepTap, { passive: true });
  tapArea.addEventListener('click',      onRepTap);

  m.appendChild(btn('Done Set', 'trial-btn',           finishSet));
  m.appendChild(btn('Abandon',  'trial-btn secondary', () => { clearClock(); showExerciseList(); }));
}

function onRepTap(e: MouseEvent | TouchEvent): void {
  if (e.type === 'click' && (e.target as HTMLElement).tagName === 'BUTTON') return;
  if (s.reps >= s.target) return;
  s.reps++;
  const numEl = document.getElementById('rep-num');
  /* istanbul ignore else */ if (numEl) {
    numEl.textContent = String(s.reps);
    numEl.classList.remove('rep-bump');
    void numEl.offsetWidth;
    numEl.classList.add('rep-bump');
  }
  if (s.reps >= s.target) {
    const ta = document.getElementById('tap-area');
    /* istanbul ignore else */ if (ta) ta.classList.add('tap-complete');
    setTimeout(finishSet, 500);
  }
}

// ── Screen 3b · Timed ─────────────────────────────────────────────────────

function showTimedSet(): void {
  clearClock();
  s.timeLeft = s.target;
  const m = main();
  m.innerHTML = '';

  m.appendChild(make('h2', 'trial-heading', s.ex.name));

  const indicator = s.mode === 'challenge'
    ? 'Round ' + s.currentRound + '/' + s.rounds + '  ·  Ex ' + (s.exIdx + 1) + '/' + s.challenge.exercises.length
    : 'Set ' + s.currentSet + ' / ' + s.sets;
  m.appendChild(make('p', 'set-indicator', indicator));

  const display = make('div', 'big-display');
  display.id = 'timer-display';
  display.textContent = fmt(s.timeLeft);
  m.appendChild(display);

  const startBtn = btn('Start', 'trial-btn', () => {
    startBtn.disabled    = true;
    startBtn.textContent = 'Running…';
    clock = setInterval(() => {
      s.timeLeft--;
      const el = document.getElementById('timer-display');
      /* istanbul ignore else */ if (el) el.textContent = fmt(s.timeLeft);
      if (s.timeLeft <= 0) { clearClock(); finishSet(); }
    }, 1000);
  });
  m.appendChild(startBtn);
  m.appendChild(btn('Abandon', 'trial-btn secondary', () => { clearClock(); showExerciseList(); }));
}

// ── Set / exercise completion ──────────────────────────────────────────────

function finishSet(): void {
  clearClock();
  s.setsCompleted++;
  if (s.ex.stat) incrementStat(s.ex.stat);

  if (s.mode === 'challenge') {
    s.exIdx++;
    if (s.exIdx < s.challenge.exercises.length) {
      showChallengeRest();
    } else if (s.currentRound < s.rounds) {
      s.currentRound++;
      s.exIdx = 0;
      showRoundComplete();
    } else {
      showChallengeComplete();
    }
  } else {
    if (s.currentSet < s.sets) {
      s.currentSet++;
      showRest();
    } else {
      showComplete();
    }
  }
}

// ── Screen 4a · Solo rest ─────────────────────────────────────────────────

function showRest(): void {
  let restLeft = REST_SECONDS;
  const m = main();
  m.innerHTML = '';

  m.appendChild(make('p', 'set-indicator sucess', 'Set ' + (s.currentSet - 1) + ' Complete!'));
  m.appendChild(make('h2', 'trial-heading rest-label', 'Rest'));

  const display = make('div', 'big-display rest-display');
  display.id = 'rest-display';
  display.textContent = restLeft + 's';
  m.appendChild(display);

  m.appendChild(make('p', 'rest-next', 'Next: Set ' + s.currentSet + ' / ' + s.sets));
  m.appendChild(btn('Skip Rest', 'trial-btn secondary', () => { clearClock(); beginSet(); }));

  clock = setInterval(() => {
    restLeft--;
    const el = document.getElementById('rest-display');
    /* istanbul ignore else */ if (el) el.textContent = restLeft + 's';
    if (restLeft <= 0) { clearClock(); beginSet(); }
  }, 1000);
}

// ── Screen 4b · Challenge rest (between exercises) ────────────────────────

function showChallengeRest(): void {
  if (s.mode !== 'challenge') return;
  let restLeft  = TRANSITION_SECONDS;
  const level   = getLevel(getTotalXP());
  const nextEx  = s.challenge.exercises[s.exIdx];
  const nextTgt = exScale(nextEx, level);
  const nextLbl = nextEx.type === 'reps' ? nextTgt + ' reps' : fmt(nextTgt);

  const m = main();
  m.innerHTML = '';

  m.appendChild(make('p', 'set-indicator sucess', 'Exercise Complete!'));
  m.appendChild(make('h2', 'trial-heading rest-label', 'Rest'));

  const display = make('div', 'big-display rest-display');
  display.id = 'rest-display';
  display.textContent = restLeft + 's';
  m.appendChild(display);

  m.appendChild(make('p', 'rest-next', 'Next: ' + nextEx.name + '  ·  ' + nextLbl));
  m.appendChild(btn('Skip Rest', 'trial-btn secondary', () => { clearClock(); beginChallengeExercise(); }));

  clock = setInterval(() => {
    restLeft--;
    const el = document.getElementById('rest-display');
    /* istanbul ignore else */ if (el) el.textContent = restLeft + 's';
    if (restLeft <= 0) { clearClock(); beginChallengeExercise(); }
  }, 1000);
}

// ── Screen 4c · Round complete ────────────────────────────────────────────

function showRoundComplete(): void {
  if (s.mode !== 'challenge') return;
  let restLeft = REST_SECONDS;
  const m = main();
  m.innerHTML = '';

  m.appendChild(make('p', 'set-indicator sucess', 'Round ' + (s.currentRound - 1) + ' Complete!'));
  m.appendChild(make('h2', 'trial-heading rest-label', 'Round Rest'));

  const display = make('div', 'big-display rest-display');
  display.id = 'rest-display';
  display.textContent = restLeft + 's';
  m.appendChild(display);

  m.appendChild(make('p', 'rest-next', 'Next: Round ' + s.currentRound + ' / ' + s.rounds));
  m.appendChild(btn('Skip Rest', 'trial-btn secondary', () => { clearClock(); beginChallengeExercise(); }));

  clock = setInterval(() => {
    restLeft--;
    const el = document.getElementById('rest-display');
    /* istanbul ignore else */ if (el) el.textContent = restLeft + 's';
    if (restLeft <= 0) { clearClock(); beginChallengeExercise(); }
  }, 1000);
}

// ── Screen 5a · Solo complete ─────────────────────────────────────────────

function showComplete(): void {
  if (s.mode !== 'solo') return;
  clearClock();
  const xpActual = XP_BASE_TRIAL + s.setsCompleted * XP_PER_SET;
  localStorage.setItem('totalXP', String(getTotalXP() + xpActual));
  const done = parseInt(localStorage.getItem('totalCompleted') || '0', 10);
  localStorage.setItem('totalCompleted', String(done + s.setsCompleted));

  const summary = s.setsCompleted + ' set' + (s.setsCompleted > 1 ? 's' : '') +
    ' × ' + (s.ex.type === 'reps' ? s.target + ' reps' : fmt(s.target));

  const savedEx = s.ex;
  const m = main();
  m.innerHTML =
    '<div class="complete-card">' +
      '<img src="./img/center.svg" alt="" class="complete-icon">' +
      '<h2 class="sucess">Trial Complete!</h2>' +
      '<p class="set-indicator">' + summary + '</p>' +
      '<p class="reward-line">+' + xpActual + ' XP</p>' +
      '<button id="again-btn" class="trial-btn">Again</button>' +
      '<button id="menu-btn"  class="trial-btn secondary">Menu</button>' +
    '</div>';

  document.getElementById('again-btn')!.addEventListener('click', () => showConfigure(savedEx));
  document.getElementById('menu-btn')!.addEventListener('click', showExerciseList);
}

// ── Screen 5b · Challenge complete ───────────────────────────────────────

function showChallengeComplete(): void {
  if (s.mode !== 'challenge') return;
  clearClock();
  const xpActual = XP_BASE_CHALLENGE + s.setsCompleted * XP_PER_CHALLENGE_EX;
  localStorage.setItem('totalXP', String(getTotalXP() + xpActual));
  const done = parseInt(localStorage.getItem('totalCompleted') || '0', 10);
  localStorage.setItem('totalCompleted', String(done + s.setsCompleted));

  const summary = s.rounds + ' round' + (s.rounds > 1 ? 's' : '') +
    '  ·  ' + s.challenge.exercises.length + ' exercises';

  const savedChallenge = s.challenge;
  const m = main();
  m.innerHTML =
    '<div class="complete-card">' +
      '<img src="./img/center.svg" alt="" class="complete-icon gold-glow">' +
      '<h2 class="reward">' + savedChallenge.name + '</h2>' +
      '<p class="sucess complete-sub">Challenge Complete!</p>' +
      '<p class="set-indicator">' + summary + '</p>' +
      '<p class="reward-line">+' + xpActual + ' XP</p>' +
      '<button id="again-btn" class="trial-btn gold">Again</button>' +
      '<button id="menu-btn"  class="trial-btn secondary">Menu</button>' +
    '</div>';

  document.getElementById('again-btn')!.addEventListener('click', () => showChallengeDetail(savedChallenge));
  document.getElementById('menu-btn')!.addEventListener('click', showExerciseList);
}

// ── Boot ──────────────────────────────────────────────────────────────────

/* istanbul ignore next */
if (typeof module === 'undefined') {
  showExerciseList();
}

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.SOLO_EXERCISES        = SOLO_EXERCISES;
  global.CHALLENGES            = CHALLENGES;
  global.exScale               = exScale;
  global.fmt                   = fmt;
  global.calcSoloXP            = calcSoloXP;
  global.calcChallengeXP       = calcChallengeXP;
  global.resetSoloState        = resetSoloState;
  global.resetChallengeState   = resetChallengeState;
  global.showExerciseList      = showExerciseList;
  global.showConfigure         = showConfigure;
  global.showChallengeDetail   = showChallengeDetail;
  global.showRepSet            = showRepSet;
  global.showTimedSet          = showTimedSet;
  global.showRest              = showRest;
  global.showChallengeRest     = showChallengeRest;
  global.showRoundComplete     = showRoundComplete;
  global.showComplete          = showComplete;
  global.showChallengeComplete = showChallengeComplete;
  global.finishSet             = finishSet;
  global.onRepTap              = onRepTap;
  module.exports = {
    exScale, fmt, calcSoloXP, calcChallengeXP,
    resetSoloState, resetChallengeState, showExerciseList, showConfigure,
    showChallengeDetail, showRepSet, showTimedSet, showRest, showChallengeRest,
    showRoundComplete, showComplete, showChallengeComplete, finishSet, onRepTap,
    getS: () => s,
    setS: (val: TrialState) => { s = val; },
  };
}
