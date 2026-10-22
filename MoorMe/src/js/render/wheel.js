// Rozpoznawanie kółka myszy i touchpada w zdarzeniach „wheel”.
// Kółko daje skokowe kroki (100 / 120 px), touchpad – serię małych, ułamkowych przesunięć (także w poziomie).
// Powiększenie interfejsu w aplikacji (zoom okna) skaluje kroki kółka, np. 100 → 66,7 przy 1,5× – trzeba je odskalować.
const zoomFactor = () => {
  try { if (typeof window !== 'undefined' && window.moorme && window.moorme.zoomFactor) return window.moorme.zoomFactor() || 1; } catch (e) { /* brak mostu */ }
  return 1;
};
const nearInt = (v) => Math.abs(v - Math.round(v)) < 0.05;

/** Zwraca funkcję (e) → 'pinch' | 'pad' | 'wheel'. Seria zdarzeń touchpada zachowuje klasyfikację przez 250 ms. */
export function wheelClassifier() {
  let padUntil = 0;
  return (e) => {
    if (e.ctrlKey) return 'pinch';
    if (e.deltaMode !== 0) return 'wheel';
    const now = performance.now(), z = zoomFactor();
    const dy = Math.abs(e.deltaY) * z, wd = Math.abs(e.wheelDeltaY || 0) * z;
    const mouse = e.deltaX === 0 && dy > 0 && ((dy >= 40 && nearInt(dy)) || (wd >= 100 && nearInt(wd / 120)));
    if (!mouse) padUntil = now + 250;
    return now < padUntil ? 'pad' : 'wheel';
  };
}
