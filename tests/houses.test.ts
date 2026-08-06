// houses.ts stamps data-house on <html> at require() time, so tests that care
// about the attribute set localStorage BEFORE requiring the module.

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

let houses: any;

function loadHouses(): void {
  jest.resetModules();
  houses = require('../src/houses');
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-house');
  loadHouses();
});

// ── The table ─────────────────────────────────────────────────────────────────

describe('HOUSES', () => {
  it('holds exactly twelve houses', () => {
    expect(houses.HOUSES).toHaveLength(12);
  });

  it('has no duplicate ids', () => {
    const ids = houses.HOUSES.map((h: any) => h.id);
    expect(new Set(ids).size).toBe(12);
  });

  it('uses ids that match the sigil glyph def names', () => {
    // The contract: <defs> in index.html declares 'zg-' + id.
    const fs = require('fs');
    const html = fs.readFileSync('www/index.html', 'utf8');
    houses.HOUSES.forEach((h: any) => {
      expect(html).toContain('id="zg-' + h.id + '"');
    });
  });

  it('has a slot on the wheel for every house', () => {
    const fs = require('fs');
    const html = fs.readFileSync('www/index.html', 'utf8');
    houses.HOUSES.forEach((h: any) => {
      expect(html).toContain('class="house-slot" data-house="' + h.id + '"');
    });
  });

  // profile.html carries its own copy of the glyph library because Chromium
  // does not support external SVG <use> references. This is the guard that
  // stops the two copies drifting.
  it('keeps the profile glyph library identical to the sigil’s', () => {
    const fs = require('fs');
    const defsOf = (file: string): string => {
      const m = fs.readFileSync(file, 'utf8').match(/<defs>[\s\S]*?<\/defs>/);
      return m ? m[0] : '';
    };
    const fromIndex = defsOf('www/index.html');
    expect(fromIndex).not.toBe('');
    expect(defsOf('www/profile.html')).toBe(fromIndex);
  });
});

// ── getHouse ──────────────────────────────────────────────────────────────────

describe('getHouse', () => {
  it('returns null when nothing is stored', () => {
    expect(houses.getHouse()).toBeNull();
  });

  it('returns the stored id', () => {
    localStorage.setItem('house', 'leo');
    expect(houses.getHouse()).toBe('leo');
  });

  // Covers a hand-edited localStorage and, more usefully, a house removed in a
  // future version.
  it('treats an unknown stored id as no house at all', () => {
    localStorage.setItem('house', 'ophiuchus');
    expect(houses.getHouse()).toBeNull();
  });
});

// ── The cooldown ──────────────────────────────────────────────────────────────

describe('canChangeHouse', () => {
  it('allows the first choice — there is nothing to wait out', () => {
    expect(houses.canChangeHouse(Date.now())).toBe(true);
  });

  it('refuses immediately after a change', () => {
    const now = Date.now();
    localStorage.setItem('houseChangedAt', String(now));
    expect(houses.canChangeHouse(now + DAY)).toBe(false);
  });

  // The boundary must UNLOCK, not stay locked: a >= that was written as > costs
  // the player an extra day and is invisible in casual testing.
  it('unlocks at exactly one week', () => {
    const now = Date.now();
    localStorage.setItem('houseChangedAt', String(now));
    expect(houses.canChangeHouse(now + WEEK - 1)).toBe(false);
    expect(houses.canChangeHouse(now + WEEK)).toBe(true);
  });

  it('treats a corrupt timestamp as no timestamp', () => {
    localStorage.setItem('houseChangedAt', 'not-a-number');
    expect(houses.canChangeHouse(Date.now())).toBe(true);
  });
});

describe('houseUnlockAt', () => {
  it('is null when no change has ever been made', () => {
    expect(houses.houseUnlockAt()).toBeNull();
  });

  it('is one week after the last change', () => {
    const now = 1_700_000_000_000;
    localStorage.setItem('houseChangedAt', String(now));
    expect(houses.houseUnlockAt()).toBe(now + WEEK);
  });
});

// ── setHouse ──────────────────────────────────────────────────────────────────

