'use strict';
/* Zjawiska naukowe — silnik prezentacji wspólny dla wszystkich zjawisk (wykonanie kinowe).
   Odpowiada za: zakładki „Układ Słoneczny | Zjawiska naukowe”, listę zjawisk z rejestru, leniwe ładowanie
   pliku zjawiska, nawigację po krokach (klawisze / przyciski / kropki / hash) oraz KINO:
     - kadr 2.39:1 z pasami liczonymi z okna (telefon w pionie: kadr pełny), napisy zdanie po zdaniu w dolnym pasie,
       plansza tytułu w górnym, UI znikające po ~3 s bezruchu,
     - kamerę REŻYSEROWANĄ: każdy krok ma `ujecie` (tor Catmull-Rom, cel, FOV, czas, kompozycja, przechył,
       dolly zoom); płynny dojazd między krokami tej samej „sceny”, cięcie przez czerń przy zmianie sceny,
       oddech kamery; OrbitControls = tryb „rozejrzyj się” (przeciągnięcie albo `O`; Dalej/Wstecz wznawia reżyserię),
     - obraz: własny pass bloom + winieta + ziarno na render targetach (bez bibliotek), z bezpiecznym powrotem
       do zwykłego renderu, gdy pass się nie zbuduje,
     - seans (auto-odtwarzanie, spacja = pauza), pełny ekran (`F`), opcjonalny dron Web Audio (domyślnie wyłączony).

   WŁASNY renderer, scena i kamera na własnym <canvas> — nic nie trafia do sceny solar.js.
   Gdy `Zjawiska.aktywny === true`, pętla `animate` w solar.js nie renderuje (strażnik na jej początku).

   Kontrakt pliku zjawiska: `Zjawiska.rejestruj({ id, tytul, zrodla, pochodzenie, zestawy, kroki })`
     zestawy[nazwa](ctx) → { grupa, ustaw?(opcje), animuj?(t, dt) }   — obiekty wspólne dla wielu kroków, budowane raz
     krok = { czesc, tytul, narracja[], ramka?, podpis, przypisy?, scena, ujecie:{ruch,tor,cel,fov,czas,komp?,przechyl?,dollyZoom?,tlo?},
              zestawy?[], ustaw?(ctx, z), zbuduj?(ctx) → { grupa, etykiety?, krok?(t, z), ... }, etykiety?[], przyrzad?,
              animuj?(ctx, t, wlasne, z), tPogl?, strefa?[x,y,z,r] }   (strefa = bryła, w którą kamera ujęcia nie wchodzi; pilnuje test „kontrakt kina”)
   Bez `animuj` widok co klatkę woła `krok(t, z)` z wyniku `zbuduj` (jeśli jest); `animuj` go zastępuje.
   `ctx.doKamery(obiekt)` → obiekt co klatkę zwrócony do kamery (po animacji kroku), bez lookAt w kodzie zjawiska.
   Film w przejściu rysuje DWA kroki w jednej klatce i przełącza między nimi zawartość, więc: `ustaw` (zestawu i kroku)
   ma być idempotentne (pełny stan z parametrów, bez przyrostów), a `krok`/`animuj` kroku funkcją czasu `t` — stan
   przyrostowy (np. malowanie płótna) sam się resetuje, gdy `t` wraca. `dt` dostają tylko zestawy, raz na klatkę.
   Sceny budowane leniwie przy pierwszym wejściu w krok; przy wyjściu tylko `visible = false` (zero realokacji).
   Haki testowe: `?smoke&zjawisko=<id>&krok=N[&t=0..1]` — kamera od razu w kadrze końcowym ujęcia (albo w postępie t),
   napisy w całości, UI widoczne, bez ziarna i cięć; marker `ZJAWISKA_READY <id> <krok> <liczba>`. */
