'use strict';
/* Dźwięk filmu zjawiska (spec docs/superpowers/specs/2026-11-19-zjawiska-film-design.md §5): generatywny Web Audio,
   bez plików. Silnik NIE zna osi czasu filmu: cele dostaje z `logika.mikserFilmu` (`ustaw`), akcenty z gotowym czasem
   AudioContext (`akcent`); planowanie i synchronizację robi widok (zegar filmu z `currentTime` jako mistrzem).
   Graf:
     pad (5 oscylatorów jak film Voyagera: D2 A2 D3 E3 A3, transpozycja = ton kroku) → filtr dolnoprzepustowy ─┐
     warstwa wysoka (> 300 Hz: sinusy D5/A5 z wolnym drżeniem — żeby telefon nie grał ciszy)                    ├→ kompresor
     wiatr (szum → pasmowy → dolnoprzepustowy otwierany poziomem wiatru: gaśnie i wraca filtrem)               │   → master
     przelot (szum → pasmowy przemiatany `pasmo`)                                                              │   (≤ 0,5)
     akcenty: „bip” (sinus, dwie fale o oktawę), „zderzenie” (krótki szum przez pasmowy)                       ┘
   Pauza = `ctx.suspend()`, przewinięcie zatrzymuje zaplanowane akcenty. */
