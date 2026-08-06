# Omens and Houses — Design

**Date:** 2026-08-02
**Status:** Approved

Two features, deliberately independent. Houses are cosmetic and touch only display.
Omens are a notification layer that replaces the two ad-hoc modals in `index.ts`.
They meet at exactly one point: choosing a house raises an omen.

---

## 1 · Omens — the in-game notification layer

### What exists today

`index.ts` carries two hand-rolled modals, `showPenaltyModal` and `showRankUpModal`.
Both drive the same `#overlay` / `#info` markup, which lives only in `index.html`.
Because they share one element and one dismiss handler, a launch that raises both a
Rebuke and an Ascension has them fight over it: the second overwrites the first's
text, and the first's `{ once: true }` listener tears down the second on the next tap.

### What replaces it

A single module, `src/omens.ts`, with two faces over one call:

```ts
raiseOmen({ kind, title, body })   // shows a toast AND appends to the log
```

`kind` is one of `ascension | rebuke | levelup | streak | house`, and drives
colour and dwell time only — never behaviour.

**Toasts.** `omens.ts` lazily creates `<div id="omen-stack">` on `document.body`
the first time one is raised. No page needs markup for this, which is what lets
`profile.ts` raise the house omen without touching `profile.html`. Toasts stack
vertically rather than replacing one another; each carries its own dismiss timer,
so two raised together both survive their full dwell. Tapping one dismisses it early.

Dwell: 7000ms for `ascension`, 4500ms for everything else. Fade is 350ms, and the
node is removed from the DOM after it, not merely hidden.

**The log.** `localStorage.omens`, a ring buffer capped at `OMEN_LOG_MAX = 50`,
newest last in storage and rendered newest first. Entries are
`{ k: kind, t: title, b: body, ts: epochMillis }` — short keys because this is
serialised on every raise.

localStorage rather than the `day_log` SQLite table, because `profile.ts` has no
database handle and never opens one. The payload is a few hundred bytes; a table
would buy nothing and would make the house omen impossible from the profile page.

**Rendering.** An "Omens" section on `chronicle.html`, below the calendar. Newest
first, each row showing kind glyph, title, body and a relative timestamp
(`just now`, `3h ago`, `2d ago`). Empty state: "No omens yet."

### Triggers

| Event | Where | Title |
|---|---|---|
| Rank up | `index.ts`, ordeal click handler | Ascension |
| Missed ordeals | `index.ts`, `applyStreakAndPenalty` | Rebuke |
| Level up | `index.ts`, ordeal click handler | Level Reached |
| Streak hits 7 / 30 / 100 | `index.ts`, `applyStreakAndPenalty` | Unbroken |
| House chosen | `profil.ts` | House Claimed |

Daily-Ordeal-complete raises nothing. It is already expressed by the panel's
`quest-complete` state, and a notification for the thing the player just did by
hand is noise.

### Removed

`showPenaltyModal`, `showRankUpModal`, and the `#overlay` / `#info` markup in
`index.html`. Keeping them beside the new layer would leave two notification
systems and preserve the collision bug. Their tests are rewritten against
`raiseOmen`.

---

## 2 · Houses

### Data

`src/houses.ts` owns the twelve houses and all cooldown arithmetic. It is
standalone — it depends on nothing but `localStorage`, the same discipline
`theme.ts` follows, because it must be safe to load from `<head>`.

```ts
HOUSES: { id: string; name: string }[]   // id matches the splash glyph def id
```

`id` is the bare sign name (`aries` … `pisces`) and is the contract between three
places: the `<defs>` ids in `index.html` (`zg-aries`), the `data-house` attribute,
and the stored value. A stored id not present in `HOUSES` is treated as no house.

**Storage.** `house` (the id) and `houseChangedAt` (epoch millis).

**Cooldown.** Rolling seven days: `HOUSE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000`.

- No `houseChangedAt` → the first choice is free.
- `canChangeHouse()` → `Date.now() - houseChangedAt >= HOUSE_COOLDOWN_MS`
- `houseCooldownLabel()` → "Choose again in 3 days" / "in 4 hours" / "in a moment"

