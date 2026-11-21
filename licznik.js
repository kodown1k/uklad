/* ============================================================
   licznik.js — piksel wejść na voyager.kodownik.co (GitHub Pages) do logu Bramy na ryzenie.
   Strona wczytuje https://kodownik.co/_l/voyager/<strona>.gif (nginx: empty_gif, no-cache), więc
   wejście trafia do zakładki „Publiczne” fleet-gate (źródło „licznik”: IP, kraj, sieć/ASN).
   Tylko host voyager.kodownik.co: wejścia na kodownik.co/uklad/ Brama loguje sama.
   Piksel liczy tylko Polskę (geoblokada 443 ryzena); świat liczy Cloudflare Web Analytics.
   Nazwa strony ≤ 31 znaków — dłuższy człon Brama zapisuje w logu jako {tok}.
   Dual-export IIFE (jak kino.js): czysta funkcja `piksel` + wpięcie w przeglądarce.
   ============================================================ */
(function (root) {
  'use strict';

  var HOST = 'voyager.kodownik.co';
  var BAZA = 'https://kodownik.co/_l/voyager/';
  // strony rozróżniane w panelu (podpis „voyager/<strona>”); nowa = wpis tu + gałąź w `strona`
  var STRONY = ['film', 'mrugniecie', 'scena', 'filmy'];

  // Która strona Voyagera: kolejność jak w solar.js (?mrugniecie i ?film/?kino; ?zjawisko=… to nie film).
  function strona(pathname, search) {
    if (/^\/filmy\//.test(pathname)) return 'filmy';
    if (/[?&]mrugniecie\b/.test(search)) return 'mrugniecie';
    if (/[?&](film|kino)\b/.test(search) && !/[?&]zjawisko=/.test(search)) return 'film';
    return 'scena';
  }

  // Adres piksela albo null (inny host: kodownik.co/uklad/, localhost, file://).
  function piksel(host, pathname, search) {
    if (host !== HOST) return null;
    return BAZA + strona(pathname || '/', search || '') + '.gif';
  }

  var api = { piksel: piksel, strona: strona, STRONY: STRONY, HOST: HOST, BAZA: BAZA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.Licznik = api;
    try {
      var u = piksel(location.hostname, location.pathname, location.search);
      if (u) (new Image(1, 1)).src = u;
    } catch (e) { /* licznik nigdy nie psuje strony */ }
  }
})(typeof window !== 'undefined' ? window : this);
