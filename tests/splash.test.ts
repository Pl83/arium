// splash.ts arms a failsafe timer and stamps its open time at require() time,
// so every test builds the DOM FIRST and requires the module after.

import { readFileSync } from 'fs';
import { join } from 'path';

const SPLASH_DOM = `<div id="splash"><div class="splash-stage"></div></div>`;

let splashModule: any;

function loadSplash(dom: string): void {
  document.body.innerHTML = dom;
  jest.resetModules();
  splashModule = require('../src/splash');
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ── hideSplash ────────────────────────────────────────────────────────────────

describe('hideSplash', () => {
  it('holds the sigil for the minimum duration before fading', () => {
    loadSplash(SPLASH_DOM);
    splashModule.hideSplash();

    // Called at 0ms elapsed: the fade must not have started yet.
    jest.advanceTimersByTime(splashModule.SPLASH_MIN_MS - 1);
    expect(document.getElementById('splash')!.classList.contains('splash-out')).toBe(false);

    jest.advanceTimersByTime(1);
    expect(document.getElementById('splash')!.classList.contains('splash-out')).toBe(true);
  });

  it('removes the element from the DOM once the fade completes', () => {
    loadSplash(SPLASH_DOM);
    splashModule.hideSplash();

    jest.advanceTimersByTime(splashModule.SPLASH_MIN_MS + splashModule.SPLASH_FADE_MS - 1);
    expect(document.getElementById('splash')).not.toBeNull();

    jest.advanceTimersByTime(1);
    expect(document.getElementById('splash')).toBeNull();
  });

  it('fades immediately when the boot already outlasted the minimum', () => {
    loadSplash(SPLASH_DOM);

    // A slow boot: by the time the app is ready the minimum has long passed.
    jest.advanceTimersByTime(3000);
    splashModule.hideSplash();

    expect(document.getElementById('splash')!.classList.contains('splash-out')).toBe(true);
  });

  it('is idempotent — repeated calls do not stack removals or throw', () => {
    loadSplash(SPLASH_DOM);

    splashModule.hideSplash();
    splashModule.hideSplash();
    jest.advanceTimersByTime(splashModule.SPLASH_MIN_MS + splashModule.SPLASH_FADE_MS);
    expect(document.getElementById('splash')).toBeNull();

    // Called again after the element is gone — must be a silent no-op.
    expect(() => splashModule.hideSplash()).not.toThrow();
    jest.advanceTimersByTime(5000);
  });

  it('survives the splash being torn out while the fade is pending', () => {
    loadSplash(SPLASH_DOM);
    splashModule.hideSplash();

    // A navigation, or any code that wipes document.body, between the call and
    // the scheduled removal.
    document.getElementById('splash')!.remove();

    expect(() => jest.advanceTimersByTime(5000)).not.toThrow();
  });

  it('drops pointer-events with the fade so taps reach the app at once', () => {
    loadSplash(SPLASH_DOM);
    splashModule.hideSplash();
    jest.advanceTimersByTime(splashModule.SPLASH_MIN_MS);

    // The class carries both; asserting it is what the stylesheet keys off.
    expect(document.getElementById('splash')!.className).toContain('splash-out');
  });
});

// ── The failsafe ──────────────────────────────────────────────────────────────

describe('failsafe', () => {
  it('lifts the sigil even if the boot chain never reports ready', () => {
    loadSplash(SPLASH_DOM);

    // hideSplash is deliberately never called — this is the DB-never-opens case.
    jest.advanceTimersByTime(splashModule.SPLASH_FAILSAFE_MS + splashModule.SPLASH_FADE_MS);
    expect(document.getElementById('splash')).toBeNull();
  });

  it('does not fire before its deadline', () => {
    loadSplash(SPLASH_DOM);

    jest.advanceTimersByTime(splashModule.SPLASH_FAILSAFE_MS - 1);
    expect(document.getElementById('splash')).not.toBeNull();
    expect(document.getElementById('splash')!.classList.contains('splash-out')).toBe(false);
  });

  it('stays quiet on pages that have no splash', () => {
    // rankings.html loads splash.js only for sigilLoaderMarkup.
    loadSplash(`<main class="app"></main>`);

    expect(() => jest.advanceTimersByTime(10000)).not.toThrow();
    expect(document.querySelector('.app')).not.toBeNull();
  });
});

// ── sigilLoaderMarkup ─────────────────────────────────────────────────────────

describe('sigilLoaderMarkup', () => {
  beforeEach(() => { loadSplash(`<main class="app"></main>`); });

  it('carries the caller-supplied label', () => {
    const html = splashModule.sigilLoaderMarkup('Consulting the standings…');
    expect(html).toContain('Consulting the standings…');
  });

  it('exposes the hooks the stylesheet animates', () => {
    const html = splashModule.sigilLoaderMarkup('Loading');
    ['sigil-loader', 'ring rim', 'ring wheel', 'ring star', 'cosmo'].forEach(hook => {
      expect(html).toContain(hook);
    });
  });

  it('announces itself to screen readers', () => {
    const html = splashModule.sigilLoaderMarkup('Loading');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('parses into a single element that the renderer can replace', () => {
    const host = document.querySelector('.app') as HTMLElement;
    host.innerHTML = splashModule.sigilLoaderMarkup('Loading');

    expect(host.children).toHaveLength(1);
    expect(host.querySelector('.sigil-loader-label')!.textContent).toBe('Loading');
    expect(host.querySelector('svg')).not.toBeNull();
  });

  // The loader is injected into pages that inline no <defs> of their own, so it
  // has to carry the whole zodiac with it. A <use> pointing at nothing renders
  // nothing and throws nothing — exactly the silence this suite exists to break.
  it('carries all twelve glyphs and resolves every reference', () => {
    const host = document.querySelector('.app') as HTMLElement;
    host.innerHTML = splashModule.sigilLoaderMarkup('Loading');

    const uses = Array.from(host.querySelectorAll('use'));
    expect(uses).toHaveLength(12);

    uses.forEach(use => {
      const id = use.getAttribute('href')!.replace('#', '');
      expect(host.querySelector('[id="' + id + '"]')).not.toBeNull();
    });
  });

  it('places one slot per house, keyed the way houses.ts stamps them', () => {
    const host = document.querySelector('.app') as HTMLElement;
    host.innerHTML = splashModule.sigilLoaderMarkup('Loading');

    const houses = require('../src/houses').HOUSES.map((h: { id: string }) => h.id);
    const slots = Array.from(host.querySelectorAll('.house-slot'))
      .map(el => el.getAttribute('data-house'));

    expect(slots.sort()).toEqual([...houses].sort());
  });

  // Placement must stay an attribute on .house-slot: a CSS transform replaces
  // an SVG one rather than composing, so emphasising a glyph that carried its
  // own placement would collapse all twelve onto the origin.
  it('keeps placement off the element the stylesheet scales', () => {
    const host = document.querySelector('.app') as HTMLElement;
    host.innerHTML = splashModule.sigilLoaderMarkup('Loading');

    host.querySelectorAll('.house-slot').forEach(slot => {
      expect(slot.getAttribute('transform')).toMatch(/^translate\(/);
      expect(slot.querySelector('.house-emph')!.getAttribute('transform')).toBeNull();
    });
  });
});

// ── The house badge ───────────────────────────────────────────────────────────

describe('houseGlyphSvg', () => {
  beforeEach(() => { loadSplash(''); });

  it('draws every path the glyph is made of', () => {
    const svg = splashModule.houseGlyphSvg('aries');
    expect(svg).not.toBeNull();
    expect(svg.querySelectorAll('path')).toHaveLength(
      splashModule.ZODIAC_GLYPH_PATHS.aries.length,
    );
  });

  it('carries the class the stylesheets size it by', () => {
    expect(splashModule.houseGlyphSvg('leo').getAttribute('class')).toBe('house-badge');
  });

  // The badge must not need a colour of its own — it inherits whatever palette
  // theme.ts stamped on <html>, exactly as the sigil does.
  it('strokes in currentColor and fills nothing', () => {
    const svg = splashModule.houseGlyphSvg('leo');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('fill')).toBe('none');
  });

  it('announces itself when given a label', () => {
    const svg = splashModule.houseGlyphSvg('virgo', 'House of Virgo');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('House of Virgo');
    expect(svg.hasAttribute('aria-hidden')).toBe(false);
  });

  it('stays out of the accessibility tree without one', () => {
    const svg = splashModule.houseGlyphSvg('virgo');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.hasAttribute('role')).toBe(false);
  });

  it('returns null for an unknown house rather than an empty box', () => {
    expect(splashModule.houseGlyphSvg('ophiuchus')).toBeNull();
  });

  // A leaderboard row written by a build from before the column existed carries
  // null; a cached row from before that carries nothing at all.
  it('returns null for null and undefined', () => {
    expect(splashModule.houseGlyphSvg(null)).toBeNull();
    expect(splashModule.houseGlyphSvg(undefined)).toBeNull();
  });

  // The id can arrive from another player's row, so the lookup must not walk
  // the prototype: 'constructor' resolves to a function on any plain object and
  // would reach the path loop.
  it('returns null for an inherited key', () => {
    expect(splashModule.houseGlyphSvg('constructor')).toBeNull();
    expect(splashModule.houseGlyphSvg('toString')).toBeNull();
  });
});

describe('renderNameHouse', () => {
  function load(dom: string): void {
    document.body.innerHTML = dom;
    jest.resetModules();
    require('../src/houses');
    splashModule = require('../src/splash');
  }

  beforeEach(() => { localStorage.clear(); });

  it('paints the held house beside the name', () => {
    localStorage.setItem('house', 'scorpio');
    load('<span id="nameHouse"></span>');
    splashModule.renderNameHouse();

    const badge = document.querySelector('#nameHouse .house-badge');
    expect(badge).not.toBeNull();
    expect(badge!.getAttribute('aria-label')).toBe('House of Scorpio');
  });

  it('leaves the host empty when no house is held', () => {
    load('<span id="nameHouse"></span>');
    splashModule.renderNameHouse();
    expect(document.getElementById('nameHouse')!.innerHTML).toBe('');
  });

  // The profile's house picker calls this again after every change. Without the
  // reset the glyphs would stack, which is the whole reason the host is cleared.
  it('replaces the badge rather than appending a second', () => {
    localStorage.setItem('house', 'aries');
    load('<span id="nameHouse"></span>');
    splashModule.renderNameHouse();

    localStorage.setItem('house', 'pisces');
    splashModule.renderNameHouse();

    const badges = document.querySelectorAll('#nameHouse .house-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0].getAttribute('aria-label')).toBe('House of Pisces');
  });

  // A stored id removed in some future version must leave no badge at all.
  it('draws nothing for a stored house that is no longer known', () => {
    localStorage.setItem('house', 'ophiuchus');
    load('<span id="nameHouse"></span>');
    splashModule.renderNameHouse();
    expect(document.getElementById('nameHouse')!.innerHTML).toBe('');
  });

  it('does nothing on a page with no host', () => {
    localStorage.setItem('house', 'leo');
    load('<div></div>');
    expect(() => splashModule.renderNameHouse()).not.toThrow();
  });
});

// ── One zodiac, three copies ──────────────────────────────────────────────────

/**
 * The glyph paths exist in three dialects that no build step reconciles. If
 * they drift, the app draws two different zodiacs and nothing fails loudly.
 */
describe('glyph sources agree', () => {

  const androidVector = readFileSync(
    join(__dirname, '..', 'res', 'android', 'splash', 'ic_splash_sigil.xml'), 'utf8'
  );

  const glyphs: { [id: string]: string[] } = require('../src/splash').ZODIAC_GLYPH_PATHS;

  it('covers every house that houses.ts knows', () => {
    const houses = require('../src/houses').HOUSES.map((h: { id: string }) => h.id);
    expect(Object.keys(glyphs).sort()).toEqual([...houses].sort());
  });

  // index.html paints before any script runs, so it cannot import the constant
  // above — it inlines its own copy. Compare them path for path.
  it('matches the copy inlined in index.html', () => {
    Object.keys(glyphs).forEach(id => {
      const block = new RegExp('id="zg-' + id + '"[\\s\\S]*?</g>').exec(indexHtml);
      expect(block).not.toBeNull();

      glyphs[id].forEach(d => expect(block![0]).toContain('d="' + d + '"'));
    });
  });

  it('matches the copy hand-ported into the Android VectorDrawable', () => {
    Object.keys(glyphs).forEach(id => {
      glyphs[id].forEach(d => {
        expect(androidVector).toContain('android:pathData="' + d + '"');
      });
    });
  });

  // VectorDrawable has no circle primitive. Keeping every glyph as pure path
  // data is what lets the three copies stay literally identical.
  it('uses arcs rather than circles, so one form serves all three', () => {
    Object.values(glyphs).flat().forEach(d => {
      expect(d).toMatch(/^M/);
      // 'A' is the arc command a former <circle> becomes; 'C'/'L'/'V'/'H' are
      // the rest of the vocabulary VectorDrawable shares with SVG.
      expect(d).toMatch(/^[MACLVHZ0-9\s.,-]+$/);
    });
  });

  it('leaves no <circle> in the loader glyph defs', () => {
    const defs = /<defs>[\s\S]*?<\/defs>/.exec(
      require('../src/splash').sigilLoaderMarkup('x')
    )![0];
    expect(defs).not.toContain('<circle');
  });
});

// ── The unchosen glyphs ───────────────────────────────────────────────────────

/**
 * Choosing a house dims the other eleven glyphs. Dimming happens twice over —
 * `.house-ring` carries opacity .9 in the markup and `[data-house] .house-slot`
 * multiplies its own on top — and a value that reads well on Sanctuary Dark's
 * near-black can push the ring under the parchment in Marble, where the gold is
 * already much closer to the ground.
 *
 * That is exactly how the ring went missing: a literal 0.28 left the unchosen
 * glyphs at 1.27:1 against Marble. jsdom will not composite SVG for us, so the
 * check is done in arithmetic against the same tokens the browser reads.
 */

const CSS_DIR = join(__dirname, '..', 'www', 'css');
const themeCss  = readFileSync(join(CSS_DIR, 'theme.css'), 'utf8');
const splashCss = readFileSync(join(CSS_DIR, 'splash.css'), 'utf8');
const indexHtml = readFileSync(join(__dirname, '..', 'www', 'index.html'), 'utf8');

// The literal declaration, never the `var(--lt-*)` redirection in a mapping block.
function token(name: string): string {
  const hit = new RegExp('\\n\\s*' + name + ':\\s*([^;]+);').exec(themeCss);
  if (!hit) throw new Error('theme.css declares no ' + name);
  return hit[1].trim();
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

// WCAG relative luminance.
function luminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

// What the eye actually receives: a translucent stroke composited on the ground.
function contrastWhenDimmed(inkHex: string, groundHex: string, alpha: number): number {
  const ink = rgb(inkHex);
  const ground = rgb(groundHex);
  const blended = ground.map((c, i) => c + (ink[i] - c) * alpha) as [number, number, number];

  const a = luminance(blended);
  const b = luminance(ground);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Below this a 1.5-unit hairline stops being a glyph and becomes a smudge.
const MIN_GLYPH_CONTRAST = 2.0;

describe('unchosen house glyphs', () => {
  // <g class="house-ring" opacity=".9"> — the first multiplier.
  const ringOpacity = parseFloat(
    /class="house-ring"[^>]*opacity="([\d.]+)"/.exec(indexHtml)![1]
  );

  // opacity on `[data-house] .house-slot` — the second.
  const slotDecl = /\[data-house\]\s+\.house-slot\s*\{[^}]*opacity:\s*([^;]+);/.exec(splashCss)![1].trim();

  function slotOpacity(theme: 'dark' | 'light'): number {
    const varName = /var\(\s*(--[\w-]+)\s*\)/.exec(slotDecl);
    if (!varName) return parseFloat(slotDecl);
    // Marble redirects the token at --lt-<name>; dark reads the base declaration.
    const name = theme === 'light' ? varName[1].replace('--', '--lt-') : varName[1];
    return parseFloat(token(name));
  }

  it('stay legible on Sanctuary Dark', () => {
    const alpha = ringOpacity * slotOpacity('dark');
    expect(contrastWhenDimmed(token('--gold'), token('--bg'), alpha))
      .toBeGreaterThanOrEqual(MIN_GLYPH_CONTRAST);
  });

  // The regression this suite exists for: Marble's gold sits far closer to its
  // ground than Sanctuary Dark's does, so a dim tuned on dark disappears here.
  it('stay legible on Marble', () => {
    const alpha = ringOpacity * slotOpacity('light');
    expect(contrastWhenDimmed(token('--lt-gold'), token('--lt-bg'), alpha))
      .toBeGreaterThanOrEqual(MIN_GLYPH_CONTRAST);
  });

  it('stay clearly subordinate to the chosen house', () => {
    (['dark', 'light'] as const).forEach(theme => {
      expect(slotOpacity(theme)).toBeLessThan(1);
    });
  });
});
