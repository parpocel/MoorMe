// Ustawienia gracza (zapisywane w localStorage): jacht, załoga, bandera i grafika
const KEY = 'moorme.settings';

// presety grafiki – „Niska” z myślą o starszych komputerach i grafice zintegrowanej
export const GFX_PRESETS = {
  high: { scale: 1, shadows: 'soft', antialias: true, water: 'high', fps: 60 },
  medium: { scale: 0.85, shadows: 'basic', antialias: true, water: 'medium', fps: 60 },
  low: { scale: 0.65, shadows: 'off', antialias: false, water: 'low', fps: 30 }
};
export const CREW_POOL = ['Wojtek', 'Bartek', 'Babcia', 'Piotrek', 'Kinga', 'Dominika', 'Maciej'];

const DEFAULTS = {
  boatName: 'ANNELIESE',
  homePort: 'Bregge',
  flag: 'DE',
  iala: 'A',
  callsign: 'SPS2024',
  mmsi: '261012345',
  captain: 'Kuba',
  crew: ['', '', ''], // puste = losowe imię z puli
  gfx: { preset: 'high', ...GFX_PRESETS.high, showFps: false }
};

let cache = null;
const store = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } };

export function getSettings() {
  if (cache) return cache;
  let saved = {};
  try { saved = JSON.parse(store()?.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  cache = { ...DEFAULTS, ...saved, gfx: { ...DEFAULTS.gfx, ...(saved.gfx || {}) } };
  if (!Array.isArray(cache.crew)) cache.crew = [...DEFAULTS.crew];
  while (cache.crew.length < 3) cache.crew.push('');
  return cache;
}

export function saveSettings(patch) {
  const s = getSettings();
  Object.assign(s, patch);
  if (patch.gfx) s.gfx = { ...s.gfx, ...patch.gfx };
  try { store()?.setItem(KEY, JSON.stringify(s)); } catch (e) { /* brak zapisu – zostaje w pamięci */ }
  return s;
}

export function setGfxPreset(name) {
  return saveSettings({ gfx: { preset: name, ...GFX_PRESETS[name] } });
}

// imiona załogi: kapitan + trzech (puste pola uzupełniane losowo z puli, bez powtórzeń)
export function crewNames(rand = Math.random) {
  const s = getSettings();
  const given = s.crew.map((n) => String(n || '').trim());
  const pool = CREW_POOL.filter((n) => !given.includes(n) && n !== s.captain).map((n) => [rand(), n]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  return [String(s.captain || '').trim() || 'Kuba', ...given.map((n) => n || pool.shift() || 'Ola')];
}

export function boatIdentity() {
  const s = getSettings();
  return { name: (String(s.boatName || '').trim() || DEFAULTS.boatName).toUpperCase().slice(0, 18), sub: String(s.homePort || '').trim().slice(0, 18), flag: s.flag || 'DE' };
}

// tryb pełnoekranowy (Electron obsługuje też F11)
export function isFullscreen() { return typeof document !== 'undefined' && !!document.fullscreenElement; }
export function toggleFullscreen() {
  if (typeof document === 'undefined') return;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
