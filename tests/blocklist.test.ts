// namefilter.ts and blocklist.ts are required by tests/setup.ts

const bl = require('../src/blocklist');

beforeEach(() => {
  localStorage.clear();
});

// ── blockKey ──────────────────────────────────────────────────────────────────

describe('blockKey', () => {
  it('folds, squashes and strips separators', () => {
    expect(bl.blockKey('Iron Hound')).toBe('ironhound');
    expect(bl.blockKey('Grim. Wall')).toBe('grimwal');
  });

  it('maps a leetspeak variant onto the same key as the plain name', () => {
    expect(bl.blockKey('T0xic')).toBe(bl.blockKey('Toxic'));
  });

  it('maps a padded variant onto the same key', () => {
    expect(bl.blockKey('Tooooxic')).toBe(bl.blockKey('Toxic'));
  });

  it('ignores diacritics and case', () => {
    expect(bl.blockKey('ÉLOÏSE')).toBe(bl.blockKey('eloise'));
  });

  it('returns an empty string for a name with nothing to key on', () => {
    expect(bl.blockKey('...')).toBe('');
  });
});

// ── blockName / isNameBlocked ─────────────────────────────────────────────────

describe('blockName', () => {
  it('stores the name and reports that it was added', () => {
    expect(bl.blockName('Toxic')).toBe(true);
    expect(bl.isNameBlocked('Toxic')).toBe(true);
  });

  it('is idempotent — blocking twice adds one entry', () => {
    expect(bl.blockName('Toxic')).toBe(true);
    expect(bl.blockName('Toxic')).toBe(false);
    expect(bl.blockedCount()).toBe(1);
  });

  it('treats a leetspeak respelling as the same player', () => {
    bl.blockName('Toxic');
    expect(bl.isNameBlocked('T0x1c')).toBe(true);
  });

  it('refuses a name that reduces to an empty key', () => {
    expect(bl.blockName('...')).toBe(false);
    expect(bl.blockedCount()).toBe(0);
  });

  it('keeps entries separate', () => {
    bl.blockName('Toxic');
    bl.blockName('Rude');
    expect(bl.blockedCount()).toBe(2);
    expect(bl.isNameBlocked('Toxic')).toBe(true);
    expect(bl.isNameBlocked('Rude')).toBe(true);
  });

  it('persists through localStorage', () => {
    bl.blockName('Toxic');
    expect(JSON.parse(localStorage.getItem(bl.BLOCKLIST_KEY)!)).toEqual(['toxic']);
  });
});

describe('isNameBlocked', () => {
  it('is false when nothing is blocked', () => {
    expect(bl.isNameBlocked('Toxic')).toBe(false);
  });

  it('is false for a name that reduces to an empty key', () => {
    expect(bl.isNameBlocked('...')).toBe(false);
  });

  it('does not match a different name', () => {
    bl.blockName('Toxic');
    expect(bl.isNameBlocked('Iron Hound')).toBe(false);
  });
});

// ── storage robustness ────────────────────────────────────────────────────────

describe('getBlockedKeys', () => {
  it('returns an empty list when the key is absent', () => {
    expect(bl.getBlockedKeys()).toEqual([]);
  });

  it('survives malformed JSON', () => {
    localStorage.setItem(bl.BLOCKLIST_KEY, '{not json');
    expect(bl.getBlockedKeys()).toEqual([]);
  });

  it('survives a stored value that is not an array', () => {
    localStorage.setItem(bl.BLOCKLIST_KEY, '{"a":1}');
    expect(bl.getBlockedKeys()).toEqual([]);
  });

  it('drops non-string entries', () => {
    localStorage.setItem(bl.BLOCKLIST_KEY, '["toxic", 7, null]');
    expect(bl.getBlockedKeys()).toEqual(['toxic']);
  });
});

// ── clearBlockedNames ─────────────────────────────────────────────────────────

describe('clearBlockedNames', () => {
  it('empties the list', () => {
    bl.blockName('Toxic');
    bl.blockName('Rude');
    bl.clearBlockedNames();
    expect(bl.blockedCount()).toBe(0);
    expect(bl.isNameBlocked('Toxic')).toBe(false);
  });

  it('is safe when nothing is blocked', () => {
    bl.clearBlockedNames();
    expect(bl.blockedCount()).toBe(0);
  });
});
