// shared.ts is already on global via setup.ts
// profil.ts runs editNameBtn listener + render() at load time, so the DOM
// fixture must be built BEFORE require() — use jest.resetModules() in beforeEach.

const PROFIL_DOM = `
  <span id="nameTag">Saint</span>
  <button id="editNameBtn">✎</button>
  <span id="rankLetter">E</span>
  <span id="rankTitle">Aspirant</span>
  <span id="profileLevel">1</span>
  <div id="profileLevelProgress" style="width:0%"></div>
  <span id="profileLevelLabel"></span>
  <span id="streakCount">0 days</span>
  <span id="totalXPDisplay">0 xp</span>
  <span id="totalCompleted">0</span>
  <div id="nameSection"></div>
  <div id="bar-strength" style="width:0%"></div><span id="val-strength">0</span>
  <div id="bar-core" style="width:0%"></div><span id="val-core">0</span>
  <div id="bar-power" style="width:0%"></div><span id="val-power">0</span>
  <div id="bar-endurance" style="width:0%"></div><span id="val-endurance">0</span>
  <div id="bar-agility" style="width:0%"></div><span id="val-agility">0</span>
  <div id="themeControl">
    <button class="seg-btn" data-theme-choice="auto">Auto</button>
    <button class="seg-btn" data-theme-choice="dark">Dark</button>
    <button class="seg-btn" data-theme-choice="light">Light</button>
  </div>
  <svg id="radar-chart"></svg>
  <button id="deleteAccountBtn"></button>
  <div id="deleteConfirm" hidden>
    <button id="deleteCancelBtn"></button>
    <button id="deleteConfirmBtn"></button>
  </div>
  <p id="deleteStatus"></p>
`;

let profilModule: any;

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  document.body.innerHTML = PROFIL_DOM;
  document.documentElement.removeAttribute('data-theme');
  jest.resetModules();
  require('../src/theme');
  require('../src/shared');
  profilModule = require('../src/profil');
});

// ── render ────────────────────────────────────────────────────────────────────

describe('render', () => {
  it('displays the default player name when none stored', () => {
    profilModule.render();
    expect(document.getElementById('nameTag').textContent).toBe('Saint');
  });

  it('displays the stored player name', () => {
    localStorage.setItem('playerName', 'Kira');
    profilModule.render();
    expect(document.getElementById('nameTag').textContent).toBe('Kira');
  });

  it('shows rank E at level 1', () => {
    profilModule.render();
    expect(document.getElementById('rankLetter').textContent).toBe('E');
    expect(document.getElementById('rankTitle').textContent).toBe('Aspirant');
  });

  it('shows rank D at level 5', () => {
    localStorage.setItem('totalXP', '1000'); // level 5 (xpToLevel(5) = 1000)
    profilModule.render();
    expect(document.getElementById('rankLetter').textContent).toBe('D');
  });

  it('shows rank C at level 10', () => {
    localStorage.setItem('totalXP', '4500'); // level 10 (xpToLevel(10) = 4500)
    profilModule.render();
    expect(document.getElementById('rankLetter').textContent).toBe('C');
  });

  it('displays the correct level number', () => {
    localStorage.setItem('totalXP', '350'); // level 3 (300–599)
    profilModule.render();
    expect(document.getElementById('profileLevel').textContent).toBe('3');
  });

  it('sets the progress bar width correctly', () => {
    localStorage.setItem('totalXP', '450'); // level 3, 50% (300 + 150 of 300)
    profilModule.render();
    expect(document.getElementById('profileLevelProgress').style.width).toBe('50%');
  });

  it('sets rank-letter class to the current rank tier', () => {
    profilModule.render(); // E at level 1
    expect(document.getElementById('rankLetter').className).toContain('rank-e');
  });

  it('updates rank-letter class when rank changes', () => {
    localStorage.setItem('totalXP', '1000'); // level 5, rank D
    profilModule.render();
    expect(document.getElementById('rankLetter').className).toContain('rank-d');
    expect(document.getElementById('rankLetter').className).not.toContain('rank-e');
  });

  it('displays streak in singular when streak = 1', () => {
    localStorage.setItem('streak', '1');
    profilModule.render();
    expect(document.getElementById('streakCount').textContent).toBe('1 day');
  });

  it('displays streak in plural when streak = 5', () => {
    localStorage.setItem('streak', '5');
    profilModule.render();
    expect(document.getElementById('streakCount').textContent).toBe('5 days');
  });

  it('displays the total XP value', () => {
    localStorage.setItem('totalXP', '300');
    profilModule.render();
    expect(document.getElementById('totalXPDisplay').textContent).toBe('300 cosmo');
  });

  it('displays total completed count', () => {
    localStorage.setItem('totalCompleted', '12');
    profilModule.render();
    expect(document.getElementById('totalCompleted').textContent).toBe('12');
  });

  it('renders attribute bar at 50% at the soft cap (25 / 50)', () => {
    localStorage.setItem('stats', JSON.stringify({ core: 25 }));
    profilModule.render();
    expect(document.getElementById('bar-core').style.width).toBe('50%');
    expect(document.getElementById('val-core').textContent).toBe('25');
  });

  it('caps the attribute bar at 100% when value exceeds soft cap', () => {
    localStorage.setItem('stats', JSON.stringify({ strength: 100 }));
    profilModule.render();
    expect(document.getElementById('bar-strength').style.width).toBe('100%');
  });

  it('renders 0% bar and 0 value when stat is missing', () => {
    profilModule.render();
    expect(document.getElementById('bar-power').style.width).toBe('0%');
    expect(document.getElementById('val-power').textContent).toBe('0');
  });

  it('renders 0% bar and 0 value for agility when stat is missing', () => {
    profilModule.render();
    expect(document.getElementById('bar-agility').style.width).toBe('0%');
    expect(document.getElementById('val-agility').textContent).toBe('0');
  });

  it('renders attribute bar at 50% for agility at the soft cap (25 / 50)', () => {
    localStorage.setItem('stats', JSON.stringify({ agility: 25 }));
    profilModule.render();
    expect(document.getElementById('bar-agility').style.width).toBe('50%');
    expect(document.getElementById('val-agility').textContent).toBe('25');
  });
});

