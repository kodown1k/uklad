'use strict';
/* Zakładka Geologia — widok nakładki (plik przeglądarkowy; ładuje go leniwie geologia/ladowanie.js).
   window.Geologia = { otworz(stan), zamknij(), stan(), diagnostyka(), (haki sondy) scena(), renderer(), rzutKotwicy(id),
     ustawKamere(poz, cel), przewyzszenie(x) }.
   stan() → { miejsce, tryb, rozdzial, ujecie, t, fps, jakosc: 'pelna'|'lekka', lektor: 'gra'|'cisza'|'brak', gotowa, rzezba,
     kolorowanie, przekroj, chmury, przewyzszenie, czesc, mity, pelnyEkran } (ujecie = id bieżącego ujęcia albo null — Task 8);
   diagnostyka() → { geometrie, tekstury, programy, audio }.
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
   Esc (G-E): pokaz → makieta tego miejsca; makieta → zamyka kartę trasy/punktu → kartę części/mitów → wychodzi z pełnego
   ekranu → Układ.
   Hak testowy: ?smoke&geologia=<miejsce>[&rozdzial=<id>|&makieta][&przekroj=<°>[&przesuniecie=<km>]][&geologiczna][&kontrola=biel|czern][&krzywe]
   [&czas=<Ma>][&anim=a1..a5&f=0..1] (animacja w stałym kadrze ujęcia z KADRY_ANIM, światło i woda ujęcia, bez znaczników)
   → stały kadr, marker `GEOLOGIA_READY <miejsce> <rozdzial|makieta>`; w smoke lektor i podkład nie startują (stan().lektor
   === 'cisza'), zmiany stanu są natychmiastowe. `&jakosc=pelna` = bez przejścia na lżejszą jakość (G-L); `&lod=lekki` =
   siatka terenu co drugą próbkę (jak na telefonie).
   `&krzywe` (tylko smoke): doładowuje mysliwce/kino.js i loguje `GEOLOGIA_KRZYWE ok|zle` (ruling G-C).
   `&warstwa=turystyka` = warstwa turystyczna przed markerem, `&widok=poludnie|polnoc|gora` = kadr z przycisków kompasu.
   Tekst z danych trafia do DOM wyłącznie przez textContent. Błędy własne: prefiks „Geologia: ”,
   ostrzeżenia nie będące błędem: „Geologia/uwaga: ”. */
