'use strict';
/* Matematyka kadru „Żywej Ziemi" — czysta, bez DOM/THREE (jak focus-scale.js).
   approachT: rampa zbliżenia kamery napędzająca uniform uApproach, który choreografuje
   ujawnianie efektów. 0 z daleka (Ziemia to kropka — tylko sylwetka), 1 blisko (pełnia życia).
   Zakres dobrany względem promienia efektywnego, więc działa w skali poglądowej i „Prawdziwej". */
(function (root) {
  function approachT(d, r) {
    if (!(r > 0)) return 0;
    var t = (r * 12 - d) / (r * 9);          // 0 przy d=12r, 1 przy d=3r
    return t < 0 ? 0 : (t > 1 ? 1 : t);
  }
  var api = { approachT: approachT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EarthFX = api;
})(typeof self !== 'undefined' ? self : this);
