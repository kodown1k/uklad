/* ============================================================
   flight-core.js — orkiestracja lotu statkiem (adapter soi-events,
   hooki SOI, re-anchor epoki COE). Czysta logika, IIFE, node --test.
   Reużywa Orbit / Soi / Ephemeris / SoiEvents.
   ============================================================ */
(function (root) {
  'use strict';

  var Orbit = (typeof require !== 'undefined') ? require('./orbit.js') : root.Orbit;
  var Eph   = (typeof require !== 'undefined') ? require('./ephemeris.js') : root.Ephemeris;
  var Soi   = (typeof require !== 'undefined') ? require('./soi.js') : root.Soi;
  var SoiEvents = (typeof require !== 'undefined') ? require('./soi-events.js') : root.SoiEvents;

  var AU_KM = Orbit.AU_KM;
  var R_KM = { sun: 696000, earth: 6371.0, mars: 3389.5 };  // promienie ciał centralnych [km] (impact)
  var CHILDREN = ['earth', 'mars'];                          // cele przechwycenia z heliocentrum (M1)

  // OBOWIĄZKOWY adapter: orbit.js zwraca {x,y,z}; soi-events indeksuje tablice [x,y,z].
  function makePropagator() {
    return function (coe, mu, dt) {
      var s = Orbit.propagateCoe(coe, mu, dt);
      return { r: [s.r.x, s.r.y, s.r.z], v: [s.v.x, s.v.y, s.v.z] };
    };
  }

  // sim-sekundy → JD. clockMs to epoch-ms (zasiane realnym „teraz"); tau = clockMs/1000.
  function jdOf(tau) { return Eph.julianDate(tau * 1000); }

  // pozycja heliocentryczna ciała [AU] w jd; 'sun' = origin.
  function helioAU(id, jd) {
    if (id === 'sun') return { x: 0, y: 0, z: 0 };
    var el = Eph.REAL_PLANETS.find(function (p) { return p.id === id; });
    return Eph.positionAt(el, jd);
  }

  // planetProvider(tau) → {r:[x,y,z]} km : pozycja `planetId` względem `centerId`.
  function makePlanetProvider(planetId, centerId) {
    return function (tau) {
      var jd = jdOf(tau);
      var pl = helioAU(planetId, jd), ce = helioAU(centerId, jd);
      return { r: [(pl.x - ce.x) * AU_KM, (pl.y - ce.y) * AU_KM, (pl.z - ce.z) * AU_KM] };
    };
  }

  var _inited = false;
  function init() {           // MUSI być wołane przed pierwszym stepFlight (wstrzyk adaptera)
    if (_inited) return;
    SoiEvents.setPropagator(makePropagator());
    _inited = true;
  }

  var TWO_PI = 2 * Math.PI;
  // Przesuń epokę COE o dtau [s] analitycznie (M0 += n·dtau). Drift-free, bez rv2coe.
  // nu przeliczone z nowego M0 dla spójności (propagateCoe i tak ignoruje coe.nu, ale
  // konsumenci coe2rv/sampleConic używają nu — trzymamy je zsynchronizowane).
  function reanchor(coe, dtau) {
    var c = {};
    for (var k in coe) if (Object.prototype.hasOwnProperty.call(coe, k)) c[k] = coe[k];
    c.M0 = coe.M0 + coe.n * dtau;
    var nu;
    if (coe.e < 1) {
      var Mw = ((c.M0 + Math.PI) % TWO_PI); if (Mw < 0) Mw += TWO_PI; Mw -= Math.PI;   // → [−π,π]
      c.M0 = ((c.M0 % TWO_PI) + TWO_PI) % TWO_PI;                                       // znormalizuj zapis
      nu = Orbit.eccToNu(Eph.solveKepler(Mw, coe.e), coe.e);
    } else {
      nu = Orbit.hypToNu(Eph.solveKeplerHyperbolic(c.M0, coe.e), coe.e);
    }
    c.nu = nu;
    c.t0 = coe.t0 + dtau;
    return c;
  }

  var MU = Orbit.MU;

  // Czas do następnego perycentrum [s]. Elipsa: peri przy M=0≡2π. Hiperbola: peri przy M=0,
  // M0<0 = zbliża się (skończony), M0≥0 = oddala się (brak przyszłego peri). M0 = anomalia średnia
  // w epoce coe.t0 (= „teraz" po stepFlight/reanchor), więc czytamy ją wprost.
  function timeToPeri(coe) {
    if (!coe || !isFinite(coe.n) || coe.n <= 0) return Infinity;
    if (coe.e < 1) {
      var M = ((coe.M0 % TWO_PI) + TWO_PI) % TWO_PI;          // [0,2π)
      return ((TWO_PI - M) % TWO_PI) / coe.n;                  // M=0 (w peri) → 0; tuż po peri (M→0⁺) → ~pełen okres do następnego
    }
    return coe.M0 < 0 ? (-coe.M0) / coe.n : Infinity;
  }
  // Czas do następnego apocentrum [s] — tylko elipsa (apo przy M=π); hiperbola → Infinity.
  function timeToApo(coe) {
    if (!coe || coe.e >= 1 || !isFinite(coe.n) || coe.n <= 0) return Infinity;
    var M = ((coe.M0 % TWO_PI) + TWO_PI) % TWO_PI;
    return (((Math.PI - M) % TWO_PI + TWO_PI) % TWO_PI) / coe.n;
  }
  // Wejścia dla SoiEvents.adaptiveWarpCap. distToSOI: gdy centrum=planeta → odległość do granicy
  // WYJŚCIA z SOI (rSOI−|r|); gdy centrum=Słońce → Infinity (wejście do dziecka łapie root-find
  // anti-tunneling soi-events — „siatka bezpieczeństwa", spec §3.5). speedRel=|v|, timeToPeri jw.
  function warpCapInputs(ship) {
    var r = ship.r, v = ship.v;
    var speedRel = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    var distToSOI = Infinity;
    if (ship.center !== 'sun') {
      var rMag = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z);
      distToSOI = Math.max(0, Soi.radiusSOI(ship.center) - rMag);
    }
    return { distToSOI: distToSOI, speedRel: speedRel, timeToPeri: timeToPeri(ship.coe) };
  }

  function buildHooks(ctx) {
    function soiQuery(t, dt) {
      var center = ctx.center;
      if (center !== 'sun') {
        // granica WYJŚCIA z SOI obecnego centrum: g = |r_ship| − rSOI(center); planeta = centrum (prowider 0)
        return { rSOI: Soi.radiusSOI(center), planetProvider: function () { return { r: [0, 0, 0] }; } };
      }
      // heliocentrycznie: granica WEJŚCIA do najbliższego dziecka
      var jd = jdOf(t);
      var sh = Orbit.propagateCoe(ctx.coe, MU.sun, t - ctx.coe.t0);   // pozycja statku wzgl. Słońca [km] {x,y,z}
      var best = null, bestD = Infinity;
      for (var i = 0; i < CHILDREN.length; i++) {
        var id = CHILDREN[i], pl = helioAU(id, jd);
        var dx = sh.r.x - pl.x * AU_KM, dy = sh.r.y - pl.y * AU_KM, dz = sh.r.z - pl.z * AU_KM;
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < bestD) { bestD = d; best = id; }
      }
      if (!best) return null;
      return { rSOI: Soi.radiusSOI(best), planetProvider: makePlanetProvider(best, 'sun'), _planet: best };
    }
    function onCross(ev) {
      var jd = jdOf(ev.t), oldId = ctx.center, newId;
      if (ev.sign < 0) newId = ev.sq._planet;   // wejście (heliocentrum → dziecko)
      else newId = 'sun';                        // wyjście (dziecko → Słońce) — M1: rodzic = Słońce
      // materializuj stan statku w starej ramce w chwili ev.t
      var s = Orbit.propagateCoe(ctx.coe, MU[oldId], ev.t - ctx.coe.t0);     // {r:{x,y,z}, v:{x,y,z}} km
      var reb = Soi.rebase({ r: s.r, v: s.v, center: oldId }, oldId, newId, jd);  // {r,v,center} {x,y,z}
      var coe2 = Orbit.rv2coe(reb.r, reb.v, MU[newId], ev.t);                 // nowa epoka = ev.t
      ctx.center = newId; ctx.coe = coe2;
      return { coe: coe2, muCenter: MU[newId], center: newId, R_body: (R_KM[newId] || 0) };
    }
    return { soiQuery: soiQuery, onCross: onCross };
  }

  // bezpieczny chunk czasu [s] — poniżej czasu przelotu przez najbliższą SOI (anti-tunneling w predykcji).
  // ⚠ Dla center=='sun' liczy dystans do najbliższego DZIECKA (warpCapInputs zwraca tam Infinity — za grube!).
  function _predSafeChunk(coe, center, tNow, marginSteps) {
    var s = Orbit.propagateCoe(coe, MU[center], tNow - coe.t0);
    var speed = Math.sqrt(s.v.x * s.v.x + s.v.y * s.v.y + s.v.z * s.v.z);
    var distSOI = Infinity, closeSpeed = speed;
    if (center !== 'sun') {
      var rMag = Math.sqrt(s.r.x * s.r.x + s.r.y * s.r.y + s.r.z * s.r.z);
      distSOI = Math.max(0, Soi.radiusSOI(center) - rMag);                 // do WYJŚCIA z SOI
    } else {
      var jd = jdOf(tNow), best = Infinity;
      for (var i = 0; i < CHILDREN.length; i++) {
        var el = Eph.REAL_PLANETS.find(function (p) { return p.id === CHILDREN[i]; });
        var pl = helioAU(CHILDREN[i], jd);
        var dx = s.r.x - pl.x * AU_KM, dy = s.r.y - pl.y * AU_KM, dz = s.r.z - pl.z * AU_KM;
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz) - Soi.radiusSOI(CHILDREN[i]);
        if (d < best) best = d;
        var pv = Soi.planetVelocity(el, jd);
        var cs = speed + Math.sqrt(pv.x * pv.x + pv.y * pv.y + pv.z * pv.z);  // górna granica prędkości zbliżania
        if (cs > closeSpeed) closeSpeed = cs;
      }
      distSOI = Math.max(0, best);
    }
    var bound = Infinity;
    if (closeSpeed > 1e-9 && isFinite(distSOI)) bound = distSOI / closeSpeed / marginSteps;
    var ttp = timeToPeri(coe);
    if (isFinite(ttp)) bound = Math.min(bound, Math.max(ttp, 1) / marginSteps);
    var hi = (coe.e < 1 && isFinite(coe.a)) ? Math.PI * Math.sqrt(coe.a * coe.a * coe.a / MU[center]) : 30 * 86400; // ≤ pół okresu / 30 dni
    return Math.max(60, Math.min(bound, hi));   // dolny clamp 60 s = skończona pętla
  }

  // closest-approach (perycentrum) w SOI; tPeri poza tCap → null.
  function periapsisInSOI(coe, mu, tCap) {
    if (!coe || !isFinite(coe.a)) return null;
    var ttp = timeToPeri(coe);
    if (!isFinite(ttp)) return null;
    var tPeri = coe.t0 + ttp;
    if (tPeri > tCap) return null;
    return { periKm: coe.a * (1 - coe.e), tPeri: tPeri };
  }

  // Forward-symulacja łańcucha patched-conics na HIPOTETYCZNYM ctx (nie ship). Reuse buildHooks/stepShip.
  function predictPath(coe0, center0, t0, target, opts) {
    opts = opts || {};
    var maxSegments = opts.maxSegments || 6,
        maxDt = opts.maxDt || (3 * 365.25 * 86400),
        marginSteps = opts.marginSteps || 4,
        ITER_MAX = opts.iterMax || 4000;
    init();
    var tStop = (opts.tStop != null) ? opts.tStop : null, EPS = 1e-6, reachedTStop = false;
    if (tStop != null && tStop <= t0 + EPS)            // węzeł w przeszłości (po realnym crossingu) — chainPath traktuje jako ok=false
      return { segments: [], outcome: 'stale', arrival: null, endCoe: coe0, endCenter: center0, endT: t0 };
    var ctx = { center: center0, coe: coe0 };
    var segStart = t0, tNow = t0, segments = [], targetHit = false, impact = false, arrival = null, iter = 0, frameStart = t0, bound = false;
    function pushSeg(coe, center, tStart, tEnd) {     // segment z coe.t0 == tStart (reanchor)
      segments.push({ coe: reanchor(coe, tStart - coe.t0), center: center, mu: MU[center], tStart: tStart, tEnd: tEnd });
    }
    while (segments.length < maxSegments && tNow < t0 + maxDt && !targetHit && !impact && !reachedTStop && iter++ < ITER_MAX) {
      if (tStop != null && tNow >= tStop - EPS) { reachedTStop = true; break; }   // pre-check: chroni przed ujemnym dtChunk (float)
      var dtChunk = Math.min((t0 + maxDt) - tNow, _predSafeChunk(ctx.coe, ctx.center, tNow, marginSteps));
      if (tStop != null) dtChunk = Math.max(0, Math.min(dtChunk, tStop - tNow));   // clamp: ostatni krok ląduje na tStop, nigdy ujemny
      var baseHooks = buildHooks(ctx);
      var hooks = { soiQuery: baseHooks.soiQuery, maxEvents: 4, onCross: function (ev) {
        pushSeg(ctx.coe, ctx.center, segStart, ev.t);          // domknij FROM-frame
        segStart = ev.t;
        var r = baseHooks.onCross(ev);                         // mutuje ctx → nowa ramka (epoka ev.t)
        frameStart = ev.t;                                     // nowa ramka → reset licznika okresu (early-exit)
        if (ctx.center === target) targetHit = true;
        return r;
      } };
      var res;
      try {
        res = SoiEvents.stepShip({ coe: ctx.coe, muCenter: MU[ctx.center], center: ctx.center,
          R_body: (R_KM[ctx.center] || 0), t0: tNow, dtSim: dtChunk }, hooks);
      } catch (e) { break; }
      if (res.impact) { pushSeg(ctx.coe, ctx.center, segStart, res.t); impact = true; break; }
      ctx.coe = reanchor(res.coe, res.t - res.coe.t0); ctx.center = res.center;   // epoka → res.t (inwariant t0==tNow)
      tNow = res.t;
      if (tStop != null && tNow >= tStop - EPS) { reachedTStop = true; break; }    // osiągnięto tStop (krok wylądował na granicy)
      // EARLY-EXIT: orbita ZWIĄZANA planetocentryczna — pełen okres bez przejścia/impaktu → już nigdy nie przejdzie
      // (rSOI stały, planetProvider=[0,0,0] → g(τ) okresowe; impakt jeśli będzie, pada w 1. okresie). Tnie ITER_MAX-spin
      // (LEO: ~17000 orbit w 3 lata → kilka iteracji). HELIOcentrum NIE early-exitujemy (dzieci się poruszają → nieokresowe).
      if (ctx.center !== 'sun' && ctx.coe.e < 1) {
        var P = 2 * Math.PI * Math.sqrt(ctx.coe.a * ctx.coe.a * ctx.coe.a / MU[ctx.center]);
        if (isFinite(P) && (tNow - frameStart) >= P) {
          if (tStop != null) {                                                     // tryb tStop: orbita związana → skrót analityczny do tStop (zamiast ITER-spin)
            ctx.coe = reanchor(ctx.coe, tStop - tNow); tNow = tStop; reachedTStop = true; break;
          }
          bound = true; break;
        }
      }
    }
    var outcome;
    if (reachedTStop) {                                  // tryb tStop: DOKŁADNIE JEDEN push segmentu końcowego (segStart..tStop)
      pushSeg(ctx.coe, ctx.center, segStart, tStop);
      if (ctx.coe.e < 1) {                               // segment obejmujący ≥1 pełny okres → closed (glue rysuje pełną elipsę, nie ucięty łuk)
        var Pf = 2 * Math.PI * Math.sqrt(ctx.coe.a * ctx.coe.a * ctx.coe.a / MU[ctx.center]);
        if (isFinite(Pf) && (tStop - segStart) >= Pf) segments[segments.length - 1].closed = true;
      }
      outcome = 'time';
    }
    else if (impact) { outcome = 'impact'; }
    else if (targetHit) {
      arrival = periapsisInSOI(ctx.coe, MU[ctx.center], t0 + maxDt);
      if (arrival) arrival.center = ctx.center;
      pushSeg(ctx.coe, ctx.center, segStart, arrival ? arrival.tPeri : segStart);
      outcome = 'target';
    } else {
      pushSeg(ctx.coe, ctx.center, segStart, tNow);
      if (bound) { segments[segments.length - 1].closed = true; outcome = 'bound'; }   // pełna domknięta elipsa w SOI (glue: sampleConic 0..2π)
      else outcome = (segments.length >= maxSegments) ? 'capped' : (ctx.coe.e >= 1 ? 'escape' : 'capped');
    }
    return { segments: segments, outcome: outcome, arrival: arrival, endCoe: ctx.coe, endCenter: ctx.center, endT: tNow };
  }

  function stepFlight(ship, dtScene) {
    init();                                   // self-arming: adapter wstrzyknięty (idempotentne) — adapter NIGDY nieobejdzony → brak klasy silent-NaN
    var ctx = { center: ship.center, coe: ship.coe };
    var hooks = buildHooks(ctx);
    var mu0 = MU[ship.center];
    var state = {
      coe: ship.coe, muCenter: mu0, center: ship.center,
      R_body: (R_KM[ship.center] || 0), t0: ship.coe.t0, dtSim: dtScene
    };
    var res;
    try { res = SoiEvents.stepShip(state, hooks); }
    catch (e) { return { ok: false, reason: 'throw', coe: ship.lastGoodCoe || ship.coe, center: ship.center }; }
    var center = res.center, mu = MU[center];
    // przesuń epokę zwróconego COE do końca kroku (res.t) — drift-free
    var coe = reanchor(res.coe, res.t - res.coe.t0);
    if (!Orbit.sanitizeCoe(coe)) return { ok: false, reason: 'nan', coe: ship.lastGoodCoe || ship.coe, center: ship.center };
    var sv = Orbit.propagateCoe(coe, mu, 0);   // materializacja r,v w epoce (= res.t)
    if (!isFinite(sv.r.x) || !isFinite(sv.v.x)) return { ok: false, reason: 'nan', coe: ship.lastGoodCoe || ship.coe, center: ship.center };
    return { ok: true, coe: coe, center: center, mu: mu, r: sv.r, v: sv.v, events: res.events, impact: res.impact || null };
  }

  var FlightCore = {
    R_KM: R_KM, CHILDREN: CHILDREN,
    makePropagator: makePropagator, jdOf: jdOf, helioAU: helioAU,
    makePlanetProvider: makePlanetProvider, init: init, reanchor: reanchor,
    buildHooks: buildHooks, stepFlight: stepFlight,
    timeToPeri: timeToPeri, timeToApo: timeToApo, warpCapInputs: warpCapInputs,
    predictPath: predictPath, periapsisInSOI: periapsisInSOI,
    _Orbit: Orbit, _Soi: Soi, _Eph: Eph, _SoiEvents: SoiEvents
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FlightCore;
  else root.FlightCore = FlightCore;
})(typeof window !== 'undefined' ? window : globalThis);
