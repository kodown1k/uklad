/* ============================================================
   sky-math.js — transformacja współrzędnych nieba do układu sceny.
   Równikowe J2000 (RA/Dec) → ekliptyczne (obrót o −ε wokół X) → scena (y-up).
   Czysta matematyka (bez DOM/THREE). UMD jak ephemeris.js.
   ============================================================ */
(function (root) {
  'use strict';
  var DEG = Math.PI / 180;
  var EPS = 23.43928 * DEG;          // nachylenie ekliptyki (J2000)

  // RA[°], Dec[°] → wektor jednostkowy w układzie sceny (y-up jak eclToScene).
  function raDecToSceneDir(raDeg, decDeg){
    var ra = raDeg * DEG, dec = decDeg * DEG;
    // równikowy wektor jednostkowy
    var ex = Math.cos(dec) * Math.cos(ra);
    var ey = Math.cos(dec) * Math.sin(ra);
    var ez = Math.sin(dec);
    // obrót o −ε wokół osi X (równikowy → ekliptyczny)
    var ax = ex;
    var ay = ey * Math.cos(EPS) + ez * Math.sin(EPS);
    var az = -ey * Math.sin(EPS) + ez * Math.cos(EPS);
    // mapowanie sceny y-up (ekliptyczne z → scena y, ekliptyczne y → scena z) — jak eclToScene
    return { x: ax, y: az, z: ay };
  }

  var api = { raDecToSceneDir: raDecToSceneDir, EPS: EPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SkyMath = api;
})(typeof self !== 'undefined' ? self : this);
