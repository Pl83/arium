// Loaded before index.js, profil.js and rankings.js — globals available there.
//
// The player name is the app's only user-generated content: it is published to
// the global leaderboard and rendered on every other player's device. This file
// is the gate in front of that surface. It does two separate jobs:
//
//   sanitizePlayerName() — strips characters a name may not contain, trims and
//                          caps the length. Always returns a usable name.
//   isNameClean()        — vets the sanitized name against a banned-word list.
//                          Returns false; the caller decides what to tell the user.
//
// They are deliberately split: a stray emoji should cost you the emoji, but a
// slur should cost you the whole name and an explanation.

const NAME_MAX_LEN = 20;
const DEFAULT_PLAYER_NAME = 'Saint';

// Characters a name may keep. Letters and digits of any script, plus a small
// set of separators. Everything else is stripped.
const NAME_ALLOWED_CHARS = /[^\p{L}\p{N} _.'\-]/gu;

// Combining marks left behind by NFD decomposition.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

// Homoglyphs used to slip a word past a naive filter: "sh1t", "f@g", "@ss".
const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't',
};

// Innocent words that contain a banned fragment. A matching token is dropped
// before any check runs, so it cannot trip the filter on its own or contribute
// to the joined-name check. Without this, "Therapist" and "Scunthorpe" are
// rejected — the Scunthorpe problem. Extend this list when a real name is
// wrongly refused; that is cheaper than weakening a fragment.
const NAME_SAFE_WORDS: string[] = [
  'therapist', 'therapists', 'scunthorpe', 'shiitake', 'penistone',
  'lightwater', 'negroni', 'mishit', 'misshit',
];

// Matched anywhere inside a word. ONLY terms that effectively never occur inside
// an innocent word belong here — anything shorter or more ambiguous goes in
// BANNED_WORDS below. Every addition here is a false-positive risk.
const BANNED_FRAGMENTS: string[] = [
  // English obscenity
  'fuck', 'phuck', 'shit', 'bitch', 'bastard', 'asshole', 'arsehole',
  'dickhead', 'whore', 'slut', 'cunt', 'twat', 'wanker', 'bollock',
  // Slurs
  'nigger', 'nigga', 'negro', 'faggot', 'tranny', 'retard', 'mongoloid',
  'wetback', 'beaner', 'towelhead', 'raghead', 'chinaman',
  // Sexual / exploitative
  'rapist', 'pedophil', 'paedophil', 'molest', 'incest', 'bestiality',
  'porn', 'hentai', 'dildo', 'buttplug', 'blowjob', 'handjob', 'cumshot',
  'masturbat', 'ejaculat', 'penis', 'vagina', 'clitoris', 'scrotum',
  // Hate / violence
  'hitler', 'holocaust', 'suicide',
  // French obscenity and slurs
  'putain', 'salope', 'salaud', 'salopard', 'connard', 'connasse', 'encule',
  'batard', 'merde', 'couille', 'branleur', 'branlette', 'trouduc', 'foutre',
  'petasse', 'pouffiasse', 'bougnoule', 'youpin', 'niquetamere',
];

// Matched only as a complete word. These are short or ambiguous enough that a
// substring match would fire on ordinary names — "ass" inside "Grassmaster",
// "con" inside almost every French word, "pute" inside "dispute" and "député",
// "nazi" inside the given name "Nazir".
const BANNED_WORDS: string[] = [
  // English
  'ass', 'arse', 'tit', 'tits', 'fag', 'fags', 'dick', 'cock', 'cocks',
  'prick', 'pussy', 'piss', 'hoe', 'cum', 'anal', 'anus', 'nude', 'sex',
  'sexy', 'rape', 'kys', 'nazi', 'nazis',
  // Slurs short enough to collide with real words
  'chink', 'spic', 'gook', 'kike', 'dyke', 'coon', 'wog', 'paki', 'jap',
  // French
  'nique', 'niquer', 'pute', 'putes', 'con', 'cons', 'conne', 'cul', 'culs',
  'pd', 'pede', 'tapette', 'bite', 'chatte', 'zizi', 'gouine', 'nichon',
  'nichons', 'salopes', 'enfoire',
];

// Lowercase, strip diacritics, undo leetspeak. "Ünï_C0DE" → "uni_code".
function foldName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[0134578@$!|+]/g, c => LEET_MAP[c]);
}

// "fuuuuck" → "fuck". Runs of any length collapse to one character, so padding a
// word with repeats no longer disguises it. Banned terms are collapsed with the
// same function before comparison, which keeps both sides in the same shape.
function collapseRuns(s: string): string {
  return s.replace(/(.)\1+/g, '$1');
}

function nameTokens(raw: string): string[] {
  return foldName(raw).split(/[^a-z0-9]+/).filter(Boolean);
}

// Strips forbidden characters, trims, caps the length. Never rejects: an
// unusable name falls back to DEFAULT_PLAYER_NAME.
function sanitizePlayerName(raw: string): string {
  const stripped = raw.replace(NAME_ALLOWED_CHARS, '').trim();
  return stripped.slice(0, NAME_MAX_LEN).trim() || DEFAULT_PLAYER_NAME;
}

// False when the name hits the banned-word list. Run this on the SANITIZED name:
// stripping punctuation is what turns "f*u*c*k" into something the filter sees.
function isNameClean(raw: string): boolean {
  const suspect = nameTokens(raw).filter(
    t => NAME_SAFE_WORDS.indexOf(t) === -1 && NAME_SAFE_WORDS.indexOf(collapseRuns(t)) === -1,
  );

  for (const token of suspect) {
    const collapsed = collapseRuns(token);

    for (const word of BANNED_WORDS) {
      if (token === word || collapsed === collapseRuns(word)) return false;
    }
    for (const fragment of BANNED_FRAGMENTS) {
      if (collapsed.indexOf(collapseRuns(fragment)) !== -1) return false;
    }
  }

  // Words are only joined across separators when the name is spelled out letter
  // by letter ("f u c k", "s.h.i.t") — the signature of an evasion attempt.
  // Joining unconditionally would reject "Miss Hit", which spans to "shit".
  if (suspect.filter(t => t.length === 1).length >= 2) {
    const joined = collapseRuns(suspect.join(''));
    for (const fragment of BANNED_FRAGMENTS) {
      if (joined.indexOf(collapseRuns(fragment)) !== -1) return false;
    }
  }

  return true;
}

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.NAME_MAX_LEN        = NAME_MAX_LEN;
  global.DEFAULT_PLAYER_NAME = DEFAULT_PLAYER_NAME;
  global.foldName            = foldName;
  global.collapseRuns        = collapseRuns;
  global.nameTokens          = nameTokens;
  global.sanitizePlayerName  = sanitizePlayerName;
  global.isNameClean         = isNameClean;
  module.exports = {
    NAME_MAX_LEN, DEFAULT_PLAYER_NAME, BANNED_FRAGMENTS, BANNED_WORDS, NAME_SAFE_WORDS,
    foldName, collapseRuns, nameTokens, sanitizePlayerName, isNameClean,
  };
}
