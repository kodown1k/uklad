/* ============================================================
   soi.js — sfera wpływu (SOI): promień, prędkość planety, wybór ciała, rebase.
   Czysta matematyka, IIFE, testowane. Reużywa Orbit (stałe/helpery) + Ephemeris.
   Zakres M1: Słońce + planety heliocentryczne (REAL_PLANETS). SOI Księżyca → M2.
   ============================================================ */
(function (root) {
  'use strict';
  var Orbit = (typeof require !== 'undefined') ? require('./orbit.js') : root.Orbit;
  var Eph = (typeof require !== 'undefined') ? require('./ephemeris.js') : root.Ephemeris;
  var MU = Orbit.MU, AU_KM = Orbit.AU_KM, DAY_S = Orbit.DAY_S;
  var add = Orbit._add, sub = Orbit._sub, norm = Orbit._norm;

  // wielka półoś planety [AU] (do promienia SOI). M1: earth/mars istotne.
  var A_AU = { mercury: 0.387, venus: 0.723, earth: 1.0, mars: 1.524, jupiter: 5.203, saturn: 9.537, uranus: 19.19, neptune: 30.07 };
  function radiusSOI(planetId) { return A_AU[planetId] * AU_KM * Math.pow(MU[planetId] / MU.sun, 0.4); }

  function planetVelocity(planetEl, jd) {
    var h = 1e-3; // dzień
    var p1 = Eph.positionAt(planetEl, jd + h), p0 = Eph.positionAt(planetEl, jd - h);
    var f = AU_KM / DAY_S / (2 * h); // (AU/(2h dni)) → km/s
    return { x: (p1.x - p0.x) * f, y: (p1.y - p0.y) * f, z: (p1.z - p0.z) * f };
  }

  // candidates = [{id, posAU:{x,y,z}, rSOI_km}]. Histereza: wejście <0.99·rSOI, wyjście >1.01·rSOI.
  function dominantBody(rShipHelioAU, candidates, prevCenter) {
    for (var k = 0; k < candidates.length; k++) {
      var c = candidates[k];
      var dAU = norm(sub(rShipHelioAU, c.posAU));
      var rSOI_au = c.rSOI_km / AU_KM;
      var inside = (prevCenter === c.id) ? (dAU < rSOI_au * 1.01) : (dAU < rSOI_au * 0.99);
      if (inside) return c.id;
    }
    return 'sun';
  }

  function helioPosKm(id, jd) {
    if (id === 'sun') return { x: 0, y: 0, z: 0 };
    var el = Eph.REAL_PLANETS.find(function (p) { return p.id === id; });
    var p = Eph.positionAt(el, jd);
    return { x: p.x * AU_KM, y: p.y * AU_KM, z: p.z * AU_KM };
  }
  function helioVelKmS(id, jd) {
    if (id === 'sun') return { x: 0, y: 0, z: 0 };
    return planetVelocity(Eph.REAL_PLANETS.find(function (p) { return p.id === id; }), jd);
  }
  function rebase(state, oldId, newId, jd) {
    var dPos = sub(helioPosKm(oldId, jd), helioPosKm(newId, jd));
    var dVel = sub(helioVelKmS(oldId, jd), helioVelKmS(newId, jd));
    return { r: add(state.r, dPos), v: add(state.v, dVel), center: newId };
  }

  var Soi = { radiusSOI: radiusSOI, planetVelocity: planetVelocity, dominantBody: dominantBody, rebase: rebase, A_AU: A_AU };
  if (typeof module !== 'undefined' && module.exports) module.exports = Soi;
  else root.Soi = Soi;
})(typeof window !== 'undefined' ? window : globalThis);
