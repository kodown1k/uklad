'use strict';
/* Zakładka Geologia — pejzaż dźwiękowy makiety i stuknięcie w skałę (Task B3). Czysta część, bez DOM/THREE/Web Audio;
   dual-export (przeglądarka: window.GeologiaPejzaz, node: module.exports). Dźwięk gra GeologiaDzwiek.utworz(ctx) w widoku
   (geologia/widok.js) — tu tylko liczby.
   poziomy({ naMorzu, odlBrzeguKm, wysM, odlKameryKm, kalima, ekspozycja }) → { wiatr, morze, pomruk, ton } ∈ [0, 1] —
     poziomy warstw podkładu (geologia/dzwiek.js) z miejsca pod środkiem ekranu:
       morze = przy brzegu (1 − gładko(0, 6, odlBrzeguKm); na otwartym morzu co najmniej MORZE_OTWARTE) × (0,3 + 0,7 · ekspozycja)
         — ekspozycja na martwą falę z pola fal (A1, kanał B P.poleFal: brzeg nawietrzny 1, cień falowy 0,25);
       wiatr = 0,2 + 0,8 · gładko(1500, 3000, wysM) — na grani i w Las Cañadas pełny;
       pomruk = 0, ton = stała podłoga TON; pomruk gra w widoku BEZ trzasków (GeologiaDzwiek.utworz(ctx, { trzaski: false }),
         R17) — przy kalimie to niski szum przytłumienia, nie lawa;
       wszystko × (1 − gładko(20, 120, odlKameryKm)) — z daleka (cała wyspa w kadrze) pejzaż milknie; tylko ton ma podłogę
         TON_DALEKO (0,08 ≤ 0,1): kadr startowy makiety leży ok. 130 km od środka ekranu i bez podłogi włączenie głośnika
         dawało ciszę cyfrową — przycisk wyglądał na zepsuty;
       kalima (umowne przytłumienie pyłem): morze i wiatr × 0,6, pomruk + 0,2 (przed spadkiem z odległością).
     Wejścia nieliczbowe (NaN, brak) → wartości bezpieczne (odległości: daleko, wysokość 0, ekspozycja 0).
   brzmienie(idJednostki, jednostki?) → { czest [Hz], wybrzmienie [s], szum ∈ [0, 1] } — UMOWNE parametry krótkiego stuknięcia
     z rodzaju skały jednostki (pole `skaly` w geologia/<miejsce>/dane.js; jednostki domyślnie z window.GeologiaTeneryfa):
     zawiera „fonolit” → wysoka i długa (1800 Hz, 0,9 s), „pumeks” / „piroklast” → głucha (300 Hz, 0,08 s, szum 0,8),
     inaczej bazalt (900 Hz, 0,25 s). To nie fakt o skale: dane.js nie ma źródła o brzmieniu, więc interfejs o brzmieniu
     NIC nie mówi (żadnego podpisu) — stuknięcie jest znakiem „to inna skała”, nie pomiarem.
   punktNaTerenie(start [x, y, z], kier [x, y, z] (jednostkowy), wysokosc(x, z) → y | null, { yMax, maxKm }) → [x, y, z] | null —
     marsz promienia po rzeźbie (układ sceny: km, y = km × przewyższenie): odcinek między płaszczyzną yMax (szczyt rzeźby)
     a taflą y = 0 (albo maxKm) w KROKI_MARSZU równych krokach, potem połowienie przedziału z trafieniem (krok maleje
     2× na krok) — razem ≤ KROKI (64) odczytów wysokości, z odczytem w punkcie trafienia. Trafienie w wodę (wysokość ≤ 0 albo poza danymi) → null:
     promień, który dochodzi do tafli, nie dotyka skały. */
