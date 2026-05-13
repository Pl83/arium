// shared.ts is already loaded by tests/setup.ts — all functions are on global
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

const {
  goalTarget, goalTitle, getLevel, getLevelProgress, getRank,
  statForTitle, getTotalXP, getPlayerName, getStats, incrementStat,
  GOAL_CONFIG,
} = require('../src/shared');

// ── goalTarget ────────────────────────────────────────────────────────────────

describe('goalTarget', () => {
  const cfg = { base: 20, step: 2, cap: 100 };

  it('returns base when level is 1', () => {
    expect(goalTarget(cfg, 1)).toBe(20);
  });

  it('scales by step per level', () => {
    expect(goalTarget(cfg, 5)).toBe(28);
  });

  it('is capped at cap value', () => {
    expect(goalTarget(cfg, 100)).toBe(100);
  });

  it('equals cap at the breakeven level', () => {
    // base=20, step=2, cap=100 → breakeven: level (100-20)/2 + 1 = 41
    expect(goalTarget(cfg, 41)).toBe(100);
    expect(goalTarget(cfg, 42)).toBe(100);
  });
});

// ── goalTitle ─────────────────────────────────────────────────────────────────

describe('goalTitle', () => {
  it('formats name with [0/target] at level 1', () => {
    expect(goalTitle({ name: 'Push-Ups', base: 20, step: 2, cap: 100 }, 1))
      .toBe('Push-Ups [0/20]');
  });

  it('reflects scaling in the title at higher levels', () => {
    expect(goalTitle({ name: 'Plank', base: 30, step: 5, cap: 300 }, 3))
      .toBe('Plank [0/40]');
  });
});

// ── getLevel ──────────────────────────────────────────────────────────────────

describe('getLevel', () => {
  it('level 1 at xp = 0', ()  => { expect(getLevel(0)).toBe(1); });
  it('level 1 at xp = 99', () => { expect(getLevel(99)).toBe(1); });
  it('level 2 at xp = 100', ()=> { expect(getLevel(100)).toBe(2); });
  it('level 2 at xp = 199', ()=> { expect(getLevel(199)).toBe(2); });
  it('level 10 at xp = 900', ()=> { expect(getLevel(900)).toBe(10); });
});

// ── getLevelProgress ──────────────────────────────────────────────────────────

describe('getLevelProgress', () => {
  it('returns 0 at xp = 0',   () => { expect(getLevelProgress(0)).toBe(0); });
  it('returns 50 at xp = 50', () => { expect(getLevelProgress(50)).toBe(50); });
  it('returns 0 at exact level boundary (xp = 100)', () => {
    expect(getLevelProgress(100)).toBe(0);
  });
  it('returns 1 at xp = 101', () => { expect(getLevelProgress(101)).toBe(1); });
});

// ── getRank ───────────────────────────────────────────────────────────────────

describe('getRank', () => {
  it('Novice (E) at level 1',       () => { expect(getRank(1).rank).toBe('E'); });
  it('Novice (E) at level 4',       () => { expect(getRank(4).rank).toBe('E'); });
  it('Apprentice (D) at level 5',   () => { expect(getRank(5).rank).toBe('D'); });
  it('Apprentice (D) at level 9',   () => { expect(getRank(9).rank).toBe('D'); });
  it('Warrior (C) at level 10',     () => { expect(getRank(10).rank).toBe('C'); });
  it('Champion (B) at level 20',    () => { expect(getRank(20).rank).toBe('B'); });
  it('Hero (A) at level 35',        () => { expect(getRank(35).rank).toBe('A'); });
  it('Legend (S) at level 50',      () => { expect(getRank(50).rank).toBe('S'); });
  it('Legend (S) above level 50',   () => { expect(getRank(100).rank).toBe('S'); });
  it('returns the full rank object', () => {
    expect(getRank(1)).toEqual({ minLevel: 1, rank: 'E', title: 'Novice' });
  });
});

// ── statForTitle ──────────────────────────────────────────────────────────────

describe('statForTitle', () => {
  it('returns strength for push-up titles',   () => { expect(statForTitle('Push-Ups [0/20]')).toBe('strength'); });
  it('returns core for sit-up titles',        () => { expect(statForTitle('Sit-Ups [0/20]')).toBe('core'); });
  it('returns power for squat titles',        () => { expect(statForTitle('Squats [0/20]')).toBe('power'); });
  it('returns endurance for plank titles',    () => { expect(statForTitle('Plank [0/30]')).toBe('endurance'); });
  it('returns null for unknown exercise',     () => { expect(statForTitle('Burpees')).toBeNull(); });
  it('is case-insensitive',                   () => { expect(statForTitle('PUSH-UPS')).toBe('strength'); });
});

// ── getTotalXP ────────────────────────────────────────────────────────────────

describe('getTotalXP', () => {
  it('returns 0 when localStorage is empty', () => {
    expect(getTotalXP()).toBe(0);
  });

  it('parses and returns the stored integer', () => {
    localStorage.setItem('totalXP', '250');
    expect(getTotalXP()).toBe(250);
  });
});

// ── getPlayerName ─────────────────────────────────────────────────────────────

describe('getPlayerName', () => {
  it('returns Hunter when playerName is not set', () => {
    expect(getPlayerName()).toBe('Hunter');
  });

  it('returns the stored player name', () => {
    localStorage.setItem('playerName', 'Atlas');
    expect(getPlayerName()).toBe('Atlas');
  });
});

// ── getStats ──────────────────────────────────────────────────────────────────

describe('getStats', () => {
  it('returns empty object when stats not set', () => {
    expect(getStats()).toEqual({});
  });

  it('parses and returns valid JSON', () => {
    localStorage.setItem('stats', JSON.stringify({ strength: 5 }));
    expect(getStats()).toEqual({ strength: 5 });
  });

  it('returns empty object on corrupt JSON (catch branch)', () => {
    localStorage.setItem('stats', '{corrupted}');
    expect(getStats()).toEqual({});
  });
});

// ── incrementStat ─────────────────────────────────────────────────────────────

describe('incrementStat', () => {
  it('does nothing when statName is null', () => {
    incrementStat(null);
    expect(getStats()).toEqual({});
  });

  it('sets stat to 1 on first call', () => {
    incrementStat('strength');
    expect(getStats().strength).toBe(1);
  });

  it('increments an existing stat', () => {
    localStorage.setItem('stats', JSON.stringify({ strength: 4 }));
    incrementStat('strength');
    expect(getStats().strength).toBe(5);
  });

  it('only changes the named stat, leaving others intact', () => {
    localStorage.setItem('stats', JSON.stringify({ strength: 2, core: 1 }));
    incrementStat('strength');
    expect(getStats()).toEqual({ strength: 3, core: 1 });
  });
});
