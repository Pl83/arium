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

// A day counts as trained when it has completed objectives OR earned Cosmo
// (a Trial-only day has no objective denominator but is still real training).
// Shared by monthSummary and trainedDaysTotal so the two rules can never drift
// apart the way cellState and monthSummary once did.
function isTrainedDay(r: DayRow): boolean {
  return r.done > 0 || r.xp > 0;
}

function monthSummary(rows: DayRow[]): { trained: number; xp: number } {
  let trained = 0;
  let xp = 0;
  for (const r of rows) {
    if (isTrainedDay(r)) trained++;
    xp += r.xp;
  }
  return { trained: trained, xp: xp };
}

// Lifetime count for the summary strip's "days trained total" figure.
function trainedDaysTotal(rows: DayRow[]): number {
  return rows.filter(isTrainedDay).length;
}

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
    summary.trained + ' day' + (summary.trained === 1 ? '' : 's') + ' trained this month' +
    '  ·  ' + summary.xp + ' Cosmo';
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

// Single ordinal so "before/at/after" is one integer comparison instead of a
// year+month pair — a month is just its distance in months from year 0.
function monthOrdinal(year: number, month: number): number {
  return year * 12 + month;
}

// Clamped so the arrows never wander into empty centuries. A disabled arrow
// is left visible — a control that vanishes reads as a bug.
//
// Range checks, not equality: the view counts as clamped when it is AT OR
// BEYOND each bound. An exact-month equality check only holds the line at
// the boundary month itself — one step past it, the check goes false again
// and the "disabled" arrow silently re-enables, turning this into an
// unbounded navigator in that direction.
function clampMonthNav(todayKey: string): void {
  const startKey = localStorage.getItem('chronicleStart') || todayKey;
  const start = parseDayKey(startKey);
  const today = parseDayKey(todayKey);
  const view = monthOrdinal(viewYear, viewMonth);
  const startOrdinal = monthOrdinal(start.getFullYear(), start.getMonth() + 1);
  const todayOrdinal = monthOrdinal(today.getFullYear(), today.getMonth() + 1);
  const atStart = view <= startOrdinal;
  const atToday = view >= todayOrdinal;
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
  // Clamp synchronously, before the (potentially async, on-device) db round
  // trip in loadMonth() — button state must never lag one tap behind the view.
  clampMonthNav(localDayKey(new Date()));
  loadMonth();
}

function renderStreakLine(rows: DayRow[]): void {
  const current = parseInt(localStorage.getItem('streak') || '0', 10);
  const best = Math.max(longestStreak(rows), current);
  const total = trainedDaysTotal(rows);
  (document.getElementById('streakLine') as HTMLElement).textContent =
    current + ' day streak  ·  best ' + best +
    '  ·  ' + total + ' day' + (total === 1 ? '' : 's') + ' trained total';
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

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.WEEKDAY_LABELS = WEEKDAY_LABELS;
  global.MONTH_LABELS   = MONTH_LABELS;
  global.isFullDay      = isFullDay;
  global.cellState      = cellState;
  global.monthGrid      = monthGrid;
  global.longestStreak  = longestStreak;
  global.isTrainedDay      = isTrainedDay;
  global.monthSummary      = monthSummary;
  global.trainedDaysTotal  = trainedDaysTotal;
  global.renderMonth       = renderMonth;
  global.showDayDetail     = showDayDetail;
  global.monthOrdinal      = monthOrdinal;
  global.clampMonthNav     = clampMonthNav;
  global.loadMonth          = loadMonth;
  global.shiftMonth         = shiftMonth;
  global.renderStreakLine   = renderStreakLine;
  global.initChronicle      = initChronicle;
  module.exports = {
    WEEKDAY_LABELS, MONTH_LABELS, isFullDay, cellState, monthGrid, longestStreak,
    isTrainedDay, monthSummary, trainedDaysTotal,
    renderMonth, showDayDetail, monthOrdinal, clampMonthNav, loadMonth, shiftMonth, renderStreakLine, initChronicle,
  };
}
