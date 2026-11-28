'use strict';
/* Zakładka Geologia — scena makiety (plik przeglądarkowy, THREE r128; czysta część w node: dual-export).
   GeologiaScena.zbuduj(T, renderer, { siatka, poziomy: { archipelag, wstawki }, dane, lod: 'pelny'|'lekki', przewyzszenie = 1.5,
     fale = true, cienieHor = true, wiatr = true, wiatrLinie = GeologiaWiatr.LICZBA.pelna, kurz = true })
     → { scena, kamera, teren, ocean, kolorowanie(tryb), przekroj(null | { kat_st, przesuniecie_km }) → profil, chmury(wl),
         woda(stan, f), material(m), swiatlo({ pora, az, el }), horyzont(mapa), cienieHor(wl), wiatr(wl, n), kurz({ widoczny, gruboscGlob, maska }), przewyzszenie(x), czesci: { [id]: Object3D }, pick(ndcX, ndcY) → id|null,
         podswietl(id|null), kotwica(id) → [x, y, z], animuj(t), czas(Ma), zwolnij(),
         efekty: { luna, zar, cienChmur, wypelnienie } (haki animacji A1–A4, geologia/animacje.js),
         (dodatki dla widoku i sondy) wysokosc(x, z), probkaSwiatla(x, z), lad, granice, trafiaSciane(ndc), punktNaMorzu(ndc), stan(),
         (Task 7b) dodajWarstwe(buduj) — hak warstw nakładanych na makietę (warstwa turystyczna): buduj({ T, scena, z, kamera,
         renderer, wysokosc, przewyzszenie(), uPrzew, czasMa() }) → obiekt z animuj() → prostokąty zajęte [x0,y0,x1,y1,…] (px),
         które etykiety części omijają; zasoby przez z() — zwalnia je zwolnij(); przygasCzesci(f) — krycie znaczników części }
   Układ: 1 j. = 1 km, +x wschód, +y góra (km × przewyższenie), +z południe, początek = środek bbox wyspy (Teren.doLokalnych).
   Poziomy: archipelag (pod spodem, wycięty w prostokącie wyspy), wyspa (krawędź kafla wtopiona w archipelag na 8 km),
   wstawki 34 m (krawędź wtopiona w wyspę na 300 m; wyspa wycina ich prostokąty). Wtapianie jest geometryczne — wysokości
   brzegu drobniejszego poziomu przechodzą w powierzchnię grubszego (ta sama trójkątna interpolacja co na GPU), więc nie
   ma przezroczystej siatki („góry przez góry”) ani szwu. Siatka każdego poziomu ma układ PlaneGeometry (wiersz 0 = północ,
   trójkąty a-b-d i b-c-d), ale budowana jest od razu w tablicach typowanych — PlaneGeometry 1024 × 952 alokowała ok. 120 MB
   tablic pośrednich. `lekki` = co druga próbka (geometria); mapa normalnych zawsze z pełnej siatki.
   Przewyższenie = skala y siatek (normalne z mapy w przestrzeni obiektu przelicza normalMatrix), znaczniki i kotwice
   liczone z bieżącej powierzchni (G-D). Barwy w shaderze terenu: `teren` (hipsometria), `geologia` (tekstura indeksów
   jednostek z pointInRing, budowana raz), `krajobraz` (wysokość + nawietrzność na pasat NE z wygładzonej rzeźby + nachylenie).
   Ocean: dysk 400 km (rośnie z wysokością kamery) pod kamerą, mgła radialna od 60% promienia w barwę horyzontu nieba;
   woda `realna` (nieprzezroczysta, barwa z głębokości, Fresnel, połysk słońca na animowanej mapie fal, piana przy brzegu)
   ↔ `szklana` (krycie 0,25, mgła wodna 25 km na dnie) płynnie przez f. Światło (spec R4): klucz kierunkowy z cieniem
   (mapa cieni odświeżana tylko przy zmianie światła/przewyższenia/przekroju), wypełnienie HemisphereLight(c, c),
   jedno światło punktowe „lawa” od budowy z mocą 0 (liczba świateł w kluczu programu — docs/material-filmowy.md).
   Jedna płaszczyzna przycinania zawsze obecna (wyłączony przekrój = płaszczyzna w nieskończoności) — przełączenie
   przekroju nie przekompilowuje materiałów.
   Czas geologiczny (czas(Ma), Task 7): rzeźbę chwili Ma liczy SHADER WIERZCHOŁKÓW terenu (GLSL_EWOLUCJA = rachunek
   geologia/ewolucja.js na GPU: dzisiejsza wysokość wierzchołka + tekstura przynależności RGBA8 (jednostka, druga jednostka
   stoku, waga mieszania) + parametry jednostek
   w uniformach), także w materiale głębi cienia (customDepthMaterial) i w shaderze wody (głębokość, piana przy brzegu
   chwili). Animacja A1 zmienia tylko uniform uEwoMa — żadnego przeliczania 1 mln komórek na CPU w klatce. CPU liczy
   ten sam rachunek punktowo (wysokosc(x, z): znaczniki, kotwice, kamera — G-D). Przynależność i tekstury powstają
   leniwie przy pierwszym czas(Ma > 0); program cieniowania jest ten sam od budowy (gałąź za uniformem).
   Fale znające brzeg (Task A1, schemat typowych warunków — geologia/fale.js): pole RGBA8 poziomów wyspy i archipelagu
   (P.poleFal na CPU, P.tFale na GPU; wstawki czytają pole wyspy) — kierunek grzbietu przy brzegu, ekspozycja na martwą
   falę z NNE z cieniem falowym, stromość brzegu. W wodzie: martwa fala daleko i grzbiety równoległe do brzegu blisko
   (mieszanka amplitud, nie faz), piana z rozbryzgiem na klifach i pasem wybiegu na plażach. o.fale === false (pokaz:
   kadry filmów strojone bez fal) — pola się nie liczy, uFaleWl = 0 i woda jest bit w bit jak przed A1. Czas geologiczny
   (uEwoMa > 0): pole opisuje dzisiejszy brzeg, więc gaśnie na całym morzu (geDzis) — zostaje martwa fala bez cienia
   i dotychczasowy pas piany z brzegu chwili.
   Materiał „Sklejka” (Task B1 — geologia/sklejka.js): material('zwykly'|'sklejka') — uMaterial 0/1 i uKrokSklejki
   (GeologiaSklejka.krok(przewyższenie), odświeżany w przewyzszenie(x)), woda szklana z mgłą wodną żywicy #2e7f8c albo realna.
   Warstwy liczone z wysokości rysowanej powierzchni (przy czasie geologicznym — rzeźba chwili), krawędzie i cień schodka
   z pochodnych ekranowych; bez tekstur i bez nowych programów. Domyślnie uMaterial = 0: gałąź pominięta (pokaz).
   Cienie z mapy horyzontu (Task A3 — geologia/horyzont.js, mapa z scripts/gen-horyzont-teneryfy.mjs): horyzont({ meta, rgba0,
   rgba1 }) wgrywa 8 kątów horyzontu na komórkę (uHor0/uHor1) przez z() i stożek Teide (uStozek z horyzont.json); uSlonceAzEl [rad] z swiatlo(). Teren: światło klucza × (1 − zasłonięcie z mapy) w LUZ_SWIATLA (miękkie
   cienie własne dolin i wąwozów, obok mapy cieni). Woda (tafla 0 m) i strop chmur (STROP_CHMUR_KM jako płaszczyzna): cień
   Teide z modelu stożka (R13, GeologiaHoryzont.cienStozka — klin trójkątny), gasi światło słoneczne, połysk i pianę,
   a przy niskim Słońcu także poświatę (barwa × 1 − POSWIATA·cień). uCienieHor = 1 tylko z wczytaną mapą, bez czasu geologicznego (uEwoMa > 0 — mapa opisuje dzisiejszą rzeźbę)
   i z zezwoleniem widoku cienieHor(wl) (animacje A1–A5: false); stan().cienieHor. o.cienieHor === false (pokaz) — mapy
   się nie wgrywa nigdy: gałąź pominięta, kadry filmów bit w bit jak przed A3.
   Smugi pasatu i piasek (Task A2, schemat typowych warunków — geologia/wiatr.js): pole opływu z rzeźby wyspy (raz, na CPU)
   i linie prądu od brzegu nawietrznego w jednej geometrii LineSegments (atrybuty position, s, piasek, zanik) — kreska biegnąca
   liczona w shaderze z uCzas (bufor bez aktualizacji w klatce). Grupa w układzie siatki wyspy, scale.y = przewyższenie.
   wiatr(wl, n): zezwolenie widoku (animacje A1–A5: false) i liczba linii (zmiana → jedna przebudowa geometrii, pole
   zostaje); widoczne tylko bez czasu geologicznego (uEwoMa > 0 — linie opisują dzisiejszą rzeźbę). o.wiatr === false
   (pokaz) — warstwy nie ma wcale: kadry filmów bez smug. stan().wiatr (widoczna), stan().wiatrLinie, stan().wiatrMs (budowa).
   Pejzaż dźwiękowy i stuknięcie w skałę (Task B3 — geologia/pejzaz.js; dźwięk gra widok): punktNaTerenie(nx, ny) → [x, z] | null
   (ląd pod punktem ekranu, marsz promienia po wysokosc(); morze i niebo → null), jednostkaPod(x, z) → id jednostki z indeksów
   wstawki / wyspy (przy czasie geologicznym null — mapa jest dzisiejsza), probkaPejzazu(x, z) → { naMorzu, odlBrzeguKm, wysM,
   ekspozycja } (ekspozycja z P.poleFal, odległość od brzegu lądu liczona raz przy pierwszej próbce), stuk(x, z, tSek) —
   pierścień w shaderze terenu (uStuk = x, z, t0, aktywny; promień 0 → 3 km w 1,2 s na zegarze animuj(t), potem w = 0 i gałąź
   pominięta). Pokaz nie woła stuk() nigdy: kadry filmów bez zmian. stan().stuk = pierścień aktywny.
   Kurz kalimy do starcia (Task C1 — geologia/kurz.js, schemat): kurz({ widoczny, gruboscGlob, maska }) — rdzawy pył #b0733e
   na lądzie z grubością uKurzGrubosc × maska (tekstura uKurz w UV prostokąta wyspy przez z(), dane odświeżane needsUpdate),
   kurzUV(x, z) → [u, v] | null. Ukryty przy czasie geologicznym (uEwoMa > 0). o.kurz === false (pokaz) — kurz() nic nie
   robi: uKurzGrubosc = 0, gałąź pominięta. stan().kurz (rysowany), stan().kurzGrubosc. */
