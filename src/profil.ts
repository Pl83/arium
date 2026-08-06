// shared.js must be loaded before this file

// ─── Radar Chart ─────────────────────────────────────────────────────────────
// Renders a 5-axis spider/radar chart into #radar-chart SVG for the Sanctuary
// design. Called from render() after stats are loaded.
//
// Colours are read from theme.css at render time so the chart follows whichever
// palette is active. The fallbacks are the Sanctuary Dark values, used when no
// stylesheet is attached (jsdom under test).

function themeColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

const RADAR_ATTR_FALLBACKS: Record<string, string> = {
  strength:  '#FF9B7A',
  core:      '#A28BF7',
  power:     '#E8C160',
  endurance: '#7FE0B8',
  agility:   '#B79CFF',
};

function radarAttrColor(key: string): string {
  return themeColor('--attr-' + key, RADAR_ATTR_FALLBACKS[key] ?? '#E8C160');
}

function renderRadarChart(attrs: Partial<StatMap>): void {
  const svg = document.getElementById('radar-chart') as SVGSVGElement | null;
  if (!svg) return;

  const size = 220;
  const cx = size / 2, cy = size / 2;
  const r = size * 0.34;
  const SOFT_MAX = 30; // visual cap (real cap is STAT_SOFT_CAP)

  const labels: { key: StatKey; name: string }[] = [
    { key: 'strength',  name: 'STR' },
    { key: 'core',      name: 'COR' },
    { key: 'power',     name: 'POW' },
    { key: 'endurance', name: 'END' },
    { key: 'agility',   name: 'AGI' },
  ];

  // N-axis layout: regular polygon starting at top (−π/2), evenly spaced
  const angles = labels.map((_, i) => -Math.PI / 2 + (2 * Math.PI / labels.length) * i);
  const pt = (i: number, mag: number): [number, number] => [
    cx + Math.cos(angles[i]) * r * mag,
    cy + Math.sin(angles[i]) * r * mag,
  ];

  const NS = 'http://www.w3.org/2000/svg';
  const el = (
    tag: string,
    a: Record<string, string | number>,
  ): SVGElement => {
    const node = document.createElementNS(NS, tag) as SVGElement;
    const keys = Object.keys(a) as (keyof typeof a)[];
    keys.forEach(k => node.setAttribute(k as string, String(a[k])));
    return node;
  };

  svg.innerHTML = '';

  const gold     = themeColor('--gold', '#E8C160');
  const gridLine = themeColor('--fg-dim', 'rgba(230,220,255,0.35)');
  const labelCol = themeColor('--fg-muted', 'rgba(230,220,255,0.6)');
  const groundCol = themeColor('--bg', '#0A0716');

  // ── Grid rings ──
  [0.33, 0.66, 1].forEach(mag => {
    const pts = labels.map((_, i) => pt(i, mag).join(',')).join(' ');
    svg.appendChild(el('polygon', {
      points: pts, fill: 'none',
      stroke: gridLine, 'stroke-width': '0.6',
    }));
  });

  // ── Axes ──
  labels.forEach((_, i) => {
    const [x, y] = pt(i, 1);
    svg.appendChild(el('line', {
      x1: cx, y1: cy, x2: x, y2: y,
      stroke: gridLine, 'stroke-width': '0.6',
    }));
  });

  // ── Data polygon ──
  const dataPts = labels.map((l, i) =>
    pt(i, Math.min((attrs[l.key] || 0) / SOFT_MAX, 1)),
  );
  const dataD = 'M' + dataPts.map(p => p.join(',')).join(' L') + ' Z';
  svg.appendChild(el('path', {
    d: dataD,
    fill: themeColor('--gold-faint', 'rgba(232,193,96,0.08)'),
    stroke: gold,
    'stroke-width': '1.5',
    'stroke-linejoin': 'miter',
    filter: 'drop-shadow(0 0 8px ' + gold + ')',
  }));

  // ── Dots ──
  labels.forEach((l, i) => {
    const [x, y] = pt(i, Math.min((attrs[l.key] || 0) / SOFT_MAX, 1));
    svg.appendChild(el('circle', {
      cx: x, cy: y, r: 3,
      fill: radarAttrColor(l.key),
      stroke: groundCol, 'stroke-width': '1',
    }));
  });

  // ── Labels ──
  labels.forEach((l, i) => {
    const [x, y] = pt(i, 1.26);
    const g = document.createElementNS(NS, 'g') as SVGGElement;

    const abbr = el('text', {
      x, y: y + 4, 'font-size': '9',
      fill: labelCol,
      'text-anchor': 'middle',
      'letter-spacing': '0.15em',
      'font-family': "'Cinzel', serif",
    });
    abbr.textContent = l.name;

    const val = el('text', {
      x, y: y + 17, 'font-size': '13',
      'font-weight': '700',
      fill: radarAttrColor(l.key),
      'text-anchor': 'middle',
      'font-family': "'Cinzel', serif",
    });
    val.textContent = String(attrs[l.key] || 0);

    g.appendChild(abbr);
    g.appendChild(val);
    svg.appendChild(g);
  });
}

