// Reporting and the device-local block list. Kept apart from rankings.test.ts,
// which covers grouping, rendering and the offline paths.

const RANKINGS_DOM = `<main class="app"></main>`;
const SELF = 'me';

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

function rowsWith(...names: string[]): PlayerRow[] {
  return names.map((n, i) => makeRow({
    device_id: 'dev-' + i, player_name: n, total_xp: 100 - i,
  }));
}

// The rendered row carrying this display name, or undefined when it is hidden.
function rowFor(name: string): HTMLElement | undefined {
  return [...document.querySelectorAll('.leaderboard-row')].find(
    r => r.querySelector('.row-name')!.textContent === name,
  ) as HTMLElement | undefined;
}

function hold(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('mousedown'));
  jest.advanceTimersByTime(rankingsModule.REPORT_HOLD_MS);
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  jest.useFakeTimers();
  document.body.innerHTML = RANKINGS_DOM;
  jest.resetModules();
  require('../src/shared');
  require('../src/namefilter');
  require('../src/blocklist');
  require('../src/supabase');
  rankingsModule = require('../src/rankings');
});

afterEach(() => {
  jest.useRealTimers();
});

// ── The hold gesture ──────────────────────────────────────────────────────────

describe('hold to report', () => {
  it('marks other players reportable and leaves your own row alone', () => {
    rankingsModule.renderRankings([
      makeRow({ device_id: SELF,    player_name: 'Me' }),
      makeRow({ device_id: 'other', player_name: 'Rival' }),
    ], SELF, false);

    expect(rowFor('Me')!.classList.contains('reportable')).toBe(false);
    expect(rowFor('Rival')!.classList.contains('reportable')).toBe(true);
  });

  it('shows the hint, so the mechanism is discoverable', () => {
    rankingsModule.renderRankings(rowsWith('Rival'), SELF, false);
    expect(document.querySelector('.report-hint')).not.toBeNull();
  });

  it('opens the sheet after a sustained mouse hold', () => {
    rankingsModule.renderRankings(rowsWith('Rival'), SELF, false);
    hold(rowFor('Rival')!);

    expect(document.querySelector('.report-sheet')).not.toBeNull();
    expect(document.querySelector('.report-target')!.textContent).toBe('Rival');
  });

  it('opens the sheet after a sustained touch hold', () => {
    rankingsModule.renderRankings(rowsWith('Rival'), SELF, false);
    rowFor('Rival')!.dispatchEvent(new Event('touchstart'));
    jest.advanceTimersByTime(rankingsModule.REPORT_HOLD_MS);

    expect(document.querySelector('.report-sheet')).not.toBeNull();
  });

  it('does nothing when the press is released early', () => {
    rankingsModule.renderRankings(rowsWith('Rival'), SELF, false);
    const row = rowFor('Rival')!;
    row.dispatchEvent(new MouseEvent('mousedown'));
    jest.advanceTimersByTime(rankingsModule.REPORT_HOLD_MS - 50);
    row.dispatchEvent(new MouseEvent('mouseup'));
    jest.advanceTimersByTime(1000);

    expect(document.querySelector('.report-sheet')).toBeNull();
  });

  it('does nothing when the finger moves away mid-hold', () => {
    rankingsModule.renderRankings(rowsWith('Rival'), SELF, false);
    const row = rowFor('Rival')!;
    row.dispatchEvent(new Event('touchstart'));
    jest.advanceTimersByTime(100);
    row.dispatchEvent(new Event('touchmove'));
    jest.advanceTimersByTime(1000);

    expect(document.querySelector('.report-sheet')).toBeNull();
  });

  it('suppresses the native context menu on a reportable row', () => {
    rankingsModule.renderRankings(rowsWith('Rival'), SELF, false);
    const ev = new Event('contextmenu', { cancelable: true });
    rowFor('Rival')!.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
  });

  it('restarts the timer rather than stacking when a hold begins twice', () => {
    rankingsModule.renderRankings(rowsWith('Rival'), SELF, false);
    const row = rowFor('Rival')!;
    row.dispatchEvent(new MouseEvent('mousedown'));
    row.dispatchEvent(new MouseEvent('mousedown'));
    jest.advanceTimersByTime(rankingsModule.REPORT_HOLD_MS);

    expect(document.querySelectorAll('.report-sheet')).toHaveLength(1);
  });
});

// ── The confirmation sheet ────────────────────────────────────────────────────

