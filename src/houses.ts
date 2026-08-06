/**
 * houses.ts — the twelve zodiac houses
 *
 * Purely cosmetic. A house changes nothing about Cosmo, ordeals, stats or
 * ranking; it lights one glyph on the opening sigil and nothing else. Keep it
 * that way — the moment a house grants anything, it stops being a choice and
 * becomes a build.
 *
 * Loaded from <head> on index.html so `data-house` is stamped on <html> before
 * the first paint; without that the sigil visibly flickers from twelve-equal to
 * one-lit. That is also why this file, like theme.ts, is DELIBERATELY
 * STANDALONE — it must not reach for anything in shared.ts, which loads later.
 */

interface House {
  id:   string;
  name: string;
}

// `id` is the contract between three places: the <defs> glyph ids in
// index.html ('zg-' + id), the data-house attribute, and the stored value.
// Renaming one without the others silently unlights the sigil.
const HOUSES: House[] = [
  { id: 'aries',       name: 'Aries'       },
  { id: 'taurus',      name: 'Taurus'      },
  { id: 'gemini',      name: 'Gemini'      },
  { id: 'cancer',      name: 'Cancer'      },
  { id: 'leo',         name: 'Leo'         },
  { id: 'virgo',       name: 'Virgo'       },
  { id: 'libra',       name: 'Libra'       },
  { id: 'scorpio',     name: 'Scorpio'     },
  { id: 'sagittarius', name: 'Sagittarius' },
  { id: 'capricorn',   name: 'Capricorn'   },
  { id: 'aquarius',    name: 'Aquarius'    },
  { id: 'pisces',      name: 'Pisces'      },
];

const HOUSE_KEY         = 'house';
const HOUSE_CHANGED_KEY = 'houseChangedAt';

// Rolling seven days from the moment of the change, not a calendar week: a
// calendar week lets a Sunday change be undone on Monday.
const HOUSE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function isHouseId(id: string | null): boolean {
  return id !== null && HOUSES.some(h => h.id === id);
}

// An id that is not in HOUSES reads as no house at all. That covers a hand-edited
// localStorage and, more usefully, a house removed in a future version.
function getHouse(): string | null {
  const stored = localStorage.getItem(HOUSE_KEY);
  return isHouseId(stored) ? stored : null;
}

function houseName(id: string | null): string | null {
  const found = HOUSES.find(h => h.id === id);
  return found ? found.name : null;
}

function houseChangedAt(): number | null {
  const raw = localStorage.getItem(HOUSE_CHANGED_KEY);
  if (raw === null) return null;
  const ms = parseInt(raw, 10);
  return isNaN(ms) ? null : ms;
}

// The first choice is free: a player who has never picked has no timestamp to
// wait out.
function canChangeHouse(now: number): boolean {
  const changed = houseChangedAt();
  if (changed === null) return true;
  return now - changed >= HOUSE_COOLDOWN_MS;
}

function houseUnlockAt(): number | null {
  const changed = houseChangedAt();
  return changed === null ? null : changed + HOUSE_COOLDOWN_MS;
}

// Deliberately coarse. "Choose again in 2 days" is what a player needs; a
// live-ticking countdown to the second would be a lie the moment they look away.
function houseCooldownLabel(now: number): string {
  if (canChangeHouse(now)) return 'You may choose your house.';

  const remaining = (houseUnlockAt() as number) - now;
  const days  = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor(remaining / (60 * 60 * 1000));

  if (days  >= 1) return 'Choose again in ' + days  + (days  === 1 ? ' day'  : ' days');
  if (hours >= 1) return 'Choose again in ' + hours + (hours === 1 ? ' hour' : ' hours');
  return 'Choose again within the hour.';
}

// Stamps the attribute CSS keys off. Removing it when no house is held means
// the un-chosen sigil renders exactly as it did before this feature existed.
function applyHouseAttr(): void {
  const id = getHouse();
  if (id === null) {
    document.documentElement.removeAttribute('data-house');
  } else {
    document.documentElement.setAttribute('data-house', id);
  }
}

/**
 * Returns false and changes nothing when the id is unknown or the cooldown is
 * still running. The caller renders the refusal; this module never touches the
 * DOM beyond the <html> attribute.
 *
 * Re-picking the house already held is a no-op that does NOT spend the
 * cooldown — losing a week to a mis-tap on the house you already have would be
 * indefensible.
 */
function setHouse(id: string, now: number): boolean {
  if (!isHouseId(id)) return false;
  if (id === getHouse()) return false;
  if (!canChangeHouse(now)) return false;

  localStorage.setItem(HOUSE_KEY, id);
  localStorage.setItem(HOUSE_CHANGED_KEY, String(now));
  applyHouseAttr();
  return true;
}

applyHouseAttr();

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.HOUSES             = HOUSES;
  global.getHouse           = getHouse;
  global.setHouse           = setHouse;
  global.houseName          = houseName;
  global.canChangeHouse     = canChangeHouse;
  global.houseCooldownLabel = houseCooldownLabel;
  global.applyHouseAttr     = applyHouseAttr;
  module.exports = {
    HOUSES, getHouse, setHouse, houseName, isHouseId, houseChangedAt,
    canChangeHouse, houseUnlockAt, houseCooldownLabel, applyHouseAttr,
    HOUSE_KEY, HOUSE_CHANGED_KEY, HOUSE_COOLDOWN_MS,
  };
}