`setHouse(id)` refuses an unknown id and refuses while locked, returning `false`
rather than throwing. The caller renders the refusal; the module never touches
the DOM.

### Display — the opening sigil

The chosen glyph burns; the other eleven dim.

Two structural changes are required, neither cosmetic:

**Loading in `<head>`.** The highlight must be present on the first painted frame,
or the sigil visibly flickers from twelve-equal to one-lit. The CSP has no
`script-src` directive, so it falls back to `default-src 'self'` and **inline
scripts are blocked** — the attribute cannot be stamped inline. `houses.js` is
therefore loaded in `<head>` on `index.html`, beside `theme.js`, and stamps
`data-house="leo"` on `<html>` at load.

**Two-level glyph groups.** A CSS `transform` *overrides* an SVG `transform`
attribute rather than composing with it, so styling the chosen glyph with
`scale()` would discard its placement on the ring and collapse all twelve onto
the origin. Each glyph becomes:

```html
<g class="house-slot" data-house="leo" transform="translate(336.8 279)">
  <g class="house-emph">                    <!-- no transform attr; CSS owns this -->
    <use href="#zg-leo" transform="scale(1.15) translate(-12 -12)"/>
  </g>
</g>
```

Placement stays an attribute on the outer group. `splash.css` styles the inner
group exclusively, with `transform-box: fill-box; transform-origin: center`.

```css
[data-house] .house-slot            { opacity: 0.3; }
[data-house="leo"] .house-slot[data-house="leo"] { opacity: 1; }
[data-house="leo"] .house-slot[data-house="leo"] .house-emph { transform: scale(1.35); }
```

The generated selector set is twelve pairs, written once per house.

With no house chosen there is no `data-house` attribute and every glyph renders
exactly as it does today — the feature is invisible until used.

### The picker

A "House" section on `profile.html`, beside Theme. A grid of twelve glyph buttons
reusing the same `<defs>`, which means `profile.html` carries its own copy of the
glyph library.

Locked state disables the buttons and states the countdown. It never hides them:
a control that vanishes reads as a bug. The current house is marked `aria-pressed`.

Selecting: `setHouse` → re-render the section → `raiseOmen({ kind: 'house' })`.
Choosing the house already active is a no-op and does not spend the cooldown.

---

## 3 · Testing

Both modules are pure logic over `localStorage` and the DOM, and are unit-tested
directly. Added to `collectCoverageFrom`; the global 95% threshold holds.

**`houses.ts`** — first choice free; refusal while locked; refusal of an unknown
id; the boundary at exactly `HOUSE_COOLDOWN_MS` (must unlock, not stay locked);
label wording across days / hours / minutes; unknown stored id degrades to none.

**`omens.ts`** — ring buffer caps at 50 and drops oldest; ordering is newest
first when read; toast appears, dwells its full duration under fake timers, and
is *removed* from the DOM rather than hidden; two toasts raised together both
survive; tap dismisses early without disturbing its neighbour; relative-time
formatting at each boundary; a corrupt `localStorage.omens` degrades to an empty
log instead of throwing.

**Rewritten** — the `showPenaltyModal` / `showRankUpModal` tests in
`index.test.ts` become assertions that the correct omen is raised.

---

## 4 · Files

| File | Change |
|---|---|
| `src/omens.ts` | new — raise, log, toast, relative time |
| `src/houses.ts` | new — the twelve, storage, cooldown |
| `www/css/omens.css` | new — toast stack and log rows |
| `www/css/splash.css` | house highlight rules |
| `www/index.html` | two-level glyph groups; `houses.js` in head; drop `#overlay`/`#info` |
| `www/profile.html` | House section + glyph defs |
| `www/chronicle.html` | Omens section |
| `src/index.ts` | modals out, four `raiseOmen` triggers in |
| `src/profil.ts` | picker wiring |
| `src/chronicle.ts` | render the log |
| `tests/*` | two new suites; index/profil/chronicle updated |
