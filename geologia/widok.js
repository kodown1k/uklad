'use strict';
/* Zakładka Geologia — widok nakładki (plik przeglądarkowy; ładuje go leniwie geologia/ladowanie.js).
   window.Geologia = { otworz(stan), zamknij(), stan(), diagnostyka() }.
   stan() → { miejsce, tryb, rozdzial, ujecie, t, fps, jakosc, lektor: 'gra'|'cisza'|'brak' } (ujecie = id bieżącego
   ujęcia albo null — wypełnia je Task 8); diagnostyka() → { geometrie, tekstury, programy, audio }.
   Szkielet (Task 2): pasek z tytułem i podmenu miejsc (GeologiaMiejsca.podmenu), rząd rozdziałów (GeologiaLadowanie.ROZDZIALY),
   pusty canvas na cały kontener. Pasek i rząd rozdziałów leżą NAD canvasem (absolutnie), kadr = cały #geologia.
   Hak testowy: ?smoke&geologia=<miejsce>[&rozdzial=<id>|&tryb=makieta][&kontrola=biel|czern][&krzywe] → stały kadr,
   marker `GEOLOGIA_READY <miejsce> <rozdzial|makieta>`; w smoke lektor i podkład nie startują (stan().lektor === 'cisza').
   `&krzywe` (tylko smoke): doładowuje mysliwce/kino.js (nadpisuje globalny obiekt krzywych) i loguje `GEOLOGIA_KRZYWE ok|zle`
   — czy GeologiaLadowanie.krzywe nadal ma dojazd/cruise/logLerp/aimArc (ruling G-C; z window.MysliwceKino globalne Kino zostaje krzywymi Układu).
   Tekst z danych trafia do DOM wyłącznie przez textContent. Błędy własne: prefiks „Geologia: ”,
   ostrzeżenia nie będące błędem: „Geologia/uwaga: ”. */
