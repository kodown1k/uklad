'use strict';
/* Zakładka Geologia → Teneryfa — warstwa „Wulkany” (Task 8c): stożki z OpenStreetMap w trzech grupach, opisy ze źródłami
   i liczba stożków z literatury. Czyste dane i funkcje (bez DOM/THREE); dual-export: przeglądarka window.GeologiaWulkany.
   Pozycje: OSM natural=volcano na lądzie Teneryfy (blok WULKANY — scripts/gen-wulkany-teneryfy.mjs; artefakt
   geologia/teneryfa/wulkany.json). Dane © współtwórcy OpenStreetMap, ODbL.
   Zasady źródeł jak w dane.js (ruling G-H): przy każdym opisie i pozycji ze źródła komentarz niesie DOSŁOWNY cytat
   z materiału pobranego w sesji 2026-11-22 (curl → pdftotext / HTML / wikitext / JSON API); `wysoka` tylko z pełnego
   tekstu; fakt ze streszczenia ma `pelnyTekst: false` i najwyżej `srednia`. Opisy są pisane do czytania (lektor, Task 8d):
   bez skrótów („około”, „metrów”, „roku”).
   Grupy (rozłączne, każdy pin w dokładnie jednej):
     strato      — stratowulkany Teide i Pico Viejo (STRATO);
     historyczne — ośrodki erupcji historycznych z dane.fakty `f-erupcje-historyczne` (1704–1705, 1706, 1798, 1909);
                   erupcja 1704–1705 ma trzy ośrodki (Siete Fuentes, Fasnia, Arafo) — OSRODKI;
     pozostale   — pozostałe stożki z OSM.
   Dopasowanie pinu do wpisu STRATO/OSRODKI: nazwa OSM pasuje do `wzorzec` i pin leży ≤ PROG_NAZWY_KM od pozycji
   ze źródła (homonimy, np. trzy „Montaña Negra”, odpadają) — najbliższy z takich; bez tego najbliższy pin ≤ PROG_KM.
   Wpis bez pinu w OSM dostaje pin z pozycją ze źródła i dopiskiem DOPISEK_BRAKU (lista `braki`).
   API: grupuj(wulkany, erupcje) → { strato, historyczne, pozostale, braki } (erupcje = lista ośrodków, domyślnie OSRODKI);
        legenda(grupy, fakt) → { naMapie, wGrupach: { strato, historyczne, pozostale }, erupcje, osrodki,
          literatura: { tekst, zrodlo, pewnosc } }. */
