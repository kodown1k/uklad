'use strict';
/* Zjawiska naukowe — czysta logika widoku prezentacji (bez DOM/THREE; dual-export jak earth-fx.js).
   - adres: hash `#zjawisko=<id>&krok=N` i zapytanie `?smoke&zjawisko=<id>&krok=N`,
   - przejścia między krokami i mapowanie klawiszy,
   - pomocnicze funkcje czasu/kamery (wygładzanie, pętla, okno),
   - wartości schematów: Ryc. 4 (dwa zachowania pierścienia) i Ryc. 5 (trzy źródła energii),
   - walidacja definicji zjawiska (używana w testach rejestru). */
(function (root) {
  var ID_RE = /^[a-z0-9][a-z0-9-]*$/;

  /* ---------- adres ---------- */
  function _pola(s) {
    var out = {};
    String(s).split('&').forEach(function (kawalek) {
      if (!kawalek) return;
      var i = kawalek.indexOf('=');
      var k = i < 0 ? kawalek : kawalek.slice(0, i);
      var v = i < 0 ? '' : kawalek.slice(i + 1);
      try { v = decodeURIComponent(v); } catch (_) { /* zostaw surowe */ }
      out[k] = v;
    });
    return out;
  }
  function _chwila(v) {                       // `t=` sekundy filmu ≥ 0; puste albo nieliczbowe → brak
    var t = Number(v);
    return (v != null && v !== '' && isFinite(t)) ? Math.max(0, t) : undefined;
  }
  function _krok(v) {
    var n = Math.floor(Number(v));
    return (isFinite(n) && n >= 1) ? n : 1;
  }
  // '#zjawisko=id&krok=N' → {zjawisko, krok}; '#zjawiska' → lista ({zjawisko:null}); obcy hash → null.
  function parsujHash(hash) {
    if (typeof hash !== 'string') return null;
    var s = hash.charAt(0) === '#' ? hash.slice(1) : hash;
    if (!s) return null;
    var p = _pola(s);
    if ('zjawisko' in p) {
      if (!ID_RE.test(p.zjawisko)) return null;
      var o = { zjawisko: p.zjawisko, krok: _krok(p.krok) };
      if ('film' in p) {                       // '#zjawisko=id&film[&t=sekundy]' — film zjawiska od chwili t
        o.film = true;
        if (_chwila(p.t) !== undefined) o.t = _chwila(p.t);
      }
      return o;
    }
    if ('zjawiska' in p) return { zjawisko: null, krok: 1 };
    return null;
  }
  // '?smoke&zjawisko=id&krok=N' → {zjawisko, krok, smoke}; bez `zjawisko` → null.
  function parsujZapytanie(search) {
    if (typeof search !== 'string') return null;
    var s = search.charAt(0) === '?' ? search.slice(1) : search;
    var p = _pola(s);
    if (!('zjawisko' in p) || !ID_RE.test(p.zjawisko)) return null;
    var o = { zjawisko: p.zjawisko, krok: _krok(p.krok), smoke: ('smoke' in p) };
    // hak smoke filmu `?smoke&zjawisko=id&film&t=S`: `t` = sekundy filmu (bez `film` `t` to faza ujęcia 0..1).
    // solar.js nie startuje filmu Voyagera, gdy w zapytaniu jest `zjawisko=` (pilnuje test).
    if ('film' in p) {
      o.film = true;
      if (_chwila(p.t) !== undefined) o.t = _chwila(p.t);
      if (TYPY_PRZEJSC.indexOf(p.przejscie) >= 0) o.przejscie = p.przejscie;   // podgląd: każde przejście tego typu
    }
    return o;
  }
  function budujHash(id, krok) {
    if (!id) return '#zjawiska';
    return '#zjawisko=' + id + '&krok=' + _krok(krok);
  }

  /* ---------- kroki ---------- */
  function ograniczKrok(n, liczba) {
    var m = (liczba >= 1) ? Math.floor(liczba) : 1;
    var k = Math.floor(Number(n));
    if (!isFinite(k) || k < 1) return 1;
    return k > m ? m : k;
  }
  // akcja: 'dalej' | 'wstecz' | 'pierwszy' | 'ostatni' | {idz:N}; nieznana → bez zmiany.
  function przejscie(krok, akcja, liczba) {
    if (akcja === 'dalej') return ograniczKrok(krok + 1, liczba);
    if (akcja === 'wstecz') return ograniczKrok(krok - 1, liczba);
    if (akcja === 'pierwszy') return 1;
    if (akcja === 'ostatni') return ograniczKrok(Infinity === liczba ? 1 : liczba, liczba);
    if (akcja && typeof akcja === 'object' && 'idz' in akcja) return ograniczKrok(akcja.idz, liczba);
    return ograniczKrok(krok, liczba);
  }
  // Klawisz → akcja widoku. Z Ctrl/Alt/Meta oddajemy klawisz przeglądarce (Alt+← = wstecz w historii).
  function akcjaKlawisza(e) {
    if (!e || e.ctrlKey || e.altKey || e.metaKey) return null;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': return 'dalej';
      case 'ArrowLeft': case 'PageUp': return 'wstecz';
      case ' ': case 'Spacebar': return e.shiftKey ? 'wstecz' : 'dalej';
      case 'Home': return 'pierwszy';
      case 'End': return 'ostatni';
      case 'Escape': case 'Esc': return 'zamknij';
      case 'o': case 'O': return 'rozejrzyj';
      case 'f': case 'F': return 'pelnyEkran';
      case 't': case 'T': return 'tekst';
      case 's': case 'S': return 'seans';
      default: return null;
    }
  }

  /* ---------- czas / kamera ---------- */
  function wygladz(k) {                       // easeInOutCubic, obcięte do [0,1]
    if (!(k > 0)) return 0;
    if (k >= 1) return 1;
    return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  }
  function mieszaj3(a, b, k) {
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }
  function tempoRuchu(ograniczony) { return ograniczony ? 0.35 : 1; }
  function petla(t, okres) {                  // faza pętli animacji w [0,1)
    if (!(okres > 0)) return 0;
    var f = (t / okres) % 1;
    return f < 0 ? f + 1 : f;
  }
  function odcinek(f, a, b) {                 // postęp 0..1 wewnątrz okna [a,b]
    if (f <= a) return 0;
    if (f >= b) return 1;
    return (f - a) / (b - a);
  }

  /* =====================================================================
     KINO: kadr 2.39:1, ujęcia kamery, napisy, seans, rozsuwanie etykiet
     ===================================================================== */
  var KINO = {
    PROPORCJA: 2.39,          // format kadru (CinemaScope)
    PAS_MIN: 76,              // najwęższy pas letterboxu [px] — musi zmieścić napisy / UI
    FOV_MAX: 75,              // sufit FOV (dolly zoom nie rozciąga kadru w rybie oko)
    NAPIS_MIN: 2.2,           // najkrótszy czas wersu [s]
    NAPIS_NA_ZNAK: 0.062,     // czas czytania na znak [s]
    NAPIS_ROZBIEG: 0.9,       // stały narzut na wers [s]
    ODDECH_PO_NAPISACH: 2.5,  // seans: chwila na sam obraz po ostatnim wersie [s]
    DOJAZD: 1.6,              // płynne przejście kamery między krokami tej samej sceny [s]
    CZERN: 0.5,               // połowa cięcia przez czerń [s]
    // film: domyślne czasy przejść [s] (połowa przed zmianą zawartości, połowa po) i sufit rozciągnięcia ruchu kamery
    PRZEJSCIE: { start: 0, dojazd: 1.6, ciecie: 0, przenikanie: 1.6, most: 2.4, przelot: 1.4, czern: 1.0 },
    ROZCIAGNIECIE_MAX: 1.8
  };

  // Kadr z rozmiaru okna. Poziomo: zawsze 2.39:1 z czarnymi pasami (napisy w dolnym; przy niskim oknie pasy też po bokach). Telefon w pionie: kadr pełny
  // (bez letterboxu), a pod nim strefa tekstu — narracja nie może zniknąć.
  function kadrKinowy(w, h) {
    w = Math.max(0, Math.floor(w) || 0); h = Math.max(0, Math.floor(h) || 0);
    if (w < h) {
      var gora = Math.min(52, h), kh = Math.max(0, Math.min(Math.round(h * 0.42), h - gora));
      return { tryb: 'pelny', x: 0, y: gora, w: w, h: kh, pasGora: gora, pasDol: h - gora - kh };
    }
    var pas = Math.min(KINO.PAS_MIN, Math.floor(h / 2));
    var wys = Math.max(0, Math.min(Math.round(w / KINO.PROPORCJA), h - 2 * pas));
    var szer = Math.min(w, Math.round(wys * KINO.PROPORCJA));      // niskie, szerokie okno: pasy także po bokach — kadr zostaje 2.39:1
    var pg = Math.floor((h - wys) / 2);
    return { tryb: 'kino', x: Math.floor((w - szer) / 2), y: pg, w: szer, h: wys, pasGora: pg, pasDol: h - wys - pg };
  }
  // Ujęcia są komponowane dla 2.39:1; węższy kadr trzyma POZIOMY kąt widzenia (nic nie wypada bokami).
  function fovDlaProporcji(fov, aspekt, bazowa) {
    var b = bazowa || KINO.PROPORCJA;
    if (!(aspekt > 0) || aspekt >= b) return fov;
    return 2 * Math.atan(Math.tan(fov * Math.PI / 360) * b / aspekt) * 180 / Math.PI;
  }

  // Catmull-Rom (jednorodny) przez punkty kontrolne; u ∈ [0,1], końce przypięte.
  function katmull(p, u) {
    var n = p.length;
    if (n === 1) return p[0].slice();
    if (!(u > 0)) return p[0].slice();
    if (u >= 1) return p[n - 1].slice();
    var x = u * (n - 1), i = Math.min(Math.floor(x), n - 2), t = x - i;
    if (n === 2) return mieszaj3(p[0], p[1], t);
    var p0 = p[Math.max(i - 1, 0)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(i + 2, n - 1)], t2 = t * t, t3 = t2 * t, o = [];
    for (var k = 0; k < 3; k++) {
      o.push(0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
    }
    return o;
  }
  // Dolly zoom (vertigo): kamera jedzie, FOV zmienia się przeciwnie — obiekt trzyma rozmiar w kadrze.
  function fovDollyZoom(fov0, d0, d) {
    if (!(d > 0) || !(d0 > 0)) return fov0;
    var f = 2 * Math.atan(Math.tan(fov0 * Math.PI / 360) * d0 / d) * 180 / Math.PI;
    return f > KINO.FOV_MAX ? KINO.FOV_MAX : f;
  }
  function _dyst(a, b) { return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2])); }
  function _para(v, u, wymiar) {             // wartość stała albo [start, koniec] → interpolacja liniowa
    if (v == null) return wymiar === 2 ? [0, 0] : 0;
    if (wymiar === 2) {
      if (typeof v[0] === 'number') return [v[0], v[1]];
      return [v[0][0] + (v[1][0] - v[0][0]) * u, v[0][1] + (v[1][1] - v[0][1]) * u];
    }
    if (typeof v === 'number') return v;
    return v[0] + (v[1] - v[0]) * u;
  }
  // Stan kamery w postępie u ∈ [0,1] ujęcia: pozycja na torze, cel, FOV, kompozycja (gdzie w kadrze leży cel,
  // w NDC: ±1/3 = linie trójpodziału) i przechył. opcje.bezDollyZoom (prefers-reduced-motion) → FOV stały = końcowy.
  function stanUjecia(uj, u, opcje) {
    u = u < 0 ? 0 : (u > 1 ? 1 : u);
    var poz = katmull(uj.tor, u);
    var cel = (typeof uj.cel[0] === 'number') ? uj.cel.slice() : katmull(uj.cel, u);
    var fov;
    if (uj.dollyZoom) {
      var f0 = typeof uj.fov === 'number' ? uj.fov : uj.fov[0];
      var c0 = (typeof uj.cel[0] === 'number') ? uj.cel : uj.cel[0], c1 = (typeof uj.cel[0] === 'number') ? uj.cel : uj.cel[uj.cel.length - 1];
      var d0 = _dyst(uj.tor[0], c0);
      fov = (opcje && opcje.bezDollyZoom) ? fovDollyZoom(f0, d0, _dyst(uj.tor[uj.tor.length - 1], c1)) : fovDollyZoom(f0, d0, _dyst(poz, cel));
    } else fov = _para(uj.fov, u, 1);
    return { poz: poz, cel: cel, fov: fov, komp: _para(uj.komp, u, 2), przechyl: _para(uj.przechyl, u, 1) };
  }
  function postepUjecia(t, czas) {            // łagodny start i koniec ruchu (sinus), monotoniczny
    if (!(czas > 0)) return 1;
    var k = t / czas;
    if (!(k > 0)) return 0;
    if (k >= 1) return 1;
    return 0.5 - 0.5 * Math.cos(Math.PI * k);
  }
  // Oddech kamery: suma niewspółmiernych sinusów, |składowa| ≤ siła.
  function oddech(t, sila) {
    if (!(sila > 0)) return [0, 0, 0];
    return [
      sila * (0.6 * Math.sin(t * 0.43) + 0.4 * Math.sin(t * 0.97 + 1.3)),
      sila * (0.6 * Math.sin(t * 0.37 + 2.1) + 0.4 * Math.sin(t * 0.83 + 0.4)),
      sila * (0.6 * Math.sin(t * 0.29 + 4.0) + 0.4 * Math.sin(t * 0.71 + 2.7))
    ];
  }
  function czyCiecie(scenaA, scenaB) { return !!scenaA && !!scenaB && scenaA !== scenaB; }

  /* ---------- napisy / seans ---------- */
  var ZDANIE_RE = /[^.?!…]+(?:[.?!…]+[”"»)]*|$)/g;
  function podzielNaZdania(akapity) {
    var out = [];
    (akapity || []).forEach(function (a) {
      (String(a).match(ZDANIE_RE) || []).forEach(function (z) { z = z.trim(); if (z) out.push(z); });
    });
    return out;
  }
  function czasCzytania(zdanie) { return Math.max(KINO.NAPIS_MIN, KINO.NAPIS_ROZBIEG + KINO.NAPIS_NA_ZNAK * String(zdanie).length); }
  function harmonogramNapisow(zdania) {
    var t = 0;
    return zdania.map(function (z) { var o = { start: t, koniec: t + czasCzytania(z) }; t = o.koniec; return o; });
  }
  function indeksNapisu(h, t) {
    if (!h.length) return -1;
    for (var i = 0; i < h.length; i++) if (t < h[i].koniec) return i;
    return h.length - 1;
  }
  function czasKroku(zdania) {
    var h = harmonogramNapisow(zdania);
    return (h.length ? h[h.length - 1].koniec : 0) + KINO.ODDECH_PO_NAPISACH;
  }
  // Dron (opcjonalny dźwięk): niski ton rosnący z krokiem, 46 → 92 Hz (oktawa na całą opowieść).
  function czestotliwoscDronu(krok, liczba) {
    var u = liczba > 1 ? (ograniczKrok(krok, liczba) - 1) / (liczba - 1) : 0;
    return 46 * Math.pow(2, u);
  }

  /* ---------- rozsuwanie etykiet ----------
     Wejście: prostokąty {x,y,w,h} w kolejności ważności (null = etykieta niewidoczna). Pierwsza zostaje; każda
     następna, jeśli nachodzi na już ułożone, jest przesuwana TYLKO w pionie o najmniejszy skok, który kończy kolizję. */
  function _nachodza(a, b, luz) { return a.x < b.x + b.w + luz && b.x < a.x + a.w + luz && a.y < b.y + b.h + luz && b.y < a.y + a.h + luz; }
  function rozsunEtykiety(prost, granice) {
    var ulozone = [], out = [], LUZ = 2, H = granice && granice.h > 0 ? granice.h : Infinity;
    for (var i = 0; i < prost.length; i++) {
      var p = prost[i];
      if (!p) { out.push(null); continue; }
      var r = { x: p.x, y: p.y, w: p.w, h: p.h };
      var kandydaci = [r.y];
      for (var j = 0; j < ulozone.length; j++) { kandydaci.push(ulozone[j].y + ulozone[j].h + LUZ + 1, ulozone[j].y - r.h - LUZ - 1); }
      kandydaci.sort(function (a, b) { return Math.abs(a - p.y) - Math.abs(b - p.y); });
      for (var k = 0; k < kandydaci.length; k++) {
        var y = kandydaci[k];
        if (y < 0 || y + r.h > H) continue;
        var kol = false;
        for (var m = 0; m < ulozone.length && !kol; m++) kol = _nachodza({ x: r.x, y: y, w: r.w, h: r.h }, ulozone[m], LUZ);
        if (!kol) { r.y = y; break; }
      }
      ulozone.push(r); out.push(r);
    }
    return out;
  }

  /* ---------- Ryc. 4: dwa zachowania pierścienia (schemat, nie pomiar) ---------- */
  var RYC4 = { F_FALI: 100, F_MIN: 5, F_MAX: 195, MOC_MAX: 6 };
  function strefaPierscienia(fObrotu) {
    if (fObrotu < RYC4.F_FALI) return 'pochlania';
    if (fObrotu > RYC4.F_FALI) return 'wzmacnia';
    return 'prog';
  }
  function pozycjaNaOsi(f) {
    var u = (f - RYC4.F_MIN) / (RYC4.F_MAX - RYC4.F_MIN);
    return u < 0 ? 0 : (u > 1 ? 1 : u);
  }
  function przemiatanie(u) {
    var k = u < 0 ? 0 : (u > 1 ? 1 : u);
    return RYC4.F_MIN + (RYC4.F_MAX - RYC4.F_MIN) * k;
  }
  function skretOdbitej(fObrotu) { return fObrotu > RYC4.F_FALI ? -1 : 1; }
  // Amplituda rysowanej fali odbitej względem wejściowej. DWA STANY, nie krzywa: artykuł podaje tylko
  // „słabnie” poniżej progu i „moc nawet ×6” powyżej (amplituda = √mocy). Wartość „słabnie” jest umowna.
  function amplitudaUmowna(fObrotu) {
    var s = strefaPierscienia(fObrotu);
    if (s === 'pochlania') return 0.55;
    if (s === 'wzmacnia') return Math.sqrt(RYC4.MOC_MAX);
    return 1;
  }

  /* ---------- Ryc. 5: ułamek masy zamieniany w energię ---------- */
  var RYC5 = [
    { id: 'uran', nazwa: 'rozszczepienie uranu', procent: 0.1, opis: 'ok. 0,1%' },
    { id: 'slonce', nazwa: 'synteza wodoru w Słońcu', procent: 0.7, opis: 'ok. 0,7%' },
    { id: 'dziura', nazwa: 'wirująca czarna dziura', procent: 29, opis: 'do 29%' }
  ];
  function ulamekObrotu() { return 1 - 1 / Math.SQRT2; }
  function dlugosciSlupkow(maks) {
    var m = Math.max.apply(null, RYC5.map(function (z) { return z.procent; }));
    return RYC5.map(function (z) { return maks * z.procent / m; });
  }
  function ileRazy(idA, idB) {
    var a = RYC5.filter(function (z) { return z.id === idA; })[0];
    var b = RYC5.filter(function (z) { return z.id === idB; })[0];
    return (a && b && b.procent > 0) ? a.procent / b.procent : NaN;
  }

  /* ---------- walidacja definicji zjawiska ---------- */
  function liczZdania(akapity) {
    var n = 0;
    (akapity || []).forEach(function (a) {
      var m = String(a).match(ZDANIE_RE) || [];
      m.forEach(function (z) { if (z.trim()) n++; });
    });
    return n;
  }
  function _trojka(v) { return Array.isArray(v) && v.length === 3 && v.every(function (x) { return typeof x === 'number' && isFinite(x); }); }
  /* ---------- film: jeden seans z przejściami (spec docs/superpowers/specs/2026-11-19-zjawiska-film-design.md) ----------
     Krok i zajmuje [start, koniec). Przejście DO kroku i trwa `czas` i jest wyśrodkowane na `start` (chwila zmiany
     zawartości): połowa w oddechu poprzedniego kroku, połowa w nowym. Napisy kroku startują po przejściu, a kończą
     się co najmniej ODDECH_PO_NAPISACH przed końcem kroku. Ruch kamery kroku przy przejściu ciągłym (dojazd,
     przenikanie, most) zaczyna się z początkiem przejścia — schodzi z pozy końcowej poprzedniego ujęcia (jak `pose`
     w kino.js) — więc wymiana zawartości wypada w ruchu, nie w bezruchu. Ruch trwa do początku następnego przejścia,
     rozciągnięty najwyżej ×ROZCIAGNIECIE_MAX; dalej kamera trzyma kadr. */
  var TYPY_PRZEJSC = ['dojazd', 'ciecie', 'przenikanie', 'most', 'przelot', 'czern'];
  var CIAGLE = { dojazd: true, przenikanie: true, most: true };
  // Przejście z kroku a do b: pole `b.przejscie` (typ albo {typ, czas?, napis?}) albo domyślne (ta sama scena = dojazd,
  // inna = czerń — dzisiejsze zachowanie widoku, więc zjawisko bez danych dostaje film bez zmian).
  function przejscieKroku(a, b) {
    if (!a) return { typ: 'start', czas: 0, napis: null };
    var p = b && b.przejscie, typ, czas, napis = null;
    if (p && typeof p === 'object') { typ = p.typ; czas = p.czas; napis = p.napis || null; }
    else typ = p || (czyCiecie(a.scena, b.scena) ? 'czern' : 'dojazd');
    if (!(czas >= 0)) czas = KINO.PRZEJSCIE[typ];
    return { typ: typ, czas: czas, napis: napis };
  }
  // Wersy kroku w filmie: [{tekst, ramka}] — `ramka` = wers zastrzeżenia (widok styluje go jako ramkę). 'pelna' = jak
  // kroki (narracja + ramka z punktami); 'skrot' = zdania wybrane w `film.wersy` (indeksy zdań narracji) + tekst ramki
  // (zastrzeżenia zostają); bez wyboru skrót = pełna.
  function wersyFilmu(k, dlugosc) {
    var zd = podzielNaZdania(k.narracja), wybor = dlugosc === 'skrot' && k.film && Array.isArray(k.film.wersy);
    if (wybor) zd = k.film.wersy.map(function (i) { return zd[i]; }).filter(Boolean);
    var out = zd.map(function (z) { return { tekst: z, ramka: false }; });
    if (k.ramka) {
      var r = podzielNaZdania([k.ramka.tekst || '']);
      if (!wybor) r = r.concat(k.ramka.punkty || []);
      r.forEach(function (z) { out.push({ tekst: z, ramka: true }); });
    }
    return out;
  }
  // Najkrótsze przejście ciągłe, przy którym obrót kierunku patrzenia nie przekracza 90% limitu (70°/s, most 35°/s).
  // Mierzone symulacją mieszania (kamera obiega strefę, cel liniowo — sam kąt między kierunkami zaniża obrót),
  // z najszybszym możliwym ruchem ujęcia B (bez rozciągnięcia). Kandydaci rosną od czasu domyślnego.
  var OBROT_MAX = 70, OBROT_MOST = 35;
  function _kierunek(p) { return [p.cel[0] - p.poz[0], p.cel[1] - p.poz[1], p.cel[2] - p.poz[2]]; }
  function _katMiedzy(a, b) {
    var na = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]), nb = Math.sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]);
    return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (na * nb || 1)))) * 180 / Math.PI;
  }
  function _mieszajPoze(a, p, w, s) {
    return { poz: mieszajWokol(a.poz, p.poz, w, s), cel: mieszaj3(a.cel, p.cel, w), fov: a.fov + (p.fov - a.fov) * w,
      komp: [a.komp[0] + (p.komp[0] - a.komp[0]) * w, a.komp[1] + (p.komp[1] - a.komp[1]) * w],
      przechyl: a.przechyl + (p.przechyl - a.przechyl) * w };
  }
  function czasPrzejsciaCiaglego(krokA, krokB, typ, domyslny) {
    var limit = 0.9 * (typ === 'most' ? OBROT_MOST : OBROT_MAX), a = stanUjecia(krokA.ujecie, 1), s = krokB.strefa || krokA.strefa || null;
    var kandydaci = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5].map(function (x) { return x * domyslny; });
    for (var c = 0; c < kandydaci.length; c++) {
      var czas = kandydaci[c], dt = 1 / 120, prev = null, ok = true;
      for (var t = 0; t <= czas + 1e-9 && ok; t += dt) {
        var p = _mieszajPoze(a, stanUjecia(krokB.ujecie, postepUjecia(t, krokB.ujecie.czas)), wygladz(t / czas), s), k = _kierunek(p);
        if (prev && _katMiedzy(prev, k) / dt > limit) ok = false;
        prev = k;
      }
      if (ok) return czas;
    }
    return kandydaci[kandydaci.length - 1];
  }
  function osCzasuFilmu(def, opcje) {
    var dl = (opcje && opcje.dlugosc) || 'pelna', K = def.kroki, out = [], t = 0;
    var P = K.map(function (k, i) {
      var p = przejscieKroku(i ? K[i - 1] : null, k), jawny = k.przejscie && typeof k.przejscie === 'object' && k.przejscie.czas != null;
      if (CIAGLE[p.typ] && !jawny) p.czas = czasPrzejsciaCiaglego(K[i - 1], k, p.typ, p.czas);
      return p;
    });
    for (var i = 0; i < K.length; i++) {
      var start = t, c = P[i].czas, ws = start + c / 2;
      var zd = wersyFilmu(K[i], dl), h = harmonogramNapisow(zd.map(function (w) { return w.tekst; }));
      var wersy = h.map(function (w, j) { return { tekst: zd[j].tekst, ramka: zd[j].ramka, start: ws + w.start, koniec: ws + w.koniec }; });
      var tekstKoniec = wersy.length ? wersy[wersy.length - 1].koniec : ws;
      var ruchStart = start - (CIAGLE[P[i].typ] ? c / 2 : 0);
      var nast = P[i + 1], lead = nast && CIAGLE[nast.typ] ? nast.czas / 2 : 0, uj = K[i].ujecie;
      var koniec = Math.max(tekstKoniec + KINO.ODDECH_PO_NAPISACH, ruchStart + uj.czas + lead);
      var ruchCzas = Math.min(Math.max(koniec - lead - ruchStart, uj.czas), KINO.ROZCIAGNIECIE_MAX * uj.czas);
      out.push({ krok: i + 1, start: start, koniec: koniec, przejscie: P[i], wersy: wersy, ruch: { start: ruchStart, czas: ruchCzas } });
      t = koniec;
    }
    return { dlugosc: dl, kroki: out, calosc: t };
  }
  // Chwila t filmu → krok wg zawartości (i, 0-based), czas w kroku i przejście w toku ({do, f ∈ [0,1), typ}).
  function lokalizujFilm(os, t) {
    var K = os.kroki, i = 0;
    while (i < K.length - 1 && t >= K[i + 1].start) i++;
    var prz = null;
    for (var j = i; j <= i + 1 && j < K.length; j++) {
      var c = K[j].przejscie.czas, a = K[j].start - c / 2;
      if (c > 0 && t >= a && t < a + c) prz = { do: j, f: (t - a) / c, typ: K[j].przejscie.typ };
    }
    return { i: i, krok: i + 1, tKrok: t - K[i].start, przejscie: prz, wers: indeksNapisu(K[i].wersy, t) };
  }
  // Stan obrazu w fazie przejścia f (0 = początek, 0,5 = zmiana zawartości, 1 = koniec): czerń, udział nowej
  // zawartości, widoczność zawartości (most zostawia same gwiazdy) i smuga przelotu — wszystko w [0,1].
  function stanPrzejscia(typ, f) {
    f = f < 0 ? 0 : (f > 1 ? 1 : f);
    var szczyt = wygladz(1 - Math.abs(2 * f - 1));
    var o = { czern: 0, miks: f < 0.5 ? 0 : 1, zawartosc: 1, warp: 0, szczyt: szczyt };
    if (typ === 'czern') o.czern = szczyt;
    else if (typ === 'przenikanie') o.miks = wygladz(f);
    else if (typ === 'most') o.zawartosc = f < 0.35 ? 1 - wygladz(f / 0.35) : (f > 0.65 ? wygladz((f - 0.65) / 0.35) : 0);
    else if (typ === 'przelot') { o.warp = szczyt; o.zawartosc = 1 - 0.6 * szczyt; }
    return o;
  }
  // Obraz klatki bez przejścia: jedna scena kroku i, etykiety w pełni.
  function obrazJednej(i, czern) { return { sceny: [{ i: i, gwiazdy: false }], miks: 1, warp: 0, czern: czern || 0, etykiety: 1 }; }
  // Co rysuje klatka przejścia z kroku iA do iB w fazie f. `sceny` w kolejności renderu — krok zawartości (iA przed
  // zmianą, iB po) ZAWSZE ostatni (po renderze w scenie zostaje on: etykiety DOM liczą się z jego obiektów); `miks` =
  // udział ostatniej sceny w obrazie; `gwiazdy` = sam zestaw gwiazdy. Przenikanie = oba kroki naraz; most = krok gaśnie
  // do samych gwiazd i nowy się z nich wyłania; przelot = smuga `warp`. `etykiety` = krycie etykiet DOM (gasną ku
  // zmianie zawartości i wracają). Bez passu obrazu (słaby sprzęt) jedna scena: przenikanie → przygaszenie do 0,6,
  // most i przelot → czerń (spec §3 p. 6).
  function obrazPrzejscia(typ, f, iA, iB, zPassem) {
    var s = stanPrzejscia(typ, f), biez = f < 0.5 ? iA : iB, inny = biez === iA ? iB : iA;
    var o = obrazJednej(biez, s.czern);
    o.etykiety = 1 - s.szczyt;
    if (!zPassem) {
      if (typ === 'przenikanie') o.czern = 0.6 * s.szczyt;
      else if (typ === 'most') o.czern = 1 - s.zawartosc;
      else if (typ === 'przelot') o.czern = s.szczyt;
      return o;
    }
    if (typ === 'przenikanie' && s.miks > 0 && s.miks < 1) {
      o.sceny = [{ i: inny, gwiazdy: false }, { i: biez, gwiazdy: false }];
      o.miks = biez === iB ? s.miks : 1 - s.miks;
    } else if (typ === 'most' && s.zawartosc < 1) {
      o.sceny = [{ i: biez, gwiazdy: true }, { i: biez, gwiazdy: false }];
      o.miks = s.zawartosc;
    } else o.warp = s.warp;
    return o;
  }
  /* ---------- ciągłość wielkości wspólnych dla kroków (glob, pierścień, słońce) ----------
     Pokazana = cel + przesunięcie. Skok celu (zmiana kroku: inna faza, prędkość, kierunek) przenosi różnicę do
     przesunięcia, które wygasa z czasem TAU — bez przeskoku obrazu; płynny ruch celu jest śledzony dokładnie (bez
     opóźnienia). dt = 0 (pauza, smoke, pierwsza scena przenikania) nie zmienia stanu: obie sceny przenikania widzą
     ten sam glob i to samo słońce. Pierwszy cel — bez przesunięcia. Próg skoku rośnie z dt (rzadkie klatki). */
  var TAU_CIAGLOSCI = 1.0, POKOLENIE = 0;
  // Przewinięcie filmu (skok w czasie) to nie zmiana kroku: następny odczyt każdego stanu ustawia się od razu na cel.
  function resetCiaglosci() { POKOLENIE++; }
  function _zawin(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function ciaglyKat(stan, cel, dt) {
    if (stan.pokazany == null || stan.pokolenie !== POKOLENIE) { stan.pokolenie = POKOLENIE; stan.cel = cel; stan.przes = 0; stan.pokazany = cel; return cel; }
    if (!(dt > 0)) return stan.pokazany;
    if (Math.abs(_zawin(cel - stan.cel)) > Math.max(0.15, dt)) stan.przes = _zawin(stan.pokazany - cel);
    stan.przes *= Math.exp(-dt / TAU_CIAGLOSCI);
    stan.cel = cel; stan.pokazany = cel + stan.przes;
    return stan.pokazany;
  }
  function _norm(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function _obroc(v, os, k) {                 // Rodrigues: v obrócony o k wokół jednostkowej osi
    var c = Math.cos(k), s = Math.sin(k), d = (os[0] * v[0] + os[1] * v[1] + os[2] * v[2]) * (1 - c);
    return [v[0] * c + (os[1] * v[2] - os[2] * v[1]) * s + os[0] * d,
            v[1] * c + (os[2] * v[0] - os[0] * v[2]) * s + os[1] * d,
            v[2] * c + (os[0] * v[1] - os[1] * v[0]) * s + os[2] * d];
  }
  function ciaglyKierunek(stan, cel, dt) {
    cel = _norm(cel);
    if (!stan.pokazany || stan.pokolenie !== POKOLENIE) { stan.pokolenie = POKOLENIE; stan.cel = cel; stan.kat = 0; stan.os = [0, 1, 0]; stan.pokazany = cel; return cel.slice(); }
    if (!(dt > 0)) return stan.pokazany.slice();
    var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
    if (Math.acos(Math.max(-1, Math.min(1, dot(cel, stan.cel)))) > Math.max(0.1, dt)) {
      var p = stan.pokazany, x = [cel[1] * p[2] - cel[2] * p[1], cel[2] * p[0] - cel[0] * p[2], cel[0] * p[1] - cel[1] * p[0]];
      var xl = Math.sqrt(dot(x, x));
      stan.kat = Math.acos(Math.max(-1, Math.min(1, dot(cel, p))));
      stan.os = xl > 1e-9 ? [x[0] / xl, x[1] / xl, x[2] / xl] : _norm(Math.abs(cel[1]) < 0.9 ? [cel[2], 0, -cel[0]] : [0, -cel[2], cel[1]]);
    }
    stan.kat *= Math.exp(-dt / TAU_CIAGLOSCI);
    stan.cel = cel; stan.pokazany = _norm(_obroc(cel, stan.os, stan.kat));
    return stan.pokazany.slice();
  }

  // Hak podglądu przejść (smoke): kopia definicji z jednym typem przejścia w każdym kroku poza pierwszym.
  function zPrzejsciami(def, typ) {
    return Object.assign({}, def, { kroki: def.kroki.map(function (k, i) { return i ? Object.assign({}, k, { przejscie: typ }) : k; }) });
  }
  // Interpolacja pozycji wokół środka `s` (np. Ziemi): kierunek po łuku wielkiego koła, promień logarytmicznie —
  // tor nie przechodzi przez kulę, w którą liniowe `mieszaj3` potrafi wejść. Bez `s` = liniowo.
  function mieszajWokol(a, b, e, s) {
    if (!s) return mieszaj3(a, b, e);
    if (!(e > 0)) return a.slice();
    if (e >= 1) return b.slice();
    var A = [a[0] - s[0], a[1] - s[1], a[2] - s[2]], B = [b[0] - s[0], b[1] - s[1], b[2] - s[2]];
    var rA = Math.sqrt(A[0] * A[0] + A[1] * A[1] + A[2] * A[2]), rB = Math.sqrt(B[0] * B[0] + B[1] * B[1] + B[2] * B[2]);
    if (rA < 1e-9 || rB < 1e-9) return mieszaj3(a, b, e);
    var uA = [A[0] / rA, A[1] / rA, A[2] / rA], uB = [B[0] / rB, B[1] / rB, B[2] / rB];
    var cos = Math.max(-1, Math.min(1, uA[0] * uB[0] + uA[1] * uB[1] + uA[2] * uB[2])), om = Math.acos(cos), d;
    if (om < 1e-6) d = uA;
    else if (Math.PI - om < 1e-6) {                    // antypody: obejście po dowolnym okręgu prostopadłym
      var n = Math.abs(uA[1]) < 0.9 ? [uA[2], 0, -uA[0]] : [0, -uA[2], uA[1]], nl = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
      n = [n[0] / nl, n[1] / nl, n[2] / nl];
      var ca = Math.cos(Math.PI * e), sa = Math.sin(Math.PI * e);
      d = [uA[0] * ca + n[0] * sa, uA[1] * ca + n[1] * sa, uA[2] * ca + n[2] * sa];
    } else {
      var so = Math.sin(om), wa = Math.sin((1 - e) * om) / so, wb = Math.sin(e * om) / so;
      d = [uA[0] * wa + uB[0] * wb, uA[1] * wa + uB[1] * wb, uA[2] * wa + uB[2] * wb];
    }
    var r = rA * Math.pow(rB / rA, e);
    return [s[0] + d[0] * r, s[1] + d[1] * r, s[2] + d[2] * r];
  }
  // Poza kamery w chwili t filmu — deterministyczna (przewijanie, testy). Ruch kroku z jego ujęcia; przy przejściu
  // ciągłym przez czas przejścia schodzi z pozy końcowej poprzedniego ujęcia (pozycja wokół strefy kroku).
  function pozaFilmu(def, os, t) {
    var K = os.kroki, j = 0;
    for (var i = 0; i < K.length; i++) if (K[i].ruch.start <= t) j = i;
    var kr = K[j], p = stanUjecia(def.kroki[j].ujecie, postepUjecia(t - kr.ruch.start, kr.ruch.czas)), P = kr.przejscie;
    if (j > 0 && CIAGLE[P.typ] && P.czas > 0 && t < kr.ruch.start + P.czas) {
      p = _mieszajPoze(stanUjecia(def.kroki[j - 1].ujecie, 1), p, wygladz((t - kr.ruch.start) / P.czas),
        def.kroki[j].strefa || def.kroki[j - 1].strefa || null);
    }
    return p;
  }

  // Znaczniki rozdziałów na pasku filmu: początek każdego ciągu kroków o tym samym `czesc`.
  function rozdzialyFilmu(def, os) {
    var out = [];
    os.kroki.forEach(function (k, i) {
      var c = def.kroki[i].czesc;
      if (i === 0 || c !== def.kroki[i - 1].czesc) out.push({ czesc: c, krok: i + 1, start: k.start, ulamek: os.calosc > 0 ? k.start / os.calosc : 0 });
    });
    return out;
  }
  // Dokąd przewinąć film dla akcji nawigacji. Cel = chwila, w której zawartość kroku jest już w pełni widoczna
  // (koniec przejścia), więc przewinięcie nie ląduje w czerni. ← w pierwszych 2 s kroku cofa do poprzedniego.
  function celPrzewiniecia(os, t, akcja) {
    var K = os.kroki, n = K.length, i = lokalizujFilm(os, t).i, cel;
    var widoczny = function (j) { return K[j].start + K[j].przejscie.czas / 2; };
    if (akcja === 'dalej') cel = i + 1;
    else if (akcja === 'wstecz') cel = (t - widoczny(i) > 2) ? i : i - 1;
    else if (akcja === 'pierwszy') cel = 0;
    else if (akcja === 'ostatni') cel = n - 1;
    else if (akcja && typeof akcja === 'object' && 'idz' in akcja) cel = Math.floor(Number(akcja.idz)) - 1;
    else cel = i;
    cel = Math.max(0, Math.min(n - 1, isFinite(cel) ? cel : i));
    return widoczny(cel);
  }

  // Domyślne pola kroków: `def.domyslne` (np. { zestawy: [...], strefa: [...] }) trafia do każdego kroku, który
  // tego pola nie ma. Pole obecne w kroku wygrywa, także `null` (krok jawnie bez strefy). Tablice kopiowane, żeby
  // kroki nie dzieliły jednego obiektu. Plik zjawiska woła to na własnej definicji — widok i testy widzą to samo.
  function uzupelnijKroki(def) {
    var d = def && def.domyslne;
    if (!d || !Array.isArray(def.kroki)) return def;
    def.kroki = def.kroki.map(function (k) {
      var o = {};
      for (var pole in d) if (!(pole in k)) o[pole] = Array.isArray(d[pole]) ? d[pole].slice() : d[pole];
      for (var w in k) o[w] = k[w];
      return o;
    });
    return def;
  }
  function sprawdzZjawisko(def) {
    var u = [];
    if (!def || typeof def !== 'object') return ['brak definicji'];
    if (!def.id || !ID_RE.test(def.id)) u.push('złe id');
    if (!def.tytul) u.push('brak tytul');
    if (!Array.isArray(def.kroki) || !def.kroki.length) { u.push('brak kroków'); return u; }
    def.kroki.forEach(function (k, i) {
      var p = 'krok ' + (i + 1) + ': ';
      if (!k.tytul) u.push(p + 'brak tytul');
      if (!Array.isArray(k.narracja) || !k.narracja.length) u.push(p + 'brak narracji');
      else { var z = liczZdania(k.narracja); if (z < 3 || z > 7) u.push(p + 'narracja ma ' + z + ' zdań (ma być 3–7)'); }
      if (!k.podpis) u.push(p + 'brak podpis');
      var uj = k.ujecie;
      if (!uj || typeof uj !== 'object') { u.push(p + 'brak ujęcia kamery'); return; }
      if (!Array.isArray(uj.tor) || !uj.tor.length || !uj.tor.every(_trojka)) u.push(p + 'zły tor ujęcia (lista trójek)');
      if (!(_trojka(uj.cel) || (Array.isArray(uj.cel) && uj.cel.length && uj.cel.every(_trojka)))) u.push(p + 'zły cel ujęcia (trójka albo lista trójek)');
      var fv = [].concat(uj.fov);
      if (!fv.length || fv.length > 2 || !fv.every(function (f) { return typeof f === 'number' && f >= 5 && f <= KINO.FOV_MAX; })) u.push(p + 'zły FOV ujęcia');
      if (!(uj.czas > 0)) u.push(p + 'zły czas ujęcia');
      if (k.przejscie != null) {
        var tp = typeof k.przejscie === 'object' ? k.przejscie.typ : k.przejscie;
        if (TYPY_PRZEJSC.indexOf(tp) < 0) u.push(p + 'przejście „' + tp + '” spoza zbioru (' + TYPY_PRZEJSC.join(', ') + ')');
      }
    });
    return u;
  }

  var api = {
    parsujHash: parsujHash, parsujZapytanie: parsujZapytanie, budujHash: budujHash,
    ograniczKrok: ograniczKrok, przejscie: przejscie, akcjaKlawisza: akcjaKlawisza,
    uzupelnijKroki: uzupelnijKroki, TYPY_PRZEJSC: TYPY_PRZEJSC, przejscieKroku: przejscieKroku, wersyFilmu: wersyFilmu,
    ciaglyKat: ciaglyKat, ciaglyKierunek: ciaglyKierunek, resetCiaglosci: resetCiaglosci, obrazJednej: obrazJednej, obrazPrzejscia: obrazPrzejscia, zPrzejsciami: zPrzejsciami, rozdzialyFilmu: rozdzialyFilmu, celPrzewiniecia: celPrzewiniecia, OBROT_MAX: OBROT_MAX, OBROT_MOST: OBROT_MOST, osCzasuFilmu: osCzasuFilmu, lokalizujFilm: lokalizujFilm, stanPrzejscia: stanPrzejscia, mieszajWokol: mieszajWokol, pozaFilmu: pozaFilmu,
    wygladz: wygladz, mieszaj3: mieszaj3, tempoRuchu: tempoRuchu, petla: petla, odcinek: odcinek,
    RYC4: RYC4, strefaPierscienia: strefaPierscienia, pozycjaNaOsi: pozycjaNaOsi, przemiatanie: przemiatanie,
    skretOdbitej: skretOdbitej, amplitudaUmowna: amplitudaUmowna,
    RYC5: RYC5, ulamekObrotu: ulamekObrotu, dlugosciSlupkow: dlugosciSlupkow, ileRazy: ileRazy,
    liczZdania: liczZdania, sprawdzZjawisko: sprawdzZjawisko,
    KINO: KINO, kadrKinowy: kadrKinowy, fovDlaProporcji: fovDlaProporcji, katmull: katmull, fovDollyZoom: fovDollyZoom,
    stanUjecia: stanUjecia, postepUjecia: postepUjecia, oddech: oddech, czyCiecie: czyCiecie,
    podzielNaZdania: podzielNaZdania, czasCzytania: czasCzytania, harmonogramNapisow: harmonogramNapisow,
    indeksNapisu: indeksNapisu, czasKroku: czasKroku, czestotliwoscDronu: czestotliwoscDronu, rozsunEtykiety: rozsunEtykiety
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZjawiskaLogika = api;
})(typeof self !== 'undefined' ? self : this);
