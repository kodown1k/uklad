'use strict';
/* Zakładka Geologia — mapa horyzontu makiety (Task A3: cienie terenu i cień Teide). Czysta matematyka, bez DOM/THREE;
   dual-export (przeglądarka: window.GeologiaHoryzont, node: module.exports). Mapę liczy raz generator
   (scripts/gen-horyzont-teneryfy.mjs → geologia/teneryfa/horyzont-0/1.png + horyzont.json); strona tylko ją wczytuje.
   Układ jak siatki poziomów sceny (geologia/scena.js): wiersz 0 = północ, +x wschód, +z (wiersze) południe, dx/dz w km.
   KIERUNKI = 8 — azymuty AZYMUTY (0°, 45°, …, 315°, od północy zgodnie z ruchem wskazówek, jak GeologiaSlonce.slonce).
   katy(wys [m], w, h, dx, dz, { obserwatorM?, zasiegKm = 40 }) → Uint8Array(w·h·8), komórka i, kierunek k: [i·8 + k] =
     kąt elewacji horyzontu (°, 0…45 → 0…255, ujemny → 0) widziany z max(wys, 0) — albo z obserwatorM (strop chmur;
     komórki z wys ≥ obserwatorM → 0). Marsz po linii siatki w kierunku k (wiersz, kolumna albo przekątna — azymut
     przekątnej = atan(dx/dz), dla rzeźby Teneryfy 45° ± 0,01°) odcinkami rosnącymi geometrycznie: pierwszy = jedna
     komórka (dx), każdy następny × KROK_WZROST (1,15), do zasiegKm. Z odcinka bierzemy NAJWYŻSZĄ komórkę (tablica rzadka
     maksimów, zapytanie O(1)) i jej dokładną odległość — wąski szczyt nie przepada między próbkami, a kąt nie skacze
     z położeniem obserwatora. Krzywizna Ziemi: spadek d²/(2R) (bez refrakcji).
   zasloniecie(katy8, i, azSlonca, elSlonca) [°] → [0, 1] (1 = cień): kąt horyzontu w azymucie Słońca interpolowany
     liniowo między sąsiednimi kierunkami, 1 − smoothstep(kąt − 2°, kąt + 2°, el) — ta sama formuła w GLSL (GLSL niżej).
   cienTeide(dataMs[, lonLat]) → { rano, wieczor } [ms]: chwile wschodu i zachodu Słońca (el = 0, geometrycznie) nad Teide
     (GeologiaTeneryfa.czesci 'teide') z GeologiaSlonce.slonce, szukane bisekcją w dniu wyspy (GeologiaSlonce.czasWyspy)
     — wtedy cień Teide jest najdłuższy. chwileCienia(dataMs[, lonLat]) — to samo dla Słońca EL_CIENIA = 2° nad horyzontem
     (R13: najdłuższy WIDOCZNY cień — przycisk „Cień Teide”), chwileSlonca(dataMs, el°[, lonLat]) — dowolna wysokość.
   Cień Teide na morzu i stropie chmur (R13): model stożka — cienStozka(px, pz, ph, azSlonca, elSlonca, stozek) → [0, 1]
     z miękką krawędzią (marginesStozka — zapas w km), ta sama formuła w GLSL_STOZEK; stożek mierzy stozekZRzezby (generator
     → horyzont.json.stozekTeide). Mapa 8 kierunków zostaje dla cieni własnych terenu (GLSL_MAPA). POSWIATA — o ile cień
     przy niskim Słońcu gasi poświatę tafli i stropu (dobrane pomiarem sondy `--tylko klin`).
   PNG (przeglądarka bez zarządzania kolorem — bajty kanału alfa nie przechodzą przez kanwę, która mnoży je przez alfę):
     rozbierzPng(bajty) → { w, h, bpp, idat, inne }, odfiltrujPng(rozpakowane IDAT, w, h, bpp) → RGBA, suma(bajty) — suma
     kontrolna z horyzont.json; zPng(rgba0, rgba1, rgbaChmur, w, h, chmury) → katy8 (horyzont-0/1: kierunki 0–3 / 4–7
     w RGBA; wariant `chmury` — jeden obraz 2w × h, lewa połowa 0–3, prawa 4–7 — dziś nieużywany), doPng — odwrotność. */
