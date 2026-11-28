'use strict';
/* Zakładka Geologia — widok nakładki (plik przeglądarkowy; ładuje go leniwie geologia/ladowanie.js).
   window.Geologia = { otworz(stan), zamknij(), stan(), diagnostyka(), (haki sondy) scena(), renderer(), rzutKotwicy(id),
     ustawKamere(poz, cel), przewyzszenie(x) }.
   stan() → { miejsce, tryb, rozdzial, ujecie, t, fps, jakosc: 'pelna'|'lekka', jakoscAuto (false przy &jakosc=pelna i w smoke), lektor: 'gra'|'cisza'|'brak', gotowa, rzezba,
     kolorowanie, przekroj, chmury, przewyzszenie, czesc, mity, pelnyEkran } (ujecie = id bieżącego ujęcia albo null — Task 8);
   diagnostyka() → { geometrie, tekstury, programy, audio, audioMakiety, zrodlaMakiety } (audio = liczba żywych AudioContext
   pokazu: 0 albo 1; audioMakiety = żywe konteksty makiety: lektor pinów + pejzaż dźwiękowy (0–2), zrodlaMakiety = grające
   źródła lektora makiety).
   Pejzaż dźwiękowy i stuknięcie (Task B3, geologia/pejzaz.js + geologia/dzwiek.js): głośnik w pasku (domyślnie wyłączony,
   AudioContext dopiero po kliknięciu); stan().pejzaz = { gra, poziomy, ostatniStuk: { jednostka, t } | null, kontekst
   (stan AudioContext), sygnal ({ podklad, lektor } dBFS z GeologiaDzwiek), niedostepny, trzaski (zaplanowane trzaski — pejzaż
   ich nie ma, R17), wTle (karta w tle: kontekst wstrzymany) } — opis przy bloku „pejzaż”.
   Lektor pinów makiety (Task 8d): przycisk „▶ Posłuchaj” w karcie części, wulkanu i punktu turystyki tylko z nagraniami
   z zaproszenia (opis przy bloku „lektor na pinach makiety”); stan().lektorMakiety = 'brak' | 'laduje' (czasy.json w drodze)
   | 'gotowy' | 'gra', stan().lektorMakietyPowod = powód braku (null | 'siec' | 'zaproszenie' | 'przygotowanie' | 'wygaslo' | 'host'),
   stan().lektorMakietyWers = id grającego wersu, stan().lektorMakietyZrodla = grające źródła;
   hak sondy karta(rodzaj, id) — karta pinu jak po kliknięciu.
   Lektor i podkład filmów (Task 9): geologia/lektor.js + geologia/dzwiek.js przez pokaz.js; stan().lektor = stan lektora
   pokazu ('gra' | 'cisza' po M | 'brak' bez nagrań/zaproszenia/AudioContext), stan().pokaz.zegar = 'audio' | 'klatki'.
   Szkielet (Task 2): pasek z tytułem i podmenu miejsc (GeologiaMiejsca.podmenu), rząd rozdziałów (GeologiaLadowanie.ROZDZIALY),
   canvas na cały kontener. Pasek i rząd rozdziałów leżą NAD canvasem (absolutnie), kadr = cały #geologia.
   Makieta (Task 6): rzeźba z geologia/<miejsce>/rzezba*.png dekodowana bez zarządzania kolorem (createImageBitmap z
   colorSpaceConversion 'none'; kontrola: szczyt wyspy = rzezba.json.hMax, inaczej błąd „Geologia: ”), scena z
   geologia/scena.js, OrbitControls z ograniczeniami G-K (kamera ≥ 0,15 km nad rzeźbą/taflą, minDistance z wysokości terenu
   pod celem, maxDistance = archipelag w kadrze, dystans startowy z proporcji ekranu), przełączniki Teren/Geologia,
   Przekrój (+ kąt i przeciąganie ściany), Morze chmur, przewyższenie ×1/×1,5/×3 (animowane, podpisane w kadrze),
   legenda jednostek, karta części (klik w znacznik), karta „Fakty i mity”, karta przekroju, pełny ekran (F).
   Czas geologiczny (Task 7): suwak 12 mln lat → dziś (oś logarytmiczna Animacje.osMa, kreski zdarzeń z osCzasu pod suwakiem,
   klik w kreskę = skok do zdarzenia), plakietka REKONSTRUKCJA, gdy obraz nie jest dzisiejszą rzeźbą (R7).
   Rzeźbę chwili liczy GPU (scena.czas) — suwak nie przelicza siatki na CPU.
   Kompas i warstwa turystyczna (Task 7b): róża z N obraca się z azymutem kamery (GeologiaTurystykaScena.Kompas), klik =
   widok „z góry” (N w górę ekranu, przelot); przyciski Z południa / Z północy / Z góry (odległość dopasowana do proporcji
   ekranu, cała wyspa w kadrze). Przełącznik „Turystyka” (domyślnie wyłączony; hash `&warstwa=turystyka`): linie tras
   i piny (warstwa z geologia/turystyka-scena.js przez hak sceny dodajWarstwe — zasoby w z() sceny, budowana raz na makietę,
   przełączanie = widoczność), etykiety części przygaszone, karta trasy/punktu, panel „Plan dni” (klik = przelot do trasy
   dnia; na wąskim ekranie dolna szuflada), stały pasek ostrzeżenia o zamkniętych szlakach (pełny tekst, data stanu, link).
   Warstwa jest liczona z dzisiejszej rzeźby: włączenie przy czasie ≠ dziś cofa czas do „dziś”, w trybie turystycznym
   suwak czasu jest schowany, a przy czasie ≠ dziś (hak sondy), przekroju i animacji warstwa jest niewidoczna.
   Warstwa „Wulkany” (Task 8c): przełącznik w pasku (domyślnie wyłączony, niezależny od Turystyki — obie mogą być włączone;
   hash `&warstwa=wulkany` albo `&warstwa=turystyka,wulkany`): stożki z OSM (geologia/teneryfa/wulkany.js) w trzech barwach
   grup (GeologiaWulkany.grupuj), piny z geologia/wulkany-scena.js przez hak dodajWarstwe (zasoby w z() sceny, budowana raz na
   makietę, przełączanie = widoczność), etykiety stałe dla stratowulkanów i ośrodków erupcji historycznych, pozostałe stożki
   — etykieta na wskazanie/wybór; legenda z licznikami („N na mapie (OSM)” obok liczby z literatury ze źródłem; na wąskim
   ekranie zwijana dolna szuflada) i karta wulkanu (nazwa, wysokość, grupa, rok erupcji, opis, źródło, atrybucja OSM).
   Jak Turystyka: liczona z dzisiejszej rzeźby — włączenie cofa czas do „dziś”, suwak czasu schowany, przy czasie ≠ dziś,
   przekroju i animacji warstwa niewidoczna. Klik: punkt turystyki → pin wulkanu → linia trasy → znacznik części.
   Esc (G-E): pokaz → makieta tego miejsca; makieta → zamyka kartę wulkanu → kartę trasy/punktu → kartę części/mitów →
   zwija rozwinięty plan dni / legendę wulkanów → wychodzi z pełnego ekranu → Układ.
   Hak testowy: ?smoke&geologia=<miejsce>[&rozdzial=<id>|&makieta][&przekroj=<°>[&przesuniecie=<km>]][&geologiczna][&kontrola=biel|czern][&krzywe]
   [&czas=<Ma>][&anim=a1..a5&f=0..1] (animacja w stałym kadrze ujęcia z KADRY_ANIM, światło i woda ujęcia, bez znaczników)
   → stały kadr, marker `GEOLOGIA_READY <miejsce> <rozdzial|makieta>`; w smoke lektor i podkład nie startują (stan().lektor
   === 'cisza'), zmiany stanu są natychmiastowe. `&jakosc=pelna` = bez przejścia na lżejszą jakość (G-L); `&lod=lekki` =
   siatka terenu co drugą próbkę (jak na telefonie).
   `&krzywe` (tylko smoke): doładowuje mysliwce/kino.js i loguje `GEOLOGIA_KRZYWE ok|zle` (ruling G-C).
   `&warstwa=turystyka|wulkany|turystyka,wulkany` = warstwy przed markerem, `&widok=poludnie|polnoc|gora` = kadr z przycisków kompasu.
   Pora dnia i pogoda (Task 8e): grupa „Pora” w pasku — „Stałe” (domyślne światło makiety: dzień, az 250°, el 30° — jak przed
   8e), „Teraz” (Słońce nad Teide z zegara urządzenia, odświeżane co 60 s zegarem, nie pętlą renderu) i suwak godziny 0:00–23:50 (co 10 min)
   dzisiejszego dnia w czasie wyspy (Atlantic/Canary) z etykietą „14:30 · Słońce 32° nad horyzontem”; pozycja Słońca
   z geologia/slonce.js (ephemeris.js), pora z GeologiaSlonce.poraZeSlonca, noc makiety z minimum „księżycowym”.
   Grupa „Pogoda”: Pogodnie / Morze chmur / Kalima (wyłączne; jedno źródło stanu mks.pogoda — mks.chmury z niego wynika).
   Kalima = mgła i ochra presetu 'kalima' w jasności bieżącej pory (GeologiaSlonce.parametrySwiatla). Adres: `&pora=teraz|HH:MM`,
   `&pogoda=pogodnie|chmury|kalima` (hash makiety i hak smoke). stan().pora | pogoda | slonce, diagnostyka().swiatlo.
   Materiał (Task B1): grupa „Materiał” — „Zwykły” (domyślny po każdym wejściu; „Teren” to już przycisk grupy „Barwy”)
   i „Sklejka” (warstwy z geologia/sklejka.js, ocean-żywica). Barwy działają na obu. Adres `&material=sklejka` (hash
   makiety; zapytanie — hak smoke i pomiar wydajności), stan().material. Animacje A1–A5 (hak &anim) wymuszają wodę ujęcia
   także przy zmianie materiału w ich trakcie; nowa budowa makiety najpierw kładzie wodę materiału.
   Hak smoke `&przew=1|1.5|3`: przewyższenie przed markerem (warstwy sklejki zgodne ze skalą Y). W smoke makiety tuż przed
   markerem linia `GEOLOGIA_STAN_MAKIETY {json}` (materiał, przewyższenie, krok sklejki, cienie z horyzontu, smugi) — sprawdza ją
   smoke-geologia.mjs.
   Cienie z mapy horyzontu (Task A3): horyzont.json + horyzont-*.png miejsca wczytywane po wejściu w makietę (bez blokowania
   budowy; smoke czeka na nie przed markerem), rozpakowane bajt w bajt (DecompressionStream, bez kanwy i zarządzania
   kolorem), sumy kontrolne z JSON → sc.horyzont(mapa). Animacje A1–A5 wyłączają cienie (sc.cienieHor(false)), czas
   geologiczny wyłącza je w scenie. W grupie „Pora dnia” przycisk „Cień Teide” (title: „Dziś najdłuższy cień: rano HH:MM,
   wieczorem HH:MM (Słońce 2° nad horyzontem)” z GeologiaHoryzont.chwileCienia — R13: najdłuższy WIDOCZNY cień) — klik
   ustawia porę wieczorną po 12:00 czasu wyspy, inaczej poranną. Na morzu i stropie chmur cień Teide z modelu stożka
   (sc.stozekTeide()). Hak smoke `&data=RRRR-MM-DD`: dzień, w którym liczy się pora z adresu i przycisk.
   Smugi pasatu (Task A2): przycisk „Wiatr” w grupie „Warstwy” (domyślnie włączony po każdym wejściu; adres `&wiatr=0`
   w hashu makiety i w zapytaniu — hak smoke, pomiar) → sc.wiatr(wl, n); liczba linii z jakości (GeologiaWiatr.LICZBA,
   przejście na „lekka” przebudowuje warstwę raz). Animacje A1–A5 chowają smugi, czas geologiczny chowa je w scenie;
   przy widocznych smugach w stopce plakietka SCHEMAT. stan().wiatr = przycisk, stan().scena.wiatr = warstwa widoczna.
   Tekst z danych trafia do DOM wyłącznie przez textContent. Błędy własne: prefiks „Geologia: ”,
   ostrzeżenia nie będące błędem: „Geologia/uwaga: ”. */
