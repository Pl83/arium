// shared.ts is already on global via setup.ts
const { createSQLiteMock } = require('./helpers/sqlite-mock');

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  jest.resetModules();
  require('../src/shared');
  require('../src/daylog');
});

// Pulls the args of the first executeSql call whose SQL contains `frag`.
function sqlArgs(mockTx: any, frag: string): any[] | undefined {
  const call = mockTx.executeSql.mock.calls.find((c: any[]) => c[0].indexOf(frag) !== -1);
  return call && call[1];
}

describe('upsertDay', () => {
  it('creates a row from zero when the day is absent', () => {
    const { mockDb, mockTx } = createSQLiteMock({ responses: { 'SELECT': [] } });
    upsertDay(mockDb, '2026-07-31', { xpDelta: 25, done: 1, total: 5 });
    expect(sqlArgs(mockTx, 'INSERT OR REPLACE')).toEqual(['2026-07-31', 1, 5, 25, 0]);
  });

  it('adds xpDelta to the existing xp', () => {
    const existing = [{ day: '2026-07-31', done: 1, total: 5, xp: 25, streak: 3 }];
    const { mockDb, mockTx } = createSQLiteMock({ responses: { 'SELECT': existing } });
    upsertDay(mockDb, '2026-07-31', { xpDelta: 25 });
    expect(sqlArgs(mockTx, 'INSERT OR REPLACE')).toEqual(['2026-07-31', 1, 5, 50, 3]);
  });

  it('never drives xp below zero', () => {
    const existing = [{ day: '2026-07-31', done: 1, total: 5, xp: 10, streak: 0 }];
    const { mockDb, mockTx } = createSQLiteMock({ responses: { 'SELECT': existing } });
    upsertDay(mockDb, '2026-07-31', { xpDelta: -25 });
    expect(sqlArgs(mockTx, 'INSERT OR REPLACE')).toEqual(['2026-07-31', 1, 5, 0, 0]);
  });

  it('preserves done and total when the patch omits them', () => {
    const existing = [{ day: '2026-07-31', done: 4, total: 5, xp: 100, streak: 2 }];
    const { mockDb, mockTx } = createSQLiteMock({ responses: { 'SELECT': existing } });
    upsertDay(mockDb, '2026-07-31', { xpDelta: 30 });
    expect(sqlArgs(mockTx, 'INSERT OR REPLACE')).toEqual(['2026-07-31', 4, 5, 130, 2]);
  });

  it('records chronicleStart on first write and never moves it', () => {
    const { mockDb } = createSQLiteMock({ responses: { 'SELECT': [] } });
    upsertDay(mockDb, '2026-07-31', { xpDelta: 25 });
    expect(localStorage.getItem('chronicleStart')).toBe('2026-07-31');
    upsertDay(mockDb, '2026-08-05', { xpDelta: 25 });
    expect(localStorage.getItem('chronicleStart')).toBe('2026-07-31');
  });

  it('invokes the callback and logs on transaction failure', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { mockDb } = createSQLiteMock({ failOn: true });
    const cb = jest.fn();
    upsertDay(mockDb, '2026-07-31', { xpDelta: 25 }, cb);
    expect(cb).toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  // Not in the brief's Step 2 listing — added to reach the 95% coverage gate,
  // which requires exercising the cb-provided success path too.
  it('invokes the callback on transaction success', () => {
    const { mockDb } = createSQLiteMock({ responses: { 'SELECT': [] } });
    const cb = jest.fn();
    upsertDay(mockDb, '2026-07-31', { xpDelta: 25 }, cb);
    expect(cb).toHaveBeenCalled();
  });
});

describe('bumpToday', () => {
  it('targets today\'s key', () => {
    const todayKey = localDayKey(new Date());
    const { mockDb, mockTx } = createSQLiteMock({ responses: { 'SELECT': [] } });
    bumpToday(mockDb, { xpDelta: 15 });
    expect(sqlArgs(mockTx, 'INSERT OR REPLACE')![0]).toBe(todayKey);
  });

  it('leaves done and total at zero when the patch omits them', () => {
    const todayKey = localDayKey(new Date());
    const { mockDb, mockTx } = createSQLiteMock({ responses: { 'SELECT': [] } });
    bumpToday(mockDb, { xpDelta: 15 });
    expect(sqlArgs(mockTx, 'INSERT OR REPLACE')).toEqual([todayKey, 0, 0, 15, 0]);
  });
});

describe('finalizeDay', () => {
  it('sets done, total and streak while preserving accumulated xp', () => {
    const existing = [{ day: '2026-07-30', done: 2, total: 5, xp: 90, streak: 0 }];
    const { mockDb, mockTx } = createSQLiteMock({ responses: { 'SELECT': existing } });
    finalizeDay(mockDb, '2026-07-30', 5, 5, 7);
    expect(sqlArgs(mockTx, 'INSERT OR REPLACE')).toEqual(['2026-07-30', 5, 5, 90, 7]);
  });
});

describe('backfillGap', () => {
  it('writes the days strictly between the bounds', () => {
    const { mockDb, mockTx } = createSQLiteMock();
    backfillGap(mockDb, '2026-07-28', '2026-07-31', 5);
    const days = mockTx.executeSql.mock.calls
      .filter((c: any[]) => c[0].indexOf('INSERT OR IGNORE') !== -1)
      .map((c: any[]) => c[1][0]);
    expect(days).toEqual(['2026-07-29', '2026-07-30']);
  });

  it('writes nothing for consecutive days', () => {
    const { mockDb, mockTx } = createSQLiteMock();
    const cb = jest.fn();
    backfillGap(mockDb, '2026-07-30', '2026-07-31', 5, cb);
    expect(mockTx.executeSql).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalled();
  });

  it('spans a month boundary', () => {
    const { mockDb, mockTx } = createSQLiteMock();
    backfillGap(mockDb, '2026-07-30', '2026-08-02', 5);
    const days = mockTx.executeSql.mock.calls.map((c: any[]) => c[1][0]);
    expect(days).toEqual(['2026-07-31', '2026-08-01']);
  });

  it('spans a year boundary', () => {
    const { mockDb, mockTx } = createSQLiteMock();
    backfillGap(mockDb, '2026-12-30', '2027-01-02', 5);
    const days = mockTx.executeSql.mock.calls.map((c: any[]) => c[1][0]);
    expect(days).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('caps an absurd gap from a device clock jump', () => {
    const { mockDb, mockTx } = createSQLiteMock();
    backfillGap(mockDb, '2020-01-01', '2026-07-31', 5);
    expect(mockTx.executeSql.mock.calls.length).toBe(366);
  });

  it('keeps the most recent days when the cap trips', () => {
    const { mockDb, mockTx } = createSQLiteMock();
    backfillGap(mockDb, '2020-01-01', '2026-07-31', 5);
    const days = mockTx.executeSql.mock.calls
      .filter((c: any[]) => c[0].indexOf('INSERT OR IGNORE') !== -1)
      .map((c: any[]) => c[1][0]);
    expect(days.length).toBe(366);
    // The day before toKey must be present; the ancient end is what gets dropped.
    expect(days[days.length - 1]).toBe('2026-07-30');
  });

  it('binds the given total to the total column, not done', () => {
    const { mockDb, mockTx } = createSQLiteMock();
    backfillGap(mockDb, '2026-07-28', '2026-07-31', 5);
    // Asserting the bind array ALONE is worthless here: ['2026-07-29', 5] is
    // identical whether the 5 lands in `done` or in `total`. The SQL text is
    // what pins the column mapping.
    expect(mockTx.executeSql.mock.calls[0][0]).toContain('VALUES (?, 0, ?, 0, 0)');
    expect(mockTx.executeSql.mock.calls[0][1]).toEqual(['2026-07-29', 5]);
  });

  // Not in the brief's Step 2 listing — added to reach the 95% coverage gate,
  // which requires exercising the transaction error path too.
  it('invokes the callback and logs on transaction failure', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { mockDb } = createSQLiteMock({ failOn: true });
    const cb = jest.fn();
    backfillGap(mockDb, '2026-07-28', '2026-07-31', 5, cb);
    expect(cb).toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  // Not in the brief's Step 2 listing — added to reach the 95% coverage gate,
  // which requires exercising the cb-provided success path too.
  it('invokes the callback on transaction success', () => {
    const { mockDb } = createSQLiteMock();
    const cb = jest.fn();
    backfillGap(mockDb, '2026-07-28', '2026-07-31', 5, cb);
    expect(cb).toHaveBeenCalled();
  });
});

describe('readMonth', () => {
  it('queries the full calendar month inclusive', () => {
    const { mockDb, mockTx } = createSQLiteMock({ responses: { 'SELECT': [] } });
    readMonth(mockDb, 2026, 2, () => {});
    expect(sqlArgs(mockTx, 'SELECT')).toEqual(['2026-02-01', '2026-02-28']);
  });

  it('covers 29 days in a leap February', () => {
    const { mockDb, mockTx } = createSQLiteMock({ responses: { 'SELECT': [] } });
    readMonth(mockDb, 2028, 2, () => {});
    expect(sqlArgs(mockTx, 'SELECT')).toEqual(['2028-02-01', '2028-02-29']);
  });

  it('returns the rows to the callback', () => {
    const rows = [{ day: '2026-07-31', done: 5, total: 5, xp: 125, streak: 1 }];
    const { mockDb } = createSQLiteMock({ responses: { 'SELECT': rows } });
    const cb = jest.fn();
    readMonth(mockDb, 2026, 7, cb);
    expect(cb).toHaveBeenCalledWith(rows);
  });

  it('returns an empty array when the transaction fails', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { mockDb } = createSQLiteMock({ failOn: true });
    const cb = jest.fn();
    readMonth(mockDb, 2026, 7, cb);
    expect(cb).toHaveBeenCalledWith([]);
    spy.mockRestore();
  });
});

describe('readAll', () => {
  it('returns every row ascending', () => {
    const rows = [
      { day: '2026-07-30', done: 5, total: 5, xp: 125, streak: 1 },
      { day: '2026-07-31', done: 5, total: 5, xp: 125, streak: 2 },
    ];
    const { mockDb } = createSQLiteMock({ responses: { 'SELECT': rows } });
    const cb = jest.fn();
    readAll(mockDb, cb);
    expect(cb).toHaveBeenCalledWith(rows);
  });

  it('returns an empty array when the transaction fails', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { mockDb } = createSQLiteMock({ failOn: true });
    const cb = jest.fn();
    readAll(mockDb, cb);
    expect(cb).toHaveBeenCalledWith([]);
    spy.mockRestore();
  });
});

describe('createDayLogTable', () => {
  it('issues the CREATE TABLE IF NOT EXISTS statement', () => {
    const { mockTx } = createSQLiteMock();
    createDayLogTable(mockTx as any);
    expect(mockTx.executeSql.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS day_log');
  });
});
