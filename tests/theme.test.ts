// theme.ts stamps <html data-theme> from localStorage. It runs at import time,
// so each test re-requires it after resetting modules.

let themeModule: any;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  jest.resetModules();
  themeModule = require('../src/theme');
});

// ── getTheme ──────────────────────────────────────────────────────────────────

describe('getTheme', () => {
  it('defaults to auto when nothing is stored', () => {
    expect(themeModule.getTheme()).toBe('auto');
  });

  it('returns the stored dark choice', () => {
    localStorage.setItem('theme', 'dark');
    expect(themeModule.getTheme()).toBe('dark');
  });

  it('returns the stored light choice', () => {
    localStorage.setItem('theme', 'light');
    expect(themeModule.getTheme()).toBe('light');
  });

  it('falls back to auto for an unrecognised stored value', () => {
    localStorage.setItem('theme', 'sepia');
    expect(themeModule.getTheme()).toBe('auto');
  });
});

// ── applyTheme ────────────────────────────────────────────────────────────────

describe('applyTheme', () => {
  it('sets data-theme="dark"', () => {
    themeModule.applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('sets data-theme="light"', () => {
    themeModule.applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('removes the attribute for auto so prefers-color-scheme takes over', () => {
    themeModule.applyTheme('dark');
    themeModule.applyTheme('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

// ── setTheme ──────────────────────────────────────────────────────────────────

describe('setTheme', () => {
  it('persists dark and applies it', () => {
    themeModule.setTheme('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('persists light and applies it', () => {
    themeModule.setTheme('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('clears storage for auto rather than storing the string', () => {
    themeModule.setTheme('dark');
    themeModule.setTheme('auto');
    expect(localStorage.getItem('theme')).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

// ── import-time application ───────────────────────────────────────────────────

describe('applies the stored choice on import', () => {
  it('stamps the attribute as soon as the module loads', () => {
    localStorage.setItem('theme', 'light');
    jest.resetModules();
    require('../src/theme');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('leaves the attribute off when the choice is auto', () => {
    jest.resetModules();
    require('../src/theme');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
