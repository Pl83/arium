/**
 * splash.ts — Zodiac sigil loader
 *
 * Three consumers, one visual language:
 *   #splash        the full-screen opening. Its markup is inlined directly in
 *                  index.html so it paints on the first frame, before cordova.js
 *                  or any other script has loaded. This file only takes it DOWN.
 *   .sigil-loader  the compact waiting state, built here as markup and injected
 *                  by rankings.ts while the leaderboard is in flight.
 *   .house-badge   the zodiac mark shown beside a player's name on all three
 *                  pages. This is why profile.html loads this file despite
 *                  having no splash of its own.
 *
 * Colour is NOT set here. Every stroke is `currentColor`, and splash.css points
 * that at `var(--gold)`, so the sigil follows whichever palette theme.ts stamped
 * on <html> before first paint.
 *
 * Loaded at the END of <body>, not <head>: the splash element must already be
 * parsed when this runs, and nothing here is needed to display it.
 */

// Below this the splash reads as a flicker rather than a deliberate opening —
// a warm start would otherwise flash the sigil for 80ms and vanish.
const SPLASH_MIN_MS = 700;

// Nothing may trap the user behind the sigil. If the boot chain never reports
// ready — a failed DB open, a plugin that never fires — the splash lifts anyway
// and the user meets whatever the page managed to render.
const SPLASH_FAILSAFE_MS = 4000;

// Must match the transition duration on .splash-out in splash.css.
const SPLASH_FADE_MS = 400;

const splashOpenedAt = Date.now();
let splashDismissed = false;

function removeSplash(): void {
  const el = document.getElementById('splash');
  if (!el) return;
  // The class starts the fade AND drops pointer-events, so taps reach the app
  // immediately rather than waiting out the animation.
  el.classList.add('splash-out');
  setTimeout(() => el.remove(), SPLASH_FADE_MS);
}

// Safe to call more than once, and safe to call from a path that races the
// failsafe — the first caller wins and the rest are no-ops.
function hideSplash(): void {
  if (splashDismissed) return;
  splashDismissed = true;

  const remaining = SPLASH_MIN_MS - (Date.now() - splashOpenedAt);
  if (remaining <= 0) {
    removeSplash();
  } else {
    setTimeout(removeSplash, remaining);
  }
}

/**
 * The twelve glyphs, as pure path data in a 24×24 box centred on (12,12).
 *
 * ONE OF FOUR COPIES, and the duplication is structural rather than laziness:
 *   www/index.html                      inline <defs>, because the opening must
 *                                       paint before any script has run.
 *   www/profile.html                    inline <defs> for the house picker.
 *   here                                a string builder, for pages that carry
 *                                       no <defs> of their own (rankings.html).
 *   res/android/splash/ic_splash_sigil  a different XML dialect entirely.
 * Change a glyph in one and change it in all four, or the app draws two
 * different zodiacs. The `id` keys are the same contract houses.ts documents.
 * tests/splash.test.ts and tests/houses.test.ts between them check every pair.
 *
 * Circles are written as two semicircular arcs rather than <circle> so this
 * data ports VERBATIM to the Android VectorDrawable, which has no circle
 * primitive. Do not "simplify" them back.
 */
