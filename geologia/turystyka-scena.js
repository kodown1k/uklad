'use strict';
/* Zakładka Geologia → makieta — kompas i warstwa turystyczna (Task 7b). Dual-export: czysta część w node
   (module.exports), w przeglądarce window.GeologiaTurystykaScena.
   Czysta część:
     Kompas.azymutKamery(poz, cel) → stopnie [0, 360): 0 = kamera patrzy na północ (−z), 90 = na wschód (+x);
     Kompas.pozaWidoku(nazwa, bbox) → { poz, cel, kier, d } | null — widoki „poludnie” (kamera na S od wyspy, patrzy na N,
       25 km nad morzem, pochylenie 35°), „polnoc” (lustrzany), „gora” (pion, N w górę ekranu: kamera 0,25° na S od pionu);
       bbox = zasięg lądu { x0, x1, z0, z1 } w układzie makiety (km). Odległość dopasowuje do proporcji ekranu widok.js
       (wzdłuż `kier`, nigdy bliżej niż `d`).
     przygotujTrase(trasa, punkty, Teren) → { xz, dl, przer, przerOd, odsun, indeksy } — linia w układzie makiety zagęszczona
       do ≤ 0,1 km (drapowanie po terenie), długość narastająca [km], przerywanie (trasa `przyblizona` cała; odcinek
       dodatkowy od wierzchołka najbliższego punktu `odcinekDodatkowy.od`), rozsunięcie nitek odnóg „tam i z powrotem”
       (0…1, zbiega do zera 0,3 km od końców odnogi; kierunek przesunięcia = prawa strona kierunku marszu na ekranie,
       więc nitka „tam” i „z powrotem” rozchodzą się same), indeksy wierzchołków oryginału w linii zagęszczonej.
     kolorTransportu(t) → '#rrggbb'; NAZWY_TRANSPORTU.
     linkBezpieczny(url) → url, gdy zaczyna się od `https://`, inaczej null (href z danych: bez `javascript:`, `data:`, `http:`).
   Przeglądarka: utworzWarstwe(T, sc, D) — warstwa przez hak sceny `sc.dodajWarstwe` (zasoby GPU przez helper z() sceny,
   G-L: zwalnia je sc.zwolnij()). Linie tras: pasek z trójkątów o stałej grubości w pikselach (shader rozsuwa wierzchołki
   w przestrzeni ekranu; Line2 nie ma w vendor/), wysokość = wyświetlana powierzchnia „dziś” (km, bez przewyższenia) ×
   uPrzew (wspólny uniform przewyższenia terenu — animowana zmiana idzie sama) + 25 m, wierzchołki przyciągnięte do kamery
   o min(0,4% odległości; 150 m) — linia nie znika w trójkątach terenu. Piny punktów (Hard Rock Hotel i baza wyróżnione)
   i etykiety ze sprite'ów stałej wielkości; etykiety rozrzedzane w kolejności priorytetu, ich prostokąty zajmują miejsce
   etykietom części (scena). Warstwa liczona z dzisiejszej rzeźby: widok.js pokazuje ją tylko przy czasie = dziś. */
