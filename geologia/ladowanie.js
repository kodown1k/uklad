'use strict';
/* Zakładka Geologia — wejście w moduł: rejestracja w zakladki.js i leniwe dociąganie reszty plików przy pierwszym
   otwarciu (anty-cel: moduł nie spowalnia startu Układu). Jedyny plik modułu ładowany ze strony (za kino.js i
   mysliwce/ladowanie.js). Czysta część (dual-export, testy w node): ROZDZIALY, PLIKI, parsujHashGeologii,
   parsujZapytanieGeologii.

   Adresy:  #geologia | #geologia=<miejsce>[&rozdzial=<id>][&tryb=pokaz|makieta[&warstwa=<lista>]] → {miejsce, tryb, rozdzial[, warstwa]}
            (domyślnie pokaz, rozdział `polozenie`; makieta = bez rozdziału; `warstwa` tylko w makiecie: lista po przecinku
            z WARSTWY — `turystyka`, `wulkany`, `turystyka,wulkany`; nieznane pozycje odrzucane, kolejność jak WARSTWY, bez powtórzeń;
            pusta po odrzuceniu → bez pola);
            #geologia=<nieznane> → miejsce domyślne + pole `nieznane`. Obcy hash → null.
   Zapytanie: ?geologia = przycisk zakładki widoczny (do czasu gotowości jest ukryty); hak testowy
            ?smoke&geologia=<miejsce>[&rozdzial=<id>|&makieta|&tryb=makieta][&t=0..1][&czas=<Ma>][&przekroj=<°>[&przesuniecie=<km>]][&geologiczna]
            [&jakosc=pelna][&kontrola=biel|czern][&anim=a1..a5&f=0..1][&warstwa=<lista>][&widok=poludnie|polnoc|gora]
            (marker GEOLOGIA_READY <miejsce> <rozdzial|makieta>). `&makieta` = `&tryb=makieta`;
            `&warstwa=turystyka` = warstwa turystyczna makiety (Task 7b), `&warstwa=wulkany` = warstwa wulkanów (Task 8c),
            obie naraz `&warstwa=turystyka,wulkany`; `&widok` = kadr z przycisków kompasu;
            `&czas` = chwila geologiczna [mln lat] w makiecie; `&anim` + `&f` = animacja A1–A5 w kadrze ujęcia (f przycięte do 0..1, bez f → 1);
            `&przesuniecie` = linia przekroju przesunięta o km od Teide;
            `&geologiczna` = makieta w barwach jednostek; `&jakosc=pelna` = bez przejścia na lżejszą jakość przy niskim fps (G-L).
            Hash i hak działają też bez ?geologia.
   Krzywe (ruling G-C): mysliwce/kino.js nadpisuje window.Kino — dlatego krzywe filmów Układu zapamiętujemy raz,
   przy wczytaniu tego pliku (jest za korzeniowym kino.js), i nigdy więcej nie czytamy window.Kino. */
