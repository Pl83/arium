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
    const name = input.value.trim() || 'Hunter';
    localStorage.setItem('playerName', name);
    overlay.style.display = 'none';
    callback();
  }

  btn.addEventListener('click', confirm);
  input.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') confirm(); });
}

// --- Daily reset ---

function handleDailyReset(callback: () => void): void {
  const today = new Date().toDateString();
  const lastOpened = localStorage.getItem('lastOpened');
  if (lastOpened !== today) {
    localStorage.setItem('lastOpened', today);
    checkYesterdayCompletion(() => resetObjectives(callback));
  } else {
    callback();
  }
}

function checkYesterdayCompletion(next: () => void): void {
  db.transaction(tx => {
    tx.executeSql('SELECT COUNT(*) as total FROM objectives', [], (tx, res) => {
      const total = (res.rows.item(0) as { total: number }).total;
      tx.executeSql('SELECT COUNT(*) as done FROM objectives WHERE completed = 1', [], (_tx, res2) => {
        applyStreakAndPenalty(total, (res2.rows.item(0) as { done: number }).done);
      });
    });
  }, err => {
    console.error('Completion check error', err);
    next();
  }, () => {
    next();
  });
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
  (info.querySelector('.banner .alert h2') as HTMLElement).textContent = 'Penalty';
  const p = info.querySelector('.banner p') as HTMLElement;
  p.textContent = missed + ' objective' + (missed > 1 ? 's' : '') + ' unfinished yesterday. −' + penalty + ' XP. Streak reset.';
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
  (info.querySelector('.banner .alert h2') as HTMLElement).textContent = 'Rank Up';
  const p = info.querySelector('.banner p') as HTMLElement;
  p.textContent = rank.rank + '-Rank · ' + rank.title + '. The system acknowledges your strength.';
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

function refreshLevelBar(): void {
  const xp = getTotalXP();
  const progress = getLevelProgress(xp);
  const bar = document.getElementById('levelProgress') as HTMLElement;
  bar.style.width = progress + '%';
  bar.textContent = 'Lv.' + getLevel(xp) + ' — ' + progress + '%';
}

function updateNameTag(): void {
  const xp = getTotalXP();
  const rank = getRank(getLevel(xp));
  (document.getElementById('nameTag') as HTMLElement).textContent = getPlayerName() + ' — ' + rank.title;
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
                bar.textContent = 'Lv.' + getLevel(newXP) + ' — ' + newProgress + '%';
                animateBar(0, newProgress, () => {
                  if (getRank(getLevel(newXP)).rank !== getRank(getLevel(oldXP)).rank) {
                    showRankUpModal(getRank(getLevel(newXP)));
                  }
                });
              });
            } else if (xpDelta > 0) {
              bar.textContent = 'Lv.' + getLevel(newXP) + ' — ' + newProgress + '%';
              animateBar(oldProgress, newProgress);
            } else {
              bar.style.width = newProgress + '%';
              bar.textContent = 'Lv.' + getLevel(newXP) + ' — ' + newProgress + '%';
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
  global.checkYesterdayCompletion = checkYesterdayCompletion;
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
    onDeviceReady, maybeShowNameSetup, handleDailyReset, checkYesterdayCompletion, applyStreakAndPenalty,
    showPenaltyModal, showRankUpModal, resetObjectives, seedInitialObjectives,
    refreshLevelBar, updateNameTag, animateBar, init,
  };
}