// ─────────────────────────────────────────────────────────────────────────────

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
  renderNameHouse();

  // Rank badge
  const rankLetterEl = document.getElementById('rankLetter') as HTMLElement;
  rankLetterEl.textContent = rank.rank;
  rankLetterEl.className = 'rank-letter rank-' + rank.rank.toLowerCase();
  (document.getElementById('rankTitle') as HTMLElement).textContent = rank.title;

  // Level
  (document.getElementById('profileLevel') as HTMLElement).textContent = String(level);
  (document.getElementById('profileLevelProgress') as HTMLElement).style.width = progress + '%';
  // Label overlays the whole bar; a fill at 0% would clip text placed inside it
  const barLabel = document.getElementById('profileLevelLabel');
  if (barLabel) barLabel.textContent = progress + '%';

  // General stats
  (document.getElementById('streakCount') as HTMLElement).textContent = streak + (streak === 1 ? ' day' : ' days');
  (document.getElementById('totalXPDisplay') as HTMLElement).textContent = xp + ' cosmo';
  (document.getElementById('totalCompleted') as HTMLElement).textContent = String(totalCompleted);

  // Attribute bars (hidden in new design, kept for JS compatibility)
  STAT_KEYS.forEach(key => {
    const val = stats[key] || 0;
    const pct = Math.min(100, Math.round((val / STAT_SOFT_CAP) * 100));
    const fillEl = document.getElementById('bar-' + key);
    const valEl  = document.getElementById('val-' + key);
    /* istanbul ignore else */ if (fillEl) fillEl.style.width = pct + '%';
    /* istanbul ignore else */ if (valEl)  valEl.textContent = String(val);
  });

  // Radar chart
  renderRadarChart(stats);
}

// --- Editable name ---

document.getElementById('editNameBtn')!.addEventListener('click', () => {
  const nameTag  = document.getElementById('nameTag') as HTMLElement;
  const editBtn  = document.getElementById('editNameBtn') as HTMLElement;
  // The badge is part of the name strip: it steps aside with the name while the
  // input holds the row, and comes back with it.
  const houseTag = document.getElementById('nameHouse') as HTMLElement;
  const current  = getPlayerName();

  nameTag.style.display = 'none';
  editBtn.style.display = 'none';
  houseTag.style.display = 'none';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.className = 'name-input';
  input.maxLength = NAME_MAX_LEN;

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '✓';
  saveBtn.className = 'save-name-btn';

  const error = document.createElement('p');
  error.className = 'name-error';
  error.hidden = true;

  const nameSection = document.getElementById('nameSection') as HTMLElement;
  nameSection.appendChild(input);
  nameSection.appendChild(saveBtn);
  nameSection.appendChild(error);
  input.addEventListener('input', () => { error.hidden = true; });
  input.focus();
  input.select();

  function save(): void {
    const newName = sanitizePlayerName(input.value);

    // Refused, not silently corrected: the player must see why and choose again.
    if (!isNameClean(newName)) {
      error.textContent = 'That name is not permitted. Choose another.';
      error.hidden = false;
      input.focus();
      input.select();
      return;
    }

    localStorage.setItem('playerName', newName);
    nameTag.textContent = newName;
    nameTag.style.display = '';
    editBtn.style.display = '';
    houseTag.style.display = '';
    input.remove();
    saveBtn.remove();
    error.remove();
  }

  saveBtn.addEventListener('click', save);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
});

// --- Display › Theme ---

// theme.ts owns the storage and the <html> attribute; this only drives the
// control's appearance and repaints what CSS cannot repaint on its own.
function initThemeControl(): void {
  const control = document.getElementById('themeControl');
  if (!control) return;

  const buttons = Array.from(control.querySelectorAll('.seg-btn')) as HTMLElement[];

  function markActive(): void {
    const current = getTheme();
    buttons.forEach(b => b.classList.toggle('active', b.dataset.themeChoice === current));
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const choice = btn.dataset.themeChoice;
      if (choice !== 'auto' && choice !== 'dark' && choice !== 'light') return;
      setTheme(choice);
      markActive();
      // The radar bakes its colours in at draw time, so it would keep the old
      // palette until the next navigation unless we redraw it here.
      renderRadarChart(getStats());
    });
  });

  markActive();
}

