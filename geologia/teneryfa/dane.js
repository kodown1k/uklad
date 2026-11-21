'use strict';
/* Zakładka Geologia → Teneryfa — dane (czyste dane, bez DOM/THREE; dual-export: przeglądarka window.GeologiaTeneryfa).
   Pochodzenie: docs/superpowers/zrodla/teneryfa-fakty-z-sieci.md (zebrane 2026-11-21) oraz tekst właściciela
   docs/superpowers/zrodla/teneryfa-opis-wlasciciela.txt (zrodlo: 'opis właściciela (2026-11-21)').
   Zasada: LICZBA TYLKO ZE ŹRÓDŁA. Przy wpisie, którego źródło wskazuje stronę / fichę / sekcję, komentarz niesie
   DOSŁOWNY cytat z materiału pobranego w sesji 2026-11-21 (curl → pdftotext / wikitext; pisownia źródła, łącznie
   z jego literówkami). Wpis bez pobranego tekstu ma najwyżej `srednia` i dopisek „(streszczenie/pośrednio — nie pobrano)”.
   `wysoka` tylko z pełnego tekstu źródła instytucjonalnego lub recenzowanego (INVOLCAN, IGN, Ferrer i in., Hunt i in.,
   NASA). Rozbieżności zostają przedziałami z obydwoma źródłami — nic nie wybrano po cichu.
   Konwencje:
   - lon/lat WGS84, dziesiętne; [lon, lat].
   - Jednostki: wielokąty uproszczone z mapy geologicznej IGN (IGME 1:1M, 2015; obraz TenerifeMontaje.jpg ze strony
     sejsmotektonicznej IGN, georeferencja po siatce 15′ — reszta ≤ 0,33 px) i z Ferrer i in. 2020, fig. 1 (obrysy dolin).
     PRZYNALEŻNOŚĆ KOMÓRKI = PIERWSZA jednostka w kolejności tablicy, której wielokąt zawiera punkt (doliny przed
     ryftami, tarcze przed gmachem, ostatnia — zbiorcza — łapie resztę lądu). Granice: pewność najwyżej `niska`.
   - Ostatnia jednostka (`reszta-mlodsze-pokrywy`) ma wielokąt wyliczony z rzeźby (obrys lądu h > 0 z rzezba.png:
     96 azymutów od [−16,60; 28,30], najdalsza komórka lądu ±pół kroku + 1,5 km bufora), nie z mapy geologicznej.
   - `zapadniecie` = { Ma, wypelnienie_m, zakresMa, zrodlo }: przed `Ma` komórka stoi `wypelnienie_m` wyżej niż dziś
     (spec „Wnętrze i czas”); `odMa…doMa` to wzrost gmachu sprzed osuwiska (dzisiejsze wypełnienie doliny młodszymi
     lawami nie jest animowane osobno).
   - Warstwy: głębokość w m względem poziomu morza, dodatnia w dół (ujemna = nad morzem); odGlebokosci_m = spąg
     (głębiej), doGlebokosci_m = strop. Wszystkie `schemat: true`.
   - Pora doby w przebiegu erupcji: tylko to, co mówi źródło; brak pory → 'nieznana'. */
