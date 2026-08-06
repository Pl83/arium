// Loaded before all page scripts — globals available everywhere

// XP needed to advance from level N to N+1 = XP_BASE_PER_LEVEL × N
// Total XP to reach level N = XP_BASE_PER_LEVEL × N×(N-1)/2
const XP_BASE_PER_LEVEL = 100;

function xpToLevel(level: number): number {
  return XP_BASE_PER_LEVEL * level * (level - 1) / 2;
}

function xpForNextLevel(level: number): number {
  return XP_BASE_PER_LEVEL * level;
}

const RANKS: RankEntry[] = [
  { minLevel:  1, rank: 'E', title: 'Aspirant'     },
  { minLevel:  5, rank: 'D', title: 'Bronze Saint' },
  { minLevel: 10, rank: 'C', title: 'Silver Saint' },
  { minLevel: 20, rank: 'B', title: 'Gold Saint'   },
  { minLevel: 35, rank: 'A', title: 'Divine Saint' },
  { minLevel: 50, rank: 'S', title: 'God Saint'    },
];

// Goal scaling: target = min(cap, base + (level - 1) * step)
const GOAL_CONFIG: GoalConfig[] = [
  { name: 'Push-Ups', base: 20, step: 2, cap: 100 },
  { name: 'Sit-Ups',  base: 20, step: 2, cap: 100 },
  { name: 'Squats',   base: 20, step: 2, cap: 100 },
  { name: 'Plank',    base: 30, step: 5,  cap: 300 },
  { name: 'Jumping Jacks', base: 30, step: 3, cap: 150 },
];

function goalTarget(cfg: { base: number; step: number; cap: number }, level: number): number {
  return Math.min(cfg.cap, cfg.base + (level - 1) * cfg.step);
}

function goalTitle(cfg: GoalConfig, level: number): string {
  return cfg.name + ' [0/' + goalTarget(cfg, level) + ']';
}

const STAT_KEYS: StatKey[] = ['strength', 'core', 'power', 'endurance', 'agility'];
const STAT_LABELS: Record<StatKey, string> = { strength: 'Strength', core: 'Core', power: 'Power', endurance: 'Endurance', agility: 'Agility' };
const STAT_SOFT_CAP = 50;

function getTotalXP(): number {
  return parseInt(localStorage.getItem('totalXP') || '0', 10);
}

function getLevel(xp: number): number {
  return Math.floor((1 + Math.sqrt(1 + 8 * xp / XP_BASE_PER_LEVEL)) / 2);
}

function getLevelProgress(xp: number): number {
  const level = getLevel(xp);
  return Math.floor((xp - xpToLevel(level)) / xpForNextLevel(level) * 100);
}

function getRank(level: number): RankEntry {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.minLevel) current = r;
  }
  return current;
}

function getPlayerName(): string {
  return localStorage.getItem('playerName') || 'Saint';
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
  if (t.includes('plank'))   return 'endurance';
  if (t.includes('jumping')) return 'agility';
  if (t.includes('stretch')) return 'agility'; // legacy objective rows
  return null;
}

function getDeviceId(): string {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    localStorage.setItem('deviceId', id);
  }
  return id;
}

function incrementStat(statName: StatKey | null): void {
  if (!statName) return;
  const stats = getStats();
  stats[statName] = (stats[statName] || 0) + 1;
  localStorage.setItem('stats', JSON.stringify(stats));
}

// ── Date keys ──────────────────────────────────────────────────────────────
// 'YYYY-MM-DD' in LOCAL time. Never toISOString() — that shifts to UTC and
// files a 23:30 session under tomorrow for anyone east of Greenwich.

function localDayKey(d: Date): string {
  const m = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  return d.getFullYear() + '-' + m + '-' + day;
}

// new Date('2026-07-31') parses as UTC midnight; the explicit constructor
// gives local midnight, which is what every comparison here assumes.
function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayKeyAddDays(key: string, n: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + n);
  return localDayKey(d);
}

// === NODE/JEST EXPORT — invisible in browser (module is undefined there) ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.XP_BASE_PER_LEVEL = XP_BASE_PER_LEVEL;
  global.RANKS         = RANKS;
  global.GOAL_CONFIG   = GOAL_CONFIG;
  global.STAT_KEYS     = STAT_KEYS;
  global.STAT_LABELS   = STAT_LABELS;
  global.STAT_SOFT_CAP = STAT_SOFT_CAP;
  global.xpToLevel        = xpToLevel;
  global.xpForNextLevel   = xpForNextLevel;
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
  global.getDeviceId      = getDeviceId;
  global.localDayKey      = localDayKey;
  global.parseDayKey      = parseDayKey;
  global.dayKeyAddDays    = dayKeyAddDays;
  module.exports = {
    XP_BASE_PER_LEVEL, RANKS, GOAL_CONFIG, STAT_KEYS, STAT_LABELS, STAT_SOFT_CAP,
    xpToLevel, xpForNextLevel, goalTarget, goalTitle, getTotalXP, getLevel, getLevelProgress,
    getRank, getPlayerName, getStats, statForTitle, incrementStat, getDeviceId,
    localDayKey, parseDayKey, dayKeyAddDays,
  };
}
