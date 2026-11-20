/* ============================================================
   mrugniecie.js — film „Mrugnięcie" (?mrugniecie): V-G-R alfabetem Morse'a z Ziemi do Voyagera 1.
   Akcja NASA „Shine Bright for Voyager's Light-Day" (17.11.2026 po zachodzie słońca).
   Czysta matematyka, bez DOM/THREE: Morse, wysokość Słońca nad horyzontem (zmierzch per miasto),
   oś czasu ujęć, zegar sceny (czoło światła jedzie z prędkością c) i pozy kamery. Dual-export IIFE jak kino.js.
   Wektory [x,y,z] w jednostkach sceny.
   ============================================================ */
(function (root) {
  'use strict';
  // wspólne z filmem 1: krzywa cruise, proporcje kadru (wide) i cel po łuku (aimArc)
  var Kino = (typeof require !== 'undefined') ? require('./kino.js') : root.Kino;
  var cruise = Kino.cruise, wide = Kino.wide, aimArc = Kino.aimArc;

  // ---------- wektory ----------
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function norm(a) { var l = len(a); return l > 0 ? mul(a, 1 / l) : [0, 0, 0]; }
  function lerpV(a, b, t) { return add(a, mul(sub(b, a), t)); }
  function slerp(a, b, t) {
    var d = Math.max(-1, Math.min(1, dot(a, b))), om = Math.acos(d);
    if (om < 1e-5) return norm(lerpV(a, b, t));
    if (Math.PI - om < 1e-4) {                       // antypody: łuk przez dowolną prostopadłą
      var p = norm(cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), c = Math.cos(Math.PI * t), sn = Math.sin(Math.PI * t);
      return add(mul(a, c), mul(p, sn));
    }
    var s = Math.sin(om);
    return add(mul(a, Math.sin((1 - t) * om) / s), mul(b, Math.sin(t * om) / s));
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function easeInOut(x) { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function logLerp(a, b, t) { return Math.exp(lerp(Math.log(a), Math.log(b), t)); }
  var DEG = Math.PI / 180;

  // ---------- Morse ----------
  // Standard ITU: kropka 1, kreska 3, przerwa w znaku 1, między literami 3, między słowami 7 (jednostek).
  var MORSE = { V: '...-', G: '--.', R: '.-.' };
  var UNIT_S = 0.22;                 // długość jednostki [s] — tempo mrugania latarką (ok. 5 słów/min)
  // tekst → [{on, u (jednostki), letter (indeks litery), at (początek w jednostkach)}]; kończy się przerwą słowną
  function morseSeq(text) {
    var out = [], at = 0;
    function push(on, u, letter) { out.push({ on: on, u: u, letter: letter, at: at }); at += u; }
    for (var i = 0; i < text.length; i++) {
      var code = MORSE[text[i]];
      for (var j = 0; j < code.length; j++) {
        push(true, code[j] === '-' ? 3 : 1, i);
        if (j < code.length - 1) push(false, 1, i);
      }
      push(false, i < text.length - 1 ? 3 : 7, i);
    }
    return out;
  }
  function seqUnits(seq) { var l = seq[seq.length - 1]; return l.at + l.u; }
  // stan nadawania po u jednostkach od początku (zapętlone): {on, letter, el}
  function morseAt(u, seq) {
    var T = seqUnits(seq), x = ((u % T) + T) % T;
    for (var i = 0; i < seq.length; i++) if (x < seq[i].at + seq[i].u) return { on: seq[i].on, letter: seq[i].letter, el: i };
    return { on: false, letter: seq[seq.length - 1].letter, el: seq.length - 1 };
  }

  // ---------- Słońce: wysokość nad horyzontem ----------
  function dayOfYear(ms) { var d = new Date(ms); return (ms - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1; }
  // deklinacja [deg] i równanie czasu [min] — przybliżenia NOAA (dokładność ~0,5° / ~1 min, wystarcza na zmierzch)
  function sunDecl(ms) {
    var g = 2 * Math.PI / 365 * (dayOfYear(ms) - 1);
    return (0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
      - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)) / DEG;
  }
  function eqTimeMin(ms) {
    var g = 2 * Math.PI / 365 * (dayOfYear(ms) - 1);
    return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  }
  // długość geograficzna punktu podsłonecznego [deg, E dodatnie]
  function subSolarLon(ms) {
    var d = new Date(ms), h = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + d.getUTCMilliseconds() / 3.6e6;
    var lon = 15 * (12 - h - eqTimeMin(ms) / 60);
    return ((lon + 540) % 360) - 180;
  }
  // sinus wysokości Słońca nad horyzontem w punkcie (lon, lat) [deg]
  function sinElev(lon, lat, ms) {
    var dec = sunDecl(ms) * DEG, la = lat * DEG, H = (lon - subSolarLon(ms)) * DEG;
    return Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H);
  }
  // wieczór: lokalny czas słoneczny między południem a północą (bez tego zmierzch i świt są nieodróżnialne)
  function evening(lon, ms) { return Math.sin((lon - subSolarLon(ms)) * DEG) > 0; }
  // waga „mruga teraz": po zachodzie (od −0,5°) narasta do −2°, gaśnie między −8° a −11° (ok. godzina wieczoru)
  function dusk(sinEl) {
    var el = Math.asin(Math.max(-1, Math.min(1, sinEl))) / DEG;
    return smooth((-0.5 - el) / 1.5) * (1 - smooth((-8 - el) / 3));
  }
  // pierwsza chwila po fromMs, gdy Słońce zeszło poniżej elDeg (krok 1 min, do 2 dób) — „nadaje po zachodzie"
  function sendTime(lon, lat, fromMs, elDeg) {
    var thr = Math.sin(elDeg * DEG), prev = sinElev(lon, lat, fromMs);
    for (var ms = fromMs + 60000; ms < fromMs + 2 * 86400000; ms += 60000) {
      var s = sinElev(lon, lat, ms);
      if (prev > thr && s <= thr) return ms;
      prev = s;
    }
    return NaN;
  }

  // ---------- oś czasu ----------
  var SHOTS = [
    { id: 'zmierzch',  dur: 15, chapter: 'I · Zmierzch' },
    { id: 'nadawanie', dur: 12, chapter: 'II · Nadawanie' },
    { id: 'poscig',    dur: 18, chapter: 'III · Pościg', noBlend: true },
    { id: 'przylot',   dur: 14, chapter: 'IV · Przylot' },
    { id: 'kropka',    dur: 16, chapter: 'V · Kropka' }
  ];
  var BLEND = 0.3;
  function total() { return SHOTS.reduce(function (s, x) { return s + x.dur; }, 0); }
  function shotStart(id) { var t = 0; for (var i = 0; i < SHOTS.length; i++) { if (SHOTS[i].id === id) return t; t += SHOTS[i].dur; } return -1; }
  function shotDur(id) { for (var i = 0; i < SHOTS.length; i++) if (SHOTS[i].id === id) return SHOTS[i].dur; return 0; }
  function locate(t) {
    var acc = 0;
    for (var i = 0; i < SHOTS.length; i++) {
      var s = SHOTS[i];
      if (t < acc + s.dur) return { i: i, shot: s, f: Math.max(0, (t - acc) / s.dur), local: Math.max(0, t - acc) };
      acc += s.dur;
    }
    var last = SHOTS[SHOTS.length - 1];
    return { i: SHOTS.length - 1, shot: last, f: 1, local: last.dur, done: true };
  }

  // ---------- zegar sceny i czoło światła ----------
  // K = { startMs (początek zmierzchu), sendMs (mrugnięcie z Polski), D (|V − Ziemia w chwili nadania|, j. sceny),
  //       c (j. sceny na ms), rE (promień Ziemi w scenie), dEnd (czoło zatrzymuje się dEnd przed sondą na koniec pościgu) }
  // Pościg: odległość czoła od Ziemi (z chwili nadania) — logarytmicznie, od 3 promieni do tuż przed sondą.
  // Druga połowa ujęcia to dojazd wykładniczy z kino.js (wspólny z dolotem do sondy w filmie 1).
  function frontPoscig(f, K) { var koniec = K.D - K.dEnd; return Kino.dojazdDo(f, logLerp(K.rE * 3, koniec, easeInOut(f)), koniec); }
  // odległość czoła od Ziemi [j. sceny] w chwili t filmu; null przed pościgiem
  function front(t, K) {
    var L = locate(t);
    if (L.shot.id === 'poscig') return frontPoscig(L.f, K);
    if (L.shot.id === 'przylot' || L.shot.id === 'kropka') {
      var after = L.local + (L.shot.id === 'kropka' ? shotDur('przylot') : 0);
      return K.D - K.dEnd + after * 1000 * K.c;                                 // czas ×1: światło 1:1
    }
    return null;
  }
  // zegar sceny [ms]: zmierzch = przyspieszony dzień (fala zachodu słońca), nadawanie ×1, pościg = czoło światła
  function clockMs(t, K) {
    var L = locate(t);
    if (L.shot.id === 'zmierzch') return lerp(K.startMs, K.sendMs - shotDur('nadawanie') * 1000, easeInOut(L.f));
    if (L.shot.id === 'nadawanie') return K.sendMs - (shotDur('nadawanie') - L.local) * 1000;
    return K.sendMs + front(t, K) / K.c;
  }
  // tempo czasu sceny względem filmu (do „czas ×N" w HUD)
  function clockRate(t, K) { var h = 0.02; return (clockMs(t + h, K) - clockMs(t - h, K)) / (2 * h * 1000); }
  // chwila filmu (w pościgu), w której zegar sceny mija ms — bisekcja; NaN poza zakresem pościgu
  function tAtClock(ms, K) {
    var a = shotStart('poscig'), b = a + shotDur('poscig') - 1e-6;
    if (ms < clockMs(a, K) || ms > clockMs(b, K)) return NaN;
    for (var i = 0; i < 60; i++) { var m = (a + b) / 2; if (clockMs(m, K) < ms) a = m; else b = m; }
    return (a + b) / 2;
  }
  // chwila filmu, w której czoło mija sondę (front = D)
  function tPass(K) { return shotStart('przylot') + K.dEnd / (1000 * K.c); }

  // ---------- pozy kamery ----------
  // A = { E (Ziemia teraz), Es (Ziemia w chwili nadania), V (sonda), S (Słońce), rE, pr (rozmiar sondy),
  //       pl (wektor jednostkowy środek Ziemi → Warszawa, w świecie) }
  function basis(u) {
    var side = cross(u, [0, 1, 0]);
    if (len(side) < 1e-6) side = [1, 0, 0];
    side = norm(side);
    return { u: u, side: side, up: norm(cross(side, u)) };
  }
  // wieczorny terminator: punkt powierzchni, który właśnie odjeżdża od Słońca (obrót wokół +y)
  function eveningDir(A) { var s = norm(sub(A.S, A.E)); return { s: s, ne: norm(cross([0, 1, 0], s)) }; }

  function poseZmierzch(f, A) {
    var o = eveningDir(A), e = easeInOut(f);
    var dir = norm(add(add(o.ne, mul(o.s, -0.32)), [0, 0.42, 0]));
    var r = logLerp(16, 3.0, easeInOut(Math.min(1, f * 1.5))) * A.rE;               // najazd z daleka, potem dryf
    var target = add(A.E, mul(add(mul(o.ne, 0.42), [0, 0.2, 0]), A.rE));
    return { pos: add(A.E, mul(dir, r)), target: target, roll: lerp(-4, 2, e) * DEG, fov: lerp(40, 33, e) };
  }
  function poseNadawanie(f, A) {
    var o = eveningDir(A), e = easeInOut(f);
    var dir = norm(add(add(A.pl, mul(o.s, 0.34)), [0, 0.12, 0]));
    // najazd kończy się na 1,62 promienia i 33,5° (było 1,42 i 31°): bliżej tekstura Ziemi i światła miast
    // rozpadają się w rozmyte plamy (kadr t=25,5 s), a przy 1,7 promienia wybrzeża są jeszcze czytelne (t=20 s)
    return { pos: add(A.E, mul(dir, A.rE * lerp(1.85, 1.62, e))), target: add(A.E, mul(A.pl, A.rE * 0.93)),
             roll: lerp(2, -3, e) * DEG, fov: lerp(36, 33.5, e) };
  }
  // pościg: kamera tuż za pociągiem błysków; pierwsze ~36% to obrót od Polski na kierunek sondy wokół Ziemi
  function posePoscig(f, A, K) {
    var u = norm(sub(A.V, A.Es)), B = basis(u), dF = frontPoscig(f, K);
    // Pod koniec kamera zostaje w tyle za czołem (0,9 → 4,5 j.) i odsuwa się w bok proporcjonalnie: czoło staje
    // 0,4 j. przed sondą, więc stałe 0,9 j. kończyło ujęcie 1,3 j. od środka modelu (wewnątrz jego obrysu —
    // sonda 2,2× wyższa niż kadr, na niej etykieta błony i napis).
    // Okno 0,6–0,9 ujęcia (było 0,78–1): po zmianie na dojazd wykładniczy czoło stoi przy sondzie już ok. 0,9, więc
    // późniejsze cofanie kamery oddalałoby ją od sondy. cruise ma ciągłe przyspieszenie (easeInOut zmienia jego znak skokiem).
    var lead = lerp(0.9, 4.5, cruise((f - 0.6) / 0.3, 0.5)), lat = lead / 0.9;
    var follow = add(add(A.Es, mul(u, Math.max(dF - lead, A.rE * 2.2))), add(mul(B.side, 0.22 * lat), mul(B.up, 0.1 * lat)));
    var p0 = poseNadawanie(1, A), g = cruise(f / 0.36, 0.4);
    var d0 = norm(sub(p0.pos, A.Es)), d1 = norm(sub(follow, A.Es));
    var pos = add(A.Es, mul(slerp(d0, d1, g), logLerp(len(sub(p0.pos, A.Es)), len(sub(follow, A.Es)), g)));
    var ahead = add(A.Es, mul(u, dF + 3));
    // Ujęcie zaczyna się w pozie końca „nadawania" (bez przejścia w pose()), więc samo musi z niej płynnie wyjść:
    // kierunek patrzenia po łuku (dawne liniowe mieszanie celów: 124°/s w 0,8 s po szwie), a przechył i pole
    // widzenia od wartości „nadawania" (dawniej skok −3° → 0° i 31° → 42° w jednej klatce, przy tej samej pozycji).
    var target = aimArc(pos, sub(p0.target, p0.pos), sub(ahead, pos), g);
    var speed = Math.sin(Math.PI * clamp01((f - 0.1) / 0.8));
    return { pos: pos, target: target, roll: lerp(p0.roll, 3.25 * Math.sin(2 * Math.PI * f) * Math.sin(Math.PI * f) * DEG, g),   // okno sin: zero prędkości przechyłu na końcu
             fov: lerp(p0.fov, 42 + 22 * speed * speed, g) };
  }
  // przylot: z boku sondy — pociąg błysków nadlatuje od Ziemi i mija ją
  function posePrzylot(f, A) {
    var u = norm(sub(A.V, A.Es)), B = basis(u), e = easeInOut(f), k = A.pr;
    var off = add(add(mul(B.side, 6.5 * k), mul(u, lerp(-3.2, 0.8, e) * k)), mul(B.up, 1.6 * k));
    // patrzy nad sondę → sonda niżej, pod tytułem; pod koniec mniej (1,1 → 0,65), bo stałe 1,1 spychało sondę
    // na dolny napis (t=58 s: środek sondy 87 px nad wierszem napisu, wysięgnik na literach)
    // Oś lotu u leży na ekranie ukośnie (sonda 35° nad ekliptyką), więc „nad sondę" wzdłuż B.up to także przesunięcie
    // w bok. W wąskim kadrze (telefon pionowo) pion celu idzie po pionie świata, a odsunięcie wzdłuż u maleje.
    var w = wide(A), upT = norm(lerpV([0, 1, 0], B.up, clamp01((w - Kino.WIDE_MIN) / (1 - Kino.WIDE_MIN))));
    var target = add(add(A.V, mul(u, lerp(-1.6, 0.3, e) * k * w)), mul(upT, lerp(1.1, 0.65, e) * k));
    return { pos: add(A.V, off), target: target, roll: lerp(-2, 3, e) * DEG, fov: lerp(44, 40, e) };
  }
  var KROPKA_FOV = 7;
  // kropka: za sondą, wzrok wstecz na Ziemię; dolly-zoom do kilku stopni — Ziemia i Słońce rozchodzą się w kadrze
  function poseKropka(f, A) {
    var u = norm(sub(A.V, A.Es)), B = basis(u), e = easeInOut(f), k = A.pr;
    var pos = add(A.V, add(add(mul(u, 3.2 * k), mul(B.side, 1.5 * k)), mul(B.up, 0.5 * k)));
    // wzrok przechodzi z sondy na Ziemię po łuku (26°): punkt pośredni na odcinku sonda–Ziemia (6400 j.) uciekał
    // spod kamery w pierwszych klatkach i cały skręt wypadał na początku ujęcia
    var look = slerp(norm(sub(A.V, pos)), norm(sub(A.E, pos)), smooth(f / 0.35));
    // cel trzymany 30 j. przed kamerą: próg skali „interstellar" liczy się od celu, nie od Słońca (jak w kino.js)
    var target = add(pos, mul(look, 30));
    return { pos: pos, target: target, roll: lerp(3, 0, e) * DEG, fov: logLerp(48, KROPKA_FOV, easeInOut(clamp01((f - 0.18) / 0.72))) };
  }
  var POSES = { zmierzch: poseZmierzch, nadawanie: poseNadawanie, poscig: posePoscig, przylot: posePrzylot, kropka: poseKropka };
  function pose(t, A, K) {
    var L = locate(t), p = POSES[L.shot.id](L.f, A, K);
    if (L.i > 0 && L.f < BLEND && !L.shot.noBlend) {
      var prev = POSES[SHOTS[L.i - 1].id](1, A, K), w = smooth(L.f / BLEND);
      // przy Ziemi przejście po łuku wokół jej środka (prosta cięciwa potrafi przejść przez glob)
      var a = sub(prev.pos, A.E), b = sub(p.pos, A.E), nearE = len(a) < 60 * A.rE && len(b) < 60 * A.rE;
      var pos = nearE ? add(A.E, mul(slerp(norm(a), norm(b), w), logLerp(len(a), len(b), w))) : lerpV(prev.pos, p.pos, w);
      // cel po łuku (Kino.aimArc): liniowe mieszanie celów skręca nierówno, gdy cele leżą w różnych odległościach
      p = { pos: pos, target: aimArc(pos, sub(prev.target, prev.pos), sub(p.target, p.pos), w), roll: lerp(prev.roll, p.roll, w), fov: logLerp(prev.fov, p.fov, w) };
    }
    return p;
  }

  var api = {
    MORSE: MORSE, UNIT_S: UNIT_S, morseSeq: morseSeq, seqUnits: seqUnits, morseAt: morseAt,
    dayOfYear: dayOfYear, sunDecl: sunDecl, eqTimeMin: eqTimeMin, subSolarLon: subSolarLon, sinElev: sinElev, dusk: dusk, evening: evening, sendTime: sendTime,
    SHOTS: SHOTS, BLEND: BLEND, total: total, shotStart: shotStart, shotDur: shotDur, locate: locate,
    front: front, clockMs: clockMs, clockRate: clockRate, tAtClock: tAtClock, tPass: tPass,
    pose: pose, POSES: POSES, wide: wide, KROPKA_FOV: KROPKA_FOV, basis: basis, eveningDir: eveningDir,
    smooth: smooth, easeInOut: easeInOut, cruise: cruise, logLerp: logLerp,
    _v: { add: add, sub: sub, mul: mul, dot: dot, cross: cross, len: len, norm: norm, slerp: slerp }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Mrug = api;
})(typeof window !== 'undefined' ? window : this);
