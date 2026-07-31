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
  // Walk BACKWARD from the day before toKey. When the cap trips on an absurd
  // gap — a device clock jump of years — the days kept are then the RECENT
  // ones. Walking forward would retain the oldest 366 days and silently drop
  // everything the player might actually care about.
  let cur = dayKeyAddDays(toKey, -1);
  while (cur > fromKey && days.length < MAX_BACKFILL_DAYS) {
    days.push(cur);
    cur = dayKeyAddDays(cur, -1);
  }
  days.reverse();   // restore ascending order for the inserts
  if (days.length === 0) {
    if (cb) cb();
    return;
  }
  db.transaction(tx => {
    days.forEach(d => {
      // VALUES (?, 0, ?, 0, 0) — the second placeholder is the THIRD column.
      // (?, ?, 0, 0, 0) would bind `total` into `done` and store 5/0 for a day
      // the player never opened. It still renders as "missed", so the error
      // is invisible; and INSERT OR IGNORE means a later release cannot
      // repair it.
      tx.executeSql(
        'INSERT OR IGNORE INTO day_log (day, done, total, xp, streak) VALUES (?, 0, ?, 0, 0)',
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
