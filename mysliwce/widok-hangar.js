'use strict';
/* Zakładka Myśliwce — tryb hangaru widoku (plik przeglądarkowy; ładuje go mysliwce/ladowanie.js przed widok.js).
   window.MysliwceWidokHangar = { utworz(w) } → { wejdz(fokus), zwolnij(), otworz(stan, pierwsze), trafienie(x, y),
   wybierz(id), krok(d), doHangaru(), klatka(teraz), klawisze }.
   `w` to rdzeń widoku (`rdzen` w mysliwce/widok.js): wspólny stan (hg, tryb, idBiez, gl, dźwięk…) przez akcesory i funkcje widoku.
   Stan trzyma rdzeń — tu jest tylko zachowanie trybu: wejście (budowa sceny MysliwceHangar; wyjątek → Układ z komunikatem
   w pasku zakładek), trafienie myszą, krok ←/→, wybór maszyny (przelot kamery → pokaz), powrót do hangaru z pokazu
   i makiety, klatka, klawisze i haki smoke (?smoke&mysliwce[&hover=<id>][&przelot=<id>[&u=0..1]]). */
(function () {
  function utworz(w) {
    var D = w.D, ui = w.ui, doc = document, L = window.MysliwceLadowanie;

    // Zwolnienie hangaru zdejmuje zasłonę przejścia — chyba że to nasze przejście do pokazu (budowa pod czernią): nawigacja
    // w końcówce przelotu (Wstecz, zmiana adresu) nie może zostawić makiety ani pokazu pod czernią.
    var wPrzejsciu = false;
    function zwolnij() {
      if (!wPrzejsciu) zaslona(0);
      if (!w.hg) return;
      w.hg.zwolnij(); w.hg = null;
      w.gl.renderer.renderLists.dispose();
    }
    // Maszyna w fokusie hangaru = bieżąca maszyna widoku i wciśnięty przycisk w pasku maszyn.
    function oznacz(id) { w.idBiez = id; w.zaznaczMaszyne(id); }
    // Zwraca false, gdy hangar się nie zbudował: pokaz i makieta są już zwolnione, więc zamiast czarnej nakładki —
    // powrót do Układu z komunikatem w pasku zakładek (#zakInfo; komunikat nakładki zniknąłby razem z nią).
    function wejdz(fokus) {
      zaslona(0);
      w.trybPokazu.zwolnij();
      if (w.sc) w.zwolnijScene();
      w.ustawSilniki(false);
      w.tryb = 'hangar';
      var gl = w.zapewnijGL();
      w.jakoscWejscia('hangar');
      w.trybUI();
      fokus = D.mysliwiec(fokus) ? fokus : null;
      if (!w.hg) {
        try {
          w.hg = window.MysliwceHangar.zbuduj(w.T, { renderer: gl.renderer, jakosc: w.jakosc, smoke: w.smoke, ruch: !w.ograniczonyRuch(), fokus: fokus,
            anizotropia: gl.renderer.capabilities.getMaxAnisotropy() });
        } catch (e) {
          w.hg = null;
          var powod = (e && e.message) || String(e);
          console.warn('Myśliwce: hangar się nie zbudował (' + powod + ') — powrót do Układu');
          window.Zakladki.zamknijDoUkladu();
          var info = doc.getElementById('zakInfo');
          if (info) info.textContent = 'Hangar Myśliwców się nie zbudował (' + powod + ').';
          return false;
        }
        gl.w = 0; w.dopasuj();
      } else w.hg.fokus(fokus);
      oznacz(fokus);
      ui.tytul.textContent = 'Myśliwce · hangar';
      ui.etykieta.hidden = true;
      var dz = w.dzwiek;
      if (dz) dz.ambient('hangar');
      if (!w.smoke && w.dzwiekWl !== false && !dz) w.dzwiekWejscia();
      return true;
    }
    // Wejście bez maszyny: hangar z fokusem na bieżącej (zmiana hasha w trakcie) albo ostatnio oglądanej maszynie.
    function otworz(stan, pierwsze) {
      if (!wejdz(w.idBiez || w.ostatnia)) return false;
      if (stan.nieznany) w.komunikat('Nie znam maszyny „' + stan.nieznany + '”. Wybierz maszynę w hangarze.');
      w.ustawAdres(null, pierwsze && !L.parsujHashMysliwcow(location.hash));
      if (w.smoke) {
        var mh = /[?&]hover=([a-z0-9-]+)/.exec(location.search), mp = /[?&]przelot=([a-z0-9-]+)/.exec(location.search);
        if (mh) w.hg.hover(mh[1]);
        if (mp && D.mysliwiec(mp[1])) {
          var mu = /[?&]u=([0-9.]+)/.exec(location.search);
          w.hg.przelot(mp[1], mu ? Math.max(0, Math.min(1, +mu[1])) : 0.5); oznacz(mp[1]);
        }
        if (w.zap.tryb === 'hangar') w.gotowosc = 'hangar';
      }
      w.uruchomPetle();
      return true;
    }
    function trafienie(x, y) {
      if (!w.hg) return null;
      var r = ui.canvas.getBoundingClientRect();
      if (!(r.width > 0)) return null;
      return w.hg.trafienie((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
    }
    // Zasłona przejścia: w ostatnich ZACIEMNIENIE.wyjscie s przelotu ekran schodzi do czerni (klatka), świat pokazu buduje się
    // pod czernią (stopklatka budowy znika), rozruch wchodzi z czerni w ZACIEMNIENIE.wejscie s (skok jasności hangar → niebo
    // staje się wejściem). Smoke i ograniczony ruch — bez zasłony.
    var ZACIEMNIENIE = { wyjscie: 0.35, wejscie: 0.6 };
    function zaslona(a, czas) {
      var z = ui.zaslona;
      if (!z) return;
      z.style.transition = czas > 0 ? 'opacity ' + czas + 's ease-out' : 'none';
      z.style.opacity = String(a);
    }
    // Wybór maszyny w hangarze: przelot kamery, potem pokaz (wyjście albo zmiana trybu w trakcie przelotu — bez pokazu).
    function wybierz(id) {
      var h0 = w.hg;
      if (!h0 || h0.stan().przelot || !D.mysliwiec(id)) return;
      w.zapamietaj(id); oznacz(id);
      h0.hover(null); ui.canvas.style.cursor = '';
      var zZaslona = !w.smoke && !w.ograniczonyRuch();
      h0.wybierz(id).then(function (wynik) {
        if (wynik == null || w.hg !== h0 || !w.aktywny || w.tryb !== 'hangar') { zaslona(0); return; }
        var wejdzPokaz = function () {
          if (w.hg !== h0 || !w.aktywny || w.tryb !== 'hangar') { zaslona(0); return; }
          wPrzejsciu = true;
          try { w.trybPokazu.wejdz(id); } finally { wPrzejsciu = false; }
          w.ustawAdres(id, true);
          if (zZaslona) requestAnimationFrame(function () { zaslona(0, ZACIEMNIENIE.wejscie); });
        };
        if (!zZaslona) { wejdzPokaz(); return; }
        zaslona(1);
        // dwie klatki: czerń musi dojść na ekran, zanim budowa świata zablokuje wątek
        requestAnimationFrame(function () { requestAnimationFrame(wejdzPokaz); });
      }, function (e) { zaslona(0); console.error('Myśliwce: przelot hangaru — ' + (e && e.message || e)); });
    }
    function krok(d) {
      var hg = w.hg;
      if (!hg || hg.stan().przelot) return;
      var id = window.MysliwceHangar.nastepny(hg.stan().fokus, d);
      hg.fokus(id); oznacz(id);
    }
    // Powrót do hangaru z pokazu albo makiety: fokus na maszynie, którą właśnie oglądano.
    function doHangaru() {
      if (!w.aktywny) return;
      if (wejdz(w.idBiez || w.ostatnia)) w.ustawAdres(null, true);
    }
    // Klatka hangaru: animacja (reflektory, kamera), hover pod nieruchomym kursorem (kamera się obraca), render przez post.
    function klatka(teraz) {
      var hg = w.hg, t = w.czasSceny(teraz), wsk = w.wskaznik;
      hg.animuj(t);
      var sh = hg.stan();
      if (sh.przelotU != null && !w.smoke && !w.ograniczonyRuch()) {
        var u0 = 1 - ZACIEMNIENIE.wyjscie / sh.przelotS;
        zaslona(Math.max(0, Math.min(1, (sh.przelotU - u0) / (1 - u0))));
      }
      if (wsk && !hg.stan().przelot) {
        var id = trafienie(wsk.x, wsk.y);
        hg.hover(id); ui.canvas.style.cursor = id ? 'pointer' : '';
      }
      w.gl.post.renderuj(hg.scena, hg.kamera, { czas: t, zrodlaGoraca: [] });
    }
    var klawisze = {
      Escape: function () { if (doc.fullscreenElement) doc.exitFullscreen(); else window.Zakladki.zamknijDoUkladu(); },
      f: w.pelnyEkran, m: function () { w.ustawDzwiek(!w.dzwiekWl); },
      ArrowRight: function () { krok(1); }, ArrowLeft: function () { krok(-1); },
      Enter: function () { var f = w.hg && w.hg.stan().fokus; if (f) wybierz(f); else krok(1); },
    };
    klawisze[' '] = klawisze.Enter;
    ui.doHangaru.addEventListener('click', doHangaru);

    return { wejdz: wejdz, zwolnij: zwolnij, otworz: otworz, trafienie: trafienie, wybierz: wybierz, krok: krok,
      doHangaru: doHangaru, klatka: klatka, klawisze: klawisze };
  }

  window.MysliwceWidokHangar = { utworz: utworz };
})();
