/* ============================================================
   maneuver-node.js — planowanie węzła manewrowego (M2 Plaster A).
   Czysta logika, IIFE, node --test. km / s / rad.
   Reużywa Orbit / Ephemeris / Maneuver. ZERO DOM/THREE.
   ⚠ Czas w SEKUNDACH (coe.t0/tNowSec), NIE Data Juliańska.
   ============================================================ */
(function (root) {
  'use strict';

  var Orbit    = (typeof require !== 'undefined') ? require('./orbit.js')     : root.Orbit;
  var Eph      = (typeof require !== 'undefined') ? require('./ephemeris.js') : root.Ephemeris;
  var Maneuver = (typeof require !== 'undefined') ? require('./maneuver.js')  : root.Maneuver;

  var TAU = 2 * Math.PI;
  var PARABOLA_TOL = 1e-3;   // |e−1| poniżej → parabola: planowanie węzła off (dług e==1)

  // Zakres anomalii prawdziwej do umiejscowienia węzła (spójny z Orbit.sampleConic).
  function validNuRange(coe) {
    if (coe.e < 1) return { lo: 0, hi: TAU };
    var numax = Math.acos(-1 / coe.e) * 0.95;
    return { lo: -numax, hi: numax };
  }

  // Drag→czas: pierwszy PRZYSZŁY moment (s) gdy statek jest w anomalii nuTarget.
  function nodeTimeForNu(coe, nuTarget, tNowSec) {
    if (!coe || !(coe.n > 0)) return null;                 // degeneracja / n=0
    var e = coe.e;
    if (Math.abs(e - 1) < PARABOLA_TOL) return null;       // parabola guard
    var Mtarget = Eph.meanAnomalyFromTrue(nuTarget, e);
    var Mnow = coe.M0 + coe.n * (tNowSec - coe.t0);
    if (e < 1) {
      var dM = ((Mtarget - Mnow) % TAU + TAU) % TAU;       // dodatnie modulo (JS % bywa ujemne)
      return tNowSec + dM / coe.n;
    }
    if (Mtarget <= Mnow) return null;                      // hiperbola: cel za statkiem → nieosiągalny
    return tNowSec + (Mtarget - Mnow) / coe.n;
  }

  // Orbita PO burnie w węźle. dt = node.t − coe.t0 (s). pnrKmS już w km/s.
  function previewAfterNode(coe, mu, dt, pnrKmS) {
    if (!coe || Math.abs(coe.e - 1) < PARABOLA_TOL) return null;        // parabola wejściowa
    var st = Orbit.propagateCoe(coe, mu, dt);                          // {r,v} w t0+dt (PRZED impulsem)
    var res = Maneuver.applyImpulse({ r: st.r, v: st.v, mu: mu, t: coe.t0 + dt }, pnrKmS);
    var coe2 = Orbit.sanitizeCoe(res.coe2);
    if (!coe2 || Math.abs(coe2.e - 1) < PARABOLA_TOL) return null;      // parabola wynikowa
    return { coe2: coe2, dvVec: res.dvVec, dvMag: res.dvMag, rNode: st.r, vNode: st.v };
  }

  // Ogranicz czas węzła do bieżącej SOI / przed impact. Granice wstrzykuje glue (czysty Math.min).
  function clampNodeTime(tProposed, tNowSec, bounds) {
    var t = Math.max(tNowSec, tProposed), m = (bounds && bounds.marginSec) || 0;
    if (bounds && isFinite(bounds.tSOI))    t = Math.min(t, bounds.tSOI - m);
    if (bounds && isFinite(bounds.tImpact)) t = Math.min(t, bounds.tImpact - m);
    return Math.max(tNowSec, t);
  }

  // Cecha do adaptiveWarpCap przy „⏩ do węzła": min(timeToPeri, timeToNode) gdy uzbrojone.
  function effFeatureTime(timeToPeri, timeToNode, armed) {
    if (!armed || !isFinite(timeToNode)) return timeToPeri;
    return Math.min(timeToPeri, Math.max(0, timeToNode));
  }

  var ManeuverNode = {
    validNuRange: validNuRange,
    nodeTimeForNu: nodeTimeForNu,
    previewAfterNode: previewAfterNode,
    clampNodeTime: clampNodeTime,
    effFeatureTime: effFeatureTime,
    PARABOLA_TOL: PARABOLA_TOL,
    _Orbit: Orbit, _Eph: Eph, _Maneuver: Maneuver
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ManeuverNode;
  else root.ManeuverNode = ManeuverNode;
})(typeof window !== 'undefined' ? window : globalThis);
