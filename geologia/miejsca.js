'use strict';
/* Zakładka Geologia — rejestr miejsc (podmenu). Nowe miejsce = nowy wpis w MIEJSCA (plus katalog z danymi);
   wpis w ladowanie.js (MIEJSCA_ID) trzyma test w node. Dual-export.
   MIEJSCA[].pliki — pliki ładowane leniwie przy pierwszym wejściu w to miejsce (przed widok.js nie wchodzą:
   widok.js jest wspólny). Zadania dopisują swoje (Task 4: dane.js, Task 5: opowiesc.js) — wpis bez pliku = 404 w smoke.
   podmenu(miejsca, aktywne) → [{ id, nazwa, wcisniety }] — czysta lista pozycji podmenu na pasku. */
(function (root) {
  var MIEJSCA = [
    { id: 'teneryfa', nazwa: 'Teneryfa', pliki: [], katalog: 'geologia/teneryfa/' }
  ];

  function podmenu(miejsca, aktywne) {
    return (miejsca || []).map(function (m) { return { id: m.id, nazwa: m.nazwa, wcisniety: m.id === aktywne }; });
  }

  var api = { MIEJSCA: MIEJSCA, podmenu: podmenu };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GeologiaMiejsca = api;
})(typeof window !== 'undefined' ? window : globalThis);
