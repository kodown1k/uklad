'use strict';
/* Wspólny kadr kinowy zakładek: kadr 2.39:1, harmonogram napisów, układ napisów, dzielenie na zdania,
   warstwa napisów (DOM) i „cisza” interfejsu. Port z mysliwce/kino.js (kadrKinowy, harmonogram, napisy) — te same
   sygnatury i zachowanie; dodane: wersWChwili, ukladNapisow, podzielNapis, cisza, opcja `prefiks` w napisy.
   Globalna nazwa: KinoKadr (window.Kino jest zajęte przez kino.js i mysliwce/kino.js).
   Plik dual-export: w node (testy) CommonJS, w przeglądarce root.KinoKadr.
     kadrKinowy(w, h, proporcja=2.39) → { x, y, w, h, pasGora, pasDol, tryb: 'pasy'|'pelny' }
     harmonogram(wersy, { start=0, tempo=15, min=2.2, przerwa=0.35 }) → [{ id, start, koniec }]
     wersWChwili(plan, t) → { indeks, id, wTrakcie } — między wersami: następny (wTrakcie=false); przed pierwszym:
       indeks 0; po ostatnim: indeks = plan.length, id = null.
     ukladNapisow(kadr, w, h) → { tryb: 'pas'|'w-kadrze', rozmiar_px, maksZnakowWLinii, dol_px, podklad } (spec R1)
     podzielNapis(tekst, czas_s, maks=84) → [{ tekst, od, do }]
     napisy(kontener, { prefiks='my-kino' }) → { pokaz, tytul, kadr(kadrKinowy, w?, h?), zwolnij }
     cisza(kontener, { poMs=3000, klasa='kino-cisza' }) → { obudz, wstrzymaj(bool), zwolnij } */
