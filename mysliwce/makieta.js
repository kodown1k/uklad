'use strict';
/* Zakładka Myśliwce — makieta 3D maszyny: THREE.Group z wyjścia mysliwce/platowiec.js (plik przeglądarkowy, THREE r128).
   Makieta.zbuduj(THREE, id, { lod, env, anizotropia }) →
     { id, grupa, czesci: { [rodzaj]: Object3D (userData.czesc = Czesc z czesci.js, userData.kotwica = Vector3 w układzie
       części) }, dysze: Object3D[] (środek wylotu, lokalna oś −x = kierunek strumienia; userData { szer, wys, typ }),
       wyloty: [{ punkt, kierunek, szer, wys, typ }] (z platowiec.js, układ części `dysze` — dla Ogien.utworz z rodzicem czesci.dysze),
       obwiednia: { min, max } [m], bryla (wynik Platowiec.zbuduj — kotwice dla Pokaz.plan), rozloz(u), komory(u), plan(wl),
       podswietl(rodzaj|null), aktualizuj(czas), zwolnij() }
   Materiały: matowy RAM (neutralny ciemnoszary — kolor państwa to akcent UI i tabliczek, nie lakieru; efektywna
   szorstkość ~0,75 z tekstury), owiewka złocista
   półprzezroczysta z odbiciem (env z PMREM sceny proceduralnej — podaje widok), metal dysz i podwozia, ciemny kanał
   wlotu, jasne wnętrza komór, guma. Linie paneli, ząbkowane krawędzie drzwiczek i nity — tekstura canvas na UV
   z platowiec.js przeskalowanych do metrów (stała gęstość tekstury na każdej siatce). Maszyny `niesfotografowany`
   dostają nakładkę hologramu (siatka + skan + fresnel): uczciwość co do tego, ile o nich wiadomo.
   Podświetlenie części: fresnel/emisja przez onBeforeCompile (jedna funkcja = jeden program na wszystkie klony).
   „Plan” (rentgen): krawędzie EdgesGeometry na półprzezroczystych bryłach. Rekonstrukcja, nie rysunek techniczny. */
