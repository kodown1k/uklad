'use strict';
/* Zakładka Geologia — pokaz: dziewięć filmów miejsca w kadrze kinowym (spec „Reżyseria filmów” R1, R2, R4, R5, R7;
   plik przeglądarkowy, ładowany leniwie przed widok.js). Widok (geologia/widok.js) tworzy go raz i woła co klatkę.

   GeologiaPokaz.utworz(ctx) → { wejdz(miejsce, rozdzial), wyjdz(), klatka(dt) → bool, dopasuj(w, h) → kadr, klawisz(key) → bool,
     gotowy(), stan(), pomiar(opcje), skok(rozdzial, ulamek), diagnostyka() }
   ctx = { T, renderer, korzen, smoke, zap, el(tag, klasa, tekst, rodzic), guzik(rodzic, tekst, tytul, klasa),
     wczytajRzezbe(miejsce) → Promise, lod() → 'pelny'|'lekki', komunikat(t, trwaly), doMakiety(), doUkladu(), pelnyEkran(),
     zmianaRozdzialu(id), nazwaMiejsca(id), zrodloLektora(miejsce) → { baza, zapytanie, powod } (GeologiaLadowanie) }.

   Zegar filmu: jeden, w sekundach rozdziału (seans ciągły: po końcu rozdziału następny od 0, po ostatnim karta końcowa).
   Wszystko w kadrze jest czystą funkcją (rozdział, t): kamera Rozdzialy.kamera (y już z przewyższeniem), stan obrazu
   Rozdzialy.chwila, montaż (czerń C/Cc, biel B, przenikanie P globu przez render target sceny) i animacje A1–A5 z `f`
   (G-F). Nakładki filmu (plakietka G-L, przewyższenie z podziałką G-P, licznik G-S, tytuł rozdziału i stempel T-L,
   teza mitu, etykiety miejsc w polu S, napisy KinoKadr) liczone z tego samego zegara — nie z setTimeout ani przejść CSS.
   Interfejs (pasek, rząd rozdziałów z paskiem postępu, kursor) chowa KinoKadr.cisza po 3 s bezruchu; na pauzie i karcie
   końcowej zostaje.
   Lektor i podkład (Task 9, spec R6): przy wejściu pokaz pobiera <baza lektora>/czasy.json (baza i token z
   zrodloLektora — zaproszenie, ruling 9-2; bez tokenu / 403 / 404: bez lektora, jedno „Geologia/uwaga:”), plan liczy się
   z czasów aktualnych nagrań (GeologiaLektor.aktualne → Rozdzialy.plan({ czasy }) — obraz idzie za nagraniem, ruling 9-3),
   więc rozdzial.lektor mówi, czy lektor jest (przycisk startu: „Odtwórz z lektorem” albo „Odtwórz” + „lektor na
   zaproszenie” / „lektor w przygotowaniu”, ruling 9-4). Dźwięk startuje dopiero na gest (karta „Odtwórz” albo klik
   zakładki): wspólny AudioContext dla lektora (geologia/lektor.js) i podkładu (geologia/dzwiek.js, gra dla wszystkich).
   Gdy kontekst gra, ZEGAREM FILMU jest AudioContext (GeologiaLektor.zegar); bez kontekstu — klatki (dt). Pauza =
   ctx.suspend(), powrót z pauzy i karty w tle gra od miejsca zatrzymania; przewinięcie = nowa kotwica 150 ms naprzód;
   przejście do następnego rozdziału bez przerwy (przesun). Nagrania rozdziału (i następnego) dekodowane z wyprzedzeniem;
   po skoku zegar czeka na zdekodowanie (≤ 3 s). M wycisza lektora i podkład razem (kontekst gra dalej — zegar też).
   Smoke (?smoke): zegar stoi na t z haka, bez karty „Odtwórz”, bez AudioContext, interfejs od razu schowany;
   Geologia.pomiar() i skok(). Plan w smoke liczy się z czasy.json tylko z hakiem `&lektor=lokalny`. */
