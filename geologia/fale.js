'use strict';
/* Zakładka Geologia — pole fal makiety (Task A1: fale, które wiedzą, gdzie jest brzeg). Czysta matematyka, bez DOM/THREE;
   dual-export (przeglądarka: window.GeologiaFale, node: module.exports). SCHEMAT typowych warunków, nie pomiar: martwa
   fala atlantycka z NNE (AZYMUT_FALI — azymut, Z KTÓREGO idzie), bez danych na żywo i bez symulacji.
   Układ jak siatki poziomów sceny (geologia/scena.js): wiersz 0 = północ, +x wschód, +z południe, dx/dz w km.
   KIERUNEK_FALI = [−sin 22,5°, cos 22,5°] — wektor (x, z), w którą stronę fala PŁYNIE (z NNE na SSW); to przeciwny zwrot
     niż WIATR w scena.js, który mówi, Z KTÓREGO wieje ([sin az, −cos az] dla azymutu az).
   poleFal(wys [m], w, h, dx, dz, odl [km, odlegloscOdBrzegu], kierunek?) → Uint8Array(w·h·4) RGBA:
     R, G = kierunek ruchu grzbietu (wektor jednostkowy, (v + 1)·127,5): przy brzegu skręca ku lądowi (−n_brzegu), od 3 km
       w morze = `kierunek`; przejście 1 − gładko((odl − 0,5)/2,5).
     B = ekspozycja ∈ [0, 1]: przy brzegu max(0, −kierunek·n_brzegu) (n_brzegu = gradient odl, od lądu na morze), w morzu 1;
       punkt w cieniu falowym (promień 15 km pod prąd fali trafia w ląd) × 0,25; wygładzona po morzu (ok. 1 km).
     A = stromość brzegu ∈ [0, 1] (0 plaża, 1 klif): maks. spadek lądu w promieniu 300 m, gładko((spadek − 0,15)/0,6).
   Komórki lądu dostają wartości sąsiedniego morza (wygładzanie z maską) — interpolacja tekstury na linii brzegu nie
   ciągnie do zera. Wynik zostaje w obiekcie poziomu (P.poleFal) dla odczytów na CPU (pejzaż dźwiękowy, Task B3). */
