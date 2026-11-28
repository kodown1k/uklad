'use strict';
/* Zakładka Geologia — kurz kalimy do starcia (Task C1). Czysta część, bez DOM/THREE; dual-export (przeglądarka:
   window.GeologiaKurz, node: module.exports). SCHEMAT, nie pomiar: przy pogodzie „Kalima” makietę pokrywa rdzawy pył,
   który widz ściera palcem albo myszą; starte miejsce zarasta kurzem przez ODROST_H godzin (spec: „przez kilka dni”).
   Bez danych na żywo — ani o pyle, ani o pogodzie.
   Maska = Uint16Array(ROZMIAR²) w UV prostokąta wyspy (u: zachód → wschód, v: północ → południe; teksel (ix, iy) ma środek
   ((ix + 0,5)/ROZMIAR, (iy + 0,5)/ROZMIAR), wiersz 0 = północ jak siatki sceny). Wartość = godzina starcia liczona od
   2026-01-01 00:00 UTC (godzina(ms)); 0 = nigdy nie starte. Uint16 sięga 65 535 h (ok. 7,5 roku od epoki).
   nowa() → maska zer.
   zetrzyj(maska, u, v, promienUV, terazH) → liczba tekseli, które się zmieniły — koło w UV, wpisuje ceil(terazH) (≥ 1).
   grubosc(maska, terazH) → Uint8Array(ROZMIAR²): 255 dla nigdy nie startych, 255 · clamp((terazH − tStarcia)/ODROST_H, 0, 1)
     dla startych (zaokrąglenie do całości) — dane tekstury uKurz sceny.
   starte(maska, terazH) → liczba tekseli z niepełnym odrostem (grubość < 255).
   godzina(ms) → godziny od 2026-01-01 UTC (ułamek zostaje; ≥ 1).
   zapisz(maska, magazyn) → true | false / wczytaj(magazyn) → maska — magazyn o interfejsie localStorage (getItem, setItem),
     wartość = base64 bajtów maski (little-endian) w kluczu KLUCZ ('geologia-kurz'). Każdy wyjątek magazynu (tryb prywatny,
     zablokowane ciasteczka, brak miejsca), brak magazynu i zły zapis → zapisz nic nie robi (false), wczytaj zwraca nowa():
     makieta działa bez localStorage, kurz trwa wtedy tylko w sesji (Review Focus 5). */
(function (root) {
  var ROZMIAR = 256, ODROST_H = 72, KLUCZ = 'geologia-kurz', MAKS_H = 65535;
  var EPOKA_MS = Date.UTC(2026, 0, 1);
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function nowa() { return new Uint16Array(ROZMIAR * ROZMIAR); }
  function godzina(ms) { var h = (ms - EPOKA_MS) / 3600000; return h > 1 ? h : 1; }

  function zetrzyj(maska, u, v, promienUV, terazH) {
    var r = +promienUV, t = Math.ceil(+terazH);
    if (!(r > 0) || !(u === u) || !(v === v) || !(t > 0)) return 0;
    if (t > MAKS_H) t = MAKS_H;
    var N = ROZMIAR, cx = u * N - 0.5, cy = v * N - 0.5, rt = r * N, rt2 = rt * rt;
    var x0 = Math.max(0, Math.ceil(cx - rt)), x1 = Math.min(N - 1, Math.floor(cx + rt));
    var y0 = Math.max(0, Math.ceil(cy - rt)), y1 = Math.min(N - 1, Math.floor(cy + rt));
    var n = 0;
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > rt2) continue;
      var i = y * N + x;
      if (maska[i] !== t) { maska[i] = t; n++; }
    }
    return n;
  }

  function grubosc(maska, terazH, wynik) {
    var g = wynik || new Uint8Array(ROZMIAR * ROZMIAR), k = 255 / ODROST_H;
    for (var i = 0; i < g.length; i++) {
      var s = maska[i];
      if (s === 0) { g[i] = 255; continue; }
      var d = terazH - s;
      g[i] = d <= 0 ? 0 : d >= ODROST_H ? 255 : Math.round(d * k);
    }
    return g;
  }

  function starte(maska, terazH) {
    var n = 0;
    for (var i = 0; i < maska.length; i++) if (maska[i] !== 0 && terazH - maska[i] < ODROST_H) n++;
    return n;
  }

  // base64 bez btoa/Buffer (ten sam kod w przeglądarce i w node); bajty maski little-endian niezależnie od platformy
  function doBase64(m) {
    var b = new Uint8Array(m.length * 2), i;
    for (i = 0; i < m.length; i++) { b[2 * i] = m[i] & 255; b[2 * i + 1] = m[i] >> 8; }
    var cz = [];
    for (i = 0; i < b.length; i += 3) {
      var a0 = b[i], a1 = i + 1 < b.length ? b[i + 1] : 0, a2 = i + 2 < b.length ? b[i + 2] : 0, w = (a0 << 16) | (a1 << 8) | a2;
      cz.push(B64[w >> 18 & 63] + B64[w >> 12 & 63] + (i + 1 < b.length ? B64[w >> 6 & 63] : '=') + (i + 2 < b.length ? B64[w & 63] : '='));
    }
    return cz.join('');
  }
  function zBase64(s) {
    if (typeof s !== 'string' || s.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return null;
    var dl = s.length / 4 * 3 - (s.charAt(s.length - 1) === '=' ? 1 : 0) - (s.charAt(s.length - 2) === '=' ? 1 : 0);
    if (dl !== ROZMIAR * ROZMIAR * 2) return null;
    var b = new Uint8Array(dl), j = 0;
    for (var i = 0; i < s.length; i += 4) {
      var w = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12) | ((s[i + 2] === '=' ? 0 : B64.indexOf(s[i + 2])) << 6) | (s[i + 3] === '=' ? 0 : B64.indexOf(s[i + 3]));
      if (j < dl) b[j++] = w >> 16 & 255;
      if (j < dl) b[j++] = w >> 8 & 255;
      if (j < dl) b[j++] = w & 255;
    }
    var m = nowa();
    for (var k = 0; k < m.length; k++) m[k] = b[2 * k] | (b[2 * k + 1] << 8);
    return m;
  }

  function zapisz(maska, magazyn) {
    try {
      if (!magazyn || !maska || maska.length !== ROZMIAR * ROZMIAR) return false;
      magazyn.setItem(KLUCZ, doBase64(maska));
      return true;
    } catch (_) { return false; }                     // tryb prywatny, brak miejsca, zablokowany magazyn — kurz tylko w sesji
  }
  function wczytaj(magazyn) {
    try {
      if (!magazyn) return nowa();
      return zBase64(magazyn.getItem(KLUCZ)) || nowa();
    } catch (_) { return nowa(); }
  }

  var api = { ROZMIAR: ROZMIAR, ODROST_H: ODROST_H, KLUCZ: KLUCZ, nowa: nowa, godzina: godzina, zetrzyj: zetrzyj, grubosc: grubosc,
    starte: starte, zapisz: zapisz, wczytaj: wczytaj };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GeologiaKurz = api;
})(typeof window !== 'undefined' ? window : globalThis);