(function (root) {
  var PEWNOSC = ['wysoka', 'srednia', 'niska', 'bardzo-niska'];
  var SKALE = ['tarcza', 'gmach', 'stratowulkan', 'ryft', 'osad'];                       // jednostki[].skala
  var SKALE_WARSTW = ['skorupa', 'osad', 'gmach', 'tarcza', 'stratowulkan', 'komora'];  // warstwy[].skala (przekrój ma też skorupę i komorę)
  var WERDYKTY = ['fakt', 'mit', 'czesciowo', 'legenda'];
  var WLASCICIEL = 'opis właściciela (2026-11-21)';

  // Źródła (tytuł — wydawca/autorzy — rok/sekcja — URL). Kody jak w pliku faktów z sieci (Zxx).
  var Z = {
    ign: 'IGN (Instituto Geográfico Nacional), „Seismotectonics of Tenerife” — strona sejsmotektoniczna (Z24), https://www.ign.es/web/resources/sismologia/tproximos/sismotectonica/pag_sismotectonicas/can_tenerife_en.html',
    ignMapa: 'IGN, strona sejsmotektoniczna Teneryfy — mapa geologiczna „Leyenda de Tenerife” (źródło mapy: IGME, Mapa Geológico 1:1M, 2015), obraz images/Canarias/TenerifeMontaje.jpg',
    ferrer2020: 'Ferrer M., González de Vallejo L.I., García López-Davalillo J.C. (2020), „Geocronología de los megadeslizamientos de Tenerife del último millón de años. Parte I”, Boletín Geológico y Minero 131(4): 903–940 (IGME), https://info.igme.es/media/boletin/2020/131_4/BGM_131-4_Art-21.pdf',
    ferrer2011: 'Ferrer M. i in. (2011), „Güímar and La Orotava mega-landslides (Tenerife) and tsunamis deposits in Canary Islands”, Proc. 2nd World Landslide Forum, Rzym (PDF aguastenerife.org)',
    hunt2018: 'Hunt J.E., Cassidy M., Talling P.J. (2018), „Multi-stage volcanic island flank collapses with coeval explosive caldera-forming eruptions”, Scientific Reports 8:1146, DOI 10.1038/s41598-018-19285-2',
    nasa: 'NASA Earth Observatory, „Tenerife, Canary Islands” (obraz 88659), https://earthobservatory.nasa.gov/images/88659/tenerife-canary-islands',
    nasaPyl: 'NASA Earth Observatory, „Dust Storm Engulfs Canary Islands” (2022-01), https://science.nasa.gov/earth/earth-observatory/dust-storm-engulfs-canary-islands-149342/',
    wTenerife: 'Wikipedia (en), „Tenerife” (wikitext pobrany 2026-11-21)',
    wTeide: 'Wikipedia (en), „Teide” (wikitext pobrany 2026-11-21)',
    wTeidePN: 'Wikipedia (en), „Teide National Park” — infobox (wikitext pobrany 2026-11-21)',
    wGeol: 'Wikipedia (en), „Geology of the Canary Islands” — sekcje Regional setting, Age, Tenerife (wikitext pobrany 2026-11-21)',
    wTrevejo: 'Wikipedia (en), „Eruption of Trevejo” (wikitext pobrany 2026-11-21)',
    wHist: 'Wikipedia (en), „Historical eruptions in Tenerife” (wikitext pobrany 2026-11-21)',
    wGarachico: 'Wikipedia (en), „Garachico” (wikitext pobrany 2026-11-21)',
    wCanarias: 'Wikipedia (en), „Canary Islands” — sekcja Etymology (wikitext pobrany 2026-11-21)',
    wCumbre: 'Wikipedia (en), „Cumbre Vieja” — sekcja Potential megatsunami (wikitext pobrany 2026-11-21)',
    wDorsalEs: 'Wikipedia (es), „Cordillera Dorsal” (wikitext pobrany 2026-11-21)',
    wAnaga: 'Wikipedia (en), „Macizo de Anaga” (wikitext pobrany 2026-11-21)',
    tw1706: 'Tenerife Weekly / La Provincia (2021-09-21), „That fierce torrent in Tenerife that reduced Garachico to ashes” (cytuje kronikę fray Domingo José Cassaresa; Romero & Beltrán)',
    volki: 'GEO3BCN-CSIC, Volkiblog „Historical eruptions in the Canary Islands” (Prieto-Torrell, Geyer), Zenodo 14607831',
    egu26: 'Asensio-Ramos M. i in. (INVOLCAN/ITER), abstrakt EGU26-6518 (2026), „Long-term monitoring of anomalous diffuse CO2 and H2S emissions at Teide Crater”',
    rtvc: 'RTVC (2026-02-27), „Nemesio Pérez: «No hay motivos para un cambio de fase en Tenerife»” (INVOLCAN)',
    ddaIgn: 'Diario de Avisos (2026-02-13), wywiad z Itahizą Domínguezem (IGN Canarias): „Las señales del Teide dicen «a gritos» que Tenerife está volcanológicamente activa”',
    ddaSemafor: 'Diario de Avisos / Europa Press (2026-07-16), „El Gobierno de Canarias descarta activar el semáforo volcánico en Tenerife…”',
    ddaArafo: 'Diario de Avisos (2026-02), artykuł o erupcji Arafo 1705 (cytuje Rodrígueza Delgado)',
    dda3715: 'Diario de Avisos / Canarias en Red (2026-08-04), „El Teide hace millones de años pasaba de los 4.500 metros…” (podaje 3715 m)',
    miteco: 'MITECO, Parque Nacional del Teide — „Valores naturales”, https://www.miteco.gob.es/es/red-parques-nacionales/nuestros-parques/teide/valores-naturales/default.aspx',
    mitecoHist: 'MITECO, Parque Nacional del Teide — „Historia”, https://www.miteco.gob.es/es/parques-nacionales-oapn/red-parques-nacionales/parques-nacionales/teide/historia.html',
    kolumb: 'Dziennik Kolumba w streszczeniu Las Casasa (wpis z sierpnia 1492) — Fordham Medieval Sourcebook, https://sourcebooks.web.fordham.edu/source/columbus1.asp',
    marti2025: 'Martí J. i in. (2025), Bull. Volcanol. — prawdopodobieństwa erupcji Teide–Pico Viejo, przez Tenerife Weekly (https://tenerifeweekly.com/?p=91878)',
    horniman: 'Horniman Museum, „The Legend of Atlantis” (2026-02-16), https://www.horniman.ac.uk/story/the-legend-of-atlantis/',
    livescience: 'Live Science (2024), „«This could be the origin of the Atlantis legend»: Mountain that sank beneath the waves discovered off Canary Islands” (L. Somoza)',
    divulga: 'divulgameteo.es, „Nevadas en Canarias” (PDF, cytuje Fonta o Izañi)',
    amado: 'Amado P., Aparicio A., García A. (2007), „Tectonic - volcanism relations in the Santiago rift (Tenerife)”, Geophysical Research Abstracts 9, EGU2007-A-03437 (MNCN-CSIC)'
  };
  // URL fichy jak w pliku faktów: fichy 1–9 w katalogu 2020/03, 11–30 w 2020/02, 31–50 w 2020/01.
  function ficha(n, tytul) {
    var kat = n <= 9 ? '2020/03' : (n <= 30 ? '2020/02' : '2020/01');
    return 'INVOLCAN, Guía Geoturística de Tenerife 2019, ficha (LIG) ' + n + ' „' + tytul + '”, https://tfgeoturismo.involcan.org/wp-content/uploads/' + kat + '/Ficha-' + n + '.pdf';
  }

  // ───────────────────────────── FAKTY (rozdziały 1–8; „dziś” osobno w `dzis`) ─────────────────────────────
  var fakty = [
    // 1. POŁOŻENIE
    // wTenerife: „located in the [[Atlantic Ocean]] off the northwestern coast of Africa. With an area of {{convert|2034.38|km2|sqmi|abbr=on}}”
    { id: 'f-powierzchnia', rozdzial: 'polozenie', pewnosc: 'srednia', zrodlo: Z.wTenerife,
      tekst: 'Teneryfa leży na Atlantyku u północno-zachodnich wybrzeży Afryki i ma 2034,38 km² — to największa wyspa Kanarów.',
      liczby: { powierzchnia: { wartosc: 2034.38, jednostka: 'km²' } } },
    // wTenerife: „The island is about {{convert|300|km|0|abbr=on}} from the African coast, and approximately {{convert|1000|km|mi|0|abbr=on}} from the [[Iberian Peninsula]].”
    { id: 'f-odleglosci', rozdzial: 'polozenie', pewnosc: 'srednia', zrodlo: Z.wTenerife,
      tekst: 'Od wybrzeża Afryki dzieli ją około 300 km, od Półwyspu Iberyjskiego około 1000 km.',
      liczby: { doAfryki: { wartosc: 300, jednostka: 'km' }, doIberii: { wartosc: 1000, jednostka: 'km' } } },
    // ficha 28: „Al mismo tiempo estamos ante el punto más alto de España (3718 metros) y es el volcán más alto del Atlántico y el tercero del mundo.”
    // IGN: „a large pyramid-based volcanic pile that rises from 3,000 m deep to 3,718 m at its highest elevation, the Pico del Teide.”
    // NASA: „The summit of the Teide stratovolcano reaches 3,718 meters (12,198 feet) above sea level.”
    // Ferrer 2020: „el gran volcán de El Teide, de 3.715 m de altura”; wTenerife: „Mount Teide, with an elevation of {{convert|3715|m|ft|0|abbr=on}}”
    { id: 'f-teide-wysokosc', rozdzial: 'polozenie', pewnosc: 'wysoka',
      zrodlo: ficha(28, 'Teide-Pico Viejo') + '; ' + Z.ign + '; ' + Z.nasa + '; ' + WLASCICIEL + '; dla 3715 m: ' + Z.ferrer2020 + ', ' + Z.wTenerife,
      tekst: 'Teide ma 3718 m n.p.m. — najwyższy punkt Hiszpanii i najwyższy wulkan Atlantyku (INVOLCAN, IGN, NASA). Inne źródła, m.in. Ferrer i in. (2020) i Wikipedia, podają 3715 m.',
      liczby: { wysokosc: { wartosc: 3718, jednostka: 'm n.p.m.' }, wysokoscInnaWartosc: { wartosc: 3715, jednostka: 'm n.p.m.' } } },
    // IGN: „rises from 3,000 m deep to 3,718 m”; NASA: „the volcano rises 7,500 meters (24,606 feet) from the ocean floor, making it the third tallest volcanic structure on Earth.”
    // 3780 m (dno wg Wikipedii, plik faktów F1.9 — wartość z wyszukiwarki): nieodnalezione w pobranym tekście („Tenerife”, „Teide”, „Teide National Park”) — pominięte w treści.
    // wTeide: „Measured from its base on the [[Seabed|ocean floor]], Teide reaches a total height of {{convert|7500|m|abbr=on}}”
    { id: 'f-od-dna', rozdzial: 'polozenie', pewnosc: 'srednia', zrodlo: Z.nasa + '; ' + Z.ign + '; ' + Z.wTeide,
      tekst: 'Licząc od dna oceanu Teide ma 7500 m (NASA: trzecia najwyższa struktura wulkaniczna Ziemi). Według IGN wyspa wyrasta z głębokości ok. 3000 m, co z 3718 m daje ok. 6700 m — rozbieżność wynika z przyjętej głębokości dna.',
      liczby: { odDnaNASA: { wartosc: 7500, jednostka: 'm' }, glebokoscDnaIGN: { wartosc: 3000, jednostka: 'm' } } },
    // wGeol: „Gran Canaria (14.6&nbsp;Ma), Tenerife (11.9&nbsp;Ma), La Gomera (9.4&nbsp;Ma), La Palma (1.7&nbsp;Ma) and El Hierro (1.1&nbsp;Ma).”
    { id: 'f-wiek-wysp', rozdzial: 'polozenie', pewnosc: 'srednia', zrodlo: Z.wGeol,
      tekst: 'Najstarsze skały nadwodne: Gran Canaria 14,6 mln lat, Teneryfa 11,9, La Gomera 9,4, La Palma 1,7, El Hierro 1,1 — wyspy młodnieją ku zachodowi.',
      liczby: { teneryfa: { wartosc: 11.9, jednostka: 'mln lat' } } },
    // wGeol: „The Canary Islands are built upon one of the oldest regions of Earth's [[oceanic crust]] (175–150&nbsp;[[Year#Megaannus|Ma]]”
    { id: 'f-skorupa-pod-kanarami', rozdzial: 'polozenie', pewnosc: 'srednia', zrodlo: Z.wGeol,
      tekst: 'Kanary stoją na jednym z najstarszych fragmentów skorupy oceanicznej Ziemi — z jury, sprzed 175–150 mln lat.',
      liczby: { wiekOd: { wartosc: 175, jednostka: 'mln lat' }, wiekDo: { wartosc: 150, jednostka: 'mln lat' } } },

    // 2. GEOGRAFIA
    { id: 'f-krajobraz-wlasciciel', rozdzial: 'geografia', pewnosc: 'srednia', zrodlo: WLASCICIEL,
      tekst: 'Północ wyspy jest zielona i żyzna, centrum zdominowały surowe formacje wulkaniczne, a południe ma złote plaże i cieplejszy klimat.' },
    { id: 'f-masywy-wlasciciel', rozdzial: 'geografia', pewnosc: 'srednia', zrodlo: WLASCICIEL,
      tekst: 'Poza Teide wyspa ma dwa stare masywy wulkaniczne — Anagę i Teno — ze stromymi klifami i głębokimi wąwozami.' },
    // ficha 30: „Es una gran depresión elíptica de unos 16 km de diámetro mayor, 144 km2 de superficie y 600 m de desnivel.”
    // IGN: „a large elliptical structure (16 km of major axis and 10 km of minor axis) … whose current bottom is at an altitude of 2,100 m. It has walls that reach 500 m in height (Guajara's base).”
    // wTeide: „the {{convert|16|x|9|km|abbr=on}} caldera”
    // wTenerife: „It comprises a semi-[[caldera]] of about {{convert|130|km2|sqmi|0|abbr=on}} in area”; dda3715: „una caldera de entre 12 y 20 kilómetros de diámetro”
    { id: 'f-kaldera-wymiary', rozdzial: 'geografia', pewnosc: 'srednia', zrodlo: ficha(30, 'Caldera de Las Cañadas') + '; ' + Z.ign + '; ' + Z.wTeide + '; ' + Z.wTenerife + ' (130 km²); ' + Z.dda3715 + ' (12–20 km)',
      tekst: 'Kaldera Las Cañadas to eliptyczna depresja o osi ok. 16 km: 16 × 10 km i ściany do 500 m (IGN), 144 km² i 600 m deniwelacji (INVOLCAN), 16 × 9 km lub ok. 130 km² (Wikipedia), 12–20 km (prasa). Dno leży na ok. 2100 m.',
      liczby: { osDluga: { wartosc: 16, jednostka: 'km' }, dno: { wartosc: 2100, jednostka: 'm n.p.m.' } } },
    // IGN: „Pico Viejo is another 3,134 m high stratovolcano … It has the biggest crater of the whole archipelago”
    // wPicoViejo: „with a summit height of 3,129 m above sea level”; ficha 28: „para Pico Viejo de unos 800 m” (krater)
    // wTeidePN: „is the second highest volcano in the Canary Islands with its 3,135 m peak”
    { id: 'f-pico-viejo', rozdzial: 'geografia', pewnosc: 'srednia', zrodlo: Z.ign + '; Wikipedia (en), „Pico Viejo” (wikitext pobrany 2026-11-21); ' + Z.wTeidePN + '; ' + ficha(28, 'Teide-Pico Viejo'),
      tekst: 'Pico Viejo, drugi szczyt wyspy, ma 3134 m (IGN), 3129 m (Wikipedia „Pico Viejo”) albo 3135 m (Wikipedia „Teide National Park”) i największy krater archipelagu — ok. 800 m średnicy.',
      liczby: { wysokoscIGN: { wartosc: 3134, jednostka: 'm n.p.m.' }, krater: { wartosc: 800, jednostka: 'm' } } },
    // wAnaga: „The highest point is 1,024 m (Cruz de Taborno).”; wTenerife: „Mount Gala represents its highest elevation at {{convert|1342|m|ft|abbr=off}}.”
    { id: 'f-anaga-teno', rozdzial: 'geografia', pewnosc: 'srednia', zrodlo: Z.wAnaga + '; ' + Z.wTenerife + ' — sekcja Geology/Massifs',
      tekst: 'Najwyższy punkt Anagi to Cruz de Taborno, 1024 m; masyw Teno kulminuje w Mount Gala, 1342 m.',
      liczby: { anaga: { wartosc: 1024, jednostka: 'm n.p.m.' }, teno: { wartosc: 1342, jednostka: 'm n.p.m.' } } },
    // ficha 11: „dando lugar a paredes verticales que alcanzan entre 300 y 600 metros de altura, por lo que estamos hablando de los acantilados más importantes de Canarias.”
    // Wikipedia „Acantilados de Los Gigantes”: „They are vertical walls reaching heights of 500 metres in some places.”
    { id: 'f-los-gigantes', rozdzial: 'geografia', pewnosc: 'srednia', zrodlo: ficha(11, 'Acantilados de Los Gigantes') + '; Wikipedia (en), „Acantilados de Los Gigantes” (wikitext pobrany 2026-11-21)',
      tekst: 'Klify Los Gigantes mają pionowe ściany wysokie na 300–600 m (INVOLCAN) albo 500 m (Wikipedia) — najważniejsze klify Kanarów.',
      liczby: { wysokoscOd: { wartosc: 300, jednostka: 'm' }, wysokoscDo: { wartosc: 600, jednostka: 'm' } } },
    // Ferrer 2011: „Güímar and La Orotava valleys are trough-shaped depressions 10-12 km wide inclined towards the sea.” …
    // „the important height of the lateral scarps (more than 500 m in some areas; Fig. 2), cut in pre-landslide volcanic materials with slope angles higher than 35º.”
    { id: 'f-doliny-orotava-guimar', rozdzial: 'geografia', pewnosc: 'wysoka', zrodlo: Z.ferrer2011 + ' — rozdz. „Morphological features of Güímar and La Orotava valleys”',
      tekst: 'Doliny La Orotava i Güímar to koryta szerokie na 10–12 km, nachylone ku morzu, z bocznymi ścianami miejscami wyższymi niż 500 m i stromszymi niż 35°.',
      liczby: { szerokoscOd: { wartosc: 10, jednostka: 'km' }, szerokoscDo: { wartosc: 12, jednostka: 'km' }, sciany: { wartosc: 500, jednostka: 'm' } } },
    // wDorsalEs: „Tiene 25 kilómetros de longitud, con una altura media de 1600” … „siendo su punto más elevado el de [[Observatorio de Izaña|Izaña]], con 2350&nbsp;m de altitud.”
    // wTenerife: „with Izaña, as its highest point at {{convert|2390|m|ft|0|abbr=on}}”
    { id: 'f-dorsal', rozdzial: 'geografia', pewnosc: 'srednia', zrodlo: Z.wDorsalEs + '; ' + Z.wTenerife + ' — sekcja Dorsals',
      tekst: 'Grzbiet Dorsal łączy Anagę ze środkiem wyspy: ma ok. 25 km długości i średnio ok. 1600 m wysokości; najwyżej leży Izaña — 2350 m (Wikipedia es) albo 2390 m (Wikipedia en).',
      liczby: { dlugosc: { wartosc: 25, jednostka: 'km' }, izana: { wartosc: 2390, jednostka: 'm n.p.m.' } } },
    // wTenerife: „most coastal areas have [[semi-arid climate|semi-arid]] or [[arid climate|arid]] climates”
    // wTenerife (Climate): „Tenerife has a generally warm, dry climate shaped by the [[Atlantic Ocean]], [[trade winds]], and the island's mountainous landscape.”
    { id: 'f-klimat-pasaty', rozdzial: 'geografia', pewnosc: 'srednia', zrodlo: Z.wTenerife + ' — sekcja Climate',
      tekst: 'Klimat kształtują Atlantyk, pasaty i góry; według klasyfikacji Köppena większość wybrzeży ma klimat półpustynny lub pustynny.' },
    // nasaPyl: „In mid-January 2022, dust from northwest Africa washed over the Canary Islands, causing skies to turn orange, visibility to drop, and air quality to decline.”
    // Wikipedia, strona Calima (Saharan sand): „It usually happens in the summer and lasts 3–5 days.” — rozbieżność pory (NASA: styczeń)
    { id: 'f-kalima', rozdzial: 'geografia', pewnosc: 'srednia', zrodlo: Z.nasaPyl + '; Wikipedia (en), „Calima (Saharan sand)” (wikitext pobrany 2026-11-21)',
      tekst: 'Kalima to pył z Sahary niesiony wiatrem nad wyspy: niebo robi się pomarańczowe, widzialność spada. Trwa zwykle 3–5 dni; zdarza się latem, ale też zimą (styczeń 2022, NASA).',
      liczby: { trwanieOd: { wartosc: 3, jednostka: 'dni' }, trwanieDo: { wartosc: 5, jednostka: 'dni' } } },

    // 3. BUDOWA
    // wGeol: „This central shield volcano was active from 11.9 to 8.9&nbsp;Ma.” … „(Teno shield volcano) formed from 6.4 to 5.1&nbsp;Ma” … „from 4.9 to 3.9&nbsp;Ma, a third shield volcano (Anaga shield volcano)”
    // IGN: „three separate sectors that probably formed three independent islands: the Anaga peninsula, the Teno peninsula and the Roque del Conde sector.”
    // wTenerife: „However, the materials here are older (about 7.4&nbsp;million years old).” (Teno) — inna wartość
    // wTenerife (Anaga): „Due to the age of its material (5.7&nbsp;million years)” — inna wartość
    { id: 'f-tarcze', rozdzial: 'budowa', pewnosc: 'srednia', zrodlo: Z.wGeol + ' (za Guillou i in. 2004); ' + Z.ign + '; ' + Z.wTenerife,
      tekst: 'Najstarsze są trzy tarcze bazaltowe: centralna (Roque del Conde) 11,9–8,9 mln lat, Teno 6,4–5,1 i Anaga 4,9–3,9. Wikipedia „Tenerife” podaje inaczej: Teno ok. 7,4, Anaga ok. 5,7 mln lat.',
      liczby: { roqueOd: { wartosc: 11.9, jednostka: 'mln lat' }, tenoOd: { wartosc: 6.4, jednostka: 'mln lat' }, anagaOd: { wartosc: 4.9, jednostka: 'mln lat' } } },
    // IGN: „4 Ma and until only 170,000 years ago, successive explosive saline eruptions built several central volcanic buildings that overlapped each other: the Edificios Cañadas. They reached heights of about 4000 m”
    // wGeol: „Between 4.0 and 0.2&nbsp;Ma, a large stratovolcano (Las Cañadas volcano) formed”
    { id: 'f-gmach-canadas', rozdzial: 'budowa', pewnosc: 'wysoka', zrodlo: Z.ign + '; ' + Z.wGeol,
      tekst: 'Od ok. 4 mln do ok. 170 tys. lat temu kolejne wybuchowe erupcje budowały w środku wyspy nakładające się gmachy Las Cañadas, sięgające ok. 4000 m.',
      liczby: { od: { wartosc: 4, jednostka: 'mln lat' }, wysokosc: { wartosc: 4000, jednostka: 'm' } } },
    // wGeol: „In this {{cvt|16|x|20|km|mi}} caldera, since about 170,000 years ago, two related stratovolcanoes have formed: [[Teide]] … and its younger, smaller, we[stern neighbour Pico Viejo]”
    // ficha 28: „es un volcán diferenciado y al localizarse en islas de intraplaca es un volcán “intruso”” … „la última de ellas es la de Narices del Teide que tuvo lugar en 1798.”
    { id: 'f-teide-pico-viejo', rozdzial: 'budowa', pewnosc: 'srednia', zrodlo: Z.wGeol + '; ' + ficha(28, 'Teide-Pico Viejo') + '; ' + Z.wTenerife + ' (ok. 200 tys. lat)',
      tekst: 'W kalderze od ok. 170 tys. lat (inne źródła: 200 tys.) rosną dwa powiązane stratowulkany — Teide i Pico Viejo. To wulkan zróżnicowany, rzadki na wyspach wewnątrzpłytowych; ostatnia erupcja kompleksu: 1798.',
      liczby: { od: { wartosc: 170, jednostka: 'tys. lat' } } },
    // IGN: „In Tenerife there are three main rift axes that begin at the three vertices of the island and converge at a triple point in the central zone, where the Edificios Cañadas and the large Teide-Pico Viejo complex emerged.”
    { id: 'f-ryfty', rozdzial: 'budowa', pewnosc: 'wysoka', zrodlo: Z.ign,
      tekst: 'Trzy osie ryftowe zaczynają się w trzech wierzchołkach wyspy i zbiegają w punkcie potrójnym w centrum, gdzie wyrosły gmachy Las Cañadas i kompleks Teide–Pico Viejo.' },
    // IGN: „In the NW axis of Teno, today active, the same thing happened” … „Finally, in the third NS axis, two large strombolian cone fields covered part of the slopes of Cañadas”
    { id: 'f-ryfty-aktywnosc', rozdzial: 'budowa', pewnosc: 'srednia', zrodlo: Z.ign + '; ' + Z.amado,
      tekst: 'Na osi NE (Dorsal) między 1,0 a 0,5 mln lat temu wiele wulkanów strombolijskich wylało bazalty; oś NW (Santiago, ku Teno) jest dziś aktywna; na osi N–S leżą dwa duże pola stożków.',
      liczby: { neOd: { wartosc: 1, jednostka: 'mln lat' }, neDo: { wartosc: 0.5, jednostka: 'mln lat' } } },
    // MITECO Valores naturales: „Las más comunes son los basaltos, oscuros y duros. Las fonolitas, menos frecuentes, son verdosas o azuladas, muy compactas. El lapilli con esta misma composición, muy gasificado y enfriado rápidamente, forma lo que llamamos comúnme[nte piedra pómez]”
    { id: 'f-skaly', rozdzial: 'budowa', pewnosc: 'wysoka', zrodlo: Z.miteco,
      tekst: 'Najczęstsze skały to ciemne, twarde bazalty; rzadsze fonolity są zielonkawe lub niebieskawe. Fonolitowy lapilli, mocno odgazowany i szybko schłodzony, tworzy pumeks.' },
    // Przegląd w Earth, Planets and Space 2018 / Bull. Volcanol. (Lavas Negras) — (streszczenie/pośrednio — nie pobrano)
    { id: 'f-komora', rozdzial: 'budowa', pewnosc: 'niska', zrodlo: 'Eksperymenty równowag fazowych Lavas Negras, Bull. Volcanol. (DOI 10.1007/S00445-009-0325-3) i przegląd Earth, Planets and Space 2018 (DOI 10.1186/s40623-018-0783-y) — (streszczenie/pośrednio — nie pobrano), wg pliku faktów F3.8',
      tekst: 'Magma fonolitowa Teide–Pico Viejo gromadzi się płytko, ok. 1–2 km pod poziomem morza, i to nie w jednej komorze, lecz w kilku odizolowanych zbiornikach.' },

    // 4. POWSTANIE
    // wGeol: „(175–150&nbsp;[[Year#Megaannus|Ma]]” — skorupa; Watts i in. — (streszczenie/pośrednio — nie pobrano)
    { id: 'f-skorupa', rozdzial: 'powstanie', pewnosc: 'niska', zrodlo: Z.wGeol + '; Watts i in., „A seismic study of lithospheric flexure in the vicinity of Tenerife” (Oxford) — (streszczenie/pośrednio — nie pobrano)',
      tekst: 'Wyspa wyrosła na jurajskiej skorupie oceanicznej, która pod jej ciężarem ugięła się; pod wyspą ma średnio ok. 6,4 km grubości.',
      liczby: { gruboscSkorupy: { wartosc: 6.4, jednostka: 'km' } } },
    // wGeol: „The volcanism is related to [[Earth's crust|crustal]] [[Fault (geology)|fracture]]s extending from the [[Atlas Mountains]] of Morocco.” … „The volcanism is caused by the [[African plate]] moving slowly over a [[Hotspot (geology)|hotspot]] in [[Earth's mantle]].”
    // wGeol, Origins: hipotezy gorącej plamy, propagującego się pęknięcia, modelu zunifikowanego — Anguita & Hernán 2000 (streszczenie/pośrednio — nie pobrano)
    { id: 'f-goraca-plama', rozdzial: 'powstanie', pewnosc: 'srednia', zrodlo: Z.wGeol + ' — sekcja Origins of volcanism; Anguita F., Hernán F. (2000), J. Volcanol. Geotherm. Res. 103:1–26 — (streszczenie/pośrednio — nie pobrano)',
      tekst: 'Większość geologów łączy Kanary z gorącą plamą płaszcza, ale hipoteza jest dyskutowana: konkurują z nią pęknięcie biegnące od Atlasu i modele mieszane. Spór nie jest rozstrzygnięty.' },
    // ficha 4: „Las pillow lavas de Igueste de San Andrés se encuentran en una de las partes más antiguas de la isla, concretamente en el Macizo de Anaga. Su ubicación está asociada al fondo del Barranco de Igueste a unos 80 metros de altitud”
    { id: 'f-lawy-poduszkowe', rozdzial: 'powstanie', pewnosc: 'wysoka', zrodlo: ficha(4, 'Igueste de San Andrés-Pillow Lavas'),
      tekst: 'Podmorski początek wyspy widać w lawach poduszkowych Igueste de San Andrés w Anadze — leżą na ok. 80 m n.p.m., w jednej z najstarszych części wyspy.',
      liczby: { wysokosc: { wartosc: 80, jednostka: 'm n.p.m.' } } },
    // IGN: „The first subaerial volcanic materials of the island emerged about 12 million years ago, on the northern coast of the Anaga peninsula.” + „three separate sectors that probably formed three independent islands”
    // UWAGA: IGN umieszcza pierwsze skały na północnym wybrzeżu Anagi; Wikipedia (Guillou 2004) — tarcza centralna 11,9 Ma.
    { id: 'f-wynurzenie', rozdzial: 'powstanie', pewnosc: 'srednia', zrodlo: Z.ign + '; ' + Z.wGeol,
      tekst: 'Pierwsze skały wyszły nad wodę ok. 12 mln lat temu. Trzy sektory — Anaga, Teno i Roque del Conde — były prawdopodobnie trzema osobnymi wyspami (IGN), które później połączyły lawy.',
      liczby: { wynurzenie: { wartosc: 12, jednostka: 'mln lat' } } },
    // wGeol: „The rejuvenation stage of Tenerife (after a long erosive gap in activity at the centre of Tenerife) started at about 4&nbsp;Ma and continues to the present day.”
    { id: 'f-odmlodzenie', rozdzial: 'powstanie', pewnosc: 'srednia', zrodlo: Z.wGeol,
      tekst: 'Po długiej przerwie erozyjnej, ok. 4 mln lat temu, zaczęła się faza odmłodzenia wyspy — trwa do dziś.',
      liczby: { od: { wartosc: 4, jednostka: 'mln lat' } } },
    // wGeol: „The lavas of these three shield volcanoes gradually formed a combined volcanic edifice that accounts for 90% of Tenerife's current volume.”
    { id: 'f-tarcze-objetosc', rozdzial: 'powstanie', pewnosc: 'srednia', zrodlo: Z.wGeol + ' (za Carracedo & Troll 2013)',
      tekst: 'Lawy trzech tarcz zrosły się we wspólny gmach, który stanowi ok. 90% dzisiejszej objętości Teneryfy.',
      liczby: { udzial: { wartosc: 90, jednostka: '%' } } },

    // 5. HISTORIA
    // Hunt 2018: „The northern flank of Tenerife is sculpted by the voluminous multistage Icod (165 ± 5 ka), Orotava (535 ± 5 ka) and Roques de Garcia (1.15 ± 0.01 Ma) landslides”
    // Ferrer 2020: „se proponen las edades más representativas para los deslizamientos de Icod: ~170 ka; La Orotava: ~560, ~530 y ~500(?) ka; Güímar: ~830 ka; y Micheque: 810-830 ka.”
    // wTenerife: „About 800,000 years ago, two gravitational [[volcanic landslide|landslides]] occurred, giving rise to the present-day valleys of La Orotava and Güímar.” … „Finally, around 200,000 years ago, th[e Icod…]”
    { id: 'f-osuwiska-wiek', rozdzial: 'historia', pewnosc: 'srednia', zrodlo: Z.hunt2018 + '; ' + Z.ferrer2020 + '; ' + Z.wTenerife,
      tekst: 'Wiek wielkich osuwisk: Icod 165 ± 5 tys. lat (Hunt) / ok. 170 tys. (Ferrer) / ok. 200 tys. (Wikipedia); La Orotava 535 ± 5 tys. / kilka zdarzeń ok. 560, 530 i 500 tys.; Güímar ok. 830 tys. lat.',
      liczby: { icod: { wartosc: 165, jednostka: 'tys. lat' }, orotava: { wartosc: 535, jednostka: 'tys. lat' }, guimar: { wartosc: 830, jednostka: 'tys. lat' } } },
    // Hunt 2018: „These analyses indicate only the lattermost stages of subaerial flank failure contain materials originating from respective coeval explosive eruption, suggesting that initial more voluminous submarine stages of multi-stage flank collapse induce these aforementioned explosive eruption.”
    // Hunt 2018: „several days to weeks may pass between successive stages of flank collapse”
    { id: 'f-osuwiska-etapy', rozdzial: 'historia', pewnosc: 'wysoka', zrodlo: Z.hunt2018 + ' — Abstract/Discussion',
      tekst: 'Osuwiska zbocza szły etapami: najpierw obszerniejsze etapy podmorskie, a dopiero ostatnie, nadwodne niosą materiał z równoczesnej wybuchowej erupcji. Między kolejnymi etapami mogły mijać dni, a nawet tygodnie.' },
    // ficha 37: „Este desapareció hace unos 830.000 años como consecuencia del mega-deslizamiento que dio lugar a la génesis del Valle de Güímar, cuyos materiales alcanzaron unos 85 km de distancia”
    { id: 'f-guimar-85km', rozdzial: 'historia', pewnosc: 'wysoka', zrodlo: ficha(37, 'Caldera de Pedro Gil'),
      tekst: 'Ok. 830 tys. lat temu megaosuwisko zabrało stratowulkan Arafo i utworzyło dolinę Güímar; materiał zsunął się w ocean na ok. 85 km.',
      liczby: { wiek: { wartosc: 830, jednostka: 'tys. lat' }, zasieg: { wartosc: 85, jednostka: 'km' } } },
    // ficha 30: „hay dos principales hipótesis: el colapso vertical y múltiple en el que se reconocerían tres semicalderas con edades que van desde 1,02 (Ucanca), 0,57 (Guajara) hasta 0,17 (Diego Hernández) millones de años; y el deslizamiento de los flancos del antiguo edificio Cañadas de manera súbita hace unos 170 mil años.”
    // wGeol: „Suggested causes of Las Cañadas volcano's collapse are landslide (the Icod landslide), or explosive volcanic eruption, or a combination of both.”
    { id: 'f-kaldera-spor', rozdzial: 'historia', pewnosc: 'srednia', zrodlo: ficha(30, 'Caldera de Las Cañadas') + '; ' + Z.wGeol + ' (za Martí 2019)',
      tekst: 'Pochodzenie kaldery to spór: albo pionowe zapadnięcia w trzech fazach (Ucanca 1,02, Guajara 0,57, Diego Hernández 0,17 mln lat), albo nagłe osuwisko zbocza ok. 170 tys. lat temu — albo jedno i drugie.',
      liczby: { ucanca: { wartosc: 1.02, jednostka: 'mln lat' }, guajara: { wartosc: 0.57, jednostka: 'mln lat' }, diegoHernandez: { wartosc: 0.17, jednostka: 'mln lat' } } },
    // volki: „the Canary Islands have witnessed 14 historical volcanic eruptions: 7 in La Palma, 4 in Tenerife, 2 in Lanzarote, and 1 in El Hierro.”
    { id: 'f-erupcje-historyczne', rozdzial: 'historia', pewnosc: 'srednia', zrodlo: Z.volki,
      tekst: 'W ostatnich 500 latach Teneryfa miała 4 erupcje uznane za historyczne: 1704–1705, 1706, 1798 i 1909 (na całych Kanarach — 14).',
      liczby: { teneryfa: { wartosc: 4, jednostka: 'erupcje' }, kanary: { wartosc: 14, jednostka: 'erupcji' } } },
    // ficha 41: „La erupción de Arenas Negras de 1706 se inició el 5 de mayo y finalizó el 13 de junio.” … „las lenguas de lava alcanzaron el día 5 y luego el 13 de mayo el antiguo cantil y descendieron por él … hasta alcanzar la villa y puerto de Garachico que destruyeron parcialmente.”
    // wTrevejo: „took place from 5 to 14 May 1706” (infobox/wstęp) — rozbieżność daty końca
    { id: 'f-1706', rozdzial: 'historia', pewnosc: 'wysoka', zrodlo: ficha(41, 'Taludes Lávicos Garachico') + '; ' + Z.tw1706 + '; dla 14 V: ' + Z.wTrevejo,
      tekst: 'Erupcja Arenas Negras (Trevejo) trwała od 5 maja do 13 czerwca 1706. Lawa przeskoczyła stary klif 5 i 13 maja i częściowo zniszczyła miasto i port Garachico. Wikipedia podaje koniec 14 maja.',
      liczby: { rok: { wartosc: 1706, jednostka: 'rok' } } },
    // wTrevejo: „The eruption destroyed the old [[port of Garachico]] (the most important in Tenerife at the time) and ended the golden period of the town.”
    // tw1706: „Garachico went from having 1,600 inhabitants in 1706 to 400 a year later.” ; „and 6.5 kilometers from the coastal town” ; wTrevejo: „about {{Convert|8|km|mi|abbr=on}} kilometers south of the [[Garachico]]”
    { id: 'f-1706-skutki', rozdzial: 'historia', pewnosc: 'srednia', zrodlo: Z.wTrevejo + '; ' + Z.tw1706,
      tekst: 'Erupcja zasypała najważniejszy wówczas port Teneryfy i zakończyła złoty okres Garachico: z 1600 mieszkańców po roku zostało 400. Szczelina leżała ok. 6,5 km od miasta (Tenerife Weekly) albo ok. 8 km (Wikipedia).',
      liczby: { przed: { wartosc: 1600, jednostka: 'mieszkańców' }, po: { wartosc: 400, jednostka: 'mieszkańców' } } },

    // 6. PRZEKRÓJ
    // IGN: „rises from 3,000 m deep”
    { id: 'f-dno', rozdzial: 'przekroj', pewnosc: 'srednia', zrodlo: Z.ign + '; ' + Z.wTeide,
      tekst: 'Wyspa jest wierzchołkiem piramidy wulkanicznej wyrastającej z dna oceanu na głębokości ok. 3000 m (IGN); inne źródła przyjmują głębsze dno.',
      liczby: { dno: { wartosc: 3000, jednostka: 'm p.p.m.' } } },
    // Ferrer 2011, tekst: „In this analysis values of 0.1 MPa for cohesion and 16º for angle of friction are needed to reach limit equilibrium.”
    // Ferrer 2011, podpis fig. 6: „values for the hyaloclastite rocks: c= 0.1 MPa and φ = 19º.” — dwie wartości w tym samym źródle
    { id: 'f-hialoklastyty', rozdzial: 'przekroj', pewnosc: 'wysoka', zrodlo: Z.ferrer2011 + ' — analiza stateczności (16º w tekście, 19º w podpisie fig. 6)',
      tekst: 'Pod gmachem leżą słabe, odkształcalne hialoklastyty z fazy podmorskiej. Według modelu zbocze traci stateczność już przy spójności 0,1 MPa i kącie tarcia 16–19° (16° w tekście pracy, 19° w podpisie ryciny 6).',
      liczby: { spojnosc: { wartosc: 0.1, jednostka: 'MPa' }, katTarciaOd: { wartosc: 16, jednostka: '°' }, katTarciaDo: { wartosc: 19, jednostka: '°' } } },
    // ficha 14: „Los materiales más antiguos corresponden al volcanismo en escudo que dieron lugar a los basaltos tabulares de hasta 1000 metros de potencia”
    { id: 'f-bazalty-tabularne', rozdzial: 'przekroj', pewnosc: 'wysoka', zrodlo: ficha(14, 'Barranco del Infierno'),
      tekst: 'Najstarsze tarcze to bazalty tabularne grube nawet na 1000 m, z pojedynczymi wylewami od kilku centymetrów do 4–5 m.',
      liczby: { grubosc: { wartosc: 1000, jednostka: 'm' } } },
    // Ferrer 2011: „A water table at 600-700 m below surface was estimated according with ground water records.”
    { id: 'f-wody-podziemne', rozdzial: 'przekroj', pewnosc: 'wysoka', zrodlo: Z.ferrer2011,
      tekst: 'Zwierciadło wód podziemnych, sprzed intensywnej eksploatacji, oszacowano na 600–700 m pod powierzchnią.',
      liczby: { od: { wartosc: 600, jednostka: 'm' }, do: { wartosc: 700, jednostka: 'm' } } },

    // 7. CZĘŚCI
    // ficha 25: „El tubo volcánico de la Cueva del Viento se formó sobre las lavas pahoehoe basálticas iniciales (20.775±321 años) emitidas por Pico Viejo y constituye el túnel volcánico más grande en Europa” … „Se compone de 17 km de”
    { id: 'f-cueva-del-viento', rozdzial: 'czesci', pewnosc: 'wysoka', zrodlo: ficha(25, 'Cueva del Viento'),
      tekst: 'Cueva del Viento to największy tunel lawowy Europy: 17 km korytarzy w lawach pahoehoe z Pico Viejo sprzed ok. 20 775 lat.',
      liczby: { dlugosc: { wartosc: 17, jednostka: 'km' }, wiekLaw: { wartosc: 20775, jednostka: 'lat' } } },
    // ficha 29: „Los Roques de García son un conjunto de brechas y rocas intrusivas (diques y pitones) alineados según una directriz NO-SE de unos 2 km. Estos roques dividen la Caldera de Las Cañadas en dos (oriental y occidental) con más de 100 m de desnivel”
    { id: 'f-roques-de-garcia', rozdzial: 'czesci', pewnosc: 'wysoka', zrodlo: ficha(29, 'Roques de García'),
      tekst: 'Roques de García to ok. 2 km brekcji, dajek i pitonów w linii NW–SE; dzielą kalderę na część wschodnią i zachodnią o różnicy poziomów ponad 100 m.',
      liczby: { dlugosc: { wartosc: 2, jednostka: 'km' }, roznica: { wartosc: 100, jednostka: 'm' } } },
    // ficha 19: „(altura= 158 m, superficie= 0,6 km2, volumen= 0,04 km3)”
    { id: 'f-montana-roja', rozdzial: 'czesci', pewnosc: 'wysoka', zrodlo: ficha(19, 'Montaña Roja'),
      tekst: 'Montaña Roja na południu to stożek z bazaltu oliwinowego: 158 m wysokości, 0,6 km² powierzchni, 0,04 km³ objętości.',
      liczby: { wysokosc: { wartosc: 158, jednostka: 'm' }, powierzchnia: { wartosc: 0.6, jednostka: 'km²' } } },

    // 8. MITY (fakty, na których opierają się werdykty)
    // egu26: „During the study period, diffuse CO 2 emissions ranged between 2 and 1257 t·d -1” … „in September 2023 the maximum value of the series was recorded (1257 t·d -1 ).”
    { id: 'f-co2-krater', rozdzial: 'mity', pewnosc: 'srednia', zrodlo: Z.egu26,
      tekst: 'Krater Teide oddycha gazem: emisja CO₂ z gruntu trzymała się ok. 20 t na dobę do 2016 r., potem rosła i we wrześniu 2023 r. osiągnęła rekord 1257 t na dobę.',
      liczby: { maksimum: { wartosc: 1257, jednostka: 't/d' }, tlo: { wartosc: 20, jednostka: 't/d' } } },
    // ddaIgn (tytuł): „Las señales del Teide dicen 'a gritos' que Tenerife está volcanológicamente activa”; „El director del Instituto Geográfico Nacional ( IGN ) en Canarias, Itahiza Domínguez”
    // ddaSemafor (tytuł): „El Gobierno de Canarias descarta activar el semáforo volcánico en Tenerife pese a los enjambres sísmicos recurrentes en el Teide”
    { id: 'f-sygnaly-2026', rozdzial: 'mity', pewnosc: 'srednia', zrodlo: Z.ddaIgn + '; ' + Z.ddaSemafor,
      tekst: 'Dyrektor IGN na Kanarach, Itahiza Domínguez, mówi (luty 2026), że sygnały Teide „krzyczą”, że wyspa jest aktywna; w lipcu 2026 rząd Wysp mimo rojów sejsmicznych nie uruchomił wulkanicznego semafora.' },
    // wCanarias: „The name of the islands is not derived from the [[Atlantic canary|canary bird]]; rather, the birds are named after the islands.”
    { id: 'f-nazwa-wysp', rozdzial: 'mity', pewnosc: 'srednia', zrodlo: Z.wCanarias,
      tekst: 'Nazwa wysp pochodzi najpewniej od łacińskiego Canariae Insulae — „Wyspy Psów”; to kanarki wzięły nazwę od wysp, nie odwrotnie.' },
    // rtvc: „Probabilidades: 1% en un año, 39% en 50 años”
    { id: 'f-prawdopodobienstwo', rozdzial: 'mity', pewnosc: 'srednia', zrodlo: Z.rtvc + '; ' + Z.marti2025,
      tekst: 'INVOLCAN (2026) szacuje szansę erupcji na Teneryfie na 1% w roku i 39% w 50 lat; dla dużej erupcji Teide–Pico Viejo Martí i in. (2025) podają 2,1% w 20 lat.',
      liczby: { rok: { wartosc: 1, jednostka: '%' }, piecdziesiatLat: { wartosc: 39, jednostka: '%' } } }
  ];

  // ───────────────────────────── WYSPA DZIŚ (tekst właściciela) ─────────────────────────────
  var dzis = [
    { id: 'dz-mikroklimaty', rozdzial: 'dzis', pewnosc: 'srednia', zrodlo: WLASCICIEL,
      tekst: 'Północ jest chłodniejsza i wilgotniejsza, często w chmurach; południe cieplejsze, suchsze i bardziej słoneczne; w górach temperatura spada z wysokością, a zimą szczyty Teide pokrywa śnieg.' },
    { id: 'dz-temperatura', rozdzial: 'dzis', pewnosc: 'niska', zrodlo: WLASCICIEL,
      tekst: 'Klimat jest subtropikalny, ze średnią roczną temperaturą około 23 °C.',
      liczby: { temperatura: { wartosc: 23, jednostka: '°C' } } },
    { id: 'dz-kalima', rozdzial: 'dzis', pewnosc: 'srednia', zrodlo: WLASCICIEL,
      tekst: 'Latem, szczególnie w lipcu i sierpniu, przychodzi kalima — suchy, gorący wiatr znad Sahary z pyłem pustynnym.' },
    { id: 'dz-plaze', rozdzial: 'dzis', pewnosc: 'niska', zrodlo: WLASCICIEL,
      tekst: 'Wyspa ma ponad 70 plaż: czarne z piasku wulkanicznego na północy (Playa del Socorro, Playa Jardín) i złote na południu (okolice Playa de las Américas).',
      liczby: { plaze: { wartosc: 70, jednostka: 'plaż' } } },
    // ficha 33: „Las tres playas están constituidas por arena negra, de granulometría fina y de origen volcánico, pero también por bloques y cantos basálticos heterométricos.”
    { id: 'dz-czarny-piasek', rozdzial: 'dzis', pewnosc: 'wysoka', zrodlo: ficha(33, 'Playa de Bollullo, Los Patos, El Ancón'),
      tekst: 'Czarny piasek północnych plaż jest drobny i pochodzenia wulkanicznego, zmieszany z blokami i otoczakami bazaltu.' },
    { id: 'dz-el-caleton', rozdzial: 'dzis', pewnosc: 'srednia', zrodlo: WLASCICIEL,
      tekst: 'Na wybrzeżu są naturalne baseny skalne z zastygłej lawy — jak El Caletón w Garachico.' },
    // Wikipedia (en) „San Cristóbal de La Laguna”, infobox UNESCO: „| ID = 929 | year = 1999”
    { id: 'dz-la-laguna', rozdzial: 'dzis', pewnosc: 'srednia', zrodlo: WLASCICIEL + '; rok wpisu: Wikipedia (en), „San Cristóbal de La Laguna” — infobox UNESCO (wikitext pobrany 2026-11-21)',
      tekst: 'San Cristóbal de La Laguna ma historyczne centrum z kolonialną architekturą, wpisane na listę UNESCO w 1999 r.',
      liczby: { unesco: { wartosc: 1999, jednostka: 'rok' } } },
    { id: 'dz-orotava', rozdzial: 'dzis', pewnosc: 'srednia', zrodlo: WLASCICIEL,
      tekst: 'La Orotava, w dolinie po dawnym osuwisku, słynie z drewnianych balkonów i ogrodów.' },
    { id: 'dz-garachico', rozdzial: 'dzis', pewnosc: 'srednia', zrodlo: WLASCICIEL,
      tekst: 'Garachico po erupcji z 1706 roku odbudowano; ma dobrze zachowaną architekturę z XVI–XVII wieku.' },
    { id: 'dz-kuchnia', rozdzial: 'dzis', pewnosc: 'srednia', zrodlo: WLASCICIEL,
      tekst: 'Kuchnia: papas arrugadas z sosem mojo, ryby vieja i sama, koźlina i królik, puchero canario, sery, miód i wina z winorośli rosnących na glebach wulkanicznych.' },
    { id: 'dz-szlaki', rozdzial: 'dzis', pewnosc: 'niska', zrodlo: WLASCICIEL,
      tekst: 'Prawie połowa wyspy (48%) jest chroniona; jest ok. 1500 km szlaków pieszych i ok. 200 km tras rowerowych.',
      liczby: { ochrona: { wartosc: 48, jednostka: '%' }, szlaki: { wartosc: 1500, jednostka: 'km' }, rower: { wartosc: 200, jednostka: 'km' } } },
    { id: 'dz-ciemne-niebo', rozdzial: 'dzis', pewnosc: 'srednia', zrodlo: WLASCICIEL,
      tekst: 'Wyspa jest obszarem ochrony ciemnego nieba, a Park Narodowy Teide — certyfikowaną „strefą gwiazd”.' },
    // wTeidePN infobox: „| designation1_date = 2007” „| designation1_criteria = vii, viii” ; „| established = 1954”
    { id: 'dz-park-unesco', rozdzial: 'dzis', pewnosc: 'srednia', zrodlo: Z.wTeidePN,
      tekst: 'Park Narodowy Teide istnieje od 1954 r., a w 2007 r. trafił na listę światowego dziedzictwa UNESCO.',
      liczby: { park: { wartosc: 1954, jednostka: 'rok' }, unesco: { wartosc: 2007, jednostka: 'rok' } } }
  ];

  // ───────────────────────────── JEDNOSTKI (kolejność = pierwszeństwo przynależności) ─────────────────────────────
  var jednostki = [
    // Obrys: Ferrer i in. 2020, fig. 1 (czerwone przerywane linie „Icod”), georeferencja po Punta de Teno, czubku Anagi i Teide.
    // Ferrer 2020: „En el valle de Icod no afloran los escarpes laterales del [deslizamiento]” … „sí está expuesto el escarpe de cabecera del deslizamiento, formando una parte de la gran [caldera]”
    // IGN: „It is an incomplete boiler since the northern wall collapsed and slid into the sea in the Icod de los Vinos landslide.”
    { id: 'dolina-icod', nazwa: 'Dolina Icod — północne zbocze gmachu Las Cañadas (osunięte)', skala: 'gmach', odMa: 4.0, doMa: 0.2,
      skaly: ['bazalty', 'fonolity', 'dziś: lawy Teide–Pico Viejo wypełniające dolinę'], kolor: '#c98b5a',
      wielokaty: [[[-16.757, 28.355], [-16.755, 28.40], [-16.665, 28.40], [-16.662, 28.381], [-16.633, 28.345], [-16.611, 28.326], [-16.610, 28.307], [-16.626, 28.291], [-16.655, 28.282], [-16.692, 28.291], [-16.757, 28.355]]],
      // Wysokość ubytku dla doliny Icod nie jest w źródłach (boczne skarpy nie odsłaniają się) — zastępczo ściany kaldery,
      // czyli skarpa czołowa tego osuwiska: IGN „It has walls that reach 500 m in height (Guajara's base).”
      zapadniecie: { Ma: 0.17, wypelnienie_m: 500, zakresMa: [0.2, 0.16],
        zrodlo: 'wiek: ' + Z.ferrer2020 + ' (~170 ka), ' + Z.hunt2018 + ' (165 ± 5 ka), ' + Z.wTenerife + ' (~200 ka); wypełnienie zastępczo = wysokość ścian kaldery (IGN, 500 m) — przybliżenie', pewnosc: 'bardzo-niska' },
      pewnosc: 'niska', zrodlo: Z.ferrer2020 + ' — fig. 1 (obrys); ' + Z.ign + '; wiek gmachu: ' + Z.wGeol },
    // Ferrer 2011: „more than 500 m in some areas”; Ferrer 2020: „the Tigaiga escarpment, up to 600 m high.”
    { id: 'dolina-orotava', nazwa: 'Dolina La Orotava — zbocze ryftu NE sprzed osuwiska', skala: 'ryft', odMa: 1.0, doMa: 0.56,
      skaly: ['bazalty', 'hialoklastyty w podłożu', 'dziś: lawy wypełnienia doliny'], kolor: '#7fae4a',
      // Podłoże jak dla ryft-ne-dorsal (ten sam szacunek).
      podloze: { jednostka: 'tarcza-anaga', wys_m: 400, pewnosc: 'bardzo-niska', zrodlo: Z.wTenerife + ' (Dorsal wyrósł „amidst the remains of the older Ancient Basaltic Series (Series I)” — Seria I to wszystkie trzy stare masywy); wybór tarczy Anaga jako podłoża to założenie (Dorsal łączy się z Anagą, IGN); wys_m = mediana rzeźby tarczy Anaga (obliczenie własne, przybliżenie)' },
      wielokaty: [[[-16.608, 28.374], [-16.612, 28.43], [-16.505, 28.43], [-16.513, 28.400], [-16.480, 28.329], [-16.510, 28.313], [-16.546, 28.301], [-16.586, 28.294], [-16.608, 28.374]]],
      zapadniecie: { Ma: 0.535, wypelnienie_m: 500, zakresMa: [0.69, 0.5],
        zrodlo: 'wiek: ' + Z.hunt2018 + ' (535 ± 5 ka), ' + Z.ferrer2020 + ' (~560, ~530, ~500(?) ka — kilka zdarzeń), Cantagrel 1999 przez Ferrer 2011 (690–540 ka); wypełnienie = skarpy boczne > 500 m (' + Z.ferrer2011 + '), Tigaiga do 600 m (' + Z.ferrer2020 + ')', pewnosc: 'niska' },
      pewnosc: 'niska', zrodlo: Z.ferrer2020 + ' — fig. 1 (obrys); wiek ryftu NE: ' + Z.ign + ' (1,0–0,5 Ma); doMa = najstarsze z osuwisk wg Ferrer 2020 (~560 ka)' },
    // Ferrer 2020: „In the Güímar valley the upper flows of the southern scarpment have provided an age of 830-840 ka”
    { id: 'dolina-guimar', nazwa: 'Dolina Güímar — stratowulkan Arafo na ryfcie NE (osunięty)', skala: 'ryft', odMa: 1.0, doMa: 0.84,
      skaly: ['bazalty', 'hialoklastyty w podłożu', 'dziś: lawy wypełnienia doliny (m.in. Arafo 1705)'], kolor: '#5f9a3c',
      podloze: { jednostka: 'tarcza-anaga', wys_m: 400, pewnosc: 'bardzo-niska', zrodlo: Z.wTenerife + ' (Dorsal wyrósł „amidst the remains of the older Ancient Basaltic Series (Series I)” — Seria I to wszystkie trzy stare masywy); wybór tarczy Anaga jako podłoża to założenie (Dorsal łączy się z Anagą, IGN); wys_m = mediana rzeźby tarczy Anaga (obliczenie własne, przybliżenie)' },
      wielokaty: [[[-16.469, 28.371], [-16.444, 28.381], [-16.415, 28.371], [-16.375, 28.348], [-16.35, 28.35], [-16.36, 28.265], [-16.386, 28.269], [-16.484, 28.284], [-16.488, 28.300], [-16.480, 28.339], [-16.469, 28.371]]],
      zapadniecie: { Ma: 0.83, wypelnienie_m: 500, zakresMa: [1.0, 0.57],
        zrodlo: 'wiek: ' + Z.ferrer2020 + ' (~830 ka; górne wylewy skarpy 830–840 ka), ' + ficha(37, 'Caldera de Pedro Gil') + ' (830 000 lat), Ferrer 2008/2011 (~1 Ma), ' + Z.wGeol + ' (850–570 ka); wypełnienie = skarpy boczne > 500 m (' + Z.ferrer2011 + ')', pewnosc: 'niska' },
      pewnosc: 'niska', zrodlo: Z.ferrer2020 + ' — fig. 1 (obrys); doMa = wiek górnych wylewów skarpy (Ferrer 2020, 830–840 ka)' },
    // IGN mapa (legenda odczytana z obrazu, nie tekst): Edificio Teide (czerwienie) + Edificio Pico Viejo (ciemna czerwień) + Domos sálicos postcaldera.
    // ficha 28 (współrzędne szczytu): „Lat. 28,272189°; Long. -16,641039°”
    { id: 'teide-pico-viejo', nazwa: 'Kompleks Teide–Pico Viejo', skala: 'stratowulkan', odMa: 0.17, doMa: 0,
      skaly: ['bazanity', 'fonolity maficzne', 'fonolity', 'obsydian'], kolor: '#b8322a', centrum: [-16.6425, 28.2724],
      // Podłoże: IGN „The Cañadas buildings collapsed giving rise to a large elliptical structure … and whose current bottom is at an altitude of 2,100 m.” … „Its place was taken by the post-boiler eruptions that occupied the great depression ( Pico Viejo, El Teide, Salt Domes)”
      // wys_m = dzisiejsze dno kaldery (2100 m) jako strop gmachu pod stożkiem; przed zapadnięciem gmach był wyższy (IGN: do ok. 4000 m).
      podloze: { jednostka: 'gmach-las-canadas', wys_m: 2100, pewnosc: 'niska', zrodlo: Z.ign + ' (dno kaldery 2100 m) — przybliżenie: wypełnienie kaldery pod stożkiem pominięte' },
      wielokaty: [[[-16.745, 28.285], [-16.71, 28.305], [-16.66, 28.315], [-16.62, 28.305], [-16.585, 28.29], [-16.575, 28.265], [-16.59, 28.245], [-16.62, 28.235], [-16.66, 28.225], [-16.70, 28.225], [-16.735, 28.24], [-16.75, 28.26], [-16.745, 28.285]]],
      pewnosc: 'niska', zrodlo: Z.ignMapa + '; wiek: ' + Z.wGeol + ' (ok. 170 tys. lat), ' + Z.wTenerife + ' (ok. 200 tys. lat)' },
    // IGN mapa (legenda z obrazu): Macizos antiguos / Macizo de Teno / Basaltos tabulares; IGN: „a basaltic lava pile 6.5 Ma slightly inclined towards the west”
    { id: 'tarcza-teno', nazwa: 'Tarcza Teno', skala: 'tarcza', odMa: 6.4, doMa: 5.1,
      skaly: ['bazalty tabularne', 'trachybazalty', 'brekcja', 'dajki'], kolor: '#3f6fb0',
      wielokaty: [[[-16.96, 28.42], [-16.86, 28.42], [-16.84, 28.385], [-16.815, 28.37], [-16.80, 28.335], [-16.805, 28.30], [-16.82, 28.265], [-16.83, 28.235], [-16.87, 28.21], [-16.96, 28.27], [-16.96, 28.42]]],
      pewnosc: 'niska', zrodlo: Z.ignMapa + '; wiek: ' + Z.wGeol + ' (6,4–5,1 Ma, za Guillou 2004); inne: IGN 6,5 Ma, ' + Z.wTenerife + ' ok. 7,4 Ma' },
    // IGN: „Anaga represents only the southern half of an island that extended northward, but that marine erosion and successive landslides have made it disappear.”
    { id: 'tarcza-anaga', nazwa: 'Tarcza Anaga', skala: 'tarcza', odMa: 4.9, doMa: 3.9,
      skaly: ['bazalty', 'fonolity maficzne', 'brekcje polimiktyczne (łuk Taganana)', 'dajki'], kolor: '#2f5f9e',
      wielokaty: [[[-16.40, 28.62], [-16.395, 28.555], [-16.375, 28.52], [-16.355, 28.495], [-16.30, 28.478], [-16.26, 28.465], [-16.24, 28.43], [-16.08, 28.50], [-16.08, 28.62], [-16.40, 28.62]]],
      pewnosc: 'niska', zrodlo: Z.ignMapa + '; wiek: ' + Z.wGeol + ' (4,9–3,9 Ma, za Guillou 2004); ' + ficha(3, 'Playa de Benijo') + ' (łuk Taganana ok. 16 mln lat, wiek sporny); inna wartość: ' + Z.wTenerife + ' (ok. 5,7 Ma)' },
    // IGN: „Roque del Conde represents the isolated remains of a building whose dimensions and relationship with the outcrops of the Teno Peninsula are unknown.”
    { id: 'tarcza-roque-del-conde', nazwa: 'Tarcza centralna (Roque del Conde)', skala: 'tarcza', odMa: 11.9, doMa: 8.9,
      skaly: ['bazalty'], kolor: '#4f8fc4',
      wielokaty: [[[-16.775, 28.165], [-16.735, 28.178], [-16.70, 28.165], [-16.685, 28.13], [-16.695, 28.10], [-16.735, 28.09], [-16.765, 28.105], [-16.785, 28.135], [-16.775, 28.165]]],
      pewnosc: 'niska', zrodlo: Z.ignMapa + '; wiek: ' + Z.wGeol + ' (11,9–8,9 Ma, za Guillou 2004)' },
    // IGN: „In the NW axis of Teno, today active” ; Amado 2007: „The Santiago rift is the most recent and active volcanic zone in the Tenerife island”
    // Wiek 0,2 Ma: Carracedo i in. 2007, GSA Bulletin (rifty NW i NE jako produkt ostatniej fazy od ok. 200 ka) — (streszczenie/pośrednio — nie pobrano)
    { id: 'ryft-nw', nazwa: 'Ryft NW (Santiago del Teide / Abeque)', skala: 'ryft', odMa: 0.2, doMa: 0,
      skaly: ['bazalty', 'trachybazalty', 'piroklasty (stożki strombolijskie)'], kolor: '#8cc152', centrum: [-16.7569, 28.2946],
      // Podłoże: IGN „Many strombolian eruptions emitted a large amount of basaltic flows on both sides of the slope covering part of the old Teno Massif and previous emissions from Cañadas.”
      // wys_m = dzisiejsza mediana wysokości lądu jednostki tarcza-teno z rzeźby (559 m) — szacunek; miąższości law ryftu źródła nie podają.
      podloze: { jednostka: 'tarcza-teno', wys_m: 560, pewnosc: 'bardzo-niska', zrodlo: Z.ign + ' — podłoże jest dwuczęściowe: część starego masywu Teno i wcześniejsze wylewy Cañadas; tarcza-teno i 560 m (mediana rzeźby tarczy Teno, obliczenie własne) to przybliżenie tylko części podłoża (gmach-las-canadas pominięty)' },
      wielokaty: [[[-16.86, 28.42], [-16.755, 28.42], [-16.745, 28.30], [-16.70, 28.27], [-16.72, 28.22], [-16.78, 28.19], [-16.86, 28.20], [-16.86, 28.42]]],
      pewnosc: 'niska', zrodlo: Z.ignMapa + ' („Eje de rift NO (Teno)”); ' + Z.ign + '; ' + Z.amado + '; wiek: Carracedo i in. 2007, GSA Bulletin — (streszczenie/pośrednio — nie pobrano)' },
    // IGN: „In the period between 1.0 Ma and 0.5 Ma, and the more recent non-historical ones, several strombolian volcanoes emitted basaltic flows on the NE-SW axis”
    // wDorsalEs: „Esta estructura se originó hace, aproximadamente, un millón de años por un [[vulcanismo]] fisural de tipo [[Basalto|basáltico]]”
    { id: 'ryft-ne-dorsal', nazwa: 'Ryft NE — grzbiet Dorsal (Pedro Gil)', skala: 'ryft', odMa: 1.0, doMa: 0,
      skaly: ['bazalty', 'aglomeraty bazaltowe', 'trachybazalty'], kolor: '#6fa83f', centrum: [-16.5097, 28.30],
      // Podłoże: wTenerife „the Dorsal Range (''Cordillera Dorsal'') emerged by means of fissural volcanic activity occurring amidst the remains of the older Ancient Basaltic Series (Series I)”.
      // wys_m = dzisiejsza mediana wysokości lądu jednostki tarcza-anaga z rzeźby (399 m) — szacunek stropu Serii I; miąższości law Dorsalu źródła nie podają.
      podloze: { jednostka: 'tarcza-anaga', wys_m: 400, pewnosc: 'bardzo-niska', zrodlo: Z.wTenerife + ' (Dorsal wyrósł „amidst the remains of the older Ancient Basaltic Series (Series I)” — Seria I to wszystkie trzy stare masywy); wybór tarczy Anaga jako podłoża to założenie (Dorsal łączy się z Anagą, IGN); wys_m = mediana rzeźby tarczy Anaga (obliczenie własne, przybliżenie)' },
      wielokaty: [[[-16.612, 28.44], [-16.42, 28.62], [-16.22, 28.52], [-16.24, 28.44], [-16.33, 28.37], [-16.36, 28.35], [-16.48, 28.28], [-16.56, 28.27], [-16.60, 28.29], [-16.612, 28.44]]],
      pewnosc: 'niska', zrodlo: Z.ignMapa + ' („Eje de rift NE o Dorsal”, „Edificio Dorsal”); wiek: ' + Z.ign + ', ' + Z.wDorsalEs + '; erupcje 1704–1705 na osi: ' + Z.ign },
    // ficha 30 (centrum = punkt fichy w kalderze): „Lat. 28,212419°; Long. -16,638697°”
    { id: 'gmach-las-canadas', nazwa: 'Gmach Las Cañadas (ściana kaldery i stoki południowe)', skala: 'gmach', odMa: 4.0, doMa: 0.2,
      skaly: ['fonolity', 'trachybazalty', 'ignimbryty i pumeksy', 'bazalty'], kolor: '#9a5b34', centrum: [-16.638697, 28.212419],
      wielokaty: [[[-16.665, 28.42], [-16.60, 28.42], [-16.575, 28.30], [-16.50, 28.28], [-16.38, 28.26], [-16.33, 28.15], [-16.42, 28.05], [-16.55, 28.12], [-16.65, 28.13], [-16.72, 28.17], [-16.76, 28.20], [-16.74, 28.25], [-16.70, 28.27], [-16.665, 28.42]]],
      pewnosc: 'niska', zrodlo: Z.ignMapa + ' („Edificios Cañadas”, „Laderas de Cañadas”, „Tigaiga”); wiek: ' + Z.wGeol + ' (4,0–0,2 Ma), ' + Z.ign + ' (4 Ma – 170 tys. lat)' },
    // Zbiorcza: reszta lądu. wGeol: „The rejuvenation stage of Tenerife … started at about 4&nbsp;Ma and continues to the present day.”
    // IGN: „Finally, in the third NS axis, two large strombolian cone fields covered part of the slopes of Cañadas and the old Roque del Conde massif.”
    { id: 'reszta-mlodsze-pokrywy', nazwa: 'Młodsze pokrywy law i piroklastów (zbiorczo: m.in. pola stożków osi N–S na południu)', skala: 'gmach', odMa: 4.0, doMa: 0,
      skaly: ['bazalty', 'piroklasty', 'pumeksy', 'osady'], kolor: '#b9b07a',
      wielokaty: [[[-16.3454, 28.3], [-16.3429, 28.3149], [-16.3446, 28.3298], [-16.3483, 28.3444], [-16.3462, 28.3603], [-16.329, 28.3815], [-16.2692, 28.4215], [-16.2216, 28.4654], [-16.0995, 28.5562], [-16.1186, 28.5851], [-16.1447, 28.6097], [-16.2276, 28.5895], [-16.266, 28.5961], [-16.3111, 28.592], [-16.3708, 28.5648], [-16.4206, 28.538], [-16.5117, 28.4355], [-16.5251, 28.4346], [-16.5373, 28.4341], [-16.5488, 28.4336], [-16.5616, 28.4271], [-16.5719, 28.4251], [-16.582, 28.4211], [-16.5915, 28.4155], [-16.6, 28.4149], [-16.6082, 28.411], [-16.6165, 28.4112], [-16.6255, 28.4135], [-16.6341, 28.4127], [-16.6436, 28.4139], [-16.6523, 28.412], [-16.6641, 28.4152], [-16.6747, 28.4147], [-16.6836, 28.4109], [-16.6938, 28.4083], [-16.7049, 28.4061], [-16.7118, 28.3991], [-16.7281, 28.3996], [-16.736, 28.3925], [-16.7527, 28.3904], [-16.7683, 28.3861], [-16.8457, 28.4074], [-16.8649, 28.3973], [-16.8826, 28.385], [-16.9213, 28.3763], [-16.9362, 28.3593], [-16.9399, 28.3397], [-16.9151, 28.3183], [-16.8994, 28.3], [-16.8851, 28.2834], [-16.8746, 28.2679], [-16.8602, 28.2541], [-16.8612, 28.238], [-16.858, 28.2224], [-16.8521, 28.2074], [-16.8448, 28.193], [-16.8355, 28.1795], [-16.8261, 28.1661], [-16.8185, 28.1513], [-16.8113, 28.1357], [-16.8006, 28.1222], [-16.7904, 28.1076], [-16.777, 28.0955], [-16.7624, 28.0846], [-16.7513, 28.0678], [-16.7435, 28.0421], [-16.7283, 28.0255], [-16.7172, 27.9938], [-16.6949, 27.9859], [-16.6711, 27.9833], [-16.6465, 27.9871], [-16.6226, 27.9941], [-16.6, 28.007], [-16.5789, 28.0148], [-16.5566, 28.0077], [-16.5351, 28.0108], [-16.5195, 28.0336], [-16.5033, 28.0474], [-16.4897, 28.064], [-16.4752, 28.0757], [-16.4641, 28.0913], [-16.4521, 28.1037], [-16.4413, 28.1167], [-16.4278, 28.1259], [-16.4153, 28.1363], [-16.4144, 28.1557], [-16.4114, 28.1717], [-16.4083, 28.1864], [-16.4043, 28.1998], [-16.3987, 28.212], [-16.3922, 28.2237], [-16.3865, 28.2358], [-16.3788, 28.2474], [-16.3699, 28.2594], [-16.3658, 28.2727], [-16.3602, 28.2861], [-16.3454, 28.3]]],
      pewnosc: 'bardzo-niska', zrodlo: 'obrys lądu wyliczony z rzeźby geologia/teneryfa/rzezba.png (AWS Terrain Tiles / SRTM) — jednostka zbiorcza, bez granic z mapy; wiek: ' + Z.wGeol + ' (faza odmłodzenia od ok. 4 Ma do dziś); ' + Z.ign + ' (pola stożków osi N–S)' }
  ];

  // ───────────────────────────── WARSTWY PRZEKROJU (schemat) ─────────────────────────────
  var warstwy = [
    // Watts i in. — (streszczenie/pośrednio — nie pobrano): ok. 6,4 km; spąg = 3000 (dno, IGN) + 2500 (osady) + 6400.
    { id: 'w-skorupa', nazwa: 'Skorupa oceaniczna (jura)', odGlebokosci_m: 11900, doGlebokosci_m: 5500, wiekMa: [175, 150], skala: 'skorupa', schemat: true,
      pewnosc: 'niska', zrodlo: 'grubość: Watts i in., „A seismic study of lithospheric flexure in the vicinity of Tenerife” — (streszczenie/pośrednio — nie pobrano); wiek: ' + Z.wGeol + '; głębokości złożone schematycznie (dno 3000 m wg IGN + osady 2500 m + skorupa 6,4 km)' },
    // Sci. Rep. 2013 (srep02107) — (streszczenie/pośrednio — nie pobrano): co najmniej 2500–3000 m osadów w sąsiedztwie, nie pod samą wyspą.
    { id: 'w-osady', nazwa: 'Osady dna oceanu', odGlebokosci_m: 5500, doGlebokosci_m: 3000, skala: 'osad', schemat: true,
      pewnosc: 'niska', zrodlo: 'Scientific Reports 2013 (srep02107), sejsmika refleksyjna w sąsiedztwie NE Teneryfy — (streszczenie/pośrednio — nie pobrano); strop = dno ok. 3000 m (' + Z.ign + ')' },
    // Ferrer 2011 (hialoklastyty pod gmachem); ficha 4 (lawy poduszkowe). Grubość kompleksu w źródłach nie jest podana — strop = poziom morza z geometrii.
    { id: 'w-kompleks-podmorski', nazwa: 'Kompleks podmorski: lawy poduszkowe i hialoklastyty', odGlebokosci_m: 3000, doGlebokosci_m: 0, skala: 'gmach', schemat: true,
      pewnosc: 'niska', zrodlo: Z.ferrer2011 + '; ' + ficha(4, 'Igueste de San Andrés-Pillow Lavas') + '; grubość nie jest podana w źródłach — zasięg od dna (IGN, 3000 m) do poziomu morza to założenie schematu' },
    // ficha 14: „basaltos tabulares de hasta 1000 metros de potencia”
    { id: 'w-tarcze', nazwa: 'Tarcze bazaltowe (bazalty tabularne z dajkami)', odGlebokosci_m: 0, doGlebokosci_m: -1000, wiekMa: [11.9, 3.9], skala: 'tarcza', schemat: true,
      pewnosc: 'srednia', zrodlo: ficha(14, 'Barranco del Infierno') + ' (do 1000 m miąższości); wiek: ' + Z.wGeol },
    // IGN: dno kaldery „at an altitude of 2,100 m” i ściany „that reach 500 m in height” → strop gmachu schematycznie 2600 m.
    { id: 'w-gmach-canadas', nazwa: 'Gmach Las Cañadas (fonolity, trachybazalty, ignimbryty)', odGlebokosci_m: -1000, doGlebokosci_m: -2600, wiekMa: [4.0, 0.2], skala: 'gmach', schemat: true,
      pewnosc: 'niska', zrodlo: Z.ign + ' (dno kaldery 2100 m + ściany do 500 m); spąg = strop tarcz (założenie schematu); wiek: ' + Z.wGeol },
    { id: 'w-teide-pico-viejo', nazwa: 'Stożek Teide–Pico Viejo', odGlebokosci_m: -2100, doGlebokosci_m: -3718, wiekMa: [0.17, 0], skala: 'stratowulkan', schemat: true,
      pewnosc: 'srednia', zrodlo: Z.ign + ' (dno kaldery 2100 m, szczyt 3718 m); wiek: ' + Z.wGeol },
    { id: 'w-zbiornik-fonolitowy', nazwa: 'Płytkie zbiorniki magmy fonolitowej (kilka, nie jedna komora)', odGlebokosci_m: 2000, doGlebokosci_m: 1000, skala: 'komora', schemat: true,
      pewnosc: 'niska', zrodlo: 'przegląd Earth, Planets and Space 2018 (DOI 10.1186/s40623-018-0783-y; 1–2 km p.p.m.) — (streszczenie/pośrednio — nie pobrano), wg pliku faktów F3.8' }
  ];

  // ───────────────────────────── OŚ CZASU ─────────────────────────────
  var osCzasu = [
    { id: 'oc-skorupa', Ma: 175, przedzialMa: [175, 150], nazwa: 'Skorupa oceaniczna', opis: 'Powstaje jurajska skorupa oceaniczna, na której później wyrosną Kanary.', pewnosc: 'srednia', zrodlo: Z.wGeol },
    { id: 'oc-wynurzenie', Ma: 11.9, przedzialMa: [12, 11.9], nazwa: 'Wynurzenie', opis: 'Pierwsze skały wychodzą nad ocean; rośnie tarcza centralna (Roque del Conde).', pewnosc: 'srednia', zrodlo: Z.wGeol + '; ' + Z.ign + ' (ok. 12 mln lat)' },
    { id: 'oc-teno', Ma: 6.4, przedzialMa: [6.4, 5.1], nazwa: 'Tarcza Teno', opis: 'Na północnym zachodzie rośnie druga tarcza — Teno.', pewnosc: 'srednia', zrodlo: Z.wGeol + ' (za Guillou 2004); inne: ok. 7,4 Ma (' + Z.wTenerife + ')' },
    { id: 'oc-anaga', Ma: 4.9, przedzialMa: [5.7, 3.9], nazwa: 'Tarcza Anaga', opis: 'Na północnym wschodzie rośnie trzecia tarcza — Anaga (4,9–3,9 mln lat; inne źródło: ok. 5,7 mln lat).', pewnosc: 'srednia', zrodlo: Z.wGeol + ' (za Guillou 2004, 4,9–3,9 Ma); ' + Z.wTenerife + ' (ok. 5,7 Ma)' },
    { id: 'oc-canadas', Ma: 4.0, przedzialMa: [4.0, 0.17], nazwa: 'Gmach Las Cañadas', opis: 'Po przerwie erozyjnej w środku wyspy rośnie gmach Las Cañadas, do ok. 4000 m.', pewnosc: 'srednia', zrodlo: Z.ign + '; ' + Z.wGeol },
    // Hunt 2018: „Roques de Garcia (1.15 ± 0.01 Ma)”
    { id: 'oc-roques-de-garcia', Ma: 1.15, przedzialMa: [1.15, 0.6], nazwa: 'Osuwisko Roques de García', opis: 'Osuwisko zbocza wiązane z półkalderą Ucanca; wiek sporny.', pewnosc: 'niska', zrodlo: Z.hunt2018 + ' (1,15 ± 0,01 Ma); inne: 0,6–0,7 Ma (Ancochea 1999, streszczenie/pośrednio — nie pobrano)' },
    { id: 'oc-ucanca', Ma: 1.02, nazwa: 'Półkaldera Ucanca', opis: 'Według hipotezy zapadnięć — pierwsza z trzech półkalder Las Cañadas.', pewnosc: 'srednia', zrodlo: ficha(30, 'Caldera de Las Cañadas') },
    { id: 'oc-dorsal', Ma: 1.0, przedzialMa: [1.0, 0.5], nazwa: 'Grzbiet Dorsal', opis: 'Szczelinowe erupcje bazaltowe na osi NE budują grzbiet Dorsal.', pewnosc: 'srednia', zrodlo: Z.ign + '; ' + Z.wDorsalEs },
    { id: 'oc-guimar', Ma: 0.83, przedzialMa: [1.0, 0.57], nazwa: 'Osuwisko Güímar', opis: 'Megaosuwisko zabiera stratowulkan Arafo; powstaje dolina Güímar.', pewnosc: 'srednia', zrodlo: Z.ferrer2020 + '; ' + ficha(37, 'Caldera de Pedro Gil') },
    { id: 'oc-guajara', Ma: 0.57, nazwa: 'Półkaldera Guajara', opis: 'Według hipotezy zapadnięć — druga półkaldera.', pewnosc: 'srednia', zrodlo: ficha(30, 'Caldera de Las Cañadas') },
    { id: 'oc-orotava', Ma: 0.535, przedzialMa: [0.69, 0.5], nazwa: 'Osuwiska La Orotava', opis: 'Kilka osuwisk w odstępach dziesiątek tysięcy lat tworzy dolinę La Orotava.', pewnosc: 'srednia', zrodlo: Z.hunt2018 + '; ' + Z.ferrer2020 },
    { id: 'oc-icod', Ma: 0.17, przedzialMa: [0.2, 0.16], nazwa: 'Osuwisko Icod i kaldera', opis: 'Północne zbocze gmachu Las Cañadas zsuwa się do oceanu; powstaje dolina Icod i ostatnia faza kaldery (Diego Hernández).', pewnosc: 'srednia', zrodlo: Z.hunt2018 + '; ' + Z.ferrer2020 + '; ' + ficha(30, 'Caldera de Las Cañadas') },
    { id: 'oc-teide', Ma: 0.17, przedzialMa: [0.2, 0.17], nazwa: 'Narodziny Teide', opis: 'W bliźnie po osuwisku zaczynają rosnąć Teide i Pico Viejo.', pewnosc: 'srednia', zrodlo: Z.wGeol + '; ' + Z.wTeide },
    // ficha 25: „(20.775±321 años) emitidas por Pico Viejo”
    { id: 'oc-cueva-del-viento', Ma: 0.020775, nazwa: 'Lawy Cueva del Viento', opis: 'Wylewy pahoehoe z Pico Viejo, w których uformował się tunel Cueva del Viento.', pewnosc: 'wysoka', zrodlo: ficha(25, 'Cueva del Viento') },
    // ficha 26: „No hay dataciones absolutas para todo el complejo eruptivo excepto una por 14C de hace unos 2020 años, lo que la sitúa como la última erupción subpliniana que se produjo en Tenerife.”
    { id: 'oc-montana-blanca', Ma: 0.00202, nazwa: 'Erupcja Montaña Blanca', opis: 'Ostatnia erupcja subplinijska Teneryfy; pumeks mógł pokryć całą wyspę, najgrubiej wschód.', pewnosc: 'srednia', zrodlo: ficha(26, 'Montaña Blanca-Rajada') },
    // ficha 50: „Esta erupción se produjo hace uno 990 ± 70 BP”
    { id: 'oc-montana-reventada', Ma: 0.00099, nazwa: 'Erupcja Montaña Reventada', opis: 'Erupcja u podnóża Pico Viejo, ok. 990 ± 70 lat BP.', pewnosc: 'srednia', zrodlo: ficha(50, 'Lavas Montaña Reventada') },
    { id: 'oc-1492', rok: 1492, nazwa: 'Ogień widziany z okrętów Kolumba', opis: 'Załogi płynące na La Gomerę widzą ogień na Teneryfie; który wulkan — sporne.', pewnosc: 'niska', zrodlo: Z.kolumb + '; ' + ficha(47, 'Volcán Boca Cangrejo') },
    // IGN: „The earthquakes associated with the triple eruption of Sietefuentes, Fasnia and Arafo between 1704 and 1705”
    { id: 'oc-1704', rok: 1704, nazwa: 'Siete Fuentes, Fasnia, Arafo', opis: 'Potrójna erupcja na osi NE (1704–1705) z silnymi trzęsieniami ziemi.', pewnosc: 'wysoka', zrodlo: Z.ign + '; ' + Z.volki },
    // ficha 41: „La erupción de Arenas Negras de 1706 se inició el 5 de mayo y finalizó el 13 de junio.”
    { id: 'oc-1706', rok: 1706, nazwa: 'Erupcja Arenas Negras — Garachico', opis: 'Lawa zasypuje port Garachico.', pewnosc: 'wysoka', zrodlo: ficha(41, 'Taludes Lávicos Garachico') },
    // ficha 32: „ra Narices del Teide es la erupción histórica más larga de Tenerife”
    { id: 'oc-1798', rok: 1798, nazwa: 'Narices del Teide (Chahorra)', opis: 'Najdłuższa historyczna erupcja wyspy, na zboczu Pico Viejo.', pewnosc: 'wysoka', zrodlo: ficha(32, 'Las Narices del Teide / Chahorra') },
    { id: 'oc-1909', rok: 1909, nazwa: 'Chinyero', opis: 'Ostatnia erupcja na Teneryfie.', pewnosc: 'srednia', zrodlo: ficha(45, 'Volcán Chinyero') + '; ' + Z.wHist }
  ];

  // ───────────────────────────── ERUPCJE HISTORYCZNE ─────────────────────────────
  var erupcje = [
    // kolumb: „finally they sailed to Gomera. They saw a great eruption of names [sic, ‘flames’] from the Peak of Teneriffe, a lofty mountain.”
    // ficha 47: „Estudios recientes enmarcan … esta erupción como histórica (Carracedo et al., 2006) … haciéndola coincidir con la que presenció Cristóbal Colón … Por otro, … (Romero, 2007; Romero et al., 2009) señalan que Boca Cangrejo sería la primera erupción histórica de Tenerife pero que no coincide con la que vio Colón.”
    { id: 'e-1492', rok: 1492, nazwa: 'Ogień z relacji Kolumba (Boca Cangrejo?)', lonLat: [-16.759843, 28.282774],
      czasTrwania: 'nieznany', skutki: 'Brak; to pierwsza pisemna wzmianka o ogniu na Teneryfie. Przypisanie do Boca Cangrejo jest sporne.',
      pewnosc: 'niska', zrodlo: Z.kolumb + '; ' + ficha(47, 'Volcán Boca Cangrejo') },
    // ign: „The earthquakes associated with the triple eruption of Sietefuentes, Fasnia and Arafo between 1704 and 1705 (Sánchez-Sanz, 2014) stand out for their great intensity.”
    // ddaArafo: „La erupción de Arafo , iniciada el 2 de febrero de 1705, se produjo en plena celebración del día de la Virgen de Candelaria .”
    // volki (tabela): „Siete Fuentes Fasnia Arafo” … „31 December – 5 January 5-15 January 2 February – 27 March”
    { id: 'e-1704', rok: 1704, nazwa: 'Siete Fuentes, Fasnia i Arafo (1704–1705)', lonLat: [-16.482101, 28.344891],
      czasTrwania: '31 XII 1704 – 27 III 1705, trzy fazy: Siete Fuentes, Fasnia (5–15 I 1705), Arafo (2 II – 27 III 1705)',
      skutki: 'Silne trzęsienia ziemi; lawa Arafo spłynęła ku dolinie Güímar. Erupcja Arafo zaczęła się w dniu święta Candelarii.',
      pewnosc: 'srednia', zrodlo: Z.ign + '; ' + Z.volki + '; ' + Z.ddaArafo + '; współrzędne: Caldera de Pedro Gil, ' + ficha(37, 'Caldera de Pedro Gil') },
    // ficha 42: „LIG 42 Volcán Garachico … Lat. 28,316175°; Long. -16,762999°” … „de unos 80 metros de altura”
    { id: 'e-1706', rok: 1706, nazwa: 'Arenas Negras / Trevejo — erupcja Garachico', lonLat: [-16.762999, 28.316175],
      czasTrwania: '5 V – 13 VI 1706 (ok. 40 dni; INVOLCAN, Tenerife Weekly); Wikipedia: 5–14 V',
      skutki: 'Lawa zasypała port Garachico — najważniejszy port wyspy — i częściowo zniszczyła miasto; ludność spadła z 1600 do 400 w rok.',
      pewnosc: 'wysoka', zrodlo: ficha(41, 'Taludes Lávicos Garachico') + '; ' + ficha(42, 'Volcán Garachico') + '; ' + Z.tw1706 + '; ' + Z.wTrevejo,
      przebieg: [
        // tw1706: „The tremors kept the Garachicans in suspense all night until an hour before dawn on May 5, 1706”
        { kiedy: 'noc z 4 na 5 V 1706', poraDoby: 'noc', co: 'Wstrząsy przez całą noc trzymają mieszkańców Garachico w napięciu.', pewnosc: 'srednia', zrodlo: Z.tw1706 + ' (kronika Cassaresa)' },
        // tw1706: „until an hour before dawn on May 5, 1706, an outbreak abruptly resounded in the distance” … „At an altitude of 1,300 meters … and 6.5 kilometers from the coastal town, a 950-meter fracture with more than 12 eruptive foci was opened.”
        { kiedy: '5 V 1706, ok. godzinę przed świtem', poraDoby: 'noc', co: 'Wybuch: na wysokości ok. 1300 m, 6,5 km od miasta, otwiera się szczelina długości 950 m z ponad 12 otworami.', pewnosc: 'srednia', zrodlo: Z.tw1706 + ' (kronika Cassaresa)' },
        // tw1706: „Then there were other outbursts.”
        { kiedy: '5 V 1706, po pierwszym wybuchu', poraDoby: 'nieznana', co: 'Kolejne wybuchy; ze szczeliny zaczyna płynąć lawa.', pewnosc: 'srednia', zrodlo: Z.tw1706 },
        // ficha 41: „las lenguas de lava alcanzaron el día 5 y luego el 13 de mayo el antiguo cantil y descendieron por él formando taludes escoriáceos hasta alcanzar la villa y puerto de Garachico” … „descendieron por el cantil unos siete brazos de lava.”
        { kiedy: '5 V 1706', poraDoby: 'nieznana', co: 'Lawa dociera do starego klifu nad miastem i spływa po nim ku Garachico i portowi.', pewnosc: 'wysoka', zrodlo: ficha(41, 'Taludes Lávicos Garachico') },
        { kiedy: '13 V 1706', poraDoby: 'nieznana', co: 'Lawa po raz drugi przelewa się przez klif; kroniki liczą ok. siedmiu ramion lawy na klifie.', pewnosc: 'wysoka', zrodlo: ficha(41, 'Taludes Lávicos Garachico') },
        // ficha 41: „La erupción de Arenas Negras de 1706 se inició el 5 de mayo y finalizó el 13 de junio.”
        { kiedy: '13 VI 1706', poraDoby: 'nieznana', co: 'Koniec erupcji (Wikipedia podaje 14 V).', pewnosc: 'wysoka', zrodlo: ficha(41, 'Taludes Lávicos Garachico') + '; ' + Z.wTrevejo }
      ] },
    // ficha 32: „su actividad se inició el 9 de junio de 1798 y cesó el 15 de septiembre del mismo año.” … „tan solo señalan una fuerte detonación” … „A lo largo de la fractura de más de 1 km de longitud y de dirección NE-SO”
    // wHist: „occurred in the [[Pico Viejo]] on 9 June 1798 and ended on 8 September that year.” ; MITECO: „Duró 99 días”
    { id: 'e-1798', rok: 1798, nazwa: 'Narices del Teide (Chahorra)', lonLat: [-16.677862, 28.255141],
      czasTrwania: '9 VI – 15 IX 1798, 99 dni (INVOLCAN, MITECO); Wikipedia: do 8 IX',
      skutki: 'Najdłuższa historyczna erupcja wyspy: szczelina ponad 1 km na zboczu Pico Viejo; kroniki odnotowały tylko silną detonację na początku.',
      pewnosc: 'wysoka', zrodlo: ficha(32, 'Las Narices del Teide / Chahorra') + '; ' + Z.miteco + '; ' + Z.wHist },
    // ficha 45: „La erupción del Chinyero de 1909 se desarrolló a lo largo de una fractura de dirección NO-SE de más de 0,5 km de longitud.”
    // wHist: „The eruption of Chinyero began on 18 November 1909 and lasted 10 days.”; volki (tabela): „18-[27 November]”
    { id: 'e-1909', rok: 1909, nazwa: 'Chinyero', lonLat: [-16.756923, 28.294625],
      czasTrwania: 'od 18 XI 1909, ok. 10 dni (Wikipedia; Volkiblog: 18–27 XI)',
      skutki: 'Szczelina ponad 0,5 km, dwa stożki; lawy aa porwały bloki wielkości kilku metrów.',
      pewnosc: 'srednia', zrodlo: ficha(45, 'Volcán Chinyero') + '; ' + Z.wHist + '; ' + Z.volki }
  ];

  // ───────────────────────────── CZĘŚCI WYSPY ─────────────────────────────
  function czesc(o) { o.wers = { id: 'teneryfa/czesc/' + o.id, tekst: o.wers }; return o; }
  var czesci = [
    // Współrzędne: maksimum rzeźby (rzezba-teide.png: −16,6424; 28,2726) = ficha 28 „Lat. 28,272189°; Long. -16,641039°” z dokładnością ok. 150 m.
    czesc({ id: 'teide', nazwa: 'Teide', rodzaj: 'stratowulkan', lonLat: [-16.6425, 28.2724], wys_m: 3718, promien_km: 4,
      opis: 'Najwyższy szczyt Hiszpanii i najwyższy wulkan Atlantyku: 3718 m (INVOLCAN, IGN; inne źródła 3715 m). Wierzchołek ma krater o średnicy ok. 80 m z czynnymi fumarolami. Rośnie w kalderze Las Cañadas od ok. 170 tys. lat.',
      pewnosc: 'wysoka', zrodlo: ficha(28, 'Teide-Pico Viejo') + '; ' + Z.ign + '; promień kadru — szacunek (bez źródła)',
      wers: 'Teide — 3718 metrów. Najwyższa góra Hiszpanii wyrasta z kaldery starszego, zniszczonego wulkanu.' }),
    // wPicoViejo: „{{coord|28.262|-16.668|…}}”
    czesc({ id: 'pico-viejo', nazwa: 'Pico Viejo', rodzaj: 'stratowulkan', lonLat: [-16.668, 28.262], wys_m: 3134, promien_km: 2,
      opis: 'Młodszy, zachodni sąsiad Teide: 3134 m (IGN) albo 3129 m (Wikipedia). Ma największy krater archipelagu, ok. 800 m średnicy. Z jego zbocza wypłynęła lawa w 1798 r.',
      pewnosc: 'srednia', zrodlo: Z.ign + '; Wikipedia (en), „Pico Viejo” (wikitext pobrany 2026-11-21); ' + ficha(28, 'Teide-Pico Viejo') + '; promień — szacunek',
      wers: 'Pico Viejo ma największy krater na Kanarach — około ośmiuset metrów średnicy.' }),
    // ficha 30: „Es una gran depresión elíptica de unos 16 km de diámetro mayor, 144 km2 de superficie y 600 m de desnivel.”
    czesc({ id: 'las-canadas', nazwa: 'Kaldera Las Cañadas', rodzaj: 'kaldera', lonLat: [-16.638697, 28.212419], wys_m: 2100, promien_km: 8,
      opis: 'Eliptyczna depresja o osi ok. 16 km i ścianach do 500–600 m; dno leży na ok. 2100 m. Powstała przez zapadnięcia, osuwisko albo oba procesy — to wciąż spór. Teide stoi w jej północnej części.',
      pewnosc: 'srednia', zrodlo: ficha(30, 'Caldera de Las Cañadas') + '; ' + Z.ign + '; promień = połowa osi 16 km',
      wers: 'Las Cañadas — szesnaście kilometrów pustki po wulkanie, który się zawalił albo zsunął do morza.' }),
    // wAnaga: „{{coord|28|31|50|N|16|14|27|W|…}}”
    czesc({ id: 'anaga', nazwa: 'Masyw Anaga', rodzaj: 'masyw', lonLat: [-16.24083, 28.53056], wys_m: 1024, promien_km: 10,
      opis: 'Najmłodsza z trzech starych tarcz, sprzed 4,9–3,9 mln lat, mocno porżnięta wąwozami. Najwyżej sięga Cruz de Taborno, 1024 m. Od 2015 r. rezerwat biosfery UNESCO.',
      pewnosc: 'srednia', zrodlo: Z.wAnaga + '; ' + Z.wGeol + '; promień — szacunek z wielokąta jednostki',
      wers: 'Anaga to stara tarcza, którą deszcz i morze pocięły na ostre grzbiety.' }),
    // Punkt: środek komórek lądu jednostki tarcza-teno (obliczenie własne z rzeźby i wielokąta).
    czesc({ id: 'teno', nazwa: 'Masyw Teno', rodzaj: 'masyw', lonLat: [-16.8497, 28.3245], wys_m: 1342, promien_km: 7,
      opis: 'Tarcza z bazaltów tabularnych sprzed 6,4–5,1 mln lat, przecięta gęstą siecią dajek. Najwyżej leży Mount Gala, 1342 m. Od zachodu kończy ją przylądek Punta de Teno.',
      pewnosc: 'niska', zrodlo: Z.wGeol + '; ' + Z.wTenerife + ' — Geology/Massifs; punkt = środek lądu jednostki tarcza-teno (obliczenie własne)',
      wers: 'Teno: lawy sprzed ponad pięciu milionów lat, pocięte żyłami dawnej magmy.' }),
    // Teide Observatory (Izaña) — Wikidata Q2013047, P625: latitude 28.3, longitude -16.50972222
    czesc({ id: 'dorsal', nazwa: 'Grzbiet Dorsal (Izaña)', rodzaj: 'grzbiet', lonLat: [-16.5097, 28.30], wys_m: 2390, promien_km: 12.5,
      opis: 'Grzbiet z bazaltowych erupcji szczelinowych na osi NE, sprzed ok. 1 mln lat; łączy Anagę ze środkiem wyspy na ok. 25 km. Na jego szczycie, w Izañi, stoi Obserwatorium Teide.',
      pewnosc: 'srednia', zrodlo: Z.wDorsalEs + '; ' + Z.ign + '; współrzędne: Wikidata Q2013047 (Teide Observatory, Izaña); promień = połowa długości 25 km',
      wers: 'Dorsal to kręgosłup wyspy: dwadzieścia pięć kilometrów lawy wylanej ze szczelin.' }),
    // wOrotava: „{{coord|28|23|26|N|16|31|29|W|…}}” (miasto w dolinie)
    czesc({ id: 'orotava', nazwa: 'Dolina La Orotava', rodzaj: 'dolina', lonLat: [-16.5247, 28.3906], promien_km: 5.5,
      opis: 'Koryto szerokie na 10–12 km, po osuwiskach sprzed ok. 560–500 tys. lat, zamknięte ścianami do 500–600 m (Tigaiga). Dno wypełniły późniejsze lawy. Punkt wskazuje miasto La Orotava.',
      pewnosc: 'srednia', zrodlo: Z.ferrer2011 + '; ' + Z.ferrer2020 + '; współrzędne: Wikipedia (en), „La Orotava” (wikitext pobrany 2026-11-21); promień = połowa szerokości',
      wers: 'Dolina La Orotava to blizna: tędy pół miliona lat temu zbocze zjechało do oceanu.' }),
    // wGuimar: „{{Coord|28|18|54|N|16|24|36|W|type:city|…}}”
    czesc({ id: 'guimar', nazwa: 'Dolina Güímar', rodzaj: 'dolina', lonLat: [-16.41, 28.315], promien_km: 5.5,
      opis: 'Dolina po megaosuwisku sprzed ok. 830 tys. lat, które zabrało stratowulkan Arafo; materiał dotarł ok. 85 km w głąb oceanu. Na jej dnie leży Malpaís de Güímar. Punkt wskazuje miasto Güímar.',
      pewnosc: 'srednia', zrodlo: ficha(37, 'Caldera de Pedro Gil') + '; ' + Z.ferrer2011 + '; współrzędne: Wikipedia (en), „Güímar” (wikitext pobrany 2026-11-21)',
      wers: 'Güímar: osiemset trzydzieści tysięcy lat temu cały wulkan zsunął się tu do morza.' }),
    // wIcod: „{{Coord|28|21|N|16|42|W|type:town|…}}”
    czesc({ id: 'icod', nazwa: 'Dolina Icod', rodzaj: 'dolina', lonLat: [-16.70, 28.35], promien_km: 5,
      opis: 'Dolina po osuwisku północnego zbocza gmachu Las Cañadas sprzed ok. 165–200 tys. lat; jego skarpą czołową jest ściana kaldery. Dziś wypełniają ją lawy Teide i Pico Viejo, a w nich biegnie Cueva del Viento.',
      pewnosc: 'srednia', zrodlo: Z.hunt2018 + '; ' + Z.ferrer2020 + '; ' + Z.ign + '; współrzędne: Wikipedia (en), „Icod de los Vinos”; promień — szacunek z obrysu Ferrer 2020',
      wers: 'Icod: tu zsunęła się północna ściana wulkanu, a w powstałą bliznę wrósł Teide.' }),
    // wGarachico: „{{coord|28|22|20|N|16|45|50|W|…}}”
    czesc({ id: 'garachico', nazwa: 'Garachico', rodzaj: 'miasto', lonLat: [-16.7639, 28.3722], promien_km: 0.6,
      opis: 'Dawny najważniejszy port Teneryfy. W 1706 r. lawa z Arenas Negras zasypała port i część miasta; mieszkańców ubyło z 1600 do 400. Miasto odbudowano.',
      pewnosc: 'srednia', zrodlo: Z.wGarachico + '; ' + Z.wTrevejo + '; ' + Z.tw1706 + '; promień świateł — szacunek',
      wers: 'Garachico: port, który w maju 1706 roku zalała lawa.' }),
    // ficha 42: „edificando un volcán de escorias, lapilli y abundantes bombas volcánicas, de unos 80 metros de altura”
    czesc({ id: 'montana-negra', nazwa: 'Montaña Negra — wulkan Garachico (Arenas Negras, Trevejo)', rodzaj: 'stozek', lonLat: [-16.762999, 28.316175], wys_m: 1347, promien_km: 0.5,
      opis: 'Wulkan erupcji z 1706 r.: szczelina NW–SE i stożek z żużla i lapilli wysoki na ok. 80 m. Z jego krateru w kształcie podkowy spłynęły lawy aa, które przeskoczyły klif nad Garachico.',
      pewnosc: 'wysoka', zrodlo: ficha(42, 'Volcán Garachico') + '; wys_m = rzeźba w punkcie fichy; promień — szacunek (szczelina ok. 1 km)',
      wers: 'Arenas Negras — stąd w 1706 roku ruszyła lawa na Garachico.' }),
    // Punkt: ficha 41 „Lat. …; Long. …” (taludes lávicos, wybrzeże Garachico) — współrzędne z pliku faktów O19, baseny leżą na lawie z 1706.
    czesc({ id: 'el-caleton', nazwa: 'El Caletón', rodzaj: 'baseny-lawowe', lonLat: [-16.764083, 28.371662], promien_km: 0.15,
      opis: 'Naturalne baseny w lawie z 1706 r., która weszła do morza i przesunęła brzeg. To naturalne baseny skalne z zastygłej lawy.',
      pewnosc: 'srednia', zrodlo: WLASCICIEL + '; ' + ficha(41, 'Taludes Lávicos Garachico') + ' („ganaron terreno al mar”); współrzędne przybliżone (plik faktów O19)',
      wers: 'El Caletón: baseny wyrzeźbione przez morze w lawie, która zniszczyła port.' }),
    // ficha 11: „Lat. 28,240422°; Long. -16,836911°”
    czesc({ id: 'los-gigantes', nazwa: 'Klify Los Gigantes', rodzaj: 'klif', lonLat: [-16.836911, 28.240422], promien_km: 3,
      opis: 'Pionowe ściany wysokie na 300–600 m, wyrzeźbione przez morze w najstarszych lawach wyspy, sprzed 6,5–3,5 mln lat. To najważniejsze klify Kanarów.',
      pewnosc: 'srednia', zrodlo: ficha(11, 'Acantilados de Los Gigantes') + '; promień — szacunek',
      wers: 'Los Gigantes: morze wycięło tu ściany wysokie na kilkaset metrów.' }),
    // ficha 9: „Lat. 28,294212°; Long. -16,842691°”; wMasca: „The village lies at an altitude of 650 m in the [[Macizo de Teno]] mountains”
    czesc({ id: 'masca', nazwa: 'Wąwóz i wieś Masca', rodzaj: 'wawoz', lonLat: [-16.842691, 28.294212], promien_km: 2,
      opis: 'Wąwóz w bazaltach Teno, przecięty dajkami i bazaltami słupowymi; wieś leży na 650 m. Szlak schodzi nim aż do morza.',
      pewnosc: 'srednia', zrodlo: ficha(9, 'Masca') + '; Wikipedia (en), „Masca” (wikitext pobrany 2026-11-21); promień — szacunek',
      wers: 'Masca: wąwóz, którym woda przez miliony lat schodziła do morza.' }),
    // wLaguna: „{{coord|28|29|07|N|16|19|00|W|region:ES_type:city|…}}”
    czesc({ id: 'la-laguna', nazwa: 'San Cristóbal de La Laguna', rodzaj: 'miasto', lonLat: [-16.3167, 28.4853], promien_km: 1.5,
      opis: 'Miasto na płaskowyżu między Anagą a grzbietem Dorsal. Historyczne centrum z kolonialną zabudową jest na liście UNESCO od 1999 r.',
      pewnosc: 'srednia', zrodlo: 'Wikipedia (en), „San Cristóbal de La Laguna” — współrzędne i infobox UNESCO (wikitext pobrany 2026-11-21); ' + WLASCICIEL + '; promień świateł — szacunek',
      wers: 'La Laguna: kolonialne miasto na liście UNESCO, między starymi górami a grzbietem Dorsal.' }),
    // ficha 19: „(altura= 158 m, superficie= 0,6 km2, volumen= 0,04 km3)”
    czesc({ id: 'montana-roja', nazwa: 'Montaña Roja', rodzaj: 'stozek', lonLat: [-16.549637, 28.028238], wys_m: 158, promien_km: 0.44,
      opis: 'Stożek z bazaltu oliwinowego w polu wulkanicznym południa: 158 m wysokości, 0,6 km² i 0,04 km³. Otwarty w podkowę, otoczony rezerwatem.',
      pewnosc: 'wysoka', zrodlo: ficha(19, 'Montaña Roja') + '; promień = √(0,6 km²/π) (obliczenie)',
      wers: 'Montaña Roja: czerwony stożek na południowym brzegu.' }),
    // ficha 29: „alineados según una directriz NO-SE de unos 2 km”
    czesc({ id: 'roques-de-garcia', nazwa: 'Roques de García', rodzaj: 'skaly', lonLat: [-16.634439, 28.226671], promien_km: 1,
      opis: 'Pas brekcji, dajek i pitonów o długości ok. 2 km w linii NW–SE. Dzieli kalderę na dwie części o różnicy poziomów ponad 100 m.',
      pewnosc: 'wysoka', zrodlo: ficha(29, 'Roques de García') + '; promień = połowa długości',
      wers: 'Roques de García: kamienny mur w poprzek kaldery.' }),
    // Wikipedia „Roque Cinchado”: „{{coord|28|13|29|N|16|37|54|W|…}}” … „Roque Cinchado is a 27-metre high [[rock pillar]]”
    czesc({ id: 'roque-cinchado', nazwa: 'Roque Cinchado', rodzaj: 'skaly', lonLat: [-16.6317, 28.2247], promien_km: 0.1,
      opis: 'Skalny filar wysoki na 27 m, zbudowany głównie z warstw skał wulkanoklastycznych. Należy do zespołu Roques de García.',
      pewnosc: 'srednia', zrodlo: 'Wikipedia (en), „Roque Cinchado” (wikitext pobrany 2026-11-21)',
      wers: 'Roque Cinchado: dwudziestosiedmiometrowy kamienny słup.' }),
    // ficha 26: „No hay dataciones absolutas para todo el complejo eruptivo excepto una por 14C de hace unos 2020 años”
    czesc({ id: 'montana-blanca', nazwa: 'Montaña Blanca i Montaña Rajada', rodzaj: 'kopula', lonLat: [-16.612756, 28.26789], promien_km: 1,
      opis: 'Fonolitowe kopuły z co najmniej ośmioma fazami erupcji. Ok. 2020 lat temu nastąpiła tu ostatnia erupcja subplinijska Teneryfy; pumeks mógł pokryć całą wyspę.',
      pewnosc: 'srednia', zrodlo: ficha(26, 'Montaña Blanca-Rajada') + '; promień — szacunek (szczelina 1,3 km)',
      wers: 'Montaña Blanca: dwa tysiące lat temu stąd wystrzelił pumeks na całą wyspę.' }),
    // ficha 45: „La erupción del Chinyero de 1909 se desarrolló a lo largo de una fractura de dirección NO-SE de más de 0,5 km de longitud.”
    czesc({ id: 'chinyero', nazwa: 'Chinyero', rodzaj: 'stozek', lonLat: [-16.756923, 28.294625], promien_km: 0.5,
      opis: 'Wulkan ostatniej erupcji na Teneryfie, z listopada 1909 r. Szczelina NW–SE ponad 0,5 km i dwa stożki; lawy aa porwały bloki wysokie na kilka metrów.',
      pewnosc: 'srednia', zrodlo: ficha(45, 'Volcán Chinyero') + '; ' + Z.wHist,
      wers: 'Chinyero: ostatni wulkan, który obudził się na Teneryfie — w 1909 roku.' }),
    // ficha 32: „su actividad se inició el 9 de junio de 1798 y cesó el 15 de septiembre del mismo año.”
    czesc({ id: 'narices-del-teide', nazwa: 'Narices del Teide (Chahorra)', rodzaj: 'szczelina', lonLat: [-16.677862, 28.255141], promien_km: 0.6,
      opis: 'Szczelina na południowo-zachodnim zboczu Pico Viejo, ponad 1 km długości. Erupcja trwała od 9 czerwca do 15 września 1798 r. — najdłużej w historii wyspy.',
      pewnosc: 'wysoka', zrodlo: ficha(32, 'Las Narices del Teide / Chahorra'),
      wers: 'Narices del Teide: „nozdrza Teide” dymiły przez dziewięćdziesiąt dziewięć dni.' }),
    // ficha 47: „Boca Cangrejo se localiza en la dorsal de Bilma a 1.600 m de altitud” … „cuyo recorrido supera los 11 km y casi llegan al mar”
    czesc({ id: 'boca-cangrejo', nazwa: 'Boca Cangrejo', rodzaj: 'stozek', lonLat: [-16.759843, 28.282774], promien_km: 0.5,
      opis: 'Wulkan na grzbiecie Bilma na 1600 m, z lawami płynącymi ponad 11 km. Część badaczy uważa, że to jego ogień widzieli żeglarze Kolumba w 1492 r.; inni temu przeczą.',
      pewnosc: 'niska', zrodlo: ficha(47, 'Volcán Boca Cangrejo'),
      wers: 'Boca Cangrejo: czy to ten ogień widział Kolumb? Historycy się spierają.' }),
    // ficha 25: „constituye el túnel volcánico más grande en Europa”
    czesc({ id: 'cueva-del-viento', nazwa: 'Cueva del Viento', rodzaj: 'tunel-lawowy', lonLat: [-16.704053, 28.352128], promien_km: 1,
      opis: 'Największy tunel lawowy Europy: 17 km korytarzy na kilku poziomach. Powstał w lawach pahoehoe z Pico Viejo sprzed ok. 20 775 lat.',
      pewnosc: 'wysoka', zrodlo: ficha(25, 'Cueva del Viento'),
      wers: 'Cueva del Viento: siedemnaście kilometrów korytarzy, które wydrążyła płynąca lawa.' }),
    // ficha 37: „Lat. 28,344891°; Long. -16,482101°”; ddaArafo: „La erupción de Arafo , iniciada el 2 de febrero de 1705”
    czesc({ id: 'pedro-gil', nazwa: 'Caldera de Pedro Gil (wulkan Arafo)', rodzaj: 'kaldera', lonLat: [-16.482101, 28.344891], promien_km: 1.4,
      opis: 'Niewielka kaldera u szczytu doliny Güímar, resztka stratowulkanu Arafo. Tu w lutym 1705 r. zaczęła się erupcja Arafo.',
      pewnosc: 'srednia', zrodlo: ficha(37, 'Caldera de Pedro Gil') + '; ' + Z.ddaArafo + '; promień — szacunek',
      wers: 'Pedro Gil: tu zaczęła się dolina Güímar i tu w 1705 roku znów popłynęła lawa.' }),
    // ficha 40: „El volcán de Montaña Grande (270 msnm) se localiza en las proximidades del litoral suroccidental del Valle de Güimar”
    czesc({ id: 'malpais-de-guimar', nazwa: 'Malpaís de Güímar', rodzaj: 'pole-lawy', lonLat: [-16.373176, 28.308977], promien_km: 1.5,
      opis: 'Pole lawy wokół wulkanu Montaña Grande (270 m n.p.m.) na wybrzeżu doliny Güímar: lawy pahoehoe i aa, hornitos. Chronione jako rezerwat.',
      pewnosc: 'srednia', zrodlo: ficha(40, 'Malpaís de Güímar') + '; promień — szacunek',
      wers: 'Malpaís de Güímar: „zły kraj”, czyli świeża lawa, na której nic nie chce rosnąć.' }),
    // ficha 4: „Su ubicación está asociada al fondo del Barranco de Igueste a unos 80 metros de altitud”
    czesc({ id: 'igueste-lawy-poduszkowe', nazwa: 'Lawy poduszkowe Igueste de San Andrés', rodzaj: 'odsloniecie', lonLat: [-16.156604, 28.534815], promien_km: 0.3,
      opis: 'Lawy w kształcie poduszek, zastygłe pod wodą, na dnie Barranco de Igueste na ok. 80 m n.p.m. To dowód podmorskiego początku Anagi.',
      pewnosc: 'wysoka', zrodlo: ficha(4, 'Igueste de San Andrés-Pillow Lavas'),
      wers: 'Igueste: lawa zastygła tu pod wodą, zanim wyspa wyszła z oceanu.' }),
    // ficha 14: „basaltos tabulares de hasta 1000 metros de potencia, con coladas de lava que varían desde los pocos centímetros hasta los 4 o 5 m de espesor”
    czesc({ id: 'barranco-del-infierno', nazwa: 'Barranco del Infierno', rodzaj: 'wawoz', lonLat: [-16.722617, 28.125564], promien_km: 1,
      opis: 'Wąwóz w najstarszych lawach tarczy centralnej: bazalty tabularne mają tu do 1000 m miąższości. Pojedyncze wylewy mają od kilku centymetrów do 4–5 m.',
      pewnosc: 'wysoka', zrodlo: ficha(14, 'Barranco del Infierno'),
      wers: 'Barranco del Infierno: kilometr warstw lawy, jedna na drugiej.' }),
    // ficha 50: „Esta erupción se produjo hace uno 990 ± 70 BP y el cono volcánico se localiza en la base del flanco OSO de Pico Viejo, a unos 2.231 m de altitud”
    czesc({ id: 'montana-reventada', nazwa: 'Montaña Reventada', rodzaj: 'stozek', lonLat: [-16.720136, 28.259275], promien_km: 0.6,
      opis: 'Wulkan u podnóża Pico Viejo na ok. 2231 m, wybuchł ok. 990 ± 70 lat temu. Ficha INVOLCAN wymienia tu lawy pahoehoe, tunele i kanały lawowe.',
      pewnosc: 'srednia', zrodlo: ficha(50, 'Lavas Montaña Reventada'),
      wers: 'Montaña Reventada: tysiąc lat temu lawa popłynęła stąd w stronę morza.' }),
    // ficha 36: „se diferencia una capa de piedra pómez central y en la base y el techo dos niveles de lapilli basáltico”
    czesc({ id: 'la-tarta', nazwa: 'La Tarta del Teide', rodzaj: 'odsloniecie', lonLat: [-16.489918, 28.333646], promien_km: 0.2,
      opis: 'Przekrój jak w torcie: warstwa pumeksu fonolitowego między dwiema warstwami bazaltowego lapilli. Dowód, że magma bazaltowa wtargnęła do fonolitowej i wywołała erupcję.',
      pewnosc: 'srednia', zrodlo: ficha(36, 'La Tarta del Teide'),
      wers: 'La Tarta: biały pumeks przełożony czarnym lapilli jak krem w torcie.' }),
    // ficha 3: „Lat. 28,575945°; Long. 16,185627°” — w fichy brak minusa przy długości; poprawione na −16,185627 (zachodnia).
    czesc({ id: 'playa-de-benijo', nazwa: 'Playa de Benijo', rodzaj: 'plaza', lonLat: [-16.185627, 28.575945], promien_km: 0.25,
      opis: 'Plaża z czarnym piaskiem pod łukiem Taganana, najstarszą jednostką Anagi. Jej wiek — ok. 16 mln lat — część badaczy podważa.',
      pewnosc: 'srednia', zrodlo: ficha(3, 'Playa de Benijo') + ' (znak długości poprawiony)',
      wers: 'Benijo: czarny piasek pod najstarszymi skałami Anagi.' }),
    // wRoquesAnaga: „{{coord|28.598|-16.159|…}}” … „Roque de Tierra stands 179 meters above sea level … Roque de Fuera, at 66 meters above sea level”
    czesc({ id: 'roques-de-anaga', nazwa: 'Roques de Anaga', rodzaj: 'skala-morska', lonLat: [-16.159, 28.598], promien_km: 0.5,
      opis: 'Dwie skały w morzu u północnego brzegu Anagi: Roque de Tierra (179 m) i Roque de Fuera (66 m). Wikipedia klasyfikuje je jako czopy wulkaniczne (volcanic plugs).',
      pewnosc: 'srednia', zrodlo: 'Wikipedia (en), „Roques de Anaga” (wikitext pobrany 2026-11-21)',
      wers: 'Roques de Anaga: dwie skały w morzu — zastygłe czopy dawnych wulkanów.' })
  ];

  // ───────────────────────────── FAKTY I MITY ─────────────────────────────
  var mity = [
    // horniman: „The story of the mythical island was created by Greek philosopher Plato”; livescience: „"This could be the origin of the Atlantis legend ," Luis Somoza”
    { id: 'm-atlantyda', teza: 'Teneryfa to szczyt zatopionej Atlantydy.', werdykt: 'legenda',
      wyjasnienie: 'Atlantydę wymyślił Platon. W 2024 r. zespół Luisa Somozy opisał zatopione wyspy na górze podmorskiej koło Kanarów i nazwał je „możliwym źródłem legendy” — to hipoteza, nie dowód. Sama Teneryfa nie zatonęła: od wynurzenia ok. 12 mln lat temu jest nad wodą.',
      pewnosc: 'srednia', zrodlo: Z.horniman + '; ' + Z.livescience + '; ' + Z.ign },
    { id: 'm-kanarki', teza: 'Wyspy Kanaryjskie nazwano od kanarków.', werdykt: 'mit',
      wyjasnienie: 'Odwrotnie: nazwa wysp pochodzi najpewniej od łacińskiego Canariae Insulae, „Wyspy Psów” — może od fok mniszek. Kanarki wzięły nazwę od wysp.',
      pewnosc: 'srednia', zrodlo: Z.wCanarias },
    // nasa: „making it the third tallest volcanic structure on Earth”
    { id: 'm-trzeci-wulkan', teza: 'Teide to trzeci najwyższy wulkan świata, licząc od dna oceanu.', werdykt: 'czesciowo',
      wyjasnienie: 'NASA podaje 7500 m od dna i trzecie miejsce na Ziemi, ale ranking zależy od głębokości dna: z IGN (dno ok. 3000 m) wychodzi ok. 6700 m. Wynik zależy też od tego, jak liczyć wulkany Hawajów.',
      pewnosc: 'srednia', zrodlo: Z.nasa + '; ' + Z.ign + '; ' + Z.wTeide },
    // ficha 28: „la última de ellas es la de Narices del Teide que tuvo lugar en 1798”; wTeide: „The summit of the volcano has a number of small active [[fumarole]]s”
    { id: 'm-wygasly', teza: 'Teide jest wygasły.', werdykt: 'mit',
      wyjasnienie: 'Kompleks Teide–Pico Viejo wybuchł w 1798 r., wyspa — w 1909 r., a na szczycie Teide działają fumarole. Emisja CO₂ z krateru rośnie od 2016 r. — to dane o średniej pewności, opisane osobno.',
      powiazane: ['f-co2-krater'],
      pewnosc: 'wysoka', zrodlo: ficha(28, 'Teide-Pico Viejo') + '; ' + Z.wTeide + '; ' + ficha(45, 'Volcán Chinyero') },
    // IGN: „In Tenerife there are three main rift axes” … „three separate sectors that probably formed three independent islands”
    { id: 'm-jeden-wulkan', teza: 'Wyspa powstała z jednego wulkanu.', werdykt: 'mit',
      wyjasnienie: 'Teneryfę zbudowały trzy stare tarcze (Roque del Conde, Teno, Anaga), gmachy Las Cañadas, kompleks Teide–Pico Viejo i setki wulkanów na trzech osiach ryftowych.',
      pewnosc: 'wysoka', zrodlo: Z.ign + '; ' + Z.wGeol },
    // mitecoHist: „lo llamaban Echeyde, que significa “morada de Guayota, el Maligno”. Según su mitología, Guayota secuestró al dios del Sol, Magec, y lo encerró en el interior del Teide”
    { id: 'm-guayota', teza: 'W Teide uwięziony jest demon Guayota.', werdykt: 'legenda',
      wyjasnienie: 'Guanczowie nazywali Teide Echeyde — „mieszkanie Guayoty, Złego”. Guayota porwał boga Słońca Magec i zamknął go w górze; Achamán uwolnił słońce i zatkał krater skałą — dzisiejszym Pan de Azúcar. MITECO sugeruje, że legenda może pamiętać prawdziwą erupcję.',
      pewnosc: 'srednia', zrodlo: Z.mitecoHist + '; ' + Z.wTeide },
    // wCumbre: „[[East Coast of the United States|eastern seaboard]] of [[North America]] in about six hours, by which time the initial wave will have subsided into a succession of smaller ones” ; „stating that there is no evidence of a mega-tsunami having been generated by volcanic edifice failure.”
    // Ferrer 2011: „three large tsunami deposits have been identified in the islands of Lanzarote, Tenerife and Gran Canaria attributed to mega-landslides” … „The possible run-up of the largest waves of these tsunamis exceeds 50 m height at the Agaete and Teno sites”
    { id: 'm-megatsunami', teza: 'Zawalenie zbocza wyspy kanaryjskiej wywoła megatsunami na całym Atlantyku.', werdykt: 'czesciowo',
      wyjasnienie: 'Model Warda i Daya (2001) dla Cumbre Vieja przewidywał falę docierającą do Ameryki w 6 godzin, ale późniejsze prace go podważyły. Osuwiska Teneryfy naprawdę wywoływały tsunami: Ferrer i in. (2011) opisują ich osady na Lanzarote, Teneryfie i Gran Canarii, z możliwym zasięgiem fal ponad 50 m w Agaete i Teno.',
      pewnosc: 'srednia', zrodlo: Z.wCumbre + '; ' + Z.ferrer2011 + ' (osady tsunami)' },
    // ficha 33: „arena negra, de granulometría fina y de origen volcánico, pero también por bloques y cantos basálticos heterométricos”
    { id: 'm-czarny-piasek', teza: 'Czarny piasek to popiół wulkaniczny.', werdykt: 'czesciowo',
      wyjasnienie: 'Piasek jest wulkaniczny, ale INVOLCAN opisuje go jako drobny piasek z blokami i otoczakami bazaltu u stóp klifów z law — nie jako warstwę popiołu. Że nie powstaje z opadu popiołu, to wniosek z tego opisu, nie wprost ze źródła.',
      pewnosc: 'niska', zrodlo: ficha(33, 'Playa de Bollullo, Los Patos, El Ancón') + '; ' + Z.miteco },
    { id: 'm-kolumb', teza: 'Kolumb widział w 1492 r. erupcję Teide.', werdykt: 'czesciowo',
      wyjasnienie: 'Streszczenie dziennika (Las Casas) mówi o „wielkiej erupcji ognia ze szczytu Teneryfy”. Carracedo i in. przypisują ją wulkanowi Boca Cangrejo, nie Teide; Romero uważa, że Boca Cangrejo to inna erupcja. Teide jako źródło ognia nie jest potwierdzone.',
      pewnosc: 'niska', zrodlo: Z.kolumb + '; ' + ficha(47, 'Volcán Boca Cangrejo') + '; ' + Z.mitecoHist },
    // divulga: „En Izaña, el número medio de días de nieve al año es de once, que pueden tener lugar desde el 15 de octubre al 15 de mayo.”
    { id: 'm-snieg', teza: 'Na Teide śnieg leży tylko zimą.', werdykt: 'czesciowo',
      wyjasnienie: 'Śnieg jest sezonowy, bez wiecznych śniegów: w Izañi średnio 11 dni w roku, ale od 15 października do 15 maja — także jesienią i wiosną.',
      pewnosc: 'srednia', zrodlo: Z.divulga },
    // tw1706: „No one died but the Garachicans knew that 16 people had lost their lives in other parts of Tenerife due to the continuous earthquakes of the previous months.”
    { id: 'm-garachico-zniszczone', teza: 'W 1706 r. lawa całkowicie zniszczyła Garachico.', werdykt: 'czesciowo',
      wyjasnienie: 'Lawa zasypała port i część miasta, ale miasto częściowo ocalało i nikt w nim nie zginął. Erupcja zakończyła jednak złoty okres Garachico: ludność spadła z 1600 do 400.',
      pewnosc: 'srednia', zrodlo: ficha(41, 'Taludes Lávicos Garachico') + ' („destruyeron parcialmente”); ' + Z.wGarachico + ' („The town itself was partially destroyed.”); ' + Z.tw1706 },
    // ficha 28: „Al mismo tiempo estamos ante el punto más alto de España (3718 metros)”
    { id: 'm-najwyzszy', teza: 'Teide to najwyższa góra Hiszpanii.', werdykt: 'fakt',
      wyjasnienie: 'Tak — 3718 m (INVOLCAN, IGN; część źródeł 3715 m) to najwyższy punkt Hiszpanii i najwyższy wulkan Atlantyku.',
      pewnosc: 'wysoka', zrodlo: ficha(28, 'Teide-Pico Viejo') + '; ' + Z.ign + '; ' + Z.wTenerife },
    // ign: „crowned by a crater with fumarolic activity”
    // ign: „Currently, Tenerife is by far the most active island of the archipelago and on average there are about 1000 to 1200 earthquakes a year.”
    { id: 'm-aktywna', teza: 'Teneryfa jest wciąż wulkanicznie aktywna.', werdykt: 'fakt',
      wyjasnienie: 'Tak. IGN nazywa Teneryfę zdecydowanie najaktywniejszą wyspą archipelagu i notuje na niej średnio 1000–1200 trzęsień ziemi rocznie; szczyt Teide wieńczy krater z aktywnością fumaroliczną.',
      powiazane: ['f-sygnaly-2026'],
      pewnosc: 'wysoka', zrodlo: Z.ign },
    // ddaArafo (powiązany nagłówek): „Juan Carlos Carracedo: “Es poco probable una erupción próxima en el Teide, pero no así en las dorsales de Teno o Anaga””
    { id: 'm-wybuchnie-wkrotce', teza: 'Teide wybuchnie lada chwila.', werdykt: 'mit',
      wyjasnienie: 'INVOLCAN szacuje szansę erupcji na wyspie na 1% w roku (39% w 50 lat) i nie widzi powodu do zmiany fazy; według J.C. Carracedo erupcja jest mało prawdopodobna w samym Teide, ale nie na grzbietach Teno i Anagi.',
      pewnosc: 'srednia', zrodlo: Z.rtvc + '; ' + Z.ddaIgn + '; ' + Z.ddaArafo + ' (nagłówek wywiadu z J.C. Carracedo)' }
  ];

  // ───────────────────────────── TORY ANIMACJI ─────────────────────────────
  var tory = {
    // Oś czarnej plamy (legenda mapy IGN: Erupciones históricas / Basaltos), od stożka (ficha 42) do wybrzeża Garachico.
    lawa1706: [[-16.7640, 28.3160], [-16.7647, 28.3253], [-16.7667, 28.3360], [-16.7693, 28.3467], [-16.7687, 28.3560], [-16.7673, 28.3653], [-16.7653, 28.3713], [-16.7633, 28.3740]],
    // Oś doliny Icod (Ferrer 2020, fig. 1) od głowy osuwiska w kalderze ku brzegowi i dalej na N wzdłuż lobu „Icod landslide” (Hunt 2018, fig. 1).
    osuwiskoIcod: [[-16.660, 28.262], [-16.675, 28.300], [-16.700, 28.335], [-16.715, 28.375], [-16.740, 28.460], [-16.770, 28.580], [-16.800, 28.700]]
    // brzeg1706 pominięty: brak źródła z linią brzegu sprzed 1706 (narracja nie mówi o zatoce — spec, akapit Miasto bez budynków).
  };
  var toryZrodla = {
    lawa1706: { pewnosc: 'srednia', zrodlo: Z.ignMapa + ' — wylew „Erupciones históricas” od Montaña Negra do Garachico; start: ' + ficha(42, 'Volcán Garachico') + '; uproszczony do jednej osi (ficha 41 mówi o ok. siedmiu ramionach na klifie)' },
    osuwiskoIcod: { pewnosc: 'niska', zrodlo: Z.ferrer2020 + ' — fig. 1 (obrys doliny Icod); ' + Z.hunt2018 + ' — fig. 1 (lob „Icod landslide from Tenerife”, odczyt przybliżony); kierunek poglądowy' }
  };

  var api = { PEWNOSC: PEWNOSC, WERDYKTY: WERDYKTY, SKALE: SKALE, SKALE_WARSTW: SKALE_WARSTW, fakty: fakty, jednostki: jednostki, warstwy: warstwy, osCzasu: osCzasu,
    erupcje: erupcje, czesci: czesci, mity: mity, dzis: dzis, tory: tory, toryZrodla: toryZrodla };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GeologiaTeneryfa = api;
})(typeof window !== 'undefined' ? window : globalThis);
