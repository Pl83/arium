// namefilter.ts is required by tests/setup.ts

const nf = require('../src/namefilter');

// ── sanitizePlayerName ────────────────────────────────────────────────────────

describe('sanitizePlayerName', () => {
  it('keeps letters, digits and the permitted separators', () => {
    expect(nf.sanitizePlayerName("Iron_Hound-7.0'x")).toBe("Iron_Hound-7.0'x");
  });

  it('keeps letters outside the Latin alphabet', () => {
    expect(nf.sanitizePlayerName('鉄の誓い')).toBe('鉄の誓い');
    expect(nf.sanitizePlayerName('Ярость')).toBe('Ярость');
  });

  it('strips emoji and other disallowed characters', () => {
    expect(nf.sanitizePlayerName('Hunter🔥<script>')).toBe('Hunterscript');
  });

  it('trims surrounding whitespace', () => {
    expect(nf.sanitizePlayerName('  Zorg  ')).toBe('Zorg');
  });

  it('caps the name at NAME_MAX_LEN characters', () => {
    const long = 'A'.repeat(40);
    expect(nf.sanitizePlayerName(long)).toHaveLength(nf.NAME_MAX_LEN);
  });

  it('trims again after truncating so a name never ends on a space', () => {
    expect(nf.sanitizePlayerName('Nineteen characters X')).toBe('Nineteen characters');
  });

  it('falls back to the default when the input is blank', () => {
    expect(nf.sanitizePlayerName('   ')).toBe(nf.DEFAULT_PLAYER_NAME);
  });

  it('falls back to the default when every character is stripped', () => {
    expect(nf.sanitizePlayerName('🔥🔥🔥')).toBe(nf.DEFAULT_PLAYER_NAME);
  });
});

// ── foldName / collapseRuns ───────────────────────────────────────────────────

describe('foldName', () => {
  it('lowercases', () => {
    expect(nf.foldName('HUNTER')).toBe('hunter');
  });

  it('strips diacritics', () => {
    expect(nf.foldName('Éloïse')).toBe('eloise');
    expect(nf.foldName('enculé')).toBe('encule');
  });

  it('undoes leetspeak substitutions', () => {
    expect(nf.foldName('5h1t')).toBe('shit');
    expect(nf.foldName('@$$')).toBe('ass');
    expect(nf.foldName('f4g')).toBe('fag');
  });
});

describe('collapseRuns', () => {
  it('collapses a run of any length to one character', () => {
    expect(nf.collapseRuns('fuuuuck')).toBe('fuck');
    expect(nf.collapseRuns('aaa')).toBe('a');
  });

  it('leaves single characters untouched', () => {
    expect(nf.collapseRuns('hunter')).toBe('hunter');
  });

  it('collapses doubles too', () => {
    expect(nf.collapseRuns('pass')).toBe('pas');
  });
});

describe('nameTokens', () => {
  it('splits on every non-alphanumeric run', () => {
    expect(nf.nameTokens('Iron Hound')).toEqual(['iron', 'hound']);
    expect(nf.nameTokens('Iron_Hound-X')).toEqual(['iron', 'hound', 'x']);
  });

  it('folds leet digits before splitting, so "7" arrives as "t"', () => {
    expect(nf.nameTokens('Level 7')).toEqual(['level', 't']);
  });

  it('drops empty tokens', () => {
    expect(nf.nameTokens('  ...  ')).toEqual([]);
  });
});

// ── isNameClean: names that must pass ─────────────────────────────────────────

