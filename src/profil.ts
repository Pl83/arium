// shared.js must be loaded before this file

function render(): void {
  const xp = getTotalXP();
  const level = getLevel(xp);
  const progress = getLevelProgress(xp);
  const rank = getRank(level);
  const streak = parseInt(localStorage.getItem('streak') || '0', 10);
  const totalCompleted = parseInt(localStorage.getItem('totalCompleted') || '0', 10);
  const stats = getStats();

  // Name
  (document.getElementById('nameTag') as HTMLElement).textContent = getPlayerName();

  // Rank badge
  (document.getElementById('rankLetter') as HTMLElement).textContent = rank.rank;
  (document.getElementById('rankTitle') as HTMLElement).textContent = rank.title;

  // Level
  (document.getElementById('profileLevel') as HTMLElement).textContent = String(level);
  const bar = document.getElementById('profileLevelProgress') as HTMLElement;
  bar.style.width = progress + '%';
  bar.textContent = progress + '%';

  // General stats
  (document.getElementById('streakCount') as HTMLElement).textContent = streak + (streak === 1 ? ' day' : ' days');
  (document.getElementById('totalXPDisplay') as HTMLElement).textContent = xp + ' xp';
  (document.getElementById('totalCompleted') as HTMLElement).textContent = String(totalCompleted);

  // Attribute bars
  STAT_KEYS.forEach(key => {
    const val = stats[key] || 0;
    const pct = Math.min(100, Math.round((val / STAT_SOFT_CAP) * 100));
    const fillEl = document.getElementById('bar-' + key);
    const valEl  = document.getElementById('val-' + key);
    /* istanbul ignore else */ if (fillEl) fillEl.style.width = pct + '%';
    /* istanbul ignore else */ if (valEl)  valEl.textContent = String(val);
  });
}

// --- Editable name ---

document.getElementById('editNameBtn')!.addEventListener('click', () => {
  const nameTag = document.getElementById('nameTag') as HTMLElement;
  const editBtn = document.getElementById('editNameBtn') as HTMLElement;
  const current = getPlayerName();

  nameTag.style.display = 'none';
  editBtn.style.display = 'none';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.className = 'name-input';
  input.maxLength = 20;

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '✓';
  saveBtn.className = 'save-name-btn';

  const nameSection = document.getElementById('nameSection') as HTMLElement;
  nameSection.appendChild(input);
  nameSection.appendChild(saveBtn);
  input.focus();
  input.select();

  function save(): void {
    const newName = input.value.trim() || 'Hunter';
    localStorage.setItem('playerName', newName);
    nameTag.textContent = newName;
    nameTag.style.display = '';
    editBtn.style.display = '';
    input.remove();
    saveBtn.remove();
  }

  saveBtn.addEventListener('click', save);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
});

render();

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.render = render;
  module.exports = { render };
}
