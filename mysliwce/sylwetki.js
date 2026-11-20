'use strict';
/* Zakładka Myśliwce — sylwetki dziewięciu maszyn jako dane dla generatora mysliwce/platowiec.js (czyste dane, dual-export).
   Długość i rozpiętość NIE są tu zapisane — biorą się z MysliwceDane.mysliwiec(id).wymiary (jedno źródło); generator
   skaluje do nich obwiednię. Makieta to rekonstrukcja rozpoznawalna po sylwetce, nie rysunek techniczny.

   Jednostki:
   - u — położenie wzdłuż kadłuba: 0 = czubek nosa, 1 = koniec (ułamek długości dl); skrzydło, usterzenie i dysze
     mogą lekko wystawać poza zakres przekrojów.
   - długości, cięciwy, szerokości i wysokości kadłuba, położenia y i z elementów na kadłubie — ułamki dl;
   - eta — rozpiętość płatów (skrzydło, stery wysokości, kaczki, LEVCON) — ułamek półrozpiętości B = rozp/2 od osi;
   - kąty w stopniach: skos krawędzi natarcia (rzut z góry), dwuscian (wznios +), pochylenie statecznika od pionu.

   kadlub.przekroje: [u, szer, wys, grzbiet, brzuch, gora?, dol?] — przekrój ośmiokątny z krawędzią łączenia (chine):
     szer = pełna szerokość na krawędzi łączenia, wys = wysokość krawędzi nad osią, grzbiet = wysokość góry nad krawędzią,
     brzuch = głębokość spodu pod krawędzią, gora/dol = udział płaskiej góry/spodu w półszerokości (domyślnie 0.38/0.72).
   kadlub.nosDo — koniec osłony radaru (część `nos`); kadlub.gondole — rozstawione gondole silników (para).
   skrzydlo: ksztalt (opisowy), nasadaU (krawędź natarcia na osi), cieciwaNasady (na osi), cieciwaKonca, skosNatarcia,
     dwuscian, y, grubosc?, zalamanie? { eta, skosNatarcia } (podwójna delta), splyw? { eta, cieciwa } (lambda).
   usterzenie: { typ, statecznik?: { u, z, y, cieciwaNasady, cieciwaKonca, wysokosc, skos, pochylenie }, stery?: { u, z, y,
     cieciwaNasady, cieciwaKonca, eta, skos, dwuscian } }; kaczka?/levcon? jak `stery`; pletwyBrzuszne? jak `statecznik`.
   wloty: { typ, wloty: [{ u (krawędź wlotu), dlugosc, z (0 = na osi, inaczej para), y, szer, wys, dol (szerokość spodu
     względem góry), skosY (góra wysunięta naprzód), skosZ (zewnętrzna krawędź cofnięta), garb? { dl, wys } (DSI), tylY? (obniżenie końca obudowy) }] }
   dysze: { liczba, typ, rozstaw (odstęp osi sąsiednich dysz), u (wylot), dlugosc, szer, wys?, y, wejscie?, zabki?, rynna? }
   komory: { liczba, uklad: [{ u, dl, t0, t1, glebokosc } — w brzuchu: t = ułamek półszerokości płaskiego spodu
     (t0 = 0 → komora na osi z dwojgiem drzwi, t0 > 0 → para komór); { miejsce: 'skrzydlo', u, dl, z, szer } — drzwi
     pod nasadą skrzydła] }
   kabina: { u, dlugosc, szer, wys, szczyt? }; podwozie: { przeswit (ziemia pod osią), przod { u, kola }, glowne { u, z,
     kola, uklad } }; sensory?: [{ typ: 'eots'|'okno'|'kula'|'antena', u, miejsce: 'pod'|'nad'|'bok', z?, r }]
   dodatki?: [{ typ, czesc, … }] — 'ruchome-koncowki' (skrzydla: eta, kat), 'grzbiet' (kadlub: od, do, szer, wys, profil),
     czujnik ('kula' itd., czesc: 'sensory'); `asymetryczne: true` = bez lustra (jedyne odstępstwo od symetrii).
   rozlozenie? — nadpisanie wektorów widoku rozstrzelonego [m dla maszyny 18 m]. */