(function (root) {
  var MORZE_OTWARTE = 0.35, TON = 0.2, TON_DALEKO = 0.08, WIATR_PODLOGA = 0.2;
  var KROKI = 64, KROKI_MARSZU = 46;
  var BAZALT = { czest: 900, wybrzmienie: 0.25, szum: 0.35 };
  var FONOLIT = { czest: 1800, wybrzmienie: 0.9, szum: 0.15 };
  var GLUCHA = { czest: 300, wybrzmienie: 0.08, szum: 0.8 };

  function clamp01(x) { return x > 0 ? (x < 1 ? x : 1) : 0; }       // NaN → 0
  function gladko(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function liczba(x, d) { return typeof x === 'number' && x === x ? x : d; }

  function poziomy(o) {
    o = o || {};
    var odlB = liczba(o.odlBrzeguKm, 1e9), wys = liczba(o.wysM, 0), odlK = liczba(o.odlKameryKm, 1e9), eksp = clamp01(liczba(o.ekspozycja, 0));
    var brzeg = 1 - gladko(0, 6, odlB);
    if (o.naMorzu) brzeg = Math.max(brzeg, MORZE_OTWARTE);
    var morze = brzeg * (0.3 + 0.7 * eksp);
    var wiatr = WIATR_PODLOGA + (1 - WIATR_PODLOGA) * gladko(1500, 3000, wys);
    var pomruk = 0, ton = TON;
    if (o.kalima) { morze *= 0.6; wiatr *= 0.6; pomruk += 0.2; }
    var bliskosc = 1 - gladko(20, 120, odlK);
    return { wiatr: clamp01(wiatr * bliskosc), morze: clamp01(morze * bliskosc), pomruk: clamp01(pomruk * bliskosc), ton: clamp01(Math.max(TON_DALEKO, ton * bliskosc)) };
  }

  function kopia(b) { return { czest: b.czest, wybrzmienie: b.wybrzmienie, szum: b.szum }; }
  function brzmienie(id, jednostki) {
    var lista = jednostki || (root.GeologiaTeneryfa && root.GeologiaTeneryfa.jednostki) || [];
    var j = null;
    for (var i = 0; i < lista.length; i++) if (lista[i] && lista[i].id === id) { j = lista[i]; break; }
    var skaly = (j && j.skaly || []).join(' | ').toLowerCase();
    if (/fonolit/.test(skaly)) return kopia(FONOLIT);
    if (/pumeks|piroklast/.test(skaly)) return kopia(GLUCHA);
    return kopia(BAZALT);
  }

  function punktNaTerenie(s, d, wysokosc, opcje) {
    var op = opcje || {}, yMax = liczba(op.yMax, 6), maxKm = liczba(op.maxKm, 2000);
    if (!(s[1] > 0)) return null;                              // kamera pod taflą (woda szklana) — nie stukamy w dno
    // początek: gdzie promień schodzi pod yMax (wyżej rzeźby nie ma); koniec: tafla y = 0 albo maxKm
    var ta = 0, tb = maxKm;
    if (s[1] > yMax) { if (!(d[1] < 0)) return null; ta = (s[1] - yMax) / -d[1]; }
    if (d[1] < 0) tb = Math.min(tb, s[1] / -d[1]);
    if (!(tb > ta)) return null;
    var pod = function (t) {                                   // promień w t pod powierzchnią (lądem albo taflą)?
      var x = s[0] + d[0] * t, zz = s[2] + d[2] * t, h = wysokosc(x, zz);
      return s[1] + d[1] * t <= (h == null ? 0 : Math.max(h, 0));
    };
    var krok = (tb - ta) / KROKI_MARSZU, t0 = ta, t1 = -1, n = 0;
    for (var i = 1; i <= KROKI_MARSZU; i++) {
      var t = ta + krok * i; n++;
      if (pod(t)) { t1 = t; break; }
      t0 = t;
    }
    if (t1 < 0) return null;
    while (n < KROKI - 1) { var tm = (t0 + t1) / 2; n++; if (pod(tm)) t1 = tm; else t0 = tm; }
    var x = s[0] + d[0] * t1, zz = s[2] + d[2] * t1, h = wysokosc(x, zz);
    if (h == null || !(h > 0)) return null;                    // trafiona tafla, nie ląd
    return [x, s[1] + d[1] * t1, zz];
  }

  var api = { poziomy: poziomy, brzmienie: brzmienie, punktNaTerenie: punktNaTerenie, KROKI: KROKI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GeologiaPejzaz = api;
})(typeof window !== 'undefined' ? window : globalThis);
