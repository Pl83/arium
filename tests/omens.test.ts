// omens.ts touches localStorage and builds its own toast container on
// document.body, so every test starts from a clean body and a clean store.

let omens: any;

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  jest.useFakeTimers();
  jest.resetModules();
  omens = require('../src/omens');
});

afterEach(() => {
  jest.useRealTimers();
});

function raise(kind = 'levelup', title = 'Level Reached', body = 'Level 2.'): any {
  return omens.raiseOmen({ kind, title, body });
}

// ── The log ───────────────────────────────────────────────────────────────────

describe('the log', () => {
  it('starts empty', () => {
    expect(omens.readOmens()).toEqual([]);
  });

  it('records what was raised', () => {
    raise('ascension', 'Ascension', 'D-Rank · Bronze Saint.');
    const log = omens.readOmens();
    expect(log).toHaveLength(1);
    expect(log[0].k).toBe('ascension');
    expect(log[0].t).toBe('Ascension');
    expect(log[0].b).toBe('D-Rank · Bronze Saint.');
    expect(typeof log[0].ts).toBe('number');
  });

  it('keeps entries oldest-first in storage', () => {
    raise('levelup', 'First');
    raise('rebuke', 'Second');
    expect(omens.readOmens().map((o: any) => o.t)).toEqual(['First', 'Second']);
  });

  it('caps at OMEN_LOG_MAX and drops the oldest', () => {
    for (let i = 0; i < omens.OMEN_LOG_MAX + 10; i++) {
      raise('levelup', 'omen-' + i);
    }
    const log = omens.readOmens();
    expect(log).toHaveLength(omens.OMEN_LOG_MAX);
    // The first ten are gone; the newest survived.
    expect(log[0].t).toBe('omen-10');
    expect(log[log.length - 1].t).toBe('omen-' + (omens.OMEN_LOG_MAX + 9));
  });

  // A notification history is never worth taking the page down for.
  it('degrades to empty on corrupt storage instead of throwing', () => {
    localStorage.setItem('omens', '{not json');
    expect(() => omens.readOmens()).not.toThrow();
    expect(omens.readOmens()).toEqual([]);
  });

  it('degrades to empty when storage holds a non-array', () => {
    localStorage.setItem('omens', '{"k":"levelup"}');
    expect(omens.readOmens()).toEqual([]);
  });

  it('recovers by overwriting corrupt storage on the next raise', () => {
    localStorage.setItem('omens', 'garbage');
    raise();
    expect(omens.readOmens()).toHaveLength(1);
  });
});

// ── Toasts ────────────────────────────────────────────────────────────────────

describe('toasts', () => {
  it('creates the stack on demand, so no page needs markup for it', () => {
    expect(document.getElementById('omen-stack')).toBeNull();
    raise();
    expect(document.getElementById('omen-stack')).not.toBeNull();
  });

  it('reuses the stack rather than creating a second one', () => {
    raise();
    raise();
    expect(document.querySelectorAll('#omen-stack')).toHaveLength(1);
    expect(document.querySelectorAll('.omen-toast')).toHaveLength(2);
  });

  it('carries the kind as a class so the stylesheet can accent it', () => {
    raise('rebuke', 'Rebuke', 'Missed.');
    expect(document.querySelector('.omen-toast')!.className)
      .toContain('omen-rebuke');
  });

  it('shows the title and body as text, never as markup', () => {
    raise('levelup', 'Level Reached', '<b>Level 2</b>');
    expect(document.querySelector('.omen-body')!.textContent).toBe('<b>Level 2</b>');
    expect(document.querySelector('.omen-body b')).toBeNull();
  });

  it('dwells its full duration then removes itself from the DOM', () => {
    raise('levelup');
    const dwell = omens.OMEN_DWELL_MS.levelup;

    jest.advanceTimersByTime(dwell - 1);
    expect(document.querySelector('.omen-toast')).not.toBeNull();

    jest.advanceTimersByTime(1);
    expect(document.querySelector('.omen-toast')!.className).toContain('omen-out');

    // Removed, not merely faded — an invisible node left on top of the app
    // would still be there swallowing nothing forever.
    jest.advanceTimersByTime(omens.OMEN_FADE_MS);
    expect(document.querySelector('.omen-toast')).toBeNull();
  });

  it('holds an Ascension longer than the rest', () => {
    expect(omens.OMEN_DWELL_MS.ascension).toBeGreaterThan(omens.OMEN_DWELL_MS.levelup);
  });

  // This is the bug the old shared-modal design had: two events on one launch
  // and only one of them survived.
  it('lets two omens raised together both survive their full dwell', () => {
    raise('levelup', 'Level Reached', 'Level 5.');
    raise('ascension', 'Ascension', 'D-Rank.');

    expect(document.querySelectorAll('.omen-toast')).toHaveLength(2);

    jest.advanceTimersByTime(omens.OMEN_DWELL_MS.levelup + omens.OMEN_FADE_MS);
    // The level-up has gone; the longer-dwelling Ascension has not.
    const left = document.querySelectorAll('.omen-toast');
    expect(left).toHaveLength(1);
    expect(left[0].className).toContain('omen-ascension');
  });

  it('dismisses early on tap', () => {
    raise();
    (document.querySelector('.omen-toast') as HTMLElement).click();
    jest.advanceTimersByTime(omens.OMEN_FADE_MS);
    expect(document.querySelector('.omen-toast')).toBeNull();
  });

  it('a tap does not disturb its neighbour', () => {
    raise('levelup', 'First');
    raise('rebuke', 'Second');

    (document.querySelector('.omen-rebuke') as HTMLElement).click();
    jest.advanceTimersByTime(omens.OMEN_FADE_MS);

    const left = document.querySelectorAll('.omen-toast');
    expect(left).toHaveLength(1);
    expect(left[0].className).toContain('omen-levelup');
  });

  // Both paths to removal must not run the teardown twice.
  it('survives a tap followed by its dwell expiring', () => {
    raise();
    const toast = document.querySelector('.omen-toast') as HTMLElement;
    toast.click();
    expect(() => jest.advanceTimersByTime(60000)).not.toThrow();
    expect(document.querySelector('.omen-toast')).toBeNull();
  });
});