(function (root) {
  var RAD = Math.PI / 180;
  var AZYMUT_FALI = 22.5;                                       // ° od N przez E, skąd idzie martwa fala
  var KIERUNEK_FALI = [-Math.sin(AZYMUT_FALI * RAD), Math.cos(AZYMUT_FALI * RAD)];
  var ZASIEG_KM = 3;            // dalej od brzegu pole = kierunek bazowy
  var SKRET_KM = [0.5, 3];      // waga brzegu: 1 do 0,5 km, 0 od 3 km
  var CIEN_KM = 15, CIEN_MNOZNIK = 0.25;
  var STROMOSC_KM = 0.3, STROMOSC_PROG = [0.15, 0.6];
  var WYGLADZ_NORMALNEJ_KM = 0.3, WYGLADZ_EKSPOZYCJI_KM = 0.5;   // ekspozycja: dwa przebiegi pudełkowe (ok. 1 km)

  function gladko(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function koduj(v) { var b = Math.round((v + 1) * 127.5); return b < 0 ? 0 : b > 255 ? 255 : b; }
  function dlug(a, b) { return Math.sqrt(a * a + b * b); }
  function bajt(v) { var b = Math.round(v * 255); return b < 0 ? 0 : b > 255 ? 255 : b; }

  // Rozmycie pudełkowe w miejscu (sumy biegnące, brzeg przycięty — średnia z komórek w oknie), poziomo i pionowo.
  // Przebieg pionowy idzie wierszami (sumy kolumn naraz) — po kolumnach był kilkakrotnie wolniejszy (pamięć podręczna).
  function rozmyj(a, w, h, rx, rz, buf) {
    var t = buf || new Float32Array(w * h), x, y, k, s, n, o;
    for (y = 0; y < h; y++) {
      o = y * w; s = 0; n = 0;
      for (k = 0; k <= rx && k < w; k++) { s += a[o + k]; n++; }
      for (x = 0; x < w; x++) {
        t[o + x] = s / n;
        if (x + rx + 1 < w) { s += a[o + x + rx + 1]; n++; }
        if (x - rx >= 0) { s -= a[o + x - rx]; n--; }
      }
    }
    var acc = new Float64Array(w);
    n = 0;
    for (k = 0; k <= rz && k < h; k++) { o = k * w; for (x = 0; x < w; x++) acc[x] += t[o + x]; n++; }
    for (y = 0; y < h; y++) {
      o = y * w;
      for (x = 0; x < w; x++) a[o + x] = acc[x] / n;
      if (y + rz + 1 < h) { var od = (y + rz + 1) * w; for (x = 0; x < w; x++) acc[x] += t[od + x]; n++; }
      if (y - rz >= 0) { var ou = (y - rz) * w; for (x = 0; x < w; x++) acc[x] -= t[ou + x]; n--; }
    }
  }
  // Wygładzanie z maską (splot znormalizowany): wartości[i] = Σ v·m / Σ m w oknie; poza zasięgiem maski — `brak`.
  function rozmyjZMaska(listy, maska, w, h, rx, rz, przebiegi, brak) {
    var m = new Float32Array(maska), buf = new Float32Array(w * h), p, j, i;
    listy.forEach(function (v) { for (i = 0; i < v.length; i++) v[i] *= maska[i]; });
    for (p = 0; p < przebiegi; p++) {
      rozmyj(m, w, h, rx, rz, buf);
      for (j = 0; j < listy.length; j++) rozmyj(listy[j], w, h, rx, rz, buf);
    }
    listy.forEach(function (v, k) {
      for (i = 0; i < v.length; i++) v[i] = m[i] > 1e-6 ? v[i] / m[i] : brak[k];
    });
  }
  // Cień falowy: 1, gdy promień z komórki pod prąd fali (−kierunek) trafia w ląd w zasięgu `zasieg` km. Zamiast marszu
  // z każdej komórki (O(N · 15 km / krok)) — przejście wzdłuż równoległych linii rastrowych w kierunku fali: każda komórka
  // leży na dokładnie jednej linii (linie to przesunięcia jednej rasteryzacji), na linii liczymy drogę od ostatniego lądu.
  function cienFalowy(wys, w, h, dx, dz, kx, kz, zasieg) {
    var cien = new Uint8Array(w * h), cx = kx / dx, cz = kz / dz;          // kierunek w komórkach na km
    var poZ = Math.abs(cz) >= Math.abs(cx), n1 = poZ ? h : w, n2 = poZ ? w : h;
    var glowna = poZ ? cz : cx, boczna = poZ ? cx : cz, sg = glowna > 0 ? 1 : -1;
    var przes = boczna / Math.abs(glowna);                                   // komórek w bok na komórkę osi głównej
    var droga = (poZ ? dz : dx) / Math.abs(poZ ? kz : kx);                   // km wzdłuż promienia na komórkę osi głównej
    var zapas = Math.ceil(Math.abs(przes) * n1) + 1, r, b0, b, a, i, d;
    for (b0 = -zapas; b0 < n2 + zapas; b0++) {
      d = Infinity;                                                          // przed siatką: otwarte morze
      for (r = 0; r < n1; r++) {
        a = sg > 0 ? r : n1 - 1 - r;
        b = b0 + Math.round(r * przes);
        if (b < 0 || b >= n2) { d += droga; continue; }
        i = poZ ? a * w + b : b * w + a;
        if (wys[i] > 0) d = 0;
        else { d += droga; if (d <= zasieg) cien[i] = 1; }
      }
    }
    return cien;
  }
  // Maksimum w kwadracie (2r+1)², rozdzielnie — „maks. spadek w promieniu”.
  function maksimum(a, w, h, rx, rz) {
    var t = new Float32Array(a.length), x, y, k, m;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      m = 0;
      for (k = Math.max(0, x - rx); k <= Math.min(w - 1, x + rx); k++) if (a[y * w + k] > m) m = a[y * w + k];
      t[y * w + x] = m;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      m = 0;
      for (k = Math.max(0, y - rz); k <= Math.min(h - 1, y + rz); k++) if (t[k * w + x] > m) m = t[k * w + x];
      a[y * w + x] = m;
    }
  }

  function poleFal(wys, w, h, dx, dz, odl, kierunek) {
    var kl = kierunek ? dlug(kierunek[0], kierunek[1]) : 0;
    var kx = kl > 1e-9 ? kierunek[0] / kl : KIERUNEK_FALI[0], kz = kl > 1e-9 ? kierunek[1] / kl : KIERUNEK_FALI[1];
    var N = w * h, i, x, y;
    var o = new Float32Array(N), morze = new Float32Array(N);
    for (i = 0; i < N; i++) {
      var v = odl[i];
      o[i] = wys[i] > 0 ? 0 : v === v && v < 1e30 ? v : 1e3;      // NaN / nieskończoność = „daleko”
      morze[i] = wys[i] > 0 ? 0 : 1;
    }
    // n_brzegu: gradient odległości (od lądu na morze), wygładzony po morzu ok. 300 m
    var gx = new Float32Array(N), gz = new Float32Array(N);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      var xa = Math.max(0, x - 1), xb = Math.min(w - 1, x + 1), ya = Math.max(0, y - 1), yb = Math.min(h - 1, y + 1);
      gx[i] = (o[y * w + xb] - o[y * w + xa]) / ((xb - xa) * dx);
      gz[i] = (o[yb * w + x] - o[ya * w + x]) / ((yb - ya) * dz);
    }
    var rnx = Math.max(1, Math.round(WYGLADZ_NORMALNEJ_KM / dx)), rnz = Math.max(1, Math.round(WYGLADZ_NORMALNEJ_KM / dz));
    rozmyjZMaska([gx, gz], morze, w, h, rnx, rnz, 1, [0, 0]);

    // cień falowy: promień od punktu pod prąd fali (−kierunek), 15 km, trafia w ląd
    var cien = cienFalowy(wys, w, h, dx, dz, kx, kz, CIEN_KM);

    // kierunek grzbietu i ekspozycja (przed wygładzeniem)
    var rx = new Float32Array(N), rz = new Float32Array(N), eks = new Float32Array(N);
    for (i = 0; i < N; i++) {
      var wb = 1 - gladko((o[i] - SKRET_KM[0]) / (SKRET_KM[1] - SKRET_KM[0]));
      var gl = dlug(gx[i], gz[i]), nx, nz;
      if (gl > 1e-6) { nx = gx[i] / gl; nz = gz[i] / gl; } else { nx = -kx; nz = -kz; }   // brak normalnej: ku fali
      var vx = kx * (1 - wb) - nx * wb, vz = kz * (1 - wb) - nz * wb, vl = dlug(vx, vz);
      if (vl < 1e-3) { vx = -nx; vz = -nz; vl = 1; }              // zawietrzna, w pół skrętu: wprost ku lądowi
      rx[i] = vx / vl; rz[i] = vz / vl;
      var eb = Math.max(0, -(kx * nx + kz * nz));
      eks[i] = ((1 - wb) + wb * eb) * (cien[i] ? CIEN_MNOZNIK : 1);
    }
    var rex = Math.max(1, Math.round(WYGLADZ_EKSPOZYCJI_KM / dx)), rez = Math.max(1, Math.round(WYGLADZ_EKSPOZYCJI_KM / dz));
    rozmyjZMaska([eks], morze, w, h, rex, rez, 2, [1]);

    // stromość: spadek lądu (wysokość morza = 0), maksimum w promieniu 300 m
    var sp = new Float32Array(N);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      var xa2 = Math.max(0, x - 1), xb2 = Math.min(w - 1, x + 1), ya2 = Math.max(0, y - 1), yb2 = Math.min(h - 1, y + 1);
      var hx = (Math.max(0, wys[y * w + xb2]) - Math.max(0, wys[y * w + xa2])) / ((xb2 - xa2) * dx * 1000);
      var hz = (Math.max(0, wys[yb2 * w + x]) - Math.max(0, wys[ya2 * w + x])) / ((yb2 - ya2) * dz * 1000);
      var m = dlug(hx, hz);
      sp[i] = m === m ? m : 0;
    }
    maksimum(sp, w, h, Math.max(1, Math.round(STROMOSC_KM / dx)), Math.max(1, Math.round(STROMOSC_KM / dz)));

    var out = new Uint8Array(N * 4);
    for (i = 0; i < N; i++) {
      var dal = o[i] > ZASIEG_KM, ax = dal ? kx : rx[i], az = dal ? kz : rz[i], al = dlug(ax, az);
      if (!(al > 1e-6)) { ax = kx; az = kz; al = 1; }
      out[i * 4] = koduj(ax / al); out[i * 4 + 1] = koduj(az / al);
      var e = eks[i];
      out[i * 4 + 2] = bajt(e === e ? e : 1);
      out[i * 4 + 3] = dal ? 0 : bajt(gladko((sp[i] - STROMOSC_PROG[0]) / STROMOSC_PROG[1]));
    }
    return out;
  }

  var api = { AZYMUT_FALI: AZYMUT_FALI, KIERUNEK_FALI: KIERUNEK_FALI, ZASIEG_KM: ZASIEG_KM, CIEN_KM: CIEN_KM, poleFal: poleFal, cienFalowy: cienFalowy, koduj: koduj };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GeologiaFale = api;
})(typeof window !== 'undefined' ? window : globalThis);
