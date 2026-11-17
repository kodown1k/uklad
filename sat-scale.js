/* ============================================================
   sat-scale.js — skala pozycji satelity ECI [km] → lokalna scena wokół Ziemi.
   Czysta matematyka, bez zależności DOM/THREE.
   ============================================================ */
(function (root) {
  'use strict';
  // ECI [km] → pozycja względem środka Ziemi w jednostkach sceny.
  // Promień = (|eci|/earthRadiusKm)·earthMeshR; oś ECI Z → scena y (góra).
  function eciToEarthLocal(eci, earthRadiusKm, earthMeshR) {
    var mag = Math.sqrt(eci.x*eci.x + eci.y*eci.y + eci.z*eci.z) || 1;
    var rScene = (mag / earthRadiusKm) * earthMeshR;
    var s = rScene / mag;                          // skala zachowująca kierunek
    return { x: eci.x * s, y: eci.z * s, z: eci.y * s };
  }
  var SatScale = { eciToEarthLocal: eciToEarthLocal };
  if (typeof module !== 'undefined' && module.exports) module.exports = SatScale;
  else root.SatScale = SatScale;
})(typeof window !== 'undefined' ? window : globalThis);
