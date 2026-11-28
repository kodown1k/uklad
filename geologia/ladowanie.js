'use strict';
/* Zakładka Geologia — wejście w moduł: rejestracja w zakladki.js i leniwe dociąganie reszty plików przy pierwszym
   otwarciu (anty-cel: moduł nie spowalnia startu Układu). Jedyny plik modułu ładowany ze strony (za kino.js i
   mysliwce/ladowanie.js). Czysta część (dual-export, testy w node): ROZDZIALY, PLIKI, parsujHashGeologii,
   parsujZapytanieGeologii.

   Adresy:  #geologia | #geologia=<miejsce>[&rozdzial=<id>][&tryb=pokaz|makieta[&warstwa=<lista>]] → {miejsce, tryb, rozdzial[, warstwa]}
            (+ `&zaproszenie=<expires>.<md5>` i `&lektor=<baza>|lokalny` w każdym trybie → pola `zaproszenie`, `lektor` — Task 9,
            ruling 9-2: link-zaproszenie do lektora; strona zapamiętuje je w localStorage do wygaśnięcia i wycina z paska adresu)
            (domyślnie pokaz, rozdział `polozenie`; makieta = bez rozdziału; `warstwa` tylko w makiecie: lista po przecinku
            z WARSTWY — `turystyka`, `wulkany`, `turystyka,wulkany`; nieznane pozycje odrzucane, kolejność jak WARSTWY, bez powtórzeń;
            pusta po odrzuceniu → bez pola; Task 8e: `&pora=teraz|HH:MM` (00:00–23:59, czas wyspy) i `&pogoda=pogodnie|chmury|kalima`
            tylko w makiecie → pola `pora`, `pogoda`; inne wartości odrzucane — bez pola);
            #geologia=<nieznane> → miejsce domyślne + pole `nieznane`. Obcy hash → null.
   Zapytanie: ?geologia = przycisk zakładki widoczny (do czasu gotowości jest ukryty); hak testowy
            ?smoke&geologia=<miejsce>[&rozdzial=<id>|&makieta|&tryb=makieta][&t=0..1][&czas=<Ma>][&przekroj=<°>[&przesuniecie=<km>]][&geologiczna]
            [&jakosc=pelna][&kontrola=biel|czern][&anim=a1..a5&f=0..1][&warstwa=<lista>][&widok=poludnie|polnoc|gora]
            [&pora=teraz|HH:MM][&pogoda=pogodnie|chmury|kalima][&data=RRRR-MM-DD]
            (marker GEOLOGIA_READY <miejsce> <rozdzial|makieta>). `&makieta` = `&tryb=makieta`;
            `&warstwa=turystyka` = warstwa turystyczna makiety (Task 7b), `&warstwa=wulkany` = warstwa wulkanów (Task 8c),
            obie naraz `&warstwa=turystyka,wulkany`; `&widok` = kadr z przycisków kompasu;
            `&czas` = chwila geologiczna [mln lat] w makiecie; `&anim` + `&f` = animacja A1–A5 w kadrze ujęcia (f przycięte do 0..1, bez f → 1);
            `&przesuniecie` = linia przekroju przesunięta o km od Teide;
            `&geologiczna` = makieta w barwach jednostek; `&jakosc=pelna` = bez przejścia na lżejszą jakość przy niskim fps (G-L).
            `&lektor=lokalny` (tylko na localhost) = nagrania lektora z repo (geologia/<miejsce>/lektor/) bez tokenu — smoke i sonda.
            Hash i hak działają też bez ?geologia.
   Lektor (ruling 9-1, 9-2): nagrania (klon głosu) nigdy nie są publiczne. zrodloLektora({ miejsce, zaproszenie, lektor, host,
            teraz_s }) → { baza, zapytanie, powod } — baza katalogu nagrań i zapytanie z tokenem nginx secure_link
            (`?md5=<md5>&expires=<expires>`, jeden token na cały katalog); bez tokenu / po wygaśnięciu baza = null i powod
            'zaproszenie' / 'wygaslo' (pokaz: „Odtwórz” + „lektor na zaproszenie”, podkład gra). Domyślna baza zaproszenia
            BAZA_LEKTORA + <miejsce>/ (względem strony: kodownik.co/uklad/lektor/teneryfa/ — katalog poza webrootem, Task 9b);
            tylko na hoście kodownik.co (na innych: baza null, powod 'host', zero żądań z tokenem; localhost — tylko hak
            `&lektor=lokalny`); `&lektor=<https://kodownik.co/…/>` podmienia bazę (tylko https i dokładnie kodownik.co).
   Krzywe (ruling G-C): mysliwce/kino.js nadpisuje window.Kino — dlatego krzywe filmów Układu zapamiętujemy raz,
   przy wczytaniu tego pliku (jest za korzeniowym kino.js), i nigdy więcej nie czytamy window.Kino. */