// ── editNameBtn — name editing flow ───────────────────────────────────────────

describe('editNameBtn', () => {
  it('hides nameTag and editNameBtn and shows the name input on click', () => {
    document.getElementById('editNameBtn').click();
    expect(document.querySelector('.name-input')).toBeTruthy();
    expect(document.getElementById('nameTag').style.display).toBe('none');
    expect(document.getElementById('editNameBtn').style.display).toBe('none');
  });

  it('saves the new name and restores UI on save button click', () => {
    document.getElementById('editNameBtn').click();
    (document.querySelector('.name-input') as HTMLInputElement).value = 'Nero';
    document.querySelector('.save-name-btn').click();
    expect(localStorage.getItem('playerName')).toBe('Nero');
    expect(document.getElementById('nameTag').textContent).toBe('Nero');
    expect(document.getElementById('nameTag').style.display).toBe('');
    expect(document.getElementById('editNameBtn').style.display).toBe('');
  });

  it('saves the name on Enter key', () => {
    document.getElementById('editNameBtn').click();
    const input = document.querySelector('.name-input') as HTMLInputElement;
    input.value = 'Selene';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(localStorage.getItem('playerName')).toBe('Selene');
  });

  it('defaults to "Saint" when input is empty or whitespace', () => {
    document.getElementById('editNameBtn').click();
    (document.querySelector('.name-input') as HTMLInputElement).value = '   ';
    document.querySelector('.save-name-btn').click();
    expect(localStorage.getItem('playerName')).toBe('Saint');
  });

  it('removes the input and save button from the DOM after saving', () => {
    document.getElementById('editNameBtn').click();
    document.querySelector('.save-name-btn').click();
    expect(document.querySelector('.name-input')).toBeNull();
    expect(document.querySelector('.save-name-btn')).toBeNull();
  });

  it('does not save on non-Enter key presses', () => {
    document.getElementById('editNameBtn').click();
    const input = document.querySelector('.name-input') as HTMLInputElement;
    input.value = 'Phantom';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(localStorage.getItem('playerName')).toBeNull();
  });
});

// ── Display › Theme control ───────────────────────────────────────────────────

