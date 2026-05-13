// shared.ts is already on global via setup.ts
// Each test suite re-requires index.ts after resetting modules so module state is clean.
const { createSQLiteMock } = require('./helpers/sqlite-mock');

const INDEX_DOM = `
  <div id="levelProgress" style="width:0%">Lv.1 — 0%</div>
  <div id="nameTag"></div>
  <div id="overlay" style="display:none;"></div>
  <div id="info" style="display:none;">
    <div class="banner"><p></p></div>
  </div>
  <main class="app">
    <div class="center"><ul></ul></div>
    <div class="popup"></div>
  </main>
`;

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  jest.useFakeTimers();
  document.body.innerHTML = INDEX_DOM;
  jest.resetModules();
  // Re-load shared so its globals survive resetModules
  require('../src/shared');
  // notifications.ts must load before index.ts (mirrors browser script order)
  require('../src/notifications');
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

  it('shows the penalty modal after 200 ms', () => {
    localStorage.setItem('totalXP', '100');
    (global as any).applyStreakAndPenalty(4, 2);
    jest.advanceTimersByTime(200);
    const p = document.querySelector('#info .banner p');
    expect(p.textContent).toContain('2 objectives unfinished');
    expect(p.textContent).toContain('−30 XP');
  });
});

// ── showPenaltyModal ──────────────────────────────────────────────────────────

describe('showPenaltyModal', () => {
  it('makes overlay and info panel visible', () => {
    (global as any).showPenaltyModal(1, 15);
    expect(document.getElementById('overlay').style.display).toBe('block');
    expect(document.getElementById('info').style.display).toBe('block');
  });

  it('uses singular "objective" when missed = 1', () => {
    (global as any).showPenaltyModal(1, 15);
    expect(document.querySelector('#info .banner p').textContent)
      .toContain('1 objective unfinished');
  });

  it('uses plural "objectives" when missed > 1', () => {
    (global as any).showPenaltyModal(3, 45);
    expect(document.querySelector('#info .banner p').textContent)
      .toContain('3 objectives unfinished');
  });

  it('shows the correct XP penalty in the message', () => {
    (global as any).showPenaltyModal(2, 30);
    expect(document.querySelector('#info .banner p').textContent)
      .toContain('−30 XP');
  });

  it('dismisses on overlay click', () => {
    (global as any).showPenaltyModal(1, 15);
    document.getElementById('overlay').click();
    expect(document.getElementById('overlay').style.display).toBe('none');
    expect(document.getElementById('info').style.display).toBe('none');
  });
});

// ── refreshLevelBar ───────────────────────────────────────────────────────────

describe('refreshLevelBar', () => {
  it('sets bar width to the current progress %', () => {
    localStorage.setItem('totalXP', '50');
    (global as any).refreshLevelBar();
    expect(document.getElementById('levelProgress').style.width).toBe('50%');
  });

  it('shows correct level and progress in text content', () => {
    localStorage.setItem('totalXP', '150'); // level 2, progress 50%
    (global as any).refreshLevelBar();
    expect(document.getElementById('levelProgress').textContent).toBe('Lv.2 — 50%');
  });
});

// ── updateNameTag ─────────────────────────────────────────────────────────────

describe('updateNameTag', () => {
  it('shows Hunter — Novice by default', () => {
    (global as any).updateNameTag();
    expect(document.getElementById('nameTag').textContent).toBe('Hunter — Novice');
  });

  it('shows the stored player name', () => {
    localStorage.setItem('playerName', 'Zara');
    (global as any).updateNameTag();
    expect(document.getElementById('nameTag').textContent).toContain('Zara');
  });

  it('shows the correct rank title at level 10', () => {
    localStorage.setItem('totalXP', '900');
    (global as any).updateNameTag();
    expect(document.getElementById('nameTag').textContent).toContain('Warrior');
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
    // newXP = 121 → level 2, progress 21%; animateBar(96→100) then animateBar(0→21)
    jest.runAllTimers();
    expect(document.getElementById('levelProgress').style.width).toBe('21%');
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
