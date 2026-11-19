'use strict';
/* Zjawisko „Kosmiczny silnik grawitacyjny” — proces Penrose'a–Zeldowicza w 28 krokach.
   Treść (fakty, liczby, daty, nazwiska, cytaty) WYŁĄCZNIE z artykułu „Kosmiczny silnik grawitacyjny”
   (Czytelnia · Las, 18 listopada 2026); narracja w głosie Bajarza (druga osoba, obraz → sekret).
   Wszystkie sceny są SCHEMATAMI: tory, tempo, rozmiary i długości słupków są umowne — podpis każdego kroku
   mówi to wprost. Wykonanie kinowe: każdy krok ma `ujecie` (tor kamery, cel, FOV, czas, kompozycja) i `scena`
   (zmiana sceny = cięcie przez czerń); barwy dysku liczone względem kamery (Doppler poglądowy), a ugięcie
   światła gwiazd wokół horyzontu to przybliżenie soczewki punktowej w przestrzeni ekranu — nie ray-tracing. Jedyne wielkości w skali: Ryc. 5 (słupki liniowe 0,1 / 0,7 / 29%) i podział 29% / 71%.

   Układ sceny: y w górę, oś obrotu dziury = y, promień horyzontu = 1. Obrót „z prądem” = rosnący kąt φ
   w `pol(r, φ)` (przeciwnie do wskazówek zegara, patrząc z góry — jak na Ryc. 2 artykułu).
   Plik dual-export: w node zwraca samą definicję (dane kroków) dla testów; w przeglądarce rejestruje się
   w `Zjawiska` i buduje sceny leniwie przez `ctx` z widok.js. */