(function () {
  var T = window.THREE, L = window.GeologiaLadowanie, M = window.GeologiaMiejsca, S = window.GeologiaScena, Teren = window.Teren;
  var TS = window.GeologiaTurystykaScena, WS = window.GeologiaWulkanyScena;
  var doc = document, $ = function (id) { return doc.getElementById(id); };
  var korzen = $('geologia');
  var zap = L.parsujZapytanieGeologii(location.search), smoke = zap.smoke;
  var K_KRZYWE = ['dojazd', 'cruise', 'logLerp', 'aimArc'];
  var RAD = Math.PI / 180;
  var NAZWY_PEWNOSCI = { wysoka: 'wysoka', srednia: 'średnia', niska: 'niska', 'bardzo-niska': 'bardzo niska' };
  var WERDYKTY = { fakt: 'FAKT', mit: 'MIT', czesciowo: 'CZĘŚCIOWO', legenda: 'LEGENDA' };
  var RODZAJE = { stratowulkan: 'stratowulkan', kaldera: 'kaldera', masyw: 'masyw', grzbiet: 'grzbiet', dolina: 'dolina', miasto: 'miasto',
    stozek: 'stożek wulkaniczny', 'baseny-lawowe': 'baseny w lawie', klif: 'klif', wawoz: 'wąwóz', skaly: 'skały', kopula: 'kopuła',
    szczelina: 'szczelina erupcyjna', 'tunel-lawowy': 'tunel lawowy', 'pole-lawy': 'pole lawy', odsloniecie: 'odsłonięcie',
    plaza: 'plaża', 'skala-morska': 'skała morska' };
  var PRZEWYZSZENIA = L.PRZEWYZSZENIA;          // [1, 1.5, 3] — jedno źródło z hakiem &przew= i GeologiaSklejka.KROKI
  var RODZAJE_PUNKTOW = { hotel: 'hotel', baza: 'baza', przystanek: 'przystanek', start: 'początek trasy', cel: 'cel trasy',
    atrakcja: 'atrakcja', plaza: 'plaża', latarnia: 'latarnia', 'punkt-widokowy': 'punkt widokowy' };
  var NAZWY_WIDOKOW = { poludnie: 'Z południa', polnoc: 'Z północy', gora: 'Z góry' };
  // Opisy pogody (dymki przycisków) — fakty z dane.js / opowiesc.js (f-klimat-pasaty, f-kalima, ujęcie morze-chmur). Wysokość
  // morza chmur TYLKO z faktu f-morze-chmur (recenzja końcowa M-1); STROP_CHMUR_KM w scena.js to stała modelu rysowanej warstwy.
  var OPIS_POGODY = {
    chmury: 'Morze chmur: pasat z północnego wschodu układa chmury na północnych stokach',
    kalima: 'Kalima: pył znad Sahary — niebo robi się pomarańczowe, widać coraz mniej'
  };
  function opisMorzaChmur(D) {
    var f = D && (D.fakty || []).filter(function (x) { return x.id === 'f-morze-chmur'; })[0], l = f && f.liczby;
    if (!l || !l.inwersja) return OPIS_POGODY.chmury;
    return OPIS_POGODY.chmury + ', pod inwersją pasatową średnio ok. ' + liczba(l.inwersja.wartosc) + ' m n.p.m.' +
      (l.latemOd && l.latemDo ? ' (druga, wyższa inwersja latem: ' + liczba(l.latemOd.wartosc) + '–' + liczba(l.latemDo.wartosc) + ' m)' : '');
  }
  var M0_CZASU = 12;                    // suwak czasu: 12 mln lat temu → dziś (spec „Wnętrze i czas”)
  var FUNKCJE_ANIM = { a1: 'a1Powstanie', a2: 'a2Lawa1706', a3: 'a3Osuwisko', a4: 'a4MorzeChmur', a5: 'a5Noc' };
  // Kadry haka animacji (makieta, zrzuty): cel = część z danych, az [°] (skąd patrzy kamera), d [km] od celu, h [km n.p.m.
  // kamery], yc [km n.p.m. celu], fov; światło i woda jak w ujęciu filmu (R9.4, R9.5, R9.2, R9.9).
  var KADRY_ANIM = {
    a1: { cel: 'teide', az: 200, d: 90, h: 35, yc: 0, fov: 28, swiatlo: { pora: 'dzien', az: 220, el: 35 }, woda: 'realna', rekonstrukcja: true },
    // a2: kadr H9 „lot za czołem” — kamera 2,6 km za czołem lawy (w górę toru) i 0,8 km nad nim, cel = czoło (licz. w uruchomAnimacje)
    a2: { czolo: true, za: 2.6, nad: 0.8, fov: 32, swiatlo: { pora: 'noc', az: 65, el: -12 }, woda: 'realna', rekonstrukcja: true },
    a3: { cel: 'icod', az: 345, d: 34, h: 10, yc: 0, fov: 30, swiatlo: { pora: 'dzien', az: 220, el: 35 }, woda: 'szklana', rekonstrukcja: true },
    a4: { cel: 'teide', az: 15, d: 30, h: 2.7, yc: 1.6, fov: 34, swiatlo: { pora: 'dzien', az: 160, el: 30 }, woda: 'realna' },
    a5: { cel: 'teide', az: 0, d: 9, h: 2.3, yc: 4.4, fov: 50, swiatlo: { pora: 'noc', az: 295, el: -18 }, woda: 'realna' }
  };

  function el(tag, klasa, tekst, rodzic) {
    var e = doc.createElement(tag);
    if (klasa) e.className = klasa;
    if (tekst != null) e.textContent = tekst;
    if (rodzic) rodzic.appendChild(e);
    return e;
  }
  function guzik(rodzic, tekst, tytul, klasa) {
    var b = el('button', 'ge-guzik' + (klasa ? ' ' + klasa : ''), tekst, rodzic);
    b.type = 'button'; if (tytul) b.title = tytul; b.setAttribute('aria-pressed', 'false');
    return b;
  }
  function liczba(x, miejsc) { return String(Math.round(x * Math.pow(10, miejsc || 0)) / Math.pow(10, miejsc || 0)).replace('.', ','); }

  /* ---------- stan ---------- */
  var st = { miejsce: null, tryb: null, rozdzial: null, ujecie: null, t: zap.t };
  var aktywny = false, gl = null, ui = null, rafId = 0, gotowosc = null, ostatni = 0, fps = 60, tStart = 0;
  var przyciskiMiejsc = {}, przyciskiRozdzialow = {};
  var jakosc = 'pelna', wymusPelna = smoke || zap.jakosc === 'pelna', slabe = 0, fpsOkno = { n: 0, t0: 0 };
  // makieta: scena, sterowanie, stan przełączników
  var mk = null, budowa = 0, rzezby = {};
  var mks = { kolorowanie: 'teren', przekroj: null, chmury: false, przew: 1.5, przewCel: 1.5, czesc: null, mity: false, hover: null, czas: 0, anim: null,
    turystyka: false, tur: null, widok: null, azymut: null, wulkany: false, wulk: null,
    // Task 8e: pora = null (stałe) | 'teraz' | minuta dnia wyspy 0…1439 (suwak 0…1430 co 10 min); pogoda = 'pogodnie' | 'chmury' | 'kalima' (chmury z niej)
    pora: null, pogoda: 'pogodnie', slonce: null,
    // Task B1: materiał makiety 'zwykly' | 'sklejka'
    material: 'zwykly',
    // Task A2: smugi pasatu — domyślnie włączone po każdym wejściu w zakładkę (przycisk „Wiatr”, adres &wiatr=0 wyłącza)
    wiatr: true };
  var zegarPory = 0;
  var nacisk = null, ciag = null, wskaznik = null;
  var pokaz = null;                     // geologia/pokaz.js — tworzony przy pierwszym wejściu w pokaz

  /* ---------- DOM ---------- */
  function zbudujUI() {
    if (ui) return ui;
    ui = {};
    ui.canvas = el('canvas', 'ge-canvas');
    ui.canvas.setAttribute('aria-hidden', 'true');
    korzen.insertBefore(ui.canvas, korzen.firstChild);
    var pasek = $('gePasek');
    // przycisk zwijania paska (tylko wąski ekran — CSS), zaraz za nazwą zakładki
    ui.bPasek = el('button', 'ge-guzik ge-pasek-przelacz', 'Zwiń ▴', null);
    ui.bPasek.type = 'button'; ui.bPasek.setAttribute('aria-expanded', 'true'); ui.bPasek.title = 'Pokaż albo schowaj narzędzia';
    var tyt = $('geTytul');
    if (tyt && tyt.parentNode === pasek) pasek.insertBefore(ui.bPasek, tyt.nextSibling); else pasek.appendChild(ui.bPasek);
    ui.bPasek.addEventListener('click', function () { zwinPasek(!pasek.classList.contains('ge-pasek-zwiniety')); });
    // narzędzia makiety (w pasku; w pokazie ukryte)
    ui.narzedzia = el('div', 'ge-narzedzia', null, pasek);
    ui.narzedzia.hidden = true;
    var grupa = function (etykieta) { var g = el('div', 'ge-grupa', null, ui.narzedzia); g.setAttribute('role', 'group'); g.setAttribute('aria-label', etykieta); return g; };
    var gb = grupa('Barwy');
    ui.bTeren = guzik(gb, 'Teren', 'Barwy wysokości (hipsometria)');
    ui.bGeologia = guzik(gb, 'Geologia', 'Barwy jednostek geologicznych (mapa uproszczona)');
    var gm = grupa('Materiał');
    ui.bZwykly = guzik(gm, 'Zwykły', 'Materiał zwykły: gładka rzeźba i realistyczne morze');
    ui.bSklejka = guzik(gm, 'Sklejka', 'Makieta ze sklejki: warstwy co kilkadziesiąt metrów, słoje, przypalone krawędzie i ocean z przezroczystej żywicy');
    var gp = grupa('Przekrój');
    ui.bPrzekroj = guzik(gp, 'Przekrój', 'Przekrój przez wyspę — przeciągnij ścianę, by go przesunąć');
    ui.kat = el('label', 'ge-kat', null, gp); ui.kat.hidden = true;
    ui.katSuwak = el('input', 'ge-suwak', null, ui.kat);
    ui.katSuwak.type = 'range'; ui.katSuwak.min = '0'; ui.katSuwak.max = '179'; ui.katSuwak.step = '1'; ui.katSuwak.value = '90';
    ui.katSuwak.title = 'Kierunek linii przekroju: 0° = północ–południe, 90° = zachód–wschód';
    ui.katTekst = el('output', 'ge-kat-wart', '90°', ui.kat);
    // pora dnia (Task 8e): Stałe / Teraz / suwak godziny wyspy z etykietą; pogoda: trzy wyłączne przyciski
    var gPora = grupa('Pora dnia'); gPora.classList.add('ge-grupa-pora');
    ui.bStale = guzik(gPora, 'Stałe', 'Światło stałe makiety: popołudniowe słońce z zachodu-południowego zachodu');
    ui.bTeraz = guzik(gPora, 'Teraz', 'Słońce nad Teneryfą w tej chwili (zegar urządzenia, czas wyspy)');
    // Task A3: „Cień Teide” — pora najdłuższego widocznego cienia dziś (Słońce 2° nad horyzontem, GeologiaHoryzont.chwileCienia);
    // podpis liczony z efemeryd przy każdej zmianie pory (pamięć na dzień wyspy). Akcja, nie przełącznik — bez aria-pressed.
    ui.bCienTeide = guzik(gPora, 'Cień Teide', null);
    ui.bCienTeide.removeAttribute('aria-pressed');
    ui.bCienTeide.hidden = true;        // widoczny, gdy pokazPore policzy chwile cienia
    ui.pora = el('label', 'ge-pora', null, gPora);
    ui.poraSuwak = el('input', 'ge-pora-suwak', null, ui.pora);
    ui.poraSuwak.type = 'range'; ui.poraSuwak.min = '0'; ui.poraSuwak.max = '1430'; ui.poraSuwak.step = '10';
    ui.poraSuwak.setAttribute('aria-label', 'Godzina na Teneryfie (dziś, czas wyspy)');
    ui.poraSuwak.title = 'Godzina na Teneryfie (dziś, czas wyspy) — Słońce z efemeryd';
    ui.poraTekst = el('output', 'ge-pora-wart', 'światło stałe', ui.pora);
    var gPogoda = grupa('Pogoda');
    ui.bPogodnie = guzik(gPogoda, 'Pogodnie', 'Bez chmur i pyłu');
    ui.bChmury = guzik(gPogoda, 'Morze chmur', opisMorzaChmur(window.GeologiaTeneryfa));
    ui.bKalima = guzik(gPogoda, 'Kalima', OPIS_POGODY.kalima);
    var gWarstwy = grupa('Warstwy');
    ui.bTurystyka = guzik(gWarstwy, 'Turystyka', 'Warstwa turystyczna: szlaki z planu wyjazdu, Hard Rock Hotel, plan dni', 'ge-guzik-tur');
    ui.bWulkany = guzik(gWarstwy, 'Wulkany', 'Warstwa wulkanów: stożki z OpenStreetMap w trzech grupach, licznik i opisy', 'ge-guzik-wulk');
    ui.bWiatr = guzik(gWarstwy, 'Wiatr', 'Smugi pasatu z północnego wschodu opływające wyspę i piasek z plaż południa — schemat typowych warunków, nie pomiar');
    var gw = grupa('Przewyższenie');
    ui.bPrzew = PRZEWYZSZENIA.map(function (x) { var b = guzik(gw, '×' + liczba(x, 1), 'Przewyższenie pionowe ×' + liczba(x, 1)); b.dataset.przew = String(x); return b; });
    // Task B3: głośnik — pejzaż dźwiękowy makiety, domyślnie wyłączony; pierwsze włączenie (gest) tworzy AudioContext
    var gd = grupa('Dźwięk');
    ui.bGlosnik = guzik(gd, null, null, 'ge-glosnik');
    ui.bGlosnik.setAttribute('aria-label', 'Dźwięk makiety');
    ikonaGlosnika(ui.bGlosnik);
    var gk = grupa('Karty');
    ui.bMity = guzik(gk, 'Fakty i mity', 'Fakty i mity o Teneryfie');
    ui.bPelny = guzik(gk, 'Pełny ekran', 'Pełny ekran (F)');
    ui.bZamknij = guzik(gk, '✕', 'Wróć do Układu Słonecznego (Esc)', 'ge-zamknij');
    ui.bZamknij.removeAttribute('aria-pressed'); ui.bZamknij.setAttribute('aria-label', 'Wróć do Układu Słonecznego');

    // pokaz: „Makieta” w pasku (spec: tryb interaktywny tego miejsca; Esc robi to samo)
    ui.bDoMakiety = guzik(pasek, 'Makieta', 'Makieta wyspy — tryb interaktywny (Esc)', 'ge-do-makiety');
    ui.bDoMakiety.removeAttribute('aria-pressed'); ui.bDoMakiety.hidden = true;
    ui.bDoMakiety.addEventListener('click', function () { otworz({ miejsce: st.miejsce, tryb: 'makieta' }); });
    ui.podmenu = el('nav', 'ge-podmenu', null, pasek);
    ui.podmenu.setAttribute('aria-label', 'Miejsca');
    M.MIEJSCA.forEach(function (m) {
      var b = el('button', 'ge-guzik', m.nazwa, ui.podmenu);
      b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { wejdzWMiejsce(m.id); });
      przyciskiMiejsc[m.id] = b;
    });
    ui.rozdzialy = el('nav', 'ge-rozdzialy', null, korzen);
    ui.rozdzialy.setAttribute('aria-label', 'Rozdziały');
    L.ROZDZIALY.forEach(function (r) {
      var b = el('button', 'ge-guzik', r.etykieta, ui.rozdzialy);
      b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { otworz({ miejsce: st.miejsce, tryb: 'pokaz', rozdzial: r.id }); });
      przyciskiRozdzialow[r.id] = b;
    });

    // nakładki makiety nad canvasem
    ui.makieta = el('div', 'ge-makieta', null, korzen); ui.makieta.hidden = true;
    ui.podpisPrzew = el('p', 'ge-podpis-przew', null, ui.makieta);
    // atrybucja danych przy mapie (ODbL 4.3: widoczna przy danych OSM; #credit strony leży pod nakładką): rzeźba zawsze,
    // OSM — gdy widać warstwę Turystyka albo Wulkany (piny, szlaki)
    ui.atryb = el('p', 'ge-atrybucja', null, ui.makieta);
    ui.atrybOsm = el('span', 'ge-atrybucja-osm', null, ui.atryb);
    el('span', null, '© współtwórcy ', ui.atrybOsm);
    var aOsm = el('a', null, 'OpenStreetMap', ui.atrybOsm);
    aOsm.href = 'https://www.openstreetmap.org/copyright'; aOsm.target = '_blank'; aOsm.rel = 'noopener';
    el('span', null, ' (ODbL) · ', ui.atrybOsm);
    el('span', null, 'rzeźba: Terrain Tiles (SRTM, GMTED, ETOPO1)', ui.atryb);
    // efekty schematyczne podpisane wprost (spec „Makieta żyje”, anty-cel „efekt podany jako pomiar”)
    el('span', 'ge-atrybucja-schemat', ' · fale i wiatr: schemat typowych warunków', ui.atryb);
    // Task A2: plakietka SCHEMAT, gdy widać smugi pasatu (konwencja R7: plakietka przy obrazie, który nie jest pomiarem)
    ui.plakWiatr = el('span', 'ge-plakietka ge-plakietka-wiatr', 'SCHEMAT', ui.atryb);
    ui.plakWiatr.title = 'Smugi pasatu: typowy pasat z północnego wschodu opływający rzeźbę — schemat, nie pomiar ani prognoza';
    ui.plakWiatr.hidden = true;
    ui.atrybOsm.hidden = true;
    // czas geologiczny: suwak 12 mln lat → dziś, kreski zdarzeń z osCzasu
    ui.czas = el('div', 'ge-panel ge-czas', null, ui.makieta);
    ui.czas.setAttribute('role', 'group'); ui.czas.setAttribute('aria-label', 'Czas geologiczny');
    var gc = el('div', 'ge-czas-gora', null, ui.czas);
    el('span', 'ge-czas-tytul', 'Czas geologiczny', gc);
    ui.czasWart = el('output', 'ge-czas-wart', 'dziś', gc);
    ui.czasPlak = el('span', 'ge-plakietka', 'REKONSTRUKCJA', gc); ui.czasPlak.hidden = true;
    ui.czasPlak.title = 'Rzeźba z wieku jednostek geologicznych — model, nie zapis';
    ui.czasSuwak = el('input', 'ge-czas-suwak', null, ui.czas);
    ui.czasSuwak.type = 'range'; ui.czasSuwak.min = '0'; ui.czasSuwak.max = '1000'; ui.czasSuwak.step = '1'; ui.czasSuwak.value = '1000';
    ui.czasSuwak.setAttribute('aria-label', 'Czas geologiczny: od 12 milionów lat temu do dziś');
    ui.czasOs = el('div', 'ge-czas-os', null, ui.czas);
    ui.czasSuwak.addEventListener('input', function () { ustawCzas(window.Animacje.osMa(+ui.czasSuwak.value / 1000, M0_CZASU), true); });
    ui.legenda = el('aside', 'ge-panel ge-legenda', null, ui.makieta); ui.legenda.hidden = true;
    ui.legenda.setAttribute('aria-label', 'Legenda jednostek geologicznych');
    ui.karty = el('div', 'ge-karty', null, ui.makieta);
    ui.kCzesc = el('aside', 'ge-panel ge-karta ge-karta-czesci', null, ui.karty); ui.kCzesc.hidden = true; ui.kCzesc.setAttribute('aria-label', 'Karta części');
    ui.kCzescX = guzik(ui.kCzesc, '✕', 'Zamknij kartę (Esc)', 'ge-panel-x'); ui.kCzescX.removeAttribute('aria-pressed');
    ui.kCzescT = el('div', 'ge-karta-tresc', null, ui.kCzesc);
    ui.kMity = el('aside', 'ge-panel ge-karta ge-karta-mitow', null, ui.karty); ui.kMity.hidden = true; ui.kMity.setAttribute('aria-label', 'Fakty i mity');
    ui.kMityX = guzik(ui.kMity, '✕', 'Zamknij kartę (Esc)', 'ge-panel-x'); ui.kMityX.removeAttribute('aria-pressed');
    ui.kMityT = el('div', 'ge-karta-tresc', null, ui.kMity);
    ui.kPrzekroj = el('aside', 'ge-panel ge-karta ge-karta-przekroju', null, ui.karty); ui.kPrzekroj.hidden = true; ui.kPrzekroj.setAttribute('aria-label', 'Przekrój');
    ui.kTur = el('aside', 'ge-panel ge-karta ge-karta-tur', null, ui.karty); ui.kTur.hidden = true; ui.kTur.setAttribute('aria-label', 'Karta trasy');
    ui.kTurX = guzik(ui.kTur, '✕', 'Zamknij kartę (Esc)', 'ge-panel-x'); ui.kTurX.removeAttribute('aria-pressed');
    ui.kTurT = el('div', 'ge-karta-tresc', null, ui.kTur);
    ui.kWulk = el('aside', 'ge-panel ge-karta ge-karta-wulk', null, ui.karty); ui.kWulk.hidden = true; ui.kWulk.setAttribute('aria-label', 'Karta wulkanu');
    ui.kWulkX = guzik(ui.kWulk, '✕', 'Zamknij kartę (Esc)', 'ge-panel-x'); ui.kWulkX.removeAttribute('aria-pressed');
    ui.kWulkT = el('div', 'ge-karta-tresc', null, ui.kWulk);
    // legenda wulkanów (szeroki ekran: dół, w miejscu suwaka czasu; wąski: zwijana dolna szuflada)
    ui.legWulk = el('aside', 'ge-panel ge-wulk-legenda', null, ui.makieta); ui.legWulk.hidden = true; ui.legWulk.setAttribute('aria-label', 'Legenda wulkanów');
    ui.legWulkNaglowek = el('button', 'ge-wulk-naglowek', null, ui.legWulk); ui.legWulkNaglowek.type = 'button';
    ui.legWulkTytul = el('span', 'ge-wulk-tytul', 'Wulkany', ui.legWulkNaglowek);
    ui.legWulkStrzalka = el('span', 'ge-wulk-strzalka', '▾', ui.legWulkNaglowek);
    ui.legWulkTresc = el('div', 'ge-wulk-tresc', null, ui.legWulk);
    ui.legWulkNaglowek.addEventListener('click', function () {
      var wl = ui.legWulk.dataset.zwiniety === 'true';
      // wąski ekran: legenda, plan i karta to dolne szuflady — naraz otwarta jedna
      if (wl && waskiEkran()) { zamknijTur(); zamknijWulkan(); if (!ui.kCzesc.hidden) zamknijCzesc(); if (planRozwiniety()) rozwinPlan(false); }
      rozwinLegendeWulkanow(wl);
    });
    // kompas: róża (klik = północ u góry) i przyciski widoków
    ui.kompas = el('div', 'ge-kompas', null, ui.makieta);
    ui.kompas.setAttribute('role', 'group'); ui.kompas.setAttribute('aria-label', 'Kompas i widoki');
    ui.widoki = el('div', 'ge-widoki', null, ui.kompas);
    ui.bWidok = {};
    ['poludnie', 'polnoc', 'gora'].forEach(function (n) {
      var b = guzik(ui.widoki, NAZWY_WIDOKOW[n], NAZWY_WIDOKOW[n] === 'Z góry' ? 'Widok z góry, północ u góry' : 'Widok na całą wyspę ' + NAZWY_WIDOKOW[n].toLowerCase());
      b.removeAttribute('aria-pressed'); b.addEventListener('click', function () { ustawWidok(n, true); });
      ui.bWidok[n] = b;
    });
    ui.roza = el('button', 'ge-roza', null, ui.kompas);
    ui.roza.type = 'button'; ui.roza.title = 'Kompas — kliknij: północ u góry';
    ui.roza.setAttribute('aria-label', 'Kompas: ustaw północ u góry');
    ui.rozaObrot = zbudujRoze(ui.roza);
    ui.roza.addEventListener('click', function () { ustawWidok('gora', true); });
    // panel „Plan dni” (na wąskim ekranie dolna szuflada)
    ui.plan = el('aside', 'ge-panel ge-plan', null, ui.makieta); ui.plan.hidden = true; ui.plan.setAttribute('aria-label', 'Plan dni');
    ui.planNaglowek = el('button', 'ge-plan-naglowek', null, ui.plan); ui.planNaglowek.type = 'button';
    el('span', 'ge-plan-tytul', 'Plan dni 23.11–1.12', ui.planNaglowek);
    ui.planStrzalka = el('span', 'ge-plan-strzalka', '▾', ui.planNaglowek);
    ui.planNaglowek.setAttribute('aria-expanded', 'true');
    ui.planNaglowek.addEventListener('click', function () {
      var wl = ui.plan.dataset.zwiniety === 'true';
      // wąski ekran: plan i karta to dwie dolne szuflady — naraz otwarta jedna
      if (wl && waskiEkran()) { zamknijTur(); zamknijWulkan(); if (!ui.kCzesc.hidden) zamknijCzesc(); if (legendaWulkanowRozwinieta()) rozwinLegendeWulkanow(false); }
      rozwinPlan(wl);
    });
    ui.planLista = el('ol', 'ge-plan-lista', null, ui.plan);
    ui.komunikat = el('div', 'ge-komunikat', null, korzen); ui.komunikat.setAttribute('role', 'status'); ui.komunikat.hidden = true;

    ui.bTeren.addEventListener('click', function () { ustawKolorowanie('teren'); });
    ui.bGeologia.addEventListener('click', function () { ustawKolorowanie('geologia'); });
    ui.bZwykly.addEventListener('click', function () { ustawMaterial('zwykly'); });
    ui.bSklejka.addEventListener('click', function () { ustawMaterial('sklejka'); });
    ui.bPrzekroj.addEventListener('click', function () { ustawPrzekroj(mks.przekroj ? null : { kat_st: +ui.katSuwak.value, przesuniecie_km: 0 }, true); });
    ui.katSuwak.addEventListener('input', function () { if (mks.przekroj) ustawPrzekroj({ kat_st: +ui.katSuwak.value, przesuniecie_km: mks.przekroj.przesuniecie_km }, false); });
    ui.bChmury.addEventListener('click', function () { ustawPogode(mks.pogoda === 'chmury' ? 'pogodnie' : 'chmury'); });
    ui.bKalima.addEventListener('click', function () { ustawPogode(mks.pogoda === 'kalima' ? 'pogodnie' : 'kalima'); });
    ui.bPogodnie.addEventListener('click', function () { ustawPogode('pogodnie'); });
    ui.bStale.addEventListener('click', function () { ustawPore(null); });
    ui.bTeraz.addEventListener('click', function () { ustawPore(mks.pora === 'teraz' ? null : 'teraz'); });
    ui.bCienTeide.addEventListener('click', function () { var c = cienTeideDzis(); if (c) ustawPore(c.poPoludniu ? c.wieczor : c.rano); });
    // przeciąganie: światło na bieżąco, adres dopiero po puszczeniu (replaceState przy każdym kroku Chrome dławi)
    ui.poraSuwak.addEventListener('input', function () { ustawPore(+ui.poraSuwak.value, true); });
    ui.poraSuwak.addEventListener('change', function () { adres(); });
    ui.bPrzew.forEach(function (b) { b.addEventListener('click', function () { ustawPrzewyzszenie(+b.dataset.przew); }); });
    ui.bMity.addEventListener('click', function () { if (mks.mity) zamknijMity(); else pokazMity(); });
    ui.bPelny.addEventListener('click', pelnyEkran);
    ui.bZamknij.addEventListener('click', function () { window.Zakladki.zamknijDoUkladu(); });
    ui.kCzescX.addEventListener('click', zamknijCzesc);
    ui.kMityX.addEventListener('click', zamknijMity);
    ui.kTurX.addEventListener('click', zamknijTur);
    ui.bTurystyka.addEventListener('click', function () { ustawTurystyke(!mks.turystyka); });
    ui.bWulkany.addEventListener('click', function () { ustawWulkany(!mks.wulkany); });
    ui.bWiatr.addEventListener('click', function () { ustawWiatr(!mks.wiatr); });
    ui.bGlosnik.addEventListener('click', function () { ustawDzwiekMakiety(!pj.wl); });
    ui.kWulkX.addEventListener('click', zamknijWulkan);
    zbudujLegende();
    zbudujOsCzasu();
    podpinanieWskaznika();
    return ui;
  }
  function wejdzWMiejsce(id) {
    // przez rejestr zakładek: ładowanie.js dociągnie pliki miejsca, jeśli to pierwsze wejście
    window.Zakladki.przelacz('geologia', { miejsce: id, tryb: 'pokaz', rozdzial: 'polozenie' });
  }
  function odswiezUI() {
    var pozycje = M.podmenu(M.MIEJSCA, st.miejsce);
    pozycje.forEach(function (p) { if (przyciskiMiejsc[p.id]) przyciskiMiejsc[p.id].setAttribute('aria-pressed', String(p.wcisniety)); });
    L.ROZDZIALY.forEach(function (r) { przyciskiRozdzialow[r.id].setAttribute('aria-pressed', String(st.rozdzial === r.id)); });
    var m = st.tryb === 'makieta';
    ui.rozdzialy.hidden = m;
    ui.bDoMakiety.hidden = m;
    ui.narzedzia.hidden = !m;
    ui.makieta.hidden = !m;
    odswiezNarzedzia();
  }
  function odswiezNarzedzia() {
    if (!ui) return;
    ui.bTeren.setAttribute('aria-pressed', String(mks.kolorowanie !== 'geologia'));
    ui.bGeologia.setAttribute('aria-pressed', String(mks.kolorowanie === 'geologia'));
    ui.bZwykly.setAttribute('aria-pressed', String(mks.material !== 'sklejka'));
    ui.bSklejka.setAttribute('aria-pressed', String(mks.material === 'sklejka'));
    ui.bPrzekroj.setAttribute('aria-pressed', String(!!mks.przekroj));
    ui.kat.hidden = !mks.przekroj;
    ui.bChmury.setAttribute('aria-pressed', String(mks.pogoda === 'chmury'));
    ui.bKalima.setAttribute('aria-pressed', String(mks.pogoda === 'kalima'));
    ui.bPogodnie.setAttribute('aria-pressed', String(mks.pogoda === 'pogodnie'));
    ui.bStale.setAttribute('aria-pressed', String(mks.pora === null));
    ui.bTeraz.setAttribute('aria-pressed', String(mks.pora === 'teraz'));
    ui.bPrzew.forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.przew === mks.przewCel)); });
    ui.bMity.setAttribute('aria-pressed', String(mks.mity));
    ui.bPelny.setAttribute('aria-pressed', String(doc.fullscreenElement === korzen));
    ui.legenda.hidden = mks.kolorowanie !== 'geologia';
    ui.podpisPrzew.textContent = 'przewyższenie ×' + liczba(mks.przew, 1);
    ui.bTurystyka.setAttribute('aria-pressed', String(mks.turystyka));
    // przycisk zwijania paska tylko w makiecie; w pokazie pasek zawsze rozwinięty
    ui.bPasek.hidden = st.tryb !== 'makieta';
    if (st.tryb !== 'makieta' && $('gePasek') && $('gePasek').classList.contains('ge-pasek-zwiniety')) zwinPasek(false);
    var tur = mks.turystyka && st.tryb === 'makieta';
    if (tur) zbudujTurystykeUI();
    if (ui.ostrzezenie) ui.ostrzezenie.hidden = !tur;
    ui.bWulkany.setAttribute('aria-pressed', String(mks.wulkany));
    ui.bWiatr.setAttribute('aria-pressed', String(mks.wiatr));
    odswiezGlosnik();
    var wulk = mks.wulkany && st.tryb === 'makieta';
    if (wulk) zbudujLegendeWulkanow();
    // warstwy liczone z dzisiejszej rzeźby — w trybie turystycznym i wulkanów bez suwaka czasu
    ui.czas.hidden = tur || wulk;
    widocznoscTurystyki();
    ukladKart();
  }
  // Karty pod paskiem (pasek łamie się na wąskim ekranie i przy suwaku kąta). Otwarta karta (prawa kolumna) przesuwa
  // środek kadru w lewo o połowę swojej szerokości — makieta zostaje w wolnej części ekranu (setViewOffset).
  function ukladKart() {
    var p = $('gePasek'), h = p ? p.offsetHeight : 52;
    // górna krawędź kart i planu dni przez zmienną CSS (wąski ekran: karty są dolną szufladą — `top: auto` w CSS)
    korzen.style.setProperty('--ge-pod-paskiem', (h + 10) + 'px');
    ui.legenda.style.maxHeight = 'calc(100% - ' + (h + 70) + 'px)';
    przesunKadr();
  }
  function przesunKadr() {
    if (!mk || !gl || !gl.w) return;
    var otwarta = !ui.kCzesc.hidden || !ui.kMity.hidden || !ui.kPrzekroj.hidden || !ui.kTur.hidden || !ui.kWulk.hidden;
    var off = otwarta && gl.w >= 900 ? (ui.karty.offsetWidth + 14) / 2 : 0, k = mk.sc.kamera;
    // panel „Plan dni” (lewa kolumna na szerokim ekranie) przesuwa środek w prawo o połowę swojej szerokości
    if (gl.w >= 900 && !ui.plan.hidden && ui.plan.dataset.zwiniety !== 'true') off -= (ui.plan.offsetWidth + 14) / 2;
    // wąski ekran: pasek (kilka wierszy) zasłania górę — środek kadru w dół o połowę jego wysokości; karta jest dolną
    // szufladą — środek w górę o połowę jej wysokości
    var offY = 0;
    if (gl.w <= 700) {
      var p = $('gePasek');
      var szuflada = otwarta ? Math.min(ui.karty.offsetHeight, gl.h * 0.5) : planRozwiniety() ? ui.plan.offsetHeight
        : legendaWulkanowRozwinieta() ? ui.legWulk.offsetHeight : 0;
      offY = szuflada / 2 - (p ? p.offsetHeight : 0) / 2;
    }
    ukladSzuflad();
    if (Math.abs(off) > 0.5 || Math.abs(offY) > 0.5) k.setViewOffset(gl.w, gl.h, off, offY, gl.w, gl.h); else k.clearViewOffset();
    k.updateProjectionMatrix();
  }
  // Wąski ekran z legendą wulkanów: legenda stoi nad szufladą planu dni (obie dolne), kompas i podpis przewyższenia nad
  // legendą. Szeroki ekran i sama Turystyka: układ z CSS (style inline zdjęte).
  function ukladSzuflad() {
    var leg = !ui.legWulk.hidden, plan = !ui.plan.hidden, nad = [ui.kompas, ui.podpisPrzew];
    if (gl.w > 700 || !leg) {
      ui.legWulk.style.bottom = '';
      nad.forEach(function (e) { e.style.bottom = ''; });
      return;
    }
    var hPlan = plan ? Math.ceil(ui.plan.getBoundingClientRect().height) : 0;     // ułamki px: offsetHeight zaokrągla w dół
    ui.legWulk.style.bottom = hPlan + 'px';
    // kompas i podpis zawsze nad legendą (także rozwiniętą — inaczej przyciski widoków leżą na jej treści)
    var b = hPlan + Math.ceil(ui.legWulk.getBoundingClientRect().height) + 8;
    nad.forEach(function (e) { e.style.bottom = b + 'px'; });
  }
  function adres() {
    if (smoke) return;
    var h = '#geologia=' + st.miejsce + (st.tryb === 'makieta' ? '&tryb=makieta' + (aktywneWarstwy() ? '&warstwa=' + aktywneWarstwy() : '') + adresPory()
      + (mks.material === 'sklejka' ? '&material=sklejka' : '') + (mks.wiatr ? '' : '&wiatr=0') : '&rozdzial=' + st.rozdzial);
    try { history.replaceState(null, '', location.pathname + location.search + h); } catch (_) { /* file:// */ }
  }
  var zegarKom = null;
  function komunikat(t, trwaly) {
    if (!ui) return;
    ui.komunikat.textContent = t || ''; ui.komunikat.hidden = !t;
    if (zegarKom) clearTimeout(zegarKom);
    zegarKom = t && !trwaly ? setTimeout(function () { ui.komunikat.hidden = true; }, 6000) : null;
  }

  /* ---------- renderer (jeden na życie strony) ---------- */
  function zapewnijGL() {
    if (gl) return gl;
    var r = new T.WebGLRenderer({ canvas: ui.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputEncoding = T.sRGBEncoding;
    r.toneMapping = T.LinearToneMapping; r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFShadowMap; r.shadowMap.autoUpdate = false;
    r.localClippingEnabled = true;
    gl = { renderer: r, w: 0, h: 0 };
    window.addEventListener('resize', dopasuj);
    doc.addEventListener('fullscreenchange', function () { dopasuj(); odswiezNarzedzia(); });
    return gl;
  }
  function dopasuj() {
    if (!gl) return;
    var w = korzen.clientWidth, h = korzen.clientHeight;
    if (!(w > 0 && h > 0) || (w === gl.w && h === gl.h)) return;
    gl.w = w; gl.h = h;
    var cs = ui.canvas.style;
    if (st.tryb === 'pokaz' && pokaz) {
      // pokaz: kadr KinoKadr.kadrKinowy z całego kontenera (R1) — canvas = prostokąt kadru, pasy = tło kontenera
      var k = pokaz.dopasuj(w, h);
      cs.left = k.x + 'px'; cs.top = k.y + 'px'; cs.width = k.w + 'px'; cs.height = k.h + 'px';
      gl.renderer.setSize(Math.max(1, k.w), Math.max(1, k.h), false);
    } else {
      cs.left = cs.top = cs.width = cs.height = '';
      gl.renderer.setSize(w, h, false);
    }
    if (ui) ukladKart();
    if (mk) {
      mk.sc.kamera.aspect = w / h; mk.sc.kamera.updateProjectionMatrix(); limityKamery();
      // kadr policzony automatycznie (bez gestu użytkownika) liczymy od nowa dla nowych proporcji
      var kd = mk.kadrAuto === 'start' ? kadrStartowy() : mk.kadrAuto === 'przekroj' && mks.przekroj && mks.przekroj.profil ? kadrPrzekroju(mks.przekroj.profil)
        : mk.kadrAuto === 'widok' && mks.widok ? kadrWidoku(mks.widok) : null;
      if (kd && !mk.lot) ustawKadr(kd.poz, kd.cel);
    }
  }
  function kolorTla() { return zap.kontrola === 'biel' ? 0xffffff : zap.kontrola === 'czern' ? 0x000000 : 0x05070a; }
  var scena = null, kamera = null;
  function krok(teraz) {
    rafId = 0;
    if (!aktywny) return;
    dopasuj();
    var dt = ostatni ? Math.min(0.25, Math.max(0, (teraz - ostatni) / 1000)) : 0;
    if (ostatni && dt > 0) fps += (1 / dt - fps) * 0.1;
    ostatni = teraz;
    pilnujJakosci(teraz);
    if (st.tryb === 'makieta' && mk) {
      krokMakiety(dt, smoke ? 1 : (teraz - tStart) / 1000);
      gl.renderer.render(mk.sc.scena, mk.sc.kamera);
    } else if (!(st.tryb === 'pokaz' && pokaz && pokaz.klatka(dt))) {
      gl.renderer.setRenderTarget(null);
      gl.renderer.setClearColor(kolorTla(), 1);
      gl.renderer.render(scena, kamera);
    }
    if (gotowosc && (st.tryb === 'makieta' ? mk : pokaz && pokaz.gotowy())) {
      // smoke makiety: stan po hakach (materiał, przewyższenie, krok sklejki) — scripts/smoke-geologia.mjs porównuje go z haka
      if (st.tryb === 'makieta') {
        var sm = window.Geologia.stan(), ss = sm.scena || {};
        console.log('GEOLOGIA_STAN_MAKIETY ' + JSON.stringify({ material: sm.material, przewyzszenie: sm.przewyzszenie,
          scena: { material: ss.material, przewyzszenie: ss.przewyzszenie, krokSklejki_m: ss.krokSklejki_m, cienieHor: ss.cienieHor,
            wiatr: ss.wiatr, wiatrLinie: ss.wiatrLinie, wiatrMs: ss.wiatrMs } }));
      }
      console.log('GEOLOGIA_READY ' + gotowosc); gotowosc = null;
    }
    rafId = requestAnimationFrame(krok);
  }
  // Jakość: fps < 30 przez 2 s (poza smoke i hakiem &jakosc=pelna) → piksele 1:1. Siatka terenu (lod) zostaje.
  function pilnujJakosci(teraz) {
    fpsOkno.n++;
    if (!fpsOkno.t0) { fpsOkno.t0 = teraz; return; }
    if (teraz - fpsOkno.t0 < 1000) return;
    var f = fpsOkno.n * 1000 / (teraz - fpsOkno.t0); fpsOkno.n = 0; fpsOkno.t0 = teraz;
    slabe = f < 30 && !doc.hidden ? slabe + 1 : 0;
    if (slabe >= 2 && jakosc === 'pelna' && !wymusPelna) {
      jakosc = 'lekka';
      gl.renderer.setPixelRatio(1); gl.w = 0; dopasuj();
      if (mk) mk.sc.wiatr(null, liczbaSmug());     // Task A2 (R4): mniej smug w jakości „lekka” — jedna przebudowa geometrii
    }
  }

  /* ---------- rzeźba: dekodowanie bez zarządzania kolorem ---------- */
  function dekodujObraz(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ': HTTP ' + r.status); return r.blob(); })
      .then(function (b) { return createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }); })
      .then(function (bm) {
        var c = doc.createElement('canvas'); c.width = bm.width; c.height = bm.height;
        var x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(bm, 0, 0);
        var d = x.getImageData(0, 0, bm.width, bm.height);
        var wynik = { w: bm.width, h: bm.height, rgba: d.data };
        if (bm.close) bm.close();
        return wynik;
      });
  }
  function wczytajRzezbe(miejsce) {
    if (rzezby[miejsce]) return rzezby[miejsce];
    var m = M.MIEJSCA.filter(function (x) { return x.id === miejsce; })[0];
    var kat = m ? m.katalog : 'geologia/' + miejsce + '/';
    var p = fetch(kat + 'rzezba.json').then(function (r) { if (!r.ok) throw new Error('rzezba.json: HTTP ' + r.status); return r.json(); })
      .then(function (meta) {
        var pliki = [{ meta: meta, plik: kat + 'rzezba.png', id: 'wyspa' }, { meta: meta.archipelag, plik: meta.archipelag.plik, id: 'archipelag' }]
          .concat((meta.wstawki || []).map(function (w) { return { meta: w, plik: w.plik, id: w.id }; }));
        return Promise.all(pliki.map(function (x) {
          return dekodujObraz(x.plik).then(function (px) {
            if (px.w !== x.meta.w || px.h !== x.meta.h) throw new Error(x.plik + ': ' + px.w + '×' + px.h + ' zamiast ' + x.meta.w + '×' + x.meta.h);
            var s = Teren.zPikseli(px.rgba, px.w, px.h, x.meta); s.id = x.id;
            if (x.meta.mNaPikselDanych) s.mNaPikselDanych = x.meta.mNaPikselDanych;
            return s;
          });
        })).then(function (siatki) {
          var stat = Teren.statystyki(siatki[0]);
          var wynik = { meta: meta, wyspa: siatki[0], archipelag: siatki[1], wstawki: siatki.slice(2), hMax: stat.hMax, hMin: stat.hMin };
          // Kontrola dekodowania: przeglądarka z korekcją koloru przesuwa wysokości po cichu — szczyt musi się zgadzać co do metra.
          if (stat.hMax !== meta.hMax || stat.hMin !== meta.hMin) {
            console.error('Geologia: rzeźba zdekodowana z błędem — szczyt ' + stat.hMax + ' m, dno ' + stat.hMin + ' m zamiast ' + meta.hMax + ' / ' + meta.hMin + ' m (zarządzanie kolorem?)');
          } else if (smoke) console.log('GEOLOGIA_RZEZBA hMax=' + stat.hMax + ' hMin=' + stat.hMin + ' zgodne z rzezba.json');
          return wynik;
        });
      });
    rzezby[miejsce] = p.then(null, function (e) { delete rzezby[miejsce]; throw e; });
    return rzezby[miejsce];
  }

  // Mapa horyzontu (Task A3): horyzont.json (z nim stożek Teide — R13) + 2 PNG RGBA rozpakowane tu bajt w bajt (DecompressionStream + odfiltrowanie
  // z geologia/horyzont.js) — bez kanwy, która mnoży kolor przez alfę (kąt 0 w kanale A zerowałby RGB), i bez zarządzania
  // kolorem. Suma kontrolna bajtów z horyzont.json jak szczyt rzeźby. Brak mapy / przeglądarka bez DecompressionStream:
  // makieta bez cieni z horyzontu (null), bez blokowania wejścia.
  var horyzonty = {};
  function rozpakujPng(url) {
    var HZ = window.GeologiaHoryzont;
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ': HTTP ' + r.status); return r.arrayBuffer(); })
      .then(function (b) {
        var p = HZ.rozbierzPng(new Uint8Array(b));
        var strumien = new Blob([p.idat]).stream().pipeThrough(new DecompressionStream('deflate'));
        return new Response(strumien).arrayBuffer().then(function (raw) { return { w: p.w, h: p.h, rgba: HZ.odfiltrujPng(new Uint8Array(raw), p.w, p.h, p.bpp) }; });
      });
  }
  function wczytajHoryzont(miejsce) {
    if (horyzonty[miejsce]) return horyzonty[miejsce];
    var HZ = window.GeologiaHoryzont;
    if (!HZ || typeof DecompressionStream === 'undefined') {
      console.warn('Geologia/uwaga: przeglądarka bez DecompressionStream — makieta bez cieni z mapy horyzontu');
      return Promise.resolve(null);
    }
    var m = M.MIEJSCA.filter(function (x) { return x.id === miejsce; })[0];
    var kat = m ? m.katalog : 'geologia/' + miejsce + '/';
    var p = fetch(kat + 'horyzont.json').then(function (r) { if (!r.ok) throw new Error('horyzont.json: HTTP ' + r.status); return r.json(); })
      .then(function (meta) {
        var pliki = ['horyzont-0.png', 'horyzont-1.png'];
        return Promise.all(pliki.map(function (f) { return rozpakujPng(kat + f); })).then(function (obr) {
          obr.forEach(function (o, i) {
            var oczek = meta.pliki && meta.pliki[pliki[i]];
            if (!oczek || o.w !== oczek.w || o.h !== oczek.h || HZ.suma(o.rgba) !== oczek.suma) throw new Error(pliki[i] + ' niezgodny z horyzont.json (rozmiar albo suma kontrolna)');
          });
          if (smoke) console.log('GEOLOGIA_HORYZONT ' + meta.w + 'x' + meta.h + ' sumy zgodne z horyzont.json');
          return { meta: meta, rgba0: obr[0].rgba, rgba1: obr[1].rgba };
        });
      });
    horyzonty[miejsce] = p.then(null, function (e) {
      console.error('Geologia: mapa horyzontu — ' + (e && e.message || e) + '; makieta bez cieni z horyzontu');
      delete horyzonty[miejsce];
      return null;
    });
    return horyzonty[miejsce];
  }

  /* ---------- makieta ---------- */
  function lod() {
    if (/[?&]lod=lekki(?=&|$)/.test(location.search)) return 'lekki';      // hak: siatka co drugą próbkę (jak na telefonie)
    if (smoke) return 'pelny';
    var telefon = window.matchMedia && window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
    return telefon ? 'lekki' : 'pelny';
  }
  function wejdzMakieta() {
    if (mk) return;
    var moja = ++budowa;
    wczytajLektorMakiety();             // czasy.json lektora pinów: raz na wejście, tylko z bazą (zaproszenie / &lektor=lokalny)
    komunikat('Wczytuję rzeźbę terenu…', true);
    wczytajRzezbe(st.miejsce).then(function (rz) {
      if (moja !== budowa || !aktywny || st.tryb !== 'makieta' || mk) return;
      zbudujMakiete(rz);
    }).then(null, function (e) {
      if (moja !== budowa) return;
      console.error('Geologia: makieta — ' + (e && e.message || e));
      komunikat('Nie udało się zbudować makiety (' + (e && e.message || e) + ').', true);
    });
  }
  function zbudujMakiete(rz) {
    var sc = S.zbuduj(T, gl.renderer, { siatka: rz.wyspa, poziomy: { archipelag: rz.archipelag, wstawki: rz.wstawki },
      dane: window.GeologiaTeneryfa || {}, lod: lod(), przewyzszenie: mks.przew, wiatrLinie: liczbaSmug() });
    mk = { sc: sc, ster: null, rz: rz, maxDyst: 500, lot: null };
    sc.kamera.aspect = (gl.w || 16) / (gl.h || 9); sc.kamera.updateProjectionMatrix();
    sc.kolorowanie(mks.kolorowanie);
    sc.material(mks.material);          // Task B1: warstwy i woda materiału (animacja z haka niżej nadpisze wodę swoją)
    sc.wiatr(mks.wiatr && !mks.anim);   // Task A2: smugi pasatu (animacja z haka niżej je chowa)
    zastosujNiebo();                    // pora i pogoda (Task 8e); bez parametrów — to samo światło co budowa sceny
    if (T.OrbitControls) utworzSterowanie(); else console.warn('Geologia/uwaga: brak OrbitControls — makieta bez obracania kamerą');
    zwinPasek((mks.turystyka || mks.wulkany) && waskiEkran());     // stan paska ze stanu warstw przy każdym wejściu, zanim policzymy kadr
    odswiezNarzedzia();                 // układ nakładek (pasek z ostrzeżeniem, plan, przesunięcie kadru) przed dopasowaniem kadru
    var k0 = kadrStartowy(); ustawKadr(k0.poz, k0.cel); mk.kadrAuto = 'start';
    if (mks.przekroj) ustawPrzekroj(mks.przekroj, true);
    komunikat('');
    // stany haka smoke: natychmiast, przed markerem
    if (mks.czas > 0) sc.czas(mks.czas);
    if (smoke) {
      if (zap.geologiczna) ustawKolorowanie('geologia');
      // przewyższenie z haka od razu (bez animacji przejścia): warstwy sklejki i kadr przy skali Y stanu (Review Focus 4)
      if (zap.przew != null) { ustawPrzewyzszenie(zap.przew); mks.przew = mks.przewCel; }
      if (zap.przekroj != null) ustawPrzekroj({ kat_st: zap.przekroj, przesuniecie_km: zap.przesuniecie || 0 }, true);
      if (zap.czas != null) ustawCzas(zap.czas);
      if (zap.anim) uruchomAnimacje(zap.anim, zap.f);
      if (zap.widok) ustawWidok(zap.widok, false);
    }
    if (mks.turystyka) ustawTurystyke(true);
    if (mks.wulkany) ustawWulkany(true);
    odswiezNarzedzia();
    // Task A3: mapa horyzontu dochodzi po wejściu (nie blokuje budowy); smoke czeka na nią przed markerem
    var ten = mk, miejsce = st.miejsce;
    wczytajHoryzont(miejsce).then(function (h) {
      if (mk !== ten) return;
      if (h) ten.sc.horyzont(h);
      ten.horGotowy = true;             // stan().gotowa (sondy, pomiar): makieta z mapą horyzontu albo bez niej — rozstrzygnięte
      if (smoke) gotowosc = miejsce + ' makieta';
    });
  }
  // Task A2 (R4): liczba smug pasatu z jakości (pełna 4000, lekka 2000 — telefon 2–4 tys.)
  function liczbaSmug() { var Wt = window.GeologiaWiatr; return Wt ? Wt.LICZBA[jakosc] || Wt.LICZBA.pelna : 0; }
  function zwolnijMakiete() {
    budowa++;
    zwolnijLektorMakiety();
    zwolnijPejzaz();
    if (!mk) return;
    if (mk.ster) mk.ster.dispose();
    if (mk.anim) mk.anim.zwolnij();
    mk.sc.zwolnij();                    // zwalnia też zasoby warstw turystycznej i wulkanów (z() sceny)
    mk = null;
    gl.renderer.renderLists.dispose();
    mks.czesc = null; mks.hover = null; mks.tur = null; mks.widok = null; mks.azymut = null; mks.wulk = null;
    if (ui) { ui.kCzesc.hidden = true; ui.kPrzekroj.hidden = true; ui.kTur.hidden = true; ui.kWulk.hidden = true; }
  }
  function utworzSterowanie() {
    var k = new T.OrbitControls(mk.sc.kamera, ui.canvas);
    k.enableDamping = true; k.dampingFactor = 0.08; k.screenSpacePanning = false;
    k.maxPolarAngle = Math.PI * 0.495; k.rotateSpeed = 0.6; k.zoomSpeed = 0.9;
    k.addEventListener('start', function () { if (mk) { mk.lot = null; mk.kadrAuto = null; mks.widok = null; } });
    mk.ster = k;
  }
  // G-K: maxDistance = cały archipelag w kadrze (z proporcji ekranu)
  function limityKamery() {
    if (!mk) return;
    var g = mk.sc.granice.archipelag, k = mk.sc.kamera, fov = k.fov * RAD, hf = Math.atan(Math.tan(fov / 2) * k.aspect);
    mk.maxDyst = Math.max((g.x1 - g.x0) / 2 / Math.tan(hf), (g.z1 - g.z0) / 2 / Math.tan(fov / 2)) * 1.1;
    if (mk.ster) mk.ster.maxDistance = mk.maxDyst;
  }
  // Kadr startowy: cała wyspa z SSW, 48° nad poziomem; odległość dobrana rzutem (narożniki lądu i szczyt w kadrze,
  // margines na pasek) — z proporcji ekranu wynika sama (pion: dalej).
  function kadrStartowy() {
    var sc = mk.sc, ld = sc.lad, e = sc.przewyzszenie(), cx = (ld.x0 + ld.x1) / 2, cz = (ld.z0 + ld.z1) / 2;
    var el = 48 * RAD, nam = 195 * RAD, u = [Math.cos(el) * Math.sin(nam), Math.sin(el), -Math.cos(el) * Math.cos(nam)];
    var pkt = [[ld.x0, 0, ld.z0], [ld.x1, 0, ld.z0], [ld.x0, 0, ld.z1], [ld.x1, 0, ld.z1]];
    var s = sc.srodekPrzekroju; pkt.push([s[0], 3.7 * e, s[1]]);
    var d = dopasujOdleglosc([cx, 0, cz], u, pkt, 0.9, 0.86, 0.74);
    // ekran pionowy: dopasowanie w pionie zostawiało wyspę na 38% szerokości — start ×1,3 bliżej (recenzja kinowa r1,
    // I12c chciała ×1,8 — przy ×1,5 Teno i jego etykieta wychodzą za lewą krawędź 390 px)
    if (sc.kamera.aspect < 1) d /= 1.3;
    return { poz: [cx + u[0] * d, u[1] * d, cz + u[2] * d], cel: [cx, 0, cz] };
  }
  // Najmniejsza odległość wzdłuż u, przy której wszystkie punkty mieszczą się w NDC [−mx, mx] × [−dol, gora].
  function dopasujOdleglosc(cel, u, pkt, mx, dol, gora) {
    // klon z dalekim far: przy far kamery z budowy (800 km) połowienie od 1500 km nigdy nie trafiało w „mieści się”
    var k = mk.sc.kamera.clone(), lo = 1, hi = 3000, v = new T.Vector3();
    k.near = 0.01; k.far = 1e6; k.updateProjectionMatrix();
    for (var i = 0; i < 30; i++) {
      var d = (lo + hi) / 2;
      k.position.set(cel[0] + u[0] * d, cel[1] + u[1] * d, cel[2] + u[2] * d); k.lookAt(cel[0], cel[1], cel[2]); k.updateMatrixWorld();
      var ok = pkt.every(function (p) { v.fromArray(p).project(k); return v.z < 1 && Math.abs(v.x) <= mx && v.y >= -dol && v.y <= gora; });
      if (ok) hi = d; else lo = d;
    }
    return hi;
  }
  // Kadr na ścianę przekroju: widz po stronie usuwanej, 20° nad poziomem, cała ściana (od spodu −12 km po szczyt) w kadrze.
  function kadrPrzekroju(profil) {
    var sc = mk.sc, e = sc.przewyzszenie();
    var a = Teren.doLokalnych(null, profil.a[0], profil.a[1]), b = Teren.doLokalnych(null, profil.b[0], profil.b[1]);
    var kat = profil.kat_st * RAD, n = [Math.cos(kat), Math.sin(kat)], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, cy = -4 * e;
    var el = 20 * RAD, u = [n[0] * Math.cos(el), Math.sin(el), n[1] * Math.cos(el)];
    var g = Math.max(0, profil.maks_m / 1000) * e;
    var pkt = [[a[0], -12 * e, a[1]], [b[0], -12 * e, b[1]], [a[0], g, a[1]], [b[0], g, b[1]], [mx, g, mz]];
    var d = dopasujOdleglosc([mx, cy, mz], u, pkt, 0.94, 0.9, 0.8);
    return { poz: [mx + u[0] * d, cy + u[1] * d, mz + u[2] * d], cel: [mx, cy, mz] };
  }
  function ustawKadr(poz, cel, plynnie) {
    var k = mk.sc.kamera;
    if (plynnie && !smoke && !ograniczonyRuch() && mk.ster) {
      mk.lot = { t: 0, p0: k.position.clone(), c0: mk.ster.target.clone(), p1: new T.Vector3().fromArray(poz), c1: new T.Vector3().fromArray(cel) };
      return;
    }
    mk.lot = null;
    k.position.fromArray(poz);
    if (mk.ster) { mk.ster.target.fromArray(cel); limityKamery(); mk.ster.update(); }
    else k.lookAt(cel[0], cel[1], cel[2]);
    ograniczKamere();
  }
  // G-K: cel na poziomie morza w granicach archipelagu; minDistance z wysokości terenu pod celem (zbliżenie do 0,3 km nad
  // szczytem); kamera nie schodzi pod teren ani pod taflę wody „realnej” (+0,15 km) — po każdym kroku sterowania.
  function ograniczKamere() {
    var sc = mk.sc, k = sc.kamera, s = mk.ster;
    if (s) {
      var g = sc.granice.archipelag;
      s.target.x = Math.max(g.x0, Math.min(g.x1, s.target.x)); s.target.z = Math.max(g.z0, Math.min(g.z1, s.target.z));
      s.target.y = mks.przekroj ? Math.max(-12 * sc.przewyzszenie(), Math.min(0, s.target.y)) : mks.anim ? s.target.y : 0;
      var hc = sc.wysokosc(s.target.x, s.target.z);
      s.minDistance = Math.max(0, hc == null ? 0 : hc) + 0.3;
      s.maxDistance = mk.maxDyst;
    }
    var hy = sc.wysokosc(k.position.x, k.position.z);
    if (hy == null) hy = -4 * sc.przewyzszenie();
    var podloga = (sc.szklo() < 0.5 ? Math.max(hy, 0) : hy) + 0.15;
    if (k.position.y < podloga) {
      k.position.y = podloga;
      if (s) k.lookAt(s.target);
    }
  }
  function krokMakiety(dt, t) {
    var sc = mk.sc;
    var osm = turystykaWidoczna() || wulkanyWidoczna();
    if (ui.atrybOsm.hidden === osm) ui.atrybOsm.hidden = !osm;
    var wv = sc.wiatr();                // smugi widoczne (przycisk, animacja, czas geologiczny) → plakietka SCHEMAT
    if (ui.plakWiatr.hidden === wv) ui.plakWiatr.hidden = !wv;
    // przewyższenie: zmiana animowana i podpisana (0,8 s), w smoke i przy ograniczonym ruchu — od razu
    if (mks.przew !== mks.przewCel) {
      var d = mks.przewCel - mks.przew, krokP = (smoke || ograniczonyRuch()) ? Math.abs(d) : Math.abs(d) * Math.min(1, dt * 4) + dt * 0.4;
      mks.przew = Math.abs(d) <= krokP ? mks.przewCel : mks.przew + Math.sign(d) * krokP;
      sc.przewyzszenie(mks.przew, mks.przew !== mks.przewCel);
      ui.podpisPrzew.textContent = 'przewyższenie ×' + liczba(mks.przew, 1);
      if (mks.przew === mks.przewCel && mks.przekroj) odswiezKartePrzekroju(mks.przekroj.profil);
    }
    if (mk.lot) {
      var l = mk.lot; l.t = Math.min(1, l.t + dt / 1.4);
      var e = l.t * l.t * (3 - 2 * l.t);
      sc.kamera.position.lerpVectors(l.p0, l.p1, e); mk.ster.target.lerpVectors(l.c0, l.c1, e);
      if (l.t >= 1) mk.lot = null;
    }
    if (mk.ster) mk.ster.update();
    ograniczKamere();
    sc.animuj(t);
    // pejzaż dźwiękowy (B3): tylko przy włączonym dźwięku, co 0,1 s (wyłączony — zero pracy w klatce)
    if (pj.wl) { var tn = performance.now(); if (tn - pj.tProby >= 100) { pj.tProby = tn; probkujPejzaz(); } }
    // animacja haka (G-F: wołana co klatkę po animuj; w smoke czas ruchu stały — kadr powtarzalny)
    if (mks.anim && mk.anim) {
      var wyn = mk.anim[FUNKCJE_ANIM[mks.anim.nazwa]](mks.anim.f, smoke ? 12 : undefined);
      pokazCzas(wyn && wyn.Ma != null ? wyn.Ma : sc.czas(), KADRY_ANIM[mks.anim.nazwa].rekonstrukcja);
    }
    // zmiana pozy kamery przy nieruchomym kursorze też unieważnia wskazanie (obiekt pod kursorem się przesunął)
    var kp = sc.kamera.position, ct = mk.ster ? mk.ster.target : null;
    var poza = kp.x + ',' + kp.y + ',' + kp.z + (ct ? ',' + ct.x + ',' + ct.y + ',' + ct.z : '');
    if (poza !== mk.poza) { mk.poza = poza; if (wskaznik) wskaznik.nowy = true; odswiezKompas(); }
    // wskazywanie tylko po ruchu kursora lub kamery (najwyżej raz na klatkę), nie w każdej klatce
    if (wskaznik && wskaznik.nowy && !nacisk) {
      wskaznik.nowy = false;
      var tu = trafienieTur(wskaznik.x, wskaznik.y), wu = tu && tu.typ === 'punkt' ? null : trafienieWulk(wskaznik.x, wskaznik.y);
      var id = tu || wu ? null : trafienie(wskaznik.x, wskaznik.y);
      if (id !== mks.hover) { mks.hover = id; sc.najedz(id); }
      if (mk.wulk) mk.wulk.najedz(wu ? wu.id : null);
      ui.canvas.style.cursor = id || tu || wu ? 'pointer' : (mks.przekroj && trafiaSciane(wskaznik.x, wskaznik.y) ? 'ns-resize' : '');
    }
  }
  function ograniczonyRuch() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* ---------- przełączniki ---------- */
  function ustawKolorowanie(tryb) {
    mks.kolorowanie = tryb === 'geologia' ? 'geologia' : 'teren';
    if (mk) mk.sc.kolorowanie(mks.kolorowanie);
    odswiezNarzedzia();
  }
  // Task B1: materiał makiety. W trakcie animacji (hak &anim, sonda) woda zostaje wodą ujęcia — materiał zmienia tylko
  // ląd; wodę materiału kładzie z powrotem następna budowa makiety (zbudujMakiete: material przed animacją).
  function ustawMaterial(m) {
    mks.material = m === 'sklejka' ? 'sklejka' : 'zwykly';
    if (mk) {
      mk.sc.material(mks.material);
      if (mks.anim) mk.sc.woda(KADRY_ANIM[mks.anim.nazwa].woda, 1);
    }
    odswiezNarzedzia(); adres();
    return mks.material;
  }
  // Task A2: smugi pasatu — przycisk „Wiatr”; w trakcie animacji A1–A5 zostają schowane (kadr ujęcia filmu)
  function ustawWiatr(wl) {
    mks.wiatr = wl !== false;
    if (mk) mk.sc.wiatr(mks.wiatr && !mks.anim);
    odswiezNarzedzia(); adres();
    return mks.wiatr;
  }
  /* ---------- czas geologiczny ---------- */
  function tekstCzasu(Ma) {
    if (!(Ma > 0)) return 'dziś';
    if (Ma >= 1) return liczba(Ma, 1) + ' mln lat temu';
    if (Ma >= 0.001) return liczba(Math.round(Ma * 1000)) + ' tys. lat temu';
    return liczba(Math.round(Ma * 1e6)) + ' lat temu';
  }
  function pokazCzas(Ma, rekonstrukcja) {
    if (!ui) return;
    var t = tekstCzasu(Ma);
    if (ui.czasWart.textContent !== t) ui.czasWart.textContent = t;
    var r = !!(Ma > 0 || rekonstrukcja);
    if (ui.czasPlak.hidden === r) ui.czasPlak.hidden = !r;
  }
  function ustawCzas(Ma, zSuwaka) {
    mks.czas = Math.max(0, Math.min(M0_CZASU, +Ma || 0));
    if (mk) mk.sc.czas(mks.czas);
    if (!zSuwaka && ui) ui.czasSuwak.value = String(Math.round(window.Animacje.osV(mks.czas, M0_CZASU) * 1000));
    pokazCzas(mks.czas, false);
    if (ui) ui.czasSuwak.setAttribute('aria-valuetext', tekstCzasu(mks.czas));
    widocznoscTurystyki();
  }
  // Kreski zdarzeń pod suwakiem: wiek z osCzasu (erupcje historyczne — jedna kreska tuż przed „dziś”); etykiety tylko,
  // gdy się mieszczą (najstarsze najpierw); klik w kreskę = skok do zdarzenia.
  function zbudujOsCzasu() {
    var D = window.GeologiaTeneryfa, os = ui.czasOs;
    os.replaceChildren();
    var rok = new Date().getUTCFullYear(), zd = [], hist = null;
    ((D && D.osCzasu) || []).forEach(function (o) {
      var Ma = o.Ma != null ? o.Ma : o.rok != null ? (rok - o.rok) / 1e6 : null;
      if (Ma == null || Ma > M0_CZASU) return;
      if (o.Ma == null) { if (!hist || Ma > hist.Ma) hist = { Ma: Ma, nazwa: 'Erupcje historyczne (od ' + o.rok + ')', krotko: 'erupcje' }; return; }
      zd.push({ Ma: Ma, nazwa: o.nazwa, krotko: o.nazwa });
    });
    if (hist) zd.push(hist);
    var ostatnia = -1;
    zd.sort(function (a, b) { return b.Ma - a.Ma; }).forEach(function (z) {
      var v = window.Animacje.osV(z.Ma, M0_CZASU), b = el('button', 'ge-czas-kreska', null, os);
      b.type = 'button'; b.style.left = (v * 100).toFixed(2) + '%';
      b.title = z.nazwa + ' — ' + tekstCzasu(z.Ma);
      b.setAttribute('aria-label', b.title);
      if (v - ostatnia >= 0.17) { el('span', 'ge-czas-etykieta', z.krotko, b); ostatnia = v; }
      b.addEventListener('click', function () { ustawCzas(z.Ma); });
    });
  }
  function uruchomAnimacje(nazwa, f) {
    if (!mk || !FUNKCJE_ANIM[nazwa] || !window.GeologiaAnimacje) return false;
    if (!mk.anim) mk.anim = window.GeologiaAnimacje.utworz(T, mk.sc, window.GeologiaTeneryfa || {});
    mks.anim = { nazwa: nazwa, f: Math.max(0, Math.min(1, +f || 0)) };
    var K = KADRY_ANIM[nazwa], sc = mk.sc, e = sc.przewyzszenie(), D = window.GeologiaTeneryfa || {};
    var c = (D.czesci || []).filter(function (x) { return x.id === K.cel; })[0], p = c ? Teren.doLokalnych(null, c.lonLat[0], c.lonLat[1]) : [0, 0];
    sc.swiatlo(K.swiatlo); sc.woda(K.woda, 1); sc.kolorowanie('krajobraz');      // ujęcia filmu: barwy modelu krajobrazu (R4)
    sc.cienieHor(false);                // światło ujęcia filmu — bez cieni z mapy horyzontu (Task A3, Review Focus 1)
    sc.wiatr(false);                    // i bez smug pasatu (Task A2, Review Focus 1)
    sc.kamera.fov = K.fov; sc.kamera.updateProjectionMatrix();
    var czesci = sc.scena.getObjectByName('czesci'); if (czesci) czesci.visible = false;
    // kadr ujęcia może patrzeć w górę (A5: niebo nad Teide z podnóża) — limit makiety „nie spod poziomu celu” nie obowiązuje
    if (mk.ster) mk.ster.maxPolarAngle = Math.PI * 0.9;
    if (K.czolo) {
      var w = mk.anim[FUNKCJE_ANIM[nazwa]](mks.anim.f, smoke ? 12 : undefined), cz = w.czoloXZ, k = w.kier, yc = sc.wysokosc(cz[0], cz[1]) || 0;
      ustawKadr([cz[0] - k[0] * K.za, yc + K.nad * e, cz[1] - k[1] * K.za], [cz[0], yc, cz[1]]);
    } else ustawKadr([p[0] + Math.sin(K.az * RAD) * K.d, K.h * e, p[1] - Math.cos(K.az * RAD) * K.d], [p[0], K.yc * e, p[1]]);
    mk.kadrAuto = null;
    return true;
  }
  /* ---------- pora dnia i pogoda (Task 8e) ---------- */
  function ustawPogode(p) {
    mks.pogoda = (window.GeologiaSlonce ? window.GeologiaSlonce.POGODY : ['pogodnie', 'chmury', 'kalima']).indexOf(p) >= 0 ? p : 'pogodnie';
    zastosujNiebo(); odswiezNarzedzia(); adres();
  }
  function ustawPore(v, bezAdresu) {
    mks.pora = v === 'teraz' ? 'teraz' : v == null || !isFinite(v) ? null : Math.max(0, Math.min(1439, Math.round(+v)));   // 00:00–23:59 jak adres
    pilnujZegaraPory();
    zastosujNiebo(); odswiezNarzedzia();
    if (!bezAdresu) adres();
  }
  // „Teraz”: zegar co 60 s tylko w makiecie z porą 'teraz' (render i tak idzie co klatkę — tu tylko nowa pozycja Słońca)
  function pilnujZegaraPory() {
    var trzeba = aktywny && st.tryb === 'makieta' && mks.pora === 'teraz';
    if (trzeba && !zegarPory) zegarPory = setInterval(zastosujNiebo, 60000);
    else if (!trzeba && zegarPory) { clearInterval(zegarPory); zegarPory = 0; }
  }
  function lonLatSlonca() {
    var D = window.GeologiaTeneryfa, t = D && (D.czesci || []).filter(function (c) { return c.id === 'teide'; })[0];
    return t ? t.lonLat : null;
  }
  // Pora z adresu ('teraz' | 'HH:MM') → stan (null | 'teraz' | minuta dnia)
  function poraZAdresu(v) {
    if (v === 'teraz') return 'teraz';
    var m = typeof v === 'string' ? /^(\d{2}):(\d{2})$/.exec(v) : null;
    return m ? +m[1] * 60 + +m[2] : null;
  }
  function adresPory() {
    var GS = window.GeologiaSlonce, a = '';
    if (mks.pora === 'teraz') a += '&pora=teraz';
    else if (mks.pora != null && GS) a += '&pora=' + GS.godzinaTekst(mks.pora);   // mks.pora ≤ 1439: adres = etykieta
    if (mks.pogoda !== 'pogodnie') a += '&pogoda=' + mks.pogoda;
    return a;
  }
  // Słońce i pogoda → światło sceny makiety (bez sceny: tylko stan i etykieta). Animacja haka ma własne światło ujęcia.
  // Dzień odniesienia pory (suwak, adres, „Cień Teide”): dziś; w smoke hak `&data=RRRR-MM-DD` (południe UTC tego dnia) —
  // stany smoke z porą nie zależą od dnia uruchomienia (Task A3, R13). „Teraz” zawsze z zegara.
  function dzienPory() { return smoke && zap.data != null ? zap.data : Date.now(); }
  function zastosujNiebo() {
    var GS = window.GeologiaSlonce, teraz = dzienPory(), a = null;
    mks.chmury = mks.pogoda === 'chmury';
    mks.slonce = null;
    if (GS && mks.pora != null) {
      var ll = lonLatSlonca();
      if (!ll) console.error('Geologia: brak Teide w GeologiaTeneryfa.czesci — pora dnia bez pozycji Słońca, światło stałe');
      else {
        var ms = mks.pora === 'teraz' ? Date.now() : GS.msGodzinyWyspy(teraz, mks.pora), s = GS.slonce(ms, ll[1], ll[0]);
        var min = mks.pora === 'teraz' ? GS.czasWyspy(ms).min : mks.pora;
        mks.slonce = { az: s.az, el: s.el, pora: GS.poraZeSlonca(s.el), min: min, ms: ms };
        a = { pora: mks.slonce.pora, az: s.az, el: s.el };
      }
    }
    if (!a) a = GS ? { pora: GS.STALE.pora, az: GS.STALE.az, el: GS.STALE.el } : { pora: 'dzien', az: 250, el: 30 };
    a.pogoda = mks.pogoda;
    var arg = GS ? GS.parametrySwiatla(a, S.PORY) : a;
    if (mk) {
      if (!mks.anim) mk.sc.swiatlo(arg);
      mk.sc.chmury(mks.chmury);
    }
    pokazPore();
  }
  // Task A3 (R13): chwile najdłuższego WIDOCZNEGO cienia Teide dziś (dzień wyspy) — Słońce 2° nad horyzontem rano po
  // wschodzie i wieczorem przed zachodem (GeologiaHoryzont.chwileCienia); minuty dnia wyspy; pamięć na dzień.
  var cienDnia = null;
  function cienTeideDzis() {
    var GS = window.GeologiaSlonce, HZ = window.GeologiaHoryzont, teraz = dzienPory();
    if (!GS || !HZ) return null;
    var cz = GS.czasWyspy(teraz), klucz = cz.rok + '-' + cz.mies + '-' + cz.dzien;
    if (!cienDnia || cienDnia.klucz !== klucz) {
      var c = HZ.chwileCienia(teraz, lonLatSlonca());
      // minuta dnia wyspy zaokrąglona do najbliższej (czasWyspy obcina sekundy; dzień zmiany czasu — z przesunięcia chwili)
      var min = function (ms) { return isFinite(ms) ? Math.min(1439, GS.czasWyspy(ms + 30000).min) : null; };
      cienDnia = { klucz: klucz, rano: min(c.rano), wieczor: min(c.wieczor) };
    }
    return cienDnia.rano == null || cienDnia.wieczor == null ? null
      : { rano: cienDnia.rano, wieczor: cienDnia.wieczor, poPoludniu: cz.min >= 720 };
  }
  function pokazPore() {
    if (!ui) return;
    var GS = window.GeologiaSlonce, t, ct = cienTeideDzis();
    if (ui.bCienTeide.hidden === !!ct) ui.bCienTeide.hidden = !ct;      // bez efemeryd albo Teide w danych — bez przycisku
    if (ct) {
      var tc = 'Dziś najdłuższy cień: rano ' + GS.godzinaTekst(ct.rano) + ', wieczorem ' + GS.godzinaTekst(ct.wieczor) + ' (Słońce 2° nad horyzontem)';
      if (ui.bCienTeide.title !== tc) ui.bCienTeide.title = tc;
    }
    if (mks.slonce && GS) {
      t = GS.etykietaPory(mks.slonce.min, mks.slonce.el);
      if (+ui.poraSuwak.value !== mks.slonce.min) ui.poraSuwak.value = String(mks.slonce.min);   // „Teraz”: suwak idzie za zegarem
    } else {
      t = 'światło stałe';
      if (GS && ui.poraSuwak.dataset.ustawiony !== '1') { ui.poraSuwak.value = String(GS.czasWyspy(Date.now()).min); }
    }
    ui.poraSuwak.dataset.ustawiony = '1';
    if (ui.poraTekst.textContent !== t) ui.poraTekst.textContent = t;
    ui.poraSuwak.setAttribute('aria-valuetext', t);
  }
  function ustawPrzewyzszenie(x) { mks.przewCel = x; if (smoke || !mk) { mks.przew = x; if (mk) mk.sc.przewyzszenie(x); } odswiezNarzedzia(); }
  function ustawPrzekroj(p, kadruj) {
    if (!p) {
      mks.przekroj = null;
      if (mk) { mk.sc.przekroj(null); if (kadruj) { var k0 = kadrStartowy(); ustawKadr(k0.poz, k0.cel, true); mk.kadrAuto = 'start'; } }
      ui.kPrzekroj.hidden = true;
      przesunKadr();
      odswiezNarzedzia();
      return;
    }
    mks.widok = null;
    var kat = ((Math.round(+p.kat_st) || 0) % 180 + 180) % 180;
    ui.katSuwak.value = String(kat); ui.katTekst.textContent = kat + '°';
    mks.przekroj = { kat_st: kat, przesuniecie_km: +p.przesuniecie_km || 0, profil: null };
    if (mk) {
      var profil = mk.sc.przekroj({ kat_st: kat, przesuniecie_km: mks.przekroj.przesuniecie_km });
      if (!profil) { mks.przekroj.przesuniecie_km = 0; profil = mk.sc.przekroj({ kat_st: kat, przesuniecie_km: 0 }); }
      mks.przekroj.profil = profil;
      odswiezKartePrzekroju(profil);
      przesunKadr();
      if (kadruj && profil) { var kp = kadrPrzekroju(profil); ustawKadr(kp.poz, kp.cel, true); mk.kadrAuto = 'przekroj'; }
    }
    odswiezNarzedzia();
  }
  /* ---------- kompas, widoki, warstwa turystyczna (Task 7b) ---------- */
  var SVG = 'http://www.w3.org/2000/svg', kierKompasu = null;
  function svgEl(tag, at, rodzic) {
    var e = doc.createElementNS(SVG, tag);
    Object.keys(at).forEach(function (k) { e.setAttribute(k, at[k]); });
    if (rodzic) rodzic.appendChild(e);
    return e;
  }
  // Róża: tarcza, kreski co 45°, igła (N czerwona) i litera N — obracane razem (grupa zwracana do obrotu).
  function zbudujRoze(rodzic) {
    var s = svgEl('svg', { viewBox: '-50 -50 100 100', 'aria-hidden': 'true', focusable: 'false' }, rodzic);
    svgEl('circle', { r: '47', fill: 'rgba(8,11,15,0.84)', stroke: 'rgba(160,190,215,0.5)', 'stroke-width': '2' }, s);
    var g = svgEl('g', {}, s);
    for (var i = 1; i < 8; i++) {
      var a = i * 45 * RAD, r0 = i % 2 ? 39 : 35;
      svgEl('line', { x1: (Math.sin(a) * r0).toFixed(2), y1: (-Math.cos(a) * r0).toFixed(2), x2: (Math.sin(a) * 44).toFixed(2), y2: (-Math.cos(a) * 44).toFixed(2),
        stroke: '#9aa7b4', 'stroke-width': i % 2 ? '1.5' : '2.5' }, g);
    }
    svgEl('polygon', { points: '0,-24 7,2 -7,2', fill: '#ff5a4f' }, g);
    svgEl('polygon', { points: '0,28 7,2 -7,2', fill: '#c9d2da' }, g);
    svgEl('circle', { r: '3', fill: '#0b0e12' }, g);
    var t = svgEl('text', { x: '0', y: '-33', 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#ff5a4f',
      'font-size': '17', 'font-weight': '800', 'font-family': 'system-ui, sans-serif' }, g);
    t.textContent = 'N';
    return g;
  }
  function odswiezKompas() {
    if (!mk || !ui || !TS) return;
    var k = mk.sc.kamera, p = k.position;
    kierKompasu = kierKompasu || new T.Vector3();
    k.getWorldDirection(kierKompasu);
    var az = TS.Kompas.azymutKamery([p.x, p.y, p.z], [p.x + kierKompasu.x, p.y + kierKompasu.y, p.z + kierKompasu.z]);
    if (mks.azymut !== null && Math.abs(((az - mks.azymut) % 360 + 540) % 360 - 180) < 0.2) return;
    mks.azymut = az;
    ui.rozaObrot.setAttribute('transform', 'rotate(' + (-az).toFixed(1) + ')');
    var strony = ['północ', 'północny wschód', 'wschód', 'południowy wschód', 'południe', 'południowy zachód', 'zachód', 'północny zachód'];
    ui.roza.setAttribute('aria-label', 'Kompas: kamera patrzy na ' + strony[Math.round(az / 45) % 8] + '. Kliknij: północ u góry');
  }
  // Widok z przycisku: kierunek i najmniejsza odległość z Kompas.pozaWidoku, odległość dopasowana do proporcji ekranu
  // (narożniki lądu i szczyt Teide w kadrze, margines na pasek i nakładki u dołu).
  function kadrWidoku(nazwa) {
    var sc = mk.sc, ld = sc.lad, w = TS.Kompas.pozaWidoku(nazwa, ld), e = sc.przewyzszenie(), s = sc.srodekPrzekroju;
    var pkt = [[ld.x0, 0, ld.z0], [ld.x1, 0, ld.z0], [ld.x0, 0, ld.z1], [ld.x1, 0, ld.z1], [s[0], 3.7 * e, s[1]]];
    var d = Math.max(w.d, dopasujOdleglosc(w.cel, w.kier, pkt, 0.9, 0.74, 0.72));
    return { poz: [w.cel[0] + w.kier[0] * d, w.kier[1] * d, w.cel[2] + w.kier[2] * d], cel: w.cel };
  }
  function ustawWidok(nazwa, plynnie) {
    if (!mk || !TS || TS.Kompas.WIDOKI.indexOf(nazwa) < 0) return false;
    var kd = kadrWidoku(nazwa);
    ustawKadr(kd.poz, kd.cel, plynnie);
    mk.kadrAuto = 'widok'; mks.widok = nazwa;
    return true;
  }
  function turystykaWidoczna() {
    return !!(mk && mk.tur && mks.turystyka && st.tryb === 'makieta' && !(mks.czas > 0) && !mks.przekroj && !mks.anim);
  }
  // Plan dni idzie za FAKTYCZNĄ widocznością warstwy (przekrój, czas ≠ dziś, animacja ją chowają): plan bez tras na mapie
  // nie miałby dokąd przelecieć. Przekroju nie wyłączamy za użytkownika — to on go włączył.
  function widocznoscTurystyki() {
    var w = turystykaWidoczna(), ww = widocznoscWulkanow();
    if (ui && ui.plan.hidden === w) {
      ui.plan.hidden = !w;
      ui.makieta.classList.toggle('ge-tryb-tur', w);
      przesunKadr();
    }
    if (!mk) return;
    if (mk.tur) mk.tur.widoczna(w);
    mk.sc.przygasCzesci((mks.turystyka && w) || ww ? 0.4 : 1);
  }
  function planRozwiniety() { return !!(ui && !ui.plan.hidden && ui.plan.dataset.zwiniety === 'false'); }
  // Pasek na wąskim ekranie: zwinięty = jeden wiersz (nazwa zakładki + przycisk) i wiersz ostrzeżenia; domyślnie zwinięty,
  // gdy warstwa Turystyka jest włączona. Na szerokim ekranie klasa nic nie zmienia (reguły tylko w @media ≤ 700 px).
  function zwinPasek(zw) {
    var p = $('gePasek');
    if (!p || !ui) return;
    p.classList.toggle('ge-pasek-zwiniety', !!zw);
    ui.bPasek.setAttribute('aria-expanded', String(!zw));
    ui.bPasek.textContent = zw ? 'Menu ▾' : 'Zwiń ▴';
    ukladKart();
  }
  // Warstwa liczona z dzisiejszej rzeźby (prościej niż iść za suwakiem: linie i piny bez przeliczania w każdej chwili) —
  // włączenie przy czasie ≠ dziś cofa czas do „dziś”. Budowana raz na makietę; przełączanie = widoczność (liczniki GPU stałe).
  function ustawTurystyke(wl) {
    mks.turystyka = !!wl;
    if (mks.turystyka && st.tryb === 'makieta' && mk) {
      if (mks.czas > 0) { ustawCzas(0); komunikat('Warstwa turystyczna pokazuje dzisiejszą wyspę — czas geologiczny wrócił do „dziś”.'); }
      if (!mk.tur && TS && window.GeologiaTurystyka) mk.tur = TS.utworzWarstwe(T, mk.sc, window.GeologiaTurystyka);
      else if (!window.GeologiaTurystyka) console.error('Geologia: brak danych GeologiaTurystyka — warstwa turystyczna niedostępna');
    }
    if (!mks.turystyka) zamknijTur(true);
    if (ui && waskiEkran()) zwinPasek((mks.turystyka || mks.wulkany) && st.tryb === 'makieta');
    if (ui) odswiezNarzedzia();
    adres();
    return mks.turystyka;
  }
  function dataPl(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? +m[3] + '.' + m[2] + '.' + m[1] : iso; }
  // Pasek ostrzeżenia (w pasku, osobny wiersz: pełny tekst; na wąskim ekranie dwa wiersze + „Całość”) i lista „Plan dni” — raz.
  function zbudujTurystykeUI() {
    var D = window.GeologiaTurystyka;
    if (!D || ui.ostrzezenie) return;
    var o = D.ostrzezenie;
    ui.ostrzezenie = el('div', 'ge-ostrzezenie', null, $('gePasek'));
    ui.ostrzezenie.setAttribute('role', 'note'); ui.ostrzezenie.hidden = true;
    var p = el('p', 'ge-ostrzezenie-tekst', null, ui.ostrzezenie);
    el('strong', null, '⚠ Stan na ' + dataPl(o.stan_na) + ': ', p);
    el('span', null, o.tekst + ' ', p);
    var a = el('a', 'ge-ostrzezenie-link', 'Komunikat Cabildo (tenerifeon.es)', p), href = TS.linkBezpieczny(o.link);
    if (href) { a.href = href; a.target = '_blank'; a.rel = 'noopener'; }
    else console.error('Geologia: link ostrzeżenia bez https:// — pominięty (' + String(o.link).slice(0, 40) + ')');
    ui.ostrzezenieWiecej = guzik(ui.ostrzezenie, 'Całość', 'Pokaż całe ostrzeżenie', 'ge-ostrzezenie-wiecej');
    ui.ostrzezenieWiecej.removeAttribute('aria-pressed'); ui.ostrzezenieWiecej.setAttribute('aria-expanded', 'false');
    ui.ostrzezenieWiecej.addEventListener('click', function () {
      var r = !ui.ostrzezenie.classList.contains('ge-rozwiniete');
      ui.ostrzezenie.classList.toggle('ge-rozwiniete', r);
      ui.ostrzezenieWiecej.textContent = r ? 'Zwiń' : 'Całość'; ui.ostrzezenieWiecej.setAttribute('aria-expanded', String(r));
      ukladKart();
    });
    var nazwaTrasy = function (id) { var t = D.trasy.filter(function (x) { return x.id === id; })[0]; return t || null; };
    var pozycja = function (etykieta, tytul, t, jak) {
      var li = el('li', null, null, ui.planLista);
      var b = el('button', 'ge-plan-dzien', null, li); b.type = 'button';
      el('span', 'ge-plan-data', etykieta, b);
      var tx = el('span', 'ge-plan-tekst', null, b);
      el('span', 'ge-plan-tyt', tytul, tx);
      if (t) {
        var tr = el('span', 'ge-plan-trasa', null, tx);
        var k = el('span', 'ge-plan-kreska', null, tr); k.style.background = TS.kolorTransportu(t.transport);
        if (t.przyblizona) k.dataset.przerywana = 'true';
        el('span', null, t.nazwa + ' · ' + TS.NAZWY_TRANSPORTU[t.transport], tr);
        b.dataset.trasa = t.id;
        b.title = 'Pokaż trasę: ' + t.nazwa;
        b.addEventListener('click', function () { przelotDoTrasy(t.id); if (waskiEkran()) rozwinPlan(false); });
      } else { b.disabled = true; if (jak) el('span', 'ge-plan-trasa', jak, tx); }
    };
    D.kalendarz.forEach(function (d) { pozycja(d.etykieta, d.tytul, d.trasa ? nazwaTrasy(d.trasa) : null, d.jak); });
    D.trasy.filter(function (t) { return !t.dzien; }).forEach(function (t) { pozycja('do ustal.', 'Z przyjaciółmi', t); });
    rozwinPlan(!waskiEkran());
  }
  function waskiEkran() { return (korzen.clientWidth || window.innerWidth) <= 700; }
  function rozwinPlan(wl) {
    ui.plan.dataset.zwiniety = String(!wl);
    ui.planNaglowek.setAttribute('aria-expanded', String(!!wl));
    ui.planStrzalka.textContent = wl ? '▾' : '▴';
    przesunKadr();
  }
  function przelotDoTrasy(id) {
    if (!mk || !mk.tur || !turystykaWidoczna()) return false;
    var b = mk.tur.zasiegTrasy(id);
    if (!b) return false;
    pokazTur('trasa', id);                       // najpierw karta: przesunięcie kadru (setViewOffset) wchodzi w dopasowanie
    // cel sterowania leży na poziomie morza (G-K) — przesunięty na północ tak, by promień przez środek trasy na jej
    // wysokości trafiał w cel: trasa w kalderze (2,2 km × przewyższenie) wypada w środku kadru, nie u jego góry
    var kat = 50 * RAD, u = [0, Math.sin(kat), Math.cos(kat)], yS = (b.yMin + b.yMax) / 2;
    var cel = [(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2 - yS / Math.tan(kat)];
    var pkt = [[b.x0, b.yMin, b.z0], [b.x1, b.yMin, b.z0], [b.x0, b.yMin, b.z1], [b.x1, b.yMin, b.z1], [b.x0, b.yMax, b.z0], [b.x1, b.yMax, b.z1]];
    var d = Math.max(5, dopasujOdleglosc(cel, u, pkt, 0.7, 0.6, 0.55));
    ustawKadr([cel[0] + u[0] * d, u[1] * d, cel[2] + u[2] * d], cel, true);
    mk.kadrAuto = null; mks.widok = null;
    return true;
  }
  function pokazTur(typ, id) {
    var D = window.GeologiaTurystyka;
    if (!D || !ui) return;
    var t = ui.kTurT, x, nazwa = null;
    zatrzymajLektorMakiety();
    if (typ === 'trasa') {
      x = D.trasy.filter(function (q) { return q.id === id; })[0];
      if (!x) return;
      zamknijCzesc(); zamknijMity(true); zamknijWulkan();
      t.replaceChildren();
      var kal = D.kalendarz.filter(function (d) { return d.trasa === id; })[0];
      el('p', 'ge-karta-rodzaj', 'Trasa · ' + (x.dzien || 'dzień do ustalenia'), t);
      el('h3', 'ge-karta-nazwa', x.nazwa, t);
      var f = [];
      if (x.numer) f.push('szlak ' + x.numer);
      if (x.dlugosc_km != null) f.push(liczba(x.dlugosc_km, 1) + ' km');
      if (x.podejscie_m != null) f.push('podejścia ' + liczba(x.podejscie_m) + ' m');
      el('p', 'ge-karta-wys', f.join(' · '), t);
      var tl = el('p', 'ge-tur-transport', null, t);
      var kr = el('span', 'ge-plan-kreska', null, tl); kr.style.background = TS.kolorTransportu(x.transport);
      if (x.przyblizona) kr.dataset.przerywana = 'true';
      el('span', null, 'dojazd: ' + TS.NAZWY_TRANSPORTU[x.transport] + (kal ? ' — ' + kal.jak : ''), tl);
      if (x.przyblizona) el('p', 'ge-tur-uwaga', 'Linia przerywana: przebieg przybliżony (prosta między bazą a celem), nie ślad szlaku.', t);
      if (x.odcinekDodatkowy) {
        var od = D.punkty.filter(function (q) { return q.id === x.odcinekDodatkowy.od; })[0];
        el('p', 'ge-tur-uwaga', 'Linia przerywana za punktem ' + (od ? od.nazwa : x.odcinekDodatkowy.od) + ': ' + x.odcinekDodatkowy.opis + '.', t);
      }
      if (x.odnogi) el('p', 'ge-tur-uwaga', 'Odcinek „tam i z powrotem” — nitki rozsunięte na mapie, żeby było widać obie.', t);
      el('p', 'ge-akapit', x.karta, t);
      if (x.uwagi) el('p', 'ge-akapit ge-tur-uwagi', x.uwagi, t);
      zrodlo(t, 'linia: ' + x.liniaZrodlo + (/^OSM /.test(x.liniaZrodlo) ? ' — © współtwórcy OpenStreetMap (ODbL)' : '') + '; opis: ' + D.zrodlo);
    } else {
      x = D.punkty.filter(function (q) { return q.id === id; })[0];
      if (!x) return;
      zamknijCzesc(); zamknijMity(true); zamknijWulkan();
      t.replaceChildren();
      el('p', 'ge-karta-rodzaj', 'Punkt · ' + (RODZAJE_PUNKTOW[x.rodzaj] || x.rodzaj), t);
      nazwa = el('h3', 'ge-karta-nazwa', x.nazwa, t);
      if (x.rodzaj === 'baza' && D.baza) el('p', 'ge-karta-wys', D.baza.adres, t);
      el('p', 'ge-akapit', x.opis, t);
      var tr = D.trasy.filter(function (q) { return q.startId === id || q.celId === id; });
      if (tr.length) {
        var ul = el('ul', 'ge-tur-lista', null, t);
        tr.forEach(function (q) {
          var b = el('button', 'ge-tur-link', (q.dzien ? q.dzien + ' · ' : '') + q.nazwa, el('li', null, null, ul));
          b.type = 'button'; b.addEventListener('click', function () { przelotDoTrasy(q.id); });
        });
      }
      if (x.rodzaj === 'hotel' || x.rodzaj === 'baza' || x.rodzaj === 'przystanek') {
        el('h4', 'ge-h3', 'Autobusy', t);
        var ua = el('ul', 'ge-tur-lista', null, t);
        D.autobusy.forEach(function (a) { var li = el('li', null, null, ua); el('b', null, a.linia + ': ', li); el('span', null, a.opis, li); });
      }
      zrodlo(t, x.zrodlo);
    }
    mks.tur = { typ: typ, id: id };
    if (waskiEkran() && ui.plan.dataset.zwiniety !== 'true') rozwinPlan(false);   // jedna dolna szuflada naraz
    if (waskiEkran() && legendaWulkanowRozwinieta()) rozwinLegendeWulkanow(false);
    ui.kTur.dataset.typ = typ; ui.kTur.dataset.id = id;
    ui.kTur.hidden = false; ui.kTur.scrollTop = 0;
    // punkt turystyki mówi nagraniem części wyspy, na której leży (pole `czesc`); trasa — bez lektora
    if (typ === 'punkt') lektorKarty(ui.kTur, 'turystyka', x, nazwa); else lektorKarty(ui.kTur, null);
    if (mk && mk.tur) mk.tur.wybierz(typ, id);
    przesunKadr();
  }
  function zamknijTur() {
    mks.tur = null;
    if (!ui) return;
    zdejmijLektorKarty(ui.kTur);
    ui.kTur.hidden = true; delete ui.kTur.dataset.typ; delete ui.kTur.dataset.id;
    if (mk && mk.tur) mk.tur.wybierz(null, null);
    przesunKadr();
  }

  /* ---------- warstwa „Wulkany” (Task 8c) ---------- */
  var GRUPA_KARTY = { strato: 'stratowulkan', historyczne: 'stożek erupcji historycznej', pozostale: 'pozostały stożek' };
  function aktywneWarstwy() {
    return L.WARSTWY.filter(function (w) { return w === 'turystyka' ? mks.turystyka : w === 'wulkany' ? mks.wulkany : false; }).join(',');
  }
  function wulkanyWidoczna() {
    return !!(mk && mk.wulk && mks.wulkany && st.tryb === 'makieta' && !(mks.czas > 0) && !mks.przekroj && !mks.anim);
  }
  // Legenda idzie za faktyczną widocznością warstwy (jak plan dni Turystyki); zwraca widoczność.
  function widocznoscWulkanow() {
    var w = wulkanyWidoczna();
    if (ui && ui.legWulk.hidden === w) {
      ui.legWulk.hidden = !w;
      ui.makieta.classList.toggle('ge-tryb-wulk', w);
      przesunKadr();
    }
    if (mk && mk.wulk) mk.wulk.widoczna(w);
    if (!w && ui && !ui.kWulk.hidden) zamknijWulkan();
    return w;
  }
  function legendaWulkanowRozwinieta() { return !!(ui && !ui.legWulk.hidden && ui.legWulk.dataset.zwiniety === 'false'); }
  function rozwinLegendeWulkanow(wl) {
    ui.legWulk.dataset.zwiniety = String(!wl);
    ui.legWulkNaglowek.setAttribute('aria-expanded', String(!!wl));
    ui.legWulkStrzalka.textContent = wl ? '▾' : '▴';
    przesunKadr();
  }
  // Warstwa liczona z dzisiejszej rzeźby (jak Turystyka): włączenie przy czasie ≠ dziś cofa czas do „dziś”. Budowana raz
  // na makietę; przełączanie = widoczność (liczniki GPU stałe).
  function ustawWulkany(wl) {
    mks.wulkany = !!wl;
    var GW = window.GeologiaWulkany;
    if (mks.wulkany && st.tryb === 'makieta' && mk) {
      if (mks.czas > 0) { ustawCzas(0); komunikat('Warstwa wulkanów pokazuje dzisiejszą wyspę — czas geologiczny wrócił do „dziś”.'); }
      if (!mk.wulk && WS && GW) {
        mk.grupyWulk = GW.grupuj(GW.wulkany);
        var g = mk.grupyWulk, refTur = null;
        mk.wulk = WS.utworzWarstwe(T, mk.sc, g.strato.concat(g.historyczne, g.pozostale), { kolory: GW.KOLORY_GRUP,
          // etykiety wulkanów omijają piny i etykiety Turystyki (tablica prostokątów warstwy turystycznej z jej animuj)
          zajeteInne: function () { if (!mk || !mk.tur || !mk.tur.widoczna()) return null; if (!refTur) refTur = mk.tur.animuj(); return refTur; } });
      } else if (!GW) console.error('Geologia: brak danych GeologiaWulkany — warstwa wulkanów niedostępna');
    }
    if (!mks.wulkany) zamknijWulkan();
    // telefon: pasek zwinięty, gdy włączona jest któraś warstwa (jak w 7b)
    if (ui && waskiEkran()) zwinPasek((mks.turystyka || mks.wulkany) && st.tryb === 'makieta');
    if (ui) odswiezNarzedzia();
    adres();
    return mks.wulkany;
  }
  // Legenda: liczniki grup (barwy pinów), „N na mapie (OSM)” obok liczby z literatury ze źródłem, atrybucja OSM — raz.
  function zbudujLegendeWulkanow() {
    var GW = window.GeologiaWulkany;
    if (!GW || ui.legWulkZbudowana) return;
    ui.legWulkZbudowana = true;
    var g = GW.grupuj(GW.wulkany), l = GW.legenda(g, GW.LITERATURA), t = ui.legWulkTresc;
    ui.legWulkTytul.textContent = 'Wulkany · ' + l.naMapie + ' na mapie';
    var ul = el('ul', 'ge-legenda-lista ge-wulk-grupy', null, t);
    GW.GRUPY.forEach(function (k) {
      var li = el('li', null, null, ul); li.dataset.grupa = k;
      var z = el('span', 'ge-wulk-znak', null, li); z.style.borderBottomColor = GW.KOLORY_GRUP[k];
      var tx = GW.NAZWY_GRUP[k].charAt(0).toUpperCase() + GW.NAZWY_GRUP[k].slice(1);
      el('span', 'ge-wulk-nazwa', tx, li);
      el('b', 'ge-wulk-licznik', String(l.wGrupach[k]) + (k === 'historyczne' ? ' (' + l.erupcje + ' erupcje)' : ''), li);
    });
    var lic = el('p', 'ge-wulk-liczby', null, t);
    var a = el('span', 'ge-wulk-osm', null, lic); el('b', null, String(l.naMapie), a); el('span', null, ' na mapie (OSM)', a);
    var b = el('span', 'ge-wulk-lit', null, lic); el('span', null, 'w literaturze: ', b); el('b', null, l.literatura.tekst, b);
    var d = el('details', 'ge-wulk-zrodlo', null, t);
    el('summary', null, 'Źródło liczby', d);
    el('p', 'ge-akapit', GW.LITERATURA.tekst, d);
    znaczekPewnosci(d, l.literatura.pewnosc);
    zrodlo(d, l.literatura.zrodlo);
    el('p', 'ge-zrodlo ge-wulk-atrybucja', 'Pozycje stożków: ' + GW.ATRYBUCJA + (GW.OSM && GW.OSM.pobrano ? ', stan ' + dataPl(GW.OSM.pobrano) : '') + '.', t);
    ui.legWulk.dataset.zwiniety = 'false';
    rozwinLegendeWulkanow(!waskiEkran());
  }
  function pinWulkanu(id) {
    var g = mk && mk.grupyWulk;
    return g ? g.strato.concat(g.historyczne, g.pozostale).filter(function (p) { return p.id === id; })[0] || null : null;
  }
  function pokazWulkan(id) {
    var GW = window.GeologiaWulkany, p = pinWulkanu(id);
    if (!GW || !p || !ui) return;
    zatrzymajLektorMakiety();
    zamknijCzesc(); zamknijMity(true); zamknijTur(true);
    if (waskiEkran() && planRozwiniety()) rozwinPlan(false);                 // jedna dolna szuflada naraz
    if (waskiEkran() && legendaWulkanowRozwinieta()) rozwinLegendeWulkanow(false);
    var w = p.wpis ? GW.wpis(p.wpis) : null, t = ui.kWulkT;
    t.replaceChildren();
    el('p', 'ge-karta-rodzaj', 'Wulkan · ' + GRUPA_KARTY[p.grupa], t);
    var nazwa = el('h3', 'ge-karta-nazwa', p.nazwa || (w && w.nazwa) || 'Stożek bez nazwy', t);
    var f = [];
    f.push(p.ele != null ? liczba(p.ele) + ' m n.p.m. (OSM)' : 'wysokość: brak w OSM');
    if (p.grupa === 'historyczne') f.push('erupcja ' + p.okres);
    el('p', 'ge-karta-wys', f.join(' · '), t);
    var gr = el('p', 'ge-tur-transport', null, t);
    var zn = el('span', 'ge-wulk-znak', null, gr); zn.style.borderBottomColor = GW.KOLORY_GRUP[p.grupa];
    el('span', null, 'grupa: ' + GW.NAZWY_GRUP[p.grupa] + (w && p.nazwa && w.nazwa.indexOf(p.nazwa) < 0 ? ' — ' + w.nazwa : ''), gr);
    if (p.zZrodla) el('p', 'ge-tur-uwaga', 'Pin: ' + p.dopisek + ' (' + w.pozycja + ').', t);
    if (w) {
      znaczekPewnosci(t, w.pewnosc);
      el('p', 'ge-akapit', w.opis, t);
      zrodlo(t, w.zrodlo + (p.grupa === 'historyczne' && !p.zZrodla ? '; ośrodek ↔ stożek OSM: ' + (p.dopasowanie === 'nazwa' ? 'nazwa' : 'odległość') + ' ' + liczba(p.odleglosc_km, 2) + ' km od pozycji ze źródła (' + w.pozycja + ')' : ''));
    } else el('p', 'ge-tur-uwagi', 'Makieta nie ma dla tego stożka opisu ze źródłem.', t);
    var o = el('p', 'ge-zrodlo ge-wulk-atrybucja', null, t);
    if (p.zZrodla) o.textContent = 'Stożka nie ma w OpenStreetMap; pozostałe pozycje: ' + GW.ATRYBUCJA + '.';
    else {
      el('span', null, 'Pozycja i nazwa: ' + GW.ATRYBUCJA + ' — ', o);
      var m = /^(node|way|relation)\/(\d+)$/.exec(p.id);
      var a = el('a', null, 'obiekt ' + p.id, o);
      if (m) { a.href = 'https://www.openstreetmap.org/' + m[1] + '/' + m[2]; a.target = '_blank'; a.rel = 'noopener'; }
      if (p.typ || p.status) el('span', null, ' (' + [p.typ, p.status].filter(Boolean).join(', ') + ')', o);
    }
    mks.wulk = { id: id, grupa: p.grupa };
    ui.kWulk.dataset.id = id; ui.kWulk.dataset.grupa = p.grupa;
    ui.kWulk.hidden = false; ui.kWulk.scrollTop = 0;
    lektorKarty(ui.kWulk, 'wulkan', p, nazwa);
    if (mk && mk.wulk) mk.wulk.wybierz(id);
    przesunKadr();
  }
  function zamknijWulkan() {
    if (ui) zdejmijLektorKarty(ui.kWulk);
    mks.wulk = null;
    if (!ui || ui.kWulk.hidden) { if (mk && mk.wulk) mk.wulk.wybierz(null); return; }
    ui.kWulk.hidden = true; delete ui.kWulk.dataset.id; delete ui.kWulk.dataset.grupa;
    if (mk && mk.wulk) mk.wulk.wybierz(null);
    przesunKadr();
  }

  /* ---------- lektor na pinach makiety (Task 8d) ---------- */
  // Przycisk „▶ Posłuchaj” (punkt turystyki: „▶ Posłuchaj: <część wyspy>”) w karcie części, wulkanu i punktu turystyki —
  // TYLKO gdy zrodloLektoraStrony daje bazę (zaproszenie na kodownik.co albo &lektor=lokalny na localhost), czasy.json z tej
  // bazy się wczytał (raz na wejście do makiety) i nagranie wersu pinu jest aktualne (GeologiaLektor.czasWersu); inaczej
  // przycisku nie ma w DOM. Które piny mówią — GeologiaOpowiesc.wersPinu (jedno źródło z generatorem). Dźwięk przez
  // GeologiaLektor; AudioContext tworzony i wznawiany w obsłudze kliknięcia (gest — iOS/Android). Jedno nagranie naraz;
  // zamknięcie i otwarcie karty, Esc, wyjście z makiety, start pokazu i zamknięcie zakładki zatrzymują nagranie, wyjście
  // z makiety zwalnia kontekst. 403/404/wygasłe zaproszenie → brak przycisków i jedno „Geologia/uwaga: lektor niedostępny (…)”.
  // Brak połączenia (recenzja końcowa I-1 — szlak bez zasięgu): czasy.json przez GeologiaLektor.pobierzCzasy (limit 8 s, po
  // błędzie sieci jedna próba z pamięci podręcznej, 4 s); gdy i ta zawiedzie, lm.powod = 'siec' i karta pinu z nagraniem ma
  // notkę-przycisk „Lektor: brak połączenia — spróbuj ponownie”. Otwarcie karty (najwcześniej ODSTEP_PONOWIENIA_MS po końcu
  // ostatniej próby) albo stuknięcie notki ponawia pobranie — najwyżej jedno w toku; po udanym przyciski stają w otwartych kartach.
  var lm = { stan: 'brak', czasy: null, zr: null, nr: 0, nrGry: 0, ostrzezono: false, ctx: null, lek: null, gra: null, powod: null, koniecProby: 0 };
  var ODSTEP_PONOWIENIA_MS = 5000;
  function ostrzezLektorMakiety(powod) {
    if (lm.ostrzezono) return;
    lm.ostrzezono = true;
    console.warn('Geologia/uwaga: lektor niedostępny (' + powod + ') — makieta bez przycisków lektora');
  }
  // ponowienie = ta sama makieta po błędzie sieci (bez drugiego ostrzeżenia w konsoli)
  function wczytajLektorMakiety(ponowienie) {
    var nr = ++lm.nr, GL = window.GeologiaLektor;
    lm.czasy = null; lm.stan = 'brak';
    if (!ponowienie) { lm.ostrzezono = false; lm.powod = null; }
    var zr = L.zrodloLektoraStrony ? L.zrodloLektoraStrony(st.miejsce) : null;
    lm.zr = zr;
    if (!zr || !zr.baza) { lm.powod = zr ? zr.powod : null; if (zr && zr.powod === 'wygaslo') ostrzezLektorMakiety('zaproszenie wygasło'); return; }
    if (!GL || !GL.pobierzCzasy || !window.GeologiaOpowiesc || !window.GeologiaOpowiesc.wersPinu) return;
    lm.stan = 'laduje';
    GL.pobierzCzasy({ adres: zr.baza + 'czasy.json' + zr.zapytanie, limit_ms: 8000, limitPonowienia_ms: 4000 }).then(function (cz) {
      if (nr !== lm.nr) return;
      lm.czasy = cz; lm.stan = 'gotowy'; lm.powod = null;
      odswiezPrzyciskiLektora();
    }, function (e) {
      if (nr !== lm.nr) return;
      lm.czasy = null; lm.stan = 'brak'; lm.powod = GL.powodBledu(e); lm.koniecProby = performance.now();
      ostrzezLektorMakiety(e && e.message || e);
      odswiezPrzyciskiLektora();
    });
  }
  // brak lektora z powodu sieci: ponów (otwarcie karty — z odstępem; stuknięcie notki — od razu), najwyżej jedna próba w toku
  function ponowLektorMakiety(odRazu) {
    if (lm.stan !== 'brak' || lm.powod !== 'siec' || !mk) return false;
    if (!odRazu && performance.now() - lm.koniecProby < ODSTEP_PONOWIENIA_MS) return false;
    wczytajLektorMakiety(true);
    return lm.stan === 'laduje';
  }
  function wersKarty(rodzaj, pin) {
    var O = window.GeologiaOpowiesc, GL = window.GeologiaLektor;
    if (!lm.czasy || !O || !GL || !pin) return null;
    var w = O.wersPinu(rodzaj, pin);
    return w && GL.czasWersu(w, lm.czasy) != null ? w : null;
  }
  // Karta mówi wersem pinu (rodzaj, pin); przycisk stoi za elementem `po` (nazwa w karcie). Bez nagrania — bez przycisku.
  function lektorKarty(karta, rodzaj, pin, po) {
    karta._lektor = rodzaj ? { rodzaj: rodzaj, pin: pin, po: po } : null;
    if (rodzaj && pinMowi(karta._lektor) && ponowLektorMakiety(false)) { odswiezPrzyciskiLektora(); return; }
    wstawPrzyciskLektora(karta);
  }
  // pin ma wers do nagrania (bez sprawdzania aktualności — czasy.json może nie być)
  function pinMowi(d) {
    var O = window.GeologiaOpowiesc;
    return !!(d && d.pin && O && O.wersPinu && O.wersPinu(d.rodzaj, d.pin));
  }
  function napisLektora(b, gra) {
    b.textContent = gra ? '■ Zatrzymaj' : b.dataset.napis;
    b.setAttribute('aria-pressed', String(!!gra));
  }
  function wstawPrzyciskLektora(karta) {
    var d = karta._lektor, stary = karta.querySelector('.ge-lektor');
    var w = d && !karta.hidden && d.po.parentNode ? wersKarty(d.rodzaj, d.pin) : null;
    if (stary && (!w || stary.dataset.wers !== w.id)) { if (lm.gra && lm.gra.b === stary) zatrzymajLektorMakiety(); stary.remove(); stary = null; bladLektora(karta, null); }
    notkaSieci(karta, !w && d && !karta.hidden && d.po.parentNode && lm.powod === 'siec' && (lm.stan === 'brak' || lm.stan === 'laduje') && pinMowi(d) ? d : null);
    if (!w || stary) return;
    var tur = d.rodzaj === 'turystyka';
    var b = el('button', 'ge-guzik ge-lektor', null, null);
    b.type = 'button'; b.dataset.wers = w.id;
    b.dataset.napis = '▶ Posłuchaj' + (tur ? ': ' + w.etykieta : '');
    b.title = tur ? 'Lektor: ' + w.etykieta + ' — część wyspy, na której leży ten punkt' : 'Lektor czyta opis';
    napisLektora(b, false);
    b.addEventListener('click', function () { if (lm.gra && lm.gra.b === b) zatrzymajLektorMakiety(); else grajLektorMakiety(w, b, karta); });
    d.po.parentNode.insertBefore(b, d.po.nextSibling);
  }
  function odswiezPrzyciskiLektora() {
    if (!ui) return;
    [ui.kCzesc, ui.kWulk, ui.kTur].forEach(wstawPrzyciskLektora);
  }
  function grajLektorMakiety(w, b, karta) {
    zatrzymajLektorMakiety();
    var GL = window.GeologiaLektor, AC = window.AudioContext || window.webkitAudioContext;
    if (!lm.czasy || !lm.zr || !lm.zr.baza) return;
    bladLektora(karta, null);
    GL.trybOdtwarzania(window.navigator);   // iOS: dźwięk mimo przełącznika wyciszenia — w geście, przed kontekstem
    if (!lm.ctx) {
      if (!AC) { ostrzezLektorMakiety('brak Web Audio'); wylaczLektorMakiety(); return; }
      try { lm.ctx = new AC(); } catch (e) { ostrzezLektorMakiety('AudioContext: ' + (e && e.message || e)); wylaczLektorMakiety(); return; }
      var zr = lm.zr;
      lm.lek = GL.utworz(function (plik) { return zr.baza + plik + zr.zapytanie; }, lm.czasy, lm.ctx);
    }
    // wznowienie w geście (kontekst wstrzymany przez przeglądarkę albo system)
    if (lm.ctx.state !== 'running') { try { var p = lm.ctx.resume(); if (p && p.catch) p.catch(function () { /* nic */ }); } catch (_) { /* nic */ } }
    var g = { id: w.id, b: b, karta: karta, nr: ++lm.nrGry }, lek = lm.lek;
    lm.gra = g; lm.stan = 'gra'; napisLektora(b, true);
    lek.przygotuj([w.id]).then(function (bufory) {
      if (lm.gra !== g) return;
      // nagranie się nie wczytało (GeologiaLektor ostrzegł raz): przycisk wraca do „▶”, ponowny klik próbuje znowu
      // (słaby zasięg na szlaku). Tylko 401/403 — zaproszenie wygasło w trakcie sesji — zdejmuje przyciski ze wszystkich kart.
      if (!bufory || !bufory[0]) {
        var b0 = lek.blad(w.id), st0 = b0 ? b0.status : 0;
        koniecGryLektora();
        if (st0 === 401 || st0 === 403) { wylaczLektorMakiety(); komunikat('Lektor niedostępny — zaproszenie wygasło albo jest nieważne.'); }
        else bladLektora(karta, 'Nie udało się wczytać nagrania — spróbuj ponownie.');
        return;
      }
      if (!lek.graj(w.id, 0, null, function () { if (lm.gra === g) koniecGryLektora(); })) koniecGryLektora();
    });
  }
  function koniecGryLektora() {
    var g = lm.gra;
    lm.gra = null;
    if (lm.stan === 'gra') lm.stan = lm.czasy ? 'gotowy' : 'brak';
    if (g) napisLektora(g.b, false);
  }
  // bez argumentu — każde nagranie; z kartą — tylko nagranie z tej karty
  function zatrzymajLektorMakiety(karta) {
    if (!lm.gra || (karta && lm.gra.karta !== karta)) return;
    if (lm.lek) lm.lek.zatrzymaj();
    koniecGryLektora();
  }
  // komunikat pod przyciskiem po nieudanym wczytaniu nagrania; null = zdejmij (następna próba, zamknięcie karty)
  function bladLektora(karta, tekst) {
    var k = karta.querySelector('.ge-lektor-blad');
    if (!tekst) { if (k) k.remove(); return; }
    var b = karta.querySelector('.ge-lektor');
    if (!b) return;
    if (!k) { k = el('p', 'ge-lektor-blad', null, null); k.setAttribute('role', 'status'); b.parentNode.insertBefore(k, b.nextSibling); }
    k.textContent = tekst;
  }
  // notka „brak połączenia” w karcie pinu z nagraniem (d = dane lektora karty) albo null = zdejmij; stuknięcie ponawia od razu
  function notkaSieci(karta, d) {
    var n = karta.querySelector('.ge-lektor-siec');
    if (!d) { if (n) n.remove(); return; }
    if (!n) {
      n = el('button', 'ge-lektor-siec', null, null); n.type = 'button';
      n.addEventListener('click', function () { if (ponowLektorMakiety(true)) odswiezPrzyciskiLektora(); });
      d.po.parentNode.insertBefore(n, d.po.nextSibling);
    }
    var laduje = lm.stan === 'laduje', t = laduje ? 'Lektor: łączę…' : 'Lektor: brak połączenia — spróbuj ponownie';
    if (n.textContent !== t) n.textContent = t;
    n.disabled = laduje;
    n.title = laduje ? 'Pobieram listę nagrań lektora' : 'Stuknij, aby spróbować ponownie (albo otwórz kartę jeszcze raz)';
  }
  // karta zamknięta: jej nagranie milknie, przycisk znika z DOM
  function zdejmijLektorKarty(karta) {
    zatrzymajLektorMakiety(karta);
    karta._lektor = null;
    var b = karta.querySelector('.ge-lektor');
    if (b) b.remove();
    bladLektora(karta, null);
    notkaSieci(karta, null);
  }
  function wylaczLektorMakiety() { lm.czasy = null; lm.stan = 'brak'; lm.powod = 'zaproszenie'; odswiezPrzyciskiLektora(); }

  /* ---------- pejzaż dźwiękowy makiety i stuknięcie w skałę (Task B3) ---------- */
  // Przycisk głośnika w pasku (domyślnie wyłączony, po każdym wejściu w makietę). Pierwsze włączenie to gest: tu powstaje
  // WŁASNY AudioContext pejzażu (osobny od lektora pinów — diagnostyka().audioMakiety liczy oba) i GeologiaDzwiek.utworz;
  // brak Web Audio albo błąd budowy → jedno „Geologia/uwaga: …”, przycisk nieaktywny, makieta działa dalej bez dźwięku.
  // Włączony: co 0,1 s poziomy warstw z GeologiaPejzaz.poziomy dla punktu pod środkiem ekranu (ląd z marszu promienia, inaczej
  // tafla), × POD_LEKTOREM_PEJZAZ, gdy gra lektor pinu. Wyłączony: cisza i kontekst wstrzymany (ponowne włączenie wznawia
  // go w geście). Klik w teren (poza pinami — karta zamyka się jak dotąd) → pierścień w shaderze (sc.stuk) i krótkie
  // stuknięcie z GeologiaPejzaz.brzmienie (umowne — interfejs nic o brzmieniu skał nie mówi). Wyjście z makiety zamyka kontekst.
  // Pomruk pejzażu bez trzasków Poissona (utworz z { trzaski: false }, R17 — przy kalimie trzask lawy byłby fałszywy). Karta
  // w tle wstrzymuje kontekst, powrót wznawia. Błąd węzłów stuknięcia (kontekst przerwany/zamknięty) → jedno
  // „Geologia/uwaga: stuknięcie bez dźwięku”, klik działa dalej (pierścień i karta).
  var POD_LEKTOREM_PEJZAZ = 0.3;
  var pj = { wl: false, ctx: null, dz: null, szum: null, poziomy: null, ostatniStuk: null, tProby: 0, niedostepny: false, ostrzezono: false,
    ostrzezonoStuk: false, wTle: false };
  function ostrzezPejzaz(powod) {
    if (!pj.ostrzezono) console.warn('Geologia/uwaga: dźwięk makiety niedostępny (' + powod + ') — makieta bez dźwięku');
    pj.ostrzezono = true; pj.niedostepny = true;
  }
  function odswiezGlosnik() {
    if (!ui) return;
    ui.bGlosnik.setAttribute('aria-pressed', String(pj.wl));
    ui.bGlosnik.disabled = pj.niedostepny;
    ui.bGlosnik.title = pj.niedostepny ? 'Dźwięk makiety niedostępny w tej przeglądarce'
      : pj.wl ? 'Wyłącz dźwięk makiety' : 'Włącz dźwięk makiety: szum morza i wiatru zależny od miejsca w kadrze, stuknięcie po kliknięciu w teren';
  }
  function ikonaGlosnika(b) {
    var s = svgEl('svg', { viewBox: '-50 -50 100 100', 'aria-hidden': 'true', focusable: 'false' }, b);
    svgEl('path', { d: 'M-34,-13 L-16,-13 L4,-32 L4,32 L-16,13 L-34,13 Z', fill: 'currentColor' }, s);
    svgEl('path', { class: 'ge-glosnik-fale', d: 'M15,-17 A24,24 0 0 1 15,17 M24,-30 A40,40 0 0 1 24,30', fill: 'none', stroke: 'currentColor', 'stroke-width': '7', 'stroke-linecap': 'round' }, s);
    svgEl('path', { class: 'ge-glosnik-cisza', d: 'M16,-14 L40,14 M40,-14 L16,14', fill: 'none', stroke: 'currentColor', 'stroke-width': '7', 'stroke-linecap': 'round' }, s);
  }
  function ustawDzwiekMakiety(wl) {
    wl = !!wl && !pj.niedostepny && !!mk;
    if (wl && !pj.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !window.GeologiaDzwiek || !window.GeologiaPejzaz) { ostrzezPejzaz('brak Web Audio'); wl = false; }
      else {
        try { pj.ctx = new AC(); } catch (e) { ostrzezPejzaz('AudioContext: ' + (e && e.message || e)); wl = false; }
        if (pj.ctx) {
          // R17: bez trzasków lawy (pomruk kalimy to stłumienie, nie lawa)
          try { pj.dz = window.GeologiaDzwiek.utworz(pj.ctx, { trzaski: false }); } catch (e) {
            ostrzezPejzaz(e && e.message || e); wl = false;
            try { var pz = pj.ctx.close(); if (pz && pz.catch) pz.catch(function () { /* nic */ }); } catch (_) { /* nic */ }
            pj.ctx = null; pj.dz = null;
          }
        }
      }
    }
    pj.wl = wl;
    if (pj.dz) {
      pj.dz.cisza(!wl);
      try {
        var p = wl ? (pj.ctx.state !== 'running' ? pj.ctx.resume() : null) : pj.ctx.suspend();
        if (p && p.catch) p.catch(function () { /* nic */ });
      } catch (_) { /* nic */ }
    }
    if (wl) { pj.tProby = performance.now(); probkujPejzaz(); }
    odswiezGlosnik();
    return pj.wl;
  }
  // punkt pod środkiem ekranu → poziomy warstw (GeologiaPejzaz.poziomy); kamera w niebo (bez lądu i tafli) → miejsce pod kamerą
  function probkujPejzaz() {
    if (!mk || !pj.dz) return;
    var sc = mk.sc, k = sc.kamera.position, p = sc.punktNaTerenie(0, 0) || sc.punktNaMorzu(0, 0);
    if (!p) p = [k.x, k.z];
    var pr = sc.probkaPejzazu(p[0], p[1]), y = Math.max(0, sc.wysokosc(p[0], p[1]) || 0);
    pr.odlKameryKm = Math.hypot(k.x - p[0], k.y - y, k.z - p[1]);
    pr.kalima = mks.pogoda === 'kalima';
    var lv = window.GeologiaPejzaz.poziomy(pr);
    if (lm.gra) Object.keys(lv).forEach(function (x) { lv[x] *= POD_LEKTOREM_PEJZAZ; });
    pj.poziomy = lv;
    pj.dz.ustaw(lv);
  }
  // zegar animuj(t) z krok() — pierścień stuknięcia liczy wiek na tym samym zegarze
  function zegarMakiety() { return smoke ? 1 : (performance.now() - tStart) / 1000; }
  function stuknij(x, y) {
    if (!pj.wl || !pj.dz || !mk) return;
    var n = ndc(x, y), p = n && mk.sc.punktNaTerenie(n[0], n[1]);
    if (!p) return;
    var id = mk.sc.jednostkaPod(p[0], p[1]), D = window.GeologiaTeneryfa;
    mk.sc.stuk(p[0], p[1], zegarMakiety());
    // kontekst przerwany (iOS „interrupted”) albo zamknięty z zewnątrz: węzły rzucają — klik nie może się wysypać
    try {
      grajStuk(window.GeologiaPejzaz.brzmienie(id, D && D.jednostki));
      pj.ostatniStuk = { jednostka: id, t: pj.ctx.currentTime };
    } catch (e) {
      if (!pj.ostrzezonoStuk) console.warn('Geologia/uwaga: stuknięcie bez dźwięku (' + (e && e.message || e) + ')');
      pj.ostrzezonoStuk = true;
    }
  }
  // stuknięcie: sinus (lekko opadający) + szum przez pasmowy przy 1,6 × częstotliwości, obwiednie wykładnicze; do miksera
  // podkładu (wejście lektora: kompresor, master) — źródła rozłączane po końcu
  function grajStuk(b) {
    var ctx = pj.ctx, t = ctx.currentTime, wy = pj.dz.wejscie, A = 0.003;
    if (!pj.szum) {
      var n = Math.round(0.3 * ctx.sampleRate), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      pj.szum = buf;
    }
    var o = ctx.createOscillator(), go = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(b.czest, t); o.frequency.exponentialRampToValueAtTime(b.czest * 0.85, t + A + b.wybrzmienie);
    go.gain.setValueAtTime(0, t); go.gain.linearRampToValueAtTime(0.25 * (1 - 0.6 * b.szum), t + A); go.gain.exponentialRampToValueAtTime(0.0005, t + A + b.wybrzmienie);
    o.connect(go); go.connect(wy); o.start(t); o.stop(t + A + b.wybrzmienie + 0.05);
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gs = ctx.createGain(), ds = Math.min(0.12, b.wybrzmienie);
    s.buffer = pj.szum; f.type = 'bandpass'; f.frequency.value = b.czest * 1.6; f.Q.value = 0.9;
    gs.gain.setValueAtTime(0, t); gs.gain.linearRampToValueAtTime(0.6 * b.szum, t + A); gs.gain.exponentialRampToValueAtTime(0.0005, t + A + ds);
    s.connect(f); f.connect(gs); gs.connect(wy); s.start(t); s.stop(t + A + ds + 0.05);
    var rozlacz = function (wezly) { return function () { wezly.forEach(function (w) { try { w.disconnect(); } catch (_) { /* nic */ } }); }; };
    o.onended = rozlacz([o, go]); s.onended = rozlacz([s, f, gs]);
  }
  // karta w tle (jak pokaz i Myśliwce): rAF staje, więc próbki też — kontekst wstrzymany, po powrocie wznowiony
  // i od razu nowa próbka (poziomy sprzed ukrycia mogły być nieaktualne)
  doc.addEventListener('visibilitychange', function () {
    if (!pj.ctx || !pj.wl) return;
    try {
      var p = doc.hidden ? pj.ctx.suspend() : pj.ctx.resume();
      if (p && p.catch) p.catch(function () { /* nic */ });
    } catch (_) { /* nic */ }
    pj.wTle = doc.hidden;
    if (!doc.hidden) { pj.tProby = performance.now(); probkujPejzaz(); }
  });
  function zwolnijPejzaz() {
    if (pj.dz) { try { pj.dz.zwolnij(); } catch (_) { /* nic */ } }
    if (pj.ctx) { try { var p = pj.ctx.close(); if (p && p.catch) p.catch(function () { /* nic */ }); } catch (_) { /* nic */ } }
    pj.ctx = null; pj.dz = null; pj.szum = null; pj.wl = false; pj.poziomy = null; pj.ostatniStuk = null;
    pj.niedostepny = false; pj.ostrzezono = false; pj.ostrzezonoStuk = false; pj.wTle = false;
    odswiezGlosnik();
  }
  function zwolnijLektorMakiety() {
    lm.nr++;                            // spóźniony czasy.json nie wróci do zamkniętej makiety
    zatrzymajLektorMakiety();
    if (lm.lek) { try { lm.lek.zwolnij(); } catch (_) { /* nic */ } }
    if (lm.ctx) { try { var p = lm.ctx.close(); if (p && p.catch) p.catch(function () { /* nic */ }); } catch (_) { /* nic */ } }
    lm.lek = null; lm.ctx = null; lm.czasy = null; lm.zr = null; lm.stan = 'brak'; lm.powod = null;
    if (ui) [ui.kCzesc, ui.kWulk, ui.kTur].forEach(zdejmijLektorKarty);
  }

  /* ---------- karty i legenda ---------- */
  function znaczekPewnosci(rodzic, poziom) {
    var z = el('span', 'ge-pewnosc', 'pewność: ' + (NAZWY_PEWNOSCI[poziom] || poziom), rodzic);
    z.dataset.poziom = poziom;
    return z;
  }
  function zrodlo(rodzic, tekst) { var p = el('p', 'ge-zrodlo', null, rodzic); el('b', null, 'Źródło: ', p); el('span', null, tekst, p); }
  function zbudujLegende() {
    var D = window.GeologiaTeneryfa;
    ui.legenda.replaceChildren();
    el('span', 'ge-plakietka', 'MAPA UPROSZCZONA', ui.legenda);
    el('h3', 'ge-h3', 'Jednostki geologiczne', ui.legenda);
    var ul = el('ul', 'ge-legenda-lista', null, ui.legenda);
    ((D && D.jednostki) || []).forEach(function (j) {
      var li = el('li', null, null, ul);
      var k = el('span', 'ge-probka', null, li); k.style.background = j.kolor;
      el('span', null, j.nazwa, li);
      li.title = (j.skaly || []).join(', ');
    });
    el('p', 'ge-zrodlo', 'Granice uproszczone z mapy IGN/IGME 1:1M (pewność granic: niska).', ui.legenda);
  }
  function pokazCzesc(id) {
    var D = window.GeologiaTeneryfa, c = D && D.czesci.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    zamknijMity(true);
    zamknijTur(true);
    zamknijWulkan();
    if (waskiEkran() && ui.plan.dataset.zwiniety === 'false') rozwinPlan(false);
    if (waskiEkran() && legendaWulkanowRozwinieta()) rozwinLegendeWulkanow(false);
    zatrzymajLektorMakiety();
    mks.czesc = id;
    var t = ui.kCzescT;
    t.replaceChildren();
    el('p', 'ge-karta-rodzaj', 'Część · ' + (RODZAJE[c.rodzaj] || c.rodzaj), t);
    var nazwa = el('h3', 'ge-karta-nazwa', c.nazwa, t);
    if (c.wys_m != null) el('p', 'ge-karta-wys', liczba(c.wys_m) + ' m n.p.m.', t);
    znaczekPewnosci(t, c.pewnosc);
    el('p', 'ge-akapit', c.opis, t);
    zrodlo(t, c.zrodlo);
    ui.kCzesc.dataset.czesc = id;
    ui.kCzesc.hidden = false;
    lektorKarty(ui.kCzesc, 'czesc', c, nazwa);
    if (mk) mk.sc.podswietl(id);
    przesunKadr();
  }
  function zamknijCzesc() {
    zdejmijLektorKarty(ui.kCzesc);
    mks.czesc = null; ui.kCzesc.hidden = true; delete ui.kCzesc.dataset.czesc;
    if (mk) mk.sc.podswietl(null);
    przesunKadr();
  }
  function pokazMity() {
    var D = window.GeologiaTeneryfa;
    zamknijCzesc();
    zamknijTur(true);
    zamknijWulkan();
    mks.mity = true;
    var t = ui.kMityT;
    t.replaceChildren();
    el('p', 'ge-karta-rodzaj', 'Teneryfa', t);
    el('h3', 'ge-karta-nazwa', 'Fakty i mity', t);
    ((D && D.mity) || []).forEach(function (m) {
      var a = el('article', 'ge-mit', null, t); a.dataset.werdykt = m.werdykt;
      el('span', 'ge-werdykt', WERDYKTY[m.werdykt] || m.werdykt, a);
      el('p', 'ge-teza', m.teza, a);
      el('p', 'ge-akapit', m.wyjasnienie, a);
      znaczekPewnosci(a, m.pewnosc);
      zrodlo(a, m.zrodlo);
    });
    ui.kMity.hidden = false;
    odswiezNarzedzia();
  }
  function zamknijMity(cicho) { mks.mity = false; if (ui) { ui.kMity.hidden = true; przesunKadr(); } if (!cicho) odswiezNarzedzia(); }
  // Karta przekroju: profil z danych (linia ciągła), wnętrze jako schemat (plakietka), warstwy z pewnością.
  function odswiezKartePrzekroju(profil) {
    var k = ui.kPrzekroj;
    if (!profil) { k.hidden = true; return; }
    var D = window.GeologiaTeneryfa;
    k.replaceChildren();
    el('span', 'ge-plakietka', 'SCHEMAT', k);
    el('h3', 'ge-karta-nazwa', 'Przekrój ' + kierunekSlownie(profil.kat_st), k);
    var c = el('canvas', 'ge-profil', null, k); c.width = 560; c.height = 190;
    rysujProfil(c, profil);
    var maks = Math.round(profil.maks_m);
    k.dataset.maxM = String(maks);
    // linia bez lądu (przesunięta poza wyspę): maksimum ≤ 0 m — także 0 m półki szwu SRTM/ETOPO — to „najpłycej”, nie szczyt
    var gdzie = profil.przesuniecie_km ? ' · przesunięty o ' + liczba(profil.przesuniecie_km, 1) + ' km od Teide' : ' · przez Teide';
    k.dataset.ocean = String(maks <= 0);
    el('p', 'ge-karta-wys', (maks <= 0 ? 'Tu tylko ocean — najpłycej ' + liczba(-maks) + ' m p.p.m.' : 'Najwyżej na linii: ' + liczba(maks) + ' m n.p.m.') +
      ' · długość ' + liczba(profil.dl_km) + ' km' + gdzie, k);
    var leg = el('p', 'ge-legenda-linii', null, k);
    el('span', 'ge-linia-ciagla', 'profil: dane (rzeźba SRTM/ETOPO)', leg);
    el('span', 'ge-linia-przerywana', 'wnętrze: schemat z danych warstw', leg);
    var ul = el('ul', 'ge-warstwy', null, k);
    ((D && D.warstwy) || []).forEach(function (w) {
      var li = el('li', null, null, ul);
      el('span', null, w.nazwa + (w.pewnosc === 'niska' ? ' — głębokość szacowana' : ''), li);
      znaczekPewnosci(li, w.pewnosc);
    });
    el('p', 'ge-zrodlo', 'Przewyższenie ×' + liczba(mks.przew, 1) + '. Przeciągnij ścianę przekroju, by przesunąć linię; suwak „Kąt” ją obraca.', k);
    k.hidden = false;
  }
  function kierunekSlownie(kat) {
    var nazwy = ['N–S', 'NNE–SSW', 'NE–SW', 'ENE–WSW', 'W–E', 'ESE–WNW', 'SE–NW', 'SSE–NNW'];
    return nazwy[Math.round(kat / 22.5) % 8] + ' (' + Math.round(kat) + '°)';
  }
  function rysujProfil(c, profil) {
    var x = c.getContext('2d'), W = c.width, H = c.height, pad = 28;
    var hMax = Math.max(500, profil.maks_m), hMin = -3500;
    var px = function (i) { return pad + (W - pad - 8) * i / (profil.length - 1); };
    var py = function (h) { return 8 + (H - 30) * (hMax - h) / (hMax - hMin); };
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(22,64,94,0.55)'; x.fillRect(pad, py(0), W - pad - 8, py(hMin) - py(0));
    x.beginPath(); x.moveTo(px(0), py(hMin));
    profil.forEach(function (p, i) { x.lineTo(px(i), py(p.h == null ? hMin : p.h)); });
    x.lineTo(px(profil.length - 1), py(hMin)); x.closePath();
    x.fillStyle = 'rgba(154,91,52,0.55)'; x.fill();
    x.beginPath(); profil.forEach(function (p, i) { var y = py(p.h == null ? hMin : p.h); if (i) x.lineTo(px(i), y); else x.moveTo(px(i), y); });
    x.lineWidth = 2; x.strokeStyle = '#fff6e0'; x.stroke();
    x.setLineDash([5, 4]); x.strokeStyle = 'rgba(160,190,215,0.7)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(pad, py(0)); x.lineTo(W - 8, py(0)); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#9aa7b4'; x.font = '11px system-ui, sans-serif'; x.textBaseline = 'middle';
    [3000, 0, -3000].forEach(function (h) { x.fillText((h / 1000) + ' km', 0, py(h)); });
  }

  /* ---------- pełny ekran, Esc ---------- */
  function pelnyEkran() {
    try {
      if (doc.fullscreenElement) doc.exitFullscreen();
      else if (korzen.requestFullscreen) korzen.requestFullscreen();
    } catch (e) { console.warn('Geologia/uwaga: pełny ekran niedostępny', e); }
  }
  function esc() {
    if (st.tryb === 'pokaz') {
      if (doc.fullscreenElement) doc.exitFullscreen();
      else otworz({ miejsce: st.miejsce, tryb: 'makieta' });
      return;
    }
    if (!ui.kWulk.hidden) zamknijWulkan();
    else if (!ui.kTur.hidden) zamknijTur();
    else if (!ui.kCzesc.hidden) zamknijCzesc();
    else if (mks.mity) zamknijMity();
    else if (planRozwiniety()) rozwinPlan(false);         // rozwinięty „Plan dni” to ogniwo łańcucha G-E (każda szerokość)
    else if (waskiEkran() && legendaWulkanowRozwinieta()) rozwinLegendeWulkanow(false);   // szuflada legendy (telefon)
    else if (doc.fullscreenElement) doc.exitFullscreen();
    else window.Zakladki.zamknijDoUkladu();
  }
  // klawisze w fazie przechwytywania: skróty Układu nie dostają klawiszy, gdy zakładka jest aktywna
  window.addEventListener('keydown', function (e) {
    if (!aktywny) return;
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = e.target && e.target.tagName, natywny = tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SUMMARY';
    var k = e.key;
    if (natywny && (k === ' ' || k === 'Enter')) return;
    if (tag === 'INPUT' && /^(Arrow|Page|Home$|End$)/.test(k)) return;
    if (k === 'Escape') { e.preventDefault(); esc(); }
    else if (k === 'f' || k === 'F') { e.preventDefault(); pelnyEkran(); }
    // strzałki i M sterują filmem także przy fokusie na przycisku (M-2 recenzji końcowej); spacja i Enter na przycisku — natywnie (wyżej)
    else if (st.tryb === 'pokaz' && pokaz && tag !== 'INPUT' && pokaz.klawisz(k)) e.preventDefault();
  }, true);
  // klik myszą nie zostawia fokusu na przycisku (e.detail > 0; aktywacja z klawiatury ma 0): inaczej spacja po kliknięciu „Dźwięk”
  // przełączała dźwięk drugi raz zamiast pauzować (M-2); użytkownik klawiatury (Tab) zachowuje fokus i natywną spację
  korzen.addEventListener('click', function (e) {
    var b = e.detail > 0 && e.target && e.target.closest ? e.target.closest('button, summary') : null;
    if (b && b.blur) b.blur();
  });
  window.addEventListener('keyup', function (e) { if (aktywny) e.stopPropagation(); }, true);

  /* ---------- wskazywanie: klik w znacznik → karta; przeciąganie ściany przekroju ---------- */
  function ndc(x, y) {
    var r = ui.canvas.getBoundingClientRect();
    if (!(r.width > 0)) return null;
    return [(x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1];
  }
  function trafienie(x, y) { var n = ndc(x, y); return n && mk ? mk.sc.pick(n[0], n[1]) : null; }
  function trafienieTur(x, y) { var n = ndc(x, y); return n && mk && mk.tur && turystykaWidoczna() ? mk.tur.pick(n[0], n[1]) : null; }
  function trafienieWulk(x, y) { var n = ndc(x, y); return n && mk && mk.wulk && wulkanyWidoczna() ? mk.wulk.pick(n[0], n[1]) : null; }
  function trafiaSciane(x, y) { var n = ndc(x, y); return !!(n && mk && mk.sc.trafiaSciane(n[0], n[1])); }
  function podpinanieWskaznika() {
    ui.canvas.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse') { if (!wskaznik) wskaznik = {}; wskaznik.x = e.clientX; wskaznik.y = e.clientY; wskaznik.nowy = true; }
      if (ciag && mk && mks.przekroj) {
        var n = ndc(e.clientX, e.clientY), p = n && mk.sc.punktNaMorzu(n[0], n[1]);
        if (!p) return;
        var kat = mks.przekroj.kat_st * RAD, s = mk.sc.srodekPrzekroju;
        var przes = Math.max(-45, Math.min(45, ciag.p0 + ((p[0] - s[0]) * Math.cos(kat) + (p[1] - s[1]) * Math.sin(kat)) - ciag.d0));
        if (Math.abs(przes - mks.przekroj.przesuniecie_km) > 0.05) {
          var prof = mk.sc.przekroj({ kat_st: mks.przekroj.kat_st, przesuniecie_km: przes });
          if (prof) { mks.przekroj.przesuniecie_km = przes; mks.przekroj.profil = prof; ciag.zmiana = true; }
        }
      }
    });
    ui.canvas.addEventListener('pointerleave', function () { wskaznik = null; if (mk) { mks.hover = null; mk.sc.najedz(null); if (mk.wulk) mk.wulk.najedz(null); } ui.canvas.style.cursor = ''; });
    ui.canvas.addEventListener('pointerdown', function (e) {
      nacisk = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (mk && mks.przekroj && trafiaSciane(e.clientX, e.clientY)) {
        var n = ndc(e.clientX, e.clientY), p = mk.sc.punktNaMorzu(n[0], n[1]);
        if (p) {
          var kat = mks.przekroj.kat_st * RAD, s = mk.sc.srodekPrzekroju;
          ciag = { p0: mks.przekroj.przesuniecie_km, d0: (p[0] - s[0]) * Math.cos(kat) + (p[1] - s[1]) * Math.sin(kat), zmiana: false };
          if (mk.ster) mk.ster.enabled = false;
          try { ui.canvas.setPointerCapture(e.pointerId); } catch (_) { /* nic */ }
        }
      }
    });
    function koniecCiagu() {
      if (!ciag) return;
      var zm = ciag.zmiana; ciag = null;
      if (mk && mk.ster) mk.ster.enabled = true;
      if (zm && mks.przekroj) odswiezKartePrzekroju(mks.przekroj.profil);
    }
    ui.canvas.addEventListener('pointercancel', function () { nacisk = null; koniecCiagu(); });
    ui.canvas.addEventListener('pointerup', function (e) {
      var bylCiag = ciag && ciag.zmiana;
      koniecCiagu();
      if (!nacisk) return;
      var ruch = Math.hypot(e.clientX - nacisk.x, e.clientY - nacisk.y);
      nacisk = null;
      // obrót kamery albo przeciąganie, nie klik — rozstrzyga tylko ruch: przy wolnej klatce (słaby GPU, obciążona maszyna)
      // naciśnięcie i puszczenie dzieli kilka klatek renderu i próg czasu (Myśliwce: 600 ms) gubił zwykłe kliknięcia
      if (bylCiag || ruch > 6 || !mk) return;
      // warstwy mają pierwszeństwo przed znacznikami części (te są w nich przygaszone): punkt turystyki → pin wulkanu →
      // linia trasy → część
      var tu = trafienieTur(e.clientX, e.clientY);
      if (tu && tu.typ === 'punkt') { pokazTur(tu.typ, tu.id); return; }
      var wu = trafienieWulk(e.clientX, e.clientY);
      if (wu) { pokazWulkan(wu.id); return; }
      if (tu) { pokazTur(tu.typ, tu.id); return; }
      var id = trafienie(e.clientX, e.clientY);
      if (id) pokazCzesc(id);
      else { if (!ui.kCzesc.hidden) zamknijCzesc(); if (!ui.kTur.hidden) zamknijTur(); if (!ui.kWulk.hidden) zamknijWulkan(); stuknij(e.clientX, e.clientY); }
    });
  }

  /* ---------- pokaz (geologia/pokaz.js) ---------- */
  function utworzPokaz() {
    if (pokaz) return pokaz;
    pokaz = window.GeologiaPokaz.utworz({ T: T, renderer: gl.renderer, korzen: korzen, smoke: smoke, zap: zap, el: el, guzik: guzik,
      wczytajRzezbe: wczytajRzezbe, lod: lod, komunikat: komunikat, pelnyEkran: pelnyEkran,
      doMakiety: function () { otworz({ miejsce: st.miejsce, tryb: 'makieta' }); },
      doUkladu: function () { window.Zakladki.zamknijDoUkladu(); },
      nazwaMiejsca: function (id) { var m = M.MIEJSCA.filter(function (x) { return x.id === id; })[0]; return m ? m.nazwa : id; },
      zmianaRozdzialu: function (id) { if (st.tryb !== 'pokaz' || st.rozdzial === id) return; st.rozdzial = id; odswiezUI(); adres(); },
      zrodloLektora: function (miejsce) { return L.zrodloLektoraStrony ? L.zrodloLektoraStrony(miejsce) : null; } });
    return pokaz;
  }

  /* ---------- API ---------- */
  function otworz(stan) {
    var s = stan || {};
    var miejsce = M.MIEJSCA.some(function (m) { return m.id === s.miejsce; }) ? s.miejsce : M.MIEJSCA[0].id;
    var tryb = s.tryb === 'makieta' ? 'makieta' : 'pokaz';
    var rozdzial = tryb === 'makieta' ? null : (L.ROZDZIALY.some(function (r) { return r.id === s.rozdzial; }) ? s.rozdzial : L.ROZDZIALY[0].id);
    zbudujUI();
    if (mk && (tryb !== 'makieta' || miejsce !== st.miejsce)) zwolnijMakiete();
    if (tryb !== 'makieta') zwolnijLektorMakiety();   // start pokazu: lektor makiety milknie także w trakcie budowy makiety
    if (pokaz && tryb !== 'pokaz') pokaz.wyjdz();
    st.miejsce = miejsce; st.tryb = tryb; st.rozdzial = rozdzial; st.ujecie = null; st.t = zap.t;
    var wS = tryb === 'makieta' && typeof s.warstwa === 'string' ? s.warstwa.split(',') : [];
    if (wS.indexOf('turystyka') >= 0) { mks.turystyka = true; if (mk) ustawTurystyke(true); }
    if (wS.indexOf('wulkany') >= 0) { mks.wulkany = true; if (mk) ustawWulkany(true); }
    if (tryb === 'makieta' && s.pora) mks.pora = poraZAdresu(s.pora);
    if (tryb === 'makieta' && s.pogoda) mks.pogoda = s.pogoda;
    // materiał z hasha; zapytanie (`?…&material=sklejka`) niesie go też bez smoke — pomiar wydajności (scripts/pomiar-makiety.mjs)
    if (tryb === 'makieta' && (s.material === 'sklejka' || zap.material === 'sklejka')) { mks.material = 'sklejka'; if (mk) ustawMaterial('sklejka'); }
    // Task A2: smugi wyłączone z hasha (&wiatr=0) albo z zapytania (hak smoke, pomiar wydajności)
    if (tryb === 'makieta' && (s.wiatr === false || zap.wiatr === false)) { mks.wiatr = false; if (mk) ustawWiatr(false); }
    korzen.hidden = false;
    try {
      zapewnijGL();
      if (!scena) { scena = new T.Scene(); kamera = new T.PerspectiveCamera(45, 1, 0.1, 100); }
      scena.background = new T.Color(kolorTla());
      gl.w = 0; dopasuj();
    } catch (e) {
      console.error('Geologia: nie udało się uruchomić renderera — ' + (e && e.message || e));
      return false;
    }
    odswiezUI(); adres();
    gotowosc = smoke && tryb !== 'makieta' ? miejsce + ' ' + rozdzial : null;
    if (smoke && /[?&]krzywe(?=[&=]|$)/.test(location.search)) sprawdzKrzywe();
    aktywny = true; ostatni = 0;
    if (!tStart) tStart = performance.now();
    pilnujZegaraPory();
    if (tryb === 'makieta') { wejdzMakieta(); zastosujNiebo(); }
    else { komunikat(''); utworzPokaz().wejdz(miejsce, rozdzial); gl.w = 0; dopasuj(); }
    if (!rafId) rafId = requestAnimationFrame(krok);
    if (!smoke) korzen.focus({ preventScroll: true });
    return true;
  }
  function zamknij() {
    aktywny = false;
    zwolnijLektorMakiety();
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    gotowosc = null;
    if (doc.fullscreenElement === korzen) { try { doc.exitFullscreen(); } catch (_) { /* nic */ } }
    if (ui) { zamknijCzesc(); zamknijMity(true); zamknijTur(true); zamknijWulkan(); ui.canvas.style.cursor = ''; }
    wskaznik = null; nacisk = null; ciag = null;
    if (gl) zwolnijMakiete();
    if (pokaz) pokaz.wyjdz();
    if (ui) zwinPasek(false);           // zwinięcie wynika ze stanu warstwy — przy wyjściu z zakładki zdejmowane
    mks.przekroj = null; mks.chmury = false; mks.kolorowanie = 'teren'; mks.przew = mks.przewCel = 1.5; mks.czas = 0; mks.anim = null;
    mks.turystyka = false; mks.tur = null; mks.widok = null; mks.azymut = null; mks.wulkany = false; mks.wulk = null;
    mks.pora = null; mks.pogoda = 'pogodnie'; mks.slonce = null;
    mks.material = 'zwykly'; mks.wiatr = true;
    pilnujZegaraPory();                 // aktywny = false → zegar „Teraz” zatrzymany
    if (ui) { ui.czasSuwak.value = '1000'; pokazCzas(0, false); ui.poraSuwak.dataset.ustawiony = ''; pokazPore(); }
  }
  // G-C: po wczytaniu mysliwce/kino.js (które podmienia globalny obiekt krzywych) zapamiętane krzywe mają dalej swoje funkcje.
  function sprawdzKrzywe() {
    var s = doc.createElement('script');
    s.src = 'mysliwce/kino.js';
    var wynik = function (ok) { console.log('GEOLOGIA_KRZYWE ' + (ok ? 'ok' : 'zle')); };
    s.onload = function () {
      var k = L.krzywe;
      var funkcje = !!k && K_KRZYWE.every(function (n) { return typeof k[n] === 'function'; });
      // znany pozytyw przyrządu: bez window.MysliwceKino kino.js Myśliwców nadpisuje window.Kino (≠ krzywe);
      // z window.MysliwceKino globalne Kino nie jest ruszane (= krzywe)
      var nadpisanie = window.MysliwceKino ? window.Kino === k : window.Kino !== k;
      wynik(funkcje && nadpisanie);
    };
    s.onerror = function () { wynik(false); };
    doc.head.appendChild(s);
  }

  window.Geologia = {
    otworz: otworz,
    zamknij: zamknij,
    stan: function () {
      var rz = mk && mk.rz, ps = st.tryb === 'pokaz' && pokaz ? pokaz.stan() : null;
      return { miejsce: st.miejsce, tryb: st.tryb, rozdzial: st.rozdzial, ujecie: ps ? ps.ujecie : st.ujecie, t: ps ? ps.t : st.t, fps: Math.round(fps),
        jakosc: jakosc, jakoscAuto: !wymusPelna, lektor: smoke ? 'cisza' : ps ? ps.lektorStan : 'brak', gotowa: st.tryb === 'pokaz' ? !!(pokaz && pokaz.gotowy()) : !!(mk && mk.horGotowy), pokaz: ps,
        rzezba: rz ? { hMax: rz.hMax, hMin: rz.hMin, hMaxJson: rz.meta.hMax, hMinJson: rz.meta.hMin } : null,
        kolorowanie: mks.kolorowanie, material: mks.material, wiatr: mks.wiatr, przekroj: mks.przekroj ? { kat_st: mks.przekroj.kat_st, przesuniecie_km: mks.przekroj.przesuniecie_km,
          maks_m: mks.przekroj.profil ? mks.przekroj.profil.maks_m : null } : null,
        chmury: mks.chmury, pogoda: mks.pogoda, pora: mks.pora == null ? null : mks.pora === 'teraz' ? 'teraz' : window.GeologiaSlonce.godzinaTekst(mks.pora),
        slonce: mks.slonce ? { az: mks.slonce.az, el: mks.slonce.el, pora: mks.slonce.pora, min: mks.slonce.min, ms: mks.slonce.ms } : null,
        poraTekst: ui ? ui.poraTekst.textContent : null, przewyzszenie: mks.przew, przewyzszenieCel: mks.przewCel, czesc: mks.czesc, mity: mks.mity,
        przelot: !!(mk && mk.lot), pelnyEkran: doc.fullscreenElement === korzen, scena: mk ? mk.sc.stan() : null,
        czas: mks.czas, anim: mks.anim ? { nazwa: mks.anim.nazwa, f: mks.anim.f } : null,
        czasTekst: ui ? ui.czasWart.textContent : null, rekonstrukcja: ui ? !ui.czasPlak.hidden : false,
        turystyka: mks.turystyka, turystykaWidoczna: turystykaWidoczna(), kartaTur: mks.tur ? { typ: mks.tur.typ, id: mks.tur.id } : null,
        warstwa: mk && mk.tur ? mk.tur.stan() : null, widok: mks.widok, kompas: { azymut: mks.azymut },
        wulkany: mks.wulkany, wulkanyWidoczna: wulkanyWidoczna(), kartaWulkanu: mks.wulk, warstwaWulkanow: mk && mk.wulk ? mk.wulk.stan() : null,
        legendaWulkanow: mk && mk.grupyWulk ? window.GeologiaWulkany.legenda(mk.grupyWulk, window.GeologiaWulkany.LITERATURA) : null,
        lektorMakiety: lm.stan, lektorMakietyPowod: lm.powod, lektorMakietyWers: lm.gra ? lm.gra.id : null, lektorMakietyZrodla: lm.lek ? lm.lek.zrodla() : 0,
        pejzaz: { gra: pj.wl, poziomy: pj.poziomy, ostatniStuk: pj.ostatniStuk, kontekst: pj.ctx ? pj.ctx.state : null,
          sygnal: pj.dz ? pj.dz.sygnal() : null, niedostepny: pj.niedostepny, trzaski: pj.dz ? pj.dz.trzaski() : null, wTle: !!pj.wTle },
        kamera: mk ? { poz: mk.sc.kamera.position.toArray(), cel: mk.ster ? mk.ster.target.toArray() : null,
          min: mk.ster ? mk.ster.minDistance : null, max: mk.ster ? mk.ster.maxDistance : null } : null };
    },
    // smoke (spec R4): ekspozycja jednej klatki kanwy bez nakładek (cel 320 px); { porownaj: true } → delta do poprzedniej
    pomiar: function (o) { return smoke && st.tryb === 'pokaz' && pokaz ? pokaz.pomiar(o) : null; },
    // hak sondy: scena pokazu (GeologiaScena) — null poza pokazem
    pokazScena: function () { return st.tryb === 'pokaz' && pokaz ? pokaz.scena() : null; },
    // smoke: skok do chwili filmu (rozdział, ułamek 0…1) i klatka od razu
    skok: function (rozdzial, ulamek) { return smoke && st.tryb === 'pokaz' && pokaz ? pokaz.skok(rozdzial, ulamek) : null; },
    diagnostyka: function () {
      if (!gl) return null;
      var m = gl.renderer.info.memory, pr = gl.renderer.info.programs;
      return { geometrie: m.geometries, tekstury: m.textures, programy: pr ? pr.length : 0, audio: pokaz ? pokaz.audio() : 0,
        audioMakiety: (lm.ctx ? 1 : 0) + (pj.ctx ? 1 : 0), zrodlaMakiety: lm.lek ? lm.lek.zrodla() : 0,
        // światło sceny makiety (Task 8e): pora presetu, az, el — to, co faktycznie świeci; pogoda ze stanu makiety
        swiatlo: mk ? (function (w) { return { pora: w.pora, az: w.az, el: w.el, pogoda: mks.pogoda, dostroj: !!w.dostroj }; })(mk.sc.stan().swiatlo) : null };
    },
    // Haki sondy (scripts/probe-geologia.mjs) — scena makiety, renderer, rzut kotwicy części na ekran (px w oknie).
    scena: function () { return mk ? mk.sc : null; },
    renderer: function () { return gl ? gl.renderer : null; },
    rzutKotwicy: function (id) {
      if (!mk) return null;
      var a = mk.sc.kotwica(id);
      if (!a) return null;
      mk.sc.kamera.updateMatrixWorld();
      var p = new T.Vector3().fromArray(a).project(mk.sc.kamera), r = ui.canvas.getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, z: p.z };
    },
    ustawKamere: function (poz, cel) { if (mk) { ustawKadr(poz, cel); mk.sc.animuj(0); } return !!mk; },
    przewyzszenie: function (x) { ustawPrzewyzszenie(x); return mks.przewCel; },
    // hak sondy (Task B1): materiał jak z przycisków grupy „Materiał”
    material: function (m) { return ustawMaterial(m); },
    // hak sondy (Task A2): smugi pasatu jak z przycisku „Wiatr”
    wiatr: function (wl) { return ustawWiatr(wl); },
    // hak sondy: przekrój jak z suwaka i przeciągania (karta przekroju odświeżona), bez przelotu kamery
    przekroj: function (p) { ustawPrzekroj(p, false); return mks.przekroj ? { kat_st: mks.przekroj.kat_st, przesuniecie_km: mks.przekroj.przesuniecie_km } : null; },
    // hak sondy: czas geologiczny jak z suwaka (G-D: znaczniki i kotwice z rzeźby chwili)
    czas: function (Ma) { ustawCzas(Ma); return mks.czas; },
    // hak sondy: animacja w kadrze ujęcia (jak &anim=…&f=…)
    animacja: function (nazwa, f) { return uruchomAnimacje(nazwa, f); },
    // haki sondy (Task 7b): warstwa turystyczna, widok kompasu, rzut pinu punktu na ekran (px w oknie)
    turystyka: function (wl) { ustawTurystyke(wl); return mks.turystyka; },
    // haki sondy (Task 8c): warstwa wulkanów, rzut pinu wulkanu na ekran (px w oknie)
    wulkany: function (wl) { ustawWulkany(wl); return mks.wulkany; },
    rzutWulkanu: function (id) {
      if (!mk || !mk.wulk) return null;
      var q = mk.wulk.rzutPinu(id), r = ui.canvas.getBoundingClientRect();
      return q ? { x: r.left + q.x, y: r.top + q.y, z: q.z } : null;
    },
    widok: function (nazwa, plynnie) { return ustawWidok(nazwa, !!plynnie); },
    // haki sondy (Task 8e): pora (null | 'teraz' | minuta dnia wyspy) i pogoda jak z przycisków / suwaka
    pora: function (v) { ustawPore(v); return mks.pora; },
    pogoda: function (p) { ustawPogode(p); return mks.pogoda; },
    // hak sondy (Task 8d): karta pinu jak po kliknięciu — 'czesc' | 'wulkan' (id pinu; warstwa Wulkany włączona) | 'punkt'
    karta: function (rodzaj, id) {
      if (!mk || st.tryb !== 'makieta') return false;
      if (rodzaj === 'czesc') pokazCzesc(id); else if (rodzaj === 'wulkan') pokazWulkan(id); else if (rodzaj === 'punkt') pokazTur('punkt', id);
      return true;
    },
    rzutPunktu: function (id) {
      if (!mk || !mk.tur) return null;
      var q = mk.tur.rzutPunktu(id), r = ui.canvas.getBoundingClientRect();
      return q ? { x: r.left + q.x, y: r.top + q.y, z: q.z } : null;
    },
    rzutTrasy: function (id, f) {
      if (!mk || !mk.tur) return null;
      var a = mk.tur.punktTrasy(id, f);
      if (!a) return null;
      mk.sc.kamera.updateMatrixWorld();
      var p = new T.Vector3().fromArray(a).project(mk.sc.kamera), r = ui.canvas.getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, z: p.z };
    }
  };
})();