(function (root) {
  var KAFEL = 4;                    // [m] — tyle płatowca obejmuje jeden kafel tekstury paneli
  var PX = 1024;
  var KOLOR_PODSW = 0x22b4ff;

  function generator(ziarno) {      // mulberry32 — deterministyczny wygląd paneli
    var a = ziarno >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ziarnoZ(tekst) { var h = 2166136261; for (var i = 0; i < tekst.length; i++) { h ^= tekst.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---------- tekstury paneli (canvas, kafel bezszwowy) ---------- */
  // Trzy płótna z jednego układu paneli: kolor (ton per panel ±6%, linie 7 tekseli, nity, drzwiczki z ząbkami),
  // szorstkość (per panel ±0,08 wokół 0,75; taśma wokół drzwiczek gładsza) i wysokość (rowki linii, wgłębienia nitów)
  // → mapa normalnych liczona Sobelem. Linie mają ≥ 6 tekseli, żeby przeżyły mipmapy (detal nie ginie poniżej piksela).
  function plotno() { var c = document.createElement('canvas'); c.width = c.height = PX; return c; }
  function maluj(los, opcjeKafla) {
    var drzwi = opcjeKafla && opcjeKafla.drzwi === 0 ? 0 : 1;
    var A = plotno(), B = plotno(), H = plotno(), a = A.getContext('2d'), b = B.getContext('2d'), h = H.getContext('2d'), N = PX;
    // rysunek powtórzony w 9 przesunięciach = kafel bez szwu
    function wkolo(fn) { for (var dx = -N; dx <= N; dx += N) for (var dy = -N; dy <= N; dy += N) fn(dx, dy); }
    var szary = function (v, al) { v = Math.max(0, Math.min(255, Math.round(v))); return 'rgba(' + v + ',' + v + ',' + v + ',' + (al == null ? 1 : al) + ')'; };
    a.fillStyle = szary(236); a.fillRect(0, 0, N, N);
    b.fillStyle = szary(191); b.fillRect(0, 0, N, N);          // 191/255 ≈ 0,75 — szorstkość matowego RAM
    h.fillStyle = szary(170); h.fillRect(0, 0, N, N);
    // układ paneli: rzędy dzielą kafel w pionie, w każdym rzędzie panele dzielą obwód w poziomie
    var rzedy = [], y0 = 0;
    while (y0 < N - 60) { rzedy.push(y0); y0 += 110 + los() * 200; }
    var linie = [], panele = [];
    rzedy.forEach(function (yr, k) {
      var yn = k + 1 < rzedy.length ? rzedy[k + 1] : N, x = los() * N, kon = x + N, xs = [];
      linie.push([0, yr, N, yr]);
      while (x < kon - 60) { xs.push(x); x += 130 + los() * 260; }
      xs.forEach(function (xa, i) {
        var xb = i + 1 < xs.length ? xs[i + 1] : xs[0] + N;
        linie.push([xa % N, yr, xa % N, yn]);
        panele.push([xa, yr, xb - xa, yn - yr]);
      });
    });
    // ton i szorstkość per panel
    panele.forEach(function (q) {
      var ton = 236 * (1 + (los() - 0.5) * 0.12), sz = 191 + (los() - 0.5) * 41;
      wkolo(function (dx, dy) { a.fillStyle = szary(ton); a.fillRect(q[0] + dx, q[1] + dy, q[2], q[3]); b.fillStyle = szary(sz); b.fillRect(q[0] + dx, q[1] + dy, q[2], q[3]); });
    });
    // łaty RAM (naprawy, kit): lekko inny odcień i połysk wewnątrz paneli
    for (var i = 0; i < 70; i++) {
      var x = los() * N, y = los() * N, w = 30 + los() * 160, hh = 20 + los() * 110, v = 236 + (los() - 0.5) * 24, r = 191 + (los() - 0.55) * 50;
      wkolo(function (dx, dy) { a.fillStyle = szary(v, 0.4); a.fillRect(x + dx, y + dy, w, hh); b.fillStyle = szary(r, 0.45); b.fillRect(x + dx, y + dy, w, hh); });
    }
    function kreska(ctx, styl, szer, l) {
      ctx.strokeStyle = styl; ctx.lineWidth = szer; ctx.lineCap = 'butt';
      wkolo(function (dx, dy) { ctx.beginPath(); ctx.moveTo(l[0] + dx, l[1] + dy); ctx.lineTo(l[2] + dx, l[3] + dy); ctx.stroke(); });
    }
    linie.forEach(function (l) { kreska(a, szary(172), 7, l); kreska(b, szary(232), 7, l); kreska(h, szary(70), 7, l); });
    // nity wzdłuż części linii
    linie.forEach(function (l) {
      if (los() < 0.45) return;
      var dl = Math.hypot(l[2] - l[0], l[3] - l[1]), n = Math.floor(dl / 22), o = 12, poz = l[1] === l[3];
      for (var j = 1; j < n; j++) {
        var t = j / n, px = l[0] + (l[2] - l[0]) * t + (poz ? 0 : o), py = l[1] + (l[3] - l[1]) * t + (poz ? o : 0);
        wkolo(function (dx, dy) {
          a.fillStyle = szary(208); a.beginPath(); a.arc(px + dx, py + dy, 2.6, 0, 6.2832); a.fill();
          h.fillStyle = szary(120); h.beginPath(); h.arc(px + dx, py + dy, 2.6, 0, 6.2832); h.fill();
        });
      }
    });
    // drzwiczki serwisowe z ząbkowanymi krawędziami (znak rozpoznawczy płatowców stealth): najwyżej jedne na kafel,
    // wpisane w istniejący panel (wcięcie 10 px). Ząbki tylko na przedniej i tylnej krawędzi panelu (poprzecznych do
    // osi kadłuba). Sprawdzone zrzutem w fałszywych kolorach: na kadłubie oś długości to oś y płótna (x = obwód), więc
    // ząbkowane są krawędzie poziome. Podziałka ~30 px, amplituda 0,55 podziałki (boki zębów ~±48° do krawędzi).
    // Rowek 6 px w kolorze i wysokości; taśma RAM tylko w mapie szorstkości (18 px, 150/255), w kolorze ≤ 4/255.
    var kandydaci = panele.filter(function (q) { return q[2] >= 150 && q[3] >= 110; });
    if (drzwi && kandydaci.length) {
      var q = kandydaci[Math.floor(los() * kandydaci.length)], P = 28 + los() * 4, Az = 0.55 * P;
      var nzb = Math.max(2, Math.floor((q[2] - 20) / P)), x0 = q[0] + 10, y0d = q[1] + 10, y1d = q[1] + q[3] - 10, pts = [], j;
      for (j = 0; j <= nzb * 2; j++) pts.push([x0 + j * P / 2, y0d + (j % 2 ? Az : 0)]);          // przód: zęby do środka
      for (j = nzb * 2; j >= 0; j--) pts.push([x0 + j * P / 2, y1d - (j % 2 ? Az : 0)]);          // tył
      var obrys = function (ctx, styl, szer) {
        ctx.strokeStyle = styl; ctx.lineWidth = szer; ctx.lineJoin = 'miter'; ctx.miterLimit = 4;
        wkolo(function (dx, dy) { ctx.beginPath(); pts.forEach(function (p, k) { if (k) ctx.lineTo(p[0] + dx, p[1] + dy); else ctx.moveTo(p[0] + dx, p[1] + dy); }); ctx.closePath(); ctx.stroke(); });
      };
      obrys(b, szary(150), 18);      // taśma/kit — gładsza niż RAM
      obrys(a, 'rgba(255,255,255,0.016)', 18);   // ≤ 4/255 jaśniej
      obrys(a, szary(172), 6);       // rowek
      obrys(b, szary(232), 6);
      obrys(h, szary(70), 6);
    }
    // drobny szum (ziarno powłoki)
    var img = a.getImageData(0, 0, N, N), px2 = img.data;
    for (var k = 0; k < px2.length; k += 4) { var sz2 = (los() - 0.5) * 6; px2[k] += sz2; px2[k + 1] += sz2; px2[k + 2] += sz2; }
    a.putImageData(img, 0, 0);
    return { kolor: A, szorstkosc: B, normalne: normalneSobel(H) };
  }
  // Mapa normalnych z płótna wysokości (Sobel, zawijanie na brzegach kafla). Płótno ma y w dół, tekstura v w górę
  // (flipY), stąd znak składowej y. Wynik zapisany w tym samym płótnie.
  function normalneSobel(H) {
    var N = PX, ctx = H.getContext('2d');
    ctx.filter = 'blur(1.5px)'; ctx.drawImage(H, 0, 0); ctx.filter = 'none';      // łagodne zbocza rowków
    var src = ctx.getImageData(0, 0, N, N).data, out = ctx.createImageData(N, N), o = out.data, K = 2.2;
    var hgt = function (x, y) { return src[(((y + N) % N) * N + ((x + N) % N)) * 4] / 255; };
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var gx = (hgt(x + 1, y - 1) + 2 * hgt(x + 1, y) + hgt(x + 1, y + 1)) - (hgt(x - 1, y - 1) + 2 * hgt(x - 1, y) + hgt(x - 1, y + 1));
        var gy = (hgt(x - 1, y + 1) + 2 * hgt(x, y + 1) + hgt(x + 1, y + 1)) - (hgt(x - 1, y - 1) + 2 * hgt(x, y - 1) + hgt(x + 1, y - 1));
        var nx = -gx * K, ny = gy * K, l = 1 / Math.sqrt(nx * nx + ny * ny + 1), i = (y * N + x) * 4;
        o[i] = (nx * l * 0.5 + 0.5) * 255; o[i + 1] = (ny * l * 0.5 + 0.5) * 255; o[i + 2] = (l * 0.5 + 0.5) * 255; o[i + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    return H;
  }

  /* ---------- geometria ---------- */
  // UV z platowiec.js są w ułamkach siatki (stacja, faseta); przeskalowanie do metrów/KAFEL daje stałą gęstość
  // paneli. Skala liczona PER WIERZCHOŁEK = średnia (ważona polem) długości kolumn jakobianu UV→świat trójkątów,
  // które go używają — czapki i małe dodatki (garb DSI, czujniki) mają własne wierzchołki i własną skalę, więc
  // tekstura nie ściska się na nich w prążki (skala wspólna dla całej siatki tak robiła).
  function uvWMetrach(poz, ind, uv, przes) {
    var n = uv.length / 2, su = new Float64Array(n), sv = new Float64Array(n), w = new Float64Array(n), t, k;
    for (t = 0; t < ind.length; t += 3) {
      var a = ind[t], b = ind[t + 1], c = ind[t + 2];
      var e1x = poz[b * 3] - poz[a * 3], e1y = poz[b * 3 + 1] - poz[a * 3 + 1], e1z = poz[b * 3 + 2] - poz[a * 3 + 2];
      var e2x = poz[c * 3] - poz[a * 3], e2y = poz[c * 3 + 1] - poz[a * 3 + 1], e2z = poz[c * 3 + 2] - poz[a * 3 + 2];
      var d1u = uv[b * 2] - uv[a * 2], d1v = uv[b * 2 + 1] - uv[a * 2 + 1], d2u = uv[c * 2] - uv[a * 2], d2v = uv[c * 2 + 1] - uv[a * 2 + 1];
      var det = d1u * d2v - d2u * d1v;
      if (Math.abs(det) < 1e-12) continue;
      var pole = 0.5 * Math.hypot(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x);
      var ju = Math.hypot(e1x * d2v - e2x * d1v, e1y * d2v - e2y * d1v, e1z * d2v - e2z * d1v) / Math.abs(det);
      var jv = Math.hypot(e2x * d1u - e1x * d2u, e2y * d1u - e1y * d2u, e2z * d1u - e1z * d2u) / Math.abs(det);
      if (!isFinite(ju) || !isFinite(jv) || !(pole > 0)) continue;
      [a, b, c].forEach(function (v) { su[v] += ju * pole; sv[v] += jv * pole; w[v] += pole; });
    }
    var out = new Float32Array(uv.length);
    for (k = 0; k < n; k++) {
      if (w[k] > 0) {
        out[k * 2] = uv[k * 2] * su[k] / w[k] / KAFEL + przes[0]; out[k * 2 + 1] = uv[k * 2 + 1] * sv[k] / w[k] / KAFEL + przes[1];
      } else {
        // wierzchołek tylko w trójkątach ze zdegenerowanym UV (np. garb DSI: cała podstawa w jednym punkcie UV) —
        // rzut płaski z położenia; płaszczyzna wg osi o najmniejszym rozrzucie nie jest znana per wierzchołek,
        // więc rzut boczny (x, y+z): na małych bryłach daje równe linie zamiast koncentrycznych prążków
        out[k * 2] = poz[k * 3] / KAFEL + przes[0]; out[k * 2 + 1] = (poz[k * 3 + 1] + poz[k * 3 + 2]) / KAFEL + przes[1];
      }
    }
    return out;
  }
  function geometria(T, s, los) {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(s.pozycje, 3));
    g.setAttribute('uv', new T.BufferAttribute(uvWMetrach(s.pozycje, s.indeksy, s.uv, [los(), los()]), 2));
    g.setIndex(new T.BufferAttribute(s.indeksy, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
  // Płaty (plyta w platowiec.js): pierwsza współrzędna oryginalnego UV = stacja wzdłuż rozpiętości (0 nasada, 1 koniec),
  // druga = indeks punktu profilu na obwodzie (góra od krawędzi natarcia do spływu, potem dół z powrotem), czyli NIE
  // jest wprost ułamkiem cięciwy. Ułamek cięciwy liczę więc z położenia: dla każdej stacji (ta sama pierwsza
  // współrzędna — także w lustrzanej połówce) krawędź natarcia = max x, spływu = min x (nos to +x).
  // Wynik: atrybut uvPlat = (s rozpiętości, c cięciwy) dla znaków płata w shaderze (pas natarcia, zawiasy sterów).
  function uvPlata(poz, uv) {
    var n = uv.length / 2, zakres = {}, k, klucz;
    for (k = 0; k < n; k++) {
      klucz = uv[k * 2].toFixed(5);
      var z = zakres[klucz] || (zakres[klucz] = [Infinity, -Infinity]), x = poz[k * 3];
      if (x < z[0]) z[0] = x; if (x > z[1]) z[1] = x;
    }
    var out = new Float32Array(uv.length);
    for (k = 0; k < n; k++) {
      var zk = zakres[uv[k * 2].toFixed(5)], cs = zk[1] - zk[0];
      out[k * 2] = uv[k * 2];
      out[k * 2 + 1] = cs > 1e-4 ? (zk[1] - poz[k * 3]) / cs : 0;
    }
    return out;
  }
  // Wygładzone normalne (owiewka z loftu z ostrymi fasetami dawała pasy w odbiciu): uśrednienie normalnych
  // wierzchołków o tym samym położeniu. Liczone tutaj — platowiec.js (i hash jego wyniku) bez zmian.
  function wygladzNormalne(g) {
    var p = g.attributes.position.array, nr = g.attributes.normal.array, suma = {}, k, key;
    var klucz = function (i) { return Math.round(p[i] * 1e4) + ',' + Math.round(p[i + 1] * 1e4) + ',' + Math.round(p[i + 2] * 1e4); };
    for (k = 0; k < p.length; k += 3) {
      key = klucz(k);
      var sm = suma[key] || (suma[key] = [0, 0, 0]);
      sm[0] += nr[k]; sm[1] += nr[k + 1]; sm[2] += nr[k + 2];
    }
    for (k = 0; k < p.length; k += 3) {
      var v = suma[klucz(k)], l = Math.hypot(v[0], v[1], v[2]) || 1;
      nr[k] = v[0] / l; nr[k + 1] = v[1] / l; nr[k + 2] = v[2] / l;
    }
    g.attributes.normal.needsUpdate = true;
  }
  // Dysza: przebarwienie temperaturowe ku wylotowi (słoma → brąz → fiolet/granat → okopcona krawędź), kolor wierzchołków.
  function koloryDyszy(T, g) {
    var p = g.attributes.position.array, n = p.length / 3, xmin = Infinity, xmax = -Infinity, k;
    for (k = 0; k < n; k++) { xmin = Math.min(xmin, p[k * 3]); xmax = Math.max(xmax, p[k * 3]); }
    var stopnie = [[0, [1, 1, 1]], [0.45, [1, 0.97, 0.9]], [0.68, [1.08, 0.86, 0.6]], [0.86, [0.66, 0.6, 0.9]], [1, [0.42, 0.4, 0.46]]];
    var kol = new Float32Array(n * 3);
    for (k = 0; k < n; k++) {
      var t = xmax > xmin ? (xmax - p[k * 3]) / (xmax - xmin) : 0, j = 1;
      while (j < stopnie.length - 1 && stopnie[j][0] < t) j++;
      var a = stopnie[j - 1], b = stopnie[j], u = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
      for (var c = 0; c < 3; c++) kol[k * 3 + c] = a[1][c] + (b[1][c] - a[1][c]) * u;
    }
    g.setAttribute('color', new T.BufferAttribute(kol, 3));
  }

  /* ---------- materiały ---------- */
  // Jedna wspólna łatka (onBeforeCompile; ta sama funkcja = ten sam klucz programu, różnice przez `defines`):
  //   zawsze — podświetlenie części (fresnel + emisja), uniformy w userData materiału;
  //   PLAT=1|2|3 — znaki płata z uvPlat: pas krawędzi natarcia (ciemniejszy, gładszy), linie zawiasów sterów i obrysy
  //     klapolotek/lotek (1 skrzydło), sterów kierunku/wysokości (2 usterzenie), sam pas natarcia (3 kaczka, LEVCON);
  //     linie stałej szerokości ekranowej (fwidth), więc widać je z każdej odległości;
  //   SZKLO — owiewka: dielektryk, alfa z fresnela (środek ~0,25, krawędź ~0,9), złoto tylko w odbiciu (powłoka ITO).
  var GLSL_PLAT = [
    'varying vec2 vPlat;',
    'float liniaPl(float x, float at) { float d = abs(x - at) / max(fwidth(x), 1e-5); return 1.0 - smoothstep(0.8, 1.9, d); }',
    'float wPasie(float x, float a, float b) { return step(a, x) * step(x, b); }',
    'void znakiPlata(vec2 p, out float le, out float lin) {',
    '  float s = p.x, c = p.y, wc = max(fwidth(c), 1e-5);',
    '  le = 1.0 - smoothstep(0.032 - wc, 0.032 + wc, c);',
    '  lin = liniaPl(c, 0.032) * 0.7;',
    '#if PLAT == 1',
    '  lin = max(lin, liniaPl(c, 0.74) * wPasie(s, 0.10, 0.93));',
    '  lin = max(lin, max(max(liniaPl(s, 0.10), liniaPl(s, 0.535)), liniaPl(s, 0.93)) * step(0.74, c));',
    '#elif PLAT == 2',
    '  lin = max(lin, liniaPl(c, 0.70) * wPasie(s, 0.08, 0.86));',
    '  lin = max(lin, max(liniaPl(s, 0.08), liniaPl(s, 0.86)) * step(0.70, c));',
    '#endif',
    '}'].join('\n');
  function latka(shader) {
    shader.uniforms.uPods = this.userData.uPods;
    shader.uniforms.uKolorPods = this.userData.uKolorPods;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n#ifdef PLAT\nattribute vec2 uvPlat;\nvarying vec2 vPlat;\n#endif')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef PLAT\n  vPlat = uvPlat;\n#endif');
    shader.fragmentShader = 'uniform float uPods;\nuniform vec3 uKolorPods;\n#ifdef PLAT\n' + GLSL_PLAT + '\n#endif\n' + shader.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef PLAT\n  float plLe, plLin;\n  znakiPlata(vPlat, plLe, plLin);\n' +
        '  diffuseColor.rgb *= mix(1.0, 0.74, plLe) * (1.0 - 0.62 * plLin);\n#endif')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n#ifdef PLAT\n' +
        '  roughnessFactor = mix(roughnessFactor, 0.42, plLe);\n  roughnessFactor = min(1.0, roughnessFactor + 0.12 * plLin);\n#endif')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' +
        '  float frPods = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.2);\n' +
        '  totalEmissiveRadiance += uKolorPods * uPods * (0.1 + 1.1 * frPods);\n' +
        '#ifdef SZKLO\n  diffuseColor.a = mix(0.3, 0.92, pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.5));\n#endif')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n#ifdef SZKLO\n' +
        '  reflectedLight.indirectSpecular *= vec3(1.0, 0.8, 0.45) * 1.5;\n  reflectedLight.directSpecular *= vec3(1.0, 0.8, 0.45) * 1.5;\n#endif');
  }
  function zLatka(T, m) {
    m.userData.uPods = { value: 0 };
    m.userData.uKolorPods = { value: new T.Color(KOLOR_PODSW) };
    m.extensions = { derivatives: true };
    m.onBeforeCompile = latka;
    return m;
  }

  var HOLO_W = 'varying vec3 vN; varying vec3 vV; varying vec3 vL;\n' +
    'void main(){ vL = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }';
  var HOLO_F = 'uniform float uCzas; uniform vec3 uKolor; uniform float uSila;\n' +
    'varying vec3 vN; varying vec3 vV; varying vec3 vL;\n' +
    'float linia(float x){ float f = abs(fract(x - 0.5) - 0.5) / max(fwidth(x), 1e-4); return 1.0 - min(f, 1.0); }\n' +
    'void main(){\n' +
    '  float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);\n' +
    '  float siatka = max(linia(vL.x * 1.25), linia(vL.z * 1.25));\n' +
    '  float skan = 0.5 + 0.5 * sin(vL.y * 140.0 + uCzas * 3.0);\n' +
    '  float pas = exp(-pow((fract(uCzas * 0.09) * 32.0 - 16.0 - vL.x) * 0.55, 2.0));\n' +
    '  float a = (0.03 + 0.55 * fr + 0.30 * siatka + 0.05 * skan + 0.45 * pas) * uSila;\n' +
    '  gl_FragColor = vec4(uKolor * a, a);\n' +
    '}';

  function materialy(T, opcje, tex, niesf) {
    var env = opcje.env || null;
    // kolory w sRGB → liniowe (renderer wyprowadza sRGB): to, co wpisane, to, co widać przy świetle 1
    var lin = function (k) { return new T.Color(k).convertSRGBToLinear(); };
    var ram = new T.Color('#474c53');                    // bez odcienia kraju (Chiny wychodziły khaki; J-20 jest ciemnoszary)
    if (niesf) ram.lerp(new T.Color('#3a6170'), 0.35);
    ram.convertSRGBToLinear();
    var ramMat = function (rodzajPlata) {
      var t = rodzajPlata ? tex.plat : tex;
      var m = new T.MeshStandardMaterial({ color: ram, roughness: 1, metalness: 0.05, map: t.kolor, roughnessMap: t.szorstkosc,
        normalMap: t.normalne, normalScale: new T.Vector2(0.65, 0.65), envMap: env, envMapIntensity: 0.18 });   // env głównie z góry (świetlówki) — nisko, żeby nie spłaszczać
      if (rodzajPlata) m.defines = { PLAT: rodzajPlata };
      return m;
    };
    return {
      ram: function () { return ramMat(0); },
      ramPlat1: function () { return ramMat(1); },
      ramPlat2: function () { return ramMat(2); },
      ramPlat3: function () { return ramMat(3); },
      // owiewka: przydymiony dielektryk; przezroczystość i złoty odblask robi łatka (SZKLO)
      szklo: function () {
        var m = new T.MeshStandardMaterial({ color: lin(0x0d0f12), roughness: 0.03, metalness: 0.1, envMap: env, envMapIntensity: 3,
          transparent: true, depthWrite: false });
        m.defines = { SZKLO: '' };
        return m;
      },
      metal: function () {
        return new T.MeshStandardMaterial({ color: lin(0x8a847c), roughness: 0.42, metalness: 0.88, roughnessMap: tex.szorstkosc, envMap: env, envMapIntensity: 1.1 });
      },
      // dysze: ciemny tytan/ceramika z przebarwieniem temperaturowym (kolor wierzchołków)
      dysza: function () {
        return new T.MeshStandardMaterial({ color: lin(0x3a3835), roughness: 0.7, metalness: 0.7, vertexColors: true,
          envMap: env, envMapIntensity: 0.45 });
      },
      kanal: function () { return new T.MeshStandardMaterial({ color: lin(0x15171a), roughness: 0.92, metalness: 0, side: T.DoubleSide }); },
      wnetrze: function () {
        return new T.MeshStandardMaterial({ color: lin(0xb8bdb6), roughness: 0.65, metalness: 0.05, map: tex.kolor, envMap: env, envMapIntensity: 0.5, side: T.DoubleSide });
      },
      opona: function () { return new T.MeshStandardMaterial({ color: lin(0x1f1f20), roughness: 0.9, metalness: 0, envMap: env, envMapIntensity: 0.3 }); },
      kokpit: function () { return new T.MeshStandardMaterial({ color: lin(0x24272b), roughness: 0.8, metalness: 0.1, envMap: env, envMapIntensity: 0.3 }); },
      fotel: function () { return new T.MeshStandardMaterial({ color: lin(0x262624), roughness: 0.85, metalness: 0, envMap: env, envMapIntensity: 0.3 }); },
      mfd: function () { return new T.MeshStandardMaterial({ color: lin(0x0b0f0d), emissive: lin(0x1f3a2c), emissiveIntensity: 0.3, roughness: 0.15, metalness: 0, envMap: env, envMapIntensity: 0.8 }); },
      uchwyt: function () { return new T.MeshStandardMaterial({ color: lin(0xd8b020), roughness: 0.6, metalness: 0.1, envMap: env, envMapIntensity: 0.4 }); },
    };
  }

  /* ---------- kokpit pod owiewką ---------- */
  // Prosta bryła wnętrza (wanna, fotel z zagłówkiem, konsole, tablica przyrządów z MFD) mieszcząca się w obrysie owiewki — przez
  // przezroczysty środek szyby widać kabinę, nie gołą burtę. Sylwetka maszyny bez zmian (wszystko pod szybą).
  function kokpit(T, gOwiewki, mat) {
    var p = gOwiewki.attributes.position.array, x0 = Infinity, x1 = -Infinity, y0 = Infinity, k;
    for (k = 0; k < p.length; k += 3) { x0 = Math.min(x0, p[k]); x1 = Math.max(x1, p[k]); y0 = Math.min(y0, p[k + 1]); }
    var L = x1 - x0;
    // przekrój owiewki przy x: półszerokość i wysokość szczytu (z wierzchołków w pasie ±4% długości)
    function przekroj(x) {
      var w = 0, yt = y0;
      for (var i = 0; i < p.length; i += 3) if (Math.abs(p[i] - x) < L * 0.04) { w = Math.max(w, Math.abs(p[i + 2])); yt = Math.max(yt, p[i + 1]); }
      return { w: w, h: yt - y0 };
    }
    var wynik = [];
    function siatka(geo, x, y, z, m, nazwa) {
      var b = new T.Mesh(geo, m);
      b.position.set(x, y, z); b.castShadow = false; b.receiveShadow = true; b.name = 'kokpit:' + nazwa;
      wynik.push(b); return b;
    }
    function klocek(dx, dy, dz, x, y, z, m, nazwa) { return siatka(new T.BoxGeometry(dx, dy, dz), x, y, z, m, nazwa); }
    // 10 siatek: wanna, oparcie, zagłówek (walec), siedzisko, uchwyt katapulty, 2 konsole boczne, tablica przyrządów, 2 MFD
    var xf = x0 + 0.32 * L, qf = przekroj(xf), xt = x0 + 0.62 * L, qt = przekroj(xt), xm = x0 + 0.5 * L, qm = przekroj(xm);
    if (!(qf.h > 0.05 && qf.w > 0.05)) return wynik;
    klocek(0.8 * L, 0.03, 1.5 * qm.w, xm, y0 + 0.015, 0, mat('kokpit'), 'wanna');
    var hOp = 0.58 * qf.h, pochyl = 0.22;
    klocek(0.05 * L, hOp, 0.9 * qf.w, xf, y0 + hOp / 2, 0, mat('fotel'), 'oparcie').rotation.z = pochyl;
    var rz = 0.12 * qf.h, zag = siatka(new T.CylinderGeometry(rz, rz, 0.6 * qf.w, 12), xf - Math.sin(pochyl) * hOp * 0.5, y0 + hOp + rz * 0.6, 0, mat('fotel'), 'zaglowek');
    zag.rotation.x = Math.PI / 2;
    klocek(0.14 * L, 0.1 * qf.h, 1.0 * qf.w, xf + 0.08 * L, y0 + 0.14 * qf.h, 0, mat('fotel'), 'siedzisko');
    klocek(0.03 * L, 0.07 * qf.h, 0.22 * qf.w, xf + 0.16 * L, y0 + 0.22 * qf.h, 0, mat('uchwyt'), 'uchwyt');
    [-1, 1].forEach(function (str) { klocek(0.25 * L, 0.12 * qf.h, 0.2 * qf.w, xf + 0.1 * L, y0 + 0.2 * qf.h, str * 0.6 * qf.w, mat('kokpit'), 'konsola'); });
    if (qt.h > 0.05) {
      var ht = 0.18 * qt.h, yt = y0 + 0.2 * qt.h + ht / 2;
      klocek(0.06 * L, ht, 1.3 * qt.w, xt, yt, 0, mat('kokpit'), 'tablica');
      [-1, 1].forEach(function (str) {                                   // dwa wyświetlacze na tylnej ścianie tablicy
        var mfd = siatka(new T.PlaneGeometry(0.35 * qt.w, 0.12 * qt.h), xt - 0.03 * L - 0.002, yt, str * 0.3 * qt.w, mat('mfd'), 'mfd');
        mfd.rotation.y = -Math.PI / 2;
      });
    }
    return wynik;
  }

  /* ---------- złożenie ---------- */
  function zbuduj(T, id, opcje) {
    opcje = opcje || {};
    var D = root.MysliwceDane, C = root.MysliwceCzesci, S = root.MysliwceSylwetki && root.MysliwceSylwetki.SYLWETKI;
    var dane = D && D.mysliwiec(id);
    if (!dane) throw new Error('Makieta: nieznana maszyna ' + id);
    if (!S || !S[id]) throw new Error('Makieta: brak sylwetki ' + id);
    var bryla = root.Platowiec.zbuduj(S[id], dane.wymiary, { lod: opcje.lod || 'pelny' });
    var los = generator(ziarnoZ(id));
    // dwa kafle: kadłub i reszta (z drzwiczkami) oraz płaty (bez drzwiczek — na skrzydle/stateczniku powtarzały się)
    var tekstury = function (plotna) {
      var t = { kolor: new T.CanvasTexture(plotna.kolor), szorstkosc: new T.CanvasTexture(plotna.szorstkosc), normalne: new T.CanvasTexture(plotna.normalne) };
      [t.kolor, t.szorstkosc, t.normalne].forEach(function (x) { x.wrapS = x.wrapT = T.RepeatWrapping; x.anisotropy = opcje.anizotropia || 4; });
      t.kolor.encoding = T.sRGBEncoding;           // szorstkość i normalne liniowe
      return t;
    };
    var tex = tekstury(maluj(los));
    tex.plat = tekstury(maluj(generator(ziarnoZ(id + '/plat')), { drzwi: 0 }));
    var niesf = !!dane.niesfotografowany;
    var fabryka = materialy(T, opcje, tex, niesf);
    var opisy = {};
    (C.CZESCI[id] || []).forEach(function (c) { opisy[c.rodzaj] = c; });

    var grupa = new T.Group(); grupa.name = 'makieta:' + id;
    var czesci = {}, dysze = [], pivoty = [], siatki = [], liniePlanu = null, planWl = false, podsw = null, kokpitGotowy = false;
    var holo = niesf ? new T.ShaderMaterial({ vertexShader: HOLO_W, fragmentShader: HOLO_F, transparent: true, depthWrite: false,
      blending: T.AdditiveBlending, extensions: { derivatives: true },
      uniforms: { uCzas: { value: 0 }, uKolor: { value: new T.Color(0x52e8ff) }, uSila: { value: 1 } } }) : null;
    var matPlanu = new T.MeshBasicMaterial({ color: 0x0b3350, transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide });
    var bezRaycastu = function () {};

    // fabryka 'xxx2' = ten sam materiał dwustronny (cienkie/otwarte powierzchnie)
    Object.keys(fabryka).forEach(function (k) {
      if (k.slice(-1) === '2') return;
      fabryka[k + '2'] = (function (f) { return function () { var m = f(); m.side = T.DoubleSide; return m; }; })(fabryka[k]);
    });

    Object.keys(bryla.czesci).forEach(function (rodzaj) {
      var cz = bryla.czesci[rodzaj];
      var wezel = new T.Group(); wezel.name = 'czesc:' + rodzaj;
      wezel.userData.rodzaj = rodzaj;
      wezel.userData.czesc = opisy[rodzaj] || null;
      wezel.userData.kotwica = new T.Vector3().fromArray(cz.kotwica);
      wezel.userData.rozlozenie = new T.Vector3().fromArray(cz.rozlozenie);
      // materiały tej części (klony: podświetlenie per część, ten sam program)
      var mats = {}, mat = function (rodzajMat) {
        if (!mats[rodzajMat]) mats[rodzajMat] = zLatka(T, fabryka[rodzajMat]());
        return mats[rodzajMat];
      };
      wezel.userData.materialy = mats;
      var zawiasy = {};
      (cz.zawiasy || []).forEach(function (z) { zawiasy[z.siatka] = z; });
      var PLATY = { skrzydla: 1, usterzenie: 2, kaczka: 3, levcon: 3 };
      cz.siatki.forEach(function (s, i) {
        var g = geometria(T, s, los);
        var nazwaMat = s.material === 'wnetrze' && rodzaj === 'wloty' ? 'kanal' : s.material;
        if (nazwaMat === 'metal' && rodzaj === 'dysze') { nazwaMat = 'dysza'; koloryDyszy(T, g); }
        if (nazwaMat === 'szklo') wygladzNormalne(g);
        if (nazwaMat === 'ram' && PLATY[rodzaj]) {
          // ruchome końcówki J-50 (siatki z zawiasem) mają własne stacje — bez linii sterów, sam pas natarcia
          nazwaMat = 'ramPlat' + (zawiasy[i] ? 3 : PLATY[rodzaj]);
          g.setAttribute('uvPlat', new T.BufferAttribute(uvPlata(s.pozycje, s.uv), 2));
        }
        if (!fabryka[nazwaMat]) nazwaMat = 'ram';
        var m = mat(nazwaMat);
        if (s.dwustronna && m.side !== T.DoubleSide) { m = mat(nazwaMat + '2'); }
        var mesh = new T.Mesh(g, m);
        mesh.name = rodzaj + ':' + i;
        mesh.castShadow = nazwaMat !== 'szklo'; mesh.receiveShadow = true;
        if (nazwaMat === 'szklo') mesh.renderOrder = 1;   // przezroczysta szyba po wnętrzu kokpitu
        mesh.userData.matBazowy = m;
        siatki.push(mesh);
        if (nazwaMat === 'szklo' && rodzaj === 'kabina' && !kokpitGotowy && (opcje.lod || 'pelny') === 'pelny') {
          kokpitGotowy = true;
          kokpit(T, g, mat).forEach(function (k) { k.userData.matBazowy = k.material; siatki.push(k); wezel.add(k); });
        }
        if (holo) { var h = new T.Mesh(g, holo); h.raycast = bezRaycastu; h.renderOrder = 2; h.userData.holo = true; mesh.add(h); }
        var z = zawiasy[i];
        if (z) {                              // drzwi komory / ruchoma końcówka: obrót wokół osi zawiasu
          var piv = new T.Group(); piv.name = 'zawias:' + rodzaj + ':' + i;
          piv.position.fromArray(z.punkt);
          mesh.position.set(-z.punkt[0], -z.punkt[1], -z.punkt[2]);
          piv.add(mesh);
          piv.userData = { os: new T.Vector3().fromArray(z.os), kat: z.kat, rodzaj: rodzaj };
          pivoty.push(piv);
          wezel.add(piv);
        } else wezel.add(mesh);
      });
      (cz.wyloty || []).forEach(function (w, i) {
        var o = new T.Object3D(); o.name = 'wylot:' + i;
        o.position.fromArray(w.punkt);
        o.quaternion.setFromUnitVectors(new T.Vector3(-1, 0, 0), new T.Vector3().fromArray(w.kierunek).normalize());
        o.userData = { szer: w.szer, wys: w.wys, typ: w.typ };
        wezel.add(o); dysze.push(o);
      });
      czesci[rodzaj] = wezel;
      grupa.add(wezel);
    });

    function wygladz(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
    var stanRozl = 0, stanKomor = 0;
    var api = {
      id: id, grupa: grupa, czesci: czesci, dysze: dysze, obwiednia: bryla.obwiednia, bryla: bryla, niesfotografowany: niesf,
      wyloty: (bryla.czesci.dysze && bryla.czesci.dysze.wyloty) || [],
      rozloz: function (u) {
        stanRozl = u; var e = wygladz(u);
        Object.keys(czesci).forEach(function (r) { czesci[r].position.copy(czesci[r].userData.rozlozenie).multiplyScalar(e); });
        grupa.updateMatrixWorld(true);
      },
      komory: function (u) {
        stanKomor = u; var e = wygladz(u);
        pivoty.forEach(function (p) { if (p.userData.rodzaj === 'komory') p.quaternion.setFromAxisAngle(p.userData.os, p.userData.kat * e); });
        grupa.updateMatrixWorld(true);
      },
      // Ruchome końcówki skrzydeł (J-50): wychylenie −1..1 ułamka kąta z sylwetki.
      koncowki: function (u) {
        pivoty.forEach(function (p) { if (p.userData.rodzaj === 'skrzydla') p.quaternion.setFromAxisAngle(p.userData.os, p.userData.kat * u); });
        grupa.updateMatrixWorld(true);
      },
      stan: function () { return { rozloz: stanRozl, komory: stanKomor, plan: planWl, podswietl: podsw }; },
      plan: function (wl) {
        planWl = !!wl;
        if (planWl && !liniePlanu) {
          liniePlanu = [];
          siatki.forEach(function (m) {
            if (m.material.side === T.BackSide) return;
            var rodz = m.parent && (m.parent.userData.rodzaj || (m.parent.parent && m.parent.parent.userData.rodzaj));
            var lm = new T.LineBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.75, depthWrite: false });
            var l = new T.LineSegments(new T.EdgesGeometry(m.geometry, 24), lm);
            l.raycast = bezRaycastu; l.userData.rodzaj = rodz; l.userData.planu = true;
            m.add(l); liniePlanu.push(l);
          });
        }
        siatki.forEach(function (m) { m.material = planWl ? matPlanu : m.userData.matBazowy; m.castShadow = !planWl && m.userData.matBazowy.transparent !== true; });
        if (liniePlanu) liniePlanu.forEach(function (l) { l.visible = planWl; });
        grupa.traverse(function (o) { if (o.userData.holo) o.visible = !planWl; });
        api.podswietl(podsw);
      },
      podswietl: function (rodzaj) {
        podsw = rodzaj && czesci[rodzaj] ? rodzaj : null;
        Object.keys(czesci).forEach(function (r) {
          var mats = czesci[r].userData.materialy, wl = r === podsw ? 1 : 0;
          Object.keys(mats).forEach(function (k) { mats[k].userData.uPods.value = wl; });
        });
        if (liniePlanu) liniePlanu.forEach(function (l) { l.material.color.setHex(l.userData.rodzaj === podsw ? 0xffc46b : 0x7fd8ff); l.material.opacity = l.userData.rodzaj === podsw ? 1 : 0.75; });
      },
      aktualizuj: function (czas) { if (holo) holo.uniforms.uCzas.value = czas; },
      zwolnij: function () {
        var geo = {}, mat = {};
        grupa.traverse(function (o) {
          if (o.geometry) geo[o.geometry.uuid] = o.geometry;
          if (o.material) mat[o.material.uuid] = o.material;
        });
        siatki.forEach(function (m) { mat[m.userData.matBazowy.uuid] = m.userData.matBazowy; });
        Object.keys(czesci).forEach(function (r) { var ms = czesci[r].userData.materialy; Object.keys(ms).forEach(function (k) { mat[ms[k].uuid] = ms[k]; }); });
        mat[matPlanu.uuid] = matPlanu;
        if (holo) mat[holo.uuid] = holo;
        Object.keys(geo).forEach(function (k) { geo[k].dispose(); });
        Object.keys(mat).forEach(function (k) { mat[k].dispose(); });
        [tex, tex.plat].forEach(function (t) { t.kolor.dispose(); t.szorstkosc.dispose(); t.normalne.dispose(); });
        if (grupa.parent) grupa.parent.remove(grupa);
      },
    };
    return api;
  }

  root.Makieta = { zbuduj: zbuduj, KAFEL: KAFEL };
})(typeof window !== 'undefined' ? window : globalThis);
