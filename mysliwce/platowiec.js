'use strict';
/* Zakładka Myśliwce — parametryczny generator płatowca (czysta geometria, bez THREE/DOM; dual-export jak dane.js).
   Wejście: sylwetka z mysliwce/sylwetki.js (kształt jako dane) + wymiary { dl, rozp } z dane.js (jedyne źródło
   długości i rozpiętości). Wyjście:
     { obwiednia: { min:[x,y,z], max:[x,y,z] },
       czesci: { [rodzaj]: { siatki: [Siatka], kotwica:[x,y,z], rozlozenie:[x,y,z], zawiasy?: [Zawias], wyloty?: [Wylot] } } }
     Siatka  = { pozycje: Float32Array, indeksy: Uint32Array, uv: Float32Array,
                 material: 'ram'|'szklo'|'metal'|'wnetrze'|'opona' (podpowiedź dla makieta.js),
                 dwustronna?: true (cienkie/otwarte powierzchnie), asymetryczne?: true (dodatek bez lustra) }
     Zawias  = { siatka: indeks w `siatki`, punkt:[x,y,z], os:[x,y,z] (jednostkowa), kat: rad } — pełne otwarcie to obrót
               siatki o `kat` wokół osi `os` zaczepionej w `punkt` (reguła prawej dłoni, jak Quaternion.setFromAxisAngle).
     Wylot   = { punkt:[x,y,z] (środek wylotu dyszy), kierunek:[x,y,z], szer, wys, typ } — jeden na siatkę dyszy.
     Dodatkowo: wloty.otwory = [{ punkt (środek wargi), kierunek (oś kanału) }] dla każdego wlotu (z lustrami),
     komory.liczba = liczba wygenerowanych komór (komora na osi = 1, para = 2).
   Układ: metry, nos +x, góra +y, prawe skrzydło +z, początek w środku długości obwiedni na osi kadłuba (y=0).
   `kotwica` leży na powierzchni części (prawa strona albo oś): kamera pokazu patrzy w nią, a raycast w jej rzut trafia część.
   Nawinięcie trójkątów: na zewnątrz (zamknięte bryły orientowane objętością ze znakiem), wnętrza komór i wlotów — do środka.
   Konwencje jednostek sylwetki opisuje nagłówek sylwetki.js. */
