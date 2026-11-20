'use strict';
/* Zakładka Myśliwce — dane dziewięciu maszyn (czyste dane, bez DOM/THREE; dual-export jak zjawiska/logika.js).
   Pochodzenie: raport „Myśliwce stealth 2026" (przegląd otwartoźródłowy, stan na 17.09.2026),
   docs/superpowers/zrodla/mysliwce-stealth-2026-raport.txt.
   Zasada: fakty tylko z raportu — nic spoza niego. `opowiesc` to akapity trybu „Opowieść" pocięte
   na wersy napisów (dosłownie, bez parafraz) — zwykle na granicach zdań, wyjątki cięte na myślniku lub
   dwukropku: f-47, su-57, j-36; test wierności pilnuje, że każdy wers występuje w raporcie, a test
   kompletności, że wersy razem nie gubią zdań. Wymiary dl/rozp [m] pochodzą z rysunku zbiorczego raportu (skala 1:1). */
(function (root) {
  var PEWNOSC = ['wysoka', 'srednia', 'niska', 'bardzo-niska'];
  var KRAJE = { USA: { kolor: '--us' }, Rosja: { kolor: '--ru' }, Chiny: { kolor: '--cn' } };

  // Wersy opowieści: id nadawane automatycznie '<maszyna>/opowiesc/<n>' (n od 1).
  function wersy(id, teksty) {
    return teksty.map(function (t, i) { return { id: id + '/opowiesc/' + (i + 1), tekst: t }; });
  }

  var MYSLIWCE = [
    {
      id: 'f-22a', nazwa: 'F-22A Raptor', kraj: 'USA', generacja: 5,
      producent: 'Lockheed Martin / Boeing', rola: 'Przewaga powietrzna', niesfotografowany: false,
      wymiary: { dl: 18.92, rozp: 13.56, opis: '18,92 × 13,56 m' },
      karta: [
        ['Oblot', '1997 (YF-22: 1990)'], ['Służba', '2005'],
        ['Produkcja', 'zamknięta 2011, 195 egz.'], ['Silniki', '2 × P&W F119, ~156 kN, wektorowanie'],
        ['Prędkość', 'Ma 2,25 · supercruise Ma 1,8'], ['Wymiary', '18,92 × 13,56 m'],
      ],
      ktoMa: {
        opis: 'Wyłącznie USA. Nigdy, ani razu, nikomu nie sprzedany.',
        uzytkownicy: [['USA', '184 w inwentarzu'], ['Japonia', 'odmowa'], ['Australia', 'odmowa'], ['Izrael', 'odmowa']],
      },
      stan2026: [
        'Najstarszy stealth w tym zestawieniu i jedyny, którego nie da się już dokupić — linia produkcyjna zniknęła w 2011. W 2026 Raptor przestał być samolotem do wycofania, a stał się pomostem do szóstej generacji.',
        'Emerytura zdjęta ze stołu. Zamiast wycofywania — modernizacja całej floty i mowa o lotach w latach 40. i 50.',
        'USAF planuje na Raptora około 7,8 mld USD do 2030. Retrofit obejmie 142 płatowce, w tym 27 w Gwardii Narodowej.',
        'Nowe zdolności: IRDS (Infrared Defensive System) — wykrywanie odpaleń rakiet w podczerwieni — oraz integracja wciąż niejawnego pocisku AIM-260 JATM.',
        'Raptor ma zostać pierwszym operacyjnym kontrolerem dronów CCA. To czyni z niego poligon dla F-47.',
        '32 ze 184 maszyn to starsze Block 20, praktycznie szkolne. USAF chce je wycofać, Kongres nie pozwala: zakaz obowiązuje do września 2027, Izba głosowała za przedłużeniem do 2032. Doprowadzenie ich do standardu bojowego wyceniono na 3,3 mld USD.',
      ],
      pewnosc: { poziom: 'wysoka', skad: 'Budżety, zapisy ustawowe i raporty GAO są jawne. Dane o sygnaturze radarowej — nie.' },
      opowiesc: wersy('f-22a', [
        'Stoisz przy radarze. Na ekranie jest ptak.',
        'Mały, spokojny punkt, jakich w nocy przelatują setki. Operator nawet nie podnosi głowy.',
        'Ten ptak waży dziewiętnaście ton i ma w środku człowieka.',
        'F-22 nie jest niewidzialny. On jest nieciekawy.',
        'Każdą jego krawędź ustawiono pod takim kątem, żeby fala radaru odbiła się w bok — gdziekolwiek, byle nie z powrotem do nadajnika.',
        'Do operatora wraca echo wielkości szklanej kulki. Komputer uznaje je za śmieć i wymazuje z ekranu.',
        'Zbudowano go 195 razy i nigdy więcej. Fabryki nie ma od 2011 roku.',
        'Nie da się zamówić kolejnego — za żadne pieniądze.',
        'Dlatego Amerykanie ich nie kasują. Oni je remontują, żeby te same płatowce latały jeszcze wtedy, gdy ty będziesz miał wnuki.',
      ]),
      ciekawostki: [
        { tytul: 'Jedyne zestrzelenie w historii tego typu to balon', tekst: '4 lutego 2023 F-22 strącił chiński balon szpiegowski jednym pociskiem AIM-9X, z pułapu 58 000 stóp — balon leciał wyżej od myśliwca. Znak wywoławczy brzmiał „FRANK", na cześć Franka Luke\'a Jr., asa I wojny światowej, który zestrzelił 14 niemieckich balonów obserwacyjnych i przeszedł do historii jako „Arizona Balloon Buster".' },
        { tytul: 'Zakazany na eksport ustawą sprzed ćwierćwiecza', tekst: 'Poprawka Obeya z 1998 roku zabroniła wydawania federalnych pieniędzy na zgodę eksportową dla F-22. Japonia chciała kupić do 50 sztuk i produkować je u siebie na licencji. Australia i Izrael też pytały. Odmówiono wszystkim. Gdy w 2011 zamknięto produkcję, temat umarł definitywnie.' },
        { tytul: 'Nie da się zbudować nowego', tekst: 'Zbudowano 195 sztuk. Oprzyrządowanie produkcyjne rozmontowano po zamknięciu linii — nawet gdyby dziś ktoś wyłożył dowolne pieniądze, nie ma z czego złożyć kolejnego egzemplarza.' },
      ],
    },
    {
      id: 'f-35a', nazwa: 'F-35A', kraj: 'USA', generacja: 5,
      producent: 'Lockheed Martin', rola: 'Wielozadaniowy, trzy warianty A/B/C', niesfotografowany: false,
      wymiary: { dl: 15.7, rozp: 10.7, opis: '15,70 × 10,70 m (wariant A)' },
      karta: [
        ['Oblot', '2006'], ['Służba', '2015 (F-35B, USMC)'],
        ['Dostarczone', '1344 seryjne (Q2 2026)'], ['Silnik', 'P&W F135, ~191 kN'],
        ['Prędkość', 'Ma 1,6 · promień ~1100 km (A)'], ['Wymiary (A)', '15,70 × 10,70 m'],
      ],
      ktoMa: {
        opis: 'Dwanaście państw lata, ponad dwadzieścia zamówiło. 25 krajów uczestniczy w programie.',
        uzytkownicy: [
          ['USA', 'A/B/C, największy użytkownik'], ['Japonia', 'docelowo 105 × A + 42 × B'],
          ['Australia', '72 — komplet od 2024'], ['Norwegia', '52 — komplet od 2025'],
          ['Izrael', '48 z 50 (F-35I Adir)'], ['Wielka Brytania', '41+, wyłącznie wersja B'],
          ['Włochy', 'A i B, montaż w Cameri'], ['Holandia', 'A'], ['Dania', 'A'], ['Belgia', 'A'],
          ['Korea Płd.', 'A'], ['Polska', '3 z 32 „Husarzy"'], ['Kanada', 'zamówione'],
          ['Niemcy', 'zamówione'], ['Finlandia', 'zamówione'], ['Szwajcaria', 'zamówione'],
          ['Grecja', 'zamówione'], ['Czechy', 'zamówione'], ['Rumunia', 'zamówione'], ['Singapur', 'zamówione'],
        ],
      },
      stan2026: [
        'Najlepiej udokumentowany samolot bojowy w historii — nie dlatego, że jest najlepszy, tylko dlatego, że amerykański system kontroli rozlicza go publicznie co roku. Ta sama przejrzystość, która czyni go wiarygodnym punktem odniesienia, sprawia, że jego problemy są widoczne jak w żadnym innym programie.',
        '1344 egzemplarze seryjne dostarczone do końca II kw. 2026 (956 × A, 250 × B, 138 × C). Rekord 2025: 191 sztuk w rok. Tempo utrzymane na 156+ rocznie, w backlogu 416 maszyn.',
        '12 państw użytkuje, ponad 20 operatorów i klientów — największy zachodni program myśliwski w służbie.',
        'TR-3 (Technology Refresh 3), pakiet za 1,9 mld USD, zaczął trafiać do jednostek dopiero w 2026 — około 3 lata po terminie. To on odpowiadał za opóźnienia: wszystkie 110 maszyn z 2024 dostarczono późno, średnio o 238 dni.',
        'Block 4 przycięty. Mniej zdolności niż zakładano, część przesunięta do przyszłego etapu, zakończenie w 2031 — pięć lat po pierwotnym planie, koszt wyższy o ponad 6 mld USD.',
        'Polska: pierwsze trzy F-35A „Husarz" (nr 3509, 3510, 3511) wylądowały w 32. Bazie Lotnictwa Taktycznego w Łasku 22 maja 2026, oficjalne przyjęcie 12 czerwca. Z 32 zamówionych 14 ma być w kraju do końca 2026, kolejnych 12 do końca 2027, całość do 2029. Druga baza: Świdwin.',
      ],
      pewnosc: { poziom: 'wysoka', skad: 'GAO, DOT&E i sprawozdania kwartalne Lockheeda dają twarde liczby produkcyjne i harmonogramowe. Skuteczność bojowa i sygnatura pozostają niejawne.' },
      opowiesc: wersy('f-35a', [
        'Pilot patrzy w dół. Pod nogami ma metalową podłogę.',
        'I mimo to widzi ziemię.',
        'Widzi też, co dzieje się za jego plecami. I nad głową.',
        'I pod skrzydłem, którego nie da się zobaczyć z kabiny.',
        'Sześć kamer wtopionych w kadłub patrzy we wszystkie strony jednocześnie, a obraz z nich trafia prosto na szybkę jego hełmu.',
        'Kadłub przestał zasłaniać. Samolot przestał być czymś, w czym się siedzi — stał się czymś, czym się patrzy.',
        'Ten hełm kosztuje tyle, co mieszkanie. Robi się go osobno dla każdej głowy.',
        'A 22 maja 2026 trzy takie maszyny wylądowały w Łasku pod Łodzią.',
        'Ten sposób patrzenia jest od tego dnia również polski.',
      ]),
      ciekawostki: [
        { tytul: '„Husarz" wygrał w internetowym głosowaniu', tekst: 'Polską nazwę wyłoniono w kwietniu 2024. Zgłoszono prawie 800 propozycji, do finału weszły: Halny, Husarz, Harpia, Duch i — całkiem serio — Dracarys, z „Gry o tron". Wygrał Husarz.' },
        { tytul: 'Pionowe lądowanie napędza wał, nie rakieta', tekst: 'F-35B unosi się dzięki wentylatorowi Rolls-Royce\'a o średnicy 50 cali, ukrytemu za kabiną. Napędza go wał przekazujący do 29 000 KM prosto z głównego silnika. Sam wentylator daje ponad 20 000 funtów ciągu — w dół.' },
        { tytul: 'Rekord, którego nikt nie pobił', tekst: '20 lipca 2001 prototyp X-35B jako jedyny samolot w historii wykonał w jednym locie krótki start, przelot naddźwiękowy i pionowe lądowanie. To przesądziło o wygraniu największego kontraktu zbrojeniowego świata.' },
      ],
    },
    {
      id: 'f-47', nazwa: 'F-47', kraj: 'USA', generacja: 6,
      producent: 'Boeing', rola: 'Przewaga powietrzna + kierowanie dronami', niesfotografowany: true,
      wymiary: { dl: 19, rozp: 13, opis: 'nieujawnione — sylwetka na rysunku (19 × 13 m) to interpretacja grafiki USAF' },
      karta: [
        ['Kontrakt', 'marzec 2025, ponad 20 mld USD'], ['Oblot', 'planowany 2028'],
        ['Plan', '185+ egz., ~300 mln USD/szt.'], ['Silnik', 'NGAP — gotowy dopiero 2031'],
        ['Deklarowane', 'zasięg 1000+ mil, Ma 2+'], ['Wymiary', 'nieujawnione'],
      ],
      ktoMa: {
        opis: 'Nikt. Program amerykański, pierwszy egzemplarz w budowie.',
        uzytkownicy: [['USA', 'plan 185+ sztuk']],
      },
      stan2026: [
        'Program, w którym harmonogram płatowca i harmonogram silnika się rozjechały — i zdecydowano lecieć mimo to. Pierwsze loty odbędą się na napędzie tymczasowym.',
        'Boeing wybrany na początku 2025. Kontrakt EMD ponad 20 mld USD, plan ponad 185 maszyn po około 300 mln USD za sztukę.',
        'Oblot w 2028 nadal aktualny — potwierdzone 27 lipca 2026 przez gen. Dale’a R. White’a. Pierwszy reprezentatywny prototyp jest w budowie.',
        'Docelowy silnik NGAP nie będzie gotowy przed 2031. Pierwsze loty mają zweryfikować płatowiec, sterowanie i oprogramowanie na napędzie zastępczym — przy fazie EMD ściśniętej do 36 miesięcy.',
        'Morski odpowiednik F/A-XX zostaje w tyle za programem sił powietrznych.',
      ],
      pewnosc: { poziom: 'srednia', skad: 'Budżet i harmonogram są jawne, płatowiec nie. Publiczna jest wyłącznie stylizowana grafika USAF — sylwetka obok to jej interpretacja, nie obrys ze zdjęcia. Dlatego narysowano ją linią przerywaną.' },
      opowiesc: wersy('f-47', [
        'Wchodzisz do hali. Stoi w niej samolot, którego nikt na świecie jeszcze nie widział na zdjęciu.',
        'Jest prawie gotowy.',
        'Brakuje mu jednej rzeczy. Serca.',
        'Silnik, pod który go zaprojektowano, będzie gotowy dopiero w 2031 roku.',
        'A oni i tak każą mu polecieć w 2028.',
        'Włożą w środek napęd zastępczy — słabszy, tymczasowy, nie ten właściwy —',
        'tylko po to, żeby sprawdzić, czy skrzydła i komputery robią to, co obiecano na papierze.',
        'To trochę tak, jakbyś uczył się biegać, zanim dostaniesz swoje docelowe nogi.',
        'Nie widziałeś jego fotografii i długo nie zobaczysz.',
        'Wszystko, co ludzkość o nim wie, mieści się w jednym rysunku reklamowym i w cenie: trzysta milionów dolarów za sztukę.',
      ]),
      ciekawostki: [
        { tytul: 'Nazwa honoruje trzy rzeczy naraz — a kolejność jest sporna', tekst: 'Oficjalnie „47" odsyła do myśliwca P-47 Thunderbolt, do roku powstania USAF (1947) i do 47. prezydenta USA. Maile wewnętrzne ujawnione w trybie dostępu do informacji publicznej sugerują, że uzasadnienie historyczne dorobiono po fakcie.' },
        { tytul: 'Oznaczenie F-47 już raz istniało', tekst: 'Gdy w 1947 lotnictwo amerykańskie usamodzielniło się, przemianowano oznaczenia: myśliwiec P-47 Thunderbolt stał się wtedy F-47. Nowa maszyna nie nawiązuje więc do poprzednika — dosłownie przejmuje jego numer.' },
      ],
    },
    {
      id: 'su-57', nazwa: 'Su-57 Felon', kraj: 'Rosja', generacja: 5,
      producent: 'Suchoj / UAC', rola: 'Wielozadaniowy', niesfotografowany: false,
      wymiary: { dl: 20.1, rozp: 14.1, opis: '20,10 × 14,10 m' },
      karta: [
        ['Oblot', '2010 (T-50 / PAK FA)'], ['Służba', 'deklarowana 2020'],
        ['Zbudowane', 'co najmniej 44 (w tym ~10 prototypów)'],
        ['Silniki', '2 × AL-41F1 (izd. 117); AL-51F-1 wciąż wchodzi'],
        ['Radar', 'kompleks N036 Biełka, w tym pasmo L w skrzydłach'], ['Wymiary', '20,10 × 14,10 m'],
      ],
      ktoMa: {
        opis: 'Rosja i jeden klient zagraniczny — pierwszy w historii eksport myśliwca 5. generacji spoza USA.',
        uzytkownicy: [['Rosja', '20–30 w jednostkach'], ['Algieria', '~2 z 14 zamówionych']],
      },
      stan2026: [
        'Jedyny stealth w tym zestawieniu z realnym nalotem bojowym — i jednocześnie ten, którego użycie najdobitniej pokazuje, jak mało mu się ufa. Prawie cała działalność nad Ukrainą to odpalenia stand-off z własnej przestrzeni powietrznej.',
        '44 płatowce zbudowane do 2026, z czego około 10 to prototypy. W jednostkach szacunkowo 20–30 maszyn. W 2025 dostarczono niewiele albo nic.',
        'Zamówienie opiewa na 76 egzemplarzy do 2027/28 — termin realnie nie do utrzymania przy tym tempie.',
        'Su-57M1 z docelowym silnikiem AL-51F-1 i płaską dyszą wektorowania obniżającą sygnaturę ma wejść do służby przed końcem 2026. To deklaracja, nie fakt dokonany.',
        'Eksport: Algieria jedynym potwierdzonym klientem — 14 sztuk, z czego około 2 dostarczone na początek 2026.',
        'Bojowo nad Ukrainą od 2022. 23 sierpnia dwa Su-57 uczestniczyły w uderzeniu na Odessę. Zero potwierdzonych zestrzeleń i zero potwierdzonych strat w walce powietrznej.',
        'Straty poza walką powietrzną: uszkodzony na ziemi w Achtubinsku 9 czerwca 2024 (pierwsze potwierdzenie satelitarne), dwa uszkodzone dronami w Szagole w kwietniu 2026, jeden utracony pod Moskwą 23 lipca 2026 — resort obrony mówi o awarii technicznej, strona ukraińska o ogniu własnej obrony powietrznej.',
      ],
      pewnosc: { poziom: 'srednia', skad: 'Liczby produkcyjne pochodzą z OSINT i zdjęć satelitarnych — są szacunkiem z widełkami. Osiągi znamy wyłącznie z deklaracji producenta i nic ich nie potwierdza.' },
      opowiesc: wersy('su-57', [
        'Wyobraź sobie samolot zbudowany po to, żeby wejść tam, gdzie nikt inny nie da rady wejść.',
        'A teraz wyobraź sobie, że on tam nie wchodzi.',
        'Su-57 lata nad Ukrainą od 2022 roku i prawie zawsze robi to samo:',
        'zostaje po swojej stronie granicy, wypuszcza pocisk z bezpiecznej odległości i zawraca do domu.',
        'Ani razu nie stoczył pojedynku w powietrzu.',
        'Nikogo nie zestrzelił. Nikt nie zestrzelił jego — w powietrzu.',
        'Za to kilka sztuk uszkodzono albo stracono inaczej: na ziemi, na lotnisku, w drodze.',
        'Ostatni spadł pod Moskwą w lipcu 2026 i do dziś nie wiadomo, kto go strącił.',
        'Zbudowano ich czterdzieści cztery przez szesnaście lat.',
        'Amerykanie w samym 2025 roku wypuścili sto dziewięćdziesiąt jeden F-35.',
      ]),
      ciekawostki: [
        { tytul: 'Dostał na własnym lotnisku', tekst: '9 czerwca 2024 ukraiński atak uszkodził Su-57 stojącego w Achtubinsku. To było pierwsze potwierdzone satelitarnie uszkodzenie rosyjskiego stealtha — samolot zbudowany po to, by go nie znaleziono, znaleziono na płycie postojowej.' },
        { tytul: 'Pierwszy eksportowy stealth spoza Ameryki', tekst: 'Algieria, zamawiając 14 sztuk, przełamała monopol, który USA trzymały przez całą epokę myśliwców 5. generacji. Dostawy idą jednak w tempie pojedynczych maszyn rocznie.' },
        { tytul: 'Radar w krawędziach skrzydeł — celowo przeciw stealth', tekst: 'Kompleks N036 ma anteny nie tylko w dziobie. W krawędziach natarcia skrzydeł siedzą anteny pasma L, dobrane tak, żeby wykrywać samoloty, których kształt optymalizowano przeciw zupełnie innym częstotliwościom.' },
      ],
    },
    {
      id: 'su-75', nazwa: 'Su-75 Checkmate', kraj: 'Rosja', generacja: 5,
      producent: 'Suchoj', rola: 'Lekki myśliwiec eksportowy', niesfotografowany: true,
      wymiary: { dl: 17.8, rozp: 11.8, opis: '~17,8 × ~11,8 m (deklarowane)' },
      karta: [
        ['Debiut', 'makieta, MAKS 2021'], ['Oblot', 'zapowiadany 2026'],
        ['Zbudowane', '0 latających'], ['Silnik', 'jeden, typ niepotwierdzony'],
        ['Warianty', 'jedno-, dwumiejscowy, bezzałogowy'], ['Wymiary', '~17,8 × ~11,8 m (deklarowane)'],
      ],
      ktoMa: {
        opis: 'Nikt. Pięć lat po premierze zero zamówień.',
        uzytkownicy: [['—', 'brak klientów']],
      },
      stan2026: [
        'Pięć lat od premiery makiety wciąż nie wzniósł się w powietrze. Termin oblotu przesuwano z 2023 na 2024, potem 2025, teraz 2026.',
        'Program wszedł w budowę prototypu w zakładach KnAAZ w Komsomolsku nad Amurem: dwa egzemplarze — jeden do prób statycznych, jeden do prób w locie.',
        'Oblot zapowiedziany na 2026 przez Siergieja Bogdana, głównego pilota doświadczalnego Suchoja.',
        'Proponowane trzy wersje: jednomiejscowa, dwumiejscowa i bezzałogowa.',
        'Zero lotów, zero potwierdzonych zamówień. Program jest wrażliwy na niestabilność finansowania i priorytety produkcyjne rosyjskiego lotnictwa.',
      ],
      pewnosc: { poziom: 'niska', skad: 'Wszystko pochodzi z komunikatów producenta i materiałów targowych. Sylwetka obok opiera się na makiecie, nie na latającym egzemplarzu — stąd linia przerywana.' },
      opowiesc: wersy('su-75', [
        'Idziesz przez halę wystawową. Pod reflektorami stoi myśliwiec.',
        'Ludzie robią zdjęcia, dziennikarze piszą, że oto przyszłość.',
        'Był rok 2021.',
        'On nigdy nie wzniósł się w powietrze.',
        'To była atrapa — pełnowymiarowy model bez wnętrza, zrobiony po to, żeby go pokazać.',
        'Prawdziwy egzemplarz obiecywano na 2023 rok. Potem na 2024.',
        'Potem na 2025. Dziś mówi się o 2026.',
        'W fabryce nad rzeką Amur rzeczywiście coś powstaje: dwa kadłuby.',
        'Jeden do łamania na ziemi, drugi do latania.',
        'Minęło pięć lat od tamtego reflektora i nikt na całym świecie nie zamówił ani jednej sztuki.',
      ]),
      ciekawostki: [
        { tytul: 'Teaser z pilotami z krajów, które nic nie kupiły', tekst: 'Przed premierą w 2021 puszczono filmik, w którym piloci z Indii, Argentyny, Wietnamu i Zjednoczonych Emiratów podnoszą wzrok ku niebu. Żaden z tych krajów nie zamówił ani jednej sztuki.' },
        { tytul: 'Nazwa znaczy „szach-mat"', tekst: 'Tyle że partia jeszcze się nie zaczęła: pięć lat po odsłonięciu makiety samolot nie wzniósł się w powietrze.' },
        { tytul: 'Trzy wersje z jednego płatowca', tekst: 'Zapowiedziano wariant jednomiejscowy, dwumiejscowy i całkowicie bezzałogowy — wszystkie na tej samej konstrukcji.' },
      ],
    },
    {
      id: 'j-20a', nazwa: 'J-20A Mighty Dragon', kraj: 'Chiny', generacja: 5,
      producent: 'Chengdu (CAC)', rola: 'Przewaga powietrzna dalekiego zasięgu', niesfotografowany: false,
      wymiary: { dl: 21.2, rozp: 13, opis: '~21,2 × ~13,0 m' },
      karta: [
        ['Oblot', '2011'], ['Służba', '2017'], ['W służbie', 'ponad 300 (jesień 2025)'],
        ['Silniki', 'WS-15 (~180 kN) w nowych egz.; wcześniej WS-10C / AL-31F'],
        ['Uzbrojenie', 'PL-15 (200+ km), PL-17, PL-10'], ['Wymiary', '~21,2 × ~13,0 m'],
      ],
      ktoMa: {
        opis: 'Wyłącznie Chiny. Nigdy nie oferowany na eksport.',
        uzytkownicy: [['Chiny', 'ponad 300 w służbie']],
      },
      stan2026: [
        'Najliczniejszy niezachodni myśliwiec 5. generacji. Chiny odwróciły zachodnią kolejność: najpierw zbudowały masę na silnikach zastępczych, docelową jednostkę napędową dopracowały piętnaście lat później.',
        'Ponad 300 maszyn w służbie jesienią 2025 — więcej niż cała flota F-22.',
        'W styczniu 2026 sfotografowano J-20A w fabrycznym gruncie z dyszami WS-15. To silnik, nad którym Chiny pracowały około piętnastu lat; ~180 kN ciągu czyni supercruise realnym po raz pierwszy w tym programie.',
        'Wersja dwumiejscowa J-20S — pierwszy dwumiejscowy samolot stealth na świecie. Typowane zadanie: kierowanie dronami-skrzydłowymi.',
        'Szacunki zdolności produkcyjnych CAC sięgają około 100 egzemplarzy rocznie; prognozy mówią o 800 maszynach do 2030 — to prognoza, nie fakt.',
      ],
      pewnosc: { poziom: 'srednia', skad: 'Liczebność i warianty rekonstruowane z OSINT, defilad i zdjęć spotterskich. Osiągi niemal wyłącznie szacowane; Chiny nie publikują danych technicznych.' },
      opowiesc: wersy('j-20a', [
        'Patrzysz w niebo nad Chinami. Przelatuje klucz myśliwców — długich, kanciastych, z dodatkową parą małych skrzydełek z przodu.',
        'Wyglądają jak z filmu, który jeszcze nie powstał.',
        'Przez piętnaście lat ich największy sekret siedział w środku: miały cudzy silnik.',
        'Chiny umiały zbudować samolot, ale nie umiały zbudować dla niego serca.',
        'Więc zrobiły rzecz, na którą Zachód by się nie odważył. Zbudowały trzysta sztuk mimo to.',
        'Na silnikach zastępczych. Wiedząc, że są za słabe.',
        'Dopiero w 2026 roku wjechał do nich własny, docelowy silnik.',
        'Czyli: najpierw postawili całą armię, a dopiero potem ją dokończyli.',
        'I ta niedokończona armia jest dziś liczniejsza niż wszystkie amerykańskie F-22 razem wzięte.',
      ]),
      ciekawostki: [
        { tytul: 'Jedyny stealth świata z kaczkami', tekst: 'Przednie stateczniki uchodziły na Zachodzie za sprzeczne z niewidzialnością — każda ruchoma powierzchnia to dodatkowe odbicie. Chińczycy uznali, że zwrotność i nośność są warte tej ceny. Nikt inny tak nie zrobił.' },
        { tytul: 'Pierwszy dwumiejscowy stealth w historii', tekst: 'Wersja J-20S ma drugą kabinę. Powszechnie przyjmuje się, że siedzi w niej operator dronów-skrzydłowych — czyli że ten samolot ma dowodzić maszynami bez pilota.' },
        { tytul: 'Piętnaście lat na cudzym sercu', tekst: 'Od oblotu w 2011 do 2026 J-20 latał na silnikach, które nie były dla niego przeznaczone — najpierw rosyjskich, potem przejściowych chińskich. Docelowy WS-15 wszedł seryjnie dopiero w tym roku.' },
      ],
    },
    {
      id: 'j-35a', nazwa: 'J-35A', kraj: 'Chiny', generacja: 5,
      producent: 'Shenyang (SAC)', rola: 'Wielozadaniowy, lądowy i pokładowy', niesfotografowany: false,
      wymiary: { dl: 17.3, rozp: 11.5, opis: '~17,3 × ~11,5 m' },
      karta: [
        ['Oblot', '2012 (demonstrator FC-31)'], ['Premiera J-35A', 'Zhuhai, listopad 2024'],
        ['W służbie', '30–57 (raporty rozbieżne)'],
        ['Warianty', 'pokładowy · J-35A lądowy · J-35AE eksportowy'],
        ['Lotniskowiec', 'Fujian, katapulta elektromagnetyczna'], ['Wymiary', '~17,3 × ~11,5 m'],
      ],
      ktoMa: {
        opis: 'Chiny, a wkrótce prawdopodobnie pierwszy zagraniczny nabywca chińskiego stealtha.',
        uzytkownicy: [['Chiny', 'lotnictwo + marynarka'], ['Pakistan', 'umowa wstępna, ~40 szt. (J-35AE)']],
      },
      stan2026: [
        'Chiński odpowiednik F-35 w roli, nie w konstrukcji — dwusilnikowy, budowany od razu w trzech wersjach naraz. Kandydat na pierwszy eksportowy myśliwiec 5. generacji spoza USA.',
        'Do czerwca 2026 w inwentarzu co najmniej 30 seryjnych płatowców; inne zestawienia mówiły o ponad 57 obserwowanych już pod koniec 2025. Rozbieżności nie da się dziś rozstrzygnąć — obie liczby krążą w obiegu.',
        'Trzy warianty schodzą z linii równolegle: pokładowy, lądowy J-35A i eksportowy J-35AE.',
        'Lotniskowiec Fujian: we wrześniu 2025 J-35 startowały z katapulty elektromagnetycznej; 2026 to rok prób adaptacyjnych w skali całego zespołu.',
        'Pakistan: podpisana wstępna umowa o współpracy, mowa o około 40 maszynach. W maju 2026 wyjechał J-35AE numer 001 — z logo AVIC, nie PLAAF.',
        'Równolegle pojawiło się doniesienie, że Pekin przesunął dostawy o cztery lata. Oba stoją obok siebie i żadnego nie potwierdzono urzędowo.',
      ],
      pewnosc: { poziom: 'niska', skad: 'Najsłabiej udokumentowana z maszyn seryjnych w tym zestawieniu. Dużo doniesień prasowych o sprzecznych liczbach, mało materiału weryfikowalnego.' },
      opowiesc: wersy('j-35a', [
        'Stoisz na pokładzie lotniskowca. W metalowej podłodze przed tobą biegnie szyna.',
        'Nie ma pary. Nie ma buchającego kotła, nie ma syku.',
        'Jest prąd.',
        'Samolot rusza z miejsca i po dwóch sekundach nie ma go już nad pokładem.',
        'Elektromagnes cisnął nim jak kamieniem z procy — z zera do prędkości autostradowej razy trzy, w czasie krótszym niż twoje westchnienie.',
        'Ta maszyna to J-35. Chiny robią ją w trzech wersjach naraz: na lotniskowiec, na zwykłe lotnisko i na sprzedaż.',
        'Na sprzedaż. To jest ta część, która zmienia świat.',
        'Przez trzydzieści lat myśliwiec niewidzialny dla radaru można było kupić tylko w jednym miejscu na Ziemi.',
        'Właśnie otworzyło się drugie, a pierwszy w kolejce stoi Pakistan.',
      ]),
      ciekawostki: [
        { tytul: 'Zaczął się jako projekt prywatny', tekst: 'Poprzednik J-35, demonstrator FC-31, powstał z inicjatywy samych zakładów Shenyang — nie na zamówienie wojska. Dopiero później program znalazł państwowego odbiorcę.' },
        { tytul: 'Trzy wersje schodzą z linii równolegle', tekst: 'Pokładowa na lotniskowiec, lądowa J-35A dla lotnictwa i eksportowa J-35AE — produkowane jednocześnie, nie po kolei.' },
        { tytul: 'Może złamać trzydziestoletni monopol', tekst: 'Jeśli umowa z Pakistanem dojdzie do skutku, będzie to pierwszy myśliwiec 5. generacji sprzedany za granicę przez kraj inny niż Stany Zjednoczone. W maju 2026 wyjechał egzemplarz z numerem 001 i logo AVIC zamiast oznaczeń chińskiego lotnictwa.' },
      ],
    },
    {
      id: 'j-36', nazwa: 'J-36', kraj: 'Chiny', generacja: 6,
      producent: 'Chengdu', rola: 'Ciężki, bezogonowy, dalekiego zasięgu', niesfotografowany: false,
      wymiary: { dl: 22.5, rozp: 20, opis: 'długość ~22,5 m (szacunek) · rozpiętość 19–24 m zależnie od metody pomiaru (na rysunku 20 m)' },
      karta: [
        ['Oblot', '26 grudnia 2024, nad Chengdu'], ['Układ', 'bezogonowy, podwójna delta, 3 silniki'],
        ['Wloty', '2 boczne typu caret + 1 grzbietowy'], ['Długość', '~22,5 m (szacunek)'],
        ['Rozpiętość', '19–24 m zależnie od metody pomiaru'], ['Masa startowa', '50–55 t i więcej (szacunek)'],
      ],
      ktoMa: {
        opis: 'Chiny, faza prób. Maszyna nie weszła do służby w żadnym kraju.',
        uzytkownicy: [['Chiny', '~5 płatowców testowych']],
      },
      stan2026: [
        'Pierwszy latający demonstrator 6. generacji na świecie — o rok wcześniej niż jakikolwiek zachodni odpowiednik. Trzy silniki to najprawdopodobniej nie ekstrawagancja, tylko obejście: chińskie jednostki wciąż ustępują ciągiem, a płatowiec tej masy trzeba czymś rozpędzić.',
        'Od końca 2025 program wszedł w intensywną fazę prób — loty regularne, nie pojedyncze i rozstawione jak w początkach programu eksperymentalnego.',
        '28 czerwca 2026 Armia Ludowo-Wyzwoleńcza opublikowała pierwszy oficjalny materiał filmowy, po około 18 miesiącach wyłącznie nieoficjalnych zdjęć i nagrań.',
        'Zdjęcia z lipca 2026 sugerują piąty odrębny płatowiec i trzecią większą konfigurację. Od grudnia 2024 zmieniono wloty powietrza, układ dysz i podwozie — tempo iteracji bez precedensu.',
        'Pokazano manewr na dużym kącie natarcia. Na bezogonowej maszynie o masie ponad 50 t to nieoczywiste osiągnięcie sterowania.',
        'Rozbieżność pomiarów jest metodologiczna: zdjęcia satelitarne dają ~20 m rozpiętości, fotogrametria naziemna ~23 m długości przy 19 m rozpiętości, inne zestawienie 22,5 × 24 m.',
      ],
      pewnosc: { poziom: 'bardzo-niska', skad: 'Chiny nie opublikowały żadnych danych technicznych. Wszystkie wymiary to fotogrametria zdjęć obserwatorów i pomiary z orbity. Sylwetka obok jest rekonstrukcją z fotografii, nie rysunkiem technicznym.' },
      opowiesc: wersy('j-36', [
        'Grudzień 2024, chińskie miasto. Ktoś stoi na parkingu i podnosi telefon do góry.',
        'Nagranie trwa kilkanaście sekund i jest rozmazane. Widać coś ogromnego i płaskiego.',
        'Bez ogona. Kształt jak grot strzały.',
        'Tak świat dowiedział się o J-36. Nie z konferencji prasowej.',
        'Nie z parady. Z filmiku przechodnia.',
        'Ta maszyna ma ponad dwadzieścia dwa metry długości i waży tyle, co pięćdziesiąt samochodów osobowych.',
        'Ma trzy silniki — bo dwa nie dałyby rady jej unieść.',
        'Nikt nie podał jej wymiarów.',
        'Wszystko, co o niej wiadomo, wyliczono z cieni i perspektywy na zdjęciach, tak jak archeolog odtwarza wzrost człowieka z jednej kości.',
        'I to jest w tej historii najdziwniejsze: pierwszy myśliwiec nowej generacji wzniósł się w powietrze nie nad Ameryką —',
        'a dowiedzieliśmy się o tym od kogoś, kto akurat przechodził obok.',
      ]),
      ciekawostki: [
        { tytul: 'Trzy silniki w myśliwcu to ewenement', tekst: 'Dwa wloty siedzą po bokach, trzeci na grzbiecie. Najprostsze wyjaśnienie nie jest efektowne: chińskie silniki wciąż ustępują ciągiem, a płatowca ważącego ponad 50 ton nie da się rozpędzić dwoma.' },
        { tytul: 'Poleciał w rocznicę urodzin Mao Zedonga', tekst: 'Oblot wypadł 26 grudnia 2024 — Mao urodził się 26 grudnia 1893. Zbieg dat od razu zauważono; czy był zamierzony, nie wiadomo i zapewne nigdy się nie dowiemy.' },
        { tytul: 'Wymiary wyliczone z cieni', tekst: 'Chiny nie podały żadnych danych. Zdjęcia satelitarne dają ~20 m rozpiętości, fotogrametria naziemna 19 m, jeszcze inne zestawienie 24 m. Rozrzut wynosi 5 metrów — tyle, ile mierzy połowa skrzydła F-16.' },
      ],
    },
    {
      id: 'j-50', nazwa: 'J-50', kraj: 'Chiny', generacja: 6,
      producent: 'Shenyang', rola: 'Bezogonowy, wiązany z zadaniami pokładowymi', niesfotografowany: false,
      wymiary: { dl: 18, rozp: 14, opis: '~18 × ~14 m (szacunek bardzo zgrubny)' },
      karta: [
        ['Oblot', 'grudzień 2024'], ['Układ', 'bezogonowy, 2 silniki, skrzydło lambda'],
        ['Sterowanie', 'ruchome końcówki skrzydeł'], ['Wymiary', '~18 × ~14 m (szacunek bardzo zgrubny)'],
        ['Oznaczenie', 'nazwa obserwatorów, nie urzędowa'], ['Materiał', 'wyłącznie nieoficjalny'],
      ],
      ktoMa: {
        opis: 'Chiny, faza prób. Program niepotwierdzony oficjalnie.',
        uzytkownicy: [['Chiny', '~2 płatowce testowe']],
      },
      stan2026: [
        'Mniej znany z chińskiej pary szóstej generacji. Oblatany w tym samym okresie co J-36, ale z materiałem o rząd wielkości uboższym — nawet nazwa jest umowna.',
        'Świeże materiały z 2026 z obiektów powiązanych z Shenyang Aircraft Corporation potwierdzają kontynuację prób w locie.',
        'Bezogonowy, dwusilnikowy, ze skrzydłem typu lambda i ruchomymi końcówkami zamiast usterzenia. Mniejszy od J-36 i wiązany częściowo z zadaniami pokładowymi.',
        'Razem z J-36 składa się na deklarowany zamiar wystawienia operacyjnej maszyny 6. generacji przed 2030.',
        'Żaden oficjalny przekaz dotąd go nie objął — w przeciwieństwie do J-36, który doczekał się materiału PLA w czerwcu 2026.',
      ],
      pewnosc: { poziom: 'bardzo-niska', skad: 'Najmniej wiarygodna pozycja w zestawieniu. Nawet oznaczenie „J-50" pochodzi od obserwatorów. Każda liczba obok jest szacunkiem szacunku.' },
      opowiesc: wersy('j-50', [
        'Tego samego grudnia poleciał jeszcze jeden.',
        'Mniejszy. I cichszy — w każdym sensie, bo prawie nikt o nim nie mówił.',
        'Nie ma ogona. Ma dwa silniki.',
        'Skręca samymi końcówkami skrzydeł, bo nie ma czym innym. Prawdopodobnie ma kiedyś siadać na lotniskowcu.',
        '„Prawdopodobnie" — bo o tej maszynie nie wiadomo prawie nic.',
        'Nikt nie podał jej wymiarów. Nikt nie potwierdził, do czego służy.',
        'Nikt oficjalnie nie przyznał, że istnieje.',
        'Nawet nazwa „J-50" nie jest prawdziwa.',
        'Wymyślili ją ludzie z internetu, którzy oglądali rozmazane zdjęcia — bo trzeba go było jakoś nazywać.',
        'Gdzieś nad Chinami lata w tej chwili samolot, który nie ma imienia.',
      ]),
      ciekawostki: [
        { tytul: 'Nie ma oficjalnej nazwy', tekst: '„J-50" wymyślili obserwatorzy oglądający rozmazane zdjęcia. W obiegu funkcjonuje też oznaczenie J-XDS. Żadne z nich nie pochodzi od chińskiego wojska, które nigdy nie potwierdziło, że ten samolot istnieje.' },
        { tytul: 'Skręca końcówkami skrzydeł', tekst: 'Nie ma usterzenia w ogóle, więc sterowanie kierunkiem przejmują ruchome końcówki skrzydeł. To rozwiązanie znane z bombowców stealth — nie z myśliwców.' },
        { tytul: 'Dwa programy 6. generacji w odstępie dni', tekst: 'J-50 i J-36 oblatano w tym samym miesiącu, przez dwa konkurujące biura konstrukcyjne. Żaden inny kraj nie prowadzi dziś równolegle dwóch programów tej klasy.' },
      ],
    },
  ];

  function mysliwiec(id) {
    for (var i = 0; i < MYSLIWCE.length; i++) if (MYSLIWCE[i].id === id) return MYSLIWCE[i];
    return null;
  }

  var api = { PEWNOSC: PEWNOSC, KRAJE: KRAJE, MYSLIWCE: MYSLIWCE, mysliwiec: mysliwiec };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MysliwceDane = api;
})(typeof window !== 'undefined' ? window : globalThis);
