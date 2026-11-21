'use strict';
/* Zakładka Myśliwce — ogień dopalacza (plik dual-export; część przeglądarkowa wymaga THREE r128).
   Czyste (testy w node): Ogien.diamenty(ciag, dl) → [{x [m za wylotem], promien [× promień wylotu], jasnosc 0..1}],
     Ogien.kolor(ciag) → [r,g,b] liniowe 0..1 (niebieskawy bez dopalacza → różowofioletowy zapłon → pomarańcz),
     Ogien.wymiary(wylot, ciag) → { pol:[z,y] półwymiary przekroju u wylotu [m], rozrost:[z,y] [m/m], wykladnik (superelipsa
     przekroju: 2 = koło), dl (długość płomienia przy tym ciągu), dlMax, deq (średnica równoważna) }.
   Przeglądarkowe: Ogien.utworz(THREE, wylot | wyloty[≤3], rodzic, { jakosc? }) → { korzen, strugi, ustaw(ciag), animuj(t), moc() → { moc, kolor }, jakosc('pelna'|'lekka'),
     zrodlaGoraca() → [{ poz:[x,y,z] (świat), kierunek:[x,y,z] (świat, z prądem strumienia), sila 0..1, dl [m, świat] }]
     (po strudze; dl = długość płomienia przy bieżącym ciągu — obrys iskry i stożek falowania w Kino.post),
     zwolnij() }.
     `wylot` = element Platowiec.zbuduj(...).czesci.dysze.wyloty ({ punkt, kierunek, szer, wys, typ }, metry, układ makiety)
     albo wszystkie wyloty maszyny (jedno pudło, pętla po strugach), `rodzic` = obiekt makiety, do którego płomień jest
     dopięty (rozkładanie i obrót działają same).
   Ciąg c (wspólny z dzwiek.js): 0 = silnik stoi, 0,6 = pełna moc bez dopalacza (płomienia prawie nie widać — słaby niebieski
   stożek), > 0,6 dopalacz: rdzeń, płaszcz, diamenty Macha.
   Płomień to OBJĘTOŚĆ, nie karton: pudło-pośrednik w układzie wylotu, w nim marsz promienia (40 kroków, lekka 20) przez pole emisji
   — płaszcz (gauss w przekroju superelipsy, turbulencja fbm unoszona z prądem), stożek rdzenia, diamenty (romby w przekroju
   podłużnym, dyski z tyłu). Przekrój z typu dyszy: 2D-TVC spłaszczony (superelipsa k=4 przechodząca w koło), rynna J-36
   szeroki i płaski (rośnie w bok, nie w górę, nie schodzi pod podłogę rynny), okrągła/3D-TVC koło. Mieszanie addytywne,
   miękkie nasycenie luminancji (1 − e^(−1,2·Y))/(1,2·Y), potem ton i kodowanie wyjścia jak w materiałach sceny. Tarcza żaru
   w gardzieli (widać ją tylko od tyłu, ścianki dyszy ją zasłaniają) i migotanie jasności światła zbiorczego (moc()) na kadłubie i posadzce.
   Kamera wewnątrz pudła → rysowane ściany tylne (onBeforeRender), więc płomień nie znika przy zbliżeniu. */
