'use strict';
/* Zakładki widoku — wspólny rejestr przełączania i hasha (dual-export jak zjawiska/logika.js).
   Układ Słoneczny jest „zakładką zerową” (aktywna() === null); każda nakładka (Zjawiska, Myśliwce…) rejestruje się
   w rejestrze i dostaje: zamknięcie poprzedniej, aria-pressed/`on` na przyciskach, przeniesienie węzła #zakladki
   do swojego paska, parsowanie hasha i blokadę wejścia w locie orbitalnym. Nowa nakładka = jedno `zarejestruj`. */
(function (root) {
  var INFO_MS = 4500;

  function utworz(dom, opcje) {
    opcje = opcje || {};
    var nakladki = [];                  // [{id, przycisk, pasek, otworz, zamknij, parsujHash}]
    var biez = null;                    // id aktywnej nakładki; null = Układ
    var zegarInfo = null;

    function _el(id) { return dom && dom.getElementById ? dom.getElementById(id) : null; }
    function _nakladka(id) { for (var i = 0; i < nakladki.length; i++) if (nakladki[i].id === id) return nakladki[i]; return null; }
    function _lot() {                   // `flight` = globalny const solar.js (tryb lotu orbitalnego)
      if (opcje.lotAktywny) return !!opcje.lotAktywny();
      try { return typeof flight !== 'undefined' && !!flight && flight.active === true; } catch (_) { return false; }
    }
    function info(tekst) {
      var w = _el('zakInfo');
      if (!w) return;
      w.textContent = tekst || '';
      if (zegarInfo) clearTimeout(zegarInfo);
      zegarInfo = tekst ? setTimeout(function () { w.textContent = ''; }, INFO_MS) : null;
    }
    function _zaznacz(el, wl) {
      if (!el) return;
      el.classList.toggle('on', wl);
      el.setAttribute('aria-pressed', String(wl));
    }
    function _odswiez() {
      _zaznacz(_el('zakUklad'), biez === null);
      nakladki.forEach(function (n) { _zaznacz(n.przycisk, n.id === biez); });
      var wezel = _el('zakladki');
      var n = biez === null ? null : _nakladka(biez);
      var cel = n ? n.pasek() : _el('topbar');
      if (wezel && cel && wezel.parentNode !== cel) cel.insertBefore(wezel, cel.firstChild);
    }

    var rejestr = {
      zarejestruj: function (n) {
        if (_nakladka(n.id)) throw new Error('Zakładki: zakładka „' + n.id + '” już zarejestrowana');
        nakladki.push(n);
        if (n.przycisk && n.przycisk.addEventListener) {
          n.przycisk.addEventListener('click', function () { if (biez !== n.id) rejestr.przelacz(n.id); });
        }
        _odswiez();
      },
      // Zwraca false, gdy wejście zablokowane (lot orbitalny) albo zakładka nieznana; inaczej wynik `otworz(stan)`
      // (np. obietnica wejścia) albo true, gdy `otworz` nic nie zwraca. Kontrakt jest synchroniczny.
      przelacz: function (id, stan) {
        var cel = id === 'uklad' ? null : id;
        var n = cel === null ? null : _nakladka(cel);
        if (cel !== null && !n) return false;
        if (cel !== null && biez === null && _lot()) {
          info('Najpierw zakończ lot orbitalny (Esc) — potem otwórz zakładkę.');
          return false;
        }
        if (cel !== biez) {
          var stara = biez === null ? null : _nakladka(biez);
          biez = cel;                   // najpierw stan, potem zamknięcie: zamknij() może zajrzeć w aktywna()
          if (stara) stara.zamknij();
        }
        _odswiez();
        var wynik = n ? n.otworz(stan === undefined ? null : stan) : undefined;
        return wynik === undefined ? true : wynik;
      },
      // Powrót do Układu + czysty adres (hash należał do zamykanej nakładki) + fokus na jej przycisku.
      zamknijDoUkladu: function () {
        var stara = biez === null ? null : _nakladka(biez);
        if (!stara) return;
        rejestr.przelacz('uklad');
        try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { /* file:// */ }
        if (stara.przycisk && stara.przycisk.focus) stara.przycisk.focus({ preventScroll: true });
      },
      aktywna: function () { return biez; },
      zAdresu: function (hash) {
        for (var i = 0; i < nakladki.length; i++) {
          var stan = nakladki[i].parsujHash(hash);
          if (stan != null) { rejestr.przelacz(nakladki[i].id, stan); return; }
        }
        rejestr.przelacz('uklad');
      }
    };

    var zakUklad = _el('zakUklad');
    if (zakUklad && zakUklad.addEventListener) zakUklad.addEventListener('click', rejestr.zamknijDoUkladu);
    return rejestr;
  }

  var api = { utworz: utworz };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.Zakladki = utworz(root.document);
    // Jedyny nasłuch hasha na stronie: rejestr wybiera zakładkę po parserach.
    root.addEventListener('hashchange', function () { root.Zakladki.zAdresu(root.location.hash); });
    root.addEventListener('popstate', function () { root.Zakladki.zAdresu(root.location.hash); });
    root.Zakladki.utworz = utworz;
  }
})(typeof self !== 'undefined' ? self : this);
