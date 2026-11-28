'use strict';
/* Zakładka Geologia — materiał „Sklejka” makiety (Task B1). Czysta matematyka, bez DOM/THREE; dual-export
   (przeglądarka: window.GeologiaSklejka; node: module.exports).
   Makieta ze sklejki: wyspa wycięta z arkuszy o stałej grubości w metrach n.p.m. — warstwa nr = floor(h / krok).
   Grubość arkusza zależy od przewyższenia (przy ×3 warstwy są wyższe na ekranie, więc gęstsze w metrach): KROKI dla
   przewyższeń paska, między nimi liniowo (animowana zmiana przewyższenia przesuwa warstwy płynnie), obcięte do [50, 100].
   krok(przew) → m n.p.m. na warstwę (scena przy każdej zmianie przewyższenia wpisuje go w uniform uKrokSklejki).
   warstwa(hM, krokM) → { nr, frakcja }: to samo, co shader terenu (geologia/scena.js, GLSL_TEREN_KOLOR) liczy na GPU;
     hM ≤ 0 — morze (ocean-żywica), nie sklejka: nr = −1, frakcja 0. */
(function (root) {
  var KROKI = { 1: 100, 1.5: 75, 3: 50 };
  var PRZEW = Object.keys(KROKI).map(Number).sort(function (a, b) { return a - b; });
  var PRZEW_DOMYSLNE = 1.5;                        // jak mks.przew widoku po wejściu

  function krok(przew) {
    var x = +przew;
    if (!isFinite(x)) x = PRZEW_DOMYSLNE;
    if (x <= PRZEW[0]) return KROKI[PRZEW[0]];
    for (var i = 1; i < PRZEW.length; i++) {
      var a = PRZEW[i - 1], b = PRZEW[i];
      if (x <= b) return KROKI[a] + (KROKI[b] - KROKI[a]) * (x - a) / (b - a);
    }
    return KROKI[PRZEW[PRZEW.length - 1]];
  }

  function warstwa(hM, krokM) {
    var h = +hM, k = +krokM > 0 ? +krokM : krok(PRZEW_DOMYSLNE);
    if (!(h > 0)) return { nr: -1, frakcja: 0 };
    var w = h / k, nr = Math.floor(w), f = w - nr;
    if (f >= 1) { nr += 1; f = 0; }                // zaokrąglenie zmiennoprzecinkowe na granicy warstwy
    return { nr: nr, frakcja: f };
  }

  var api = { KROKI: KROKI, krok: krok, warstwa: warstwa };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GeologiaSklejka = api;
})(typeof window !== 'undefined' ? window : globalThis);
