/* ============================================================
   kino.js — tryb filmowy „Voyager 1 na granicy dnia świetlnego" (?film).
   Oś czasu ujęć + matematyka kamery: każde ujęcie to funkcja (f ∈ [0,1], kotwice) → poza
   {pos, target, roll, fov}. Kotwice (Słońce, Ziemia, sonda, membrana) liczy solar.js ze sceny,
   tu jest tylko geometria i czas. Wektory = tablice [x,y,z] (scena: y w górę).
   Czysta matematyka, bez DOM/THREE. Dual-export IIFE (jak probe-ephem.js).
   ============================================================ */
(function (root) {
  'use strict';

  // ---------- wektory ----------
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function norm(a) { var l = len(a); return l > 0 ? mul(a, 1 / l) : [0, 0, 0]; }
  function lerpV(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  // obrót wektora v wokół osi k (jednostkowej) o kąt th — Rodrigues
  function rotate(v, k, th) {
    var c = Math.cos(th), s = Math.sin(th), kv = cross(k, v), kd = dot(k, v) * (1 - c);
    return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd];
  }
  // sferyczna interpolacja kierunków jednostkowych
  function slerp(a, b, t) {
    var d = Math.max(-1, Math.min(1, dot(a, b))), om = Math.acos(d);
    if (om < 1e-5) return norm(lerpV(a, b, t));
    if (Math.PI - om < 1e-4) {                      // antypody: łuk przez dowolną prostopadłą
      var p = norm(cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      return rotate(a, p, Math.PI * t);
    }
    var s = Math.sin(om);
    return add(mul(a, Math.sin((1 - t) * om) / s), mul(b, Math.sin(t * om) / s));
  }

  // ---------- krzywe czasu ----------
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function easeInOut(x) { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  // rozbieg–przelot–hamowanie: prędkość narasta jak smooth przez ułamek a, potem stała, na końcu lustrzanie.
  // Szczyt prędkości = 1/(1−a) średniej (easeInOut: 3×), a przyspieszenie na obu końcach jest zerowe.
  function cruise(x, a) {
    x = clamp01(x);
    if (x > 0.5) return 1 - cruise(1 - x, a);
    var X = Math.min(x, a) / a;
    return (a * (X * X * X - X * X * X * X / 2) + Math.max(0, x - a)) / (1 - a);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // garb 0→1→0 z zerową prędkością na obu końcach (przechył kamery: sin(πf) urywał się na szwie z prędkością ~1,3°/s)
  function hump(f) { var s = Math.sin(Math.PI * clamp01(f)); return s * s; }
  function logLerp(a, b, t) { return Math.exp(lerp(Math.log(a), Math.log(b), t)); }
  // okno [a,b] → 0..1 z miękkim wejściem i wyjściem (do napisów i błysków)
  function window01(x, a, b, fade) {
    if (x <= a || x >= b) return 0;
    return Math.min(smooth((x - a) / fade), smooth((b - x) / fade));
  }

  // Przyspieszony czas ujęcia „Granica": przesunięcie [h] względem chwili przebicia jako a·sinh(k·(f−fc)).
  // Daje h0 dla f=0 i h1 dla f=1, a w okolicy przebicia (f=fc) czas zwalnia (zwolnione tempo).
  function timelapseParams(h0, h1, k) {
    var lo = 1e-6, hi = 1 - 1e-6, target = h1 / h0;       // h0 < 0 < h1 → target < 0
    for (var i = 0; i < 80; i++) {
      var fc = (lo + hi) / 2, r = Math.sinh(k * (1 - fc)) / Math.sinh(-k * fc);
      if (r < target) lo = fc; else hi = fc;               // r = sinh(k(1−fc))/sinh(−k·fc) rośnie z fc (od −∞ do ~0)
    }
    var fcx = (lo + hi) / 2;
    return { k: k, fc: fcx, a: h1 / Math.sinh(k * (1 - fcx)) };
  }
  function timelapseHours(f, P) { return P.a * Math.sinh(P.k * (clamp01(f) - P.fc)); }
  // chwilowe tempo [h czasu sceny / 1 s filmu] przy długości ujęcia durS
  function timelapseRate(f, P, durS) { return P.a * P.k * Math.cosh(P.k * (clamp01(f) - P.fc)) / durS; }

  // ---------- oś czasu ----------
  // Długości ujęć [s]. Napisy: at/until w sekundach od początku ujęcia.
  var SHOTS = [
    { id: 'uklad',   dur: 11 },
    { id: 'ziemia',  dur: 11, chapter: 'I · Ziemia' },
    { id: 'droga',   dur: 15, chapter: 'II · Droga światła' },
    { id: 'sonda',   dur: 14, chapter: 'III · Voyager 1' },
    { id: 'granica', dur: 20, chapter: 'IV · Granica' },
    { id: 'echo',    dur: 15, chapter: 'V · Echo' }
  ];
  var TIMELAPSE = { h0: -48, h1: 14, k: 5.5 };   // ujęcie „granica": od 2 dób przed przebiciem do 14 h po
  var BLEND = 0.3;                                 // ułamek ujęcia na płynne zejście z pozy końcowej poprzedniego

  function total() { return SHOTS.reduce(function (s, x) { return s + x.dur; }, 0); }
  function shotStart(id) {
    var t = 0;
    for (var i = 0; i < SHOTS.length; i++) { if (SHOTS[i].id === id) return t; t += SHOTS[i].dur; }
    return -1;
  }
  // t [s] od startu filmu → {i, shot, f (0..1 w ujęciu), local [s]}; za końcem → ostatnie ujęcie z f=1
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

  // Zegar sceny filmu [ms]: do ujęcia „granica" stoi na h0, potem przyspieszony czas, w „echo" płynie dalej wolno.
  function clockMs(t, crossMs) {
    var L = locate(t), P = timelapseParams(TIMELAPSE.h0, TIMELAPSE.h1, TIMELAPSE.k);
    var h;
    if (L.shot.id === 'granica') h = timelapseHours(L.f, P);
    else if (L.shot.id === 'echo') h = TIMELAPSE.h1 + L.local * timelapseRate(1, P, shotDur('granica')) * 0.15;
    else h = TIMELAPSE.h0;
    return crossMs + h * 3600000;
  }
  function shotDur(id) { for (var i = 0; i < SHOTS.length; i++) if (SHOTS[i].id === id) return SHOTS[i].dur; return 0; }
  // tempo czasu sceny względem rzeczywistego (do HUD „czas ×N"); 0 = czas stoi
  function clockRate(t) {
    var L = locate(t), P = timelapseParams(TIMELAPSE.h0, TIMELAPSE.h1, TIMELAPSE.k);
    if (L.shot.id === 'granica') return timelapseRate(L.f, P, L.shot.dur) * 3600;
    if (L.shot.id === 'echo') return timelapseRate(1, P, shotDur('granica')) * 0.15 * 3600;
    return 0;
  }
  // ułamek ujęcia „granica", w którym zegar przechodzi przez chwilę przebicia
  function crossFraction() { return timelapseParams(TIMELAPSE.h0, TIMELAPSE.h1, TIMELAPSE.k).fc; }

  // ---------- kotwice → baza ----------
  // u = kierunek Ziemia→sonda; side ⟂ u w płaszczyźnie „poziomej" sceny; up' = side × u
  function basis(u) {
    var side = cross(u, [0, 1, 0]);
    if (len(side) < 1e-6) side = [1, 0, 0];
    side = norm(side);
    return { u: u, side: side, up: norm(cross(side, u)) };
  }

  // ---------- ujęcia ----------
  // A = {S, E, V, R (promień membrany), rEarth}; zwraca {pos, target, roll [rad], fov [deg]}
  var DEG = Math.PI / 180;

  function poseUklad(f, A) {
    var eh = norm(A.E), sd = norm(cross(eh, [0, 1, 0]));
    var e = easeInOut(f);
    var p0 = add(add(mul(eh, len(A.E) + 70), [0, 85, 0]), mul(sd, 34));
    var p1 = add(add(A.E, mul(eh, 7.5)), add([0, 2.2, 0], mul(sd, 4.5)));
    var pos = lerpV(p0, p1, e);
    var target = lerpV(A.S, A.E, smooth(Math.pow(f, 0.85) * 1.15));
    return { pos: pos, target: target, roll: lerp(-5, 0, e) * DEG, fov: lerp(50, 40, e) };
  }

  // koniec ujęcia „ziemia" = start „drogi": kamera za Ziemią (po stronie przeciwnej do sondy), nad jej ramieniem
  function behindEarth(A) {
    var B = basis(norm(sub(A.V, A.E)));
    return add(add(A.E, mul(B.u, -4)), add(mul(B.side, 2.2), mul(B.up, 1.6)));
  }

  function poseZiemia(f, A) {
    var eh = norm(A.E), sd = norm(cross(eh, [0, 1, 0]));
    var d0 = norm(add(add(mul(eh, 7.5), [0, 2.2, 0]), mul(sd, 4.5)));
    var endOff = sub(behindEarth(A), A.E), d1 = norm(endOff);
    var e = easeInOut(f);
    // prosty łuk z pozy tytułowej za Ziemię. Dawny dodatkowy wychył 0,9 rad·sin(πe) wokół osi y szedł tam i z powrotem:
    // obrót 26°/s → 8°/s → 18°/s (dwa zrywy, −33°/s² w połowie ujęcia) bez zmiany kadru końcowego
    var dir = slerp(d0, d1, e);
    var r = logLerp(len([7.5, 2.2, 4.5]), len(endOff), e);
    var u = norm(sub(A.V, A.E));
    var target = add(A.E, mul(u, 2.5 * smooth((f - 0.55) / 0.45)));                 // pod koniec celuje w drogę
    return { pos: add(A.E, mul(dir, r)), target: target, roll: 4 * hump(f) * DEG, fov: lerp(40, 44, e) };
  }

  // odległość kamery od Ziemi wzdłuż promienia w ujęciu „droga" (od −4 do D−8): logarytmicznie — powoli przy
  // Ziemi, szybko w pustce, hamowanie przed sondą
  function drogaDist(f, D) { return logLerp(4, D, easeInOut(f)) - 8; }
  function poseDroga(f, A) {
    var u = norm(sub(A.V, A.E)), B = basis(u), D = len(sub(A.V, A.E));
    var dd = drogaDist(f, D);
    var lat = lerpV(add(mul(B.side, 2.2), mul(B.up, 1.6)), add(mul(B.side, 2.6), mul(B.up, 1.1)), smooth(f));
    var pos = add(add(A.E, mul(u, dd)), lat);
    // patrzy cały czas na sondę (z bocznego odsunięcia kierunek ≈ u, zbiega płynnie); cel trzymany blisko kamery
    // (< próg interstellar), a przy sondzie = sonda. Dawny cel „6 j. przed kamerą" + przejście na sondę skręcał 155°/s.
    var toV = sub(A.V, pos), dV = len(toV);
    var target = dV <= 40 ? A.V : add(pos, mul(toV, 40 / dV));
    var speed = Math.sin(Math.PI * clamp01((f - 0.08) / 0.84));                       // szeroki kąt przy dużej prędkości
    return { pos: pos, target: target, roll: 3.9 * Math.sin(2 * Math.PI * f) * Math.sin(Math.PI * f) * DEG, fov: 44 + 20 * speed * speed };
  }

  // początek ujęcia „granica" (bok, lekko od strony Ziemi) — „sonda" kończy dokładnie tu
  function granicaOffset(B, k) { return add(add(mul(B.side, 5.6 * k), mul(B.u, -1.6 * k)), mul(B.up, 0.95 * k)); }

  function poseSonda(f, A) {
    var u = norm(sub(A.V, A.E)), B = basis(u);
    var startOff = add(mul(u, -8), add(mul(B.side, 2.6), mul(B.up, 1.1)));
    var endOff = granicaOffset(B, 1);
    // cruise zamiast easeInOut: pełny obrót wokół osi lotu w 14 s ma szczyt prędkości 1,4× średniej, nie 3× —
    // sześcienna krzywa upychała okrążenie w środku ujęcia (58,8°/s w t=44 s, pod napisem z odległością)
    var e = cruise(f, 0.3);
    var dir = rotate(slerp(norm(startOff), norm(endOff), e), u, 2 * Math.PI * e);   // pełny obrót wokół osi lotu
    var r = logLerp(len(startOff), len(endOff), e) * (1 - 0.35 * Math.sin(Math.PI * e)); // najazd w połowie
    return { pos: add(A.V, mul(dir, r)), target: A.V, roll: -6 * hump(f) * DEG, fov: 45 };
  }

  // „granica": kamera przypięta do membrany (punkt przebicia P = Ziemia + u·R) — sonda przepływa przez błonę.
  // Wokół chwili przebicia dolly-zoom: FOV maleje, kamera odjeżdża tak, by sonda miała stały rozmiar.
  function poseGranica(f, A) {
    var u = norm(sub(A.V, A.E)), B = basis(u), P = add(A.E, mul(u, A.R));
    var fc = crossFraction();
    var bump = Math.exp(-Math.pow((f - fc) / 0.16, 2));
    var fov = 45 - 19 * bump;
    var k = Math.tan(22.5 * DEG) / Math.tan(fov / 2 * DEG);                           // stały rozmiar kątowy celu
    var drift = lerp(1.0, 0.82, easeInOut(f));                                         // powolny najazd
    var off = granicaOffset(B, k * drift);
    var anchor = lerpV(P, A.V, 0.5);
    var pos = add(anchor, off);
    var target = lerpV(A.V, P, 0.25);
    return { pos: pos, target: target, roll: lerp(0, 5, smooth(f)) * DEG, fov: fov };
  }

  // Szerokość kadru względem 16:9 (kotwica A.aspect z solar.js; bez niej 16:9). Odsunięcia celu w poziomie mnożone
  // przez ten współczynnik trzymają obiekt w tym samym ułamku SZEROKOŚCI kadru na telefonie w pionie i na ultrawide.
  var WIDE_MIN = 0.3;
  function wide(A) { var a = A && A.aspect > 0 ? A.aspect : 16 / 9; return Math.max(WIDE_MIN, Math.min(1.35, a / (16 / 9))); }

  // „echo": odjazd z punktu przebicia na zewnątrz membrany — widać błonę, sondę i promień do Ziemi
  function poseEcho(f, A) {
    var u = norm(sub(A.V, A.E)), B = basis(u), P = add(A.E, mul(u, A.R));
    var e = easeInOut(f);
    var startOff = granicaOffset(B, 0.82);
    var endDir = norm(add(add(mul(u, 0.55), mul(B.side, 0.75)), mul(B.up, 0.45)));
    var dir = slerp(norm(startOff), endDir, smooth(f * 1.3));
    var r0 = len(startOff), r = logLerp(r0, 300, e);
    var anchor = lerpV(lerpV(P, A.V, 0.5), P, e);
    // cel odjeżdża ku Ziemi razem z kamerą (ułamek przebytego odjazdu), a nie z czasem: dawne smooth(f) wyprzedzało
    // logarytmiczny odjazd, więc kamera odwracała się od sondy 47°/s i gubiła ją z kadru na 5,5 s tuż po kulminacji
    var target = lerpV(lerpV(A.V, P, 0.25), add(P, mul(u, -90 * wide(A))), (r - r0) / (300 - r0));
    return { pos: add(anchor, mul(dir, r)), target: target, roll: lerp(5, 0, e) * DEG, fov: lerp(45, 52, e) };
  }

  var POSES = { uklad: poseUklad, ziemia: poseZiemia, droga: poseDroga, sonda: poseSonda, granica: poseGranica, echo: poseEcho };

  // Cel kamery w pos przy przejściu z kierunku da do db (wektory kamera→cel): KIERUNEK patrzenia po łuku (slerp),
  // odległość celu osobno (logLerp). Liniowe mieszanie celów obracało kamerę nierówno, gdy cele leżały w różnych
  // odległościach: na szwie ziemia→droga (cel 6,5 j. → 40 j. od kamery) cały skręt 23° wypadał w pierwszej sekundzie.
  function aimArc(pos, da, db, w) { return add(pos, mul(slerp(norm(da), norm(db), w), logLerp(len(da), len(db), w))); }
  // Przejście między pozami: pozycja liniowo, cel po łuku (aimArc).
  function blendPose(a, b, w) {
    var pos = lerpV(a.pos, b.pos, w);
    return { pos: pos, target: aimArc(pos, sub(a.target, a.pos), sub(b.target, b.pos), w), roll: lerp(a.roll, b.roll, w), fov: lerp(a.fov, b.fov, w) };
  }
  // Poza w chwili t filmu. Pierwsze BLEND ujęcia schodzi z pozy, w której skończyło się poprzednie
  // (liczonej na bieżących kotwicach) — szwy bez skoków, nawet gdy kotwice się przesunęły.
  function pose(t, A) {
    var L = locate(t), p = POSES[L.shot.id](L.f, A);
    if (L.i > 0 && L.f < BLEND) {
      var prev = POSES[SHOTS[L.i - 1].id](1, A);
      p = blendPose(prev, p, smooth(L.f / BLEND));
    }
    return p;
  }

  // ---------- liczby do napisów ----------
  var LAUNCH_MS = Date.UTC(1977, 8, 5, 12, 56);   // start Voyagera 1: 5 IX 1977, 12:56 UTC
  function yearsSince(ms, fromMs) { return (ms - fromMs) / (365.25 * 86400000); }
  function fmtInt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function fmtDec(n, d) { return n.toFixed(d).replace('.', ','); }

  var api = {
    SHOTS: SHOTS, TIMELAPSE: TIMELAPSE, BLEND: BLEND, LAUNCH_MS: LAUNCH_MS,
    total: total, shotStart: shotStart, shotDur: shotDur, locate: locate, clockMs: clockMs, clockRate: clockRate,
    crossFraction: crossFraction, timelapseParams: timelapseParams, timelapseHours: timelapseHours,
    pose: pose, POSES: POSES, wide: wide, WIDE_MIN: WIDE_MIN, aimArc: aimArc, basis: basis, behindEarth: behindEarth, drogaDist: drogaDist,
    smooth: smooth, easeInOut: easeInOut, cruise: cruise, logLerp: logLerp, window01: window01, slerp: slerp, rotate: rotate,
    yearsSince: yearsSince, fmtInt: fmtInt, fmtDec: fmtDec,
    _v: { add: add, sub: sub, mul: mul, dot: dot, cross: cross, len: len, norm: norm }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Kino = api;
})(typeof window !== 'undefined' ? window : this);
