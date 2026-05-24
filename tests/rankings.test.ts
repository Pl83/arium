// shared.ts and supabase.ts are required manually below

const RANKINGS_DOM = `<main class="app"></main>`;

let rankingsModule: any;

function makeRow(overrides: Partial<PlayerRow> = {}): PlayerRow {
  return {
    device_id:   'dev-1',
    player_name: 'Hunter',
    total_xp:    0,
    level:       1,
    rank_letter: 'E',
    updated_at:  '',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  document.body.innerHTML = RANKINGS_DOM;
  jest.resetModules();
  require('../src/shared');
  require('../src/supabase');
  rankingsModule = require('../src/rankings');
});

// ── groupAndSort ──────────────────────────────────────────────────────────────

describe('groupAndSort', () => {
  it('returns one group per distinct rank_letter present', () => {
    const rows = [
      makeRow({ rank_letter: 'E', total_xp: 50 }),
      makeRow({ rank_letter: 'D', total_xp: 1000 }),
    ];
    const groups = rankingsModule.groupAndSort(rows);
    expect(groups.map((g: any) => g.rank.rank)).toEqual(['D', 'E']);
  });

  it('emits groups in S→E order (highest rank first)', () => {
    const rows = [
      makeRow({ rank_letter: 'E' }),
      makeRow({ rank_letter: 'C' }),
      makeRow({ rank_letter: 'S' }),
      makeRow({ rank_letter: 'A' }),
    ];
    const order = rankingsModule.groupAndSort(rows).map((g: any) => g.rank.rank);
    expect(order).toEqual(['S', 'A', 'C', 'E']);
  });

  it('skips empty rank groups', () => {
    const rows = [makeRow({ rank_letter: 'B', total_xp: 10 })];
    const groups = rankingsModule.groupAndSort(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].rank.rank).toBe('B');
  });

  it('sorts players within a group by total_xp descending', () => {
    const rows = [
      makeRow({ device_id: 'a', rank_letter: 'E', total_xp: 50 }),
      makeRow({ device_id: 'b', rank_letter: 'E', total_xp: 99 }),
      makeRow({ device_id: 'c', rank_letter: 'E', total_xp: 10 }),
    ];
    const [group] = rankingsModule.groupAndSort(rows);
    expect(group.players.map((p: PlayerRow) => p.total_xp)).toEqual([99, 50, 10]);
  });

  it('returns an empty array when rows is empty', () => {
    expect(rankingsModule.groupAndSort([])).toEqual([]);
  });
});

// ── renderRankings ────────────────────────────────────────────────────────────

describe('renderRankings', () => {
  it('renders one section per rank group present', () => {
    const rows = [
      makeRow({ rank_letter: 'E', total_xp: 50 }),
      makeRow({ device_id: 'x', rank_letter: 'D', total_xp: 1000 }),
    ];
    rankingsModule.renderRankings(rows, 'nobody', false);
    expect(document.querySelectorAll('.rank-section')).toHaveLength(2);
  });

  it('renders an empty-state message when groups is empty', () => {
    rankingsModule.renderRankings([], 'nobody', false);
    expect(document.querySelector('.empty-state')).not.toBeNull();
  });

  it('marks the current player row with .current-player', () => {
    const rows = [
      makeRow({ device_id: 'me',    rank_letter: 'E', total_xp: 99 }),
      makeRow({ device_id: 'other', rank_letter: 'E', total_xp: 50 }),
    ];
    rankingsModule.renderRankings(rows, 'me', false);
    const highlighted = document.querySelectorAll('.current-player');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].querySelector('.row-name')!.textContent).toBe('Hunter');
  });

  it('does not mark any row when deviceId does not match', () => {
    const rows = [makeRow({ device_id: 'someone-else', rank_letter: 'E' })];
    rankingsModule.renderRankings(rows, 'nobody', false);
    expect(document.querySelector('.current-player')).toBeNull();
  });

  it('shows offline badge when offline=true', () => {
    rankingsModule.renderRankings([], 'nobody', true);
    expect(document.querySelector('.offline-badge')).not.toBeNull();
  });

  it('does not show offline badge when offline=false', () => {
    rankingsModule.renderRankings([], 'nobody', false);
    expect(document.querySelector('.offline-badge')).toBeNull();
  });

  it('shows position numbers starting at 1 within each group', () => {
    const rows = [
      makeRow({ device_id: 'a', rank_letter: 'E', total_xp: 90 }),
      makeRow({ device_id: 'b', rank_letter: 'E', total_xp: 50 }),
    ];
    rankingsModule.renderRankings(rows, 'nobody', false);
    const positions = [...document.querySelectorAll('.row-pos')].map(el => el.textContent);
    expect(positions).toEqual(['1', '2']);
  });

  it('renders player name safely via textContent (not innerHTML)', () => {
    const rows = [makeRow({ player_name: '<script>alert(1)</script>', rank_letter: 'E' })];
    rankingsModule.renderRankings(rows, 'nobody', false);
    const nameEl = document.querySelector('.row-name') as HTMLElement;
    expect(nameEl.textContent).toBe('<script>alert(1)</script>');
    expect(nameEl.innerHTML).not.toContain('<script>');
  });
});

// ── renderOfflineEmpty ────────────────────────────────────────────────────────

describe('renderOfflineEmpty', () => {
  it('renders an offline badge', () => {
    rankingsModule.renderOfflineEmpty();
    expect(document.querySelector('.offline-badge')).not.toBeNull();
    expect(document.querySelector('.offline-badge')!.textContent).toBe('Offline');
  });

  it('renders an empty-state message', () => {
    rankingsModule.renderOfflineEmpty();
    expect(document.querySelector('.empty-state')).not.toBeNull();
  });

  it('clears any previous content in .app', () => {
    document.querySelector('.app')!.innerHTML = '<p class="stale">stale</p>';
    rankingsModule.renderOfflineEmpty();
    expect(document.querySelector('.stale')).toBeNull();
  });
});

// ── initRankings — cache round-trip ──────────────────────────────────────────

describe('initRankings — cache', () => {
  it('stores fetched rows in rankingsCache localStorage key', async () => {
    const rows = [makeRow({ total_xp: 200, level: 2, rank_letter: 'E' })];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(rows),
    });
    localStorage.setItem('playerName', 'Tester');

    await rankingsModule.initRankings();

    const raw = localStorage.getItem('rankingsCache');
    expect(raw).not.toBeNull();
    const cached = JSON.parse(raw!);
    expect(cached.rows).toEqual(rows);
    expect(typeof cached.ts).toBe('number');
  });

  it('falls back to cached rows when fetch throws', async () => {
    const rows = [makeRow({ device_id: 'cached-user', rank_letter: 'E', total_xp: 50 })];
    localStorage.setItem('rankingsCache', JSON.stringify({ ts: Date.now(), rows }));
    localStorage.setItem('playerName', 'Tester');
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    await rankingsModule.initRankings();

    expect(document.querySelector('.offline-badge')).not.toBeNull();
    expect(document.querySelector('.rank-section')).not.toBeNull();
  });

  it('calls renderOfflineEmpty when fetch throws and no cache exists', async () => {
    localStorage.setItem('playerName', 'Tester');
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

    await rankingsModule.initRankings();

    expect(document.querySelector('.offline-badge')).not.toBeNull();
    expect(document.querySelector('.empty-state')).not.toBeNull();
  });
});
