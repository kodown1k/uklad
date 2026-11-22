'use strict';
/* Zakładka Geologia — plan rozdziałów pokazu: czas ujęć z lektora, montaż (przejścia D/K/P/B/C/Cc), zdarzenia przypięte
   do wersów, klucze kamery z opowieści przeliczone na czas rozdziału, czysta funkcja pozy kamery i metryki ruchu
   (spec „Reżyseria filmów”, R2–R6, R9, R10). Bez DOM/THREE; dual-export: przeglądarka window.Rozdzialy.

   Rozdzialy.plan({ dane, opowiesc, siatka, poziomy?, czasy?, krzywe }) → Rozdzial[] (kolejność opowiesc.ujecia)
     Rozdzial = { id, tytul, czas, wersy: [{ id, start, koniec }], ujecia: [{ id, od, do, wejscie, przejscie: { od, do } | null,
       …pola ujęcia z opowiesc, czasMa?: [od, do] }], kamera: [{ t, poz: [lon, lat, wys_m], cel: [lon, lat, wys_m], fov, ujecie }],
       animacje: [{ nazwa, od, do, f: [f0, f1] }], zdarzenia: [{ t, co, wers?, ujecie }], stan: { kolorowanie, przekroj?,
       czasMa?: [od, do], chmury }, przewyzszenie: [{ t, e }] }
     Czas ujęcia = max(cel_s, naturalny), naturalny = wejście + wersy (KinoKadr.harmonogram z `wymowa || tekst`, tempo
     12,1 zn./s, przerwa 0,35 s; `czasy` z nagrań wygrywają) + oddech. Gdy nagrania przekraczają cel ujęcia, nadwyżka
     jest odbierana z ciszy innych ujęć z lektorem (proporcjonalnie, nie poniżej ich czasu naturalnego), więc rozdział
     trzyma cel R8. Nadwyżka cel_s nad naturalnym idzie w ¼ na wejście (≤ 1,5 s), reszta po równo za każdym wersem.
     `krzywe` = korzeniowy kino.js (dojazd, cruise, logLerp, aimArc) — wstrzyknięte, nigdy window.Kino (ruling G-C).
   Rozdzialy.kamera(rozdzial, t, siatka, proporcja = 2.39) → { poz: [x, y, z], cel: [x, y, z], fov, przechyl, pozR, celR,
     poziom, ujecie } — układ sceny makiety (1 j. = 1 km, +x wschód, +y góra, +z południe, początek = Teren.SRODEK) z
     przewyższeniem: y = Y(h) = h + (e − 1)·20 km·tanh(h / 20 km) (≈ e·h przy terenie, przy orbicie +10 km zamiast ×1,5);
     pozR / celR = to samo bez przewyższenia (h n.p.m. rzeczywiste). Kanały kluczy (kotwica, azymut, asinh odległości,
     asinh wysokości, cel, fov, wstrząs, wymagany odjazd) — Hermite w czasie, styczne Catmull-Rom ograniczone
     Fritschem-Carlsonem (wzór kameraPoscigu Myśliwców, bez importu); odcinek z `krzywa` = krzywe.dojazd / cruise
     z logLerp odległości i wysokości, `luk` = cel po łuku krzywe.aimArc. Telefon (proporcja < 1,5, spec R3):
     fov' = min(40° | glob 30°, 2·atan(1,6·tan(fov/2))) (R3 daje 60°; RUCH-8 ogranicza do 40°/30°), odjazd do
     R/sin(0,85·β) na poziomach wyspa/wstawka z wysokości ≥ 1,4 km (płynnie od 0,4 km), wstecz wzdłuż osi, przy osi w górę
     poziomo; oś przesunięta o 70% ku obiektowi głównemu ujęcia (obiekt przechodzi płynnie przez szwy D/P), chyba że
     ujęcie ma `osTelefonu: 'cel'` — wtedy na telefonie obiektem głównym jest cel kluczy.
     Każda proporcja i siatka: odjazd do H ≥ 45 komórek poziomu celu (lekki = 210 m; wstawki 67 m, ruling T3).
     Wstrząs: trzy sinusy 0,21/0,53/1,37 Hz (wagi 0,6/0,3/0,1). Przechył: 0 (limit ≤ 4°).
   Rozdzialy.metryki(rozdzial, siatka, { hz = 60, proporcja = 2.39, teren? }) → { ujecia: [{ id, wMax, wMaxP, wMaxPodWersem, awMax,
     relvMax, arelMax, przechylMax, postojMax_s, vStart, przeswitMin_m, gestoscMin, fovMax, dfovMax }] } — wMax poza oknami
     przenikania P, wMaxP w nich (limity 25 i 35°/s); próbki tylko wewnątrz ujęcia (szwy sprawdza test ciągłości).
   Rozdzialy.chwila(rozdzial, t) → { ujecie, indeks, u, czasMa, woda, slonce: { az, el, pora }, przewyzszenie }
   Rozdzialy.ndc(poza, punkt, proporcja) → [x, y, z] (z > 0 = przed kamerą), Rozdzialy.wysokoscKadru(poza) → H [km],
   Rozdzialy.komorka(poziom, siatka, proporcja, poziomy?) → km (bez siatki poziomu: błąd), Rozdzialy.doSceny(h, e) / zeSceny(y, e). */
