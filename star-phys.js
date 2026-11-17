// Fizyka gwiazd: jasność (blackbody) + strefa życia (ekosfera). Czysta matematyka, bez DOM/THREE.
// Dual-export IIFE (CommonJS dla `node --test` + `window.StarPhys` dla <script>). Testowane.
(function (root) {
  const T_SUN = 5772; // K (efektywna temperatura Słońca)

  // Jasność w jednostkach słonecznych: L/L☉ = (R/R☉)² · (T/T☉)⁴ (prawo Stefana-Boltzmanna).
  function luminosity(radiusSun, colorTemp) {
    const r = radiusSun || 0;
    const t = (colorTemp || 0) / T_SUN;
    return r * r * t * t * t * t;
  }

  // Konserwatywna ekosfera (Kopparapu et al. 2013): granice ze stałych strumienia solarnego —
  // wewnętrzna S=1.1 (runaway greenhouse), zewnętrzna S≈0.3438 (maximum greenhouse). Wynik w AU.
  // r_AU = sqrt(L / S). Dla Słońca (L=1): 0.953–1.706 AU. Stosunek outer/inner = sqrt(1.1/0.3438) ≈ 1.79.
  // (0.53 to wycofane „first CO2 condensation" Kastinga 1993 — review 2026-07-04, finding #7.)
  const S_INNER = 1.1, S_OUTER = 0.3438;
  function habitableZone(radiusSun, colorTemp) {
    const L = luminosity(radiusSun, colorTemp);
    return { inner: Math.sqrt(L / S_INNER), outer: Math.sqrt(L / S_OUTER), luminosity: L };
  }

  const api = { luminosity, habitableZone, T_SUN, S_INNER, S_OUTER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof root !== 'undefined' && root) root.StarPhys = api;
})(typeof window !== 'undefined' ? window : this);
