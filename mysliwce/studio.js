'use strict';
/* Zakładka Myśliwce — studio sceny (plik przeglądarkowy, THREE r128): tło, mgła, env do odbić, posadzka hangaru,
   światła. Wspólne dla makiety (widok.js) i hangaru (Task 9).
   MysliwceStudio.zbuduj(THREE, renderer, { cienie }) → { scena, env (WebGLRenderTarget PMREM; tekstura: env.texture),
     posadzka, swiatla, klucz, reflektor, cienie(wl), dopasujCien(promien), zwolnij() }
   Oświetlenie: mocny klucz z cieniem (rzeźbi fasetki), słaba zimna kontra tylko jako obrys sylwetki, przygaszony
   reflektor nad obrotnicą (plama na posadzce + cień pod maszyną), półsfera (niebo = ziemia) jako równe wypełnienie cienia. Bez wypełnienia —
   ciemne strony mają zostać ciemne. */
(function (root) {
  function plotno(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function teksturaTla(T) {
    var c = plotno(16, 512), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#05070b'); g.addColorStop(0.45, '#0e141c'); g.addColorStop(0.62, '#141a21'); g.addColorStop(0.8, '#0a0d11'); g.addColorStop(1, '#050608');
    x.fillStyle = g; x.fillRect(0, 0, 16, 512);
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }
  function teksturyPosadzki(T) {
    var N = 2048, c = plotno(N, N), x = c.getContext('2d'), R = 30, s = N / (2 * R), i;
    x.fillStyle = 'rgb(150,152,155)'; x.fillRect(0, 0, N, N);
    for (i = 0; i < 2600; i++) { var v = 140 + Math.floor(Math.random() * 24); x.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 2) + ',0.35)'; x.fillRect(Math.random() * N, Math.random() * N, 6 + Math.random() * 40, 6 + Math.random() * 40); }
    x.strokeStyle = 'rgba(40,42,46,0.85)'; x.lineWidth = 3;                       // dylatacje płyt betonu co 5 m
    for (var m = -R; m <= R; m += 5) { x.beginPath(); x.moveTo((m + R) * s, 0); x.lineTo((m + R) * s, N); x.stroke(); x.beginPath(); x.moveTo(0, (m + R) * s); x.lineTo(N, (m + R) * s); x.stroke(); }
    x.strokeStyle = 'rgba(235,240,245,0.55)'; x.lineWidth = 3;                    // obrotnica: okręgi i podziałka
    [7, 11.5, 15].forEach(function (r) { x.beginPath(); x.arc(N / 2, N / 2, r * s, 0, Math.PI * 2); x.stroke(); });
    for (i = 0; i < 72; i++) {
      var a = i * Math.PI / 36, r0 = (i % 6 ? 14.4 : 13.6) * s, r1 = 15 * s;
      x.beginPath(); x.moveTo(N / 2 + Math.cos(a) * r0, N / 2 + Math.sin(a) * r0); x.lineTo(N / 2 + Math.cos(a) * r1, N / 2 + Math.sin(a) * r1); x.stroke();
    }
    x.strokeStyle = 'rgba(232,176,60,0.9)'; x.lineWidth = 10;                     // żółta linia kołowania
    x.beginPath(); x.moveTo(0, N / 2); x.lineTo(N, N / 2); x.stroke();
    var mapa = new T.CanvasTexture(c); mapa.encoding = T.sRGBEncoding; mapa.anisotropy = 8;
    var a2 = plotno(256, 256), y = a2.getContext('2d'), g = y.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, '#fff'); g.addColorStop(0.55, '#fff'); g.addColorStop(1, '#000');
    y.fillStyle = g; y.fillRect(0, 0, 256, 256);
    return { mapa: mapa, alfa: new T.CanvasTexture(a2) };
  }
  // Otoczenie do odbić (owiewka, metal): kopuła z gradientem + świetlówki hangaru i softboxy → PMREM.
  // Shader kopuły koduje wyjście (linearToOutputTexel): cel PMREM jest RGBE, surowe gl_FragColor dawało wykładnik ~127.
  function zbudujEnv(T, renderer) {
    var s = new T.Scene(), rzeczy = [];
    var kopula = new T.Mesh(new T.SphereGeometry(40, 32, 16), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vP; void main(){ float y = vP.y; vec3 g = vec3(0.07, 0.09, 0.13), h = vec3(0.30, 0.27, 0.24), d = vec3(0.025, 0.025, 0.03);' +
        ' vec3 c = y > 0.0 ? mix(h, g, pow(y, 0.5)) : mix(h, d, pow(-y, 0.3)); gl_FragColor = linearToOutputTexel(vec4(c, 1.0)); }' }));
    s.add(kopula); rzeczy.push(kopula);
    function panel(w, h, p, kolor, moc) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(kolor).multiplyScalar(moc), side: T.DoubleSide }));
      m.position.set(p[0], p[1], p[2]); m.lookAt(0, 0, 0); s.add(m); rzeczy.push(m);
    }
    [-9, 0, 9].forEach(function (z) { panel(34, 1.2, [0, 20, z], '#f4f7ff', 6); });
    panel(12, 7, [24, 7, 14], '#ffd8ae', 3.2);
    panel(14, 6, [-22, 6, -16], '#9cc6ff', 2.6);
    panel(40, 3, [0, 1.5, 30], '#2b3542', 1.2);
    var pm = new T.PMREMGenerator(renderer), rt = pm.fromScene(s, 0.035);
    pm.dispose();
    rzeczy.forEach(function (o) { o.geometry.dispose(); o.material.dispose(); });
    return rt;
  }

  function zbuduj(T, renderer, opcje) {
    opcje = opcje || {};
    var scena = new T.Scene(), tlo = teksturaTla(T);
    scena.background = tlo;
    scena.fog = new T.Fog(0x0d1218, 45, 110);
    var env = zbudujEnv(T, renderer);
    // Wypełnienie jednakowe we wszystkich kierunkach (niebo = ziemia): podnosi cień, nie rozjaśniając górnych płaszczyzn
    // bardziej niż boków. Pomiar (zbliżenie usterzenia F-35): cień ~60–62 sRGB przy oświetlonym ~109–116;
    // góra kadłuba F-35 w kadrze startowym ~117 (env RAM 0,18 w makieta.js). Bez kierunkowego wypełnienia.
    scena.add(new T.HemisphereLight(0xc2c8cf, 0xc2c8cf, 0.9));
    var klucz = new T.DirectionalLight(0xffe4c4, 1.6);
    klucz.position.set(9, 16, 11);
    klucz.shadow.mapSize.set(2048, 2048); klucz.shadow.bias = -0.0004; klucz.shadow.normalBias = 0.03;
    var sk = klucz.shadow.camera; sk.left = sk.bottom = -16; sk.right = sk.top = 16; sk.near = 1; sk.far = 60;
    var kontra = new T.DirectionalLight(0x86b6ff, 0.35); kontra.position.set(-12, 7, -9);
    var reflektor = new T.SpotLight(0xdfe8ff, 0.4, 70, 0.5, 0.8, 1.2); reflektor.position.set(0, 30, 2);
    reflektor.shadow.mapSize.set(1024, 1024); reflektor.shadow.bias = -0.0006;
    reflektor.shadow.camera.near = 10; reflektor.shadow.camera.far = 40;
    var swiatla = [klucz, kontra, reflektor];
    swiatla.forEach(function (s) { scena.add(s); if (s.target) scena.add(s.target); });
    var tp = teksturyPosadzki(T);
    var posadzka = new T.Mesh(new T.CircleGeometry(30, 96), new T.MeshStandardMaterial({ color: new T.Color(0x6b6d70).convertSRGBToLinear(),
      roughness: 0.88, metalness: 0, map: tp.mapa, alphaMap: tp.alfa, transparent: true, envMap: env.texture, envMapIntensity: 0.2 }));
    posadzka.rotation.x = -Math.PI / 2; posadzka.receiveShadow = true; posadzka.name = 'posadzka';
    scena.add(posadzka);
    var studio = {
      scena: scena, env: env, posadzka: posadzka, swiatla: swiatla, klucz: klucz, reflektor: reflektor,
      cienie: function (wl) { klucz.castShadow = !!wl; reflektor.castShadow = !!wl; },
      // obszar cienia klucza dopasowany do maszyny (promień obwiedni w metrach)
      dopasujCien: function (m) { sk.left = sk.bottom = -m; sk.right = sk.top = m; sk.updateProjectionMatrix(); },
      zwolnij: function () {
        posadzka.geometry.dispose(); tp.mapa.dispose(); tp.alfa.dispose(); posadzka.material.dispose();
        tlo.dispose(); env.dispose();
        swiatla.forEach(function (s) { if (s.shadow && s.shadow.map) { s.shadow.map.dispose(); s.shadow.map = null; } });
      },
    };
    studio.cienie(opcje.cienie !== false);
    return studio;
  }

  root.MysliwceStudio = { zbuduj: zbuduj };
})(typeof window !== 'undefined' ? window : globalThis);
