'use strict';
/* Zakładka Geologia — czas geologiczny: rzeźba w chwili tMa z jednostek (czysty moduł, bez DOM/THREE; dual-export:
   przeglądarka window.Ewolucja). Shader terenu w geologia/scena.js liczy to samo na GPU (GLSL_EWOLUCJA) — każda zmiana
   rachunku tu wymaga tej samej zmiany tam (test parytetu rachunku CPU: wysokoscKomorki = wysokoscWChwili).

   przynaleznosc(siatka, jednostki[, { pip, dno }]) → Uint8Array (indeks jednostki + 1, 0 = ocean):
     ląd (h > 0) = PIERWSZA jednostka, której wielokąt zawiera komórkę (jak indeksy jednostek sceny); ląd poza wielokątami
     i stok podmorski (dno < h ≤ 0, do 40 km od lądu) = jednostka najbliższej komórki lądu (transformata odległości
     z etykietami) — stok gmachu rośnie z nim, zamiast zostać dzisiejszym pierścieniem wokół pustego dna; dno głębsze niż
     `dno` = 0 (ocean, bez zmian w czasie).
   wysokoscWChwili(siatka, przyn, jednostki, tMa, dno = −3500) → Float32Array [m]; komórka jednostki u:
     cel X = h (+ wypelnienie_m, gdy tMa > zapadniecie.Ma — zbocze sprzed osuwiska; pod wodą wypełnienie maleje liniowo
       do zera na głębokości WYP_ZANIK_M — inaczej stok doliny pod wodą byłby płytą 500 m z prostymi ścianami);
     podstawa = u.podloze ? (rzeźba podłoża w tej chwili, z celem min(X, podloze.wys_m), rekurencyjnie) : min(dno, X)
       (ruling PODŁOŻE: wzrost od podłoża, nigdy od dna);
     tMa ≥ odMa → podstawa; tMa ≤ doMa → X; pomiędzy → podstawa + smoothstep(q)·(X − podstawa), gdzie q = postęp w przedziale
     wieku opóźniony o OPOZNIENIE·r (r = odległość od u.centrum / najdalsza komórka lądu jednostki; bez centrum r = 0):
     środek rośnie pierwszy, brzeg ostatni. Jednostka z `wynurzenie` (Ma zdarzenia, bez podłoża): odMa zastąpione
     wcześniejszym początkiem fazy podwodnej, tak żeby pierwsza komórka lądu przebiła taflę dokładnie w wynurzenie.Ma
     (parametry(): pole `od`; `odDanych` = odMa z danych).
     Stok podmorski (h ≤ 0) waży zmianę: h + w·(E − h), w = (h − dno) / 1000 m przycięte do 0…1 — głębokie dno prawie
     stoi, płytki stok rośnie w pełni. Na stoku granica dwóch jednostek (komórki Voronoi najbliższego lądu) byłaby prostym
     uskokiem dna, więc stok miesza dwie najbliższe jednostki: E = m·E₁ + (1 − m)·E₂,
     1 − m = ½·(1 − smoothstep(0; 6 km; d₂ − d₁))·smoothstep(0; 3 km; d₁) — na granicy dalej niż 3 km od lądu m = ½ z obu
     stron (ciągłość), przy brzegu własnego lądu m → 1 (stok ciągły z lądem; przy styku dwóch jednostek na brzegu uskok
     zostaje jak granica na lądzie). przynaleznosc() dokłada do tablicy pola `drugi` (Uint8Array, druga jednostka)
     i `waga` (Uint8Array, m·255; 255 = bez mieszania), `brzeg` (Uint8Array: stok — smoothstep(0; 3 km; d₁)·255). Na lądzie to samo w pasie 1,5 km po obu stronach granicy dwóch
     jednostek (m = ½ + ½·smoothstep(0; 1,5 km; d), d = odległość od granicy) — bez tego wielokąty mapy 1:1M stały
     w przeszłości pionowymi ścianami; jednostka z podłożem schodzi przy tym najwyżej do min(podłoże, 0 m).
   Chwila 0 zwraca siatka.wys co do bitu (tMa ≤ doMa każdej jednostki → X = h, h + w·0 = h). */
