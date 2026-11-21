'use strict';
/* Teren — czysty moduł rzeźby terenu zakładki Geologia (bez DOM/THREE). Dual-export (przeglądarka: window.Teren).
   Siatka = { w, h, bbox:{lonMin,lonMax,latMin,latMax}, mNaPiksel, wys: Float32Array } — wiersz 0 = północ,
   węzły leżą na brzegach bbox (i/(w-1)). Każdy poziom szczegółu (wyspa, archipelag, wstawki) to osobna Siatka.
   Układ lokalny sceny: 1 j. = 1 km, +x wschód, +z południe, początek = środek bbox WYSPY (jeden układ dla wszystkich
   poziomów, więc wstawki i archipelag pasują do siebie bez przesunięć).
   Wysokość z kafla terrarium: R*256 + G + B/256 − 32768 [m]. dekodujPng — część node-only (zlib). */
(function (root) {
  var R_ZIEMI_KM = 6371;
  var RAD = Math.PI / 180;
  // Środek bbox wyspy (−17.05…−15.95, 27.85…28.75) — początek układu lokalnego.
  var SRODEK = { lon: -16.5, lat: 28.3 };
  var COS0 = Math.cos(SRODEK.lat * RAD);

  function wysokoscTerrarium(r, g, b) { return r * 256 + g + b / 256 - 32768; }

  function zPikseli(rgba, w, h, meta) {
    var wys = new Float32Array(w * h);
    for (var i = 0; i < w * h; i++) wys[i] = wysokoscTerrarium(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    return { w: w, h: h, bbox: meta.bbox, mNaPiksel: meta.mNaPiksel, wys: wys };
  }

  function probka(s, lon, lat) {
    var b = s.bbox;
    if (!(lon >= b.lonMin && lon <= b.lonMax && lat >= b.latMin && lat <= b.latMax)) return null; // także NaN
    var fx = (lon - b.lonMin) / (b.lonMax - b.lonMin) * (s.w - 1);
    var fy = (b.latMax - lat) / (b.latMax - b.latMin) * (s.h - 1);
    var x0 = Math.min(Math.floor(fx), s.w - 2), y0 = Math.min(Math.floor(fy), s.h - 2);
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
    var x1 = Math.min(x0 + 1, s.w - 1), y1 = Math.min(y0 + 1, s.h - 1);
    var tx = fx - x0, ty = fy - y0;
    var a = s.wys[y0 * s.w + x0], c = s.wys[y0 * s.w + x1], d = s.wys[y1 * s.w + x0], e = s.wys[y1 * s.w + x1];
    return (a * (1 - tx) + c * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
  }

  // Aproksymacja równoprostokątna wokół środka wyspy: cos liczony w lat0, więc błąd skali x to ok. 0,4% na rogach
  // wyspy i ok. 1% na brzegach archipelagu (±1,1° szerokości). Dla makiety wystarcza.
  function doLokalnych(s, lon, lat) {
    return [(lon - SRODEK.lon) * RAD * R_ZIEMI_KM * COS0, -(lat - SRODEK.lat) * RAD * R_ZIEMI_KM];
  }
  function zLokalnych(s, xKm, zKm) {
    return [SRODEK.lon + xKm / (RAD * R_ZIEMI_KM * COS0), SRODEK.lat - zKm / (RAD * R_ZIEMI_KM)];
  }

  function profil(s, a, b, n) {
    n = Math.max(2, Math.floor(n) || 2);
    var dx = (b[0] - a[0]) * RAD * R_ZIEMI_KM * Math.cos((a[1] + b[1]) / 2 * RAD) * 1000;
    var dy = (b[1] - a[1]) * RAD * R_ZIEMI_KM * 1000;
    var dl = Math.hypot(dx, dy), out = [];
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1), lon = a[0] + (b[0] - a[0]) * t, lat = a[1] + (b[1] - a[1]) * t;
      out.push({ s_m: dl * t, lon: lon, lat: lat, h: probka(s, lon, lat) });
    }
    return out;
  }

  function statystyki(s) {
    var hMax = -Infinity, hMin = Infinity, iMax = 0;
    for (var i = 0; i < s.wys.length; i++) {
      var v = s.wys[i];
      if (v > hMax) { hMax = v; iMax = i; }
      if (v < hMin) hMin = v;
    }
    var b = s.bbox, x = iMax % s.w, y = Math.floor(iMax / s.w);
    return { hMax: hMax, hMin: hMin,
      lonLatMax: [b.lonMin + (b.lonMax - b.lonMin) * x / (s.w - 1), b.latMax - (b.latMax - b.latMin) * y / (s.h - 1)] };
  }

  // Dekoder PNG (node-only): typy koloru 2 i 6, 8 bitów, bez przeplotu. Zwraca { w, h, rgba: Uint8Array }.
  function dekodujPng(buf) {
    var zlib = require('zlib');
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('to nie PNG');
    var pos = 8, w = 0, h = 0, typ = 0, idat = [];
    while (pos < buf.length) {
      var len = buf.readUInt32BE(pos), name = buf.toString('latin1', pos + 4, pos + 8), d = buf.subarray(pos + 8, pos + 8 + len);
      if (name === 'IHDR') {
        w = d.readUInt32BE(0); h = d.readUInt32BE(4);
        if (d[8] !== 8 || (d[9] !== 2 && d[9] !== 6) || d[12] !== 0) throw new Error('PNG: obsługiwane tylko 8 bit, typ koloru 2/6, bez przeplotu (jest: głębia ' + d[8] + ', typ ' + d[9] + ', przeplot ' + d[12] + ')');
        typ = d[9];
      } else if (name === 'IDAT') idat.push(d);
      else if (name === 'IEND') break;
      pos += 12 + len;
    }
    var bpp = typ === 6 ? 4 : 3, stride = w * bpp;
    var raw = zlib.inflateSync(Buffer.concat(idat));
    if (raw.length !== h * (stride + 1)) throw new Error('PNG: obcięty lub uszkodzony strumień (' + raw.length + ' B zamiast ' + h * (stride + 1) + ')');
    var cur = new Uint8Array(stride), prev = new Uint8Array(stride), rgba = new Uint8Array(w * h * 4);
    for (var y = 0; y < h; y++) {
      var f = raw[y * (stride + 1)], o = y * (stride + 1) + 1;
      for (var i = 0; i < stride; i++) {
        var x = raw[o + i], a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0, p;
        if (f === 0) p = 0; else if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
        else if (f === 4) { var pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); p = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
        else throw new Error('PNG: nieznany filtr ' + f);
        cur[i] = (x + p) & 255;
      }
      for (var k = 0; k < w; k++) {
        rgba[(y * w + k) * 4] = cur[k * bpp]; rgba[(y * w + k) * 4 + 1] = cur[k * bpp + 1];
        rgba[(y * w + k) * 4 + 2] = cur[k * bpp + 2]; rgba[(y * w + k) * 4 + 3] = typ === 6 ? cur[k * bpp + 3] : 255;
      }
      var t = prev; prev = cur; cur = t;
    }
    return { w: w, h: h, rgba: rgba };
  }

  var api = { wysokoscTerrarium: wysokoscTerrarium, zPikseli: zPikseli, probka: probka, doLokalnych: doLokalnych,
    zLokalnych: zLokalnych, profil: profil, statystyki: statystyki, dekodujPng: dekodujPng, SRODEK: SRODEK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Teren = api;
})(typeof window !== 'undefined' ? window : globalThis);
