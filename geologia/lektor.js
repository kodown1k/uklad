'use strict';
/* Zakładka Geologia — lektor filmów: nagrania wersów (scripts/gen-lektor.mjs → <katalog>/<id_z_podkreślnikami>.mp3
   + czasy.json) odtwarzane Web Audio w zgodzie z napisami (spec R6). Dual-export: node (czysta część, testy) i przeglądarka
   (window.GeologiaLektor).

   Czyste:
     GeologiaLektor.sha1(tekst) → hex (UTF-8), skrot(tekst, glos) = sha1(glos + "\n" + tekst) — ten sam wzór co
       scripts/lib/lektor.mjs (test parytetu); tekst = `wymowa || tekst` wersu.
     czasWersu(wers, czasy) → czas_s nagrania, gdy jest aktualne (skrot zgodny z tekstem czytanym i głosem z czasy.json),
       inaczej null → harmonogram liczy czas z tekstu (Rozdzialy.plan, 12,1 zn./s).
     aktualne(wersy, czasy) → { [id]: czas_s } tylko aktualnych nagrań — to, co pokaz podaje Rozdzialy.plan({ czasy })
       (rozdzial.lektor = jedyne źródło „czy jest lektor”, ruling 8c-1).
     powodBledu(e) → 'zaproszenie' | 'przygotowanie' | 'siec' — powód braku lektora z błędu pobrania (status HTTP albo jego brak).
     pobierzCzasy({ adres, limit_ms, limitPonowienia_ms?, probka?, fetch? }) → Promise<czasy> — czasy.json (+ próbka MP3) w jednym
       limicie czasu; po błędzie sieci jedna ponowna próba z cache 'force-cache' (słaby zasięg na szlaku, recenzja końcowa I-1).
   Przeglądarka:
     GeologiaLektor.utworz(katalog, czasy, ctx?, opcje?) → { przygotuj(ids) → Promise, graj(id, offset_s, kiedy?, poKoncu?), zatrzymaj(), pauza(),
       wznow(), cisza(bool), zegar(zawsze?) → s|null, kotwicz(t), przesun(d), ctxChwili(t) → s|null, planuj(wersy, horyzont_s), stan() → 'gra'|'cisza'|'brak',
       zwolnij(), blad(id) → { status } | null (status HTTP ostatniej nieudanej próby, 0 = sieć/dekodowanie) }
     GeologiaLektor.trybOdtwarzania(navigator) — sesja audio 'playback' (iOS: dźwięk mimo przełącznika wyciszenia), na gest.
     katalog = prefiks adresu (np. 'geologia/teneryfa/lektor/') albo funkcja plik → adres (token zaproszenia, ruling 9-2);
     ctx = AudioContext (wspólny z podkładem geologia/dzwiek.js); opcje.wyjscie = węzeł wejścia (mikser podkładu), inaczej
     ctx.destination. Nagrania rozdziału dekodowane z wyprzedzeniem do AudioBuffer (przygotuj); start wersu planowany
     150 ms naprzód na ctx.currentTime; pauza = ctx.suspend() (czas kontekstu stoi, więc wznowienie gra od miejsca
     zatrzymania); kotwicz(t) = przewinięcie: zatrzymuje zaplanowane źródła i wiąże chwilę filmu t z ctx.currentTime +
     150 ms; przesun(d) = ciągłe przejście do następnego rozdziału (zegar −d bez przerwy w dźwięku). zegar() = chwila filmu
     z ctx.currentTime — mistrz czasu filmu, gdy kontekst gra (null bez kontekstu, przed kotwicą i przy wstrzymanym
     kontekście). Błąd / 404 / brak kontekstu / brak czasy.json → stan 'brak' i jedno console.warn
     „Geologia/uwaga: lektor niedostępny (…)” (G-A); film gra dalej z napisami. W ?smoke pokaz lektora nie tworzy. */
