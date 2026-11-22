'use strict';
/* Zakładka Myśliwce — silniki jednej maszyny: bezwładność ciągu, płomienie (mysliwce/ogien.js), jedno światło zbiorcze,
   przekazywanie ciągu do dźwięku (mysliwce/dzwiek.js). Wspólne dla makiety (widok.js) i pokazu (Task 8).
   Czyste (dual-export, testy w node): Silniki.krokCiagu(biez, cel, dt) → nowy ciąg (wirnik: +0,55/s w górę, −0,4/s
     w dół, bez przestrzelenia celu), Silniki.czasDojscia(z, do) [s].
   Przeglądarkowe: Silniki.utworz(THREE, { scena?, wyloty, rodzic, dzwiek?, jakosc?, dzien?, hologram? }) → { ustaw(cel, odRazu?), krok(dt, t),
     zrodlaGoraca(), dzwiek(silnikDzwieku|null), jakosc('pelna'|'lekka'), stan() → { ciag, cel, strugi }, zwolnij() }.
     `rodzic` = część `dysze` makiety (płomień i światło rozkładają się z nią; bez rodzica — `scena`); `dzien` = płomień na
   dziennym niebie pokazu (mieszanie nad tłem, Ogien.TRYBY.dzien); `hologram` = płomień maszyny niesfotografowanej
   (Ogien.TRYBY.hologram, flaga z makiety: Makieta.zbuduj(…).niesfotografowany).
   Płomień (jedno pudło na wszystkie wyloty) powstaje leniwie przy pierwszym celu > 0. Światło punktowe jest JEDNO na maszynę
   i istnieje od utworzenia (moc 0, gdy silniki stoją): liczba świateł jest częścią klucza programu cieniowania, więc
   włączenie dopalacza niczego nie przekompilowuje, a materiały żyjące dłużej niż makieta (posadzka) nie zbierają wariantów.
   Światło stoi w średniej wylotów, 0,9 średnicy równoważnej za dyszami, moc = suma strug (Ogien.moc()). */
(function (root) {
  var W_GORE = 0.55, W_DOL = 0.4;   // [1/s] rozkręcanie i zwalnianie wirnika (pełny dopalacz → stop ≈ 2,5 s)

  function krokCiagu(biez, cel, dt) {
    if (!(dt > 0) || biez === cel) return biez;
    return cel > biez ? Math.min(cel, biez + dt * W_GORE) : Math.max(cel, biez - dt * W_DOL);
  }
  function czasDojscia(z, doC) { return doC >= z ? (doC - z) / W_GORE : (z - doC) / W_DOL; }

  function utworz(T, o) {
    var O = root.Ogien, wyloty = (o.wyloty || []).slice(0, O.MAKS_STRUG), rodzic = o.rodzic || o.scena;
    var cel = 0, biez = 0, ogien = null, dzwiek = o.dzwiek || null, jakosc = o.jakosc || 'pelna', dzien = !!o.dzien, hologram = !!o.hologram;
    var swiatlo = null;
    if (wyloty.length && rodzic) {
      var wym = O.wymiary(wyloty[0], 1), sr = new T.Vector3(), kier = new T.Vector3().fromArray(wyloty[0].kierunek).normalize();
      wyloty.forEach(function (w) { sr.add(new T.Vector3().fromArray(w.punkt)); });
      sr.multiplyScalar(1 / wyloty.length).addScaledVector(kier, 0.9 * wym.deq);
      swiatlo = new T.PointLight(0xff8a3a, 0, Math.max(5, wym.dlMax * 1.3), 2);
      swiatlo.name = 'silniki:swiatlo'; swiatlo.position.copy(sr);
      rodzic.add(swiatlo);
    }
    function zastosuj() {
      if ((biez > 0 || cel > 0) && !ogien && wyloty.length && rodzic) ogien = O.utworz(T, wyloty, rodzic, { jakosc: jakosc, dzien: dzien, hologram: hologram });
      if (ogien) ogien.ustaw(biez);
      doDzwieku();
      swiatelko();
    }
    function doDzwieku() { if (dzwiek) { dzwiek.turbina(biez); dzwiek.dopalacz(biez); } }
    // Silniki puszczające dźwięk (zwolnienie, odpięcie, podmiana) zostawiają go z ciągiem 0. Dzwiek widoku żyje dłużej
    // niż silniki: pokaz → makieta (nowe silniki stoją, ciągu nie wysyłają), pokaz/makieta → hangar (bez silników),
    // wyciszenie M i włączenie w hangarze — bez tego grał ostatni ciąg poprzedniego właściciela.
    function pusc(d) { if (d) { d.turbina(0); d.dopalacz(0); } }
    function swiatelko() {
      if (!swiatlo) return;
      var m = ogien ? ogien.moc() : { moc: 0, kolor: [1, 0.5, 0.2] };
      swiatlo.intensity = m.moc; swiatlo.color.setRGB(m.kolor[0], m.kolor[1], m.kolor[2]);
    }
    return {
      // cel ciągu 0..1; odRazu — bez bezwładności (smoke, kadry testowe)
      ustaw: function (c, odRazu) {
        cel = Math.max(0, Math.min(1, +c || 0));
        if (odRazu) { biez = cel; zastosuj(); }
        else if (cel > 0 && !ogien) zastosuj();          // płomień budowany od razu przy włączeniu (pierwszy kadr bez przycięcia)
      },
      krok: function (dt, t) {
        if (biez !== cel) { biez = krokCiagu(biez, cel, dt); zastosuj(); }
        if (ogien) { ogien.animuj(t); swiatelko(); }
      },
      dzwiek: function (d) { d = d || null; if (dzwiek !== d) pusc(dzwiek); dzwiek = d; doDzwieku(); },
      jakosc: function (j) { jakosc = j; if (ogien) ogien.jakosc(j); },
      zrodlaGoraca: function () { return ogien ? ogien.zrodlaGoraca() : []; },
      stan: function () { return { ciag: biez, cel: cel, strugi: ogien ? ogien.strugi : 0 }; },
      zwolnij: function () {
        if (ogien) { ogien.zwolnij(); ogien = null; }
        if (swiatlo && swiatlo.parent) swiatlo.parent.remove(swiatlo);
        if (swiatlo && swiatlo.dispose) swiatlo.dispose();
        swiatlo = null; pusc(dzwiek); dzwiek = null;
      },
    };
  }

  var Silniki = { krokCiagu: krokCiagu, czasDojscia: czasDojscia, utworz: utworz, W_GORE: W_GORE, W_DOL: W_DOL };
  if (typeof module !== 'undefined' && module.exports) module.exports = Silniki;
  else root.Silniki = Silniki;
})(typeof window !== 'undefined' ? window : globalThis);
