// shared.js, namefilter.js, blocklist.js and supabase.js must be loaded before this file

// How long a press must be held before the report sheet opens.
const REPORT_HOLD_MS = 550;

function groupAndSort(rows: PlayerRow[]): { rank: RankEntry; players: PlayerRow[] }[] {
  return [...RANKS].reverse()
    .map(rankEntry => ({
      rank: rankEntry,
      players: rows
        .filter(p => p.rank_letter === rankEntry.rank)
        .sort((a, b) => b.total_xp - a.total_xp),
    }))
    .filter(group => group.players.length > 0);
}

// Opens the confirmation sheet for a reported player. Nothing is blocked until
// the user confirms — a long press is easy to trigger by accident.
function openReportSheet(playerName: string, onConfirm: () => void): void {
  const existing = document.querySelector('.report-sheet');
  if (existing) existing.remove();

  const sheet = document.createElement('div');
  sheet.className = 'report-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'report-card';

  const title = document.createElement('h3');
  title.textContent = 'Report this Saint';

  // textContent, never innerHTML: this string came from another user.
  const target = document.createElement('p');
  target.className = 'report-target';
  target.textContent = playerName;

  const note = document.createElement('p');
  note.className = 'report-note';
  note.textContent = 'They will be hidden from your rankings. This affects only your device.';

  const actions = document.createElement('div');
  actions.className = 'report-actions';

  const cancel = document.createElement('button');
  cancel.className = 'report-cancel';
  cancel.textContent = 'Cancel';

  const confirm = document.createElement('button');
  confirm.className = 'report-confirm';
  confirm.textContent = 'Report & hide';

  actions.appendChild(cancel);
  actions.appendChild(confirm);
  card.appendChild(title);
  card.appendChild(target);
  card.appendChild(note);
  card.appendChild(actions);
  sheet.appendChild(card);
  document.body.appendChild(sheet);

  function close(): void { sheet.remove(); }

  cancel.addEventListener('click', close);
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
  confirm.addEventListener('click', () => { close(); onConfirm(); });
}

