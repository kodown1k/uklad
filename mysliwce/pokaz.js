'use strict';
/* Zakładka Myśliwce — pokaz kinowy maszyny: generator ujęć z danych (czysty) i odtwarzacz (przeglądarka, THREE r128).
   Jeden generator dla dziewięciu maszyn — nowa maszyna to dane (dane.js, czesci.js, sylwetki.js), nie kod.
   Czyste (dual-export, testy w node):
     Pokaz.plan(mysliwiec, czesci, bryla) → Ujecie[] — `bryla` = Platowiec.zbuduj(…, { lod: 'pelny' }) (kotwice części, obwiednia,
       wyloty, otwory wlotów). Ujecie = { id: '<maszyna>/<typ>' (części: '<maszyna>/czesc/<rodzaj>'), typ, czas [s],
       wersy: Wers[] (id i tekst z dane.js / czesci.js), napisy: Kino.harmonogram(wersy) w czasie ujęcia,
       kamera: klucze Kino.kameraPoscigu (układ samolotu), czesc?: rodzaj, lot: { v [m/s], tor, wysokosc [m] },
       efekty: { ciag, mgla?, rozloz?, komory?: [[u 0..1, wartość]], tytul?: [od, do] [s], karta?: true, radar?: {…} } }.
       Kolejność: rozruch (z mgły, rozpalenie dysz, wers 1 opowieści) → przelot (niski, dopalacz, Doppler; kamera ucieka przed
       nos, maszyna ją mija i kamera siada jej na ogonie) → okrążenie (tył z ogniem → bok → pod nosem → nad grzbietem) →
       2–4 × część (dojazd do kotwicy, wzrok na niej; komory się otwierają) → rozkład (zawis w chmurach, rozłożenie 0→1→0) →
       radar (fala z nadajnika, odbicia od fasetek, echo maleje do szklanej kulki) → final (kadr z kartą danych).
       Ujęcia sceny lotu (rozruch…części) łączą się bez cięcia: ostatni klucz kamery ujęcia = pierwszy klucz następnego,
       oddech 0 na granicach, klucze-widma sąsiadów (`widmo: true`, poza [0, czas]) — prędkość kamery ciągła przez granicę.
       Cięcia tylko przed rozkładem, radarem i finałem. Wersy opowieści na ujęcia po treści (pole `ujecie` w dane.js).
     Pokaz.kameraKadru(kp, plan, n, t, w, h) — poprawka kadru dla telefonu w pionie (szerzej i dalej dla całej maszyny).
     Pokaz.krzywa(klucze [[u, v]], u, domyślna?) — liniowo po kluczach; Pokaz.pozycja(plan, tGlob) → { n, t };
     Pokaz.droga(plan, n, t) [m] (przesunięcie świata, prędkość narasta w 2 s w obrębie sceny), Pokaz.wysokosc(plan, n, t).
   Przeglądarkowe: Pokaz.uruchom(ctx, ujecia) → { idz(n), pauza(bool), t(), zwolnij(), krok(dt), ustaw(n, t), stan(),
     rozmiar(w, h), jakosc(j), dzwiek(silnik|null) }.
     ctx = { THREE, renderer, post (Kino.post), makieta: (env) → Makieta (budowana na niebie pokazu), mysliwiec, czesci,
       napisy (Kino.napisy), etykieta(tekst|null, x, y), karta(bool), przesuniecieKarty() → px, dzwiek?, smoke?, jakosc?,
       koniec?() }.
     Świat: proceduralne niebo (gradient + słońce, shader), ziemia daleko w dole (tekstura pól przesuwana z prędkością lotu),
     warstwy chmur (billboardy, zawijane w pudle wokół maszyny), mgła rozruchu, słońce z cieniem, półsfera, env z nieba (PMREM).
     Maszyna stoi w początku układu (pływający początek), świat jedzie pod nią; lekkie kołysanie z czasu globalnego.
     Kadr deterministyczny: wszystko (kamera, ciąg, płomień, chmury, ziemia, fala radaru) jest funkcją czasu ujęcia. */
