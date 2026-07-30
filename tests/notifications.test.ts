// notifications.ts exposes initNotifications, cancelRemainingTodayNotifications,
// and _rescheduleIfNewDay (internal, exported only for testing).
// shared.ts is already on global via setup.ts.

const {
  initNotifications,
  cancelRemainingTodayNotifications,
  _rescheduleIfNewDay,
  NOTIFICATION_TIMES,
  NOTIFICATION_MESSAGES,
} = require('../src/notifications');

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makePlugin({ requestGranted = true } = {}) {
  const plugin = {
    requestPermission: jest.fn((cb) => cb(requestGranted)),
    cancelAll:         jest.fn((cb) => cb && cb()),
    schedule:          jest.fn(),
    cancel:            jest.fn(),
  };
  (global as any).cordova = { plugins: { notification: { local: plugin } } };
  return plugin;
}

function clearCordova() {
  delete (global as any).cordova;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  clearCordova();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  clearCordova();
});

// ── Browser / no-cordova guard ────────────────────────────────────────────────

describe('browser guard', () => {
  it('initNotifications calls callback immediately when cordova is absent', () => {
    const cb = jest.fn();
    initNotifications(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('cancelRemainingTodayNotifications does nothing when cordova is absent', () => {
    expect(() => cancelRemainingTodayNotifications()).not.toThrow();
  });

  it('_rescheduleIfNewDay does nothing when cordova is absent', () => {
    expect(() => _rescheduleIfNewDay()).not.toThrow();
  });
});

// ── initNotifications — permission denied ─────────────────────────────────────

describe('initNotifications — permission denied', () => {
  it('calls callback even when permission is denied', () => {
    const plugin = makePlugin({ requestGranted: false });
    const cb = jest.fn();
    initNotifications(cb);
    expect(plugin.requestPermission).toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does NOT call cancelAll when permission is denied', () => {
    const plugin = makePlugin({ requestGranted: false });
    initNotifications(jest.fn());
    expect(plugin.cancelAll).not.toHaveBeenCalled();
  });
});

// ── initNotifications — same day (no reschedule) ──────────────────────────────

describe('initNotifications — permission granted, same day', () => {
  beforeEach(() => {
    localStorage.setItem('lastNotificationsScheduled', new Date().toDateString());
  });

  it('calls callback', () => {
    const plugin = makePlugin();
    const cb = jest.fn();
    initNotifications(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does NOT call cancelAll (already scheduled today)', () => {
    const plugin = makePlugin();
    initNotifications(jest.fn());
    expect(plugin.cancelAll).not.toHaveBeenCalled();
  });

  it('does NOT call schedule', () => {
    const plugin = makePlugin();
    initNotifications(jest.fn());
    expect(plugin.schedule).not.toHaveBeenCalled();
  });
});

// ── initNotifications — new day (reschedule) ──────────────────────────────────

describe('initNotifications — permission granted, new day', () => {
  beforeEach(() => {
    // lastNotificationsScheduled not set → fresh schedule
  });

  it('calls cancelAll then schedule', () => {
    const plugin = makePlugin();
    initNotifications(jest.fn());
    expect(plugin.cancelAll).toHaveBeenCalled();
    expect(plugin.schedule).toHaveBeenCalled();
  });

  it('stores lastNotificationsScheduled = today', () => {
    makePlugin();
    initNotifications(jest.fn());
    expect(localStorage.getItem('lastNotificationsScheduled'))
      .toBe(new Date().toDateString());
  });

  it('increments notifMsgOffset by 3 on reschedule', () => {
    localStorage.setItem('notifMsgOffset', '6');
    makePlugin();
    initNotifications(jest.fn());
    expect(localStorage.getItem('notifMsgOffset')).toBe('9');
  });

  it('wraps notifMsgOffset at pool length (15)', () => {
    localStorage.setItem('notifMsgOffset', '13'); // 13 + 3 = 16 → 16 % 15 = 1
    makePlugin();
    initNotifications(jest.fn());
    expect(parseInt(localStorage.getItem('notifMsgOffset'))).toBe(1);
  });

  it('schedules at most 21 notifications (3 slots × 7 days)', () => {
    // Mock clock to midnight so all 21 slots are in the future
    jest.setSystemTime(new Date('2025-01-01T00:00:00'));
    makePlugin();
    initNotifications(jest.fn());
    const plugin = (global as any).cordova.plugins.notification.local;
    const calls = plugin.schedule.mock.calls;
    expect(calls.length).toBe(1);
    const notifs = calls[0][0];
    expect(notifs.length).toBe(21);
  });

  it('all scheduled notification IDs are unique', () => {
    jest.setSystemTime(new Date('2025-01-01T00:00:00'));
    makePlugin();
    initNotifications(jest.fn());
    const notifs = (global as any).cordova.plugins.notification.local.schedule.mock.calls[0][0];
    const ids = notifs.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('schedules fewer than 21 when some slots have already passed today', () => {
    // Set clock to 14:00 → slot 0 (08:00) and slot 1 (13:00) of today already passed
    jest.setSystemTime(new Date('2025-01-01T14:00:00'));
    makePlugin();
    initNotifications(jest.fn());
    const notifs = (global as any).cordova.plugins.notification.local.schedule.mock.calls[0][0];
    expect(notifs.length).toBeLessThan(21);
    // Slot 2 (19:00) of today should still be included
    const todaySlot2At = new Date('2025-01-01T19:00:00').getTime();
    expect(notifs.some(n => n.trigger.at.getTime() === todaySlot2At)).toBe(true);
  });

  it('each notification has title "Daily Ordeal"', () => {
    jest.setSystemTime(new Date('2025-01-01T00:00:00'));
    makePlugin();
    initNotifications(jest.fn());
    const notifs = (global as any).cordova.plugins.notification.local.schedule.mock.calls[0][0];
    expect(notifs.every(n => n.title === 'Daily Ordeal')).toBe(true);
  });

  it('notification texts are drawn from the message pool', () => {
    jest.setSystemTime(new Date('2025-01-01T00:00:00'));
    makePlugin();
    initNotifications(jest.fn());
    const notifs = (global as any).cordova.plugins.notification.local.schedule.mock.calls[0][0];
    expect(notifs.every(n => NOTIFICATION_MESSAGES.includes(n.text))).toBe(true);
  });
});

// ── cancelRemainingTodayNotifications ─────────────────────────────────────────

describe('cancelRemainingTodayNotifications', () => {
  it('cancels all 3 slots when called at 06:00 (before all slots)', () => {
    jest.setSystemTime(new Date('2025-06-15T06:00:00'));
    const plugin = makePlugin();
    cancelRemainingTodayNotifications();
    expect(plugin.cancel).toHaveBeenCalledTimes(1);
    expect(plugin.cancel.mock.calls[0][0].length).toBe(3);
  });

  it('cancels only slot 1 and slot 2 when called at 10:00 (after 08:00 slot)', () => {
    jest.setSystemTime(new Date('2025-06-15T10:00:00'));
    const plugin = makePlugin();
    cancelRemainingTodayNotifications();
    expect(plugin.cancel.mock.calls[0][0].length).toBe(2);
  });

  it('cancels only slot 2 when called at 14:00', () => {
    jest.setSystemTime(new Date('2025-06-15T14:00:00'));
    const plugin = makePlugin();
    cancelRemainingTodayNotifications();
    expect(plugin.cancel.mock.calls[0][0].length).toBe(1);
  });

  it('cancels nothing when called at 21:00 (all slots have passed)', () => {
    jest.setSystemTime(new Date('2025-06-15T21:00:00'));
    const plugin = makePlugin();
    cancelRemainingTodayNotifications();
    expect(plugin.cancel).not.toHaveBeenCalled();
  });

  it('uses the correct deterministic IDs for today\'s slots', () => {
    jest.setSystemTime(new Date('2025-06-15T06:00:00'));
    const plugin = makePlugin();
    cancelRemainingTodayNotifications();
    const cancelledIds = plugin.cancel.mock.calls[0][0];
    // dayOffset = floor(2025-06-15 00:00:00 UTC / 86400000)
    const todayStart = new Date('2025-06-15T00:00:00');
    todayStart.setHours(0, 0, 0, 0);
    const dayOffset = Math.floor(todayStart.getTime() / 86400000);
    expect(cancelledIds).toEqual([dayOffset * 10, dayOffset * 10 + 1, dayOffset * 10 + 2]);
  });
});

// ── NOTIFICATION_MESSAGES pool ────────────────────────────────────────────────

describe('NOTIFICATION_MESSAGES pool', () => {
  it('contains exactly 15 messages', () => {
    expect(NOTIFICATION_MESSAGES.length).toBe(15);
  });

  it('every message is a non-empty string of 80 chars or less', () => {
    NOTIFICATION_MESSAGES.forEach(msg => {
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg.length).toBeLessThanOrEqual(80);
    });
  });
});