// Fires onHold after REPORT_HOLD_MS of uninterrupted press. Both touch and mouse
// are wired: touch for the device, mouse so the gesture is reachable in the
// browser platform build.
function attachHoldToReport(row: HTMLElement, onHold: () => void): void {
  let timer: number | null = null;

  function cancel(): void {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  function start(): void {
    cancel();
    timer = setTimeout(() => { timer = null; onHold(); }, REPORT_HOLD_MS);
  }

  row.addEventListener('touchstart', start, { passive: true });
  row.addEventListener('mousedown', start);
  ['touchend', 'touchmove', 'touchcancel', 'mouseup', 'mouseleave'].forEach(
    ev => row.addEventListener(ev, cancel),
  );
  // Suppresses the Android text-selection popup that a long press otherwise raises.
  row.addEventListener('contextmenu', e => e.preventDefault());
}

function renderRankings(rows: PlayerRow[], deviceId: string, offline: boolean): void {
  const appEl = document.querySelector('.app') as HTMLElement;
  appEl.innerHTML = '';

  const rerender = (): void => renderRankings(rows, deviceId, offline);

  if (offline) {
    const badge = document.createElement('div');
    badge.className = 'offline-badge';
    badge.textContent = 'Offline';
    appEl.appendChild(badge);
  }

  // Your own row survives even if your name matches something you blocked —
  // vanishing from your own leaderboard would read as a bug, not a setting.
  const visible = rows.filter(
    p => p.device_id === deviceId || !isNameBlocked(p.player_name),
  );

  const groups = groupAndSort(visible);

  if (groups.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = rows.length > 0
      ? 'Every Saint here is hidden.'
      : 'No players yet. Be the first!';
    appEl.appendChild(empty);
    appEl.appendChild(buildBlockedFooter(rerender));
    return;
  }

  groups.forEach(({ rank, players }) => {
    const section = document.createElement('section');
    section.className = 'rank-section';

    const header = document.createElement('div');
    header.className = 'rank-section-header';
    header.innerHTML =
      '<span class="rank-letter rank-' + rank.rank.toLowerCase() + '">' + rank.rank + '</span>' +
      '<span class="rank-section-title">' + rank.title + '</span>' +
      '<span class="rank-section-count">' + players.length + '</span>';
    section.appendChild(header);

    players.forEach((player, idx) => {
      const isSelf = player.device_id === deviceId;

      const row = document.createElement('div');
      row.className = 'leaderboard-row' + (isSelf ? ' current-player' : '');

      const pos  = document.createElement('span');
      pos.className = 'row-pos';
      pos.textContent = String(idx + 1);

      const name = document.createElement('span');
      name.className = 'row-name';
      name.textContent = player.player_name;

      const lvl  = document.createElement('span');
      lvl.className = 'row-level';
      lvl.textContent = 'Lv.' + player.level;

      const xp   = document.createElement('span');
      xp.className = 'row-xp';
      xp.textContent = player.total_xp + ' cosmo';

      row.appendChild(pos);
      row.appendChild(name);
      row.appendChild(lvl);
      row.appendChild(xp);

      // You cannot report yourself.
      if (!isSelf) {
        row.classList.add('reportable');
        attachHoldToReport(row, () => {
          openReportSheet(player.player_name, () => {
            blockName(player.player_name);
            rerender();
          });
        });
      }

      section.appendChild(row);
    });

    appEl.appendChild(section);
  });

  const hint = document.createElement('p');
  hint.className = 'report-hint';
  hint.textContent = 'Hold a Saint to report and hide them.';
  appEl.appendChild(hint);

  appEl.appendChild(buildBlockedFooter(rerender));
}

// Always rendered, but empty until something is blocked. This is the only way
// back from a mistaken report, so it must never be conditional on the blocked
// player still being present in the leaderboard.
function buildBlockedFooter(rerender: () => void): HTMLElement {
  const footer = document.createElement('div');
  footer.className = 'blocked-footer';

  const count = blockedCount();
  if (count === 0) return footer;

  const label = document.createElement('span');
  label.className = 'blocked-count';
  label.textContent = count + (count === 1 ? ' Saint hidden' : ' Saints hidden');

  const reset = document.createElement('button');
  reset.className = 'blocked-reset';
  reset.textContent = 'Show all';
  reset.addEventListener('click', () => { clearBlockedNames(); rerender(); });

  footer.appendChild(label);
  footer.appendChild(reset);
  return footer;
}

function renderOfflineEmpty(): void {
  const appEl = document.querySelector('.app') as HTMLElement;
  appEl.innerHTML = '';

  const badge = document.createElement('div');
  badge.className = 'offline-badge';
  badge.textContent = 'Offline';

  const msg = document.createElement('p');
  msg.className = 'empty-state';
  msg.textContent = 'No cached data. Connect to load rankings.';

  appEl.appendChild(badge);
  appEl.appendChild(msg);
}

async function initRankings(): Promise<void> {
  const deviceId = getDeviceId();
  const xp       = getTotalXP();
  const level    = getLevel(xp);
  const rank     = getRank(level);

  upsertPlayer({
    device_id:   deviceId,
    player_name: getPlayerName(),
    total_xp:    xp,
    level:       level,
    rank_letter: rank.rank,
  }).catch(() => { /* silent — offline upsert failure is non-fatal */ });

  const appEl = document.querySelector('.app') as HTMLElement;
  appEl.innerHTML = '<div class="loading-state">Loading rankings…</div>';

  try {
    const rows = await fetchLeaderboard();
    localStorage.setItem('rankingsCache', JSON.stringify({ ts: Date.now(), rows }));
    renderRankings(rows, deviceId, false);
  } catch {
    const raw = localStorage.getItem('rankingsCache');
    if (raw) {
      try {
        const { rows } = JSON.parse(raw) as { ts: number; rows: PlayerRow[] };
        renderRankings(rows, deviceId, true);
      } catch {
        renderOfflineEmpty();
      }
    } else {
      renderOfflineEmpty();
    }
  }
}

/* istanbul ignore next */
if (typeof module === 'undefined') {
  document.addEventListener('DOMContentLoaded', () => { initRankings(); });
}

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.groupAndSort        = groupAndSort;
  global.renderRankings      = renderRankings;
  global.renderOfflineEmpty  = renderOfflineEmpty;
  global.initRankings        = initRankings;
  global.openReportSheet     = openReportSheet;
  global.attachHoldToReport  = attachHoldToReport;
  module.exports = {
    groupAndSort, renderRankings, renderOfflineEmpty, initRankings,
    openReportSheet, attachHoldToReport, REPORT_HOLD_MS,
  };
}
