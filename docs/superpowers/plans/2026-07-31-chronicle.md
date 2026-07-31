# The Chronicle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Arium a per-day history, stored in a new on-device SQLite table and surfaced as a month calendar on a new fifth navigation page.

**Architecture:** A new `day_log` table in the existing `fitness.db` holds one summary row per day. A dedicated module `src/daylog.ts` owns every read and write to it and is loaded by the three pages that need it. Writes hook into the existing daily-reset and objective-toggle paths in `index.ts` and the two completion paths in `trial.ts`. A new page `chronicle.html` reads the table and renders a month grid. No existing Cosmo amount, penalty, or localStorage key changes.

**Tech Stack:** TypeScript compiled with `module: "none"` to plain global scripts, Apache Cordova, `cordova-sqlite-storage`, vanilla DOM, Jest + ts-jest + jsdom.

**Spec:** `docs/superpowers/specs/2026-07-31-chronicle-design.md`

## Global Constraints

These apply to every task without being repeated.

- **No ES modules.** `tsconfig.json` sets `"module": "none"`. Files are global scripts loaded by `<script src>` in order. Never write `import` or `export` in `src/`. Cross-file references work because everything is a global.
- **Every `src/` file ends with the Jest export epilogue** — `if (typeof module !== 'undefined') { global.x = x; ...; module.exports = { x, ... }; }` preceded by `/* istanbul ignore else */`. Copy the shape from `src/shared.ts:104-131`.
- **Storage says XP, display says Cosmo.** The `day_log` column is `xp`. UI strings say "Cosmo". Never rename an existing localStorage key, SQLite column, CSS class, or DOM id.
- **Coverage gate is 95%** on lines, branches, functions and statements (`jest.config.js`). New `src/` files must be added to `collectCoverageFrom` and must meet it. `npm test` fails the build otherwise.
- **Types live in `src/types/globals.d.ts`.** No inline `interface` exports.
- **Callback style, not promises.** All SQLite work uses `db.transaction(txFn, errFn, successFn)`. Result callbacks are `(tx, resultSet)`. Do not introduce a promise wrapper.
- **`www/js/` is build output and gitignored.** Never edit it. Run `npm run build` to regenerate.
- **New CSS declares no `:root` block.** Tokens come from `www/css/theme.css`, which every page links first.
- **`GOAL_CONFIG` currently holds five goals** (`src/shared.ts:25`) — Push-Ups, Sit-Ups, Squats, Plank, Stretch. Never hardcode the count; read `.length` or store it per row.
- **Local dates only.** Never use `toISOString()` to derive a day key — it shifts to UTC and misfiles evening sessions.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/shared.ts` | Modify | Gains three date-key helpers used by every other file. |
| `src/types/globals.d.ts` | Modify | Gains `DayRow`, `DayPatch`, `CellState`. |
| `src/daylog.ts` | Create | Sole owner of the `day_log` table. Schema, upsert, backfill, reads. |
| `src/index.ts` | Modify | Creates the table; migrates `lastOpenedISO`; finalizes and backfills on reset; bumps on toggle. |
| `src/trial.ts` | Modify | Opens the DB and bumps the day's XP on the two completion paths. |
| `src/chronicle.ts` | Create | Chronicle page: grid model, cell states, streak maths, rendering. |
| `www/chronicle.html` | Create | Chronicle page markup. |
| `www/css/chronicle.css` | Create | Chronicle page styles. |
| `www/css/theme.css` | Modify | Adds Chronicle panel classes to the alias selector list. |
| `www/index.html`, `trial.html`, `profile.html`, `rankings.html` | Modify | Fifth footer nav slot. |
| `tests/helpers/sqlite-mock.ts` | Modify | Gains per-SQL responses. |
| `tests/daylog.test.ts`, `tests/chronicle.test.ts` | Create | Unit tests. |
| `tests/index.test.ts`, `tests/trial.test.ts` | Modify | Cover the new hooks. |

---

### Task 1: Date-key helpers

**Files:**
- Modify: `src/shared.ts` (add before the export epilogue at line 104)
- Test: `tests/shared.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `localDayKey(d: Date): string` — `'YYYY-MM-DD'` in local time
  - `parseDayKey(key: string): Date` — local midnight of that key
  - `dayKeyAddDays(key: string, n: number): string` — key shifted by n days

- [ ] **Step 1: Write the failing tests**

Add to `tests/shared.test.ts`:

```ts
describe('localDayKey', () => {
  it('formats a date as YYYY-MM-DD with zero padding', () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('uses local time, not UTC', () => {
    // 23:30 local on the 31st must stay the 31st, whatever the offset
    expect(localDayKey(new Date(2026, 6, 31, 23, 30))).toBe('2026-07-31');
  });
});

describe('parseDayKey', () => {
  it('returns local midnight for the key', () => {
    const d = parseDayKey('2026-07-31');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(31);
    expect(d.getHours()).toBe(0);
  });

  it('round-trips with localDayKey', () => {
    // 2024, not 2026 — 2026 is not a leap year, so 2026-02-29 does not exist
    // and new Date(2026, 1, 29) rolls over to 1 March.
    expect(localDayKey(parseDayKey('2024-02-29'))).toBe('2024-02-29');
  });
});

describe('dayKeyAddDays', () => {
  it('advances one day', () => {
    expect(dayKeyAddDays('2026-07-30', 1)).toBe('2026-07-31');
  });

  it('crosses a month boundary', () => {
    expect(dayKeyAddDays('2026-07-31', 1)).toBe('2026-08-01');
  });

  it('crosses a year boundary', () => {
    expect(dayKeyAddDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(dayKeyAddDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('goes backwards with a negative offset', () => {
    expect(dayKeyAddDays('2026-08-01', -1)).toBe('2026-07-31');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/shared.test.ts -t "localDayKey"`
Expected: FAIL with `ReferenceError: localDayKey is not defined`

- [ ] **Step 3: Implement**

Add to `src/shared.ts`, immediately before the `// === NODE/JEST EXPORT` comment:

