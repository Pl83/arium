# The Chronicle — history & progression

**Date:** 2026-07-31
**Status:** Approved, ready for planning
**Branch:** `develop`

## Problem

Arium records no history. The `objectives` table (`src/index.ts:14`) holds four rows of
live state — title and a completed flag — and nothing else in the app is dated. The
`stats` object in localStorage is a lifetime counter that only ever grows. Trial runs are
recorded nowhere at all: a challenge is completed, Cosmo is awarded, and the event is gone.

A player cannot answer "how many days did I train in July?", cannot see a streak they are
no longer in, and cannot see improvement. For a fitness app this is the difference between
a tool and a toy.

## Constraint: the app is blind to days it was not opened

`handleDailyReset` (`src/index.ts:71`) compares `lastOpened` against today. Skip five days
and it fires exactly once. There is no mechanism — and, without background execution, no
possibility — for the app to observe a day on which it was never launched.

Every decision below inherits this. The Chronicle cannot report what happened on unseen
days; it can only report that they were unseen and treat them by an agreed rule.

## Decisions

| Question | Decision |
|---|---|
| What is recorded | One summary row per day. Not an event log. |
| How it is presented | Month calendar grid. |
| Where it lives | New page, fifth footer nav slot. |
| Unopened days | Backfilled as missed. **Cosmo penalty unchanged.** |
| Storage | On-device SQLite (`fitness.db`). Not Supabase. |

### On storage — explicitly

`day_log` is a local SQLite table created by the app at launch, exactly as `objectives` is.
**This feature requires no Supabase schema change, no RLS policy, and no SQL run by hand in
the Supabase console.** The Chronicle renders offline and never touches the network.

The consequence is accepted deliberately: this history dies with the device. Closing that
wound is the separate backup-and-restore campaign, and it is not in scope here.

## Data layer

### Schema

```sql
CREATE TABLE IF NOT EXISTS day_log (
  day    TEXT PRIMARY KEY,   -- 'YYYY-MM-DD', local time
  done   INTEGER NOT NULL,   -- objectives completed that day
  total  INTEGER NOT NULL,   -- objectives active that day
  xp     INTEGER NOT NULL,   -- earned that day; never negative
  streak INTEGER NOT NULL    -- streak value at the day's end
);
```

Created in the same `db.transaction` block as `objectives`, in `onDeviceReady`.

**`xp`, not `cosmo`.** The documented naming split holds: storage and wire speak XP, only
display strings say Cosmo. A new table is not a licence to break the rule — if new storage
picks whichever word feels right, the split stops being a convention and becomes a coin flip.

**`total` is stored per row, never assumed.** `GOAL_CONFIG` (`src/shared.ts:25`) currently
holds five goals — Push-Ups, Sit-Ups, Squats, Plank, Stretch — but it has changed before and
will change again. A row that carries its own denominator survives that; a hardcoded one
silently rewrites history every time the list grows.

**`xp` is earnings only, never negative.** Missed-day penalties are applied to `totalXP` by
the existing `applyStreakAndPenalty` and are not written into `day_log`. Mixing rewards and
punishments into one signed column would make "Cosmo earned this month" unanswerable.

### Module: `src/daylog.ts`

New module owning this table and nothing else. It does not open the database; the caller
passes its handle in, so the module has no lifecycle of its own and is trivially testable.

| Function | Purpose |
|---|---|
| `bumpToday(db, { xpDelta, done, total }, cb)` | Upsert today's row, summing `xp`. `done` and `total` are **optional**: when omitted the existing row's values are preserved, and a row created without them starts at `0/0`. |
| `finalizeDay(db, dayKey, done, total, streak, cb)` | Write a completed day. |
| `backfillGap(db, fromKey, toKey, total, cb)` | Write `0/total` rows for every date strictly between. |
| `readMonth(db, year, month, cb)` | Return that month's rows, ascending. |
| `readAll(db, cb)` | Return all rows — for longest-streak and lifetime totals. |

Callback style throughout, matching the existing Cordova SQLite code. No promise wrapper;
introducing one here would make this module the only async dialect in the codebase.

### Loaded on two pages