// ── Relative time ─────────────────────────────────────────────────────────────

describe('omenAgo', () => {
  const now = 1_700_000_000_000;
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it('reads "just now" under a minute', () => {
    expect(omens.omenAgo(now - 59 * 1000, now)).toBe('just now');
  });

  it('switches to minutes at one minute', () => {
    expect(omens.omenAgo(now - MIN, now)).toBe('1m ago');
  });

  it('switches to hours at one hour', () => {
    expect(omens.omenAgo(now - 59 * MIN, now)).toBe('59m ago');
    expect(omens.omenAgo(now - HOUR, now)).toBe('1h ago');
  });

  it('switches to days at 24 hours', () => {
    expect(omens.omenAgo(now - 23 * HOUR, now)).toBe('23h ago');
    expect(omens.omenAgo(now - DAY, now)).toBe('1d ago');
  });

  // Clock skew between devices, or a timestamp written a moment in the future,
  // must not produce "-1m ago".
  it('clamps a future timestamp to "just now"', () => {
    expect(omens.omenAgo(now + 5000, now)).toBe('just now');
  });
});

// ── The log, rendered ─────────────────────────────────────────────────────────

describe('renderOmenLog', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('states the empty case rather than rendering nothing', () => {
    omens.renderOmenLog(host, Date.now());
    expect(host.querySelector('.omen-empty')!.textContent).toBe('No omens yet.');
  });

  it('renders one row per entry', () => {
    raise('levelup', 'A');
    raise('rebuke', 'B');
    omens.renderOmenLog(host, Date.now());
    expect(host.querySelectorAll('.omen-row')).toHaveLength(2);
  });

  // Storage is oldest-first; the reader wants the opposite.
  it('renders newest first', () => {
    raise('levelup', 'Older');
    raise('rebuke', 'Newer');
    omens.renderOmenLog(host, Date.now());

    const titles = Array.from(host.querySelectorAll('.omen-title'))
      .map(el => el.textContent);
    expect(titles).toEqual(['Newer', 'Older']);
  });

  it('does not mutate the stored order while reversing', () => {
    raise('levelup', 'Older');
    raise('rebuke', 'Newer');
    omens.renderOmenLog(host, Date.now());
    expect(omens.readOmens().map((o: any) => o.t)).toEqual(['Older', 'Newer']);
  });

  it('shows how long ago each omen was raised', () => {
    raise('levelup', 'A');
    const later = omens.readOmens()[0].ts + 3 * 60 * 60 * 1000;
    omens.renderOmenLog(host, later);
    expect(host.querySelector('.omen-when')!.textContent).toBe('3h ago');
  });

  it('replaces previous content rather than appending to it', () => {
    raise('levelup', 'A');
    omens.renderOmenLog(host, Date.now());
    omens.renderOmenLog(host, Date.now());
    expect(host.querySelectorAll('.omen-row')).toHaveLength(1);
  });

  it('renders bodies as text, never as markup', () => {
    raise('levelup', 'A', '<img src=x>');
    omens.renderOmenLog(host, Date.now());
    expect(host.querySelector('.omen-body')!.textContent).toBe('<img src=x>');
    expect(host.querySelector('.omen-body img')).toBeNull();
  });
});