(function (root) {
  var Teren = root.Teren || (typeof require === 'function' ? require('./teren.js') : null);
  var Ew = root.Ewolucja || (typeof require === 'function' ? require('./ewolucja.js') : null);
  var Fale = root.GeologiaFale || (typeof require === 'function' ? require('./fale.js') : null);
  var Sklejka = root.GeologiaSklejka || (typeof require === 'function' ? require('./sklejka.js') : null);
  var Hor = root.GeologiaHoryzont || (typeof require === 'function' ? require('./horyzont.js') : null);
  var Wt = root.GeologiaWiatr || (typeof require === 'function' ? require('./wiatr.js') : null);
  var Pejzaz = root.GeologiaPejzaz || (typeof require === 'function' ? require('./pejzaz.js') : null);
  var RAD = Math.PI / 180;
  var MORZE_POD_KM = 0.012;            // dno o wysokości 0 (półka szwu SRTM/ETOPO) leży 12 m pod taflą — bez z-fightingu
  var WTOP_WYSPA_KM = 8, WTOP_WSTAWKA_KM = 0.3;
  var WIATR = [Math.SQRT1_2, -Math.SQRT1_2];   // pasat z NE: kierunek (x, z), Z KTÓREGO wieje
  var DNO_KM = -12;                     // spód ściany przekroju (skorupa sięga 11,9 km)
  var GORA_SCIANY_KM = 4;
  var STROP_CHMUR_KM = 1.5;            // stała MODELU warstwy chmur makiety (nie fakt — wysokość w UI: dane f-morze-chmur)
  var SKALA_ETYKIETY = 0.56;          // etykieta rysowana pismem 26 px, na ekranie ok. 15 px
  var R_ZIEMI = 6371, KM_STOPIEN = R_ZIEMI * Math.PI / 180;   // jak Teren.doLokalnych
  var MGIELKA_L = [20, 0];            // km: L kolumny powietrza (pokaz; patrz GLSL_MGIELKA; drugi składnik nieużywany)

  /* ---------- czysta część (node) ---------- */
  function gladko(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function prostokat(s) {
    var nw = Teren.doLokalnych(s, s.bbox.lonMin, s.bbox.latMax), se = Teren.doLokalnych(s, s.bbox.lonMax, s.bbox.latMin);
    return { x0: nw[0], z0: nw[1], x1: se[0], z1: se[1] };
  }
  function wewnatrz(r, x, z) { return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1; }

  // Odległość od lądu (h > 0) w km — dwuprzebiegowa transformata odległości (fazowanie 8-sąsiedzkie), ląd = 0.
  function odlegloscOdBrzegu(wys, w, h, dx, dz) {
    var INF = 1e9, d = new Float32Array(w * h), c = Math.hypot(dx, dz), i, x, y, v;
    for (i = 0; i < w * h; i++) d[i] = wys[i] > 0 ? 0 : INF;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; v = d[i];
      if (x > 0 && d[i - 1] + dx < v) v = d[i - 1] + dx;
      if (y > 0) {
        if (d[i - w] + dz < v) v = d[i - w] + dz;
        if (x > 0 && d[i - w - 1] + c < v) v = d[i - w - 1] + c;
        if (x < w - 1 && d[i - w + 1] + c < v) v = d[i - w + 1] + c;
      }
      d[i] = v;
    }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) {
      i = y * w + x; v = d[i];
      if (x < w - 1 && d[i + 1] + dx < v) v = d[i + 1] + dx;
      if (y < h - 1) {
        if (d[i + w] + dz < v) v = d[i + w] + dz;
        if (x < w - 1 && d[i + w + 1] + c < v) v = d[i + w + 1] + c;
        if (x > 0 && d[i + w - 1] + c < v) v = d[i + w - 1] + c;
      }
      d[i] = v;
    }
    return d;
  }

  // Rozmycie pudełkowe w miejscu (sumy biegnące, brzeg przycięty), poziomo i pionowo.
  function rozmyj(a, w, h, rx, rz) {
    var tmp = new Float32Array(Math.max(w, h)), x, y, k, s, n;
    for (y = 0; y < h; y++) {
      var o = y * w; s = 0; n = 0;
      for (k = 0; k <= rx && k < w; k++) { s += a[o + k]; n++; }
      for (x = 0; x < w; x++) {
        tmp[x] = s / n;
        if (x + rx + 1 < w) { s += a[o + x + rx + 1]; n++; }
        if (x - rx >= 0) { s -= a[o + x - rx]; n--; }
      }
      for (x = 0; x < w; x++) a[o + x] = tmp[x];
    }
    for (x = 0; x < w; x++) {
      s = 0; n = 0;
      for (k = 0; k <= rz && k < h; k++) { s += a[k * w + x]; n++; }
      for (y = 0; y < h; y++) {
        tmp[y] = s / n;
        if (y + rz + 1 < h) { s += a[(y + rz + 1) * w + x]; n++; }
        if (y - rz >= 0) { s -= a[(y - rz) * w + x]; n--; }
      }
      for (y = 0; y < h; y++) a[y * w + x] = tmp[y];
    }
  }

  // Nawietrzność −1…1: czy makro-zbocze (rzeźba wygładzona na ok. promienKm, morze = 0) jest zwrócone ku wiatrowi.
  // Lokalne zbocze doliny po zawietrznej stronie wyspy zostaje zawietrzne — decyduje strona wyspy, nie ekspozycja stoku.
  function nawietrznosc(wys, w, h, dx, dz, promienKm, wiatr) {
    wiatr = wiatr || WIATR;
    var a = new Float32Array(w * h), out = new Float32Array(w * h), i, x, y;
    for (i = 0; i < w * h; i++) a[i] = wys[i] > 0 ? wys[i] : 0;
    var rx = Math.max(1, Math.round(promienKm / dx / 2)), rz = Math.max(1, Math.round(promienKm / dz / 2));
    for (var p = 0; p < 3; p++) rozmyj(a, w, h, rx, rz);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      var gx = (a[y * w + Math.min(w - 1, x + 1)] - a[y * w + Math.max(0, x - 1)]) / ((Math.min(w - 1, x + 1) - Math.max(0, x - 1)) * dx);
      var gz = (a[Math.min(h - 1, y + 1) * w + x] - a[Math.max(0, y - 1) * w + x]) / ((Math.min(h - 1, y + 1) - Math.max(0, y - 1)) * dz);
      var m = Math.hypot(gx, gz);                       // m/km
      out[i] = m > 1e-6 ? ((-gx * wiatr[0] - gz * wiatr[1]) / m) * gladko((m - 4) / 36) : 0;
    }
    return out;
  }

  // Indeks jednostki geologicznej na komórkę lądu (0 = brak/morze, k+1 = jednostki[k]); pierwsza pasująca wygrywa.
  function indeksyJednostek(wys, w, h, bbox, jednostki, pip) {
    var out = new Uint8Array(w * h);
    var pierscienie = jednostki.map(function (j) {
      return (j.wielokaty || []).map(function (r) {
        var b = [Infinity, Infinity, -Infinity, -Infinity];
        r.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); });
        return { r: r, b: b };
      });
    });
    for (var y = 0; y < h; y++) {
      var lat = bbox.latMax - (bbox.latMax - bbox.latMin) * y / (h - 1);
      for (var x = 0; x < w; x++) {
        var i = y * w + x;
        if (!(wys[i] > 0)) continue;
        var lon = bbox.lonMin + (bbox.lonMax - bbox.lonMin) * x / (w - 1);
        szukaj: for (var k = 0; k < pierscienie.length; k++) {
          for (var q = 0; q < pierscienie[k].length; q++) {
            var P = pierscienie[k][q];
            if (lon < P.b[0] || lon > P.b[2] || lat < P.b[1] || lat > P.b[3]) continue;
            if (pip(lon, lat, P.r)) { out[i] = k + 1; break szukaj; }
          }
        }
      }
    }
    return out;
  }

  // Linia przekroju: azymut katSt (0 = N–S, 90 = W–E), przez punkt `srodek` [x, z] przesunięty o przesKm wzdłuż normalnej
  // (kat + 90°), przycięta do prostokąta. Normalna wskazuje stronę usuwaną (widz stoi po niej i widzi `a` po lewej).
  function liniaPrzekroju(prost, srodek, katSt, przesKm) {
    var a = katSt * RAD, d = [Math.sin(a), -Math.cos(a)], n = [Math.cos(a), Math.sin(a)];
    var p = [srodek[0] + n[0] * (przesKm || 0), srodek[1] + n[1] * (przesKm || 0)];
    var t0 = -Infinity, t1 = Infinity, gr = [[prost.x0, prost.x1], [prost.z0, prost.z1]];
    for (var k = 0; k < 2; k++) {
      if (Math.abs(d[k]) < 1e-12) { if (p[k] < gr[k][0] || p[k] > gr[k][1]) return null; continue; }
      var ta = (gr[k][0] - p[k]) / d[k], tb = (gr[k][1] - p[k]) / d[k];
      if (ta > tb) { var s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
    }
    if (!(t1 - t0 > 1e-6)) return null;
    return { a: [p[0] + d[0] * t0, p[1] + d[1] * t0], b: [p[0] + d[0] * t1, p[1] + d[1] * t1], kier: d, normalna: n, punkt: p, dl: t1 - t0 };
  }

  // Wysokość wyświetlanej powierzchni poziomu (interpolacja w trójkątach siatki, jak na GPU). null poza poziomem.
  function wysokoscTrojkatna(P, x, z) {
    var fx = (x - P.x0) / P.dxv, fy = (z - P.z0) / P.dzv;
    if (!(fx >= 0 && fy >= 0 && fx <= P.nx - 1 && fy <= P.nz - 1)) return null;
    var ix = Math.min(Math.floor(fx), P.nx - 2), iy = Math.min(Math.floor(fy), P.nz - 2), u = fx - ix, v = fy - iy, hs = P.hs, nx = P.nx;
    var a = hs[iy * nx + ix], b = hs[(iy + 1) * nx + ix], c = hs[(iy + 1) * nx + ix + 1], d = hs[iy * nx + ix + 1];
    return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
  }

  /* ---------- przeglądarka: pomocnicze ---------- */
  function hexLin(T, hex) { return new T.Color(hex).convertSRGBToLinear(); }
  // materiał „Sklejka” (Task B1): barwa mgły wodnej (ocean-żywica) i grubość arkusza z przewyższenia
  var KOLOR_WODY = { zwykly: '#123a52', sklejka: '#2e7f8c' };
  function krokSklejki(e) { return Sklejka ? Sklejka.krok(e) : 75; }
  function plotno(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // Siatka o układzie PlaneGeometry(W, H, segX, segY) w tablicach typowanych: wierzchołek (ix, iy) = iy·(segX+1) + ix,
  // uv = (ix/segX, 1 − iy/segY), trójkąty (a, b, d) i (b, c, d).
  function geometriaSiatki(T, P) {
    var nx = P.nx, nz = P.nz, n = nx * nz, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (var iy = 0; iy < nz; iy++) for (var ix = 0; ix < nx; ix++) {
      var i = iy * nx + ix;
      pos[i * 3] = P.x0 + ix * P.dxv; pos[i * 3 + 1] = P.hs[i]; pos[i * 3 + 2] = P.z0 + iy * P.dzv;
      uv[i * 2] = ix / (nx - 1); uv[i * 2 + 1] = 1 - iy / (nz - 1);
      var fx = Math.round(ix / (nx - 1) * (P.w - 1)), fy = Math.round(iy / (nz - 1) * (P.h - 1)), k = (fy * P.w + fx) * 4;
      nor[i * 3] = P.normalne[k] / 127.5 - 1; nor[i * 3 + 1] = P.normalne[k + 1] / 127.5 - 1; nor[i * 3 + 2] = P.normalne[k + 2] / 127.5 - 1;
    }
    var segX = nx - 1, segY = nz - 1, idx = new Uint32Array(segX * segY * 6), q = 0;
    for (iy = 0; iy < segY; iy++) for (ix = 0; ix < segX; ix++) {
      var a = iy * nx + ix, b = (iy + 1) * nx + ix, c = b + 1, d = a + 1;
      idx[q++] = a; idx[q++] = b; idx[q++] = d; idx[q++] = b; idx[q++] = c; idx[q++] = d;
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(nor, 3));
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    g.setIndex(new T.BufferAttribute(idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }

  // Poziom szczegółu: wysokości wyświetlane (km, z wtopieniem brzegu i dnem pod taflą), normalne + nawietrzność (RGBA8),
  // wysokość i odległość od brzegu (RG32F, dla oceanu i chmur), opcjonalnie indeksy jednostek.
  // obniz = { prost: [prostokąty drobniejszych poziomów], km }: wierzchołki wewnątrz opuszczone o km (po policzeniu
  // normalnych) — w zakładce szwu drobniejszy poziom leży wtedy wyżej i wygrywa test głębi bez polygonOffset.
  function zbudujPoziom(s, krok, wtop, nawietrz, obniz) {
    var r = prostokat(s), w = s.w, h = s.h, dx = (r.x1 - r.x0) / (w - 1), dz = (r.z1 - r.z0) / (h - 1);
    var full = new Float32Array(w * h), i, x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      var v = s.wys[i] / 1000;
      if (!(v > 0)) v = Math.min(v, -MORZE_POD_KM);
      if (wtop) {
        var px = r.x0 + x * dx, pz = r.z0 + y * dz, e = Math.min(px - r.x0, r.x1 - px, pz - r.z0, r.z1 - pz);
        if (e < wtop.km) { var c = wtop.fn(px, pz); if (c != null) v = c + (v - c) * gladko(e / wtop.km); }
      }
      full[i] = v;
    }
    // normalne w przestrzeni obiektu (bez przewyższenia) z pełnej siatki; A = nawietrzność
    var naw = nawietrz || null, bajty = new Uint8Array(w * h * 4);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      var xa = Math.max(0, x - 1), xb = Math.min(w - 1, x + 1), ya = Math.max(0, y - 1), yb = Math.min(h - 1, y + 1);
      var gx = (full[y * w + xb] - full[y * w + xa]) / ((xb - xa) * dx), gz = (full[yb * w + x] - full[ya * w + x]) / ((yb - ya) * dz);
      var l = Math.sqrt(gx * gx + 1 + gz * gz);
      bajty[i * 4] = Math.round((-gx / l * 0.5 + 0.5) * 255); bajty[i * 4 + 1] = Math.round((1 / l * 0.5 + 0.5) * 255);
      bajty[i * 4 + 2] = Math.round((-gz / l * 0.5 + 0.5) * 255);
      bajty[i * 4 + 3] = Math.round(((naw ? naw[i] : 0) * 0.5 + 0.5) * 255);
    }
    var segX = Math.max(1, Math.round((w - 1) / krok)), segY = Math.max(1, Math.round((h - 1) / krok));
    var nx = segX + 1, nz = segY + 1, hs;
    if (krok === 1) hs = full;
    else {
      hs = new Float32Array(nx * nz);
      for (var iy = 0; iy < nz; iy++) for (var ix = 0; ix < nx; ix++) {
        var fx = ix / segX * (w - 1), fy = iy / segY * (h - 1), x0 = Math.min(Math.floor(fx), w - 2), y0 = Math.min(Math.floor(fy), h - 2), tx = fx - x0, ty = fy - y0;
        hs[iy * nx + ix] = (full[y0 * w + x0] * (1 - tx) + full[y0 * w + x0 + 1] * tx) * (1 - ty) + (full[(y0 + 1) * w + x0] * (1 - tx) + full[(y0 + 1) * w + x0 + 1] * tx) * ty;
      }
    }
    var hsPrzed = hs;
    if (obniz && obniz.prost.length) {
      hsPrzed = new Float32Array(hs);                 // powierzchnia przed obniżeniem — cel wtapiania drobniejszego poziomu
      for (var jy = 0; jy < nz; jy++) for (var jx = 0; jx < nx; jx++) {
        var vx = r.x0 + jx * (r.x1 - r.x0) / segX, vz = r.z0 + jy * (r.z1 - r.z0) / segY;
        for (var q = 0; q < obniz.prost.length; q++) {
          var o = obniz.prost[q];
          if (vx > o.x0 && vx < o.x1 && vz > o.z0 && vz < o.z1) { hs[jy * nx + jx] -= obniz.km; break; }
        }
      }
    }
    return { s: s, w: w, h: h, x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, prost: r, dx: dx, dz: dz, nx: nx, nz: nz,
      dxv: (r.x1 - r.x0) / segX, dzv: (r.z1 - r.z0) / segY, hs: hs, hsPrzed: hsPrzed, normalne: bajty };
  }

  // Tekstura z bajtów poziomu w układzie wiersz 0 = północ; uv siatki (v = 1 na północy) odwracane transformacją tekstury
  // z korektą pół teksela (węzły siatki leżą na brzegach bbox, środki tekseli — pół teksela do środka).
  function teksturaPoziomu(T, dane, P, format, typ, liniowa) {
    var t = new T.DataTexture(dane, P.w, P.h, format, typ);
    t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
    t.magFilter = liniowa ? T.LinearFilter : T.NearestFilter;
    t.minFilter = liniowa === 'mip' ? T.LinearMipmapLinearFilter : liniowa ? T.LinearFilter : T.NearestFilter;
    t.generateMipmaps = liniowa === 'mip';
    t.repeat.set((P.w - 1) / P.w, -(P.h - 1) / P.h);
    t.offset.set(0.5 / P.w, (P.h - 0.5) / P.h);
    t.unpackAlignment = 1;
    t.needsUpdate = true;
    return t;
  }

  /* ---------- shadery ---------- */
  var GLSL_WSPOLNE = [
    'vec3 geS2L(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }',
    'vec3 geHex(float r, float g, float b) { return geS2L(vec3(r, g, b) / 255.0); }',
    'float geHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float geSzum(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(geHash(i), geHash(i + vec2(1.0, 0.0)), f.x), mix(geHash(i + vec2(0.0, 1.0)), geHash(i + vec2(1.0, 1.0)), f.x), f.y); }',
    'float geFbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * geSzum(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }',
  ].join('\n');

  // Czas geologiczny na GPU — ten sam rachunek co Ewolucja.wysokoscKomorki (geologia/ewolucja.js; zmiana tu = zmiana tam).
  // uEwoO[k] = (od — odMa albo początek fazy podwodnej z Ewolucja.parametry(), doMa, zapadniecie.Ma | −1, wypelnienie_m), uEwoP[k] = (podłoże k+1 | 0, podloze.wys_m, R_km, ma centrum),
  // uEwoC[k] = centrum w układzie lokalnym [km]. Podłoże rozwinięte o jeden poziom (test danych pilnuje, że więcej nie ma).
  var MAX_JEDN_GPU = 16;
  var GLSL_EWOLUCJA = [
    'uniform float uEwoMa; uniform float uEwoDno; uniform vec4 uEwoO[' + MAX_JEDN_GPU + ']; uniform vec4 uEwoP[' + MAX_JEDN_GPU + ']; uniform vec2 uEwoC[' + MAX_JEDN_GPU + '];',
    'float geEwoPostep(int k, float t, vec2 xz) {',
    '  vec4 o = uEwoO[k]; vec4 p = uEwoP[k];',
    '  float q = clamp((o.x - t) / max(o.x - o.y, 1e-6), 0.0, 1.0);',
    '  if (p.w > 0.5) q = clamp((q - OPOZ_EWO * clamp(length(xz - uEwoC[k]) / max(p.z, 1e-3), 0.0, 1.0)) / (1.0 - OPOZ_EWO), 0.0, 1.0);',
    '  return q * q * (3.0 - 2.0 * q);',
    '}',
    'float geEwoWzrost(int k, float h, vec2 xz, out float podst) {',
    '  vec4 o = uEwoO[k]; vec4 p = uEwoP[k];',
    '  float X = h + ((o.z >= 0.0 && uEwoMa > o.z) ? o.w * clamp(1.0 + h / WYP_ZANIK, 0.0, 1.0) : 0.0);',
    '  float b = min(uEwoDno, X);',
    '  podst = -1e9;',
    '  if (p.x > 0.5) { int j = int(p.x + 0.5) - 1; float Y = min(X, p.y); float bj = min(uEwoDno, Y); b = bj + geEwoPostep(j, uEwoMa, xz) * (Y - bj); podst = b; }',
    '  return b + geEwoPostep(k, uEwoMa, xz) * (X - b);',
    '}',
    // lab = (jednostka, druga jednostka — stok albo pas granicy na lądzie, waga pierwszej 0…1, oddalenie stoku od brzegu 0…1)
    // — tekstura przynależności RGBA8
    'float geEwo(float h, vec4 lab, vec2 xz) {',
    '  if (lab.x < 0.5 || uEwoMa <= 0.0) return h;',
    '  float pd, pd2;',
    // bajt brzegu stoku: 0…128 oddalenie od brzegu (tB), 128…255 zanik stoku 30–40 km od lądu (dal)
    '  float b = lab.w * 255.0, tB = min(1.0, b / 128.0), dal = 1.0 - max(0.0, b - 128.0) / 127.0;',
    '  float e1 = geEwoWzrost(int(lab.x + 0.5) - 1, h, xz, pd), e = e1;',
    '  if (lab.y > 0.5 && lab.z < 0.999) {',
    '    e = mix(geEwoWzrost(int(lab.y + 0.5) - 1, h, xz, pd2), e1, lab.z);',
    // jednostka z podłożem (pd > −1e8): sąsiad nie podnosi ponad własny wzrost (duch Teide), próg min(podłoże, ±12 m)
    '    if (pd > -1e8) { e = min(e, e1); e += (1.0 - tB) * max(0.0, min(pd, h > 0.0 ? MORZE_POD : -MORZE_POD) - e); }',
    '  }',
    '  float r = h + clamp((h - uEwoDno) / STOK_EWO, 0.0, 1.0) * dal * (e - h);',   // ląd: (h − dno)/1000 > 1 → waga 1
    '  return r <= 0.0 ? min(r, -MORZE_POD) : r;',                          // nic w (−12 m; 0] — z-fighting z taflą
    '}',
    'vec4 geEwoLab(vec4 t) { return vec4(floor(t.r * 255.0 + 0.5), floor(t.g * 255.0 + 0.5), t.b, t.a); }'
  ].join('\n').replace(/OPOZ_EWO/g, (Ew ? Ew.OPOZNIENIE : 0.5).toFixed(4)).replace(/STOK_EWO/g, (Ew ? Ew.STOK_M : 1000).toFixed(1))
    .replace(/WYP_ZANIK/g, (Ew ? Ew.WYP_ZANIK_M : 500).toFixed(1)).replace(/MORZE_POD/g, (Ew ? Ew.MORZE_POD_M : 12).toFixed(1));
  // Wierzchołek terenu w chwili uEwoMa (wstawiany po begin_vertex): wysokość, współczynnik nachylenia dla mapy normalnych
  // (dzisiejsze normalne z gradientem × dH/dh — dno chwili jest płaskie) i „żar” komórki w trakcie wzrostu (A1).
  // Krawędź kafla wyspy (8 km) wraca do dzisiejszej wysokości — styk z archipelagiem bez uskoku.
  var GLSL_EWO_WIERZCHOLEK = [
    'vEwoK = 1.0; vEwoZar = 0.0;',
    'if (uEwoAkt > 0.5 && uEwoMa > 0.0) {',
    '  vec4 geLab = geEwoLab(texture2D(uPrzyn, uv * uEwoUv.xy + uEwoUv.zw));',
    '  if (geLab.x > 0.5) {',
    '    float geH0 = position.y * 1000.0;',
    '    vec4 geR = uEwoBrzeg;',
    '    float geF = smoothstep(0.0, ' + WTOP_WYSPA_KM.toFixed(1) + ', min(min(position.x - geR.x, geR.z - position.x), min(position.z - geR.y, geR.w - position.z)));',
    '    float geH = geH0 + geF * (geEwo(geH0, geLab, position.xz) - geH0);',
    '    float geH2 = geH0 + 25.0 + geF * (geEwo(geH0 + 25.0, geLab, position.xz) - geH0 - 25.0);',
    '    transformed.y = geH / 1000.0;',
    '    vEwoK = clamp((geH2 - geH) / 25.0, 0.0, 1.5);',
    '    float geS = geEwoPostep(int(geLab.x + 0.5) - 1, uEwoMa, position.xz);',
    '    vEwoZar = 4.0 * geS * (1.0 - geS) * geF;',
    '  }',
    '}'
  ].join('\n');
  var GLSL_EWO_PARS_VERT = 'uniform sampler2D uPrzyn; uniform float uEwoAkt; uniform vec4 uEwoUv; uniform vec4 uEwoBrzeg;\n';

  // Pokrycie morza chmur A4 (spec R4): wspólne dla warstw chmur (geologia/animacje.js) i cienia chmur na terenie.
  // Pasat z NE — chmury płyną na SW; wyższa warstwa płynie szybciej (paralaksa); gęściej po nawietrznej (N) stronie.
  var GLSL_CHMURY_A4 = [
    'float geChmuryA4(vec2 xz, float czas, float warstwa) {',
    '  vec2 p = xz - czas * vec2(-0.05, 0.05) * (1.0 + 0.45 * warstwa) + warstwa * vec2(17.3, -9.1);',
    '  float d = geFbm(p * 0.085) * 0.72 + geFbm(p * 0.33) * 0.28;',
    '  float maska = 0.25 + 0.75 * smoothstep(-6.0, 26.0, -xz.y + 0.35 * xz.x);',
    '  return smoothstep(0.40, 0.60, d * (0.62 + 0.55 * maska) + 0.04 * (1.0 - warstwa));',
    '}'
  ].join('\n');

  var GLSL_TEREN_PARS = [
    'uniform float uTryb;', 'uniform float uNasycMaks;', 'uniform float uPrzew;', 'uniform float uSzklo;', 'uniform float uMaIndeksy;', 'uniform float uMloda;',
    'uniform sampler2D uIndeksy;', 'uniform sampler2D uPaleta;', 'uniform vec4 uWyc[3];', 'uniform float uLWyc;', 'uniform vec3 uKolorWody;',
    'varying float vWys;', 'varying vec3 vSwiat;', 'varying float vEwoK;', 'varying float vEwoZar;',
    // efekty animacji: łuna lawy (odległość od toru), żar rosnących komórek (A1), cień chmur A4 na świetle klucza
    'uniform vec2 uLunaP[24]; uniform float uLunaN; uniform vec3 uLunaKolor; uniform float uLunaZasieg; uniform float uZar;',
    'uniform float uCienChmur; uniform float uStropA4; uniform float uCzasA4; uniform vec3 uSlonceKier;',
    // materiał makiety (Task B1): 0 zwykły (pokaz zawsze), 1 sklejka; grubość arkusza [m n.p.m.] z GeologiaSklejka.krok(przew)
    'uniform float uMaterial; uniform float uKrokSklejki;',
    // stuknięcie w skałę (Task B3): uStuk = (x, z [km sceny], t0 [s], aktywny), uCzasStuk = czas animuj(t)
    'uniform vec4 uStuk; uniform float uCzasStuk;',
    // kurz kalimy (Task C1): uKurzGrubosc = grubość globalna (0 = gałąź pominięta), uKurz = maska grubości w UV wyspy (R),
    // uProstKurz = prostokąt wyspy (x0, z0, x1, z1) [km sceny]
    'uniform float uKurzGrubosc; uniform sampler2D uKurz; uniform vec4 uProstKurz;',
    // cienie z mapy horyzontu (Task A3): geSlHor = 1 − zasłonięcie Słońca, mnoży światło klucza (LUZ_SWIATLA)
    Hor.GLSL_SLONCE, Hor.GLSL_MAPA,
    'float geCien = 1.0; float geSlHor = 1.0;',
    GLSL_WSPOLNE,
    GLSL_CHMURY_A4,
    // hipsometria atlasowa (makieta „Teren”): dno w błękitach, ląd zieleń → beż → brąz → szarość → biel
    'vec3 geHipsometria(float h) {',
    '  vec3 c;',
    '  if (h < 0.0) {',
    '    c = mix(geHex(28.0, 55.0, 84.0), geHex(42.0, 86.0, 122.0), smoothstep(-3500.0, -1500.0, h));',
    '    c = mix(c, geHex(78.0, 128.0, 160.0), smoothstep(-1500.0, -200.0, h));',
    '    c = mix(c, geHex(120.0, 168.0, 184.0), smoothstep(-200.0, -10.0, h));',
    '  } else {',
    '    c = mix(geHex(86.0, 124.0, 70.0), geHex(122.0, 148.0, 86.0), smoothstep(0.0, 300.0, h));',
    '    c = mix(c, geHex(166.0, 158.0, 106.0), smoothstep(300.0, 800.0, h));',
    '    c = mix(c, geHex(154.0, 120.0, 82.0), smoothstep(800.0, 1500.0, h));',
    '    c = mix(c, geHex(132.0, 100.0, 76.0), smoothstep(1500.0, 2200.0, h));',
    '    c = mix(c, geHex(124.0, 110.0, 100.0), smoothstep(2200.0, 3000.0, h));',
    '    c = mix(c, geHex(214.0, 208.0, 200.0), smoothstep(3000.0, 3650.0, h));',
    '  }',
    '  return c;',
    '}',
    // model krajobrazu (spec R4): nawietrzny skłon NE wilgotny i zielony pod warstwą chmur, pas sosen, nad inwersją ochry
    // i czernie młodych law, południe i zachód poniżej 600 m płowe; strome ściany = skała
    'vec3 geKrajobraz(float h, float naw, vec3 n, float jedn) {',
    '  float wilg = smoothstep(-0.25, 0.45, naw);',
    '  float stromo = 1.0 - n.y;',
    '  float plam = geFbm(vSwiat.xz * 0.9) - 0.5;',
    '  vec3 niz = mix(geHex(170.0, 146.0, 104.0), geHex(84.0, 112.0, 56.0), wilg);',
    '  vec3 las = mix(geHex(132.0, 118.0, 86.0), geHex(48.0, 78.0, 40.0), wilg);',
    '  vec3 sosny = mix(geHex(80.0, 88.0, 56.0), geHex(58.0, 76.0, 46.0), wilg);',
    '  vec3 gora = geHex(156.0, 124.0, 88.0);',
    '  vec3 c = niz;',
    '  c = mix(c, las, smoothstep(350.0, 800.0, h + plam * 200.0));',
    '  c = mix(c, sosny, smoothstep(1100.0, 1500.0, h + plam * 200.0));',
    '  c = mix(c, gora, smoothstep(1900.0, 2200.0, h + plam * 150.0));',
    '  float mloda = (uMloda > 0.5 && abs(jedn - uMloda) < 0.5) ? 1.0 : 0.0;',
    '  c = mix(c, geHex(56.0, 50.0, 48.0), smoothstep(2000.0, 2300.0, h) * mloda * (0.75 + 0.5 * plam));',
    '  c = mix(c, geHex(190.0, 178.0, 156.0), smoothstep(3350.0, 3650.0, h));',
    '  c = mix(c, geHex(96.0, 84.0, 74.0), smoothstep(0.30, 0.55, stromo));',
    '  c = mix(geHex(66.0, 60.0, 56.0), c, smoothstep(0.0, 25.0, h));',
    '  if (h < 0.0) c = mix(geHex(104.0, 98.0, 88.0), geHex(58.0, 64.0, 70.0), smoothstep(50.0, 900.0, -h));',
    '  return c;',
    '}'
  ].join('\n');

  // Sklejka (Task B1): wszystkie pochodne ekranowe na samym początku main(), pod warunkiem jednolitym (uniform) — przed
  // discard płaszczyzn cięcia (clipping_planes_fragment), discard wycięć wstawek i gałęzią lądu (geH > 0): w przepływie
  // zależnym od danych pochodne GLSL są nieokreślone (piksele brzegu, krawędzie cięcia). GLSL_TEREN_KOLOR tylko ich używa.
  // Słoje: faza wzdłuż vSwiat.xz, kierunek obrócony o 90° w co drugim arkuszu (jak forniry), zaburzona szumem.
  var GLSL_SKLEJKA_POCHODNE = [
    'float geSkWs = 0.0, geSkFw = 1.0, geSkFaza = 0.0, geSkFwF = 1e3, geSkHx = 0.0, geSkHy = 0.0, geSkNr = 0.0, geSkParz = 0.0;',
    'vec2 geSkDx = vec2(0.0), geSkDy = vec2(0.0);',
    'if (uMaterial > 0.5) {',
    '  geSkWs = vWys * 1000.0 / uKrokSklejki;',
    '  geSkNr = floor(geSkWs); geSkParz = mod(geSkNr, 2.0);',
    '  vec2 geKs = geSkParz < 0.5 ? vec2(0.94, 0.34) : vec2(-0.34, 0.94);',
    '  geSkFaza = dot(vSwiat.xz, geKs) * 60.0 + geSzum(vec2(dot(vSwiat.xz, geKs) * 1.5, dot(vSwiat.xz, vec2(-geKs.y, geKs.x)) * 9.0) + geSkNr * 7.3) * 5.0;',
    '  geSkFw = max(fwidth(geSkWs), 1e-5);',
    '  geSkFwF = fwidth(geSkFaza);',
    '  geSkDx = dFdx(vSwiat.xz); geSkDy = dFdy(vSwiat.xz);',
    '  geSkHx = dFdx(geSkWs); geSkHy = dFdy(geSkWs);',
    '}'
  ].join('\n');

  var GLSL_TEREN_KOLOR = [
    'for (int i = 0; i < 3; i++) {',
    '  if (float(i) < uLWyc) { vec4 r = uWyc[i]; if (vSwiat.x > r.x && vSwiat.x < r.z && vSwiat.z > r.y && vSwiat.z < r.w) discard; }',
    '}',
    'vec4 geN = texture2D(normalMap, vUv);',
    'vec3 geNo = geN.xyz * 2.0 - 1.0;',
    'geNo.xz *= vEwoK;',
    'vec3 geNw = normalize(vec3(geNo.x, geNo.y / max(uPrzew, 0.01), geNo.z));',
    // cień chmur słabnie w ostatnich 150 m pod stropem (bez poziomej kreski cienia na zboczu)
    'if (uCienChmur > 0.001) {',
    '  float geNiz = 1.0 - smoothstep(uStropA4 - 0.15 * uPrzew, uStropA4, vSwiat.y);',
    '  vec2 geP = vSwiat.xz + uSlonceKier.xz / max(uSlonceKier.y, 0.08) * max(uStropA4 - vSwiat.y, 0.0);',
    '  geCien = 1.0 - uCienChmur * geNiz * geChmuryA4(geP, uCzasA4, 0.0);',
    '}',
    'geSlHor = 1.0 - geZaslonHor(vSwiat.xz);',
    'float geH = vWys * 1000.0;',
    'float geJ = uMaIndeksy > 0.5 ? floor(texture2D(uIndeksy, vUv).r * 255.0 + 0.5) : 0.0;',
    'vec3 geKol;',
    'if (uTryb < 0.5) geKol = geHipsometria(geH);',
    'else if (uTryb < 1.5) {',
    '  if (geH < 0.0) geKol = mix(geHex(38.0, 54.0, 70.0), geHex(66.0, 86.0, 102.0), smoothstep(-3000.0, -100.0, geH));',
    // alfa palety = odsłonięcie jednostki (pokaz: mapa wlewana według wieku); makieta ma zawsze 255
    // nasycenie barwy jednostki ≤ uNasycMaks (HSV, sRGB): pokaz 0,6 — czysta czerwień stożka Teide gasiła cieniowanie rzeźby
    // (recenzja kinowa r1, I5); makieta 1 (bez zmiany), barwy jak w legendzie z `j.kolor` (recenzja kodu r1)
    '  else if (geJ > 0.5) { vec4 geP = texture2D(uPaleta, vec2((geJ + 0.5) / 256.0, 0.5)); vec3 geC = geP.rgb;',
    '    float geMx = max(geC.r, max(geC.g, geC.b)), geS = geMx > 1e-4 ? (geMx - min(geC.r, min(geC.g, geC.b))) / geMx : 0.0;',
    '    if (geS > uNasycMaks) geC = geMx - (geMx - geC) * (uNasycMaks / geS);',
    '    geKol = mix(geHex(146.0, 142.0, 132.0), geS2L(geC), geP.a); }',
    '  else geKol = geHex(146.0, 142.0, 132.0);',
    '} else if (uTryb < 2.5) geKol = geKrajobraz(geH, geN.a * 2.0 - 1.0, geNw, geJ);',
    'else geKol = vec3(0.2);',                                     // „kalibracja”: jednolite albedo 0,2 do pomiaru światła
    // Sklejka (Task B1; geologia/sklejka.js): ląd wycięty z arkuszy o grubości uKrokSklejki m — nr = floor(geH / krok),
    // geH = wysokość rysowanej powierzchni (vWys — przy czasie geologicznym rzeźba CHWILI z wierzchołka, nie dzisiejsza).
    // Pochodne policzone na początku (geSk*); tu tylko ich użycie. Z daleka (arkusz węższy niż ok. 3 px) krawędzie,
    // cień schodka, naprzemienne arkusze i słoje gasną do średniej — bez migotania i mory.
    'if (uMaterial > 0.5 && geH > 0.0 && uTryb < 2.5) {',
    '  float geFr = geSkWs - geSkNr;',
    '  float geBlisko = 1.0 - smoothstep(0.2, 0.45, geSkFw);',
    // arkusze naprzemiennie jasne i ciemne (#e2c496 / #cdaa78)
    '  vec3 geDrewno = mix(geHex(226.0, 196.0, 150.0), geHex(205.0, 170.0, 120.0), mix(0.5, geSkParz, geBlisko));',
    '  float geSloj = (0.5 + 0.5 * sin(geSkFaza)) * (1.0 - smoothstep(0.8, 2.0, geSkFwF)) * geBlisko;',
    // barwy z grupy „Barwy”: jednostki — farba na sklejce (× 0,85, słoje prześwitują); hipsometria — bejca na drewnie
    '  vec3 geB = uTryb > 0.5 && uTryb < 1.5 ? (geJ > 0.5 ? geKol * 0.85 : geDrewno) : mix(geDrewno, geKol, 0.35);',
    '  geB *= 1.0 - 0.12 * geSloj;',
    // przypalona krawędź (cięcie laserem): początek arkusza, frakcja < 1,5 px; ×0,55
    '  float geKraw = (1.0 - smoothstep(0.0, geSkFw * 1.5, geFr)) * geBlisko;',
    // cień schodka: arkusz wyżej leży w stronę Słońca bliżej niż 1,5 px — gradient wysokości rysowanej powierzchni
    // z pochodnych ekranowych (rozwiązanie 2 × 2: dh = g · dxz), cos kąta między stokiem w górę a azymutem Słońca; ×0,8
    '  float geDet = geSkDx.x * geSkDy.y - geSkDx.y * geSkDy.x;',
    '  vec2 geG = vec2(geSkHx * geSkDy.y - geSkHy * geSkDx.y, geSkDx.x * geSkHy - geSkDy.x * geSkHx) * sign(geDet);',
    '  float geCos = dot(geG, uSlonceKier.xz) / max(length(geG) * length(uSlonceKier.xz), 1e-6);',
    '  float geSch = (1.0 - smoothstep(0.0, max(geSkFw * 1.5 * geCos, 1e-5), 1.0 - geFr)) * step(0.05, geCos) * geBlisko * smoothstep(-0.02, 0.08, uSlonceKier.y);',
    '  geKol = geB * mix(1.0, 0.55, geKraw) * mix(1.0, 0.8, geSch);',
    '}',
    // Kurz kalimy (Task C1, schemat): rdzawy pył #b0733e na lądzie, mieszany uKurzGrubosc × maska (tekstura uKurz w UV
    // prostokąta wyspy — starte miejsca mają grubość < 1 i odsłaniają barwy), lekko nierówny (szum 0,9–1,1). Bez mipmap:
    // odczyt w gałęzi zależnej od danych (geH > 0) nie potrzebuje pochodnych. uKurzGrubosc = 0 (pokaz zawsze, makieta bez
    // kalimy, czas geologiczny, animacje): gałąź pominięta, obraz bit w bit jak przed C1.
    'if (uKurzGrubosc > 0.0 && geH > 0.0) {',
    '  vec2 geKuv = (vSwiat.xz - uProstKurz.xy) / (uProstKurz.zw - uProstKurz.xy);',
    '  if (geKuv.x > 0.0 && geKuv.x < 1.0 && geKuv.y > 0.0 && geKuv.y < 1.0) {',
    '    float geKm = texture2D(uKurz, geKuv).r;',
    '    geKol = mix(geKol, geHex(176.0, 115.0, 62.0) * (0.9 + 0.2 * geSzum(vSwiat.xz * 3.1)), clamp(uKurzGrubosc * geKm, 0.0, 1.0));',
    '  }',
    '}',
    // Stuknięcie w skałę (Task B3): jasny pierścień w płaszczyźnie xz rośnie od punktu kliknięcia 0 → 3 km w 1,2 s i gaśnie
    // (szerokość 40 → 160 m). Leży na powierzchni, która jest rysowana — przy czasie geologicznym na rzeźbie chwili.
    // uStuk.w = 0 (pokaz zawsze, makieta poza 1,2 s po kliknięciu): gałąź pominięta, obraz bit w bit jak przed B3.
    'if (uStuk.w > 0.5) {',
    '  float geSf = clamp((uCzasStuk - uStuk.z) / 1.2, 0.0, 1.0);',
    '  float geSd = abs(length(vSwiat.xz - uStuk.xy) - 3.0 * geSf);',
    '  float geSa = (1.0 - smoothstep(0.0, 0.04 + 0.12 * geSf, geSd)) * (1.0 - geSf) * smoothstep(0.0, 0.03, geSf);',
    '  geKol = mix(geKol, vec3(1.0, 0.92, 0.78), 0.7 * geSa);',
    '}',
    'diffuseColor.rgb *= geKol;'
  ].join('\n');

  // Łuna lawy (spec R4: w shaderze terenu z odległości od toru, bez bloomu) i żar komórek w trakcie wzrostu (A1) — światło
  // dodane po oświetleniu, przed mapowaniem tonów; łuna = albedo × barwa łuny × zanik z odległości od płonącej części toru.
  var GLSL_TEREN_EMISJA = [
    'if (uLunaN > 1.5) {',
    '  float geD = 1e3;',
    '  for (int i = 0; i < 23; i++) {',
    '    if (float(i) + 1.5 < uLunaN) {',
    '      vec2 geA = uLunaP[i], geAB = uLunaP[i + 1] - uLunaP[i];',
    '      float geT = clamp(dot(vSwiat.xz - geA, geAB) / max(dot(geAB, geAB), 1e-9), 0.0, 1.0);',
    '      geD = min(geD, length(vSwiat.xz - geA - geAB * geT));',
    '    }',
    '  }',
    '  gl_FragColor.rgb += diffuseColor.rgb * uLunaKolor * (exp(-geD / uLunaZasieg) + 0.3 * exp(-geD / (4.0 * uLunaZasieg)));',
    '}',
    'if (uZar > 0.001 && vEwoZar > 0.001) {',
    '  float geZ = geFbm(vSwiat.xz * 1.7);',
    '  gl_FragColor.rgb += vec3(1.0, 0.3, 0.05) * uZar * vEwoZar * (0.12 + 1.5 * smoothstep(0.5, 0.72, geZ));',
    '}'
  ].join('\n');

  // Mgła wodna pod taflą w stanie „szklana” (decyzja P7, recenzja kinowa r1): rośnie z GŁĘBOKOŚCIĄ punktu (skala 3 km —
  // stok przy tafli czysty, dno abysalu w błękicie) i słabo z drogą promienia pod wodą (120 km); wcześniej sama droga (25 km)
  // zamieniała stok widziany z 80–100 km w jednolity ciemny prostokąt.
  var GLSL_TEREN_WODA = [
    'if (uSzklo > 0.001 && vSwiat.y < 0.0) {',
    '  float geDl = length(vSwiat - cameraPosition);',
    '  float gePod = geDl * clamp(-vSwiat.y / max(max(cameraPosition.y, 0.0) - vSwiat.y, 1e-3), 0.0, 1.0);',
    '  float geGl = -vSwiat.y / max(uPrzew, 1e-3);',
    '  gl_FragColor.rgb = mix(gl_FragColor.rgb, uKolorWody, (1.0 - exp(-geGl / 3.0 - gePod / 120.0)) * uSzklo);',
    '}'
  ].join('\n');

  // Mgiełka powietrza (pokaz, spec R4 „niebo: jasna mgiełka”): światło rozproszone na drodze kamera → punkt, w sRGB jak
  // mgła r128. Dwie warstwy o wysokości skali H: Rayleigh (8,5 km, barwa zenitu) i aerozol pod inwersją pasatu (1,2 km,
  // barwa horyzontu); ilość powietrza na drodze = kolumna równoważna przy poziomie morza (atmosfera warstwowa płaska),
  // udział = 1 − e^(−kolumna / L). Z orbity rozjaśnia ocean, przy ziemi daje głębię planów. Makieta: uMgielka = 0.
  var GLSL_MGIELKA = [
    'uniform float uMgielka; uniform vec2 uMgielkaL; uniform vec3 uMgielkaKol; uniform vec3 uMgielkaKolR; uniform float uMgPrzew; uniform float uMgKamH;',
    // wysokość kamery rzeczywista z uniformu (y kamery pokazu ma przewyższenie tanh — Rozdzialy.doSceny — nie e·h)
    'float geKolumna(vec3 c, vec3 p, float H) {',
    '  float yc = max(uMgKamH, 0.0), yp = max(p.y / uMgPrzew, 0.0), L = length(c - p), d = yc - yp;',
    '  if (abs(d) < 0.01) return L * exp(-0.5 * (yc + yp) / H);',
    '  return L * H * abs(exp(-yp / H) - exp(-yc / H)) / abs(d);',
    '}',
    'vec3 geMgielka(vec3 k, vec3 c, vec3 p) {',
    '  if (uMgielka < 0.001) return k;',
    '  return mix(k, mix(uMgielkaKol, uMgielkaKolR, 0.4), uMgielka * (1.0 - exp(-geKolumna(c, p, 8.5) / uMgielkaL.x)));',
    '}'
  ].join('\n');
  // mgiełka PRZED mgłą sceny: na brzegu dysku oceanu mgła daje dokładnie barwę horyzontu nieba (bez szwu na horyzoncie)
  var MGIELKA_KONIEC = 'gl_FragColor.rgb = geMgielka(gl_FragColor.rgb, cameraPosition, vSwiat);\n\t#include <fog_fragment>';

  var FOG_RADIALNA = '#ifdef USE_FOG\n\tfogDepth = length(mvPosition.xyz);\n#endif';

  var WODA_VERT = [
    '#include <common>', '#include <fog_pars_vertex>', '#include <clipping_planes_pars_vertex>',
    'varying vec3 vSwiat;',
    'void main() {',
    '  vec4 swiat = modelMatrix * vec4(position, 1.0);',
    '  vSwiat = swiat.xyz;',
    '  vec4 mvPosition = viewMatrix * swiat;',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  #include <clipping_planes_vertex>',
    '  #ifdef USE_FOG', '  fogDepth = length(mvPosition.xyz);', '  #endif',
    '}'
  ].join('\n');

  var WODA_FRAG = [
    '#include <common>', '#include <fog_pars_fragment>', '#include <clipping_planes_pars_fragment>',
    'uniform sampler2D uWysW; uniform sampler2D uWysA; uniform sampler2D uFale;',
    'uniform vec4 uProstW; uniform vec4 uProstA; uniform vec2 uRozmW; uniform vec2 uRozmA;',
    'uniform float uCzas; uniform float uSzklo; uniform float uTylkoKafel;',
    'uniform vec3 uSlonce; uniform vec3 uKolorSlonca; uniform vec3 uAmb; uniform vec3 uZenitL; uniform vec3 uHoryzontL;',
    'uniform sampler2D uPrzynW; uniform float uEwoWoda;',
    'uniform sampler2D uZiemia; uniform float uDaleko; uniform vec2 uSrodekLL; uniform vec2 uKmStopien; uniform float uWodaJasn;',
    // fale znające brzeg (A1): pole RGBA8 (kierunek grzbietu, ekspozycja, stromość), kierunek martwej fali, włącznik
    // (makieta 1, pokaz 0) i grzbiety przy brzegu (1, gdy odległość od brzegu ma filtr liniowy — inaczej schodki 105 m)
    'uniform sampler2D uPoleW; uniform sampler2D uPoleA; uniform vec2 uKierFali; uniform float uFaleWl; uniform float uFaleGrzbiety;',
    'varying vec3 vSwiat;',
    GLSL_WSPOLNE,
    GLSL_MGIELKA,
    GLSL_EWOLUCJA,
    Hor.GLSL_SLONCE, Hor.GLSL_STOZEK,
    'vec2 geUv(vec2 xz, vec4 r, vec2 n) { vec2 f = (xz - r.xy) / (r.zw - r.xy); return (f * (n - 1.0) + 0.5) / n; }',
    'bool geW(vec2 xz, vec4 r) { return xz.x >= r.x && xz.x <= r.z && xz.y >= r.y && xz.y <= r.w; }',
    'void main() {',
    '  #include <clipping_planes_fragment>',
    '  vec2 xz = vSwiat.xz;',
    '  if (uTylkoKafel > 0.5 && !geW(xz, uProstW)) discard;',
    '  float h = -4000.0, dist = 60.0, gePoz = 0.0;',
    // pole fal opisuje DZISIEJSZY brzeg (i cień falowy dzisiejszej wyspy, sięgający poza kafel) — w chwili geologicznej
    // gaśnie na całym morzu: zostaje martwa fala bez cienia i dotychczasowy pas piany z brzegu chwili
    '  float geDzis = 1.0 - step(0.5, uEwoWoda) * smoothstep(0.0, 0.02, uEwoMa);',
    '  vec4 pf = vec4(uKierFali * 0.5 + 0.5, 1.0, 0.0);',                 // poza danymi: otwarte morze, pełna ekspozycja
    '  if (geW(xz, uProstW)) {',
    '    vec2 uvW = geUv(xz, uProstW, uRozmW);',
    '    vec2 t = texture2D(uWysW, uvW).rg; h = t.r; dist = t.g;',
    '    pf = texture2D(uPoleW, uvW); gePoz = 1.0;',
    // dno chwili geologicznej: głębokość i brzeg (piana) z rzeźby chwili, nie z dzisiejszej
    '    if (uEwoWoda > 0.5 && uEwoMa > 0.0) {',
    '      vec4 lab = geEwoLab(texture2D(uPrzynW, geUv(xz, uProstW, uRozmW)));',
    '      vec4 r = uProstW; float fb = smoothstep(0.0, ' + WTOP_WYSPA_KM.toFixed(1) + ', min(min(xz.x - r.x, r.z - xz.x), min(xz.y - r.y, r.w - xz.y)));',
    '      float hE = h + fb * (geEwo(h, lab, xz) - h);',
    // odległość od brzegu chwili: nie mniejsza niż dzisiejsza (szelf daleko od brzegu nie robi się turkusowy)
    '      if (abs(hE - h) > 0.5) { h = hE; dist = max(dist, max(-h, 0.0) / 120.0); }',
    '    }',
    '  }',
    '  else if (geW(xz, uProstA)) { vec2 uvA = geUv(xz, uProstA, uRozmA); vec2 t = texture2D(uWysA, uvA).rg; h = t.r; dist = t.g; pf = texture2D(uPoleA, uvA); gePoz = 2.0; }',
    // półka 0 m ze szwu SRTM/ETOPO zasłonięta: głębokość efektywna rośnie co najmniej 120 m na km od brzegu
    '  float dEff = max(-h, 120.0 * dist);',
    '  vec3 woda = mix(geHex(38.0, 128.0, 128.0), geHex(18.0, 62.0, 96.0), smoothstep(4.0, 60.0, dEff));',
    '  woda = mix(woda, geHex(10.0, 30.0, 58.0), smoothstep(60.0, 1500.0, dEff)) * uWodaJasn;',
    '  vec3 n1 = texture2D(uFale, xz / 0.42 + uCzas * vec2(0.010, 0.006)).rgb * 2.0 - 1.0;',
    '  vec3 n2 = texture2D(uFale, xz / 1.30 - uCzas * vec2(0.004, -0.007)).rgb * 2.0 - 1.0;',
    // martwa fala (A1, schemat): daleko grzbiety prostopadłe do uKierFali (0,6 km), przy brzegu (odl < 3 km) grzbiety
    // równoległe do linii brzegu (faza −odl, 0,25 km), 0,02 km/s; dwa ciągi mieszane amplitudą — mieszanka faz dawałaby
    // fałszywą falę (φ_brzeg − φ_morze)·∇waga w pasie przejścia. Nachylenie × ekspozycja: po zawietrznej morze gładsze.
    '  float wB = (1.0 - smoothstep(0.5, 3.0, dist)) * geDzis * uFaleGrzbiety;',
    '  float eks = mix(1.0, pf.b, geDzis);',
    '  float fF = 6.2832 * (dot(xz, uKierFali) - 0.02 * uCzas) / 0.6;',
    '  float fN = 6.2832 * (-dist - 0.02 * uCzas) / 0.25;',
    '  vec2 kN = pf.rg * 2.0 - 1.0; kN /= max(length(kN), 1e-3);',
    // z daleka grzbiety gasną, zanim zejdą poniżej piksela (mora pod horyzontem): od ok. 25 do 70 długości fali
    '  float geOdlKam = length(cameraPosition - vSwiat);',
    '  float aF = 0.06 * (1.0 - wB) * (1.0 - smoothstep(15.0, 42.0, geOdlKam));',
    '  float aN = 0.14 * wB * (1.0 - smoothstep(6.0, 18.0, geOdlKam));',
    '  vec2 gFal = (uKierFali * (cos(fF) * aF) + kN * (cos(fN) * aN)) * (mix(0.15, 1.0, eks) * 2.6 * uFaleWl);',
    '  vec3 n = normalize(vec3(n1.x + n2.x - gFal.x, 2.6, n1.y + n2.y - gFal.y));',
    '  vec3 V = normalize(cameraPosition - vSwiat);',
    '  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);',
    '  vec3 R = reflect(-V, n);',
    '  vec3 niebo = mix(uHoryzontL, uZenitL, pow(clamp(R.y, 0.0, 1.0), 0.45));',
    '  float rs = max(dot(R, uSlonce), 0.0);',
    // cień Teide na morzu (A3, R13 — stożek z geologia/horyzont.js, tafla 0 m): gasi światło słoneczne tafli, połysk
    // i pianę; przy niskim Słońcu także poświatę (niżej, razem z odbiciem nieba)
    '  float geCienT = geCienStozka(xz, 0.0);',
    '  float geSlW = 1.0 - geCienT;',
    '  float blysk = (pow(rs, 900.0) * 30.0 + pow(rs, 80.0) * 0.35) * smoothstep(0.0, 0.06, uSlonce.y) * geSlW;',
    '  vec3 kol = woda * (uAmb + uKolorSlonca * max(uSlonce.y, 0.0) * 0.45 * geSlW);',
    '  kol = mix(kol, niebo, fres) + uKolorSlonca * blysk;',
    '  float piana = (1.0 - smoothstep(0.015, 0.11, dist)) * step(h, 2.0) * (0.55 + 0.45 * geSzum(xz * 22.0 + uCzas * 0.3));',
    // piana A1 liczona od LINII WODY, nie od środka komórki lądu (dist): linia wody leży w komórce brzegowej (105 m wyspy,
    // 540 m archipelagu) tam, gdzie dno przechodzi przez 0 — szacunek z dna tu i o komórkę ku lądowi (kN), ograniczony
    // do [dist − komórka, dist]. Pasy 0,02 / 0,08 km od dist byłyby węższe niż komórka i znikały (dist przy wodzie ≈ 0,01–0,07).
    '  float dW = dist;',
    '  if (uFaleWl * geDzis > 0.0 && gePoz > 0.5 && dist < 0.6) {',
    '    vec4 rr = gePoz < 1.5 ? uProstW : uProstA; vec2 nn = gePoz < 1.5 ? uRozmW : uRozmA;',
    '    float kom = (rr.z - rr.x) / (nn.x - 1.0);',
    '    vec2 uv1 = geUv(xz + kN * kom, rr, nn);',
    '    float h1 = gePoz < 1.5 ? texture2D(uWysW, uv1).r : texture2D(uWysA, uv1).r;',
    // dno 0 m (półka szwu) leży w siatce 12 m pod taflą (MORZE_POD_KM) — tak samo tutaj
    '    float h0 = h > 0.0 ? h : h - 12.0; h1 = h1 > 0.0 ? h1 : h1 - 12.0;',
    '    float est = h0 >= 0.0 ? 0.0 : h1 > h0 ? kom * -h0 / (h1 - h0) : dist;',
    '    dW = clamp(est, max(dist - kom, 0.0), dist);',
    '  }',
    // klif (A) — rozbryzg, pas węższy (0,02 km) i jaśniejszy; plaża — pas wybiegu 0,08 km z pulsem fazy grzbietu (bez filtra
    // liniowego float puls stały — faza z `dist` w schodkach 105 m dałaby bloki). Ekspozycja: wybieg × mix(0,3; 1), rozbryzg
    // × mix(0,65; 1) — spec A1 (R10): piana na KAŻDYM stromym brzegu (Los Gigantes leży w cieniu fali z NNE), pod falę mocniejsza;
    // plaże i grzbiety po zawietrznej zostają spokojniejsze
    '  float wybieg = (1.0 - smoothstep(0.0, 0.08, dW)) * mix(0.55, 0.55 + 0.45 * sin(fN), uFaleGrzbiety) * mix(0.3, 1.0, eks);',
    '  float rozbryzg = (1.0 - smoothstep(0.0, 0.02, dW)) * 1.5 * mix(0.65, 1.0, eks);',
    '  float pianaFal = step(h, 2.0) * (0.55 + 0.45 * geSzum(xz * 22.0 + uCzas * 0.3)) * mix(wybieg, rozbryzg, pf.a);',
    '  piana = mix(piana, pianaFal, uFaleWl * geDzis);',
    '  kol = mix(kol, vec3(0.78, 0.80, 0.80) * (uAmb + uKolorSlonca * max(uSlonce.y, 0.0) * geSlW), min(piana * 0.65, 1.0));',
    '  float daleko = smoothstep(25.0, 110.0, length(cameraPosition - vSwiat));',
    '  float geAlfa = mix(1.0, mix(0.25, 0.35, daleko), uSzklo);',               // szklana: krycie ≤ 0,35 także z daleka (P7)
    // pokaz: ląd spoza danych (Afryka, Madera) z tekstury globu — ta sama barwa co na poziomie `glob` (przenikanie P)
    '  if (uDaleko > 0.5 && !geW(xz, uProstA) && !geW(xz, uProstW)) {',
    '    vec2 ll = vec2(uSrodekLL.x + xz.x / uKmStopien.x, uSrodekLL.y - xz.y / uKmStopien.y);',
    '    vec3 tz = texture2D(uZiemia, vec2((ll.x + 180.0) / 360.0, (ll.y + 90.0) / 180.0)).rgb;',
    '    float lad = smoothstep(0.05, 0.16, distance(tz, OCEAN_ZIEMI));',
    '    kol = mix(kol, geS2L(tz) * (uAmb + uKolorSlonca * max(uSlonce.y, 0.0)), lad); geAlfa = mix(geAlfa, 1.0, lad);',
    '  }',
    '  kol *= 1.0 - ' + Hor.POSWIATA.woda.toFixed(2) + ' * geCienT * geNiskoSlonce();',
    '  gl_FragColor = vec4(kol, geAlfa);',
    '  #include <tonemapping_fragment>',
    '  #include <encodings_fragment>',
    '  #include <fog_fragment>',
    '}'
  ].join('\n');

  // Glob (pokaz, poziom `glob`, spec R2): kula 6371 km z tekstury Ziemi; ocean tekstury (jednolity 30/59/117 w earthmap)
  // dostaje tę samą barwę głębokiej wody co płaski ocean poziomów archipelag/wyspa (warunek 3 przenikania P), ląd —
  // albedo tekstury × (wypełnienie + klucz·N·L) jak teren (π się skraca); noc: wypełnienie gaśnie za terminatorem.
  var GLOB_VERT = [
    'varying vec2 vUv; varying vec3 vN; varying vec3 vP;',
    'void main() {',
    '  vUv = uv; vN = normalize(mat3(modelMatrix) * normal);',
    '  vec4 sw = modelMatrix * vec4(position, 1.0); vP = sw.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * sw;',
    '}'
  ].join('\n');
  var GLOB_FRAG = [
    'uniform sampler2D uMapa; uniform vec3 uSlonce; uniform vec3 uKolorSlonca; uniform vec3 uAmb; uniform vec3 uZenitL; uniform vec3 uHoryzontL;',
    'uniform float uMgielka; uniform vec2 uMgielkaL; uniform vec3 uMgielkaKol; uniform vec3 uMgielkaKolR; uniform float uWodaJasn;',
    'varying vec2 vUv; varying vec3 vN; varying vec3 vP;',
    'vec3 geS2L(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }',
    'vec3 geHex(float r, float g, float b) { return geS2L(vec3(r, g, b) / 255.0); }',
    'void main() {',
    '  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);',
    '  vec3 tz = texture2D(uMapa, vUv).rgb;',
    '  float ndl = dot(N, uSlonce), dzien = smoothstep(-0.12, 0.08, ndl);',
    '  vec3 amb = uAmb * (0.04 + 0.96 * dzien);',
    '  vec3 lad = geS2L(tz) * (amb + uKolorSlonca * max(ndl, 0.0));',
    '  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);',
    '  vec3 R = reflect(-V, N);',
    '  vec3 niebo = mix(uHoryzontL, uZenitL, pow(clamp(dot(R, N), 0.0, 1.0), 0.45)) * dzien;',
    '  float rs = max(dot(R, uSlonce), 0.0);',
    '  vec3 woda = geHex(10.0, 30.0, 58.0) * uWodaJasn * (amb + uKolorSlonca * max(ndl, 0.0) * 0.45);',
    // gładka kula bez fal: bez połysku słońca (z daleka fale rozmywają odbicie; plama połysku na gładkiej kuli
    // rozjaśniała kadr przenikania P względem płaskiego oceanu)
    '  woda = mix(woda, niebo, fres);',
    '  float morze = 1.0 - smoothstep(0.05, 0.16, distance(tz, OCEAN_ZIEMI));',
    '  vec3 c = mix(lad, woda, morze);',
    '  gl_FragColor = vec4(c, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <encodings_fragment>',
    // mgiełka jak na płaskich poziomach (kamera ponad atmosferą: kolumna = H / cos kąta widzenia) — przy brzegu tarczy
    // pas atmosfery; za terminatorem gaśnie
    '  float geCos = max(dot(N, V), 0.035);',
    '  float aR = uMgielka * (1.0 - exp(-8.5 / geCos / uMgielkaL.x));',
    '  gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(uMgielkaKol, uMgielkaKolR, 0.4) * dzien, aR);',
    '}'
  ].join('\n');
  var HALO_FRAG = [
    'uniform vec3 uSlonce; varying vec2 vUv; varying vec3 vN; varying vec3 vP;',
    'uniform vec3 uSrodek; uniform float uR;',
    'void main() {',
    // odległość promienia widzenia od środka Ziemi (w R): poświata tylko tuż nad brzegiem tarczy
    '  vec3 d = normalize(vP - cameraPosition), c = uSrodek - cameraPosition;',
    '  float b = length(c - d * dot(c, d)) / uR;',
    '  float a = smoothstep(1.035, 1.0, b) * smoothstep(0.985, 1.0, b);',
    '  float dzien = smoothstep(-0.25, 0.15, dot(normalize(vP - uSrodek), uSlonce));',
    '  gl_FragColor = vec4(vec3(0.30, 0.52, 1.0) * a * 0.55 * dzien, 1.0);',
    '}'
  ].join('\n');
  var KWADRAT_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  // przenikanie: dwa kadry z render targetów (wartości sRGB ekranu) mieszane liniowo; zasłona C/B/Cc nad kadrem
  var MIKS_FRAG = 'uniform sampler2D uA; uniform sampler2D uB; uniform float uF; varying vec2 vUv;\n' +
    'void main() { gl_FragColor = vec4(mix(texture2D(uA, vUv).rgb, texture2D(uB, vUv).rgb, uF), 1.0); }';
  var ZASLONA_FRAG = 'uniform vec4 uZaslona; void main() { gl_FragColor = uZaslona; }';

  // Kopuła nieba: gradient zenit → mgiełka przy horyzoncie, tarcza i poświata słońca; wynik od razu w sRGB ekranu
  // (bez mapowania tonów), żeby barwa horyzontu = barwa mgły terenu i oceanu (mgła r128 miesza po kodowaniu wyjścia).
  var OCEAN_ZIEMI = 'vec3(0.1176, 0.2314, 0.4588)';             // earthmap8k/4k: ocean jednolity sRGB 30/59/117
  WODA_FRAG = WODA_FRAG.replace(/OCEAN_ZIEMI/g, OCEAN_ZIEMI);
  GLOB_FRAG = GLOB_FRAG.replace(/OCEAN_ZIEMI/g, OCEAN_ZIEMI);
  WODA_FRAG = WODA_FRAG.replace('  #include <fog_fragment>', '  ' + MGIELKA_KONIEC);
  var NIEBO_VERT = 'varying vec3 vKier; void main() { vKier = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  var NIEBO_FRAG = [
    'uniform vec3 uZenit; uniform vec3 uHoryzont; uniform vec3 uSlonce; uniform vec3 uKolorTarczy; uniform float uTarcza;',
    'varying vec3 vKier;',
    'void main() {',
    '  vec3 d = normalize(vKier);',
    '  vec3 c = mix(uHoryzont, uZenit, pow(clamp(d.y, 0.0, 1.0), 0.42));',
    '  float s = max(dot(d, uSlonce), 0.0);',
    '  c += uKolorTarczy * (smoothstep(0.99985, 0.99993, s) + pow(s, 600.0) * 0.3 + pow(s, 12.0) * 0.1) * uTarcza;',
    '  gl_FragColor = vec4(min(c, vec3(1.0)), 1.0);',
    '}'
  ].join('\n');

  var CHMURY_FRAG = [
    '#include <common>', '#include <fog_pars_fragment>', '#include <clipping_planes_pars_fragment>',
    'uniform sampler2D uWysW; uniform vec4 uProstW; uniform vec2 uRozmW; uniform vec4 uProstCh;',
    'uniform float uCzas; uniform float uStrop; uniform vec3 uSlonce; uniform vec3 uKolorSlonca; uniform vec3 uAmb;',
    'varying vec3 vSwiat;',
    GLSL_WSPOLNE,
    Hor.GLSL_SLONCE, Hor.GLSL_STOZEK,
    'vec2 geUv(vec2 xz, vec4 r, vec2 n) { vec2 f = (xz - r.xy) / (r.zw - r.xy); return (f * (n - 1.0) + 0.5) / n; }',
    'void main() {',
    '  #include <clipping_planes_fragment>',
    '  vec2 xz = vSwiat.xz;',
    '  vec2 dryf = uCzas * vec2(-0.05, 0.05);',                      // pasat z NE: chmury płyną na SW
    '  float d = geFbm((xz - dryf) * 0.085) * 0.75 + geFbm((xz - dryf * 1.6) * 0.31) * 0.25;',
    '  float maska = 0.2 + 0.8 * smoothstep(-6.0, 26.0, -xz.y + 0.35 * xz.x);',
    '  float pokrycie = smoothstep(0.40, 0.62, d * (0.62 + 0.55 * maska));',
    '  float hT = -1.0;',
    '  if (xz.x >= uProstW.x && xz.x <= uProstW.z && xz.y >= uProstW.y && xz.y <= uProstW.w) hT = texture2D(uWysW, geUv(xz, uProstW, uRozmW)).r / 1000.0;',
    // miękki styk z terenem (spec R4): krycie smoothstep(0; 150 m; strop − teren)
    '  float styk = smoothstep(0.0, 0.15, uStrop - hT);',
    '  vec2 e = min(xz - uProstCh.xy, uProstCh.zw - xz);',
    // brzeg pokładu postrzępiony szumem (M3 recenzji kinowej r1: wygaszanie liniowe po prostokącie siatki dawało prostą krawędź)
    '  float brzeg = min(e.x, e.y) - 22.0 * geFbm(xz * 0.04 + vec2(3.7, 1.3));',
    '  float a = pokrycie * styk * smoothstep(0.0, 10.0, brzeg) * 0.94;',
    '  if (a < 0.004) discard;',
    // cień Teide na morzu chmur (A3, R13 — stożek, strop jako płaszczyzna uStrop): gasi człon słoneczny i przy niskim
    // Słońcu złotą poświatę stropu
    '  float geCienT = geCienStozka(xz, uStrop);',
    '  vec3 c = vec3(0.92) * (uAmb * 1.15 + uKolorSlonca * max(uSlonce.y, 0.05) * 0.7 * (1.0 - geCienT)) * (0.82 + 0.18 * d);',
    '  c *= 1.0 - ' + Hor.POSWIATA.chmury.toFixed(2) + ' * geCienT * geNiskoSlonce();',
    '  gl_FragColor = vec4(c, a);',
    '  #include <tonemapping_fragment>',
    '  #include <encodings_fragment>',
    '  #include <fog_fragment>',
    '}'
  ].join('\n');
  CHMURY_FRAG = CHMURY_FRAG.replace('  #include <fog_fragment>', '  ' + MGIELKA_KONIEC).replace('varying vec3 vSwiat;', 'varying vec3 vSwiat;\n' + GLSL_MGIELKA);

  // Pory dnia: barwy klucza i wypełnienia, nieba (sRGB ekranu). Klucz : wypełnienie = 3 : 1 (spec R4). Moce dobrane pomiarem
  // (sonda, krajobraz w nadirze, słońce az 250° el 30°, mapowanie tonów liniowe): cień 60, światło 121 sRGB.
  var PORY = {
    dzien:    { klucz: 0xfff1df, k: 0.9, wyp: 0xdfe6ee, f: 0.3, zenit: '#4c79ad', horyzont: '#c9d5de', tarcza: '#fff4dc', moc: 1 },
    zlota:    { klucz: 0xffcf9a, k: 0.86, wyp: 0xe4d6c8, f: 0.28, zenit: '#5a79a0', horyzont: '#e2c6a2', tarcza: '#ffd9a0', moc: 1 },
    zmierzch: { klucz: 0xff9a62, k: 0.5, wyp: 0x9ba5c2, f: 0.25, zenit: '#26385a', horyzont: '#c98d6e', tarcza: '#ffb080', moc: 0.8 },
    noc:      { klucz: 0x9fb4ff, k: 0.06, wyp: 0x5a6a90, f: 0.02, zenit: '#04070d', horyzont: '#111a28', tarcza: '#000000', moc: 0 },
    // pokaz (Task 8): świt po erupcji (az 70°, el 6°) i kalima — pył Sahary: wypełnienie mocne, kontrast celowo niski, mgła bliska
    swit:     { klucz: 0xffc08a, k: 0.62, wyp: 0xb8b8c8, f: 0.24, zenit: '#4a6390', horyzont: '#e6b690', tarcza: '#ffcf9a', moc: 0.9 },
    kalima:   { klucz: 0xffd6a0, k: 0.6, wyp: 0xe0c49c, f: 0.42, zenit: '#a88660', horyzont: '#d9b88c', tarcza: '#ffe0b0', moc: 0.5, mgla: [6, 70] },
    // pod pokładem chmur (G1, spec R9.2 „rozproszone pod chmurami, klucz ×0,4”): klucz dnia ×0,4, wypełnienie szare
    // mocniejsze, niebo = spód chmur (szare, bez tarczy), mgła 3–16 km (szczyt w chmurze) — recenzja kinowa r1, C3
    pochmurno: { klucz: 0xe8ecf0, k: 0.36, wyp: 0xc4ccd4, f: 0.42, zenit: '#7d8790', horyzont: '#a9b1b8', tarcza: '#000000', moc: 0, mgla: [3, 16] },
  };
  var NIEBO_PRZEKROJU = { zenit: '#07090c', horyzont: '#1a2028' };

  function kierunekSlonca(az, el) {
    return [Math.sin(az * RAD) * Math.cos(el * RAD), Math.sin(el * RAD), -Math.cos(az * RAD) * Math.cos(el * RAD)];
  }

  function teksturaFal(T) {
    var N = 256, hg = new Float32Array(N * N), fale = [], ziarno = 7;
    var los = function () { ziarno = (ziarno * 1103515245 + 12345) & 0x7fffffff; return ziarno / 0x7fffffff; };
    for (var k = 0; k < 24; k++) {
      var kx = Math.round((los() * 2 - 1) * 11), kz = Math.round((los() * 2 - 1) * 11);
      if (!kx && !kz) kz = 1;
      fale.push([kx, kz, 1 / Math.hypot(kx, kz), los() * Math.PI * 2]);
    }
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var s = 0;
      for (k = 0; k < fale.length; k++) s += fale[k][2] * Math.sin(2 * Math.PI * (fale[k][0] * x + fale[k][1] * y) / N + fale[k][3]);
      hg[y * N + x] = s;
    }
    var b = new Uint8Array(N * N * 4);
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      var gx = hg[y * N + (x + 1) % N] - hg[y * N + (x + N - 1) % N], gz = hg[((y + 1) % N) * N + x] - hg[((y + N - 1) % N) * N + x];
      var l = Math.hypot(gx, 1, gz), i = (y * N + x) * 4;
      b[i] = Math.round((-gx / l * 0.5 + 0.5) * 255); b[i + 1] = Math.round((-gz / l * 0.5 + 0.5) * 255); b[i + 2] = 255; b[i + 3] = 255;
    }
    var t = new T.DataTexture(b, N, N, T.RGBAFormat, T.UnsignedByteType);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.needsUpdate = true;
    return t;
  }

  /* ---------- budowa sceny ---------- */
  function zbuduj(T, renderer, o) {
    o = o || {};
    var dane = o.dane || {}, siatka = o.siatka, poz = o.poziomy || {}, krok = o.lod === 'lekki' ? 2 : 1;
    var pip = (root.CountryPick && root.CountryPick.pointInRing) || null;
    if (!pip) throw new Error('brak CountryPick.pointInRing');
    if (!Ew) throw new Error('brak Ewolucja (geologia/ewolucja.js)');
    var zasoby = [];                                    // geometrie, materiały, tekstury do zwolnienia
    function z(x) { zasoby.push(x); return x; }
    var scena = new T.Scene();
    var kamera = new T.PerspectiveCamera(40, 16 / 9, 0.05, 800);
    var e = o.przewyzszenie || 1.5;
    var flt = renderer.extensions && renderer.extensions.has && renderer.extensions.has('OES_texture_float_linear');
    var jednostki = dane.jednostki || [];
    var iMloda = 0;
    jednostki.forEach(function (j, k) { if (j.id === 'teide-pico-viejo') iMloda = k + 1; });

    // --- wspólne uniformy terenu ---
    // paleta 256 × 1: indeks jednostki w R8 sięga 255 — więcej jednostek niż tekseli to błąd danych, nie cichy brak barwy
    if (jednostki.length > 255) console.error('Geologia: ' + jednostki.length + ' jednostek — paleta mieści 255, nadmiar bez barwy');
    var paleta = new Uint8Array(256 * 4);
    jednostki.slice(0, 255).forEach(function (j, k) {
      var c = new T.Color(j.kolor);
      paleta[(k + 1) * 4] = Math.round(c.r * 255); paleta[(k + 1) * 4 + 1] = Math.round(c.g * 255); paleta[(k + 1) * 4 + 2] = Math.round(c.b * 255); paleta[(k + 1) * 4 + 3] = 255;
    });
    var tPaleta = z(new T.DataTexture(paleta, 256, 1, T.RGBAFormat, T.UnsignedByteType));
    tPaleta.magFilter = tPaleta.minFilter = T.NearestFilter; tPaleta.generateMipmaps = false; tPaleta.needsUpdate = true;
    var U = { uTryb: { value: 0 }, uNasycMaks: { value: 1 }, uPrzew: { value: e }, uSzklo: { value: 0 }, uPaleta: { value: tPaleta }, uKolorWody: { value: hexLin(T, '#123a52') },
      // materiał (Task B1): domyślnie zwykły — gałąź sklejki w shaderze pominięta (pokaz nigdy jej nie włącza)
      uMaterial: { value: 0 }, uKrokSklejki: { value: krokSklejki(e) },
      // stuknięcie (Task B3): w = 0 — pierścień wyłączony (pokaz nigdy go nie włącza)
      uStuk: { value: new T.Vector4(0, 0, 0, 0) }, uCzasStuk: { value: 0 },
      // kurz kalimy (Task C1): grubość 0 — gałąź pominięta (pokaz nigdy jej nie włącza); maska do pierwszego kurz({ maska }) = paleta
      uKurzGrubosc: { value: 0 }, uKurz: { value: tPaleta }, uProstKurz: { value: new T.Vector4(0, 0, 1, 1) } };
    // barwa wody pod taflą (mgła wodna stanu „szklana”): zwykła albo żywica sklejki; × jasność światła z swiatlo()
    var kolorWody = KOLOR_WODY.zwykly, jasnWody = 1;
    // czas geologiczny (wspólne dla terenu, głębi cienia i wody) i efekty animacji (łuna, żar, cień chmur)
    var tab = function (n, f) { var a = []; for (var i = 0; i < n; i++) a.push(f()); return a; };
    var UE = { uEwoMa: { value: 0 }, uEwoDno: { value: Ew.DNO },
      uEwoO: { value: tab(MAX_JEDN_GPU, function () { return new T.Vector4(0, 0, -1, 0); }) },
      uEwoP: { value: tab(MAX_JEDN_GPU, function () { return new T.Vector4(); }) },
      uEwoC: { value: tab(MAX_JEDN_GPU, function () { return new T.Vector2(); }) } };
    var UF = { uLunaP: { value: tab(24, function () { return new T.Vector2(); }) }, uLunaN: { value: 0 }, uLunaKolor: { value: new T.Vector3() },
      uLunaZasieg: { value: 0.3 }, uZar: { value: 0 }, uCienChmur: { value: 0 }, uStropA4: { value: 1.3 * e }, uCzasA4: { value: 0 },
      uSlonceKier: { value: new T.Vector3(0, 1, 0) } };
    Object.keys(UE).forEach(function (k) { U[k] = UE[k]; });
    Object.keys(UF).forEach(function (k) { U[k] = UF[k]; });
    // mgiełka powietrza (pokaz): te same obiekty uniformów w terenie, wodzie, chmurach i na globie
    var UM = { uMgielka: { value: 0 }, uMgielkaL: { value: new T.Vector2(MGIELKA_L[0], MGIELKA_L[1]) }, uMgielkaKol: { value: new T.Vector3(1, 1, 1) },
      uMgielkaKolR: { value: new T.Vector3(1, 1, 1) }, uMgPrzew: { value: e }, uMgKamH: { value: 0 } };
    Object.keys(UM).forEach(function (k) { U[k] = UM[k]; });
    // cienie z mapy horyzontu (Task A3): te same obiekty w terenie, wodzie i chmurach. Do wczytania mapy (horyzont()) próbniki
    // dostają paletę, a uCienieHor = 0 pomija odczyt. Pokaz (o.cienieHor === false) mapy nie dostaje nigdy — kadry filmów
    // strojone bez tych cieni (Review Focus 2).
    var UH = { uHor0: { value: tPaleta }, uHor1: { value: tPaleta }, uSlonceAzEl: { value: new T.Vector2(250 * RAD, 30 * RAD) },
      uCienieHor: { value: 0 }, uProstHor: { value: new T.Vector4(0, 0, 1, 1) }, uRozmHor: { value: new T.Vector2(1, 1) },
      // stożek Teide (R13): x, z [km sceny], wierzchołek h [km], k = promień / wysokość; k = 0 — bez cienia
      uStozek: { value: new T.Vector4(0, 0, 0, 0) } };
    var stozek = null;
    Object.keys(UH).forEach(function (k) { U[k] = UH[k]; });
    var hor = { dozwolone: o.cienieHor !== false, wczytana: false, zezwolenie: true };
    var plaszczyzna = new T.Plane(new T.Vector3(0, 1, 0), 1e7), plaszczyzny = [plaszczyzna];
    // pokaz (o.ostrze): druga płaszczyzna i przecięcie (clipIntersection) — odcięcie jedzie wzdłuż linii przekroju
    // (R9.6 X2); poza ruchem ostrze „tnie wszystko”, więc przecięcie = sama płaszczyzna przekroju. Makieta: jedna płaszczyzna.
    var ostrze = o.ostrze ? new T.Plane(new T.Vector3(0, 1, 0), -1e7) : null, ostrzeSciany = o.ostrze ? new T.Plane(new T.Vector3(0, 1, 0), 1e7) : null;
    if (ostrze) plaszczyzny.push(ostrze);
    var blokWl = false, tlo = new T.Color(0x000000), odslonWarstwy = null, jasnNieba = 1;
    var KOTWICA_SWIATLA = 'getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );';
    var KOTWICA_NORMALNEJ = 'normal = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;';
    if (T.ShaderChunk.lights_fragment_begin.indexOf(KOTWICA_SWIATLA) < 0 || T.ShaderChunk.normal_fragment_maps.indexOf(KOTWICA_NORMALNEJ) < 0) {
      console.error('Geologia: fragmenty shaderów THREE inne niż w r128 — cień chmur i nachylenie rzeźby chwili nie zadziałają');
    }
    var LUZ_SWIATLA = T.ShaderChunk.lights_fragment_begin.replace(KOTWICA_SWIATLA, KOTWICA_SWIATLA + '\n\t\tdirectLight.color *= geCien * geSlHor;');
    var NORMALNA_EWO = T.ShaderChunk.normal_fragment_maps.replace(KOTWICA_NORMALNEJ, KOTWICA_NORMALNEJ + '\n\tnormal.xz *= vEwoK;');
    function wierzcholekEwolucji(sh, u, glebia) {
      Object.keys(UE).forEach(function (k) { sh.uniforms[k] = UE[k]; });
      ['uPrzyn', 'uEwoAkt', 'uEwoUv', 'uEwoBrzeg'].forEach(function (k) { sh.uniforms[k] = u[k]; });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + (glebia ? 'float vEwoK; float vEwoZar;\n' : 'varying float vWys;\nvarying vec3 vSwiat;\nvarying float vEwoK;\nvarying float vEwoZar;\n') +
          GLSL_EWO_PARS_VERT + GLSL_EWOLUCJA)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GLSL_EWO_WIERZCHOLEK +
          (glebia ? '' : '\n\tvWys = transformed.y;\n\tvSwiat = (modelMatrix * vec4(transformed, 1.0)).xyz;'));
    }
    // Głębia cienia z rzeźbą chwili. clipShadows klonuje materiał głębi w WebGLShadowMap, a Material.copy w r128 nie
    // przenosi onBeforeCompile — klon dostaje ten sam hak (inaczej cień rzucałaby dzisiejsza rzeźba).
    function materialGlebi(u) {
      var m = z(new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking }));
      m.onBeforeCompile = function (sh) { wierzcholekEwolucji(sh, u, true); };
      m.clone = function () { var c = T.MeshDepthMaterial.prototype.clone.call(this); c.onBeforeCompile = this.onBeforeCompile; c.clone = this.clone; return c; };
      return m;
    }

    function materialTerenu(P, tNorm, tInd, wyciecia) {
      var m = z(new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0, normalMap: tNorm,
        normalMapType: T.ObjectSpaceNormalMap, clippingPlanes: plaszczyzny, clipShadows: true, clipIntersection: !!ostrze }));
      m.extensions = { derivatives: true };          // sklejka (B1): fwidth/dFdx — w WebGL1 GL_OES_standard_derivatives
      var wyc = [0, 1, 2].map(function (k) { var r = wyciecia[k]; return r ? new T.Vector4(r.x0, r.z0, r.x1, r.z1) : new T.Vector4(); });
      var u = { uIndeksy: { value: tInd || tPaleta }, uMaIndeksy: { value: tInd ? 1 : 0 }, uMloda: { value: tInd ? iMloda : 0 },
        uWyc: { value: wyc }, uLWyc: { value: wyciecia.length },
        // przynależność do czasu geologicznego: tekstura R8 bez transformacji uv; texel wierzchołka = uv·(xy) + (zw)
        uPrzyn: { value: tPaleta }, uEwoAkt: { value: 0 },
        uEwoUv: { value: new T.Vector4((P.w - 1) / P.w, -(P.h - 1) / P.h, 0.5 / P.w, (P.h - 0.5) / P.h) },
        uEwoBrzeg: { value: new T.Vector4(-1e6, -1e6, 1e6, 1e6) } };
      m.onBeforeCompile = function (sh) {
        Object.keys(U).forEach(function (k) { sh.uniforms[k] = U[k]; });
        Object.keys(u).forEach(function (k) { sh.uniforms[k] = u[k]; });
        wierzcholekEwolucji(sh, u, false);
        sh.vertexShader = sh.vertexShader.replace('#include <fog_vertex>', FOG_RADIALNA);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\n' + GLSL_TEREN_PARS + '\n' + GLSL_MGIELKA)
          .replace('#include <fog_fragment>', MGIELKA_KONIEC)
          .replace('#include <clipping_planes_fragment>', GLSL_SKLEJKA_POCHODNE + '\n#include <clipping_planes_fragment>')
          .replace('#include <color_fragment>', '#include <color_fragment>\n' + GLSL_TEREN_KOLOR)
          .replace('#include <normal_fragment_maps>', NORMALNA_EWO)
          .replace('#include <lights_fragment_begin>', LUZ_SWIATLA)
          .replace('#include <tonemapping_fragment>', GLSL_TEREN_EMISJA + '\n' + GLSL_TEREN_WODA + '\n#include <tonemapping_fragment>');
      };
      m.userData.u = u;
      return m;
    }

    // --- poziomy ---
    var arch = null, wyspa, wstawki = [];
    if (poz.archipelag) {
      var sa = poz.archipelag, ra = prostokat(sa);
      var dxa = (ra.x1 - ra.x0) / (sa.w - 1), dza = (ra.z1 - ra.z0) / (sa.h - 1);
      // archipelag (ok. 540 m/komórkę) zawsze co drugą próbkę: z bliska i tak przykrywa go wyspa, z daleka 1,1 km wystarcza
      arch = zbudujPoziom(sa, 2, { km: 8, fn: function () { return -3; } }, nawietrznosc(sa.wys, sa.w, sa.h, dxa, dza, 9),
        { prost: [prostokat(siatka)], km: 0.02 });
      arch.odl = odlegloscOdBrzegu(sa.wys, sa.w, sa.h, dxa, dza);
    }
    var rw = prostokat(siatka), dxw = (rw.x1 - rw.x0) / (siatka.w - 1), dzw = (rw.z1 - rw.z0) / (siatka.h - 1);
    var nawW = nawietrznosc(siatka.wys, siatka.w, siatka.h, dxw, dzw, 9);
    // cel wtapiania = powierzchnia grubszego poziomu PRZED obniżeniem w zakładce (drobniejszy ma tam leżeć wyżej)
    function przed(P) { return { x0: P.x0, z0: P.z0, dxv: P.dxv, dzv: P.dzv, nx: P.nx, nz: P.nz, hs: P.hsPrzed }; }
    var archPrzed = arch ? przed(arch) : null;
    wyspa = zbudujPoziom(siatka, krok, arch ? { km: WTOP_WYSPA_KM, fn: function (x, zz) { return wysokoscTrojkatna(archPrzed, x, zz); } } : null, nawW,
      { prost: (poz.wstawki || []).map(prostokat), km: 0.006 });
    wyspa.odl = odlegloscOdBrzegu(siatka.wys, siatka.w, siatka.h, dxw, dzw);
    // odległość od brzegu liczy też sąsiednie wyspy spoza kafla (La Gomera leży 5 km za jego zachodnią krawędzią) —
    // bez tego głębokość efektywna oceanu skacze na krawędzi kafla
    // (z ich lądu w archipelagu — ląd Teneryfy w grubej siatce 540 m wystaje 1–2 km za brzeg i dawał pianę na morzu)
    var oa = null;
    if (arch) {
      var wysInne = new Float32Array(arch.w * arch.h);
      for (var ia = 0; ia < wysInne.length; ia++) {
        var xa = arch.x0 + (ia % arch.w) * arch.dx, za = arch.z0 + Math.floor(ia / arch.w) * arch.dz;
        wysInne[ia] = wewnatrz(rw, xa, za) ? -1 : arch.s.wys[ia];
      }
      oa = odlegloscOdBrzegu(wysInne, arch.w, arch.h, arch.dx, arch.dz);
    }
    if (oa) for (var yo = 0; yo < siatka.h; yo++) for (var xo = 0; xo < siatka.w; xo++) {
      var fxa = Math.max(0, Math.min(arch.w - 1.001, (rw.x0 + xo * dxw - arch.x0) / arch.dx)), fya = Math.max(0, Math.min(arch.h - 1.001, (rw.z0 + yo * dzw - arch.z0) / arch.dz));
      var xa0 = Math.floor(fxa), ya0 = Math.floor(fya), txa = fxa - xa0, tya = fya - ya0, Wa = arch.w;
      var da = (oa[ya0 * Wa + xa0] * (1 - txa) + oa[ya0 * Wa + xa0 + 1] * txa) * (1 - tya) + (oa[(ya0 + 1) * Wa + xa0] * (1 - txa) + oa[(ya0 + 1) * Wa + xa0 + 1] * txa) * tya;
      var io = yo * siatka.w + xo;
      if (da < wyspa.odl[io]) wyspa.odl[io] = da;
    }
    // pole fal (A1) z tej samej odległości od brzegu, którą czyta woda; tablica zostaje w poziomie (odczyty na CPU, B3)
    var faleWl = o.fale !== false;
    if (faleWl && !Fale) throw new Error('brak GeologiaFale (geologia/fale.js)');
    if (faleWl) [arch, wyspa].forEach(function (P) { if (P) P.poleFal = Fale.poleFal(P.s.wys, P.w, P.h, P.dx, P.dz, P.odl, Fale.KIERUNEK_FALI); });
    wyspa.indeksy = indeksyJednostek(siatka.wys, siatka.w, siatka.h, siatka.bbox, jednostki, pip);
    var wyspaPrzed = przed(wyspa);
    (poz.wstawki || []).forEach(function (sw) {
      var rr = prostokat(sw), dxi = (rr.x1 - rr.x0) / (sw.w - 1), dzi = (rr.z1 - rr.z0) / (sw.h - 1);
      // nawietrzność wstawki = nawietrzność wyspy w tym miejscu (makro-zbocze nie zależy od rozdzielczości)
      var nw = new Float32Array(sw.w * sw.h);
      for (var y = 0; y < sw.h; y++) for (var x = 0; x < sw.w; x++) {
        var fx = Math.max(0, Math.min(siatka.w - 1.001, (rr.x0 + x * dxi - rw.x0) / dxw)), fy = Math.max(0, Math.min(siatka.h - 1.001, (rr.z0 + y * dzi - rw.z0) / dzw));
        var x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, W = siatka.w;
        nw[y * sw.w + x] = (nawW[y0 * W + x0] * (1 - tx) + nawW[y0 * W + x0 + 1] * tx) * (1 - ty) + (nawW[(y0 + 1) * W + x0] * (1 - tx) + nawW[(y0 + 1) * W + x0 + 1] * tx) * ty;
      }
      var P = zbudujPoziom(sw, krok, { km: WTOP_WSTAWKA_KM, fn: function (x, zz) { return wysokoscTrojkatna(wyspaPrzed, x, zz); } }, nw);
      P.id = sw.id;
      P.indeksy = indeksyJednostek(sw.wys, sw.w, sw.h, sw.bbox, jednostki, pip);
      wstawki.push(P);
    });

    [arch, wyspa].forEach(function (P) { if (P) P.hsPrzed = null; });
    archPrzed = wyspaPrzed = null;
    function teksturaWysokosci(P) {
      var d = new Float32Array(P.w * P.h * 2);
      for (var i = 0; i < P.w * P.h; i++) { d[i * 2] = P.s.wys[i]; d[i * 2 + 1] = Math.min(P.odl[i], 500); }
      var t = z(new T.DataTexture(d, P.w, P.h, T.RGFormat, T.FloatType));
      t.internalFormat = 'RG32F';
      t.magFilter = t.minFilter = flt ? T.LinearFilter : T.NearestFilter;
      t.generateMipmaps = false; t.needsUpdate = true;
      return t;
    }
    // Pole fal RGBA8 (A1): ten sam układ co teksturaWysokosci (wiersz 0 = północ, bez flipY, uv z geUv w shaderze wody).
    function teksturaPolaFal(P) {
      var t = new T.DataTexture(P.poleFal, P.w, P.h, T.RGBAFormat, T.UnsignedByteType);
      t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
      t.magFilter = t.minFilter = T.LinearFilter;
      t.generateMipmaps = false; t.unpackAlignment = 1; t.needsUpdate = true;
      return t;
    }
    // Szew między poziomami: grubszy poziom wycina prostokąt drobniejszego pomniejszony o zakładkę, w której oba się
    // pokrywają (brzeg drobniejszego jest tam już wtopiony w grubszy, a grubszy leży wewnątrz prostokąta 6 m / 20 m niżej,
    // więc zakładkę rozstrzyga test głębi) — bez zakładki na krawędzi wycięcia prześwitywały szpary (rasteryzacja krawędzi
    // siatki i granicy `discard` nie pokrywa się co do piksela). polygonOffset odpadł: przy patrzeniu stycznym jego człon
    // nachylenia to setki metrów i płytkie dno wstawki wychodziło nad taflę.
    function zakladka(r, m) { return { x0: r.x0 + m, z0: r.z0 + m, x1: r.x1 - m, z1: r.z1 - m }; }
    function siatkaPoziomu(P, wyciecia, cien) {
      P.tNorm = z(teksturaPoziomu(T, P.normalne, P, T.RGBAFormat, T.UnsignedByteType, 'mip'));
      P.tInd = P.indeksy ? z(teksturaPoziomu(T, P.indeksy, P, T.RedFormat, T.UnsignedByteType, false)) : null;
      P.mat = materialTerenu(P, P.tNorm, P.tInd, wyciecia);
      P.geo = z(geometriaSiatki(T, P));
      P.mesh = new T.Mesh(P.geo, P.mat);
      P.mesh.scale.y = e;
      P.mesh.castShadow = !!cien; P.mesh.receiveShadow = true;
      if (cien) P.mesh.customDepthMaterial = materialGlebi(P.mat.userData.u);
      scena.add(P.mesh);
      return P.mesh;
    }
    if (arch) {
      siatkaPoziomu(arch, [zakladka(wyspa.prost, 1.5)], false); arch.tWys = teksturaWysokosci(arch); arch.mesh.name = 'archipelag';
      if (arch.poleFal) arch.tFale = z(teksturaPolaFal(arch));
    }
    siatkaPoziomu(wyspa, wstawki.map(function (P) { return zakladka(P.prost, 0.12); }), true);
    wyspa.mesh.name = 'teren';
    wyspa.mat.userData.u.uEwoBrzeg.value.set(wyspa.x0, wyspa.z0, wyspa.x1, wyspa.z1);
    wyspa.tWys = teksturaWysokosci(wyspa);
    if (wyspa.poleFal) wyspa.tFale = z(teksturaPolaFal(wyspa));
    wstawki.forEach(function (P) {
      siatkaPoziomu(P, [], false); P.mesh.name = 'wstawka-' + P.id;
    });

    var wierzcholki = { archipelag: arch ? arch.nx * arch.nz : 0, wyspa: wyspa.nx * wyspa.nz,
      wstawki: wstawki.reduce(function (n, P) { return n + P.nx * P.nz; }, 0) };
    wierzcholki.razem = wierzcholki.archipelag + wierzcholki.wyspa + wierzcholki.wstawki;
    // Czas geologiczny na CPU (G-D): ten sam rachunek co shader wierzchołków, punktowo — etykieta z najbliższej komórki
    // poziomu, krawędź kafla wyspy wraca do dzisiejszej wysokości jak w shaderze.
    var ewo = { Ma: 0, P: null, gotowa: false };
    function wChwili(P, hKm, x, zz, brzeg) {
      if (!(ewo.Ma > 0) || !P.przyn || hKm == null) return hKm;
      var ix = Math.round((x - P.x0) / P.dx), iy = Math.round((zz - P.z0) / P.dz);
      if (ix < 0 || iy < 0 || ix >= P.w || iy >= P.h) return hKm;
      var ic = iy * P.w + ix, lab = P.przyn[ic];
      if (!lab) return hKm;
      var ll = Teren.zLokalnych(null, x, zz), h0 = hKm * 1000;
      var hE = Ew.wysokoscKomorki(ewo.P, lab, h0, ewo.Ma, ll[0], ll[1], Ew.DNO, P.przyn.drugi[ic], P.przyn.waga[ic], P.przyn.brzeg[ic]);
      if (brzeg) hE = h0 + gladko(Math.min(x - P.x0, P.x1 - x, zz - P.z0, P.z1 - zz) / WTOP_WYSPA_KM) * (hE - h0);
      return hE / 1000;
    }
    // Wysokość wyświetlanej powierzchni w świecie (km × przewyższenie): wstawka > wyspa > archipelag; null = poza danymi.
    function wysokoscKm(x, zz) {
      for (var k = 0; k < wstawki.length; k++) if (wewnatrz(wstawki[k].prost, x, zz)) return wChwili(wstawki[k], wysokoscTrojkatna(wstawki[k], x, zz), x, zz, false);
      if (wewnatrz(wyspa.prost, x, zz)) return wChwili(wyspa, wysokoscTrojkatna(wyspa, x, zz), x, zz, true);
      if (arch && wewnatrz(arch.prost, x, zz)) return wysokoscTrojkatna(arch, x, zz);
      return null;
    }
    function wysokosc(x, zz) { var h = wysokoscKm(x, zz); return h == null ? null : h * e; }

    // zasięg lądu wyspy (kadr startowy)
    var lad = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    for (var yy = 0; yy < siatka.h; yy += 2) for (var xx = 0; xx < siatka.w; xx += 2) {
      if (siatka.wys[yy * siatka.w + xx] > 0) {
        var lx = rw.x0 + xx * dxw, lz = rw.z0 + yy * dzw;
        if (lx < lad.x0) lad.x0 = lx; if (lx > lad.x1) lad.x1 = lx; if (lz < lad.z0) lad.z0 = lz; if (lz > lad.z1) lad.z1 = lz;
      }
    }

    // --- światło ---
    var klucz = new T.DirectionalLight(0xffffff, 2.5);
    klucz.castShadow = true;
    klucz.shadow.mapSize.set(krok === 1 ? 2048 : 1024, krok === 1 ? 2048 : 1024);
    klucz.shadow.bias = -0.00008; klucz.shadow.normalBias = 0.06;
    var skam = klucz.shadow.camera; skam.left = skam.bottom = -80; skam.right = skam.top = 80; skam.near = 180; skam.far = 420;
    scena.add(klucz); scena.add(klucz.target);
    var wypelnienie = new T.HemisphereLight(0xffffff, 0xffffff, 0.5);
    scena.add(wypelnienie);
    // „lawa”: jedno światło zbiorcze od budowy sceny z mocą 0 — zapalenie nie zmienia liczby świateł w kluczu programu
    var lawa = new T.PointLight(0xff7a30, 0, 12, 2);
    lawa.name = 'lawa'; lawa.position.set(0, 1, 0);
    scena.add(lawa);

    // --- niebo, mgła ---
    var uNiebo = { uZenit: { value: new T.Vector3() }, uHoryzont: { value: new T.Vector3() }, uSlonce: { value: new T.Vector3(0, 1, 0) },
      uKolorTarczy: { value: new T.Vector3(1, 1, 1) }, uTarcza: { value: 1 } };
    var kopula = new T.Mesh(z(new T.SphereGeometry(1, 48, 24)), z(new T.ShaderMaterial({ uniforms: uNiebo, vertexShader: NIEBO_VERT,
      fragmentShader: NIEBO_FRAG, side: T.BackSide, depthWrite: false, fog: false, toneMapped: false })));
    kopula.renderOrder = -1000; kopula.frustumCulled = false; kopula.name = 'niebo';
    scena.add(kopula);
    scena.fog = new T.Fog(0xc9d5de, 240, 400);

    // --- ocean ---
    var tFale = z(teksturaFal(T));
    var uWoda = T.UniformsUtils.merge([T.UniformsLib.fog, {
      uWysW: { value: wyspa.tWys }, uWysA: { value: arch ? arch.tWys : wyspa.tWys }, uFale: { value: tFale },
      uProstW: { value: new T.Vector4(rw.x0, rw.z0, rw.x1, rw.z1) },
      uProstA: { value: arch ? new T.Vector4(arch.x0, arch.z0, arch.x1, arch.z1) : new T.Vector4(0, 0, -1, -1) },
      uRozmW: { value: new T.Vector2(siatka.w, siatka.h) }, uRozmA: { value: arch ? new T.Vector2(arch.w, arch.h) : new T.Vector2(1, 1) },
      uCzas: { value: 0 }, uSzklo: { value: 0 }, uTylkoKafel: { value: 0 },
      uSlonce: { value: new T.Vector3(0, 1, 0) }, uKolorSlonca: { value: new T.Vector3(1, 1, 1) }, uAmb: { value: new T.Vector3(0.5, 0.5, 0.5) },
      uZenitL: { value: new T.Vector3() }, uHoryzontL: { value: new T.Vector3() }, uPrzynW: { value: null }, uEwoWoda: { value: 0 },
      uZiemia: { value: null }, uDaleko: { value: 0 }, uWodaJasn: { value: 1 }, uSrodekLL: { value: new T.Vector2(Teren.SRODEK.lon, Teren.SRODEK.lat) },
      uKmStopien: { value: new T.Vector2(KM_STOPIEN * Math.cos(Teren.SRODEK.lat * RAD), KM_STOPIEN) },
      uPoleW: { value: null }, uPoleA: { value: null }, uKierFali: { value: new T.Vector2(0, 1) }, uFaleWl: { value: 0 }, uFaleGrzbiety: { value: 0 } }]);
    // UniformsUtils.merge klonuje tekstury — podmieniamy z powrotem na te same obiekty (jedno wgranie na GPU)
    uWoda.uWysW.value = wyspa.tWys; uWoda.uWysA.value = arch ? arch.tWys : wyspa.tWys; uWoda.uFale.value = tFale; uWoda.uPrzynW.value = tPaleta; uWoda.uZiemia.value = tPaleta;
    // fale A1: bez pola (pokaz) sampler dostaje paletę, a uFaleWl = 0 zeruje każdy wkład; archipelag bez pola — pole wyspy
    uWoda.uPoleW.value = wyspa.tFale || tPaleta; uWoda.uPoleA.value = (arch && arch.tFale) || wyspa.tFale || tPaleta;
    if (faleWl) { uWoda.uKierFali.value.set(Fale.KIERUNEK_FALI[0], Fale.KIERUNEK_FALI[1]); uWoda.uFaleWl.value = 1; uWoda.uFaleGrzbiety.value = flt ? 1 : 0; }
    Object.keys(UE).forEach(function (k) { uWoda[k] = UE[k]; });          // czas geologiczny: te same obiekty co w terenie
    Object.keys(UM).forEach(function (k) { uWoda[k] = UM[k]; });
    Object.keys(UH).forEach(function (k) { uWoda[k] = UH[k]; });
    var matWody = z(new T.ShaderMaterial({ uniforms: uWoda, vertexShader: WODA_VERT, fragmentShader: WODA_FRAG, transparent: true,
      fog: true, clipping: true, clippingPlanes: plaszczyzny, clipIntersection: !!ostrze, depthWrite: true }));
    var ocean = new T.Mesh(z(new T.CircleGeometry(1, 128)), matWody);
    ocean.rotation.x = -Math.PI / 2; ocean.renderOrder = 1; ocean.frustumCulled = false; ocean.name = 'ocean';
    scena.add(ocean);

    // --- morze chmur ---
    var prostCh = { x0: rw.x0 - 30, z0: rw.z0 - 50, x1: rw.x1 + 30, z1: rw.z1 + 10 };
    var uChmury = T.UniformsUtils.merge([T.UniformsLib.fog, {
      uWysW: { value: wyspa.tWys }, uProstW: { value: uWoda.uProstW.value }, uRozmW: { value: uWoda.uRozmW.value },
      uProstCh: { value: new T.Vector4(prostCh.x0, prostCh.z0, prostCh.x1, prostCh.z1) },
      uCzas: { value: 0 }, uStrop: { value: STROP_CHMUR_KM }, uSlonce: { value: uWoda.uSlonce.value }, uKolorSlonca: { value: uWoda.uKolorSlonca.value },
      uAmb: { value: uWoda.uAmb.value } }]);
    uChmury.uWysW.value = wyspa.tWys;
    Object.keys(UM).forEach(function (k) { uChmury[k] = UM[k]; });
    Object.keys(UH).forEach(function (k) { uChmury[k] = UH[k]; });
    var matChmur = z(new T.ShaderMaterial({ uniforms: uChmury, vertexShader: WODA_VERT, fragmentShader: CHMURY_FRAG, transparent: true,
      depthWrite: false, side: T.DoubleSide, fog: true, clipping: true, clippingPlanes: plaszczyzny, clipIntersection: !!ostrze }));
    var chmuryMesh = new T.Mesh(z(new T.PlaneGeometry(prostCh.x1 - prostCh.x0, prostCh.z1 - prostCh.z0, 1, 1)), matChmur);
    chmuryMesh.rotation.x = -Math.PI / 2;
    chmuryMesh.position.set((prostCh.x0 + prostCh.x1) / 2, STROP_CHMUR_KM * e, (prostCh.z0 + prostCh.z1) / 2);
    chmuryMesh.renderOrder = 2; chmuryMesh.visible = false; chmuryMesh.name = 'chmury';
    scena.add(chmuryMesh);

    // --- smugi pasatu i piasek (Task A2) ---
    // Pole i linie w układzie siatki wyspy (km od narożnika NW) — grupa przesunięta o (x0, z0) prostokąta, scale.y = przewyższenie.
    // Przed morzem chmur (renderOrder 1,5): strop chmur przykrywa smugi z góry. Pokaz (o.wiatr === false): bez warstwy.
    var wiatrSt = { dozwolone: o.wiatr !== false, zezwolenie: true, n: 0, pole: null, zPd: Infinity, ms: 0 };
    if (wiatrSt.dozwolone && !Wt) throw new Error('brak GeologiaWiatr (geologia/wiatr.js)');
    var grupaWiatru = null, linieWiatru = null, uWiatr = null;
    function zbudujSmugi(n) {
      n = Math.max(0, Math.floor(+n || 0));
      if (!wiatrSt.dozwolone || n === wiatrSt.n) return false;
      var t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!wiatrSt.pole) {
        wiatrSt.pole = Wt.pole(siatka.wys, siatka.w, siatka.h, dxw, dzw);
        wiatrSt.zPd = Teren.doLokalnych(siatka, Teren.SRODEK.lon, Wt.LAT_PIASKU)[1] - rw.z0;
      }
      var L = Wt.linie(wiatrSt.pole, siatka.w, siatka.h, dxw, dzw, { n: n, ziarno: 1, wys: siatka.wys, zPoludnia: wiatrSt.zPd });
      var P = n ? L.s.length / n : 0, pv = new Float32Array(n * P), idx = new Uint32Array(n * Math.max(0, P - 1) * 2), l, k, q = 0;
      for (l = 0; l < n; l++) {
        if (L.piasek[l]) pv.fill(1, l * P + L.piasekOd[l], (l + 1) * P);      // piasek od pierwszej plaży (R16)
        for (k = 0; k < P - 1; k++) { idx[q++] = l * P + k; idx[q++] = l * P + k + 1; }
      }
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(L.pozycje, 3));
      g.setAttribute('s', new T.BufferAttribute(L.s, 1));
      g.setAttribute('piasek', new T.BufferAttribute(pv, 1));
      g.setAttribute('zanik', new T.BufferAttribute(L.zanik, 1));
      g.setIndex(new T.BufferAttribute(idx, 1));
      g.computeBoundingSphere();
      if (!grupaWiatru) {
        uWiatr = T.UniformsUtils.merge([T.UniformsLib.fog, { uCzas: { value: 0 }, uJasn: { value: 1 },
          uKolor: { value: new T.Color(0xeef4fa) }, uKolorPiasku: { value: new T.Color(0xe8c58a) } }]);
        var mat = z(new T.ShaderMaterial({ uniforms: uWiatr, vertexShader: Wt.GLSL_VERT, fragmentShader: Wt.GLSL_FRAG, transparent: true,
          depthWrite: false, fog: true, clipping: true, clippingPlanes: plaszczyzny, clipIntersection: !!ostrze }));
        linieWiatru = new T.LineSegments(z(g), mat);
        linieWiatru.renderOrder = 1.5; linieWiatru.name = 'smugi';
        grupaWiatru = new T.Group(); grupaWiatru.name = 'wiatr';
        grupaWiatru.position.set(rw.x0, 0, rw.z0); grupaWiatru.scale.y = e;
        grupaWiatru.add(linieWiatru);
        scena.add(grupaWiatru);
      } else {
        // zmiana liczby linii (jakość „lekka”): stara geometria zwolniona i zdjęta z listy zasobów
        var stara = linieWiatru.geometry, iz = zasoby.indexOf(stara);
        stara.dispose(); if (iz >= 0) zasoby.splice(iz, 1);
        linieWiatru.geometry = z(g);
      }
      wiatrSt.n = n;
      wiatrSt.ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
      wiatrAkt();
      return true;
    }
    function wiatrAkt() {
      var wl = !!grupaWiatru && wiatrSt.n > 0 && wiatrSt.zezwolenie && !(ewo.Ma > 0);
      if (grupaWiatru) grupaWiatru.visible = wl;
      return wl;
    }
    zbudujSmugi(o.wiatrLinie != null ? o.wiatrLinie : Wt ? Wt.LICZBA.pelna : 0);

    // --- znaczniki części: pinezka (kropka + szpilka) i etykieta sprite ---
    var grupaCzesci = new T.Group(); grupaCzesci.name = 'czesci';
    scena.add(grupaCzesci);
    var kropka = (function () {
      var c = plotno(64, 64), x = c.getContext('2d');
      x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fillStyle = '#ffffff'; x.fill();
      x.lineWidth = 7; x.strokeStyle = 'rgba(8,11,15,0.85)'; x.stroke();
      var t = z(new T.CanvasTexture(c)); t.encoding = T.sRGBEncoding; return t;
    })();
    var czesci = {}, piny = [];
    (dane.czesci || []).forEach(function (cz) {
      var p = Teren.doLokalnych(siatka, cz.lonLat[0], cz.lonLat[1]);
      if (wysokoscKm(p[0], p[1]) == null) return;
      var g = new T.Group(); g.name = 'czesc-' + cz.id; g.userData.id = cz.id;
      var glowa = new T.Sprite(z(new T.SpriteMaterial({ map: kropka, color: 0xffb36b, sizeAttenuation: false, depthTest: false, fog: false, toneMapped: false })));
      glowa.renderOrder = 11; glowa.userData.id = cz.id;
      var c = plotno(8, 8), x = c.getContext('2d'), F = 26, pad = 10, font = '600 ' + F + 'px system-ui, "Segoe UI", sans-serif';
      x.font = font;
      var szer = Math.ceil(x.measureText(cz.nazwa).width) + pad * 2, wys = F + 16;
      c.width = szer; c.height = wys; x = c.getContext('2d'); x.font = font;
      x.fillStyle = 'rgba(8,11,15,0.62)'; x.fillRect(0, 0, szer, wys);
      x.fillStyle = '#e9eef3'; x.textBaseline = 'middle'; x.fillText(cz.nazwa, pad, wys / 2 + 1);
      var tEt = z(new T.CanvasTexture(c)); tEt.encoding = T.sRGBEncoding; tEt.minFilter = T.LinearFilter; tEt.generateMipmaps = false;
      var etykieta = new T.Sprite(z(new T.SpriteMaterial({ map: tEt, sizeAttenuation: false, depthTest: false, fog: false, toneMapped: false })));
      etykieta.center.set(0.5, -0.55); etykieta.renderOrder = 12; etykieta.userData.id = cz.id;
      var gLin = z(new T.BufferGeometry());
      gLin.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
      var szpilka = new T.Line(gLin, z(new T.LineBasicMaterial({ color: 0xe9eef3, transparent: true, opacity: 0.75, fog: false, toneMapped: false })));
      szpilka.frustumCulled = false; szpilka.renderOrder = 10;
      g.add(szpilka); g.add(glowa); g.add(etykieta);
      // priorytet etykiety: stratowulkany przed resztą, wśród nich wyższy pierwszy (Teide przed Pico Viejo), dalej zasięg
      var waga = (cz.rodzaj === 'stratowulkan' ? 1000 + (cz.wys_m || 0) / 10 : 0) + (cz.promien_km || 0);
      g.userData.pin = { x: p[0], z: p[1], glowa: glowa, etykieta: etykieta, szpilka: szpilka, px: [szer, wys], waga: waga, dl: 1,
        swiat: new T.Vector3(), q: { x: 0, y: 0, z: 0 }, widoczna: false };
      grupaCzesci.add(g);
      czesci[cz.id] = g; piny.push(g);
    });
    piny.sort(function (a, b) { return b.userData.pin.waga - a.userData.pin.waga; });
    var podswietlona = null, najechana = null, zajete = new Float64Array(piny.length * 8), rozm = new T.Vector2();
    var warstwy = [], przygaszenie = 1;

    function ustawPin(g) {
      var P = g.userData.pin, y0 = (wysokoscKm(P.x, P.z) || 0) * e;
      g.position.set(P.x, y0, P.z);
      P.glowa.position.set(0, P.dl, 0); P.etykieta.position.set(0, P.dl, 0);
      var a = P.szpilka.geometry.attributes.position;
      a.array[4] = P.dl; a.needsUpdate = true;
    }
    function ustawPiny() { piny.forEach(ustawPin); }
    ustawPiny();

    // --- przekrój: płaszczyzna, ściana-zaślepka ---
    var tz = dane.czesci && dane.czesci.filter(function (c) { return c.id === 'teide'; })[0];
    var srodekPrzekroju = tz ? Teren.doLokalnych(siatka, tz.lonLat[0], tz.lonLat[1]) : [0, 0];
    var przek = null, sciana = null;
    // pokaz (recenzja kinowa r1, C4 — decyzja właściciela P12): podpisy warstw jako nakładki ekranowe, nie tekst w teksturze
    // (tekst w kilometrach świata rósł z dojazdem do 6,4% wysokości kadru). Bez podpisów ściana zostawia kotwice: punkty
    // środka pasm (świat: x, z, y w km bez przewyższenia) — pokaz wybiera z nich te w widocznej części kadru.
    var podpisyNaScianie = true, kotwiceSciany = [];
    function krotkaNazwa(n) { return String(n).replace(/\s*\(.*\)$/, '').replace(/:.*$/, ''); }
    function zwolnijSciane() {
      if (!sciana) return;
      scena.remove(sciana);
      sciana.geometry.dispose(); sciana.material.map.dispose(); sciana.material.dispose();
      sciana = null;
    }
    function rysujSciane(L, probki, profil) {
      var W = 2048, H = 1024, c = plotno(W, H), x = c.getContext('2d');
      var yNaPx = function (yKm) { return (GORA_SCIANY_KM - yKm) / (GORA_SCIANY_KM - DNO_KM) * H; };
      var warstwy = (dane.warstwy || []).slice();
      var kolory = { skorupa: '#4a4f5c', osad: '#8c8374', gmach: '#9a5b34', tarcza: '#5a72b8', stratowulkan: '#b8322a', komora: '#e0662e' };
      var kolWarstwy = function (w) {
        if (w.id === 'w-kompleks-podmorski') return '#5e6f74';
        if (w.id === 'w-gmach-canadas') return '#a8744c';
        return kolory[w.skala] || '#777777';
      };
      var tePos = srodekPrzekroju;
      // pozioma odległość punktu przekroju od Teide (stożek i zbiornik tylko przy nim — schemat)
      var dT = probki.map(function (p) { return Math.hypot(p.x - tePos[0], p.z - tePos[1]); });
      x.clearRect(0, 0, W, H);
      for (var px = 0; px < W; px++) {
        var k = Math.min(probki.length - 1, Math.round(px / (W - 1) * (probki.length - 1))), p = probki[k], pow = p.h;
        var yPow = yNaPx(pow);
        // słup wody nad dnem (przekrój przez morze)
        if (pow < 0) { x.fillStyle = '#16405e'; x.fillRect(px, yNaPx(0), 1, yPow - yNaPx(0) + 1); }
        for (var q = 0; q < warstwy.length; q++) {
          var w = warstwy[q], gor = -w.doGlebokosci_m / 1000, dol = -w.odGlebokosci_m / 1000;
          if (w.skala === 'stratowulkan') { if (dT[k] > 6.5) continue; }
          if (w.skala === 'komora') {
            var r = 5, t = dT[k] / r; if (t >= 1) continue;
            var sr = (gor + dol) / 2, pol = (gor - dol) / 2 * Math.sqrt(1 - t * t); gor = sr + pol; dol = sr - pol;
          }
          var g2 = Math.min(gor, pow);
          if (g2 <= dol) continue;
          var odsl = odslonWarstwy ? odslonWarstwy(w.id) : 1;
          // warstwa jeszcze nie nazwana: barwa w 25% krycia na ciemnej ścianie (recenzja kinowa r1, I14 — ściana nie jest pustą
          // płytą przez 20 s; pełne krycie i podpis na swoim wersie)
          if (!(odsl > 0.5)) { x.fillStyle = '#23272d'; x.fillRect(px, yNaPx(g2), 1, yNaPx(dol) - yNaPx(g2) + 1); x.globalAlpha = 0.25; x.fillStyle = kolWarstwy(w); x.fillRect(px, yNaPx(g2), 1, yNaPx(dol) - yNaPx(g2) + 1); x.globalAlpha = 1; continue; }
          x.fillStyle = kolWarstwy(w);
          x.fillRect(px, yNaPx(g2), 1, yNaPx(dol) - yNaPx(g2) + 1);
          // granice schematu: przerywane (niska pewność — kreska rzadsza)
          var kres = w.pewnosc === 'niska' ? (px % 30) < 12 : (px % 20) < 13;
          x.fillStyle = 'rgba(240,236,226,0.85)';
          if (kres && gor < pow - 0.05) x.fillRect(px, yNaPx(gor) - 1, 1, 3);
          if (kres) x.fillRect(px, yNaPx(dol) - 1, 1, 3);
        }
        // profil powierzchni z danych: linia ciągła
        x.fillStyle = '#fff6e0'; x.fillRect(px, yPow - 2, 1, 5);
      }
      // podpisy (kompensacja rozciągnięcia przez przewyższenie i proporcje ściany)
      var kmPxX = L / W, kmPxY = (GORA_SCIANY_KM - DNO_KM) * e / H, sy = kmPxX / kmPxY;
      function napis(tekst, xPx, yPx, rozmKm, kolor, wyr) {
        var f = Math.max(10, Math.round(rozmKm / kmPxX));
        x.save(); x.translate(xPx, yPx); x.scale(1, sy);
        x.font = '700 ' + f + 'px system-ui, "Segoe UI", sans-serif'; x.textAlign = wyr || 'left'; x.textBaseline = 'middle';
        x.lineWidth = Math.max(2, f / 6); x.strokeStyle = 'rgba(8,11,15,0.75)'; x.strokeText(tekst, 0, 0);
        x.fillStyle = kolor || '#f4efe6'; x.fillText(tekst, 0, 0);
        x.restore();
      }
      var rozm = Math.max(0.8, L / 95), wysNapisu = rozm / kmPxX * sy;   // wysokość napisu w px płótna
      var kMax = 0; probki.forEach(function (p, i) { if (p.h > probki[kMax].h) kMax = i; });
      kotwiceSciany = [];
      if (!podpisyNaScianie) {
        // kotwice pasm: co ok. 1 km wzdłuż ściany, gdzie pasmo ma ≥ 0,25 km grubości (poza stożkiem Teide); stożek i
        // zbiornik — w próbce najbliższej Teide
        var kT = 0; dT.forEach(function (d, i) { if (d < dT[kT]) kT = i; });
        var krok = Math.max(1, Math.round(probki.length / (L / 1.0)));
        warstwy.forEach(function (w) {
          var gor = -w.doGlebokosci_m / 1000, dol = -w.odGlebokosci_m / 1000, pk = [];
          if (w.skala === 'stratowulkan' || w.skala === 'komora') {
            var p = probki[kT], g = Math.min(gor, p.h);
            if (g > dol) pk.push([p.x, (g + dol) / 2, p.z]);
          } else for (var i = 0; i < probki.length; i += krok) {
            if (dT[i] < 7.5) continue;
            var g2 = Math.min(gor, probki[i].h);
            if (g2 - dol >= 0.25) pk.push([probki[i].x, g2 - Math.min(0.35 * (g2 - dol), 0.5), probki[i].z]);   // górna część pasma (napis nad kropką)
          }
          if (pk.length) kotwiceSciany.push({ id: w.id, tekst: krotkaNazwa(w.nazwa), pewnosc: w.pewnosc, punkty: pk });
        });
        kotwiceSciany.push({ id: 'profil', tekst: 'profil: dane', punkty: [[probki[kMax].x, probki[kMax].h, probki[kMax].z]] });
        var t0 = new T.CanvasTexture(c); t0.encoding = T.sRGBEncoding; t0.anisotropy = 4;
        return t0;
      }
      napis('SCHEMAT — wnętrze z danych warstw', 18, H - wysNapisu * 0.9, rozm * 1.1, '#ffd9a8');
      // „profil: dane” w słupie wody nad najgłębszym dnem przy końcu linii (nad profilem ściany już nie ma)
      var kDno = -1;
      probki.forEach(function (p, i) { var f = i / (probki.length - 1); if ((f < 0.3 || f > 0.7) && p.h < 0 && (kDno < 0 || p.h < probki[kDno].h)) kDno = i; });
      if (kDno >= 0 && -probki[kDno].h / kmPxY * e > 2.2 * wysNapisu) {
        var fx = Math.max(0.08, Math.min(0.92, kDno / (probki.length - 1)));
        napis('profil: dane', fx * W, yNaPx(probki[kDno].h / 2), rozm, '#fff6e0', 'center');
      } else napis('profil: dane', kMax / (probki.length - 1) * W, yNaPx(probki[kMax].h) + wysNapisu * 1.6, rozm, '#fff6e0', 'center');
      warstwy.forEach(function (w) {
        if (w.skala === 'stratowulkan' || w.skala === 'komora') return;
        if (odslonWarstwy && !(odslonWarstwy(w.id) > 0.5)) return;
        // miejsce podpisu: najgrubsze pasmo, z lekką preferencją środka ściany (podpis nie ucieka na brzeg kadru)
        var gor = -w.doGlebokosci_m / 1000, dol = -w.odGlebokosci_m / 1000, best = -1, bi = 0, ocena = -Infinity;
        for (var i = 0; i < probki.length; i += 4) {
          if (dT[i] < 7.5) continue;                                         // nie pod stożkiem Teide (nakładka schematu)
          var gr = Math.min(gor, probki[i].h) - dol, o = gr - 0.6 * (gor - dol) * Math.abs(i / (probki.length - 1) - 0.5);
          if (o > ocena) { ocena = o; best = gr; bi = i; }
        }
        if (best / kmPxY * e < 1.8 * wysNapisu) return;                    // pasmo za cienkie na podpis
        var tekst = w.nazwa.replace(/\s*\(.*\)$/, '') + (w.pewnosc === 'niska' ? ' · głębokość szacowana' : '');
        napis(tekst, bi / (probki.length - 1) * W, yNaPx(dol + Math.min(best, gor - dol) / 2), rozm * 0.8, '#f4efe6', 'center');
      });
      var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4;
      return t;
    }
    function zbudujSciane(L) {
      zwolnijSciane();
      var n = Math.max(2, Math.min(3000, Math.round(L.dl / 0.05) + 1)), probki = [];
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1), x = L.a[0] + (L.b[0] - L.a[0]) * t, zz = L.a[1] + (L.b[1] - L.a[1]) * t, h = wysokoscKm(x, zz);
        probki.push({ x: x, z: zz, h: h == null ? -4 : h });
      }
      var pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = [];
      for (i = 0; i < n; i++) {
        var p = probki[i], gora = Math.max(p.h, 0), u = i / (n - 1);
        pos.set([p.x, gora, p.z, p.x, DNO_KM, p.z], i * 6);
        uv.set([u, (gora - DNO_KM) / (GORA_SCIANY_KM - DNO_KM), u, 0], i * 4);
        if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx);
      g.computeBoundingSphere();
      sciana = new T.Mesh(g, new T.MeshBasicMaterial({ map: rysujSciane(L.dl, probki), side: T.DoubleSide, fog: false, toneMapped: false,
        clippingPlanes: ostrzeSciany ? [ostrzeSciany] : null }));
      sciana.scale.y = e; sciana.name = 'przekroj'; sciana.userData.probki = probki; sciana.userData.L = L;
      scena.add(sciana);
    }
    function przekroj(arg) {
      if (!arg) {
        przek = null; zwolnijSciane();
        plaszczyzna.set(new T.Vector3(0, 1, 0), 1e7);
        if (arch) arch.mesh.visible = !blokWl;
        uWoda.uTylkoKafel.value = blokWl ? 1 : 0;
        niebo();
        renderer.shadowMap.needsUpdate = true;
        widocznoscPinow();
        return null;
      }
      var kat = ((+arg.kat_st || 0) % 180 + 180) % 180, prz = +arg.przesuniecie_km || 0;
      var L = liniaPrzekroju(wyspa.prost, srodekPrzekroju, kat, prz);
      if (!L) return null;
      przek = { kat_st: kat, przesuniecie_km: prz, linia: L };
      // zachowana strona: n·(p − punkt) ≤ 0 (usuwana jest strona normalnej — tam stoi widz)
      plaszczyzna.set(new T.Vector3(-L.normalna[0], 0, -L.normalna[1]), L.normalna[0] * L.punkt[0] + L.normalna[1] * L.punkt[1]);
      if (arch) arch.mesh.visible = false;
      uWoda.uTylkoKafel.value = 1;
      zbudujSciane(L);
      niebo();
      renderer.shadowMap.needsUpdate = true;
      widocznoscPinow();
      var aLL = Teren.zLokalnych(siatka, L.a[0], L.a[1]), bLL = Teren.zLokalnych(siatka, L.b[0], L.b[1]);
      var profil = Teren.profil(siatka, aLL, bLL, Math.max(2, Math.round(L.dl / 0.05) + 1));
      var maks = -Infinity; profil.forEach(function (p) { if (p.h != null && p.h > maks) maks = p.h; });
      profil.kat_st = kat; profil.przesuniecie_km = prz; profil.maks_m = maks; profil.dl_km = L.dl;
      profil.a = aLL; profil.b = bLL;
      przek.profil = profil;
      return profil;
    }
    function widocznoscPinow() {
      piny.forEach(function (g) {
        var P = g.userData.pin;
        g.visible = !przek || (P.x - przek.linia.punkt[0]) * przek.linia.normalna[0] + (P.z - przek.linia.punkt[1]) * przek.linia.normalna[1] <= 0;
      });
    }

    // --- światło i niebo ---
    // sw.p = preset pory z nałożonym `dostroj` (makieta, Task 8e: pogoda i minimum nocy); pokaz woła bez dostroj — sam preset
    var sw = { pora: 'dzien', az: 250, el: 30, dostroj: null, p: PORY.dzien }, kier = new T.Vector3();
    function niebo() {
      var p = sw.p || PORY.dzien, nz = przek || blokWl ? NIEBO_PRZEKROJU : p;
      var cz = new T.Color(nz.zenit).multiplyScalar(jasnNieba), ch = new T.Color(nz.horyzont).multiplyScalar(jasnNieba), ct = new T.Color(p.tarcza);
      uNiebo.uZenit.value.set(cz.r, cz.g, cz.b); uNiebo.uHoryzont.value.set(ch.r, ch.g, ch.b);
      uNiebo.uKolorTarczy.value.set(ct.r, ct.g, ct.b); uNiebo.uTarcza.value = przek || blokWl ? 0 : p.moc;
      scena.fog.color.copy(ch);
      tlo.copy(ch);
      renderer.setClearColor(ch, 1);
      UM.uMgielkaKol.value.set(ch.r, ch.g, ch.b); UM.uMgielkaKolR.value.set(cz.r, cz.g, cz.b);
      var zl = cz.clone().convertSRGBToLinear(), hl = ch.clone().convertSRGBToLinear();
      uWoda.uZenitL.value.set(zl.r, zl.g, zl.b); uWoda.uHoryzontL.value.set(hl.r, hl.g, hl.b);
    }
    function swiatlo(a) {
      a = a || {};
      if (a.pora && PORY[a.pora]) sw.pora = a.pora;
      if (a.az != null) sw.az = +a.az;
      if (a.el != null) sw.el = +a.el;
      // dostroj (makieta): pola presetu nadpisane na to wywołanie i następne klatki; wywołanie bez dostroj = sam preset
      sw.dostroj = a.dostroj || null;
      sw.p = sw.dostroj ? Object.assign({}, PORY[sw.pora], sw.dostroj) : PORY[sw.pora];
      var p = sw.p, d = kierunekSlonca(sw.az, sw.el);
      kier.set(d[0], d[1], d[2]);
      klucz.position.set(d[0] * 300, d[1] * 300, d[2] * 300); klucz.target.position.set(0, 0, 0);
      klucz.target.updateMatrixWorld();
      klucz.color.set(p.klucz); klucz.intensity = p.k;
      wypelnienie.color.set(p.wyp); wypelnienie.groundColor.set(p.wyp); wypelnienie.intensity = p.f;
      uNiebo.uSlonce.value.copy(kier); uWoda.uSlonce.value.copy(kier); UF.uSlonceKier.value.copy(kier);
      UH.uSlonceAzEl.value.set(sw.az * RAD, sw.el * RAD);
      var kl = new T.Color(p.klucz), kw = new T.Color(p.wyp);
      // te same jednostki co w MeshStandardMaterial bez fizycznych świateł: blask = barwa · moc (π się skraca)
      uWoda.uKolorSlonca.value.set(kl.r * p.k, kl.g * p.k, kl.b * p.k);
      uWoda.uAmb.value.set(kw.r * p.f, kw.g * p.f, kw.b * p.f);
      // morze chmur makiety: UniformsUtils.merge sklonował uniformy (amb 0,5, słońce 1, kierunek w zenicie) i przy nich
      // warstwę strojono — skala względem światła domyślnego (dzień, el 30°): przy nim wartości bez zmian, nocą chmury gasną
      var D0 = PORY.dzien, kd0 = new T.Color(D0.klucz), wd0 = new T.Color(D0.wyp);
      uChmury.uAmb.value.set(0.5 * kw.r * p.f / (wd0.r * D0.f), 0.5 * kw.g * p.f / (wd0.g * D0.f), 0.5 * kw.b * p.f / (wd0.b * D0.f));
      uChmury.uKolorSlonca.value.set(kl.r * p.k / (kd0.r * D0.k), kl.g * p.k / (kd0.g * D0.k), kl.b * p.k / (kd0.b * D0.k));
      uChmury.uSlonce.value.set(0, Math.min(1, d[1] / 0.5), 0);      // wyżej niż 30° warstwa przycinałaby się do bieli
      jasnWody = p.f * 1.4 + p.k * Math.max(d[1], 0) * 0.3;
      // smugi (A2): jasność światła względem stałego dnia makiety (el 30°) — w dzień 1, nocą gasną razem z rzeźbą
      if (uWiatr) uWiatr.uJasn.value = Math.min(1, (p.f + p.k * Math.max(d[1], 0)) / (PORY.dzien.f + PORY.dzien.k * 0.5));
      U.uKolorWody.value.copy(new T.Color(kolorWody).convertSRGBToLinear()).multiplyScalar(jasnWody);
      niebo();
      renderer.shadowMap.needsUpdate = true;
      return { pora: sw.pora, az: sw.az, el: sw.el };
    }
    swiatlo({});

    // przewyzszenie(x, wTrakcie): w trakcie animowanej zmiany ściana przekroju tylko się skaluje (napisy przelicza
    // przebudowa po ostatnim kroku — wTrakcie = false/undefined)
    function przewyzszenie(x, wTrakcie) {
      if (x == null) return e;
      e = Math.max(0.5, Math.min(5, +x || 1));
      U.uPrzew.value = e; UM.uMgPrzew.value = e;
      U.uKrokSklejki.value = krokSklejki(e);         // warstwy sklejki zgodne ze skalą Y przy każdej zmianie (także w animacji)
      [arch, wyspa].concat(wstawki).forEach(function (P) { if (P) P.mesh.scale.y = e; });
      chmuryMesh.position.y = STROP_CHMUR_KM * e;
      if (grupaWiatru) grupaWiatru.scale.y = e;      // smugi nad rzeźbą przy każdej skali Y (także w animowanej zmianie)
      UF.uStropA4.value = stropA4 * e;
      ustawPiny();
      if (sciana && przek) { if (wTrakcie) sciana.scale.y = e; else zbudujSciane(przek.linia); }
      renderer.shadowMap.needsUpdate = true;
      return e;
    }

    // --- wskazywanie ---
    var rc = new T.Raycaster(), ndc = new T.Vector2(), wek = new T.Vector3();
    // rzut na ekran do q (px kanwy) — bez alokacji; rozm = rozmiar kanwy odczytany raz na klatkę/zdarzenie
    function rzutPx(v, q) {
      wek.copy(v).project(kamera);
      q.x = (wek.x + 1) / 2 * rozm.x; q.y = (1 - wek.y) / 2 * rozm.y; q.z = wek.z;
      return q;
    }
    function glowaSwiat(g) { return g.userData.pin.swiat.copy(g.position).add(g.userData.pin.glowa.position); }
    function pick(nx, ny) {
      ndc.set(nx, ny);
      kamera.updateMatrixWorld();
      rc.setFromCamera(ndc, kamera);
      var cele = [];
      piny.forEach(function (g) {
        if (!g.visible) return;
        cele.push(g.userData.pin.glowa);
        if (g.userData.pin.widoczna) cele.push(g.userData.pin.etykieta);
      });
      renderer.getSize(rozm);
      var hity = rc.intersectObjects(cele, false), kx = (nx + 1) / 2 * rozm.x, ky = (1 - ny) / 2 * rozm.y, najl = null, dMin = Infinity;
      function kandydat(id) {
        var P = czesci[id].userData.pin, q = rzutPx(glowaSwiat(czesci[id]), P.q), d = Math.hypot(q.x - kx, q.y - ky);
        if (q.z < 1 && d < dMin) { dMin = d; najl = id; }
      }
      hity.forEach(function (h) { kandydat(h.object.userData.id); });
      if (najl) return najl;
      // tolerancja: kropka w promieniu 12 px (palec, mała kropka)
      piny.forEach(function (g) { if (g.visible) kandydat(g.userData.id); });
      return dMin <= 12 ? najl : null;
    }
    // Dwa style: wybrana część (karta otwarta) — biała, większa kropka i ciepła etykieta; najechana kursorem — jaśniejsza
    // kropka. Najechanie nie zabiera wyróżnienia wybranej.
    function styl() {
      piny.forEach(function (g) {
        var id = g.userData.id, wyb = id === podswietlona, naj = id === najechana && !wyb;
        g.userData.pin.glowa.material.color.set(wyb ? 0xffffff : naj ? 0xffe3c2 : 0xffb36b);
        g.userData.pin.etykieta.material.color.set(wyb ? 0xffd9a8 : naj ? 0xfff3e4 : 0xffffff);
      });
    }
    function podswietl(id) { podswietlona = id && czesci[id] ? id : null; styl(); }
    function najedz(id) { var n = id && czesci[id] ? id : null; if (n !== najechana) { najechana = n; styl(); } }
    function kotwica(id) {
      var g = czesci[id];
      if (!g) return null;
      ustawPin(g);
      return glowaSwiat(g).toArray();      // toArray alokuje — kotwica to API zdarzeń/sondy, nie klatki
    }
    function trafiaSciane(nx, ny) {
      if (!sciana) return false;
      ndc.set(nx, ny); rc.setFromCamera(ndc, kamera);
      return rc.intersectObject(sciana, false).length > 0;
    }
    function punktNaMorzu(nx, ny) {
      ndc.set(nx, ny); rc.setFromCamera(ndc, kamera);
      var pt = new T.Vector3();
      return rc.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), pt) ? [pt.x, pt.z] : null;
    }
    // Pejzaż dźwiękowy i stuknięcie (Task B3). punktNaTerenie: ląd pod punktem ekranu (marsz promienia po wysokosc() —
    // przy czasie geologicznym po rzeźbie chwili; GeologiaPejzaz.punktNaTerenie, ≤ 64 odczyty) albo null (morze, niebo).
    // yMax 5 km × przewyższenie: nad dzisiejszy szczyt i nad gmach Las Cañadas sprzed zapadnięcia.
    function punktNaTerenie(nx, ny) {
      ndc.set(nx, ny); kamera.updateMatrixWorld(); rc.setFromCamera(ndc, kamera);
      var o = rc.ray.origin, d = rc.ray.direction;
      var p = Pejzaz.punktNaTerenie([o.x, o.y, o.z], [d.x, d.y, d.z], wysokosc, { yMax: 5 * e, maxKm: kamera.far });
      return p ? [p[0], p[2]] : null;
    }
    function komorka(P, x, zz) {
      var ix = Math.max(0, Math.min(P.w - 1, Math.round((x - P.x0) / P.dx))), iy = Math.max(0, Math.min(P.h - 1, Math.round((zz - P.z0) / P.dz)));
      return iy * P.w + ix;
    }
    // jednostka geologiczna pod punktem (indeksy wstawki, potem wyspy) — mapa opisuje DZISIEJSZĄ powierzchnię, więc przy
    // czasie geologicznym (Ma > 0) null: stuknięcie bierze wtedy brzmienie domyślne
    function jednostkaPod(x, zz) {
      if (ewo.Ma > 0) return null;
      var P = null;
      for (var k = 0; k < wstawki.length && !P; k++) if (wstawki[k].indeksy && wewnatrz(wstawki[k].prost, x, zz)) P = wstawki[k];
      if (!P && wewnatrz(wyspa.prost, x, zz)) P = wyspa;
      if (!P || !P.indeksy) return null;
      var j = P.indeksy[komorka(P, x, zz)];
      return j && jednostki[j - 1] ? jednostki[j - 1].id : null;
    }
    // pierścień stuknięcia: tSek na zegarze animuj(t); gaśnie po 1,2 s (animuj zeruje uStuk.w)
    function stuk(x, zz, tSek) {
      U.uStuk.value.set(x, zz, +tSek || 0, 1);
      U.uCzasStuk.value = +tSek || 0;
      return true;
    }
    // odległość od brzegu dla komórek LĄDU (P.odl ma ją tylko na morzu) — liczona raz, przy pierwszej próbce pejzażu
    function odlLadu(P) {
      if (!P.odlLad) {
        var w = P.s.wys, inv = new Float32Array(w.length);
        for (var i = 0; i < w.length; i++) inv[i] = w[i] > 0 ? -1 : 1;
        P.odlLad = odlegloscOdBrzegu(inv, P.w, P.h, P.dx, P.dz);
      }
      return P.odlLad;
    }
    // próbka miejsca dla GeologiaPejzaz.poziomy: morze / ląd i wysokość z rysowanej powierzchni (rzeźba chwili), odległość
    // od brzegu i ekspozycja na falę z dzisiejszej siatki (pole fal A1, kanał B P.poleFal — bez przeliczania); wyspa, potem
    // archipelag, poza nimi ekspozycja 0 i brzeg daleko. Gdy rzeźba chwili i dzisiejsza nie zgadzają się (ląd / morze),
    // punkt leży na brzegu chwili — odległość 0.
    function probkaPejzazu(x, zz) {
      var hk = wysokoscKm(x, zz), w = { naMorzu: !(hk > 0), odlBrzeguKm: 1e9, wysM: hk == null ? 0 : hk * 1000, ekspozycja: 0 };
      var P = wewnatrz(wyspa.prost, x, zz) ? wyspa : arch && wewnatrz(arch.prost, x, zz) ? arch : null;
      if (!P) return w;
      var i = komorka(P, x, zz), lad = P.s.wys[i] > 0;
      w.odlBrzeguKm = lad !== !w.naMorzu ? 0 : lad ? odlLadu(P)[i] : P.odl[i];
      if (P.poleFal) w.ekspozycja = P.poleFal[i * 4 + 2] / 255;
      return w;
    }

    // Próbka światła w punkcie (pomiar sondy): normalna wyświetlanej powierzchni (z przewyższeniem), N·L i cień rzucany
    // (marsz promienia ku słońcu po wysokościach).
    function probkaSwiatla(x, zz) {
      var h = wysokosc(x, zz);
      if (h == null) return null;
      var d = 0.06, hx = (wysokosc(x + d, zz) - wysokosc(x - d, zz)) / (2 * d), hz = (wysokosc(x, zz + d) - wysokosc(x, zz - d)) / (2 * d);
      var n = new T.Vector3(-hx, 1, -hz).normalize(), nl = n.dot(kier), cien = nl <= 0;
      for (var t = 0.2; !cien && t < 90; t *= 1.08) {
        var px = x + kier.x * t, pz = zz + kier.z * t, py = h + kier.y * t, hh = wysokosc(px, pz);
        if (hh == null) break;
        if (hh > py + 0.01) cien = true;
        if (py > 4 * e + 0.5) break;
      }
      return { y: h, n: n.toArray(), nl: nl, cien: cien };
    }

    // --- klatka ---
    var czas = 0, Rdysku = 400, osKam = new T.Vector3();
    function animuj(t) {
      czas = t || 0;
      if (U.uStuk.value.w > 0.5) {                     // pierścień stuknięcia (B3): 1,2 s, potem gałąź wyłączona
        U.uCzasStuk.value = czas;
        if (czas - U.uStuk.value.z > 1.2 || czas < U.uStuk.value.z - 0.5) U.uStuk.value.w = 0;
      }
      uWoda.uCzas.value = czas; uChmury.uCzas.value = czas;
      if (uWiatr) uWiatr.uCzas.value = czas;
      kamera.updateMatrixWorld();
      var cp = kamera.position, hTer = wysokosc(cp.x, cp.z), nad = cp.y - Math.max(0, hTer == null ? 0 : hTer);
      // dysk oceanu i mgła rosną z wysokością kamery: 400 km do 16 km wysokości, wyżej 25 × wysokość
      Rdysku = Math.max(400, 25 * Math.max(cp.y, 0));
      ocean.position.set(cp.x, 0, cp.z); ocean.scale.set(Rdysku * 1.02, Rdysku * 1.02, 1);
      scena.fog.near = Rdysku * 0.6; scena.fog.far = Rdysku;
      var mg = sw.p && sw.p.mgla, mw = sw.p && sw.p.mglaWzgl;
      if (mg) { scena.fog.near = Math.min(scena.fog.near, mg[0]); scena.fog.far = Math.min(scena.fog.far, mg[1]); }
      else if (mw) {
        // mgła względna (makieta, Task 8e): odległości × droga promienia osi kamery do poziomu morza — ta sama gęstość
        // w każdym kadrze, od zbliżenia po całą wyspę
        kamera.getWorldDirection(osKam);
        var dO = osKam.y < -0.05 ? Math.max(cp.y, 0.05) / -osKam.y : Rdysku * 0.25;
        scena.fog.near = Math.min(scena.fog.near, mw[0] * dO); scena.fog.far = Math.min(scena.fog.far, mw[1] * dO);
      }
      kopula.position.copy(cp); kopula.scale.setScalar(Rdysku * 1.2);
      var near = Math.max(0.01, Math.min(5, Math.max(nad, 0.04) * 0.25)), far = Rdysku * 1.3;
      if (Math.abs(kamera.near - near) > 1e-4 || Math.abs(kamera.far - far) > 1e-3) { kamera.near = near; kamera.far = far; kamera.updateProjectionMatrix(); }
      // piny: długość szpilki z odległości kamery, stała wielkość na ekranie, rozrzedzanie etykiet
      renderer.getSize(rozm);
      var k = 2 * Math.tan(kamera.fov * RAD / 2) / Math.max(1, rozm.y);
      for (var a = 0; a < piny.length; a++) {
        var g = piny[a], P = g.userData.pin, d = Math.hypot(cp.x - P.x, cp.y - g.position.y, cp.z - P.z), dl = Math.max(0.05, Math.min(4, d * 0.012));
        if (Math.abs(dl - P.dl) > 1e-3 * dl) { P.dl = dl; ustawPin(g); }
        var s = (g.userData.id === podswietlona ? 20 : g.userData.id === najechana ? 17 : 14) * k;
        P.glowa.scale.set(s, s, 1);
        P.etykieta.scale.set(P.px[0] * SKALA_ETYKIETY * k, P.px[1] * SKALA_ETYKIETY * k, 1);
      }
      // warstwy nakładane (Task 7b): ich etykiety i piny mają pierwszeństwo — zajmują miejsce przed etykietami części
      var nz = 0, wyb = podswietlona ? czesci[podswietlona] : null;
      for (var iw = 0; iw < warstwy.length; iw++) {
        var zw = warstwy[iw].animuj ? warstwy[iw].animuj() : null;
        if (!zw || !zw.length) continue;
        if (zajete.length < (nz + piny.length * 2) * 4 + zw.length) { var zn = new Float64Array((nz + piny.length * 2) * 4 + zw.length * 2); zn.set(zajete.subarray(0, nz * 4)); zajete = zn; }
        zajete.set(zw, nz * 4); nz += zw.length / 4;
      }
      // rozrzedzanie etykiet w kolejności priorytetu (wybrana część pierwsza); zajęte są etykiety I kropki pinów
      // o wyższym priorytecie — etykieta Pico Viejo nie przykryje kropki Teide
      // wąski ekran (telefon): najwyżej 4 etykiety części naraz (recenzja kinowa r1, I12c)
      var ileEt = 0, maksEt = rozm.x < 600 ? 4 : Infinity;
      for (a = -1; a < piny.length; a++) {
        g = a < 0 ? wyb : piny[a];
        if (!g || (a >= 0 && g === wyb)) continue;
        P = g.userData.pin;
        if (!g.visible) { P.etykieta.visible = P.widoczna = false; continue; }
        var q = rzutPx(glowaSwiat(g), P.q), w = P.px[0] * SKALA_ETYKIETY, h = P.px[1] * SKALA_ETYKIETY, r0 = (g.userData.id === podswietlona ? 20 : g.userData.id === najechana ? 17 : 14) / 2 + 2;
        var x0 = q.x - w / 2, y1 = q.y - 0.55 * h - 6, y0 = y1 - h, ok = q.z < 1 && q.x > -w && q.x < rozm.x + w && q.y > 0 && q.y < rozm.y + h;
        for (var i = 0; ok && i < nz; i++) {
          var b = i * 4;
          if (x0 < zajete[b + 2] && x0 + w > zajete[b] && y0 < zajete[b + 3] && y1 > zajete[b + 1]) ok = false;
        }
        if (ok && g !== wyb && ileEt >= maksEt) ok = false;
        if (ok) ileEt++;
        P.etykieta.visible = P.widoczna = ok;
        if (q.z < 1) { zajete[nz * 4] = q.x - r0; zajete[nz * 4 + 1] = q.y - r0; zajete[nz * 4 + 2] = q.x + r0; zajete[nz * 4 + 3] = q.y + r0; nz++; }
        if (ok) { zajete[nz * 4] = x0 - 4; zajete[nz * 4 + 1] = y0 - 2; zajete[nz * 4 + 2] = x0 + w + 4; zajete[nz * 4 + 3] = y1 + 2; nz++; }
      }
    }

    // --- czas geologiczny (Task 7) ---
    // Przynależność, tekstury RGBA8 i parametry jednostek — leniwie, przy pierwszym czas(Ma > 0) (ok. 0,4 s; makieta „dziś”
    // nie płaci). Program cieniowania się nie zmienia: gałąź ewolucji była w nim od budowy, za uniformem.
    function przygotujEwolucje() {
      if (ewo.gotowa) return;
      ewo.gotowa = true;
      [wyspa].concat(wstawki).forEach(function (P) {
        // wstawki: przynależność z pola wyspy (granice i mieszanie widziane poza prostokątem wstawki — bez szwu)
        P.przyn = P === wyspa ? Ew.przynaleznosc(P.s, jednostki, { pip: pip }) : Ew.przynaleznoscWstawki(P.s, wyspa.s, wyspa.przyn, jednostki, { pip: pip });
        var rgba = new Uint8Array(P.w * P.h * 4);
        for (var i = 0; i < P.w * P.h; i++) { rgba[i * 4] = P.przyn[i]; rgba[i * 4 + 1] = P.przyn.drugi[i]; rgba[i * 4 + 2] = P.przyn.waga[i]; rgba[i * 4 + 3] = P.przyn.brzeg[i]; }
        var t = z(new T.DataTexture(rgba, P.w, P.h, T.RGBAFormat, T.UnsignedByteType));
        t.magFilter = t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.unpackAlignment = 1; t.needsUpdate = true;
        P.tPrzyn = t;
        P.mat.userData.u.uPrzyn.value = t; P.mat.userData.u.uEwoAkt.value = 1;
      });
      uWoda.uPrzynW.value = wyspa.tPrzyn; uWoda.uEwoWoda.value = 1;
      ewo.P = Ew.parametry(wyspa.s, wyspa.przyn, jednostki).map(function (u) { var c = {}; for (var k in u) c[k] = u[k]; c.zapWyp0 = u.zapWyp; return c; });
      if (ewo.P.length > MAX_JEDN_GPU) console.error('Geologia: ' + ewo.P.length + ' jednostek — shader czasu geologicznego mieści ' + MAX_JEDN_GPU);
      ustawUniformyEwolucji();
    }
    function ustawUniformyEwolucji() {
      ewo.P.slice(0, MAX_JEDN_GPU).forEach(function (u, k) {
        var c = u.centrum ? Teren.doLokalnych(null, u.centrum[0], u.centrum[1]) : [0, 0];
        UE.uEwoO.value[k].set(u.od, u.do, u.zapMa == null ? -1 : u.zapMa, u.zapWyp);
        UE.uEwoP.value[k].set(u.pod, u.podWys, u.R_km || 1, u.centrum ? 1 : 0);
        UE.uEwoC.value[k].set(c[0], c[1]);
      });
    }
    function czasGeo(Ma) {   // (nazwa: `czas` w tej funkcji to zegar animacji wody i chmur)
      if (Ma == null) return ewo.Ma;
      Ma = Math.max(0, +Ma || 0);
      if (Ma === ewo.Ma) return Ma;
      if (Ma > 0) przygotujEwolucje();
      ewo.Ma = Ma; UE.uEwoMa.value = Ma;
      cienieHorAkt(); wiatrAkt(); kurzAkt();
      ustawPiny();
      if (sciana && przek) zbudujSciane(przek.linia);
      renderer.shadowMap.needsUpdate = true;
      return Ma;
    }
    // Haki animacji (geologia/animacje.js): łuna lawy w shaderze terenu, żar A1, cień chmur A4, wypełnienie zbocza (A3).
    var stropA4 = 1.3;
    var efekty = {
      // punkty: [[x, z]] (km, układ makiety) płonącej części toru, kolor: [r, g, b] liniowo (moc w barwie), zasieg_km
      luna: function (punkty, kolor, zasieg_km) {
        var n = punkty ? Math.min(24, punkty.length) : 0;
        for (var i = 0; i < n; i++) UF.uLunaP.value[i].set(punkty[i][0], punkty[i][1]);
        UF.uLunaN.value = n >= 2 ? n : 0;
        if (kolor) UF.uLunaKolor.value.set(kolor[0], kolor[1], kolor[2]);
        UF.uLunaZasieg.value = zasieg_km || 0.3;
      },
      zar: function (moc) { UF.uZar.value = Math.max(0, +moc || 0); },
      cienChmur: function (moc, strop_km, czasS) {
        if (strop_km != null) stropA4 = strop_km;
        UF.uCienChmur.value = Math.max(0, Math.min(1, +moc || 0)); UF.uStropA4.value = stropA4 * e; UF.uCzasA4.value = czasS || 0;
      },
      // A3: mnożnik wypełnienia zbocza sprzed osuwiska (1 = całe, 0 = zsunięte) — GPU i CPU razem
      wypelnienie: function (id, mnoznik) {
        przygotujEwolucje();
        ewo.P.forEach(function (u) { if (u.id === id) u.zapWyp = u.zapWyp0 * Math.max(0, Math.min(1, mnoznik)); });
        ustawUniformyEwolucji();
        ustawPiny();
        renderer.shadowMap.needsUpdate = true;
      }
    };

    // Hak warstw (Task 7b): warstwa dostaje helper z() sceny (G-L) i wspólny uniform przewyższenia terenu.
    function dodajWarstwe(buduj) {
      var w = buduj({ T: T, scena: scena, z: z, kamera: kamera, renderer: renderer, wysokosc: wysokosc,
        przewyzszenie: function () { return e; }, uPrzew: U.uPrzew, czasMa: function () { return ewo.Ma; } });
      if (w) warstwy.push(w);
      return w;
    }
    // Krycie znaczników części (warstwa turystyczna przygasza etykiety geologiczne): 1 = pełne.
    function przygasCzesci(f) {
      przygaszenie = Math.max(0, Math.min(1, +f));
      piny.forEach(function (g) {
        var P = g.userData.pin;
        P.glowa.material.opacity = przygaszenie; P.etykieta.material.opacity = przygaszenie; P.szpilka.material.opacity = 0.75 * przygaszenie;
      });
      return przygaszenie;
    }


    /* ---------- pokaz (Task 8): poziom glob, przenikanie przez render target, blok, ostrze, odsłanianie ---------- */
    // Glob: kula 6371 km stycznie do układu makiety w Teren.SRODEK (środek kuli w (0, −R, 0), +x wschód, +y góra, +z południe).
    // Własna scena i kamera (near/far z odległości od kuli). Tekstura ta sama dla kuli i dalekiego lądu płaskiego oceanu.
    var glob = null, dalekiLadP = null;
    function obraz(url) {
      return new Promise(function (ok, zle) {
        var img = new Image();
        img.onload = function () { ok(img); };
        img.onerror = function () { zle(new Error('nie udało się wczytać ' + url)); };
        img.src = url;
      });
    }
    // Daleki ląd płaskiego oceanu (Afryka, Madera): kopia tekstury Ziemi 2048 × 1024 (ok. 20 km/teksel — ląd za mgłą
    // i z wysoka). Osobno od kuli: 8k próbkuje tylko kula, a kula żyje tylko w rozdziale z poziomem `glob`.
    function dalekiLad(url) {
      if (dalekiLadP) return dalekiLadP;
      dalekiLadP = obraz(url).then(function (img) {
        var pl = plotno(2048, 1024); pl.getContext('2d').drawImage(img, 0, 0, 2048, 1024);
        var tz = z(new T.CanvasTexture(pl));
        tz.minFilter = T.LinearMipmapLinearFilter; tz.magFilter = T.LinearFilter; tz.generateMipmaps = true;
        uWoda.uZiemia.value = tz; uWoda.uDaleko.value = 1;
        return true;
      });
      return dalekiLadP;
    }
    function zbudujGlob(url) {
      if (glob) return glob.gotowa;
      var sg = new T.Scene(), kg = new T.PerspectiveCamera(30, 1, 10, 1e5), wlasne = [];
      function zg(x) { wlasne.push(x); return z(x); }
      var tex = zg(new T.Texture());
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
      tex.minFilter = T.LinearMipmapLinearFilter; tex.magFilter = T.LinearFilter; tex.generateMipmaps = true;
      var uG = { uMapa: { value: tex }, uSlonce: { value: uWoda.uSlonce.value }, uKolorSlonca: { value: uWoda.uKolorSlonca.value },
        uMgielka: UM.uMgielka, uMgielkaL: UM.uMgielkaL, uMgielkaKol: UM.uMgielkaKol, uMgielkaKolR: UM.uMgielkaKolR, uWodaJasn: uWoda.uWodaJasn,
        uAmb: { value: uWoda.uAmb.value }, uZenitL: { value: uWoda.uZenitL.value }, uHoryzontL: { value: uWoda.uHoryzontL.value } };
      var kula = new T.Mesh(zg(new T.SphereGeometry(R_ZIEMI, 256, 128)), zg(new T.ShaderMaterial({ uniforms: uG, vertexShader: GLOB_VERT, fragmentShader: GLOB_FRAG })));
      // obrót: wiersze = wschód, góra, południe punktu stycznego w układzie SphereGeometry (u = 0 → lon −180°)
      var lon = Teren.SRODEK.lon * RAD, lat = Teren.SRODEK.lat * RAD;
      var gora = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)];
      var wsch = [-Math.sin(lon), 0, -Math.cos(lon)];
      var pln = [-Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon)];
      var M = new T.Matrix4().set(wsch[0], wsch[1], wsch[2], 0, gora[0], gora[1], gora[2], -R_ZIEMI, -pln[0], -pln[1], -pln[2], 0, 0, 0, 0, 1);
      kula.matrixAutoUpdate = false; kula.matrix.copy(M); kula.name = 'glob';
      sg.add(kula);
      var uH = { uSlonce: uG.uSlonce, uSrodek: { value: new T.Vector3(0, -R_ZIEMI, 0) }, uR: { value: R_ZIEMI } };
      var halo = new T.Mesh(zg(new T.SphereGeometry(R_ZIEMI * 1.04, 96, 48)), zg(new T.ShaderMaterial({ uniforms: uH, vertexShader: GLOB_VERT,
        fragmentShader: HALO_FRAG, side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending })));
      halo.position.set(0, -R_ZIEMI, 0); halo.name = 'glob-halo';
      sg.add(halo);
      var g = glob = { scena: sg, kamera: kg, tekstura: tex, kula: kula, wlasne: wlasne, gotowy: false };
      glob.gotowa = obraz(url).then(function (img) {
        if (glob !== g) return false;                 // zwolniony w trakcie wczytywania
        tex.image = img; tex.needsUpdate = true; g.gotowy = true;
        return true;
      });
      return glob.gotowa;
    }
    // Zwolnienie kuli (rozdział bez poziomu `glob`): tekstura 8k i siatki wychodzą z pamięci karty (G-L: przez z()).
    function zwolnijGlob() {
      if (!glob) return false;
      glob.wlasne.forEach(function (x) { var i = zasoby.indexOf(x); if (i >= 0) zasoby.splice(i, 1); x.dispose(); });
      while (glob.scena.children.length) glob.scena.remove(glob.scena.children[0]);
      glob = null;
      return true;
    }
    function ustawKamereGlobu(k) {
      var kg = glob.kamera;
      kg.position.copy(k.position); kg.quaternion.copy(k.quaternion); kg.fov = k.fov; kg.aspect = k.aspect;
      var dc = Math.hypot(k.position.x, k.position.y + R_ZIEMI, k.position.z), nad = Math.max(1, dc - R_ZIEMI);
      kg.near = Math.max(0.5, nad * 0.25); kg.far = dc + R_ZIEMI * 1.1;
      kg.updateProjectionMatrix(); kg.updateMatrixWorld(true);
    }
    // Render target z głębią 24 bity (r128 daje domyślnie 16 i z-fighting na graniach — docs/material-filmowy.md);
    // wielopróbkowy na WebGL2 (kadr przenikania wygładzony jak kanwa). Zasoby przez z(); stare zwalniane przy zmianie rozmiaru.
    function nowyRT(w, h, msaa) {
      var Klasa = msaa && renderer.capabilities.isWebGL2 && T.WebGLMultisampleRenderTarget ? T.WebGLMultisampleRenderTarget : T.WebGLRenderTarget;
      var rt = z(new Klasa(w, h, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, depthBuffer: true }));
      rt.texture.encoding = T.sRGBEncoding; rt.texture.generateMipmaps = false;
      rt.depthTexture = z(new T.DepthTexture(w, h, T.UnsignedIntType));
      rt.depthTexture.format = T.DepthFormat;
      return rt;
    }
    function usunRT(rt) {
      if (!rt) return;
      [rt.depthTexture, rt].forEach(function (x) { var i = zasoby.indexOf(x); if (i >= 0) zasoby.splice(i, 1); x.dispose(); });
    }
    var komp = null, wymiar = new T.Vector2();
    function kompozytor() {
      if (komp) return komp;
      var kam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), geo = z(new T.PlaneGeometry(2, 2));
      var mMiks = z(new T.ShaderMaterial({ uniforms: { uA: { value: null }, uB: { value: null }, uF: { value: 0 } }, vertexShader: KWADRAT_VERT,
        fragmentShader: MIKS_FRAG, depthTest: false, depthWrite: false }));
      var mZasl = z(new T.ShaderMaterial({ uniforms: { uZaslona: { value: new T.Vector4() } }, vertexShader: KWADRAT_VERT,
        fragmentShader: ZASLONA_FRAG, depthTest: false, depthWrite: false, transparent: true }));
      var sMiks = new T.Scene(), sZasl = new T.Scene(), q1 = new T.Mesh(geo, mMiks), q2 = new T.Mesh(geo, mZasl);
      q1.frustumCulled = q2.frustumCulled = false;
      sMiks.add(q1); sZasl.add(q2);
      komp = { kam: kam, mMiks: mMiks, mZasl: mZasl, sMiks: sMiks, sZasl: sZasl };
      return komp;
    }
    // para celów przenikania: osobna dla ekranu i dla celu pomiaru (bez przełączania rozmiarów co pomiar)
    function parRT(w, h, klucz) {
      var K = kompozytor(), P = K[klucz] || (K[klucz] = { A: null, B: null, w: 0, h: 0 });
      if (P.A && P.w === w && P.h === h) return P;
      usunRT(P.A); usunRT(P.B);
      // bez wielopróbkowania: przenikanie trwa 1–3 s, a dwa cele MSAA 4× w 3440×1440 to ok. 0,3 GB pamięci karty
      P.A = nowyRT(w, h, false); P.B = nowyRT(w, h, false); P.w = w; P.h = h;
      return P;
    }
    // Kadr pokazu: o = { glob: 0…1 (udział poziomu glob), zaslona: [r, g, b, a] (czerń C/Cc, biel B; 0…1), cel: RT | null }.
    // glob 0 / 1 → render wprost; w przenikaniu P obie sceny do render targetów i mieszanie; zasłona = kwadrat nad kadrem.
    function kadr(o) {
      o = o || {};
      var cel = o.cel || null, zs = o.zaslona, a = zs ? Math.max(0, Math.min(1, zs[3])) : 0;
      var g = glob && glob.gotowy ? Math.max(0, Math.min(1, +o.glob || 0)) : 0, ac = renderer.autoClear;
      renderer.setRenderTarget(cel);
      if (a >= 0.999) { renderer.setClearColor(new T.Color(zs[0], zs[1], zs[2]), 1); renderer.clear(true, true, true); renderer.setClearColor(tlo, 1); return; }
      if (glob && g > 0.001) ustawKamereGlobu(kamera);
      // poza przenikaniem para celów nie wisi w pamięci karty (2 × kolor + głębia kadru: 80 MB w 3440×1440)
      if ((g <= 0.001 || g >= 0.999) && komp && komp[cel ? 'pomiar' : 'ekran'] && komp[cel ? 'pomiar' : 'ekran'].A) {
        var Pz = komp[cel ? 'pomiar' : 'ekran']; usunRT(Pz.A); usunRT(Pz.B); Pz.A = Pz.B = null; Pz.w = Pz.h = 0;
      }
      if (g <= 0.001) { renderer.setClearColor(tlo, 1); renderer.render(scena, kamera); }
      else if (g >= 0.999) { renderer.setClearColor(0x000000, 1); renderer.render(glob.scena, glob.kamera); renderer.setClearColor(tlo, 1); }
      else {
        if (cel) wymiar.set(cel.width, cel.height); else renderer.getDrawingBufferSize(wymiar);
        var K = parRT(wymiar.x, wymiar.y, cel ? 'pomiar' : 'ekran'), K0 = kompozytor();
        renderer.setRenderTarget(K.A); renderer.setClearColor(tlo, 1); renderer.render(scena, kamera);
        renderer.setRenderTarget(K.B); renderer.setClearColor(0x000000, 1); renderer.render(glob.scena, glob.kamera);
        renderer.setClearColor(tlo, 1);
        K0.mMiks.uniforms.uA.value = K.A.texture; K0.mMiks.uniforms.uB.value = K.B.texture; K0.mMiks.uniforms.uF.value = g;
        renderer.setRenderTarget(cel); renderer.render(K0.sMiks, K0.kam);
      }
      if (a > 0.001) {
        var K2 = kompozytor();
        K2.mZasl.uniforms.uZaslona.value.set(zs[0], zs[1], zs[2], a);
        renderer.autoClear = false; renderer.render(K2.sZasl, K2.kam); renderer.autoClear = ac;
      }
    }
    // Pomiar (smoke): kadr w rozdzielczości kanwy do celu z głębią 24 bity, odczyt i zmniejszenie średnią z pudełka do
    // szerokości 320 px (wiersze od dołu, RGBA). Render wprost do 320 px przekłamywał kadr: wielkość cząstek i świateł
    // (punkty w px kanwy) zostawała z 1440 px, więc w 3440×1440 dym i ogień A2 zasłaniały 10× więcej kadru pomiaru.
    var rtPomiaru = null, wymPomiaru = new T.Vector2();
    function pomiarKadru(o, szer) {
      szer = szer || 320;
      renderer.getDrawingBufferSize(wymPomiaru);
      var W = Math.max(1, wymPomiaru.x), H = Math.max(1, wymPomiaru.y);
      if (!rtPomiaru || rtPomiaru.width !== W || rtPomiaru.height !== H) { usunRT(rtPomiaru); rtPomiaru = nowyRT(W, H, false); }
      var oo = {}; for (var k in o) oo[k] = o[k];
      oo.cel = rtPomiaru;
      kadr(oo);
      var pelny = new Uint8Array(W * H * 4);
      renderer.readRenderTargetPixels(rtPomiaru, 0, 0, W, H, pelny);
      renderer.setRenderTarget(null);
      var w = Math.min(szer, W), h = Math.max(1, Math.round(w * H / W)), buf = new Uint8Array(w * h * 4);
      for (var y = 0; y < h; y++) {
        var y0 = Math.floor(y * H / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * H / h));
        for (var x = 0; x < w; x++) {
          var x0 = Math.floor(x * W / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * W / w)), r = 0, g = 0, b = 0, n = 0;
          for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) { var q = (yy * W + xx) * 4; r += pelny[q]; g += pelny[q + 1]; b += pelny[q + 2]; n++; }
          var d = (y * w + x) * 4; buf[d] = Math.round(r / n); buf[d + 1] = Math.round(g / n); buf[d + 2] = Math.round(b / n); buf[d + 3] = 255;
        }
      }
      return { w: w, h: h, px: buf };
    }
    // Maska obiektu (pomiar lawy): ten sam kadr z obiektem i bez niego — piksele, które się różnią, to obiekt widoczny
    // w kadrze (z testem głębi i z discardem własnego shadera; łuna na terenie zostaje w obu, więc do maski nie wchodzi).
    function maskaObiektu(nazwa, o, szer) {
      var ob = scena.getObjectByName(nazwa);
      if (!ob || !ob.visible) return null;
      var p1 = pomiarKadru(o, szer);
      ob.visible = false;
      var p2 = pomiarKadru(o, szer);
      ob.visible = true;
      var n = p1.w * p1.h, m = new Uint8Array(n);
      for (var i = 0; i < n; i++) {
        var b = i * 4;
        m[i] = Math.abs(p1.px[b] - p2.px[b]) > 8 || Math.abs(p1.px[b + 1] - p2.px[b + 1]) > 8 || Math.abs(p1.px[b + 2] - p2.px[b + 2]) > 8 ? 1 : 0;
      }
      return { w: p1.w, h: p1.h, maska: m, px: p1.px };
    }
    // Blok (R9.6 X1: wyspa jako blok z dnem na czarnym tle): bez archipelagu, woda tylko na kaflu, niebo przekroju.
    function blok(wl) {
      blokWl = !!wl;
      if (!przek) { if (arch) arch.mesh.visible = !blokWl; uWoda.uTylkoKafel.value = blokWl ? 1 : 0; }
      niebo();
      renderer.shadowMap.needsUpdate = true;
      return blokWl;
    }
    // Ostrze (o.ostrze): z = null → odcięcie całe; liczba → odcięta tylko część na północ od z (z rośnie na południe),
    // ściana widoczna na północ od z.
    function ustawOstrze(zKm) {
      if (!ostrze) return null;
      if (zKm == null) { ostrze.set(new T.Vector3(0, 1, 0), -1e7); ostrzeSciany.set(new T.Vector3(0, 1, 0), 1e7); }
      else { ostrze.set(new T.Vector3(0, 0, 1), -zKm); ostrzeSciany.set(new T.Vector3(0, 0, -1), zKm); }
      renderer.shadowMap.needsUpdate = true;
      return zKm;
    }
    // Odsłanianie jednostek mapy geologicznej (alfa palety): f(id) → 0…1, null = wszystkie.
    function odslonJednostki(f) {
      var zm = false;
      jednostki.slice(0, 255).forEach(function (j, k) {
        var v = Math.round(255 * Math.max(0, Math.min(1, f ? +f(j.id) || 0 : 1)));
        if (paleta[(k + 1) * 4 + 3] !== v) { paleta[(k + 1) * 4 + 3] = v; zm = true; }
      });
      if (zm) tPaleta.needsUpdate = true;
      return zm;
    }
    // Odsłanianie warstw ściany przekroju (R9.6 X4: warstwa zapala się na swoim wersie): f(id) → 0…1, null = wszystkie.
    // Ściana przebudowywana tylko przy zmianie zbioru odsłoniętych warstw.
    var kluczWarstw = '';
    function warstwyPrzekroju(f) {
      var klucz = f ? (dane.warstwy || []).map(function (w) { return f(w.id) > 0.5 ? 1 : 0; }).join('') : '*';
      if (klucz === kluczWarstw) return false;
      kluczWarstw = klucz; odslonWarstwy = f;
      if (sciana && przek) zbudujSciane(przek.linia);
      return true;
    }

    // --- cienie z mapy horyzontu (Task A3) ---
    // horyzont({ meta, rgba0, rgba1 }): mapa z generatora (horyzont.json + PNG rozpakowane bajt w bajt) → tekstury przez z()
    // i stożek Teide z meta.stozekTeide (R13); bez przebudowy programów (próbniki i uniformy są od budowy). Czynne, gdy mapa
    // wczytana, scena nie jest pokazem, widok zezwala (cienieHor(false) — animacje A1–A5) i nie ma czasu geologicznego
    // (mapa i stożek opisują dzisiejszą rzeźbę).
    function cienieHorAkt() {
      var wl = hor.dozwolone && hor.wczytana && hor.zezwolenie && !(ewo.Ma > 0);
      UH.uCienieHor.value = wl ? 1 : 0;
      return wl;
    }
    function teksturaHor(rgba, w, h) {
      var t = z(new T.DataTexture(rgba, w, h, T.RGBAFormat, T.UnsignedByteType));
      t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.magFilter = t.minFilter = T.LinearFilter;
      t.generateMipmaps = false; t.unpackAlignment = 1; t.needsUpdate = true;
      return t;
    }
    function horyzont(d) {
      if (!hor.dozwolone || hor.wczytana || !d || !d.meta) return false;
      var m = d.meta, r = prostokat({ bbox: m.bbox });
      if (d.rgba0.length !== m.w * m.h * 4 || d.rgba1.length !== m.w * m.h * 4) {
        console.error('Geologia: mapa horyzontu — rozmiar danych niezgodny z horyzont.json (' + m.w + '×' + m.h + ')');
        return false;
      }
      UH.uHor0.value = teksturaHor(d.rgba0, m.w, m.h); UH.uHor1.value = teksturaHor(d.rgba1, m.w, m.h);
      var st = m.stozekTeide;
      if (st && st.k > 0) {
        stozek = { x: st.x_km, z: st.z_km, h: st.h_km, hb: st.hb_km, k: st.k };
        UH.uStozek.value.set(stozek.x, stozek.z, stozek.h, stozek.k);
      } else console.error('Geologia: horyzont.json bez stozekTeide — makieta bez cienia Teide na morzu i chmurach');
      UH.uProstHor.value.set(r.x0, r.z0, r.x1, r.z1); UH.uRozmHor.value.set(m.w, m.h);
      hor.wczytana = true;
      cienieHorAkt();
      return true;
    }

    // --- kurz kalimy (Task C1 — geologia/kurz.js) ---
    // kurz({ widoczny, gruboscGlob, maska: Uint8Array(ROZMIAR²) grubości }) → czy kurz jest rysowany. Tekstura maski (R8,
    // liniowa, bez mipmap) powstaje przez z() przy pierwszej masce i potem tylko dostaje nowe dane (needsUpdate) — bez nowych
    // programów (gałąź i próbnik są od budowy). Rysowany, gdy scena nie jest pokazem (o.kurz === false — nigdy), widok go
    // włącza (pogoda „Kalima”), grubość globalna > 0, maska wgrana i nie ma czasu geologicznego (uEwoMa > 0 — kurz leży na
    // dzisiejszej powierzchni; Review Focus 1). kurzUV(x, z) → [u, v] w prostokącie wyspy (ten sam co uProstKurz) | null.
    var kurzSt = { dozwolony: o.kurz !== false, tekstura: null, widoczny: false, glob: 0 };
    function kurzAkt() {
      var wl = kurzSt.dozwolony && kurzSt.widoczny && kurzSt.glob > 0 && !!kurzSt.tekstura && !(ewo.Ma > 0);
      U.uKurzGrubosc.value = wl ? kurzSt.glob : 0;
      return wl;
    }
    function kurz(k) {
      if (!kurzSt.dozwolony) return false;
      if (k) {
        if (k.maska) {
          if (!kurzSt.tekstura) {
            var r = wyspa.prost, d = new Uint8Array(k.maska.length), n = Math.round(Math.sqrt(k.maska.length));
            d.set(k.maska);
            // LuminanceFormat: R8 działa i w WebGL1 (RedFormat w r128 tylko w WebGL2)
            var t = kurzSt.tekstura = z(new T.DataTexture(d, n, n, T.LuminanceFormat, T.UnsignedByteType));
            t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.magFilter = t.minFilter = T.LinearFilter;
            t.generateMipmaps = false; t.unpackAlignment = 1; t.needsUpdate = true;
            U.uKurz.value = t; U.uProstKurz.value.set(r.x0, r.z0, r.x1, r.z1);
          } else { kurzSt.tekstura.image.data.set(k.maska); kurzSt.tekstura.needsUpdate = true; }
        }
        if (k.widoczny != null) kurzSt.widoczny = !!k.widoczny;
        if (k.gruboscGlob != null) { var g = +k.gruboscGlob; kurzSt.glob = g > 0 ? (g < 1 ? g : 1) : 0; }
      }
      return kurzAkt();
    }
    function kurzUV(x, zz) {
      var r = wyspa.prost, u = (x - r.x0) / (r.x1 - r.x0), v = (zz - r.z0) / (r.z1 - r.z0);
      return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? [u, v] : null;
    }

    function zwolnij() {
      warstwy.length = 0;
      kurzSt.tekstura = null;
      grupaWiatru = linieWiatru = uWiatr = null; wiatrSt.pole = null; wiatrSt.n = 0;
      zwolnijSciane();
      scena.traverse(function (ob) { if (ob.isLight && ob.shadow && ob.shadow.map) { ob.shadow.map.dispose(); ob.shadow.map = null; } });
      zasoby.forEach(function (x) { if (x && x.dispose) x.dispose(); });
      zasoby.length = 0;
      while (scena.children.length) scena.remove(scena.children[0]);
      if (glob) { while (glob.scena.children.length) glob.scena.remove(glob.scena.children[0]); glob = null; }
      komp = null; rtPomiaru = null; dalekiLadP = null;
    }

    function woda(stan, f) { f = f == null ? 1 : Math.max(0, Math.min(1, +f)); U.uSzklo.value = uWoda.uSzklo.value = stan === 'szklana' ? f : 1 - f; return U.uSzklo.value; }

    przewyzszenie(e);
    renderer.shadowMap.needsUpdate = true;

    return {
      scena: scena, kamera: kamera, teren: wyspa.mesh, ocean: ocean, czesci: czesci,
      // nasycMaks: górna granica nasycenia barw jednostek (pokaz 0,6); bez niej 1 — makieta jak legenda
      kolorowanie: function (tryb, nasycMaks) { U.uTryb.value = { geologia: 1, krajobraz: 2, kalibracja: 3 }[tryb] || 0; U.uNasycMaks.value = nasycMaks > 0 ? nasycMaks : 1; return tryb; },
      przekroj: przekroj,
      // pokaz: podpisy warstw poza teksturą (nakładki ekranowe) — przebudowa ściany przy zmianie; kotwice bieżącej ściany
      podpisyWarstwNaScianie: function (tak) {
        tak = tak !== false;
        if (tak === podpisyNaScianie) return;
        podpisyNaScianie = tak;
        if (sciana && sciana.material.map) { var L0 = sciana.userData.L; if (L0) zbudujSciane(L0); }
      },
      kotwicePrzekroju: function () { return sciana ? kotwiceSciany : []; },
      chmury: function (wl) { chmuryMesh.visible = !!wl; return chmuryMesh.visible; },
      woda: woda,
      // materiał makiety (Task B1): 'sklejka' — warstwy w shaderze terenu i ocean-żywica (woda szklana, mgła wodna #2e7f8c);
      // 'zwykly' (i każda inna wartość) — jak przed B1: woda realna, dotychczasowa barwa
      material: function (m) {
        var sk = m === 'sklejka';
        U.uMaterial.value = sk ? 1 : 0;
        U.uKrokSklejki.value = krokSklejki(e);
        kolorWody = sk ? KOLOR_WODY.sklejka : KOLOR_WODY.zwykly;
        U.uKolorWody.value.copy(new T.Color(kolorWody).convertSRGBToLinear()).multiplyScalar(jasnWody);
        woda(sk ? 'szklana' : 'realna', 1);
        return sk ? 'sklejka' : 'zwykly';
      },
      swiatlo: swiatlo, przewyzszenie: przewyzszenie, pick: pick,
      // cienie z mapy horyzontu (A3): wgranie mapy i zezwolenie widoku (animacje: false) → czy cienie są czynne
      horyzont: horyzont, cienieHor: function (wl) { if (wl != null) hor.zezwolenie = !!wl; return cienieHorAkt(); },
      // smugi pasatu (A2): zezwolenie widoku (przycisk „Wiatr”, animacje: false) i liczba linii (jakość) → czy widoczne
      wiatr: function (wl, n) { if (wl != null) wiatrSt.zezwolenie = !!wl; if (n != null) zbudujSmugi(n); return wiatrAkt(); },
      stozekTeide: function () { return stozek; }, podswietl: podswietl, najedz: najedz, kotwica: kotwica, animuj: animuj, zwolnij: zwolnij,
      czas: czasGeo, efekty: efekty, renderer: renderer,
      // dane czasu geologicznego wyspy (A1: szczyty jednostek) — przygotowuje je przy pierwszym wołaniu
      ewolucja: function () { przygotujEwolucje(); return { s: wyspa.s, przyn: wyspa.przyn, P: ewo.P }; },
      uniformySwiatla: function () { return { kier: uWoda.uSlonce.value, slonce: uWoda.uKolorSlonca.value, amb: uWoda.uAmb.value }; },
      tekstury: { wysW: wyspa.tWys, prostW: uWoda.uProstW.value, rozmW: uWoda.uRozmW.value },
      szklo: function () { return U.uSzklo.value; },
      wysokosc: wysokosc, probkaSwiatla: probkaSwiatla, trafiaSciane: trafiaSciane, punktNaMorzu: punktNaMorzu,
      punktNaTerenie: punktNaTerenie, jednostkaPod: jednostkaPod, stuk: stuk, probkaPejzazu: probkaPejzazu,
      // kurz kalimy (C1): stan rysowania i maska; UV prostokąta wyspy dla ścierania
      kurz: kurz, kurzUV: kurzUV,
      dodajWarstwe: dodajWarstwe, przygasCzesci: przygasCzesci,
      // pokaz (Task 8)
      zbudujGlob: zbudujGlob, zwolnijGlob: zwolnijGlob, dalekiLad: dalekiLad, kadr: kadr,
      // ekspozycja pokazu (spec R4, pomiar): niebo (kopuła, mgła, tło, odbicie w wodzie) × jasność; makieta: 1
      jasnoscNieba: function (x) { if (x != null && Math.abs(x - jasnNieba) > 1e-6) { jasnNieba = Math.max(0.1, +x || 1); niebo(); } return jasnNieba; },
      jasnoscWody: function (x) { if (x != null) uWoda.uWodaJasn.value = Math.max(0, +x || 0); return uWoda.uWodaJasn.value; },
      mgielka: function (a, L, hKam) { if (hKam != null) UM.uMgKamH.value = +hKam || 0; if (a != null) UM.uMgielka.value = Math.max(0, +a || 0); if (L) UM.uMgielkaL.value.set(L[0], L[1]); return UM.uMgielka.value; }, pomiarKadru: pomiarKadru, maskaObiektu: maskaObiektu, blok: blok, ostrze: ustawOstrze,
      odslonJednostki: odslonJednostki, warstwyPrzekroju: warstwyPrzekroju, tlo: function () { return tlo; },
      glob: function () { return glob; }, globGotowy: function () { return !!(glob && glob.gotowy); },
      lad: lad, granice: { wyspa: wyspa.prost, archipelag: arch ? arch.prost : wyspa.prost }, srodekPrzekroju: srodekPrzekroju,
      dekoracje: { sciana: function () { return sciana; }, chmury: chmuryMesh, kopula: kopula, lawa: lawa, klucz: klucz, wypelnienie: wypelnienie },
      stan: function () {
        return { przewyzszenie: e, kolorowanie: ['teren', 'geologia', 'krajobraz', 'kalibracja'][U.uTryb.value], szklo: U.uSzklo.value, chmury: chmuryMesh.visible,
          material: U.uMaterial.value > 0.5 ? 'sklejka' : 'zwykly', krokSklejki_m: U.uKrokSklejki.value,
          swiatlo: { pora: sw.pora, az: sw.az, el: sw.el, dostroj: sw.dostroj }, przekroj: przek ? { kat_st: przek.kat_st, przesuniecie_km: przek.przesuniecie_km, maks_m: przek.profil ? przek.profil.maks_m : null } : null,
          podswietlona: podswietlona, najechana: najechana, etykiety: piny.filter(function (g) { return g.userData.pin.widoczna; }).length,
          wierzcholki: wierzcholki, dysk_km: Rdysku, lod: krok === 1 ? 'pelny' : 'lekki', czasMa: ewo.Ma, przygaszenie: przygaszenie,
          cienieHor: UH.uCienieHor.value > 0.5, stuk: U.uStuk.value.w > 0.5, wiatr: !!(grupaWiatru && grupaWiatru.visible), wiatrLinie: wiatrSt.n, wiatrMs: wiatrSt.ms,
          kurz: U.uKurzGrubosc.value > 0, kurzGrubosc: U.uKurzGrubosc.value };
      }
    };
  }

  var api = { zbuduj: zbuduj, odlegloscOdBrzegu: odlegloscOdBrzegu, nawietrznosc: nawietrznosc, indeksyJednostek: indeksyJednostek,
    liniaPrzekroju: liniaPrzekroju, wysokoscTrojkatna: wysokoscTrojkatna, zbudujPoziom: zbudujPoziom, prostokat: prostokat,
    kierunekSlonca: kierunekSlonca, PORY: PORY, GLSL_WSPOLNE: GLSL_WSPOLNE, GLSL_CHMURY_A4: GLSL_CHMURY_A4, STROP_CHMUR_KM: STROP_CHMUR_KM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GeologiaScena = api;
})(typeof window !== 'undefined' ? window : globalThis);
