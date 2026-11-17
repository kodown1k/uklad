/* ============================================================
   probe-ephem.js — trajektorie sond z tabel JPL Horizons (probes/ephem.json).
   Próbki [jd, x, y, z] (AU, heliocentryczna ekliptyka J2000), uproszczone czasowo przez `simplify`
   (generator: scripts/gen-probes.mjs). Interpolacja liniowa w czasie, czas lotu światła,
   znaczniki godzin świetlnych, formatowanie. Czysta matematyka, bez DOM/THREE. Dual-export IIFE.
   ============================================================ */
(function (root) {
  'use strict';

  var C_KM_S = 299792.458;
  var AU_KM = 149597870.7;
  var LIGHT_DAY_AU = 86400 * C_KM_S / AU_KM;      // 173.1446… AU
  var AU_PER_SEC = C_KM_S / AU_KM;                // droga światła w 1 s [AU]

  function _lerp(a, b, jd) {
    var t = (jd - a[0]) / (b[0] - a[0]);
    return { x: a[1] + (b[1] - a[1]) * t, y: a[2] + (b[2] - a[2]) * t, z: a[3] + (b[3] - a[3]) * t };
  }

  // Liczba próbek z jd ≤ zadanego (binarnie; próbki rosnące po jd).
  function countUntil(samples, jd) {
    var lo = 0, hi = samples.length;
    while (lo < hi) { var m = (lo + hi) >> 1; if (samples[m][0] <= jd) lo = m + 1; else hi = m; }
    return lo;
  }

  // Pozycja [AU] na dzień juliański. Przed startem danych → pierwsza próbka; po końcu → ekstrapolacja
  // liniowa ostatniego odcinka (dane kończą się w 2040 r., sondy lecą tam prawie po prostej).
  function positionAt(samples, jd) {
    var n = samples.length;
    if (n === 1 || jd <= samples[0][0]) { var s = samples[0]; return { x: s[1], y: s[2], z: s[3] }; }
    if (jd >= samples[n - 1][0]) return _lerp(samples[n - 2], samples[n - 1], jd);
    var i = countUntil(samples, jd);
    return _lerp(samples[i - 1], samples[i], jd);
  }

  // Upraszczanie CZASOWE: zostawia próbki, bez których interpolacja liniowa w czasie odbiega od surowej
  // próbki o więcej niż tol [AU]. Zachłanne: odcinek z punktu i rośnie, dopóki wszystkie pośrednie mieszczą się w tol.
  function simplify(raw, tol) {
    if (raw.length <= 2) return raw.slice();
    var out = [raw[0]], i = 0, n = raw.length;
    function ok(i, j) {
      for (var k = i + 1; k < j; k++) {
        var p = _lerp(raw[i], raw[j], raw[k][0]);
        var dx = p.x - raw[k][1], dy = p.y - raw[k][2], dz = p.z - raw[k][3];
        if (dx * dx + dy * dy + dz * dz > tol * tol) return false;
      }
      return true;
    }
    while (i < n - 1) {
      var j = i + 1;
      while (j + 1 < n && ok(i, j + 1)) j++;
      out.push(raw[j]); i = j;
    }
    return out;
  }

  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
  function lightTimeSec(a, b) { return dist(a, b) / AU_PER_SEC; }

  // Znaczniki „godzin świetlnych" na odcinku Ziemia→sonda o długości dAU: sygnały wysyłane co stepSec
  // (pełne godziny UTC), płynące z prędkością światła. Zwraca ułamki [0,1] drogi, rosnąco.
  // Uproszczenie: linia prosta do bieżącej pozycji sondy (sonda w ciągu doby przesuwa się o ~2 mln km).
  function pulseFractions(dAU, nowMs, stepSec) {
    var step = stepSec || 3600, out = [];
    if (!(dAU > 0)) return out;
    var since = ((nowMs / 1000) % step + step) % step;      // sekundy od ostatniej pełnej godziny
    for (var k = 0; ; k++) {
      var f = (since + k * step) * AU_PER_SEC / dAU;
      if (f > 1) break;
      out.push(f);
    }
    return out;
  }

  // „23 h 59 min 58 s" / „5 min 3 s" / „12 s"
  function fmtDuration(sec) {
    sec = Math.max(0, Math.round(sec));
    var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    var parts = [];
    if (d) parts.push(d + ' d');
    if (d || h) parts.push(h + ' h');
    if (d || h || m) parts.push(m + ' min');
    if (!d) parts.push(s + ' s');
    return parts.join(' ');
  }

  // Opis względem zdarzenia: „za 1 d 18 h 29 min" / „1 h 2 min temu"
  function relativeTo(eventMs, nowMs) {
    var dt = (eventMs - nowMs) / 1000;
    return dt >= 0 ? 'za ' + fmtDuration(dt) : fmtDuration(-dt) + ' temu';
  }

  var ProbeEphem = {
    C_KM_S: C_KM_S, AU_KM: AU_KM, LIGHT_DAY_AU: LIGHT_DAY_AU, AU_PER_SEC: AU_PER_SEC,
    countUntil: countUntil, positionAt: positionAt, simplify: simplify,
    dist: dist, lightTimeSec: lightTimeSec, pulseFractions: pulseFractions,
    fmtDuration: fmtDuration, relativeTo: relativeTo
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ProbeEphem;
  else root.ProbeEphem = ProbeEphem;
})(typeof window !== 'undefined' ? window : globalThis);
