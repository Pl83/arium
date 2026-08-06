// shared.ts is already on global via setup.ts
// Each test suite re-requires index.ts after resetting modules so module state is clean.
const { createSQLiteMock } = require('./helpers/sqlite-mock');

const INDEX_DOM = `
  <div id="levelProgress" style="width:0%"></div>
  <span id="levelLabel">Lv.1 — 0% Cosmo</span>
  <div id="nameTag"></div>
  <span id="nameHouse"></span>
  <span id="rankTitle" class="rank-letter rank-e"></span>
  <svg id="rankMedallion" class="rank-medallion rank-letter rank-e"><text id="rankGlyph"></text></svg>
  <div id="name-setup" style="display:none;">
    <input id="name-setup-input" type="text">
    <p id="name-setup-error" hidden></p>
    <button id="name-setup-btn"></button>
  </div>
  <main class="app">
    <div class="center"><ul></ul></div>
    <div class="popup"></div>
  </main>
`;

beforeEach(() => {
  localStorage.clear();
  // Skip the first-run name setup in all existing tests
  localStorage.setItem('playerName', 'TestHunter');
  jest.clearAllMocks();
  jest.useFakeTimers();
  document.body.innerHTML = INDEX_DOM;
  jest.resetModules();
  // Re-load shared so its globals survive resetModules
  require('../src/shared');
  // daylog.ts must load before index.ts (mirrors browser script order) —
  // index.ts calls createDayLogTable at runtime from onDeviceReady.
  require('../src/daylog');
  // notifications.ts must load before index.ts (mirrors browser script order)
  require('../src/notifications');
  // houses.ts before splash.ts, as in index.html: renderNameHouse() lives in
  // splash.ts and reads the stored house from houses.ts.
  require('../src/houses');
  // splash.ts must load before index.ts — index.ts calls hideSplash() at the
  // end of the boot chain and on the DB error path, and updateNameTag() paints
  // the house badge through renderNameHouse().
  require('../src/splash');
  // omens.ts must load before index.ts — index.ts raises Rebuke, level-up,
  // Ascension and streak omens.
  require('../src/omens');
  require('../src/index');
});

afterEach(() => {
  jest.useRealTimers();
});

// ── onDeviceReady ─────────────────────────────────────────────────────────────

describe('onDeviceReady', () => {
  it('opens the DB, seeds, and renders the UI on success', () => {
    const today = new Date().toDateString();
    localStorage.setItem('lastOpened', today);
    // Single row satisfies SELECT COUNT(*) (count > 0) and SELECT * (has title, etc.)
    const rows = [{ count: 2, id: 1, title: 'Push-Ups [0/20]', completed: 0 }];
    const { mockDb } = createSQLiteMock({ rows });
    (window as any).sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
    (global as any).onDeviceReady();
    expect((window as any).sqlitePlugin.openDatabase).toHaveBeenCalled();
    expect(document.querySelectorAll('.center ul li').length).toBe(1);
  });

  it('logs the error and does not crash when CREATE TABLE transaction fails', () => {
    const { mockDb } = createSQLiteMock({ failOn: true });
    (window as any).sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
    expect(() => (global as any).onDeviceReady()).not.toThrow();
  });
});

// ── maybeShowNameSetup ────────────────────────────────────────────────────────

