// shared.ts is already loaded by tests/setup.ts — all functions are on global
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

const {
  goalTarget, goalTitle, getLevel, getLevelProgress, getRank,
  xpToLevel, xpForNextLevel,
  statForTitle, getTotalXP, getPlayerName, getStats, incrementStat,
  getDeviceId,
  localDayKey, parseDayKey, dayKeyAddDays,
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
  it('level 1 at xp = 0',    () => { expect(getLevel(0)).toBe(1); });
  it('level 1 at xp = 99',   () => { expect(getLevel(99)).toBe(1); });
  it('level 2 at xp = 100',  () => { expect(getLevel(100)).toBe(2); });
  it('level 2 at xp = 299',  () => { expect(getLevel(299)).toBe(2); });
  it('level 3 at xp = 300',  () => { expect(getLevel(300)).toBe(3); });
  it('level 5 at xp = 1000', () => { expect(getLevel(1000)).toBe(5); });
  it('level 10 at xp = 4500',() => { expect(getLevel(4500)).toBe(10); });
  it('xpToLevel(N) is the lower boundary for level N', () => {
    [2, 3, 5, 10].forEach(n => {
      expect(getLevel(xpToLevel(n))).toBe(n);
      expect(getLevel(xpToLevel(n) - 1)).toBe(n - 1);
    });
  });
});

describe('xpToLevel / xpForNextLevel', () => {
  it('xpToLevel(1) = 0',    () => { expect(xpToLevel(1)).toBe(0); });
  it('xpToLevel(2) = 100',  () => { expect(xpToLevel(2)).toBe(100); });
  it('xpToLevel(3) = 300',  () => { expect(xpToLevel(3)).toBe(300); });
  it('xpToLevel(5) = 1000', () => { expect(xpToLevel(5)).toBe(1000); });
  it('xpForNextLevel(1) = 100', () => { expect(xpForNextLevel(1)).toBe(100); });
  it('xpForNextLevel(2) = 200', () => { expect(xpForNextLevel(2)).toBe(200); });
  it('xpForNextLevel(N) = 100*N', () => {
    [1,2,3,5,10].forEach(n => expect(xpForNextLevel(n)).toBe(100 * n));
  });
});

// ── getLevelProgress ──────────────────────────────────────────────────────────

describe('getLevelProgress', () => {
  it('returns 0 at xp = 0 (start of level 1)',        () => { expect(getLevelProgress(0)).toBe(0); });
  it('returns 50 at xp = 50 (half of level 1)',        () => { expect(getLevelProgress(50)).toBe(50); });
  it('returns 0 at exact level boundary (xp = 100)',   () => { expect(getLevelProgress(100)).toBe(0); });
  it('returns 0 at xp = 101 (1 XP into a 200-XP level)', () => { expect(getLevelProgress(101)).toBe(0); });
  it('returns 50 at midpoint of level 2 (xp = 200)',  () => { expect(getLevelProgress(200)).toBe(50); });
  it('returns 0 at start of level 3 (xp = 300)',      () => { expect(getLevelProgress(300)).toBe(0); });
  it('returns 50 at midpoint of level 3 (xp = 450)',  () => { expect(getLevelProgress(450)).toBe(50); });
  it('is always in [0, 99]', () => {
    [0, 50, 99, 100, 300, 1000, 4500].forEach(xp => {
      const p = getLevelProgress(xp);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(100);
    });
  });
});

// ── getRank ───────────────────────────────────────────────────────────────────

describe('getRank', () => {
  it('Aspirant (E) at level 1',       () => { expect(getRank(1).rank).toBe('E'); });
  it('Aspirant (E) at level 4',       () => { expect(getRank(4).rank).toBe('E'); });
  it('Bronze Saint (D) at level 5',   () => { expect(getRank(5).rank).toBe('D'); });
  it('Bronze Saint (D) at level 9',   () => { expect(getRank(9).rank).toBe('D'); });
  it('Silver Saint (C) at level 10',     () => { expect(getRank(10).rank).toBe('C'); });
  it('Gold Saint (B) at level 20',    () => { expect(getRank(20).rank).toBe('B'); });
  it('Divine Saint (A) at level 35',        () => { expect(getRank(35).rank).toBe('A'); });
  it('God Saint (S) at level 50',      () => { expect(getRank(50).rank).toBe('S'); });
  it('God Saint (S) above level 50',   () => { expect(getRank(100).rank).toBe('S'); });
  it('returns the full rank object', () => {
    expect(getRank(1)).toEqual({ minLevel: 1, rank: 'E', title: 'Aspirant' });
  });
});

// ── statForTitle ──────────────────────────────────────────────────────────────

describe('statForTitle', () => {
  it('returns strength for push-up titles',   () => { expect(statForTitle('Push-Ups [0/20]')).toBe('strength'); });
  it('returns core for sit-up titles',        () => { expect(statForTitle('Sit-Ups [0/20]')).toBe('core'); });
  it('returns power for squat titles',        () => { expect(statForTitle('Squats [0/20]')).toBe('power'); });
  it('returns endurance for plank titles',    () => { expect(statForTitle('Plank [0/30]')).toBe('endurance'); });
  it('returns agility for stretch titles',    () => { expect(statForTitle('Stretch [0/60]')).toBe('agility'); });
  it('returns null for unknown exercise',     () => { expect(statForTitle('Burpees')).toBeNull(); });
  it('returns null for unrelated agility-adjacent titles', () => { expect(statForTitle('Yoga')).toBeNull(); });
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
  it('returns Saint when playerName is not set', () => {
    expect(getPlayerName()).toBe('Saint');
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

// ── getDeviceId ───────────────────────────────────────────────────────────────

describe('getDeviceId', () => {
  it('generates a UUID-format string on first call', () => {
    const id = getDeviceId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('returns the same value on subsequent calls', () => {
    const first  = getDeviceId();
    const second = getDeviceId();
    expect(first).toBe(second);
  });

  it('stores the id under the key "deviceId"', () => {
    const id = getDeviceId();
    expect(localStorage.getItem('deviceId')).toBe(id);
  });

  it('returns the pre-existing value if one is already in localStorage', () => {
    localStorage.setItem('deviceId', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    expect(getDeviceId()).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
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

// ── localDayKey ───────────────────────────────────────────────────────────────

describe('localDayKey', () => {
  it('formats a date as YYYY-MM-DD with zero padding', () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('uses local time, not UTC', () => {
    // 23:30 local on the 31st must stay the 31st, whatever the offset
    expect(localDayKey(new Date(2026, 6, 31, 23, 30))).toBe('2026-07-31');
  });
});

describe('parseDayKey', () => {
  it('returns local midnight for the key', () => {
    const d = parseDayKey('2026-07-31');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(31);
    expect(d.getHours()).toBe(0);
  });

  it('round-trips with localDayKey', () => {
    expect(localDayKey(parseDayKey('2024-02-29'))).toBe('2024-02-29');
  });
});

describe('dayKeyAddDays', () => {
  it('advances one day', () => {
    expect(dayKeyAddDays('2026-07-30', 1)).toBe('2026-07-31');
  });

  it('crosses a month boundary', () => {
    expect(dayKeyAddDays('2026-07-31', 1)).toBe('2026-08-01');
  });

  it('crosses a year boundary', () => {
    expect(dayKeyAddDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(dayKeyAddDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('goes backwards with a negative offset', () => {
    expect(dayKeyAddDays('2026-08-01', -1)).toBe('2026-07-31');
  });
});
