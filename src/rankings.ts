// shared.js and supabase.js must be loaded before this file

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

function renderRankings(rows: PlayerRow[], deviceId: string, offline: boolean): void {
  const appEl = document.querySelector('.app') as HTMLElement;
  appEl.innerHTML = '';

  if (offline) {
    const badge = document.createElement('div');
    badge.className = 'offline-badge';
    badge.textContent = 'Offline';
    appEl.appendChild(badge);
  }

  const groups = groupAndSort(rows);

  if (groups.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No players yet. Be the first!';
    appEl.appendChild(empty);
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
      const row = document.createElement('div');
      row.className = 'leaderboard-row' + (player.device_id === deviceId ? ' current-player' : '');

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
      section.appendChild(row);
    });

    appEl.appendChild(section);
  });
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
  global.groupAndSort       = groupAndSort;
  global.renderRankings     = renderRankings;
  global.renderOfflineEmpty = renderOfflineEmpty;
  global.initRankings       = initRankings;
  module.exports = { groupAndSort, renderRankings, renderOfflineEmpty, initRankings };
}