(function (root) {
  var RAD = Math.PI / 180, R_ZIEMI = 6371;
  var TEMPO = 12.1, PRZERWA = 0.35, MIN_WERS = 2.2;
  var CIECIA = { K: 1, C: 1, Cc: 1, B: 1 };
  var WEJSCIE = { C: 0.6, B: 0.7, Cc: 0.6, K: 0.4, P: 0.6, D: 0.3 };       // od granicy ujęcia do pierwszego wersu [s]
  var POL_C = 0.35, POL_B = 0.3;                                          // połowa czerni C (0,7 s) i bieli B (0,6 s)
  var ETYKIETY_PRZED = 0.4;                                               // MON-4
  var PRZENIKANIE = { 'glob|archipelag': [900, 1300], 'archipelag|wyspa': [110, 160] };   // spec R2: okno H [km]
  var GLOB_H = 900, GLOB_H_TEL = 1800, GESTOSC = 45;
  var Y_PRZEW = 20, E_FILM = 1.5;
  var S0 = 0.3;                                                           // skala asinh odległości i wysokości [km]
  var FOV_MAX = 40, FOV_MAX_GLOB = 30, TEL_OBIEKT = 0.7;

  function zal(nazwa, plik) {
    if (root[nazwa]) return root[nazwa];
    if (typeof require === 'function') return require(plik);
    throw new Error('Rozdzialy: brak ' + nazwa);
  }
  function KK() { return zal('KinoKadr', '../kino-kadr.js'); }
  function TR() { return zal('Teren', './teren.js'); }
  function AN() { return zal('Animacje', './animacje.js'); }

  /* ---------- wektory ---------- */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function norm(a) { var l = len(a); return l > 0 ? mul(a, 1 / l) : [0, 0, 0]; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function gladko(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function asinhS(v) { return Math.asinh(v / S0); }
  function sinhS(v) { return S0 * Math.sinh(v); }

  /* ---------- przewyższenie ---------- */
  function doSceny(h, e) { return h + ((e || E_FILM) - 1) * Y_PRZEW * Math.tanh(h / Y_PRZEW); }
  function zeSceny(y, e) {
    e = e || E_FILM;
    var h = y / e;
    for (var i = 0; i < 30; i++) {
      var th = Math.tanh(h / Y_PRZEW), f = h + (e - 1) * Y_PRZEW * th - y, d = 1 + (e - 1) * (1 - th * th);
      var nh = h - f / d;
      if (Math.abs(nh - h) < 1e-12) { h = nh; break; }
      h = nh;
    }
    return h;
  }

  /* ---------- siatki i komórki ---------- */
  // komórka siatki [km] = max(mNaPiksel, mNaPikselDanych) — wstawki z=12 mają realnie rozdzielczość z=11 (ruling T3).
  // Bez siatki albo bez metrów na piksel: błąd (żadnych liczb jednego miejsca w kodzie).
  function komorkaSiatki(s, co) {
    var m = s ? Math.max(+s.mNaPiksel || 0, +s.mNaPikselDanych || 0) : 0;
    if (!(m > 0)) throw new Error('Rozdzialy: brak siatki z mNaPiksel dla poziomu ' + (co || 'wyspa'));
    return m / 1000;
  }
  function komorka(poziom, siatka, proporcja, meta) {
    var tel = proporcja < 1.5;
    if (poziom === 'glob') return (tel ? GLOB_H_TEL : GLOB_H) / GESTOSC;    // spec R2: teksel ≤ 8 px (8k / telefon 4k)
    if (poziom === 'wyspa') return komorkaSiatki(siatka, poziom);
    var v = meta && meta[poziom];
    if (!(v > 0)) throw new Error('Rozdzialy: brak siatki poziomu ' + poziom + ' (poziomy.archipelag / poziomy.wstawki.<id>)');
    return v;
  }
  // komórki poziomów z siatek: { archipelag, 'wstawka:<id>' } (wstawki jako { id: siatka } albo tablica siatek z polem id)
  function metaPoziomow(poz) {
    var m = {};
    if (poz && poz.archipelag) m.archipelag = komorkaSiatki(poz.archipelag, 'archipelag');
    var w = poz && poz.wstawki;
    if (w) Object.keys(w).forEach(function (k) {
      var id = Array.isArray(w) ? w[k].id : k;
      if (id) m['wstawka:' + id] = komorkaSiatki(w[k], 'wstawka:' + id);
    });
    return m;
  }
  function listaWstawek(poz) {
    var w = poz && poz.wstawki;
    if (!w) return [];
    return Array.isArray(w) ? w : Object.keys(w).map(function (k) { return w[k]; });
  }
  // wysokość terenu [km] w punkcie: wstawka (gdy jest), wyspa, archipelag, inaczej 0
  function terenKm(ctx, lon, lat) {
    var T = TR(), h = null;
    listaWstawek(ctx.poziomy).forEach(function (s) { if (h === null) { var v = T.probka(s, lon, lat); if (v !== null) h = v; } });
    if (h === null && ctx.siatka) h = T.probka(ctx.siatka, lon, lat);
    if (h === null && ctx.poziomy && ctx.poziomy.archipelag) h = T.probka(ctx.poziomy.archipelag, lon, lat);
    return h === null ? 0 : h / 1000;
  }

  /* ---------- czasy nagrań ---------- */
  function czasyWersow(c) {
    var m = {};
    if (!c) return m;
    var src = c.wersy || c;
    Object.keys(src).forEach(function (id) {
      var v = src[id], x = typeof v === 'number' ? v : v && (v.czas_s != null ? v.czas_s : v.czas);
      if (x > 0) m[id] = +x;
    });
    return m;
  }

  /* ---------- cel klucza ---------- */
  function lok(lon, lat) { return TR().doLokalnych(null, lon, lat); }
  function geo(x, z) { return TR().zLokalnych(null, x, z); }
  function rozwiazCel(ctx, spec) {
    if (spec === 'ziemia') return { p: [0, -R_ZIEMI, 0], obiekt: 'ziemia' };
    var o = typeof spec === 'string' ? { czesc: spec } : Array.isArray(spec) ? { lonLat: spec } : spec || {};
    var ll;
    if (o.czesc) {
      var c = ctx.czesci[o.czesc];
      if (!c) throw new Error('Rozdzialy: brak części ' + o.czesc);
      ll = c.lonLat;
    } else if (o.lonLat) ll = o.lonLat;
    else if (o.tor) {
      var tor = ctx.dane.tory && ctx.dane.tory[o.tor];
      if (!tor || tor.length < 2) throw new Error('Rozdzialy: brak toru ' + o.tor + ' w dane.tory');
      if (!isFinite(o.f)) throw new Error('Rozdzialy: cel z toru ' + o.tor + ' bez ułamka f');
      ll = AN().frontLawy(tor, o.f).czolo;
    }
    else if (o.ziemia) return { p: add([0, -R_ZIEMI, 0], [o.dx || 0, 0, o.dz || 0]), obiekt: 'ziemia' };
    else throw new Error('Rozdzialy: cel klucza bez części / lonLat / tor');
    var xz = lok(ll[0], ll[1]);
    xz = [xz[0] + (o.dx || 0), xz[1] + (o.dz || 0)];
    var h = o.hc != null ? o.hc : Math.max(0, terenKm(ctx, geo(xz[0], xz[1])[0], geo(xz[0], xz[1])[1])) + (o.dh || 0);
    return { p: [xz[0], h, xz[1]], obiekt: o.czesc || o.tor || null, lonLat: ll };
  }

  /* ---------- Hermite (wzór kameraPoscigu, bez importu z mysliwce/) ---------- */
  function styczne(ts, ps, stop, ruchStart, ruchKoniec) {
    var n = ps.length, m = new Array(n), d = [], i;
    for (i = 0; i < n - 1; i++) d.push(ts[i + 1] > ts[i] ? (ps[i + 1] - ps[i]) / (ts[i + 1] - ts[i]) : 0);
    if (n === 1) return [0];
    m[0] = ruchStart ? d[0] : 0;
    m[n - 1] = ruchKoniec ? d[n - 2] : 0;
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (ps[i + 1] - ps[i - 1]) / (ts[i + 1] - ts[i - 1]);
    for (i = 0; i < n; i++) if (stop[i]) m[i] = 0;
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
  // wstrząs: trzy sinusy (spec R3), wagi jak oddech Myśliwców — przyspieszenie kątowe ≤ 9,4°/s² przy wstrząsie 1
  function fala(t, faza) {
    return 0.6 * Math.sin(2 * Math.PI * 0.21 * t + faza) + 0.3 * Math.sin(2 * Math.PI * 0.53 * t + 1.7 * faza + 0.4) +
      0.1 * Math.sin(2 * Math.PI * 1.37 * t + 2.9 * faza + 1.1);
  }

  // oś czasu A1: Animacje.osA1 (postoje na zdarzeniach osCzasu z `postojA1`, M0 = najstarsza jednostka, spec R9.4)
  function maA1(ctx, f) { return AN().maA1(ctx.dane, f); }

  /* ---------- plan ---------- */
  function plan(o) {
    o = o || {};
    var D = o.dane || root.GeologiaTeneryfa, O = o.opowiesc || root.GeologiaOpowiesc, krzywe = o.krzywe;
    if (!D || !O) throw new Error('Rozdzialy.plan: brak dane / opowiesc');
    if (!krzywe || typeof krzywe.dojazd !== 'function' || typeof krzywe.cruise !== 'function' ||
      typeof krzywe.logLerp !== 'function' || typeof krzywe.aimArc !== 'function')
      throw new Error('Rozdzialy.plan: brak krzywych kino.js (dojazd, cruise, logLerp, aimArc) — wstrzyknij przez { krzywe }');
    var czesci = {};
    D.czesci.forEach(function (c) { czesci[c.id] = c; });
    var ctx = { dane: D, siatka: o.siatka || null, poziomy: o.poziomy || {}, krzywe: krzywe, czesci: czesci,
      czasy: czasyWersow(o.czasy), meta: metaPoziomow(o.poziomy) };
    komorkaSiatki(ctx.siatka, 'wyspa');
    Object.keys(O.ujecia).forEach(function (r) {
      O.ujecia[r].forEach(function (u) {
        if (u.typ !== 'plansza' && u.poziom !== 'glob') komorka(u.poziom, ctx.siatka, 2.39, ctx.meta);
      });
    });
    return Object.keys(O.ujecia).map(function (r) { return planRozdzialu(r, O, ctx); });
  }

  var WEW = typeof WeakMap === 'function' ? new WeakMap() : null;
  function wew(r) { var w = WEW && WEW.get(r); if (!w) throw new Error('Rozdzialy: obiekt spoza Rozdzialy.plan'); return w; }

  function planRozdzialu(rid, O, ctx) {
    var K = KK(), ujO = O.ujecia[rid], wersyO = O.wersy[rid];
    var ujecia = [], wersy = [], zdarzenia = [], t = 0;
    // 1) czas naturalny ujęcia: wejście + wersy (harmonogram) + oddech; cel_s ze scenopisu jest celem
    var miary = ujO.map(function (u0) {
      var ws = wersyO.filter(function (w) { return w.scena === u0.id; });
      var lead = ws.length ? WEJSCIE[u0.wejscie] || 0.3 : 0;
      // czas z liczby znaków tego, co czyta synteza (`wymowa`, inaczej `tekst`) — liczby słownie są dłuższe od cyfr
      var plan0 = K.harmonogram(ws.map(function (w) { return { id: w.id, tekst: w.wymowa || w.tekst, czas: ctx.czasy[w.id] }; }),
        { start: 0, tempo: TEMPO, przerwa: PRZERWA, min: MIN_WERS });
      var mowa = plan0.length ? plan0[plan0.length - 1].koniec + PRZERWA : 0;
      // cisza po lektorze: oddech po scenie (oddechPo_s, dodatkowo) albo zawieszenie przed cięciem (zawieszeniePo_s,
      // R9.8: 0,8 s ciszy po ostatnim wersie razem z przerwą 0,35 s)
      var zaw = Math.max(0, (u0.zawieszeniePo_s || 0) - (ws.length ? PRZERWA : 0));
      return { ws: ws, lead: lead, plan0: plan0, nat: lead + mowa + (u0.oddechPo_s || 0) + zaw };
    });
    // 2) nagranie dłuższe od celu w jednym ujęciu zjada nadwyżkę ciszy pozostałych ujęć z lektorem (nie poniżej ich czasu
    // naturalnego) — rozdział trzyma cel R8, póki starcza ciszy; plansze (bez wersów) mają stały czas
    var ponad = 0, cisza = 0;
    miary.forEach(function (m, i) {
      if (!m.ws.length) return;
      ponad += Math.max(0, m.nat - ujO[i].cel_s); cisza += Math.max(0, ujO[i].cel_s - m.nat);
    });
    var sciskaj = cisza > 0 ? Math.min(1, ponad / cisza) : 0;
    ujO.forEach(function (u0, i) {
      var u = {}, k, m = miary[i];
      for (k in u0) if (k !== 'kamera' && k !== 'zdarzenia') u[k] = u0[k];
      var dl = !m.ws.length ? u0.cel_s : m.nat >= u0.cel_s ? m.nat : u0.cel_s - sciskaj * (u0.cel_s - m.nat), zapas = dl - m.nat;
      var dodLead = m.ws.length ? Math.min(1.5, 0.25 * zapas) : 0, przerwaDod = m.ws.length ? (zapas - dodLead) / m.ws.length : 0;
      var kursor = t + m.lead + dodLead;
      m.plan0.forEach(function (h) {
        var d = h.koniec - h.start;
        wersy.push({ id: h.id, start: kursor, koniec: kursor + d, ujecie: u0.id });
        kursor += d + PRZERWA + przerwaDod;
      });
      u.od = t; u.do = t + dl;
      u.przejscie = null;
      if (u0.wejscie === 'C') u.przejscie = i === 0 ? { od: t, do: t + POL_C } : { od: t - POL_C, do: t + POL_C };
      else if (u0.wejscie === 'B') u.przejscie = { od: t - POL_B, do: t + POL_B };
      else if (u0.wejscie === 'Cc') u.przejscie = { od: t, do: u.do };
      ujecia.push(u);
      t = u.do;
    });
    var czas = t;
    var wersPoId = {};
    wersy.forEach(function (w) { wersPoId[w.id] = w; });
    ujO.forEach(function (u0, i) {
      (u0.zdarzenia || []).forEach(function (z) {
        var w = wersPoId[z.wers];
        if (!w) return;
        // zdarzenia wersu krótszego niż w danych (nagranie szybsze od tempa 12,1 zn./s) ściskane proporcjonalnie,
        // żeby ostatnie wypadło najpóźniej w 90% wersu — kolejność i odstępy względne zostają (LEK-5)
        var maks = Math.max.apply(null, u0.zdarzenia.filter(function (x) { return x.wers === z.wers; }).map(function (x) { return x.po_s; }));
        var dl = w.koniec - w.start, sk = maks > 0.9 * dl ? 0.9 * dl / maks : 1;
        zdarzenia.push({ t: w.start + z.po_s * sk, co: z.co, wers: z.wers, ujecie: u0.id });
      });
    });
    // animacje
    var animacje = [];
    ujecia.forEach(function (u) {
      if (!u.animacja) return;
      var start = u.od;
      zdarzenia.forEach(function (z) { if (z.ujecie === u.id && z.co === 'start-' + u.animacja.nazwa) start = z.t; });
      // `animacjaPoWersie`: chwila stoi na `od` do końca ostatniego wersu ujęcia (W5: licznik na postoju przez cały wers)
      if (u.animacjaPoWersie) wersy.forEach(function (w) { if (w.ujecie === u.id && w.koniec > start) start = w.koniec; });
      animacje.push({ nazwa: u.animacja.nazwa, od: start, do: u.do, f: [u.animacja.od, u.animacja.do], ujecie: u.id });
    });
    // przebicie tafli (ruling 8b-10): chwila, w której licznik A1 schodzi poniżej Ma wynurzenia jednostki (dane:
    // jednostki[].wynurzenie.Ma; ewolucja.js: pierwszy ląd nad taflą tuż po tym Ma) — z krzywej, nie z wersu
    animacje.forEach(function (an) {
      if (an.nazwa !== 'a1') return;
      var maT = function (t) { return maA1(ctx, an.f[0] + (an.f[1] - an.f[0]) * clamp01((t - an.od) / (an.do - an.od))); };
      (ctx.dane.jednostki || []).forEach(function (j) {
        // ewolucja.js stawia przebicie 1 rok (1e-6 Ma) po Ma zdarzenia — próg 1e-5 Ma (10 lat) to już ląd nad taflą
        var Mw = j.wynurzenie && j.wynurzenie.Ma > 0 ? j.wynurzenie.Ma - 1e-5 : 0;
        if (!(Mw > 0) || !(maT(an.od) >= Mw && maT(an.do) < Mw)) return;
        var lo = an.od, hi = an.do;
        for (var i = 0; i < 60; i++) { var m = (lo + hi) / 2; if (maT(m) < Mw) hi = m; else lo = m; }
        zdarzenia.push({ t: hi, co: 'przebicie-tafli', ujecie: an.ujecie, jednostka: j.id });
      });
    });
    zdarzenia.sort(function (a, b) { return a.t - b.t; });
    // chwila geologiczna ujęcia: a1 → oś czasu A1 (Animacje.czasMa, postoje na osCzasu z `postojA1`); inaczej `czasMa` z danych
    ujecia.forEach(function (u) {
      if (u.animacja && u.animacja.nazwa === 'a1') u.czasMa = [maA1(ctx, u.animacja.od), maA1(ctx, u.animacja.do)];
    });
    var rozdzial = { id: rid, tytul: O.ROZDZIALY_TYTULY[rid], czas: czas, wersy: wersy.map(function (w) { return { id: w.id, start: w.start, koniec: w.koniec }; }),
      ujecia: ujecia, kamera: [], animacje: animacje, zdarzenia: zdarzenia, stan: null, przewyzszenie: [{ t: 0, e: E_FILM }] };
    // przewyższenie: rampy z ujęć (`przewyzszenie: [{ u, e }]`, spec R2 — zmiana zawsze animowana), poza nimi ×1,5
    ujecia.forEach(function (u) {
      (u.przewyzszenie || []).forEach(function (q) { rozdzial.przewyzszenie.push({ t: u.od + q.u * (u.do - u.od), e: q.e }); });
    });
    rozdzial.przewyzszenie.sort(function (a, b) { return a.t - b.t; });
    // stan rozdziału
    var licz = {};
    ujecia.forEach(function (u) { if (u.typ !== 'plansza') licz[u.kolorowanie] = (licz[u.kolorowanie] || 0) + (u.do - u.od); });
    var kol = Object.keys(licz).sort(function (a, b) { return licz[b] - licz[a]; })[0] || 'krajobraz';
    var stan = { kolorowanie: kol, chmury: ujecia.some(function (u) { return u.animacja && u.animacja.nazwa === 'a4'; }) };
    var mas = [];
    ujecia.forEach(function (u) { if (u.czasMa) mas.push(u.czasMa[0], u.czasMa[1]); });
    if (mas.length) stan.czasMa = [Math.max.apply(null, mas), Math.min.apply(null, mas)];
    ujecia.forEach(function (u) {
      if (!u.przekroj || stan.przekroj) return;
      var pk = u.przekroj, c = ctx.czesci[pk.czesc];
      if (!c) throw new Error('Rozdzialy: ' + u.id + ': przekrój przez nieznaną część ' + pk.czesc);
      var st = zdarzenia.filter(function (z) { return z.ujecie === u.id && z.co === pk.start; })[0];
      stan.przekroj = { przez: pk.czesc, lonLat: c.lonLat.slice(), kat_st: pk.kat_st || 0, od: st ? st.t : u.od };
    });
    rozdzial.stan = stan;
    if (WEW) WEW.set(rozdzial, { ctx: ctx, ujO: ujO, cache: {} });
    zbudujKamere(rozdzial, ujO, ctx);
    oknaPrzenikania(rozdzial, ctx);
    rozdzial.ujecia.forEach(function (u, i) {
      if (i === 0) return;
      var a = u.przejscie ? u.przejscie.od : u.od, b = u.przejscie ? u.przejscie.do : u.od;
      zdarzenia.push({ t: a - ETYKIETY_PRZED, co: 'etykiety:gasna', ujecie: u.id });
      zdarzenia.push({ t: b, co: 'etykiety:wracaja', ujecie: u.id });
    });
    zdarzenia.sort(function (a, b) { return a.t - b.t; });
    return rozdzial;
  }

  /* ---------- klucze kamery ---------- */
  function zbudujKamere(r, ujO, ctx) {
    var W = wew(r), ujecia = r.ujecia, biegi = [], bieg = null;
    ujecia.forEach(function (u, i) {
      var u0 = ujO[i];
      if (u.typ === 'plansza' || !u0.kamera || !u0.kamera.length) { bieg = null; return; }
      if (!bieg || CIECIA[u.wejscie]) { bieg = { klucze: [], ujecia: [], start: u.od }; biegi.push(bieg); }
      bieg.ujecia.push(i);
      var poprz = null, ciaglosc = bieg.klucze.length > 0;
      u0.kamera.forEach(function (k0, j) {
        var k = {};
        var baza = poprz || (ciaglosc ? bieg.klucze[bieg.klucze.length - 1].zrodlo : {});
        ['cel', 'wzgledem', 'az', 'd', 'h', 'nad', 'fov', 'wstrzas', 'luk'].forEach(function (p) {
          k[p] = k0[p] !== undefined ? k0[p] : baza[p];
        });
        if (k0.nad === undefined && k0.h !== undefined) k.nad = undefined;
        if (k0.h === undefined && k0.nad !== undefined) k.h = undefined;
        if (k0.wzgledem === undefined && k0.cel !== undefined) k.wzgledem = undefined;
        if (k0.luk === undefined) k.luk = false;
        k.krzywa = k0.krzywa || null;
        k.stop = !!k0.stop;
        poprz = k;
        var tk;
        if (k0.kiedy) {
          var z = r.zdarzenia.filter(function (x) { return x.ujecie === u.id && x.co === k0.kiedy; })[0];
          if (!z) throw new Error('Rozdzialy: ' + u.id + ': klucz kiedy=' + k0.kiedy + ' bez zdarzenia');
          tk = z.t + (k0.po_s || 0);
        } else tk = u.od + (k0.u || 0) * (u.do - u.od);
        if (ciaglosc && j === 0 && !(k0.u > 0) && !k0.kiedy) return;   // D/P: początek = koniec poprzedniego ujęcia
        var c, a;
        try { c = rozwiazCel(ctx, k.cel); a = k.wzgledem ? rozwiazCel(ctx, k.wzgledem) : c; }
        catch (e) { throw new Error(e.message + ' (ujęcie ' + u.id + ', klucz ' + j + ')'); }
        var h = k.nad != null ? c.p[1] + k.nad : k.h;
        if (!isFinite(h) || !isFinite(k.az) || !isFinite(k.d) || !isFinite(k.fov)) throw new Error('Rozdzialy: ' + u.id + ': klucz ' + j + ' niepełny');
        var poz = [a.p[0] + k.d * Math.sin(k.az * RAD), h, a.p[2] - k.d * Math.cos(k.az * RAD)];
        bieg.klucze.push({ t: tk, A: a.p, az: k.az, d: k.d, h: h, C: c.p, fov: k.fov, wstrzas: k.wstrzas || 0, stop: k.stop,
          krzywa: k.krzywa, luk: k.luk, poz: poz, ujecie: u.id, zrodlo: k, obiekt: c.obiekt });
      });
    });
    biegi.forEach(function (b) {
      b.klucze.sort(function (x, y) { return x.t - y.t; });
      // azymut rozwinięty: każdy klucz w ±180° od poprzedniego (najkrótsza droga)
      for (var i = 1; i < b.klucze.length; i++) {
        var p = b.klucze[i - 1].az, q = b.klucze[i].az, dlt = q - p;
        if (Math.abs(dlt) > 180) b.klucze[i].az = q - 360 * Math.round(dlt / 360);
      }
      var ost = r.ujecia[b.ujecia[b.ujecia.length - 1]];
      b.koniec = ost.do;
      var pierwsze = r.ujecia[b.ujecia[0]];
      if (Math.abs(b.klucze[0].t - pierwsze.od) > 1e-6) throw new Error('Rozdzialy: ' + pierwsze.id + ': bieg kamery bez klucza na początku (u = 0)');
      if (Math.abs(b.klucze[b.klucze.length - 1].t - ost.do) > 1e-6) throw new Error('Rozdzialy: ' + ost.id + ': bieg kamery bez klucza na końcu (u = 1)');
      // koniec biegu przed cięciem: kamera w ruchu; przed końcem rozdziału z oddechem albo dojazdem: hamuje
      b.ruchKoniec = !(ost.oddechPo_s > 0) && ost.typ !== 'dojazd';
      b.ruchStart = r.ujecia[b.ujecia[0]].typ !== 'statyw' || b.klucze.length > 1;
    });
    W.biegi = biegi;
    r.kamera = [];
    biegi.forEach(function (b) {
      b.klucze.forEach(function (k) {
        var gp = geo(k.poz[0], k.poz[2]), gc = geo(k.C[0], k.C[2]);
        r.kamera.push({ t: k.t, poz: [gp[0], gp[1], k.poz[1] * 1000], cel: [gc[0], gc[1], k.C[1] * 1000], fov: k.fov, ujecie: k.ujecie });
      });
    });
    r.kamera.sort(function (a, b) { return a.t - b.t; });
  }

  // kanały biegu dla danej proporcji i siatki (wymagany odjazd zależy od obu)
  function kanaly(r, b, siatka, proporcja) {
    // proporcja zaokrąglona do 1e-3: kanały liczone dla zaokrąglonej (klucz i wynik zależą od tej samej wartości)
    proporcja = Math.round(proporcja * 1000) / 1000;
    var W = wew(r), klucz = b.start + '|' + komorkaSiatki(siatka) + '|' + proporcja;
    if (W.cache[klucz]) return W.cache[klucz];
    var tel = proporcja < 1.5, ks = b.klucze, n = ks.length, ts = ks.map(function (k) { return k.t; });
    var ujPo = {};
    r.ujecia.forEach(function (u) { ujPo[u.id] = u; });
    var kan = { ax: [], ay: [], az: [], th: [], ld: [], lh: [], cx: [], cy: [], cz: [], fov: [], ws: [], lr: [], cap: [] };
    ks.forEach(function (k) {
      kan.ax.push(k.A[0]); kan.ay.push(k.A[1]); kan.az.push(k.A[2]); kan.th.push(k.az); kan.ld.push(asinhS(k.d)); kan.lh.push(asinhS(k.h));
      kan.cx.push(k.C[0]); kan.cy.push(k.C[1]); kan.cz.push(k.C[2]); kan.fov.push(k.fov); kan.ws.push(k.wstrzas);
      kan.lr.push(asinhS(odjazdKlucza(r, k, ujPo[k.ujecie], siatka, proporcja)));
      kan.cap.push(ujPo[k.ujecie].poziom === 'glob' ? FOV_MAX_GLOB : FOV_MAX);
    });
    var stop = ks.map(function (k, i) { return k.stop || !!k.krzywa || (i + 1 < n && !!ks[i + 1].krzywa); });
    var m = {};
    Object.keys(kan).forEach(function (c) { m[c] = styczne(ts, kan[c], stop, b.ruchStart, b.ruchKoniec); });
    W.cache[klucz] = { ts: ts, kan: kan, m: m, tel: tel };
    return W.cache[klucz];
  }
  // limit fov telefonu: glob 30°, reszta 40° (RUCH-8) — `cap` jest kanałem kluczy, więc przez szew P zmienia się płynnie
  function fovTel(fov, cap) {
    return Math.min(cap, 2 * Math.atan(1.6 * Math.tan(fov / 2 * RAD)) / RAD);
  }
  // odjazd wymagany w kluczu [km od celu]: telefon (R/sin(0,85·β), poziomy wyspa/wstawka) i gęstość (H ≥ 45 komórek)
  function odjazdKlucza(r, k, u, siatka, proporcja) {
    var W = wew(r), tel = proporcja < 1.5, fov = tel ? fovTel(k.fov, u.poziom === 'glob' ? FOV_MAX_GLOB : FOV_MAX) : k.fov;
    var H = GESTOSC * komorka(u.poziom, siatka, proporcja, W.ctx.meta) * 1.02;
    var dG = H / (2 * Math.tan(fov / 2 * RAD)), dT = 0;
    // telefon: odjazd tylko z wysokości ≥ 1,4 km (płynnie od 0,4 km) — teleobiektyw znad tafli (sylwetka, port z morza,
    // ujęcia podwodne) zostaje przy kadrze kinowym, inaczej odjeżdżałby na setki km w ocean i za sąsiednie wyspy
    if (tel && (u.poziom === 'wyspa' || u.poziom.indexOf('wstawka:') === 0) && u.obiekt) {
      var R = u.obiekt.promienPion_km || u.obiekt.promien_km || 0;
      var beta = Math.atan(proporcja * Math.tan(fov / 2 * RAD));
      dT = R / Math.sin(0.85 * beta) * gladko((k.h - 0.4) / 1.0);
    }
    return Math.max(dG, dT);
  }
  function smax(a, b) { var k = 0.08 * b; return (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2; }

  function indeksUjecia(r, t) {
    var U = r.ujecia;
    for (var i = 0; i < U.length; i++) if (t < U[i].do) return i;
    return U.length - 1;
  }
  function biegDla(r, t) {
    var W = wew(r), i = indeksUjecia(r, t), b;
    for (var j = 0; j < W.biegi.length; j++) if (W.biegi[j].ujecia.indexOf(i) >= 0) b = W.biegi[j];
    if (b) return { b: b, t: t };
    // plansza / brak kamery: poza następnego biegu na jego starcie (albo koniec poprzedniego)
    for (j = 0; j < W.biegi.length; j++) if (W.biegi[j].ujecia[0] > i) return { b: W.biegi[j], t: W.biegi[j].klucze[0].t };
    var o = W.biegi[W.biegi.length - 1];
    return o ? { b: o, t: o.koniec } : null;
  }

  function przewyzszenieW(r, t) {
    var p = r.przewyzszenie || [{ t: 0, e: E_FILM }];
    if (t <= p[0].t) return p[0].e;
    for (var i = 0; i < p.length - 1; i++) if (t < p[i + 1].t) return p[i].e + (p[i + 1].e - p[i].e) * gladko((t - p[i].t) / (p[i + 1].t - p[i].t));
    return p[p.length - 1].e;
  }

  // punkt obiektu głównego ujęcia [km, rzeczywiste]; przez szwy D/P przechodzi płynnie z obiektu poprzedniego ujęcia (2 s)
  function obiektPunkt(r, i) {
    var W = wew(r), u = r.ujecia[i];
    if (!W.obiekty) W.obiekty = {};
    if (W.obiekty[i] !== undefined) return W.obiekty[i];
    var o = u.obiekt, pkt = null;
    if (u.poziom !== 'glob' && u.typ !== 'plansza' && o && (o.czesc || o.lonLat)) {
      var ll = o.lonLat || W.ctx.czesci[o.czesc].lonLat, xz = lok(ll[0], ll[1]);
      pkt = [xz[0], o.hc != null ? o.hc : Math.max(0, terenKm(W.ctx, ll[0], ll[1])), xz[1]];
    }
    W.obiekty[i] = pkt;
    return pkt;
  }
  // obiekt w chwili t: na szwie D/P (granica b) płynnie z obiektu poprzedniego ujęcia do bieżącego — od ostatniego klucza
  // poprzedniego ujęcia do pierwszego klucza bieżącego (w kluczach obiekt jest zawsze „swój”, KAD-3), co najmniej 2 s
  function oknoSzwu(r, j) {
    var W = wew(r), U = r.ujecia;
    if (!W.szwy) W.szwy = {};
    if (W.szwy[j] !== undefined) return W.szwy[j];
    var wyn = null;
    if (j > 0 && j < U.length && (U[j].wejscie === 'D' || U[j].wejscie === 'P')) {
      var A = obiektPunkt(r, j - 1), B = obiektPunkt(r, j), b = U[j].od;
      if (A && B) {
        var przed = r.kamera.filter(function (k) { return k.ujecie === U[j - 1].id && k.t <= b + 1e-9; });
        var po = r.kamera.filter(function (k) { return k.ujecie === U[j].id && k.t > b + 1e-6; });
        var t0 = przed.length ? przed[przed.length - 1].t : U[j - 1].od, t1 = po.length ? po[0].t : U[j].do;
        if (t1 - t0 < 2) { var sr = (t0 + t1) / 2; t0 = sr - 1; t1 = sr + 1; }
        wyn = { A: A, B: B, t0: t0, t1: t1 };
      }
    }
    W.szwy[j] = wyn;
    return wyn;
  }
  function obiektW(r, i, t) {
    var X = obiektPunkt(r, i);
    if (!X) return X;
    var s = oknoSzwu(r, i), n = oknoSzwu(r, i + 1);
    if (n && t > n.t0) s = n; else if (!s || t >= s.t1) return X;
    var q = gladko((t - s.t0) / (s.t1 - s.t0));
    return [s.A[0] + (s.B[0] - s.A[0]) * q, s.A[1] + (s.B[1] - s.A[1]) * q, s.A[2] + (s.B[2] - s.A[2]) * q];
  }
  // proporcja zaokrąglona do 1e-3 raz, na wejściu kamera() i metryki(): próg telefonu (< 1,5), kanały i pamięć
  // podręczna liczą tę samą wartość (bez tego 1,4996 dawało tel = true w kamerze, a kanały liczone dla 1,5)
  function proporcjaWejscia(a) { return a > 0 ? Math.round(a * 1000) / 1000 : 2.39; }
  function kamera(r, t, siatka, proporcja) {
    proporcja = proporcjaWejscia(proporcja);
    var W = wew(r), krzywe = W.ctx.krzywe, bt = biegDla(r, t);
    if (!bt) throw new Error('Rozdzialy.kamera: rozdział bez kamery');
    var b = bt.b, tt = Math.max(b.klucze[0].t, Math.min(bt.t, b.klucze[b.klucze.length - 1].t));
    var K = kanaly(r, b, siatka, proporcja), ks = b.klucze, n = ks.length, w = {}, c;
    var i = 0;
    while (i < n - 2 && tt >= K.ts[i + 1]) i++;
    var cel, poz, k0 = ks[i], k1 = ks[Math.min(i + 1, n - 1)];
    if (n === 1) { for (c in K.kan) w[c] = K.kan[c][0]; }
    else {
      var h = K.ts[i + 1] - K.ts[i], s = h > 0 ? clamp01((tt - K.ts[i]) / h) : 1;
      if (k1.krzywa) {
        var e = k1.krzywa === 'dojazd' ? 1 - krzywe.dojazd(s, 4) : k1.krzywa === 'cruise' ? krzywe.cruise(s, 0.3) : gladko(s);
        for (c in K.kan) w[c] = K.kan[c][i] + (K.kan[c][i + 1] - K.kan[c][i]) * e;
        // odległość i wysokość: logLerp (dodatnie), inaczej liniowo w asinh
        w.ld = asinhS(k0.d > 0 && k1.d > 0 ? krzywe.logLerp(k0.d, k1.d, e) : sinhS(w.ld));
        if (k0.h > 0 && k1.h > 0) w.lh = asinhS(krzywe.logLerp(k0.h, k1.h, e));
        w._e = e;
      } else {
        for (c in K.kan) w[c] = hermite(K.kan[c][i], K.kan[c][i + 1], K.m[c][i], K.m[c][i + 1], h, s);
        w._e = s;
      }
    }
    var A = [w.ax, w.ay, w.az], dd = Math.max(0, sinhS(w.ld)), hh = sinhS(w.lh);
    poz = [A[0] + dd * Math.sin(w.th * RAD), hh, A[2] - dd * Math.cos(w.th * RAD)];
    cel = [w.cx, w.cy, w.cz];
    if (n > 1 && k1.luk) {
      // cel przy zmianie obiektu po łuku (kino.js aimArc): kierunki z kluczy, pozycja bieżąca
      cel = krzywe.aimArc(poz, sub(k0.C, k0.poz), sub(k1.C, k1.poz), w._e);
    }
    var iu = indeksUjecia(r, t), u = r.ujecia[iu], tel = proporcja < 1.5;
    var fov = tel ? fovTel(w.fov, w.cap) : w.fov;
    // odjazd (telefon, gęstość) na odległość `req` od celu: wstecz wzdłuż osi, ale bez schodzenia w dół — składowa
    // pionowa kierunku wstecz ≥ 0 (gładkie min, bez przełączania przy poziomej osi), więc kamera patrząca w górę
    // odsuwa się poziomo i nie wchodzi w teren
    var os = sub(cel, poz), dist = len(os), req = sinhS(w.lr);
    if (req > 0 && dist > 0) {
      var nd = smax(dist, req);
      if (nd > dist + 1e-12) {
        var f = mul(os, 1 / dist), fy = (f[1] - Math.sqrt(f[1] * f[1] + 0.0025)) / 2;
        var b = norm([-f[0], -fy, -f[2]]);                       // kierunek od celu w stronę kamery
        var c0 = mul(os, -1), cb = dot(c0, b);                   // kamera = cel + c0 + s·b, |c0 + s·b| = nd
        var sk = -cb + Math.sqrt(Math.max(0, cb * cb - (dist * dist - nd * nd)));
        poz = add(poz, mul(b, sk));
      }
    }
    // telefon (spec R3: kadrujemy rdzeń): oś przesunięta o 70% od celu kadru kinowego ku obiektowi głównemu ujęcia —
    // kąt obiektu od osi maleje 3,3× jak szerokość kadru (β telefonu ≈ ⅓ β kina); przez szwy D/P obiekt płynie (obiektW)
    // ujęcie z `osTelefonu: 'cel'` (np. lot za czołem lawy): oś zostaje na celu kluczy także na telefonie
    var E = przewyzszenieW(r, t), X = tel && u.osTelefonu !== 'cel' ? obiektW(r, iu, t) : null;
    if (X) {
      // obrót samego kierunku (odległość celu bez zmian — H i gęstość liczone w tej samej odległości co bez obrotu)
      var ps = [poz[0], doSceny(poz[1], E), poz[2]], Xs = [X[0], doSceny(X[1], E), X[2]], cs = [cel[0], doSceny(cel[1], E), cel[2]];
      var c2 = add(cs, mul(sub(Xs, cs), TEL_OBIEKT)), c3 = add(ps, mul(norm(sub(c2, ps)), len(sub(cs, ps))));
      cel = [c3[0], zeSceny(c3[1], E), c3[2]];
    }
    // wstrząs: obrót kierunku patrzenia (azymut ±0,8°, elewacja ±0,5° × wstrząs; spec R3)
    if (w.ws > 1e-9) {
      var v = sub(cel, poz), L = len(v), az0 = Math.atan2(v[0], -v[2]), el0 = Math.asin(v[1] / L);
      var az1 = az0 + w.ws * 0.8 * RAD * fala(t, 0), el1 = el0 + w.ws * 0.5 * RAD * fala(t, 2.1);
      cel = add(poz, [L * Math.cos(el1) * Math.sin(az1), L * Math.sin(el1), -L * Math.cos(el1) * Math.cos(az1)]);
    }
    return { poz: [poz[0], doSceny(poz[1], E), poz[2]], cel: [cel[0], doSceny(cel[1], E), cel[2]], fov: fov, przechyl: 0,
      pozR: poz, celR: cel, poziom: u.poziom, ujecie: u.id, e: E };
  }

  /* ---------- okna przenikania P (z kamery: H przechodzi przez okno spec R2) ---------- */
  function wysokoscKadru(p) { return 2 * len(sub(p.celR, p.pozR)) * Math.tan(p.fov / 2 * RAD); }
  function oknaPrzenikania(r, ctx) {
    r.ujecia.forEach(function (u, i) {
      if (u.wejscie !== 'P' || i === 0) return;
      var para = [r.ujecia[i - 1].poziom, u.poziom].map(function (p) { return p.indexOf('wstawka') === 0 ? 'wyspa' : p; });
      var okno = PRZENIKANIE[para.join('|')] || PRZENIKANIE[para.slice().reverse().join('|')];
      var b = u.od;
      if (!okno) { u.przejscie = { od: b - 0.8, do: b + 0.8 }; return; }
      var H = function (t) { return wysokoscKadru(kamera(r, t, ctx.siatka, 2.39)); };
      var lo = okno[0], hi = okno[1], dt = 1 / 120, a = b, z = b;
      var od = r.ujecia[i - 1].od, doo = u.do;
      while (a - dt > od && H(a - dt) >= lo && H(a - dt) <= hi) a -= dt;
      while (z + dt < doo && H(z + dt) >= lo && H(z + dt) <= hi) z += dt;
      if (z - a < 0.2) { a = b - 0.8; z = b + 0.8; }
      u.przejscie = { od: a, do: z };
    });
  }

  /* ---------- chwila: stan obrazu w czasie t ---------- */
  function chwila(r, t) {
    var i = indeksUjecia(r, t), u = r.ujecia[i], uu = u.do > u.od ? clamp01((t - u.od) / (u.do - u.od)) : 0;
    var Ma = 0;
    if (u.czasMa) {
      if (u.animacja && u.animacja.nazwa === 'a1') {
        var an = r.animacje.filter(function (a) { return a.ujecie === u.id; })[0];
        var f = an.f[0] + (an.f[1] - an.f[0]) * clamp01((t - an.od) / (an.do - an.od));
        Ma = maA1(wew(r).ctx, f);
      } else Ma = u.czasMa[0];
    }
    // woda: zdarzenie `woda:X` w ujęciu przełącza stan (realna → szklana przez 2,5 s; na czas zmiany liczymy realną)
    var woda = u.woda, prev = i > 0 ? r.ujecia[i - 1].woda : 'realna';
    r.zdarzenia.forEach(function (z) {
      if (z.ujecie !== u.id || z.co.indexOf('woda:') !== 0) return;
      var cel = z.co.slice(5), koniec = z.t + (cel === 'szklana' ? 2.5 : 0);
      woda = t < koniec ? (cel === 'szklana' ? 'realna' : prev === 'szklana' ? 'szklana' : prev) : cel;
    });
    // słońce: przez D i P płynnie od poprzedniego ujęcia (po oknie przejścia, do połowy ujęcia); na cięciach skok
    var s1 = u.swiatlo, sl = { az: s1.az, el: s1.el, pora: s1.pora };
    if (i > 0 && (u.wejscie === 'D' || u.wejscie === 'P') && r.ujecia[i - 1].swiatlo) {
      var s0 = r.ujecia[i - 1].swiatlo, a0 = u.przejscie ? u.przejscie.do : u.od, a1 = u.od + 0.5 * (u.do - u.od);
      var q = gladko((t - a0) / Math.max(1e-6, a1 - a0));
      sl = { az: s0.az + (s1.az - s0.az) * q, el: s0.el + (s1.el - s0.el) * q, pora: q < 0.5 ? s0.pora : s1.pora };
    }
    return { ujecie: u.id, indeks: i, u: uu, czasMa: Ma, woda: woda, slonce: sl, przewyzszenie: przewyzszenieW(r, t) };
  }

  /* ---------- rzut ---------- */
  function baza(p) {
    var f = norm(sub(p.cel, p.poz)), rr = cross(f, [0, 1, 0]);
    if (len(rr) < 1e-9) rr = [1, 0, 0];
    rr = norm(rr);
    return { f: f, r: rr, u: cross(rr, f) };
  }
  function ndc(p, X, proporcja) {
    var B = baza(p), d = sub(X, p.poz), z = dot(d, B.f), tg = Math.tan(p.fov / 2 * RAD);
    return [dot(d, B.r) / (z * tg * (proporcja || 2.39)), dot(d, B.u) / (z * tg), z];
  }

  /* ---------- metryki ruchu (spec R3: z czystej funkcji pozy, 60 Hz) ---------- */
  function metryki(r, siatka, o) {
    o = o || {};
    var hz = o.hz || 60, a = proporcjaWejscia(o.proporcja), dt = 1 / hz, T = TR();
    var wynik = [];
    r.ujecia.forEach(function (u) {
      if (u.typ === 'plansza') return;
      var N = Math.max(2, Math.floor((u.do - u.od) * hz) + 1), P = [];
      for (var i = 0; i < N; i++) {
        var t = Math.min(u.do - 1e-6, u.od + i * dt);
        P.push({ t: t, p: kamera(r, t, siatka, a) });
      }
      var wMax = 0, wMaxP = 0, wMaxW = 0, awMax = 0, relvMax = 0, arelMax = 0, fovMax = 0, dfovMax = 0, przes = Infinity, gest = Infinity;
      var om = [], ruch = [], mowa = function (t) { return r.wersy.some(function (w) { return t >= w.start && t <= w.koniec; }); };
      var wP = function (t) { return r.ujecia.some(function (x) { return x.wejscie === 'P' && x.przejscie && t >= x.przejscie.od && t <= x.przejscie.do; }); };
      for (i = 0; i < N; i++) {
        var p = P[i].p, dist = len(sub(p.cel, p.poz));
        fovMax = Math.max(fovMax, p.fov);
        if (i > 0) dfovMax = Math.max(dfovMax, Math.abs(p.fov - P[i - 1].p.fov) / dt);
        var ll = geo(p.pozR[0], p.pozR[2]), ter = siatka ? T.probka(siatka, ll[0], ll[1]) : null;
        var terKm = o.teren ? o.teren(ll[0], ll[1], P[i].t) : ter === null ? 0 : ter / 1000;
        przes = Math.min(przes, (p.pozR[1] - terKm) * 1000);
        gest = Math.min(gest, wysokoscKadru(p) / komorka(u.poziom, siatka, a, wew(r).ctx.meta));
        if (i < N - 1) {
          var q = P[i + 1].p, f0 = norm(sub(p.cel, p.poz)), f1 = norm(sub(q.cel, q.poz));
          var ax = cross(f0, f1), kat = Math.atan2(len(ax), dot(f0, f1));
          var wv = mul(norm(ax), kat / dt);
          om.push(wv);
          var v = len(sub(q.poz, p.poz)) / dt / Math.max(1e-9, dist);
          ruch.push(v + kat / dt);
          var wd = kat / dt / RAD;
          // w oknie przenikania P limit 35°/s (spec R3) — osobno; wMax = poza oknami P
          if (wP(P[i].t)) wMaxP = Math.max(wMaxP, wd); else wMax = Math.max(wMax, wd);
          if (mowa(P[i].t)) wMaxW = Math.max(wMaxW, wd);
          relvMax = Math.max(relvMax, v);
        }
        if (i > 0 && i < N - 1) {
          var acc = sub(add(P[i + 1].p.poz, P[i - 1].p.poz), mul(p.poz, 2));
          arelMax = Math.max(arelMax, len(acc) / (dt * dt) / Math.max(1e-9, dist));
        }
      }
      for (i = 1; i < om.length; i++) awMax = Math.max(awMax, len(sub(om[i], om[i - 1])) / dt / RAD);
      var sred = ruch.reduce(function (s, x) { return s + x; }, 0) / Math.max(1, ruch.length), postoj = 0, bieg = 0;
      ruch.forEach(function (x) { if (x < 0.02 * sred) { bieg += dt; postoj = Math.max(postoj, bieg); } else bieg = 0; });
      wynik.push({ id: u.id, wMax: wMax, wMaxP: wMaxP, wMaxPodWersem: wMaxW, awMax: awMax, relvMax: relvMax, arelMax: arelMax, przechylMax: 0,
        postojMax_s: postoj, vStart: sred > 0 ? ruch[0] / sred : 0, przeswitMin_m: przes, gestoscMin: gest, fovMax: fovMax, dfovMax: dfovMax });
    });
    return { ujecia: wynik };
  }

  var api = { plan: plan, kamera: kamera, metryki: metryki, chwila: chwila, ndc: ndc, wysokoscKadru: wysokoscKadru,
    komorka: function (poziom, siatka, proporcja, poziomy) { return komorka(poziom, siatka, proporcja, metaPoziomow(poziomy)); },
    doSceny: doSceny, zeSceny: zeSceny, PRZENIKANIE: PRZENIKANIE, GESTOSC: GESTOSC, TEMPO: TEMPO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Rozdzialy = api;
})(typeof window !== 'undefined' ? window : globalThis);