(function () {
  var T = window.THREE, L = window.GeologiaLadowanie, M = window.GeologiaMiejsca, S = window.GeologiaScena, Teren = window.Teren;
  var TS = window.GeologiaTurystykaScena;
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
  var PRZEWYZSZENIA = [1, 1.5, 3];
  var RODZAJE_PUNKTOW = { hotel: 'hotel', baza: 'baza', przystanek: 'przystanek', start: 'początek trasy', cel: 'cel trasy',
    atrakcja: 'atrakcja', plaza: 'plaża', latarnia: 'latarnia', 'punkt-widokowy': 'punkt widokowy' };
  var NAZWY_WIDOKOW = { poludnie: 'Z południa', polnoc: 'Z północy', gora: 'Z góry' };
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
    turystyka: false, tur: null, widok: null, azymut: null };
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
    var gp = grupa('Przekrój');
    ui.bPrzekroj = guzik(gp, 'Przekrój', 'Przekrój przez wyspę — przeciągnij ścianę, by go przesunąć');
    ui.kat = el('label', 'ge-kat', null, gp); ui.kat.hidden = true;
    ui.katSuwak = el('input', 'ge-suwak', null, ui.kat);
    ui.katSuwak.type = 'range'; ui.katSuwak.min = '0'; ui.katSuwak.max = '179'; ui.katSuwak.step = '1'; ui.katSuwak.value = '90';
    ui.katSuwak.title = 'Kierunek linii przekroju: 0° = północ–południe, 90° = zachód–wschód';
    ui.katTekst = el('output', 'ge-kat-wart', '90°', ui.kat);
    ui.bChmury = guzik(grupa('Chmury'), 'Morze chmur', 'Warstwa chmur pasatowych na wysokości ok. 1,5 km');
    ui.bTurystyka = guzik(grupa('Warstwy'), 'Turystyka', 'Warstwa turystyczna: szlaki z planu wyjazdu, Hard Rock Hotel, plan dni', 'ge-guzik-tur');
    var gw = grupa('Przewyższenie');
    ui.bPrzew = PRZEWYZSZENIA.map(function (x) { var b = guzik(gw, '×' + liczba(x, 1), 'Przewyższenie pionowe ×' + liczba(x, 1)); b.dataset.przew = String(x); return b; });
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
      if (wl && waskiEkran()) { zamknijTur(); if (!ui.kCzesc.hidden) zamknijCzesc(); }
      rozwinPlan(wl);
    });
    ui.planLista = el('ol', 'ge-plan-lista', null, ui.plan);
    ui.komunikat = el('div', 'ge-komunikat', null, korzen); ui.komunikat.setAttribute('role', 'status'); ui.komunikat.hidden = true;

    ui.bTeren.addEventListener('click', function () { ustawKolorowanie('teren'); });
    ui.bGeologia.addEventListener('click', function () { ustawKolorowanie('geologia'); });
    ui.bPrzekroj.addEventListener('click', function () { ustawPrzekroj(mks.przekroj ? null : { kat_st: +ui.katSuwak.value, przesuniecie_km: 0 }, true); });
    ui.katSuwak.addEventListener('input', function () { if (mks.przekroj) ustawPrzekroj({ kat_st: +ui.katSuwak.value, przesuniecie_km: mks.przekroj.przesuniecie_km }, false); });
    ui.bChmury.addEventListener('click', function () { ustawChmury(!mks.chmury); });
    ui.bPrzew.forEach(function (b) { b.addEventListener('click', function () { ustawPrzewyzszenie(+b.dataset.przew); }); });
    ui.bMity.addEventListener('click', function () { if (mks.mity) zamknijMity(); else pokazMity(); });
    ui.bPelny.addEventListener('click', pelnyEkran);
    ui.bZamknij.addEventListener('click', function () { window.Zakladki.zamknijDoUkladu(); });
    ui.kCzescX.addEventListener('click', zamknijCzesc);
    ui.kMityX.addEventListener('click', zamknijMity);
    ui.kTurX.addEventListener('click', zamknijTur);
    ui.bTurystyka.addEventListener('click', function () { ustawTurystyke(!mks.turystyka); });
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
    ui.bPrzekroj.setAttribute('aria-pressed', String(!!mks.przekroj));
    ui.kat.hidden = !mks.przekroj;
    ui.bChmury.setAttribute('aria-pressed', String(mks.chmury));
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
    ui.czas.hidden = tur;                       // warstwa liczona z dzisiejszej rzeźby — w trybie turystycznym bez suwaka czasu
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
    var otwarta = !ui.kCzesc.hidden || !ui.kMity.hidden || !ui.kPrzekroj.hidden || !ui.kTur.hidden;
    var off = otwarta && gl.w >= 900 ? (ui.karty.offsetWidth + 14) / 2 : 0, k = mk.sc.kamera;
    // panel „Plan dni” (lewa kolumna na szerokim ekranie) przesuwa środek w prawo o połowę swojej szerokości
    if (gl.w >= 900 && !ui.plan.hidden && ui.plan.dataset.zwiniety !== 'true') off -= (ui.plan.offsetWidth + 14) / 2;
    // wąski ekran: pasek (kilka wierszy) zasłania górę — środek kadru w dół o połowę jego wysokości; karta jest dolną
    // szufladą — środek w górę o połowę jej wysokości
    var offY = 0;
    if (gl.w <= 700) {
      var p = $('gePasek');
      var szuflada = otwarta ? Math.min(ui.karty.offsetHeight, gl.h * 0.5) : planRozwiniety() ? ui.plan.offsetHeight : 0;
      offY = szuflada / 2 - (p ? p.offsetHeight : 0) / 2;
    }
    if (Math.abs(off) > 0.5 || Math.abs(offY) > 0.5) k.setViewOffset(gl.w, gl.h, off, offY, gl.w, gl.h); else k.clearViewOffset();
    k.updateProjectionMatrix();
  }
  function adres() {
    if (smoke) return;
    var h = '#geologia=' + st.miejsce + (st.tryb === 'makieta' ? '&tryb=makieta' + (mks.turystyka ? '&warstwa=turystyka' : '') : '&rozdzial=' + st.rozdzial);
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
    if (gotowosc && (st.tryb === 'makieta' ? mk : pokaz && pokaz.gotowy())) { console.log('GEOLOGIA_READY ' + gotowosc); gotowosc = null; }
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
      dane: window.GeologiaTeneryfa || {}, lod: lod(), przewyzszenie: mks.przew });
    mk = { sc: sc, ster: null, rz: rz, maxDyst: 500, lot: null };
    sc.kamera.aspect = (gl.w || 16) / (gl.h || 9); sc.kamera.updateProjectionMatrix();
    sc.kolorowanie(mks.kolorowanie);
    sc.chmury(mks.chmury);
    if (T.OrbitControls) utworzSterowanie(); else console.warn('Geologia/uwaga: brak OrbitControls — makieta bez obracania kamerą');
    zwinPasek(mks.turystyka && waskiEkran());     // stan paska ze stanu warstwy przy każdym wejściu, zanim policzymy kadr
    odswiezNarzedzia();                 // układ nakładek (pasek z ostrzeżeniem, plan, przesunięcie kadru) przed dopasowaniem kadru
    var k0 = kadrStartowy(); ustawKadr(k0.poz, k0.cel); mk.kadrAuto = 'start';
    if (mks.przekroj) ustawPrzekroj(mks.przekroj, true);
    komunikat('');
    // stany haka smoke: natychmiast, przed markerem
    if (mks.czas > 0) sc.czas(mks.czas);
    if (smoke) {
      if (zap.geologiczna) ustawKolorowanie('geologia');
      if (zap.przekroj != null) ustawPrzekroj({ kat_st: zap.przekroj, przesuniecie_km: zap.przesuniecie || 0 }, true);
      if (zap.czas != null) ustawCzas(zap.czas);
      if (zap.anim) uruchomAnimacje(zap.anim, zap.f);
      if (zap.widok) ustawWidok(zap.widok, false);
    }
    if (mks.turystyka) ustawTurystyke(true);
    odswiezNarzedzia();
    if (smoke) gotowosc = st.miejsce + ' makieta';
  }
  function zwolnijMakiete() {
    budowa++;
    if (!mk) return;
    if (mk.ster) mk.ster.dispose();
    if (mk.anim) mk.anim.zwolnij();
    mk.sc.zwolnij();                    // zwalnia też zasoby warstwy turystycznej (z() sceny)
    mk = null;
    gl.renderer.renderLists.dispose();
    mks.czesc = null; mks.hover = null; mks.tur = null; mks.widok = null; mks.azymut = null;
    if (ui) { ui.kCzesc.hidden = true; ui.kPrzekroj.hidden = true; ui.kTur.hidden = true; }
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
      var tu = trafienieTur(wskaznik.x, wskaznik.y), id = tu ? null : trafienie(wskaznik.x, wskaznik.y);
      if (id !== mks.hover) { mks.hover = id; sc.najedz(id); }
      ui.canvas.style.cursor = id || tu ? 'pointer' : (mks.przekroj && trafiaSciane(wskaznik.x, wskaznik.y) ? 'ns-resize' : '');
    }
  }
  function ograniczonyRuch() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* ---------- przełączniki ---------- */
  function ustawKolorowanie(tryb) {
    mks.kolorowanie = tryb === 'geologia' ? 'geologia' : 'teren';
    if (mk) mk.sc.kolorowanie(mks.kolorowanie);
    odswiezNarzedzia();
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
  function ustawChmury(wl) { mks.chmury = !!wl; if (mk) mk.sc.chmury(mks.chmury); odswiezNarzedzia(); }
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
    var w = turystykaWidoczna();
    if (ui && ui.plan.hidden === w) {
      ui.plan.hidden = !w;
      ui.makieta.classList.toggle('ge-tryb-tur', w);
      przesunKadr();
    }
    if (!mk) return;
    if (mk.tur) mk.tur.widoczna(w);
    mk.sc.przygasCzesci(mks.turystyka && w ? 0.4 : 1);
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
    if (ui && waskiEkran()) zwinPasek(mks.turystyka && st.tryb === 'makieta');
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
    var t = ui.kTurT, x;
    if (typ === 'trasa') {
      x = D.trasy.filter(function (q) { return q.id === id; })[0];
      if (!x) return;
      zamknijCzesc(); zamknijMity(true);
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
      zrodlo(t, 'linia: ' + x.liniaZrodlo + '; opis: ' + D.zrodlo);
    } else {
      x = D.punkty.filter(function (q) { return q.id === id; })[0];
      if (!x) return;
      zamknijCzesc(); zamknijMity(true);
      t.replaceChildren();
      el('p', 'ge-karta-rodzaj', 'Punkt · ' + (RODZAJE_PUNKTOW[x.rodzaj] || x.rodzaj), t);
      el('h3', 'ge-karta-nazwa', x.nazwa, t);
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
    ui.kTur.dataset.typ = typ; ui.kTur.dataset.id = id;
    ui.kTur.hidden = false; ui.kTur.scrollTop = 0;
    if (mk && mk.tur) mk.tur.wybierz(typ, id);
    przesunKadr();
  }
  function zamknijTur() {
    mks.tur = null;
    if (!ui) return;
    ui.kTur.hidden = true; delete ui.kTur.dataset.typ; delete ui.kTur.dataset.id;
    if (mk && mk.tur) mk.tur.wybierz(null, null);
    przesunKadr();
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
    if (waskiEkran() && ui.plan.dataset.zwiniety === 'false') rozwinPlan(false);
    mks.czesc = id;
    var t = ui.kCzescT;
    t.replaceChildren();
    el('p', 'ge-karta-rodzaj', 'Część · ' + (RODZAJE[c.rodzaj] || c.rodzaj), t);
    el('h3', 'ge-karta-nazwa', c.nazwa, t);
    if (c.wys_m != null) el('p', 'ge-karta-wys', liczba(c.wys_m) + ' m n.p.m.', t);
    znaczekPewnosci(t, c.pewnosc);
    el('p', 'ge-akapit', c.opis, t);
    zrodlo(t, c.zrodlo);
    ui.kCzesc.dataset.czesc = id;
    ui.kCzesc.hidden = false;
    if (mk) mk.sc.podswietl(id);
    przesunKadr();
  }
  function zamknijCzesc() {
    mks.czesc = null; ui.kCzesc.hidden = true; delete ui.kCzesc.dataset.czesc;
    if (mk) mk.sc.podswietl(null);
    przesunKadr();
  }
  function pokazMity() {
    var D = window.GeologiaTeneryfa;
    zamknijCzesc();
    zamknijTur(true);
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
    if (!ui.kTur.hidden) zamknijTur();
    else if (!ui.kCzesc.hidden) zamknijCzesc();
    else if (mks.mity) zamknijMity();
    else if (planRozwiniety()) rozwinPlan(false);         // rozwinięty „Plan dni” to ogniwo łańcucha G-E (każda szerokość)
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
    else if (st.tryb === 'pokaz' && pokaz && !natywny && pokaz.klawisz(k)) e.preventDefault();
  }, true);
  window.addEventListener('keyup', function (e) { if (aktywny) e.stopPropagation(); }, true);

  /* ---------- wskazywanie: klik w znacznik → karta; przeciąganie ściany przekroju ---------- */
  function ndc(x, y) {
    var r = ui.canvas.getBoundingClientRect();
    if (!(r.width > 0)) return null;
    return [(x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1];
  }
  function trafienie(x, y) { var n = ndc(x, y); return n && mk ? mk.sc.pick(n[0], n[1]) : null; }
  function trafienieTur(x, y) { var n = ndc(x, y); return n && mk && mk.tur && turystykaWidoczna() ? mk.tur.pick(n[0], n[1]) : null; }
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
    ui.canvas.addEventListener('pointerleave', function () { wskaznik = null; if (mk) { mks.hover = null; mk.sc.najedz(null); } ui.canvas.style.cursor = ''; });
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
      // warstwa turystyczna ma pierwszeństwo przed znacznikami części (te są w niej przygaszone)
      var tu = trafienieTur(e.clientX, e.clientY);
      if (tu) { pokazTur(tu.typ, tu.id); return; }
      var id = trafienie(e.clientX, e.clientY);
      if (id) pokazCzesc(id);
      else { if (!ui.kCzesc.hidden) zamknijCzesc(); if (!ui.kTur.hidden) zamknijTur(); }
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
      zmianaRozdzialu: function (id) { if (st.tryb !== 'pokaz' || st.rozdzial === id) return; st.rozdzial = id; odswiezUI(); adres(); } });
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
    if (pokaz && tryb !== 'pokaz') pokaz.wyjdz();
    st.miejsce = miejsce; st.tryb = tryb; st.rozdzial = rozdzial; st.ujecie = null; st.t = zap.t;
    if (tryb === 'makieta' && s.warstwa === 'turystyka') { mks.turystyka = true; if (mk) ustawTurystyke(true); }
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
    if (tryb === 'makieta') wejdzMakieta();
    else { komunikat(''); utworzPokaz().wejdz(miejsce, rozdzial); gl.w = 0; dopasuj(); }
    if (!rafId) rafId = requestAnimationFrame(krok);
    if (!smoke) korzen.focus({ preventScroll: true });
    return true;
  }
  function zamknij() {
    aktywny = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    gotowosc = null;
    if (doc.fullscreenElement === korzen) { try { doc.exitFullscreen(); } catch (_) { /* nic */ } }
    if (ui) { zamknijCzesc(); zamknijMity(true); zamknijTur(true); ui.canvas.style.cursor = ''; }
    wskaznik = null; nacisk = null; ciag = null;
    if (gl) zwolnijMakiete();
    if (pokaz) pokaz.wyjdz();
    if (ui) zwinPasek(false);           // zwinięcie wynika ze stanu warstwy — przy wyjściu z zakładki zdejmowane
    mks.przekroj = null; mks.chmury = false; mks.kolorowanie = 'teren'; mks.przew = mks.przewCel = 1.5; mks.czas = 0; mks.anim = null;
    mks.turystyka = false; mks.tur = null; mks.widok = null; mks.azymut = null;
    if (ui) { ui.czasSuwak.value = '1000'; pokazCzas(0, false); }
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
        jakosc: jakosc, lektor: smoke ? 'cisza' : 'brak', gotowa: st.tryb === 'pokaz' ? !!(pokaz && pokaz.gotowy()) : !!mk, pokaz: ps,
        rzezba: rz ? { hMax: rz.hMax, hMin: rz.hMin, hMaxJson: rz.meta.hMax, hMinJson: rz.meta.hMin } : null,
        kolorowanie: mks.kolorowanie, przekroj: mks.przekroj ? { kat_st: mks.przekroj.kat_st, przesuniecie_km: mks.przekroj.przesuniecie_km,
          maks_m: mks.przekroj.profil ? mks.przekroj.profil.maks_m : null } : null,
        chmury: mks.chmury, przewyzszenie: mks.przew, przewyzszenieCel: mks.przewCel, czesc: mks.czesc, mity: mks.mity,
        przelot: !!(mk && mk.lot), pelnyEkran: doc.fullscreenElement === korzen, scena: mk ? mk.sc.stan() : null,
        czas: mks.czas, anim: mks.anim ? { nazwa: mks.anim.nazwa, f: mks.anim.f } : null,
        czasTekst: ui ? ui.czasWart.textContent : null, rekonstrukcja: ui ? !ui.czasPlak.hidden : false,
        turystyka: mks.turystyka, turystykaWidoczna: turystykaWidoczna(), kartaTur: mks.tur ? { typ: mks.tur.typ, id: mks.tur.id } : null,
        warstwa: mk && mk.tur ? mk.tur.stan() : null, widok: mks.widok, kompas: { azymut: mks.azymut },
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
      return { geometrie: m.geometries, tekstury: m.textures, programy: pr ? pr.length : 0, audio: 0 };
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
    // hak sondy: przekrój jak z suwaka i przeciągania (karta przekroju odświeżona), bez przelotu kamery
    przekroj: function (p) { ustawPrzekroj(p, false); return mks.przekroj ? { kat_st: mks.przekroj.kat_st, przesuniecie_km: mks.przekroj.przesuniecie_km } : null; },
    // hak sondy: czas geologiczny jak z suwaka (G-D: znaczniki i kotwice z rzeźby chwili)
    czas: function (Ma) { ustawCzas(Ma); return mks.czas; },
    // hak sondy: animacja w kadrze ujęcia (jak &anim=…&f=…)
    animacja: function (nazwa, f) { return uruchomAnimacje(nazwa, f); },
    // haki sondy (Task 7b): warstwa turystyczna, widok kompasu, rzut pinu punktu na ekran (px w oknie)
    turystyka: function (wl) { ustawTurystyke(wl); return mks.turystyka; },
    widok: function (nazwa, plynnie) { return ustawWidok(nazwa, !!plynnie); },
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
