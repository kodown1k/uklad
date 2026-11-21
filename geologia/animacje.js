'use strict';
/* Zakładka Geologia — animacje A1–A5 (spec R4, R9.4, R9.5).
   Część czysta (node + przeglądarka; dual-export: window.Animacje):
     czasMa(u, zdarzenia, czas_s[, { M0, eps }]) → Ma — oś czasu A1: nierosnąca, logarytmiczna (tempo ∝ Ma + eps, więc
       ostatnie 200 tys. lat nie mieści się w jednej sekundzie), z postojami `postoj_s` na zdarzeniach; u = 0 → M0
       (domyślnie najstarsze zdarzenie), u = 1 → 0;
     osMa(v, M0) / osV(Ma, M0) — ta sama oś bez postojów (suwak czasu makiety);
     frontLawy(tor, f) → { punkty, czolo, s_km, dl_km } — czoło po długości łuku toru [[lon, lat]];
     osuwisko(f[, wypelnienie_m = 500]) → { przesuniecie_km, opadniecie_m, pyl, etap, etapy } — trzy etapy (F5.7: osuwisko
       wieloetapowe, dwa pierwsze zsuwy podmorskie, trzeci nadwodny z pyłem); `etapy` = postęp każdego etapu 0…1;
     nieboLokalne(raDeg, decDeg, latDeg, lstDeg) → [x, y, z] w układzie makiety (+x wschód, +y góra, +z południe);
     lst(msUTC, lonDeg) → czas gwiazdowy miejscowy [°] (GMST J2000).
   Część przeglądarkowa (window.GeologiaAnimacje) — na końcu pliku. */