```ts
// ── Date keys ──────────────────────────────────────────────────────────────
// 'YYYY-MM-DD' in LOCAL time. Never toISOString() — that shifts to UTC and
// files a 23:30 session under tomorrow for anyone east of Greenwich.

function localDayKey(d: Date): string {
  // ('0' + n).slice(-2), not padStart — padStart is ES2017 and tsconfig
  // declares lib: ["ES6", "DOM", "DOM.Iterable"], so it does not compile here.
  const m   = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  return d.getFullYear() + '-' + m + '-' + day;
}

// new Date('2026-07-31') parses as UTC midnight; the explicit constructor
// gives local midnight, which is what every comparison here assumes.
function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayKeyAddDays(key: string, n: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + n);
  return localDayKey(d);
}
```

- [ ] **Step 4: Add to the export epilogue**

In the `if (typeof module !== 'undefined')` block of `src/shared.ts`, add to both the `global.*` assignments and the `module.exports` object:

```ts
  global.localDayKey    = localDayKey;
  global.parseDayKey    = parseDayKey;
  global.dayKeyAddDays  = dayKeyAddDays;
```

and add `localDayKey, parseDayKey, dayKeyAddDays,` to the `module.exports = { ... }` list.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest tests/shared.test.ts`
Expected: PASS, all suites green

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add src/shared.ts tests/shared.test.ts
git commit -m "feat: add local date-key helpers for the Chronicle"
```

---

### Task 2: Extend the SQLite mock with per-query responses

**Files:**
- Modify: `tests/helpers/sqlite-mock.js` — **the file Jest actually loads**
- Modify: `tests/helpers/sqlite-mock.ts` — kept in sync; both are tracked
- Test: `tests/daylog.test.ts` (created in Task 3 — this task is verified by the existing suite staying green)

**⚠️ Both files must be edited.** `jest.config.js` does not set `moduleFileExtensions`, so
Node's default order applies and `js` precedes `ts`. `require('./helpers/sqlite-mock')`
therefore resolves **`sqlite-mock.js`**; the `.ts` file is currently dead weight that is
nonetheless tracked in git. Editing only the `.ts` changes nothing at runtime and every
later task's `responses` test fails with no visible cause. The two files differ today by
exactly one line — `window.sqlitePlugin` vs `(window as any).sqlitePlugin` — so keep that
difference and change nothing else about their relationship.

**Interfaces:**
- Consumes: nothing
- Produces: `createSQLiteMock({ rows, failOn, responses })` where `responses` is `Record<string, object[]>` mapping an SQL substring to the rows that query returns.

**Why:** The current mock returns the same `rows` for every query. The Chronicle issues distinguishable queries — a month range, a full scan, a single-day lookup — and a read-modify-write cycle whose correctness depends on what the SELECT returned. Without this, none of it is testable.

- [ ] **Step 1: Extend the mock**

Replace the body of `tests/helpers/sqlite-mock.ts` with:

```ts
/**
 * Creates a minimal synchronous SQLite mock that mirrors the Cordova plugin API.
 * rows:      default rows returned by any SELECT
 * responses: optional map of SQL-substring → rows, checked before `rows`.
 *            First matching substring wins, so keep keys distinctive.
 * failOn:    if true, the transaction error callback fires instead of success
 */
function createSQLiteMock({ rows = [], failOn = false, responses = null } = {}) {
  const pick = (sql) => {
    if (responses) {
      for (const frag of Object.keys(responses)) {
        if (sql.indexOf(frag) !== -1) return responses[frag];
      }
    }
    return rows;
  };

  const mockTx = {
    executeSql: jest.fn((sql, args, successCb) => {
      if (!successCb) return;
      const r = pick(sql);
      successCb(mockTx, {
        rows: { length: r.length, item: (i) => r[i] },
      });
    }),
  };

  const mockDb = {
    transaction: jest.fn((txCb, errCb, successCb) => {
      if (failOn) {
        errCb && errCb(new Error('mock DB error'));
        return;
      }
      txCb(mockTx);
      successCb && successCb();
    }),
  };

  (window as any).sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
  return { mockDb, mockTx };
}

module.exports = { createSQLiteMock };
```

Then apply the identical change to `tests/helpers/sqlite-mock.js`, substituting
`window.sqlitePlugin` for `(window as any).sqlitePlugin` on that one line — the only
difference between the two files.

The `rows` fallback is unchanged, so every existing call site behaves exactly as before.

- [ ] **Step 2: Run the whole suite to prove nothing regressed**

Run: `npm test`
Expected: PASS — the same test count as before this task, all green. If any test fails, the fallback path was broken; fix it before continuing.

- [ ] **Step 3: Commit**

```bash
git add tests/helpers/sqlite-mock.ts
git commit -m "test: allow per-query responses in the SQLite mock"
```

---

### Task 3: The `day_log` module

**Files:**
- Create: `src/daylog.ts`
- Modify: `src/types/globals.d.ts`
- Modify: `jest.config.js` (add `src/daylog.ts` to `collectCoverageFrom`)
- Test: `tests/daylog.test.ts`

**Interfaces:**
- Consumes: `localDayKey`, `parseDayKey`, `dayKeyAddDays` (Task 1)
- Produces:
  - `DAY_LOG_SCHEMA: string`
  - `createDayLogTable(tx: SQLiteTransaction): void`
  - `upsertDay(db: SQLiteDatabase, dayKey: string, patch: DayPatch, cb?: () => void): void`
  - `bumpToday(db: SQLiteDatabase, patch: DayPatch, cb?: () => void): void`
  - `finalizeDay(db: SQLiteDatabase, dayKey: string, done: number, total: number, streak: number, cb?: () => void): void`
  - `backfillGap(db: SQLiteDatabase, fromKey: string, toKey: string, total: number, cb?: () => void): void`
  - `readMonth(db: SQLiteDatabase, year: number, month: number, cb: (rows: DayRow[]) => void): void` — `month` is 1-12
  - `readAll(db: SQLiteDatabase, cb: (rows: DayRow[]) => void): void`
  - `ensureChronicleStart(dayKey: string): void`

- [ ] **Step 1: Add the types**

In `src/types/globals.d.ts`, before the `// ── Jest interop ──` section:

```ts
// ── Chronicle ──────────────────────────────────────────────────────────────

interface DayRow {
  day:    string;   // 'YYYY-MM-DD'
  done:   number;
  total:  number;
  xp:     number;
  streak: number;
}

// Every field optional: an omitted field leaves the stored value untouched.
// xpDelta is added to the stored xp, not assigned over it.
interface DayPatch {
  xpDelta?: number;
  done?:    number;
  total?:   number;
  streak?:  number;
}

type CellState = 'full' | 'partial' | 'missed' | 'blank';
```

