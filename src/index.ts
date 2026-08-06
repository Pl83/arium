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
    // The boot chain below will never run. Lift the sigil rather than leaving
    // the user staring at it until the failsafe fires.
    hideSplash();
  }, () => {
    initNotifications(() => {
      maybeShowNameSetup(() => {
        handleDailyReset(() => {
          // seed first, then render — fixes race condition on first launch
          seedInitialObjectives(() => {
            refreshLevelBar();
            updateNameTag();
            // Dismissed from init's completion callback, not after it returns:
            // init renders from a DB transaction, so returning proves nothing.
            init(hideSplash);
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
  const error   = document.getElementById('name-setup-error') as HTMLElement;

  // First run: the chain now stalls here until the Saint names themselves, so
  // the sigil has to lift now or it would cover the registration card.
  hideSplash();

  overlay.style.display = 'flex';
  input.focus();
  input.addEventListener('input', () => { error.hidden = true; });

  function confirm(): void {
    const name = sanitizePlayerName(input.value);

    // This name goes straight to the public leaderboard, so it is vetted here
    // rather than corrected silently.
    if (!isNameClean(name)) {
      error.textContent = 'That name is not permitted. Choose another.';
      error.hidden = false;
      input.focus();
      input.select();
      return;
    }

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

// Streaks worth announcing. A milestone at every single day would make the
// notification meaningless by the second week.
const STREAK_MILESTONES = [7, 30, 100];

function applyStreakAndPenalty(total: number, done: number): void {
  if (total === 0) return;
  const streak = parseInt(localStorage.getItem('streak') || '0', 10);
  if (done === total) {
    const next = streak + 1;
    localStorage.setItem('streak', String(next));
    if (STREAK_MILESTONES.indexOf(next) !== -1) {
      raiseOmen({
        kind:  'streak',
        title: 'Unbroken',
        body:  next + ' days without fail. The Sanctuary takes note.',
      });
    }
  } else {
    const missed  = total - done;
    const penalty = missed * XP_PENALTY_PER_MISS;
    localStorage.setItem('totalXP', String(Math.max(0, getTotalXP() - penalty)));
    localStorage.setItem('streak', '0');
    raiseOmen({
      kind:  'rebuke',
      title: 'Rebuke',
      body:  missed + ' ordeal' + (missed > 1 ? 's' : '') + ' unfinished yesterday. −' + penalty + ' Cosmo. Streak reset.',
    });
  }
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
    // Installs seeded before the swap carry a 'Stretch' row; rename it so the
    // daily reset (which matches on goal name) can keep it in sync.
    const jacks = GOAL_CONFIG.find(cfg => cfg.name === 'Jumping Jacks');
    if (jacks) {
      tx.executeSql('UPDATE objectives SET title = ? WHERE title LIKE ?', [goalTitle(jacks, level), 'Stretch%']);
    }
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
  renderNameHouse();

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

// `done` fires once the ordeal list is fully in the DOM. The opening sigil
// waits on it, so it must not be hoisted any earlier than the last append.
function init(done?: () => void): void {
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
              const newLevel = getLevel(newXP);
              animateBar(oldProgress, 100, () => {
                bar.style.width = '0%';
                setLevelLabel(newXP);
                animateBar(0, newProgress, () => {
                  // Raised after the bar has finished refilling, so the
                  // announcement lands on the level the player can already see.
                  raiseOmen({
                    kind:  'levelup',
                    title: 'Level Reached',
                    body:  'Level ' + newLevel + '. Your Cosmo burns brighter.',
                  });
                  // A rank change rides on top of the level-up rather than
                  // replacing it — both are true, and both now fit on screen.
                  const newRank = getRank(newLevel);
                  if (newRank.rank !== getRank(getLevel(oldXP)).rank) {
                    raiseOmen({
                      kind:  'ascension',
                      title: 'Ascension',
                      body:  newRank.rank + '-Rank · ' + newRank.title + '. The Sanctuary acknowledges your Cosmo.',
                    });
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

      if (done) done();
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
  global.STREAK_MILESTONES        = STREAK_MILESTONES;
  global.resetObjectives          = resetObjectives;
  global.seedInitialObjectives    = seedInitialObjectives;
  global.refreshLevelBar          = refreshLevelBar;
  global.updateNameTag            = updateNameTag;
  global.animateBar               = animateBar;
  global.init                     = init;
  module.exports = {
    onDeviceReady, maybeShowNameSetup, handleDailyReset, migrateLastOpenedISO, checkYesterdayCompletion, recordClosedDays, applyStreakAndPenalty,
    resetObjectives, seedInitialObjectives,
    refreshLevelBar, updateNameTag, animateBar, init, STREAK_MILESTONES,
  };
}
