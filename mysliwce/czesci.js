'use strict';
/* Zakładka Myśliwce — klikalne części makiet dziewięciu maszyn (czyste dane, bez DOM/THREE; dual-export jak dane.js).
   Opisy części to wiedza publiczna SPOZA raportu, dlatego każda część ma `pewnosc` (skala z dane.js) i `zrodlo`
   (konkretny materiał: tytuł + wydawca + data/sekcja). Liczby raportu „Myśliwce stealth 2026” (stan na 17.09.2026)
   wygrywają z innymi źródłami — opisy ich nie przeczą. Zasady pewności: f-47, j-36, j-50 nigdy powyżej „srednia”;
   to, co wynika tylko ze zdjęć i obserwacji, a nie z danych urzędowych — „niska” albo „bardzo-niska”.
   `wers` = napis do ujęcia pokazu przy zbliżeniu na część (głos trybu „Opowieść”: druga osoba, obraz → sekret).
   Jedna część na rodzaj w maszynie: platowiec.js i makieta.js kluczują części po rodzaju. */
(function (root) {
  var D = (typeof module !== 'undefined' && module.exports) ? require('./dane.js') : root.MysliwceDane;
  var PEWNOSC = D.PEWNOSC;

  var RODZAJE = ['nos', 'kabina', 'wloty', 'skrzydla', 'usterzenie', 'kaczka', 'levcon', 'dysze', 'komory', 'sensory', 'podwozie', 'kadlub'];
  var WYMAGANE = ['nos', 'kabina', 'wloty', 'skrzydla', 'dysze', 'komory', 'podwozie', 'kadlub'];

  // Źródła powtarzane w wielu częściach (stan stron Wikipedii: listopad 2026).
  var RAPORT = 'Raport „Myśliwce stealth 2026”, przegląd otwartoźródłowy, stan na 17.09.2026';
  var W_F22 = 'Wikipedia (en): Lockheed Martin F-22 Raptor, sekcja Design, stan 11.2026';
  var DSIAC_OWIEWKI = 'DSIAC (DTIC), Technical Inquiry: „Aircraft Transparency Construction Materials and Applications”, dsiac.dtic.mil, stan 11.2026';
  var W_F35 = 'Wikipedia (en): Lockheed Martin F-35 Lightning II, sekcja Design, stan 11.2026';
  var GRAF_F47 = 'U.S. Air Force, grafika F-47 (DVIDS), 21.03.2025';
  var ASF_F47 = 'Air & Space Forces Magazine, J. A. Tirpak: „NGAD Images Doctored to Hide Most, If Not All, True Design Features”, 18.04.2025';
  var TWZ_F47 = 'The War Zone, T. Rogoway: „What The F-47’s Canards Say About The Rest Of Its Design”, 24.03.2025';
  var W_SU57 = 'Wikipedia (en): Sukhoi Su-57, sekcja Design, stan 11.2026';
  var W_SU75 = 'Wikipedia (en): Sukhoi Su-75 Checkmate, sekcja Design, stan 11.2026';
  var AIN_SU75 = 'AIN Online: „New Sukhoi Fighter Design Unveiled at MAKS”, 20.07.2021';
  var W_J20 = 'Wikipedia (en): Chengdu J-20, sekcja Design, stan 11.2026';
  var W_J35 = 'Wikipedia (en): Shenyang J-35, sekcja Design, stan 11.2026';
  var ASPI_J36 = 'ASPI The Strategist, B. Sweetman: „China’s big new combat aircraft: a technical assessment”, 31.12.2024';
  var TWZ_J36 = 'The War Zone, J. Trevithick: „China’s Recent J-36 Heavy Stealth Tactical Jet Testing Offers New Insights Into Its Evolving Design”, 23.09.2026';
  var TWZ_J36_KOMORY = 'The War Zone: „This Could Be Our Best View Yet Of China’s J-36 Very Heavy Stealth Tactical Jet”, marzec 2025';
  var AVI_J36_2 = 'The Aviationist: artykuł o drugim prototypie J-36, 28.10.2025';
  var TWZ_J50 = 'The War Zone, T. Newdick: „China’s Mysterious Tailless Stealth Fighter Has Swiveling Wingtips”, 27.01.2025';
  var AVI_J50 = 'The Aviationist, S. D’Urso: „New Images Give Clearest Look at Shenyang’s New Fighter”, 04.04.2025';
  var BD_J50 = 'Breaking Defense, M. Yeo: „Photos of China’s tailless J-50 aircraft give hints about stealth profile, likely mission: Experts”, 03.10.2025';

  // Id nadawane automatycznie: część '<maszyna>/<rodzaj>', wers '<maszyna>/czesc/<rodzaj>'.
  function czesci(maszyna, lista) {
    return lista.map(function (c) {
      return {
        id: maszyna + '/' + c.rodzaj, rodzaj: c.rodzaj, nazwa: c.nazwa, opis: c.opis,
        pewnosc: c.pewnosc, zrodlo: c.zrodlo, wers: { id: maszyna + '/czesc/' + c.rodzaj, tekst: c.wers },
      };
    });
  }

  var CZESCI = {
    'f-22a': czesci('f-22a', [
      { rodzaj: 'nos', nazwa: 'Nos i radar AN/APG-77', pewnosc: 'wysoka', zrodlo: W_F22 + ' (Avionics)',
        opis: 'W nosie pracuje radar AN/APG-77 z anteną aktywnie skanowaną elektronicznie (AESA), bez ruchomej czaszy. Antenę pochylono tak, żeby nie odbijała fali obcego radaru wprost do nadajnika. Zasięgi wykrywania pozostają niejawne.',
        wers: 'Patrzysz w gładki, szary nos. Za nim radar przeczesuje niebo tak cicho, że cel nie wie, że ktoś go ogląda.' },
      { rodzaj: 'kabina', nazwa: 'Owiewka z jednego kawałka', pewnosc: 'srednia', zrodlo: DSIAC_OWIEWKI + '; ' + W_F22 + ' (Cockpit)',
        opis: 'Kabinę przykrywa jednoczęściowa owiewka bez ramy z przodu. Szkło pokrywa cienka warstwa przewodząca, która nadaje mu złocisty odcień; najczęściej podaje się tlenek indu i cyny albo złoto, a dokładny skład jest niejawny. Powłoka nie wpuszcza fali radaru do wnętrza, gdzie hełm i fotel odbijałyby ją jak lustro.',
        wers: 'Szyba nad głową pilota lśni złotem. To nie ozdoba — cienka warstwa metalu nie wpuszcza radaru do środka.' },
      { rodzaj: 'wloty', nazwa: 'Wloty typu caret', pewnosc: 'srednia', zrodlo: W_F22 + ' (Overview, Stealth)',
        opis: 'Dwa wloty po bokach kabiny mają skośnie ścięte krawędzie (typ caret), równoległe do krawędzi skrzydeł. Kanały za nimi wyginają się, żeby z przodu nie było widać łopatek sprężarki — jednego z najjaśniejszych źródeł odbicia radarowego. Raptor nie ma wlotu bez przegrody (DSI) jak F-35.',
        wers: 'Zaglądasz we wlot i nie widzisz silnika. Kanał zakręca, bo łopatki sprężarki odbijałyby radar jak reflektor.' },
      { rodzaj: 'skrzydla', nazwa: 'Skrzydło romboidalne', pewnosc: 'wysoka', zrodlo: W_F22 + ' (Overview)',
        opis: 'Skrzydło ma obrys zbliżony do rombu: krawędź natarcia skośna pod kątem około 42 stopni, krawędź spływu odwrotnie skośna. Te same kąty powtarzają się na wlotach, usterzeniu i drzwiach komór, żeby odbicia radarowe skupiały się w kilku wąskich kierunkach. Na krawędzi natarcia są klapy, na spływie lotki i klapolotki.',
        wers: 'Krawędź skrzydła i krawędź wlotu biegną równolegle. Dzięki temu echo radaru ucieka w kilka wąskich stron, a nie do ciebie.' },
      { rodzaj: 'usterzenie', nazwa: 'Stateczniki skośne', pewnosc: 'wysoka', zrodlo: W_F22 + ' (Overview)',
        opis: 'Dwa stateczniki pionowe pochylono na zewnątrz, a stery wysokości są płytowe, w całości ruchome. Pochylenie nie pozwala, by statecznik i kadłub tworzyły kąt prosty, czyli reflektor narożny. Usterzenie współpracuje z wektorowaniem ciągu przy dużych kątach natarcia.',
        wers: 'Dwa ogony odchylają się od siebie jak otwarte nożyce. Gdyby stały pionowo, oddawałyby radarowi każdą falę.' },
      { rodzaj: 'dysze', nazwa: 'Płaskie dysze z wektorowaniem ciągu', pewnosc: 'wysoka', zrodlo: W_F22 + ' (Overview); ' + RAPORT + ', sekcja F-22A',
        opis: 'Dwa silniki Pratt & Whitney F119 (według raportu każdy około 156 kN z dopalaczem) kończą się płaskimi, prostokątnymi dyszami. Klapy dysz odchylają strumień w górę i w dół o 20 stopni, co pomaga w ciasnych manewrach i przy dużych kątach natarcia.',
        wers: 'Za ogonem drży powietrze nad dwiema płaskimi szczelinami. One umieją skręcić ogień w górę i w dół, a z nim cały samolot.' },
      { rodzaj: 'komory', nazwa: 'Trzy komory uzbrojenia', pewnosc: 'wysoka', zrodlo: W_F22 + ' (Armament; Specifications (F-22A))',
        opis: 'Pod kadłubem jest główna komora na sześć pocisków AIM-120 albo na bomby kierowane razem z pociskami AIM-120. Dwie mniejsze komory boczne, za wlotami, mają po jednej wyrzutni LAU-141/A na pocisk krótkiego zasięgu AIM-9. Działko M61A2 kalibru 20 mm wbudowano w prawą nasadę skrzydła.',
        wers: 'Brzuch otwiera się na ułamek sekundy, pocisk wypada i drzwi znów się zamykają. Przez tę chwilę Raptor jest widoczny, potem znów nie.' },
      { rodzaj: 'sensory', nazwa: 'Bierne anteny i IRDS', pewnosc: 'srednia', zrodlo: W_F22 + ' (Avionics); ' + RAPORT + ', sekcja F-22A',
        opis: 'Raptor nie ma kuli czujnika podczerwieni przed kabiną. W poszycie wtopiono za to anteny systemu walki elektronicznej AN/ALR-94, który wykrywa i namierza cudze emisje radarowe, sam nic nie nadając, a odpalenia rakiet wykrywa AN/AAR-56. Według raportu modernizacja dodaje IRDS, czyli wykrywanie odpaleń rakiet w podczerwieni.',
        wers: 'Raptor słucha, zanim spojrzy. Uszy ukryte w poszyciu mówią pilotowi, kto go szuka, choć sam nie wysłał ani jednego impulsu.' },
      { rodzaj: 'podwozie', nazwa: 'Podwozie trójpodporowe i hak', pewnosc: 'srednia', zrodlo: W_F22 + ' (Overview)',
        opis: 'Podwozie jest chowane, w układzie trójpodporowym, a samolot ma awaryjny hak hamujący. Budowy goleni, drzwi wnęk ani położenia haka ten materiał nie opisuje.',
        wers: 'Patrzysz na samolot z awaryjnym hakiem hamującym. Na co dzień hak jest zbędny — to ostatnia deska ratunku przy lądowaniu.' },
      { rodzaj: 'kadlub', nazwa: 'Kadłub z ostrą krawędzią boczną', pewnosc: 'srednia', zrodlo: W_F22 + ' (Overview, Stealth); ' + RAPORT + ', sekcja F-22A',
        opis: 'Kadłub ma po bokach ostrą krawędź (chine), która biegnie od nosa aż do skrzydeł i kieruje odbicia radarowe w kilka stron zamiast rozpraszać je po całej sylwetce. Poszycie pokrywają materiały pochłaniające fale radarowe, a anteny schowano pod powierzchnią. Według raportu USAF modernizuje 142 płatowce, żeby latały jeszcze w latach czterdziestych i pięćdziesiątych.',
        wers: 'Wzdłuż kadłuba biegnie ostra krawędź, od nosa po skrzydło. To ona rozcina echo radaru, jak dziób łodzi rozcina wodę.' },
    ]),

    'f-35a': czesci('f-35a', [
      { rodzaj: 'nos', nazwa: 'Nos i radar AN/APG-81', pewnosc: 'wysoka', zrodlo: W_F35 + ' (Sensors and avionics)',
        opis: 'W nosie pracuje radar AN/APG-81 firmy Northrop Grumman z anteną aktywnie skanowaną (AESA). Poza wykrywaniem celów jest częścią systemu walki elektronicznej. Zasięgi i tryby pracy pozostają niejawne.',
        wers: 'Ten nos nie tylko patrzy. Tą samą anteną, którą przed chwilą szukał celu, potrafi zagłuszyć cudzy radar.' },
      { rodzaj: 'kabina', nazwa: 'Kabina i hełm', pewnosc: 'wysoka', zrodlo: W_F35 + ' (Cockpit)',
        opis: 'Pilot nie ma klasycznego wyświetlacza przeziernego — symbole i obraz z kamer trafiają na wizjer hełmu. Przed nim jest jeden duży ekran dotykowy zamiast rzędu zegarów. Owiewka jest jednoczęściowa i przyciemniana.',
        wers: 'Zakładasz hełm i kabina znika. Patrzysz w dół, przez własne nogi, i widzisz ziemię.' },
      { rodzaj: 'wloty', nazwa: 'Wloty bez przegrody (DSI)', pewnosc: 'wysoka', zrodlo: W_F35 + ' (Overview, Stealth and signatures)',
        opis: 'Przed każdym z dwóch wlotów jest wybrzuszenie, które odpycha warstwę przyścienną powietrza bez ruchomych części i bez szczeliny, jaką mają starsze myśliwce. To rozwiązanie, zwane DSI, jest lżejsze i mniej widoczne dla radaru. Kanały wlotowe wyginają się, zasłaniając łopatki silnika.',
        wers: 'Przed każdym wlotem rośnie gładki garb. Odpycha leniwe powietrze z poszycia bez jednej ruchomej części i bez szczeliny.' },
      { rodzaj: 'skrzydla', nazwa: 'Skrzydło trapezowe', pewnosc: 'wysoka', zrodlo: W_F35 + ' (Variants: F-35C); ' + RAPORT + ', sekcja F-35A',
        opis: 'Wariant A ma trapezowe skrzydło o rozpiętości 10,7 m, mniejsze niż w pokładowym F-35C, który ma większe skrzydła ze składanymi końcówkami. Krawędzie natarcia i spływu są równoległe do krawędzi usterzenia.',
        wers: 'Skrzydło jest krótkie i grube jak u małego ptaka. W środku jest paliwo, bo wszystko, co wisi na zewnątrz, zdradza samolot.' },
      { rodzaj: 'usterzenie', nazwa: 'Usterzenie skośne', pewnosc: 'wysoka', zrodlo: W_F35 + ' (Overview)',
        opis: 'Dwa stateczniki pionowe są pochylone na zewnątrz, a stery wysokości w całości ruchome. Krawędzie wszystkich powierzchni usterzenia powtarzają kąty skrzydła. Układ jest wspólny dla wariantów A, B i C.',
        wers: 'Z tyłu sterczą dwa krótkie, rozchylone ogony. Ich krawędzie są równoległe do krawędzi skrzydła — przypadku tu nie ma.' },
      { rodzaj: 'dysze', nazwa: 'Dysza silnika F135', pewnosc: 'wysoka', zrodlo: W_F35 + ' (Engine); ' + RAPORT + ', sekcja F-35A',
        opis: 'Jeden silnik Pratt & Whitney F135 (według raportu około 191 kN z dopalaczem) kończy się okrągłą dyszą z 15 zachodzących na siebie klap, których krawędź tworzy zęby piły. Ząbki rozpraszają odbicia radarowe od tyłu i mieszają gorący strumień z powietrzem. W wariancie A dysza nie wektoruje ciągu; w wariancie B obraca się w dół do pionowego lądowania.',
        wers: 'Za samolotem jest tylko jedno ognisko. Jeden silnik pcha wszystko, a jego dysza ma brzeg ząbkowany jak koronka.' },
      { rodzaj: 'komory', nazwa: 'Dwie komory uzbrojenia', pewnosc: 'wysoka', zrodlo: W_F35 + ' (Armament)',
        opis: 'Pod kadłubem są dwie komory, każda z dwoma punktami podwieszenia na bomby albo pociski. W konfiguracji w pełni ukrytej wariant A przenosi więc cztery uzbrojenia. Lewa nasada skrzydła kryje wbudowane działko 25 mm GAU-22/A, którego warianty B i C nie mają.',
        wers: 'Dwa schowki pod brzuchem, w każdym bomba i rakieta. Cztery ciosy — i żadnego nie widać, dopóki drzwi się nie otworzą.' },
      { rodzaj: 'sensory', nazwa: 'Celownik EOTS i kamery DAS', pewnosc: 'wysoka', zrodlo: W_F35 + ' (Sensors and avionics); ' + RAPORT + ', sekcja F-35A',
        opis: 'Pod nosem, za fasetowanym okienkiem, siedzi celownik optoelektroniczny EOTS (AN/AAQ-40). Sześć kamer podczerwieni systemu DAS (AN/AAQ-37), rozmieszczonych na kadłubie, daje widok sferyczny. Ostrzegają przed rakietami i podają obraz na wizjer hełmu, o czym raport pisze jako o sześciu kamerach wtopionych w kadłub.',
        wers: 'Pod brodą samolotu błyszczy szklany kryształ. To oko, które w nocy widzi cudzy silnik po samym cieple.' },
      { rodzaj: 'podwozie', nazwa: 'Podwozie', pewnosc: 'niska', zrodlo: W_F35 + ' (Variants: F-35C)',
        opis: 'Wskazany materiał opisuje podwozie wariantu pokładowego F-35C: podwójne koło przedniej goleni, hak do wielokrotnych lądowań na liny hamujące i podwozie wzmocnione na takie lądowania. O podwoziu wariantu A ten materiał nie mówi.',
        wers: 'Wyobraź sobie brata tej maszyny na lotniskowcu. Jego nogi wzmocniono, bo on na pokładzie nie ląduje — on na niego spada.' },
      { rodzaj: 'kadlub', nazwa: 'Kadłub', pewnosc: 'wysoka', zrodlo: W_F35 + ' (Stealth and signatures); ' + RAPORT + ', sekcja F-35A',
        opis: 'Kadłub jest szeroki i płaski, z ostrą krawędzią boczną od nosa do skrzydeł, a całe uzbrojenie i paliwo mieszczą się w środku. Materiał pochłaniający fale radarowe ma postać maty włóknistej w poszyciu. Według raportu sygnatura radarowa pozostaje niejawna.',
        wers: 'Ten kadłub wygląda na pękaty, jakby zjadł za dużo. Zjadł: paliwo i bomby, które inne samoloty noszą pod skrzydłami.' },
    ]),

    'f-47': czesci('f-47', [
      { rodzaj: 'nos', nazwa: 'Nos (grafika USAF)', pewnosc: 'niska', zrodlo: GRAF_F47 + '; ' + TWZ_F47,
        opis: 'Grafika USAF z 21 marca 2025 pokazuje szeroki, spłaszczony nos, który analitycy opisują jako łopatowy. Typu radaru nie ujawniono. Urzędnicy zastrzegają, że opublikowane obrazy celowo zniekształcono, więc kształt nosa jest tylko wskazówką.',
        wers: 'Patrzysz na nos samolotu, który istnieje tylko na jednym rysunku. Ktoś zadbał, żeby ten rysunek kłamał.' },
      { rodzaj: 'kabina', nazwa: 'Kabina', pewnosc: 'niska', zrodlo: GRAF_F47 + '; ' + RAPORT + ', sekcja F-47',
        opis: 'Na grafice widać jednomiejscową kabinę z owiewką wtopioną w grzbiet kadłuba. Program zakłada maszynę z pilotem, która według raportu ma też kierować dronami. Kształtu owiewki nie potwierdzono.',
        wers: 'W tej kabinie usiądzie jeden człowiek. Wokół niego polecą maszyny, w których nie siedzi nikt — i będą go słuchać.' },
      { rodzaj: 'wloty', nazwa: 'Wloty (ukryte)', pewnosc: 'bardzo-niska', zrodlo: ASF_F47,
        opis: 'Na opublikowanych obrazach wlotów powietrza w ogóle nie widać. Air & Space Forces Magazine podaje, że to jeden z celowo ukrytych elementów.',
        wers: 'Szukasz na rysunku, którędy ten samolot oddycha. Nie znajdziesz — wloty wymazano, zanim obraz trafił do ciebie.' },
      { rodzaj: 'skrzydla', nazwa: 'Skrzydła (grafika USAF)', pewnosc: 'niska', zrodlo: TWZ_F47 + '; ' + ASF_F47,
        opis: 'Grafika pokazuje skrzydła z wyraźnym wzniosem i brak usterzenia pionowego, co analitycy odczytują jako układ bezogonowy. Urzędnicy każą traktować obrazy z dużą rezerwą. Obrysu i rozpiętości skrzydeł nie ujawniono.',
        wers: 'Na rysunku skrzydła unoszą się lekko ku górze. Może tak będzie naprawdę, a może to tylko przebranie.' },
      { rodzaj: 'kaczka', nazwa: 'Kaczki (tylko na grafice)', pewnosc: 'bardzo-niska', zrodlo: GRAF_F47 + '; ' + TWZ_F47 + '; ' + ASF_F47,
        opis: 'Grafika USAF z 21 marca 2025 pokazuje przy kabinie dwie małe powierzchnie przedniego usterzenia, czyli kaczki. To rysunek, nie zdjęcie, a urzędnicy przyznają, że obrazy celowo zniekształcono; analitycy nie wiedzą nawet, czy te powierzchnie są ruchome. Raport nazywa J-20 jedynym stealthem z kaczkami, ale mówi o maszynach latających, a F-47 jeszcze nie wzniósł się w powietrze.',
        wers: 'Na rysunku przy kabinie sterczą dwa małe skrzydełka. Prawdziwe czy dorysowane dla zmylenia — tego jeszcze nikt nie wie.' },
      { rodzaj: 'dysze', nazwa: 'Silnik NGAP i dysze', pewnosc: 'srednia', zrodlo: RAPORT + ', sekcja F-47',
        opis: 'Docelowy silnik powstaje w programie NGAP i według raportu nie będzie gotowy przed 2031 rokiem. Pierwsze loty, planowane na 2028, odbędą się na napędzie zastępczym. Liczby silników ani kształtu dysz nie pokazano.',
        wers: 'Tył samolotu jest jak niedokończone zdanie. Właściwy silnik dopisze ktoś dopiero w 2031 roku.' },
      { rodzaj: 'komory', nazwa: 'Komory uzbrojenia', pewnosc: 'bardzo-niska', zrodlo: RAPORT + ', sekcja F-47 (rola, pewność); ' + GRAF_F47,
        opis: 'Komory nie zostały pokazane ani opisane. Rola przewagi powietrznej i niewidzialność dla radaru wymagają uzbrojenia w środku, ale liczba i położenie komór są nieznane.',
        wers: 'Gdzieś w tym kadłubie są drzwi, za którymi czekają rakiety. Gdzie dokładnie — tego nie pokazano nikomu z zewnątrz.' },
      { rodzaj: 'podwozie', nazwa: 'Podwozie', pewnosc: 'bardzo-niska', zrodlo: GRAF_F47,
        opis: 'Grafika przedstawia maszynę w locie, z podwoziem schowanym. Układu podwozia nie ujawniono.',
        wers: 'Na jedynym obrazie ten samolot leci. Nikt jeszcze nie widział, na czym stoi.' },
      { rodzaj: 'kadlub', nazwa: 'Kadłub', pewnosc: 'srednia', zrodlo: RAPORT + ', sekcja F-47',
        opis: 'Program ma kontrakt EMD wart ponad 20 mld USD i plan ponad 185 egzemplarzy, ale wymiarów płatowca nie podano. Sylwetka w tej zakładce jest interpretacją grafiki USAF, a nie obrysem ze zdjęcia. Pierwszy reprezentatywny prototyp jest w budowie.',
        wers: 'Patrzysz na kadłub za trzysta milionów dolarów za sztukę. Nie wiesz, jak naprawdę wygląda — nikt spoza hali tego nie wie.' },
    ]),

    'su-57': czesci('su-57', [
      { rodzaj: 'nos', nazwa: 'Radar N036 Biełka', pewnosc: 'srednia', zrodlo: W_SU57 + ' (Avionics)',
        opis: 'W nosie jest główna antena radaru N036 z kompleksu Biełka, aktywnie skanowana i pochylona do tyłu, żeby nie odbijać fali wprost. Dwie anteny boczne w policzkach przedniej części kadłuba poszerzają pole widzenia na boki. Kompleks obejmuje też anteny pasma L w krawędziach natarcia skrzydeł.',
        wers: 'Ten samolot ma oczy nie tylko z przodu. Patrzy też na boki, z policzków, jak ptak, który nie musi obracać głowy.' },
      { rodzaj: 'kabina', nazwa: 'Kabina', pewnosc: 'srednia', zrodlo: W_SU57 + ' (Cockpit, Stealth)',
        opis: 'Owiewka jest dwuczęściowa: tylna część przesuwa się do przodu i blokuje. Szkło pokryto warstwą tlenków metali, żeby radar nie odbijał się od wnętrza kabiny. Pilot siedzi na fotelu K-36D-5 i ma dwa duże wyświetlacze wielofunkcyjne.',
        wers: 'Szyba kabiny mieni się jak plama oleju na wodzie. Ta tęcza to metal, który nie pozwala radarowi zajrzeć pilotowi w twarz.' },
      { rodzaj: 'wloty', nazwa: 'Wloty pod kadłubem', pewnosc: 'srednia', zrodlo: W_SU57 + ' (Engines, Stealth)',
        opis: 'Dwa wloty leżą pod kadłubem, pod nasadami skrzydeł, i mają ruchome rampy regulujące przepływ. Kanały tylko częściowo zasłaniają silnik, więc resztę czoła sprężarki maskuje skośna kratownica blokująca. Wysuwane siatki chronią silniki przed odłamkami na krótkich, nierównych pasach.',
        wers: 'Wloty siedzą nisko, pod brzuchem, i mają siatki jak sita. Ten samolot ma lądować tam, gdzie pas jest krótki i brudny.' },
      { rodzaj: 'skrzydla', nazwa: 'Skrzydło z anteną pasma L', pewnosc: 'srednia', zrodlo: W_SU57 + '; ' + RAPORT + ', sekcja Su-57',
        opis: 'Skrzydło ma obrys trapezu z klapami na krawędzi natarcia, lotkami i klapolotkami. W krawędziach natarcia mieszczą się anteny pasma L kompleksu N036. Według raportu dobrano je tak, żeby wykrywać samoloty, których kształt optymalizowano przeciw zupełnie innym częstotliwościom.',
        wers: 'W krawędzi tego skrzydła ukryto długie ucho. Słyszy fale, przed którymi inne myśliwce wcale nie próbowały się chować.' },
      { rodzaj: 'usterzenie', nazwa: 'Usterzenie całkowicie ruchome', pewnosc: 'srednia', zrodlo: W_SU57,
        opis: 'Stateczniki pionowe są małe, pochylone na zewnątrz i w całości ruchome — obracają się jak stery, bez klasycznych sterów kierunku. Stery wysokości również są w całości ruchome. Mniejsze powierzchnie to mniej krawędzi odbijających fale radaru.',
        wers: 'Szukasz na ogonach sterów i ich nie znajdujesz. Każdy ogon obraca się cały — sam jest sterem.' },
      { rodzaj: 'levcon', nazwa: 'LEVCON — sterowniki wirów', pewnosc: 'srednia', zrodlo: W_SU57,
        opis: 'Przed nasadą skrzydła, wzdłuż kadłuba, są ruchome powierzchnie LEVCON (sterowniki wirów krawędzi natarcia). Zmieniając kąt, kształtują wiry powietrza przy dużych kątach natarcia, pomagają w wyważeniu i ułatwiają wyjście z przeciągnięcia, gdyby zawiodło wektorowanie ciągu. Żaden inny samolot w tym zestawieniu ich nie ma.',
        wers: 'Przy nasadzie skrzydła rusza się wąski płat, jakiego nie ma nikt inny w tej hali. Zwija powietrze w wiry i trzyma samolot w ryzach.' },
      { rodzaj: 'dysze', nazwa: 'Dysze z wektorowaniem ciągu', pewnosc: 'srednia', zrodlo: W_SU57 + ' (Engines); ' + RAPORT + ', sekcja Su-57',
        opis: 'Dwa silniki AL-41F1 w szeroko rozstawionych gondolach mają okrągłe dysze odchylane w jednej, skośnie ustawionej płaszczyźnie. Różnicowe wychylenie obu dysz daje sterowanie w pochyleniu, odchyleniu i przechyleniu. Według raportu wersja Su-57M1 z docelowym silnikiem AL-51F-1 ma dostać płaską dyszę obniżającą sygnaturę, ale to wciąż deklaracja.',
        wers: 'Dwie dysze stoją daleko od siebie, rozdzielone szerokim tunelem. Każda odchyla ogień po swojemu, a razem wykręcają samolotem jak akrobatą.' },
      { rodzaj: 'komory', nazwa: 'Komory uzbrojenia', pewnosc: 'srednia', zrodlo: W_SU57 + ' (Armament); ' + RAPORT + ', sekcja Su-57',
        opis: 'Między gondolami silników są dwie główne komory, jedna za drugą, każda długości około 4,4 m; ich wyrzutnie UVKU-50U przenoszą uzbrojenie do 700 kg. Dwie małe komory boczne o trójkątnym przekroju, przy nasadach skrzydeł, mieszczą pociski krótkiego zasięgu. Według raportu nad Ukrainą Su-57 prawie wyłącznie odpala pociski z dystansu, z własnej przestrzeni powietrznej.',
        wers: 'Zaglądasz w tunel między silnikami: dwa długie schowki, jeden za drugim. Ich wyrzutnie udźwigną uzbrojenie ciężkie jak dorosły koń.' },
      { rodzaj: 'sensory', nazwa: 'Czujnik podczerwieni 101KS-V', pewnosc: 'srednia', zrodlo: W_SU57 + ' (Avionics, Stealth)',
        opis: 'Przed owiewką, po prawej stronie, jest kula czujnika podczerwieni 101KS-V, która obraca się szkłem do tyłu, gdy nie pracuje, żeby nie odbijać fal radaru. Czujnik szuka celów biernie, bez zdradzania się emisją. Za owiewką i pod kabiną są wieżyczki systemu oślepiającego głowice rakiet naprowadzanych na podczerwień.',
        wers: 'Przed szybą kabiny sterczy szklana kula. Gdy nie patrzy, odwraca się plecami, żeby jej oko nie błysnęło na cudzym radarze.' },
      { rodzaj: 'podwozie', nazwa: 'Podwozie', pewnosc: 'bardzo-niska', zrodlo: 'Wnioski z ogólnie dostępnych zdjęć Su-57 — brak materiału technicznego opisującego podwozie',
        opis: 'Podwozie jest chowane, w układzie trójpodporowym. To wniosek z ogólnie dostępnych zdjęć; żaden znany nam materiał techniczny nie opisuje budowy goleni ani drzwi wnęk.',
        wers: 'Patrzysz na nogi Su-57. Jak są zbudowane, nie opisał żaden dokument — znasz je tylko ze zdjęć.' },
      { rodzaj: 'kadlub', nazwa: 'Kadłub nośny', pewnosc: 'srednia', zrodlo: W_SU57 + '; ' + RAPORT + ', sekcja Su-57',
        opis: 'Kadłub tworzy z płatem jedną szeroką bryłę nośną, a dwa silniki rozstawiono daleko od siebie, zostawiając między nimi tunel na komory. Kompozyty stanowią około 70% powierzchni poszycia, a krawędzie paneli są ząbkowane. Według raportu zbudowano co najmniej 44 płatowce, z czego około 10 to prototypy.',
        wers: 'Z góry ten samolot przypomina płaszczkę. Całe ciało niesie go w powietrzu, nie tylko skrzydła.' },
    ]),

    'su-75': czesci('su-75', [
      { rodzaj: 'nos', nazwa: 'Nos i radar (zapowiedź)', pewnosc: 'niska', zrodlo: W_SU75 + ' (Avionics)',
        opis: 'Instytut NIIP zapowiada tani radar z anteną aktywnie skanowaną, a elektronika ma korzystać z rozwiązań Su-57. Nos makiety z 2021 roku ma ostre krawędzie boczne płynnie przechodzące w kadłub. Żadnego radaru nie pokazano w działaniu.',
        wers: 'Nos tego samolotu jest pusty. Radar, który ma w nim zamieszkać, istnieje na razie w zapowiedziach.' },
      { rodzaj: 'kabina', nazwa: 'Kabina', pewnosc: 'niska', zrodlo: W_SU75 + ' (Cockpit); ' + RAPORT + ', sekcja Su-75',
        opis: 'Według producenta kabina ma odpowiadać kabinie Su-57: dwa duże wyświetlacze i szerokokątny wyświetlacz przezierny. Makieta pokazana na MAKS 2021 miała jednoczęściową, kroplową owiewkę. Według raportu zapowiadane są też wersje dwumiejscowa i bezzałogowa.',
        wers: 'Zaglądasz do kabiny makiety. Ta szyba widziała tysiące fleszy i ani jednej chmury z bliska.' },
      { rodzaj: 'wloty', nazwa: 'Wlot pod nosem', pewnosc: 'niska', zrodlo: W_SU75,
        opis: 'Jedyny wlot powietrza leży pod nosem i obejmuje dolną część kadłuba kanciastym kształtem litery U. Producent twierdzi, że taki wlot bez przegrody (DSI) zmniejsza sygnaturę radarową w porównaniu z Su-57. Patenty z 2023 roku opisują dalsze zmiany wlotów i boków kadłuba, więc kształt z makiety może być nieaktualny.',
        wers: 'Samolot otwiera paszczę pod brodą, szeroko jak rekin. Jeden wlot karmi jeden silnik.' },
      { rodzaj: 'skrzydla', nazwa: 'Skrzydło', pewnosc: 'niska', zrodlo: W_SU75 + '; ' + RAPORT + ', sekcja Su-75',
        opis: 'Skrzydło ma dużą powierzchnię w stosunku do rozmiarów maszyny, co komentatorzy odczytują jako nastawienie na walkę na dużych wysokościach. Szczegółowych danych skrzydła producent nie podał. Raport podaje deklarowaną rozpiętość około 11,8 m.',
        wers: 'Skrzydła są duże jak na tak mały samolot. Obiecują lot wysoko — tylko że jeszcze ani razu nie oderwały się od ziemi.' },
      { rodzaj: 'usterzenie', nazwa: 'Usterzenie motylkowe (V)', pewnosc: 'niska', zrodlo: W_SU75,
        opis: 'Zamiast czterech powierzchni usterzenia są dwie, ustawione w literę V, podobnie jak w amerykańskim YF-23. Każda działa naraz jako ster wysokości i kierunku, co wymaga bardziej złożonego układu sterowania. Mniej powierzchni to mniej krawędzi odbijających fale radaru.',
        wers: 'Z tyłu sterczą tylko dwa ogony, rozchylone w literę V. Każdy robi naraz robotę dwóch.' },
      { rodzaj: 'dysze', nazwa: 'Silnik i dysza', pewnosc: 'niska', zrodlo: W_SU75 + ' (Engine); ' + RAPORT + ', sekcja Su-75',
        opis: 'Jeden silnik kończy się pojedynczą, okrągłą dyszą. Raport podaje typ silnika jako niepotwierdzony; najczęściej wymienia się odmianę AL-51F-1, planowanego też dla Su-57M. Pojedynczy silnik ma obniżyć koszt zakupu i eksploatacji.',
        wers: 'Jedna dysza, jeden silnik, żadnego zapasu. Ten samolot miał być tani — dlatego ma tylko jedno serce.' },
      { rodzaj: 'komory', nazwa: 'Komora uzbrojenia', pewnosc: 'niska', zrodlo: W_SU75 + '; ' + AIN_SU75,
        opis: 'Producent deklaruje wewnętrzną komorę na pięć pocisków oraz wbudowane działko. Dane pochodzą wyłącznie z materiałów targowych. Nie sprawdzono ich w locie, bo latającego egzemplarza jeszcze nie ma.',
        wers: 'Pod brzuchem obiecano miejsce na pięć rakiet. Na razie mieszczą się tam tylko obietnice.' },
      { rodzaj: 'podwozie', nazwa: 'Podwozie', pewnosc: 'bardzo-niska', zrodlo: 'Wnioski z ogólnie dostępnych zdjęć makiety Su-75 z MAKS 2021; ' + RAPORT + ', sekcja Su-75',
        opis: 'Makieta z MAKS 2021 stała, jak widać na zdjęciach, na klasycznym podwoziu trójpodporowym. Szczegółów podwozia prototypu do prób w locie, budowanego w Komsomolsku nad Amurem, nie podano.',
        wers: 'Te koła toczyły się tylko po podłodze hali wystawowej. Po pasie startowym jeszcze nigdy.' },
      { rodzaj: 'kadlub', nazwa: 'Kadłub (makieta)', pewnosc: 'niska', zrodlo: W_SU75 + '; ' + RAPORT + ', sekcja Su-75',
        opis: 'Kadłub jest krótki i zwarty, zbudowany wokół jednego silnika i wlotu pod nosem. Egzemplarz pokazany w 2021 roku był makietą do naziemnego zgrywania podzespołów, a nie samolotem zdolnym do lotu. Według raportu powstają dwa prototypy: jeden do prób statycznych, drugi do prób w locie.',
        wers: 'Stukasz w burtę i słyszysz pustkę. To atrapa — kadłub zrobiony po to, żeby go oglądać, nie żeby nim latać.' },
    ]),

    'j-20a': czesci('j-20a', [
      { rodzaj: 'nos', nazwa: 'Nos i radar', pewnosc: 'niska', zrodlo: W_J20 + ' (Avionics)',
        opis: 'Chiny nie podały typu radaru. Janes przypisuje mu radar typu 1475 (KLJ-5) z anteną aktywnie skanowaną. Nos ma ostre krawędzie boczne, które przechodzą w krawędzie wlotów i kaczek.',
        wers: 'Długi, ostry nos przecina powietrze daleko przed resztą samolotu. Co w nim siedzi, Chiny nie powiedziały nikomu.' },
      { rodzaj: 'kabina', nazwa: 'Kabina', pewnosc: 'niska', zrodlo: W_J20 + ' (Avionics); ' + RAPORT + ', sekcja J-20A',
        opis: 'Kabinę przykrywa bezramowa, kroplowa owiewka z powłoką przewodzącą. Wnętrze ma jeden duży wyświetlacz, trzy pomocnicze, holograficzny wyświetlacz przezierny i celownik nahełmowy. Wersja J-20S ma drugą kabinę, w której według raportu siedzi prawdopodobnie operator dronów.',
        wers: 'Za szybą siedzi pilot, a w wersji S za nim drugi człowiek. Mówi się, że ten drugi ma dowodzić nie samolotem, a dronami obok.' },
      { rodzaj: 'wloty', nazwa: 'Wloty bez przegrody (DSI)', pewnosc: 'niska', zrodlo: W_J20,
        opis: 'Dwa wloty bez przegrody (DSI) leżą tuż za kabiną, po bokach kadłuba. Wybrzuszenie przed wlotem odpycha warstwę przyścienną, a kanał w kształcie litery S zasłania łopatki silnika. Tuż za wlotami osadzono kaczki.',
        wers: 'Wloty zaczynają się zaraz za plecami pilota. Kanał wije się jak wąż, żeby radar nie zobaczył wirującego silnika.' },
      { rodzaj: 'skrzydla', nazwa: 'Skrzydło delta', pewnosc: 'niska', zrodlo: W_J20,
        opis: 'Skrzydło ma obrys delty z przedłużeniami nasady (LERX) i odwrotnie skośną krawędzią spływu. Płat współpracuje z kaczkami i nośnym kadłubem. Pod skrzydłami są cztery punkty podwieszenia na zbiorniki, używane poza misjami wymagającymi skrytości.',
        wers: 'Skrzydła są cienkie i daleko z tyłu, jak lotki strzały. Resztę nośności daje kadłub i para małych skrzydełek z przodu.' },
      { rodzaj: 'usterzenie', nazwa: 'Stateczniki i grzebienie brzuszne', pewnosc: 'niska', zrodlo: W_J20 + ' (Characteristics)',
        opis: 'Dwa stateczniki pionowe są pochylone na zewnątrz i w całości ruchome. Pod tylną częścią kadłuba są dwa krótkie, ale głębokie grzebienie brzuszne, poprawiające stateczność kierunkową. Klasycznych sterów wysokości nie ma — tę rolę przejmują kaczki.',
        wers: 'Pod ogonem widzisz dwa krótkie grzebienie, jak u ryby. Bez nich długi kadłub chciałby zarzucać na boki.' },
      { rodzaj: 'kaczka', nazwa: 'Kaczki (przednie usterzenie)', pewnosc: 'niska', zrodlo: W_J20 + '; ' + RAPORT + ', sekcja J-20A (ciekawostki)',
        opis: 'Za wlotami są dwie w całości ruchome powierzchnie przedniego usterzenia z wyraźnym wzniosem. Sterują pochyleniem przy dużych kątach natarcia, gdzie klasyczny ster wysokości traciłby skuteczność. Według raportu to jedyny stealth na świecie z kaczkami: każda ruchoma powierzchnia to dodatkowe odbicie, a Chińczycy uznali, że zwrotność jest warta tej ceny.',
        wers: 'Przed skrzydłami poruszają się dwa małe skrzydełka. Na Zachodzie mówiono, że stealth nie może ich mieć — Chiny i tak je dały.' },
      { rodzaj: 'dysze', nazwa: 'Dysze i silnik WS-15', pewnosc: 'niska', zrodlo: RAPORT + ', sekcja J-20A; ' + W_J20 + ' (Engines)',
        opis: 'Według raportu nowe egzemplarze dostają silniki WS-15 o ciągu około 180 kN, a wcześniejsze latały na WS-10C i rosyjskich AL-31F. Dysze silników WS-10C mają ząbkowane krawędzie klap, zmniejszające odbicie od tyłu. WS-15 ma po raz pierwszy w tym programie umożliwić lot naddźwiękowy bez dopalacza.',
        wers: 'Przez piętnaście lat te dysze dmuchały cudzym ogniem. Teraz w środku pracuje własne chińskie serce.' },
      { rodzaj: 'komory', nazwa: 'Komory uzbrojenia', pewnosc: 'niska', zrodlo: W_J20 + ' (Armament); ' + RAPORT + ', sekcja J-20A',
        opis: 'Główna komora pod kadłubem mieści pociski dalekiego zasięgu, według raportu między innymi PL-15. Dwie komory boczne za wlotami kryją pociski krótkiego zasięgu PL-10, wysuwane na zewnątrz, a drzwi zamykają się przed strzałem. Wbudowanego działka J-20 prawdopodobnie nie ma.',
        wers: 'Z boku kadłuba otwiera się wąska klapa i wysuwa rakietę na zewnątrz. Drzwi zamykają się, zanim pojawi się ogień.' },
      { rodzaj: 'sensory', nazwa: 'Czujniki optoelektroniczne', pewnosc: 'niska', zrodlo: W_J20 + ' (Avionics)',
        opis: 'Sześć okienek czujników biernych rozmieszczonych na kadłubie daje widok dookolny, a pod nosem jest czujnik optoelektroniczny, w nowszych wersjach o polu widzenia 360 stopni. Układ przypomina EOTS i DAS z F-35, ale Chiny nie potwierdziły jego parametrów.',
        wers: 'Na skórze samolotu błyszczy sześć szklanych okienek. Każde patrzy w inną stronę i razem nie zostawiają martwego pola.' },
      { rodzaj: 'podwozie', nazwa: 'Podwozie', pewnosc: 'bardzo-niska', zrodlo: 'Wikipedia (en): Chengdu J-20, sekcja Flight testing (chowanie podwozia w locie 5.05.2011), stan 11.2026; poza tym wnioski z ogólnie dostępnych zdjęć',
        opis: 'Podwozie jest chowane, w układzie trójpodporowym; chowanie w locie sprawdzono 5 maja 2011. Szczegółów konstrukcji nie opublikowano, a sam układ to wniosek z ogólnie dostępnych zdjęć.',
        wers: 'Koła tego smoka widzieli tylko ludzie z teleobiektywami za płotem. Żaden dokument o nich nie wspomina.' },
      { rodzaj: 'kadlub', nazwa: 'Długi kadłub', pewnosc: 'niska', zrodlo: W_J20 + ' (Stealth); ' + RAPORT + ', sekcja J-20A',
        opis: 'Kadłub jest długi, według raportu około 21,2 m, i ma ostrą krawędź boczną od nosa po skrzydła, płaski spód i kanciaste przekroje. W środku mieści się dużo paliwa, stąd przypisywana mu rola myśliwca dalekiego zasięgu. Pod kadłubem montuje się chowany reflektor soczewkowy, który w czasie pokoju celowo powiększa echo radarowe.',
        wers: 'Ten samolot jest dłuższy od F-22 o ponad dwa metry. W tej długości mieści się paliwo na bardzo daleką drogę.' },
    ]),

    'j-35a': czesci('j-35a', [
      { rodzaj: 'nos', nazwa: 'Nos i radar', pewnosc: 'niska', zrodlo: W_J35 + ' (Avionics)',
        opis: 'W nosie jest radar z anteną aktywnie skanowaną, według niepotwierdzonych doniesień typu KLJ-7A. Nos ma fasetowany kształt i ostre krawędzie boczne, podobne do F-35. Chiny nie opublikowały parametrów.',
        wers: 'Z przodu wygląda prawie jak F-35. Dopiero z bliska widzisz, że to inna twarz, z innego kraju.' },
      { rodzaj: 'kabina', nazwa: 'Kabina', pewnosc: 'niska', zrodlo: W_J35,
        opis: 'J-35A ma owiewkę otwieraną jak muszla, boczny drążek sterowy, duży ekran dotykowy i wyświetlacz nahełmowy. Wersja pokładowa ma klasyczny drążek centralny. Owiewkę pokrywa warstwa przewodząca, chroniąca wnętrze przed falą radaru.',
        wers: 'Pilot trzyma drążek z boku, nie między kolanami. Przed nim jest jeden wielki ekran, który dotyka się jak telefonu.' },
      { rodzaj: 'wloty', nazwa: 'Wloty bez przegrody (DSI)', pewnosc: 'niska', zrodlo: W_J35 + ' (Stealth)',
        opis: 'Dwa wloty bez przegrody (DSI) leżą po bokach kadłuba, pod kabiną. Wybrzuszenia przed wlotami i kanały w kształcie litery S zasłaniają czoła silników. Układ przypomina F-35, choć J-35 ma dwa silniki, nie jeden.',
        wers: 'Dwa wloty wyglądają jak u F-35. Tyle że za każdym z nich jest osobny silnik.' },
      { rodzaj: 'skrzydla', nazwa: 'Skrzydło trapezowe', pewnosc: 'niska', zrodlo: W_J35 + '; ' + RAPORT + ', sekcja J-35A',
        opis: 'Skrzydło jest trapezowe, z klapami na krawędzi natarcia i spływu. Lądowy J-35A ma mniejszą powierzchnię skrzydła niż wersja pokładowa, której skrzydła składają się na lotniskowcu. Według raportu rozpiętość J-35A wynosi około 11,5 m.',
        wers: 'Na lotniskowcu te skrzydła się składają. Tutaj, na lądzie, są krótsze i sztywne.' },
      { rodzaj: 'usterzenie', nazwa: 'Usterzenie', pewnosc: 'niska', zrodlo: W_J35,
        opis: 'Dwa stateczniki pionowe pochylono na zewnątrz, a stery wysokości są w całości ruchome. Stateczniki J-35A mają skrócone stery kierunku, inne niż w prototypach pokładowych. Kaczek ani płetw brzusznych, jak w J-20, tu nie ma.',
        wers: 'Z tyłu stoją dwa skośne ogony i dwa płaskie. Kaczek nie ma — wygląda jak mniejszy J-20, który z nich zrezygnował.' },
      { rodzaj: 'dysze', nazwa: 'Dwa silniki', pewnosc: 'niska', zrodlo: W_J35 + ' (Engines, Stealth); ' + RAPORT + ', sekcja J-35A',
        opis: 'Dwa silniki kończą się okrągłymi dyszami z ząbkowanymi krawędziami klap, zmniejszającymi odbicia radarowe i ślad cieplny. Raport podaje oznaczenie silników jako niepewne; w obiegu krążą WS-19 i WS-21. Wczesne prototypy miały proste, gładkie dysze.',
        wers: 'Dwie dysze, nie jedna jak u F-35. Gdy jeden silnik zgaśnie nad morzem, drugi doniesie pilota do domu.' },
      { rodzaj: 'komory', nazwa: 'Komora uzbrojenia', pewnosc: 'niska', zrodlo: W_J35 + ' (Armaments and payload)',
        opis: 'Pod kadłubem jest wydłużona centralna komora uzbrojenia, w poprzedniku FC-31 z sześcioma wewnętrznymi punktami podwieszenia. Mieści pociski powietrze-powietrze i bomby kierowane. Pod skrzydłami są dodatkowe punkty podwieszenia na misje, w których skrytość nie jest potrzebna.',
        wers: 'Brzuch otwiera się przed tobą na całą długość. W środku wiszą rakiety, ułożone jak noże w szufladzie.' },
      { rodzaj: 'sensory', nazwa: 'Celownik EOTS i czujniki rozproszone', pewnosc: 'niska', zrodlo: W_J35 + ' (Avionics)',
        opis: 'Pod nosem jest wieżyczka celownika optoelektronicznego, a na kadłubie rozmieszczono okienka systemu czujników rozproszonych, który ostrzega przed rakietami i działa też jak czujnik podczerwieni. Parametrów nie podano.',
        wers: 'Pod brodą ma szklane oko, jak F-35. Widzi w podczerwieni ślad cudzego silnika.' },
      { rodzaj: 'podwozie', nazwa: 'Podwozie', pewnosc: 'niska', zrodlo: 'Wikipedia (en): Shenyang J-35, sekcje Development › Shenyang J-35 i Design › Overview (koło przednie, zaczep katapulty, hak), stan 11.2026; ' + RAPORT + ', sekcja J-35A',
        opis: 'Lądowy J-35A ma pojedyncze koło przedniej goleni. Wersja pokładowa zachowała podwójne koło przednie poprzednika FC-31 i ma zaczep do katapulty oraz hak do lądowania na lotniskowcu. Według raportu J-35 startowały z katapulty elektromagnetycznej lotniskowca Fujian we wrześniu 2025.',
        wers: 'Tutaj przednia noga ma jedno koło. Brat z lotniskowca ma dwa i hak, bo ląduje na stalowym pokładzie, który się kołysze.' },
      { rodzaj: 'kadlub', nazwa: 'Kadłub', pewnosc: 'niska', zrodlo: W_J35 + ' (Stealth); ' + RAPORT + ', sekcja J-35A',
        opis: 'Kadłub średniej wielkości łączy się płynnie ze skrzydłem i według raportu ma około 17,3 m długości. Pod spodem jest reflektor soczewkowy, który w czasie pokoju celowo powiększa echo radarowe; według doniesień w J-35A jest chowany. Z tego samego płatowca powstają trzy warianty: pokładowy, lądowy J-35A i eksportowy J-35AE.',
        wers: 'Pod brzuchem ma schowany mały guz, który w czasie pokoju robi go widocznym. Na wojnie guz znika, a z nim samolot.' },
    ]),

    'j-36': czesci('j-36', [
      { rodzaj: 'nos', nazwa: 'Nos i radar', pewnosc: 'bardzo-niska', zrodlo: TWZ_J36,
        opis: 'Nos jest szeroki i płaski, a jaśniejsza osłona w nowszych egzemplarzach może wskazywać, że zamontowano radar. The War Zone sugeruje, że tak szeroki obszar pozwala zmieścić bardzo dużą antenę. Chiny nie podały żadnych danych o radarze.',
        wers: 'Nos tego samolotu jest szeroki jak stół. Może kryć oko większe niż u jakiegokolwiek myśliwca, ale nikt tego nie potwierdził.' },
      { rodzaj: 'kabina', nazwa: 'Kabina dwumiejscowa', pewnosc: 'niska', zrodlo: TWZ_J36 + '; ' + ASPI_J36,
        opis: 'Kabina jest dwumiejscowa, z fotelami obok siebie, co w myśliwcach zdarza się rzadko. Owiewka jest mocno przyciemniona. Drugi członek załogi ma prawdopodobnie obsługiwać uzbrojenie i drony, ale to przypuszczenie.',
        wers: 'Za ciemną szybą siedzą dwie osoby, ramię w ramię. W myśliwcu prawie się to nie zdarza.' },
      { rodzaj: 'wloty', nazwa: 'Wloty: dwa boczne i grzbietowy', pewnosc: 'niska', zrodlo: ASPI_J36 + '; ' + TWZ_J36 + '; ' + RAPORT + ', sekcja J-36',
        opis: 'Pierwszy egzemplarz miał dwa boczne wloty typu caret pod krawędzią natarcia oraz trzeci wlot na grzbiecie, zasilający środkowy silnik. Wlotu grzbietowego nie ma dziś żaden myśliwiec w służbie. Według raportu od grudnia 2024 wloty zmieniano, a The War Zone opisuje w nowszych egzemplarzach wloty bez przegrody (DSI) we wszystkich trzech miejscach.',
        wers: 'Na grzbiecie, za kabiną, otwiera się trzecia paszcza. Żaden myśliwiec świata nie oddycha od góry — ten tak.' },
      { rodzaj: 'skrzydla', nazwa: 'Skrzydło: podwójna delta', pewnosc: 'bardzo-niska', zrodlo: ASPI_J36 + '; ' + RAPORT + ', sekcja J-36',
        opis: 'Płat ma obrys podwójnej delty z załamaniem krawędzi natarcia, a krawędź boczna kadłuba przechodzi bez przerwy w krawędź skrzydła. Według raportu rozpiętość szacuje się na 19–24 m zależnie od metody pomiaru. Ruchome panele krawędzi spływu przejmują zadania usterzenia, którego ta maszyna nie ma.',
        wers: 'Z góry to jeden wielki grot strzały. Jego skrzydła mierzono z cieni i każdy pomiar wyszedł inny.' },
      { rodzaj: 'dysze', nazwa: 'Trzy silniki i ich wyloty', pewnosc: 'bardzo-niska', zrodlo: ASPI_J36 + '; ' + TWZ_J36 + '; ' + RAPORT + ', sekcja J-36',
        opis: 'Trzy silniki leżą obok siebie z tyłu szerokiego kadłuba. W pierwszym egzemplarzu wyloty schowano w rynnie nad krawędzią spływu, podobnie jak w amerykańskim YF-23. Raport odnotowuje zmianę układu dysz, a The War Zone we wrześniu 2026 opisał przebudowę na płaskie dysze z wektorowaniem ciągu.',
        wers: 'Stoisz za maszyną i widzisz trzy ogniska zamiast dwóch. Trzy silniki, bo dwa nie rozpędziłyby tej masy.' },
      { rodzaj: 'komory', nazwa: 'Komory uzbrojenia', pewnosc: 'bardzo-niska', zrodlo: ASPI_J36 + '; ' + TWZ_J36_KOMORY,
        opis: 'Pod kadłubem jest duża komora centralna, szacowana na około 7,6 m długości, a po jej bokach dwie mniejsze. Analitycy przypuszczają, że boczne mieszczą pociski powietrze-powietrze, a centralna cięższe pociski odpalane z dystansu. Układ odczytano z otwartych drzwi widocznych na zdjęciach.',
        wers: 'Pod brzuchem kryje się schowek dłuższy niż samochód dostawczy. Co do niego wkładają, wiedzą tylko Chiny.' },
      { rodzaj: 'podwozie', nazwa: 'Podwozie', pewnosc: 'bardzo-niska', zrodlo: ASPI_J36 + '; ' + AVI_J36_2 + '; ' + RAPORT + ', sekcja J-36',
        opis: 'Pierwszy egzemplarz miał golenie główne z dwoma kołami jedno za drugim; według ASPI wskazuje to na dużą maszynę, bo pojedyncze koło nie wystarcza powyżej około 35 ton. W drugim prototypie z 2025 roku koła stoją obok siebie, co według analityków zwolniło miejsce w kadłubie. Według raportu masa startowa wynosi szacunkowo 50–55 t i więcej.',
        wers: 'Na każdej głównej nodze stoją dwa koła. Pojedyncze nie udźwignęłyby maszyny, która waży tyle, co pięćdziesiąt samochodów.' },
      { rodzaj: 'kadlub', nazwa: 'Kadłub — latający klin', pewnosc: 'bardzo-niska', zrodlo: RAPORT + ', sekcja J-36; ' + TWZ_J36,
        opis: 'Kadłub jest szerokim centropłatem bez usterzenia, w którym obok siebie leżą trzy silniki. Według raportu długość szacuje się na około 22,5 m, a wszystkie wymiary pochodzą z fotogrametrii. The War Zone widzi w jaśniejszych polach na grzbiecie możliwe anteny konforemne i zauważa, że jaśniejsze krawędzie natarcia i spływu w maszynach stealth często mieszczą dodatkowe anteny.',
        wers: 'Nie ma ogona, nie ma płetw, nic tu nie sterczy. Jest tylko klin, długi jak kort tenisowy.' },
    ]),

    'j-50': czesci('j-50', [
      { rodzaj: 'nos', nazwa: 'Nos', pewnosc: 'bardzo-niska', zrodlo: AVI_J50,
        opis: 'Nos jest ostry i płaski, przechodzi w krawędź boczną kadłuba. O radarze nic nie wiadomo. Opis wynika z nieoficjalnych zdjęć o niskiej rozdzielczości.',
        wers: 'Ten nos widziałeś tylko na rozmazanych zdjęciach. Co jest w środku, nie powiedział nikt.' },
      { rodzaj: 'kabina', nazwa: 'Kabina', pewnosc: 'bardzo-niska', zrodlo: BD_J50 + '; ' + TWZ_J50,
        opis: 'Kabina jest jednomiejscowa, z nisko osadzoną owiewką. Na pierwszych zdjęciach widać było tylko wybrzuszenie w miejscu kabiny, więc nie wykluczano maszyny bezzałogowej. Obserwatorzy uznają dziś, że ma pilota.',
        wers: 'Jest tu miejsce dla jednego człowieka. Przez długie tygodnie świat nie był pewien nawet tego.' },
      { rodzaj: 'wloty', nazwa: 'Wloty bez przegrody (DSI)', pewnosc: 'bardzo-niska', zrodlo: AVI_J50 + '; ' + BD_J50,
        opis: 'Dwa wloty bez przegrody (DSI) leżą po bokach kadłuba, każdy zasila jeden silnik. Wniosek pochodzi ze zdjęć z 2025 roku. Kształtu kanałów nie znamy.',
        wers: 'Po bokach ma dwa wloty z gładkimi garbami. Tylko tyle udało się z tych zdjęć wyczytać.' },
      { rodzaj: 'skrzydla', nazwa: 'Skrzydło lambda z ruchomymi końcówkami', pewnosc: 'bardzo-niska', zrodlo: TWZ_J50 + '; ' + RAPORT + ', sekcja J-50',
        opis: 'Płat ma obrys lambda: krawędź spływu załamuje się, tworząc kształt greckiej litery. Końcowe części skrzydeł obracają się w całości wokół osi i przejmują sterowanie, które zwykle dają stateczniki. Według raportu to rozwiązanie znane z bombowców stealth, a nie z myśliwców.',
        wers: 'Końcówka skrzydła obraca się cała, jak dłoń na nadgarstku. Ten samolot skręca palcami, bo nie ma ogona.' },
      { rodzaj: 'dysze', nazwa: 'Dysze', pewnosc: 'bardzo-niska', zrodlo: TWZ_J50 + '; ' + BD_J50,
        opis: 'Dwa silniki kończą się kanciastymi wylotami, które analitycy odczytują jako płaskie dysze z wektorowaniem ciągu, podobne do F-22. Wektorowanie pomagałoby zastąpić brakujące stateczniki. Ze zdjęć niskiej rozdzielczości nie da się tego rozstrzygnąć.',
        wers: 'Dwie płaskie szczeliny, z których bije ogień. Może skręcają strumień, a może tylko tak wyglądają z daleka.' },
      { rodzaj: 'komory', nazwa: 'Komory uzbrojenia', pewnosc: 'bardzo-niska', zrodlo: BD_J50,
        opis: 'Na zdjęciach z lotu widać pod kadłubem dwie oddzielne komory uzbrojenia. Analitycy spodziewają się dużej objętości wewnętrznej na paliwo i uzbrojenie. Rozmiaru komór nie da się oszacować.',
        wers: 'Pod brzuchem widać dwie linie drzwi. Co za nimi jest, wie tylko fabryka w Shenyang.' },
      { rodzaj: 'podwozie', nazwa: 'Podwozie z podwójnym kołem przednim', pewnosc: 'bardzo-niska', zrodlo: BD_J50 + '; ' + AVI_J50 + '; ' + RAPORT + ', sekcja J-50',
        opis: 'Według The Aviationist podwozie jest trójpodporowe, z podwójnym kołem przedniej goleni, które Breaking Defense nazywa wzmocnionym. Według analityka RUSI może to wskazywać na zadania pokładowe, z czym współgra raport, wiążący J-50 z lotniskowcami. Ten sam analityk zastrzega, że układ bezogonowy komplikowałby operacje z pokładu.',
        wers: 'Przednia noga ma dwa grube koła, jak u maszyn z lotniskowca. Może kiedyś usiądzie na pokładzie — może.' },
      { rodzaj: 'kadlub', nazwa: 'Kadłub', pewnosc: 'bardzo-niska', zrodlo: RAPORT + ', sekcja J-50; ' + BD_J50,
        opis: 'Kadłub jest bezogonowy, mniejszy od J-36, z dwoma silnikami. Według raportu wymiary około 18 × 14 m to szacunek bardzo zgrubny, a nawet oznaczenie J-50 nadali obserwatorzy. Chiny nie potwierdziły istnienia programu.',
        wers: 'Ten kadłub nie ma imienia. Ludzie z internetu nazwali go sami, bo Chiny milczą.' },
    ]),
  };

  var api = { PEWNOSC: PEWNOSC, RODZAJE: RODZAJE, WYMAGANE: WYMAGANE, CZESCI: CZESCI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MysliwceCzesci = api;
})(typeof window !== 'undefined' ? window : globalThis);