(function () {
  var T = window.THREE, L = window.GeologiaLadowanie, M = window.GeologiaMiejsca;
  var doc = document, $ = function (id) { return doc.getElementById(id); };
  var korzen = $('geologia');
  var zap = L.parsujZapytanieGeologii(location.search), smoke = zap.smoke;
  var K_KRZYWE = ['dojazd', 'cruise', 'logLerp', 'aimArc'];

  function el(tag, klasa, tekst, rodzic) {
    var e = doc.createElement(tag);
    if (klasa) e.className = klasa;
    if (tekst != null) e.textContent = tekst;
    if (rodzic) rodzic.appendChild(e);
    return e;
  }

  /* ---------- stan ---------- */
  var st = { miejsce: null, tryb: null, rozdzial: null, ujecie: null, t: zap.t };
  var aktywny = false, gl = null, ui = null, rafId = 0, gotowosc = null, ostatni = 0, fps = 60;
  var przyciskiMiejsc = {}, przyciskiRozdzialow = {};

  /* ---------- DOM ---------- */
  function zbudujUI() {
    if (ui) return ui;
    ui = {};
    ui.canvas = el('canvas', 'ge-canvas');
    ui.canvas.setAttribute('aria-hidden', 'true');
    korzen.insertBefore(ui.canvas, korzen.firstChild);
    var pasek = $('gePasek');
    ui.podmenu = el('nav', 'ge-podmenu', null, pasek);
    ui.podmenu.setAttribute('aria-label', 'Miejsca');
    M.MIEJSCA.forEach(function (m) {
      var b = el('button', 'ge-guzik', m.nazwa, ui.podmenu);
      b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { wejdzWMiejsce(m.id); });
      przyciskiMiejsc[m.id] = b;
    });
    ui.rozdzialy = el('nav', 'ge-rozdzialy', null, korzen);
    ui.rozdzialy.setAttribute('aria-label', 'Rozdziały');
    L.ROZDZIALY.forEach(function (r) {
      var b = el('button', 'ge-guzik', r.etykieta, ui.rozdzialy);
      b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { otworz({ miejsce: st.miejsce, tryb: 'pokaz', rozdzial: r.id }); });
      przyciskiRozdzialow[r.id] = b;
    });
    return ui;
  }
  function wejdzWMiejsce(id) {
    // przez rejestr zakładek: ładowanie.js dociągnie pliki miejsca, jeśli to pierwsze wejście
    window.Zakladki.przelacz('geologia', { miejsce: id, tryb: 'pokaz', rozdzial: 'polozenie' });
  }
  function odswiezUI() {
    var pozycje = M.podmenu(M.MIEJSCA, st.miejsce);
    pozycje.forEach(function (p) { if (przyciskiMiejsc[p.id]) przyciskiMiejsc[p.id].setAttribute('aria-pressed', String(p.wcisniety)); });
    L.ROZDZIALY.forEach(function (r) { przyciskiRozdzialow[r.id].setAttribute('aria-pressed', String(st.rozdzial === r.id)); });
    ui.rozdzialy.hidden = st.tryb === 'makieta';
  }
  function adres() {
    if (smoke) return;
    var h = '#geologia=' + st.miejsce + (st.tryb === 'makieta' ? '&tryb=makieta' : '&rozdzial=' + st.rozdzial);
    try { history.replaceState(null, '', location.pathname + location.search + h); } catch (_) { /* file:// */ }
  }

  /* ---------- renderer (jeden na życie strony) ---------- */
  function zapewnijGL() {
    if (gl) return gl;
    var r = new T.WebGLRenderer({ canvas: ui.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputEncoding = T.sRGBEncoding;
    gl = { renderer: r, w: 0, h: 0 };
    window.addEventListener('resize', dopasuj);
    return gl;
  }
  function dopasuj() {
    if (!gl) return;
    var w = korzen.clientWidth, h = korzen.clientHeight;
    if (!(w > 0 && h > 0) || (w === gl.w && h === gl.h)) return;
    gl.w = w; gl.h = h;
    gl.renderer.setSize(w, h, false);
  }
  function kolorTla() { return zap.kontrola === 'biel' ? 0xffffff : zap.kontrola === 'czern' ? 0x000000 : 0x05070a; }
  var scena = null, kamera = null;
  function krok(teraz) {
    rafId = 0;
    if (!aktywny) return;
    dopasuj();
    if (ostatni) { var dt = (teraz - ostatni) / 1000; if (dt > 0) fps += (1 / dt - fps) * 0.1; }
    ostatni = teraz;
    gl.renderer.render(scena, kamera);
    if (gotowosc) { console.log('GEOLOGIA_READY ' + gotowosc); gotowosc = null; }
    rafId = requestAnimationFrame(krok);
  }

  /* ---------- API ---------- */
  function otworz(stan) {
    var s = stan || {};
    var miejsce = M.MIEJSCA.some(function (m) { return m.id === s.miejsce; }) ? s.miejsce : M.MIEJSCA[0].id;
    var tryb = s.tryb === 'makieta' ? 'makieta' : 'pokaz';
    var rozdzial = tryb === 'makieta' ? null : (L.ROZDZIALY.some(function (r) { return r.id === s.rozdzial; }) ? s.rozdzial : L.ROZDZIALY[0].id);
    zbudujUI();
    st.miejsce = miejsce; st.tryb = tryb; st.rozdzial = rozdzial; st.ujecie = null; st.t = zap.t;
    korzen.hidden = false;
    try {
      zapewnijGL();
      if (!scena) { scena = new T.Scene(); kamera = new T.PerspectiveCamera(45, 1, 0.1, 100); }
      scena.background = new T.Color(kolorTla());
      gl.w = 0; dopasuj();
    } catch (e) {
      console.error('Geologia: nie udało się uruchomić renderera — ' + (e && e.message || e));
      return false;
    }
    odswiezUI(); adres();
    gotowosc = smoke ? miejsce + ' ' + (rozdzial || 'makieta') : null;
    if (smoke && /[?&]krzywe(?=[&=]|$)/.test(location.search)) sprawdzKrzywe();
    aktywny = true; ostatni = 0;
    if (!rafId) rafId = requestAnimationFrame(krok);
    return true;
  }
  function zamknij() {
    aktywny = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    gotowosc = null;
  }
  // G-C: po wczytaniu mysliwce/kino.js (które podmienia globalny obiekt krzywych) zapamiętane krzywe mają dalej swoje funkcje.
  function sprawdzKrzywe() {
    var s = doc.createElement('script');
    s.src = 'mysliwce/kino.js';
    var wynik = function (ok) { console.log('GEOLOGIA_KRZYWE ' + (ok ? 'ok' : 'zle')); };
    s.onload = function () {
      var k = L.krzywe;
      var funkcje = !!k && K_KRZYWE.every(function (n) { return typeof k[n] === 'function'; });
      // znany pozytyw przyrządu: bez window.MysliwceKino kino.js Myśliwców nadpisuje window.Kino (≠ krzywe);
      // z window.MysliwceKino globalne Kino nie jest ruszane (= krzywe)
      var nadpisanie = window.MysliwceKino ? window.Kino === k : window.Kino !== k;
      wynik(funkcje && nadpisanie);
    };
    s.onerror = function () { wynik(false); };
    doc.head.appendChild(s);
  }

  window.Geologia = {
    otworz: otworz,
    zamknij: zamknij,
    stan: function () {
      return { miejsce: st.miejsce, tryb: st.tryb, rozdzial: st.rozdzial, ujecie: st.ujecie, t: st.t, fps: Math.round(fps),
        jakosc: 'zwykla', lektor: smoke ? 'cisza' : 'brak' };
    },
    diagnostyka: function () {
      if (!gl) return null;
      var m = gl.renderer.info.memory, pr = gl.renderer.info.programs;
      return { geometrie: m.geometries, tekstury: m.textures, programy: pr ? pr.length : 0, audio: 0 };
    }
  };
})();