`index.html` and `trial.html` both load `daylog.js`. Trial mode currently has no database
handle at all — trial Cosmo is awarded and forgotten — so `trial.ts` must open `fitness.db`
to call `bumpToday`. Without this, a day spent entirely in Trial mode records as empty.

`chronicle.html` loads it read-only.

### Date keys

`lastOpened` stores `Date.prototype.toDateString()` output ("Wed Jul 31 2026"), which does
not sort and does not compare. Two additions:

- `localDayKey(date): string` in `src/shared.ts` — returns `YYYY-MM-DD` in **local** time.
  Never `toISOString()`, which shifts to UTC and will misfile a late-evening session as the
  following day for any player east of Greenwich.
- `lastOpenedISO` in localStorage — the same instant as `lastOpened`, in key form.

`lastOpened` is left in place and still written. Existing players derive `lastOpenedISO`
once, on first launch after the update, by parsing the old value. Nothing that currently
reads `lastOpened` changes.

### Start marker

`chronicleStart` in localStorage records the first day ever written to `day_log`.

Cells before it render blank — "not yet begun" — never as missed. Without this, every
existing player opens the Chronicle to a wall of hollow cells accusing them of skipping
months during which the feature did not exist.

## Write path

Hooked into `handleDailyReset`, in this order:

1. **`finalizeDay(yesterday)`** — from the live `objectives` table, which at this moment
   still holds yesterday's final state. `checkYesterdayCompletion` already queries exactly
   this; the counts are reused rather than re-queried.
2. **`backfillGap(lastOpenedISO + 1 … today − 1)`** as `0/total`.
3. **`applyStreakAndPenalty`** — **unchanged**. One penalty regardless of gap length.
4. **`resetObjectives`** — unchanged.

During the day, `bumpToday` is called from:

- the objective toggle handler in `init()` (`src/index.ts:286`), on both completion and
  un-completion, with `xpDelta` of `+25` / `−25` floored at zero for the row;
- trial completion in `trial.ts`, passing **only** `xpDelta`. `trial.ts` does not query
  `objectives` and must not start doing so; it omits `done` and `total` and leaves whatever
  `index.ts` has already written intact.

Both paths write the same row. A day containing five objectives and two trial runs is one
row, not three.

### Record and punishment stay decoupled

This is the load-bearing property of the whole design. The Chronicle changes no player's
Cosmo balance by a single point. A long absence still costs one day's penalty, exactly as
it does today — the calendar simply stops lying about how long the absence was.

## Page

New files: `www/chronicle.html`, `src/chronicle.ts`, `www/css/chronicle.css`.

### Navigation

All four existing pages carry an identical four-item footer (`www/index.html:114`, and the
same block in `trial.html`, `profile.html`, `rankings.html` — each has four `.nav-icon`
entries). A fifth slot is added to all five pages, between Ordeals and Ranks:

```
⌂ Home   ⚔ Ordeals   ⌸ Chronicle   ♗ Ranks   ◉ Profile
```

The icon is an inline SVG using `currentColor`, matching the existing four.

### Layout

```
┌─ CHRONICLE ─────────────────┐
│  12 day streak · best 21    │   summary strip
│  18 days trained this month │
├─────────────────────────────┤
│      ◀   JULY 2026   ▶      │
│   M  T  W  T  F  S  S       │
│   ◆  ◆  ◇  ◆  ◆  ·  ◆       │   month grid
│              …              │
├─────────────────────────────┤
│  WED 29 JUL                 │   detail strip
│  5/5 ordeals · +125 Cosmo   │
└─────────────────────────────┘
```

Week starts Monday.

### Cell states

| State | Condition | Treatment |
|---|---|---|
| Full | `total > 0 && done === total` | Filled gold |
| Partial | `0 < done < total` | Hollow gold, gold rim |
| Missed | `done === 0 && total > 0` | Dim rim, no fill |
| Blank | before `chronicleStart`, or future | Date numeral only, muted |
| Today | today's date | Gold outline **over** its own state |

Today is a modifier, not a sixth state — a completed today reads as full *and* today.

