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
      return { zjawisko: p.zjawisko, krok: _krok(p.krok) };
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
    return { zjawisko: p.zjawisko, krok: _krok(p.krok), smoke: ('smoke' in p) };
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
    CZERN: 0.5                // połowa cięcia przez czerń [s]
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
    });
    return u;
  }

  var api = {
    parsujHash: parsujHash, parsujZapytanie: parsujZapytanie, budujHash: budujHash,
    ograniczKrok: ograniczKrok, przejscie: przejscie, akcjaKlawisza: akcjaKlawisza,
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
