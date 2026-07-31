const { createSQLiteMock } = require('./helpers/sqlite-mock');

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  jest.resetModules();
  require('../src/shared');
  require('../src/daylog');
  require('../src/chronicle');
});

const row = (day: string, done: number, total: number, xp = 0, streak = 0): DayRow =>
  ({ day, done, total, xp, streak });

describe('cellState', () => {
  const START = '2026-07-01';
  const TODAY = '2026-07-31';

  it('is blank before the chronicle started', () => {
    expect(cellState(undefined, '2026-06-30', START, TODAY)).toBe('blank');
  });

  it('is blank when no chronicle start is recorded at all', () => {
    expect(cellState(undefined, '2026-07-15', null, TODAY)).toBe('blank');
  });

  it('is blank for a future day', () => {
    expect(cellState(undefined, '2026-08-01', START, TODAY)).toBe('blank');
  });

  it('is missed when the day is in range but has no row', () => {
    expect(cellState(undefined, '2026-07-15', START, TODAY)).toBe('missed');
  });

  it('is full when every objective was completed', () => {
    expect(cellState(row('2026-07-15', 5, 5), '2026-07-15', START, TODAY)).toBe('full');
  });

  it('is partial when some objectives were completed', () => {
    expect(cellState(row('2026-07-15', 2, 5), '2026-07-15', START, TODAY)).toBe('partial');
  });

  it('is missed when none were completed', () => {
    expect(cellState(row('2026-07-15', 0, 5), '2026-07-15', START, TODAY)).toBe('missed');
  });

  it('is partial when no objective was completed but Cosmo was earned', () => {
    // Reachable: toggle an objective on then off (total 5, done 0), then run
    // a Trial. Must agree with monthSummary, which counts this day as trained.
    expect(cellState(row('2026-07-15', 0, 5, 40), '2026-07-15', START, TODAY)).toBe('partial');
  });

  it('is partial for a trial-only day with no objective denominator', () => {
    expect(cellState(row('2026-07-15', 0, 0, 40), '2026-07-15', START, TODAY)).toBe('partial');
  });

  it('is missed for an empty day with no objective denominator', () => {
    expect(cellState(row('2026-07-15', 0, 0, 0), '2026-07-15', START, TODAY)).toBe('missed');
  });

  it('treats today as in range', () => {
    expect(cellState(row(TODAY, 5, 5), TODAY, START, TODAY)).toBe('full');
  });
});

describe('monthGrid', () => {
  it('pads to Monday-first alignment', () => {
    // 1 July 2026 is a Wednesday → two leading nulls
    const grid = monthGrid(2026, 7);
    expect(grid[0]).toBeNull();
    expect(grid[1]).toBeNull();
    expect(grid[2]).toBe('2026-07-01');
  });

  it('ends on the last day of the month', () => {
    const grid = monthGrid(2026, 7).filter(Boolean);
    expect(grid[grid.length - 1]).toBe('2026-07-31');
    expect(grid.length).toBe(31);
  });

  it('handles a leap February', () => {
    const grid = monthGrid(2028, 2).filter(Boolean);
    expect(grid.length).toBe(29);
    expect(grid[28]).toBe('2028-02-29');
  });

  it('handles a non-leap February', () => {
    expect(monthGrid(2026, 2).filter(Boolean).length).toBe(28);
  });

  it('needs no padding when the month starts on a Monday', () => {
    // 1 June 2026 is a Monday
    expect(monthGrid(2026, 6)[0]).toBe('2026-06-01');
  });

  it('pads six slots when the month starts on a Sunday', () => {
    // 1 November 2026 is a Sunday
    const grid = monthGrid(2026, 11);
    expect(grid.slice(0, 6).every(c => c === null)).toBe(true);
    expect(grid[6]).toBe('2026-11-01');
  });
});

