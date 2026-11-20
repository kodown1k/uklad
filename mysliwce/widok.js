'use strict';
/* Zakładka Myśliwce — nakładka z własnym rendererem (plik przeglądarkowy; ładuje go leniwie mysliwce/ladowanie.js).
   window.Mysliwce = { otworz(stan), zamknij(), stan(), diagnostyka(), makieta(), rzutKotwicy(rodzaj) }.
   Tryby: hangar / pokaz / makieta. Hangar (Task 9) i pokaz (Task 8) jeszcze nie istnieją — do tego czasu każde
   wejście otwiera makietę (bez id: pierwszą maszynę raportu).
   Makieta: OrbitControls, raycast tylko po częściach makiety (bieżące transformacje — rozłożenie, drzwi komór),
   hover → podświetlenie części (fresnel), klik → karta części (nazwa, opis, pewność, źródło), przełączniki
   Rozłóż / Komory / Plan / Dopalacz (+ suwak ciągu), dźwięk (M), karta danych maszyny z raportu, pełny ekran (F) na
   kontenerze #mysliwce.
   Dopalacz: mysliwce/silniki.js (płomień na wszystkich wylotach dopięty do części `dysze` — rozkłada się z nią, jedno
   światło zbiorcze, bezwładność ciągu, przekazywanie do dźwięku); silniki są budowane z makietą i zwalniane z nią.
   Dźwięk: mysliwce/dzwiek.js, AudioContext tworzony leniwie dopiero w geście (Dopalacz albo M), karta w tle = pauza,
   powrót = rampa głośności; wyjście do Układu zamyka kontekst.
   Scena (tło, posadzka, światła, env PMREM) i makieta są budowane przy wejściu i zwalniane przy wyjściu do Układu;
   zostaje tylko renderer (jeden kontekst WebGL na całe życie strony).
   Hak testowy: ?smoke&mysliwiec=<id>&makieta → stały kadr, natychmiastowe stany, marker `MYSLIWCE_READY <id> makieta`;
   `&dopalacz[=0..1]` = silniki od razu na danym ciągu (domyślnie 1), płomień w stałej chwili t = 1 s, bez dźwięku;
   `&kadr=ogien|ogienbok|ogientyl` = kadry płomienia (¾ z tyłu, bok, prosto w dysze).
   Tekst z danych trafia do DOM wyłącznie przez textContent. Błędy własne: prefiks „Myśliwce: ”. */