(function (root) {
  var WYPRZEDZENIE = 0.15;

  /* ---------- SHA-1 (UTF-8) — bez zależności, synchronicznie (SubtleCrypto jest asynchroniczne) ---------- */
  function utf8(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { var d = s.charCodeAt(i + 1); if (d >= 0xdc00 && d < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; } }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | c >> 6, 0x80 | c & 63);
      else if (c < 0x10000) out.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
      else out.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    }
    return out;
  }
  function sha1(s) {
    var b = utf8(String(s)), n = b.length, bity = n * 8;
    b.push(0x80);
    while (b.length % 64 !== 56) b.push(0);
    for (var k = 7; k >= 0; k--) b.push(k >= 4 ? 0 : (bity >>> (k * 8)) & 255);
    var h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0, w = new Array(80);
    var rot = function (x, r) { return (x << r) | (x >>> (32 - r)); };
    for (var o = 0; o < b.length; o += 64) {
      for (var i = 0; i < 16; i++) w[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3];
      for (i = 16; i < 80; i++) w[i] = rot(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
      var a = h0, bb = h1, c = h2, d = h3, e = h4;
      for (i = 0; i < 80; i++) {
        var f, kk;
        if (i < 20) { f = (bb & c) | (~bb & d); kk = 0x5a827999; }
        else if (i < 40) { f = bb ^ c ^ d; kk = 0x6ed9eba1; }
        else if (i < 60) { f = (bb & c) | (bb & d) | (c & d); kk = 0x8f1bbcdc; }
        else { f = bb ^ c ^ d; kk = 0xca62c1d6; }
        var t = (rot(a, 5) + f + e + kk + w[i]) | 0;
        e = d; d = c; c = rot(bb, 30); bb = a; a = t;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    return [h0, h1, h2, h3, h4].map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }
  function skrot(tekst, glos) { return sha1(String(glos) + '\n' + String(tekst)); }

  function czasWersu(wers, czasy) {
    var c = wers && czasy && czasy.wersy && czasy.wersy[wers.id];
    if (!c || !(c.czas_s > 0) || typeof c.skrot !== 'string') return null;
    return c.skrot === skrot(wers.wymowa || wers.tekst, czasy.glos) ? +c.czas_s : null;
  }
  function aktualne(wersy, czasy) {
    var m = {};
    (wersy || []).forEach(function (w) { var x = czasWersu(w, czasy); if (x !== null) m[w.id] = x; });
    return m;
  }

  // iPhone z przełącznikiem wyciszenia: Web Audio milknie, chyba że sesja audio strony ma typ 'playback' (Safari 16.4+,
  // navigator.audioSession). Wołane na gest, przed utworzeniem/wznowieniem AudioContext (pokaz i lektor pinów makiety).
  // → true, gdy ustawiono; brak API albo błąd → false (bez wyjątku).
  function trybOdtwarzania(nav) {
    try {
      if (!nav || !nav.audioSession) return false;
      nav.audioSession.type = 'playback';
      return nav.audioSession.type === 'playback';
    } catch (_) { return false; }
  }

  // Powód braku lektora po nieudanym pobraniu (recenzja końcowa I-1): 401/403/410 → 'zaproszenie' (nieważne albo wygasłe),
  // 404 i inne 4xx → 'przygotowanie' (serwer odpowiada, pliku nie ma albo jest zły), bez statusu HTTP (fetch odrzucony,
  // AbortError, limit czasu, urwany odczyt, strona portalu Wi-Fi zamiast JSON) oraz 408/429/5xx → 'siec' (warto ponowić).
  // Błąd z polem `powod` (napis) zachowuje je.
  function powodBledu(e) {
    if (e && typeof e.powod === 'string') return e.powod;
    var s = e && +e.status || 0;
    if (s === 401 || s === 403 || s === 410) return 'zaproszenie';
    if (s >= 400 && s < 500 && s !== 408 && s !== 429) return 'przygotowanie';
    return 'siec';
  }
  function bladHttp(co, status) { var e = new Error(co + ' HTTP ' + status); e.status = status; return e; }
  // błąd bez odpowiedzi (sieć, przerwany odczyt, zły JSON) z nazwą pliku w opisie; powód liczony z oryginału
  function bladPliku(co, e) { var e2 = new Error(co + ': ' + (e && e.message || e)); e2.powod = powodBledu(e); return e2; }
  // Pobranie czasy.json lektora (pokaz i lektor pinów makiety): o = { adres, limit_ms, limitPonowienia_ms?, probka?(czasy) →
  // { adres, plik } | null, fetch? } → Promise<czasy>; odrzucenie = Error z `powod` (powodBledu) i `proby` (liczba prób).
  // Limit czasu obejmuje czasy.json i próbkę MP3 (wyścig z zegarem + AbortController — także gdy fetch nie reaguje na abort).
  // Pierwsza próba `cache: 'no-cache'` (świeży plik po nowych nagraniach); po błędzie sieci jedna ponowna z 'force-cache':
  // bez zasięgu przeglądarka odda plik z pamięci podręcznej (nieaktualny da najwyżej niezgodny skrót → wers bez nagrania).
  function pobierzCzasy(o) {
    var pobierz = o.fetch || function (u, op) { return root.fetch(u, op); };
    function proba(cache, limit) {
      var ac = typeof AbortController === 'function' ? new AbortController() : null;
      var op = { credentials: 'omit', cache: cache, signal: ac ? ac.signal : undefined };
      var p = Promise.resolve().then(function () { return pobierz(o.adres, op); }).then(function (r) {
        if (!r.ok) throw bladHttp('czasy.json', r.status);
        return r.json().then(null, function (e) { throw bladPliku('czasy.json', e); });
      }, function (e) { throw bladPliku('czasy.json', e); }).then(function (cz) {
        if (!cz || typeof cz.glos !== 'string' || !cz.wersy) { var e = new Error('czasy.json bez glos/wersy'); e.powod = 'przygotowanie'; throw e; }
        var pr = o.probka ? o.probka(cz) : null;
        if (!pr) return cz;
        return pobierz(pr.adres, op).then(function (r) {
          try { if (r.body && r.body.cancel) r.body.cancel(); } catch (_) { /* nic */ }
          if (!r.ok) throw bladHttp(pr.plik, r.status);
          return cz;
        }, function (e) { throw bladPliku(pr.plik, e); });
      });
      return new Promise(function (ok, zle) {
        var zeg = setTimeout(function () {
          if (ac) { try { ac.abort(); } catch (_) { /* nic */ } }
          var e = new Error('czasy.json: brak odpowiedzi'); e.powod = 'siec'; zle(e);
        }, limit);
        p.then(function (cz) { clearTimeout(zeg); ok(cz); }, function (e) { clearTimeout(zeg); zle(e); });
      });
    }
    var limit = o.limit_ms > 0 ? o.limit_ms : 8000, limit2 = o.limitPonowienia_ms > 0 ? o.limitPonowienia_ms : limit / 2;
    var oznacz = function (n) { return function (e) { if (!e || typeof e !== 'object') e = new Error(String(e)); e.powod = powodBledu(e); e.proby = n; throw e; }; };
    return proba('no-cache', limit).then(null, function (e) {
      if (powodBledu(e) !== 'siec') return oznacz(1)(e);
      return proba('force-cache', limit2).then(null, oznacz(2));
    });
  }

  var api = { sha1: sha1, skrot: skrot, czasWersu: czasWersu, aktualne: aktualne, trybOdtwarzania: trybOdtwarzania, powodBledu: powodBledu,
    pobierzCzasy: pobierzCzasy, WYPRZEDZENIE: WYPRZEDZENIE };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---------- przeglądarka ---------- */
  function utworz(katalog, czasy, ctx, opcje) {
    opcje = opcje || {};
    var adres = typeof katalog === 'function' ? katalog : function (plik) { return String(katalog || '') + plik; };
    var wpisy = czasy && czasy.wersy || null;
    var bufory = {}, ladowane = {}, zle = {}, statusy = {}, proby = {}, zrodla = [], zaplanowane = {}, kotwica = null, wyciszony = false, ostrzezono = false, zwolniony = false;
    var wzm = null;
    function ostrzez(powod) {
      if (ostrzezono) return;
      ostrzezono = true;
      console.warn('Geologia/uwaga: lektor niedostępny (' + powod + ')');
    }
    if (!ctx) ostrzez('brak AudioContext');
    else if (!wpisy) { if (!opcje.cicho) ostrzez('brak czasy.json'); }
    else {
      try { wzm = ctx.createGain(); wzm.connect(opcje.wyjscie || ctx.destination); } catch (e) { wzm = null; ostrzez('Web Audio: ' + (e && e.message || e)); }
    }
    function dekoduj(b) {
      return new Promise(function (ok, zle2) {
        var p = ctx.decodeAudioData(b, ok, zle2);           // starsze Safari: tylko wywołania zwrotne
        if (p && typeof p.then === 'function') p.then(ok, zle2);
      });
    }
    function laduj(id) {
      if (!wzm || !wpisy || !wpisy[id]) return Promise.resolve(null);
      if (bufory[id]) return Promise.resolve(bufory[id]);
      if (ladowane[id]) return ladowane[id];
      proby[id] = true;
      ladowane[id] = fetch(adres(wpisy[id].plik), { credentials: 'omit' }).then(function (r) {
        if (!r.ok) { var e = new Error('HTTP ' + r.status + ' ' + wpisy[id].plik); e.status = r.status; throw e; }
        return r.arrayBuffer();
      }).then(dekoduj).then(function (buf) {
        if (zwolniony) return null;
        bufory[id] = buf; return buf;
      }, function (e) {
        // status HTTP ostatniej nieudanej próby (0 = sieć, dekodowanie); ponowne laduj(id) próbuje od nowa
        zle[id] = true; statusy[id] = e && e.status || 0; delete ladowane[id];
        ostrzez(id + ': ' + (e && e.message || e));
        return null;
      });
      return ladowane[id];
    }
    function przygotuj(ids) { return Promise.all((ids || []).map(laduj)); }
    // poKoncu (opcjonalne) — wołane, gdy nagranie dogra do końca (zatrzymaj() go nie woła); lektor pinów makiety (Task 8d)
    function graj(id, offset_s, kiedy, poKoncu) {
      var b = bufory[id];
      if (!b || !wzm) return false;
      var teraz = ctx.currentTime, t = kiedy != null ? kiedy : teraz + WYPRZEDZENIE, off = Math.max(0, offset_s || 0);
      if (t < teraz) { off += teraz - t; t = teraz; }
      if (off >= b.duration) return false;
      var s = ctx.createBufferSource();
      s.buffer = b; s.connect(wzm);
      s.start(t, off);
      var z = { s: s, id: id };
      zrodla.push(z);
      s.onended = function () {
        var i = zrodla.indexOf(z); if (i >= 0) zrodla.splice(i, 1); try { s.disconnect(); } catch (_) { /* nic */ }
        if (typeof poKoncu === 'function') poKoncu(id);
      };
      return true;
    }
    function zatrzymaj() {
      zrodla.forEach(function (z) { try { z.s.onended = null; z.s.stop(); z.s.disconnect(); } catch (_) { /* nic */ } });
      zrodla = []; zaplanowane = {};
    }
    function kotwicz(t) {
      zatrzymaj();
      kotwica = ctx ? { film: t, ctx: ctx.currentTime + WYPRZEDZENIE } : null;
    }
    function przesun(d) { if (kotwica) { kotwica.film -= d; zaplanowane = {}; } }
    // czas kontekstu chwili filmu t (wg kotwicy) — planowanie zdarzeń dźwięku na zegarze kontekstu (cisza przed Cc); null bez kotwicy
    function ctxChwili(t) { return kotwica ? kotwica.ctx + (t - kotwica.film) : null; }
    // zawsze = chwila filmu także przy wstrzymanym kontekście (czas kontekstu stoi tam, gdzie dźwięk stanął) — pauza pokazu
    function zegar(zawsze) {
      if (!ctx || !kotwica || ctx.state === 'closed' || (!zawsze && ctx.state !== 'running')) return null;
      return kotwica.film + Math.max(0, ctx.currentTime - kotwica.ctx);
    }
    // wersy rozdziału w czasie filmu ({ id, start, koniec }): planuje start tych, które zaczną się w horyzoncie;
    // wers trwający w chwili kotwicy gra od miejsca (offset) — skok ←/→ startuje od początku wersu, bo zegar staje na nim
    function planuj(wersy, horyzont) {
      if (!kotwica || !wzm || ctx.state !== 'running') return;
      var teraz = ctx.currentTime, tf = kotwica.film + Math.max(0, teraz - kotwica.ctx), h = horyzont || 2;
      (wersy || []).forEach(function (w) {
        if (zaplanowane[w.id] || w.koniec <= tf + 0.05 || w.start > tf + h) return;
        if (!bufory[w.id]) { if (!zle[w.id]) laduj(w.id); return; }
        zaplanowane[w.id] = true;
        var kiedy = kotwica.ctx + (w.start - kotwica.film);
        graj(w.id, 0, kiedy);
      });
    }
    // suspend() zawsze, gdy kontekst żyje: pauza tuż po wznowieniu (resume() w toku, stan jeszcze 'suspended') inaczej
    // zostałaby pominięta, a kontekst ruszyłby po rozstrzygnięciu resume() przy wyświetlonej pauzie
    function pauza() { if (ctx && ctx.state !== 'closed') return ctx.suspend(); return Promise.resolve(); }
    function wznow() { if (ctx && ctx.state !== 'closed') return ctx.resume(); return Promise.resolve(); }
    function cisza(wl) {
      wyciszony = !!wl;
      if (wzm) wzm.gain.setTargetAtTime(wyciszony ? 0 : 1, ctx.currentTime, 0.02);
    }
    function stan() {
      if (!wzm || !wpisy || zwolniony) return 'brak';
      // 'brak', gdy zawiodło każde nagranie, które próbowano wczytać (rozdział i następny — nie cały czasy.json z pinami;
      // recenzja 9a M-1): 403/404 na MP3 = bez lektora, choćby czasy.json przyszedł
      var ids = Object.keys(proby);
      if (ids.length && ids.every(function (id) { return zle[id] && !bufory[id]; })) return 'brak';
      return wyciszony ? 'cisza' : 'gra';
    }
    function zwolnij() {
      zwolniony = true;
      zatrzymaj();
      if (wzm) { try { wzm.disconnect(); } catch (_) { /* nic */ } }
      bufory = {}; ladowane = {}; kotwica = null;
    }
    return { przygotuj: przygotuj, graj: graj, zatrzymaj: zatrzymaj, pauza: pauza, wznow: wznow, cisza: cisza, zegar: zegar, kotwicz: kotwicz, przesun: przesun, ctxChwili: ctxChwili,
      planuj: planuj, stan: stan, zwolnij: zwolnij, zrodla: function () { return zrodla.length; },
      // ostatni błąd wczytania nagrania: { status } (status HTTP, 0 = sieć/dekodowanie) albo null, gdy nagranie jest
      blad: function (id) { return zle[id] && !bufory[id] ? { status: statusy[id] || 0 } : null; },
      zdekodowane: function () { return Object.keys(bufory).length; } };
  }
  api.utworz = utworz;
  root.GeologiaLektor = api;
})(typeof window !== 'undefined' ? window : globalThis);
