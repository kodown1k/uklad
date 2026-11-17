/* ============================================================
   focus-scale.js — matematyka kadru kamery przy focusie na ciele.
   Czysta matematyka, bez zależności DOM/THREE. Testowane.
   ============================================================ */
(function (root) {
  'use strict';

  // Granice zoomu (dystans kamera→środek ciała) dla efektywnego promienia rEff.
  //   max: r·400 — hojny zoom-out po zablokowaniu (widać planetę z księżyca i cały
  //        układ księżyców z planety; wcześniej r·60 trzymał kamerę zbyt blisko).
  //   min: r·1.25, ALE nigdy bliżej niż near-plane pozwala — przy bardzo małym
  //        ciele (Ziemia w „Prawdziwej skali" ≈0.002 j. < near 0.05) próg near
  //        wymusza większy min, żeby cała kula została PRZED płaszczyzną near
  //        (inaczej clipping). near·1.1 daje mały margines bezpieczeństwa.
  //   minMul: mnożnik min (domyślnie 1.25). Ziemia używa ~1.03 → kamera schodzi
  //        nisko nad powierzchnię (eksploracja geo). Człon near nadal chroni.
  function zoomBounds(rEff, near, minMul) {
    var m = (typeof minMul === 'number' && minMul > 0) ? minMul : 1.25;
    return { min: Math.max(rEff * m, near * 1.1 + rEff), max: rEff * 400 };
  }

  // Nowy dystans kamery po zmianie efektywnego promienia ciała (prevR→newR),
  // zachowujący rozmiar KĄTOWY ciała na ekranie (rozmiar ∝ r/dist ⇒ dist ∝ r),
  // sklampowany do granic zoomu. Dzięki temu przy przełączeniu skali kamera nie
  // „odskakuje", a Ziemia nie zamienia się w nieosiągalną kropkę.
  function reframeDistance(curDist, prevR, newR, bounds) {
    var raw = prevR > 0 ? curDist * (newR / prevR) : curDist;
    return Math.min(bounds.max, Math.max(bounds.min, raw));
  }

  var FocusScale = { zoomBounds: zoomBounds, reframeDistance: reframeDistance };
  if (typeof module !== 'undefined' && module.exports) module.exports = FocusScale;
  else root.FocusScale = FocusScale;
})(typeof window !== 'undefined' ? window : globalThis);
