/* ============================================================
   galaxy-shape.js — proceduralny kształt galaktyki + orientacja na niebie.
   Czysta matematyka (bez DOM/THREE). Dual-export UMD jak sky-math.js.
   Jednostki: LOKALNE (jednostki sceny). Orientacja przez skyBasis; przesunięcie
   na sferę nieba (points.position=center) robi solar.js — patrz spec §4.
   ============================================================ */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2;
  var SkyMath = (typeof module !== 'undefined' && module.exports)
    ? require('./sky-math.js') : root.SkyMath;

  function cross(a, b){ return { x:a.y*b.z - a.z*b.y, y:a.z*b.x - a.x*b.z, z:a.x*b.y - a.y*b.x }; }
  function norm(a){ var l = Math.hypot(a.x, a.y, a.z) || 1; return { x:a.x/l, y:a.y/l, z:a.z/l }; }
  function add(a, b){ return { x:a.x + b.x, y:a.y + b.y, z:a.z + b.z }; }
  function scale(a, s){ return { x:a.x*s, y:a.y*s, z:a.z*s }; }

  // RA/Dec[°] + tilt/roll[rad] → ortonormalna baza dysku {right,up,normal}.
  // normal bazowy = kierunek na galaktykę (raDecToSceneDir); roll obraca right/up
  // wokół tego kierunku; tilt pochyla (up,normal) wokół osi right.
  function skyBasis(ra, dec, tilt, roll){
    var dir = norm(SkyMath.raDecToSceneDir(ra, dec));
    var upRef = Math.abs(dir.y) > 0.98 ? { x:1, y:0, z:0 } : { x:0, y:1, z:0 };
    var right0 = norm(cross(upRef, dir));
    var up0 = norm(cross(dir, right0));
    var cr = Math.cos(roll || 0), sr = Math.sin(roll || 0);
    var right1 = add(scale(right0, cr), scale(up0, sr));
    var up1 = add(scale(up0, cr), scale(right0, -sr));
    var ct = Math.cos(tilt || 0), st = Math.sin(tilt || 0);
    var normal = add(scale(dir, ct), scale(up1, -st));
    var up = add(scale(up1, ct), scale(dir, st));
    return { right: norm(right1), up: norm(up), normal: norm(normal) };
  }

  // local (dysk lokalny wokół (0,0,0)) → Float32Array world-zorientowana, WYŚRODKOWANA
  // w (0,0,0): p = x·right + y·up + z·normal. NIE dodaje center (robi solar.js).
  function placeOnSky(local, basis){
    var n = local.length, out = new Float32Array(n);
    var r = basis.right, u = basis.up, nrm = basis.normal;
    for (var i = 0; i < n; i += 3){
      var x = local[i], y = local[i+1], z = local[i+2];
      out[i]   = x*r.x + y*u.x + z*nrm.x;
      out[i+1] = x*r.y + y*u.y + z*nrm.y;
      out[i+2] = x*r.z + y*u.z + z*nrm.z;
    }
    return out;
  }

  function hexRGB(hex){ return { r:((hex >> 16) & 255)/255, g:((hex >> 8) & 255)/255, b:(hex & 255)/255 }; }

  // pseudo-gauss z wstrzykiwanego rng (bez Math.random): suma 4 uniformów, ~N(0, ~0.29)
  function gauss(rng){ return (rng() + rng() + rng() + rng() - 2) * 0.5; }

  // Główny generator kształtu (lokalna ramka). type: 'spiral' | 'irregular' | 'elliptical'.
  function spiralPoints(p, rng){
    var count = p.count | 0, pos = new Float32Array(count*3), col = new Float32Array(count*3);
    var cB = hexRGB(p.colBulge), cA = hexRGB(p.colArm);
    var size = p.size, thick = (p.thickness != null ? p.thickness : 0.06) * size;
    var type = p.type || 'spiral';
    var arms = p.arms || 2, pitch = p.pitch || 0.25, turns = (p.turns != null ? p.turns : 1);
    var bulge = (p.bulge != null ? p.bulge : 0.25);
    var rNorm = Math.exp(pitch * turns * TAU);          // normalizacja: r(t=1)=size
    for (var i = 0; i < count; i++){
      var x, y, z, c;
      if (type === 'spiral'){
        var u = rng();                                   // JEDNO losowanie partycji rdzeń/bar/ramię —
        if (u < bulge){                                  // dyscyplina strumienia RNG (spec §12): bar=0/absent
          x = gauss(rng)*size*0.22; y = gauss(rng)*size*0.22; z = gauss(rng)*thick; c = cB;   // → zero dodatkowych poborów, bit-w-bit stare galaktyki
        } else if (p.bar && u < bulge + p.bar){          // bar: wydłużona populacja centralna wzdłuż lokalnej osi x
          x = gauss(rng)*size*0.55; y = gauss(rng)*size*0.12; z = gauss(rng)*thick; c = cB;
        } else {                                         // ramię log-spiralne
          var arm = Math.floor(rng() * arms);
          var t = 0.1 + rng() * 0.9;                  // zaczyna od 10% długości ramienia — rdzeń (bulge) geometrycznie wypełnia centrum
          var off = arm * (TAU / arms);
          var theta = t * turns * TAU + off;
          var r = Math.min(size, size * Math.exp(pitch * (t * turns * TAU)) / rNorm);
          var jr = gauss(rng)*size*0.05, ja = gauss(rng)*0.18;
          x = Math.cos(theta + ja)*r + jr; y = Math.sin(theta + ja)*r + jr*0.5;
          z = gauss(rng)*thick; c = cA;
          if(p.dustLane){                                    // pas pyłowy: odrzuć punkt w loci wewnętrznej krawędzi
            if(r < size * 0.5 && rng() < p.dustLane){ x = 0; y = 0; z = 0; }
          }
        }
      } else if (type === 'irregular'){
        var clumps = p.clumps || 6, k = Math.floor(rng() * clumps);
        // deterministyczne środki klumpów z indeksu k (bez stanu): rozłożone po elipsoidzie
        var ang = (k / clumps) * TAU, rad = (0.3 + 0.6 * ((k * 0.618) % 1)) * size;
        var cx = Math.cos(ang)*rad, cy = Math.sin(ang)*rad*0.7, cz = (((k * 0.37) % 1) - 0.5)*thick*3; // thick liczone raz przed pętlą z p.thickness — wspólne dla wszystkich typów
        var sp = (p.clumpSpread != null ? p.clumpSpread : 0.5) * size * 0.4;
        x = cx + gauss(rng)*sp; y = cy + gauss(rng)*sp; z = cz + gauss(rng)*thick;
        c = (rng() < 0.5) ? cA : cB; // mieszanka 2 kolorów (młode niebieskie / starsze) — intencjonalne; irregular zużywa 1 rng WIĘCEJ niż spiral/elliptical
      } else {                                             // eliptyczny — gładka elipsoida Gaussa (bez ramion, bez rdzenia)
        var ea = (p.axes && p.axes.a) || 1, eb = (p.axes && p.axes.b) || 0.7, ec = (p.axes && p.axes.c) || 0.5;
        x = gauss(rng)*size*ea*0.5; y = gauss(rng)*size*eb*0.5; z = gauss(rng)*size*ec*0.5; c = cB;
      }
      pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z;
      var br = 0.75 + rng()*0.35; // br konsumuje rng dla KAŻDEGO typu (też irregular/elliptical) — spójny strumień losowości
      col[i*3] = Math.min(1, c.r*br); col[i*3+1] = Math.min(1, c.g*br); col[i*3+2] = Math.min(1, c.b*br);
    }
    if(p.blueEdge){                                          // krawędź natarcia: przesunięcie ku błękitowi punktów ramion
      for(var bi = 0; bi < count; bi++){
        var rbi = Math.hypot(pos[bi*3], pos[bi*3+1]) / size;
        if(rbi > bulge){
          var blueShift = p.blueEdge * Math.min(1, rbi);
          col[bi*3]   = Math.max(0, col[bi*3]   - blueShift * 0.25);
          col[bi*3+2] = Math.min(1, col[bi*3+2] + blueShift * 0.3);
        }
      }
    }
    if(p.hii){                                               // regiony HII: dodatkowe jasne różowe punkty wzdłuż ramion
      var hExtra = Math.floor(count * 0.05 * p.hii);
      var hPos = new Float32Array(count * 3 + hExtra * 3);
      var hCol = new Float32Array(count * 3 + hExtra * 3);
      hPos.set(pos); hCol.set(col);
      for(var hi = 0; hi < hExtra; hi++){
        var hArm  = Math.floor(rng() * arms);
        var ht    = 0.2 + rng() * 0.6;
        var hOff  = hArm * (TAU / arms);
        var hTh   = ht * turns * TAU + hOff;
        var hR    = Math.min(size, size * Math.exp(pitch * (ht * turns * TAU)) / rNorm);
        hPos[(count + hi) * 3]     = Math.cos(hTh) * hR;
        hPos[(count + hi) * 3 + 1] = Math.sin(hTh) * hR;
        hPos[(count + hi) * 3 + 2] = 0;
        hCol[(count + hi) * 3]     = 1.0;
        hCol[(count + hi) * 3 + 1] = 0.4;
        hCol[(count + hi) * 3 + 2] = 0.65;
      }
      pos = hPos; col = hCol; count = count + hExtra;
    }
    return { positions: pos, colors: col, count: count };
  }

  // De-projekcja pozycji obiektu (RA/Dec katalog) do lokalnej płaszczyzny dysku god-view.
  // On-disk (hii/nebula/starcloud/sn): rzut gnomoniczny + obrót o −pa + oś mniejsza /cos(incl).
  // Companion: czysty rzut (głębia l.o.s. nieznana).
  function landmarkDiskLocal(gal, obj){
    var D2R = Math.PI / 180;
    var a0 = gal.center.ra * D2R, d0 = gal.center.dec * D2R;
    var a  = obj.ra * D2R,        d  = obj.dec * D2R;
    var cosc = Math.sin(d0)*Math.sin(d) + Math.cos(d0)*Math.cos(d)*Math.cos(a - a0);
    // rzut gnomoniczny (radiany) → arcmin; ξ na wschód, η na północ
    var xi  = (Math.cos(d)*Math.sin(a - a0)) / cosc / D2R * 60;
    var eta = (Math.cos(d0)*Math.sin(d) - Math.sin(d0)*Math.cos(d)*Math.cos(a - a0)) / cosc / D2R * 60;
    var scale = gal.disk.size / gal.angRadiusArcmin;         // arcmin → jednostki god-view
    if(obj.kind === 'companion'){
      return { x: xi * scale, y: eta * scale, z: 0 };        // rzut bez de-projekcji (głębia l.o.s. nieznana)
    }
    var pa = gal.pa * D2R, incl = gal.incl * D2R;
    var maj =  xi * Math.sin(pa) + eta * Math.cos(pa);       // wzdłuż osi większej (niezmieniona)
    var min =  xi * Math.cos(pa) - eta * Math.sin(pa);       // wzdłuż osi mniejszej (skrócona)
    var minDeproj = min / Math.max(Math.cos(incl), 1e-3);
    return { x: minDeproj * scale, y: maj * scale, z: 0 };   // (x=oś mniejsza, y=oś większa) w płaszczyźnie dysku
  }

  // Deterministyczny punkt OSI ramienia (bez rng, bez jittera) — ta sama parametryzacja
  // log-spirali co chmura spiralPoints. Ramka LOKALNA dysku (centrum w (0,0,0)).
  // Reużywane przez anchory nazwanych ramion MW (spec §4.2 — anchory z równania, nie z katalogu).
  function armPoint(p, armIndex, t){
    var arms = p.arms || 2, pitch = p.pitch || 0.25, turns = (p.turns != null ? p.turns : 1);
    var rNorm = Math.exp(pitch * turns * TAU);
    var off = armIndex * (TAU / arms);
    var theta = t * turns * TAU + off;
    var r = Math.min(p.size, p.size * Math.exp(pitch * (t * turns * TAU)) / rNorm);
    return { x: Math.cos(theta) * r, y: Math.sin(theta) * r, z: 0 };
  }

  // Faza obrotu dysku [rad]: po obrocie o wynik oś ramienia armIndex przechodzi przez punkt
  // (rFrac·p.size, angRad) płaszczyzny dysku. Odwrotność r(t): t = 1 + ln(rFrac)/(pitch·turns·TAU).
  // Użycie (solar.js): phase0 = armPhase(disk, 0, rSun/size, π) → mw.points.rotation.set(-π/2, 0, phase0).
  function armPhase(p, armIndex, rFrac, angRad){
    var arms = p.arms || 2, pitch = p.pitch || 0.25, turns = (p.turns != null ? p.turns : 1);
    var t = 1 + Math.log(rFrac) / (pitch * turns * TAU);
    var off = armIndex * (TAU / arms);
    return angRad - (t * turns * TAU + off);
  }

  var api = { spiralPoints: spiralPoints, skyBasis: skyBasis, placeOnSky: placeOnSky, hexRGB: hexRGB,
              armPoint: armPoint, armPhase: armPhase, landmarkDiskLocal: landmarkDiskLocal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GalaxyShape = api;
})(typeof self !== 'undefined' ? self : this);