- [ ] **Step 2: Write the failing tests**

Create `tests/daylog.test.ts`:

```ts
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

  it('stores the given total on every backfilled day', () => {
    const { mockDb, mockTx } = createSQLiteMock();
    backfillGap(mockDb, '2026-07-28', '2026-07-31', 5);
    expect(mockTx.executeSql.mock.calls[0][1]).toEqual(['2026-07-29', 5]);
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest tests/daylog.test.ts`
Expected: FAIL with `Cannot find module '../src/daylog'`

- [ ] **Step 4: Implement the module**

Create `src/daylog.ts`:

```ts
// Sole owner of the day_log table. Loaded on index.html, trial.html and
// chronicle.html. Does not open the database — the caller passes its handle
// in, so this module has no lifecycle of its own.

const DAY_LOG_SCHEMA = `CREATE TABLE IF NOT EXISTS day_log (
  day    TEXT PRIMARY KEY,
  done   INTEGER NOT NULL,
  total  INTEGER NOT NULL,
  xp     INTEGER NOT NULL,
  streak INTEGER NOT NULL
)`;

// A device whose clock jumps backwards years would otherwise try to write
// thousands of rows in one transaction on launch.
const MAX_BACKFILL_DAYS = 366;

const EMPTY_DAY: DayRow = { day: '', done: 0, total: 0, xp: 0, streak: 0 };

function createDayLogTable(tx: SQLiteTransaction): void {
  tx.executeSql(DAY_LOG_SCHEMA);
}

// The first day ever written. Cells before it render blank rather than
// missed — without this, every existing player opens the Chronicle to a wall
// of hollow cells for months during which the feature did not exist.
function ensureChronicleStart(dayKey: string): void {
  if (!localStorage.getItem('chronicleStart')) {
    localStorage.setItem('chronicleStart', dayKey);
  }
}

// Read-modify-write in one transaction. Deliberately not an UPSERT: the
// bundled SQLite version is not guaranteed to support ON CONFLICT, and an
// explicit SELECT is what makes the xp-accumulation rule testable.
function upsertDay(db: SQLiteDatabase, dayKey: string, patch: DayPatch, cb?: () => void): void {
  ensureChronicleStart(dayKey);
  db.transaction(tx => {
    tx.executeSql('SELECT * FROM day_log WHERE day = ?', [dayKey], (tx2, res) => {
      const prev = res.rows.length
        ? (res.rows.item(0) as unknown as DayRow)
        : EMPTY_DAY;
      const xp     = Math.max(0, prev.xp + (patch.xpDelta || 0));
      const done   = patch.done   === undefined ? prev.done   : patch.done;
      const total  = patch.total  === undefined ? prev.total  : patch.total;
      const streak = patch.streak === undefined ? prev.streak : patch.streak;
      tx2.executeSql(
        'INSERT OR REPLACE INTO day_log (day, done, total, xp, streak) VALUES (?, ?, ?, ?, ?)',
        [dayKey, done, total, xp, streak]
      );
    });
  }, err => {
    console.error('day_log upsert error', err);
    if (cb) cb();
  }, () => {
    if (cb) cb();
  });
}

function bumpToday(db: SQLiteDatabase, patch: DayPatch, cb?: () => void): void {
  upsertDay(db, localDayKey(new Date()), patch, cb);
}

function finalizeDay(
  db: SQLiteDatabase, dayKey: string, done: number, total: number, streak: number, cb?: () => void
): void {
  upsertDay(db, dayKey, { done: done, total: total, streak: streak }, cb);
}

// Writes 0/total rows for every date STRICTLY between the bounds.
// INSERT OR IGNORE, never REPLACE — a real row must never be overwritten by
// a backfill.
function backfillGap(
  db: SQLiteDatabase, fromKey: string, toKey: string, total: number, cb?: () => void
): void {
  const days: string[] = [];
  let cur = dayKeyAddDays(fromKey, 1);
  while (cur < toKey && days.length < MAX_BACKFILL_DAYS) {
    days.push(cur);
    cur = dayKeyAddDays(cur, 1);
  }
  if (days.length === 0) {
    if (cb) cb();
    return;
  }
  db.transaction(tx => {
    days.forEach(d => {
      tx.executeSql(
        'INSERT OR IGNORE INTO day_log (day, done, total, xp, streak) VALUES (?, ?, 0, 0, 0)',
        [d, total]
      );
    });
  }, err => {
    console.error('day_log backfill error', err);
    if (cb) cb();
  }, () => {
    if (cb) cb();
  });
}

function readRange(db: SQLiteDatabase, fromKey: string, toKey: string, cb: (rows: DayRow[]) => void): void {
  let out: DayRow[] = [];
  db.transaction(tx => {
    tx.executeSql(
      'SELECT * FROM day_log WHERE day >= ? AND day <= ? ORDER BY day ASC',
      [fromKey, toKey],
      (_tx, res) => {
        const rows: DayRow[] = [];
        for (let i = 0; i < res.rows.length; i++) {
          rows.push(res.rows.item(i) as unknown as DayRow);
        }
        out = rows;
      }
    );
  }, err => {
    console.error('day_log read error', err);
    cb([]);
  }, () => {
    cb(out);
  });
}

// month is 1-12. Day 0 of the next month is the last day of this one, which
// gets February right in leap years without a special case.
function readMonth(db: SQLiteDatabase, year: number, month: number, cb: (rows: DayRow[]) => void): void {
  const first = localDayKey(new Date(year, month - 1, 1));
  const last  = localDayKey(new Date(year, month, 0));
  readRange(db, first, last, cb);
}

function readAll(db: SQLiteDatabase, cb: (rows: DayRow[]) => void): void {
  readRange(db, '0000-01-01', '9999-12-31', cb);
}

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.DAY_LOG_SCHEMA      = DAY_LOG_SCHEMA;
  global.createDayLogTable   = createDayLogTable;
  global.ensureChronicleStart = ensureChronicleStart;
  global.upsertDay           = upsertDay;
  global.bumpToday           = bumpToday;
  global.finalizeDay         = finalizeDay;
  global.backfillGap         = backfillGap;
  global.readMonth           = readMonth;
  global.readAll             = readAll;
  module.exports = {
    DAY_LOG_SCHEMA, createDayLogTable, ensureChronicleStart, upsertDay,
    bumpToday, finalizeDay, backfillGap, readMonth, readAll,
  };
}
```