(function (root) {
  var K = (typeof module !== 'undefined' && module.exports) ? require('./kino.js') : root.MysliwceKino;

  var CIECIA = { rozklad: 1, radar: 1, final: 1 };          // ujęcia zaczynające nową scenę
  var NAPISY = { tempo: 15, min: 2.2, przerwa: 0.6 };
  var WEJSCIE = 0.9, WEJSCIE_ROZRUCHU = 5.2, OGON = 1.4;    // [s] napis po starcie ujęcia (rozruch: po planszy tytułu), cisza na końcu
  var MIN = { rozruch: 10, przelot: 11, okrazenie: 14, czesc: 8.5, rozklad: 12, radar: 14, final: 12 };
  var MIN_RADARU_BEZ_WERSU = 10;                            // [s] radar bez napisu (żaden wers opowieści nie mówi o echu)
  var LOT = {
    rozruch: { v: 150, tor: 'mgla', wysokosc: 520 }, przelot: { v: 360, tor: 'niski', wysokosc: 70 },
    okrazenie: { v: 230, tor: 'prosty', wysokosc: 480 }, czesc: { v: 230, tor: 'prosty', wysokosc: 480 },
    rozklad: { v: 18, tor: 'zawis', wysokosc: 620 }, radar: { v: 0, tor: 'radar', wysokosc: 900 },
    final: { v: 240, tor: 'prosty', wysokosc: 760 },
  };
  var RAMPA_V = 2, RAMPA_H = 4;                             // [s] dojście prędkości i wysokości w obrębie sceny
  // Rozdział opowieści (po wersie 1 w rozruchu) między ujęcia: po treści — pole `ujecie` wersu w dane.js. Wagi długości
  // tekstu to tylko zapas dla opowieści bez żadnego pola (kosze po długości rozjeżdżały wers z obrazem o jedno ujęcie).
  var KOSZE = [['przelot', 0.2], ['okrazenie', 0.26], ['rozklad', 0.16], ['radar', 0.2], ['final', 0.18]];
  // Części wyróżniające sylwetkę (pierwsze w kolejce do ujęć), potem reszta po kolei.
  var RESZTA = ['dysze', 'wloty', 'kabina', 'nos', 'sensory', 'skrzydla', 'usterzenie', 'kadlub', 'podwozie'];
  // Widok części: [azymut, elewacja, odległość × długość maszyny]
  // dysze: z boku-tyłu (122°), nie w osi strugi — w osi struga wychodziła poza kadr, a mgła płomienia zasłaniała część kadru
  var WIDOK = {
    nos: [35, 6, 0.3], kabina: [62, 24, 0.24], wloty: [42, -4, 0.28], skrzydla: [105, 38, 0.36], usterzenie: [140, 22, 0.32],
    kaczka: [55, 16, 0.28], levcon: [50, 18, 0.28], dysze: [122, 8, 0.55], komory: [62, -52, 0.5], sensory: [30, -10, 0.24],
    podwozie: [95, -32, 0.32], kadlub: [90, 12, 0.4],
  };
  var CEL_DYSZ = 0.3;                                       // [× długość płomienia] cel kamery dysz za wylotami — w kadrze cała struga
  // Telefon w pionie (kadr pełny, h > w): ujęcia całej maszyny szerzej i dalej (klucze liczone dla 2.39:1 dawały maszynę
  // w 1–33% kadru). Ujęcia części z połową mnożnika (`czesc`), radar z celem bliżej maszyny (`celRadaru`) — kameraKadru.
  var PION = { tanFov: 1.6, odleglosc: 1.9, czesc: 0.5, celRadaru: 0.6 };
  var CALA_MASZYNA = { rozruch: 1, przelot: 1, okrazenie: 1, rozklad: 1, radar: 1, final: 1 };
  // Niepewność w radarze: wyjaśnienie, a na ostatnim impulsie (echo = szklana kulka) osobne, krótkie zdanie SYMULACJA.
  var NIEPEWNOSC = {
    niska: 'Ile echa naprawdę wraca od tej maszyny, wiedzą tylko ci, którzy ją zbudowali.',
    'bardzo-niska': 'Nikt spoza fabryki nie zmierzył tego echa — nawet kształt, od którego się odbija, to rekonstrukcja ze zdjęć.',
  };
  var SYMULACJA = 'Patrzysz na symulację, nie na pomiar.';
  var OKRES_RADARU = 2.6, PIERWSZY_IMPULS = 0.6;           // [s]
  // Światło radaru (granat nocy): maszyna czytelna — to ona jest bohaterem dowodu
  var SWIATLO_RADARU = { slonce: 0.9, polsfera: 0.35 };
  var ODBITE = 0.8;                                         // światło odbite od ziemi (od dołu, barwa pól)
  var KARTA_WASKI = 900;                                    // [px] kadr węższy → karta finału jako arkusz od dołu

  /* ---------- czyste pomocnicze ---------- */
  function przytnij(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gladko(u) { u = przytnij(u, 0, 1); return u * u * (3 - 2 * u); }
  function lerp3(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
  function zaokr(x) { return Math.ceil(x * 10 - 1e-9) / 10; }
  function krzywa(k, u, dom) {
    if (!k || !k.length) return dom == null ? 0 : dom;
    if (u <= k[0][0]) return k[0][1];
    for (var i = 1; i < k.length; i++) {
      if (u <= k[i][0]) { var a = k[i - 1], b = k[i], h = b[0] - a[0]; return h > 0 ? a[1] + (b[1] - a[1]) * (u - a[0]) / h : b[1]; }
    }
    return k[k.length - 1][1];
  }
  // klucz kamery: { t, azymut, elewacja, odleglosc, cel, fov, oddech }
  function klucz(t, az, el, d, cel, fov, oddech) {
    return { t: t, azymut: az, elewacja: el, odleglosc: d, cel: cel.slice(), fov: fov, oddech: oddech || 0 };
  }
  function przeniesKlucz(k, t) { return klucz(t, k.azymut, k.elewacja, k.odleglosc, k.cel, k.fov, 0); }

  // Zapas: opowieść (bez wersu 1) na kosze — kolejność zachowana, granice z wag długości, każdy kosz co najmniej jeden wers.
  function rozdziel(wersy, wagi) {
    var n = wersy.length, k = wagi.length, kosze = wagi.map(function () { return []; });
    var dl = wersy.map(function (w) { return w.tekst.length; }), suma = dl.reduce(function (a, b) { return a + b; }, 0) || 1;
    var sw = wagi.reduce(function (a, b) { return a + b; }, 0), b = 0, granica = wagi[0] / sw * suma, cum = 0;
    for (var i = 0; i < n; i++) {
      while (b < k - 1 && kosze[b].length && (cum + dl[i] / 2 > granica || n - i <= k - b - 1)) { b++; granica += wagi[b] / sw * suma; }
      kosze[b].push(wersy[i]); cum += dl[i];
    }
    return kosze;
  }
  // Opowieść (bez wersu 1, który otwiera rozruch) na ujęcia po treści: wers z polem `ujecie` idzie tam, gdzie każe dane.js,
  // wers bez pola — tam, gdzie poprzedni. 'czesc/<rodzaj>' bez takiego ujęcia w planie → okrążenie (ostatnie ujęcie
  // przed częściami: kolejność opowieści zostaje). Opowieść bez żadnego pola → kosze z wag długości (KOSZE).
  // → { przelot: [], okrazenie: [], rozklad: [], radar: [], final: [], czesc: { <rodzaj>: [] } }
  function przypisz(wersy, rodzajeCzesci) {
    var wynik = { czesc: {} };
    KOSZE.forEach(function (k) { wynik[k[0]] = []; });
    if (!wersy.some(function (w) { return w.ujecie; })) {
      var kosze = rozdziel(wersy, KOSZE.map(function (k) { return k[1]; }));
      KOSZE.forEach(function (k, i) { wynik[k[0]] = kosze[i]; });
      return wynik;
    }
    var biez = 'przelot';
    wersy.forEach(function (w) {
      if (w.ujecie && w.ujecie !== 'rozruch') biez = w.ujecie;
      var m = /^czesc\/(.+)$/.exec(biez);
      if (m && rodzajeCzesci.indexOf(m[1]) >= 0) (wynik.czesc[m[1]] = wynik.czesc[m[1]] || []).push(w);
      else (wynik[m ? 'okrazenie' : biez] || wynik.final).push(w);
    });
    return wynik;
  }

  function grzbietowy(wloty) {
    return !!(wloty && (wloty.otwory || []).some(function (o) { return o.punkt[1] > 0.3 && Math.abs(o.punkt[2]) < 0.2; }));
  }
  function wybierzCzesci(czesci, bryla) {
    var jest = function (r) { return !!bryla.czesci[r] && czesci.some(function (c) { return c.rodzaj === r; }); };
    var dysze = bryla.czesci.dysze, typ = dysze && dysze.wyloty && dysze.wyloty[0] && dysze.wyloty[0].typ;
    var wyr = [];
    if (jest('dysze') && typ && typ !== 'okragla') wyr.push('dysze');            // 2D-TVC, 3D-TVC, rynna
    ['kaczka', 'levcon'].forEach(function (r) { if (jest(r)) wyr.push(r); });
    if (jest('wloty') && grzbietowy(bryla.czesci.wloty)) wyr.push('wloty');
    if (jest('komory')) wyr.push('komory');
    var reszta = RESZTA.filter(function (r) { return jest(r) && wyr.indexOf(r) < 0; });
    return wyr.concat(reszta).slice(0, Math.max(3, Math.min(4, wyr.length)));
  }
  function widokCzesci(rodzaj, kotwica, bryla) {
    var w = WIDOK[rodzaj] || [70, 10, 0.32];
    if (rodzaj === 'wloty' && grzbietowy(bryla.czesci.wloty) && kotwica[1] > 0.3) w = [28, 30, 0.3];   // wlot na grzbiecie: z góry
    return w;
  }

  /* ---------- plan ---------- */
  function plan(m, czesci, bryla) {
    var o = bryla.obwiednia, L = o.max[0] - o.min[0], S = o.max[2] - o.min[2], R = Math.max(L, S);
    var C = [0, 0, 0], N = [o.max[0] * 0.55, 0, 0];
    var wyl = (bryla.czesci.dysze && bryla.czesci.dysze.wyloty) || [];
    var T = wyl.length ? [0, 1, 2].map(function (a) { return wyl.reduce(function (s, w) { return s + w.punkt[a]; }, 0) / wyl.length; }) : [o.min[0], 0, 0];
    T[2] = 0;                                                    // środek wylotów na osi (pary dysz)
    var op = m.opowiesc || [];
    var wybrane = wybierzCzesci(czesci, bryla).map(function (r) {
      var kot = bryla.czesci[r].kotwica.slice(), w = widokCzesci(r, kot, bryla);
      if (r === 'dysze') {                                       // cel za wylotami: w kadrze cała struga, nie sam wylot
        var w0 = bryla.czesci.dysze.wyloty && bryla.czesci.dysze.wyloty[0];
        if (w0) { kot = T.slice(); kot[0] -= CEL_DYSZ * dlPlomienia(w0); }
      }
      return { rodzaj: r, kotwica: kot, w: w, c: czesci.filter(function (c) { return c.rodzaj === r; })[0] };
    }).sort(function (a, b) { return a.w[0] - b.w[0]; });
    var wersyKosza = przypisz(op.slice(1), wybrane.map(function (x) { return x.rodzaj; }));
    var ujecia = [];

    function harmon(wersy, start) { return K.harmonogram(wersy, { start: start, tempo: NAPISY.tempo, min: NAPISY.min, przerwa: NAPISY.przerwa }); }
    // Ujęcie o czasie z napisów (nie krócej niż MIN typu); klucze kamery w ułamkach czasu (u) przeliczane na sekundy.
    function dodaj(typ, id, wersy, klucze, efekty, extra) {
      var start = typ === 'rozruch' ? WEJSCIE_ROZRUCHU : WEJSCIE, h = harmon(wersy, start);
      var min = typ === 'radar' && !wersy.length ? MIN_RADARU_BEZ_WERSU : MIN[typ];
      var czas = zaokr(Math.max(min, h.length ? h[h.length - 1].koniec + OGON : 0));
      var poprz = ujecia[ujecia.length - 1];
      var kam = klucze.map(function (k) { return klucz(k[0] * czas, k[1], k[2], k[3], k[4], k[5], k[6]); });
      if (poprz && !CIECIA[typ]) kam[0] = przeniesKlucz(poprz.kamera[poprz.kamera.length - 1], 0);   // ciągłość sceny
      kam[kam.length - 1].oddech = 0;
      var u = { id: m.id + '/' + typ + (extra && extra.czesc ? '/' + extra.czesc : ''), typ: typ, czas: czas,
        wersy: wersy.map(function (w) { return { id: w.id, tekst: w.tekst }; }), napisy: h, kamera: kam,
        lot: { v: LOT[typ].v, tor: LOT[typ].tor, wysokosc: LOT[typ].wysokosc }, efekty: efekty };
      if (extra && extra.czesc) u.czesc = extra.czesc;
      ujecia.push(u);
      return u;
    }

    // rozruch: z mgły, kamera za dyszami, gdy się rozpalają, potem przesuwa się wzdłuż burty przed nos
    dodaj('rozruch', null, op.slice(0, 1), [
      [0, 162, 10, 1.7 * R, lerp3(C, T, 0.6), 30, 0],
      [0.45, 150, 8, 1.05 * R, lerp3(C, T, 0.8), 30, 0.5],
      [0.78, 96, 4, 1.3 * R, C, 32, 0.4],
      [1, 28, -5, 1.8 * R, lerp3(C, N, 0.3), 32, 0],
    ], { ciag: [[0, 0.15], [0.3, 0.15], [0.62, 1], [1, 1]], mgla: [[0, 1], [0.35, 0.55], [0.7, 0.12], [1, 0.04]], tytul: [0.8, 4.6] });
    // przelot: kamera ucieka przed nos, maszyna ją mija (najbliżej przy azymucie ~90°), kamera siada na ogonie; zawrót
    // azymutu (158° → 140°) jeszcze w przelocie — okrążenie idzie dalej w tę samą stronę (140° → 100° → 22° → −35°), więc
    // kamera nie staje na granicy ujęć
    dodaj('przelot', null, wersyKosza.przelot, [
      [0, 0, 0, 1, C, 30], [0.2, 12, -4, 3.2 * R, C, 26, 0.3], [0.44, 78, -2, 0.85 * R, C, 34, 0.2],
      [0.6, 158, 4, 1.15 * R, lerp3(C, T, 0.4), 32, 0.4], [1, 140, 7, 1.35 * R, lerp3(C, T, 0.3), 32, 0],
    ], { ciag: [[0, 1], [1, 1]] });
    // okrążenie wokół lecącej maszyny: tył z ogniem → bok → pod nosem → nad grzbietem
    dodaj('okrazenie', null, wersyKosza.okrazenie, [
      [0, 0, 0, 1, C, 30], [0.25, 100, 4, 1.15 * R, C, 32, 0.5], [0.55, 22, -24, 0.95 * R, lerp3(C, N, 0.4), 32, 0.5],
      [1, -35, 52, 1.15 * R, C, 32, 0],
    ], { ciag: [[0, 1], [1, 1]] });
    // części: dojazd do kotwicy (u = 0,38), wzrok trzymany na niej do końca ujęcia; kolejność po azymucie widoku (płynny objazd).
    // Napis: wers części; wers opowieści przypisany do tej części (ten sam fakt) go zastępuje.
    wybrane.forEach(function (x) {
      var d = x.w[2] * L, ef = { ciag: [[0, 1], [1, 1]] };
      if (x.rodzaj === 'komory') ef.komory = [[0, 0], [0.3, 0], [0.48, 1], [0.8, 1], [0.97, 0], [1, 0]];
      dodaj('czesc', null, wersyKosza.czesc[x.rodzaj] || [x.c.wers], [
        [0, 0, 0, 1, C, 30], [0.38, x.w[0], x.w[1], d, x.kotwica, 30, 0.35], [1, x.w[0] + 7, x.w[1] + 2, d * 0.92, x.kotwica, 29, 0],
      ], ef, { czesc: x.rodzaj });
    });
    // rozkład: cięcie — zawis w chmurach, części odsuwają się i wracają
    dodaj('rozklad', null, wersyKosza.rozklad, [
      // wolny obrót wokół zawisu (50° na ujęcie)
      [0, 30, 18, 1.65 * R, C, 32, 0], [0.5, 55, 23, 1.52 * R, C, 32, 0.6], [1, 80, 28, 1.4 * R, C, 32, 0],
    ], { ciag: [[0, 0.35], [1, 0.35]], rozloz: [[0, 0], [0.22, 0], [0.45, 1], [0.72, 1], [0.92, 0], [1, 0]] });
    // radar: nadajnik z przodu z lewej, kamera z prawej; fala, odbicia od fasetek, echo maleje. Kamera dojeżdża do maszyny
    // (2,5 R → 1,7 R, cel z drogi fali na maszynę) — ruch umotywowany malejącym echem; maszyna jest bohaterem dowodu.
    var nad = [2.6 * R * Math.cos(-0.14) * Math.cos(-0.7), 2.6 * R * Math.sin(-0.14), 2.6 * R * Math.cos(-0.14) * Math.sin(-0.7)];
    var mr = lerp3(C, nad, 0.38);
    var wersyRadaru = wersyKosza.radar.slice(), poziom = m.pewnosc && m.pewnosc.poziom;
    if (NIEPEWNOSC[poziom]) {
      wersyRadaru.push({ id: m.id + '/radar/niepewnosc', tekst: NIEPEWNOSC[poziom] });
      wersyRadaru.push({ id: m.id + '/radar/symulacja', tekst: SYMULACJA });
    }
    var ur = dodaj('radar', null, wersyRadaru, [
      [0, 46, 34, 2.5 * R, mr, 34, 0], [0.5, 54, 32, 2.1 * R, lerp3(mr, C, 0.55), 34, 0.4], [1, 62, 30, 1.7 * R, C, 33, 0],
    ], { ciag: [[0, 0.6], [1, 0.6]], radar: { nadajnik: nad, okres: OKRES_RADARU, pierwszy: PIERWSZY_IMPULS, droga: 1.8, echo: [0.6 * R, 0.1] } });
    // impuls startuje razem z ostatnim wersem radaru — zdaniem o symulacji (echo jest już szklaną kulką — radarKlatka)
    if (NIEPEWNOSC[poziom] && ur.napisy.length) {
      var sOst = ur.napisy[ur.napisy.length - 1].start, p0 = sOst % OKRES_RADARU;
      ur.efekty.radar.pierwszy = p0 < 0.45 ? p0 + OKRES_RADARU : p0;
    }
    // final: cięcie — maszyna w słońcu, karta danych obok
    dodaj('final', null, wersyKosza.final, [
      [0, 30, 4, 1.35 * R, C, 30, 0], [0.5, 42, 7, 1.26 * R, C, 30, 0.5], [1, 54, 10, 1.18 * R, C, 30, 0],
    ], { ciag: [[0, 0.8], [1, 0.8]], karta: true });
    kluczeWidma(ujecia);
    return ujecia;
  }
  // Klucze-widma na granicach ujęć tej samej sceny: dwa ostatnie klucze (przed końcowym) poprzedniego ujęcia przed t = 0
  // i dwa klucze (po pierwszym) następnego po końcu. Styczna na granicy liczona z tych samych sąsiadów po obu stronach
  // (Kino.kameraPoscigu: ograniczenie stycznych niezależne od kolejności) — prędkość kamery przechodzi przez
  // cięcie-bez-cięcia, zamiast spadać do zera (zerowe styczne na końcach każdego zestawu kluczy). Kadr w [0, czas] dalej
  // przechodzi przez te same klucze. Zatrzymanie zostaje przed cięciem (rozkład, radar, finał) i tam, gdzie tor zawraca.
  function kluczeWidma(ujecia) {
    var wlasne = ujecia.map(function (u) { return u.kamera.slice(); });
    function widmo(k, t) { return Object.assign(przeniesKlucz(k, t), { oddech: k.oddech, widmo: true }); }
    for (var i = 0; i + 1 < ujecia.length; i++) {
      var a = ujecia[i], b = ujecia[i + 1], ka = wlasne[i], kb = wlasne[i + 1];
      if (CIECIA[b.typ] || ka.length < 2 || kb.length < 2) continue;
      for (var j = 1; j <= 2 && j < kb.length; j++) a.kamera.push(widmo(kb[j], a.czas + kb[j].t));
      for (j = 2; j <= 3 && j <= ka.length; j++) b.kamera.unshift(widmo(ka[ka.length - j], ka[ka.length - j].t - a.czas));
    }
  }
  // długość płomienia przy pełnym ciągu (jak Ogien.wymiary(w, 1).dl — bez zależności od ogien.js)
  function dlPlomienia(w) {
    var okr = w.typ === 'okragla' || w.typ === '3D-TVC', pz = w.szer / 2 * 0.84, py = (w.wys || w.szer) / 2 * 0.84;
    if (okr) pz = py = (pz + py) / 2;
    return 8.5 * 2 * Math.sqrt(pz * py);
  }

  /* ---------- czas pokazu ---------- */
  function pozycja(pl, tg) {
    if (!(tg > 0)) return { n: 0, t: 0 };
    for (var n = 0; n < pl.length; n++) {
      if (tg < pl[n].czas || n === pl.length - 1) return { n: n, t: Math.round(Math.min(tg, pl[n].czas) * 1e9) / 1e9 };
      tg -= pl[n].czas;
    }
    return { n: 0, t: 0 };
  }
  function startUjecia(pl, n) { var s = 0; for (var i = 0; i < n; i++) s += pl[i].czas; return s; }
  // droga w ujęciu: prędkość od poprzedniej (ta sama scena) do własnej liniowo w RAMPA_V s
  function drogaW(pl, n, t) {
    var u = pl[n], vn = u.lot.v, vp = n > 0 && !CIECIA[u.typ] ? pl[n - 1].lot.v : vn, r = Math.min(RAMPA_V, u.czas);
    if (t <= r) return vp * t + (vn - vp) * t * t / (2 * r);
    return vp * r + (vn - vp) * r / 2 + vn * (t - r);
  }
  function droga(pl, n, t) {
    var s = 0;
    for (var i = 0; i < n; i++) s += drogaW(pl, i, pl[i].czas);
    return s + drogaW(pl, n, przytnij(t, 0, pl[n].czas));
  }
  function wysokosc(pl, n, t) {
    var u = pl[n], hn = u.lot.wysokosc;
    if (n === 0 || CIECIA[u.typ]) return hn;
    var hp = wysokosc(pl, n - 1, pl[n - 1].czas), r = Math.min(RAMPA_H, 0.45 * u.czas);
    return hp + (hn - hp) * gladko(t / r);
  }

  // Kamera w kadrze o proporcji w/h: telefon w pionie (h > w) — ujęcia całej maszyny szerzej (tan fov × PION.tanFov)
  // i dalej (odległość × PION.odleglosc); ujęcia części z połową mnożnika (dysze F-22A: maszyna 10% obwiedni w kadrze),
  // pierwsza część dochodzi z pełnego mnożnika do połowy w drodze do kotwicy (bez skoku na granicy). Radar w pionie: cel
  // (i kamera razem z nim) przesunięty o 0,6 drogi do środka maszyny (0,5 z recepty dawało J-36 0,93) — start ujęcia celuje w drogę fali i maszyna
  // wychodziła za krawędź (0,57 obwiedni w kadrze). kp = Kino.kameraPoscigu(...) (zmieniany w miejscu), pl = plan,
  // n = ujęcie, t [s] → kp.
  function kameraKadru(kp, pl, n, t, w, h) {
    if (!(h > w)) return kp;
    var u = pl[n], s = 0, i;
    if (CALA_MASZYNA[u.typ]) s = 1;
    else if (u.typ === 'czesc') {
      s = PION.czesc;
      if (n > 0 && CALA_MASZYNA[pl[n - 1].typ]) {
        var kot = u.kamera.filter(function (k) { return !k.widmo; })[1];
        s = PION.czesc + (1 - PION.czesc) * (1 - gladko(kot && kot.t > 0 ? t / kot.t : 1));
      }
    }
    if (u.typ === 'radar') for (i = 0; i < 3; i++) { var d = kp.cel[i] * PION.celRadaru; kp.cel[i] -= d; kp.poz[i] -= d; }
    if (!(s > 0)) return kp;
    var mn = 1 + (PION.odleglosc - 1) * s, tf = 1 + (PION.tanFov - 1) * s;
    for (i = 0; i < 3; i++) kp.poz[i] = kp.cel[i] + (kp.poz[i] - kp.cel[i]) * mn;
    kp.odleglosc *= mn;
    kp.fov = 2 * Math.atan(tf * Math.tan(kp.fov * Math.PI / 360)) * 180 / Math.PI;
    return kp;
  }

  var Pokaz = { plan: plan, krzywa: krzywa, pozycja: pozycja, droga: droga, wysokosc: wysokosc, startUjecia: startUjecia,
    kameraKadru: kameraKadru, CIECIA: CIECIA, LOT: LOT, NIEPEWNOSC: NIEPEWNOSC, SYMULACJA: SYMULACJA, PION: PION, CEL_DYSZ: CEL_DYSZ,
    dlPlomienia: dlPlomienia, uruchom: null };

  /* =====================================================================================================================
     Przeglądarka
     ===================================================================================================================== */
  function generator(ziarno) {      // mulberry32 — deterministyczne tekstury świata
    var a = ziarno >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function plotno(w, h) { var c = root.document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // Pola, łąki, lasy i drogi widziane z wysokości — kafel bez szwu (rysunek ×9 przesunięć).
  function teksturaZiemi(T) {
    var N = 1024, c = plotno(N, N), x = c.getContext('2d'), los = generator(20261121), i;
    x.fillStyle = '#5c6b45'; x.fillRect(0, 0, N, N);
    var barwy = ['#6d7a4a', '#7c8452', '#8a8455', '#596a3e', '#4b5a37', '#9a8c5e', '#6a7449', '#7f7a50', '#465633', '#a39467'];
    function wkolo(f) { for (var dx = -N; dx <= N; dx += N) for (var dy = -N; dy <= N; dy += N) f(dx, dy); }
    for (i = 0; i < 420; i++) {
      var px = los() * N, py = los() * N, w = 30 + los() * 120, h = 20 + los() * 90, kol = barwy[Math.floor(los() * barwy.length)], kat = (los() - 0.5) * 0.5;
      wkolo(function (dx, dy) { x.save(); x.translate(px + dx, py + dy); x.rotate(kat); x.fillStyle = kol; x.globalAlpha = 0.85; x.fillRect(-w / 2, -h / 2, w, h); x.restore(); });
    }
    x.globalAlpha = 1;
    for (i = 0; i < 40; i++) {                                           // lasy: nieregularne skupiska drobnych koron
      var lx = los() * N, ly = los() * N, lr = 14 + los() * 46, ile = 30 + Math.floor(los() * 60);
      for (var j = 0; j < ile; j++) {
        var a = los() * 6.283, r = Math.pow(los(), 0.6) * lr, cx = lx + Math.cos(a) * r * 1.4, cy = ly + Math.sin(a) * r, cr = 2 + los() * 5;
        wkolo(function (dx, dy) { x.fillStyle = 'rgba(44,58,34,0.55)'; x.beginPath(); x.arc(cx + dx, cy + dy, cr, 0, 6.283); x.fill(); });
      }
    }
    for (i = 0; i < 9000; i++) {                                         // ziarno upraw
      var zx = los() * N, zy = los() * N, v = los() < 0.5 ? 'rgba(30,36,20,0.08)' : 'rgba(220,210,170,0.06)';
      x.fillStyle = v; x.fillRect(zx, zy, 2 + los() * 4, 2 + los() * 4);
    }
    x.strokeStyle = 'rgba(128,120,100,0.4)'; x.lineWidth = 1.5;           // drogi
    for (i = 0; i < 3; i++) {
      var y0 = los() * N, y1 = los() * N;
      wkolo(function (dx, dy) { x.beginPath(); x.moveTo(dx, y0 + dy); x.lineTo(N + dx, y1 + dy); x.stroke(); });
    }
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8;
    return t;
  }
  // Obłok cumulusa: kłąb miękkich kul (biały, spód szarawy), przezroczyste brzegi.
  function teksturaChmury(T, ziarno) {
    var N = 256, c = plotno(N, N), x = c.getContext('2d'), los = generator(ziarno);
    for (var i = 0; i < 46; i++) {
      var a = los() * Math.PI * 2, r = Math.pow(los(), 0.7) * 70, px = N / 2 + Math.cos(a) * r * 1.25, py = N / 2 + Math.sin(a) * r * 0.62 - 8;
      var R = 22 + los() * 38, g = x.createRadialGradient(px, py, 0, px, py, R), s = py > N / 2 + 10 ? 205 : 248;
      g.addColorStop(0, 'rgba(' + s + ',' + s + ',' + (s + 5 > 255 ? 255 : s + 5) + ',0.55)'); g.addColorStop(1, 'rgba(' + s + ',' + s + ',' + s + ',0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, R, 0, 6.283); x.fill();
    }
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }

  // Niebo: gradient zenit → horyzont, poniżej horyzontu mgiełka, słońce (tarcza + halo); w mgle i w trybie radaru
  // mieszane z kolorem mgły / granatem (w przestrzeni wyjścia — jak mgła materiałów THREE).
  var NIEBO_W = 'varying vec3 vK; void main(){ vK = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }';
  var NIEBO_F = [
    'uniform vec3 uSlonce; uniform vec3 uZenit; uniform vec3 uHoryzont; uniform vec3 uDol; uniform vec3 uKolSlonca;',
    'uniform vec3 uMglaKol; uniform float uMgla; uniform float uRadar; varying vec3 vK;',
    'void main(){',
    '  vec3 k = normalize(vK); float h = k.y;',
    '  vec3 c = h > 0.0 ? mix(uHoryzont, uZenit, pow(h, 0.55)) : mix(uHoryzont, uDol, pow(clamp(-h * 6.0, 0.0, 1.0), 0.6));',
    '  float s = max(dot(k, normalize(uSlonce)), 0.0);',
    '  c += uKolSlonca * (pow(s, 1400.0) * 30.0 + pow(s, 60.0) * 0.5 + pow(s, 6.0) * 0.12);',
    '  gl_FragColor = vec4(c, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <encodings_fragment>',
    '  gl_FragColor.rgb = mix(gl_FragColor.rgb, uMglaKol, uMgla);',
    // radar: granatowa noc (jaśniej przy horyzoncie, niżej ciemniej) — nie czerń: śr. L kadru 5–9 przy 0,012–0,035
    '  vec3 noc = h > 0.0 ? mix(vec3(0.10, 0.13, 0.18), vec3(0.03, 0.045, 0.08), pow(h, 0.5)) : mix(vec3(0.10, 0.13, 0.18), vec3(0.05, 0.065, 0.095), clamp(-h * 2.5, 0.0, 1.0));',
    '  gl_FragColor.rgb = mix(gl_FragColor.rgb, noc, uRadar);',
    '}',
  ].join('\n');
  // Fala radaru: powłoka kuli — fresnel (pierścień na obrysie) + słaba wypełniająca, gaśnie z promieniem.
  var FALA_W = 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }';
  var FALA_F = 'uniform vec3 uKolor; uniform float uSila; varying vec3 vN; varying vec3 vV;\n' +
    'void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float a = (pow(f, 3.0) * 0.9 + 0.035) * uSila; gl_FragColor = vec4(uKolor * a, a); }';
  // Promień odbicia: wąski stożek wzdłuż y, jasny przy czole (vY = 1), z ogonem.
  var PROMIEN_W = 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  var PROMIEN_F = 'uniform vec3 uKolor; uniform float uSila; varying float vY;\n' +
    'void main(){ float d = 1.0 - vY; float a = (d < 0.0 ? 0.0 : exp(-d * 3.0)) * smoothstep(0.0, 0.04, vY) * uSila; gl_FragColor = vec4(uKolor * a, a); }';
  // Echo: kula — przy dużym promieniu zielony obłok (echo zwykłego samolotu), przy małym szklana kulka (obrys + odblask).
  var ECHO_F = 'uniform vec3 uKolor; uniform float uSila; uniform float uSzklo; varying vec3 vN; varying vec3 vV;\n' +
    'void main(){ vec3 n = normalize(vN), v = normalize(vV); float f = 1.0 - abs(dot(n, v));\n' +
    '  float blask = pow(max(dot(reflect(-v, n), normalize(vec3(0.4, 0.8, 0.3))), 0.0), 40.0);\n' +
    '  vec3 c = mix(uKolor * (0.25 + 1.2 * pow(f, 2.0)), vec3(0.75, 0.95, 1.0) * (0.12 + 1.6 * pow(f, 3.0)) + blask * 2.5, uSzklo);\n' +
    '  float a = mix(0.18 + 0.7 * pow(f, 2.0), 0.35 + 0.65 * pow(f, 2.0) + blask, uSzklo) * uSila; gl_FragColor = vec4(c * a, a); }';

  // Budowa w razie wyjątku (makieta, plan, silniki, shader) sprząta to, co zdążyła zebrać, i rzuca dalej — wzorzec
  // zbudujPost z kino.js. Makietę zwalnia widok (on ją zbudował); tu tylko odpinamy jej grupę.
  function uruchom(ctx, ujecia) {
    var zb = { zasoby: { geo: [], mat: [], tex: [] } };
    try { return zbuduj(ctx, ujecia, zb); } catch (e) {
      try { if (zb.sil) zb.sil.zwolnij(); } catch (_) { /* sprzątamy resztę */ }
      if (zb.mk && zb.mk.grupa.parent) zb.mk.grupa.parent.remove(zb.mk.grupa);
      zwolnijZasoby(zb);
      throw e;
    }
  }
  // Zasoby GPU świata pokazu: geometrie, materiały, tekstury, env PMREM, mapa cienia słońca (też przy nieudanej budowie).
  function zwolnijZasoby(zb) {
    ['geo', 'mat', 'tex'].forEach(function (k) { zb.zasoby[k].forEach(function (x) { try { x.dispose(); } catch (_) { /* dalej */ } }); });
    if (zb.env) zb.env.dispose();
    if (zb.slonce && zb.slonce.shadow && zb.slonce.shadow.map) { zb.slonce.shadow.map.dispose(); zb.slonce.shadow.map = null; }
  }
  function zbuduj(ctx, ujecia, zb) {
    var T = ctx.THREE, renderer = ctx.renderer;
    var smoke = !!ctx.smoke, jakosc = ctx.jakosc || 'pelna', dzwiek = ctx.dzwiek || null;
    var zasoby = zb.zasoby;
    function g(x) { zasoby.geo.push(x); return x; }
    function m(x) { zasoby.mat.push(x); return x; }
    function tx(x) { zasoby.tex.push(x); return x; }

    var scena = new T.Scene();
    var kamera = new T.PerspectiveCamera(32, 2.39, 0.3, 60000);
    var SLONCE = new T.Vector3(0.62, 0.42, 0.66).normalize();
    var MGLA_KOL = new T.Color(0x9fb0c0);
    scena.fog = new T.FogExp2(MGLA_KOL.getHex(), 0.0001);

    // niebo (w env do odbić i jako tło — kula wokół kamery, rysowana na dalekiej płaszczyźnie)
    var lin = function (h) { return new T.Color(h).convertSRGBToLinear(); };
    var uNieba = { uSlonce: { value: SLONCE.clone() }, uZenit: { value: lin(0x2f5f9e) }, uHoryzont: { value: lin(0xc9d6e2) },
      uDol: { value: lin(0x8c9aa6) }, uKolSlonca: { value: new T.Color(1.0, 0.86, 0.66) }, uMglaKol: { value: MGLA_KOL.clone() },
      uMgla: { value: 0 }, uRadar: { value: 0 } };
    var matNieba = m(new T.ShaderMaterial({ uniforms: uNieba, vertexShader: NIEBO_W, fragmentShader: NIEBO_F, side: T.BackSide, depthWrite: false, depthTest: false, fog: false }));
    var niebo = new T.Mesh(g(new T.SphereGeometry(1000, 48, 24)), matNieba);
    niebo.frustumCulled = false; niebo.renderOrder = -10; scena.add(niebo);
    var env = (function () {
      var s = new T.Scene(), kula = new T.Mesh(g(new T.SphereGeometry(50, 32, 16)), matNieba);
      s.add(kula);
      var pm = new T.PMREMGenerator(renderer), rt = pm.fromScene(s, 0.02);
      pm.dispose();
      return rt;
    })();
    zb.env = env;

    // światła: słońce z cieniem (ramka wokół maszyny), półsfera, światło odbite od ziemi (kierunkowe od dołu w barwie pól,
    // bez cienia — półsfera 0,75 dawała brzuchowi w cieniu L ≈ 18; istnieje od budowy sceny: liczba świateł jest w kluczu
    // programu, w radarze ma moc 0)
    var slonce = new T.DirectionalLight(0xfff0dc, 2.3), polsfera = new T.HemisphereLight(0x9db8d8, 0x6a6150, 0.75);
    var odbite = new T.DirectionalLight(0xc8c39a, ODBITE);
    odbite.position.set(0, -1, 0.15); odbite.target.position.set(0, 0, 0);
    scena.add(slonce); scena.add(slonce.target); scena.add(polsfera); scena.add(odbite); scena.add(odbite.target); zb.slonce = slonce;
    slonce.castShadow = jakosc === 'pelna';
    slonce.shadow.mapSize.set(2048, 2048); slonce.shadow.bias = -0.0005; slonce.shadow.normalBias = 0.03;

    // maszyna (makieta budowana przez widok z env nieba)
    var mk = zb.mk = typeof ctx.makieta === 'function' ? ctx.makieta(env.texture) : ctx.makieta;
    if (typeof ujecia === 'function') ujecia = ujecia(mk);           // plan z bryły tej makiety (kotwice części)
    var o = mk.obwiednia, L = o.max[0] - o.min[0], R = Math.max(L, o.max[2] - o.min[2]);
    slonce.position.copy(SLONCE).multiplyScalar(2 * R);                // stałe: cel w początku układu
    var sc = slonce.shadow.camera; sc.left = sc.bottom = -0.7 * R; sc.right = sc.top = 0.7 * R; sc.near = 1; sc.far = 4 * R; sc.updateProjectionMatrix();
    var nosnik = new T.Group(); nosnik.name = 'pokaz:maszyna';
    nosnik.add(mk.grupa); mk.grupa.position.set(0, 0, 0); scena.add(nosnik);
    var sil = zb.sil = root.Silniki.utworz(T, Object.assign({ scena: scena, wyloty: mk.wyloty, rodzic: mk.czesci.dysze, dzwiek: dzwiek, jakosc: jakosc },
      root.Ogien.opcjeMaszyny(ctx.mysliwiec, true)));               // dzień; hologram ⇔ niesfotografowany (jak makieta)

    // ziemia daleko w dole
    var texZiemi = tx(teksturaZiemi(T)), KAFEL = 1600, BOK = 90000;
    texZiemi.repeat.set(BOK / KAFEL, BOK / KAFEL);
    var ziemia = new T.Mesh(g(new T.PlaneGeometry(BOK, BOK)), m(new T.MeshLambertMaterial({ color: 0xffffff, map: texZiemi })));
    ziemia.rotation.x = -Math.PI / 2; scena.add(ziemia);

    // chmury: billboardy w pudle 4 × 4 km zawijanym wzdłuż lotu; korytarz lotu (|z| < 180 m) wolny
    var texChmur = [tx(teksturaChmury(T, 11)), tx(teksturaChmury(T, 23)), tx(teksturaChmury(T, 37))];
    var matChmur = texChmur.map(function (t) { return m(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: true, opacity: 0.92 })); });
    var chmury = [], losC = generator(777), PUDLO = 4000, LICZBA_CHMUR = 84;
    for (var i = 0; i < LICZBA_CHMUR; i++) {
      var warstwa = i % 3 === 0 ? 900 + losC() * 500 : 330 + losC() * 420, z = (losC() - 0.5) * PUDLO;
      if (Math.abs(z) < 180) z = (z < 0 ? -1 : 1) * (180 + losC() * 400);
      var sp = new T.Sprite(matChmur[i % 3]), sk = 160 + losC() * 300;
      sp.scale.set(sk * 1.6, sk, 1);
      sp.userData = { x0: losC() * PUDLO, y0: warstwa, z0: z, lekka: i % 2 === 1 };
      chmury.push(sp); scena.add(sp);
    }

    // radar: nadajnik, fala, promienie odbić, echo
    var radar = new T.Group(); radar.visible = false; scena.add(radar);
    var ZIELEN = new T.Color(0.35, 1.0, 0.72);
    var matFali = m(new T.ShaderMaterial({ uniforms: { uKolor: { value: ZIELEN }, uSila: { value: 0 } }, vertexShader: FALA_W, fragmentShader: FALA_F,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    var fala = new T.Mesh(g(new T.SphereGeometry(1, 64, 32)), matFali); radar.add(fala);
    var maszt = new T.Mesh(g(new T.ConeGeometry(0.012 * R, 0.09 * R, 8)), m(new T.MeshStandardMaterial({ color: 0x223038, roughness: 0.6, metalness: 0.4 })));
    var lampa = new T.Mesh(g(new T.SphereGeometry(0.008 * R, 12, 8)), m(new T.MeshBasicMaterial({ color: 0x7dffc8 })));
    radar.add(maszt); radar.add(lampa);
    var KIER_ODBIC = [[0.74, 0.08, 0.67], [0.74, 0.08, -0.67], [-0.74, 0.05, 0.67], [-0.74, 0.05, -0.67], [0.12, 0.98, 0.14]];
    var geoPromienia = g(new T.CylinderGeometry(0.006 * R, 0.09 * R, 1, 12, 1, true)); geoPromienia.translate(0, 0.5, 0);
    var promienie = KIER_ODBIC.map(function (k) {
      var mat = m(new T.ShaderMaterial({ uniforms: { uKolor: { value: ZIELEN }, uSila: { value: 0 } }, vertexShader: PROMIEN_W,
        fragmentShader: PROMIEN_F, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
      var p = new T.Mesh(geoPromienia, mat);
      p.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3().fromArray(k).normalize());
      radar.add(p); return p;
    });
    var matEcha = m(new T.ShaderMaterial({ uniforms: { uKolor: { value: ZIELEN }, uSila: { value: 0 }, uSzklo: { value: 0 } }, vertexShader: FALA_W,
      fragmentShader: ECHO_F, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    var echo = new T.Mesh(g(new T.SphereGeometry(1, 40, 20)), matEcha); radar.add(echo);
    // programy fali, promieni i echa kompilowane przy budowie, nie na cięciu do radaru (zacięcie 32–61 ms w pierwszej klatce)
    if (renderer.compile) {
      radar.visible = true; fala.visible = echo.visible = true; promienie.forEach(function (p) { p.visible = true; });
      try { renderer.compile(scena, kamera); } catch (_) { /* kompilacja przy pierwszej klatce radaru */ }
      radar.visible = false;
    }

    /* ---------- stan odtwarzania ---------- */
    var stan = { n: 0, t: 0, pauza: false, koniec: false }, pokazanyWers = null, pokazanyTytul = null, kartaWl = null, etykietaWl = false;
    var przelotZagrany = -1, glosyUjecia = [], wek = new T.Vector3(), nadajnik = new T.Vector3(), q = new T.Quaternion(), eu = new T.Euler(0, 0, 0, 'YXZ'), w = 2.39, h = 1;
    var nazwyCzesci = {};
    (ctx.czesci || []).forEach(function (c) { nazwyCzesci[c.rodzaj] = c.nazwa; });

    var poza = { poz: [0, 0, 0], q: [0, 0, 0, 1] };             // wynik kolysanie (jeden obiekt na klatkę, bez alokacji)
    function kolysanie(tg, sila) {
      // układ samolotu (x = nos): przechylenie = obrót wokół x, odchylenie wokół y, pochylenie wokół z
      eu.set(sila * (0.06 * Math.sin(0.9 * tg) + 0.025 * Math.sin(2.1 * tg + 1)), sila * 0.01 * Math.sin(0.5 * tg + 2), sila * 0.016 * Math.sin(0.7 * tg + 0.5), 'YXZ');
      q.setFromEuler(eu);
      poza.poz[1] = sila * (0.35 * Math.sin(0.8 * tg) + 0.15 * Math.sin(1.9 * tg + 0.3));
      poza.q[0] = q.x; poza.q[1] = q.y; poza.q[2] = q.z; poza.q[3] = q.w;
      return poza;
    }
    function zastosuj() {
      var u = ujecia[stan.n], t = stan.t, f = u.czas > 0 ? t / u.czas : 0, ef = u.efekty || {};
      var tg = Pokaz.startUjecia(ujecia, stan.n) + t, radarWl = u.typ === 'radar';
      var sila = radarWl ? 0 : u.typ === 'rozklad' ? 0.45 : 1;
      kolysanie(tg, sila);
      nosnik.position.fromArray(poza.poz); nosnik.quaternion.fromArray(poza.q);
      // maszyna: rozłożenie, komory, ciąg (dokładnie z krzywej — kadr deterministyczny), płomień w czasie globalnym
      var rozl = krzywa(ef.rozloz, f, 0);
      mk.rozloz(rozl); mk.komory(krzywa(ef.komory, f, 0));
      // w locie podwozie schowane (widać je tylko w rozkładzie i w ujęciu podwozia)
      if (mk.czesci.podwozie) mk.czesci.podwozie.visible = rozl > 0.02 || u.czesc === 'podwozie';
      sil.ustaw(krzywa(ef.ciag, f, 0), true); sil.krok(0, tg);
      mk.aktualizuj(tg);
      // świat: wysokość, droga, mgła
      var hgt = Pokaz.wysokosc(ujecia, stan.n, t), dr = Pokaz.droga(ujecia, stan.n, t), mg = krzywa(ef.mgla, f, 0);
      ziemia.visible = !radarWl; ziemia.position.y = -hgt;
      texZiemi.offset.set((dr / KAFEL) % 1, 0);
      chmury.forEach(function (c) {
        var d = c.userData, x = ((d.x0 - dr) % PUDLO + PUDLO) % PUDLO - PUDLO / 2;
        c.position.set(x, d.y0 - hgt, d.z0);
        c.visible = !radarWl && !(jakosc === 'lekka' && d.lekka);
      });
      scena.fog.density = radarWl ? 0 : 0.00009 + 0.06 * mg * mg;
      uNieba.uMgla.value = Math.min(1, mg * 2.2); uNieba.uRadar.value = radarWl ? 1 : 0;
      slonce.intensity = radarWl ? SWIATLO_RADARU.slonce : 2.3; polsfera.intensity = radarWl ? SWIATLO_RADARU.polsfera : 0.75;
      odbite.intensity = radarWl ? 0 : ODBITE;
      radar.visible = radarWl;
      if (radarWl) radarKlatka(ef.radar, t);
      // kamera: klucze w układzie samolotu → świat (telefon w pionie: szerzej i dalej — Pokaz.kameraKadru)
      var kp = kameraKadru(K.kameraPoscigu(t, u.kamera), ujecia, stan.n, t, w, h);
      var pw = K.doSwiata(poza.poz, poza.q, kp.poz), cw = K.doSwiata(poza.poz, poza.q, kp.cel);
      kamera.position.fromArray(pw); kamera.lookAt(cw[0], cw[1], cw[2]);
      kamera.fov = kp.fov; kamera.aspect = w / h;
      var off = ef.karta && ctx.przesuniecieKarty ? ctx.przesuniecieKarty() : 0;
      if (Math.abs(off) > 0.5) kamera.setViewOffset(w, h, -off, 0, w, h); else kamera.clearViewOffset();
      kamera.updateProjectionMatrix(); kamera.updateMatrixWorld();
      niebo.position.copy(kamera.position);
      // napisy, plansza tytułu, karta, podpis części
      var wers = null;
      for (var j = 0; j < u.napisy.length; j++) if (t >= u.napisy[j].start && t < u.napisy[j].koniec) { wers = u.wersy[j]; break; }
      if (ctx.napisy && (wers && wers.id) !== pokazanyWers) { pokazanyWers = wers && wers.id; ctx.napisy.pokaz(wers); }
      var tyt = ef.tytul && t >= ef.tytul[0] && t < ef.tytul[1] ? ctx.mysliwiec.nazwa : null;
      if (ctx.napisy && tyt !== pokazanyTytul) { pokazanyTytul = tyt; ctx.napisy.tytul(tyt); }
      // karta finału: na wąskim ekranie (arkusz od dołu, mysliwce.css) dopiero po ostatnim wersie — nie leży na napisie
      var karta = !!ef.karta && (w >= KARTA_WASKI || !u.napisy.length || t >= u.napisy[u.napisy.length - 1].koniec);
      if (karta !== kartaWl && ctx.karta) { kartaWl = karta; ctx.karta(karta); }
      etykieta(u, f);
    }
    function etykieta(u, f) {
      if (!ctx.etykieta) return;
      var wl = u.typ === 'czesc' && f > 0.36 && f < 0.96 && mk.czesci[u.czesc];
      if (wl) {
        var c = mk.czesci[u.czesc];
        c.updateMatrixWorld(true);
        wek.copy(c.userData.kotwica); c.localToWorld(wek); wek.project(kamera);
        if (wek.z < 1) { ctx.etykieta(nazwyCzesci[u.czesc] || u.czesc, (wek.x + 1) / 2 * w, (1 - wek.y) / 2 * h); etykietaWl = true; return; }
      }
      if (etykietaWl) { ctx.etykieta(null); etykietaWl = false; }
    }
    function radarKlatka(r, t) {
      var P = nadajnik.fromArray(r.nadajnik), dlug = P.length(), pr = dlug / r.droga;   // prędkość fali [m/s] w kadrze
      maszt.position.copy(P); maszt.position.y -= 0.045 * R; lampa.position.copy(P);
      lampa.visible = (t * 2.2) % 1 < 0.6;
      var k = Math.floor((t - r.pierwszy) / r.okres), te = r.pierwszy + k * r.okres, tf = t - te;
      if (k < 0) { fala.visible = false; promienie.forEach(function (p) { p.visible = false; }); echo.visible = false; return; }
      var ile = Math.max(1, Math.floor((ujecia[stan.n].czas - r.pierwszy) / r.okres));
      var rf = pr * tf;
      fala.visible = true; fala.position.copy(P); fala.scale.setScalar(Math.max(0.01, rf));
      matFali.uniforms.uSila.value = 0.9 * (1 - gladko(rf / (dlug * 1.9)));
      var tu = tf - r.droga;                                                   // czas od uderzenia fali w maszynę
      promienie.forEach(function (p) {
        p.visible = tu > 0; if (!p.visible) return;
        var dl = Math.max(0.01, pr * tu); p.scale.set(1, dl, 1);
        p.material.uniforms.uSila.value = 0.9 * Math.exp(-tu * 0.9);
      });
      // echo wraca do nadajnika; jego rozmiar maleje z każdym impulsem: obłok zwykłego samolotu → szklana kulka
      var wk = gladko(k / Math.max(1, ile - 1)), re = r.echo[0] + (r.echo[1] - r.echo[0]) * Math.pow(wk, 0.6);
      echo.visible = tu > 0 && tu < r.droga * 1.15;
      if (echo.visible) {
        echo.position.copy(P).multiplyScalar(Math.min(1, tu / r.droga));
        echo.scale.setScalar(re); matEcha.uniforms.uSzklo.value = wk; matEcha.uniforms.uSila.value = 1 - gladko((tu - r.droga) / (0.15 * r.droga));
      }
    }
    function renderuj() {
      ctx.post.renderuj(scena, kamera, { czas: Pokaz.startUjecia(ujecia, stan.n) + stan.t, zrodlaGoraca: sil.zrodlaGoraca() });
    }
    // Głosy ujęcia (przelot, grom) gasną przy zmianie ujęcia (→/←, idz, ustaw), odpięciu dźwięku i zwolnieniu pokazu —
    // inaczej grały po wyjściu z ujęcia, a powrót ← na przelot kładł drugi głos na pierwszy. Naturalne przejście do
    // następnego ujęcia (krok) ich nie ucina: przelot kończy się z ujęciem, grom wybrzmiewa.
    function ucisz() { for (var i = 0; i < glosyUjecia.length; i++) glosyUjecia[i].zatrzymaj(); glosyUjecia.length = 0; }
    // dźwięk ujęcia: przelot z Dopplerem (najbliżej w chwili minimalnej odległości kamery) i grom, gdy przelot naddźwiękowy
    function dzwiekUjecia() {
      var u = ujecia[stan.n];
      if (!dzwiek || smoke || stan.pauza || przelotZagrany === stan.n || u.typ !== 'przelot') return;
      przelotZagrany = stan.n;
      var tMin = 0, dMin = Infinity;
      for (var t = 0; t <= u.czas; t += 0.05) { var kp = K.kameraPoscigu(t, u.kamera), d = Math.hypot(kp.poz[0], kp.poz[1], kp.poz[2]); if (d < dMin) { dMin = d; tMin = t; } }
      if (tMin <= stan.t) return;
      var dt = tMin - stan.t, c0 = dzwiek.ctx.currentTime;
      glosyUjecia.push(dzwiek.przelot({ v: 190, odleglosc: Math.max(8, dMin), tMin: dt, czas: Math.max(1, u.czas - stan.t), ciag: 1, strona: -1, kiedy: c0 }));
      if (u.lot.v > 343) glosyUjecia.push(dzwiek.grom(c0 + dt + 0.12));
    }
    function ustaw(n, t) {
      n = przytnij(Math.floor(+n || 0), 0, ujecia.length - 1);
      if (n !== stan.n) { przelotZagrany = -1; ucisz(); }
      stan.n = n; stan.t = przytnij(+t || 0, 0, ujecia[n].czas); stan.koniec = false;
      zastosuj();
    }

    if (dzwiek) dzwiek.ambient('niebo');
    ustaw(0, 0);

    var api = {
      scena: scena, kamera: kamera, makieta: mk, silniki: sil,
      ustaw: ustaw,
      idz: function (n) { ustaw(n, 0); dzwiekUjecia(); },
      pauza: function (p) { stan.pauza = !!p; if (!stan.pauza) dzwiekUjecia(); },
      t: function () { return Pokaz.startUjecia(ujecia, stan.n) + stan.t; },
      // krok czasu rzeczywistego (pauza i smoke: czas stoi) + render
      krok: function (dt) {
        if (!stan.pauza && !smoke && !stan.koniec) {
          var t = stan.t + dt;
          if (t >= ujecia[stan.n].czas) {
            if (stan.n < ujecia.length - 1) { stan.n++; t -= ujecia[stan.n - 1].czas; t = Math.min(t, ujecia[stan.n].czas); }
            else { t = ujecia[stan.n].czas; stan.koniec = true; if (ctx.koniec) ctx.koniec(); }
          }
          stan.t = t;
          dzwiekUjecia();
        }
        zastosuj();
        renderuj();
      },
      renderuj: function () { zastosuj(); renderuj(); },
      stan: function () { var u = ujecia[stan.n]; return { ujecie: stan.n, id: u.id, typ: u.typ, t: stan.t, czas: u.czas, pauza: stan.pauza, koniec: stan.koniec, ujec: ujecia.length }; },
      rozmiar: function (sz, wy) { if (sz > 0 && wy > 0) { w = sz; h = wy; } },
      jakosc: function (j) { jakosc = j === 'lekka' ? 'lekka' : 'pelna'; sil.jakosc(jakosc); slonce.castShadow = jakosc === 'pelna'; },
      dzwiek: function (d) { if ((d || null) !== dzwiek) ucisz(); dzwiek = d || null; sil.dzwiek(dzwiek); if (dzwiek) { dzwiek.ambient('niebo'); przelotZagrany = -1; dzwiekUjecia(); } },
      zwolnij: function () {
        ucisz();
        sil.zwolnij();
        if (ctx.napisy) { ctx.napisy.pokaz(null); ctx.napisy.tytul(null); }
        if (ctx.etykieta) ctx.etykieta(null);
        if (ctx.karta) ctx.karta(false);
        nosnik.remove(mk.grupa);
        zwolnijZasoby(zb);
        renderer.renderLists.dispose();
      },
    };
    return api;
  }
  Pokaz.uruchom = uruchom;

  if (typeof module !== 'undefined' && module.exports) module.exports = Pokaz;
  else root.Pokaz = Pokaz;
})(typeof window !== 'undefined' ? window : globalThis);
