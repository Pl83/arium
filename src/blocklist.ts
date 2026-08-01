// namefilter.js must be loaded before this file — foldName/collapseRuns come from it.
//
// Device-local moderation. Reporting a player hides them from the rankings page
// on THIS device only; nothing is sent to the server and no other player is
// affected. Each user curates their own leaderboard, which makes the tolerance
// threshold theirs rather than ours.
//
// Entries are stored as the folded, squashed form of the reported name, not the
// name as typed. "T0xic", "Toxic" and "tooxic" therefore resolve to one entry,
// and a player who re-registers under the same name stays hidden.

const BLOCKLIST_KEY = 'blockedNames';

function blockKey(name: string): string {
  return collapseRuns(foldName(name).replace(/[^a-z0-9]+/g, ''));
}

function getBlockedKeys(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(BLOCKLIST_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is string => typeof k === 'string');
  } catch {
    return [];
  }
}

// Returns false when the name was already blocked or reduces to nothing
// (a name made entirely of punctuation would otherwise block every such name).
function blockName(name: string): boolean {
  const key = blockKey(name);
  if (!key) return false;

  const keys = getBlockedKeys();
  if (keys.indexOf(key) !== -1) return false;

  keys.push(key);
  localStorage.setItem(BLOCKLIST_KEY, JSON.stringify(keys));
  return true;
}

function isNameBlocked(name: string): boolean {
  const key = blockKey(name);
  return key !== '' && getBlockedKeys().indexOf(key) !== -1;
}

function blockedCount(): number {
  return getBlockedKeys().length;
}

function clearBlockedNames(): void {
  localStorage.removeItem(BLOCKLIST_KEY);
}

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.blockKey          = blockKey;
  global.getBlockedKeys    = getBlockedKeys;
  global.blockName         = blockName;
  global.isNameBlocked     = isNameBlocked;
  global.blockedCount      = blockedCount;
  global.clearBlockedNames = clearBlockedNames;
  module.exports = {
    BLOCKLIST_KEY, blockKey, getBlockedKeys, blockName, isNameBlocked,
    blockedCount, clearBlockedNames,
  };
}
