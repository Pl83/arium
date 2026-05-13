// shared.ts is already on global via setup.ts
// profil.ts runs editNameBtn listener + render() at load time, so the DOM
// fixture must be built BEFORE require() — use jest.resetModules() in beforeEach.

const PROFIL_DOM = `
  <span id="nameTag">Hunter</span>
  <button id="editNameBtn">✎</button>
  <span id="rankLetter">E</span>
  <span id="rankTitle">Novice</span>
  <span id="profileLevel">1</span>
  <div id="profileLevelProgress" style="width:0%"></div>
  <span id="streakCount">0 days</span>
  <span id="totalXPDisplay">0 xp</span>
  <span id="totalCompleted">0</span>
  <div id="nameSection"></div>
  <div id="bar-strength" style="width:0%"></div><span id="val-strength">0</span>
  <div id="bar-core" style="width:0%"></div><span id="val-core">0</span>
  <div id="bar-power" style="width:0%"></div><span id="val-power">0</span>
  <div id="bar-endurance" style="width:0%"></div><span id="val-endurance">0</span>
`;

let profilModule: any;

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  document.body.innerHTML = PROFIL_DOM;
  jest.resetModules();
  require('../src/shared');
  profilModule = require('../src/profil');
});

// ── render ────────────────────────────────────────────────────────────────────

describe('render', () => {
  it('displays the default player name when none stored', () => {
    profilModule.render();
    expect(document.getElementById('nameTag').textContent).toBe('Hunter');
  });

  it('displays the stored player name', () => {
    localStorage.setItem('playerName', 'Kira');
    profilModule.render();
    expect(document.getElementById('nameTag').textContent).toBe('Kira');
  });

  it('shows rank E at level 1', () => {
    profilModule.render();
    expect(document.getElementById('rankLetter').textContent).toBe('E');
    expect(document.getElementById('rankTitle').textContent).toBe('Novice');
  });

  it('shows rank D at level 5', () => {
    localStorage.setItem('totalXP', '400'); // level 5
    profilModule.render();
    expect(document.getElementById('rankLetter').textContent).toBe('D');
  });

  it('shows rank C at level 10', () => {
    localStorage.setItem('totalXP', '900');
    profilModule.render();
    expect(document.getElementById('rankLetter').textContent).toBe('C');
  });

  it('displays the correct level number', () => {
    localStorage.setItem('totalXP', '250'); // level 3
    profilModule.render();
    expect(document.getElementById('profileLevel').textContent).toBe('3');
  });

  it('sets the progress bar width correctly', () => {
    localStorage.setItem('totalXP', '250'); // level 3, 50% progress
    profilModule.render();
    expect(document.getElementById('profileLevelProgress').style.width).toBe('50%');
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
    expect(document.getElementById('totalXPDisplay').textContent).toBe('300 xp');
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

  it('defaults to "Hunter" when input is empty or whitespace', () => {
    document.getElementById('editNameBtn').click();
    (document.querySelector('.name-input') as HTMLInputElement).value = '   ';
    document.querySelector('.save-name-btn').click();
    expect(localStorage.getItem('playerName')).toBe('Hunter');
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