**When `total === 0`** the four objective-based rows above cannot apply. This happens on a
day the player spent only in Trial mode: `trial.ts` creates the row with `xpDelta` alone
and never sets a denominator. Such a day is **partial** when `xp > 0` and **missed** when
`xp === 0`. Training without touching the daily ordeals is not nothing, and must not
render as an empty day.

### Month navigation

`◀` and `▶` clamp: no earlier than `chronicleStart`'s month, no later than the current
month. An arrow at its limit is disabled, not hidden — a control that vanishes reads as a
bug.

### Detail strip

Tapping a cell fills an inline strip below the grid: weekday and date, `done/total`
ordeals, Cosmo earned. Blank cells are not tappable.

Inline, not a modal. The `#overlay` / `#info` popup on `index.html` exists for
interruptions — penalties, ascensions. Tapping a day is not an interruption, and reusing
that machinery would drag index-specific markup onto a new page.

### Summary strip

Current streak (from the existing `streak` key), longest streak ever, days trained this
month, days trained total. Longest streak is computed in JS from `readAll` — a scan of at
most a few thousand rows, which is cheaper than maintaining a denormalised column.

### Theming

`chronicle.css` declares **no `:root` block**. Tokens come from `theme.css`, which is
linked first, as on every other page. Duplicated `:root` blocks were the exact bug the
Sanctuary rebrand fixed.

The new panel classes are appended to the alias selector list at `www/css/theme.css:341`
so the treatment is inherited rather than restated. The corner-bracket block at
`www/css/theme.css:365` applies to the **outer Chronicle panel only** — the month grid is
a dense element and brackets would collide with the date row.

Cell colours are read from CSS custom properties so both palettes work from one rule set.
Unlike the radar chart in `profil.ts`, nothing here is canvas-drawn, so no re-render hook
is needed on theme toggle.

## Testing

New: `tests/daylog.test.ts`, `tests/chronicle.test.ts`. Extended: `tests/index.test.ts`
for the reset hooks, `tests/trial.test.ts` for the `bumpToday` call.

### Mock extension

`createSQLiteMock` (`tests/helpers/sqlite-mock.ts`) returns the same `rows` for every query
regardless of SQL. The Chronicle issues distinguishable queries — a month range and a full
scan — so the mock gains an optional `responses` map of SQL-substring to rows, falling
back to the existing `rows` behaviour when unmatched. All 278 existing tests keep passing
untouched.

### Cases that must be covered

- Month boundaries; February in a leap year.
- A gap spanning a month edge (29 Jul → 3 Aug).
- A gap spanning a year edge (30 Dec → 2 Jan).
- Zero-length gap — consecutive days must backfill nothing.
- First launch after upgrade: empty table, no `chronicleStart`, no `lastOpenedISO`.
- `lastOpenedISO` derived correctly from a legacy `lastOpened` value.
- A toggle and a trial run on the same day sum into **one** row.
- A trial-only day (`total === 0`, `xp > 0`) renders as partial, not blank or missed.
- A trial run writing before `index.ts` has ever run that day does not clobber `done` /
  `total` when the toggle handler later supplies them.
- Un-toggling an objective decrements the row's `xp` and never drives it below zero.
- `localDayKey` returns the local date at 23:30 in a positive-offset timezone.
- The Chronicle renders with a completely empty `day_log`.

## Out of scope

Deliberately excluded, and not to be added during implementation:

- Rest days / streak freezes.
- Per-exercise trends and personal bests.
- Editing or backfilling the past by hand.
- Supabase sync of any kind.
- Changes to Cosmo award or penalty amounts.

## Known adjacent issues — not this campaign

Recorded here so they are not lost, not to be fixed in this work:

- `www/index.html:12` loads Cinzel and Manrope from Google's CDN on every launch. An
  external request on a nominally offline app: typography breaks with no signal, and it is
  a third-party data flow requiring declaration on the Play Data Safety form. Should be
  self-hosted before release.
- Progress is unrecoverable — no auth, no backup, no export. Reinstall or device change
  wipes everything and orphans the leaderboard row permanently.
- `playerName` is free text rendered to every user on `rankings.html`. Google Play's
  user-generated-content policy expects moderation and a report mechanism.
- No privacy policy URL, no adaptive icon or store assets, no signing keystore, no pinned
  target SDK in `config.xml`.
