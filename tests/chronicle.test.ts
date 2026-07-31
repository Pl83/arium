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
});