describe('longestStreak', () => {
  it('is zero with no rows', () => {
    expect(longestStreak([])).toBe(0);
  });

  it('counts consecutive full days', () => {
    expect(longestStreak([
      row('2026-07-01', 5, 5), row('2026-07-02', 5, 5), row('2026-07-03', 5, 5),
    ])).toBe(3);
  });

  it('breaks the run on a partial day', () => {
    expect(longestStreak([
      row('2026-07-01', 5, 5), row('2026-07-02', 2, 5), row('2026-07-03', 5, 5),
    ])).toBe(1);
  });

  it('breaks the run on a calendar gap even between full days', () => {
    expect(longestStreak([
      row('2026-07-01', 5, 5), row('2026-07-05', 5, 5),
    ])).toBe(1);
  });

  it('returns the longest of several runs', () => {
    expect(longestStreak([
      row('2026-07-01', 5, 5), row('2026-07-02', 5, 5),
      row('2026-07-04', 0, 5),
      row('2026-07-05', 5, 5), row('2026-07-06', 5, 5), row('2026-07-07', 5, 5),
    ])).toBe(3);
  });

  it('does not count a trial-only day as a streak day', () => {
    expect(longestStreak([row('2026-07-01', 0, 0, 40)])).toBe(0);
  });
});

describe('monthSummary', () => {
  it('counts days trained and Cosmo earned', () => {
    expect(monthSummary([
      row('2026-07-01', 5, 5, 125), row('2026-07-02', 2, 5, 50), row('2026-07-03', 0, 5, 0),
    ])).toEqual({ trained: 2, xp: 175 });
  });

  it('is zero for an empty month', () => {
    expect(monthSummary([])).toEqual({ trained: 0, xp: 0 });
  });

  it('agrees with cellState on a Cosmo-only day that has a denominator', () => {
    // total 5, done 0, xp 40 — cellState calls this partial, so the summary
    // must call it trained. These two rules diverging is the bug this pins.
    const rows = [row('2026-07-04', 0, 5, 40)];
    expect(monthSummary(rows).trained).toBe(1);
    expect(cellState(rows[0], '2026-07-04', '2026-07-01', '2026-07-31')).toBe('partial');
  });
});

describe('isTrainedDay', () => {
  it('is true when objectives were completed', () => {
    expect(isTrainedDay(row('2026-07-01', 2, 5))).toBe(true);
  });

  it('is true when Cosmo was earned with no objective denominator', () => {
    expect(isTrainedDay(row('2026-07-01', 0, 0, 40))).toBe(true);
  });

  it('is false for an empty day', () => {
    expect(isTrainedDay(row('2026-07-01', 0, 5, 0))).toBe(false);
  });
});

describe('trainedDaysTotal', () => {
  it('counts trained days across the whole history, agreeing with monthSummary', () => {
    const rows = [
      row('2026-06-01', 5, 5, 125), row('2026-06-02', 0, 5, 0), row('2026-07-01', 0, 0, 40),
    ];
    expect(trainedDaysTotal(rows)).toBe(2);
    expect(monthSummary(rows).trained).toBe(2);
  });

  it('is zero for an empty history', () => {
    expect(trainedDaysTotal([])).toBe(0);
  });
});

const CHRONICLE_DOM = `
  <section class="chronicle-card">
    <p id="streakLine"></p>
    <p id="monthLine"></p>
    <div class="month-head">
      <button id="prevMonth" aria-label="Previous month">◀</button>
      <h2 id="monthLabel"></h2>
      <button id="nextMonth" aria-label="Next month">▶</button>
    </div>
    <div id="weekdayRow"></div>
    <div id="monthGrid"></div>
    <div id="dayDetail" hidden>
      <h3 id="detailDate"></h3>
      <p id="detailBody"></p>
    </div>
  </section>
`;

