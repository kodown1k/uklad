'use strict';
/* Zjawisko „Rodzaje sztucznych satelitów Ziemi” — piętra orbit, zadania i rozmiary satelitów w 35 krokach.
   Treść (fakty, liczby, daty, nazwiska) WYŁĄCZNIE z artykułu Bajarza „Rodzaje sztucznych satelitów Ziemi”
   (16 października 2026); narracja streszcza i tnie jego zdania (druga osoba, obraz → sekret), niczego nie dopisuje.
   Liczby są zaokrąglone tak jak w artykule; zastrzeżenia artykułu (Vanguard, satelity wojskowe, próg Kesslera)
   zostają jako ramki. Sceny są SCHEMATAMI — podpis każdego kroku mówi to wprost. Jedyna scena w jednej skali
   to rycina „Wszystko w jednej skali” (kroki 11–12); jej przelicznik to promień Ziemi R_KM (w tekście nie pada).

   Wykonanie kinowe: każdy krok ma `ujecie` (tor Catmull-Rom, cel, FOV, czas, kompozycja) i `scena`
   (zmiana sceny = cięcie przez czerń). Ruch w scenach liczony z czasu t (bez całkowania po dt), więc hak
   `?smoke&zjawisko=satelity&krok=N` pokazuje deterministyczny kadr w chwili `tPogl`.

   Układ sceny: y w górę, Ziemia w początku układu (promień w jednostkach sceny ustawia zestaw `ziemia`),
   słońce domyślnie z kierunku +x. Plik dual-export: w node zwraca samą definicję (dane kroków + czysta
   fizyka do testów); w przeglądarce rejestruje się w `Zjawiska` i buduje sceny leniwie przez `ctx` z widok.js. */