(function (root) {
  var DNO = -3500;
  var OPOZNIENIE = 0.5;          // brzeg jednostki z centrum startuje w połowie jej przedziału wieku
  var STOK_M = 1000;             // waga stoku podmorskiego: pełna od 1000 m nad dnem
  var STOK_KM = 40;              // stok podmorski przypisany do jednostki do 40 km od lądu
  var STOK_ZANIK_KM = 30;        // … z wagą malejącą od 30 km do zera na 40 km
  var MORZE_POD_M = 12;          // jak MORZE_POD_KM sceny: nic w (−12 m; 0 m] — współpłaszczyznowo z taflą (z-fighting)
  var MIESZANIE_KM = 6;          // szerokość mieszania dwóch jednostek na stoku (od granicy Voronoi)
  var BRZEG_KM = 3;              // przy brzegu własnego lądu mieszanie wygasa (stok ciągły z lądem)
  var MIESZANIE_LAD_KM = 1.5;    // na lądzie: pas mieszania przy granicy dwóch jednostek (po każdej stronie)
  var WYP_ZANIK_M = 500;         // wypełnienie zbocza sprzed osuwiska zanika pod wodą do tej głębokości
  var KM_NA_STOPIEN = 6371 * Math.PI / 180;
  var RAD = Math.PI / 180;

  function pipDomyslny() {
    if (root.CountryPick && root.CountryPick.pointInRing) return root.CountryPick.pointInRing;
    if (typeof require === 'function') return require('../country-pick.js').pointInRing;
    throw new Error('Ewolucja: brak CountryPick.pointInRing');
  }
  function lonKomorki(s, x) { return s.bbox.lonMin + (s.bbox.lonMax - s.bbox.lonMin) * x / (s.w - 1); }
  function latKomorki(s, y) { return s.bbox.latMax - (s.bbox.latMax - s.bbox.latMin) * y / (s.h - 1); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function przynaleznosc(s, jednostki, o) {
    o = o || {};
    var pip = o.pip || pipDomyslny(), dno = o.dno == null ? DNO : o.dno, w = s.w, h = s.h, n = w * h;
    var out = new Uint8Array(n);
    var pierscienie = jednostki.map(function (j) {
      return (j.wielokaty || []).map(function (r) {
        var b = [Infinity, Infinity, -Infinity, -Infinity];
        r.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); });
        return { r: r, b: b };
      });
    });
    var x, y, i, k, q;
    for (y = 0; y < h; y++) {
      var lat = latKomorki(s, y);
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (!(s.wys[i] > 0)) continue;
        var lon = lonKomorki(s, x);
        szukaj: for (k = 0; k < pierscienie.length && k < 255; k++) {
          for (q = 0; q < pierscienie[k].length; q++) {
            var P = pierscienie[k][q];
            if (lon < P.b[0] || lon > P.b[2] || lat < P.b[1] || lat > P.b[3]) continue;
            if (pip(lon, lat, P.r)) { out[i] = k + 1; break szukaj; }
          }
        }
      }
    }
    // transformata odległości z etykietami (fazowanie 8-sąsiedzkie, dwa przebiegi): źródła = ląd z jednostką
    var latSr = (s.bbox.latMin + s.bbox.latMax) / 2;
    var dx = (s.bbox.lonMax - s.bbox.lonMin) / (w - 1) * KM_NA_STOPIEN * Math.cos(latSr * RAD);
    var dz = (s.bbox.latMax - s.bbox.latMin) / (h - 1) * KM_NA_STOPIEN, dc = Math.hypot(dx, dz);
    var d = new Float32Array(n), et = new Uint8Array(n), zr = new Int32Array(n), INF = 1e9;
    for (i = 0; i < n; i++) { d[i] = out[i] ? 0 : INF; et[i] = out[i]; zr[i] = i; }
    function krok(i, j, c) { if (d[j] + c < d[i]) { d[i] = d[j] + c; et[i] = et[j]; zr[i] = zr[j]; } }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      if (x > 0) krok(i, i - 1, dx);
      if (y > 0) { krok(i, i - w, dz); if (x > 0) krok(i, i - w - 1, dc); if (x < w - 1) krok(i, i - w + 1, dc); }
    }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) {
      i = y * w + x;
      if (x < w - 1) krok(i, i + 1, dx);
      if (y < h - 1) { krok(i, i + w, dz); if (x < w - 1) krok(i, i + w + 1, dc); if (x > 0) krok(i, i + w - 1, dc); }
    }
    var stok = new Uint8Array(n);                   // 1 = komórka stoku (mieszana), 0 = ląd albo ocean
    for (i = 0; i < n; i++) {
      if (out[i]) continue;
      var v = s.wys[i];
      if (v > 0) out[i] = et[i];
      else if (v > dno && d[i] <= STOK_KM) { out[i] = et[i]; stok[i] = 1; }
    }
    // druga najbliższa jednostka stoku: transformata odległości osobno dla każdej jednostki (źródła = jej ląd)
    var d1 = new Float32Array(n), d2 = new Float32Array(n), drugi = new Uint8Array(n), waga = new Uint8Array(n), du = new Float32Array(n);
    for (i = 0; i < n; i++) { d1[i] = INF; d2[i] = INF; waga[i] = out[i] ? 255 : 0; }
    function krokU(i, j, c) { if (du[j] + c < du[i]) du[i] = du[j] + c; }
    for (k = 1; k <= Math.min(255, jednostki.length); k++) {
      var jest = false;
      for (i = 0; i < n; i++) { var zrodlo = out[i] === k && !stok[i]; du[i] = zrodlo ? 0 : INF; if (zrodlo) jest = true; }
      if (!jest) continue;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x;
        if (x > 0) krokU(i, i - 1, dx);
        if (y > 0) { krokU(i, i - w, dz); if (x > 0) krokU(i, i - w - 1, dc); if (x < w - 1) krokU(i, i - w + 1, dc); }
      }
      for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) {
        i = y * w + x;
        if (x < w - 1) krokU(i, i + 1, dx);
        if (y < h - 1) { krokU(i, i + w, dz); if (x < w - 1) krokU(i, i + w + 1, dc); if (x > 0) krokU(i, i + w - 1, dc); }
      }
      for (i = 0; i < n; i++) {
        if (!stok[i]) continue;
        if (k === out[i]) d1[i] = du[i];
        else if (du[i] < d2[i]) { d2[i] = du[i]; drugi[i] = k; }
      }
    }
    // granice jednostek na lądzie: pas MIESZANIE_LAD_KM po każdej stronie miesza się z sąsiadem (m = ½ na granicy) —
    // wielokąty mapy 1:1M bez tego dawały w przeszłości pionowe ściany wzdłuż granic (tarcza obok niezbudowanego dna)
    var dl = new Float32Array(n), inna = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      dl[i] = INF;
      if (!(s.wys[i] > 0) || !out[i]) continue;
      x = i % w; y = (i - x) / w;
      var sas = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (q = 0; q < 4; q++) { var j = sas[q]; if (j >= 0 && s.wys[j] > 0 && out[j] && out[j] !== out[i]) { dl[i] = 0; inna[i] = out[j]; break; } }
    }
    function krokL(i, j, c) { if (out[j] === out[i] && dl[j] + c < dl[i]) { dl[i] = dl[j] + c; inna[i] = inna[j]; } }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; if (!(s.wys[i] > 0)) continue;
      if (x > 0) krokL(i, i - 1, dx);
      if (y > 0) { krokL(i, i - w, dz); if (x > 0) krokL(i, i - w - 1, dc); if (x < w - 1) krokL(i, i - w + 1, dc); }
    }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) {
      i = y * w + x; if (!(s.wys[i] > 0)) continue;
      if (x < w - 1) krokL(i, i + 1, dx);
      if (y < h - 1) { krokL(i, i + w, dz); if (x < w - 1) krokL(i, i + w + 1, dc); if (x > 0) krokL(i, i + w - 1, dc); }
    }
    for (i = 0; i < n; i++) {
      if (!(s.wys[i] > 0) || !inna[i] || dl[i] >= MIESZANIE_LAD_KM) continue;
      var ml = Math.round((0.5 + 0.5 * gladkoKm(dl[i], MIESZANIE_LAD_KM)) * 255);
      if (ml < 255) { drugi[i] = inna[i]; waga[i] = ml; }
    }
    // stok: waga sąsiada = część „daleka” (granica Voronoi stoku) + przy brzegu część po najbliższej komórce lądu
    // (pas granicy na lądzie przechodzi w stok bez skoku); dwie etykiety mieszczą się w teksturze — przy różnych
    // sąsiadach wygrywa większa waga
    var brzeg = new Uint8Array(n);                  // stok: oddalenie od brzegu 0…255 (podłoże trzyma tylko przy brzegu)
    for (i = 0; i < n; i++) {
      if (!stok[i]) continue;
      var t = gladkoKm(d1[i], BRZEG_KM), L = zr[i];
      // bajt: 0…128 = smoothstep(0; 3 km; d₁) przy brzegu, 128…255 = zanik stoku smoothstep(30; 40 km; d) na granicy
      // przypisania (bez uskoku dna 40 km od lądu)
      brzeg[i] = d[i] > STOK_ZANIK_KM ? 128 + Math.round(127 * gladkoKm(d[i] - STOK_ZANIK_KM, STOK_KM - STOK_ZANIK_KM)) : Math.round(t * 128);
      var wF = drugi[i] ? 0.5 * (1 - gladkoKm(d2[i] - d1[i], MIESZANIE_KM)) * t : 0, eF = drugi[i];
      var wL = s.wys[L] > 0 && drugi[L] && waga[L] < 255 ? (1 - waga[L] / 255) * (1 - t) : 0, eL = wL > 0 ? drugi[L] : 0;
      var wS, eS;
      if (!eF || eF === eL) { eS = eL || eF; wS = wL + wF; } else if (wL >= wF) { eS = eL; wS = wL; } else { eS = eF; wS = wF; }
      waga[i] = Math.round((1 - Math.min(0.5, wS)) * 255);
      drugi[i] = waga[i] < 255 ? eS : 0;
    }
    out.drugi = drugi; out.waga = waga; out.brzeg = brzeg;
    return out;
  }
  function gladkoKm(dd, km) { var t = clamp01(dd / km); return t * t * (3 - 2 * t); }

  function odlegloscKm(lon, lat, c) {
    return Math.hypot((lon - c[0]) * KM_NA_STOPIEN * Math.cos(c[1] * RAD), (lat - c[1]) * KM_NA_STOPIEN);
  }

  // Parametry jednostek do rachunku (CPU i uniformy shadera): R_km = najdalsza komórka lądu jednostki od jej centrum.
  var pamiec = typeof WeakMap === 'function' ? new WeakMap() : null;
  function parametry(s, przyn, jednostki) {
    var zap = pamiec && pamiec.get(przyn);
    if (zap && zap.jednostki === jednostki && zap.s === s) return zap.P;
    var id = {};
    jednostki.forEach(function (j, k) { id[j.id] = k + 1; });
    var P = jednostki.map(function (j) {
      return { id: j.id, od: j.odMa, do: j.doMa, odDanych: j.odMa,
        zapMa: j.zapadniecie ? j.zapadniecie.Ma : null, zapWyp: j.zapadniecie ? j.zapadniecie.wypelnienie_m : 0,
        pod: j.podloze && id[j.podloze.jednostka] ? id[j.podloze.jednostka] : 0, podWys: j.podloze ? j.podloze.wys_m : 0,
        centrum: j.centrum || null, R_km: 0, wynMa: j.wynurzenie && j.wynurzenie.Ma > 0 ? j.wynurzenie.Ma : null };
    });
    for (var y = 0; y < s.h; y++) {
      var lat = latKomorki(s, y);
      for (var x = 0; x < s.w; x++) {
        var i = y * s.w + x, k = przyn[i];
        if (!k || !(s.wys[i] > 0) || !P[k - 1] || !P[k - 1].centrum) continue;
        var dd = odlegloscKm(lonKomorki(s, x), lat, P[k - 1].centrum);
        if (dd > P[k - 1].R_km) P[k - 1].R_km = dd;
      }
    }
    P.forEach(function (u) { if (u.centrum && !(u.R_km > 0)) u.R_km = 1; });
    fazaPodwodna(s, przyn, P);
    if (pamiec) pamiec.set(przyn, { P: P, s: s, jednostki: jednostki });
    return P;
  }

  // Faza podwodna (ruling 8b-9): jednostka z `wynurzenie` (Ma zdarzenia osi czasu) i bez podłoża zaczyna wzrost spod dna
  // wcześniej niż odMa — od = najmniejszy początek, przy którym któraś komórka lądu jednostki dochodzi do 0 m dokładnie
  // w wynMa (pierwszy ląd nad taflą = zdarzenie z danych). Ten sam smoothstep, tylko dłuższy przedział: komórka c przy
  // starcie od ma postęp q(t) = (od − t)/(od − do); 0 m przy smoothstep(p) = −podstawa/(X − podstawa), p z q jak w rosnie().
  // Komórka w pasie granicy liczy się z mieszaniem z sąsiadem (jak wysokoscKomorki), więc pierwszy ląd na ekranie, nie
  // w samej krzywej jednostki. Shader dostaje `od` w uniformach (uEwoO) — ten sam rachunek na GPU.
  function odwrotnySmoothstep(v) {
    var lo = 0, hi = 1;
    for (var i = 0; i < 60; i++) { var m = (lo + hi) / 2; if (m * m * (3 - 2 * m) < v) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function fazaPodwodna(s, przyn, P) {
    var naj = {}, lad = {};
    P.forEach(function (u, k) { if (u.wynMa != null && !u.pod && u.wynMa <= u.od && u.wynMa > u.do) naj[k + 1] = Infinity; });
    if (!Object.keys(naj).length) return;
    for (var y = 0; y < s.h; y++) {
      var lat = latKomorki(s, y);
      for (var x = 0; x < s.w; x++) {
        var i = y * s.w + x, k = przyn[i];
        if (!(k in naj) || !(s.wys[i] > 0)) continue;
        var u = P[k - 1], X = celX(u, s.wys[i], u.wynMa), b = Math.min(DNO, X), lon = lonKomorki(s, x);
        // komórka w pasie granicy: e = m·e₁ + (1 − m)·e₂ (sąsiad e₂ w chwili wynMa) — 0 m przy e₁ = −(1 − m)·e₂ / m
        var d2 = przyn.drugi ? przyn.drugi[i] : 0, m = przyn.waga && d2 && P[d2 - 1] ? przyn.waga[i] / 255 : 1;
        var cel = m < 1 ? (m > 0 ? -(1 - m) * wzrost(P, d2, s.wys[i], u.wynMa, lon, lat, DNO) / m : Infinity) : 0;
        var v = (cel - b) / (X - b);
        if (!(v > 0 && v < 1)) continue;
        var p = odwrotnySmoothstep(v);
        var r = u.centrum ? clamp01(odlegloscKm(lon, lat, u.centrum) / u.R_km) : 0;
        var q = u.centrum ? OPOZNIENIE * r + (1 - OPOZNIENIE) * p : p;
        var od = (u.wynMa - q * u.do) / (1 - q);
        if (od < naj[k]) { naj[k] = od; lad[k] = { i: i, lonLat: [lon, lat] }; }
      }
    }
    // − 1e-6 Ma (1 rok): przebicie tuż PO wynMa — w samej chwili zdarzenia (postój licznika A1) szczyt jest jeszcze pod
    // taflą (r ≤ 0 → −12 m), a nie ułamek milimetra nad nią (bisekcja smoothstepu)
    // `wynLad` = ta komórka (indeks w siatce, [lon, lat]) — pierwszy ląd nad taflą: para i fala A1 (animacje.js), test celu
    // kamery W5 (jedno źródło)
    Object.keys(naj).forEach(function (k) {
      if (isFinite(naj[k]) && naj[k] - 1e-6 > P[k - 1].od) { P[k - 1].od = naj[k] - 1e-6; P[k - 1].wynLad = lad[k]; }
    });
  }

  // Wzrost jednostki k (0..n−1) ku wartości X w chwili t.
  function podstawaJ(P, k, X, t, lon, lat, dno) {
    var u = P[k];
    return u.pod ? rosnie(P, u.pod - 1, Math.min(X, u.podWys), t, lon, lat, dno) : Math.min(dno, X);
  }
  function rosnie(P, k, X, t, lon, lat, dno) {
    var u = P[k];
    var podstawa = podstawaJ(P, k, X, t, lon, lat, dno);
    if (t >= u.od) return podstawa;
    if (t <= u.do) return X;
    var p = (u.od - t) / (u.od - u.do);
    if (u.centrum) p = clamp01((p - OPOZNIENIE * clamp01(odlegloscKm(lon, lat, u.centrum) / u.R_km)) / (1 - OPOZNIENIE));
    var sm = p * p * (3 - 2 * p);
    return podstawa + sm * (X - podstawa);
  }
  function waga(h, dno) { return h > 0 ? 1 : clamp01((h - dno) / STOK_M); }

  function celX(u, h, t) { return h + (u.zapMa != null && t > u.zapMa ? u.zapWyp * clamp01(1 + h / WYP_ZANIK_M) : 0); }
  function wzrost(P, etykieta, h, t, lon, lat, dno) {
    return rosnie(P, etykieta - 1, celX(P[etykieta - 1], h, t), t, lon, lat, dno);
  }
  // Jedna komórka: etykieta = przynależność (0 = ocean), h = dzisiejsza wysokość [m]; drugi / m255 — mieszanie z drugą
  // jednostką (domyślnie bez: m = 255); b255 — bajt brzegu stoku (0…128 oddalenie od brzegu, 128…255 zanik na 30–40 km).
  function wysokoscKomorki(P, etykieta, h, t, lon, lat, dno, drugi, m255, b255) {
    if (dno == null) dno = DNO;
    if (!etykieta || !P[etykieta - 1] || !(t > 0)) return h;
    var b = b255 || 0, tB = Math.min(1, b / 128), dal = 1 - Math.max(0, b - 128) / 127;
    var e1 = wzrost(P, etykieta, h, t, lon, lat, dno), e = e1;
    if (drugi && P[drugi - 1] && m255 < 255) {
      var m = m255 / 255, u = P[etykieta - 1];
      e = m * e1 + (1 - m) * wzrost(P, drugi, h, t, lon, lat, dno);
      if (u.pod) {
        // jednostka z podłożem: sąsiad nie podnosi jej ponad własny wzrost (inaczej przed narodzinami Teide sąsiad rósł
        // ku DZISIEJSZEJ wysokości stożka — duch Teide nad podłożem 2100 m); min dwóch funkcji nierosnących — monotoniczne
        e = Math.min(e, e1);
        // … i nie schodzi przy granicy pod podłoże (ruling PODŁOŻE: nigdy dno) — próg min(podłoże, ±12 m): ląd dzisiejszy
        // najniżej 12 m NAD taflą (ruling: nie pod 0 m; bez płyty współpłaszczyznowej z oceanem), stok 12 m pod nią;
        // na stoku próg działa tylko przy brzegu
        e += (1 - tB) * Math.max(0, Math.min(h > 0 ? MORZE_POD_M : -MORZE_POD_M, podstawaJ(P, etykieta - 1, celX(u, h, t), t, lon, lat, dno)) - e);
      }
    }
    var r = h + waga(h, dno) * dal * (e - h);
    return r <= 0 ? Math.min(r, -MORZE_POD_M) : r;
  }

  // Przynależność wstawki 34 m z pola WYSPY (najbliższa komórka): ta sama jednostka, druga jednostka, waga i bajt brzegu
  // — osobny rachunek na siatce wstawki nie widział granic poza jej prostokątem (szwy-urwiska na brzegu wstawki
  // w przeszłości). Ląd wstawki, któremu wyspa nie dała jednostki (drobniejszy brzeg), — z wielokątów.
  function przynaleznoscWstawki(sW, sWyspa, przynWyspy, jednostki, o) {
    var n = sW.w * sW.h, out = new Uint8Array(n), drugi = new Uint8Array(n), waga = new Uint8Array(n), brzeg = new Uint8Array(n);
    var b = sWyspa.bbox, pip = null, pierscienie = null;
    for (var y = 0; y < sW.h; y++) {
      var lat = latKomorki(sW, y), iy = Math.max(0, Math.min(sWyspa.h - 1, Math.round((b.latMax - lat) / (b.latMax - b.latMin) * (sWyspa.h - 1))));
      for (var x = 0; x < sW.w; x++) {
        var i = y * sW.w + x, lon = lonKomorki(sW, x);
        var j = iy * sWyspa.w + Math.max(0, Math.min(sWyspa.w - 1, Math.round((lon - b.lonMin) / (b.lonMax - b.lonMin) * (sWyspa.w - 1))));
        if (przynWyspy[j]) {
          out[i] = przynWyspy[j]; drugi[i] = przynWyspy.drugi ? przynWyspy.drugi[j] : 0;
          waga[i] = przynWyspy.waga ? przynWyspy.waga[j] : 255; brzeg[i] = przynWyspy.brzeg ? przynWyspy.brzeg[j] : 0;
        } else if (sW.wys[i] > 0) {
          if (!pierscienie) { pip = (o && o.pip) || pipDomyslny(); pierscienie = jednostki.map(function (jj) { return jj.wielokaty || []; }); }
          szukaj: for (var k = 0; k < pierscienie.length && k < 255; k++) for (var q = 0; q < pierscienie[k].length; q++) {
            if (pip(lon, lat, pierscienie[k][q])) { out[i] = k + 1; break szukaj; }
          }
          waga[i] = 255;
        }
      }
    }
    out.drugi = drugi; out.waga = waga; out.brzeg = brzeg;
    return out;
  }

  function wysokoscWChwili(s, przyn, jednostki, tMa, dno) {
    if (dno == null) dno = DNO;
    var out = new Float32Array(s.wys);
    if (!(tMa > 0)) return out;
    var P = parametry(s, przyn, jednostki);
    for (var y = 0; y < s.h; y++) {
      var lat = latKomorki(s, y);
      for (var x = 0; x < s.w; x++) {
        var i = y * s.w + x;
        if (przyn[i]) out[i] = wysokoscKomorki(P, przyn[i], s.wys[i], tMa, lonKomorki(s, x), lat, dno,
          przyn.drugi ? przyn.drugi[i] : 0, przyn.waga ? przyn.waga[i] : 255, przyn.brzeg ? przyn.brzeg[i] : 0);
      }
    }
    return out;
  }

  var api = { DNO: DNO, OPOZNIENIE: OPOZNIENIE, STOK_M: STOK_M, STOK_KM: STOK_KM, MIESZANIE_KM: MIESZANIE_KM, MIESZANIE_LAD_KM: MIESZANIE_LAD_KM, WYP_ZANIK_M: WYP_ZANIK_M, przynaleznosc: przynaleznosc, przynaleznoscWstawki: przynaleznoscWstawki, parametry: parametry,
    MORZE_POD_M: MORZE_POD_M, STOK_ZANIK_KM: STOK_ZANIK_KM,
    wysokoscKomorki: wysokoscKomorki, wysokoscWChwili: wysokoscWChwili, odlegloscKm: odlegloscKm, waga: waga };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Ewolucja = api;
})(typeof window !== 'undefined' ? window : globalThis);