(function (root) {
  var Teren = root.Teren || (typeof require === 'function' ? require('./teren.js') : null);
  var RAD = Math.PI / 180;
  var WIDOKI = ['poludnie', 'polnoc', 'gora'];
  var KROK_KM = 0.1, RAMPA_KM = 0.3;
  var KOLORY = { pieszo: '#5fd4ff', auto: '#ffd23f', autobus: '#ff5fa8' };
  var NAZWY_TRANSPORTU = { pieszo: 'pieszo', auto: 'autem', autobus: 'autobus' };

  /* ---------- czysta część ---------- */
  function azymutKamery(poz, cel) {
    var dx = cel[0] - poz[0], dz = cel[2] - poz[2];
    if (Math.hypot(dx, dz) < 1e-9) return 0;
    var a = Math.atan2(dx, -dz) / RAD;
    a = (a % 360 + 360) % 360;
    return a >= 360 ? 0 : a;
  }
  function pozaWidoku(nazwa, bb) {
    if (WIDOKI.indexOf(nazwa) < 0 || !bb) return null;
    var cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2, kier, d;
    if (nazwa === 'gora') {
      var H = Math.max(bb.x1 - bb.x0, bb.z1 - bb.z0) / 2 / Math.tan(20 * RAD) * 1.15, odchyl = Math.tan(0.25 * RAD);
      d = H * Math.hypot(1, odchyl); kier = [0, 1 / Math.hypot(1, odchyl), odchyl / Math.hypot(1, odchyl)];
    } else {
      var el = 35 * RAD, zn = nazwa === 'poludnie' ? 1 : -1;
      d = 25 / Math.sin(el); kier = [0, Math.sin(el), zn * Math.cos(el)];
    }
    return { poz: [cx + kier[0] * d, kier[1] * d, cz + kier[2] * d], cel: [cx, 0, cz], kier: kier, d: d };
  }

  function gladko(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function przygotujTrase(trasa, punkty, Tr) {
    Tr = Tr || Teren;
    var org = trasa.linia.map(function (ll) { return Tr.doLokalnych(null, ll[0], ll[1]); });
    var xz = [], dl = [], indeksy = [], s = 0;
    for (var i = 0; i < org.length; i++) {
      if (i > 0) {
        var a = org[i - 1], b = org[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / KROK_KM - 1e-9));
        for (var j = 1; j < k; j++) { xz.push(a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k); s += L / k; dl.push(s); }
        s += L / k;
      }
      indeksy.push(xz.length / 2); xz.push(org[i][0], org[i][1]); dl.push(s);
    }
    var n = xz.length / 2, przer = new Uint8Array(n), odsun = new Float32Array(n), przerOd = -1;
    if (trasa.przyblizona) { przer.fill(1); przerOd = 0; }
    else if (trasa.odcinekDodatkowy) {
      var p = (punkty || []).filter(function (x) { return x.id === trasa.odcinekDodatkowy.od; })[0];
      if (p) {
        var q = Tr.doLokalnych(null, p.lonLat[0], p.lonLat[1]), dMin = Infinity;
        for (i = 0; i < n; i++) { var d = Math.hypot(xz[i * 2] - q[0], xz[i * 2 + 1] - q[1]); if (d < dMin) { dMin = d; przerOd = i; } }
        for (i = przerOd; i < n; i++) przer[i] = 1;
      }
    }
    (trasa.odnogi || []).forEach(function (o) {
      var ia = indeksy[o.od], ib = indeksy[o.do];
      if (ia == null || ib == null || ib <= ia) return;
      for (var m = ia; m <= ib; m++) odsun[m] = gladko(Math.min((dl[m] - dl[ia]) / RAMPA_KM, (dl[ib] - dl[m]) / RAMPA_KM));
      odsun[ia] = 0; odsun[ib] = 0;
    });
    return { xz: new Float64Array(xz), dl: new Float64Array(dl), przer: przer, przerOd: przerOd, odsun: odsun, indeksy: indeksy };
  }
  function kolorTransportu(t) { return KOLORY[t] || '#ffffff'; }
  function linkBezpieczny(url) { return typeof url === 'string' && /^https:\/\//.test(url) ? url : null; }

  var Kompas = { azymutKamery: azymutKamery, pozaWidoku: pozaWidoku, WIDOKI: WIDOKI };
  var api = { Kompas: Kompas, przygotujTrase: przygotujTrase, kolorTransportu: kolorTransportu, NAZWY_TRANSPORTU: NAZWY_TRANSPORTU,
    linkBezpieczny: linkBezpieczny,
    KOLORY: KOLORY, utworzWarstwe: null };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---------- przeglądarka: warstwa 3D ---------- */
  var LINIA_VERT = [
    'attribute vec3 aPoprz; attribute vec3 aNast; attribute float aStrona; attribute float aDl; attribute float aOdsun; attribute float aPrzer;',
    'uniform float uPrzew; uniform float uNad; uniform vec2 uRozdz; uniform float uSzer; uniform float uOdsunPx;',
    'varying float vStrona; varying float vDl; varying float vPrzer;',
    // wysokość: powierzchnia „dziś” [km] × przewyższenie + 25 m; przyciągnięcie do kamery o min(0,4% odległości; 150 m)
    'vec4 geRzut(vec3 p) {',
    '  vec4 mv = modelViewMatrix * vec4(p.x, max(p.y, 0.0) * uPrzew + uNad, p.z, 1.0);',
    '  float d = length(mv.xyz);',
    '  mv.xyz -= mv.xyz / max(d, 1e-6) * min(0.004 * d, 0.15);',
    '  return projectionMatrix * mv;',
    '}',
    'void main() {',
    '  vec4 c = geRzut(position), a = geRzut(aPoprz), b = geRzut(aNast);',
    '  vec2 asp = vec2(uRozdz.x / uRozdz.y, 1.0);',
    '  vec2 sc = c.xy / c.w * asp, d1 = sc - a.xy / a.w * asp, d2 = b.xy / b.w * asp - sc;',
    '  float l1 = length(d1), l2 = length(d2);',
    '  vec2 kier = l1 < 1e-7 ? d2 / max(l2, 1e-7) : l2 < 1e-7 ? d1 / l1 : d1 / l1 + d2 / l2;',
    '  if (length(kier) < 1e-3) kier = d1 / max(l1, 1e-7);',            // zwrot nitki: kierunek dojścia
    '  kier = normalize(kier);',
    '  vec2 n = vec2(-kier.y, kier.x);',
    '  float px = uSzer * 0.5 * aStrona - uOdsunPx * aOdsun;',            // −: prawa strona kierunku marszu
    '  vec2 off = n * px * 2.0 / uRozdz.y; off.x /= asp.x;',
    '  gl_Position = c; gl_Position.xy += off * c.w;',
    '  vStrona = aStrona; vDl = aDl; vPrzer = aPrzer;',
    '}'
  ].join('\n');
  var LINIA_FRAG = [
    'uniform vec3 uKolor; uniform float uOkres; uniform float uWyb;',
    'varying float vStrona; varying float vDl; varying float vPrzer;',
    'void main() {',
    '  if (vPrzer > 0.5 && fract(vDl / uOkres) > 0.58) discard;',
    '  float e = abs(vStrona);',
    '  vec3 c = mix(uKolor, vec3(1.0), 0.25 * uWyb);',
    '  c = mix(c, vec3(0.03, 0.035, 0.045), smoothstep(0.52, 0.72, e));',      // ciemna obwódka: linia czytelna na każdym tle
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  var WYGLAD_PINOW = {
    hotel: { kolor: '#ff3b6b', px: 22, prio: 100 }, baza: { kolor: '#ffd23f', px: 15, prio: 6 },
    start: { kolor: '#9be37b', px: 11, prio: 50 }, cel: { kolor: '#9be37b', px: 10, prio: 40 },
    'punkt-widokowy': { kolor: '#ffffff', px: 10, prio: 38 }, latarnia: { kolor: '#ffffff', px: 10, prio: 36 },
    atrakcja: { kolor: '#ffffff', px: 10, prio: 34 }, plaza: { kolor: '#7fe0ff', px: 10, prio: 30 },
    przystanek: { kolor: '#7fb7ff', px: 8, prio: 0 }
  };
  var SKALA_ET = 0.56;

  function plotno(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function kolorV(T, hex) { var c = new T.Color(hex); return new T.Vector3(c.r, c.g, c.b); }   // sRGB wprost (toneMapped: false)
  function krotkaNazwa(p) { return p.rodzaj === 'hotel' ? 'Hard Rock Hotel' : p.rodzaj === 'baza' ? 'Baza' : p.nazwa.split(/ — | \(| nr /)[0]; }

  function utworzWarstwe(T, sc, D) {
    return sc.dodajWarstwe(function (ctx) {
      var z = ctx.z, grupa = new T.Group();
      grupa.name = 'turystyka'; grupa.visible = false;
      ctx.scena.add(grupa);
      var e0 = ctx.przewyzszenie();
      var hDzis = function (x, zz) { var h = ctx.wysokosc(x, zz); return h == null ? 0 : Math.max(0, h / e0); };
      var wsp = { uPrzew: ctx.uPrzew, uNad: { value: 0.025 }, uRozdz: { value: new T.Vector2(1, 1) }, uOdsunPx: { value: 3 } };
      var trasy = [], wybrana = null, wybranyPunkt = null;

      (D.trasy || []).forEach(function (t) {
        var r = przygotujTrase(t, D.punkty, Teren), n = r.xz.length / 2;
        var h = new Float32Array(n);
        for (var i = 0; i < n; i++) h[i] = hDzis(r.xz[i * 2], r.xz[i * 2 + 1]);
        var pos = new Float32Array(n * 6), pop = new Float32Array(n * 6), nas = new Float32Array(n * 6);
        var str = new Float32Array(n * 2), dl = new Float32Array(n * 2), ods = new Float32Array(n * 2), prz = new Float32Array(n * 2);
        var idx = new (n * 2 > 65535 ? Uint32Array : Uint16Array)(Math.max(0, n - 1) * 6);
        for (i = 0; i < n; i++) {
          var ip = Math.max(0, i - 1), inx = Math.min(n - 1, i + 1);
          for (var s = 0; s < 2; s++) {
            var v = i * 2 + s;
            pos.set([r.xz[i * 2], h[i], r.xz[i * 2 + 1]], v * 3);
            pop.set([r.xz[ip * 2], h[ip], r.xz[ip * 2 + 1]], v * 3);
            nas.set([r.xz[inx * 2], h[inx], r.xz[inx * 2 + 1]], v * 3);
            str[v] = s ? -1 : 1; dl[v] = r.dl[i]; ods[v] = r.odsun[i]; prz[v] = r.przer[i];
          }
          if (i < n - 1) idx.set([i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2], i * 6);
        }
        var g = z(new T.BufferGeometry());
        g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aPoprz', new T.BufferAttribute(pop, 3));
        g.setAttribute('aNast', new T.BufferAttribute(nas, 3)); g.setAttribute('aStrona', new T.BufferAttribute(str, 1));
        g.setAttribute('aDl', new T.BufferAttribute(dl, 1)); g.setAttribute('aOdsun', new T.BufferAttribute(ods, 1));
        g.setAttribute('aPrzer', new T.BufferAttribute(prz, 1)); g.setIndex(new T.BufferAttribute(idx, 1));
        var u = { uPrzew: wsp.uPrzew, uNad: wsp.uNad, uRozdz: wsp.uRozdz, uOdsunPx: wsp.uOdsunPx,
          uSzer: { value: 5 }, uKolor: { value: kolorV(T, kolorTransportu(t.transport)) }, uOkres: { value: 0.3 }, uWyb: { value: 0 } };
        var m = z(new T.ShaderMaterial({ uniforms: u, vertexShader: LINIA_VERT, fragmentShader: LINIA_FRAG, fog: false, toneMapped: false,
          depthWrite: false, side: T.DoubleSide }));
        var mesh = new T.Mesh(g, m);
        mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.name = 'trasa-' + t.id;
        grupa.add(mesh);
        // środek i zasięg (kadr „Plan dni”, okres przerywania)
        var bb = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, h: 0, hMin: Infinity };
        for (i = 0; i < n; i++) {
          bb.x0 = Math.min(bb.x0, r.xz[i * 2]); bb.x1 = Math.max(bb.x1, r.xz[i * 2]);
          bb.z0 = Math.min(bb.z0, r.xz[i * 2 + 1]); bb.z1 = Math.max(bb.z1, r.xz[i * 2 + 1]); bb.h = Math.max(bb.h, h[i]); bb.hMin = Math.min(bb.hMin, h[i]);
        }
        trasy.push({ t: t, r: r, h: h, u: u, mesh: mesh, bb: bb, srodek: new T.Vector3((bb.x0 + bb.x1) / 2, 0, (bb.z0 + bb.z1) / 2) });
      });

      // piny punktów
      var kropka = (function () {
        var c = plotno(64, 64), x = c.getContext('2d');
        x.beginPath(); x.arc(32, 32, 25, 0, Math.PI * 2); x.fillStyle = '#ffffff'; x.fill();
        x.lineWidth = 8; x.strokeStyle = 'rgba(8,11,15,0.9)'; x.stroke();
        var t = z(new T.CanvasTexture(c)); t.encoding = T.sRGBEncoding; return t;
      })();
      var piny = [];
      (D.punkty || []).forEach(function (p) {
        var w = WYGLAD_PINOW[p.rodzaj] || WYGLAD_PINOW.atrakcja, q = Teren.doLokalnych(null, p.lonLat[0], p.lonLat[1]);
        var glowa = new T.Sprite(z(new T.SpriteMaterial({ map: kropka, color: new T.Color(w.kolor), sizeAttenuation: false, depthTest: false, fog: false, toneMapped: false })));
        glowa.renderOrder = 14; glowa.name = 'pin-' + p.id;
        grupa.add(glowa);
        var pin = { p: p, x: q[0], z: q[1], glowa: glowa, w: w, et: null, px: null, widoczna: false, poz: new T.Vector3(), q: new T.Vector3() };
        if (w.prio > 0) {
          var tekst = krotkaNazwa(p), hotel = p.rodzaj === 'hotel';
          var c = plotno(8, 8), x = c.getContext('2d'), F = hotel ? 30 : 26, pad = 10, font = (hotel ? '700 ' : '600 ') + F + 'px system-ui, "Segoe UI", sans-serif';
          x.font = font;
          var szer = Math.ceil(x.measureText(tekst).width) + pad * 2, wys = F + 16;
          c.width = szer; c.height = wys; x = c.getContext('2d'); x.font = font;
          x.fillStyle = hotel ? 'rgba(190,24,70,0.92)' : 'rgba(8,11,15,0.72)'; x.fillRect(0, 0, szer, wys);
          x.fillStyle = '#ffffff'; x.textBaseline = 'middle'; x.fillText(tekst, pad, wys / 2 + 1);
          var tEt = z(new T.CanvasTexture(c)); tEt.encoding = T.sRGBEncoding; tEt.minFilter = T.LinearFilter; tEt.generateMipmaps = false;
          var et = new T.Sprite(z(new T.SpriteMaterial({ map: tEt, sizeAttenuation: false, depthTest: false, fog: false, toneMapped: false })));
          et.center.set(0.5, -0.45); et.renderOrder = 15; et.visible = false;
          grupa.add(et);
          pin.et = et; pin.px = [szer, wys];
        }
        piny.push(pin);
      });
      piny.sort(function (a, b) { return b.w.prio - a.w.prio; });
      var eUst = null;
      function ustawPiny() {
        var e = ctx.przewyzszenie();
        if (e === eUst) return;
        eUst = e;
        piny.forEach(function (P) {
          var y = Math.max(0, ctx.wysokosc(P.x, P.z) || 0) + 0.02;
          P.poz.set(P.x, y, P.z); P.glowa.position.copy(P.poz); if (P.et) P.et.position.copy(P.poz);
        });
      }

      var rozmB = new T.Vector2(), rozm = new T.Vector2(), wek = new T.Vector3(), zajete = [];
      function rzut(v, q) { wek.copy(v).project(ctx.kamera); q.set((wek.x + 1) / 2 * rozm.x, (1 - wek.y) / 2 * rozm.y, wek.z); return q; }
      // klatka: uniformy ekranu, wielkość pinów, rozrzedzanie etykiet; zwraca prostokąty zajęte przez warstwę [x0,y0,x1,y1,…] (px CSS)
      function animuj() {
        zajete.length = 0;
        if (!grupa.visible) return zajete;
        var k = ctx.kamera, r = ctx.renderer, pr = r.getPixelRatio();
        r.getDrawingBufferSize(rozmB); r.getSize(rozm);
        wsp.uRozdz.value.copy(rozmB); wsp.uOdsunPx.value = 3 * pr;
        // km na piksel urządzenia na odległości środka trasy — okres przerywania ok. 14 px na ekranie
        var kPx = 2 * Math.tan(k.fov * RAD / 2) / Math.max(1, rozmB.y);
        trasy.forEach(function (tr) {
          tr.u.uSzer.value = (tr.t.id === wybrana ? 8 : 5) * pr; tr.u.uWyb.value = tr.t.id === wybrana ? 1 : 0;
          tr.srodek.y = tr.bb.h * ctx.przewyzszenie();
          tr.u.uOkres.value = Math.max(0.005, k.position.distanceTo(tr.srodek) * kPx * 14 * pr);
        });
        ustawPiny();
        var kk = 2 * Math.tan(k.fov * RAD / 2) / Math.max(1, rozm.y);
        // kolejność priorytetu (Hard Rock Hotel pierwszy, wybrany punkt przed wszystkimi): etykietę blokują tylko kropki
        // i etykiety pinów wcześniejszych — drobne kropki (przystanki, końce tras) nie gaszą napisu hotelu
        var kolej = piny.slice().sort(function (a, b) { return (b.p.id === wybranyPunkt) - (a.p.id === wybranyPunkt) || b.w.prio - a.w.prio; });
        for (var i = 0; i < kolej.length; i++) {
          var P = kolej[i], s = (P.p.id === wybranyPunkt ? P.w.px + 6 : P.w.px) * kk;
          P.glowa.scale.set(s, s, 1);
          rzut(P.poz, P.q);
          if (P.et) {
            var w = P.px[0] * SKALA_ET, h = P.px[1] * SKALA_ET;
            P.et.scale.set(w * kk, h * kk, 1);
            var x0 = P.q.x - w / 2, y1 = P.q.y - 0.45 * h - 2, y0 = y1 - h;
            var ok = P.q.z < 1 && x0 + w > 0 && x0 < rozm.x && y0 > 0 && P.q.y < rozm.y;
            for (var j = 0; ok && j < zajete.length; j += 4) {
              if (x0 < zajete[j + 2] && x0 + w > zajete[j] && y0 < zajete[j + 3] && y1 > zajete[j + 1]) ok = false;
            }
            P.et.visible = P.widoczna = ok;
          }
          if (P.q.z < 1) { var r0 = P.w.px >= 14 ? P.w.px / 2 + 2 : 3; zajete.push(P.q.x - r0, P.q.y - r0, P.q.x + r0, P.q.y + r0); }
          if (P.et && P.widoczna) zajete.push(x0 - 4, y0 - 2, x0 + w + 4, y1 + 2);
        }
        return zajete;
      }

      // wskazywanie: pin (≤ 16 px, priorytet hotelu przy nakładaniu), potem trasa (≤ 10 px od odcinka)
      var qa = new T.Vector3(), qb = new T.Vector3(), va = new T.Vector3(), vb = new T.Vector3();
      function pick(nx, ny) {
        if (!grupa.visible) return null;
        ctx.kamera.updateMatrixWorld(); ctx.renderer.getSize(rozm);
        var kx = (nx + 1) / 2 * rozm.x, ky = (1 - ny) / 2 * rozm.y, najl = null, ocena = Infinity, e = ctx.przewyzszenie();
        ustawPiny();
        piny.forEach(function (P) {
          rzut(P.poz, P.q);
          if (P.q.z >= 1) return;
          var d = Math.hypot(P.q.x - kx, P.q.y - ky);
          if (d > Math.max(16, P.w.px / 2 + 4)) return;
          var o = d - P.w.prio / 15;
          if (o < ocena) { ocena = o; najl = { typ: 'punkt', id: P.p.id }; }
        });
        if (najl) return najl;
        var dMin = 10;
        trasy.forEach(function (tr) {
          var r = tr.r, n = r.xz.length / 2;
          for (var i = 0; i < n; i++) {
            va.set(r.xz[i * 2], tr.h[i] * e + 0.025, r.xz[i * 2 + 1]); rzut(va, qb);
            if (i > 0 && qa.z < 1 && qb.z < 1) {
              var ex = qb.x - qa.x, ey = qb.y - qa.y, L2 = ex * ex + ey * ey;
              var t = L2 > 0 ? Math.max(0, Math.min(1, ((kx - qa.x) * ex + (ky - qa.y) * ey) / L2)) : 0;
              var d = Math.hypot(qa.x + ex * t - kx, qa.y + ey * t - ky);
              if (d < dMin) { dMin = d; najl = { typ: 'trasa', id: tr.t.id }; }
            }
            qa.copy(qb);
          }
        });
        return najl;
      }

      return {
        grupa: grupa, animuj: animuj, pick: pick,
        widoczna: function (wl) { if (wl != null) { grupa.visible = !!wl; eUst = null; } return grupa.visible; },
        wybierz: function (typ, id) { wybrana = typ === 'trasa' ? id : null; wybranyPunkt = typ === 'punkt' ? id : null; },
        // haki widoku i sondy: rzut pinu na kanwę (px CSS), zasięg trasy w świecie, etykiety widoczne
        rzutPunktu: function (id) {
          var P = piny.filter(function (x) { return x.p.id === id; })[0];
          if (!P) return null;
          eUst = null; ustawPiny(); ctx.kamera.updateMatrixWorld(); ctx.renderer.getSize(rozm);
          rzut(P.poz, P.q);
          return { x: P.q.x, y: P.q.y, z: P.q.z };
        },
        // punkt linii trasy w świecie [x, y, z] w ułamku f długości (wierzchołek zagęszczonej linii)
        punktTrasy: function (id, f) {
          var tr = trasy.filter(function (x) { return x.t.id === id; })[0];
          if (!tr) return null;
          var n = tr.r.xz.length / 2, cel = Math.max(0, Math.min(1, +f || 0)) * tr.r.dl[n - 1], i = 0;
          while (i < n - 1 && tr.r.dl[i] < cel) i++;
          return [tr.r.xz[i * 2], tr.h[i] * ctx.przewyzszenie() + 0.025, tr.r.xz[i * 2 + 1]];
        },
        zasiegTrasy: function (id) {
          var tr = trasy.filter(function (x) { return x.t.id === id; })[0];
          if (!tr) return null;
          var e = ctx.przewyzszenie(), b = tr.bb;
          return { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, yMin: b.hMin * e, yMax: b.h * e };
        },
        stan: function () {
          return { widoczna: grupa.visible, trasy: trasy.length, piny: piny.length, wybrana: wybrana, wybranyPunkt: wybranyPunkt,
            etykiety: piny.filter(function (P) { return P.widoczna; }).map(function (P) { return P.p.id; }) };
        }
      };
    });
  }
  api.utworzWarstwe = utworzWarstwe;
  root.GeologiaTurystykaScena = api;
})(typeof window !== 'undefined' ? window : globalThis);