(function () {
  var T = window.THREE, D = window.MysliwceDane, L = window.MysliwceLadowanie;
  var doc = document, $ = function (id) { return doc.getElementById(id); };
  var korzen = $('mysliwce');
  var zap = L.parsujZapytanieMysliwcow(location.search), smoke = zap.smoke;
  var NAZWY_PEWNOSCI = { wysoka: 'wysoka', srednia: 'średnia', niska: 'niska', 'bardzo-niska': 'bardzo niska' };
  var PODPIS = 'Makieta to rekonstrukcja z wymiarów raportu, zdjęć i grafik — nie rysunek techniczny.';

  /* ---------- DOM ---------- */
  function el(tag, klasa, tekst, rodzic) {
    var e = doc.createElement(tag);
    if (klasa) e.className = klasa;
    if (tekst != null) e.textContent = tekst;
    if (rodzic) rodzic.appendChild(e);
    return e;
  }
  function guzik(rodzic, tekst, tytul, klasa) {
    var b = el('button', 'my-guzik' + (klasa ? ' ' + klasa : ''), tekst, rodzic);
    b.type = 'button'; b.title = tytul; b.setAttribute('aria-pressed', 'false');
    return b;
  }
  var pasek = window.Zakladki && $('myPasek');
  var ui = {};
  (function zbudujUI() {
    ui.tytul = $('myTytul');
    ui.narzedzia = el('div', 'my-narzedzia', null, pasek);
    ui.rozloz = guzik(ui.narzedzia, 'Rozłóż', 'Widok rozstrzelony — części odsuwają się od kadłuba (R)');
    ui.komory = guzik(ui.narzedzia, 'Komory', 'Otwórz drzwi komór uzbrojenia (K)');
    ui.plan = guzik(ui.narzedzia, 'Plan', 'Rentgen: siatka krawędzi zamiast powłoki (P)');
    // suwak PRZED przyciskiem: pasek jest wyrównany do prawej, więc pojawienie się suwaka nie przesuwa „Dopalacza”
    // spod kursora (drugi klik w to samo miejsce wyłącza silniki, a nie trafia w inny przycisk)
    ui.ciag = el('label', 'my-ciag', null, ui.narzedzia); ui.ciag.hidden = true;
    el('span', 'my-ciag-nazwa', 'Ciąg', ui.ciag);
    ui.suwak = el('input', 'my-suwak', null, ui.ciag);
    ui.suwak.type = 'range'; ui.suwak.min = '15'; ui.suwak.max = '100'; ui.suwak.step = '1'; ui.suwak.value = '100';
    ui.suwak.title = 'Ciąg silników: 15% bieg jałowy, 60% pełna moc bez dopalacza, powyżej — dopalacz';
    ui.ciagTekst = el('output', 'my-ciag-wart', '100%', ui.ciag);
    ui.dopalacz = guzik(ui.narzedzia, 'Dopalacz', 'Silniki na dopalaczu — ogień i dźwięk (A)');
    ui.dzwiek = guzik(ui.narzedzia, '♪ Dźwięk', 'Dźwięk silników (M)', 'my-dzwiek');
    ui.karta = guzik(ui.narzedzia, 'Karta', 'Karta danych maszyny z raportu (D)');
    ui.pelny = guzik(ui.narzedzia, 'Pełny ekran', 'Pełny ekran (F)');
    ui.zamknij = guzik(ui.narzedzia, '✕', 'Wróć do Układu Słonecznego (Esc)', 'my-zamknij');
    ui.zamknij.removeAttribute('aria-pressed'); ui.zamknij.setAttribute('aria-label', 'Wróć do Układu Słonecznego');

    ui.scena = el('div', 'my-scena', null, korzen);
    ui.canvas = el('canvas', 'my-canvas', null, ui.scena);
    ui.canvas.setAttribute('aria-label', 'Makieta 3D — przeciągnij, by obrócić; kółko przybliża; kliknij część, by ją opisać');
    ui.etykieta = el('div', 'my-etykieta', null, ui.scena); ui.etykieta.hidden = true;
    ui.komunikat = el('div', 'my-komunikat', null, ui.scena); ui.komunikat.setAttribute('role', 'status'); ui.komunikat.hidden = true;

    ui.dane = el('aside', 'my-panel my-dane', null, ui.scena); ui.dane.setAttribute('aria-label', 'Karta danych maszyny');
    ui.czesc = el('aside', 'my-panel my-czesc', null, ui.scena); ui.czesc.setAttribute('aria-label', 'Karta części'); ui.czesc.hidden = true;
    ui.czescZamknij = guzik(ui.czesc, '✕', 'Zamknij kartę części (Esc)', 'my-panel-x');
    ui.czescZamknij.removeAttribute('aria-pressed');
    ui.czescTresc = el('div', 'my-czesc-tresc', null, ui.czesc);

    ui.dol = el('div', 'my-dol', null, ui.scena);
    ui.podpis = el('p', 'my-podpis', PODPIS, ui.dol);
    ui.maszyny = el('nav', 'my-maszyny', null, ui.dol); ui.maszyny.setAttribute('aria-label', 'Maszyny (← →)');
    ui.przyciskiMaszyn = {};
    D.MYSLIWCE.forEach(function (m) {
      var b = guzik(ui.maszyny, null, m.nazwa + ' — ' + m.kraj, 'my-maszyna');
      b.dataset.kraj = m.kraj; b.dataset.id = m.id;
      el('span', 'my-maszyna-kraj', m.kraj, b);
      el('span', 'my-maszyna-nazwa', m.nazwa, b);
      b.addEventListener('click', function () { wybierz(m.id); });
      ui.przyciskiMaszyn[m.id] = b;
    });
  })();

  /* ---------- stan ---------- */
  var aktywny = false, gl = null, sc = null, mk = null, idBiez = null, raf = 0, czasStartu = 0, tOst = 0;
  var cel = { rozloz: 0, komory: 0 }, wart = { rozloz: 0, komory: 0 }, planWl = false;
  var ostatniCel = [0, 0, 0], hover = null, wybrana = null, wskaznik = null, nacisk = null, gotowosc = null, zegarKom = null, lot = null;
  var fps = { wart: 60, n: 0, t0: 0, slabe: 0 }, jakosc = 'pelna', przesun = { biez: 0, cel: 0 };
  var wymusPelna = /[?&]jakosc=pelna(?=&|$)/.test(location.search);   // hak sondy: bez przejścia na „lekką” przy niskim fps
  var rc = new T.Raycaster(), wekNdc = new T.Vector2();
  // silniki (mysliwce/silniki.js: bezwładność, płomień, światło zbiorcze) bieżącej makiety; silnikiWl = przycisk Dopalacz;
  // dzwiekWl null = jeszcze nie wybrano (pierwsze włączenie dopalacza włącza dźwięk), false = wyciszony klawiszem M
  var sil = null, silnikiWl = false, dzwiek = null, dzwiekWl = null;

  function token(nazwa) { return getComputedStyle(doc.documentElement).getPropertyValue(nazwa).trim(); }
  function komunikat(t) {
    ui.komunikat.textContent = t || ''; ui.komunikat.hidden = !t;
    if (zegarKom) clearTimeout(zegarKom);
    zegarKom = t ? setTimeout(function () { ui.komunikat.hidden = true; }, 6000) : null;
  }

  /* ---------- renderer (jeden na życie strony) ---------- */
  function zapewnijGL() {
    if (gl) return gl;
    var r = new T.WebGLRenderer({ canvas: ui.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputEncoding = T.sRGBEncoding;
    r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 0.82;
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    gl = { renderer: r, w: 0, h: 0 };
    window.addEventListener('resize', dopasuj);
    doc.addEventListener('fullscreenchange', function () { dopasuj(); ui.pelny.setAttribute('aria-pressed', String(doc.fullscreenElement === korzen)); });
    return gl;
  }
  function dopasuj() {
    if (!gl) return;
    var w = ui.scena.clientWidth, h = ui.scena.clientHeight;
    if (!(w > 0 && h > 0) || (w === gl.w && h === gl.h)) return;
    gl.w = w; gl.h = h;
    gl.renderer.setSize(w, h, false);
    if (sc) { sc.kamera.aspect = w / h; kadrPoboczny(true); }
  }
  // Kadr przesunięty o różnicę połówek kart: karta danych (lewa) pcha makietę w prawo, karta części (prawa) w lewo —
  // makieta i wskazana część zostają w wolnej części ekranu. Zmiana płynna (klatka), w smoke od razu.
  function celPrzesuniecia() {
    if (!gl || gl.w < 900) return 0;
    var l = ui.dane.hidden ? 0 : ui.dane.offsetWidth + 16, p = ui.czesc.hidden ? 0 : ui.czesc.offsetWidth + 16;
    return (l - p) / 2;
  }
  function kadrPoboczny(odRazu) {
    if (!sc) return;
    przesun.cel = celPrzesuniecia();
    if (odRazu || smoke || ograniczonyRuch()) przesun.biez = przesun.cel;
    zastosujPrzesuniecie();
  }
  function zastosujPrzesuniecie() {
    var off = przesun.biez;
    if (Math.abs(off) > 0.5) sc.kamera.setViewOffset(gl.w, gl.h, -off, 0, gl.w, gl.h); else sc.kamera.clearViewOffset();
    sc.kamera.updateProjectionMatrix();
  }

  /* ---------- scena: studio (mysliwce/studio.js) + kamera + sterowanie ---------- */
  var ORBIT_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js', ponowionoOrbit = false;
  // Zasięg przybliżania z obwiedni bieżącej makiety — przy ustawianiu kadru i przy późnym dołożeniu sterowania.
  function limityKamery() {
    if (!sc || !sc.sterowanie || !mk) return;
    var dl = mk.obwiednia.max[0] - mk.obwiednia.min[0];
    sc.sterowanie.minDistance = dl * 0.08; sc.sterowanie.maxDistance = dl * 3.2;
  }
  function utworzSterowanie() {
    if (!sc || sc.sterowanie || !T.OrbitControls) return;
    var k = new T.OrbitControls(sc.kamera, ui.canvas);
    k.enableDamping = true; k.dampingFactor = 0.08; k.screenSpacePanning = true;
    k.maxPolarAngle = Math.PI * 0.49; k.rotateSpeed = 0.7;
    k.addEventListener('start', function () { lot = null; });   // gest przerywa przelot kamery
    sc.sterowanie = k;
    // sterowanie dołożone później (ponowne wczytanie skryptu): kamera zostaje, gdzie jest — tylko cel obrotu z ostatniego kadru
    if (mk) { k.target.fromArray(ostatniCel); limityKamery(); k.update(); }
  }
  // Brak OrbitControls (CDN nie odpowiedział): komunikat, obrót makiety przeciąganiem i jedna leniwa próba ponownego wczytania.
  function bezSterowania() {
    console.warn('Myśliwce: brak OrbitControls — obrót makiety przeciąganiem, ponawiam wczytanie');
    komunikat('Sterowanie kamerą nie wczytało się — przeciągnij, by obrócić makietę. Ponawiam wczytanie…');
    if (ponowionoOrbit) return;
    ponowionoOrbit = true;
    var sk = doc.createElement('script');
    sk.src = ORBIT_URL;
    sk.onload = function () { if (T.OrbitControls) { utworzSterowanie(); komunikat('Sterowanie kamerą gotowe.'); } };
    sk.onerror = function () { komunikat('Sterowanie kamerą niedostępne — obracaj makietę przeciąganiem.'); };
    doc.head.appendChild(sk);
  }
  function zbudujScene() {
    var g = zapewnijGL();
    var st = window.MysliwceStudio.zbuduj(T, g.renderer, { cienie: jakosc === 'pelna' });
    var kamera = new T.PerspectiveCamera(34, (gl.w || 16) / (gl.h || 9), 0.1, 400);
    sc = { scena: st.scena, kamera: kamera, sterowanie: null, studio: st };
    if (T.OrbitControls) utworzSterowanie(); else bezSterowania();
    gl.w = 0; dopasuj();
    return sc;
  }
  function zwolnijScene() {
    if (!sc) return;
    zwolnijSilniki();
    if (mk) { mk.zwolnij(); mk = null; }
    sc.studio.zwolnij();
    if (sc.sterowanie) sc.sterowanie.dispose();
    sc = null;
    gl.renderer.renderLists.dispose();
  }

  /* ---------- makieta ---------- */
  function pokazMakiete(id) {
    if (mk && mk.id === id) return;
    var ciagPrzed = sil ? sil.stan().ciag : 0;
    zwolnijSilniki();
    if (mk) { mk.zwolnij(); mk = null; }
    var dane = D.mysliwiec(id);
    mk = window.Makieta.zbuduj(T, id, { lod: 'pelny', env: sc.studio.env.texture, anizotropia: gl.renderer.capabilities.getMaxAnisotropy(),
      odcien: token(D.KRAJE[dane.kraj].kolor) || null });
    mk.grupa.position.y = -mk.obwiednia.min[1];               // koła na posadzce
    sc.scena.add(mk.grupa);
    idBiez = id; hover = null; wybrana = null;
    mk.rozloz(wart.rozloz); mk.komory(wart.komory); if (planWl) mk.plan(true);
    // silniki nowej maszyny przejmują bieżący ciąg (zmiana maszyny na dopalaczu nie gasi i nie rozkręca od zera)
    sil = window.Silniki.utworz(T, { scena: sc.scena, wyloty: mk.wyloty, rodzic: mk.czesci.dysze, dzwiek: dzwiekWl ? dzwiek : null, jakosc: jakosc });
    if (ciagPrzed > 0) sil.ustaw(ciagPrzed, true);
    sil.ustaw(silnikiWl ? ciagSuwaka() : 0, smoke);
    ustawKadr();
    wypelnijDane(dane);
    zamknijCzesc();
    ui.tytul.textContent = 'Myśliwce · ' + dane.nazwa;
    Object.keys(ui.przyciskiMaszyn).forEach(function (k) { ui.przyciskiMaszyn[k].setAttribute('aria-pressed', String(k === id)); });
  }
  // Kadry makiety (w układzie posadzki, makieta stoi na kołach): start — ¾ z przodu z prawej burty, lekko z góry;
  // rozłożony — ten sam kierunek, dalej (części wychodzą poza obrys); komory — nisko z boku, widać brzuch i otwarte drzwi.
  function kadr(nazwa) {
    var o = mk.obwiednia, dl = o.max[0] - o.min[0], rozp = o.max[2] - o.min[2], wys = o.max[1] - o.min[1];
    var asp = gl.w && gl.h ? gl.w / gl.h : 1.6;
    var r = Math.max(dl, rozp) * 1.32 * Math.max(1, Math.min(2.2, 1.45 / asp)), cy = wys * 0.42;   // ekran pionowy: dalej
    if (nazwa === 'komory') return { poz: [r * 0.38, 0.45, r * 0.92], cel: [0, 0.75, 0] };
    var k = nazwa === 'rozloz' ? 1.5 : 1;
    return { poz: [r * 0.72 * k, cy + r * 0.36 * k, r * 0.74 * k], cel: [0, cy, 0] };
  }
  // Zbliżenie na część (hak smoke `&kadr=<rodzaj>`): kamera przy kotwicy części, od tyłu dla usterzenia i dysz.
  function kadrCzesci(rodzaj) {
    if (/^ogien/.test(rodzaj)) return kadrOgnia(rodzaj);
    var w = mk.czesci[rodzaj];
    if (!w) return null;
    var o = mk.obwiednia, dl = o.max[0] - o.min[0];
    mk.grupa.updateMatrixWorld(true);
    var c = w.localToWorld(w.userData.kotwica.clone());
    var tyl = rodzaj === 'usterzenie' || rodzaj === 'dysze', kier = new T.Vector3(tyl ? -0.75 : 0.7, 0.42, tyl ? 0.55 : 0.6).normalize();
    var d = dl * (rodzaj === 'kabina' ? 0.2 : 0.32);
    return { poz: c.clone().addScaledVector(kier, d).toArray(), cel: c.toArray() };
  }
  // Kadry płomienia (hak smoke, zrzuty dysz): środek płomieni przy pełnym ciągu; ¾ z tyłu, bok, prosto w dysze.
  function kadrOgnia(nazwa) {
    var cz = mk.czesci.dysze;
    if (!cz || !mk.wyloty.length) return null;
    mk.grupa.updateMatrixWorld(true);
    var c = new T.Vector3(), dl = 0, wylot = new T.Vector3();
    mk.wyloty.forEach(function (w) { c.add(cz.localToWorld(new T.Vector3().fromArray(w.punkt))); dl = Math.max(dl, window.Ogien.wymiary(w, 1).dl); });
    c.multiplyScalar(1 / mk.wyloty.length); wylot.copy(c);
    var kier = { ogien: [-0.78, 0.34, 0.52], ogienbok: [-0.05, 0.1, 1], ogientyl: [-1, 0.16, 0.12] }[nazwa] || [-0.78, 0.34, 0.52];
    var srodek = nazwa === 'ogientyl' ? wylot : c.clone().add(new T.Vector3(-dl * 0.42, 0, 0));
    var d = { ogien: dl * 1.6, ogienbok: dl * 1.75, ogientyl: dl * 1.35 }[nazwa] || dl * 1.6;
    return { poz: srodek.clone().addScaledVector(new T.Vector3().fromArray(kier).normalize(), d).toArray(), cel: srodek.toArray() };
  }
  function kadrBiezacy() { return kadr(cel.komory ? 'komory' : cel.rozloz ? 'rozloz' : 'start'); }
  function ustawKadr(kd) {
    var o = mk.obwiednia, dl = o.max[0] - o.min[0], rozp = o.max[2] - o.min[2];
    kd = kd || kadrBiezacy();
    ostatniCel = kd.cel;
    lot = null;
    sc.kamera.position.fromArray(kd.poz);
    var k = sc.sterowanie;
    if (k) { k.target.fromArray(kd.cel); limityKamery(); k.update(); }
    else sc.kamera.lookAt(kd.cel[0], kd.cel[1], kd.cel[2]);
    sc.studio.dopasujCien(Math.max(dl, rozp) * 0.62);
  }
  // Płynny przelot kamery do kadru (gest użytkownika go przerywa); smoke i ograniczony ruch — od razu.
  function lec(kd) {
    if (!sc || !mk) return;
    if (smoke || ograniczonyRuch() || !sc.sterowanie) { ustawKadr(); return; }
    lot = { t: 0, p0: sc.kamera.position.clone(), c0: sc.sterowanie.target.clone(), p1: new T.Vector3().fromArray(kd.poz), c1: new T.Vector3().fromArray(kd.cel) };
  }
  function krokLotu(dt) {
    if (!lot) return;
    lot.t = Math.min(1, lot.t + dt / 1.2);
    var e = lot.t * lot.t * (3 - 2 * lot.t);
    sc.kamera.position.lerpVectors(lot.p0, lot.p1, e);
    sc.sterowanie.target.lerpVectors(lot.c0, lot.c1, e);
    if (lot.t >= 1) lot = null;
  }
  function wybierz(id) {
    if (!aktywny || !D.mysliwiec(id)) return;
    pokazMakiete(id);
    ustawAdres(id, false);
  }
  function krokMaszyny(d) {
    var ids = D.MYSLIWCE.map(function (m) { return m.id; }), i = ids.indexOf(idBiez);
    wybierz(ids[(i + d + ids.length) % ids.length]);
  }
  function ustawAdres(id, nowy) {
    if (smoke) return;
    var h = '#mysliwiec=' + id + '&tryb=makieta';
    if (location.hash === h) return;
    try { history[nowy ? 'pushState' : 'replaceState'](null, '', location.pathname + location.search + h); } catch (_) { /* file:// */ }
  }

  /* ---------- karty ---------- */
  function znaczekPewnosci(rodzic, poziom) {
    var z = el('span', 'my-pewnosc', 'pewność: ' + (NAZWY_PEWNOSCI[poziom] || poziom), rodzic);
    z.dataset.poziom = poziom;
    return z;
  }
  function wypelnijDane(m) {
    var d = ui.dane;
    d.replaceChildren();
    var nag = el('header', 'my-dane-nag', null, d);
    var kraj = el('span', 'my-kraj', m.kraj, nag); kraj.dataset.kraj = m.kraj;
    el('span', 'my-gen', 'generacja ' + m.generacja, nag);
    el('h2', 'my-nazwa', m.nazwa, d);
    el('p', 'my-rola', m.rola + ' · ' + m.producent, d);
    var dl = el('dl', 'my-tabela', null, d);
    m.karta.forEach(function (w) { el('dt', null, w[0], dl); el('dd', null, w[1], dl); });
    el('h3', 'my-h3', 'Kto to ma', d);
    el('p', 'my-akapit', m.ktoMa.opis, d);
    var ul = el('ul', 'my-uzytkownicy', null, d);
    m.ktoMa.uzytkownicy.forEach(function (u) { var li = el('li', null, null, ul); el('b', null, u[0], li); el('span', null, u[1], li); });
    el('h3', 'my-h3', 'Stan na 09.2026', d);
    m.stan2026.forEach(function (a) { el('p', 'my-akapit', a, d); });
    el('h3', 'my-h3', 'Skąd to wiadomo', d);
    var pw = el('p', 'my-akapit', null, d);
    znaczekPewnosci(pw, m.pewnosc.poziom); el('span', null, ' ' + m.pewnosc.skad, pw);
    if (m.niesfotografowany) el('p', 'my-uwaga', 'Tej maszyny nie pokazano na zdjęciach — makieta jako hologram, zbudowana z grafiki i opisów.', d);
    el('p', 'my-zrodlo', 'Raport „Myśliwce stealth 2026”, stan na 17.09.2026. ' + PODPIS, d);
  }
  function pokazCzesc(rodzaj) {
    var w = mk && mk.czesci[rodzaj], c = w && w.userData.czesc;
    if (!c) return;
    wybrana = rodzaj;
    var t = ui.czescTresc;
    t.replaceChildren();
    el('p', 'my-czesc-rodzaj', 'Część · ' + D.mysliwiec(idBiez).nazwa, t);
    el('h3', 'my-czesc-nazwa', c.nazwa, t);
    znaczekPewnosci(t, c.pewnosc);
    el('p', 'my-akapit', c.opis, t);
    var z = el('p', 'my-zrodlo', null, t); el('b', null, 'Źródło: ', z); el('span', null, c.zrodlo, z);
    ui.czesc.dataset.czesc = c.id;
    ui.czesc.hidden = false;
    mk.podswietl(rodzaj);
    kadrPoboczny();
  }
  function zamknijCzesc() {
    var bylaOtwarta = !ui.czesc.hidden;
    wybrana = null; ui.czesc.hidden = true; delete ui.czesc.dataset.czesc;
    if (mk) mk.podswietl(hover);
    if (bylaOtwarta && gl) kadrPoboczny();
  }
  function ustawDane(wl) { ui.dane.hidden = !wl; ui.karta.setAttribute('aria-pressed', String(wl)); if (gl) kadrPoboczny(); }

  /* ---------- przełączniki ---------- */
  function przelacz(co, wl) {
    if (co === 'plan') { planWl = wl; if (mk) mk.plan(wl); }
    else {
      cel[co] = wl ? 1 : 0;
      if (smoke || ograniczonyRuch()) { wart[co] = cel[co]; zastosuj(); }
      if (mk) lec(kadrBiezacy());
    }
    var b = ui[co]; b.setAttribute('aria-pressed', String(wl));
    if (co === 'rozloz') b.textContent = wl ? 'Złóż' : 'Rozłóż';
    if (co === 'komory') b.textContent = wl ? 'Zamknij komory' : 'Komory';
  }
  function wlaczone(co) { return ui[co].getAttribute('aria-pressed') === 'true'; }

  /* ---------- dopalacz i dźwięk ---------- */
  function zwolnijSilniki() { if (sil) { sil.zwolnij(); sil = null; } }
  function ciagSuwaka() { return Math.max(0.15, Math.min(1, (+ui.suwak.value || 100) / 100)); }
  function opiszCiag() {
    var c = ciagSuwaka();
    ui.ciagTekst.textContent = Math.round(c * 100) + '%' + (c >= window.Ogien.PROG_AB ? ' · dopalacz' : c <= 0.15 ? ' · jałowy' : '');
  }
  function ustawSilniki(wl) {
    silnikiWl = !!wl;
    ui.dopalacz.setAttribute('aria-pressed', String(silnikiWl));
    ui.ciag.hidden = !silnikiWl;
    opiszCiag();
    if (sil) sil.ustaw(silnikiWl ? ciagSuwaka() : 0, smoke);
    if (silnikiWl && dzwiekWl !== false && !smoke) ustawDzwiek(true);   // klik przycisku = gest: kontekst audio wolno utworzyć
  }
  function ustawDzwiek(wl) {
    if (wl && !dzwiek) {
      dzwiek = window.Dzwiek && window.Dzwiek.silnik();
      if (!dzwiek) { ui.dzwiek.disabled = true; komunikat('Dźwięk niedostępny w tej przeglądarce.'); dzwiekWl = false; return; }
      dzwiek.ambient('hangar');
    }
    dzwiekWl = !!wl;
    ui.dzwiek.setAttribute('aria-pressed', String(dzwiekWl));
    ui.dzwiek.textContent = dzwiekWl ? '♪ Dźwięk' : '♪ Cisza';
    if (!dzwiek) return;
    if (sil) sil.dzwiek(dzwiekWl ? dzwiek : null);
    if (dzwiekWl) { if (!doc.hidden) dzwiek.wznow(); } else dzwiek.pauza();
  }
  function zwolnijDzwiek() {
    if (sil) sil.dzwiek(null);
    if (dzwiek) { dzwiek.zwolnij(); dzwiek = null; }
    dzwiekWl = null;
    ui.dzwiek.setAttribute('aria-pressed', 'false'); ui.dzwiek.textContent = '♪ Dźwięk';
  }
  ui.dopalacz.addEventListener('click', function () { ustawSilniki(!silnikiWl); });
  ui.suwak.addEventListener('input', function () { opiszCiag(); if (silnikiWl && sil) sil.ustaw(ciagSuwaka(), smoke); });
  ui.dzwiek.addEventListener('click', function () { ustawDzwiek(!dzwiekWl); });
  // karta w tle: dźwięk pauzuje (ctx.suspend), po powrocie rusza z rampą głośności (Dzwiek.wzmocnienieWznowienia)
  doc.addEventListener('visibilitychange', function () {
    if (!dzwiek || !dzwiekWl) return;
    if (doc.hidden) dzwiek.pauza(); else dzwiek.wznow();
  });
  function zastosuj() { if (mk) { mk.rozloz(wart.rozloz); mk.komory(wart.komory); } }
  function ograniczonyRuch() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function pelnyEkran() {
    try {
      if (doc.fullscreenElement) doc.exitFullscreen();
      else if (korzen.requestFullscreen) korzen.requestFullscreen();
    } catch (e) { console.warn('Myśliwce: pełny ekran niedostępny', e); }
  }
  ui.rozloz.addEventListener('click', function () { przelacz('rozloz', !wlaczone('rozloz')); });
  ui.komory.addEventListener('click', function () { przelacz('komory', !wlaczone('komory')); });
  ui.plan.addEventListener('click', function () { przelacz('plan', !wlaczone('plan')); });
  ui.karta.addEventListener('click', function () { ustawDane(ui.dane.hidden); });
  ui.pelny.addEventListener('click', pelnyEkran);
  ui.zamknij.addEventListener('click', function () { window.Zakladki.zamknijDoUkladu(); });
  ui.czescZamknij.addEventListener('click', zamknijCzesc);

  /* ---------- wskazywanie części (raycast tylko po częściach, bieżące transformacje) ---------- */
  function trafienie(x, y) {
    if (!mk || !sc) return null;
    var r = ui.canvas.getBoundingClientRect();
    if (!(r.width > 0)) return null;
    wekNdc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
    mk.grupa.updateMatrixWorld(true);
    rc.setFromCamera(wekNdc, sc.kamera);
    var hity = rc.intersectObjects(Object.values(mk.czesci), true);
    for (var i = 0; i < hity.length; i++) {
      for (var o = hity[i].object; o; o = o.parent) if (o.userData && o.userData.czesc) return o.userData.rodzaj;
    }
    return null;
  }
  function ustawHover(rodzaj, x, y) {
    if (rodzaj !== hover) { hover = rodzaj; if (mk) mk.podswietl(hover || wybrana); }
    ui.canvas.style.cursor = hover ? 'pointer' : '';
    if (!hover) { ui.etykieta.hidden = true; return; }
    ui.etykieta.textContent = mk.czesci[hover].userData.czesc.nazwa;
    var r = ui.scena.getBoundingClientRect();
    ui.etykieta.style.transform = 'translate(' + Math.round(x - r.left + 16) + 'px,' + Math.round(y - r.top + 14) + 'px)';
    ui.etykieta.hidden = false;
  }
  ui.canvas.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') wskaznik = { x: e.clientX, y: e.clientY };
    if (nacisk && sc && !sc.sterowanie && mk) {                // zapas bez OrbitControls: przeciąganie obraca makietę
      mk.grupa.rotation.y += (e.clientX - (nacisk.px || nacisk.x)) * 0.008;
      nacisk.px = e.clientX;
    }
  });
  ui.canvas.addEventListener('pointerleave', function () { wskaznik = null; ustawHover(null); });
  ui.canvas.addEventListener('pointerdown', function (e) { nacisk = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  ui.canvas.addEventListener('pointerup', function (e) {
    if (!nacisk) return;
    var ruch = Math.hypot(e.clientX - nacisk.x, e.clientY - nacisk.y), dt = performance.now() - nacisk.t;
    nacisk = null;
    if (ruch > 6 || dt > 600) return;                         // obrót kamery, nie klik
    var r = trafienie(e.clientX, e.clientY);
    if (r) pokazCzesc(r); else zamknijCzesc();
  });

  /* ---------- pętla ---------- */
  function klatka(teraz) {
    raf = aktywny ? requestAnimationFrame(klatka) : 0;
    if (!sc || !mk) return;
    var dt = Math.min(0.25, Math.max(0, (teraz - tOst) / 1000)); tOst = teraz;   // animacje w czasie rzeczywistym także przy niskim fps
    fps.n++;
    if (teraz - fps.t0 >= 1000) {
      fps.wart = fps.n * 1000 / (teraz - fps.t0); fps.n = 0; fps.t0 = teraz;
      fps.slabe = (fps.wart < 30 && !smoke && !doc.hidden) ? fps.slabe + 1 : 0;
      if (fps.slabe >= 2 && jakosc === 'pelna' && !wymusPelna) ustawJakosc('lekka');
    }
    dopasuj();
    var zmiana = false;
    ['rozloz', 'komory'].forEach(function (k) {
      if (wart[k] === cel[k]) return;
      var krok = dt / (k === 'rozloz' ? 1.1 : 0.8);
      wart[k] = cel[k] > wart[k] ? Math.min(cel[k], wart[k] + krok) : Math.max(cel[k], wart[k] - krok);
      zmiana = true;
    });
    if (zmiana) zastosuj();
    if (sil) sil.krok(dt, smoke ? 1 : (teraz - czasStartu) / 1000);
    krokLotu(dt);
    if (Math.abs(przesun.cel - przesun.biez) > 0.5) { przesun.biez += (przesun.cel - przesun.biez) * Math.min(1, dt * 6); zastosujPrzesuniecie(); }
    if (sc.sterowanie) sc.sterowanie.update();
    if (wskaznik) { var w = wskaznik; ustawHover(trafienie(w.x, w.y), w.x, w.y); }
    mk.aktualizuj(smoke ? 0 : (teraz - czasStartu) / 1000);
    gl.renderer.render(sc.scena, sc.kamera);
    if (gotowosc) { console.log('MYSLIWCE_READY ' + gotowosc); gotowosc = null; }
  }
  function ustawJakosc(j) {
    jakosc = j;
    gl.renderer.setPixelRatio(j === 'pelna' ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    if (sc) sc.studio.cienie(j === 'pelna');
    if (sil) sil.jakosc(j);
    gl.w = 0; dopasuj();
  }

  /* ---------- klawiatura (capture: skróty Układu nie dostają klawiszy, gdy zakładka jest aktywna) ---------- */
  window.addEventListener('keydown', function (e) {
    if (!aktywny) return;
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = e.target && e.target.tagName, natywny = tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SUMMARY';
    var k = e.key;
    if (natywny && (k === ' ' || k === 'Enter')) return;
    if (tag === 'INPUT' && /^(Arrow|Page|Home$|End$)/.test(k)) return;      // suwak ciągu: strzałki zmieniają ciąg, nie maszynę
    var akcje = {
      Escape: function () { if (!ui.czesc.hidden) zamknijCzesc(); else if (doc.fullscreenElement) doc.exitFullscreen(); else window.Zakladki.zamknijDoUkladu(); },
      f: pelnyEkran, r: function () { przelacz('rozloz', !wlaczone('rozloz')); }, k: function () { przelacz('komory', !wlaczone('komory')); },
      p: function () { przelacz('plan', !wlaczone('plan')); }, d: function () { ustawDane(ui.dane.hidden); },
      a: function () { ustawSilniki(!silnikiWl); }, m: function () { ustawDzwiek(!dzwiekWl); },
      ArrowRight: function () { krokMaszyny(1); }, ArrowLeft: function () { krokMaszyny(-1); },
    };
    var a = akcje[k] || akcje[k.toLowerCase()];
    if (!a) return;
    e.preventDefault(); a();
  }, true);
  window.addEventListener('keyup', function (e) { if (aktywny) e.stopPropagation(); }, true);

  /* ---------- wejście / wyjście ---------- */
  function otworz(stan) {
    stan = stan || { id: null };
    var pierwsze = !aktywny;
    try {
      if (!aktywny) {
        aktywny = true;
        zbudujScene();
        ustawDane(smoke || (korzen.clientWidth || window.innerWidth) >= 900);   // telefon: karta na żądanie
      }
      var id = stan.id || idBiez || D.MYSLIWCE[0].id;
      if (stan.nieznany) komunikat('Nie znam maszyny „' + stan.nieznany + '”. Pokazuję ' + D.mysliwiec(id).nazwa + '.');
      pokazMakiete(id);
      ustawAdres(id, pierwsze && !L.parsujHashMysliwcow(location.hash));
      if (smoke) {
        // stany do zrzutów: &rozloz &komory &plan &czesc=<rodzaj> (tylko w haku testowym)
        ['rozloz', 'komory', 'plan'].forEach(function (k) { if (new RegExp('[?&]' + k + '(?=&|$)').test(location.search)) przelacz(k, true); });
        var mc = /[?&]czesc=([a-z]+)/.exec(location.search);
        if (mc) pokazCzesc(mc[1]);
        var mdp = /[?&]dopalacz(?:=([0-9.]+))?(?=&|$)/.exec(location.search);
        if (mdp) { ui.suwak.value = String(Math.round(100 * (mdp[1] != null ? Math.min(1, +mdp[1]) : 1))); ustawSilniki(true); }
        var mkd = /[?&]kadr=([a-z]+)/.exec(location.search), kd = mkd && kadrCzesci(mkd[1]);
        if (kd) ustawKadr(kd);
        if (zap.tryb === 'makieta') gotowosc = id + ' makieta';
      }
      if (!raf) { tOst = czasStartu = performance.now(); fps.t0 = tOst; fps.n = 0; raf = requestAnimationFrame(klatka); }
      if (!smoke) korzen.focus({ preventScroll: true });
      return true;
    } catch (e) {
      console.error('Myśliwce: błąd budowy makiety — ' + (e && e.message || e));
      komunikat('Nie udało się zbudować makiety 3D (' + (e && e.message || e) + ').');
      return false;
    }
  }
  function zamknij() {
    if (!aktywny) return;
    aktywny = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (doc.fullscreenElement === korzen) { try { doc.exitFullscreen(); } catch (_) { /* nic */ } }
    zamknijCzesc(); ustawHover(null); wskaznik = null;
    ustawSilniki(false);
    zwolnijDzwiek();
    zwolnijScene();
    idBiez = null;
  }

  window.Mysliwce = {
    otworz: otworz,
    zamknij: zamknij,
    stan: function () {
      return { tryb: aktywny ? 'makieta' : null, id: idBiez, ujecie: null, fps: Math.round(fps.wart), jakosc: jakosc,
        rozloz: wart.rozloz, komory: wart.komory, plan: planWl, czesc: wybrana && mk ? mk.czesci[wybrana].userData.czesc.id : null,
        podswietlona: mk ? mk.stan().podswietl : null, przelot: !!lot, przesuniecie: Math.round(przesun.biez), przesuniecieCel: Math.round(przesun.cel),
        dopalacz: { wl: silnikiWl, ciag: sil ? sil.stan().ciag : 0, cel: sil ? sil.stan().cel : 0, ognie: sil ? sil.stan().strugi : 0 },
        dzwiek: Object.assign({ wl: dzwiekWl, utworzony: !!dzwiek }, dzwiek ? dzwiek.stan() : null) };
    },
    diagnostyka: function () {
      if (!gl) return null;
      var n = 0, geo = {}, mat = {};
      if (sc) sc.scena.traverse(function (o) { n++; if (o.geometry) geo[o.geometry.uuid] = 1; if (o.material) mat[o.material.uuid] = 1; });
      var m = gl.renderer.info.memory, pr = gl.renderer.info.programs;
      return { geometrieSceny: Object.keys(geo).length, materialy: Object.keys(mat).length, geometrieGPU: m.geometries, tekstury: m.textures,
        programy: pr ? pr.length : 0, obiekty: n };
    },
    // Haki sondy (scripts/probe-mysliwce.mjs): bieżąca makieta i rzut kotwicy części na ekran (px w oknie).
    makieta: function () { return mk; },
    // źródła gorąca płomieni (świat) — wejście passu falowania (Task 7) i kontrola sondy
    zrodlaGoraca: function () { return sil ? sil.zrodlaGoraca() : []; },
    poziomDzwieku: function () { return dzwiek ? dzwiek.poziom() : null; },
    przelacz: przelacz,
    // spoczynek = true: gdzie kotwica byłaby bez przesunięcia rozłożenia (w bieżącej kamerze) — kontrola negatywna sondy
    rzutKotwicy: function (rodzaj, spoczynek) {
      var w = mk && mk.czesci[rodzaj];
      if (!w) return null;
      mk.grupa.updateMatrixWorld(true);
      var pw = spoczynek ? mk.grupa.localToWorld(w.userData.kotwica.clone()) : w.localToWorld(w.userData.kotwica.clone());
      var p = pw.project(sc.kamera), r = ui.canvas.getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, z: p.z };
    },
  };
})();