- [ ] **Step 5: Add the file to coverage collection**

In `jest.config.js`, add `'src/daylog.ts',` to the `collectCoverageFrom` array.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest tests/daylog.test.ts`
Expected: PASS, all describes green

- [ ] **Step 7: Verify coverage and typecheck**

```bash
npm run typecheck
npm run test:coverage
```
Expected: typecheck clean; `src/daylog.ts` at or above 95% on all four metrics.

- [ ] **Step 8: Commit**

```bash
git add src/daylog.ts src/types/globals.d.ts jest.config.js tests/daylog.test.ts
git commit -m "feat: add day_log module for Chronicle history"
```

---

### Task 4: Bootstrap the table and migrate the date key

**Files:**
- Modify: `src/index.ts` (the `db.transaction` block at lines 13-25, and `handleDailyReset` at line 71)
- Test: `tests/index.test.ts`

**Interfaces:**
- Consumes: `createDayLogTable`, `localDayKey` (Tasks 1, 3)
- Produces: `lastOpenedISO` in localStorage, always present after `handleDailyReset` runs; `day_log` table guaranteed to exist.

**Why:** `lastOpened` stores `toDateString()` output ("Wed Jul 31 2026"), which neither sorts nor compares. `backfillGap` needs a sortable key. Existing players must be migrated without touching `lastOpened`, which other code still reads.

- [ ] **Step 1: Write the failing tests**

Add to `tests/index.test.ts`:

```ts
describe('day_log bootstrap', () => {
  it('creates the day_log table on device ready', () => {
    localStorage.setItem('lastOpened', new Date().toDateString());
    const { mockTx } = createSQLiteMock({ rows: [{ count: 1, total: 1, done: 1 }] });
    onDeviceReady();
    const created = mockTx.executeSql.mock.calls
      .some((c: any[]) => c[0].indexOf('CREATE TABLE IF NOT EXISTS day_log') !== -1);
    expect(created).toBe(true);
  });
});

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/index.test.ts -t "day_log bootstrap"`
Expected: FAIL — no `CREATE TABLE IF NOT EXISTS day_log` is issued

- [ ] **Step 3: Create the table**

In `src/index.ts`, inside the existing `db.transaction` in `onDeviceReady`, immediately after the `objectives` `CREATE TABLE` call and before the `pendingWipe` check:

```ts
    createDayLogTable(tx);
```

- [ ] **Step 3b: Load `daylog.js` on the home page**

In `www/index.html`, add `<script src="js/daylog.js"></script>` between the `shared.js` and
`index.js` tags. Order matters: `daylog.js` needs `localDayKey` from `shared.js`, and
`index.js` needs `createDayLogTable` from `daylog.js`.

**This cannot wait for Task 10.** From this task onward `index.ts` calls into `daylog.js`
at runtime, and the Jest suite will not catch its absence — `tests/setup.ts` requires the
modules directly, bypassing the page's script tags entirely. Without this line the browser
build throws `ReferenceError` on launch while every test stays green.

- [ ] **Step 4: Migrate the date key**

Replace `handleDailyReset` (`src/index.ts:71-80`) with:

```ts
// lastOpened holds toDateString() output ("Wed Jul 31 2026"), which neither
// sorts nor compares. lastOpenedISO carries the same instant in 'YYYY-MM-DD'
// form for the Chronicle. lastOpened itself is left untouched — other code
// still reads it.
function migrateLastOpenedISO(): string | null {
  const iso = localStorage.getItem('lastOpenedISO');
  if (iso) return iso;
  const legacy = localStorage.getItem('lastOpened');
  if (!legacy) return null;
  const parsed = new Date(legacy);
  if (isNaN(parsed.getTime())) return null;
  const derived = localDayKey(parsed);
  localStorage.setItem('lastOpenedISO', derived);
  return derived;
}

function handleDailyReset(callback: () => void): void {
  const today = new Date().toDateString();
  const todayKey = localDayKey(new Date());
  const lastOpened = localStorage.getItem('lastOpened');
  migrateLastOpenedISO();

  if (lastOpened !== today) {
    localStorage.setItem('lastOpened', today);
    // lastOpenedISO is advanced only AFTER the history write, because
    // recordClosedDays (Task 5) reads it to learn where the gap starts.
    checkYesterdayCompletion(() => {
      localStorage.setItem('lastOpenedISO', todayKey);
      resetObjectives(callback);
    });
  } else {
    localStorage.setItem('lastOpenedISO', todayKey);
    callback();
  }
}
```

**Do not change `checkYesterdayCompletion`'s signature.** `tests/index.test.ts:345` calls it as `checkYesterdayCompletion(next)`, and Task 5 keeps that arity by having the new code read `lastOpenedISO` from localStorage itself. Deferring the advance above is what makes that possible.

- [ ] **Step 5: Export the new function**

Add `migrateLastOpenedISO` to both the `global.*` block and `module.exports` at the bottom of `src/index.ts`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest tests/index.test.ts`
Expected: PASS — including every pre-existing test in the file.

- [ ] **Step 7: Typecheck and commit**

```bash
npm run typecheck
git add src/index.ts tests/index.test.ts
git commit -m "feat: create day_log table and migrate to a sortable date key"
```

---

### Task 5: Finalize and backfill on daily reset

**Files:**
- Modify: `src/index.ts` (`checkYesterdayCompletion`, line 82)
- Test: `tests/index.test.ts`

**Interfaces:**
- Consumes: `finalizeDay`, `backfillGap`, `dayKeyAddDays`, `localDayKey` (Tasks 1, 3)
- Produces: nothing new; `checkYesterdayCompletion(lastKey, next)` now writes history.

**Why:** This is where yesterday's live `objectives` state is still readable, and where the gap since `lastOpenedISO` is known. `applyStreakAndPenalty` is deliberately left alone — history must not change any player's Cosmo.

- [ ] **Step 1: Write the failing tests**

Add to `tests/index.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/index.test.ts -t "history on daily reset"`
Expected: FAIL — no `INSERT OR REPLACE INTO day_log` call is made

