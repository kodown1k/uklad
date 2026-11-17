/* ============================================================
   maneuver.js — manewry impulsowe w bazie PNR (prograde/normal/radial).
   Czysta matematyka, IIFE, testowane. Reużywa Orbit (rv2coe); helpery wektorowe lokalne.
   ============================================================ */
(function (root) {
  'use strict';
  var Orbit = (typeof require !== 'undefined') ? require('./orbit.js') : root.Orbit;
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
  function norm(a) { return Math.sqrt(dot(a, a)); }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
  function scale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
  function unit(a) { var n = norm(a); return n > 0 ? scale(a, 1 / n) : { x: 0, y: 0, z: 0 }; }

  function frame(r, v) {
    var pro = unit(v);
    var nor = unit(cross(r, v));
    var rad = cross(pro, nor);            // praworęczne; NIE r/|r| (nie ⟂ v poza apsydą)
    return { pro: pro, nor: nor, rad: rad };
  }
  function pnrToVec(pnr, f) { return add(add(scale(f.pro, pnr.pro || 0), scale(f.nor, pnr.nor || 0)), scale(f.rad, pnr.rad || 0)); }
  function vecToPnr(vec, f) { return { pro: dot(vec, f.pro), nor: dot(vec, f.nor), rad: dot(vec, f.rad) }; }
  function thrustDirection(r, v, intent) {
    var f = frame(r, v);
    switch (intent) {
      case 'prograde': return f.pro;
      case 'retrograde': return scale(f.pro, -1);
      case 'normal': return f.nor;
      case 'antinormal': return scale(f.nor, -1);
      case 'radialOut': return f.rad;
      case 'radialIn': return scale(f.rad, -1);
      default: return f.pro;
    }
  }
  function applyDV(v, dirUnit, dvKmS) { return add(v, scale(dirUnit, dvKmS)); }
  function applyImpulse(state, pnr) {
    var f = frame(state.r, state.v);
    var dvVec = pnrToVec(pnr, f);
    var v2 = add(state.v, dvVec);
    var coe2 = Orbit.rv2coe(state.r, v2, state.mu, state.t || 0);
    return { state2: { r: state.r, v: v2, mu: state.mu, t: state.t || 0 }, coe2: coe2, dvVec: dvVec, dvMag: norm(dvVec) };
  }
  function orbitInfo(coe, mu) {
    var e = coe.e, a = coe.a, p = (coe.p != null) ? coe.p : a * (1 - e * e), sp = Math.sqrt(mu / p), ell = e < 1;
    return { rApo: ell ? a * (1 + e) : Infinity, rPeri: a * (1 - e), period: ell ? 2 * Math.PI * Math.sqrt(a * a * a / mu) : Infinity, vApo: ell ? sp * (1 - e) : null, vPeri: sp * (1 + e), eccentric: e };
  }

  var Maneuver = { frame: frame, pnrToVec: pnrToVec, vecToPnr: vecToPnr, thrustDirection: thrustDirection, applyDV: applyDV, applyImpulse: applyImpulse, orbitInfo: orbitInfo };
  if (typeof module !== 'undefined' && module.exports) module.exports = Maneuver;
  else root.Maneuver = Maneuver;
})(typeof window !== 'undefined' ? window : globalThis);