(function (root) {
  var PROG_KM = 1.5, PROG_NAZWY_KM = 5;
  var GRUPY = ['strato', 'historyczne', 'pozostale'];
  var NAZWY_GRUP = { strato: 'stratowulkany', historyczne: 'stożki erupcji historycznych', pozostale: 'pozostałe stożki' };
  var KOLORY_GRUP = { strato: '#ff5a36', historyczne: '#ffc21a', pozostale: '#c3a6ff' };
  var DOPISEK_BRAKU = 'pozycja ze źródła, brak w OSM';
  var ATRYBUCJA = '© współtwórcy OpenStreetMap (ODbL)';

  function ficha(n, tytul) {
    var kat = n <= 9 ? '2020/03' : (n <= 30 ? '2020/02' : '2020/01');
    return 'INVOLCAN, Guía Geoturística de Tenerife 2019, ficha (LIG) ' + n + ' „' + tytul + '”, https://tfgeoturismo.involcan.org/wp-content/uploads/' + kat + '/Ficha-' + n + '.pdf';
  }
  // Źródła pobrane w sesji 2026-11-22 (curl); fichy INVOLCAN i strona IGN te same co w dane.js, pobrane ponownie.
  var Z = {
    ign: 'IGN (Instituto Geográfico Nacional), „Seismotectonics of Tenerife”, https://www.ign.es/web/resources/sismologia/tproximos/sismotectonica/pag_sismotectonicas/can_tenerife_en.html',
    igmeIC4044: 'IGME, Inventario Español de Lugares de Interés Geológico (IELIG), ficha IC4044 „Erupción múltiple de 1704-05 de Fasnia, Siete Fuentes y Arafo” (2014), https://info.igme.es/ielig/LIGInfo.aspx?codigo=IC4044',
    igmeTMP154: 'IGME, IELIG, ficha TMP154 „Montaña Negra o del Volcán”, https://info.igme.es/ielig/documentacion/ic/ic4044/documentos/d-ic4044-01.pdf',
    igmeTMP155: 'IGME, IELIG, ficha TMP155 „Volcán Fasnia”, https://info.igme.es/ielig/documentacion/ic/ic4044/documentos/d-ic4044-02.pdf',
    ngbe: 'IGN/CNIG, Nomenclátor Geográfico Básico de España przez geokoder CartoCiudad, https://www.cartociudad.es/geocoder/api/geocoder/candidates',
    volki: 'GEO3BCN-CSIC, Volkiblog „Historical eruptions in the Canary Islands” (Prieto-Torrell, Geyer), Zenodo 14607831, https://zenodo.org/records/14607831/files/VOLKIBLOG_HISTORICAS_ENG.pdf',
    wHistEs: 'Wikipedia (es), „Erupciones históricas de Tenerife” (wikitext pobrany 2026-11-22)',
    doniz2012: 'Dóniz-Páez J., Romero-Ruiz C., Sánchez N. (2012), „Quantitative Size Classification of Scoria Cones: The Case of Tenerife (Canary Islands, Spain)”, Physical Geography 33(6): 514–535, DOI 10.2747/0272-3646.33.6.514 — (streszczenie przez OpenAlex; pełny tekst za ochroną wydawcy — nie pobrano)',
    wTenerife: 'Wikipedia (en), „Tenerife” (wikitext pobrany 2026-11-22)',
    wGeol: 'Wikipedia (en), „Geology of the Canary Islands” (wikitext pobrany 2026-11-22), https://en.wikipedia.org/wiki/Geology_of_the_Canary_Islands',
    romero2021: 'Romero Ruiz C., Dóniz Páez J. (2021), „El relieve insular”, w: „Una visión geográfica de Tenerife: cuaderno de campo” (XXVII Congreso de la Asociación Española de Geografía), DOI 10.25145/c.27.Asociación.Geografía.2021.13, pełny tekst: https://riull.ull.es/xmlui/handle/915/26146'
  };

  // ───────────────────────────── stratowulkany ─────────────────────────────
  var STRATO = [
    // ficha 28: „LIG 28 Teide-Pico Viejo … Lat. 28,272189°; Long. -16,641039°” … „estamos ante el punto más alto de España (3718 metros)
    //   y es el volcán más alto del Atlántico y el tercero del mundo. Ambos edificios culminan en un cráter circular que para el
    //   Teide es de 80 m de diámetro y para Pico Viejo de unos 800 m.”
    // IGN: „The Teide is a stratovolcano of basanites and mafic phonolites that rises to 3,718 m and is crowned by a crater with fumarolic activity.”
    // wiek — rozbieżność, przedział w opisie; pewnosc obniżona do srednia (opis łączy fakty z pełnego tekstu i z Wikipedii):
    // wGeol: „In this {{cvt|16|x|20|km|mi}} caldera, since about 170,000 years ago, two related stratovolcanoes have formed”
    // wTenerife: „Finally, around 200,000 years ago, the giant Icod landslide occurred followed by eruptions that raised the ''Pico Viejo-Teide''”
    // 3715 m i około 170 tysięcy lat: dane.fakty f-teide-wysokosc (Ferrer 2020, Wikipedia „Tenerife”) i f-teide-pico-viejo (Wikipedia „Geology of the Canary Islands”).
    { id: 'teide', nazwa: 'Teide', etykieta: 'Teide', wzorzec: /^(pico del )?teide$/i, lonLat: [-16.641039, 28.272189],
      opis: 'Teide ma 3718 metrów i jest najwyższą górą Hiszpanii oraz najwyższym wulkanem Atlantyku; część źródeł podaje 3715 metrów. Razem z Pico Viejo rośnie w kalderze Las Cañadas od około 170 tysięcy lat; według innych źródeł ich budowa ruszyła po wielkim osuwisku Icod sprzed około 200 tysięcy lat. Na wierzchołku ma krater szeroki na 80 metrów, z czynnymi fumarolami.',
      pewnosc: 'srednia', zrodlo: ficha(28, 'Teide-Pico Viejo') + '; ' + Z.ign + '; 3715 m: Ferrer i in. (2020) i ' + Z.wTenerife + '; wiek 170 tysięcy lat: ' + Z.wGeol + '; osuwisko Icod około 200 tysięcy lat temu, po nim erupcje Pico Viejo-Teide: ' + Z.wTenerife + ' (rozbieżność źródeł, jak w dane.fakty f-teide-pico-viejo)' },
    // IGN: „Pico Viejo is another 3,134 m high stratovolcano composed of basalts and basanites. It has the biggest crater of the whole
    //   archipelago and in its SW slope an eruptive fissure was opened in 1798 that caused the eruption of the Chahorra volcano.”
    // „młodszy”: wGeol (https://en.wikipedia.org/w/index.php?title=Geology_of_the_Canary_Islands&action=raw): „its younger, smaller, western, close neighbour [[Pico Viejo]]”
    // ficha 28: „para Pico Viejo de unos 800 m”; 3129 m: dane.fakty f-pico-viejo (Wikipedia „Pico Viejo”); pozycja: dane.czesci pico-viejo.
    { id: 'pico-viejo', nazwa: 'Pico Viejo', etykieta: 'Pico Viejo', wzorzec: /^pico viejo$/i, lonLat: [-16.668, 28.262],
      opis: 'Pico Viejo to młodszy, zachodni sąsiad Teide: ma 3134 metry według IGN, a 3129 metrów według Wikipedii. Jego krater, szeroki na około 800 metrów, jest największy na całym archipelagu. Na jego południowo-zachodnim zboczu w 1798 roku otworzyła się szczelina erupcji Chahorra.',
      pewnosc: 'srednia', zrodlo: Z.ign + '; ' + ficha(28, 'Teide-Pico Viejo') + '; 3129 m: Wikipedia „Pico Viejo” (fakt makiety, pobrany 2026-11-21); młodszy: ' + Z.wGeol }
  ];

  // ───────────────────────────── ośrodki erupcji historycznych ─────────────────────────────
  // `rok` = erupcja z f-erupcje-historyczne (1704 = epizod 1704–1705), `okres` = jej zapis w UI, `etykieta` = napis pinu.
  // wHistEs: „'''Erupciones de los años 1704-1705''': Tuvo lugar a través de tres focos de emisión: Siete Fuentes, volcán de Fasnia
  //   y montaña del Valle o volcán de las Arenas.”
  // igmeIC4044: „Se trata de una erupción triple que dio lugar a la formación de los volcanes de Siete Fuentes (Arico), Fasnia y Arafo”
  var OSRODKI = [
    // igmeTMP154: „Montaña Negra o del Volcán … Es uno de los tres centros de emisión de la erupción de los años 1704-1705 … En apenas
    //   cinco días, el volcán de Montaña Negra o de Siete Fuentes levantó un cono volcánico de 37 m de altura, con un derrame lávico de
    //   1.200 m de recorrido máximo.” (municipio: ARICO)
    // igmeIC4044: „El día 31 de diciembre se produjo la apertura de una fisura eruptiva de unos 300 m de longitud en el dorso del edificio
    //   Cañadas y apenas a 1,5 km de distancia de la pared de Diego Hernández. Esta fractura estuvo en actividad apenas unos días y
    //   construyó un conjunto eruptivo alineado donde destaca un edificio en herradura de apenas 28 m de altura” … „dieron lugar a la
    //   muerte de, al menos, 16 personas” — rozbieżność wysokości stożka 28 / 37 m: obie w opisie.
    // ngbe (pozycja): „Montaña Negra (Montaña) (Arico)”, lat 28.2706909190001, lng -16.5294799799999
    { id: 'siete-fuentes', rok: 1704, okres: '1704–1705', nazwa: 'Siete Fuentes (Montaña Negra o del Volcán)', etykieta: 'Siete Fuentes 1704',
      wzorzec: /siete ?fuentes|montaña negra o del volcán/i, lonLat: [-16.529480, 28.270691],
      pozycja: 'IGN/CNIG NGBE „Montaña Negra (Arico)” = IGME TMP154 „Montaña Negra o del Volcán” (Siete Fuentes)', pozycjaPewnosc: 'srednia',
      opis: 'Pierwszy z trzech ośrodków erupcji z lat 1704–1705. W ostatni dzień 1704 roku otworzyła się tu szczelina długości około 300 metrów i w kilka dni wyrósł niewielki stożek: 28 metrów według jednej karty Instytutu Geologiczno-Górniczego Hiszpanii, 37 metrów według drugiej. Trzęsienia ziemi towarzyszące tej erupcji zabiły co najmniej 16 osób.',
      pewnosc: 'srednia', zrodlo: Z.igmeIC4044 + '; ' + Z.igmeTMP154 + '; pozycja: ' + Z.ngbe },
    // igmeIC4044: „El volcán de Fasnia comienza su actividad el 5 de enero de 1705, a 1,2 km al NE del anterior. Su actividad eruptiva se
    //   articula en torno a a una fractura de 1,3 km con múltiples centros de emisión, entre los que se encuentran pequeños hornitos, conos
    //   de escorias, y charcas de lava. Sus coladas … se canalizaron por el antiguo Barranco de Areza (hoy Barranco del Volcán) recorriendo
    //   unos 7 km” ; igmeTMP155: „Volcán Fasnia … Es otro de los tres centros de emisión de la erupción de los años 1704-1705”
    // Pozycja WYLICZONA (brak współrzędnych w źródle): 1,2 km na azymucie 45° od pozycji Siete Fuentes (NGBE) — niska.
    { id: 'fasnia', rok: 1704, okres: '1704–1705', nazwa: 'Volcán de Fasnia', etykieta: 'Fasnia 1705',
      wzorzec: /fasnia/i, lonLat: [-16.520815, 28.278322],
      pozycja: 'wyliczona: 1,2 km na NE od Siete Fuentes (IGME IC4044: „a 1,2 km al NE del anterior”)', pozycjaPewnosc: 'niska',
      opis: 'Drugi ośrodek tej samej erupcji ruszył 5 stycznia 1705 roku, około 1,2 kilometra na północny wschód od Siete Fuentes. Wzdłuż szczeliny długości 1,3 kilometra powstały tu małe hornita, stożki żużlowe i jeziorka lawy, a lawa spłynęła dawnym wąwozem Areza na około 7 kilometrów.',
      pewnosc: 'srednia', zrodlo: Z.igmeIC4044 + '; ' + Z.igmeTMP155 + '; 5–15 stycznia: ' + Z.volki },
    // igmeIC4044: „El último volcán, el de Arafo, abre sus respiraderos en el interior de la caldera de Pedro Gil, el 2 de febrero de 1705,
    //   a 7,2 km de los anteriores. Permaneció en erupción 54 días y produjo un campo de coladas que se abren en abanico en el centro del
    //   Valle de Güímar … El frente de estas coladas llega casi hasta el mar, en las proximidades de la playa de El Socorro, a 9 Km de sus
    //   centros de emisión” ; volki (tabela): „Arafo 2 February – 27 March 53” — rozbieżność 54 / 53 dni: obie w opisie.
    // igmeTMP155: „El tercer centro, Montaña de Las Arenas (Güimar)” ; ngbe (pozycja): „Montaña de las Arenas (Montaña) (Arafo)”,
    //   lat 28.3402709970001, lng -16.4619750979999
    { id: 'arafo', rok: 1704, okres: '1704–1705', nazwa: 'Volcán de Arafo (Montaña de las Arenas)', etykieta: 'Arafo 1705',
      wzorzec: /arafo|montaña de las arenas/i, lonLat: [-16.461975, 28.340271],
      pozycja: 'IGN/CNIG NGBE „Montaña de las Arenas (Arafo)” = IGME TMP155 „Montaña de Las Arenas”', pozycjaPewnosc: 'srednia',
      opis: 'Ostatni ośrodek erupcji z lat 1704–1705 otworzył się 2 lutego 1705 roku w kalderze Pedro Gil, 7,2 kilometra od dwóch poprzednich. Działał przez 54 dni według Instytutu Geologiczno-Górniczego Hiszpanii, a 53 według Volkiblogu; jego lawa rozlała się wachlarzem w dolinie Güímar i zatrzymała prawie nad morzem, 9 kilometrów od otworów.',
      pewnosc: 'srednia', zrodlo: Z.igmeIC4044 + '; ' + Z.igmeTMP155 + '; ' + Z.volki + '; pozycja: ' + Z.ngbe },
    // ficha 42: „LIG 42 Volcán Garachico El Tanque-Garachico Lat. 28,316175°; Long. -16,762999°” … „edificando un volcán de escorias,
    //   lapilli y abundantes bombas volcánicas, de unos 80 metros de altura”
    // ficha 41: „La erupción de Arenas Negras de 1706 se inició el 5 de mayo y finalizó el 13 de junio.” … „las lenguas de lava alcanzaron
    //   el día 5 y luego el 13 de mayo el antiguo cantil y descendieron por él formando taludes escoriáceos hasta alcanzar la villa y puerto
    //   de Garachico que destruyeron parcialmente.” ; 14 maja: dane.fakty f-1706 (Wikipedia „Eruption of Trevejo”).
    { id: 'garachico', rok: 1706, okres: '1706', nazwa: 'Volcán de Garachico (Arenas Negras, Trevejo)', etykieta: 'Garachico 1706',
      wzorzec: /garachico|trevejo|arenas negras/i, lonLat: [-16.762999, 28.316175],
      pozycja: 'INVOLCAN, ficha 42 „Volcán Garachico” (Lat. 28,316175°; Long. -16,762999°)', pozycjaPewnosc: 'wysoka',
      opis: 'Wulkan Garachico, zwany też Arenas Negras albo Trevejo, wybuchł 5 maja 1706 roku i usypał stożek wysoki na około 80 metrów. Jego lawa dwukrotnie przelała się przez stary klif i częściowo zniszczyła miasto i port Garachico. Erupcja trwała do 13 czerwca według INVOLCAN; Wikipedia podaje 14 maja.',
      pewnosc: 'wysoka', zrodlo: ficha(41, 'Taludes Lávicos Garachico') + '; ' + ficha(42, 'Volcán Garachico') + '; 14 maja: Wikipedia „Eruption of Trevejo” (fakt makiety, pobrany 2026-11-21)' },
    // ficha 32: „LIG 32 … Lat. 28,255141°; Long. -16,677862°” … „Narices del Teide es la erupción histórica más larga de Tenerife, su
    //   actividad se inició el 9 de junio de 1798 y cesó el 15 de septiembre del mismo año. Está localizada en el flanco SO de Pico Viejo”
    //   … „A lo largo de la fractura de más de 1 km de longitud y de dirección NE-SO”
    // volki (tabela): „1798 Tenerife Chahorra 9 June – 15 September 99” ; wHistEs: „La erupción se produjo en el [[Pico Viejo]] el día
    //   9 de junio de 1798 y terminó el 8 de septiembre del mismo año.” — rozbieżność końca: obie daty w opisie.
    { id: 'chahorra', rok: 1798, okres: '1798', nazwa: 'Chahorra (Narices del Teide)', etykieta: 'Chahorra 1798',
      wzorzec: /chahorra|narices del teide/i, lonLat: [-16.677862, 28.255141],
      pozycja: 'INVOLCAN, ficha 32 „Las Narices del Teide / Chahorra” (Lat. 28,255141°; Long. -16,677862°)', pozycjaPewnosc: 'wysoka',
      opis: 'Chahorra, zwana Narices del Teide, czyli Nosami Teide, to najdłuższa historyczna erupcja Teneryfy: według INVOLCAN trwała od 9 czerwca do 15 września 1798 roku, czyli 99 dni; Wikipedia podaje koniec 8 września. Wybuchła na południowo-zachodnim zboczu Pico Viejo, wzdłuż szczeliny długości ponad kilometra.',
      pewnosc: 'wysoka', zrodlo: ficha(32, 'Las Narices del Teide / Chahorra') + '; ' + Z.volki + '; 8 września: ' + Z.wHistEs },
    // ficha 45: „LIG 45 … Lat. 28,294625°; Long. -16,756923°” … „La erupción del Chinyero de 1909 se desarrolló a lo largo de una
    //   fractura de dirección NO-SE de más de 0,5 km de longitud.” … „se generaron dos edificios volcánicos de desigual envergadura”
    // volki (tabela): „1909 Tenerife Chinyero 18-27 November 9” ; wHistEs: „Empezó el día 18 de noviembre de 1909 y duró 10 días.”
    { id: 'chinyero', rok: 1909, okres: '1909', nazwa: 'Chinyero', etykieta: 'Chinyero 1909',
      wzorzec: /chinyero/i, lonLat: [-16.756923, 28.294625],
      pozycja: 'INVOLCAN, ficha 45 „Volcán Chinyero” (Lat. 28,294625°; Long. -16,756923°)', pozycjaPewnosc: 'wysoka',
      opis: 'Chinyero to miejsce ostatniej erupcji na Teneryfie. Zaczęła się 18 listopada 1909 roku i trwała 9 dni według Volkiblogu albo 10 według Wikipedii; lawa wypływała ze szczeliny długości ponad pół kilometra, nad którą wyrosły dwa stożki.',
      pewnosc: 'wysoka', zrodlo: ficha(45, 'Volcán Chinyero') + '; ' + Z.volki + '; ' + Z.wHistEs }
  ];

  // ───────────────────────────── liczba stożków z literatury ─────────────────────────────
  // doniz2012 (streszczenie, OpenAlex abstract_inverted_index, pobrane 2026-11-22): „In this paper, we propose a methodology for
  //   calculating the size of monogenetic basaltic volcanoes based on morphometric parameters, as well as a classification of the size
  //   of the volcanoes through the study of 297 scoria cones of Tenerife.” … „Of the monogenetic basaltic volcanoes of Tenerife, 98.98%
  //   fit into this classification”
  // romero2021 (pełny tekst PDF, RIULL): „el campo volcánico de las Bandas del Sur el volcanismo basáltico monogénico se dispone de un
  //   modo más disperso que en las dorsales, reconociéndose múltiples fracturas ortogonales, orientadas según rumbos NNE-SSO y NO-SE que
  //   agrupan el 32 % (95 edificios) de los centros eruptivos de Tenerife (Dóniz Páez, 2009).” — 95 / 0,32 ≈ 297: zgodne, ale pośrednio.
  // Inne pobrane: EGU24-13196 (Asensio-Ramos i in.): „The oriented North South Rift Zone (NSRZ; 325 km2) … comprising 139 monogenetic
  //   cones” — liczba dla jednego ryftu o innym obrysie niż pole Bandas del Sur, nie dla wyspy; bez przedziału.
  // Liczba 297 wprost tylko w streszczeniu → pelnyTekst: false, pewnosc najwyżej srednia (G-H).
  var LITERATURA = { id: 'f-stozki-literatura', rozdzial: 'dzis', pewnosc: 'srednia', pelnyTekst: false,
    zrodlo: Z.doniz2012 + '; zgodnie (95 ośrodków = 32 procent): ' + Z.romero2021,
    tekst: 'Zespół Javiera Dóniza-Páeza zbadał na Teneryfie 297 stożków żużlowych, czyli małych wulkanów, z których każdy powstał w jednej erupcji. Według pracy Romero Ruiz i Dóniza-Páeza z 2021 roku 95 ośrodków erupcji, około jednej trzeciej wszystkich na wyspie, leży w polu Bandas del Sur.',
    krotko: '297 stożków żużlowych (Dóniz-Páez i in. 2012)',
    liczby: { stozki: { wartosc: 297, jednostka: 'stożków żużlowych' }, bandasDelSur: { wartosc: 95, jednostka: 'ośrodków erupcji (32%)' } } };

  /* WULKANY:POCZATEK (generowane: scripts/gen-wulkany-teneryfy.mjs — nie edytować ręcznie) */
  var OSM = {"zrodlo":"OpenStreetMap (ODbL)","licencja":"© współtwórcy OpenStreetMap, ODbL — https://www.openstreetmap.org/copyright","pobrano":"2026-11-22","stanOsm":"2026-11-22T16:10:06Z"};
  var WULKANY = [{"id":"node/11331629185","lon":-16.645747,"lat":28.077075,"nazwa":"Montaña Las Tabaibas","ele":null,"typ":null,"status":null},{"id":"node/11331629186","lon":-16.703836,"lat":28.065791,"nazwa":"Montaña el Mojón","ele":288,"typ":null,"status":null},{"id":"node/11331629188","lon":-16.62668,"lat":28.041859,"nazwa":"Montaña los Erales","ele":null,"typ":null,"status":null},{"id":"node/11581530537","lon":-16.39469,"lat":28.499681,"nazwa":"Montaña de la Atalaya","ele":601,"typ":null,"status":null},{"id":"node/11581530540","lon":-16.387906,"lat":28.496171,"nazwa":"Montaña de la Caldera","ele":646,"typ":null,"status":null},{"id":"node/12344509544","lon":-16.757362,"lat":28.283219,"nazwa":"Montaña Roca Cangrejo","ele":1576,"typ":null,"status":null},{"id":"node/12438589462","lon":-16.596327,"lat":28.107518,"nazwa":"Montaña Chiñama","ele":681,"typ":null,"status":"extinct"},{"id":"node/12582782248","lon":-16.847996,"lat":28.338678,"nazwa":"Montañeta del Palmar","ele":643,"typ":null,"status":null},{"id":"node/12582782283","lon":-16.780903,"lat":28.317823,"nazwa":"Montaña de la Quebrada","ele":1289,"typ":null,"status":"extinct"},{"id":"node/12582782293","lon":-16.7639,"lat":28.273433,"nazwa":null,"ele":null,"typ":null,"status":"extinct"},{"id":"node/12582782300","lon":-16.719807,"lat":28.262336,"nazwa":null,"ele":1971,"typ":null,"status":"extinct"},{"id":"node/12582911497","lon":-16.528436,"lat":28.271929,"nazwa":null,"ele":2252,"typ":null,"status":null},{"id":"node/12583026810","lon":-16.543139,"lat":28.296893,"nazwa":null,"ele":2334,"typ":null,"status":null},{"id":"node/12583026831","lon":-16.581411,"lat":28.28537,"nazwa":"Montaña de los Corrales","ele":2256,"typ":null,"status":"extinct"},{"id":"node/12583027020","lon":-16.45816,"lat":28.152809,"nazwa":"Montaña Centinela","ele":271,"typ":null,"status":"extinct"},{"id":"node/12583027051","lon":-16.6299,"lat":28.034344,"nazwa":"Montañita del Charco","ele":108,"typ":null,"status":null},{"id":"node/12583027052","lon":-16.630087,"lat":28.031798,"nazwa":"Montaña Negra","ele":127,"typ":null,"status":null},{"id":"node/12583027053","lon":-16.632907,"lat":28.027943,"nazwa":"Montaña del Majano","ele":115,"typ":null,"status":null},{"id":"node/12583027055","lon":-16.636513,"lat":28.023729,"nazwa":"Morro de los Lirios","ele":98,"typ":null,"status":null},{"id":"node/12583027057","lon":-16.635799,"lat":28.021453,"nazwa":"Montaña de Malpasito","ele":119,"typ":null,"status":null},{"id":"node/12583043620","lon":-16.68989,"lat":28.01452,"nazwa":"Montaña Cumplida","ele":129,"typ":null,"status":null},{"id":"node/12585612911","lon":-16.733387,"lat":28.296227,"nazwa":null,"ele":1751,"typ":null,"status":"extinct"},{"id":"node/12585612919","lon":-16.742517,"lat":28.280629,"nazwa":null,"ele":1761,"typ":null,"status":"extinct"},{"id":"node/12595068306","lon":-16.356852,"lat":28.476561,"nazwa":"Montaña del Aire o de las Tabaidas","ele":679,"typ":null,"status":"extinct"},{"id":"node/12595068320","lon":-16.366448,"lat":28.509582,"nazwa":"Montaña Molina","ele":394,"typ":null,"status":"extinct"},{"id":"node/12599320546","lon":-16.317508,"lat":28.554412,"nazwa":"Volcán de las Rosas","ele":517,"typ":null,"status":"extinct"},{"id":"node/12599320852","lon":-16.622433,"lat":28.060126,"nazwa":"Montaña de la Aldea","ele":246,"typ":null,"status":null},{"id":"node/12599320853","lon":-16.62157,"lat":28.064376,"nazwa":"Montaña de la Estrella","ele":322,"typ":null,"status":null},{"id":"node/12599320854","lon":-16.619589,"lat":28.068279,"nazwa":"Montaña Lucena","ele":325,"typ":null,"status":null},{"id":"node/12599320860","lon":-16.643965,"lat":28.068495,"nazwa":"Montaña del Puente","ele":333,"typ":null,"status":null},{"id":"node/12599320861","lon":-16.645737,"lat":28.071999,"nazwa":null,"ele":355,"typ":null,"status":null},{"id":"node/12599320890","lon":-16.588486,"lat":28.12259,"nazwa":"Montaña de las Chozas","ele":844,"typ":null,"status":null},{"id":"node/12599320896","lon":-16.584955,"lat":28.133703,"nazwa":"Montaña Santa","ele":888,"typ":null,"status":null},{"id":"node/12599320903","lon":-16.6086,"lat":28.177734,"nazwa":"Montaña Colorada","ele":1795,"typ":null,"status":null},{"id":"node/12599983898","lon":-16.7491,"lat":28.292564,"nazwa":null,"ele":1583,"typ":null,"status":null},{"id":"node/1286989133","lon":-16.612879,"lat":28.06804,"nazwa":"Montaña de Chimbesque","ele":426,"typ":null,"status":null},{"id":"node/1286989134","lon":-16.644319,"lat":28.077492,"nazwa":"Montaña Las Tabaibas","ele":471,"typ":null,"status":null},{"id":"node/1298215347","lon":-16.526548,"lat":28.297103,"nazwa":"Montaña de la Carnicería","ele":2381,"typ":null,"status":null},{"id":"node/1298215349","lon":-16.531219,"lat":28.294967,"nazwa":"Montaña de Enmedio","ele":2362,"typ":null,"status":null},{"id":"node/1298215353","lon":-16.533328,"lat":28.288076,"nazwa":"Montaña Abreu","ele":2406,"typ":null,"status":null},{"id":"node/1298215356","lon":-16.544402,"lat":28.294917,"nazwa":"Montaña de Maja","ele":2365,"typ":null,"status":null},{"id":"node/1298215363","lon":-16.524455,"lat":28.287506,"nazwa":"Montaña de las Vacas","ele":2363,"typ":null,"status":null},{"id":"node/1349744497","lon":-16.293109,"lat":28.442,"nazwa":"Montaña de Taco","ele":365,"typ":null,"status":"extinct"},{"id":"node/1350211096","lon":-16.334404,"lat":28.417383,"nazwa":"Montaña Jagua","ele":464,"typ":null,"status":"extinct"},{"id":"node/13595308959","lon":-16.637475,"lat":28.011801,"nazwa":null,"ele":69,"typ":null,"status":null},{"id":"node/13595308960","lon":-16.636027,"lat":28.011328,"nazwa":null,"ele":39,"typ":null,"status":null},{"id":"node/1370579125","lon":-16.356817,"lat":28.419783,"nazwa":"Montaña Toriño","ele":763,"typ":null,"status":"extinct"},{"id":"node/1578776749","lon":-16.562005,"lat":28.391383,"nazwa":"Montaña los Frailes","ele":371,"typ":null,"status":null},{"id":"node/1672845713","lon":-16.451086,"lat":28.43989,"nazwa":"Montañas de San Antonio","ele":null,"typ":null,"status":null},{"id":"node/1672845789","lon":-16.449242,"lat":28.440344,"nazwa":"Montaña de San Antonio","ele":null,"typ":null,"status":null},{"id":"node/1672846046","lon":-16.44704,"lat":28.443235,"nazwa":"Montaña de la Atalaya","ele":null,"typ":null,"status":null},{"id":"node/1672846191","lon":-16.443445,"lat":28.445294,"nazwa":"Montaña de las Calderetas","ele":null,"typ":null,"status":null},{"id":"node/1698731166","lon":-16.590152,"lat":28.130193,"nazwa":"Montaña Cruz de Tea","ele":911,"typ":null,"status":null},{"id":"node/1707487784","lon":-16.685424,"lat":28.02068,"nazwa":"Montaña Aguzada","ele":119,"typ":null,"status":null},{"id":"node/1707487785","lon":-16.693192,"lat":28.012768,"nazwa":"Montaña Grande","ele":153,"typ":null,"status":null},{"id":"node/1707489007","lon":-16.694236,"lat":28.020155,"nazwa":"Montaña de la Caraba","ele":112,"typ":null,"status":null},{"id":"node/1712047770","lon":-16.380573,"lat":28.461823,"nazwa":"Montaña Facundo","ele":995,"typ":null,"status":null},{"id":"node/1712047801","lon":-16.391344,"lat":28.489175,"nazwa":"Montaña la Retama","ele":672,"typ":null,"status":null},{"id":"node/1721092685","lon":-16.546837,"lat":28.401017,"nazwa":"Las Arenas","ele":239,"typ":null,"status":"extinct"},{"id":"node/1723007194","lon":-16.694059,"lat":28.00649,"nazwa":"Montaña Pardela","ele":52,"typ":null,"status":null},{"id":"node/1723869200","lon":-16.347229,"lat":28.510016,"nazwa":"Montaña la Calderita","ele":537,"typ":null,"status":null},{"id":"node/1739016459","lon":-16.584177,"lat":28.091223,"nazwa":"Montaña Gorda","ele":646,"typ":null,"status":null},{"id":"node/1780848532","lon":-16.547949,"lat":28.25743,"nazwa":"Morro las Brujas","ele":2289,"typ":null,"status":null},{"id":"node/1792962826","lon":-16.581615,"lat":28.126144,"nazwa":"Montaña del Lugar","ele":802,"typ":null,"status":null},{"id":"node/1823219332","lon":-16.519964,"lat":28.305284,"nazwa":"Montaña de los Mallorquines","ele":2316,"typ":null,"status":null},{"id":"node/1823219348","lon":-16.535262,"lat":28.311708,"nazwa":"Montaña del Caramujo","ele":2161,"typ":null,"status":null},{"id":"node/1964085306","lon":-16.529119,"lat":28.091636,"nazwa":"Montaña de Ifara","ele":303,"typ":null,"status":null},{"id":"node/1964085307","lon":-16.534419,"lat":28.080027,"nazwa":"Montaña de los Riscos","ele":278,"typ":null,"status":null},{"id":"node/2000367569","lon":-16.74688,"lat":28.273529,"nazwa":"Montaña Cascajo","ele":1763,"typ":null,"status":"extinct"},{"id":"node/2026853452","lon":-16.767823,"lat":28.28722,"nazwa":"Montaña de los Poleos","ele":1480,"typ":null,"status":"extinct"},{"id":"node/2026853457","lon":-16.750161,"lat":28.286967,"nazwa":"Montaña la Corredera","ele":1655,"typ":null,"status":null},{"id":"node/2031694053","lon":-16.680872,"lat":28.052903,"nazwa":null,"ele":null,"typ":null,"status":null},{"id":"node/2037845918","lon":-16.792572,"lat":28.31219,"nazwa":"Montaña de Baso","ele":1223,"typ":null,"status":null},{"id":"node/2037845920","lon":-16.782886,"lat":28.315796,"nazwa":"Montaña del Banco","ele":1266,"typ":null,"status":"extinct"},{"id":"node/2072993026","lon":-16.645913,"lat":28.158252,"nazwa":"Montaña Ciruelita","ele":1572,"typ":null,"status":null},{"id":"node/2072993028","lon":-16.656198,"lat":28.147332,"nazwa":"Montaña de Doña Cándida","ele":1368,"typ":null,"status":null},{"id":"node/2072993029","lon":-16.671386,"lat":28.130689,"nazwa":"Montaña de Funes","ele":1207,"typ":null,"status":null},{"id":"node/2072993030","lon":-16.670687,"lat":28.136787,"nazwa":"Montaña de la Medida","ele":1255,"typ":null,"status":null},{"id":"node/2072993033","lon":-16.66897,"lat":28.144854,"nazwa":"Montaña de los Listones","ele":1401,"typ":null,"status":null},{"id":"node/2072993035","lon":-16.638898,"lat":28.14891,"nazwa":"Montaña del Coto","ele":1377,"typ":null,"status":null},{"id":"node/2072993036","lon":-16.641391,"lat":28.138087,"nazwa":"Montaña del Pozo","ele":1305,"typ":null,"status":null},{"id":"node/2133039262","lon":-16.736478,"lat":28.278105,"nazwa":"Montaña de las Cuevitas","ele":1807,"typ":null,"status":"extinct"},{"id":"node/2216003860","lon":-16.359404,"lat":28.437349,"nazwa":"Montaña del Huerto","ele":899,"typ":null,"status":null},{"id":"node/2323266161","lon":-16.564168,"lat":28.0883,"nazwa":"Montaña Yaco","ele":null,"typ":null,"status":null},{"id":"node/2324208753","lon":-16.61033,"lat":28.095441,"nazwa":"Montaña de Garañaña","ele":null,"typ":null,"status":null},{"id":"node/2828771227","lon":-16.529714,"lat":28.260214,"nazwa":"Montaña Yeja","ele":2184,"typ":null,"status":null},{"id":"node/2828780315","lon":-16.52948,"lat":28.270699,"nazwa":"Montaña Negra o del Volcán","ele":2251,"typ":null,"status":null},{"id":"node/296402595","lon":-16.764459,"lat":28.316149,"nazwa":"Montaña Negra","ele":1399,"typ":null,"status":null},{"id":"node/355286908","lon":-16.72,"lat":28.053917,"nazwa":"Montaña Chayofita","ele":114,"typ":"scoria","status":null},{"id":"node/355286912","lon":-16.690768,"lat":28.051372,"nazwa":"Montaña de Guaza","ele":428,"typ":null,"status":null},{"id":"node/425703197","lon":-16.66468,"lat":28.263924,"nazwa":"Pico Viejo","ele":3129,"typ":null,"status":null},{"id":"node/4293832405","lon":-16.667224,"lat":28.096068,"nazwa":"Montaña del Espadal","ele":580,"typ":null,"status":null},{"id":"node/4294799287","lon":-16.575822,"lat":28.06749,"nazwa":"Montaña Casablanca","ele":271,"typ":null,"status":null},{"id":"node/4294842098","lon":-16.574758,"lat":28.08019,"nazwa":"Montaña de las Tabaibas","ele":377,"typ":null,"status":null},{"id":"node/4294869671","lon":-16.57519,"lat":28.115905,"nazwa":"Montaña Acojeja","ele":654,"typ":null,"status":null},{"id":"node/5303288920","lon":-16.557595,"lat":28.310203,"nazwa":"Montaña de Guamaso","ele":2151,"typ":null,"status":null},{"id":"node/5349204583","lon":-16.356168,"lat":28.455477,"nazwa":"Montaña de Carboneras","ele":939,"typ":null,"status":null},{"id":"node/557226491","lon":-16.377327,"lat":28.313582,"nazwa":"Montaña Grande","ele":277,"typ":null,"status":null},{"id":"node/588143239","lon":-16.462084,"lat":28.340214,"nazwa":"Volcan de Arafo","ele":1584,"typ":null,"status":null},{"id":"node/592653126","lon":-16.513188,"lat":28.284473,"nazwa":"Volcanes de Fasnia","ele":2232,"typ":null,"status":null},{"id":"node/5926994651","lon":-16.703273,"lat":28.255899,"nazwa":"Montaña de La Cruz de Tea","ele":2212,"typ":null,"status":"extinct"},{"id":"node/5926994662","lon":-16.693049,"lat":28.253822,"nazwa":"Montaña de Chío","ele":2345,"typ":null,"status":"extinct"},{"id":"node/6313371262","lon":-16.343787,"lat":28.466881,"nazwa":"Montaña del Charcón","ele":762,"typ":null,"status":"extinct"},{"id":"node/6364592046","lon":-16.776818,"lat":28.289579,"nazwa":"Montaña Aguda","ele":1364,"typ":null,"status":"extinct"},{"id":"node/6447099369","lon":-16.642274,"lat":28.272693,"nazwa":"Teide","ele":3715,"typ":"stratovolcano","status":"dormant"},{"id":"node/645590680","lon":-16.284135,"lat":28.480119,"nazwa":"Montaña Guerra","ele":442,"typ":null,"status":"extinct"},{"id":"node/647896455","lon":-16.757086,"lat":28.294899,"nazwa":"Chinyero","ele":1552,"typ":null,"status":null},{"id":"node/647897317","lon":-16.791559,"lat":28.293689,"nazwa":"Montaña Bilma","ele":1371,"typ":null,"status":"extinct"},{"id":"node/648604478","lon":-16.781511,"lat":28.292089,"nazwa":null,"ele":null,"typ":null,"status":null},{"id":"node/648604676","lon":-16.779248,"lat":28.291409,"nazwa":null,"ele":null,"typ":null,"status":null},{"id":"node/649756104","lon":-16.33751,"lat":28.43342,"nazwa":"Talavera","ele":663,"typ":null,"status":null},{"id":"node/649801235","lon":-16.354942,"lat":28.439427,"nazwa":"Birmagen","ele":942,"typ":null,"status":null},{"id":"node/651538789","lon":-16.726773,"lat":28.270187,"nazwa":"Montaña de Sámara","ele":1932,"typ":null,"status":"extinct"},{"id":"node/651538790","lon":-16.71382,"lat":28.264771,"nazwa":"Montaña de la Botija","ele":2121,"typ":null,"status":"extinct"},{"id":"node/651538794","lon":-16.67679,"lat":28.254783,"nazwa":"Montaña Chahorra","ele":null,"typ":null,"status":null},{"id":"node/651657859","lon":-16.589267,"lat":28.291,"nazwa":"Montaña de los Tomillos","ele":2222,"typ":null,"status":"extinct"},{"id":"node/651658649","lon":-16.606406,"lat":28.306287,"nazwa":"Montaña Negra","ele":2112,"typ":null,"status":"extinct"},{"id":"node/652422882","lon":-16.836021,"lat":28.373132,"nazwa":"Montaña de Taco","ele":319,"typ":null,"status":null},{"id":"node/662302305","lon":-16.4312,"lat":28.371701,"nazwa":"Media Montaña","ele":1225,"typ":null,"status":null},{"id":"node/663952415","lon":-16.844537,"lat":28.338489,"nazwa":"Montañeta del Palmar","ele":653,"typ":null,"status":null},{"id":"node/672476611","lon":-16.635514,"lat":28.0102,"nazwa":"Montaña Amarilla","ele":68,"typ":null,"status":null},{"id":"node/7867893924","lon":-16.627431,"lat":28.301588,"nazwa":"Montaña Abejera Grande","ele":2127,"typ":null,"status":"extinct"},{"id":"node/8164750724","lon":-16.373484,"lat":28.313033,"nazwa":"Morras del Corcho","ele":183,"typ":null,"status":null},{"id":"node/8263479712","lon":-16.743815,"lat":28.288039,"nazwa":"Montaña de Abeque","ele":1746,"typ":"scoria","status":"extinct"},{"id":"node/8263479713","lon":-16.741908,"lat":28.301921,"nazwa":"Montaña de Liferte","ele":1597,"typ":"scoria","status":"extinct"},{"id":"node/8263506235","lon":-16.742739,"lat":28.316022,"nazwa":"Montaña de Bencheque","ele":1456,"typ":"scoria","status":"extinct"},{"id":"node/8328538674","lon":-16.769215,"lat":28.312976,"nazwa":"Montaña La Atalaya","ele":1403,"typ":null,"status":null},{"id":"node/936343115","lon":-16.519945,"lat":28.064439,"nazwa":"Montaña Pelada","ele":null,"typ":"shield","status":null}];
  /* WULKANY:KONIEC */

  /* ---------- czysta część ---------- */
  var RAD = Math.PI / 180;
  function km(a, b) {
    var dx = (b[0] - a[0]) * RAD * Math.cos((a[1] + b[1]) / 2 * RAD), dy = (b[1] - a[1]) * RAD;
    return 6371 * Math.hypot(dx, dy);
  }
  function kopia(p) { var o = {}; for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) o[k] = p[k]; return o; }

  // Najlepszy wolny pin dla wpisu: nazwa pasuje i ≤ PROG_NAZWY_KM, inaczej najbliższy ≤ PROG_KM.
  function dopasuj(wpis, wolne) {
    var najN = null, dN = Infinity, najO = null, dO = Infinity;
    wolne.forEach(function (p, i) {
      var d = km([p.lon, p.lat], wpis.lonLat);
      if (p.nazwa && wpis.wzorzec && wpis.wzorzec.test(p.nazwa) && d <= PROG_NAZWY_KM && d < dN) { dN = d; najN = i; }
      if (d <= PROG_KM && d < dO) { dO = d; najO = i; }
    });
    if (najN != null) return { i: najN, d: dN, jak: 'nazwa' };
    if (najO != null) return { i: najO, d: dO, jak: 'odleglosc' };
    return null;
  }
  function przypisz(wpis, wolne, grupa, braki) {
    var t = dopasuj(wpis, wolne), pin;
    if (t) {
      pin = kopia(wolne.splice(t.i, 1)[0]);
      pin.dopasowanie = t.jak; pin.odleglosc_km = Math.round(t.d * 1000) / 1000;
    } else {
      pin = { id: 'zrodlo/' + wpis.id, lon: wpis.lonLat[0], lat: wpis.lonLat[1], nazwa: wpis.nazwa, ele: null, typ: null, status: null,
        zZrodla: true, dopisek: DOPISEK_BRAKU, dopasowanie: null };
      braki.push({ wpis: wpis.id, grupa: grupa });
    }
    pin.grupa = grupa; pin.wpis = wpis.id; pin.etykieta = wpis.etykieta;
    if (grupa === 'historyczne') { pin.rok = wpis.rok; pin.okres = wpis.okres; }
    return pin;
  }
  function grupuj(wulkany, erupcje) {
    var wolne = (wulkany || []).slice(), braki = [];
    var strato = STRATO.map(function (w) { return przypisz(w, wolne, 'strato', braki); });
    var historyczne = (erupcje || OSRODKI).map(function (w) { return przypisz(w, wolne, 'historyczne', braki); });
    var pozostale = wolne.map(function (p) { var q = kopia(p); q.grupa = 'pozostale'; return q; });
    return { strato: strato, historyczne: historyczne, pozostale: pozostale, braki: braki };
  }
  function legenda(grupy, fakt) {
    var wszystkie = grupy.strato.concat(grupy.historyczne, grupy.pozostale);
    var lata = {};
    grupy.historyczne.forEach(function (p) { lata[p.rok] = 1; });
    var f = fakt || LITERATURA;
    return {
      naMapie: wszystkie.filter(function (p) { return !p.zZrodla; }).length,
      wGrupach: { strato: grupy.strato.length, historyczne: grupy.historyczne.length, pozostale: grupy.pozostale.length },
      erupcje: Object.keys(lata).length, osrodki: grupy.historyczne.length, braki: grupy.braki.length,
      literatura: { tekst: f.krotko || f.tekst, zrodlo: f.zrodlo, pewnosc: f.pewnosc }
    };
  }
  // Wpis (STRATO / OSRODKI) po id — opis, źródło, nazwa do karty.
  function wpis(id) {
    return STRATO.concat(OSRODKI).filter(function (w) { return w.id === id; })[0] || null;
  }

  var api = { PROG_KM: PROG_KM, PROG_NAZWY_KM: PROG_NAZWY_KM, GRUPY: GRUPY, NAZWY_GRUP: NAZWY_GRUP, KOLORY_GRUP: KOLORY_GRUP,
    DOPISEK_BRAKU: DOPISEK_BRAKU, ATRYBUCJA: ATRYBUCJA, STRATO: STRATO, OSRODKI: OSRODKI, LITERATURA: LITERATURA, OSM: OSM,
    wulkany: WULKANY, grupuj: grupuj, legenda: legenda, wpis: wpis, km: km };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GeologiaWulkany = api;
})(typeof window !== 'undefined' ? window : globalThis);