(function (root) {
  var RAD = Math.PI / 180;
  var KM_NA_STOPIEN = 6371 * RAD;
  var EPS_MA = 0.2;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function gladko(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  /* ---------- oś czasu ---------- */
  function osMa(v, M0, eps) {
    eps = eps || EPS_MA;
    if (!(v > 0)) return M0;
    if (v >= 1) return 0;
    return Math.max(0, (M0 + eps) * Math.pow(eps / (M0 + eps), v) - eps);
  }
  function osV(Ma, M0, eps) {
    eps = eps || EPS_MA;
    if (Ma >= M0) return 0;
    if (!(Ma > 0)) return 1;
    return Math.log((Ma + eps) / (M0 + eps)) / Math.log(eps / (M0 + eps));
  }
  function czasMa(u, zdarzenia, czas_s, o) {
    o = o || {};
    var zd = [];
    (zdarzenia || []).forEach(function (z) {
      if (!(z && z.Ma > 0)) return;
      var p = Math.max(0, +z.postoj_s || 0), jest = zd.filter(function (x) { return x.Ma === z.Ma; })[0];
      if (jest) jest.p = Math.max(jest.p, p); else zd.push({ Ma: z.Ma, p: p });
    });
    zd.sort(function (a, b) { return b.Ma - a.Ma; });
    var M0 = o.M0 != null ? o.M0 : zd.length ? zd[0].Ma : 12;
    zd = zd.filter(function (z) { return z.Ma <= M0; });
    var T = czas_s > 0 ? czas_s : 60, S = zd.reduce(function (s, z) { return s + z.p; }, 0);
    var skala = S > 0.8 * T ? 0.8 * T / S : 1, R = T - S * skala;
    if (!(u > 0)) u = 0;
    if (u >= 1) return 0;
    var tau = u * T, przeszle = 0;
    for (var i = 0; i < zd.length; i++) {
      var tz = osV(zd[i].Ma, M0, o.eps) * R + przeszle, p = zd[i].p * skala;
      if (tau < tz) break;
      if (tau <= tz + p) return zd[i].Ma;
      przeszle += p;
    }
    return osMa((tau - przeszle) / R, M0, o.eps);
  }

  /* ---------- lawa, osuwisko ---------- */
  function frontLawy(tor, f) {
    f = clamp01(+f || 0);
    var cos = Math.cos(tor.reduce(function (s, p) { return s + p[1]; }, 0) / tor.length * RAD), dl = [0];
    for (var i = 1; i < tor.length; i++) {
      dl.push(dl[i - 1] + Math.hypot((tor[i][0] - tor[i - 1][0]) * cos, tor[i][1] - tor[i - 1][1]) * KM_NA_STOPIEN);
    }
    var L = dl[dl.length - 1], s = f * L, punkty = [tor[0].slice()], czolo = tor[0].slice();
    for (i = 1; i < tor.length; i++) {
      if (dl[i] <= s) { punkty.push(tor[i].slice()); czolo = tor[i].slice(); if (dl[i] === s) break; continue; }
      var t = (s - dl[i - 1]) / (dl[i] - dl[i - 1]);
      if (t > 0) { czolo = [tor[i - 1][0] + (tor[i][0] - tor[i - 1][0]) * t, tor[i - 1][1] + (tor[i][1] - tor[i - 1][1]) * t]; punkty.push(czolo); }
      break;
    }
    if (f >= 1) czolo = punkty[punkty.length - 1];
    return { punkty: punkty, czolo: czolo, s_km: s, dl_km: L };
  }

  // Etapy osuwiska Icod (model poglądowy; prędkości nie ma w źródłach): granice w f i droga każdej masy [km].
  var ETAPY = [[0, 0.3, 6], [0.3, 0.6, 9], [0.6, 1, 16]];
  function osuwisko(f, wypelnienie_m) {
    f = clamp01(+f || 0);
    var wyp = wypelnienie_m == null ? 500 : wypelnienie_m;
    var etapy = ETAPY.map(function (e) { return gladko(e[0], e[1], f); });
    var etap = f < ETAPY[1][0] ? 1 : f < ETAPY[2][0] ? 2 : 3;
    var przes = ETAPY.reduce(function (s, e, i) { return s + e[2] * etapy[i]; }, 0);
    var pyl = etap < 3 ? 0 : gladko(0.6, 0.72, f) * (1 - 0.6 * gladko(0.8, 1, f));
    return { przesuniecie_km: przes, opadniecie_m: etap < 3 ? 0 : wyp * gladko(0.6, 0.85, f), pyl: pyl, etap: etap, etapy: etapy };
  }

  /* ---------- niebo ---------- */
  function nieboLokalne(raDeg, decDeg, latDeg, lstDeg) {
    var H = (lstDeg - raDeg) * RAD, d = decDeg * RAD, f = latDeg * RAD;
    var wsch = -Math.cos(d) * Math.sin(H);
    var pn = Math.cos(f) * Math.sin(d) - Math.sin(f) * Math.cos(d) * Math.cos(H);
    var gora = Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(H);
    return [wsch, gora, -pn];
  }
  function lst(msUTC, lonDeg) {
    var jd = msUTC / 86400000 + 2440587.5;
    var g = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + (lonDeg || 0);
    return ((g % 360) + 360) % 360;
  }

  var api = { EPS_MA: EPS_MA, ETAPY: ETAPY, czasMa: czasMa, osMa: osMa, osV: osV, frontLawy: frontLawy, osuwisko: osuwisko,
    nieboLokalne: nieboLokalne, lst: lst };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.Animacje = api;

  /* ======================================================================================================================
     Część przeglądarkowa: GeologiaAnimacje.utworz(T, scena, dane) → { a1Powstanie(f), a2Lawa1706(f), a3Osuwisko(f),
       a4MorzeChmur(f), a5Noc(f), swiatlaMiasta(id, zgaszone), ukryj(), stan(), zwolnij() }.
     Każda a*(f[, t_s]) jest wołana co klatkę (G-F, widok.js) po scena.animuj(); t_s = czas ruchu (dym, skorupa, migotanie;
     domyślnie zegar strony — w smoke stały, kadr powtarzalny). Wywołanie jednej animacji chowa obiekty i efekty pozostałych.
     Obiekty żyją w grupie „animacje” sceny; zasoby GPU zwalnia zwolnij() (makieta zwalnia ją przed sceną).
     Recepty obrazu: docs/material-filmowy.md, „Geologia — animacje (Task 7, 2026-11-21)”.
     ==================================================================================================================== */
  var LAT_TEIDE = 28.2724, LON_TEIDE = -16.6425;
  // A5: noc nad Teide 20 VII 2026, 23:30 czasu kanaryjskiego letniego (22:30 UT) — centrum Galaktyki na południu
  // ok. 32° nad horyzontem, Deneb wysoko na NE: łuk Drogi Mlecznej od Strzelca przez zenit (Animacje.lst + nieboLokalne).
  var DATA_A5 = Date.UTC(2026, 6, 20, 22, 30);
  // A1: zdarzenia z postojem licznika (R9.4: ≥ 2,5 s) — starty jednostek i osuwiska z osCzasu, czas osi 60 s (W4–W7).
  var A1_CZAS_S = 60, A1_POSTOJ_S = 2.5;
  var A1_ZDARZENIA = ['oc-wynurzenie', 'oc-teno', 'oc-anaga', 'oc-canadas', 'oc-dorsal', 'oc-guimar', 'oc-orotava', 'oc-icod'];
  // A4: morze chmur — plik faktów F2.18 (Z37): inwersja pasatowa średnio ok. 1300 m, druga, wyższa 1500–1800 m latem.
  var WARSTWY_CHMUR = [{ strop_km: 1.3, gest: 0 }, { strop_km: 1.05, gest: 1 }, { strop_km: 1.75, gest: 2 }];
  // Lawa nocą (spec R4, MF „Lawa nocą”): poziomy emisji skorupa / szczeliny / czoło, miękkie nasycenie LUMINANCJI.
  var EMISJA = { skorupa: 1.1, szczeliny: 2.4, czolo: 7.0 };

  var GLSL_NASYCENIE = 'vec3 geNasyc(vec3 c) { float Y = dot(c, vec3(0.2126, 0.7152, 0.0722)); return Y > 1e-4 ? c * (1.0 - exp(-1.2 * Y)) / (1.2 * Y) : c; }';
  var GLSL_WORLEY = [
    'vec2 geWor(vec2 p) {',                  // (F1, F2) komórek Voronoi — płyty skorupy i szczeliny między nimi
    '  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;',
    '  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {',
    '    vec2 g = vec2(float(x), float(y)); vec2 o = vec2(geHash(i + g), geHash(i + g + 17.3));',
    '    float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;',
    '  }',
    '  return vec2(d1, d2);',
    '}'
  ].join('\n');

  var LAWA_VERT = [
    '#include <common>', '#include <fog_pars_vertex>',
    'attribute vec3 aLawa;', 'varying vec3 vLawa;',
    'void main() { vLawa = aLawa; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;',
    '  #ifdef USE_FOG', '  fogDepth = length(mvPosition.xyz);', '  #endif', '}'
  ].join('\n');
  // vLawa = (s km wzdłuż toru, w −1…1 w poprzek, klif 0…1). Czoło = uFront. Skorupa płynie z prądem.
  function lawaFrag(wspolne) {
    return [
      '#include <common>', '#include <fog_pars_fragment>',
      'uniform float uFront; uniform float uCzas; uniform float uSila;', 'varying vec3 vLawa;',
      wspolne, GLSL_WORLEY, GLSL_NASYCENIE,
      'vec3 geTemp(float t) {',            // barwa żaru: ciemna czerwień → pomarańcz → żółć
      '  vec3 c = mix(vec3(0.30, 0.012, 0.0), vec3(1.0, 0.25, 0.025), smoothstep(0.0, 0.5, t));',
      '  return mix(c, vec3(1.0, 0.6, 0.22), smoothstep(0.55, 1.0, t));',
      '}',
      'void main() {',
      '  float s = vLawa.x, w = vLawa.y, klif = vLawa.z, wiek = uFront - s;',
      '  if (wiek < -0.02) discard;',
      '  float lob = sqrt(clamp((wiek + 0.02) / 0.09, 0.0, 1.0));',                     // zaokrąglone czoło
      '  float brzeg = abs(w) + 0.22 * (geSzum(vec2(s * 22.0, w > 0.0 ? 3.0 : 11.0)) - 0.5);',
      '  if (brzeg > lob) discard;',
      // płyty skorupy: wydłużone z prądem, nieregularne (zaburzenie dziedziny szumem), płyną z lawą
      '  vec2 p = vec2((s - uCzas * 0.0025) * 15.0, w * 2.0);',
      '  p += (vec2(geFbm(p * 0.45 + 3.1), geFbm(p * 0.45 + 8.7)) - 0.5) * 1.8;',
      '  vec2 F = geWor(p);',
      '  float grub = 0.03 + 0.09 * geSzum(p * 0.7 + 5.0) + 0.16 * klif;',                // szerokość szczeliny zmienna
      '  float szcz = (1.0 - smoothstep(0.0, grub, F.y - F.x)) * mix(1.0, 0.45, smoothstep(0.3, 2.5, wiek));',
      '  float goraco = exp(-max(wiek, 0.0) / 0.35);',
      '  float waly = smoothstep(0.55, 1.0, brzeg);',                                    // wały brzeżne stygną pierwsze
      '  vec3 E = geTemp(0.2) * EM_SKORUPA * (0.08 + 0.22 * goraco) * (1.0 - 0.7 * waly);',
      '  E = mix(E, geTemp(0.62) * EM_SZCZELINY * (0.55 + 0.45 * goraco), szcz * (1.0 - 0.6 * waly));',
      // kaskada z klifu: skorupa pęka, smugi wzdłuż spadku (ramiona lawy)
      '  float smugi = 0.5 + 0.5 * sin(w * 21.99 + 3.0 * geSzum(vec2(s * 40.0 - uCzas * 0.4, w * 3.0)));',
      '  E = mix(E, geTemp(0.7) * EM_SZCZELINY * (0.6 + 0.7 * smugi), klif * 0.85);',
      '  float czolo = 1.0 - smoothstep(0.0, 0.07, wiek);',
      '  E = mix(E, geTemp(0.92) * EM_CZOLO * (0.75 + 0.25 * geSzum(vec2(s * 60.0, w * 6.0 + uCzas))), czolo * (1.0 - 0.5 * waly));',
      '  gl_FragColor = vec4(geNasyc(E * uSila), 1.0);',
      '  #include <tonemapping_fragment>', '  #include <encodings_fragment>', '  #include <fog_fragment>',
      '}'
    ].join('\n').replace('EM_SKORUPA', EMISJA.skorupa.toFixed(2)).replace('EM_SZCZELINY', EMISJA.szczeliny.toFixed(2))
      .replace('EM_SZCZELINY', EMISJA.szczeliny.toFixed(2)).replace('EM_CZOLO', EMISJA.czolo.toFixed(2));
  }

  // Cząstki (dym, para, pył, fontanna): baza w position (km, świat), losy aLos = (faza, prędkość, rozmiar, kierunek).
  var CZASTKI_VERT = [
    '#include <common>', '#include <fog_pars_vertex>',
    'attribute vec4 aLos;',
    'uniform float uCzas; uniform float uOkres; uniform vec3 uWznos; uniform vec3 uRozrzut; uniform float uRozmiar; uniform float uSkalaPx; uniform float uSila;',
    'varying float vZycie; varying float vA;',
    'void main() {',
    '  float zycie = fract(aLos.x + uCzas / uOkres * (0.7 + 0.6 * aLos.y));',
    '  vec3 kier = vec3(cos(aLos.w), 0.0, sin(aLos.w));',
    '  vec3 p = position + uWznos * zycie + kier * uRozrzut.x * zycie - vec3(0.0, uRozrzut.y * zycie * zycie, 0.0);',
    '  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  float r = uRozmiar * (0.6 + 0.8 * aLos.z) * (0.35 + uRozrzut.z * zycie);',
    '  gl_PointSize = clamp(r * uSkalaPx / max(-mvPosition.z, 1e-3), 0.0, 256.0);',
    // cząstka tuż przy kamerze nie zasłania kadru plamą (zanik bliżej niż 3 promienie)
    '  vZycie = zycie; vA = uSila * smoothstep(0.0, 0.12, zycie) * (1.0 - smoothstep(0.5, 1.0, zycie)) * smoothstep(1.0 * r, 3.0 * r, -mvPosition.z);',
    '  #ifdef USE_FOG', '  fogDepth = length(mvPosition.xyz);', '  #endif',
    '}'
  ].join('\n');
  function czastkiFrag(wspolne) {
    return [
      '#include <common>', '#include <fog_pars_fragment>',
      'uniform vec3 uKolorA; uniform vec3 uKolorB; uniform vec3 uPodswietl; uniform float uKrycie;',
      'varying float vZycie; varying float vA;', wspolne,
      'void main() {',
      '  vec2 c = gl_PointCoord * 2.0 - 1.0; float r2 = dot(c, c); if (r2 > 1.0) discard;',
      '  float a = (1.0 - r2); a *= a;',
      '  a *= 0.55 + 0.45 * geSzum(gl_PointCoord * 3.1 + vZycie * 5.0);',
      // podświetlenie od dołu: dół kłębu (gl_PointCoord.y → 1) i młode cząstki (blisko lawy) świecą łuną
      '  vec3 kol = mix(uKolorA, uKolorB, smoothstep(0.0, 0.8, vZycie)) + uPodswietl * (1.0 - smoothstep(0.0, 0.7, vZycie)) * (0.35 + 0.65 * gl_PointCoord.y);',
      '  gl_FragColor = vec4(kol, a * vA * uKrycie);',
      '  #include <tonemapping_fragment>', '  #include <encodings_fragment>', '  #include <fog_fragment>',
      '}'
    ].join('\n');
  }

  var SWIATLA_VERT = [
    'attribute vec2 aSw;', 'uniform float uPx; uniform float uCzas; uniform float uSila;', 'varying float vA;',     // aSw = (zgaszone 0…1, los)
    'void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = uPx * (2.2 + 1.8 * aSw.y);',
    '  vA = uSila * (1.0 - aSw.x) * (0.85 + 0.15 * sin(uCzas * (1.3 + 2.0 * aSw.y) + aSw.y * 40.0)); }'
  ].join('\n');
  var SWIATLA_FRAG = [
    'varying float vA;',
    'void main() { vec2 c = gl_PointCoord * 2.0 - 1.0; float r2 = dot(c, c); if (r2 > 1.0) discard;',
    '  gl_FragColor = vec4(vec3(1.0, 0.74, 0.42) * vA * (exp(-r2 * 5.0) + 0.25 * exp(-r2 * 1.2)), 1.0); }'
  ].join('\n');

  // Gwiazdy: kierunek z (RA, Dec) liczony w shaderze dla szerokości i czasu gwiazdowego (ten sam wzór co nieboLokalne).
  var GWIAZDY_VERT = [
    'attribute vec4 aGw;', 'uniform float uLat; uniform float uLst; uniform float uPx; uniform float uCzas;',
    'varying vec3 vKol; varying float vA;',
    'void main() {',
    '  float H = uLst - aGw.x, d = aGw.y;',
    '  vec3 k = vec3(-cos(d) * sin(H), sin(uLat) * sin(d) + cos(uLat) * cos(d) * cos(H), -(cos(uLat) * sin(d) - sin(uLat) * cos(d) * cos(H)));',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(k, 1.0);',
    '  float V = aGw.z, bv = clamp(aGw.w, -0.3, 1.9);',
    '  gl_PointSize = uPx * (2.4 + clamp(2.4 - 0.6 * V, 0.0, 3.0));',
    // barwa z B−V (niebieskobiałe → białe → pomarańczowe), jasność z wielkości gwiazdowej, ekstynkcja przy horyzoncie
    '  vKol = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.97, 0.92), smoothstep(-0.3, 0.4, bv));',
    '  vKol = mix(vKol, vec3(1.0, 0.72, 0.45), smoothstep(0.5, 1.7, bv));',
    // jasność na ekranie (sRGB, bez mapowania tonów): V 0 → 1,0, V 2 → 0,66, V 4 → 0,32 (liniowo w magnitudo, bo oko też)
    '  vA = clamp(1.0 - 0.17 * V, 0.28, 1.0) * smoothstep(-0.01, 0.14, k.y) * (0.88 + 0.12 * sin(uCzas * 3.1 + aGw.x * 91.0));',
    '}'
  ].join('\n');
  var GWIAZDY_FRAG = [
    'uniform float uSila;', 'varying vec3 vKol; varying float vA;',
    'void main() { vec2 c = gl_PointCoord * 2.0 - 1.0; float r2 = dot(c, c); if (r2 > 1.0) discard;',
    '  gl_FragColor = vec4(vKol * vA * uSila * (exp(-r2 * 3.0) + 0.08), 1.0); }'
  ].join('\n');
  // Droga Mleczna: jasność z szerokości i długości galaktycznej kierunku (równikowe → galaktyczne, macierz J2000),
  // pasmo ok. 10° z jaśniejszym zgrubieniem ku centrum i ciemną szczeliną Wielkiej Rysy; dodawana w sRGB jak kopuła nieba.
  function drogaFrag(wspolne) {
    return [
      'uniform float uLat; uniform float uLst; uniform float uSila;', 'varying vec3 vKier;', wspolne,
      'void main() {',
      '  vec3 d = normalize(vKier); float E = d.x, U = d.y, N = -d.z;',
      '  float dec = asin(clamp(sin(uLat) * U + cos(uLat) * N, -1.0, 1.0));',
      '  float ra = uLst - atan(-E, cos(uLat) * U - sin(uLat) * N);',
      '  vec3 q = vec3(cos(dec) * cos(ra), cos(dec) * sin(ra), sin(dec));',
      '  vec3 g = vec3(dot(vec3(-0.0548755604, -0.8734370902, -0.4838350155), q), dot(vec3(0.4941094279, -0.4448296300, 0.7469822445), q),',
      '    dot(vec3(-0.8676661490, -0.1980763734, 0.4559837762), q));',
      '  float b = asin(clamp(g.z, -1.0, 1.0)), l = atan(g.y, g.x);',
      '  float pas = exp(-pow(b / (0.10 + 0.07 * (0.5 + 0.5 * cos(l))), 2.0));',
      '  float rdzen = 0.3 + 0.7 * pow(0.5 + 0.5 * cos(l), 3.0);',
      '  float klaczki = geFbm(vec2(l * 7.0, b * 16.0));',
      '  float rysa = 1.0 - 0.75 * exp(-pow((b - 0.025) / 0.03, 2.0)) * (1.0 - smoothstep(0.2, 1.2, abs(l - 0.35)));',
      '  float I = pas * rdzen * (0.4 + 1.1 * klaczki) * rysa * smoothstep(-0.02, 0.3, U);',
      // poświata nocnego nieba przy horyzoncie (airglow, łuna dalekich miast): sylwetka gór odcina się od nieba
      // (spec R4: różnica median sylwetka/niebo ≥ 8 sRGB)
      '  float posw = exp(-max(U, 0.0) / 0.25) * smoothstep(-0.08, 0.0, U);',
      '  gl_FragColor = vec4((vec3(0.60, 0.64, 0.74) * I * 0.17 + vec3(0.10, 0.12, 0.17) * posw) * uSila, 1.0);',
      '}'
    ].join('\n');
  }
  var KIER_VERT = 'varying vec3 vKier; void main() { vKier = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

  // Warstwa morza chmur A4 (spec R4): pokrycie wspólne z cieniem na terenie, miękki styk z terenem z tekstury wysokości.
  function chmuryFrag(wspolne, chmury) {
    return [
      '#include <common>', '#include <fog_pars_fragment>',
      'uniform sampler2D uWysW; uniform vec4 uProstW; uniform vec2 uRozmW;',
      'uniform float uCzas; uniform float uStrop; uniform float uWarstwa; uniform float uKrycie;',
      'uniform vec3 uSlonce; uniform vec3 uKolorSlonca; uniform vec3 uAmb;', 'varying vec3 vSwiat;', wspolne, chmury,
      'vec2 geUv(vec2 xz, vec4 r, vec2 n) { vec2 f = (xz - r.xy) / (r.zw - r.xy); return (f * (n - 1.0) + 0.5) / n; }',
      'void main() {',
      '  vec2 xz = vSwiat.xz;',
      '  float d = geChmuryA4(xz, uCzas, uWarstwa);',
      '  if (uWarstwa > 1.5) d = smoothstep(0.55, 0.95, d) * 0.7;',              // górna warstwa: strzępy
      '  float hT = -1.0;',
      '  if (xz.x >= uProstW.x && xz.x <= uProstW.z && xz.y >= uProstW.y && xz.y <= uProstW.w) hT = texture2D(uWysW, geUv(xz, uProstW, uRozmW)).r / 1000.0;',
      '  float styk = smoothstep(0.0, 0.15, uStrop - hT);',                       // krycie smoothstep(0; 150 m; strop − teren)
      '  float a = d * styk * uKrycie;',
      // światło: góra chmur w słońcu, gęstość ku słońcu przyciemnia (cień własny), spód ciemniejszy
      '  float ds = geChmuryA4(xz + uSlonce.xz * 0.6, uCzas, uWarstwa);',
      '  float wlasny = 1.0 - 0.35 * clamp(ds - d + 0.3, 0.0, 1.0);',
      // kalafiorowe wierzchołki: drobny szum oświetlony od słońca (różnica szumu w stronę słońca = cień własny kłębu)
      '  vec2 q = xz * 1.6 - uCzas * vec2(-0.04, 0.04);',
      '  float n1 = geFbm(q), n2 = geFbm(q + uSlonce.xz * 0.35);',
      '  float kleby = clamp(0.78 + 1.1 * (n1 - n2) + 0.25 * (n1 - 0.5), 0.45, 1.15);',
      '  a *= 0.75 + 0.25 * smoothstep(0.25, 0.6, n1);',
      '  vec3 V = normalize(cameraPosition - vSwiat);',
      '  a *= smoothstep(0.015, 0.12, abs(V.y));',                                   // warstwa widziana z boku nie tnie zbocza kreską
      '  vec3 c = vec3(0.93) * (uAmb * 1.15 + uKolorSlonca * max(uSlonce.y, 0.05) * 0.85 * wlasny * kleby) * (0.84 + 0.16 * d);',
      '  if (cameraPosition.y < vSwiat.y) c *= 0.72;',
      '  if (a < 0.004) discard;',
      '  gl_FragColor = vec4(c, a);',
      '  #include <tonemapping_fragment>', '  #include <encodings_fragment>', '  #include <fog_fragment>',
      '}'
    ].join('\n');
  }
  var CHMURY_VERT = [
    '#include <common>', '#include <fog_pars_vertex>', 'varying vec3 vSwiat;',
    'void main() { vec4 s = modelMatrix * vec4(position, 1.0); vSwiat = s.xyz; vec4 mvPosition = viewMatrix * s; gl_Position = projectionMatrix * mvPosition;',
    '  #ifdef USE_FOG', '  fogDepth = length(mvPosition.xyz);', '  #endif', '}'
  ].join('\n');

  // Fala (A3) i biała woda (A1): pierścień na tafli, piana z szumu.
  var FALA_FRAG = [
    '#include <common>', '#include <fog_pars_fragment>', 'uniform float uSila; uniform float uCzas;', 'varying vec3 vSwiat; varying vec2 vUv2;', '__WSPOLNE__',
    'void main() { float r = vUv2.x; float a = smoothstep(0.0, 0.35, r) * (1.0 - smoothstep(0.65, 1.0, r)) * uSila;',
    '  a *= 0.45 + 0.55 * geSzum(vSwiat.xz * 3.0 + uCzas * 0.2); if (a < 0.004) discard;',
    '  gl_FragColor = vec4(vec3(0.86, 0.9, 0.92), a);',
    '  #include <tonemapping_fragment>', '  #include <encodings_fragment>', '  #include <fog_fragment>', '}'
  ].join('\n');
  var FALA_VERT = [
    '#include <common>', '#include <fog_pars_vertex>', 'varying vec3 vSwiat; varying vec2 vUv2;',
    'void main() { vUv2 = uv; vec4 s = modelMatrix * vec4(position, 1.0); vSwiat = s.xyz; vec4 mvPosition = viewMatrix * s; gl_Position = projectionMatrix * mvPosition;',
    '  #ifdef USE_FOG', '  fogDepth = length(mvPosition.xyz);', '  #endif', '}'
  ].join('\n');

  // Deterministyczny los (LCG) — położenia świateł i cząstek takie same w każdym przebiegu.
  function losowy(ziarno) { var z = ziarno >>> 0 || 1; return function () { z = (Math.imul(z, 1664525) + 1013904223) >>> 0; return z / 4294967296; }; }

  function utworz(T, sc, dane) {
    var Teren = root.Teren, Ew = root.Ewolucja, GS = root.GeologiaScena;
    var wspolne = GS.GLSL_WSPOLNE;
    var zasoby = [];
    function z(x) { zasoby.push(x); return x; }
    var grupa = new T.Group(); grupa.name = 'animacje';
    sc.scena.add(grupa);
    var R = sc.renderer, rozm = new T.Vector2();
    var aktywna = null, zbudowane = {}, czesci = {};
    (dane.czesci || []).forEach(function (c) { czesci[c.id] = c; });
    function lok(ll) { return Teren.doLokalnych(null, ll[0], ll[1]); }
    function wys(x, zz) { var h = sc.wysokosc(x, zz); return h == null ? 0 : h; }
    function zegar(t) { return t != null ? t : performance.now() / 1000; }
    function skalaPx() {     // px na km na odległości 1 km (rozmiar cząstek w perspektywie)
      R.getDrawingBufferSize(rozm);
      return rozm.y / (2 * Math.tan(sc.kamera.fov * RAD / 2));
    }
    function pikselStrony() { return R.getPixelRatio ? R.getPixelRatio() : 1; }

    function materialCzastek(o) {
      var u = T.UniformsUtils.merge([T.UniformsLib.fog, {
        uCzas: { value: 0 }, uOkres: { value: o.okres || 8 }, uWznos: { value: new T.Vector3().fromArray(o.wznos || [0, 0.5, 0]) },
        uRozrzut: { value: new T.Vector3().fromArray(o.rozrzut || [0.2, 0, 1.5]) }, uRozmiar: { value: o.rozmiar || 0.2 },
        uSkalaPx: { value: 800 }, uSila: { value: 0 }, uKrycie: { value: o.krycie == null ? 0.5 : o.krycie },
        uKolorA: { value: new T.Vector3().fromArray(o.kolorA || [0.1, 0.1, 0.1]) }, uKolorB: { value: new T.Vector3().fromArray(o.kolorB || [0.1, 0.1, 0.1]) },
        uPodswietl: { value: new T.Vector3().fromArray(o.podswietl || [0, 0, 0]) } }]);
      return z(new T.ShaderMaterial({ uniforms: u, vertexShader: CZASTKI_VERT, fragmentShader: czastkiFrag(wspolne), transparent: true,
        depthWrite: false, fog: true, blending: o.addytywnie ? T.AdditiveBlending : T.NormalBlending }));
    }
    function czastki(n, o, ziarno) {
      var los = losowy(ziarno), pos = new Float32Array(n * 3), al = new Float32Array(n * 4);
      for (var i = 0; i < n; i++) { al[i * 4] = los(); al[i * 4 + 1] = los(); al[i * 4 + 2] = los(); al[i * 4 + 3] = los() * Math.PI * 2; }
      var g = z(new T.BufferGeometry());
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aLos', new T.BufferAttribute(al, 4));
      var p = new T.Points(g, materialCzastek(o));
      p.frustumCulled = false; p.renderOrder = o.kolejnosc || 5; p.userData.los = los;
      grupa.add(p);
      return p;
    }
    function ustawCzastki(p, t, sila) {
      var u = p.material.uniforms;
      u.uCzas.value = t; u.uSila.value = sila; u.uSkalaPx.value = skalaPx();
      p.visible = sila > 0.001;
    }
    function pierscien(ziarno) {
      var m = z(new T.ShaderMaterial({ uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { uSila: { value: 0 }, uCzas: { value: 0 } }]),
        vertexShader: FALA_VERT, fragmentShader: FALA_FRAG.replace('__WSPOLNE__', wspolne), transparent: true, depthWrite: false, fog: true }));
      // RingGeometry: uv.x nie jest promieniem — własny pierścień z uv.x = położenie w poprzek pasa
      var n = 128, pos = [], uv = [], idx = [];
      for (var i = 0; i <= n; i++) {
        var a = i / n * Math.PI * 2;
        pos.push(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85, Math.cos(a), 0, Math.sin(a)); uv.push(0, 0, 1, 0);
        if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      var g = z(new T.BufferGeometry());
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      var mesh = new T.Mesh(g, m); mesh.renderOrder = 3; mesh.frustumCulled = false; mesh.visible = false; mesh.userData.ziarno = ziarno;
      grupa.add(mesh);
      return mesh;
    }

    /* ---------- światła miast ---------- */
    var miasta = {};
    function zbudujMiasto(id) {
      if (miasta[id]) return miasta[id];
      var c = czesci[id];
      if (!c || !c.promien_km) return null;
      var srodek = lok(c.lonLat), los = losowy(7919 + id.length * 131), pkt = [];
      // 72 losowania w kole promien_km; zostają te na lądzie (dziś ≥ 3 m) — 40–80 świateł okien
      for (var i = 0; i < 400 && pkt.length < 72; i++) {
        var r = c.promien_km * Math.sqrt(los()), a = los() * Math.PI * 2, x = srodek[0] + Math.cos(a) * r, zz = srodek[1] + Math.sin(a) * r;
        if (los() < 0.35 && r > 0.7 * c.promien_km) continue;              // gęściej w centrum
        if (!(sc.wysokosc(x, zz) > 0.003 * sc.przewyzszenie())) continue;
        pkt.push([x, zz, los()]);
      }
      var n = pkt.length, pos = new Float32Array(n * 3), sw = new Float32Array(n * 2);
      var g = z(new T.BufferGeometry());
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aSw', new T.BufferAttribute(sw, 2));
      pkt.forEach(function (p, k) { sw[k * 2 + 1] = p[2]; });
      var m = z(new T.ShaderMaterial({ uniforms: { uPx: { value: 1 }, uCzas: { value: 0 }, uSila: { value: 1 } }, vertexShader: SWIATLA_VERT,
        fragmentShader: SWIATLA_FRAG, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      var pts = new T.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 6; pts.name = 'swiatla-' + id;
      grupa.add(pts);
      var M = { id: id, pkt: pkt, pts: pts, e: -1, lawa: new Float32Array(n), ogolne: 0,
        kolejnosc: pkt.map(function (p, k) { return [p[2], k]; }).sort(function (a, b) { return a[0] - b[0]; }).map(function (x) { return x[1]; }) };
      miasta[id] = M;
      return M;
    }
    function odswiezMiasto(M, t) {
      var e = sc.przewyzszenie(), pos = M.pts.geometry.attributes.position, sw = M.pts.geometry.attributes.aSw;
      if (M.e !== e) {
        M.e = e;
        M.pkt.forEach(function (p, k) { pos.array[k * 3] = p[0]; pos.array[k * 3 + 1] = wys(p[0], p[1]) + 0.006 * e; pos.array[k * 3 + 2] = p[1]; });
        pos.needsUpdate = true;
      }
      var off = Math.round(M.ogolne * M.pkt.length), zm = false;
      M.kolejnosc.forEach(function (k, r) {
        var v = Math.max(M.lawa[k], r < off ? 1 : 0);
        if (sw.array[k * 2] !== v) { sw.array[k * 2] = v; zm = true; }
      });
      if (zm) sw.needsUpdate = true;
      M.pts.material.uniforms.uPx.value = pikselStrony();
      M.pts.material.uniforms.uCzas.value = t;
    }
    function swiatlaMiasta(id, zgaszone) {
      var M = zbudujMiasto(id);
      if (!M) return 0;
      M.ogolne = clamp01(+zgaszone || 0);
      M.pts.visible = true; M.wlaczone = true;
      odswiezMiasto(M, zegar());
      return M.pkt.length;
    }

    /* ---------- wspólne: przełączanie animacji ---------- */
    function pokaz(nazwa) {
      if (aktywna === nazwa) return;
      var poprz = aktywna;
      aktywna = nazwa;
      Object.keys(zbudowane).forEach(function (k) { zbudowane[k].grupa.visible = k === nazwa; });
      // efekty sceny poprzedniej animacji wracają do zera (czas geologiczny zostaje — ustawia go widok/ujęcie)
      if (poprz === 'a1') sc.efekty.zar(0);
      if (poprz === 'a2') {
        sc.efekty.luna(null); sc.dekoracje.lawa.intensity = 0;
        if (zbudowane.a2) {
          zbudowane.a2.klucz = null;
          var G = zbudowane.a2.G;
          if (G) { G.lawa.fill(0); G.pts.visible = !!G.wlaczone; if (G.wlaczone) odswiezMiasto(G, zegar()); }
        }
      }
      if (poprz === 'a3') sc.efekty.wypelnienie('dolina-icod', 1);
      if (poprz === 'a4') sc.efekty.cienChmur(0);
    }
    function podgrupa(nazwa) {
      var g = new T.Group(); g.name = 'anim-' + nazwa; grupa.add(g);
      zbudowane[nazwa] = { grupa: g };
      return zbudowane[nazwa];
    }
    function przenies(obj, g) { grupa.remove(obj); g.add(obj); return obj; }

    /* ---------- A1: powstanie wyspy ---------- */
    function zbudujA1() {
      var A = podgrupa('a1');
      var ed = sc.ewolucja();                   // { s, przyn, P } wyspy
      // najwyższa komórka lądu każdej jednostki — tam wierzchołek przebija taflę (para, biała woda)
      var szczyty = ed.P.map(function () { return null; }), s = ed.s;
      for (var i = 0; i < s.wys.length; i++) {
        var k = ed.przyn[i];
        if (!k || !(s.wys[i] > 0)) continue;
        if (!szczyty[k - 1] || s.wys[i] > szczyty[k - 1].h) szczyty[k - 1] = { i: i, h: s.wys[i] };
      }
      A.szczyty = szczyty.map(function (q, k) {
        if (!q) return null;
        var x = q.i % s.w, y = Math.floor(q.i / s.w), lon = s.bbox.lonMin + (s.bbox.lonMax - s.bbox.lonMin) * x / (s.w - 1), lat = s.bbox.latMax - (s.bbox.latMax - s.bbox.latMin) * y / (s.h - 1);
        return { k: k + 1, h: q.h, lon: lon, lat: lat, xz: lok([lon, lat]) };
      });
      A.para = przenies(czastki(90, { okres: 7, wznos: [0.15, 1.1, -0.1], rozrzut: [0.5, 0, 2.2], rozmiar: 0.55, krycie: 0.7,
        kolorA: [0.85, 0.87, 0.88], kolorB: [0.7, 0.72, 0.74], podswietl: [0.9, 0.35, 0.08] }, 11), A.grupa);
      A.fala = przenies(pierscien(3), A.grupa);
      return A;
    }
    var ZD_A1 = null;
    function a1Powstanie(f, t_s) {
      var A = zbudowane.a1 || zbudujA1();
      pokaz('a1');
      if (!ZD_A1) ZD_A1 = (dane.osCzasu || []).filter(function (o) { return A1_ZDARZENIA.indexOf(o.id) >= 0 && o.Ma > 0; })
        .map(function (o) { return { Ma: o.Ma, postoj_s: A1_POSTOJ_S }; });
      var M0 = Math.max.apply(null, (dane.jednostki || []).map(function (j) { return j.odMa; }));
      var Ma = czasMa(f, ZD_A1, A1_CZAS_S, { M0: M0 }), t = zegar(t_s), e = sc.przewyzszenie();
      sc.czas(Ma);
      sc.efekty.zar(1.6);
      // przebicie tafli: szczyt jednostki w pasie −150 … +250 m i w trakcie wzrostu
      var naj = null, sila = 0, P = A.P || (A.P = sc.ewolucja().P);
      A.szczyty.forEach(function (q) {
        if (!q) return;
        var u = P[q.k - 1];
        if (!(Ma < u.od && Ma > u.do)) return;
        var h = Ew.wysokoscKomorki(P, q.k, q.h, Ma, q.lon, q.lat, Ew.DNO);
        var w = 1 - Math.min(1, Math.abs(h - 50) / 200);
        if (w > sila) { sila = w; naj = q; }
      });
      if (A.eP !== e) { A.eP = e; A.najPara = null; }
      if (naj && naj !== A.najPara) {           // pozycje pary tylko przy zmianie szczytu (bez wgrywania bufora co klatkę)
        A.najPara = naj;
        var pp = A.para.geometry.attributes.position, los = losowy(5);
        for (var i = 0; i < pp.count; i++) { pp.array[i * 3] = naj.xz[0] + (los() - 0.5) * 1.2; pp.array[i * 3 + 1] = 0.02 * e; pp.array[i * 3 + 2] = naj.xz[1] + (los() - 0.5) * 1.2; }
        pp.needsUpdate = true;
      }
      if (naj) { A.fala.position.set(naj.xz[0], 0.004, naj.xz[1]); A.fala.scale.setScalar(1.2 + 1.5 * (t % 4) / 4); }
      ustawCzastki(A.para, t, sila);
      A.fala.visible = sila > 0.01; A.fala.material.uniforms.uSila.value = sila * 0.8; A.fala.material.uniforms.uCzas.value = t;
      return { Ma: Ma, para: sila };
    }

    /* ---------- A2: lawa 1706 ---------- */
    function wygladz(pkt, n) {      // Chaikin: zaokrąglenie załamań toru
      for (var r = 0; r < n; r++) {
        var o = [pkt[0]];
        for (var i = 0; i < pkt.length - 1; i++) {
          var a = pkt[i], b = pkt[i + 1];
          o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
        }
        o.push(pkt[pkt.length - 1]); pkt = o;
      }
      return pkt;
    }
    function zbudujA2() {
      var A = podgrupa('a2');
      var tor = wygladz(((dane.tory || {}).lawa1706 || []).map(lok), 2);
      // próbki co 25 m po długości łuku
      var dl = [0];
      for (var i = 1; i < tor.length; i++) dl.push(dl[i - 1] + Math.hypot(tor[i][0] - tor[i - 1][0], tor[i][1] - tor[i - 1][1]));
      var L = dl[dl.length - 1], N = Math.max(2, Math.round(L / 0.025) + 1), pr = [], j = 1;
      for (i = 0; i < N; i++) {
        var s = L * i / (N - 1);
        while (j < tor.length - 1 && dl[j] < s) j++;
        var t = (s - dl[j - 1]) / Math.max(1e-9, dl[j] - dl[j - 1]);
        pr.push({ s: s, x: tor[j - 1][0] + (tor[j][0] - tor[j - 1][0]) * t, z: tor[j - 1][1] + (tor[j][1] - tor[j - 1][1]) * t });
      }
      // kierunek, nachylenie (klif = spadek > 0,45 na długości ±60 m), szerokość: wąski jęzor, szerzej na płaskim, delta u brzegu
      var e0 = sc.przewyzszenie();
      pr.forEach(function (p, k) {
        var a = pr[Math.max(0, k - 1)], b = pr[Math.min(N - 1, k + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        p.nx = -(b.z - a.z) / l; p.nz = (b.x - a.x) / l;
        p.h = wys(p.x, p.z) / e0;
      });
      pr.forEach(function (p, k) {
        var a = pr[Math.max(0, k - 2)], b = pr[Math.min(N - 1, k + 2)];
        p.spad = (a.h - b.h) / Math.max(1e-6, b.s - a.s);
      });
      pr.forEach(function (p, k) {
        var kl = 0;
        for (var q = Math.max(0, k - 3); q <= Math.min(N - 1, k + 3); q++) kl = Math.max(kl, gladko(0.3, 0.6, pr[q].spad));
        p.klif = kl;
        var doKonca = L - p.s;
        p.pol = (0.07 + 0.04 * gladko(0.25, 0.05, p.spad)) * (1 + 1.4 * gladko(0.45, 0.0, doKonca)) * (1 + 0.6 * kl);
      });
      A.pr = pr; A.L = L;
      var M = 9, pos = new Float32Array(N * M * 3), atr = new Float32Array(N * M * 3), idx = [];
      for (i = 0; i < N; i++) for (var m = 0; m < M; m++) {
        var w = m / (M - 1) * 2 - 1, v = i * M + m;
        atr[v * 3] = pr[i].s; atr[v * 3 + 1] = w; atr[v * 3 + 2] = pr[i].klif;
        if (i < N - 1 && m < M - 1) idx.push(v, v + M, v + 1, v + 1, v + M, v + M + 1);
      }
      var g = z(new T.BufferGeometry());
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aLawa', new T.BufferAttribute(atr, 3)); g.setIndex(idx);
      var u = T.UniformsUtils.merge([T.UniformsLib.fog, { uFront: { value: 0 }, uCzas: { value: 0 }, uSila: { value: 1 } }]);
      A.mat = z(new T.ShaderMaterial({ uniforms: u, vertexShader: LAWA_VERT, fragmentShader: lawaFrag(wspolne), fog: true, side: T.DoubleSide }));
      A.mesh = new T.Mesh(g, A.mat); A.mesh.name = 'lawa-1706'; A.mesh.frustumCulled = false; A.mesh.renderOrder = 1;
      A.grupa.add(A.mesh);
      A.e = -1; A.M = M;
      // dym nad płonącą częścią, podświetlony od dołu; para przy wejściu do morza; fontanna na szczelinie (Montaña Negra)
      // pasat z NE znosi dym na SW (wznos: x −, z +)
      A.dym = przenies(czastki(280, { okres: 11, wznos: [-0.35, 1.2, 0.35], rozrzut: [0.2, 0, 2.4], rozmiar: 0.12, krycie: 0.3,
        kolorA: [0.06, 0.05, 0.05], kolorB: [0.035, 0.035, 0.04], podswietl: [0.9, 0.28, 0.05], kolejnosc: 7 }, 21), A.grupa);
      A.para = przenies(czastki(110, { okres: 6, wznos: [0.1, 0.9, -0.1], rozrzut: [0.15, 0, 2.4], rozmiar: 0.22, krycie: 0.6,
        kolorA: [0.55, 0.52, 0.5], kolorB: [0.22, 0.22, 0.24], podswietl: [1.0, 0.42, 0.1], kolejnosc: 8 }, 22), A.grupa);
      A.ogien = przenies(czastki(120, { okres: 1.6, wznos: [0, 0.16, 0], rozrzut: [0.03, 0.16, 0.5], rozmiar: 0.035, krycie: 1,
        kolorA: [1.0, 0.55, 0.15], kolorB: [0.8, 0.16, 0.02], addytywnie: true, kolejnosc: 9 }, 23), A.grupa);
      // światła Garachico: zgaszone, gdy czoło przeszło obok (odległość do osi < połowa szerokości + 40 m)
      var G = zbudujMiasto('garachico');
      if (G) {                                  // światła zostają w swojej grupie: swiatlaMiasta działa też poza A2
        G.prog = G.pkt.map(function (p) {
          var best = { d: 1e9, s: 0, pol: 0 };
          pr.forEach(function (q) { var d = Math.hypot(p[0] - q.x, p[1] - q.z); if (d < best.d) best = { d: d, s: q.s, pol: q.pol }; });
          return best.d < best.pol + 0.04 ? best.s : Infinity;
        });
      }
      A.G = G;
      return A;
    }
    function ulozLawe(A) {
      var e = sc.przewyzszenie();
      if (A.e === e) return;
      A.e = e;
      var pos = A.mesh.geometry.attributes.position, M = A.M;
      A.pr.forEach(function (p, i) {
        for (var m = 0; m < M; m++) {
          var w = m / (M - 1) * 2 - 1, x = p.x + p.nx * w * p.pol, zz = p.z + p.nz * w * p.pol, v = i * M + m;
          // lawa leży na terenie (+8 m), środek strugi lekko wypukły
          pos.array[v * 3] = x; pos.array[v * 3 + 1] = wys(x, zz) + (0.008 + 0.006 * (1 - w * w)) * e; pos.array[v * 3 + 2] = zz;
        }
      });
      pos.needsUpdate = true;
      A.mesh.geometry.computeBoundingSphere();
    }
    // Bazy cząstek A2 i łuna (wołane tylko przy zmianie punktu czoła albo przewyższenia).
    function ulozBazyA2(A, k, cz, e, plonie) {
      var krokL = Math.max(1, Math.ceil((k + 1) / 23)), i, n = 0;
      if (!A.luna) A.luna = [];
      for (i = 0; i <= k; i += krokL) { A.luna[n] = A.luna[n] || [0, 0]; A.luna[n][0] = A.pr[i].x; A.luna[n][1] = A.pr[i].z; n++; }
      A.luna[n] = A.luna[n] || [0, 0]; A.luna[n][0] = cz.x; A.luna[n][1] = cz.z; n++;
      A.luna.length = n;
      sc.efekty.luna(plonie ? A.luna : null, [1.0 * 0.55, 0.34 * 0.55, 0.07 * 0.55], 0.28);
      // dym: 55% przy czole (0,4 km), 25% nad szczeliną erupcyjną, reszta wzdłuż płonącej części; para po dojściu do morza
      var dp = A.dym.geometry.attributes.position, los = losowy(31), kCzola = Math.max(0, k - 16);
      for (i = 0; i < dp.count; i++) {
        var r = los(), ki = r < 0.55 ? kCzola + Math.floor(los() * (k - kCzola + 1)) : r < 0.8 ? Math.floor(los() * Math.min(k + 1, 8)) : Math.floor(los() * (k + 1));
        var q = A.pr[Math.min(k, ki)], w = (los() - 0.5) * 2 * q.pol;
        dp.array[i * 3] = q.x + q.nx * w; dp.array[i * 3 + 1] = wys(q.x, q.z) + 0.03 * e; dp.array[i * 3 + 2] = q.z + q.nz * w;
      }
      dp.needsUpdate = true;
      if (!A.bazyStale || A.bazyStale !== e) {    // para przy morzu i fontanna nie zależą od czoła
        A.bazyStale = e;
        var morze = A.pr[A.pr.length - 1], pp = A.para.geometry.attributes.position, lp = losowy(37);
        for (i = 0; i < pp.count; i++) { pp.array[i * 3] = morze.x + (lp() - 0.5) * 0.35; pp.array[i * 3 + 1] = 0.005; pp.array[i * 3 + 2] = morze.z + (lp() - 0.5) * 0.3; }
        pp.needsUpdate = true;
        var otw = A.pr[0], op = A.ogien.geometry.attributes.position, lo = losowy(41);
        for (i = 0; i < op.count; i++) {      // szczelina ok. 950 m (kronika) wzdłuż NE–SW przez otwór
          var u = (lo() - 0.5) * 0.95;
          op.array[i * 3] = otw.x + u * 0.7071; op.array[i * 3 + 1] = wys(otw.x + u * 0.7071, otw.z - u * 0.7071) + 0.01 * e; op.array[i * 3 + 2] = otw.z - u * 0.7071;
        }
        op.needsUpdate = true;
        A.ogien.material.uniforms.uWznos.value.set(0, 0.16 * e, 0);
      }
    }
    function a2Lawa1706(f, t_s) {
      var A = zbudowane.a2 || zbudujA2();
      pokaz('a2');
      f = clamp01(+f || 0);
      var t = zegar(t_s), e = sc.przewyzszenie(), sF = f * A.L;
      ulozLawe(A);
      A.mat.uniforms.uFront.value = sF; A.mat.uniforms.uCzas.value = t;
      // czoło: punkt toru, łuna z płonącej części (≤ 24 punkty), światło zbiorcze sceny nad czołem
      var k = 0; while (k < A.pr.length - 1 && A.pr[k + 1].s <= sF) k++;
      var cz = A.pr[k], plonie = f > 0.002, L = sc.dekoracje.lawa, i;
      L.intensity = plonie ? 2.2 : 0;
      // łuna, światło i bazy cząstek zależą tylko od punktu czoła k i przewyższenia — przeliczane przy ich zmianie
      var klucz = k + '|' + e + '|' + plonie;
      if (klucz !== A.klucz) {
        A.klucz = klucz;
        A.przeliczone = (A.przeliczone || 0) + 1;
        ulozBazyA2(A, k, cz, e, plonie);
        L.position.set(cz.x, wys(cz.x, cz.z) + 0.12 * e, cz.z); L.color.setRGB(1, 0.45, 0.16); L.distance = 2.2; L.decay = 2;
      }
      ustawCzastki(A.dym, t, plonie ? 1 : 0);
      ustawCzastki(A.para, t, gladko(0.95, 1.0, f));
      ustawCzastki(A.ogien, t, plonie ? 1 : 0);
      var zg = 0;
      if (A.G) {
        A.G.prog.forEach(function (s, j) { A.G.lawa[j] = sF >= s ? 1 : 0; zg += A.G.lawa[j]; });
        A.G.pts.visible = true;
        odswiezMiasto(A.G, t);
      }
      // kierunek toru przy czole (uśredniony na 0,6 km wstecz — kadr „za czołem” nie skacze na załamaniach)
      var wst = A.pr[Math.max(0, k - 24)], kl = Math.hypot(cz.x - wst.x, cz.z - wst.z) || 1;
      return { s_km: sF, dl_km: A.L, przeliczenia: A.przeliczone, czolo: Teren.zLokalnych(null, cz.x, cz.z), czoloXZ: [cz.x, cz.z],
        kier: k > 0 ? [(cz.x - wst.x) / kl, (cz.z - wst.z) / kl] : [A.pr[1].x - cz.x, A.pr[1].z - cz.z].map(function (v) { return v / (Math.hypot(A.pr[1].x - cz.x, A.pr[1].z - cz.z) || 1); }),
        swiatla: A.G ? A.G.pkt.length : 0, zgaszone: zg };
    }

    /* ---------- A3: osuwisko Icod ---------- */
    function zbudujA3() {
      var A = podgrupa('a3');
      var tor = ((dane.tory || {}).osuwiskoIcod || []).map(lok), dl = [0];
      for (var i = 1; i < tor.length; i++) dl.push(dl[i - 1] + Math.hypot(tor[i][0] - tor[i - 1][0], tor[i][1] - tor[i - 1][1]));
      A.tor = tor; A.dl = dl;
      A.punkt = function (s) {
        s = Math.max(0, Math.min(dl[dl.length - 1], s));
        var j = 1; while (j < dl.length - 1 && dl[j] < s) j++;
        var t = (s - dl[j - 1]) / Math.max(1e-9, dl[j] - dl[j - 1]);
        return [tor[j - 1][0] + (tor[j][0] - tor[j - 1][0]) * t, tor[j - 1][1] + (tor[j][1] - tor[j - 1][1]) * t];
      };
      // brzeg: pierwszy punkt toru z dzisiejszym dnem ≤ 0 (wejście masy do wody)
      A.sBrzeg = 0;
      for (var s = 0; s < dl[dl.length - 1]; s += 0.1) { var p = A.punkt(s); if (wys(p[0], p[1]) <= 0) { A.sBrzeg = s; break; } }
      // masy: dwie podmorskie (start na stoku pod wodą) i nadwodna (start w dolinie) — bryła rumoszu z szumu
      // bryła rumoszu: zniekształcenie funkcją położenia (Icosahedron w r128 nie ma indeksu — losowanie per wierzchołek
      // rozrywało wspólne narożniki w odłamki), spłaszczony spód
      var geo = z(new T.IcosahedronGeometry(1, 4)), pa = geo.attributes.position;
      for (i = 0; i < pa.count; i++) {
        var v = new T.Vector3().fromBufferAttribute(pa, i);
        var n = 1 + 0.16 * Math.sin(v.x * 5.1 + v.y * 3.3) + 0.12 * Math.sin(v.z * 7.3 - v.x * 2.1) + 0.07 * Math.sin(v.y * 11.0 + v.z * 9.0);
        pa.setXYZ(i, v.x * n, Math.max(-0.2, v.y) * n, v.z * n);
      }
      geo.computeVertexNormals();
      var mat = z(new T.MeshStandardMaterial({ color: 0x3a342f, roughness: 1, metalness: 0, flatShading: true }));
      A.kolorSkaly = new T.Color(0x3a342f); A.kolorWody = new T.Color(0x0c2a3c); A.mat = mat;
      // [start na torze km, pół-szerokość km, pół-grubość km, pół-długość km] — płaskie jęzory rumoszu, nie bryły
      A.masy = [[A.sBrzeg + 2.0, 1.6, 0.08, 2.4], [A.sBrzeg + 0.8, 1.9, 0.09, 2.8], [Math.max(0, A.sBrzeg - 4.0), 2.3, 0.12, 3.4]].map(function (m) {
        var mesh = new T.Mesh(geo, mat); mesh.userData.m = m; mesh.castShadow = false; mesh.receiveShadow = true; mesh.visible = false;
        A.grupa.add(mesh); return mesh;
      });
      A.pyl = przenies(czastki(220, { okres: 14, wznos: [-0.6, 2.2, 1.0], rozrzut: [1.6, 0, 3.0], rozmiar: 1.1, krycie: 0.5,
        kolorA: [0.2, 0.17, 0.14], kolorB: [0.26, 0.24, 0.22], podswietl: [0, 0, 0] }, 61), A.grupa);
      A.fale = [przenies(pierscien(1), A.grupa), przenies(pierscien(2), A.grupa), przenies(pierscien(3), A.grupa)];
      return A;
    }
    function a3Osuwisko(f, t_s) {
      var A = zbudowane.a3 || zbudujA3();
      pokaz('a3');
      var j = (dane.jednostki || []).filter(function (x) { return x.id === 'dolina-icod'; })[0];
      var zap = j && j.zapadniecie ? j.zapadniecie : { Ma: 0.17, wypelnienie_m: 500 };
      var o = osuwisko(f, zap.wypelnienie_m), t = zegar(t_s), e = sc.przewyzszenie();
      sc.czas(zap.Ma + 0.0005);                               // tuż przed zapadnięciem: zbocze z wypełnieniem
      sc.efekty.wypelnienie('dolina-icod', 1 - o.opadniecie_m / zap.wypelnienie_m);
      A.masy.forEach(function (mesh, k) {
        var m = mesh.userData.m, p = o.etapy[k], s = m[0] + ETAPY[k][2] * p, q = A.punkt(s), q2 = A.punkt(s + 0.3);
        mesh.visible = p > 0.001;
        // jęzor leży na dnie/zboczu (pod wodą nie wystaje ponad taflę), rozpływa się w wachlarz
        var yd = wys(q[0], q[1]), yM = yd + m[2] * 0.3 * e;
        if (yd < 0) yM = Math.min(yM, -m[2] * 1.2 * e);
        mesh.position.set(q[0], yM, q[1]);
        mesh.scale.set(m[1] * (1 + 0.5 * p), m[2] * e, m[3] * (1 + 0.8 * p));
        mesh.rotation.y = Math.atan2(q2[0] - q[0], q2[1] - q[1]);
      });
      // masa pod wodą tonie w barwie wody (materiał bez mgły wodnej terenu — przybliżenie: głębokość środka najświeższej masy)
      var akt = A.masy[o.etap - 1], gl = akt.visible ? Math.max(0, -akt.position.y) / e : 0;
      A.mat.color.copy(A.kolorSkaly).lerp(A.kolorWody, Math.min(0.85, 0.35 + gl / 1.0) * (gl > 0 ? sc.szklo() : 0));
      // pył nad doliną w etapie nadwodnym
      var srodek = A.punkt(Math.max(0, A.sBrzeg - 3)), pp = A.pyl.geometry.attributes.position, los = losowy(67);
      for (var i = 0; i < pp.count; i++) { pp.array[i * 3] = srodek[0] + (los() - 0.5) * 5; pp.array[i * 3 + 1] = wys(srodek[0], srodek[1]) * 0.6 + 0.1; pp.array[i * 3 + 2] = srodek[1] + (los() - 0.5) * 5; }
      pp.needsUpdate = true;
      A.pyl.material.uniforms.uWznos.value.set(-0.6, 2.2 * e, 1.0);
      ustawCzastki(A.pyl, t, o.pyl);
      // fale (model poglądowy): pierścień od miejsca wejścia każdej masy do wody, promień rośnie z postępem etapu
      var wej = A.punkt(A.sBrzeg + 0.5);
      A.fale.forEach(function (r, k) {
        var p = o.etapy[k], sila = p > 0.02 ? (1 - gladko(0.6, 1, p)) * (k === 2 ? 1 : 0.45) : 0;
        r.visible = sila > 0.01;
        r.position.set(wej[0], 0.004, wej[1]); r.scale.setScalar(1 + p * (k === 2 ? 30 : 10));
        r.material.uniforms.uSila.value = sila; r.material.uniforms.uCzas.value = t;
      });
      return o;
    }

    /* ---------- A4: morze chmur ---------- */
    function zbudujA4() {
      var A = podgrupa('a4');
      var tx = sc.tekstury, gw = sc.granice.wyspa;
      A.warstwy = WARSTWY_CHMUR.map(function (W, k) {
        var u = T.UniformsUtils.merge([T.UniformsLib.fog, { uWysW: { value: null }, uProstW: { value: tx.prostW }, uRozmW: { value: tx.rozmW },
          uCzas: { value: 0 }, uStrop: { value: W.strop_km }, uWarstwa: { value: W.gest }, uKrycie: { value: k === 1 ? 0.97 : k === 2 ? 0.6 : 0.95 },
          uSlonce: { value: new T.Vector3() }, uKolorSlonca: { value: new T.Vector3(1, 1, 1) }, uAmb: { value: new T.Vector3(0.3, 0.3, 0.3) } }]);
        u.uWysW.value = tx.wysW; u.uProstW.value = tx.prostW; u.uRozmW.value = tx.rozmW;
        var m = z(new T.ShaderMaterial({ uniforms: u, vertexShader: CHMURY_VERT, fragmentShader: chmuryFrag(wspolne, GS.GLSL_CHMURY_A4),
          transparent: true, depthWrite: false, side: T.DoubleSide, fog: true }));
        var mesh = new T.Mesh(z(new T.PlaneGeometry(gw.x1 - gw.x0 + 60, gw.z1 - gw.z0 + 60, 1, 1)), m);
        mesh.rotation.x = -Math.PI / 2; mesh.position.set((gw.x0 + gw.x1) / 2, 0, (gw.z0 + gw.z1) / 2);
        mesh.renderOrder = 2 + (k === 1 ? 0 : k === 0 ? 1 : 2); mesh.frustumCulled = false; mesh.name = 'chmury-a4-' + k;
        A.grupa.add(mesh);
        return { mesh: mesh, W: W };
      });
      return A;
    }
    function a4MorzeChmur(f, t_s) {
      var A = zbudowane.a4 || zbudujA4();
      pokaz('a4');
      var e = sc.przewyzszenie(), cz = 60 + 160 * clamp01(+f || 0) + 0.05 * (zegar(t_s) % 1000);
      var w = sc.uniformySwiatla();
      A.warstwy.forEach(function (L) {
        var u = L.mesh.material.uniforms;
        L.mesh.position.y = L.W.strop_km * e;
        u.uCzas.value = cz; u.uSlonce.value.copy(w.kier); u.uKolorSlonca.value.copy(w.slonce); u.uAmb.value.copy(w.amb);
      });
      sc.chmury(false);
      sc.efekty.cienChmur(0.55, WARSTWY_CHMUR[0].strop_km, cz);
      return { czas: cz, warstwy: WARSTWY_CHMUR.map(function (W) { return W.strop_km; }) };
    }

    /* ---------- A5: noc nad Teide ---------- */
    function zbudujA5() {
      var A = podgrupa('a5');
      var G = root.GeologiaGwiazdy, d = G ? G.dane : [], n = Math.floor(d.length / 4);
      if (n < 300) console.error('Geologia: katalog gwiazd ma ' + n + ' gwiazd (spec: ≥ 300)');
      var pos = new Float32Array(n * 3), gw = new Float32Array(n * 4);
      for (var i = 0; i < n; i++) {
        gw[i * 4] = d[i * 4] * RAD; gw[i * 4 + 1] = d[i * 4 + 1] * RAD; gw[i * 4 + 2] = d[i * 4 + 2]; gw[i * 4 + 3] = d[i * 4 + 3];
        pos[i * 3 + 1] = 1;
      }
      var g = z(new T.BufferGeometry());
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aGw', new T.BufferAttribute(gw, 4));
      var uN = { uLat: { value: LAT_TEIDE * RAD }, uLst: { value: 0 }, uPx: { value: 1 }, uCzas: { value: 0 }, uSila: { value: 0 } };
      A.gwiazdy = new T.Points(g, z(new T.ShaderMaterial({ uniforms: uN, vertexShader: GWIAZDY_VERT, fragmentShader: GWIAZDY_FRAG,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, toneMapped: false })));
      A.gwiazdy.frustumCulled = false; A.gwiazdy.renderOrder = -998; A.gwiazdy.name = 'gwiazdy';
      var uD = { uLat: uN.uLat, uLst: uN.uLst, uSila: { value: 0 } };
      A.droga = new T.Mesh(z(new T.SphereGeometry(1, 96, 48)), z(new T.ShaderMaterial({ uniforms: uD, vertexShader: KIER_VERT, fragmentShader: drogaFrag(wspolne),
        side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, toneMapped: false })));
      A.droga.frustumCulled = false; A.droga.renderOrder = -999; A.droga.name = 'droga-mleczna';
      A.grupa.add(A.droga); A.grupa.add(A.gwiazdy);
      A.n = n;
      return A;
    }
    function a5Noc(f, t_s) {
      var A = zbudowane.a5 || zbudujA5();
      pokaz('a5');
      f = clamp01(+f || 0);
      var kop = sc.dekoracje.kopula, Rk = kop.scale.x;      // kopuła nieba: promień 1,2 dysku, środek w kamerze
      A.gwiazdy.position.copy(kop.position); A.gwiazdy.scale.setScalar(Rk * 0.92);
      A.droga.position.copy(kop.position); A.droga.scale.setScalar(Rk * 0.96);
      var l = lst(DATA_A5 + f * 1.5 * 3600000, LON_TEIDE), sila = gladko(0, 0.35, f);
      var u = A.gwiazdy.material.uniforms;
      u.uLst.value = l * RAD; u.uPx.value = pikselStrony(); u.uCzas.value = zegar(t_s); u.uSila.value = sila;
      A.droga.material.uniforms.uSila.value = sila;
      return { lst: l, gwiazdy: A.n, sila: sila };
    }

    function ukryj() {
      pokaz(null);
      Object.keys(miasta).forEach(function (k) { miasta[k].pts.visible = false; miasta[k].wlaczone = false; });
    }
    function zwolnij() {
      ukryj();
      sc.scena.remove(grupa);
      zasoby.forEach(function (x) { if (x && x.dispose) x.dispose(); });
      zasoby.length = 0;
      zbudowane = {}; miasta = {};
    }
    return { a1Powstanie: a1Powstanie, a2Lawa1706: a2Lawa1706, a3Osuwisko: a3Osuwisko, a4MorzeChmur: a4MorzeChmur, a5Noc: a5Noc,
      swiatlaMiasta: swiatlaMiasta, ukryj: ukryj, zwolnij: zwolnij, stan: function () { return { aktywna: aktywna }; } };
  }
  root.GeologiaAnimacje = { utworz: utworz, DATA_A5: DATA_A5, WARSTWY_CHMUR: WARSTWY_CHMUR, EMISJA: EMISJA };
})(typeof window !== 'undefined' ? window : globalThis);
