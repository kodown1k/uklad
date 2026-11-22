'use strict';
/* Zakładka Myśliwce — hangar: menu 3D z dziewięcioma makietami w jednej skali (1 m = 1 jednostka).
   Czyste (dual-export, testy w node):
     MysliwceHangar.ustawienie(maszyny [{ id, dl, rozp }], { odstep=4, promien=PROMIEN, skos=SKOS }) → [{ id, poz:[x,y,z], obrot, kat }]
       Łuk wokół kamery: każda makieta w tej samej odległości `promien` od osi kamery (większa maszyna wygląda na większą,
       bo jest większa — nie dlatego, że stoi bliżej), nosem do kamery skręconym o `skos` (ustawienie „w jodełkę” jak na
       płycie postojowej — widać bok i grzbiet, nie sam przód). Kolejność raportu od lewej (patrząc z kamery wzdłuż −z).
       Kolejne makiety odsuwane po łuku, aż prostokąty dl × rozp powiększone o odstep/2 z każdej strony są rozłączne
       z każdą wcześniejszą (SAT) — bisekcja kąta, wynik deterministyczny; łuk symetryczny względem osi −z.
       `obrot` = rotation.y grupy makiety (lokalne +x = nos), `kat` = azymut środka makiety (0 = oś −z, + w prawo).
     MysliwceHangar.nastepny(id, kierunek 1|-1) → id — kolejność raportu, zawija; bez wybranej (null/nieznany) → środek łuku.
     MysliwceHangar.jakoscPoczatek() / krokJakosci(stan, fps|null, tryb) / wejscieJakosci(stan, tryb) → { stan, jakosc } —
       decyzja lekka/pełna dla widoku (opis przy funkcjach).
   Przeglądarkowe (THREE r128, bez dodatków z CDN):
     MysliwceHangar.zbuduj(THREE, { renderer, jakosc, smoke, ruch, fokus, anizotropia }) →
       { grupa, scena, kamera, hover(id|null), fokus(id|null), wybierz(id) → Promise (przelot kamery do maszyny),
         przelot(id, u) (kadr przelotu w chwili u 0..1 — hak zrzutów), trafienie(ndcX, ndcY) → id|null, animuj(t [s]),
         rozmiar(w, h), jakosc('pelna'|'lekka'), stan(), rzut(id) → środek maszyny w NDC (sonda), zwolnij() }
     Scena: studio (mysliwce/studio.js: tło, env PMREM, klucz, kontra, półsfera) bez posadzki obrotnicy i bez cieni z mapy —
     cień kontaktowy to plama na stanowisku. Posadzka: ciemna żywica z odbiciem „lustro przyciemnione” (kopie siatek makiet
     odbite scale.y = −1 pod półprzezroczystą posadzką; te same geometrie i materiały, zero nowych zasobów GPU na makietę).
     Jakość „lekka”: bez kopii lustrzanych — posadzka nieprzezroczysta, odbicie tylko z env. Nad każdą makietą reflektor:
     stożek światła w mgle (additive, miękkie brzegi z kąta patrzenia, kurz), plama na posadzce i lampa pod stropem.
     Hover/fokus → mocniejszy snop, jedno prawdziwe światło punktowe (SpotLight bez cienia) nad maszyną, tabliczka unosi
     się i rozjaśnia. Tabliczki: sprite z canvas (nazwa, kraj w kolorze KRAJE, generacja; niesfotografowane — ramka
     przerywana jak w raporcie). Makiety LOD `lekki`; `niesfotografowany` jako hologram (makieta.js).
     Kamera stoi w osi łuku i obraca się (wygaszony ruch) do maszyny w fokusie; bez fokusu patrzy w środek łuku. */
