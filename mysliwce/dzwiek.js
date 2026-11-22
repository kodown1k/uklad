'use strict';
/* Zakładka Myśliwce — syntetyczny dźwięk silników (Web Audio, bez próbek i plików).
   Czyste (dual-export, testy w node): Dzwiek.doppler(vWzgl, c) → mnożnik częstotliwości, Dzwiek.przelot(t, {v, odleglosc,
   tMin, strona}) → {czestotliwosc, wzmocnienie, panorama, filtr}, Dzwiek.wzmocnienieWznowienia(t, t0, rampa) → 0..1,
   Dzwiek.mieszanka(ciag) → poziomy warstw silnika.
   Przeglądarkowe: Dzwiek.silnik({ ctx? }) → { ctx, turbina(ciag), dopalacz(ciag), przelot(params), grom(kiedy?),
     ambient(nazwa|null), glosnosc(v), pauza(), wznow(), stan(), poziom(), zaplanujDo(t), zwolnij() } albo null bez Web Audio.
     przelot i grom zwracają uchwyt { koniec, zatrzymaj() }; stan().glosy = ile takich głosów jeszcze gra albo czeka.
     Kontekst tworzy wywołanie silnik() — widok woła je dopiero w geście użytkownika (polityka autoplay).
   Ciąg c (wspólny z ogien.js): 0 = silnik stoi, ~0,15 bieg jałowy, 0,6 = pełna moc bez dopalacza, > 0,6 dopalacz.
   Brzmienie (żeby odrzutowiec, nie syrena): szerokopasmowy szum dominuje, gwizd turbiny jest cichą, NIEharmoniczną
   warstwą (prążki 1 : 2,03 : 3,47 : 5,1 łopatek wentylatora i sprężarki; podstawowy 1400 + 900·c Hz, jałowy ~1,5/3,1/
   5,3/7,8 kHz) z drżeniem amplitudy z szumu — bez vibrato, bo okresowa zmiana wysokości = syrena. Obroty zmieniają się
   z bezwładnością wirnika (stała czasu 1,2 s).
     turbina  = 4 sinusy gwizdu (górnoprzepustowy 500 Hz, drżenie 9 Hz, odchylenie 20% gwizdu) + szum biały pasmowo
                (0,9–3,4 kHz) + szum brązowy (huk < 650 Hz);
     dopalacz = szum brązowy → dolnoprzepustowy 300–1000 Hz (ryk, barwa wędruje: playbackRate 1,4 ± 3%) z modulacją
                amplitudy szumem < 7 Hz (odchylenie 40% — „targanie”) + szum pasmowy 1,8 kHz (syk, ±5%) + losowe trzaski
                (Poisson, 4–18/s, 12–60 ms, pasmo 0,5–2,6 kHz) + rzadki „kaszel” (niskie uderzenie 120 ms < 140 Hz);
     ambient  = 'hangar': pomruk (szum brązowy < 90 Hz), brum świetlówek 100 Hz, wentylacja + pogłos hali (splot
                z syntetyczną odpowiedzią impulsową 2,4 s, mokro 0,32); 'niebo': wiatr (±50%) bez pogłosu; null: cisza;
     przelot = osobny głos (gwizd + ryk) z krzywymi z `przelot()`: Doppler (oscylatory, playbackRate szumów i częstotliwości
               filtrów; prążek, który Doppler wypchnąłby ponad 0,45·sampleRate, jest pomijany), StereoPannerNode,
               obwiednia odległości, łagodne pochłanianie powietrza;
     grom    = fala N (dwa skoki ciśnienia co 0,12 s) + dudnienie echa.
   Szum: bufory w pętli o długościach względnie pierwszych (biały 6,1 s, brązowy 7,7 s), każde źródło startuje w losowym
   miejscu; modulatory normowane do odchylenia 1 (szum po dolnoprzepustowym ma odchylenie ≈ 0,0036·√f_odc).
   Zmierzone (render OfflineAudioContext → WAV, 3 rendery, narzędzia recenzji an/env/per.py): najsilniejsza korelacja
   okresowa 1,5–3,2 s 0,22–0,27 (20–300 Hz) i 0,08–0,13 (0,9–4 kHz) — wcześniej 0,76 co 2,14 s; CV obwiedni ryku
   20–300 Hz na dopalaczu 0,38–0,41 (zwykły szum 0,29); bieg jałowy: szczyt widma 1,42–1,52 kHz, udział 10 prążków
   w 0,3–6 kHz 17–31% (okna 0,5 s); RMS hangar −48, jałowy −36, 60% −26, dopalacz −20/−21 dBFS, szczyt 0,36–0,39.
   Wyjście: szyna → limiter (DynamicsCompressor, próg −8 dB, 20:1) → master (≤ 0,5) → głośniki. Pauza: rampa do zera
   i ctx.suspend(); wznowienie: resume i rampa `wzmocnienieWznowienia` (bez skoku głośności po powrocie karty). */
