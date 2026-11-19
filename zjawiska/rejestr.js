'use strict';
/* Rejestr zjawisk naukowych. Nowe zjawisko = jeden wpis tutaj + jeden plik `skrypt`
   (plik woła `Zjawiska.rejestruj(definicja)`; widok ładuje go leniwie przy pierwszym wyborze).
   Kod widoku (`zjawiska/widok.js`) nie wymaga zmian. */
(function (root) {
  var REJESTR = [
    {
      id: 'silnik-grawitacyjny',
      tytul: 'Kosmiczny silnik grawitacyjny',
      opis: 'Jak wirująca czarna dziura może oddać część energii swojego obrotu — i jak latem 2026 roku ten sam mechanizm odtworzono na laboratoryjnym stole, w pierścieniu wielkości monety.',
      skrypt: 'zjawiska/silnik-grawitacyjny.js'
    }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = REJESTR;
  else root.ZjawiskaRejestr = REJESTR;
})(typeof self !== 'undefined' ? self : this);
