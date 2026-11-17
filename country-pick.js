/* ============================================================
   country-pick.js — geometria selekcji państwa pod kierunkiem na sferze Ziemi.
   Czysta matematyka, bez zależności DOM/THREE. Testowane. Dual-export jak focus-scale.js.
   ============================================================ */
(function (root) {
  'use strict';

  var DEG = 180 / Math.PI;

  // Odwrotność lonlatToLocal (solar.js): x=cosφcosλ, y=sinφ, z=−cosφsinλ.
  // dir: znormalizowany kierunek lokalny (np. wynik pickEarthDir). Zwraca stopnie.
  function lonLatFromDir(dir) {
    var y = dir.y < -1 ? -1 : dir.y > 1 ? 1 : dir.y;
    return { lon: Math.atan2(-dir.z, dir.x) * DEG, lat: Math.asin(y) * DEG };
  }

  // Klasyczny ray-casting (parzystość przecięć poziomej półprostej). ring: [[lon,lat],…].
  function pointInRing(lon, lat, ring) {
    var inside = false, n = ring.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      var hit = ((yi > lat) !== (yj > lat)) &&
                (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }

  // bbox-reject → PIP po pierścieniach (multipolygon: dowolny pierścień). Zwraca kraj albo null.
  function countryAt(lon, lat, countries) {
    for (var k = 0; k < countries.length; k++) {
      var c = countries[k], bb = c.bbox;
      if (bb && (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3])) continue;
      var polys = c.polys;
      for (var p = 0; p < polys.length; p++) {
        if (pointInRing(lon, lat, polys[p])) return c;
      }
    }
    return null;
  }

  var CountryPick = { lonLatFromDir: lonLatFromDir, pointInRing: pointInRing, countryAt: countryAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = CountryPick;
  else root.CountryPick = CountryPick;
})(typeof window !== 'undefined' ? window : globalThis);