(function (root) {
  var D = (typeof module !== 'undefined' && module.exports) ? require('./dane.js') : root.MysliwceDane;
  var IDS = D.MYSLIWCE.map(function (m) { return m.id; });
  var PROMIEN = 74, SKOS = 0.4, ODSTEP = 4;
  // Kamera hangaru (recenzja kinowa r1, Ś1–Ś2; wariant H1 przyjęty przez właściciela 2026-11-21 — zmiana tylko tutaj):
  //   wys, cel [m] — oko i wysokość punktu patrzenia na łuku: nisko (9 m zamiast 21 m) skraca pustą posadzkę (było ~45%
  //   kadru) i wydłuża odbicia; fov [°] pionowy (pion telefonu: × do 1,9 w rozmiar());
  //   katMaks [rad] — dolna granica przycięcia kąta kamery: kąt przycięty do ±max(katMaks, połowa łuku − 0,3 pola
  //   poziomego) (rozmiar()): skrajna maszyna nie ląduje w środku pustego kadru, a stałe ±0,70 z recepty wypychało F-22A
  //   za lewą krawędź na 16:9 (przycięcie 0,754 na 3440×1440, 0,83 na 16:9, 0,95 w pionie telefonu);
  //   k [1/s²], vMaks [rad/s], aMaks [rad/s²] — obrót do fokusu z tłumieniem krytycznym i stanem prędkości (dojście
  //   wykładnicze skakało w pierwszej klatce do 150–300°/s), sufit prędkości 80°/s i przyspieszenia ~345°/s².
  var KAMERA = { wys: 9, cel: 3, fov: 30, katMaks: 0.70, k: 8, vMaks: 1.4, aMaks: 6.0 };
  // tabliczki: płótno TAB [px], TAB_SZER [m] szerokość sprite'a w świecie, TAB_MIN_PX — próg wiersza kraju (niżej)
  var TAB = { w: 640, h: 200 }, TAB_SZER = 12.5, TAB_MIN_PX = 11;
  var SUFIT = 26;                            // [m] wysokość lamp reflektorów
  var PRZEZROCZ_POSADZKI = 0.72, KOLOR_POSADZKI = 0x8a8d92;   // krycie żywicy nad odbiciem (1 − siła lustra)
  var SCIANA = { r: 165, wys: 46 };
  var PRZELOT_S = 1.8;
  var SWIATLO_FOKUSU = 1.1;                  // reflektor punktowy nad maszyną w fokusie (1,7 — makieta o połowę jaśniejsza niż w pokazie)
  var KOLORY_KRAJOW = { USA: '#6fa3d6', Rosja: '#d98aa0', Chiny: '#d2ae52' };   // zapas, gdy CSS nie podaje zmiennych

  /* ---------- czyste ---------- */
  function prostokat(poz, obrot, m, zapas) {
    var c = Math.cos(obrot), s = Math.sin(obrot), hx = m.dl / 2 + zapas, hz = m.rozp / 2 + zapas;
    return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(function (w) {
      return [poz[0] + c * hx * w[0] + s * hz * w[1], poz[2] - s * hx * w[0] + c * hz * w[1]];
    });
  }
  function rozlaczne(A, B) {
    for (var k = 0; k < 2; k++) {
      var P = k ? B : A;
      for (var i = 0; i < 4; i++) {
        var a = P[i], b = P[(i + 1) % 4], ox = a[1] - b[1], oz = b[0] - a[0];
        var minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity, j, r;
        for (j = 0; j < 4; j++) { r = A[j][0] * ox + A[j][1] * oz; if (r < minA) minA = r; if (r > maxA) maxA = r; }
        for (j = 0; j < 4; j++) { r = B[j][0] * ox + B[j][1] * oz; if (r < minB) minB = r; if (r > maxB) maxB = r; }
        if (maxA < minB || maxB < minA) return true;
      }
    }
    return false;
  }
  // Poza makiety na łuku: środek w azymucie `kat`, nos do kamery skręcony o `skos` (rotation.y: lokalne +x → (cos, −sin)).
  function poza(kat, R, skos) {
    var f = kat + skos;
    return { poz: [R * Math.sin(kat), 0, -R * Math.cos(kat)], obrot: Math.atan2(-Math.cos(f), -Math.sin(f)) };
  }
  function ustawienie(maszyny, o) {
    o = o || {};
    var odstep = o.odstep != null ? o.odstep : ODSTEP, R = o.promien || PROMIEN, skos = o.skos != null ? o.skos : SKOS;
    var katy = [], pr = [], kat = 0;
    maszyny.forEach(function (m, i) {
      if (i > 0) {
        var pasuje = function (d) {
          var p = poza(kat + d, R, skos), q = prostokat(p.poz, p.obrot, m, odstep / 2);
          for (var j = 0; j < pr.length; j++) if (!rozlaczne(pr[j], q)) return false;
          return true;
        };
        var lo = 0, hi = 0.5;
        while (!pasuje(hi) && hi < Math.PI) hi *= 2;
        for (var k = 0; k < 48; k++) { var s = (lo + hi) / 2; if (pasuje(s)) hi = s; else lo = s; }
        kat += hi * 1.0005;                   // włos zapasu ponad granicę bisekcji (rozłączność ostra, nie styk)
      }
      var p = poza(kat, R, skos);
      katy.push(kat); pr.push(prostokat(p.poz, p.obrot, m, odstep / 2));
    });
    var srodek = katy.length ? (katy[0] + katy[katy.length - 1]) / 2 : 0;
    return maszyny.map(function (m, i) {
      var k = katy[i] - srodek, p = poza(k, R, skos);
      return { id: m.id, poz: p.poz, obrot: p.obrot, kat: k };
    });
  }
  // Mnożnik szerokości tabliczki: większa na wąskim ekranie (clamp(1; 1,45 / proporcja; 1,9)), ale z sufitem z rozstawu
  // sąsiadów — tabliczka (z uniesieniem fokusu ×1,08) ≤ 0,92 rozstawu, więc sąsiednie się nie nakładają (bez sufitu w pionie
  // telefonu 225 px przy rozstawie ~200 px; recenzja kinowa r2, Ś-A). Kamera stoi w środku łuku, więc rozstaw na ekranie
  // względem szerokości tabliczki jest najciaśniejszy w osi kadru: wystarczy cięciwa najbliższej pary [m].
  // proporcja = szer./wys. kadru, rozstaw [m] = najmniejsza cięciwa między sąsiadami na łuku.
  function mnoznikTabliczki(proporcja, rozstaw) {
    var m = Math.max(1, Math.min(1.9, 1.45 / proporcja));
    return rozstaw > 0 ? Math.min(m, 0.92 * rozstaw / TAB_SZER) : m;
  }
  // Najmniejsza cięciwa między sąsiadami ustawienia (ustawienie(): kąty rosnące) [m].
  function rozstawLuku(uklad, promien) {
    var r = promien || PROMIEN, k = uklad.map(function (u) { return u.kat; }).sort(function (a, b) { return a - b; }), min = Infinity;
    for (var i = 1; i < k.length; i++) min = Math.min(min, 2 * r * Math.sin((k[i] - k[i - 1]) / 2));
    return min;
  }
  function nastepny(id, kierunek) {
    var i = IDS.indexOf(id), n = IDS.length;
    if (i < 0) return IDS[Math.floor(n / 2)];
    return IDS[(i + (kierunek < 0 ? -1 : 1) + n) % n];
  }

  /* Jakość obrazu lekka/pełna (decyzja widoku, pomiar fps co sekundę). Stan: { jakosc (bieżąca), poza (wywalczona poza
     hangarem — pokaz i makieta), slabe, mocne [s], powrot (bieżąca pełna w hangarze to powrót z lekkiej), bezPowrotu }.
     - fps < 30 przez 2 s przy pełnej → lekka i `poza` = lekka (pokaz/makieta pamiętają ją na sesję) — także spadek
       w samym hangarze: to lżejsza scena, więc skoro nie utrzymał pełnej, pokaz i makieta też nie utrzymają;
     - w hangarze lekka + ≥ 50 fps przez 5 s → pełna (powrot); spadek pełnej wywalczonej powrotem → bezPowrotu na sesję
       (bez huśtawki, bez okna czasowego);
     - wejście w pokaz/makietę → jakość `poza` (pełna z hangaru nie przechodzi na cięższą scenę);
     - fps null (smoke, karta w tle) → liczniki od zera. */
  function jakoscPoczatek() { return { jakosc: 'pelna', poza: 'pelna', slabe: 0, mocne: 0, powrot: false, bezPowrotu: false }; }
  function krokJakosci(stan0, fps, tryb) {
    var s = Object.assign({}, stan0), mierz = fps != null && isFinite(fps), hangar = tryb === 'hangar';
    s.slabe = mierz && fps < 30 ? s.slabe + 1 : 0;
    s.mocne = mierz && fps >= 50 && hangar ? s.mocne + 1 : 0;
    if (s.slabe >= 2 && s.jakosc === 'pelna') {
      s.jakosc = 'lekka'; s.slabe = 0;
      if (hangar && s.powrot) s.bezPowrotu = true;
      s.poza = 'lekka';
      s.powrot = false;
    } else if (s.mocne >= 5 && s.jakosc === 'lekka' && hangar && !s.bezPowrotu) {
      s.jakosc = 'pelna'; s.powrot = true; s.mocne = 0;
    }
    return { stan: s, jakosc: s.jakosc };
  }
  function wejscieJakosci(stan0, tryb) {
    var s = Object.assign({}, stan0);
    s.slabe = 0; s.mocne = 0;
    if (tryb !== 'hangar' && s.jakosc !== s.poza) { s.jakosc = s.poza; s.powrot = false; }
    return { stan: s, jakosc: s.jakosc };
  }

  var api = { IDS: IDS, PROMIEN: PROMIEN, SKOS: SKOS, TAB_SZER: TAB_SZER, ustawienie: ustawienie, nastepny: nastepny,
    mnoznikTabliczki: mnoznikTabliczki, rozstawLuku: rozstawLuku,
    jakoscPoczatek: jakoscPoczatek, krokJakosci: krokJakosci, wejscieJakosci: wejscieJakosci };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---------- przeglądarka: tekstury z canvas ---------- */
  function plotno(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function losowe(ziarno) { var a = ziarno >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // Żywica posadzki: ciemny grafit z plamkami (kafel bezszwowy, powtarzany).
  function teksturaZywicy(T) {
    var N = 512, c = plotno(N, N), x = c.getContext('2d'), los = losowe(20261120), i;
    x.fillStyle = '#4a4d51'; x.fillRect(0, 0, N, N);
    for (i = 0; i < 1400; i++) {
      var v = 62 + Math.floor(los() * 26), r = 2 + los() * 16, px = los() * N, py = los() * N;
      x.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 3) + ',0.22)';
      for (var dx = -N; dx <= N; dx += N) for (var dy = -N; dy <= N; dy += N) { x.beginPath(); x.arc(px + dx, py + dy, r, 0, 6.2832); x.fill(); }
    }
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 8;
    return t;
  }
  // Ściana hali: pionowe żebra konstrukcji, pas świetlików pod stropem (bez okien w dole — noc, hala zamknięta).
  function teksturaSciany(T) {
    var W = 512, H = 256, c = plotno(W, H), x = c.getContext('2d'), i;
    x.fillStyle = '#16191d'; x.fillRect(0, 0, W, H);
    for (i = 0; i < 4; i++) { x.fillStyle = '#0c0e11'; x.fillRect(i * 128, 0, 14, H); x.fillStyle = '#20242a'; x.fillRect(i * 128 + 14, 0, 3, H); }
    for (i = 0; i < 12; i++) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, i * 22, W, 2); }
    x.fillStyle = '#9fb2c4'; for (i = 0; i < 4; i++) x.fillRect(i * 128 + 30, 26, 70, 9);
    var t = new T.CanvasTexture(c); t.wrapS = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    return t;
  }
  // Stanowisko: cień kontaktowy (ciemna elipsa) + malowana ramka postojowa z narożnikami i osią (żółta farba).
  function teksturaStanowiska(T) {
    var N = 512, c = plotno(N, N), x = c.getContext('2d');
    var g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N * 0.36);
    g.addColorStop(0, 'rgba(0,0,0,0.78)'); g.addColorStop(0.55, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, N, N);
    x.strokeStyle = 'rgba(226,178,72,0.85)'; x.lineWidth = 7;
    var m = 18, d = 70;
    [[m, m, 1, 1], [N - m, m, -1, 1], [N - m, N - m, -1, -1], [m, N - m, 1, -1]].forEach(function (k) {
      x.beginPath(); x.moveTo(k[0] + k[2] * d, k[1]); x.lineTo(k[0], k[1]); x.lineTo(k[0], k[1] + k[3] * d); x.stroke();
    });
    x.setLineDash([26, 18]); x.lineWidth = 5;
    x.beginPath(); x.moveTo(m + 30, N / 2); x.lineTo(N - m - 30, N / 2); x.stroke();
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    return t;
  }
  // Plama reflektora na posadzce (dodawana).
  function teksturaPlamy(T) {
    var N = 256, c = plotno(N, N), x = c.getContext('2d'), g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(0.8, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, N, N);
    return new T.CanvasTexture(c);
  }
  function kolorKraju(kraj) {
    var zm = D.KRAJE[kraj] && D.KRAJE[kraj].kolor, v = '';
    try { if (zm) v = getComputedStyle(document.documentElement).getPropertyValue(zm).trim(); } catch (_) { /* brak CSS */ }
    return v || KOLORY_KRAJOW[kraj] || '#cfd6dd';
  }
  // Tabliczka: kraj (kolor państwa) · generacja nad nazwą; pasek koloru kraju z lewej; niesfotografowane — ramka przerywana.
  // Szerokość tabliczki: TAB_SZER × mnoznikTabliczki (proporcja ekranu z sufitem z rozstawu sąsiadów); gdy wiersz
  // „kraj · generacja” wyszedłby mniejszy niż TAB_MIN_PX, tabliczka jednowierszowa (sama nazwa, kraj — kolorem paska)
  function rysujTabliczke(c, m, jednowierszowa) {
    var x = c.getContext('2d'), W = TAB.w, H = TAB.h, kol = kolorKraju(m.kraj);
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(6,9,13,0.82)'; x.fillRect(4, 4, W - 8, H - 8);
    x.fillStyle = kol; x.fillRect(4, 4, 12, H - 8);
    x.lineWidth = 3; x.strokeStyle = m.niesfotografowany ? kol : 'rgba(160,190,215,0.45)';
    if (m.niesfotografowany) x.setLineDash([18, 12]);
    x.strokeRect(5.5, 5.5, W - 11, H - 11); x.setLineDash([]);
    x.textBaseline = 'alphabetic';
    var yNazwy = 160;
    if (jednowierszowa) yNazwy = 134;
    else {
      x.font = '600 34px "IBM Plex Mono", ui-monospace, monospace';
      x.fillStyle = kol; x.fillText(m.kraj.toUpperCase(), 40, 62);
      var wk = x.measureText(m.kraj.toUpperCase() + '  ').width;
      x.fillStyle = 'rgba(210,220,230,0.8)'; x.fillText('· generacja ' + m.generacja, 40 + wk, 62);
    }
    x.font = (jednowierszowa ? '700 112px' : '700 92px') + ' "Barlow Condensed", "Arial Narrow", sans-serif';
    x.fillStyle = '#f2f5f8';
    var nazwa = m.nazwa.toUpperCase(), sz = x.measureText(nazwa).width, maks = W - 64;
    if (sz > maks) { x.save(); x.translate(40, yNazwy); x.scale(maks / sz, 1); x.fillText(nazwa, 0, 0); x.restore(); }
    else x.fillText(nazwa, 40, yNazwy);
  }

  /* ---------- przeglądarka: snop reflektora w mgle ---------- */
  var SNOP_V = 'varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vW;\n' +
    'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; vH = uv.y;\n' +
    '  vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * mv; }';
  var SNOP_F = 'uniform float uSila; uniform float uCzas; uniform vec3 uKolor;\n' +
    'varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vW;\n' +
    'void main(){\n' +
    '  float rdzen = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);\n' +           // gęsto w osi snopa, miękko na brzegach
    '  float wys = 0.32 + 0.68 * pow(vH, 1.7);\n' +                                     // jaśniej przy lampie
    '  float dol = smoothstep(0.0, 0.12, vH);\n' +                                      // przy posadzce snop przechodzi w plamę
    '  float kurz = 0.93 + 0.07 * sin(vW.y * 0.45 + uCzas * 0.35 + sin(vW.x * 0.31 + vW.z * 0.27 + uCzas * 0.21) * 1.5);\n' +
    '  float a = uSila * rdzen * wys * dol * kurz;\n' +
    '  gl_FragColor = vec4(uKolor * a, 1.0);\n' +
    '}';

  /* ---------- przeglądarka: zbuduj ---------- */
  // Wyjątek w trakcie budowy (makieta, shader, płótno) sprząta to, co zdążyło powstać — makiety, zasoby hangaru, studio
  // (env PMREM) — i rzuca dalej; widok wraca wtedy do Układu (wzorzec Pokaz.uruchom).
  function zbuduj(T, ctx) {
    var zb = { st: null, makiety: [], zasoby: { geo: [], mat: [], tex: [] } };
    try { return zbudujHangar(T, ctx || {}, zb); } catch (e) { zwolnijZasoby(zb); throw e; }
  }
  // Wspólne sprzątanie dla błędu budowy i zwolnij(): makiety, zasoby hangaru, studio (env PMREM); błąd jednego nie blokuje reszty.
  function zwolnijZasoby(zb) {
    zb.makiety.forEach(function (mk) { try { mk.zwolnij(); } catch (_) { /* dalej */ } });
    ['geo', 'mat', 'tex'].forEach(function (k) { zb.zasoby[k].forEach(function (x) { try { x.dispose(); } catch (_) { /* dalej */ } }); });
    if (zb.st) { try { zb.st.zwolnij(); } catch (_) { /* dalej */ } }
  }
  function zbudujHangar(T, ctx, zb) {
    var renderer = ctx.renderer, smoke = !!ctx.smoke, ruch = ctx.ruch !== false && !smoke;
    var st = zb.st = root.MysliwceStudio.zbuduj(T, renderer, { cienie: false });
    var scena = st.scena;
    st.posadzka.visible = false;                         // obrotnica makiety nie pasuje do hangaru
    st.reflektor.intensity = 0;
    st.klucz.intensity = 1.05;
    st.klucz.position.set(30, 60, 40);
    // kontra stromo znad hali: nisko z przodu dawała odblask-słup w błyszczącej posadzce przy kamerze obróconej w lewo
    st.swiatla.forEach(function (l) { if (l !== st.klucz && l !== st.reflektor && l.isDirectionalLight) l.position.set(0, 40, -12); });
    scena.fog = new T.Fog(0x0b1016, 95, 240);
    scena.traverse(function (o) { if (o.isHemisphereLight) o.intensity = 0.5; });

    var grupa = new T.Group(); grupa.name = 'hangar';
    var lustro = new T.Group(); lustro.name = 'hangar:lustro'; lustro.scale.y = -1;
    scena.add(grupa); scena.add(lustro);
    var zasoby = zb.zasoby;
    var g = function (x) { zasoby.geo.push(x); return x; }, m = function (x) { zasoby.mat.push(x); return x; }, t = function (x) { zasoby.tex.push(x); return x; };

    // posadzka: przyciemnione lustro nad podłogą-cieniem (odbite kopie makiet widać przez żywicę)
    var zywica = t(teksturaZywicy(T)); zywica.repeat.set(36, 36);
    var matPosadzki = m(new T.MeshStandardMaterial({ color: KOLOR_POSADZKI, map: zywica, roughness: 0.24, metalness: 0, envMap: st.env.texture,
      envMapIntensity: 0.16, transparent: true, opacity: PRZEZROCZ_POSADZKI }));
    var posadzka = new T.Mesh(g(new T.CircleGeometry(260, 96)), matPosadzki);
    posadzka.rotation.x = -Math.PI / 2; posadzka.name = 'hangar:posadzka'; posadzka.renderOrder = -1;
    grupa.add(posadzka);
    var podloga = new T.Mesh(g(new T.CircleGeometry(260, 48)), m(new T.MeshBasicMaterial({ color: 0x020304 })));
    podloga.rotation.x = -Math.PI / 2; podloga.position.y = -14; grupa.add(podloga);
    var texSciany = t(teksturaSciany(T)); texSciany.repeat.set(26, 1);
    var sciana = new T.Mesh(g(new T.CylinderGeometry(SCIANA.r, SCIANA.r, SCIANA.wys, 96, 1, true)),
      m(new T.MeshBasicMaterial({ map: texSciany, side: T.BackSide, color: 0x9aa0a8 })));
    sciana.position.y = SCIANA.wys / 2; grupa.add(sciana);
    // linie kołowania: łuk przed i za rzędem makiet
    var matLinii = m(new T.MeshBasicMaterial({ color: new T.Color(0xe2b248).multiplyScalar(0.55), transparent: true, opacity: 0.9, depthWrite: false }));
    [PROMIEN - 17, PROMIEN + 17].forEach(function (r) {
      var l = new T.Mesh(g(new T.RingGeometry(r - 0.18, r + 0.18, 160, 1, Math.PI / 2 - 1.35, 2.7)), matLinii);
      l.rotation.x = -Math.PI / 2; l.position.y = 0.012; grupa.add(l);
    });

    var maszyny = D.MYSLIWCE.map(function (x) { return { id: x.id, dl: x.wymiary.dl, rozp: x.wymiary.rozp }; });
    var uklad = ustawienie(maszyny);
    var texStan = t(teksturaStanowiska(T)), texPlamy = t(teksturaPlamy(T));
    var geoPlaska = g(new T.PlaneGeometry(1, 1)), geoSnopu = g(new T.CylinderGeometry(0.07, 1, 1, 40, 1, true));
    geoSnopu.translate(0, 0.5, 0);
    var geoPudla = g(new T.BoxGeometry(1, 1, 1)), geoLampy = g(new T.CylinderGeometry(0.9, 0.7, 0.5, 24));
    var matStan = m(new T.MeshBasicMaterial({ map: texStan, transparent: true, depthWrite: false }));
    var matPudla = m(new T.MeshBasicMaterial({ visible: false }));
    var matLampy = m(new T.MeshBasicMaterial({ color: new T.Color(0xfff2dc).multiplyScalar(1.6) }));
    var rc = new T.Raycaster(), ndc = new T.Vector2();

    var stanowiska = uklad.map(function (u, i) {
      var dane = D.mysliwiec(u.id);
      var mk = root.Makieta.zbuduj(T, u.id, { lod: 'lekki', env: st.env.texture, anizotropia: ctx.anizotropia || 4 });
      zb.makiety.push(mk);
      var s = new T.Group(); s.name = 'stanowisko:' + u.id;
      s.position.fromArray(u.poz); s.rotation.y = u.obrot;
      mk.grupa.position.y = -mk.obwiednia.min[1];
      mk.grupa.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      s.add(mk.grupa);
      var o = mk.obwiednia, dl = o.max[0] - o.min[0], rozp = o.max[2] - o.min[2], wys = o.max[1] - o.min[1];
      // stanowisko: cień kontaktowy i ramka
      var plama = new T.Mesh(geoPlaska, matStan);
      plama.rotation.x = -Math.PI / 2; plama.scale.set(dl * 1.18, rozp * 1.18, 1); plama.position.y = 0.02; plama.renderOrder = 0;
      s.add(plama);
      // pudło do wskazywania (niewidoczne; raycast tani zamiast po siatkach makiety)
      var pudlo = new T.Mesh(geoPudla, matPudla);
      pudlo.scale.set(dl, wys, rozp); pudlo.position.y = wys / 2; pudlo.userData.id = u.id;
      s.add(pudlo);
      grupa.add(s);
      // reflektor: snop w mgle, plama na posadzce, lampa pod stropem (w świecie, bez obrotu stanowiska)
      var promienPlamy = Math.max(dl, rozp) * 0.6;
      var matSnopu = m(new T.ShaderMaterial({ vertexShader: SNOP_V, fragmentShader: SNOP_F, transparent: true, depthWrite: false,
        blending: T.AdditiveBlending, uniforms: { uSila: { value: 0.1 }, uCzas: { value: 0 }, uKolor: { value: new T.Color(0xffe9cc) } } }));
      var snop = new T.Mesh(geoSnopu, matSnopu);
      snop.position.set(u.poz[0], 0, u.poz[2]); snop.scale.set(promienPlamy, SUFIT, promienPlamy); snop.renderOrder = 3;
      grupa.add(snop);
      var matPlamy = m(new T.MeshBasicMaterial({ map: texPlamy, color: new T.Color(0xffe2bf), transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false }));
      var swiatlo = new T.Mesh(geoPlaska, matPlamy);
      swiatlo.rotation.x = -Math.PI / 2; swiatlo.position.set(u.poz[0], 0.03, u.poz[2]); swiatlo.scale.set(promienPlamy * 2.3, promienPlamy * 2.3, 1); swiatlo.renderOrder = 1;
      grupa.add(swiatlo);
      var lampa = new T.Mesh(geoLampy, matLampy); lampa.position.set(u.poz[0], SUFIT + 0.25, u.poz[2]); grupa.add(lampa);
      // tabliczka nad maszyną
      var c = plotno(TAB.w, TAB.h); rysujTabliczke(c, dane);
      var texTab = t(new T.CanvasTexture(c)); texTab.encoding = T.sRGBEncoding; texTab.anisotropy = 4;
      var matTab = m(new T.SpriteMaterial({ map: texTab, transparent: true, opacity: 0.78, fog: false, depthWrite: false }));
      var tab = new T.Sprite(matTab);
      tab.scale.set(TAB_SZER, TAB_SZER * TAB.h / TAB.w, 1); tab.renderOrder = 4;   // skala ostateczna: zastosujSwiatla (× tabMn)
      var tabY = Math.max(wys, 4.6) + 3.6;
      tab.position.set(u.poz[0], tabY, u.poz[2]);
      grupa.add(tab);
      // odbicie: kopie siatek (te same geometrie i materiały) pod posadzką
      var kopia = kopiujSiatki(T, s);
      lustro.add(kopia);
      return { id: u.id, i: i, u: u, mk: mk, wezel: s, pudlo: pudlo, snop: matSnopu, plama: matPlamy, tab: tab, matTab: matTab, plotno: c, texTab: texTab,
        tabY: tabY, wys: wys, dl: dl, rozp: rozp, sila: 0, dane: dane };
    });
    var poId = {}, pudla = stanowiska.map(function (s) { return s.pudlo; });
    stanowiska.forEach(function (s) { poId[s.id] = s; });

    // jedno prawdziwe światło nad wskazaną maszyną (bez cienia)
    var punkt = new T.SpotLight(0xfff0d8, 0, 80, 0.36, 0.7, 1);
    punkt.position.set(0, SUFIT, -PROMIEN); punkt.target.position.set(0, 0, -PROMIEN);
    scena.add(punkt); scena.add(punkt.target);

    // czcionki z Google dochodzą leniwie — po wczytaniu tabliczki rysowane od nowa
    var zwolniony = false;
    try {
      if (document.fonts && document.fonts.load) {
        Promise.all([document.fonts.load('700 92px "Barlow Condensed"'), document.fonts.load('600 34px "IBM Plex Mono"')]).then(function () {
          if (zwolniony) return;
          stanowiska.forEach(function (s) { rysujTabliczke(s.plotno, s.dane, tabJedno); s.texTab.needsUpdate = true; });
        }, function () { /* zostają kroje zapasowe */ });
      }
    } catch (_) { /* brak FontFaceSet */ }

    /* ---------- kamera ---------- */
    var kamera = new T.PerspectiveCamera(KAMERA.fov, 16 / 9, 0.5, 700);
    var hoverId = null, fokusId = poId[ctx.fokus] ? ctx.fokus : null, lot = null, tOst = null;
    var polLuku = Math.max.apply(null, uklad.map(function (u) { return Math.abs(u.kat); })), katMaks = KAMERA.katMaks;
    var tabMn = 1, tabJedno = false, rozstaw = rozstawLuku(uklad), ekran = { w: 0, h: 0 }, wekT = new T.Vector3(), wekR = new T.Vector3();
    function celKata(id) { var k = id && poId[id] ? poId[id].u.kat : 0; return Math.max(-katMaks, Math.min(katMaks, k)); }
    var kat = { biez: celKata(fokusId), v: 0 };
    var wekP = new T.Vector3(), wekC = new T.Vector3();
    function pozaKamery(k, p, c) {
      p.set(0, KAMERA.wys, 0);
      c.set(Math.sin(k) * PROMIEN, KAMERA.cel, -Math.cos(k) * PROMIEN);
    }
    // Koniec przelotu: ¾ z przodu maszyny, nisko — następne ujęcie to rozruch pokazu.
    function pozaBliska(s, p, c) {
      var th = s.u.obrot + 0.62, d = Math.max(s.dl, s.rozp) * 1.02;
      p.set(s.u.poz[0] + Math.cos(th) * d, 3.4, s.u.poz[2] - Math.sin(th) * d);
      c.set(s.u.poz[0], s.wys * 0.42, s.u.poz[2]);
    }
    function ustawKamere(p, c) { kamera.position.copy(p); kamera.lookAt(c); }
    pozaKamery(kat.biez, wekP, wekC); ustawKamere(wekP, wekC);

    var postep = 0;                          // postęp przelotu 0..1 — tabliczki gasną, żeby nie zasłoniły kadru końcowego
    function aktywny() { return lot ? lot.id : (hoverId || fokusId); }
    function zastosujSwiatla(dt) {
      var a = aktywny(), s, zanik = 1 - postep * postep * (3 - 2 * postep);
      stanowiska.forEach(function (x) {
        var cel = x.id === a ? 1 : 0;
        x.sila = dt == null ? cel : x.sila + (cel - x.sila) * Math.min(1, dt * 7);
        x.snop.uniforms.uSila.value = 0.5 + 0.6 * x.sila;
        x.plama.opacity = 0.16 + 0.22 * x.sila;
        x.matTab.opacity = (0.74 + 0.26 * x.sila) * zanik;
        x.tab.position.y = x.tabY + 1.1 * x.sila;
        var sk = TAB_SZER * tabMn * (1 + 0.08 * x.sila); x.tab.scale.set(sk, sk * TAB.h / TAB.w, 1);
      });
      s = poId[a];
      if (s) { punkt.position.set(s.u.poz[0], SUFIT, s.u.poz[2]); punkt.target.position.set(s.u.poz[0], 0, s.u.poz[2]); }
      var celPkt = s ? SWIATLO_FOKUSU : 0;
      punkt.intensity = dt == null ? celPkt : punkt.intensity + (celPkt - punkt.intensity) * Math.min(1, dt * 7);
    }
    // Układ tabliczek na ekranie: tabliczka w fokusie w całości w kadrze (≥ 8 px od krawędzi — skrajna maszyna w kadrze telefonu
    // miała tabliczkę wystającą o 42 px), a sąsiednie odsuwane tak, żeby żadne dwie się nie nakładały (≥ 4 px odstępu).
    // Przesunięcie przez kotwicę sprite'a (center.x), bez ruszania pozycji w świecie.
    var ukl = [];                                   // robocza lista na klatkę; wpisy (x.uk) stałe — bez alokacji
    stanowiska.forEach(function (x) { x.uk = { x: x, l0: 0, l: 0, szer: 0 }; });
    var porownajL0 = function (p, q) { return p.l0 - q.l0; };
    // zastosujSwiatla (skala, krycie) + układ z bieżącej pozy kamery — dla wołających po ustawieniu kamery
    function odswiez(dt) { zastosujSwiatla(dt); ulozTabliczki(aktywny()); }
    function ulozTabliczki(a) {
      var i, j;
      stanowiska.forEach(function (x) { x.tab.center.x = 0.5; });
      if (!(ekran.w > 0)) return;
      kamera.updateMatrixWorld();
      wekR.setFromMatrixColumn(kamera.matrixWorld, 0);
      ukl.length = 0;
      stanowiska.forEach(function (x) {
        wekT.copy(x.tab.position).project(kamera);
        if (wekT.z > 1) return;
        var xc = (wekT.x + 1) / 2 * ekran.w;
        wekT.copy(wekR).multiplyScalar(x.tab.scale.x / 2).add(x.tab.position).project(kamera);
        var pol = Math.abs((wekT.x + 1) / 2 * ekran.w - xc);
        if (pol > 0) { var u = x.uk; u.l0 = u.l = xc - pol; u.szer = 2 * pol; ukl.push(u); }
      });
      ukl.sort(porownajL0);
      var f = -1;
      for (i = 0; i < ukl.length; i++) if (ukl[i].x.id === a) f = i;
      if (f >= 0) { var t = ukl[f]; t.l = Math.max(8, Math.min(t.l, ekran.w - 8 - t.szer)); }
      else f = 0;
      for (i = f + 1; i < ukl.length; i++) ukl[i].l = Math.max(ukl[i].l0, ukl[i - 1].l + ukl[i - 1].szer + 4);
      for (j = f - 1; j >= 0; j--) ukl[j].l = Math.min(ukl[j].l0, ukl[j + 1].l - 4 - ukl[j].szer);
      ukl.forEach(function (u) { u.x.tab.center.x = 0.5 - (u.l - u.l0) / u.szer; });
    }
    odswiez();

    var h = {
      grupa: grupa, scena: scena, kamera: kamera,
      hover: function (id) { hoverId = poId[id] ? id : null; if (smoke) odswiez(); },
      fokus: function (id) { fokusId = poId[id] ? id : null; postep = 0; if (smoke || !ruch) { kat.biez = celKata(fokusId); kat.v = 0; pozaKamery(kat.biez, wekP, wekC); ustawKamere(wekP, wekC); odswiez(); } },
      // Przelot kamery do maszyny; Promise kończy się w ostatniej klatce przelotu (bez ruchu — od razu).
      wybierz: function (id) {
        var s = poId[id];
        if (!s) return Promise.reject(new Error('Hangar: nieznana maszyna ' + id));
        if (lot) return lot.obietnica;
        fokusId = id;
        var p1 = new T.Vector3(), c1 = new T.Vector3();
        pozaBliska(s, p1, c1);
        if (!ruch) { ustawKamere(p1, c1); odswiez(); return Promise.resolve(id); }
        var c0 = new T.Vector3(); kamera.getWorldDirection(c0); c0.multiplyScalar(PROMIEN).add(kamera.position);
        lot = { id: id, u: 0, p0: kamera.position.clone(), c0: c0, p1: p1, c1: c1 };
        lot.obietnica = new Promise(function (ok) { lot.ok = ok; });
        return lot.obietnica;
      },
      // Kadr przelotu w chwili u (0 = kamera wycentrowana na maszynie, 1 = kadr końcowy) — hak zrzutów, deterministyczny.
      przelot: function (id, u) {
        var s = poId[id]; if (!s) return;
        fokusId = id;
        var p0 = new T.Vector3(), c0 = new T.Vector3(), p1 = new T.Vector3(), c1 = new T.Vector3();
        pozaKamery(celKata(id), p0, c0); pozaBliska(s, p1, c1);
        krokPrzelotu({ p0: p0, c0: c0, p1: p1, c1: c1 }, u);
        lot = null; postep = Math.max(0, Math.min(1, u)); odswiez();
      },
      trafienie: function (x, y) {
        ndc.set(x, y);
        rc.setFromCamera(ndc, kamera);
        grupa.updateMatrixWorld(true);
        var hity = rc.intersectObjects(pudla, false);
        return hity.length ? hity[0].object.userData.id : null;
      },
      animuj: function (czas) {
        var dt = tOst == null ? 0 : Math.min(0.25, Math.max(0, czas - tOst)); tOst = czas;
        stanowiska.forEach(function (s) { s.mk.aktualizuj(czas); s.snop.uniforms.uCzas.value = czas; });
        zastosujSwiatla(smoke ? null : dt);
        if (lot) {
          lot.u = Math.min(1, lot.u + dt / PRZELOT_S);
          krokPrzelotu(lot, lot.u);
          postep = lot.u;
          ulozTabliczki(aktywny());
          if (lot.u >= 1) { var l = lot; lot = null; postep = 0; l.ok(l.id); }
          return;
        }
        if (ruch) {
          // tłumienie krytyczne ze stanem prędkości: start i dojście bez skoku prędkości, sufit prędkości i przyspieszenia
          var cel = celKata(fokusId), K = KAMERA, a = K.k * (cel - kat.biez) - 2 * Math.sqrt(K.k) * kat.v;
          a = Math.max(-K.aMaks, Math.min(K.aMaks, a));
          kat.v = Math.max(-K.vMaks, Math.min(K.vMaks, kat.v + a * dt));
          kat.biez += kat.v * dt;
          if (Math.abs(cel - kat.biez) < 1e-4 && Math.abs(kat.v) < 1e-3) { kat.biez = cel; kat.v = 0; }
          // bez dryfu kamery w spoczynku: dryf przesuwał siatkę przez krawędź bryły widzenia, więc zestaw rysowanych siatek
          // (i licznik geometrii GPU sondy) zależał od chwili
          pozaKamery(kat.biez, wekP, wekC); ustawKamere(wekP, wekC);
        }
        ulozTabliczki(aktywny());                 // po ruchu kamery: układ z pozy tej klatki
      },
      // ekran pionowy (telefon): szerszy kąt, żeby obok maszyny w fokusie było widać sąsiadów
      // tabliczki większe na wąskim ekranie; jednowierszowe, gdy wiersz kraju wyszedłby < TAB_MIN_PX; przycięcie kąta kamery
      rozmiar: function (w, hh) {
        kamera.aspect = w / hh; kamera.fov = KAMERA.fov * Math.max(1, Math.min(1.9, 1.45 / kamera.aspect)); kamera.updateProjectionMatrix();
        var tf = Math.tan(kamera.fov * Math.PI / 360), poziome = 2 * Math.atan(tf * kamera.aspect);
        // przycięcie kąta: ±max(0,70; połowa łuku − 0,3 pola poziomego) — skrajna maszyna w kadrze na 16:9, a dolna granica
        // 0,70 trzyma ją z dala od środka
        katMaks = Math.max(KAMERA.katMaks, polLuku - 0.3 * poziome);
        if (!lot && (smoke || !ruch)) { kat.biez = celKata(fokusId); pozaKamery(kat.biez, wekP, wekC); ustawKamere(wekP, wekC); }
        tabMn = mnoznikTabliczki(kamera.aspect, rozstaw); ekran.w = w; ekran.h = hh;
        var pxm = hh / (2 * Math.hypot(PROMIEN, SUFIT * 0.35 - KAMERA.wys) * tf);         // px na metr przy tabliczce
        var jedno = TAB_SZER * tabMn * TAB.h / TAB.w * pxm * 34 / TAB.h < TAB_MIN_PX;
        if (jedno !== tabJedno) { tabJedno = jedno; stanowiska.forEach(function (s) { rysujTabliczke(s.plotno, s.dane, tabJedno); s.texTab.needsUpdate = true; }); }
        stanowiska.forEach(function (x) { var sk = TAB_SZER * tabMn * (1 + 0.08 * x.sila); x.tab.scale.set(sk, sk * TAB.h / TAB.w, 1); });
        ulozTabliczki(aktywny());                 // także bez animuj (smoke): układ zgodny z nowym rozmiarem
      },
      // pełna: odbicie lustrzane kopiami siatek; lekka: posadzka nieprzezroczysta, odbicie tylko z env (o połowę mniej rysowania)
      jakosc: function (j) {
        var pelna = j !== 'lekka';
        lustro.visible = pelna;
        // bez lustra żywica kryje w pełni — przyciemniona tak, żeby jasność posadzki nie skakała przy zmianie jakości
        matPosadzki.opacity = pelna ? PRZEZROCZ_POSADZKI : 1; matPosadzki.transparent = pelna; matPosadzki.needsUpdate = true;
        matPosadzki.color.setHex(KOLOR_POSADZKI).multiplyScalar(pelna ? 1 : PRZEZROCZ_POSADZKI);
      },
      stan: function () {
        return { hover: hoverId, fokus: fokusId, przelot: !!lot, przelotU: lot ? lot.u : null, przelotS: PRZELOT_S, lustro: lustro.visible,
          maszyny: stanowiska.length, kat: kat.biez, katV: kat.v, katMaks: katMaks, tabJedno: tabJedno, podswietlona: aktywny() };
      },
      // pozycja tabliczki na ekranie (sonda) i środek maszyny w NDC
      rzut: function (id) {
        var s = poId[id]; if (!s) return null;
        var v = new T.Vector3(s.u.poz[0], s.wys * 0.5, s.u.poz[2]).project(kamera);
        return { x: v.x, y: v.y, z: v.z };
      },
      zwolnij: function () {
        if (zwolniony) return;
        zwolniony = true;
        if (lot) { var l = lot; lot = null; l.ok(null); }
        scena.remove(grupa); scena.remove(lustro); scena.remove(punkt); scena.remove(punkt.target);
        zwolnijZasoby(zb);
      },
    };
    function krokPrzelotu(l, u) {
      var e = u * u * (3 - 2 * u);
      wekP.lerpVectors(l.p0, l.p1, e); wekP.y += Math.sin(Math.PI * e) * 2.5;
      wekC.lerpVectors(l.c0, l.c1, e);
      ustawKamere(wekP, wekC);
    }
    h.jakosc(ctx.jakosc || 'pelna');
    return h;
  }
  // Kopia hierarchii siatek (bez Object3D.clone — ten serializuje userData z materiałami i płótnami): te same geometrie
  // i materiały, bieżące transformacje; bez cieni i raycastu. Niewidoczne pudła i puste węzły pomijane.
  function kopiujSiatki(T, o) {
    var k = o.isMesh ? new T.Mesh(o.geometry, o.material) : new T.Group();
    k.position.copy(o.position); k.quaternion.copy(o.quaternion); k.scale.copy(o.scale);
    k.renderOrder = o.renderOrder; k.visible = o.visible;
    if (k.isMesh) k.raycast = function () {};
    o.children.forEach(function (d) {
      if (d.isMesh && d.material && d.material.visible === false) return;
      if (!d.isMesh && !d.children.length) return;
      k.add(kopiujSiatki(T, d));
    });
    return k;
  }

  api.zbuduj = zbuduj;
  root.MysliwceHangar = api;
})(typeof window !== 'undefined' ? window : globalThis);
