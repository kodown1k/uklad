'use strict';
/* Zakładka Geologia → Teneryfa — opowieść: scenopis filmów (spec R9) jako dane i wersy lektora w głosie Bajarza.
   Czyste dane, bez DOM/THREE; dual-export: przeglądarka window.GeologiaOpowiesc. Ładowany po dane.js (miejsca.js).
   Kolejność pracy jak w filmie: najpierw ujęcia (R9), potem wersy
   wpisane w ujęcia, w ich budżecie znaków (tempo lektora 12,1 zn./s, lektor ≤ ok. 75% czasu = 9 zn. na sekundę celu).
   Zasady treści: każda liczba z dane.js (test); pora doby 1706 tylko z erupcje[1706].przebieg (UCZ-2); w 1706 stawką
   jest port i miasto, nikt w Garachico nie zginął; spór badaczy nazwany wprost.
   Jedno źródło: wers jest zapisany w swoim ujęciu (`w`), a `id`, `scena` i `zdarzenia` (przypięte do wersu) wylicza
   budowa() niżej — dopisanie wersu nie wymaga numerowania ręcznie.
   Wymowa: `wymowa` = tekst dla syntezatora (napis pokazuje `tekst`). Liczby słownie piszemy ręcznie (przypadek),
   nazwy hiszpańskie zamienia fonetyka() wg FONETYKA — nowa trudna nazwa = nowy wpis w FONETYKA.
   Kamera (Task 8, czyta ją geologia/rozdzialy.js): `kamera: [klucz, …]`, klucz = { u: 0..1 ujęcia | kiedy: '<zdarzenie
   ujęcia>' (+ po_s), cel: '<część>' | [lon, lat] | { czesc | lonLat | tor: '<id w dane.tory>', f, dx, dz [km, +x wschód, +z południe],
   hc | dh [km] } | { ziemia: true, dx, dz }, wzgledem?: cel kotwicy stanowiska (domyślnie cel), az [° stanowiska widziany
   z kotwicy, 0 = N], d [km poziomo], h [km n.p.m., rzeczywiste] | nad [km nad celem], fov [° pion przy 2.39],
   wstrzas?, luk? (cel po łuku: aimArc), krzywa? ('dojazd' | 'cruise' — odcinek do tego klucza), stop? }. Brakujące pola
   klucza = poprzedni klucz; ujęcie z wejściem D/P zaczyna się tam, gdzie skończyło poprzednie (klucz u = 0 pomijany).
   `obiekt.hc` [km] = wysokość obiektu głównego wewnątrz przekroju (bez niego: teren w punkcie części).
   Odstępstwa kadrów od R9 (wstawki ~2× szersze: ruling T3; ciągłość szwów D; horyzont SKA-3) — raport Task 8a.
   Lektor na pinach makiety (Task 8d): wersPinu(rodzaj, pin) — które piny mówią i czym (część: jej wers; wulkan z opisem: opis;
   punkt turystyki: wers części z pola `czesc`); wersyPinow() — wersy wszystkich mówiących pinów; wszystkieNagrania() =
   wszystkieWersy() + wersy pinów spoza niej — lista generatora i odsłuchu lektora (scripts/gen-lektor.mjs). */
