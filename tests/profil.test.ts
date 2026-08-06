// shared.ts is already on global via setup.ts
// profil.ts runs editNameBtn listener + render() at load time, so the DOM
// fixture must be built BEFORE require() — use jest.resetModules() in beforeEach.

const PROFIL_DOM = `
  <span id="nameTag">Saint</span>
  <span id="nameHouse"></span>
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
  <div class="house-grid" id="houseGrid"></div>
  <p class="seg-hint" id="houseHint"></p>
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
  document.documentElement.removeAttribute('data-house');
  jest.resetModules();
  require('../src/theme');
  require('../src/shared');
  // houses.ts and omens.ts must load before profil.ts (mirrors script order in
  // profile.html) — the house picker reads one and raises omens through the other.
  require('../src/houses');
  // splash.ts must load after houses.ts and before profil.ts — it owns
  // renderNameHouse(), which render() calls, and reads houses.ts to do it.
  require('../src/splash');
  require('../src/omens');
  profilModule = require('../src/profil');
});

// ── render ────────────────────────────────────────────────────────────────────

describe('render', () => {
  it('wears the held house beside the name', () => {
    localStorage.setItem('house', 'libra');
    profilModule.render();

    const badge = document.querySelector('#nameHouse .house-badge');
    expect(badge).not.toBeNull();
    expect(badge!.getAttribute('aria-label')).toBe('House of Libra');
  });

  it('leaves the badge slot empty when no house is held', () => {
    profilModule.render();
    expect(document.getElementById('nameHouse')!.innerHTML).toBe('');
  });

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

  // The badge is part of the name strip, so it steps aside with the name while
  // the input occupies the row, and comes back with it.
  it('stands the house badge down while editing and back up after saving', () => {
    document.getElementById('editNameBtn').click();
    expect(document.getElementById('nameHouse').style.display).toBe('none');

    document.querySelector('.save-name-btn').click();
    expect(document.getElementById('nameHouse').style.display).toBe('');
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

  it('removes the input, save button and error line from the DOM after saving', () => {
    document.getElementById('editNameBtn').click();
    document.querySelector('.save-name-btn').click();
    expect(document.querySelector('.name-input')).toBeNull();
    expect(document.querySelector('.save-name-btn')).toBeNull();
    expect(document.querySelector('.name-error')).toBeNull();
  });

  it('refuses a banned name, keeps the editor open and explains why', () => {
    localStorage.setItem('playerName', 'Selene');
    document.getElementById('editNameBtn').click();
    (document.querySelector('.name-input') as HTMLInputElement).value = 'Connard';
    document.querySelector('.save-name-btn').click();

    const error = document.querySelector('.name-error') as HTMLElement;
    expect(localStorage.getItem('playerName')).toBe('Selene');
    expect(document.querySelector('.name-input')).not.toBeNull();
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe('That name is not permitted. Choose another.');
  });

  it('clears the error as soon as the player types again', () => {
    document.getElementById('editNameBtn').click();
    const input = document.querySelector('.name-input') as HTMLInputElement;
    input.value = 'Connard';
    document.querySelector('.save-name-btn').click();
    expect((document.querySelector('.name-error') as HTMLElement).hidden).toBe(false);

    input.value = 'Selene';
    input.dispatchEvent(new Event('input'));
    expect((document.querySelector('.name-error') as HTMLElement).hidden).toBe(true);
  });

  it('accepts a clean name after one was refused', () => {
    document.getElementById('editNameBtn').click();
    const input = document.querySelector('.name-input') as HTMLInputElement;
    input.value = 'Connard';
    document.querySelector('.save-name-btn').click();
    input.value = 'Selene';
    document.querySelector('.save-name-btn').click();

    expect(localStorage.getItem('playerName')).toBe('Selene');
    expect(document.querySelector('.name-input')).toBeNull();
  });

  it('caps the name at the shared maximum length', () => {
    document.getElementById('editNameBtn').click();
    const input = document.querySelector('.name-input') as HTMLInputElement;
    expect(input.maxLength).toBe((global as any).NAME_MAX_LEN);
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

// ── Sanctuary › Your House ────────────────────────────────────────────────────

describe('initHouseControl', () => {
  const WEEK = 7 * 24 * 60 * 60 * 1000;

  const grid    = () => document.getElementById('houseGrid') as HTMLElement;
  const hint    = () => document.getElementById('houseHint') as HTMLElement;
  const buttons = () => Array.from(grid().querySelectorAll('button')) as HTMLButtonElement[];
  const byHouse = (name: string) =>
    buttons().find(b => b.getAttribute('aria-label') === 'House of ' + name) as HTMLButtonElement;

  it('renders one button per house', () => {
    profilModule.initHouseControl();
    expect(buttons()).toHaveLength(12);
  });

  it('draws each button from the shared glyph library', () => {
    profilModule.initHouseControl();
    const use = byHouse('Leo').querySelector('use');
    expect(use!.getAttribute('href')).toBe('#zg-leo');
  });

  it('invites a first choice when no house is held', () => {
    profilModule.initHouseControl();
    expect(hint().textContent).toContain('Choose your house');
  });

  it('stores the house and marks it pressed when chosen', () => {
    profilModule.initHouseControl();
    byHouse('Leo').click();

    expect(localStorage.getItem('house')).toBe('leo');
    expect(byHouse('Leo').getAttribute('aria-pressed')).toBe('true');
    expect(byHouse('Leo').className).toContain('active');
  });

  it('lights the glyph on the sigil by stamping <html>', () => {
    profilModule.initHouseControl();
    byHouse('Virgo').click();
    expect(document.documentElement.getAttribute('data-house')).toBe('virgo');
  });

  // The badge sits outside this control's grid, so a change here has to reach
  // across the page for it. Without that it keeps the old glyph until the next
  // navigation — invisible in a test that only inspects the picker.
  it('repaints the badge beside the name when the house changes', () => {
    profilModule.initHouseControl();
    byHouse('Leo').click();

    const badge = document.querySelector('#nameHouse .house-badge');
    expect(badge).not.toBeNull();
    expect(badge!.getAttribute('aria-label')).toBe('House of Leo');
  });

  it('raises a House Claimed omen', () => {
    profilModule.initHouseControl();
    byHouse('Pisces').click();

    const log = (global as any).readOmens();
    expect(log).toHaveLength(1);
    expect(log[0].k).toBe('house');
    expect(log[0].b).toContain('House of Pisces');
  });

  it('names the held house and the cooldown in the hint', () => {
    localStorage.setItem('house', 'leo');
    localStorage.setItem('houseChangedAt', String(Date.now()));
    profilModule.initHouseControl();

    expect(hint().textContent).toContain('House of Leo');
    expect(hint().textContent).toContain('Choose again in');
  });

  it('locks every other house while the week runs', () => {
    profilModule.initHouseControl();
    byHouse('Leo').click();

    expect(byHouse('Aries').disabled).toBe(true);
    expect(byHouse('Taurus').disabled).toBe(true);
  });

  // Greying out the house you own would read as having lost it.
  it('never disables the house already held', () => {
    profilModule.initHouseControl();
    byHouse('Leo').click();
    expect(byHouse('Leo').disabled).toBe(false);
  });

  it('refuses a locked change and leaves the stored house alone', () => {
    localStorage.setItem('house', 'leo');
    localStorage.setItem('houseChangedAt', String(Date.now()));
    profilModule.initHouseControl();

    // The button is disabled, but a click must be harmless even so.
    byHouse('Aries').click();
    expect(localStorage.getItem('house')).toBe('leo');
    expect((global as any).readOmens()).toHaveLength(0);
  });

  it('allows a change once the week is up', () => {
    localStorage.setItem('house', 'leo');
    localStorage.setItem('houseChangedAt', String(Date.now() - WEEK - 1000));
    profilModule.initHouseControl();

    expect(byHouse('Aries').disabled).toBe(false);
    byHouse('Aries').click();
    expect(localStorage.getItem('house')).toBe('aries');
  });

  // A mis-tap on the house you already hold must not cost a week.
  it('re-picking the held house raises nothing and spends nothing', () => {
    const stamp = String(Date.now() - WEEK - 1000);
    localStorage.setItem('house', 'leo');
    localStorage.setItem('houseChangedAt', stamp);
    profilModule.initHouseControl();

    byHouse('Leo').click();
    expect(localStorage.getItem('houseChangedAt')).toBe(stamp);
    expect((global as any).readOmens()).toHaveLength(0);
  });

  it('does nothing on a page without the picker', () => {
    document.body.innerHTML = '';
    expect(() => profilModule.initHouseControl()).not.toThrow();
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