- [ ] **Step 3: Implement**

Replace `checkYesterdayCompletion` in `src/index.ts` with:

```ts
// Runs on the first launch of a new day. The objectives table still holds
// YESTERDAY's final state at this moment, which is what makes the history
// write possible here and nowhere else.
function checkYesterdayCompletion(next: () => void): void {
  db.transaction(tx => {
    tx.executeSql('SELECT COUNT(*) as total FROM objectives', [], (tx, res) => {
      const total = (res.rows.item(0) as { total: number }).total;
      tx.executeSql('SELECT COUNT(*) as done FROM objectives WHERE completed = 1', [], (_tx, res2) => {
        const done = (res2.rows.item(0) as { done: number }).done;
        recordClosedDays(total, done);
        applyStreakAndPenalty(total, done);
      });
    });
  }, err => {
    console.error('Completion check error', err);
    next();
  }, () => {
    next();
  });
}

// Writes the day just ended, then fills the days the app never saw.
// Reads lastOpenedISO itself rather than taking it as a parameter, which
// keeps checkYesterdayCompletion's arity unchanged for existing callers.
// Deliberately separate from applyStreakAndPenalty: the record is written
// here, the punishment is decided there, and adding history must not change
// any player's Cosmo by a single point.
function recordClosedDays(total: number, done: number): void {
  const lastKey = localStorage.getItem('lastOpenedISO');
  if (total === 0 || !lastKey) return;
  const todayKey = localDayKey(new Date());
  if (lastKey >= todayKey) return;

  const streak = parseInt(localStorage.getItem('streak') || '0', 10);
  const closingStreak = done === total ? streak + 1 : 0;

  finalizeDay(db, lastKey, done, total, closingStreak);
  backfillGap(db, lastKey, todayKey, total);
}
```

- [ ] **Step 4: Export the new function**

Add `recordClosedDays` to both the `global.*` block and `module.exports` at the bottom of `src/index.ts`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest tests/index.test.ts`
Expected: PASS — every test in the file, old and new

- [ ] **Step 6: Confirm no Cosmo behaviour changed**

Run: `npm test`
Expected: PASS. Any pre-existing penalty or streak test that now fails means `applyStreakAndPenalty` was touched — revert that part.

- [ ] **Step 7: Commit**

```bash
npm run typecheck
git add src/index.ts tests/index.test.ts
git commit -m "feat: record closed and absent days in the Chronicle"
```

---

### Task 6: Record today's progress as it happens

**Files:**
- Modify: `src/index.ts` (the toggle handler success callback, around line 289)
- Test: `tests/index.test.ts`

**Interfaces:**
- Consumes: `bumpToday` (Task 3)
- Produces: nothing new

- [ ] **Step 1: Write the failing tests**

Add to `tests/index.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/index.test.ts -t "today's row on objective toggle"`
Expected: FAIL — no `day_log` write occurs on toggle

- [ ] **Step 3: Implement**

In `src/index.ts`, inside `init()`, the click handler currently opens a transaction and does its UI work in the success callback. The objective counts are already in scope as `total` and `completedCount` from the enclosing `SELECT * FROM objectives`.

Add this as the **first** statement of the transaction success callback, immediately before `const oldXP = getTotalXP();`:

```ts
            // completedCount reflects the list as rendered, before this click
            const dayDone = completedCount + (newCompleted === 1 ? 1 : -1);
            bumpToday(db, { xpDelta: xpDelta, done: dayDone, total: total });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
npm run typecheck
npm test
git add src/index.ts tests/index.test.ts
git commit -m "feat: record objective toggles in today's Chronicle row"
```

---

### Task 7: Record Trial-mode Cosmo

**Files:**
- Modify: `src/trial.ts` (`showComplete` line 552, `showChallengeComplete` line 581, and the top-level state block)
- Modify: `www/trial.html` (add the `daylog.js` script tag)
- Test: `tests/trial.test.ts`

**Interfaces:**
- Consumes: `bumpToday` (Task 3)
- Produces: nothing new

**Why:** Trial mode currently awards Cosmo and forgets the event — `trial.ts` has no database handle at all. A day spent entirely in Trial mode would otherwise record as empty. `trial.ts` must NOT query `objectives`; it passes `xpDelta` alone and leaves `done`/`total` to `index.ts`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/trial.test.ts`:

`tests/trial.test.ts` already drives these screens through the module object —
`trialModule.showComplete()` — and sets state with the exported `setS` helper
(`src/trial.ts:646`). Follow that idiom exactly; do not introduce a second mechanism.

```ts
describe('Chronicle recording', () => {
  const SOLO_STATE = (setsCompleted: number) => ({
    mode: 'solo' as const,
    ex: { name: 'Push-Ups', type: 'reps' as const, stat: 'strength' as const, step: 1, min: 1 },
    sets: setsCompleted, target: 20, currentSet: setsCompleted,
    setsCompleted: setsCompleted, reps: 0, timeLeft: 0,
  });

  it('records solo trial Cosmo against today', () => {
    const { mockDb, mockTx } = createSQLiteMock({ responses: { 'SELECT * FROM day_log': [] } });
    (window as any).sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
    trialModule.openTrialDb();
    trialModule.setS(SOLO_STATE(2));
    trialModule.showComplete();
    const write = mockTx.executeSql.mock.calls
      .find((c: any[]) => c[0].indexOf('INSERT OR REPLACE INTO day_log') !== -1);
    expect(write[1][0]).toBe(localDayKey(new Date()));
    expect(write[1][3]).toBeGreaterThan(0);
  });

  it('leaves done and total untouched for a trial-only day', () => {
    const { mockDb, mockTx } = createSQLiteMock({ responses: { 'SELECT * FROM day_log': [] } });
    (window as any).sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
    trialModule.openTrialDb();
    trialModule.setS(SOLO_STATE(1));
    trialModule.showComplete();
    const write = mockTx.executeSql.mock.calls
      .find((c: any[]) => c[0].indexOf('INSERT OR REPLACE INTO day_log') !== -1);
    expect(write[1][1]).toBe(0); // done
    expect(write[1][2]).toBe(0); // total
  });

  it('adds to an existing row rather than creating a second one', () => {
    const todayKey = localDayKey(new Date());
    const existing = [{ day: todayKey, done: 3, total: 5, xp: 75, streak: 0 }];
    const { mockDb, mockTx } = createSQLiteMock({ responses: { 'SELECT * FROM day_log': existing } });
    (window as any).sqlitePlugin = { openDatabase: jest.fn(() => mockDb) };
    trialModule.openTrialDb();
    trialModule.setS(SOLO_STATE(1));
    trialModule.showComplete();
    const writes = mockTx.executeSql.mock.calls
      .filter((c: any[]) => c[0].indexOf('INSERT OR REPLACE INTO day_log') !== -1);
    expect(writes.length).toBe(1);
    expect(writes[0][1][0]).toBe(todayKey);
    expect(writes[0][1][1]).toBe(3);   // done preserved
    expect(writes[0][1][2]).toBe(5);   // total preserved
    expect(writes[0][1][3]).toBeGreaterThan(75); // xp accumulated
  });

  it('does not throw when the SQLite plugin is absent', () => {
    delete (window as any).sqlitePlugin;
    expect(() => trialModule.openTrialDb()).not.toThrow();
    trialModule.setS(SOLO_STATE(1));
    expect(() => trialModule.showComplete()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/trial.test.ts -t "Chronicle recording"`
