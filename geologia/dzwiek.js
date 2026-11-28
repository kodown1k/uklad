'use strict';
/* Zakładka Geologia — podkład scen filmów (spec R6 „Podkład scen”): generatywny Web Audio, bez plików, gra dla wszystkich
   (także bez lektora — ruling 9-2). Dual-export: node (czysta część, testy) i przeglądarka (window.GeologiaDzwiek).

   Czyste (node: module.exports = Dzwiek; przeglądarka: GeologiaDzwiek.poziomy / .akcenty):
     Dzwiek.poziomy(ujecie, f, opcje?) → { wiatr, morze, pomruk, ton } ∈ [0, 1] — z pól ujęcia (typ, wejście, poziom, woda,
       animacja, pora światła, klucze kamery `h`) w chwili f ∈ [0, 1] ujęcia; opcje.wys_km = wysokość kamery (pokaz podaje
       ją z pozy), inaczej z kluczy kamery. Cc = pełna cisza (R6 „cisza jako znak”), plansza = sam ton.
     Dzwiek.akcenty(rozdzial) → [{ t, co }] — uderzenie osuwiska (start-a3), syk lawy w morzu (lawa-na-klifie) i pary przy
       wynurzeniu (przebicie-tafli), stempel werdyktu (początek ujęcia „-dowod”); zawsze w oddechu: zdarzenie wewnątrz
       wersu przesuwa się na koniec wersu + 0,15 s, a gdy i tam wypada w wersie — odpada. Kulminacja A2 (lawa-na-klifie):
       { t, co: 'cisza', d: 1 } — 1 s ciszy podkładu po syku (R6).
   Przeglądarka:
     GeologiaDzwiek.utworz(ctx, opcje?) → { wejscie, ustaw(poziomy, szybko?), akcent(co, kiedy), cisza(bool), wycisz(kiedy), anulujWyciszenie(), zwolnij(), poziomy(), sygnal() → { podklad, lektor } [dBFS], trzaski() } — cztery warstwy:
       wiatr (szum przez pasmowy, otwiera się z wysokością), morze (szum przez dolnoprzepustowy z wolną obwiednią), pomruk
       (szum brązowy przez dolnoprzepustowy 300–1000 Hz + syk 1,8 kHz + trzaski Poissona 4–18/s), ton (warstwa
       330/494 Hz; dronu 55/82 Hz nie ma — buczał na słuchawkach, a na głośniku laptopa i telefonu był ciszą). Bufory szumu 6,1 s i 7,7 s (względnie pierwsze)
       z losowym startem. Podkład stale 18 dB pod lektorem (bez ściszania przy wersach); `wejscie` = wejście lektora do
       wspólnego miksera; wzmocnienia warstw G_WIATR/G_MORZE/G_POMRUK/G_TON z pomiaru; całość za kompresorem (−8 dB, 20:1) i masterem 0,5. cisza(true) wycisza lektora i podkład razem (M).
     Błąd budowy → utworz rzuca; pokaz gra wtedy bez podkładu z jednym console.warn „Geologia/uwaga: …”.
     opcje.trzaski === false (pejzaż makiety, Task B3 / R17): pomruk bez trzasków Poissona — przy kalimie trzask lawy byłby
     fałszywym sygnałem; pokaz woła utworz(ctx) i ma trzaski jak dotąd. trzaski() = liczba zaplanowanych trzasków (sonda). */
