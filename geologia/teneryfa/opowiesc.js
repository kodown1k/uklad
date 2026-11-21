'use strict';
/* Zakładka Geologia → Teneryfa — opowieść: scenopis filmów (spec R9) jako dane i wersy lektora w głosie Bajarza.
   Czyste dane, bez DOM/THREE; dual-export: przeglądarka window.GeologiaOpowiesc. Ładowany po dane.js (miejsca.js).
   Kolejność pracy jak w filmie: najpierw ujęcia (R9, bez kamery — klucze kamery dopisuje Task 8), potem wersy
   wpisane w ujęcia, w ich budżecie znaków (tempo lektora 12,1 zn./s, lektor ≤ ok. 75% czasu = 9 zn. na sekundę celu).
   Zasady treści: każda liczba z dane.js (test); pora doby 1706 tylko z erupcje[1706].przebieg (UCZ-2); w 1706 stawką
   jest port i miasto, nikt w Garachico nie zginął; spór badaczy nazwany wprost.
   Jedno źródło: wers jest zapisany w swoim ujęciu (`w`), a `id`, `scena` i `zdarzenia` (przypięte do wersu) wylicza
   budowa() niżej — dopisanie wersu nie wymaga numerowania ręcznie.
   Wymowa: `wymowa` = tekst dla syntezatora (napis pokazuje `tekst`). Liczby słownie piszemy ręcznie (przypadek),
   nazwy hiszpańskie zamienia fonetyka() wg FONETYKA — nowa trudna nazwa = nowy wpis w FONETYKA. */
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
  function w(tekst, o) { o = o || {}; return { id: o.id, tekst: tekst, wymowa: o.wymowa, czesc: o.czesc, zd: o.zd || [] }; }
  // Ujęcie: u(nazwa, pola, wersy). Domyślnie woda realna, krajobraz, bez plakietki.
  function u(nazwa, p, wersy) {
    var o = { nazwa: nazwa, typ: p.typ, poziom: p.poziom, wejscie: p.wejscie, znaki: p.znaki, cel_s: p.cel_s };
    if (p.oddechPo_s !== undefined) o.oddechPo_s = p.oddechPo_s;
    o.obiekt = p.obiekt;
    o.swiatlo = p.swiatlo;
    o.woda = p.woda || 'realna';
    o.kolorowanie = p.kolorowanie || 'krajobraz';
    o.plakietka = p.plakietka || null;
    if (p.animacja) o.animacja = { nazwa: p.animacja[0], od: p.animacja[1], do: p.animacja[2] };
    if (p.etykiety) o.etykiety = p.etykiety;
    o._wersy = wersy || [];
    return o;
  }
  var TEIDE_WYSPA = { czesc: 'teide', promien_km: 40, promienPion_km: 28 };   // cała wyspa; pion: rdzeń wyspy (R9.1)
  var NOC_1706 = sw('z-danych', 65, -12);       // przebieg: „ok. godzinę przed świtem” = noc; słońce pod horyzontem na E
  var NIEZNANA_1706 = sw('z-danych', 292, -2);  // przebieg: pora 'nieznana' → światło zmierzchu (R9.5), lektor pory nie nazywa
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
      obiekt: { czesc: 'teide', promien_km: 250 }, swiatlo: sw('dzien', 268, 19) }, [
      w('Z błękitu wyłaniają się wyspy, rzucone w ocean jak okruchy.'),
      w('Największa to Teneryfa. Do Afryki masz stąd około 300 kilometrów.',
        { wymowa: 'Największa to Teneryfa. Do Afryki masz stąd około trzystu kilometrów.' })
    ]),
    u('wyspa', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'P', znaki: 190, cel_s: 20,
      obiekt: TEIDE_WYSPA, swiatlo: sw('zloty', 272, 16) }, [
      w('Wyspa ma trzy rogi, jak grot rzucony w morze.'),
      w('Grzbiety biegną od rogów do środka i tam się spotykają.'),
      w('Na spotkaniu stoi Teide: 3718 metrów, najwyżej w całej Hiszpanii.',
        { wymowa: 'Na spotkaniu stoi Teide: trzy tysiące siedemset osiemnaście metrów, najwyżej w całej Hiszpanii.' })
    ]),
    u('teide', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 110, cel_s: 12.5, oddechPo_s: 2.5,
      obiekt: { czesc: 'teide', promien_km: 28, promienPion_km: 28 }, swiatlo: sw('zloty', 278, 12) }, [
      w('Słońce już nisko. Cień wyspy kładzie się na morzu, a szczyt świeci najdłużej.')
    ])
  ];

  // R9.2 — jeden dzień: poranek (az 95–120°, el 14° → 35°), popołudnie w G6, kalima, powrót.
  S.geografia = [
    u('pod-chmurami', { typ: 'przelot', poziom: 'wyspa', wejscie: 'C', znaki: 100, cel_s: 10,
      obiekt: { czesc: 'orotava', promien_km: 2.9 }, swiatlo: sw('dzien', 100, 14) }, [
      w('Szaro i mokro. Wisisz pod chmurą, nad zieloną doliną La Orotava.')
    ]),
    u('przebicie', { typ: 'przelot', poziom: 'wyspa', wejscie: 'B', znaki: 70, cel_s: 9,
      obiekt: { czesc: 'teide', promien_km: 4 }, swiatlo: sw('dzien', 105, 18), animacja: ['a4', 0, 1] }, [
      w('Biel — i nagle słońce. Teide stoi nad morzem chmur.')
    ]),
    u('morze-chmur', { typ: 'statyw', poziom: 'wyspa', wejscie: 'K', znaki: 150, cel_s: 14,
      obiekt: { czesc: 'teide', promien_km: 4 }, swiatlo: sw('dzien', 110, 22), etykiety: ['anaga', 'teide'] }, [
      w('Pasat pcha wilgoć znad oceanu i układa ją na północnych stokach.'),
      w('Chmury rozbijają się o grzbiet jak fala o falochron.')
    ]),
    u('gran', { typ: 'przelot', poziom: 'wyspa', wejscie: 'K', znaki: 120, cel_s: 14,
      obiekt: { czesc: 'dorsal', promien_km: 3.5 }, swiatlo: sw('dzien', 115, 26) }, [
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
  function mapa(nazwa, p, wersy) { p.swiatlo = STUDIO; p.plakietka = 'mapa'; p.kolorowanie = p.kolorowanie || 'geologia'; return u(nazwa, p, wersy); }
  S.budowa = [
    mapa('mapa', { typ: 'statyw', poziom: 'wyspa', wejscie: 'C', znaki: 90, cel_s: 9, obiekt: TEIDE_WYSPA, kolorowanie: 'teren' }, [
      w('Zdrap z wyspy lasy i miasta. Pod spodem leży kamień różnego wieku.')
    ]),
    mapa('tarcze', { typ: 'okrazenie', poziom: 'wyspa', wejscie: 'D', znaki: 150, cel_s: 16, obiekt: { czesc: 'teide', promien_km: 40 } }, [
      w('Patrz, jak zapala się południe. To Roque del Conde, blisko dwanaście milionów lat.', { zd: [[0.3, 'jednostka:tarcza-roque-del-conde']] }),
      w('Potem zachodni róg, Teno.', { zd: [[0.3, 'jednostka:tarcza-teno']] }),
      w('I wschodni, Anaga — najmłodsza z trzech.', { zd: [[0.3, 'jednostka:tarcza-anaga']] })
    ]),
    mapa('gmach', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 130, cel_s: 14, obiekt: { czesc: 'las-canadas', promien_km: 10 } }, [
      w('Na nie wylewa się gmach Las Cañadas: wybuch po wybuchu, warstwa na warstwie.',
        { zd: [[0.3, 'jednostka:gmach-las-canadas'], [1.5, 'jednostka:dolina-icod'], [2.5, 'jednostka:reszta-mlodsze-pokrywy']] }),
      w('Sięgał około 4000 metrów. Dziś to ściany kaldery.',
        { wymowa: 'Sięgał około czterech tysięcy metrów. Dziś to ściany kaldery.' })
    ]),
    mapa('teide-pico-viejo', { typ: 'okrazenie', poziom: 'wyspa', wejscie: 'D', znaki: 130, cel_s: 14,
      obiekt: { czesc: 'teide', promien_km: 3 }, etykiety: ['teide', 'pico-viejo'] }, [
      w('W samym środku rosną Teide i Pico Viejo.', { zd: [[0.3, 'jednostka:teide-pico-viejo']] }),
      w('Na całej wyspie ciemny, twardy bazalt. Rzadziej fonolit, zielonkawy albo niebieskawy.')
    ]),
    mapa('ryfty', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 130, cel_s: 14, obiekt: { czesc: 'teide', promien_km: 35 } }, [
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
      obiekt: { czesc: 'teide', promien_km: 35 }, swiatlo: NEUTRALNE, woda: 'szklana', plakietka: 'rekonstrukcja', animacja: ['a1', 0, 0.15] }, [
      w('Stoisz na dnie, na jednej z najstarszych skorup oceanu na Ziemi.'),
      w('Szczeliny się żarzą. Lawa wychodzi w zimną wodę i stygnie w poduszki.')
    ]),
    u('wynurzenie', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'B', znaki: 100, cel_s: 12, oddechPo_s: 2,
      obiekt: { czesc: 'teide', promien_km: 20 }, swiatlo: NEUTRALNE, woda: 'szklana', plakietka: 'rekonstrukcja', animacja: ['a1', 0.15, 0.25] }, [
      w('Syk pary: około 12 milionów lat temu góra wychodzi nad wodę.',
        { wymowa: 'Syk pary: około dwunastu milionów lat temu góra wychodzi nad wodę.', zd: [[0.8, 'przebicie-tafli'], [1.2, 'woda:realna']] })
    ]),
    u('trzy-tarcze', { typ: 'statyw', poziom: 'wyspa', wejscie: 'K', znaki: 150, cel_s: 16,
      obiekt: TEIDE_WYSPA, swiatlo: NEUTRALNE, plakietka: 'rekonstrukcja', animacja: ['a1', 0.25, 0.6] }, [
      w('Rosną trzy tarcze, jedna po drugiej: na południu, potem Teno, potem Anaga.'),
      w('Czy stały osobno, jak wyspy? Badacze piszą tylko: prawdopodobnie.')
    ]),
    u('zrost', { typ: 'okrazenie', poziom: 'wyspa', wejscie: 'D', znaki: 150, cel_s: 16,
      obiekt: TEIDE_WYSPA, swiatlo: NEUTRALNE, plakietka: 'rekonstrukcja', animacja: ['a1', 0.6, 0.95] }, [
      w('Potem długa przerwa. Deszcz i morze gryzą skałę.'),
      w('Około 4 milionów lat temu środek budzi się znowu. Lawa skleja tarcze w jedną wyspę.',
        { wymowa: 'Około czterech milionów lat temu środek budzi się znowu. Lawa skleja tarcze w jedną wyspę.' })
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
  S.historia = [
    u('przed', { typ: 'statyw', poziom: 'wyspa', wejscie: 'C', znaki: 100, cel_s: 10,
      obiekt: { czesc: 'icod', promien_km: 4.2 }, swiatlo: NEUTRALNE, plakietka: 'rekonstrukcja' }, [
      w('Północne zbocze jeszcze stoi. Patrz na nie dobrze, bo zaraz go nie będzie.')
    ]),
    u('zbocze-rusza', { typ: 'statyw', poziom: 'wyspa', wejscie: 'D', znaki: 90, cel_s: 12,
      obiekt: { czesc: 'icod', promien_km: 6 }, swiatlo: NEUTRALNE, woda: 'szklana', plakietka: 'rekonstrukcja', animacja: ['a3', 0, 0.7] }, [
      w('Najpierw rusza pod wodą, etap po etapie. Na końcu zjeżdża to, co nad wodą.', { zd: [[0.2, 'start-a3']] })
    ]),
    u('fala-i-cisza', { typ: 'statyw', poziom: 'wyspa', wejscie: 'K', znaki: 80, cel_s: 10, oddechPo_s: 3,
      obiekt: { czesc: 'icod', promien_km: 15 }, swiatlo: NEUTRALNE, woda: 'szklana', plakietka: 'rekonstrukcja', animacja: ['a3', 0.7, 1] }, [
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
    u('teide-w-bliznie', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 100, cel_s: 10,
      obiekt: { czesc: 'teide', promien_km: 3 }, swiatlo: NEUTRALNE, plakietka: 'rekonstrukcja', animacja: ['a1', 0.95, 1] }, [
      w('W tej bliźnie od około 170 tysięcy lat rośnie Teide, a obok Pico Viejo.',
        { wymowa: 'W tej bliźnie od około stu siedemdziesięciu tysięcy lat rośnie Teide, a obok Pico Viejo.' })
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
      obiekt: GARACHICO, swiatlo: NIEZNANA_1706, plakietka: 'rekonstrukcja', animacja: ['a2', 0.1, 0.6] }, [
      w('Z ponad dwunastu otworów bije ogień, a lawa rusza w dół, ku miastu.'),
      w('Na dole czeka najważniejszy port wyspy.')
    ]),
    u('port', { typ: 'statyw', poziom: 'wstawka:garachico', wejscie: 'K', znaki: 110, cel_s: 17.5, oddechPo_s: 3.5,
      obiekt: { czesc: 'garachico', promien_km: 0.72 }, swiatlo: NIEZNANA_1706, plakietka: 'rekonstrukcja', animacja: ['a2', 0.6, 1] }, [
      w('Lawa przeskakuje klif, ramię za ramieniem. Kroniki doliczą się około siedmiu.', { zd: [[0.5, 'lawa-na-klifie']] }),
      w('Port znika. Część miasta ocaleje.')
    ]),
    u('swit-po', { typ: 'statyw', poziom: 'wstawka:garachico', wejscie: 'C', znaki: 70, cel_s: 9, oddechPo_s: 3,
      obiekt: { czesc: 'garachico', promien_km: 0.72 }, swiatlo: sw('swit', 70, 6), plakietka: 'rekonstrukcja', animacja: ['a2', 1, 1] }, [
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
    schemat('ciecie', { typ: 'statyw', poziom: 'wyspa', wejscie: 'D', znaki: 60, cel_s: 9, obiekt: BLOK }, [
      w('Zgrzyt kamienia. Połowa wyspy odjeżdża na bok.', { zd: [[0, 'ciecie-start']] })
    ]),
    schemat('profil', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 120, cel_s: 12, obiekt: { czesc: 'teide', promien_km: 21 } }, [
      w('Górna linia jest zmierzona. Wszystko pod nią to schemat, nie zdjęcie.'),
      w('Góry są tu wyciągnięte w górę trzy razy.')
    ]),
    schemat('warstwy', { typ: 'przelot', poziom: 'wyspa', wejscie: 'D', znaki: 160, cel_s: 16, obiekt: { czesc: 'teide', promien_km: 10.5 } }, [
      w('Na dole skorupa z czasów dinozaurów.', { zd: [[0.2, 'warstwa:w-skorupa'], [1.6, 'warstwa:w-osady']] }),
      w('Nad nią lawa zastygła pod wodą w szkliste okruchy, słaba i podatna.', { zd: [[0.2, 'warstwa:w-kompleks-podmorski']] }),
      w('Wyżej tarcze bazaltu, gmach Las Cañadas i Teide.',
        { zd: [[0.2, 'warstwa:w-tarcze'], [1.6, 'warstwa:w-gmach-canadas'], [3.4, 'warstwa:w-teide-pico-viejo']] })
    ]),
    schemat('komora', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 120, cel_s: 12, obiekt: { czesc: 'teide', promien_km: 6 } }, [
      w('Płytko pod Teide czeka magma: raczej kilka zbiorników niż jedna komora.', { zd: [[0.5, 'warstwa:w-zbiornik-fonolitowy']] }),
      w('Nikt ich nie widział. Ten obrys to szacunek.')
    ]),
    schemat('osady', { typ: 'przelot', poziom: 'wyspa', wejscie: 'D', znaki: 70, cel_s: 8, obiekt: { czesc: 'icod', promien_km: 15 } }, [
      w('Na dnie, daleko od brzegu, leży gruz zsuniętych zboczy.')
    ]),
    schemat('zamkniecie', { typ: 'dojazd', poziom: 'wyspa', wejscie: 'D', znaki: 50, cel_s: 8, oddechPo_s: 2.5, obiekt: BLOK }, [
      w('Złóż wyspę z powrotem.')
    ])
  ];

  // R9.7 — okrążenie zgodnie z ruchem wskazówek zegara; słońce schodzi monotonicznie (az 250° → 285°, el 30° → 10°).
  // Wers ujęcia = czesc.wers z dane.js (spec R9.7; jedno źródło — ten sam wers czyta karta makiety). Moduł go nie pisze.
  var OKRAZENIE = [['anaga', 'C'], ['la-laguna', 'D'], ['guimar', 'D'], ['montana-roja', 'K'], ['los-gigantes', 'D'],
    ['masca', 'D'], ['garachico', 'D'], ['orotava', 'D'], ['teide', 'D']];
  var ETYKIETY_OKRAZENIA = { garachico: ['garachico', 'el-caleton'], orotava: ['orotava', 'icod'] };
  S.czesci = OKRAZENIE.map(function (z, i, wszystkie) {
    var t = i / (wszystkie.length - 1), ostatnie = i === wszystkie.length - 1;
    var p = { typ: ostatnie ? 'okrazenie' : 'przelot', poziom: 'wyspa', wejscie: z[1], znaki: 100, cel_s: ostatnie ? 13 : 11.5,
      // kadr H ≥ 5 km (R9.7) → promień kadru ≥ 2,5 km
      obiekt: { czesc: z[0], promien_km: 2.5 },
      swiatlo: sw(t < 0.65 ? 'dzien' : 'zloty', Math.round(250 + 35 * t), Math.round(30 - 20 * t)),
      etykiety: ETYKIETY_OKRAZENIA[z[0]] || [z[0]] };
    if (ostatnie) p.oddechPo_s = 3;
    return u(z[0], p, [wersCzesci(czescDanych(z[0]))]);
  });

  // R9.8 — sześć par: teza (≤ 55 zn.) → stempel werdyktu na cięciu K → dowód (≤ 85 zn.). Werdykty z dane.mity.
  // M3 i M5 wybrane z danych: „jeden wulkan” (mit, kadr dowodu = B5 ryfty) i „najwyższa góra” (fakt, kadr G5).
  function para(id, teza, dowod) {
    return [
      u(id + '-teza', { typ: 'dojazd', poziom: teza.poziom || 'wyspa', wejscie: 'C', znaki: 55, cel_s: 6, obiekt: teza.obiekt,
        swiatlo: teza.swiatlo, plakietka: teza.plakietka }, [w(teza.w)]),
      u(id + '-dowod', { typ: dowod.typ || 'statyw', poziom: dowod.poziom || 'wyspa', wejscie: 'K', znaki: 85, cel_s: dowod.cel_s || 9.5,
        oddechPo_s: dowod.oddechPo_s, obiekt: dowod.obiekt, swiatlo: dowod.swiatlo, woda: dowod.woda, kolorowanie: dowod.kolorowanie,
        plakietka: dowod.plakietka, etykiety: dowod.etykiety }, [w(dowod.w, { wymowa: dowod.wymowa })])
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
        cel_s: 11.5, oddechPo_s: 2.5, obiekt: { czesc: 'teno', promien_km: 150 }, swiatlo: sw('dzien', 220, 30), plakietka: 'hipoteza' }),
    para('m-najwyzszy',
      { w: 'Ludzie powtarzają: „Teide to najwyższa góra Hiszpanii.”', obiekt: { czesc: 'teide', promien_km: 10 }, swiatlo: sw('dzien', 220, 30) },
      { typ: 'okrazenie', w: 'Tak: 3718 metrów, choć część źródeł podaje 3715.',
        wymowa: 'Tak: trzy tysiące siedemset osiemnaście metrów, choć część źródeł podaje trzy tysiące siedemset piętnaście.',
        obiekt: { czesc: 'teide', promien_km: 3.4 }, swiatlo: sw('dzien', 120, 30), etykiety: ['teide'] }),
    para('m-guayota',
      { w: 'Mówią: „W Teide uwięziony jest demon Guayota.”', obiekt: { czesc: 'teide', promien_km: 6 }, swiatlo: sw('noc', 290, -15),
        plakietka: 'legenda' },
      { w: 'Guanczowie wierzyli, że Guayota zamknął w górze słońce. Może pamiętali erupcję.',
        cel_s: 11.5, oddechPo_s: 2.5, obiekt: { czesc: 'teide', promien_km: 3 }, swiatlo: sw('noc', 290, -18), plakietka: 'legenda' })
  );

  // R9.9 — jeden dzień od rana do nocy; słońce i światła miast prowadzą czas.
  S.dzis = [
    u('el-caleton', { typ: 'statyw', poziom: 'wstawka:garachico', wejscie: 'C', znaki: 100, cel_s: 10,
      obiekt: { czesc: 'garachico', promien_km: 0.72 }, swiatlo: sw('dzien', 100, 18), etykiety: ['el-caleton', 'garachico'] }, [
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
      w('Gaśnie ostatnie okno. Tu chroni się skały, ale też ciemność nieba.'),
      w('Podnieś głowę. Wyspa, która wyszła z oceanu, patrzy teraz w gwiazdy.')
    ])
  ];

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
        x.zd.forEach(function (z) { zdarzenia.push({ wers: wers.id, po_s: z[0], co: z[1] }); });
        wersy[r].push(wers);
      });
      if (zdarzenia.length) uj.zdarzenia = zdarzenia;
      ujecia[r].push(uj);
    });
  });

  // Wszystkie wersy dla generatora lektora (Task 9): rozdziały w kolejności, potem pozostałe czesci[].wers z dane.js
  // (części z okrążenia R9.7 już są w rozdziale `czesci` — jeden wers, jedno nagranie na część).
  function wszystkieWersy() {
    var wynik = [];
    ROZDZIALY.forEach(function (r) { wersy[r].forEach(function (x) { wynik.push(Object.assign({}, x)); }); });
    var juz = {};
    wynik.forEach(function (x) { if (x.czesc) juz[x.czesc] = true; });
    daneTeneryfy().czesci.forEach(function (c) {
      if (juz[c.id]) return;                                   // część z filmu: jej wers już jest (R9.7)
      var v = wersCzesci(c), x = { id: v.id, tekst: v.tekst };
      if (v.wymowa || maNazwe(v.tekst)) x.wymowa = fonetyka(v.wymowa || v.tekst);
      x.czesc = c.id;
      wynik.push(x);
    });
    return wynik;
  }

  var api = { ROZDZIALY_TYTULY: ROZDZIALY_TYTULY, BUDZET: BUDZET, ujecia: ujecia, wersy: wersy, wszystkieWersy: wszystkieWersy,
    TRUDNE_NAZWY: TRUDNE_NAZWY, FONETYKA: FONETYKA, fonetyka: fonetyka, WYMOWA_CZESCI: WYMOWA_CZESCI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GeologiaOpowiesc = api;
})(typeof window !== 'undefined' ? window : globalThis);