(function (root) {
  var MIEJSCA_ID = ['teneryfa'];               // ta sama lista co GeologiaMiejsca.MIEJSCA (test pilnuje)
  var TRYBY = ['pokaz', 'makieta'];
  var ROZDZIALY = [
    { id: 'polozenie', etykieta: 'Położenie' }, { id: 'geografia', etykieta: 'Geografia' },
    { id: 'budowa', etykieta: 'Budowa' }, { id: 'powstanie', etykieta: 'Powstanie' },
    { id: 'historia', etykieta: 'Historia' }, { id: 'przekroj', etykieta: 'Przekrój' },
    { id: 'czesci', etykieta: 'Części' }, { id: 'mity', etykieta: 'Fakty i mity' },
    { id: 'dzis', etykieta: 'Wyspa dziś' }
  ];
  // Kolejność leniwego ładowania: tylko pliki, które istnieją. Kolejne zadania dopisują swoje PRZED widok.js —
  // widok.js jest ostatni, bo korzysta z reszty. Pliki konkretnego miejsca: GeologiaMiejsca.MIEJSCA[].pliki.
  var PLIKI = ['geologia/miejsca.js', 'geologia/teren.js', 'geologia/ewolucja.js', 'geologia/scena.js', 'geologia/gwiazdy.js', 'geologia/animacje.js',
    'geologia/rozdzialy.js', 'geologia/turystyka-scena.js', 'geologia/wulkany-scena.js', 'geologia/pokaz.js', 'geologia/widok.js'];
  var KONTROLE = ['biel', 'czern'];
  var ANIMACJE = ['a1', 'a2', 'a3', 'a4', 'a5'];
  var WARSTWY = ['turystyka', 'wulkany'];
  var WIDOKI = ['poludnie', 'polnoc', 'gora'];    // ta sama lista co Kompas.WIDOKI (geologia/turystyka-scena.js)

  function dekoduj(s) { try { return decodeURIComponent(s); } catch (_) { return s; } }
  function czyRozdzial(id) { return ROZDZIALY.some(function (r) { return r.id === id; }); }
  // Lista warstw z adresu → znormalizowany napis ('turystyka', 'wulkany', 'turystyka,wulkany') albo null.
  function warstwy(v) {
    if (typeof v !== 'string') return null;
    var dane = dekoduj(v).toLowerCase().split(',').map(function (x) { return x.trim(); });
    var znane = WARSTWY.filter(function (w) { return dane.indexOf(w) >= 0; });
    return znane.length ? znane.join(',') : null;
  }

  function parsujHashGeologii(hash) {
    if (typeof hash !== 'string') return null;
    var s = hash.charAt(0) === '#' ? hash.slice(1) : hash;
    var reszta;
    if (s === 'geologia' || s.indexOf('geologia&') === 0) reszta = s.slice(8);
    else if (s.indexOf('geologia=') === 0) reszta = s.slice(8);
    else return null;
    var m = /^=([^&]*)/.exec(reszta);
    var id = m ? dekoduj(m[1]).trim().toLowerCase().slice(0, 40) : '';
    var wynik = { miejsce: MIEJSCA_ID[0], tryb: 'pokaz', rozdzial: 'polozenie' };
    var nieznane = id && MIEJSCA_ID.indexOf(id) < 0 ? id : null;
    if (id && !nieznane) wynik.miejsce = id;
    var t = /&tryb=([^&]*)/.exec(reszta), r = /&rozdzial=([^&]*)/.exec(reszta), w = /&warstwa=([^&]*)/.exec(reszta);
    if (t && t[1] === 'makieta') {
      wynik.tryb = 'makieta'; wynik.rozdzial = null;
      var lw = w ? warstwy(w[1]) : null;
      if (lw) wynik.warstwa = lw;
    } else if (r && czyRozdzial(r[1])) wynik.rozdzial = r[1];
    if (nieznane) wynik.nieznane = nieznane;
    return wynik;
  }

  function parsujZapytanieGeologii(search) {
    var s = typeof search === 'string' ? search : '';
    var flaga = function (n) { return new RegExp('[?&]' + n + '(?=[&=]|$)').test(s); };
    var wart = function (n) { var m = new RegExp('[?&]' + n + '=([^&]*)').exec(s); return m ? dekoduj(m[1]).toLowerCase() : null; };
    var liczba = function (n) { var v = wart(n); if (v === null || v === '') return null; var x = Number(v); return isFinite(x) ? x : null; };
    var mi = wart('geologia'), miejsce = MIEJSCA_ID.indexOf(mi) >= 0 ? mi : null;
    var ro = wart('rozdzial'), t = liczba('t'), ko = wart('kontrola'), an = wart('anim'), f = liczba('f'), wa = wart('warstwa'), wi = wart('widok');
    return {
      smoke: flaga('smoke'), widoczna: flaga('geologia'), miejsce: miejsce,
      tryb: miejsce ? (wart('tryb') === 'makieta' || flaga('makieta') ? 'makieta' : 'pokaz') : null,
      rozdzial: czyRozdzial(ro) ? ro : null,
      t: t === null ? 0 : Math.max(0, Math.min(1, t)),
      czas: liczba('czas'), przekroj: liczba('przekroj'), przesuniecie: liczba('przesuniecie'), geologiczna: flaga('geologiczna'),
      jakosc: wart('jakosc') === 'pelna' ? 'pelna' : null,
      kontrola: KONTROLE.indexOf(ko) >= 0 ? ko : null,
      anim: ANIMACJE.indexOf(an) >= 0 ? an : null,
      f: ANIMACJE.indexOf(an) >= 0 ? (f === null ? 1 : Math.max(0, Math.min(1, f))) : null,
      warstwa: warstwy(wa),
      widok: WIDOKI.indexOf(wi) >= 0 ? wi : null
    };
  }

  var api = { MIEJSCA_ID: MIEJSCA_ID, TRYBY: TRYBY, ROZDZIALY: ROZDZIALY, PLIKI: PLIKI, ANIMACJE: ANIMACJE, WARSTWY: WARSTWY, WIDOKI: WIDOKI,
    parsujHashGeologii: parsujHashGeologii, parsujZapytanieGeologii: parsujZapytanieGeologii, warstwy: warstwy, krzywe: null };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  api.krzywe = root.Kino || null;              // G-C: jedyny odczyt window.Kino — przy wczytaniu
  root.GeologiaLadowanie = api;

  /* ---------- przeglądarka ---------- */
  var doc = root.document, korzen = doc.getElementById('geologia'), przycisk = doc.getElementById('zakGeologia');
  var zap = parsujZapytanieGeologii(root.location.search);
  var ladowanie = null, miejscaZaladowane = {};
  if (!korzen || !root.Zakladki) { console.error('Geologia: brak #geologia albo zakladki.js — zakładka nieaktywna'); return; }
  if (przycisk && zap.widoczna) przycisk.hidden = false;

  // Pasek nakładki istnieje od pierwszego `przelacz` (rejestr przenosi do niego #zakladki przed `otworz`).
  function pasek() {
    var p = doc.getElementById('gePasek');
    if (!p) {
      p = doc.createElement('header'); p.id = 'gePasek'; p.className = 'ge-pasek';
      var tyt = doc.createElement('span'); tyt.className = 'ge-tytul'; tyt.id = 'geTytul'; tyt.textContent = 'Geologia';
      p.appendChild(tyt);
      korzen.insertBefore(p, korzen.firstChild);
    }
    return p;
  }
  function komunikat(t) {
    var k = doc.getElementById('geLadowanie');
    if (!k && t) { k = doc.createElement('div'); k.id = 'geLadowanie'; k.className = 'ge-ladowanie'; k.setAttribute('role', 'status'); korzen.appendChild(k); }
    if (k) { k.textContent = t || ''; k.hidden = !t; }
  }
  function skrypt(src) {
    return new Promise(function (ok, zle) {
      var s = doc.createElement('script');
      s.src = src; s.async = false;
      s.onload = ok;
      s.onerror = function () { zle(new Error('nie udało się wczytać ' + src)); };
      doc.head.appendChild(s);
    });
  }
  function po(pliki) { return pliki.reduce(function (p, f) { return p.then(function () { return skrypt(f); }); }, Promise.resolve()); }
  function zaladujModul() {
    if (root.Geologia) return Promise.resolve();
    if (ladowanie) return ladowanie;
    ladowanie = po(PLIKI)
      .then(function () { if (!root.Geologia) throw new Error('widok.js nie wystawił window.Geologia'); },
        function (e) { ladowanie = null; throw e; });
    return ladowanie;
  }
  // Pliki miejsca (dane, opowieść) — raz, przy pierwszym wejściu w to miejsce; po miejsca.js (lista w MIEJSCA[].pliki).
  function zaladujMiejsce(id) {
    if (miejscaZaladowane[id]) return miejscaZaladowane[id];
    var m = (root.GeologiaMiejsca ? root.GeologiaMiejsca.MIEJSCA : []).filter(function (x) { return x.id === id; })[0];
    miejscaZaladowane[id] = po(m ? m.pliki : []).then(null, function (e) { delete miejscaZaladowane[id]; throw e; });
    return miejscaZaladowane[id];
  }

  function otworz(stan) {
    var s = stan || parsujHashGeologii('#geologia');
    korzen.hidden = false;
    if (przycisk) przycisk.hidden = false;
    pasek();
    var wejdz = function () { return zaladujMiejsce(s.miejsce).then(function () { return root.Geologia.otworz(s); }); };
    if (root.Geologia) {
      return wejdz().catch(function (e) { console.error('Geologia: ' + (e && e.message || e)); komunikat('Nie udało się wczytać miejsca. Spróbuj ponownie.'); return false; });
    }
    komunikat('Wczytuję geologię…');
    return zaladujModul().then(function () {
      komunikat('');
      if (root.Zakladki.aktywna() !== 'geologia') return false;          // użytkownik zdążył wyjść
      return wejdz().then(function (w) { return root.Zakladki.aktywna() === 'geologia' ? w : false; });
    }).then(null, function (e) {
      console.error('Geologia: ' + (e && e.message || e));
      komunikat('Nie udało się wczytać zakładki Geologia. Sprawdź połączenie i spróbuj ponownie.');
      return false;
    });
  }
  function zamknij() {
    if (root.Geologia) root.Geologia.zamknij();
    komunikat('');
    korzen.hidden = true;
    if (przycisk && !zap.widoczna) przycisk.hidden = true;
  }

  root.Zakladki.zarejestruj({ id: 'geologia', przycisk: przycisk, pasek: pasek, otworz: otworz, zamknij: zamknij,
    parsujHash: parsujHashGeologii });

  // Start po wczytaniu wszystkich skryptów strony (solar.js też): hak testowy albo link z hashem.
  function start() {
    if (zap.smoke && zap.miejsce) {
      var makieta = zap.tryb === 'makieta';
      var s = { miejsce: zap.miejsce, tryb: makieta ? 'makieta' : 'pokaz', rozdzial: makieta ? null : (zap.rozdzial || 'polozenie') };
      if (makieta && zap.warstwa) s.warstwa = zap.warstwa;
      root.Zakladki.przelacz('geologia', s);
    } else if (parsujHashGeologii(root.location.hash)) root.Zakladki.zAdresu(root.location.hash);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})(typeof window !== 'undefined' ? window : globalThis);
