// shared.js must be loaded before this file (provides XP_PER_LEVEL, getRank, etc.)

document.addEventListener('deviceready', onDeviceReady, false);

const XP_PER_OBJECTIVE    = 25;
const XP_PENALTY_PER_MISS = 15;

let db!: SQLiteDatabase;

function onDeviceReady(): void {
  db = window.sqlitePlugin.openDatabase({ name: 'fitness.db', location: 'default' });

  db.transaction(tx => {
    tx.executeSql(`CREATE TABLE IF NOT EXISTS objectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      completed INTEGER
    )`);
    createDayLogTable(tx);
    // Delete Account runs on profile.html, which has no database handle of its
    // own. It clears localStorage and leaves this flag so the objectives table
    // is emptied here, before anything reseeds it.
    if (localStorage.getItem('pendingWipe')) {
      tx.executeSql('DELETE FROM objectives');
      tx.executeSql('DELETE FROM day_log');
      localStorage.removeItem('pendingWipe');
    }
  }, err => {
    console.error('DB Error', err);
  }, () => {
    initNotifications(() => {
      maybeShowNameSetup(() => {
        handleDailyReset(() => {
          // seed first, then render — fixes race condition on first launch
          seedInitialObjectives(() => {
            refreshLevelBar();
            updateNameTag();
            init();
          });
        });
      });
    });
  });
}

// --- First-run name setup ---

function maybeShowNameSetup(callback: () => void): void {
  if (localStorage.getItem('playerName') !== null) {
    callback();
    return;
  }
  const overlay = document.getElementById('name-setup') as HTMLElement;
  const input   = document.getElementById('name-setup-input') as HTMLInputElement;
  const btn     = document.getElementById('name-setup-btn') as HTMLButtonElement;

  overlay.style.display = 'flex';
  input.focus();

  function confirm(): void {
    const name = input.value.trim() || 'Saint';
    localStorage.setItem('playerName', name);
    overlay.style.display = 'none';
    callback();
  }

  btn.addEventListener('click', confirm);
  input.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') confirm(); });
}

// --- Daily reset ---

// lastOpened holds toDateString() output ("Wed Jul 31 2026"), which neither
// sorts nor compares. lastOpenedISO carries the same instant in 'YYYY-MM-DD'
// form for the Chronicle. lastOpened itself is left untouched — other code
// still reads it.
function migrateLastOpenedISO(): string | null {
  const iso = localStorage.getItem('lastOpenedISO');
  if (iso) return iso;
  const legacy = localStorage.getItem('lastOpened');
  if (!legacy) return null;
  const parsed = new Date(legacy);
  if (isNaN(parsed.getTime())) return null;
  const derived = localDayKey(parsed);
  localStorage.setItem('lastOpenedISO', derived);
  return derived;
}

function handleDailyReset(callback: () => void): void {
  const today = new Date().toDateString();
  const todayKey = localDayKey(new Date());
  const lastOpened = localStorage.getItem('lastOpened');
  migrateLastOpenedISO();

  if (lastOpened !== today) {
    localStorage.setItem('lastOpened', today);
    // lastOpenedISO is advanced only AFTER the history write, because
    // recordClosedDays (Task 5) reads it to learn where the gap starts.
    checkYesterdayCompletion(() => {
      localStorage.setItem('lastOpenedISO', todayKey);
      resetObjectives(callback);
    });
  } else {
    localStorage.setItem('lastOpenedISO', todayKey);
    callback();
  }
}

function checkYesterdayCompletion(next: () => void): void {
  db.transaction(tx => {
    tx.executeSql('SELECT COUNT(*) as total FROM objectives', [], (tx, res) => {
      const total = (res.rows.item(0) as { total: number }).total;
      tx.executeSql('SELECT COUNT(*) as done FROM objectives WHERE completed = 1', [], (_tx, res2) => {
        const done = (res2.rows.item(0) as { done: number }).done;
        // recordClosedDays MUST run before applyStreakAndPenalty: it reads the
        // pre-mutation 'streak' from localStorage, and applyStreakAndPenalty
        // overwrites that same key. Swapping this order silently changes the
        // streak value written into day_log.
        recordClosedDays(total, done);
        applyStreakAndPenalty(total, done);
      });
    });
  }, err => {
    console.error('Completion check error', err);
    next();
  }, () => {
    next();
  });
}

// Writes the day just ended, then fills the days the app never saw.
// Reads lastOpenedISO itself rather than taking it as a parameter, which
// keeps checkYesterdayCompletion's arity unchanged for existing callers.
// Deliberately separate from applyStreakAndPenalty: the record is written
// here, the punishment is decided there, and adding history must not change
// any player's Cosmo by a single point.
function recordClosedDays(total: number, done: number): void {
  const lastKey = localStorage.getItem('lastOpenedISO');
  if (total === 0 || !lastKey) return;
  const todayKey = localDayKey(new Date());
  if (lastKey >= todayKey) return;

  const streak = parseInt(localStorage.getItem('streak') || '0', 10);
  const closingStreak = done === total ? streak + 1 : 0;

  finalizeDay(db, lastKey, done, total, closingStreak);
  backfillGap(db, lastKey, todayKey, total);
}