(function (root) {
  var MIEJSCA_ID = ['teneryfa'];               // ta sama lista co GeologiaMiejsca.MIEJSCA (test pilnuje)
  var TRYBY = ['pokaz', 'makieta'];
  var ROZDZIALY = [
    { id: 'polozenie', etykieta: 'Położenie' }, { id: 'geografia', etykieta: 'Geografia' },
    { id: 'budowa', etykieta: 'Budowa' }, { id: 'powstanie', etykieta: 'Powstanie' },
    { id: 'historia', etykieta: 'Historia' }, { id: 'przekroj', etykieta: 'Przekrój' },
    { id: 'czesci', etykieta: 'Części' }, { id: 'mity', etykieta: 'Fakty i mity' },
    { id: 'dzis', etykieta: 'Wyspa dziś' }
  ];
  // Kolejność leniwego ładowania: tylko pliki, które istnieją. Kolejne zadania dopisują swoje PRZED widok.js —
  // widok.js jest ostatni, bo korzysta z reszty. Pliki konkretnego miejsca: GeologiaMiejsca.MIEJSCA[].pliki.
  var PLIKI = ['geologia/miejsca.js', 'geologia/teren.js', 'geologia/ewolucja.js', 'geologia/fale.js', 'geologia/wiatr.js', 'geologia/sklejka.js', 'geologia/horyzont.js', 'geologia/pejzaz.js', 'geologia/scena.js', 'geologia/slonce.js', 'geologia/gwiazdy.js', 'geologia/animacje.js',
    'geologia/rozdzialy.js', 'geologia/turystyka-scena.js', 'geologia/wulkany-scena.js', 'geologia/lektor.js', 'geologia/dzwiek.js',
    'geologia/pokaz.js', 'geologia/widok.js'];
  var KONTROLE = ['biel', 'czern'];
  var ANIMACJE = ['a1', 'a2', 'a3', 'a4', 'a5'];
  var WARSTWY = ['turystyka', 'wulkany'];
  var WIDOKI = ['poludnie', 'polnoc', 'gora'];    // ta sama lista co Kompas.WIDOKI (geologia/turystyka-scena.js)
  var POGODY = ['pogodnie', 'chmury', 'kalima'];  // ta sama lista co GeologiaSlonce.POGODY (geologia/slonce.js)
  // Materiał makiety (Task B1): 'zwykly' (domyślny, w adresie go nie ma) | 'sklejka'. Przewyższenia paska (widok.js) —
  // te same co klucze GeologiaSklejka.KROKI (test/geologia-sklejka.test.js)
  var MATERIALY = ['zwykly', 'sklejka'];
  var PRZEWYZSZENIA = [1, 1.5, 3];
  // Lektor na zaproszenie (Task 9): token nginx secure_link = <expires: unix s>.<md5: base64url 22 zn.>
  var ZAPROSZENIE = /^(\d{9,11})\.([A-Za-z0-9_-]{22})$/;
  var BAZA_LEKTORA = 'lektor/';
  // Decyzja właściciela (recenzja 9a I-3): lektor TYLKO na kodownik.co — voyager.kodownik.co (GitHub Pages, cały świat) i każdy
  // inny host bez lektora, bez CORS i bez żadnego żądania z tokenem (token nie wychodzi do innej domeny).
  var HOST_LEKTORA = 'kodownik.co';
  var HOSTY_LOKALNE = ['localhost', '127.0.0.1', '[::1]', '::1'];
  function lokalny(host) { return HOSTY_LOKALNE.indexOf(host) >= 0; }
  function bazaLektora(v) {
    if (typeof v !== 'string') return null;
    if (v === 'lokalny') return v;
    var m = /^https:\/\/([a-z0-9.-]+)(\/[A-Za-z0-9._~\/-]*)?$/.exec(v);
    if (!m || m[1] !== HOST_LEKTORA) return null;
    var b = v; if (b.charAt(b.length - 1) !== '/') b += '/';
    return b;
  }
  function zrodloLektora(o) {
    o = o || {};
    var miejsce = o.miejsce || MIEJSCA_ID[0];
    if (o.lektor === 'lokalny' && lokalny(o.host)) return { baza: 'geologia/' + miejsce + '/lektor/', zapytanie: '', powod: null };
    // host bez lektora: powod 'host' — pokaz nie dopisuje „lektor na zaproszenie” (strona dla całego świata nie reklamuje
    // klonu głosu, którego tam i tak nie da się odtworzyć); localhost bez haka zachowuje się jak kodownik.co bez tokenu
    if (o.host !== HOST_LEKTORA) return { baza: null, zapytanie: '', powod: lokalny(o.host) ? 'zaproszenie' : 'host' };
    var z = typeof o.zaproszenie === 'string' ? ZAPROSZENIE.exec(o.zaproszenie) : null;
    if (!z) return { baza: null, zapytanie: '', powod: 'zaproszenie' };
    if (isFinite(o.teraz_s) && +z[1] < o.teraz_s) return { baza: null, zapytanie: '', powod: 'wygaslo' };
    var b = bazaLektora(o.lektor);
    return { baza: (b && b !== 'lokalny' ? b : BAZA_LEKTORA) + miejsce + '/', zapytanie: '?md5=' + z[2] + '&expires=' + z[1], powod: null };
  }

  function dekoduj(s) { try { return decodeURIComponent(s); } catch (_) { return s; } }
  function czyRozdzial(id) { return ROZDZIALY.some(function (r) { return r.id === id; }); }
  // Lista warstw z adresu → znormalizowany napis ('turystyka', 'wulkany', 'turystyka,wulkany') albo null.
  function warstwy(v) {
    if (typeof v !== 'string') return null;
    var dane = dekoduj(v).toLowerCase().split(',').map(function (x) { return x.trim(); });
    var znane = WARSTWY.filter(function (w) { return dane.indexOf(w) >= 0; });
    return znane.length ? znane.join(',') : null;
  }

  // Pora makiety z adresu (Task 8e): 'teraz' albo 'HH:MM' (00:00–23:59, czas wyspy; godzina jedno- lub dwucyfrowa) → napis
  // znormalizowany ('teraz' | 'HH:MM') albo null.
  function pora(v) {
    if (typeof v !== 'string') return null;
    var s = dekoduj(v).trim().toLowerCase();
    if (s === 'teraz') return s;
    var m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m || +m[1] > 23 || +m[2] > 59) return null;
    return (m[1].length < 2 ? '0' : '') + m[1] + ':' + m[2];
  }
  function pogoda(v) { var s = typeof v === 'string' ? dekoduj(v).trim().toLowerCase() : null; return POGODY.indexOf(s) >= 0 ? s : null; }
  // tylko materiał inny niż domyślny ma pole w adresie; nieznana wartość (np. odrzucony „gips”) = brak pola
  function material(v) { var s = typeof v === 'string' ? dekoduj(v).trim().toLowerCase() : null; return s === 'sklejka' ? s : undefined; }
  // smugi pasatu (Task A2): domyślnie włączone — w adresie tylko wyłączenie `&wiatr=0` (inna wartość = brak pola)
  function wiatr(v) { return typeof v === 'string' && dekoduj(v).trim() === '0' ? false : undefined; }

  function parsujHashGeologii(hash) {
    if (typeof hash !== 'string') return null;
    var s = hash.charAt(0) === '#' ? hash.slice(1) : hash;
    var reszta;
    if (s === 'geologia' || s.indexOf('geologia&') === 0) reszta = s.slice(8);
    else if (s.indexOf('geologia=') === 0) reszta = s.slice(8);
    else return null;
    var m = /^=([^&]*)/.exec(reszta);
    var id = m ? dekoduj(m[1]).trim().toLowerCase().slice(0, 40) : '';
    var wynik = { miejsce: MIEJSCA_ID[0], tryb: 'pokaz', rozdzial: 'polozenie' };
    var nieznane = id && MIEJSCA_ID.indexOf(id) < 0 ? id : null;
    if (id && !nieznane) wynik.miejsce = id;
    var t = /&tryb=([^&]*)/.exec(reszta), r = /&rozdzial=([^&]*)/.exec(reszta), w = /&warstwa=([^&]*)/.exec(reszta);
    if (t && t[1] === 'makieta') {
      wynik.tryb = 'makieta'; wynik.rozdzial = null;
      var lw = w ? warstwy(w[1]) : null;
      if (lw) wynik.warstwa = lw;
      var po = /&pora=([^&]*)/.exec(reszta), pg = /&pogoda=([^&]*)/.exec(reszta);
      if (po && pora(po[1])) wynik.pora = pora(po[1]);
      if (pg && pogoda(pg[1])) wynik.pogoda = pogoda(pg[1]);
      var ma = /&material=([^&]*)/.exec(reszta);
      if (ma && material(ma[1])) wynik.material = material(ma[1]);
      var wi = /&wiatr=([^&]*)/.exec(reszta);
      if (wi && wiatr(wi[1]) === false) wynik.wiatr = false;
    } else if (r && czyRozdzial(r[1])) wynik.rozdzial = r[1];
    if (nieznane) wynik.nieznane = nieznane;
    var zp = /&zaproszenie=([^&]*)/.exec(reszta), lk = /&lektor=([^&]*)/.exec(reszta);
    if (zp && ZAPROSZENIE.test(dekoduj(zp[1]))) wynik.zaproszenie = dekoduj(zp[1]);
    if (lk && bazaLektora(dekoduj(lk[1]))) wynik.lektor = bazaLektora(dekoduj(lk[1]));
    return wynik;
  }

  function dataSmoke(v) {
    var m = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
    if (!m) return null;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3], 12);
    return new Date(t).getUTCDate() === +m[3] ? t : null;
  }
  function parsujZapytanieGeologii(search) {
    var s = typeof search === 'string' ? search : '';
    var flaga = function (n) { return new RegExp('[?&]' + n + '(?=[&=]|$)').test(s); };
    var wart = function (n) { var m = new RegExp('[?&]' + n + '=([^&]*)').exec(s); return m ? dekoduj(m[1]).toLowerCase() : null; };
    var liczba = function (n) { var v = wart(n); if (v === null || v === '') return null; var x = Number(v); return isFinite(x) ? x : null; };
    var mi = wart('geologia'), miejsce = MIEJSCA_ID.indexOf(mi) >= 0 ? mi : null;
    var ro = wart('rozdzial'), t = liczba('t'), ko = wart('kontrola'), an = wart('anim'), f = liczba('f'), wa = wart('warstwa'), wi = wart('widok');
    var pw = liczba('przew');
    return {
      smoke: flaga('smoke'), widoczna: flaga('geologia'), miejsce: miejsce,
      tryb: miejsce ? (wart('tryb') === 'makieta' || flaga('makieta') ? 'makieta' : 'pokaz') : null,
      rozdzial: czyRozdzial(ro) ? ro : null,
      t: t === null ? 0 : Math.max(0, Math.min(1, t)),
      czas: liczba('czas'), przekroj: liczba('przekroj'), przesuniecie: liczba('przesuniecie'), geologiczna: flaga('geologiczna'),
      jakosc: wart('jakosc') === 'pelna' ? 'pelna' : null,
      kontrola: KONTROLE.indexOf(ko) >= 0 ? ko : null,
      anim: ANIMACJE.indexOf(an) >= 0 ? an : null,
      f: ANIMACJE.indexOf(an) >= 0 ? (f === null ? 1 : Math.max(0, Math.min(1, f))) : null,
      warstwa: warstwy(wa),
      widok: WIDOKI.indexOf(wi) >= 0 ? wi : null,
      pora: pora(wart('pora')), pogoda: pogoda(wart('pogoda')),
      lektor: wart('lektor') === 'lokalny' ? 'lokalny' : null,
      // Task B1: materiał (hak smoke i pomiar wydajności — oba niosą stan w zapytaniu) i hak przewyższenia (tylko wartości paska)
      material: material(wart('material')),
      przew: PRZEWYZSZENIA.indexOf(pw) >= 0 ? pw : null,
      // Task A2: wyłączenie smug pasatu (hak smoke i pomiar wydajności)
      wiatr: wiatr(wart('wiatr')),
      // Task A3 (R13): dzień pory w smoke (RRRR-MM-DD → południe UTC tego dnia [ms]); zła data → null
      data: dataSmoke(wart('data'))
    };
  }

  var api = { MIEJSCA_ID: MIEJSCA_ID, TRYBY: TRYBY, ROZDZIALY: ROZDZIALY, PLIKI: PLIKI, ANIMACJE: ANIMACJE, WARSTWY: WARSTWY, WIDOKI: WIDOKI,
    POGODY: POGODY, pora: pora, pogoda: pogoda, MATERIALY: MATERIALY, PRZEWYZSZENIA: PRZEWYZSZENIA, material: material, wiatr: wiatr,
    BAZA_LEKTORA: BAZA_LEKTORA, HOST_LEKTORA: HOST_LEKTORA, parsujHashGeologii: parsujHashGeologii, parsujZapytanieGeologii: parsujZapytanieGeologii, warstwy: warstwy,
    zrodloLektora: zrodloLektora, krzywe: null };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  api.krzywe = root.Kino || null;              // G-C: jedyny odczyt window.Kino — przy wczytaniu
  root.GeologiaLadowanie = api;

  /* ---------- przeglądarka ---------- */
  var doc = root.document, korzen = doc.getElementById('geologia'), przycisk = doc.getElementById('zakGeologia');
  var zap = parsujZapytanieGeologii(root.location.search);
  var ladowanie = null, miejscaZaladowane = {};
  // Zaproszenie do lektora (ruling 9-2): token z linku → localStorage (do `expires` z tokenu — nowa karta i zakładka mają
  // lektora; zgłoszenie 24.11: sessionStorage gubił zaproszenie poza kartą z linku), wycięty z paska adresu
  // od razu po odczycie (zrzut ekranu ani skopiowany adres go nie niosą); widok i tak przepisuje hash po otwarciu.
  var KLUCZ_ZAPROSZENIA = 'geologia-lektor';
  var pamiec = null;
  function zapamietajZaproszenie(s) {
    if (!s || (!s.zaproszenie && !s.lektor)) return;
    // nowy link nadpisuje tylko to, co niesie (sama baza nie kasuje zapamiętanego tokenu)
    // token zapamiętywany tylko na hoście lektora, hak `lokalny` tylko na localhost (recenzja 9a I-3, M-5) — poza nimi
    // tylko wycięcie z paska adresu
    var host = root.location.hostname, stare = zapamietane();
    var nowy = { zaproszenie: host === HOST_LEKTORA && s.zaproszenie ? s.zaproszenie : stare.zaproszenie || null,
      lektor: s.lektor && (s.lektor !== 'lokalny' || lokalny(host)) ? s.lektor : stare.lektor || null };
    if (nowy.zaproszenie !== (stare.zaproszenie || null) || nowy.lektor !== (stare.lektor || null)) {
      pamiec = nowy;
      try { root.localStorage.setItem(KLUCZ_ZAPROSZENIA, JSON.stringify(pamiec)); } catch (_) { /* tryb prywatny */ }
    }
    var h = root.location.hash, czysty = h.replace(/&(zaproszenie|lektor)=[^&]*/g, '');
    if (czysty !== h) { try { root.history.replaceState(null, '', root.location.pathname + root.location.search + czysty); } catch (_) { /* file:// */ } }
  }
  function zapamietane() {
    var z = pamiec;
    // wygasły token zostaje w magazynie: zrodloLektora zwraca wtedy powod 'wygaslo' (nowy link go nadpisuje)
    if (!z) { try { z = JSON.parse(root.localStorage.getItem(KLUCZ_ZAPROSZENIA) || 'null'); } catch (_) { z = null; } }
    return z || {};
  }
  function zrodloLektoraStrony(miejsce) {
    var z = zapamietane();
    return zrodloLektora({ miejsce: miejsce, zaproszenie: z.zaproszenie, lektor: zap.lektor || z.lektor, host: root.location.hostname,
      teraz_s: Date.now() / 1000 });
  }
  api.zrodloLektoraStrony = zrodloLektoraStrony;
  api.zapamietaneZaproszenie = zapamietane;   // hak sondy

  // Recenzja końcowa M-4: wycięcie tokenu JUŻ przy wykonaniu tego pliku — klasyczny skrypt bez defer, w trakcie parsowania
  // strony, więc przed skryptami odroczonymi i modułami (beacon Cloudflare Web Analytics w Solar System.html jest modułem
  // i czyta location.href) i przed DOMContentLoaded (`otworz` zostaje dla linków wklejonych później w tej samej karcie).
  zapamietajZaproszenie(parsujHashGeologii(root.location.hash));

  if (!korzen || !root.Zakladki) { console.error('Geologia: brak #geologia albo zakladki.js — zakładka nieaktywna'); return; }
  if (przycisk && zap.widoczna) przycisk.hidden = false;

  // Pasek nakładki istnieje od pierwszego `przelacz` (rejestr przenosi do niego #zakladki przed `otworz`).
  function pasek() {
    var p = doc.getElementById('gePasek');
    if (!p) {
      p = doc.createElement('header'); p.id = 'gePasek'; p.className = 'ge-pasek';
      var tyt = doc.createElement('span'); tyt.className = 'ge-tytul'; tyt.id = 'geTytul'; tyt.textContent = 'Geologia';
      p.appendChild(tyt);
      korzen.insertBefore(p, korzen.firstChild);
    }
    return p;
  }
  function komunikat(t) {
    var k = doc.getElementById('geLadowanie');
    if (!k && t) { k = doc.createElement('div'); k.id = 'geLadowanie'; k.className = 'ge-ladowanie'; k.setAttribute('role', 'status'); korzen.appendChild(k); }
    if (k) { k.textContent = t || ''; k.hidden = !t; }
  }
  function skrypt(src) {
    return new Promise(function (ok, zle) {
      var s = doc.createElement('script');
      s.src = src; s.async = false;
      s.onload = ok;
      s.onerror = function () { zle(new Error('nie udało się wczytać ' + src)); };
      doc.head.appendChild(s);
    });
  }
  function po(pliki) { return pliki.reduce(function (p, f) { return p.then(function () { return skrypt(f); }); }, Promise.resolve()); }
  function zaladujModul() {
    if (root.Geologia) return Promise.resolve();
    if (ladowanie) return ladowanie;
    ladowanie = po(PLIKI)
      .then(function () { if (!root.Geologia) throw new Error('widok.js nie wystawił window.Geologia'); },
        function (e) { ladowanie = null; throw e; });
    return ladowanie;
  }
  // Pliki miejsca (dane, opowieść) — raz, przy pierwszym wejściu w to miejsce; po miejsca.js (lista w MIEJSCA[].pliki).
  function zaladujMiejsce(id) {
    if (miejscaZaladowane[id]) return miejscaZaladowane[id];
    var m = (root.GeologiaMiejsca ? root.GeologiaMiejsca.MIEJSCA : []).filter(function (x) { return x.id === id; })[0];
    miejscaZaladowane[id] = po(m ? m.pliki : []).then(null, function (e) { delete miejscaZaladowane[id]; throw e; });
    return miejscaZaladowane[id];
  }

  function otworz(stan) {
    var s = stan || parsujHashGeologii('#geologia');
    zapamietajZaproszenie(s);
    korzen.hidden = false;
    if (przycisk) przycisk.hidden = false;
    pasek();
    var wejdz = function () { return zaladujMiejsce(s.miejsce).then(function () { return root.Geologia.otworz(s); }); };
    if (root.Geologia) {
      return wejdz().catch(function (e) { console.error('Geologia: ' + (e && e.message || e)); komunikat('Nie udało się wczytać miejsca. Spróbuj ponownie.'); return false; });
    }
    komunikat('Wczytuję geologię…');
    return zaladujModul().then(function () {
      komunikat('');
      if (root.Zakladki.aktywna() !== 'geologia') return false;          // użytkownik zdążył wyjść
      return wejdz().then(function (w) { return root.Zakladki.aktywna() === 'geologia' ? w : false; });
    }).then(null, function (e) {
      console.error('Geologia: ' + (e && e.message || e));
      komunikat('Nie udało się wczytać zakładki Geologia. Sprawdź połączenie i spróbuj ponownie.');
      return false;
    });
  }
  function zamknij() {
    if (root.Geologia) root.Geologia.zamknij();
    komunikat('');
    korzen.hidden = true;
    if (przycisk && !zap.widoczna) przycisk.hidden = true;
  }

  root.Zakladki.zarejestruj({ id: 'geologia', przycisk: przycisk, pasek: pasek, otworz: otworz, zamknij: zamknij,
    parsujHash: parsujHashGeologii });

  // Start po wczytaniu wszystkich skryptów strony (solar.js też): hak testowy albo link z hashem.
  function start() {
    if (zap.smoke && zap.miejsce) {
      var makieta = zap.tryb === 'makieta';
      var s = { miejsce: zap.miejsce, tryb: makieta ? 'makieta' : 'pokaz', rozdzial: makieta ? null : (zap.rozdzial || 'polozenie') };
      if (makieta && zap.warstwa) s.warstwa = zap.warstwa;
      if (makieta && zap.pora) s.pora = zap.pora;
      if (makieta && zap.pogoda) s.pogoda = zap.pogoda;
      if (makieta && zap.material) s.material = zap.material;
      if (makieta && zap.wiatr === false) s.wiatr = false;
      root.Zakladki.przelacz('geologia', s);
    } else if (parsujHashGeologii(root.location.hash)) root.Zakladki.zAdresu(root.location.hash);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})(typeof window !== 'undefined' ? window : globalThis);
