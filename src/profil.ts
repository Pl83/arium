// shared.js must be loaded before this file

// ─── Radar Chart ─────────────────────────────────────────────────────────────
// Renders a 4-axis spider/radar chart into #radar-chart SVG for the
// Crystalline Arcane design. Called from render() after stats are loaded.

const RADAR_ATTR_COLORS: Record<string, string> = {
  strength:  '#FF8FB5',
  core:      '#9B8CFF',
  power:     '#FFCB6B',
  endurance: '#69F0CE',
};

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
  ];

  // 4-axis layout: top, right, bottom, left
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
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

  // ── Grid rings ──
  [0.33, 0.66, 1].forEach(mag => {
    const pts = labels.map((_, i) => pt(i, mag).join(',')).join(' ');
    svg.appendChild(el('polygon', {
      points: pts, fill: 'none',
      stroke: 'rgba(220,210,255,0.22)', 'stroke-width': '0.6',
    }));
  });

  // ── Axes ──
  labels.forEach((_, i) => {
    const [x, y] = pt(i, 1);
    svg.appendChild(el('line', {
      x1: cx, y1: cy, x2: x, y2: y,
      stroke: 'rgba(220,210,255,0.22)', 'stroke-width': '0.6',
    }));
  });

  // ── Data polygon ──
  const dataPts = labels.map((l, i) =>
    pt(i, Math.min((attrs[l.key] || 0) / SOFT_MAX, 1)),
  );
  const dataD = 'M' + dataPts.map(p => p.join(',')).join(' L') + ' Z';
  svg.appendChild(el('path', {
    d: dataD,
    fill: 'rgba(155,140,255,0.18)',
    stroke: '#9B8CFF',
    'stroke-width': '1.5',
    'stroke-linejoin': 'miter',
    filter: 'drop-shadow(0 0 8px #9B8CFF)',
  }));

  // ── Dots ──
  labels.forEach((l, i) => {
    const [x, y] = pt(i, Math.min((attrs[l.key] || 0) / SOFT_MAX, 1));
    svg.appendChild(el('circle', {
      cx: x, cy: y, r: 3,
      fill: RADAR_ATTR_COLORS[l.key] ?? '#9B8CFF',
      stroke: '#08051A', 'stroke-width': '1',
    }));
  });

  // ── Labels ──
  labels.forEach((l, i) => {
    const [x, y] = pt(i, 1.26);
    const g = document.createElementNS(NS, 'g') as SVGGElement;

    const abbr = el('text', {
      x, y: y + 4, 'font-size': '9',
      fill: 'rgba(220,210,255,0.6)',
      'text-anchor': 'middle',
      'letter-spacing': '0.15em',
      'font-family': "'Cinzel', serif",
    });
    abbr.textContent = l.name;

    const val = el('text', {
      x, y: y + 17, 'font-size': '13',
      'font-weight': '700',
      fill: RADAR_ATTR_COLORS[l.key] ?? '#9B8CFF',
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

  // Rank badge
  const rankLetterEl = document.getElementById('rankLetter') as HTMLElement;
  rankLetterEl.textContent = rank.rank;
  rankLetterEl.className = 'rank-letter rank-' + rank.rank.toLowerCase();
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
  global.renderRadarChart = renderRadarChart;
  module.exports = { render, renderRadarChart };
}
