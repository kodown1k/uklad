'use strict';
/* Zakładka Myśliwce — kino pokazu: kadr 2.39:1, harmonogram i warstwa napisów, kamera pościgowa, post obrazu.
   Plik dual-export: całość ładuje się w node (testy), część z THREE/DOM dostaje je w argumentach. W przeglądarce
   window.MysliwceKino — NIE window.Kino, które należy do filmu Voyagera (kino.js w korzeniu, ~33 odwołania w solar.js);
   poniżej „Kino” to skrót tej nazwy (test/globalne-nazwy.test.js pilnuje unikalności nazw globalnych).
   Czyste:
     Kino.kadrKinowy(w, h, proporcja=2.39) → { x, y, w, h, pasGora, pasDol, tryb: 'pasy'|'pelny' } — poziomo kadr 2.39:1
       z równymi pasami (okno szersze niż 2.39 → pasy po bokach, pasGora = pasDol = 0); telefon w pionie (h > w) → pełny.
     Kino.harmonogram(wersy, { start=0, tempo=15 zn/s, min=2.2 s, przerwa=0.35 s }) → [{ id, start, koniec }] — czas
       wersu z długości tekstu (nie krótszy niż min), `wers.czas` (lektor) wygrywa; wersy po kolei, z przerwą.
     Kino.kameraPoscigu(t, klucze) → { poz, cel, fov, azymut, elewacja, odleglosc } w UKŁADZIE SAMOLOTU (x = nos, y = góra).
       Klucz: { t [s], azymut [°] (0 = przed nosem, 90 = strona +z, 180 = za ogonem), elewacja [°] (+ = nad), odleglosc [m]
       od celu, cel [x,y,z] (punkt samolotu, na który patrzy kamera), fov [°], oddech? 0..1 (kinowy „handheld”) }.
       Kamera krąży wokół celu: poz = cel + odleglosc·(cos e·cos a, sin e, cos e·sin a). Interpolacja: hermitowska
       Catmull-Rom w czasie (niejednorodne odstępy kluczy), azymut po rozwinięciu na najkrótszą drogę (350° → 10° przez 0°),
       styczne ograniczone Fritscha-Carlsona (bez przestrzeleń, odległość nie spada pod klucze), na końcach zero (start
       i stop bez szarpnięcia); cel wygładzony — styczne ×0,5. Przed pierwszym / po ostatnim kluczu — klucz skrajny.
       Oddech: suma trzech sinusów o niewspółmiernych częstotliwościach (0,21 / 0,53 / 1,37 Hz) — azymut ±0,8°,
       elewacja ±0,5°, cel ±0,6% odległości, × oddech klucza (interpolowany jak reszta). Czysta funkcja czasu: te same
       t i klucze → ten sam kadr (determinizm haków i zrzutów).
     Kino.doSwiata(pozSamolotu, kwaternion [x,y,z,w], punktLokalny) → [x,y,z] świata.
     Kino.rzutZrodla(zrodlo, widok[16], rzut[16], dl?) → { a:[u,v], b:[u,v], ra, rb, sila, iskra } | null — stożek gorąca na
       ekranie (uv 0..1, promienie w ułamku wysokości kadru); macierze kolumnami jak `elements` w THREE.
   Przeglądarkowe (THREE r128 i renderer w argumencie, bez dodatków z CDN):
     Kino.post(THREE, renderer) → { renderuj(scena, kamera, { czas, zrodlaGoraca }), rozmiar(w?, h?), jakosc('pelna'|'lekka'),
       stan() → { aktywny, jakosc, powod }, zwolnij() }.
       scena → rtScena (MSAA w WebGL2, kodowanie wyjścia renderera — post pracuje na wartościach sRGB, jak ekran)
       → iskra ½ (w obrysie każdej strugi: pasmo jasności WZDŁUŻ osi strugi = diamenty Macha i przerwy między nimi)
       → blask (iskra rozmyta, dodatnia część) → poświata ¼ (próg luminancji 0,85, rozmycie ×2) → złożenie: falowanie
       gorąca (tylko pełna jakość), iskra ze znakiem (kontrast diamentów), blask, poświata, winieta, ziarno.
       Zwykły bloom z progu nie wyciąga diamentów: płaszcz z boku ma już 240–255 sRGB, diamenty +6–8 — dodane światło ginie
       w nasyceniu, a próg łapie cały płaszcz (recepta i liczby: docs/material-filmowy.md, „Post kina”).
       `zrodlaGoraca` = Silniki.utworz(...).zrodlaGoraca() ([{ poz, kierunek, sila }] w świecie; opcjonalne `dl` [m] =
       długość płomienia przy bieżącym ciągu, np. Ogien.wymiary(wylot, ciag).dl — bez niej DL_GORACA), najwyżej MAKS_ZRODEL.
       Iskra pracuje do 0,75 dl, falowanie do 1,5 dl. Iskra tylko na płomieniu: maska kątowa (rzutZrodla: struga w kamerę
       albo od niej, koniec stożka za kamerą → 0) i maska alfy sceny (ogien.js zapisuje gęstość płomienia w alfie celu,
       z testem głębi); bez strug z iskrą jej przebiegi są pomijane. Poświata mieszana ekranem (nie wybiela wylotów).
       Bezpieczny powrót: błąd budowy, wyjątek w klatce albo program postu, który się nie skompilował → zwykły
       renderer.render i JEDNO console.warn('Myśliwce: post wyłączony (…)'); dalej już tylko zwykły render.
     Kino.napisy(kontener) → { pokaz(wers | tekst | null), tytul(tekst | null), kadr(kadrKinowy), zwolnij() } — wersy
       i plansza tytułu w DOM wyłącznie przez textContent; styl .my-kino* w mysliwce/mysliwce.css. */