(function (root) {
  var LOD = {
    // stacje kadłuba, profil cięciwy płatów (ułamki), stacje na całą półrozpiętość skrzydła, stacje małych płatów,
    // obwód dysz, obwód kół, siatka kul, stacje owiewki, wnętrza komór i otwory w brzuchu
    pelny: { stacje: 120, profil: [0, 0.06, 0.14, 0.22, 0.34, 0.46, 0.58, 0.7, 0.8, 0.9, 1], skrzydlo: 18, plyta: 6,
      dysza: 48, kolo: 28, kula: [14, 9], owiewka: 28, wnetrza: true },
    lekki: { stacje: 28, profil: [0, 0.22, 0.7, 1], skrzydlo: 2, plyta: 1,
      dysza: 12, kolo: 8, kula: [6, 4], owiewka: 6, wnetrza: false },
  };

  // Wektory rozłożenia [m] dla maszyny długości 18 m (skalowane długością), sylwetka może je nadpisać (`rozlozenie`).
  var ROZLOZENIE = {
    nos: [3.2, 0, 0], kabina: [0.4, 2.6, 0], wloty: [1.6, -1.6, 0], skrzydla: [0, 1.1, 0], usterzenie: [-2.4, 2.2, 0],
    kaczka: [2.0, 1.8, 0], levcon: [2.2, 0.8, 0], dysze: [-3.4, 0, 0], komory: [0, -2.4, 0], sensory: [1.6, 1.4, 0],
    podwozie: [0, -3.4, 0], kadlub: [0, 0, 0],
  };

  var rad = function (st) { return st * Math.PI / 180; };

  // ---------------------------------------------------------------- siatka robocza
  function Siatka(material) { return { p: [], uv: [], i: [], material: material || 'ram' }; }
  function srednia(pts) {
    var m = [0, 0, 0];
    pts.forEach(function (p) { for (var a = 0; a < 3; a++) m[a] += p[a] / pts.length; });
    return m;
  }
  function wierz(s, x, y, z, a, b) { s.p.push(x, y, z); s.uv.push(a, b); return s.p.length / 3 - 1; }
  function dolacz(cel, zr) {
    var o = cel.p.length / 3, k;
    for (k = 0; k < zr.p.length; k++) cel.p.push(zr.p[k]);
    for (k = 0; k < zr.uv.length; k++) cel.uv.push(zr.uv[k]);
    for (k = 0; k < zr.i.length; k++) cel.i.push(zr.i[k] + o);
    return cel;
  }
  function objetosc(s) {
    var p = s.p, ix = s.i, v = 0;
    for (var t = 0; t < ix.length; t += 3) {
      var a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c])
        + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
    }
    return v / 6;
  }
  function odwroc(s) {
    for (var t = 0; t < s.i.length; t += 3) { var x = s.i[t + 1]; s.i[t + 1] = s.i[t + 2]; s.i[t + 2] = x; }
    return s;
  }
  // Zamknięta bryła: normalne na zewnątrz (objętość ze znakiem > 0).
  function zorientuj(s) { return objetosc(s) < 0 ? odwroc(s) : s; }
  // Otwarta powierzchnia: suma normalnych zgodna z kierunkiem `kier`.
  function skieruj(s, kier) {
    var p = s.p, ix = s.i, n = [0, 0, 0];
    for (var t = 0; t < ix.length; t += 3) {
      var a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      var u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], w = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
      n[0] += u[1] * w[2] - u[2] * w[1]; n[1] += u[2] * w[0] - u[0] * w[2]; n[2] += u[0] * w[1] - u[1] * w[0];
    }
    return n[0] * kier[0] + n[1] * kier[1] + n[2] * kier[2] < 0 ? odwroc(s) : s;
  }
  // Odbicie względem z=0 (nawinięcie odwrócone, żeby normalne dalej patrzyły na zewnątrz).
  function lustro(s) {
    var m = Siatka(s.material);
    for (var k = 0; k < s.p.length; k += 3) m.p.push(s.p[k], s.p[k + 1], -s.p[k + 2]);
    m.uv = s.uv.slice();
    for (var t = 0; t < s.i.length; t += 3) m.i.push(s.i[t], s.i[t + 2], s.i[t + 1]);
    if (s.dwustronna) m.dwustronna = true;
    return m;
  }
  function zLustrem(s) { return dolacz(s, lustro(s)); }
  // Wybór trójkątów (po znacznikach z loftu) do nowej siatki.
  function wybierz(s, warunek, material) {
    var m = Siatka(material || s.material);
    m.p = s.p.slice(); m.uv = s.uv.slice();
    for (var t = 0; t < s.i.length; t += 3) if (warunek(t / 3)) m.i.push(s.i[t], s.i[t + 1], s.i[t + 2]);
    return m;
  }

  // ---------------------------------------------------------------- loft
  // pierscienie: tablica pierścieni [[x,y,z], …] o tej samej liczbie punktów (obwód zamknięty).
  // ostre: osobne wierzchołki na fasetę (ostre krawędzie fasetek, gładko wzdłuż); inaczej wspólne wierzchołki.
  // Domyka oba końce wachlarzem (pierścień zdegenerowany do punktu — bez czapki) i orientuje objętością.
  // Znaczniki trójkątów: seg[t] = odcinek między pierścieniami (−1 czapka przednia, m−1 tylna), fac[t] = faseta.
  function loft(pierscienie, ostre) {
    var s = Siatka(), n = pierscienie[0].length, m = pierscienie.length, seg = [], fac = [];
    function czw(a, b, c, d, j, k) { s.i.push(a, b, c, a, c, d); seg.push(j, j); fac.push(k, k); }
    var j, k;
    if (ostre) {
      for (k = 0; k < n; k++) {
        var k2 = (k + 1) % n, prev = null;
        for (j = 0; j < m; j++) {
          var A = pierscienie[j][k], B = pierscienie[j][k2], v = j / (m - 1);
          var a = wierz(s, A[0], A[1], A[2], v, k / n), b = wierz(s, B[0], B[1], B[2], v, (k + 1) / n);
          if (prev) czw(prev[0], a, b, prev[1], j - 1, k);
          prev = [a, b];
        }
      }
    } else {
      var idx = [];
      for (j = 0; j < m; j++) {
        var rz = [];
        for (k = 0; k <= n; k++) { var P = pierscienie[j][k % n]; rz.push(wierz(s, P[0], P[1], P[2], j / (m - 1), k / n)); }
        idx.push(rz);
      }
      for (j = 1; j < m; j++) for (k = 0; k < n; k++) czw(idx[j - 1][k], idx[j][k], idx[j][k + 1], idx[j - 1][k + 1], j - 1, k);
    }
    czapka(s, pierscienie[0], false, seg, fac, -1);
    czapka(s, pierscienie[m - 1], true, seg, fac, m - 1);
    zorientuj(s);
    s.seg = seg; s.fac = fac;
    return s;
  }
  function czapka(s, r, odwrotnie, seg, fac, j) {
    var n = r.length, c = [0, 0, 0], k, zdeg = true;
    for (k = 0; k < n; k++) { c[0] += r[k][0] / n; c[1] += r[k][1] / n; c[2] += r[k][2] / n; }
    for (k = 0; k < n; k++) if (Math.abs(r[k][0] - c[0]) + Math.abs(r[k][1] - c[1]) + Math.abs(r[k][2] - c[2]) > 1e-9) zdeg = false;
    if (zdeg) return;
    var ic = wierz(s, c[0], c[1], c[2], 0.5, 0.5), w = [];
    for (k = 0; k < n; k++) w.push(wierz(s, r[k][0], r[k][1], r[k][2], 0.5 + 0.5 * Math.cos(2 * Math.PI * k / n), 0.5 + 0.5 * Math.sin(2 * Math.PI * k / n)));
    for (k = 0; k < n; k++) {
      if (odwrotnie) s.i.push(ic, w[(k + 1) % n], w[k]); else s.i.push(ic, w[k], w[(k + 1) % n]);
      seg.push(j); fac.push(-1);
    }
  }

  // ---------------------------------------------------------------- interpolacja (monotoniczna kubiczna, bez przestrzałów)
  function pchip(xs, ys) {
    var n = xs.length, d = [], m = [], h = [], i;
    if (n === 1) return function () { return ys[0]; };
    for (i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else { var w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
    }
    return function (x) {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      var k = 0;
      while (k < n - 2 && x > xs[k + 1]) k++;
      var t = (x - xs[k]) / h[k], t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h[k] * m[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h[k] * m[k + 1];
    };
  }

  // ---------------------------------------------------------------- kontekst budowy
  function Kontekst(syl, wym, lod) {
    var dl = wym.dl, B = wym.rozp / 2;
    var K = { syl: syl, dl: dl, B: B, lod: lod, X: function (u) { return dl / 2 - u * dl; } };
    var pr = syl.kadlub.przekroje.slice().sort(function (a, b) { return a[0] - b[0]; });
    var DOMYSLNE = [0, 0, 0, 0, 0, 0.38, 0.72];
    var kol = [];
    for (var c = 1; c < 7; c++) kol.push(pchip(pr.map(function (r) { return r[0]; }), pr.map(function (r) { return r[c] != null ? r[c] : DOMYSLNE[c]; })));
    K.u0 = pr[0][0]; K.u1 = pr[pr.length - 1][0]; K.wezly = pr.map(function (r) { return r[0]; });
    // Przekrój kadłuba w u [m]: s = półszerokość na krawędzi łączenia, c = wysokość krawędzi nad osią,
    // g = grzbiet nad krawędzią, h = brzuch pod krawędzią, t/p = udział płaskiej góry/spodu w półszerokości.
    K.przekroj = function (u) {
      return { s: Math.max(0, kol[0](u)) * dl / 2, c: kol[1](u) * dl, g: Math.max(0, kol[2](u)) * dl, h: Math.max(0, kol[3](u)) * dl,
        t: kol[4](u), p: kol[5](u) };
    };
    K.gora = function (u) { var q = K.przekroj(u); return q.c + q.g; };
    K.spod = function (u) { var q = K.przekroj(u); return q.c - q.h; };
    return K;
  }

  // Pierścień przekroju kadłuba (8 punktów): krawędź łączenia P, bark P, góra P, góra L, bark L, krawędź L, spód L, spód P.
  function pierscienKadluba(K, u) {
    var q = K.przekroj(u), x = K.X(u), s = q.s, c = q.c;
    var bz = s * (0.6 + 0.4 * q.t), by = c + 0.6 * q.g;
    return [[x, c, s], [x, by, bz], [x, c + q.g, s * q.t], [x, c + q.g, -s * q.t], [x, by, -bz], [x, c, -s], [x, c - q.h, -s * q.p], [x, c - q.h, s * q.p]];
  }
  var FASETA_SPODU = 6; // krawędź spód L → spód P

  function miejsceKomory(k) { return k.miejsce || 'spod'; }
  function komoryBrzuszne(syl) {
    return (syl.komory.uklad || []).filter(function (k) { return miejsceKomory(k) === 'spod'; });
  }

  function stacjeKadluba(K) {
    var u = [], n = K.lod.stacje, i;
    for (i = 0; i <= n; i++) u.push(K.u0 + (K.u1 - K.u0) * i / n);
    u = u.concat(K.wezly, [K.syl.kadlub.nosDo]);
    komoryBrzuszne(K.syl).forEach(function (k) { u.push(k.u, k.u + k.dl); });
    u.sort(function (a, b) { return a - b; });
    var w = [];
    for (i = 0; i < u.length; i++) if (u[i] >= K.u0 - 1e-9 && u[i] <= K.u1 + 1e-9 && (!w.length || u[i] - w[w.length - 1] > 1e-6)) w.push(u[i]);
    return w;
  }

  // ---------------------------------------------------------------- kadłub i nos
  function budujKadlub(K) {
    var syl = K.syl, U = stacjeKadluba(K), nosDo = syl.kadlub.nosDo;
    var Un = U.filter(function (u) { return u <= nosDo + 1e-9; }), Uk = U.filter(function (u) { return u >= nosDo - 1e-9; });
    var nos = loft(Un.map(function (u) { return pierscienKadluba(K, u); }), true);
    var komory = komoryBrzuszne(syl), otwory = K.lod.wnetrza && komory.length > 0;
    var kad = loft(Uk.map(function (u) { return pierscienKadluba(K, u); }), true);
    if (otwory) {
      var f = kad.fac;
      kad = wybierz(kad, function (t) { return f[t] !== FASETA_SPODU; }, 'ram');
      dolacz(kad, spodZOtworami(K, Uk, komory));
    }
    var g = syl.kadlub.gondole;
    if (g) dolacz(kad, zLustrem(gondola(K, g)));
    (syl.dodatki || []).forEach(function (d) { if (d.typ === 'grzbiet') dolacz(kad, grzbiet(K, d)); });
    var um = 0.55, km = [K.X(um), K.gora(um), 0];
    var un = nosDo * 0.5;
    return {
      nos: { siatki: [nos], kotwica: [K.X(un), K.gora(un), 0] },
      kadlub: { siatki: [kad], kotwica: km },
    };
  }

  // Spód kadłuba jako siatka (stacje × kolumny w znormalizowanym z) z otworami komór.
  function spodZOtworami(K, U, komory) {
    var t = [-1, 1];
    komory.forEach(function (k) { t.push(k.t0, -k.t0, k.t1, -k.t1); });
    t.sort(function (a, b) { return a - b; });
    var T = [];
    t.forEach(function (v) { if (!T.length || v - T[T.length - 1] > 1e-9) T.push(v); });
    function otwor(u0, u1, ta, tb) {
      return komory.some(function (k) {
        if (u0 < k.u - 1e-9 || u1 > k.u + k.dl + 1e-9) return false;
        var lo = Math.min(Math.abs(ta), Math.abs(tb)), hi = Math.max(Math.abs(ta), Math.abs(tb));
        if (k.t0 === 0) return hi <= k.t1 + 1e-9;
        return ta * tb >= 0 && lo >= k.t0 - 1e-9 && hi <= k.t1 + 1e-9;
      });
    }
    var s = Siatka('ram'), rz = [];
    U.forEach(function (u, i) {
      var q = K.przekroj(u), x = K.X(u), y = q.c - q.h, w = q.s * q.p;
      rz.push(T.map(function (tt, j) { return wierz(s, x, y, tt * w, i / (U.length - 1), j / (T.length - 1)); }));
    });
    for (var i = 1; i < U.length; i++) for (var j = 1; j < T.length; j++) {
      if (otwor(U[i - 1], U[i], T[j - 1], T[j])) continue;
      s.i.push(rz[i - 1][j - 1], rz[i][j - 1], rz[i][j], rz[i - 1][j - 1], rz[i][j], rz[i - 1][j]);
    }
    return skieruj(s, [0, -1, 0]);
  }

  // Gondola silnika (prawa): ośmiokąt ze ściętymi narożami, wzdłuż [od, do].
  function pierscienGondoli(K, g, tt) {
    var prof = g.profil || [[0, 0.92], [0.12, 1], [0.8, 1], [1, 0.82]];
    var sk = pchip(prof.map(function (p) { return p[0]; }), prof.map(function (p) { return p[1]; }));
    var u = g.od + (g.do - g.od) * tt, x = K.X(u), k = sk(tt);
    var a = g.szer * K.dl / 2 * k, b = g.wys * K.dl / 2 * k, zc = g.z * K.dl, yc = g.y * K.dl;
    return [[x, yc + 0.45 * b, zc + a], [x, yc + b, zc + 0.6 * a], [x, yc + b, zc - 0.6 * a], [x, yc + 0.45 * b, zc - a],
      [x, yc - 0.5 * b, zc - a], [x, yc - b, zc - 0.7 * a], [x, yc - b, zc + 0.7 * a], [x, yc - 0.5 * b, zc + a]];
  }
  function gondola(K, g) {
    var n = Math.max(4, Math.round(K.lod.stacje * (g.do - g.od))), r = [];
    for (var i = 0; i <= n; i++) r.push(pierscienGondoli(K, g, i / n));
    return loft(r, true);
  }
  // Czy punkt (y, z) w przekroju u leży wewnątrz kadłuba albo gondoli (obie strony) — test parzystości przecięć.
  function wPolygonie(r, y, z) {
    var w = false;
    for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
      var yi = r[i][1], zi = r[i][2], yj = r[j][1], zj = r[j][2];
      if ((yi > y) !== (yj > y) && z < (zj - zi) * (y - yi) / (yj - yi) + zi) w = !w;
    }
    return w;
  }
  function wKadlubie(K, u, y, z) {
    if (u < K.u0 || u > K.u1) return false;
    if (wPolygonie(pierscienKadluba(K, u), y, z)) return true;
    var g = K.syl.kadlub.gondole;
    if (!g || u < g.od || u > g.do) return false;
    return wPolygonie(pierscienGondoli(K, g, (u - g.od) / (g.do - g.od)), y, Math.abs(z));
  }

  // Grzbiet (dodatek): trapezowa listwa na górze kadłuba wzdłuż [od, do]; `profil` [[t, udział wysokości]] (domyślnie garb).
  function grzbiet(K, d) {
    var n = Math.max(3, Math.round(K.lod.stacje * (d.do - d.od))), r = [], pr = d.profil || [[0, 0], [0.35, 1], [0.75, 1], [1, 0]];
    var fp = pchip(pr.map(function (q) { return q[0]; }), pr.map(function (q) { return q[1]; }));
    for (var i = 0; i <= n; i++) {
      var tt = i / n, u = d.od + (d.do - d.od) * tt, x = K.X(u), y0 = K.gora(u) - 0.01 * K.dl, f = Math.max(0, fp(tt));
      var w = d.szer * K.dl / 2 * (0.35 + 0.65 * f), h = d.wys * K.dl * f + 0.01 * K.dl;
      r.push([[x, y0, w], [x, y0 + h, w * 0.45], [x, y0 + h, -w * 0.45], [x, y0, -w]]);
    }
    return loft(r, true);
  }

  // ---------------------------------------------------------------- płaty (skrzydło, usterzenie, kaczki, LEVCON)
  function grubosc(c) { return c <= 0.22 ? c / 0.22 : c >= 0.7 ? (1 - c) / 0.3 : 1; }
  // Płyta: korzeń krawędzi natarcia [x,y,z], kierunek rozpiętości kier=[0,dy,dz], stacje [{s, le, c}] (le — cofnięcie
  // krawędzi natarcia [m], c — cięciwa [m]); profil fasetowany (sześciokąt rozpisany na ułamki LOD), grubość `gr` cięciwy.
  function plyta(K, korzen, kier, stacje, gr) {
    var fr = K.lod.profil;
    var r = stacje.map(function (st) {
      var pts = [], i;
      for (i = 0; i < fr.length; i++) pts.push(punktPlyty(korzen, kier, st, fr[i], gr));
      for (i = fr.length - 2; i > 0; i--) pts.push(punktPlyty(korzen, kier, st, fr[i], -gr));
      return pts;
    });
    return loft(r, true);
  }
  function punktPlyty(korzen, kier, st, c, gr) {
    var n = [0, kier[2], -kier[1]], off = gr * st.c / 2 * grubosc(c);
    return [korzen[0] - st.le - c * st.c, korzen[1] + st.s * kier[1] + off * n[1], korzen[2] + st.s * kier[2] + off * n[2]];
  }

  // Mały płat o prostych krawędziach: { u, z, y, cieciwaNasady, cieciwaKonca, skos, … } + kierunek i długość.
  function malyPlat(K, o, kier, dlug, skosWPlanie) {
    var korzen = [K.X(o.u), (o.y || 0) * K.dl, (o.z || 0) * K.dl], cr = o.cieciwaNasady * K.dl, ct = o.cieciwaKonca * K.dl;
    var n = K.lod.plyta, st = [], gr = o.grubosc || 0.045;
    for (var i = 0; i <= n; i++) {
      var s = dlug * i / n;
      st.push({ s: s, le: s * skosWPlanie, c: cr + (ct - cr) * i / n });
    }
    var kot = { s: dlug * 0.55, le: dlug * 0.55 * skosWPlanie, c: cr + (ct - cr) * 0.55 };
    return { siatka: plyta(K, korzen, kier, st, gr), kotwica: punktPlyty(korzen, kier, kot, 0.45, gr) };
  }
  // Płat poziomy (ster wysokości, kaczka, LEVCON): od z korzenia do eta·B, wznios `dwuscian`.
  function platPoziomy(K, o) {
    var d = rad(o.dwuscian || 0), kier = [0, Math.sin(d), Math.cos(d)];
    var dl = (o.eta * K.B - (o.z || 0) * K.dl) / Math.cos(d);
    return malyPlat(K, o, kier, dl, Math.cos(d) * Math.tan(rad(o.skos)));
  }
  // Statecznik pochylony na zewnątrz o `pochylenie` od pionu (w dół — płetwa brzuszna).
  function statecznik(K, o, wDol) {
    var c = rad(o.pochylenie || 0), kier = [0, (wDol ? -1 : 1) * Math.cos(c), Math.sin(c)];
    return malyPlat(K, o, kier, o.wysokosc * K.dl, Math.tan(rad(o.skos)));
  }
  function para(wynik) { return zLustrem(wynik.siatka); }

  // Obrys skrzydła w (eta, u): krawędź natarcia z opcjonalnym załamaniem, krawędź spływu z opcjonalnym załamaniem (lambda).
  function planSkrzydla(K) {
    var sk = K.syl.skrzydlo, dl = K.dl, B = K.B, u0 = sk.nasadaU, tg1 = Math.tan(rad(sk.skosNatarcia));
    var zal = sk.zalamanie, spl = sk.splyw;
    function uLE(eta) {
      if (!zal || eta <= zal.eta) return u0 + eta * B * tg1 / dl;
      return u0 + zal.eta * B * tg1 / dl + (eta - zal.eta) * B * Math.tan(rad(zal.skosNatarcia)) / dl;
    }
    var a0 = u0 + sk.cieciwaNasady, a1 = uLE(1) + sk.cieciwaKonca;
    function uTE(eta) {
      if (!spl) return a0 + (a1 - a0) * eta;
      var ak = uLE(spl.eta) + spl.cieciwa;
      return eta <= spl.eta ? a0 + (ak - a0) * eta / spl.eta : ak + (a1 - ak) * (eta - spl.eta) / (1 - spl.eta);
    }
    var d = rad(sk.dwuscian || 0);
    return { uLE: uLE, uTE: uTE, d: d, kier: [0, Math.sin(d), Math.cos(d)], korzen: [K.X(u0), (sk.y || 0) * dl, 0], gr: sk.grubosc || 0.04,
      zal: zal, spl: spl,
      stacja: function (eta) { return { s: eta * B / Math.cos(d), le: (uLE(eta) - u0) * dl, c: (uTE(eta) - uLE(eta)) * dl }; } };
  }

  function budujSkrzydla(K) {
    var P = planSkrzydla(K), lod = K.lod;
    var konc = (K.syl.dodatki || []).filter(function (d) { return d.typ === 'ruchome-koncowki'; })[0];
    var lamane = [0, 1];
    if (P.zal) lamane.push(P.zal.eta);
    if (P.spl) lamane.push(P.spl.eta);
    if (konc) lamane.push(konc.eta);
    lamane.sort(function (a, b) { return a - b; });
    function stacje(e0, e1) {
      var e = [];
      for (var i = 0; i < lamane.length - 1; i++) {
        var a = lamane[i], b = lamane[i + 1];
        if (b <= e0 + 1e-9 || a >= e1 - 1e-9) continue;
        var n = Math.max(1, Math.round(lod.skrzydlo * (b - a)));
        for (var j = 0; j < n; j++) e.push(a + (b - a) * j / n);
      }
      e.push(e1);
      return e.map(P.stacja);
    }
    var wew = plyta(K, P.korzen, P.kier, stacje(0, konc ? konc.eta : 1), P.gr);
    var wynik = { siatki: [zLustrem(wew)], kotwica: punktPlyty(P.korzen, P.kier, P.stacja(0.62), 0.45, P.gr) };
    if (konc) {
      var kp = plyta(K, P.korzen, P.kier, stacje(konc.eta, 1), P.gr), kl = lustro(kp);
      var os0 = punktPlyty(P.korzen, P.kier, P.stacja(konc.eta), 0.4, 0);
      var kat = rad(konc.kat || 20);
      wynik.siatki.push(kp, kl);
      wynik.zawiasy = [
        { siatka: 1, punkt: os0, os: P.kier.slice(), kat: kat },
        { siatka: 2, punkt: [os0[0], os0[1], -os0[2]], os: [P.kier[0], P.kier[1], -P.kier[2]], kat: -kat },
      ];
    }
    wynik.plan = P;
    return wynik;
  }

  // Punkt spodu skrzydła nad (u, z) — dla drzwi komór w nasadzie skrzydła.
  function spodSkrzydla(K, P, u, z) {
    var eta = z / K.B, st = P.stacja(eta), c = (u - P.uLE(eta)) / (P.uTE(eta) - P.uLE(eta));
    c = Math.min(1, Math.max(0, c));
    var n = [0, P.kier[2], -P.kier[1]], off = -P.gr * st.c / 2 * grubosc(c);
    return P.korzen[1] + st.s * P.kier[1] + off * n[1];
  }

  function budujUsterzenie(K) {
    var u = K.syl.usterzenie, siatki = [], kot = null;
    if (u.statecznik) { var st = statecznik(K, u.statecznik, false); siatki.push(para(st)); kot = st.kotwica; }
    if (u.stery) { var sw = platPoziomy(K, u.stery); siatki.push(para(sw)); if (!kot) kot = sw.kotwica; }
    if (K.syl.pletwyBrzuszne) siatki.push(para(statecznik(K, K.syl.pletwyBrzuszne, true)));
    return { siatki: siatki, kotwica: kot };
  }

  // ---------------------------------------------------------------- wloty
  // Kanał: obudowa (od wlotu wstecz) + obramowanie krawędzi + ciemne wnętrze. Krawędź wlotu ścięta skośnie:
  // skosY (góra wysunięta do przodu, °) i skosZ (zewnętrzna krawędź cofnięta, °; dla wlotu na osi — V).
  function kanal(K, w) {
    var dl = K.dl, xL = K.X(w.u), L = w.dlugosc * dl, zc = (w.z || 0) * dl, yc = (w.y || 0) * dl, W = w.szer * dl, H = w.wys * dl;
    var dol = w.dol != null ? w.dol : 1, osiowy = Math.abs(zc) < 1e-9, ty = Math.tan(rad(w.skosY || 0)), tz = Math.tan(rad(w.skosZ || 0));
    var naroza = [[H / 2, W / 2], [H / 2, -W / 2], [-H / 2, -W * dol / 2], [-H / 2, W * dol / 2]];
    function dx(dy, dz) { return ty * dy - tz * (osiowy ? Math.abs(dz) : dz); }
    var g = 0.14 * Math.min(W, H), ky = 1 - 2 * g / H, kz = 1 - 2 * g / W;
    var ty0 = (w.tylY || 0) * dl; // obniżenie końca obudowy (wlot grzbietowy wtapia się w kadłub)
    var tyl = naroza.map(function (q) { return [xL - L, yc + ty0 + q[0] * 0.92, zc + q[1] * 0.92]; });
    var warga = naroza.map(function (q) { return [xL + dx(q[0], q[1]), yc + q[0], zc + q[1]]; });
    var wew = naroza.map(function (q) { return [xL + dx(q[0], q[1]), yc + q[0] * ky, zc + q[1] * kz]; });
    // środek wargi i głębokość kanału: dno wnętrza kończy się przed pierwszym miejscem, w którym oś kanału wchodzi w kadłub
    // (albo gondolę), żeby z przodu w głębi wlotu było widać ciemne wnętrze, a nie burtę kadłuba. Każdy narożnik dna dostaje
    // też własną granicę z sond w narożniku i w środkach przyległych ścian: krawędź łączenia kadłuba potrafi przejść przez
    // ścianę kanału od strony kadłuba, choć oś jest wolna (szary klin w kanale F-35 widziany ukosem) — wtedy dno w tym rogu
    // podchodzi pod wargę (skośne dno), a reszta kanału zostaje tak głęboka jak była.
    var srodek = srednia(warga);
    var du = 0.002, glMax = 0.75 * L;
    function glebokosc(p) {
      var uS = (dl / 2 - p[0]) / dl;
      for (var uu = uS + du; uu <= uS + glMax / dl; uu += du) if (wKadlubie(K, uu, p[1], p[2])) return (uu - uS - du) * dl - 0.005 * dl;
      return glMax;
    }
    var glb = Math.max(0.05 * L, Math.min(glMax, glebokosc(srodek)));
    var dno = wew.map(function (p) { return [p[0], yc + (p[1] - yc) * 0.85, zc + (p[2] - zc) * 0.85]; });
    var gNar = dno.map(glebokosc), gSc = dno.map(function (p, i) { return glebokosc(srednia([p, dno[(i + 1) % 4]])); });
    var gleb = naroza.map(function (q, i) {
      var g = Math.min(glb, Math.max(0.01 * L, Math.min(gNar[i], gSc[i], gSc[(i + 3) % 4])));
      return [xL + dx(q[0], q[1]) - g, yc + q[0] * ky * 0.85, zc + q[1] * kz * 0.85];
    });
    var s = loft([tyl, warga, wew, gleb], true), seg = s.seg;
    var oslona = wybierz(s, function (t) { return seg[t] <= 1; }, 'ram');
    var wnetrze = wybierz(s, function (t) { return seg[t] >= 2; }, 'wnetrze');
    if (w.garb) dolacz(oslona, garb(K, w, xL + dx(0, -W / 2), yc, zc, W, H));
    // kotwica: środek dolnej krawędzi obramowania wlotu
    var kot = srednia([warga[2], warga[3], wew[2], wew[3]]);
    return { siatki: [oslona, wnetrze], kotwica: kot, osiowy: osiowy, otwor: { punkt: srodek, kierunek: [-1, 0, 0] } };
  }
  // Garb DSI: niski ostrosłup na burcie przed wewnętrzną ścianą kanału. Tył podstawy na krawędzi wargi od strony kadłuba
  // (xWargi — warga jest ścięta skośnie, więc ta krawędź wysunięta przed xL): wcześniej tył sięgał 0,1 dl garbu za xL
  // i ostrosłup wchodził za wargę, kilka centymetrów w głąb kanału (F-35: ~4 cm ponad wewnętrzną ścianę).
  function garb(K, w, xWargi, yc, zc, W, H) {
    var dlg = w.garb.dl * K.dl, wys = w.garb.wys * K.dl, zb = zc - W / 2, xm = xWargi + dlg * 0.4;
    var podst = [[xWargi + dlg, yc, zb], [xm, yc + H * 0.45, zb], [xWargi, yc, zb], [xm, yc - H * 0.45, zb]];
    var szczyt = [xm + dlg * 0.05, yc, zb + wys];
    var s = Siatka('ram');
    var ip = podst.map(function (p) { return wierz(s, p[0], p[1], p[2], 0, 0); }), is = wierz(s, szczyt[0], szczyt[1], szczyt[2], 1, 1);
    for (var k = 0; k < 4; k++) s.i.push(ip[k], ip[(k + 1) % 4], is);
    s.i.push(ip[0], ip[2], ip[1], ip[0], ip[3], ip[2]);
    return zorientuj(s);
  }

  function budujWloty(K) {
    var lista = K.syl.wloty.wloty, ram = Siatka('ram'), wn = Siatka('wnetrze'), kot = null, otwory = [];
    lista.forEach(function (w) {
      var k = kanal(K, w);
      var a = k.siatki[0], b = k.siatki[1];
      if (!k.osiowy) { zLustrem(a); zLustrem(b); }
      dolacz(ram, a); dolacz(wn, b);
      if (!kot) kot = k.kotwica;
      otwory.push(k.otwor);
      if (!k.osiowy) otwory.push({ punkt: [k.otwor.punkt[0], k.otwor.punkt[1], -k.otwor.punkt[2]], kierunek: [-1, 0, 0] });
    });
    wn.dwustronna = true;
    return { siatki: [ram, wn], kotwica: kot, otwory: otwory };
  }

  // ---------------------------------------------------------------- kabina
  function budujKabine(K) {
    var o = K.syl.kabina, n = K.lod.owiewka, dl = K.dl, r = [], a = o.szczyt || 0.38, maxH = 0, kot = null;
    for (var i = 0; i <= n; i++) {
      var tt = i / n, u = o.u + o.dlugosc * tt, x = K.X(u), y0 = K.gora(u) - 0.006 * dl;
      var fh = tt < a ? Math.pow(Math.sin(Math.PI / 2 * tt / a), 0.7) : Math.pow((1 - tt) / (1 - a), 0.75);
      var fw = tt < 0.3 ? Math.pow(tt / 0.3, 0.45) : Math.pow((1 - tt) / 0.7, 0.35);
      var H = o.wys * dl * fh + 0.006 * dl * (fh > 0 ? 1 : 0), W = o.szer * dl / 2 * fw;
      r.push([[x, y0, W], [x, y0 + H * 0.5, W * 0.96], [x, y0 + H, W * 0.42], [x, y0 + H, -W * 0.42], [x, y0 + H * 0.5, -W * 0.96], [x, y0, -W]]);
      if (H > maxH) { maxH = H; kot = [x, y0 + H, 0]; }
    }
    var s = loft(r, true); s.material = 'szklo';
    return { siatki: [s], kotwica: kot };
  }

  // ---------------------------------------------------------------- dysze
  function pierscienOkragly(x, yc, zc, r, n, zab, petale) {
    var p = [];
    for (var k = 0; k < n; k++) {
      var f = 2 * Math.PI * k / n, rr = r * (petale && k % 2 ? 0.97 : 1);
      p.push([x - (zab && k % 2 ? zab : 0), yc + rr * Math.sin(f), zc + rr * Math.cos(f)]);
    }
    return p;
  }
  function pierscienProstokatny(x, yc, zc, a, b) {
    var ch = 0.22 * Math.min(a, b);
    return [[x, yc + b, zc + a - ch], [x, yc + b, zc - a + ch], [x, yc + b - ch, zc - a], [x, yc - b + ch, zc - a],
      [x, yc - b, zc - a + ch], [x, yc - b, zc + a - ch], [x, yc - b + ch, zc + a], [x, yc + b - ch, zc + a]];
  }
  function prostopadloscian(x0, x1, y0, y1, z0, z1) {
    var r = function (x) { return [[x, y1, z1], [x, y1, z0], [x, y0, z0], [x, y0, z1]]; };
    return loft([r(x0), r(x1)], true);
  }

  function budujDysze(K) {
    var d = K.syl.dysze, dl = K.dl, n = d.liczba, siatki = [], wyloty = [];
    var zs = n === 1 ? [0] : n === 2 ? [d.rozstaw / 2, -d.rozstaw / 2] : [0, d.rozstaw, -d.rozstaw];
    var xe = K.X(d.u), L = d.dlugosc * dl, yc = (d.y || 0) * dl, W = d.szer * dl, H = (d.wys || d.szer) * dl, wej = d.wejscie || 1.15;
    var kot = null, zMin = Infinity;
    var okragla = d.typ === 'okragla' || d.typ === '3D-TVC';
    var N = okragla ? (d.zabki && K.lod.dysza >= 2 * d.zabki ? 2 * d.zabki * Math.max(1, Math.round(K.lod.dysza / (2 * d.zabki))) : K.lod.dysza) : 8;
    zs.forEach(function (zf) {
      var zc = zf * dl, s, r;
      if (okragla) {
        var R = W / 2, zab = d.zabki && N >= 2 * d.zabki ? 0.06 * R : 0, pet = d.typ === '3D-TVC' && N >= 24;
        r = [pierscienOkragly(xe + L, yc, zc, R * wej, N), pierscienOkragly(xe + L * 0.45, yc, zc, R * (1 + (wej - 1) * 0.55), N, 0, pet),
          pierscienOkragly(xe, yc, zc, R, N, zab, pet), pierscienOkragly(xe, yc, zc, R * 0.86, N, zab),
          pierscienOkragly(xe + L * 0.55, yc, zc, R * 0.62, N)];
        s = loft(r, false);
      } else {
        var a = W / 2, b = H / 2, gb = 0.18 * Math.min(a, b);
        r = [pierscienProstokatny(xe + L, yc, zc, a * 1.02, b * (d.typ === 'rynna' ? 1.15 : 1.55)),
          pierscienProstokatny(xe + L * 0.4, yc, zc, a, b * (d.typ === 'rynna' ? 1.05 : 1.2)),
          pierscienProstokatny(xe, yc, zc, a, b), pierscienProstokatny(xe, yc, zc, a - gb, b - gb),
          pierscienProstokatny(xe + L * 0.5, yc, zc, (a - gb) * 0.8, (b - gb) * 0.7)];
        s = loft(r, true);
        if (d.typ === 'rynna') {
          // rynna: podłoga i niskie ścianki za wylotem, otwarta od góry (wylot schowany przed wzrokiem z dołu)
          var xr = xe - d.rynna * dl, yb = yc - b, th = 0.006 * dl, sz = a * 1.12;
          dolacz(s, prostopadloscian(xe + 0.002 * dl, xr, yb - th, yb, zc - sz, zc + sz));
          dolacz(s, prostopadloscian(xe + 0.002 * dl, xr, yb, yb + b * 0.9, zc + sz - th, zc + sz));
          dolacz(s, prostopadloscian(xe + 0.002 * dl, xr, yb, yb + b * 0.9, zc - sz, zc - sz + th));
        }
      }
      s.material = 'metal';
      siatki.push(s);
      wyloty.push({ punkt: [xe, yc, zc], kierunek: [-1, 0, 0], szer: W, wys: okragla ? W : H, typ: d.typ });
      // kotwica: górny wierzchołek krawędzi wylotu (dysza na osi albo prawa)
      if (zc >= -1e-9 && zc < zMin) { zMin = zc; kot = okragla ? r[2][Math.round(N / 4)].slice() : [xe, yc + H / 2, zc]; }
    });
    return { siatki: siatki, kotwica: kot, wyloty: wyloty };
  }

  // ---------------------------------------------------------------- komory uzbrojenia
  var KAT_DRZWI = 1.65; // ~95°
  function budujKomory(K, P) {
    var dl = K.dl, siatki = [], zawiasy = [], wnetrze = Siatka('wnetrze'), kot = null, e = 0.0008 * dl, th = 0.0025 * dl;
    var U = stacjeKadluba(K), liczba = 0;
    wnetrze.dwustronna = true;
    (K.syl.komory.uklad || []).forEach(function (k) {
      var miejsce = miejsceKomory(k);
      liczba += miejsce === 'spod' && k.t0 === 0 ? 1 : 2;
      if (miejsce === 'skrzydlo') {
        // drzwi pod nasadą skrzydła (bez wnęki), zawias na zewnętrznej krawędzi
        var z0 = (k.z - k.szer / 2) * dl, z1 = (k.z + k.szer / 2) * dl, xa = K.X(k.u), xb = K.X(k.u + k.dl);
        var pt = function (x, z) { var u = (dl / 2 - x) / dl; return spodSkrzydla(K, P, u, z) - e; };
        var ring = function (x) { return [[x, pt(x, z1), z1], [x, pt(x, z0), z0], [x, pt(x, z0) - th, z0], [x, pt(x, z1) - th, z1]]; };
        var dz = loft([ring(xa), ring(xb)], true);
        drzwi(dz, [xa, pt(xa, z1), z1], [xb, pt(xb, z1), z1], [(xa + xb) / 2, (pt(xa, z0) + pt(xb, z1)) / 2 - th, (z0 + z1) / 2]);
        return;
      }
      var Ub = U.filter(function (u) { return u >= k.u - 1e-9 && u <= k.u + k.dl + 1e-9; });
      var ti = k.t0, to = k.t1;
      var ring2 = function (u, ta, tb, dy) {
        var q = K.przekroj(u), x = K.X(u), y = q.c - q.h - e - dy, w = q.s * q.p;
        return [[x, y, ta * w], [x, y, tb * w], [x, y - th, tb * w], [x, y - th, ta * w]];
      };
      var dzw = loft(Ub.map(function (u) { return ring2(u, ti, to, 0); }), true);
      var q0 = K.przekroj(Ub[0]), q1 = K.przekroj(Ub[Ub.length - 1]), um = (Ub[0] + Ub[Ub.length - 1]) / 2, qm = K.przekroj(um);
      drzwi(dzw, [K.X(Ub[0]), q0.c - q0.h - e, to * q0.s * q0.p], [K.X(Ub[Ub.length - 1]), q1.c - q1.h - e, to * q1.s * q1.p],
        [K.X(um), qm.c - qm.h - e - th, (ti + to) / 2 * qm.s * qm.p]);
      if (K.lod.wnetrza) dolacz(wnetrze, wneka(K, Ub, k));
    });
    function drzwi(s, h0, h1, srodek) {
      // prawe drzwi + lustro; kąt dobrany tak, by wolna krawędź opadała w dół
      var os = [h1[0] - h0[0], h1[1] - h0[1], h1[2] - h0[2]], l = Math.hypot(os[0], os[1], os[2]);
      os = [os[0] / l, os[1] / l, os[2] / l];
      var kat = os[0] < 0 ? KAT_DRZWI : -KAT_DRZWI;
      var i = siatki.length;
      siatki.push(s, lustro(s));
      zawiasy.push({ siatka: i, punkt: h0, os: os, kat: kat }, { siatka: i + 1, punkt: [h0[0], h0[1], -h0[2]], os: [os[0], os[1], -os[2]], kat: -kat });
      if (!kot) kot = srodek;
    }
    if (wnetrze.i.length) siatki.push(wnetrze);
    return { siatki: siatki, kotwica: kot, zawiasy: zawiasy, liczba: liczba };
  }
  // Wnęka komory: ściany i strop nad otworem w brzuchu (normalne do środka wnęki).
  function wneka(K, Ub, k) {
    var gl = (k.glebokosc || 0.04) * K.dl, s = Siatka('wnetrze');
    var tA = k.t0 === 0 ? -k.t1 : k.t0, tB = k.t1;
    var r = Ub.map(function (u) {
      var q = K.przekroj(u), x = K.X(u), y = q.c - q.h, w = q.s * q.p;
      return [[x, y, tA * w], [x, y + gl, tA * w], [x, y + gl, tB * w], [x, y, tB * w]];
    });
    var l = loft(r, true), fac = l.fac;
    // bez fasety otworu (spód: tB → tA) — zostają ściany boczne, strop i ściany czołowe; odwrócone do środka
    var w = odwroc(wybierz(l, function (t) { return fac[t] !== 3; }, 'wnetrze'));
    dolacz(s, w);
    if (k.t0 > 0) zLustrem(s);
    return s;
  }

  // ---------------------------------------------------------------- podwozie
  function kolo(K, xc, yc, zc, r, szer) {
    var n = K.lod.kolo, pierscien = function (z) {
      var p = [];
      for (var k = 0; k < n; k++) { var f = 2 * Math.PI * k / n; p.push([xc + r * Math.cos(f), yc + r * Math.sin(f), z]); }
      return p;
    };
    var s = loft([pierscien(zc - szer / 2), pierscien(zc + szer / 2)], false);
    s.material = 'opona';
    return s;
  }
  function budujPodwozie(K) {
    var o = K.syl.podwozie, dl = K.dl, yg = -o.przeswit * dl, metal = Siatka('metal'), opony = Siatka('opona');
    var rp = 0.017 * dl, rg = 0.024 * dl, wp = 0.011 * dl, wg = 0.016 * dl, gr = 0.0035 * dl, kot;
    // przednia goleń na osi
    var xp = K.X(o.przod.u), yt = K.przekroj(o.przod.u).c;
    dolacz(metal, prostopadloscian(xp + gr, xp - gr, yg + rp, yt, -gr, gr));
    if ((o.przod.kola || 1) === 2) { dolacz(opony, zLustrem(kolo(K, xp, yg + rp, wp * 0.62, rp, wp))); }
    else dolacz(opony, kolo(K, xp, yg + rp, 0, rp, wp));
    // główne (prawe + lustro)
    var g = o.glowne, dwa = (g.kola || 1) === 2, tandem = dwa && g.uklad === 'tandem', xg = K.X(g.u), zg = g.z * dl, ytg = K.przekroj(g.u).c, m = Siatka('metal'), op = Siatka('opona');
    dolacz(m, prostopadloscian(xg + gr * 1.3, xg - gr * 1.3, yg + rg, ytg, zg - gr * 1.3, zg + gr * 1.3));
    if (tandem) {
      dolacz(op, kolo(K, xg + rg * 1.05, yg + rg, zg, rg, wg));
      dolacz(op, kolo(K, xg - rg * 1.05, yg + rg, zg, rg, wg));
      dolacz(m, prostopadloscian(xg + rg * 1.05, xg - rg * 1.05, yg + rg - gr, yg + rg + gr, zg - wg * 0.6, zg - wg * 0.5));
    } else if (dwa) {
      dolacz(op, kolo(K, xg, yg + rg, zg + wg * 0.6, rg, wg));
      dolacz(op, kolo(K, xg, yg + rg, zg - wg * 0.6, rg, wg));
    } else dolacz(op, kolo(K, xg, yg + rg, zg + wg * 0.3, rg, wg));
    // kotwica: środek zewnętrznej ściany (przedniego) koła głównego
    kot = [tandem ? xg + rg * 1.05 : xg, yg + rg, zg + wg * (tandem ? 0.5 : dwa ? 1.1 : 0.8)];
    dolacz(metal, zLustrem(m));
    dolacz(opony, zLustrem(op));
    return { siatki: [metal, opony], kotwica: kot };
  }

  // ---------------------------------------------------------------- sensory
  function czujnik(K, c) {
    var dl = K.dl, q = K.przekroj(c.u), x = K.X(c.u), r = (c.r || 0.008) * dl, z = (c.z || 0) * dl, s, kot;
    if (c.typ === 'kula') {
      var ns = K.lod.kula, pod = c.miejsce === 'pod', yc = pod ? q.c - q.h - r * 0.35 : q.c + q.g + r * 0.35, pier = [];
      for (var i = 0; i <= ns[1]; i++) {
        var th = Math.PI * i / ns[1], p = [];
        for (var k = 0; k < ns[0]; k++) { var f = 2 * Math.PI * k / ns[0]; p.push([x + r * Math.cos(th), yc + r * Math.sin(th) * Math.sin(f), z + r * Math.sin(th) * Math.cos(f)]); }
        pier.push(p);
      }
      s = loft(pier, false); kot = [x, pod ? yc - r : yc + r, z];
    } else if (c.typ === 'eots') {
      var yb = q.c - q.h, hex = function (y, rr) { var p = []; for (var k = 0; k < 6; k++) { var f = Math.PI / 6 + Math.PI * k / 3; p.push([x + rr * 1.5 * Math.cos(f), y, z + rr * Math.sin(f)]); } return p; };
      s = loft([hex(yb + r * 0.6, r * 1.1), hex(yb - r * 0.55, r * 0.7)], true); kot = [x, yb - r * 0.55, z];
    } else {
      // okno / antena: cienka romboidalna płytka na powierzchni (pod, nad, bok)
      var gr = (c.typ === 'antena' ? 0.0012 : 0.002) * dl, ksz = function (o) {
        if (c.miejsce === 'bok') { var zb = q.s + o; return [[x + r * 1.4, q.c, zb], [x, q.c + r * 0.7, zb], [x - r * 1.4, q.c, zb], [x, q.c - r * 0.7, zb]]; }
        var y = c.miejsce === 'pod' ? q.c - q.h - o : q.c + q.g + o;
        return [[x + r * 1.4, y, z], [x, y, z + r * 0.8], [x - r * 1.4, y, z], [x, y, z - r * 0.8]];
      };
      s = loft([ksz(-gr), ksz(gr)], true);
      kot = c.miejsce === 'bok' ? [x, q.c, q.s + gr] : [x, c.miejsce === 'pod' ? q.c - q.h - gr : q.c + q.g + gr, z];
    }
    s.material = c.typ === 'antena' ? 'ram' : 'szklo';
    return { siatka: s, kotwica: kot };
  }
  function budujSensory(K) {
    var wynik = { siatki: [], kotwica: null }, sym = Siatka('szklo');
    (K.syl.sensory || []).forEach(function (c) {
      var w = czujnik(K, c);
      if (c.miejsce === 'bok' || Math.abs(c.z || 0) > 0) zLustrem(w.siatka);
      dolacz(sym, w.siatka);
      if (!wynik.kotwica) wynik.kotwica = w.kotwica;
    });
    if (sym.i.length) wynik.siatki.push(sym);
    (K.syl.dodatki || []).forEach(function (d) {
      if (d.czesc !== 'sensory') return;
      var w = czujnik(K, d);
      if (d.asymetryczne) w.siatka.asymetryczne = true; else zLustrem(w.siatka);
      wynik.siatki.push(w.siatka);
      if (!wynik.kotwica) wynik.kotwica = w.kotwica;
    });
    return wynik;
  }

  // ---------------------------------------------------------------- złożenie
  function zbuduj(syl, wymiary, opcje) {
    var lod = LOD[(opcje && opcje.lod) || 'pelny'];
    if (!lod) throw new Error('Platowiec: nieznany LOD ' + (opcje && opcje.lod));
    var K = Kontekst(syl, wymiary, lod), cz = {};
    var kd = budujKadlub(K);
    cz.nos = kd.nos; cz.kadlub = kd.kadlub;
    cz.kabina = budujKabine(K);
    cz.wloty = budujWloty(K);
    var sk = budujSkrzydla(K), P = sk.plan;
    delete sk.plan;
    cz.skrzydla = sk;
    if (syl.usterzenie.typ !== 'brak') cz.usterzenie = budujUsterzenie(K);
    if (syl.kaczka) { var ka = platPoziomy(K, syl.kaczka); cz.kaczka = { siatki: [para(ka)], kotwica: ka.kotwica }; }
    if (syl.levcon) { var lv = platPoziomy(K, syl.levcon); cz.levcon = { siatki: [para(lv)], kotwica: lv.kotwica }; }
    cz.dysze = budujDysze(K);
    cz.komory = budujKomory(K, P);
    if (syl.sensory || (syl.dodatki || []).some(function (d) { return d.czesc === 'sensory'; })) cz.sensory = budujSensory(K);
    cz.podwozie = budujPodwozie(K);
    return normalizuj(K, cz, syl);
  }

  // Skala x i z do wymiarów z dane.js (sylwetka projektowana tak, że skala ≈ 1), środek długości w x=0, eksport typowanych tablic.
  function normalizuj(K, cz, syl) {
    var lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], r, a, k;
    for (r in cz) cz[r].siatki = cz[r].siatki.map(kompaktuj);
    for (r in cz) cz[r].siatki.forEach(function (s) {
      for (k = 0; k < s.p.length; k += 3) for (a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], s.p[k + a]); hi[a] = Math.max(hi[a], s.p[k + a]); }
    });
    var sx = K.dl / (hi[0] - lo[0]), sz = 2 * K.B / (hi[2] - lo[2]), xc = (lo[0] + hi[0]) / 2;
    var T = function (p) { return [(p[0] - xc) * sx, p[1], p[2] * sz]; };
    var Tk = function (v) { var w = [v[0] * sx, v[1], v[2] * sz], l = Math.hypot(w[0], w[1], w[2]); return [w[0] / l, w[1] / l, w[2] / l]; };
    var skala = K.dl / 18, wynik = {}, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (r in cz) {
      var c = cz[r], roz = (syl.rozlozenie && syl.rozlozenie[r]) || ROZLOZENIE[r];
      var o = {
        siatki: c.siatki.map(function (s) {
          var poz = new Float32Array(s.p.length);
          for (k = 0; k < s.p.length; k += 3) {
            poz[k] = (s.p[k] - xc) * sx; poz[k + 1] = s.p[k + 1]; poz[k + 2] = s.p[k + 2] * sz;
            for (a = 0; a < 3; a++) { min[a] = Math.min(min[a], poz[k + a]); max[a] = Math.max(max[a], poz[k + a]); }
          }
          var m = { pozycje: poz, indeksy: new Uint32Array(s.i), uv: new Float32Array(s.uv), material: s.material };
          if (s.dwustronna) m.dwustronna = true;
          if (s.asymetryczne) m.asymetryczne = true;
          return m;
        }),
        kotwica: T(c.kotwica),
        rozlozenie: [roz[0] * skala * sx, roz[1] * skala, roz[2] * skala * sz],
      };
      if (c.zawiasy) o.zawiasy = c.zawiasy.map(function (z) { return { siatka: z.siatka, punkt: T(z.punkt), os: Tk(z.os), kat: z.kat }; });
      if (c.otwory) o.otwory = c.otwory.map(function (w) { return { punkt: T(w.punkt), kierunek: Tk(w.kierunek) }; });
      if (c.liczba != null) o.liczba = c.liczba;
      if (c.wyloty) o.wyloty = c.wyloty.map(function (w) { return { punkt: T(w.punkt), kierunek: Tk(w.kierunek), szer: w.szer * sz, wys: w.wys, typ: w.typ }; });
      wynik[r] = o;
    }
    return { obwiednia: { min: min, max: max }, czesci: wynik, skala: { x: sx, z: sz } };
  }

  // Usuwa wierzchołki bez trójkątów (po wycięciu fasetek i podziale loftów).
  function kompaktuj(s) {
    var mapa = new Int32Array(s.p.length / 3).fill(-1), m = { p: [], uv: [], i: [], material: s.material }, n = 0;
    for (var t = 0; t < s.i.length; t++) {
      var v = s.i[t];
      if (mapa[v] < 0) { mapa[v] = n++; m.p.push(s.p[v * 3], s.p[v * 3 + 1], s.p[v * 3 + 2]); m.uv.push(s.uv[v * 2], s.uv[v * 2 + 1]); }
      m.i.push(mapa[v]);
    }
    if (s.dwustronna) m.dwustronna = true;
    if (s.asymetryczne) m.asymetryczne = true;
    return m;
  }

  var api = { zbuduj: zbuduj, LOD: Object.keys(LOD) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Platowiec = api;
})(typeof window !== 'undefined' ? window : globalThis);
