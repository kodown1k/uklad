'use strict';
/* Zakładka Geologia — smugi pasatu i piasek makiety (Task A2). Czysta matematyka i teksty shaderów, bez DOM/THREE;
   dual-export (przeglądarka: window.GeologiaWiatr, node: module.exports). SCHEMAT typowych warunków, nie pomiar:
   pasat z NE, bez danych na żywo i bez symulacji przepływu.
   Układ jak siatki poziomów sceny (geologia/scena.js): wiersz 0 = północ, +x wschód, +z południe, dx/dz w km; pozycje linii
   w km od narożnika NW siatki (scena przesuwa grupę o x0, z0 prostokąta wyspy).
   Konwencja kierunku: opcja `wiatr` = WIATR sceny — wektor (x, z), Z KTÓREGO wieje (jak nawietrznosc w scena.js).
   Powietrze płynie w stronę przeciwną: u = −wiatr. Pole i linie opisują ruch (dokąd), więc z dala od lądu pole = −wiatr.
   pole(wys [m], w, h, dx, dz, { wiatr = WIATR, promienKm = 6 }) → Float32Array(w·h·2): prędkość (vx, vz) w jednostkach
     prędkości bazowej. Rzeźba (morze = 0) wygładzona trzema przebiegami pudełkowymi (jak nawietrznosc, promień 6 km),
     gradient g [m/km], siła zbocza f = gładko((|g| − 4)/36) (progi nawietrznosc). Opływ: v = u − ODCHYL·f·max(0, u·ĝ)·ĝ — tam, gdzie zbocze
     rośnie z wiatrem, prędkość traci składową pod górę i skręca wzdłuż poziomic (oś nawietrzna: hamowanie do 1 − ODCHYL);
     zbocze równoległe do wiatru (flanka) przyspiesza: v · (1 + PRZYSP·f·(u × ĝ)²). Moduł obcięty do [0,1; 1,6].
   linie(pole, w, h, dx, dz, { n, punktow = 40, krokKm = 1.2 (R14), ziarno = 1, wys, zPoludnia = ∞, wiatr = WIATR })
     → { pozycje: Float32Array(n·punktow·3), s: Float32Array(n·punktow), piasek: Uint8Array(n), piasekOd: Int16Array(n),
         zanik: Float32Array(n·punktow) }; o.wys (Float32Array(w·h) wysokości siatki [m]) wymagane — teren, ląd, plaże.
     Start: losowanie z odrzuceniem (mulberry32(ziarno)) punktów morza, z których promień z wiatrem (u) trafia w ląd po
     5–15 km. Linia prądu RK2 (punkt środkowy) z krokiem czasu: wiatr bazowy przebywa w nim krokKm, więc krok geometryczny
     = krokKm·|v| (gęstsze punkty tam, gdzie wieje słabiej). s = droga wzdłuż linii w km przelotu wiatru bazowego
     (z dala od lądu = droga geometryczna) — puls w shaderze biegnie z prędkością powietrza: przed stożkiem kreski się
     zagęszczają i zwalniają, na flankach rozciągają. Wyjście poza siatkę zatrzymuje linię: ostatni punkt przypięty do
     krawędzi (ułamek kroku, s o tyle samo), reszta punktów = ostatni, s stałe.
     y = max(teren, 0) + 0,15 km (teren dwuliniowo z `wys`). piasek[i] = 1, gdy linia (4 próbki na odcinek) przechodzi
     nad lądem ≤ 30 m n.p.m. na południe od zPoludnia (z siatki dla 28,15° N); piasekOd[i] = indeks punktu za pierwszą
     plażą (−1 bez piasku) — barwa piaskowa i y + 0,03 km od tego punktu (R16: piasek z plaż, nie od startu na morzu).
     zanik (Float32Array(n·punktow), R16) = gładko(do końca linii / 4 km) · gładko(do brzegu siatki / 5 km) — mnożnik alfy.
   GLSL_VERT / GLSL_FRAG: kreska biegnąca — faza fract((s − uCzas·0,05)/1,2), głowa z ogonem, alfa ≤ ALFA_MAKS (delikatne). */
