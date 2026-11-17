/* ============================================================
   ship-stats.js — statystyki statku: Tsiołkowski, budżet Δv, presety.
   masa kg, ciąg N, Isp s; Δv eksponowane w km/s. IIFE, testowane node --test.
   ============================================================ */
(function (root) {
  'use strict';
  var G0 = 9.80665;
  function exhaustVelocity(s) { return s.isp * G0; }              // m/s
  function massFlowRate(s) { return s.thrust / exhaustVelocity(s); } // kg/s
  function dvBudget(s) { return exhaustVelocity(s) * Math.log((s.dryMass + s.fuelMax) / s.dryMass) / 1000; }
  function dvRemaining(s) { return exhaustVelocity(s) * Math.log((s.dryMass + s.fuel) / s.dryMass) / 1000; }
  function fuelForDv(s, dvKmS) {
    var ve = exhaustVelocity(s), m0 = s.dryMass + s.fuel;
    var mAfter = m0 * Math.exp(-dvKmS * 1000 / ve), fuelUsed = m0 - mAfter;
    var insufficient = fuelUsed > s.fuel + 1e-9;
    if (insufficient) { mAfter = s.dryMass; fuelUsed = s.fuel; }
    return { fuelUsed: fuelUsed, massAfter: mAfter, insufficient: insufficient, dvMax: dvRemaining(s) };
  }
  function thrustAccel(s, massKg) { return s.thrust / massKg; }   // m/s²
  function burnTimeForDv(s, dvKmS) { var f = fuelForDv(s, dvKmS); return f.insufficient ? Infinity : f.fuelUsed / massFlowRate(s); }
  function consume(s, fuelKg) { var c = Object.assign({}, s); c.fuel = Math.max(0, s.fuel - fuelKg); return c; }

  var PRESETS = {
    orbiter: { name: 'orbiter', dryMass: 1200, fuelMax: 1800, fuel: 1800, isp: 320, thrust: 4000, rcsDv: 0.05 },
    cruiser: { name: 'cruiser', dryMass: 5000, fuelMax: 14000, fuel: 14000, isp: 450, thrust: 6000, rcsDv: 0.08 },
    ion: { name: 'ion', dryMass: 600, fuelMax: 400, fuel: 400, isp: 3000, thrust: 0.25, rcsDv: 0.02 }
  };
  function fromPreset(name) { return Object.assign({}, PRESETS[name]); }

  var ShipStats = {
    G0: G0, PRESETS: PRESETS, fromPreset: fromPreset,
    exhaustVelocity: exhaustVelocity, massFlowRate: massFlowRate,
    dvBudget: dvBudget, dvRemaining: dvRemaining, fuelForDv: fuelForDv,
    thrustAccel: thrustAccel, burnTimeForDv: burnTimeForDv, consume: consume
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ShipStats;
  else root.ShipStats = ShipStats;
})(typeof window !== 'undefined' ? window : globalThis);