(function (root) {
  var SYLWETKI = {
    // F-22A: skrzydło romboidalne (natarcie 42°, spływ odwrotnie skośny), wloty caret, stateczniki skośne, płaskie dysze 2D.
    'f-22a': {
      kadlub: {
        przekroje: [
          [0, 0, 0, 0, 0], [0.04, 0.026, -0.002, 0.0149, 0.0149], [0.1, 0.058, 0, 0.0351, 0.0324],
          [0.17, 0.08, 0, 0.05, 0.0432], [0.25, 0.098, 0, 0.054, 0.054], [0.31, 0.17, 0, 0.0567, 0.0567, 0.45],
          [0.45, 0.19, 0, 0.0513, 0.054, 0.55, 0.8], [0.65, 0.19, 0, 0.0405, 0.05, 0.55, 0.8], [0.8, 0.16, 0, 0.0351, 0.0432, 0.5],
          [0.9, 0.135, 0, 0.027, 0.0297, 0.5], [0.93, 0.128, 0, 0.0243, 0.027, 0.5],
        ],
        nosDo: 0.1,
      },
      skrzydlo: { ksztalt: 'romb', nasadaU: 0.4, cieciwaNasady: 0.507, cieciwaKonca: 0.074, skosNatarcia: 42, dwuscian: -3, y: 0 },
      usterzenie: {
        typ: 'skosne-podwojne',
        statecznik: { u: 0.66, z: 0.072, y: 0.025, cieciwaNasady: 0.2, cieciwaKonca: 0.075, wysokosc: 0.14, skos: 30, pochylenie: 28 },
        stery: { u: 0.81, z: 0.075, y: -0.005, cieciwaNasady: 0.16, cieciwaKonca: 0.045, eta: 0.65, skos: 42, dwuscian: 0 },
      },
      wloty: { typ: 'caret', wloty: [{ u: 0.27, dlugosc: 0.12, z: 0.066, y: -0.005, szer: 0.048, wys: 0.058, dol: 0.85, skosY: 25, skosZ: 40 }] },
      dysze: { liczba: 2, typ: '2D-TVC', rozstaw: 0.0655, u: 0.955, dlugosc: 0.07, szer: 0.055, wys: 0.033, y: 0 },
      komory: { liczba: 3, uklad: [{ u: 0.42, dl: 0.2, t0: 0, t1: 0.75, glebokosc: 0.04 }, { u: 0.31, dl: 0.07, t0: 0.8, t1: 0.97, glebokosc: 0.03 }] },
      kabina: { u: 0.1, dlugosc: 0.17, szer: 0.052, wys: 0.042 },
      podwozie: { przeswit: 0.095, przod: { u: 0.2, kola: 1 }, glowne: { u: 0.58, z: 0.085, kola: 1 } },
      sensory: [{ typ: 'okno', u: 0.2, miejsce: 'bok', r: 0.006 }, { typ: 'antena', u: 0.55, miejsce: 'nad', r: 0.01 }],
    },

    // F-35A: jeden silnik i okrągła dysza z ząbkami, wloty DSI z garbem, szeroki kadłub, skrzydło trapezowe.
    'f-35a': {
      kadlub: {
        przekroje: [
          [0, 0, 0, 0, 0], [0.04, 0.035, 0, 0.015, 0.015], [0.1, 0.075, 0, 0.0375, 0.035], [0.18, 0.11, 0, 0.0562, 0.05],
          [0.27, 0.16, 0, 0.0625, 0.0625], [0.34, 0.26, 0, 0.066, 0.0675, 0.45], [0.45, 0.28, 0.004, 0.07, 0.069, 0.5, 0.8],
          [0.62, 0.26, 0, 0.06, 0.0625, 0.5, 0.8], [0.78, 0.2, 0, 0.045, 0.05], [0.9, 0.13, 0, 0.0375, 0.0375], [0.94, 0.1, 0, 0.035, 0.035],
        ],
        nosDo: 0.1,
      },
      skrzydlo: { ksztalt: 'trapez', nasadaU: 0.4, cieciwaNasady: 0.4, cieciwaKonca: 0.086, skosNatarcia: 34, dwuscian: -2, y: 0 },
      usterzenie: {
        typ: 'skosne-podwojne',
        statecznik: { u: 0.64, z: 0.08, y: 0.035, cieciwaNasady: 0.17, cieciwaKonca: 0.06, wysokosc: 0.14, skos: 40, pochylenie: 20 },
        stery: { u: 0.78, z: 0.075, y: 0, cieciwaNasady: 0.17, cieciwaKonca: 0.05, eta: 0.63, skos: 34, dwuscian: 0 },
      },
      wloty: { typ: 'DSI', wloty: [{ u: 0.3, dlugosc: 0.1, z: 0.11, y: 0, szer: 0.045, wys: 0.07, dol: 0.7, skosY: -10, skosZ: 25, garb: { dl: 0.07, wys: 0.018 } }] },
      dysze: { liczba: 1, typ: 'okragla', rozstaw: 0, u: 0.99, dlugosc: 0.08, szer: 0.075, y: 0, zabki: 15 },
      komory: { liczba: 2, uklad: [{ u: 0.4, dl: 0.21, t0: 0.08, t1: 0.9, glebokosc: 0.05 }] },
      kabina: { u: 0.1, dlugosc: 0.21, szer: 0.065, wys: 0.05 },
      podwozie: { przeswit: 0.11, przod: { u: 0.17, kola: 1 }, glowne: { u: 0.57, z: 0.105, kola: 1 } },
      sensory: [
        { typ: 'eots', u: 0.1, miejsce: 'pod', r: 0.012 }, { typ: 'okno', u: 0.16, miejsce: 'bok', r: 0.006 },
        { typ: 'okno', u: 0.24, miejsce: 'nad', r: 0.006 }, { typ: 'okno', u: 0.45, miejsce: 'pod', r: 0.006 },
        { typ: 'okno', u: 0.5, miejsce: 'bok', r: 0.006 },
      ],
    },

    // F-47: tylko to, co pokazała grafika USAF — bezogonowy, małe kaczki przy kabinie, skrzydła ze wzniosem, łopatowy nos.
    // Wlotów i dysz grafika nie pokazuje: wloty ukryte pod kadłubem, wyloty schowane w rynnach (interpretacja).
    'f-47': {
      kadlub: {
        przekroje: [
          [0, 0, 0, 0, 0], [0.04, 0.09, 0, 0.012, 0.0096, 0.5, 0.8], [0.1, 0.12, 0, 0.0264, 0.024, 0.45, 0.8], [0.2, 0.14, 0, 0.054, 0.042],
          [0.35, 0.2, 0, 0.054, 0.054, 0.5], [0.55, 0.24, 0, 0.048, 0.054, 0.55, 0.8], [0.75, 0.2, 0, 0.036, 0.042, 0.55],
          [0.92, 0.14, 0, 0.0144, 0.024, 0.5], [1, 0.1, 0, 0.0096, 0.018, 0.5],
        ],
        nosDo: 0.1,
      },
      skrzydlo: { ksztalt: 'delta', nasadaU: 0.32, cieciwaNasady: 0.58, cieciwaKonca: 0.085, skosNatarcia: 47, dwuscian: 8, y: 0 },
      usterzenie: { typ: 'brak' },
      kaczka: { u: 0.22, z: 0.05, y: 0.015, cieciwaNasady: 0.07, cieciwaKonca: 0.03, eta: 0.38, skos: 45, dwuscian: 15 },
      wloty: { typ: 'podkadlubowe', wloty: [{ u: 0.3, dlugosc: 0.1, z: 0.06, y: -0.035, szer: 0.035, wys: 0.03, skosY: -30, skosZ: 30 }] },
      dysze: { liczba: 2, typ: 'rynna', rozstaw: 0.07, u: 0.9, dlugosc: 0.06, szer: 0.06, wys: 0.018, y: 0.012, rynna: 0.07 },
      komory: { liczba: 1, uklad: [{ u: 0.38, dl: 0.2, t0: 0, t1: 0.7, glebokosc: 0.04 }] },
      kabina: { u: 0.11, dlugosc: 0.15, szer: 0.05, wys: 0.03 },
      podwozie: { przeswit: 0.1, przod: { u: 0.2, kola: 1 }, glowne: { u: 0.56, z: 0.085, kola: 1 } },
    },

    // Su-57: wloty pod kadłubem, szeroko rozstawione gondole z tunelem komór, ruchome LEVCON, małe całkowicie ruchome
    // stateczniki, okrągłe dysze 3D-TVC; kula IRST przed owiewką po prawej (jedyny element asymetryczny).
    'su-57': {
      kadlub: {
        przekroje: [
          [0, 0, 0, 0, 0], [0.04, 0.03, -0.003, 0.0132, 0.0132], [0.1, 0.06, -0.005, 0.0308, 0.0286], [0.18, 0.085, 0, 0.044, 0.0385],
          [0.28, 0.14, 0, 0.044, 0.033, 0.4, 0.5], [0.4, 0.17, 0, 0.0385, 0.0165, 0.45, 0.45], [0.55, 0.21, 0, 0.0352, 0.0165, 0.5, 0.38],
          [0.75, 0.19, 0, 0.0308, 0.0165, 0.5, 0.4], [0.9, 0.1, 0, 0.0242, 0.0165, 0.5, 0.6], [1, 0.035, 0, 0.0132, 0.011],
        ],
        nosDo: 0.1,
        gondole: { z: 0.075, y: -0.025, szer: 0.062, wys: 0.055, od: 0.4, do: 0.9 },
      },
      skrzydlo: { ksztalt: 'trapez', nasadaU: 0.32, cieciwaNasady: 0.54, cieciwaKonca: 0.085, skosNatarcia: 48, dwuscian: -2, y: 0 },
      levcon: { u: 0.22, z: 0.06, y: 0.004, cieciwaNasady: 0.2, cieciwaKonca: 0.03, eta: 0.37, skos: 60, dwuscian: 0, grubosc: 0.03 },
      usterzenie: {
        typ: 'skosne-podwojne',
        statecznik: { u: 0.72, z: 0.09, y: 0.02, cieciwaNasady: 0.15, cieciwaKonca: 0.07, wysokosc: 0.11, skos: 40, pochylenie: 26 },
        stery: { u: 0.8, z: 0.1, y: 0, cieciwaNasady: 0.14, cieciwaKonca: 0.05, eta: 0.58, skos: 45, dwuscian: 0 },
      },
      wloty: { typ: 'podkadlubowe', wloty: [{ u: 0.3, dlugosc: 0.1, z: 0.075, y: -0.03, szer: 0.06, wys: 0.045, skosY: 15, skosZ: 10 }] },
      dysze: { liczba: 2, typ: '3D-TVC', rozstaw: 0.15, u: 0.955, dlugosc: 0.07, szer: 0.052, y: -0.025 },
      komory: {
        liczba: 4,
        uklad: [
          { u: 0.38, dl: 0.22, t0: 0, t1: 0.8, glebokosc: 0.035 }, { u: 0.6, dl: 0.22, t0: 0, t1: 0.8, glebokosc: 0.035 },
          { miejsce: 'skrzydlo', u: 0.44, dl: 0.08, z: 0.115, szer: 0.025 },
        ],
      },
      kabina: { u: 0.1, dlugosc: 0.19, szer: 0.045, wys: 0.035 },
      podwozie: { przeswit: 0.085, przod: { u: 0.2, kola: 1 }, glowne: { u: 0.55, z: 0.075, kola: 1 } },
      sensory: [{ typ: 'kula', u: 0.3, miejsce: 'nad', r: 0.006 }, { typ: 'kula', u: 0.16, miejsce: 'pod', r: 0.006 }],
      dodatki: [{ typ: 'kula', czesc: 'sensory', asymetryczne: true, u: 0.095, miejsce: 'nad', z: 0.008, r: 0.008 }],
    },

    // Su-75: jeden silnik, wlot pod nosem w kształcie kanciastego U, usterzenie motylkowe (V), duże skrzydło.
    'su-75': {
      kadlub: {
        przekroje: [
          [0, 0, 0, 0, 0], [0.05, 0.04, 0.005, 0.0161, 0.0138], [0.12, 0.075, 0.008, 0.0345, 0.023], [0.2, 0.1, 0.01, 0.046, 0.0287],
          [0.3, 0.16, 0.005, 0.046, 0.069], [0.45, 0.2, 0, 0.0403, 0.0633, 0.5], [0.65, 0.19, 0, 0.0368, 0.0575, 0.5], [0.82, 0.13, 0, 0.0345, 0.046],
          [0.92, 0.085, 0, 0.0322, 0.0345], [0.95, 0.075, 0, 0.0299, 0.0322],
        ],
        nosDo: 0.1,
      },
      skrzydlo: { ksztalt: 'trapez', nasadaU: 0.36, cieciwaNasady: 0.42, cieciwaKonca: 0.07, skosNatarcia: 42, dwuscian: -2, y: 0 },
      usterzenie: {
        typ: 'V',
        statecznik: { u: 0.7, z: 0.045, y: 0.025, cieciwaNasady: 0.18, cieciwaKonca: 0.07, wysokosc: 0.16, skos: 42, pochylenie: 45 },
      },
      wloty: { typ: 'podnosowy', wloty: [{ u: 0.19, dlugosc: 0.14, z: 0, y: -0.045, szer: 0.09, wys: 0.05, dol: 0.6, skosY: -25, skosZ: 20 }] },
      dysze: { liczba: 1, typ: 'okragla', rozstaw: 0, u: 0.99, dlugosc: 0.08, szer: 0.068, y: 0 },
      komory: { liczba: 1, uklad: [{ u: 0.4, dl: 0.2, t0: 0, t1: 0.8, glebokosc: 0.04 }] },
      kabina: { u: 0.11, dlugosc: 0.16, szer: 0.055, wys: 0.04 },
      podwozie: { przeswit: 0.1, przod: { u: 0.34, kola: 1 }, glowne: { u: 0.6, z: 0.1, kola: 1 } },
    },

    // J-20A: długi kadłub, kaczki ze wzniosem tuż za wlotami DSI, skrzydło delta, stateczniki skośne i płetwy brzuszne.
    'j-20a': {
      kadlub: {
        przekroje: [
          [0, 0, 0, 0, 0], [0.04, 0.028, -0.004, 0.0149, 0.0135], [0.1, 0.052, -0.004, 0.0351, 0.027], [0.17, 0.072, 0, 0.0486, 0.0378],
          [0.25, 0.085, 0, 0.0513, 0.0405], [0.32, 0.16, 0, 0.0486, 0.0473, 0.45], [0.5, 0.17, 0, 0.0405, 0.0473, 0.5, 0.85],
          [0.7, 0.15, 0, 0.0378, 0.0432, 0.5, 0.85], [0.85, 0.12, 0, 0.0351, 0.0378, 0.5], [0.95, 0.1, 0, 0.0324, 0.0324, 0.5],
        ],
        nosDo: 0.09,
      },
      skrzydlo: { ksztalt: 'delta', nasadaU: 0.44, cieciwaNasady: 0.49, cieciwaKonca: 0.05, skosNatarcia: 48, dwuscian: -2, y: 0 },
      kaczka: { u: 0.34, z: 0.055, y: 0.008, cieciwaNasady: 0.1, cieciwaKonca: 0.035, eta: 0.52, skos: 48, dwuscian: 12 },
      usterzenie: {
        typ: 'skosne-podwojne',
        statecznik: { u: 0.74, z: 0.055, y: 0.02, cieciwaNasady: 0.15, cieciwaKonca: 0.06, wysokosc: 0.12, skos: 48, pochylenie: 18 },
      },
      pletwyBrzuszne: { u: 0.8, z: 0.045, y: -0.025, cieciwaNasady: 0.085, cieciwaKonca: 0.04, wysokosc: 0.045, skos: 50, pochylenie: 30 },
      wloty: { typ: 'DSI', wloty: [{ u: 0.27, dlugosc: 0.1, z: 0.065, y: -0.002, szer: 0.032, wys: 0.05, dol: 0.75, skosY: 20, skosZ: 30, garb: { dl: 0.06, wys: 0.012 } }] },
      dysze: { liczba: 2, typ: 'okragla', rozstaw: 0.066, u: 0.985, dlugosc: 0.07, szer: 0.048, y: 0, zabki: 12 },
      komory: { liczba: 3, uklad: [{ u: 0.4, dl: 0.2, t0: 0, t1: 0.75, glebokosc: 0.04 }, { u: 0.3, dl: 0.07, t0: 0.8, t1: 0.98, glebokosc: 0.03 }] },
      kabina: { u: 0.09, dlugosc: 0.18, szer: 0.045, wys: 0.038 },
      podwozie: { przeswit: 0.085, przod: { u: 0.2, kola: 1 }, glowne: { u: 0.55, z: 0.07, kola: 1 } },
      sensory: [{ typ: 'eots', u: 0.09, miejsce: 'pod', r: 0.01 }, { typ: 'okno', u: 0.14, miejsce: 'bok', r: 0.005 }, { typ: 'okno', u: 0.28, miejsce: 'nad', r: 0.005 }],
    },

    // J-35A: dwusilnikowy „mniejszy J-20 bez kaczki”, podobny do F-35 w skali: wloty DSI, trapez, dwie ząbkowane dysze.
    'j-35a': {
      kadlub: {
        przekroje: [
          [0, 0, 0, 0, 0], [0.04, 0.032, 0, 0.015, 0.015], [0.1, 0.068, 0, 0.035, 0.0312], [0.18, 0.095, 0, 0.05, 0.0438],
          [0.27, 0.12, 0, 0.0562, 0.0525], [0.34, 0.19, 0, 0.0525, 0.0562, 0.45], [0.5, 0.2, 0, 0.05, 0.0562, 0.5, 0.8],
          [0.68, 0.18, 0, 0.0438, 0.05, 0.5], [0.85, 0.14, 0, 0.0375, 0.04, 0.5], [0.95, 0.11, 0, 0.035, 0.035, 0.5],
        ],
        nosDo: 0.1,
      },
      skrzydlo: { ksztalt: 'trapez', nasadaU: 0.4, cieciwaNasady: 0.4, cieciwaKonca: 0.075, skosNatarcia: 40, dwuscian: -2, y: 0 },
      usterzenie: {
        typ: 'skosne-podwojne',
        statecznik: { u: 0.64, z: 0.062, y: 0.03, cieciwaNasady: 0.17, cieciwaKonca: 0.06, wysokosc: 0.13, skos: 42, pochylenie: 22 },
        stery: { u: 0.79, z: 0.06, y: 0, cieciwaNasady: 0.16, cieciwaKonca: 0.05, eta: 0.6, skos: 40, dwuscian: 0 },
      },
      wloty: { typ: 'DSI', wloty: [{ u: 0.29, dlugosc: 0.1, z: 0.078, y: 0, szer: 0.04, wys: 0.06, dol: 0.7, skosY: -5, skosZ: 25, garb: { dl: 0.06, wys: 0.016 } }] },
      dysze: { liczba: 2, typ: 'okragla', rozstaw: 0.068, u: 0.985, dlugosc: 0.07, szer: 0.05, y: 0, zabki: 12 },
      komory: { liczba: 1, uklad: [{ u: 0.4, dl: 0.22, t0: 0, t1: 0.8, glebokosc: 0.045 }] },
      kabina: { u: 0.1, dlugosc: 0.18, szer: 0.055, wys: 0.042 },
      podwozie: { przeswit: 0.1, przod: { u: 0.18, kola: 1 }, glowne: { u: 0.58, z: 0.09, kola: 1 } },
      sensory: [{ typ: 'eots', u: 0.1, miejsce: 'pod', r: 0.011 }, { typ: 'okno', u: 0.17, miejsce: 'bok', r: 0.006 }, { typ: 'okno', u: 0.26, miejsce: 'nad', r: 0.006 }],
    },

    // J-36: bezogonowy latający klin, podwójna delta wychodząca z krawędzi kadłuba, trzy silniki z wylotami w rynnie,
    // wlot grzbietowy + dwa boczne, szeroka kabina dwumiejscowa obok siebie (stan pierwszego egzemplarza).
    'j-36': {
      kadlub: {
        przekroje: [
          [0, 0, 0, 0, 0], [0.04, 0.04, 0, 0.011, 0.0088, 0.5, 0.8], [0.1, 0.085, 0, 0.0242, 0.0176, 0.5, 0.8], [0.17, 0.12, 0, 0.0385, 0.0242, 0.5],
          [0.28, 0.17, 0, 0.0385, 0.0286, 0.55], [0.4, 0.24, 0, 0.0418, 0.033, 0.6, 0.85], [0.6, 0.26, 0, 0.0396, 0.033, 0.6, 0.85],
          [0.8, 0.24, 0, 0.033, 0.0286, 0.6, 0.85], [0.85, 0.22, 0, 0.024, 0.024, 0.6], [0.9, 0.2, 0, 0.004, 0.02, 0.6], [0.97, 0.18, 0, 0.002, 0.016, 0.6],
        ],
        nosDo: 0.1,
      },
      skrzydlo: { ksztalt: 'podwojna-delta', nasadaU: 0.1, cieciwaNasady: 0.9, cieciwaKonca: 0.065, skosNatarcia: 70, dwuscian: 0, y: 0, grubosc: 0.035, zalamanie: { eta: 0.28, skosNatarcia: 48 } },
      usterzenie: { typ: 'brak' },
      wloty: {
        typ: 'grzbietowy+boczne',
        wloty: [
          { u: 0.34, dlugosc: 0.12, z: 0, y: 0.04, szer: 0.07, wys: 0.022, dol: 1.3, skosY: 30, skosZ: 25, tylY: -0.03 },
          { u: 0.36, dlugosc: 0.1, z: 0.11, y: -0.02, szer: 0.045, wys: 0.03, skosY: 20, skosZ: 35 },
        ],
      },
      dysze: { liczba: 3, typ: 'rynna', rozstaw: 0.06, u: 0.9, dlugosc: 0.07, szer: 0.052, wys: 0.018, y: 0.012, rynna: 0.08 },
      komory: { liczba: 3, uklad: [{ u: 0.4, dl: 0.34, t0: 0, t1: 0.5, glebokosc: 0.035 }, { u: 0.45, dl: 0.16, t0: 0.6, t1: 0.9, glebokosc: 0.03 }] },
      kabina: { u: 0.11, dlugosc: 0.15, szer: 0.09, wys: 0.032 },
      podwozie: { przeswit: 0.085, przod: { u: 0.22, kola: 1 }, glowne: { u: 0.56, z: 0.08, kola: 2, uklad: 'tandem' } },
      dodatki: [{ typ: 'grzbiet', czesc: 'kadlub', od: 0.22, do: 0.4, szer: 0.06, wys: 0.012, profil: [[0, 0], [0.5, 0.6], [1, 1]] }],
    },

    // J-50: bezogonowy, skrzydło lambda z ruchomymi końcówkami, ostry płaski nos, wloty DSI, płaskie dysze.
    'j-50': {
      kadlub: {
        przekroje: [
          [0, 0, 0, 0, 0], [0.05, 0.05, 0, 0.0115, 0.0103, 0.45, 0.8], [0.12, 0.09, 0, 0.0253, 0.0207, 0.45], [0.2, 0.12, 0, 0.0368, 0.0276],
          [0.32, 0.17, 0, 0.0403, 0.0345, 0.5], [0.5, 0.2, 0, 0.0403, 0.0368, 0.55, 0.8], [0.7, 0.18, 0, 0.0345, 0.0345, 0.55],
          [0.85, 0.14, 0, 0.0287, 0.0299, 0.5], [0.93, 0.11, 0, 0.0253, 0.0253, 0.5],
        ],
        nosDo: 0.1,
      },
      skrzydlo: { ksztalt: 'lambda', nasadaU: 0.3, cieciwaNasady: 0.7, cieciwaKonca: 0.072, skosNatarcia: 48, dwuscian: 0, y: 0, splyw: { eta: 0.55, cieciwa: 0.1625 } },
      usterzenie: { typ: 'brak' },
      wloty: { typ: 'DSI', wloty: [{ u: 0.3, dlugosc: 0.1, z: 0.075, y: -0.005, szer: 0.035, wys: 0.045, dol: 0.75, skosY: 10, skosZ: 30, garb: { dl: 0.05, wys: 0.012 } }] },
      dysze: { liczba: 2, typ: '2D-TVC', rozstaw: 0.07, u: 0.96, dlugosc: 0.07, szer: 0.055, wys: 0.03, y: 0 },
      komory: { liczba: 2, uklad: [{ u: 0.38, dl: 0.16, t0: 0.1, t1: 0.85, glebokosc: 0.04 }] },
      kabina: { u: 0.12, dlugosc: 0.14, szer: 0.05, wys: 0.025 },
      podwozie: { przeswit: 0.09, przod: { u: 0.2, kola: 2 }, glowne: { u: 0.56, z: 0.085, kola: 1 } },
      dodatki: [{ typ: 'ruchome-koncowki', czesc: 'skrzydla', eta: 0.8, kat: 20 }],
    },
  };

  var api = { SYLWETKI: SYLWETKI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MysliwceSylwetki = api;
})(typeof window !== 'undefined' ? window : globalThis);
