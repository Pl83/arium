// Loaded from <head> on every page, BEFORE any other script, so the stored
// choice is stamped on <html> before the first paint. Moving this to the end
// of <body> reintroduces a flash of the OS palette on every navigation.
//
// Deliberately standalone — it must not depend on shared.ts, which loads later.

type ThemeChoice = 'auto' | 'dark' | 'light';

const THEME_KEY = 'theme';

function getTheme(): ThemeChoice {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'dark' || stored === 'light' ? stored : 'auto';
}

// 'auto' removes the attribute entirely, handing control back to the
// prefers-color-scheme query in theme.css.
function applyTheme(choice: ThemeChoice): void {
  if (choice === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', choice);
  }
}

function setTheme(choice: ThemeChoice): void {
  if (choice === 'auto') {
    localStorage.removeItem(THEME_KEY);
  } else {
    localStorage.setItem(THEME_KEY, choice);
  }
  applyTheme(choice);
}

applyTheme(getTheme());

// === NODE/JEST EXPORT — invisible in browser ===
/* istanbul ignore else */
if (typeof module !== 'undefined') {
  global.getTheme   = getTheme;
  global.setTheme   = setTheme;
  global.applyTheme = applyTheme;
  module.exports = { getTheme, setTheme, applyTheme, THEME_KEY };
}
