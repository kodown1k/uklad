/* ============================================================
   moon-format.js — formatowanie faktów księżyca (okres, średnica).
   Czysta logika, bez zależności DOM/THREE. Testowane.
   ============================================================ */
(function (root) {
  'use strict';

  // Okres orbitalny z dni: <1 dnia → godziny; inaczej dni (1 miejsce po przecinku).
  // days < 0 oznacza orbitę wsteczną (np. Tryton) → znacznik „(wstecz)".
  function fmtPeriod(days) {
    var a = Math.abs(days);
    var retro = days < 0 ? ' (wstecz)' : '';
    if (a < 1) return (a * 24).toFixed(1).replace('.', ',') + ' h' + retro;
    return a.toFixed(1).replace('.', ',') + ' dni' + retro;
  }

  // Średnica [km] z separatorem tysięcy spacją (jak fakty planet: „12 742 km").
  function fmtKm(km) {
    return String(Math.round(km)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' km';
  }

  var MoonFormat = { fmtPeriod: fmtPeriod, fmtKm: fmtKm };
  if (typeof module !== 'undefined' && module.exports) module.exports = MoonFormat;
  else root.MoonFormat = MoonFormat;
})(typeof window !== 'undefined' ? window : globalThis);