(function (root) {
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function gladko(x) { x = clamp01(x); return x * x * (3 - 2 * x); }

  // wysokość kamery [km] z kluczy ujęcia (h przenoszone w przód, liniowo po u)
  function wysKluczy(u, f) {
    var k = (u.kamera || []).filter(function (x) { return x && isFinite(x.h); });
    if (!k.length) return u.poziom === 'glob' ? 3000 : u.poziom === 'archipelag' ? 400 : null;
    if (f <= (k[0].u || 0)) return k[0].h;
    for (var i = 1; i < k.length; i++) {
      var a = k[i - 1], b = k[i], ua = a.u || 0, ub = b.u == null ? 1 : b.u;
      if (f <= ub) return a.h + (b.h - a.h) * clamp01((f - ua) / Math.max(1e-6, ub - ua));
    }
    return k[k.length - 1].h;
  }

  function poziomy(u, f, opcje) {
    var zero = { wiatr: 0, morze: 0, pomruk: 0, ton: 0, fumarole: 0 };
    if (!u || u.wejscie === 'Cc') return zero;
    f = clamp01(+f || 0);
    if (u.typ === 'plansza') return { wiatr: 0, morze: 0, pomruk: 0, ton: 0.35, fumarole: 0 };
    var h = opcje && isFinite(opcje.wys_km) ? opcje.wys_km : wysKluczy(u, f);
    if (h === null) h = 2;
    var an = u.animacja && u.animacja.nazwa, pora = u.swiatlo && u.swiatlo.pora, noc = pora === 'noc' || an === 'a5';
    var kosmos = u.poziom === 'glob' || h > 60;
    // wiatr: od ~0,3 km rośnie do 4 km; nad chmurami (A4) pełny; z orbity cichy szum wysokich warstw
    var wiatr = kosmos ? 0.15 : 0.15 + 0.65 * gladko((h - 0.3) / 3.7);
    if (an === 'a4') wiatr = Math.max(wiatr, 0.85);
    if (noc) wiatr *= 0.5;
    // morze: blisko brzegu i nisko; woda „szklana” (zabrana / schemat) nie szumi
    var morze = u.woda === 'realna' && !kosmos ? 0.7 * (1 - gladko((h - 0.2) / 4.8)) : 0;
    if (u.poziom === 'wstawka:garachico' || u.poziom === 'wstawka:teno') morze = Math.max(morze, 0.45);
    if (u.woda !== 'realna') morze = 0;
    // pomruk ziemi i lawy: lawa 1706 (A2) i osuwisko (A3) pełne, wzrost wyspy (A1) — zależnie od tego, czy góra rośnie
    var pomruk = 0;
    if (an === 'a2') pomruk = u.lawaStygnie >= 2 ? 0 : u.animacja.od >= 1 ? 0.25 : 0.95;   // świt po erupcji: lawa stygnie; D1 (dziś): cisza
    else if (an === 'a3') pomruk = 0.85;
    else if (an === 'a1') pomruk = u.animacja.od === u.animacja.do ? 0.2 : 0.55;
    else if (u.przekroj || /\/komora$/.test(u.id || '')) pomruk = 0.3;
    if (noc) pomruk = 0;
    // ton przestrzeni: stały, mocniejszy z orbity i nocą
    var ton = kosmos ? 0.6 : noc ? 0.5 : u.poziom === 'archipelag' ? 0.45 : 0.3;
    // syk fumaroli (decyzja P9, recenzja kinowa r1): cichy szum > 2,5 kHz pod wersem „Posłuchaj: … syczą fumarole”
    var fumarole = u.dzwiekFumarol ? 1 : 0;
    return { wiatr: clamp01(wiatr), morze: clamp01(morze), pomruk: clamp01(pomruk), ton: clamp01(ton), fumarole: fumarole };
  }

  var AKCENT = { 'start-a3': 'uderzenie', 'lawa-na-klifie': 'syk', 'przebicie-tafli': 'syk' };
  function wWersie(r, t) { for (var i = 0; i < r.wersy.length; i++) if (t > r.wersy[i].start - 0.05 && t < r.wersy[i].koniec + 0.05) return r.wersy[i]; return null; }
  function akcenty(r) {
    var out = [];
    var dodaj = function (t, co, d) {
      var w = wWersie(r, t);
      if (w) { t = w.koniec + 0.15; if (wWersie(r, t)) return; }
      if (t < 0 || t > r.czas) return;
      var a = { t: t, co: co }; if (d) a.d = d;
      out.push(a);
      return a;
    };
    (r.zdarzenia || []).forEach(function (z) {
      var co = AKCENT[z.co];
      if (!co) return;
      var a = dodaj(z.t, co);
      if (a && z.co === 'lawa-na-klifie') dodaj(a.t + 1.2, 'cisza', 1);
    });
    (r.ujecia || []).forEach(function (u) { if (/-dowod$/.test(u.id)) dodaj(u.od + 0.05, 'stempel'); });
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  var Dzwiek = { poziomy: poziomy, akcenty: akcenty, wysKluczy: wysKluczy };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Dzwiek; return; }
  // w przeglądarce tylko pod GeologiaDzwiek (window.Dzwiek należy do Myśliwców — test globalne-nazwy)

  /* ---------- przeglądarka ---------- */
  var POD_LEKTOREM = Math.pow(10, -18 / 20);      // podkład −18 dB względem lektora (oba na −20 dBFS RMS)
  var MASTER = 0.5;
  // wzmocnienie warstw (pomiar OfflineAudioContext 24.11, każda warstwa sama na poziomie 1): bez nich wiatr −57, morze −58,
  // pomruk −35, ton −42 dBFS — po usunięciu dronu wiatr i morze były niesłyszalne. Cel: warstwa na pełnym poziomie ≈ −36 dBFS
  // (średni podkład filmu ≈ −38 dBFS = 18 dB pod lektorem, szczyt pomruku ≥ 13 dB pod lektorem), ton jako stała podłoga.
  var G_WIATR = 11, G_MORZE = 13, G_POMRUK = 1, G_TON = 1.8;

  function utworz(ctx, opcje) {
    if (!ctx) throw new Error('brak AudioContext');
    var trzaskiWl = !(opcje && opcje.trzaski === false), nTrzaskow = 0;
    var sr = ctx.sampleRate, wezly = [], zrodla = [];
    var w = function (n) { wezly.push(n); return n; };
    function szum(sek, brazowy) {
      var n = Math.round(sek * sr), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), ost = 0, s2 = 0, i;
      for (i = 0; i < n; i++) {
        var x = Math.random() * 2 - 1;
        if (brazowy) { ost = (ost + 0.02 * x) / 1.02; x = ost; }
        d[i] = x; s2 += x * x;
      }
      var k = 0.1 / Math.sqrt(s2 / n);                 // RMS −20 dBFS przed filtrami
      for (i = 0; i < n; i++) d[i] *= k;
      return b;
    }
    function petla(buf) {
      var s = ctx.createBufferSource();
      s.buffer = buf; s.loop = true;
      s.start(0, Math.random() * buf.duration);
      zrodla.push(s);
      return s;
    }
    function filtr(typ, f, q) { var x = w(ctx.createBiquadFilter()); x.type = typ; x.frequency.value = f; x.Q.value = q || 0.7; return x; }
    function gain(v) { var g = w(ctx.createGain()); g.gain.value = v; return g; }
    function lfo(hz, glebia, cel) { var o = ctx.createOscillator(), g = gain(glebia); o.frequency.value = hz; o.connect(g); g.connect(cel); o.start(); zrodla.push(o); return o; }

    // mikser: lektor (wejscie) + podkład → kompresor → wyciszenie (M) → master 0,5
    var komp = w(ctx.createDynamicsCompressor());
    komp.threshold.value = -8; komp.ratio.value = 20; komp.knee.value = 0; komp.attack.value = 0.003; komp.release.value = 0.25;
    var mute = gain(1), master = gain(MASTER);
    komp.connect(mute); mute.connect(master); master.connect(ctx.destination);
    var wejscie = gain(1); wejscie.connect(komp);
    var podklad = gain(POD_LEKTOREM), cisza1s = gain(1); podklad.connect(cisza1s); cisza1s.connect(komp);

    var A = szum(6.1, false), B = szum(7.7, false), C = szum(6.1, true);
    // wiatr
    var gW = gain(0), puW = gain(0.7);
    petla(A).connect(filtr('bandpass', 620, 0.6)).connect(puW); puW.connect(gW); gW.connect(podklad);
    lfo(0.13, 0.3, puW.gain);
    // morze
    var gM = gain(0), puM = gain(0.55);
    petla(B).connect(filtr('lowpass', 700, 0.5)).connect(puM); puM.connect(gM); gM.connect(podklad);
    lfo(0.09, 0.45, puM.gain);
    // pomruk: szum brązowy przez dolnoprzepustowy 300–1000 Hz + syk 1,8 kHz + trzaski
    var gP = gain(0), lpP = filtr('lowpass', 300, 0.8), gSyk = gain(0);
    petla(C).connect(lpP).connect(gP); gP.connect(podklad);
    petla(B).connect(filtr('bandpass', 1800, 2.5)).connect(gSyk); gSyk.connect(podklad);
    var gTrz = gain(1); gTrz.connect(podklad);
    var trzask = (function () {
      var n = Math.round(0.018 * sr), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (0.003 * sr)) * 0.6;
      return b;
    })();
    // ton przestrzeni: warstwa 330/494 Hz (bez dronu 55/82 Hz: na słuchawkach buczał, na głośniku laptopa i telefonu
    // był ciszą — 94% energii podkładu poniżej 120 Hz, zgłoszenie 24.11)
    var gT = gain(0), lpT = filtr('lowpass', 1400, 0.5), tremT = gain(0.8);
    [[329.6, 'triangle', 0.12], [493.9, 'sine', 0.08]].forEach(function (x) {
      var o = ctx.createOscillator(), g = gain(x[2]); o.type = x[1]; o.frequency.value = x[0]; o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(g); g.connect(lpT); o.start(); zrodla.push(o);
    });
    lpT.connect(tremT); tremT.connect(gT); gT.connect(podklad);
    lfo(0.07, 0.2, tremT.gain);
    // fumarole: szum biały przez górnoprzepustowy 2,5 kHz, cicho (poziom niezmierzony względem lektora — cel −24 dB)
    var gF = gain(0), puF = gain(0.6);
    petla(A).connect(filtr('highpass', 2500, 0.7)).connect(puF); puF.connect(gF); gF.connect(podklad);
    lfo(0.21, 0.35, puF.gain);

    // pomiar sygnału (sonda: cisza w czerni celowej Cc) — analizatory na wyjściu podkładu i na wejściu lektora do miksera
    var anP = w(ctx.createAnalyser()), anL = w(ctx.createAnalyser()), probki = null;
    anP.fftSize = anL.fftSize = 2048;
    cisza1s.connect(anP); wejscie.connect(anL);
    function dbfs(an) {
      if (!an.getFloatTimeDomainData) return null;
      probki = probki || new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(probki);
      var s = 0;
      for (var i = 0; i < probki.length; i++) s += probki[i] * probki[i];
      var r = Math.sqrt(s / probki.length);
      return r > 1e-10 ? 20 * Math.log10(r) : -200;
    }

    var poz = { wiatr: 0, morze: 0, pomruk: 0, ton: 0, fumarole: 0 }, nastTrzask = 0;
    // szybko = wejście w czerń celową Cc: cisza w ułamku sekundy (τ 0,03 s → −40 dB po 0,14 s), nie w 1–2 s jak przy zmianie ujęcia
    function ustaw(p, szybko) {
      var t = ctx.currentTime, k = szybko ? 0 : 1, f = function (tau) { return k ? tau : 0.03; };
      poz = p || poz;
      gW.gain.setTargetAtTime(poz.wiatr * G_WIATR, t, f(0.4));
      gM.gain.setTargetAtTime(poz.morze * G_MORZE, t, f(0.4));
      gP.gain.setTargetAtTime(poz.pomruk * 1.6 * G_POMRUK, t, f(0.3));
      lpP.frequency.setTargetAtTime(300 + 700 * poz.pomruk, t, f(0.3));
      gSyk.gain.setTargetAtTime(poz.pomruk * 0.25 * G_POMRUK, t, f(0.3));
      gT.gain.setTargetAtTime(poz.ton * 0.9 * G_TON, t, f(0.6));
      gF.gain.setTargetAtTime((poz.fumarole || 0) * 0.12, t, f(0.5));
      gTrz.gain.setTargetAtTime(szybko ? 0 : 1, t, f(0.1));   // trzaski zaplanowane z wyprzedzeniem też milkną w Cc
      // trzaski Poissona 4–18/s, planowane 0,15 s naprzód (proces bez pamięci — odstępy wykładnicze)
      if (trzaskiWl && poz.pomruk > 0.05 && ctx.state === 'running') {
        var lam = 4 + 14 * poz.pomruk;
        if (nastTrzask < t) nastTrzask = t + 0.02;
        while (nastTrzask < t + 0.15) {
          var s = ctx.createBufferSource(), g = ctx.createGain();
          s.buffer = trzask; g.gain.value = poz.pomruk * (0.3 + 0.7 * Math.random());
          s.playbackRate.value = 0.6 + Math.random() * 0.8;
          s.connect(g); g.connect(gTrz); s.start(nastTrzask); nTrzaskow++;
          s.onended = (function (a, b) { return function () { try { a.disconnect(); b.disconnect(); } catch (_) { /* nic */ } }; })(s, g);
          nastTrzask += -Math.log(1 - Math.random()) / lam;
        }
      }
    }
    function obwiednia(g, t, a, szczyt, d) {
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(szczyt, t + a); g.gain.exponentialRampToValueAtTime(0.0005, t + a + d);
    }
    function akcent(co, kiedy) {
      var t = Math.max(ctx.currentTime, kiedy || 0);
      if (co === 'cisza') { cisza1s.gain.setTargetAtTime(0, t, 0.05); cisza1s.gain.setTargetAtTime(1, t + 1, 0.3); return; }
      var s = ctx.createBufferSource(), g = ctx.createGain(), f;
      if (co === 'uderzenie') {
        s.buffer = C; f = filtr('lowpass', 220, 0.9); obwiednia(g, t, 0.02, 3.2, 2.2);
        var o = ctx.createOscillator(), go = ctx.createGain(); o.frequency.setValueAtTime(48, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.2);
        obwiednia(go, t, 0.01, 0.5, 1.4); o.connect(go); go.connect(podklad); o.start(t); o.stop(t + 1.6);
      } else if (co === 'syk') {
        s.buffer = A; f = filtr('highpass', 2500, 0.7); obwiednia(g, t, 0.15, 1.6, 1.8);
      } else if (co === 'stempel') {
        s.buffer = B; f = filtr('bandpass', 900, 1.5); obwiednia(g, t, 0.004, 2.4, 0.09);
        var o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.frequency.value = 120;
        obwiednia(g2, t, 0.004, 0.6, 0.16); o2.connect(g2); g2.connect(podklad); o2.start(t); o2.stop(t + 0.3);
      } else return;
      s.connect(f); f.connect(g); g.connect(podklad);
      s.start(t, Math.random() * 2); s.stop(t + 4);
    }
    function cisza(wl) { mute.gain.setTargetAtTime(wl ? 0 : 1, ctx.currentTime, 0.02); }
    // cisza zaplanowana na chwilę kiedy (czas kontekstu) — przed czernią celową Cc; anulujWyciszenie() przy skoku w filmie
    var GLOSNOSCI = [gW.gain, gM.gain, gP.gain, gSyk.gain, gT.gain, gTrz.gain, gF.gain];   // z sykiem fumaroli (MON-2: wycisz przed Cc)
    function wycisz(kiedy) { GLOSNOSCI.forEach(function (g) { g.setTargetAtTime(0, Math.max(ctx.currentTime, kiedy), 0.03); }); }
    function anulujWyciszenie() { var t = ctx.currentTime; GLOSNOSCI.forEach(function (g) { g.cancelScheduledValues(t); }); }
    function zwolnij() {
      zrodla.forEach(function (s) { try { s.stop(); s.disconnect(); } catch (_) { /* nic */ } });
      wezly.forEach(function (n) { try { n.disconnect(); } catch (_) { /* nic */ } });
      zrodla = []; wezly = [];
    }
    return { wejscie: wejscie, ustaw: ustaw, akcent: akcent, cisza: cisza, wycisz: wycisz, anulujWyciszenie: anulujWyciszenie, zwolnij: zwolnij, poziomy: function () { return poz; },
      // poziom sygnału [dBFS] w tej chwili: podkład (za ciszą akcentu) i lektor (wejście miksera); -200 = cisza cyfrowa
      sygnal: function () { return { podklad: dbfs(anP), lektor: dbfs(anL) }; },
      trzaski: function () { return nTrzaskow; } };
  }
  root.GeologiaDzwiek = { utworz: utworz, poziomy: poziomy, akcenty: akcenty };
})(typeof window !== 'undefined' ? window : globalThis);