(function (root) {
  var wNode = (typeof module !== 'undefined' && module.exports);
  var L = wNode ? require('./logika.js') : root.ZjawiskaLogika;

  var TAU = Math.PI * 2;
  var R_KM = 6371;                   // promień Ziemi [km] — wyłącznie przelicznik ryciny „Wszystko w jednej skali”

  /* =====================================================================
     Fizyka i geometria (czyste funkcje, bez THREE — testowane w node)
     ===================================================================== */
  // Równanie Keplera M = E − e·sin E (Newton-Raphson).
  function keplerE(M, e) {
    var E = e < 0.8 ? M : Math.PI;
    for (var i = 0; i < 40; i++) {
      var d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= d;
      if (Math.abs(d) < 1e-12) break;
    }
    return E;
  }
  // Położenie na elipsie (ognisko w 0, perycentrum na +x) w ułamku okresu f liczonym od perycentrum.
  function naElipsie(a, e, f) {
    var M = TAU * (f - Math.floor(f)), E = keplerE(M, e);
    return [a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E)];
  }
  // Punkt orbity kołowej: płaszczyzna równika (xz, kąt th przeciwnie do wskazówek patrząc z góry),
  // potem nachylenie `inc` wokół osi x (th = 90° idzie na północ), potem węzeł `om` wokół osi y.
  function naOrbicie(r, th, inc, om) {
    var x = r * Math.cos(th), z0 = -r * Math.sin(th), si = Math.sin(inc || 0), ci = Math.cos(inc || 0);
    var y = -z0 * si, z = z0 * ci, co = Math.cos(om || 0), so = Math.sin(om || 0);
    return [x * co + z * so, y, -x * so + z * co];
  }
  // Rzut poziomy Newtona z wysokości r0 (μ = 1) z prędkością k·v_kołowa; całkowanie leapfrog przez jeden okres
  // orbity kołowej albo do zderzenia z kulą R. Start w (0, r0), lot ku +x (zgodnie ze wskazówkami zegara).
  function rzutNewtona(r0, k, R, n) {
    n = n || 2400;
    var x = 0, y = r0, vx = k * Math.sqrt(1 / r0), vy = 0, okres = TAU * Math.sqrt(r0 * r0 * r0), dt = okres / n;
    var ax = 0, ay = 0, pts = [[x, y]], trafil = false;
    function przysp() { var r2 = x * x + y * y, r3 = r2 * Math.sqrt(r2); ax = -x / r3; ay = -y / r3; }
    przysp();
    for (var i = 0; i < n; i++) {
      vx += ax * dt / 2; vy += ay * dt / 2;
      x += vx * dt; y += vy * dt;
      przysp();
      vx += ax * dt / 2; vy += ay * dt / 2;
      if (Math.sqrt(x * x + y * y) <= R) {               // dociągnij ostatni punkt do powierzchni
        var r = Math.sqrt(x * x + y * y); pts.push([x * R / r, y * R / r]); trafil = true; break;
      }
      pts.push([x, y]);
    }
    return { punkty: pts, trafil: trafil };
  }
  // Czy punkt p leży w cylindrycznym cieniu kuli o promieniu R (słońce w kierunku jednostkowym s)?
  function wCieniu(p, s, R) {
    var d = p[0] * s[0] + p[1] * s[1] + p[2] * s[2];
    if (d >= 0) return false;
    var qx = p[0] - d * s[0], qy = p[1] - d * s[1], qz = p[2] - d * s[2];
    return qx * qx + qy * qy + qz * qz < R * R;
  }
  // Kaskada Kesslera (schemat, liczby umowne): zderzenia pokoleniami — każde pokolenie ma dwa razy więcej
  // zderzeń i przychodzi szybciej niż poprzednie (reakcja „karmi się sama”). Zwraca listę zderzeń {t, pok, kat, r}.
  function harmonogramKaskady(los, pokolen, t0, przerwa0) {
    var out = [], t = t0, przerwa = przerwa0;
    for (var g = 0; g < pokolen; g++) {
      var n = Math.pow(2, g);
      for (var i = 0; i < n; i++) out.push({ t: t + los() * przerwa * 0.8, pok: g, kat: los() * TAU, r: los() });
      t += przerwa; przerwa *= 0.72;
    }
    return out.sort(function (a, b) { return a.t - b.t; });
  }
  // Akcenty kaskady: zderzenia z harmonogramu przesunięte tak, że pierwsze wypada w chwili t0 (kotwica „zderzenia”),
  // w oknie [tOd, tDo). Konsument: dźwięk filmu (zadanie 6 specyfikacji filmu).
  function akcentyKaskady(harm, t0, tOd, tDo) {
    var d = t0 - harm[0].t, out = [];
    for (var i = 0; i < harm.length; i++) { var t = harm[i].t + d; if (t >= tOd && t < tDo) out.push({ t: t, typ: 'zderzenie', pok: harm[i].pok }); }
    return out;
  }
  // Łąka: przelot satelity po wielkim kole od wschodu (chwila tw, kąt fiStart) do zgaśnięcia w cieniu Ziemi (chwila tg,
  // kąt FI_GASNIE) — ruch jednostajny, jasność narasta przez NARASTA s i gaśnie w oknie [tg − GASNIE[0], tg + GASNIE[1]].
  var LAKA = { FI_WSCHOD: 1.0, FI_GASNIE: 1.95, NARASTA: 0.8, GASNIE: [0.5, 0.3] };
  function przelotLaki(t, tw, tg, fiStart) {
    if (t < tw) return { fi: fiStart, jasnosc: 0 };
    var fi = fiStart + (LAKA.FI_GASNIE - fiStart) * (t - tw) / (tg - tw);
    return { fi: fi, jasnosc: Math.min(1, (t - tw) / LAKA.NARASTA) * (1 - L.odcinek(t, tg - LAKA.GASNIE[0], tg + LAKA.GASNIE[1])) };
  }
  // Sputnik: krąg j sygnału rośnie w fazie petla(t·V + j/KREGI). Po kotwicy ts („zaczęła piszczeć”) widać tylko kręgi
  // wypuszczone od ts (faza bez przeskoku między krokami); wypuszczenie kręgu = akcent „bip”, kręgi na zmianę dwóch fal.
  // Wypuszczenia leżą na jednej siatce t = e/(V·KREGI): w chwili e wypuszczany jest krąg j ≡ −e (mod KREGI).
  var SPUTNIK = { V: 0.55, KREGI: 6 };
  function fazaKregu(t, j, ts) {
    var u = L.petla(t * SPUTNIK.V + j / SPUTNIK.KREGI, 1);
    return ts == null || t - u / SPUTNIK.V >= ts ? u : -1;
  }
  function bipySputnika(tOd, tDo, ts) {
    var out = [], K = SPUTNIK.KREGI, f = SPUTNIK.V * K, od = ts == null ? tOd : Math.max(tOd, ts);
    for (var e = Math.ceil(od * f - 1e-9); e / f < tDo; e++) out.push({ t: e / f, typ: 'bip', fala: (((-e) % K + K) % K) % 2 });
    return out;
  }
  // Mołnija (dźwięk: „winda” w glissandzie): satelita na elipsie od perygeum RP do apogeum RA [j. sceny], czyli przez
  // zakres km z tytułu rozdziału R8 (jedno źródło z windą); ton = winda z wysokości minus ton rozdziału (środek
  // geometryczny zakresu), więc gra wokół tonu rozdziału.
  var MOLNIJA = { RP: 2.35, RA: 9.2, OKRES: 9 };
  function tonMolnii(f) {
    var A = (MOLNIJA.RP + MOLNIJA.RA) / 2, E = (MOLNIJA.RA - MOLNIJA.RP) / (MOLNIJA.RA + MOLNIJA.RP), q = naElipsie(A, E, f);
    var u = (Math.sqrt(q[0] * q[0] + q[1] * q[1]) - MOLNIJA.RP) / (MOLNIJA.RA - MOLNIJA.RP), km = L.wysokoscRozdzialu(R8);
    return L.tonWindy(km[0] + u * (km[1] - km[0])) - L.tonWindy(Math.sqrt(km[0] * km[1]));
  }
  function liczbaOdlamkow(harm, t, naZderzenie) {
    var n = 0;
    for (var i = 0; i < harm.length; i++) if (harm[i].t <= t) n += naZderzenie; else break;
    return n;
  }
  // Ryc. „Wszystko w jednej skali”: wysokość nad powierzchnią [km] → promień w promieniach Ziemi.
  function wSkali(wysKm) { return 1 + wysKm / R_KM; }

  /* =====================================================================
     Narzędzia budowy scen (wołane tylko w przeglądarce, z ctx.THREE)
     ===================================================================== */
  var R = wNode ? require('./rysunek.js') : root.ZjawiskaRysunek;   // wspólne prymitywy scen (zjawiska/rysunek.js)
  var mat = R.mat, przezr = R.przezr, rura = R.rura, kula = R.kula, skieruj = R.skieruj, grot = R.grot;
  // Lambert przyciemniony do 0,62: światła widoku dają do 1,45× koloru, a tu sceny mają jasne tło Ziemi.
  function matL(c, kolor, o) { return R.matL(c, kolor, o, 0.62); }
  // Phong do metalu: ciemna baza, jasny odblask — połysk bez przepalenia (światła widoku dają do 1,45× koloru)
  function metal(c, kolor, blask, o) { return new c.THREE.MeshPhongMaterial(Object.assign({ color: c.kolor(kolor).multiplyScalar(0.42), specular: new c.THREE.Color(blask || 0xbbbbbb), shininess: 90 }, o || {})); }
  // Linie bez zapisu głębi: przezroczyste orbity nie wycinają siebie nawzajem ani poświat.
  function linia(c, punkty, kolor, o) { return R.linia(c, punkty, kolor, Object.assign({ glebia: false }, o)); }
  // Okrąg orbity (lista punktów w przestrzeni) — nachylenie i węzeł jak w naOrbicie.
  function punktyOrbity(T, r, inc, om, n) {
    var p = []; n = n || 160;
    for (var i = 0; i <= n; i++) { var q = naOrbicie(r, i / n * TAU, inc, om); p.push(new T.Vector3(q[0], q[1], q[2])); }
    return p;
  }
  function orbita(c, r, kolor, o) { o = o || {}; return linia(c, punktyOrbity(c.THREE, r, o.inc, o.om, o.n), kolor, o); }
  // Miękka poświata (sprite addytywny); ostrzejszy środek niż domyślny w rysunek.js.
  var STOPY_POSWIATY = [[0, 1], [0.22, 0.5], [1, 0]];
  function poswiata(c, kolor, rozmiar, krycie) { return R.poswiata(c, kolor, rozmiar, krycie, STOPY_POSWIATY); }
  // Pierścień-sprite (fala sygnału, błysk zderzenia): obręcz od 40/64 do 62/64 promienia, szczyt w 3/4 szerokości.
  var STOPY_OBRECZY = [[0, 0], [0.6875, 0.9], [22 / 24, 0]];
  function obrecz(c, kolor) {
    var T = c.THREE;
    return new T.Sprite(new T.SpriteMaterial({ map: R.teksturaRadialna(c, kolor, STOPY_OBRECZY, 128, 40 / 64), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
  }
  // Strzałka od a do b (trzon-rura + grot); zwraca grupę z metodą ustaw(a, b).
  function strzalka(c, kolor, grubosc, rozmiarGrotu) {
    var T = c.THREE, g = new T.Group(), gr = grubosc || 0.02;
    var trzon = new T.Mesh(new T.CylinderGeometry(gr, gr, 1, 8), mat(c, kolor)); g.add(trzon);
    var gt = grot(c, kolor, rozmiarGrotu || 0.12); g.add(gt);
    var kier = new T.Vector3(), A = new T.Vector3(), B = new T.Vector3();
    g.userData.ustaw = function (a, b) {
      A.set(a[0], a[1], a[2]); B.set(b[0], b[1], b[2]);
      kier.subVectors(B, A); var d = kier.length(); if (d < 1e-6) { g.visible = false; return; }
      g.visible = true;
      var dl = Math.max(0.001, d - (rozmiarGrotu || 0.12) * 1.6);
      trzon.scale.set(1, dl, 1); trzon.position.copy(A).addScaledVector(kier, dl / 2 / d); skieruj(T, trzon, kier);
      gt.position.copy(A).addScaledVector(kier, (dl + (rozmiarGrotu || 0.12) * 0.8) / d); skieruj(T, gt, kier);
    };
    return g;
  }
  // Satelita ogólny: ciało w złotej folii, dwa skrzydła baterii, antena; poświata do widoku z daleka.
  function satelita(c, o) {
    o = o || {}; var T = c.THREE, g = new T.Group(), s = o.skala || 1;
    g.add(new T.Mesh(new T.BoxGeometry(0.16, 0.16, 0.2), matL(c, o.kolor || 'zloto', { emissive: c.kolor(o.kolor === 'atrament-3' ? 'linia' : 'zloto-tlo') })));
    [-1, 1].forEach(function (zn) {
      var p = new T.Mesh(new T.BoxGeometry(0.36, 0.008, 0.13), matL(c, o.panele || 'granat', { emissive: c.kolor('granat-tlo') }));
      p.position.x = zn * 0.29; g.add(p);
      var ram = new T.Mesh(new T.BoxGeometry(0.1, 0.012, 0.012), mat(c, 'atrament-3')); ram.position.x = zn * 0.1; g.add(ram);
    });
    if (o.antena !== false) {
      var a = new T.Mesh(new T.ConeGeometry(0.07, 0.04, 16, 1, true), matL(c, 'atrament', { side: T.DoubleSide }));
      a.position.y = -0.11; a.rotation.x = Math.PI; g.add(a);
    }
    if (o.blask !== false) { var pw = poswiata(c, o.blask || 'zar', o.rozmiarBlasku || 0.9, 0.55); g.add(pw); g.userData.blask = pw; }
    g.scale.set(s, s, s);
    return g;
  }
  // Stacja kosmiczna (kształt umowny): kratownica, osiem skrzydeł baterii, moduły w poprzek, radiatory.
  function stacja(c, s) {
    var T = c.THREE, g = new T.Group();
    g.add(new T.Mesh(new T.BoxGeometry(1.25, 0.035, 0.035), matL(c, 'atrament-2')));
    [-0.56, -0.38, 0.38, 0.56].forEach(function (x) {
      [-1, 1].forEach(function (zn) {
        var p = new T.Mesh(new T.BoxGeometry(0.13, 0.006, 0.44), matL(c, 'zloto'));
        p.position.set(x, 0, zn * 0.25); g.add(p);
      });
    });
    var m1 = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.62, 14), matL(c, 'atrament', { emissive: c.kolor('linia') }));
    m1.rotation.x = Math.PI / 2; g.add(m1);
    var m2 = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.3, 14), matL(c, 'atrament', { emissive: c.kolor('linia') }));
    m2.rotation.z = Math.PI / 2; m2.position.set(0, 0, -0.2); g.add(m2);
    [-0.16, 0.16].forEach(function (x) {
      var r = new T.Mesh(new T.BoxGeometry(0.08, 0.004, 0.16), matL(c, 'atrament')); r.position.set(x, -0.06, 0); g.add(r);
    });
    var pw = poswiata(c, 'zar', 1.6, 0.25); g.add(pw); g.userData.blask = pw;
    g.scale.set(s || 1, s || 1, s || 1);
    return g;
  }
  // Mały zegar (tarcza + wskazówka) — obraca się w płaszczyźnie ekranu, gdy grupa jest skierowana ku kamerze.
  function zegar(c, kolor, r) {
    var T = c.THREE, g = new T.Group();
    g.add(new T.Mesh(new T.CircleGeometry(r, 40), przezr(c, 'granat-tlo', 0.85, { side: T.DoubleSide })));
    var obw = new T.Mesh(new T.RingGeometry(r * 0.92, r, 48), mat(c, kolor, { side: T.DoubleSide })); obw.position.z = 0.001; g.add(obw);
    for (var i = 0; i < 12; i++) {
      var k = new T.Mesh(new T.PlaneGeometry(r * 0.04, r * 0.16), mat(c, kolor, { side: T.DoubleSide }));
      var a = i / 12 * TAU; k.position.set(Math.sin(a) * r * 0.78, Math.cos(a) * r * 0.78, 0.002); k.rotation.z = -a; g.add(k);
    }
    var w = new T.Group(); w.position.z = 0.003;
    var ws = new T.Mesh(new T.PlaneGeometry(r * 0.06, r * 0.7), mat(c, kolor, { side: T.DoubleSide })); ws.position.y = r * 0.33; w.add(ws);
    g.add(w); g.userData.wskazowka = w;
    return g;
  }

  /* =====================================================================
     Zestawy wspólne dla wielu kroków
     ===================================================================== */
  var zestawy = {
    // Pole gwiazd z głębią (90–350 j.); `obroc` kręci całym niebem (karuzela, lot razem ze stacją).
    gwiazdy: function (c) {
      var T = c.THREE, los = c.generator(1957), n = 2400;
      var p = new Float32Array(n * 3), kol = new Float32Array(n * 3), roz = new Float32Array(n), faza = new Float32Array(n);
      var barwy = [c.kolor('atrament'), c.kolor('zar'), c.kolor('granat'), c.kolor('lak')];
      for (var i = 0; i < n; i++) {
        var u = los() * 2 - 1, a = los() * TAU, r = 90 + los() * 260, s = Math.sqrt(1 - u * u), w = los();
        p[i * 3] = r * s * Math.cos(a); p[i * 3 + 1] = r * u; p[i * 3 + 2] = r * s * Math.sin(a);
        var b = barwy[w < 0.68 ? 0 : (w < 0.86 ? 1 : (w < 0.97 ? 2 : 3))], j = 0.4 + 0.6 * los();
        kol[i * 3] = b.r * j; kol[i * 3 + 1] = b.g * j; kol[i * 3 + 2] = b.b * j;
        roz[i] = (1.4 + Math.pow(los(), 7) * 4.2) * (1 + (350 - r) / 350 * 0.6); faza[i] = los() * TAU;
      }
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('aKolor', new T.BufferAttribute(kol, 3));
      g.setAttribute('aRozmiar', new T.BufferAttribute(roz, 1)); g.setAttribute('aFaza', new T.BufferAttribute(faza, 1));
      var uni = { uCzas: { value: 0 }, uJasnosc: { value: 1 }, uPx: { value: 1 } };
      var m = new T.ShaderMaterial({ uniforms: uni, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: [
          'attribute vec3 aKolor; attribute float aRozmiar; attribute float aFaza;',
          'uniform float uCzas; uniform float uJasnosc; uniform float uPx;',
          'varying vec3 vKolor; varying float vA;',
          'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aRozmiar * uPx;',
          '  vKolor = aKolor; vA = uJasnosc * (0.72 + 0.28 * sin(uCzas * 1.1 + aFaza)); }'].join('\n'),
        fragmentShader: [
          'varying vec3 vKolor; varying float vA;',
          'void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vKolor * vA * smoothstep(0.5, 0.08, r), 1.0); }'].join('\n') });
      var pts = new T.Points(g, m); pts.frustumCulled = false;
      var gr = new T.Group(); gr.add(pts);
      return { grupa: gr,
        ustaw: function () { uni.uJasnosc.value = 1; gr.rotation.set(0, 0, 0); },
        jasnosc: function (x) { uni.uJasnosc.value = x; },
        obroc: function (x, y, z) { gr.rotation.set(x || 0, y || 0, z || 0); },
        animuj: function (t) { var rz = c.rozmiar(); uni.uCzas.value = t; uni.uPx.value = rz.dpr * rz.h / 536; } };
    },

    // Ziemia: kula z dniem i nocą (słońce = kierunek w świecie), siatka południków i równoleżników, chmury,
    // poświata atmosfery od strony słońca, opcjonalnie cylinder cienia i tarcza słońca. Rysunek umowny —
    // bez kontynentów, żeby nie udawać mapy. `glob` obraca się z Ziemią (do niego wpina się znaczniki na powierzchni).
    ziemia: function (c) {
      var T = c.THREE, zew = new T.Group(), g = new T.Group(), glob = new T.Group();
      zew.add(g); g.add(glob);
      var uni = { uSlonce: { value: new T.Vector3(1, 0, 0) }, uDzien: { value: c.kolor('granat') }, uNoc: { value: c.kolor('granat-tlo') },
        uSiatkaK: { value: c.kolor('granat') }, uZmierzch: { value: c.kolor('zloto') }, uSiatka: { value: 1 }, uChmury: { value: 1 }, uCzas: { value: 0 } };
      var mZ = new T.ShaderMaterial({ uniforms: uni, extensions: { derivatives: true },
        vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'uniform vec3 uSlonce; uniform vec3 uDzien; uniform vec3 uNoc; uniform vec3 uSiatkaK; uniform vec3 uZmierzch;',
          'uniform float uSiatka; uniform float uChmury; uniform float uCzas;',
          'varying vec3 vN; varying vec3 vP;',
          'float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
          'float szum(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);',
          '  return mix(mix(mix(h3(i), h3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h3(i + vec3(0.0, 1.0, 0.0)), h3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),',
          '             mix(mix(h3(i + vec3(0.0, 0.0, 1.0)), h3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h3(i + vec3(0.0, 1.0, 1.0)), h3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }',
          'float fbm(vec3 p){ float s = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ s += a * szum(p); p *= 2.03; a *= 0.5; } return s; }',
          'float kreska(float v, float krok){ float d = abs(fract(v / krok + 0.5) - 0.5) * krok; float w = fwidth(v) * 1.2; return 1.0 - smoothstep(w * 0.5, w * 1.6, d); }',
          'void main(){',
          '  vec3 n = normalize(vN); vec3 p = normalize(vP);',
          '  float d = dot(n, normalize(uSlonce));',
          '  float dzien = smoothstep(-0.06, 0.16, d);',
          '  float lat = asin(clamp(p.y, -1.0, 1.0)); float lon = atan(p.z, p.x);',
          '  float g = max(kreska(lat, 0.5235988), kreska(lon, 0.5235988));',
          '  float rown = 1.0 - smoothstep(0.0, fwidth(lat) * 2.0, abs(lat));',
          '  float morze = fbm(p * 3.0);',
          '  float chm = smoothstep(0.56, 0.8, fbm(p * 5.0 + vec3(uCzas * 0.004, 0.0, 0.0))) * uChmury;',
          '  vec3 dz = mix(uNoc * 1.6, uDzien, 0.55) * (0.32 + 0.38 * morze) * (0.28 + 0.72 * max(d, 0.0));',
          '  dz = mix(dz, vec3(0.82, 0.85, 0.9) * (0.2 + 0.6 * max(d, 0.0)), chm * 0.5);',
          '  vec3 nc = uNoc * (0.55 + 0.5 * morze) + vec3(0.01, 0.012, 0.02);',
          '  vec3 col = mix(nc, dz, dzien);',
          '  col += uZmierzch * exp(-pow(d / 0.07, 2.0)) * 0.3;',
          '  col = mix(col, uSiatkaK * mix(0.35, 0.7, dzien), clamp(g * 0.28 + rown * 0.45, 0.0, 1.0) * uSiatka);',
          '  gl_FragColor = vec4(col, 1.0);',
          '}'].join('\n') });
      glob.add(new T.Mesh(new T.SphereGeometry(1, 96, 64), mZ));
      var uniA = { uSlonce: uni.uSlonce, uKolor: { value: c.kolor('granat') }, uZmierzch: { value: c.kolor('zloto') }, uSila: { value: 1 } };
      var atm = new T.Mesh(new T.SphereGeometry(1.06, 64, 40), new T.ShaderMaterial({ uniforms: uniA, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: [
          'uniform vec3 uSlonce; uniform vec3 uKolor; uniform vec3 uZmierzch; uniform float uSila; varying vec3 vN; varying vec3 vW;',
          'void main(){ vec3 v = normalize(cameraPosition - vW); vec3 n = normalize(vN);',
          '  float f = 1.0 - max(dot(n, v), 0.0); float d = dot(n, normalize(uSlonce));',
          '  vec3 k = mix(uZmierzch, uKolor, smoothstep(-0.05, 0.4, d));',
          '  gl_FragColor = vec4(k * pow(f, 2.4) * (0.08 + 1.15 * smoothstep(-0.3, 0.35, d)) * uSila, 1.0); }'].join('\n') }));
      g.add(atm);
      // cień planety: walec za nocną stroną (przekrój = Ziemia), z kręgami, żeby czytał się jak bryła
      var cien = new T.Group();
      var walec = new T.Mesh(new T.CylinderGeometry(1, 1, 16, 48, 1, true), przezr(c, 'granat-tlo', 0.55, { side: T.DoubleSide }));
      walec.position.y = 8; cien.add(walec);
      [1.2, 3, 5.5, 9, 13].forEach(function (y) { var o = linia(c, punktyOrbity(T, 1.002, 0, 0, 96).map(function (q) { return new T.Vector3(q.x, y, q.z); }), 'granat', { krycie: 0.4 }); cien.add(o); });
      for (var tw = 0; tw < 12; tw++) { var at = tw / 12 * TAU; cien.add(linia(c, [new T.Vector3(Math.cos(at), 0, Math.sin(at)), new T.Vector3(Math.cos(at), 16, Math.sin(at))], 'granat', { krycie: 0.22 })); }
      g.add(cien);
      var slonceSp = poswiata(c, 'zar', 14, 0.95), sloncePosw = poswiata(c, 'zloto', 40, 0.35);
      var sloncePrz = new T.Group(); sloncePrz.add(sloncePosw); sloncePrz.add(slonceSp); zew.add(sloncePrz);
      var S = new T.Vector3(1, 0, 0), lok = new T.Vector3(), q = new T.Quaternion(), OSY = new T.Vector3(0, 1, 0);
      var obrot = 0, faza = 0, odlSlonca = 160;
      // ciągłość między krokami (logika.ciaglyKat/ciaglyKierunek): kąt globu i kierunek słońca bez przeskoku przy
      // zmianie kroku; `slonce()` ustawia CEL, a widoczny kierunek (cień, poświata, shader) liczy `animuj`
      var katStan = {}, slStan = {}, slCel = [1, 0.22, 0.32];
      function zastosujSlonce(d) {
        S.set(d[0], d[1], d[2]); uni.uSlonce.value.copy(S);
        lok.copy(S).applyQuaternion(q.copy(g.quaternion).invert()).negate();
        cien.quaternion.setFromUnitVectors(OSY, lok);
        sloncePrz.position.copy(S).multiplyScalar(odlSlonca).add(g.position);
      }
      var api = { grupa: zew, ziemia: g, glob: glob, R: 1, kat: 0,
        ustaw: function (o) {
          o = o || {};
          var r = o.r || 2; api.R = r; g.scale.set(r, r, r);
          var p = o.pozycja || [0, 0, 0]; g.position.set(p[0], p[1], p[2]);
          g.rotation.set(0, 0, 0);
          obrot = o.obrot == null ? 0.04 : o.obrot; faza = o.faza || 0; glob.rotation.set(0, faza, 0); api.kat = faza;
          cien.visible = !!o.cien;
          uni.uSiatka.value = o.siatka == null ? 1 : o.siatka;
          uni.uChmury.value = o.chmury == null ? 1 : o.chmury;
          atm.visible = o.atmosfera !== false;
          uniA.uSila.value = 0.55 * (typeof o.atmosfera === 'number' ? o.atmosfera : 1);
          sloncePrz.visible = !!o.slonceWidoczne; odlSlonca = o.odlSlonca || 160;
          api.slonce(o.slonce || [1, 0.22, 0.32]);
        },
        // kierunek słońca w świecie (cel; widoczny kierunek płynnie za nim — animuj); cień liczony w układzie grupy Ziemi
        slonce: function (s) { slCel = [s[0], s[1], s[2]]; },
        sila: function (x) { uniA.uSila.value = 0.55 * x; },
        animuj: function (t, dt) {
          api.kat = L.ciaglyKat(katStan, faza + obrot * t, dt); glob.rotation.y = api.kat; uni.uCzas.value = t;
          zastosujSlonce(L.ciaglyKierunek(slStan, slCel, dt));
        }
      };
      api.ustaw({});
      return api;
    },

    // Łąka po zachodzie słońca (perspektywa człowieka): kopuła nieba z poświatą zachodu (od +x), gwiazdy,
    // linia lasu i trawa jako sylwetki, satelita sunący po wielkim kole i gasnący w cieniu Ziemi, mrugający samolot.
    laka: function (c) {
      var T = c.THREE, g = new T.Group(), los = c.generator(1958);
      var uniN = { uHoryzont: { value: c.kolor('zloto') }, uLak: { value: c.kolor('lak') }, uZenit: { value: c.kolor('granat-tlo') }, uNoc: { value: c.kolor('pustka') } };
      g.add(new T.Mesh(new T.SphereGeometry(240, 48, 32), new T.ShaderMaterial({ uniforms: uniN, side: T.BackSide, depthWrite: false,
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'uniform vec3 uHoryzont; uniform vec3 uLak; uniform vec3 uZenit; uniform vec3 uNoc; varying vec3 vP;',
          'void main(){ vec3 d = normalize(vP); float e = max(d.y, 0.0);',
          '  float zach = pow(max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), vec3(1.0, 0.0, 0.0)), 0.0), 2.5);',
          '  vec3 k = mix(uZenit * 1.35, uNoc + uZenit * 0.25, smoothstep(0.05, 0.9, e));',
          '  k += uLak * zach * exp(-e * 9.0) * 0.55 + uHoryzont * zach * exp(-e * 22.0) * 0.6 + uZenit * exp(-e * 5.0) * 0.5;',
          '  gl_FragColor = vec4(k, 1.0); }'].join('\n') })));
      // gwiazdy nieba: tylko górna półkula, słabsze nad zachodem
      var n = 900, pp = new Float32Array(n * 3), kk = new Float32Array(n * 3), zar = c.kolor('atrament');
      for (var i = 0; i < n; i++) {
        var az = los() * TAU, el = Math.asin(0.06 + 0.94 * los()), d = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
        pp[i * 3] = d[0] * 228; pp[i * 3 + 1] = d[1] * 228; pp[i * 3 + 2] = d[2] * 228;
        var j = (0.25 + 0.75 * los()) * Math.min(1, (d[1] + 0.05) * 2.4) * (1 - 0.8 * Math.max(0, d[0]) * Math.exp(-d[1] * 3));
        kk[i * 3] = zar.r * j; kk[i * 3 + 1] = zar.g * j; kk[i * 3 + 2] = zar.b * j;
      }
      var gg = new T.BufferGeometry(); gg.setAttribute('position', new T.BufferAttribute(pp, 3)); gg.setAttribute('color', new T.BufferAttribute(kk, 3));
      var gw = new T.Points(gg, new T.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      gw.frustumCulled = false; g.add(gw);
      // ziemia i linia lasu (sylwetki)
      var grunt = new T.Mesh(new T.CircleGeometry(235, 64), mat(c, 'papier')); grunt.rotation.x = -Math.PI / 2; g.add(grunt);
      var NL = 360, las = [], idx = [];
      for (var k = 0; k <= NL; k++) {
        var a = k / NL * TAU, h = 4 + 5 * Math.pow(Math.abs(Math.sin(a * 3.1) * Math.sin(a * 7.7 + 1)), 0.6) + 2.2 * los() * (k % 2);
        las.push(150 * Math.cos(a), -0.5, 150 * Math.sin(a), 150 * Math.cos(a), h, 150 * Math.sin(a));
        if (k < NL) { var b = k * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      var gl = new T.BufferGeometry(); gl.setAttribute('position', new T.BufferAttribute(new Float32Array(las), 3)); gl.setIndex(idx);
      g.add(new T.Mesh(gl, mat(c, 'pustka', { side: T.DoubleSide })));
      // trawa: cienkie źdźbła przed człowiekiem (sylwetki), lekko kołysane w shaderze
      var NT = 1400, tr = new Float32Array(NT * 9), kol = new Float32Array(NT * 3);
      for (var s = 0; s < NT; s++) {
        var rr = 0.7 + Math.pow(los(), 0.7) * 9, aa = -Math.PI / 2 + (los() - 0.5) * 2.4, x0 = rr * Math.cos(aa), z0 = rr * Math.sin(aa);
        var hh = 0.25 + los() * 0.55, sz = 0.012 + los() * 0.02, nx = Math.cos(aa + Math.PI / 2) * sz, nz = Math.sin(aa + Math.PI / 2) * sz, pochyl = (los() - 0.5) * 0.25;
        tr.set([x0 - nx, 0, z0 - nz, x0 + nx, 0, z0 + nz, x0 + pochyl, hh, z0 + pochyl * 0.5], s * 9);
        kol[s * 3] = los();
      }
      var gt = new T.BufferGeometry(); gt.setAttribute('position', new T.BufferAttribute(tr, 3));
      var uniT = { uCzas: { value: 0 }, uKolor: { value: c.kolor('pustka') } };
      g.add(new T.Mesh(gt, new T.ShaderMaterial({ uniforms: uniT, side: T.DoubleSide,
        vertexShader: 'uniform float uCzas; void main(){ vec3 p = position; p.x += sin(uCzas * 1.3 + p.z * 0.9 + p.x * 0.4) * 0.05 * p.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
        fragmentShader: 'uniform vec3 uKolor; void main(){ gl_FragColor = vec4(uKolor + vec3(0.012, 0.014, 0.02), 1.0); }' })));
      // człowiek na łące (sylwetka, widoczna tylko w ujęciu zza ramienia)
      var czlowiek = new T.Group();
      var cialo = new T.Mesh(new T.CylinderGeometry(0.2, 0.15, 1.05, 16), mat(c, 'pustka')); cialo.position.y = 0.95; czlowiek.add(cialo);
      var barki = new T.Mesh(new T.SphereGeometry(0.21, 16, 10), mat(c, 'pustka')); barki.scale.set(1.15, 0.5, 0.8); barki.position.y = 1.44; czlowiek.add(barki);
      var glowa = new T.Mesh(new T.SphereGeometry(0.12, 16, 12), mat(c, 'pustka')); glowa.position.set(0, 1.66, -0.04); czlowiek.add(glowa);
      [-0.09, 0.09].forEach(function (x) { var n2 = new T.Mesh(new T.CylinderGeometry(0.07, 0.06, 0.5, 10), mat(c, 'pustka')); n2.position.set(x, 0.25, 0); czlowiek.add(n2); });
      g.add(czlowiek);
      // satelita: wielkie koło przez zachodni i wschodni horyzont, najwyżej 50° nad południem (−z)
      var R0 = 222, E1 = [1, 0, 0], E2 = [0, Math.sin(50 * Math.PI / 180), -Math.cos(50 * Math.PI / 180)];
      function naNiebie(fi, out) { out.set(R0 * (Math.cos(fi) * E1[0] + Math.sin(fi) * E2[0]), R0 * (Math.cos(fi) * E1[1] + Math.sin(fi) * E2[1]), R0 * (Math.cos(fi) * E1[2] + Math.sin(fi) * E2[2])); return out; }
      var sat = new T.Group(), rdzen = poswiata(c, 'zar', 3.2, 1), aura = poswiata(c, 'atrament', 9, 0.35);
      sat.add(aura); sat.add(rdzen); g.add(sat);
      // samolot: mruga czerwono-biało nisko nad wschodem
      var samolot = new T.Group(), swC = poswiata(c, 'lak', 3.5, 1), swB = poswiata(c, 'atrament', 2.8, 1);
      samolot.add(swC); swB.position.x = 0.9; samolot.add(swB); g.add(samolot);
      var api = { grupa: g, satelita: sat, samolot: samolot, czlowiek: czlowiek, NA_NIEBIE: naNiebie,
        ustaw: function (o) { czlowiek.visible = !!(o && o.czlowiek); },
        // satelita wschodzi i gaśnie raz, w chwilach zdarzeń kroku (`zd.wschod`, `zd.gasnie`; każdy krok łąki je ma — test)
        animuj: function (t, dt, zd) {
          uniT.uCzas.value = t;
          var s = przelotLaki(t, zd.wschod, zd.gasnie, LAKA.FI_WSCHOD);
          naNiebie(s.fi, sat.position);
          rdzen.material.opacity = s.jasnosc; aura.material.opacity = 0.35 * s.jasnosc;
          sat.visible = s.jasnosc > 0.01;
          var u = L.petla(t, 40);
          samolot.position.set(-60 + 120 * u, 14, -150 + 20 * u);
          var mr = L.petla(t, 1.1) < 0.18;
          swC.material.opacity = mr ? 1 : 0.08; swB.material.opacity = L.petla(t + 0.5, 1.1) < 0.12 ? 0.9 : 0.05;
        } };
      api.ustaw({});
      return api;
    },

    // Stacja kosmiczna na niskiej orbicie (schemat: rozmiar i wysokość wyolbrzymione) — kroki o swobodnym spadku.
    stacjaNaOrbicie: function (c) {
      var T = c.THREE, g = new T.Group(), R = 2.55;
      g.add(orbita(c, R, 'atrament-3', { krycie: 0.45 }));
      var st = stacja(c, 0.55); g.add(st);
      var stan = { predkosc: 0.09, faza: 1.15 }, katStan = {};
      var api = { grupa: g, stacja: st, R: R, kat: 0,
        ustaw: function (o) { o = o || {}; stan.predkosc = o.predkosc == null ? 0.09 : o.predkosc; stan.faza = o.faza == null ? 1.15 : o.faza; },
        animuj: function (t, dt) {
          var th = L.ciaglyKat(katStan, stan.faza + stan.predkosc * t, dt); api.kat = th;   // bez przeskoku przy zmianie kroku
          st.position.set(R * Math.cos(th), 0, -R * Math.sin(th));
          st.rotation.y = th;                                       // kratownica w poprzek kierunku lotu
        } };
      api.ustaw({});
      return api;
    },

    // Sputnik i pusty człon rakiety za nim (rozmiary umowne, odległość skrócona); sygnał na dwóch falach
    // jako kręgi rozchodzące się od kuli. Ziemia leży pod nimi (zestaw `ziemia` w kroku).
    sputnik: function (c) {
      var T = c.THREE, g = new T.Group();
      var kulaS = new T.Mesh(new T.SphereGeometry(0.29, 48, 32), metal(c, 'atrament', 0xffffff, { shininess: 120, transparent: true }));
      g.add(kulaS);
      var szew = new T.Mesh(new T.TorusGeometry(0.291, 0.006, 6, 64), mat(c, 'atrament-3')); szew.rotation.y = Math.PI / 2; g.add(szew);
      var blik = poswiata(c, 'zar', 0.16, 0.7); blik.position.set(0.12, 0.17, 0.2); g.add(blik);
      // cztery wąsy anten, odchylone do tyłu (lot ku −x)
      var wasy = new T.Group();
      [[0.32, 0.32], [-0.32, 0.32], [0.32, -0.32], [-0.32, -0.32]].forEach(function (k, i) {
        var dl = i < 2 ? 1.25 : 1.05;
        var kier = new T.Vector3(1, k[0], k[1]).normalize();
        var w = new T.Mesh(new T.CylinderGeometry(0.006, 0.004, dl, 6), mat(c, 'atrament-2'));
        w.position.copy(kier).multiplyScalar(0.28 + dl / 2); skieruj(T, w, kier); wasy.add(w);
      });
      g.add(wasy);
      // człon rakiety: długi, błyszczący, obraca się powoli
      var czlon = new T.Group(); czlon.position.set(-5.2, -0.5, -2.6);
      var kad = new T.Mesh(new T.CylinderGeometry(0.34, 0.36, 3.4, 32), metal(c, 'atrament-2', 0xdddddd, { shininess: 150 }));
      czlon.add(kad);
      var dysza = new T.Mesh(new T.ConeGeometry(0.3, 0.45, 20, 1, true), matL(c, 'atrament-3', { side: T.DoubleSide })); dysza.position.y = -1.9; czlon.add(dysza);
      var blysk = poswiata(c, 'zar', 2.6, 0); czlon.add(blysk);
      var obrot = new T.Group(); obrot.add(czlon); g.add(obrot);
      // kręgi sygnału: dwie fale, naprzemiennie (rytm „bip”)
      var kregi = [];
      for (var i = 0; i < SPUTNIK.KREGI; i++) { var o = obrecz(c, i % 2 ? 'zloto' : 'zar'); g.add(o); kregi.push(o); }
      var kam = new T.Vector3(), os = new T.Vector3(), doK = new T.Vector3(), wpo = new T.Vector3();
      var stan = { kregi: true, ostrosc: 1 };
      var api = { grupa: g, kula: kulaS, czlon: czlon, kregi: kregi,
        ustaw: function (o) { o = o || {}; stan.kregi = o.kregi !== false; stan.ostrosc = 1; kulaS.material.opacity = 1; blik.material.opacity = 0.7; },
        ostrosc: function (x) { stan.ostrosc = x; kulaS.material.opacity = 0.25 + 0.75 * x; blik.material.opacity = 0.7 * x; },
        animuj: function (t, dt, zd) {
          g.rotation.y = 0;
          czlon.rotation.set(t * 0.21, 0, Math.PI / 2 + 0.35 * Math.sin(t * 0.17));
          // błysk: gdy bok walca odbija słońce (z +x/+y) ku kamerze
          czlon.getWorldPosition(wpo); kam.copy(c.kamera.position).sub(wpo).normalize();
          os.set(0, 1, 0).applyQuaternion(czlon.quaternion);
          doK.set(0.7, 0.6, 0.4).normalize().add(kam).normalize();
          var odb = 1 - Math.abs(os.dot(doK));
          blysk.material.opacity = Math.pow(Math.max(0, odb), 18) * 1.0 + 0.12;
          var ts = zd && zd.sygnal;                          // krok 8 nie ma kotwicy: sygnał trwa od kroku 7
          for (var j = 0; j < kregi.length; j++) {
            var u = fazaKregu(t, j, ts);                      // −1: krąg jeszcze nie wypuszczony (przed „zaczęła piszczeć”)
            var s = 0.4 + Math.max(0, u) * 5.5; kregi[j].scale.set(s, s, 1);
            kregi[j].material.opacity = stan.kregi && u >= 0 ? 0.3 * (1 - u) * Math.min(1, u * 10) * stan.ostrosc : 0;
          }
        } };
      api.ustaw({});
      return api;
    },

    // Półka Clarke'a (schemat: promień pierścienia skrócony): pierścień nad równikiem, satelita, który
    // obraca się razem z Ziemią, talerz na ścianie sąsiada i łącze między nimi.
    polka: function (c) {
      var T = c.THREE, g = new T.Group(), RG = 6;
      var pierscien = orbita(c, RG, 'zloto', { krycie: 0.55, n: 240 }); g.add(pierscien);
      var sat = satelita(c, { skala: 1.3 }); g.add(sat);
      // talerz sąsiada: znacznik na powierzchni (szerokość umowna), z czaszą skierowaną na satelitę
      var talerz = new T.Group();
      var czasza = new T.Mesh(new T.SphereGeometry(0.11, 16, 8, 0, TAU, 0, Math.PI / 2.6), matL(c, 'atrament', { side: T.DoubleSide, emissive: c.kolor('linia') }));
      talerz.add(czasza); var pt = poswiata(c, 'zloto', 0.5, 0.8); talerz.add(pt);
      g.add(talerz);
      var lacze = linia(c, [new T.Vector3(), new T.Vector3(1, 0, 0)], 'zloto', { kreski: [0.12, 0.1], krycie: 0.85 });
      lacze.frustumCulled = false; g.add(lacze);
      var cmentarz = new T.Group();
      cmentarz.add(orbita(c, RG + 0.75, 'atrament-3', { krycie: 0.6, kreski: [0.18, 0.14], n: 240 }));
      var los = c.generator(1945), martwe = [];
      for (var i = 0; i < 26; i++) { var m = satelita(c, { skala: 0.55, kolor: 'atrament-3', panele: 'atrament-3', blask: false }); m.userData.fi = los() * TAU; m.userData.w = 0.004 + los() * 0.01; cmentarz.add(m); martwe.push(m); }
      g.add(cmentarz);
      var ZD = 2, LAT = 52 * Math.PI / 180;        // promień Ziemi w tej scenie i szerokość „sąsiada” (umowna)
      var A = new T.Vector3(), B = new T.Vector3(), N = new T.Vector3();
      var stan = { obrot: 0.1, faza: 0, cmentarz: false, lacze: true }, katStan = {};
      var api = { grupa: g, satelita: sat, talerz: talerz, R: RG, kat: 0,
        ustaw: function (o) {
          o = o || {}; stan.obrot = o.obrot == null ? 0.1 : o.obrot; stan.faza = o.faza || 0;
          stan.cmentarz = !!o.cmentarz; cmentarz.visible = stan.cmentarz; stan.lacze = o.lacze !== false;
          lacze.visible = stan.lacze; talerz.visible = stan.lacze; sat.visible = o.satelita !== false;
        },
        animuj: function (t, dt) {
          var th = L.ciaglyKat(katStan, stan.faza + stan.obrot * t, dt); api.kat = th;   // bez przeskoku przy zmianie kroku
          sat.position.set(RG * Math.cos(th), 0, -RG * Math.sin(th)); sat.rotation.y = th;
          // talerz na tej samej długości co satelita (obraca się razem z Ziemią)
          N.set(Math.cos(LAT) * Math.cos(th), Math.sin(LAT), -Math.cos(LAT) * Math.sin(th));
          A.copy(N).multiplyScalar(ZD * 1.005); talerz.position.copy(A);
          B.copy(sat.position).sub(A).normalize(); skieruj(T, czasza, B.clone().negate());
          var p = lacze.geometry.attributes.position; p.setXYZ(0, A.x, A.y, A.z); p.setXYZ(1, sat.position.x, sat.position.y, sat.position.z); p.needsUpdate = true;
          lacze.computeLineDistances();
          if (stan.cmentarz) for (var j = 0; j < martwe.length; j++) {
            var f = martwe[j].userData.fi + th * 0.9 + t * martwe[j].userData.w;   // na cmentarzysku dryfują wolniej niż Ziemia
            martwe[j].position.set((RG + 0.75) * Math.cos(f), 0, -(RG + 0.75) * Math.sin(f)); martwe[j].rotation.set(t * 0.1 + j, t * 0.07, 0);
          }
        } };
      api.ustaw({});
      return api;
    }
  };

  // Mała kula z dniem i nocą (słońce = kierunek w świecie ustawiany przez userData.slonce) — ryciny bez zestawu `ziemia`.
  function kulaDzienNoc(c, r, kolorD, kolorN) {
    var T = c.THREE;
    var uni = { uSlonce: { value: new T.Vector3(1, 0, 0) }, uD: { value: c.kolor(kolorD || 'granat') }, uN: { value: c.kolor(kolorN || 'granat-tlo') } };
    var k = new T.Mesh(new T.SphereGeometry(r, 36, 24), new T.ShaderMaterial({ uniforms: uni,
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uSlonce; uniform vec3 uD; uniform vec3 uN; varying vec3 vN; void main(){ float d = dot(normalize(vN), normalize(uSlonce)); gl_FragColor = vec4(mix(uN * 0.8, uD * (0.45 + 0.65 * max(d, 0.0)), smoothstep(-0.04, 0.06, d)), 1.0); }' }));
    k.userData.slonce = uni.uSlonce.value;
    return k;
  }
  // Znacznik na powierzchni (kropka + poświata).
  function znacznik(c, kolor, r) {
    var T = c.THREE, g = new T.Group();
    g.add(kula(c, r || 0.045, kolor)); g.add(poswiata(c, kolor, (r || 0.045) * 11, 0.9));
    return g;
  }
  function ustawLinie(l, a, b) {
    var p = l.geometry.attributes.position;
    p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true;
    if (l.material.isLineDashedMaterial) l.computeLineDistances();
  }
  function odcinekLinii(c, kolor, o) { var T = c.THREE, l = linia(c, [new T.Vector3(), new T.Vector3(0, 0, 1)], kolor, o); l.frustumCulled = false; return l; }

  // Zestaw: trzy rzuty Newtona z tej samej góry (tory liczone całkowaniem, μ = 1; góra i wysokość wyolbrzymione).
  zestawy.newton = function (c) {
    var T = c.THREE, g = new T.Group(), R = 2, H = 0.5, r0 = R + H + 0.06;
    var gora = new T.Mesh(new T.ConeGeometry(0.34, H + 0.08, 28), matL(c, 'linia', { emissive: c.kolor('papier') })); gora.position.y = R - 0.04 + (H + 0.08) / 2; g.add(gora);
    var snieg = new T.Mesh(new T.ConeGeometry(0.11, 0.17, 28), matL(c, 'atrament-2')); snieg.position.y = R + H + 0.04 - 0.085; g.add(snieg);
    var KOL = ['atrament-2', 'zloto', 'zar'], K = [0.62, 0.84, 1.0], CZAS = 9;   // CZAS: sekundy na pełne okrążenie (tempo umowne)
    var rzuty = K.map(function (k, i) {
      var w = rzutNewtona(r0, k, R, 2400), pts = [];
      for (var j = 0; j < w.punkty.length; j += 12) pts.push(new T.Vector3(w.punkty[j][0], w.punkty[j][1], 0));
      var ost = w.punkty[w.punkty.length - 1]; pts.push(new T.Vector3(ost[0], ost[1], 0));
      var krzywa = new T.CatmullRomCurve3(pts), odc = Math.max(8, pts.length);
      var tuba = new T.Mesh(new T.TubeGeometry(krzywa, odc, i === 2 ? 0.016 : 0.012, 6, false), mat(c, KOL[i], { transparent: true, opacity: 0.9 }));
      g.add(tuba);
      var koniec = new T.Object3D(); koniec.position.set(ost[0], ost[1], 0); g.add(koniec);
      return { krzywa: krzywa, tuba: tuba, n: tuba.geometry.index.count, czas: CZAS * (w.punkty.length - 1) / 2400, trafil: w.trafil, koniec: koniec };
    });
    var kamien = new T.Group(); kamien.add(kula(c, 0.035, 'zar')); kamien.add(poswiata(c, 'zar', 0.22, 0.8)); g.add(kamien);
    var napis3 = new T.Object3D(); napis3.position.copy(rzuty[2].krzywa.getPoint(0.62)); g.add(napis3);
    var stan = { tryb: 'dwa' }, tmp = new T.Vector3();
    function rysuj(i, u) { var r = rzuty[i]; r.tuba.visible = u > 0; r.tuba.geometry.setDrawRange(0, Math.floor(r.n * Math.min(1, u) / 6) * 6); }
    var api = { grupa: g, rzuty: rzuty, napis3: napis3, szczyt: snieg,
      ustaw: function (o) { stan.tryb = (o && o.tryb) || 'dwa'; },
      animuj: function (t) {
        var biezacy = -1, u = 0;
        if (stan.tryb === 'dwa') {
          var f = L.petla(t, 11) * 11, t1 = rzuty[0].czas, t2 = rzuty[1].czas;
          var u1 = L.odcinek(f, 0.6, 0.6 + t1), u2 = L.odcinek(f, 1.4 + t1, 1.4 + t1 + t2);
          rysuj(0, u1); rysuj(1, u2); rysuj(2, 0);
          if (u1 > 0 && u1 < 1) { biezacy = 0; u = u1; } else if (u2 > 0 && u2 < 1) { biezacy = 1; u = u2; }
        } else {
          rysuj(0, 1); rysuj(1, 1); rzuty[0].tuba.material.opacity = 0.45; rzuty[1].tuba.material.opacity = 0.55;
          var u3 = L.odcinek(L.petla(t, CZAS + 1.2) * (CZAS + 1.2), 0.3, 0.3 + CZAS);
          rysuj(2, u3 > 0 ? u3 : 1); biezacy = 2; u = u3;
        }
        if (stan.tryb === 'dwa') { rzuty[0].tuba.material.opacity = 0.9; rzuty[1].tuba.material.opacity = 0.9; }
        if (biezacy >= 0) rzuty[biezacy].krzywa.getPoint(Math.min(1, u), tmp); else tmp.set(0, r0, 0);
        kamien.position.copy(tmp);
      } };
    return api;
  };

  // Zestaw: satelity nawigacyjne (sześć płaszczyzn po cztery; liczby umowne) i telefon na powierzchni.
  zestawy.gps = function (c) {
    var T = c.THREE, g = new T.Group(), RN = 5.2, INC = 0.96, sats = [];
    for (var p = 0; p < 6; p++) {
      g.add(orbita(c, RN, 'granat', { inc: INC, om: p * TAU / 6, krycie: 0.18 }));
      for (var j = 0; j < 4; j++) {
        var s = satelita(c, { skala: 0.7, blask: 'granat', rozmiarBlasku: 1.2 });
        s.userData.th = j * TAU / 4 + p * 0.5; s.userData.om = p * TAU / 6; g.add(s); sats.push(s);
      }
    }
    var telK = new T.Vector3(0.15, 0.766, 0.625).normalize(), telefon = new T.Group();
    telefon.position.copy(telK).multiplyScalar(2.012);
    var ekran = new T.Mesh(new T.BoxGeometry(0.07, 0.012, 0.13), mat(c, 'zar')); telefon.add(ekran);
    telefon.add(poswiata(c, 'zar', 0.45, 0.9));
    telefon.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), telK);
    g.add(telefon);
    var stan = { obrot: 0.03 };
    function ustawSat(t) {
      for (var i = 0; i < sats.length; i++) { var q = naOrbicie(RN, sats[i].userData.th + stan.obrot * t, INC, sats[i].userData.om); sats[i].position.set(q[0], q[1], q[2]); sats[i].lookAt(0, 0, 0); }
    }
    ustawSat(0);
    // cztery „głosy”: satelity najwyżej nad horyzontem telefonu (w chwili 0)
    var tel = telefon.position.clone(), wybrane = sats.slice().sort(function (a, b) {
      return b.position.clone().sub(tel).normalize().dot(telK) - a.position.clone().sub(tel).normalize().dot(telK);
    }).slice(0, 4);
    var api = { grupa: g, glosy: wybrane, telefon: telefon, telK: telK,
      ustaw: function (o) { stan.obrot = (o && o.obrot != null) ? o.obrot : 0.03; },
      animuj: function (t) { ustawSat(t); } };
    return api;
  };

  /* =====================================================================
     Kroki
     ===================================================================== */
  var R1 = 'Po zachodzie słońca · Gwiazda, która idzie';
  var R2 = 'Mechanizm · Kamień, który nie trafia w ziemię';
  var R3 = '1957 · Pierwsza kula';
  var R4 = 'Piętra · Jak wysoko, tak szybko';
  var R5 = '160 do 2000 km · Parter: nisko, szybko, krótko';
  var R6 = 'około 20 000 km · Piętro środkowe: zegary';
  var R7 = '35 786 km · Półka Clarke\'a: satelita, który stoi';
  var R8 = '600 do 39 700 km · Orbita wydłużona: sposób na północ';
  var R9 = '600 do 800 km, nad biegunami · Orbita, która trzyma się słońca';
  var R10 = 'Granica · Gdzie kończy się Ziemia';
  var R11 = 'Po co · Jak dzielimy je po robocie';
  var R12 = 'Jak duże · Od autobusu do kostki';
  var R13 = 'Te, które umarły · Śmieci też krążą';
  var R14 = 'Dziś wieczorem · Spójrz w górę';

  var STREFA2 = [0, 0, 0, 2.08];      // kamera nie wchodzi w Ziemię o promieniu 2 (test toru)

  var kroki = [
    /* ---------- 1 ---------- */
    {
      czesc: R1, tytul: 'Gwiazda, która idzie',
      narracja: [
        'Stań na łące, kiedy słońce już zaszło, ale niebo jeszcze nie zgasło do końca. Zadrzyj głowę i poczekaj.',
        'Po kilku minutach jedna z gwiazd rusza. Nie mruga jak samolot, nie zostawia smugi jak meteor: idzie równo i spokojnie od jednego skraju nieba do drugiego.',
        'I nagle gaśnie w połowie drogi, jakby ktoś ją zdmuchnął. Zapamiętaj ten moment, bo w nim jest schowane wszystko.'
      ],
      podpis: 'Łąka po zachodzie słońca: satelita sunie i gaśnie. Kadr poglądowy, tempo przelotu przyspieszone; w naturze trwa to kilka minut.',
      scena: 'laka', strefa: null,
      ujecie: { ruch: 'tilt: z trawy w niebo, z perspektywy człowieka na łące', tor: [[0, 1.3, 0.5], [0, 1.48, 0.25], [0, 1.6, 0]], cel: [[0, 3, -60], [0, 22, -60], [0, 46, -56]], fov: 55, czas: 16, komp: [0, -0.04] }, tPogl: 15,
      zestawy: ['laka'],
      // satelita rusza pod „jedna z gwiazd rusza” i gaśnie pod „I nagle gaśnie”
      zdarzenia: { wschod: { wers: 2, po: 1.2 }, gasnie: { wers: 4, po: 1.0 } },
      dzwiek: { wiatr: 1 },
      zbuduj: function (c) {
        var l = c.zestaw('laka');
        return { etykiety: [{ tekst: 'satelita', cel: l.satelita, kotwica: 'prawo', klasa: 'zar', dx: 6 }, { tekst: 'samolot mruga', cel: l.samolot, kotwica: 'gora', klasa: 'm' }] };
      }
    },

    /* ---------- 2 ---------- */
    {
      czesc: R1, tytul: 'Dzień, którego ty już nie masz',
      narracja: [
        'Teraz pierwszy sekret: ty stoisz już w cieniu Ziemi i dla ciebie jest noc.',
        'On leci kilkaset kilometrów nad tobą, a tam słońce jeszcze świeci. Widzisz go tylko dlatego, że odbija dzień, którego ty już nie masz.',
        'Gaśnie w chwili, gdy sam wlatuje w cień planety. Przez te kilka minut patrzyłeś na coś, co było jeszcze w dniu, kiedy ty byłeś już w nocy. Działa ten obraz? Trzymaj go do samego końca.'
      ],
      podpis: 'Ty na nocnej stronie Ziemi, satelita jeszcze w słońcu. Schemat: wysokość orbity mocno wyolbrzymiona, nie w skali.',
      scena: 'cien',
      ujecie: { ruch: 'crane: dźwig znad łąki w górę, nad nocną stronę Ziemi', tor: [[-1.3, 1.2, 3.9], [-2.6, 4.6, 6.6], [-2.2, 9.2, 6.2]], cel: [[-0.8, 0.6, 1.8], [-1.4, 0.3, 0.9], [-2.4, 0, 0.3]], fov: [42, 40], czas: 16, komp: [0.08, 0] }, tPogl: 5.7,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, cien: true, obrot: 0, slonce: [1, 0, 0], slonceWidoczne: true, odlSlonca: 150, chmury: 0.6 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), R = 2, RO = 2.9, S = [1, 0, 0];
        var X = new T.Vector3(1, 0, 0), E2 = new T.Vector3(0, 0.32, 0.95).normalize(), thO = Math.acos(-0.2);
        var obsK = X.clone().multiplyScalar(Math.cos(thO)).addScaledVector(E2, Math.sin(thO));
        var pin = znacznik(c, 'zar', 0.04); pin.position.copy(obsK).multiplyScalar(R * 1.012); g.add(pin);
        var pts = []; for (var i = 0; i <= 180; i++) { var a = i / 180 * TAU; pts.push(X.clone().multiplyScalar(RO * Math.cos(a)).addScaledVector(E2, RO * Math.sin(a))); }
        g.add(linia(c, pts, 'atrament-3', { krycie: 0.45 }));
        var sat = satelita(c, { skala: 0.8 }); g.add(sat);
        var wzrok = odcinekLinii(c, 'zar', { kreski: [0.07, 0.06], krycie: 0.8 }); g.add(wzrok);
        var promien = odcinekLinii(c, 'zloto', { krycie: 0.7 }); g.add(promien);
        for (var k = 0; k < 4; k++) {           // równoległe promienie słońca padające na dzienną stronę
          var y = -1.3 + k * 0.85, zz = 0.4 - k * 0.3, xs = Math.sqrt(Math.max(0, R * R - y * y - zz * zz));
          g.add(linia(c, [new T.Vector3(9, y, zz), new T.Vector3(xs + 0.02, y, zz)], 'zloto', { krycie: 0.3, kreski: [0.2, 0.12] }));
        }
        var swiatlo = 1, B = new T.Vector3(), tmp = new T.Vector3();
        return { grupa: g,
          etykiety: [
            { tekst: 'ty, na łące: już noc', cel: pin, kotwica: 'dol', klasa: 'zar', dy: 10 },
            { tekst: function () { return swiatlo > 0.5 ? 'satelita: jeszcze w słońcu' : 'satelita w cieniu: zgasł'; }, cel: sat, kotwica: 'gora', klasa: 'w', dy: -14 },
            { tekst: 'cień Ziemi', poz: [-6.5, 0.4, 1.2], kotwica: 'srodek', klasa: 'granat' },
            { tekst: 'światło słońca', poz: [6, -1.3, 0.4], kotwica: 'gora', klasa: 'zloto' }
          ],
          krok: function (t) {
            var a = 0.9 + 3.2 * L.petla(t, 14);
            sat.position.copy(X).multiplyScalar(RO * Math.cos(a)).addScaledVector(E2, RO * Math.sin(a));
            sat.lookAt(0, 0, 0);
            var p = sat.position, d = p.x, prost = Math.sqrt(p.y * p.y + p.z * p.z);
            swiatlo = d >= 0 ? 1 : L.wygladz(L.odcinek(prost, R * 0.98, R * 1.08));
            if (wCieniu([p.x, p.y, p.z], S, R * 0.98)) swiatlo = 0;
            sat.userData.blask.material.opacity = 0.75 * swiatlo; sat.userData.blask.scale.setScalar(0.9 + 0.8 * swiatlo);
            tmp.copy(p).sub(pin.position);
            var nadHoryzontem = tmp.dot(obsK) > 0;
            wzrok.visible = nadHoryzontem && swiatlo > 0.02; wzrok.material.opacity = 0.85 * swiatlo;
            ustawLinie(wzrok, pin.position, p);
            promien.visible = swiatlo > 0.02; promien.material.opacity = 0.7 * swiatlo;
            B.copy(p); B.x += 9; ustawLinie(promien, B, p);
          } };
      },
    },

    /* ---------- 3 ---------- */
    {
      czesc: R2, tytul: 'Rzut z bardzo wysokiej góry',
      narracja: [
        'Weź kamień i rzuć go przed siebie: upadnie parę metrów dalej. Rzuć mocniej, upadnie dalej.',
        'Teraz stań na bardzo wysokiej górze, ponad powietrzem, z ręką tak silną, że kamień leci kilometr, dziesięć, sto.',
        'Zauważ, co się dzieje z ziemią pod nim. Ona się zakrzywia i ucieka w dół, bo planeta jest kulą.'
      ],
      podpis: 'Trzy rzuty z tej samej góry: dwa pierwsze kończą się na ziemi. Schemat: góra i jej wysokość wyolbrzymione, nie w skali; tory policzone z prawa grawitacji.',
      scena: 'newton',
      ujecie: { ruch: 'pov: z tej samej góry, kamera za ramieniem rzucającego, wzdłuż rzutu', tor: [[-1.6, 3.55, 1.1], [-1.45, 3.45, 0.95], [-1.3, 3.35, 0.85]], cel: [[1.4, 2.1, 0], [1.9, 1.7, 0], [2.3, 1.4, 0]], fov: 46, czas: 14, komp: [0.1, 0.05] }, tPogl: 7,
      zestawy: ['gwiazdy', 'ziemia', 'newton'],
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0, slonce: [0.5, 0.85, 0.6], siatka: 0.55 }); z.newton.ustaw({ tryb: 'dwa' }); },
      zbuduj: function (c) {
        var n = c.zestaw('newton');
        return { etykiety: [
          { tekst: 'za słabo', cel: n.rzuty[0].koniec, kotwica: 'dol', klasa: 'w', dy: 8 },
          { tekst: 'mocniej', cel: n.rzuty[1].koniec, kotwica: 'dol', klasa: 'zloto', dy: 8 },
          { tekst: 'bardzo wysoka góra, ponad powietrzem', cel: n.szczyt, kotwica: 'lewo', klasa: 'm', dx: -14 }
        ] };
      }
    },

    /* ---------- 4 ---------- */
    {
      czesc: R2, tytul: 'Spada i ciągle chybia',
      narracja: [
        'A teraz rzuć tak mocno, że kamień spada dokładnie tak szybko, jak ziemia ucieka mu spod spodu. Spada, ale nigdy nie trafia.',
        'Okrąża planetę i wraca ci do ręki od tyłu. To jest satelita: kamień, który spada i ciągle chybia.',
        'Ten obraz wymyślił Newton ponad trzysta lat temu, zanim ktokolwiek mógł sprawdzić, czy to prawda. Potrzebna prędkość to niecałe osiem kilometrów na sekundę: z Warszawy do Krakowa w pół minuty.'
      ],
      podpis: 'Trzy rzuty z tej samej góry. Trzeci nie kończy się wcale: kamień spada w tym samym tempie, w jakim powierzchnia ucieka mu spod spodu. Schemat, nie w skali.',
      scena: 'newton',
      ujecie: { ruch: 'crane: z tej samej góry w górę, aż widać całe okrążenie', tor: [[-1.3, 3.35, 0.85], [-1.8, 4.4, 3.8], [0, 3.0, 9.6]], cel: [[2.3, 1.4, 0], [0.9, 1.2, 0], [0, 0.1, 0]], fov: [46, 36], czas: 16, komp: [0, 0] }, tPogl: 5.3,
      zestawy: ['gwiazdy', 'ziemia', 'newton'],
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0, slonce: [0.5, 0.85, 0.6], siatka: 0.55 }); z.newton.ustaw({ tryb: 'trzy' }); },
      zbuduj: function (c) {
        var n = c.zestaw('newton');
        return { etykiety: [
          { tekst: 'za słabo', cel: n.rzuty[0].koniec, kotwica: 'dol', klasa: 'm', dy: 6 },
          { tekst: 'mocniej', cel: n.rzuty[1].koniec, kotwica: 'dol', klasa: 'zloto', dy: 6 },
          { tekst: '7,8 km/s: spada i nie trafia', cel: n.napis3, kotwica: 'prawo', klasa: 'zar', dx: 10 },
          { tekst: 'Ziemia', poz: [-0.8, -0.6, 1.9], kotwica: 'srodek', klasa: 'granat' }
        ] };
      }
    },

    /* ---------- 5 ---------- */
    {
      czesc: R2, tytul: 'Swobodny spadek, który trwa latami',
      narracja: [
        'Spójrz do środka stacji kosmicznej: ludzie unoszą się w powietrzu. Nie dlatego, że tam nie ma grawitacji.',
        'Jest, prawie taka jak tutaj. Oni po prostu cały czas spadają razem ze stacją.',
        'Przerywana kreska pokazuje, dokąd stacja poleciałaby bez grawitacji, a różnica między nią a torem to właśnie ten spadek. Swobodny spadek, który trwa latami.'
      ],
      podpis: 'Stacja kosmiczna i człowiek w niej spadają razem. Schemat: przekrój modułu powiększony, wysokość orbity wyolbrzymiona, nie w skali.',
      scena: 'stacja',
      ujecie: { ruch: 'dolly-in: najazd na przekrój stacji', tor: [[2.6, 2.1, -6.9], [1.9, 1.5, -5.7], [1.5, 1.2, -5.0]], cel: [[0.72, 0.3, -2.45], [0.55, 0.3, -2.48], [0.42, 0.3, -2.51]], fov: [36, 32], czas: 16, komp: [-0.1, 0] }, tPogl: 8,
      zestawy: ['gwiazdy', 'ziemia', 'stacjaNaOrbicie'],
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0.01, slonce: [0.4, 0.6, -0.7] }); z.stacjaNaOrbicie.ustaw({ predkosc: 0.0125, faza: 1.25 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), so = c.zestaw('stacjaNaOrbicie');
        var modul = new T.Group(); g.add(modul);
        var plaszcz = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.52, 28, 1, true), przezr(c, 'granat', 0.14, { side: T.DoubleSide }));
        plaszcz.rotation.z = Math.PI / 2; modul.add(plaszcz);
        [-0.26, 0, 0.26].forEach(function (x) { var o = new T.Mesh(new T.TorusGeometry(0.17, 0.004, 4, 40), mat(c, 'granat')); o.rotation.y = Math.PI / 2; o.position.x = x; modul.add(o); });
        var czl = new T.Group(); czl.scale.setScalar(1.5);
        var tul = new T.Mesh(new T.CylinderGeometry(0.022, 0.018, 0.09, 10), matL(c, 'atrament', { emissive: c.kolor('linia') })); czl.add(tul);
        var gl = kula(c, 0.019, 'atrament'); gl.position.y = 0.065; czl.add(gl);
        [-1, 1].forEach(function (zn) { var r = new T.Mesh(new T.CylinderGeometry(0.007, 0.007, 0.07, 6), matL(c, 'atrament')); r.position.set(zn * 0.03, 0.02, 0); r.rotation.z = zn * 0.9; czl.add(r); });
        [-1, 1].forEach(function (zn) { var n = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.08, 6), matL(c, 'atrament')); n.position.set(zn * 0.014, -0.075, 0); n.rotation.z = zn * 0.25; czl.add(n); });
        modul.add(czl);
        var grawS = strzalka(c, 'lak', 0.008, 0.05), grawC = strzalka(c, 'lak', 0.006, 0.04), pred = strzalka(c, 'zloto', 0.008, 0.06);
        g.add(grawS, grawC, pred);
        var prosto = odcinekLinii(c, 'atrament-2', { kreski: [0.06, 0.05], krycie: 0.8 }); g.add(prosto);
        var Sp = new T.Vector3(), rad = new T.Vector3(), styk = new T.Vector3(), Cw = new T.Vector3(), A = new T.Vector3();
        return { grupa: g,
          etykiety: [
            { tekst: 'przekrój modułu (powiększony)', cel: plaszcz, kotwica: 'gora', klasa: 'm', dy: -16 },
            { tekst: 'grawitacja: prawie taka jak tutaj', cel: grawS, kotwica: 'dol', klasa: 'lak', dy: 30 },
            { tekst: 'bez grawitacji: prosto', cel: prosto, kotwica: 'lewo', klasa: 'w', dx: -40, dy: -10 }
          ],
          krok: function (t) {
            var st = so.stacja; Sp.copy(st.position); rad.copy(Sp).normalize();
            styk.set(-Math.sin(so.kat), 0, -Math.cos(so.kat));
            modul.position.copy(Sp).addScaledVector(rad, 0.15).y += 0.55;
            modul.rotation.y = so.kat + Math.PI / 2;
            czl.position.set(0.03 * Math.sin(t * 0.7), 0.035 * Math.sin(t * 0.5 + 1), 0.03 * Math.cos(t * 0.6));
            czl.rotation.set(t * 0.17, t * 0.11, 0.4 + t * 0.07);
            grawS.userData.ustaw([Sp.x, Sp.y, Sp.z], [Sp.x - rad.x * 0.45, Sp.y - rad.y * 0.45, Sp.z - rad.z * 0.45]);
            czl.getWorldPosition(Cw);
            grawC.userData.ustaw([Cw.x, Cw.y, Cw.z], [Cw.x - rad.x * 0.3, Cw.y - rad.y * 0.3, Cw.z - rad.z * 0.3]);
            pred.userData.ustaw([Sp.x, Sp.y, Sp.z], [Sp.x + styk.x * 0.5, Sp.y, Sp.z + styk.z * 0.5]);
            A.copy(Sp).addScaledVector(styk, 2.6); ustawLinie(prosto, Sp, A);
          } };
      },
    },

    /* ---------- 6 ---------- */
    {
      czesc: R2, tytul: 'Niebo nie rozróżnia żywych od martwych',
      narracja: [
        'Jeszcze jedno, zanim ruszymy wyżej. Słowo „satelita” znaczy po prostu: coś, co krąży wokół czegoś większego.',
        'Księżyc to satelita naturalny. Wszystko, co sami wynieśliśmy na orbitę, to satelity sztuczne, także te, które dawno przestały odpowiadać, i zużyte człony rakiet.',
        'Niebo nie rozróżnia żywych od martwych. Krążą tak samo; zapamiętaj to zdanie.'
      ],
      podpis: 'Księżyc, satelity czynne i martwe oraz zużyty człon rakiety na swoich orbitach. Rysunek poglądowy: odległości skrócone, nie w skali.',
      scena: 'stacja',
      ujecie: { ruch: 'dolly-out: odjazd od stacji aż do Księżyca', tor: [[1.6, 1.0, -4.6], [4.5, 3.6, 3.5], [7.5, 6.2, 12.5]], cel: [[0.5, 0.1, -2.5], [-1.5, 0.6, -3.5], [-3.2, 1.2, -4.4]], fov: [34, 42], czas: 18, komp: [0, 0], tlo: [0.6, 1] }, tPogl: 9,
      zestawy: ['gwiazdy', 'ziemia', 'stacjaNaOrbicie'],
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0.02, slonce: [0.4, 0.6, -0.7] }); z.stacjaNaOrbicie.ustaw({ predkosc: 0.05, faza: 1.3 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), los = c.generator(1964);
        var ks = kulaDzienNoc(c, 0.55, 'atrament-2', 'linia'); ks.userData.slonce.set(0.4, 0.6, -0.7).normalize();
        ks.position.set(-9, 3.2, -10.5); g.add(ks);
        g.add(orbita(c, ks.position.length(), 'atrament-3', { inc: Math.atan2(3.2, 10.5), om: 0, krycie: 0.18, n: 240 }));
        var obiekty = [];
        function dodaj(o, r, inc, om, w) { o.userData = Object.assign(o.userData || {}, { r: r, inc: inc, om: om, th: los() * TAU, w: w }); g.add(o); g.add(orbita(c, r, o.userData.martwy ? 'atrament-3' : 'granat', { inc: inc, om: om, krycie: 0.16 })); obiekty.push(o); return o; }
        var zywy = dodaj(satelita(c, { skala: 0.5 }), 3.0, 0.5, 0.3, 0.16);
        dodaj(satelita(c, { skala: 0.45 }), 3.6, 1.2, 1.4, 0.12);
        dodaj(satelita(c, { skala: 0.45 }), 4.4, 0.1, 2.2, 0.09);
        var m1 = satelita(c, { skala: 0.5, kolor: 'atrament-3', panele: 'atrament-3', blask: false }); m1.userData.martwy = true;
        var martwy = dodaj(m1, 3.3, 0.9, 4.0, 0.14);
        var m2 = satelita(c, { skala: 0.4, kolor: 'atrament-3', panele: 'atrament-3', blask: false }); m2.userData.martwy = true; dodaj(m2, 4.0, 0.3, 5.1, 0.1);
        var czl = new T.Group(); czl.userData.martwy = true;
        var kad = new T.Mesh(new T.CylinderGeometry(0.11, 0.12, 0.9, 16), matL(c, 'atrament-2', { emissive: c.kolor('linia') })); czl.add(kad);
        var czlon = dodaj(czl, 3.8, 0.7, 3.2, 0.11);
        return { grupa: g,
          etykiety: [
            { tekst: 'Księżyc: satelita naturalny', cel: ks, kotwica: 'gora', klasa: 'w', dy: -10 },
            { tekst: 'czynny', cel: zywy, kotwica: 'prawo', klasa: 'zar', dx: 8 },
            { tekst: 'martwy: krąży tak samo', cel: martwy, kotwica: 'prawo', klasa: 'm', dx: 8 },
            { tekst: 'zużyty człon rakiety', cel: czlon, kotwica: 'lewo', klasa: 'm', dx: -8 }
          ],
          krok: function (t) {
            for (var i = 0; i < obiekty.length; i++) {
              var u = obiekty[i].userData, q = naOrbicie(u.r, u.th + u.w * t, u.inc, u.om);
              obiekty[i].position.set(q[0], q[1], q[2]);
              if (u.martwy) obiekty[i].rotation.set(t * 0.4 + i, t * 0.27, t * 0.13); else obiekty[i].lookAt(0, 0, 0);
            }
          } };
      },
    },

    /* ---------- 7 ---------- */
    {
      czesc: R3, tytul: 'Kula, która piszczy',
      narracja: [
        'Wyobraź sobie polerowaną kulę wielkości dużej piłki plażowej, z czterema długimi wąsami. W październiku 1957 roku poleciała w górę i zaczęła piszczeć.',
        'Nic więcej nie robiła. Nadawała na dwóch falach prosty sygnał, który radioamatorzy na całym świecie łapali w swoich kuchniach.',
        'To był Sputnik. Jego baterie starczyły na trzy tygodnie, a po trzech miesiącach spadł i spłonął w powietrzu.'
      ],
      podpis: 'Sputnik nad Ziemią, za nim pusty człon rakiety. Rysunek poglądowy: kręgi sygnału umowne, odległość między kulą a członem skrócona, nie w skali.',
      scena: 'sputnik', strefa: [0, -9.2, 0, 7.1],
      ujecie: { ruch: 'dolly-in: zbliżenie na polerowaną kulę Sputnika, za nią błyszczący człon rakiety', tor: [[4.4, 1.1, 5.2], [3.1, 0.75, 3.7], [2.3, 0.55, 2.75]], cel: [[-0.8, -0.15, -0.5], [-0.4, -0.08, -0.25], [-0.2, -0.04, -0.12]], fov: [32, 28], czas: 14, komp: [0.22, 0.04] }, tPogl: 14,
      zestawy: ['gwiazdy', 'ziemia', 'sputnik'],
      zdarzenia: { sygnal: { wers: 1, po: 3.2 } },     // kręgi i „bip” od „zaczęła piszczeć”
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 7, pozycja: [0, -9.2, 0], obrot: 0.012, slonce: [0.7, 0.6, 0.4], siatka: 0.35 }); z.sputnik.ustaw({ kregi: true }); },
      zbuduj: function (c) {
        var s = c.zestaw('sputnik');
        return { etykiety: [
          { tekst: 'Sputnik, październik 1957', cel: s.kula, kotwica: 'prawo', klasa: 'w', dx: 40, dy: -30 },
          { tekst: 'sygnał na dwóch falach', poz: [0.6, 0.9, 0.2], kotwica: 'prawo', klasa: 'zar' },
          { tekst: 'pusty człon rakiety', cel: s.czlon, kotwica: 'dol', klasa: 'm', dy: 24 }
        ], akcenty: function (tOd, tDo, zd) { return bipySputnika(tOd, tDo, zd && zd.sygnal); } };
      }
    },

    /* ---------- 8 ---------- */
    {
      czesc: R3, tytul: 'Co naprawdę widzieli ludzie',
      narracja: [
        'Teraz przenieś wzrok za kulę. Ludzie, którzy wtedy wychodzili wieczorem „zobaczyć Sputnika”, najczęściej widzieli nie ją, a sunący za nią pusty człon rakiety.',
        'Kula była za mała. Rakieta była długa jak kilka autobusów i błyszczała; patrz, jak łapie słońce, kiedy się obraca.'
      ],
      podpis: 'Sputnik i sunący za nim człon rakiety, który błyszczał na wieczornym niebie. Rysunek poglądowy: odległość skrócona, nie w skali.',
      scena: 'sputnik', strefa: [0, -9.2, 0, 7.1],
      ujecie: { ruch: 'rack-focus: ostrość przechodzi z kuli na błyszczący człon rakiety', tor: [[2.3, 0.55, 2.75], [2.0, 0.65, 3.0], [1.7, 0.75, 3.25]], cel: [[-0.2, -0.04, -0.12], [-2.6, -0.25, -1.3], [-5.2, -0.5, -2.6]], fov: [28, 22], czas: 14, komp: [[0.22, 0.04], [-0.05, 0]], tlo: [1, 0.55] }, tPogl: 9,
      zestawy: ['gwiazdy', 'ziemia', 'sputnik'],
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 7, pozycja: [0, -9.2, 0], obrot: 0.012, slonce: [0.7, 0.6, 0.4], siatka: 0.35 }); z.sputnik.ustaw({ kregi: true }); },
      zbuduj: function (c) {
        var s = c.zestaw('sputnik');
        return { etykiety: [{ tekst: 'to go widzieli ludzie: długi jak kilka autobusów', cel: s.czlon, kotwica: 'gora', klasa: 'zar', dy: -30 }],
          akcenty: function (tOd, tDo) { return bipySputnika(tOd, tDo, null); } };     // sygnał trwa od kroku 7
      },
      animuj: function (c, t, w, z) { z.sputnik.ostrosc(1 - 0.75 * L.wygladz(L.odcinek(t, 1.5, 7))); }
    },

    /* ---------- 9 ---------- */
    {
      czesc: R3, tytul: 'Najstarsza rzecz nad twoją głową',
      narracja: [
        'Pół roku później Amerykanie wysłali Vanguarda 1: kulkę wielkości grejpfruta, półtora kilograma. Zamilkł w 1964 roku.',
        'Ale on nadal tam jest. W tej chwili kręci się nad tobą najstarsza rzecz, jaką człowiek zostawił w kosmosie, i będzie się kręcić jeszcze długo po nas.'
      ],
      ramka: { typ: 'nota', etykieta: 'Granica wiedzy', tekst: 'Nikt nie wie dokładnie, jak długo jeszcze pokrąży.', punkty: [
        'Szacunki mówią o dziesiątkach, może setkach lat.',
        'Granica wiedzy przebiega tu przez gęstość powietrza na wysokości kilkuset kilometrów, a ta zmienia się z nastrojem Słońca.'
      ] },
      podpis: 'Vanguard 1 krąży w przyspieszonym upływie czasu, a powietrze oddycha z nastrojem Słońca. Rysunek poglądowy: rozmiar kulki i grubość powietrza wyolbrzymione, nie w skali.',
      scena: 'vanguard',
      ujecie: { ruch: 'orbita: kamera krąży, a lata mijają w przyspieszeniu', tor: [[-6.5, 2.4, 6.2], [0, 3.0, 8.6], [6.2, 3.5, 6.0]], cel: [0, 0.2, 0], fov: 36, czas: 20, komp: [0, 0] }, tPogl: 6,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0.3, slonce: [-0.55, 0.35, -0.75], slonceWidoczne: true, odlSlonca: 160 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), A = 3.3, E = 0.25, INC = 0.6;
        var v = new T.Group();
        v.add(new T.Mesh(new T.SphereGeometry(0.075, 24, 16), new T.MeshPhongMaterial({ color: c.kolor('atrament'), specular: 0xffffff, shininess: 80, emissive: c.kolor('linia') })));
        for (var i = 0; i < 6; i++) { var k = new T.Vector3(Math.cos(i * TAU / 6), (i % 2 ? 0.4 : -0.4), Math.sin(i * TAU / 6)).normalize(); var a = new T.Mesh(new T.CylinderGeometry(0.003, 0.003, 0.16, 4), mat(c, 'atrament-2')); a.position.copy(k).multiplyScalar(0.075 + 0.08); skieruj(T, a, k); v.add(a); }
        v.add(poswiata(c, 'zar', 0.55, 0.6)); g.add(v);
        function punkt(f, om) {
          var q = naElipsie(A, E, f), x = q[0], z0 = -q[1], si = Math.sin(INC), ci = Math.cos(INC), y = -z0 * si, z = z0 * ci, co = Math.cos(om), so = Math.sin(om);
          return new T.Vector3(x * co + z * so, y, -x * so + z * co);
        }
        var duchy = [];
        for (var d = 0; d < 7; d++) {
          var pts = []; for (var j = 0; j <= 160; j++) pts.push(punkt(j / 160, 0));
          var l = linia(c, pts, 'granat', { krycie: 0.4 }); g.add(l); duchy.push(l);
        }
        var stan = { om: 0 };
        return { grupa: g, v: v,
          etykiety: [{ tekst: 'Vanguard 1 · od 1958 · milczy od 1964, krąży nadal', cel: v, kotwica: 'prawo', klasa: 'w', dx: 10 },
            { tekst: 'powietrze gęstnieje i rzednie z nastrojem Słońca', poz: [-1.6, -2.15, 0.6], kotwica: 'dol', klasa: 'm', dy: 6 }],
          krok: function (t, z) {
            stan.om = t * 0.09;
            for (var d = 0; d < duchy.length; d++) { duchy[d].rotation.y = stan.om - d * 0.11; duchy[d].material.opacity = 0.42 * Math.pow(0.7, d); }
            v.position.copy(punkt(t / 2.6, 0)).applyAxisAngle(new T.Vector3(0, 1, 0), stan.om);
            z.ziemia.sila(0.75 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.55)));
          } };
      },
    },

    /* ---------- 10 ---------- */
    {
      czesc: R4, tytul: 'Dom o dziwnych piętrach',
      narracja: [
        'Teraz najważniejszy podział. Satelity dzieli się przede wszystkim po wysokości, bo wysokość rozstrzyga o wszystkim: jak szybko lecą, co widzą, jak długo żyją.',
        'Wyobraź sobie dom, w którym im wyżej mieszkasz, tym wolniej się poruszasz i tym dłużej trwa twoja doba. Brzmi na odwrót?',
        'Bliżej Ziemi grawitacja ciągnie mocniej, więc żeby ciągle chybiać, trzeba lecieć szybciej. Nisko: niecałe osiem kilometrów na sekundę i okrążenie w półtorej godziny; bardzo wysoko: trzy kilometry na sekundę i okrążenie w dobę.'
      ],
      podpis: 'Piętra orbit: im wyżej, tym wolniej. Schemat: odległości skrócone, tempo przyspieszone, nie w skali; długości strzałek pokazują tylko kolejność prędkości.',
      scena: 'pietra', strefa: [0, 0, 0, 1.5],
      ujecie: { ruch: 'crane: dźwig nad piętrami orbit', tor: [[1.5, 1.6, 13.5], [1, 6.5, 12.5], [0.5, 12.5, 9]], cel: [[-0.6, 0.6, -1.2], [-0.8, 0, -2.2], [-0.9, 0, -2.6]], fov: [40, 50], czas: 16, komp: [0, 0] }, tPogl: 6,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 1.4, obrot: 0.25, slonce: [1, 0.3, 0.4] }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group();
        var PIETRA = [
          { r: 1.9, kolor: 'zar', tekst: 'parter: niecałe osiem km/s,\nokrążenie w półtorej godziny' },
          { r: 3.4, kolor: 'granat', tekst: 'piętro środkowe:\ndwa okrążenia na dobę' },
          { r: 5.2, kolor: 'zloto', tekst: 'bardzo wysoko: trzy km/s,\nokrążenie w dobę' },
          { r: 9.6, kolor: 'atrament-2', tekst: 'Księżyc: ledwie kilometr na sekundę,\nmiesiąc na jedno kółko', ksiezyc: true }
        ];
        var W0 = 1.25, obiekty = [];
        PIETRA.forEach(function (p, i) {
          g.add(orbita(c, p.r, p.kolor, { krycie: p.ksiezyc ? 0.25 : 0.55, n: 200, kreski: p.ksiezyc ? [0.25, 0.2] : null }));
          if (!p.ksiezyc) { var pas = new T.Mesh(new T.RingGeometry(p.r - 0.12, p.r + 0.12, 128), przezr(c, p.kolor, 0.06, { side: T.DoubleSide })); pas.rotation.x = -Math.PI / 2; g.add(pas); }
          var o = p.ksiezyc ? kulaDzienNoc(c, 0.3, 'atrament-2', 'linia') : satelita(c, { skala: 0.6, blask: p.kolor });
          if (p.ksiezyc) o.userData.slonce.set(1, 0.3, 0.4).normalize();
          g.add(o);
          var s = strzalka(c, p.kolor, 0.012, 0.09); g.add(s);
          obiekty.push({ o: o, s: s, r: p.r, w: p.ksiezyc ? 0.006 : W0 * Math.pow(p.r / 1.9, -1.5), fi0: [-7.0, -0.73, -0.76, 1.9][i], dl: 1.25 * Math.pow(p.r / 1.9, -0.5) });
        });
        return { grupa: g, obiekty: obiekty,
          etykiety: PIETRA.map(function (p, i) { return { tekst: p.tekst, cel: obiekty[i].o, kotwica: i % 2 ? 'lewo' : 'prawo', klasa: p.ksiezyc ? 'm' : (i === 0 ? 'zar' : (i === 1 ? 'granat' : 'zloto')), dx: i % 2 ? -10 : 10 }; }),
          krok: function (t) {
            obiekty.forEach(function (b) {
              var fi = b.fi0 + b.w * t;
              b.o.position.set(b.r * Math.cos(fi), 0, -b.r * Math.sin(fi));
              var tx = -Math.sin(fi), tz = -Math.cos(fi), p = b.o.position;
              b.s.userData.ustaw([p.x, 0.02, p.z], [p.x + tx * b.dl, 0.02, p.z + tz * b.dl]);
            });
          } };
      },
    },

    /* ---------- 11 ---------- */
    {
      czesc: R4, tytul: 'Wszystko w jednej skali', wSkali: true,
      narracja: [
        'Przyjrzyj się teraz rysunkowi, w którym nic nie jest oszukane. Ziemia, a wokół niej wszystkie piętra w tej samej skali.',
        'Jasny pas przy kuli to cały zakres orbit niskich. Wyżej krążą zegary nawigacji, jeszcze wyżej duży pierścień, na którym satelity stoją.',
        'Wydłużona pętla to orbita Mołnija, a Księżyc byłby dziewięć razy dalej niż ten pierścień.'
      ],
      podpis: 'Wszystko w jednej skali. Jasny pas przy kuli to cały zakres orbit niskich, od 160 do 2000 km; stacja kosmiczna leci na jego dolnym brzegu. Cmentarzysko satelitów geostacjonarnych leży kilkaset kilometrów nad dużym pierścieniem, czyli w tej skali to ta sama kreska.',
      scena: 'skala', strefa: [0, 0, 0, 1.03],
      ujecie: { ruch: 'dolly-out: od kuli do całego układu pięter w jednej skali', tor: [[2.6, 1.6, 3.8], [4.8, 6.2, 9.5], [5.5, 12.5, 14.5]], cel: [[0, 0.2, 0], [0, 0.9, -0.5], [0, 1.4, -0.6]], fov: [38, 42], czas: 18, komp: [0, 0] }, tPogl: 12,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 1, obrot: 0.05, slonce: [1, 0.3, 0.6], atmosfera: false, siatka: 0.7 }); },
      zbuduj: function (c) { return zbudujSkale(c); },
    },

    /* ---------- 12 ---------- */
    {
      czesc: R4, tytul: 'Bliżej niż Gdańsk od Krakowa', wSkali: true,
      narracja: [
        'Podjedź teraz do samej kuli. Stacja kosmiczna krąży na wysokości czterystu kilometrów, a tutaj to grubość kreski nad powierzchnią.',
        'Kiedy mówimy „kosmos”, myślimy o czymś dalekim. Tymczasem ludzie w kosmosie są bliżej ciebie niż Gdańsk od Krakowa.',
        'Tyle że w górę.'
      ],
      podpis: 'Wszystko w jednej skali, z bliska: stacja kosmiczna na dolnym brzegu jasnego pasa orbit niskich, tuż nad powierzchnią.',
      scena: 'skala', strefa: [0, 0, 0, 1.03],
      ujecie: { ruch: 'dolly-in: najazd na brzeg Ziemi i kreskę stacji', tor: [[5.5, 9, 13], [1.2, 1.6, 5.2], [0.05, 0.22, 3.4]], cel: [[0, 1.2, -0.5], [0.85, 0.1, 0.4], [1.03, 0.02, 0.28]], fov: [42, 16], czas: 16, komp: [0, 0] }, tPogl: 12,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 1, obrot: 0.05, slonce: [1, 0.3, 0.6], atmosfera: false, siatka: 0.7 }); },
      zbuduj: function (c) { return zbudujSkale(c, true); },
    },

    /* ---------- 13 ---------- */
    {
      czesc: R5, tytul: 'Szesnaście wschodów słońca',
      narracja: [
        'Leć teraz razem ze stacją, ramię w ramię. Tu, na parterze, jest najtłoczniej: stacja kosmiczna, teleskop Hubble\'a, satelity robiące zdjęcia Ziemi, tysiące satelitów internetowych.',
        'Jedno okrążenie trwa około dziewięćdziesięciu minut. Patrz na brzeg Ziemi: astronauci widzą szesnaście wschodów słońca na dobę.',
        'Blisko, więc widać szczegóły, a sygnał dociera bez zwłoki.'
      ],
      podpis: 'Stacja kosmiczna nad Ziemią, kamera leci razem z nią, a Ziemia i słońce suną pod spodem. Rysunek poglądowy: tempo okrążenia przyspieszone, rozmiar stacji wyolbrzymiony, nie w skali.',
      scena: 'leo',
      ujecie: { ruch: 'travelling: kamera leci równo ze stacją, Ziemia i słońce suną pod nią', tor: [[-1.35, 2.62, 1.2], [-1.15, 2.66, 1.1], [-0.95, 2.7, 1.0]], cel: [[1.9, 1.15, -0.1], [2.0, 1.05, -0.1], [2.1, 0.95, -0.1]], fov: 54, czas: 16, komp: [0, 0.06] }, tPogl: 1.5,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0, slonce: [0.3, -1, 0.15], slonceWidoczne: true, odlSlonca: 150, atmosfera: 1.4 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group();
        var st = stacja(c, 0.5); st.position.set(0, 2.3, 0); st.rotation.y = Math.PI / 2; g.add(st);
        st.userData.blask.material.opacity = 0.15;
        var W = 0.785, S0 = new T.Vector3(0.3, -1, 0.15).normalize(), S = new T.Vector3(), OZ = new T.Vector3(0, 0, 1);
        return { grupa: g,
          etykiety: [
            { tekst: 'stacja kosmiczna: okrążenie trwa około dziewięćdziesięciu minut', cel: st, kotwica: 'gora', klasa: 'w', dy: -14 },
            { tekst: 'szesnaście wschodów słońca na dobę', poz: [2.6, 1.3, -0.1], kotwica: 'prawo', klasa: 'zloto', dx: 10 }
          ],
          krok: function (t, z) {
            var a = W * t;                                   // świat obraca się pod nieruchomą kamerą i stacją
            z.ziemia.ziemia.rotation.z = a;
            S.copy(S0).applyAxisAngle(OZ, a); z.ziemia.slonce([S.x, S.y, S.z]);
            z.gwiazdy.obroc(0, 0, a);
          } };
      },
    },

    /* ---------- 14 ---------- */
    {
      czesc: R5, tytul: 'Powietrze, które hamuje',
      narracja: [
        'Teraz cena, mniej oczywista. Nawet czterysta kilometrów nad ziemią jest jeszcze trochę powietrza, bardzo rzadkiego, ale satelita pędzi tak szybko, że i ono go hamuje.',
        'Stacja kosmiczna obniża się o około dwa kilometry na miesiąc i co jakiś czas trzeba ją podnieść silnikami. Satelita bez paliwa spada po kilku latach i spala się jak meteor; poniżej dwustu kilometrów powietrze zdejmuje go z nieba w ciągu dni.',
        'Dlatego to piętro samo się sprząta. Zapamiętaj to zdanie, wrócimy do niego przy śmieciach.'
      ],
      podpis: 'Hamowanie przez powietrze w przyspieszonym upływie czasu: stacja opada i jest podnoszona silnikami, satelita bez paliwa spiralą schodzi w dół. Schemat: tempo opadania i grubość powietrza wyolbrzymione, nie w skali.',
      scena: 'leo',
      ujecie: { ruch: 'timelapse: przyspieszony upływ czasu, kamera odjeżdża za opadającym satelitą', tor: [[-5.2, 5.6, 9.6], [-3.6, 4.4, 9.4], [-2.0, 3.4, 9.0]], cel: [[0.2, 0.5, 0], [0.4, 0.4, 0.3], [0.6, 0.3, 0.6]], fov: 36, czas: 18, komp: [0.08, 0] }, tPogl: 10.5,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0.12, slonce: [0.6, 0.5, 0.7], atmosfera: 1.9 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group();
        // stacja: piłokształtna wysokość (opada, podniesienie silnikami), tempo umowne
        var orb = orbita(c, 1, 'zar', { krycie: 0.5, n: 200 }); g.add(orb);
        var st = stacja(c, 0.45); g.add(st);
        var plomien = poswiata(c, 'lak', 0.6, 0); g.add(plomien);
        // satelita bez paliwa: spirala w dół i błysk meteoru
        var sat = satelita(c, { skala: 0.7 }); g.add(sat);
        var N = 90, sl = new Float32Array(N * 3), gs = new T.BufferGeometry(); gs.setAttribute('position', new T.BufferAttribute(sl, 3));
        var slad = new T.Line(gs, new T.LineBasicMaterial({ color: c.kolor('zloto'), transparent: true, opacity: 0.7 })); slad.frustumCulled = false; g.add(slad);
        var meteor = poswiata(c, 'lak', 0.9, 0), meteorR = poswiata(c, 'zar', 0.4, 0); g.add(meteor); g.add(meteorR);
        var z = c.doKamery(zegar(c, 'zloto', 0.32)); z.position.set(-2.3, 2.75, 1.2); g.add(z);
        var OKRES = 15, R_ST0 = 2.4, SPADEK = 0.08, CYKL = 5;
        function promienSat(f) { return 2.62 - 0.62 * Math.pow(f, 1.6); }
        function pozSat(tt, out) {
          var f = Math.min(1, tt / 12), r = promienSat(f), fi = 2.35 + 3.2 * tt * Math.pow(2.3 / Math.max(r, 2), 1.5) * 0.55;
          return out.set(r * Math.cos(fi), 0.35 * Math.sin(fi) * (r - 2), -r * Math.sin(fi));
        }
        var tmp = new T.Vector3();
        return { grupa: g,
          etykiety: [
            { tekst: 'stacja: około dwa kilometry w dół na miesiąc, potem silniki', cel: st, kotwica: 'prawo', klasa: 'zar', dx: 10 },
            { tekst: 'bez paliwa: po kilku latach spala się jak meteor', cel: sat, kotwica: 'lewo', klasa: 'zloto', dx: -10 },
            { tekst: 'czas przyspieszony', cel: z, kotwica: 'dol', klasa: 'm', dy: 8 }
          ],
          krok: function (t) {
            var fc = L.petla(t, CYKL), rst = R_ST0 - SPADEK * fc;
            orb.scale.set(rst, rst, rst);
            var fi = -13.275 + t * 1.15; st.position.set(rst * Math.cos(fi), 0, -rst * Math.sin(fi)); st.rotation.y = fi;
            plomien.position.copy(st.position); plomien.material.opacity = fc > 0.9 ? (fc - 0.9) * 10 : 0;
            var tt = L.petla(t, OKRES) * OKRES;
            pozSat(Math.min(tt, 12), sat.position); sat.visible = tt < 12; sat.lookAt(0, 0, 0);
            for (var i = 0; i < N; i++) { pozSat(Math.max(0, Math.min(tt, 12) - i * 0.06), tmp); sl[i * 3] = tmp.x; sl[i * 3 + 1] = tmp.y; sl[i * 3 + 2] = tmp.z; }
            gs.attributes.position.needsUpdate = true; slad.material.opacity = tt < 12 ? 0.7 : 0.7 * (1 - L.odcinek(tt, 12, 13.5));
            var m = L.odcinek(tt, 10.6, 12.6), zg = L.odcinek(tt, 12.6, 13.6);
            pozSat(Math.min(tt, 12), meteor.position); meteorR.position.copy(meteor.position);
            meteor.material.opacity = m * (1 - zg) * 0.95; meteorR.material.opacity = m * (1 - zg);
            meteor.scale.setScalar(0.5 + m * 1.2);
            z.userData.wskazowka.rotation.z = -t * 6;
          } };
      },
    },

    /* ---------- 15 ---------- */
    {
      czesc: R5, tytul: 'Rój zamiast jednego',
      narracja: [
        'Jeden satelita nisko widzi tylko kawałek Ziemi i znika za horyzontem po kilku minutach. Dlatego internet z niskiej orbity wymaga nie jednego satelity, a tysięcy.',
        'Kiedy jeden odchodzi, następny już wchodzi. Taki rój nazywa się konstelacją.',
        'Większość czynnych satelitów na niebie należy dziś do jednej takiej konstelacji, a ich liczba rośnie co miesiąc. Każda liczba, którą bym ci tu podał, zestarzałaby się, zanim ją przeczytasz.'
      ],
      podpis: 'Konstelacja w przyspieszonym upływie czasu: łącze przeskakuje z satelity na satelitę. Schemat: liczba satelitów i ich tory umowne, nie w skali.',
      scena: 'leo',
      ujecie: { ruch: 'timelapse: orbita nad rojem, łącze przeskakuje do następnego satelity', tor: [[-2.4, 3.4, 7.4], [0, 4.2, 7.6], [2.4, 4.6, 7.0]], cel: [0, 0.9, 0.3], fov: 38, czas: 18, komp: [0, 0] }, tPogl: 11,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0, slonce: [0.6, 0.6, 0.8] }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), NP = 24, NS = 30, RS = 2.3, INC = 0.92, W = 0.75, N = NP * NS;
        var uzK = new T.Vector3(0, Math.sin(0.87), Math.cos(0.87)), uz = uzK.clone().multiplyScalar(2.01);
        var pin = znacznik(c, 'zar', 0.04); pin.position.copy(uz); g.add(pin);
        var baza = [];
        for (var p = 0; p < NP; p++) for (var j = 0; j < NS; j++) baza.push({ om: p * TAU / NP, th: j * TAU / NS + p * 0.13 });
        function poz(b, t, out) { var q = naOrbicie(RS, b.th + W * t, INC, b.om); return out.set(q[0], q[1], q[2]); }
        // satelita, który pierwszy przelatuje nad człowiekiem, trafia na początek bufora (rysowany sam przed rojem)
        var tmp = new T.Vector3(), naj = 0, najE = -2;
        for (var i = 0; i < N; i++) { poz(baza[i], 0.3, tmp); var e = tmp.clone().sub(uz).normalize().dot(uzK); if (e > najE) { najE = e; naj = i; } }
        var pierwszy = baza.splice(naj, 1)[0]; baza.unshift(pierwszy);
        var pp = new Float32Array(N * 3), geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pp, 3));
        var roj = new T.Points(geo, new T.PointsMaterial({ color: c.kolor('zar'), size: 2.6, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending }));
        roj.frustumCulled = false; g.add(roj);
        var jeden = satelita(c, { skala: 0.4 }); g.add(jeden);
        var lacze = odcinekLinii(c, 'zloto', { krycie: 0.95 }); g.add(lacze);
        var stozek = new T.Mesh(new T.ConeGeometry(0.55, 1, 32, 1, true), przezr(c, 'zloto', 0.12, { side: T.DoubleSide })); g.add(stozek);
        var A = new T.Vector3(), OSY = new T.Vector3(0, 1, 0), kier = new T.Vector3();
        var OKRES = 16;
        return { grupa: g,
          etykiety: [
            { tekst: 'ty: łącze z najbliższym satelitą', cel: pin, kotwica: 'dol', klasa: 'zar', dy: 8 },
            { tekst: 'kiedy jeden odchodzi, następny już wchodzi', cel: jeden, kotwica: 'prawo', klasa: 'zloto', dx: 10 }
          ],
          krok: function (t) {
            var tt = L.petla(t, OKRES) * OKRES, ile = tt < 4 ? 1 : Math.max(1, Math.round(N * L.wygladz(L.odcinek(tt, 4, 9))));
            for (var i = 0; i < ile; i++) { poz(baza[i], t, tmp); pp[i * 3] = tmp.x; pp[i * 3 + 1] = tmp.y; pp[i * 3 + 2] = tmp.z; }
            geo.attributes.position.needsUpdate = true; geo.setDrawRange(0, ile);
            // najlepiej widoczny satelita (najwyżej nad horyzontem człowieka) spośród narysowanych
            var best = -1, bestE = 0.05;
            for (var k = 0; k < ile; k++) { A.set(pp[k * 3], pp[k * 3 + 1], pp[k * 3 + 2]).sub(uz); var e = A.normalize().dot(uzK); if (e > bestE) { bestE = e; best = k; } }
            if (best >= 0) {
              A.set(pp[best * 3], pp[best * 3 + 1], pp[best * 3 + 2]);
              jeden.visible = true; jeden.position.copy(A); jeden.lookAt(0, 0, 0);
              lacze.visible = true; ustawLinie(lacze, uz, A);
              var r = A.length(), d = r - 2;
              kier.copy(A).normalize(); stozek.visible = true;
              stozek.scale.set(1, d, 1); stozek.position.copy(kier).multiplyScalar(2 + d / 2); stozek.quaternion.setFromUnitVectors(OSY, kier);
            } else { jeden.visible = false; lacze.visible = false; stozek.visible = false; }
          } };
      },
    },

    /* ---------- 16 ---------- */
    {
      czesc: R6, tytul: 'Cztery głosy',
      narracja: [
        'Wyżej, na dwudziestu tysiącach kilometrów, krąży ponad sto satelitów kilku rodzin: amerykański GPS, europejski Galileo, rosyjski GLONASS, chiński BeiDou. Okrążają Ziemię mniej więcej dwa razy na dobę.',
        'Tu jest sekret: satelita nawigacyjny nie wie, gdzie jesteś, i niczego od ciebie nie odbiera. Ma na pokładzie zegar atomowy i bez przerwy powtarza w eter: „jest godzina taka a taka, a ja jestem tutaj”.',
        'Twój telefon słucha czterech takich głosów naraz i mierzy, o ile każdy się spóźnił. Spóźnienie to odległość, a z czterech odległości wychodzi punkt na mapie.'
      ],
      podpis: 'Cztery satelity nawigacyjne nadają w tej samej chwili, a ich głosy docierają do telefonu po kolei. Schemat: odległości skrócone, sygnał spowolniony, liczba satelitów umowna.',
      scena: 'gps',
      ujecie: { ruch: 'dolly-in: cztery głosy zbiegają się w punkcie telefonu', tor: [[5, 11, 17], [3.6, 8.8, 14.4], [2.6, 7.2, 12.6]], cel: [[0, 1.4, 0], [0.2, 1.4, 0.7], [0.3, 1.4, 1.0]], fov: [42, 38], czas: 16, komp: [0, 0] }, tPogl: 3.4,
      zestawy: ['gwiazdy', 'ziemia', 'gps'],
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0, slonce: [0.8, 0.5, 0.6] }); z.gps.ustaw({ obrot: 0 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), G = c.zestaw('gps'), tel = G.telefon.position;
        var uniF = { uKolor: { value: c.kolor('granat') }, uKrycie: { value: 0.5 } };
        var bance = G.glosy.map(function (s) {
          var m = new T.ShaderMaterial({ uniforms: { uKolor: uniF.uKolor, uKrycie: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
            vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
            fragmentShader: 'uniform vec3 uKolor; uniform float uKrycie; varying vec3 vN; varying vec3 vW; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW))); gl_FragColor = vec4(uKolor * pow(f, 3.0) * uKrycie, 1.0); }' });
          var b = new T.Mesh(new T.SphereGeometry(1, 48, 32), m); b.position.copy(s.position); g.add(b);
          var l = odcinekLinii(c, 'zar', { krycie: 0 }); ustawLinie(l, s.position, tel); g.add(l);
          var o = obrecz(c, 'zar'); o.position.copy(tel); g.add(o);
          return { b: b, l: l, o: o, d: s.position.distanceTo(tel), s: s };
        });
        var V = 1.15, T0 = 0.6, OKRES = 9;
        var punkt = poswiata(c, 'zar', 0.2, 0); punkt.position.copy(tel); g.add(punkt);
        return { grupa: g,
          etykiety: [
            { tekst: 'zegar atomowy: „jest godzina taka a taka,\na ja jestem tutaj”', cel: G.glosy[0], kotwica: 'prawo', klasa: 'granat', dx: 12 },
            { tekst: 'twój telefon', cel: G.telefon, kotwica: 'dol', klasa: 'zar', dy: 10 },
            { tekst: 'spóźnienie = odległość', cel: G.glosy[2], kotwica: 'lewo', klasa: 'w', dx: -12 },
            { tekst: 'GPS · Galileo · GLONASS · BeiDou', poz: [-5.2, 3.4, -1.5], kotwica: 'lewo', klasa: 'm' }
          ],
          krok: function (t) {
            var tt = L.petla(t, OKRES) * OKRES, dotarlo = 0;
            bance.forEach(function (x) {
              var r = Math.max(0.001, V * (tt - T0));
              var przed = r < x.d;
              x.b.visible = tt > T0 && przed; x.b.scale.setScalar(r);
              x.b.material.uniforms.uKrycie.value = 0.3 * (1 - L.odcinek(r / x.d, 0.85, 1));
              var po = tt - T0 - x.d / V;
              x.l.material.opacity = po > 0 ? 0.9 : 0.12;
              x.o.material.opacity = po > 0 ? Math.max(0, 1 - po / 0.9) : 0; x.o.scale.setScalar(0.15 + Math.max(0, po) * 0.6);
              if (po > 0) dotarlo++;
            });
            punkt.material.opacity = dotarlo === 4 ? 1 : dotarlo * 0.15; punkt.scale.setScalar(dotarlo === 4 ? 0.55 : 0.2);
          } };
      },
    },

    /* ---------- 17 ---------- */
    {
      czesc: R6, tytul: 'Einstein w twoim telefonie',
      narracja: [
        'I teraz ciarki. Te zegary w górze chodzą inaczej niż na dole: są dalej od masy Ziemi, więc czas płynie im odrobinę szybciej, a jednocześnie pędzą, więc trochę wolniej.',
        'Suma wychodzi na kilkadziesiąt milionowych części sekundy na dobę. Brzmi jak nic.',
        'Gdyby inżynierowie tego nie poprawili, błąd w mierzonych odległościach rósłby o około dziesięć kilometrów dziennie. Einstein siedzi w twoim telefonie i codziennie pracuje.'
      ],
      podpis: 'Zegar w górze i zegar na dole, a wokół telefonu krąg błędu, który rósłby bez poprawki. Schemat: różnica tempa zegarów ogromnie wyolbrzymiona, nie w skali.',
      scena: 'gps',
      ujecie: { ruch: 'dolly-out: od dwóch zegarów do rosnącego kręgu błędu', tor: [[1.4, 3.7, 5.6], [2.2, 4.6, 7.8], [3.0, 5.6, 10]], cel: [[0.6, 2.4, 0.6], [0.5, 2.0, 0.6], [0.4, 1.7, 0.6]], fov: [36, 40], czas: 16, komp: [0, 0] }, tPogl: 8,
      zestawy: ['gwiazdy', 'ziemia', 'gps'],
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0, slonce: [0.8, 0.5, 0.6] }); z.gps.ustaw({ obrot: 0 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), G = c.zestaw('gps'), tel = G.telefon.position, s = G.glosy[0];
        var zG = c.doKamery(zegar(c, 'granat', 0.42)), zD = c.doKamery(zegar(c, 'zar', 0.42));
        zG.position.copy(s.position).lerp(tel, 0.3).add(new T.Vector3(0, 0.5, 0)); zD.position.copy(tel).add(new T.Vector3(0.0, 0.75, 0.35));
        g.add(zG, zD);
        var l = linia(c, [s.position.clone(), zG.position.clone()], 'granat', { krycie: 0.4, kreski: [0.06, 0.06] }); g.add(l);
        var krag = new T.Mesh(new T.RingGeometry(0.96, 1, 64), przezr(c, 'lak', 0.85, { side: T.DoubleSide }));
        var plama = new T.Mesh(new T.CircleGeometry(1, 64), przezr(c, 'lak', 0.12, { side: T.DoubleSide }));
        var krg = new T.Group(); krg.add(krag); krg.add(plama);
        krg.position.copy(G.telK).multiplyScalar(2.006); krg.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), G.telK); g.add(krg);
        return { grupa: g,
          etykiety: [
            { tekst: 'w górze: dalej od masy Ziemi, szybciej;\npędzi, więc trochę wolniej', cel: zG, kotwica: 'prawo', klasa: 'granat', dx: 40 },
            { tekst: 'na dole: twój telefon', cel: zD, kotwica: 'lewo', klasa: 'zar', dx: -40 },
            { tekst: 'bez poprawki: błąd rośnie\no około dziesięć kilometrów dziennie', cel: krag, kotwica: 'dol', klasa: 'lak', dy: 30 }
          ],
          krok: function (t) {
            zD.userData.wskazowka.rotation.z = -t * 1.2;
            zG.userData.wskazowka.rotation.z = -t * 1.2 * 1.06;        // różnica tempa ogromnie wyolbrzymiona
            var r = 0.05 + 0.75 * L.odcinek(L.petla(t, 12), 0.05, 0.9); krg.scale.set(r, r, r);
          } };
      },
    },

    /* ---------- 18 ---------- */
    {
      czesc: R7, tytul: 'Karuzela',
      narracja: [
        'Wyobraź sobie satelitę, który stoi w miejscu: wieczorem jest tam, rano wciąż tam, za rok też. Dlatego talerz na ścianie twojego sąsiada od lat celuje w ten sam punkt nieba.',
        'Tylko że on wcale nie stoi, pędzi trzy kilometry na sekundę. Na wysokości trzydziestu pięciu tysięcy siedmiuset osiemdziesięciu sześciu kilometrów nad równikiem jedno okrążenie trwa dokładnie tyle, ile obrót Ziemi.',
        'Satelita i ty obracacie się razem, jak dwoje ludzi na tej samej karuzeli. Dla was reszta świata wiruje, a wy jesteście względem siebie nieruchomi.'
      ],
      podpis: 'Karuzela: satelita na półce Clarke\'a i talerz, który w niego celuje, są względem siebie nieruchomi, a gwiazdy i słońce wirują. Schemat: odległość skrócona, nie w skali.',
      scena: 'geo',
      ujecie: { ruch: 'dolly-zoom: kamera odjeżdża, kąt się zwęża, a satelita i Ziemia trzymają miejsce w kadrze', tor: [[5.7, 3.27, 6.98], [8.1, 5.75, 13.6], [10.5, 8.2, 20.3]], cel: [2.82, 0.3, -1.03], fov: 40, czas: 18, komp: [0, 0], dollyZoom: true }, tPogl: 7,
      zestawy: ['gwiazdy', 'ziemia', 'polka'],
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0, slonce: [1, 0.15, 0.2], chmury: 0.7 }); z.polka.ustaw({ obrot: 0, faza: 0.35 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), P = c.zestaw('polka');
        var pred = strzalka(c, 'zloto', 0.02, 0.18); g.add(pred);
        var grotO = new T.Object3D(); g.add(grotO);
        var S = new T.Vector3();
        return { grupa: g,
          etykiety: [
            { tekst: 'satelita na półce Clarke\'a', cel: P.satelita, kotwica: 'gora', klasa: 'w', dy: -16 },
            { tekst: 'pędzi trzy km/s', cel: grotO, kotwica: 'prawo', klasa: 'zloto', dx: 8 },
            { tekst: 'talerz sąsiada', cel: P.talerz, kotwica: 'lewo', klasa: 'zar', dx: -10 },
            { tekst: 'reszta świata wiruje', poz: [-30, 26, -70], kotwica: 'srodek', klasa: 'm' }
          ],
          krok: function (t, z) {
            var a = 0.32 * t;                                 // kamera kręci się razem z Ziemią: niebo i słońce wirują
            z.gwiazdy.obroc(0, -a, 0);
            S.set(Math.cos(-a), 0.15, -Math.sin(-a)); z.ziemia.slonce([S.x, S.y, S.z]);
            var p = P.satelita.position;
            pred.userData.ustaw([p.x, p.y, p.z], [p.x - Math.sin(0.35) * 1.3, p.y, p.z - Math.cos(0.35) * 1.3]);
            grotO.position.set(p.x - Math.sin(0.35) * 1.4, p.y, p.z - Math.cos(0.35) * 1.4);
          } };
      },
    },

    /* ---------- 19 ---------- */
    {
      czesc: R7, tytul: 'Pół sekundy ciszy',
      narracja: [
        'Ten pomysł opisał w 1945 roku Clarke, późniejszy autor „Odysei kosmicznej”, kiedy nie istniała jeszcze żadna rakieta zdolna tam dolecieć. Pierwszy satelita naprawdę tam zawisł niespełna dwadzieścia lat później.',
        'Mieszkają tam satelity telewizyjne i telekomunikacyjne, bo wygodnie nadawać z punktu, który nie ucieka, i pogodowe, które widzą całą tarczę Ziemi naraz.',
        'A cena? Odległość: sygnał leci stamtąd na dół około ósmą część sekundy, więc mówisz i dopiero po pół sekundy wraca odpowiedź. Dlatego internet satelitarny poszedł z powrotem na parter, gdzie ta zwłoka jest kilkadziesiąt razy mniejsza.'
      ],
      podpis: 'Pytanie leci w górę i w dół, odpowiedź wraca tą samą drogą; niżej ta sama rozmowa przez parter. Schemat: odległości skrócone, sygnał spowolniony, nie w skali.',
      scena: 'geo',
      ujecie: { ruch: 'crane: dźwig od nadajnika na Ziemi do półki Clarke\'a', tor: [[0.6, 1.9, 5.6], [3.0, 3.6, 9.8], [4.2, 5.6, 12.8]], cel: [[1.0, 1.3, 1.2], [2.3, 0.5, -0.4], [2.7, 0.2, -0.9]], fov: [38, 40], czas: 16, komp: [0, 0] }, tPogl: 3.2,
      zestawy: ['gwiazdy', 'ziemia', 'polka'],
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0, slonce: [0.7, 0.4, 0.6] }); z.polka.ustaw({ obrot: 0, faza: 0.35, lacze: false }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), P = c.zestaw('polka'), S = P.satelita.position.clone();
        function naZiemi(lat, lon) { return new T.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)).multiplyScalar(2.012); }
        var A = naZiemi(0.85, 0.35 - 0.55), B = naZiemi(-0.25, 0.35 + 0.7);
        var pa = znacznik(c, 'zar', 0.04), pb = znacznik(c, 'zar', 0.04); pa.position.copy(A); pb.position.copy(B); g.add(pa, pb);
        g.add(linia(c, [A, S, B], 'zloto', { krycie: 0.35, kreski: [0.1, 0.08] }));
        // przez parter: krótka droga przez niskiego satelitę
        var Lp = A.clone().add(B).normalize().multiplyScalar(2.42);
        var nis = satelita(c, { skala: 0.35, blask: 'granat' }); nis.position.copy(Lp); g.add(nis);
        g.add(linia(c, [A, Lp, B], 'granat', { krycie: 0.5 }));
        var imp = poswiata(c, 'zar', 0.5, 1), impL = poswiata(c, 'granat', 0.35, 1); g.add(imp, impL);
        // inni lokatorzy półki: telewizja, pogodowy z widokiem na całą tarczę
        var tv = satelita(c, { skala: 1.1 }); tv.position.set(6 * Math.cos(1.25), 0, -6 * Math.sin(1.25)); tv.lookAt(0, 0, 0); g.add(tv);
        var pog = satelita(c, { skala: 1.1, blask: 'granat' }); pog.position.set(6 * Math.cos(-0.65), 0, -6 * Math.sin(-0.65)); pog.lookAt(0, 0, 0); g.add(pog);
        var st = new T.Mesh(new T.ConeGeometry(1.95, 5.65, 40, 1, true), przezr(c, 'granat', 0.06, { side: T.DoubleSide }));
        var kp = pog.position.clone().normalize(); st.position.copy(kp).multiplyScalar(6 - 5.65 / 2 - 0.15); st.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), kp.clone().negate()); g.add(st);
        var lw = new T.Object3D(); lw.position.set(6 * Math.cos(2.75), 0, -6 * Math.sin(2.75)); g.add(lw);
        var OKRES = 7.2, ODC = 1.4, tmp = new T.Vector3(), faza = 'pytanie';
        return { grupa: g,
          etykiety: [
            { tekst: function () { return faza; }, cel: imp, kotwica: 'prawo', klasa: 'zar', dx: 10 },
            { tekst: 'w dół leci około ósmą część sekundy', cel: P.satelita, kotwica: 'prawo', klasa: 'zloto', dx: 14 },
            { tekst: 'parter: zwłoka kilkadziesiąt razy mniejsza', cel: nis, kotwica: 'prawo', klasa: 'granat', dx: 12, dy: -10 },
            { tekst: 'telewizja i telefon', cel: tv, kotwica: 'gora', klasa: 'w', dy: -10 },
            { tekst: 'pogodowy: cała tarcza Ziemi naraz', cel: pog, kotwica: 'prawo', klasa: 'granat', dx: 10 },
            { tekst: 'Arthur C. Clarke, 1945: półka nad równikiem', cel: lw, kotwica: 'gora', klasa: 'm', dy: -8 }
          ],
          krok: function (t) {
            var tt = L.petla(t, OKRES) * OKRES, k = Math.floor(tt / ODC), u = (tt % ODC) / ODC;
            var drogi = [[A, S], [S, B], [B, S], [S, A]];
            if (k < 4) { tmp.copy(drogi[k][0]).lerp(drogi[k][1], u); imp.position.copy(tmp); imp.visible = true; faza = k < 2 ? 'pytanie' : 'odpowiedź po pół sekundy'; }
            else { imp.visible = false; faza = 'cisza'; }
            // ta sama rozmowa przez parter: tempo umowne, artykuł mówi tylko „kilkadziesiąt razy mniejsza zwłoka”
            var ul = L.petla(tt, 0.9), kk = Math.floor(ul * 4), uu = ul * 4 - kk;
            var dl = [[A, Lp], [Lp, B], [B, Lp], [Lp, A]][kk]; impL.position.copy(dl[0]).lerp(dl[1], uu);
          } };
      },
    },

    /* ---------- 20 ---------- */
    {
      czesc: R7, tytul: 'Jedyny parking na całą planetę',
      narracja: [
        'Spójrz z góry na ten pierścień. Takie miejsce jest tylko jedno: wąski pierścień nad równikiem.',
        'Każdy satelita stojący w tym pierścieniu zajmuje kawałek, a kawałków jest skończenie wiele. Miejsca przydziela międzynarodowy urząd, a państwa spierają się o nie jak o działki.',
        'To jedyny parking na świecie, który obejmuje całą planetę i nie da się go powiększyć.'
      ],
      podpis: 'Pierścień półki Clarke\'a podzielony na miejsca. Schemat: odstępy i liczba miejsc umowne, nie w skali.',
      scena: 'geo',
      ujecie: { ruch: 'orbita: kamera krąży nad pierścieniem', tor: [[-8.5, 8.5, 8], [0, 10.5, 11.5], [8.5, 9, 8]], cel: [0, -0.4, 0], fov: 44, czas: 20, komp: [0, 0] }, tPogl: 6,
      zestawy: ['gwiazdy', 'ziemia', 'polka'],
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0.08, slonce: [0.7, 0.4, 0.6] }); z.polka.ustaw({ obrot: 0.08, faza: 0.35 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), obr = new T.Group(), los = c.generator(1972), NM = 72;
        for (var i = 0; i < NM; i++) {
          var fi = i / NM * TAU, kr = new T.Mesh(new T.BoxGeometry(0.05, 0.02, 0.3), mat(c, 'atrament-3'));
          kr.position.set(6 * Math.cos(fi + Math.PI / NM), 0, -6 * Math.sin(fi + Math.PI / NM)); kr.rotation.y = fi + Math.PI / NM; obr.add(kr);
          if (i !== 0 && los() < 0.72) { var s = satelita(c, { skala: 0.55, blask: los() < 0.5 ? 'zar' : 'zloto', rozmiarBlasku: 0.7 }); s.position.set(6 * Math.cos(fi), 0, -6 * Math.sin(fi)); s.lookAt(0, 0, 0); obr.add(s); }
        }
        var wolne = new T.Object3D(); wolne.position.set(6 * Math.cos(TAU * 5 / NM), 0, -6 * Math.sin(TAU * 5 / NM)); obr.add(wolne);
        g.add(obr);
        var P = c.zestaw('polka');   // slot 0 (pominięty w pętli) jedzie razem z P.satelita
        return { grupa: g,
          etykiety: [
            { tekst: 'miejsca przydziela międzynarodowy urząd', cel: P.satelita, kotwica: 'prawo', klasa: 'zloto', dx: 12 },
            { tekst: 'jedyny parking obejmujący całą planetę', poz: [0, 0, 6.8], kotwica: 'dol', klasa: 'w', dy: 10 }
          ],
          krok: function () { obr.rotation.y = P.kat; } };
      },
    },

    /* ---------- 21 ---------- */
    {
      czesc: R8, tytul: 'Za lasem, za górami',
      narracja: [
        'Teraz zagadka, którą rozwiązali inżynierowie radzieccy w latach sześćdziesiątych. Półka Clarke\'a wisi nad równikiem.',
        'Jeśli mieszkasz w Moskwie, a tym bardziej na Syberii, taki satelita stoi dla ciebie nisko nad południowym horyzontem, za lasem, za górami, prawie w ziemi. Nad biegunem nie widać go wcale.',
        'Co zrobić?'
      ],
      podpis: 'Linia wzroku z Moskwy i z bieguna do satelity na półce Clarke\'a. Schemat: odległości skrócone, nie w skali.',
      scena: 'polnoc',
      ujecie: { ruch: 'orbita: kamera obchodzi Ziemię od równika ku biegunowi', tor: [[8.5, 1.6, 6.5], [5.5, 5.5, 8.5], [2, 8.5, 8.5]], cel: [[2.2, 0.9, 0], [1.8, 1.3, 0], [1.4, 1.6, 0]], fov: 38, czas: 18, komp: [0, 0] }, tPogl: 5,
      zestawy: ['gwiazdy', 'ziemia', 'polka'],
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0, slonce: [0.6, 0.5, 0.7] }); z.polka.ustaw({ obrot: 0, faza: 0, lacze: false }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), S = new T.Vector3(6, 0, 0), LAT = 56 * Math.PI / 180;
        function horyzont(nK, kolor) {
          var h = new T.Group(), d = new T.Mesh(new T.CircleGeometry(0.85, 48), przezr(c, kolor, 0.16, { side: T.DoubleSide }));
          h.add(d); h.add(linia(c, punktyOrbity(T, 0.85, 0, 0, 64).map(function (p) { return new T.Vector3(p.x, -p.z, 0); }), kolor, { krycie: 0.5 }));
          h.position.copy(nK).multiplyScalar(2.01); h.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), nK);
          return h;
        }
        var mK = new T.Vector3(Math.cos(LAT), Math.sin(LAT), 0), bK = new T.Vector3(0, 1, 0);
        var moskwa = znacznik(c, 'zar', 0.045); moskwa.position.copy(mK).multiplyScalar(2.02); g.add(moskwa);
        var biegun = znacznik(c, 'granat', 0.045); biegun.position.copy(bK).multiplyScalar(2.02); g.add(biegun);
        var hm = horyzont(mK, 'zloto'), hb = horyzont(bK, 'granat'); g.add(hm, hb);
        // las i góry na południowym skraju horyzontu Moskwy (sylwetki umowne)
        var poludnie = new T.Vector3(Math.sin(LAT), -Math.cos(LAT), 0);
        for (var i = 0; i < 7; i++) {
          var dr = new T.Mesh(new T.ConeGeometry(0.05 + (i % 3) * 0.02, 0.14 + (i % 2) * 0.1, 8), mat(c, 'linia'));
          var bok = new T.Vector3(0, 0, (i - 3) * 0.12);
          dr.position.copy(mK).multiplyScalar(2.01).addScaledVector(poludnie, 0.62 + (i % 2) * 0.12).add(bok).addScaledVector(mK, 0.06);
          dr.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), mK); g.add(dr);
        }
        g.add(linia(c, [moskwa.position.clone(), S], 'zloto', { kreski: [0.12, 0.08], krycie: 0.9 }));
        g.add(linia(c, [biegun.position.clone(), S], 'lak', { kreski: [0.08, 0.1], krycie: 0.6 }));
        var srodek = biegun.position.clone().lerp(S, 0.35);
        var opis = new T.Object3D(); opis.position.copy(srodek); g.add(opis);
        return { grupa: g,
          etykiety: [
            { tekst: 'Moskwa: satelita nisko nad południem, za lasem', cel: moskwa, kotwica: 'prawo', klasa: 'zar', dx: 16, dy: -10 },
            { tekst: 'biegun: satelita pod horyzontem', cel: biegun, kotwica: 'lewo', klasa: 'granat', dx: -12 },
            { tekst: 'półka Clarke\'a nad równikiem', cel: c.zestaw('polka').satelita, kotwica: 'dol', klasa: 'zloto', dy: 12 },
            { tekst: 'linia wzroku przechodzi przez Ziemię', cel: opis, kotwica: 'gora', klasa: 'lak', dy: -6 }
          ] };
      }
    },

    /* ---------- 22 ---------- */
    {
      czesc: R8, tytul: 'Jajo i huśtawka',
      narracja: [
        'Wyobraź sobie orbitę jak mocno wydłużone jajo: jeden koniec tuż nad Ziemią po stronie południowej, drugi daleko, czterdzieści tysięcy kilometrów nad północą. Widzisz to jajo?',
        'Tuż nad Ziemią satelita gna jak szalony, a wysoko nad północą zwalnia prawie do zatrzymania. Zwisa nad Rosją przez osiem godzin z dwunastu, jak huśtawka, która na końcu wychylenia na chwilę staje.',
        'To prawo odkrył Kepler: im dalej od tego, co cię trzyma, tym wolniej idziesz. Radzieccy inżynierowie zrobili z niego radio: trzy, cztery takie satelity zmieniają się na posterunku nad północą, a nazwali je Mołnija, błyskawica.'
      ],
      ramka: { typ: 'info', etykieta: 'Fortel', tekst: 'Przy jednym kącie nachylenia, trochę powyżej sześćdziesięciu trzech stopni, obracanie się tej orbity ustaje i daleki koniec zostaje nad północą na lata.', punkty: [
        'Ten kąt wynika z tego, że Ziemia nie jest idealną kulą, a ten sam defekt daje nam jeszcze jedno piętro.'
      ] },
      podpis: 'Orbita Mołnija: trzy satelity na wydłużonej orbicie, jasny łuk to osiem godzin z dwunastu nad północą. Schemat: ruch zgodny z prawem Keplera, odległości skrócone, nie w skali.',
      scena: 'molnija',
      ujecie: { ruch: 'orbita: kamera obchodzi jajo, czas przyspieszony', tor: [[-6, 8.5, 12.5], [0, 10.4, 13.6], [6, 9.2, 12.4]], cel: [0, 2.6, -1.2], fov: 44, czas: 20, komp: [0, 0] }, tPogl: 4,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0, slonce: [0.6, 0.5, 0.8] }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), RP = MOLNIJA.RP, RA = MOLNIJA.RA, A = (RP + RA) / 2, E = (RA - RP) / (RA + RP), INC = 63.5 * Math.PI / 180, B = A * Math.sqrt(1 - E * E);
        var N = new T.Vector3(0, Math.sin(INC), -Math.cos(INC)), P = N.clone().negate(), Q = new T.Vector3(1, 0, 0);
        function punktE(Ea) { return P.clone().multiplyScalar(A * (Math.cos(Ea) - E)).addScaledVector(Q, B * Math.sin(Ea)); }
        function punktF(f, out) { var q = naElipsie(A, E, f); return out.copy(P).multiplyScalar(q[0]).addScaledVector(Q, q[1]); }
        var cala = []; for (var i = 0; i <= 240; i++) cala.push(punktE(i / 240 * TAU));
        g.add(linia(c, cala, 'atrament-3', { krycie: 0.6 }));
        // jasny łuk: osiem godzin z dwunastu wokół apogeum (ułamek okresu od 1/6 do 5/6 licząc od perygeum)
        var luk = [], tmpL = new T.Vector3();
        for (var j = 0; j <= 160; j++) luk.push(punktF(1 / 6 + j / 160 * (4 / 6), tmpL.clone()));
        g.add(rura(c, luk, 0.03, 'zloto', { odcinki: 200, mat: { transparent: true, opacity: 0.85 } }));
        // płaszczyzna równika i kąt nachylenia
        var rown = new T.Mesh(new T.RingGeometry(2.1, 4.2, 96), przezr(c, 'granat', 0.08, { side: T.DoubleSide })); rown.rotation.x = -Math.PI / 2; g.add(rown);
        var kat = []; for (var k = 0; k <= 40; k++) { var a = k / 40 * INC; kat.push(new T.Vector3(0, 3.4 * Math.sin(a), -3.4 * Math.cos(a))); }
        g.add(linia(c, kat, 'granat', { krycie: 0.9 }));
        var katO = new T.Object3D(); katO.position.copy(kat[20]); g.add(katO);
        var moskwa = znacznik(c, 'zar', 0.045); moskwa.position.set(0, Math.sin(0.98), -Math.cos(0.98)).multiplyScalar(2.02); g.add(moskwa);
        var lacze = odcinekLinii(c, 'zar', { kreski: [0.12, 0.08], krycie: 0.9 }); g.add(lacze);
        var sats = [], slady = [], NS = 3, NSL = 40;
        for (var s = 0; s < NS; s++) {
          var sat = satelita(c, { skala: 0.7 }); g.add(sat); sats.push(sat);
          var buf = new Float32Array(NSL * 3), gs = new T.BufferGeometry(); gs.setAttribute('position', new T.BufferAttribute(buf, 3));
          var sl = new T.Line(gs, new T.LineBasicMaterial({ color: c.kolor('zar'), transparent: true, opacity: 0.55 })); sl.frustumCulled = false; g.add(sl); slady.push({ buf: buf, geo: gs });
        }
        var apo = new T.Object3D(); apo.position.copy(punktE(Math.PI)); g.add(apo);
        var peri = new T.Object3D(); peri.position.copy(punktE(0)); g.add(peri);
        var OKRES = MOLNIJA.OKRES, tmp = new T.Vector3();
        return { grupa: g,
          ton: function (t, t0) { return tonMolnii((t - t0) / OKRES); },     // glissando z promienia satelity 0 (jak w `krok`)
          etykiety: [
            { tekst: 'daleko nad północą: prawie staje', cel: apo, kotwica: 'gora', klasa: 'zloto', dy: -8 },
            { tekst: 'tuż nad Ziemią: gna jak szalony', cel: peri, kotwica: 'dol', klasa: 'zar', dy: 8 },
            { tekst: 'jasny łuk: osiem godzin z dwunastu', poz: punktF(0.62, new T.Vector3()).toArray(), kotwica: 'prawo', klasa: 'zloto', dx: 12 },
            { tekst: 'nachylenie: trochę powyżej\nsześćdziesięciu trzech stopni', cel: katO, kotwica: 'lewo', klasa: 'granat', dx: -10 },
            { tekst: 'Moskwa', cel: moskwa, kotwica: 'prawo', klasa: 'zar', dx: 8 },
            { tekst: 'Mołnija: błyskawica', cel: sats[0], kotwica: 'prawo', klasa: 'w', dx: 12 }
          ],
          krok: function (t) {
            var najb = 0, najd = 2;
            for (var s = 0; s < NS; s++) {
              var f = t / OKRES + s / NS; punktF(f, sats[s].position); sats[s].lookAt(0, 0, 0);
              var ff = f - Math.floor(f), od = Math.abs(ff - 0.5); if (od < najd) { najd = od; najb = s; }
              var b = slady[s].buf;
              for (var i = 0; i < NSL; i++) { punktF(f - i * 0.004, tmp); b[i * 3] = tmp.x; b[i * 3 + 1] = tmp.y; b[i * 3 + 2] = tmp.z; }
              slady[s].geo.attributes.position.needsUpdate = true;
            }
            ustawLinie(lacze, moskwa.position, sats[najb].position);
          } };
      },
    },

    /* ---------- 23 ---------- */
    {
      czesc: R9, tytul: 'Pas po pasie',
      narracja: [
        'Chcesz sfotografować całą Ziemię, kawałek po kawałku, a satelita nisko widzi tylko wąski pas. Puść go nad biegunami, z północy na południe.',
        'Ziemia obraca się pod nim, więc każde kolejne okrążenie pokazuje mu nowy pas, trochę na zachód od poprzedniego. Po kilku, kilkunastu dniach ma wszystko.',
        'Ale zdjęcia robione o różnych porach dnia mają różne cienie. Jeśli chcesz porównać las w tym roku z lasem sprzed dziesięciu lat, musisz fotografować zawsze o tej samej godzinie miejscowej.'
      ],
      podpis: 'Satelita na orbicie nad biegunami i pasy zdjęć, każdy trochę na zachód od poprzedniego. Schemat: szerokość pasów i tempo przyspieszone, nie w skali.',
      scena: 'helio',
      ujecie: { ruch: 'timelapse: kamera krąży, a pasy zdjęć narastają', tor: [[6.2, 3.2, 5.2], [7.0, 2.6, 2.6], [7.0, 2.2, 0.2]], cel: [0, 0.3, 0], fov: 36, czas: 18, komp: [0, 0] }, tPogl: 30,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0, slonce: [1, 0.12, 0.25] }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), RS = 2.42, WS = 1.6, WZ = 0.11, OKRES = 40;
        var Y = new T.Vector3(0, 1, 0), SH = new T.Vector3(1, 0, 0.25).normalize();
        var pts = []; for (var i = 0; i <= 160; i++) { var a = i / 160 * TAU; pts.push(Y.clone().multiplyScalar(RS * Math.cos(a)).addScaledVector(SH, RS * Math.sin(a))); }
        g.add(linia(c, pts, 'zloto', { krycie: 0.5 }));
        var sat = satelita(c, { skala: 0.45 }); g.add(sat);
        var cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
        var x = cv.getContext('2d'), tex = new T.CanvasTexture(cv), k = c.kolor('zloto');
        var kolor = 'rgb(' + Math.round(k.r * 255) + ',' + Math.round(k.g * 255) + ',' + Math.round(k.b * 255) + ')';
        var nakl = new T.Mesh(new T.SphereGeometry(2.012, 96, 64), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.42, depthWrite: false }));
        g.add(nakl);
        var ostatni = 0, d = new T.Vector3();
        function wyczysc() { x.clearRect(0, 0, cv.width, cv.height); ostatni = 0; }
        function maluj(t) {
          var a = 0.6 + WS * t; d.copy(Y).multiplyScalar(Math.cos(a)).addScaledVector(SH, Math.sin(a));
          if (d.dot(SH) <= 0) return;                         // zdjęcia tylko po stronie dziennej
          d.applyAxisAngle(Y, -WZ * t);                       // do układu obracającej się Ziemi
          var th = Math.acos(Math.max(-1, Math.min(1, d.y))), fi = Math.atan2(d.z, -d.x); if (fi < 0) fi += TAU;
          var px = fi / TAU * cv.width, py = th / Math.PI * cv.height, rx = 13 / Math.max(0.15, Math.sin(th));
          x.fillStyle = kolor; x.beginPath(); x.ellipse(px, py, Math.min(rx, 200), 13, 0, 0, TAU); x.fill();
          if (px - rx < 0) { x.beginPath(); x.ellipse(px + cv.width, py, Math.min(rx, 200), 13, 0, 0, TAU); x.fill(); }
          if (px + rx > cv.width) { x.beginPath(); x.ellipse(px - cv.width, py, Math.min(rx, 200), 13, 0, 0, TAU); x.fill(); }
        }
        return { grupa: g,
          etykiety: [
            { tekst: 'orbita nad biegunami', poz: [0, RS + 0.25, 0], kotwica: 'gora', klasa: 'zloto' },
            { tekst: 'każdy nowy pas: trochę na zachód', poz: [1.4, -0.6, 1.4], kotwica: 'prawo', klasa: 'w', dx: 10 }
          ],
          krok: function (t, z) {
            var tt = L.petla(t, OKRES) * OKRES;
            var zmiana = tt < ostatni; if (zmiana) wyczysc();
            for (var s = ostatni; s < tt; s += 0.02) { maluj(s); zmiana = true; }
            ostatni = tt; if (zmiana) tex.needsUpdate = true;     // upload płótna 1024×512 tylko po malowaniu
            nakl.rotation.y = WZ * tt; z.ziemia.glob.rotation.y = WZ * tt;
            var a = 0.6 + WS * tt; sat.position.copy(Y).multiplyScalar(RS * Math.cos(a)).addScaledVector(SH, RS * Math.sin(a)); sat.lookAt(0, 0, 0);
          } };
      },
    },

    /* ---------- 24 ---------- */
    {
      czesc: R9, tytul: 'Rok widziany z góry',
      narracja: [
        'I tu wchodzi defekt Ziemi: planeta jest lekko spłaszczona, na równiku grubsza niż między biegunami. Ten dodatkowy pas materii powoli obraca płaszczyznę orbity, trochę mniej niż o jeden stopień dziennie.',
        'A Ziemia obiega Słońce w rok, czyli też o trochę mniej niż jeden stopień dziennie. Dobierz wysokość i nachylenie tak, żeby oba tempa były równe, a orbita przez cały rok będzie ustawiona tak samo względem Słońca.',
        'Nazywa się to orbita heliosynchroniczna. Landsat fotografuje po niej Ziemię nieprzerwanie od 1972 roku: pół wieku zmian jak film, każda klatka o tej samej godzinie.',
        'Defekt kształtu planety stał się narzędziem.'
      ],
      podpis: 'Rok widziany z góry. Jasna połowa każdej Ziemi to dzień, kreska przez Ziemię to płaszczyzna orbity, a kropka to satelita po stronie dziennej; przerywana kreska pokazuje, gdzie zostałaby płaszczyzna, gdyby Ziemia była idealną kulą. Schemat, nie w skali.',
      scena: 'rok', strefa: [0, 0, 0, 1.2],
      ujecie: { ruch: 'crane: dźwig nad Słońcem i rokiem Ziemi', tor: [[0, 4.5, 15], [0, 12, 10.5], [0, 18.5, 4.2]], cel: [[0, 0, 0.5], [0, 0, 0.6], [0, 0, 0.8]], fov: 48, czas: 16, komp: [0, 0] }, tPogl: 5,
      zestawy: ['gwiazdy'],
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), RO = 7, ALFA = 0.62, DL = 1.05;
        var slonce = new T.Group(); slonce.add(kula(c, 0.75, 'zar')); slonce.add(poswiata(c, 'zloto', 5.5, 0.9)); g.add(slonce);
        g.add(orbita(c, RO, 'atrament-3', { krycie: 0.45, n: 200 }));
        function ziemiaZPlaszczyzna(kat, obracac) {
          var gr = new T.Group(); gr.position.set(RO * Math.cos(kat), 0, -RO * Math.sin(kat));
          var z = kulaDzienNoc(c, 0.42); z.userData.slonce.copy(gr.position).negate().normalize(); gr.add(z);
          var doS = Math.atan2(gr.position.z, -gr.position.x);       // kierunek ku Słońcu w płaszczyźnie xz (kąt wokół y)
          var kierPl = obracac ? -kat + ALFA : ALFA;                   // płaszczyzna: stały kąt do światła albo stała w przestrzeni
          var e = new T.Vector3(Math.cos(kierPl), 0, Math.sin(kierPl));
          gr.userData.kreska = linia(c, [e.clone().multiplyScalar(-DL), e.clone().multiplyScalar(DL)], 'zloto', { krycie: 0.95 }); gr.add(gr.userData.kreska);
          var kSat = e.clone().multiplyScalar(e.dot(z.userData.slonce) >= 0 ? DL * 0.82 : -DL * 0.82);
          var sat = znacznik(c, 'zar', 0.06); sat.position.copy(kSat); gr.add(sat);
          gr.userData.doS = doS;
          return gr;
        }
        var cztery = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].map(function (k) { var e = ziemiaZPlaszczyzna(k, true); g.add(e); return e; });
        // po trzech miesiącach: gdzie zostałaby płaszczyzna bez obracania
        var e0 = new T.Vector3(Math.cos(ALFA), 0, Math.sin(ALFA)), duch = linia(c, [e0.clone().multiplyScalar(-DL * 1.25), e0.clone().multiplyScalar(DL * 1.25)], 'atrament-2', { kreski: [0.1, 0.08], krycie: 0.9 });
        duch.position.copy(cztery[1].position); g.add(duch);
        var ruch = ziemiaZPlaszczyzna(0, true); g.add(ruch);
        var kd = new T.Object3D(); kd.position.copy(cztery[1].position).add(e0.clone().multiplyScalar(DL * 1.3)); g.add(kd);
        return { grupa: g,
          etykiety: [
            { tekst: 'Słońce', cel: slonce, kotwica: 'dol', klasa: 'zloto', dy: 26 },
            { tekst: 'start', cel: cztery[0], kotwica: 'prawo', klasa: 'w', dx: 24 },
            { tekst: 'po 3 miesiącach', cel: cztery[1], kotwica: 'gora', klasa: 'w', dy: -22 },
            { tekst: 'po 6 miesiącach', cel: cztery[2], kotwica: 'lewo', klasa: 'w', dx: -24 },
            { tekst: 'po 9 miesiącach', cel: cztery[3], kotwica: 'dol', klasa: 'w', dy: 22 },
            { tekst: 'gdyby płaszczyzna się nie obracała', cel: kd, kotwica: 'prawo', klasa: 'm', dx: 8 },
            { tekst: 'Landsat: od 1972, każda klatka o tej samej godzinie', poz: [0, 0, 9.4], kotwica: 'dol', klasa: 'zloto', dy: 6 }
          ],
          krok: function (t) {
            var kat = L.petla(t, 16) * TAU;
            ruch.position.set(RO * Math.cos(kat), 0, -RO * Math.sin(kat));
            ruch.children[0].userData.slonce.copy(ruch.position).negate().normalize();
            ruch.rotation.y = kat;                               // płaszczyzna obraca się razem z obiegiem
          } };
      },
    },

    /* ---------- 25 ---------- */
    {
      czesc: R10, tytul: 'Cmentarzysko',
      narracja: [
        'Dwa piętra na samym końcu, przy których granica się rozmywa. Pierwsze to cmentarzysko.',
        'Satelita z półki Clarke\'a, kiedy kończy mu się paliwo, nie może spaść, bo tam nie ma już powietrza, które by go ściągnęło. Dlatego ostatnią porcję paliwa zużywa, żeby wznieść się kilkaset kilometrów wyżej, na orbitę, której nikt nie potrzebuje.',
        'Tam krąży bez celu, w ciszy, w towarzystwie setek poprzedników. Patrz: to nadal satelita Ziemi, tyle że emerytowany.'
      ],
      podpis: 'Ostatnie odpalenie silnika: z półki Clarke\'a na cmentarzysko. Schemat: odstęp między pierścieniami mocno wyolbrzymiony, nie w skali.',
      scena: 'geo',
      ujecie: { ruch: 'dolly-in: najazd na satelitę w ostatnim odpaleniu', tor: [[12.5, 6.2, 5.2], [10.8, 4.0, 1.6], [9.8, 2.8, 0.2]], cel: [[3.8, 0, -2.0], [4.8, 0, -2.8], [5.2, 0, -3.2]], fov: [40, 34], czas: 16, komp: [-0.1, 0] }, tPogl: 6,
      zestawy: ['gwiazdy', 'ziemia', 'polka'],
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0.02, slonce: [0.7, 0.4, 0.6] }); z.polka.ustaw({ obrot: 0.02, faza: 0.4, cmentarz: true, satelita: false, lacze: false }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), RG = 6, RC = 6.75, OKRES = 15;
        var sat = satelita(c, { skala: 0.75 }); g.add(sat);
        var plomien = new T.Group();
        var stz = new T.Mesh(new T.ConeGeometry(0.07, 0.42, 14, 1, true), przezr(c, 'lak', 0.75, { side: T.DoubleSide, blending: T.AdditiveBlending }));
        stz.position.y = -0.3; plomien.add(stz); plomien.add(poswiata(c, 'zar', 0.6, 0.9)); g.add(plomien);
        var N = 80, sl = new Float32Array(N * 3), gs = new T.BufferGeometry(); gs.setAttribute('position', new T.BufferAttribute(sl, 3));
        var slad = new T.Line(gs, new T.LineBasicMaterial({ color: c.kolor('zloto'), transparent: true, opacity: 0.6 })); slad.frustumCulled = false; g.add(slad);
        function poz(tt, out) { var r = RG + (RC - RG) * L.wygladz(L.odcinek(tt, 2, 9)), th = 0.4 + 0.02 * tt; return out.set(r * Math.cos(th), 0, -r * Math.sin(th)); }
        var tmp = new T.Vector3(), cm = new T.Object3D(); cm.position.set(RC * Math.cos(1.4), 0, -RC * Math.sin(1.4)); g.add(cm);
        return { grupa: g,
          etykiety: [
            { tekst: 'ostatnia porcja paliwa: kilkaset kilometrów wyżej', cel: sat, kotwica: 'prawo', klasa: 'zloto', dx: 14 },
            { tekst: 'cmentarzysko: emerytowane satelity Ziemi', cel: cm, kotwica: 'gora', klasa: 'm', dy: -8 },
            { tekst: 'półka Clarke\'a', poz: [RG * Math.cos(0.1), 0, -RG * Math.sin(0.1)], kotwica: 'dol', klasa: 'zloto', dy: 8 }
          ],
          krok: function (t) {
            var tt = L.petla(t, OKRES) * OKRES;
            poz(tt, sat.position); sat.lookAt(0, 0, 0);
            for (var i = 0; i < N; i++) { poz(Math.max(0, tt - i * 0.12), tmp); sl[i * 3] = tmp.x; sl[i * 3 + 1] = tmp.y; sl[i * 3 + 2] = tmp.z; }
            gs.attributes.position.needsUpdate = true;
            var pali = tt > 2 && tt < 9;
            plomien.visible = pali; plomien.position.copy(sat.position);
            var th = 0.4 + 0.02 * tt; tmp.set(Math.sin(th), 0, Math.cos(th)); skieruj(T, plomien, tmp);   // dysza ku tyłowi lotu
            stz.scale.set(1, 0.8 + 0.3 * Math.sin(t * 23), 1);
          } };
      },
    },

    /* ---------- 26 ---------- */
    {
      czesc: R10, tytul: 'Webb: granica rozmazana',
      narracja: [
        'Drugie piętro to teleskop Webba, półtora miliona kilometrów stąd, cztery razy dalej niż Księżyc. Czy to jeszcze satelita Ziemi? Prawdę mówiąc, nie.',
        'On krąży wokół Słońca, w rytm z nami, w miejscu, gdzie przyciąganie Ziemi i Słońca składa się tak, że trzyma się blisko nas prawie bez wysiłku. Spójrz: zawsze po nocnej stronie Ziemi, zawsze z zimną stroną w ciemność.'
      ],
      ramka: { typ: 'info', etykieta: 'Granica', tekst: 'Niektórzy wliczają go do satelitów Ziemi, bo nas nie opuszcza, inni nie, bo to Słońce go trzyma.', punkty: [
        'Granica między „krąży wokół Ziemi” a „krąży razem z Ziemią” jest tam rozmazana, i właśnie tam jest najciekawiej.'
      ] },
      podpis: 'Słońce, Ziemia z Księżycem i teleskop Webba po nocnej stronie, cztery razy dalej niż Księżyc. Schemat: odległości od Słońca skrócone, rozmiary wyolbrzymione, nie w skali.',
      scena: 'webb', strefa: null,
      ujecie: { ruch: 'dolly-out: od Ziemi przez Księżyc do Webba i Słońca', tor: [[-1.6, 1.4, 4.2], [2.2, 3.5, 9.5], [1.5, 7.2, 18]], cel: [[0.5, 0, -0.6], [3, 0, -1.4], [-3, 0, -1.4]], fov: [38, 48], czas: 18, komp: [0, 0] }, tPogl: 8,
      zestawy: ['gwiazdy'],
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), SUN = new T.Vector3(-24, 0, 0), RZ = 24;
        var slonce = new T.Group(); slonce.position.copy(SUN); slonce.add(kula(c, 1.6, 'zar')); slonce.add(poswiata(c, 'zloto', 13, 0.9)); g.add(slonce);
        g.add(linia(c, punktyOrbity(T, RZ, 0, 0, 260).map(function (p) { return p.add(SUN); }), 'atrament-3', { krycie: 0.3 }));
        var para = new T.Group(); g.add(para);
        var zi = kulaDzienNoc(c, 0.7); para.add(zi);
        para.add(orbita(c, 2.5, 'atrament-3', { krycie: 0.4 }));
        var ks = kulaDzienNoc(c, 0.19, 'atrament-2', 'linia'); para.add(ks);
        var webb = new T.Group();
        var oslona = new T.Mesh(new T.PlaneGeometry(0.95, 0.55), mat(c, 'lak', { side: T.DoubleSide, transparent: true, opacity: 0.85 })); oslona.rotation.y = Math.PI / 2; oslona.position.x = -0.12; webb.add(oslona);
        var lustro = new T.Mesh(new T.CircleGeometry(0.3, 6), matL(c, 'zloto', { side: T.DoubleSide, emissive: c.kolor('zloto-tlo') })); lustro.rotation.y = Math.PI / 2; lustro.position.set(0.1, 0.18, 0); webb.add(lustro);
        webb.add(poswiata(c, 'zloto', 0.9, 0.5));
        para.add(webb);
        para.add(linia(c, [new T.Vector3(0.75, 0, 0), new T.Vector3(10, 0, 0)], 'zloto', { kreski: [0.2, 0.15], krycie: 0.55 }));
        var ksO = new T.Object3D(); para.add(ksO);
        var poczS = new T.Vector3(), dS = new T.Vector3();
        return { grupa: g,
          etykiety: [
            { tekst: 'Słońce', cel: slonce, kotwica: 'dol', klasa: 'zloto', dy: 64 },
            { tekst: 'Ziemia', cel: zi, kotwica: 'dol', klasa: 'granat', dy: 16 },
            { tekst: 'Księżyc', cel: ks, kotwica: 'gora', klasa: 'm', dy: -8 },
            { tekst: 'teleskop Webba: półtora miliona kilometrów,\ncztery razy dalej niż Księżyc', cel: webb, kotwica: 'prawo', klasa: 'zloto', dx: 12 },
            { tekst: 'zawsze po nocnej stronie, zimną stroną w ciemność', cel: webb, kotwica: 'dol', klasa: 'm', dy: 26 }
          ],
          krok: function (t) {
            var fi = 0.008 * t;
            para.position.set(SUN.x + RZ * Math.cos(fi), 0, -RZ * Math.sin(fi)); para.rotation.y = fi;
            poczS.copy(SUN).sub(para.position).normalize();
            zi.userData.slonce.copy(poczS); ks.userData.slonce.copy(poczS);
            var a = 0.4 * t; ks.position.set(2.5 * Math.cos(a), 0, -2.5 * Math.sin(a));
            var h = 0.35 * t; webb.position.set(10, 0.85 * Math.sin(h), 0.5 * Math.cos(h));
            dS.copy(webb.position); ksO.position.copy(dS);
          } };
      },
    },

    /* ---------- 27 ---------- */
    {
      czesc: R11, tytul: 'Lustro, zegar, oko',
      narracja: [
        'Wysokość to jedna oś, druga to zadanie. Przejdź wzdłuż stanowisk.',
        'Łącznościowe to lustro zawieszone nad kontynentem: ty mówisz w górę, ono odbija w dół, do kogoś za oceanem. Nawigacyjne to zegary, które prowadzą nie tylko ciebie, ale też statki, kombajny na polu i bankomaty, biorące z tego samego sygnału dokładny czas.',
        'Obserwacyjne to oko, które patrzy w dół: jedne widzą światło jak my, inne podczerwień, czyli ciepło. Jeszcze inne mają radar i widzą przez chmury, w nocy, w deszczu, jakby chmur nie było.'
      ],
      podpis: 'Trzy stanowiska: łączność, nawigacja, obserwacja. Rysunek poglądowy: wysokości i rozmiary umowne, nie w skali.',
      scena: 'robota', strefa: [0, -31.2, 0, 30.3],
      ujecie: { ruch: 'travelling: boczny przejazd wzdłuż trzech stanowisk', tor: [[-6.6, 1.7, 7.4], [0, 1.9, 8], [6.6, 1.7, 7.4]], cel: [[-5, 0.7, 0], [0, 0.9, 0], [5, 0.7, 0]], fov: 36, czas: 21, komp: [0, 0] }, tPogl: 5,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 30, pozycja: [0, -31.2, 0], obrot: 0, slonce: [0.3, 1, 0.5], siatka: 0.35, chmury: 0.5, atmosfera: 0.5 }); },
      zbuduj: function (c) { return zbudujStanowiska(c); },
    },

    /* ---------- 28 ---------- */
    {
      czesc: R11, tytul: 'Głowa nad wodą',
      narracja: [
        'Pogodowe są dwa, bo dwa spojrzenia: jeden stoi na półce Clarke\'a i patrzy na cały kontynent, drugi krąży nisko nad biegunami i mierzy z bliska temperaturę, wilgotność, wiatr nad oceanem. Prognoza na jutro jest zszyta z obu.',
        'A teraz naukowe. Wyobraź sobie, że całe życie patrzysz na świat z dna basenu, a fale na wodzie rozmazują wszystko.',
        'Teleskop na orbicie to głowa wystawiona nad wodę. Hubble widzi ostro nie dlatego, że jest największy, bo nie jest, tylko dlatego, że nad nim nie ma powietrza.'
      ],
      podpis: 'Dwa spojrzenia pogody i teleskop pod falującą wodą oraz nad nią. Rysunek poglądowy: powietrze pokazane jak woda w basenie, nie w skali.',
      scena: 'robota', strefa: [0, -31.2, 0, 30.3],
      ujecie: { ruch: 'crane: dźwig spod falującej wody ponad nią', tor: [[2.6, 0.15, 6.2], [2.0, 2.2, 8.6], [0.4, 4.3, 11.6]], cel: [[2.8, 0.75, 0], [2.0, 1.6, 0], [-0.2, 2.5, -0.6]], fov: [40, 46], czas: 16, komp: [0, 0] }, tPogl: 6,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 30, pozycja: [0, -31.2, 0], obrot: 0, slonce: [0.3, 1, 0.5], siatka: 0.35, chmury: 0.5, atmosfera: 0.5 }); },
      zbuduj: function (c) { return zbudujBasen(c); },
    },

    /* ---------- 29 ---------- */
    {
      czesc: R11, tytul: 'Kaseta na spadochronie',
      narracja: [
        'Wojskowe są rozpoznawcze, czyli bardzo dobre aparaty, są takie, które podsłuchują fale radiowe, i takie, które czekają na ciepło startującej rakiety.',
        'Jedna rzecz z tej historii jest pewna: pierwsze satelity szpiegowskie, w latach sześćdziesiątych, nie umiały przesłać zdjęć. Robiły je na kliszę i zrzucały kasetę z filmem w kapsule na spadochronie, którą samolot łapał w locie, hakiem, nad oceanem.',
        'A wysoko nad tobą krąży stacja, jedyny satelita, w którym ktoś mieszka, i pudełka studentów i krótkofalowców, przez które ludzie z różnych krajów rozmawiają bez żadnej firmy pośrodku.'
      ],
      ramka: { typ: 'umbra', etykieta: 'Wprost', tekst: 'Przy satelitach wojskowych wiem mniej, bo mniej wiadomo.', punkty: [
        'Opowieść podaje tylko rodzaje: rozpoznawcze, podsłuchujące fale radiowe i ostrzegające przed startem rakiety.'
      ] },
      podpis: 'Kapsuła z filmem na spadochronie i samolot z hakiem nad oceanem. Rysunek poglądowy, nie w skali.',
      scena: 'wojsko', strefa: null,
      ujecie: { ruch: 'travelling: kamera leci za samolotem z hakiem', tor: [[-7.5, 3.5, 6.6], [-3.4, 3.3, 6.9], [1.4, 3.4, 6.6]], cel: [[-4.2, 2.8, 0], [-1.8, 2.8, 0], [0.2, 3.0, 0]], fov: 40, czas: 14, komp: [0, 0] }, tPogl: 6.9,
      zestawy: ['gwiazdy'],
      zbuduj: function (c) { return zbudujPrzechwyt(c); },
    },

    /* ---------- 30 ---------- */
    {
      czesc: R12, tytul: 'Od autobusu do kostki',
      narracja: [
        'Spójrz na trzecią oś: rozmiar. Tu wszystko się ostatnio zmieniło, bo Hubble jest wielkości autobusu, a duży satelita łącznościowy ma skrzydła baterii o rozpiętości samolotu pasażerskiego.',
        'Potem dwaj profesorowie ustalili wzorzec: kostka o boku dziesięciu centymetrów, trochę ponad kilogram, taka, żeby student mógł ją zbudować w semestr. Nazwali to CubeSat i można je składać jak klocki: dwie kostki, trzy, sześć.',
        'Na samym końcu skali są chipy wielkości znaczka pocztowego. Czy to jeszcze satelity? Technicznie tak, bo krążą.'
      ],
      podpis: 'Od autobusu do kostki i znaczka. Schemat: rozmiary nie w skali, małe obiekty powiększone.',
      scena: 'rozmiary', strefa: null,
      ujecie: { ruch: 'dolly-in: przejazd od największego do najmniejszego', tor: [[-9.5, 2.6, 10], [-1.5, 2.1, 9], [7.6, 1.3, 4.0]], cel: [[-6.2, 0.2, 0], [-0.5, 0.3, 0], [7.4, 0, 0]], fov: [44, 30], czas: 18, komp: [0, 0] }, tPogl: 6,
      zestawy: ['gwiazdy'],
      zbuduj: function (c) { return zbudujRozmiary(c); },
    },

    /* ---------- 31 ---------- */
    {
      czesc: R12, tytul: 'Sto zwykłych zamiast jednego doskonałego',
      narracja: [
        'Dziś takich kostek lecą setki naraz, w jednej rakiecie. Patrz, jak się rozsypują.',
        'Firma zamiast jednego doskonałego aparatu wysyła rój stu zwykłych, które razem fotografują cały ląd Ziemi codziennie. Nie dlatego, że każdy z nich jest dobry.',
        'Dlatego, że jest ich sto i że można stracić dziesięć bez płaczu.'
      ],
      podpis: 'Sto kostek wypuszczonych z rakiety rozchodzi się w rój, dziesięć gaśnie. Schemat: tempo przyspieszone, rozmiary kostek wyolbrzymione, nie w skali.',
      scena: 'kostki',
      ujecie: { ruch: 'timelapse: kamera za rakietą, rój się rozchodzi', tor: [[3.7, 2.2, 3.4], [4.2, 3.6, 4.8], [4.2, 4.8, 5.8]], cel: [[1.6, 0.2, 1.6], [0.6, 0.1, 0.6], [0, -0.2, 0]], fov: 40, czas: 16, komp: [0, 0] }, tPogl: 12,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0.05, slonce: [0.6, 0.5, 0.7] }); },
      zbuduj: function (c) { return zbudujRoj(c); },
    },

    /* ---------- 32 ---------- */
    {
      czesc: R13, tytul: 'Niebo nie rozróżnia',
      narracja: [
        'Wróćmy do zdania, które kazałem ci zapamiętać: niebo nie rozróżnia żywych od martwych.',
        'Na orbicie jest dziś kilkanaście tysięcy czynnych satelitów, do tego tysiące martwych, dziesiątki tysięcy większych odłamków, które da się śledzić z ziemi, i niepoliczalne drobiny. Każda z tych rzeczy pędzi kilkakrotnie szybciej niż kula z karabinu.',
        'Drobina farby, mniejsza niż ziarnko piasku, zostawiła kiedyś w szybie wahadłowca krater.'
      ],
      podpis: 'Czynne satelity, martwe, odłamki i drobiny wokół Ziemi; na pierwszym planie szyba z kraterem po drobinie farby. Schemat: liczba punktów i ich rozmiary umowne, nie w skali.',
      scena: 'smieci',
      ujecie: { ruch: 'dolly-in: przelot przez chmurę odłamków do szyby z kraterem', tor: [[0.5, 6.2, 12.5], [3.4, 3.6, 8.2], [4.2, 2.4, 5.6]], cel: [[0, 0, 0], [1.4, 0.9, 1.6], [2.4, 1.5, 2.9]], fov: [40, 34], czas: 18, komp: [0, 0] }, tPogl: 7,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0.03, slonce: [0.6, 0.5, 0.7] }); },
      zbuduj: function (c) { return zbudujSmieci(c, 'chmura'); },
    },

    /* ---------- 33 ---------- */
    {
      czesc: R13, tytul: 'Zła bajka',
      narracja: [
        'W 1978 roku pewien pracownik NASA opisał złą bajkę. Jeśli śmieci będzie dość dużo, zaczną się zderzać ze sobą, a każde zderzenie robi z dwóch rzeczy tysiąc.',
        'Tysiąc rzeczy zderza się częściej; patrz, jak to narasta. W pewnym momencie reakcja karmi się sama i pewne piętra nieba stają się na pokolenia nie do użycia.',
        'Nazywa się to od jego nazwiska syndromem Kesslera.'
      ],
      ramka: { typ: 'nota', etykieta: 'Granica wiedzy', tekst: 'Nie wiemy, jak blisko tego progu jesteśmy.', punkty: [
        'Wiemy, że od czasu, gdy to napisał, rzeczy na orbicie przybyło wielokrotnie.'
      ] },
      podpis: 'Kaskada Kesslera narasta: każde zderzenie sypie odłamkami, które zderzają się dalej. Schemat: liczba odłamków, zderzenia i tempo umowne, nie w skali.',
      scena: 'smieci',
      ujecie: { ruch: 'dolly-out: kaskada rośnie, kamera odjeżdża', tor: [[1.6, 1.3, 4.7], [3.0, 3.0, 8.0], [4.0, 5.0, 11.2]], cel: [[1.2, 0.2, 2.2], [0.5, 0.2, 0.8], [0, 0, 0]], fov: 38, czas: 18, komp: [0, 0] }, tPogl: 14,
      // cisza: pełna, po przeczytaniu ramki „Nie wiemy, jak blisko tego progu jesteśmy” (cisza jako znak)
      zdarzenia: { zderzenia: { wers: 1, po: 3.0 }, cisza: { wers: 'ramka', po: 2.0 } },  // pierwsze zderzenie pod „zaczną się zderzać”, narasta przez „patrz, jak to narasta”
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0.03, slonce: [0.6, 0.5, 0.7] }); },
      zbuduj: function (c) { return zbudujKaskade(c); },
    },

    /* ---------- 34 ---------- */
    {
      czesc: R13, tytul: 'Pokój duży, ale skończony',
      narracja: [
        'I tu wraca parter, który sam się sprząta. Wszystko, co krąży nisko, powietrze w końcu ściąga i spala, dlatego nowe konstelacje celowo lecą nisko: zepsuty satelita ma spaść sam w ciągu kilku lat.',
        'Wyżej tej łaski nie ma. Co zostawisz na dwóch tysiącach kilometrów, zostaje na stulecia, a co zostawisz na półce Clarke\'a, zostaje właściwie na zawsze.',
        'Niebo okazało się pokojem. Dużym, ale skończonym, i wspólnym.'
      ],
      podpis: 'Trzy piętra i trzy losy śmieci w przyspieszonym upływie czasu. Schemat: tempo i wysokości umowne, nie w skali.',
      scena: 'smieci',
      ujecie: { ruch: 'crane: dźwig od parteru do półki Clarke\'a', tor: [[2.6, 1.5, 5.4], [4.2, 4.8, 9.4], [3.2, 9.5, 11.8]], cel: [[0.6, 0.6, 1.6], [0, 0.5, 0], [0, 0, 0]], fov: 40, czas: 18, komp: [0, 0] }, tPogl: 8,
      ustaw: function (c, z) { z.ziemia.ustaw({ r: 2, obrot: 0.03, slonce: [0.6, 0.5, 0.7], atmosfera: 1.5 }); },
      zbuduj: function (c) { return zbudujSmieci(c, 'losy'); },
    },

    /* ---------- 35 ---------- */
    {
      czesc: R14, tytul: 'Spójrz w górę',
      narracja: [
        'Więc dziś wieczorem, jeśli niebo będzie czyste, wyjdź na parę minut po zachodzie słońca. Zadrzyj głowę i poczekaj, aż jedna z gwiazd ruszy.',
        'Teraz wiesz, na co patrzysz. To kamień, który spada i ciągle chybia, i jest jeszcze w dniu, który dla ciebie już się skończył.',
        'Może to stacja z ludźmi w środku, może kostka zbudowana przez studentów, może grejpfrutowa kulka z 1958 roku. Zgaśnie za chwilę, wlatując w cień. Ale nie przestanie spadać.'
      ],
      podpis: 'Łąka po zachodzie słońca i ta sama gwiazda, która idzie. Kadr poglądowy: tempo przelotu przyspieszone.',
      scena: 'laka', strefa: null,
      ujecie: { ruch: 'crane: zza ramienia człowieka na łące w niebo', tor: [[0.6, 1.15, 2.7], [0.45, 1.45, 2.05], [0.32, 1.72, 1.55]], cel: [[0, 1.5, -3], [0, 12, -30], [0, 38, -52]], fov: [42, 52], czas: 18, komp: [0.12, 0] }, tPogl: 20,
      zestawy: ['laka'],
      zdarzenia: { wschod: { wers: 1, po: 2.0 }, gasnie: { wers: 5, po: 2.2 } },   // rusza pod „aż jedna z gwiazd ruszy”, gaśnie pod „Zgaśnie za chwilę”
      dzwiek: { wiatr: 1 },
      ustaw: function (c, z) { z.laka.ustaw({ czlowiek: true }); },
      zbuduj: function (c) {
        var l = c.zestaw('laka');
        return { etykiety: [{ tekst: 'kamień, który spada i ciągle chybia', cel: l.satelita, kotwica: 'prawo', klasa: 'zar', dx: 6 }] };
      }
    }
  ];

  /* =====================================================================
     Budowy scen wyniesione z kroków (żeby lista kroków została czytelna)
     ===================================================================== */
  // Rycina „Wszystko w jednej skali”: promienie liczone z wysokości w km (wSkali), Ziemia = 1.
  function zbudujSkale(c, zBliska) {
    var T = c.THREE, g = new T.Group();
    var rL0 = wSkali(160), rL1 = wSkali(2000), rIss = wSkali(400), rMeo = wSkali(20200), rGeo = wSkali(35786), rp = wSkali(600), ra = wSkali(39700);
    var pas = new T.Mesh(new T.RingGeometry(rL0, rL1, 200, 2), przezr(c, 'zloto', 0.2, { side: T.DoubleSide })); pas.rotation.x = -Math.PI / 2; g.add(pas);
    g.add(orbita(c, rIss, 'zar', { krycie: 0.95, n: 400 }));
    g.add(orbita(c, rMeo, 'granat', { krycie: 0.75, n: 300 }));
    g.add(orbita(c, rGeo, 'zloto', { krycie: 0.9, n: 360 }));
    var INC = 63.5 * Math.PI / 180, A = (rp + ra) / 2, E = (ra - rp) / (ra + rp), B = A * Math.sqrt(1 - E * E);
    var N = new T.Vector3(0, Math.sin(INC), -Math.cos(INC)), P = N.clone().negate(), Q = new T.Vector3(1, 0, 0);
    var mol = []; for (var i = 0; i <= 300; i++) { var Ea = i / 300 * TAU; mol.push(P.clone().multiplyScalar(A * (Math.cos(Ea) - E)).addScaledVector(Q, B * Math.sin(Ea))); }
    g.add(linia(c, mol, 'lak', { krycie: 0.8 }));
    // znaczniki w prawdziwych proporcjach okresów: 90 minut, pół doby, doba, pół doby (Mołnija, prawo Keplera)
    function zn(kolor) { var z = znacznik(c, kolor, zBliska ? 0.006 : 0.05); g.add(z); return z; }
    var mL = zn('zar'), mM = zn('granat'), mG = zn('zloto'), mMol = zn('lak');
    var OKR = 6;                                     // sekund na jedno okrążenie stacji (90 minut)
    var aIss = new T.Object3D(); aIss.position.set(rIss * Math.cos(2.4), 0, -rIss * Math.sin(2.4)); g.add(aIss);
    var aMeo = new T.Object3D(); aMeo.position.set(rMeo * Math.cos(2.2), 0, -rMeo * Math.sin(2.2)); g.add(aMeo);
    var aGeo = new T.Object3D(); aGeo.position.set(rGeo * Math.cos(-0.5), 0, -rGeo * Math.sin(-0.5)); g.add(aGeo);
    var aMol = new T.Object3D(); aMol.position.copy(N).multiplyScalar(ra); g.add(aMol);
    var aCm = new T.Object3D(); aCm.position.set(rGeo * Math.cos(-2.4), 0, -rGeo * Math.sin(-2.4)); g.add(aCm);
    var kier = new T.Vector3(Math.cos(0.7), 0, -Math.sin(0.7)), strz = strzalka(c, 'atrament-2', 0.012, 0.16);
    strz.userData.ustaw(kier.clone().multiplyScalar(rGeo * 1.06).toArray(), kier.clone().multiplyScalar(rGeo * 1.5).toArray()); g.add(strz);
    var aKs = new T.Object3D(); aKs.position.copy(kier).multiplyScalar(rGeo * 1.5); g.add(aKs);
    var aIssB = new T.Object3D(); aIssB.position.set(rIss * Math.cos(-0.28), 0, -rIss * Math.sin(-0.28)); g.add(aIssB);
    var etykiety = zBliska ? [
      { tekst: 'stacja kosmiczna · 400 km: grubość kreski', cel: aIssB, kotwica: 'dol', klasa: 'zar', dy: 34 },
      { tekst: 'cały pas orbit niskich: od 160 do 2000 km', poz: [rL1 * Math.cos(-0.3), 0, -rL1 * Math.sin(-0.3)], kotwica: 'gora', klasa: 'zloto', dy: -10 },
      { tekst: 'Ziemia', poz: [0.85, -0.12, 0.45], kotwica: 'srodek', klasa: 'granat' }
    ] : [
      { tekst: 'LEO · ISS · 400 km · okrążenie w 90 minut', cel: aIss, kotwica: 'lewo', klasa: 'zar', dx: -12 },
      { tekst: 'MEO · GPS · 20 200 km · dwa okrążenia na dobę', cel: aMeo, kotwica: 'lewo', klasa: 'granat', dx: -8 },
      { tekst: 'GEO · 35 786 km · jedno okrążenie na dobę', cel: aGeo, kotwica: 'prawo', klasa: 'zloto', dx: 8 },
      { tekst: 'Mołnija · 600 do 39 700 km', cel: aMol, kotwica: 'gora', klasa: 'lak', dy: -6 },
      { tekst: 'cmentarzysko: w tej skali ta sama kreska', cel: aCm, kotwica: 'lewo', klasa: 'm', dx: -8 },
      { tekst: 'Księżyc: dziewięć razy dalej niż ten pierścień', cel: aKs, kotwica: 'prawo', klasa: 'm', dx: 8 },
      { tekst: 'Ziemia', poz: [0, -1.1, 0], kotwica: 'dol', klasa: 'granat' }
    ];
    return { grupa: g, etykiety: etykiety,
      krok: function (t) {
        var th = 2.4 + TAU * t / OKR;
        mL.position.set(rIss * Math.cos(th), 0, -rIss * Math.sin(th));
        var thM = 2.2 + TAU * t / (OKR * 8); mM.position.set(rMeo * Math.cos(thM), 0, -rMeo * Math.sin(thM));
        var thG = -0.5 + TAU * t / (OKR * 16); mG.position.set(rGeo * Math.cos(thG), 0, -rGeo * Math.sin(thG));
        var q = naElipsie(A, E, 0.5 + t / (OKR * 8)); mMol.position.copy(P).multiplyScalar(q[0]).addScaledVector(Q, q[1]);
      } };
  }

  // Trzy stanowiska: łącznościowe (lustro), nawigacyjne (zegar), obserwacyjne (światło i radar przez chmury).
  function zbudujStanowiska(c) {
    var T = c.THREE, g = new T.Group(), ZC = new T.Vector3(0, -31.2, 0);
    function grunt(x, z) { return new T.Vector3(x, -31.2 + Math.sqrt(900 - x * x - z * z) + 0.02, z); }
    function sat(x, y, o) { var s = satelita(c, Object.assign({ skala: 0.95 }, o || {})); s.position.set(x, y, 0); s.lookAt(ZC); g.add(s); return s; }
    // łączność
    var sK = sat(-5, 2.5), A = grunt(-7.3, 0.6), B = grunt(-2.9, -0.5);
    var ty = znacznik(c, 'zar', 0.06); ty.position.copy(A); g.add(ty);
    var statek = new T.Group(); statek.add(new T.Mesh(new T.BoxGeometry(0.34, 0.08, 0.1), matL(c, 'atrament-2'))); var maszt = new T.Mesh(new T.BoxGeometry(0.02, 0.18, 0.02), matL(c, 'atrament-2')); maszt.position.y = 0.12; statek.add(maszt); statek.position.copy(B).y += 0.04; g.add(statek);
    g.add(linia(c, [A, sK.position, B], 'zloto', { krycie: 0.5, kreski: [0.1, 0.08] }));
    var impK = poswiata(c, 'zar', 0.45, 1); g.add(impK);
    // nawigacja
    var sN = sat(0, 2.7, { blask: 'granat' }), zg = c.doKamery(zegar(c, 'granat', 0.26)); zg.position.set(0.62, 3.0, 0.2); g.add(zg);
    var cele = [], impN = [];
    [[-1.2, 0.9, 'statek'], [0, 1.1, 'kombajn'], [1.2, 0.8, 'bankomat']].forEach(function (d) {
      var p = grunt(d[0], d[1]), o = new T.Group(); o.position.copy(p);
      if (d[2] === 'statek') { o.add(new T.Mesh(new T.BoxGeometry(0.3, 0.07, 0.1), matL(c, 'atrament-2'))); }
      else if (d[2] === 'kombajn') { var k = new T.Mesh(new T.BoxGeometry(0.22, 0.12, 0.14), matL(c, 'zloto')); k.position.y = 0.09; o.add(k); [-0.07, 0.07].forEach(function (x) { var w = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.16, 12), matL(c, 'linia')); w.rotation.x = Math.PI / 2; w.position.set(x, 0.04, 0); o.add(w); }); }
      else { var b = new T.Mesh(new T.BoxGeometry(0.1, 0.2, 0.07), matL(c, 'atrament-3')); b.position.y = 0.1; o.add(b); var e = new T.Mesh(new T.PlaneGeometry(0.06, 0.04), mat(c, 'granat')); e.position.set(0, 0.15, 0.036); o.add(e); }
      g.add(o); cele.push(o);
      g.add(linia(c, [sN.position.clone(), p], 'granat', { krycie: 0.25 }));
      var im = poswiata(c, 'granat', 0.3, 1); g.add(im); impN.push(im);
    });
    // obserwacja
    var sO = sat(5, 2.5), cel = grunt(5, 0), chm = new T.Group(), los = c.generator(1990);
    for (var i = 0; i < 11; i++) { var k = kula(c, 0.22 + los() * 0.22, 'atrament', { transparent: true, opacity: 0.55, depthWrite: false }); k.position.set(4.2 + los() * 1.6, 0.55 + los() * 0.25, -0.4 + los() * 0.8); k.userData.x0 = k.position.x; chm.add(k); }
    g.add(chm);
    var dlS = sO.position.y - 0.85, swiatlo = new T.Mesh(new T.CylinderGeometry(0.03, 0.32, dlS, 20, 1, true), przezr(c, 'zloto', 0.22, { side: T.DoubleSide, blending: T.AdditiveBlending }));
    swiatlo.position.set(4.6, 0.85 + dlS / 2, 0); swiatlo.rotation.z = -0.12; g.add(swiatlo);
    var radar = linia(c, [sO.position.clone(), cel], 'granat', { kreski: [0.08, 0.06], krycie: 0.95 }); g.add(radar);
    var cz = new T.Mesh(new T.BoxGeometry(0.3, 0.05, 0.3), mat(c, 'granat')); cz.position.copy(cel); g.add(cz);
    var impO = poswiata(c, 'granat', 0.35, 1); g.add(impO);
    var stop = new T.Object3D(); stop.position.set(4.3, 1.05, 0); g.add(stop);
    var tmp = new T.Vector3();
    return { grupa: g,
      etykiety: [
        { tekst: 'łącznościowe: lustro nad kontynentem', cel: sK, kotwica: 'gora', klasa: 'w', dy: -12 },
        { tekst: 'ty', cel: ty, kotwica: 'dol', klasa: 'zar', dy: 8 },
        { tekst: 'ktoś za oceanem', cel: statek, kotwica: 'dol', klasa: 'm', dy: 8 },
        { tekst: 'nawigacyjne: statki, kombajny, bankomaty', cel: sN, kotwica: 'gora', klasa: 'granat', dy: -12 },
        { tekst: 'obserwacyjne: światło, podczerwień, radar', cel: sO, kotwica: 'gora', klasa: 'w', dy: -12 },
        { tekst: 'światło zatrzymują chmury', cel: stop, kotwica: 'lewo', klasa: 'zloto', dx: -10 },
        { tekst: 'radar widzi przez chmury', cel: cz, kotwica: 'dol', klasa: 'granat', dy: 8 }
      ],
      krok: function (t) {
        var u = L.petla(t, 2.4);
        if (u < 0.5) tmp.copy(A).lerp(sK.position, u * 2); else tmp.copy(sK.position).lerp(B, (u - 0.5) * 2);
        impK.position.copy(tmp);
        impN.forEach(function (im, i) { im.position.copy(sN.position).lerp(cele[i].position, L.petla(t * 0.7 + i * 0.33, 1)); });
        impO.position.copy(sO.position).lerp(cel, L.petla(t * 0.6, 1));
        zg.userData.wskazowka.rotation.z = -t * 2;
        chm.children.forEach(function (k, i) { k.position.x = k.userData.x0 + Math.sin(t * 0.3 + i) * 0.1; });   // z t: pauza = bezruch
      } };
  }

  // Pogoda (dwa spojrzenia) i basen: teleskop pod falującą wodą i nad nią.
  function zbudujBasen(c) {
    var T = c.THREE, g = new T.Group(), ZC = new T.Vector3(0, -31.2, 0);
    function grunt(x, z) { return new T.Vector3(x, -31.2 + Math.sqrt(900 - x * x - z * z) + 0.02, z); }
    // pogodowy na półce Clarke'a: stożek na cały kontynent
    var geo = satelita(c, { skala: 1.0, blask: 'granat' }); geo.position.set(-5.5, 7.4, -3); geo.lookAt(ZC); g.add(geo);
    var dl = 8.6, st = new T.Mesh(new T.ConeGeometry(4.2, dl, 48, 1, true), przezr(c, 'granat', 0.06, { side: T.DoubleSide }));
    st.position.set(-5.5, 7.4 - dl / 2, -3); g.add(st);
    // pogodowy nisko nad biegunami: mierzy warstwy powietrza z bliska
    var nis = satelita(c, { skala: 0.7 }); nis.position.set(-2.6, 1.9, 0.6); nis.lookAt(ZC); g.add(nis);
    var warstwy = [];
    [0.0, 0.45, 0.9].forEach(function (y, i) { var w = new T.Mesh(new T.CircleGeometry(0.55, 40), przezr(c, ['zar', 'zloto', 'granat'][i], 0.16, { side: T.DoubleSide })); w.rotation.x = -Math.PI / 2; w.position.set(-2.6, -0.3 + y, 0.6); g.add(w); warstwy.push(w); });
    var pomiar = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 2.1, 6), przezr(c, 'zar', 0.6)); pomiar.position.set(-2.6, 0.85, 0.6); g.add(pomiar);
    // basen: falująca woda (powietrze), teleskop na dnie i teleskop nad wodą, gwiazda wysoko
    var uniW = { uCzas: { value: 0 }, uKolor: { value: c.kolor('granat') }, uGora: { value: c.kolor('zar') } };
    var woda = new T.Mesh(new T.PlaneGeometry(5, 3.2, 90, 60), new T.ShaderMaterial({ uniforms: uniW, transparent: true, depthWrite: false, side: T.DoubleSide,
      vertexShader: 'uniform float uCzas; varying float vH; void main(){ vec3 p = position; float h = sin(p.x * 3.1 + uCzas * 1.7) * 0.05 + sin(p.y * 4.3 - uCzas * 1.3) * 0.04 + sin((p.x + p.y) * 7.0 + uCzas * 2.3) * 0.02; p.z += h; vH = h; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform vec3 uKolor; uniform vec3 uGora; varying float vH; void main(){ gl_FragColor = vec4(mix(uKolor * 0.6, uGora, smoothstep(0.03, 0.1, vH)), 0.32 + vH * 2.0); }' }));
    woda.rotation.x = -Math.PI / 2; woda.position.set(2.8, 1.0, 0); g.add(woda);
    function teleskop(kolor, r, dlT) { var t = new T.Group(); var tb = new T.Mesh(new T.CylinderGeometry(r, r, dlT, 24), new T.MeshPhongMaterial({ color: c.kolor(kolor), specular: 0xffffff, shininess: 60, emissive: c.kolor('linia') })); t.add(tb); var ot = new T.Mesh(new T.CircleGeometry(r * 0.85, 24), mat(c, 'pustka')); ot.rotation.x = -Math.PI / 2; ot.position.y = dlT / 2 + 0.001; t.add(ot); return t; }
    var dol = teleskop('atrament-3', 0.13, 0.5), dP = grunt(2.0, 0.3); dol.position.copy(dP).y += 0.25; dol.rotation.z = 0.12; g.add(dol);
    var gora = teleskop('atrament', 0.16, 0.9); gora.position.set(3.7, 2.15, 0); gora.rotation.z = 0.35; g.add(gora);
    [-1, 1].forEach(function (zn) { var p = new T.Mesh(new T.BoxGeometry(0.05, 0.6, 0.25), matL(c, 'zloto', { emissive: c.kolor('zloto-tlo') })); p.position.set(zn * 0.3, 0, 0); gora.add(p); });
    var gw = poswiata(c, 'zar', 0.7, 1); gw.position.set(2.6, 6.2, -2.4); g.add(gw);
    // „co widzi” każdy teleskop: tarcza z gwiazdą — pod wodą drży i się rozmywa, nad wodą stoi ostro
    function kadr(x, y) { var k = new T.Group(); k.position.set(x, y, 0.7); k.add(new T.Mesh(new T.CircleGeometry(0.34, 40), przezr(c, 'pustka', 0.85, { side: T.DoubleSide }))); var o = new T.Mesh(new T.RingGeometry(0.32, 0.35, 48), mat(c, 'atrament-3', { side: T.DoubleSide })); o.position.z = 0.002; k.add(o); var s = poswiata(c, 'zar', 0.18, 1); s.position.z = 0.01; k.add(s); k.userData.gw = s; g.add(k); return k; }
    var kD = c.doKamery(kadr(1.0, 0.35)), kG = c.doKamery(kadr(4.75, 2.6));
    return { grupa: g,
      etykiety: [
        { tekst: 'pogodowy na półce Clarke\'a: cały kontynent', cel: geo, kotwica: 'prawo', klasa: 'granat', dx: 10 },
        { tekst: 'pogodowy nisko nad biegunami: z bliska', cel: nis, kotwica: 'lewo', klasa: 'zar', dx: -10 },
        { tekst: 'z dna basenu: obraz drży', cel: kD, kotwica: 'dol', klasa: 'm', dy: 30 },
        { tekst: 'głowa nad wodą: ostro', cel: kG, kotwica: 'prawo', klasa: 'zar', dx: 30 },
        { tekst: 'powietrze jak woda w basenie', poz: [4.9, 1.0, 1.4], kotwica: 'prawo', klasa: 'granat', dx: 6 }
      ],
      krok: function (t) {
        uniW.uCzas.value = t;
        var s = kD.userData.gw; s.position.x = 0.07 * Math.sin(t * 5.3) + 0.04 * Math.sin(t * 11.1); s.position.y = 0.06 * Math.sin(t * 4.1 + 1); s.scale.setScalar(0.3 + 0.12 * Math.sin(t * 7.3)); s.material.opacity = 0.55 + 0.3 * Math.sin(t * 9);
        pomiar.position.x = -2.6 + 0.05 * Math.sin(t); warstwy.forEach(function (w, i) { w.material.opacity = 0.12 + 0.08 * Math.sin(t * 1.5 + i * 2); });
      } };
  }

  // Kapsuła z filmem na spadochronie i samolot, który łapie ją hakiem nad oceanem (rysunek poglądowy).
  function zbudujPrzechwyt(c) {
    var T = c.THREE, g = new T.Group();
    var uniO = { uCzas: { value: 0 }, uG: { value: c.kolor('granat-tlo') }, uJ: { value: c.kolor('granat') } };
    var ocean = new T.Mesh(new T.PlaneGeometry(90, 50, 160, 90), new T.ShaderMaterial({ uniforms: uniO,
      vertexShader: 'uniform float uCzas; varying float vH; varying vec3 vP; void main(){ vec3 p = position; float h = sin(p.x * 0.9 + uCzas * 0.8) * 0.06 + sin(p.y * 1.3 - uCzas * 0.6) * 0.05; p.z += h; vH = h; vP = p; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform vec3 uG; uniform vec3 uJ; varying float vH; varying vec3 vP; void main(){ float d = clamp(length(vP.xy) / 40.0, 0.0, 1.0); gl_FragColor = vec4(mix(uG * 1.4 + uJ * smoothstep(0.04, 0.11, vH) * 0.25, uG * 0.5, d), 1.0); }' }));
    ocean.rotation.x = -Math.PI / 2; g.add(ocean);
    // kapsuła i spadochron
    var kap = new T.Group();
    var korpus = new T.Mesh(new T.ConeGeometry(0.16, 0.26, 20), matL(c, 'atrament-2', { emissive: c.kolor('linia') })); korpus.rotation.x = Math.PI; kap.add(korpus);
    var czasza = new T.Mesh(new T.SphereGeometry(0.62, 28, 10, 0, TAU, 0, Math.PI / 2.4), new T.MeshLambertMaterial({ color: c.kolor('lak'), emissive: c.kolor('lak-tlo'), side: T.DoubleSide }));
    czasza.position.y = 0.72; kap.add(czasza);
    for (var i = 0; i < 6; i++) { var a = i / 6 * TAU; kap.add(linia(c, [new T.Vector3(0, 0.12, 0), new T.Vector3(0.5 * Math.cos(a), 0.92, 0.5 * Math.sin(a))], 'atrament-3', { krycie: 0.8 })); }
    g.add(kap);
    // samolot z hakiem
    var sam = new T.Group();
    var kad = new T.Mesh(new T.CylinderGeometry(0.13, 0.1, 2.0, 16), matL(c, 'atrament', { emissive: c.kolor('linia') })); kad.rotation.z = Math.PI / 2; sam.add(kad);
    var skr = new T.Mesh(new T.BoxGeometry(0.5, 0.03, 2.4), matL(c, 'atrament-2')); skr.position.x = 0.1; sam.add(skr);
    var ster = new T.Mesh(new T.BoxGeometry(0.3, 0.38, 0.03), matL(c, 'atrament-2')); ster.position.set(-0.9, 0.2, 0); sam.add(ster);
    var stb = new T.Mesh(new T.BoxGeometry(0.28, 0.03, 0.8), matL(c, 'atrament-2')); stb.position.set(-0.9, 0.05, 0); sam.add(stb);
    var HAK = new T.Vector3(-1.4, -0.45, 0);
    sam.add(linia(c, [new T.Vector3(-0.85, -0.05, 0), HAK], 'zloto', { krycie: 0.95 }));
    var hak = new T.Mesh(new T.TorusGeometry(0.07, 0.012, 6, 16, Math.PI), mat(c, 'zloto')); hak.position.copy(HAK); sam.add(hak);
    g.add(sam);
    // na niebie: satelita rozpoznawczy, stacja, kostka krótkofalowców
    var roz = satelita(c, { skala: 0.9 }); roz.position.set(-4.5, 9, -5); g.add(roz);
    var stoz = new T.Mesh(new T.ConeGeometry(1.4, 8.6, 32, 1, true), przezr(c, 'zloto', 0.04, { side: T.DoubleSide })); stoz.position.set(-4.5, 4.7, -5); g.add(stoz);
    var st = stacja(c, 0.7); st.position.set(5.5, 8.4, -7); g.add(st);
    var kost = new T.Mesh(new T.BoxGeometry(0.12, 0.12, 0.12), matL(c, 'atrament-2', { emissive: c.kolor('granat-tlo') })); kost.position.set(8, 6.6, -5); g.add(kost);
    var TC = 7, X0 = -9, V = 1.4, Y = 3.0;
    return { grupa: g,
      etykiety: [
        { tekst: 'kapsuła z filmem na spadochronie', cel: czasza, kotwica: 'prawo', klasa: 'lak', dx: 16 },
        { tekst: 'samolot łapie ją hakiem', cel: sam, kotwica: 'dol', klasa: 'zloto', dy: 18 },
        { tekst: 'nad oceanem', poz: [3, 0.1, 2.5], kotwica: 'dol', klasa: 'granat' },
        { tekst: 'rozpoznawczy: bardzo dobry aparat', cel: roz, kotwica: 'prawo', klasa: 'w', dx: 8 },
        { tekst: 'załogowe: tam ktoś mieszka', cel: st, kotwica: 'dol', klasa: 'w', dy: 10 },
        { tekst: 'studenckie i krótkofalowców', cel: kost, kotwica: 'prawo', klasa: 'm', dx: 8 }
      ],
      krok: function (t) {
        uniO.uCzas.value = t;
        var tt = L.petla(t, 12) * 12;
        sam.position.set(X0 + V * tt, Y + 0.05 * Math.sin(t * 1.3), 0); sam.rotation.x = 0.03 * Math.sin(t * 0.9);
        var xh = X0 + V * TC + HAK.x;
        if (tt < TC) { kap.position.set(xh, 1.4 + (7.2 - 1.4) * (1 - tt / TC), 0); czasza.scale.set(1, 1, 1); kap.rotation.z = 0.05 * Math.sin(t * 1.7); }
        else { kap.position.set(sam.position.x + HAK.x + 0.15, sam.position.y + HAK.y - 1.15 + 0.4 * L.odcinek(tt, TC, TC + 1), 0); var z = 1 - 0.75 * L.odcinek(tt, TC, TC + 0.6); czasza.scale.set(z, z, z); kap.rotation.z = -0.5 * L.odcinek(tt, TC, TC + 0.6); }
        st.rotation.y = t * 0.1;
      } };
  }

  // Od autobusu do kostki: duże w jednej grupie, małe powiększone (rozmiary nie w skali).
  function zbudujRozmiary(c) {
    var T = c.THREE, g = new T.Group();
    var podloga = new T.Mesh(new T.PlaneGeometry(28, 4), przezr(c, 'granat-tlo', 0.6, { side: T.DoubleSide })); podloga.rotation.x = -Math.PI / 2; podloga.position.set(1.5, -1.1, 0); g.add(podloga);
    function krawedzie(geo, kolor, o) { return new T.LineSegments(new T.EdgesGeometry(geo), new T.LineDashedMaterial(Object.assign({ color: c.kolor(kolor), dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.7 }, o || {}))); }
    // Hubble i autobus
    var hub = new T.Group(); hub.position.set(-6.5, 0, 0);
    var tub = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 2.7, 32), new T.MeshPhongMaterial({ color: c.kolor('atrament'), specular: 0xffffff, shininess: 70, emissive: c.kolor('linia') })); tub.rotation.z = Math.PI / 2; hub.add(tub);
    [-1, 1].forEach(function (zn) { var p = new T.Mesh(new T.BoxGeometry(0.06, 0.5, 1.6), matL(c, 'granat', { emissive: c.kolor('granat-tlo') })); p.position.set(0, 0, zn * 1.2); p.rotation.x = Math.PI / 2; hub.add(p); });
    g.add(hub);
    var bus = krawedzie(new T.BoxGeometry(3.0, 1.15, 1.0), 'atrament-3'); bus.computeLineDistances(); bus.position.set(-6.5, -0.4, 0); g.add(bus);
    // satelita łącznościowy i rozpiętość samolotu pasażerskiego
    var kom = new T.Group(); kom.position.set(-0.6, 0, 0);
    kom.add(new T.Mesh(new T.BoxGeometry(0.75, 0.75, 0.75), matL(c, 'zloto', { emissive: c.kolor('zloto-tlo') })));
    [-1, 1].forEach(function (zn) { for (var k = 0; k < 4; k++) { var p = new T.Mesh(new T.BoxGeometry(0.6, 0.02, 0.62), matL(c, 'granat', { emissive: c.kolor('granat-tlo') })); p.position.set(0, 0, zn * (0.75 + k * 0.68)); kom.add(p); } });
    var ant = new T.Mesh(new T.SphereGeometry(0.4, 20, 10, 0, TAU, 0, Math.PI / 3), matL(c, 'atrament', { side: T.DoubleSide })); ant.position.set(0.45, 0.2, 0); ant.rotation.z = -Math.PI / 2; kom.add(ant);
    g.add(kom);
    var skrz = linia(c, [new T.Vector3(-0.6, 1.3, -3.5), new T.Vector3(-0.6, 1.3, 3.5)], 'atrament-2', { kreski: [0.14, 0.1], krycie: 0.8 }); g.add(skrz);
    g.add(linia(c, [new T.Vector3(-2.2, 1.3, 0), new T.Vector3(1.1, 1.3, 0)], 'atrament-2', { kreski: [0.14, 0.1], krycie: 0.8 }));
    var skrzO = new T.Object3D(); skrzO.position.set(-0.6, 1.3, 3.5); g.add(skrzO);
    // granica powiększenia
    g.add(linia(c, [new T.Vector3(3.6, -1.1, 1.6), new T.Vector3(3.6, 2.2, 1.6)], 'atrament-3', { kreski: [0.1, 0.08], krycie: 0.8 }));
    var granica = new T.Object3D(); granica.position.set(3.6, 2.2, 1.6); g.add(granica);
    // kostki CubeSat: jedna, dwie, trzy, sześć (powiększone)
    var E = 0.42, kostki = new T.Group(); kostki.position.set(5.6, -0.4, 0);
    function kostka(nx, ny, nz, x) {
      var gr = new T.Group(); gr.position.x = x;
      var b = new T.Mesh(new T.BoxGeometry(E * nx, E * ny, E * nz), matL(c, 'atrament-3')); gr.add(b);
      var sc = new T.Mesh(new T.PlaneGeometry(E * nx * 0.86, E * ny * 0.86), matL(c, 'granat-tlo', { emissive: c.kolor('granat-tlo') })); sc.position.z = E * nz / 2 + 0.002; gr.add(sc);
      var kr = krawedzie(new T.BoxGeometry(E * nx, E * ny, E * nz), 'atrament', { opacity: 0.5, dashSize: 0.02, gapSize: 0.0001 }); kr.computeLineDistances(); gr.add(kr);
      kostki.add(gr); return gr;
    }
    var k1 = kostka(1, 1, 1, 0), k2 = kostka(1, 2, 1, 0.75), k3 = kostka(1, 3, 1, 1.5); var k6 = kostka(2, 3, 1, 2.55);
    g.add(kostki);
    var chip = new T.Group(); chip.position.set(9.6, -0.5, 0);
    chip.add(new T.Mesh(new T.BoxGeometry(0.28, 0.02, 0.28), matL(c, 'zloto', { emissive: c.kolor('zloto-tlo') })));
    chip.add(linia(c, [new T.Vector3(0.14, 0.01, 0), new T.Vector3(0.45, 0.01, 0.1)], 'zloto'));
    g.add(chip);
    return { grupa: g,
      etykiety: [
        { tekst: 'Hubble: wielkości autobusu', cel: hub, kotwica: 'gora', klasa: 'w', dy: -50 },
        { tekst: 'satelita łącznościowy', cel: kom, kotwica: 'dol', klasa: 'zloto', dy: 30 },
        { tekst: 'skrzydła: rozpiętość samolotu pasażerskiego', cel: skrzO, kotwica: 'prawo', klasa: 'm', dx: 8 },
        { tekst: 'od tego miejsca powiększone', cel: granica, kotwica: 'gora', klasa: 'm', dy: -6 },
        { tekst: 'CubeSat: kostka o boku dziesięciu centymetrów', cel: k1, kotwica: 'dol', klasa: 'w', dy: 36 },
        { tekst: 'dwie kostki, trzy, sześć', cel: k6, kotwica: 'gora', klasa: 'granat', dy: -40 },
        { tekst: 'chip wielkości znaczka pocztowego', cel: chip, kotwica: 'gora', klasa: 'zloto', dy: -10 }
      ],
      krok: function (t) {
        hub.rotation.x = t * 0.08; kom.rotation.y = 0.3 * Math.sin(t * 0.2);
        kostki.rotation.y = 0.25 * Math.sin(t * 0.25); chip.rotation.y = t * 0.3;
        [k1, k2, k3].forEach(function (k, i) { k.position.y = 0.04 * Math.sin(t + i); });
      } };
  }

  // Sto kostek z jednej rakiety rozchodzi się w rój; dziesięć gaśnie.
  function zbudujRoj(c) {
    var T = c.THREE, g = new T.Group(), N = 100, R = 2.5, W = 0.35, OKRES = 18;
    var rak = new T.Mesh(new T.CylinderGeometry(0.07, 0.08, 0.36, 16), matL(c, 'atrament', { emissive: c.kolor('linia') })); g.add(rak);
    g.add(orbita(c, R, 'atrament-3', { krycie: 0.3, n: 200 }));
    var im = new T.InstancedMesh(new T.BoxGeometry(0.065, 0.065, 0.065), new T.MeshLambertMaterial({ color: 0xffffff, emissive: c.kolor('linia') }), N);
    im.frustumCulled = false; g.add(im);
    var jasny = c.kolor('zloto'), ciemny = c.kolor('linia'), los = c.generator(1999), baza = [];
    var kolTmp = new T.Color();   // bufor koloru ściemnianych (bez alokacji co klatkę)
    for (var i = 0; i < N; i++) { baza.push({ tr: 0.3 + i * 0.035, d: (i / (N - 1) - 0.5) * 0.5, dy: (los() - 0.5) * 0.08, dr: (los() - 0.5) * 0.06, stracony: i % 10 === 3 }); im.setColorAt(i, jasny); }
    var dm = new T.Object3D(), strO = new T.Object3D(); g.add(strO);
    function kat(t) { return -0.9 + W * t; }
    return { grupa: g,
      etykiety: [
        { tekst: 'jedna rakieta, setki kostek', cel: rak, kotwica: 'prawo', klasa: 'w', dx: 10 },
        { tekst: 'rój stu zwykłych: cały ląd Ziemi codziennie', poz: [-2.4, 0.4, -1.4], kotwica: 'lewo', klasa: 'zloto', dx: -8 },
        { tekst: 'dziesięć można stracić bez płaczu', cel: strO, kotwica: 'dol', klasa: 'm', dy: 10 }
      ],
      krok: function (t) {
        var tt = L.petla(t, OKRES) * OKRES, th = kat(tt);
        rak.position.set(R * Math.cos(th), 0, -R * Math.sin(th)); rak.rotation.set(Math.PI / 2, th, 0);
        var ciemnieja = L.odcinek(tt, 10, 11.5);
        for (var i = 0; i < N; i++) {
          var b = baza[i], dt = Math.max(0, tt - b.tr), a = (tt < b.tr ? th : kat(b.tr) + (W + b.d) * dt), r = R + b.dr * Math.min(1, dt);
          dm.position.set(r * Math.cos(a), b.dy * Math.min(1, dt), -r * Math.sin(a));
          dm.rotation.set(dt * 0.7 + i, dt * 0.5, 0); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix);
          im.setColorAt(i, b.stracony && ciemnieja > 0 ? kolTmp.copy(jasny).lerp(ciemny, ciemnieja) : jasny);
          if (i === 33) strO.position.copy(dm.position);
        }
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      } };
  }

  // Śmieci: chmura (czynne, martwe, odłamki, drobiny) albo trzy losy (nisko spadają i płoną, wyżej zostają).
  function zbudujSmieci(c, tryb) {
    var T = c.THREE, g = new T.Group(), los = c.generator(tryb === 'chmura' ? 2000 : 2001);
    var POP = tryb === 'chmura' ? [
      { n: 260, kolor: 'zloto', rozmiar: 3.2, r: [2.15, 3.0], geo: 30 },
      { n: 150, kolor: 'atrament-3', rozmiar: 2.6, r: [2.15, 3.2], geo: 18 },
      { n: 1300, kolor: 'lak', rozmiar: 1.7, r: [2.12, 3.3], geo: 0 },
      { n: 4200, kolor: 'atrament-2', rozmiar: 1.0, r: [2.1, 3.4], geo: 0 }
    ] : [
      { n: 700, kolor: 'lak', rozmiar: 2.0, r: [2.12, 2.6], spada: true },
      { n: 320, kolor: 'atrament-2', rozmiar: 2.0, r: [2.9, 3.05] },
      { n: 150, kolor: 'atrament-3', rozmiar: 2.4, r: [5.4, 5.5] },
      { n: 90, kolor: 'atrament-3', rozmiar: 2.0, r: [5.9, 5.95] }
    ];
    var zbiory = POP.map(function (p) {
      var baza = [], pp = new Float32Array(p.n * 3), geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pp, 3));
      for (var i = 0; i < p.n; i++) {
        var naGeo = p.geo && i < p.geo, r = naGeo ? 5.5 : p.r[0] + Math.pow(los(), 1.6) * (p.r[1] - p.r[0]);
        var inc = naGeo ? 0 : (los() - 0.5) * 2.2, om = los() * TAU;
        // stałe orbity liczone raz (jak w naOrbicie): prędkość kątowa z promienia bazowego, sin/cos nachylenia i węzła
        baza.push({ r: r, th: los() * TAU, faza: los(), w: 0.9 * Math.pow(2.2 / r, 1.5),
          si: Math.sin(inc), ci: Math.cos(inc), so: Math.sin(om), co: Math.cos(om) });
      }
      var pts = new T.Points(geo, new T.PointsMaterial({ color: c.kolor(p.kolor), size: p.rozmiar, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending }));
      pts.frustumCulled = false; g.add(pts);
      return { p: p, baza: baza, pp: pp, geo: geo };
    });
    var etykiety, spalanie = null, szyba = null;
    if (tryb === 'chmura') {
      // szyba wahadłowca z kraterem na pierwszym planie; drobina farby wpada w nią raz na kilka sekund
      szyba = c.doKamery(new T.Group()); szyba.position.set(3.55, 1.95, 4.15); szyba.scale.setScalar(0.45);
      szyba.add(new T.Mesh(new T.PlaneGeometry(0.62, 0.38), przezr(c, 'granat', 0.16, { side: T.DoubleSide })));
      szyba.add(linia(c, [new T.Vector3(-0.31, -0.19, 0), new T.Vector3(0.31, -0.19, 0), new T.Vector3(0.31, 0.19, 0), new T.Vector3(-0.31, 0.19, 0), new T.Vector3(-0.31, -0.19, 0)], 'atrament-2', { krycie: 0.8 }));
      var krater = new T.Mesh(new T.RingGeometry(0.006, 0.022, 24), mat(c, 'atrament', { side: T.DoubleSide })); krater.position.set(0.05, 0.02, 0.003); szyba.add(krater);
      for (var p = 0; p < 6; p++) { var a = p / 6 * TAU + 0.3; szyba.add(linia(c, [new T.Vector3(0.05 + 0.02 * Math.cos(a), 0.02 + 0.02 * Math.sin(a), 0.003), new T.Vector3(0.05 + 0.06 * Math.cos(a), 0.02 + 0.06 * Math.sin(a), 0.003)], 'atrament', { krycie: 0.7 })); }
      var drob = poswiata(c, 'lak', 0.05, 1), blysk = poswiata(c, 'zar', 0.2, 0); szyba.add(drob, blysk); blysk.position.set(0.05, 0.02, 0.01);
      szyba.userData = { drob: drob, blysk: blysk };
      g.add(szyba);
      var aC = new T.Object3D(), aM = new T.Object3D(), aO = new T.Object3D(), aD = new T.Object3D(); g.add(aC, aM, aO, aD);
      zbiory[0].kotwica = aC; zbiory[1].kotwica = aM; zbiory[2].kotwica = aO; zbiory[3].kotwica = aD;
      etykiety = [
        { tekst: 'czynne: kilkanaście tysięcy', cel: aC, kotwica: 'prawo', klasa: 'zloto', dx: 8 },
        { tekst: 'martwe: tysiące', cel: aM, kotwica: 'lewo', klasa: 'w', dx: -8 },
        { tekst: 'odłamki: dziesiątki tysięcy', cel: aO, kotwica: 'prawo', klasa: 'lak', dx: 8 },
        { tekst: 'drobiny: niepoliczalne', cel: aD, kotwica: 'lewo', klasa: 'm', dx: -8 },
        { tekst: 'drobina farby i krater w szybie wahadłowca', cel: szyba, kotwica: 'gora', klasa: 'zar', dy: -40 },
        { tekst: 'każda pędzi kilkakrotnie szybciej niż kula z karabinu', poz: [-2.6, 2.4, 0], kotwica: 'lewo', klasa: 'm' }
      ];
    } else {
      // płomyki spalania: pula poświat na dolnym brzegu powietrza
      spalanie = [];
      for (var s = 0; s < 24; s++) { var sp = poswiata(c, s % 2 ? 'lak' : 'zar', 0.22, 0); g.add(sp); spalanie.push(sp); }
      g.add(orbita(c, 5.95, 'atrament-3', { krycie: 0.35, kreski: [0.15, 0.12], n: 240 }));
      etykiety = [
        { tekst: 'nisko: powietrze ściąga i spala', poz: [2.0, 0.9, 1.3], kotwica: 'prawo', klasa: 'lak', dx: 10 },
        { tekst: 'na dwóch tysiącach kilometrów: na stulecia', poz: [-2.1, 0.5, 2.2], kotwica: 'lewo', klasa: 'w', dx: -10 },
        { tekst: 'półka Clarke\'a: właściwie na zawsze', poz: [5.5, 0, 0], kotwica: 'prawo', klasa: 'm', dx: 10 },
        { tekst: 'cmentarzysko', poz: [-4.2, 0, -4.2], kotwica: 'lewo', klasa: 'm', dx: -6 }
      ];
    }

    return { grupa: g, etykiety: etykiety,
      krok: function (t) {
        var nSp = 0;
        zbiory.forEach(function (z, zi) {
          var b = z.baza, pp = z.pp;
          for (var i = 0; i < b.length; i++) {
            var bi = b[i], r = bi.r, th = bi.th + bi.w * t, f = 0;
            if (z.p.spada) { f = L.petla(t * 0.07 + bi.faza, 1); r = z.p.r[1] - (z.p.r[1] - 2.04) * Math.pow(f, 1.5); }
            // naOrbicie(r, th, inc, om) rozpisane na stałych z `baza` — bez tablicy i bez sin/cos kątów stałych
            var x = r * Math.cos(th), z0 = -r * Math.sin(th), zc = z0 * bi.ci;
            pp[i * 3] = x * bi.co + zc * bi.so; pp[i * 3 + 1] = -z0 * bi.si; pp[i * 3 + 2] = -x * bi.so + zc * bi.co;
            if (f > 0.985 && nSp < spalanie.length) { spalanie[nSp].position.set(pp[i * 3], pp[i * 3 + 1], pp[i * 3 + 2]); spalanie[nSp].material.opacity = 0.9; spalanie[nSp].userData.t = t; nSp++; }
          }
          z.geo.attributes.position.needsUpdate = true;
          if (z.kotwica) { var k = Math.min(b.length - 1, 5 + zi * 3); z.kotwica.position.set(pp[k * 3], pp[k * 3 + 1], pp[k * 3 + 2]); }
        });
        // płomyk gaśnie z czasem od zapłonu (×0,85 na 1/60 s), niezależnie od liczby klatek; powrót t wstecz = zgaszony
        if (spalanie) for (var s = nSp; s < spalanie.length; s++) {
          var tz = spalanie[s].userData.t; if (tz == null || tz > t) { spalanie[s].userData.t = tz = -Infinity; }
          spalanie[s].material.opacity = 0.9 * Math.pow(0.85, (t - tz) * 60);
        }
        if (szyba) {
          var u = L.petla(t, 3.2), d = szyba.userData;
          d.drob.position.set(0.05 - 0.5 * (1 - L.odcinek(u, 0, 0.3)), 0.02 + 0.12 * (1 - L.odcinek(u, 0, 0.3)), 0.25 * (1 - L.odcinek(u, 0, 0.3)) + 0.01);
          d.drob.material.opacity = u < 0.3 ? 1 : 0; d.blysk.material.opacity = u > 0.3 && u < 0.5 ? 1 - (u - 0.3) * 5 : 0;
        }
      } };
  }

  // Kaskada Kesslera: pokolenia zderzeń, każde zderzenie sypie odłamkami (liczby i tempo umowne).
  function zbudujKaskade(c) {
    var T = c.THREE, g = new T.Group(), los = c.generator(1978), R0 = 2.7, W0 = 0.42, NA_ZDERZENIE = 22;
    var harm = harmonogramKaskady(los, 7, 1.2, 2.6);
    var n0 = 70, pocz = [], pp0 = new Float32Array(n0 * 3), g0 = new T.BufferGeometry(); g0.setAttribute('position', new T.BufferAttribute(pp0, 3));
    for (var i = 0; i < n0; i++) pocz.push({ th: los() * TAU, dr: (los() - 0.5) * 0.3, inc: (los() - 0.5) * 0.25 });
    var p0 = new T.Points(g0, new T.PointsMaterial({ color: c.kolor('zloto'), size: 3, sizeAttenuation: false, transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending })); p0.frustumCulled = false; g.add(p0);
    var NF = harm.length * NA_ZDERZENIE, frag = [], ppf = new Float32Array(NF * 3), gf = new T.BufferGeometry(); gf.setAttribute('position', new T.BufferAttribute(ppf, 3));
    harm.forEach(function (z, k) { for (var j = 0; j < NA_ZDERZENIE; j++) frag.push({ z: k, dw: (los() - 0.5) * 0.5, dr: (los() - 0.5) * 0.35, inc: (los() - 0.5) * 0.5 }); });
    var pf = new T.Points(gf, new T.PointsMaterial({ color: c.kolor('lak'), size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending })); pf.frustumCulled = false; g.add(pf);
    var blyski = []; for (var b = 0; b < 24; b++) { var o = obrecz(c, 'zar'); g.add(o); blyski.push(o); }
    var aR = new T.Object3D(); g.add(aR);
    return { grupa: g,
      etykiety: [
        { tekst: '1978: zła bajka', poz: [0, 2.6, 0], kotwica: 'gora', klasa: 'w' },
        { tekst: 'każde zderzenie robi z dwóch rzeczy tysiąc', cel: aR, kotwica: 'prawo', klasa: 'lak', dx: 10 }
      ],
      // od kotwicy `zd.zderzenia` (pierwsze zderzenie; każdy krok kaskady ją ma — test) kaskada narasta raz i zostaje
      krok: function (t, z, zd) {
        var tt = t - zd.zderzenia + harm[0].t;
        for (var i = 0; i < n0; i++) { var q = naOrbicie(R0 + pocz[i].dr, pocz[i].th + W0 * tt, pocz[i].inc, 0); pp0[i * 3] = q[0]; pp0[i * 3 + 1] = q[1]; pp0[i * 3 + 2] = q[2]; }
        g0.attributes.position.needsUpdate = true;
        // odłamki dopisane w kolejności harmonogramu → widoczne to dokładnie pierwsze `ile`
        var ile = liczbaOdlamkow(harm, tt, NA_ZDERZENIE);
        for (var j = 0; j < ile; j++) {
          var f = frag[j], z = harm[f.z];
          var dt = tt - z.t, r = R0 + (z.r - 0.5) * 0.3 + f.dr * Math.min(1, dt * 0.8), th = z.kat + W0 * tt + f.dw * dt * 0.35;
          var q2 = naOrbicie(r, th, f.inc * Math.min(1, dt * 0.6) + (z.r - 0.5) * 0.2, 0);
          ppf[j * 3] = q2[0]; ppf[j * 3 + 1] = q2[1]; ppf[j * 3 + 2] = q2[2];
        }
        gf.attributes.position.needsUpdate = true; gf.setDrawRange(0, ile);
        var nb = 0;
        for (var k = 0; k < harm.length && nb < blyski.length; k++) {
          var w = tt - harm[k].t; if (w < 0 || w > 0.7) continue;
          var q3 = naOrbicie(R0 + (harm[k].r - 0.5) * 0.3, harm[k].kat + W0 * tt, (harm[k].r - 0.5) * 0.2, 0);
          blyski[nb].position.set(q3[0], q3[1], q3[2]); blyski[nb].scale.setScalar(0.1 + w * 0.9); blyski[nb].material.opacity = 1 - w / 0.7; nb++;
          aR.position.set(q3[0], q3[1], q3[2]);
        }
        for (; nb < blyski.length; nb++) blyski[nb].material.opacity = 0;
      },
      akcenty: function (tOd, tDo, zd) { return akcentyKaskady(harm, zd.zderzenia, tOd, tDo); } };
  }

  /* =====================================================================
     Źródło — jedno: artykuł (nie podaje linków do źródeł)
     ===================================================================== */
  var zrodla = [
    { opis: 'Bajarz, „Rodzaje sztucznych satelitów Ziemi”, opowieść z 16 października 2026. Jedyne źródło faktów, liczb, dat i nazwisk tej opowieści; artykuł nie podaje linków do źródeł, a liczby zaokrągla tak, żeby dało się je zobaczyć, nie żeby je cytować.' }
  ];

  var definicja = L.uzupelnijKroki({
    id: 'satelity',
    tytul: 'Rodzaje sztucznych satelitów Ziemi',
    pochodzenie: 'Na podstawie artykułu „Rodzaje sztucznych satelitów Ziemi” (opowiedział Bajarz, 16 października 2026). Liczby są zaokrąglone jak w artykule; tam, gdzie wiedza się kończy (ile jeszcze pokrąży Vanguard, co dokładnie robią satelity wojskowe, jak blisko progu Kesslera jesteśmy), opowieść mówi to wprost.',
    zrodla: zrodla,
    zestawy: zestawy,
    kroki: kroki,
    fizyka: { keplerE: keplerE, naElipsie: naElipsie, naOrbicie: naOrbicie, rzutNewtona: rzutNewtona, wCieniu: wCieniu,
      harmonogramKaskady: harmonogramKaskady, liczbaOdlamkow: liczbaOdlamkow, wSkali: wSkali, R_KM: R_KM,
      akcentyKaskady: akcentyKaskady, tonMolnii: tonMolnii, przelotLaki: przelotLaki, LAKA: LAKA, fazaKregu: fazaKregu, bipySputnika: bipySputnika, SPUTNIK: SPUTNIK },
    // pola, których krok nie podaje: większość scen dzieje się przy Ziemi o promieniu 2 w początku układu
    domyslne: { zestawy: ['gwiazdy', 'ziemia'], strefa: STREFA2 }
  });

  if (wNode) module.exports = definicja;
  else root.Zjawiska.rejestruj(definicja);
})(typeof self !== 'undefined' ? self : this);
