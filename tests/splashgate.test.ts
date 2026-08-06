// splashgate.ts runs gateSplash() at require() time — that is the whole point of
// the module, since it has to act before the parser reaches #splash. So every
// test sets up sessionStorage FIRST and requires the module after.

let gateModule: any;

function loadGate(): void {
  jest.resetModules();
  gateModule = require('../src/splashgate');
}

beforeEach(() => {
  sessionStorage.clear();
  document.documentElement.className = '';
});

describe('gateSplash on first load of a session', () => {
  it('leaves the opening alone', () => {
    loadGate();
    expect(document.documentElement.classList.contains('splash-seen')).toBe(false);
  });

  it('claims the session flag so the next load is gated', () => {
    loadGate();
    expect(sessionStorage.getItem(gateModule.SPLASH_SESSION_KEY)).toBe('1');
  });
});

describe('gateSplash on a later load of the same session', () => {
  it('suppresses the opening', () => {
    loadGate();                                   // the launch
    document.documentElement.className = '';      // a fresh document, same session
    loadGate();                                   // returning Home from the nav

    expect(document.documentElement.classList.contains('splash-seen')).toBe(true);
  });

  it('keeps suppressing it across any number of navigations', () => {
    loadGate();
    for (let i = 0; i < 5; i++) {
      document.documentElement.className = '';
      loadGate();
      expect(document.documentElement.classList.contains('splash-seen')).toBe(true);
    }
  });
});

describe('a new app launch', () => {
  it('plays the opening again once sessionStorage is gone', () => {
    loadGate();
    document.documentElement.className = '';
    loadGate();
    expect(document.documentElement.classList.contains('splash-seen')).toBe(true);

    // The WebView is destroyed with the app, taking sessionStorage with it.
    sessionStorage.clear();
    document.documentElement.className = '';
    loadGate();

    expect(document.documentElement.classList.contains('splash-seen')).toBe(false);
  });
});

describe('splashAlreadyPlayed', () => {
  it('is false before anything has run', () => {
    loadGate();
    sessionStorage.clear();
    expect(gateModule.splashAlreadyPlayed()).toBe(false);
  });

  it('is true once the flag is set', () => {
    loadGate();
    expect(gateModule.splashAlreadyPlayed()).toBe(true);
  });

  // The flag is a presence check, not an equality check: any stored value counts.
  it('treats any stored value as played', () => {
    loadGate();
    sessionStorage.setItem(gateModule.SPLASH_SESSION_KEY, 'whatever');
    expect(gateModule.splashAlreadyPlayed()).toBe(true);
  });
});