(function (root) {
  var WIATR = [Math.SQRT1_2, -Math.SQRT1_2];     // = scena.js WIATR (pasat z NE: kierunek, Z KTÓREGO wieje)
  var LICZBA = { lekka: 2000, pelna: 4000 };     // R4: telefon 2–4 tys. smug (spec A2), jakość „lekka” — dolna granica
  // ODCHYL 0,7: oś nawietrzna hamuje do 0,3 prędkości bazowej, a powietrze wciąż wchodzi nad niższe stoki (0,85 zbijało
  // wszystkie linie w jasny pas wzdłuż brzegu); progi siły zbocza jak w nawietrznosc sceny (4–40 m/km)
  var ODCHYL = 0.7, PRZYSP = 0.6, MOD_MIN = 0.1, MOD_MAX = 1.6;
  var SPAD = [4, 40];
  var START_KM = [5, 15], KROK_STARTU_KM = 0.25;
  // R14 (spec „smugi opływają wyspę”): krok 1,2 km przy 40 punktach — linia do ok. 48 km przelotu, sięga za wyspę po
  // zawietrznej (przy 0,6 km urywała się przy brzegu nawietrznym); ta sama liczba wierzchołków co 40 × 0,6
  var KROK_KM = 1.2;
  var GESTOSC_PIASKU = 4;                         // próbki plaży na odcinek linii (pas ≤ 30 m bywa węższy niż krok)
  var ZANIK_KONIEC_KM = 4, ZANIK_BRZEG_KM = 5;   // R16: płynne wygaszenie końca linii i pasa przy krawędzi siatki
  var Y_KM = 0.15, Y_PIASEK_KM = 0.03, PIASEK_M = 30, LAT_PIASKU = 28.15;
  var ALFA_MAKS = 0.35;

  function gladko(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function jednostkowy(a) { var l = Math.hypot(a[0], a[1]); return l > 1e-9 ? [a[0] / l, a[1] / l] : [WIATR[0], WIATR[1]]; }

  // Rozmycie pudełkowe w miejscu (sumy biegnące, brzeg przycięty), poziomo i pionowo — przebieg pionowy wierszami.
  function rozmyj(a, w, h, rx, rz, t) {
    var x, y, k, s, n, o;
    for (y = 0; y < h; y++) {
      o = y * w; s = 0; n = 0;
      for (k = 0; k <= rx && k < w; k++) { s += a[o + k]; n++; }
      for (x = 0; x < w; x++) {
        t[o + x] = s / n;
        if (x + rx + 1 < w) { s += a[o + x + rx + 1]; n++; }
        if (x - rx >= 0) { s -= a[o + x - rx]; n--; }
      }
    }
    var acc = new Float64Array(w);
    n = 0;
    for (k = 0; k <= rz && k < h; k++) { o = k * w; for (x = 0; x < w; x++) acc[x] += t[o + x]; n++; }
    for (y = 0; y < h; y++) {
      o = y * w;
      for (x = 0; x < w; x++) a[o + x] = acc[x] / n;
      if (y + rz + 1 < h) { var od = (y + rz + 1) * w; for (x = 0; x < w; x++) acc[x] += t[od + x]; n++; }
      if (y - rz >= 0) { var ou = (y - rz) * w; for (x = 0; x < w; x++) acc[x] -= t[ou + x]; n--; }
    }
  }

  function pole(wys, w, h, dx, dz, o) {
    o = o || {};
    var u = jednostkowy(o.wiatr || WIATR), ux = -u[0], uz = -u[1];          // kierunek płynięcia
    var promien = o.promienKm > 0 ? o.promienKm : 6;
    var N = w * h, a = new Float32Array(N), tmp = new Float32Array(N), out = new Float32Array(N * 2), i, x, y;
    for (i = 0; i < N; i++) a[i] = wys[i] > 0 ? wys[i] : 0;                // morze = 0; NaN też (porównanie fałszywe)
    var rx = Math.max(1, Math.round(promien / dx / 2)), rz = Math.max(1, Math.round(promien / dz / 2));
    for (var p = 0; p < 3; p++) rozmyj(a, w, h, rx, rz, tmp);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      var xa = Math.max(0, x - 1), xb = Math.min(w - 1, x + 1), ya = Math.max(0, y - 1), yb = Math.min(h - 1, y + 1);
      var gx = (a[y * w + xb] - a[y * w + xa]) / ((xb - xa) * dx), gz = (a[yb * w + x] - a[ya * w + x]) / ((yb - ya) * dz);
      var m = Math.hypot(gx, gz), vx = ux, vz = uz;
      var f = m > 1e-9 ? gladko((m - SPAD[0]) / (SPAD[1] - SPAD[0])) : 0;
      if (f > 0) {
        var nx = gx / m, nz = gz / m, c = ux * nx + uz * nz, sx = ux * nz - uz * nx;
        if (c > 0) { vx -= ODCHYL * f * c * nx; vz -= ODCHYL * f * c * nz; }
        var k = 1 + PRZYSP * f * sx * sx;
        vx *= k; vz *= k;
      }
      var vl = Math.hypot(vx, vz);
      if (!(vl > 1e-9)) { vx = ux * MOD_MIN; vz = uz * MOD_MIN; }
      else if (vl < MOD_MIN) { vx *= MOD_MIN / vl; vz *= MOD_MIN / vl; }
      else if (vl > MOD_MAX) { vx *= MOD_MAX / vl; vz *= MOD_MAX / vl; }
      out[i * 2] = vx; out[i * 2 + 1] = vz;
    }
    return out;
  }

  // mulberry32 — powtarzalny rozkład startów z ziarna
  function losowe(ziarno) {
    var t = (ziarno >>> 0) || 1;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function linie(pp, w, h, dx, dz, o) {
    o = o || {};
    var n = Math.max(0, Math.floor(o.n || 0)), P = Math.max(2, Math.floor(o.punktow || 40)), krok = o.krokKm > 0 ? o.krokKm : KROK_KM;
    var wys = o.wys, zPd = o.zPoludnia == null ? Infinity : o.zPoludnia;
    if (!wys || wys.length !== w * h) throw new Error('GeologiaWiatr.linie: brak wysokości siatki (o.wys)');
    var u = jednostkowy(o.wiatr || WIATR), ux = -u[0], uz = -u[1];
    var X1 = (w - 1) * dx, Z1 = (h - 1) * dz;
    var los = losowe(o.ziarno == null ? 1 : o.ziarno);
    function wewnatrz(x, z) { return x >= 0 && x <= X1 && z >= 0 && z <= Z1; }
    // ułamek kroku a → a + d, przy którym współrzędna wychodzi poza [0, M] (1, gdy nie wychodzi)
    function przeciecie(a, d, M) { return d > 0 && a + d > M ? (M - a) / d : d < 0 && a + d < 0 ? -a / d : 1; }
    // dwuliniowo w siatce (x, z w km); k = przesunięcie kanału, s = krok (1 — wysokość, 2 — pole)
    var bx = 0, bz = 0, btx = 0, btz = 0;
    function komorka(x, z) {
      var fx = x / dx, fz = z / dz;
      bx = Math.min(w - 2, Math.max(0, Math.floor(fx))); bz = Math.min(h - 2, Math.max(0, Math.floor(fz)));
      btx = Math.min(1, Math.max(0, fx - bx)); btz = Math.min(1, Math.max(0, fz - bz));
    }
    function teren(x, z) {
      komorka(x, z);
      var i = bz * w + bx, a = wys[i], b = wys[i + 1], c = wys[i + w], d = wys[i + w + 1];
      var v = (a * (1 - btx) + b * btx) * (1 - btz) + (c * (1 - btx) + d * btx) * btz;
      return v === v ? v : 0;
    }
    var vx = 0, vz = 0;
    function predkosc(x, z) {
      komorka(x, z);
      var i = (bz * w + bx) * 2, j = i + w * 2;
      vx = (pp[i] * (1 - btx) + pp[i + 2] * btx) * (1 - btz) + (pp[j] * (1 - btx) + pp[j + 2] * btx) * btz;
      vz = (pp[i + 1] * (1 - btx) + pp[i + 3] * btx) * (1 - btz) + (pp[j + 1] * (1 - btx) + pp[j + 3] * btx) * btz;
    }
    // starty: morze, ląd z wiatrem po 5–15 km
    var starty = [], proby = 0, maksProb = n * 400 + 1000;
    while (starty.length < n && proby < maksProb) {
      proby++;
      var x0 = los() * X1, z0 = los() * Z1;
      if (teren(x0, z0) > 0) continue;
      var d = null;
      for (var t = KROK_STARTU_KM; t <= START_KM[1] + 1e-9; t += KROK_STARTU_KM) {
        var xt = x0 + ux * t, zt = z0 + uz * t;
        if (!wewnatrz(xt, zt)) break;
        if (teren(xt, zt) > 0) { d = t; break; }
      }
      if (d != null && d >= START_KM[0]) starty.push(x0, z0);
    }
    var pozycje = new Float32Array(n * P * 3), s = new Float32Array(n * P), piasek = new Uint8Array(n);
    var piasekOd = new Int16Array(n).fill(-1), zanik = new Float32Array(n * P);
    var ns = starty.length / 2;
    function nadPlaza(x, z) { if (z < zPd) return false; var hh = teren(x, z); return hh > 0 && hh <= PIASEK_M; }
    for (var l = 0; l < n; l++) {
      var b0 = l * P;
      if (!ns) { continue; }                       // brak brzegu nawietrznego: linie zdegenerowane w (0, 0), s = 0 (alfa 0)
      var x = starty[(l % ns) * 2], z = starty[(l % ns) * 2 + 1], sl = 0, stoi = false, pl = 0, od = -1;
      pozycje[b0 * 3] = x; pozycje[b0 * 3 + 2] = z;
      if (nadPlaza(x, z)) { pl = 1; od = 0; }
      for (var k = 1; k < P; k++) {
        if (!stoi) {
          predkosc(x, z);
          var xm = x + vx * krok / 2, zm = z + vz * krok / 2;
          if (wewnatrz(xm, zm)) predkosc(xm, zm);                 // punkt środkowy poza siatką: krok Eulera do krawędzi
          var xn = x + vx * krok, zn = z + vz * krok, tk = 1;
          if (!wewnatrz(xn, zn)) {
            // wyjście za siatkę (Runda 2): ostatni punkt przypięty do krawędzi (część kroku) — tam zanik = 0 dokładnie
            tk = Math.min(1, przeciecie(x, xn - x, X1), przeciecie(z, zn - z, Z1));
            xn = Math.min(X1, Math.max(0, x + (xn - x) * tk)); zn = Math.min(Z1, Math.max(0, z + (zn - z) * tk));
            stoi = true;
          }
          if (tk > 0) {
            // pierwsza plaża w odcinku (k − 1 → k): piasek od punktu k (shader rozmywa przejście na tym odcinku)
            for (var e = 1; !pl && e <= GESTOSC_PIASKU; e++) { var u2 = e / GESTOSC_PIASKU; if (nadPlaza(x + (xn - x) * u2, z + (zn - z) * u2)) { pl = 1; od = k; } }
            x = xn; z = zn; sl += krok * tk;
          }
        }
        var j = b0 + k;
        pozycje[j * 3] = x; pozycje[j * 3 + 2] = z; s[j] = sl;
      }
      piasek[l] = pl; piasekOd[l] = od;
      // zanik (R16): wygaszenie przed końcem linii (ostatnie ZANIK_KONIEC_KM drogi s) i przy brzegu siatki (ZANIK_BRZEG_KM) —
      // linie zatrzymane na krawędzi nie urywają się na prostej
      for (k = 0; k < P; k++) {
        j = b0 + k;
        var px = pozycje[j * 3], pz = pozycje[j * 3 + 2], kr = Math.min(px, X1 - px, pz, Z1 - pz);
        pozycje[j * 3 + 1] = Math.max(teren(px, pz), 0) / 1000 + Y_KM + (pl && k >= od ? Y_PIASEK_KM : 0);
        zanik[j] = gladko((Math.fround(sl) - s[j]) / ZANIK_KONIEC_KM) * gladko(kr / ZANIK_BRZEG_KM);   // s w Float32 — ten sam zapis
      }
    }
    return { pozycje: pozycje, s: s, piasek: piasek, piasekOd: piasekOd, zanik: zanik };
  }

  // Shader kreski biegnącej (LineSegments). Faza rośnie z drogą s; głowa kreski przy fazie ≈ 0,96 (z przodu, z wiatrem),
  // ogon wygasa ku tyłowi do fazy 0,8 — świeci ok. 20% linii (4000 linii w pasie nawietrznym: dłuższy ogon zlewał się
  // w biel wzdłuż północnego brzegu). Rozbłysk od startu (pierwsze 1,5 km) — bez urwanego początku nad morzem.
  // uJasn: jasność światła makiety (noc gasi smugi); mgła sceny (kalima) gasi także krycie.
  var GLSL_VERT = [
    'attribute float s;',
    'attribute float piasek;',
    'attribute float zanik;',
    'varying float vS;',
    'varying float vP;',
    'varying float vZ;',
    '#include <fog_pars_vertex>',
    '#include <clipping_planes_pars_vertex>',
    'void main() {',
    '  vS = s; vP = piasek; vZ = zanik;',
    '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  #include <clipping_planes_vertex>',
    '  #include <fog_vertex>',
    '}'].join('\n');
  var GLSL_FRAG = [
    '#define ALFA_MAKS ' + ALFA_MAKS.toFixed(2),
    'uniform float uCzas;',
    'uniform float uJasn;',
    'uniform vec3 uKolor;',
    'uniform vec3 uKolorPiasku;',
    'varying float vS;',
    'varying float vP;',
    'varying float vZ;',
    '#include <fog_pars_fragment>',
    '#include <clipping_planes_pars_fragment>',
    'void main() {',
    '  #include <clipping_planes_fragment>',
    '  float f = fract((vS - uCzas * 0.05) / 1.2);',
    '  float a = smoothstep(0.8, 0.96, f) * (1.0 - smoothstep(0.96, 1.0, f)) * smoothstep(0.0, 1.5, vS) * vZ;',
    // R16: nocą gaśnie też krycie (sam kolor × uJasn dawał smugi ciemniejsze od tła)
    '  gl_FragColor = vec4(mix(uKolor, uKolorPiasku, vP) * uJasn, ALFA_MAKS * a * uJasn);',
    '  #include <fog_fragment>',
    '  #ifdef USE_FOG',
    '  gl_FragColor.a *= 1.0 - fogFactor;',
    '  #endif',
    '}'].join('\n');

  var api = { WIATR: WIATR, LICZBA: LICZBA, KROK_KM: KROK_KM, ALFA_MAKS: ALFA_MAKS, LAT_PIASKU: LAT_PIASKU, PIASEK_M: PIASEK_M, Y_KM: Y_KM,
    Y_PIASEK_KM: Y_PIASEK_KM, ODCHYL: ODCHYL, PRZYSP: PRZYSP, pole: pole, linie: linie, GLSL_VERT: GLSL_VERT, GLSL_FRAG: GLSL_FRAG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GeologiaWiatr = api;
})(typeof window !== 'undefined' ? window : globalThis);