(function (root) {
  var C_DZWIEKU = 343;
  var MASTER = 0.45;                 // ≤ 0,5 — przy glosnosc(1)
  var PROG_AB = 0.6;                 // zapłon dopalacza (wspólny z ogien.js)
  var GWIZD = [1, 2.03, 3.47, 5.1], GWIZD_A = [1, 0.55, 0.32, 0.16];

  /* ---------- czyste ---------- */
  function przytnij(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gladko(a, b, x) { var u = przytnij((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); }

  // Źródło ruchome, słuchacz w spoczynku: f' = f · c / (c − v), v > 0 = zbliża się. |v| przycięte do 0,8 c (≤ 5×):
  // przelot naddźwiękowy nie daje nieskończoności — tam i tak słychać grom.
  function doppler(v, c) {
    c = c || C_DZWIEKU;
    if (!v) return 1;
    var vv = Math.min(v, 0.8 * c);
    return c / (c - vv);
  }
  // Przelot prostoliniowy ze stałą prędkością v [m/s], najbliżej słuchacza (odleglosc [m]) w chwili tMin [s].
  // Bez opóźnienia propagacji: tMin to chwila, w której najbliższy punkt SŁYCHAĆ (reżyseria liczy w tym czasie).
  // wzmocnienie = odleglosc / r (1 w tMin), panorama = sinus kąta od prostopadłej (strona −1 = z prawej na lewą),
  // filtr = odcięcie dolnoprzepustowe [Hz] (powietrze tłumi wysokie tony z odległością).
  function przelot(t, o) {
    var v = o.v, d = Math.max(1, o.odleglosc || 1), s = v * (t - o.tMin), r = Math.sqrt(s * s + d * d);
    var vr = -v * s / r;
    return {
      czestotliwosc: doppler(vr),
      wzmocnienie: d / r,
      panorama: przytnij((o.strona || 1) * s / r, -1, 1),
      filtr: 1500 + 16500 * Math.pow(d / r, 0.7),             // ~6 kHz przy r = 6 d (pochłanianie, nie ściana)
    };
  }
  // Rampa po wznowieniu (karta wraca z tła, M): 0 w t0, 1 po `rampa` s, gładko (smoothstep) — bez trzasku i skoku.
  function wzmocnienieWznowienia(t, t0, rampa) {
    rampa = rampa == null ? 0.25 : rampa;
    if (!(t > t0)) return 0;
    if (t - t0 >= rampa) return 1;
    var u = (t - t0) / rampa;
    return u * u * (3 - 2 * u);
  }
  // Poziomy warstw w funkcji ciągu. Rozruch (0 → 0,15) wycisza wszystko do zera, dopalacz od PROG_AB.
  function mieszanka(ciag) {
    var c = przytnij(+ciag || 0, 0, 1), roz = gladko(0, 0.15, c), ab = c >= PROG_AB ? (c - PROG_AB) / (1 - PROG_AB) : -1;
    return {
      obroty: 1400 + 900 * c,                                  // [Hz] podstawowy prążek gwizdu (jałowy: ~1,5/3,1/5,3/7,8 kHz)
      gwizd: roz * (0.0075 + 0.008 * c),
      szum: roz * (0.05 + 0.13 * c),
      pasmo: 900 + 2500 * c,                                   // [Hz] środek szumu turbiny
      huk: roz * (0.03 + 0.2 * c),
      dopalacz: ab < 0 ? 0 : 0.12 + 0.33 * ab,                 // skok w zapłonie = „łup” dopalacza
      trzaski: ab < 0 ? 0 : 4 + 14 * ab,                       // [1/s]
      filtrDopalacza: ab < 0 ? 300 : 300 + 700 * ab,           // [Hz]
    };
  }

  /* ---------- przeglądarkowe ---------- */
  function silnik(opcje) {
    opcje = opcje || {};
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!opcje.ctx && !AC) return null;
    var ctx = opcje.ctx || new AC(), offline = !!(root.OfflineAudioContext && ctx instanceof root.OfflineAudioContext);
    var zrodla = [], wezly = [], zaplanowane = new Set(), zegar = 0, wyslane = {}, ciagT = 0, ciagA = 0;
    var glos = 1, pauzowany = false, zwolniony = false, analiza = null, bufAn = null, rampaOd = null;
    // głosy jednorazowe (przelot, grom) jeszcze grające albo zaplanowane — zatrzymanie albo koniec zdejmuje głos raz
    var glosy = 0;
    function glosJednorazowy(zrGlosu) {
      var zywy = true;
      glosy++;
      function koniec() { if (zywy) { zywy = false; glosy--; } }
      return { koniec: koniec, zatrzymaj: function () { zrGlosu.forEach(function (s) { try { s.stop(); } catch (_) { /* już stoi */ } }); koniec(); } };
    }
    function w(n) { wezly.push(n); return n; }
    function wzm(v, dokad) { var g = w(ctx.createGain()); g.gain.value = v; if (dokad) g.connect(dokad); return g; }
    function filtr(typ, f, q, dokad) { var b = w(ctx.createBiquadFilter()); b.type = typ; b.frequency.value = f; if (q != null) b.Q.value = q; if (dokad) b.connect(dokad); return b; }
    // źródła z bufora startują w losowym miejscu — kilka źródeł z jednego bufora nie gra tej samej próbki
    function graj(s) { if (s.buffer) s.start(0, Math.random() * s.buffer.duration); else s.start(); zrodla.push(s); return s; }

    // wyjście: szyna → limiter → master; pogłos hali obok (mokro)
    var master = w(ctx.createGain()); master.gain.value = 0; master.connect(ctx.destination);
    var limiter = w(ctx.createDynamicsCompressor());
    limiter.threshold.value = -8; limiter.knee.value = 3; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.15;
    limiter.connect(master);
    var szyna = wzm(1, limiter);
    var poglos = w(ctx.createConvolver()), mokro = wzm(0, limiter);
    poglos.buffer = odpowiedzHali(2.4); szyna.connect(poglos); poglos.connect(mokro);

    // bufory szumu w pętli o długościach względnie pierwszych (biały 6,1 s, brązowy 7,7 s; brązowy = całkowany biały
    // z upływem, bez dryfu DC) — pętla 3 s dawała słyszalny powrót ryku co 2,14 s (3 s / playbackRate 1,4)
    var sr = ctx.sampleRate, NB = Math.floor(sr * 6.1), NR = Math.floor(sr * 7.7);
    var bialy = ctx.createBuffer(1, NB, sr), brazowy = ctx.createBuffer(1, NR, sr);
    var db = bialy.getChannelData(0), dr = brazowy.getChannelData(0), acc = 0, maks = 0, i;
    for (i = 0; i < NB; i++) db[i] = Math.random() * 2 - 1;
    for (i = 0; i < NR; i++) { acc = (acc + 0.02 * (Math.random() * 2 - 1)) / 1.02; dr[i] = acc; maks = Math.max(maks, Math.abs(acc)); }
    for (i = 0; i < NR; i++) dr[i] /= maks;
    function szum(buf, petla) { var s = ctx.createBufferSource(); s.buffer = buf; s.loop = petla !== false; return s; }
    function odpowiedzHali(dl) {
      var n = Math.floor(ctx.sampleRate * dl), b = ctx.createBuffer(2, n, ctx.sampleRate);
      for (var k = 0; k < 2; k++) {
        var d = b.getChannelData(k), lp = 0;
        for (var j = 0; j < n; j++) {
          var t = j / ctx.sampleRate, ob = Math.exp(-t * 2.9) * (t < 0.012 ? t / 0.012 : 1);   // RT60 ≈ 2,4 s
          lp += (Math.random() * 2 - 1 - lp) * (0.5 - 0.42 * Math.min(1, t / dl));        // ciemnieje z czasem (pochłanianie)
          d[j] = lp * ob * (j % 997 === 0 && t < 0.15 ? 3 : 1);                            // kilka wczesnych odbić
        }
      }
      return b;
    }
    // modulator: wolny szum (dolnoprzepustowy) dodawany do AudioParam — drżenie bez okresu. Szum biały ±1 po
    // dolnoprzepustowym Q 0,5 ma odchylenie ≈ 0,0036·√(f_odc·44100/sr) — stąd wzmocnienie normujące do odchylenia 1,
    // a `glebokosc` (wzmocnienie zwracanego węzła) to odchylenie modulacji w jednostkach parametru
    function modulator(fOdc, glebokosc, param) {
      var s = graj(szum(bialy)), f = filtr('lowpass', fOdc, 0.5), n = wzm(1 / (0.0036 * Math.sqrt(fOdc * 44100 / sr))), g = wzm(glebokosc);
      s.connect(f); f.connect(n); n.connect(g); g.connect(param);
      return g;
    }

    /* turbina */
    var gwizdBus = wzm(0), gwizdHp = filtr('highpass', 500, 0.7, szyna); gwizdBus.connect(gwizdHp);
    var oscy = GWIZD.map(function (k, j) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mieszanka(0).obroty * k; o.detune.value = (j % 2 ? 6 : -5);
      o.connect(wzm(GWIZD_A[j], gwizdBus)); return graj(o);
    });
    var gwizdMod = modulator(9, 0, gwizdBus.gain);
    var szumBp = filtr('bandpass', 900, 0.8), szumG = wzm(0, szyna); szumBp.connect(szumG);
    graj(szum(bialy)).connect(szumBp);
    var hukLp = filtr('lowpass', 300, 0.6), hukG = wzm(0, szyna); hukLp.connect(hukG);
    graj(szum(brazowy)).connect(hukLp);

    /* dopalacz */
    var abLp = filtr('lowpass', 300, 0.9), abG = wzm(0, szyna); abLp.connect(abG);
    var abZr = graj(szum(brazowy)); abZr.playbackRate.value = 1.4; abZr.connect(abLp);
    modulator(0.3, 0.042, abZr.playbackRate);                                // wolna wędrówka barwy ryku 1,4 ± 3%
    var abMod = modulator(7, 0, abG.gain);
    var sykBp = filtr('bandpass', 1800, 0.6), sykG = wzm(0, szyna); sykBp.connect(sykG);
    graj(szum(bialy)).connect(sykBp);
    var sykMod = modulator(38, 0, sykG.gain);

    /* ambient */
    var ambLp = filtr('lowpass', 90, 0.7), ambG = wzm(0, szyna); ambLp.connect(ambG);
    graj(szum(brazowy)).connect(ambLp);
    var brum = graj(ctx.createOscillator()); brum.frequency.value = 100; var brumG = wzm(0, szyna); brum.connect(brumG);
    var wentBp = filtr('bandpass', 420, 0.5), wentG = wzm(0, szyna); wentBp.connect(wentG);
    graj(szum(bialy)).connect(wentBp);
    var wiatrBp = filtr('bandpass', 600, 0.4), wiatrG = wzm(0, szyna); wiatrBp.connect(wiatrG);
    graj(szum(bialy)).connect(wiatrBp);
    var wiatrMod = modulator(0.6, 0, wiatrG.gain);

    // cel parametru: płynnie i tylko przy zmianie (każde wywołanie dokłada zdarzenie do osi automatyzacji)
    function cel(klucz, param, v, tau, eps) {
      if (wyslane[klucz] != null && Math.abs(wyslane[klucz] - v) <= (eps || 1e-4)) return;
      wyslane[klucz] = v;
      param.setTargetAtTime(v, ctx.currentTime, tau);
    }

    // trzaski i kaszel dopalacza: planista z wyprzedzeniem (czas kontekstu); w pauzie czas stoi, więc nic nie narasta
    var tPlan = 0;
    function trzask(kiedy, sila) {
      var s = szum(bialy, false), b = filtr('bandpass', 500 + Math.random() * 2100, 1.4), g = wzm(0, szyna), dl = 0.012 + Math.random() * 0.048;
      s.connect(b); b.connect(g);
      g.gain.setValueAtTime(0, kiedy); g.gain.linearRampToValueAtTime(sila, kiedy + 0.002); g.gain.setTargetAtTime(0, kiedy + 0.004, dl / 3);
      start(s, kiedy, Math.random() * 2.5, dl + 0.05, [b, g]);
    }
    function kaszel(kiedy, sila) {
      var s = szum(brazowy, false), f = filtr('lowpass', 140, 1.2), g = wzm(0, szyna);
      s.connect(f); f.connect(g);
      g.gain.setValueAtTime(0, kiedy); g.gain.linearRampToValueAtTime(sila, kiedy + 0.015); g.gain.setTargetAtTime(0, kiedy + 0.03, 0.04);
      start(s, kiedy, Math.random() * 2.5, 0.3, [f, g]);
    }
    function start(s, kiedy, offset, dl, pomocnicze) {
      s.start(kiedy, offset); s.stop(kiedy + dl);
      zaplanowane.add(s);
      s.onended = function () { zaplanowane.delete(s); try { s.disconnect(); } catch (_) { /* */ } pomocnicze.forEach(function (n) { try { n.disconnect(); } catch (_) { /* */ } var k = wezly.indexOf(n); if (k >= 0) wezly.splice(k, 1); }); };
    }
    function zaplanujDo(tKoniec) {
      var m = mieszanka(ciagA);
      tPlan = Math.max(tPlan, ctx.currentTime);
      if (!(m.trzaski > 0)) { tPlan = tKoniec; return; }
      while (tPlan < tKoniec) {
        tPlan += -Math.log(1 - Math.random()) / m.trzaski;
        if (tPlan >= tKoniec) break;
        trzask(tPlan, m.dopalacz * (0.5 + Math.random() * 0.9));
        if (Math.random() < 0.06) kaszel(tPlan, m.dopalacz * 1.6);
      }
    }
    function petla() {
      zegar = 0;
      if (zwolniony) return;
      if (ctx.state === 'running' && !pauzowany) zaplanujDo(ctx.currentTime + 0.2);
      zegar = setTimeout(petla, 80);
    }
    if (!offline) petla();

    function ustawCiag(c) {
      var m = mieszanka(c), tau = 1.2;
      cel('obroty', oscy[0].frequency, m.obroty, tau, 0.5);
      oscy.forEach(function (o, j) { if (j) cel('obroty' + j, o.frequency, m.obroty * GWIZD[j], tau, 0.5); });
      cel('gwizd', gwizdBus.gain, m.gwizd, 0.4);
      cel('gwizdMod', gwizdMod.gain, m.gwizd * 0.2, 0.4);
      cel('szum', szumG.gain, m.szum, 0.5);
      cel('pasmo', szumBp.frequency, m.pasmo, tau, 2);
      cel('huk', hukG.gain, m.huk, 0.5);
      cel('hukF', hukLp.frequency, 260 + 400 * Math.min(1, c), tau, 2);
    }
    function ustawDopalacz(c) {
      var m = mieszanka(c);
      cel('ab', abG.gain, m.dopalacz, m.dopalacz > 0 ? 0.08 : 0.35);       // zapłon szybki, gaśnięcie wolniejsze
      cel('abMod', abMod.gain, m.dopalacz * 0.4, 0.1);
      cel('abF', abLp.frequency, m.filtrDopalacza, 0.3, 2);
      cel('syk', sykG.gain, m.dopalacz * 0.15, 0.1);
      cel('sykMod', sykMod.gain, m.dopalacz * 0.05, 0.1);
    }

    var AMBIENTY = {
      hangar: { pomruk: 0.05, brum: 0.004, went: 0.012, wiatr: 0, mokro: 0.32 },
      niebo: { pomruk: 0.015, brum: 0, went: 0, wiatr: 0.05, mokro: 0 },
    };

    var api = {
      ctx: ctx,
      turbina: function (c) { ciagT = przytnij(+c || 0, 0, 1); ustawCiag(ciagT); },
      dopalacz: function (c) { ciagA = przytnij(+c || 0, 0, 1); ustawDopalacz(ciagA); },
      ambient: function (nazwa) {
        var a = AMBIENTY[nazwa] || { pomruk: 0, brum: 0, went: 0, wiatr: 0, mokro: 0 };
        cel('amb', ambG.gain, a.pomruk, 0.8); cel('brum', brumG.gain, a.brum, 0.8); cel('went', wentG.gain, a.went, 0.8);
        cel('wiatr', wiatrG.gain, a.wiatr, 0.8); cel('wiatrMod', wiatrMod.gain, a.wiatr * 0.5, 0.8); cel('mokro', mokro.gain, a.mokro, 0.5);
      },
      // Przelot (pokaz, Task 8): { v, odleglosc, tMin (s od teraz), czas (s, długość głosu), ciag?, glosnosc?, strona?, kiedy? }
      // → { koniec (czas kontekstu), zatrzymaj() }. Krzywe z przelot() próbkowane co 1/50 s (setValueCurveAtTime).
      przelot: function (p) {
        var t0 = Math.max(ctx.currentTime, p.kiedy || 0) + 0.02, dl = Math.max(0.5, p.czas || 2 * p.tMin), n = Math.max(8, Math.ceil(dl * 50));
        var m = mieszanka(p.ciag == null ? 1 : p.ciag), gl = p.glosnosc == null ? 1 : p.glosnosc;
        var kF = new Float32Array(n), kG = new Float32Array(n), kP = new Float32Array(n), kL = new Float32Array(n);
        for (var j = 0; j < n; j++) {
          var x = przelot(dl * j / (n - 1), p);
          kF[j] = x.czestotliwosc; kG[j] = x.wzmocnienie * gl; kP[j] = x.panorama; kL[j] = x.filtr;
        }
        kG[0] = 0; kG[n - 1] = 0;                                              // bez trzasku na brzegach
        var krzywaF = function (f0) { var k = new Float32Array(n); for (var q = 0; q < n; q++) k[q] = f0 * kF[q]; return k; };
        var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null, obw = ctx.createGain(), lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; obw.gain.value = 0;
        lp.connect(obw); obw.connect(pan || szyna); if (pan) pan.connect(szyna);
        var nowe = [pan, obw, lp].filter(Boolean), zr = [];
        var ryk = szum(brazowy), rykLp = ctx.createBiquadFilter(), rykG = ctx.createGain();
        rykLp.type = 'lowpass'; rykLp.frequency.value = m.filtrDopalacza + 200; rykG.gain.value = m.huk + m.dopalacz;
        ryk.connect(rykLp); rykLp.connect(rykG); rykG.connect(lp); zr.push(ryk); nowe.push(rykLp, rykG);
        var sz = szum(bialy), szBp = ctx.createBiquadFilter(), szG = ctx.createGain();
        szBp.type = 'bandpass'; szBp.frequency.value = m.pasmo; szBp.Q.value = 0.8; szG.gain.value = m.szum * 1.4;
        sz.connect(szBp); szBp.connect(szG); szG.connect(lp); zr.push(sz); nowe.push(szBp, szG);
        var gw = ctx.createGain(); gw.gain.value = m.gwizd * 2.2; gw.connect(lp); nowe.push(gw);
        var maksF = Math.max.apply(null, kF);
        GWIZD.forEach(function (k, j) {
          if (m.obroty * k * maksF > 0.45 * sr) return;                       // Doppler wypchnąłby prążek za Nyquista (alias)
          var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = m.obroty * k; g.gain.value = GWIZD_A[j];
          o.connect(g); g.connect(gw); zr.push(o); nowe.push(g);
          o.frequency.setValueCurveAtTime(krzywaF(m.obroty * k), t0, dl);
        });
        // Doppler szumu: playbackRate przesuwa widmo, a filtry kształtujące muszą iść za nim (inaczej pasmo stoi w miejscu)
        ryk.playbackRate.setValueCurveAtTime(kF, t0, dl);
        sz.playbackRate.setValueCurveAtTime(kF, t0, dl);
        rykLp.frequency.setValueCurveAtTime(krzywaF(m.filtrDopalacza + 200), t0, dl);
        szBp.frequency.setValueCurveAtTime(krzywaF(m.pasmo), t0, dl);
        obw.gain.setValueCurveAtTime(kG, t0, dl);
        lp.frequency.setValueCurveAtTime(kL, t0, dl);
        if (pan) pan.pan.setValueCurveAtTime(kP, t0, dl);
        var koniec = t0 + dl, g = glosJednorazowy(zr);
        zr.forEach(function (s, j) {
          s.start(t0); s.stop(koniec + 0.05); zaplanowane.add(s);
          s.onended = function () {
            zaplanowane.delete(s);
            if (j === 0) { g.koniec(); nowe.concat(zr).forEach(function (n2) { try { n2.disconnect(); } catch (_) { /* */ } }); }
          };
        });
        return { koniec: koniec, zatrzymaj: g.zatrzymaj };
      },
      // Grom dźwiękowy: fala N (skok +, liniowy spadek do −, skok do 0; 0,12 s) i dudnienie echa (szum brązowy ~1,5 s).
      grom: function (kiedy) {
        kiedy = Math.max(ctx.currentTime + 0.01, kiedy || 0);
        var nN = Math.floor(sr * 0.13), b = ctx.createBuffer(1, Math.floor(sr * 0.3), sr), d = b.getChannelData(0);
        for (var j = 0; j < nN; j++) d[j] = 1 - 2 * j / nN;
        var s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = b; lp.type = 'lowpass'; lp.frequency.value = 2200; g.gain.value = 0.55;
        s.connect(lp); lp.connect(g); g.connect(szyna);
        var e = szum(brazowy, false), eLp = ctx.createBiquadFilter(), eG = ctx.createGain();
        eLp.type = 'lowpass'; eLp.frequency.value = 160; eG.gain.value = 0;
        e.connect(eLp); eLp.connect(eG); eG.connect(szyna);
        eG.gain.setValueAtTime(0, kiedy); eG.gain.linearRampToValueAtTime(0.5, kiedy + 0.05); eG.gain.setTargetAtTime(0, kiedy + 0.15, 0.45);
        start(s, kiedy, 0, 0.3, [lp, g]);
        start(e, kiedy, Math.random() * 1.2, 1.8, [eLp, eG]);
        var gl = glosJednorazowy([s, e]), poEchu = e.onended;
        e.onended = function () { gl.koniec(); poEchu(); };
        return { koniec: kiedy + 1.8, zatrzymaj: gl.zatrzymaj };
      },
      glosnosc: function (v) {
        glos = przytnij(+v, 0, 1);
        if (!pauzowany) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(MASTER * glos, ctx.currentTime, 0.12); }
      },
      // Pauza: szybkie wyciszenie (bez trzasku), potem zawieszenie kontekstu (CPU, bateria).
      pauza: function () {
        if (pauzowany || zwolniony) return;
        pauzowany = true; rampaOd = null;
        var t = ctx.currentTime;
        master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + 0.06);
        if (!offline) setTimeout(function () { if (pauzowany && !zwolniony && ctx.state === 'running') ctx.suspend().catch(function () {}); }, 90);
      },
      // Wznowienie: kontekst rusza, głośność wraca krzywą wzmocnienieWznowienia (0 → master w 0,25 s).
      wznow: function () {
        if (zwolniony) return Promise.resolve();
        pauzowany = false;
        var dalej = function () {
          if (pauzowany || zwolniony) return;
          var t = ctx.currentTime, n = 32, k = new Float32Array(n);
          rampaOd = t;
          for (var j = 0; j < n; j++) k[j] = MASTER * glos * wzmocnienieWznowienia(t + 0.25 * j / (n - 1), t, 0.25);
          master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(0, t);
          master.gain.setValueCurveAtTime(k, t, 0.25);
        };
        if (offline || ctx.state === 'running') { dalej(); return Promise.resolve(); }
        return ctx.resume().then(dalej, function () {});
      },
      stan: function () {
        // t / rampaOd: czas kontekstu i początek ostatniej rampy wznowienia (sonda porównuje master z krzywą)
        return { kontekst: ctx.state, pauza: pauzowany, master: master.gain.value, t: ctx.currentTime, rampaOd: rampaOd, glosnosc: glos, ciag: ciagT, dopalacz: ciagA,
          zaplanowane: zaplanowane.size, wezly: wezly.length, glosy: glosy };
      },
      // poziom RMS wyjścia (diagnostyka sondy: czy coś gra); analizator podpinany leniwie, obok ścieżki
      poziom: function () {
        if (!analiza) { analiza = ctx.createAnalyser(); master.connect(analiza); bufAn = new Float32Array(analiza.fftSize); }
        analiza.getFloatTimeDomainData(bufAn);
        var s = 0; for (var j = 0; j < bufAn.length; j++) s += bufAn[j] * bufAn[j];
        return Math.sqrt(s / bufAn.length);
      },
      zaplanujDo: zaplanujDo,
      zwolnij: function () {
        if (zwolniony) return;
        zwolniony = true;
        if (zegar) { clearTimeout(zegar); zegar = 0; }
        var t = ctx.currentTime;
        try { master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + 0.05); } catch (_) { /* */ }
        var koniec = function () {
          zrodla.concat(Array.from(zaplanowane)).forEach(function (s) { try { s.stop(); } catch (_) { /* już stoi */ } try { s.disconnect(); } catch (_) { /* */ } });
          wezly.forEach(function (n) { try { n.disconnect(); } catch (_) { /* */ } });
          if (analiza) try { analiza.disconnect(); } catch (_) { /* */ }
          zrodla = []; wezly = []; zaplanowane.clear();
          if (!offline && ctx.close) ctx.close().catch(function () {});
        };
        if (offline) koniec(); else setTimeout(koniec, 80);
      },
    };
    api.ambient(null);
    if (!offline) api.glosnosc(glos);
    else { master.gain.value = MASTER * glos; }
    return api;
  }

  var Dzwiek = { doppler: doppler, przelot: przelot, wzmocnienieWznowienia: wzmocnienieWznowienia, mieszanka: mieszanka,
    silnik: silnik, MASTER: MASTER, PROG_AB: PROG_AB };
  if (typeof module !== 'undefined' && module.exports) module.exports = Dzwiek;
  else root.Dzwiek = Dzwiek;
})(typeof window !== 'undefined' ? window : globalThis);