const ZODIAC_GLYPH_PATHS: { [id: string]: string[] } = {
  aries: [
    'M12 10V20.5',
    'M12 10C12 5.5 9.5 3.5 7 3.5C4.5 3.5 3 5.8 3.5 9',
    'M12 10C12 5.5 14.5 3.5 17 3.5C19.5 3.5 21 5.8 20.5 9',
  ],
  taurus: [
    'M6.8 15.5A5.2 5.2 0 0 1 17.2 15.5A5.2 5.2 0 0 1 6.8 15.5Z',
    'M6.2 10.5A6 6 0 0 1 17.8 10.5',
  ],
  gemini: [
    'M8 5.5V18.5M16 5.5V18.5',
    'M4.8 4.6C8 3 16 3 19.2 4.6',
    'M4.8 19.4C8 21 16 21 19.2 19.4',
  ],
  cancer: [
    'M4.8 10.2C8 5.8 16.4 5.8 19.4 9.4',
    'M17.4 11.2A2.2 2.2 0 0 1 21.8 11.2A2.2 2.2 0 0 1 17.4 11.2Z',
    'M19.2 13.8C16 18.2 7.6 18.2 4.6 14.6',
    'M2.2 12.8A2.2 2.2 0 0 1 6.6 12.8A2.2 2.2 0 0 1 2.2 12.8Z',
  ],
  leo: [
    'M4.3 16.4A4.2 4.2 0 0 1 12.7 16.4A4.2 4.2 0 0 1 4.3 16.4Z',
    'M12.2 14.4C13.4 10.6 10.6 7.4 12.6 5C14.6 2.6 18.4 4 18.6 7.2C18.8 10 17 11.6 17 14C17 16.4 18.2 18.2 20 19',
  ],
  virgo: [
    'M4 5.5V17.5',
    'M4 7.4C4.6 5.4 7 5 7.8 7C8.2 8 8.2 9 8.2 10V17.5',
    'M8.2 7.4C8.8 5.4 11.2 5 12 7C12.4 8 12.4 9 12.4 10V16.5',
    'M12.4 9.6C13.6 6.6 16.6 5.8 18.2 7.8C20 10 18.6 14.6 15 17.2C13.6 18.2 12.4 19 11.6 20.4',
    'M9 15.6C10.6 19 14.4 20.6 17.6 19.4',
  ],
  libra: [
    'M3.5 19H20.5',
    'M3.5 13.6H8.4M15.6 13.6H20.5',
    'M8.4 13.6A3.8 3.8 0 0 1 15.6 13.6',
  ],
  scorpio: [
    'M4 5.5V17.5',
    'M4 7.4C4.6 5.4 7 5 7.8 7C8.2 8 8.2 9 8.2 10V17.5',
    'M8.2 7.4C8.8 5.4 11.2 5 12 7C12.4 8 12.4 9 12.4 10V18.6L19.5 11.5',
    'M14.8 11.5H19.6V16.3',
  ],
  sagittarius: [
    'M4.5 19.5L19.4 5',
    'M12.4 4.6H19.9V12.1',
    'M8.2 9.6L14.4 15.8',
  ],
  capricorn: [
    'M4 6V18',
    'M4 8C4.6 6 7 5.6 7.8 7.6L11.8 15.6',
    'M11.8 15.6C12.6 11.4 15 9.2 17.2 10.4C19.6 11.8 19.4 16.4 16.4 17.8C14.6 18.6 13 17.6 13.2 16',
  ],
  aquarius: [
    'M3.5 10.6L7 7.4L10.5 10.6L14 7.4L17.5 10.6L21 7.4',
    'M3.5 17.4L7 14.2L10.5 17.4L14 14.2L17.5 17.4L21 14.2',
  ],
  pisces: [
    'M7.4 3.6C4 7.6 4 16.4 7.4 20.4',
    'M16.6 3.6C20 7.6 20 16.4 16.6 20.4',
    'M4.6 12H19.4',
  ],
};

/**
 * The house badge worn beside a player's name — the home header, the profile
 * card, and every leaderboard row.
 *
 * Draws the paths INLINE rather than <use>-ing the `zg-` defs, because
 * rankings.html carries no defs of its own and a fourth inline copy of the
 * library is exactly what the comment above asks us not to create. One builder
 * therefore serves all three pages.
 *
 * Returns null for a missing or unknown id, so a caller may hand it a raw value
 * straight out of localStorage or off another player's leaderboard row without
 * checking it first. hasOwnProperty, not a truthiness test: `constructor` is a
 * key on every object and would otherwise reach the forEach as a function.
 *
 * `label` is caller-supplied copy, never user input. Given one the badge
 * announces itself; without one it is decoration and stays out of the
 * accessibility tree.
 */
function houseGlyphSvg(id: string | null | undefined, label?: string): SVGElement | null {
  if (typeof id !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(ZODIAC_GLYPH_PATHS, id)) return null;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'house-badge');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  // Heavier than the opening's 1.5 for the reason the loader is heavier: this
  // is the same 24-unit box drawn at badge size, where a hairline vanishes.
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  if (label === undefined) {
    svg.setAttribute('aria-hidden', 'true');
  } else {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  }

  ZODIAC_GLYPH_PATHS[id].forEach(d => {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  });

  return svg;
}

/**
 * Paints the badge into the page's #nameHouse host — the one shared by
 * index.html and profile.html.
 *
 * Emptied first: the profile's house picker calls this again after every
 * change, and a second glyph appended beside the first is what a missing reset
 * would look like. A page without the host does nothing, which is what keeps
 * the older test fixtures working.
 *
 * Reaches into houses.ts for the stored id. Both pages load houses.js before
 * this file, and nothing here runs at load time, so the ordering holds.
 */
function renderNameHouse(): void {
  const host = document.getElementById('nameHouse');
  if (!host) return;

  host.innerHTML = '';
  const id = getHouse();
  if (id === null) return;

  const badge = houseGlyphSvg(id, 'House of ' + houseName(id));
  if (badge) host.appendChild(badge);
}

/**
 * Where each glyph sits: clockwise from Aries at the top, on a circle of
 * radius 158 about (200,200). Identical to the placement in index.html, so the
 * loader reads as the opening seen from further away rather than as a second
 * design.
 */
const HOUSE_SLOTS: Array<[string, number, number]> = [
  ['aries',       200,    42   ],
  ['taurus',      279,    63.2 ],
  ['gemini',      336.8, 121   ],
  ['cancer',      358,   200   ],
  ['leo',         336.8, 279   ],
  ['virgo',       279,   336.8 ],
  ['libra',       200,   358   ],
  ['scorpio',     121,   336.8 ],
  ['sagittarius',  63.2, 279   ],
  ['capricorn',    42,   200   ],
  ['aquarius',     63.2, 121   ],
  ['pisces',      121,    63.2 ],
];