function applyStreakAndPenalty(total: number, done: number): void {
  if (total === 0) return;
  const streak = parseInt(localStorage.getItem('streak') || '0', 10);
  if (done === total) {
    localStorage.setItem('streak', String(streak + 1));
  } else {
    const missed  = total - done;
    const penalty = missed * XP_PENALTY_PER_MISS;
    localStorage.setItem('totalXP', String(Math.max(0, getTotalXP() - penalty)));
    localStorage.setItem('streak', '0');
    setTimeout(() => showPenaltyModal(missed, penalty), 200);
  }
}

function showPenaltyModal(missed: number, penalty: number): void {
  const overlay = document.getElementById('overlay') as HTMLElement;
  const info = document.getElementById('info') as HTMLElement;
  (info.querySelector('.banner .alert h2') as HTMLElement).textContent = 'Rebuke';
  const p = info.querySelector('.banner p') as HTMLElement;
  p.textContent = missed + ' ordeal' + (missed > 1 ? 's' : '') + ' unfinished yesterday. −' + penalty + ' Cosmo. Streak reset.';
  p.className = 'failure';
  overlay.style.display = 'block';
  info.style.display = 'block';
  overlay.addEventListener('click', () => {
    overlay.style.display = 'none';
    info.style.display = 'none';
  }, { once: true });
}

function showRankUpModal(rank: RankEntry): void {
  const overlay = document.getElementById('overlay') as HTMLElement;
  const info = document.getElementById('info') as HTMLElement;
  (info.querySelector('.banner .alert h2') as HTMLElement).textContent = 'Ascension';
  const p = info.querySelector('.banner p') as HTMLElement;
  p.textContent = rank.rank + '-Rank · ' + rank.title + '. The Sanctuary acknowledges your Cosmo.';
  p.className = 'goldy';
  info.classList.add('rank-up');
  overlay.style.display = 'block';
  info.style.display = 'block';
  overlay.addEventListener('click', () => {
    overlay.style.display = 'none';
    info.style.display = 'none';
    info.classList.remove('rank-up');
  }, { once: true });
}

function resetObjectives(callback: () => void): void {
  const level = getLevel(getTotalXP());
  db.transaction(tx => {
    // Reset completion AND update targets to match current level
    GOAL_CONFIG.forEach(cfg => {
      tx.executeSql(
        'UPDATE objectives SET completed = 0, title = ? WHERE title LIKE ?',
        [goalTitle(cfg, level), cfg.name + '%']
      );
    });
  }, err => {
    console.error('Reset error', err);
    callback();
  }, () => {
    callback();
  });
}

// --- Seeding ---

function seedInitialObjectives(callback?: () => void): void {
  const level = getLevel(getTotalXP());
  db.transaction(tx => {
    tx.executeSql('SELECT COUNT(*) as count FROM objectives', [], (tx, res) => {
      if ((res.rows.item(0) as { count: number }).count === 0) {
        GOAL_CONFIG.forEach(cfg => {
          tx.executeSql('INSERT INTO objectives (title, completed) VALUES (?, ?)', [goalTitle(cfg, level), 0]);
        });
      }
    });
  }, err => {
    console.error('Seed error', err);
    if (callback) callback();
  }, () => {
    if (callback) callback();
  });
}

// --- XP & level bar ---

function levelBarLabel(xp: number): string {
  return 'Lv.' + getLevel(xp) + ' — ' + getLevelProgress(xp) + '% Cosmo';
}

// The label is a sibling overlay, not text inside the fill — a fill at 0%
// width would clip it out of sight.
function setLevelLabel(xp: number): void {
  const label = document.getElementById('levelLabel');
  if (label) label.textContent = levelBarLabel(xp);
}

function refreshLevelBar(): void {
  const xp = getTotalXP();
  (document.getElementById('levelProgress') as HTMLElement).style.width = getLevelProgress(xp) + '%';
  setLevelLabel(xp);
}

// Name sits on the left of the header; rank drives the laurel medallion on
// the right. The medallion and title elements are absent from some test
// fixtures, so every lookup past #nameTag is guarded.
function updateNameTag(): void {
  const rank = getRank(getLevel(getTotalXP()));
  (document.getElementById('nameTag') as HTMLElement).textContent = getPlayerName();

  const rankClass = 'rank-' + rank.rank.toLowerCase();

  const title = document.getElementById('rankTitle');
  if (title) {
    title.textContent = rank.title;
    title.className = 'rank-letter ' + rankClass;
  }

  const glyph = document.getElementById('rankGlyph');
  if (glyph) glyph.textContent = rank.rank;

  // SVG elements expose a read-only className, so set the attribute directly
  const medallion = document.getElementById('rankMedallion');
  if (medallion) medallion.setAttribute('class', 'rank-medallion rank-letter ' + rankClass);
}

