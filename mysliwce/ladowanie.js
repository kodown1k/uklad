'use strict';
/* Zakładka Myśliwce — wejście w moduł: rejestracja w zakladki.js i leniwe dociąganie reszty plików przy pierwszym
   otwarciu (anty-cel: moduł nie spowalnia startu Układu). Jedyny plik modułu ładowany ze strony (za zakladki.js).
   Czysta część (dual-export, testy w node): IDS, PLIKI, parsujHashMysliwcow, parsujZapytanieMysliwcow.

   Adresy:  #mysliwce → hangar ({id:null}); #mysliwiec=<id>[&tryb=pokaz|makieta] → {id, tryb} (domyślnie pokaz);
            #mysliwiec=<nieznany> → {id:null, nieznany} (hangar z komunikatem). Obcy hash → null.
   Zapytanie: ?mysliwce = przycisk zakładki widoczny (do czasu gotowości zakładki jest ukryty — main publikuje się
   sam); ?smoke&mysliwiec=<id>&makieta = hak testowy (marker MYSLIWCE_READY <id> makieta). Hash i hak działają też
   bez ?mysliwce — wtedy przycisk pojawia się tylko na czas otwartej nakładki (żeby było widać, gdzie jesteś). */
(function (root) {
  // Ta sama kolejność co MysliwceDane.MYSLIWCE (test pilnuje); parser hasha działa przed wczytaniem dane.js.
  var IDS = ['f-22a', 'f-35a', 'f-47', 'su-57', 'su-75', 'j-20a', 'j-35a', 'j-36', 'j-50'];
  var TRYBY = ['pokaz', 'makieta'];
  // Kolejność leniwego ładowania: tylko pliki, które istnieją. Kolejne zadania dopisują swoje (ogien.js, dzwiek.js,
  // kino.js, hangar.js, pokaz.js) PRZED widok.js — widok.js jest ostatni, bo korzysta z reszty.
  var PLIKI = ['mysliwce/dane.js', 'mysliwce/czesci.js', 'mysliwce/sylwetki.js', 'mysliwce/platowiec.js',
    'mysliwce/makieta.js', 'mysliwce/studio.js', 'mysliwce/widok.js'];
  var FONTY = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';

  function dekoduj(s) { try { return decodeURIComponent(s); } catch (_) { return s; } }

  function parsujHashMysliwcow(hash) {
    if (typeof hash !== 'string') return null;
    var s = hash.charAt(0) === '#' ? hash.slice(1) : hash;
    if (s === 'mysliwce' || s.indexOf('mysliwce&') === 0) return { id: null };
    var m = /^mysliwiec=([^&]*)(.*)$/.exec(s);
    if (!m) return null;
    var id = dekoduj(m[1]).trim().toLowerCase().slice(0, 40);
    if (!id) return { id: null };
    if (IDS.indexOf(id) < 0) return { id: null, nieznany: id };
    var t = /&tryb=([^&]*)/.exec(m[2]);
    return { id: id, tryb: t && TRYBY.indexOf(t[1]) >= 0 ? t[1] : 'pokaz' };
  }

  function parsujZapytanieMysliwcow(search) {
    var s = typeof search === 'string' ? search : '';
    var flaga = function (n) { return new RegExp('[?&]' + n + '(?=[&=]|$)').test(s); };
    var m = /[?&]mysliwiec=([^&]*)/.exec(s), id = m ? dekoduj(m[1]).toLowerCase() : '';
    return { smoke: flaga('smoke'), widoczna: flaga('mysliwce'), id: IDS.indexOf(id) >= 0 ? id : null,
      tryb: IDS.indexOf(id) >= 0 && flaga('makieta') ? 'makieta' : null };
  }

  var api = { IDS: IDS, TRYBY: TRYBY, PLIKI: PLIKI, parsujHashMysliwcow: parsujHashMysliwcow, parsujZapytanieMysliwcow: parsujZapytanieMysliwcow };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.MysliwceLadowanie = api;

  /* ---------- przeglądarka ---------- */
  var doc = root.document, korzen = doc.getElementById('mysliwce'), przycisk = doc.getElementById('zakMysliwce');
  var zap = parsujZapytanieMysliwcow(root.location.search);
  var ladowanie = null;
  if (!korzen || !root.Zakladki) { console.error('Myśliwce: brak #mysliwce albo zakladki.js — zakładka nieaktywna'); return; }
  if (przycisk && zap.widoczna) przycisk.hidden = false;

  // Pasek nakładki istnieje od pierwszego `przelacz` (rejestr przenosi do niego #zakladki przed `otworz`).
  function pasek() {
    var p = doc.getElementById('myPasek');
    if (!p) {
      p = doc.createElement('header'); p.id = 'myPasek'; p.className = 'my-pasek';
      var tyt = doc.createElement('span'); tyt.className = 'my-tytul'; tyt.id = 'myTytul'; tyt.textContent = 'Myśliwce stealth 2026';
      p.appendChild(tyt);
      korzen.insertBefore(p, korzen.firstChild);
    }
    return p;
  }
  function komunikat(t) {
    var k = doc.getElementById('myLadowanie');
    if (!k && t) { k = doc.createElement('div'); k.id = 'myLadowanie'; k.className = 'my-ladowanie'; k.setAttribute('role', 'status'); korzen.appendChild(k); }
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
  function zaladujModul() {
    if (root.Mysliwce) return Promise.resolve();
    if (ladowanie) return ladowanie;
    if (!doc.getElementById('myFonty')) {
      var l = doc.createElement('link'); l.id = 'myFonty'; l.rel = 'stylesheet'; l.href = FONTY; doc.head.appendChild(l);
    }
    ladowanie = PLIKI.reduce(function (p, f) { return p.then(function () { return skrypt(f); }); }, Promise.resolve())
      .then(function () { if (!root.Mysliwce) throw new Error('widok.js nie wystawił window.Mysliwce'); },
        function (e) { ladowanie = null; throw e; });
    return ladowanie;
  }

  function otworz(stan) {
    korzen.hidden = false;
    if (przycisk) przycisk.hidden = false;
    pasek();
    if (root.Mysliwce) return root.Mysliwce.otworz(stan || { id: null });
    komunikat('Wczytuję hangar…');
    return zaladujModul().then(function () {
      komunikat('');
      if (root.Zakladki.aktywna() !== 'mysliwce') return false;          // użytkownik zdążył wyjść
      return root.Mysliwce.otworz(stan || { id: null });
    }, function (e) {
      console.error('Myśliwce: ' + (e && e.message || e));
      komunikat('Nie udało się wczytać zakładki Myśliwce. Sprawdź połączenie i spróbuj ponownie.');
      return false;
    });
  }
  function zamknij() {
    if (root.Mysliwce) root.Mysliwce.zamknij();
    komunikat('');
    korzen.hidden = true;
    if (przycisk && !zap.widoczna) przycisk.hidden = true;
  }

  root.Zakladki.zarejestruj({ id: 'mysliwce', przycisk: przycisk, pasek: pasek, otworz: otworz, zamknij: zamknij,
    parsujHash: parsujHashMysliwcow });

  // Start po wczytaniu wszystkich skryptów strony (solar.js też): hak testowy albo link z hashem.
  function start() {
    if (zap.smoke && zap.id) root.Zakladki.przelacz('mysliwce', { id: zap.id, tryb: zap.tryb || 'makieta' });
    else if (parsujHashMysliwcow(root.location.hash)) root.Zakladki.zAdresu(root.location.hash);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})(typeof window !== 'undefined' ? window : globalThis);