// --- Sanctuary › Your House ---

// The house is cosmetic and stays cosmetic: this control writes one id and one
// timestamp, and lights one glyph on the opening sigil. houses.ts owns the
// rules; this only renders them and reports refusals.
function initHouseControl(): void {
  const grid = document.getElementById('houseGrid');
  const hint = document.getElementById('houseHint');
  if (!grid || !hint) return;

  const NS = 'http://www.w3.org/2000/svg';

  function glyph(id: string): SVGElement {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'house-glyph');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(NS, 'use');
    // The defs live in profile.html, copied from index.html.
    use.setAttribute('href', '#zg-' + id);
    svg.appendChild(use);
    return svg;
  }

  function render(): void {
    const now      = Date.now();
    const current  = getHouse();
    const unlocked = canChangeHouse(now);

    (grid as HTMLElement).innerHTML = '';

    HOUSES.forEach(h => {
      const held = h.id === current;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'house-btn' + (held ? ' active' : '');
      btn.setAttribute('aria-pressed', String(held));
      btn.setAttribute('aria-label', 'House of ' + h.name);
      btn.title = 'House of ' + h.name;
      // The held house is never disabled — greying out the one you own reads
      // as having lost it. The others lock until the week is up.
      btn.disabled = !unlocked && !held;
      btn.appendChild(glyph(h.id));
      btn.addEventListener('click', () => choose(h));
      (grid as HTMLElement).appendChild(btn);
    });

    (hint as HTMLElement).textContent = current === null
      ? 'Choose your house. A mark of allegiance, and nothing more.'
      : 'House of ' + houseName(current) + ' · ' +
        (unlocked ? 'You may choose again.' : houseCooldownLabel(now));
  }

  function choose(h: House): void {
    // setHouse refuses a locked change or a re-pick of the house already held,
    // and spends nothing when it refuses. Re-render either way so a stale
    // cooldown label corrects itself on the tap.
    if (!setHouse(h.id, Date.now())) {
      render();
      return;
    }
    render();
    // The badge beside the name sits outside this control's grid, so it has to
    // be told; without this it keeps the old glyph until the next navigation.
    renderNameHouse();
    raiseOmen({
      kind:  'house',
      title: 'House Claimed',
      body:  'House of ' + h.name + '. Your glyph burns on the wheel.',
    });
  }

  render();
}

// --- Danger zone › Delete Account ---

// Nothing local is destroyed until the server confirms the leaderboard row is
// gone — or tells us there never was one. See deletePlayer() in supabase.ts for
// why 'absent' counts as success and an empty DELETE response does not.
function initDeleteAccount(): void {
  const trigger    = document.getElementById('deleteAccountBtn') as HTMLButtonElement | null;
  const confirmBox = document.getElementById('deleteConfirm');
  const cancelBtn  = document.getElementById('deleteCancelBtn') as HTMLButtonElement | null;
  const eraseBtn   = document.getElementById('deleteConfirmBtn') as HTMLButtonElement | null;
  const status     = document.getElementById('deleteStatus');
  if (!trigger || !confirmBox || !cancelBtn || !eraseBtn || !status) return;

  // Step one only reveals the confirmation; it touches nothing.
  trigger.addEventListener('click', () => {
    trigger.hidden = true;
    confirmBox.hidden = false;
    status.textContent = '';
  });

  cancelBtn.addEventListener('click', () => {
    confirmBox.hidden = true;
    trigger.hidden = false;
    status.textContent = '';
  });

  eraseBtn.addEventListener('click', async () => {
    eraseBtn.disabled = true;
    cancelBtn.disabled = true;
    status.textContent = 'Contacting the Sanctuary…';

    const outcome = await deletePlayer(getDeviceId());

    if (outcome === 'failed') {
      eraseBtn.disabled = false;
      cancelBtn.disabled = false;
      status.textContent = 'Could not reach the Sanctuary. Nothing was deleted.';
      return;
    }

    localStorage.clear();
    // profile.html carries no database handle, so the SQLite side cannot be
    // cleared here. index.ts drops the objectives table when it sees this flag.
    localStorage.setItem('pendingWipe', '1');
    window.location.href = 'index.html';
  });
}

render();
initThemeControl();
initHouseControl();
initDeleteAccount();

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.render = render;
  global.renderRadarChart = renderRadarChart;
  global.initThemeControl  = initThemeControl;
  global.initHouseControl  = initHouseControl;
  global.initDeleteAccount = initDeleteAccount;
  module.exports = {
    render, renderRadarChart,
    initThemeControl, initHouseControl, initDeleteAccount,
  };
}