describe('setHouse', () => {
  it('stores the id and the moment of the change', () => {
    const now = 1_700_000_000_000;
    expect(houses.setHouse('leo', now)).toBe(true);
    expect(localStorage.getItem('house')).toBe('leo');
    expect(localStorage.getItem('houseChangedAt')).toBe(String(now));
  });

  it('stamps the attribute CSS keys off', () => {
    houses.setHouse('virgo', Date.now());
    expect(document.documentElement.getAttribute('data-house')).toBe('virgo');
  });

  it('refuses an unknown id and changes nothing', () => {
    expect(houses.setHouse('ophiuchus', Date.now())).toBe(false);
    expect(localStorage.getItem('house')).toBeNull();
    expect(localStorage.getItem('houseChangedAt')).toBeNull();
  });

  it('refuses while the cooldown is running', () => {
    const now = Date.now();
    houses.setHouse('leo', now);
    expect(houses.setHouse('aries', now + DAY)).toBe(false);
    expect(houses.getHouse()).toBe('leo');
  });

  it('allows a change once the week is up', () => {
    const now = Date.now();
    houses.setHouse('leo', now);
    expect(houses.setHouse('aries', now + WEEK)).toBe(true);
    expect(houses.getHouse()).toBe('aries');
  });

  // Losing a week to a mis-tap on the house you already hold would be
  // indefensible, so re-picking spends nothing.
  it('re-picking the held house is a no-op that does not spend the cooldown', () => {
    const now = Date.now();
    houses.setHouse('leo', now);

    expect(houses.setHouse('leo', now + WEEK + DAY)).toBe(false);
    expect(localStorage.getItem('houseChangedAt')).toBe(String(now));
    expect(houses.canChangeHouse(now + WEEK + DAY)).toBe(true);
  });
});

// ── The label ─────────────────────────────────────────────────────────────────

describe('houseCooldownLabel', () => {
  const now = 1_700_000_000_000;

  it('invites a choice when unlocked', () => {
    expect(houses.houseCooldownLabel(now)).toBe('You may choose your house.');
  });

  it('counts whole days down', () => {
    localStorage.setItem('houseChangedAt', String(now));
    // Five days elapsed of seven leaves two.
    expect(houses.houseCooldownLabel(now + 5 * DAY)).toBe('Choose again in 2 days');
  });

  it('uses the singular at one day', () => {
    localStorage.setItem('houseChangedAt', String(now));
    expect(houses.houseCooldownLabel(now + 6 * DAY)).toBe('Choose again in 1 day');
  });

  it('falls back to hours inside the last day', () => {
    localStorage.setItem('houseChangedAt', String(now));
    expect(houses.houseCooldownLabel(now + WEEK - 3 * 60 * 60 * 1000))
      .toBe('Choose again in 3 hours');
  });

  it('uses the singular at one hour', () => {
    localStorage.setItem('houseChangedAt', String(now));
    expect(houses.houseCooldownLabel(now + WEEK - 60 * 60 * 1000))
      .toBe('Choose again in 1 hour');
  });

  it('says "within the hour" in the final stretch', () => {
    localStorage.setItem('houseChangedAt', String(now));
    expect(houses.houseCooldownLabel(now + WEEK - 60 * 1000))
      .toBe('Choose again within the hour.');
  });
});

// ── applyHouseAttr ────────────────────────────────────────────────────────────

describe('applyHouseAttr', () => {
  it('stamps the stored house on <html> at load', () => {
    localStorage.setItem('house', 'pisces');
    loadHouses();
    expect(document.documentElement.getAttribute('data-house')).toBe('pisces');
  });

  // Without a house there must be no attribute at all — every splash.css rule
  // is gated on [data-house], so the un-chosen sigil renders exactly as it did
  // before the feature existed.
  it('leaves no attribute when no house is held', () => {
    loadHouses();
    expect(document.documentElement.hasAttribute('data-house')).toBe(false);
  });

  it('removes a stale attribute when the stored house becomes unknown', () => {
    document.documentElement.setAttribute('data-house', 'leo');
    localStorage.setItem('house', 'ophiuchus');
    loadHouses();
    expect(document.documentElement.hasAttribute('data-house')).toBe(false);
  });
});

// ── houseName ─────────────────────────────────────────────────────────────────

describe('houseName', () => {
  it('gives the display name for an id', () => {
    expect(houses.houseName('sagittarius')).toBe('Sagittarius');
  });

  it('returns null for an unknown id', () => {
    expect(houses.houseName('ophiuchus')).toBeNull();
  });
});