(function (root) {
  var KIERUNKI = 8, KAT_MAKS = 45, PASMO = 2, KROK_WZROST = 1.15, ZASIEG_KM = 40, R_ZIEMI_KM = 6371;
  var AZYMUTY = [0, 45, 90, 135, 180, 225, 270, 315];
  var DEG = 180 / Math.PI;
  // kierunki w siatce (x na wschód, y na południe): N, NE, E, SE, S, SW, W, NW
  var KROKI = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

  function gladko(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

  // Rodzina linii siatki o kierunku (sx, sy): wszystkie komórki ułożone linia po linii w kolejności rosnącej pozycji;
  // poz[i] = miejsce komórki i w tym ułożeniu, pocz[p] / koniec[p] = pierwsze miejsce linii / pierwsze za nią.
  function rodzina(w, h, sx, sy) {
    var n = w * h, kol = new Int32Array(n), poz = new Int32Array(n), pocz = new Int32Array(n), koniec = new Int32Array(n), p = 0;
    function linia(x, y) {
      var p0 = p;
      while (x >= 0 && x < w && y >= 0 && y < h) { var i = y * w + x; kol[p] = i; poz[i] = p; p++; x += sx; y += sy; }
      for (var q = p0; q < p; q++) { pocz[q] = p0; koniec[q] = p; }
    }
    var x, y;
    if (sy === 0) for (y = 0; y < h; y++) linia(0, y);                         // wiersze, na wschód
    else if (sx === 0) for (x = 0; x < w; x++) linia(x, 0);                    // kolumny, na południe
    else if (sx === sy) { for (y = h - 1; y >= 0; y--) linia(0, y); for (x = 1; x < w; x++) linia(x, 0); }   // na SE
    else { for (y = 0; y < h; y++) linia(0, y); for (x = 1; x < w; x++) linia(x, h - 1); }                  // na NE
    return { kol: kol, poz: poz, pocz: pocz, koniec: koniec };
  }
  // Tablica rzadka maksimów wzdłuż ułożenia rodziny: poziom j, miejsce p → indeks komórki najwyższej w [p, p + 2^j − 1]
  // (tylko w obrębie linii; za końcem linii wpis nieużywany).
  function tablicaMaksimow(R, wys) {
    var n = R.kol.length, poz = [new Int32Array(R.kol)];
    for (var j = 1; (1 << j) <= n; j++) {
      var pop = poz[j - 1], cur = new Int32Array(n), pol = 1 << (j - 1), ok = false;
      for (var p = 0; p < n; p++) {
        if (p + (1 << j) <= R.koniec[p]) { var a = pop[p], b = pop[p + pol]; cur[p] = wys[b] > wys[a] ? b : a; ok = true; }
        else cur[p] = pop[p];
      }
      if (!ok) break;
      poz.push(cur);
    }
    return poz;
  }

  function katy(wys, w, h, dx, dz, o) {
    o = o || {};
    var zasieg = o.zasiegKm > 0 ? o.zasiegKm : ZASIEG_KM, obs = o.obserwatorM != null && isFinite(o.obserwatorM) ? +o.obserwatorM : null;
    var n = w * h, wynik = new Uint8Array(n * KIERUNKI), log2 = new Uint8Array(Math.max(w, h) + 2);
    for (var q = 2; q < log2.length; q++) log2[q] = log2[q >> 1] + 1;
    var rodziny = {};
    for (var k = 0; k < KIERUNKI; k++) {
      var sx = KROKI[k][0], sy = KROKI[k][1];
      // rodzina linii wspólna dla kierunku i przeciwnego (znak = zwrot względem ułożenia rodziny)
      var klucz = sy === 0 ? 'w' : sx === 0 ? 'k' : sx === sy ? 'p' : 'q', znak = (sy === 0 ? sx : sx === 0 ? sy : sx);
      if (!rodziny[klucz]) {
        var R = rodzina(w, h, sy === 0 ? 1 : sx === 0 ? 0 : 1, sy === 0 ? 0 : sx === 0 ? 1 : sx === sy ? 1 : -1);
        R.tab = tablicaMaksimow(R, wys);
        rodziny[klucz] = R;
      }
      var Rd = rodziny[klucz], tab = Rd.tab, poz = Rd.poz, pocz = Rd.pocz, koniec = Rd.koniec;
      var krok = sy === 0 ? dx : sx === 0 ? dz : Math.sqrt(dx * dx + dz * dz);
      // odcinki marszu w komórkach od obserwatora: [a, b], pierwszy jedna komórka, kolejne dłuższe × KROK_WZROST
      var odc = [], e = 0, s = krok, jMax = Math.floor(zasieg / krok + 1e-9);
      while (true) {
        var a = Math.floor(e / krok + 1e-9) + 1, b = Math.min(Math.floor((e + s) / krok + 1e-9), jMax);
        if (a > jMax) break;
        if (b >= a) odc.push(a, b);
        e += s; s *= KROK_WZROST;
      }
      for (var i = 0; i < n; i++) {
        var hi = wys[i], h0;
        if (obs != null) { if (hi >= obs) continue; h0 = obs / 1000; } else h0 = (hi > 0 ? hi : 0) / 1000;
        var p = poz[i], kon = koniec[p], p0 = pocz[p], najl = 0, jest = false;
        for (var m = 0; m < odc.length; m += 2) {
          var lo, hi2;
          if (znak > 0) { lo = p + odc[m]; hi2 = p + odc[m + 1]; if (lo >= kon) break; if (hi2 >= kon) hi2 = kon - 1; }
          else { hi2 = p - odc[m]; lo = p - odc[m + 1]; if (hi2 < p0) break; if (lo < p0) lo = p0; }
          var j = log2[hi2 - lo + 1], ca = tab[j][lo], cb = tab[j][hi2 - (1 << j) + 1], c = wys[cb] > wys[ca] ? cb : ca;
          var d = Math.abs(poz[c] - p) * krok, t = (wys[c] / 1000 - h0 - d * d / (2 * R_ZIEMI_KM)) / d;
          if (!jest || t > najl) { najl = t; jest = true; }
        }
        if (jest && najl > 0) {
          var kat = Math.atan(najl) * DEG;
          wynik[i * KIERUNKI + k] = Math.round(Math.min(kat, KAT_MAKS) / KAT_MAKS * 255);
        }
      }
    }
    return wynik;
  }

  function zasloniecie(k8, i, az, el) {
    var f = ((az % 360) + 360) % 360 / 45, k0 = Math.floor(f), w = f - k0;
    k0 %= KIERUNKI;
    var k1 = (k0 + 1) % KIERUNKI;
    var kat = (k8[i * KIERUNKI + k0] * (1 - w) + k8[i * KIERUNKI + k1] * w) * KAT_MAKS / 255;
    return 1 - gladko(kat - PASMO, kat + PASMO, el);
  }

  // GLSL mapy (teren): ta sama formuła (azymut i wysokość Słońca w uSlonceAzEl [rad]); wagi kierunków liczone wektorowo —
  // bez indeksowania zmienną (WebGL1). Mapa w prostokącie uProstHor (x0, z0, x1, z1 w km sceny), uRozmHor = (w, h) siatki;
  // uHor0 — kierunki 0–3, uHor1 — 4–7. Poza mapą 0; przy jej krawędzi cień gaśnie na 6 km. uCienieHor = 0 — bez odczytu
  // tekstur. GLSL_SLONCE (deklaracje wspólne) idzie przed GLSL_MAPA i GLSL_STOZEK.
  var GLSL_SLONCE = 'uniform vec2 uSlonceAzEl; uniform float uCienieHor;';
  var GLSL_MAPA = [
    'uniform sampler2D uHor0; uniform sampler2D uHor1; uniform vec4 uProstHor; uniform vec2 uRozmHor;',
    'float geZaslonHor(vec2 xz) {',
    '  if (uCienieHor < 0.5) return 0.0;',
    '  vec2 geE = min(xz - uProstHor.xy, uProstHor.zw - xz);',
    '  float geBrz = smoothstep(0.0, 6.0, min(geE.x, geE.y));',
    '  if (geBrz <= 0.0) return 0.0;',
    '  vec2 geF = (xz - uProstHor.xy) / (uProstHor.zw - uProstHor.xy);',
    '  vec2 geUvH = (geF * (uRozmHor - 1.0) + 0.5) / uRozmHor;',
    '  vec4 geA = texture2D(uHor0, geUvH), geB = texture2D(uHor1, geUvH);',
    '  float geK = mod(uSlonceAzEl.x / 0.7853981634, 8.0);',
    '  vec4 geW0 = max(1.0 - abs(mod(geK - vec4(0.0, 1.0, 2.0, 3.0) + 4.0, 8.0) - 4.0), 0.0);',
    '  vec4 geW1 = max(1.0 - abs(mod(geK - vec4(4.0, 5.0, 6.0, 7.0) + 4.0, 8.0) - 4.0), 0.0);',
    '  float geKat = (dot(geA, geW0) + dot(geB, geW1)) * ' + KAT_MAKS.toFixed(1) + ';',
    '  float geEl = uSlonceAzEl.y * 57.29577951;',
    '  return (1.0 - smoothstep(geKat - ' + PASMO.toFixed(1) + ', geKat + ' + PASMO.toFixed(1) + ', geEl)) * geBrz;',
    '}'
  ].join('\n');

  /* ---------- cień Teide: stożek (R13) ---------- */
  // Stożek S = { x, z [km sceny], h [km, wierzchołek], hb [km, podstawa pomiaru], k = promień / wysokość }. Punkt
  // P = (px, pz) na wysokości ph [km] (morze 0, strop chmur STROP_CHMUR_KM) jest w cieniu, gdy promień z P ku Słońcu
  // (poziomo s = (sin az, −cos az), w górę m = tan el na km) przecina stożek. Stożek ciągnie się poniżej hb tym samym
  // zboczem aż do ph: hb wyznacza tylko nachylenie (pomiar sylwetki nad dnem kaldery). Ucięty na hb dawałby na morzu klin
  // „wiszący” — przy el 2° zaczynałby się dopiero 64 km za Teide, a bliżej cień rzuca masyw pod kalderą. Wzdłuż promienia
  // zapas f(t) = k·(h − ph − m·t) − odległość osi stożka od punktu promienia jest wklęsły; maksimum w t* = wzd −
  // k·m·pop/√(1 − k²m²) (wzd, pop — odległość osi wzdłuż i w poprzek promienia), t ≥ 0, a przy k·m ≥ 1 (Słońce wyżej niż
  // zbocze) w t = 0. Zapas w t* = k(h − ph − m·wzd) − pop·√(1 − k²m²): granica cienia jest liniowa w wzd i pop — klin
  // trójkątny długości ≈ (h − ph)/tan el. Krzywizna Ziemi: m + max(wzd, 0)/(2R) (spadek t²/2R
  // zlinearyzowany w t = wzd). Miękka krawędź: półcień ±(0,2 km + 0,0093·t) (tarcza Słońca 0,53°). Słońce pod horyzontem:
  // cień gaśnie między el 0,5° a −1° (bez Słońca nie ma czym rzucać; klin byłby nieskończony).
  var R_KM = R_ZIEMI_KM, POLCIEN = [0.2, 0.0093], EL_MIN = 0.1;
  function marginesStozka(px, pz, ph, az, el, S) {
    var A = az * Math.PI / 180, sx = Math.sin(A), sz = -Math.cos(A), Dx = S.x - px, Dz = S.z - pz;
    var wzd = Dx * sx + Dz * sz, pop = Math.abs(Dx * sz - Dz * sx);
    var m = Math.tan(Math.max(el, EL_MIN) * Math.PI / 180) + Math.max(wzd, 0) / (2 * R_KM);
    var km = S.k * m, t = 0;
    if (km < 1) t = Math.max(wzd - km * pop / Math.sqrt(1 - km * km), 0);
    return { m: S.k * (S.h - ph - m * t) - Math.sqrt((t - wzd) * (t - wzd) + pop * pop), t: t };
  }
  function cienStozka(px, pz, ph, az, el, S) {
    if (!S || !(S.k > 0) || !isFinite(el) || !isFinite(az)) return 0;
    var r = marginesStozka(px, pz, ph, az, el, S), w = POLCIEN[0] + POLCIEN[1] * Math.max(r.t, 0);
    if (!isFinite(r.m)) return 0;
    return gladko(-w, w, r.m) * gladko(-1, 0.5, el);
  }
  // Wymiar stożka z rzeźby (generator): wierzchołek = najwyższa komórka siatki; dla poziomów co 50 m od szczytu w dół —
  // spójny obszar nad poziomem zawierający szczyt (Teide z Pico Viejo) i jego promień równoważny √(A/π). Podstawa hb =
  // najniższy poziom, zanim obszar się rozleje (zasięg od szczytu skacze ponad 2× — wtedy łączy się z dnem i ścianą
  // kaldery Las Cañadas). k — najmniejsze kwadraty r(h) = k·(h_max − h) na poziomach od hb do 100 m pod szczytem.
  function stozekZRzezby(wys, w, h, dx, dz, x0, z0) {
    var im = 0, i;
    for (i = 1; i < w * h; i++) if (wys[i] > wys[im]) im = i;
    var ix = im % w, iy = (im - ix) / w, H = wys[im], poziomy = [], hb = null, poprz = null;
    for (var lv = Math.floor(H / 50) * 50 - 50; lv > 0; lv -= 50) {
      var seen = new Uint8Array(w * h), st = [im], n = 0, maxd = 0;
      seen[im] = 1;
      while (st.length) {
        var c = st.pop(), x = c % w, y = (c - x) / w; n++;
        var d = Math.sqrt((x - ix) * (x - ix) * dx * dx + (y - iy) * (y - iy) * dz * dz); if (d > maxd) maxd = d;
        var sas = [c - 1, c + 1, c - w, c + w], ok = [x > 0, x < w - 1, y > 0, y < h - 1];
        for (var q = 0; q < 4; q++) if (ok[q] && !seen[sas[q]] && wys[sas[q]] >= lv) { seen[sas[q]] = 1; st.push(sas[q]); }
      }
      if (poprz && maxd > 2 * poprz.maxd && poprz.maxd > 1) { hb = poprz.lv; break; }
      poprz = { lv: lv, maxd: maxd, r: Math.sqrt(n * dx * dz / Math.PI) };
      poziomy.push(poprz);
    }
    if (hb == null) return null;
    var sl = 0, sm = 0;
    poziomy.forEach(function (p) { if (p.lv >= hb && p.lv <= H - 100) { sl += p.r * (H - p.lv); sm += (H - p.lv) * (H - p.lv); } });
    var kNaM = sl / sm;                     // km promienia na metr wysokości
    return { x: x0 + ix * dx, z: z0 + iy * dz, h: H / 1000, hb: hb / 1000, k: kNaM * 1000, r: kNaM * (H - hb),
      ix: ix, iy: iy, poziomy: poziomy.map(function (p) { return [p.lv, +p.r.toFixed(3), +p.maxd.toFixed(2)]; }) };
  }
  // Ten sam rachunek w GLSL. Kontrast „poświaty”: przy niskim Słońcu (el < 15°, pełny poniżej 4°) cień gasi też złotą
  // poświatę tafli i stropu (barwa razy 1 − POSWIATA·cień) — bez niej cień na wodzie to tylko człon 0,45·k·sin el.
  var POSWIATA = { woda: 0.45, chmury: 0.62 }, NISKO = [4, 15];
  var GLSL_STOZEK = [
    'uniform vec4 uStozek;',
    'float geCienStozka(vec2 xz, float ph) {',
    '  if (uCienieHor < 0.5 || uStozek.w <= 0.0) return 0.0;',
    '  float geEl = uSlonceAzEl.y * 57.29577951;',
    '  float geZn = smoothstep(-1.0, 0.5, geEl);',
    '  if (geZn <= 0.0) return 0.0;',
    '  vec2 geS = vec2(sin(uSlonceAzEl.x), -cos(uSlonceAzEl.x)), geD = uStozek.xy - xz;',
    '  float geWzd = dot(geD, geS), gePop = abs(geD.x * geS.y - geD.y * geS.x);',
    '  float geM = tan(max(geEl, ' + EL_MIN.toFixed(2) + ') * 0.01745329252) + max(geWzd, 0.0) / ' + (2 * R_KM).toFixed(1) + ';',
    '  float geKm = uStozek.w * geM, geT = 0.0;',
    '  if (geKm < 1.0) geT = max(geWzd - geKm * gePop / sqrt(1.0 - geKm * geKm), geT);',
    '  float geMar = uStozek.w * (uStozek.z - ph - geM * geT) - length(vec2(geT - geWzd, gePop));',
    '  float geW = ' + POLCIEN[0].toFixed(2) + ' + ' + POLCIEN[1].toFixed(4) + ' * max(geT, 0.0);',
    '  return smoothstep(-geW, geW, geMar) * geZn;',
    '}',
    'float geNiskoSlonce() { return 1.0 - smoothstep(' + NISKO[0].toFixed(1) + ', ' + NISKO[1].toFixed(1) + ', uSlonceAzEl.y * 57.29577951); }'
  ].join('\n');

  /* ---------- chwile Słońca nad Teide w dniu wyspy ---------- */
  var EL_CIENIA = 2;            // najdłuższy WIDOCZNY cień (R13): Słońce 2° nad horyzontem
  function modulSlonca() { return root.GeologiaSlonce || (typeof require === 'function' ? require('./slonce.js') : null); }
  function lonLatTeide() {
    var D = root.GeologiaTeneryfa || (typeof require === 'function' && typeof module !== 'undefined' ? require('./teneryfa/dane.js') : null);
    var t = D && (D.czesci || []).filter(function (c) { return c.id === 'teide'; })[0];
    return t ? t.lonLat : null;
  }
  // chwile, w których Słońce przechodzi przez wysokość `cel` [°] rano (w górę) i wieczorem (w dół) w dniu wyspy chwili ms:
  // skan co 15 min od 00:00 do 23:59 (msGodzinyWyspy — dzień zmiany czasu też), zawężenie bisekcją
  function chwileSlonca(ms, cel, lonLat) {
    var S = modulSlonca(), ll = lonLat || lonLatTeide(), wynik = { rano: NaN, wieczor: NaN };
    if (!S || !ll || !isFinite(ms)) return wynik;
    var el = function (t) { return S.slonce(t, ll[1], ll[0]).el - cel; };
    var t0 = S.msGodzinyWyspy(ms, 0), t1 = S.msGodzinyWyspy(ms, 1439) + 60000, KROK = 15 * 60000;
    function bisekcja(a, b, ea) {
      for (var n = 0; n < 32; n++) { var m = (a + b) / 2, em = el(m); if ((em > 0) === (ea > 0)) { a = m; ea = em; } else b = m; }
      return Math.round((a + b) / 2);
    }
    var tp = t0, ep = el(t0);
    for (var t = t0 + KROK; tp < t1; t += KROK) {
      var tt = Math.min(t, t1), e = el(tt);
      if (ep <= 0 && e > 0 && !isFinite(wynik.rano)) wynik.rano = bisekcja(tp, tt, ep);
      if (ep > 0 && e <= 0 && isFinite(wynik.rano) && !isFinite(wynik.wieczor)) wynik.wieczor = bisekcja(tp, tt, ep);
      tp = tt; ep = e;
    }
    return wynik;
  }
  // wschód i zachód (el = 0) — wtedy cień Teide jest najdłuższy
  function cienTeide(ms, lonLat) { return chwileSlonca(ms, 0, lonLat); }
  // Słońce EL_CIENIA nad horyzontem — najdłuższy cień, który jeszcze widać (przycisk „Cień Teide”)
  function chwileCienia(ms, lonLat) { return chwileSlonca(ms, EL_CIENIA, lonLat); }

  /* ---------- PNG ---------- */
  function rozbierzPng(u) {
    var dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    if (dv.getUint32(0) !== 0x89504e47) throw new Error('to nie PNG');
    var pos = 8, w = 0, h = 0, bpp = 0, czesci = [], dl = 0, inne = [];
    while (pos + 8 <= u.length) {
      var len = dv.getUint32(pos), nazwa = String.fromCharCode(u[pos + 4], u[pos + 5], u[pos + 6], u[pos + 7]);
      if (nazwa === 'IHDR') {
        w = dv.getUint32(pos + 8); h = dv.getUint32(pos + 12);
        var gl = u[pos + 16], typ = u[pos + 17], przeplot = u[pos + 20];
        if (gl !== 8 || (typ !== 2 && typ !== 6) || przeplot !== 0) throw new Error('PNG: obsługiwane tylko 8 bit, typ koloru 2/6, bez przeplotu');
        bpp = typ === 6 ? 4 : 3;
      } else if (nazwa === 'IDAT') { czesci.push(u.subarray(pos + 8, pos + 8 + len)); dl += len; }
      else if (nazwa === 'IEND') break;
      else inne.push(nazwa);
      pos += 12 + len;
    }
    var idat = new Uint8Array(dl), o = 0;
    czesci.forEach(function (c) { idat.set(c, o); o += c.length; });
    return { w: w, h: h, bpp: bpp, idat: idat, inne: inne };
  }
  function odfiltrujPng(raw, w, h, bpp) {
    var stride = w * bpp;
    if (raw.length !== h * (stride + 1)) throw new Error('PNG: obcięty lub uszkodzony strumień (' + raw.length + ' B zamiast ' + h * (stride + 1) + ')');
    var cur = new Uint8Array(stride), prev = new Uint8Array(stride), rgba = new Uint8Array(w * h * 4);
    for (var y = 0; y < h; y++) {
      var f = raw[y * (stride + 1)], o = y * (stride + 1) + 1;
      for (var i = 0; i < stride; i++) {
        var x = raw[o + i], a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0, p;
        if (f === 0) p = 0; else if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
        else if (f === 4) { var pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        else throw new Error('PNG: nieznany filtr ' + f);
        cur[i] = (x + p) & 255;
      }
      for (var k = 0; k < w; k++) {
        var d = (y * w + k) * 4;
        rgba[d] = cur[k * bpp]; rgba[d + 1] = cur[k * bpp + 1]; rgba[d + 2] = cur[k * bpp + 2]; rgba[d + 3] = bpp === 4 ? cur[k * bpp + 3] : 255;
      }
      var t = prev; prev = cur; cur = t;
    }
    return rgba;
  }
  function suma(b) { var s = 0x811c9dc5; for (var i = 0; i < b.length; i++) s = Math.imul(s ^ b[i], 16777619) >>> 0; return s; }
  // katy8 ↔ obrazy RGBA: chmury — jeden obraz 2w × h (lewa połowa kierunki 0–3, prawa 4–7), teren — dwa w × h
  function doPng(k8, w, h, chmury) {
    var n = w * h;
    if (chmury) {
      var c = new Uint8Array(n * 8);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) for (var k = 0; k < 8; k++) c[((y * 2 * w) + (k < 4 ? x : w + x)) * 4 + (k & 3)] = k8[(y * w + x) * 8 + k];
      return [c];
    }
    var a = new Uint8Array(n * 4), b = new Uint8Array(n * 4);
    for (var i = 0; i < n; i++) for (var kk = 0; kk < 4; kk++) { a[i * 4 + kk] = k8[i * 8 + kk]; b[i * 4 + kk] = k8[i * 8 + 4 + kk]; }
    return [a, b];
  }
  function zPng(r0, r1, rch, w, h, chmury) {
    var n = w * h, k8 = new Uint8Array(n * 8);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) for (var k = 0; k < 8; k++) {
      var i = y * w + x;
      k8[i * 8 + k] = chmury ? rch[((y * 2 * w) + (k < 4 ? x : w + x)) * 4 + (k & 3)] : (k < 4 ? r0 : r1)[i * 4 + (k & 3)];
    }
    return k8;
  }

  var api = { KIERUNKI: KIERUNKI, AZYMUTY: AZYMUTY, KAT_MAKS: KAT_MAKS, PASMO: PASMO, KROK_WZROST: KROK_WZROST, ZASIEG_KM: ZASIEG_KM,
    katy: katy, zasloniecie: zasloniecie, cienTeide: cienTeide, chwileCienia: chwileCienia, chwileSlonca: chwileSlonca, EL_CIENIA: EL_CIENIA,
    marginesStozka: marginesStozka, cienStozka: cienStozka, stozekZRzezby: stozekZRzezby, POSWIATA: POSWIATA, NISKO: NISKO,
    GLSL_SLONCE: GLSL_SLONCE, GLSL_MAPA: GLSL_MAPA, GLSL_STOZEK: GLSL_STOZEK,
    rozbierzPng: rozbierzPng, odfiltrujPng: odfiltrujPng, suma: suma, doPng: doPng, zPng: zPng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GeologiaHoryzont = api;
})(typeof window !== 'undefined' ? window : globalThis);