Expected: FAIL with `openTrialDb is not defined`

- [ ] **Step 3: Implement the database handle**

Near the top of `src/trial.ts`, after the existing constants:

```ts
// Trial mode has no database of its own; it opens fitness.db only to record
// the Cosmo it awards. On the browser platform, and in tests, the plugin may
// be absent — every use is guarded rather than assumed.
let trialDb: SQLiteDatabase | null = null;

function openTrialDb(): void {
  if (!window.sqlitePlugin) return;
  trialDb = window.sqlitePlugin.openDatabase({ name: 'fitness.db', location: 'default' });
  trialDb.transaction(tx => createDayLogTable(tx));
}

function recordTrialXP(xp: number): void {
  if (!trialDb) return;
  bumpToday(trialDb, { xpDelta: xp });
}
```

Call `openTrialDb()` from the existing `deviceready` handler in `trial.ts`. If there is no such handler, add one alongside the existing initialisation entry point, matching how `index.ts` does it at line 3.

- [ ] **Step 4: Hook both completion paths**

In `showComplete`, immediately after line 556 (`localStorage.setItem('totalXP', ...)`):

```ts
  recordTrialXP(xpActual);
```

In `showChallengeComplete`, immediately after line 585 (the equivalent line):

```ts
  recordTrialXP(xpActual);
```

- [ ] **Step 5: Add the script tag**

In `www/trial.html`, add `<script src="js/daylog.js"></script>` between the `shared.js` and `trial.js` tags. Order matters — `daylog.js` uses `localDayKey` from `shared.js`, and `trial.js` uses `bumpToday` from `daylog.js`.

- [ ] **Step 6: Export the new functions**

Add `openTrialDb` and `recordTrialXP` to both the `global.*` block and `module.exports` at the bottom of `src/trial.ts`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest tests/trial.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
npm run typecheck
npm test
git add src/trial.ts www/trial.html tests/trial.test.ts
git commit -m "feat: record Trial mode Cosmo in the Chronicle"
```

---

### Task 8: Chronicle page logic

**Files:**
- Create: `src/chronicle.ts`
- Modify: `jest.config.js` (add `src/chronicle.ts` to `collectCoverageFrom`)
- Test: `tests/chronicle.test.ts`

**Interfaces:**
- Consumes: `readMonth`, `readAll`, `localDayKey`, `parseDayKey`, `dayKeyAddDays` (Tasks 1, 3)
- Produces:
  - `cellState(row: DayRow | undefined, dayKey: string, startKey: string | null, todayKey: string): CellState`
  - `isFullDay(row: DayRow): boolean`
  - `monthGrid(year: number, month: number): (string | null)[]` — Monday-first, `null` for padding
  - `longestStreak(rows: DayRow[]): number`
  - `monthSummary(rows: DayRow[]): { trained: number; xp: number }`
  - `renderMonth(rows: DayRow[], year: number, month: number, todayKey: string): void`
  - `initChronicle(): void`

This task builds the pure logic and its tests. Task 9 builds the markup it renders into.

- [ ] **Step 1: Write the failing tests**

Create `tests/chronicle.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/chronicle.test.ts`
Expected: FAIL with `Cannot find module '../src/chronicle'`

- [ ] **Step 3: Implement the logic**

Create `src/chronicle.ts` with the pure functions. Rendering follows in Task 9; for now `renderMonth` and `initChronicle` are declared at the bottom and left to that task.

```ts
// Chronicle page. Reads day_log and renders a Monday-first month grid.

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_LABELS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

// A "full" day is one where every objective was completed — the same rule
// the streak counter in index.ts uses. A trial-only day (total 0) is real
// training but not a full day, so it never extends a streak.
function isFullDay(r: DayRow): boolean {
  return r.total > 0 && r.done >= r.total;
}

// Day keys are 'YYYY-MM-DD', so lexicographic comparison is chronological.
function cellState(
  r: DayRow | undefined, dayKey: string, startKey: string | null, todayKey: string
): CellState {
  if (!startKey || dayKey < startKey || dayKey > todayKey) return 'blank';
  if (!r) return 'missed';
  if (r.total > 0) {
    if (r.done >= r.total) return 'full';
    return r.done > 0 ? 'partial' : 'missed';
  }
  // No objective denominator: a trial-only day. Training without touching
  // the daily ordeals is not nothing and must not render as an empty day.
  return r.xp > 0 ? 'partial' : 'missed';
}

// Monday-first. Leading nulls pad the first week; the array ends on the
// month's last day with no trailing padding.
function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7; // JS Sunday=0 → Monday=0
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(localDayKey(new Date(year, month - 1, d)));
  return cells;
}

// Expects rows ascending by day, which readAll guarantees.
function longestStreak(rows: DayRow[]): number {
  let best = 0;
  let run = 0;
  let prevFull: string | null = null;
  for (const r of rows) {
    if (!isFullDay(r)) continue;
    run = (prevFull !== null && dayKeyAddDays(prevFull, 1) === r.day) ? run + 1 : 1;
    prevFull = r.day;
    if (run > best) best = run;
  }
  return best;
}

