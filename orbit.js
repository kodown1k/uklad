/* ============================================================
   orbit.js — astrodynamika patched-conics dla statku (km, s, rad; mu km³/s²).
   Wektory {x,y,z}. Czysta matematyka, IIFE, testowane node --test. Reużywa Ephemeris.
   ============================================================ */
(function (root) {
  'use strict';
  var Eph = (typeof require !== 'undefined') ? require('./ephemeris.js')
          : (root.Ephemeris);

  var AU_KM = 1.495978707e8, DAY_S = 86400;
  var ECC_EPS = 1e-9, INC_EPS = 1e-9;
  var MU = { sun: 1.32712440018e11, earth: 398600.4418, mars: 42828.37, jupiter: 1.26687e8 };

  // --- wektory {x,y,z} ---
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
  function norm(a) { return Math.sqrt(dot(a, a)); }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
  function scale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  var TWO_PI = 2 * Math.PI;
  function wrap2pi(a) { a %= TWO_PI; return a < 0 ? a + TWO_PI : a; }
  // kąt między u,w z konwencją znaku (signRef<0 → 2π−kąt)
  function angleBetween(u, w, signRef) {
    var c = clamp(dot(u, w) / (norm(u) * norm(w)), -1, 1);
    var ang = Math.acos(c);
    return (signRef < 0) ? (TWO_PI - ang) : ang;
  }

  function kmVecToAU(r) { return { x: r.x / AU_KM, y: r.y / AU_KM, z: r.z / AU_KM }; }
  function eccToNu(E, e) { return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2)); }
  function hypToNu(H, e) { return 2 * Math.atan2(Math.sqrt(e + 1) * Math.sinh(H / 2), Math.sqrt(e - 1) * Math.cosh(H / 2)); }

  // kolumny macierzy obrotu perifokal→ekliptyka (te same 9 wyrazów co orbitalToEcliptic)
  function rotPQ(Om, i, w) {
    var cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(Om), sO = Math.sin(Om), ci = Math.cos(i), si = Math.sin(i);
    return {
      P: { x: cw * cO - sw * sO * ci, y: cw * sO + sw * cO * ci, z: sw * si },
      Q: { x: -sw * cO - cw * sO * ci, y: -sw * sO + cw * cO * ci, z: cw * si }
    };
  }

  function coe2rv(coe, mu) {
    var e = coe.e, p = coe.a * (1 - e * e);          // a<0,e>1 ⇒ p>0
    var nu = coe.nu, cn = Math.cos(nu), sn = Math.sin(nu);
    var r = p / (1 + e * cn), h = Math.sqrt(mu * p);
    var pq = rotPQ(coe.Om, coe.i, coe.w);
    var rx = r * cn, ry = r * sn;                    // perifokal pozycja
    var vx = -mu / h * sn, vy = mu / h * (e + cn);    // perifokal prędkość
    return {
      r: { x: pq.P.x * rx + pq.Q.x * ry, y: pq.P.y * rx + pq.Q.y * ry, z: pq.P.z * rx + pq.Q.z * ry },
      v: { x: pq.P.x * vx + pq.Q.x * vy, y: pq.P.y * vx + pq.Q.y * vy, z: pq.P.z * vx + pq.Q.z * vy }
    };
  }

  function rv2coe(r, v, mu, t0) {
    var rmag = norm(r), vmag2 = dot(v, v), rv = dot(r, v);
    var h = cross(r, v), hmag = norm(h);
    var nNode = { x: -h.y, y: h.x, z: 0 }, nmag = norm(nNode);
    var k = (vmag2 - mu / rmag);
    var evec = { x: (k * r.x - rv * v.x) / mu, y: (k * r.y - rv * v.y) / mu, z: (k * r.z - rv * v.z) / mu };
    var e = norm(evec);
    var energy = vmag2 / 2 - mu / rmag;
    var a = (Math.abs(energy) < 1e-12) ? Infinity : (-mu / (2 * energy));
    var i = Math.acos(clamp(h.z / hmag, -1, 1));
    var Om = (nmag > INC_EPS) ? wrap2pi(Math.atan2(nNode.y, nNode.x)) : 0;
    var w, nu;
    if (e > ECC_EPS && nmag > INC_EPS) w = angleBetween(nNode, evec, evec.z);
    else if (e > ECC_EPS) w = wrap2pi(Math.atan2(evec.y, evec.x));   // i≈0: długość perycentrum
    else w = 0;
    if (e > ECC_EPS) nu = angleBetween(evec, r, rv);
    else if (nmag > INC_EPS) nu = angleBetween(nNode, r, r.z);       // koło: nu od węzła
    else nu = wrap2pi(Math.atan2(r.y, r.x));                          // koło+równikowa: true longitude
    var p = hmag * hmag / mu;
    var n = isFinite(a) ? Math.sqrt(mu / Math.abs(a * a * a)) : 0;
    var M0 = Eph.meanAnomalyFromTrue(nu, e);
    return { a: a, e: e, i: i, Om: Om, w: w, nu: nu, M0: M0, t0: t0 || 0, n: n, p: p };
  }

  function propagateCoe(coe, mu, dt) {
    var M = coe.M0 + coe.n * dt, nu;
    if (coe.e < 1) {
      var Mw = ((M + Math.PI) % (2 * Math.PI)); if (Mw < 0) Mw += 2 * Math.PI; Mw -= Math.PI; // → [−π,π]
      nu = eccToNu(Eph.solveKepler(Mw, coe.e), coe.e);
    } else {
      nu = hypToNu(Eph.solveKeplerHyperbolic(M, coe.e), coe.e);
    }
    return coe2rv({ a: coe.a, e: coe.e, i: coe.i, Om: coe.Om, w: coe.w, nu: nu, p: coe.p }, mu);
  }

  function propagate(r, v, mu, dt) {
    return propagateCoe(rv2coe(r, v, mu, 0), mu, dt);
  }

  function deriveStats(coe, mu, RcenterKm, r, v) {
    var e = coe.e, a = coe.a, p = (coe.p != null) ? coe.p : a * (1 - e * e);
    var elliptic = e < 1 - ECC_EPS;
    var sp = Math.sqrt(mu / p);
    return {
      a: a, e: e, i: coe.i,
      periapsis: a * (1 - e),
      apoapsis: elliptic ? a * (1 + e) : Infinity,
      periVel: sp * (1 + e),
      apoVel: elliptic ? sp * (1 - e) : null,
      period: elliptic ? 2 * Math.PI * Math.sqrt(a * a * a / mu) : Infinity,
      energy: -mu / (2 * a),
      altitude: norm(r) - RcenterKm,
      speed: norm(v),
      escape: e >= 1 - ECC_EPS
    };
  }

  function regimeOf(coe, RcenterKm) {
    if (!coe || !isFinite(coe.e)) return 'degenerate';
    if (coe.e >= 1 - ECC_EPS) return (Math.abs(coe.e - 1) < ECC_EPS) ? 'parabolic' : 'hyperbolic';
    if (coe.a * (1 - coe.e) < RcenterKm) return 'suborbital';
    return 'elliptic';
  }

  function sampleConic(coe, n) {
    var nuMax = (coe.e < 1) ? Math.PI : Math.acos(-1 / coe.e) * 0.95;
    var lo = (coe.e < 1) ? 0 : -nuMax, hi = (coe.e < 1) ? 2 * Math.PI : nuMax, out = [];
    for (var k = 0; k <= n; k++) {
      var nu = lo + (hi - lo) * k / n;
      out.push(Eph.orbitalToEcliptic(coe.a, coe.e, coe.i, coe.Om, coe.w, nu));
    }
    return out;
  }

  // Próbkowanie koniki po łuku [nuStart,nuEnd] (n+1 punktów, km). Elipsa: nuEnd<nuStart → wrap +2π (do przodu).
  function sampleConicArc(coe, nuStart, nuEnd, n) {
    var lo = nuStart, hi = nuEnd;
    if (coe.e < 1 && hi < lo) hi += 2 * Math.PI;   // wrap do przodu na elipsie
    var out = [];
    for (var k = 0; k <= n; k++) {
      var nu = lo + (hi - lo) * k / n;
      out.push(Eph.orbitalToEcliptic(coe.a, coe.e, coe.i, coe.Om, coe.w, nu));
    }
    return out;
  }

  function sanitizeCoe(coe) {
    if (!coe) return null;
    var keys = ['a', 'e', 'i', 'Om', 'w', 'nu', 'M0', 'n', 'p'];
    for (var k = 0; k < keys.length; k++) {
      var val = coe[keys[k]];
      if (Number.isNaN(val)) return null;
      if (!isFinite(val) && keys[k] !== 'a') return null;   // a=±Inf dozwolone (parabola)
    }
    return coe;
  }

  var Orbit = {
    MU: MU, AU_KM: AU_KM, DAY_S: DAY_S, ECC_EPS: ECC_EPS, INC_EPS: INC_EPS,
    kmVecToAU: kmVecToAU, eccToNu: eccToNu, hypToNu: hypToNu,
    coe2rv: coe2rv, rv2coe: rv2coe, propagateCoe: propagateCoe, propagate: propagate,
    deriveStats: deriveStats, regimeOf: regimeOf, sampleConic: sampleConic, sampleConicArc: sampleConicArc, sanitizeCoe: sanitizeCoe,
    _dot: dot, _cross: cross, _norm: norm, _add: add, _sub: sub, _scale: scale,
    _clamp: clamp, _wrap2pi: wrap2pi, _angleBetween: angleBetween, _Eph: Eph
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Orbit;
  else root.Orbit = Orbit;
})(typeof window !== 'undefined' ? window : globalThis);
