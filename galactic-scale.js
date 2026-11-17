/* ============================================================
   galactic-scale.js — czysta matematyka skali galaktycznej (D).
   Współrzędne galaktyczne (l, b, dist) → scena (Słońce w origin,
   płaszczyzna galaktyczna = scene xz, y = biegun galaktyczny N).
   Konwencja det=+1 (spec §6): scene.x=gx, scene.y=gz, scene.z=−gy —
   widok znad dysku (+y) = widok z NGP (NIE kopiować swapu z cosmo-scale.js,
   tamten ma det=−1 i dałby lustrzane odbicie mapy).
   Dual-export IIFE jak cosmo-scale.js. Bez DOM/THREE.
   ============================================================ */
(function (root) {
  'use strict';

  var DEG = Math.PI / 180;
  var DISK_RADIUS_LY = 50000;   // promień dysku gwiazdowego MW [ly] (spec §6)
  var R_MW = 2800;              // promień dysku w jednostkach sceny (tunable, spec §13)
  var GAL_SCALE = R_MW / DISK_RADIUS_LY;   // = 0.056 j. sceny na 1 ly

  // Progi histerezy B↔D [j. sceny] — GAL_ENTER w reżimie B (LY_SCENE=44), GAL_EXIT w reżimie D
  // (GAL_SCALE), jak para COSMO_ENTER/EXIT (różne reżimy metryczne — spec §3).
  // ⚠️ GAL_ENTER NIE jest wolny: okno (kadr_B·1.995·margines, maxDistance_B=cr·3] — spec §3,
  // pilnowane testem constraint w test/galactic-scale.test.js.
  var GAL_ENTER = 5600;
  var GAL_EXIT  = 400;

  function galLyToScene(distLy){ return distLy * GAL_SCALE; }
  function sceneToGalLy(d){ return d / GAL_SCALE; }

  // (l, b) [°] + dist [ly] → pozycja sceny [j.]. l=0 = kierunek na centrum (Sgr A*),
  // l rośnie ku l=90° (kierunek rotacji Galaktyki), b=90° = NGP.
  function galToXYZ(lDeg, bDeg, distLy){
    var l = lDeg * DEG, b = bDeg * DEG, r = galLyToScene(distLy);
    var gx = Math.cos(b) * Math.cos(l);   // ku centrum
    var gy = Math.cos(b) * Math.sin(l);   // ku l=90°
    var gz = Math.sin(b);                 // ku NGP
    return { x: gx * r, y: gz * r, z: -gy * r };   // det=+1
  }

  // Histereza progu B↔D (wzorzec cosmo-scale.js nextScale/shouldEnter*)
  function shouldEnterGalactic(camDist){ return camDist >= GAL_ENTER; }
  function shouldExitToInterstellar(camDist){ return camDist <= GAL_EXIT; }

  var GalacticScale = {
    DEG: DEG, DISK_RADIUS_LY: DISK_RADIUS_LY, R_MW: R_MW, GAL_SCALE: GAL_SCALE,
    GAL_ENTER: GAL_ENTER, GAL_EXIT: GAL_EXIT,
    galLyToScene: galLyToScene, sceneToGalLy: sceneToGalLy, galToXYZ: galToXYZ,
    shouldEnterGalactic: shouldEnterGalactic, shouldExitToInterstellar: shouldExitToInterstellar
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GalacticScale;
  else root.GalacticScale = GalacticScale;
})(typeof window !== 'undefined' ? window : globalThis);