function monthSummary(rows: DayRow[]): { trained: number; xp: number } {
  let trained = 0;
  let xp = 0;
  for (const r of rows) {
    if (r.done > 0 || r.xp > 0) trained++;
    xp += r.xp;
  }
  return { trained: trained, xp: xp };
}

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.WEEKDAY_LABELS = WEEKDAY_LABELS;
  global.MONTH_LABELS   = MONTH_LABELS;
  global.isFullDay      = isFullDay;
  global.cellState      = cellState;
  global.monthGrid      = monthGrid;
  global.longestStreak  = longestStreak;
  global.monthSummary   = monthSummary;
  module.exports = {
    WEEKDAY_LABELS, MONTH_LABELS, isFullDay, cellState, monthGrid, longestStreak, monthSummary,
  };
}
```

- [ ] **Step 4: Add to coverage collection**

In `jest.config.js`, add `'src/chronicle.ts',` to `collectCoverageFrom`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest tests/chronicle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add src/chronicle.ts jest.config.js tests/chronicle.test.ts
git commit -m "feat: add Chronicle grid, cell-state and streak logic"
```

---

### Task 9: Chronicle page, markup and rendering

**Files:**
- Create: `www/chronicle.html`, `www/css/chronicle.css`
- Modify: `src/chronicle.ts` (add `renderMonth`, `initChronicle`, month navigation)
- Modify: `www/css/theme.css` (alias selector list at line 341)
- Test: `tests/chronicle.test.ts`

**Interfaces:**
- Consumes: everything from Task 8, plus `readMonth`, `readAll`
- Produces: `renderMonth`, `initChronicle`, `shiftMonth(delta: number): void`

- [ ] **Step 1: Write the failing rendering tests**

Add to `tests/chronicle.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/chronicle.test.ts -t "renderMonth"`
Expected: FAIL with `renderMonth is not defined`

- [ ] **Step 3: Implement rendering**

Add to `src/chronicle.ts`, before the export epilogue:

```ts
let viewYear = 0;
let viewMonth = 0;   // 1-12
let chronicleDb: SQLiteDatabase | null = null;

function renderMonth(rows: DayRow[], year: number, month: number, todayKey: string): void {
  const byDay: Record<string, DayRow> = {};
  rows.forEach(r => { byDay[r.day] = r; });
  const startKey = localStorage.getItem('chronicleStart');

  (document.getElementById('monthLabel') as HTMLElement).textContent =
    MONTH_LABELS[month - 1] + ' ' + year;

  const weekdayRow = document.getElementById('weekdayRow') as HTMLElement;
  weekdayRow.innerHTML = '';
  WEEKDAY_LABELS.forEach(l => {
    const s = document.createElement('span');
    s.className = 'weekday';
    s.textContent = l;
    weekdayRow.appendChild(s);
  });

  const grid = document.getElementById('monthGrid') as HTMLElement;
  grid.innerHTML = '';
  const detail = document.getElementById('dayDetail') as HTMLElement;
  detail.hidden = true;

  monthGrid(year, month).forEach(key => {
    if (key === null) {
      const pad = document.createElement('span');
      pad.className = 'day-pad';
      grid.appendChild(pad);
      return;
    }
    const state = cellState(byDay[key], key, startKey, todayKey);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'day-cell is-' + state;
    if (key === todayKey) cell.classList.add('is-today');
    cell.textContent = String(parseDayKey(key).getDate());
    if (state !== 'blank') {
      cell.addEventListener('click', () => showDayDetail(key, byDay[key]));
    }
    grid.appendChild(cell);
  });

  const summary = monthSummary(rows);
  (document.getElementById('monthLine') as HTMLElement).textContent =
    summary.trained + ' day' + (summary.trained === 1 ? '' : 's') + ' trained this month';
}

function showDayDetail(key: string, r: DayRow | undefined): void {
  const d = parseDayKey(key);
  (document.getElementById('detailDate') as HTMLElement).textContent =
    d.toDateString().toUpperCase();
  const done = r ? r.done : 0;
  const total = r ? r.total : 0;
  const xp = r ? r.xp : 0;
  (document.getElementById('detailBody') as HTMLElement).textContent =
    done + '/' + total + ' ordeals  ·  +' + xp + ' Cosmo';
  (document.getElementById('dayDetail') as HTMLElement).hidden = false;
}

// Clamped so the arrows never wander into empty centuries. A disabled arrow
// is left visible — a control that vanishes reads as a bug.
function clampMonthNav(todayKey: string): void {
  const startKey = localStorage.getItem('chronicleStart') || todayKey;
  const start = parseDayKey(startKey);
  const today = parseDayKey(todayKey);
  const atStart = viewYear === start.getFullYear() && viewMonth === start.getMonth() + 1;
  const atToday = viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1;
  (document.getElementById('prevMonth') as HTMLButtonElement).disabled = atStart;
  (document.getElementById('nextMonth') as HTMLButtonElement).disabled = atToday;
}

function loadMonth(): void {
  if (!chronicleDb) return;
  const todayKey = localDayKey(new Date());
  readMonth(chronicleDb, viewYear, viewMonth, rows => {
    renderMonth(rows, viewYear, viewMonth, todayKey);
    clampMonthNav(todayKey);
  });
}

function shiftMonth(delta: number): void {
  const d = new Date(viewYear, viewMonth - 1 + delta, 1);
  viewYear = d.getFullYear();
  viewMonth = d.getMonth() + 1;
  loadMonth();
}

function renderStreakLine(rows: DayRow[]): void {
  const current = parseInt(localStorage.getItem('streak') || '0', 10);
  const best = Math.max(longestStreak(rows), current);
  (document.getElementById('streakLine') as HTMLElement).textContent =
    current + ' day streak  ·  best ' + best;
}

function initChronicle(): void {
  if (!window.sqlitePlugin) return;
  chronicleDb = window.sqlitePlugin.openDatabase({ name: 'fitness.db', location: 'default' });
  chronicleDb.transaction(tx => createDayLogTable(tx));

  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth() + 1;

  document.getElementById('prevMonth')!.addEventListener('click', () => shiftMonth(-1));
  document.getElementById('nextMonth')!.addEventListener('click', () => shiftMonth(1));

  readAll(chronicleDb, rows => renderStreakLine(rows));
  loadMonth();
}

document.addEventListener('deviceready', initChronicle, false);
```

