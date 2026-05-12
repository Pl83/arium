// shared.js must be loaded before this file (provides nothing directly, but
// index.js depends on both being loaded first for the deviceready chain).

const NOTIFICATION_TIMES = [
  { hour: 8,  minute: 0  }, // Slot 0 — morning
  { hour: 13, minute: 0  }, // Slot 1 — afternoon
  { hour: 19, minute: 0  }, // Slot 2 — evening
];

const NOTIFICATION_MESSAGES = [
  'Daily quest active. Report to the training ground, Hunter.',
  'Your rank demands discipline. Complete today\'s objectives.',
  'Strength doesn\'t level up by itself. Time to grind.',
  'The system has issued your daily quest. Do not ignore it.',
  'E-rank thinking won\'t get you to S-rank. Move.',
  'Your core is weak. Fix that before the dungeon opens.',
  'Power stat falling behind. Today\'s quest awaits.',
  'Endurance is the difference between survival and defeat.',
  'Daily quest pending. The gate closes at midnight.',
  'A true hunter doesn\'t skip rest days — or quest days.',
  'The ranking board is watching. Don\'t fall behind today.',
  'Complete your objectives. Every rep counts toward ascension.',
  'You\'ve faced worse. Today\'s quest is just warm-up.',
  'The gap between E and S is built one quest at a time.',
  'Quest incomplete. Your next rank won\'t wait for you.',
];

function _getPlugin() {
  return typeof cordova !== 'undefined'
      && cordova.plugins
      && cordova.plugins.notification
      && cordova.plugins.notification.local;
}

function _rescheduleIfNewDay() {
  const today = new Date().toDateString();
  if (localStorage.getItem('lastNotificationsScheduled') === today) return;

  const plugin = _getPlugin();
  if (!plugin) return;

  plugin.cancelAll(function() {
    const rawOffset = parseInt(localStorage.getItem('notifMsgOffset') || '0', 10);
    const offset = (rawOffset + 3) % NOTIFICATION_MESSAGES.length;
    localStorage.setItem('notifMsgOffset', offset);
    localStorage.setItem('lastNotificationsScheduled', today);

    const notifications = [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const now = new Date();

    for (let d = 0; d < 7; d++) {
      const dayStart = new Date(todayStart.getTime() + d * 86400000);
      const dayOffset = Math.floor(dayStart.getTime() / 86400000);

      NOTIFICATION_TIMES.forEach(function(t, slot) {
        const at = new Date(dayStart);
        at.setHours(t.hour, t.minute, 0, 0);
        if (at > now) {
          notifications.push({
            id:    dayOffset * 10 + slot,
            title: 'Daily Quest',
            text:  NOTIFICATION_MESSAGES[(offset + d * 3 + slot) % NOTIFICATION_MESSAGES.length],
            trigger: { at: at },
          });
        }
      });
    }

    /* istanbul ignore else */ if (notifications.length) plugin.schedule(notifications);
  });
}

function initNotifications(callback) {
  const plugin = _getPlugin();
  if (!plugin) { callback(); return; }

  plugin.requestPermission(function(granted) {
    if (granted) _rescheduleIfNewDay();
    callback();
  });
}

function cancelRemainingTodayNotifications() {
  const plugin = _getPlugin();
  if (!plugin) return;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const dayOffset = Math.floor(todayStart.getTime() / 86400000);

  const ids = [];
  NOTIFICATION_TIMES.forEach(function(t, slot) {
    const fireAt = new Date(todayStart);
    fireAt.setHours(t.hour, t.minute, 0, 0);
    if (fireAt > now) ids.push(dayOffset * 10 + slot);
  });

  if (ids.length) plugin.cancel(ids);
}

/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.initNotifications               = initNotifications;
  global.cancelRemainingTodayNotifications = cancelRemainingTodayNotifications;
  global._rescheduleIfNewDay             = _rescheduleIfNewDay;
  module.exports = {
    initNotifications,
    cancelRemainingTodayNotifications,
    _rescheduleIfNewDay,
    NOTIFICATION_TIMES,
    NOTIFICATION_MESSAGES,
  };
}