describe('initThemeControl', () => {
  const buttons = () =>
    Array.from(document.querySelectorAll('#themeControl .seg-btn')) as HTMLElement[];
  const active = () =>
    (document.querySelector('#themeControl .seg-btn.active') as HTMLElement | null)
      ?.dataset.themeChoice ?? null;

  it('marks Auto active when nothing is stored', () => {
    expect(active()).toBe('auto');
  });

  it('marks the stored choice active on load', () => {
    localStorage.setItem('theme', 'light');
    document.body.innerHTML = PROFIL_DOM;
    jest.resetModules();
    require('../src/theme');
    require('../src/shared');
    require('../src/profil');
    expect(active()).toBe('light');
  });

  it('persists and applies the choice on click', () => {
    buttons().find(b => b.dataset.themeChoice === 'dark')!.click();
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('moves the active marker to the clicked button', () => {
    buttons().find(b => b.dataset.themeChoice === 'light')!.click();
    expect(active()).toBe('light');
    expect(document.querySelectorAll('#themeControl .seg-btn.active').length).toBe(1);
  });

  it('clears storage and the attribute when Auto is chosen again', () => {
    buttons().find(b => b.dataset.themeChoice === 'dark')!.click();
    buttons().find(b => b.dataset.themeChoice === 'auto')!.click();
    expect(localStorage.getItem('theme')).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(active()).toBe('auto');
  });

  it('redraws the radar so it picks up the new palette', () => {
    const svg = document.getElementById('radar-chart')!;
    svg.innerHTML = '';
    buttons().find(b => b.dataset.themeChoice === 'dark')!.click();
    expect(svg.children.length).toBeGreaterThan(0);
  });

  it('does not throw when the control is absent from the page', () => {
    document.body.innerHTML = '<div id="themeControlMissing"></div>';
    expect(() => (global as any).initThemeControl()).not.toThrow();
  });
});

// ── Danger zone › Delete Account ──────────────────────────────────────────────

describe('initDeleteAccount', () => {
  const trigger    = () => document.getElementById('deleteAccountBtn') as HTMLButtonElement;
  const confirmBox = () => document.getElementById('deleteConfirm') as HTMLElement;
  const cancelBtn  = () => document.getElementById('deleteCancelBtn') as HTMLButtonElement;
  const eraseBtn   = () => document.getElementById('deleteConfirmBtn') as HTMLButtonElement;
  const status     = () => document.getElementById('deleteStatus') as HTMLElement;

  // Rebuild the page with deletePlayer stubbed to a chosen outcome.
  const load = (outcome: string) => {
    (global as any).deletePlayer = jest.fn().mockResolvedValue(outcome);
    document.body.innerHTML = PROFIL_DOM;
    jest.resetModules();
    require('../src/theme');
    require('../src/shared');
    require('../src/profil');
  };

  const seedProgress = () => {
    localStorage.setItem('playerName', 'Axel');
    localStorage.setItem('totalXP', '7100');
    localStorage.setItem('deviceId', 'dev-1');
  };

  it('keeps the confirmation hidden until the first tap', () => {
    load('deleted');
    expect(confirmBox().hidden).toBe(true);
  });

  it('reveals the confirmation without destroying anything', async () => {
    seedProgress();
    load('deleted');
    trigger().click();
    expect(confirmBox().hidden).toBe(false);
    expect(trigger().hidden).toBe(true);
    expect((global as any).deletePlayer).not.toHaveBeenCalled();
    expect(localStorage.getItem('totalXP')).toBe('7100');
  });

  it('backs out cleanly on Keep', () => {
    seedProgress();
    load('deleted');
    trigger().click();
    cancelBtn().click();
    expect(confirmBox().hidden).toBe(true);
    expect(trigger().hidden).toBe(false);
    expect(localStorage.getItem('totalXP')).toBe('7100');
  });

  it('erases local data and flags the SQLite wipe when the row is deleted', async () => {
    seedProgress();
    load('deleted');
    trigger().click();
    eraseBtn().click();
    await Promise.resolve(); await Promise.resolve();

    expect((global as any).deletePlayer).toHaveBeenCalledWith('dev-1');
    expect(localStorage.getItem('totalXP')).toBeNull();
    expect(localStorage.getItem('playerName')).toBeNull();
    expect(localStorage.getItem('pendingWipe')).toBe('1');
  });

  it('erases local data when no remote row existed (never-synced player)', async () => {
    seedProgress();
    load('absent');
    trigger().click();
    eraseBtn().click();
    await Promise.resolve(); await Promise.resolve();

    expect(localStorage.getItem('totalXP')).toBeNull();
    expect(localStorage.getItem('pendingWipe')).toBe('1');
  });

  it('destroys NOTHING when the remote delete fails', async () => {
    seedProgress();
    load('failed');
    trigger().click();
    eraseBtn().click();
    await Promise.resolve(); await Promise.resolve();

    expect(localStorage.getItem('totalXP')).toBe('7100');
    expect(localStorage.getItem('playerName')).toBe('Axel');
    expect(localStorage.getItem('pendingWipe')).toBeNull();
    expect(status().textContent).toContain('Nothing was deleted');
  });

  it('re-enables the buttons after a failure so the user can retry', async () => {
    seedProgress();
    load('failed');
    trigger().click();
    eraseBtn().click();
    await Promise.resolve(); await Promise.resolve();

    expect(eraseBtn().disabled).toBe(false);
    expect(cancelBtn().disabled).toBe(false);
  });

  it('does not throw when the danger zone is absent from the page', () => {
    document.body.innerHTML = '<div></div>';
    expect(() => (global as any).initDeleteAccount()).not.toThrow();
  });
});
