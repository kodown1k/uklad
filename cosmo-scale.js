(function (root) {
  'use strict';

  var DEG = Math.PI / 180;
  var EPS = 23.43928 * DEG;   // obliquity ekliptyki J2000 (jak sky-math.js)
  var LY_SCENE = 44;          // jednostek sceny na 1 ly (tunable; 50,6 ly ≈ 2226 u — klaster sąsiedztwa
                              // realnie duży, żeby gwiazdy NIE były sub-pikselowe; reconciliowane z AU_SCALE=46
                              // przez reframe kamery na wejściu w interstellar. Mieści się w far=60000 (tryb realny).)

  // RA/Dec (J2000, stopnie) → kierunek jednostkowy w scenie (y-up ekliptyka) — jak sky-math.raDecToSceneDir
  function raDecToDir(raDeg, decDeg){
    var ra = raDeg * DEG, dec = decDeg * DEG;
    var ex = Math.cos(dec) * Math.cos(ra);
    var ey = Math.cos(dec) * Math.sin(ra);
    var ez = Math.sin(dec);
    var ax = ex;
    var ay = ey * Math.cos(EPS) + ez * Math.sin(EPS);
    var az = -ey * Math.sin(EPS) + ez * Math.cos(EPS);
    return { x: ax, y: az, z: ay };   // ekliptyczne z→scena y, y→scena z
  }

  function lyToScene(distLy){ return distLy * LY_SCENE; }
  function sceneToLy(d){ return d / LY_SCENE; }

  // Pozycja gwiazdy w scenie interstellar (Słońce w origin), jednostki sceny
  function raDecDistToXYZ(raDeg, decDeg, distLy){
    var dir = raDecToDir(raDeg, decDeg);
    var r = lyToScene(distLy);
    return { x: dir.x * r, y: dir.y * r, z: dir.z * r };
  }

  var MAS = DEG / 3.6e6;   // mas → rad

  // Ruch własny: pozycja po `years` latach — ekstrapolacja LINIOWA W 3D (wektor prędkości
  // stycznej z pm × lata; bez prędkości radialnej — brak w danych). pmRA = μα·cosδ [mas/yr]
  // (SIMBAD/Gaia) = tempo kąta PRAWDZIWEGO. Dla małych t równoważna przesunięciu kątowemu
  // ΔRA=pmRA/cosδ·t, ΔDec=pmDec·t; dla dużych t (suwak ±50 000 lat) NIE zawija biegunów/RA —
  // gwiazda leci po prostej (fizycznie sensowniej; Barnard w wersji kątowej przekraczałby dec 90°).
  // Baza styczna z różnic centralnych na raDecDistToXYZ — niezależna od konwencji osi sceny.
  function posAfterYears(raDeg, decDeg, distLy, pmRA, pmDec, years){
    var base = raDecDistToXYZ(raDeg, decDeg, distLy);
    if (!years || (!pmRA && !pmDec)) return base;
    var h = 1e-3;                                              // krok różniczkowania [deg kąta prawdziwego]
    var cosD = Math.max(1e-9, Math.cos(decDeg * DEG));
    var r1 = raDecDistToXYZ(raDeg + h / cosD, decDeg, distLy);
    var r0 = raDecDistToXYZ(raDeg - h / cosD, decDeg, distLy);
    var d1 = raDecDistToXYZ(raDeg, decDeg + h, distLy);
    var d0 = raDecDistToXYZ(raDeg, decDeg - h, distLy);
    var eR = { x: r1.x - r0.x, y: r1.y - r0.y, z: r1.z - r0.z };
    var eD = { x: d1.x - d0.x, y: d1.y - d0.y, z: d1.z - d0.z };
    var nR = Math.hypot(eR.x, eR.y, eR.z) || 1, nD = Math.hypot(eD.x, eD.y, eD.z) || 1;
    var R = lyToScene(distLy);
    var kR = (pmRA * MAS) * years * R / nR;                    // j. sceny wzdłuż ê_RA
    var kD = (pmDec * MAS) * years * R / nD;                   // j. sceny wzdłuż ê_Dec
    return { x: base.x + eR.x * kR + eD.x * kD,
             y: base.y + eR.y * kR + eD.y * kD,
             z: base.z + eR.z * kR + eD.z * kD };
  }

  // Histereza progu skali (wzorzec soi.js dominantBody: prev-in → luźniej, prev-out → ostrzej)
  function shouldEnterInterstellar(camDist, enterAt){ return camDist >= enterAt; }
  function shouldExitToSystem(camDist, exitAt){ return camDist <= exitAt; }

  // Docelowa skala z histerezą; enterAt > exitAt zapobiega migotaniu na granicy
  function nextScale(camDist, current, enterAt, exitAt){
    if (current === 'system')       return camDist >= enterAt ? 'interstellar' : 'system';
    if (current === 'interstellar') return camDist <= exitAt  ? 'system' : 'interstellar';
    return current;
  }

  var CosmoScale = {
    DEG: DEG, EPS: EPS, LY_SCENE: LY_SCENE,
    raDecToDir: raDecToDir, raDecDistToXYZ: raDecDistToXYZ,
    posAfterYears: posAfterYears,
    lyToScene: lyToScene, sceneToLy: sceneToLy,
    shouldEnterInterstellar: shouldEnterInterstellar,
    shouldExitToSystem: shouldExitToSystem, nextScale: nextScale
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CosmoScale;
  else root.CosmoScale = CosmoScale;
})(typeof window !== 'undefined' ? window : globalThis);