(function (root) {
  var PROG_AB = 0.6;
  var MAKS_DIAM = 7;
  var MAKS_STRUG = 3;               // dysz na maszynę (J-36: 3) — jedno pudło, pętla po strugach
  var MAKS_KROKOW = 40;             // marsz promienia: 40 w pełnej jakości, 20 w lekkiej
  var APERTURA = 0.84;              // światło wylotu / obrys dyszy (pierścień wewnętrzny w platowiec.js: 0,82–0,86)

  function przytnij(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gladko(a, b, x) { var u = przytnij((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); }

  // Diamenty: 3 przy zapłonie → 6 przy pełnym dopalaczu; pierwszy 0,09 dl za wylotem, odstęp 0,125 dl malejący o 7%
  // na komórkę (≈ 1,05 średnicy równoważnej przy dl = 8,5 deq); promień i jasność gasną w głąb strumienia.
  function diamenty(ciag, dl) {
    if (!(ciag >= PROG_AB)) return [];
    var ab = przytnij((ciag - PROG_AB) / (1 - PROG_AB), 0, 1), n = 3 + Math.floor(ab * 3.999), w = [], u = 0.09, krok = 0.125;
    for (var i = 0; i < n; i++) {
      w.push({ x: u * dl, promien: 0.62 * Math.pow(0.92, i), jasnosc: (0.45 + 0.55 * ab) * Math.pow(0.78, i) });
      u += krok; krok *= 0.93;
    }
    return w;
  }
  var KOLORY = [[0, [0.30, 0.45, 1.00]], [0.45, [0.42, 0.50, 1.00]], [0.6, [0.85, 0.50, 0.75]], [0.75, [1.00, 0.55, 0.38]], [1, [1.00, 0.50, 0.16]]];
  function kolor(ciag) {
    var c = przytnij(+ciag || 0, 0, 1), j = 1;
    while (j < KOLORY.length - 1 && KOLORY[j][0] < c) j++;
    var a = KOLORY[j - 1], b = KOLORY[j], u = (c - a[0]) / (b[0] - a[0]);
    return [0, 1, 2].map(function (k) { return a[1][k] + (b[1][k] - a[1][k]) * u; });
  }
  function wymiary(wylot, ciag) {
    var typ = wylot.typ, okr = typ === 'okragla' || typ === '3D-TVC';
    var pz = wylot.szer / 2 * APERTURA, py = (wylot.wys || wylot.szer) / 2 * APERTURA;
    if (okr) pz = py = (pz + py) / 2;
    var deq = 2 * Math.sqrt(pz * py), dlMax = 8.5 * deq, c = przytnij(+ciag || 0, 0, 1);
    return {
      pol: [pz, py],
      rozrost: typ === 'rynna' ? [0.11, 0.035] : okr ? [0.07, 0.07] : [0.08, 0.06],
      wykladnik: typ === 'rynna' ? 5 : okr ? 2 : 4,
      deq: deq, dlMax: dlMax,
      dl: dlMax * (0.3 + 0.7 * Math.pow(c, 1.3)),
    };
  }

  /* ---------- przeglądarkowe ---------- */
  var GLSL_SZUM = [
    'float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
    'float szum3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),',
    '             mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }',
    'float fbm3(vec3 p) { return 0.55 * szum3(p) + 0.3 * szum3(p * 2.07 + 1.7) + 0.15 * szum3(p * 4.13 + 3.1); }',
  ].join('\n');
  var GLSL_SUPEREL = 'float superel(vec2 a, float k) { a = abs(a) + 1e-5; return pow(pow(a.x, k) + pow(a.y, k), 1.0 / k); }';
  var W_PLOMIEN = 'varying vec3 vPoz;\nvoid main() { vPoz = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  var F_PLOMIEN = [
    'uniform float uCzas, uAb, uDl, uSila, uWyk;',
    'uniform int uKroki, uN;',
    'uniform vec2 uPol, uRoz;',
    'uniform vec3 uKolor, uRdzen, uKolDiam, uKam, uMin, uMax;',
    'uniform vec3 uDiam[' + MAKS_DIAM + '];',
    'uniform vec3 uStrugi[' + MAKS_STRUG + '];',                            // środki wylotów w układzie pudła
    'varying vec3 vPoz;',
    GLSL_SZUM,
    GLSL_SUPEREL,
    'vec3 emisja(vec3 p) {',
    '  float q = -p.x, u = q / uDl;',                                       // q: metry za wylotem
    '  if (u < -0.01 || u > 1.15) return vec3(0.0);',
    '  vec2 yz = vec2(p.z, p.y);',
    '  float k = mix(uWyk, 2.0, smoothstep(0.0, 0.6, u));',               // prostokąt wylotu → koło w dół strumienia
    '  float rO = superel(yz / (uPol + uRoz * max(q, 0.0)), k);',          // 1 = obwiednia płaszcza w tej odległości
    '  if (rO > 1.6) return vec3(0.0);',                                   // exp(−1,6²·2,6) ≈ 0,1% — dalej nic nie świeci
    '  float rW = superel(yz / uPol, k);',                                 // 1 = krawędź wylotu
    '  float n = fbm3(vec3(q * 2.4 - uCzas * 11.0, p.y * 3.1, p.z * 3.1));',
    '  float n2 = szum3(vec3(q * 6.5 - uCzas * 23.0, p.y * 7.0, p.z * 7.0));',
    '  float wzdl = smoothstep(-0.01, 0.05, u) * (1.0 - smoothstep(0.35, 1.1, u + (n - 0.5) * 0.4));',
    '  float plaszcz = exp(-rO * rO * 2.6) * wzdl * (0.35 + 1.2 * n);',
    '  float lc = mix(0.22, 0.5, uAb), rc = 0.85 * (1.0 - u / lc);',       // stożek rdzenia
    '  float rdzen = rc > 0.0 ? (1.0 - smoothstep(rc * 0.3, rc, rW)) * smoothstep(-0.01, 0.02, u) : 0.0;',
    '  float dm = 0.0, hw = uDl * 0.032;',
    '  for (int i = 0; i < ' + MAKS_DIAM + '; i++) {',
    '    vec3 d = uDiam[i];',
    '    if (d.z <= 0.0) continue;',
    '    float r = abs(q - d.x) / hw + rW / d.y;',                         // romb: |Δx|/półdługość + r/promień < 1
    '    float rr = 1.0 - smoothstep(0.0, 1.0, r);',
    '    dm += d.z * (rr * rr + 0.05 * exp(-r * r * 2.0));',              // ostry romb + słaba poświata
    '  }',
    '  vec3 c = uKolor * plaszcz * 1.1 + uRdzen * rdzen * 2.4 + uKolDiam * dm * 7.0;',
    '  return c * uSila * (0.8 + 0.4 * n2);',
    '}',
    'void main() {',
    '  vec3 ro = uKam, rd = normalize(vPoz - uKam);',
    '  vec3 inv = 1.0 / (sign(rd) * max(abs(rd), vec3(1e-6)));',
    '  vec3 t0 = (uMin - ro) * inv, t1 = (uMax - ro) * inv, ta = min(t0, t1), tb = max(t0, t1);',
    '  float tn = max(max(ta.x, ta.y), max(ta.z, 0.0)), tf = min(min(tb.x, tb.y), tb.z);',
    '  if (tf <= tn) discard;',
    '  float dt = (tf - tn) / float(uKroki), j = hash3(vec3(gl_FragCoord.xy, 3.7));',  // przesunięcie kroku per piksel
    '  vec3 suma = vec3(0.0);',
    '  for (int i = 0; i < ' + MAKS_KROKOW + '; i++) {',
    '    if (i >= uKroki) break;',
    '    vec3 p = ro + rd * (tn + (float(i) + j) * dt);',
    '    for (int s = 0; s < ' + MAKS_STRUG + '; s++) { if (s >= uN) break; suma += emisja(p - uStrugi[s]); }',
    '  }',
    // miękkie nasycenie po luminancji (barwa zostaje): słup wzdłuż osi strugi nie wybiela się w dysk, środek zakresu
    // prawie liniowy (diamenty nie giną). Nasycenie per kanał spłaszczało wszystkie kanały do 1 = biel.
    '  vec3 c = suma * dt; float Y = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  c *= (1.0 - exp(-1.2 * Y)) / max(1.2 * Y, 1e-4);',
    // alfa = gęstość płomienia: blending zapisuje w kanale alfa celu a·(1 − alfa) — maska płomienia z poprawnym
    // zasłanianiem (test głębi) dla iskry postu kina (Kino.post); kolor dodawany jak dotąd (ONE, ONE)
    '  gl_FragColor = vec4(c, clamp(1.6 * (1.0 - exp(-1.2 * Y)) / 1.2, 0.0, 1.0));',
    '  #include <tonemapping_fragment>',
    '  #include <encodings_fragment>',
    '}',
  ].join('\n');
  // Tarcza żaru w gardzieli: superelipsa, rozgrzany środek, ciemniejszy pierścień stabilizatora płomienia i szprychy.
  var W_TARCZA = 'varying vec2 vUv;\nvoid main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  var F_TARCZA = [
    'uniform float uCzas, uAb, uSila, uWyk;',
    'uniform vec3 uKolor, uRdzen;',
    'varying vec2 vUv;',
    GLSL_SUPEREL,
    'void main() {',
    '  float r = superel(vUv, uWyk);',
    '  if (r > 1.0) discard;',
    '  float kat = atan(vUv.y, vUv.x);',
    '  float pierscien = 1.0 - 0.55 * exp(-pow((r - 0.55) * 14.0, 2.0)) * (0.6 + 0.4 * step(0.5, fract(kat * 1.9099)));',
    '  float migot = 0.85 + 0.15 * sin(uCzas * 31.0 + r * 9.0) * sin(uCzas * 17.3);',
    '  vec3 c = mix(uKolor * 0.25, uRdzen * 0.35, smoothstep(0.75, 0.0, r)) * pierscien * migot * (1.0 - smoothstep(0.85, 1.0, r));',
    '  gl_FragColor = vec4(c * uSila, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <encodings_fragment>',
    '}',
  ].join('\n');

  // `wylot` — jeden wylot albo tablica (≤ 3) wylotów jednej maszyny (ten sam typ i wymiar — tak buduje je platowiec.js):
  // jedno pudło na wszystkie strugi zamiast pudła na dyszę (J-36: 1 przebieg zamiast 3 nakładających się).
  // Światła płomień nie ma: jedno światło zbiorcze maszyny trzyma mysliwce/silniki.js (moc i kolor z `moc()`).
  function utworz(T, wylot, rodzic, opcje) {
    opcje = opcje || {};
    var strugi = (Array.isArray(wylot) ? wylot : [wylot]).slice(0, MAKS_STRUG), w0 = strugi[0];
    var wym = wymiary(w0, 1), pol = wym.pol, roz = wym.rozrost, dlMax = wym.dlMax, rynna = w0.typ === 'rynna';
    var korzen = new T.Group(); korzen.name = 'ogien';
    korzen.position.fromArray(w0.punkt);
    korzen.quaternion.setFromUnitVectors(new T.Vector3(-1, 0, 0), new T.Vector3().fromArray(w0.kierunek).normalize());
    // środki wylotów w układzie korzenia (wspólny kierunek strug)
    var odw = korzen.quaternion.clone().invert();
    var srodki = strugi.map(function (w) { return new T.Vector3().fromArray(w.punkt).sub(korzen.position).applyQuaternion(odw); });
    // pudło-pośrednik: od wylotu do 1,12 dlMax, przekrój 1,5 × obwiedni końca (suma po strugach); rynna — dół nad podłogą rynny
    var L = dlMax * 1.12, ez = 1.5 * (pol[0] + roz[0] * L), ey = 1.5 * (pol[1] + roz[1] * L);
    var yMin = rynna ? -pol[1] / APERTURA * 0.97 : -ey;
    // koniec pudła lekko w dyszy: ściana tylna nie leży w płaszczyźnie wylotu (z-fighting z pierścieniem dyszy przy
    // kamerze w pudle), a część w dyszy zasłaniają jej ścianki; emisja i tak zaczyna się od wylotu
    var xD = 0.06 * wym.deq, uMin = new T.Vector3(Infinity, Infinity, Infinity), uMax = new T.Vector3(-Infinity, -Infinity, -Infinity);
    srodki.forEach(function (c) {
      uMin.min(new T.Vector3(c.x - L, c.y + yMin, c.z - ez)); uMax.max(new T.Vector3(c.x + xD, c.y + ey, c.z + ez));
    });
    var wymPudla = uMax.clone().sub(uMin), srPudla = uMax.clone().add(uMin).multiplyScalar(0.5);
    var gPudlo = new T.BoxGeometry(wymPudla.x, wymPudla.y, wymPudla.z);
    gPudlo.translate(srPudla.x, srPudla.y, srPudla.z);
    var diam = []; for (var i = 0; i < MAKS_DIAM; i++) diam.push(new T.Vector3());
    var uStrugi = []; for (i = 0; i < MAKS_STRUG; i++) uStrugi.push(srodki[i] ? srodki[i].clone() : new T.Vector3());
    var wspolne = { uCzas: { value: 0 }, uAb: { value: 0 }, uSila: { value: 0 }, uWyk: { value: wym.wykladnik },
      uKolor: { value: new T.Color() }, uRdzen: { value: new T.Color() } };
    var mPlomien = new T.ShaderMaterial({
      vertexShader: W_PLOMIEN, fragmentShader: F_PLOMIEN, transparent: true, depthWrite: false,
      // = AdditiveBlending dla koloru (alfa nie skaluje światła), alfa celu × (1 − alfa płomienia) = maska dla postu
      blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor,
      blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor,
      uniforms: Object.assign({}, wspolne, {
        uDl: { value: dlMax }, uPol: { value: new T.Vector2(pol[0], pol[1]) }, uRoz: { value: new T.Vector2(roz[0], roz[1]) },
        uKolDiam: { value: new T.Color(1.0, 0.72, 0.42) }, uKam: { value: new T.Vector3() }, uMin: { value: uMin }, uMax: { value: uMax },
        uDiam: { value: diam }, uStrugi: { value: uStrugi }, uN: { value: srodki.length },
        uKroki: { value: opcje.jakosc === 'lekka' ? MAKS_KROKOW / 2 : MAKS_KROKOW },
      }),
    });
    var plomien = new T.Mesh(gPudlo, mPlomien);
    plomien.name = 'ogien:plomien'; plomien.renderOrder = 3; plomien.raycast = function () {};
    var kamLok = new T.Vector3();
    plomien.onBeforeRender = function (r, s, kamera) {
      kamLok.setFromMatrixPosition(kamera.matrixWorld); plomien.worldToLocal(kamLok);
      mPlomien.uniforms.uKam.value.copy(kamLok);
      var m = 0.15, wew = kamLok.x > uMin.x - m && kamLok.x < uMax.x + m && kamLok.y > uMin.y - m && kamLok.y < uMax.y + m && kamLok.z > uMin.z - m && kamLok.z < uMax.z + m;
      mPlomien.side = wew ? T.BackSide : T.FrontSide;
    };
    // tarcze żaru w gardzielach, zwrócone z prądem (−x); jedna geometria i materiał na wszystkie
    var gTarcza = new T.PlaneGeometry(2 * pol[0], 2 * pol[1]);
    var mTarcza = new T.ShaderMaterial({ vertexShader: W_TARCZA, fragmentShader: F_TARCZA, transparent: true, depthWrite: false,
      blending: T.AdditiveBlending, uniforms: wspolne });
    var tarcze = srodki.map(function (c) {
      var t = new T.Mesh(gTarcza, mTarcza);
      t.name = 'ogien:tarcza'; t.rotation.y = -Math.PI / 2; t.position.copy(c); t.position.x += 0.45 * Math.min(pol[0], pol[1]);
      t.raycast = function () {};
      return t;
    });
    korzen.add(plomien); tarcze.forEach(function (t) { korzen.add(t); });
    var widoczny = function (v) { plomien.visible = v; tarcze.forEach(function (t) { t.visible = v; }); };
    widoczny(false);
    if (rodzic) rodzic.add(korzen);

    var ciag = 0, sila = 0, bazaSwiatla = 0, migot = 1, kolSw = [1, 0.5, 0.2], pomoc = new T.Vector3();
    var api = {
      korzen: korzen, wymiary: wym, strugi: srodki.length,
      ustaw: function (c) {
        ciag = przytnij(+c || 0, 0, 1);
        var w = wymiary(w0, ciag), ab = ciag >= PROG_AB ? (ciag - PROG_AB) / (1 - PROG_AB) : 0;
        // bez dopalacza: słaby niebieski stożek od 0,3; zapłon dopalacza = skok jasności (tak jak w rzeczywistości)
        sila = ciag < PROG_AB ? 0.22 * gladko(0.3, PROG_AB, ciag) : 0.5 + 0.5 * ab;
        var k = kolor(ciag);
        wspolne.uKolor.value.setRGB(k[0], k[1], k[2]);
        if (ciag < PROG_AB) wspolne.uRdzen.value.setRGB(0.45, 0.6, 1.0);
        else wspolne.uRdzen.value.setRGB(0.5 + 0.5 * ab, 0.62 + 0.16 * ab, 1.0 - 0.5 * ab);
        wspolne.uAb.value = ab; wspolne.uSila.value = sila;
        mPlomien.uniforms.uDl.value = w.dl;
        var d = diamenty(ciag, w.dl);
        for (var j = 0; j < MAKS_DIAM; j++) { if (d[j]) diam[j].set(d[j].x, d[j].promien, d[j].jasnosc); else diam[j].set(0, 1, 0); }
        widoczny(sila > 0.002);
        kolSw = [k[0], k[1] * 0.85 + 0.1, k[2] * 0.6];
        bazaSwiatla = srodki.length * (ciag < PROG_AB ? 0.15 * gladko(0.3, PROG_AB, ciag) : 0.5 + 1.1 * ab);
      },
      animuj: function (t) {
        wspolne.uCzas.value = t;
        // migotanie: suma niewspółmiernych sinusów (deterministyczna w t — smoke ma stałą klatkę)
        migot = 0.86 + 0.08 * Math.sin(t * 37.0 + w0.punkt[2] * 5) + 0.06 * Math.sin(t * 23.3 + 1.3) * Math.sin(t * 5.1);
      },
      // moc i kolor światła grupy (światło zbiorcze maszyny trzyma silniki.js)
      moc: function () { return { moc: bazaSwiatla * migot, kolor: kolSw }; },
      jakosc: function (j) { mPlomien.uniforms.uKroki.value = j === 'lekka' ? MAKS_KROKOW / 2 : MAKS_KROKOW; },
      // źródła gorąca w świecie, po jednym na strugę (wejście passu falowania z Task 7)
      zrodlaGoraca: function () {
        korzen.updateWorldMatrix(true, false);
        var o = new T.Vector3(-1, 0, 0).transformDirection(korzen.matrixWorld).toArray(), s2 = plomien.visible ? ciag : 0;
        var dl = wymiary(w0, ciag).dl * korzen.matrixWorld.getMaxScaleOnAxis();
        return srodki.map(function (c) { return { poz: korzen.localToWorld(pomoc.copy(c).add(new T.Vector3(-0.25 * wym.deq, 0, 0))).toArray(), kierunek: o, sila: s2, dl: dl }; });
      },
      zwolnij: function () {
        if (korzen.parent) korzen.parent.remove(korzen);
        gPudlo.dispose(); gTarcza.dispose(); mPlomien.dispose(); mTarcza.dispose();
      },
    };
    api.ustaw(0);
    return api;
  }

  var Ogien = { diamenty: diamenty, kolor: kolor, wymiary: wymiary, utworz: utworz, PROG_AB: PROG_AB, MAKS_DIAM: MAKS_DIAM, MAKS_STRUG: MAKS_STRUG };
  if (typeof module !== 'undefined' && module.exports) module.exports = Ogien;
  else root.Ogien = Ogien;
})(typeof window !== 'undefined' ? window : globalThis);
