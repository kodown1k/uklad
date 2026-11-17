/* ============================================================
   ephemeris.js — analityczne ephemerydy Keplera (heliocentryczne, 3D ekliptyka).
   Czysta matematyka, bez zależności DOM/THREE. Kąty wejściowe w radianach
   (funkcje geometrii) lub stopniach (positionAt — patrz Task 2).
   ============================================================ */
(function (root) {
  'use strict';

  // Równanie Keplera eliptyczne M = E − e·sinE (Newton).
  function solveKepler(M, e) {
    var En = M;
    for (var i = 0; i < 30; i++) {
      var d = (En - e * Math.sin(En) - M) / (1 - e * Math.cos(En));
      En -= d; if (Math.abs(d) < 1e-12) break;
    }
    return En;
  }

  // Równanie Keplera hiperboliczne M = e·sinh H − H (Newton).
  function solveKeplerHyperbolic(M, e) {
    var H = Math.asinh(M / e) || (M < 0 ? -1 : 1);   // przybliżenie startowe
    for (var i = 0; i < 60; i++) {
      var d = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1);
      H -= d; if (Math.abs(d) < 1e-11) break;
    }
    return H;
  }

  // Pozycja heliocentryczna (AU) z anomalii prawdziwej ν i elementów (kąty w radianach).
  // r = a(1−e²)/(1+e·cosν); obrót płaszczyzny orbity (ω) → inklinacja (i) → węzeł (Ω).
  function orbitalToEcliptic(a, e, i, Om, w, nu) {
    var r = a * (1 - e * e) / (1 + e * Math.cos(nu));
    var xo = r * Math.cos(nu), yo = r * Math.sin(nu);
    var cw = Math.cos(w), sw = Math.sin(w);
    var cO = Math.cos(Om), sO = Math.sin(Om);
    var ci = Math.cos(i), si = Math.sin(i);
    return {
      x: (cw * cO - sw * sO * ci) * xo + (-sw * cO - cw * sO * ci) * yo,
      y: (cw * sO + sw * cO * ci) * xo + (-sw * sO + cw * cO * ci) * yo,
      z: (sw * si) * xo + (cw * si) * yo
    };
  }

  // Dzień juliański z epoch-millis (UTC).
  function julianDate(ms) { return ms / 86400000 + 2440587.5; }

  var DEG = Math.PI / 180;

  // Pozycja na zadany dzień juliański z elementów JPL (J2000 + tempa /wiek).
  function positionAt(el, jd) {
    var T = (jd - 2451545.0) / 36525.0;
    var a = el.a + (el.aR||0)*T, e = el.e + (el.eR||0)*T;
    var I = (el.I + (el.IR||0)*T) * DEG;
    var L = (el.L + (el.LR||0)*T) * DEG;
    var peri = (el.peri + (el.periR||0)*T) * DEG;
    var node = (el.node + (el.nodeR||0)*T) * DEG;
    var w = peri - node;
    var nu;
    if (e < 1) {
      var M = L - peri;
      M = ((M + Math.PI) % (2*Math.PI)) - Math.PI;   // do [−π,π]
      var Eo = solveKepler(M, e);
      nu = 2 * Math.atan2(Math.sqrt(1+e)*Math.sin(Eo/2), Math.sqrt(1-e)*Math.cos(Eo/2));
    } else {
      var Mh = L - peri;
      var H = solveKeplerHyperbolic(Mh, e);
      nu = 2 * Math.atan2(Math.sqrt(e+1)*Math.sinh(H/2), Math.sqrt(e-1)*Math.cosh(H/2));
    }
    return orbitalToEcliptic(a, e, I, node, w, nu);
  }

  // Próbkowanie toru po anomalii prawdziwej (ellipsa: pełen obieg; hiperbola: łuk).
  function sampleOrbit(el, jd, n) {
    var T = (jd - 2451545.0) / 36525.0;
    var a = el.a + (el.aR||0)*T, e = el.e + (el.eR||0)*T;
    var I = (el.I + (el.IR||0)*T) * DEG;
    var peri = (el.peri + (el.periR||0)*T) * DEG;
    var node = (el.node + (el.nodeR||0)*T) * DEG;
    var w = peri - node;
    var out = [];
    var nuMax = (e < 1) ? Math.PI : Math.acos(-1/e) * 0.95;
    var lo = (e < 1) ? 0 : -nuMax, hi = (e < 1) ? 2*Math.PI : nuMax;
    for (var i = 0; i <= n; i++) {
      var nu = lo + (hi - lo) * i / n;
      out.push(orbitalToEcliptic(a, e, I, node, w, nu));
    }
    return out;
  }

  // Elementy JPL (Standish, J2000 + tempa /wiek). a[AU], kąty[st]; L,peri,node = długości.
  var REAL_PLANETS = [
    {id:'mercury', a:0.38709927,e:0.20563593,I:7.00497902,L:252.25032350,peri:77.45779628,node:48.33076593, aR:0.00000037,eR:0.00001906,IR:-0.00594749,LR:149472.67411175,periR:0.16047689,nodeR:-0.12534081},
    {id:'venus',   a:0.72333566,e:0.00677672,I:3.39467605,L:181.97909950,peri:131.60246718,node:76.67984255, aR:0.00000390,eR:-0.00004107,IR:-0.00078890,LR:58517.81538729,periR:0.00268329,nodeR:-0.27769418},
    {id:'earth',   a:1.00000261,e:0.01671123,I:-0.00001531,L:100.46457166,peri:102.93768193,node:0.0, aR:0.00000562,eR:-0.00004392,IR:-0.01294668,LR:35999.37244981,periR:0.32327364,nodeR:0.0},
    {id:'mars',    a:1.52371034,e:0.09339410,I:1.84969142,L:-4.55343205,peri:-23.94362959,node:49.55953891, aR:0.00001847,eR:0.00007882,IR:-0.00813131,LR:19140.30268499,periR:0.44441088,nodeR:-0.29257343},
    {id:'jupiter', a:5.20288700,e:0.04838624,I:1.30439695,L:34.39644051,peri:14.72847983,node:100.47390909, aR:-0.00011607,eR:-0.00013253,IR:-0.00183714,LR:3034.74612775,periR:0.21252668,nodeR:0.20469106},
    {id:'saturn',  a:9.53667594,e:0.05386179,I:2.48599187,L:49.95424423,peri:92.59887831,node:113.66242448, aR:-0.00125060,eR:-0.00050991,IR:0.00193609,LR:1222.49362201,periR:-0.41897216,nodeR:-0.28867794},
    {id:'uranus',  a:19.18916464,e:0.04725744,I:0.77263783,L:313.23810451,peri:170.95427630,node:74.01692503, aR:-0.00196176,eR:-0.00004397,IR:-0.00242939,LR:428.48202785,periR:0.40805281,nodeR:0.04240589},
    {id:'neptune', a:30.06992276,e:0.00859048,I:1.77004347,L:-55.12002969,peri:44.96476227,node:131.78422574, aR:0.00026291,eR:0.00005105,IR:0.00035372,LR:218.45945325,periR:-0.32241464,nodeR:-0.00508664}
  ];

  var TWO_PI = 2 * Math.PI;
  function wrap2pi(a){ a %= TWO_PI; return a < 0 ? a + TWO_PI : a; }

  // Czas gwiazdowy Greenwich (GMST) w radianach, niskiej precyzji.
  function gmst(jd) {
    var deg = 280.46061837 + 360.98564736629 * (jd - 2451545.0);
    return wrap2pi(deg * Math.PI / 180);
  }

  // Faza obrotu osiowego planety [rad]: pełny obrót co |rotH| godzin; znak rotH = kierunek.
  function rotationPhase(rotH, jd, epochJd) {
    var ep = (epochJd === undefined) ? 2451545.0 : epochJd;
    var turns = (jd - ep) * 24 / rotH;            // liczba obrotów (ze znakiem)
    return wrap2pi(TWO_PI * turns);
  }

  // Anomalia średnia z prawdziwej. Elipsa: nu→E (atan2, stabilne) → M=E−e·sinE.
  // Hiperbola: nu→H (atanh) → M=e·sinhH−H. Zwraca [rad] (dla elipsy w (−π,π] przy nu w (−π,π]).
  function meanAnomalyFromTrue(nu, e) {
    if (e < 1) {
      var E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2),
                             Math.sqrt(1 + e) * Math.cos(nu / 2));
      return E - e * Math.sin(E);
    } else {
      var H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
      return e * Math.sinh(H) - H;
    }
  }

  // Faza (znormalizowana anomalia średnia ∈ [0,1]) dla tych samych próbek co sampleOrbit.
  function sampleOrbitPhases(el, jd, n) {
    var T = (jd - 2451545.0) / 36525.0;
    var e = el.e + (el.eR || 0) * T;
    var nuMax = (e < 1) ? Math.PI : Math.acos(-1 / e) * 0.95;
    var lo = (e < 1) ? 0 : -nuMax, hi = (e < 1) ? 2 * Math.PI : nuMax;
    var mLo = meanAnomalyFromTrue(lo, e), mHi = meanAnomalyFromTrue(hi, e);
    // dla elipsy meanAnomalyFromTrue(2π,e) liczone modulo — użyj zakresu [mLo, mLo+2π]
    if (e < 1) { mLo = 0; mHi = 2 * Math.PI; }
    var span = (mHi - mLo) || 1, out = [];
    for (var i = 0; i <= n; i++) {
      var nu = lo + (hi - lo) * i / n;
      var M = meanAnomalyFromTrue(nu, e);
      if (e < 1) { M = ((M % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI); }  // → [0,2π)
      out.push((M - mLo) / span);
    }
    if (e < 1) out[n] = 1;   // domknij pełny obieg (nu=2π ≡ M=2π)
    return out;
  }

  var Ephemeris = {
    solveKepler: solveKepler, solveKeplerHyperbolic: solveKeplerHyperbolic,
    orbitalToEcliptic: orbitalToEcliptic, julianDate: julianDate,
    positionAt: positionAt, sampleOrbit: sampleOrbit, sampleOrbitPhases: sampleOrbitPhases,
    meanAnomalyFromTrue: meanAnomalyFromTrue, REAL_PLANETS: REAL_PLANETS,
    gmst: gmst, rotationPhase: rotationPhase
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Ephemeris;
  else root.Ephemeris = Ephemeris;
})(typeof window !== 'undefined' ? window : globalThis);