(function (root) {
  var PROPORCJA = 2.39;

  function przytnij(x, a, b) { return x < a ? a : x > b ? b : x; }

  /* ---------- kadr ---------- */
  function kadrKinowy(w, h, proporcja) {
    var p = proporcja > 0 ? proporcja : PROPORCJA;
    w = Math.max(0, Math.floor(w) || 0); h = Math.max(0, Math.floor(h) || 0);
    // pion telefonu i okna bliskie kwadratu (w/h < 1,5) — pełny kadr; pasy zjadałyby 44–58% wysokości
    if (h > w || !(w >= 1.5 * h)) return { x: 0, y: 0, w: w, h: h, pasGora: 0, pasDol: 0, tryb: 'pelny' };
    if (h > 0 && w / h >= p) {
      var kw = Math.min(w, Math.round(h * p));
      return { x: Math.floor((w - kw) / 2), y: 0, w: kw, h: h, pasGora: 0, pasDol: 0, tryb: 'pasy' };
    }
    var pas = Math.max(0, Math.round((h - w / p) / 2));
    if (pas < 0.01 * h) pas = 0;                                      // pas węższy niż 1% wysokości — bez pasów
    return { x: 0, y: pas, w: w, h: h - 2 * pas, pasGora: pas, pasDol: pas, tryb: 'pasy' };
  }

  /* ---------- harmonogram ---------- */
  function harmonogram(wersy, o) {
    o = o || {};
    var t = +o.start || 0, tempo = o.tempo > 0 ? o.tempo : 15, min = o.min != null ? +o.min : 2.2, przerwa = o.przerwa != null ? +o.przerwa : 0.35;
    return (wersy || []).map(function (w, i) {
      var tekst = typeof w === 'string' ? w : String((w && w.tekst) || '');
      var dur = w && w.czas > 0 ? +w.czas : Math.max(min, tekst.length / tempo);
      var h = { id: w && w.id != null ? w.id : i, start: t, koniec: t + dur };
      t = h.koniec + przerwa;
      return h;
    });
  }

  function wersWChwili(plan, t) {
    plan = plan || [];
    for (var i = 0; i < plan.length; i++) {
      if (t < plan[i].start) return { indeks: i, id: plan[i].id, wTrakcie: false };     // przed wersem / w przerwie przed nim
      if (t <= plan[i].koniec) return { indeks: i, id: plan[i].id, wTrakcie: true };
    }
    return { indeks: plan.length, id: null, wTrakcie: false };                            // po ostatnim
  }

  /* ---------- układ napisów (spec R1) ---------- */
  function ukladNapisow(kadr, w, h) {
    var rozmiar = Math.round(przytnij(Math.min(0.024 * kadr.h, 0.052 * kadr.w), 15, 36));
    var pion = h > w;
    var tryb = kadr.pasDol >= 2 * 1.45 * rozmiar + 16 ? 'pas' : 'w-kadrze';
    // średnia szerokość znaku ≈ 0,5 em, pole napisu = kadr bez marginesów 4% po bokach; w linii najwyżej 72 znaki
    var maks = Math.min(72, Math.max(1, Math.floor(0.92 * kadr.w / (0.5 * rozmiar))));
    var dol = tryb === 'pas'
      ? Math.max(0, Math.round((kadr.pasDol - 1.45 * rozmiar) / 2))                       // linia pośrodku pasa
      : Math.round(kadr.pasDol + (pion ? 0.09 : 0.06) * kadr.h);                           // 6% (pion 9%) nad dołem kadru
    return { tryb: tryb, rozmiar_px: rozmiar, maksZnakowWLinii: maks, dol_px: dol, podklad: tryb === 'w-kadrze' };
  }

  /* ---------- jedno zdanie naraz ---------- */
  // Skróty, po których kropka NIE kończy zdania (małe litery, bez końcowej kropki).
  var SKROTY = { ok: 1, r: 1, tys: 1, mln: 1, mld: 1, np: 1, tzw: 1, ul: 1, 'św': 1, w: 1, m: 1, km: 1, 'n.p.m': 1, 'p.p.m': 1 };
  // Granica zdania: [.!?…] (+ zamykający cudzysłów/nawias), spacja, wielka litera lub otwierający cudzysłów (bez cyfr —
  // „ok. 3715”, „1909 r. Wulkan”). Bez lookbehind (Safari < 16.4 nie parsuje pliku z lookbehind).
  function zdania_(tekst) {
    var re = /([.!?…]["”»)]*)\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ„"«(])/g, wynik = [], od = 0, m;
    while ((m = re.exec(tekst))) {
      if (m[1].charAt(0) === '.') {
        var slowo = /[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ.]*$/.exec(tekst.slice(od, m.index))[0].toLowerCase();
        if (SKROTY[slowo]) continue;
      }
      wynik.push(tekst.slice(od, m.index + m[1].length).trim());
      od = m.index + m[0].length;
    }
    wynik.push(tekst.slice(od).trim());
    return wynik.filter(Boolean);
  }
  function podzielNapis(tekst, czas, maks) {
    tekst = String(tekst == null ? '' : tekst).trim(); czas = +czas || 0; maks = maks > 0 ? maks : 84;
    var zdania = tekst.length > maks ? zdania_(tekst) : [tekst];
    if (zdania.length < 2) return [{ tekst: tekst, od: 0, do: czas }];
    var suma = zdania.reduce(function (a, s) { return a + s.length; }, 0), znaki = 0;
    return zdania.map(function (s, i) {
      var od = czas * znaki / suma; znaki += s.length;
      return { tekst: s, od: od, do: i === zdania.length - 1 ? czas : czas * znaki / suma };
    });
  }

  /* ---------- napisy (DOM, tylko textContent) ---------- */
  function napisy(kontener, opcje) {
    var pre = (opcje && opcje.prefiks) || 'my-kino';
    var doc = kontener.ownerDocument || root.document;
    function el(tag, klasa, rodzic) { var e = doc.createElement(tag); e.className = klasa; rodzic.appendChild(e); return e; }
    var warstwa = el('div', pre, kontener);
    var tytul = el('div', pre + '-tytul', warstwa), tytulTekst = el('h2', pre + '-tytul-tekst', tytul);
    var wers = el('div', pre + '-wers', warstwa), wersTekst = el('p', pre + '-wers-tekst', wers);
    wers.setAttribute('aria-live', 'polite');
    tytul.hidden = true; wers.hidden = true;
    return {
      pokaz: function (w) {
        var t = w == null ? '' : typeof w === 'string' ? w : String(w.tekst || '');
        wersTekst.textContent = t; wers.hidden = !t;
      },
      tytul: function (t) { t = t == null ? '' : String(t); tytulTekst.textContent = t; tytul.hidden = !t; },
      // geometria kadru → zmienne CSS; w, h = rozmiar kontenera (domyślnie z kadru + pasów)
      kadr: function (k, w, h) {
        if (!k || !kontener.style || !kontener.style.setProperty) return;
        var s = kontener.style, set = function (n, v) { s.setProperty('--' + pre + '-' + n, v); };
        set('y', k.y + 'px'); set('h', k.h + 'px'); set('pas-dol', k.pasDol + 'px');
        var cw = w > 0 ? w : k.x * 2 + k.w, ch = h > 0 ? h : k.y + k.h + k.pasDol;
        var u = ukladNapisow(k, cw, ch), pion = ch > cw;
        set('rozmiar', u.rozmiar_px + 'px'); set('dol', u.dol_px + 'px'); set('maks-znakow', String(u.maksZnakowWLinii));
        set('podklad-h', (u.podklad ? Math.round(k.h * (pion ? 0.30 : 0.24)) : 0) + 'px');   // wysokość gradientu podkładu
        set('safe', pion && u.tryb === 'w-kadrze' ? '1' : '0');                              // 1 → CSS dodaje env(safe-area-inset-bottom)
        s.setProperty('--' + pre + '-tryb', u.tryb);
      },
      zwolnij: function () { if (warstwa.parentNode) warstwa.parentNode.removeChild(warstwa); },
    };
  }

  /* ---------- cisza: interfejs i kursor znikają po bezruchu ---------- */
  var ZDARZENIA = ['pointermove', 'pointerdown', 'touchstart', 'wheel'];
  function cisza(kontener, o) {
    o = o || {};
    var poMs = o.poMs > 0 ? o.poMs : 3000, klasa = o.klasa || 'kino-cisza';
    var dok = kontener.ownerDocument || root.document, zegar = 0, wstrzymana = false, zwolniona = false;
    function stop() { if (zegar) { clearTimeout(zegar); zegar = 0; } }
    function obudz() {
      if (zwolniona) return;
      kontener.classList.remove(klasa); stop();
      if (wstrzymana) return;
      zegar = setTimeout(function () { zegar = 0; kontener.classList.add(klasa); }, poMs);
    }
    ZDARZENIA.forEach(function (n) { kontener.addEventListener(n, obudz, { passive: true }); });
    if (dok && dok.addEventListener) dok.addEventListener('keydown', obudz);
    obudz();
    return {
      obudz: obudz,
      wstrzymaj: function (b) { if (zwolniona) return; wstrzymana = !!b; obudz(); },       // pauza / karta końcowa: interfejs widoczny, zegar stoi
      zwolnij: function () {
        zwolniona = true; stop(); kontener.classList.remove(klasa);
        ZDARZENIA.forEach(function (n) { kontener.removeEventListener(n, obudz); });
        if (dok && dok.removeEventListener) dok.removeEventListener('keydown', obudz);
      },
    };
  }

  var api = {
    PROPORCJA: PROPORCJA,
    kadrKinowy: kadrKinowy, harmonogram: harmonogram, wersWChwili: wersWChwili, ukladNapisow: ukladNapisow,
    podzielNapis: podzielNapis, napisy: napisy, cisza: cisza,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KinoKadr = api;
})(typeof window !== 'undefined' ? window : globalThis);