function animateBar(fromPct: number, toPct: number, onDone?: () => void): void {
  const bar = document.getElementById('levelProgress') as HTMLElement;
  let width = fromPct;
  const id = setInterval(() => {
    if (width >= toPct) {
      clearInterval(id);
      if (onDone) onDone();
    } else if (width >= 100) {
      clearInterval(id);
      if (onDone) onDone();
    } else {
      width++;
      bar.style.width = width + '%';
    }
  }, 10);
}

// --- Objectives UI ---

interface ObjectiveRow {
  id: number;
  title: string;
  completed: number;
}

function init(): void {
  const list = document.querySelector('.center ul') as HTMLUListElement;
  list.innerHTML = '';

  db.transaction(tx => {
    tx.executeSql('SELECT * FROM objectives', [], (_tx, res) => {
      let completedCount = 0;
      const total = res.rows.length;

      for (let i = 0; i < res.rows.length; i++) {
        const obj = res.rows.item(i) as unknown as ObjectiveRow;
        if (obj.completed) completedCount++;

        const li = document.createElement('li');

        const label = document.createElement('span');
        // strip the [0/50] notation from the stored title — it's shown separately
        label.textContent = obj.title.replace(/\s*\[\d+\/\d+\]/, '');
        if (obj.completed) label.classList.add('striked');

        const status = document.createElement('span');
        const match = obj.title.match(/\[(\d+)\/(\d+)\]/);
        if (match) {
          status.textContent = '[' + (obj.completed ? match[2] : '0') + '/' + match[2] + ']';
        }

        li.appendChild(label);
        li.appendChild(status);

        li.addEventListener('click', () => {
          const newCompleted = obj.completed ? 0 : 1;
          const xpDelta = newCompleted === 1 ? XP_PER_OBJECTIVE : -XP_PER_OBJECTIVE;

          // Execute the UPDATE, then handle all UI work in the transaction
          // SUCCESS callback — runs only after the transaction fully commits,
          // so the next db.transaction in init() won't race with an open one.
          db.transaction(tx => {
            tx.executeSql('UPDATE objectives SET completed = ? WHERE id = ?', [newCompleted, obj.id]);
          }, err => {
            console.error('Update error', err);
          }, () => {
            // completedCount reflects the list as rendered, before this click
            const dayDone = completedCount + (newCompleted === 1 ? 1 : -1);
            bumpToday(db, { xpDelta: xpDelta, done: dayDone, total: total });

            const oldXP = getTotalXP();
            const newXP = Math.max(0, oldXP + xpDelta);
            localStorage.setItem('totalXP', String(newXP));

            if (xpDelta > 0) {
              const done = parseInt(localStorage.getItem('totalCompleted') || '0', 10);
              localStorage.setItem('totalCompleted', String(done + 1));
              incrementStat(statForTitle(obj.title));
            }

            const oldProgress = getLevelProgress(oldXP);
            const newProgress = getLevelProgress(newXP);
            const bar = document.getElementById('levelProgress') as HTMLElement;

            if (xpDelta > 0 && getLevel(newXP) > getLevel(oldXP)) {
              animateBar(oldProgress, 100, () => {
                bar.style.width = '0%';
                setLevelLabel(newXP);
                animateBar(0, newProgress, () => {
                  if (getRank(getLevel(newXP)).rank !== getRank(getLevel(oldXP)).rank) {
                    showRankUpModal(getRank(getLevel(newXP)));
                  }
                });
              });
            } else if (xpDelta > 0) {
              setLevelLabel(newXP);
              animateBar(oldProgress, newProgress);
            } else {
              bar.style.width = newProgress + '%';
              setLevelLabel(newXP);
            }

            updateNameTag();
            init();
          });
        });

        list.appendChild(li);
      }

      const popup = document.querySelector('.popup') as HTMLElement;
      if (total > 0 && completedCount === total) {
        popup.classList.add('quest-complete');
        cancelRemainingTodayNotifications();
      } else {
        popup.classList.remove('quest-complete');
      }
    });
  });
}

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global._setDb                   = (mockDb: SQLiteDatabase) => { db = mockDb; };
  global.onDeviceReady            = onDeviceReady;
  global.maybeShowNameSetup       = maybeShowNameSetup;
  global.handleDailyReset         = handleDailyReset;
  global.migrateLastOpenedISO     = migrateLastOpenedISO;
  global.checkYesterdayCompletion = checkYesterdayCompletion;
  global.recordClosedDays         = recordClosedDays;
  global.applyStreakAndPenalty    = applyStreakAndPenalty;
  global.showPenaltyModal         = showPenaltyModal;
  global.showRankUpModal          = showRankUpModal;
  global.resetObjectives          = resetObjectives;
  global.seedInitialObjectives    = seedInitialObjectives;
  global.refreshLevelBar          = refreshLevelBar;
  global.updateNameTag            = updateNameTag;
  global.animateBar               = animateBar;
  global.init                     = init;
  module.exports = {
    onDeviceReady, maybeShowNameSetup, handleDailyReset, migrateLastOpenedISO, checkYesterdayCompletion, recordClosedDays, applyStreakAndPenalty,
    showPenaltyModal, showRankUpModal, resetObjectives, seedInitialObjectives,
    refreshLevelBar, updateNameTag, animateBar, init,
  };
}
