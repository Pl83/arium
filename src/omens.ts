/**
 * omens.ts — the in-game notification layer
 *
 * Replaces the two hand-rolled modals that used to live in index.ts. Those
 * shared a single #overlay/#info element and a single `{ once: true }` dismiss
 * handler, so a launch that raised both a Rebuke and an Ascension had them
 * overwrite each other's text and tear each other down. Every omen here owns
 * its own node and its own timer, so two raised together both survive.
 *
 * One call does both halves:
 *
 *     raiseOmen({ kind: 'ascension', title: 'Ascension', body: '…' })
 *
 * The toast container is created lazily on document.body, so NO page needs
 * markup for this. That is what lets profil.ts raise the house omen without
 * touching profile.html.
 *
 * Icons are drawn paths, never glyph characters — Android WebView has no
 * guaranteed symbol font and the CSP forbids fetching one.
 */

type OmenKind = 'ascension' | 'rebuke' | 'levelup' | 'streak' | 'house';

interface OmenEntry {
  k:  OmenKind;
  t:  string;
  b:  string;
  ts: number;
}

const OMEN_LOG_KEY = 'omens';

// The log is a keepsake, not an archive. Fifty entries is more than a player
// will ever scroll and keeps the serialised blob under a couple of kilobytes,
// which matters because the whole thing is rewritten on every raise.
const OMEN_LOG_MAX = 50;

const OMEN_FADE_MS = 350;

// Ascension is the rarest event in the app and earns the longest dwell.
const OMEN_DWELL_MS: Record<OmenKind, number> = {
  ascension: 7000,
  rebuke:    4500,
  levelup:   4500,
  streak:    4500,
  house:     4500,
};

const OMEN_ICONS: Record<OmenKind, string> = {
  ascension: 'M12 3.5l1.9 4.8 4.9 1.5-3.8 2.8 1.4 4.9L12 14.9 7.6 17.5l1.4-4.9L5.2 9.8l4.9-1.5L12 3.5z',
  rebuke:    'M13.5 2L5.5 13H10l-1.2 9 8-11.5h-4.6L13.5 2z',
  levelup:   'M12 3l7.5 7.5h-4.3V21H8.8V10.5H4.5L12 3z',
  streak:    'M12 2.5c1.9 4 5 5.2 5 9.1a5 5 0 0 1-10 0c0-2.2 1.1-3.4 2.2-4.4 0 2 .9 3 1.8 3s1.2-1.6 1.2-2.9c0-1.8-.7-3-2.2-4.8z',
  house:     'M15.8 2.5a8 8 0 1 0 5.7 12.6A9.2 9.2 0 0 1 15.8 2.5z',
};

// ── The log ───────────────────────────────────────────────────────────────

// Corrupt storage degrades to an empty log rather than taking the page down
// with it. A notification history is never worth a crash.
function readOmens(): OmenEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(OMEN_LOG_KEY) || '[]');
    return Array.isArray(parsed) ? (parsed as OmenEntry[]) : [];
  } catch {
    return [];
  }
}

// Stored oldest-first so the cap trims from the front with a single slice.
function appendOmen(entry: OmenEntry): void {
  const log = readOmens();
  log.push(entry);
  const trimmed = log.length > OMEN_LOG_MAX ? log.slice(log.length - OMEN_LOG_MAX) : log;
  localStorage.setItem(OMEN_LOG_KEY, JSON.stringify(trimmed));
}

// ── Relative time ─────────────────────────────────────────────────────────

// `now` is a parameter rather than a Date.now() call so the boundaries are
// testable without leaning on fake timers.
function omenAgo(ts: number, now: number): string {
  const secs = Math.max(0, Math.floor((now - ts) / 1000));
  if (secs < 60) return 'just now';

  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + 'm ago';

  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';

  return Math.floor(hours / 24) + 'd ago';
}

// ── Toasts ────────────────────────────────────────────────────────────────

function omenStack(): HTMLElement {
  let stack = document.getElementById('omen-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'omen-stack';
    // Announced politely: an omen is never urgent enough to interrupt whatever
    // a screen reader is already saying.
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  return stack;
}

function omenIcon(kind: OmenKind): SVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'omen-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', OMEN_ICONS[kind]);
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  return svg;
}

function showOmenToast(entry: OmenEntry): HTMLElement {
  const toast = document.createElement('div');
  toast.className = 'omen-toast omen-' + entry.k;

  const text = document.createElement('div');
  text.className = 'omen-text';

  const title = document.createElement('p');
  title.className = 'omen-title';
  title.textContent = entry.t;

  const body = document.createElement('p');
  body.className = 'omen-body';
  body.textContent = entry.b;

  text.appendChild(title);
  text.appendChild(body);
  toast.appendChild(omenIcon(entry.k));
  toast.appendChild(text);

  // Guards the two paths to removal — the dwell timer and an early tap — from
  // running the teardown twice and removing a node that is already gone.
  let closing = false;

  function close(): void {
    if (closing) return;
    closing = true;
    toast.classList.add('omen-out');
    setTimeout(() => toast.remove(), OMEN_FADE_MS);
  }

  toast.addEventListener('click', close);
  setTimeout(close, OMEN_DWELL_MS[entry.k]);

  omenStack().appendChild(toast);
  return toast;
}

// ── The one call ──────────────────────────────────────────────────────────

function raiseOmen(o: { kind: OmenKind; title: string; body: string }): OmenEntry {
  const entry: OmenEntry = { k: o.kind, t: o.title, b: o.body, ts: Date.now() };
  appendOmen(entry);
  showOmenToast(entry);
  return entry;
}

// ── The log, rendered ─────────────────────────────────────────────────────

// Newest first. Storage order is oldest-first, so this reverses a copy rather
// than mutating what readOmens handed back.
function renderOmenLog(host: HTMLElement, now: number): void {
  host.innerHTML = '';
  const entries = readOmens().slice().reverse();

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'omen-empty';
    empty.textContent = 'No omens yet.';
    host.appendChild(empty);
    return;
  }

  entries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'omen-row omen-' + entry.k;

    const text = document.createElement('div');
    text.className = 'omen-text';

    const title = document.createElement('p');
    title.className = 'omen-title';
    title.textContent = entry.t;

    const body = document.createElement('p');
    body.className = 'omen-body';
    body.textContent = entry.b;

    text.appendChild(title);
    text.appendChild(body);

    const when = document.createElement('span');
    when.className = 'omen-when';
    when.textContent = omenAgo(entry.ts, now);

    row.appendChild(omenIcon(entry.k));
    row.appendChild(text);
    row.appendChild(when);
    host.appendChild(row);
  });
}

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.raiseOmen     = raiseOmen;
  global.readOmens     = readOmens;
  global.omenAgo       = omenAgo;
  global.renderOmenLog = renderOmenLog;
  module.exports = {
    raiseOmen, readOmens, appendOmen, omenAgo, showOmenToast, renderOmenLog,
    OMEN_LOG_KEY, OMEN_LOG_MAX, OMEN_FADE_MS, OMEN_DWELL_MS,
  };
}