(function (root) {
  var wNode = (typeof module !== 'undefined' && module.exports);
  var L = wNode ? require('./logika.js') : root.ZjawiskaLogika;

  var TAU = Math.PI * 2;
  var RE = 1.95;                     // promień równikowy ergosfery (horyzont = 1; proporcja jak na Ryc. 1)
  var K_SVG = RE / 130;              // przelicznik współrzędnych Ryc. 2 (SVG) → scena

  /* =====================================================================
     Narzędzia budowy scen (wołane tylko w przeglądarce, z ctx.THREE)
     ===================================================================== */
  var R = wNode ? require('./rysunek.js') : root.ZjawiskaRysunek;   // wspólne prymitywy scen (zjawiska/rysunek.js)
  var pol = R.pol, mat = R.mat, matL = R.matL, przezr = R.przezr, linia = R.linia, okrag = R.okrag,
    rura = R.rura, poswiata = R.poswiata, kula = R.kula, skieruj = R.skieruj, grot = R.grot;
  // Fala ze skrętem jako helisa wzdłuż lokalnej osi x (0..dl). „Bieg” fali = obrót helisy wokół osi
  // (statyczna geometria, zero realokacji). skret = +1 / −1 (strona skrętu), kier = +1 gdy fala biegnie ku +x.
  function fala(c, o) {
    var T = c.THREE, pts = [], n = Math.round(o.zwoje * 28), k = TAU * o.zwoje / o.dl;
    for (var i = 0; i <= n; i++) { var x = o.dl * i / n; pts.push(new T.Vector3(x, Math.cos(k * x) * o.amp, Math.sin(k * x) * o.amp * o.skret)); }
    var g = new T.Group();
    var h = rura(c, pts, o.grubosc || 0.03, o.kolor, { odcinki: n * 2 });
    h.add(rura(c, h.userData.krzywa, (o.grubosc || 0.03) * 3.2, o.kolor, { odcinki: n * 2, mat: { transparent: true, opacity: 0.14, depthWrite: false, blending: T.AdditiveBlending } }));
    g.add(h);
    var kier = o.kier == null ? 1 : o.kier;
    var gr = grot(c, o.kolor, 0.16 + o.amp * 0.4);
    gr.position.set(kier > 0 ? o.dl + 0.18 : -0.18, 0, 0);
    skieruj(T, gr, new T.Vector3(kier, 0, 0));
    g.add(gr);
    g.userData = { helisa: h, skret: o.skret, kier: kier };
    return g;
  }
  function biegFali(g, t, predkosc) { var u = g.userData; u.helisa.rotation.x = -u.kier * u.skret * t * (predkosc || 3); }
  // Kręgi fali odbitej, rozchodzące się w płaszczyźnie równika.
  function kregi(c, n, kolor) {
    var T = c.THREE, g = new T.Group(), lista = [];
    for (var i = 0; i < n; i++) {
      var m = new T.Mesh(new T.TorusGeometry(1, 0.012, 6, 96), przezr(c, kolor, 0.5));
      m.rotation.x = Math.PI / 2;
      var h = new T.Group(); h.add(m); g.add(h); lista.push({ h: h, m: m });
    }
    g.userData.animuj = function (t, rMin, rMax, sila, gruboscMn) {
      for (var j = 0; j < n; j++) {
        var u = (t * 0.22 + j / n) % 1, r = rMin + (rMax - rMin) * u;
        lista[j].h.scale.set(r, (gruboscMn || 1) * 2, r);
        lista[j].m.material.opacity = sila * (1 - u) * (u < 0.08 ? u / 0.08 : 1);
      }
    };
    return g;
  }
  // Trzy helisy wokół osi y — „spiralny pasek na słupie fryzjerskim”.
  function falaWokol(c, r, h, kolor) {
    var T = c.THREE, g = new T.Group();
    for (var j = 0; j < 3; j++) {
      var pts = [];
      for (var i = 0; i <= 60; i++) { var s = i / 60; pts.push(pol(T, r, j * TAU / 3 + s * TAU * 1.25, -h / 2 + h * s)); }
      var w = rura(c, pts, 0.035, kolor, { odcinki: 120 });
      w.add(rura(c, w.userData.krzywa, 0.11, kolor, { odcinki: 120, mat: { transparent: true, opacity: 0.13, depthWrite: false, blending: T.AdditiveBlending } }));
      g.add(w);
    }
    return g;
  }
  // Pierścień z trzech obwodów (schemat zasady, nie rysunek układu z pracy).
  function budujPierscien(c, o) {
    var T = c.THREE; o = o || {};
    var g = new T.Group(), wezly = [], swiatla = [], pokretla = [];
    var obrecz = new T.Mesh(new T.TorusGeometry(1, 0.045, 10, 96), matL(c, o.kolorObreczy || 'atrament-3'));
    obrecz.rotation.x = Math.PI / 2; g.add(obrecz);
    for (var i = 0; i < 3; i++) {
      var fi = Math.PI / 2 - i * TAU / 3;                       // 1 u góry (z tyłu), 2 i 3 zgodnie z Ryc. 3
      var w = new T.Group(); w.position.copy(pol(T, 1, fi, 0.02));
      w.add(new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.14, 24), matL(c, 'linia')));
      var rant = new T.Mesh(new T.TorusGeometry(0.2, 0.016, 6, 32), mat(c, 'zloto')); rant.rotation.x = Math.PI / 2; rant.position.y = 0.07; w.add(rant);
      var sw = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.02, 24), mat(c, 'zloto-tlo')); sw.position.y = 0.085; w.add(sw);
      var pk = new T.Mesh(new T.BoxGeometry(0.2, 0.025, 0.035), mat(c, 'zar')); pk.position.y = 0.1; w.add(pk);
      g.add(w); wezly.push(w); swiatla.push(sw); pokretla.push(pk);
    }
    var wzor = new T.Group();
    wzor.add(okrag(c, 1.4, 'granat', { kreski: [0.14, 0.11], y: 0.04 }));
    var gr = grot(c, 'granat', 0.17); gr.position.copy(pol(T, 1.4, 0, 0.04)); skieruj(T, gr, new T.Vector3(0, 0, -1)); wzor.add(gr);
    g.add(wzor);
    var ciemny = c.kolor('zloto-tlo'), jasny = c.kolor('zar');
    var stan = {};
    var api = {
      grupa: g, wezly: wezly, wzor: wzor,
      ustaw: function (u) {
        stan.wzor = !!u.wzor; stan.kolysanie = !!u.kolysanie; stan.predkosc = u.predkosc == null ? 1.4 : u.predkosc;
        wzor.visible = stan.wzor;
        var p = u.pozycja || [0, 0, 0]; g.position.set(p[0], p[1], p[2]);
        var s = u.skala || 1; g.scale.set(s, s, s);
        if (!stan.kolysanie) for (var j = 0; j < 3; j++) { swiatla[j].material.color.copy(ciemny); pokretla[j].rotation.y = 0; }
      },
      animuj: function (t) {
        if (stan.wzor) wzor.rotation.y = t * stan.predkosc;
        if (stan.kolysanie) for (var j = 0; j < 3; j++) {
          // ten sam rytm dostrajania, każdy obwód przesunięty względem sąsiada — maksimum biegnie za grotem wzoru
          var v = 0.5 + 0.5 * Math.cos(t * stan.predkosc - (Math.PI / 2 - j * TAU / 3));
          swiatla[j].material.color.copy(ciemny).lerp(jasny, v * v);
          pokretla[j].rotation.y = (v - 0.5) * 1.6;
        }
      }
    };
    api.ustaw(o);
    return api;
  }
  // Para fal nad pierścieniem w układzie „V”: wejściowa schodzi z lewej góry, odbita odchodzi w prawą górę
  // (obie w płaszczyźnie ekranu, więc widać ich skręt i wysokość). ampWy / skretWy opisują falę odbitą.
  function faleV(c, rodzic, srodek, o) {
    var T = c.THREE, K = 68 * Math.PI / 180, kx = Math.cos(K), ky = Math.sin(K), A = o.amp || 0.15, dlWe = o.dlWe || 2.2, dlWy = o.dlWy || 2.4;
    var we = fala(c, { dl: dlWe, amp: A, zwoje: 4, skret: 1, kolor: 'atrament', kier: 1 });
    we.rotation.z = -K; we.position.set(srodek[0] - (dlWe + 0.5) * kx, srodek[1] + (dlWe + 0.5) * ky, srodek[2]);
    var wy = fala(c, { dl: dlWy, amp: A * o.ampWy, zwoje: 4, skret: o.skretWy == null ? -1 : o.skretWy, kolor: o.kolorWy || 'zar', kier: 1, grubosc: o.ampWy > 1 ? 0.045 : 0.03 });
    wy.rotation.z = K; wy.position.set(srodek[0] + 0.45 * kx, srodek[1] + 0.45 * ky, srodek[2]);
    rodzic.add(we, wy);
    return { we: we, wy: wy };
  }
  // Kropki energii płynące po krzywej (zasilanie → pierścień).
  function przeplyw(c, krzywa, n, kolor) {
    var g = new c.THREE.Group(), lista = [];
    for (var i = 0; i < n; i++) { var k = kula(c, 0.045, kolor); g.add(k); lista.push(k); }
    g.userData.animuj = function (t, v) { for (var j = 0; j < n; j++) krzywa.getPoint((t * (v || 0.25) + j / n) % 1, lista[j].position); };
    return g;
  }
  function bezier(T, a, b, d, e) {   // krzywa z punktów Ryc. 2 (współrzędne SVG → płaszczyzna równika)
    var f = function (p) { return new T.Vector3((p[0] - 340) * K_SVG, 0.02, (p[1] - 180) * K_SVG); };
    return new T.CubicBezierCurve3(f(a), f(b), f(d), f(e));
  }

  /* =====================================================================
     Zestawy wspólne dla wielu kroków
     ===================================================================== */
  var zestawy = {
    // Pole gwiazd z głębią (90–350 j., paralaksa przy ruchu kamery) + poglądowe soczewkowanie: gwiazdy są
    // odpychane od rzutu środka dziury jak przez soczewkę punktową (b → b + RE²/b), w przestrzeni ekranu.
    gwiazdy: function (c) {
      var T = c.THREE, los = c.generator(1963), n = 2600;
      var p = new Float32Array(n * 3), kol = new Float32Array(n * 3), roz = new Float32Array(n), faza = new Float32Array(n);
      var barwy = [c.kolor('atrament'), c.kolor('zar'), c.kolor('granat'), c.kolor('lak')];
      for (var i = 0; i < n; i++) {
        var u = los() * 2 - 1, a = los() * TAU, r = 90 + los() * 260, s = Math.sqrt(1 - u * u), w = los();
        p[i * 3] = r * s * Math.cos(a); p[i * 3 + 1] = r * u; p[i * 3 + 2] = r * s * Math.sin(a);
        var b = barwy[w < 0.66 ? 0 : (w < 0.85 ? 1 : (w < 0.97 ? 2 : 3))], j = 0.4 + 0.6 * los();
        kol[i * 3] = b.r * j; kol[i * 3 + 1] = b.g * j; kol[i * 3 + 2] = b.b * j;
        roz[i] = (1.5 + Math.pow(los(), 7) * 4.5) * (1 + (350 - r) / 350 * 0.7); faza[i] = los() * TAU;
      }
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('aKolor', new T.BufferAttribute(kol, 3));
      g.setAttribute('aRozmiar', new T.BufferAttribute(roz, 1)); g.setAttribute('aFaza', new T.BufferAttribute(faza, 1));
      var uni = { uCzas: { value: 0 }, uJasnosc: { value: 1 }, uSoczewka: { value: 0 }, uRE: { value: 0 }, uAspekt: { value: 2.39 }, uPx: { value: 1 }, uSrodek: { value: new T.Vector2() } };
      var m = new T.ShaderMaterial({ uniforms: uni, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: [
          'attribute vec3 aKolor; attribute float aRozmiar; attribute float aFaza;',
          'uniform float uCzas; uniform float uJasnosc; uniform float uSoczewka; uniform float uRE; uniform float uAspekt; uniform float uPx; uniform vec2 uSrodek;',
          'varying vec3 vKolor; varying float vA;',
          'void main(){',
          '  vec4 q = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '  if (uSoczewka > 0.5 && q.w > 0.0) {',
          '    vec2 d = (q.xy / q.w - uSrodek) * vec2(uAspekt, 1.0);',
          '    float b = max(length(d), 1e-4);',
          '    d *= (b + uRE * uRE / b) / b;',
          '    q.xy = (uSrodek + d / vec2(uAspekt, 1.0)) * q.w;',
          '  }',
          '  gl_Position = q; gl_PointSize = aRozmiar * uPx; vKolor = aKolor;',
          '  vA = uJasnosc * (0.72 + 0.28 * sin(uCzas * 1.1 + aFaza));',
          '}'].join('\n'),
        fragmentShader: [
          'varying vec3 vKolor; varying float vA;',
          'void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vKolor * vA * smoothstep(0.5, 0.08, r), 1.0); }'].join('\n') });
      var pts = new T.Points(g, m); pts.frustumCulled = false;
      var gr = new T.Group(); gr.add(pts);
      var soczewka = false, promien = 1, srodek = new T.Vector3(), v = new T.Vector3();
      return { grupa: gr,
        ustaw: function () { soczewka = false; uni.uSoczewka.value = 0; uni.uJasnosc.value = 1; },
        soczewkuj: function (wl, poz, r) { soczewka = !!wl; if (poz) srodek.fromArray(poz); else srodek.set(0, 0, 0); promien = r || 1; },
        jasnosc: function (x) { uni.uJasnosc.value = x; },
        animuj: function (t) {
          var k = c.kamera, rz = c.rozmiar();
          uni.uCzas.value = t; uni.uAspekt.value = rz.w / rz.h; uni.uPx.value = rz.dpr * rz.h / 536;
          uni.uSoczewka.value = soczewka ? 1 : 0;
          if (soczewka) {
            v.copy(srodek).project(k); uni.uSrodek.value.set(v.x, v.y);
            var d = k.position.distanceTo(srodek);
            uni.uRE.value = 0.64 * promien / (d * Math.tan(k.fov * Math.PI / 360));   // 2·RE ≈ 1,28 promienia cienia
          }
        } };
    },

    // Pył wokół dziury: drobiny porwane w obrót (tempo umowne) — daje scenie głębię i kierunek wiru.
    pyl: function (c) {
      var T = c.THREE, los = c.generator(1969), n = 420, baza = [], poz = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) { var r = 2.4 + Math.pow(los(), 0.7) * 8; baza.push([r, los() * TAU, (los() - 0.5) * 0.28 * r]); }
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(poz, 3));
      var pts = new T.Points(geo, new T.PointsMaterial({ color: c.kolor('zloto'), size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.42, depthWrite: false, blending: T.AdditiveBlending }));
      pts.frustumCulled = false;
      var g = new T.Group(); g.add(pts);
      return { grupa: g, animuj: function (t) {
        for (var i = 0; i < n; i++) {
          var b = baza[i], fi = b[1] + t * 0.5 * Math.pow(2.4 / b[0], 1.5);
          poz[i * 3] = b[0] * Math.cos(fi); poz[i * 3 + 1] = b[2]; poz[i * 3 + 2] = -b[0] * Math.sin(fi);
        }
        geo.attributes.position.needsUpdate = true;
      } };
    },

    // Horyzont (czarny cień + cienki świetlisty obrys), oś obrotu, strzałki kierunku obrotu.
    dziura: function (c) {
      var T = c.THREE, g = new T.Group();
      g.add(new T.Mesh(new T.SphereGeometry(1, 48, 32), mat(c, 'pustka')));
      g.add(new T.Mesh(new T.SphereGeometry(1.04, 48, 32), mat(c, 'zar', { side: T.BackSide })));
      var cv = document.createElement('canvas'); cv.width = cv.height = 128;
      var x = cv.getContext('2d'), gr = x.createRadialGradient(64, 64, 8, 64, 64, 64), z = c.kolor('zloto');
      var rgb = Math.round(z.r * 255) + ',' + Math.round(z.g * 255) + ',' + Math.round(z.b * 255);
      gr.addColorStop(0, 'rgba(' + rgb + ',.22)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      var posw = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false }));
      posw.scale.set(8, 8, 1); g.add(posw);
      var os = linia(c, [new T.Vector3(0, -3.4, 0), new T.Vector3(0, 3.4, 0)], 'atrament-3', { kreski: [0.06, 0.14] });
      g.add(os);
      var strz = new T.Group();
      for (var k = 0; k < 2; k++) {
        var pts = [], f0 = k * Math.PI;
        for (var i = 0; i <= 24; i++) pts.push(pol(T, 2.7, f0 + i / 24 * 1.25, 0));
        strz.add(rura(c, pts, 0.02, 'zloto'));
        var gt = grot(c, 'zloto', 0.16), fk = f0 + 1.25;
        gt.position.copy(pol(T, 2.7, fk + 0.04, 0)); skieruj(T, gt, new T.Vector3(-Math.sin(fk), 0, -Math.cos(fk))); strz.add(gt);
      }
      g.add(strz);
      var api = { grupa: g, strzalki: strz, predkosc: 0.5, kat: 0,
        ustaw: function (o) {
          os.visible = !!o.os; strz.visible = !!o.strzalki; api.predkosc = o.predkosc == null ? 0.5 : o.predkosc;
          var s = o.rStrzalek || 1; strz.scale.set(s, 1, s);
          c.zestaw('gwiazdy').soczewkuj(true, [0, 0, 0], 1);        // gwiazdy tła uginają się wokół horyzontu (poglądowo)
        },
        animuj: function (t, dt) { api.kat += api.predkosc * dt; strz.rotation.y = api.kat; }
      };
      return api;
    },

    // Dysk rozgrzanej materii (shader addytywny): złoto→żar ku środkowi, smugi płynące z obrotem, a barwa stron
    // liczona WZGLĘDEM KAMERY — strona, która leci ku widzowi, jest granatowa i jaśniejsza, uciekająca lakowa
    // i ciemniejsza (Doppler poglądowy, konwencja Ryc. 1). Nad cieniem łuk „dalekiej strony dysku” ugiętej przez
    // dziurę — billboard poglądowy, nie ray-tracing.
    dysk: function (c) {
      var T = c.THREE, g = new T.Group();
      var uni = { uCzas: { value: 0 }, uGranat: { value: c.kolor('granat') }, uZar: { value: c.kolor('zar') }, uZloto: { value: c.kolor('zloto') }, uLak: { value: c.kolor('lak') } };
      var WSPOLNE = [
        'uniform float uCzas; uniform vec3 uGranat; uniform vec3 uZar; uniform vec3 uZloto; uniform vec3 uLak;',
        'vec3 barwa(float I, float beta){',
        '  vec3 k = mix(uZloto, uZar, clamp(I, 0.0, 1.0));',
        '  k = mix(k, uGranat, smoothstep(0.0, 0.9, beta) * 0.8);',
        '  k = mix(k, uLak, smoothstep(0.0, 0.9, -beta) * 0.8);',
        '  return k * (1.0 + 0.75 * beta);',
        '}'].join('\n');
      var mDysk = new T.ShaderMaterial({ uniforms: uni, transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
        vertexShader: 'varying vec2 vP; varying vec3 vW; void main(){ vP = position.xy; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: [WSPOLNE,
          'varying vec2 vP; varying vec3 vW;',
          'void main(){',
          '  float r = length(vP), fi = atan(vP.y, vP.x);',
          '  vec3 tg = vec3(-sin(fi), 0.0, -cos(fi));                      // kierunek ruchu materii (obrót „z prądem”)',
          '  float beta = dot(tg, normalize(cameraPosition - vW));        // > 0: leci ku kamerze',
          '  float I = pow(2.25 / r, 2.6);',
          '  float w = uCzas * 0.9 * pow(2.3 / r, 1.5);',
          '  float sm = 0.62 + 0.38 * sin((fi - w) * 7.0 + r * 9.0) * sin((fi - w) * 19.0 - r * 15.0);',
          '  float brzeg = smoothstep(2.25, 2.45, r) * (1.0 - smoothstep(3.5, 4.6, r));',
          '  gl_FragColor = vec4(barwa(I, beta) * (0.25 + 0.95 * I) * sm * brzeg, 1.0);',
          '}'].join('\n') });
      var dysk = new T.Mesh(new T.RingGeometry(2.25, 4.6, 180, 20), mDysk); dysk.rotation.x = -Math.PI / 2; g.add(dysk);
      // łuk nad cieniem: obraz dalekiej strony dysku (poglądowo)
      var uniL = { uSila: { value: 0 }, uZar: uni.uZar, uZloto: uni.uZloto, uGranat: uni.uGranat, uLak: uni.uLak, uCzas: uni.uCzas };
      var luk = new T.Mesh(new T.RingGeometry(1.1, 1.62, 96, 6, 0, Math.PI), new T.ShaderMaterial({ uniforms: uniL, transparent: true, depthWrite: false, depthTest: false, side: T.DoubleSide, blending: T.AdditiveBlending,
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [WSPOLNE, 'uniform float uSila; varying vec2 vP;',
          'void main(){ float r = length(vP), a = atan(vP.y, vP.x) / 3.14159265;',
          '  float prof = smoothstep(1.1, 1.18, r) * (1.0 - smoothstep(1.2, 1.5, r)) * pow(sin(a * 3.14159265), 1.5);',
          '  gl_FragColor = vec4(barwa(0.8, (0.5 - a) * 1.2) * prof * uSila, 1.0); }'].join('\n') }));
      luk.renderOrder = 3; g.add(luk);
      // „płynięcie” dysku: jasne drobiny krążące szybciej bliżej środka (tempo umowne)
      var los = c.generator(7), n = 320, baza = [], poz = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) baza.push([2.3 + los() * 2.05, los() * TAU, (los() - 0.5) * 0.05]);
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(poz, 3));
      var drob = new T.Points(geo, new T.PointsMaterial({ color: c.kolor('zar'), size: 1.9, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending }));
      drob.frustumCulled = false; g.add(drob);
      var q = new T.Quaternion(), goraK = new T.Vector3(), OSZ = new T.Vector3(0, 0, 1);
      return { grupa: g, animuj: function (t) {
        uni.uCzas.value = t;
        for (var i = 0; i < n; i++) {
          var b = baza[i], fi = b[1] + t * 0.9 * Math.pow(2.3 / b[0], 1.5);
          poz[i * 3] = b[0] * Math.cos(fi); poz[i * 3 + 1] = b[2]; poz[i * 3 + 2] = -b[0] * Math.sin(fi);
        }
        geo.attributes.position.needsUpdate = true;
        // łuk stoi przodem do kamery, a jego „góra” = rzut osi obrotu dziury na ekran; im bardziej z boku patrzysz, tym mocniejszy
        var k = c.kamera, elew = Math.abs(k.position.y) / Math.max(k.position.length(), 1e-3);
        goraK.set(0, k.position.y >= 0 ? 1 : -1, 0).applyQuaternion(q.copy(k.quaternion).invert());
        luk.quaternion.copy(k.quaternion).multiply(q.setFromAxisAngle(OSZ, Math.atan2(-goraK.x, goraK.y)));
        uniL.uSila.value = 0.5 * Math.pow(1 - Math.min(1, elew * 1.6), 1.5);
      } };
    },

    // Ergosfera: spłaszczona skorupa — na równiku najgrubsza, na biegunach dotyka horyzontu.
    ergosfera: function (c) {
      var T = c.THREE, g = new T.Group(), czesci = [];
      var pow = new T.Mesh(new T.SphereGeometry(1, 48, 32), przezr(c, 'zloto', 0.1));
      pow.scale.set(RE, 1, RE); g.add(pow); czesci.push([pow.material, 0.1]);
      var siatka = new T.Group();
      [-0.75, -0.4, 0.4, 0.75].forEach(function (y) {
        var l = okrag(c, RE * Math.sqrt(1 - y * y), 'zloto', { kreski: [0.09, 0.09], krycie: 0.4, y: y }); siatka.add(l); czesci.push([l.material, 0.4]);
      });
      for (var k = 0; k < 4; k++) {
        var pts = [], a = k * Math.PI / 4;
        for (var i = 0; i <= 96; i++) { var th = i / 96 * TAU; pts.push(new T.Vector3(RE * Math.cos(th) * Math.cos(a), Math.sin(th), RE * Math.cos(th) * Math.sin(a))); }
        var l2 = linia(c, pts, 'zloto', { kreski: [0.09, 0.09], krycie: 0.4 }); siatka.add(l2); czesci.push([l2.material, 0.4]);
      }
      g.add(siatka);
      var rownik = okrag(c, RE, 'zloto', { kreski: [0.12, 0.1], krycie: 0.95 }); g.add(rownik); czesci.push([rownik.material, 0.95]);
      return { grupa: g, ustaw: function (o) {
        var kr = o.krycie == null ? 1 : o.krycie;
        czesci.forEach(function (x) { x[0].opacity = x[1] * kr; });
        siatka.visible = o.siatka !== false;
      } };
    },

    // Wleczenie układów odniesienia: siatka promieni skręcana tym mocniej, im bliżej dziury (tempo umowne).
    siatka: function (c) {
      var T = c.THREE, g = new T.Group(), NS = 28, NR = 36, R0 = 1.05, R1 = 8.5, OKRES = 14;
      var poz = new Float32Array(NS * (NR - 1) * 6);
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(poz, 3));
      var mLin = new T.LineBasicMaterial({ color: c.kolor('granat'), transparent: true, opacity: 0.6 });
      g.add(new T.LineSegments(geo, mLin));
      var mKol = [];
      [1.5, 2, 3, 4, 5, 6.5, 8.5].forEach(function (r) { var o = okrag(c, r, 'atrament-3', { krycie: 0.28 }); g.add(o); mKol.push(o.material); });
      var czastki = [[1.6, 0.4], [2.6, 2.6], [4.2, 4.6]].map(function (b) { var k = kula(c, 0.07, 'zar'); k.userData = { r: b[0], fi: b[1] }; g.add(k); return k; });
      function skret(r, tau) { return 0.9 * tau / Math.pow(r, 2.2); }
      var krycie = 1;
      return { grupa: g, czastki: czastki,
        ustaw: function (o) { krycie = o.krycie == null ? 1 : o.krycie; mKol.forEach(function (m) { m.opacity = 0.28 * krycie; }); czastki.forEach(function (k) { k.visible = o.czastki !== false; }); },
        animuj: function (t) {
          var f = L.petla(t, OKRES), tau = f * OKRES, k = 0;
          mLin.opacity = 0.6 * krycie * Math.min(1, f / 0.06, (1 - f) / 0.08);   // łagodne zawinięcie pętli
          for (var s = 0; s < NS; s++) {
            var fi0 = s / NS * TAU, px = 0, pz = 0;
            for (var i = 0; i < NR; i++) {
              var r = R0 + (R1 - R0) * Math.pow(i / (NR - 1), 1.6), fi = fi0 + skret(r, tau);
              var x = r * Math.cos(fi), z = -r * Math.sin(fi);
              if (i > 0) { poz[k++] = px; poz[k++] = 0; poz[k++] = pz; poz[k++] = x; poz[k++] = 0; poz[k++] = z; }
              px = x; pz = z;
            }
          }
          geo.attributes.position.needsUpdate = true;
          czastki.forEach(function (cz) { cz.position.copy(pol(T, cz.userData.r, cz.userData.fi + skret(cz.userData.r, t), 0.03)); });
        } };
    },

    // Kamień Penrose'a: tory z Ryc. 2 (schemat, nie tor wyliczony z równań). faza f ∈ [0,1]:
    // 0–0.4 kamień wlatuje · 0.4 pęknięcie · 0.4–0.62 kawałek pod prąd wpada pod horyzont · 0.4–1 drugi ucieka.
    kamien: function (c) {
      var T = c.THREE, g = new T.Group();
      var kWe = bezier(T, [60, 44], [140, 44], [210, 62], [255, 95]);
      var kLak = bezier(T, [255, 95], [300, 82], [356, 100], [370, 124]);
      var kGr = bezier(T, [255, 95], [196, 124], [150, 214], [56, 302]);
      var tWe = rura(c, kWe, 0.022, 'atrament', { mat: { transparent: true, opacity: 0.8 } });
      var tLak = rura(c, kLak, 0.03, 'lak', { mat: { transparent: true, opacity: 0.9 } });
      var tGr = rura(c, kGr, 0.036, 'granat', { mat: { transparent: true, opacity: 0.9 } });
      g.add(tWe, tLak, tGr);
      function grotNa(krzywa, kolor, u) { var q = grot(c, kolor, 0.15); q.position.copy(krzywa.getPoint(u)); skieruj(T, q, krzywa.getTangent(u)); return q; }
      var gWe = grotNa(kWe, 'atrament', 0.62), gLak = grotNa(kLak, 'lak', 0.93), gGr = grotNa(kGr, 'granat', 0.97);
      g.add(gWe, gLak, gGr);
      var kam = new T.Mesh(new T.IcosahedronGeometry(0.13, 0), matL(c, 'atrament'));
      var kawL = new T.Mesh(new T.IcosahedronGeometry(0.09, 0), mat(c, 'lak'));
      var kawG = new T.Mesh(new T.IcosahedronGeometry(0.11, 0), mat(c, 'granat'));
      var iskra = kula(c, 0.12, 'zar', { transparent: true, opacity: 0.9, depthWrite: false });
      iskra.position.copy(kWe.getPoint(1));
      g.add(kam, kawL, kawG, iskra);
      var blask = poswiata(c, 'zar', 1.6, 0); blask.position.copy(iskra.position); g.add(blask);
      // iskry pęknięcia: rozbiegają się z punktu pęknięcia i gasną (cząstki addytywne)
      var NI = 70, losI = c.generator(1971), kier = [], pi = new Float32Array(NI * 3), gi = new T.BufferGeometry();
      for (var ii = 0; ii < NI; ii++) { var ai = losI() * TAU, vi = 0.25 + losI() * 0.9; kier.push([Math.cos(ai) * vi, (losI() - 0.3) * 0.5, Math.sin(ai) * vi]); }
      gi.setAttribute('position', new T.BufferAttribute(pi, 3));
      var iskry = new T.Points(gi, new T.PointsMaterial({ color: c.kolor('zar'), size: 2.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
      iskry.frustumCulled = false; g.add(iskry);
      var api = { grupa: g, kam: kam, kawL: kawL, kawG: kawG, pekniecie: kWe.getPoint(1), koniecGr: kGr.getPoint(1), f: 0,
        ustaw: function (o) { var w = o.tory !== 'we'; tLak.visible = gLak.visible = tGr.visible = gGr.visible = w; },
        faza: function (f) {
          api.f = f;
          kam.visible = f < 0.4; kawL.visible = f >= 0.4 && f < 0.62; kawG.visible = f >= 0.4;
          if (kam.visible) { kWe.getPoint(L.odcinek(f, 0, 0.4), kam.position); kam.rotation.set(f * 9, f * 13, 0); }
          if (kawL.visible) { kLak.getPoint(L.odcinek(f, 0.4, 0.62), kawL.position); var s = 1 - 0.7 * L.odcinek(f, 0.56, 0.62); kawL.scale.set(s, s, s); kawL.rotation.y = f * 20; }
          if (kawG.visible) { kGr.getPoint(L.odcinek(f, 0.4, 1), kawG.position); kawG.rotation.y = f * 16; }
          var b = 1 - Math.abs(f - 0.41) / 0.05;
          iskra.visible = b > 0; if (b > 0) { var r = 0.6 + 1.8 * b; iskra.scale.set(r, r, r); iskra.material.opacity = 0.85 * b; }
          blask.material.opacity = b > 0 ? 0.9 * b : 0;
          var ui = L.odcinek(f, 0.4, 0.56), p0 = api.pekniecie;
          iskry.visible = ui > 0 && ui < 1;
          if (iskry.visible) {
            for (var q = 0; q < NI; q++) { pi[q * 3] = p0.x + kier[q][0] * ui; pi[q * 3 + 1] = p0.y + kier[q][1] * ui; pi[q * 3 + 2] = p0.z + kier[q][2] * ui; }
            gi.attributes.position.needsUpdate = true; iskry.material.opacity = 0.95 * (1 - ui);
          }
        } };
      api.faza(0);
      return api;
    },

    // Walec Zeldowicza: kręci się i pochłania fale; wokół fala ze skrętem (grzbiety jak pasek na słupie fryzjerskim).
    walec: function (c) {
      var T = c.THREE, g = new T.Group(), bryla = new T.Group();
      bryla.add(new T.Mesh(new T.CylinderGeometry(1, 1, 4.2, 48), matL(c, 'linia')));
      for (var i = 0; i < 8; i++) {
        var pas = new T.Mesh(new T.BoxGeometry(0.06, 4.2, 0.2), mat(c, 'zloto'));
        pas.position.copy(pol(T, 1.0, i / 8 * TAU, 0)); pas.rotation.y = i / 8 * TAU; bryla.add(pas);
      }
      [2.1, -2.1].forEach(function (y) { var o = new T.Mesh(new T.TorusGeometry(1, 0.03, 6, 64), mat(c, 'zloto')); o.rotation.x = Math.PI / 2; o.position.y = y; bryla.add(o); });
      var obserwator = kula(c, 0.09, 'zar'); obserwator.position.copy(pol(T, 1.06, 0.3, 0.6)); bryla.add(obserwator);
      g.add(bryla);
      var zar = new T.Mesh(new T.CylinderGeometry(1.03, 1.03, 4.22, 48, 1, true), przezr(c, 'lak', 0, { side: T.DoubleSide })); g.add(zar);
      var wokol = falaWokol(c, 1.75, 4.4, 'granat'); g.add(wokol);
      var kr = kregi(c, 5, 'zar'); g.add(kr);
      var s = {};
      return { grupa: g, obserwator: obserwator,
        ustaw: function (o) {
          s.wWalca = o.wWalca == null ? 0.5 : o.wWalca; s.wFali = o.wFali == null ? 1.1 : o.wFali;
          s.odbita = o.odbita || 'brak'; s.grzanie = o.grzanie || 0;
          obserwator.visible = !!o.obserwator; kr.visible = s.odbita !== 'brak';
          kr.children.forEach(function (h) { h.children[0].material.color.copy(c.kolor(s.odbita === 'silna' ? 'zar' : 'atrament-3')); });
        },
        animuj: function (t) {
          bryla.rotation.y = t * s.wWalca; wokol.rotation.y = t * s.wFali;
          zar.material.opacity = s.grzanie * (0.16 + 0.1 * Math.sin(t * 1.7));
          if (kr.visible) kr.userData.animuj(t, 1.9, s.odbita === 'silna' ? 5.4 : 3.6, s.odbita === 'silna' ? 0.95 : 0.4, s.odbita === 'silna' ? 2.6 : 1);
        } };
    },

    stol: function (c) {
      var T = c.THREE, g = new T.Group();
      var blat = new T.Mesh(new T.BoxGeometry(13, 0.16, 8.5), matL(c, 'arkusz')); blat.position.y = -0.14; g.add(blat);
      var pts = [];
      for (var i = -6; i <= 6; i++) { pts.push(new T.Vector3(i, -0.055, -4.25), new T.Vector3(i, -0.055, 4.25)); }
      for (var j = -4; j <= 4; j++) { pts.push(new T.Vector3(-6.5, -0.055, j), new T.Vector3(6.5, -0.055, j)); }
      var geo = new T.BufferGeometry().setFromPoints(pts);
      g.add(new T.LineSegments(geo, new T.LineBasicMaterial({ color: c.kolor('linia') })));
      g.add(linia(c, [new T.Vector3(-6.5, -0.055, -4.25), new T.Vector3(6.5, -0.055, -4.25), new T.Vector3(6.5, -0.055, 4.25), new T.Vector3(-6.5, -0.055, 4.25), new T.Vector3(-6.5, -0.055, -4.25)], 'zloto', { krycie: 0.7 }));
      return { grupa: g };
    },

    pierscien: function (c) { return budujPierscien(c, {}); }
  };

  /* =====================================================================
     Kroki
     ===================================================================== */
  var CZ1 = 'Część pierwsza · Wir, którego nie widać';
  var CZ2 = 'Część druga · Kamień, który pęka na dwoje';
  var CZ3 = 'Część trzecia · Walec, który musi tracić, żeby dawać';
  var CZ4 = 'Część czwarta · Nowy Jork, lipiec 2026 · Obrót, w którym nic się nie kręci';
  var CZ5 = 'Część piąta · Ile mieści się w obrocie';
  var CZ6 = 'Część szósta · Co ten eksperyment znaczy, a czego nie';

  var LICZNIK_ENERGII = 'Energia liczona z daleka';

  var kroki = [
    /* ---------- 1 ---------- */
    {
      czesc: CZ1, tytul: 'Wir na ciemnej wodzie',
      narracja: [
        'Zamknij oczy i zobacz wielką, ciemną wodę. Pośrodku kręci się wir.',
        'Rzucasz w niego liść. Liść nie płynie prosto: krąży coraz ciaśniej i coraz szybciej, aż znika w środku.',
        'Masz ten obraz? Dobrze. Zatrzymaj go pod powiekami, bo zaraz zabierzemy z niego wodę.'
      ],
      podpis: 'Wir na wodzie i liść. Obraz pomocniczy, rysunek poglądowy.',
      scena: 'woda',
      ujecie: { ruch: 'crane: zjazd znad tafli i najazd na wir', tor: [[0, 12, 14], [1.5, 8, 11.5], [2.5, 5, 9]], cel: [0, 0, 0], fov: 32, czas: 14, komp: [0.18, -0.08] }, tPogl: 6.2,
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group();
        var woda = new T.Mesh(new T.CircleGeometry(7.6, 96), mat(c, 'granat-tlo')); woda.rotation.x = -Math.PI / 2; g.add(woda);
        var wir = new T.Group();
        for (var a = 0; a < 6; a++) {
          var pts = [];
          for (var i = 0; i <= 70; i++) { var r = 7.4 * Math.pow(0.5 / 7.4, i / 70); pts.push(pol(T, r, a * TAU / 6 + 2.4 * Math.log(7.4 / r), 0.012)); }
          wir.add(rura(c, pts, 0.016, 'granat', { mat: { transparent: true, opacity: 0.45 }, odcinki: 140 }));
        }
        g.add(wir);
        var lej = new T.Mesh(new T.CircleGeometry(0.5, 48), mat(c, 'pustka')); lej.rotation.x = -Math.PI / 2; lej.position.y = 0.02; g.add(lej);
        g.add(okrag(c, 0.5, 'granat', { y: 0.025, krycie: 0.8 }));
        var lisc = new T.Mesh(new T.SphereGeometry(1, 16, 10), mat(c, 'zloto')); lisc.scale.set(0.3, 0.035, 0.14); g.add(lisc);
        var N = 70, sl = new Float32Array(N * 3), geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(sl, 3));
        g.add(new T.Line(geo, new T.LineBasicMaterial({ color: c.kolor('zar'), transparent: true, opacity: 0.75 })));
        function tor(u, cel) { var r = 0.32 + 6.3 * Math.pow(1 - u, 1.2); return cel.copy(pol(T, r, 0.6 + 11 * Math.pow(u, 1.7), 0.06)); }
        var tmp = new T.Vector3();
        return { grupa: g, lisc: lisc, etykiety: [{ tekst: 'liść', cel: lisc, klasa: 'zar' }],
          krok: function (t) {
            wir.rotation.y = t * 0.3;
            var f = L.petla(t, 11), u = L.odcinek(f, 0.04, 0.9);
            tor(u, lisc.position); lisc.rotation.y = 0.6 + 11 * Math.pow(u, 1.7) + Math.PI / 2;
            var s = 1 - L.odcinek(u, 0.93, 1); lisc.visible = s > 0.02; lisc.scale.set(0.3 * s, 0.035, 0.14 * s);
            for (var i = 0; i < N; i++) { tor(Math.max(0, u - i * 0.0035), tmp); sl[i * 3] = tmp.x; sl[i * 3 + 1] = 0.03; sl[i * 3 + 2] = tmp.z; }
            geo.attributes.position.needsUpdate = true;
          } };
      },
      etykiety: [{ tekst: 'wir', poz: [0.9, 0.05, 0.9], kotwica: 'prawo', klasa: 'granat' }],
    },

    /* ---------- 2 ---------- */
    {
      czesc: CZ1, tytul: 'Zabierz wodę, zostaw sam ruch',
      narracja: [
        'Teraz zabierz wodę i zostaw sam ruch. Patrz na siatkę: to nie gaz ani pył, to sama czasoprzestrzeń, którą wirująca czarna dziura miesza swoim obrotem.',
        'Wszystko, co znajdzie się blisko, zostaje porwane w ten sam obrót: gwiazdy, gaz, sonda, a nawet światło.',
        'Fizycy nazywają to wleczeniem układów odniesienia. Po angielsku mówi się frame dragging, dosłownie: wleczenie ramek.'
      ],
      podpis: 'Wleczenie układów odniesienia. Schemat: siatka i tempo jej skręcania są umowne, nie wyliczone z równań.',
      scena: 'dziura',
      ujecie: { ruch: 'orbita 50° nisko nad siatką przestrzeni', tor: [[-4.86, 5.0, 10.42], [0.0, 5.0, 11.5], [4.86, 5.0, 10.42]], cel: [0, 0, 0], fov: 32, czas: 18, komp: [-0.28, 0] }, tPogl: 5.5,
      zestawy: ['gwiazdy', 'pyl', 'dziura', 'siatka'],
      zbuduj: function (c) {
        var s = c.zestaw('siatka');
        return { etykiety: [{ tekst: 'światło', cel: s.czastki[0], klasa: 'zar' }, { tekst: 'sonda', cel: s.czastki[1], klasa: 'zar' }, { tekst: 'gaz', cel: s.czastki[2], klasa: 'zar' }] };
      },
      etykiety: [{ tekst: 'wirująca\nczarna dziura', poz: [0, 0, 0], kotwica: 'srodek', klasa: 'm' }]
    },

    /* ---------- 3 ---------- */
    {
      czesc: CZ1, tytul: 'Wirująca czarna dziura',
      narracja: [
        'Obejdź ją wzrokiem. W środku czarny cień: horyzont zdarzeń. Wokół leży spłaszczony dysk rozgrzanej materii; z jednej strony materia nadbiega ku tobie, z drugiej ucieka.',
        'Przerywana linia to ergosfera, do niej zaraz wrócimy. Taki obiekt opisał w 1963 roku Roy Kerr, kiedy znalazł rozwiązanie równań Einsteina dla dziury, która się obraca.',
        'I teraz teza, którą sprawdzisz na własne oczy: to nie tylko pułapka, to także koło zamachowe. A z koła zamachowego da się brać energię.'
      ],
      podpis: 'Ryc. 1. Wirująca czarna dziura z boku. Rysunek poglądowy, nie w skali; ugięcie światła gwiazd i łuk dysku nad cieniem przybliżone.',
      przypisy: [1],
      scena: 'dziura',
      ujecie: { ruch: 'dolly-in po łuku, kamera tuż nad płaszczyzną dysku', tor: [[-5, 1.5, 15], [-2.5, 1.25, 12.5], [0, 1.1, 11]], cel: [0, 0.1, 0], fov: [30, 26], czas: 16, komp: [0.14, 0] },
      zestawy: ['gwiazdy', 'dziura', 'dysk', 'ergosfera'],
      ustaw: function (c, z) { z.dziura.ustaw({ os: true }); z.ergosfera.ustaw({ krycie: 0.9 }); },
      etykiety: [
        { tekst: 'horyzont zdarzeń', poz: [-0.72, 0.72, 0], kotwica: 'lewo', dx: -34, dy: -46 },
        { tekst: 'ergosfera', poz: [1.5, 0.64, 0], kotwica: 'prawo', dx: 30, dy: -40, klasa: 'zloto' },
        { tekst: 'dysk rozgrzanej materii', poz: [-2.6, -0.05, 2.4], kotwica: 'dol', dy: 12 },
        { tekst: 'oś obrotu', poz: [0, 3.3, 0], kotwica: 'prawo', klasa: 'm' },
        { tekst: 'materia nadbiega', poz: [-4.5, 0.1, 0], kotwica: 'gora', klasa: 'granat' },
        { tekst: 'materia ucieka', poz: [4.5, 0.1, 0], kotwica: 'gora', klasa: 'lak' }
      ]
    },

    /* ---------- 4 ---------- */
    {
      czesc: CZ1, tytul: 'Ten sam efekt tuż nad twoją głową',
      narracja: [
        'Wróć na chwilę do domu. Ziemia też się obraca, więc ten sam efekt działa i tutaj, tylko jest znikomy.',
        'Nad tobą krąży satelita Gravity Probe B, a w nim żyroskopy. Zmierzył, że obracająca się Ziemia przekręca ich oś o mniej więcej jedną stutysięczną stopnia na rok.',
        'W scenie widzisz to przekręcenie ogromnie powiększone, bo prawdziwego nie dostrzegłbyś wcale. Ten sam wir, tylko ledwie tchnienie.'
      ],
      podpis: 'Gravity Probe B nad Ziemią. Przekręcenie osi żyroskopu ogromnie wyolbrzymione; rysunek poglądowy, nie w skali.',
      przypisy: [2],
      scena: 'ziemia',
      ujecie: { ruch: 'orbita wokół Ziemi i powiększonego żyroskopu', tor: [[-3, 0.6, 12.5], [0, 1, 11.3], [1.6, 1.2, 10.4]], cel: [0.9, 0.3, 0], fov: 34, czas: 14, komp: [0, 0] }, tPogl: 7.5,
      zestawy: ['gwiazdy'],
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group();
        var ziemia = new T.Group(); ziemia.position.set(-1.6, 0, 0);
        ziemia.add(new T.Mesh(new T.SphereGeometry(1.5, 40, 28), matL(c, 'granat-tlo', { emissive: c.kolor('granat-tlo') })));
        var siatka = new T.Group();
        [-1.1, -0.6, 0, 0.6, 1.1].forEach(function (y) { siatka.add(okrag(c, Math.sqrt(1.505 * 1.505 - y * y), 'granat', { y: y, krycie: y === 0 ? 0.8 : 0.4 })); });
        for (var k = 0; k < 6; k++) { var pts = [], a = k * Math.PI / 6; for (var i = 0; i <= 64; i++) { var th = i / 64 * TAU; pts.push(new T.Vector3(1.505 * Math.cos(th) * Math.cos(a), 1.505 * Math.sin(th), 1.505 * Math.cos(th) * Math.sin(a))); } siatka.add(linia(c, pts, 'granat', { krycie: 0.35 })); }
        ziemia.add(siatka);
        ziemia.add(linia(c, [new T.Vector3(0, -2.1, 0), new T.Vector3(0, 2.1, 0)], 'atrament-3', { kreski: [0.06, 0.12] }));
        var orb = []; for (var j = 0; j <= 96; j++) { var q = j / 96 * TAU; orb.push(new T.Vector3(2.35 * Math.cos(q), 2.35 * Math.sin(q), 0)); }
        ziemia.add(linia(c, orb, 'atrament-3', { krycie: 0.7 }));
        var sat = new T.Group();
        sat.add(new T.Mesh(new T.BoxGeometry(0.2, 0.14, 0.14), mat(c, 'atrament')));
        var panel = new T.Mesh(new T.BoxGeometry(0.05, 0.5, 0.16), mat(c, 'granat')); sat.add(panel);
        ziemia.add(sat); g.add(ziemia);
        // żyroskop w powiększeniu
        var zy = new T.Group(); zy.position.set(4.1, 0.2, 0);
        zy.add(new T.Mesh(new T.SphereGeometry(0.5, 28, 20), matL(c, 'linia')));
        var ob = new T.Mesh(new T.TorusGeometry(0.72, 0.025, 6, 64), mat(c, 'zloto')); ob.rotation.x = Math.PI / 2; zy.add(ob);
        var KIER = new T.Vector3(0.25, 1, 0).normalize();
        zy.add(linia(c, [KIER.clone().multiplyScalar(-1.2), KIER.clone().multiplyScalar(2.9)], 'atrament-3', { kreski: [0.08, 0.1] }));
        var gw = kula(c, 0.06, 'atrament'); gw.position.copy(KIER.clone().multiplyScalar(2.95)); zy.add(gw);
        var osG = new T.Group();
        var pret = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 3.4, 8), mat(c, 'zar')); pret.position.y = 0.5; osG.add(pret);
        var gt = grot(c, 'zar', 0.2); gt.position.y = 2.3; osG.add(gt);
        var czub = new T.Object3D(); czub.position.y = 2.5; osG.add(czub);
        zy.add(osG); g.add(zy);
        var lacz = new Float32Array(6), gl = new T.BufferGeometry(); gl.setAttribute('position', new T.BufferAttribute(lacz, 3));
        g.add(new T.Line(gl, new T.LineBasicMaterial({ color: c.kolor('atrament-3'), transparent: true, opacity: 0.6 })));
        var OS_Z = new T.Vector3(0, 0, 1), qB = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), KIER), qO = new T.Quaternion(), w = new T.Vector3();
        return { grupa: g,
          etykiety: [
            { tekst: 'Gravity Probe B', cel: sat, klasa: 'w' },
            { tekst: 'oś po latach\n(przekręcenie wyolbrzymione)', cel: czub, kotwica: 'lewo', klasa: 'zar', dx: -6, dy: -12 },
            { tekst: 'kierunek początkowy', cel: gw, kotwica: 'prawo', klasa: 'm' }
          ],
          krok: function (t) {
            siatka.rotation.y = t * 0.3;
            var q = t * 0.45; sat.position.set(2.35 * Math.cos(q), 2.35 * Math.sin(q), 0); sat.rotation.z = q;
            var odch = -0.55 * L.wygladz(L.odcinek(L.petla(t, 10), 0.08, 0.8));
            osG.quaternion.copy(qO.setFromAxisAngle(OS_Z, odch)).multiply(qB);
            sat.getWorldPosition(w); lacz[0] = w.x; lacz[1] = w.y; lacz[2] = w.z; lacz[3] = 3.5; lacz[4] = 0.2; lacz[5] = 0;
            gl.attributes.position.needsUpdate = true;
          } };
      },
      etykiety: [
        { tekst: 'Ziemia', poz: [-1.6, -1.6, 0], kotwica: 'dol', klasa: 'granat' },
        { tekst: 'żyroskop (w powiększeniu)', poz: [4.1, -0.7, 0], kotwica: 'dol' }
      ],
    },

    /* ---------- 5 ---------- */
    {
      czesc: CZ1, tytul: 'Pod prąd, a jednak z prądem',
      narracja: [
        'Wsiadasz do statku z najmocniejszymi silnikami we wszechświecie. Daleko od dziury możesz jeszcze zawisnąć w miejscu, jak ten pierwszy statek.',
        'Teraz zejdź niżej, za przerywaną granicę. Celujesz dokładnie pod prąd i dajesz pełny ciąg.',
        'A obserwator z daleka i tak widzi, że krążysz razem z dziurą. Za tą granicą bezruch przestaje być możliwy.'
      ],
      podpis: 'Granica, za którą nie da się stać w miejscu. Schemat, nie tor wyliczony z równań.',
      scena: 'dziura',
      ujecie: { ruch: 'dolly-zoom (vertigo) przy przekroczeniu granicy ergosfery', tor: [[-6, 2.2, 7], [-3.2, 1.6, 4.2]], cel: [0, 0, 0], fov: 22, czas: 12, komp: [0.2, 0], dollyZoom: true }, tPogl: 4,
      zestawy: ['gwiazdy', 'pyl', 'dziura', 'siatka', 'ergosfera'],
      ustaw: function (c, z) { z.dziura.ustaw({ strzalki: true }); z.siatka.ustaw({ krycie: 0.4, czastki: false }); z.ergosfera.ustaw({ krycie: 0.7, siatka: false }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group();
        function statek() {
          var s = new T.Group(), kadlub = new T.Mesh(new T.ConeGeometry(0.11, 0.42, 12), mat(c, 'atrament')); s.add(kadlub);
          var plomien = new T.Mesh(new T.ConeGeometry(0.06, 0.5, 10), przezr(c, 'zloto', 0.8, { blending: T.AdditiveBlending })); plomien.rotation.z = Math.PI; plomien.position.y = -0.46; s.add(plomien);
          s.userData.plomien = plomien; g.add(s); return s;
        }
        var A = statek(), B = statek(), kier = new T.Vector3();
        function ustaw(s, r, fi, ciag, t) {
          s.position.copy(pol(T, r, fi, 0.06));
          skieruj(T, s, kier.set(Math.sin(fi), 0, Math.cos(fi)));          // dziób pod prąd (przeciwnie do obrotu)
          var dl = ciag * (0.9 + 0.2 * Math.sin(t * 23));
          s.userData.plomien.scale.set(1, dl, 1); s.userData.plomien.position.y = -0.21 - 0.25 * dl;
        }
        return { grupa: g,
          etykiety: [
            { tekst: 'tu jeszcze możesz\nstać w miejscu', cel: A, kotwica: 'gora', klasa: 'w', dy: -10 },
            { tekst: 'pełny ciąg pod prąd,\na i tak krążysz z dziurą', cel: B, kotwica: 'gora', klasa: 'zar', dy: -6 }
          ],
          krok: function (t) { ustaw(A, 3.7, 2.75, 0.5, t); ustaw(B, 1.5, 2.3 + t * 0.33, 1.9, t); } };
      },
      etykiety: [{ tekst: 'granica bezruchu', poz: [-1.38, 0, 1.38], kotwica: 'lewo', klasa: 'zloto', dy: 10 }],
    },

    /* ---------- 6 ---------- */
    {
      czesc: CZ1, tytul: 'Ergosfera',
      narracja: [
        'Ten obszar ma imię: ergosfera. Spójrz na jej kształt.',
        'Owija horyzont jak spłaszczona skorupa: na równiku jest najgrubsza, na biegunach dotyka horyzontu.',
        'Nazwa pochodzi od greckiego ergon, czyli praca. Dziwne imię dla miejsca, w którym nie da się stanąć, prawda? Za chwilę zobaczysz, skąd się wzięło.'
      ],
      podpis: 'Ergosfera i horyzont widziane z boku. Rysunek poglądowy, nie w skali.',
      scena: 'dziura',
      ujecie: { ruch: 'orbita 40° na wysokości równika', tor: [[-4.25, 0.8, 7.36], [-1.33, 0.8, 8.4], [1.77, 0.8, 8.31]], cel: [0, 0, 0], fov: 30, czas: 14, komp: [-0.25, 0] },
      zestawy: ['gwiazdy', 'pyl', 'dziura', 'ergosfera'],
      ustaw: function (c, z) { z.dziura.ustaw({ os: true }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), pts = [];
        for (var i = 0; i <= 96; i++) { var a = i / 96 * TAU; pts.push(new T.Vector3(RE * Math.cos(a), Math.sin(a), 0)); }
        g.add(rura(c, pts, 0.014, 'zloto', { zamknieta: true }));
        var miara = rura(c, [new T.Vector3(1.04, 0, 0.02), new T.Vector3(RE, 0, 0.02)], 0.03, 'zar'); g.add(miara);
        [[0, 1, 0], [0, -1, 0]].forEach(function (p) { var k = kula(c, 0.06, 'zar'); k.position.fromArray(p); g.add(k); });
        return { grupa: g };
      },
      etykiety: [
        { tekst: 'horyzont zdarzeń', poz: [0, 0, 1], kotwica: 'srodek', klasa: 'm' },
        { tekst: 'ergosfera', poz: [-1.38, 0.72, 0], kotwica: 'lewo', klasa: 'zloto', dx: -10, dy: -12 },
        { tekst: 'na równiku najgrubsza', poz: [RE, 0, 0], kotwica: 'prawo', klasa: 'zar', dx: 6 },
        { tekst: 'na biegunach dotyka horyzontu', poz: [0, 1, 0], kotwica: 'prawo', klasa: 'zar', dx: 10, dy: -14 }
      ]
    },

    /* ---------- 7 ---------- */
    {
      czesc: CZ1, tytul: 'Jeszcze nie pułapka',
      narracja: [
        'Zatrzymaj się na moment, bo obraz z wodą ma swoje granice. Patrz na niebieską sondę: wlatuje w ergosferę, daje się porwać i wylatuje z powrotem.',
        'Ergosfera to jeszcze nie pułapka, z niej da się uciec. Prawdziwy próg bez powrotu, horyzont zdarzeń, leży głębiej.',
        'Druga sonda go przekracza i już jej nie zobaczysz. Trzyma ci się ten obraz?'
      ],
      ramka: { typ: 'nota', etykieta: 'Gdzie porównanie przestaje działać',
        tekst: 'Przestrzeń nie jest wodą i nic w niej nie płynie jak w rzece. Wir to tylko obraz, który pomaga. Ale to, co zobaczyłbyś przez okno statku, jest prawdziwe: w pewnym miejscu nie da się już stać w miejscu.' },
      podpis: 'Dwie sondy: jedna wraca z ergosfery, druga znika pod horyzontem. Schemat, nie tory wyliczone z równań.',
      scena: 'dziura',
      ujecie: { ruch: 'crane: z lotu ptaka do skosu', tor: [[0, 13, 3], [0, 10, 7], [0, 7, 9.5]], cel: [0, 0, 0.2], fov: 34, czas: 14, komp: [0.1, 0] }, tPogl: 4.2,
      zestawy: ['gwiazdy', 'pyl', 'dziura', 'ergosfera'],
      ustaw: function (c, z) { z.dziura.ustaw({ strzalki: true, rStrzalek: 1.2 }); z.ergosfera.ustaw({ krycie: 0.8, siatka: false }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), ST = Math.PI / 180;
        function tor(lista) { return new T.CatmullRomCurve3(lista.map(function (p) { return pol(T, p[0], p[1] * ST, 0.03); })); }
        var kA = tor([[6, 196], [3.9, 212], [2.5, 240], [1.72, 295], [1.5, 360], [1.72, 425], [2.5, 480], [3.9, 508], [6, 524]]);
        var kB = tor([[6, 14], [3.8, 44], [2.5, 92], [1.7, 150], [1.25, 205], [0.96, 250]]);
        g.add(rura(c, kA, 0.022, 'granat', { mat: { transparent: true, opacity: 0.7 }, odcinki: 160 }));
        g.add(rura(c, kB, 0.022, 'lak', { mat: { transparent: true, opacity: 0.7 }, odcinki: 120 }));
        var a = kula(c, 0.1, 'granat'), b = kula(c, 0.1, 'lak'); g.add(a, b);
        return { grupa: g,
          etykiety: [{ tekst: 'wraca: z ergosfery da się uciec', cel: a, klasa: 'granat', kotwica: 'dol', dy: 4 }, { tekst: 'znika pod horyzontem', cel: b, klasa: 'lak', kotwica: 'gora', dy: -4 }],
          krok: function (t) {
            var f = L.petla(t, 9);
            kA.getPoint(L.odcinek(f, 0.02, 0.98), a.position);
            var u = L.odcinek(f, 0.05, 0.7); kB.getPoint(u, b.position); b.visible = u < 0.995;
          } };
      },
    },

    /* ---------- 8 ---------- */
    {
      czesc: CZ2, tytul: 'Pytanie Penrose\'a',
      narracja: [
        'Jest rok 1969. Roger Penrose zadaje proste pytanie: skoro dziura się kręci, czy da się z tego kręcenia coś odebrać?',
        'Odpowiada eksperymentem myślowym, który wygląda jak sztuczka magika. Stajesz daleko od dziury i wysyłasz kamień w głąb ergosfery.',
        'Patrz, jak mija przerywaną linię. Zapamiętaj słupek na liczniku: tyle energii ma cały kamień.'
      ],
      podpis: 'Kamień wlatuje w ergosferę. Schemat, nie tor wyliczony z równań; długość słupka umowna.',
      przypisy: [3],
      scena: 'dziura',
      ujecie: { ruch: 'dolly-in zza pleców rzucającego, za kamieniem', tor: [[-9.8, 3.0, -5.6], [-8.6, 3.4, -4.4]], cel: [-0.5, 0, -0.6], fov: 30, czas: 12, komp: [0.2, 0] }, tPogl: 4.3,
      zestawy: ['gwiazdy', 'pyl', 'dziura', 'ergosfera', 'kamien'],
      ustaw: function (c, z) { z.dziura.ustaw({ strzalki: true, rStrzalek: 0.9 }); z.ergosfera.ustaw({ siatka: false }); z.kamien.ustaw({ tory: 'we' }); },
      zbuduj: function (c) { var k = c.zestaw('kamien'); return { etykiety: [{ tekst: 'kamień', cel: k.kam, klasa: 'w' }] }; },
      etykiety: [
        { tekst: 'tu stoisz i rzucasz', poz: [-4.2, 0, -2.04], kotwica: 'dol', klasa: 'm', dy: 6 },
        { tekst: 'ergosfera', poz: [1.4, 0, 1.4], kotwica: 'prawo', klasa: 'zloto', dx: 4 },
        { tekst: 'horyzont', poz: [0, 0, 0], kotwica: 'srodek', klasa: 'm' },
        { tekst: 'obrót dziury', poz: [2.0, 0, -1.7], kotwica: 'prawo', klasa: 'zloto', dx: 8 }
      ],
      przyrzad: { tytul: LICZNIK_ENERGII, zakres: [-0.6, 1.6], zero: '0', wiersze: [{ etykieta: 'cały kamień', kolor: 'atrament' }] },
      animuj: function (c, t, w, z) { z.kamien.faza(Math.min(0.395, L.petla(t, 6.5) * 0.5)); c.przyrzad([1]); }
    },

    /* ---------- 9 ---------- */
    {
      czesc: CZ2, tytul: 'Pęknięcie',
      narracja: [
        'Teraz zwolnij czas. W środku ergosfery kamień pęka na dwa kawałki.',
        'To nie przypadek: pęknięcie jest starannie zaplanowane. Jeden kawałek rusza pod prąd wiru, w stronę horyzontu. Drugi zostaje odrzucony na zewnątrz.',
        'Widzisz oba? Nie spuszczaj z oka tego czerwonawego.'
      ],
      podpis: 'Pęknięcie kamienia w ergosferze, zbliżenie. Schemat, nie tor wyliczony z równań.',
      scena: 'dziura',
      ujecie: { ruch: 'rack-focus: zbliżenie na pęknięcie, tło gaśnie', tor: [[-3.9, 2.6, 1.6], [-3.0, 2.0, 0.6]], cel: [-1.0, 0, -1.1], fov: [32, 30], czas: 12, komp: [-0.1, 0], tlo: [1, 0.22] }, tPogl: 4.4,
      zestawy: ['gwiazdy', 'pyl', 'dziura', 'ergosfera', 'kamien'],
      ustaw: function (c, z) { z.dziura.ustaw({ strzalki: true, rStrzalek: 0.9 }); z.ergosfera.ustaw({ siatka: false }); },
      zbuduj: function (c) {
        var k = c.zestaw('kamien');
        return { etykiety: [
          { tekst: 'pod prąd, ku horyzontowi', cel: k.kawL, klasa: 'lak' },
          { tekst: 'odrzucony na zewnątrz', cel: k.kawG, klasa: 'granat', kotwica: 'lewo' },
          { tekst: 'kamień', cel: k.kam, klasa: 'w' }
        ] };
      },
      etykiety: [{ tekst: 'pęknięcie', poz: [-1.275, 0, -1.275], kotwica: 'gora', klasa: 'zar', dy: -14 }],
      animuj: function (c, t, w, z) { z.kamien.faza(0.3 + L.petla(t, 8) * 0.3); }
    },

    /* ---------- 10 ---------- */
    {
      czesc: CZ2, tytul: 'Energia mniejsza od zera',
      narracja: [
        'Gdzie jest sekret? W tym, jak liczysz energię: mierzysz ją z daleka, ze swojego miejsca.',
        'Poza ergosferą każda rzecz, którą znasz, ma energię dodatnią. Tu przestrzeń jest wleczona tak mocno, że kawałek rzucony pod prąd może mieć energię mniejszą od zera.',
        'Spójrz na licznik: czerwonawy słupek przeszedł na drugą stronę zera. Kawałek nie jest zrobiony z niczego dziwnego. To miejsce zmienia zasady liczenia.'
      ],
      podpis: 'Kawałek z ujemną energią wpada pod horyzont. Schemat; długości słupków licznika umowne.',
      scena: 'dziura',
      ujecie: { ruch: 'orbita za kawałkiem lecącym pod prąd', tor: [[-2.6, 2.8, 2.8], [-0.8, 3.0, 3.3], [0.9, 2.6, 3.2]], cel: [-0.2, 0, -0.8], fov: 34, czas: 12, komp: [-0.22, 0], tlo: 0.5 }, tPogl: 3.2,
      zestawy: ['gwiazdy', 'pyl', 'dziura', 'ergosfera', 'kamien'],
      ustaw: function (c, z) { z.dziura.ustaw({ strzalki: true, rStrzalek: 0.9 }); z.ergosfera.ustaw({ siatka: false }); },
      zbuduj: function (c) { var k = c.zestaw('kamien'); return { etykiety: [{ tekst: 'energia mniejsza od zera', cel: k.kawL, klasa: 'lak' }] }; },
      etykiety: [{ tekst: 'horyzont', poz: [0, 0, 0], kotwica: 'srodek', klasa: 'm' }],
      przyrzad: { tytul: LICZNIK_ENERGII, zakres: [-0.6, 1.6], zero: '0', wiersze: [
        { etykieta: 'cały kamień, zanim pękł', kolor: 'atrament' }, { etykieta: 'kawałek rzucony pod prąd', kolor: 'lak' }] },
      animuj: function (c, t, w, z) {
        var f = L.petla(t, 7);
        z.kamien.faza(0.4 + L.odcinek(f, 0.08, 0.85) * 0.22);
        c.przyrzad([1, -0.35 * L.wygladz(L.odcinek(f, 0.08, 0.3))]);
      }
    },

    /* ---------- 11 ---------- */
    {
      czesc: CZ2, tytul: 'Rachunek się zamyka',
      narracja: [
        'Teraz cały trik naraz, z góry. Energia kamienia to suma energii obu kawałków. Jeśli jeden ma mniej niż zero, drugi musi mieć więcej niż całość.',
        'Kawałek z ujemną energią wpada pod horyzont, a dziura traci odrobinę masy i odrobinę obrotu. Kręci się minimalnie wolniej.',
        'Drugi kawałek wraca do ciebie i niesie nadwyżkę: kawałek jej wirowania. Zgadza ci się rachunek na liczniku?'
      ],
      podpis: 'Ryc. 2. Proces Penrose\'a widziany z góry, nad równikiem dziury. Schemat, nie tor wyliczony z równań. Spowolnienie obrotu i długości słupków wyolbrzymione.',
      przypisy: [3],
      scena: 'dziura',
      ujecie: { ruch: 'crane: wzlot do widoku z góry', tor: [[-3, 4, 7], [-2, 8, 4.5], [-0.9, 10.2, 1.3]], cel: [-0.9, 0, 0], fov: 34, czas: 16, komp: [0.1, 0] }, tPogl: 7.4,
      zestawy: ['gwiazdy', 'pyl', 'dziura', 'ergosfera', 'kamien'],
      ustaw: function (c, z) { z.dziura.ustaw({ strzalki: true, predkosc: 1 }); z.ergosfera.ustaw({ siatka: false }); },
      etykiety: [
        { tekst: 'kamień wlatuje', poz: [-4.2, 0, -2.04], kotwica: 'dol', dy: 6 },
        { tekst: 'pęknięcie', poz: [-1.275, 0, -1.275], kotwica: 'gora', klasa: 'zar', dy: -12 },
        { tekst: 'ujemna energia:\nkawałek wpada\npod horyzont', poz: [0.3, 0, -1.45], kotwica: 'gora', klasa: 'lak', dy: -2 },
        { tekst: 'kawałek ucieka z większą energią,\nniż miał cały kamień', poz: [-3.2, 0, 1.0], kotwica: 'dol', klasa: 'granat', dy: 26 },
        { tekst: 'horyzont', poz: [0, 0, 0], kotwica: 'srodek', klasa: 'm' },
        { tekst: 'ergosfera', poz: [1.4, 0, 1.4], kotwica: 'prawo', klasa: 'zloto', dx: 4 },
        { tekst: 'obrót dziury', poz: [2.75, 0, -0.5], kotwica: 'prawo', klasa: 'zloto', dx: 8 }
      ],
      przyrzad: { tytul: LICZNIK_ENERGII, zakres: [-0.6, 1.6], zero: '0', wiersze: [
        { etykieta: 'cały kamień', kolor: 'atrament' }, { etykieta: 'kawałek pod horyzont', kolor: 'lak' },
        { etykieta: 'kawałek, który wraca', kolor: 'granat' }, { etykieta: 'obrót dziury', kolor: 'zloto' }] },
      animuj: function (c, t, w, z) {
        var f = L.petla(t, 10), ff = L.odcinek(f, 0.03, 0.95), po = ff >= 0.4 ? 1 : 0, wpadl = L.wygladz(L.odcinek(ff, 0.6, 0.68));
        z.kamien.faza(ff);
        z.dziura.predkosc = 1 - 0.45 * wpadl;
        c.przyrzad([1, -0.35 * po, 1.35 * po, 1.25 - 0.12 * wpadl]);
      }
    },

    /* ---------- 12 ---------- */
    {
      czesc: CZ2, tytul: 'Nic znikąd',
      narracja: [
        'Zatrzymaj się, bo to brzmi jak oszustwo. Nie jest.',
        'Patrz na dwa słupki: ile ubyło w obrocie dziury, tyle przybyło tobie.',
        'Nic nie bierze się znikąd. Energia zostaje tylko przełożona z jednej kieszeni do drugiej, a kieszenią dziury jest jej obrót.'
      ],
      ramka: { typ: 'teza', etykieta: 'Zasada',
        tekst: 'Nic nie bierze się znikąd. Proces Penrose\'a nie łamie zasady zachowania energii. Przekłada ją z jednej kieszeni do drugiej, a kieszenią dziury jest jej obrót.' },
      podpis: 'Dwie kieszenie energii: obrót dziury i twój zysk. Schemat; wielkość ubytku wyolbrzymiona, długości słupków umowne.',
      scena: 'dziura',
      ujecie: { ruch: 'orbita 30° wokół dziury i rzucającego', tor: [[-6.64, 4.5, 8.39], [-4.32, 4.5, 9.6], [-1.77, 4.5, 10.16]], cel: [-0.9, 0, 0.2], fov: 30, czas: 14, komp: [0.12, 0] }, tPogl: 8.6,
      zestawy: ['gwiazdy', 'pyl', 'dziura', 'ergosfera', 'kamien'],
      ustaw: function (c, z) { z.dziura.ustaw({ strzalki: true, rStrzalek: 0.9, predkosc: 1 }); z.ergosfera.ustaw({ krycie: 0.7 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), k = c.zestaw('kamien');
        var ty = kula(c, 0.13, 'atrament'); ty.position.copy(k.koniecGr); ty.position.x -= 0.3; ty.position.z += 0.25; g.add(ty);
        return { grupa: g, etykiety: [{ tekst: 'ty', cel: ty, klasa: 'w', kotwica: 'dol' }] };
      },
      etykiety: [{ tekst: 'kieszeń dziury: jej obrót', poz: [0, 1.25, 0], kotwica: 'gora', klasa: 'zloto' }],
      przyrzad: { tytul: 'Dwie kieszenie', zakres: [0, 1.5], wiersze: [
        { etykieta: 'kieszeń dziury: energia obrotu', kolor: 'zloto' }, { etykieta: 'twoja kieszeń: nadwyżka', kolor: 'granat' }] },
      animuj: function (c, t, w, z) {
        var f = L.petla(t, 10), ff = L.odcinek(f, 0.03, 0.9), s = L.wygladz(L.odcinek(ff, 0.6, 1));
        z.kamien.faza(ff); z.dziura.predkosc = 1 - 0.45 * L.wygladz(L.odcinek(ff, 0.6, 0.68));
        c.przyrzad([1.3 - 0.35 * s, 0.35 * s]);
      }
    },

    /* ---------- 13 ---------- */
    {
      czesc: CZ2, tytul: 'Miasto ze śmieciarkami',
      narracja: [
        'W 1971 roku Penrose i Raymond Floyd opisali, jak taki odbiór mógłby przebiegać. A w podręcznikach z lat siedemdziesiątych ktoś dorysował do tego całe miasto.',
        'Spójrz: pierścień domów wokół czarnej dziury. Śmieciarki zrzucają odpady w ergosferę, a miasto łapie kawałki, które wracają z nadwyżką energii.',
        'Chciałbyś tam mieszkać? To fantazja, ale fantazja z poprawnym rachunkiem.'
      ],
      podpis: 'Miasto wokół czarnej dziury. Fantazja z podręczników: rysunek poglądowy, nie w skali, tory umowne.',
      przypisy: [4],
      scena: 'dziura',
      ujecie: { ruch: 'crane: przelot nad miastem', tor: [[-9, 2.2, 9], [-5, 4.5, 10], [0, 6.2, 10.5]], cel: [0, 0, 0.3], fov: 34, czas: 16, komp: [0, -0.05] }, tPogl: 5.6,
      zestawy: ['gwiazdy', 'pyl', 'dziura', 'ergosfera'],
      ustaw: function (c, z) { z.dziura.ustaw({ strzalki: true, rStrzalek: 0.52 }); z.ergosfera.ustaw({ krycie: 0.8, siatka: false }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), los = c.generator(1971), RM = 4.5;
        var tor = new T.Mesh(new T.TorusGeometry(RM, 0.05, 8, 128), matL(c, 'atrament-3')); tor.rotation.x = Math.PI / 2; g.add(tor);
        var mDom = matL(c, 'linia'), mOkno = mat(c, 'zar');
        for (var i = 0; i < 46; i++) {
          var fi = i / 46 * TAU + los() * 0.05, h = 0.18 + los() * 0.55, w = 0.13 + los() * 0.1;
          var dom = new T.Mesh(new T.BoxGeometry(w, h, w), mDom); dom.position.copy(pol(T, RM + (los() - 0.5) * 0.25, fi, h / 2)); dom.rotation.y = fi; g.add(dom);
          if (los() > 0.45) { var ok = new T.Mesh(new T.BoxGeometry(0.035, 0.035, 0.035), mOkno); ok.position.copy(dom.position); ok.position.y = h * (0.4 + los() * 0.5); ok.position.x *= 0.975; ok.position.z *= 0.975; g.add(ok); }
        }
        var wozy = [];
        for (var k = 0; k < 3; k++) {
          var o = { fi: 0.5 + k * TAU / 3, faza: k / 3 };
          o.woz = new T.Mesh(new T.BoxGeometry(0.26, 0.14, 0.16), mat(c, 'zloto'));
          o.odpad = new T.Mesh(new T.IcosahedronGeometry(0.09, 0), mat(c, 'atrament'));
          o.lak = new T.Mesh(new T.IcosahedronGeometry(0.065, 0), mat(c, 'lak'));
          o.gr = new T.Mesh(new T.IcosahedronGeometry(0.08, 0), mat(c, 'granat'));
          o.blysk = kula(c, 0.16, 'zar', { transparent: true, opacity: 0, depthWrite: false });
          o.blysk.position.copy(pol(T, RM - 0.15, o.fi + 1.25, 0.1));
          g.add(o.woz, o.odpad, o.lak, o.gr, o.blysk); wozy.push(o);
        }
        function mix(a, b, u) { return a + (b - a) * u; }
        return { grupa: g,
          etykiety: [
            { tekst: 'śmieciarka', cel: wozy[0].woz, klasa: 'zloto' },
            { tekst: 'odpady', cel: wozy[0].odpad, kotwica: 'dol', klasa: 'm' },
            { tekst: 'kawałek wraca z nadwyżką', cel: wozy[0].gr, klasa: 'granat' }
          ],
          krok: function (t) {
            wozy.forEach(function (o) {
              var f = L.petla(t + o.faza * 9, 9), fi = o.fi;
              var uw = f < 0.25 ? f / 0.25 : 1 - L.odcinek(f, 0.25, 0.5);       // wóz: zjazd i powrót
              o.woz.position.copy(pol(T, mix(RM - 0.25, 2.9, uw), fi, 0.1)); o.woz.rotation.y = fi;
              o.odpad.visible = f >= 0.25 && f < 0.45;
              if (o.odpad.visible) o.odpad.position.copy(pol(T, mix(2.9, 1.72, L.odcinek(f, 0.25, 0.45)), fi + 0.3 * L.odcinek(f, 0.25, 0.45), 0.05));
              o.lak.visible = f >= 0.45 && f < 0.62;
              if (o.lak.visible) { var ul = L.odcinek(f, 0.45, 0.62); o.lak.position.copy(pol(T, mix(1.72, 0.97, ul), fi + 0.3 - 0.75 * ul, 0.05)); }
              o.gr.visible = f >= 0.45 && f < 0.9;
              if (o.gr.visible) { var ug = L.odcinek(f, 0.45, 0.9); o.gr.position.copy(pol(T, mix(1.72, RM - 0.15, Math.pow(ug, 0.8)), fi + 0.3 + 0.95 * ug, 0.08)); }
              var b = 1 - Math.abs(f - 0.92) / 0.07; o.blysk.material.opacity = b > 0 ? 0.9 * b : 0;
            });
          } };
      },
      etykiety: [{ tekst: 'miasto', poz: [0, 0.8, -4.5], kotwica: 'gora', klasa: 'w' }],
    },

    /* ---------- 14 ---------- */
    {
      czesc: CZ2, tytul: 'Haczyk',
      narracja: [
        'Jest jeden haczyk i dobrze widać go w rachunkach. Żeby pęknięcie dało zysk, kawałki muszą się rozlecieć z prędkościami, które są sporym ułamkiem prędkości światła.',
        'Porównaj dwa kamienie. Górny pęka tak, jak pękają zwykłe kamienie. Dolny robi to, czego wymaga rachunek, i niemal dotrzymuje kroku błyskowi światła.',
        'Dlatego pomysł Penrose\'a długo był raczej dowodem, że energia obrotu istnieje, niż przepisem, jak ją zebrać.'
      ],
      podpis: 'Dwa pęknięcia i błysk światła dla porównania. Schemat; prędkości umowne, nie wyliczone.',
      scena: 'proznia',
      ujecie: { ruch: 'truck: jazda równoległa za rozlatującymi się kawałkami', tor: [[-2.5, 0.3, 11], [1.2, 0.3, 11]], cel: [[-2.2, -0.4, 0], [1.0, -0.4, 0]], fov: 30, czas: 12, komp: [0, 0] }, tPogl: 3.6,
      zestawy: ['gwiazdy'],
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), X0 = -2.6;
        g.add(linia(c, [new T.Vector3(X0, -3, 0), new T.Vector3(X0, 2.6, 0)], 'atrament-3', { kreski: [0.07, 0.12], krycie: 0.7 }));
        function kaw(kolor, r) { var m = new T.Mesh(new T.IcosahedronGeometry(r, 0), mat(c, kolor)); g.add(m); return m; }
        function smuga(kolor) { var m = new T.Mesh(new T.BoxGeometry(1, 0.035, 0.035), przezr(c, kolor, 0.65)); g.add(m); return m; }
        var a1 = kaw('atrament', 0.16), a2 = kaw('atrament-2', 0.14);
        var b1 = kaw('lak', 0.15), b2 = kaw('granat', 0.17), s1 = smuga('lak'), s2 = smuga('granat');
        var sw = kula(c, 0.09, 'zar'), s3 = smuga('zar'); g.add(sw);
        function ustawSmuge(s, x0, x1, y) { var d = Math.abs(x1 - x0); s.visible = d > 0.02; s.scale.x = Math.max(d, 0.001); s.position.set((x0 + x1) / 2, y, 0); }
        return { grupa: g, krok: function (t) {
          var f = L.petla(t, 6.5), u = L.odcinek(f, 0.15, 0.85);
          a1.position.set(X0 - 0.14 - 0.45 * u, 1.5, 0); a2.position.set(X0 + 0.14 + 0.45 * u, 1.5, 0); a1.rotation.z = t; a2.rotation.z = -t * 0.8;
          var xl = X0 - 0.15 - 1.5 * u, xp = X0 + 0.15 + 6.1 * u, xs = X0 + 6.9 * u;
          b1.position.set(xl, -0.9, 0); b2.position.set(xp, -0.9, 0);
          ustawSmuge(s1, X0, xl, -0.9); ustawSmuge(s2, X0, xp, -0.9);
          sw.position.set(xs, -2.3, 0); ustawSmuge(s3, X0, xs, -2.3);
        } };
      },
      etykiety: [
        { tekst: 'zwykły kamień: kawałki rozchodzą się leniwie', poz: [-2.6, 2.05, 0], kotwica: 'prawo', klasa: 'w', dx: -40 },
        { tekst: 'pęknięcie, które daje zysk: spory ułamek prędkości światła', poz: [-2.6, -0.35, 0], kotwica: 'prawo', klasa: 'w', dx: -40 },
        { tekst: 'błysk światła', poz: [-2.6, -1.85, 0], kotwica: 'prawo', klasa: 'zar', dx: -40 }
      ],
    },

    /* ---------- 15 ---------- */
    {
      czesc: CZ3, tytul: 'Zagadka Zeldowicza',
      narracja: [
        'Ten sam rok 1971, Moskwa. Jakow Zeldowicz pyta o coś, co brzmi jak zagadka: czy żeby to zobaczyć, naprawdę potrzebujesz czarnej dziury?',
        'Odpowiada, że nie. Wystarczy coś, co się kręci i pochłania fale.',
        'Wyobraź sobie walec, który wiruje, a wokół niego falę ze skrętem. Jej grzbiety okrążają walec jak spiralny pasek na kręcącym się słupie przed zakładem fryzjerskim. Masz ten słup przed oczami?'
      ],
      podpis: 'Wirujący walec i fala ze skrętem. Schemat, rysunek poglądowy.',
      przypisy: [5],
      scena: 'walec',
      ujecie: { ruch: 'orbita 45° z niskiego kąta', tor: [[-5.25, 1.5, 9.09], [-1.37, 2.0, 10.41], [2.72, 2.5, 10.14]], cel: [0, 0, 0], fov: 30, czas: 16, komp: [-0.26, 0] },
      zestawy: ['gwiazdy', 'walec'],
      ustaw: function (c, z) { z.walec.ustaw({ wWalca: 0.5, wFali: 1.1 }); },
      etykiety: [
        { tekst: 'walec: kręci się i pochłania fale', poz: [0, 2.35, 0], kotwica: 'gora', klasa: 'zloto', dy: -8 },
        { tekst: 'fala ze skrętem', poz: [1.9, 0.9, 0], kotwica: 'prawo', klasa: 'granat', dx: 8 }
      ]
    },

    /* ---------- 16 ---------- */
    {
      czesc: CZ3, tytul: 'Walec wolniejszy niż fala',
      narracja: [
        'Najpierw walec kręci się powoli. Patrz na złote pasy na jego boku i na niebieskie grzbiety fali: fala go wyprzedza.',
        'Dopóki tak jest, walec robi to, co każda zwykła rzecz. Pochłania trochę fali i lekko się grzeje.',
        'To, co od niego wraca, jest słabsze niż to, co przyszło. Nic dziwnego, prawda?'
      ],
      podpis: 'Walec wolniejszy niż grzbiety fali: pochłanianie. Schemat; tempo obrotu i siła fali umowne.',
      scena: 'walec',
      ujecie: { ruch: 'dolly-in na grzejący się walec', tor: [[5, 3.6, 10.5], [3, 3.2, 9.4]], cel: [0, -0.1, 0], fov: 32, czas: 12, komp: [-0.24, 0] },
      zestawy: ['gwiazdy', 'walec'],
      ustaw: function (c, z) { z.walec.ustaw({ wWalca: 0.3, wFali: 1.4, odbita: 'slaba', grzanie: 1 }); },
      etykiety: [
        { tekst: 'grzbiety fali wyprzedzają walec', poz: [1.9, 1.3, 0], kotwica: 'prawo', klasa: 'granat', dx: 8 },
        { tekst: 'walec lekko się grzeje', poz: [0, -2.2, 1], kotwica: 'dol', klasa: 'lak', dy: 8 },
        { tekst: 'fala odbita: słabsza', poz: [-3.2, 0, 1.6], kotwica: 'dol', klasa: 'm' }
      ],
      przyrzad: { tytul: 'Siła fali', zakres: [0, 1.6], wiersze: [{ etykieta: 'fala, która przyszła', kolor: 'granat' }, { etykieta: 'fala, która wraca', kolor: 'atrament-3' }] },
      animuj: function (c) { c.przyrzad([1, 0.7]); }
    },

    /* ---------- 17 ---------- */
    {
      czesc: CZ3, tytul: 'Walec szybszy niż fala',
      narracja: [
        'Teraz rozkręć walec, aż jego pasy zaczną wyprzedzać grzbiety fali. Stań w myślach na jego powierzchni: stamtąd fala biegnie wstecz.',
        'Jej częstotliwość, liczona w wirującym świecie walca, zmienia znak. A pochłonięcie fali o ujemnej częstotliwości oznacza w rachunku jej wzmocnienie.',
        'Fala wraca silniejsza, niż przyszła, a walec minimalnie zwalnia. I szczegół, który brzmi jak paradoks: walec musi być stratny. Gdyby niczego nie pochłaniał, niczego by nie wzmacniał.'
      ],
      podpis: 'Walec szybszy niż wzór fali: wzmocnienie, czyli nadpromienistość rotacyjna. Schemat; tempo obrotu i siła fali umowne.',
      przypisy: [5],
      scena: 'walec',
      ujecie: { ruch: 'orbita w przeciwną stronę z odjazdem', tor: [[-4, 3, 9.5], [-1, 3.6, 10.5], [2.5, 3.4, 10.6]], cel: [0, -0.1, 0], fov: 34, czas: 14, komp: [-0.24, 0] },
      zestawy: ['gwiazdy', 'walec'],
      ustaw: function (c, z) { z.walec.ustaw({ wWalca: 2.3, wFali: 1.0, odbita: 'silna', obserwator: true }); },
      zbuduj: function (c) { var w = c.zestaw('walec'); return { etykiety: [{ tekst: 'stąd fala biegnie wstecz', cel: w.obserwator, klasa: 'zar', kotwica: 'gora' }] }; },
      etykiety: [
        { tekst: 'nadpromienistość rotacyjna\n(superradiance)', poz: [0, 2.5, 0], kotwica: 'gora', klasa: 'zloto', dy: -10 },
        { tekst: 'fala odbita: silniejsza', poz: [-2.4, 0, 2.6], kotwica: 'dol', klasa: 'zar' }
      ],
      przyrzad: { tytul: 'Siła fali', zakres: [0, 1.6], wiersze: [
        { etykieta: 'fala, która przyszła', kolor: 'granat' }, { etykieta: 'fala, która wraca', kolor: 'zar' }, { etykieta: 'obrót walca', kolor: 'zloto' }] },
      animuj: function (c, t) { c.przyrzad([1, 1.45, 1.3 - 0.1 * L.petla(t, 8)]); }
    },

    /* ---------- 18 ---------- */
    {
      czesc: CZ3, tytul: 'Ten sam mechanizm, dwa nazwiska',
      narracja: [
        'Wróć teraz do czarnej dziury. Jej horyzont jest najdoskonalszym pochłaniaczem, jaki znamy.',
        'Skoro tak, wirująca dziura powinna wzmacniać fale tak samo jak walec. Penrose mówił o kamieniach, Zeldowicz o falach.',
        'Pod spodem pracuje ten sam mechanizm: odbieranie energii obrotu. Stąd podwójna nazwa, proces Penrose\'a–Zeldowicza. Pamiętasz greckie ergon, czyli pracę?'
      ],
      podpis: 'Kamień i fala przy tej samej wirującej dziurze. Schemat, rysunek poglądowy, nie w skali.',
      scena: 'dziura',
      ujecie: { ruch: 'crane: wzlot nad falę i tor kamienia', tor: [[0, 3, 12], [0, 6, 10], [0, 8.2, 8.2]], cel: [0, 0, 0.3], fov: 32, czas: 14, komp: [0.1, 0] }, tPogl: 7.6,
      zestawy: ['gwiazdy', 'pyl', 'dziura', 'ergosfera', 'kamien'],
      ustaw: function (c, z) { z.dziura.ustaw({ os: true }); z.ergosfera.ustaw({ krycie: 0.6, siatka: false }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group();
        var wokol = falaWokol(c, 2.55, 2.2, 'granat'); g.add(wokol);
        var kr = kregi(c, 3, 'zar'); g.add(kr);
        return { grupa: g, krok: function (t) { wokol.rotation.y = t * 0.9; kr.userData.animuj(t, 3.2, 6.2, 0.8, 1.3); } };
      },
      etykiety: [
        { tekst: 'Penrose: kamienie', poz: [-3.6, 0, -1.9], kotwica: 'gora', klasa: 'w', dy: -8 },
        { tekst: 'Zeldowicz: fale', poz: [2.6, 1.0, 0], kotwica: 'prawo', klasa: 'granat', dx: 8 },
        { tekst: 'horyzont:\nnajdoskonalszy pochłaniacz,\njaki znamy', poz: [0, 0, 0], kotwica: 'srodek', klasa: 'm' }
      ],
      animuj: function (c, t, w, z) { w.krok(t); z.kamien.faza(L.odcinek(L.petla(t, 10), 0.03, 0.95)); }
    },

    /* ---------- 19 ---------- */
    {
      czesc: CZ3, tytul: 'W poszukiwaniu wolniejszych fal',
      narracja: [
        'Przez pół wieku walec był ćwiczeniem na papierze. Żeby tak wzmocnić światło, jego powierzchnia musiałaby pędzić niemal z prędkością światła.',
        'Co byś zrobił na miejscu fizyków? Oni poszukali fal wolniejszych.',
        'W 2017 roku zespół z Nottingham zobaczył wzmocnienie fal na wodzie krążącej w wirze. W 2020 roku zespół z Glasgow wzmocnił dźwięk wirującym, pochłaniającym dyskiem, bo dźwięk da się prześcignąć.'
      ],
      podpis: 'Dwa wcześniejsze doświadczenia: fale na wodzie w wirze i dźwięk przy wirującym dysku. Rysunek poglądowy, nie w skali i nie schemat aparatury.',
      przypisy: [6, 7],
      scena: 'lab',
      ujecie: { ruch: 'truck: wzdłuż stołu, od wiru wodnego do wirującego dysku', tor: [[-4.5, 3.2, 9.5], [0, 4.2, 10.4]], cel: [[-1.5, 0.6, 0], [0, 0.7, 0]], fov: 30, czas: 14, komp: [0, 0] },
      zestawy: ['stol'],
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group();
        // lewa strona: zbiornik z wirem
        var zb = new T.Group(); zb.position.set(-2.6, 0, 0.2); zb.scale.set(0.9, 0.9, 0.9); g.add(zb);
        zb.add(new T.Mesh(new T.CylinderGeometry(1.85, 1.85, 0.5, 64, 1, true), matL(c, 'linia', { side: T.DoubleSide })));
        zb.children[0].position.y = 0.19;
        var woda = new T.Mesh(new T.CircleGeometry(1.84, 64), mat(c, 'granat-tlo')); woda.rotation.x = -Math.PI / 2; woda.position.y = 0.3; zb.add(woda);
        var wir = new T.Group(); wir.position.y = 0.31;
        for (var a = 0; a < 4; a++) { var pts = []; for (var i = 0; i <= 40; i++) { var r = 1.7 * Math.pow(0.22 / 1.7, i / 40); pts.push(pol(T, r, a * TAU / 4 + 2 * Math.log(1.7 / r), 0)); } wir.add(rura(c, pts, 0.012, 'granat', { mat: { transparent: true, opacity: 0.55 } })); }
        zb.add(wir);
        var odplyw = new T.Mesh(new T.CircleGeometry(0.22, 32), mat(c, 'pustka')); odplyw.rotation.x = -Math.PI / 2; odplyw.position.y = 0.315; zb.add(odplyw);
        var NF = 6, fp = new Float32Array(NF * 6), fg = new T.BufferGeometry(); fg.setAttribute('position', new T.BufferAttribute(fp, 3));
        var fronty = new T.LineSegments(fg, new T.LineBasicMaterial({ color: c.kolor('zar'), transparent: true, opacity: 0.85 })); fronty.position.y = 0.325; zb.add(fronty);
        // prawa strona: głośnik → wirujący, pochłaniający dysk → silniejszy dźwięk
        var pr = new T.Group(); pr.position.set(2.2, 1.15, 0); g.add(pr);
        var glosnik = new T.Mesh(new T.BoxGeometry(0.35, 0.7, 0.7), matL(c, 'linia')); glosnik.position.x = -1.75; pr.add(glosnik);
        var membr = new T.Mesh(new T.CircleGeometry(0.24, 24), mat(c, 'granat')); membr.rotation.y = Math.PI / 2; membr.position.x = -1.57; pr.add(membr);
        var stojak = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.15, 8), matL(c, 'atrament-3')); stojak.position.set(0, -0.62, 0); pr.add(stojak);
        var stojak2 = stojak.clone(); stojak2.position.x = -1.75; pr.add(stojak2);
        var dysk = new T.Group(); dysk.rotation.z = Math.PI / 2; pr.add(dysk);
        dysk.add(new T.Mesh(new T.CylinderGeometry(0.95, 0.95, 0.08, 48), matL(c, 'atrament-3')));
        for (var s = 0; s < 6; s++) { var pas = new T.Mesh(new T.BoxGeometry(0.9, 0.09, 0.07), mat(c, 'zloto')); pas.position.copy(pol(T, 0.48, s * TAU / 6, 0)); pas.rotation.y = s * TAU / 6; dysk.add(pas); }
        var NP = 7, pier = [];
        for (var k = 0; k < NP; k++) { var m = new T.Mesh(new T.TorusGeometry(0.55, 0.014, 6, 48), przezr(c, 'granat', 0.9)); m.rotation.y = Math.PI / 2; pr.add(m); pier.push(m); }
        var gran = c.kolor('granat'), zar = c.kolor('zar');
        return { grupa: g, krok: function (t) {
          wir.rotation.y = t * 0.8;
          for (var i = 0; i < NF; i++) {
            var x = -1.7 + ((t * 0.35 + i / NF) % 1) * 3.4, zz = Math.sqrt(Math.max(0, 1.75 * 1.75 - x * x));
            fp[i * 6] = x; fp[i * 6 + 1] = 0; fp[i * 6 + 2] = -zz; fp[i * 6 + 3] = x; fp[i * 6 + 4] = 0; fp[i * 6 + 5] = zz;
          }
          fg.attributes.position.needsUpdate = true;
          dysk.rotation.x = t * 3;
          for (var j = 0; j < NP; j++) {
            var u = (t * 0.16 + j / NP) % 1, xx = -1.5 + u * 3.6, za = xx > 0.06;
            pier[j].position.x = xx; pier[j].material.color.copy(za ? zar : gran);
            var sk = za ? 1.45 : 1; pier[j].scale.set(sk, sk, za ? 2.4 : 1);
            pier[j].material.opacity = 0.9 * Math.min(1, u / 0.06, (1 - u) / 0.12);
          }
        } };
      },
      etykiety: [
        { tekst: 'Nottingham, 2017\nfale na wodzie krążącej w wirze', poz: [-2.6, 0.7, -1.5], kotwica: 'gora', klasa: 'w' },
        { tekst: 'Glasgow, 2020\ndźwięk i wirujący, pochłaniający dysk', poz: [2.2, 2.35, 0], kotwica: 'gora', klasa: 'w' }
      ],
    },

    /* ---------- 20 ---------- */
    {
      czesc: CZ4, tytul: 'Pierścień wielkości monety',
      narracja: [
        'Teraz przenieś się do Nowego Jorku, do Advanced Science Research Center przy City University of New York. Jest lipiec 2026 roku.',
        'Na stole leży pierścień wielkości monety, około dwóch centymetrów średnicy. Policz: trzy małe obwody elektryczne połączone w pętlę.',
        'Każdy możesz dostrajać jak radio pokrętłem. I zauważ najważniejsze: nic tu nie wiruje.'
      ],
      podpis: 'Pierścień z trzech obwodów obok monety. Rysunek poglądowy, nie rysunek układu z pracy; pokrętła to przenośnia.',
      przypisy: [8, 9],
      scena: 'lab',
      ujecie: { ruch: 'dolly-in: makro na pierścień i monetę', tor: [[1.4, 5.5, 8], [1.4, 3.2, 5.2]], cel: [1.3, 0, 0.3], fov: [34, 28], czas: 12, komp: [0, -0.05] },
      zestawy: ['stol', 'pierscien'],
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), p = c.zestaw('pierscien');
        var moneta = new T.Mesh(new T.CylinderGeometry(1.04, 1.04, 0.07, 64), new T.MeshLambertMaterial({ color: c.kolor('zloto').lerp(c.kolor('arkusz'), 0.5) })); moneta.position.set(2.9, -0.02, 0); g.add(moneta);
        var rant = new T.Mesh(new T.TorusGeometry(0.9, 0.012, 6, 64), mat(c, 'zloto')); rant.rotation.x = Math.PI / 2; rant.position.set(2.9, 0.02, 0); g.add(rant);
        var Z = 1.75, y = -0.04;
        g.add(rura(c, [new T.Vector3(-1.04, y, Z), new T.Vector3(1.04, y, Z)], 0.014, 'atrament'));
        [-1.04, 1.04].forEach(function (x) { g.add(rura(c, [new T.Vector3(x, y, Z - 0.13), new T.Vector3(x, y, Z + 0.13)], 0.014, 'atrament')); });
        return { grupa: g, etykiety: [
          { tekst: '1', cel: p.wezly[0], klasa: 'w', dy: -8 }, { tekst: '2', cel: p.wezly[1], klasa: 'w', dy: -8 }, { tekst: '3', cel: p.wezly[2], klasa: 'w', dy: -8 }] };
      },
      etykiety: [
        { tekst: 'ok. 2 cm', poz: [0, -0.04, 1.75], kotwica: 'dol', klasa: 'w', dy: 4 },
        { tekst: 'moneta, dla skali', poz: [2.9, 0, 1.1], kotwica: 'dol', klasa: 'm', dy: 6 },
        { tekst: 'trzy obwody połączone w pętlę', poz: [0, 0.2, -1.3], kotwica: 'gora', klasa: 'zloto', dy: -6 }
      ]
    },

    /* ---------- 21 ---------- */
    {
      czesc: CZ4, tytul: 'Fala na stadionie',
      narracja: [
        'Znasz to ze stadionu: nikt nie biega dookoła trybun, a fala i tak obiega cały stadion. Tu jest tak samo.',
        'Zespół Andrei Alù kołysze dostrojeniem trzech obwodów w górę i w dół, każdy odrobinę przesunięty w rytmie względem sąsiada. Po pierścieniu biegnie wzór zmian, który dla fali wygląda jak obrót: obrót syntetyczny.',
        'Nic tu nie leci, więc wzór może przesuwać się szybciej niż światło, bez łamania jakiegokolwiek prawa fizyki. Walca, którego nie dało się rozkręcić, nie musisz już kręcić.'
      ],
      podpis: 'Ryc. 3. Obrót syntetyczny. Schemat zasady na podstawie opisów eksperymentu, nie rysunek układu z pracy. Trybuny dorysowane dla porównania.',
      przypisy: [9],
      scena: 'lab',
      ujecie: { ruch: 'orbita nad stadionem', tor: [[-5.3, 6.5, 9.5], [-2.4, 6.5, 10.4], [0.9, 6.5, 10.3]], cel: [-1.8, 0, 0.1], fov: 32, czas: 16, komp: [0.08, 0] }, tPogl: 3.1,
      zestawy: ['pierscien'],
      ustaw: function (c, z) { z.pierscien.ustaw({ wzor: true, kolysanie: true, predkosc: 1.4 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), p = c.zestaw('pierscien'), N = 64, kib = [];
        var mk = matL(c, 'atrament-3');
        for (var i = 0; i < N; i++) { var m = new T.Mesh(new T.BoxGeometry(0.11, 0.3, 0.11), mk); m.userData.fi = i / N * TAU; m.rotation.y = m.userData.fi; g.add(m); kib.push(m); }
        g.add(okrag(c, 2.75, 'linia', { y: 0 }));
        var we = fala(c, { dl: 3.9, amp: 0.16, zwoje: 6, skret: 1, kolor: 'atrament', kier: 1 }); we.position.set(-6.4, 0.45, -1.15); g.add(we);
        var wy = fala(c, { dl: 3.9, amp: 0.16 * Math.sqrt(L.RYC4.MOC_MAX), zwoje: 6, skret: -1, kolor: 'zar', kier: -1, grubosc: 0.045 }); wy.position.set(-6.4, 0.45, 1.25); g.add(wy);
        return { grupa: g,
          etykiety: [{ tekst: '1', cel: p.wezly[0], klasa: 'w', dy: -8 }, { tekst: '2', cel: p.wezly[1], klasa: 'w', dy: -8 }, { tekst: '3', cel: p.wezly[2], klasa: 'w', dy: -8 }],
          krok: function (t) {
            for (var i = 0; i < N; i++) {
              var h = Math.pow(Math.max(0, Math.cos(kib[i].userData.fi - t * 1.4)), 3);
              kib[i].scale.y = 1 + 1.7 * h; kib[i].position.copy(pol(T, 2.75, kib[i].userData.fi, 0.15 * (1 + 1.7 * h)));
            }
            biegFali(we, t, 3); biegFali(wy, t, 3);
          } };
      },
      etykiety: [
        { tekst: 'fala wchodzi: 100 MHz', poz: [-4.4, 0.75, -1.15], kotwica: 'gora' },
        { tekst: 'fala wraca: silniejsza,\nze skrętem w drugą stronę', poz: [-4.3, 0, 1.8], kotwica: 'dol', klasa: 'zar' },
        { tekst: 'wzór zmian obiega pierścień:\nobrót syntetyczny', poz: [0, 0.05, 1.45], kotwica: 'dol', klasa: 'granat', dy: 4 },
        { tekst: 'trybuny: nikt nie biega, a fala obiega stadion', poz: [0, 0.9, -2.75], kotwica: 'gora', klasa: 'm', dy: -6 }
      ],
    },

    /* ---------- 22 ---------- */
    {
      czesc: CZ4, tytul: 'Przemiatanie: od 5 do 195 megaherców',
      narracja: [
        'Teraz najlepsza część, więc patrz uważnie. Badacze wpuszczają do pierścienia falę radiową o częstotliwości 100 megaherców, ze skrętem. Potem stopniowo przyspieszają obrót syntetyczny, od 5 do 195 megaherców.',
        'Dopóki obrót jest wolniejszy niż fala, odbita fala słabnie, bo pierścień ją po prostu pochłania. Powyżej stu megaherców obrót przegania falę i wszystko się odwraca.',
        'Fala wychodzi ze skrętem w przeciwną stronę i silniejsza, niż weszła. Według relacji Physics World jej moc rosła nawet sześciokrotnie.'
      ],
      podpis: 'Ryc. 4. Dwa zachowania pierścienia. Schemat według relacji z eksperymentu, nie wykres zmierzonych wartości. Wysokość fali i słupki w scenie umowne: dwa stany, nie krzywa.',
      przypisy: [9],
      scena: 'wykres-progu',
      ujecie: { ruch: 'dolly-in przed osią przemiatania', tor: [[-1.5, 3.0, 11.6], [0, 3.2, 10.6]], cel: [0, 1.0, 0.3], fov: 30, czas: 14, komp: [0, 0] }, tPogl: 9.4,
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), PX = 4, GL = 1.25;
        function strefa(x0, x1, tlo, brzeg) {
          var m = new T.Mesh(new T.BoxGeometry(x1 - x0, 0.04, GL * 2), mat(c, tlo)); m.position.set((x0 + x1) / 2, -0.02, 0); g.add(m);
          g.add(linia(c, [new T.Vector3(x0, 0.005, -GL), new T.Vector3(x1, 0.005, -GL), new T.Vector3(x1, 0.005, GL), new T.Vector3(x0, 0.005, GL), new T.Vector3(x0, 0.005, -GL)], brzeg));
        }
        strefa(-PX, 0, 'lak-tlo', 'lak'); strefa(0, PX, 'zloto-tlo', 'zloto');
        var ZO = 1.75;
        g.add(linia(c, [new T.Vector3(-PX, 0, ZO), new T.Vector3(PX, 0, ZO)], 'atrament-3'));
        [-PX, 0, PX].forEach(function (x) { g.add(linia(c, [new T.Vector3(x, 0, ZO - 0.12), new T.Vector3(x, 0, ZO + 0.12)], 'atrament-3')); });
        g.add(linia(c, [new T.Vector3(0, 0, -GL), new T.Vector3(0, 2.5, -GL), new T.Vector3(0, 2.5, GL), new T.Vector3(0, 0, GL), new T.Vector3(0, 0, ZO)], 'zar', { kreski: [0.1, 0.1] }));
        var prog = new T.Mesh(new T.PlaneGeometry(GL * 2, 2.5), przezr(c, 'zar', 0.05, { side: T.DoubleSide })); prog.rotation.y = Math.PI / 2; prog.position.y = 1.25; g.add(prog);
        // kursor: mały pierścień jadący po osi szybkości obrotu
        var kur = new T.Group(); g.add(kur);
        var p = budujPierscien(c, { wzor: true, kolysanie: true, skala: 0.5, pozycja: [0, 0.5, 0] }); kur.add(p.grupa);
        kur.add(linia(c, [new T.Vector3(0, 0, 0), new T.Vector3(0, 0.45, 0)], 'atrament-3'));
        var znacznik = grot(c, 'zar', 0.14); znacznik.rotation.x = Math.PI; znacznik.position.set(0, 0.12, ZO); kur.add(znacznik);
        var SR = [0, 0.62, 0];
        var v1 = faleV(c, kur, SR, { ampWy: L.amplitudaUmowna(L.RYC4.F_MIN), skretWy: L.skretOdbitej(L.RYC4.F_MIN), kolorWy: 'atrament-3' });
        var v2 = faleV(c, kur, SR, { ampWy: L.amplitudaUmowna(L.RYC4.F_MAX), skretWy: L.skretOdbitej(L.RYC4.F_MAX), kolorWy: 'zar' });
        var we = v1.we, slaba = v1.wy, silna = v2.wy; v2.we.visible = false;
        var czub = new T.Object3D(); czub.position.set(0, 0, ZO); kur.add(czub);
        var stan = { f: L.RYC4.F_MIN };
        return { grupa: g, stan: stan,
          etykiety: [{ tekst: function () { return 'obrót syntetyczny: ' + Math.round(stan.f) + ' MHz'; }, cel: czub, klasa: 'granat', kotwica: 'dol', dy: 6 }],
          krok: function (t, ctx) {
            var u = L.odcinek(L.petla(t, 13), 0.04, 0.92), f = L.przemiatanie(u);
            stan.f = f;
            kur.position.x = -PX + 2 * PX * L.pozycjaNaOsi(f);
            var wzm = L.strefaPierscienia(f) === 'wzmacnia';
            slaba.visible = !wzm; silna.visible = wzm;
            p.ustaw({ wzor: true, kolysanie: true, skala: 0.5, pozycja: [0, 0.5, 0], predkosc: 0.4 + 5 * u });
            p.animuj(t);
            biegFali(we, t, 3); biegFali(slaba, t, 3); biegFali(silna, t, 3);
            var a = L.amplitudaUmowna(f); ctx.przyrzad([1, a * a]);
          } };
      },
      etykiety: [
        { tekst: '5 MHz', poz: [-4, 0, 1.75], kotwica: 'dol', dy: 26 },
        { tekst: '100 MHz', poz: [0, 0, 1.75], kotwica: 'dol', dy: 26 },
        { tekst: '195 MHz', poz: [4, 0, 1.75], kotwica: 'dol', dy: 26 },
        { tekst: 'szybkość obrotu syntetycznego (fala wejściowa: 100 MHz)', poz: [0, 0, 1.75], kotwica: 'dol', klasa: 'm', dy: 46 },
        { tekst: 'fala odbita słabnie\npierścień pochłania', poz: [-2.5, 3.5, 0], kotwica: 'gora', klasa: 'lak' },
        { tekst: 'fala odbita silniejsza\nmoc nawet ×6, skręt odwrócony', poz: [2.5, 3.5, 0], kotwica: 'gora', klasa: 'zloto' },
        { tekst: 'próg: obrót\nzrównuje się z falą', poz: [0, 2.5, -1.25], kotwica: 'gora', klasa: 'zar', dy: -4 }
      ],
      przyrzad: { tytul: 'Moc fali (umownie)', zakres: [0, 6], wiersze: [{ etykieta: 'fala, która weszła', kolor: 'atrament' }, { etykieta: 'fala odbita', kolor: 'zar' }] },
      animuj: function (c, t, w) { w.krok(t, c); }
    },

    /* ---------- 23 ---------- */
    {
      czesc: CZ4, tytul: 'Podpis Zeldowicza i rachunek za prąd',
      narracja: [
        'Jest tu też podpis Zeldowicza. Porównaj dwa pierścienie: ten bardziej stratny daje większe wzmocnienie, dokładnie jak walec, który musiał pochłaniać, żeby wzmacniać.',
        'A skąd nadwyżka? Nie z niczego. W walcu płacił obrót walca, w czarnej dziurze jej wirowanie.',
        'Tu płaci elektronika, która kołysze obwodami. Pierścień przelewa energię z tego napędu w falę, i to tylko dla fal z odpowiednim skrętem.'
      ],
      podpis: 'Dwa pierścienie i ich zasilanie. Schemat; różnica wzmocnienia umowna, nie zmierzona.',
      przypisy: [8, 9],
      scena: 'lab',
      ujecie: { ruch: 'orbita wokół dwóch pierścieni', tor: [[-3, 3.6, 9.6], [0, 4.2, 9.8], [2.2, 4, 9.6]], cel: [0, 1.0, 0], fov: 32, czas: 14, komp: [0, 0] },
      zestawy: ['stol'],
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), A = 0.15, fale = [], pier = [], prz = [];
        var zasil = new T.Mesh(new T.BoxGeometry(1.5, 0.5, 0.8), matL(c, 'linia')); zasil.position.set(0, 0.2, -3); g.add(zasil);
        var lamp = new T.Mesh(new T.BoxGeometry(0.16, 0.06, 0.06), mat(c, 'zloto')); lamp.position.set(0.5, 0.47, -3); g.add(lamp);
        [[-2.4, 'atrament-3', 1.3], [2.4, 'lak', Math.sqrt(L.RYC4.MOC_MAX)]].forEach(function (d) {
          var p = budujPierscien(c, { wzor: true, kolysanie: true, skala: 0.62, pozycja: [d[0], 0.12, 0], predkosc: 2.4, kolorObreczy: d[1] });
          g.add(p.grupa); pier.push(p);
          var v = faleV(c, g, [d[0], 0.3, 0], { amp: A, ampWy: d[2], dlWe: 1.9, dlWy: 2.1 }); fale.push(v.we, v.wy);
          var kab = new T.CatmullRomCurve3([new T.Vector3(d[0] > 0 ? 0.75 : -0.75, 0.05, -3), new T.Vector3(d[0] * 0.9, 0.02, -2.4), new T.Vector3(d[0] * 1.25, 0.02, -1.2), new T.Vector3(d[0] * 1.05, 0.05, -0.62)]);
          g.add(rura(c, kab, 0.025, 'zloto', { mat: { transparent: true, opacity: 0.55 } }));
          var pl = przeplyw(c, kab, 6, 'zar'); g.add(pl); prz.push(pl);
        });
        return { grupa: g, krok: function (t) {
          pier.forEach(function (p) { p.animuj(t); }); fale.forEach(function (f) { biegFali(f, t, 3); }); prz.forEach(function (p) { p.userData.animuj(t, 0.22); });
        } };
      },
      etykiety: [
        { tekst: 'pierścień mniej stratny:\nwzmocnienie mniejsze', poz: [-2.4, 0, 1.1], kotwica: 'dol', klasa: 'w', dy: 8 },
        { tekst: 'pierścień bardziej stratny:\nwzmocnienie większe', poz: [2.4, 0, 1.1], kotwica: 'dol', klasa: 'zar', dy: 8 },
        { tekst: 'elektronika, która kołysze obwodami:\nto ona płaci', poz: [0, 0.5, -3], kotwica: 'gora', klasa: 'zloto', dy: -8 }
      ],
    },

    /* ---------- 24 ---------- */
    {
      czesc: CZ5, tytul: 'Ile mieści się w obrocie',
      narracja: [
        'Wróć do prawdziwej czarnej dziury i zrób rachunek, od którego robi się zimno. Weź dziurę, która obraca się najszybciej, jak pozwala teoria.',
        'Aż 29 procent jej masy to energia obrotu, którą w zasadzie można odebrać. Ta liczba bierze się z prostego wzoru: jeden minus jeden przez pierwiastek z dwóch.',
        'W 1970 roku Demetrios Christodoulou pokazał, że reszta, około 71 procent masy, zostaje w dziurze na zawsze. Spójrz na słup obok: jasna część to wszystko, co da się wziąć.'
      ],
      ramka: { typ: 'nota', etykieta: 'Przypis do tej liczby',
        tekst: 'To granica dla dziury wirującej najszybciej, jak się da, i dla odbioru doskonałego, krok po kroku, aż dziura całkiem przestanie się kręcić. Żaden znany sposób nie zbliża się do niej w praktyce. Liczba mówi, ile energii natura potrafi schować w samym obracaniu się, a nie ile ktoś kiedyś zbierze.' },
      podpis: 'Masa dziury jako słup: część możliwa do odebrania i reszta. Słup w skali liniowej; dziura obok poglądowa, nie w skali.',
      przypisy: [11],
      scena: 'dziura',
      ujecie: { ruch: 'dolly-in: dziura i słup jej masy', tor: [[6, 2, 14], [4, 1.2, 11.5]], cel: [1.9, 0, 0], fov: 30, czas: 14, komp: [0, 0] },
      zestawy: ['gwiazdy', 'pyl', 'dziura', 'ergosfera'],
      ustaw: function (c, z) { z.dziura.ustaw({ os: true, strzalki: true, rStrzalek: 0.9, predkosc: 1.8 }); z.ergosfera.ustaw({ krycie: 0.6 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), H = 4.4, X = 3.5, u = L.ulamekObrotu(), hG = H * u, hD = H - hG;
        var dol = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, hD, 40), matL(c, 'linia')); dol.position.set(X, -H / 2 + hD / 2, 0); g.add(dol);
        var gora = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, hG, 40), mat(c, 'zar')); gora.position.set(X, H / 2 - hG / 2, 0); g.add(gora);
        [-H / 2, -H / 2 + hD, H / 2].forEach(function (y) { var o = new T.Mesh(new T.TorusGeometry(0.56, 0.02, 6, 48), mat(c, 'zloto')); o.rotation.x = Math.PI / 2; o.position.set(X, y, 0); g.add(o); });
        var jasny = c.kolor('zar'), ciemny = c.kolor('zloto');
        return { grupa: g, krok: function (t) { gora.material.color.copy(ciemny).lerp(jasny, 0.65 + 0.35 * Math.sin(t * 1.6)); } };
      },
      etykiety: [
        { tekst: 'energia obrotu,\nktórą w zasadzie da się odebrać:\ndo 29% masy', poz: [4.05, 1.55, 0], kotwica: 'prawo', klasa: 'zar', dx: 8 },
        { tekst: 'zostaje w dziurze na zawsze:\nok. 71% masy', poz: [4.05, -0.7, 0], kotwica: 'prawo', klasa: 'w', dx: 8 },
        { tekst: 'dziura wirująca najszybciej,\njak pozwala teoria', poz: [0, -1.25, 0], kotwica: 'dol', dy: 26 }
      ],
    },

    /* ---------- 25 ---------- */
    {
      czesc: CZ5, tytul: 'Trzy źródła energii, jedna skala',
      narracja: [
        'Porównaj to z czymś znajomym. Reaktor, rozszczepiając uran, zamienia w energię mniej więcej jedną dziesiątą procenta masy paliwa.',
        'Słońce, łącząc wodór w hel, zamienia około siedmiu dziesiątych procenta. Teraz połóż obok słupek wirującej dziury.',
        'Dwa pierwsze prawie przy nim znikają, a skala jest uczciwa, liniowa. W przeliczeniu na kilogram masy dziura trzyma w swoim obrocie prawie trzysta razy więcej niż reaktor.'
      ],
      podpis: 'Ryc. 5. Trzy źródła energii w jednej skali. Wartości przybliżone, czarna dziura w przypadku granicznym. Ułamek masy zamieniany w energię, skala liniowa.',
      scena: 'wykres-zrodel',
      ujecie: { ruch: 'dolly-in na słupki', tor: [[0, 0.3, 12.8], [0, 0.3, 11.4]], cel: [0, -0.25, 0], fov: 30, czas: 12, komp: [0, 0] }, tPogl: 6,
      zestawy: ['gwiazdy'],
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), X0 = -5.4, MAKS = 10.8, d = L.dlugosciSlupkow(MAKS), Y = [1.5, 0, -1.5], slupki = [], konce = [];
        g.add(linia(c, [new T.Vector3(X0, -2.3, 0), new T.Vector3(X0, 2.3, 0)], 'atrament-3'));
        var kl = c.kolor('lak'), kz = c.kolor('zloto'), kr = c.kolor('zar');
        d.forEach(function (dl, i) {
          // słupki PŁASKIE (głębokość ~0): boczna ścianka w perspektywie udawałaby dodatkową długość i psuła skalę liniową
          var geo = new T.BoxGeometry(1, 0.5, 0.01, i === 2 ? 24 : 1, 1, 1), m;
          if (i === 2) {
            var p = geo.attributes.position, kol = new Float32Array(p.count * 3);
            for (var j = 0; j < p.count; j++) { var u = p.getX(j) + 0.5, k = u < 0.55 ? kl.clone().lerp(kz, u / 0.55) : kz.clone().lerp(kr, (u - 0.55) / 0.45); kol[j * 3] = k.r; kol[j * 3 + 1] = k.g; kol[j * 3 + 2] = k.b; }
            geo.setAttribute('color', new T.BufferAttribute(kol, 3));
            m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true }));
          } else m = new T.Mesh(geo, mat(c, 'zloto'));
          g.add(m); slupki.push(m);
          var k2 = new T.Object3D(); g.add(k2); konce.push(k2);
        });
        return { grupa: g,
          etykiety: L.RYC5.map(function (z, i) { return { tekst: z.opis, cel: konce[i], kotwica: 'prawo', klasa: i === 2 ? 'zar' : 'w', dx: 6 }; }),
          krok: function (t) {
            var f = L.petla(t, 12);
            d.forEach(function (dl, i) {
              var s = Math.max(0.0005, L.wygladz(L.odcinek(f, 0.04 + i * 0.07, 0.3 + i * 0.07))) * dl;
              slupki[i].scale.x = s; slupki[i].position.set(X0 + s / 2, Y[i], 0); konce[i].position.set(X0 + s, Y[i], 0);
            });
          } };
      },
      etykiety: [
        { tekst: 'rozszczepienie uranu', poz: [-5.4, 1.5, 0], kotwica: 'prawo', klasa: 'w', dy: -30 },
        { tekst: 'synteza wodoru w Słońcu', poz: [-5.4, 0, 0], kotwica: 'prawo', klasa: 'w', dy: -30 },
        { tekst: 'wirująca czarna dziura\n(obrót maksymalny)', poz: [-5.4, -1.5, 0], kotwica: 'prawo', klasa: 'w', dy: -38 },
        { tekst: 'ułamek masy zamieniany w energię, skala liniowa', poz: [5.4, -2.3, 0], kotwica: 'lewo', klasa: 'm', dy: 4 }
      ],
    },

    /* ---------- 26 ---------- */
    {
      czesc: CZ6, tytul: 'Uczciwie',
      narracja: [
        'Zanim pójdziesz dalej, uczciwy rachunek. To, co widzisz na stole, to dowód zasady, nie elektrownia.',
        'Nie ma tu grawitacji ani czarnej dziury, jest elektronika, która odtwarza te same reguły dla fal. Nadwyżka pochodzi z zasilania, więc nikt nie dostaje darmowego prądu.',
        'A do czego to się przyda? Twórcy myślą o laserach, które wysyłają światło tylko z wybranym skrętem, o zapisywaniu informacji w skręcie fali i o łączności bezprzewodowej.'
      ],
      ramka: { typ: 'umbra', etykieta: 'Uczciwie', tekst: 'To dowód zasady w laboratorium, nie elektrownia.', punkty: [
        'Nie ma tu grawitacji ani czarnej dziury. Sam Alù zastrzega, że eksperyment nie bada prawdziwych czarnych dziur ani grawitacji kwantowej, tylko tworzy układ, który odtwarza niektóre z tych samych zasad fizycznych.',
        'Nadwyżka energii fali pochodzi z zasilania, które kołysze obwodami. Nikt nie dostaje tu darmowego prądu.',
        'Efekt pokazano na falach radiowych. Przeniesienie go na światło widzialne zespół opisuje jako kolejny krok, a nie jako wynik.',
        'Najbliższa znana czarna dziura, Gaia BH1, leży około półtora tysiąca lat świetlnych od Ziemi. Elektrownia przy horyzoncie pozostaje fantastyką.'
      ] },
      podpis: 'Pierścień, jego zasilanie i fala radiowa; w tle kierunek ku Gaia BH1. Rysunek poglądowy, nie w skali.',
      przypisy: [8, 9, 12],
      scena: 'lab',
      ujecie: { ruch: 'dolly-out z wzlotem: odsłonięcie kierunku ku Gaia BH1', tor: [[-0.4, 2.2, 5.5], [-0.4, 3.4, 8], [-0.4, 4.4, 9.8]], cel: [[0, 0.2, 0], [-0.2, 1.0, 0]], fov: 34, czas: 16, komp: [0, 0] },
      zestawy: ['gwiazdy', 'stol', 'pierscien'],
      ustaw: function (c, z) { z.pierscien.ustaw({ wzor: true, kolysanie: true, predkosc: 2.4 }); },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group();
        var zasil = new T.Mesh(new T.BoxGeometry(1.4, 0.55, 0.9), matL(c, 'linia')); zasil.position.set(3.0, 0.22, -1.2); g.add(zasil);
        var lamp = new T.Mesh(new T.BoxGeometry(0.16, 0.06, 0.06), mat(c, 'zloto')); lamp.position.set(2.6, 0.52, -0.9); g.add(lamp);
        var kab = new T.CatmullRomCurve3([new T.Vector3(2.3, 0.05, -1.2), new T.Vector3(1.8, 0.02, -1.5), new T.Vector3(1.3, 0.02, -0.5), new T.Vector3(1.06, 0.05, -0.1)]);
        g.add(rura(c, kab, 0.025, 'zloto', { mat: { transparent: true, opacity: 0.55 } }));
        var pl = przeplyw(c, kab, 6, 'zar'); g.add(pl);
        var we = fala(c, { dl: 2.6, amp: 0.15, zwoje: 4, skret: 1, kolor: 'atrament', kier: 1 }); we.position.set(-4.3, 0.45, -0.9); g.add(we);
        var wy = fala(c, { dl: 2.6, amp: 0.15 * Math.sqrt(L.RYC4.MOC_MAX), zwoje: 4, skret: -1, kolor: 'zar', kier: -1, grubosc: 0.04 }); wy.position.set(-4.3, 0.45, 0.9); g.add(wy);
        // daleko w tle: znak czarnej dziury i przerywany kierunek ku niej
        var bh = new T.Group(); bh.position.set(6.2, 2.5, -9);
        bh.add(new T.Mesh(new T.SphereGeometry(0.2, 20, 14), mat(c, 'pustka')));
        bh.add(new T.Mesh(new T.SphereGeometry(0.225, 20, 14), mat(c, 'zar', { side: T.BackSide })));
        g.add(bh);
        g.add(linia(c, [new T.Vector3(0.6, 0.3, -0.6), new T.Vector3(6.0, 2.4, -8.6)], 'atrament-3', { kreski: [0.12, 0.16], krycie: 0.7 }));
        return { grupa: g, krok: function (t) { pl.userData.animuj(t, 0.22); biegFali(we, t, 3); biegFali(wy, t, 3); } };
      },
      etykiety: [
        { tekst: 'zasilanie i elektronika: stąd nadwyżka', poz: [3.0, 0.55, -1.2], kotwica: 'gora', klasa: 'zloto', dy: -6 },
        { tekst: 'fale radiowe,\njeszcze nie światło widzialne', poz: [-3, 0, 1.7], kotwica: 'dol', klasa: 'w' },
        { tekst: 'Gaia BH1: około półtora tysiąca\nlat świetlnych stąd', poz: [6.2, 2.5, -9], kotwica: 'gora', klasa: 'lak', dy: -10 },
        { tekst: 'tu nie ma grawitacji\nani czarnej dziury', poz: [0, 0.05, 1.5], kotwica: 'dol', klasa: 'm', dy: 6 }
      ],
    },

    /* ---------- 27 ---------- */
    {
      czesc: CZ6, tytul: 'Może wszechświat już to robi',
      narracja: [
        'Odsuń się teraz bardzo daleko, aż zobaczysz centrum galaktyki. Z okolic olbrzymich czarnych dziur wystrzeliwują tam strugi materii.',
        'Astrofizycy podejrzewają, że zasila je magnetyczny kuzyn naszego silnika, opisany w 1977 roku przez Rogera Blandforda i Romana Znajka. Wszechświat być może już z niego korzysta.',
        'Pewności nie ma. To jedno z tych otwartych pytań, przy których najciekawiej się stoi.'
      ],
      podpis: 'Strugi materii z okolic czarnej dziury i linie pola magnetycznego. Rysunek poglądowy, nie w skali; sam mechanizm to podejrzenie, nie pewność.',
      przypisy: [13],
      scena: 'strugi',
      ujecie: { ruch: 'dolly-out z przechyłem kadru wzdłuż strugi', tor: [[2, 0.6, 5], [3.5, 1.2, 8.5], [4.5, 1.8, 11.5]], cel: [0, 0, 0], fov: 38, czas: 18, komp: [0, 0], przechyl: [-20, -62] },
      zestawy: ['gwiazdy', 'dziura', 'dysk'],
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group(), los = c.generator(1977), N = 700, DL = 5.6;
        var baza = [], poz = new Float32Array(N * 3), geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(poz, 3));
        for (var i = 0; i < N; i++) baza.push([los(), los() * TAU, Math.sqrt(los()), i % 2 ? 1 : -1, 0.12 + los() * 0.1]);
        g.add(new T.Points(geo, new T.PointsMaterial({ color: c.kolor('granat'), size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false })));
        [1, -1].forEach(function (zn) {
          var st = new T.Mesh(new T.ConeGeometry(0.85, DL, 32, 1, true), przezr(c, 'granat', 0.07, { side: T.DoubleSide }));
          st.position.y = zn * (1.05 + DL / 2); st.rotation.x = zn > 0 ? Math.PI : 0; g.add(st);
        });
        var pole = new T.Group();
        for (var k = 0; k < 4; k++) [1, -1].forEach(function (zn) {
          var pts = [];
          for (var j = 0; j <= 60; j++) { var s = j / 60; pts.push(pol(T, 0.55 + 0.75 * s, k * TAU / 4 + s * TAU * 1.6, zn * (1.1 + s * DL * 0.92))); }
          pole.add(rura(c, pts, 0.016, 'zloto', { mat: { transparent: true, opacity: 0.75 }, odcinki: 120 }));
        });
        g.add(pole);
        return { grupa: g, krok: function (t) {
          for (var i = 0; i < N; i++) {
            var b = baza[i], s = (b[0] + t * b[4]) % 1, r = (0.1 + 0.7 * s) * b[2];
            poz[i * 3] = r * Math.cos(b[1]); poz[i * 3 + 1] = b[3] * (1.08 + s * DL); poz[i * 3 + 2] = r * Math.sin(b[1]);
          }
          geo.attributes.position.needsUpdate = true;
          pole.rotation.y = t * 0.5;
        } };
      },
      etykiety: [
        { tekst: 'struga materii', poz: [0.7, 5, 0], kotwica: 'prawo', klasa: 'granat', dx: 8 },
        { tekst: 'linie pola magnetycznego', poz: [-1.2, 3.1, 0], kotwica: 'lewo', klasa: 'zloto', dx: -8 },
        { tekst: 'ten sam silnik?\npewności nie ma', poz: [3.6, 2.2, 0], kotwica: 'prawo', klasa: 'duza' }
      ],
    },

    /* ---------- 28 ---------- */
    {
      czesc: CZ6, tytul: 'Kamień, który zmieścił się w monecie',
      narracja: [
        'Pomyśl jeszcze raz o kamieniu, który pęka na brzegu ergosfery.',
        'Przez pół wieku był rachunkiem na tablicy, opowieścią o miejscu, do którego nigdy nie polecimy.',
        'Latem 2026 roku ta opowieść zmieściła się w pierścieniu wielkości monety. I fala, która do niego wpadła, wyszła z niego silniejsza.'
      ],
      podpis: 'Dziura z pękającym kamieniem i pierścień z falą, obok siebie. Rysunek poglądowy, nie w skali.',
      scena: 'final',
      ujecie: { ruch: 'orbita z odjazdem: dziura i pierścień w jednym kadrze', tor: [[-2, 3, 9], [1, 4.2, 11], [3, 5, 12.5]], cel: [2.2, 0.3, 0.6], fov: 32, czas: 18, komp: [0, 0] }, tPogl: 7.4,
      zestawy: ['gwiazdy', 'pyl', 'dziura', 'ergosfera', 'kamien', 'pierscien'],
      ustaw: function (c, z) {
        z.dziura.ustaw({ strzalki: true, rStrzalek: 0.9 }); z.ergosfera.ustaw({ krycie: 0.7, siatka: false });
        z.pierscien.ustaw({ wzor: true, kolysanie: true, predkosc: 2.4, pozycja: [4.9, 0, 1.4], skala: 0.9 });
      },
      zbuduj: function (c) {
        var T = c.THREE, g = new T.Group();
        var v = faleV(c, g, [4.9, 0.25, 1.4], { ampWy: Math.sqrt(L.RYC4.MOC_MAX), dlWe: 2.0, dlWy: 2.2 });
        var czub = new T.Object3D(); czub.position.set(4.9 + 1.25, 0.25 + 2.9, 1.4); g.add(czub);
        return { grupa: g, etykiety: [{ tekst: 'fala wyszła\nsilniejsza', cel: czub, kotwica: 'lewo', klasa: 'zar', dx: -18, dy: -6 }],
          krok: function (t) { biegFali(v.we, t, 3); biegFali(v.wy, t, 3); } };
      },
      etykiety: [
        { tekst: 'pół wieku: rachunek na tablicy', poz: [0, 1.2, 0], kotwica: 'gora', klasa: 'w', dy: -6 },
        { tekst: 'lato 2026:\npierścień wielkości monety', poz: [4.9, 0, 2.7], kotwica: 'dol', klasa: 'zloto', dy: 6 }
      ],
      animuj: function (c, t, w, z) { w.krok(t); z.kamien.faza(L.odcinek(L.petla(t, 10), 0.03, 0.95)); }
    }
  ];

  /* =====================================================================
     Źródła — numeracja jak w artykule
     ===================================================================== */
  var zrodla = [
    { opis: 'R. P. Kerr, „Gravitational field of a spinning mass as an example of algebraically special metrics”, Physical Review Letters 11 (1963), 237.' },
    { opis: 'C. W. F. Everitt i in., „Gravity Probe B: Final results of a space experiment to test general relativity”, Physical Review Letters 106 (2011), 221101.' },
    { opis: 'R. Penrose, „Gravitational collapse: the role of general relativity”, Rivista del Nuovo Cimento, numer specjalny 1 (1969), 252.' },
    { opis: 'R. Penrose, R. M. Floyd, „Extraction of rotational energy from a black hole”, Nature Physical Science 229 (1971), 177.' },
    { opis: 'Ya. B. Zel\'dovich, „Generation of waves by a rotating body”, JETP Letters 14 (1971), 180.' },
    { opis: 'T. Torres i in., „Rotational superradiant scattering in a vortex flow”, Nature Physics 13 (2017), 833.' },
    { opis: 'M. Cromb i in., „Amplification of waves from a rotating body”, Nature Physics 16 (2020), 1069.' },
    { opis: 'CUNY Advanced Science Research Center, „A Black Hole Theory Comes to Life in the Lab”, komunikat z 8 lipca 2026:',
      linki: [{ tekst: 'asrc.gc.cuny.edu', url: 'https://asrc.gc.cuny.edu/headlines/2026/07/a-black-hole-theory-comes-to-life-in-the-lab/' }] },
    { opis: 'A. Feldman, „Artificially rotating system reflects radiation like a black hole”, Physics World, 10 sierpnia 2026:',
      linki: [{ tekst: 'physicsworld.com', url: 'https://physicsworld.com/a/artificially-rotating-system-reflects-radiation-like-a-black-hole/' }] },
    { opis: 'H. Nasari, H. Moussa i in., kierownik A. Alù, Nature (2026):',
      linki: [{ tekst: 'nature.com/articles/s41586-026-10725-y', url: 'https://www.nature.com/articles/s41586-026-10725-y' },
        { tekst: 'omówienie: Universe Today', url: 'https://www.universetoday.com/articles/researchers-prove-black-theory-in-a-laboratory-setting' }] },
    { opis: 'D. Christodoulou, „Reversible and irreversible transformations in black-hole physics”, Physical Review Letters 25 (1970), 1596.' },
    { opis: 'K. El-Badry i in., „A Sun-like star orbiting a black hole”, Monthly Notices of the Royal Astronomical Society 518 (2023), 1057.' },
    { opis: 'R. D. Blandford, R. L. Znajek, „Electromagnetic extraction of energy from Kerr black holes”, Monthly Notices of the Royal Astronomical Society 179 (1977), 433.' }
  ];

  var definicja = {
    id: 'silnik-grawitacyjny',
    tytul: 'Kosmiczny silnik grawitacyjny',
    pochodzenie: 'Na podstawie artykułu „Kosmiczny silnik grawitacyjny” (Czytelnia · Las, 18 listopada 2026)',
    zrodla: zrodla,
    zestawy: zestawy,
    kroki: kroki
  };

  if (wNode) module.exports = definicja;
  else root.Zjawiska.rejestruj(definicja);
})(typeof self !== 'undefined' ? self : this);