(function (root) {
  var BAZA = [73.42, 110.0, 146.83, 164.81, 220.0];   // D2 A2 D3 E3 A3 — pusta kwinta + nona
  var WYSOKIE = [587.33, 880.0];                       // D5 A5
  var BIP = [660, 1320];                               // dwie fale sygnału Sputnika (oktawa jak 20 i 40 MHz)

  function utworz() {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    var ctx = new AC(), master = ctx.createGain(), comp = ctx.createDynamicsCompressor(), analiza = null, buf = null;
    var stale = [], zaplanowane = new Set(), wyslane = {};
    master.gain.value = 0;
    comp.connect(master); master.connect(ctx.destination);
    function graj(o) { o.start(); stale.push(o); return o; }
    function filtr(typ, f, q) { var b = ctx.createBiquadFilter(); b.type = typ; b.frequency.value = f; if (q) b.Q.value = q; return b; }
    function wzm(v, dokad) { var g = ctx.createGain(); g.gain.value = v; g.connect(dokad); return g; }
    // pad
    var lp = filtr('lowpass', 900, 1.5); lp.connect(comp);
    var pad = wzm(0.09, lp);
    var osc = BAZA.map(function (f, i) {
      var o = ctx.createOscillator(); o.type = i < 3 ? 'sawtooth' : 'triangle'; o.frequency.value = f; o.detune.value = i % 2 ? 7 : -6;
      o.connect(pad); return graj(o);
    });
    // warstwa wysoka z drżeniem
    var hi = wzm(0.035, comp);
    var oscH = WYSOKIE.map(function (f, i) { var o = ctx.createOscillator(); o.frequency.value = f; o.detune.value = i ? 4 : -3; o.connect(hi); return graj(o); });
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.13; lfo.connect(wzm(0.02, hi.gain)); graj(lfo);
    // szum (wspólny bufor) dla wiatru, przelotu i zderzeń
    var n = ctx.sampleRate * 2, bufor = ctx.createBuffer(1, n, ctx.sampleRate), dane = bufor.getChannelData(0);
    for (var i = 0; i < n; i++) dane[i] = Math.random() * 2 - 1;
    function szum(petla) { var s = ctx.createBufferSource(); s.buffer = bufor; s.loop = !!petla; return s; }
    var wiatrLp = filtr('lowpass', 150), wiatrG = wzm(0, comp), wiatrBp = filtr('bandpass', 500, 0.7);
    wiatrBp.connect(wiatrLp); wiatrLp.connect(wiatrG);
    var sw = szum(true); sw.connect(wiatrBp); graj(sw);
    var przBp = filtr('bandpass', 300, 2.5), przG = wzm(0, comp);
    przBp.connect(przG);
    var sp = szum(true); sp.connect(przBp); graj(sp);

    function zaplanuj(src, kiedy, dl) {
      src.start(kiedy); src.stop(kiedy + dl);
      zaplanowane.add(src);
      src.onended = function () { zaplanowane.delete(src); };
    }
    var api = {
      ctx: ctx,
      zagrane: 0,                                      // licznik zaplanowanych akcentów (diagnostyka eye-checku)
      teraz: function () { return ctx.currentTime; },
      // cele z miksera: płynnie (setTargetAtTime) i tylko zmienione — cele stoją przez całe kroki, a każde wywołanie
      // dokłada zdarzenie do osi automatyzacji parametru (bez tego oś rośnie o ~140 zdarzeń/s przez cały film)
      ustaw: function (m) {
        var t = ctx.currentTime;
        function cel(klucz, v, eps, f) { if (wyslane[klucz] == null || Math.abs(wyslane[klucz] - v) > eps) { wyslane[klucz] = v; f(v); } }
        cel('glosnosc', m.glosnosc, 1e-3, function (v) { master.gain.setTargetAtTime(v, t, 0.25); });
        cel('filtr', m.filtr, 1, function (v) { lp.frequency.setTargetAtTime(v, t, 0.2); });
        cel('ton', m.ton, 0.02, function (v) {
          var mn = Math.pow(2, v / 12);
          osc.forEach(function (o, j) { o.frequency.setTargetAtTime(BAZA[j] * mn, t, 0.6); });
          oscH.forEach(function (o, j) { o.frequency.setTargetAtTime(WYSOKIE[j] * mn, t, 0.6); });
        });
        cel('wiatr', m.wiatr, 1e-3, function (v) { wiatrG.gain.setTargetAtTime(0.25 * v, t, 0.5); wiatrLp.frequency.setTargetAtTime(150 + 1500 * v, t, 0.5); });
        cel('przelot', m.przelot, 1e-3, function (v) { przG.gain.setTargetAtTime(0.3 * v, t, 0.08); });
        cel('pasmo', m.pasmo, 5, function (v) { przBp.frequency.setTargetAtTime(v, t, 0.08); });
      },
      // akcent sceny ({typ, …} z `akcenty` kroku) w chwili `kiedy` (czas AudioContext)
      akcent: function (a, kiedy) {
        kiedy = Math.max(kiedy, ctx.currentTime);
        api.zagrane++;
        var g = ctx.createGain(); g.connect(comp); g.gain.value = 0;
        if (a.typ === 'bip') {
          var o = ctx.createOscillator(); o.frequency.value = BIP[a.fala ? 1 : 0]; o.connect(g);
          g.gain.setValueAtTime(0, kiedy); g.gain.linearRampToValueAtTime(0.07, kiedy + 0.01); g.gain.setTargetAtTime(0, kiedy + 0.09, 0.02);
          zaplanuj(o, kiedy, 0.2);
        } else if (a.typ === 'zderzenie') {
          var s = szum(false), b = filtr('bandpass', 260 + 140 * ((a.pok || 0) % 4), 1.2); s.connect(b); b.connect(g);
          g.gain.setValueAtTime(0.2 / Math.sqrt(1 + (a.pok || 0)), kiedy); g.gain.setTargetAtTime(0, kiedy + 0.02, 0.06);
          zaplanuj(s, kiedy, 0.35);
        }
      },
      przewin: function () { zaplanowane.forEach(function (s) { try { s.stop(); } catch (_) { /* już stoi */ } }); zaplanowane.clear(); },
      wstrzymaj: function (p) { return (p ? ctx.suspend() : ctx.resume()).catch(function () {}); },
      // poziom RMS wyjścia (diagnostyka eye-checku: czy coś w ogóle gra); analizator podpinany leniwie, obok ścieżki
      poziom: function () {
        if (!analiza) { analiza = ctx.createAnalyser(); master.connect(analiza); buf = new Float32Array(analiza.fftSize); }
        var s = 0; analiza.getFloatTimeDomainData(buf);
        for (var j = 0; j < buf.length; j++) s += buf[j] * buf[j];
        return Math.sqrt(s / buf.length);
      },
      zamknij: function () {
        api.przewin();
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        setTimeout(function () { stale.forEach(function (o) { try { o.stop(); } catch (_) { /* już stoi */ } }); ctx.close().catch(function () {}); }, 600);
      }
    };
    return api;
  }
  root.ZjawiskaDzwiek = { utworz: utworz };
})(typeof self !== 'undefined' ? self : this);
