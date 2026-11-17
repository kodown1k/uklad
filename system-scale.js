// Skala sceny dolotu obcego układu (C): rozdziela dwie semantyki, których sklejenie w systemMaxAU
// zepsuło render (review 2026-07-04, findings #1–4):
//  - frameAU     — jak daleko sięga TREŚĆ układu (kadr, exitDist, maxDistance, far): chce MAKSIMUM;
//  - starRadius  — podłoga widoczności gwiazdy: ∝ kadrowi (stały rozmiar kątowy w kadrze dolotu),
//    ale z twardym clampem ≤60% najciaśniejszej treści wewnętrznej (najbliższa orbita planety /
//    wewnętrzna krawędź HZ) — gwiazda-kula nie połyka 51 Peg b ani pierścienia ekosfery 40 Eri.
// Czysta matematyka, bez DOM/THREE. Dual-export IIFE (CommonJS dla `node --test` + window.SystemScale).
(function (root) {
  // Najdalsza wyświetlana separacja towarzyszy [AU] (po displayowym capie kadru).
  function compMaxAU(companions, capAU) {
    return (companions || []).reduce((m, c) => Math.max(m, Math.min((c.orbit && c.orbit.aAU) || 0, capAU)), 0);
  }
  // Najdalsza treść układu [AU]: orbity planet / zewnętrzna HZ / towarzysze (po capie). Podłoga 0.05.
  function frameAU(planetMaxAU, hzOuterAU, compAU) {
    return Math.max(planetMaxAU || 0, hzOuterAU || 0, compAU || 0, 0.05);
  }
  // Najciaśniejsza treść wewnętrzna [AU], której gwiazda nie może połknąć. 0 = brak ograniczenia.
  function clearanceAU(planetMinAU, hzInnerAU) {
    const c = Math.min(planetMinAU || Infinity, hzInnerAU || Infinity);
    return isFinite(c) ? c : 0;
  }
  // Promień gwiazdy centralnej [j. sceny].
  function starRadius(o) {
    const physical = Math.max(0.6, (o.radiusSun || 1) * 1.2);
    let floor = (o.frameAU || 0.05) * o.auScene * 0.035;
    if (o.clearanceAU > 0) floor = Math.min(floor, o.clearanceAU * o.auScene * 0.6);
    return Math.max(physical, floor);
  }
  // Promień towarzysza [j. sceny]: widoczny w kadrze dolotu (∝ frameAU), ale zawsze CZYTELNIE
  // mniejszy od gwiazdy głównej (cap 55% — towarzysz czyta się jako mniejsza gwiazda pary).
  function companionRadius(o) {
    const physical = Math.max(0.5, (o.radiusSun || 0.1) * 1.2);
    const floor = Math.min((o.frameAU || 0.05) * o.auScene * 0.012, (o.starRadius || Infinity) * 0.55);
    return Math.max(physical, floor);
  }
  // far-plane kamery w C: pokrywa próg wyjścia C→B z zapasem (finding #4 — czarny ekran przy zoom-out).
  function farPlane(exitDist, base) {
    return Math.max(base || 60000, (exitDist || 0) * 1.25);
  }
  const api = { compMaxAU, frameAU, clearanceAU, starRadius, companionRadius, farPlane };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof root !== 'undefined' && root) root.SystemScale = api;
})(typeof window !== 'undefined' ? window : this);
