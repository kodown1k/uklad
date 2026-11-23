'use strict';
/* Zakładka Geologia — Słońce nad wyspą, pora dnia i pogoda makiety (Task 8e). Czysta matematyka, bez DOM/THREE; dual-export
   (przeglądarka: window.GeologiaSlonce; w node wymaga ../ephemeris.js, w przeglądarce bierze window.Ephemeris ze strony).
   slonce(ms, lat, lon) → { az, el, dek } [°]: az od N przez E (jak GeologiaScena.kierunekSlonca), el geometryczna (bez refrakcji),
     dek = deklinacja. Jedno źródło pozycji: ephemeris.js — Ziemia z REAL_PLANETS (positionAt, ekliptyka J2000) → kierunek
     do Słońca = −r → precesja długości do równonocy daty (gmst z ephemeris.js liczy od równonocy daty) → równik (nachylenie
     ekliptyki) → kąt godzinny z gmst + długość → az/el. Błąd rzędu 0,01° (bez nutacji i aberracji).
   poraZeSlonca(el) → 'dzien' | 'zlota' | 'zmierzch' | 'noc' z progów PROGI_PORY (jedno miejsce; poranek i wieczór
     symetrycznie — preset 'swit' zostaje dla pokazu, gdzie jest strojony pod łunę erupcji).
   Czas wyspy (WET/WEST, strefa 'Atlantic/Canary' przez Intl.DateTimeFormat): czasWyspy(ms) → { rok, mies, dzien, min,
     przesuniecie_min }, msGodzinyWyspy(ms, min) → chwila UTC [ms] dla minuty `min` dnia wyspy, w którym leży `ms`.
   parametrySwiatla({ pora, az, el, pogoda }, PORY) → argument GeologiaScena.swiatlo: { pora, az, el, dostroj } — pogoda
     nałożona na porę (kalima = mgła i ochra presetu 'kalima' w jasności bieżącej pory: dzień = sam preset, noc = ciemny
     brąz); światło pory w makiecie ciągłe w el (kotwiceZmroku: złota godzina, zachód, zmierzch, noc z minimum MIN_NOCY_MAKIETY
     — pokaz tego nie używa, PORY bez zmian). Pogodnie / morze chmur = sama pora.
   etykietaPory(min, el) → „14:30 · Słońce 32° nad horyzontem”. */
