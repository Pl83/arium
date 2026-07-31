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
  if (r.total > 0 && r.done >= r.total) return 'full';
  // Cosmo earned is evidence of training whatever the denominator says: a
  // Trial-only day has total 0, but so does "seed the objectives, complete
  // none, then run a Trial" with total 5. Neither may render as empty.
  // monthSummary counts a trained day by this same rule — if the two diverge,
  // the calendar shows a missed day the summary above it counts as trained.
  return (r.done > 0 || r.xp > 0) ? 'partial' : 'missed';
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
