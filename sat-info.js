/* ============================================================
   sat-info.js — parametry orbity satelity z elementów SGP4 (satrec).
   Czysta matematyka (bez DOM/THREE). UMD jak sat-scale.js.
   ============================================================ */
(function (root) {
  'use strict';
  var MU = 398600.4418;   // km^3/s^2 — stała grawitacyjna Ziemi
  var RE = 6371;          // km — średni promień Ziemi

  // satrec.no = średni ruch [rad/min]; inclo [rad]; ecco [-]; satnum [string].
  function satOrbitParams(satrec){
    var noMin = satrec.no;                  // rad/min
    var periodMin = 2 * Math.PI / noMin;    // minuty
    var nSec = noMin / 60;                  // rad/s
    var a = Math.pow(MU / (nSec * nSec), 1/3);   // km — wielka półoś
    var e = satrec.ecco;
    return {
      periodMin: periodMin,
      incDeg: satrec.inclo * 180 / Math.PI,
      ecc: e,
      periKm: a * (1 - e) - RE,             // wysokość perygeum
      apoKm:  a * (1 + e) - RE,             // wysokość apogeum
      norad: String(satrec.satnum)
    };
  }

  // separator tysięcy bez locale (ICU w node może być niedostępne)
  function thousand(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  // liczba z przecinkiem dziesiętnym (polski format UI); —  gdy nie-skończona
  function comma(x, d){ return isFinite(x) ? x.toFixed(d).replace('.', ',') : '—'; }

  // Sformatowane fakty do karty info satelity.
  function satTechFacts(satrec){
    var p = satOrbitParams(satrec);
    return {
      'Okres orbity': comma(p.periodMin, 1) + ' min',
      'Inklinacja': comma(p.incDeg, 1) + '°',
      'Mimośród': comma(p.ecc, 4),
      'Perygeum': isFinite(p.periKm) ? thousand(Math.round(p.periKm)) + ' km' : '—',
      'Apogeum':  isFinite(p.apoKm)  ? thousand(Math.round(p.apoKm))  + ' km' : '—',
      'NORAD ID': p.norad
    };
  }

  var api = { satOrbitParams: satOrbitParams, satTechFacts: satTechFacts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SatInfo = api;
})(typeof self !== 'undefined' ? self : this);