describe('renderMonth', () => {
  beforeEach(() => { document.body.innerHTML = CHRONICLE_DOM; });

  it('labels the month and year', () => {
    renderMonth([], 2026, 7, '2026-07-31');
    expect(document.getElementById('monthLabel')!.textContent).toBe('JULY 2026');
  });

  it('renders one cell per day plus leading padding', () => {
    renderMonth([], 2026, 7, '2026-07-31');
    expect(document.querySelectorAll('#monthGrid .day-cell').length).toBe(31);
    expect(document.querySelectorAll('#monthGrid .day-pad').length).toBe(2);
  });

  it('applies the state class to each cell', () => {
    localStorage.setItem('chronicleStart', '2026-07-01');
    renderMonth([row('2026-07-01', 5, 5), row('2026-07-02', 2, 5)], 2026, 7, '2026-07-31');
    const cells = document.querySelectorAll('#monthGrid .day-cell');
    expect(cells[0].classList.contains('is-full')).toBe(true);
    expect(cells[1].classList.contains('is-partial')).toBe(true);
    expect(cells[2].classList.contains('is-missed')).toBe(true);
  });

  it('marks today', () => {
    localStorage.setItem('chronicleStart', '2026-07-01');
    renderMonth([], 2026, 7, '2026-07-15');
    const today = document.querySelector('#monthGrid .is-today');
    expect(today!.textContent).toBe('15');
  });

  it('renders an empty day_log without throwing', () => {
    expect(() => renderMonth([], 2026, 7, '2026-07-31')).not.toThrow();
  });

  it('appends the month\'s Cosmo total to the trained-days line', () => {
    renderMonth([row('2026-07-01', 5, 5, 125), row('2026-07-02', 2, 5, 50)], 2026, 7, '2026-07-31');
    expect(document.getElementById('monthLine')!.textContent).toBe('2 days trained this month  ·  175 Cosmo');
  });

  it('shows a day\'s detail when its cell is clicked', () => {
    localStorage.setItem('chronicleStart', '2026-07-01');
    renderMonth([row('2026-07-01', 5, 5, 125)], 2026, 7, '2026-07-31');
    (document.querySelector('#monthGrid .day-cell') as HTMLElement).click();
    expect(document.getElementById('dayDetail')!.hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('detailBody')!.textContent).toContain('5/5');
    expect(document.getElementById('detailBody')!.textContent).toContain('125');
  });

  it('does not open detail for a blank cell', () => {
    localStorage.setItem('chronicleStart', '2026-07-10');
    renderMonth([], 2026, 7, '2026-07-31');
    (document.querySelector('#monthGrid .day-cell') as HTMLElement).click();
    expect(document.getElementById('dayDetail')!.hasAttribute('hidden')).toBe(true);
  });

  it('shows a zeroed detail for a missed day with no row at all', () => {
    localStorage.setItem('chronicleStart', '2026-07-01');
    renderMonth([], 2026, 7, '2026-07-31');
    (document.querySelector('#monthGrid .day-cell.is-missed') as HTMLElement).click();
    expect(document.getElementById('dayDetail')!.hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('detailBody')!.textContent).toBe('0/0 ordeals  ·  +0 Cosmo');
  });
});

describe('renderStreakLine', () => {
  beforeEach(() => { document.body.innerHTML = CHRONICLE_DOM; });

  it('shows the current streak and the best of current/longest', () => {
    localStorage.setItem('streak', '3');
    renderStreakLine([row('2026-07-01', 5, 5), row('2026-07-02', 5, 5)]);
    expect(document.getElementById('streakLine')!.textContent)
      .toBe('3 day streak  ·  best 3  ·  2 days trained total');
  });

  it('defaults the current streak to 0 when unset', () => {
    renderStreakLine([]);
    expect(document.getElementById('streakLine')!.textContent)
      .toBe('0 day streak  ·  best 0  ·  0 days trained total');
  });

  it('reports the longest streak in history when it exceeds the current one', () => {
    localStorage.setItem('streak', '1');
    renderStreakLine([
      row('2026-07-01', 5, 5), row('2026-07-02', 5, 5), row('2026-07-03', 5, 5),
    ]);
    expect(document.getElementById('streakLine')!.textContent)
      .toBe('1 day streak  ·  best 3  ·  3 days trained total');
  });

  it('pluralizes correctly for a single trained day', () => {
    renderStreakLine([row('2026-07-01', 5, 5)]);
    expect(document.getElementById('streakLine')!.textContent).toContain('1 day trained total');
  });
});