(function (root) {
  var PROPORCJA = 2.39;
  var MAKS_ZRODEL = 6;
  var DL_GORACA = 6.5;        // [m] długość płomienia, gdy źródło nie podaje `dl` (pełny dopalacz: F-47 4,5 … Su-75 8,6 m; F-22 5,75)
  var R0_GORACA = 0.5;        // [m] promień stożka u wylotu
  var ROZROST_GORACA = 0.22;  // [m/m] rozrost promienia z prądem
  // Post (wartości sRGB 0..1, liczone na zrzutach F-22 z dopalaczem — patrz docs/material-filmowy.md)
  var POST = { prog: 0.85, kolano: 0.15, poswiata: 0.12, iskraProg: 0.62, iskraOkno: 0.0625, kontrast: 1.5, blask: 5.0,
    winieta: 0.38, ziarno: 0.032, falowanie: 0.05, falowanieMaks: 0.0035 };

  function przytnij(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gladko(a, b, x) { var u = przytnij((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); }

  /* ---------- kadr ---------- */
  function kadrKinowy(w, h, proporcja) {
    var p = proporcja > 0 ? proporcja : PROPORCJA;
    w = Math.max(0, Math.floor(w) || 0); h = Math.max(0, Math.floor(h) || 0);
    // pion telefonu i okna bliskie kwadratu (w/h < 1,5: kwadrat, 4:3) — pełny kadr; pasy zjadałyby 44–58% wysokości
    if (h > w || !(w >= 1.5 * h)) return { x: 0, y: 0, w: w, h: h, pasGora: 0, pasDol: 0, tryb: 'pelny' };
    if (h > 0 && w / h >= p) {
      var kw = Math.min(w, Math.round(h * p));
      return { x: Math.floor((w - kw) / 2), y: 0, w: kw, h: h, pasGora: 0, pasDol: 0, tryb: 'pasy' };
    }
    var pas = Math.max(0, Math.round((h - w / p) / 2));
    if (pas < 0.01 * h) pas = 0;                                      // pas węższy niż 1% wysokości (2560×1080 → 4 px) — bez pasów
    return { x: 0, y: pas, w: w, h: h - 2 * pas, pasGora: pas, pasDol: pas, tryb: 'pasy' };
  }

  /* ---------- napisy: harmonogram ---------- */
  function harmonogram(wersy, o) {
    o = o || {};
    var t = +o.start || 0, tempo = o.tempo > 0 ? o.tempo : 15, min = o.min != null ? +o.min : 2.2, przerwa = o.przerwa != null ? +o.przerwa : 0.35;
    return (wersy || []).map(function (w, i) {
      var tekst = typeof w === 'string' ? w : String((w && w.tekst) || '');
      var dur = w && w.czas > 0 ? +w.czas : Math.max(min, tekst.length / tempo);
      var h = { id: w && w.id != null ? w.id : i, start: t, koniec: t + dur };
      t = h.koniec + przerwa;
      return h;
    });
  }

  /* ---------- kamera pościgowa ---------- */
  // Styczne Catmull-Rom w czasie (niejednorodnym) × napięcie, ograniczone Fritschem-Carlsonem: ekstremum lokalne klucza
  // = styczna 0, |α|² + |β|² ≤ 9 na odcinku → krzywa monotoniczna między kluczami (bez przestrzeleń).
  function styczne(ts, ps, napiecie) {
    var n = ps.length, m = new Array(n), d = [], i;
    for (i = 0; i < n - 1; i++) d.push(ts[i + 1] > ts[i] ? (ps[i + 1] - ps[i]) / (ts[i + 1] - ts[i]) : 0);
    m[0] = 0; m[n - 1] = 0;
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : napiecie * (ps[i + 1] - ps[i - 1]) / (ts[i + 1] - ts[i - 1]);
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { var tau = 3 / Math.sqrt(s); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
    }
    return m;
  }
  function hermite(p0, p1, m0, m1, h, s) {
    var s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * h * m1;
  }
  function kanal(ts, ps, m, i, s) { return hermite(ps[i], ps[i + 1], m[i], m[i + 1], ts[i + 1] - ts[i], s); }
  var DWA_PI = 2 * Math.PI, ST = Math.PI / 180;
  function oddechFal(t, faza) {
    return 0.6 * Math.sin(DWA_PI * 0.21 * t + faza) + 0.3 * Math.sin(DWA_PI * 0.53 * t + 1.7 * faza + 0.4) + 0.1 * Math.sin(DWA_PI * 1.37 * t + 2.9 * faza + 1.1);
  }
  function kameraPoscigu(t, klucze) {
    var k = (klucze || []).slice().sort(function (a, b) { return a.t - b.t; });
    if (!k.length) throw new Error('Kino.kameraPoscigu: brak kluczy');
    k.forEach(function (x, i) {
      if (!(+x.odleglosc > 0) || !isFinite(+x.odleglosc) || !isFinite(+x.fov) || !x.cel || x.cel.length < 3)
        throw new Error('Kino.kameraPoscigu: klucz ' + i + ' bez odleglosc / fov / cel');
    });
    var n = k.length, ts = k.map(function (x) { return +x.t || 0; });
    // azymut rozwinięty: każdy klucz w ±180° od poprzedniego (najkrótsza droga)
    var az = [+k[0].azymut || 0];
    for (var j = 1; j < n; j++) { var r = (+k[j].azymut || 0) - az[j - 1]; r -= 360 * Math.round(r / 360); az.push(az[j - 1] + r); }
    var kan = {
      az: az, el: k.map(function (x) { return +x.elewacja || 0; }), d: k.map(function (x) { return +x.odleglosc; }),
      fov: k.map(function (x) { return +x.fov; }), od: k.map(function (x) { return +x.oddech || 0; }),
      cx: k.map(function (x) { return x.cel[0]; }), cy: k.map(function (x) { return x.cel[1]; }), cz: k.map(function (x) { return x.cel[2]; }),
    };
    var w = {}, nazwa;
    if (n === 1 || t <= ts[0] || t >= ts[n - 1]) {
      var e = n === 1 || t <= ts[0] ? 0 : n - 1;
      for (nazwa in kan) w[nazwa] = kan[nazwa][e];
    } else {
      var i = 0;
      while (i < n - 2 && t >= ts[i + 1]) i++;
      var h = ts[i + 1] - ts[i], s = h > 0 ? (t - ts[i]) / h : 1;
      for (nazwa in kan) w[nazwa] = kanal(ts, kan[nazwa], styczne(ts, kan[nazwa], nazwa.charAt(0) === 'c' ? 0.5 : 1), i, s);
    }
    var cel = [w.cx, w.cy, w.cz], a = w.az, el = w.el, d = Math.max(1e-3, w.d);
    if (w.od > 0) {
      a += w.od * 0.8 * oddechFal(t, 0);
      el += w.od * 0.5 * oddechFal(t, 2.1);
      var c = w.od * 0.006 * d;
      cel = [cel[0] + c * oddechFal(t, 4.2), cel[1] + c * oddechFal(t, 5.3), cel[2] + c * oddechFal(t, 6.4)];
    }
    var ar = a * ST, er = el * ST, ce = Math.cos(er);
    return {
      poz: [cel[0] + d * ce * Math.cos(ar), cel[1] + d * Math.sin(er), cel[2] + d * ce * Math.sin(ar)],
      cel: cel, fov: w.fov, azymut: ((a % 360) + 360) % 360, elewacja: el, odleglosc: d,
    };
  }

  /* ---------- układ samolotu → świat ---------- */
  function doSwiata(poz, q, p) {
    var qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    // v' = v + w·t + q×t, t = 2·(q×v)
    var tx = 2 * (qy * p[2] - qz * p[1]), ty = 2 * (qz * p[0] - qx * p[2]), tz = 2 * (qx * p[1] - qy * p[0]);
    return [poz[0] + p[0] + qw * tx + (qy * tz - qz * ty), poz[1] + p[1] + qw * ty + (qz * tx - qx * tz), poz[2] + p[2] + qw * tz + (qx * ty - qy * tx)];
  }

  /* ---------- źródło gorąca → ekran ---------- */
  function mnoz4(m, p) {   // m kolumnami, p = [x,y,z,1]
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14], m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]];
  }
  function rzutZrodla(z, widok, rzut, dl) {
    if (!z || !(z.sila > 0) || !widok || !rzut) return null;
    var L = z.dl > 0 ? z.dl : dl > 0 ? dl : DL_GORACA, k = z.kierunek;
    var A = mnoz4(widok, z.poz), B = mnoz4(widok, [z.poz[0] + k[0] * L, z.poz[1] + k[1] * L, z.poz[2] + k[2] * L]);
    var BLISKO = -0.05, rb0 = R0_GORACA + ROZROST_GORACA * L, przyciety = false;
    if (A[2] > BLISKO) return null;                                   // wylot za kamerą (albo w niej)
    // maska iskry: sinus kąta struga–promień widzenia. Struga patrząca w kamerę (od tyłu) albo od niej rzutuje się w krótki
    // odcinek o ogromnym obrysie — średnia „wzdłuż osi” jest wtedy średnią po posadzce i krawędziach, nie po diamentach.
    var kx = B[0] - A[0], ky = B[1] - A[1], kz = B[2] - A[2], kd = Math.hypot(kx, ky, kz) || 1, ad = Math.hypot(A[0], A[1], A[2]) || 1;
    var cx = (ky * A[2] - kz * A[1]) / (kd * ad), cy = (kz * A[0] - kx * A[2]) / (kd * ad), cz = (kx * A[1] - ky * A[0]) / (kd * ad);
    var iskra = gladko(0.35, 0.7, Math.hypot(cx, cy, cz));
    if (B[2] > BLISKO) {
      przyciety = true;                                              // koniec stożka za kamerą — przytnij do bliskiej płaszczyzny
      var u = (A[2] - BLISKO) / (A[2] - B[2]);
      B = [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, BLISKO];
      rb0 = R0_GORACA + ROZROST_GORACA * L * u;
    }
    function ekran(p) { var c = mnoz4(rzut, p); return [0.5 + 0.5 * c[0] / c[3], 0.5 + 0.5 * c[1] / c[3]]; }
    return { a: ekran(A), b: ekran(B), ra: R0_GORACA * rzut[5] / (-2 * A[2]), rb: rb0 * rzut[5] / (-2 * B[2]), sila: przytnij(z.sila, 0, 1),
      iskra: przyciety ? 0 : iskra };                                // koniec stożka za kamerą: obrys na pół ekranu — bez iskry
  }

  /* ---------- post obrazu (przeglądarka; THREE i renderer w argumentach) ---------- */
  var WIERZ = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  var LUM = 'float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }';
  var SRODEK = '#define SRODEK (128.0 / 255.0)';   // zero iskry ze znakiem w RGBA8
  // stożki źródeł gorąca na ekranie (Kino.rzutZrodla): uZA[i] = (u, v, ra, sila) u wylotu, uZB[i] = (u, v, rb, iskra) na końcu
  // (iskra = maska kątowa 0..1 z rzutZrodla; falowania nie dotyczy)
  var ZRODLA = 'uniform float uAsp; uniform vec4 uZA[' + MAKS_ZRODEL + ']; uniform vec4 uZB[' + MAKS_ZRODEL + ']; uniform int uZn;';
  // zejście rozdzielczości (4 próbki) z progiem na luminancji
  var FRAG_JASNE = [
    'uniform sampler2D tD; uniform vec2 uTex; uniform float uProg; uniform float uKolano; varying vec2 vUv;', LUM,
    'vec3 j(vec2 o){ vec3 c = texture2D(tD, vUv + o * uTex).rgb; return c * smoothstep(uProg, uProg + uKolano, lum(c)); }',
    'void main(){ gl_FragColor = vec4((j(vec2(-0.5,-0.5)) + j(vec2(0.5,-0.5)) + j(vec2(-0.5,0.5)) + j(vec2(0.5,0.5))) * 0.25, 1.0); }',
  ].join('\n');
  // iskra (½): w obrysie strugi pasmo jasności WZDŁUŻ jej osi — średnia bliska (3 próbki ±0,2 okna: gasi cienkie linie
  // posadzki i paneli w poprzek osi) minus średnia daleka (9 próbek w oknie ±uOkno długości stożka ≈ jedna komórka
  // diamentu). Zostają diamenty Macha i przerwy między nimi, nie przekrój strugi (oś zawsze jaśniejsza od brzegów, więc
  // średnia izotropowa rozjaśniała cały płaszcz). Różnica liczona na luminancji i oddawana w barwie płomienia (bez
  // fioletowych obwódek z różnic per kanał). Tylko gdzie okolica jest jasna (średnia > uProg) i tylko w pierwszych ~70%
  // stożka (diamenty kończą się przed 0,65 długości płomienia; dalej świecąca posadzka dawała smugi). Obrys strugi węższy
  // niż stożek falowania: 0,9 ra u wylotu → 0,45 rb na końcu (płomień rośnie ~0,08 m/m, stożek falowania 0,22 m/m).
  // Zapis ze znakiem: 128/255 + 2·różnica (RGBA8: zero dokładnie w 128, krok ½ poziomu sRGB, zakres ±0,25).
  var FRAG_ISKRA = [
    SRODEK, 'uniform sampler2D tD; uniform float uProg; uniform float uOkno; varying vec2 vUv;', ZRODLA, LUM,
    'float odbij(float u, float o){ return u + o < 0.0 ? -2.0 * u - o : o; }',
    'void main(){',
    '  vec2 q = vec2(vUv.x * uAsp, vUv.y); vec3 hp = vec3(0.0); float suma = 0.0;',
    '  for (int i = 0; i < ' + MAKS_ZRODEL + '; i++) {',
    '    if (i >= uZn) break;',
    '    vec4 a = uZA[i], b = uZB[i];',
    '    vec2 A = vec2(a.x * uAsp, a.y), AB = vec2(b.x * uAsp, b.y) - A;',
    '    float L2 = dot(AB, AB); if (L2 < 1e-6 || b.w <= 0.0) continue;',
    '    float u = dot(q - A, AB) / L2, uc = clamp(u, 0.0, 1.0), r = max(mix(0.9 * a.z, 0.45 * b.z, uc), 1e-4), d = length(q - (A + AB * uc));',
    '    float w = a.w * b.w * smoothstep(-0.02, 0.03, u) * (1.0 - smoothstep(0.55, 0.75, u)) * (1.0 - smoothstep(0.7 * r, r, d));',
    '    if (w <= 0.0) continue;',
    '    vec2 k = vec2(AB.x / uAsp, AB.y); float krok = uOkno * 0.25;',
    // próbki przed wylotem (u < 0: wnętrze dyszy, kadłub) odbite za wylot — inaczej średnia daleka u wylotu spada i iskra
    // rozjaśnia cały początek strugi
    '    vec3 sr = vec3(0.0), bl = (texture2D(tD, vUv + k * odbij(u, -0.8 * krok)).rgb + texture2D(tD, vUv).rgb + texture2D(tD, vUv + k * odbij(u, 0.8 * krok)).rgb) / 3.0;',
    '    for (int j = -4; j <= 4; j++) sr += texture2D(tD, vUv + k * odbij(u, krok * float(j))).rgb;',
    '    sr /= 9.0;',
    '    float ls = lum(sr), lb = lum(bl);',
    // maska płomienia z alfy sceny (ogien.js: alfa celu × (1 − gęstość)); bez płomienia na pikselu (posadzka, krawędzie
    // rynny, kadłub przed strugą) — bez iskry
    '    w *= smoothstep(uProg, uProg + 0.2, ls) * smoothstep(0.15, 0.5, 1.0 - texture2D(tD, vUv).a);',
    '    hp += bl / max(lb, 0.05) * (lb - ls) * w; suma += w;',
    '  }',
    '  hp /= max(1.0, suma);',
    '  gl_FragColor = vec4(clamp(SRODEK + 2.0 * hp, 0.0, 1.0), 1.0); }',
  ].join('\n');
  var FRAG_ROZM = [
    'uniform sampler2D tD; uniform vec2 uKier; varying vec2 vUv;',
    'void main(){ vec3 c = texture2D(tD, vUv).rgb * 0.227027;',
    '  c += (texture2D(tD, vUv + uKier * 1.3846).rgb + texture2D(tD, vUv - uKier * 1.3846).rgb) * 0.316216;',
    '  c += (texture2D(tD, vUv + uKier * 3.2308).rgb + texture2D(tD, vUv - uKier * 3.2308).rgb) * 0.070270;',
    '  gl_FragColor = vec4(c, 1.0); }',
  ].join('\n');
  var FRAG_KON = [
    SRODEK, 'uniform sampler2D tScena; uniform sampler2D tIskra; uniform sampler2D tBlask; uniform sampler2D tPoswiata;',
    'uniform float uIskraWl; uniform float uKontrast; uniform float uBlask; uniform float uPoswiata; uniform float uWinieta; uniform float uZiarno; uniform float uCzas;',
    'uniform float uFal; uniform float uFalMaks; uniform float uFalWl; uniform vec2 uRozm;', ZRODLA,
    'varying vec2 vUv;',
    'float los(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uCzas * 7.13) * 43758.5453); }',
    'float hasz(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float szum(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hasz(i), hasz(i + vec2(1.0, 0.0)), f.x), mix(hasz(i + vec2(0.0, 1.0)), hasz(i + vec2(1.0, 1.0)), f.x), f.y); }',
    // falowanie gorąca: w stożku za wylotem (1,5 długości płomienia) przesunięcie uv szumem unoszonym z prądem; siła ∝ sila źródła, narasta tuż za
    // wylotem, gaśnie w drugiej połowie stożka i ku jego brzegom; amplituda ∝ promieniowi na ekranie (z daleka słabnie),
    // z sufitem uFalMaks
    'vec2 falowanie(vec2 uv){',
    '  vec2 q = vec2(uv.x * uAsp, uv.y), off = vec2(0.0);',
    '  for (int i = 0; i < ' + MAKS_ZRODEL + '; i++) {',
    '    if (i >= uZn) break;',
    '    vec4 a = uZA[i], b = uZB[i];',
    '    vec2 A = vec2(a.x * uAsp, a.y), AB = (vec2(b.x * uAsp, b.y) - A) * 1.5;',
    '    float L2 = max(dot(AB, AB), 1e-8), u = dot(q - A, AB) / L2, uc = clamp(u, 0.0, 1.0);',
    '    float r = max(mix(a.z, a.z + (b.z - a.z) * 1.5, uc), 1e-4), d = length(q - (A + AB * uc));',
    '    float w = a.w * smoothstep(-0.04, 0.10, u) * (1.0 - smoothstep(0.45, 1.0, u)) * (1.0 - smoothstep(0.3 * r, r, d));',
    '    if (w <= 0.0) continue;',
    '    vec2 os = L2 > 1e-6 ? AB / sqrt(L2) : vec2(1.0, 0.0), pr = vec2(-os.y, os.x);',
    '    vec2 s = vec2(dot(q - A, os), dot(q - A, pr)) / max(a.z, 1e-4) * vec2(1.2, 2.4) - vec2(uCzas * 4.5, 0.0);',
    '    float nx = szum(s) + 0.5 * szum(s * 2.03 + 7.1) - 0.75, ny = szum(s + 13.7) + 0.5 * szum(s * 2.03 + 21.3) - 0.75;',
    '    off += (os * nx * 0.5 + pr * ny) * w * min(r * uFal, uFalMaks);',
    '  }',
    '  return uv + vec2(off.x / uAsp, off.y);',
    '}',
    'void main(){',
    '  vec2 uv = uFalWl > 0.5 && uZn > 0 ? falowanie(vUv) : vUv;',
    '  vec3 c = texture2D(tScena, uv).rgb;',
    // iskra ze znakiem (diamenty jaśniej, przerwy ciemniej) + blask = dodatnia część rozmytej iskry (poświata wokół
    // diamentów wychodzi poza brzeg strugi) + szeroka poświata najjaśniejszych partii
    // bez strug z iskrą (silniki stoją, widok od tyłu) przebiegi iskry są pomijane — ich tekstury nie są wtedy czytane
    '  if (uIskraWl > 0.5) c += (texture2D(tIskra, uv).rgb - SRODEK) * 0.5 * uKontrast + max(texture2D(tBlask, vUv).rgb - SRODEK, 0.0) * 0.5 * uBlask;',
    // poświata mieszana „ekranem” (1 − (1 − c)(1 − p)): wypełnia ciemną okolicę, nie dopycha prawie białych wylotów do bieli
    '  c = 1.0 - (1.0 - clamp(c, 0.0, 1.0)) * (1.0 - texture2D(tPoswiata, vUv).rgb * uPoswiata);',
    '  c = max(c, 0.0);',
    '  vec2 d = (vUv - 0.5) * vec2(1.0, 0.72);',
    '  c *= 1.0 - uWinieta * smoothstep(0.32, 0.72, length(d));',
    '  c += (los(floor(vUv * uRozm / 1.5)) - 0.5) * uZiarno;',
    '  gl_FragColor = vec4(c, 1.0); }',
  ].join('\n');

  function zbudujPost(T, renderer) {
    var zasoby = { rt: [], mat: [], geo: [], tex: [] };
    try {
      var opcjeRt = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat };
      var opcje = Object.assign({ depthBuffer: false, stencilBuffer: false }, opcjeRt);   // przebiegi pomocnicze bez głębi
      var RtScena = renderer.capabilities && renderer.capabilities.isWebGL2 && T.WebGLMultisampleRenderTarget
        ? T.WebGLMultisampleRenderTarget : T.WebGLRenderTarget;
      var rtScena = new RtScena(4, 4, opcjeRt);
      zasoby.rt.push(rtScena);
      rtScena.texture.encoding = renderer.outputEncoding;     // materiały kodują wyjście jak na ekran → post na sRGB
      // głębia 24 bity: r128 daje render targetowi bufor DEPTH_COMPONENT16 (kanwa ma 24) — z-fighting „piłą” na stykach
      // dysz i krawędziach (do Δ +100 sRGB względem zwykłego renderu). Typ tekstury głębi wybiera format bufora MSAA.
      if (rtScena.isWebGLMultisampleRenderTarget && T.DepthTexture) {
        rtScena.depthTexture = new T.DepthTexture(4, 4, T.UnsignedIntType);
        zasoby.tex.push(rtScena.depthTexture);
      }
      var rt = function () { var r = new T.WebGLRenderTarget(2, 2, opcje); zasoby.rt.push(r); return r; };
      var rtI = rt(), rtB = rt(), rtB2 = rt(), rtW = rt(), rtW2 = rt();   // ½: iskra, blask, pomocniczy; ¼: poświata, pomocniczy
      var kam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), sc = new T.Scene(), geo = new T.PlaneGeometry(2, 2);
      zasoby.geo.push(geo);
      var siatka = new T.Mesh(geo, null); siatka.frustumCulled = false; sc.add(siatka);
      var mat = function (frag, uni) {
        var m = new T.ShaderMaterial({ uniforms: uni, vertexShader: WIERZ, fragmentShader: frag, depthTest: false, depthWrite: false });
        zasoby.mat.push(m); return m;
      };
      // jedna tablica źródeł dzielona przez iskrę i złożenie (obiekty uniformów wspólne)
      var za = [], zb = [];
      for (var i = 0; i < MAKS_ZRODEL; i++) { za.push(new T.Vector4()); zb.push(new T.Vector4()); }
      var uZr = { uAsp: { value: 1 }, uZA: { value: za }, uZB: { value: zb }, uZn: { value: 0 } };
      var mJasne = mat(FRAG_JASNE, { tD: { value: null }, uTex: { value: new T.Vector2() }, uProg: { value: POST.prog }, uKolano: { value: POST.kolano } });
      var mIskra = mat(FRAG_ISKRA, { tD: { value: null }, uProg: { value: POST.iskraProg }, uOkno: { value: POST.iskraOkno },
        uAsp: uZr.uAsp, uZA: uZr.uZA, uZB: uZr.uZB, uZn: uZr.uZn });
      var mRozm = mat(FRAG_ROZM, { tD: { value: null }, uKier: { value: new T.Vector2() } });
      var mKon = mat(FRAG_KON, { tScena: { value: null }, tIskra: { value: null }, tBlask: { value: null }, tPoswiata: { value: null },
        uIskraWl: { value: 0 }, uKontrast: { value: POST.kontrast }, uBlask: { value: POST.blask }, uPoswiata: { value: POST.poswiata },
        uWinieta: { value: POST.winieta }, uZiarno: { value: POST.ziarno }, uCzas: { value: 0 },
        uFal: { value: POST.falowanie }, uFalMaks: { value: POST.falowanieMaks }, uFalWl: { value: 1 }, uRozm: { value: new T.Vector2(1, 1) },
        uAsp: uZr.uAsp, uZA: uZr.uZA, uZB: uZr.uZB, uZn: uZr.uZn });
    } catch (e) {
      zwolnijZasoby(zasoby);
      throw e;
    }
    var bufor = new T.Vector2(), w = 0, h = 0, jakosc = 'pelna', rozgrzany = false;
    function przebieg(m, cel) { siatka.material = m; renderer.setRenderTarget(cel); renderer.render(sc, kam); }
    // rozmycie Gaussa (z → pomoc → cel), `n` iteracji z rosnącym krokiem; kolejne iteracje cel → pomoc → cel
    function rozmyj(z, cel, pomoc, rw, rh, n) {
      for (var i = 0; i < n; i++) {
        mRozm.uniforms.tD.value = (i ? cel : z).texture; mRozm.uniforms.uKier.value.set((1 + i) / rw, 0); przebieg(mRozm, pomoc);
        mRozm.uniforms.tD.value = pomoc.texture; mRozm.uniforms.uKier.value.set(0, (1 + i) / rh); przebieg(mRozm, cel);
      }
    }
    var rp = [2, 2], rc = [2, 2];   // rozmiary buforów ½ i ¼
    function rozmiar(wx, hx) {
      var pr = renderer.getPixelRatio ? renderer.getPixelRatio() : 1;
      if (wx > 0 && hx > 0) { w = Math.max(2, Math.floor(wx * pr)); h = Math.max(2, Math.floor(hx * pr)); }   // jak setSize w three
      else { renderer.getDrawingBufferSize(bufor); w = Math.max(2, bufor.x | 0); h = Math.max(2, bufor.y | 0); }
      var pw = Math.max(2, Math.round(w / 2)), ph = Math.max(2, Math.round(h / 2)), cw = Math.max(2, Math.round(w / 4)), ch = Math.max(2, Math.round(h / 4));
      rtScena.setSize(w, h);
      if (rtScena.depthTexture) { rtScena.depthTexture.image.width = w; rtScena.depthTexture.image.height = h; }   // wymiary zgodne z celem (sam obraz nie jest realokowany)
      rtI.setSize(pw, ph); rtB.setSize(pw, ph); rtB2.setSize(pw, ph); rtW.setSize(cw, ch); rtW2.setSize(cw, ch);
      mKon.uniforms.uRozm.value.set(w, h); uZr.uAsp.value = w / h;
      rp[0] = pw; rp[1] = ph; rc[0] = cw; rc[1] = ch;
    }
    function zrodla(kamera, lista) {
      var n = 0, zIskra = 0;
      if (lista && lista.length && kamera && kamera.matrixWorldInverse && kamera.projectionMatrix) {
        for (var i = 0; i < lista.length && n < MAKS_ZRODEL; i++) {
          var z = rzutZrodla(lista[i], kamera.matrixWorldInverse.elements, kamera.projectionMatrix.elements);
          if (!z) continue;
          za[n].set(z.a[0], z.a[1], z.ra, z.sila); zb[n].set(z.b[0], z.b[1], z.rb, z.iskra); n++;
          if (z.iskra > 0) zIskra++;
        }
      }
      uZr.uZn.value = n;
      return zIskra;
    }
    return {
      zasoby: zasoby,
      rozmiar: rozmiar,
      // lekka: MSAA 2 zamiast 4 (zmiana próbek = ponowna alokacja bufora przy następnym renderze), blask bez rozmycia,
      // poświata ×1, bez falowania
      jakosc: function (j) {
        jakosc = j === 'lekka' ? 'lekka' : 'pelna';
        var s = jakosc === 'lekka' ? 2 : 4;
        if (rtScena.isWebGLMultisampleRenderTarget && rtScena.samples !== s) { rtScena.samples = s; rtScena.dispose(); }
      },
      // przebiegi: scena (pełna) → iskra ½ (w obrysach strug; pomijana bez strug z iskrą) → blask (rozmycie ×1)
      // → poświata ¼ z progu (rozmycie ×2) → złożenie na ekran.
      renderuj: function (scena, kamera, o) {
        renderer.getDrawingBufferSize(bufor);
        if (!w || (bufor.x | 0) !== w || (bufor.y | 0) !== h) rozmiar();
        var p = rp, c = rc, pelna = jakosc === 'pelna';
        renderer.setRenderTarget(rtScena); renderer.render(scena, kamera);
        var zIskra = zrodla(kamera, o && o.zrodlaGoraca);         // po renderze sceny: macierze kamery bieżące
        // pierwsza klatka przechodzi też przez iskrę (bez strug = zero ze znakiem): jej cele i program powstają od razu,
        // nie przy pierwszym płomieniu — liczniki zasobów renderera nie rosną potem przy włączeniu dopalacza
        if (zIskra || !rozgrzany) {
          rozgrzany = true;
          mIskra.uniforms.tD.value = rtScena.texture; mIskra.uniforms.uProg.value = POST.iskraProg; mIskra.uniforms.uOkno.value = POST.iskraOkno;
          przebieg(mIskra, rtI);
          if (pelna) rozmyj(rtI, rtB, rtB2, p[0], p[1], 1);
        }
        mKon.uniforms.uIskraWl.value = zIskra ? 1 : 0;
        var j = mJasne.uniforms;
        j.tD.value = rtScena.texture; j.uTex.value.set(1 / w, 1 / h); j.uProg.value = POST.prog; j.uKolano.value = POST.kolano;
        przebieg(mJasne, rtW);
        rozmyj(rtW, rtW, rtW2, c[0], c[1], pelna ? 2 : 1);
        var u = mKon.uniforms;
        u.tScena.value = rtScena.texture; u.tIskra.value = rtI.texture; u.tBlask.value = (pelna ? rtB : rtI).texture; u.tPoswiata.value = rtW.texture;
        u.uKontrast.value = POST.kontrast; u.uBlask.value = POST.blask; u.uPoswiata.value = POST.poswiata;
        u.uWinieta.value = POST.winieta; u.uZiarno.value = POST.ziarno; u.uFal.value = POST.falowanie; u.uFalMaks.value = POST.falowanieMaks;
        u.uFalWl.value = pelna ? 1 : 0; u.uCzas.value = (o && +o.czas) || 0;
        przebieg(mKon, null);
      },
      // program, który się nie skompilował (r128: diagnostics.runnable === false przy checkShaderErrors) — powód wyłączenia
      niesprawny: function () {
        if (!renderer.properties || !renderer.properties.get) return null;
        for (var i = 0; i < zasoby.mat.length; i++) {
          var pr = renderer.properties.get(zasoby.mat[i]), progi = [];
          if (pr) { if (pr.currentProgram) progi.push(pr.currentProgram); if (pr.program) progi.push(pr.program); if (pr.programs && pr.programs.forEach) pr.programs.forEach(function (x) { progi.push(x); }); }
          for (var k = 0; k < progi.length; k++) if (progi[k] && progi[k].diagnostics && progi[k].diagnostics.runnable === false) return 'shader postu się nie skompilował';
        }
        return null;
      },
    };
  }
  function zwolnijZasoby(z) {
    if (!z) return;
    ['rt', 'mat', 'geo', 'tex'].forEach(function (k) {
      (z[k] || []).forEach(function (x) { try { x.dispose(); } catch (_) { /* zwalniamy resztę */ } });
      z[k] = [];
    });
  }

  function post(T, renderer) {
    var p = null, stan = { aktywny: false, jakosc: 'pelna', powod: null }, ostrzezono = false, sprawdzony = false;
    function wylacz(e) {
      var powod = (e && e.message) || String(e);
      stan.aktywny = false; stan.powod = powod;
      if (p) { zwolnijZasoby(p.zasoby); p = null; }
      if (!ostrzezono) { ostrzezono = true; console.warn('Myśliwce: post wyłączony (' + powod + ')'); }
    }
    try { p = zbudujPost(T, renderer); stan.aktywny = true; } catch (e) { wylacz(e); }
    function zwykly(scena, kamera) {
      if (renderer.setRenderTarget) renderer.setRenderTarget(null);
      renderer.render(scena, kamera);
    }
    return {
      renderuj: function (scena, kamera, o) {
        if (!p) { zwykly(scena, kamera); return; }
        try {
          p.renderuj(scena, kamera, o);
          if (!sprawdzony) { sprawdzony = true; var zly = p.niesprawny(); if (zly) throw new Error(zly); }
        } catch (e) {
          wylacz(e);
          zwykly(scena, kamera);
        }
      },
      rozmiar: function (w, h) { if (p) { try { p.rozmiar(w, h); } catch (e) { wylacz(e); } } },
      jakosc: function (j) { stan.jakosc = j === 'lekka' ? 'lekka' : 'pelna'; if (p) p.jakosc(stan.jakosc); },
      stan: function () { return { aktywny: stan.aktywny, jakosc: stan.jakosc, powod: stan.powod }; },
      zwolnij: function () { if (p) { zwolnijZasoby(p.zasoby); p = null; } stan.aktywny = false; },
    };
  }

  /* ---------- napisy i plansza tytułu (DOM, tylko textContent) ---------- */
  function napisy(kontener) {
    var doc = kontener.ownerDocument || root.document;
    function el(tag, klasa, rodzic) { var e = doc.createElement(tag); e.className = klasa; rodzic.appendChild(e); return e; }
    var warstwa = el('div', 'my-kino', kontener);
    var tytul = el('div', 'my-kino-tytul', warstwa), tytulTekst = el('h2', 'my-kino-tytul-tekst', tytul);
    var wers = el('div', 'my-kino-wers', warstwa), wersTekst = el('p', 'my-kino-wers-tekst', wers);
    wers.setAttribute('aria-live', 'polite');
    tytul.hidden = true; wers.hidden = true;
    return {
      pokaz: function (w) {
        var t = w == null ? '' : typeof w === 'string' ? w : String(w.tekst || '');
        wersTekst.textContent = t; wers.hidden = !t;
      },
      tytul: function (t) { t = t == null ? '' : String(t); tytulTekst.textContent = t; tytul.hidden = !t; },
      // geometria kadru (Kino.kadrKinowy) → zmienne CSS: napisy w dolnym pasie, plansza na środku kadru
      kadr: function (k) {
        if (!k || !kontener.style || !kontener.style.setProperty) return;
        var s = kontener.style;
        s.setProperty('--my-kino-y', k.y + 'px'); s.setProperty('--my-kino-h', k.h + 'px');
        s.setProperty('--my-kino-pas-dol', k.pasDol + 'px');
      },
      zwolnij: function () { if (warstwa.parentNode) warstwa.parentNode.removeChild(warstwa); },
    };
  }

  var Kino = {
    PROPORCJA: PROPORCJA, MAKS_ZRODEL: MAKS_ZRODEL, DL_GORACA: DL_GORACA, POST: POST,
    kadrKinowy: kadrKinowy, harmonogram: harmonogram, kameraPoscigu: kameraPoscigu, doSwiata: doSwiata, rzutZrodla: rzutZrodla,
    post: post, napisy: napisy,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Kino;
  else root.MysliwceKino = Kino;   // nie `Kino`: tę nazwę ma film Voyagera (kino.js w korzeniu, solar.js)
})(typeof window !== 'undefined' ? window : globalThis);