describe('maybeShowNameSetup', () => {
  it('calls callback immediately when playerName is already set', () => {
    localStorage.setItem('playerName', 'Aria');
    const cb = jest.fn();
    (global as any).maybeShowNameSetup(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(document.getElementById('name-setup')!.style.display).toBe('none');
  });

  it('shows the overlay when playerName is not set', () => {
    localStorage.removeItem('playerName');
    (global as any).maybeShowNameSetup(jest.fn());
    expect(document.getElementById('name-setup')!.style.display).toBe('flex');
  });

  it('saves the trimmed name and calls callback on button click', () => {
    localStorage.removeItem('playerName');
    const cb = jest.fn();
    (global as any).maybeShowNameSetup(cb);
    const input = document.getElementById('name-setup-input') as HTMLInputElement;
    input.value = '  Zorg  ';
    document.getElementById('name-setup-btn')!.click();
    expect(localStorage.getItem('playerName')).toBe('Zorg');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(document.getElementById('name-setup')!.style.display).toBe('none');
  });

  it('falls back to "Saint" when input is blank', () => {
    localStorage.removeItem('playerName');
    const cb = jest.fn();
    (global as any).maybeShowNameSetup(cb);
    const input = document.getElementById('name-setup-input') as HTMLInputElement;
    input.value = '   ';
    document.getElementById('name-setup-btn')!.click();
    expect(localStorage.getItem('playerName')).toBe('Saint');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('saves name and calls callback on Enter key', () => {
    localStorage.removeItem('playerName');
    const cb = jest.fn();
    (global as any).maybeShowNameSetup(cb);
    const input = document.getElementById('name-setup-input') as HTMLInputElement;
    input.value = 'Kira';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(localStorage.getItem('playerName')).toBe('Kira');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not call callback on non-Enter key', () => {
    localStorage.removeItem('playerName');
    const cb = jest.fn();
    (global as any).maybeShowNameSetup(cb);
    const input = document.getElementById('name-setup-input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(cb).not.toHaveBeenCalled();
  });

  it('strips characters a name may not contain', () => {
    localStorage.removeItem('playerName');
    (global as any).maybeShowNameSetup(jest.fn());
    const input = document.getElementById('name-setup-input') as HTMLInputElement;
    input.value = 'Kira🔥';
    document.getElementById('name-setup-btn')!.click();
    expect(localStorage.getItem('playerName')).toBe('Kira');
  });

  it('refuses a banned name, keeps the overlay open and explains why', () => {
    localStorage.removeItem('playerName');
    const cb = jest.fn();
    (global as any).maybeShowNameSetup(cb);
    const input = document.getElementById('name-setup-input') as HTMLInputElement;
    input.value = 'Fucker';
    document.getElementById('name-setup-btn')!.click();

    const error = document.getElementById('name-setup-error')!;
    expect(localStorage.getItem('playerName')).toBeNull();
    expect(cb).not.toHaveBeenCalled();
    expect(document.getElementById('name-setup')!.style.display).toBe('flex');
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe('That name is not permitted. Choose another.');
  });

  it('clears the error as soon as the player types again', () => {
    localStorage.removeItem('playerName');
    (global as any).maybeShowNameSetup(jest.fn());
    const input = document.getElementById('name-setup-input') as HTMLInputElement;
    input.value = 'Fucker';
    document.getElementById('name-setup-btn')!.click();
    expect(document.getElementById('name-setup-error')!.hidden).toBe(false);

    input.value = 'Kira';
    input.dispatchEvent(new Event('input'));
    expect(document.getElementById('name-setup-error')!.hidden).toBe(true);
  });

  it('accepts a clean name after one was refused', () => {
    localStorage.removeItem('playerName');
    const cb = jest.fn();
    (global as any).maybeShowNameSetup(cb);
    const input = document.getElementById('name-setup-input') as HTMLInputElement;
    input.value = 'Fucker';
    document.getElementById('name-setup-btn')!.click();
    input.value = 'Kira';
    document.getElementById('name-setup-btn')!.click();

    expect(localStorage.getItem('playerName')).toBe('Kira');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

// ── handleDailyReset ──────────────────────────────────────────────────────────

describe('handleDailyReset', () => {
  it('calls callback immediately when lastOpened is today', () => {
    const today = new Date().toDateString();
    localStorage.setItem('lastOpened', today);
    const cb = jest.fn();
    (global as any).handleDailyReset(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('updates lastOpened to today when date differs', () => {
    localStorage.setItem('lastOpened', 'Mon Jan 01 2000');
    const { mockDb } = createSQLiteMock({ rows: [{ total: 0 }, { done: 0 }] });
    (global as any)._setDb(mockDb);
    (global as any).handleDailyReset(jest.fn());
    expect(localStorage.getItem('lastOpened')).toBe(new Date().toDateString());
  });

  it('works on first launch when lastOpened is not set', () => {
    const { mockDb } = createSQLiteMock({ rows: [{ total: 0 }, { done: 0 }] });
    (global as any)._setDb(mockDb);
    (global as any).handleDailyReset(jest.fn());
    expect(localStorage.getItem('lastOpened')).toBe(new Date().toDateString());
  });
});

// ── applyStreakAndPenalty ─────────────────────────────────────────────────────

describe('applyStreakAndPenalty', () => {
  it('does nothing when total is 0 (no objectives)', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem');
    (global as any).applyStreakAndPenalty(0, 0);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('increments streak when all objectives completed', () => {
    localStorage.setItem('streak', '3');
    (global as any).applyStreakAndPenalty(4, 4);
    expect(localStorage.getItem('streak')).toBe('4');
  });

  it('does not deduct XP when all objectives are done', () => {
    localStorage.setItem('totalXP', '100');
    (global as any).applyStreakAndPenalty(4, 4);
    expect(localStorage.getItem('totalXP')).toBe('100');
  });

  it('resets streak and deducts XP per missed objective', () => {
    localStorage.setItem('totalXP', '100');
    localStorage.setItem('streak', '5');
    (global as any).applyStreakAndPenalty(4, 2); // 2 missed × 15 = 30
    expect(localStorage.getItem('totalXP')).toBe('70');
    expect(localStorage.getItem('streak')).toBe('0');
  });

  it('clamps XP to 0 when penalty exceeds totalXP', () => {
    localStorage.setItem('totalXP', '10');
    (global as any).applyStreakAndPenalty(4, 0); // 4 missed × 15 = 60
    expect(localStorage.getItem('totalXP')).toBe('0');
  });

  // The penalty modal is gone; the Rebuke is an omen now, raised synchronously
  // rather than behind a 200ms timer.
  it('raises a Rebuke omen naming the misses and the penalty', () => {
    localStorage.setItem('totalXP', '100');
    (global as any).applyStreakAndPenalty(4, 2);

    const log = (global as any).readOmens();
    expect(log).toHaveLength(1);
    expect(log[0].k).toBe('rebuke');
    expect(log[0].b).toContain('2 ordeals unfinished');
    expect(log[0].b).toContain('−30 Cosmo');
  });

  it('uses the singular when a single ordeal was missed', () => {
    localStorage.setItem('totalXP', '100');
    (global as any).applyStreakAndPenalty(4, 3);
    expect((global as any).readOmens()[0].b).toContain('1 ordeal unfinished');
  });

  it('raises no omen when the day was completed', () => {
    (global as any).applyStreakAndPenalty(4, 4);
    expect((global as any).readOmens()).toHaveLength(0);
  });
});

// ── Streak milestones ─────────────────────────────────────────────────────────

describe('streak milestones', () => {
  it('raises an Unbroken omen when the streak reaches 7', () => {
    localStorage.setItem('streak', '6');
    (global as any).applyStreakAndPenalty(4, 4);

    const log = (global as any).readOmens();
    expect(log).toHaveLength(1);
    expect(log[0].k).toBe('streak');
    expect(log[0].b).toContain('7 days');
  });

  it('raises nothing on an ordinary day between milestones', () => {
    localStorage.setItem('streak', '7');
    (global as any).applyStreakAndPenalty(4, 4);
    expect(localStorage.getItem('streak')).toBe('8');
    expect((global as any).readOmens()).toHaveLength(0);
  });

  it('fires at every configured milestone and nowhere else', () => {
    const milestones = (global as any).STREAK_MILESTONES as number[];
    milestones.forEach(m => {
      localStorage.removeItem('omens');
      localStorage.setItem('streak', String(m - 1));
      (global as any).applyStreakAndPenalty(4, 4);
      expect((global as any).readOmens()).toHaveLength(1);
    });
  });
});

// ── refreshLevelBar ───────────────────────────────────────────────────────────

describe('refreshLevelBar', () => {
  it('sets bar width to the current progress %', () => {
    localStorage.setItem('totalXP', '50');
    (global as any).refreshLevelBar();
    expect(document.getElementById('levelProgress').style.width).toBe('50%');
  });

  it('writes the level and progress into the label overlay', () => {
    localStorage.setItem('totalXP', '200'); // level 2, 50% (100 XP into a 200-XP level)
    (global as any).refreshLevelBar();
    expect(document.getElementById('levelLabel').textContent).toBe('Lv.2 — 50% Cosmo');
  });
});

// ── updateNameTag ─────────────────────────────────────────────────────────────

describe('updateNameTag', () => {
  it('shows Saint by default', () => {
    localStorage.removeItem('playerName');
    (global as any).updateNameTag();
    expect(document.getElementById('nameTag').textContent).toBe('Saint');
  });

  it('shows the stored player name', () => {
    localStorage.setItem('playerName', 'Zara');
    (global as any).updateNameTag();
    expect(document.getElementById('nameTag').textContent).toBe('Zara');
  });

  it('puts the rank title in its own element, not the name', () => {
    localStorage.setItem('playerName', 'Zara');
    localStorage.setItem('totalXP', '4500'); // level 10 (xpToLevel(10) = 4500)
    (global as any).updateNameTag();
    expect(document.getElementById('nameTag').textContent).toBe('Zara');
    expect(document.getElementById('rankTitle').textContent).toBe('Silver Saint');
  });

  it('shows the correct rank title at level 10', () => {
    localStorage.setItem('totalXP', '4500');
    (global as any).updateNameTag();
    expect(document.getElementById('rankTitle').textContent).toBe('Silver Saint');
  });

  it('drives the medallion glyph and rank class from the current rank', () => {
    localStorage.setItem('totalXP', '4500'); // level 10 → rank C
    (global as any).updateNameTag();
    expect(document.getElementById('rankGlyph').textContent).toBe('C');
    expect(document.getElementById('rankTitle').className).toBe('rank-letter rank-c');
    expect(document.getElementById('rankMedallion').getAttribute('class'))
      .toBe('rank-medallion rank-letter rank-c');
  });

  it('falls back to rank E at level 1', () => {
    localStorage.setItem('totalXP', '0');
    (global as any).updateNameTag();
    expect(document.getElementById('rankGlyph').textContent).toBe('E');
    expect(document.getElementById('rankTitle').textContent).toBe('Aspirant');
  });

  it('wears the held house beside the name', () => {
    localStorage.setItem('house', 'taurus');
    (global as any).updateNameTag();

    const badge = document.querySelector('#nameHouse .house-badge');
    expect(badge).not.toBeNull();
    expect(badge.getAttribute('aria-label')).toBe('House of Taurus');
  });

  it('leaves the badge slot empty when no house is held', () => {
    (global as any).updateNameTag();
    expect(document.getElementById('nameHouse').innerHTML).toBe('');
  });
});

// ── animateBar ────────────────────────────────────────────────────────────────

describe('animateBar', () => {
  it('advances bar width on each 10 ms tick', () => {
    (global as any).animateBar(10, 15, jest.fn());
    jest.advanceTimersByTime(10);
    expect(document.getElementById('levelProgress').style.width).toBe('11%');
  });

  it('calls onDone when width reaches toPct', () => {
    const onDone = jest.fn();
    (global as any).animateBar(48, 50, onDone);
    jest.runAllTimers();
    expect(onDone).toHaveBeenCalled();
  });

  it('calls onDone when width reaches 100 (level-up path)', () => {
    const onDone = jest.fn();
    (global as any).animateBar(98, 200, onDone); // toPct > 100 simulates level-up
    jest.runAllTimers();
    expect(onDone).toHaveBeenCalled();
  });

  it('does not crash when onDone is undefined at the 100% boundary', () => {
    expect(() => {
      (global as any).animateBar(98, 200); // no onDone callback
      jest.runAllTimers();
    }).not.toThrow();
  });

  it('stops immediately when fromPct already equals toPct', () => {
    const onDone = jest.fn();
    (global as any).animateBar(50, 50, onDone);
    jest.advanceTimersByTime(10);
    expect(onDone).toHaveBeenCalled();
  });
});

// ── checkYesterdayCompletion ──────────────────────────────────────────────────

describe('checkYesterdayCompletion', () => {
  it('calls next() when the DB transaction fails', () => {
    const { mockDb } = createSQLiteMock({ failOn: true });
    (global as any)._setDb(mockDb);
    const next = jest.fn();
    (global as any).checkYesterdayCompletion(next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ── resetObjectives ───────────────────────────────────────────────────────────

describe('resetObjectives', () => {
  it('calls callback on success', () => {
    const { mockDb } = createSQLiteMock();
    (global as any)._setDb(mockDb);
    const cb = jest.fn();
    (global as any).resetObjectives(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('calls callback on DB error', () => {
    const { mockDb } = createSQLiteMock({ failOn: true });
    (global as any)._setDb(mockDb);
    const cb = jest.fn();
    (global as any).resetObjectives(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

// ── seedInitialObjectives ─────────────────────────────────────────────────────

describe('seedInitialObjectives', () => {
  it('calls callback when the DB transaction fails', () => {
    const { mockDb } = createSQLiteMock({ failOn: true });
    (global as any)._setDb(mockDb);
    const cb = jest.fn();
    (global as any).seedInitialObjectives(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not crash when callback is null and the DB transaction fails', () => {
    const { mockDb } = createSQLiteMock({ failOn: true });
    (global as any)._setDb(mockDb);
    expect(() => (global as any).seedInitialObjectives(null)).not.toThrow();
  });

  it('inserts a row for each GOAL_CONFIG entry when count = 0', () => {
    const { mockDb, mockTx } = createSQLiteMock({ rows: [{ count: 0 }] });
    (global as any)._setDb(mockDb);
    const cb = jest.fn();
    (global as any).seedInitialObjectives(cb);
    const inserts = mockTx.executeSql.mock.calls
      .filter(([sql]) => sql.includes('INSERT'));
    expect(inserts.length).toBe((global as any).GOAL_CONFIG.length);
    expect(cb).toHaveBeenCalled();
  });

  it('does NOT insert rows when count > 0', () => {
    const { mockDb, mockTx } = createSQLiteMock({ rows: [{ count: 3 }] });
    (global as any)._setDb(mockDb);
    (global as any).seedInitialObjectives(null);
    const inserts = mockTx.executeSql.mock.calls
      .filter(([sql]) => sql.includes('INSERT'));
    expect(inserts.length).toBe(0);
  });
});

// ── init (objectives list rendering) ─────────────────────────────────────────

describe('init', () => {
  it('populates the objective list with one li per DB row', () => {
    const rows = [
      { id: 1, title: 'Push-Ups [0/20]', completed: 0 },
      { id: 2, title: 'Sit-Ups [0/20]',  completed: 1 },
    ];
    const { mockDb } = createSQLiteMock({ rows });
    (global as any)._setDb(mockDb);
    (global as any).init();
    expect(document.querySelectorAll('.center ul li').length).toBe(2);
  });

  it('adds quest-complete class when all objectives are completed', () => {
    const rows = [{ id: 1, title: 'Push-Ups [0/20]', completed: 1 }];
    const { mockDb } = createSQLiteMock({ rows });
    (global as any)._setDb(mockDb);
    (global as any).init();
    expect(document.querySelector('.popup').classList.contains('quest-complete')).toBe(true);
  });

  it('removes quest-complete class when not all objectives are completed', () => {
    document.querySelector('.popup').classList.add('quest-complete');
    const rows = [{ id: 1, title: 'Push-Ups [0/20]', completed: 0 }];
    const { mockDb } = createSQLiteMock({ rows });
    (global as any)._setDb(mockDb);
    (global as any).init();
    expect(document.querySelector('.popup').classList.contains('quest-complete')).toBe(false);
  });

  it('renders an li without a progress span when title has no [N/M] pattern', () => {
    const rows = [{ id: 1, title: 'Run', completed: 0 }];
    const { mockDb } = createSQLiteMock({ rows });
    (global as any)._setDb(mockDb);
    (global as any).init();
    expect(document.querySelectorAll('.center ul li').length).toBe(1);
  });

  it('clicking an uncompleted li adds XP and increments totalCompleted', () => {
    localStorage.setItem('totalXP', '0');
    const rows = [{ id: 1, title: 'Push-Ups [0/20]', completed: 0 }];
    const { mockDb } = createSQLiteMock({ rows });
    (global as any)._setDb(mockDb);
    (global as any).init();
    document.querySelector('.center ul li').click();
    expect(localStorage.getItem('totalXP')).toBe('25');
    expect(localStorage.getItem('totalCompleted')).toBe('1');
  });

  it('clicking a completed li deducts XP and sets bar width directly', () => {
    localStorage.setItem('totalXP', '50');
    const rows = [{ id: 1, title: 'Push-Ups [0/20]', completed: 1 }];
    const { mockDb } = createSQLiteMock({ rows });
    (global as any)._setDb(mockDb);
    (global as any).init();
    document.querySelector('.center ul li').click();
    expect(parseInt(localStorage.getItem('totalXP'))).toBe(25);
    expect(document.getElementById('levelProgress').style.width).toBe('25%');
  });

  it('level-up path: animates bar to 100% then restarts from 0', () => {
    localStorage.setItem('totalXP', '96'); // level 1, 96% — next XP triggers level-up
    const rows = [{ id: 1, title: 'Push-Ups [0/20]', completed: 0 }];
    const { mockDb } = createSQLiteMock({ rows });
    (global as any)._setDb(mockDb);
    (global as any).init();
    document.querySelector('.center ul li').click();
    // newXP = 121 → level 2 (starts at 100, needs 200), progress = floor(21/200*100) = 10%
    jest.runAllTimers();
    expect(document.getElementById('levelProgress').style.width).toBe('10%');
  });

  it('handles DB error on objective update without crashing', () => {
    const rows = [{ id: 1, title: 'Push-Ups [0/20]', completed: 0 }];
    const { mockDb, mockTx } = createSQLiteMock({ rows });
    let callCount = 0;
    const origTransaction = mockDb.transaction.getMockImplementation();
    mockDb.transaction.mockImplementation((txCb, errCb, successCb) => {
      callCount++;
      if (callCount === 1) {
        // First call (SELECT * in init): succeed
        txCb(mockTx);
      } else {
        // Second call (UPDATE in click handler): fail
        errCb && errCb(new Error('update error'));
      }
    });
    (global as any)._setDb(mockDb);
    (global as any).init();
    expect(() => document.querySelector('.center ul li').click()).not.toThrow();
  });
});

// ── Level-up and Ascension omens ──────────────────────────────────────────────
//
// Both are raised from the ordeal click handler, after the Cosmo bar has
// finished refilling — so the announcement lands on a level the player can
// already see. That means these must run the bar animation out.

describe('level-up and ascension omens', () => {
  // Enough Cosmo that completing one ordeal crosses into level 2.
  function clickThroughLevelUp(startXP: number): void {
    localStorage.setItem('totalXP', String(startXP));
    const { mockDb } = createSQLiteMock({
      rows: [{ id: 1, title: 'Push-Ups [0/20]', completed: 0 }],
    });
    (global as any)._setDb(mockDb);
    (global as any).init();
    (document.querySelector('.center ul li') as HTMLElement).click();
    // animateBar ticks a setInterval every 10ms and the level-up path runs two
    // passes back to back, so the omen only lands after ~200 ticks. Advance
    // well past both rather than draining pending timers once.
    jest.advanceTimersByTime(5000);
  }

  it('raises a level omen when the level rises', () => {
    clickThroughLevelUp(95);
    const kinds = (global as any).readOmens().map((o: any) => o.k);
    expect(kinds).toContain('levelup');
  });

  it('raises no omen when the level does not rise', () => {
    clickThroughLevelUp(0);
    const kinds = (global as any).readOmens().map((o: any) => o.k);
    expect(kinds).not.toContain('levelup');
    expect(kinds).not.toContain('ascension');
  });

  // The old modals shared one element, so a level-up that also crossed a rank
  // boundary could only ever show one of the two. Omens must show both.
  it('raises the level omen AND the ascension when a rank boundary is crossed', () => {
    // Level 4 → 5 is the D-rank boundary in RANKS.
    const xpForLevel5 = (global as any).xpToLevel(5);
    clickThroughLevelUp(xpForLevel5 - 5);

    const kinds = (global as any).readOmens().map((o: any) => o.k);
    expect(kinds).toContain('levelup');
    expect(kinds).toContain('ascension');
  });

  it('names the rank and title in the ascension body', () => {
    const xpForLevel5 = (global as any).xpToLevel(5);
    clickThroughLevelUp(xpForLevel5 - 5);

    const ascension = (global as any).readOmens().find((o: any) => o.k === 'ascension');
    expect(ascension.b).toContain('D-Rank');
    expect(ascension.b).toContain('Bronze Saint');
  });
});

// ── pendingWipe — SQLite cleanup after Delete Account ─────────────────────────

describe('pendingWipe', () => {
  const sqlFor = (mockTx: any) =>
    mockTx.executeSql.mock.calls.map((c: any[]) => String(c[0]));

  it('empties the objectives table when the flag is present', () => {
    localStorage.setItem('lastOpened', new Date().toDateString());
    localStorage.setItem('pendingWipe', '1');
    const { mockTx } = createSQLiteMock({ rows: [{ count: 2, id: 1, title: 'Push-Ups [0/20]', completed: 0 }] });
    (global as any).onDeviceReady();
    expect(sqlFor(mockTx).some(s => /DELETE FROM objectives/i.test(s))).toBe(true);
  });

  it('clears the flag so the wipe happens exactly once', () => {
    localStorage.setItem('lastOpened', new Date().toDateString());
    localStorage.setItem('pendingWipe', '1');
    createSQLiteMock({ rows: [{ count: 2, id: 1, title: 'Push-Ups [0/20]', completed: 0 }] });
    (global as any).onDeviceReady();
    expect(localStorage.getItem('pendingWipe')).toBeNull();
  });

  it('leaves the table alone on a normal launch', () => {
    localStorage.setItem('lastOpened', new Date().toDateString());
    const { mockTx } = createSQLiteMock({ rows: [{ count: 2, id: 1, title: 'Push-Ups [0/20]', completed: 0 }] });
    (global as any).onDeviceReady();
    expect(sqlFor(mockTx).some(s => /DELETE FROM objectives/i.test(s))).toBe(false);
  });

  it('also empties day_log so a deleted account\'s history does not survive', () => {
    localStorage.setItem('lastOpened', new Date().toDateString());
    localStorage.setItem('pendingWipe', '1');
    const { mockTx } = createSQLiteMock({ rows: [{ count: 2, id: 1, title: 'Push-Ups [0/20]', completed: 0 }] });
    (global as any).onDeviceReady();
    expect(sqlFor(mockTx).some(s => /DELETE FROM day_log/i.test(s))).toBe(true);
    expect(sqlFor(mockTx).some(s => /DELETE FROM objectives/i.test(s))).toBe(true);
    expect(localStorage.getItem('pendingWipe')).toBeNull();
  });
});

// ── day_log bootstrap ─────────────────────────────────────────────────────────

describe('day_log bootstrap', () => {
  it('creates the day_log table on device ready', () => {
    localStorage.setItem('lastOpened', new Date().toDateString());
    // title/completed included so the same fallback row also satisfies init()'s
    // later `SELECT * FROM objectives` render pass without crashing on obj.title.
    const { mockTx } = createSQLiteMock({ rows: [{ count: 1, total: 1, done: 1, title: 'Push-Ups [0/20]', completed: 0 }] });
    onDeviceReady();
    const created = mockTx.executeSql.mock.calls
      .some((c: any[]) => c[0].indexOf('CREATE TABLE IF NOT EXISTS day_log') !== -1);
    expect(created).toBe(true);
  });
});

// ── lastOpenedISO migration ────────────────────────────────────────────────────

describe('lastOpenedISO migration', () => {
  it('derives lastOpenedISO from a legacy lastOpened value', () => {
    localStorage.setItem('lastOpened', 'Wed Jul 29 2026');
    expect(migrateLastOpenedISO()).toBe('2026-07-29');
    expect(localStorage.getItem('lastOpenedISO')).toBe('2026-07-29');
  });

  it('keeps an existing lastOpenedISO rather than re-deriving it', () => {
    localStorage.setItem('lastOpened', 'Wed Jul 29 2026');
    localStorage.setItem('lastOpenedISO', '2026-07-20');
    expect(migrateLastOpenedISO()).toBe('2026-07-20');
  });

  it('returns null for an unparseable legacy value', () => {
    localStorage.setItem('lastOpened', 'not a date');
    expect(migrateLastOpenedISO()).toBeNull();
    expect(localStorage.getItem('lastOpenedISO')).toBeNull();
  });

  it('returns null when there is no legacy value at all', () => {
    expect(migrateLastOpenedISO()).toBeNull();
  });

  it('writes lastOpenedISO on a first-ever launch', () => {
    const { mockDb } = createSQLiteMock({ rows: [{ total: 0, done: 0 }] });
    _setDb(mockDb);
    handleDailyReset(() => {});
    expect(localStorage.getItem('lastOpenedISO')).toBe(localDayKey(new Date()));
  });

  it('leaves lastOpened in its legacy format', () => {
    const { mockDb } = createSQLiteMock({ rows: [{ total: 0, done: 0 }] });
    _setDb(mockDb);
    handleDailyReset(() => {});
    expect(localStorage.getItem('lastOpened')).toBe(new Date().toDateString());
  });
});

// ── history on daily reset ────────────────────────────────────────────────────

describe('history on daily reset', () => {
  it('finalizes yesterday from the live objectives counts', () => {
    localStorage.setItem('lastOpened', 'old');
    localStorage.setItem('lastOpenedISO', dayKeyAddDays(localDayKey(new Date()), -1));
    localStorage.setItem('streak', '4');
    const { mockDb, mockTx } = createSQLiteMock({
      responses: { 'as total': [{ total: 5 }], 'as done': [{ done: 5 }], 'SELECT * FROM day_log': [] },
    });
    _setDb(mockDb);
    handleDailyReset(() => {});
    const yesterday = dayKeyAddDays(localDayKey(new Date()), -1);
    const write = mockTx.executeSql.mock.calls
      .find((c: any[]) => c[0].indexOf('INSERT OR REPLACE INTO day_log') !== -1);
    expect(write[1][0]).toBe(yesterday);
    expect(write[1][1]).toBe(5);  // done
    expect(write[1][2]).toBe(5);  // total
    // Pins call order: recordClosedDays must read 'streak' (set to '4' above)
    // BEFORE applyStreakAndPenalty overwrites it. If the two calls in
    // checkYesterdayCompletion were swapped, this would silently become 6.
    expect(write[1][4]).toBe(5);  // streak (closingStreak = 4 + 1)
  });

  it('backfills the days of a multi-day absence', () => {
    const todayKey = localDayKey(new Date());
    localStorage.setItem('lastOpened', 'old');
    localStorage.setItem('lastOpenedISO', dayKeyAddDays(todayKey, -4));
    const { mockDb, mockTx } = createSQLiteMock({
      responses: { 'as total': [{ total: 5 }], 'as done': [{ done: 0 }], 'SELECT * FROM day_log': [] },
    });
    _setDb(mockDb);
    handleDailyReset(() => {});
    const filled = mockTx.executeSql.mock.calls
      .filter((c: any[]) => c[0].indexOf('INSERT OR IGNORE INTO day_log') !== -1)
      .map((c: any[]) => c[1][0]);
    expect(filled).toEqual([
      dayKeyAddDays(todayKey, -3),
      dayKeyAddDays(todayKey, -2),
      dayKeyAddDays(todayKey, -1),
    ]);
  });

  it('deducts exactly one day of penalty however long the absence', () => {
    localStorage.setItem('lastOpened', 'old');
    localStorage.setItem('lastOpenedISO', dayKeyAddDays(localDayKey(new Date()), -10));
    localStorage.setItem('totalXP', '1000');
    const { mockDb } = createSQLiteMock({
      responses: { 'as total': [{ total: 5 }], 'as done': [{ done: 0 }], 'SELECT * FROM day_log': [] },
    });
    _setDb(mockDb);
    handleDailyReset(() => {});
    // 5 missed × 15 = 75, once — not once per absent day
    expect(localStorage.getItem('totalXP')).toBe('925');
  });

  it('writes no history when there are no objectives yet', () => {
    localStorage.setItem('lastOpened', 'old');
    const { mockDb, mockTx } = createSQLiteMock({
      responses: { 'as total': [{ total: 0 }], 'as done': [{ done: 0 }] },
    });
    _setDb(mockDb);
    handleDailyReset(() => {});
    const wrote = mockTx.executeSql.mock.calls
      .some((c: any[]) => c[0].indexOf('INTO day_log') !== -1);
    expect(wrote).toBe(false);
  });

  it('pins chronicleStart to the closed day, not today or yesterday, after a multi-day gap', () => {
    const todayKey = localDayKey(new Date());
    const lastKey = dayKeyAddDays(todayKey, -4);
    localStorage.setItem('lastOpened', 'old');
    localStorage.setItem('lastOpenedISO', lastKey);
    const { mockDb } = createSQLiteMock({
      responses: { 'as total': [{ total: 5 }], 'as done': [{ done: 0 }], 'SELECT * FROM day_log': [] },
    });
    _setDb(mockDb);
    handleDailyReset(() => {});
    expect(localStorage.getItem('chronicleStart')).toBe(lastKey);
    expect(localStorage.getItem('chronicleStart')).not.toBe(todayKey);
    expect(localStorage.getItem('chronicleStart')).not.toBe(dayKeyAddDays(todayKey, -1));
  });
});

// ── recordClosedDays guard clauses ────────────────────────────────────────────
// Both guards below are real, reachable defensive paths, not dead code:
// - !lastKey fires when lastOpened is present but unparseable — the shape of
//   a WebView localStorage eviction that leaves fitness.db intact.
//   migrateLastOpenedISO returns null in that case and does NOT set
//   lastOpenedISO, so recordClosedDays' lastKey stays null.
// - lastKey >= todayKey fires on a backward clock jump or a timezone move,
//   where lastOpenedISO is already today or later. Without this guard,
//   finalizeDay would INSERT OR REPLACE a current-or-future day's row with
//   the closed day's counts and pin chronicleStart wrongly.
// Both are driven end-to-end through handleDailyReset, exactly as they would
// fire in the app, rather than by calling recordClosedDays directly.

describe('recordClosedDays guard clauses', () => {
  it('writes nothing when lastOpened is unparseable, leaving lastOpenedISO unset, even with objectives present', () => {
    localStorage.setItem('lastOpened', 'not-a-date');
    const { mockDb, mockTx } = createSQLiteMock({
      responses: { 'as total': [{ total: 5 }], 'as done': [{ done: 0 }], 'SELECT * FROM day_log': [] },
    });
    _setDb(mockDb);
    handleDailyReset(() => {});
    const wrote = mockTx.executeSql.mock.calls
      .some((c: any[]) => c[0].indexOf('INTO day_log') !== -1);
    expect(wrote).toBe(false);
  });

  it('writes nothing when lastOpenedISO is already today or later (clock jump / timezone move)', () => {
    localStorage.setItem('lastOpened', 'old');
    localStorage.setItem('lastOpenedISO', dayKeyAddDays(localDayKey(new Date()), 2));
    const { mockDb, mockTx } = createSQLiteMock({
      responses: { 'as total': [{ total: 5 }], 'as done': [{ done: 0 }], 'SELECT * FROM day_log': [] },
    });
    _setDb(mockDb);
    handleDailyReset(() => {});
    const wrote = mockTx.executeSql.mock.calls
      .some((c: any[]) => c[0].indexOf('INTO day_log') !== -1);
    expect(wrote).toBe(false);
  });
});

// ── today's row on objective toggle ───────────────────────────────────────────

describe('today\'s row on objective toggle', () => {
  function toggleFirstObjective(responses: any) {
    localStorage.setItem('lastOpened', new Date().toDateString());
    const { mockDb, mockTx } = createSQLiteMock({ responses });
    _setDb(mockDb);
    init();
    (document.querySelector('.center ul li') as HTMLElement).click();
    return mockTx;
  }

  it('adds the objective\'s Cosmo to today\'s row', () => {
    const mockTx = toggleFirstObjective({
      'SELECT * FROM objectives': [{ id: 1, title: 'Push-Ups [0/20]', completed: 0 }],
      'SELECT * FROM day_log': [],
    });
    const todayKey = localDayKey(new Date());
    const write = mockTx.executeSql.mock.calls
      .find((c: any[]) => c[0].indexOf('INSERT OR REPLACE INTO day_log') !== -1);
    expect(write[1][0]).toBe(todayKey);
    expect(write[1][3]).toBe(25); // xp
  });

  it('subtracts on un-toggle and floors at zero', () => {
    const mockTx = toggleFirstObjective({
      'SELECT * FROM objectives': [{ id: 1, title: 'Push-Ups [0/20]', completed: 1 }],
      'SELECT * FROM day_log': [{ day: localDayKey(new Date()), done: 1, total: 5, xp: 10, streak: 0 }],
    });
    const write = mockTx.executeSql.mock.calls
      .find((c: any[]) => c[0].indexOf('INSERT OR REPLACE INTO day_log') !== -1);
    expect(write[1][3]).toBe(0);
  });

  it('records the day\'s done and total counts', () => {
    const mockTx = toggleFirstObjective({
      'SELECT * FROM objectives': [{ id: 1, title: 'Push-Ups [0/20]', completed: 0 }],
      'SELECT * FROM day_log': [],
    });
    const write = mockTx.executeSql.mock.calls
      .find((c: any[]) => c[0].indexOf('INSERT OR REPLACE INTO day_log') !== -1);
    expect(write[1][1]).toBe(1); // done
    expect(write[1][2]).toBe(1); // total — one objective in this fixture
  });

  // completedCount is the PRE-click count. Among 3 objectives with 2 already
  // complete, un-toggling one of the completed ones must bring done from 2
  // down to 1 — not up to 3. A sign flip in the +1/-1 branch would pass the
  // single-objective tests above (they only ever move 0<->1) but fails here.
  it('decrements done — not increments — on an un-toggle among multiple objectives', () => {
    const mockTx = toggleFirstObjective({
      'SELECT * FROM objectives': [
        { id: 1, title: 'Push-Ups [0/20]', completed: 1 },
        { id: 2, title: 'Sit-Ups [0/20]', completed: 1 },
        { id: 3, title: 'Squats [0/20]', completed: 0 },
      ],
      'SELECT * FROM day_log': [{ day: localDayKey(new Date()), done: 2, total: 3, xp: 50, streak: 0 }],
    });
    const write = mockTx.executeSql.mock.calls
      .find((c: any[]) => c[0].indexOf('INSERT OR REPLACE INTO day_log') !== -1);
    expect(write[1][1]).toBe(1); // done: completedCount(2) - 1, must not be 3
  });
});
