/* ============================================================
   soi-events.js — detekcja zdarzeń dyskretnych pod warpem (anti-tunneling).

   Problem: przy dużym warpie dt_sim/klatkę jest ogromne (x100000 · ~0,016 s
   ≈ 1600 s/klatkę). Analityczny coast Keplera jest DOKŁADNY dla dowolnego dt,
   ale zdarzenia dyskretne (przekroczenie granicy SOI, impact w periapsis) mogą
   zostać PRZESKOCZONE w jednym kroku (tunneling). Ten moduł dostarcza czystą,
   testowalną matematykę root-find czasu zdarzenia na ANALITYCZNIE propagowanej
   trajektorii statku (Kepler) i planety (positionAt), oraz adaptacyjny cap warpu.

   Jednostki: km, s, rad. mu w km³/s². Ramka statku: planetocentryczna ekliptyka
   J2000 (te same osie co Ephemeris.positionAt → przez eclToScene do sceny).

   Zależności wstrzykiwane (dependency injection), bez importu modułów sceny:
     - propagateCoe(coe, mu, dt) → {r:[x,y,z], v:[x,y,z]}   (analityczny coast)
     - planetProvider(t) → {r:[x,y,z]}   pozycja planety wzgl. obecnego centrum
       (np. helio-relatywna), w KM, w ekliptyce J2000, dla czasu symulacji t [s].

   Czysta matematyka, bez DOM/THREE. IIFE. Testowane (node --test).
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------- pomocnicze wektory (3D, tablice [x,y,z]) ---------- */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function norm(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }

  /* ============================================================
     (1) ROOT-FIND czasu — bisekcja z gwarancją zbieżności na [t0, t0+dt].

     g(τ) jest ciągła i monotoniczna „lokalnie" na rozsądnym kroku, ale przy
     ogromnym warpie krok może zawierać wiele oscylacji. Dlatego NIE polegamy
     na samej bisekcji od [t0,t1] — najpierw SKANUJEMY krok na podprzedziały
     (bracketing), a w każdym podprzedziale gdzie g zmienia znak robimy bisekcję
     (a właściwie metodę Brenta-lite: bisekcja + sieczna fallback dla szybkości).

     Bisekcja jest wybrana zamiast czystego Newtona, bo:
       - nie wymaga pochodnej g (g zależy od dwóch trajektorii Keplera);
       - jest bezwarunkowo zbieżna gdy mamy bracket [a,b] z g(a)·g(b)<0;
       - kontrola dokładności przez tol czasu (s) ORAZ tol wartości (km).
     ============================================================ */

  // Znajdź pierwiastek g na [a,b] przy danym g(a)=ga, g(b)=gb (ga·gb<=0).
  // Metoda: bisekcja z domieszką siecznej (regula falsi z bisekcją gdy utyka).
  // tolT — tolerancja czasu [s]; tolG — tolerancja wartości funkcji [km]; maxIter limit.
  function brentRoot(g, a, b, ga, gb, tolT, tolG, maxIter) {
    if (ga === 0) return a;
    if (gb === 0) return b;
    var it = maxIter || 100;
    var lo = a, hi = b, glo = ga, ghi = gb;
    var mid = a, gm;
    for (var i = 0; i < it; i++) {
      // sieczna (regula falsi) — szybsza gdy g prawie liniowa
      var denom = (ghi - glo);
      var secant = denom !== 0 ? hi - ghi * (hi - lo) / denom : (lo + hi) / 2;
      var bis = (lo + hi) / 2;
      // użyj siecznej tylko gdy mieści się w bracket-cie; inaczej bisekcja
      mid = (secant > lo && secant < hi) ? secant : bis;
      gm = g(mid);
      if (Math.abs(gm) <= tolG || (hi - lo) <= tolT) return mid;
      if ((glo < 0) === (gm < 0)) { lo = mid; glo = gm; }
      else { hi = mid; ghi = gm; }
    }
    return mid;
  }

  /* ============================================================
     (1·C.7) earliestZero — NAJWCZEŚNIEJSZE przejście f przez zero w [a,b],
     odporne na CECHY WEWNĘTRZNE (parzysta liczba przejść ukryta w przedziale).

     Blocker C.7: detekcja po samych znakach końców [a,b] jest ślepa na „wjazd i
     wyjazd" zmieszczone w środku jednego podprzedziału (np. cienki dwell SOI albo
     pełny obieg z ukrytym perycentrum). Tu bramkujemy rekurencję po NIEMONOTONICZNOŚCI:
       - przedział z pojedynczym przejściem i monotoniczny (fm w [fa,fb]) → bezpieczny bracket;
       - monotoniczny bez przejścia → brak ukrytej cechy (stop, O(1));
       - NIEmonotoniczny (fm poza [fa,fb]) → możliwa ukryta para → dziel na połowy.
     Dla gładkich f (Kepler) to terminuje liniowo: po podziale dołka jedna połowa
     jest opadająca, druga rosnąca (znów monotoniczne). Wykładnicze rozgałęzienie
     wymagałoby funkcji niemonotonicznej na każdej skali — co dla coastu Keplera
     nie zachodzi. Pozostałą, sub-rozdzielczościową cechę łapie scanForStep
     (gęstość bazowa) + adaptiveWarpCap (prewencja) — udokumentowane ograniczenie.

     dir: 0 = dowolny kierunek; +1 = tylko rosnące przez zero (−→+, np. perycentrum
     z h=r·v); −1 = tylko malejące (+→−). Zwraca { t, sign } lub null.
     ============================================================ */
  function earliestZero(f, a, b, fa, fb, dir, tolT, tolF, depth) {
    var crosses = (fa < 0) !== (fb < 0);
    if (depth <= 0 || (b - a) <= tolT) {
      if (crosses) {
        var t = brentRoot(f, a, b, fa, fb, tolT, tolF, 100);
        var s = (fb > fa) ? 1 : -1;
        if (dir === 0 || s === dir) return { t: t, sign: s };
      }
      return null;
    }
    var m = (a + b) / 2, fm = f(m);
    var monotone = (fm >= Math.min(fa, fb) && fm <= Math.max(fa, fb));
    if (crosses && monotone) {                 // pojedyncze przejście, lokalnie monotoniczne
      var t2 = brentRoot(f, a, b, fa, fb, tolT, tolF, 100);
      var s2 = (fb > fa) ? 1 : -1;
      if (dir === 0 || s2 === dir) return { t: t2, sign: s2 };
      return null;                             // jedno przejście w złym kierunku → brak
    }
    if (!crosses && monotone) return null;     // monotoniczna bez przejścia → brak ukrytej cechy
    var L = earliestZero(f, a, m, fa, fm, dir, tolT, tolF, depth - 1);   // niemonotoniczna → połowy
    if (L) return L;                                                     // najwcześniejsze najpierw
    return earliestZero(f, m, b, fm, fb, dir, tolT, tolF, depth - 1);
  }

  /* ============================================================
     (1·V1) goldenMin — minimum gładkiej (unimodalnej w [a,b]) funkcji f.
     Złoty podział: ~−log_φ((b−a)/tolT) wywołań, bez pochodnej.

     Po co osobno od earliestZero: detekcja przekroczenia SOI po PRÓBKOWANIU
     WARTOŚCI g=dist−rSOI ma nieusuwalny próg rozdzielczości — cecha (dwell)
     węższa niż pół próbki skanu chowa się między punktami (Vector #1). Lekarstwo:
     wykryć NAJBLIŻSZE PODEJŚCIE = minimum dist, które jest zdarzeniem SZEROKIM
     (podejście+oddalanie rozciąga się na cały przelot, niezależnie od grubości
     dwellu), a dopiero potem sprawdzić próg rSOI wokół tego minimum. To ta sama
     idea co perycentrum w periapsisInStep (zero h=r·v) — stąd SOI jest teraz
     równie odporne jak perycentrum.
     ============================================================ */
  function goldenMin(f, a, b, tolT, maxIter) {
    var gr = 0.6180339887498949;                 // 1/φ
    var c = b - gr * (b - a), d = a + gr * (b - a);
    var fc = f(c), fd = f(d);
    var it = maxIter || 100;
    for (var i = 0; i < it && (b - a) > tolT; i++) {
      if (fc < fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = f(c); }
      else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = f(d); }
    }
    var tm = (fc < fd) ? c : d;
    return { t: tm, val: f(tm) };
  }

  /* ============================================================
     (1a) Soi.crossingTime — czas przekroczenia granicy SOI wewnątrz [t0, t0+dt].

     g(τ) = |r_helio_ship(τ) − r_planet(τ)| − rSOI
          = |r_ship(τ) − r_planet(τ)| − rSOI   (w ramce obecnego centrum)
     gdzie r_ship(τ) z propagateCoe(coeShip, muCenter, τ−t0), a r_planet(τ) z
     planetProvider(τ) (pozycja planety wzgl. obecnego centrum, KM).

     Zwraca: { t, dist, sign } — czas zdarzenia [s], |Δr| w tym czasie [km],
     sign = +1 gdy g rośnie przez zero (WYJŚCIE z SOI), −1 gdy maleje (WEJŚCIE).
     Gdy brak zmiany znaku na całym kroku → null.

     scanN — liczba podprzedziałów bracketingu (anti-tunneling pod warpem);
     dobierana adaptacyjnie przez caller (więcej przy dużym dt). Tu sygnatura
     przyjmuje opcjonalny scanN (domyślnie 64).
     ============================================================ */
  function soiCrossingTime(coeShip, muCenter, planetProvider, rSOI, t0, dt, opts) {
    opts = opts || {};
    var scanN = opts.scanN || 64;
    var tolT = opts.tolT || 1e-3;     // 1 ms dokładności czasu
    var tolG = opts.tolG || 1.0;      // 1 km dokładności odległości
    function dist(tau) {
      var rv = propagateCoe(coeShip, muCenter, tau - t0);
      return norm(sub(rv.r, planetProvider(tau).r));
    }
    function g(tau) { return dist(tau) - rSOI; }
    function out(tc, sign) { return { t: tc, dist: dist(tc), sign: sign }; }
    var step = dt / scanN;
    // węzły skanu
    var tN = [], gN = [];
    for (var k = 0; k <= scanN; k++) {
      var tk = (k === scanN) ? (t0 + dt) : (t0 + k * step);
      tN.push(tk); gN.push(g(tk));
    }
    var prevSlope = 0;
    for (var j = 0; j < scanN; j++) {
      var ta = tN[j], tb = tN[j + 1], ga = gN[j], gb = gN[j + 1];
      if (ga === 0) return out(ta, gb >= 0 ? 1 : -1);
      // (A) zmiana znaku na węzłach → bezpośredni root-find (łapie dwell ≥ podprzedział).
      if ((ga < 0) !== (gb < 0)) return out(brentRoot(g, ta, tb, ga, gb, tolT, tolG, 100), gb > ga ? 1 : -1);
      // (B) UKRYTY dwell (dwell < podprzedział): wykryj szerokie minimum dist po
      // zwrocie nachylenia − → ≥0; bracket [t_{j-1}, t_{j+1}] obejmuje minimum.
      // To łapie cechę węższą niż próbka skanu — czego próbkowanie samego g nie umie (fix V#1).
      var slope = gb - ga;
      if (j > 0 && prevSlope < 0 && slope >= 0 && ga > 0) {
        var lo = tN[j - 1], glo = gN[j - 1];
        var mn = goldenMin(g, lo, tb, tolT, 100);
        if (mn.val < 0 && glo > 0) return out(brentRoot(g, lo, mn.t, glo, mn.val, tolT, tolG, 100), -1);
      }
      prevSlope = slope;
    }
    // (C) siatka bezpieczeństwa: minimum dist w CAŁYM kroku, gdy struktura węzłów go
    // nie ujawniła (np. scanN=1, albo dołek między węzłami bez czytelnego zwrotu nachylenia).
    //
    // Dla MAŁEGO scanN próbkujemy dist gęściej (multimodal-safe): pojedynczy goldenMin
    // po całym kroku zakłada unimodalność i przy WIELU podejściach (krok > 1 obieg)
    // zbiega do nie-najwcześniejszego minimum (V#2). Realnie nieosiągalne (scanForStep
    // daje ≥16, a warp ≤ x100000 ⇒ <1 obieg/podprzedział ⇒ (B) łapie najwcześniejsze),
    // ale domykamy to bez kosztu ścieżki gorącej: drobniejsza siatka tylko gdy scanN<8.
    var probeN = (scanN < 8) ? 32 : scanN;
    if (probeN > scanN) {
      var qStep = dt / probeN, qa = gN[0], qPrevSlope = 0, qPrevT = t0;
      for (var q = 1; q <= probeN; q++) {
        var qt = (q === probeN) ? (t0 + dt) : (t0 + q * qStep);
        var qb = g(qt);
        if ((qa < 0) !== (qb < 0)) return out(brentRoot(g, qPrevT, qt, qa, qb, tolT, tolG, 100), qb > qa ? 1 : -1);
        var qSlope = qb - qa;
        if (q > 1 && qPrevSlope < 0 && qSlope >= 0 && qa > 0) {       // lokalne minimum dist
          var lo2 = qPrevT - qStep, glo2 = g(lo2);
          var mn2 = goldenMin(g, lo2, qt, tolT, 100);
          if (mn2.val < 0 && glo2 > 0) return out(brentRoot(g, lo2, mn2.t, glo2, mn2.val, tolT, tolG, 100), -1);
        }
        qPrevSlope = qSlope; qa = qb; qPrevT = qt;
      }
    }
    var mAll = goldenMin(g, t0, t0 + dt, tolT, 100);
    if (mAll.val < 0) {
      if (gN[0] > 0) return out(brentRoot(g, t0, mAll.t, gN[0], mAll.val, tolT, tolG, 100), -1);   // wjazd
      if (gN[scanN] > 0) return out(brentRoot(g, mAll.t, t0 + dt, mAll.val, gN[scanN], tolT, tolG, 100), 1); // wyjazd (start wewnątrz)
    }
    return null;
  }

  /* ============================================================
     (1b) Orbit.periapsisInStep — wykrycie przejścia periapsis (impact) w [t0,t0+dt].

     Periapsis = minimum |r_ship(τ)| względem ciała centralnego. Dla coast Keplera
     |r| jest analityczne i ma JEDNO minimum na obieg (elipsa) lub jedno globalne
     minimum (hiperbola/parabola — przy podejściu). Pochodna d|r|/dτ = (r·v)/|r|,
     więc minimum ⟺ r·v zmienia znak z − na +.

     Pod warpem krok może przeskoczyć cały obieg (elipsa: wiele periapsis), więc
     skanujemy h(τ) = r·v na podprzedziały i łapiemy KAŻDE przejście − → +.

     Zwraca: pierwsze (najwcześniejsze) periapsis w kroku jako
       { t, rp } — czas [s] i promień periapsis |r| [km]; lub null gdy brak.
     Caller porównuje rp < R_body → impact; jeśli impact, dalej root-find DOKŁADNEGO
     czasu zderzenia (gdy |r| spada poniżej R_body) — patrz impactTime niżej.
     ============================================================ */
  function periapsisInStep(coeShip, muCenter, t0, dt, opts) {
    opts = opts || {};
    var scanN = opts.scanN || 64;
    var tolT = opts.tolT || 1e-3;
    function rdotv(tau) {
      var s = propagateCoe(coeShip, muCenter, tau - t0);
      return s.r[0] * s.v[0] + s.r[1] * s.v[1] + s.r[2] * s.v[2];
    }
    function radius(tau) {
      var s = propagateCoe(coeShip, muCenter, tau - t0);
      return norm(s.r);
    }
    var maxDepth = opts.maxDepth || 50;
    var step = dt / scanN;
    var ta = t0, ha = rdotv(ta);
    for (var k = 1; k <= scanN; k++) {
      var tb = (k === scanN) ? (t0 + dt) : (t0 + k * step);
      var hb = rdotv(tb);
      // perycentrum = wzrost h=r·v przez zero (−→+); (+→− to apocentrum, pomijamy).
      // earliestZero z dir=+1 łapie też perycentrum UKRYTE w jednym podprzedziale
      // (pełny obieg: oba końce h>0, a przejście −→+ siedzi w środku). Fix C.7.
      var z = earliestZero(rdotv, ta, tb, ha, hb, 1, tolT, 1e-6, maxDepth);
      if (z) return { t: z.t, rp: radius(z.t) };
      ta = tb; ha = hb;
    }
    return null;
  }

  /* ============================================================
     (1c) impactTime — DOKŁADNY czas zderzenia gdy periapsis < R_body.

     Tylko gdy periapsisInStep zwrócił rp < R_body wołamy to: g(τ)=|r(τ)|−R_body
     zmienia znak z + na − GDZIEŚ przed czasem periapsis. Bracket = [t0, tPeri],
     bo do periapsis |r| maleje monotonicznie (h=r·v<0), więc dokładnie jedno
     przecięcie z R_body. Zwraca { t, r:R_body } lub null (gdy start już pod
     powierzchnią — zwraca t0).
     ============================================================ */
  function impactTime(coeShip, muCenter, R_body, t0, tPeri, opts) {
    opts = opts || {};
    var tolT = opts.tolT || 1e-3, tolG = opts.tolG || 1.0;
    function g(tau) {
      var s = propagateCoe(coeShip, muCenter, tau - t0);
      return norm(s.r) - R_body;
    }
    var g0 = g(t0);
    if (g0 <= 0) return { t: t0, r: R_body };   // start już pod powierzchnią
    var gp = g(tPeri);
    if (gp > 0) return null;                     // periapsis ponad powierzchnią → brak impactu
    var tc = brentRoot(g, t0, tPeri, g0, gp, tolT, tolG, 100);
    return { t: tc, r: R_body };
  }

  /* ============================================================
     (2) adaptiveWarpCap — auto-zwolnienie (jak KSP) blisko granic SOI / periapsis.

     PREWENCJA tunnelingu (root-find = siatka bezpieczeństwa). Idea: ogranicz warp
     tak, by jeden krok dt_sim = dt_frame·warp NIE pokonał więcej niż ułamek
     najbliższej „cechy": odległości do granicy SOI ORAZ czasu do periapsis.

     Wejście:
       distToSOI [km]      — |odległość do najbliższej granicy SOI| (wejścia/wyjścia)
       speedRel [km/s]     — prędkość względem tej granicy (≈ |v_ship − v_planet|)
       timeToPeri [s]      — czas do najbliższego periapsis (lub Infinity gdy brak/odlot)
       dtFrame [s]         — czas klatki (np. 0,016)
       warpReq             — żądany warp (np. 100000)
       opts.marginSteps    — ile kroków na pokonanie cechy (domyślnie 8)
       opts.maxWarp        — twardy sufit (domyślnie warpReq)
     Zwraca: warp dozwolony (≤ warpReq), zawsze ≥ 1.

     Reguła: dt_sim_max = min( distToSOI/speedRel, timeToPeri ) / marginSteps.
     warpCap = dt_sim_max / dtFrame. clamp(warpReq).
     ============================================================ */
  function adaptiveWarpCap(distToSOI, speedRel, timeToPeri, dtFrame, warpReq, opts) {
    opts = opts || {};
    var margin = opts.marginSteps || 8;
    var tSOI = (speedRel > 1e-9 && isFinite(distToSOI)) ? distToSOI / speedRel : Infinity;
    var tFeature = Math.min(tSOI, isFinite(timeToPeri) ? timeToPeri : Infinity);
    if (!isFinite(tFeature)) return Math.max(1, warpReq);   // brak cechy w pobliżu
    var dtSimMax = tFeature / margin;
    var warpCap = dtSimMax / dtFrame;
    return Math.max(1, Math.min(warpReq, warpCap));
  }

  /* ============================================================
     (3) stepShip — orkiestracja kroku lotu swobodnego z detekcją zdarzeń.

     KOLEJNOŚĆ (zgodnie z briefem):
       detekcja zdarzeń → podział kroku → coast segmentami (z rebase przy SOI).

     Wejście (state):
       coe        — elementy orbity statku wzgl. obecnego centrum
       muCenter   — mu obecnego centrum [km³/s²]
       center     — id obecnego ciała centralnego (np. 'sun' / 'mars')
       R_body     — promień ciała centralnego [km] (do impactu)
       t0         — czas absolutny symulacji na początku kroku [s]
       dtSim      — pełny krok symulacji tego frame'u [s] (= dtFrame·warp_capped)
     Hooki (DI):
       soiQuery(t0, dt) → { rSOI, planetProvider } | null
            — opisuje najbliższą granicę SOI istotną w tym kroku (wejście do
              dziecka LUB wyjście z obecnego centrum). null gdy żadna SOI nie jest
              w grze (np. lecimy w głębokim heliocentrum bez planet w pobliżu).
       onCross(event)  → { coe, muCenter, center, R_body }
            — rebase: transformacja Galileusza pozycji i prędkości do NOWEJ ramki
              (Soi.rebase z członem prędkości planety). Zwraca nowy stan centralny.
       maxEvents       — bezpiecznik pętli (domyślnie 16).

     Zwraca: { coe, muCenter, center, R_body, t, events:[…], impact:null|{t,r} }.
     Gdy impact: pole impact ustawione, t = czas impactu, dalsza propagacja stop.
     ============================================================ */
  function stepShip(state, hooks) {
    var coe = state.coe, mu = state.muCenter, center = state.center;
    var R_body = state.R_body, t = state.t0, tEnd = state.t0 + state.dtSim;
    var maxEvents = (hooks && hooks.maxEvents) || 16;
    var events = [];

    for (var guard = 0; guard < maxEvents; guard++) {
      var dt = tEnd - t;
      if (dt <= 0) break;

      // --- a) periapsis / impact w bieżącym segmencie [t, tEnd] ---
      var peri = periapsisInStep(coe, mu, t, dt, { scanN: scanForStep(dt) });
      var impactCand = null;
      if (peri && R_body > 0 && peri.rp < R_body) {
        impactCand = impactTime(coe, mu, R_body, t, peri.t, {});
      }

      // --- b) przekroczenie SOI w [t, tEnd] ---
      var crossCand = null;
      if (hooks && hooks.soiQuery) {
        var sq = hooks.soiQuery(t, dt);
        if (sq && sq.planetProvider) {
          crossCand = soiCrossingTime(coe, mu, sq.planetProvider, sq.rSOI, t, dt,
                                      { scanN: scanForStep(dt) });
          if (crossCand) crossCand._sq = sq;
        }
      }

      // --- wybierz NAJWCZEŚNIEJSZE zdarzenie w kroku ---
      var tImpact = impactCand ? impactCand.t : Infinity;
      var tCross  = crossCand  ? crossCand.t  : Infinity;

      if (!isFinite(tImpact) && !isFinite(tCross)) break;   // brak zdarzeń → coast do końca

      if (tImpact <= tCross) {
        // impact wygrywa (lub remis) — koniec lotu
        events.push({ type: 'impact', t: impactCand.t, r: impactCand.r });
        return { coe: coe, muCenter: mu, center: center, R_body: R_body,
                 t: impactCand.t, events: events, impact: { t: impactCand.t, r: impactCand.r } };
      }

      // SOI crossing wygrywa: coast do t_event, rebase, kontynuuj w nowej ramce
      events.push({ type: crossCand.sign < 0 ? 'soi-enter' : 'soi-exit',
                    t: crossCand.t, dist: crossCand.dist });
      var nb = hooks.onCross({
        prevCoe: coe, prevMu: mu, prevCenter: center,
        t: crossCand.t, sign: crossCand.sign, sq: crossCand._sq
      });
      coe = nb.coe; mu = nb.muCenter; center = nb.center; R_body = nb.R_body;
      t = crossCand.t;
    }

    return { coe: coe, muCenter: mu, center: center, R_body: R_body,
             t: tEnd, events: events, impact: null };
  }

  // Heurystyka liczby podprzedziałów skanowania ∝ wielkość kroku (anti-tunneling).
  // Mały krok → 16 (taniej); duży warp-krok → do 256. Czysta funkcja (testowalna).
  function scanForStep(dt) {
    if (dt <= 60) return 16;            // ≤ 1 min: gęstość niepotrzebna
    if (dt <= 3600) return 64;          // ≤ 1 h
    if (dt <= 86400) return 128;        // ≤ 1 doba
    return 256;                         // > doba/krok (ekstremalny warp)
  }

  /* ---------- eksport ---------- */
  var SoiEvents = {
    // root-find core
    brentRoot: brentRoot,
    // detektory zdarzeń
    crossingTime: soiCrossingTime,         // Soi.crossingTime(coeShip, mu, planetProvider, rSOI, t0, dt[, opts])
    periapsisInStep: periapsisInStep,      // Orbit.periapsisInStep(coeShip, mu, t0, dt[, opts])
    impactTime: impactTime,
    // prewencja
    adaptiveWarpCap: adaptiveWarpCap,
    scanForStep: scanForStep,
    // orkiestracja
    stepShip: stepShip,
    // pomocnicze (eksport dla testów)
    _sub: sub, _norm: norm
  };

  // propagateCoe wstrzykiwane: w runtime z orbit.js (M1), w testach z mocka.
  // Domyślnie szukamy globalnego Orbit.propagateCoe; jeśli brak — caller MUSI
  // ustawić SoiEvents.setPropagator(fn) przed użyciem.
  var propagateCoe = null;
  SoiEvents.setPropagator = function (fn) { propagateCoe = fn; };
  function ensureProp() {
    if (!propagateCoe) {
      var O = (typeof root !== 'undefined' && root.Orbit) ? root.Orbit
            : (typeof require !== 'undefined' ? tryRequireOrbit() : null);
      if (O && O.propagateCoe) propagateCoe = O.propagateCoe;
    }
    if (!propagateCoe) throw new Error('soi-events: brak propagateCoe — wywołaj SoiEvents.setPropagator(fn)');
  }
  function tryRequireOrbit() { try { return require('./orbit.js'); } catch (e) { return null; } }
  // owiń detektory tak, by leniwie pobrały propagator przy 1. wywołaniu
  ['crossingTime', 'periapsisInStep', 'impactTime', 'stepShip'].forEach(function (k) {
    var orig = SoiEvents[k];
    SoiEvents[k] = function () { ensureProp(); return orig.apply(SoiEvents, arguments); };
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = SoiEvents;
  else root.SoiEvents = SoiEvents;
})(typeof window !== 'undefined' ? window : globalThis);
