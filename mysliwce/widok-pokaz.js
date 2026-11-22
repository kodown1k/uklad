'use strict';
/* Zakładka Myśliwce — tryb pokazu widoku (plik przeglądarkowy; ładuje go mysliwce/ladowanie.js przed widok.js).
   window.MysliwceWidokPokaz = { utworz(w) } → { wejdz(id, o), zwolnij(), otworz(id, stan), doMakiety(), pauza(wl),
   krokUjecia(d), klawisze }.
   `w` to rdzeń widoku (`rdzen` w mysliwce/widok.js): wspólny stan (pk, mk, tryb, idBiez, gl, dźwięk…) przez akcesory i funkcje
   widoku. Tu jest zachowanie trybu: wejście (świat i makieta budowane od nowa, studio makiety i hangar zwolnione;
   wyjątek budowy → makieta tej maszyny z komunikatem), pauza (spacja, „Pauza”/„Dalej”/„Od nowa”), ←/→ ujęcie, Esc i
   „Makieta” → makieta tej maszyny, hak smoke `&ujecie=N[&t=0..1]` (marker `MYSLIWCE_READY <id> <N>`). Odtwarzacz to
   mysliwce/pokaz.js (Pokaz.uruchom); kadr 2.39:1 liczy rdzeń (dopasuj → MysliwceKino.kadrKinowy). */