Add `renderMonth`, `showDayDetail`, `clampMonthNav`, `loadMonth`, `shiftMonth`, `renderStreakLine`, `initChronicle` to both the `global.*` block and `module.exports`.

- [ ] **Step 4: Create the page markup**

Create `www/chronicle.html`, copying the `<head>` and footer structure from `www/rankings.html` exactly — same font links, same `theme.css` first, same meta and CSP. The body:

```html
<main class="app">
  <section class="chronicle-card">
    <p id="streakLine"></p>
    <p id="monthLine"></p>
    <div class="month-head">
      <button id="prevMonth" class="month-nav" aria-label="Previous month">◀</button>
      <h2 id="monthLabel"></h2>
      <button id="nextMonth" class="month-nav" aria-label="Next month">▶</button>
    </div>
    <div id="weekdayRow" class="weekday-row"></div>
    <div id="monthGrid" class="month-grid"></div>
    <div id="dayDetail" class="day-detail" hidden>
      <h3 id="detailDate"></h3>
      <p id="detailBody"></p>
    </div>
  </section>
</main>
```

Scripts at the end of body, in this order:

```html
<script src="cordova.js"></script>
<script src="js/shared.js"></script>
<script src="js/daylog.js"></script>
<script src="js/chronicle.js"></script>
```

`theme.js` goes in the `<head>` via `<script src>`, exactly as on the other four pages. Never inline — the CSP is `default-src 'self'` with no `script-src`, and moving it to end-of-body reintroduces a flash of the OS palette on every navigation.

- [ ] **Step 5: Create the stylesheet**

Create `www/css/chronicle.css`. It declares **no `:root` block** — every colour is a `var(--…)` from `theme.css`.

```css
.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.day-cell {
  aspect-ratio: 1;
  border: 1px solid transparent;
  background: none;
  color: var(--fg);
  font-family: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.day-cell.is-full    { background: var(--gold); color: var(--gold-ink); }
.day-cell.is-partial { border-color: var(--gold); color: var(--gold); }
.day-cell.is-missed  { border-color: var(--gold-soft); color: var(--fg-muted); }
.day-cell.is-blank   { color: var(--fg-dim); cursor: default; }
.day-cell.is-today   { outline: 2px solid var(--gold); outline-offset: 1px; }

.weekday { color: var(--fg-dim); font-size: 0.7rem; text-align: center; }

.month-nav {
  background: none;
  border: none;
  color: var(--gold);
  cursor: pointer;
}
.month-nav[disabled] { color: var(--fg-dim); cursor: default; }
```

These are the real token names, verified against `www/css/theme.css` — the dark palette
declares them at lines 42-56 and 125, and the Marble mapping blocks below re-point the
same names. Using any token not declared there yields a transparent colour with no error.

- [ ] **Step 6: Register the panel classes for theming**

In `www/css/theme.css`, add `.chronicle-card,` and `.day-detail,` to the alias selector list at line 341 so both inherit the panel treatment.

Add **only** `.chronicle-card` to the corner-bracket block at line 365. The month grid is a dense element; brackets on `.day-detail` or on the grid itself would collide with row content, which is the documented reason dense list cards are excluded.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest tests/chronicle.test.ts`
Expected: PASS

- [ ] **Step 8: Build and check coverage**

```bash
npm run typecheck
npm run build
npm run test:coverage
```
Expected: typecheck clean, build emits `www/js/chronicle.js` and `www/js/daylog.js`, coverage at or above 95% on `src/chronicle.ts`.

- [ ] **Step 9: Commit**

```bash
git add www/chronicle.html www/css/chronicle.css www/css/theme.css src/chronicle.ts tests/chronicle.test.ts
git commit -m "feat: add the Chronicle page"
```

---

### Task 10: Fifth navigation slot

**Files:**
- Modify: `www/index.html`, `www/trial.html`, `www/profile.html`, `www/rankings.html`, `www/chronicle.html`

**Interfaces:**
- Consumes: `www/chronicle.html` (Task 9)
- Produces: nothing

- [ ] **Step 1: Add the nav entry to all five pages**

In each of the five pages, inside `<nav>`, between the Ordeals link and the Ranks link:

```html
<a href="chronicle.html">
    <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="8" cy="14" r="1.2" fill="currentColor"/>
        <circle cx="12" cy="14" r="1.2" fill="currentColor"/>
        <circle cx="16" cy="18" r="1.2" fill="currentColor"/>
    </svg>
    <span class="nav-label">Chronicle</span>
</a>
```

On `chronicle.html` this link carries `class="nav-active"`. On the other four it does not. On `chronicle.html`, remove `nav-active` from whichever link currently has it.

- [ ] **Step 2: Verify every page has five entries**

Run:
```bash
for f in www/index.html www/trial.html www/profile.html www/rankings.html www/chronicle.html; do echo -n "$f "; grep -c "nav-icon" $f; done
```
Expected: `5` for all five files.

- [ ] **Step 3: Verify the nav still fits**

```bash
npm run build
cordova run browser
```
Check at a 360px-wide viewport that all five labels are legible and none wrap. If they collide, shorten the label to "Log" rather than shrinking the font below the other four.

- [ ] **Step 4: Full verification**

```bash
npm run typecheck
npm test
npm run build
```
Expected: typecheck clean, all tests pass, build clean.

- [ ] **Step 5: Commit**

```bash
git add www/*.html
git commit -m "feat: add the Chronicle to the footer navigation"
```

---

## Manual verification

Automated tests cannot cover the daily-reset path, because it depends on the clock crossing midnight. Verify on a device or in the browser platform:

1. Complete some objectives today. Open the Chronicle — today's cell is partial or full, and the detail strip matches.
2. Run a Trial exercise. The Cosmo is added to today's existing cell, not a second one.
3. Change the device date forward by one day. Relaunch. Yesterday's cell is now fixed at its final state, and today's is empty.
4. Change the device date forward by four days. Relaunch. The three intervening cells are missed, today's is empty, and `totalXP` fell by exactly one day's penalty.
5. Toggle the theme on Profile, then open the Chronicle. Both palettes render correctly.
6. Turn on airplane mode. The Chronicle renders normally — it must never touch the network.
