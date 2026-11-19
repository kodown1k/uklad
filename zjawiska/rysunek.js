'use strict';
/* Zjawiska naukowe — wspólne narzędzia budowy scen (prymitywy Three.js) dla plików zjawisk.
   Jedno źródło dla helperów, które każde zjawisko kopiowało u siebie (materiały, linie, rury, kule, grot,
   poświaty). Różnice między zjawiskami to opcje, nie osobne kopie:
     - `linia(..., { glebia: false })` → materiał linii z `depthWrite: false`,
     - `matL(c, kolor, o, jasnosc)` → kolor Lamberta przemnożony przez `jasnosc` (domyślnie bez zmiany),
     - `poswiata(..., stopy)` / `teksturaRadialna` → własne stopy gradientu (tekstura w pamięci na kolor+stopy).
   Wszystko wołane tylko w przeglądarce, z `ctx` widoku (`c.THREE`, `c.kolor`). Plik nie zależy od THREE przy
   wczytaniu, więc w node (testy treści) `require` działa bez sceny. Dual-export: `window.ZjawiskaRysunek`. */
(function (root) {
  var TAU = Math.PI * 2;

  function pol(T, r, fi, y) { return new T.Vector3(r * Math.cos(fi), y || 0, -r * Math.sin(fi)); }
  function mat(c, kolor, o) { return new c.THREE.MeshBasicMaterial(Object.assign({ color: c.kolor(kolor) }, o || {})); }
  function matL(c, kolor, o, jasnosc) {
    var m = new c.THREE.MeshLambertMaterial(Object.assign({ color: c.kolor(kolor) }, o || {}));
    if (jasnosc != null) m.color.multiplyScalar(jasnosc);
    return m;
  }
  function przezr(c, kolor, krycie, o) { return mat(c, kolor, Object.assign({ transparent: true, opacity: krycie, depthWrite: false }, o || {})); }

  function linia(c, punkty, kolor, o) {
    var T = c.THREE; o = o || {};
    var g = new T.BufferGeometry().setFromPoints(punkty);
    var p = { color: c.kolor(kolor), transparent: true, opacity: o.krycie == null ? 1 : o.krycie };
    if (o.glebia === false) p.depthWrite = false;
    var m = o.kreski
      ? new T.LineDashedMaterial(Object.assign(p, { dashSize: o.kreski[0], gapSize: o.kreski[1] }))
      : new T.LineBasicMaterial(p);
    var l = new T.Line(g, m);
    if (o.kreski) l.computeLineDistances();
    return l;
  }
  function punktyOkregu(T, r, n, y) { var p = []; for (var i = 0; i <= n; i++) p.push(pol(T, r, i / n * TAU, y)); return p; }
  function okrag(c, r, kolor, o) { return linia(c, punktyOkregu(c.THREE, r, 128, (o && o.y) || 0), kolor, o); }
  function rura(c, punkty, promien, kolor, o) {
    var T = c.THREE;
    var krzywa = (typeof punkty.getPoint === 'function') ? punkty : new T.CatmullRomCurve3(punkty, !!(o && o.zamknieta));
    var g = new T.TubeGeometry(krzywa, (o && o.odcinki) || 96, promien, 6, !!(o && o.zamknieta));
    var m = new T.Mesh(g, (o && o.material) || mat(c, kolor, o && o.mat));
    m.userData.krzywa = krzywa;      // druga rura po tej samej krzywej (np. poświata wokół trzonu)
    return m;
  }

  // Tekstura z radialnego gradientu w kolorze `kolor`: stopy [[pozycja, krycie], …], r0 = promień wewnętrzny
  // (ułamek). Jedna tekstura na (kolor, stopy, rozmiar) — trzymana w `c._tekstury`.
  function teksturaRadialna(c, kolor, stopy, rozmiar, r0) {
    var T = c.THREE, n = rozmiar || 64, klucz = kolor + '|' + n + '|' + (r0 || 0) + '|' + JSON.stringify(stopy);
    c._tekstury = c._tekstury || {};
    if (!c._tekstury[klucz]) {
      var cv = document.createElement('canvas'); cv.width = cv.height = n;
      var h = n / 2, x = cv.getContext('2d'), g = x.createRadialGradient(h, h, (r0 || 0) * h, h, h, h), k = c.kolor(kolor);
      var rgb = Math.round(k.r * 255) + ',' + Math.round(k.g * 255) + ',' + Math.round(k.b * 255);
      stopy.forEach(function (s) { g.addColorStop(s[0], 'rgba(' + rgb + ',' + s[1] + ')'); });
      x.fillStyle = g; x.fillRect(0, 0, n, n);
      c._tekstury[klucz] = new T.CanvasTexture(cv);
    }
    return c._tekstury[klucz];
  }
  var STOPY_POSWIATY = [[0, 1], [0.25, 0.45], [1, 0]];
  // Miękka poświata (sprite addytywny) — tania namiastka bloomu przy samym obiekcie.
  function poswiata(c, kolor, rozmiar, krycie, stopy) {
    var T = c.THREE;
    var sp = new T.Sprite(new T.SpriteMaterial({ map: teksturaRadialna(c, kolor, stopy || STOPY_POSWIATY), transparent: true, opacity: krycie == null ? 0.8 : krycie, depthWrite: false, blending: T.AdditiveBlending }));
    sp.scale.set(rozmiar, rozmiar, 1);
    return sp;
  }
  function kula(c, r, kolor, o) { return new c.THREE.Mesh(new c.THREE.SphereGeometry(r, 20, 14), (o && o.material) || mat(c, kolor, o)); }
  var OS_Y = null;
  function skieruj(T, obiekt, kier) {            // ustaw oś +y obiektu (stożek, walec) wzdłuż `kier`
    OS_Y = OS_Y || new T.Vector3(0, 1, 0);
    obiekt.quaternion.setFromUnitVectors(OS_Y, kier.clone().normalize());
  }
  function grot(c, kolor, rozmiar) {
    var s = rozmiar || 0.12;
    return new c.THREE.Mesh(new c.THREE.ConeGeometry(s * 0.55, s * 1.6, 12), mat(c, kolor));
  }

  var API = {
    TAU: TAU, pol: pol, mat: mat, matL: matL, przezr: przezr, linia: linia, punktyOkregu: punktyOkregu, okrag: okrag,
    rura: rura, teksturaRadialna: teksturaRadialna, poswiata: poswiata, kula: kula, skieruj: skieruj, grot: grot
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.ZjawiskaRysunek = API;
})(typeof self !== 'undefined' ? self : this);