(function (root) {
  var RAD = Math.PI / 180;
  var FUNKCJE_ANIM = { a1: 'a1Powstanie', a2: 'a2Lawa1706', a3: 'a3Osuwisko', a4: 'a4MorzeChmur', a5: 'a5Noc' };
  var PLAKIETKI = { rekonstrukcja: 'REKONSTRUKCJA', schemat: 'SCHEMAT', hipoteza: 'HIPOTEZA — badacze się spierają', legenda: 'LEGENDA',
    mapa: 'MAPA UPROSZCZONA', dno: 'DNO: ETOPO1, ok. 1,9 km/piksel' };
  var WERDYKTY = { fakt: 'FAKT', mit: 'MIT', czesciowo: 'CZĘŚCIOWO', legenda: 'LEGENDA' };
  var POL_C = 0.35;                       // połowa czerni między rozdziałami (C 0,7 s, spec R5)
  var TYTUL_S = 3;                        // tytuł rozdziału na pierwszym ujęciu (pole T-L, R5)
  var STEMPEL_S = 2.6;                    // stempel werdyktu po cięciu K (R9.8)
  var OSTRZE_S = 3;                       // płaszczyzna odcięcia jedzie 3 s (R9.6 X2)
  var SZKLO_S = 2.5;                      // woda realna → szklana (R9.4 W2)
  var KRAWEDZ_X = 0.92;                 // etykieta kierunkowa: krawędź pola S (margines kadru 4%) w NDC
  var MAKS_ETYKIET = 3;
  // Ekspozycja filmu (spec R4, strojone pomiarem Geologia.pomiar() w smoke; makieta zostaje przy 1 / 1 / 1):
  var MGIELKA_OD = 5, MGIELKA_DO = 60;   // km wysokości kamery: mgiełka kolumny powietrza od 0 do pełnej
  var JASNOSC_WODY = 2.5;                // mnożnik barwy głębokiej wody (kadry z przewagą oceanu: EKS-1 średnia ≥ 70)
  var ZAR_A1 = 1.0;                      // żar rosnących komórek A1 (makieta 1,6; H6 w dzień: EKS-1 średnia ≤ 150)
  var EKSPOZYCJA = 0.93, JASNOSC_NIEBA = 0.8;   // materiały oświetlone (toneMappingExposure) / niebo, mgła i jej odbicie

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function gladko(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function liczba(x, miejsc) { var k = Math.pow(10, miejsc || 0); return String(Math.round(x * k) / k).replace('.', ','); }
  function tekstCzasu(Ma) {
    if (!(Ma > 0)) return 'dziś';
    if (Ma >= 1) return liczba(Ma, 1) + ' mln lat temu';
    if (Ma >= 0.001) return liczba(Math.round(Ma * 1000)) + ' tys. lat temu';
    return liczba(Math.round(Ma * 1e6)) + ' lat temu';
  }
  // pora z opowieści → paleta sceny (GeologiaScena.PORY); „z danych” (1706) z elewacji słońca
  function poraSceny(p, el) {
    if (p === 'zloty') return 'zlota';
    if (p === 'studio') return 'dzien';
    if (p === 'z-danych') return el < -6 ? 'noc' : el < 3 ? 'zmierzch' : 'dzien';
    var P = root.GeologiaScena && root.GeologiaScena.PORY;
    return P && P[p] ? p : 'dzien';
  }

  function utworz(c) {
    var T = c.T, R = root.Rozdzialy, KK = root.KinoKadr, GS = root.GeologiaScena, Teren = root.Teren, L = root.GeologiaLadowanie;
    var doc = document, korzen = c.korzen, smoke = c.smoke, zap = c.zap, el = c.el;
    var P = { aktywny: false, gotowy: false, budowa: 0, miejsce: null, plan: null, planKlucz: null, rz: null, sc: null, anim: null, siatka: null,
      ri: 0, t: 0, gra: false, pauza: false, koniec: false, dzwiek: true, karta: false, kadr: null, w: 0, h: 0, ostatnie: null,
      stan: {}, animAkt: null, a2: null, obrys: null, ostatniPomiar: null, tlo: null,
      czasyLektora: null, zrodlo: null, powodBezLektora: 'przygotowanie', audio: null, czeka: 0, akcenty: [], autoPauza: false };
    var ui = null, napisy = null, cisza = null;
    var kamera = null;

    /* ---------- DOM ---------- */
    function zbudujUI() {
      if (ui) return ui;
      ui = {};
      ui.film = el('div', 'ge-film', null, korzen); ui.film.hidden = true; ui.film.setAttribute('aria-hidden', 'false');
      ui.gl = el('div', 'ge-film-pole ge-film-gl', null, ui.film);
      ui.plak = el('p', 'ge-film-plakietka', null, ui.gl); ui.plak.hidden = true;
      ui.plak2 = el('p', 'ge-film-plakietka ge-film-plakietka-2', null, ui.gl); ui.plak2.hidden = true;
      ui.plak3 = el('p', 'ge-film-podpis', null, ui.gl); ui.plak3.hidden = true;            // dopisek ujęcia (R4 G4)
      ui.gp = el('div', 'ge-film-pole ge-film-gp', null, ui.film); ui.gp.hidden = true;
      ui.przew = el('p', 'ge-film-przew', null, ui.gp);
      ui.podz = el('div', 'ge-film-podz', null, ui.gp);
      ui.podzBelka = el('span', 'ge-film-podz-belka', null, ui.podz);
      ui.podzTekst = el('span', 'ge-film-podz-tekst', null, ui.podz);
      ui.gs = el('p', 'ge-film-pole ge-film-gs', null, ui.film); ui.gs.hidden = true;
      ui.tl = el('div', 'ge-film-pole ge-film-tl', null, ui.film);
      ui.tytul = el('p', 'ge-film-tytul', null, ui.tl); ui.tytul.hidden = true;
      ui.stempel = el('p', 'ge-film-stempel', null, ui.tl); ui.stempel.hidden = true;
      ui.teza = el('blockquote', 'ge-film-pole ge-film-teza', null, ui.film); ui.teza.hidden = true;
      ui.plansza = el('div', 'ge-film-plansza', null, ui.film); ui.plansza.hidden = true;
      ui.planszaTekst = el('p', 'ge-film-plansza-tekst', null, ui.plansza);
      ui.etykiety = [];
      for (var i = 0; i < MAKS_ETYKIET; i++) {
        var e = el('div', 'ge-film-etykieta', null, ui.film); e.hidden = true;
        ui.etykiety.push({ el: e, tekst: el('span', 'ge-film-etykieta-tekst', null, e), id: null });
      }
      napisy = KK.napisy(korzen, { prefiks: 'ge-kino' });
      ui.kino = korzen.querySelector('.ge-kino');
      if (ui.kino) ui.kino.hidden = true;
      // pasek postępu seansu z 9 znacznikami rozdziałów + sterowanie (w rzędzie rozdziałów — chowa go cisza)
      var rz = korzen.querySelector('.ge-rozdzialy');
      ui.dol = el('div', 'ge-pokaz-dol', null, null);
      if (rz) rz.insertBefore(ui.dol, rz.firstChild); else korzen.appendChild(ui.dol);
      ui.bPauza = c.guzik(ui.dol, '❚❚', 'Pauza (spacja)', 'ge-pokaz-guzik'); ui.bPauza.removeAttribute('aria-pressed');
      ui.bWstecz = c.guzik(ui.dol, '◀', 'Poprzedni rozdział (←)', 'ge-pokaz-guzik'); ui.bWstecz.removeAttribute('aria-pressed');
      ui.postep = el('div', 'ge-postep', null, ui.dol);
      ui.postep.setAttribute('role', 'slider'); ui.postep.setAttribute('aria-label', 'Postęp seansu'); ui.postep.tabIndex = 0;
      ui.postepPas = el('div', 'ge-postep-pas', null, ui.postep);
      ui.postepZnaczniki = el('div', 'ge-postep-znaczniki', null, ui.postep);
      ui.bDalej = c.guzik(ui.dol, '▶', 'Następny rozdział (→)', 'ge-pokaz-guzik'); ui.bDalej.removeAttribute('aria-pressed');
      ui.bDzwiek = c.guzik(ui.dol, 'Dźwięk', 'Dźwięk (M)', 'ge-pokaz-guzik');
      ui.bezLektora = el('span', 'ge-bez-lektora', 'bez lektora', ui.dol); ui.bezLektora.hidden = true;
      ui.bezLektora.title = 'Nagrania lektora niedostępne — film z napisami i podkładem';
      ui.bPelny = c.guzik(ui.dol, '⛶', 'Pełny ekran (F)', 'ge-pokaz-guzik'); ui.bPelny.removeAttribute('aria-pressed');
      ui.bPauza.addEventListener('click', function () { pauza(); });
      ui.bWstecz.addEventListener('click', function () { krokRozdzialu(-1); });
      ui.bDalej.addEventListener('click', function () { krokRozdzialu(1); });
      ui.bDzwiek.addEventListener('click', function () { ustawDzwiek(!P.dzwiek); });
      ui.bPelny.addEventListener('click', function () { c.pelnyEkran(); });
      ui.postep.addEventListener('click', function (e) {
        if (!P.plan || e.target.closest('.ge-postep-znacznik')) return;
        var r = ui.postep.getBoundingClientRect();
        if (r.width > 0) przewinDo(clamp01((e.clientX - r.left) / r.width));
      });
      // karty: „Odtwórz” (start bez gestu, R6) i końcowa (R9.9 D7)
      ui.kartaStart = el('div', 'ge-panel ge-film-karta ge-karta-start', null, korzen); ui.kartaStart.hidden = true;
      ui.kartaStart.setAttribute('role', 'dialog'); ui.kartaStart.setAttribute('aria-label', 'Odtwórz film');
      ui.kartaStartTytul = el('p', 'ge-film-karta-tytul', null, ui.kartaStart);
      var gs = el('div', 'ge-film-karta-guziki', null, ui.kartaStart);
      // napisy przycisków zależą od nagrań (odswiezLektora): bez nich „Odtwórz” + dopisek „lektor na zaproszenie” /
      // „lektor w przygotowaniu” (ruling 9-4)
      ui.bStartGlos = c.guzik(gs, 'Odtwórz', 'Odtwórz film', 'ge-guzik-glowny'); ui.bStartGlos.removeAttribute('aria-pressed');
      ui.bStartCisza = c.guzik(gs, 'Odtwórz bez dźwięku', 'Film z napisami, bez dźwięku'); ui.bStartCisza.removeAttribute('aria-pressed');
      ui.kartaStartDopisek = el('p', 'ge-film-karta-dopisek', 'lektor w przygotowaniu', ui.kartaStart);
      ui.bStartGlos.addEventListener('click', function () { start(true); });
      ui.bStartCisza.addEventListener('click', function () { start(false); });
      ui.kartaKoniec = el('div', 'ge-panel ge-film-karta ge-karta-koniec', null, korzen); ui.kartaKoniec.hidden = true;
      ui.kartaKoniec.setAttribute('role', 'dialog'); ui.kartaKoniec.setAttribute('aria-label', 'Koniec filmu');
      ui.kartaKoniecTytul = el('p', 'ge-film-karta-tytul', 'Koniec', ui.kartaKoniec);
      var gk = el('div', 'ge-film-karta-guziki', null, ui.kartaKoniec);
      ui.bNiebo = c.guzik(gk, 'Zobacz to niebo w Układzie Słonecznym', 'Przejdź do zakładki Układ Słoneczny', 'ge-guzik-glowny'); ui.bNiebo.removeAttribute('aria-pressed');
      ui.bJeszcze = c.guzik(gk, 'Jeszcze raz', 'Seans od początku'); ui.bJeszcze.removeAttribute('aria-pressed');
      ui.bMakieta = c.guzik(gk, 'Makieta', 'Makieta wyspy (Esc)'); ui.bMakieta.removeAttribute('aria-pressed');
      ui.bNiebo.addEventListener('click', function () { c.doUkladu(); });
      ui.bJeszcze.addEventListener('click', function () { P.koniec = false; ui.kartaKoniec.hidden = true; ustawRozdzial(0, 0); grajDalej(); });
      ui.bMakieta.addEventListener('click', function () { c.doMakiety(); });
      return ui;
    }
    function zbudujZnaczniki() {
      ui.postepZnaczniki.replaceChildren();
      var suma = P.plan.reduce(function (s, r) { return s + r.czas; }, 0), od = 0;
      P.suma = suma; P.starty = [];
      P.plan.forEach(function (r, i) {
        P.starty.push(od);
        var b = el('button', 'ge-postep-znacznik', null, ui.postepZnaczniki);
        b.type = 'button'; b.style.left = (od / suma * 100).toFixed(3) + '%';
        var et = (L.ROZDZIALY.filter(function (x) { return x.id === r.id; })[0] || {}).etykieta || r.id;
        b.title = (i + 1) + '. ' + et; b.setAttribute('aria-label', 'Rozdział ' + (i + 1) + ': ' + et);
        b.addEventListener('click', function () { ustawRozdzial(i, 0); grajDalej(); });
        od += r.czas;
      });
    }
    function pokazUI(wl) {
      if (!ui) return;
      ui.film.hidden = !wl; ui.dol.hidden = !wl;
      if (ui.kino) ui.kino.hidden = !wl;
      if (!wl) { ui.kartaStart.hidden = true; ui.kartaKoniec.hidden = true; napisy.pokaz(''); }
    }

    /* ---------- budowa ---------- */
    function lekka(s) {
      var k = 2, w = Math.floor((s.w - 1) / k) + 1, h = Math.floor((s.h - 1) / k) + 1, wys = new Float32Array(w * h), b = s.bbox;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) wys[y * w + x] = s.wys[(y * k) * s.w + x * k];
      return { w: w, h: h, wys: wys, mNaPiksel: s.mNaPiksel * k, mNaPikselDanych: s.mNaPikselDanych,
        bbox: { lonMin: b.lonMin, lonMax: b.lonMin + (b.lonMax - b.lonMin) * (w - 1) * k / (s.w - 1), latMax: b.latMax,
          latMin: b.latMax - (b.latMax - b.latMin) * (h - 1) * k / (s.h - 1) } };
    }
    // czasy.json lektora z bazy zaproszenia (albo lokalnej z hakiem &lektor=lokalny); null = film bez lektora
    function wczytajCzasy(miejsce, rozdzialId) {
      var zr = c.zrodloLektora ? c.zrodloLektora(miejsce) : null;
      P.zrodlo = zr;
      if (!zr || !zr.baza) {
        P.powodBezLektora = zr && (zr.powod === 'wygaslo' || zr.powod === 'host') ? zr.powod : 'zaproszenie';
        var powod = { wygaslo: 'zaproszenie wygasło', host: 'lektor tylko na kodownik.co' }[P.powodBezLektora] || 'bez zaproszenia';
        console.warn('Geologia/uwaga: lektor niedostępny (' + powod + ') — film z napisami i podkładem');
        return Promise.resolve(null);
      }
      var ac = typeof AbortController === 'function' ? new AbortController() : null;
      var zeg = ac ? setTimeout(function () { ac.abort(); }, 6000) : 0;
      return fetch(zr.baza + 'czasy.json' + zr.zapytanie, { credentials: 'omit', cache: 'no-cache', signal: ac ? ac.signal : undefined }).then(function (r) {
        if (!r.ok) { var e = new Error('czasy.json HTTP ' + r.status); e.status = r.status; throw e; }
        return r.json();
      }).then(function (cz) {
        clearTimeout(zeg);
        if (!cz || typeof cz.glos !== 'string' || !cz.wersy) throw new Error('czasy.json bez glos/wersy');
        // próbka: pierwsze nagranie rozdziału startowego z tym samym tokenem — 403/404 na MP3 = bez lektora, zanim przycisk
        // cokolwiek obieca (recenzja 9a M-1)
        var O = root.GeologiaOpowiesc, w0 = O && O.wersy[rozdzialId] && O.wersy[rozdzialId][0], e0 = w0 && cz.wersy[w0.id];
        if (!e0) return cz;
        return fetch(zr.baza + e0.plik + zr.zapytanie, { credentials: 'omit' }).then(function (r) {
          try { if (r.body && r.body.cancel) r.body.cancel(); } catch (_) { /* nic */ }
          if (!r.ok) { var e = new Error(e0.plik + ' HTTP ' + r.status); e.status = r.status; throw e; }
          return cz;
        }, function (e) { throw new Error(e0.plik + ': ' + (e && e.message || e)); });
      }, function (e) {
        clearTimeout(zeg);
        throw e;
      }).then(null, function (e) {
        P.powodBezLektora = e && e.status === 403 ? 'zaproszenie' : e && e.status === 404 ? 'przygotowanie' : 'zaproszenie';
        console.warn('Geologia/uwaga: lektor niedostępny (' + (e && e.message || e) + ') — film z napisami i podkładem');
        return null;
      });
    }
    function wszystkieWersyRozdzialow() {
      var O = root.GeologiaOpowiesc, out = [];
      Object.keys(O.wersy).forEach(function (r) { out = out.concat(O.wersy[r]); });
      return out;
    }
    function zbudujScene(rz) {
      var lod = c.lod(), D = root.GeologiaTeneryfa || {}, GL = root.GeologiaLektor;
      if (!L.krzywe) throw new Error('brak krzywych kino.js (GeologiaLadowanie.krzywe)');
      var siatka = lod === 'lekki' ? lekka(rz.wyspa) : rz.wyspa;
      // obraz idzie za nagraniem (ruling 9-3): plan z czasów AKTUALNYCH nagrań (skrot zgodny z tekstem czytanym)
      var czasy = P.czasyLektora && GL ? GL.aktualne(wszystkieWersyRozdzialow(), P.czasyLektora) : null;
      if (czasy && !Object.keys(czasy).length) {
        console.warn('Geologia/uwaga: lektor niedostępny (nagrania nieaktualne wobec opowieści) — film z napisami i podkładem');
        P.powodBezLektora = 'przygotowanie'; czasy = null;
      }
      var klucz = P.miejsce + '|' + lod + '|' + (czasy ? Object.keys(czasy).length : 0);
      if (P.planKlucz !== klucz) {
        P.plan = R.plan({ dane: D, opowiesc: root.GeologiaOpowiesc, siatka: siatka, poziomy: { archipelag: rz.archipelag, wstawki: rz.wstawki },
          czasy: czasy, krzywe: L.krzywe });
        P.planKlucz = klucz;
        if (ui) odswiezLektora();
      }
      P.siatka = siatka; P.rz = rz;
      P.sc = GS.zbuduj(T, c.renderer, { siatka: rz.wyspa, poziomy: { archipelag: rz.archipelag, wstawki: rz.wstawki }, dane: D, lod: lod,
        przewyzszenie: 1.5, ostrze: true });
      kamera = P.sc.kamera;
      var cz = P.sc.scena.getObjectByName('czesci'); if (cz) cz.visible = false;      // etykiety pokazu: DOM w polu S
      P.anim = root.GeologiaAnimacje ? root.GeologiaAnimacje.utworz(T, P.sc, D) : null;
      P.stan = {}; P.animAkt = null; P.a2 = null; P.obrys = null;
      zbudujZnaczniki();
      P.urlGlobu = lod === 'lekki' ? 'textures/earthmap4k.jpg' : 'textures/earthmap8k.jpg';   // spec R2: 8k, telefon 4k
      return P.sc.dalekiLad('textures/earthmap4k.jpg');
    }
    // Kula (tekstura 8k) tylko w rozdziale z poziomem `glob` — poza nim zwolniona (pamięć karty; na zajętej karcie
    // kontekst WebGL ginął). Zwraca obietnicę gotowości.
    function zapewnijGlob(ri) {
      if (!P.sc || !P.plan) return Promise.resolve();
      var trzeba = P.plan[ri].ujecia.some(function (u) { return u.poziom === 'glob' && u.typ !== 'plansza'; });
      if (!trzeba) { P.sc.zwolnijGlob(); return Promise.resolve(); }
      return P.sc.zbudujGlob(P.urlGlobu).then(null, function (e) { console.error('Geologia: ' + (e && e.message || e)); });
    }
    function potrzebaGlobu(r) { return r.ujecia.some(function (u) { return u.poziom === 'glob' && u.typ !== 'plansza'; }); }
    function wejdz(miejsce, rozdzialId) {
      zbudujUI();
      P.aktywny = true;
      var ri = Math.max(0, L.ROZDZIALY.map(function (r) { return r.id; }).indexOf(rozdzialId));
      pokazUI(true);
      if (!cisza && !smoke) cisza = KK.cisza(korzen, { klasa: 'ge-cisza' });
      if (smoke) korzen.classList.add('ge-cisza');
      if (P.sc && P.miejsce === miejsce && P.gotowy) {
        ustawRozdzial(ri, smoke ? zap.t * P.plan[ri].czas : 0);
        grajDalej();
        return;
      }
      P.miejsce = miejsce; P.gotowy = false;
      var moja = ++P.budowa;
      c.komunikat('Wczytuję film…', true);
      var czasyP = wczytajCzasy(miejsce, L.ROZDZIALY[ri].id);
      c.wczytajRzezbe(miejsce).then(function (rz) {
        return czasyP.then(function (cz) {
          if (moja !== P.budowa || !P.aktywny) return null;
          P.czasyLektora = cz;
          return zbudujScene(rz);
        });
      }).then(function () {
        if (moja !== P.budowa || !P.aktywny || !P.sc) return null;
        return zapewnijGlob(ri);
      }).then(function () {
        if (moja !== P.budowa || !P.aktywny || !P.sc) return;
        c.komunikat('');
        P.gotowy = true;
        ustawRozdzial(ri, smoke ? zap.t * P.plan[ri].czas : 0);
        // zimny start bez gestu (link z hashem): przeglądarka zablokuje dźwięk — karta „Odtwórz” (spec R6)
        var gest = root.navigator && root.navigator.userActivation ? root.navigator.userActivation.hasBeenActive : true;
        if (smoke) { P.gra = false; }
        else if (!gest) pokazKarteStart();
        else grajDalej();
      }).then(null, function (e) {
        if (moja !== P.budowa) return;
        console.error('Geologia: pokaz — ' + (e && e.message || e));
        c.komunikat('Nie udało się uruchomić filmu (' + (e && e.message || e) + ').', true);
      });
    }
    function wyjdz() {
      P.aktywny = false; P.gotowy = false; P.budowa++; P.gra = false;
      if (cisza) { cisza.zwolnij(); cisza = null; }
      korzen.classList.remove('ge-cisza');
      pokazUI(false);
      if (P.anim) { P.anim.zwolnij(); P.anim = null; }
      if (P.sc) { P.sc.zwolnij(); P.sc = null; c.renderer.renderLists.dispose(); }
      c.renderer.toneMappingExposure = 1;
      kamera = null; P.stan = {}; P.animAkt = null;
      zwolnijAudio();
    }

    /* ---------- dźwięk: AudioContext (zegar filmu), lektor, podkład ---------- */
    // Tworzony dopiero na gest (start z karty, klik zakładki, M) i tylko z dźwiękiem; w smoke nigdy.
    function zapewnijAudio() {
      if (P.audio || smoke || !P.dzwiek || !P.plan) return P.audio;
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) { console.warn('Geologia/uwaga: lektor niedostępny (brak Web Audio) — film z napisami'); return null; }
      var ctx;
      root.GeologiaLektor.trybOdtwarzania(root.navigator);          // iOS: dźwięk mimo przełącznika wyciszenia (gest)
      try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { console.warn('Geologia/uwaga: lektor niedostępny (AudioContext: ' + (e && e.message || e) + ')'); return null; }
      var dz = null;
      try { if (root.GeologiaDzwiek) dz = root.GeologiaDzwiek.utworz(ctx); } catch (e) {
        console.warn('Geologia/uwaga: podkład niedostępny (' + (e && e.message || e) + ') — film bez podkładu'); dz = null;
      }
      var zr = P.zrodlo, zLektorem = maLektora() && zr && zr.baza && root.GeologiaLektor;
      var adres = zLektorem ? function (plik) { return zr.baza + plik + zr.zapytanie; } : '';
      var lek = root.GeologiaLektor.utworz(adres, zLektorem ? P.czasyLektora : null, ctx, { wyjscie: dz ? dz.wejscie : null, cicho: !zLektorem });
      P.audio = { ctx: ctx, dz: dz, lek: lek, zakotwiczony: false, wznawia: 0, wznowiono: 0 };
      if (!P.dzwiek) { lek.cisza(true); if (dz) dz.cisza(true); }
      wznowAudio();
      return P.audio;
    }
    function zwolnijAudio() {
      var A = P.audio;
      if (!A) return;
      P.audio = null;
      try { A.lek.zwolnij(); } catch (_) { /* nic */ }
      try { if (A.dz) A.dz.zwolnij(); } catch (_) { /* nic */ }
      try { A.ctx.close(); } catch (_) { /* nic */ }
    }
    // nagrania rozdziału i następnego dekodowane z wyprzedzeniem (R6); `czekaj` = zegar stoi do gotowości (≤ 3 s)
    function przygotujLektora(i, czekaj) {
      var A = P.audio;
      if (!A || !P.plan) return;
      var ids = P.plan[i].wersy.map(function (w) { return w.id; });
      if (P.plan[i + 1]) ids = ids.concat(P.plan[i + 1].wersy.map(function (w) { return w.id; }));
      var nr = ++P.czeka;
      var gotowe = function () { if (P.czeka === nr) { P.czeka = 0; if (P.audio) P.audio.zakotwiczony = false; } };
      if (!czekaj) { P.czeka = 0; A.lek.przygotuj(ids); return; }
      A.lek.przygotuj(P.plan[i].wersy.map(function (w) { return w.id; })).then(gotowe, gotowe);
      setTimeout(gotowe, 3000);
      A.lek.przygotuj(ids);
    }
    function stanLektora() {
      if (smoke) return 'cisza';
      if (!P.audio) return 'brak';
      return P.audio.lek.stan();
    }
    // wznowienie kontekstu (po pauzie, karcie w tle, starcie): do rozstrzygnięcia obietnicy film stoi (najwyżej 3 s) —
    // inaczej zegar klatek uciekłby dźwiękowi i wznowienie nie grałoby od miejsca zatrzymania (LEK-3)
    function wznowAudio() {
      var A = P.audio;
      if (!A || A.ctx.state === 'closed') return;
      root.GeologiaLektor.trybOdtwarzania(root.navigator);
      A.wznawia = performance.now();
      A.ctx.resume().then(function () { if (P.audio === A) A.wznawia = 0; }, function () { if (P.audio === A) A.wznawia = 0; });
    }
    // zegar filmu: AudioContext, gdy gra; wstrzymany kontekst (blokada autoplay, przerwanie) → zegar klatek
    function krokZegara(r, dt) {
      var A = P.audio;
      if (!A) { P.t += Math.min(dt, 0.1); return 'klatki'; }
      if (A.ctx.state === 'running') {
        if (!A.zakotwiczony) { A.lek.kotwicz(P.t); A.zakotwiczony = true; }
        var z = A.lek.zegar();
        if (z !== null) P.t = z;
        return 'audio';
      }
      var teraz = performance.now();
      if (A.wznawia && teraz - A.wznawia < 3000) return 'czeka';
      if (teraz - A.wznowiono > 1000) { A.wznowiono = teraz; A.ctx.resume().then(null, function () { /* blokada */ }); }
      A.zakotwiczony = false;
      P.t += Math.min(dt, 0.1);
      return 'klatki';
    }

    /* ---------- sterowanie seansem ---------- */
    // ciagle = naturalny koniec rozdziału (zegar dźwięku przesuwa się bez przerwy); inaczej skok = nowa kotwica
    function ustawRozdzial(i, t, ciagle) {
      if (!P.plan) return;
      var poprz = P.plan[P.ri];
      P.ri = Math.max(0, Math.min(P.plan.length - 1, i));
      P.t = Math.max(0, Math.min(P.plan[P.ri].czas - 1e-3, t || 0));
      P.koniec = false; P.brudny = true;
      if (ui) ui.kartaKoniec.hidden = true;
      P.stan.etykiety = null;
      P.akcenty = root.GeologiaDzwiek ? root.GeologiaDzwiek.akcenty(P.plan[P.ri]) : [];
      P.tAkcentu = P.t;
      if (P.audio) {
        if (ciagle && P.audio.zakotwiczony) P.audio.lek.przesun(poprz.czas);
        // skok (←/→, pasek, znacznik — także z pauzy): wersy starego miejsca milkną od razu, nie po zdekodowaniu nowych
        // (recenzja 9a I-4); nowa kotwica przychodzi po czekaniu na nagrania
        else { P.audio.lek.zatrzymaj(); P.audio.zakotwiczony = false; }
        przygotujLektora(P.ri, !ciagle);
      }
      zapewnijGlob(P.ri);
      c.zmianaRozdzialu(P.plan[P.ri].id);
    }
    function grajDalej() {
      if (smoke) return;
      if (P.dzwiek && !P.audio && zapewnijAudio()) przygotujLektora(P.ri, true);
      if (P.audio) { P.audio.zakotwiczony = false; wznowAudio(); }
      P.gra = true; P.pauza = false;
      if (ui) ui.kartaStart.hidden = true;
      P.karta = false;
      odswiezGuziki();
      if (cisza) cisza.wstrzymaj(false);
    }
    function start(zDzwiekiem) { ustawDzwiek(zDzwiekiem); grajDalej(); }
    function pokazKarteStart() {
      P.karta = true; P.gra = false;
      ui.kartaStartTytul.textContent = c.nazwaMiejsca(P.miejsce) + ' — ' + P.plan.length + ' filmów';
      odswiezLektora();
      ui.kartaStart.hidden = false;
      if (cisza) cisza.wstrzymaj(true);
      try { ui.bStartGlos.focus({ preventScroll: true }); } catch (_) { /* nic */ }
    }
    function pauza(wl) {
      if (!P.gotowy || P.karta || P.koniec || smoke) return;
      P.pauza = wl == null ? !P.pauza : !!wl;
      // pauza = ctx.suspend(): czas kontekstu stoi, więc wznowienie gra dźwięk i obraz od miejsca zatrzymania (LEK-3)
      if (P.audio) { if (P.pauza) { P.audio.wznawia = 0; P.audio.lek.pauza(); } else wznowAudio(); }
      odswiezGuziki();
      if (cisza) cisza.wstrzymaj(P.pauza);
    }
    // karta w tle: film i dźwięk stają, po powrocie grają od miejsca zatrzymania (spec R6)
    function widocznosc() {
      if (!P.aktywny || smoke) return;
      if (doc.hidden) { if (P.gra && !P.pauza && !P.karta && !P.koniec) { P.autoPauza = true; pauza(true); } }
      else if (P.autoPauza) { P.autoPauza = false; pauza(false); }
    }
    doc.addEventListener('visibilitychange', widocznosc);
    function krokRozdzialu(d) {
      if (!P.gotowy) return;
      var i = P.ri + d;
      if (i < 0 || i >= P.plan.length) return;
      ustawRozdzial(i, 0);
      if (!P.karta) grajDalej();
    }
    function przewinDo(ulamek) {
      var s = ulamek * P.suma;
      for (var i = P.plan.length - 1; i >= 0; i--) if (s >= P.starty[i]) { ustawRozdzial(i, s - P.starty[i]); break; }
      if (!P.karta) grajDalej();
    }
    // M i przycisk „Dźwięk” wyciszają lektora i podkład razem; włączenie to gest — tu powstaje AudioContext, gdy go nie było
    function ustawDzwiek(wl) {
      P.dzwiek = !!wl;
      if (P.dzwiek && !P.audio && P.gra && zapewnijAudio()) przygotujLektora(P.ri, true);
      if (P.audio) { P.audio.lek.cisza(!P.dzwiek); if (P.audio.dz) P.audio.dz.cisza(!P.dzwiek); }
      odswiezGuziki();
    }
    // Czy film ma lektora: jedno źródło — plan rozdziałów (Rozdzialy.plan → rozdzial.lektor, z czasów aktualnych nagrań
    // z czasy.json, który przychodzi tylko z zaproszeniem albo lokalnie). Bez nagrań przycisk nie obiecuje lektora:
    // „Odtwórz” + dopisek „lektor na zaproszenie” (bez tokenu, 403, wygasłe) albo „lektor w przygotowaniu” (404, nieaktualne).
    // Podkład gra dla wszystkich, więc „bez dźwięku”, przycisk „Dźwięk” i M są zawsze (ruling 9-2, 9-4).
    function maLektora() { return !!(P.plan && P.plan.some(function (r) { return r.lektor; })); }
    // host bez lektora (voyager i inne, decyzja właściciela: lektor tylko na kodownik.co) → bez dopisku: strona dla całego
    // świata nie obiecuje zaproszenia do klonu głosu, którego tam nie da się odtworzyć
    function dopisekLektora() {
      return P.powodBezLektora === 'host' ? null : P.powodBezLektora === 'przygotowanie' ? 'lektor w przygotowaniu' : 'lektor na zaproszenie';
    }
    function odswiezLektora() {
      var l = maLektora(), d = dopisekLektora();
      ui.bStartGlos.textContent = l ? 'Odtwórz z lektorem' : 'Odtwórz';
      ui.bStartGlos.title = l ? 'Film z lektorem i dźwiękiem' : 'Odtwórz film z napisami i podkładem dźwiękowym' + (d ? ' (' + d + ')' : '');
      ui.bStartCisza.hidden = false;
      if (ui.kartaStartDopisek.textContent !== (d || '')) ui.kartaStartDopisek.textContent = d || '';
      ui.kartaStartDopisek.hidden = l || !d;
      ui.bDzwiek.hidden = false;
      // jedna ikona „bez lektora” (spec „Lektor”): nagrania obiecane planem, a odtwarzanie ich nie ma (błąd, blokada)
      ui.bezLektora.hidden = !(l && P.dzwiek && P.audio && stanLektora() === 'brak');
    }
    function odswiezGuziki() {
      if (!ui) return;
      odswiezLektora();
      ui.bPauza.textContent = P.pauza || !P.gra ? '▶' : '❚❚';
      ui.bPauza.title = P.pauza || !P.gra ? 'Odtwórz (spacja)' : 'Pauza (spacja)';
      ui.bDzwiek.setAttribute('aria-pressed', String(P.dzwiek));
      ui.bDzwiek.textContent = P.dzwiek ? 'Dźwięk' : 'Bez dźwięku';
    }
    function pokazKoniec() {
      P.koniec = true; P.gra = false;
      if (P.audio) P.audio.lek.pauza();
      ui.kartaKoniecTytul.textContent = c.nazwaMiejsca(P.miejsce) + ' — koniec';
      ui.kartaKoniec.hidden = false;
      if (cisza) cisza.wstrzymaj(true);
      odswiezGuziki();
    }
    function klawisz(k) {
      if (!P.aktywny) return false;
      if (k === ' ') { if (P.karta) start(P.dzwiek); else pauza(); return true; }
      if (k === 'ArrowRight') { krokRozdzialu(1); return true; }
      if (k === 'ArrowLeft') { krokRozdzialu(-1); return true; }
      if (k === 'm' || k === 'M') { ustawDzwiek(!P.dzwiek); return true; }
      return false;
    }

    /* ---------- montaż i stan obrazu w chwili t ---------- */
    function ujecieAnim(r, u) { return r.animacje.filter(function (a) { return a.ujecie === u.id; })[0] || null; }
    function fAnim(a, t) { return a.f[0] + (a.f[1] - a.f[0]) * clamp01((t - a.od) / Math.max(1e-6, a.do - a.od)); }
    function zdarzeniaUjecia(r, u, t, prefiks) {
      return r.zdarzenia.filter(function (z) { return z.ujecie === u.id && z.t <= t && z.co.indexOf(prefiks) === 0; });
    }
    // czerń C (między rozdziałami i w nich), czerń celowa Cc, biel B, plansze — krycie z zegara filmu (spec R5)
    function zaslonaW(r, t) {
      if (zap.kontrola === 'biel') return [1, 1, 1, 1];
      if (zap.kontrola === 'czern') return [0, 0, 0, 1];
      var a = 0, kol = [0, 0, 0], U = r.ujecia;
      for (var i = 0; i < U.length; i++) {
        var u = U[i];
        if (u.typ === 'plansza' && t >= u.od && t < u.do) return [0, 0, 0, 1];
        var p = u.przejscie;
        if (!p || !(t >= p.od && t <= p.do)) continue;
        if (u.wejscie === 'Cc') return [0, 0, 0, 1];
        if (u.wejscie !== 'C' && u.wejscie !== 'B') continue;
        var b = u.od, q = t < b ? gladko((t - p.od) / Math.max(1e-6, b - p.od)) : 1 - gladko((t - b) / Math.max(1e-6, p.do - b));
        if (p.od >= b) q = 1 - gladko((t - b) / Math.max(1e-6, p.do - b));       // początek rozdziału: z czerni
        if (q > a) { a = q; kol = u.wejscie === 'B' ? [1, 1, 1] : [0, 0, 0]; }
      }
      // koniec rozdziału (nie ostatniego): druga połowa czerni C przed następnym
      if (P.ri < P.plan.length - 1 && t > r.czas - POL_C) { var k = gladko((t - (r.czas - POL_C)) / POL_C); if (k > a) { a = k; kol = [0, 0, 0]; } }
      return [kol[0], kol[1], kol[2], a];
    }
    // udział poziomu glob: przenikanie P glob ↔ archipelag (render target); archipelag ↔ wyspa to ta sama scena (wtapianie
    // geometryczne poziomów — scena.js), więc tam przenikanie jest ciągłe bez mieszania kadrów
    function globW(r, t, u) {
      var U = r.ujecia;
      for (var j = 1; j < U.length; j++) {
        var x = U[j], p = x.przejscie;
        if (x.wejscie !== 'P' || !p || t < p.od || t > p.do) continue;
        var a = U[j - 1].poziom === 'glob', b = x.poziom === 'glob';
        if (a === b) continue;
        var q = gladko((t - p.od) / Math.max(1e-6, p.do - p.od));
        return a ? 1 - q : q;
      }
      return u.poziom === 'glob' ? 1 : 0;
    }
    function ekspozycjaW(r, t, i) {
      var U = r.ujecia, e = function (j) { return U[j] && U[j].ekspozycja || 1; }, b, q;
      // szew D/P z poprzednim ujęciem: od granicy 1,5 s przejścia z wartości poprzedniego; ze następnym — 1,5 s przed granicą
      if (i > 0 && (U[i].wejscie === 'D' || U[i].wejscie === 'P') && t < U[i].od + 0.75) {
        b = U[i].od; q = gladko((t - (b - 0.75)) / 1.5); return e(i - 1) + (e(i) - e(i - 1)) * q;
      }
      if (i + 1 < U.length && (U[i + 1].wejscie === 'D' || U[i + 1].wejscie === 'P') && t > U[i + 1].od - 0.75) {
        b = U[i + 1].od; q = gladko((t - (b - 0.75)) / 1.5); return e(i) + (e(i + 1) - e(i)) * q;
      }
      return e(i);
    }
    function krycieEtykiet(r, t) {
      var ost = null;
      r.zdarzenia.forEach(function (z) { if (z.t <= t && (z.co === 'etykiety:gasna' || z.co === 'etykiety:wracaja')) ost = z; });
      if (!ost) return 1;
      return ost.co === 'etykiety:gasna' ? 1 - gladko((t - ost.t) / 0.3) : gladko((t - ost.t) / 0.5);
    }
    function ustawSwiatlo(sl) {
      var pora = poraSceny(sl.pora, sl.el), k = pora + '|' + sl.az.toFixed(2) + '|' + sl.el.toFixed(2);
      if (P.stan.swiatlo === k) return;
      P.stan.swiatlo = k;
      P.sc.swiatlo({ pora: pora, az: sl.az, el: sl.el });
    }
    function zastosuj(r, t) {
      var sc = P.sc, ch = R.chwila(r, t), u = r.ujecia[ch.indeks], S = P.stan, D = root.GeologiaTeneryfa || {};
      var an = ujecieAnim(r, u), nazwaAn = an ? an.nazwa : (r.stan.chmury ? 'a4' : null);
      // barwy i tryb bloku (przekrój: makieta-blok na czarnym tle)
      if (S.kolorowanie !== u.kolorowanie) { S.kolorowanie = u.kolorowanie; sc.kolorowanie(u.kolorowanie); }
      var blok = u.plakietka === 'schemat';
      if (S.blok !== blok) { S.blok = blok; sc.blok(blok); }
      ustawSwiatlo(ch.slonce);
      // przewyższenie: w trakcie rampy tylko skala (ściana przekroju się skaluje), po rampie jedna przebudowa (napisy ściany)
      var e = ch.przewyzszenie;
      if (S.e == null || Math.abs(S.e - e) > 1e-5) { sc.przewyzszenie(e, true); S.e = e; S.eRuch = true; }
      else if (S.eRuch) { sc.przewyzszenie(e); S.eRuch = false; }
      // przekrój N–S przez część z planu; ostrze jedzie 3 s od zdarzenia startu, w ostatnim ujęciu rozdziału — z powrotem
      var pk = r.stan.przekroj, ciecie = null;
      var Lc = null;
      if (pk && t >= pk.od) {
        var ost = r.ujecia[r.ujecia.length - 1];
        var L0 = GS.liniaPrzekroju(sc.granice.wyspa, sc.srodekPrzekroju, pk.kat_st, 0);
        var xz = Teren.doLokalnych(null, pk.lonLat[0], pk.lonLat[1]);
        var prz = L0 ? (xz[0] - L0.punkt[0]) * L0.normalna[0] + (xz[1] - L0.punkt[1]) * L0.normalna[1] : 0;
        Lc = GS.liniaPrzekroju(sc.granice.wyspa, sc.srodekPrzekroju, pk.kat_st, prz);
      }
      if (Lc) {
        var z0 = Math.min(Lc.a[1], Lc.b[1]), z1 = Math.max(Lc.a[1], Lc.b[1]), q;
        if (t < pk.od + OSTRZE_S) q = gladko((t - pk.od) / OSTRZE_S);
        else if (t >= ost.od) q = 1 - gladko((t - ost.od - 0.5) / OSTRZE_S);
        else q = 1;
        if (q > 0.001) ciecie = { kat_st: pk.kat_st, przesuniecie_km: prz, zb: q >= 0.999 ? null : z0 + (z1 - z0) * q };
      }
      var kc = ciecie ? ciecie.kat_st + '|' + ciecie.przesuniecie_km.toFixed(3) : '';
      if (S.ciecie !== kc) { S.ciecie = kc; sc.przekroj(ciecie ? { kat_st: ciecie.kat_st, przesuniecie_km: ciecie.przesuniecie_km } : null); }
      var zb = ciecie ? ciecie.zb : null;
      if (S.ostrze !== zb) { S.ostrze = zb; sc.ostrze(zb); }
      // warstwy ściany (zapalają się na swoich wersach) i jednostki mapy (wlewane według wieku, R9.3)
      var zdW = r.zdarzenia.filter(function (z) { return z.co.indexOf('warstwa:') === 0; });
      sc.warstwyPrzekroju(zdW.length ? function (id) { return zdW.some(function (z) { return z.co === 'warstwa:' + id && z.t <= t; }) ? 1 : 0; } : null);
      var zdJ = r.zdarzenia.filter(function (z) { return z.co.indexOf('jednostka:') === 0; });
      if (zdJ.length) {
        var ostJ = zdJ[zdJ.length - 1].t;
        sc.odslonJednostki(function (id) {
          var z = zdJ.filter(function (x) { return x.co === 'jednostka:' + id; })[0];
          return gladko((t - (z ? z.t : ostJ)) / 0.8);
        });
      } else sc.odslonJednostki(null);
      // woda: realna → szklana animowana 2,5 s od zdarzenia (R9.4), realna natychmiast (kamera przechodzi przez taflę)
      var stanWody = ch.woda, fw = 1;
      zdarzeniaUjecia(r, u, t + 1e9, 'woda:szklana').forEach(function (z) {
        if (t >= z.t && t < z.t + SZKLO_S) { stanWody = 'szklana'; fw = gladko((t - z.t) / SZKLO_S); }
      });
      var kw = stanWody + fw.toFixed(3);
      if (S.woda !== kw) { S.woda = kw; sc.woda(stanWody, fw); }
      // chwila geologiczna (A1 i A3 ustawiają ją same — bez przełączania co klatkę)
      if (nazwaAn !== 'a1' && nazwaAn !== 'a3' && S.czas !== ch.czasMa) { S.czas = ch.czasMa; sc.czas(ch.czasMa); }
      if (nazwaAn === 'a1' || nazwaAn === 'a3') S.czas = null;
      // kamera (y już z przewyższeniem — Rozdzialy.kamera), potem klatka sceny i animacje (G-F: po animuj)
      var a = P.kadr ? P.kadr.w / P.kadr.h : 2.39;
      var p = R.kamera(r, t, P.siatka, a);
      kamera.position.fromArray(p.poz); kamera.up.set(0, 1, 0); kamera.lookAt(p.cel[0], p.cel[1], p.cel[2]);
      if (kamera.fov !== p.fov || kamera.aspect !== a) { kamera.fov = p.fov; kamera.aspect = a; kamera.updateProjectionMatrix(); }
      P.poza = p;
      // mgiełka powietrza tylko z wysoka (z orbity widać całą kolumnę atmosfery; przy ziemi głębię daje mgła sceny),
      // nie w bloku przekroju; woda w pokazie jaśniejsza (ekspozycja kadrów z przewagą oceanu, spec R4)
      var mg = blok ? 0 : gladko((p.pozR[1] - MGIELKA_OD) / (MGIELKA_DO - MGIELKA_OD));
      sc.mgielka(mg, null, p.pozR[1]);
      if (S.wj !== JASNOSC_WODY) { S.wj = JASNOSC_WODY; sc.jasnoscWody(JASNOSC_WODY); }
      // ekspozycja ujęcia (`ekspozycja` w opowieści, dopasowanie przez cięcie K — EKS-6): na cięciu skok, przez szew D/P płynnie
      var ex = ekspozycjaW(r, t, ch.indeks);
      if (S.ex == null || Math.abs(S.ex - ex) > 1e-4) { S.ex = ex; sc.jasnoscNieba(JASNOSC_NIEBA * ex); c.renderer.toneMappingExposure = EKSPOZYCJA * ex; }
      sc.animuj(t);
      if (P.anim) {
        if (nazwaAn) {
          var f = an ? fAnim(an, t) : (function () {
            // morze chmur przez cały rozdział z A4: poza ujęciem animacji f stoi na jej brzegu, chmury dryfują z czasem
            var a4 = r.animacje.filter(function (x) { return x.nazwa === 'a4'; })[0];
            return a4 ? (t < a4.od ? a4.f[0] : a4.f[1]) : 0;
          })();
          var wyn = P.anim[FUNKCJE_ANIM[nazwaAn]](f, t);
          if (nazwaAn === 'a1') P.sc.efekty.zar(ZAR_A1);        // żar A1 w filmie słabszy niż w makiecie (EKS-1: H6 w dzień)
          P.animAkt = nazwaAn;
          P.a2 = nazwaAn === 'a2' ? wyn : null;
          P.fAn = f;
        } else if (P.animAkt) { P.anim.ukryj(); P.animAkt = null; P.a2 = null; S.miasta = null; }
      }
      swiatlaMiast(r, u, ch, t, nazwaAn);
      obrys(r, u, t);
      return { glob: globW(r, t, u), zaslona: zaslonaW(r, t), u: u, ch: ch, an: an };
    }
    // światła okien w miastach (części `miasto`): o zmierzchu i nocą, w dzisiejszej rzeźbie, poza A2 (A2 ma własne);
    // zdarzenie `okna-gasna` gasi je po kolei w 5 s
    function swiatlaMiast(r, u, ch, t, nazwaAn) {
      if (!P.anim) return;
      var D = root.GeologiaTeneryfa || {}, el0 = ch.slonce.el;
      var wl = el0 < 5 && !(ch.czasMa > 0) && nazwaAn !== 'a2';
      var zg = clamp01((el0 + 1) / 6);
      zdarzeniaUjecia(r, u, t, 'okna-gasna').forEach(function (z) { zg = Math.max(zg, gladko((t - z.t) / 5)); });
      var k = wl ? zg.toFixed(2) : 'x';
      if (P.stan.miasta === k && !wl) return;
      P.stan.miasta = k;
      (D.czesci || []).forEach(function (cz) {
        if (cz.rodzaj !== 'miasto') return;
        if (wl) P.anim.swiatlaMiasta(cz.id, zg);
        else { var o = P.sc.scena.getObjectByName('swiatla-' + cz.id); if (o) o.visible = false; }
      });
    }
    // obrys doliny (zdarzenie `obrys:<część>`): łuna sceny wzdłuż wielokąta jednostki doliny — jedna naraz, najnowsza
    function obrys(r, u, t) {
      var zd = zdarzeniaUjecia(r, u, t, 'obrys:'), D = root.GeologiaTeneryfa || {};
      var id = zd.length ? zd[zd.length - 1].co.slice(6) : null;
      if (P.animAkt === 'a2') return;
      var k = id ? id + '|' + gladko((t - zd[zd.length - 1].t) / 0.8).toFixed(2) : '';
      if (P.obrys === k) return;
      P.obrys = k;
      if (!id) { P.sc.efekty.luna(null); return; }
      var j = (D.jednostki || []).filter(function (x) { return x.id === 'dolina-' + id || x.id === id; })[0];
      var ring = j && j.wielokaty && j.wielokaty[0];
      if (!ring) { P.sc.efekty.luna(null); return; }
      var krok = Math.max(1, Math.ceil(ring.length / 22)), pkt = [];
      for (var i = 0; i < ring.length; i += krok) pkt.push(Teren.doLokalnych(null, ring[i][0], ring[i][1]));
      pkt.push(pkt[0]);
      var s = gladko((t - zd[zd.length - 1].t) / 0.8) * 0.9;
      P.sc.efekty.luna(pkt.slice(0, 24), [0.55 * s, 0.85 * s, 1.0 * s], 0.12);
    }

    /* ---------- nakładki filmu ---------- */
    function ustawTekst(e, t) { if (e.textContent !== t) e.textContent = t; var h = !t; if (e.hidden !== h) e.hidden = h; }
    function krycie(e, a) { var v = a >= 0.999 ? '' : a.toFixed(3); if (e.style.opacity !== v) e.style.opacity = v; }
    function plakietka(r, u, an) {
      if (u.typ === 'plansza') return ['', ''];
      var t1 = u.plakietka ? PLAKIETKI[u.plakietka] || u.plakietka.toUpperCase() : '';
      if (t1 && u.plakietka === 'rekonstrukcja' && an && (an.nazwa === 'a2' || an.nazwa === 'a3') && an.f[0] !== an.f[1]) t1 += ' · czas przyspieszony';
      var t2 = u.woda === 'szklana' && u.plakietka !== 'dno' && u.poziom !== 'glob' ? PLAKIETKI.dno : '';
      return [t1, t2];
    }
    function licznik(r, u, ch, an, t) {
      var D = root.GeologiaTeneryfa || {};
      if (u.typ === 'plansza' || u.poziom === 'glob') return '';
      if (an && an.nazwa === 'a2') {
        var e = (D.erupcje || []).filter(function (x) { return x.przebieg && x.przebieg.length; })[0];
        if (!e) return '';
        var f = fAnim(an, t), pr = e.przebieg, i = f < 0.08 ? 0 : f < 0.1 ? 1 : f < 0.6 ? 2 : f < 1 ? 3 : 4;
        return String(pr[Math.min(pr.length - 1, i)].kiedy).split(',')[0];
      }
      var er = r.zdarzenia.filter(function (z) { return z.ujecie === u.id && z.co.indexOf('erupcja:') === 0; });
      if (er.length) {
        var odp = er.filter(function (z) { return z.t <= t; }), z = odp.length ? odp[odp.length - 1] : er[0];
        var x = (D.erupcje || []).filter(function (q) { return q.id === z.co.slice(8); })[0];
        return x ? String(x.rok) : '';
      }
      if ((an && an.nazwa === 'a1') || u.czasMa) {
        var Ma = ch.czasMa;
        if (!(an && an.nazwa === 'a1')) {
          var j = (D.jednostki || []).filter(function (q) { return q.zapadniecie && q.zapadniecie.zakresMa && Math.abs(q.zapadniecie.Ma - Ma) < 0.01; })[0];
          if (j) { var zk = j.zapadniecie.zakresMa; return 'ok. ' + Math.round(Math.min(zk[0], zk[1]) * 1000) + '–' + Math.round(Math.max(zk[0], zk[1]) * 1000) + ' tys. lat temu'; }
        }
        return tekstCzasu(Ma);
      }
      // ostatnie ujęcie rozdziału z A1: licznik wraca do „dziś” (R9.4 W9)
      var maA1 = r.animacje.some(function (x) { return x.nazwa === 'a1'; });
      if (maA1 && u === r.ujecia[r.ujecia.length - 1]) return 'dziś';
      return '';
    }
    function nakladki(r, t, o) {
      var u = o.u, an = o.an, D = root.GeologiaTeneryfa || {}, k = P.kadr;
      if (!k) return;
      var zaslonieta = o.zaslona[3] > 0.98;
      // G-L plakietka, G-S licznik
      var pl = plakietka(r, u, an);
      ustawTekst(ui.plak, pl[0]); ustawTekst(ui.plak2, pl[1]); ustawTekst(ui.plak3, u.typ === 'plansza' ? '' : u.podpis || '');
      ustawTekst(ui.gs, licznik(r, u, o.ch, an, t));
      // G-P: przewyższenie z podziałką (nie na globie, nie na planszy; w rozdziale ze zdarzeniem `podpis:przewyzszenie` od niego)
      var podpis = r.zdarzenia.filter(function (z) { return z.co === 'podpis:przewyzszenie'; })[0];
      var gp = u.poziom !== 'glob' && u.typ !== 'plansza' && !(podpis && t < podpis.t) && !zaslonieta;
      if (ui.gp.hidden === gp) ui.gp.hidden = !gp;
      if (gp) {
        ustawTekst(ui.przew, 'wysokości ×' + liczba(o.ch.przewyzszenie, 1));
        var H = R.wysokoscKadru(P.poza), pxKm = k.h / Math.max(1e-6, H), dl = null;
        [100, 10, 1].forEach(function (x) { if (dl === null && x * pxKm <= 0.2 * k.w && x * pxKm >= 24) dl = x; });
        if (dl === null) dl = 100 * pxKm < 24 ? 100 : 1;
        var szer = Math.round(Math.min(0.25 * k.w, dl * pxKm)) + 'px';
        if (ui.podzBelka.style.width !== szer) ui.podzBelka.style.width = szer;
        ustawTekst(ui.podzTekst, dl + ' km');
      }
      // T-L: tytuł rozdziału 3 s na pierwszym ujęciu po planszach; stempel werdyktu po cięciu na dowód mitu
      var pierwsze = r.ujecia.filter(function (x) { return x.typ !== 'plansza'; })[0], tt = t - pierwsze.od;
      var aT = tt >= 0 && tt <= TYTUL_S + 0.6 ? Math.min(gladko(tt / 0.5), 1 - gladko((tt - TYTUL_S) / 0.6)) : 0;
      ustawTekst(ui.tytul, aT > 0.001 ? r.tytul : ''); krycie(ui.tytul, aT);
      var mit = /-(teza|dowod)$/.exec(u.id) ? (D.mity || []).filter(function (m) { return u.id.indexOf('/' + m.id + '-') >= 0; })[0] : null;
      var ts = t - u.od, aS = mit && /-dowod$/.test(u.id) && ts <= STEMPEL_S + 0.5 ? Math.min(gladko(ts / 0.15), 1 - gladko((ts - STEMPEL_S) / 0.5)) : 0;
      ustawTekst(ui.stempel, aS > 0.001 ? WERDYKTY[mit.werdykt] || mit.werdykt.toUpperCase() : '');
      if (aS > 0.001) { ui.stempel.dataset.werdykt = mit.werdykt; krycie(ui.stempel, aS); }
      // teza mitu jako duży napis w polu S po lewej (R9.8)
      var aZ = mit && /-teza$/.test(u.id) ? Math.min(gladko(ts / 0.6), 1 - gladko((t - (u.do - 0.5)) / 0.5)) : 0;
      ustawTekst(ui.teza, aZ > 0.001 ? '„' + mit.teza + '”' : ''); krycie(ui.teza, aZ);
      // plansza: tytuł miejsca (jedyna pełna plansza) albo „schemat” w czerni celowej Cc
      var plansza = '';
      if (u.typ === 'plansza') plansza = u.wejscie === 'Cc' ? 'schemat' : c.nazwaMiejsca(P.miejsce).toUpperCase();
      var aP = plansza ? Math.min(gladko((t - u.od) / 0.4), 1 - gladko((t - (u.do - 0.4)) / 0.4)) : 0;
      ustawTekst(ui.planszaTekst, plansza); ui.plansza.hidden = !plansza; krycie(ui.plansza, aP);
      ui.plansza.dataset.rodzaj = u.wejscie === 'Cc' ? 'schemat' : 'tytul';
      // napisy: jedno zdanie naraz (KinoKadr.podzielNapis), tekst wersu z opowieści
      var wers = null;
      for (var i = 0; i < r.wersy.length; i++) if (t >= r.wersy[i].start && t <= r.wersy[i].koniec) { wers = r.wersy[i]; break; }
      var tekst = '';
      if (wers) {
        var w0 = ((root.GeologiaOpowiesc.wersy[r.id]) || []).filter(function (x) { return x.id === wers.id; })[0];
        if (w0) {
          var cz = KK.podzielNapis(w0.tekst, wers.koniec - wers.start, 84), dt = t - wers.start;
          for (var j = 0; j < cz.length; j++) if (dt >= cz[j].od && dt <= cz[j].do + 1e-6) { tekst = cz[j].tekst; break; }
        }
      }
      if (P.napis !== tekst) { P.napis = tekst; napisy.pokaz(tekst); korzen.classList.toggle('ge-kino-mowi', !!tekst); }
      etykiety(r, u, t, zaslonieta);
      // pasek postępu
      var poz = (P.starty[P.ri] + t) / P.suma, sz = (poz * 100).toFixed(2) + '%';
      if (ui.postepPas.style.width !== sz) { ui.postepPas.style.width = sz; ui.postep.setAttribute('aria-valuenow', String(Math.round(poz * 100))); }
    }
    // Czy prostokąt (px kadru) leży nad lądem: siatka 15 × 9 próbek (co ok. 15 px na telefonie), promień z kamery do tafli (y = 0), wysokość
    // wyświetlanej powierzchni (wstawki > wyspa > archipelag — Gran Canaria też) > 0.
    var lpA = null, lpB = null;
    function nadLadem(x0, y0, x1, y1, k) {
      lpA = lpA || new T.Vector3(); lpB = lpB || new T.Vector3();
      for (var iy = 0; iy < 9; iy++) for (var ix = 0; ix < 15; ix++) {
        var px = x0 + (x1 - x0) * ix / 14, py = y0 + (y1 - y0) * iy / 8, nx = px / k.w * 2 - 1, ny = 1 - py / k.h * 2;
        lpA.set(nx, ny, -1).unproject(kamera); lpB.set(nx, ny, 1).unproject(kamera);
        if (!(lpA.y > 0) || !(lpB.y < lpA.y)) continue;
        var f = lpA.y / (lpA.y - lpB.y), h = P.sc.wysokosc(lpA.x + (lpB.x - lpA.x) * f, lpA.z + (lpB.z - lpA.z) * f);
        if (h != null && h > 0) return true;
      }
      return false;
    }
    // Miejsce etykiety kierunkowej (NDC [x, y]): wyjściowe, a gdy napis z marginesem (2,5 wiersza pod, 1 nad i 1 w poziomie
    // — napis tuż nad wyspą czyta się jak jej nazwa) zasłania ląd — pierwsze wolne WZDŁUŻ krawędzi, którą wskazuje strzałka:
    // przy krawędzi bocznej (strona ±1) w pionie — najpierw w stronę pionowej składowej strzałki (pion −1 dla ↘ ↙, +1 dla ↗ ↖),
    // potem w przeciwną, dla → ← naprzemiennie; przy krawędzi dolnej/górnej (↓ ↑) w poziomie, naprzemiennie. Krok ¼ wiersza
    // (pion) albo 12 px (poziom), w obrębie pola S; bez wolnego miejsca — wyjściowe.
    function wolneMiejsceKrawedzi(tekstEl, vx, vy, strona, k, dolS, pion) {
      var w = tekstEl.offsetWidth, h = tekstEl.offsetHeight;
      // margines: pod napisem 2,5 wiersza (etykiety w tym polu stoją NAD swoim obiektem — ląd tuż pod napisem czyta się
      // jak jego obiekt), nad napisem 1 wiersz
      var wiersz = h / Math.max(1, (tekstEl.textContent.match(/\n/g) || []).length + 1), mgDol = h / 2 + 2.5 * wiersz, mgGora = h / 2 + wiersz;
      var limY = [dolS + h / k.h, 0.82 - h / k.h], limX = [-KRAWEDZ_X + w / k.w, KRAWEDZ_X - w / k.w];
      var wolne = function (x, y) {
        if (y < limY[0] || y > limY[1]) return false;
        var ax = (x + 1) / 2 * k.w, ay = (1 - y) / 2 * k.h, x0 = strona > 0 ? ax - w : strona < 0 ? ax : ax - w / 2;
        return !nadLadem(x0 - wiersz, ay - mgGora, x0 + w + wiersz, ay + mgDol, k);
      };
      if (wolne(vx, vy)) return [vx, vy];
      var j, q, krokY = Math.max(0.005, wiersz / k.h * 2 / 4), krokX = 24 / k.w;
      if (!strona) {                                   // krawędź dolna / górna pola S: szukanie w poziomie
        for (j = 1; j <= 200; j++) {
          var pr = vx + j * krokX, lw = vx - j * krokX;
          if (pr > limX[1] && lw < limX[0]) break;
          if (pr <= limX[1] && wolne(pr, vy)) return [pr, vy];
          if (lw >= limX[0] && wolne(lw, vy)) return [lw, vy];
        }
        return [vx, vy];
      }
      if (pion) {
        for (var kier = pion, n = 0; n < 2; n++, kier = -kier) for (j = 1; j <= 200; j++) {
          q = vy + kier * j * krokY;
          if (q < limY[0] || q > limY[1]) break;
          if (wolne(vx, q)) return [vx, q];
        }
        return [vx, vy];
      }
      for (j = 1; j <= 200; j++) {
        var g = vy + j * krokY, d = vy - j * krokY;
        if (g > limY[1] && d < limY[0]) break;
        if (wolne(vx, g)) return [vx, g];
        if (wolne(vx, d)) return [vx, d];
      }
      return [vx, vy];
    }
    // etykiety miejsc: najwyżej 3, tylko w polu S (nad polem D napisów), gasną 0,4 s przed przejściem (zdarzenia planu)
    function etykiety(r, u, t, zaslonieta) {
      var D = root.GeologiaTeneryfa || {}, lista = [], k = P.kadr, pion = k.h > k.w;
      var dodaj = function (id, tekst, ll) { if (!lista.some(function (x) { return x.id === id; })) lista.push({ id: id, tekst: tekst, ll: ll }); };
      var czesc = function (id) { return (D.czesci || []).filter(function (x) { return x.id === id; })[0]; };
      var podpisCzesci = function (cz) { return cz.nazwa + (cz.rodzaj === 'stratowulkan' && cz.wys_m ? ' · ' + cz.wys_m + ' m' : ''); };
      (u.etykiety || []).forEach(function (id) { var cz = czesc(id); if (cz) dodaj(id, podpisCzesci(cz), cz.lonLat); });
      // etykiety miejsc spoza części (cała wyspa, ląd sąsiedni); odległość z dane.fakty[].liczby
      (u.etykietyMiejsc || []).forEach(function (m) {
        var t2 = m.nazwa, o = m.odleglosc, f = o && (D.fakty || []).filter(function (x) { return x.id === o.fakt; })[0], l = f && f.liczby && f.liczby[o.liczba];
        if (l) t2 += ' · ok. ' + l.wartosc + ' ' + l.jednostka;
        dodaj('miejsce:' + m.nazwa, t2, m.lonLat);
        // ląd z odległością poza kadrem: znacznik przy krawędzi pola S w jego kierunku (R9.1: „przy prawej krawędzi”)
        if (o) lista[lista.length - 1].krawedz = true;
      });
      r.zdarzenia.forEach(function (z) {
        if (z.ujecie !== u.id || z.t > t) return;
        var m = /^(etykieta|obrys):(.+)$/.exec(z.co), cz = m && czesc(m[2]);
        if (cz) dodaj(m[2], podpisCzesci(cz), cz.lonLat);
        var e = /^erupcja:(.+)$/.exec(z.co), x = e && (D.erupcje || []).filter(function (q) { return q.id === e[1]; })[0];
        if (x && x.lonLat) dodaj(x.id, String(x.rok), x.lonLat);
      });
      var a = zaslonieta ? 0 : krycieEtykiet(r, t), uzyte = 0, v = new T.Vector3(), dolS = -1 + 2 * (pion ? 0.32 : 0.26);
      lista.slice(-MAKS_ETYKIET).forEach(function (q) {
        var xz = Teren.doLokalnych(null, q.ll[0], q.ll[1]), y = P.sc.wysokosc(xz[0], xz[1]);
        v.set(xz[0], Math.max(0, y == null ? 0 : y), xz[1]).project(kamera);
        var poza = !(v.z < 1) || Math.abs(v.x) > 0.9 || v.y < dolS || v.y > 0.82, strzalka = '';
        if (poza && !q.krawedz) return;
        if (poza) {
          // kierunek z kamery (także za plecami: rzut odwrócony), przycięty do prostokąta pola S
          var dx = v.z < 1 ? v.x : -v.x, dy = v.z < 1 ? v.y - 0.15 : -(v.y - 0.15), sk = Math.min(0.78 / Math.max(1e-6, Math.abs(dx)), (dy > 0 ? 0.62 : (0.15 - dolS - 0.05)) / Math.max(1e-6, Math.abs(dy)));
          v.x = dx * sk; v.y = 0.15 + dy * sk;
          var kat = Math.atan2(dy, dx) / RAD;
          strzalka = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'][((Math.round(kat / 45) % 8) + 8) % 8];
        }
        // etykieta kierunkowa przy samej krawędzi kadru od strony strzałki (strzałka na zewnątrz, napis do środka)
        var strona = strzalka === '→' || strzalka === '↗' || strzalka === '↘' ? 1 : strzalka === '←' || strzalka === '↖' || strzalka === '↙' ? -1 : 0;
        if (strona) v.x = strona * KRAWEDZ_X;
        // wąski kadr (telefon): napis kierunkowy w dwóch wierszach (nazwa ze strzałką, pod nią odległość) — połowa szerokości
        var waska = !!strzalka && k.w < 600, czesci = q.tekst.split(' · '), nazwa = czesci[0], reszta = czesci.slice(1).join(' · ');
        var zeStrzalka = strona < 0 ? strzalka + ' ' + nazwa : nazwa + ' ' + strzalka;
        var E = ui.etykiety[uzyte++], tekst = !strzalka ? q.tekst : waska && reszta ? zeStrzalka + '\n' + reszta
          : (strona < 0 ? strzalka + ' ' + q.tekst : q.tekst + ' ' + strzalka);
        if (E.id !== q.id || E.tekst.textContent !== tekst) { E.id = q.id; E.tekst.textContent = tekst; }
        E.el.classList.toggle('ge-film-etykieta-krawedz', !!strzalka);
        E.el.classList.toggle('ge-film-etykieta-prawa', strona > 0);
        E.el.classList.toggle('ge-film-etykieta-lewa', strona < 0);
        E.el.classList.toggle('ge-film-etykieta-waska', waska);
        E.el.hidden = false;
        // etykieta kierunkowa nie może leżeć na innym lądzie (P3 na telefonie: „Afryka” nad Gran Canarią) — przesuwana
        // wzdłuż krawędzi w obrębie pola S do pierwszego miejsca nad samym morzem (wolneMiejsceKrawedzi)
        if (strzalka) {
          var m2 = wolneMiejsceKrawedzi(E.tekst, v.x, v.y, strona, k, dolS, strzalka === '↘' || strzalka === '↙' ? -1 : strzalka === '↗' || strzalka === '↖' ? 1 : 0);
          v.x = m2[0]; v.y = m2[1];
        }
        E.el.style.transform = 'translate(' + ((v.x + 1) / 2 * k.w).toFixed(1) + 'px,' + ((1 - v.y) / 2 * k.h).toFixed(1) + 'px)';
        krycie(E.el, a);
      });
      for (var i = uzyte; i < MAKS_ETYKIET; i++) { if (!ui.etykiety[i].el.hidden) ui.etykiety[i].el.hidden = true; ui.etykiety[i].id = null; }
    }

    /* ---------- klatka ---------- */
    function klatka(dt) {
      if (!P.aktywny || !P.gotowy || !P.sc || !P.kadr) return false;
      // smoke: zegar stoi — klatka tylko po zmianie (skok, rozmiar); render programowy w headless jest wolny
      if (smoke && !P.brudny) return true;
      P.brudny = false;
      var r = P.plan[P.ri];
      if (P.gra && !P.pauza && !P.koniec && !P.karta && !smoke && !P.czeka) {
        P.zegar = krokZegara(r, dt);
        if (P.t >= r.czas) {
          if (P.ri < P.plan.length - 1) { ustawRozdzial(P.ri + 1, P.t - r.czas, true); P.gra = true; r = P.plan[P.ri]; }
          else { P.t = r.czas - 1e-3; pokazKoniec(); }
        }
        if (P.audio && P.gra) P.audio.lek.planuj(r.wersy, 2.5);
      }
      var o = zastosuj(r, P.t);
      if (P.audio && P.audio.dz) podklad(r, o);
      // rozdział z kulą, która jeszcze się wczytuje (przeskok wstecz): czerń zamiast płaskiej sceny w miejscu globu
      if (potrzebaGlobu(r) && !P.sc.globGotowy()) { o.zaslona = [0, 0, 0, 1]; P.brudny = true; }
      P.ostatnie = { glob: o.glob, zaslona: o.zaslona };
      P.sc.kadr(P.ostatnie);
      nakladki(r, P.t, o);
      return true;
    }
    // podkład (geologia/dzwiek.js): poziomy warstw z ujęcia i wysokości kamery, akcenty w oddechach (odpalane w klatce,
    // w której zegar je mija — opóźnienie ≤ 1 klatka)
    function podklad(r, o) {
      var u = o.u, f = (P.t - u.od) / Math.max(1e-6, u.do - u.od), A = P.audio;
      var lv = root.GeologiaDzwiek.poziomy(u, f, { wys_km: P.poza ? P.poza.pozR[1] : undefined });
      if (!P.gra || P.pauza || P.koniec) lv = { wiatr: 0, morze: 0, pomruk: 0, ton: 0 };
      A.dz.ustaw(lv);
      var t0 = P.tAkcentu == null ? P.t : P.tAkcentu;
      if (P.gra && !P.pauza && P.t > t0 && P.t - t0 < 0.5) {
        P.akcenty.forEach(function (a) { if (a.t > t0 && a.t <= P.t) A.dz.akcent(a.co, A.ctx.currentTime); });
      }
      P.tAkcentu = P.t;
    }
    // kadr kinowy z całego kontenera (R1): canvas = prostokąt kadru, pasy = tło kontenera; nakładki filmu w kadrze
    function dopasuj(w, h) {
      var k = KK.kadrKinowy(w, h);
      P.kadr = k; P.w = w; P.h = h; P.brudny = true;
      zbudujUI();
      var s = ui.film.style;
      s.left = k.x + 'px'; s.top = k.y + 'px'; s.width = k.w + 'px'; s.height = k.h + 'px';
      s.setProperty('--ge-film-h', k.h + 'px');
      ui.film.dataset.pion = String(h > w);
      if (napisy) napisy.kadr(k, w, h);
      korzen.style.setProperty('--ge-kadr-dol', (k.pasDol + Math.round(k.h * (h > w ? 0.3 : 0.24))) + 'px');
      return k;
    }

    /* ---------- pomiar (smoke, spec R4): klatka kanwy bez nakładek, cel 320 px szerokości ---------- */
    function promien(nx, ny) {
      var o = kamera.position.clone(), d = new T.Vector3(nx, ny, 0.5).unproject(kamera).sub(o).normalize();
      return { o: o, d: d };
    }
    function trafienieTerenu(nx, ny) {
      var p = promien(nx, ny), s = 0.02, x, y, z, h;
      for (var i = 0; i < 400 && s < 60; i++) {
        x = p.o.x + p.d.x * s; y = p.o.y + p.d.y * s; z = p.o.z + p.d.z * s;
        h = P.sc.wysokosc(x, z);
        if (h != null && y <= h) return [x, y, z];
        s += Math.max(0.01, s * 0.02);
      }
      return null;
    }
    function pomiar(opcje) {
      if (!P.sc || !P.gotowy) return null;
      var sc = P.sc, o = P.ostatnie || { glob: 0 }, p, maska = null, a2 = P.animAkt === 'a2' && P.a2;
      if (a2) { var m = sc.maskaObiektu('lawa-1706', o, 320); if (m) { p = { w: m.w, h: m.h, px: m.px }; maska = m.maska; } }
      if (!p) p = sc.pomiarKadru(o, 320);
      var n = p.w * p.h, lum = new Float32Array(n), suma = 0, biale = 0, czarne = 0, px = p.px;
      for (var i = 0; i < n; i++) {
        var R0 = px[i * 4], G0 = px[i * 4 + 1], B0 = px[i * 4 + 2], Y = 0.2126 * R0 + 0.7152 * G0 + 0.0722 * B0;
        lum[i] = Y; suma += Y;
        if (R0 >= 250 && G0 >= 250 && B0 >= 250) biale++;
        if (R0 < 5 && G0 < 5 && B0 < 5) czarne++;
      }
      var sort = Array.prototype.slice.call(lum).sort(function (a, b) { return a - b; });
      var wyn = { srednia: suma / n, p50: sort[Math.floor(0.5 * (n - 1))], p97: sort[Math.floor(0.97 * (n - 1))], biale: biale / n, czarne: czarne / n,
        w: p.w, h: p.h, ujecie: P.plan[P.ri].ujecia[R.chwila(P.plan[P.ri], P.t).indeks].id, glob: o.glob, zaslona: o.zaslona ? o.zaslona[3] : 0 };
      if (maska) {
        var nl = 0, bl = 0, gr = 0;
        for (i = 0; i < n; i++) {
          if (!maska[i]) continue;
          nl++;
          if (px[i * 4] >= 250 && px[i * 4 + 1] >= 250 && px[i * 4 + 2] >= 250) bl++;
          gr += px[i * 4 + 1] / Math.max(1, px[i * 4]);
        }
        wyn.lawa = { piksele: nl / n, biale: nl ? bl / nl : 0, gDoR: nl ? gr / nl : null };
        // teren do 1 km od czoła (bez pikseli lawy): marsz promienia po rzeźbie na siatce co 3 px
        var cz = P.a2.czoloXZ, probki = [];
        for (var yy = 1; yy < p.h; yy += 3) for (var xx = 1; xx < p.w; xx += 3) {
          var k = yy * p.w + xx;
          if (maska[k]) continue;
          var hit = trafienieTerenu((xx + 0.5) / p.w * 2 - 1, (yy + 0.5) / p.h * 2 - 1);
          if (hit && Math.hypot(hit[0] - cz[0], hit[2] - cz[1]) <= 1) probki.push(lum[k]);
        }
        probki.sort(function (a, b) { return a - b; });
        wyn.terenPrzyLawie = { mediana: probki.length ? probki[Math.floor(probki.length / 2)] : null, n: probki.length };
      }
      // sylwetka (R4, noc A5: teren odróżnialny od nieba): mediany luminancji pikseli, w których promień trafia teren
      // (do 60 km), i pikseli nieba (promień nad horyzontem, bez terenu) — siatka co 4 px
      if (opcje && opcje.sylwetka || P.animAkt === 'a5') {
        var lt = [], ln = [];
        for (yy = 2; yy < p.h; yy += 4) for (xx = 2; xx < p.w; xx += 4) {
          var nx = (xx + 0.5) / p.w * 2 - 1, ny = (yy + 0.5) / p.h * 2 - 1, hitT = trafienieTerenu(nx, ny);
          if (hitT) lt.push(lum[yy * p.w + xx]);
          else if (promien(nx, ny).d.y > 0.01) ln.push(lum[yy * p.w + xx]);
        }
        var med = function (a) { a.sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : null; };
        wyn.sylwetka = { teren: med(lt), niebo: med(ln), nTeren: lt.length, nNiebo: ln.length };
      }
      // ocean: piksele, w których promień trafia taflę nad głęboką wodą (≥ 200 m) z danych rzeźby — mediana RGB
      if (o.zaslona[3] < 0.5) {
        var oc = [[], [], []], e = sc.przewyzszenie();
        for (yy = 2; yy < p.h; yy += 4) for (xx = 2; xx < p.w; xx += 4) {
          var pr = promien((xx + 0.5) / p.w * 2 - 1, (yy + 0.5) / p.h * 2 - 1);
          if (!(pr.d.y < -1e-4)) continue;
          var s = -pr.o.y / pr.d.y, X = pr.o.x + pr.d.x * s, Z = pr.o.z + pr.d.z * s, h = sc.wysokosc(X, Z);
          if (h == null || h > -0.2 * e) continue;
          k = (yy * p.w + xx) * 4;
          oc[0].push(px[k]); oc[1].push(px[k + 1]); oc[2].push(px[k + 2]);
        }
        if (oc[0].length >= 20) wyn.ocean = oc.map(function (a) { a.sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; });
      }
      if (opcje && opcje.porownaj && P.ostatniPomiar && P.ostatniPomiar.length === px.length) {
        var d = 0;
        for (i = 0; i < px.length; i += 4) d += Math.abs(px[i] - P.ostatniPomiar[i]) + Math.abs(px[i + 1] - P.ostatniPomiar[i + 1]) + Math.abs(px[i + 2] - P.ostatniPomiar[i + 2]);
        wyn.delta = d / (n * 3);
      }
      P.ostatniPomiar = new Uint8Array(px);
      return wyn;
    }
    // hak smoke: skok do chwili (rozdział, ułamek 0…1) i jedna klatka od razu
    function skok(rozdzialId, ulamek) {
      if (!P.gotowy) return null;
      var i = P.plan.map(function (r) { return r.id; }).indexOf(rozdzialId);
      if (i < 0) return null;
      ustawRozdzial(i, clamp01(+ulamek || 0) * P.plan[i].czas);
      klatka(0);
      return stan();
    }
    function stan() {
      var r = P.plan && P.plan[P.ri], ch = r ? R.chwila(r, P.t) : null;
      return { rozdzial: r ? r.id : null, ujecie: ch ? ch.ujecie : null, t: r ? P.t / r.czas : 0, czas_s: P.t, czasRozdzialu_s: r ? r.czas : null,
        gra: P.gra && !P.pauza, pauza: P.pauza, koniec: P.koniec, karta: P.karta ? 'odtworz' : P.koniec ? 'koniec' : null, dzwiek: P.dzwiek, lektor: maLektora(),
        lektorStan: stanLektora(), bezLektora: maLektora() ? null : dopisekLektora(), zegar: P.audio && P.audio.ctx.state === 'running' && P.audio.zakotwiczony ? 'audio' : 'klatki',
        audio: P.audio ? { ctx: P.audio.ctx.state, czas: P.audio.ctx.currentTime, zrodla: P.audio.lek.zrodla(), zdekodowane: P.audio.lek.zdekodowane(),
          podklad: !!P.audio.dz } : null,
        kadr: P.kadr ? { x: P.kadr.x, y: P.kadr.y, w: P.kadr.w, h: P.kadr.h, tryb: P.kadr.tryb } : null,
        glob: P.ostatnie ? P.ostatnie.glob : 0, zaslona: P.ostatnie && P.ostatnie.zaslona ? P.ostatnie.zaslona[3] : 0, napis: P.napis || '' };
    }

    return {
      wejdz: wejdz, wyjdz: wyjdz, klatka: klatka, dopasuj: dopasuj, klawisz: klawisz, pomiar: pomiar, skok: skok, stan: stan,
      gotowy: function () { return P.gotowy && P.aktywny; },
      audio: function () { return P.audio ? 1 : 0; },
      plan: function () { return P.plan; },
      scena: function () { return P.sc; }
    };
  }

  root.GeologiaPokaz = { utworz: utworz, poraSceny: poraSceny };
})(typeof window !== 'undefined' ? window : globalThis);