// Own prefix, not index.html's `zg-`. Should this loader ever be injected into
// a page that already inlines the opening, colliding ids would silently make
// every <use> resolve to whichever came first.
const LOADER_GLYPH_PREFIX = 'zgl-';

// Heavier than the opening's 1.5. The loader renders the same 400-unit viewBox
// at a fraction of the size, and a hairline that survives at 340px is gone at
// 160px.
const LOADER_GLYPH_STROKE = 2;

// Bigger than the opening's 1.15, for the same reason.
const LOADER_GLYPH_SCALE = 1.5;

function loaderGlyphDefs(): string {
  return '<defs>' + Object.keys(ZODIAC_GLYPH_PATHS).map(id =>
    '<g id="' + LOADER_GLYPH_PREFIX + id + '" fill="none" stroke="currentColor" ' +
      'stroke-width="' + LOADER_GLYPH_STROKE + '" stroke-linecap="round" stroke-linejoin="round">' +
      ZODIAC_GLYPH_PATHS[id].map(d => '<path d="' + d + '"/>').join('') +
    '</g>'
  ).join('') + '</defs>';
}

// The nesting matches index.html and is load-bearing for the same reason: a CSS
// `transform` REPLACES an SVG transform attribute rather than composing with
// it, so placement must live on .house-slot and .house-emph must carry nothing
// but the emphasis.
function loaderHouseRing(): string {
  return '<g class="house-ring" opacity=".9">' + HOUSE_SLOTS.map(([id, x, y]) =>
    '<g class="house-slot" data-house="' + id + '" transform="translate(' + x + ' ' + y + ')">' +
      '<g class="house-emph">' +
        '<use href="#' + LOADER_GLYPH_PREFIX + id + '" ' +
          'transform="scale(' + LOADER_GLYPH_SCALE + ') translate(-12 -12)"/>' +
      '</g>' +
    '</g>'
  ).join('') + '</g>';
}

/**
 * The compact sigil, for pages that are already up but still waiting on data.
 * Stroke widths are deliberately heavier than the full-screen sigil: this is
 * the same 400-unit viewBox rendered far smaller, so hairlines would disappear.
 *
 * Ring radii match index.html's so the two read as one artwork: the glyphs sit
 * at r=158 in the lane between the wheel's r=178 and r=138 circles.
 *
 * `label` is caller-supplied copy, never user input — no escaping is done here.
 */
function sigilLoaderMarkup(label: string): string {
  return '' +
    '<div class="sigil-loader" role="status" aria-live="polite">' +
      '<svg class="sigil-loader-svg" viewBox="0 0 400 400" fill="none" stroke="currentColor" aria-hidden="true">' +
        loaderGlyphDefs() +
        '<g class="ring rim">' +
          '<circle cx="200" cy="200" r="192" stroke-width="2.5" opacity=".4"/>' +
          '<circle cx="200" cy="200" r="185" stroke-width="7" stroke-dasharray="2.5 22" opacity=".5"/>' +
        '</g>' +
        '<g class="ring wheel">' +
          '<circle cx="200" cy="200" r="178" stroke-width="2.5" opacity=".5"/>' +
          '<circle cx="200" cy="200" r="138" stroke-width="2.5" opacity=".5"/>' +
          loaderHouseRing() +
        '</g>' +
        '<g class="ring star">' +
          '<path d="M200,100 250,286.6 113.4,150 300,200 113.4,250 250,113.4 200,300 150,113.4 286.6,250 100,200 286.6,150 150,286.6 Z" ' +
            'stroke-width="2.5" opacity=".5" stroke-linejoin="round"/>' +
        '</g>' +
        '<g class="cosmo">' +
          '<circle cx="200" cy="200" r="52" fill="currentColor" opacity=".1" stroke="none"/>' +
          '<path d="M200 168 L207 193 L232 200 L207 207 L200 232 L193 207 L168 200 L193 193 Z" fill="currentColor" stroke="none" opacity=".9"/>' +
        '</g>' +
      '</svg>' +
      '<p class="sigil-loader-label">' + label + '</p>' +
    '</div>';
}

// Only arm the failsafe on a page that actually has a splash. rankings.html
// loads this file purely for sigilLoaderMarkup.
/* istanbul ignore else */
if (typeof document !== 'undefined' && document.getElementById('splash')) {
  setTimeout(hideSplash, SPLASH_FAILSAFE_MS);
}

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.hideSplash        = hideSplash;
  global.sigilLoaderMarkup = sigilLoaderMarkup;
  global.houseGlyphSvg     = houseGlyphSvg;
  global.renderNameHouse   = renderNameHouse;
  module.exports = {
    hideSplash, sigilLoaderMarkup, houseGlyphSvg, renderNameHouse,
    ZODIAC_GLYPH_PATHS, HOUSE_SLOTS, LOADER_GLYPH_PREFIX,
    SPLASH_MIN_MS, SPLASH_FAILSAFE_MS, SPLASH_FADE_MS,
  };
}