(function (root) {
  var ROZDZIALY = ['polozenie', 'geografia', 'budowa', 'powstanie', 'historia', 'przekroj', 'czesci', 'mity', 'dzis'];

  // Spec R8: cel [s] rozdziału; budżet znaków lektora = 9 zn. na sekundę celu.
  var CEL_S = { polozenie: 85, geografia: 95, budowa: 80, powstanie: 105, historia: 135, przekroj: 75, czesci: 105, mity: 95, dzis: 95 };
  var ZNAKI_NA_SEKUNDE = 9;
  var BUDZET = {};
  ROZDZIALY.forEach(function (r) { BUDZET[r] = { cel_s: CEL_S[r], znaki: ZNAKI_NA_SEKUNDE * CEL_S[r] }; });

  // Tytuł rozdziału jako napis na pierwszym ujęciu (pole T-L, 3 s; spec R5) — tytuł filmowy, nie etykieta nawigacji.
  var ROZDZIALY_TYTULY = {
    polozenie: 'Okruch na Atlantyku', geografia: 'Dwa nieba', budowa: 'Z czego jest wyspa', powstanie: 'Z dna oceanu',
    historia: 'Blizny i ogień', przekroj: 'Wnętrze', czesci: 'Dookoła wyspy', mity: 'Fakty i mity', dzis: 'Wyspa dziś'
  };

  // ───────────── wymowa ─────────────
  // Nazwy, które XTTS czyta po swojemu (lista z planu); każda ma wpis w FONETYKA.
  var TRUDNE_NAZWY = ['Güímar', 'Icod', 'Cañadas', 'Garachico', 'Caletón', 'Gigantes', 'Guayota', 'Echeyde', 'Teide'];
  // Zapis dla polskiego czytelnika. Klucz pasuje od początku słowa, końcówka odmiany zostaje (Güímaru → Głimaru).
  // Wielowyrazowe przed jednowyrazowymi.
  var FONETYKA = {
    'Pico Viejo': 'Piko Bjecho', 'Pedro Gil': 'Pedro Chil', 'Boca Cangrejo': 'Boka Kangrecho',
    'Güímar': 'Głimar', 'Icod': 'Ikod', 'Cañadas': 'Kaniadas', 'Garachico': 'Garacziko', 'Caletón': 'Kaleton',
    'Gigantes': 'Chigantes', 'Guayota': 'Głajota', 'Echeyde': 'Eczejde', 'Teide': 'Tejde',
    'Orotava': 'Orotawa', 'Montaña': 'Montania', 'Roja': 'Rocha', 'Roque': 'Roke', 'Conde': 'Konde', 'García': 'Garsija',
    'Cinchado': 'Sinczado', 'Blanca': 'Blanka', 'Chinyero': 'Czinjero', 'Cueva': 'Kueba', 'Viento': 'Bjento',
    'Malpaís': 'Malpais', 'Igueste': 'Igeste', 'Barranco': 'Barranko', 'Infierno': 'Infjerno', 'Reventada': 'Rebentada',
    'Benijo': 'Beniho', 'Narices': 'Narises', 'Masca': 'Maska', 'UNESCO': 'Unesko', 'arrugadas': 'arugadas', 'mojo': 'moho'
  };
  var KLUCZE = Object.keys(FONETYKA);
  function wzorzec(k) { return new RegExp('(^|[^\\p{L}])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gu'); }
  var WZORCE = KLUCZE.map(function (k) { return [wzorzec(k), FONETYKA[k]]; });
  function fonetyka(s) {
    return WZORCE.reduce(function (t, p) { return t.replace(p[0], '$1' + p[1]); }, String(s));
  }
  function maNazwe(s) { return WZORCE.some(function (p) { p[0].lastIndex = 0; var r = p[0].test(s); p[0].lastIndex = 0; return r; }); }

  // ───────────── klocki scenopisu ─────────────
  function sw(pora, az, el) { return { pora: pora, az: az, el: el }; }
  // Wers w ujęciu: w(tekst, { wymowa, czesc, zd: [[po_s, co], …] }).
  // `czas` = id zdarzenia osCzasu, o którego wieku mówi wers (licznik A1 w oknie wersu leży w jego przedzialMa — test)
  // `czasOd: true` — wers mówi „od tego czasu” (licznik ≤ górna granica przedziału, nie w samym przedziale)
  function w(tekst, o) { o = o || {}; return { id: o.id, tekst: tekst, wymowa: o.wymowa, czesc: o.czesc, czas: o.czas, czasOd: o.czasOd, zd: o.zd || [] }; }
  // Ujęcie: u(nazwa, pola, wersy). Domyślnie woda realna, krajobraz, bez plakietki.
  function u(nazwa, p, wersy) {
    var o = { nazwa: nazwa, typ: p.typ, poziom: p.poziom, wejscie: p.wejscie, znaki: p.znaki, cel_s: p.cel_s };
    if (p.oddechPo_s !== undefined) o.oddechPo_s = p.oddechPo_s;
    if (p.zawieszeniePo_s !== undefined) o.zawieszeniePo_s = p.zawieszeniePo_s;   // cisza przed cięciem (R9.8), nie oddech
    o.obiekt = p.obiekt;
    o.swiatlo = p.swiatlo;
    o.woda = p.woda || 'realna';
    o.kolorowanie = p.kolorowanie || 'krajobraz';
    o.plakietka = p.plakietka || null;
    if (p.animacja) o.animacja = { nazwa: p.animacja[0], od: p.animacja[1], do: p.animacja[2] };
    if (p.animacjaPoWersie) o.animacjaPoWersie = true;   // animacja rusza po ostatnim wersie ujęcia (do tego chwila stoi na `od`)
    // klucze animacji przypięte do zdarzeń ujęcia: [[zdarzenie, po_s, f], …] — f animacji odcinkami liniowo między kluczami
    // (zdarzenie oznacza STAN obrazu w chwili słowa, nie start animacji rozłożonej na całe ujęcie — recenzja kinowa r1, C2)
    if (p.animacjaKlucze) o.animacjaKlucze = p.animacjaKlucze;
    if (p.lawaStygnie) o.lawaStygnie = p.lawaStygnie;    // A2: 0…1 — lawa ostygła (emisja skorupy ≤ 0,15, bez łuny i dymu)
    if (p.gestosc) o.gestosc = p.gestosc;                // wyjątek SKA-1: najmniejsza liczba komórek w wysokości kadru (dom. 45)
    if (p.czasMa) o.czasMa = p.czasMa;                   // stała chwila geologiczna ujęcia [mln lat] (bez a1)
    if (p.przewyzszenie) o.przewyzszenie = p.przewyzszenie; // [{ u, e }] — rampa przewyższenia w ujęciu (R2)
    if (p.przekroj) o.przekroj = p.przekroj;             // { czesc, kat_st, start } — płaszczyzna przekroju (R9.6)
    if (p.etykiety) o.etykiety = p.etykiety;
    // etykiety miejsc spoza części (cała wyspa, ląd sąsiedni): { nazwa, lonLat, odleglosc?: { fakt, liczba } } — liczba
    // odległości z dane.fakty[].liczby (nie z tego pliku)
    if (p.etykietyMiejsc) o.etykietyMiejsc = p.etykietyMiejsc;
    // etykiety od zdarzenia wersu: [{ kiedy: '<zdarzenie>', nazwa, czesc }] — napis spoza nazwy części (decyzja P9)
    if (p.etykietyOd) o.etykietyOd = p.etykietyOd;
    if (p.dzwiekFumarol) o.dzwiekFumarol = true;          // dźwięk: syk fumaroli pod ujęciem (P9)
    if (p.podpis) o.podpis = p.podpis;                   // dopisek pola G-L pod plakietką (R4: „barwy: model…”)
    if (p.osTelefonu) o.osTelefonu = p.osTelefonu;       // 'cel': na telefonie oś zostaje na celu kluczy (nie ku obiektowi)
    if (p.ekspozycja) o.ekspozycja = p.ekspozycja;       // mnożnik ekspozycji ujęcia (dopasowanie przez cięcie, R4 EKS-6)
    o._wersy = wersy || [];
    return o;
  }
  var TEIDE_WYSPA = { czesc: 'teide', promien_km: 40, promienPion_km: 28 };
  // P3 (R9.1: „przy prawej krawędzi »Afryka« z odległością z danych”): środek wyspy (F1.1) i brzeg Afryki naprzeciw
  // Kanarów (przylądek Juby) — punkty etykiet, nie dane geologiczne
  var SRODEK_WYSPY_ETYKIETA = [-16.60556, 28.26861], AFRYKA_BRZEG = [-12.9, 27.95];   // cała wyspa; pion: rdzeń wyspy (R9.1)
  var NOC_1706 = sw('z-danych', 65, -12);       // przebieg: „ok. godzinę przed świtem” = noc; słońce pod horyzontem na E
  // H9–H10: przebieg ma porę 'nieznana' (lektor pory nie nazywa); decyzja właściciela 23.11 (recenzja kinowa r1, P8/C1):
  // cała kulminacja nocą — noc przed świtem ciągnie się od H8, słońce rośnie ku świtowi po tej samej (wschodniej) stronie
  // (|Δel| ≤ 6° na cięciu K), bez mnożnika ekspozycji; kadr oświetla lawa (łuna w shaderze terenu)
  var NOC_1706_H9 = sw('z-danych', 66, -10), NOC_1706_H10 = sw('z-danych', 68, -7);
  var STUDIO = sw('studio', 135, 40);
  var NEUTRALNE = sw('dzien', 220, 35);

  // Wymowa wersów części z dane.js (film R9.7 i karta makiety) — ręczna tylko dla wersów z cyframi; `tekst` = bieżący tekst w dane.js
  // (test pada, gdy dane.js zmieni wers, a wymowa zostanie stara). Nazwy podmienia fonetyka().
  var WYMOWA_CZESCI = {
    teide: { tekst: 'Teide — 3718 metrów. Patrzysz na najwyższą górę Hiszpanii, wyrosłą z kaldery zniszczonego wulkanu.',
      wymowa: 'Teide — trzy tysiące siedemset osiemnaście metrów. Patrzysz na najwyższą górę Hiszpanii, wyrosłą z kaldery zniszczonego wulkanu.' },
    garachico: { tekst: 'Garachico: port, który w maju 1706 roku zalała lawa.',
      wymowa: 'Garachico: port, który w maju tysiąc siedemset szóstego roku zalała lawa.' },
    'montana-negra': { tekst: 'Arenas Negras — stąd w 1706 roku ruszyła lawa na Garachico.',
      wymowa: 'Arenas Negras — stąd w tysiąc siedemset szóstym roku ruszyła lawa na Garachico.' },
    chinyero: { tekst: 'Chinyero: ostatni wulkan, który obudził się na Teneryfie — w 1909 roku.',
      wymowa: 'Chinyero: ostatni wulkan, który obudził się na Teneryfie — w tysiąc dziewięćset dziewiątym roku.' },
    'pedro-gil': { tekst: 'Pedro Gil: tu zaczęła się dolina Güímar i tu w 1705 roku znów popłynęła lawa.',
      wymowa: 'Pedro Gil: tu zaczęła się dolina Güímar i tu w tysiąc siedemset piątym roku znów popłynęła lawa.' }
  };

  function animacje() { return root.Animacje || (typeof require === 'function' ? require('../animacje.js') : null); }
  // Okna A1 W4–W7 z wieku zdarzeń w danych (oś A1: Animacje.fA1 — f, przy którym licznik dochodzi do danego wieku)
  function oknaA1() {
    var D = daneTeneryfy(), An = animacje(), oc = function (id) { return D.osCzasu.filter(function (x) { return x.id === id; })[0]; };
    var wyn = oc('oc-wynurzenie'), anaga = oc('oc-anaga');
    // postój licznika na wynurzeniu: od dojścia do 11,9 do końca postoju (f osi A1)
    var poczatekPostoju = An.fA1(D, wyn.Ma), koniecPostoju = An.fA1(D, wyn.Ma - 1e-6);
    return {
      // W4: oś od M0 (górna granica „ok. 12 mln lat”) do wynurzenia — tarcza centralna rośnie pod wodą ku tafli
      dno: [0, poczatekPostoju],
      // W5: licznik stoi na 11,9 przez wers (animacja rusza po wersie — `animacjaPoWersie`), tuż przed końcem postoju;
      // po wersie postój się kończy, szczyt przebija taflę (ewolucja.js: przebicie w Ma zdarzenia), tarcza rośnie (do doMa
      // tarczy centralnej) i stoi do początku Teno — W5 kończy się tam, gdzie zaczyna się W6 (cięcie K bez skoku licznika)
      wynurzenie: [koniecPostoju - 1e-4 * (koniecPostoju - poczatekPostoju), An.fA1(D, oc('oc-teno').Ma)],
      // W6: Teno i Anaga — od początku Teno do końca przedziału Anagi
      trzyTarcze: [An.fA1(D, oc('oc-teno').Ma), An.fA1(D, Math.min.apply(null, anaga.przedzialMa))],
      zrost: [An.fA1(D, Math.min.apply(null, anaga.przedzialMa)), 0.95]
    };
  }
  var A1 = oknaA1();
  // wierzchołek tarczy centralnej: pierwsza komórka, która przebija taflę (rzeźba chwili z ewolucja.js, z mieszaniem na pasie
  // granicy — najwyższa komórka jednostki, 1347 m, leży w pasie z gmachem i wychodzi później; ta ma 1161 m). Źródło:
  // Ewolucja.parametry → wynLad (para A1 w animacje.js czyta je wprost); test pilnuje, że stała i cele kluczy W5 = wynLad
  var RDC_SZCZYT = [-16.71022, 28.15189];
  function daneTeneryfy() {
    if (root.GeologiaTeneryfa) return root.GeologiaTeneryfa;
    if (typeof require === 'function') return require('./dane.js');
    return null;
  }
  function czescDanych(id) {
    var D = daneTeneryfy(), c = D && D.czesci.filter(function (x) { return x.id === id; })[0];
    if (!c) throw new Error('GeologiaOpowiesc: brak części ' + id + ' w GeologiaTeneryfa (dane.js ładuje się przed opowiesc.js)');
    return c;
  }
  // Wers części jako wers opowieści: id, tekst i wymowa z jednego miejsca.
  function wersCzesci(c) {
    var recznie = WYMOWA_CZESCI[c.id];
    return w(c.wers.tekst, { id: c.wers.id, czesc: c.id, wymowa: recznie && recznie.tekst === c.wers.tekst ? recznie.wymowa : undefined });
  }

  // ───────────── SCENOPIS + WERSY ─────────────
  var S = {};

  // R9.1 — późne popołudnie → złota godzina (az 265–280°, el 22° → 12°).
  S.polozenie = [
    u('zimny-start', { typ: 'statyw', poziom: 'wstawka:garachico', wejscie: 'C', znaki: 90, cel_s: 14,
      obiekt: { czesc: 'garachico', promien_km: 0.75 }, swiatlo: NOC_1706, plakietka: 'rekonstrukcja', animacja: ['a2', 0, 0.08] }, [
      w('Całą noc ziemia drży pod Garachico. Miasto czeka.'),
      w('Ciemno. Wysoko na grzbiecie — huk.', { zd: [[1.2, 'rozzarzenie']] })
    ]),
    u('tytul', { typ: 'plansza', poziom: 'glob', wejscie: 'K', znaki: 0, cel_s: 3.5, obiekt: { promien_km: 0 }, swiatlo: STUDIO }),
    u('glob', { typ: 'dojazd', poziom: 'glob', wejscie: 'C', znaki: 150, cel_s: 16,
      obiekt: { czesc: 'teide', promien_km: 6371 }, swiatlo: sw('dzien', 265, 22) }, [
      w('Ta noc jeszcze wróci. Teraz spadasz z orbity, prosto na Atlantyk.'),
      w('Po prawej brzeg Afryki, a od jej strony nadciąga noc.')
    ]),
    u('archipelag', { typ: 'dojazd', poziom: 'archipelag', wejscie: 'P', znaki: 170, cel_s: 18,
      obiekt: { czesc: 'teide', promien_km: 250 }, swiatlo: sw('dzien', 268, 19),
      etykietyMiejsc: [{ nazwa: 'Teneryfa', lonLat: SRODEK_WYSPY_ETYKIETA }, { nazwa: 'Afryka', lonLat: AFRYKA_BRZEG, odleglosc: { fakt: 'f-odleglosci', liczba: 'doAfryki' } }] }, [
      w('Z błękitu wyłaniają się wyspy, rzucone w ocean jak okruchy.'),
      w('Największa to Teneryfa. Do Afryki masz stąd około 300 kilometrów.',
        { wymowa: 'Największa to Teneryfa. Do Afryki masz stąd około trzystu kilometrów.' })
    ]),
    u('wyspa', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'P', znaki: 190, cel_s: 20,
      obiekt: TEIDE_WYSPA, swiatlo: sw('zloty', 272, 16) }, [
      w('Wyspa ma trzy rogi, jak grot rzucony w morze.', { zd: [[0.5, 'podpis:przewyzszenie']] }),
      w('Grzbiety biegną od rogów do środka i tam się spotykają.'),
      w('Na spotkaniu stoi Teide: 3718 metrów, najwyżej w całej Hiszpanii.',
        { wymowa: 'Na spotkaniu stoi Teide: trzy tysiące siedemset osiemnaście metrów, najwyżej w całej Hiszpanii.', zd: [[0.3, 'etykieta:teide']] })
    ]),
    u('teide', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 110, cel_s: 12.5, oddechPo_s: 2.5,
      obiekt: { czesc: 'teide', promien_km: 28, promienPion_km: 28 }, swiatlo: sw('zloty', 278, 12) }, [
      w('Słońce już nisko. Cień wyspy kładzie się na morzu, a szczyt świeci najdłużej.')
    ])
  ];

  // R9.2 — jeden dzień: poranek (az 95–120°, el 14° → 35°), popołudnie w G6, kalima, powrót.
  S.geografia = [
    u('pod-chmurami', { typ: 'przelot', poziom: 'wyspa', wejscie: 'C', znaki: 100, cel_s: 10,
      obiekt: { czesc: 'orotava', promien_km: 2.9 }, swiatlo: sw('pochmurno', 100, 14) }, [
      w('Szaro i mokro. Wisisz pod chmurą, nad zieloną doliną La Orotava.')
    ]),
    u('przebicie', { typ: 'przelot', poziom: 'wyspa', wejscie: 'B', znaki: 70, cel_s: 9,
      obiekt: { czesc: 'teide', promien_km: 4 }, swiatlo: sw('dzien', 105, 18), animacja: ['a4', 0, 1] }, [
      w('Biel — i nagle słońce. Teide stoi nad morzem chmur.')
    ]),
    u('morze-chmur', { typ: 'statyw', poziom: 'wyspa', wejscie: 'K', znaki: 150, cel_s: 14,
      // ekspozycja 0,9: morze chmur w tele jaśniejsze od końca G2 (stok w cieniu) — dopasowanie przez cięcie K (EKS-6)
      obiekt: { czesc: 'teide', promien_km: 4 }, swiatlo: sw('dzien', 110, 22), etykiety: ['anaga', 'teide'], ekspozycja: 0.9 }, [
      w('Pasat pcha wilgoć znad oceanu i układa ją na północnych stokach.'),
      w('Chmury rozbijają się o grzbiet jak fala o falochron.')
    ]),
    u('gran', { typ: 'przelot', poziom: 'wyspa', wejscie: 'K', znaki: 120, cel_s: 14,
      obiekt: { czesc: 'dorsal', promien_km: 3.5 }, swiatlo: sw('dzien', 115, 26),
      podpis: 'barwy: model z wysokości i wiatru' }, [
      w('Grań tnie wyspę na pół: po prawej mokra zieleń, po lewej sucha skała w słońcu.')
    ]),
    u('las-canadas', { typ: 'okrazenie', poziom: 'wyspa', wejscie: 'D', znaki: 130, cel_s: 14,
      obiekt: { czesc: 'teide', promien_km: 3.4 }, swiatlo: sw('dzien', 120, 30), etykiety: ['teide', 'las-canadas', 'pico-viejo'] }, [
      w('Pod tobą Las Cañadas, kocioł długi na 16 kilometrów.',
        { wymowa: 'Pod tobą Las Cañadas, kocioł długi na szesnaście kilometrów.' }),
      w('Z jego dna rośnie Teide, a obok niższy brat, Pico Viejo.')
    ]),
    u('teno', { typ: 'dojazd', poziom: 'wstawka:teno', wejscie: 'B', znaki: 130, cel_s: 14,
      obiekt: { czesc: 'los-gigantes', promien_km: 0.9 }, swiatlo: sw('dzien', 255, 28), etykiety: ['los-gigantes', 'masca'] }, [
      w('Z wody rosną ściany Los Gigantes, od 300 do 600 metrów skały.',
        { wymowa: 'Z wody rosną ściany Los Gigantes, od trzystu do sześciuset metrów skały.' }),
      w('Za nimi otwiera się wąwóz Masca, wcięty w stare lawy Teno.')
    ]),
    u('kalima', { typ: 'statyw', poziom: 'wyspa', wejscie: 'K', znaki: 90, cel_s: 9,
      obiekt: { czesc: 'teide', promien_km: 10 }, swiatlo: sw('kalima', 250, 30) }, [
      w('Wiatr z Sahary niesie pył. Niebo rdzewieje, widać coraz mniej.')
    ]),
    u('dwa-swiaty', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 60, cel_s: 8, oddechPo_s: 3,
      obiekt: TEIDE_WYSPA, swiatlo: sw('dzien', 255, 30) }, [
      w('Północ w chmurze, południe w słońcu. Jedna wyspa, dwa nieba.')
    ])
  ];

  // R9.3 — światło mapowe (az 135°, el 40°), MAPA UPROSZCZONA przez cały rozdział; jednostka wlewa się na swoim wersie.
  // B2–B4 +1,5 s (recenzja kinowa r1, I6/P10): oddech po wersie — mowa 83% → ok. 78% rozdziału
  function mapa(nazwa, p, wersy) { p.swiatlo = STUDIO; p.plakietka = 'mapa'; p.kolorowanie = p.kolorowanie || 'geologia'; return u(nazwa, p, wersy); }
  S.budowa = [
    mapa('mapa', { typ: 'statyw', poziom: 'wyspa', wejscie: 'C', znaki: 90, cel_s: 9, obiekt: TEIDE_WYSPA, kolorowanie: 'teren' }, [
      w('Zdrap z wyspy lasy i miasta. Pod spodem leży kamień różnego wieku.')
    ]),
    mapa('tarcze', { typ: 'okrazenie', poziom: 'wyspa', wejscie: 'D', znaki: 150, cel_s: 17.5, obiekt: { czesc: 'teide', promien_km: 40 } }, [
      w('Patrz, jak zapala się południe. To Roque del Conde, blisko dwanaście milionów lat.', { zd: [[0.3, 'jednostka:tarcza-roque-del-conde']] }),
      w('Potem zachodni róg, Teno.', { zd: [[0.3, 'jednostka:tarcza-teno']] }),
      w('I wschodni, Anaga — najmłodsza z trzech.', { zd: [[0.3, 'jednostka:tarcza-anaga']] })
    ]),
    mapa('gmach', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 130, cel_s: 15.5, obiekt: { czesc: 'las-canadas', promien_km: 10 } }, [
      w('Na nie wylewa się gmach Las Cañadas: wybuch po wybuchu, warstwa na warstwie.',
        { zd: [[0.3, 'jednostka:gmach-las-canadas'], [1.5, 'jednostka:dolina-icod'], [2.5, 'jednostka:reszta-mlodsze-pokrywy']] }),
      w('Sięgał około 4000 metrów. Dziś to ściany kaldery.',
        { wymowa: 'Sięgał około czterech tysięcy metrów. Dziś to ściany kaldery.' })
    ]),
    mapa('teide-pico-viejo', { typ: 'okrazenie', poziom: 'wyspa', wejscie: 'D', znaki: 130, cel_s: 15.5,
      obiekt: { czesc: 'teide', promien_km: 3 }, etykiety: ['teide', 'pico-viejo'] }, [
      w('W samym środku rosną Teide i Pico Viejo.', { zd: [[0.3, 'jednostka:teide-pico-viejo']] }),
      w('Na całej wyspie ciemny, twardy bazalt. Rzadziej fonolit, zielonkawy albo niebieskawy.')
    ]),
    mapa('ryfty', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'K', znaki: 130, cel_s: 14, obiekt: { czesc: 'teide', promien_km: 35 } }, [
      w('Teraz spójrz na szwy: trzy pasma pęknięć biegną od rogów wyspy do środka.',
        { zd: [[0.3, 'jednostka:ryft-ne-dorsal'], [1.2, 'jednostka:ryft-nw'], [2.1, 'jednostka:dolina-orotava'], [2.7, 'jednostka:dolina-guimar']] }),
      w('Zbiegają się tam, gdzie wyrósł Teide.')
    ]),
    mapa('calosc', { typ: 'statyw', poziom: 'wyspa', wejscie: 'D', znaki: 80, cel_s: 10, oddechPo_s: 2.5, obiekt: TEIDE_WYSPA }, [
      w('Kamień nie rysuje równych kresek. Te granice są przybliżone.')
    ])
  ];

  // R9.4 — od W3 plakietka REKONSTRUKCJA i licznik; A1 = wzrost wyspy (czasMa z postojami na osCzasu).
  S.powstanie = [
    // Kamera z W (az 270°) przy słońcu zachodzącym na W daje światło od przodu, nie kontrę — patrz raport.
    u('sylwetka', { typ: 'statyw', poziom: 'wyspa', wejscie: 'C', znaki: 90, cel_s: 10,
      obiekt: { czesc: 'teide', promien_km: 6.3 }, swiatlo: sw('zmierzch', 290, 3) }, [
      w('To, co widzisz, to tylko czubek. Reszta stoi w ciemnej wodzie.')
    ]),
    u('zabierz-wode', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 80, cel_s: 10,
      obiekt: { czesc: 'teide', promien_km: 40 }, swiatlo: NEUTRALNE, woda: 'szklana', plakietka: 'dno' }, [
      w('Teraz zabierz ocean. Stok schodzi jeszcze około 3000 metrów w dół.',
        { wymowa: 'Teraz zabierz ocean. Stok schodzi jeszcze około trzech tysięcy metrów w dół.', zd: [[1.0, 'woda:szklana']] })
    ]),
    u('cofniecie', { typ: 'statyw', poziom: 'wyspa', wejscie: 'D', znaki: 40, cel_s: 6,
      obiekt: { czesc: 'teide', promien_km: 40 }, swiatlo: NEUTRALNE, woda: 'szklana', plakietka: 'rekonstrukcja', animacja: ['a1', 1, 0] }, [
      w('I cofnij zegar. Daleko.')
    ]),
    u('dno', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 150, cel_s: 16,
      obiekt: { czesc: 'teide', promien_km: 35 }, swiatlo: NEUTRALNE, woda: 'szklana', plakietka: 'rekonstrukcja', animacja: ['a1'].concat(A1.dno) }, [
      w('Stoisz na dnie, na jednej z najstarszych skorup oceanu na Ziemi.'),
      w('Szczeliny się żarzą. Lawa wychodzi w zimną wodę i stygnie w poduszki.')
    ]),
    u('wynurzenie', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'B', znaki: 100, cel_s: 16, oddechPo_s: 6,
      // obiekt główny = wierzchołek tarczy centralnej (Roque del Conde, oc-wynurzenie): wers „ok. 12 mln lat” na postoju
      // licznika (11,9; szczyt tuż pod taflą, para), animacja rusza po wersie — koniec postoju = przebicie tafli (zdarzenie
      // `przebicie-tafli` liczy plan z krzywej). Długi oddech po wersie: w środku ujęcia wierzchołek stoi już nad wodą
      // (ruling 8b-10)
      obiekt: { lonLat: RDC_SZCZYT, promien_km: 6, promienPion_km: 4 }, swiatlo: NEUTRALNE, woda: 'szklana', plakietka: 'rekonstrukcja',
      animacja: ['a1'].concat(A1.wynurzenie), animacjaPoWersie: true }, [
      w('Syk pary: około 12 milionów lat temu góra wychodzi nad wodę.',
        { wymowa: 'Syk pary: około dwunastu milionów lat temu góra wychodzi nad wodę.', czas: 'oc-wynurzenie', zd: [[1.2, 'woda:realna']] })
    ]),
    u('trzy-tarcze', { typ: 'statyw', poziom: 'wyspa', wejscie: 'K', znaki: 150, cel_s: 16,
      obiekt: TEIDE_WYSPA, swiatlo: NEUTRALNE, plakietka: 'rekonstrukcja', animacja: ['a1'].concat(A1.trzyTarcze) }, [
      w('Rosną trzy tarcze, jedna po drugiej: na południu, potem Teno, potem Anaga.'),
      w('Czy stały osobno, jak wyspy? Badacze piszą tylko: prawdopodobnie.')
    ]),
    u('zrost', { typ: 'okrazenie', poziom: 'wyspa', wejscie: 'D', znaki: 150, cel_s: 16,
      obiekt: TEIDE_WYSPA, swiatlo: NEUTRALNE, plakietka: 'rekonstrukcja', animacja: ['a1'].concat(A1.zrost),
      // recenzja kinowa r1 (I3): licznik stoi na ok. 3,9 mln lat (koniec Anagi, „długa przerwa”) do 2,5 s wersu „Około
      // 4 milionów lat temu” — wcześniej mijał 4 mln 6–8 s przed wersem i pokazywał 170 tys. lat, gdy lektor mówił o 4 mln
      animacjaKlucze: [['licznik-4mln', 2.5, A1.zrost[0]]] }, [
      w('Potem długa przerwa. Deszcz i morze gryzą skałę.'),
      w('Około 4 milionów lat temu środek budzi się znowu. Lawa skleja tarcze w jedną wyspę.',
        { wymowa: 'Około czterech milionów lat temu środek budzi się znowu. Lawa skleja tarcze w jedną wyspę.', czas: 'oc-canadas', zd: [[0, 'licznik-4mln']] })
    ]),
    u('goraca-plama', { typ: 'statyw', poziom: 'archipelag', wejscie: 'P', znaki: 110, cel_s: 10,
      obiekt: { czesc: 'teide', promien_km: 250 }, swiatlo: NEUTRALNE, plakietka: 'hipoteza' }, [
      w('Skąd ten ogień? Badacze się kłócą: gorąca plama w płaszczu czy pęknięcie od gór Atlas.')
    ]),
    u('dzis', { typ: 'statyw', poziom: 'wyspa', wejscie: 'P', znaki: 70, cel_s: 9, oddechPo_s: 3,
      obiekt: { czesc: 'icod', promien_km: 5 }, swiatlo: sw('zmierzch', 290, 4) }, [
      w('Ale ta wyspa nie tylko rosła. Ona też się rozpadała.')
    ])
  ];

  // R9.5 — jednostka czasu maleje (tysiące lat → lata → godziny), ujęcia się skracają; kulminacja w H10.
  var GARACHICO = { czesc: 'garachico', promien_km: 0.75 };
  // H1–H3: rzeźba tuż przed osuwiskiem Icod (zapadniecie.Ma z dane.js + 5 tys. lat — zbocze z wypełnieniem)
  var ICOD = (daneTeneryfy().jednostki || []).filter(function (j) { return j.id === 'dolina-icod'; })[0];
  var PRZED_ICOD = ICOD && ICOD.zapadniecie ? +(ICOD.zapadniecie.Ma + 0.005).toFixed(3) : 0;
  S.historia = [
    u('przed', { typ: 'statyw', poziom: 'wyspa', wejscie: 'C', znaki: 100, cel_s: 10,
      obiekt: { czesc: 'icod', promien_km: 4.2 }, swiatlo: NEUTRALNE, plakietka: 'rekonstrukcja', czasMa: [PRZED_ICOD, PRZED_ICOD] }, [
      w('Północne zbocze jeszcze stoi. Patrz na nie dobrze, bo zaraz go nie będzie.')
    ]),
    u('zbocze-rusza', { typ: 'statyw', poziom: 'wyspa', wejscie: 'D', znaki: 90, cel_s: 12,
      obiekt: { czesc: 'icod', promien_km: 6 }, swiatlo: NEUTRALNE, woda: 'szklana', plakietka: 'rekonstrukcja', animacja: ['a3', 0, 0.7],
      czasMa: [PRZED_ICOD, PRZED_ICOD] }, [
      w('Najpierw rusza pod wodą, etap po etapie. Na końcu zjeżdża to, co nad wodą.', { zd: [[0.2, 'start-a3']] })
    ]),
    u('fala-i-cisza', { typ: 'statyw', poziom: 'wyspa', wejscie: 'K', znaki: 80, cel_s: 10, oddechPo_s: 3,
      obiekt: { czesc: 'icod', promien_km: 15 }, swiatlo: NEUTRALNE, woda: 'szklana', plakietka: 'rekonstrukcja', animacja: ['a3', 0.7, 1],
      czasMa: [PRZED_ICOD, PRZED_ICOD] }, [
      w('Potem cisza. Po zboczu został pusty amfiteatr: dolina Icod.')
    ]),
    u('trzy-blizny', { typ: 'przelot', poziom: 'wyspa', wejscie: 'C', znaki: 140, cel_s: 14,
      obiekt: { czesc: 'orotava', promien_km: 15 }, swiatlo: sw('dzien', 100, 30), etykiety: ['icod', 'orotava', 'guimar'] }, [
      w('Icod to najmłodsza z takich blizn.', { zd: [[0.2, 'obrys:icod']] }),
      w('La Orotava ma około pół miliona lat.', { zd: [[0.2, 'obrys:orotava']] }),
      w('Za granią Güímar: tu cały wulkan zjechał około 85 kilometrów w ocean.',
        { wymowa: 'Za granią Güímar: tu cały wulkan zjechał około osiemdziesięciu pięciu kilometrów w ocean.', zd: [[0.2, 'obrys:guimar']] })
    ]),
    u('kaldera-spor', { typ: 'okrazenie', poziom: 'wyspa', wejscie: 'K', znaki: 130, cel_s: 12,
      obiekt: { czesc: 'las-canadas', promien_km: 2.6 }, swiatlo: NEUTRALNE, plakietka: 'hipoteza' }, [
      w('A ta kaldera? Badacze się kłócą.'),
      w('Jedni widzą trzy zapadnięcia, drudzy osuwisko zbocza. A może jedno i drugie.')
    ]),
    // wejście K (ruling kontrolera, runda 1): H6 zaczyna się w chwili 0,17 mln lat (bez Teide) — zmiana chwili to cięcie
    u('teide-w-bliznie', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'K', znaki: 100, cel_s: 10,
      obiekt: { czesc: 'teide', promien_km: 3, hc: 2.8 }, swiatlo: NEUTRALNE, plakietka: 'rekonstrukcja', animacja: ['a1', 0.875, 1] }, [
      w('W tej bliźnie od około 170 tysięcy lat rośnie Teide, a obok Pico Viejo.',
        { wymowa: 'W tej bliźnie od około stu siedemdziesięciu tysięcy lat rośnie Teide, a obok Pico Viejo.', czas: 'oc-teide', czasOd: true })
    ]),
    u('ludzie', { typ: 'statyw', poziom: 'wyspa', wejscie: 'K', znaki: 110, cel_s: 10,
      obiekt: TEIDE_WYSPA, swiatlo: NEUTRALNE }, [
      w('1492: ludzie Kolumba widzą na wyspie ogień.',
        { wymowa: 'Rok tysiąc czterysta dziewięćdziesiąty drugi: ludzie Kolumba widzą na wyspie ogień.', zd: [[0, 'erupcja:e-1492']] }),
      w('Przełom 1704 i 1705 roku: trzy erupcje po kolei i silne trzęsienia.',
        { wymowa: 'Przełom tysiąc siedemset czwartego i tysiąc siedemset piątego roku: trzy erupcje po kolei i silne trzęsienia.', zd: [[0, 'erupcja:e-1704']] })
    ]),
    u('luna', { typ: 'statyw', poziom: 'wstawka:garachico', wejscie: 'C', znaki: 90, cel_s: 10,
      obiekt: GARACHICO, swiatlo: NOC_1706, plakietka: 'rekonstrukcja', animacja: ['a2', 0.08, 0.1], etykiety: ['garachico', 'montana-negra'] }, [
      w('Wracasz do tamtej nocy. Na grzbiecie pęka szczelina długa na 950 metrów.',
        { wymowa: 'Wracasz do tamtej nocy. Na grzbiecie pęka szczelina długa na dziewięćset pięćdziesiąt metrów.' })
    ]),
    u('lawa-schodzi', { typ: 'przelot', poziom: 'wstawka:garachico', wejscie: 'K', znaki: 120, cel_s: 14,
      // na telefonie oś zostaje na czole lawy (cel kluczy), nie ku Garachico — czoło i miasto są na starcie H9 2,5
      // szerokości kadru telefonu od siebie (ruling 8b-2: lawa w kadrze kulminacji, EKS-3)
      // ekspozycja 0,92: na telefonie start H9 (oś na czole lawy) jaśniejszy od końca H8 o 40% (EKS-6 ±25%)
      obiekt: GARACHICO, osTelefonu: 'cel', ekspozycja: 0.92, swiatlo: NOC_1706_H9, plakietka: 'rekonstrukcja', animacja: ['a2', 0.1, 0.6] }, [
      w('Z ponad dwunastu otworów bije ogień, a lawa rusza w dół, ku miastu.'),
      w('Na dole czeka najważniejszy port wyspy.')
    ]),
    // H10 (recenzja kinowa r1, C2): na słowie „klif” lawa już przeskakuje klif (f 0,6 → 0,85 w 1,5 s), do „Port znika”
    // dochodzi do morza (f 1); wers bez liczby ramion (decyzja właściciela P11 — kadr ich nie liczy). Kadr ciaśniejszy niż
    // reguła 45 komórek: nocą sylwetkę daje lawa, a stok przy 25 komórkach nie pokazuje faset (wyjątek SKA-1 jawny w teście)
    u('port', { typ: 'statyw', poziom: 'wstawka:garachico', wejscie: 'K', znaki: 110, cel_s: 17.5, oddechPo_s: 3.5, gestosc: 25,
      obiekt: { czesc: 'garachico', promien_km: 0.72 }, swiatlo: NOC_1706_H10, plakietka: 'rekonstrukcja', animacja: ['a2', 0.6, 1],
      animacjaKlucze: [['lawa-na-klifie', 0, 0.6], ['lawa-na-klifie', 1.5, 0.85], ['port-znika', 0, 1]] }, [
      w('Lawa przeskakuje klif, ramię za ramieniem, i spływa na miasto.', { zd: [[0.5, 'lawa-na-klifie']] }),
      w('Port znika. Część miasta ocaleje.', { zd: [[0, 'port-znika']] })
    ]),
    u('swit-po', { typ: 'statyw', poziom: 'wstawka:garachico', wejscie: 'C', znaki: 70, cel_s: 9, oddechPo_s: 3,
      // osiem dni po erupcji: lawa ostygła (czarna delta, szara para) — kadr ciszy po kulminacji (recenzja kinowa r1, I15)
      obiekt: { czesc: 'garachico', promien_km: 0.72 }, swiatlo: sw('swit', 70, 6), plakietka: 'rekonstrukcja', animacja: ['a2', 1, 1],
      lawaStygnie: 1, gestosc: 25 }, [
      w('Tu nikt nie zginął. Miasto wróci, ale jego złoty wiek się skończył.')
    ])
  ];

  // R9.6 — światło studyjne, tło czarne, woda szklana, SCHEMAT przez cały rozdział; warstwa zapala się na swoim wersie.
  function schemat(nazwa, p, wersy) { p.swiatlo = STUDIO; p.woda = 'szklana'; p.plakietka = 'schemat'; p.kolorowanie = 'geologia'; return u(nazwa, p, wersy); }
  var BLOK = { czesc: 'teide', promien_km: 45, promienPion_km: 22 };
  S.przekroj = [
    schemat('czern', { typ: 'plansza', poziom: 'wyspa', wejscie: 'Cc', znaki: 0, cel_s: 1.2, obiekt: { promien_km: 0 } }),
    schemat('blok', { typ: 'statyw', poziom: 'wyspa', wejscie: 'C', znaki: 90, cel_s: 10, obiekt: BLOK }, [
      w('Teraz weź nóż i przetnij wyspę przez sam szczyt Teide.')
    ]),
    // cięcie N–S przez Teide (ściana patrzy na wschód, kamera X3–X6 na az 90°); płaszczyzna rusza na zdarzeniu `ciecie-start`
    // 5,5 s (było 9): połowa znika pod ostrzem, nie odjeżdża — krótko (recenzja kinowa r1, I14)
    schemat('ciecie', { typ: 'statyw', poziom: 'wyspa', wejscie: 'D', znaki: 60, cel_s: 5.5, obiekt: BLOK,
      przekroj: { czesc: 'teide', kat_st: 0, start: 'ciecie-start' } }, [
      w('Zgrzyt kamienia. Połowa wyspy odjeżdża na bok.', { zd: [[0, 'ciecie-start']] })
    ]),
    schemat('profil', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 120, cel_s: 12, obiekt: { czesc: 'teide', promien_km: 21, hc: 0 },
      przewyzszenie: [{ u: 0.08, e: 1.5 }, { u: 0.58, e: 3 }] }, [
      w('Górna linia jest zmierzona. Wszystko pod nią to schemat, nie zdjęcie.'),
      w('Góry są tu wyciągnięte w górę trzy razy.')
    ]),
    schemat('warstwy', { typ: 'przelot', poziom: 'wyspa', wejscie: 'D', znaki: 160, cel_s: 19.5, obiekt: { czesc: 'teide', promien_km: 10.5, hc: -2 },
      podpis: 'granice pod profilem: głębokość szacowana' }, [
      w('Na dole skorupa z czasów dinozaurów.', { zd: [[0.2, 'warstwa:w-skorupa'], [1.6, 'warstwa:w-osady']] }),
      w('Nad nią lawa zastygła pod wodą w szkliste okruchy, słaba i podatna.', { zd: [[0.2, 'warstwa:w-kompleks-podmorski']] }),
      w('Wyżej tarcze bazaltu, gmach Las Cañadas i Teide.',
        { zd: [[0.2, 'warstwa:w-tarcze'], [1.6, 'warstwa:w-gmach-canadas'], [3.4, 'warstwa:w-teide-pico-viejo']] })
    ]),
    // „głębokość szacowana” w G-L także w X5 i X6 (spec R9.6; recenzja kodu r1) — obrys komory i granice warstw to szacunek
    schemat('komora', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 120, cel_s: 12, obiekt: { czesc: 'teide', promien_km: 6, hc: -1.5 },
      podpis: 'obrys zbiorników: głębokość szacowana' }, [
      w('Płytko pod Teide czeka magma: raczej kilka zbiorników niż jedna komora.', { zd: [[0.5, 'warstwa:w-zbiornik-fonolitowy']] }),
      w('Nikt ich nie widział. Ten obrys to szacunek.')
    ]),
    // cel 2,5 km niżej (recenzja kinowa r1, C4): pasmo osadów, o którym mówi wers, w kadrze (y ≈ −0,2), nie pod jego dolną krawędzią
    schemat('osady', { typ: 'przelot', poziom: 'wyspa', wejscie: 'D', znaki: 70, cel_s: 8, obiekt: { czesc: 'icod', promien_km: 15, hc: -5 },
      podpis: 'granice pod profilem: głębokość szacowana' }, [
      w('Na dnie, daleko od brzegu, leży gruz zsuniętych zboczy.')
    ]),
    schemat('zamkniecie', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 50, cel_s: 8, oddechPo_s: 2.5, obiekt: BLOK,
      przewyzszenie: [{ u: 0.06, e: 3 }, { u: 0.8, e: 1.5 }] }, [
      w('Złóż wyspę z powrotem.')
    ])
  ];

  // R9.7 — okrążenie zgodnie z ruchem wskazówek zegara; słońce schodzi monotonicznie (az 250° → 285°, el 30° → 10°).
  // Wers ujęcia = czesc.wers z dane.js (spec R9.7; jedno źródło — ten sam wers czyta karta makiety). Moduł go nie pisze.
  // Los Gigantes i La Orotava wchodzą cięciem K (decyzja P2, recenzja kinowa r1): dwa najdłuższe przeloty (94° i 84°) robiły
  // z wyspy makietę (2,2–2,8 wysokości oka na sekundę pod wersem)
  var OKRAZENIE = [['anaga', 'C'], ['la-laguna', 'D'], ['guimar', 'D'], ['montana-roja', 'K'], ['los-gigantes', 'K'],
    ['masca', 'D'], ['garachico', 'D'], ['orotava', 'K'], ['teide', 'D']];
  // Montaña Roja po cięciu K: kadr z większą połacią nieba (telefon 93 → 130 sRGB) — ekspozycja ujęcia (EKS-6), przez szew
  // D do Los Gigantes płynnie
  var EKSPOZYCJA_OKRAZENIA = { 'montana-roja': 0.88 };
  // Garachico: jedna etykieta (recenzja kinowa r1, I9 — „Garachico” i „El Caletón” nachodziły na siebie 124×32 px)
  var ETYKIETY_OKRAZENIA = { garachico: ['garachico'], orotava: ['orotava', 'icod'] };
  S.czesci = OKRAZENIE.map(function (z, i, wszystkie) {
    var t = i / (wszystkie.length - 1), ostatnie = i === wszystkie.length - 1;
    var p = { typ: ostatnie ? 'okrazenie' : 'przelot', poziom: 'wyspa', wejscie: z[1], znaki: 100, cel_s: ostatnie ? 13 : 11.5,
      // kadr H ≥ 5 km (R9.7) → promień kadru ≥ 2,5 km
      obiekt: { czesc: z[0], promien_km: 2.5 },
      swiatlo: sw(t < 0.65 ? 'dzien' : 'zloty', Math.round(250 + 35 * t), Math.round(30 - 20 * t)),
      etykiety: ETYKIETY_OKRAZENIA[z[0]] || [z[0]] };
    if (EKSPOZYCJA_OKRAZENIA[z[0]]) p.ekspozycja = EKSPOZYCJA_OKRAZENIA[z[0]];
    if (ostatnie) p.oddechPo_s = 3;
    return u(z[0], p, [wersCzesci(czescDanych(z[0]))]);
  });

  // R9.8 — sześć par: teza (≤ 55 zn.) → stempel werdyktu na cięciu K → dowód (≤ 85 zn.). Werdykty z dane.mity.
  // M3 i M5 wybrane z danych: „jeden wulkan” (mit, kadr dowodu = B5 ryfty) i „najwyższa góra” (fakt, kadr G5).
  function para(id, teza, dowod) {
    return [
      // 0,8 s zawieszenia po tezie, przed stemplem werdyktu na cięciu K (R9.8) — także przy nagraniu dłuższym od budżetu
      u(id + '-teza', { typ: 'dojazd', poziom: teza.poziom || 'wyspa', wejscie: 'C', znaki: 55, cel_s: 6, zawieszeniePo_s: 0.8, obiekt: teza.obiekt,
        swiatlo: teza.swiatlo, plakietka: teza.plakietka, animacja: teza.animacja, ekspozycja: teza.ekspozycja }, [w(teza.w)]),
      u(id + '-dowod', { typ: dowod.typ || 'statyw', poziom: dowod.poziom || 'wyspa', wejscie: 'K', znaki: 85, cel_s: dowod.cel_s || 9.5,
        oddechPo_s: dowod.oddechPo_s, obiekt: dowod.obiekt, swiatlo: dowod.swiatlo, woda: dowod.woda, kolorowanie: dowod.kolorowanie,
        plakietka: dowod.plakietka, etykiety: dowod.etykiety, etykietyOd: dowod.etykietyOd, animacja: dowod.animacja,
        dzwiekFumarol: dowod.dzwiekFumarol }, [w(dowod.w, { wymowa: dowod.wymowa, zd: dowod.zd })])
    ];
  }
  // La Palma: dane.mity m-megatsunami — model Warda i Daya dla „Cumbre Vieja (La Palma)” (źródło wCumbre). Punkt wyspy
  // jak w siatce archipelagu (test/geologia-teren.test.js, SKA-4); teza M4 nazywa La Palmę, kadr tezy na nią najeżdża.
  var LA_PALMA = [-17.86, 28.71];
  S.mity = [].concat(
    para('m-atlantyda',
      { w: 'Mówią: „Teneryfa to szczyt zatopionej Atlantydy.”', obiekt: TEIDE_WYSPA, swiatlo: sw('zmierzch', 290, 4) },
      { typ: 'dojazd', w: 'Atlantydę wymyślił Platon, a ta wyspa od 12 milionów lat stoi nad wodą.',
        wymowa: 'Atlantydę wymyślił Platon, a ta wyspa od dwunastu milionów lat stoi nad wodą.',
        obiekt: { czesc: 'teide', promien_km: 40 }, swiatlo: NEUTRALNE, woda: 'szklana', plakietka: 'dno' }),
    para('m-wygasly',
      { w: 'Mówią: „Teide jest wygasły.”', obiekt: { czesc: 'teide', promien_km: 10 }, swiatlo: sw('dzien', 220, 30) },
      { poziom: 'wstawka:teide', w: 'Posłuchaj: na szczycie syczą fumarole, a sąsiedni Pico Viejo wybuchł w 1798 roku.',
        wymowa: 'Posłuchaj: na szczycie syczą fumarole, a sąsiedni Pico Viejo wybuchł w tysiąc siedemset dziewięćdziesiątym ósmym roku.',
        // decyzja P9 (recenzja kinowa r1): fumarole pokazuje etykieta, nie powiększony pióropusz (reguła 45 komórek); krater
        // 80 m — wulkany.js (Teide, opis), 1798 — dane.js (Chahorra)
        zd: [[1.1, 'etykieta-fumarole'], [3.6, 'etykieta-pico-1798']], dzwiekFumarol: true,
        etykietyOd: [{ kiedy: 'etykieta-fumarole', nazwa: 'fumarole · krater 80 m', czesc: 'teide' },
          { kiedy: 'etykieta-pico-1798', nazwa: 'Pico Viejo · 1798', czesc: 'pico-viejo' }],
        obiekt: { czesc: 'teide', promien_km: 0.75 }, swiatlo: sw('dzien', 120, 30) }),
    para('m-jeden-wulkan',
      { w: 'Mówią: „Wyspa powstała z jednego wulkanu.”', obiekt: TEIDE_WYSPA, swiatlo: sw('dzien', 220, 30) },
      { typ: 'dojazd', w: 'Trzy stare tarcze, wielki gmach w środku i setki stożków na trzech ryftach.',
        obiekt: { czesc: 'teide', promien_km: 35 }, swiatlo: STUDIO, kolorowanie: 'geologia', plakietka: 'mapa' }),
    para('m-megatsunami',
      { poziom: 'archipelag', w: 'Mówią: „Zbocze La Palmy runie i fala zaleje Atlantyk.”', obiekt: { lonLat: LA_PALMA, promien_km: 40 },
        swiatlo: sw('dzien', 220, 30), plakietka: 'hipoteza' },
      { poziom: 'archipelag', w: 'Fale z osuwisk już tu były, w Teno może ponad 50 metrów. Model z La Palmy podważono.',
        wymowa: 'Fale z osuwisk już tu były, w Teno może ponad pięćdziesiąt metrów. Model z La Palmy podważono.',
        // recenzja kinowa r1 (I8): „tu” wskazuje obraz — etykieta Teno od słowa „Teno”
        zd: [[2.4, 'etykieta:teno']],
        cel_s: 11.5, oddechPo_s: 2.5, obiekt: { czesc: 'teno', promien_km: 150 }, swiatlo: sw('dzien', 220, 30), plakietka: 'hipoteza' }),
    para('m-najwyzszy',
      { w: 'Ludzie powtarzają: „Teide to najwyższa góra Hiszpanii.”', obiekt: { czesc: 'teide', promien_km: 10 }, swiatlo: sw('dzien', 220, 30) },
      { typ: 'okrazenie', w: 'Tak: 3718 metrów, choć część źródeł podaje 3715.',
        wymowa: 'Tak: trzy tysiące siedemset osiemnaście metrów, choć część źródeł podaje trzy tysiące siedemset piętnaście.',
        obiekt: { czesc: 'teide', promien_km: 3.4 }, swiatlo: sw('dzien', 120, 30), etykiety: ['teide'] }),
    para('m-guayota',
      { w: 'Mówią: „W Teide uwięziony jest demon Guayota.”', obiekt: { czesc: 'teide', promien_km: 6 }, swiatlo: sw('noc', 290, -15),
        plakietka: 'legenda', animacja: ['a5', 0.4, 0.4], ekspozycja: 0.85 },   // to samo niebo co w dowodzie; więcej nieba w kadrze tezy (EKS-6 na K)
      { w: 'Guanczowie wierzyli, że Guayota zamknął w górze słońce. Może pamiętali erupcję.',
        // recenzja kinowa r1 (I8): gwiazdy A5 i żar w kraterze od słowa „słońce” (łuna terenu wokół krateru, r 150 m)
        animacja: ['a5', 0.4, 0.6], zd: [[4.4, 'zar:teide']],
        cel_s: 11.5, oddechPo_s: 2.5, obiekt: { czesc: 'teide', promien_km: 3 }, swiatlo: sw('noc', 290, -18), plakietka: 'legenda' })
  );

  // R9.9 — jeden dzień od rana do nocy; słońce i światła miast prowadzą czas.
  S.dzis = [
    // D1 (decyzja P1, recenzja kinowa r1): rym z H10/H11 — ten sam kadr, a w nim zastygły, ciemny jęzor lawy z 1706
    // (A2 f = 1, lawaStygnie 2: bez emisji i bez pary, bez licznika); jedna etykieta przy delcie
    u('el-caleton', { typ: 'statyw', poziom: 'wstawka:garachico', wejscie: 'C', znaki: 100, cel_s: 10,
      obiekt: { czesc: 'garachico', promien_km: 0.72 }, swiatlo: sw('dzien', 100, 18), etykiety: ['el-caleton'], gestosc: 25,
      animacja: ['a2', 1, 1], lawaStygnie: 2 }, [
      w('Ta sama lawa, rano. Dziś kąpiesz się w niej: to baseny El Caletón.')
    ]),
    u('mikroklimaty', { typ: 'przelot', poziom: 'wyspa', wejscie: 'C', znaki: 120, cel_s: 12,
      obiekt: { czesc: 'dorsal', promien_km: 3.5 }, swiatlo: sw('dzien', 150, 35) }, [
      w('Przelatujesz grań. Za plecami chmury i zieleń, przed tobą suche, słoneczne południe.')
    ]),
    u('plaze', { typ: 'przelot', poziom: 'wyspa', wejscie: 'K', znaki: 120, cel_s: 12,
      obiekt: { czesc: 'montana-roja', promien_km: 2.5 }, swiatlo: sw('dzien', 240, 30) }, [
      w('Lecisz wzdłuż brzegu. Na północy piasek czarny, z wulkanu, a tu, na południu, złoty.')
    ]),
    u('miasta', { typ: 'okrazenie', poziom: 'wyspa', wejscie: 'C', znaki: 120, cel_s: 13,
      obiekt: { czesc: 'la-laguna', promien_km: 2.7 }, swiatlo: sw('zmierzch', 285, 4), etykiety: ['la-laguna', 'orotava'] }, [
      w('Słońce siada i zapalają się okna. Pod tobą kolonialne centrum La Laguny.'),
      w('Dalej La Orotava: drewniane balkony i ogrody.')
    ]),
    u('winnice', { typ: 'przelot', poziom: 'wyspa', wejscie: 'D', znaki: 100, cel_s: 11,
      obiekt: { czesc: 'orotava', promien_km: 3 }, swiatlo: sw('zmierzch', 290, -4) }, [
      w('Ostatnie światło na tarasach winnic.'),
      w('Wulkan, który zabierał tu zbocza, dziś daje wino.')
    ]),
    u('szlak', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 90, cel_s: 11,
      obiekt: { czesc: 'teide', promien_km: 5 }, swiatlo: sw('noc', 292, -8) }, [
      w('Wspinasz się, a światła brzegu maleją. Prawie połowa tej wyspy jest pod ochroną.')
    ]),
    u('noc', { typ: 'statyw', poziom: 'wstawka:teide', wejscie: 'D', znaki: 150, cel_s: 22, oddechPo_s: 6,
      obiekt: { czesc: 'teide', promien_km: 1 }, swiatlo: sw('noc', 295, -18), animacja: ['a5', 0, 1] }, [
      w('Gaśnie ostatnie okno. Tu chroni się skały, ale też ciemność nieba.', { zd: [[0.3, 'okna-gasna']] }),
      w('Podnieś głowę. Wyspa, która wyszła z oceanu, patrzy teraz w gwiazdy.', { zd: [[0.2, 'niebo']] })
    ])
  ];

  // ───────────── KAMERA (spec R9; format w nagłówku pliku) ─────────────
  // Klamra (R8 p. 4): ten sam kadr z morza na Garachico — P0 = H8 (noc 1706), H10 = H11 = D1 (port, świt po, dziś).
  // Wstawka z=12 ma realnie 67 m na komórkę (ruling T3): H ≥ 45 komórek = 3,1 km, więc kadry ~2× szersze niż w R9.
  var KADR_P0 = [{ u: 0, cel: { czesc: 'garachico', dz: 1.0 }, az: 350, d: 12.8, h: 0.15, fov: 14, wstrzas: 0.5 }, { u: 1, d: 12.6 }];
  // H10 (recenzja kinowa r1, C2): ciaśniej niż R9.5 przy 45 komórkach (d 7,7, fov 24°, H 3,3 km) — d 5,2, fov 18°, cel 0,4 km
  // w głąb lądu (H ≈ 1,65 km, 25 komórek wstawki; wyjątek `gestosc` w ujęciach z tym kadrem)
  var KADR_H10 = [{ u: 0, cel: { czesc: 'garachico', dz: 0.4 }, az: 340, d: 5.2, h: 0.12, fov: 18 }, { u: 1, d: 5.1 }];
  var KAMERA = {
    // R9.1 — zimny start, zjazd z orbity: glob → (P) archipelag → (P) wyspa → (D) Teide
    'polozenie/zimny-start': KADR_P0,
    'polozenie/glob': [
      { u: 0, cel: { ziemia: true, dx: -1500, dz: 500 }, wzgledem: 'teide', az: 180, d: 6000, h: 30000, fov: 24 },
      { u: 1, cel: 'teide', d: 400, h: 3000, luk: true }],
    'polozenie/archipelag': [
      { u: 0.45, cel: 'teide', az: 120, d: 150, h: 700, fov: 26 },
      { u: 1, az: 50, d: 80, h: 225, fov: 28 }],
    'polozenie/wyspa': [
      { u: 0.35, cel: 'teide', az: 50, d: 95, h: 62, fov: 28 },
      { u: 0.68, d: 66, h: 30 },
      { u: 1, d: 62, h: 18 }],
    // P5: dojazd wykładniczy do kadru końcowego (kino.js dojazd, odległość i wysokość logLerp) — rozdział kończy oddech
    'polozenie/teide': [{ u: 1, cel: 'teide', az: 52, d: 55, h: 13, fov: 24, krzywa: 'dojazd' }],

    // R9.2 — jeden dzień
    'geografia/pod-chmurami': [
      { u: 0, cel: { czesc: 'orotava', hc: 0.25 }, az: 40, d: 9, h: 0.6, fov: 35 },
      { u: 1, cel: { czesc: 'orotava', dx: -3, dz: 3.5, hc: 0.4 }, h: 1.0 }],
    // G2–G3 (recenzja kinowa r1, C3): cel schodzi ze szczytu ku połowie między pokładem a szczytem, żeby morze chmur
    // zostało w dolnej tercji kadru 2.39:1 (rzut pokładu 1,3 km: y ≈ −0,3), a szczyt w górnej
    'geografia/przebicie': [
      { u: 0, cel: { czesc: 'teide', hc: 3.7 }, az: 18, d: 17, h: 1.1, fov: 30 },
      { u: 1, cel: { czesc: 'teide', hc: 1.8 }, az: 16, d: 15.5, h: 2.6 }],
    'geografia/morze-chmur': [{ u: 0, cel: { czesc: 'teide', hc: 1.9 }, az: 50, d: 45, h: 2.8, fov: 14 }, { u: 1, d: 44 }],
    // G3 → G4 (K) to cięcie osiowe: R9.2 stawia oba ujęcia na NE od Teide (tele znad Anagi, przelot wzdłuż Dorsal ku
    // kalderze) — wyjątek RUCH-9 jawny w teście i w raporcie Task 8a
    'geografia/gran': [
      { u: 0, cel: { czesc: 'teide', hc: 2.6 }, az: 58, d: 37, h: 3.0, fov: 32 },
      { u: 1, az: 78, d: 23, h: 3.1 }],
    'geografia/las-canadas': [
      { u: 0.5, cel: 'teide', az: 135, d: 18, h: 3.5, fov: 26 },
      { u: 1, az: 195, d: 16, h: 3.6, fov: 24 }],
    'geografia/teno': [
      { u: 0, cel: 'los-gigantes', wzgledem: 'los-gigantes', az: 228, d: 9.2, h: 0.3, fov: 20 },
      { u: 1, cel: { czesc: 'masca', dz: 4 }, h: 1.4, luk: true }],
    // G7 → G8 (recenzja kinowa r1, I7): odjazd w górę zaczyna się w ostatnich 30% kalimy, a G8 dochodzi do „dwóch nieb” na
    // początku puenty (było: 26 km dopiero po słowach)
    'geografia/kalima': [{ u: 0, cel: 'teide', az: 165, d: 31, h: 1.2, fov: 20 }, { u: 0.65, az: 171, d: 27 }, { u: 1, d: 33, h: 5 }],
    'geografia/dwa-swiaty': [
      { u: 0.32, cel: 'teide', az: 176, d: 60, h: 26, fov: 26 },
      { u: 1, az: 180, d: 80, h: 42, fov: 28 }],

    // R9.3 — mapa (światło studyjne)
    // B1 → B2 (I5): kadr zjeżdża na południe jeszcze w B1 — B2 wchodzi przez D w tej pozie, a Roque del Conde zapala się w kadrze
    'budowa/mapa': [{ u: 0, cel: 'teide', az: 180, d: 9, h: 110, fov: 28 }, { u: 1, cel: { czesc: 'teide', dz: 12 }, az: 188, d: 16, h: 95 }],
    // B2 (recenzja kinowa r1, I5): cel 12 km na południe od Teide — Roque del Conde zapala się w kadrze, nie pod napisem
    'budowa/tarcze': [{ u: 0.65, cel: { czesc: 'teide', dz: 12 }, az: 205, d: 70, h: 48, fov: 28 }, { u: 1, az: 230, d: 75, h: 45 }],
    'budowa/gmach': [{ u: 0.4, cel: 'las-canadas', az: 175, d: 40, h: 10, fov: 20 }, { u: 1, az: 170, d: 26, h: 9 }],
    'budowa/teide-pico-viejo': [{ u: 0.3, cel: 'teide', az: 190, d: 14, h: 4.6, fov: 24 }, { u: 1, az: 250 }],
    // B5 (I5): wejście K z wysoka (h 32 km, az 200°) — gwiazda ryftów w kadrze od pierwszego słowa
    'budowa/ryfty': [{ u: 0, cel: 'teide', az: 200, d: 55, h: 32, fov: 28 }, { u: 1, az: 200, d: 60, h: 50 }],
    'budowa/calosc': [{ u: 1, az: 202, d: 58, h: 49 }],

    // R9.4 — powstanie; sylwetka z WSCHODU (ruling T6: słońce zachodzi za wyspą)
    'powstanie/sylwetka': [{ u: 0, cel: 'teide', az: 90, d: 60, h: 0.2, fov: 12 }, { u: 1, d: 59 }],
    // decyzja P7 (recenzja kinowa r1): pod taflę ok. 3 s wcześniej — stok pod wodą w kadrze od ok. 14,5 s, na słowach
    // „Stok schodzi…” (wcześniej dopiero 1,1 s po wersie)
    'powstanie/zabierz-wode': [
      { kiedy: 'woda:szklana', po_s: 2.4, cel: { czesc: 'teide', hc: 0 }, d: 78, h: 0.1, fov: 16 },
      { kiedy: 'woda:szklana', po_s: 4.2, cel: { czesc: 'teide', hc: -0.6 }, d: 86, h: -0.35 },
      { u: 1, cel: { czesc: 'teide', hc: -1.0 }, d: 108, h: -1.0, fov: 24 }],
    'powstanie/cofniecie': [{ u: 1, d: 106 }],
    'powstanie/dno': [
      { u: 0.5, az: 15, d: 95, h: -0.7 },
      { u: 1, cel: { czesc: 'teide', hc: -0.8 }, az: 300, d: 70, h: -0.5 }],
    // W5: kamera z SSE (nad morzem) na wierzchołek tarczy centralnej, który przebija taflę po wersie; z tafli
    // w górę i ku dołowi, żeby kadr końcowy (cięcie K na W6) miał mniej nieba (EKS-6)
    'powstanie/wynurzenie': [
      { u: 0, cel: { lonLat: RDC_SZCZYT, hc: -0.3 }, az: 160, d: 26, h: -0.35, fov: 24 },
      { kiedy: 'woda:realna', h: 0.07, cel: { lonLat: RDC_SZCZYT, hc: 0.2 } },
      { u: 1, d: 22, h: 4.5, cel: { lonLat: RDC_SZCZYT, hc: 0 } }],
    // W6–W7 z SSE, nie z SSW jak w R9: słońce „neutralne” (az 220°) byłoby 161° od osi patrzenia (SWI-1 ≤ 155°)
    'powstanie/trzy-tarcze': [{ u: 0, cel: 'teide', az: 165, d: 75, h: 40, fov: 28 }, { u: 1, az: 162, d: 74 }],
    'powstanie/zrost': [
      { u: 0.55, az: 135, d: 74, h: 42 },
      { u: 1, az: 120, d: 40, h: 260, fov: 28 }],
    'powstanie/goraca-plama': [
      { u: 0.5, cel: 'teide', az: 160, d: 80, h: 1000, fov: 28 },
      { u: 1, az: 0, d: 40, h: 265 }],
    'powstanie/dzis': [
      { u: 0.5, cel: 'icod', az: 0, d: 22, h: 26, fov: 22 },
      { u: 1, d: 26, h: 11, fov: 20 }],

    // R9.5 — historia
    'historia/przed': [{ u: 0, cel: 'icod', az: 0, d: 30, h: 1.2, fov: 16 }, { u: 1, d: 29.6 }],
    'historia/zbocze-rusza': [{ u: 0.25, wstrzas: 1 }, { u: 1, d: 29, fov: 24, wstrzas: 0.6 }],
    'historia/fala-i-cisza': [{ u: 0, cel: 'icod', az: 325, d: 60, h: 20, fov: 28 }, { u: 1, d: 59 }],
    'historia/trzy-blizny': [
      { u: 0, cel: { czesc: 'orotava', dx: -9, dz: 4 }, az: 345, d: 24, h: 6, fov: 28 },
      { u: 1, cel: { czesc: 'orotava', dx: 8, dz: 2 }, az: 5, d: 22 }],
    'historia/kaldera-spor': [
      { u: 0, cel: 'las-canadas', az: 200, d: 12, h: 3.4, fov: 24 },
      { u: 1, az: 160 }],
    // H6 (recenzja kinowa r1, I1b): cięcie dopasowane — start dokładnie w pozie końca H5, zmienia się tylko chwila (Teide
    // wyrasta), potem odjazd ku Teide; wyjątek RUCH-9 jawny w teście
    'historia/teide-w-bliznie': [{ u: 0, cel: 'las-canadas', az: 160, d: 12, h: 3.4, fov: 24 }, { u: 1, cel: 'teide', az: 125, d: 14, h: 4.8 }],
    'historia/ludzie': [{ u: 0, cel: 'teide', az: 180, d: 70, h: 40, fov: 28 }, { u: 1, d: 68 }],
    'historia/luna': KADR_P0,
    'historia/lawa-schodzi': [0, 0.25, 0.5, 0.75, 1].map(function (q, i) {
      var k = { u: q, cel: { tor: 'lawa1706', f: 0.1 + 0.5 * q } };
      // az 240° (recenzja kinowa r1, §6, chciała 250°): tor lawy bardziej po przekątnej ku miastu; 250° wypycha Garachico za
      // lewą krawędź kadru 2.39 na starcie (KAD-3)
      if (i === 0) { k.az = 240; k.d = 5.3; k.nad = 1.5; k.fov = 32; }
      return k;
    }),
    'historia/port': KADR_H10,
    'historia/swit-po': KADR_H10,

    // R9.6 — przekrój (cięcie N–S przez Teide, ściana patrzy na wschód)
    'przekroj/blok': [{ u: 0, cel: 'teide', az: 135, d: 80, h: 40, fov: 28 }, { u: 1, d: 78 }],
    'przekroj/ciecie': [{ u: 1, d: 76, h: 39 }],
    'przekroj/profil': [
      { u: 0.3, cel: { czesc: 'teide', hc: 1.5 }, az: 120, d: 70, h: 27, fov: 24 },
      { u: 1, cel: { czesc: 'teide', hc: 0 }, az: 90, d: 120, h: 2, fov: 20 }],
    // X4 (recenzja kinowa r1, C4): oś schodzi do skorupy na pierwszym wersie i wraca w górę z kolejnymi warstwami — pasmo,
    // o którym mówi wers, jest w kadrze, gdy pada jego nazwa
    'przekroj/warstwy': [
      { u: 0.18, cel: { czesc: 'teide', dz: -10, hc: -4.5 }, d: 60, h: 1.2 },
      { u: 0.5, cel: { czesc: 'teide', dz: -2, hc: -2 } },
      { u: 1, cel: { czesc: 'teide', dz: 10, hc: -0.5 } }],
    'przekroj/komora': [{ u: 1, cel: { czesc: 'teide', hc: -0.5 }, az: 90, d: 34, h: 1, fov: 24 }],
    'przekroj/osady': [{ u: 1, cel: { czesc: 'icod', dz: -5, hc: -5 }, az: 95, d: 40, h: 1 }],
    'przekroj/zamkniecie': [
      { u: 0.5, cel: 'teide', az: 120, d: 62, h: 14, fov: 26 },
      { u: 1, az: 135, d: 66, h: 40, fov: 28 }],

    // R9.8 — mity: teza → K → dowód (w tym samym miejscu azymut stanowiska zmienia się o 30–150°)
    'mity/m-atlantyda-teza': [{ u: 0, cel: 'teide', az: 80, d: 70, h: 3, fov: 24 }, { u: 1, d: 62, h: 2.5 }],
    'mity/m-atlantyda-dowod': [{ u: 0, cel: { czesc: 'teide', hc: -1.0 }, az: 130, d: 110, h: -1.0, fov: 24 }, { u: 1, d: 104 }],
    'mity/m-wygasly-teza': [{ u: 0, cel: 'teide', az: 150, d: 30, h: 4.2, fov: 20 }, { u: 1, d: 27 }],
    'mity/m-wygasly-dowod': [{ u: 0, cel: 'teide', az: 200, d: 12.8, h: 4.3, fov: 14 }, { u: 1, d: 12.6 }],
    'mity/m-jeden-wulkan-teza': [{ u: 0, cel: 'teide', az: 300, d: 70, h: 27, fov: 28 }, { u: 1, d: 64, h: 26 }],
    'mity/m-jeden-wulkan-dowod': [{ u: 0, cel: 'teide', az: 200, d: 60, h: 50, fov: 28 }, { u: 1, d: 58 }],
    'mity/m-megatsunami-teza': [{ u: 0, cel: LA_PALMA, az: 120, d: 200, h: 230, fov: 26 }, { u: 1, d: 150, h: 175 }],
    'mity/m-megatsunami-dowod': [{ u: 0, cel: 'teno', az: 300, d: 150, h: 260, fov: 28 }, { u: 1, d: 146 }],
    'mity/m-najwyzszy-teza': [{ u: 0, cel: 'teide', az: 40, d: 30, h: 4.5, fov: 20 }, { u: 1, d: 27 }],
    'mity/m-najwyzszy-dowod': [{ u: 0, cel: 'teide', az: 120, d: 16, h: 3.6, fov: 24 }, { u: 1, az: 165 }],
    'mity/m-guayota-teza': [{ u: 0, cel: 'teide', az: 0, d: 26, h: 2.2, fov: 16 }, { u: 1, d: 24 }],
    'mity/m-guayota-dowod': [{ u: 0, cel: 'teide', az: 60, d: 15, h: 4.4, fov: 20 }, { u: 1, d: 14.5 }],

    // R9.9 — dziś
    'dzis/el-caleton': KADR_H10,
    'dzis/mikroklimaty': [
      { u: 0, cel: 'dorsal', az: 355, d: 14, h: 3.0, fov: 32 },
      { u: 1, cel: { czesc: 'dorsal', dz: 8 }, wzgledem: 'dorsal', az: 355, d: 4, h: 3.2, krzywa: 'cruise' }],
    'dzis/plaze': [{ u: 0, cel: 'montana-roja', az: 110, d: 10, h: 0.8, fov: 30 }, { u: 1, az: 160 }],
    'dzis/miasta': [
      { u: 0, cel: 'la-laguna', az: 40, d: 10, h: 2, fov: 30 },
      { u: 1, cel: { czesc: 'la-laguna', dx: -3, dz: 1 }, wzgledem: 'la-laguna', az: 340 }],
    'dzis/winnice': [{ u: 1, cel: 'orotava', az: 20, d: 9, h: 1.5, fov: 30 }],
    // D6 (recenzja kinowa r1, C5): stanowisko za doliną La Orotava (nad morzem na NE), Teide nad doliną — światła brzegu
    // zostają w dolnej części kadru przez cały wers (wcześniej kamera wisiała nad doliną i patrzyła od niej)
    'dzis/szlak': [{ u: 1, cel: 'teide', az: 40, d: 34, h: 2.0, fov: 24 }],
    'dzis/noc': [
      { u: 0.3, cel: 'teide', az: 30, d: 13, h: 2.6, fov: 16 },
      { u: 1, cel: { czesc: 'teide', hc: 5.1 }, fov: 38 }]
  };
  // R9.7 — okrążenie zgodnie z ruchem wskazówek zegara wokół środka wyspy (F1.1): kamera nad morzem, 22° za celem na
  // okręgu (cel ≥ 9 km), cel biegnie po brzegu (azymut i promień wokół środka między częściami), więc środek wyspy jest
  // cały czas po prawej stronie kadru; przy części cel = część (lonLat), tam lektor czyta wers. Cięcie K przed
  // `montana-roja` w ruchu, ten sam kierunek lotu. Finał: spirala od wschodu Teide na jego południe (niżej).
  var SRODEK_WYSPY = [-16.60556, 28.26861], KM_LAT = 111.2, KM_LON = 111.2 * Math.cos(28.26861 * Math.PI / 180);
  function biegunowe(ll) {
    var dx = (ll[0] - SRODEK_WYSPY[0]) * KM_LON, dz = -(ll[1] - SRODEK_WYSPY[1]) * KM_LAT;
    return [(Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360, Math.hypot(dx, dz)];
  }
  function naBrzegu(az, r) {
    var a = az * Math.PI / 180;
    return [SRODEK_WYSPY[0] + r * Math.sin(a) / KM_LON, SRODEK_WYSPY[1] + r * Math.cos(a) / KM_LAT];
  }
  var OKR = OKRAZENIE.slice(0, -1).map(function (z) {
    var b = biegunowe(czescDanych(z[0]).lonLat);
    return { id: z[0], az: b[0], r: b[1] };
  });
  // jeden obieg, rosnąco; Anaga i La Laguna leżą na jednym promieniu (1,2° różnicy) — krok radialny, nie wstecz
  OKR.forEach(function (o, i) {
    if (i === 0) return;
    var q = OKR[i - 1].az;
    if (o.az < q && o.az > q - 20) o.az = q + 4;
    while (o.az < q) o.az += 360;
  });
  // Güímar 2,2 km (było 1,8): pod wersem 1,2 wysokości oka na sekundę przy limicie R9.7 1,0 (recenzja kodu r1, Important 4)
  var OKR_ZA = 22, OKR_ODSUW = 14, OKR_MIJA = 3.5, OKR_H = { anaga: 1.6, 'la-laguna': 1.8, guimar: 2.2, 'montana-roja': 1.6,
    'los-gigantes': 1.6, masca: 2.0, garachico: 1.8, orotava: 2.0 };
  // Przy części kamera zwalnia: cel = część przez 16% ujęcia, stanowisko mija ją o ±3,5° (najwyżej ¼ odstępu do sąsiada),
  // czyli ok. 30% prędkości przelotu, nigdy zero (R9.7); między częściami cel przechodzi do następnej, stanowisko
  // przyspiesza. Środek postoju odsunięty od długich przelotów (Montaña Roja → Los Gigantes 94°, Garachico → La Orotava
  // 84°), żeby obrót pod wersem był ≤ 14°/s także przy nagraniach ×1,3.
  // Garachico: stanowisko 34° za częścią — przy 22° kamera z WNW patrzyłaby na wschód ze słońcem złotej godziny
  // dokładnie za plecami (157° od osi, SWI-1 ≤ 155°)
  var OKR_ZA_CZESCI = { garachico: 34 };
  var OKR_SRODEK = { guimar: 0.42, 'montana-roja': 0.27, 'los-gigantes': 0.73, garachico: 0.36, orotava: 0.62 };
  function kluczOkr(u, o, dAz) {
    return { u: u, cel: o.id, wzgledem: { lonLat: SRODEK_WYSPY, hc: 0 }, az: o.az - (OKR_ZA_CZESCI[o.id] || OKR_ZA) + dAz, d: o.r + OKR_ODSUW, h: OKR_H[o.id], fov: 32 };
  }
  OKR.forEach(function (o, i) {
    var k = [], sr = OKR_SRODEK[o.id] || 0.5;
    var p0 = OKR[i - 1], n0 = OKR[i + 1], mDo = Math.min(OKR_MIJA, p0 ? (o.az - p0.az) / 4 : OKR_MIJA), mPo = Math.min(OKR_MIJA, n0 ? (n0.az - o.az) / 4 : OKR_MIJA);
    if (i === 0) k.push(kluczOkr(0, o, -10));
    // ujęcia po cięciu K zaczynają się blisko swojej części (P2): bez długiego dolotu
    if (o.id === 'montana-roja' || o.id === 'los-gigantes' || o.id === 'orotava') k.push(kluczOkr(0, o, -10));
    k.push(kluczOkr(sr - 0.08, o, -mDo), kluczOkr(sr + 0.08, o, mPo));
    if (o.id === 'guimar') k.push(kluczOkr(1, o, 14));
    // przed cięciem K (P2): ujęcie kończy się niedaleko swojej części, bez dolotu do następnej
    if (o.id === 'montana-roja' || o.id === 'garachico') k.push(kluczOkr(1, o, 6));
    KAMERA['czesci/' + o.id] = k;
  });
  // finał: spirala w górę ku kraterowi (zgodnie z ruchem wskazówek zegara, wschodnie zbocze), cel ≥ 9 km; kadr końcowy
  // znad wschodniego zbocza na szczyt i kalderę w złotym świetle (kontra) — pełny zwrot „na północ” po okrążeniu
  // kończącym się na północy to obrót 180° w 13 s pod wersem (limit 14°/s) — raport Task 8a
  KAMERA['czesci/teide'] = [
    { u: 0.4, cel: 'teide', az: 35, d: 15, h: 3.6, fov: 30 },
    { u: 1, cel: 'teide', az: 75, d: 9, h: 5.0, fov: 30 }];

  // ───────────── budowa: id wersów, scena, zdarzenia przypięte do wersu ─────────────
  var ujecia = {}, wersy = {};
  ROZDZIALY.forEach(function (r) {
    ujecia[r] = []; wersy[r] = [];
    var n = 0;
    S[r].forEach(function (s) {
      var uj = {}, zdarzenia = [];
      Object.keys(s).forEach(function (k) { if (k !== 'nazwa' && k !== '_wersy') uj[k] = s[k]; });
      uj = Object.assign({ id: r + '/' + s.nazwa }, uj);
      s._wersy.forEach(function (x) {
        if (!x.id) n += 1;
        var wers = { id: x.id || 'teneryfa/' + r + '/' + n, tekst: x.tekst };
        if (x.wymowa || maNazwe(x.tekst)) wers.wymowa = fonetyka(x.wymowa || x.tekst);
        wers.scena = uj.id;
        if (x.czesc) wers.czesc = x.czesc;
        if (x.czas) wers.czas = x.czas;
        if (x.czasOd) wers.czasOd = true;
        x.zd.forEach(function (z) { zdarzenia.push({ wers: wers.id, po_s: z[0], co: z[1] }); });
        wersy[r].push(wers);
      });
      if (zdarzenia.length) uj.zdarzenia = zdarzenia;
      if (KAMERA[uj.id]) uj.kamera = KAMERA[uj.id];
      ujecia[r].push(uj);
    });
  });

  // Wers do nagrania: id, tekst i tekst czytany (wymowa po fonetyce) — ten sam przepis co w budowa() wyżej.
  function doNagrania(v) {
    var x = { id: v.id, tekst: v.tekst };
    if (v.wymowa || maNazwe(v.tekst)) x.wymowa = fonetyka(v.wymowa || v.tekst);
    return x;
  }

  // Wszystkie wersy dla generatora lektora (Task 9): rozdziały w kolejności, potem pozostałe czesci[].wers z dane.js
  // (części z okrążenia R9.7 już są w rozdziale `czesci` — jeden wers, jedno nagranie na część).
  function wszystkieWersy() {
    var wynik = [];
    ROZDZIALY.forEach(function (r) { wersy[r].forEach(function (x) { wynik.push(Object.assign({}, x)); }); });
    var juz = {};
    wynik.forEach(function (x) { if (x.czesc) juz[x.czesc] = true; });
    daneTeneryfy().czesci.forEach(function (c) {
      if (juz[c.id]) return;                                   // część z filmu: jej wers już jest (R9.7)
      var x = doNagrania(wersCzesci(c));
      x.czesc = c.id;
      wynik.push(x);
    });
    return wynik;
  }

  // ───────────── lektor na pinach makiety (Task 8d) ─────────────
  // Opisy wulkanów (geologia/teneryfa/wulkany.js, `opis` STRATO/OSRODKI) czytane w karcie pinu. Wymowa ręczna, bo opisy mają
  // daty i ułamki, które doWymowy generatora czyta w mianowniku („pięć stycznia”, „jeden przecinek dwa kilometra”);
  // `tekst` = bieżący opis (test pada, gdy opis się zmieni, a wymowa zostanie stara — wtedy wymowa nie jest używana).
  // Nazwy z FONETYKA zostają w zapisie oryginalnym (podmienia je fonetyka()); skróty i nazwy spoza FONETYKA zapisane fonetycznie.
  var WYMOWA_WULKANOW = {
    teide: { tekst: 'Teide ma 3718 metrów i jest najwyższą górą Hiszpanii oraz najwyższym wulkanem Atlantyku; część źródeł podaje 3715 metrów. Razem z Pico Viejo rośnie w kalderze Las Cañadas od około 170 tysięcy lat; według innych źródeł ich budowa ruszyła po wielkim osuwisku Icod sprzed około 200 tysięcy lat. Na wierzchołku ma krater szeroki na 80 metrów, z czynnymi fumarolami.',
      wymowa: 'Teide ma trzy tysiące siedemset osiemnaście metrów i jest najwyższą górą Hiszpanii oraz najwyższym wulkanem Atlantyku; część źródeł podaje trzy tysiące siedemset piętnaście metrów. Razem z Pico Viejo rośnie w kalderze Las Cañadas od około stu siedemdziesięciu tysięcy lat; według innych źródeł ich budowa ruszyła po wielkim osuwisku Icod sprzed około dwustu tysięcy lat. Na wierzchołku ma krater szeroki na osiemdziesiąt metrów, z czynnymi fumarolami.' },
    'pico-viejo': { tekst: 'Pico Viejo to młodszy, zachodni sąsiad Teide: ma 3134 metry według IGN, a 3129 metrów według Wikipedii. Jego krater, szeroki na około 800 metrów, jest największy na całym archipelagu. Na jego południowo-zachodnim zboczu w 1798 roku otworzyła się szczelina erupcji Chahorra.',
      wymowa: 'Pico Viejo to młodszy, zachodni sąsiad Teide: ma trzy tysiące sto trzydzieści cztery metry według hiszpańskiego Instytutu Geograficznego, a trzy tysiące sto dwadzieścia dziewięć metrów według Wikipedii. Jego krater, szeroki na około ośmiuset metrów, jest największy na całym archipelagu. Na jego południowo-zachodnim zboczu w tysiąc siedemset dziewięćdziesiątym ósmym roku otworzyła się szczelina erupcji Czaorra.' },
    'siete-fuentes': { tekst: 'Pierwszy z trzech ośrodków erupcji z lat 1704–1705. W ostatni dzień 1704 roku otworzyła się tu szczelina długości około 300 metrów i w kilka dni wyrósł niewielki stożek: 28 metrów według jednej karty Instytutu Geologiczno-Górniczego Hiszpanii, 37 metrów według drugiej. Trzęsienia ziemi towarzyszące tej erupcji zabiły co najmniej 16 osób.',
      wymowa: 'Pierwszy z trzech ośrodków erupcji z lat tysiąc siedemset cztery i tysiąc siedemset pięć. W ostatni dzień tysiąc siedemset czwartego roku otworzyła się tu szczelina długości około trzystu metrów i w kilka dni wyrósł niewielki stożek: dwadzieścia osiem metrów według jednej karty Instytutu Geologiczno-Górniczego Hiszpanii, trzydzieści siedem metrów według drugiej. Trzęsienia ziemi, które towarzyszyły tej erupcji, zabiły co najmniej szesnaście osób.' },
    fasnia: { tekst: 'Drugi ośrodek tej samej erupcji ruszył 5 stycznia 1705 roku, około 1,2 kilometra na północny wschód od Siete Fuentes. Wzdłuż szczeliny długości 1,3 kilometra powstały tu małe hornita, stożki żużlowe i jeziorka lawy, a lawa spłynęła dawnym wąwozem Areza na około 7 kilometrów.',
      wymowa: 'Drugi ośrodek tej samej erupcji ruszył piątego stycznia tysiąc siedemset piątego roku, około tysiąca dwustu metrów na północny wschód od Siete Fuentes. Wzdłuż szczeliny długości tysiąca trzystu metrów powstały tu małe hornita, stożki żużlowe i jeziorka lawy, a lawa spłynęła dawnym wąwozem Aresa na około siedmiu kilometrów.' },
    arafo: { tekst: 'Ostatni ośrodek erupcji z lat 1704–1705 otworzył się 2 lutego 1705 roku w kalderze Pedro Gil, 7,2 kilometra od dwóch poprzednich. Działał przez 54 dni według Instytutu Geologiczno-Górniczego Hiszpanii, a 53 według Volkiblogu; jego lawa rozlała się wachlarzem w dolinie Güímar i zatrzymała prawie nad morzem, 9 kilometrów od otworów.',
      wymowa: 'Ostatni ośrodek erupcji z lat tysiąc siedemset cztery – tysiąc siedemset pięć otworzył się drugiego lutego tysiąc siedemset piątego roku w kalderze Pedro Gil, siedem kilometrów i dwieście metrów od dwóch poprzednich. Działał przez pięćdziesiąt cztery dni według Instytutu Geologiczno-Górniczego Hiszpanii, a pięćdziesiąt trzy według Wolkibloga; jego lawa rozlała się wachlarzem w dolinie Güímar i zatrzymała prawie nad morzem, dziewięć kilometrów od otworów.' },
    garachico: { tekst: 'Wulkan Garachico, zwany też Arenas Negras albo Trevejo, wybuchł 5 maja 1706 roku i usypał stożek wysoki na około 80 metrów. Jego lawa dwukrotnie przelała się przez stary klif i częściowo zniszczyła miasto i port Garachico. Erupcja trwała do 13 czerwca według INVOLCAN; Wikipedia podaje 14 maja.',
      wymowa: 'Wulkan Garachico, zwany też Arenas Negras albo Trebecho, wybuchł piątego maja tysiąc siedemset szóstego roku i usypał stożek wysoki na około osiemdziesiąt metrów. Jego lawa dwukrotnie przelała się przez stary klif i częściowo zniszczyła miasto i port Garachico. Erupcja trwała do trzynastego czerwca według Inwolkan; Wikipedia podaje czternastego maja.' },
    chahorra: { tekst: 'Chahorra, zwana Narices del Teide, czyli Nosami Teide, to najdłuższa historyczna erupcja Teneryfy: według INVOLCAN trwała od 9 czerwca do 15 września 1798 roku, czyli 99 dni; Wikipedia podaje koniec 8 września. Wybuchła na południowo-zachodnim zboczu Pico Viejo, wzdłuż szczeliny długości ponad kilometra.',
      wymowa: 'Czaorra, zwana Narices del Teide, czyli Nosami Teide, to najdłuższa historyczna erupcja Teneryfy: według Inwolkan trwała od dziewiątego czerwca do piętnastego września tysiąc siedemset dziewięćdziesiątego ósmego roku, czyli dziewięćdziesiąt dziewięć dni; Wikipedia podaje koniec ósmego września. Wybuchła na południowo-zachodnim zboczu Pico Viejo, wzdłuż szczeliny długości ponad kilometra.' },
    chinyero: { tekst: 'Chinyero to miejsce ostatniej erupcji na Teneryfie. Zaczęła się 18 listopada 1909 roku i trwała 9 dni według Volkiblogu albo 10 według Wikipedii; lawa wypływała ze szczeliny długości ponad pół kilometra, nad którą wyrosły dwa stożki.',
      wymowa: 'Chinyero to miejsce ostatniej erupcji na Teneryfie. Zaczęła się osiemnastego listopada tysiąc dziewięćset dziewiątego roku i trwała dziewięć dni według Wolkibloga albo dziesięć według Wikipedii; lawa wypływała ze szczeliny długości ponad pół kilometra, nad którą wyrosły dwa stożki.' }
  };
  function daneWulkanow() {
    if (root.GeologiaWulkany) return root.GeologiaWulkany;
    if (typeof require === 'function') return require('./wulkany.js');
    return null;
  }
  function daneTurystyki() {
    if (root.GeologiaTurystyka) return root.GeologiaTurystyka;
    if (typeof require === 'function') return require('./turystyka.js');
    return null;
  }
  /* Które piny makiety mówią — jedyne miejsce tej decyzji (karta pinu w widok.js i lista generatora: wszystkieNagrania).
     wersPinu(rodzaj, pin, dane?) → { id, tekst, wymowa?, etykieta } | null
       'czesc'     — pin = część z dane.czesci: jej wers (c.wers, nagranie z Task 9); etykieta = nazwa części;
       'wulkan'    — pin z GeologiaWulkany.grupuj (pole `wpis` = id wpisu STRATO/OSRODKI): czyta `opis` wpisu, id wersu
                     'teneryfa/wulkan/<id wpisu>' (stały wobec odświeżenia OSM); pin bez wpisu (`pozostale`) → null;
       'turystyka' — punkt z GeologiaTurystyka.punkty: opisów (notatki praktyczne) nie czytamy — punkt z polem `czesc`
                     dostaje wers tej części wyspy (etykieta = jej nazwa, przycisk „Posłuchaj: <nazwa>”), bez pola → null.
     dane = { teneryfa, wulkany: { STRATO, OSRODKI }, turystyka } — domyślnie dane modułu (podmiana tylko w testach). */
  function wersPinu(rodzaj, pin, dane) {
    dane = dane || {};
    if (!pin) return null;
    var Dt = dane.teneryfa || daneTeneryfy();
    if (rodzaj === 'czesc') {
      if (!pin.wers || !pin.wers.id || !pin.wers.tekst) return null;
      return Object.assign(doNagrania(wersCzesci(pin)), { etykieta: pin.nazwa });
    }
    if (rodzaj === 'wulkan') {
      var Wd = dane.wulkany || daneWulkanow();
      if (!Wd || !pin.wpis) return null;
      var wp = (Wd.STRATO || []).concat(Wd.OSRODKI || []).filter(function (x) { return x.id === pin.wpis; })[0];
      if (!wp || typeof wp.opis !== 'string' || !wp.opis) return null;
      var r = WYMOWA_WULKANOW[wp.id];
      return Object.assign(doNagrania({ id: 'teneryfa/wulkan/' + wp.id, tekst: wp.opis, wymowa: r && r.tekst === wp.opis ? r.wymowa : undefined }),
        { etykieta: wp.nazwa });
    }
    if (rodzaj === 'turystyka') {
      if (!pin.czesc || !Dt) return null;
      var c = Dt.czesci.filter(function (x) { return x.id === pin.czesc; })[0];
      return c ? wersPinu('czesc', c, dane) : null;
    }
    return null;
  }
  // Wersy wszystkich mówiących pinów (bez powtórzeń: kilka punktów turystyki dzieli wers części).
  function wersyPinow(dane) {
    dane = dane || {};
    var Dt = dane.teneryfa || daneTeneryfy(), Wd = dane.wulkany || daneWulkanow(), Td = dane.turystyka || daneTurystyki();
    var wynik = [], juz = {};
    function dodaj(x) { if (x && !juz[x.id]) { juz[x.id] = true; wynik.push(x); } }
    Dt.czesci.forEach(function (c) { dodaj(wersPinu('czesc', c, dane)); });
    if (Wd) (Wd.STRATO || []).concat(Wd.OSRODKI || []).forEach(function (w) { dodaj(wersPinu('wulkan', { wpis: w.id }, dane)); });
    if (Td) Td.punkty.forEach(function (p) { dodaj(wersPinu('turystyka', p, dane)); });
    return wynik;
  }
  // Wszystko, co ma nagranie (generator i odsłuch lektora): wersy filmu i części (wszystkieWersy), potem wersy pinów,
  // których tam nie ma (opisy wulkanów).
  function wszystkieNagrania() {
    var wynik = wszystkieWersy(), juz = {};
    wynik.forEach(function (x) { juz[x.id] = true; });
    wersyPinow().forEach(function (x) {
      if (juz[x.id]) return;
      juz[x.id] = true;
      var y = { id: x.id, tekst: x.tekst };
      if (x.wymowa) y.wymowa = x.wymowa;
      wynik.push(y);
    });
    return wynik;
  }

  var api = { ROZDZIALY_TYTULY: ROZDZIALY_TYTULY, BUDZET: BUDZET, ujecia: ujecia, wersy: wersy, wszystkieWersy: wszystkieWersy,
    TRUDNE_NAZWY: TRUDNE_NAZWY, FONETYKA: FONETYKA, fonetyka: fonetyka, WYMOWA_CZESCI: WYMOWA_CZESCI,
    WYMOWA_WULKANOW: WYMOWA_WULKANOW, wersPinu: wersPinu, wersyPinow: wersyPinow, wszystkieNagrania: wszystkieNagrania };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GeologiaOpowiesc = api;
})(typeof window !== 'undefined' ? window : globalThis);
