/* ============================================================
   node-handle.js — matematyka przeciąganych uchwytów Δv węzła (M2 Plaster B).
   Czysta logika 2D ekranu + skalary km/s, IIFE, node --test. ZERO zależności, ZERO DOM/THREE.
   Rzut świat→NDC robi glue (THREE .project()); moduł interpretuje zrzutowane piksele.
   ⚠ Δv w km/s; konwersja /1000 (m/s↔km/s) wyłącznie w glue.
   ============================================================ */
(function (root) {
  'use strict';

  var MIN_AXIS_PX = 12;         // |S1−S0| poniżej → oś ~wzdłuż kamery: degeneracja (drag pomija). Floor anty-proca: przy 4px czułość ~200 m/s/px; 12px → ~83 m/s/px. Wszystkie testy poprawne ≥20px.

  // Kierunek osi PNR na ekranie (jednostkowy) + długość 1 km/s w px. null gdy degeneracja.
  function screenAxis(S0, S1) {
    var dx = S1.x - S0.x, dy = S1.y - S0.y;
    var lenPx = Math.sqrt(dx * dx + dy * dy);
    if (!(lenPx >= MIN_AXIS_PX)) return null;                 // NaN lub < próg → degeneracja
    return { ux: dx / lenPx, uy: dy / lenPx, lenPx: lenPx };
  }

  // Rzut parametryczny kursora na oś S0→S1: t (km/s, ze znakiem). S1 ≡ t=1 km/s. null gdy degeneracja.
  function dvScalarFromScreen(S0, S1, ptr) {
    var dx = S1.x - S0.x, dy = S1.y - S0.y, len2 = dx * dx + dy * dy;
    if (!(len2 >= MIN_AXIS_PX * MIN_AXIS_PX)) return null;
    return ((ptr.x - S0.x) * dx + (ptr.y - S0.y) * dy) / len2;
  }

  // Uchwyt nie schodzi poniżej 0 (drugą stronę osi obsługuje przeciwny stożek). NaN → 0.
  function clampHandle(t) { return t > 0 ? t : 0; }

  // Offset chwycenia (km/s): znosi skok przy grabie + absorbuje renderowy STUB. Degeneracja na starcie → 0.
  function grabOffset(S0, S1, ptr0, comp0) {
    var t0 = dvScalarFromScreen(S0, S1, ptr0);
    if (t0 == null) return 0;
    return t0 - comp0;
  }

  // Wysunięcie stożka h w km/s: max(0, sign·pnr[axis]).
  function handleComp(pnrKmS, h) {
    var v = h.sign * (pnrKmS[h.axis] || 0);
    return v > 0 ? v : 0;
  }

  // Nowy obiekt pnr z pnr[h.axis] = h.sign·max(0,t); pozostałe osie skopiowane.
  function writePnr(pnrKmS, h, t) {
    var out = { pro: pnrKmS.pro || 0, nor: pnrKmS.nor || 0, rad: pnrKmS.rad || 0 };
    out[h.axis] = h.sign * (t > 0 ? t : 0);
    return out;
  }

  var HANDLES = [
    { id: 'pro+', axis: 'pro', sign: 1 }, { id: 'pro-', axis: 'pro', sign: -1 },
    { id: 'nor+', axis: 'nor', sign: 1 }, { id: 'nor-', axis: 'nor', sign: -1 },
    { id: 'rad+', axis: 'rad', sign: 1 }, { id: 'rad-', axis: 'rad', sign: -1 }
  ];

  var NodeHandle = {
    MIN_AXIS_PX: MIN_AXIS_PX,
    screenAxis: screenAxis,
    dvScalarFromScreen: dvScalarFromScreen,
    clampHandle: clampHandle,
    grabOffset: grabOffset,
    handleComp: handleComp,
    writePnr: writePnr,
    HANDLES: HANDLES,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = NodeHandle;
  else root.NodeHandle = NodeHandle;
})(typeof window !== 'undefined' ? window : globalThis);
