// Loaded before all page scripts — globals available everywhere

const XP_PER_LEVEL = 100;

const RANKS: RankEntry[] = [
  { minLevel:  1, rank: 'E', title: 'Novice'     },
  { minLevel:  5, rank: 'D', title: 'Apprentice'  },
  { minLevel: 10, rank: 'C', title: 'Warrior'     },
  { minLevel: 20, rank: 'B', title: 'Champion'    },
  { minLevel: 35, rank: 'A', title: 'Hero'        },
  { minLevel: 50, rank: 'S', title: 'Legend'      },
];

// Goal scaling: target = min(cap, base + (level - 1) * step)
const GOAL_CONFIG: GoalConfig[] = [
  { name: 'Push-Ups', base: 20, step: 2, cap: 100 },
  { name: 'Sit-Ups',  base: 20, step: 2, cap: 100 },
  { name: 'Squats',   base: 20, step: 2, cap: 100 },
  { name: 'Plank',    base: 30, step: 5,  cap: 300 },
];

function goalTarget(cfg: { base: number; step: number; cap: number }, level: number): number {
  return Math.min(cfg.cap, cfg.base + (level - 1) * cfg.step);
}

function goalTitle(cfg: GoalConfig, level: number): string {
  return cfg.name + ' [0/' + goalTarget(cfg, level) + ']';
}

const STAT_KEYS: StatKey[] = ['strength', 'core', 'power', 'endurance'];
const STAT_LABELS: Record<StatKey, string> = { strength: 'Strength', core: 'Core', power: 'Power', endurance: 'Endurance' };
const STAT_SOFT_CAP = 50;

function getTotalXP(): number {
  return parseInt(localStorage.getItem('totalXP') || '0', 10);
}

function getLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

function getLevelProgress(xp: number): number {
  return xp % XP_PER_LEVEL;
}

function getRank(level: number): RankEntry {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.minLevel) current = r;
  }
  return current;
}

function getPlayerName(): string {
  return localStorage.getItem('playerName') || 'Hunter';
}

function getStats(): Partial<StatMap> {
  try { return JSON.parse(localStorage.getItem('stats') || '{}') as Partial<StatMap>; }
  catch { return {}; }
}

function statForTitle(title: string): StatKey | null {
  const t = title.toLowerCase();
  if (t.includes('push'))  return 'strength';
  if (t.includes('sit'))   return 'core';
  if (t.includes('squat')) return 'power';
  if (t.includes('plank')) return 'endurance';
  return null;
}

function incrementStat(statName: StatKey | null): void {
  if (!statName) return;
  const stats = getStats();
  stats[statName] = (stats[statName] || 0) + 1;
  localStorage.setItem('stats', JSON.stringify(stats));
}

// === NODE/JEST EXPORT — invisible in browser (module is undefined there) ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.XP_PER_LEVEL  = XP_PER_LEVEL;
  global.RANKS         = RANKS;
  global.GOAL_CONFIG   = GOAL_CONFIG;
  global.STAT_KEYS     = STAT_KEYS;
  global.STAT_LABELS   = STAT_LABELS;
  global.STAT_SOFT_CAP = STAT_SOFT_CAP;
  global.goalTarget       = goalTarget;
  global.goalTitle        = goalTitle;
  global.getTotalXP       = getTotalXP;
  global.getLevel         = getLevel;
  global.getLevelProgress = getLevelProgress;
  global.getRank          = getRank;
  global.getPlayerName    = getPlayerName;
  global.getStats         = getStats;
  global.statForTitle     = statForTitle;
  global.incrementStat    = incrementStat;
  module.exports = {
    XP_PER_LEVEL, RANKS, GOAL_CONFIG, STAT_KEYS, STAT_LABELS, STAT_SOFT_CAP,
    goalTarget, goalTitle, getTotalXP, getLevel, getLevelProgress,
    getRank, getPlayerName, getStats, statForTitle, incrementStat,
  };
}