describe('report sheet', () => {
  it('blocks nothing when cancelled', () => {
    rankingsModule.renderRankings(rowsWith('Rival'), SELF, false);
    hold(rowFor('Rival')!);
    (document.querySelector('.report-cancel') as HTMLElement).click();

    expect(document.querySelector('.report-sheet')).toBeNull();
    expect(rowFor('Rival')).toBeDefined();
  });

  it('closes without blocking when the scrim is clicked', () => {
    rankingsModule.renderRankings(rowsWith('Rival'), SELF, false);
    hold(rowFor('Rival')!);
    (document.querySelector('.report-sheet') as HTMLElement).click();

    expect(document.querySelector('.report-sheet')).toBeNull();
    expect(rowFor('Rival')).toBeDefined();
  });

  it('stays open when the card itself is clicked', () => {
    rankingsModule.renderRankings(rowsWith('Rival'), SELF, false);
    hold(rowFor('Rival')!);
    (document.querySelector('.report-card') as HTMLElement).click();

    expect(document.querySelector('.report-sheet')).not.toBeNull();
  });

  it('renders the reported name as text, never as markup', () => {
    rankingsModule.renderRankings(rowsWith('<img src=x onerror=1>'), SELF, false);
    hold(rowFor('<img src=x onerror=1>')!);

    const target = document.querySelector('.report-target')!;
    expect(target.querySelector('img')).toBeNull();
    expect(target.textContent).toBe('<img src=x onerror=1>');
  });

  it('hides the player and closes on confirm', () => {
    rankingsModule.renderRankings(rowsWith('Rival', 'Ally'), SELF, false);
    hold(rowFor('Rival')!);
    (document.querySelector('.report-confirm') as HTMLElement).click();

    expect(document.querySelector('.report-sheet')).toBeNull();
    expect(rowFor('Rival')).toBeUndefined();
    expect(rowFor('Ally')).toBeDefined();
  });

  it('replaces an open sheet rather than stacking a second', () => {
    rankingsModule.renderRankings(rowsWith('Rival', 'Ally'), SELF, false);
    hold(rowFor('Rival')!);
    hold(rowFor('Ally')!);

    expect(document.querySelectorAll('.report-sheet')).toHaveLength(1);
    expect(document.querySelector('.report-target')!.textContent).toBe('Ally');
  });
});

// ── Filtering ─────────────────────────────────────────────────────────────────

describe('blocked players', () => {
  it('stay hidden on the next render', () => {
    blockName('Rival');
    rankingsModule.renderRankings(rowsWith('Rival', 'Ally'), SELF, false);

    expect(rowFor('Rival')).toBeUndefined();
    expect(rowFor('Ally')).toBeDefined();
  });

  it('stay hidden after re-registering under a leetspeak respelling', () => {
    blockName('Rival');
    rankingsModule.renderRankings(rowsWith('R1v4l'), SELF, false);

    expect(rowFor('R1v4l')).toBeUndefined();
  });

  it('never include your own row, even when your name is blocked', () => {
    blockName('Me');
    rankingsModule.renderRankings([makeRow({ device_id: SELF, player_name: 'Me' })], SELF, false);

    expect(rowFor('Me')).toBeDefined();
  });

  it('produce a distinct empty state when they are the whole board', () => {
    blockName('Rival');
    rankingsModule.renderRankings(rowsWith('Rival'), SELF, false);

    expect(document.querySelector('.empty-state')!.textContent)
      .toBe('Every Saint here is hidden.');
  });

  it('leave the original empty state alone when the board is genuinely empty', () => {
    rankingsModule.renderRankings([], SELF, false);

    expect(document.querySelector('.empty-state')!.textContent)
      .toBe('No players yet. Be the first!');
  });

  it('are still filtered on the offline render path', () => {
    blockName('Rival');
    rankingsModule.renderRankings(rowsWith('Rival', 'Ally'), SELF, true);

    expect(document.querySelector('.offline-badge')).not.toBeNull();
    expect(rowFor('Rival')).toBeUndefined();
    expect(rowFor('Ally')).toBeDefined();
  });
});

// ── The hidden-players footer ─────────────────────────────────────────────────

describe('blocked footer', () => {
  it('is empty while nothing is blocked', () => {
    rankingsModule.renderRankings(rowsWith('Ally'), SELF, false);

    expect(document.querySelector('.blocked-count')).toBeNull();
    expect(document.querySelector('.blocked-reset')).toBeNull();
  });

  it('counts one hidden Saint in the singular', () => {
    blockName('Rival');
    rankingsModule.renderRankings(rowsWith('Ally'), SELF, false);

    expect(document.querySelector('.blocked-count')!.textContent).toBe('1 Saint hidden');
  });

  it('counts several in the plural', () => {
    blockName('Rival');
    blockName('Other');
    rankingsModule.renderRankings(rowsWith('Ally'), SELF, false);

    expect(document.querySelector('.blocked-count')!.textContent).toBe('2 Saints hidden');
  });

  it('appears even when no blocked player is currently on the board', () => {
    blockName('Absent');
    rankingsModule.renderRankings(rowsWith('Ally'), SELF, false);

    expect(document.querySelector('.blocked-count')).not.toBeNull();
  });

  it('appears on the all-hidden empty state, so a block is always reversible', () => {
    blockName('Rival');
    rankingsModule.renderRankings(rowsWith('Rival'), SELF, false);

    expect(document.querySelector('.blocked-reset')).not.toBeNull();
  });

  it('restores every hidden player when reset is clicked', () => {
    blockName('Rival');
    rankingsModule.renderRankings(rowsWith('Rival'), SELF, false);
    expect(document.querySelector('.leaderboard-row')).toBeNull();

    (document.querySelector('.blocked-reset') as HTMLElement).click();

    expect(rowFor('Rival')).toBeDefined();
    expect(document.querySelector('.blocked-count')).toBeNull();
  });

  it('updates immediately after a report, without a page reload', () => {
    rankingsModule.renderRankings(rowsWith('Rival', 'Ally'), SELF, false);
    hold(rowFor('Rival')!);
    (document.querySelector('.report-confirm') as HTMLElement).click();

    expect(document.querySelector('.blocked-count')!.textContent).toBe('1 Saint hidden');
  });
});
