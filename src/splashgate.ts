/**
 * splashgate.ts — decides whether the opening plays at all
 *
 * Ironvow is a multi-page Cordova app: the footer nav is five real navigations,
 * so returning Home from Chronicle is a full document load. #splash is inlined
 * in index.html's markup, which means it painted again on every one of those
 * returns and hideSplash() then held it for SPLASH_MIN_MS. The opening is an
 * arrival, not a page transition — it belongs to the app launch and nothing else.
 *
 * sessionStorage is the right store for exactly that scope: it survives
 * navigation inside the WebView and dies with the WebView, so "already played"
 * means "already played since the app was launched".
 *
 * Loaded from <head>, BEFORE the parser reaches #splash. This cannot be done in
 * splash.ts — that file runs at the end of <body>, by which point the sigil has
 * already had its chance to paint, and the result would be a flash rather than a
 * suppression. It cannot be an inline <script> either: index.html's CSP declares
 * no script-src, so inline code falls to `default-src 'self'` and is refused.
 * Hence a class on <html> and a rule in splash.css, the same pre-paint handshake
 * theme.ts and houses.ts already use.
 *
 * Deliberately standalone — nothing here may depend on shared.ts, which loads later.
 */

const SPLASH_SESSION_KEY = 'splashPlayed';

function splashAlreadyPlayed(): boolean {
  return sessionStorage.getItem(SPLASH_SESSION_KEY) !== null;
}

// The flag is claimed on the FIRST load rather than when the sigil finishes, so
// a navigation that interrupts the opening still counts it as played. Otherwise
// tapping through the nav during those 700ms would rearm it.
function gateSplash(): void {
  if (splashAlreadyPlayed()) {
    document.documentElement.classList.add('splash-seen');
    return;
  }
  sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
}

gateSplash();

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.splashAlreadyPlayed = splashAlreadyPlayed;
  global.gateSplash          = gateSplash;
  module.exports = { splashAlreadyPlayed, gateSplash, SPLASH_SESSION_KEY };
}