describe('isNameClean — legitimate names', () => {
  const legitimate = [
    'Saint', 'Iron Hound', 'Zorg', 'Barghest', 'Pierre-Louis', 'Éloïse',
    'Player_1', 'xX_Shadow_Xx', '鉄の誓い',
    // Each of these contains a banned word as a substring and must survive.
    'Assassin', 'Grassmaster', 'Bass', 'Classic', 'Passion', 'Compass',
    'Analyst', 'Canal', 'Titan', 'Cocktail', 'Cockpit', 'Peacock',
    'Sussex', 'Sextet', 'Grape', 'Therapist', 'Scunthorpe', 'Debugger',
    'Nazir', 'Negroni', 'Raccoon', 'Miss Hit',
    // French words that embed a banned token.
    'Culture', 'Calcul', 'Ridicule', 'Dispute', 'Compute', 'Unique',
    'Technique', 'Concombre', 'Constantin', 'Deputes',
  ];

  legitimate.forEach(name => {
    it('accepts "' + name + '"', () => {
      expect(nf.isNameClean(name)).toBe(true);
    });
  });
});

// ── isNameClean: names that must be refused ───────────────────────────────────

describe('isNameClean — refused names', () => {
  const refused = [
    // Fragment tier, plain
    'Fucker', 'BitchKing', 'ShitLord', 'Asshole', 'Whore', 'Cunt',
    'Nigger', 'Faggot', 'Rapist', 'Hitler', 'PornStar', 'Dildo',
    // Fragment tier, French
    'Putain', 'Salope', 'Connard', 'Encule', 'Batard', 'Merde', 'Trouduc',
    // Word tier — the whole name is the banned token
    'Ass', 'Dick', 'Pussy', 'Nazi', 'Anal', 'Sex', 'Con', 'Cul', 'Pute',
    'Nique', 'Pede', 'Chatte',
    // Word tier as one token among several
    'Big Dick Energy', 'Le Con', 'Sale Pute',
  ];

  refused.forEach(name => {
    it('refuses "' + name + '"', () => {
      expect(nf.isNameClean(name)).toBe(false);
    });
  });
});

// ── isNameClean: evasion ──────────────────────────────────────────────────────

describe('isNameClean — evasion attempts', () => {
  it('sees through leetspeak', () => {
    expect(nf.isNameClean('5h1t')).toBe(false);
    expect(nf.isNameClean('F4gg0t')).toBe(false);
    expect(nf.isNameClean('@sshole')).toBe(false);
  });

  it('sees through padded repeats', () => {
    expect(nf.isNameClean('Fuuuuck')).toBe(false);
    expect(nf.isNameClean('Shiiit')).toBe(false);
  });

  it('sees through diacritics', () => {
    expect(nf.isNameClean('Enculé')).toBe(false);
    expect(nf.isNameClean('Pétasse')).toBe(false);
  });

  it('sees through separators when the word is spelled out', () => {
    expect(nf.isNameClean('f u c k')).toBe(false);
    expect(nf.isNameClean('s.h.i.t')).toBe(false);
    expect(nf.isNameClean('c-u-n-t')).toBe(false);
  });

  it('does not join words that are not spelled out letter by letter', () => {
    // "Miss Hit" spans to "shit" once joined; two real words must not be joined.
    expect(nf.isNameClean('Miss Hit')).toBe(true);
  });

  it('vets the sanitized name, so stripped punctuation exposes the word', () => {
    expect(nf.isNameClean(nf.sanitizePlayerName('f*u*c*k'))).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(nf.isNameClean('FUCK')).toBe(false);
    expect(nf.isNameClean('FuCk')).toBe(false);
  });
});

// ── list hygiene ──────────────────────────────────────────────────────────────

describe('banned lists', () => {
  it('holds every entry in already-folded form', () => {
    const all = nf.BANNED_FRAGMENTS.concat(nf.BANNED_WORDS, nf.NAME_SAFE_WORDS);
    all.forEach((term: string) => {
      expect(nf.foldName(term)).toBe(term);
    });
  });

  it('has no duplicate entries', () => {
    const all = nf.BANNED_FRAGMENTS.concat(nf.BANNED_WORDS);
    expect(new Set(all).size).toBe(all.length);
  });

  it('accepts the default name', () => {
    expect(nf.isNameClean(nf.DEFAULT_PLAYER_NAME)).toBe(true);
  });
});