(function () {
  function utworz(w) {
    var D = w.D, ui = w.ui, doc = document;

    // Zwolnienie pokazu (wyjście do makiety, hangaru, innej maszyny). Pauza pokazu — spacją albo z ukrytej karty — wstrzymała
    // też dźwięk; nie może przejść na następny tryb, więc dźwięk wraca tu (rampa wznowienia). Z zamknij() zakładki dźwięk
    // jest już zwolniony (zwolnijDzwiek przed zwolnieniem pokazu), więc nic się nie wznawia.
    // Cisza interfejsu w pokazie: pasek zakładki i kursor znikają po 3 s bezruchu (KinoKadr.cisza — wzorzec filmu Voyagera);
    // pauza i koniec pokazu — pasek widoczny. Smoke: pasek schowany od razu (kadr bez nakładki, deterministyczny).
    var cisza = null;
    function ciszaStart() {
      ciszaStop();
      if (w.smoke) { w.korzen.classList.add('my-cisza'); return; }
      if (window.KinoKadr && window.KinoKadr.cisza) cisza = window.KinoKadr.cisza(w.korzen, { poMs: 3000, klasa: 'my-cisza' });
    }
    function ciszaStop() { if (cisza) { cisza.zwolnij(); cisza = null; } w.korzen.classList.remove('my-cisza'); }
    function ciszaPauza(wl) { if (cisza) cisza.wstrzymaj(!!wl); }
    function zwolnij() {
      ciszaStop();
      if (!w.pk) return;
      var bylaPauza = w.pk.stan().pauza;
      w.pk.zwolnij(); w.pk = null;
      if (bylaPauza && w.dzwiek && w.dzwiekWl && !doc.hidden) w.dzwiek.wznow();
      if (w.mk) { w.mk.zwolnij(); w.mk = null; }
      ui.etykieta.hidden = true;
      ui.pauza.setAttribute('aria-pressed', 'false'); ui.pauza.textContent = 'Pauza';
    }
    // Pokaz maszyny od ujęcia o.n (domyślnie 0) w chwili o.t [s]; świat i makieta budowane od nowa, studio makiety zwolnione.
    var etyk = { w: 0, h: 0, kh: -1 };
    function wejdz(id, o) {
      o = o || {};
      if (w.sc) w.zwolnijScene();
      zwolnij();
      w.trybHangaru.zwolnij();
      w.tryb = 'pokaz';
      var gl = w.zapewnijGL(), T = w.T;
      w.jakoscWejscia('pokaz');
      w.trybUI();
      var dane = D.mysliwiec(id), czesci = (window.MysliwceCzesci.CZESCI[id] || []);
      w.idBiez = id; w.zapamietaj(id);
      // plan potrzebuje bryły makiety (kotwice) — budujemy świat z makietą, potem odtwarzacz z planem
      var ujecia = null;
      try {
        w.pk = window.Pokaz.uruchom({
          THREE: T, renderer: gl.renderer, post: gl.post, mysliwiec: dane, czesci: czesci, smoke: w.smoke, jakosc: w.jakosc,
          dzwiek: w.dzwiekWl ? w.dzwiek : null, napisy: ui.napisy,
          makieta: function (env) {
            var mk = w.mk = window.Makieta.zbuduj(T, id, { lod: 'pelny', env: env, anizotropia: gl.renderer.capabilities.getMaxAnisotropy() });
            ujecia = window.Pokaz.plan(dane, czesci, mk.bryla);
            return mk;
          },
          // podpis części nad kotwicą, w całości w kadrze (długie nazwy wychodziły za prawą krawędź na telefonie)
          etykieta: function (tekst, x, y) {
            if (!tekst) { ui.etykieta.hidden = true; return; }
            var e = ui.etykieta, k = w.kadrK || { x: 0, y: 0, w: 1e9, h: 1e9 };
            // pomiar przy zmianie tekstu i wysokości kadru (pismo etykiety rośnie z kadrem)
            if (e.textContent !== tekst || e.hidden || etyk.kh !== k.h) { e.textContent = tekst; e.hidden = false; etyk.w = e.offsetWidth; etyk.h = e.offsetHeight; etyk.kh = k.h; }
            var px = Math.max(8, Math.min(x + 14, k.w - etyk.w - 8)), py = Math.max(8, y - etyk.h - 10);
            e.style.transform = 'translate(' + Math.round(k.x + px) + 'px,' + Math.round(k.y + py) + 'px)';
          },
          karta: function (wl) { ui.dane.hidden = !wl; },
          // karta po lewej (szeroki ekran) pcha kadr w prawo; telefon poziomo — karta po prawej (mysliwce.css), kadr w lewo;
          // telefon pionowo — arkusz od dołu, bez przesunięcia
          przesuniecieKarty: function () {
            var g = w.gl;
            if (ui.dane.hidden || !g) return 0;
            if (g.w < 900) return g.w > g.h ? -ui.dane.offsetWidth / 2 : 0;
            return (ui.dane.offsetWidth + 16) / 2;
          },
          koniec: function () { ui.pauza.textContent = 'Od nowa'; ciszaPauza(true); },
        }, function () { return ujecia; });
      } catch (e) {
        // Pokaz.uruchom sprzątnął swój świat; makieta jest nasza. Powrót do spójnego trybu: makieta tej maszyny.
        w.pk = null;
        if (w.mk) { w.mk.zwolnij(); w.mk = null; }
        ui.napisy.pokaz(null); ui.napisy.tytul(null); ui.etykieta.hidden = true;
        var powod = (e && e.message) || String(e);
        console.warn('Myśliwce: pokaz się nie uruchomił (' + powod + ') — makieta');
        w.wejdzMakieta(id);                                   // tryb wciąż 'pokaz': makieta przywraca kartę i narzędzia
        w.komunikat('Pokaz się nie uruchomił (' + powod + '). Pokazuję makietę.');
        return false;
      }
      w.wypelnijDane(dane);
      ui.dane.hidden = true;
      ui.tytul.textContent = 'Myśliwce · ' + dane.nazwa + ' · pokaz';
      w.zaznaczMaszyne(id);
      gl.w = 0; w.dopasuj();
      if (o.n || o.t) w.pk.ustaw(o.n || 0, o.t || 0);
      if (w.smoke) w.pk.pauza(true); else w.dzwiekWejscia();
      ciszaStart();
    }
    // Wejście z adresu: pokaz; hak smoke — ujęcie N w chwili t (ułamek czasu ujęcia).
    // Ten sam pokaz już gra → nic: Wstecz w Chrome wysyła popstate i hashchange, a oba wołają Zakladki.zAdresu →
    // Mysliwce.otworz (druga budowa świata i makiety to 180–460 ms blokady). Hak smoke z ujęciem buduje zawsze — przychodzi
    // ze świeżego wczytania strony (jedno zdarzenie), a kadr testu liczy się od nowego świata.
    function otworz(id, stan) {
      if (w.tryb === 'pokaz' && w.pk && w.idBiez === id && stan.ujecie == null) return;
      if (wejdz(id) === false || !w.smoke || stan.ujecie == null) return;
      var pk = w.pk, n = Math.max(0, Math.min(pk.stan().ujec - 1, stan.ujecie | 0));
      pk.ustaw(n, 0); pk.ustaw(n, (+stan.t || 0) * pk.stan().czas);
      // marker tylko dla ujęcia, które naprawdę jest w kadrze: numer spoza planu = błąd, nie cichy kadr innego ujęcia
      if (n === stan.ujecie) w.gotowosc = id + ' ' + n;
      else console.error('Myśliwce: hak smoke — ujęcie ' + stan.ujecie + ' poza planem ' + id + ' (ujęć: ' + pk.stan().ujec + ')');
    }
    function doMakiety() { if (w.idBiez) { w.wejdzMakieta(w.idBiez); w.ustawAdres(w.idBiez, true); } }
    // wl: true pauza, false dalej, brak — przełącz; po końcu pokazu — od nowa. Dźwięk idzie za pauzą.
    function pauza(wl) {
      var pk = w.pk;
      if (!pk) return;
      var s = pk.stan();
      if (s.koniec) { pk.idz(0); pk.pauza(false); wl = false; }
      else { wl = wl == null ? !s.pauza : !!wl; pk.pauza(wl); }
      ui.pauza.setAttribute('aria-pressed', String(wl)); ui.pauza.textContent = wl ? 'Dalej' : 'Pauza';
      ciszaPauza(wl);
      var dz = w.dzwiek;
      if (dz && w.dzwiekWl) { if (wl) dz.pauza(); else if (!doc.hidden) dz.wznow(); }
    }
    function krokUjecia(d) {
      var pk = w.pk;
      if (!pk) return;
      var s = pk.stan();
      pk.idz(Math.max(0, Math.min(s.ujec - 1, s.ujecie + d)));
      ui.pauza.textContent = pk.stan().pauza ? 'Dalej' : 'Pauza';
    }
    var klawisze = {
      ' ': function () { pauza(); }, f: w.pelnyEkran, m: function () { w.ustawDzwiek(!w.dzwiekWl); },
      ArrowRight: function () { krokUjecia(1); }, ArrowLeft: function () { krokUjecia(-1); },
      Escape: function () { if (doc.fullscreenElement) doc.exitFullscreen(); else doMakiety(); },
    };
    ui.pauza.addEventListener('click', function () { pauza(); });
    ui.doMakiety.addEventListener('click', doMakiety);

    return { wejdz: wejdz, zwolnij: zwolnij, otworz: otworz, doMakiety: doMakiety, pauza: pauza, krokUjecia: krokUjecia, klawisze: klawisze };
  }

  window.MysliwceWidokPokaz = { utworz: utworz };
})();