(function (root) {
  var E = typeof module !== 'undefined' && module.exports ? require('../ephemeris.js') : root.Ephemeris;
  var DEG = Math.PI / 180;
  var ZIEMIA = E ? E.REAL_PLANETS.filter(function (p) { return p.id === 'earth'; })[0] : null;
  var STREFA = 'Atlantic/Canary';
  // Progi pory dnia [° wysokości Słońca], od góry; poniżej ostatniego — noc.
  var PROGI_PORY = [{ od: 12, pora: 'dzien' }, { od: 0, pora: 'zlota' }, { od: -6, pora: 'zmierzch' }];
  var POGODY = ['pogodnie', 'chmury', 'kalima'];
  // Światło makiety bez parametru `&pora=` (jak przed Task 8e): popołudniowe słońce z WSW.
  var STALE = { pora: 'dzien', az: 250, el: 30 };
  // Minimum nocy makiety: wypełnienie „księżycowe” — ląd czytelny (sonda: średnia lądu ≥ 20 sRGB przy el < −18°).
  // Tylko makieta; pokaz (ujęcia A2/A5) zostaje przy presecie 'noc'.
  var MIN_NOCY_MAKIETY = { wyp: 0x8a9cc4, f: 0.16 };
  // Odległość kamery od celu w ujęciu kalimy pokazu (opowiesc.js, kadr 'geografia/kalima': d 30 km) — skala mgły presetu.
  var ODL_KADRU_KALIMY = 30;
  // Zmierzch makiety (runda 1, I-1): światło jako ciągła funkcja wysokości Słońca między kotwicami — bez skoków na progach
  // pór (próg wybiera tylko nazwę presetu bazowego). Presety PORY są wspólne z pokazem i zostają nietknięte; makieta dostaje
  // różnicę przez `dostroj`. Kotwice niżej słabsze w wypełnieniu (luminancja wyp × f maleje monotonicznie: 0,23 przy el ≥ 20°,
  // 0,074 przy 6°, 0,059 przy 0°, 0,057 przy −6°, 0,053 nocą) i cieplejsze (złota godzina: wyp ochrowy, horyzont presetu
  // 'zlota'; zachód: klucz pomarańczowy). Powyżej KOTWICE_ZMROKU[0].el — sam 'dzien' (światło stałe el 30° bez dostrojenia).
  function kotwiceZmroku(P) {
    return [
      { el: 20, p: P.dzien },
      { el: 6, p: { klucz: P.zlota.klucz, k: P.zlota.k, wyp: 0xd9b48c, f: 0.15, zenit: P.zlota.zenit, horyzont: P.zlota.horyzont,
        tarcza: P.zlota.tarcza, moc: P.zlota.moc } },
      { el: 0, p: { klucz: 0xffa868, k: 0.7, wyp: 0xc8a088, f: 0.15, zenit: '#3e5880', horyzont: '#e0aa80', tarcza: '#ffc090', moc: 0.9 } },
      { el: -6, p: { klucz: P.zmierzch.klucz, k: P.zmierzch.k, wyp: P.zmierzch.wyp, f: 0.15, zenit: P.zmierzch.zenit,
        horyzont: P.zmierzch.horyzont, tarcza: P.zmierzch.tarcza, moc: P.zmierzch.moc } },
      { el: -12, p: { klucz: P.noc.klucz, k: P.noc.k, wyp: MIN_NOCY_MAKIETY.wyp, f: MIN_NOCY_MAKIETY.f, zenit: P.noc.zenit,
        horyzont: P.noc.horyzont, tarcza: P.noc.tarcza, moc: P.noc.moc } }
    ];
  }

  function slonce(ms, lat, lon) {
    var jd = E.julianDate(ms), r = E.positionAt(ZIEMIA, jd), T = (jd - 2451545.0) / 36525;
    var x = -r.x, y = -r.y, z = -r.z;                                // Słońce widziane z Ziemi, ekliptyka J2000
    var p = 1.396971 * T * DEG, cp = Math.cos(p), sp = Math.sin(p);  // precesja ogólna w długości → równonoc daty
    var xd = x * cp - y * sp, yd = x * sp + y * cp;
    var eps = (23.4392911 - 0.0130042 * T) * DEG, ce = Math.cos(eps), se = Math.sin(eps);
    var xe = xd, ye = yd * ce - z * se, ze = yd * se + z * ce;
    var ra = Math.atan2(ye, xe), dek = Math.atan2(ze, Math.hypot(xe, ye));
    var H = E.gmst(jd) + lon * DEG - ra, f = lat * DEG;
    var sinEl = Math.sin(f) * Math.sin(dek) + Math.cos(f) * Math.cos(dek) * Math.cos(H);
    var el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
    var az = Math.atan2(-Math.cos(dek) * Math.sin(H), Math.sin(dek) * Math.cos(f) - Math.cos(dek) * Math.cos(H) * Math.sin(f));
    az = (az / DEG + 360) % 360;
    return { az: az, el: el / DEG, dek: dek / DEG };
  }

  function poraZeSlonca(el) {
    for (var i = 0; i < PROGI_PORY.length; i++) if (el >= PROGI_PORY[i].od) return PROGI_PORY[i].pora;
    return 'noc';
  }

  /* ---------- czas wyspy ---------- */
  var fmt = null;
  function format() {
    if (!fmt) fmt = new Intl.DateTimeFormat('en-GB', { timeZone: STREFA, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
    return fmt;
  }
  function czasWyspy(ms) {
    var c = {};
    format().formatToParts(new Date(ms)).forEach(function (p) { if (p.type !== 'literal') c[p.type] = +p.value; });
    var h = c.hour % 24;
    var lok = Date.UTC(c.year, c.month - 1, c.day, h, c.minute, c.second);
    return { rok: c.year, mies: c.month, dzien: c.day, min: h * 60 + c.minute,
      przesuniecie_min: Math.round((lok - Math.floor(ms / 1000) * 1000) / 60000) };
  }
  function msGodzinyWyspy(ms, min) {
    var c = czasWyspy(ms), lok = Date.UTC(c.rok, c.mies - 1, c.dzien) + min * 60000;
    var t = lok - c.przesuniecie_min * 60000;
    t = lok - czasWyspy(t).przesuniecie_min * 60000;                   // zmiana czasu tego dnia: przesunięcie z chwili docelowej
    return t;
  }

  /* ---------- pora + pogoda → światło sceny ---------- */
  function hexRgb(h) {
    if (typeof h === 'number') return [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
    var s = String(h).replace('#', '');
    return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255];
  }
  function lin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function srgb(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  function luminancja(h) { var c = hexRgb(h).map(lin); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function rgbHex(c, jakLiczba) {
    var n = c.reduce(function (a, v) { return a * 256 + Math.round(Math.max(0, Math.min(1, v)) * 255); }, 0);
    return jakLiczba ? n : '#' + ('00000' + n.toString(16)).slice(-6);
  }
  // Barwa kalimy w jasności pory: odcień z presetu 'kalima', luminancja skalowana jak (pora / dzień) dla tego samego pola.
  function ochra(pole, P, pora) {
    var cK = P.kalima[pole], cP = P[pora][pole], cD = P.dzien[pole];
    var lD = luminancja(cD), k = lD > 0 ? luminancja(cP) / lD : 0;
    var c = hexRgb(cK).map(function (v) { return srgb(lin(v) * k); });
    return rgbHex(c, typeof cK === 'number');
  }
  var POLA_BARW = ['klucz', 'wyp', 'zenit', 'horyzont', 'tarcza'], POLA_MOCY = ['k', 'f', 'moc'];
  function mieszaj(a, b, t, jakLiczba) {
    var x = hexRgb(a), y = hexRgb(b);
    return rgbHex(x.map(function (v, i) { return srgb(lin(v) + (lin(y[i]) - lin(v)) * t); }), jakLiczba);
  }
  // Światło pory w makiecie: z wysokości Słońca (kotwice zmroku), bez el — sam preset (noc z minimum makiety).
  function swiatloPory(P, pora, el) {
    var K = kotwiceZmroku(P);
    if (!isFinite(el)) return pora === 'noc' ? K[K.length - 1].p : P[pora];
    if (el >= K[0].el) return P.dzien;
    if (el <= K[K.length - 1].el) return K[K.length - 1].p;
    var i = 0;
    while (el < K[i + 1].el) i++;
    var a = K[i], b = K[i + 1], t = (a.el - el) / (a.el - b.el), w = {};
    POLA_BARW.forEach(function (pole) { w[pole] = mieszaj(a.p[pole], b.p[pole], t, typeof P.dzien[pole] === 'number'); });
    POLA_MOCY.forEach(function (pole) { w[pole] = a.p[pole] + (b.p[pole] - a.p[pole]) * t; });
    return w;
  }
  function parametrySwiatla(o, P) {
    o = o || {};
    var pora = P[o.pora] ? o.pora : 'dzien', w = { pora: pora, az: o.az, el: o.el, dostroj: null }, d = {};
    var S = swiatloPory(P, pora, o.el == null ? NaN : +o.el), B = P[pora];
    POLA_BARW.concat(POLA_MOCY).forEach(function (pole) {
      var r = typeof S[pole] === 'number' && typeof B[pole] === 'number' ? Math.abs(S[pole] - B[pole]) > 1e-9 : String(S[pole]) !== String(B[pole]);
      if (r) d[pole] = S[pole];
    });
    if (o.pogoda === 'kalima') {
      var Q = {}; Object.keys(P).forEach(function (k) { Q[k] = P[k]; }); Q._ = S;     // ochra liczona od światła pory makiety
      POLA_BARW.forEach(function (pole) { d[pole] = ochra(pole, Q, '_'); });
      d.k = S.k * P.kalima.k / P.dzien.k;
      d.f = S.f * P.kalima.f / P.dzien.f;
      d.moc = S.moc * P.kalima.moc / P.dzien.moc;
      // mgła presetu w skali kadru: preset strojony w ujęciu kalimy pokazu z odległości ODL_KADRU_KALIMY — w makiecie te same
      // proporcje względem odległości kamery od celu (GeologiaScena: `mglaWzgl`), bez stałych km, które zakryłyby całą wyspę
      d.mgla = null;
      d.mglaWzgl = [P.kalima.mgla[0] / ODL_KADRU_KALIMY, P.kalima.mgla[1] / ODL_KADRU_KALIMY];
    }
    if (Object.keys(d).length) w.dostroj = d;
    return w;
  }

  function dwie(n) { return (n < 10 ? '0' : '') + n; }
  function godzinaTekst(min) { var m = Math.max(0, Math.min(1440, Math.round(min))); return dwie(Math.floor(m / 60)) + ':' + dwie(m % 60); }
  function etykietaPory(min, el) {
    var e = Math.round(el);
    return godzinaTekst(min) + ' · Słońce ' + Math.abs(e) + '° ' + (e >= 0 ? 'nad' : 'pod') + ' horyzontem';
  }

  var api = { slonce: slonce, poraZeSlonca: poraZeSlonca, PROGI_PORY: PROGI_PORY, POGODY: POGODY, STALE: STALE, STREFA: STREFA,
    MIN_NOCY_MAKIETY: MIN_NOCY_MAKIETY, kotwiceZmroku: kotwiceZmroku, swiatloPory: swiatloPory, ODL_KADRU_KALIMY: ODL_KADRU_KALIMY, czasWyspy: czasWyspy, msGodzinyWyspy: msGodzinyWyspy, parametrySwiatla: parametrySwiatla,
    luminancja: luminancja, godzinaTekst: godzinaTekst, etykietaPory: etykietaPory };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GeologiaSlonce = api;
})(typeof window !== 'undefined' ? window : globalThis);
