/* ============================================================
   node-chain.js — (M2 kolejka N węzłów) łańcuch legów multi-SOI
   między burnami. chainPath orkiestruje: per węzeł czasowo-
   ograniczony FlightCore.predictPath (tStop) + Maneuver.applyImpulse,
   po ostatnim burnie finalny predictPath do celu. Czysta logika,
   IIFE dual-export, zero DOM/THREE/ship. Reużywa Orbit/Maneuver/FlightCore.
   Jednostki: nodes[i].pnr JUŻ km/s (glue dzieli /1000); czas w sekundach.
   ============================================================ */
(function (root) {
  'use strict';
  var Orbit    = (typeof require !== 'undefined') ? require('./orbit.js')      : root.Orbit;
  var Maneuver = (typeof require !== 'undefined') ? require('./maneuver.js')    : root.Maneuver;
  var Flight   = (typeof require !== 'undefined') ? require('./flight-core.js') : root.FlightCore;
  var MUALL = Orbit.MU;

  // Łańcuch legów multi-SOI. coe0 epoka == t0, centrum center0. BEZ param mu (używa Orbit.MU[center]).
  // Zwraca legi z: segments (multi-SOI łuki), preCoe/preCenter (orbita TUŻ-PRZED-burnem — marker-drag/live-preview),
  // burnState (stan punktowy w node.t), coeAfterBurn/centerAfterBurn (orbita PO burnie, epoka node.t).
  function chainPath(coe0, center0, t0, nodes, target, opts) {
    opts = opts || {};
    var legMax = opts.legMaxSegments || 6;   // hojny: leg z flyby (enter+exit) potrzebuje ~3-6 segmentów
    var legs = [], ok = true, brokeAt = -1;
    var ctxCoe = coe0, ctxCenter = center0, ctxT = t0;
    // fast-path: pusta kolejka bez celu → bez predictPath (anti wielo-letnia symulacja w teście/produkcji)
    if (!nodes.length && !target)
      return { legs: legs, finalPath: null, coeFinal: ctxCoe, centerFinal: ctxCenter, ok: true, brokeAt: -1 };
    for (var i = 0; i < nodes.length; i++) {
      var leg = Flight.predictPath(ctxCoe, ctxCenter, ctxT, null, { tStop: nodes[i].t, maxSegments: legMax });
      // guard: leg nie dobiegł do node.t (impact/escape/cap/stale) lub czas się nie posunął (past-time) → urwij łańcuch
      if (leg.outcome !== 'time' || leg.endT <= ctxT || !Orbit.sanitizeCoe(leg.endCoe)) { ok = false; brokeAt = i; break; }
      var preCenter = leg.endCenter, muEnd = MUALL[preCenter];
      var st = Orbit.propagateCoe(leg.endCoe, muEnd, 0);                          // stan statku w nodes[i].t (epoka == nodes[i].t)
      // t:nodes[i].t OBOWIĄZKOWE — inaczej rv2coe stempluje coe2.t0=0 (złamana epoka łańcucha)
      var res = Maneuver.applyImpulse({ r: st.r, v: st.v, mu: muEnd, t: nodes[i].t }, nodes[i].pnr);
      var coeAfter = Orbit.sanitizeCoe(res.coe2);
      if (!coeAfter) { ok = false; brokeAt = i; break; }
      legs.push({
        burnIdx: i, segments: leg.segments,
        preCoe: leg.endCoe, preCenter: preCenter,
        burnState: { r: st.r, v: st.v, center: preCenter, t: nodes[i].t },
        coeAfterBurn: coeAfter, centerAfterBurn: preCenter
      });
      ctxCoe = coeAfter; ctxCenter = preCenter; ctxT = nodes[i].t;
    }
    var finalPath = ok ? Flight.predictPath(ctxCoe, ctxCenter, ctxT, target || null, {}) : null;
    return { legs: legs, finalPath: finalPath, coeFinal: ctxCoe, centerFinal: ctxCenter, ok: ok, brokeAt: brokeAt };
  }

  // Clamp czasu węzła i do okna (max(tNow, nodes[i-1].t)+eps, nodes[i+1].t-eps) — monotonia.
  function validNodeTime(nodes, i, tProposed, tNowSec, eps) {
    eps = eps || 1;
    var lo = Math.max(tNowSec, (i > 0 ? nodes[i - 1].t + eps : tNowSec));
    var hi = (i < nodes.length - 1) ? nodes[i + 1].t - eps : Infinity;
    return Math.max(lo, Math.min(tProposed, hi));
  }

  // ⚠ API footgun: insertNode MUTUJE wejście i zwraca idx; removeNode zwraca KOPIĘ.
  // Glue: `NodeChain.insertNode(ship.nodes, node)` (mutuje in-place); `ship.nodes = NodeChain.removeNode(ship.nodes, i)` (reassign).
  function insertNode(nodes, node) {
    var idx = nodes.findIndex(function (x) { return x.t > node.t; });
    if (idx < 0) idx = nodes.length;
    nodes.splice(idx, 0, node);
    return idx;
  }
  function removeNode(nodes, i) { var c = nodes.slice(); c.splice(i, 1); return c; }

  var NodeChain = {
    chainPath: chainPath, validNodeTime: validNodeTime, insertNode: insertNode, removeNode: removeNode,
    _Orbit: Orbit, _Maneuver: Maneuver, _Flight: Flight
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = NodeChain;
  else root.NodeChain = NodeChain;
})(typeof window !== 'undefined' ? window : globalThis);