describe('initChronicle / month navigation', () => {
  beforeEach(() => { document.body.innerHTML = CHRONICLE_DOM; });

  it('does nothing when the sqlite plugin is absent', () => {
    delete (window as any).sqlitePlugin;
    expect(() => (global as any).initChronicle()).not.toThrow();
    expect(document.getElementById('monthLabel')!.textContent).toBe('');
  });

  it('opens the db, renders the current month grid and the streak line', () => {
    const now = new Date();
    const expectedLabel = MONTH_LABELS[now.getMonth()] + ' ' + now.getFullYear();
    const { mockDb } = createSQLiteMock({ rows: [] });
    (window as any).sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
    localStorage.setItem('streak', '2');
    (global as any).initChronicle();
    expect((window as any).sqlitePlugin.openDatabase).toHaveBeenCalled();
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(document.getElementById('monthLabel')!.textContent).toBe(expectedLabel);
    expect(document.getElementById('streakLine')!.textContent).toContain('2 day streak');
  });

  it('navigates to the previous and back to the current month via the nav buttons', () => {
    const { mockDb } = createSQLiteMock({ rows: [] });
    (window as any).sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
    localStorage.setItem('chronicleStart', '2000-01-01');
    (global as any).initChronicle();
    // At the current month: nextMonth is clamped, prevMonth is open (start is far in the past).
    expect((document.getElementById('prevMonth') as HTMLButtonElement).disabled).toBe(false);
    expect((document.getElementById('nextMonth') as HTMLButtonElement).disabled).toBe(true);

    const currentLabel = document.getElementById('monthLabel')!.textContent;
    (document.getElementById('prevMonth') as HTMLElement).click();
    expect(document.getElementById('monthLabel')!.textContent).not.toBe(currentLabel);
    // Having stepped back, we are no longer at today: nextMonth re-enables.
    expect((document.getElementById('nextMonth') as HTMLButtonElement).disabled).toBe(false);

    (document.getElementById('nextMonth') as HTMLElement).click();
    expect(document.getElementById('monthLabel')!.textContent).toBe(currentLabel);
  });

  it('disables prevMonth at chronicleStart and nextMonth at the current month', () => {
    const { mockDb } = createSQLiteMock({ rows: [] });
    (window as any).sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
    localStorage.setItem('chronicleStart', localDayKey(new Date()));
    (global as any).initChronicle();
    expect((document.getElementById('prevMonth') as HTMLButtonElement).disabled).toBe(true);
    expect((document.getElementById('nextMonth') as HTMLButtonElement).disabled).toBe(true);
  });

  it('falls back to today as the clamp start when chronicleStart is unset', () => {
    const { mockDb } = createSQLiteMock({ rows: [] });
    (window as any).sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
    (global as any).initChronicle();
    expect((document.getElementById('prevMonth') as HTMLButtonElement).disabled).toBe(true);
    expect((document.getElementById('nextMonth') as HTMLButtonElement).disabled).toBe(true);
  });

  it('does nothing when shiftMonth is called before the db has ever been opened', () => {
    // No initChronicle() in this test — chronicleDb is still null module-wide
    // (jest.resetModules() in the top-level beforeEach guarantees a fresh module).
    expect(() => (global as any).shiftMonth(1)).not.toThrow();
    expect(document.getElementById('monthLabel')!.textContent).toBe('');
  });

  // ── Regression: clampMonthNav must be a range clamp, not an equality check ──
  // (src/chronicle.ts:135-136 pre-fix). Once the view slips past a bound it
  // must stay clamped — an exact-month equality check re-enables the arrow
  // the moment the view is no longer EXACTLY on the boundary month.

  it('keeps nextMonth disabled once the view moves past the current month', () => {
    const { mockDb } = createSQLiteMock({ rows: [] });
    (window as any).sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
    localStorage.setItem('chronicleStart', '2000-01-01');
    (global as any).initChronicle();
    expect((document.getElementById('nextMonth') as HTMLButtonElement).disabled).toBe(true);

    // Simulate a shift slipping past today (e.g. a tap that raced the clamp).
    (global as any).shiftMonth(1);
    expect((document.getElementById('nextMonth') as HTMLButtonElement).disabled).toBe(true);

    (global as any).shiftMonth(1);
    expect((document.getElementById('nextMonth') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps prevMonth disabled once the view moves before chronicleStart', () => {
    const { mockDb } = createSQLiteMock({ rows: [] });
    (window as any).sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
    localStorage.setItem('chronicleStart', localDayKey(new Date()));
    (global as any).initChronicle();
    expect((document.getElementById('prevMonth') as HTMLButtonElement).disabled).toBe(true);

    (global as any).shiftMonth(-1);
    expect((document.getElementById('prevMonth') as HTMLButtonElement).disabled).toBe(true);

    (global as any).shiftMonth(-1);
    expect((document.getElementById('prevMonth') as HTMLButtonElement).disabled).toBe(true);
  });
});