(function () {
  var L = window.ZjawiskaLogika;
  var REJESTR = window.ZjawiskaRejestr || [];
  var $ = function (id) { return document.getElementById(id); };

  var el = {
    korzen: $('zjawiska'), zakladki: $('zakladki'), pasek: $('zjPasek'), topbar: $('topbar'),
    zakUklad: $('zakUklad'), zakZjawiska: $('zakZjawiska'), zakInfo: $('zakInfo'),
    nazwa: $('zjNazwa'), doListy: $('zjDoListy'), zamknij: $('zjZamknij'),
    seans: $('zjSeans'), dzwiek: $('zjDzwiek'), pelny: $('zjPelny'), tekstBtn: $('zjTekstBtn'),
    lista: $('zjLista'), karty: $('zjKarty'), komunikat: $('zjKomunikat'),
    prezentacja: $('zjPrezentacja'), kadr: $('zjKadr'), canvas: $('zjCanvas'), etykiety: $('zjEtykiety'),
    wskazowka: $('zjWskazowka'), postep: $('zjPostep'), czern: $('zjCzern'),
    przyrzad: $('zjPrzyrzad'), podpis: $('zjPodpis'), plansza: $('zjPlansza'), czesc: $('zjCzesc'), tytul: $('zjTytul'),
    napisy: $('zjNapisy'), panel: $('zjPanel'), tresc: $('zjTresc'), pCzesc: $('zjPCzesc'), pTytul: $('zjPTytul'),
    narracja: $('zjNarracja'), ramka: $('zjRamka'), pPodpis: $('zjPPodpis'), przypisy: $('zjPrzypisy'), zrodla: $('zjZrodla'),
    zrodlaLista: $('zjZrodlaLista'), pochodzenie: $('zjPochodzenie'),
    wstecz: $('zjWstecz'), dalej: $('zjDalej'), licznik: $('zjLicznik'), kropki: $('zjKropki'),
    start: $('zjStart'), startTytul: $('zjStartTytul'), startDzwiek: $('zjStartDzwiek'), startCicho: $('zjStartCicho')
  };
  if (!el.korzen || !L) return;

  var Z = window.Zjawiska = { aktywny: false };

  var definicje = {};            // id → definicja zarejestrowana przez plik zjawiska
  var ladowanie = {};            // id → Promise ładowania skryptu
  var przebiegi = {};            // id → stan uruchomieniowy (korzeń sceny, zbudowane zestawy, cache kroków)
  var tryb = 'uklad';            // 'uklad' | 'lista' | 'prezentacja'
  var biez = null;               // bieżący przebieg (w trybie 'prezentacja')
  var gl = null;                 // { renderer, scena, kamera, sterowanie }
  var post = null;               // pass bloom/winieta/ziarno (null = zwykły render)
  var raf = 0, ostatnia = 0;
  var tGlob = 0, tKrok = 0;      // czas animacji [s], skalowany tempem (prefers-reduced-motion = wolniej)
  var tReal = 0, tNapisy = 0, tDojazd = 0;   // czas rzeczywisty: oddech kamery, napisy, dojazd między ujęciami
  var kadr = { tryb: 'kino', x: 0, y: 0, w: 1, h: 1, pasGora: 0, pasDol: 0 };
  var rezyseria = true;          // false = użytkownik się rozgląda (OrbitControls)
  var zrodloDojazdu = null;      // stan kamery, z którego płynnie dojeżdżamy do nowego ujęcia (null = cięcie)
  var ciecie = null;             // { n, zegar } — trwające cięcie przez czerń
  var etAkt = [];                // aktywne etykiety 2D
  var slupki = null;             // { min, max, paski[] } bieżącego przyrządu
  var napisy = { h: [], el: [], idx: -1, caly: false };
  var seans = { pauza: false };
  var obrazKlatki = null;        // obraz ostatniej klatki (diagnostyka Z.stan)
  var film = null;               // Seans = film zjawiska: { os, t } — zegar filmu, oś czasu z logika.osCzasuFilmu (null = tryb kroków)
  var dzwiek = null;             // { ctx, osc[], wzm } po pierwszym włączeniu
  var smoke = false, smokeT = null, gotowosc = null;
  var mqRuch = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var maMysz = false;            // UI chowa się tylko wtedy, gdy ktoś naprawdę ruszał myszą (dotyk/klawiatura: UI zostaje)
  var wek = null, wek2 = null;
  var palety = {};
  var ciszaZegar = 0;
  var fps = { n: 0, t0: 0, wart: 0, slabe: 0 };
  var jakosc = 'pelna';          // 'pelna' (pass obrazu, DPR ≤ 2) | 'oszczedna' (zwykły render, DPR 1) — spada sama przy < 28 kl./s

  /* ---------- drobne narzędzia ---------- */
  function ograniczonyRuch() { return !!mqRuch.matches; }
  function token(nazwa) {
    if (!(nazwa in palety)) {
      // paleta sceny (--scena-*) jest osobna od interfejsu (Depesza nocą) — zob. nagłówek zjawiska.css
      var v = getComputedStyle(document.documentElement).getPropertyValue('--scena-' + nazwa).trim();
      if (!v) console.error('Zjawiska: brak koloru sceny --scena-' + nazwa + ' w zjawiska/zjawiska.css — dopisz go do palety sceny w :root');
      palety[nazwa] = v || '#ffffff';
    }
    return palety[nazwa];
  }
  function lotAktywny() {        // `flight` = globalny const solar.js (tryb lotu orbitalnego)
    try { return typeof flight !== 'undefined' && !!flight && flight.active === true; } catch (_) { return false; }
  }
  function info(tekst) {
    el.zakInfo.textContent = tekst || '';
    if (info._t) clearTimeout(info._t);
    if (tekst) info._t = setTimeout(function () { el.zakInfo.textContent = ''; }, 4500);
  }
  function wpisRejestru(id) { for (var i = 0; i < REJESTR.length; i++) if (REJESTR[i].id === id) return REJESTR[i]; return null; }
  function generator(ziarno) {   // mulberry32 — deterministyczne „losowe” rozmieszczenia (stały wygląd scen)
    var a = (ziarno >>> 0) || 1;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- rejestracja i ładowanie zjawisk ---------- */
  Z.rejestruj = function (def) {
    if (!def || !def.id || !Array.isArray(def.kroki)) { console.error('Zjawiska: zła definicja', def && def.id); return; }
    definicje[def.id] = def;
  };
  function zaladuj(id) {
    if (definicje[id]) return Promise.resolve(definicje[id]);
    if (ladowanie[id]) return ladowanie[id];
    var wpis = wpisRejestru(id);
    if (!wpis) return Promise.reject(new Error('nieznane zjawisko'));
    ladowanie[id] = new Promise(function (ok, zle) {
      var s = document.createElement('script');
      s.src = wpis.skrypt;
      s.onload = function () { definicje[id] ? ok(definicje[id]) : zle(new Error('plik nie zarejestrował zjawiska')); };
      s.onerror = function () { delete ladowanie[id]; zle(new Error('nie udało się wczytać pliku')); };
      document.head.appendChild(s);
    });
    return ladowanie[id];
  }

  /* ---------- renderer / scena (jedne dla wszystkich zjawisk) ---------- */
  function zapewnijGL() {
    if (gl) return gl;
    var T = window.THREE;
    var renderer = new T.WebGLRenderer({ canvas: el.canvas, antialias: true, alpha: false });   // bez log-depth → własne shadery bez chunków logdepthbuf_*
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(new T.Color(token('pustka')), 1);
    var scena = new T.Scene();
    var kamera = new T.PerspectiveCamera(32, L.KINO.PROPORCJA, 0.05, 600);
    kamera.position.set(0, 4, 12);
    scena.add(new T.AmbientLight(0xffffff, 0.5));
    var swiatlo = new T.DirectionalLight(0xffffff, 0.95);
    swiatlo.position.set(4, 8, 6);
    scena.add(swiatlo);
    var sterowanie = new T.OrbitControls(kamera, el.canvas);
    sterowanie.enableDamping = true; sterowanie.dampingFactor = 0.08;
    sterowanie.enablePan = false; sterowanie.minDistance = 1.5; sterowanie.maxDistance = 60;
    sterowanie.addEventListener('start', function () { if (rezyseria) ustawRezyserie(false); });   // gest przerywa reżyserię
    wek = new T.Vector3(); wek2 = new T.Vector3();
    gl = { renderer: renderer, scena: scena, kamera: kamera, sterowanie: sterowanie };
    try { post = zbudujPost(T, renderer); } catch (e) { console.warn('Zjawiska: pass obrazu niedostępny, zwykły render', e); post = null; }
    window.addEventListener('resize', dopasuj);
    document.addEventListener('fullscreenchange', dopasuj);
    dopasuj();
    return gl;
  }

  /* ---------- obraz: bloom + winieta + ziarno (własny pass, bez bibliotek) ----------
     scena → rtScena (MSAA w WebGL2) → jasne partie ¼ rozdzielczości → rozmycie Gaussa ×2 → złożenie na ekran. */
  function zbudujPost(T, renderer) {
    var WIERZ = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    var opcje = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, depthBuffer: false, stencilBuffer: false };
    function rtPelny() {
      return renderer.capabilities.isWebGL2
        ? new T.WebGLMultisampleRenderTarget(4, 4, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat })
        : new T.WebGLRenderTarget(4, 4, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat });
    }
    var rtScena = renderer.capabilities.isWebGL2
      ? new T.WebGLMultisampleRenderTarget(4, 4, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat })
      : new T.WebGLRenderTarget(4, 4, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat });
    var rtA = new T.WebGLRenderTarget(2, 2, opcje), rtB = new T.WebGLRenderTarget(2, 2, opcje);
    // druga scena przejścia filmu (przenikanie: drugi krok; most: same gwiazdy) — tworzona leniwie przy pierwszym
    // przejściu i zwalniana po filmie: pełnoekranowy bufor z MSAA to dziesiątki–setki MB, a przejścia trwają sekundy
    var rtDrugi = null;
    var kam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), sc = new T.Scene();
    var siatka = new T.Mesh(new T.PlaneGeometry(2, 2), null); siatka.frustumCulled = false; sc.add(siatka);
    function mat(frag, uni) { return new T.ShaderMaterial({ uniforms: uni, vertexShader: WIERZ, fragmentShader: frag, depthTest: false, depthWrite: false }); }
    var mJasne = mat([
      'uniform sampler2D tD; uniform sampler2D tD2; uniform float uMiks; uniform vec2 uTex; uniform float uProg; varying vec2 vUv;',
      'vec3 j(vec2 o){ vec2 q = vUv + o * uTex; vec3 c = mix(texture2D(tD2, q).rgb, texture2D(tD, q).rgb, uMiks); float l = max(c.r, max(c.g, c.b)); return c * smoothstep(uProg, uProg + 0.26, l); }',
      'void main(){ gl_FragColor = vec4((j(vec2(-1.0,-1.0)) + j(vec2(1.0,-1.0)) + j(vec2(-1.0,1.0)) + j(vec2(1.0,1.0))) * 0.25, 1.0); }'
    ].join('\n'), { tD: { value: null }, tD2: { value: null }, uMiks: { value: 1 }, uTex: { value: new T.Vector2() }, uProg: { value: 0.74 } });
    var mRozm = mat([
      'uniform sampler2D tD; uniform vec2 uKier; varying vec2 vUv;',
      'void main(){ vec3 c = texture2D(tD, vUv).rgb * 0.227027;',
      '  c += (texture2D(tD, vUv + uKier * 1.3846).rgb + texture2D(tD, vUv - uKier * 1.3846).rgb) * 0.316216;',
      '  c += (texture2D(tD, vUv + uKier * 3.2308).rgb + texture2D(tD, vUv - uKier * 3.2308).rgb) * 0.070270;',
      '  gl_FragColor = vec4(c, 1.0); }'
    ].join('\n'), { tD: { value: null }, uKier: { value: new T.Vector2() } });
    var mKon = mat([
      'uniform sampler2D tScena; uniform sampler2D tDrugi; uniform float uMiks; uniform float uWarp; uniform sampler2D tBloom; uniform float uBloom; uniform float uWinieta; uniform float uZiarno; uniform float uCzas; uniform vec2 uRozm; varying vec2 vUv;',
      'float los(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uCzas * 7.13) * 43758.5453); }',
      // poza przejściem (uMiks = 1) bez próbkowania drugiej sceny
      'vec3 obraz(vec2 q){ vec3 b = texture2D(tScena, q).rgb; if (uMiks > 0.999) return b; return mix(texture2D(tDrugi, q).rgb, b, uMiks); }',
      'void main(){',
      '  vec3 c = obraz(vUv);',
      // przelot: radialna smuga od środka kadru (12 próbek wzdłuż promienia), jaśniejsza przy krawędziach
      // (16 próbek z losowym przesunięciem per piksel — bez schodków „duchów” przy równych odstępach)
      '  if (uWarp > 0.001) { vec2 d = vUv - 0.5; vec3 s = vec3(0.0); float j = los(vUv * uRozm);',
      '    for (int i = 0; i < 16; i++) s += obraz(0.5 + d * (1.0 - uWarp * 0.034 * (float(i) + j)));',
      '    c = mix(c, s / 16.0 * (1.0 + 0.6 * uWarp * length(d)), uWarp); }',
      '  c += texture2D(tBloom, vUv).rgb * uBloom;',
      '  vec2 d = (vUv - 0.5) * vec2(1.0, 0.72);',
      '  c *= 1.0 - uWinieta * smoothstep(0.30, 0.62, length(d));',
      '  c += (los(floor(vUv * uRozm / 1.5)) - 0.5) * uZiarno;',
      '  gl_FragColor = vec4(c, 1.0); }'
    ].join('\n'), { tScena: { value: null }, tDrugi: { value: null }, uMiks: { value: 1 }, uWarp: { value: 0 }, tBloom: { value: null }, uBloom: { value: 0.7 }, uWinieta: { value: 0.5 }, uZiarno: { value: 0.045 }, uCzas: { value: 0 }, uRozm: { value: new T.Vector2(1, 1) } });
    var rozm = new T.Vector2();
    function przebieg(m, cel) { siatka.material = m; renderer.setRenderTarget(cel); renderer.render(sc, kam); }
    return {
      rozmiar: function () {
        renderer.getDrawingBufferSize(rozm);
        var w = Math.max(2, rozm.x), h = Math.max(2, rozm.y), mw = Math.max(2, Math.round(w / 4)), mh = Math.max(2, Math.round(h / 4));
        rtScena.setSize(w, h); if (rtDrugi) rtDrugi.setSize(w, h); rtA.setSize(mw, mh); rtB.setSize(mw, mh);
        this.w = w; this.h = h;
        mJasne.uniforms.uTex.value.set(1 / w, 1 / h); mKon.uniforms.uRozm.value.set(w, h);
        this.mw = mw; this.mh = mh;
      },
      // pierwsza z dwóch scen przejścia (składana w `renderuj` z udziałem 1 − miks)
      renderujDrugi: function (scena, kamera) {
        if (!rtDrugi) { rtDrugi = rtPelny(); rtDrugi.setSize(this.w || 4, this.h || 4); }
        renderer.setRenderTarget(rtDrugi); renderer.render(scena, kamera);
      },
      zwolnijDrugi: function () { if (rtDrugi) { rtDrugi.dispose(); rtDrugi = null; } },
      // `opcje.miks` = udział tej sceny wobec `renderujDrugi` (1 = sama ta; bez wywołania renderujDrugi zawsze 1), `opcje.warp` = smuga
      renderuj: function (scena, kamera, czas, ziarno, opcje) {
        var miks = opcje && opcje.miks != null ? opcje.miks : 1;
        renderer.setRenderTarget(rtScena); renderer.render(scena, kamera);
        if (!rtDrugi) miks = 1;
        var drugi = rtDrugi ? rtDrugi.texture : rtScena.texture;
        mJasne.uniforms.tD.value = rtScena.texture; mJasne.uniforms.tD2.value = drugi; mJasne.uniforms.uMiks.value = miks; przebieg(mJasne, rtA);
        for (var i = 0; i < 2; i++) {
          mRozm.uniforms.tD.value = rtA.texture; mRozm.uniforms.uKier.value.set((1 + i) / this.mw, 0); przebieg(mRozm, rtB);
          mRozm.uniforms.tD.value = rtB.texture; mRozm.uniforms.uKier.value.set(0, (1 + i) / this.mh); przebieg(mRozm, rtA);
        }
        mKon.uniforms.tScena.value = rtScena.texture; mKon.uniforms.tDrugi.value = drugi; mKon.uniforms.uMiks.value = miks;
        mKon.uniforms.uWarp.value = (opcje && opcje.warp) || 0; mKon.uniforms.tBloom.value = rtA.texture;
        mKon.uniforms.uCzas.value = czas; mKon.uniforms.uZiarno.value = ziarno;
        przebieg(mKon, null);
      }
    };
  }

  // Geometria kadru z rozmiaru okna → zmienne CSS + rozmiar renderera.
  function dopasuj() {
    var W = el.korzen.clientWidth || window.innerWidth, H = el.korzen.clientHeight || window.innerHeight;
    kadr = L.kadrKinowy(W, H);
    var st = el.korzen.style;
    st.setProperty('--kadr-y', kadr.y + 'px'); st.setProperty('--kadr-h', kadr.h + 'px');
    st.setProperty('--kadr-x', kadr.x + 'px'); st.setProperty('--kadr-w', kadr.w + 'px');
    st.setProperty('--pas-gora', kadr.pasGora + 'px'); st.setProperty('--pas-dol', kadr.pasDol + 'px');
    el.korzen.classList.toggle('zj-pelny', kadr.tryb === 'pelny');
    ustawTrybNapisow();
    if (!gl || !(kadr.w > 0 && kadr.h > 0)) return;
    gl.renderer.setSize(kadr.w, kadr.h, false);
    gl.kamera.aspect = kadr.w / kadr.h;
    if (post) post.rozmiar();
    for (var i = 0; i < etAkt.length; i++) etAkt[i].szer = 0;      // zmiana rozmiaru = ponowny pomiar etykiet
  }

  /* ---------- przebieg zjawiska: korzeń sceny + leniwe zestawy ---------- */
  function przebieg(def) {
    if (przebiegi[def.id]) return przebiegi[def.id];
    var T = window.THREE, g = zapewnijGL();
    var p = { def: def, korzen: new T.Group(), zestawy: {}, kroki: [], krok: 0, pokazany: 0, odwiedzone: {}, aktywne: [], z: {}, doKamery: [] };
    p.korzen.name = 'zjawisko:' + def.id;
    g.scena.add(p.korzen);
    p.ctx = {
      THREE: T, L: L, scena: p.korzen, kamera: g.kamera,
      kolor: function (n) { return new T.Color(token(n)); },
      generator: generator,
      ograniczonyRuch: ograniczonyRuch,
      rozmiar: function () { return { w: kadr.w, h: kadr.h, dpr: g.renderer.getPixelRatio() }; },
      zestaw: function (nazwa) { return zestaw(p, nazwa); },
      // obiekt zawsze zwrócony do kamery (zegar, tabliczka, szyba): widok robi lookAt co klatkę po animacji kroku
      doKamery: function (o) { p.doKamery.push(o); return o; },
      przyrzad: ustawSlupki
    };
    przebiegi[def.id] = p;
    return p;
  }
  // Zwolnienie zasobów GPU przebiegu (geometrie, materiały, tekstury) i usunięcie go ze sceny. Wołane przy powrocie
  // do Układu i przy przejściu na inne zjawisko; powrót z listy do TEGO SAMEGO zjawiska dalej korzysta z pamięci.
  // Geometrii sprite'ów nie zwalniamy: w Three r128 wszystkie Sprite dzielą jedną geometrię (też te w solar.js).
  function zwolnijPrzebieg(p) {
    var mats = [];
    p.korzen.traverse(function (o) {
      if (o.geometry && !o.isSprite) o.geometry.dispose();
      if (o.material) mats = mats.concat(o.material);
    });
    mats.forEach(function (m) {
      for (var klucz in m) { var v = m[klucz]; if (v && v.isTexture) v.dispose(); }
      if (m.uniforms) for (var u in m.uniforms) { var w = m.uniforms[u] && m.uniforms[u].value; if (w && w.isTexture) w.dispose(); }
      m.dispose();
    });
    if (gl) gl.scena.remove(p.korzen);
    delete przebiegi[p.def.id];
    if (biez === p) { biez = null; el.kropki.replaceChildren(); czyscEtykiety(); }
  }
  function zwolnijWszystkie(oprocz) {
    Object.keys(przebiegi).forEach(function (id) { if (przebiegi[id] !== oprocz) zwolnijPrzebieg(przebiegi[id]); });
  }
  function zestaw(p, nazwa) {
    if (p.zestawy[nazwa]) return p.zestawy[nazwa];
    var buduj = p.def.zestawy && p.def.zestawy[nazwa];
    if (typeof buduj !== 'function') throw new Error('Zjawiska: nieznany zestaw „' + nazwa + '”');
    var z = buduj(p.ctx) || {};
    if (z.grupa) { z.grupa.visible = false; p.korzen.add(z.grupa); }
    p.zestawy[nazwa] = z;
    return z;
  }

  /* ---------- etykiety 2D ---------- */
  function czyscEtykiety() { el.etykiety.replaceChildren(); etAkt = []; }
  function dodajEtykiete(e) {
    var d = document.createElement('div');
    d.className = 'zj-et' + (e.klasa ? ' ' + e.klasa : '');
    var tekstFn = typeof e.tekst === 'function' ? e.tekst : null;
    if (!tekstFn) d.textContent = e.tekst;
    el.etykiety.appendChild(d);
    var T = window.THREE;
    var zrodlo = Array.isArray(e.poz) ? new T.Vector3(e.poz[0], e.poz[1], e.poz[2]) : (e.poz || e.cel);
    etAkt.push({ el: d, zrodlo: zrodlo, kotwica: e.kotwica || 'gora', dx: e.dx || 0, dy: e.dy || 0, tekstFn: tekstFn, ostatni: null, szer: 0, wys: 0, r: { x: 0, y: 0, w: 0, h: 0 } });
  }
  var KOTWICE = { gora: [-50, -100, 0, -6], dol: [-50, 0, 0, 6], lewo: [-100, -50, -8, 0], prawo: [0, -50, 8, 0], srodek: [-50, -50, 0, 0] };
  function widocznyWGore(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
  function rzutujEtykiety(t, krycie) {
    if (krycie == null) krycie = 1;
    var w = kadr.w, h = kadr.h, k = gl.kamera, prost = [], i, e;
    for (i = 0; i < etAkt.length; i++) {
      e = etAkt[i]; var z = e.zrodlo; prost.push(null);
      if (!z) continue;
      if (z.isObject3D) { if (!widocznyWGore(z)) continue; z.getWorldPosition(wek); } else wek.copy(z);
      wek.project(k);
      if (wek.z > 1 || wek.z < -1) continue;
      var x = (wek.x * 0.5 + 0.5) * w, y = (-wek.y * 0.5 + 0.5) * h, a = KOTWICE[e.kotwica] || KOTWICE.gora;
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) continue;
      if (e.tekstFn) { var s = e.tekstFn(t); if (s !== e.ostatni) { e.el.textContent = s; e.ostatni = s; e.szer = 0; } }
      if (!e.szer) { e.szer = e.el.offsetWidth; e.wys = e.el.offsetHeight; }      // pomiar raz na etykietę / zmianę tekstu
      var lx = x + a[2] + e.dx + a[0] / 100 * e.szer, ly = y + a[3] + e.dy + a[1] / 100 * e.wys;
      if (lx > w - e.szer - 4) lx = w - e.szer - 4;
      if (lx < 4) lx = 4;
      if (ly > h - e.wys - 2) ly = h - e.wys - 2;
      if (ly < 2) ly = 2;
      e.r.x = lx; e.r.y = ly; e.r.w = e.szer; e.r.h = e.wys; prost[i] = e.r;
    }
    var ulozone = L.rozsunEtykiety(prost, { w: w, h: h });       // etykiety nie nachodzą na siebie (kamera się rusza)
    for (i = 0; i < etAkt.length; i++) {
      e = etAkt[i];
      if (!ulozone[i]) { e.el.style.opacity = 0; continue; }
      e.el.style.opacity = krycie;
      e.el.style.transform = 'translate(' + ulozone[i].x.toFixed(1) + 'px,' + ulozone[i].y.toFixed(1) + 'px)';
    }
  }

  /* ---------- przyrząd: słupki względem zera (bez liczb — wielkości umowne) ---------- */
  function zbudujPrzyrzad(p) {
    slupki = null;
    el.przyrzad.replaceChildren();
    if (!p) { el.przyrzad.hidden = true; return; }
    el.przyrzad.hidden = false;
    var min = p.zakres ? p.zakres[0] : 0, max = p.zakres ? p.zakres[1] : 1;
    var zero = (0 - min) / (max - min) * 100;
    var t = document.createElement('p'); t.className = 'zj-pt'; t.textContent = p.tytul; el.przyrzad.appendChild(t);
    var paski = [];
    p.wiersze.forEach(function (w) {
      var d = document.createElement('div'); d.className = 'zj-wiersz';
      var n = document.createElement('div'); n.className = 'zj-we'; n.textContent = w.etykieta;
      var tor = document.createElement('div'); tor.className = 'zj-tor';
      var pasek = document.createElement('i'); pasek.style.background = token(w.kolor || 'atrament');
      var kreska = document.createElement('u'); kreska.style.left = zero + '%';
      tor.appendChild(pasek); tor.appendChild(kreska); d.appendChild(n); d.appendChild(tor); el.przyrzad.appendChild(d);
      paski.push(pasek);
    });
    if (p.zero) {
      var z = document.createElement('div'); z.className = 'zj-zero';
      var s = document.createElement('span'); s.style.left = zero + '%'; s.textContent = p.zero; z.appendChild(s); el.przyrzad.appendChild(z);
    }
    slupki = { min: min, max: max, zero: zero, paski: paski };
  }
  function ustawSlupki(wartosci) {
    if (!slupki) return;
    for (var i = 0; i < slupki.paski.length; i++) {
      var v = wartosci[i]; if (typeof v !== 'number' || !isFinite(v)) v = 0;
      v = Math.max(slupki.min, Math.min(slupki.max, v));
      var p = (v - slupki.min) / (slupki.max - slupki.min) * 100;
      var a = Math.min(p, slupki.zero), b = Math.max(p, slupki.zero);
      slupki.paski[i].style.left = a.toFixed(2) + '%';
      slupki.paski[i].style.width = (b - a).toFixed(2) + '%';
    }
  }

  /* ---------- napisy: zdanie po zdaniu w dolnym pasie; ramki uczciwości jako wersy z etykietą ---------- */
  function ustawTrybNapisow() {
    napisy.caly = smoke || kadr.tryb === 'pelny';
    el.napisy.classList.toggle('caly', napisy.caly);
  }
  // `lista` (film): gotowe wersy z osi czasu {tekst, ramka, start, koniec} — czasy bezwzględne filmu.
  function zbudujNapisy(k, lista) {
    var wersy;
    if (lista) {
      var pierwszy = true;
      wersy = lista.map(function (w) {
        if (!w.ramka) return { tekst: w.tekst };
        var o = { tekst: w.tekst, ramka: k.ramka, pierwszy: pierwszy }; pierwszy = false; return o;
      });
    } else {
      wersy = L.podzielNaZdania(k.narracja).map(function (z) { return { tekst: z }; });
      if (k.ramka) {
        var r = L.podzielNaZdania([k.ramka.tekst || '']);
        if (!smoke) r = r.concat(k.ramka.punkty || []);          // ?smoke: długie punkty ramki zostają w panelu „Tekst”
        r.forEach(function (z, i) { wersy.push({ tekst: z, ramka: k.ramka, pierwszy: i === 0 }); });
      }
    }
    el.napisy.replaceChildren();
    napisy.el = wersy.map(function (w) {
      var p = document.createElement('p');
      if (w.ramka) {
        p.className = 'ramka ' + w.ramka.typ + (w.pierwszy ? ' pierwszy-ramki' : '');
        var et = document.createElement('span'); et.className = 'zj-net'; et.textContent = w.ramka.etykieta; p.appendChild(et);
      }
      p.appendChild(document.createTextNode(w.tekst + ' '));
      el.napisy.appendChild(p);
      return p;
    });
    napisy.h = lista ? lista.map(function (w) { return { start: w.start, koniec: w.koniec }; }) : L.harmonogramNapisow(wersy.map(function (w) { return w.tekst; }));
    napisy.idx = -1;
    el.napisy.scrollTop = 0;
  }
  function pokazNapis(t) {
    var i = (napisy.h.length && t < napisy.h[0].start) ? -1 : L.indeksNapisu(napisy.h, t);   // film: przed pierwszym wersem (przejście) — pusto
    if (i === napisy.idx) return;
    if (napisy.idx >= 0 && napisy.el[napisy.idx]) napisy.el[napisy.idx].classList.remove('on');
    napisy.idx = i;
    if (i >= 0 && !smoke) {
      napisy.el[i].classList.add('on');
      if (napisy.caly && i > 0 && napisy.el[i].scrollIntoView) napisy.el[i].scrollIntoView({ block: 'nearest' });
    }
  }

  /* ---------- plansza, panel „Tekst”, kropki ---------- */
  function akapit(rodzic, tekst) { var p = document.createElement('p'); p.textContent = tekst; rodzic.appendChild(p); return p; }
  function wypelnijUI(p, n) {
    var k = p.def.kroki[n - 1], m = p.def.kroki.length;
    el.nazwa.textContent = p.def.tytul;
    el.czesc.textContent = k.czesc || ''; el.tytul.textContent = k.tytul;
    el.pCzesc.textContent = k.czesc || ''; el.pTytul.textContent = n + '. ' + k.tytul;
    el.plansza.classList.remove('wejscie'); void el.plansza.offsetWidth; el.plansza.classList.add('wejscie');
    el.narracja.replaceChildren();
    k.narracja.forEach(function (a) { akapit(el.narracja, a); });
    el.ramka.replaceChildren();
    if (k.ramka) {
      el.ramka.hidden = false;
      el.ramka.className = 'zj-ramka ' + k.ramka.typ;
      var et = document.createElement('span'); et.className = 'zj-ret'; et.textContent = k.ramka.etykieta; el.ramka.appendChild(et);
      if (k.ramka.tekst) akapit(el.ramka, k.ramka.tekst);
      if (k.ramka.punkty) { var ul = document.createElement('ul'); k.ramka.punkty.forEach(function (x) { var li = document.createElement('li'); li.textContent = x; ul.appendChild(li); }); el.ramka.appendChild(ul); }
    } else el.ramka.hidden = true;
    el.pPodpis.textContent = k.podpis;
    el.przypisy.textContent = (k.przypisy && k.przypisy.length) ? 'Źródła tego kroku: ' + k.przypisy.map(function (x) { return '[' + x + ']'; }).join(' ') : '';
    el.licznik.textContent = 'Krok ' + n + ' / ' + m;
    el.wstecz.disabled = n <= 1; el.dalej.disabled = n >= m;
    var kr = el.kropki.children;
    for (var i = 0; i < kr.length; i++) {
      kr[i].classList.toggle('on', i === n - 1);
      kr[i].classList.toggle('byl', !!p.odwiedzone[i + 1] && i !== n - 1);
      if (i === n - 1) kr[i].setAttribute('aria-current', 'step'); else kr[i].removeAttribute('aria-current');
    }
    el.tresc.scrollTop = 0;
  }
  function wypelnijPodpis(k) {      // „Ryc. N” wyróżnione jak w artykule
    el.podpis.replaceChildren();
    var ryc = /^(Ryc\.\s*\d+)\.?\s*(.*)$/.exec(k.podpis);
    if (ryc) { var b = document.createElement('b'); b.textContent = ryc[1]; el.podpis.appendChild(b); el.podpis.appendChild(document.createTextNode(ryc[2])); }
    else el.podpis.textContent = k.podpis;
  }
  function zbudujStalePanelu(p) {
    el.kropki.replaceChildren();
    p.def.kroki.forEach(function (k, i) {
      var b = document.createElement('button'); b.type = 'button';
      b.title = (i + 1) + '. ' + k.tytul; b.setAttribute('aria-label', 'Krok ' + (i + 1) + ': ' + k.tytul);
      b.addEventListener('click', function () { idz({ idz: i + 1 }); });
      el.kropki.appendChild(b);
    });
    el.zrodlaLista.replaceChildren();
    (p.def.zrodla || []).forEach(function (z) {
      var li = document.createElement('li');
      li.appendChild(document.createTextNode(z.opis));
      (z.linki || []).forEach(function (l) {
        if (!/^https:\/\//.test(l.url)) return;
        li.appendChild(document.createTextNode(' '));
        var a = document.createElement('a'); a.href = l.url; a.textContent = l.tekst; a.target = '_blank'; a.rel = 'noopener';
        li.appendChild(a);
      });
      el.zrodlaLista.appendChild(li);
    });
    el.pochodzenie.textContent = p.def.pochodzenie || '';
    el.zrodla.open = false;
  }
  function ustawPanel(otwarty) {
    el.panel.hidden = !otwarty;
    el.tekstBtn.setAttribute('aria-expanded', String(!!otwarty));
    obudzUI();
  }

  /* ---------- kamera ---------- */
  function stanKamery() {
    var k = gl.kamera, t = gl.sterowanie.target;
    return { poz: k.position.toArray(), cel: t.toArray(), fov: stanKamery.fov || k.fov, komp: (stanKamery.komp || [0, 0]).slice(), przechyl: stanKamery.przechyl || 0 };
  }
  function mieszajStan(a, b, e) {
    return { poz: L.mieszaj3(a.poz, b.poz, e), cel: L.mieszaj3(a.cel, b.cel, e), fov: a.fov + (b.fov - a.fov) * e,
      komp: [a.komp[0] + (b.komp[0] - a.komp[0]) * e, a.komp[1] + (b.komp[1] - a.komp[1]) * e], przechyl: a.przechyl + (b.przechyl - a.przechyl) * e };
  }
  function ustawKamere(s, zOddechem) {
    var k = gl.kamera, w = kadr.w, h = kadr.h;
    k.position.fromArray(s.poz);
    if (zOddechem) {
      var d = Math.sqrt(Math.pow(s.poz[0] - s.cel[0], 2) + Math.pow(s.poz[1] - s.cel[1], 2) + Math.pow(s.poz[2] - s.cel[2], 2));
      var o = L.oddech(tReal, 0.0035 * d);
      k.position.x += o[0]; k.position.y += o[1]; k.position.z += o[2];
    }
    k.up.set(0, 1, 0);
    wek2.fromArray(s.cel); k.lookAt(wek2);
    if (s.przechyl) k.rotateZ(s.przechyl * Math.PI / 180);
    gl.sterowanie.target.copy(wek2);
    k.fov = L.fovDlaProporcji(s.fov, w / h);
    // kompozycja: cel ląduje w punkcie (komp) kadru — przesunięcie okna rzutu, bez zmiany perspektywy
    var skala = kadr.tryb === 'pelny' ? 0.35 : 1;
    k.setViewOffset(w, h, -s.komp[0] * skala * w / 2, s.komp[1] * skala * h / 2, w, h);   // woła updateProjectionMatrix
    stanKamery.fov = s.fov; stanKamery.komp = s.komp; stanKamery.przechyl = s.przechyl;
  }
  function ustawRezyserie(wl) {
    if (wl === rezyseria) return;
    rezyseria = wl;
    el.wskazowka.hidden = wl || smoke;
    if (wl) { zrodloDojazdu = stanKamery(); tDojazd = 0; }      // powrót do ujęcia płynnym dojazdem z bieżącego widoku
    else { gl.kamera.up.set(0, 1, 0); }
  }

  /* ---------- kroki ---------- */
  // Zawartość 3D + etykiety + napisy kroku n. `plynnie` = dojazd kamery z bieżącego stanu; inaczej cięcie.
  // Zawartość 3D kroku n w scenie (widoczność zestawów i grupy kroku + ich ustawienia). `tylkoGwiazdy` = sam zestaw
  // `gwiazdy` (środek mostu gwiezdnego), także gdy krok go nie ma (łąka). Film w przejściu przełącza zawartość między
  // dwoma renderami jednej klatki, dlatego to osobna, tania funkcja; zapamiętuje, co jest zastosowane.
  function pokazZawartosc(p, n, tylkoGwiazdy) {
    var k = p.def.kroki[n - 1], i = n - 1, nazwa;
    for (nazwa in p.zestawy) if (p.zestawy[nazwa].grupa) p.zestawy[nazwa].grupa.visible = false;
    for (var j = 0; j < p.kroki.length; j++) if (p.kroki[j] && p.kroki[j].grupa) p.kroki[j].grupa.visible = false;
    p.aktywne = [];
    var z = {}, nazwy = tylkoGwiazdy ? ((p.def.zestawy && p.def.zestawy.gwiazdy) ? ['gwiazdy'] : []) : (k.zestawy || []);
    nazwy.forEach(function (nz) {
      var zz = zestaw(p, nz);
      if (zz.grupa) zz.grupa.visible = true;
      if (zz.ustaw) zz.ustaw({});            // powrót do ustawień domyślnych (krok nadpisuje je w `ustaw`)
      z[nz] = zz; p.aktywne.push(zz);
    });
    if (!tylkoGwiazdy) {
      if (k.zbuduj && !p.kroki[i]) {
        var w = k.zbuduj(p.ctx) || {};
        if (w.grupa) p.korzen.add(w.grupa);
        p.kroki[i] = w;
      }
      if (p.kroki[i] && p.kroki[i].grupa) p.kroki[i].grupa.visible = true;
    }
    p.z = z;
    if (!tylkoGwiazdy && k.ustaw) k.ustaw(p.ctx, z, p.kroki[i]);
    p.zastosowany = n; p.zastosowaneGwiazdy = !!tylkoGwiazdy;
  }
  function wejdzWScene(n, plynnie) {
    var p = biez, k = p.def.kroki[n - 1], i = n - 1;
    pokazZawartosc(p, n, false);

    czyscEtykiety();
    (k.etykiety || []).forEach(dodajEtykiete);
    if (p.kroki[i] && p.kroki[i].etykiety) p.kroki[i].etykiety.forEach(dodajEtykiete);
    zbudujPrzyrzad(k.przyrzad || null);
    wypelnijPodpis(k);
    zbudujNapisy(k);

    zrodloDojazdu = (plynnie && p.pokazany) ? stanKamery() : null;
    p.pokazany = n;
    tKrok = 0; tNapisy = 0; tDojazd = 0;
    rezyseria = true; el.wskazowka.hidden = true;
    if (smoke) gotowosc = { id: p.def.id, krok: n, m: p.def.kroki.length };
  }
  // Stan + UI natychmiast (krok, hash, plansza, kropki); obraz płynnie albo przez czerń.
  // Bieżący krok: stan, plansza/panel/kropki i hash — wspólne dla kroków i filmu.
  function ustawKrok(p, n) {
    p.krok = n; p.odwiedzone[n] = true;
    wypelnijUI(p, n);
    try { history.replaceState(null, '', location.pathname + location.search + L.budujHash(p.def.id, n)); } catch (_) { /* file:// */ }
    ustawDron();
  }
  function pokazKrok(n, bezPrzejscia) {
    var p = biez;
    n = L.ograniczKrok(n, p.def.kroki.length);
    var k = p.def.kroki[n - 1];
    ustawKrok(p, n);
    if (ciecie) { clearTimeout(ciecie.zegar); ciecie = null; }
    var poprz = p.pokazany ? p.def.kroki[p.pokazany - 1] : null;
    var przezCzern = !bezPrzejscia && !smoke && poprz && L.czyCiecie(poprz.scena, k.scena);
    if (przezCzern) {
      el.czern.classList.add('on');
      ciecie = { n: n, zegar: setTimeout(function () { ciecie = null; wejdzWScene(n, false); el.czern.classList.remove('on'); }, ograniczonyRuch() ? 30 : L.KINO.CZERN * 1000) };
    } else {
      el.czern.classList.remove('on');
      wejdzWScene(n, !bezPrzejscia && !smoke);
    }
  }
  function idz(akcja) {
    if (tryb !== 'prezentacja' || !biez) return;
    if (film) { przewinFilm(L.celPrzewiniecia(film.os, film.t, akcja)); if (!rezyseria) ustawRezyserie(true); return; }
    var n = L.przejscie(biez.krok, akcja, biez.def.kroki.length);
    if (n !== biez.krok) pokazKrok(n, false);
    else if (!rezyseria) ustawRezyserie(true);
  }

  /* ---------- seans, pełny ekran, dźwięk ---------- */
  // Seans = film zjawiska (spec 2026-11-19-zjawiska-film-design): jeden zegar filmu napędza zawartość kroków, kamerę
  // (logika.pozaFilmu), czerń i napisy — deterministycznie, więc pauza i przewijanie nie rozjeżdżają obrazu.
  // `t0` = chwila startu [s]; bez niej film zaczyna od bieżącego kroku (na ostatnim — od początku).
  // `bezPowrotu` = wyjście z widoku (nie wracaj do ujęcia kroku).
  function ustawSeans(wl, t0, bezPowrotu) {
    wl = !!wl && !!biez; seans.pauza = false;
    el.seans.setAttribute('aria-pressed', String(wl));
    el.seans.setAttribute('data-ikona', wl ? 'pauza' : 'gra');
    el.postep.hidden = !wl;
    el.korzen.classList.toggle('zj-film', wl);
    if (el.start) el.start.hidden = true;
    if (wl && document.activeElement && document.activeElement.tagName === 'BUTTON') el.korzen.focus({ preventScroll: true });   // spacja ma pauzować, nie klikać
    if (wl) {
      var os = L.osCzasuFilmu(smoke && q && q.przejscie ? L.zPrzejsciami(biez.def, q.przejscie) : biez.def, { dlugosc: 'skrot' });   // hak smoke: &przejscie=<typ>
      var t = typeof t0 === 'number' ? t0 : (biez.krok >= biez.def.kroki.length ? 0 : L.celPrzewiniecia(os, os.kroki[biez.krok - 1].start, { idz: biez.krok }));
      if (ciecie) { clearTimeout(ciecie.zegar); ciecie = null; }
      el.czern.classList.remove('on');
      film = { os: os, t: 0 };
      zbudujZnacznikiRozdzialow();
      if (!rezyseria) ustawRezyserie(true);
      zrodloDojazdu = null;
      przewinFilm(t, true);
    } else if (film) {
      film = null;
      el.czern.style.opacity = '';
      if (post) post.zwolnijDrugi();
      el.postep.replaceChildren(document.createElement('i'));
      if (!bezPowrotu && biez && biez.pokazany) wejdzWScene(biez.krok, true);   // z powrotem w krokach: płynny dojazd do ujęcia kroku
    }
  }
  // Ustaw zegar filmu; zawartość kroku przełącza się od razu (klatka dociągnie kamerę i czerń z osi czasu).
  function przewinFilm(t, wymus) {
    if (!film || !biez) return;
    film.t = Math.max(0, Math.min(film.os.calosc, t));
    var n = L.lokalizujFilm(film.os, film.t).krok;
    if (wymus || biez.pokazany !== n) krokFilmu(n);
  }
  function krokFilmu(n) {
    ustawKrok(biez, n);
    wejdzWScene(n, false);
    zbudujNapisy(biez.def.kroki[n - 1], film.os.kroki[n - 1].wersy);
  }
  function zbudujZnacznikiRozdzialow() {
    var bar = document.createElement('i');
    el.postep.replaceChildren(bar);
    L.rozdzialyFilmu(biez.def, film.os).forEach(function (r) {
      if (!r.ulamek) return;
      var b = document.createElement('b'); b.style.left = (r.ulamek * 100).toFixed(2) + '%';
      b.setAttribute('aria-hidden', 'true');
      el.postep.appendChild(b);
    });
  }
  function pauzaSeansu() {
    seans.pauza = !seans.pauza;
    el.seans.setAttribute('data-ikona', seans.pauza ? 'gra' : 'pauza');
  }
  function pelnyEkran() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.korzen.requestFullscreen) el.korzen.requestFullscreen();
    } catch (_) { /* brak wsparcia — bez pełnego ekranu */ }
  }
  // Dron: dwa lekko rozstrojone oscylatory przez filtr dolnoprzepustowy; wysokość z numeru kroku. Bez plików audio.
  function ustawDzwiek(wl) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { el.dzwiek.disabled = true; return; }
    if (wl && !dzwiek) {
      var ctx = new AC(), wzm = ctx.createGain(), filtr = ctx.createBiquadFilter(), osc = [];
      filtr.type = 'lowpass'; filtr.frequency.value = 320; wzm.gain.value = 0;
      ['sine', 'triangle'].forEach(function (typ, i) { var o = ctx.createOscillator(); o.type = typ; o.detune.value = i ? 7 : -5; o.connect(filtr); o.start(); osc.push(o); });
      filtr.connect(wzm); wzm.connect(ctx.destination);
      dzwiek = { ctx: ctx, osc: osc, wzm: wzm, on: false };
    }
    if (!dzwiek) return;
    dzwiek.on = !!wl;
    if (wl && dzwiek.ctx.state === 'suspended') dzwiek.ctx.resume();
    dzwiek.wzm.gain.setTargetAtTime(wl ? 0.07 : 0, dzwiek.ctx.currentTime, 0.4);
    el.dzwiek.setAttribute('aria-pressed', String(!!wl));
    ustawDron();
  }
  function ustawDron() {
    if (!dzwiek || !dzwiek.on || !biez) return;
    var f = L.czestotliwoscDronu(biez.krok, biez.def.kroki.length);
    dzwiek.osc.forEach(function (o, i) { o.frequency.setTargetAtTime(f * (i ? 1.5 : 1), dzwiek.ctx.currentTime, 1.2); });
  }

  /* ---------- UI: znika po bezruchu ---------- */
  function obudzUI() {
    el.korzen.classList.remove('zj-cisza');
    if (ciszaZegar) clearTimeout(ciszaZegar);
    ciszaZegar = 0;
    if (smoke || tryb !== 'prezentacja' || kadr.tryb === 'pelny' || !maMysz || !el.panel.hidden) return;
    ciszaZegar = setTimeout(function () {
      var a = document.activeElement;
      if (a && /^(BUTTON|A|SUMMARY)$/.test(a.tagName) && el.korzen.contains(a) && a.matches(':focus-visible')) return;   // fokus klawiatury na kontrolce: UI zostaje
      el.korzen.classList.add('zj-cisza');
    }, 3000);
  }

  /* ---------- pętla ---------- */
  function klatka() {
    if (!Z.aktywny || tryb !== 'prezentacja' || !biez) { raf = 0; return; }
    raf = requestAnimationFrame(klatka);
    var teraz = performance.now();
    var dtSur = (teraz - ostatnia) / 1000, dtR = Math.min(dtSur, 0.1); ostatnia = teraz;
    var p = biez, g = gl;
    if (!p.pokazany) return;
    var k = p.def.kroki[p.pokazany - 1], uj = k.ujecie, wolno = ograniczonyRuch();
    fps.n++;
    if (teraz - fps.t0 >= 1000) {
      fps.wart = fps.n * 1000 / (teraz - fps.t0); fps.n = 0; fps.t0 = teraz;
      // słaby sprzęt: po 3 s poniżej 28 kl./s wyłącz pass obrazu i zejdź do DPR 1 (płynność ważniejsza niż poświata)
      fps.slabe = (fps.wart < 28 && !smoke && !document.hidden) ? fps.slabe + 1 : 0;
      if (fps.slabe >= 3 && jakosc === 'pelna') { jakosc = 'oszczedna'; g.renderer.setPixelRatio(1); dopasuj(); }
    }

    // Opis klatki — jeden kształt dla kroków i filmu: krok zawartości, czasy, poza kamery i obraz (sceny, miks,
    // smuga, czerń). Kamera, animacja i render niżej czytają go bez pytania o tryb.
    var opis = film ? opisFilmu(p, dtR, dtSur, wolno) : opisKrokow(p, k, uj, dtR, wolno);
    tKrok = opis.tKrok; tGlob = opis.tGlob;
    if (rezyseria) ustawKamere(opis.poza, !smoke && !wolno); else g.sterowanie.update();
    Z.u = opis.u;
    if (film) el.czern.style.opacity = String(opis.obraz.czern);
    rysuj(p, opis, wolno);
    obrazKlatki = opis.obraz;
    rzutujEtykiety(tKrok, opis.obraz.etykiety);

    if (!smoke) {
      pokazNapis(tNapisy);
      if (film) {
        el.postep.firstElementChild.style.width = (Math.min(1, film.t / film.os.calosc) * 100).toFixed(2) + '%';
        if (film.t >= film.os.calosc) ustawSeans(false);       // koniec filmu: zostajemy na ostatnim kroku
      }
    }
    Z.klatki = (Z.klatki || 0) + 1;
    if (gotowosc) { console.log('ZJAWISKA_READY ' + gotowosc.id + ' ' + gotowosc.krok + ' ' + gotowosc.m); gotowosc = null; }
  }
  // Kroki: czas kroku, ujęcie z dojazdem z poprzedniej kamery, jedna scena.
  function opisKrokow(p, k, uj, dtR, wolno) {
    var dt, u;
    if (smoke) { tKrok = (typeof k.tPogl === 'number') ? k.tPogl : 5; tGlob = tKrok; dt = 0; u = smokeT == null ? 1 : smokeT; tNapisy = 0; }
    else {
      dt = dtR * L.tempoRuchu(wolno);
      tGlob += dt; tKrok += dt; tReal += dtR; tNapisy += dtR; tDojazd += dtR;
      u = L.postepUjecia(tKrok, uj.czas);
    }
    var poza = null;
    if (rezyseria) {
      poza = L.stanUjecia(uj, u, { bezDollyZoom: wolno });
      if (zrodloDojazdu && !smoke) {
        var e = L.wygladz(tDojazd / (L.KINO.DOJAZD * (wolno ? 1.6 : 1)));
        if (e >= 1) zrodloDojazdu = null; else poza = mieszajStan(zrodloDojazdu, poza, e);
      }
    }
    var tk = tKrok, uu = u;
    return { tKrok: tKrok, tGlob: tGlob, dt: dt, u: u, poza: poza,
      obraz: L.obrazJednej(p.pokazany - 1),
      czasy: function () { return { tKrok: tk, u: uu }; } };
  }
  // Film: jeden zegar (czas rzeczywisty; obcięcie 1 s tylko na długą przerwę, schowana karta pauzuje) — zawartość,
  // kamera, obraz przejścia i napisy z osi czasu. Smoke: zegar stoi w chwili `t`.
  function opisFilmu(p, dtR, dtSur, wolno) {
    if (!smoke && !seans.pauza) film.t = Math.min(film.os.calosc, film.t + Math.min(dtSur, 1));
    var os = film.os, lok = L.lokalizujFilm(os, film.t);
    if (p.pokazany !== lok.krok) krokFilmu(lok.krok);
    var dt = (smoke || seans.pauza) ? 0 : dtR;
    tReal += dt; tNapisy = film.t;
    var czasy = function (i) {
      var kr = os.kroki[i];
      return { tKrok: Math.max(0, film.t - kr.start), u: L.postepUjecia(film.t - kr.ruch.start, kr.ruch.czas) };
    };
    var c = czasy(lok.i), zPassem = !!post && jakosc === 'pelna';
    var obraz = lok.przejscie
      ? L.obrazPrzejscia(lok.przejscie.typ, lok.przejscie.f, lok.przejscie.do - 1, lok.przejscie.do, zPassem)
      : L.obrazJednej(lok.i);
    return { tKrok: c.tKrok, tGlob: film.t, dt: dt, u: c.u, poza: rezyseria ? L.pozaFilmu(p.def, os, film.t) : null, obraz: obraz, czasy: czasy };
  }
  // Zawartość sceny `sc` ({i, gwiazdy}) w chwili klatki: tło ujęcia, animacje zestawów i kroku, obiekty do kamery.
  // `dtZestawow`: zestawy są wspólne dla obu scen przejścia, więc przyrost czasu dostają raz na klatkę (scena ostatnia).
  function animujScene(p, sc, opis, dtZestawow) {
    if (p.zastosowany !== sc.i + 1 || p.zastosowaneGwiazdy !== !!sc.gwiazdy) pokazZawartosc(p, sc.i + 1, sc.gwiazdy);
    var k = p.def.kroki[sc.i], uj = k.ujecie, c = opis.czasy(sc.i);
    // tło przygaszane w ujęciu (przybliżenie „rack focus” bez postprocessingu głębi)
    var tlo = uj.tlo == null ? 1 : (typeof uj.tlo === 'number' ? uj.tlo : uj.tlo[0] + (uj.tlo[1] - uj.tlo[0]) * c.u);
    if (p.z.gwiazdy && p.z.gwiazdy.jasnosc) p.z.gwiazdy.jasnosc(sc.gwiazdy ? 1 : tlo);
    for (var i = 0; i < p.aktywne.length; i++) if (p.aktywne[i].animuj) p.aktywne[i].animuj(opis.tGlob, dtZestawow);
    if (!sc.gwiazdy) {
      var wlasne = p.kroki[sc.i];
      if (k.animuj) k.animuj(p.ctx, c.tKrok, wlasne, p.z, opis.dt);
      else if (wlasne && wlasne.krok) wlasne.krok(c.tKrok, p.z);       // domyślnie: ruch sceny kroku z jego `zbuduj`
    }
    for (var b = 0; b < p.doKamery.length; b++) p.doKamery[b].lookAt(gl.kamera.position);
  }
  // Render klatki: jedna scena albo dwie (przenikanie, most) złożone w passie obrazu; smuga przelotu w passie.
  function rysuj(p, opis, wolno) {
    var g = gl, o = opis.obraz, czas = smoke ? 0 : tReal, ziarno = (smoke || wolno) ? 0 : 0.045;
    if (post && jakosc === 'pelna') {
      // sceny w kolejności z obrazPrzejscia: krok zawartości ostatni (po renderze w scenie zostaje on — etykiety DOM)
      if (o.sceny.length === 2) { animujScene(p, o.sceny[0], opis, 0); post.renderujDrugi(g.scena, g.kamera); }
      animujScene(p, o.sceny[o.sceny.length - 1], opis, opis.dt);
      post.renderuj(g.scena, g.kamera, czas, ziarno, { miks: o.sceny.length === 2 ? o.miks : 1, warp: o.warp });
    } else {
      animujScene(p, o.sceny[0], opis, opis.dt);
      g.renderer.setRenderTarget(null); g.renderer.render(g.scena, g.kamera);
    }
  }
  function start() { if (!raf) { ostatnia = performance.now(); fps.t0 = ostatnia; fps.n = 0; raf = requestAnimationFrame(klatka); } }

  /* ---------- tryby: Układ / lista / prezentacja ---------- */
  function ustawTryb(t) {
    tryb = t;
    var wl = t !== 'uklad';
    Z.aktywny = wl;
    el.korzen.hidden = !wl;
    el.korzen.classList.toggle('zj-tryb-lista', t === 'lista');
    el.korzen.classList.toggle('zj-tryb-prezentacja', t === 'prezentacja');
    // zakładki: w Układzie w górnym pasku HUD, w zjawiskach w pasku nakładki (ten sam węzeł)
    var dom = wl ? el.pasek : el.topbar;
    if (dom && el.zakladki.parentNode !== dom) dom.insertBefore(el.zakladki, dom.firstChild);
    el.zakUklad.classList.toggle('on', !wl); el.zakZjawiska.classList.toggle('on', wl);
    el.zakUklad.setAttribute('aria-pressed', String(!wl)); el.zakZjawiska.setAttribute('aria-pressed', String(wl));
    el.lista.hidden = t !== 'lista';
    el.prezentacja.hidden = t !== 'prezentacja';
    if (t !== 'prezentacja') {
      el.nazwa.textContent = 'Zjawiska naukowe';
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (ciecie) { clearTimeout(ciecie.zegar); ciecie = null; el.czern.classList.remove('on'); }
      if (film) ustawSeans(false, null, true);
      if (dzwiek && dzwiek.on) ustawDzwiek(false);
      if (el.start) el.start.hidden = true;
      ustawPanel(false);
      if (t === 'uklad' && document.fullscreenElement === el.korzen) { try { document.exitFullscreen(); } catch (_) { /* nic */ } }
      if (t === 'uklad') zwolnijWszystkie(null);        // Układ renderuje sam — zjawiska nie trzymają pamięci GPU
    }
    obudzUI();
  }
  function zbudujListe() {
    if (el.karty.children.length) return;
    REJESTR.forEach(function (z) {
      var li = document.createElement('li');
      var b = document.createElement('button'); b.type = 'button'; b.className = 'zj-karta';
      var t = document.createElement('b'); t.textContent = z.tytul;
      var o = document.createElement('span'); o.className = 'zj-opis'; o.textContent = z.opis;
      var d = document.createElement('span'); d.className = 'zj-dalej'; d.textContent = 'Otwórz opowieść →';
      b.appendChild(t); b.appendChild(o); b.appendChild(d);
      b.addEventListener('click', function () { Z.otworz(z.id, 1); });
      li.appendChild(b); el.karty.appendChild(li);
    });
  }
  // Wejście w widok zjawisk. Tryb lotu orbitalnego BLOKUJE zakładkę (lot ma własny, warpowalny zegar i stan
  // manewru — nie wychodzimy z niego po cichu); użytkownik dostaje komunikat.
  function wolnoWejsc() {
    if (!lotAktywny()) return true;
    info('Najpierw zakończ lot orbitalny (Esc) — potem otwórz zjawiska.');
    return false;
  }
  Z.otworzListe = function (komunikat) {
    if (tryb === 'uklad' && !wolnoWejsc()) return false;
    zbudujListe();
    el.komunikat.textContent = komunikat || '';
    var zUkladu = tryb === 'uklad';
    ustawTryb('lista');
    try { history[zUkladu ? 'pushState' : 'replaceState'](null, '', location.pathname + location.search + L.budujHash(null)); } catch (_) { /* file:// */ }
    if (!smoke) el.korzen.focus({ preventScroll: true });
    return true;
  };
  Z.otworz = function (id, krok) {
    if (tryb === 'uklad' && !wolnoWejsc()) return Promise.resolve(false);
    if (!wpisRejestru(id)) { Z.otworzListe('Nie znam zjawiska „' + id + '”. Wybierz jedno z listy.'); return Promise.resolve(false); }
    if (tryb === 'uklad') { zbudujListe(); ustawTryb('lista'); try { history.pushState(null, '', location.pathname + location.search + L.budujHash(null)); } catch (_) { /* file:// */ } }
    el.komunikat.textContent = 'Wczytuję…';
    return zaladuj(id).then(function (def) {
      if (tryb === 'uklad') return false;                    // użytkownik zdążył wrócić do Układu
      el.komunikat.textContent = '';
      ustawTryb('prezentacja');
      try {
        zwolnijWszystkie(przebiegi[def.id]);       // inne zjawisko: poprzednie sceny zwolnione
        var p = przebieg(def);
        p.korzen.visible = true;
        if (biez !== p || !el.kropki.children.length) { biez = p; zbudujStalePanelu(p); }
        dopasuj();
        p.pokazany = 0;
        pokazKrok(krok || 1, true);               // wejście w zjawisko = cięcie; dojazdy tylko między krokami
        start();
        if (!smoke) el.korzen.focus({ preventScroll: true });
        return true;
      } catch (e) {
        console.error('Zjawiska: błąd budowy sceny', e);
        Z.otworzListe('Nie udało się zbudować sceny 3D tego zjawiska (' + (e && e.message || e) + ').');
        return false;
      }
    }, function (e) {
      if (tryb !== 'uklad') Z.otworzListe('Nie udało się wczytać zjawiska: ' + (e && e.message || e) + '.');
      return false;
    });
  };
  Z.zamknij = function () {
    if (tryb === 'uklad') return;
    ustawTryb('uklad');
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { /* file:// */ }
    el.zakZjawiska.focus({ preventScroll: true });
  };
  Z.idz = idz;
  Z.stan = function () {
    return { tryb: tryb, id: biez && tryb === 'prezentacja' ? biez.def.id : null, krok: biez ? biez.krok : 0, pokazany: biez ? biez.pokazany : 0,
      liczba: biez ? biez.def.kroki.length : 0, tween: !!zrodloDojazdu || !!ciecie, ciecie: !!ciecie, rezyseria: rezyseria,
      seans: !!film, pauza: seans.pauza, obraz: obrazKlatki ? { sceny: obrazKlatki.sceny.length, miks: obrazKlatki.miks, warp: obrazKlatki.warp, czern: obrazKlatki.czern, etykiety: obrazKlatki.etykiety } : null, film: film ? { t: film.t, calosc: film.os.calosc, krok: biez && biez.pokazany } : null, u: Z.u || 0, napis: napisy.idx, wersow: napisy.h.length, cisza: el.korzen.classList.contains('zj-cisza'),
      kadr: { tryb: kadr.tryb, x: kadr.x, w: kadr.w, h: kadr.h, y: kadr.y }, post: !!post && jakosc === 'pelna', jakosc: jakosc, fps: Math.round(fps.wart), klatki: Z.klatki || 0,
      kamera: gl ? { poz: gl.kamera.position.toArray(), fov: stanKamery.fov, komp: stanKamery.komp } : null };
  };
  // Liczniki zasobów — test „tam i z powrotem” ma dać te same liczby po drugim przejściu co po pierwszym.
  Z.diagnostyka = function () {
    if (!gl) return null;
    var n = 0, geo = {}, mat = {};
    gl.scena.traverse(function (o) { n++; if (o.geometry) geo[o.geometry.uuid] = 1; if (o.material) mat[o.material.uuid] = 1; });
    var m = gl.renderer.info.memory, pr = gl.renderer.info.programs;
    // geometrieSceny/materialy = wszystko, co wisi w grafie sceny (miara wycieku); geometrieGPU rośnie leniwie przy
    // pierwszym narysowaniu obiektu (np. iskry widoczne tylko w części pętli), więc samo w sobie wycieku nie dowodzi
    return { geometrieSceny: Object.keys(geo).length, materialy: Object.keys(mat).length, geometrieGPU: m.geometries, tekstury: m.textures,
      programy: pr ? pr.length : 0, obiekty: n, etykiety: el.etykiety.children.length };
  };

  /* ---------- zdarzenia ---------- */
  el.zakZjawiska.addEventListener('click', function () { if (tryb === 'uklad') Z.otworzListe(); });
  el.zakUklad.addEventListener('click', function () { Z.zamknij(); });
  el.zamknij.addEventListener('click', function () { Z.zamknij(); });
  el.doListy.addEventListener('click', function () { Z.otworzListe(); });
  el.wstecz.addEventListener('click', function () { idz('wstecz'); });
  el.dalej.addEventListener('click', function () { idz('dalej'); });
  el.seans.addEventListener('click', function () { ustawSeans(!film); });
  // pasek filmu: klik = przewinięcie do tego miejsca
  el.postep.addEventListener('click', function (e) {
    if (!film) return;
    var r = el.postep.getBoundingClientRect();
    if (r.width > 0) przewinFilm((e.clientX - r.left) / r.width * film.os.calosc);
  });
  // karta „Odtwórz” (link z `&film`): dźwięk i pełny obraz wymagają gestu — główny przycisk z dźwiękiem, drugi bez
  function startZKarty(zDzwiekiem) {
    var t = el.start.dataset.t ? Number(el.start.dataset.t) : 0;
    el.start.hidden = true;
    if (zDzwiekiem) ustawDzwiek(true);
    ustawSeans(true, t);
  }
  if (el.start) {
    el.startDzwiek.addEventListener('click', function () { startZKarty(true); });
    el.startCicho.addEventListener('click', function () { startZKarty(false); });
  }
  function pokazKarteStartu(t) {
    if (!el.start || !biez) return;
    el.startTytul.textContent = biez.def.tytul;
    el.start.dataset.t = typeof t === 'number' ? String(t) : '';
    el.start.hidden = false;
    if (!smoke) el.startDzwiek.focus({ preventScroll: true });
  }
  el.dzwiek.addEventListener('click', function () { ustawDzwiek(!(dzwiek && dzwiek.on)); });
  el.pelny.addEventListener('click', pelnyEkran);
  el.tekstBtn.addEventListener('click', function () { ustawPanel(el.panel.hidden); });
  ['pointermove', 'pointerdown', 'touchstart', 'wheel'].forEach(function (n) {
    el.korzen.addEventListener(n, function (e) { if (e.pointerType) maMysz = e.pointerType === 'mouse'; obudzUI(); }, { passive: true });
  });

  // Klawiatura: nasłuch w fazie CAPTURE na window — gdy widok zjawisk jest aktywny, żaden klawisz nie dociera
  // do skrótów Układu (`,` `.` `c` Enter `[` `]` Esc w solar.js wiszą na window w fazie bubble). Gdy nieaktywny,
  // nasłuch nie robi nic, więc strzałki/spacja nie zmieniają kroków „pod spodem”.
  window.addEventListener('keydown', function (e) {
    if (!Z.aktywny) return;
    e.stopPropagation();
    obudzUI();
    var a = L.akcjaKlawisza(e);
    if (!a) return;
    var cel = e.target, tag = cel && cel.tagName, spacja = e.key === ' ' || e.key === 'Spacebar';
    var natywny = tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (spacja && film && tryb === 'prezentacja') { e.preventDefault(); pauzaSeansu(); return; }   // w seansie spacja = pauza (także z fokusem na przycisku)
    if (natywny && spacja) return;                       // spacja na przycisku = jego własne kliknięcie
    e.preventDefault();
    if (a === 'zamknij') { if (!el.panel.hidden) ustawPanel(false); else if (film) ustawSeans(false); else Z.zamknij(); return; }   // w filmie Esc = z powrotem do kroków
    if (tryb !== 'prezentacja') return;
    if (a === 'rozejrzyj') ustawRezyserie(!rezyseria);
    else if (a === 'pelnyEkran') pelnyEkran();
    else if (a === 'tekst') ustawPanel(el.panel.hidden);
    else if (a === 'seans') ustawSeans(!film);
    else idz(a);
  }, true);
  window.addEventListener('keyup', function (e) { if (Z.aktywny) e.stopPropagation(); }, true);
  document.addEventListener('visibilitychange', function () { if (document.hidden && film && !seans.pauza) pauzaSeansu(); });

  function zAdresu() {
    var h = L.parsujHash(location.hash);
    if (!h) { if (tryb !== 'uklad') ustawTryb('uklad'); return; }
    if (!h.zjawisko) { if (tryb !== 'lista') Z.otworzListe(); return; }
    if (tryb === 'prezentacja' && biez && biez.def.id === h.zjawisko) {
      if (h.film && !film) pokazKarteStartu(h.t);
      else if (h.krok !== biez.krok) idz({ idz: h.krok });
      return;
    }
    Z.otworz(h.zjawisko, h.krok).then(function (ok) { if (ok && h.film) pokazKarteStartu(h.t); });
  }
  window.addEventListener('hashchange', zAdresu);
  window.addEventListener('popstate', zAdresu);

  // Start: `?smoke&zjawisko=<id>&krok=N[&t=0..1]` (hak testowy) albo link z hashem `#zjawisko=<id>&krok=N`.
  var q = L.parsujZapytanie(location.search);
  if (q && q.smoke) {
    smoke = true; el.korzen.classList.add('zj-smoke');
    if (q.film) {
      // `?smoke&zjawisko=id&film&t=S`: deterministyczna klatka filmu w chwili S [s]; marker podaje krok z osi czasu
      Z.otworz(q.zjawisko, 1).then(function (ok) { if (ok) ustawSeans(true, q.t || 0); });
    } else {
      var mt = /[?&]t=([0-9.]+)/.exec(location.search);
      if (mt) { var tv = parseFloat(mt[1]); if (isFinite(tv)) smokeT = Math.max(0, Math.min(1, tv)); }
      Z.otworz(q.zjawisko, q.krok);
    }
  } else if (L.parsujHash(location.hash)) zAdresu();
})();
