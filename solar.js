/* ============================================================
   Układ Słoneczny — interaktywna symulacja 3D
   Three.js r128 + OrbitControls
   ============================================================ */

// Tekstury serwowane lokalnie (same-origin) z ./textures/ — wcześniej z raw.githubusercontent.com.
// Cross-origin tekstury bywały odrzucane przez WebGL (tainted texture: obraz się wczytywał,
// ale GPU nie nakładał go na planetę → gładkie kule). Same-origin eliminuje crossOrigin/CORS.
const TEX = 'textures/';
const DEG = Math.PI / 180;

/* ---------- Planet data (display values hand-tuned; physics ratios real) ---------- */
const PLANETS = [
  { id:'mercury', pl:'Merkury', color:0x9c8c7a, radius:0.55, dist:18,
    rotH:1407.6, tilt:0.03, orbDays:88, map:'mercurymap.jpg', bump:'mercurybump.jpg',
    wiki:{lang:'pl', title:'Merkury (planeta)'},
    facts:{ Średnica:'4 879 km', 'Doba':'58,6 dnia', 'Rok':'88 dni', Temp:'−173…427 °C', Księżyce:'0', Odległość:'0,39 AU' } },

  { id:'venus', pl:'Wenus', color:0xd8b878, radius:1.15, dist:26,
    rotH:-5832.5, tilt:177.4, orbDays:225, map:'venusmap.jpg', bump:'venusbump.jpg',
    wiki:{lang:'pl', title:'Wenus'},
    facts:{ Średnica:'12 104 km', 'Doba':'243 dni (wstecz)', 'Rok':'225 dni', Temp:'+464 °C', Księżyce:'0', Odległość:'0,72 AU' } },

  { id:'earth', pl:'Ziemia', color:0x2a5fa5, radius:1.25, dist:37,
    rotH:23.93, tilt:23.44, orbDays:365.25, earth:true,
    wiki:{lang:'pl', title:'Ziemia'},
    facts:{ Średnica:'12 742 km', 'Doba':'23,93 h', 'Rok':'365,25 dni', Temp:'−88…58 °C', Księżyce:'1', Odległość:'1,00 AU' } },

  { id:'mars', pl:'Mars', color:0xc1502e, radius:0.7, dist:48,
    rotH:24.62, tilt:25.19, orbDays:687, map:'marsmap1k.jpg', bump:'marsbump1k.jpg',
    wiki:{lang:'pl', title:'Mars'},
    facts:{ Średnica:'6 779 km', 'Doba':'24,6 h', 'Rok':'687 dni', Temp:'−143…35 °C', Księżyce:'2', Odległość:'1,52 AU' } },

  { id:'jupiter', pl:'Jowisz', color:0xc9a87a, radius:3.8, dist:72,
    rotH:9.93, tilt:3.13, orbDays:4333, map:'jupitermap.jpg',
    wiki:{lang:'pl', title:'Jowisz'},
    facts:{ Średnica:'139 820 km', 'Doba':'9,9 h', 'Rok':'11,9 lat', Temp:'−108 °C', Księżyce:'95', Odległość:'5,20 AU' } },

  { id:'saturn', pl:'Saturn', color:0xd8c89a, radius:3.2, dist:100,
    rotH:10.7, tilt:26.73, orbDays:10759, map:'saturnmap.jpg', ring:'saturnringcolor.jpg',
    wiki:{lang:'pl', title:'Saturn'},
    facts:{ Średnica:'116 460 km', 'Doba':'10,7 h', 'Rok':'29,5 lat', Temp:'−139 °C', Księżyce:'146', Odległość:'9,58 AU' } },

  { id:'uranus', pl:'Uran', color:0x9fd6dd, radius:2.2, dist:128,
    rotH:-17.24, tilt:97.77, orbDays:30687, map:'uranusmap.jpg',
    wiki:{lang:'pl', title:'Uran (planeta)'},
    facts:{ Średnica:'50 724 km', 'Doba':'17,2 h (wstecz)', 'Rok':'84 lata', Temp:'−197 °C', Księżyce:'28', Odległość:'19,2 AU' } },

  { id:'neptune', pl:'Neptun', color:0x4264c8, radius:2.1, dist:152,
    rotH:16.11, tilt:28.32, orbDays:60190, map:'neptunemap.jpg',
    wiki:{lang:'pl', title:'Neptun'},
    facts:{ Średnica:'49 244 km', 'Doba':'16,1 h', 'Rok':'165 lat', Temp:'−201 °C', Księżyce:'16', Odległość:'30,1 AU' } },
];

/* ---------- Skiny: warianty tekstur per planeta (idx 0 = obecna/domyślna) ----------
   Źródła alternatyw: Land Shallow Topo (NASA, public domain) + solarsystemscope.com (CC-BY-4.0).
   Ziemia: skin definiuje mapę dzienną (dayTex); noc/spec/bump shadera bez zmian.
   Pozostałe: {map[, bump]} dla MeshPhongMaterial. */
const SKINS = {
  mercury: [{name:'Standard', map:'mercurymap.jpg', bump:'mercurybump.jpg'}, {name:'HD (2k)', map:'mercury_hd.jpg'}, {name:'Fantastyczna ✨', fx:1}],
  venus:   [{name:'Powierzchnia', map:'venusmap.jpg', bump:'venusbump.jpg'}, {name:'Atmosfera', map:'venus_atmo.jpg'}, {name:'Fantastyczna ✨', fx:2}],
  earth:   [{name:'Blue Marble', day:'earthmap1k.jpg', lod:[{file:'earthmap4k.jpg', rMul:8}, {file:'earthmap8k.jpg', rMul:2.7}]}, {name:'Topograficzna', day:'earth_topo.jpg', lod:[{file:'earth_topo_4k.jpg', rMul:8}, {file:'earth_topo_8k.jpg', rMul:2.7}]}, {name:'Światła nocy', day:'earth_night.jpg'}, {name:'Żywa Ziemia ✨', live:true}],
  mars:    [{name:'Standard', map:'marsmap1k.jpg', bump:'marsbump1k.jpg'}, {name:'HD (2k)', map:'mars_hd.jpg'}, {name:'Fantastyczna ✨', fx:3}],
  jupiter: [{name:'Standard', map:'jupitermap.jpg'}, {name:'HD (2k)', map:'jupiter_hd.jpg'}, {name:'Fantastyczna ✨', fx:4}],
  saturn:  [{name:'Standard', map:'saturnmap.jpg'}, {name:'HD (2k)', map:'saturn_hd.jpg'}, {name:'Fantastyczna ✨', fx:5}],
  uranus:  [{name:'Standard', map:'uranusmap.jpg'}, {name:'HD (2k)', map:'uranus_hd.jpg'}, {name:'Fantastyczna ✨', fx:6}],
  neptune: [{name:'Standard', map:'neptunemap.jpg'}, {name:'HD (2k)', map:'neptune_hd.jpg'}, {name:'Fantastyczna ✨', fx:7}],
};

/* ---------- Real orbital radii (AU) + moon systems ---------- */
const AU = { mercury:0.39, venus:0.72, earth:1.0, mars:1.52, jupiter:5.20, saturn:9.58, uranus:19.2, neptune:30.1 };
const R_KM = { mercury:2440, venus:6052, earth:6371, mars:3390, jupiter:69911, saturn:58232, uranus:25362, neptune:24622, sun:696340 }; // realne promienie [km] — tryb „Prawdziwa skala"
const MOONS = {  // km = realna średnica (karta info); r/dist/days = poglądowa skala sceny
  earth:[{n:'Księżyc',r:0.34,dist:4.2,days:27.3,km:3474,map:'moonmap1k.jpg',bump:'moonbump1k.jpg',wiki:{lang:'pl',title:'Księżyc'}}],
  mars:[{n:'Fobos',r:0.06,dist:1.25,days:0.32,km:23,color:0x8a7d6e,wiki:{lang:'pl',title:'Fobos (księżyc)'}},{n:'Deimos',r:0.045,dist:1.9,days:1.26,km:12,color:0x9a8d7e,wiki:{lang:'pl',title:'Deimos (księżyc)'}}],
  jupiter:[{n:'Io',r:0.28,dist:6.0,days:1.77,km:3643,color:0xe6d27a,wiki:{lang:'pl',title:'Io (księżyc)'}},{n:'Europa',r:0.24,dist:7.6,days:3.55,km:3122,color:0xe8e0cf,wiki:{lang:'pl',title:'Europa (księżyc)'}},
           {n:'Ganimedes',r:0.42,dist:9.6,days:7.15,km:5268,color:0x9a8b7a,wiki:{lang:'pl',title:'Ganimedes (księżyc)'}},{n:'Kallisto',r:0.38,dist:12,days:16.7,km:4821,color:0x6e6157,wiki:{lang:'pl',title:'Kallisto (księżyc)'}}],
  saturn:[{n:'Tytan',r:0.36,dist:8.5,days:15.9,km:5150,color:0xc9923f,wiki:{lang:'pl',title:'Tytan (księżyc)'}},{n:'Rea',r:0.14,dist:5.8,days:4.5,km:1527,color:0xb8b0a4,wiki:{lang:'pl',title:'Rea (księżyc)'}}],
  uranus:[{n:'Tytania',r:0.2,dist:4.6,days:8.7,km:1578,color:0xb9c4c4,wiki:{lang:'pl',title:'Tytania (księżyc)'}},{n:'Oberon',r:0.18,dist:6.0,days:13.5,km:1523,color:0xa9b2b2,wiki:{lang:'pl',title:'Oberon (księżyc)'}}],
  neptune:[{n:'Tryton',r:0.22,dist:4.2,days:-5.9,km:2707,color:0xcdbfae,wiki:{lang:'pl',title:'Tryton (księżyc)'}}]
};
PLANETS.forEach(p=>{ p.au=AU[p.id]; p.distC=p.dist; p.moons=MOONS[p.id]||[]; });

const SUN_RADIUS = 9;

/* ============================================================
   Scene setup
   ============================================================ */
const app = document.getElementById('app');
const scene = new THREE.Scene();

// near bardzo małe (1e-4): pozwala dolecieć do powierzchni Ziemi w „Prawdziwej skali"
// (promień ≈0.002 j.); ogromny zakres near→far obsługuje logarithmicDepthBuffer poniżej.
const camera = new THREE.PerspectiveCamera(48, innerWidth/innerHeight, 1e-4, 8000);
camera.position.set(0, 95, 230);

const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance', preserveDrawingBuffer:true, logarithmicDepthBuffer:true });
renderer.setSize = renderer.setSize.bind(renderer);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();   // ostrość tekstur przy skosie (zbliżenie)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.9;
controls.minDistance = 20;
controls.maxDistance = 1200;
controls.target.set(0,0,0);

/* ---------- Lighting: the Sun is the only real light source ---------- */
const sunLight = new THREE.PointLight(0xfff4e0, 3.2, 0, 0.9);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x223044, 0.12)); // faint fill so far planets aren't pitch black

/* ============================================================
   Loading manager
   ============================================================ */
const manager = new THREE.LoadingManager();
const loadBar = document.querySelector('#loadbar i');
const loadLbl = document.getElementById('loadLbl');
manager.onProgress = (url, done, total) => {
  loadBar.style.width = Math.round(done/total*100) + '%';
};
let loaderDone = false;
function hideLoader(){ if(loaderDone) return; loaderDone=true;
  loadLbl.textContent='Gotowe';
  setTimeout(()=>document.getElementById('loader').classList.add('hide'), 250);
}
manager.onLoad = hideLoader;
// safety: never let one slow/hanging asset block the scene
setTimeout(()=>{ loadBar.style.width='100%'; hideLoader(); }, 6000);
manager.onError = (url) => console.warn('Tekstura nie wczytana:', url);
const loader = new THREE.TextureLoader(manager);
loader.crossOrigin = 'anonymous';
function resolve(url){
  const metas=document.querySelectorAll('meta[name="ext-resource-dependency"]');
  for(const m of metas){ if(m.getAttribute('content')===url){ const id=m.dataset.resourceId;
    if(window.__resources && window.__resources[id]) return window.__resources[id]; } }
  return url;
}
function tex(file){ const t = loader.load(resolve(TEX+file)); t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO; return t; }
function texLinear(file){ const t = loader.load(resolve(TEX+file)); t.anisotropy = MAX_ANISO; return t; }

/* ============================================================
   Starfield (procedural — no external dependency)
   ============================================================ */
// referencja przechwycona: w D (skala galaktyczna) powłoka 2200–4800 nachodzi na dysk MW → visible=false (spec §4.5)
const starfieldPts = (function makeStars(){
  const N = 9000, pos = new Float32Array(N*3), col = new Float32Array(N*3);
  const c = new THREE.Color();
  for(let i=0;i<N;i++){
    const r = 2200 + Math.random()*2600;
    const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
    pos[i*3]   = r*Math.sin(ph)*Math.cos(th);
    pos[i*3+1] = r*Math.cos(ph);
    pos[i*3+2] = r*Math.sin(ph)*Math.sin(th);
    const t = Math.random();
    c.setHSL(0.55+ (Math.random()-0.5)*0.12, 0.4*Math.random(), 0.6+0.4*t);
    col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  g.setAttribute('color', new THREE.BufferAttribute(col,3));
  const m = new THREE.PointsMaterial({ size:2.4, sizeAttenuation:true, vertexColors:true,
    transparent:true, opacity:0.9, depthWrite:false });
  const pts = new THREE.Points(g,m);
  scene.add(pts);
  return pts;
})();

/* ---------- Asteryzmy (warstwa gwiazd na realnym niebie) ---------- */
const SKY_R = 2600;                          // promień sfery asteryzmów (wewnątrz starfieldu 2200–4800)
const APP_VER = '2026-11-17';                // cache-bust fetchy danych (zmień przy aktualizacji danych)
const asterism = { root:null, items:[], byName:new Map(), built:false, on:false };
let onAsterismsBuilt = null;                 // hak dla panelu (Task 5) — guard typeof === 'function'

// kierunek jednostkowy na sferze nieba z RA/Dec; raDecToSceneDir zwraca {x,y,z} (jednostkowy)
function skyDir(ra, dec){
  const d = SkyMath.raDecToSceneDir(ra, dec);
  return (d.isVector3 ? d.clone() : new THREE.Vector3(d.x, d.y, d.z)).normalize();
}

function buildAsterisms(){
  if(asterism.built) return;
  asterism.built = true;
  fetch('geo/sky-data.json?v='+APP_VER).then(r=>r.json()).then(d=>{
    const root = new THREE.Group(); root.visible = asterism.on;
    (d.asterisms||[]).forEach(a=>{
      const grp = new THREE.Group();
      // gwiazdy
      const pos = [];
      const starMeta = [];
      a.stars.forEach(s=>{
        const p = skyDir(s.ra, s.dec).multiplyScalar(SKY_R);
        pos.push(p.x, p.y, p.z);
        starMeta.push({ asterism:a.name, star:s.n, wiki:a.wiki });
      });
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const pts = new THREE.Points(sg, new THREE.PointsMaterial({ color:0xdce8ff, size:4, sizeAttenuation:false, transparent:true, opacity:0.95, depthWrite:false }));
      grp.add(pts);
      // linie (guard: pusta tablica → bez LineSegments, np. Plejady)
      const L = a.lines || [];
      if(L.length){
        const lpos = [];
        L.forEach(([i,j])=>{ lpos.push(pos[i*3],pos[i*3+1],pos[i*3+2], pos[j*3],pos[j*3+1],pos[j*3+2]); });
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
        grp.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color:0x4a6bbf, transparent:true, opacity:0.5, depthWrite:false })));
      }
      // centroid do etykiety (średnia pozycji gwiazd na sferze SKY_R)
      const c = new THREE.Vector3();
      a.stars.forEach(s=> c.add(skyDir(s.ra, s.dec)));
      c.multiplyScalar(SKY_R / a.stars.length);
      root.add(grp);
      const item = { name:a.name, group:a.group, wiki:a.wiki, grp, pts, starMeta, labelEl:null, labelPos:c, visible:true };
      asterism.items.push(item);
      asterism.byName.set(a.name, item);
    });
    scene.add(root); asterism.root = root;
    ensureAsterismLabels();
    asterism._raw = d;                                               // Task 6: DRY — reuse dla panelu (bez 2. fetcha)
    if(typeof onAsterismsBuilt === 'function') onAsterismsBuilt();   // hak dla panelu/persystencji (Task 5/6)
  }).catch(err=>console.warn('sky-data', err));
}

// etykiety asteryzmów (pula DOM, jedna per item)
function ensureAsterismLabels(){
  asterism.items.forEach(it=>{ if(it.labelEl) return;
    const el = document.createElement('div'); el.className='lab'; el.textContent=it.name;
    el.style.color='#bcd0ff'; el.style.pointerEvents='none';
    el.style.display='none'; labelLayer.appendChild(el); it.labelEl=el;
  });
}
function showAsterisms(on){
  asterism.on=on;
  if(!on) deselectConstellation();
  if(on && !asterism.built) buildAsterisms();
  // Asteryzmy = konstrukt nieba ziemskiego (kopuła SKY_R wokół Słońca) → widoczne TYLKO w Układzie
  // Słonecznym. Poza Sol (interstellar/galactic/exgalaxy/obcy) toggle pisze WYŁĄCZNIE intencję
  // (asterism.on); root ukryty — inaczej kopuła renderuje się na złej skali (klumpa wokół Słońca,
  // bo |cam| ≫ SKY_R). Intencja honorowana przy powrocie do Sol (setSceneVisible restore).
  const inSol = (cosmos.scale==='system' && cosmos.systemId==='sol');
  if(asterism.root) asterism.root.visible = on && inSol;
  asterism.items.forEach(it=>{ if(it.labelEl) it.labelEl.style.display = (on && inSol && it.visible && showLabels)?'block':'none'; });
}

// widoczność pojedynczego asteryzmu (Task 5 woła to z UI)
function setAsterismVisible(name, on){
  const it = asterism.byName.get(name); if(!it) return;
  it.visible = on; it.grp.visible = on;
  if(it.labelEl) it.labelEl.style.display = (asterism.on && on && showLabels)?'block':'none';
}
function applyAsterismVisibility(visibleSet){
  asterism.items.forEach(it=> setAsterismVisible(it.name, visibleSet.has(it.name)));
}
function getAsterismNames(){ return asterism.items.map(it=>it.name); }

function updateAsterismLabels(){
  if(!asterism.on || !asterism.root || !showLabels){
    if(asterism.on && !showLabels) asterism.items.forEach(it=>{ if(it.labelEl) it.labelEl.style.display='none'; });
    return;
  }
  asterism.items.forEach(it=>{
    if(!it.labelEl) return;
    if(!it.visible){ it.labelEl.style.display='none'; return; }
    placeLabel(it.labelEl, it.labelPos);   // placeLabel ustawia left/top + opacity (display ustawia wywołujący)
  });
}

/* ---------- Radial glow sprite (procedural canvas) ---------- */
function glowTexture(inner, outer){
  const s=256, cv=document.createElement('canvas'); cv.width=cv.height=s;
  const x=cv.getContext('2d'), g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,inner); g.addColorStop(0.4,outer); g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g; x.fillRect(0,0,s,s);
  const t=new THREE.Texture(cv); t.needsUpdate=true; return t;
}

// Deterministyczny hash (FNV-1a) — stabilne ziarno per księżyc
function moonSeed(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }

// Proceduralna powierzchnia księżyca: kolor bazowy + szum + kratery (canvas 2:1).
// Dla księżyców bez realnej mapy (decyzja: realna tylko dla Księżyca Ziemi).
function proceduralMoonTexture(baseColor, seed){
  const W=512, H=256, cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const ctx=cv.getContext('2d');
  let s=seed>>>0; const rnd=()=>{ s=(s+0x6D2B79F5)|0; let t=Math.imul(s^(s>>>15),1|s); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; // mulberry32
  const base=new THREE.Color(baseColor);
  ctx.fillStyle='#'+base.getHexString(); ctx.fillRect(0,0,W,H);
  // cętki/regiony — delikatne wahania jasności
  for(let i=0;i<5000;i++){ const px=rnd()*W, py=rnd()*H, r=0.5+rnd()*2.5;
    const c=base.clone().offsetHSL(0,0,(rnd()-0.5)*0.22);
    ctx.fillStyle='rgba('+(c.r*255|0)+','+(c.g*255|0)+','+(c.b*255|0)+','+(0.12+rnd()*0.22).toFixed(3)+')';
    ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill(); }
  // kratery — ciemne dno + jasny rąbek; gęstość zależna od ziarna
  const nCraters=50+(seed%50);
  for(let i=0;i<nCraters;i++){ const px=rnd()*W, py=rnd()*H, r=2+rnd()*rnd()*16;
    const g=ctx.createRadialGradient(px,py,0,px,py,r);
    g.addColorStop(0,'rgba(0,0,0,0.30)'); g.addColorStop(0.7,'rgba(0,0,0,0.10)'); g.addColorStop(0.96,'rgba(255,255,255,0.12)'); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill(); }
  const t=new THREE.CanvasTexture(cv); t.anisotropy=MAX_ANISO; t.encoding=THREE.sRGBEncoding; return t;
}

/* ============================================================
   The Sun
   ============================================================ */
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(SUN_RADIUS, 64, 64),
  new THREE.MeshBasicMaterial({ map: tex('sunmap.jpg'), color:0xffffff })
);
scene.add(sun);
// layered glow
[ [SUN_RADIUS*1.6,'rgba(255,230,170,0.9)','rgba(255,170,60,0.35)'],
  [SUN_RADIUS*3.4,'rgba(255,200,120,0.5)','rgba(255,140,40,0.12)'] 
].forEach(([r,a,b])=>{
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTexture(a,b),
    transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
  sp.scale.set(r*2,r*2,1); sun.add(sp);
});

/* ============================================================
   Earth — custom day/night shader (city lights on the dark side)
   ============================================================ */
function buildEarthMaterial(){
  const day   = tex('earthmap1k.jpg');
  const night = (()=>{ const t=loader.load(resolve(TEX+'earth_lights_2048.png')); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAX_ANISO; return t; })();
  const spec  = texLinear('earthspec1k.jpg');
  const bump  = texLinear('earthbump1k.jpg');
  return new THREE.ShaderMaterial({
    extensions:{ derivatives:true, fragDepth:true },  // dFdx/dFdy (relief) + gl_FragDepth (log depth buffer na WebGL1)
    uniforms:{
      dayTex:{value:day}, nightTex:{value:night}, specTex:{value:spec}, bumpTex:{value:bump},
      sunDir:{value:new THREE.Vector3(1,0,0)}, relief:{value:0}
    },
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
      void main(){
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vPosW = (modelMatrix * vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D dayTex, nightTex, specTex, bumpTex; uniform vec3 sunDir; uniform float relief;
      varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vNormalW);
        if(relief > 0.001){                              // relief terenu — siła rośnie przy zbliżeniu
          float h = texture2D(bumpTex, vUv).r;
          vec3 dpx = dFdx(vPosW), dpy = dFdy(vPosW);
          float dhx = dFdx(h), dhy = dFdy(h);
          vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx*r1 + dhy*r2);
          N = normalize(abs(det)*N - relief*60.0*grad);
        }
        float lambert = dot(N, normalize(sunDir));
        float t = smoothstep(-0.12, 0.18, lambert);      // day/night terminator
        vec3 day = texture2D(dayTex, vUv).rgb;
        vec3 night = texture2D(nightTex, vUv).rgb;
        // boost city lights, only where truly dark
        vec3 lights = night * (1.0 - t) * 2.1;
        vec3 col = mix(vec3(0.0), day, t) + lights;
        // subtle ocean specular highlight toward the sun
        float ocean = 1.0 - texture2D(specTex, vUv).r;
        vec3 V = normalize(cameraPosition - vPosW);
        vec3 H = normalize(normalize(sunDir) + V);
        float s = pow(max(dot(N,H),0.0), 24.0) * ocean * t;
        col += vec3(0.7,0.8,1.0) * s * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
}

/* ============================================================
   Fantastyczne planety — parametryczny ShaderMaterial (skin „Fantastyczna ✨").
   Każda planeta = osobny mechanizm (uMode), nie ten sam efekt przemalowany:
   1 Merkury  — termiczna dwoistość (rozżarzona strona dzienna ↔ mroźna nocna)
   2 Wenus    — super-rotujący welon kwasu siarkowego + pioruny
   3 Mars     — terraformacja (oceany w nizinach, zieleń, czapy polarne wg jasności tekstury)
   4 Jowisz   — pasy płyną (różnicowa rotacja: próbka tekstury z przesunięciem ∝ szerokość)
   5 Saturn   — zorza polarna + heksagonalny prąd strumieniowy przy biegunie
   6 Uran     — iryzujący kryształ metanowy (interferencja cienkowarstwowa, zależna od kąta)
   7 Neptun   — naddźwiękowe smugi wiatru + świecące rdzenie burz
   ============================================================ */
function buildPlanetFXMaterial(data, mode, baseTex){
  return new THREE.ShaderMaterial({
    extensions:{ fragDepth:true },
    uniforms:{
      map:{value:baseTex}, sunDir:{value:new THREE.Vector3(1,0,0)}, uTime:{value:0},
      uMode:{value:mode}, uColor:{value:new THREE.Color(data.color)}
    },
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vN; varying vec3 vPosW;
      void main(){
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        vPosW = (modelMatrix * vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D map; uniform vec3 sunDir, uColor; uniform float uTime; uniform int uMode;
      varying vec2 vUv; varying vec3 vN; varying vec3 vPosW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.02; a*=0.5; } return s; }
      void main(){
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vN);
        vec3 Vv = normalize(cameraPosition - vPosW);
        float lam = dot(N, normalize(sunDir));
        float lit = clamp(lam, 0.0, 1.0);
        vec3 texc = texture2D(map, vUv).rgb;
        float lum = dot(texc, vec3(0.299,0.587,0.114));
        float lat = abs(vUv.y - 0.5) * 2.0;             // 0 równik → 1 biegun
        vec3 col = texc * (0.3 + 0.7*lit);              // fallback
        if(uMode == 1){                                  // Merkury — wykuty w Słońcu
          float heat = smoothstep(-0.1, 0.7, lam);
          vec3 hot = mix(vec3(0.5,0.05,0.0), vec3(1.0,0.85,0.35), heat);
          float crack = smoothstep(0.5, 0.78, lum) * heat;
          vec3 day = texc*0.35 + hot*(0.6 + 0.9*crack);
          float sparkle = pow(lum,3.0)*0.4*(0.5+0.5*sin(uTime*1.6 + lum*40.0));
          vec3 night = vec3(0.02,0.04,0.09) + vec3(0.4,0.6,1.0)*sparkle;
          col = mix(night, day, heat);
        } else if(uMode == 2){                           // Wenus — kwasowy welon + pioruny
          vec2 fl = vec2(vUv.x*3.0 - uTime*0.06, vUv.y*6.0);
          float veil = fbm(fl + 1.5*vec2(fbm(fl), fbm(fl+5.0)));
          vec3 acid = mix(vec3(0.82,0.6,0.16), vec3(1.0,0.94,0.62), veil) * (0.35 + 0.65*lit);
          float lt = step(0.985, hash(floor(vec2(vUv.x*10.0, vUv.y*5.0)) + floor(uTime*4.0)));
          acid += vec3(0.8,0.9,1.0)*lt*0.9;
          col = mix(texc*0.3, acid, 0.85);
        } else if(uMode == 3){                           // Mars — terraformacja
          float elev = lum;
          float sea = smoothstep(0.42, 0.40, elev);
          vec3 ocean = vec3(0.04,0.18,0.42) + vec3(0.2,0.4,0.6)*(0.5+0.5*sin(vUv.x*120.0 + uTime*0.8))*0.05;
          ocean += vec3(0.1,0.3,0.5)*pow(1.0-max(dot(N,Vv),0.0),1.5);
          vec3 veg = mix(vec3(0.14,0.4,0.12), vec3(0.45,0.6,0.2), fbm(vUv*8.0));
          float polar = smoothstep(0.8, 0.92, lat);
          float ice = smoothstep(0.72, 0.82, elev);
          vec3 land = mix(veg, vec3(0.9,0.95,1.0), clamp(ice+polar,0.0,1.0));
          col = mix(land, ocean, sea) * (0.25 + 0.75*lit);
        } else if(uMode == 4){                           // Jowisz — płynące pasy (różnicowa rotacja)
          float speed = 0.04 * sin(vUv.y*20.0);
          vec2 uv2 = vec2(fract(vUv.x + uTime*speed), vUv.y);
          vec3 bands = texture2D(map, uv2).rgb;
          float turb = fbm(vec2(uv2.x*8.0, vUv.y*30.0) + uTime*0.1);
          bands *= (0.8 + 0.4*turb);
          float red = smoothstep(0.18, 0.5, bands.r - bands.b);
          bands += vec3(0.3,0.05,0.0)*red*(0.5+0.5*sin(uTime*0.7));
          col = bands * (0.3 + 0.7*lit);
        } else if(uMode == 5){                           // Saturn — zorza polarna + heksagon
          vec3 body = texc * (0.35 + 0.65*lit);
          float polar = smoothstep(0.78, 0.96, lat);
          float aur = polar*(0.5+0.5*sin(vUv.x*40.0 - uTime*2.0))*(0.6+0.4*fbm(vec2(vUv.x*20.0, uTime*0.3)));
          vec3 auroraCol = mix(vec3(0.2,0.9,0.6), vec3(0.6,0.3,1.0), 0.5+0.5*sin(uTime+vUv.x*10.0));
          body += auroraCol*aur*0.8;
          if(lat > 0.86){                                // heksagonalny prąd strumieniowy przy biegunie
            float ang = vUv.x*6.2831;
            float hexr = 0.9 + 0.025*cos(6.0*ang);
            body += vec3(1.0,0.7,0.3)*smoothstep(0.012,0.0, abs(lat-hexr))*0.7;
          }
          col = body;
        } else if(uMode == 6){                           // Uran — iryzujący kryształ metanowy
          float ct = max(dot(N,Vv), 0.0);
          float phase = (1.0-ct)*9.0 + lum*4.0 + uTime*0.3;
          vec3 irid = 0.5 + 0.5*cos(6.2831*(phase + vec3(0.0,0.33,0.67)));
          vec3 base = mix(vec3(0.5,0.85,0.9), irid, 0.6) * (0.4 + 0.6*lit);
          base += vec3(0.6,0.9,1.0)*smoothstep(0.72,0.92, fbm(vUv*14.0))*0.2;
          col = base;
        } else if(uMode == 7){                           // Neptun — naddźwiękowe smugi + świecące burze
          float streak = fbm(vec2(vUv.x*4.0 - uTime*0.25, vUv.y*16.0));
          vec3 wind = mix(vec3(0.05,0.12,0.5), vec3(0.6,0.8,1.0), smoothstep(0.5,0.85,streak));
          float storm = smoothstep(0.22,0.0, abs(fbm(vUv*5.0 + 3.0) - 0.7));
          wind += vec3(0.3,0.7,1.0)*storm*(0.5+0.5*sin(uTime*1.2))*0.8;
          col = mix(texc*0.2, wind, 0.9) * (0.35 + 0.65*lit);
        }
        float rim = pow(1.0 - max(dot(N,Vv),0.0), 4.0);  // subtelna obwódka atmosferyczna w barwie planety
        col += uColor * rim * 0.25;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
}

/* ============================================================
   Żywa Ziemia — powłoka atmosfery (BackSide, additive).
   Oddychający Fresnel: niebieski dzień, pomarańczowa „złota godzina" na terminatorze.
   ============================================================ */
function buildEarthAtmosphere(){
  return new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.BackSide, blending:THREE.AdditiveBlending,
    extensions:{ fragDepth:true },
    uniforms:{ sunDir:{value:new THREE.Vector3(1,0,0)}, uTime:{value:0}, uApproach:{value:0} },
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vN; varying vec3 vPosW;
      void main(){
        vN = normalize(mat3(modelMatrix) * normal);
        vPosW = (modelMatrix * vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 sunDir; uniform float uTime, uApproach;
      varying vec3 vN; varying vec3 vPosW;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vPosW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);      // jasność rośnie ku krawędzi (limb)
        float sun = dot(N, normalize(sunDir));
        float day  = smoothstep(-0.25, 0.40, sun);             // 0 noc → 1 dzień
        float dusk = exp(-pow(sun/0.16, 2.0));                 // wąski pas wokół terminatora
        vec3 col = mix(vec3(0.05,0.16,0.42), vec3(0.30,0.48,0.98), day);  // niebieska poświata
        col = mix(col, vec3(1.0,0.45,0.12), dusk*0.9);         // złota godzina (pomarańcz) na terminatorze
        float breathe = 0.90 + 0.10*sin(uTime*0.5);            // oddech atmosfery
        float a = fres * (0.18 + 0.82*max(day, dusk)) * breathe;
        gl_FragColor = vec4(col, a);
      }`
  });
}

/* ============================================================
   Żywa Ziemia — materiał powierzchni: baza (dzień/noc/terminator/miasta/specular/relief)
   + zorza polarna + bioluminescencja oceanów + wzmocnione światła miast.
   Ujawnianie efektów wg uApproach (czytelność na każdym zoomie).
   ============================================================ */
function buildEarthLiveMaterial(){
  const day   = tex('earthmap1k.jpg');
  const night = (()=>{ const t=loader.load(resolve(TEX+'earth_lights_2048.png')); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAX_ANISO; return t; })();
  const spec  = texLinear('earthspec1k.jpg');
  const bump  = texLinear('earthbump1k.jpg');
  return new THREE.ShaderMaterial({
    extensions:{ derivatives:true, fragDepth:true },
    uniforms:{
      dayTex:{value:day}, nightTex:{value:night}, specTex:{value:spec}, bumpTex:{value:bump},
      sunDir:{value:new THREE.Vector3(1,0,0)}, relief:{value:0}, uTime:{value:0}, uApproach:{value:0}
    },
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
      void main(){
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vPosW = (modelMatrix * vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D dayTex, nightTex, specTex, bumpTex; uniform vec3 sunDir;
      uniform float relief, uTime, uApproach;
      varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.02; a*=0.5; } return s; }
      void main(){
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vNormalW);
        if(relief > 0.001){                              // relief terenu (jak w bazie)
          float h = texture2D(bumpTex, vUv).r;
          vec3 dpx = dFdx(vPosW), dpy = dFdy(vPosW);
          float dhx = dFdx(h), dhy = dFdy(h);
          vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx*r1 + dhy*r2);
          N = normalize(abs(det)*N - relief*60.0*grad);
        }
        float lambert = dot(N, normalize(sunDir));
        float t = smoothstep(-0.12, 0.18, lambert);      // terminator dzień/noc
        vec3 dayc = texture2D(dayTex, vUv).rgb;
        vec3 nightc = texture2D(nightTex, vUv).rgb;
        vec3 lights = nightc * (1.0 - t) * 2.6;          // światła miast — wzmocnione (baza: 2.1)
        vec3 col = mix(vec3(0.0), dayc, t) + lights;
        float ocean = 1.0 - texture2D(specTex, vUv).r;
        vec3 V = normalize(cameraPosition - vPosW);
        vec3 H = normalize(normalize(sunDir) + V);
        float s = pow(max(dot(N,H),0.0), 24.0) * ocean * t;
        col += vec3(0.7,0.8,1.0) * s * 0.6;              // specular oceanu (jak baza)

        // --- WARSTWY ŻYCIA ---
        float lat = abs(vUv.y - 0.5) * 2.0;              // 0 równik → 1 biegun
        float night = smoothstep(0.18, -0.28, lambert);
        // Zorza polarna — owal ~60-75° szer., migotanie, mocniej po stronie nocnej
        float oval = smoothstep(0.62, 0.74, lat) * (1.0 - smoothstep(0.88, 0.99, lat));
        float shimmer = 0.5 + 0.5*sin(uTime*1.7 + vUv.x*30.0 + fbm(vec2(vUv.x*8.0, uTime*0.4))*7.0);
        vec3 auroraCol = mix(vec3(0.2,1.0,0.55), vec3(0.5,0.3,1.0), 0.5+0.5*sin(uTime*0.6 + vUv.x*6.0));
        col += auroraCol * oval * shimmer * (0.3 + 0.7*night) * smoothstep(0.0, 0.25, uApproach) * 1.1;
        // Bioluminescencja oceanów — maska oceanu × noc × płynące smugi
        float bloom = fbm(vUv*vec2(14.0,7.0) + vec2(uTime*0.05, -uTime*0.03));
        float biolum = smoothstep(0.55, 0.80, bloom) * ocean * night;
        col += vec3(0.10,0.85,0.95) * biolum * smoothstep(0.15, 0.5, uApproach) * 0.9;

        gl_FragColor = vec4(col, 1.0);
      }`
  });
}

/* ============================================================
   Żywa Ziemia — materiał chmur (na istniejącej powłoce p._clouds, radius*1.015).
   Kłębienie/dryf + konwekcyjne pojaśnienie + błyskawice burz po stronie nocnej.
   ============================================================ */
function buildEarthCloudFXMaterial(){
  return new THREE.ShaderMaterial({
    transparent:true, depthWrite:false,
    extensions:{ fragDepth:true },
    uniforms:{ cloudTex:{value:tex('earthcloudmap.jpg')}, sunDir:{value:new THREE.Vector3(1,0,0)}, uTime:{value:0}, uApproach:{value:0} },
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vN;
      void main(){
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D cloudTex; uniform vec3 sunDir; uniform float uTime, uApproach;
      varying vec2 vUv; varying vec3 vN;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.02; a*=0.5; } return s; }
      void main(){
        #include <logdepthbuf_fragment>
        // kłębienie: delikatne zaburzenie UV (chmury żyją, nie rozmazując kształtu) + powolny dryf na zachód
        vec2 warp = vec2(fbm(vUv*3.0 + vec2(uTime*0.03, 0.0)), fbm(vUv*3.0 + vec2(5.2, uTime*0.025)));
        vec2 uvc = vUv + (warp - 0.5)*0.012;
        uvc.x = fract(uvc.x + uTime*0.004);
        float c = texture2D(cloudTex, uvc).r;            // gęstość chmur
        float lambert = dot(normalize(vN), normalize(sunDir));
        float t = smoothstep(-0.10, 0.25, lambert);
        vec3 col = vec3(1.0) * (0.12 + 0.88*t);          // białe za dnia, ciemne nocą
        float conv = smoothstep(0.62, 0.95, c) * t;      // konwekcyjne pojaśnienie czubków burz
        col += vec3(0.12) * conv;
        float alpha = smoothstep(0.18, 0.6, c) * 0.9;
        // BŁYSKAWICE: błyski w gęstych komórkach po stronie nocnej, ujawniane przy zbliżeniu
        float night = smoothstep(0.10, -0.20, lambert);
        float cell = step(0.60, c);
        float spk = step(0.9975, hash(floor(vUv*vec2(40.0,20.0)) + floor(uTime*7.0)));
        float bolt = cell * spk * night * smoothstep(0.35, 0.7, uApproach);
        col += vec3(0.8,0.9,1.0) * bolt * 3.0;
        alpha = max(alpha, bolt);                        // błysk widoczny nawet tam, gdzie chmura cienka
        gl_FragColor = vec4(col, alpha);
      }`
  });
}

/* ============================================================
   Moon shader — „żywe światy" (Io lawa, Europa ocean, Tytan haze, rim dla reszty)
   ============================================================ */
// Cechy „żywych światów" per księżyc (id z MOONS).
// glow: 0=brak, 1=ocean/lineae(noc), 2=lawa(puls), 3=zorza(bieguny), 4=iskrzenie lodu, 5=świecące kaniony, 6=mgła(Tytan).
const MOON_FX = {
  Io:        { tint:[1.05,0.95,0.6], rim:[1.0,0.7,0.2], rimAmt:0.5, glow:2, glowCol:[1.0,0.45,0.1], glowAmt:1.2 },
  Europa:    { tint:[0.95,0.97,1.0], rim:[0.6,0.8,1.0], rimAmt:0.45, glow:1, glowCol:[0.2,0.5,0.9], glowAmt:0.7 },
  Tryton:    { tint:[0.95,0.9,1.0],  rim:[0.7,0.85,1.0],rimAmt:0.55, glow:1, glowCol:[0.5,0.5,0.7], glowAmt:0.35 },
  Tytan:     { tint:[1.1,0.75,0.35], rim:[1.0,0.6,0.2], rimAmt:0.7,  glow:6, glowCol:[1.0,0.7,0.3], glowAmt:1.0 },
  // „fantastyczne księżyce": Jowisz (Ganimedes/Kallisto), Saturn (Rea), Uran (Tytania/Oberon)
  Ganimedes: { tint:[0.95,0.93,0.88], rim:[0.6,0.85,1.0], rimAmt:0.4,  glow:3, glowCol:[0.35,1.0,0.65], glowAmt:1.0 },  // zorze polarne
  Kallisto:  { tint:[0.78,0.74,0.70], rim:[0.7,0.8,0.95], rimAmt:0.35, glow:4, glowCol:[0.75,0.85,1.0], glowAmt:0.8 },  // ciemny lód + iskry kraterów
  Rea:       { tint:[1.05,1.05,1.08], rim:[0.8,0.9,1.0],  rimAmt:0.5,  glow:4, glowCol:[0.9,0.97,1.0],  glowAmt:0.95 }, // jasny mróz, iskrzenie
  Tytania:   { tint:[0.85,0.92,0.95], rim:[0.45,0.9,1.0], rimAmt:0.6,  glow:5, glowCol:[0.4,0.95,1.0],  glowAmt:1.0 },  // świecące kaniony
  Oberon:    { tint:[0.70,0.60,0.58], rim:[0.9,0.6,0.5],  rimAmt:0.4,  glow:4, glowCol:[1.0,0.4,0.2],   glowAmt:0.8 }   // czerwone dna kraterów
};
const MOON_FX_DEFAULT = { tint:[1,1,1], rim:[0.8,0.85,1.0], rimAmt:0.3, glow:0, glowCol:[0,0,0], glowAmt:0 };

function buildMoonMaterial(moon, planetId){
  const map = moon.map ? tex(moon.map) : proceduralMoonTexture(moon.color||0xcfd3da, moonSeed(planetId+':'+moon.n));
  const fx = MOON_FX[moon.n] || MOON_FX_DEFAULT;
  const hasBump = !!moon.bump;                          // tylko Księżyc Ziemi ma realną mapę reliefu (moonbump1k)
  return new THREE.ShaderMaterial({
    extensions:{ fragDepth:true, derivatives:true },   // fragDepth: log-depth (WebGL1); derivatives: relief kraterów (dFdx/dFdy)
    uniforms:{
      map:{value:map}, sunDir:{value:new THREE.Vector3(1,0,0)}, uTime:{value:0},
      bumpTex:{value: hasBump ? texLinear(moon.bump) : map}, relief:{value:0},  // relief: 0 z daleka → ramp przy zbliżeniu (animate); fallback=map (nigdy nie próbkowany gdy relief=0)
      tint:{value:new THREE.Vector3().fromArray(fx.tint)},
      rimColor:{value:new THREE.Vector3().fromArray(fx.rim)}, rimAmt:{value:fx.rimAmt},
      glowMode:{value:fx.glow}, glowColor:{value:new THREE.Vector3().fromArray(fx.glowCol)}, glowAmt:{value:fx.glowAmt},
      // sceniczne oświetlenie (ustawiane per klatkę w animate): zaćmienie w cieniu planety + planetshine
      uEclipse:{value:0}, uPlanetDir:{value:new THREE.Vector3(0,1,0)},
      uPlanetColor:{value:new THREE.Vector3()}, uPlanetAmt:{value:0}
    },
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vN; varying vec3 vPosW;
      void main(){
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        vPosW = (modelMatrix * vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D map, bumpTex;
      uniform vec3 sunDir, tint, rimColor, glowColor, uPlanetDir, uPlanetColor;
      uniform float uTime, rimAmt, glowAmt, relief, uEclipse, uPlanetAmt;
      uniform int glowMode;
      varying vec2 vUv; varying vec3 vN; varying vec3 vPosW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.02; a*=0.5; } return s; }
      void main(){
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vN);
        if(relief > 0.001){                                          // relief kraterów (Księżyc Ziemi) — z mapy wysokości, screen-space (jak Ziemia)
          float h = texture2D(bumpTex, vUv).r;
          vec3 dpx = dFdx(vPosW), dpy = dFdy(vPosW);
          float dhx = dFdx(h), dhy = dFdy(h);
          vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx*r1 + dhy*r2);
          N = normalize(abs(det)*N - relief*60.0*grad);
        }
        vec3 albedo = texture2D(map, vUv).rgb * tint;
        float lambert = dot(N, normalize(sunDir));
        float sunlit = clamp(lambert, 0.0, 1.0) * (1.0 - 0.95*uEclipse);   // cień planety gasi światło słoneczne
        vec3 base = albedo * (sunlit*0.92 + 0.08);
        // planetshine — wypełnienie odbitym światłem planety na stronie zwróconej ku niej (np. blask Jowisza na Europie)
        base += albedo * uPlanetColor * (max(dot(N, uPlanetDir),0.0) * uPlanetAmt);
        vec3 V = normalize(cameraPosition - vPosW);
        float fres = pow(1.0 - max(dot(N,V),0.0), 3.0);
        vec3 col = base + rimColor * fres * rimAmt;
        // wewnętrzne „życie" — nie gaśnie w zaćmieniu (źródło wewnętrzne / rozpraszanie atmosferyczne)
        if(glowMode == 1){                                            // Europa/Tryton — świecące lineae na stronie nocnej (przepływ podpowierzchniowy)
          float night = smoothstep(0.15, -0.4, lambert);
          vec2 q = vUv*vec2(3.0, 10.0);                              // rozciągnięte UV → liniowe pęknięcia (chaos terrain)
          float lin = fbm(q + vec2(uTime*0.02, 0.0));
          float crack = smoothstep(0.16, 0.0, abs(fract(lin*3.0) - 0.5));
          float caustic = 0.55 + 0.45*sin(lin*14.0 - uTime*1.4);     // migotanie kaustyk
          col += glowColor * glowAmt * night * (0.3 + crack*caustic);
        } else if(glowMode == 2){                                     // Io — pełzająca skorupa + pękające szczeliny lawy (domain-warp fbm)
          vec2 p = vUv*7.0;
          vec2 wv = vec2(fbm(p + vec2(uTime*0.05, 1.3)), fbm(p + vec2(4.7, uTime*0.04)));
          float crust = fbm(p + 1.8*wv);                             // pole skorupy adwektowane w czasie
          float thr = 0.5 + 0.05*sin(uTime*0.5);
          float crack = smoothstep(0.05, 0.0, abs(crust - thr));     // cienka rozżarzona szczelina (otwiera się/zamyka)
          float pool  = smoothstep(0.66, 0.86, crust);               // gorące jeziora magmy
          float pulse = 0.7 + 0.3*sin(uTime*1.2 + crust*22.0);
          col += glowColor * glowAmt * (crack*1.5 + pool) * pulse;
        } else if(glowMode == 3){                                     // Ganimedes — zorza polarna (pasy przy biegunach)
          float plat = abs(vUv.y - 0.5) * 2.0;                       // 0 = równik, 1 = biegun
          float band = smoothstep(0.5, 0.78, plat) * (1.0 - smoothstep(0.93, 1.0, plat));
          float shim = 0.55 + 0.45*sin(uTime*1.6 + vUv.x*22.0 + noise(vUv*vec2(8.0,3.0))*9.0);
          float night = smoothstep(0.25, -0.35, lambert);            // mocniej po stronie nocnej
          col += glowColor * glowAmt * band * shim * (0.35 + 0.65*night);
        } else if(glowMode == 4){                                     // Kallisto/Rea/Oberon — iskrzenie lodu/szronu (migoczące punkty)
          float n = noise(vUv*42.0);
          float sp = smoothstep(0.84, 0.97, n);
          float tw = 0.4 + 0.6*sin(uTime*4.0 + n*60.0);
          col += glowColor * glowAmt * sp * tw;
        } else if(glowMode == 5){                                     // Tytania — świecące kaniony (cienkie linie)
          float cval = noise(vUv*5.0);
          float lines = smoothstep(0.46, 0.5, cval) * (1.0 - smoothstep(0.5, 0.54, cval));
          float pulse = 0.7 + 0.3*sin(uTime*1.5 + cval*8.0);
          col += glowColor * glowAmt * lines * pulse * 4.0;          // ×4 — wąskie pasmo linii
        } else if(glowMode == 6){                                     // Tytan — gęsta mgła: rozpraszanie do przodu + aureola na limbie
          float backlit = pow(max(-lambert, 0.0), 0.6);              // Słońce za księżycem → świecąca obwódka
          float limb = pow(1.0 - max(dot(N,V),0.0), 1.6);
          float haze = 0.7 + 0.3*fbm(vUv*5.0 + vec2(uTime*0.03, 0.0));
          col += glowColor * glowAmt * limb * (0.25 + backlit*1.3) * haze;
        }
        gl_FragColor = vec4(col, 1.0);
      }`
  });
}

/* ============================================================
   Build planets
   ============================================================ */
const bodies = []; // {data, pivot, mesh, group}
const labelEls = {};
const labelLayer = document.getElementById('labels');
const flowOrbitMats = [];                       // materiały Kepler-flow (uTime aktualizowany w animate)

PLANETS.forEach(p=>{
  // pivot at sun, rotates to create orbit; group holds the planet at orbit distance
  const pivot = new THREE.Object3D();
  scene.add(pivot);

  const group = new THREE.Object3D();         // applies axial tilt + holds planet
  group.position.x = p.dist;
  pivot.add(group);

  let mat;
  if(p.earth){
    mat = buildEarthMaterial();
  }else{
    const o = { color: p.color };
    if(p.map) o.map = tex(p.map);
    if(p.bump){ o.bumpMap = texLinear(p.bump); o.bumpScale = 0.04; }
    o.shininess = 4;
    mat = new THREE.MeshPhongMaterial(o);
  }
  const mesh = SystemRender.buildBodyMesh(p.radius, mat);
  mesh.userData.id = p.id;
  group.add(mesh);

  // axial tilt — Ziemia: oś nachylona wokół X (ku +Z = ekliptyczna dł. 90°), by deklinacja
  // Słońca i pory roku były poprawne; pozostałe planety: poglądowo wokół Z.
  if(p.earth) group.rotation.x = p.tilt * DEG;
  else group.rotation.z = p.tilt * DEG;

  // Saturn ring
  if(p.ring){
    const inner = p.radius*1.35, outer = p.radius*2.3;
    const rg = new THREE.RingGeometry(inner, outer, 96);
    // remap UVs so texture runs radially
    const pos = rg.attributes.position, uv = rg.attributes.uv, v3 = new THREE.Vector3();
    for(let i=0;i<pos.count;i++){
      v3.fromBufferAttribute(pos,i);
      const r = v3.length();
      uv.setXY(i, (r-inner)/(outer-inner), 0.5);
    }
    const rmat = new THREE.MeshBasicMaterial({ map:tex(p.ring), side:THREE.DoubleSide,
      transparent:true, opacity:0.92 });
    const ring = new THREE.Mesh(rg, rmat);
    ring.rotation.x = Math.PI/2;
    mesh.add(ring);
  }

  // Earth clouds + Moon
  if(p.earth){
    const cloudMat = new THREE.MeshLambertMaterial({
      map: tex('earthcloudmap.jpg'),
      alphaMap: texLinear('earthcloudmaptrans.jpg'),
      transparent:true, opacity:0.85, depthWrite:false });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(p.radius*1.015, 48, 48), cloudMat);
    mesh.add(clouds);
    p._clouds = clouds;
  }

  // Moons (lit by the Sun, like the planets)
  p._moons = [];
  p.moons.forEach(mn=>{
    const mp = new THREE.Object3D();
    mp.rotation.y = Math.random()*Math.PI*2;
    group.add(mp);
    const mmat = buildMoonMaterial(mn, p.id);
    const mm = new THREE.Mesh(new THREE.SphereGeometry(mn.r, 24, 24), mmat);
    mm.position.x = mn.dist;
    mm.userData = { moonParent:p.id, moonIdx:p._moons.length };   // do raycastu/focusu
    mp.add(mm);
    // pierścień orbity księżyca (dziecko group → podąża za planetą i jej nachyleniem)
    const oseg=96, opts=[], ophs=[];
    for(let i=0;i<=oseg;i++){ const a=i/oseg*Math.PI*2;
      opts.push(new THREE.Vector3(Math.cos(a)*mn.dist, 0, Math.sin(a)*mn.dist)); ophs.push(i/oseg); }
    const moonOrbit = buildFlowOrbit(opts, ophs, (mn.color||0xcfd3da), {opacity:0.3});
    moonOrbit.visible=false;                       // domyślnie ukryty (pokazywany przy focusie)
    group.add(moonOrbit);
    p._moons.push({ pivot:mp, mesh:mm, data:mn, days:mn.days, orbit:moonOrbit });
  });

  // orbit ring line
  const orbitLine = SystemRender.buildOrbitLine(p.dist, 0x4a5a7a);
  scene.add(orbitLine);
  p._orbitLine = orbitLine;

  // random starting orbital angle
  pivot.rotation.y = Math.random()*Math.PI*2;

  bodies.push({ data:p, pivot, group, mesh });

  // label
  const el = SystemRender.buildLabel(p.pl, p.color, ()=>focusBody(p.id), labelLayer);
  labelEls[p.id]=el;
});

/* sun label */
const sunLabel=document.createElement('div'); sunLabel.className='lab'; sunLabel.textContent='Słońce';
sunLabel.style.color='#ffcf7a'; sunLabel.onclick=()=>focusSun(); labelLayer.appendChild(sunLabel);

/* ============================================================
   Asteroid belt (between Mars and Jupiter)
   ============================================================ */
const beltGroup = new THREE.Object3D(); scene.add(beltGroup);
const BELT_COUNT = 1800;
const beltMesh = new THREE.InstancedMesh(
  new THREE.IcosahedronGeometry(1, 0),
  new THREE.MeshStandardMaterial({ color:0x8c8276, roughness:1, metalness:0, flatShading:true }),
  BELT_COUNT
);
beltMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
beltGroup.add(beltMesh);
const beltData = [];
for(let i=0;i<BELT_COUNT;i++){
  beltData.push({ ang:Math.random()*Math.PI*2, rNorm:Math.random(),
    y:(Math.random()-0.5), s:0.04+Math.random()*0.15,
    rot:new THREE.Euler(Math.random()*6,Math.random()*6,Math.random()*6) });
}
const _bm=new THREE.Matrix4(), _bq=new THREE.Quaternion(), _bs=new THREE.Vector3(), _bp=new THREE.Vector3();
function positionBelt(inner, outer){
  for(let i=0;i<BELT_COUNT;i++){
    const d=beltData[i], r=inner+(outer-inner)*d.rNorm;
    _bp.set(Math.cos(d.ang)*r, d.y*(outer-inner)*0.05, Math.sin(d.ang)*r);
    _bq.setFromEuler(d.rot); _bs.setScalar(d.s);
    _bm.compose(_bp,_bq,_bs); beltMesh.setMatrixAt(i,_bm);
  }
  beltMesh.instanceMatrix.needsUpdate = true;
}

/* ============================================================
   Distance scale: compressed (overview) vs realistic (AU)
   ============================================================ */
const AU_SCALE = 46;
let realScale = false;
function rebuildOrbit(p, d){
  const seg=160, a=new Float32Array((seg+1)*3);
  for(let i=0;i<=seg;i++){ const t=i/seg*Math.PI*2; a[i*3]=Math.cos(t)*d; a[i*3+2]=Math.sin(t)*d; }
  p._orbitLine.geometry.setAttribute('position', new THREE.BufferAttribute(a,3));
  p._orbitLine.geometry.attributes.position.needsUpdate = true;
}
function beltBounds(){
  const mC=PLANETS.find(p=>p.id==='mars').distC, jC=PLANETS.find(p=>p.id==='jupiter').distC;
  return realScale ? [2.1*AU_SCALE, 3.3*AU_SCALE] : [mC+6, jC-8];
}
function applyScale(real){
  realScale = real;
  bodies.forEach(b=>{ const d = real ? b.data.au*AU_SCALE : b.data.distC;
    b.group.position.x = d; rebuildOrbit(b.data, d); });
  const [inner,outer]=beltBounds(); positionBelt(inner,outer);
  if(focused) focusBody(focused.id); else goSystem();
  updateMoonOrbits();
}

/* ---------- Tryb „Prawdziwa skala": rozmiary ciał realne względem odległości (planety = kropki) ---------- */
const AU_KM = Orbit.AU_KM;           // 1.495978707e8 — jedno źródło z orbit.js (render km→scena spójny z dynamiką lotu, nie 1.496e8)
let trueScale=false, trueDots=null;
const trueRadius = km => km/AU_KM*AU_SCALE;          // realny promień w jednostkach sceny
function applyTrueScale(on){
  trueScale = on;
  bodies.forEach(b=>{ const km=R_KM[b.data.id]; const f = (on && km) ? trueRadius(km)/b.data.radius : 1;
    b.mesh.scale.setScalar(f);
    if(b.data._moons && !b.data.earth) b.data._moons.forEach(m=> m.pivot.visible = !on); });  // księżyce innych planet (poglądowe) — ukryj
  sun.scale.setScalar(on ? trueRadius(R_KM.sun)/SUN_RADIUS : 1);
  // Ziemia–Księżyc realnie: ~384 400 km, promień 1737 km (w prawdziwej skali); poglądowo poza nią
  const eb=bodies.find(b=>b.data.earth), em = eb.data._moons && eb.data._moons[0];
  if(em){ const mm=em.pivot.children[0], md=MOONS.earth[0];
    mm.position.x = on ? trueRadius(384400) : md.dist;
    mm.scale.setScalar(on ? trueRadius(1737)/md.r : 1);
    if(em.orbit) em.orbit.scale.setScalar(on ? trueRadius(384400)/md.dist : 1);   // pierścień podąża za realną odległością
    em.pivot.visible = true; }
  // satelity: w prawdziwej skali realne wysokości (skala AU); przeliczane na bieżąco
  if(sats.points){ sats.points.visible = true; if(sats.active) repropagateSatellites(new Date(reality.clockMs)); }
  if(on){
    if(!trueDots){ trueDots=new THREE.Points(new THREE.BufferGeometry(),
      new THREE.PointsMaterial({color:0xffffff, size:4, sizeAttenuation:false, transparent:true, depthWrite:false})); scene.add(trueDots); }
    const pts = bodies.map(b=>worldPos(b));                         // kropki = pozycje planet (widoczne mimo realnie znikomych rozmiarów)
    if(em){ const mm=em.pivot.children[0]; mm.updateWorldMatrix(true,false); pts.push(mm.getWorldPosition(new THREE.Vector3())); }  // + Księżyc
    trueDots.geometry.setFromPoints(pts);
    trueDots.visible=true;
  } else if(trueDots) trueDots.visible=false;
  updateMoonOrbits();
}
// initial belt placement (compressed)
(()=>{ const [i,o]=beltBounds(); positionBelt(i,o); })();

/* ============================================================
   Flythrough tour ("Tryb przelotu")
   ============================================================ */
let tour = null;
function startTour(){
  tour = { seq:['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune'], i:-1, next:0 };
  const btn=document.getElementById('tourBtn'); btn.classList.add('on'); btn.textContent='■ Zatrzymaj przelot';
}
function stopTour(){
  tour=null; const btn=document.getElementById('tourBtn');
  btn.classList.remove('on'); btn.textContent='▶ Tryb przelotu'; goSystem();
}
function toggleTour(){ tour ? stopTour() : startTour(); }

/* ============================================================
   Tryb „Rzeczywistość" — realne pozycje (ephemerydy) + komety
   ============================================================ */
// Kuratorowane komety (elementy ~osculating; a[AU], kąty[st]; tempa pomijalne → 0).
// Hiperboliczne (e>1) — międzygwiezdne. node=Ω, peri=ϖ (długość perihelium), L≈peri+M0.
const COMETS = [
  {id:'halley', name:'1P/Halley', pl:'Kometa Halleya', a:17.834,e:0.96714,I:162.26,peri:111.33,node:58.42,L:111.33+38, color:0x9fd6ff,
   wiki:{lang:'pl', title:'Kometa Halleya'},
   desc:'Najsłynniejsza kometa — widoczna z Ziemi co ~76 lat. Ostatni przelot 1986, następny ok. 2061.',
   facts:{Typ:'krótkookresowa', Mimośród:'0,967', Perihelium:'0,59 AU', Nachylenie:'162° (wsteczna)', Okres:'~76 lat', Średnica:'~11 km'}},
  {id:'halebopp', name:'Hale-Bopp', pl:'Hale-Bopp', a:186.0,e:0.995,I:89.4,peri:130.6,node:282.5,L:130.6+0.5, color:0xb8e0ff,
   wiki:{lang:'pl', title:"Kometa Hale'a-Boppa"},
   desc:'Wielka Kometa 1997 — jedna z najjaśniejszych i najdłużej widocznych komet XX wieku.',
   facts:{Typ:'długookresowa', Mimośród:'0,995', Perihelium:'0,91 AU', Nachylenie:'89,4°', Okres:'~2500 lat', Średnica:'~60 km'}},
  {id:'neowise', name:'C/2020 F3 NEOWISE', pl:'NEOWISE', a:358.0,e:0.99921,I:128.9,peri:37.3,node:61.0,L:37.3+0.3, color:0xffe0a0,
   wiki:{lang:'en', title:'Comet NEOWISE'},
   desc:'Spektakularna kometa lata 2020 — widoczna gołym okiem o świcie.',
   facts:{Typ:'długookresowa', Mimośród:'0,999', Perihelium:'0,29 AU', Nachylenie:'129°', Okres:'~6800 lat', Średnica:'~5 km'}},
  {id:'oumuamua', name:'1I/ʻOumuamua', pl:'ʻOumuamua', a:-1.279,e:1.201,I:122.7,peri:241.8,node:24.6,L:241.8+10, color:0xff9f7a,
   wiki:{lang:'pl', title:'Oumuamua'},
   desc:'Pierwszy znany obiekt międzygwiezdny (2017) — wydłużony kształt, przyspieszał bez widocznego ogona.',
   facts:{Typ:'międzygwiezdny', Mimośród:'1,20 (hiperboliczna)', Perihelium:'0,26 AU', Nachylenie:'123°', Okres:'— (przelot jednorazowy)', Rozmiar:'~100–1000 m'}},
  {id:'borisov', name:'2I/Borisov', pl:'2I/Borisov', a:-0.851,e:3.357,I:44.05,peri:209.1,node:308.1,L:209.1+20, color:0xff7a9f,
   wiki:{lang:'pl', title:'2I/Borisov'},
   desc:'Pierwsza zaobserwowana kometa międzygwiezdna (2019) — skład podobny do komet Układu Słonecznego.',
   facts:{Typ:'międzygwiezdna', Mimośród:'3,36 (hiperboliczna)', Perihelium:'2,0 AU', Nachylenie:'44°', Okres:'— (przelot jednorazowy)', Średnica:'~0,5 km'}}
];

const CLOCK_SCALE = 1; // czas rzeczywisty 1:1 — doba Ziemi ~24 h, LEO ~90 min/obieg (pokazujemy rzeczywistość)
const reality = { active:false, cometOrbits:[], cometMarkers:[], planetOrbits:[], savedFar:0, clockMs:0, satAccum:0 };

const WARP_STEPS = [1, 5, 10, 50, 100, 1000, 10000, 100000];
const WARP_SAT_FREEZE = 50;                       // od ×50 zamrażamy SGP4 (iteracyjne, nie analityczne)
const flight = { active:false, clockMs:0, warpIdx:0, savedTrueScale:false, predictTarget:null, get warp(){ return WARP_STEPS[this.warpIdx]; } };
const ship = {
  active:false, center:'earth',
  coe:null,                       // SSOT coastu (fixed-epoch): {a,e,i,Om,w,nu,M0,t0,n,p}
  r:{x:0,y:0,z:0}, v:{x:0,y:0,z:0},
  regime:'elliptic', flag:null,
  nodes:[], selNode:-1, _lastCp:null,   // M2 kolejka N: ship.nodes=[{t(s), pnr:{pro,nor,rad}(m/s)}] (intencja, NIE SSOT); selNode=indeks edytowanego (−1 brak); _lastCp=ostatni chainPath (marker-drag/+węzeł/live-preview)
  stats:null,
  mesh:null, trail:null, orbitLine:null, predictLine:null, nodeMarker:null, nodeArrow:null, nodeHandles:null, predictSegs:null, predictMarks:null,
  lastGoodCoe:null
};
// M2: wybrany węzeł (edytowany suwakami/uchwytami/marker-dragiem) lub null. KSP: editory aktywne tylko gdy hasSel().
function selN(){ return ship.selNode >= 0 ? ship.nodes[ship.selNode] : null; }
function hasSel(){ return ship.selNode >= 0 && !!ship.nodes[ship.selNode]; }
// orbita+centrum „tuż-przed-burnem" wybranego węzła: selNode=0 → ship.coe/center; >0 → _lastCp.legs[selNode].preCoe (cache) — marker-drag/gizmo/nodeStateAtT poprawne cross-SOI
function selBase(){
  if(ship.selNode < 0 || !ship._lastCp || !ship._lastCp.legs || !ship._lastCp.legs[ship.selNode]) return { coe: ship.coe, center: ship.center };
  const leg = ship._lastCp.legs[ship.selNode];   // także selNode=0: preCoe==ship.coe (te same elementy) gdy bez crossingu; poprawne gdy node0 za granicą SOI
  return { coe: leg.preCoe, center: leg.preCenter };
}

/* ============================================================
   Kosmiczny zoom — skala interstellar (SSOT). ⚠️ Filar 1:1 nietknięty:
   gałąź pasywna w animate() rusza WYŁĄCZNIE dla (system + sol); poza
   tym stanem gate na górze animate() renderuje osobną ścieżką.
   ============================================================ */
const cosmos = { scale:'system', systemId:'sol', transitioning:false };
// ⚠️ ENTER > overview Sol (realScale): goSystem() kadruje Neptuna (~1384 j.) z ~2124 j., więc próg
// wejścia MUSI być powyżej 2124 — inaczej scena Sol auto-wchodzi w interstellar przy starcie.
// EXIT (B→A) = zoom „w Słońce" (origin): dostrojony PONIŻEJ najbliższej gwiazdy (Proxima ~187 j.
// przy LY_SCENE=44), żeby swobodny obrót/zoom w klastrze NIE wyrzucał spuriously do Sol — powrót
// tylko gdy kamera dojedzie niemal do origin. Reconciliacja skali LY_SCENE↔dystans kamery:
// enterInterstellar/exitToInterstellar wołają frameInterstellar() → kamera na ~clusterRadius·1,9,
// klaster (najdalsza gwiazda ~2226 j.) wypełnia kadr; gwiazdy widoczne (PointsMaterial sizeAttenuation:false).
const COSMO_ENTER = 3000;  // dystans kamery [j. sceny]: zoom-out powyżej → interstellar (tunable)
const COSMO_EXIT  = 150;   // zoom-in „w Słońce" poniżej → powrót do Sol (histereza EXIT ≪ ENTER; < Proxima 187)
let interstellarGroup = null;   // THREE.Group z punktami gwiazd sąsiedztwa
let interstellarPts = null;     // referencja do chmury THREE.Points (reposycja przy ruchu własnym)
let SYSTEMS = [];               // z cosmo/systems.json
fetch('cosmo/systems.json?v='+APP_VER).then(r=>r.json()).then(d=>{ SYSTEMS = d.systems || []; })
  .catch(e=>console.error('systems.json', e));
let BINARIES = {};             // z cosmo/binaries.json — towarzysze gwiazd podwójnych/wielokrotnych (per id układu)
// Gate dolotu (finding #8): buildStarSystem czyta BINARIES synchronicznie — bez gate klik w Syriusza
// przed rozwiązaniem fetchu budował scenę BEZ towarzysza (i z innym kadrem), bez żadnego błędu.
// Race z timeoutem 4 s: offline/wolny serwer nie blokuje nawigacji — wtedy scena bez towarzyszy + warn.
const binariesReady = fetch('cosmo/binaries.json?v='+APP_VER).then(r=>r.json()).then(d=>{ BINARIES = d || {}; })
  .catch(e=>console.error('binaries.json', e));
const binariesGate = Promise.race([binariesReady, new Promise(res=>setTimeout(()=>res('timeout'), 4000))])
  .then(v=>{ if(v==='timeout') console.warn('binaries.json: timeout — dolot może nie mieć towarzyszy'); });
let PM = {};                   // z cosmo/proper-motion.json — ruch własny gwiazd [mas/yr] (suwak w B, stage 5)
fetch('cosmo/proper-motion.json?v='+APP_VER).then(r=>r.json()).then(d=>{ PM = d || {}; })
  .catch(e=>console.error('proper-motion.json', e));

// ekliptyka (AU) → pozycja sceny (Vector3), z mapowaniem y=up
function eclToScene(p){ return new THREE.Vector3(p.x*AU_SCALE, p.z*AU_SCALE, p.y*AU_SCALE); }

// km (planetocentryczna ekliptyka) → pozycja sceny, względem centrum (ten sam swap co eclToScene, bez obrotu)
function kmToScene(rKm, centerSceneVec3){
  const f = AU_SCALE / AU_KM;                       // AU_KM = Orbit.AU_KM, spójne z trueRadius i dynamiką lotu
  return new THREE.Vector3(
    centerSceneVec3.x + rKm.x * f,                  // ekl.x → scena.x
    centerSceneVec3.y + rKm.z * f,                  // ekl.z → scena.y (up)
    centerSceneVec3.z + rKm.y * f);                 // ekl.y → scena.z
}

function buildFlowOrbit(points, phases, colorHex, opts){
  const g = new THREE.BufferGeometry().setFromPoints(points);
  g.setAttribute('phase', new THREE.BufferAttribute(new Float32Array(phases), 1));
  const mat = new THREE.ShaderMaterial({
    extensions:{ fragDepth:true }, transparent:true, depthWrite:false,
    uniforms:{ uColor:{value:new THREE.Color(colorHex)}, uTime:{value:0},
      uSpeed:{value:0.12}, uBase:{value:(opts&&opts.opacity)||0.3} },
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float phase; varying float vPhase;
      void main(){ vPhase = phase;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor; uniform float uTime, uSpeed, uBase; varying float vPhase;
      void main(){
        #include <logdepthbuf_fragment>
        float behind = fract(uTime*uSpeed - vPhase);   // 0 tuż za głową impulsu
        float head = exp(-behind*6.0);                  // jasna głowa + zanikający warkocz
        float a = uBase + head*0.9;
        gl_FragColor = vec4(uColor * (0.6 + head*1.4), a);
      }`
  });
  flowOrbitMats.push(mat);
  return new THREE.Line(g, mat);
}

/* ============================================================
   Żywe komety — shadery (koma + ogon jonowy + pyłowy / skała ʻOumuamua)
   ============================================================ */
const cometMats = [];   // materiały komet (uTime aktualizowany w animate, jak flowOrbitMats)

// Charakter per komet. kind:'gas' = koma+ogon jonowy+pyłowy; 'rock' = skała międzygwiezdna bez ogona.
const COMET_FX = {
  halley:   { kind:'gas', coma:[0.62,0.82,1.0], ion:[0.45,0.70,1.0], dust:[1.0,0.92,0.70], comaR:2.6, ionLen:34, ionR:1.1, dustLen:24, dustR:3.4, curve:0.22 },
  halebopp: { kind:'gas', coma:[0.74,0.88,1.0], ion:[0.55,0.75,1.0], dust:[1.0,0.84,0.48], comaR:3.4, ionLen:46, ionR:1.4, dustLen:36, dustR:5.2, curve:0.26 },
  neowise:  { kind:'gas', coma:[1.0,0.88,0.58], ion:[0.70,0.80,1.0], dust:[1.0,0.76,0.38], comaR:2.8, ionLen:26, ionR:1.0, dustLen:32, dustR:5.4, curve:0.34 },
  borisov:  { kind:'gas', coma:[0.45,1.0,0.92], ion:[0.30,0.95,0.88], dust:[0.55,1.0,0.82], comaR:2.4, ionLen:30, ionR:1.0, dustLen:20, dustR:3.0, curve:0.20 },
  oumuamua: { kind:'rock', rock:[0.46,0.16,0.10], len:3.8, rad:0.62 }
};

// koma — additive, jasny rdzeń zwrócony do kamery, delikatny puls
function cometComaMaterial(col){
  const m = new THREE.ShaderMaterial({
    extensions:{ fragDepth:true }, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uColor:{value:new THREE.Vector3().fromArray(col)}, uTime:{value:0} },
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vN; varying vec3 vPosW;
      void main(){
        vN = normalize(mat3(modelMatrix) * normal);
        vPosW = (modelMatrix * vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor; uniform float uTime; varying vec3 vN; varying vec3 vPosW;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vPosW);
        float d = max(dot(N,V), 0.0);
        float core = pow(d, 3.0);                                  // ciasny, jasny rdzeń
        float halo = pow(d, 0.8) * 0.32;                           // szeroka, słaba otoczka gazowa
        float pulse = 0.85 + 0.15*sin(uTime*2.0);
        vec3 tcol = mix(uColor, vec3(1.0), core*0.7);              // gradient temperatury: rdzeń biało-gorący → barwa gazu na brzegu
        gl_FragColor = vec4(tcol, (core + halo) * pulse);
      }`
  });
  cometMats.push(m); return m;
}

// ogon (stożek) — additive gradient od komy, prążki/migotanie, miękka sylwetka
function cometTailMaterial(col, len, opt){
  const m = new THREE.ShaderMaterial({
    extensions:{ fragDepth:true }, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uColor:{value:new THREE.Vector3().fromArray(col)}, uTime:{value:0}, uLen:{value:len},
      uStri:{value:(opt&&opt.stri)||0.5}, uSeed:{value:(opt&&opt.seed)||0.0}, uInt:{value:(opt&&opt.intensity)||0.9} },
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      uniform float uLen; varying float vT; varying vec2 vUv; varying vec3 vN; varying vec3 vPosW;
      void main(){
        vT = clamp(-position.y / uLen, 0.0, 1.0);                 // 0 = koma (apex), 1 = koniec ogona
        vUv = uv;                                                 // u: obwód stożka, v: wzdłuż osi → filamenty plazmy
        vN = normalize(mat3(modelMatrix) * normal);
        vPosW = (modelMatrix * vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor; uniform float uTime, uStri, uSeed, uInt;
      varying float vT; varying vec2 vUv; varying vec3 vN; varying vec3 vPosW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.02; a*=0.5; } return s; }
      void main(){
        #include <logdepthbuf_fragment>
        float fade = (1.0 - vT); fade *= fade;                    // jaśniej przy komie, zanika w warkoczu
        float apex = smoothstep(0.0, 0.12, vT);                   // wygaszenie tuż przy jądrze (ogon nie nakłada się na komę → bez przepalenia apexu)
        vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vPosW);
        float edge = pow(max(dot(N,V),0.0), 0.6);                 // miękka, wolumetryczna sylwetka stożka
        // filamenty pola (zorza/plazma) advektowane wzdłuż osi ogona
        float fil = fbm(vec2(vUv.x*9.0 + uSeed*3.0, vT*5.0 - uTime*0.8));
        float fila = smoothstep(0.42, 0.85, fil);                 // jasne pasma plazmy
        float stri = mix(1.0 - 0.35*fade, fila, uStri);           // jonowy: pasmowy (uStri↑); pyłowy: gładki (uStri↓)
        float a = fade * apex * edge * stri * uInt;
        gl_FragColor = vec4(uColor * (0.85 + 0.5*fila*uStri), a);
      }`
  });
  cometMats.push(m); return m;
}

// skała ʻOumuamua — opaque, mottling + rim + słaby „nie-grawitacyjny" blask od strony Słońca
function cometRockMaterial(col){
  const m = new THREE.ShaderMaterial({
    extensions:{ fragDepth:true },
    uniforms:{ uColor:{value:new THREE.Vector3().fromArray(col)}, uTime:{value:0}, sunDir:{value:new THREE.Vector3(1,0,0)} },
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vObj; varying vec3 vN; varying vec3 vPosW;
      void main(){
        vObj = position;                                          // przestrzeń obiektu → szum bez szwu UV i stały przy koziołkowaniu
        vN = normalize(mat3(modelMatrix) * normal);
        vPosW = (modelMatrix * vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor, sunDir; uniform float uTime; varying vec3 vObj; varying vec3 vN; varying vec3 vPosW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
      void main(){
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vN);
        float lam = clamp(dot(N, normalize(sunDir)), 0.0, 1.0);
        // mottling z pozycji obiektu (bez szwu na południku UV ani ściśnięcia biegunów); dwie projekcje + skos = pseudo-3D
        float n = noise(vObj.xy*1.5 + vObj.z*0.9)*0.55 + noise(vObj.yz*3.3 + vObj.x*1.1)*0.45;
        vec3 base = uColor * (0.22 + 0.78*lam) * (0.6 + 0.7*n);
        vec3 V = normalize(cameraPosition - vPosW);
        float fres = pow(1.0 - max(dot(N,V),0.0), 2.0);
        base += vec3(0.5,0.18,0.10) * fres * 0.5;                      // rim
        base += uColor * pow(lam,3.0) * 0.5 * (0.8 + 0.2*sin(uTime*3.0)); // słaby blask sunward
        gl_FragColor = vec4(base, 1.0);
      }`
  });
  cometMats.push(m); return m;
}

// stożek ogona: apex w (0,0,0), baza w (0,-len,0) → oś orientowana przez COMET_DOWN (anty-słonecznie)
function makeCometTail(len, rad, col, opt){
  const g = new THREE.ConeGeometry(rad, len, 18, 1, true);
  g.translate(0, -len/2, 0);
  return new THREE.Mesh(g, cometTailMaterial(col, len, opt));
}

// Wizualizacja komety: jądro (cel pickingu, userData.cometId) z dziećmi koma+ogony, lub skała ʻOumuamua.
function buildCometVisual(c){
  const fx = COMET_FX[c.id] || COMET_FX.halley;
  if(fx.kind === 'rock'){
    const rg = new THREE.SphereGeometry(1, 22, 18);
    rg.scale(fx.len, fx.rad, fx.rad*0.82);                          // wydłużony odłamek (skala wbita w geometrię → poprawne normalne)
    rg.computeVertexNormals(); rg.computeBoundingSphere();          // boundingSphere dla raycastu pickingu
    const rock = new THREE.Mesh(rg, cometRockMaterial(fx.rock));
    rock.userData.cometId = c.id; rock.userData.cometKind = 'rock';
    return rock;
  }
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 14),
    new THREE.MeshBasicMaterial({color:0xfdfdff}));                 // jasny rdzeń + cel pickingu
  nucleus.userData.cometId = c.id; nucleus.userData.cometKind = 'gas';
  const coma = new THREE.Mesh(new THREE.IcosahedronGeometry(fx.comaR, 2), cometComaMaterial(fx.coma));
  coma.userData.cometId = c.id;                                   // koma = widoczna „głowa" → pickowalna (walk-up do jądra)
  nucleus.add(coma);
  const ion  = makeCometTail(fx.ionLen,  fx.ionR,  fx.ion,  {stri:0.85, seed:0.0, intensity:1.0});  // wąski, prosty, prążkowany
  const dust = makeCometTail(fx.dustLen, fx.dustR, fx.dust, {stri:0.35, seed:1.7, intensity:0.8});  // szeroki, ciepły, odchylony
  ion.raycast = dust.raycast = function(){};                      // ogony niepikowalne (cienkie/additive) — picking tylko koma+jądro
  nucleus.add(ion); nucleus.add(dust);
  nucleus.userData.ion = ion; nucleus.userData.dust = dust; nucleus.userData.curve = fx.curve;
  return nucleus;
}

function startReality(){
  if(!realScale) applyScale(true);              // realne pozycje → realistyczna skala
  reality.active = true;
  reality.clockMs = Date.now(); reality.satAccum = 0;
  reality.savedFar = camera.far; camera.far = 60000; camera.updateProjectionMatrix();
  const jd = Ephemeris.julianDate(Date.now());
  // planety na realne pozycje (pivot=0, pozycja bezpośrednio w group.position 3D)
  bodies.forEach(b=>{
    const el = Ephemeris.REAL_PLANETS.find(p=>p.id===b.data.id);
    if(!el) return;
    const v = eclToScene(Ephemeris.positionAt(el, jd));
    b.pivot.rotation.y = 0; b.group.position.copy(v);
  });
  // zamiast kołowych pierścieni — narysuj realne, nachylone orbity planet z ephemeryd
  bodies.forEach(b=>{ b.data._orbitLine.visible = false; });
  reality.planetOrbits = [];
  bodies.forEach(b=>{
    const el = Ephemeris.REAL_PLANETS.find(p=>p.id===b.data.id); if(!el) return;
    const pts = Ephemeris.sampleOrbit(el, jd, 256).map(eclToScene);
    const ph  = Ephemeris.sampleOrbitPhases(el, jd, 256);
    const line = buildFlowOrbit(pts, ph, 0x4a5a7a, {opacity:0.32});
    line.visible = showOrbits;
    scene.add(line); reality.planetOrbits.push(line);
  });
  // komety: tor + marker
  COMETS.forEach(c=>{
    const pts = Ephemeris.sampleOrbit(c, jd, 256).map(eclToScene);
    const ph  = Ephemeris.sampleOrbitPhases(c, jd, 256);
    const line = buildFlowOrbit(pts, ph, c.color, {opacity:0.5});
    line.visible = showOrbits;
    scene.add(line); reality.cometOrbits.push(line);
    const mk = buildCometVisual(c);                 // shaderowa kometa (koma+ogony / skała) — userData.cometId ustawione
    mk.position.copy(eclToScene(Ephemeris.positionAt(c, jd)));
    if(mk.userData.cometKind === 'gas'){            // kierunek prędkości orbitalnej (stały w sesji) → fizyczne odchylenie ogona pyłowego ku tyłowi
      mk.userData.velDir = eclToScene(Ephemeris.positionAt(c, jd + 0.05)).sub(eclToScene(Ephemeris.positionAt(c, jd))).normalize();
    }
    scene.add(mk); reality.cometMarkers.push(mk);
  });
  const d = new Date();
  const el = document.getElementById('realityStat');
  el.style.display='block';
  el.innerHTML = `Pozycje na: ${d.toISOString().slice(0,16).replace('T',' ')} UTC<br>${COMETS.length} komet · 8 planet (ephemerydy Keplera)`;
  addCometRail();
}

function stopReality(){
  stopProbes(); setToggle('tProbes', false);
  removeCometRail();
  reality.active = false;
  reality.cometOrbits.forEach(l=>{ l.geometry.dispose(); l.material.dispose(); scene.remove(l); });
  reality.cometMarkers.forEach(m=>{ m.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); }); scene.remove(m); });
  reality.cometOrbits = []; reality.cometMarkers = []; cometMats.length = 0;
  (reality.planetOrbits||[]).forEach(l=>{ l.geometry.dispose(); l.material.dispose(); scene.remove(l); });
  reality.planetOrbits = [];
  flowOrbitMats.length = 0;
  if(reality.savedFar){ camera.far = reality.savedFar; camera.updateProjectionMatrix(); reality.savedFar = 0; }
  document.getElementById('realityStat').style.display='none';
  // przywróć kąty z bieżących pozycji sceny (unikamy snapu planet na +X)
  bodies.forEach(b=>{ const x=b.group.position.x, z=b.group.position.z; b.pivot.rotation.y = Math.atan2(-z, x); });
  applyScale(realScale);                         // odśwież pozycje kinematyczne planet wg skali
  // przywróć widoczność pierścieni orbit wg aktualnego toggla
  bodies.forEach(b=>{ b.data._orbitLine.visible = showOrbits; });
}

/* ============================================================
   Rój satelitów Ziemi (TLE + SGP4) — Faza 2 Rzeczywistości
   ============================================================ */
const R_EARTH_KM = 6371;
const sats = { active:false, points:null, count:0, source:'' };

// Buduje chmurę punktów z tekstu TLE (3-liniowe rekordy), propaguje SGP4 na `date`.
// Zwraca liczbę zbudowanych satelitów. Synchroniczne (testowalne bez sieci).
function buildSatelliteSwarm(tleText, date){
  clearSatellites();
  const earth = bodies.find(b=>b.data.id==='earth');
  const meshR = trueScale ? trueRadius(R_KM.earth) : earth.data.radius;
  const lines = tleText.split(/\r?\n/).filter(l=>l.length);
  const pos = [];
  sats.satrecs = []; sats.names = [];
  for(let i=0; i+2 < lines.length+1; i+=3){
    const l1 = lines[i+1], l2 = lines[i+2];
    if(!l1 || !l2 || l1[0] !== '1' || l2[0] !== '2') { i -= 2; continue; } // wyrównanie gdy brak nazwy
    let satrec; try { satrec = satellite.twoline2satrec(l1, l2); } catch(e){ continue; }
    const pv = satellite.propagate(satrec, date);
    if(!pv || !pv.position) continue;
    const p = SatScale.eciToEarthLocal(pv.position, R_EARTH_KM, meshR);
    if(isFinite(p.x) && isFinite(p.y) && isFinite(p.z)){
      const nm=(lines[i]||'').trim();
      pos.push(p.x, p.y, p.z); sats.satrecs.push(satrec);
      sats.names.push(/^[12] /.test(nm) ? ('Satelita #'+sats.satrecs.length) : nm);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  const mat = new THREE.PointsMaterial({ color:0x9fe6ff, size:2.4, sizeAttenuation:false, transparent:true, opacity:0.85, depthWrite:false });
  sats.points = new THREE.Points(geo, mat);
  earth.group.add(sats.points);                  // dziecko Ziemi → podąża za nią
  sats.count = pos.length / 3;
  sats.active = true;
  return sats.count;
}

function clearSatellites(){
  if(sats.points){ const e=bodies.find(b=>b.data.id==='earth'); e.group.remove(sats.points);
    sats.points.geometry.dispose(); sats.points.material.dispose(); sats.points=null; }
  sats.count = 0; sats.active = false; sats.satrecs = []; sats.names = []; deselectSat();
}

// Re-propagacja istniejących satrec na nowy czas (bez ponownego parsowania TLE).
function repropagateSatellites(date){
  if(!sats.points || !sats.satrecs || !sats.satrecs.length) return;
  const meshR = trueScale ? trueRadius(R_KM.earth) : bodies.find(b=>b.data.id==='earth').data.radius;
  const attr = sats.points.geometry.attributes.position;
  for(let j=0;j<sats.satrecs.length;j++){          // stały indeks j ↔ satrec ↔ nazwa (do pickowania)
    const pv = satellite.propagate(sats.satrecs[j], date);
    if(!pv || !pv.position) continue;
    const p = SatScale.eciToEarthLocal(pv.position, R_EARTH_KM, meshR);
    if(!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) continue;
    attr.array[j*3]=p.x; attr.array[j*3+1]=p.y; attr.array[j*3+2]=p.z;
  }
  attr.needsUpdate = true;
}

// Hybryda: live Celestrak → fallback snapshot. Aktualizuje HUD.
async function loadSatellites(){
  const stat = document.getElementById('satStat');
  stat.style.display='block'; stat.innerHTML='Ładowanie TLE…';
  const now = new Date();
  let text = null, source = 'snapshot';
  try {
    const res = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle', {cache:'no-store'});
    if(res.ok){ const t = await res.text(); if(t && /^1 \d{5}/m.test(t)){ text = t; source = 'live (Celestrak)'; } }
  } catch(e){ /* CORS/sieć → fallback */ }
  if(!text) text = (typeof TLE_SNAPSHOT !== 'undefined') ? TLE_SNAPSHOT : '';
  if(!text){ stat.innerHTML='Brak danych TLE'; return; }
  const n = buildSatelliteSwarm(text, now);
  sats.source = source;
  stat.innerHTML = `🛰 ${n.toLocaleString('pl')} obiektów na orbicie Ziemi<br>źródło: ${source} · zbliż na Ziemię`;
}

/* ============================================================
   Sondy głębokiego kosmosu — Faza 3 Rzeczywistości
   Sondy swobodne: trajektorie z JPL Horizons (probes/ephem.json, generator scripts/gen-probes.mjs,
   matematyka probe-ephem.js) — pozycja z zegara sceny, ślad przebyty do „teraz".
   Sondy przypięte do ciała (atBody): pozycja planety; current/traj tylko dla nich (ilustracyjne).
   Nowa sonda swobodna bez wpisu w probes/ephem.json → pada test kompletności (test/probe-ephem.test.js).
   ============================================================ */
const PROBES = [
  {id:'voyager1', name:'Voyager 1', color:0x9fe6ff,
   wiki:{lang:'pl', title:'Voyager 1'},
   desc:'Najdalszy ludzki obiekt — w przestrzeni międzygwiezdnej od 2012.',
   facts:{Start:'1977', Cel:'Jowisz/Saturn → przestrzeń międzygwiezdna', Status:'aktywna (słaby sygnał)'}},
  {id:'voyager2', name:'Voyager 2', color:0xb8e0ff, lightDayAlways:true,   // membrana 24 h od dziś, przebicie 1.11.2035
   wiki:{lang:'pl', title:'Voyager 2'},
   desc:'Jedyna sonda, która odwiedziła Urana i Neptuna; w przestrzeni międzygwiezdnej od 2018.',
   facts:{Start:'1977', Cel:'Jowisz/Saturn/Uran/Neptun → poza heliosferą', Status:'aktywna'}},
  {id:'pioneer10', name:'Pioneer 10', color:0xc8b8a0,
   wiki:{lang:'pl', title:'Pioneer 10'},
   desc:'Pierwsza sonda, która przeleciała przez pas planetoid i minęła Jowisza (1973).',
   facts:{Start:'1972', Cel:'Jowisz → ku Aldebaranowi', Status:'kontakt utracony 2003'}},
  {id:'pioneer11', name:'Pioneer 11', color:0xbfae96,
   wiki:{lang:'pl', title:'Pioneer 11'},
   desc:'Pierwsza sonda, która zbliżyła się do Saturna (1979).',
   facts:{Start:'1973', Cel:'Jowisz/Saturn → ku Tarczy (Scutum)', Status:'kontakt utracony 1995'}},
  {id:'newhorizons', name:'New Horizons', color:0xffe0a0,
   wiki:{lang:'pl', title:'New Horizons'},
   desc:'Przelot koło Plutona (2015) i obiektu Arrokoth (2019) w Pasie Kuipera.',
   facts:{Start:'2006', Cel:'Pluton → Pas Kuipera', Status:'aktywna'}},
  {id:'jwst', name:'JWST', color:0xffd27a, current:[1.0,0.0,0.0], atBody:'earth',
   traj:[[1,0,0],[1.01,0,0]],
   wiki:{lang:'pl', title:'Kosmiczny Teleskop Jamesa Webba'},
   desc:'Teleskop kosmiczny w punkcie L2 — ~1,5 mln km od Ziemi po stronie przeciwnej do Słońca.',
   facts:{Start:'2021', Cel:'punkt L2 Ziemia–Słońce', Odległość:'~1,01 AU od Słońca', Status:'aktywny'}},
  {id:'juno', name:'Juno', color:0xff9f7a, current:[5.2,0,0], atBody:'jupiter',
   traj:[[1,0,0],[2,1,0],[5.2,0,0]],
   wiki:{lang:'pl', title:'Juno (sonda kosmiczna)'},
   desc:'Orbiter Jowisza — bada jego pole magnetyczne i wnętrze.',
   facts:{Start:'2011', Cel:'orbita Jowisza', Odległość:'~5,2 AU', Status:'aktywna'}},
  {id:'perseverance', name:'Perseverance', color:0xc1502e, current:[1.52,0,0], atBody:'mars',
   traj:[[1,0,0],[1.3,0.6,0],[1.52,0,0]],
   wiki:{lang:'pl', title:'Perseverance (łazik marsjański)'},
   desc:'Łazik NASA na Marsie (krater Jezero) — szuka śladów dawnego życia.',
   facts:{Start:'2020', Cel:'powierzchnia Marsa', Odległość:'~1,5 AU', Status:'aktywny'}}
];

const probes = { active:false, markers:[], trails:[], byId:{}, lightDay:[], timer:null, token:0, statHtml:'' };

let PROBE_EPHEM = null;        // z probes/ephem.json — próbki [jd,x,y,z] AU per sonda swobodna + chwile „1 dnia świetlnego"
const probeEphemReady = fetch('probes/ephem.json?v='+APP_VER)
  .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
  .then(d=>{ PROBE_EPHEM = d; })
  .catch(e=>console.error('probes/ephem.json', e));
const LIGHT_DAY_WINDOW_MS = 365.25*86400000;   // membrana dnia świetlnego: ±1 rok od chwili przekroczenia (PROBES.lightDayAlways: zawsze)
const LD_FAR_GAP = 100;                        // j. sceny: sonda dalej przed błoną → inny kadr focusu (focusProbe)
const PROBE_TICK_MS = 250;                     // repozycja sond/membrany/karty — poza animate (gałąź pasywna nietknięta)
// zegar sceny: w filmie (?film) przyspieszony, w locie warpowany, poza nimi realny 1:1
const kino = { active:false, clockMs:0, earthMs:0, film:'voyager' };   // stan trybu filmowego (pełny w sekcji „Tryb filmowy” na końcu pliku)
function probeClockMs(){ return (kino.active && kino.clockMs) || (flight.active && flight.clockMs) || reality.clockMs || Date.now(); }
function probeEphem(p){ return (!p.atBody && PROBE_EPHEM && PROBE_EPHEM.probes[p.id]) || null; }
function _fmtAU(d){ return d.toFixed(3).replace('.', ',') + ' AU'; }
function _fmtWhen(iso, ms){
  return new Date(iso).toLocaleString('pl-PL', {day:'numeric', month:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'})
    + ' (' + ProbeEphem.relativeTo(Date.parse(iso), ms) + ')';
}
// Fakty karty: stałe z PROBES + żywe z efemeryd (odległości, czas lotu światła, chwile dnia świetlnego)
// Deep Space Network na żywo (dsn-feed.js): które anteny odbierają TERAZ które sondy. Feed opisuje chwilę obecną,
// więc działa tylko przy zegarze sceny ≈ teraz (nie w filmie ani pod warpem lotu).
const DSN_URL = 'https://eyes.nasa.gov/dsn/data/dsn.xml', DSN_TICK_MS = 15000;
const DSN_PROBES = new Set(Object.values(DsnFeed.PROBE_IDS));
const dsn = { links:null, err:null, timer:null, token:0 };
function pollDsn(){
  const token = dsn.token;
  fetch(DSN_URL + '?r=' + Date.now(), {cache:'no-store'})
    .then(r=>{ if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(x=>{ if(token !== dsn.token) return; dsn.links = DsnFeed.links(DsnFeed.parseDsn(x)); dsn.err = null; })
    .catch(e=>{ if(token !== dsn.token) return; dsn.links = null; dsn.err = /^HTTP \d+$/.test(e.message) ? e.message : 'sieć'; });
}
function startDsn(){ stopDsn(); pollDsn(); dsn.timer = setInterval(pollDsn, DSN_TICK_MS); dsnFx.raf = requestAnimationFrame(dsnFxFrame); }
function stopDsn(){ dsn.token++; if(dsn.timer){ clearInterval(dsn.timer); dsn.timer = null; } dsn.links = null; dsn.err = null; dsnFxStop(); }
function dsnLive(ms){ return !kino.active && Math.abs(ms - Date.now()) < 120000; }
function dsnLink(id, ms){ return (dsnLive(ms) && dsn.links && dsn.links.find(l=>l.probeId===id)) || null; }
// Fakty karty z DSN; brak danych z feedu ≠ brak łącza — oba stany nazwane wprost
function dsnFacts(p, ms){
  if(!DSN_PROBES.has(p.id) || !dsnLive(ms)) return {};
  if(dsn.err) return {'Łącze DSN': 'brak danych z feedu NASA (' + dsn.err + ')'};
  if(!dsn.links) return {'Łącze DSN': 'wczytywanie…'};
  const l = dsnLink(p.id, ms);
  return l ? DsnFeed.linkFacts(l) : {'Łącze DSN': 'teraz żadna antena DSN nie odbiera'};
}

// --- Efekt DSN w scenie: czasze na globusie (pulsują, gdy odbierają), wiązka antena→sonda, paczki LOD płynące
// sonda→Ziemia z prędkością światła. Własny rAF (jak film) — gałąź pasywna animate nietknięta. ---
const DSN_GOLD = new THREE.Color(0xffd27a), DSN_PTS_MAX = 1024;
const DSN_B_MIN = 0.02;            // najdrobniejsze pasmo paczek w j. sceny (~10 promieni Ziemi w prawdziwej skali)
const dsnFx = { sites:null, beams:new Map(), pts:null, dotTex:null, raf:0, box:null };
const _dsnA = new THREE.Vector3(), _dsnB = new THREE.Vector3(), _dsnD = new THREE.Vector3();
function dsnFxBuild(){
  if(dsnFx.sites) return true;
  const e = bodies.find(b=>b.data.earth); if(!e) return false;
  const glow = glowTexture('rgba(255,250,236,1)', 'rgba(255,190,110,0.5)');
  dsnFx.dotTex = glowTexture('rgba(255,252,240,1)', 'rgba(255,200,120,0.4)');
  dsnFx.sites = {};
  dsnFx.box = document.createElement('div');
  dsnFx.box.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:7';
  document.body.appendChild(dsnFx.box);
  Object.entries(DsnFeed.SITES).forEach(([id, s])=>{
    const at = lonlatToLocal(s.lon, s.lat, e.data.radius*1.003);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({map:glow, color:DSN_GOLD, sizeAttenuation:false,
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
    spr.position.copy(at); spr.visible = false; e.mesh.add(spr);
    // podpis w DOM nad etykietami warstwy geo (te są DOM z-index 6 — podpis w scenie zawsze by pod nimi ginął)
    const lab = document.createElement('div'); lab.className = 'dsn-lab'; lab.style.display = 'none'; dsnFx.box.appendChild(lab);
    dsnFx.sites[id] = { name:s.name, spr, lab, text:'', parent:e.mesh };
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DSN_PTS_MAX*3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(DSN_PTS_MAX*3), 3));
  dsnFx.pts = new THREE.Points(g, new THREE.PointsMaterial({map:dsnFx.dotTex, size:8, sizeAttenuation:false,
    vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
  dsnFx.pts.frustumCulled = false; scene.add(dsnFx.pts);
  return true;
}
// Podpis czaszy: nazwa kompleksu + aktywne łącza („DSS63 ← New Horizons · 501,3 bit/s”); textContent (dane z feedu)
function drawDsnSiteLabel(S, act){
  const text = S.name + '\n' + act.map(l=>`${l.dish} ← ${(PROBES.find(p=>p.id===l.probeId)||{name:l.craft}).name} · ${String(l.downRate).replace('.', ',')} bit/s`).join('\n');
  if(text !== S.text){ S.text = text; S.lab.textContent = text; }
}
function dsnFxFrame(){
  dsnFx.raf = requestAnimationFrame(dsnFxFrame);
  if(!probes.active || !dsnFxBuild()) return;
  const ms = probeClockMs(), live = dsnLive(ms) && !!dsn.links;
  const links = live ? dsn.links.filter(l=>l.probeId && probes.byId[l.probeId] && dsnFx.sites[l.site]) : [];
  // czasze: widoczne przy Ziemi; aktywna pulsuje i ma podpis z bliska
  const ec = worldPos(bodies.find(b=>b.data.earth));
  const rr = Object.values(dsnFx.sites)[0].spr.getWorldPosition(_dsnA).distanceTo(ec) / 1.003;
  const dCam = camera.position.distanceTo(ec), near = dCam < rr*80, close = dCam < rr*14;
  const pulse = 1 + 0.35*Math.sin(performance.now()/1000 * Math.PI*2/1.4);
  Object.entries(dsnFx.sites).forEach(([id, S])=>{
    const act = links.filter(l=>l.site===id);
    S.spr.visible = near && live;
    S.spr.material.opacity = act.length ? 1 : 0.35;
    const k = act.length ? 0.03*pulse : 0.014; S.spr.scale.set(k, k, 1);
    // podpis tylko z bliska, dla aktywnej czaszy po stronie zwróconej do kamery
    let show = close && act.length > 0;
    if(show){
      S.spr.getWorldPosition(_dsnB); _dsnD.copy(camera.position).sub(_dsnB);
      show = _dsnD.dot(_dsnA.copy(_dsnB).sub(ec)) > 0;
      if(show){ _dsnB.project(camera); show = Math.abs(_dsnB.x) < 1 && Math.abs(_dsnB.y) < 1 && _dsnB.z < 1; }
    }
    S.lab.style.display = show ? 'block' : 'none';
    if(show){ drawDsnSiteLabel(S, act);
      S.lab.style.left = ((_dsnB.x+1)/2*innerWidth + 14) + 'px'; S.lab.style.top = ((1-_dsnB.y)/2*innerHeight) + 'px'; }
  });
  // wiązki antena→sonda + paczki LOD (sonda→Ziemia, prędkość światła w j. sceny/s)
  const c = AU_SCALE * ProbeEphem.AU_PER_SEC, seen = new Set();
  const pa = dsnFx.pts.geometry.attributes.position, ca = dsnFx.pts.geometry.attributes.color;
  let n = 0;
  links.forEach(l=>{
    const key = l.dish + '|' + l.craft; seen.add(key);
    let bm = dsnFx.beams.get(key);
    if(!bm){
      bm = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)),
        new THREE.LineBasicMaterial({color:DSN_GOLD, transparent:true, opacity:0.28, depthWrite:false, blending:THREE.AdditiveBlending}));
      bm.frustumCulled = false; scene.add(bm); dsnFx.beams.set(key, bm);
    }
    const a = dsnFx.sites[l.site].spr.getWorldPosition(_dsnA), b = _dsnB.copy(probes.byId[l.probeId].mk.position);
    const bp = bm.geometry.attributes.position; bp.setXYZ(0, a.x, a.y, a.z); bp.setXYZ(1, b.x, b.y, b.z); bp.needsUpdate = true;
    _dsnD.copy(b).sub(a); const L = _dsnD.length(); _dsnD.divideScalar(L);
    DsnFeed.lodPackets(L, c, ms, DSN_B_MIN).forEach(p=>{
      if(n >= DSN_PTS_MAX) return;
      pa.setXYZ(n, a.x + _dsnD.x*p.x, a.y + _dsnD.y*p.x, a.z + _dsnD.z*p.x);
      ca.setXYZ(n, DSN_GOLD.r*p.a, DSN_GOLD.g*p.a, DSN_GOLD.b*p.a); n++;
    });
  });
  dsnFx.beams.forEach((bm, key)=>{ if(!seen.has(key)){ scene.remove(bm); bm.geometry.dispose(); bm.material.dispose(); dsnFx.beams.delete(key); } });
  dsnFx.pts.geometry.setDrawRange(0, n); pa.needsUpdate = true; ca.needsUpdate = true;
}
function dsnFxStop(){
  if(dsnFx.raf){ cancelAnimationFrame(dsnFx.raf); dsnFx.raf = 0; }
  dsnFx.beams.forEach(bm=>{ scene.remove(bm); bm.geometry.dispose(); bm.material.dispose(); }); dsnFx.beams.clear();
  if(dsnFx.sites) Object.values(dsnFx.sites).forEach(S=>{ S.parent.remove(S.spr); S.spr.material.dispose(); });
  if(dsnFx.box){ dsnFx.box.remove(); dsnFx.box = null; }
  if(dsnFx.pts){ scene.remove(dsnFx.pts); dsnFx.pts.geometry.dispose(); dsnFx.pts.material.dispose(); }
  if(dsnFx.dotTex) dsnFx.dotTex.dispose();
  dsnFx.sites = null; dsnFx.pts = null; dsnFx.dotTex = null;
}
function probeFacts(p, ms){
  const e = probeEphem(p); if(!e) return Object.assign({}, p.facts, dsnFacts(p, ms));
  const jd = Ephemeris.julianDate(ms);
  const pos = ProbeEphem.positionAt(e.samples, jd);
  const earth = Ephemeris.positionAt(Ephemeris.REAL_PLANETS.find(x=>x.id==='earth'), jd);
  const dE = ProbeEphem.dist(pos, earth);
  const f = Object.assign({}, p.facts);
  f['Od Słońca'] = _fmtAU(Math.hypot(pos.x, pos.y, pos.z));
  f['Od Ziemi'] = _fmtAU(dE) + ' · ' + (dE*ProbeEphem.AU_KM/1e9).toFixed(2).replace('.', ',') + ' mld km';
  f['Sygnał leci'] = ProbeEphem.fmtDuration(dE / ProbeEphem.AU_PER_SEC);
  if(e.lightDay){
    f['1 dzień świetlny od Ziemi'] = _fmtWhen(e.lightDay.geometric, ms);
    if(e.lightDay.downlink) f['Sygnał od sondy leci ≥ 24 h od'] = _fmtWhen(e.lightDay.downlink, ms);
  }
  return Object.assign(f, dsnFacts(p, ms));
}

// --- Proceduralne sylwetki sond (prymitywy THREE; widoczne bez oświetlenia) ---
function _mat(c){ return new THREE.MeshBasicMaterial({ color:c }); }
const _GOLD=0xc8a24a, _GREY=0x8893a6, _WHITE=0xcfd6e2;

// Sonda głębokiego kosmosu: paraboliczna czasza + ośmiokątny bus + wysięgnik z RTG (Voyager/Pioneer/New Horizons)
function buildDeepSpaceProbe(color){
  const g=new THREE.Group();
  const dish=new THREE.Mesh(new THREE.SphereGeometry(0.62,20,12,0,Math.PI*2,0,Math.PI/2.4), _mat(_WHITE));
  dish.rotation.x=Math.PI; dish.position.y=0.18; dish.scale.y=0.45; g.add(dish);     // czasza
  const bus=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,0.22,8), _mat(_GREY));
  bus.position.y=-0.12; g.add(bus);                                                   // bus
  const boom=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,1.1,6), _mat(color));
  boom.rotation.z=Math.PI/2; boom.position.set(0.62,-0.12,0); g.add(boom);            // wysięgnik
  const rtg=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.34,8), _mat(0x444a55));
  rtg.rotation.z=Math.PI/2; rtg.position.set(1.18,-0.12,0); g.add(rtg);               // RTG
  const mag=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,1.4,4), _mat(color));
  mag.rotation.x=Math.PI/2; mag.position.set(0,-0.12,0.7); g.add(mag);                // boom magnetometru
  return g;
}
// JWST: heksagonalne lustro + warstwowa osłona przeciwsłoneczna
function buildJWST(color){
  const g=new THREE.Group();
  const mirror=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.04,6), _mat(_GOLD));
  mirror.rotation.x=Math.PI/2; mirror.position.y=0.18; g.add(mirror);                 // lustro
  for(let i=0;i<4;i++){ const layer=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.012,0.95), _mat(i%2?0x6a7080:_WHITE));
    layer.position.y=-0.05-i*0.07; layer.rotation.y=0.18; g.add(layer); }             // 4 warstwy osłony
  return g;
}
// Juno: heksagonalny bus + 3 długie panele słoneczne co 120°
function buildJuno(color){
  const g=new THREE.Group();
  const bus=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.34,6), _mat(_GREY));
  g.add(bus);
  for(let i=0;i<3;i++){ const a=i*2*Math.PI/3;
    const panel=new THREE.Mesh(new THREE.BoxGeometry(1.15,0.02,0.42), _mat(0x2b3f6b));
    panel.position.set(Math.cos(a)*0.85,0,Math.sin(a)*0.85); panel.rotation.y=-a; g.add(panel); }
  return g;
}
// Perseverance: korpus + 6 kół + maszt z głowicą + RTG (łazik)
function buildRover(color){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.3,0.5), _mat(_GREY)); body.position.y=0.22; g.add(body);
  for(let sx=-1;sx<=1;sx+=2) for(let sz=-1;sz<=1;sz++){
    const w=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.08,12), _mat(0x33373f));
    w.rotation.z=Math.PI/2; w.position.set(sx*0.36, 0.05, sz*0.22); g.add(w); }        // 6 kół
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.34,6), _mat(_WHITE));
  mast.position.set(-0.22,0.5,0); g.add(mast);
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.08,0.1), _mat(color)); head.position.set(-0.22,0.68,0); g.add(head);
  const rtg=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.18,0.18), _mat(_GOLD)); rtg.position.set(0.36,0.42,0); rtg.rotation.y=0.4; g.add(rtg);
  return g;
}
// Mapowanie id → archetyp; zwraca grupę z probeId na grupie
const _PROBE_BUILDERS={ jwst:buildJWST, juno:buildJuno, perseverance:buildRover };
function buildProbeMesh(id, color){
  const g=(_PROBE_BUILDERS[id]||buildDeepSpaceProbe)(color);
  g.userData.probeId=id;
  return g;
}

/* ---------- Statek gracza (M1b-2): mesh + placement (dziecko sceny, nie bodies[]) ---------- */
const ZERO3 = Object.freeze(new THREE.Vector3(0,0,0));
const SHIP_FWD = new THREE.Vector3(0,0,1);          // nos kadłuba wzdłuż +Z (prograde)
const SHIP_REL = 0.06;                              // rozmiar statku ≈ 6% promienia ciała centralnego (sceniczny, nie fizyczny) — DOSTRÓJ OKIEM
const _shipCenter = new THREE.Vector3();
const _shipFwd = new THREE.Vector3();

// pozycja renderowanego centrum (mesh planety) — statek/orbita nigdy nie odlepiają się od ciała
function shipCenterScenePos(centerId){
  const id = centerId || ship.center;
  if(id === 'sun') return _shipCenter.set(0,0,0);
  const b = bodies.find(x=>x.data.id===id);
  return b ? _shipCenter.copy(b.group.position) : _shipCenter.set(0,0,0);
}
// sceniczny rozmiar statku w bieżącej ramce centrum (LEO ~Ziemia, cruise ~Słońce, podejście ~Mars)
function shipMeshScale(){ return trueRadius(R_KM[ship.center] || 6371) * SHIP_REL; }
// kierunek km (ekl) → kierunek sceny (ten sam swap co kmToScene, bez skali — i tak normalizowany)
function kmDirToScene(v){ return _shipFwd.set(v.x, v.z, v.y); }

// Proceduralna sylwetka statku (jak sondy: rozmiar sceniczny, nie fizyczny). Oświetlona Słońcem (PointLight).
function buildShipMesh(){
  const g = new THREE.Group();
  const hullMat  = new THREE.MeshStandardMaterial({ color:0xd8e2ff, metalness:0.6, roughness:0.35, emissive:0x16306a, emissiveIntensity:0.45 });
  const panelMat = new THREE.MeshStandardMaterial({ color:0x223052, metalness:0.2, roughness:0.8, emissive:0x0d1730, emissiveIntensity:0.6, side:THREE.DoubleSide });
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.40, 1.5, 12), hullMat); hull.rotation.x = Math.PI/2; g.add(hull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.65, 12), hullMat);          nose.rotation.x = Math.PI/2; nose.position.z = 1.05; g.add(nose);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.85), panelMat);        g.add(panel);
  g.userData.ship = true;
  return g;
}

// Linia orbity statku: zbudowana RAZ na zmianę kształtu COE (coast+reanchor nie zmienia a/e/i/Ω/ω),
// punkty względem centrum (origin) → Line.position = centrum co klatkę. LineBasicMaterial (solidny cyan,
// wyróżnia się na tle przygaszonych orbit planet); M1b-3 może podmienić na flow-shader.
let _orbitSig = '';
function shipOrbitSig(){ const c = ship.coe; return c ? ship.center+':'+c.a.toFixed(3)+':'+c.e.toFixed(6)+':'+c.i.toFixed(6)+':'+c.Om.toFixed(6)+':'+c.w.toFixed(6) : ''; }
function rebuildShipOrbit(){
  if(!ship.coe) return;
  const pts = Orbit.sampleConic(ship.coe, 128).map(p=>kmToScene(p, ZERO3));   // offsety od centrum
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  if(!ship.orbitLine){
    ship.orbitLine = new THREE.Line(g, new THREE.LineBasicMaterial({ color:0x66ccff, transparent:true, opacity:0.7, depthWrite:false }));
    ship.orbitLine.frustumCulled = false;
    scene.add(ship.orbitLine);
  } else {
    ship.orbitLine.geometry.dispose();
    ship.orbitLine.geometry = g;
  }
  _orbitSig = shipOrbitSig();
}

// Linia PRZEWIDYWANEJ orbity po burnie w węźle (mint 0x59f5c8, wyróżnia się od cyan bieżącej).
// Liczona przez ManeuverNode.previewAfterNode w node.t (dt = placed ? node.t-coe.t0 : 0); pozycja=centrum co klatkę.
// PREDYKCJA: previewPredictCheap (1 konika, tani — burn-now/preview) + recomputePredict (Task 4: pełny łańcuch placed) + anchorPredict (per-frame repozycja).
// TANI builder pojedynczej koniki PO burnie (dt=placed?node.t-coe.t0:0). Per-frame dla burn-now (I5) + preview podczas dragu.
function previewPredictCheap(){
  const w = selN();                                                        // KSP: bez wybranego węzła brak preview (editory disabled)
  if(!ship.coe || !w){ hidePredictSegs(); hidePredictMarks(); if(ship.predictLine) ship.predictLine.visible=false; hideNodeArrow(); return; }
  const p = w.pnr, mag = Math.abs(p.pro)+Math.abs(p.nor)+Math.abs(p.rad);
  if(mag<1e-9){ hidePredictSegs(); hidePredictMarks(); if(ship.predictLine) ship.predictLine.visible=false; hideNodeArrow(); return; }
  const b = selBase(), mu = Orbit.MU[b.center], dt = w.t - b.coe.t0;        // selNode>0 → baza preCoe z _lastCp (cache); selNode=0 → ship.coe
  const pv = ManeuverNode.previewAfterNode(b.coe, mu, dt, {pro:p.pro/1000,nor:p.nor/1000,rad:p.rad/1000});
  if(!pv){ hidePredictSegs(); hidePredictMarks(); hideNodeArrow(); return; }
  hidePredictSegs(); hidePredictMarks();                                   // schowaj łańcuch, pokaż tylko 1 konikę
  ensurePredictSegs(1); const line=ship.predictSegs[0];
  const pts=Orbit.sampleConic(pv.coe2,128).map(q=>kmToScene(q,ZERO3));
  if(pts.some(q=>!isFinite(q.x)||!isFinite(q.y)||!isFinite(q.z))){ hidePredictSegs(); hideNodeArrow(); return; }  // NaN guard — e≈1 paraboliczna
  const g=new THREE.BufferGeometry().setFromPoints(pts); line.geometry.dispose(); line.geometry=g;
  line.material.color.setHex(PREDICT_COLORS[b.center]||0x59f5c8); line._centerId=b.center; line.visible=true;
  if(b.center === ship.center) updateNodeArrow(pv); else hideNodeArrow();   // cross-SOI: strzałka tylko w bieżącym centrum (jak recomputePredict; updateNodeArrow kotwiczy do ship.center)
  anchorPredict();
}
// recompute (M2): pełny ŁAŃCUCH legów multi-SOI (NodeChain.chainPath) — łuki inter-node + finalny path do celu
// + markery węzłów (read-only poza wybranym) / przejść SOI / arrival. Ciężki (≤5 predictPath) → on-edit/debounced.
function recomputePredict(){
  if(!ship.coe || !ship.nodes.length){ ship._lastCp=null; if(ship.predictLine) ship.predictLine.visible=false; hidePredictSegs(); hidePredictMarks(); hideNodeArrow(); ship._predictOutcome=null; ship._predictArrival=null; updatePredictHud(); return; }
  const ARC_N = 96;
  const nodesKmS = ship.nodes.map(n=>({ t:n.t, pnr:{ pro:n.pnr.pro/1000, nor:n.pnr.nor/1000, rad:n.pnr.rad/1000 } }));   // /1000 km/s TYLKO w glue
  const cp = NodeChain.chainPath(ship.coe, ship.center, ship.coe.t0, nodesKmS, flight.predictTarget||null, {});
  ship._lastCp = cp;                                                              // cache: marker-drag / „+ węzeł" / live-preview (selNode>0)
  if(ship.predictLine) ship.predictLine.visible = false;
  const arcs = [], marks = [];
  const pushArc = seg=>{
    const nuS = (seg.coe.e < 1) ? Orbit._wrap2pi(seg.coe.nu) : seg.coe.nu;        // I4: wrap START elipsy; hiperbola signed
    const nuE = nuAtTime(seg.coe, seg.mu, seg.tEnd);
    const raw = seg.closed ? Orbit.sampleConic(seg.coe, ARC_N) : Orbit.sampleConicArc(seg.coe, nuS, nuE, ARC_N);
    if(raw.some(q=>!isFinite(q.x)||!isFinite(q.y)||!isFinite(q.z))) return;       // NaN guard — pomiń segment
    arcs.push({ raw, center:seg.center });
  };
  const pushSoiMarks = segs=>{ for(let i=0;i<segs.length-1;i++){ const s=segs[i], e=Orbit.propagateCoe(s.coe, s.mu, s.tEnd-s.coe.t0); if(isFinite(e.r.x)) marks.push({ rKm:e.r, center:s.center, kind:'soi' }); } };
  // legi: łuki inter-node (coast PRZED burnem i) + przejścia SOI w legu + marker węzła (read-only poza wybranym)
  for(const leg of cp.legs){ leg.segments.forEach(pushArc); pushSoiMarks(leg.segments);
    if(leg.burnIdx !== ship.selNode) marks.push({ rKm:leg.burnState.r, center:leg.burnState.center, kind:'node' }); }   // wybrany → ship.nodeMarker (draggable)
  // finalny path po ostatnim burnie → cel (lub łańcuch urwany na cp.brokeAt)
  if(cp.ok && cp.finalPath){ const fp = cp.finalPath; fp.segments.forEach(pushArc); pushSoiMarks(fp.segments);
    if(fp.outcome==='target' && fp.arrival){ const last=fp.segments[fp.segments.length-1]; const sP=Orbit.propagateCoe(last.coe, last.mu, fp.arrival.tPeri-last.coe.t0); if(isFinite(sP.r.x)) marks.push({ rKm:sP.r, center:last.center, kind:'arrival' }); }
    ship._predictOutcome = fp.outcome; ship._predictArrival = fp.arrival;
  } else { ship._predictOutcome = 'broken'; ship._predictArrival = null; }
  // render łuków
  ensurePredictSegs(arcs.length); hidePredictSegs();
  for(let i=0;i<arcs.length;i++){ const line=ship.predictSegs[i], a=arcs[i];
    const g=new THREE.BufferGeometry().setFromPoints(a.raw.map(q=>kmToScene(q, ZERO3))); line.geometry.dispose(); line.geometry=g;
    line.material.color.setHex(PREDICT_COLORS[a.center]||0x59f5c8); line._centerId=a.center; line.visible=true; }
  // render markerów (węzeł=amber, przejście SOI=jasnoniebieski, arrival=czerwony)
  ensurePredictMarks(marks.length); hidePredictMarks();
  for(let i=0;i<marks.length;i++){ const mk=ship.predictMarks[i], info=marks[i];
    mk._centerId=info.center; mk._rKm=info.rKm;
    mk.material.color.setHex(info.kind==='arrival'?0xff5d5d : info.kind==='node'?0xffd27a : 0xbfe9ff);
    mk.scale.setScalar(shipMeshScale() * (info.kind==='arrival'?1.4 : info.kind==='node'?1.0 : 1.0)); mk.visible=true; }
  // strzałka Δv wybranego węzła na jego burnState (gdy w bieżącym centrum + niezerowe Δv; cross-center → Task 6)
  const sel = ship.selNode>=0 ? cp.legs[ship.selNode] : null, w = selN();
  if(sel && w && sel.burnState.center === ship.center && (Math.abs(w.pnr.pro)+Math.abs(w.pnr.nor)+Math.abs(w.pnr.rad))>=1e-9)
    updateNodeArrow({ rNode:sel.burnState.r, vNode:sel.burnState.v });
  else hideNodeArrow();
  anchorPredict();
  updatePredictHud();
}
// per-frame: repozycja predykcji do bieżącej pozycji jej ciała centralnego (tani; bez recompute geometrii)
function anchorPredict(){
  if(ship.predictSegs) for(const l of ship.predictSegs) if(l.visible) l.position.copy(shipCenterScenePos(l._centerId));
  if(ship.predictLine && ship.predictLine.visible) ship.predictLine.position.copy(shipCenterScenePos(ship.predictLine._centerId));
  if(ship.predictMarks) for(const m of ship.predictMarks) if(m.visible) m.position.copy(kmToScene(m._rKm, shipCenterScenePos(m._centerId)));
}
const PREDICT_COLORS = { earth:0x59f5c8, sun:0xffd27a, mars:0xff9e7a };   // kolor linii per ciało centralne
function ensurePredictSegs(n){
  if(!ship.predictSegs) ship.predictSegs = [];
  while(ship.predictSegs.length < n){
    const line = new THREE.Line(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color:0x59f5c8, transparent:true, opacity:0.9, depthWrite:false }));
    line.frustumCulled = false; line.visible = false; scene.add(line);
    ship.predictSegs.push(line);
  }
}
function hidePredictSegs(){ if(ship.predictSegs) ship.predictSegs.forEach(l=>l.visible=false); }
function ensurePredictMarks(n){
  if(!ship.predictMarks) ship.predictMarks = [];
  while(ship.predictMarks.length < n){
    const m = new THREE.Mesh(new THREE.SphereGeometry(1,12,8), new THREE.MeshBasicMaterial({ color:0xffffff }));
    m.frustumCulled = false; m.visible = false; scene.add(m); ship.predictMarks.push(m);
  }
}
function hidePredictMarks(){ if(ship.predictMarks) ship.predictMarks.forEach(m=>m.visible=false); }
// ν w czasie t z coe (epoka coe.t0) — przez propagateCoe→rv2coe (NIE zakładać epoka==t)
function nuAtTime(coe, mu, t){ const s = Orbit.propagateCoe(coe, mu, t - coe.t0); return Orbit.rv2coe(s.r, s.v, mu, t).nu; }
// kompat shim: wołający rebuildPredict() w reset/probe → recomputePredict
function rebuildPredict(){ recomputePredict(); }
// debounced trigger: natychmiastowy tani preview (1 konika) + pełny łańcuch po 130 ms ciszy
let _predictTimer = 0;
function schedulePredict(){
  renderNodeList();                                                        // odśwież listę (czas/Δv per węzeł) — wspólny hook edycji suwak/uchwyt/marker-drag
  previewPredictCheap();                                                   // natychmiastowy tani feedback
  if(_predictTimer) clearTimeout(_predictTimer);
  _predictTimer = setTimeout(()=>{ _predictTimer=0; recomputePredict(); }, 130);   // pełny łańcuch po ciszy
}
// HUD outcome + sync przycisków .on
function targetLabel(id){ return id==='mars' ? 'Mars' : id==='earth' ? 'Ziemia' : id; }
function updatePredictHud(){
  const el = document.getElementById('fmOutcome');
  const eB = document.getElementById('fmTargetEarth'), mB = document.getElementById('fmTargetMars');
  if(eB) eB.classList.toggle('on', flight.predictTarget==='earth');
  if(mB) mB.classList.toggle('on', flight.predictTarget==='mars');
  if(!el) return;
  const o = ship._predictOutcome, a = ship._predictArrival;
  if(!hasSel()){ el.textContent='—'; return; }
  if(o==='target'){
    if(a && a.periKm < FlightCore.R_KM[a.center])
      el.textContent = '→ '+targetLabel(flight.predictTarget)+': impakt na przylocie';
    else
      el.textContent = '→ '+targetLabel(flight.predictTarget)+': przechwycenie'+(a?(' (peri ~'+Math.round(a.periKm)+' km)'):'');
  }
  else if(o==='impact') el.textContent = 'impakt';
  else if(o==='escape') el.textContent = 'ucieczka z układu';
  else if(o==='capped') el.textContent = 'cel nieosiągnięty';
  else if(o==='broken') el.textContent = 'łańcuch urwany (węzeł poza zasięgiem)';   // chainPath ok=false (impakt/ucieczka/stale przed węzłem)
  else el.textContent = '—';
}
function setPredictTarget(id){ flight.predictTarget = id; recomputePredict(); }
function bindPredictTarget(){
  const eB=document.getElementById('fmTargetEarth'), mB=document.getElementById('fmTargetMars');
  if(eB) eB.onclick = ()=> setPredictTarget('earth');
  if(mB) mB.onclick = ()=> setPredictTarget('mars');
}
bindPredictTarget();
// Strzałka-gizmo Δv w pozycji węzła (read-only): od stanu PRZED burnem wzdłuż wektora Δv.
const ARROW_K = 6000;   // wizualna skala km na (km/s) — dostrój w eye-check (Task 8)
function updateNodeArrow(pv){
  const w = selN(); if(!w){ hideNodeArrow(); return; }
  const center = shipCenterScenePos();
  const f = Maneuver.frame(pv.rNode, pv.vNode);
  const p = w.pnr;
  const dv = Maneuver.pnrToVec({ pro:p.pro/1000, nor:p.nor/1000, rad:p.rad/1000 }, f);   // km/s
  const P0 = kmToScene(pv.rNode, center);
  const P1 = kmToScene({ x:pv.rNode.x+dv.x*ARROW_K, y:pv.rNode.y+dv.y*ARROW_K, z:pv.rNode.z+dv.z*ARROW_K }, center);
  const d = new THREE.Vector3().subVectors(P1, P0), len = d.length();
  if(len < 1e-6){ hideNodeArrow(); return; }
  d.normalize();
  if(!ship.nodeArrow){
    ship.nodeArrow = new THREE.ArrowHelper(d, P0, len, 0xffd27a, len*0.3, len*0.18);
    ship.nodeArrow.frustumCulled = false; scene.add(ship.nodeArrow);
  } else { ship.nodeArrow.position.copy(P0); ship.nodeArrow.setDirection(d); ship.nodeArrow.setLength(len, len*0.3, len*0.18); }
  ship.nodeArrow.visible = true;
}
function hideNodeArrow(){ if(ship.nodeArrow) ship.nodeArrow.visible = false; }
// Sync przycisków węzła z ship.nodes.length + flight._warpToNode (tekst, disabled, klasa .on).
function refreshNodeButtons(){
  const add = document.getElementById('fmAddNode'), warp = document.getElementById('fmWarpNode');
  if(add){ add.textContent = '+ węzeł'; add.disabled = (ship.nodes.length >= 4); }   // D2 cap=4; usuwanie per-wiersz (✕)
  if(warp){ warp.disabled = (ship.nodes.length === 0); warp.classList.toggle('on', !!flight._warpToNode); }
  renderNodeList();
}
// Lista węzłów w #flight-maneuver: wiersz per węzeł (czas + Σ|Δv|), klik=wybierz, ✕=usuń. Wybrany .on.
function renderNodeList(){
  const el = document.getElementById('fmNodeList'); if(!el) return;
  el.textContent = '';
  const tNow = flight.clockMs/1000;
  ship.nodes.forEach((n, i)=>{
    const row = document.createElement('div');
    row.className = 'fm-node-row' + (i === ship.selNode ? ' on' : '');
    const dt = n.t - tNow, dv = Math.round(Math.hypot(n.pnr.pro, n.pnr.nor, n.pnr.rad));
    const lbl = document.createElement('span');
    lbl.textContent = '▸ ' + (i+1) + ': ' + (dt > 0 ? fmtClock(dt) : 'teraz') + ' · Δv ' + dv + ' m/s';
    row.appendChild(lbl);
    const x = document.createElement('button');
    x.className = 'fm-node-x'; x.textContent = '✕'; x.title = 'usuń węzeł';
    x.onclick = (e)=>{ e.stopPropagation(); ship.selNode = i; removeNode(); };   // removeNode usuwa selNode → ustaw najpierw
    row.appendChild(x);
    row.onclick = ()=> selectNode(i);
    el.appendChild(row);
  });
}
function selectNode(i){
  if(i < 0 || i >= ship.nodes.length) return;
  ship.selNode = i;
  syncSlidersToSel(); updateNodeMarker(); updateNodeGizmo(); updateManeuverHud(); updateNodeHud();
  schedulePredict(); refreshNodeButtons();
}
function ensureNodeMarker(){
  if(ship.nodeMarker) return;
  const g = new THREE.SphereGeometry(1, 16, 12);
  ship.nodeMarker = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0xffd27a }));
  ship.nodeMarker.frustumCulled = false; ship.nodeMarker.visible = false;
  scene.add(ship.nodeMarker);
}
function nodeStateAtT(){                                                   // {r,v} statku w node.t WYBRANEGO węzła (PRZED burnem), w ramce selBase()
  const w = selN(); if(!ship.coe || !w) return null;
  const b = selBase();
  return Orbit.propagateCoe(b.coe, Orbit.MU[b.center], w.t - b.coe.t0);
}
function updateNodeMarker(){                                              // marker WYBRANEGO węzła (draggable); pozostałe rysuje recomputePredict (Task 5)
  if(!ship.nodeMarker) return;
  if(!flight.active || !hasSel()){ ship.nodeMarker.visible = false; return; }
  const st = nodeStateAtT(); if(!st){ ship.nodeMarker.visible = false; return; }
  ship.nodeMarker.position.copy(kmToScene(st.r, shipCenterScenePos(selBase().center)));
  ship.nodeMarker.scale.setScalar(shipMeshScale() * 1.6);                  // czytelny, ~rozmiar statku
  ship.nodeMarker.visible = true;
}
function placeNode(){                                                     // KSP „+ węzeł": perycentrum najbliższej bazowej orbity (D2 cap=4, circular-fix, strict monotonic)
  if(!ship.coe || ship.nodes.length >= 4) return;                          // D2: max 4 węzły
  ensureNodeMarker(); ensureNodeGizmo();
  if(ship.nodes.length) recomputePredict();                                // odśwież _lastCp synchronicznie — baza = orbita finalna po ostatnim węźle
  const tNow = flight.clockMs/1000, cp = ship._lastCp;
  let base = ship.coe, baseMu = Orbit.MU[ship.center];
  if(ship.nodes.length && cp && cp.ok && cp.coeFinal){ base = cp.coeFinal; baseMu = Orbit.MU[cp.centerFinal]; }
  let ttp = FlightCore.timeToPeri(base);                                   // perycentrum bazowej orbity
  if(!isFinite(ttp) || ttp < 1){                                           // circular (e≈0 → peri=0) / hiperbola → ¼ okresu (panel G: timeToPeri=0 nie może dać węzła „teraz")
    const P = (base.e < 1 && isFinite(base.a)) ? 2*Math.PI*Math.sqrt(base.a*base.a*base.a/baseMu) : 0;
    ttp = P > 0 ? P/4 : 600;
  }
  let t = base.t0 + ttp;
  const lastT = ship.nodes.length ? ship.nodes[ship.nodes.length-1].t : tNow;
  if(t <= lastT + 1) t = lastT + Math.max(ttp, 60);                        // strict monotonic (t > poprzedni węzeł)
  t = NodeChain.validNodeTime(ship.nodes, ship.nodes.length, Math.max(t, tNow + 1), tNow, 1);   // clamp PRZED insertem (panel)
  ship.selNode = NodeChain.insertNode(ship.nodes, { t, pnr:{ pro:0, nor:0, rad:0 } });           // mutuje ship.nodes (sortowane), zwróć idx wybranego
  syncSlidersToSel(); updateNodeMarker(); updateNodeGizmo(); schedulePredict(); refreshNodeButtons();
}
function removeNode(){                                                    // KSP „✕": usuń WYBRANY węzeł z kolejki + skoryguj selNode
  if(ship.selNode >= 0) ship.nodes = NodeChain.removeNode(ship.nodes, ship.selNode);   // zwraca kopię
  ship.selNode = ship.nodes.length ? Math.min(ship.selNode, ship.nodes.length - 1) : -1;
  flight._warpToNode = false;
  if(ship.nodeMarker) ship.nodeMarker.visible = false;
  hideNodeGizmo();
  schedulePredict(); refreshNodeButtons();
}
/* ---------- Gizmo uchwytów Δv (M2 Plaster B): 6 stożków ±PNR, edycja node.pnr przez drag ---------- */
const HANDLE_COLORS = { pro:0x8cff8c, nor:0xc792ff, rad:0x7ad6ff };   // paleta per oś (znak = kierunek wysunięcia, nie kolor)
const CONE_UP = new THREE.Vector3(0,1,0);                              // ConeGeometry: nos wzdłuż +Y
const _hdrDir = new THREE.Vector3();                                  // bufor orientacji (bez alokacji per-stożek)
function ensureNodeGizmo(){
  if(ship.nodeHandles) return;
  ship.nodeHandles = NodeHandle.HANDLES.map(h=>{
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 12),
      new THREE.MeshBasicMaterial({ color:HANDLE_COLORS[h.axis] }));
    m.userData.handle = h; m.frustumCulled = false; m.visible = false;
    scene.add(m); return m;
  });
}
// jednostkowy kierunek świata (km, ekl) osi uchwytu h w ramce PNR f (PRZED burnem)
function handleAxisKm(h, f){
  const unit = { pro:0, nor:0, rad:0 }; unit[h.axis] = h.sign;
  return Maneuver.pnrToVec(unit, f);                  // jednostkowy (f.* są jednostkowe, sign ±1)
}
// stożek grabbalny gdy wysunięty (comp>0) lub oś ~zerowa (oba ± przy stub, B3); zwinięty przeciwny przy niezerowej osi → NIE (Minor-fix #7: chwyt zwiniętego przeciwnego zerowałby aktywną oś = skok)
function handleGrabbable(h, pnrKmS){ return NodeHandle.handleComp(pnrKmS, h) > 0 || Math.abs(pnrKmS[h.axis]) < 1e-3; }   // 1e-3 km/s = 1 m/s ≈ 0
function updateNodeGizmo(){
  if(!ship.nodeHandles) return;
  const w = selN();
  const st = (flight.active && w && ship.coe) ? nodeStateAtT() : null;
  if(!st || !isFinite(st.r.x)){ ship.nodeHandles.forEach(m=>m.visible=false); return; }   // brak/parabola/NaN → ukryj
  const center = shipCenterScenePos(selBase().center);
  const f = Maneuver.frame(st.r, st.v);
  const pnrKmS = { pro:w.pnr.pro/1000, nor:w.pnr.nor/1000, rad:w.pnr.rad/1000 };
  const sc = shipMeshScale(), stubScene = sc * 1.6 * 2.5;             // ⚠ stub ∝ promień sceniczny markera (sc·1.6) → stożki POZA nieprzezroczystym markerem w KAŻDYM reżimie center (NIE bezwzgl. km — Important-fix #3)
  for(const m of ship.nodeHandles){
    const h = m.userData.handle;
    if(!handleGrabbable(h, pnrKmS)){ m.visible = false; continue; }   // zwinięty przeciwny przy niezerowej osi → ukryty + niegrabbalny (nodeHandleRayHit filtruje .visible)
    const aKm = handleAxisKm(h, f), comp = NodeHandle.handleComp(pnrKmS, h);
    const tipKm = { x:st.r.x+aKm.x*comp*ARROW_K, y:st.r.y+aKm.y*comp*ARROW_K, z:st.r.z+aKm.z*comp*ARROW_K };   // czubek ∝ Δv w km (ten sam ARROW_K co strzałka)
    const dirScene = _hdrDir.copy(kmDirToScene(aKm)).normalize();
    m.position.copy(kmToScene(tipKm, center)).addScaledVector(dirScene, stubScene);   // + stub sceniczny wzdłuż osi (poza markerem)
    m.quaternion.setFromUnitVectors(CONE_UP, dirScene);
    m.scale.setScalar(sc);
    m.visible = true;
  }
}
function hideNodeGizmo(){ if(ship.nodeHandles) ship.nodeHandles.forEach(m=>m.visible=false); }
// {S0,S1} px dla osi uchwytu h: S0=węzeł, S1=węzeł+oś·ARROW_K (≡ 1 km/s). null gdy stan zły / oba za kamerą.
function handleScreenRefs(h){
  const st = nodeStateAtT(); if(!st || !isFinite(st.r.x)) return null;
  const center = shipCenterScenePos(selBase().center);
  const aKm = handleAxisKm(h, Maneuver.frame(st.r, st.v));
  const S0w = kmToScene(st.r, center).project(camera);
  const S1w = kmToScene({ x:st.r.x+aKm.x*ARROW_K, y:st.r.y+aKm.y*ARROW_K, z:st.r.z+aKm.z*ARROW_K }, center).project(camera);
  if(S0w.z > 1 || S1w.z > 1) return null;             // KTÓRYKOLWIEK koniec za kamerą → NDC ekstrapoluje skończony „mirror"-piksel (w<0) → bezsensowne t (Important-fix #1/#2); spójne z cull per-punkt w dragNuFromCursor
  return {
    S0:{ x:(S0w.x*0.5+0.5)*innerWidth, y:(-S0w.y*0.5+0.5)*innerHeight },
    S1:{ x:(S1w.x*0.5+0.5)*innerWidth, y:(-S1w.y*0.5+0.5)*innerHeight }
  };
}
let _nodeDrag = null;                                       // snapshot pól controls podczas gestu
function nodeMarkerRayHit(clientX, clientY){
  if(!flight.active || !hasSel() || !ship.nodeMarker || !ship.nodeMarker.visible) return false;
  mouse.x=(clientX/innerWidth)*2-1; mouse.y=-(clientY/innerHeight)*2+1;
  ray.setFromCamera(mouse, camera); ray.params.Points.threshold = 0;
  return ray.intersectObject(ship.nodeMarker, false).length > 0;
}
// najbliższa próbka orbity do kursora (cull za-kamerą + interpolacja na odcinku ekranowym) → nu
const _projP = new THREE.Vector3();
function dragNuFromCursor(clientX, clientY){
  const b = selBase(); if(!b.coe) return null;                              // orbita tuż-przed-burnem wybranego węzła (selNode>0 → preCoe)
  const rng = ManeuverNode.validNuRange(b.coe);
  const N = 128, center = shipCenterScenePos(b.center), sx = clientX, sy = clientY;
  let best = { d2:Infinity, nu:null }, prev = null;         // prev: {x,y,nu} poprzedniej widocznej próbki (px)
  for(let k=0;k<=N;k++){
    const nu = rng.lo + (rng.hi - rng.lo) * k / N;
    // UWAGA: w solar.js globalna nazwa efemeryd to Ephemeris (pełna nazwa, bez aliasu).
    const p = kmToScene(Ephemeris.orbitalToEcliptic(b.coe.a, b.coe.e, b.coe.i, b.coe.Om, b.coe.w, nu), center);
    _projP.copy(p).project(camera);
    if(_projP.z > 1){ prev = null; continue; }              // cull za kamerą
    const px = (_projP.x*0.5+0.5)*innerWidth, py = (-_projP.y*0.5+0.5)*innerHeight;
    const d2 = (px-sx)*(px-sx)+(py-sy)*(py-sy);
    if(d2 < best.d2) best = { d2, nu };
    if(prev){                                               // interpolacja na odcinku ekranowym prev→bież.
      const vx=px-prev.x, vy=py-prev.y, L2=vx*vx+vy*vy;
      if(L2>1e-6){ let tt=((sx-prev.x)*vx+(sy-prev.y)*vy)/L2; tt=Math.max(0,Math.min(1,tt));
        const ix=prev.x+vx*tt, iy=prev.y+vy*tt, id2=(ix-sx)*(ix-sx)+(iy-sy)*(iy-sy);
        if(id2 < best.d2) best = { d2:id2, nu: prev.nu + (nu-prev.nu)*tt }; }
    }
    prev = { x:px, y:py, nu };
  }
  return best.nu;
}
function nodeBounds(){                                       // granice clampNodeTime (s); brak → Infinity
  let tSOI = Infinity;
  if(ship.center !== 'sun'){ const rs = Soi.radiusSOI(ship.center);
    const sp = Math.hypot(ship.v.x,ship.v.y,ship.v.z), dr = rs - Math.hypot(ship.r.x,ship.r.y,ship.r.z);
    if(sp>1e-9 && dr>0) tSOI = (flight.clockMs/1000) + dr/sp; }            // zgrubnie; pełny crossingTime → dalej-M2
  return { tSOI, tImpact: Infinity, marginSec: 1.0 };
}
// Wspólny cykl życia OrbitControls dla drag węzła (marker Plaster A + uchwyty Δv Plaster B).
function snapshotControls(){ return { rotate:controls.enableRotate, pan:controls.enablePan, zoom:controls.enableZoom, damp:controls.enableDamping }; }
function restoreControls(snap){ if(!snap) return;
  controls.enableRotate=snap.rotate; controls.enablePan=snap.pan;                          // przywróć 1:1 (chase ma pan=false!)
  controls.enableZoom=snap.zoom; controls.enableDamping=snap.damp; }
function lockControlsForDrag(e){
  controls.enableRotate=false; controls.enableZoom=false; controls.enableDamping=false;
  // controls.enabled jest własnością cyklu tween (startTween=false / tickTween=true przy k>=1) — NIE dotykamy go, by drag nie kolidował z trwającym tweenem.
  if(flight.warpIdx !== 0){ flight.warpIdx = 0; flight._effWarp = 1; updateWarpHud(); }     // pin ×1 (statek nie odjeżdża pod warpem)
  hideHover();
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch(_){}
}
function beginNodeDrag(e){ _nodeDrag = snapshotControls(); lockControlsForDrag(e); }
function endNodeDrag(){ if(!_nodeDrag) return; restoreControls(_nodeDrag); _nodeDrag = null; }
// Picking uchwytów Δv (raycast 6 stożków). Zwraca deskryptor handle albo null.
function nodeHandleRayHit(clientX, clientY){
  if(!flight.active || !hasSel() || !ship.nodeHandles) return null;
  mouse.x=(clientX/innerWidth)*2-1; mouse.y=-(clientY/innerHeight)*2+1;
  ray.setFromCamera(mouse, camera); ray.params.Points.threshold = 0;
  const hit = ray.intersectObjects(ship.nodeHandles.filter(m=>m.visible), false)[0];
  return hit ? hit.object.userData.handle : null;
}
let _handleDrag = null;                                    // { snap, handle, grab } podczas gestu uchwytu Δv
function beginHandleDrag(e, handle){
  const w = selN(); if(!w) return;
  const refs = handleScreenRefs(handle);
  const snap = snapshotControls();
  lockControlsForDrag(e);                                  // disable rotate/zoom/damp + pin ×1 + pointercapture (jak marker)
  const pnrKmS = { pro:w.pnr.pro/1000, nor:w.pnr.nor/1000, rad:w.pnr.rad/1000 };
  const comp0 = NodeHandle.handleComp(pnrKmS, handle);
  const grab = refs ? NodeHandle.grabOffset(refs.S0, refs.S1, { x:e.clientX, y:e.clientY }, comp0) : 0;
  _handleDrag = { snap, handle, grab };
}
function endHandleDrag(){ if(!_handleDrag) return; restoreControls(_handleDrag.snap); _handleDrag = null; }
// suwak osi mirror uchwytu (uchwyty ↔ suwaki spójne, ten sam stan selN().pnr)
function syncManeuverSlider(axis){
  const s = document.getElementById(axis==='pro'?'fmPro':axis==='nor'?'fmNor':'fmRad');
  if(!s) return;
  const w = selN(); if(!w) return;
  const v = Math.round(w.pnr[axis]);
  if(v > +s.max) s.max = String(v);          // ⚠ poszerz zakres, by suwak odwzorował duży drag (Important-fix #4: bez tego thumb saturuje, a późniejsze dotknięcie suwaka po cichu obcina plan do ±500)
  if(v < +s.min) s.min = String(v);
  s.value = String(v);
}
function maneuverSum(){ const p = selN()?.pnr; return p ? Math.round(Math.hypot(p.pro, p.nor, p.rad)) : 0; }   // m/s WYBRANEGO węzła
function maneuverTotal(){ return ship.nodes.reduce((s,n)=> s + Math.hypot(n.pnr.pro, n.pnr.nor, n.pnr.rad), 0); }   // m/s suma CAŁEJ kolejki
function updateManeuverHud(){
  const set = (id,t)=>{ const e=document.getElementById(id); if(e) e.textContent=t; };
  const w = selN();
  if(!w){ set('fmProV','—'); set('fmNorV','—'); set('fmRadV','—'); }                        // KSP: brak wybranego → komponenty „—"
  else { set('fmProV', Math.round(w.pnr.pro) + ' m/s'); set('fmNorV', Math.round(w.pnr.nor) + ' m/s'); set('fmRadV', Math.round(w.pnr.rad) + ' m/s'); }
  const total = Math.round(maneuverTotal());                                    // Σ|Δv| CAŁKOWITE kolejki (panel) — per-węzeł w liście
  set('fmSum', total + ' m/s');
  const el = document.getElementById('fmSum');                                  // czerwień gdy Σ kolejki > pozostały budżet (B2: bez clamp, tylko ostrzeżenie)
  if(el){ const budget = ship.stats ? ShipStats.dvRemaining(ship.stats)*1000 : Infinity;   // dvRemaining → km/s, *1000 = m/s (granica jednostek)
    el.classList.toggle('over', total > budget); }
}
function updateNodeHud(){                                                        // per-frame — MUSI null-guardować selN() (panel Critical#1)
  const el = document.getElementById('fmNodeT'); if(!el) return;
  const w = selN();
  if(!w){ el.textContent = '—'; return; }
  const dtN = w.t - flight.clockMs/1000;
  el.textContent = (dtN > 0) ? fmtClock(dtN) : 'teraz';
}
function resetManeuver(){                                          // przycisk Reset = wyczyść CAŁĄ kolejkę (NIE wołane z fireImpulse — panel Critical#2)
  ship.nodes = []; ship.selNode = -1; ship._lastCp = null;
  ['fmPro','fmNor','fmRad'].forEach(id=>{ const s=document.getElementById(id); if(s) s.value = '0'; });
  if(ship.predictLine) ship.predictLine.visible = false;
  hidePredictSegs(); hidePredictMarks();
  if(_predictTimer){ clearTimeout(_predictTimer); _predictTimer = 0; }   // anuluj zaległy debounce (inaczej recomputePredict odpala 130 ms PO teardown)
  if(ship.nodeMarker) ship.nodeMarker.visible = false;
  updateManeuverHud(); updateNodeHud();
  hideNodeArrow(); hideNodeGizmo(); refreshNodeButtons();          // po resecie: zdejmij strzałkę+gizmo+marker, zsync przyciski
}
// Ślad statku: pierścień stałej długości (bez alokacji per-klatka). Punkty względem centrum
// (Line.position = centrum). Czyszczony przy zmianie centrum (SOI) — ślad należał do starej ramki.
const TRAIL_MAX = 240;
function initShipTrail(){
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX*3), 3));
  g.setDrawRange(0, 0);
  ship.trail = new THREE.Line(g, new THREE.LineBasicMaterial({ color:0xffcf7a, transparent:true, opacity:0.5, depthWrite:false }));
  ship.trail.frustumCulled = false;
  ship._trailN = 0; ship._trailCenter = ship.center;
  scene.add(ship.trail);
}
function pushShipTrail(){
  if(!ship.trail) return;
  if(ship.center !== ship._trailCenter){ ship._trailN = 0; ship._trailCenter = ship.center; }   // SOI: reset
  const arr = ship.trail.geometry.attributes.position.array;
  const off = kmToScene(ship.r, ZERO3);
  if(ship._trailN < TRAIL_MAX){
    arr[ship._trailN*3] = off.x; arr[ship._trailN*3+1] = off.y; arr[ship._trailN*3+2] = off.z;
    ship._trailN++;
  } else {
    arr.copyWithin(0, 3);
    const j = (TRAIL_MAX-1)*3; arr[j] = off.x; arr[j+1] = off.y; arr[j+2] = off.z;
  }
  ship.trail.geometry.setDrawRange(0, ship._trailN);
  ship.trail.geometry.attributes.position.needsUpdate = true;
}
// Impuls TERAZ. §4.6: pierwszy „Wykonaj" przy warp>×1 tylko zbija warp do ×1 (celowanie w peri),
// dopiero kolejny odpala. NOWY pisarz SSOT (zdarzenie dyskretne — jak start/advance; nowa epoka).
// Epoka = ship.coe.t0 (koniec ostatniej klatki coastu); ship.r/v są spójne z t0 → coe2 spójne.
// Błąd „od ostatniej klatki do kliknięcia" jest sub-klatkowy (warp wymuszony ×1) — pomijalny (M2: reanchor na „teraz").
// suwaki PNR → wartości WYBRANEGO węzła (lub 0 gdy brak)
function syncSlidersToSel(){
  const w = selN();
  [['fmPro','pro'],['fmNor','nor'],['fmRad','rad']].forEach(([id,ax])=>{ const s=document.getElementById(id); if(s) s.value = String(Math.round(w ? w.pnr[ax] : 0)); });
}
// Wykonanie CZOŁOWEGO węzła (nodes[0]) + shift kolejki. KSP: wymaga węzła; pali w FAKTYCZNYM stanie statku (SSOT).
// 3. pisarz SSOT (ship.coe). §4.6: 1. „Wykonaj" pod warpem tylko zbija warp→×1, dopiero kolejny odpala.
function fireImpulse(){
  if(!flight.active || !ship.coe) return;
  if(flight.warpIdx !== 0){ flight.warpIdx = 0; flight._effWarp = 1; updateWarpHud(); return; }
  if(!ship.nodes.length) return;                                                // KSP: brak węzła w kolejce = no-op
  const n0 = ship.nodes[0], p = n0.pnr;
  if(Math.abs(p.pro) + Math.abs(p.nor) + Math.abs(p.rad) < 1e-9) return;        // zero Δv: nic do odpalenia
  const mu = Orbit.MU[ship.center];
  const dtN = n0.t - flight.clockMs/1000, EPS = 0.5;                            // okno = próg snapu warp-do-węzła [s]
  if(Math.abs(dtN) > EPS){ flight._warpToNode = true; refreshNodeButtons(); return; }   // poza oknem → dowieź warpem do nodes[0].t
  // w oknie: dtN sub-klatkowe → propaguj do node.t i pal w stanie węzła (= predykowany mint). Realny coast (warp) dowiózł przez crossingi.
  const st = Orbit.propagateCoe(ship.coe, mu, dtN);
  ship.r = st.r; ship.v = st.v; ship.coe = Orbit.rv2coe(st.r, st.v, mu, n0.t);
  flight.clockMs = n0.t * 1000;
  const state = { r:ship.r, v:ship.v, mu:mu, t:ship.coe.t0 };
  let pnr = { pro:p.pro/1000, nor:p.nor/1000, rad:p.rad/1000 };                 // m/s → km/s
  // BRAMKA PALIWA przed zmianą orbity — przy niedoborze: pusty bak → odmowa (no-fuel, zachowaj węzeł), częściowy → skaluj cały wektor do dvMax.
  let res = Maneuver.applyImpulse(state, pnr);
  const fuel = ShipStats.fuelForDv(ship.stats, res.dvMag);                      // res.dvMag w km/s
  if(fuel.insufficient){
    if(fuel.dvMax <= 0 || res.dvMag <= 0){ ship.flag = 'no-fuel'; updateShipHud(); return; }   // KSP: odmowa — NIE czyść kolejki
    const k = fuel.dvMax / res.dvMag;
    pnr = { pro:pnr.pro*k, nor:pnr.nor*k, rad:pnr.rad*k };
    res = Maneuver.applyImpulse(state, pnr);
  }
  const coe2 = Orbit.sanitizeCoe(res.coe2);
  if(!coe2){ ship.flag = 'nan-burn'; return; }                                  // degraduj, nigdy throw
  ship.coe = coe2; ship.lastGoodCoe = coe2;
  ship.r = res.state2.r; ship.v = res.state2.v;
  ship.regime = Orbit.regimeOf(coe2, FlightCore.R_KM[ship.center] || 0);
  ship.stats = ShipStats.consume(ship.stats, ShipStats.fuelForDv(ship.stats, res.dvMag).fuelUsed);
  // SHIFT kolejki: zdejmij czołowy; reszta węzłów (absolutne t na NOWEJ orbicie) zostaje bez przeliczania; skoryguj selNode.
  ship.nodes = NodeChain.removeNode(ship.nodes, 0);
  ship.selNode = (ship.selNode <= 0) ? (ship.nodes.length ? 0 : -1) : ship.selNode - 1;
  flight._warpToNode = false; ship._lastCp = null;
  hideNodeArrow(); hideNodeGizmo();
  if(ship.nodeMarker && !ship.nodes.length) ship.nodeMarker.visible = false;
  syncSlidersToSel();
  schedulePredict(); refreshNodeButtons(); updateManeuverHud(); updateNodeHud(); updateShipHud();
}
// Suwaki PNR → selN().pnr (m/s); zmiana → predykcja live. Suwak ma natywną obsługę strzałek
// (focus + ←/→), więc to jest też „klawiaturowe dialowanie Δv" — [ / ] tylko cyklują intencję (label).
function bindManeuver(){
  const wire = (id, axis)=>{ const s = document.getElementById(id); if(!s) return;
    s.addEventListener('input', ()=>{
      const w = selN(); if(!w){ s.value = '0'; return; }                       // KSP: bez wybranego węzła suwak nieaktywny
      if(flight.warpIdx !== 0){ flight.warpIdx = 0; flight._effWarp = 1; updateWarpHud(); }   // review fix: dialowanie Δv zbija warp do ×1 → predykcja spójna (statek nie odjeżdża pod warpem)
      w.pnr[axis] = parseFloat(s.value) || 0; updateManeuverHud(); schedulePredict();
    }); };
  wire('fmPro','pro'); wire('fmNor','nor'); wire('fmRad','rad');
  const fire = document.getElementById('fmFire');   if(fire)  fire.onclick  = fireImpulse;
  const reset = document.getElementById('fmReset'); if(reset) reset.onclick = resetManeuver;
  const addN = document.getElementById('fmAddNode');
  if(addN) addN.onclick = ()=> placeNode();   // zawsze dodaj (D2 cap w placeNode); usuwanie per-wiersz (✕) w renderNodeList
  const warpN = document.getElementById('fmWarpNode');
  if(warpN) warpN.onclick = ()=>{ if(ship.nodes.length){ flight._warpToNode = !flight._warpToNode; refreshNodeButtons(); } };
}
bindManeuver();
// [ / ] = klawiaturowe dialowanie prograde (±10 m/s) bez fokusowania suwaka; zachowuje się jak suwak (zbija warp → predykcja spójna).
function nudgePro(delta){
  const w = selN(); if(!w) return;                                             // KSP: bez wybranego węzła nic
  const s = document.getElementById('fmPro'); if(!s) return;
  if(flight.warpIdx !== 0){ flight.warpIdx = 0; flight._effWarp = 1; updateWarpHud(); }
  const v = Math.max(+s.min, Math.min(+s.max, (parseFloat(s.value) || 0) + delta));
  s.value = String(v); w.pnr.pro = v;
  updateManeuverHud(); schedulePredict();
}

function startProbes(){
  if(!reality.active){ startReality(); setToggle('tReality', true); }  // sondy = warstwa Rzeczywistości
  stopProbes();
  const token = ++probes.token;            // stop/start przed doczytaniem danych → stara obietnica nic nie buduje
  probes.active = true;
  const el = document.getElementById('probeStat');
  el.style.display='block'; el.textContent = '🚀 wczytywanie trajektorii (JPL Horizons)…'; probes.statHtml='';
  probeEphemReady.then(()=>{ if(token===probes.token && probes.active) buildProbes(); });
  startDsn();
}

function buildProbes(){
  const ms = probeClockMs();
  let missing = 0;
  PROBES.forEach(p=>{
    let line;
    if(p.atBody){
      // przypięta do ciała — bież. pozycja planety; ślad ilustracyjny (waypointy AU)
      const g = new THREE.BufferGeometry().setFromPoints(p.traj.map(w=>eclToScene({x:w[0],y:w[1],z:w[2]})));
      line = new THREE.Line(g, new THREE.LineBasicMaterial({color:p.color, transparent:true, opacity:0.5}));
    } else {
      const e = probeEphem(p); if(!e){ missing++; return; }
      // ślad z Horizons: bufor na wszystkie próbki + punkt „teraz"; drawRange rośnie z zegarem (updateProbes)
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((e.samples.length+1)*3), 3));
      line = new THREE.Line(g, new THREE.LineBasicMaterial({color:p.color, transparent:true, opacity:0.5}));
      line.frustumCulled = false;              // geometria zmienia się w czasie — bez przeliczania bounding sphere
      line.userData.k = -1;
    }
    scene.add(line); probes.trails.push(line);
    // marker = proceduralna sylwetka sondy (probeId na grupie → picking jak dotąd)
    const mk = buildProbeMesh(p.id, p.color);
    if(p.atBody){ const b=bodies.find(x=>x.data.id===p.atBody);
      mk.position.copy(b ? b.group.position : eclToScene({x:p.current[0],y:p.current[1],z:p.current[2]})); }
    scene.add(mk); probes.markers.push(mk);
    probes.byId[p.id] = { p, mk, line };
    const e = probeEphem(p);
    if(e && e.lightDay && (p.lightDayAlways || Math.abs(Date.parse(e.lightDay.geometric) - ms) < LIGHT_DAY_WINDOW_MS))
      probes.lightDay.push(buildLightDayMembrane(p));
  });
  if(missing) console.error(`probes/ephem.json: brak trajektorii dla ${missing} sond`);
  addProbeRail();
  updateProbes();
  probes.timer = setInterval(updateProbes, PROBE_TICK_MS);
}

// Membrana „1 dzień świetlny od Ziemi": wycinek sfery o promieniu LIGHT_DAY_AU wokół Ziemi, w osi Ziemia→sonda —
// świecąca błona (jasna przy punkcie przebicia, zanika do 400 j. sceny) + pierścienie (1,5–400 j.) + szprychy
// + punkt przebicia + podpis z odliczaniem; sonda przebija ją na żywo (zegar 1:1).
// Lokalnie oś = +Z; grupa: pozycja = Ziemia, kwaternion = obrót +Z → kierunek sondy (updateProbes).
// Znaczniki godzin świetlnych: sygnały „wysłane" o pełnych godzinach UTC lecą od Ziemi do sondy z prędkością światła.
const LD_RINGS = [1.5, 4, 10, 25, 60, 150, 400];
const LD_FILM_R = [0, 0.3, 0.7, 1.5, 2.5, 4, 6.5, 10, 16, 25, 40, 60, 100, 150, 250, 400];   // pierścienie siatki błony
const LD_LABEL_W = 1400, LD_LABEL_H = 200;   // szerokość: „… przebije ją za 1 d 23 h 59 min” w 44 px mono
function buildLightDayMembrane(p){
  const R = ProbeEphem.LIGHT_DAY_AU * AU_SCALE;
  const mat = op => new THREE.LineBasicMaterial({color:0x6fdcff, transparent:true, opacity:op,
    depthWrite:false, blending:THREE.AdditiveBlending});
  const onSphere = (r, ph) => { const th = r/R; return new THREE.Vector3(R*Math.sin(th)*Math.cos(ph), R*Math.sin(th)*Math.sin(ph), R*Math.cos(th)); };
  const group = new THREE.Group();
  // błona: siatka pierścieni na sferze, kolor wierzchołka ∝ zanik (addytywnie czarny = niewidoczny)
  const SEG = 96, pos = [], col = [], idx = [];
  LD_FILM_R.forEach(r=>{
    const fade = Math.pow(r <= 0.5 ? 1 : Math.max(0, 1 - Math.log(r/0.5)/Math.log(400/0.5)), 1.6);
    for(let k=0; k<SEG; k++){ const v = onSphere(r, k/SEG*Math.PI*2); pos.push(v.x, v.y, v.z); col.push(0.035*fade, 0.11*fade, 0.15*fade); }
  });
  for(let i=0; i<LD_FILM_R.length-1; i++) for(let k=0; k<SEG; k++){
    const a = i*SEG+k, b = i*SEG+(k+1)%SEG, c = a+SEG, d = b+SEG; idx.push(a, c, b, b, c, d);
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); fg.setIndex(idx);
  const film = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, depthWrite:false,
    blending:THREE.AdditiveBlending, side:THREE.DoubleSide}));
  group.add(film);
  LD_RINGS.forEach((r, i)=>{
    const pts = []; for(let k=0; k<=128; k++) pts.push(onSphere(r, k/128*Math.PI*2));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat(0.8 - i*0.08)));
  });
  const spokes = [];
  for(let k=0; k<12; k++){ const ph = k/12*Math.PI*2; spokes.push(onSphere(LD_RINGS[0], ph), onSphere(LD_RINGS[LD_RINGS.length-1], ph)); }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spokes), mat(0.22)));
  if(!probes.pulseTex) probes.pulseTex = glowTexture('rgba(235,252,255,1)', 'rgba(120,220,255,0.35)');
  // punkt przebicia: miejsce, w którym tor sondy przechodzi przez membranę (stały rozmiar na ekranie)
  const dot = new THREE.Sprite(new THREE.SpriteMaterial({map:probes.pulseTex, color:0x9ff0ff, sizeAttenuation:false,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
  dot.scale.set(0.03, 0.03, 1); dot.position.set(0, 0, R); group.add(dot);
  // podpis na membranie (canvas → sprite, stały rozmiar na ekranie, zawsze na wierzchu)
  const cv = document.createElement('canvas'); cv.width = LD_LABEL_W; cv.height = LD_LABEL_H;
  const tex = new THREE.CanvasTexture(cv);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, sizeAttenuation:false, transparent:true,
    depthTest:false, depthWrite:false}));
  // kotwica = punkt przebicia (przy sondzie zawsze w kadrze); center < 0 przesuwa napis w prawo i w górę na ekranie
  label.center.set(-0.06, -0.35); label.scale.set(0.49, 0.49*LD_LABEL_H/LD_LABEL_W, 1); label.renderOrder = 10;
  label.position.set(0, 0, R); group.add(label);
  scene.add(group);
  // promień Ziemia→sonda (blady) + znaczniki godzin świetlnych
  const beam = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)),
    new THREE.LineBasicMaterial({color:0x8fe3ff, transparent:true, opacity:0.12, depthWrite:false, blending:THREE.AdditiveBlending}));
  beam.frustumCulled = false; scene.add(beam);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64*3), 3));
  const pulses = new THREE.Points(pg, new THREE.PointsMaterial({color:0xcff6ff, size:9, sizeAttenuation:false,
    map:probes.pulseTex, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
  pulses.frustumCulled = false; scene.add(pulses);
  return { id:p.id, group, beam, pulses, R, film, label, labelCv:cv, labelTex:tex, labelText:'' };
}

// Podpis membrany: tytuł + odliczanie do przebicia (godzina z Horizons, jak na karcie). Przerysowany tylko przy zmianie.
function drawLightDayLabel(m, p, ms){
  const ld = probeEphem(p).lightDay, t = Date.parse(ld.geometric);
  const line2 = t > ms ? `${p.name} przebije ją za ${ProbeEphem.fmtDuration((t-ms)/1000)}`
                       : `${p.name} przebił(a) ją ${ProbeEphem.fmtDuration((ms-t)/1000)} temu`;
  const text = '1 dzień świetlny od Ziemi\n' + line2;
  if(text === m.labelText) return;
  m.labelText = text;
  const x = m.labelCv.getContext('2d');
  x.clearRect(0, 0, LD_LABEL_W, LD_LABEL_H);
  // ciemna podkładka pod tekstem — czytelność na jasnej sondzie i błonie
  x.font = '600 58px "Space Grotesk", sans-serif'; const w1 = x.measureText('1 dzień świetlny od Ziemi').width;
  x.font = '44px "IBM Plex Mono", monospace'; const w2 = x.measureText(line2).width;
  x.fillStyle = 'rgba(2,8,16,0.62)'; x.fillRect(0, 30, Math.min(LD_LABEL_W, 26 + Math.max(w1, w2) + 24), 140);
  x.fillStyle = 'rgba(111,220,255,0.9)'; x.fillRect(0, 38, 6, 124);
  x.shadowColor = 'rgba(0,0,0,0.9)'; x.shadowBlur = 6;
  x.font = '600 58px "Space Grotesk", sans-serif'; x.fillStyle = '#bff2ff'; x.fillText('1 dzień świetlny od Ziemi', 26, 88);
  x.font = '44px "IBM Plex Mono", monospace'; x.fillStyle = '#e4f7ff'; x.fillText(line2, 26, 150);
  x.shadowBlur = 0;
  m.labelTex.needsUpdate = true;
}

const _ldZ = new THREE.Vector3(0,0,1), _ldDir = new THREE.Vector3();
// JEDYNY pisarz pozycji sond swobodnych, śladów, membran i żywej karty (tick PROBE_TICK_MS)
function updateProbes(){
  if(!probes.active) return;
  const ms = probeClockMs(), jd = Ephemeris.julianDate(ms);
  Object.values(probes.byId).forEach(({p, mk, line})=>{
    const e = probeEphem(p); if(!e) return;
    mk.position.copy(eclToScene(ProbeEphem.positionAt(e.samples, jd)));
    const k = ProbeEphem.countUntil(e.samples, jd), a = line.geometry.attributes.position;
    if(k !== line.userData.k){            // nowa próbka za plecami (albo skok zegara w locie) — przepisz przeszłość
      for(let i=0; i<k; i++){ const v = eclToScene({x:e.samples[i][1], y:e.samples[i][2], z:e.samples[i][3]}); a.setXYZ(i, v.x, v.y, v.z); }
      line.userData.k = k; line.geometry.setDrawRange(0, k+1);
    }
    a.setXYZ(k, mk.position.x, mk.position.y, mk.position.z); a.needsUpdate = true;
  });
  const earthB = bodies.find(b=>b.data.id==='earth');
  if(earthB) probes.lightDay.forEach(m=>{
    const earth = worldPos(earthB), mk = probes.byId[m.id].mk;
    _ldDir.copy(mk.position).sub(earth); const d = _ldDir.length(); _ldDir.normalize();
    m.group.position.copy(earth); m.group.quaternion.setFromUnitVectors(_ldZ, _ldDir);
    const b = m.beam.geometry.attributes.position;
    b.setXYZ(0, earth.x, earth.y, earth.z); b.setXYZ(1, mk.position.x, mk.position.y, mk.position.z); b.needsUpdate = true;
    const fr = ProbeEphem.pulseFractions(d/AU_SCALE, ms, 3600), pa = m.pulses.geometry.attributes.position;
    const n = Math.min(fr.length, pa.count);
    for(let i=0; i<n; i++) pa.setXYZ(i, earth.x+_ldDir.x*d*fr[i], earth.y+_ldDir.y*d*fr[i], earth.z+_ldDir.z*d*fr[i]);
    m.pulses.geometry.setDrawRange(0, n); pa.needsUpdate = true;
    drawLightDayLabel(m, probes.byId[m.id].p, ms);
  });
  // pasek stanu w panelu
  const nFree = PROBES.filter(p=>!p.atBody && probeEphem(p)).length;
  let html = `🚀 ${nFree} sond z JPL Horizons · ${PROBES.length-nFree} przy planetach`;
  probes.lightDay.forEach(m=>{ const p = probes.byId[m.id].p, ld = probeEphem(p).lightDay;
    html += `<br>${p.name}: 1 dzień świetlny od Ziemi ${ProbeEphem.relativeTo(Date.parse(ld.geometric), ms)}`; });
  if(dsnLive(ms)){
    if(dsn.err) html += `<br>📡 DSN: brak danych z feedu NASA (${dsn.err})`;
    else (dsn.links||[]).filter(l=>l.probeId).forEach(l=>{ const p = PROBES.find(x=>x.id===l.probeId);
      html += `<br>📡 ${p.name} ← ${l.siteName} ${l.dish} · ${String(l.downRate).replace('.', ',')} bit/s`; });
  }
  if(dsnFx.beams.size) html += '<br>złota wiązka z paczkami = dane odbierane teraz przez DSN';
  html += '<br>znaczniki na promieniu = 1 godzina świetlna<br>kliknij sondę po szczegóły';
  if(html !== probes.statHtml){ document.getElementById('probeStat').innerHTML = html; probes.statHtml = html; }
  // żywa karta otwartej sondy
  const shown = elInfo.classList.contains('show') && document.getElementById('iName').textContent;
  const cur = shown && Object.values(probes.byId).find(x=>x.p.name===shown);
  if(cur && (probeEphem(cur.p) || DSN_PROBES.has(cur.p.id))) renderProbeStats(cur.p, ms);
}

function stopProbes(){
  stopDsn();
  removeProbeRail();
  if(probes.timer){ clearInterval(probes.timer); probes.timer = null; }
  probes.markers.forEach(m=>{ m.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); }); scene.remove(m); });
  probes.trails.forEach(l=>{ l.geometry.dispose(); l.material.dispose(); scene.remove(l); });
  probes.lightDay.forEach(m=>{ m.labelTex.dispose(); [m.group, m.beam, m.pulses].forEach(o=>{
    o.traverse(c=>{ if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); }); scene.remove(o); }); });
  probes.markers=[]; probes.trails=[]; probes.byId={}; probes.lightDay=[]; probes.active=false;
  const el=document.getElementById('probeStat'); if(el) el.style.display='none';
}

/* ---------- Sondy: lista (rail) + focus + karta info ---------- */
function addProbeRail(){
  PROBES.forEach(p=> rail.appendChild(railButton({ cls:'probe-rail', data:{probeId:p.id},
    color:'#'+new THREE.Color(p.color).getHexString(), label:'🚀 '+p.name, onClick:()=>focusProbe(p.id) })));
}
function removeProbeRail(){ document.querySelectorAll('.probe-rail').forEach(b=>b.remove()); }

// żywe fakty sondy (zegar sond) — wołane z pętli sond dla otwartej karty; karta: showCard('probe', p)
function renderProbeStats(p, ms){ fillStats(Object.entries(probeFacts(p, ms))); }

function focusProbe(id){
  const p = PROBES.find(x=>x.id===id); if(!p) return;
  const mk = probes.markers.find(m=>m.userData.probeId===id); if(!mk) return;
  focused = null; focusedMoon = null; focusedShip = false;
  const wp = mk.position.clone();
  const ld = probes.lightDay.find(m=>m.id===id);
  if(ld){
    // membrana dnia świetlnego: kamera z boku i od strony Ziemi → błona jako ściana za sondą, sonda tuż przed nią
    const u = wp.clone().sub(ld.group.position).normalize();
    const side = new THREE.Vector3().crossVectors(u, new THREE.Vector3(0,1,0));
    if(side.lengthSq() < 1e-6) side.set(1,0,0);
    side.normalize();
    // sonda daleko przed błoną (V2: ~28 AU) → kamera za sondą, wzdłuż osi: błona jako odległa tarcza za nią,
    // punkt przebicia i podpis w kadrze obok sondy (z boku byłyby ~60° poza osią widoku)
    const far = ld.R - wp.distanceTo(ld.group.position) > LD_FAR_GAP;
    // (−side: przebicie wypada na lewo od sondy, podpis rośnie w prawo — nie pod kartę #info w prawym rogu)
    startTween(far ? wp.clone().addScaledVector(side, -8).addScaledVector(u, -30).add(new THREE.Vector3(0,4,0))
                   : wp.clone().addScaledVector(side, 14).addScaledVector(u, -8).add(new THREE.Vector3(0,5,0)), wp);
    controls.minDistance = 2; controls.maxDistance = 60000;
  } else frameMarker(wp);
  showCard('probe', p);
  document.querySelectorAll('.rail-group.open').forEach(grp=>expandGroup(grp, false));
  updateMoonOrbits();
}

/* ---------- Komety: lista (rail) + focus + karta info ---------- */
function addCometRail(){
  COMETS.forEach(c=> rail.appendChild(railButton({ cls:'comet-rail', data:{cometId:c.id},
    color:'#'+new THREE.Color(c.color).getHexString(), label:'☄ '+c.pl, onClick:()=>focusComet(c.id) })));
}
function removeCometRail(){
  document.querySelectorAll('.comet-rail').forEach(b=>b.remove());
}

function focusComet(id){
  const c = COMETS.find(x=>x.id===id); if(!c) return;
  const mk = reality.cometMarkers.find(m=>m.userData.cometId===id); if(!mk) return;
  focused = null; focusedMoon = null; focusedShip = false;
  frameMarker(mk.position.clone());
  showCard('comet', c);
  document.querySelectorAll('.rail-group.open').forEach(grp=>expandGroup(grp, false));
  updateMoonOrbits();
}

// Chase-cam na statku: leci do mesha, potem śledzi co klatkę prostym prevTarget-delta (jak planety/księżyce).
// Pan: startTween go WŁĄCZA, ta funkcja WYŁĄCZA (po startTween) → pościg bez pan. ⚠ MUSI zasiać prevTarget (pułapka focusProbe).
function focusShip(){
  if(!ship.mesh) return;
  focused = null; focusedMoon = null; focusedShip = true;
  const wp = ship.mesh.getWorldPosition(_shipWP).clone();
  const dir = tmpV.copy(camera.position).sub(wp);
  if(dir.lengthSq() < 1e-12) dir.set(0, 0.3, 1);
  dir.normalize();
  const cr = trueRadius(R_KM[ship.center] || 6371);          // promień ciała centralnego (skala sceny)
  const dist = Math.max(shipMeshScale()*6, cr*0.5);
  const camTo = wp.clone().add(dir.multiplyScalar(dist)).add(new THREE.Vector3(0, shipMeshScale()*2, 0));
  if(flight.active && flight.warp >= 100){                  // ekstremalny warp → tween się rozjedzie, ustaw od razu
    tween = null;                                           // ubij ewentualny trwający tween (inaczej walczyłby ze snapem ~1,3 s — review fix)
    controls.enablePan = true;                              // (mirror startTween: każdy focus włącza pan)
    camera.position.copy(camTo); controls.target.copy(wp); controls.enabled = true;
  } else {
    startTween(camTo, wp);
  }
  controls.minDistance = shipMeshScale()*1.5;
  controls.maxDistance = cr*80;                              // można odjechać i zobaczyć całą orbitę + planetę
  controls.enablePan = false;                                // chase: bez pan (PO startTween, które ją włącza)
  prevTarget.copy(wp);                                       // ⚠ seed: pierwsza klatka follow-delta = 0 (bez skoku)
  document.querySelectorAll('.rail-group.open').forEach(grp=>expandGroup(grp, false));
  updateUI(null);
  elBack.classList.add('show');                        // M1b-2 debt: w chase #back musi być widoczny (jedyne wyjście)
}

/* ============================================================
   Build the planet rail (UI)
   ============================================================ */
const rail=document.getElementById('rail');
// rozwiń/zwiń podlistę księżyców danej grupy planety
function expandGroup(grp, open){
  grp.classList.toggle('open', open);
  const c=grp.querySelector('.chev'); if(c && !c.classList.contains('empty')) c.textContent = open?'▾':'▸';
}
// akordeon: rozwiń grupę księżyców tylko dla wskazanej planety, zwiń pozostałe
function openOnlyMoonGroup(planetId){
  document.querySelectorAll('.rail-group').forEach(grp=>{
    const hasMoons = !!grp.querySelector('.rail-sub');
    expandGroup(grp, hasMoons && grp.dataset.id===planetId);
  });
}
function clearRailActive(){ document.querySelectorAll('.rail-btn.active,.moon-btn.active').forEach(b=>b.classList.remove('active')); }
/* ---------- Słońce: dane karty + pigułka na początku paska ---------- */
const SUN_INFO = {
  eye: 'Gwiazda · typ widmowy G2V',
  desc: 'Gwiazda ciągu głównego, ok. 4,6 mld lat. Skupia 99,86% masy Układu Słonecznego.',
  color: '#ffcf7a',
  facts: { 'Średnica':'1 392 700 km', 'Masa':'333 000 Ziem', 'Powierzchnia':'5 772 K',
           'Jądro':'~15,7 mln K', 'Obrót (równik)':'25,38 dnia', 'Światło do Ziemi':'8 min 20 s' },
  wiki: { lang:'pl', title:'Słońce' },
};
rail.appendChild(railButton({ data:{id:'sun'}, chev:'', color:SUN_INFO.color, label:'Słońce', au:'0 AU', onClick:()=>focusSun() }));

/* ============================================================
   Rejestr obiektów do wybrania (Selectables) — JEDNO źródło prawdy dla:
   etykiety w oknie „Informacje" (openInfoModal), akcji kliknięcia (pointerup)
   i karty #info (showCard). Nowy rodzaj = wpis tutaj + cel raycastu w pickAt;
   test/selectables.test.js pilnuje, że oba zbiory rodzajów są równe.
   ============================================================ */
const KINDS = Selectables.defineKinds({
  sun: { label:'Gwiazda', select:()=>focusSun(),
    card:()=>({ eye:SUN_INFO.eye, name:'Słońce', sub:SUN_INFO.desc, facts:SUN_INFO.facts, rail:'.rail-btn[data-id="sun"]' }) },
  planet: { label:'Planeta', select:r=>focusBody(r.id),
    card:p=>({ eye:'Planeta · '+p.facts['Odległość']+' od Słońca', name:p.pl, sub:subtitleFor(p.id), facts:p.facts,
               rail:`.rail-btn[data-id="${p.id}"]`, skins:p.id }) },
  moon: { label:'Księżyc', select:r=>focusMoon(r.planetId, r.idx),
    card:r=>{ const pd=bodies.find(b=>b.data.id===r.planetId).data, mn=pd._moons[r.idx].data;
      return { eye:'Księżyc · '+pd.pl, name:mn.n, sub:'Naturalny satelita',
               facts:{ Rodzic:pd.pl, 'Okres orbitalny':MoonFormat.fmtPeriod(mn.days), 'Średnica':MoonFormat.fmtKm(mn.km) },
               rail:`.moon-btn[data-moon="${r.planetId}:${r.idx}"]` }; } },
  comet: { label:'Kometa', select:r=>focusComet(r.id),
    card:c=>({ eye:'Kometa · '+c.facts['Typ'], name:c.pl, sub:c.desc, facts:c.facts, rail:`.rail-btn[data-comet-id="${c.id}"]` }) },
  probe: { label:'Sonda', select:r=>focusProbe(r.id),
    card:p=>({ eye:'Sonda · '+p.facts['Status'], name:p.name, sub:p.desc, facts:probeFacts(p, probeClockMs()),
               rail:`.rail-btn[data-probe-id="${p.id}"]` }) },
  ship: { label:'Statek', select:()=>focusShip() },
  sat: { label:'Satelita Ziemi', select:(r,o)=>selectSat({idx:r.idx, name:o.name}) },
  geo: { label:'Obiekt na Ziemi', select:r=>{
    if(r.empty){ deselectEdu(); deselectSat(); }
    else if(r.range) selectRange(r.range);
    else if(r.country) selectCountry(r.country);
    else selectEdu(r.label); } },
  asteroid: { label:'Pas planetoid', select:null },     // klik bez akcji (brak tożsamości); „Informacje" działa
  star: { label:'Gwiazdozbiór', select:r=>selectConstellation(r.asterism) },
  // --- skale kosmiczne (Droga Mleczna, galaktyki, obce układy) ---
  mwsun: { label:'Gwiazda', select:()=>exitGalactic() },                      // afordancja powrotu D→B (spec §3)
  mwfeature: { label:'Struktura Drogi Mlecznej', select:(r,o)=>mwOpenFeature(o) },   // podświetlenie + kadr + karta (spec §4.2)
  mwobject: { label:'Obiekt Drogi Mlecznej', select:(r,o)=>mwOpenObject(o) },
  gxreturn: { label:'Nawigacja', select:()=>exitExgalaxy() },                 // marker powrotu E→(A|B)
  gxlandmark: { label:'Obiekt w galaktyce', select:(r,o)=>{                   // landmark katalogowy w god-view galaktyki
    const mf = o.facts ? Object.assign({}, o.facts) : {};
    if(r && r.lmKind === 'companion') mf['Uwaga'] = 'pozycja rzutowana; głębia l.o.s. nieokreślona';
    showGlow(o.worldPos, o.color, false);
    openInfoModal(Object.assign({}, o, { facts:Object.keys(mf).length ? mf : null })); } },
  galaxy: { label:'Galaktyka', select:r=>enterExgalaxy(r.id) },              // prawy klik → „ℹ Informacje" otwiera kartę BEZ dolotu
  starsystem: { label:'Układ gwiazdowy', select:(r,o,{e})=>{
    // Touch nie ma hoveru → 1. tap = nazwa+poświata, 2. tap w TĘ SAMĄ gwiazdę = dolot (finding #6).
    if(e && e.pointerType === 'touch' && _tapArm !== r.id){
      _tapArm = r.id;
      showGlow(o.worldPos, o.color, false);
      showHoverName(o.name, o.color, e.clientX, e.clientY);
      return;
    }
    _tapArm = null; hideHover();
    if(typeof navigateToSystem === 'function') navigateToSystem(r.id); } },
  alienstar: { label:'Gwiazda', select:null },                                // bez focusu (hover + menu „Informacje" wystarczą)
  alienplanet: { label:'Planeta', select:r=>{ if(typeof focusStarPlanet === 'function') focusStarPlanet(r.idx); } },
  aliencompanion: { label:'Gwiazda towarzysząca', select:(r,o)=>openInfoModal(o) },  // parytet z klikiem etykiety
});

// Jedyny renderer karty #info — model z rejestru (Selectables.cardModel), treść przez textContent.
function showCard(kind, ref){
  const m = Selectables.cardModel(KINDS, kind, ref);
  clearRailActive();
  if(m.rail){ const b=document.querySelector(m.rail); if(b) b.classList.add('active'); }
  document.getElementById('iEye').textContent = m.eye;
  document.getElementById('iName').textContent = m.name;
  document.getElementById('iSub').textContent = m.sub;
  fillStats(m.stats);
  if(m.skins) buildSkinSelector(m.skins);
  else { const t=document.getElementById('iTex'); if(t) t.textContent=''; }
  elInfo.classList.add('show'); elBack.classList.add('show');
}

// Statystyki karty #info: [[etykieta, wartość]] → .stat (textContent, bez innerHTML).
function fillStats(entries){
  const s=document.getElementById('iStats'); s.textContent='';
  entries.forEach(([k,v])=>{
    const d=document.createElement('div'); d.className='stat';
    const l=document.createElement('div'); l.className='l'; l.textContent=k;
    const val=document.createElement('div'); val.className='v'; val.textContent=String(v);
    d.appendChild(l); d.appendChild(val); s.appendChild(d);
  });
}

// Kadr kuli (planeta/księżyc/Słońce): z bieżącej strony kamery, lekko z góry, granice zoomu świadome near-plane.
function frameSphere(wp, r, minMul){
  const dir = tmpV.copy(camera.position).sub(wp);
  if(dir.lengthSq()<1e-6) dir.set(0,0.3,1);
  dir.normalize();
  const bounds = FocusScale.zoomBounds(r, camera.near, minMul);
  const dist = Math.max(r*4.2, bounds.min);             // nie bliżej, niż near-plane pozwala
  startTween(wp.clone().add(dir.multiplyScalar(dist)).add(new THREE.Vector3(0, r*0.7, 0)), wp);
  controls.minDistance = bounds.min;
  controls.maxDistance = bounds.max;
}
// Kadr znacznika punktowego (sonda/kometa): stały odstęp, szeroki zakres zoomu.
function frameMarker(wp){
  const dir = tmpV.copy(camera.position).sub(wp).normalize();
  if(dir.lengthSq()<0.001) dir.set(0,0.3,1).normalize();
  startTween(wp.clone().add(dir.multiplyScalar(40)).add(new THREE.Vector3(0,12,0)), wp);
  controls.minDistance = 2; controls.maxDistance = 60000;
}

// Pigułka paska (planety, Słońce, sondy, komety). chev: null = bez strzałki, '' = puste miejsce, '▸' = rozwijanie.
function railButton({ cls='', data={}, color, label, au='', chev=null, onClick }){
  const b=document.createElement('button'); b.className=('rail-btn '+cls).trim();
  Object.assign(b.dataset, data);
  if(chev!==null){ const c=document.createElement('span'); c.className='chev'+(chev?'':' empty'); c.textContent=chev; b.appendChild(c); }
  const dot=document.createElement('span'); dot.className='dot'; dot.style.background=color; b.appendChild(dot);
  const nm=document.createElement('span'); nm.className='nm'; nm.textContent=label; b.appendChild(nm);
  if(au){ const a=document.createElement('span'); a.className='au'; a.textContent=au; b.appendChild(a); }
  if(onClick) b.onclick=onClick;
  return b;
}
PLANETS.forEach(p=>{
  const hasMoons = p.moons && p.moons.length;
  const grp=document.createElement('div'); grp.className='rail-group'; grp.dataset.id=p.id;
  const b=railButton({ data:{id:p.id}, chev:hasMoons?'▸':'', color:'#'+new THREE.Color(p.color).getHexString(),
    label:p.pl, au:p.facts['Odległość'], onClick:()=>focusBody(p.id) });   // rozwijanie robi openOnlyMoonGroup w focusBody
  grp.appendChild(b);
  if(hasMoons){
    b.querySelector('.chev').onclick=(e)=>{ e.stopPropagation(); expandGroup(grp, !grp.classList.contains('open')); };
    const sub=document.createElement('div'); sub.className='rail-sub';
    p.moons.forEach((mn,i)=>{
      const mb=document.createElement('button'); mb.className='moon-btn'; mb.dataset.moon=`${p.id}:${i}`;
      mb.innerHTML=`<span class="dot" style="background:#${new THREE.Color(mn.color||0xcfd3da).getHexString()}"></span>
        <span class="nm">${mn.n}</span>`;
      mb.onclick=()=>focusMoon(p.id, i);
      sub.appendChild(mb);
    });
    grp.appendChild(sub);
  }
  rail.appendChild(grp);
});

/* ============================================================
   Camera fly-to + focus follow
   ============================================================ */
let focused = null;                 // current focused planet data
let focusedMoon = null;             // aktualnie wybrany księżyc {mesh, data, parentData} | null
let focusedShip = false;            // chase-cam na statku (lot) — wzajemnie wykluczające z focused/focusedMoon
let tween = null;                   // {fromP,toP,fromT,toT,t0,dur}
const prevTarget = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const _shipWP = new THREE.Vector3();   // world-pos statku do follow/seed

const easeInOut = x => x<0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2,3)/2;

function worldPos(body){ return body.group.getWorldPosition(new THREE.Vector3()); }

// Efektywny promień ciała w scenie: w „Prawdziwej skali" realny (mała kropka),
// inaczej dostrojony promień renderu. Kamera i relief liczą dystans względem niego.
function effRadius(data){ const km = R_KM[data.id]; return (trueScale && km) ? trueRadius(km) : data.radius; }

// Orbity księżyców widoczne tylko gdy: toggle Orbity ON, focus na tej planecie
// (lub jej księżycu), oraz — w „Prawdziwej skali" — tylko dla widocznych księżyców.
function updateMoonOrbits(){
  const focusId = focused ? focused.id : (focusedMoon ? focusedMoon.parentData.id : null);
  bodies.forEach(b=>{
    (b.data._moons||[]).forEach(m=>{
      if(!m.orbit) return;
      const belongs = focusId === b.data.id;
      const moonShown = m.pivot.visible;            // w trueScale księżyce nie-Ziemi są ukryte
      m.orbit.visible = showOrbits && belongs && moonShown;
    });
  });
}

function focusBody(id){
  const body = bodies.find(b=>b.data.id===id); if(!body) return;
  focused = body.data; focusedMoon = null; focusedShip = false;
  frameSphere(worldPos(body), effRadius(body.data), id==='earth' ? 1.03 : 1.25);   // Ziemia schodzi nisko nad powierzchnię
  openOnlyMoonGroup(id);
  updateUI(body.data);
  updateMoonOrbits();
}

// Przekadrowanie po zmianie skali (toggle „Prawdziwa skala") — zachowuje rozmiar
// kątowy ciała, więc kamera nie odskakuje i Ziemia nie znika do nieosiągalnej kropki.
function reframeFocus(body, prevR, newR){
  const wp = worldPos(body);
  const bounds = FocusScale.zoomBounds(newR, camera.near, body.data.id==='earth' ? 1.03 : 1.25);
  const newDist = FocusScale.reframeDistance(camera.position.distanceTo(wp), prevR, newR, bounds);
  const dir = tmpV.copy(camera.position).sub(wp);
  if(dir.lengthSq()<1e-6) dir.set(0,0.3,1);
  dir.normalize();
  startTween(wp.clone().add(dir.multiplyScalar(newDist)), wp);
  controls.minDistance = bounds.min;
  controls.maxDistance = bounds.max;
}

function moonWorldPos(fm){ return fm.mesh.getWorldPosition(new THREE.Vector3()); }

// Focus na księżycu: kamera leci do meshu księżyca; pętla animacji śledzi go co
// klatkę (księżyc orbituje). Kadr/granice zoomu wg promienia księżyca (focus-scale).
function focusMoon(planetId, idx){
  const pb = bodies.find(b=>b.data.id===planetId); if(!pb) return;
  const fm = pb.data._moons && pb.data._moons[idx]; if(!fm) return;
  fm.pivot.visible = true;                              // wymuś widoczność (np. ukryte w trueScale)
  focused = null; focusedMoon = { mesh:fm.mesh, data:fm.data, parentData:pb.data }; focusedShip = false;
  frameSphere(moonWorldPos(focusedMoon), fm.data.r);   // promień meshu księżyca (skala sceny)
  openOnlyMoonGroup(planetId);
  showCard('moon', { planetId, idx });                  // karta + aktywna pigułka księżyca
  updateMoonOrbits();
}

// Focus na Słońcu (zawsze w początku układu): kadr wg bieżącego promienia (poglądowy ↔ prawdziwa skala).
function focusSun(){
  focused = null; focusedMoon = null; focusedShip = false; deselectEdu(); deselectSat();
  frameSphere(new THREE.Vector3(0,0,0), SUN_RADIUS * sun.scale.x);   // Słońce zawsze w początku układu
  document.querySelectorAll('.rail-group.open').forEach(grp=>expandGroup(grp, false));
  showCard('sun', null);
  updateMoonOrbits();
}

function goSystem(){
  focused = null; focusedMoon = null; focusedShip = false; deselectEdu(); deselectSat();
  document.querySelectorAll('.rail-group.open').forEach(grp=>expandGroup(grp, false));
  const ov = realScale ? new THREE.Vector3(0, 760, 1980) : new THREE.Vector3(0, 95, 230);
  startTween(ov, new THREE.Vector3(0,0,0));
  controls.minDistance = realScale ? 60 : 20;
  controls.maxDistance = realScale ? 4200 : 1200;
  updateUI(null);
  updateMoonOrbits();
}
function startFlight(){
  if(!(cosmos.scale==='system' && cosmos.systemId==='sol')) return;   // lot orbitalny TYLKO w Układzie Słonecznym (nie w interstellar/obcym układzie)
  FlightCore.init();                                  // wstrzyk adaptera {x,y,z}→[x,y,z] PRZED jakimkolwiek stepShip
  flight.clockMs = reality.clockMs || Date.now();     // dziedzicz realne „teraz" (epoch-ms) → poprawne efemerydy
  flight.warpIdx = 0;
  const t0 = flight.clockMs / 1000;                   // epoka [s]
  const mu = Orbit.MU.earth, R = FlightCore.R_KM.earth, alt = 400, r0 = R + alt, vc = Math.sqrt(mu / r0);
  ship.center = 'earth';
  flight.predictTarget = (ship.center === 'earth') ? 'mars' : 'earth';   // domyślny cel = "druga" planeta
  ship.coe = Orbit.rv2coe({ x:r0, y:0, z:0 }, { x:0, y:vc, z:0 }, mu, t0);   // kołowa LEO 400 km
  ship.r = { x:r0, y:0, z:0 }; ship.v = { x:0, y:vc, z:0 };
  ship.stats = ShipStats.fromPreset('orbiter');
  const _dvB = Math.ceil(ShipStats.dvBudget(ship.stats) * 1000);     // budżet Δv → m/s
  ['fmPro','fmNor','fmRad'].forEach(id=>{ const s=document.getElementById(id); if(s){ s.min=String(-_dvB); s.max=String(_dvB); } });
  ship.lastGoodCoe = ship.coe; ship.regime = 'elliptic'; ship.flag = null;
  ship.nodes = []; ship.selNode = -1; ship._lastCp = null;   // KSP: pusta kolejka na wejściu w lot (węzeł dodajesz „+ węzeł")
  ship.active = true; flight.active = true;
  _flightProbe = 0;                                                  // re-armuj probe na każde wejście w lot (gates 0/40/45)
  // statek widoczny TYLKO w prawdziwej skali (realny LEO ~0,002 j. siadłby w poglądowo dużej planecie)
  flight.savedTrueScale = trueScale;
  if(!trueScale){ applyTrueScale(true); setToggle('tTrueScale', true); }
  if(!ship.mesh){ ship.mesh = buildShipMesh(); scene.add(ship.mesh); }
  if(!ship.trail) initShipTrail(); else { ship._trailN = 0; ship._trailCenter = ship.center; ship.trail.geometry.setDrawRange(0,0); }
  ship.trail.visible = true;
  ship.mesh.position.copy(kmToScene(ship.r, shipCenterScenePos()));  // ustaw PRZED auto-focusem (Task 4) — inaczej focusShip czyta (0,0,0)=Słońce
  ship.mesh.scale.setScalar(shipMeshScale());
  ship.mesh.visible = true;
  document.getElementById('flight-orbit').classList.add('show');
  document.getElementById('flight-warp').classList.add('show');
  document.getElementById('flight-maneuver').classList.add('show');
  document.getElementById('galaxyMenu').classList.add('gx-hidden');   // schowaj menu galaktyk w locie
  document.getElementById('flightBtn').classList.add('on');
  flight._effWarp = 1; updateWarpHud();
  resetManeuver();
  focusShip();                                        // od razu pokaż statek (pierwszy widoczny lot)
}
function exitFlight(){
  flight.active = false; ship.active = false;
  // reality.active POZOSTAJE true (startReality() wołane raz przy starcie ~L2310; stopReality() = martwy kod)
  // → pasywny widok po prostu wznawia tykanie od „teraz":
  reality.clockMs = Date.now();                       // snap pasywnego zegara na realne „teraz"
  // planety/komety zostały pod warpem przesunięte w „przyszłość" — wróć je na realne „teraz",
  // żeby pasywny widok nie startował z planetami w złym miejscu:
  const jdExit = Ephemeris.julianDate(reality.clockMs);
  bodies.forEach(b=>{ const el = Ephemeris.REAL_PLANETS.find(p=>p.id===b.data.id);
    if(el) b.group.position.copy(eclToScene(Ephemeris.positionAt(el, jdExit))); });
  reality.cometMarkers.forEach(mk=>{ const c = COMETS.find(x=>x.id===mk.userData.cometId);
    if(c) mk.position.copy(eclToScene(Ephemeris.positionAt(c, jdExit))); });
  if(ship.mesh) ship.mesh.visible = false;
  if(ship.orbitLine) ship.orbitLine.visible = false;
  if(ship.predictLine) ship.predictLine.visible = false;
  hidePredictSegs(); hidePredictMarks();
  if(_predictTimer){ clearTimeout(_predictTimer); _predictTimer = 0; }   // anuluj zaległy debounce (inaczej recomputePredict odpala 130 ms PO teardown)
  ship.nodes = []; ship.selNode = -1; ship._lastCp = null; flight._warpToNode = false;   // teardown kolejki
  if(ship.nodeMarker) ship.nodeMarker.visible = false;
  if(ship.nodeArrow)  ship.nodeArrow.visible  = false;
  hideNodeGizmo();
  refreshNodeButtons();
  if(ship.trail) ship.trail.visible = false;
  ['flight-orbit','flight-warp','flight-maneuver'].forEach(id=>document.getElementById(id).classList.remove('show'));
  document.getElementById('galaxyMenu').classList.remove('gx-hidden');   // przywróć menu galaktyk po locie
  document.getElementById('flightBtn').classList.remove('on');
  focusedShip = false; controls.enablePan = true;     // zwolnij chase (defensywnie; Esc/← i tak wołają goSystem)
  if(flight.savedTrueScale === false && trueScale){ applyTrueScale(false); setToggle('tTrueScale', false); }
  if(sats.active) repropagateSatellites(new Date(reality.clockMs));   // satelity na „teraz"
}

// jeden krok lotu statku w klatce (headless w M1b-1: aktualizuje SSOT, BEZ mesh/HUD — te w M1b-2/3).
// advanceShip: jdNow nieużywane TUTAJ (placement/repozycja w animate używają group.position); param zachowany dla sygnatury.
let _flightProbe = 0;
function advanceShip(dtScene, jdNow){
  if(!flight.active || !ship.coe) return;
  const res = FlightCore.stepFlight(ship, dtScene);
  if(!res.ok){ ship.coe = res.coe; ship.center = res.center; ship.flag = res.reason;             // degraduj, nigdy throw
    const sv = Orbit.propagateCoe(ship.coe, Orbit.MU[ship.center], 0);                            // I4: r,v spójne z (rolled-back) coe.t0 — mesh nie odlepia się od orbity
    if(isFinite(sv.r.x) && isFinite(sv.v.x)){ ship.r = sv.r; ship.v = sv.v; }
    return; }
  const _prevCenter = ship.center;                  // ← zapisz przed mutacją (SOI-clear)
  ship.lastGoodCoe = ship.coe;
  ship.coe = res.coe; ship.center = res.center; ship.r = res.r; ship.v = res.v;
  ship.regime = Orbit.regimeOf(ship.coe, FlightCore.R_KM[ship.center] || 0);
  if(ship.flag && ship.flag !== 'impact') ship.flag = null;   // M1b-1 debt: skasuj przejściową flagę (nan/throw) po odzyskaniu; impact ustawiany świeżo niżej
  if(res.impact) ship.flag = 'impact';
  if(ship.center !== _prevCenter && ship.nodes.length){              // §7.6: po realnym crossingu NIE czyść na ślepo — przelicz łańcuch w nowej ramce (sync)
    recomputePredict();                                              // ustawia _lastCp + ocenia ok; węzeł z t<ship.coe.t0 po crossingu → predictPath 'stale' → ok=false (determinizm#1)
    if(!ship._lastCp || !ship._lastCp.ok){                           // łańcuch urwany → kolejka nieważna w nowej ramce → wyczyść + nota
      ship.nodes = []; ship.selNode = -1; ship._lastCp = null;
      if(ship.nodeMarker) ship.nodeMarker.visible = false; hideNodeArrow(); hideNodeGizmo(); hidePredictSegs(); hidePredictMarks();
      refreshNodeButtons(); updateManeuverHud(); if(ship.flag !== 'impact') ship.flag = 'node-cleared-soi'; }   // #fmSum→0 (inaczej zostaje stara suma)
  }
  // ---- probe M1b-3 (TODO: usuń wraz z probe-m1b3.mjs) ----
  if(new URLSearchParams(location.search).has('flight')){
    if(_flightProbe === 0){ flight.warpIdx = 7; }                      // ×100000 → cap MUSI zadziałać dla LEO (okres ~5553 s)
    _flightProbe++;
    if(_flightProbe === 40 && typeof rebuildPredict === 'function'){    // KSP: wstrzyknij węzeł (zamiast burn-now) → predykcja + Σ Δv
      ship.nodes = [{ t: flight.clockMs/1000 + 30, pnr:{ pro:60, nor:0, rad:0 } }]; ship.selNode = 0;
      if(typeof updateManeuverHud === 'function') updateManeuverHud();  // slider handler tu nie biegnie → odśwież ręcznie
      rebuildPredict();
    }
    if(_flightProbe === 45){
      const tx = id=>{ const e=document.getElementById(id); return e?e.textContent:''; };
      console.log('M1B3',
        'center='+ship.center,
        'dist='+Math.round(Math.hypot(ship.r.x, ship.r.y, ship.r.z)),
        'ap='+tx('foAp').replace(/\s/g,''),                            // DOM read: dowód że updateShipHud pisze
        'tp='+tx('foTp'),                                              // DOM read
        'warp='+flight.warp,                                           // RAW (uniknij locale-spacji)
        'cap='+(flight._effWarp!=null && flight._effWarp < flight.warp - 1e-6 ? 1 : 0),   // RAW
        'predict='+(ship.predictSegs ? ship.predictSegs.filter(l=>l.visible).length : 0),  // M2: liczba widocznych segmentów predykcji
        'sum='+maneuverSum());                                         // m/s wybranego węzła
    }
    if(_flightProbe === 50){
      // §4.6 self-test bramki warp (luka #7): pod warpem 1. „Wykonaj" TYLKO zbija warp→×1 (bez burna), 2. odpala.
      // KSP: węzeł CZOŁOWY w „teraz" (dtN≈0 → fire pali natychmiast, nie tylko arm warp-do-węzła).
      flight.warpIdx = 7;                                                                    // upewnij warp>×1 (defensywnie)
      ship.nodes = [{ t: flight.clockMs/1000, pnr:{ pro:80, nor:0, rad:0 } }]; ship.selNode = 0;
      const a0 = ship.coe.a, sum0 = maneuverSum();
      fireImpulse();                                                                         // 1. klik pod warpem → tylko gate
      const g1_warp0  = flight.warpIdx === 0 ? 1 : 0;                                        // zbił warp do ×1
      const g1_noBurn = Math.abs(ship.coe.a - a0) < 1e-6 ? 1 : 0;                            // orbita NIEzmieniona
      const g1_kept   = maneuverSum() === sum0 ? 1 : 0;                                      // węzeł zachowany (nie odpalony)
      fireImpulse();                                                                         // 2. klik przy ×1 → odpala
      const g2_burned = Math.abs(ship.coe.a - a0) > 1e-3 ? 1 : 0;                            // orbita zmieniona
      const g2_reset  = (ship.nodes.length === 0) ? 1 : 0;                                   // kolejka opróżniona (shift po burnie)
      const pass = g1_warp0 && g1_noBurn && g1_kept && g2_burned && g2_reset;
      console.log('M1B3-GATE', 'pass='+(pass?1:0),
        'g1_warp0='+g1_warp0, 'g1_noBurn='+g1_noBurn, 'g1_kept='+g1_kept, 'g2_burned='+g2_burned, 'g2_reset='+g2_reset);
    }
  }
}

function startTween(toP, toT){
  controls.enablePan = true;                               // chase wyłącza pan; każdy inny focus go przywraca (centralnie)
  tween = { fromP:camera.position.clone(), toP:toP.clone(),
            fromT:controls.target.clone(), toT:toT.clone(),
            t0:performance.now(), dur:1300 };
  controls.enabled = false;
}

/* ============================================================
   UI updates
   ============================================================ */
const elInfo=document.getElementById('info'), elBack=document.getElementById('back');
function updateUI(p){
  if(p){ showCard('planet', p); return; }
  clearRailActive();
  elInfo.classList.remove('show'); elBack.classList.remove('show');
}

/* ---------- HUD lotu (M1b-3): czysty KONSUMENT ship.coe/r/v — nigdy nie pisze do ship.* ---------- */
// sekundy → zegar: <1h „m:ss", inaczej „h:mm". „—" dla Infinity/NaN.
function fmtClock(s){
  if(!isFinite(s)) return '—';
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
  return h > 0 ? h + ':' + String(m).padStart(2,'0') : m + ':' + String(ss).padStart(2,'0');
}
const _bodyPl = id => (PLANETS.find(p=>p.id===id)||{}).pl || (id==='sun'?'Słońce':id);
function updateShipHud(){
  if(!ship.coe) return;
  const mu = Orbit.MU[ship.center], R = FlightCore.R_KM[ship.center] || 0;
  const st = Orbit.deriveStats(ship.coe, mu, R, ship.r, ship.v);   // period[s], altitude/speed/peri/apo[km|km/s]
  const set = (id,txt)=>{ const e=document.getElementById(id); if(e) e.textContent = txt; };
  const ell = ship.coe.e < 1;
  set('foAp',  ell ? MoonFormat.fmtKm(st.apoapsis - R)  : '—');     // wysokość apo nad powierzchnią
  set('foPe',  MoonFormat.fmtKm(st.periapsis - R));
  set('foPer', ell ? MoonFormat.fmtPeriod(st.period/86400) : '—');  // period[s] → dni (fmtPeriod oczekuje DNI)
  set('foTp',  fmtClock(FlightCore.timeToPeri(ship.coe)));
  set('foTa',  fmtClock(FlightCore.timeToApo(ship.coe)));
  set('foAlt', MoonFormat.fmtKm(st.altitude));
  set('foV',   st.speed.toFixed(2).replace('.', ',') + ' km/s');
  set('foBody', _bodyPl(ship.center));
  // Δv pozostała + próg kolorystyczny względem budżetu (mint→amber→coral)
  const dv = ShipStats.dvRemaining(ship.stats), budget = ShipStats.dvBudget(ship.stats);
  const elDv = document.getElementById('foDv');
  if(elDv){ elDv.textContent = dv.toFixed(2).replace('.', ',') + ' km/s';
    const frac = budget > 0 ? dv/budget : 0;
    elDv.className = frac > 0.5 ? '' : (frac > 0.2 ? 'amber' : 'coral'); }
  // ostrzeżenia reżimu (§7.1/7.2)
  const reg = document.getElementById('foRegime');
  if(reg) reg.textContent = ship.regime === 'hyperbolic' ? '⚠ trajektoria ucieczkowa'
                          : ship.regime === 'suborbital' ? '⚠ trajektoria uderzeniowa' : '';
}

function updateWarpHud(){
  const v = document.getElementById('fwVal'); if(v) v.textContent = '×' + flight.warp.toLocaleString('pl-PL');
  const cap = document.getElementById('fwCap');
  if(cap) cap.textContent = (flight._effWarp != null && flight._effWarp < flight.warp - 1e-6) ? '· auto' : '';
}

/* ---------- Wybór tekstury (skin) w karcie planety ---------- */
function currentSkinIdx(id){
  const n = SKINS[id] ? SKINS[id].length : 0;
  let i; try{ i = parseInt(localStorage.getItem('solar-skin-'+id), 10); }catch(e){ i = NaN; }
  return (Number.isInteger(i) && i>=0 && i<n) ? i : 0;
}
function buildSkinSelector(id){
  const tx = document.getElementById('iTex'); if(!tx) return;
  tx.innerHTML='';
  const skins = SKINS[id]; if(!skins || skins.length < 2) return;       // brak wariantów → brak dropdownu
  const cur = currentSkinIdx(id);
  const lab = document.createElement('div'); lab.className='l'; lab.style.marginBottom='6px'; lab.textContent='Tekstura';
  const sel = document.createElement('select');
  sel.style.cssText='width:100%;background:var(--panel-solid);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:7px;font-family:inherit;font-size:13px';
  skins.forEach((sk,i)=>{ const o=document.createElement('option'); o.value=String(i); o.textContent=sk.name; if(i===cur) o.selected=true; sel.appendChild(o); });
  sel.onchange=()=>applySkin(id, parseInt(sel.value,10));
  tx.appendChild(lab); tx.appendChild(sel);
}
function setColorTex(b, sk, t){          // podmień mapę koloru (Ziemia: dayTex shadera; reszta: material.map)
  if(b.data.earth){ b.mesh.material.uniforms.dayTex.value = t; }
  else { b.mesh.material.map = t; b.mesh.material.needsUpdate = true; }
}
function applySkin(id, idx){
  const skins = SKINS[id]; if(!skins || !skins[idx]) return;
  const b = bodies.find(x=>x.data.id===id); if(!b) return;
  const sk = skins[idx];
  if(!b._realMat) b._realMat = b.mesh.material;            // zachowaj oryginalny materiał (MeshPhong / shader Ziemi)
  if(sk.live && b.data.earth){                             // żywa Ziemia — shadery + atmosfera + animowane chmury
    setEarthLive(b, true);
  } else if(sk.fx !== undefined && !b.data.earth){         // fantastyczny shader planety — podmiana całego materiału
    if(!b._fxMat) b._fxMat = {};
    if(!b._fxMat[sk.fx]) b._fxMat[sk.fx] = buildPlanetFXMaterial(b.data, sk.fx, tex(skins[0].map));
    b.mesh.material = b._fxMat[sk.fx];
  } else {
    if(b.data.earth) setEarthLive(b, false);              // wyłącz żywą Ziemię, jeśli była aktywna
    b.mesh.material = b._realMat;                          // przywróć realny materiał i podmień teksturę
    setColorTex(b, sk, tex(sk.day || sk.map));
    if(!b.data.earth){
      b.mesh.material.bumpMap = sk.bump ? texLinear(sk.bump) : null;
      b.mesh.material.bumpScale = sk.bump ? 0.04 : 0;
      b.mesh.material.needsUpdate = true;
    }
  }
  try{ localStorage.setItem('solar-skin-'+id, String(idx)); }catch(e){}
  _lodTier[id] = -1;                              // reset LOD — nowy skin re-ewaluuje poziom przy zbliżeniu
}

/* Przełącz Ziemię w/z trybu „Żywa Ziemia" (materiały + powłoki). */
function setEarthLive(b, on){
  const p = b.data;
  if(on){
    if(!b._liveMat) b._liveMat = buildEarthLiveMaterial();
    b.mesh.material = b._liveMat;
    if(p._clouds){
      if(!p._clouds._realMat) p._clouds._realMat = p._clouds.material;
      if(!p._clouds._fxMat)   p._clouds._fxMat   = buildEarthCloudFXMaterial();
      p._clouds.material = p._clouds._fxMat;
    }
    if(!p._atmo){
      const am = buildEarthAtmosphere();
      const sh = new THREE.Mesh(new THREE.SphereGeometry(p.radius*1.06, 48, 48), am);
      sh.raycast = function(){};                 // atmosfera nie łapie kliknięć
      b.mesh.add(sh);
      p._atmo = sh;
    }
    p._atmo.visible = true;
  } else {
    if(b._realMat) b.mesh.material = b._realMat;
    if(p._clouds && p._clouds._realMat) p._clouds.material = p._clouds._realMat;
    if(p._atmo) p._atmo.visible = false;
  }
}

// Wielopoziomowy LOD koloru: im bliżej kamery, tym wyższa rozdzielczość (np. 1k → 4k → 8k).
// Leniwie (poza LoadingManagerem), z cache; ładuje tylko gdy potrzebny wyższy tier.
const _texCache = {};      // plik → THREE.Texture (raz załadowane)
const _lodTier = {};       // planetId → najwyższy zastosowany tier (-1 = baza)
function updateLOD(){
  if(!focused) return;
  const id = focused.id, b = bodies.find(x=>x.data.id===id); if(!b) return;
  const sk = SKINS[id] && SKINS[id][currentSkinIdx(id)];
  if(!sk || !sk.lod) return;
  const dist = camera.position.distanceTo(worldPos(b));
  let want = -1;
  for(let i=0;i<sk.lod.length;i++){ if(dist <= sk.lod[i].rMul * b.data.radius) want = i; }
  const have = (id in _lodTier) ? _lodTier[id] : -1;
  if(want <= have) return;                        // już mamy wystarczająco ostrą
  _lodTier[id] = want;                            // oznacz od razu — bez ponownego ładowania co klatkę
  const file = sk.lod[want].file;
  if(_texCache[file]){ setColorTex(b, sk, _texCache[file]); return; }
  new THREE.TextureLoader().load(resolve(TEX+file), t=>{
    t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO; _texCache[file] = t;
    if(focused && focused.id===id && SKINS[id][currentSkinIdx(id)]===sk) setColorTex(b, sk, t);
  });
}
const subs={ mercury:'Najmniejsza i najbliższa Słońcu planeta',
  venus:'Najgorętsza planeta — gęsta atmosfera CO₂',
  earth:'Nasza planeta — obróć na stronę nocną, by zobaczyć światła miast',
  mars:'Czerwona Planeta — pustynie tlenku żelaza',
  jupiter:'Największy gazowy olbrzym Układu',
  saturn:'Słynny z rozległego systemu pierścieni',
  uranus:'Obraca się „na boku” — oś nachylona 98°',
  neptune:'Najdalsza planeta — lodowy olbrzym' };
const subtitleFor = id => subs[id] || '';

document.getElementById('back').onclick = ()=>{
  if(tour){ stopTour(); return; }
  // Kosmiczny zoom: poza Układem Słonecznym #back = powrót o poziom wyżej (C→B, B→A), nie goSystem.
  if(!(cosmos.scale==='system' && cosmos.systemId==='sol')){ exitToSystem(); return; }
  if(flight.active) exitFlight();
  goSystem();
};

/* ============================================================
   Warstwa galaktyk (render) — proceduralne spirale z cząstek na realnych
   pozycjach RA/Dec. SSOT: GALAXIES[] (czyta render + dropdown). Spec §3–4.
   ⚠️ center → points.position (NIE bake do geometrii) — inaczej rotateOnAxis
   obraca wokół origin sceny (dryf z RA/Dec). Geometria zawsze lokalna.
   ============================================================ */
const GALAXY_R = 3800;         // powłoka nieba (starfield 2200–4800, asteryzmy 2600)
const GALAXY_SPIN = 0.012;     // rad/s — powolny obrót (pełny obrót ~8,7 min)
const DOME_PT_SIZE = 2.6;      // bazowy rozmiar cząstek galaktyk kopuły
const DOME_GAL_BOOST_B = 2.5;  // powiększenie galaktyk kopuły w widoku sąsiedztwa (B) — czytelne wiry (a nie kropki); Sol/D/E = 1×
const _galV = new THREE.Vector3();
const _galW = new THREE.Vector3();   // scratch: światowe centrum galaktyki (center + offset grupy)
let galaxyGroup = null;
const galaxies = [];           // {id, nm, center, normal, size, colBulge, wiki, facts, points}

const GALAXIES = [
  { id:'m31', nm:'Galaktyka Andromedy (M31)', type:'spiral', ra:10.68, dec:41.27,
    size:110, tilt:1.30, roll:0.5, arms:2, pitch:0.22, turns:1.1, bulge:0.32, thickness:0.05,
    colBulge:0xffe6b0, colArm:0x9fc4ff, count:4200,
    wiki:{ lang:'pl', title:'Galaktyka Andromedy' },
    facts:{ 'Odległość':'2,5 mln ly', 'Typ':'spiralna SA(s)b', 'Średnica':'~220 tys. ly' } },
  { id:'m33', nm:'Galaktyka Trójkąta (M33)', type:'spiral', ra:23.46, dec:30.66,
    size:72, tilt:0.9, roll:1.1, arms:2, pitch:0.30, turns:1.2, bulge:0.14, thickness:0.06,
    colBulge:0xffe0c0, colArm:0x9fd0ff, count:3200,
    wiki:{ lang:'pl', title:'Galaktyka Trójkąta' },
    facts:{ 'Odległość':'2,7 mln ly', 'Typ':'spiralna SA(s)cd', 'Średnica':'~60 tys. ly' } },
  { id:'m51', nm:'Galaktyka Wir (M51)', type:'spiral', ra:202.47, dec:47.19,
    size:58, tilt:0.25, roll:0.2, arms:2, pitch:0.36, turns:1.0, bulge:0.22, thickness:0.05,
    colBulge:0xffe6b0, colArm:0x8fbaff, count:3400,
    wiki:{ lang:'pl', title:'Galaktyka Wir' },
    facts:{ 'Odległość':'23 mln ly', 'Typ':'spiralna SA(s)bc', 'Średnica':'~76 tys. ly' } },
  { id:'m101', nm:'Galaktyka Wiatraczek (M101)', type:'spiral', ra:210.80, dec:54.35,
    size:66, tilt:0.4, roll:2.0, arms:3, pitch:0.28, turns:1.1, bulge:0.12, thickness:0.05,
    colBulge:0xfff0d0, colArm:0x9fd6ff, count:3600,
    wiki:{ lang:'pl', title:'Galaktyka Wiatraczek' },
    facts:{ 'Odległość':'21 mln ly', 'Typ':'spiralna SAB(rs)cd', 'Średnica':'~170 tys. ly' } },
  { id:'lmc', nm:'Wielki Obłok Magellana', type:'irregular', ra:80.89, dec:-69.76,
    size:88, tilt:0.6, roll:0.0, clumps:7, clumpSpread:0.6, thickness:0.12,
    colBulge:0xffd9b0, colArm:0xbcd4ff, count:2600,
    wiki:{ lang:'pl', title:'Wielki Obłok Magellana' },
    facts:{ 'Odległość':'160 tys. ly', 'Typ':'nieregularna SB(s)m', 'Średnica':'~32 tys. ly' } },
  { id:'smc', nm:'Mały Obłok Magellana', type:'irregular', ra:13.19, dec:-72.83,
    size:56, tilt:0.5, roll:0.0, clumps:5, clumpSpread:0.7, thickness:0.14,
    colBulge:0xffd9b0, colArm:0xbcd4ff, count:1900,
    wiki:{ lang:'pl', title:'Mały Obłok Magellana' },
    facts:{ 'Odległość':'200 tys. ly', 'Typ':'nieregularna SB(s)m pec', 'Średnica':'~18 tys. ly' } },
];

// mulberry32 seedowany z id — ta sama galaktyka wygląda identycznie między przeładowaniami
function _galHash(str){ let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++){ h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return h >>> 0; }
function seededRng(seed){ let a = _galHash(seed);
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function buildGalaxies(){
  if(galaxyGroup) return;
  galaxyGroup = new THREE.Group();
  galaxyGroup.visible = lsGet('solar.galaxies.on') !== '0';   // domyślnie ON
  scene.add(galaxyGroup);
  for(const g of GALAXIES){
    const shape = GalaxyShape.spiralPoints(g, seededRng(g.id));
    const basis = GalaxyShape.skyBasis(g.ra, g.dec, g.tilt || 0, g.roll || 0);
    const oriented = GalaxyShape.placeOnSky(shape.positions, basis);   // lokalne wokół (0,0,0)
    const center = skyDir(g.ra, g.dec).multiplyScalar(GALAXY_R);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(oriented, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(shape.colors, 3));
    const mat = new THREE.PointsMaterial({ size:DOME_PT_SIZE, sizeAttenuation:true, vertexColors:true,
      transparent:true, opacity:0.92, depthWrite:false, blending:THREE.AdditiveBlending });
    const points = new THREE.Points(geom, mat);
    points.position.copy(center);      // ⚠️ center do transformu (rotacja wokół własnego centrum)
    galaxyGroup.add(points);
    // jądro galaktyki — miękka poświata (wir z jasnym centrum, nie kropka); RNG-safe (sprite, nie cząstki)
    const _cc = new THREE.Color(g.colBulge);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(`rgba(${(_cc.r*255)|0},${(_cc.g*255)|0},${(_cc.b*255)|0},0.95)`, 'rgba(0,0,0,0)'),
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.9 }));
    glow.position.copy(center);              // to samo centrum co points (kopuła RA/Dec·GALAXY_R)
    glow.scale.setScalar(g.size * 0.9);      // ∝ rozmiar dysku; eye-check tunable
    galaxyGroup.add(glow);
    galaxies.push({ id:g.id, nm:g.nm, center,
      normal:new THREE.Vector3(basis.normal.x, basis.normal.y, basis.normal.z),
      size:g.size, colBulge:g.colBulge, wiki:g.wiki, facts:g.facts, points, coreGlow:glow });
  }
}
buildGalaxies();

// Powiększenie galaktyk kopuły w widoku sąsiedztwa (B): wiry czytelne zamiast kropek.
// Skaluje chmurę cząstek (points.scale), rozmiar cząstek (żeby gęstość nie zrzedła) i poświatę
// jądra. Sol/D/E = 1× (w D/E kopuła i tak ukryta). Wołane z gałęzi cosmos (B) + reset przy B→A.
function applyDomeGalaxyScale(factor){
  for(let i=0;i<galaxies.length;i++){
    const g = galaxies[i];
    g.points.scale.setScalar(factor);
    g.points.material.size = DOME_PT_SIZE * factor;
    if(g.coreGlow) g.coreGlow.scale.setScalar(g.size * 0.9 * factor);
  }
}

// Nawigacja do galaktyki: wejście w god-view (E). Wywołują: dropdown galaktyk + lewy klik w scenie.
// Prawy klik → „ℹ Informacje" otwiera kartę BEZ dolotu (przez openContextMenu → openInfoModal).
function navigateToGalaxy(id){
  if(flight.active || cosmos.transitioning) return;
  enterExgalaxy(id);   // dolot god-view galaktyki (zastępuje dawny obrót kamery)
}

/* ============================================================
   Kosmiczny zoom — widok interstellar: pole gwiazd sąsiedztwa
   (THREE.Points na realnych RA/Dec/dist), przejście z reveal
   (redshift/smugi/licznik ly), picking i nawigacja układów.
   ============================================================ */
// colorTemp [K] → kolor gwiazdy wg typu widmowego (gradient M→K→G→F→A/B); tunable
function starColor(s){
  if(s.special) return new THREE.Color(0xfff2cc);           // Sol jasnożółty (G2V)
  const t = (s.star && s.star.colorTemp) || 5000;
  return t < 3300 ? new THREE.Color(0xffb277)   // M — czerwony karzeł (ciepły pomarańcz, widoczny)
       : t < 3900 ? new THREE.Color(0xffc493)   // M/K późny
       : t < 5300 ? new THREE.Color(0xffd9a8)   // K — pomarańcz
       : t < 6100 ? new THREE.Color(0xfff0d4)   // G — kremowy (jak Słońce)
       : t < 7500 ? new THREE.Color(0xf6f2ff)   // F — biały
       :            new THREE.Color(0xcfe0ff);  // A/B — błękitnobiały
}
// rozmiar poświaty gwiazdy wg typu widmowego (gorące A/B większe, karły M mniejsze — ale widoczne).
// sizeAttenuation:false → STAŁY rozmiar ekranowy (niezależny od dużego rozrzutu dystansów kamera↔gwiazda
// w klastrze); skala w NDC (~0.1 ≈ 45 px wys.). Rozmiar wg typu, nie odległości. Eye-check tunable.
function starGlowSize(s){
  if(s.special) return 0.13;
  const t = (s.star && s.star.colorTemp) || 5000;
  const f = THREE.MathUtils.clamp((t - 2500) / 7500, 0, 1);   // 0 (M zimny) .. 1 (A/B gorący)
  return 0.065 + 0.11 * f;                                    // NDC: M ~0.065 .. A/B ~0.175 (distinct, nie zlewają się)
}
// fakty do karty „Informacje" układu gwiazdowego
function starFacts(s){
  if(s.special) return { 'Typ':'nasza gwiazda (G2V)', 'Planety':'8' };
  const f = {};
  if(s.distLy != null) f['Odległość']   = s.distLy.toFixed(2).replace('.', ',') + ' ly';
  if(s.spectral)       f['Typ widmowy'] = s.spectral;
  if(s.planets && s.planets.length) f['Znane planety'] = String(s.planets.length);
  return f;
}

// osobna warstwa DOM etykiet gwiazd (labelLayer #labels chowamy w interstellar)
let cosmoLabelLayer = null;
function ensureCosmoLabelLayer(){
  if(cosmoLabelLayer) return cosmoLabelLayer;
  cosmoLabelLayer = document.createElement('div');
  cosmoLabelLayer.id = 'cosmoLabels';
  cosmoLabelLayer.style.cssText = 'position:fixed;inset:0;z-index:6;pointer-events:none;overflow:hidden;display:none';
  document.body.appendChild(cosmoLabelLayer);
  return cosmoLabelLayer;
}
// Widoczność etykiety DOM: opacity + pointerEvents RAZEM. Klasa .lab ma pointer-events:auto,
// więc etykieta z opacity:0 wciąż łapałaby klik/hover NAD canvasem (handlery pickAt wiszą na
// renderer.domElement — sibling, nie ancestor) — niewidzialny tekst zjadałby picking pod spodem.
function labVis(el, on){ el.style.opacity = on ? 1 : 0; el.style.pointerEvents = on ? 'auto' : 'none'; }

// Pole gwiazd sąsiedztwa (Słońce w origin) — THREE.Points na realnych RA/Dec/dist.
function buildInterstellar(){
  if(interstellarGroup) return interstellarGroup;
  interstellarGroup = new THREE.Group();
  const layer = ensureCosmoLabelLayer();
  const pos = [], col = [];
  for(const s of SYSTEMS){
    const p = s.special ? {x:0,y:0,z:0} : CosmoScale.raDecDistToXYZ(s.ra, s.dec, s.distLy);
    pos.push(p.x, p.y, p.z);
    const c = starColor(s);
    col.push(c.r, c.g, c.b);
    s._scenePos = new THREE.Vector3(p.x, p.y, p.z);   // cache do pickingu/etykiet/tweenu (Task 5)
    if(!s.special){                                    // świecąca gwiazda: poświata koloru/rozmiaru wg typu widmowego (rdzeń = punkt niżej)
      const gc = starColor(s);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(`rgba(${(gc.r*255)|0},${(gc.g*255)|0},${(gc.b*255)|0},0.95)`, 'rgba(0,0,0,0)'),
        transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:false }));
      spr.position.copy(s._scenePos);
      const gs = starGlowSize(s); spr.scale.set(gs, gs, 1);
      interstellarGroup.add(spr); s._glow = spr;
    }
    const el = document.createElement('div'); el.className = 'lab';
    el.textContent = s.name; el.style.color = s.special ? '#fff2cc' : '#cfe0ff';
    el.onclick = ()=>{ if(cosmos.scale !== 'interstellar') return;       // klik w tekst = klik w gwiazdę
      navigateToSystem(s.id); };                                         // ('sol' → powrót A; guard transitioning w środku)
    layer.appendChild(el); s._label = el;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
  // sizeAttenuation:false → stały rozmiar px niezależny od dystansu kamery do klastra: gwiazdy
  // sąsiedztwa są zawsze wyraźnymi punktami (fix „wizualnie martwego" pola — pkt sub-pikselowe przy attenuacji).
  const mat = new THREE.PointsMaterial({ size:8, sizeAttenuation:false, vertexColors:true,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending });
  interstellarPts = new THREE.Points(geom, mat);
  interstellarGroup.add(interstellarPts);
  scene.add(interstellarGroup);
  interstellarGroup.visible = false;
  return interstellarGroup;
}

/* --- Ruch własny gwiazd (suwak, tylko skala B) — stage 5 wzbogacenia (2026-07-04).
   Ekstrapolacja 3D-linearna z pm (CosmoScale.posAfterYears); suwak NIE dotyka reality.clockMs
   (filar 1:1) — przewija wyłącznie pozycje pola gwiazd sąsiedztwa. Reset przy B→A. --- */
let pmYears = 0, pmUI = null;
function applyProperMotion(years){
  pmYears = years | 0;
  if(!interstellarPts) return;
  const attr = interstellarPts.geometry.attributes.position;
  SYSTEMS.forEach((s, i)=>{
    if(s.special || !s._scenePos) return;                      // Sol w origin — pm=0 z definicji
    const pm = PM[s.id];
    const p = (pm && pmYears) ? CosmoScale.posAfterYears(s.ra, s.dec, s.distLy, pm.pmRA, pm.pmDec, pmYears)
                              : CosmoScale.raDecDistToXYZ(s.ra, s.dec, s.distLy);
    attr.setXYZ(i, p.x, p.y, p.z);
    s._scenePos.set(p.x, p.y, p.z);                            // picking/etykiety/hover/tween czytają stąd
    if(s._glow) s._glow.position.copy(s._scenePos);
  });
  attr.needsUpdate = true;
}
function ensurePmUI(){
  if(pmUI) return pmUI;
  pmUI = document.createElement('div');
  pmUI.id = 'pmSlider';
  pmUI.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:7;display:none;align-items:center;gap:10px;background:rgba(6,10,18,0.78);border:1px solid rgba(160,190,255,0.18);border-radius:12px;padding:8px 14px;font:600 11px "IBM Plex Mono",monospace;color:#cfe0ff;backdrop-filter:blur(4px)';
  const lab = document.createElement('span'); lab.textContent = '🕰 Ruch własny:';
  const rng = document.createElement('input'); rng.type = 'range';
  rng.min = -50000; rng.max = 50000; rng.step = 250; rng.value = 0; rng.style.width = '260px';
  const val = document.createElement('span'); val.style.cssText = 'min-width:130px;text-align:right;color:#ffe4b5';
  const rst = document.createElement('button'); rst.textContent = 'dziś';
  rst.style.cssText = 'background:none;border:1px solid rgba(160,190,255,0.35);border-radius:8px;color:#cfe0ff;font:600 10px "IBM Plex Mono",monospace;padding:3px 8px;cursor:pointer';
  const fmt = ()=>{ val.textContent = pmYears === 0 ? 'dziś (2026)' : 'rok ' + (2026 + pmYears).toLocaleString('pl-PL'); };
  rng.oninput = ()=>{ applyProperMotion(parseInt(rng.value, 10)); fmt(); };
  rst.onclick = ()=>{ rng.value = 0; applyProperMotion(0); fmt(); };
  pmUI.append(lab, rng, val, rst);
  pmUI._rng = rng; pmUI._fmt = fmt; fmt();
  document.body.appendChild(pmUI);
  return pmUI;
}
function resetProperMotion(){
  if(!pmUI && pmYears === 0) return;
  ensurePmUI(); pmUI._rng.value = 0; applyProperMotion(0); pmUI._fmt();
  pmUI.style.display = 'none';   // B→A: updateCosmosLabels nie działa w Sol (gałąź pasywna) — chowamy tu
}

// przełącz widoczność sceny Układu (Sol) — snapshot per-obiekt (przywraca dokładny stan toggli)
function _solSceneObjects(){
  const objs = [sun, beltGroup];
  bodies.forEach(b => objs.push(b.group));
  (reality.planetOrbits||[]).forEach(l => objs.push(l));
  (reality.cometOrbits||[]).forEach(l => objs.push(l));
  (reality.cometMarkers||[]).forEach(m => objs.push(m));
  (probes.markers||[]).forEach(m => objs.push(m));
  (probes.trails||[]).forEach(l => objs.push(l));
  (probes.lightDay||[]).forEach(m => objs.push(m.group, m.beam, m.pulses));
  if(sats.points)   objs.push(sats.points);
  if(trueDots)      objs.push(trueDots);
  if(asterism.root) objs.push(asterism.root);
  return objs;
}
function setSceneVisible(which, v){
  if(which !== 'sol') return;
  const objs = _solSceneObjects();
  if(!v){
    objs.forEach(o=>{ o.userData._preCosmoVis = o.visible; o.visible = false; });
    labelLayer.style.display = 'none';
  } else {
    objs.forEach(o=>{ o.visible = (o.userData._preCosmoVis !== undefined) ? o.userData._preCosmoVis : true;
      delete o.userData._preCosmoVis; });
    if(asterism.root) asterism.root.visible = asterism.on;   // honoruj intencję toggla (mogła zmienić się poza Sol — showAsterisms bramkuje inSol)
    labelLayer.style.display = showLabels ? 'block' : 'none';
  }
}

/* ---- Reveal przejścia: DOM-overlay (redshift + licznik ly) + smugi WebGL (NIE czarny ekran) ---- */
let revealFX = null, revealOverlay = null, revealCounter = null;
const _revFwd = new THREE.Vector3();
const REVEAL_MS = 1500;
function buildRevealFX(){
  if(revealFX) return revealFX;
  const mat = new THREE.ShaderMaterial({
    transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uProgress:{value:0}, uTime:{value:0}, uDir:{value:1} },
    vertexShader:`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader:`
      precision highp float;
      varying vec2 vUv; uniform float uProgress, uTime, uDir;
      float hash(float n){ return fract(sin(n)*43758.5453123); }
      void main(){
        vec2 c = vUv - 0.5;
        float r = length(c);
        float ang = atan(c.y, c.x);
        float streaks = pow(abs(sin(ang*64.0 + hash(floor(ang*32.0))*6.2831)), 8.0);
        float flow = fract(r*4.0 - uDir*uTime*1.2);
        float streak = streaks * smoothstep(0.12, 0.6, r) * flow;   // smugi gwiazd wzdłuż promienia
        vec3 blue = vec3(0.55, 0.70, 1.0);
        vec3 red  = vec3(1.0, 0.35, 0.20);
        vec3 col = mix(blue, red, smoothstep(0.10, 0.72, r));        // przesunięcie ku czerwieni na krawędziach
        float a = uProgress * (streak*1.5 + r*0.22);
        gl_FragColor = vec4(col * (0.6 + streak*1.7), clamp(a, 0.0, 0.9));
      }`
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1,1), mat);
  mesh.frustumCulled = false; mesh.renderOrder = 999; mesh.visible = false;
  scene.add(mesh);
  revealFX = { mesh, mat };
  return revealFX;
}
function _placeRevealPlane(){
  if(!revealFX) return;
  const d = 2;   // tuż przed kamerą; depthTest:false → zawsze na wierzchu
  _revFwd.set(0,0,-1).applyQuaternion(camera.quaternion);
  revealFX.mesh.position.copy(camera.position).addScaledVector(_revFwd, d);
  revealFX.mesh.quaternion.copy(camera.quaternion);
  const h = 2 * d * Math.tan(camera.fov * Math.PI/360);
  revealFX.mesh.scale.set(h * camera.aspect * 1.4, h * 1.4, 1);   // *1.4 zapas na obrót kamery
}
function ensureRevealOverlay(){
  if(revealOverlay) return revealOverlay;
  revealOverlay = document.createElement('div');
  revealOverlay.id = 'cosmoReveal';
  revealOverlay.style.cssText = 'position:fixed;inset:0;z-index:20;pointer-events:none;display:none;opacity:0;'+
    'background:radial-gradient(circle at 50% 50%, rgba(120,60,190,0.0) 0%, rgba(180,40,70,0.30) 55%, rgba(70,8,26,0.72) 100%);'+
    "font:700 15px 'IBM Plex Mono',monospace;color:#ffd9c0;text-shadow:0 0 12px rgba(255,120,60,0.85)";
  revealCounter = document.createElement('div');
  revealCounter.style.cssText = 'position:absolute;left:50%;bottom:16%;transform:translateX(-50%);letter-spacing:2px';
  revealOverlay.appendChild(revealCounter);
  document.body.appendChild(revealOverlay);
  return revealOverlay;
}
// przejście z reveal: bell-curve na overlayu + smugach; atMidpoint w połowie (nie na czarno)
function playRevealTransition(opts, atMidpoint){
  buildRevealFX();
  const overlay = ensureRevealOverlay();
  overlay.style.display = 'block';
  revealFX.mesh.visible = true;
  const dir = (opts && opts.dir) || 1;
  // opt-in licznik skali (B↔D, spec §7): {maxVal} → zaokrąglone ly z separatorem tysięcy.
  // Bez opts.counter zachowanie DOKŁADNIE dotychczasowe (A↔B/B↔C: 4,24 ly, 2 miejsca).
  const counter = (opts && opts.counter) || null;
  const maxLy = counter ? counter.maxVal : 4.24;   // „przelot" ku najbliższemu sąsiadowi — czytelna skala licznika
  const t0 = performance.now();
  let mid = false;
  function step(){
    const k = Math.min((performance.now() - t0) / REVEAL_MS, 1);
    const bell = Math.sin(k * Math.PI);   // 0 → 1 → 0 (ease-in-out narastania/opadania)
    _placeRevealPlane();
    revealFX.mat.uniforms.uProgress.value = bell;
    revealFX.mat.uniforms.uTime.value = performance.now() * 0.001;
    revealFX.mat.uniforms.uDir.value = dir;
    overlay.style.opacity = String(0.92 * bell);
    const ly = dir < 0 ? maxLy * (1 - k) : maxLy * k;
    revealCounter.textContent = counter
      ? Math.round(ly).toLocaleString('pl-PL') + ' ly'
      : ly.toFixed(2).replace('.', ',') + ' ly';
    if(!mid && k >= 0.5){ mid = true; try{ atMidpoint && atMidpoint(); }catch(e){ console.error('reveal midpoint', e); cosmos.transitioning = false; } }
    if(k < 1) requestAnimationFrame(step);
    else { revealFX.mesh.visible = false; overlay.style.display = 'none';
      if(!mid){ try{ atMidpoint && atMidpoint(); }catch(e){ console.error('reveal midpoint', e); cosmos.transitioning = false; } } }
  }
  requestAnimationFrame(step);
}

/* ---- Breadcrumb HUD (#crumb w #topbar): ścieżka wg (scale,systemId) + klik = powrót o poziom wyżej ---- */
let crumbEl = null;
function ensureCrumb(){
  if(crumbEl) return crumbEl;
  crumbEl = document.getElementById('crumb');
  if(crumbEl) crumbEl.onclick = ()=>{ if(!cosmos.transitioning) exitToSystem(); };   // klik = C→B lub B→A (kontekstowo)
  return crumbEl;
}
// Ustaw ścieżkę + widoczność crumbu ORAZ #back wg maszyny stanów (A=Sol, B=interstellar, C=obcy układ).
function updateBreadcrumb(){
  const c = ensureCrumb(); if(!c) return;
  if(cosmos.scale === 'galactic'){                                       // D
    c.textContent = 'Układ Słoneczny › Sąsiedztwo międzygwiezdne › Droga Mleczna';
    c.style.display = ''; elBack.classList.add('show');
  } else if(cosmos.scale === 'interstellar'){                            // B
    c.textContent = 'Układ Słoneczny › Sąsiedztwo międzygwiezdne';
    c.style.display = ''; elBack.classList.add('show');
  } else if(cosmos.scale === 'system' && cosmos.systemId !== 'sol'){      // C
    const sys = SYSTEMS.find(s=>s.id===cosmos.systemId);
    c.textContent = 'Układ Słoneczny › Sąsiedztwo międzygwiezdne › ' + ((sys && sys.name) || cosmos.systemId);
    c.style.display = ''; elBack.classList.add('show');
  } else if(cosmos.scale === 'exgalaxy'){                                 // E: god-view zewnętrznej galaktyki
    const nm = (galaxies.find(x=>x.id===cosmos.galaxyId)||{}).nm || cosmos.galaxyId;
    const base = (cosmos.exReturn && cosmos.exReturn.scale==='interstellar')
      ? 'Układ Słoneczny › Sąsiedztwo międzygwiezdne › ' : 'Układ Słoneczny › ';
    c.textContent = base + nm; c.style.display = ''; elBack.classList.add('show');
  } else {                                                               // A (Sol) — #back zarządzany przez focus/updateUI
    c.style.display = 'none';
  }
}
function hideBreadcrumb(){ if(crumbEl) crumbEl.style.display = 'none'; }

// Promień klastra sąsiedztwa [j. sceny] = najdalsza gwiazda od Słońca (origin); skaluje się z LY_SCENE.
function interstellarClusterRadius(){
  let m = 0;
  for(const s of SYSTEMS){ if(s.special) continue; m = Math.max(m, CosmoScale.lyToScene(s.distLy || 0)); }
  return m > 0 ? m : 2000;   // fallback zanim fetch systems.json dojdzie
}
// Wykadruj kamerę tak, by klaster sąsiedztwa wypełniał ekran (Słońce=origin w centrum) ORAZ ustaw
// pasmo zoomu, w którym swobodny obrót/zoom NIE wyrzuca do Sol (B→A tylko przy zoomie „w Słońce"
// < COSMO_EXIT). Wspólne dla A→B (enterInterstellar) i C→B (exitToInterstellar). Wołane w midpoint
// reveal — tween tyka tickTween() z gałęzi B animateCosmos(). Bez tego kamera zostaje na dystansie
// odziedziczonym z Sol (~3000+), z którego klaster jest znikomym punktem — bug „wizualnie martwe pole".
function frameInterstellar(){
  const cr = interstellarClusterRadius();
  controls.minDistance = 40;
  controls.maxDistance = Math.max(4200, cr * 3);
  const D = cr * 1.9;   // |cam| ≈ cr·2,0 (offset y) → klaster wypełnia kadr (FOV 48°), ≫ EXIT=150 (bez auto-exit)
  startTween(new THREE.Vector3(0, D * 0.32, D), new THREE.Vector3(0, 0, 0));
}

/* ---- Maszyna stanów kosmicznego zoomu: A(system,sol) ↔ B(interstellar) ↔ C(system,obcy) ---- */
// A→B: zoom-out powyżej ENTER. Guard flight.active (nie porzucaj aktywnego lotu M1/M2).
function enterInterstellar(){
  if(cosmos.transitioning || flight.active || !(cosmos.scale === 'system' && cosmos.systemId === 'sol')) return;
  cosmos.transitioning = true;
  buildInterstellar();
  focused = null; focusedMoon = null; focusedShip = false;   // zdejmij focus (follow-block nie walczy o kamerę)
  cosmos.savedFar = camera.far;                              // §11 restore (wzorzec reality.savedFar) — obecnie 60000, defensywnie
  playRevealTransition({ dir:1 }, ()=>{
    setSceneVisible('sol', false);
    interstellarGroup.visible = true;
    cosmos.scale = 'interstellar';
    frameInterstellar();                                    // reframe kamery na klaster (inaczej pole „martwe")
    cosmos.transitioning = false;
    updateBreadcrumb();
  });
}
// Powrót o JEDEN poziom (kontekstowy): C→B (obcy układ → interstellar) albo B→A (interstellar → Sol).
function exitToSystem(){
  if(cosmos.transitioning) return;
  if(cosmos.scale === 'exgalaxy'){ exitExgalaxy(); return; }    // E→(A|B) kontekstowy powrót (przed galactic — bo E to osobny szczebel)
  if(cosmos.scale === 'galactic'){ exitGalactic(); return; }   // D→B (crumb/#back — spec §3; bez tego no-op = martwy powrót)
  if(cosmos.scale === 'system' && cosmos.systemId !== 'sol'){ exitToInterstellar(); return; }   // C→B
  if(cosmos.scale !== 'interstellar') return;                                                    // już w Sol → no-op
  cosmos.transitioning = true;                                                                    // B→A
  playRevealTransition({ dir:-1 }, ()=>{
    if(interstellarGroup) interstellarGroup.visible = false;
    setSceneVisible('sol', true);
    cosmos.scale = 'system'; cosmos.systemId = 'sol';
    if(galaxyGroup) galaxyGroup.position.copy(ZERO3);       // B→A: odkotwicz kopułę galaktyk (gałąź cosmos już jej nie tyka w Sol)
    applyDomeGalaxyScale(1);                                // reset skali galaktyk kopuły (A nie tyka gałęzi cosmos — inaczej zostałyby powiększone)
    resetProperMotion();                                    // suwak wraca na „dziś" — ponowne wejście w B od pozycji bazowych
    if(cosmos.savedFar){ camera.far = cosmos.savedFar; camera.updateProjectionMatrix(); cosmos.savedFar = 0; }   // §11 restore far
    goSystem();                                            // §11 restore: kamera overview Sol + controls.min/max/target do init-realScale
    cosmos.transitioning = false;
    updateBreadcrumb();                                    // (Sol) → ukryje crumb
  });
}
// C→B: obcy układ → interstellar. Demontuj scenę obcą, pokaż pole gwiazd, odjedź kamerą do pasma
// interstellar (> EXIT — inaczej gate od razu wyrzuci B→A). Reveal wstecz (blueshift).
function exitToInterstellar(){
  if(cosmos.transitioning || !(cosmos.scale === 'system' && cosmos.systemId !== 'sol')) return;
  cosmos.transitioning = true;
  focused = null; focusedMoon = null; focusedShip = false;
  playRevealTransition({ dir:-1 }, ()=>{
    teardownAlienSystem();
    camera.far = 60000; camera.updateProjectionMatrix();   // restore far Sol/B (C mógł podnieść dla szerokiej pary — finding #4)
    buildInterstellar();                                   // idempotentne
    interstellarGroup.visible = true;
    cosmos.scale = 'interstellar'; cosmos.systemId = 'sol';   // systemId nieużywany w B; przywróć bazowy
    labelLayer.style.display = 'none';                     // etykiety planet obcego układu (dzielą #labels) — chowaj
    frameInterstellar();                                   // reframe kamery na klaster (jak A→B; ≫ EXIT → bez odbicia B→A)
    cosmos.transitioning = false;
    updateBreadcrumb();
  });
}

/* ---- Klatka poza Układem Słonecznym (napędzana z gate w animate) ---- */
function animateCosmos(dt){
  if(cosmos.scale === 'interstellar'){                     // B: zoom-in < EXIT → Sol; zoom-out ≥ GAL_ENTER → D
    tickTween(performance.now());                          // odjazd kamery do pasma interstellar po C→B (gałąź B nie tyka tweenu inaczej)
    if(!cosmos.transitioning && !tween){
      const camD = camera.position.length();
      if(CosmoScale.nextScale(camD, 'interstellar', COSMO_ENTER, COSMO_EXIT) === 'system'){
        exitToSystem();                                    // B→A
      } else if(GalacticScale.shouldEnterGalactic(camD)){
        enterGalactic();                                   // B→D (spec #2 §3)
      }
    }
  } else if(cosmos.scale === 'galactic'){                  // D: dysk MW (statyczny) + LOD + exit-by-zoom
    tickTween(performance.now());
    if(typeof animateGalactic === 'function') animateGalactic(dt);   // LOD §8 = Task 6 (guard jak animateAlienSystem)
    if(!cosmos.transitioning && !tween && controls.target.lengthSq() < 1 &&
       GalacticScale.shouldExitToInterstellar(camera.position.length())){
      exitGalactic();                                      // D→B: zoom-in na marker Słońca (target=origin, §3);
    }                                                      // po focusie obiektu (target≠origin) wyjście TYLKO klik/crumb/#back
  } else if(cosmos.scale === 'exgalaxy'){                  // E: god-view zewnętrznej galaktyki
    tickTween(performance.now());
    if(typeof animateExgalaxy === 'function') animateExgalaxy(dt);   // LOD landmarków (opcjonalne, guard typeof)
  } else {                                                 // C: obcy układ (JAWNIE — koniec catch-all, spec §2)
    if(typeof animateAlienSystem === 'function') animateAlienSystem(dt);
    if(!cosmos.transitioning && !tween && cosmos.exitDist && camera.position.length() > cosmos.exitDist){
      exitToInterstellar();
    }
  }
}
// etykiety: B — nazwa per układ; D — anchory struktury + widoczne obiekty + ☉; poza tym warstwa ukryta
function updateCosmosLabels(){
  if(cosmos.scale === 'interstellar'){
    if(cosmoLabelLayer) cosmoLabelLayer.style.display = 'block';
    ensurePmUI().style.display = 'flex';                       // suwak ruchu własnego tylko w B
    // Etykiety układów UKRYTE domyślnie — nazwa pojawia się przy najechaniu na gwiazdę (hoverLbl w pointermove).
    // Odchudza gęste pole (22+ świecących gwiazd); klik w gwiazdę dalej działa (pickAt → navigateToSystem, nie przez etykietę).
    for(const s of SYSTEMS){ if(s._label) labVis(s._label, false); }
  } else if(cosmos.scale === 'galactic'){
    if(cosmoLabelLayer) cosmoLabelLayer.style.display = 'block';
    if(pmUI) pmUI.style.display = 'none';
    for(const s of SYSTEMS){ if(s._label) labVis(s._label, false); }     // etykiety układów B (dzielą layer) — schowane w D
    // Deklutter D (tune §8): greedy wg priorytetu ☉ → struktura (kolejność features) → obiekty.
    // Rect centrowany jak .lab translate(-50%,-50%); szerokość mierzona raz (tekst stały).
    // Przegrany znika CAŁKIEM (labVis false) — mniej ważna etykieta nie zamazuje ważniejszej.
    const placed = [];
    const tryPlace = (el, pos)=>{
      projV.copy(pos).project(camera);
      if(projV.z > 1){ labVis(el, false); return; }
      const x = (projV.x*0.5 + 0.5)*innerWidth, y = (-projV.y*0.5 + 0.5)*innerHeight;
      const w = el._lw || (el._lw = el.offsetWidth || 120), h = 20;
      for(const p of placed){
        if(Math.abs(p.x - x)*2 < (p.w + w) && Math.abs(p.y - y)*2 < (p.h + h)){ labVis(el, false); return; }
      }
      placed.push({ x, y, w, h });
      labVis(el, true);
      el.style.left = x + 'px'; el.style.top = y + 'px';
    };
    if(mw.sunLabel) tryPlace(mw.sunLabel, _mwSunLabelPos);
    for(const a of mw.anchors) tryPlace(a.label, a.pos);
    for(const o of mw.objects){
      if(!o.sprite.visible){ labVis(o.label, false); continue; }         // LOD §8 (animateGalactic) steruje też etykietą
      tryPlace(o.label, o.pos);
    }
  } else if(cosmos.scale === 'exgalaxy'){                  // E: etykiety landmarków galaktyki + marker powrotu
    if(cosmoLabelLayer) cosmoLabelLayer.style.display = 'block';
    if(pmUI) pmUI.style.display = 'none';
    for(const s of SYSTEMS){ if(s._label) labVis(s._label, false); }   // etykiety układów B (dzielą layer) — schowane w E
    const g = gxCache[cosmos.galaxyId]; if(!g) return;
    const placed = [];
    const tryPlace = (el, pos)=>{
      projV.copy(pos).project(camera);
      if(projV.z > 1){ labVis(el, false); return; }
      const x = (projV.x*0.5 + 0.5)*innerWidth, y = (-projV.y*0.5 + 0.5)*innerHeight;
      const w = el._lw || (el._lw = el.offsetWidth || 120), h = 20;
      for(const p of placed){
        if(Math.abs(p.x - x)*2 < (p.w + w) && Math.abs(p.y - y)*2 < (p.h + h)){ labVis(el, false); return; }
      }
      placed.push({ x, y, w, h });
      labVis(el, true);
      el.style.left = x + 'px'; el.style.top = y + 'px';
    };
    for(const lm of g.landmarks) tryPlace(lm.label, lm.pos);
    if(g.returnLabel && g.returnMarker) tryPlace(g.returnLabel, g.returnMarker.position);
  } else {
    if(cosmoLabelLayer) cosmoLabelLayer.style.display = 'none';
    if(pmUI) pmUI.style.display = 'none';                      // suwak niewidoczny poza B (A i C)
  }
}

/* ============================================================
   Kosmiczny zoom — scena dolotu do obcego układu (Task 5): gwiazda +
   planety na realnych orbitach (proceduralne tekstury), orbity 1:1 z
   zegara realnego, focus na planecie. Wjazd: klik gwiazdy w interstellar
   → pickAt/pointerup 'starsystem' → navigateToSystem (Task 4, guardowane).
   ============================================================ */
let alienGroup = null, alienBodies = [], alienStar = null, alienCompanions = [];
const BINARY_DISP_CAP = 45;    // [AU] cap wyświetlanej separacji towarzysza (40 Eri B ~400 AU → kadr; z notą „faktycznie")
// scena-jednostek na 1 AU w obcym układzie (tunable). Znacznie większy mnożnik niż
// przy Sol (AU realne w solar.js), bo orbity egzoplanet z listy są bardzo ciasne —
// przy małym mnożniku (np. 30) TRAPPIST-1 b (0,0115 AU) ląduje WEWNĄTRZ gwiazdy.
const AU_ALIEN = 400;
const ALIEN_PLANET_PALETTE = [0xd9b382, 0x8ecae6, 0xb5c99a, 0xe0a3a3, 0xc9ada7, 0x9db4c0, 0xf2cc8f, 0x81b29a];

// promień gwiazdy w scenie obcej (współdzielony przez buildStarSystem i navigateToSystem — DRY).
// Kadr dolotu obejmuje CAŁĄ najdalszą orbitę (camDist∝outerR), więc mały fizyczny promień gwiazdy
// znika w szerokich układach (np. Epsilon Eridani, 1 planeta na 3,53 AU → orbita 1412 j., gwiazda 0,9 j.).
// Podłoga ∝ outerR daje gwieździe STAŁY rozmiar kątowy w kadrze (zawsze widoczna, niezależnie od układu).
// Najdalszy interesujący promień układu [AU]: najdalsza orbita planety LUB zewnętrzna granica ekosfery
// (żeby zielony pierścień strefy życia mieścił się w kadrze także dla gwiazd bez planet) LUB towarzysz (po capie).
// Kadr i podłoga rozmiaru gwiazdy są ROZDZIELONE w SystemScale (review 2026-07-04): kadr chce MAX treści,
// podłoga gwiazdy dostaje clamp ≤60% treści wewnętrznej — inaczej gwiazda połyka 51 Peg b / pierścień HZ 40 Eri.
function systemMaxAU(sys){
  const planetMax = (sys.planets||[]).reduce((m,pl)=>Math.max(m, pl.aAU||0), 0);
  const hzOuter = (sys.star && sys.star.radiusSun && sys.star.colorTemp)
    ? StarPhys.habitableZone(sys.star.radiusSun, sys.star.colorTemp).outer : 0;
  const comps = (BINARIES[sys.id]||{}).companions || [];
  return SystemScale.frameAU(planetMax, hzOuter, SystemScale.compMaxAU(comps, BINARY_DISP_CAP));
}
// fakty do karty „Informacje" towarzysza (gwiazda podwójna/biały karzeł)
function binaryFacts(c){
  const f = {};
  f['Typ'] = c.kind === 'whitedwarf' ? 'biały karzeł' : 'gwiazda';
  if(c.spectral) f['Typ widmowy'] = c.spectral;
  if(c.orbit){
    f['Okres orbitalny'] = c.orbit.periodYears >= 1000
      ? Math.round(c.orbit.periodYears).toLocaleString('pl-PL') + ' lat'
      : c.orbit.periodYears.toFixed(1).replace('.', ',') + ' lat';
    const capped = c.orbit.aAU > BINARY_DISP_CAP;
    f['Separacja'] = (capped ? '~' : '') + c.orbit.aAU.toFixed(1).replace('.', ',') + ' AU' + (capped ? ' (w scenie obcięta do kadru)' : '');
    if(c.orbit.ecc != null){                                   // finding #11: ecc z katalogu → karta (orbita w scenie kołowa)
      f['Mimośród'] = c.orbit.ecc.toFixed(2).replace('.', ',');
      f['Separacja min–maks'] = (c.orbit.aAU*(1-c.orbit.ecc)).toFixed(1).replace('.', ',')
        + '–' + (c.orbit.aAU*(1+c.orbit.ecc)).toFixed(1).replace('.', ',') + ' AU';
      f['Uwaga'] = 'orbita w scenie pokazana kołowo (uproszczenie)';
    }
  }
  return f;
}
function starSceneRadius(sys){
  const planets = sys.planets || [];
  const planetMin = planets.reduce((m,pl)=>Math.min(m, pl.aAU||Infinity), Infinity);
  const hz = (sys.star && sys.star.radiusSun && sys.star.colorTemp)
    ? StarPhys.habitableZone(sys.star.radiusSun, sys.star.colorTemp) : null;
  return SystemScale.starRadius({
    radiusSun: (sys.star && sys.star.radiusSun) || 1,
    frameAU: systemMaxAU(sys),
    clearanceAU: SystemScale.clearanceAU(isFinite(planetMin) ? planetMin : 0, hz ? hz.inner : 0),
    auScene: AU_ALIEN });
}
// demontaż sceny obcego układu (label DOM żyje poza grafem sceny — sprzątamy ręcznie)
function teardownAlienSystem(){
  if(!alienGroup) return;
  scene.remove(alienGroup);
  alienBodies.forEach(b=>{ if(b.labelEl && b.labelEl.parentNode) b.labelEl.parentNode.removeChild(b.labelEl); });
  alienCompanions.forEach(b=>{ if(b.labelEl && b.labelEl.parentNode) b.labelEl.parentNode.removeChild(b.labelEl); });
  alienGroup = null; alienBodies = []; alienStar = null; alienCompanions = [];
}

// Fakty do karty „Informacje" planety obcego układu (wzorzec starFacts/planet.facts Sol).
function alienPlanetFacts(pl){
  const f = {};
  f['Odległość od gwiazdy'] = pl.aAU.toFixed(3).replace('.', ',') + ' AU';
  f['Okres orbitalny']      = pl.periodDays.toFixed(2).replace('.', ',') + ' dni';
  if(pl.radiusEarth != null) f['Promień'] = pl.radiusEarth.toFixed(2).replace('.', ',') + ' R⊕';
  return f;
}

// Scena obcego układu: gwiazda emisyjna (+poświata, wzorzec Słońca linie ~306-318) w
// origin sceny obcej, planety jako proceduralne sfery na realnych orbitach (aAU→scena)
// z etykietami klikalnymi (SystemRender, Task 3) → focusStarPlanet.
function buildStarSystem(sys){
  teardownAlienSystem();
  alienGroup = new THREE.Group();
  alienBodies = [];
  const starR = starSceneRadius(sys);
  const sc = starColor(sys);
  const star = SystemRender.buildBodyMesh(starR, new THREE.MeshBasicMaterial({ color: sc }));
  alienStar = star;                                       // referencja do pickingu (gałąź C w pickAt)
  const rC = (sc.r*255)|0, gC = (sc.g*255)|0, bC = (sc.b*255)|0;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(`rgba(${rC},${gC},${bC},0.85)`, `rgba(${rC},${gC},${bC},0.28)`),
    transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
  glow.scale.set(starR*4.2, starR*4.2, 1);
  star.add(glow);
  alienGroup.add(star);
  // Ekosfera (strefa życia): zielony pierścień na promieniach HZ liczonych z jasności gwiazdy (star-phys).
  // Widać, gdzie planeta miałaby ciekłą wodę; dla układów z planetami — czy leżą w strefie.
  if(sys.star && sys.star.radiusSun && sys.star.colorTemp){
    const hz = StarPhys.habitableZone(sys.star.radiusSun, sys.star.colorTemp);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(hz.inner * AU_ALIEN, hz.outer * AU_ALIEN, 96),
      new THREE.MeshBasicMaterial({ color:0x3ad17a, side:THREE.DoubleSide, transparent:true, opacity:0.2, depthWrite:false }));
    ring.rotation.x = -Math.PI/2;                          // płaszczyzna orbit (scena xz)
    alienGroup.add(ring);
  }
  (sys.planets||[]).forEach((pl, i)=>{
    const pivot = new THREE.Object3D(); alienGroup.add(pivot);
    const group = new THREE.Object3D(); group.position.x = pl.aAU * AU_ALIEN; pivot.add(group);
    const pr = Math.max(0.06, pl.radiusEarth * 0.12);
    const baseColor = ALIEN_PLANET_PALETTE[i % ALIEN_PLANET_PALETTE.length];
    // proceduralMoonTexture(baseColorHex, seedUint32) — sygnatura z solar.js:283 (NIE nazwa planety jak string)
    const mat = new THREE.MeshPhongMaterial({ map: proceduralMoonTexture(baseColor, moonSeed(sys.id+':'+pl.name)) });
    group.add(SystemRender.buildBodyMesh(pr, mat));
    alienGroup.add(SystemRender.buildOrbitLine(pl.aAU * AU_ALIEN, 0x557799));
    const el = SystemRender.buildLabel(pl.name, 0xcfe0ff, ()=>focusStarPlanet(i), labelLayer);
    alienBodies.push({ data:pl, pivot, group, mesh:group.children[0], labelEl:el, r:pr });
  });
  // Towarzysze (gwiazdy podwójne/wielokrotne): mniejsza gwiazda emisyjna na realnej orbicie (okres w latach → dni).
  // Biały karzeł = maleńki, gorący, jasny; separacja obcinana do kadru (BINARY_DISP_CAP), nota w faktach.
  const maxAU = systemMaxAU(sys);                              // wspólny kadr dla podłóg promieni towarzyszy
  ((BINARIES[sys.id]||{}).companions || []).forEach((c)=>{
    const dispAU = Math.min((c.orbit && c.orbit.aAU) || 1, BINARY_DISP_CAP);
    const cc = starColor({ star:{ colorTemp:c.colorTemp } });
    // podłoga ∝ kadrowi (widoczny przy dolocie), cap 55% gwiazdy głównej — finding #1 (0,5 j. = sub-pixel w kadrze)
    const cr = SystemScale.companionRadius({ radiusSun:c.radiusSun, frameAU:maxAU, starRadius:starR, auScene:AU_ALIEN });
    const pivot = new THREE.Object3D(); alienGroup.add(pivot);
    const group = new THREE.Object3D(); group.position.x = dispAU * AU_ALIEN; pivot.add(group);
    const cs = SystemRender.buildBodyMesh(cr, new THREE.MeshBasicMaterial({ color: cc }));
    group.add(cs);
    const rC=(cc.r*255)|0, gC=(cc.g*255)|0, bC=(cc.b*255)|0;
    const cglow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(`rgba(${rC},${gC},${bC},0.9)`, `rgba(${rC},${gC},${bC},0.22)`),
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
    cglow.scale.set(cr*5, cr*5, 1); cs.add(cglow);
    alienGroup.add(SystemRender.buildOrbitLine(dispAU * AU_ALIEN, 0x88aabb));
    const colHex = c.kind === 'whitedwarf' ? 0xdff0ff : 0xffd9b0, facts = binaryFacts(c);
    const el = SystemRender.buildLabel(c.name, colHex,
      ()=>openInfoModal({ kind:'aliencompanion', name:c.name, color:colCss(colHex), facts, wiki:null }), labelLayer);
    alienCompanions.push({ raw:c, name:c.name, colHex,
      data:{ periodDays: ((c.orbit && c.orbit.periodYears) || 100) * 365.25 }, pivot, group, mesh:cs, labelEl:el, r:cr });
  });
  scene.add(alienGroup);
  return alienGroup;
}

// Nawigacja interstellar → obcy układ: reveal (Task 4), ukrycie pola gwiazd, budowa
// sceny, dolot kamery kadrujący całą orbitę zewnętrzną, breadcrumb.
function navigateToSystem(id){
  const sys = SYSTEMS.find(s=>s.id===id);
  if(!sys || cosmos.transitioning) return;
  if(sys.id === 'sol'){ exitToSystem(); return; }   // Słońce w liście układów → powrót do Sol, nie build
  cosmos.transitioning = true;
  binariesGate.then(()=>playRevealTransition({ dir:1 }, ()=>{   // gate: BINARIES wczytane (lub timeout) → scena kompletna (finding #8)
    if(interstellarGroup) interstellarGroup.visible = false;
    buildStarSystem(sys);
    cosmos.scale = 'system'; cosmos.systemId = id;
    focused = null; focusedMoon = null; focusedShip = false;
    // etykiety planet dzielą DOM-layer #labels z Sol; enterInterstellar go ukrył (setSceneVisible),
    // trzeba przywrócić zgodnie z globalnym togglem „Etykiety" — inaczej niewidoczne i nieklikalne.
    labelLayer.style.display = showLabels ? 'block' : 'none';
    // wyzeruj etykiety Sol (zamrożone z opacity=1 spoza updateLabels()) — inaczej "wyciekają"
    // do sceny obcego układu, bo #labels jest współdzielony DOM-layer (powrót do A odbuduje je updateLabels).
    for(const lid in labelEls){ if(labelEls[lid]) labelEls[lid].style.opacity = 0; }
    if(typeof sunLabel !== 'undefined' && sunLabel) sunLabel.style.opacity = 0;
    const starR = starSceneRadius(sys);
    const maxAU = systemMaxAU(sys);                        // uwzględnia ekosferę → pierścień w kadrze też dla gwiazd bez planet
    const outerR = maxAU * AU_ALIEN;
    const camDist = Math.max(30, outerR * 2.6);   // kadr obejmujący najdalszą orbitę (margines ~15%)
    controls.minDistance = starR * 1.05;
    controls.maxDistance = Math.max(4000, outerR * 6);
    // próg zoom-out C→B: powyżej → powrót do interstellar. Poniżej maxDistance (osiągalne), powyżej kadru dolotu.
    cosmos.exitDist = Math.min(camDist * 3, controls.maxDistance * 0.9);
    // szeroka para (40 Eri: exitDist 97200 > far 60000) → bez tego zoom-out = czarny ekran (finding #4)
    camera.far = SystemScale.farPlane(cosmos.exitDist, 60000);
    camera.updateProjectionMatrix();
    startTween(new THREE.Vector3(0, camDist*0.22, camDist), new THREE.Vector3(0,0,0));
    cosmos.transitioning = false;
    updateBreadcrumb();
  }));
}

// Klatka obcego układu: orbity 1:1 z zegara realnego (jak filar 1:1 Sol, ale
// heliocentryczny→gwiazdocentryczny) + pozycjonowanie etykiet. ⚠️ Gałąź „not sol" w
// animate() (gate Task 4) nigdy nie dochodzi do tickTween()/updateLabels() Sol (early
// return PRZED nimi) — bez wywołania tickTween() tutaj kamera po navigateToSystem()
// zamarłaby w połowie dolotu (tween ustawiony, ale nic go nie tyka co klatkę).
function animateAlienSystem(dt){
  if(!alienGroup) return;
  tickTween(performance.now());
  const days = reality.clockMs / 86400000;   // ms → dni (czas realny 1:1)
  const step = b=>{
    b.pivot.rotation.y = (days / b.data.periodDays) * Math.PI * 2;   // orbita 1:1 (towarzysze: okres w latach → wolno)
    if(b.labelEl){
      b.labelEl.style.opacity = 1;                 // reset co klatkę (mirror updateLabels Sol) — placeLabel zeruje gdy za kamerą, ale nie przywraca
      const wp = b.group.getWorldPosition(tmpV);
      placeLabel(b.labelEl, wp.add(new THREE.Vector3(0, b.r + 0.4, 0)));
    }
  };
  alienBodies.forEach(step);
  alienCompanions.forEach(step);   // gwiazdy towarzyszące (podwójne/wielokrotne)
}

// Focus na planecie obcego układu — wzorzec focusBody (solar.js:2307): FocusScale.zoomBounds
// + startTween + karta „Informacje" (fakty lokalne, bez Wikipedii jeśli pl.wiki brak).
function focusStarPlanet(idx){
  const b = alienBodies[idx]; if(!b) return;
  const wp = b.group.getWorldPosition(new THREE.Vector3());
  const r = b.r;
  const dir = tmpV.copy(camera.position).sub(wp).normalize();
  if(dir.lengthSq() < 0.001) dir.set(0, 0.3, 1).normalize();
  const bounds = FocusScale.zoomBounds(r, camera.near);
  const dist = Math.max(r*4.2, bounds.min);
  startTween(wp.clone().add(dir.multiplyScalar(dist)).add(new THREE.Vector3(0, r*0.7, 0)), wp);
  controls.minDistance = bounds.min;
  controls.maxDistance = bounds.max;
  openInfoModal({ kind:'planet', name:b.data.name, color:colCss(0xcfe0ff), wiki:b.data.wiki||null,
    facts: alienPlanetFacts(b.data) });
}

/* ============================================================
   Kosmiczny zoom #2 — skala galaktyczna (D): dysk Drogi Mlecznej (god-view),
   struktura nazwana (anchory z równania spirali — spec §4.2), warstwa obiektów
   (katalogowe l/b/dist), marker Słońca. Rejestracja: Słońce w origin, centrum
   (Sgr A*) offsetowane galToXYZ(0,0,27000) — spec §3.
   ============================================================ */
let MILKY_WAY = null;
fetch('cosmo/milky-way.json?v='+APP_VER).then(r=>r.json()).then(d=>{ MILKY_WAY = d; })
  .catch(e=>console.error('milky-way.json', e));
let GALAXIES_DETAIL = null;
fetch('cosmo/galaxies-detail.json?v='+APP_VER).then(r=>r.json()).then(d=>{ GALAXIES_DETAIL = d; })
  .catch(e=>console.error('galaxies-detail.json', e));
const mw = { group:null, points:null, anchors:[], objects:[], sunMarker:null, sunLabel:null };
const MW_OBJ_COLOR = { globular:0xffd9a0, nebula:0xff9fb8, cluster:0x9fd0ff };
const MW_OBJ_KIND  = { globular:'Gromada kulista', nebula:'Mgławica', cluster:'Gromada otwarta' };
const MW_LOD_NEAR_LY = 3000;   // obiekty bliżej Słońca → LOD gate §8 (zlewają się z markerem)
const MW_LOD_CAMDIST = 2600;   // ujawnij bliskie przy najeździe: |cam| poniżej progu…
const MW_LOD_SEP_PX  = 28;     // …LUB separacja ekranowa od markera Słońca większa niż próg
const _mwSunLabelPos = new THREE.Vector3(0, 240, 0);   // etykieta ☉ nad ringiem markera (tune: poza tłokiem centrum)

function mwObjectFacts(o){
  return {
    'Typ': MW_OBJ_KIND[o.kind] || o.kind,
    'Odległość od Słońca': Math.round(o.distLy).toLocaleString('pl-PL') + ' ly',
    'Współrzędne galaktyczne': 'l=' + o.l.toFixed(1).replace('.', ',') + '° · b=' + o.b.toFixed(1).replace('.', ',') + '°'
  };
}
// ObjDesc dla warstw D — JEDNO źródło kształtu deskryptora: używane przez pickAt (consider)
// ORAZ onclick etykiet (klik w tekst = klik w obiekt; wzorzec buildLabel z A/C).
function mwObjDesc(o){
  return { kind:'mwobject', name:o.name, color:colCss(o.colHex), worldPos:o.pos.clone(),
    wiki:o.wiki || null, facts:mwObjectFacts(o), ref:{id:o.id}, occluded:false };
}
function mwFeatDesc(a){
  return { kind:'mwfeature', name:a.name, color:'#ffd9a0', worldPos:a.pos.clone(),
    wiki:a.wiki || null, facts:null, ref:{id:a.id}, occluded:false };
}
// Akcje klików D (dedup pointerup ↔ onclick etykiet): podświetlenie/kadr/karta — spec §4.2.
function mwOpenFeature(d){
  showGlow(d.worldPos, d.color, false);
  startTween(d.worldPos.clone().add(new THREE.Vector3(0, 900, 500)), d.worldPos.clone());
  openInfoModal(d);                                          // target≠origin → exit-by-zoom OFF do klik/crumb (§3)
}
function mwOpenObject(d){
  startTween(d.worldPos.clone().add(new THREE.Vector3(0, 320, 180)), d.worldPos.clone());
  openInfoModal(d);
}

// Budowa sceny D (idempotentna, build-once + keep-hidden — spec §7). Wołana z enterGalactic (T5)
// i markera ?galactic. Wymaga MILKY_WAY (fetch) — guard u góry.
function buildMilkyWay(){
  if(mw.group || !MILKY_WAY) return mw.group;
  const d = MILKY_WAY.disk;
  mw.group = new THREE.Group();
  mw.group.visible = false;
  // --- dysk: point cloud (bulge+bar+ramiona), geometria LOKALNA wokół centrum Galaktyki ---
  const shape = GalaxyShape.spiralPoints(d, seededRng('milkyway'));
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(shape.positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(shape.colors, 3));
  const dmat = new THREE.PointsMaterial({ size:3.2, sizeAttenuation:true, vertexColors:true,
    transparent:true, opacity:0.92, depthWrite:false, blending:THREE.AdditiveBlending });
  mw.points = new THREE.Points(geom, dmat);
  const sunLy = MILKY_WAY.sun.distFromCenterLy;
  const c = GalacticScale.galToXYZ(0, 0, sunLy);            // centrum Galaktyki w scenie (Słońce w origin)
  mw.points.position.set(c.x, c.y, c.z);
  // lokalna płaszczyzna xy dysku → scena xz (Rx=−90°); faza w płaszczyźnie przez Rz (kolejność
  // Eulera 'XYZ' → Rz działa PIERWSZY, w lokalnej ramce dysku). Ramię 0 (Oriona) MA przechodzić
  // przez pozycję Słońca: local(r = sunLy·GAL_SCALE, kąt π — Słońce po stronie −x od centrum).
  const rFrac = GalacticScale.galLyToScene(sunLy) / d.size;
  const phase0 = GalaxyShape.armPhase(d, 0, rFrac, Math.PI);
  mw.points.rotation.set(-Math.PI/2, 0, phase0);
  mw.group.add(mw.points);
  scene.add(mw.group);
  mw.group.updateMatrixWorld(true);                          // matrixWorld dysku → localToWorld anchorów
  const layer = ensureCosmoLabelLayer();
  // --- struktura nazwana: anchory (ramiona z RÓWNANIA spirali; centrum/bar z pozycji) ---
  for(const f of (MILKY_WAY.features || [])){
    let pos;
    if(f.kind === 'arm'){
      const ap = GalaxyShape.armPoint(d, f.arm, f.t);        // oś ramienia, ramka lokalna dysku
      pos = mw.points.localToWorld(new THREE.Vector3(ap.x, ap.y, ap.z));
    } else if(f.kind === 'bar'){
      pos = mw.points.localToWorld(new THREE.Vector3(d.size * 0.30, 0, 0));   // bar wzdłuż lokalnej osi x (jak populacja w spiralPoints)
    } else {                                                 // 'center' — Sgr A*
      const g = GalacticScale.galToXYZ(f.l, f.b, f.distLy);
      pos = new THREE.Vector3(g.x, g.y, g.z);
    }
    const el = document.createElement('div'); el.className = 'lab';
    el.textContent = f.label || f.name;                      // mapa: krótka etykieta; karta Info: pełny name
    el.style.color = '#ffd9a0'; labVis(el, false);
    layer.appendChild(el);
    const entry = { id:f.id, name:f.name, kind:f.kind, pos, wiki:f.wiki || null, label:el };
    el.onclick = ()=>{ if(cosmos.transitioning || cosmos.scale !== 'galactic') return;
      mwOpenFeature(mwFeatDesc(entry)); };                   // klik w tekst = klik w anchor (jak buildLabel w A/C)
    mw.anchors.push(entry);
  }
  // --- warstwa obiektów: sprite per obiekt (indywidualne visible → LOD §8 + picking ekranowy) ---
  for(const o of (MILKY_WAY.objects || [])){
    const g = GalacticScale.galToXYZ(o.l, o.b, o.distLy);
    const pos = new THREE.Vector3(g.x, g.y, g.z);
    const colHex = MW_OBJ_COLOR[o.kind] || 0xffffff;
    const cc = new THREE.Color(colHex);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(`rgba(${(cc.r*255)|0},${(cc.g*255)|0},${(cc.b*255)|0},0.9)`, 'rgba(0,0,0,0)'),
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
    spr.position.copy(pos); spr.scale.set(46, 46, 1);
    mw.group.add(spr);
    const el = document.createElement('div'); el.className = 'lab';
    el.textContent = o.name; el.style.color = colCss(colHex); labVis(el, false);
    layer.appendChild(el);
    const entry = Object.assign({ pos, sprite:spr, label:el, colHex }, o);
    el.onclick = ()=>{ if(cosmos.transitioning || cosmos.scale !== 'galactic') return;
      mwOpenObject(mwObjDesc(entry)); };                     // klik w tekst = klik w obiekt (LOD: ukryta etykieta ma pointerEvents:none)
    mw.objects.push(entry);
  }
  // --- marker Słońca w origin („☉ tu jesteś" — afordancja powrotu D→B, spec §4.4) ---
  const sm = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,242,204,1)', 'rgba(255,180,80,0.25)'),
    transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
  sm.scale.set(90, 90, 1);                                   // position=(0,0,0)=origin
  mw.group.add(sm); mw.sunMarker = sm;
  const ring = new THREE.Mesh(new THREE.RingGeometry(120, 140, 48),
    new THREE.MeshBasicMaterial({ color:0xfff2cc, side:THREE.DoubleSide, transparent:true, opacity:0.75, depthWrite:false }));
  ring.rotation.x = -Math.PI/2;                              // pierścień w płaszczyźnie dysku (scene xz); tune: ~40px @ kadr — „tu jesteś" odróżnialne od bulge
  mw.group.add(ring);
  const sl = document.createElement('div'); sl.className = 'lab';
  sl.textContent = '☉ Słońce · ' + (MILKY_WAY.sun.arm || 'Ramię Oriona');
  sl.style.color = '#fff2cc'; labVis(sl, false);
  sl.onclick = ()=>{ if(cosmos.transitioning || cosmos.scale !== 'galactic') return;
    exitGalactic(); };                                       // klik w etykietę ☉ = klik w marker (afordancja powrotu §4.4)
  layer.appendChild(sl); mw.sunLabel = sl;
  return mw.group;
}

/* ============================================================
   God-view zewnętrznej galaktyki (scena E): disk + jądro + landmarki katalogowe.
   Mirror buildMilkyWay — geometria lokalna wokół centrum galaktyki w origin.
   Idempotentna: build-once per id → gxCache[id], keep-hidden.
   Task 3 (Etap 2 galaktyki-wir): sama budowa; picking/onclick/reveal = Task 4/5.
   ============================================================ */
const gxCache = {};
const GX_LANDMARK_COLOR = { companion:0x9fc4ff, hii:0xff7fb0, nebula:0xff6fa0, starcloud:0xfff0c0, sn:0xffffff };

function buildGalaxyScene(id){
  if(gxCache[id]) return gxCache[id].group;
  if(!GALAXIES_DETAIL || !GALAXIES_DETAIL[id]) return null;
  const detail = GALAXIES_DETAIL[id];
  const d = detail.disk;
  const group = new THREE.Group();
  group.visible = false;

  // --- dysk: point cloud w ramce lokalnej galaktyki (centrum w origin) ---
  const shape = GalaxyShape.spiralPoints(d, seededRng('gx-' + id));
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(shape.positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(shape.colors, 3));
  const dmat = new THREE.PointsMaterial({ size:3.0, sizeAttenuation:true, vertexColors:true,
    transparent:true, opacity:0.92, depthWrite:false, blending:THREE.AdditiveBlending });
  const points = new THREE.Points(geom, dmat);
  points.position.set(0, 0, 0);               // god-view centrowany na galaktyce (origin sceny)
  points.rotation.set(-Math.PI/2, 0, 0);      // lokalna xy → scena xz (płasko ku widzowi, jak dysk MW)
  group.add(points);
  scene.add(group);
  group.updateMatrixWorld(true);              // matrixWorld → localToWorld landmarków działa poprawnie

  // --- jądro: miękka poświata (jak coreGlow Etap 1, ale w god-view) ---
  const _cc = new THREE.Color(parseInt(d.colBulge, 16));
  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(`rgba(${(_cc.r*255)|0},${(_cc.g*255)|0},${(_cc.b*255)|0},0.95)`, 'rgba(0,0,0,0)'),
    transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.88 }));
  coreGlow.position.set(0, 0, 0);
  coreGlow.scale.setScalar(d.size * 0.45);   // ∝ rozmiar dysku; eye-check tunable (Task 6)
  group.add(coreGlow);

  // --- landmarki katalogowe: sprite + etykieta .lab ---
  const layer = ensureCosmoLabelLayer();
  const landmarks = [];
  for(const lm of (detail.landmarks || [])){
    const lp = GalaxyShape.landmarkDiskLocal(detail, lm);
    const pos = points.localToWorld(new THREE.Vector3(lp.x, lp.y, lp.z));
    const colHex = GX_LANDMARK_COLOR[lm.kind] || 0xffffff;
    const lc = new THREE.Color(colHex);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(`rgba(${(lc.r*255)|0},${(lc.g*255)|0},${(lc.b*255)|0},0.9)`, 'rgba(0,0,0,0)'),
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
    spr.position.copy(pos); spr.scale.set(52, 52, 1);
    group.add(spr);
    const el = document.createElement('div'); el.className = 'lab';
    el.textContent = lm.name; el.style.color = colCss(colHex); labVis(el, false);
    layer.appendChild(el);
    // onclick: klik w etykietę = klik w landmark (dead-click fix — labVis sprzęga pointerEvents z opacity).
    // companion: pozycja rzutowana na płaszczyznę dysku, głębia l.o.s. nieokreślona.
    el.onclick = (()=>{ const _pos=pos.clone(), _lm=lm, _colHex=colHex;
      return ()=>{ if(cosmos.transitioning || cosmos.scale !== 'exgalaxy') return;
        const facts = _lm.facts ? Object.assign({}, _lm.facts) : {};
        if(_lm.kind === 'companion') facts['Uwaga'] = 'pozycja rzutowana; głębia l.o.s. nieokreślona';
        showGlow(_pos, colCss(_colHex), false);
        openInfoModal({ kind:'gxlandmark', name:_lm.name, color:colCss(_colHex), wiki:_lm.wiki||null,
          facts:Object.keys(facts).length ? facts : null, occluded:false }); }; })();
    landmarks.push({ ...lm, sprite:spr, label:el, pos:pos.clone(), colHex, wiki:lm.wiki || null });
  }

  // --- marker powrotu: dyskretny sprite + etykieta „‹ Powrót" na skraju dysku ---
  const retPos = points.localToWorld(new THREE.Vector3(0, d.size * 0.9, 0));
  const retSpr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(180,200,255,0.75)', 'rgba(0,0,0,0)'),
    transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
  retSpr.position.copy(retPos); retSpr.scale.set(36, 36, 1);
  group.add(retSpr);
  const retEl = document.createElement('div'); retEl.className = 'lab';
  retEl.textContent = '‹ Powrót'; retEl.style.color = '#b4c8ff'; labVis(retEl, false);
  layer.appendChild(retEl);
  // onclick: klik w etykietę „‹ Powrót" = klik w marker powrotu (dead-click fix, jak mw.sunLabel §4.4).
  retEl.onclick = ()=>{ if(cosmos.transitioning || cosmos.scale !== 'exgalaxy') return; exitExgalaxy(); };

  gxCache[id] = { group, points, id, landmarks, coreGlow, returnMarker:retSpr, returnLabel:retEl };
  return group;
}

// ---- Maszyna stanów B↔D (spec §3/§7/§9) ----
// B→D: zoom-out w interstellar ≥ GAL_ENTER (check w animateCosmos). Reveal → swap → kadr dysku.
function enterGalactic(){
  if(cosmos.transitioning || cosmos.scale !== 'interstellar' || !MILKY_WAY) return;
  cosmos.transitioning = true;
  buildMilkyWay();
  playRevealTransition({ dir:1, counter:{ maxVal: MILKY_WAY.disk.radiusLy } }, ()=>{
    interstellarGroup.visible = false;
    starfieldPts.visible = false;                 // powłoka 2200–4800 nachodzi na dysk (spec §4.5)
    if(galaxyGroup) galaxyGroup.visible = false;  // kopuła ukryta w D — MW dysk JEST galaktyką (§9)
    mw.group.visible = true;
    cosmos.scale = 'galactic';
    frameGalactic();
    cosmos.transitioning = false;
    updateBreadcrumb();
  });
}
// D→B: zoom-in < GAL_EXIT przy target=origin / klik markera Słońca / crumb / #back.
function exitGalactic(){
  if(cosmos.transitioning || cosmos.scale !== 'galactic') return;
  cosmos.transitioning = true;
  playRevealTransition({ dir:-1, counter:{ maxVal: MILKY_WAY.disk.radiusLy } }, ()=>{
    mw.group.visible = false;                     // build-once + keep-hidden (spec §7 — bez dispose/leaka)
    hideMwLabels();
    starfieldPts.visible = true;
    // restore intencji toggla „Galaktyki" (§9): NIE ślepe true — czyta localStorage, więc honoruje
    // także klik toggla wykonany PODCZAS D (handler w D pisze wyłącznie intencję — Step 4).
    if(galaxyGroup) galaxyGroup.visible = lsGet('solar.galaxies.on') !== '0';
    interstellarGroup.visible = true;
    cosmos.scale = 'interstellar';
    frameInterstellar();                          // kadr klastra |cam|≈4441 < GAL_ENTER=5600 → bez odbicia B→D
    cosmos.transitioning = false;
    updateBreadcrumb();
  });
}
// Kadr D: target=ORIGIN (Słońce) — decyzja §3 (metryka exit-by-zoom 1:1 ze wzorcem B);
// dysk asymetrycznie w kadrze (centrum offsetowane ~1512 j. w +x). Tunable eye-check.
function frameGalactic(){
  controls.minDistance = 60;
  controls.maxDistance = 9000;                    // sufit drabiny #2 (intergalaktyka → #3, spec §3)
  startTween(new THREE.Vector3(0, 5200, 3000), new THREE.Vector3(0, 0, 0));
}
function hideMwLabels(){
  mw.anchors.forEach(a=> labVis(a.label, false));
  mw.objects.forEach(o=> labVis(o.label, false));
  if(mw.sunLabel) labVis(mw.sunLabel, false);
}
// LOD/declutter (spec §8): struktura + gromady halo zawsze; obiekty bliżej Słońca niż MW_LOD_NEAR_LY
// zlewają się z markerem ☉ → ujawniaj przy najeździe (|cam| < MW_LOD_CAMDIST) LUB gdy separacja
// ekranowa od markera Słońca > MW_LOD_SEP_PX. Ukryty sprite = nieklikalny (gałąź D pickAt filtruje).
function animateGalactic(dt){
  if(!mw.group || !mw.group.visible) return;
  const camD = camera.position.length();
  _galV.set(0, 0, 0).project(camera);                       // marker Słońca (origin) na ekranie
  const sunOk = _galV.z <= 1;
  const sunX = (_galV.x*0.5 + 0.5)*innerWidth, sunY = (-_galV.y*0.5 + 0.5)*innerHeight;
  for(const o of mw.objects){
    let vis = true;
    if(o.distLy < MW_LOD_NEAR_LY){
      vis = camD < MW_LOD_CAMDIST;
      if(!vis && sunOk){
        _galW.copy(o.pos).project(camera);
        if(_galW.z <= 1){
          const ox = (_galW.x*0.5 + 0.5)*innerWidth, oy = (-_galW.y*0.5 + 0.5)*innerHeight;
          vis = Math.hypot(ox - sunX, oy - sunY) > MW_LOD_SEP_PX;
        }
      }
    }
    o.sprite.visible = vis;
  }
}

// ---- Maszyna stanów E: god-view zewnętrznej galaktyki (A↔E, B↔E) ----
// A→E lub B→E: reveal → swap widoczności → kadr dysku. exReturn snapshots kontekst do powrotu.
function enterExgalaxy(id){
  if(cosmos.transitioning || flight.active || !GALAXIES_DETAIL || !GALAXIES_DETAIL[id]) return;
  if(!((cosmos.scale==='system' && cosmos.systemId==='sol') || cosmos.scale==='interstellar')) return;
  cosmos.exReturn = { scale: cosmos.scale, systemId: cosmos.systemId };   // A: (system,sol) | B: (interstellar)
  cosmos.transitioning = true;
  const detail = GALAXIES_DETAIL[id];
  buildGalaxyScene(id);
  focused = null; focusedMoon = null; focusedShip = false;
  playRevealTransition({ dir:1, counter:{ maxVal: detail.distLy } }, ()=>{
    if(cosmos.exReturn.scale === 'system') setSceneVisible('sol', false);   // A→E (NIE obejmuje starfieldPts)
    else interstellarGroup.visible = false;                                  // B→E
    starfieldPts.visible = false;                                            // w OBU: lokalny starfield nie otacza odległej galaktyki
    if(galaxyGroup) galaxyGroup.visible = false;
    gxCache[id].group.visible = true;
    cosmos.scale = 'exgalaxy'; cosmos.galaxyId = id;
    labelLayer.style.display = 'none';                                       // #labels Sol/obcych — leak-guard
    frameExgalaxy(detail);
    cosmos.transitioning = false; updateBreadcrumb();
  });
}
// E→(A|B): kontekstowy powrót per exReturn. Reveal wstecz → ukryj scenę galaktyki → przywróć kontekst.
function exitExgalaxy(){
  if(cosmos.transitioning || cosmos.scale !== 'exgalaxy') return;
  cosmos.transitioning = true;
  const ret = cosmos.exReturn || { scale:'system', systemId:'sol' };
  const maxLy = (GALAXIES_DETAIL[cosmos.galaxyId]||{}).distLy || 1000000;
  playRevealTransition({ dir:-1, counter:{ maxVal: maxLy } }, ()=>{
    if(gxCache[cosmos.galaxyId]) gxCache[cosmos.galaxyId].group.visible = false;
    hideGxLabels();
    const domeOn = lsGet('solar.galaxies.on') !== '0';
    if(ret.scale === 'system'){                                              // E→A
      setSceneVisible('sol', true); starfieldPts.visible = true;
      if(galaxyGroup){ galaxyGroup.visible = domeOn; galaxyGroup.position.copy(ZERO3); }
      cosmos.scale = 'system'; cosmos.systemId = 'sol'; goSystem();
    } else {                                                                 // E→B
      buildInterstellar(); interstellarGroup.visible = true; starfieldPts.visible = true;
      if(galaxyGroup) galaxyGroup.visible = domeOn;
      cosmos.scale = 'interstellar'; cosmos.systemId = 'sol'; frameInterstellar();
    }
    cosmos.galaxyId = null; cosmos.transitioning = false; updateBreadcrumb();
  });
}
// Ukryj etykiety DOM bieżącej sceny galaktyki (leak-guard przed powrotem do A/B).
function hideGxLabels(){
  const g = gxCache[cosmos.galaxyId]; if(!g) return;
  g.landmarks.forEach(l=> labVis(l.label, false));
  if(g.returnLabel) labVis(g.returnLabel, false);
}
// Wykadruj kamerę na god-view dysku galaktyki (centrum=origin, target=ZERO3).
// Bez progu auto-exit — wyjście TYLKO przez klik markera powrotu / crumb / #back.
function frameExgalaxy(detail){
  const sz = detail.disk.size;
  controls.minDistance = sz * 0.15;
  controls.maxDistance = sz * 6;
  startTween(new THREE.Vector3(0, sz * 2.2, sz * 1.4), new THREE.Vector3(0, 0, 0));
}

/* ============================================================
   Menu „Galaktyki i układy" (podgląd) — na razie tylko lista znanych
   galaktyk i układów gwiazdowych/egzoplanetarnych, bez nawigacji.
   ============================================================ */
const GALAXY_GROUPS = [
  { head:'Galaktyki', items:[
    { nm:'Droga Mleczna',                desc:'tu jesteśmy · ~100 tys. ly średnicy' },
    { id:'m31', nm:'Galaktyka Andromedy (M31)',    desc:'2,5 mln ly · zderzy się z nami' },
    { id:'m33', nm:'Galaktyka Trójkąta (M33)',     desc:'2,7 mln ly · Grupa Lokalna' },
    { id:'lmc', nm:'Wielki Obłok Magellana',       desc:'160 tys. ly · satelita Drogi Mlecznej' },
    { id:'smc', nm:'Mały Obłok Magellana',         desc:'200 tys. ly · satelita' },
    { id:'m51', nm:'Galaktyka Wir (M51)',          desc:'23 mln ly · klasyczna spirala' },
    { nm:'Galaktyka Sombrero (M104)',    desc:'29 mln ly · jasne halo' },
    { nm:'Centaurus A (NGC 5128)',       desc:'12 mln ly · radiogalaktyka' },
    { id:'m101', nm:'Galaktyka Wiatraczek (M101)',  desc:'21 mln ly · rozległa spirala' },
    { nm:'Galaktyka Cygaro (M82)',       desc:'12 mln ly · gwiazdotwórcza' },
  ]},
  { head:'Układy gwiazdowe / egzoplanetarne', items:[
    { nm:'Alfa Centauri',          desc:'4,4 ly · najbliższy układ · Proxima b' },
    { nm:'Gwiazda Barnarda',       desc:'6,0 ly · superziemia Barnard b' },
    { nm:'TRAPPIST-1',             desc:'40 ly · 7 planet skalistych' },
    { nm:'Kepler-90',              desc:'2800 ly · 8 planet (jak nasz układ)' },
    { nm:'51 Pegasi',              desc:'50 ly · 1. egzoplaneta wokół gwiazdy (1995)' },
    { nm:'Gliese 581',             desc:'20 ly · superziemie w strefie życia' },
    { nm:'TOI-700',                desc:'101 ly · planeta w strefie życia' },
    { nm:'Tau Ceti',              desc:'12 ly · gwiazda podobna do Słońca' },
    { nm:'55 Cancri',              desc:'41 ly · 5 planet · „diamentowa" 55 Cnc e' },
    { nm:'HD 209458 (Ozyrys)',     desc:'159 ly · 1. wykryta atmosfera egzoplanety' },
  ]},
];
(function buildGalaxyMenu(){
  const wrap = document.getElementById('galaxyMenu');
  const btn  = document.getElementById('gxBtn');
  const panel= document.getElementById('gxPanel');
  if(!wrap || !btn || !panel) return;
  panel.setAttribute('role','list');
  GALAXY_GROUPS.forEach(g=>{
    const h=document.createElement('div'); h.className='gx-head'; h.textContent=g.head; panel.appendChild(h);
    g.items.forEach(it=>{
      const row=document.createElement('div'); row.className='gx-item'; row.setAttribute('role','listitem');
      row.innerHTML=`<span class="gx-nm"></span><span class="gx-desc"></span>`;
      row.querySelector('.gx-nm').textContent=it.nm;       // textContent = anty-XSS
      row.querySelector('.gx-desc').textContent=it.desc;
      if(it.id && galaxies.some(x=>x.id===it.id)){         // renderowana galaktyka → klikalna nawigacja
        row.classList.add('nav');
        row.onclick=()=>{ setGalaxyOpen(false); navigateToGalaxy(it.id); };
      }
      panel.appendChild(row);
    });
  });
  const foot=document.createElement('div'); foot.className='gx-foot';
  foot.textContent='Klik w galaktykę (spirala) → lot kamery. Układy gwiazdowe — wkrótce.';
  panel.appendChild(foot);

  function setGalaxyOpen(open){
    wrap.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open?'true':'false');
  }
  btn.onclick=(e)=>{ e.stopPropagation(); setGalaxyOpen(!wrap.classList.contains('open')); };
  // zamknij przy kliknięciu poza menu
  addEventListener('pointerdown', e=>{ if(wrap.classList.contains('open') && !wrap.contains(e.target)) setGalaxyOpen(false); });
  // Esc: zamknij menu i POŁKNIJ zdarzenie (inaczej globalny handler Esc wyszedłby z focusu/lotu);
  // ten listener jest zarejestrowany przed globalnym → stopImmediatePropagation go wycisza tylko gdy menu otwarte.
  addEventListener('keydown', e=>{ if(e.key==='Escape' && wrap.classList.contains('open')){ setGalaxyOpen(false); e.stopImmediatePropagation(); } });
})();

/* ============================================================
   Warstwa edukacyjna: miasta · rzeki · jeziora · góry (Natural Earth, public domain)
   Wektory naciągnięte na glob jako dziecko mesha Ziemi → rotują z teksturą i dniem/nocą.
   ============================================================ */
let eduOn=false, eduGroup=null, eduData=null, eduLabels=[], eduLabelEls=[], eduLabelBox=null, _eduLabelT=0, eduMinor=[], _eduMinorShown=true, _eduShown=[], countryLabels=[];
let geoActive=false, _nearEarth=false, _eduBuilding=false;
let countriesData=null, countriesGroup=null, _countriesBuilding=false;
let mountainsData=null, mountainsGroup=null, _mountainsBuilding=false, mountainLabels=[];
let plRiversData=null, plRiversGroup=null, _plRiversBuilding=false, plRiverLabels=[];
const GEO_NEAR_MUL = 14;   // dCam < rr*14 → geo „budzi się" (zrównane z najdalszym pasmem etykiet, §8)
const GEO_LIFT = 1.0003;   // elewacja warstwy geo nad powierzchnią — minimalna (paralaksa ~1px), z-fight unikany przez depthWrite:false. Wspólna dla edu/granic/pasm/highlightu.
// Per-kategoria: etykiety (L) i obszary/geometria (A). Sterowane grupą przełączników w HUD. Seas bez geometrii (seaA n/d).
const geoShow = { waterL:true, waterA:true, seaL:true, mtnL:true, mtnA:true, cityL:true, cityA:true, ctyL:true, ctyA:true };
const eduCat = { water:[], cities:[], mountains:[] };   // referencje do dzieci eduGroup per kategoria (do gatowania „obszarów")
// SSOT geoActive: jedyny writer. Wołany co klatkę z animate (oraz z toggle tEdu dla natychmiastowości).
function setGeoActive(on){
  if(on && !eduData && !_eduBuilding) buildEdu();          // leniwy build raz (guard in-flight — fetch async, animate co klatkę)
  if(on && !countriesData && !_countriesBuilding) buildCountries();
  if(on && !mountainsData && !_mountainsBuilding) buildMountainRanges();
  if(on && !plRiversData && !_plRiversBuilding) buildPlRivers();
  if(on===geoActive) return;                                // bez zmiany → nic
  geoActive=on;
  applyGeoVisibility();                                      // widoczność grup/obiektów wg geoActive ∧ per-kategoria
  const ec=PLANETS.find(p=>p.earth); if(ec && ec._clouds) ec._clouds.visible = showClouds && !on;  // chmury nie zasłaniają mapy
  if(!on) deselectEdu();
}
// Jedyny autorytet widoczności geometrii geo: geoActive ∧ per-kategoria (obszary). Wołany z setGeoActive, toggli, LOD.
function applyGeoVisibility(){
  if(eduGroup) eduGroup.visible=geoActive;
  if(countriesGroup) countriesGroup.visible=geoActive && geoShow.ctyA;
  if(mountainsGroup) mountainsGroup.visible=geoActive && geoShow.mtnA;
  if(plRiversGroup) plRiversGroup.visible=geoActive && geoShow.waterA;
  eduCat.water.forEach(o=>{ if(o) o.visible=geoShow.waterA; });
  eduCat.cities.forEach(o=>{ if(o) o.visible=geoShow.cityA; });        // major; minor niżej (LOD ∧ kat)
  eduCat.mountains.forEach(o=>{ if(o) o.visible=geoShow.mtnA; });
  if(eduMinor[0]) eduMinor[0].visible = geoShow.cityA && _eduMinorShown;
}
// czy etykiety danej kategorii są włączone (przełączniki HUD); mapuje cat etykiety → flagę
function labelShown(cat){
  switch(cat){
    case 'Miasto': return geoShow.cityL;
    case 'Rzeka': case 'Jezioro': return geoShow.waterL;
    case 'Morze / ocean': return geoShow.seaL;
    case 'Góra': case 'Pasmo górskie': return geoShow.mtnL;
    case 'Państwo': return geoShow.ctyL;
    default: return true;
  }
}
function lonlatToLocal(lon, lat, r){
  const a=lon*Math.PI/180, b=lat*Math.PI/180, cb=Math.cos(b);
  return new THREE.Vector3(cb*Math.cos(a)*r, Math.sin(b)*r, -cb*Math.sin(a)*r);
}
function dotTexture(){            // okrągła, świecąca kropka (miasta)
  const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.4,'rgba(255,255,255,0.85)');
  g.addColorStop(0.75,'rgba(255,255,255,0.2)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.beginPath(); x.arc(32,32,32,0,Math.PI*2); x.fill();
  return new THREE.CanvasTexture(c);
}
function peakTexture(){           // trójkąt z obrysem (góry) — wyraźnie inny niż miasta
  const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d');
  x.beginPath(); x.moveTo(32,8); x.lineTo(56,54); x.lineTo(8,54); x.closePath();
  x.fillStyle='rgba(255,255,255,0.97)'; x.fill();
  x.lineWidth=5; x.strokeStyle='rgba(20,30,40,0.85)'; x.stroke();
  return new THREE.CanvasTexture(c);
}
function buildEdu(){
  _eduBuilding=true;
  fetch('geo/edu-data.json?v='+APP_VER).then(r=>r.json()).then(d=>{
    eduData = d;
    const e = bodies.find(b=>b.data.earth); if(!e) return;
    const r = e.data.radius * GEO_LIFT, g = new THREE.Group();  // tuż nad powierzchnią (chmury i tak schowane gdy geoActive) — minimalna paralaksa pod kątem
    const toGeo = arr => new THREE.BufferGeometry().setFromPoints(arr);
    const lineMat = (c,o) => new THREE.LineBasicMaterial({color:c, transparent:true, opacity:o, depthWrite:false});
    const cityMat = s => new THREE.PointsMaterial({map:dotTexture(), color:0xffd27a, size:s, sizeAttenuation:false, transparent:true, depthWrite:false});
    // rzeki: WSZYSTKIE zawsze widoczne (małe rzeki też) — wyraźny niebieski; major grubszy/mocniejszy
    const RIVER = 0x3a93ff;
    const rMaj=[], rMin=[];
    d.rivers.forEach(([n,segs,rank])=>{ const dst=((rank||9)<=5?rMaj:rMin); segs.forEach(seg=>{ for(let i=0;i<seg.length-1;i++){ dst.push(lonlatToLocal(seg[i][0],seg[i][1],r), lonlatToLocal(seg[i+1][0],seg[i+1][1],r)); } }); });
    const rMajO=new THREE.LineSegments(toGeo(rMaj), lineMat(RIVER, 0.8)); g.add(rMajO);          // duże rzeki
    const rMinO=new THREE.LineSegments(toGeo(rMin), lineMat(RIVER, 0.62)); g.add(rMinO);         // małe rzeki — też zawsze widoczne
    // jeziora: wypełniona niebieska tafla (earcut przez THREE.ShapeGeometry — poprawne dla wklęsłych) + jaśniejszy obrys
    const lakeFill=[], lakePts=[];
    d.lakes.forEach(([n,ring])=>{
      for(let i=0;i<ring.length-1;i++) lakePts.push(lonlatToLocal(ring[i][0],ring[i][1],r), lonlatToLocal(ring[i+1][0],ring[i+1][1],r));  // obrys
      const shp=new THREE.Shape(ring.map(p=>new THREE.Vector2(p[0],p[1])));   // wielokąt w lon/lat
      const sg=new THREE.ShapeGeometry(shp), sp=sg.attributes.position, ix=sg.index;   // triangulacja (earcut)
      if(ix){ for(let k=0;k<ix.count;k++){ const i=ix.getX(k); lakeFill.push(lonlatToLocal(sp.getX(i),sp.getY(i),r)); } }   // każdy wierzchołek → sfera
      sg.dispose();
    });
    const lakeFillO=new THREE.Mesh(toGeo(lakeFill), new THREE.MeshBasicMaterial({color:0x2f86dd, transparent:true, opacity:0.55, depthWrite:false, side:THREE.DoubleSide})); g.add(lakeFillO);  // tafla jeziora
    const lakeOutO=new THREE.LineSegments(toGeo(lakePts), lineMat(0x9fe2ff, 0.9)); g.add(lakeOutO);    // jaśniejszy obrys jezior
    // miasta: major (≥500 tys.) zawsze; minor pojawia się przy zbliżeniu (LOD)
    const cMaj=[], cMin=[];
    d.cities.forEach(c=> ((c[3]||0)>=500000?cMaj:cMin).push(lonlatToLocal(c[0],c[1],r)));
    const cMajO=new THREE.Points(toGeo(cMaj), cityMat(7)); g.add(cMajO);
    const cMinObj=new THREE.Points(toGeo(cMin), cityMat(5)); g.add(cMinObj);
    // góry: trójkąty (inny kształt + kolor) — odróżnialne od miast
    const peaksO=new THREE.Points(toGeo(d.mountains.map(c=>lonlatToLocal(c[0],c[1],r))),
      new THREE.PointsMaterial({map:peakTexture(), color:0xffffff, size:13, sizeAttenuation:false, transparent:true, depthWrite:false})); g.add(peaksO);
    eduMinor=[cMinObj];   // rzeki zawsze widoczne; LOD-uje tylko drobne miasta
    eduCat.water=[rMajO, rMinO, lakeFillO, lakeOutO];   // rzeki+jeziora (obszary)
    eduCat.cities=[cMajO];                              // major (minor=eduMinor, gatowane LOD ∧ kat)
    eduCat.mountains=[peaksO];                          // szczyty (pasma górskie osobno w mountainsGroup)
    e.mesh.add(g); eduGroup=g; g.visible=geoActive;   // build mógł dojechać już po aktywacji (auto-nearEarth)
    applyGeoVisibility();
    // etykiety (nazwy) — pozycja lokalna + waga (imp) do LOD/declutteringu + kolor wg kategorii.
    // Dedup po nazwie (rzeki bywają w wielu segmentach: Wisła/Vistula itp.); góry najpierw → priorytet.
    eduLabels = []; const _seen=new Set();
    const pushL=(pos,name,imp,color,cat,lon,lat)=>{ if(!name||_seen.has(name)) return; _seen.add(name); eduLabels.push({pos,name,imp,color,cat,lon,lat}); };
    d.mountains.forEach(c=> pushL(lonlatToLocal(c[0],c[1],r), c[2], 90, '#ffce9a', 'Góra', c[0], c[1]));
    d.cities.forEach(c=> pushL(lonlatToLocal(c[0],c[1],r), c[2], Math.min(62,(c[3]||0)/200000), '#ffe6a0', 'Miasto', c[0], c[1]));
    d.rivers.forEach(([n,segs,rank])=>{ const s=segs.reduce((a,b)=>b.length>a.length?b:a,segs[0]); const m=s[Math.floor(s.length/2)]; pushL(lonlatToLocal(m[0],m[1],r), n, 64-(rank||9)*6, '#9fd6ff', 'Rzeka', m[0], m[1]); });
    d.lakes.forEach(([n,ring,rank])=>{ let sx=0,sy=0; ring.forEach(p=>{sx+=p[0];sy+=p[1];}); const lo=sx/ring.length, la=sy/ring.length; pushL(lonlatToLocal(lo,la,r), n, 66-(rank||9)*6, '#bfe6ff', 'Jezioro', lo, la); });
    (d.seas||[]).forEach(c=> pushL(lonlatToLocal(c[0],c[1],r), c[2], 70, '#86c8ff', 'Morze / ocean', c[0], c[1]));
    eduLabels.sort((a,b)=> b.imp - a.imp);     // wg ważności → pętla etykiet bierze tylko czołówkę (wydajność)
  }).catch(err=>{ console.warn('edu-data', err); }).finally(()=>{ _eduBuilding=false; });
}
function buildCountries(){
  _countriesBuilding=true;
  fetch('geo/countries.json?v='+APP_VER).then(r=>r.json()).then(d=>{
    countriesData=d;
    const e = bodies.find(b=>b.data.earth); if(!e) return;
    const r = e.data.radius * GEO_LIFT, pts=[];                // tuż nad powierzchnią (jak warstwa edu) — minimalna paralaksa
    countryLabels = d.map(c=>({ pos:lonlatToLocal(c.centroid[0], c.centroid[1], e.data.radius),
      name:c.name, imp:80, color:'#ffe0a0', cat:'Państwo', lon:c.centroid[0], lat:c.centroid[1] }));
    d.forEach(c=> c.polys.forEach(ring=>{ for(let i=0;i<ring.length-1;i++){
      pts.push(lonlatToLocal(ring[i][0],ring[i][1],r), lonlatToLocal(ring[i+1][0],ring[i+1][1],r)); } }));
    const g = new THREE.Group();
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:0x8aa0bf, transparent:true, opacity:0.38, depthWrite:false})));
    e.mesh.add(g); countriesGroup=g; g.visible=geoActive;
  }).catch(err=>{ console.warn('countries', err); }).finally(()=>{ _countriesBuilding=false; });
}
function buildMountainRanges(){
  _mountainsBuilding=true;
  fetch('geo/mountain-ranges.json?v='+APP_VER).then(r=>r.json()).then(d=>{
    mountainsData=d;
    const e = bodies.find(b=>b.data.earth); if(!e) return;
    const r = e.data.radius * GEO_LIFT, pts=[];                // tuż nad powierzchnią (jak warstwa edu)
    mountainLabels = d.map(m=>({ pos:lonlatToLocal(m.centroid[0], m.centroid[1], e.data.radius),
      name:m.name, imp:74, color:'#e8c69a', cat:'Pasmo górskie', lon:m.centroid[0], lat:m.centroid[1] }));
    const fill=[];
    d.forEach(m=> m.polys.forEach(ring=>{
      for(let i=0;i<ring.length-1;i++) pts.push(lonlatToLocal(ring[i][0],ring[i][1],r), lonlatToLocal(ring[i+1][0],ring[i+1][1],r));  // obrys
      const shp=new THREE.Shape(ring.map(p=>new THREE.Vector2(p[0],p[1])));   // tafla (earcut, jak jeziora)
      const sg=new THREE.ShapeGeometry(shp), sp=sg.attributes.position, ix=sg.index;
      if(ix){ for(let k=0;k<ix.count;k++){ const i=ix.getX(k); fill.push(lonlatToLocal(sp.getX(i),sp.getY(i),r)); } }
      sg.dispose();
    }));
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BufferGeometry().setFromPoints(fill),
      new THREE.MeshBasicMaterial({color:0xe6a84e, transparent:true, opacity:0.14, depthWrite:false, side:THREE.DoubleSide})));   // subtelny bursztynowy tint regionu
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:0xe6a84e, transparent:true, opacity:0.7, depthWrite:false})));    // obrys (stonowany — tint robi widoczność)
    e.mesh.add(g); mountainsGroup=g; g.visible=geoActive;
  }).catch(err=>{ console.warn('mountain-ranges', err); }).finally(()=>{ _mountainsBuilding=false; });
}
function buildPlRivers(){
  _plRiversBuilding=true;
  fetch('geo/pl-rivers.json?v='+APP_VER).then(r=>r.json()).then(d=>{
    plRiversData=d;
    const e = bodies.find(b=>b.data.earth); if(!e) return;
    const r = e.data.radius * GEO_LIFT, pts=[], byName={};
    d.forEach(([name, line])=>{
      for(let i=0;i<line.length-1;i++) pts.push(lonlatToLocal(line[i][0],line[i][1],r), lonlatToLocal(line[i+1][0],line[i+1][1],r));
      if(!byName[name] || line.length>byName[name].length) byName[name]=line;   // etykieta: najdłuższa polilinia
    });
    const g = new THREE.Group();
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:0x3a93ff, transparent:true, opacity:0.7, depthWrite:false})));   // niebieski jak rzeki edu
    e.mesh.add(g); plRiversGroup=g; g.visible=geoActive;
    plRiverLabels = Object.entries(byName).map(([name,line])=>{ const m=line[Math.floor(line.length/2)];
      return { pos:lonlatToLocal(m[0],m[1],e.data.radius), name, imp:46, color:'#9fd6ff', cat:'Rzeka', lon:m[0], lat:m[1] }; });
  }).catch(err=>{ console.warn('pl-rivers', err); }).finally(()=>{ _plRiversBuilding=false; });
}
function ensureEduLabelPool(){
  if(eduLabelBox) return;
  eduLabelBox=document.createElement('div');
  eduLabelBox.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:6';
  document.body.appendChild(eduLabelBox);
  for(let i=0;i<240;i++){ const el=document.createElement('div');
    el.style.cssText="position:absolute;transform:translate(-50%,-50%);font:600 11px 'Space Grotesk',sans-serif;white-space:nowrap;padding:1px 6px;border-radius:6px;background:rgba(6,10,18,0.5);text-shadow:0 1px 2px #000;display:none";
    eduLabelBox.appendChild(el); eduLabelEls.push(el); }
}
const _ecW=new THREE.Vector3(), _wp=new THREE.Vector3(), _nrm=new THREE.Vector3(), _camN=new THREE.Vector3(), _ndc=new THREE.Vector3(), _tmpN2=new THREE.Vector3();
function updateEduLabels(now){
  if(!showLabels || !geoActive || !eduGroup || !eduGroup.visible || !eduLabels.length){ if(eduLabelBox) eduLabelBox.style.display='none'; _eduShown.length=0; return; }
  ensureEduLabelPool(); eduLabelBox.style.display='block';
  const e=bodies.find(b=>b.data.earth); _ecW.copy(worldPos(e));
  const rr=e.data.radius, dist=camera.position.distanceTo(_ecW);
  _camN.copy(camera.position).sub(_ecW).normalize();
  const showMin = dist < rr*8;                                  // LOD nakładki: drobne miasta/rzeki przy zbliżeniu
  if(showMin !== _eduMinorShown){ _eduMinorShown=showMin; applyGeoVisibility(); }   // cMin LOD przez applyGeoVisibility (∧ kat. miasta)
  // pasmo kategorii wg zoomu: zwraca true jeśli etykieta L ma być widoczna na tym dystansie
  const band = (L)=>{
    if(dist > rr*14) return false;
    if(dist > rr*9)  return L.cat==='Państwo' || L.cat==='Morze / ocean' || L.cat==='Góra';   // „polityczna mapa"
    if(dist > rr*4)  return L.cat!=='Państwo';                  // + miasta/rzeki/jeziora (państwa znikają, robią miejsce)
    return L.cat!=='Państwo';                                   // blisko: wszystko prócz dużych etykiet państw
  };
  // RESELECT (throttlowane ~6×/s): K = sloty ∝ zoom (gładko), filtr kategorii osobno (band)
  if(now - _eduLabelT > 160){
    _eduLabelT = now;
    // K rośnie gładko od dali (rr*14) do bliska (rr*2): ~24 → 240. BEZ kolizji z magiczną rr*9 (stary kod).
    const t = Math.max(0, Math.min(1, (rr*14 - dist) / (rr*12)));
    // budżet skalowany powierzchnią ekranu (odniesienie 1400×900): telefon 390×844 → ~¼ (≤ ~50 etykiet)
    const areaK = Math.max(0.25, Math.min(1, (innerWidth*innerHeight)/(1400*900)));
    const K = (dist > rr*14) ? 0 : Math.max(8, Math.round((24 + t*166)*areaK));   // cap ~190 na desktopie
    const cands=[], Nmax=Math.min(eduLabels.length, 1500);
    const consider = (L)=>{ if(!band(L) || !labelShown(L.cat)) return;
      _wp.copy(L.pos); e.mesh.localToWorld(_wp);
      _nrm.copy(_wp).sub(_ecW).normalize(); if(_nrm.dot(_camN) < 0.2) return;
      _ndc.copy(_wp).project(camera); if(_ndc.z>1 || Math.abs(_ndc.x)>0.97 || Math.abs(_ndc.y)>0.97) return;
      cands.push({L, sx:(_ndc.x*0.5+0.5)*innerWidth, sy:(-_ndc.y*0.5+0.5)*innerHeight});
    };
    for(let i=0;i<Nmax;i++) consider(eduLabels[i]);             // edu (posortowane po imp, czołówka)
    for(let i=0;i<countryLabels.length;i++) consider(countryLabels[i]);   // państwa (zawsze rozważane, ~177)
    for(let i=0;i<mountainLabels.length;i++) consider(mountainLabels[i]);  // pasma górskie
    for(let i=0;i<plRiverLabels.length;i++) consider(plRiverLabels[i]);    // polskie rzeki (NE Europe)
    cands.sort((a,b)=> b.L.imp - a.L.imp);                      // ważniejsze pierwsze (po połączeniu źródeł)
    const placed=[]; _eduShown.length=0; let pi=0;
    const gapX = showMin ? 62 : 52;                             // blisko: większy odstęp (mniej tłoku)
    for(const c of cands){ if(pi>=K) break;
      // declutter O(K²) z szacowaną szerokością etykiety (600 11px Space Grotesk ≈ 6,3 px/znak + padding 12 px)
      const w = c.L._w || (c.L._w = c.L.name.length*6.3 + 12);
      if(placed.some(p=> Math.abs(p.sx-c.sx) < Math.max(gapX, (p.w+w)/2 + 4) && Math.abs(p.sy-c.sy) < 17)) continue;
      const el=eduLabelEls[pi++]; el.textContent=c.L.name; el.style.color=c.L.color;
      c.w = w; _eduShown.push({L:c.L, el}); placed.push(c);
    }
    for(let i=pi;i<eduLabelEls.length;i++) eduLabelEls[i].style.display='none';
  }
  // REPOZYCJA co klatkę — etykiety płynnie trzymają się globu przy obracaniu (bez laga)
  for(const s of _eduShown){
    _wp.copy(s.L.pos); e.mesh.localToWorld(_wp);
    _nrm.copy(_wp).sub(_ecW).normalize();
    if(_nrm.dot(_camN) < 0.12){ s.el.style.display='none'; continue; }
    _ndc.copy(_wp).project(camera);
    s.el.style.left=((_ndc.x*0.5+0.5)*innerWidth)+'px'; s.el.style.top=((-_ndc.y*0.5+0.5)*innerHeight)+'px'; s.el.style.display='block';
  }
}

/* --- Klikanie obiektów geo: wskaźnik (marker) + tooltip z opisem (Wikipedia pl→en) --- */
let eduSel=null, eduMarker=null, eduTip=null, eduLine=null, eduSelDir=null, hoverLbl=null, _hoverT=0, areaHL=null, _tapArm=null;   // _tapArm: uzbrojony id układu (touch: tap-1-nazwa → tap-2-dolot)
const _descCache={}, _tmpN=new THREE.Vector3();
function ringTexture(){
  const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d');
  x.strokeStyle='rgba(255,255,255,0.95)'; x.lineWidth=6; x.beginPath(); x.arc(32,32,22,0,Math.PI*2); x.stroke();
  return new THREE.CanvasTexture(c);
}
function pickEarthDir(rc){                          // analityczny ray↔sfera → lokalny kierunek trafienia
  const e=bodies.find(b=>b.data.earth); if(!e) return null;
  const C=worldPos(e), R=e.data.radius, O=rc.ray.origin, D=rc.ray.direction;
  const oc=_tmpN.copy(O).sub(C), bb=oc.dot(D), cc=oc.dot(oc)-R*R, disc=bb*bb-cc;
  if(disc<0) return null; const t=-bb-Math.sqrt(disc); if(t<0) return null;
  const P=new THREE.Vector3().copy(D).multiplyScalar(t).add(O);
  return e.mesh.worldToLocal(P).normalize();
}
const PICK_PX = 14;                              // promień ekranowy trafienia etykiety (px)
const _flW=new THREE.Vector3(), _flN=new THREE.Vector3();
// Najbliższa kursorowi (ekranowo) etykieta. Prefiltr stożkiem (dot>0.98, lokalna ramka jak dir),
// odrzut tylnej półkuli i za-near. filter: opcjonalny predykat włączający etykietę (kategorie).
function nearestLabelScreen(dir, cx, cy, filter){
  const e=bodies.find(b=>b.data.earth); if(!e) return null;
  _ecW.copy(worldPos(e)); _camN.copy(camera.position).sub(_ecW).normalize();
  let best=null, bestD=PICK_PX;
  const scan = (L)=>{
    if(filter && !filter(L)) return;
    if(dir.dot(_flN.copy(L.pos).normalize()) < 0.98) return;            // prefiltr stożkiem (lokalna ramka)
    _flW.copy(L.pos); e.mesh.localToWorld(_flW);
    _flN.copy(_flW).sub(_ecW).normalize(); if(_flN.dot(_camN) < 0.1) return;   // tylna półkula
    _ndc.copy(_flW).project(camera); if(_ndc.z>1) return;
    const sx=(_ndc.x*0.5+0.5)*innerWidth, sy=(-_ndc.y*0.5+0.5)*innerHeight;
    const d=Math.hypot(sx-cx, sy-cy);
    if(d<bestD){ bestD=d; best=L; }
  };
  for(const L of eduLabels) scan(L);
  for(const L of plRiverLabels) scan(L);     // nowe polskie rzeki też klikalne
  return best;
}
function ensureEduTip(){
  if(eduTip) return;
  eduTip=document.createElement('div');
  eduTip.style.cssText="position:absolute;z-index:21;max-width:300px;pointer-events:none;background:rgba(10,14,22,0.92);border:1px solid var(--border);border-radius:12px;padding:11px 13px;backdrop-filter:blur(8px);transform:translate(-50%,-120%);display:none;box-shadow:0 8px 30px rgba(0,0,0,0.5)";
  document.body.appendChild(eduTip);
}
function fetchDesc(label, cb){
  const key=label.lon+','+label.lat;
  if(key in _descCache){ cb(_descCache[key]); return; }
  const norm=s=>(s||'').toLowerCase().replace(/[^a-z0-9ąćęłńóśźż ]/gi,'').trim();
  const want=norm(label.name);
  // walidacja geograficzna: odrzuć artykuł o tej samej nazwie, ale gdzie indziej
  const near=c=>{ if(!c) return true; let dl=Math.abs(c.lon-label.lon)%360; if(dl>180) dl=360-dl; return Math.abs(c.lat-label.lat)<=16 && dl<=24; };
  const summ=(lang,title)=> fetch(WikiInfo.summaryUrl(lang,title))
    .then(r=>r.ok?r.json():null)
    .then(j=>{ const a=WikiInfo.acceptSummary(j,{near}); return a?a.extract:null; })
    .catch(()=>null);
  const byName=lang=> summ(lang, label.name);                  // czysta nazwa (Berlin, Tatry, Vistula, North Sea…)
  const byGeo=lang=> fetch('https://'+lang+'.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord='+label.lat+'%7C'+label.lon+'&gsradius=10000&gslimit=8&format=json&origin=*')
    .then(r=>r.ok?r.json():null).then(j=>{ const g=(j&&j.query&&j.query.geosearch)||[]; if(!g.length) return null;
      const m=g.find(x=>{ const t=norm(x.title); return t && (t.includes(want)||want.includes(t)); }); return (m||g[0]).title; })
    .then(t=> t?summ(lang,t):null).catch(()=>null);            // fallback po współrzędnych (złe transliteracje NE)
  byName('pl').then(x=> x||byName('en')).then(x=> x||byGeo('pl')).then(x=> x||byGeo('en'))
    .then(x=>{ _descCache[key]=x; cb(x); }).catch(()=>cb(null));
}
function selectEdu(label){
  const e=bodies.find(b=>b.data.earth); if(!e) return;
  if(areaHL){ areaHL.geometry.dispose(); areaHL.material.dispose(); e.mesh.remove(areaHL); areaHL=null; }  // wybór feature kasuje highlight państwa
  deselectSat();                                   // wzajemne wykluczenie selekcji miasto/satelita
  eduSel=label; ensureEduTip();
  eduSelDir = label.pos.clone().normalize();        // normalna do powierzchni; linia rysowana adaptacyjnie (updateEduTip)
  if(!eduMarker){
    eduMarker=new THREE.Group();
    eduLine=new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color:0xffffff, transparent:true, opacity:0.92, depthTest:false}));
    eduMarker.add(eduLine); e.mesh.add(eduMarker);
  }
  eduMarker.visible=true;
  eduTip.innerHTML='<div style="font:700 14px \'Space Grotesk\',sans-serif;color:#fff">'+label.name+'</div>'+
    '<div style="font:600 9.5px \'IBM Plex Mono\',monospace;letter-spacing:.12em;text-transform:uppercase;color:'+label.color+';margin:3px 0 7px">'+label.cat+'</div>'+
    '<div id="eduTipDesc" style="font-size:12px;line-height:1.5;color:var(--muted)">ładowanie opisu…</div>';
  eduTip.style.display='block';
  fetchDesc(label, txt=>{ const el=document.getElementById('eduTipDesc'); if(el && eduSel===label) el.textContent = txt || 'Brak opisu w Wikipedii.'; });
}
// wybór obszaru (państwo / pasmo górskie) — wspólny highlight areaHL + tooltip/pin/Wiki przez selectEdu
function selectArea(item, colorHex, cat){
  const e=bodies.find(b=>b.data.earth); if(!e) return;
  selectEdu({ name:item.name, color:colCss(colorHex), cat,            // selectEdu czyści poprzedni areaHL
    lon:item.centroid[0], lat:item.centroid[1], pos:lonlatToLocal(item.centroid[0], item.centroid[1], e.data.radius) });
  const r=e.data.radius*GEO_LIFT, pts=[];                  // highlight na warstwie geo (depthTest:false → i tak nad obrysem)
  item.polys.forEach(ring=>{ for(let i=0;i<ring.length-1;i++){
    pts.push(lonlatToLocal(ring[i][0],ring[i][1],r), lonlatToLocal(ring[i+1][0],ring[i+1][1],r)); } });
  areaHL=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({color:colorHex, transparent:true, opacity:0.95, depthTest:false, depthWrite:false}));
  e.mesh.add(areaHL);
}
function selectCountry(c){ selectArea(c, 0xffd27a, 'Państwo'); }
function selectRange(m){ selectArea(m, 0xe0b070, 'Pasmo górskie'); }
function deselectEdu(){ eduSel=null; eduSelDir=null; if(eduMarker) eduMarker.visible=false; if(eduTip) eduTip.style.display='none';
  if(areaHL){ const e=bodies.find(b=>b.data.earth); areaHL.geometry.dispose(); areaHL.material.dispose(); if(e) e.mesh.remove(areaHL); areaHL=null; } }
// tooltip nazwy (hover desktop + tap touch — finding #6): jeden pisarz hoverLbl
function showHoverName(name, color, x, y){
  if(!hoverLbl){ hoverLbl=document.createElement('div'); hoverLbl.id='hoverLbl'; hoverLbl.style.cssText="position:absolute;z-index:8;pointer-events:none;transform:translate(-50%,-170%);font:700 12px 'Space Grotesk',sans-serif;background:rgba(6,10,18,0.72);padding:2px 7px;border-radius:7px;white-space:nowrap;text-shadow:0 1px 2px #000;display:none"; document.body.appendChild(hoverLbl); }
  hoverLbl.textContent=name; hoverLbl.style.color=color||'#fff';
  hoverLbl.style.left=x+'px'; hoverLbl.style.top=(y-4)+'px'; hoverLbl.style.display='block';
}
function hideHover(){ if(hoverLbl) hoverLbl.style.display='none'; hideGlow(); }

/* --- Poświata na hover (addytywna, miękki gradient) --- */
let _glowTex=null;
function glowSpriteTexture(){
  if(_glowTex) return _glowTex;
  // miękki radialny gradient (biały → przezroczysty) — tint przez material.color
  _glowTex = glowTexture('rgba(255,255,255,0.95)','rgba(255,255,255,0.35)');
  return _glowTex;
}
let glowMk=null;
function showGlow(worldPos, color, isPoint){
  if(!glowMk){ glowMk=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowSpriteTexture(),
    transparent:true, blending:THREE.AdditiveBlending, depthTest:false, depthWrite:false })); scene.add(glowMk); }
  glowMk.position.copy(worldPos);
  const d=camera.position.distanceTo(worldPos);
  // punkty (sat/miasta/planetoidy): ~stały rozmiar ekranowy; kule: większa aureola
  glowMk.scale.setScalar(d * (isPoint ? 0.05 : 0.09));
  glowMk.material.color.set(color||'#ffffff'); glowMk.visible=true;
}
function hideGlow(){ if(glowMk) glowMk.visible=false; }

/* --- Wybór konstelacji: podświetlenie całej + halo + karta --- */
let conSel = null;   // { name, sm, lm, save:{sColor,sSize,sOp,lColor,lOp}, halo }

function selectConstellation(name){
  if(conSel && conSel.name===name){ openConstellationCard(name); return; }   // re-klik tej samej → tylko karta
  deselectConstellation();
  const item = asterism.byName.get(name); if(!item || !item.visible) return;
  const sm = item.pts.material;
  const line = item.grp.children.find(c=>c.isLineSegments);
  const lm = line ? line.material : null;
  const save = { sColor:sm.color.clone(), sSize:sm.size, sOp:sm.opacity,
                 lColor: lm?lm.color.clone():null, lOp: lm?lm.opacity:0 };
  // podbicie materiału konstelacji
  sm.color.set(0xfff2a8); sm.size = save.sSize*2.0; sm.opacity = 1;
  if(lm){ lm.color.set(0x9fc2ff); lm.opacity = Math.min(1, save.lOp+0.4); }
  // halo na centroidzie, skala wg rozpiętości gwiazd
  const pos = item.pts.geometry.attributes.position; const v=new THREE.Vector3(); let spread=0;
  for(let i=0;i<pos.count;i++){ v.fromBufferAttribute(pos,i); spread=Math.max(spread, v.distanceTo(item.labelPos)); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowSpriteTexture(), color:0x8ab4ff,
    transparent:true, blending:THREE.AdditiveBlending, depthTest:false, depthWrite:false }));
  halo.position.copy(item.labelPos); halo.scale.setScalar(Math.max(spread*1.6, SKY_R*0.05)); scene.add(halo);
  conSel = { name, sm, lm, save, halo };
  openConstellationCard(name);
}

function deselectConstellation(){
  if(!conSel) return;
  const { sm, lm, save, halo } = conSel;
  sm.color.copy(save.sColor); sm.size = save.sSize; sm.opacity = save.sOp;
  if(lm && save.lColor){ lm.color.copy(save.lColor); lm.opacity = save.lOp; }
  if(halo){ scene.remove(halo); halo.material.dispose(); }   // mapa (glowSpriteTexture) współdzielona — nie disposować
  conSel = null;
}

function openConstellationCard(name){
  const a = (skyData && skyData.asterisms) ? skyData.asterisms.find(x=>x.name===name) : null;
  if(!a){ return; }
  const f = ConstellationCard.cardFacts(a, skyData.groups);
  const facts = {
    'Pora roku': f.groupLabel,
    'Półkula': ConstellationCard.hemiLabel(f.hemi),
    'Najjaśniejsze gwiazdy': f.brightest.slice(0,5).map(s=>`${s.n} (${s.m.toFixed(2)}ᵐ)`).join(', ') || '—'
  };
  openInfoModal({ kind:'star', name:f.name, facts, wiki:f.wiki });
}

/* --- Satelity: pick / podświetlenie / tooltip (chmura punktów SGP4, ruchoma) --- */
let satSel=null, satMk=null; const _hwp=new THREE.Vector3();
function satPick(rc){
  if(!sats.active || !sats.points) return null;
  const e=bodies.find(b=>b.data.id==='earth'); const camD=camera.position.distanceTo(worldPos(e));
  rc.params.Points.threshold = Math.max(0.02, camD*0.012);
  const h=rc.intersectObject(sats.points, false); rc.params.Points.threshold = 0;
  if(!h.length) return null;
  return { idx:h[0].index, name:(sats.names && sats.names[h[0].index]) || ('Satelita #'+h[0].index) };
}
function satWorldPos(idx, out){
  const a=sats.points.geometry.attributes.position.array;
  out.set(a[idx*3], a[idx*3+1], a[idx*3+2]); sats.points.localToWorld(out); return out;
}
function satOccluded(worldP){                          // Ziemia zasłania satelitę po drugiej stronie?
  const e=bodies.find(b=>b.data.id==='earth'); _ecW.copy(worldPos(e)); const rr=e.data.radius;
  const D=_tmpN.copy(worldP).sub(camera.position); const dToSat=D.length(); D.normalize();
  const oc=_tmpN2.copy(camera.position).sub(_ecW); const b=oc.dot(D), c=oc.dot(oc)-rr*rr, disc=b*b-c;
  if(disc<=0) return false; const t=-b-Math.sqrt(disc); return t>0 && t < dToSat-0.02;
}
function selectSat(p){
  deselectEdu(); satSel=p; ensureEduTip();
  if(!satMk){ satMk=new THREE.Sprite(new THREE.SpriteMaterial({map:ringTexture(), color:0x9fe6ff, transparent:true, depthTest:false})); scene.add(satMk); }
  satMk.visible=true;
  const rr = trueScale ? trueRadius(R_KM.earth) : bodies.find(b=>b.data.id==='earth').data.radius;  // skala satelitów zależna od trybu
  const a=sats.points.geometry.attributes.position.array, i=p.idx;
  const altKm=Math.round((Math.hypot(a[i*3],a[i*3+1],a[i*3+2])/rr - 1)*R_EARTH_KM);
  eduTip.innerHTML='<div style="font:700 14px \'Space Grotesk\',sans-serif;color:#fff">'+(p.name||'').trim()+'</div>'+
    '<div style="font:600 9.5px \'IBM Plex Mono\',monospace;letter-spacing:.12em;text-transform:uppercase;color:#9fe6ff;margin:3px 0 7px">Satelita Ziemi</div>'+
    '<div style="font-size:12px;line-height:1.5;color:var(--muted)">Wysokość orbity: ~'+altKm.toLocaleString('pl')+' km</div>';
  eduTip.style.display='block';
}
function deselectSat(){ satSel=null; if(satMk) satMk.visible=false; }
function updateSatTip(){
  if(!satSel || !sats.active || !sats.points || !eduTip){ if(satSel) deselectSat(); return; }
  satWorldPos(satSel.idx, _wp); satMk.position.copy(_wp);
  satMk.scale.setScalar(camera.position.distanceTo(_wp)*0.05);
  _ndc.copy(_wp).project(camera);
  if(_ndc.z>1 || satOccluded(_wp)){ eduTip.style.display='none'; satMk.visible=false; return; }
  satMk.visible=true; eduTip.style.display='block';
  eduTip.style.left=((_ndc.x*0.5+0.5)*innerWidth)+'px'; eduTip.style.top=((-_ndc.y*0.5+0.5)*innerHeight)+'px';
}
function updateEduTip(){
  if(!eduSel || !eduMarker || !eduLine || !eduSelDir) return;
  const e=bodies.find(b=>b.data.earth), rr=e.data.radius;
  _ecW.copy(worldPos(e));
  const camDist=camera.position.distanceTo(_ecW);
  const len=Math.max(rr*0.05, Math.min(rr*0.9, camDist*0.11));   // im bliżej Ziemi → krótsza linia, tooltip blisko powierzchni
  const baseR=rr*1.005, tipR=baseR+len;
  eduLine.geometry.setFromPoints([_tmpN.copy(eduSelDir).multiplyScalar(baseR), _tmpN2.copy(eduSelDir).multiplyScalar(tipR)]);
  _wp.copy(eduSelDir).multiplyScalar(tipR); e.mesh.localToWorld(_wp);   // kotwica tooltipa = szczyt linii
  _nrm.copy(_wp).sub(_ecW).normalize(); _camN.copy(camera.position).sub(_ecW).normalize();
  if(_nrm.dot(_camN) < 0.0){ eduTip.style.display='none'; eduMarker.visible=false; return; }   // za globem
  eduMarker.visible=true; eduTip.style.display='block';
  _ndc.copy(_wp).project(camera);
  eduTip.style.left=((_ndc.x*0.5+0.5)*innerWidth)+'px'; eduTip.style.top=((-_ndc.y*0.5+0.5)*innerHeight)+'px';
}

/* ---------- Panel: sub-drzewo asteryzmów ---------- */
let skyVisible = new Set();              // SSOT: nazwy widocznych asteryzmów (Task 6 ładuje z localStorage)
let skyData = null;                       // surowe dane (do groupModel)

onAsterismsBuilt = function(){
  const names = getAsterismNames();
  skyVisible = SkyGroups.deserializeVis(lsGet(LS_VIS), names);     // brak zapisu → wszystkie on (K2: apply-after-fetch)
  applyAsterismVisibility(skyVisible);                              // (a) aplikuj po zbudowaniu items[]
  skyData = asterism._raw;                                         // DRY: reuse danych z buildAsterisms (bez 2. fetcha)
  buildSkyTree();                                                   // (b) liczniki od razu
  // (c) rozwinięcia grup wg zapisu
  const open = SkyGroups.deserializeOpen(lsGet(LS_OPEN));
  document.querySelectorAll('#skyTree .grp').forEach(g=>{
    if(open.has('grp:'+g.dataset.grp)){ g.classList.remove('collapsed'); const ch=g.querySelector('.chev'); if(ch) ch.textContent='▾'; }
  });
};

function buildSkyTree(){
  const host = document.getElementById('skyTree'); if(!host || !skyData) return;
  host.textContent = '';
  const model = SkyGroups.groupModel(skyData);
  model.forEach(g=>{
    const wrap = document.createElement('div'); wrap.className='grp collapsed'; wrap.dataset.grp=g.id;
    const h = document.createElement('div'); h.className='grp-h';
    h.innerHTML = `<span class="chev">▸</span><span>${g.label}</span><span class="cnt"></span><div class="toggle sm grp-sw"><span class="switch"></span></div>`;
    wrap.appendChild(h);
    g.asterisms.forEach(name=>{
      const leaf = document.createElement('div'); leaf.className='leaf'; leaf.dataset.name=name;
      leaf.innerHTML = `<span class="cb"></span><span>${name}</span><span class="iso">tylko ten ▸</span>`;
      // checkbox: toggle widoczności
      leaf.onclick = (e)=>{ if(e.target.classList.contains('iso')) return;
        const on = !skyVisible.has(name);
        if(on) skyVisible.add(name); else skyVisible.delete(name);
        setAsterismVisible(name, on); renderSkyCounts(); persistSky();
      };
      // izolacja „tylko ten"
      leaf.querySelector('.iso').onclick = (e)=>{ e.stopPropagation(); isolateAsterism(name); };
      wrap.appendChild(leaf);
    });
    // rozwijanie grupy
    h.querySelector('.chev').parentElement.onclick = (e)=>{
      if(e.target.closest('.grp-sw')) return;
      wrap.classList.toggle('collapsed');
      h.querySelector('.chev').textContent = wrap.classList.contains('collapsed') ? '▸' : '▾';
      persistOpen();
    };
    // switch grupy: on→wszystkie off; off/indet→wszystkie on
    h.querySelector('.grp-sw').onclick = (e)=>{ e.stopPropagation();
      const st = SkyGroups.groupState(skyVisible, g.asterisms);
      const target = st.state !== 'on';      // jeśli nie wszystkie on → włącz wszystkie; inaczej wyłącz
      g.asterisms.forEach(n=>{ if(target) skyVisible.add(n); else skyVisible.delete(n); setAsterismVisible(n, target); });
      renderSkyCounts(); persistSky();
    };
    host.appendChild(wrap);
  });
  renderSkyCounts();
}

function renderSkyCounts(){
  if(!skyData) return;
  const model = SkyGroups.groupModel(skyData);
  model.forEach(g=>{
    const wrap = document.querySelector(`.grp[data-grp="${g.id}"]`); if(!wrap) return;
    const st = SkyGroups.groupState(skyVisible, g.asterisms);
    wrap.querySelector('.cnt').textContent = `${g.hemi} · ${st.shown}/${st.total}`;
    const sw = wrap.querySelector('.grp-sw');
    sw.classList.toggle('on', st.state==='on');
    sw.querySelector('.switch').classList.toggle('indet', st.state==='indet');
    g.asterisms.forEach(n=>{
      const leaf = wrap.querySelector(`.leaf[data-name="${CSS.escape(n)}"]`);
      if(leaf) leaf.classList.toggle('on', skyVisible.has(n));
    });
  });
}

function isolateAsterism(name){
  if(!asterism.on){ setToggle('tAsterisms', true); showAsterisms(true); }   // izolacja przy master-off → zapal warstwę (B3)
  skyVisible = SkyGroups.isolate(name, getAsterismNames());
  applyAsterismVisibility(skyVisible); renderSkyCounts(); persistSky();
}

/* ---------- Persystencja localStorage (Task 6) ---------- */
const LS_VIS = 'solar.sky.vis', LS_OPEN = 'solar.sky.open';
function lsGet(k){ try { return localStorage.getItem(k); } catch(_) { return null; } }
function lsSet(k,v){ try { localStorage.setItem(k,v); } catch(_) {} }

function persistSky(){ lsSet(LS_VIS, SkyGroups.serializeVis(skyVisible, getAsterismNames())); }

function persistOpen(){
  const open = new Set();
  document.querySelectorAll('#panel details.sec[open]').forEach(d=> open.add('sec:'+d.dataset.sec));
  const grps = document.querySelectorAll('#skyTree .grp');
  if(grps.length){
    grps.forEach(g=>{ if(!g.classList.contains('collapsed')) open.add('grp:'+g.dataset.grp); });
  } else {
    // drzewo nieba jeszcze niezbudowane — zachowaj zapisane grp:*, by nie zgubić rozwinięcia grup
    SkyGroups.deserializeOpen(lsGet(LS_OPEN)).forEach(k=>{ if(k.indexOf('grp:')===0) open.add(k); });
  }
  lsSet(LS_OPEN, SkyGroups.serializeOpen(open));
}
function loadOpen(){
  const open = SkyGroups.deserializeOpen(lsGet(LS_OPEN));
  if(open.size===0) return;                                  // brak zapisu → domyślny układ z HTML
  document.querySelectorAll('#panel details.sec').forEach(d=> d.open = open.has('sec:'+d.dataset.sec));
}

/* ============================================================
   Controls panel
   ============================================================ */
let showOrbits = true, showClouds = true, showLabels = true, reliefOn = false;

function toggle(elId, init, fn){
  const el=document.getElementById(elId); el.classList.toggle('on', init);
  el.onclick=()=>{ const on=!el.classList.contains('on'); el.classList.toggle('on',on); fn(on); };
}
function setToggle(id, on){ const el=document.getElementById(id); if(el) el.classList.toggle('on', on); }
// „Orbity": pokaż/ukryj realne tory planet i komet (rysowane przez tryb Rzeczywistość)
toggle('tOrbits', true, v=>{ showOrbits=v;
  (reality.planetOrbits||[]).forEach(l=>l.visible=v);
  (reality.cometOrbits||[]).forEach(l=>l.visible=v);
  updateMoonOrbits(); });
toggle('tClouds', true, v=>{ showClouds=v; const e=PLANETS.find(p=>p.earth); if(e._clouds)e._clouds.visible=v && !geoActive; });
toggle('tLabels', true, v=>{ showLabels=v; labelLayer.style.display=v?'block':'none'; });
toggle('tEdu', false, v=>{ eduOn=v; setGeoActive(eduOn || _nearEarth); });   // ręczny override z dowolnej odległości
// grupa per-kategoria: etykiety (L) + obszary (A). seaA n/d (morza bez geometrii). Toggle ustawia flagę → applyGeoVisibility + wymuś re-eval etykiet.
{ const gMap={ gWaterL:'waterL',gWaterA:'waterA',gSeaL:'seaL',gMtnL:'mtnL',gMtnA:'mtnA',gCityL:'cityL',gCityA:'cityA',gCtyL:'ctyL',gCtyA:'ctyA' };
  Object.entries(gMap).forEach(([id,key])=> toggle(id, true, on=>{ geoShow[key]=on; applyGeoVisibility(); _eduLabelT=0; })); }
toggle('tRelief', false, v=>{ reliefOn=v; });
toggle('tAsterisms', false, v=>{ showAsterisms(v); });
toggle('tGalaxies', lsGet('solar.galaxies.on')!=='0', v=>{
  if(galaxyGroup && cosmos.scale !== 'galactic') galaxyGroup.visible = v;   // w D kopuła wymuszona ukryta (§9)
  lsSet('solar.galaxies.on', v?'1':'0'); });
toggle('tTrueScale', false, v=>{
  if(focused){
    const body = bodies.find(b=>b.data.id===focused.id);
    const prevR = effRadius(focused);                 // promień ciała przed zmianą skali
    applyTrueScale(v);                                 // przełącza globalny trueScale
    reframeFocus(body, prevR, effRadius(focused));     // effRadius już w nowej skali
  } else {
    applyTrueScale(v);
  }
});
document.getElementById('tourBtn').onclick = toggleTour;
toggle('tSats', false, v=>{ if(v) loadSatellites(); else { clearSatellites(); document.getElementById('satStat').style.display='none'; } });
toggle('tProbes', false, v=>{ if(v) startProbes(); else stopProbes(); });

// kliknięcia switchy w nagłówkach <summary> nie mają zwijać sekcji
document.querySelectorAll('#panel summary .toggle').forEach(t=>{
  t.addEventListener('click', e=> e.stopPropagation());
});

// persystencja rozwinięcia sekcji <details> + odtworzenie przy starcie
document.querySelectorAll('#panel details.sec').forEach(d=> d.addEventListener('toggle', persistOpen));
loadOpen();

// odtwórz zapisane warianty tekstur (skiny) z poprzedniej sesji
Object.keys(SKINS).forEach(id=>{ const i = currentSkinIdx(id); if(i>0) applySkin(id, i); });

// Tryb Rzeczywistość (live) jest zawsze włączony — czas rzeczywisty 1:1, pozycje i obroty jak w naturze.
startReality();

/* ============================================================
   Raycast click to select
   ============================================================ */
const ray=new THREE.Raycaster(), mouse=new THREE.Vector2();
let downXY=null;
renderer.domElement.addEventListener('pointerdown', e=>{
  if(e.pointerType === 'touch') return;                          // desktop/mysz-only (touch koliduje z OrbitControls ROTATE)
  const h = nodeHandleRayHit(e.clientX, e.clientY);
  if(h){ beginHandleDrag(e, h); e.preventDefault(); e.stopPropagation(); return; }   // uchwyt Δv > marker
  if(nodeMarkerRayHit(e.clientX, e.clientY)){
    beginNodeDrag(e); e.preventDefault(); e.stopPropagation();   // złap marker; preventDefault tnie natywną selekcję
  }
}, true);   // capture=true: ten listener biegnie wcześnie i ustawia flagi dragu. Obrót OrbitControls blokowany przez enableRotate=false w lockControlsForDrag.
renderer.domElement.addEventListener('pointerdown', e=>{ downXY=[e.clientX,e.clientY]; hideHover(); });
renderer.domElement.addEventListener('wheel', ()=>{ if(cosmos.transitioning) return; hideHover(); }, {passive:true});   // zoom → schowaj podświetlenie (reveal: input zablokowany)
// hover: wskazanie myszą dowolnego obiektu → pierścień podświetlenia + nazwa (każde miasto/rzeka/jezioro/morze/góra)
const hexCss = n => '#'+((n>>>0)&0xffffff).toString(16).padStart(6,'0');

/* --- pickAt: jedno źródło prawdy raycastu ---
   Zwraca ObjDesc albo null. Kolejność trafień zachowuje dzisiejszą semantykę pointerup.
   Pułapka 1: klik w pustą Ziemię przy mapie edu → {kind:'geo', ref:{empty:true}} → deselect, NIE focus.
   Pułapka 2: satelita → occluded z satOccluded (hover Task 5 to wykorzysta).
   Pułapka 3: bryłka pasa → pozycja przez getMatrixAt × beltGroup.matrixWorld (pas się obraca!). */
const _pmBelt = new THREE.Matrix4(), _pmPos = new THREE.Vector3();
function colCss(n){ return '#'+((n>>>0)&0xffffff).toString(16).padStart(6,'0'); }

// Słynne satelity: nazwa z TLE → artykuł Wikipedii (reszta → karta techniczna).
const SAT_ALIASES = [
  { re:/\bISS\b|ZARYA/i,            wiki:{lang:'pl', title:'Międzynarodowa Stacja Kosmiczna'} },
  { re:/HST|HUBBLE/i,               wiki:{lang:'pl', title:"Kosmiczny Teleskop Hubble'a"} },
  { re:/TIANHE|TIANGONG|^CSS\b/i,   wiki:{lang:'pl', title:'Tiangong'} }
];
function satAlias(name){ const m=SAT_ALIASES.find(a=>a.re.test(name||'')); return m?m.wiki:null; }

// Galaktyki: picking centroid-EKRANOWY (NIE raycast mesh) — bezpieczny mimo `visible=false` Points na
// powłoce nieba (raycaster r128 nie pomija niewidocznych). Współdzielony przez gałąź Sol i interstellar.
function pickGalaxyScreen(clientX, clientY){
  if(!galaxies.length) return null;
  const halfH = Math.tan(camera.fov * Math.PI / 360);       // tan(½ FOV)
  const off = galaxyGroup ? galaxyGroup.position : null;    // w interstellar kopuła jest zakotwiczona do kamery
  let best = null, bestD = Infinity, bestPos = null;
  for(const g of galaxies){
    _galW.copy(g.center); if(off) _galW.add(off);           // świat = center + offset grupy (spójne z renderem; w Sol off=0)
    const dist = camera.position.distanceTo(_galW);
    _galV.copy(_galW).project(camera);
    if(_galV.z > 1) continue;                               // za kamerą / za far-plane
    const sx = (_galV.x*0.5 + 0.5)*innerWidth, sy = (-_galV.y*0.5 + 0.5)*innerHeight;
    const d = Math.hypot(sx - clientX, sy - clientY);
    const rpx = Math.max(26, (g.size / (dist * halfH)) * (innerHeight * 0.5));   // ekranowy promień galaktyki
    if(d < rpx && d < bestD){ best = g; bestD = d; bestPos = _galW.clone(); }
  }
  if(best) return { kind:'galaxy', name:best.nm, color:colCss(best.colBulge), worldPos:bestPos,
    wiki:best.wiki, facts:best.facts, ref:{ id:best.id }, occluded:false, dCursor:bestD };
  return null;
}

function pickAt(clientX, clientY){
  mouse.x=(clientX/innerWidth)*2-1; mouse.y=-(clientY/innerHeight)*2+1;
  ray.setFromCamera(mouse, camera);

  // God-view zewnętrznej galaktyki (E): picking WYŁĄCZNIE ekranowy po markerze powrotu + landmarkach.
  // return BEZ fall-through — jak galactic (D); raycaster r128 trafiałby UKRYTE Słońce Sol w origin.
  // Landmark z sprite.visible=false (LOD lub poza kadrem) jest nieklikalny (filter `continue`).
  if(cosmos.scale === 'exgalaxy'){
    const g = gxCache[cosmos.galaxyId];
    if(!g || !g.group.visible) return null;
    let best = null, bestD = Infinity;
    const consider = (pxR, pos, mk)=>{
      _galV.copy(pos).project(camera); if(_galV.z > 1) return;
      const sx=(_galV.x*0.5+0.5)*innerWidth, sy=(-_galV.y*0.5+0.5)*innerHeight;
      const d=Math.hypot(sx-clientX, sy-clientY); if(d<pxR && d<bestD){ bestD=d; best=mk(); }
    };
    if(g.returnMarker) consider(22, g.returnMarker.position,
      ()=>({ kind:'gxreturn', name:'‹ Powrót', color:'#cfe0ff', worldPos:g.returnMarker.position.clone(), wiki:null, facts:null, occluded:false }));
    for(const lm of g.landmarks){ if(!lm.sprite.visible) continue;
      consider(16, lm.pos, ()=>({ kind:'gxlandmark', name:lm.name, color:colCss(lm.colHex), worldPos:lm.pos.clone(),
        wiki:lm.wiki||null, facts:lm.facts||null, ref:{lmKind:lm.kind}, occluded:false })); }
    return best;   // null = pustka; BEZ fall-through (ukryte Słońce Sol w origin)
  }

  // Skala galaktyczna (D): picking WYŁĄCZNIE ekranowy po warstwach D (marker Słońca → obiekty →
  // anchory struktury), zakończony returnem — BEZ fall-through do ścieżki Sol (raycaster r128
  // trafiałby UKRYTE Słońce/satelity w origin = dokładnie pod markerem Słońca; lekcja alien-C).
  // pickGalaxyScreen celowo NIE jest wołany (niezależny od visible — kopuła ukryta ≠ nieklikalna).
  if(cosmos.scale === 'galactic'){
    if(!mw.group || !mw.group.visible) return null;
    let best = null, bestD = Infinity;
    const consider = (pxRadius, pos, mk)=>{
      _galV.copy(pos).project(camera);
      if(_galV.z > 1) return;                                            // za kamerą / za far-plane
      const sx = (_galV.x*0.5 + 0.5)*innerWidth, sy = (-_galV.y*0.5 + 0.5)*innerHeight;
      const dpx = Math.hypot(sx - clientX, sy - clientY);
      if(dpx < pxRadius && dpx < bestD){ bestD = dpx; best = mk(); }
    };
    consider(24, ZERO3, ()=>({ kind:'mwsun', name:'Słońce (tu jesteś)', color:'#fff2cc',
      worldPos:new THREE.Vector3(0,0,0), wiki:{lang:'pl',title:'Słońce'},
      facts:{ 'Pozycja': (MILKY_WAY.sun.arm||'Ramię Oriona') + ' · ' +
              Math.round(MILKY_WAY.sun.distFromCenterLy).toLocaleString('pl-PL') + ' ly od centrum' },
      ref:{sun:true}, occluded:false }));
    for(const o of mw.objects){
      if(!o.sprite.visible) continue;                                    // LOD §8: ukryte = nieklikalne
      consider(16, o.pos, ()=> mwObjDesc(o));
    }
    for(const a of mw.anchors){
      consider(20, a.pos, ()=> mwFeatDesc(a));
    }
    return best;                                                         // null = pustka (deselect w pointerup)
  }

  // Skala interstellar: układy gwiazdowe (priorytet, centroid ekranowy) LUB odległe galaktyki tła.
  // Sol ukryty → nie raycastujemy ciał (raycaster r128 nie pomija `visible=false`); oba pickingi są
  // czysto ekranowe. Klik galaktyki w interstellar → uczciwy komunikat dystansu (pointerup), nie nawigacja.
  if(cosmos.scale === 'interstellar'){
    let best = null, bestD = 18;   // px, jak galaxy centroid
    for(const s of SYSTEMS){
      if(!s._scenePos) continue;
      const sp = s._scenePos.clone().project(camera);
      if(sp.z > 1) continue;                                   // za kamerą
      const x = (sp.x*0.5 + 0.5)*innerWidth, y = (-sp.y*0.5 + 0.5)*innerHeight;
      const dpx = Math.hypot(x - clientX, y - clientY);
      if(dpx < bestD){ bestD = dpx; best = s; }
    }
    // Galaktyka (tło) też może być pod kursorem — Sol siedzi w origin=centrum ekranu, więc bez tego
    // „kradłby" każdą galaktykę za sobą. Wybierz BLIŻSZY kursora; remis → galaktyka (Sol i tak osiągalny
    // breadcrumbem/zoomem, galaktyka tylko klikiem).
    const gal = pickGalaxyScreen(clientX, clientY);
    if(best && (!gal || bestD < gal.dCursor)) return { kind:'starsystem', name:best.name, color:colCss(0xffe4b5),
      worldPos:best._scenePos.clone(), wiki:best.wiki||null, facts:starFacts(best), ref:{id:best.id}, occluded:false };
    return gal;   // galaktyka bliżej kursora (lub brak układu) → galaktyka / null
  }

  // Obcy układ (C): picking TYLKO ciał obcego układu (gwiazda + planety). Bez tej gałęzi Sol-path
  // raycastuje UKRYTE (visible=false, ale wciąż trafialne w r128) Słońce Sol w origin → „Słońce"
  // pod kursorem wszędzie w centrum kadru.
  if(cosmos.scale === 'system' && cosmos.systemId !== 'sol'){
    const sys = SYSTEMS.find(s=>s.id===cosmos.systemId);
    const meshes = [];
    if(alienStar) meshes.push(alienStar);
    for(const b of alienBodies){ if(b.mesh) meshes.push(b.mesh); }
    const h = meshes.length ? ray.intersectObjects(meshes, false)[0] : null;
    if(h){
      const o = h.object;
      if(o === alienStar) return { kind:'alienstar', name:(sys&&sys.name)||'Gwiazda', color:colCss(0xffe4b5),
        worldPos:o.getWorldPosition(new THREE.Vector3()), wiki:(sys&&sys.wiki)||null, facts:sys?starFacts(sys):null, ref:{id:cosmos.systemId}, occluded:false };
      const idx = alienBodies.findIndex(b=>b.mesh===o);
      if(idx>=0){ const pl = alienBodies[idx].data;
        return { kind:'alienplanet', name:pl.name, color:colCss(0xcfe0ff), worldPos:o.getWorldPosition(new THREE.Vector3()),
          wiki:pl.wiki||null, facts:alienPlanetFacts(pl), ref:{idx}, occluded:false }; }
    }
    // Towarzysze pary: mesh bywa punktowy w kadrze dolotu → picking EKRANOWY (wzorzec gałęzi B).
    // Konwencja repo: każde renderowane ciało jest pickowalne (finding #5 — hover/klik/menu były martwe).
    let bestC = null, bestD = 14;
    for(const b of alienCompanions){
      const sp = b.mesh.getWorldPosition(new THREE.Vector3()).project(camera);
      if(sp.z > 1) continue;
      const x = (sp.x*0.5 + 0.5)*innerWidth, y = (-sp.y*0.5 + 0.5)*innerHeight;
      const d = Math.hypot(x - clientX, y - clientY);
      if(d < bestD){ bestD = d; bestC = b; }
    }
    if(bestC) return { kind:'aliencompanion', name:bestC.name, color:colCss(bestC.colHex),
      worldPos:bestC.mesh.getWorldPosition(new THREE.Vector3()), wiki:null,
      facts:binaryFacts(bestC.raw), ref:{ companion:bestC }, occluded:false };
    return null;
  }

  // 0) statek (lot) — najwyższy priorytet pickingu, póki trwa lot
  if(flight.active && ship.mesh && ship.mesh.visible){
    const h = ray.intersectObject(ship.mesh, true)[0];
    if(h) return { kind:'ship', name:'Statek', color:'#9fc0ff', worldPos:ship.mesh.getWorldPosition(new THREE.Vector3()),
      wiki:null, facts:null, ref:{ship:true}, occluded:false };
  }

  // 1) satelity (chmura punktów SGP4)
  if(sats.active){ const s=satPick(ray); if(s){ const wp=satWorldPos(s.idx, new THREE.Vector3());
    const nm=(s.name||'').trim();
    return { kind:'sat', name:nm, color:'#9fe6ff', worldPos:wp,
      wiki:satAlias(nm), facts:null, ref:{idx:s.idx, satrec:(sats.satrecs&&sats.satrecs[s.idx])||null}, occluded:satOccluded(wp) }; } }

  // 2) geo (miasta/rzeki/góry) — gdy geoActive (tEdu lub auto-zbliżenie do Ziemi)
  if(geoActive && eduLabels.length){
    const dir=pickEarthDir(ray);
    if(dir){
      const e=bodies.find(b=>b.data.earth);
      const notSea = Lx => Lx.cat!=='Morze / ocean';
      // 1) feature ekranowy (miasto/góra/jezioro/rzeka — BEZ mórz; te po PIP)
      const L=nearestLabelScreen(dir, clientX, clientY, notSea);
      if(L){ const wp=new THREE.Vector3().copy(L.pos); e.mesh.localToWorld(wp);
        return { kind:'geo', name:L.name, color:L.color, worldPos:wp,
          wiki:null, facts:null, ref:{label:L}, occluded:false }; }
      // 2) pasmo górskie (PIP) — bardziej szczegółowe niż państwo (klik w Bieszczadach → Bieszczady, nie Polska)
      const ll=CountryPick.lonLatFromDir(dir);
      const mr=mountainsData && CountryPick.countryAt(ll.lon, ll.lat, mountainsData);
      if(mr){ const wp=new THREE.Vector3().copy(dir).multiplyScalar(e.data.radius); e.mesh.localToWorld(wp);
        return { kind:'geo', name:mr.name, color:'#e0b070', worldPos:wp,
          wiki:{lang:'pl',title:mr.name}, facts:null, ref:{range:mr}, occluded:false }; }
      // 3) państwo (point-in-polygon po lon/lat)
      const c=countriesData && CountryPick.countryAt(ll.lon, ll.lat, countriesData);
      if(c){ const wp=new THREE.Vector3().copy(dir).multiplyScalar(e.data.radius); e.mesh.localToWorld(wp);
        return { kind:'geo', name:c.name, color:'#ffd27a', worldPos:wp,
          wiki:{lang:'pl',title:c.name}, facts:null, ref:{country:c}, occluded:false }; }
      // 3) morze/ocean — dopiero gdy NIE ma państwa (kursor faktycznie nad wodą)
      const S=nearestLabelScreen(dir, clientX, clientY, Lx=>Lx.cat==='Morze / ocean');
      if(S){ const wp=new THREE.Vector3().copy(S.pos); e.mesh.localToWorld(wp);
        return { kind:'geo', name:S.name, color:S.color, worldPos:wp,
          wiki:null, facts:null, ref:{label:S}, occluded:false }; }
      // 4) pusto → deselect przy kliknięciu
      return { kind:'geo', name:null, color:'#ffffff', worldPos:null, wiki:null, facts:null, ref:{empty:true}, occluded:false };
    }
  }

  // 3) księżyce / planety / Słońce
  const moonMeshes = bodies.flatMap(b=>(b.data._moons||[]).map(m=>m.mesh));
  const bodyHit = ray.intersectObjects(bodies.map(b=>b.mesh).concat(moonMeshes).concat([sun]), false)[0];
  if(bodyHit){
    const o=bodyHit.object;
    if(o===sun) return { kind:'sun', name:'Słońce', color:'#ffcf7a',
      worldPos:sun.getWorldPosition(new THREE.Vector3()), wiki:SUN_INFO.wiki, facts:SUN_INFO.facts, ref:{sun:true}, occluded:false };
    const ud=o.userData;
    if(ud && ud.moonParent!==undefined){
      const pb=bodies.find(b=>b.data.id===ud.moonParent); const fm=pb.data._moons[ud.moonIdx]; const mn=fm.data;
      return { kind:'moon', name:mn.n, color:colCss(mn.color||0xcfd3da), worldPos:o.getWorldPosition(new THREE.Vector3()),
        wiki:mn.wiki||null, facts:{Rodzic:pb.data.pl,'Okres orbitalny':MoonFormat.fmtPeriod(mn.days),'Średnica':MoonFormat.fmtKm(mn.km)},
        ref:{planetId:ud.moonParent, idx:ud.moonIdx}, occluded:false };
    }
    const p=bodies.find(b=>b.mesh===o).data;
    return { kind:'planet', name:p.pl, color:colCss(p.color), worldPos:o.getWorldPosition(new THREE.Vector3()),
      wiki:p.wiki||null, facts:p.facts, ref:{id:p.id}, occluded:false };
  }

  // 4) komety
  if(reality.active && reality.cometMarkers.length){
    const h=ray.intersectObjects(reality.cometMarkers,true)[0];   // rekurencyjnie: koma to dziecko jądra (ogony mają wyłączony raycast)
    if(h){ let o=h.object; while(o && o.userData.cometId===undefined) o=o.parent;   // walk-up do węzła z cometId
      const c=o && COMETS.find(x=>x.id===o.userData.cometId);
      if(c) return { kind:'comet', name:c.pl, color:colCss(c.color), worldPos:o.getWorldPosition(new THREE.Vector3()),
        wiki:c.wiki||null, facts:c.facts, ref:{id:c.id}, occluded:false }; }
  }

  // 5) sondy (markery; po Fazie 2 grupy modeli → intersect rekurencyjny)
  if(probes.active && probes.markers.length){
    const h=ray.intersectObjects(probes.markers,true)[0];
    if(h){ let o=h.object; while(o && o.userData.probeId===undefined) o=o.parent;
      const id=o&&o.userData.probeId; const p=PROBES.find(x=>x.id===id);
      if(p) return { kind:'probe', name:p.name, color:colCss(p.color), worldPos:(o.getWorldPosition(new THREE.Vector3())),
        wiki:p.wiki||null, facts:probeFacts(p, probeClockMs()), ref:{id:p.id}, occluded:false }; }
  }

  // 6) planetoidy (InstancedMesh) — pozycja z getMatrixAt × matrixWorld (pas się obraca!)
  if(beltMesh.visible){
    const bh=ray.intersectObject(beltMesh, false)[0];
    if(bh && bh.instanceId!=null){ beltMesh.getMatrixAt(bh.instanceId, _pmBelt);
      _pmPos.setFromMatrixPosition(_pmBelt).applyMatrix4(beltGroup.matrixWorld);
      return { kind:'asteroid', name:'Planetoida (pas główny)', color:'#b9ad9c', worldPos:_pmPos.clone(),
        wiki:{lang:'pl',title:'Pas planetoid'}, facts:null, ref:{instanceId:bh.instanceId}, occluded:false }; }
  }

  // 6.5) galaktyki (tło — centroid ekranowy; picking wyłączony w locie, render zawsze — spec §5)
  if(!flight.active){ const g = pickGalaxyScreen(clientX, clientY); if(g) return g; }

  // 7) gwiazdy asteryzmów (tło — tylko gdy warstwa włączona) — agregacja min-distance po widocznych itemach
  if(asterism.on && asterism.root){
    const camD = camera.position.length();
    ray.params.Points.threshold = Math.max(8, camD*0.01);
    let best = null;                                    // {dist, item, index}
    for(const it of asterism.items){
      if(!it.visible) continue;
      const h = ray.intersectObject(it.pts, false)[0];
      if(h && h.index!=null && (!best || h.distance < best.dist)) best = { dist:h.distance, item:it, index:h.index };
    }
    ray.params.Points.threshold = 0;                    // reset po pętli (nie wyciekać do starfieldu)
    if(best){
      const meta = best.item.starMeta[best.index];
      const wp = new THREE.Vector3().fromBufferAttribute(best.item.pts.geometry.attributes.position, best.index);
      return { kind:'star', name:(meta.star||meta.asterism), color:'#cfe0ff', worldPos:wp,
        wiki:meta.wiki||null, facts:{Asteryzm:meta.asterism}, ref:{asterism:meta.asterism}, occluded:false };
    }
  }
  return null;
}
// hover: wskazanie myszą dowolnego obiektu → miękka poświata (addytywna) + nazwa przy kursorze
renderer.domElement.addEventListener('pointermove', e=>{
  if(_handleDrag){
    const refs = handleScreenRefs(_handleDrag.handle);
    if(refs){
      const t = NodeHandle.dvScalarFromScreen(refs.S0, refs.S1, { x:e.clientX, y:e.clientY });
      if(t != null){                                             // null = degeneracja osi → pomiń (zachowaj ostatnią)
        const h = _handleDrag.handle, tc = NodeHandle.clampHandle(t - _handleDrag.grab), w = selN();
        if(w){ w.pnr[h.axis] = h.sign * tc * 1000;               // km/s → m/s (granica jednostek, glue)
          syncManeuverSlider(h.axis); updateManeuverHud(); schedulePredict(); updateNodeGizmo(); }
      }
    }
    return;                                                      // drag uchwytu pochłania ruch (bez hover/throttle)
  }
  if(_nodeDrag){ const b = selBase(); const nu = dragNuFromCursor(e.clientX, e.clientY), w = selN();
    if(nu!=null && w){ const tNow=flight.clockMs/1000;
      let t = ManeuverNode.nodeTimeForNu(b.coe, nu, tNow);       // czas na orbicie tuż-przed-burnem (selNode>0 → preCoe)
      if(t!=null){ w.t = NodeChain.validNodeTime(ship.nodes, ship.selNode, t, tNow, 1); updateNodeMarker(); schedulePredict(); } }   // clamp do okna sąsiadów (monotonia)
    return; }                                                    // drag węzła pochłania ruch (bez hover, bez throttle)
  const now=performance.now(); if(now-_hoverT < 40) return; _hoverT=now;   // throttling
  const o=pickAt(e.clientX, e.clientY);
  // okluzja/pusto: schowaj poświatę i etykietę
  if(!o || o.occluded || !o.worldPos || o.name==null){ hideGlow(); if(hoverLbl) hoverLbl.style.display='none'; return; }
  const isPoint = (o.kind==='sat' || o.kind==='asteroid' || o.kind==='star');  // galaktyka NIE jest punktem → duża aureola (poprawne dla obiektu rozciągłego)
  showGlow(o.worldPos, o.color, isPoint);
  // etykieta przy kursorze
  showHoverName(o.name, o.color, e.clientX, e.clientY);
});
renderer.domElement.addEventListener('pointerup', e=>{
  if(cosmos.transitioning){ downXY=null; return; }               // reveal w toku → wejście zablokowane (fix T4)
  if(_handleDrag){ endHandleDrag(); downXY=null; return; }       // gest uchwytu nie jest klikiem-focusem
  if(_nodeDrag){ endNodeDrag(); downXY=null; return; }           // gest węzła nie jest klikiem-focusem
  if(!downXY) return;
  const moved = Math.hypot(e.clientX-downXY[0], e.clientY-downXY[1]);
  downXY=null;
  if(moved>6) return;                       // drag, nie klik
  const o = pickAt(e.clientX, e.clientY);
  if(!o || o.kind!=='star') deselectConstellation();   // klik w pustkę / inny obiekt → zdejmij wybór konstelacji
  if(!o){ _tapArm = null; return; }
  if(o.kind !== 'starsystem') _tapArm = null;          // tap w coś innego rozbraja dwustopniowy dolot (touch)
  Selectables.select(KINDS, o, { e });                  // akcja z rejestru KINDS (rodzaj spoza rejestru → głośny błąd)
});
// hover cursor — tani raycast ciał (bez satelitów/pasa), wystarczający do zmiany kursora
renderer.domElement.addEventListener('pointermove', e=>{
  if(_handleDrag || _nodeDrag){ renderer.domElement.style.cursor='grabbing'; return; }
  if(flight.active && hasSel() && nodeHandleRayHit(e.clientX, e.clientY)){ renderer.domElement.style.cursor='grab'; return; }   // afordancja uchwytu
  mouse.x=(e.clientX/innerWidth)*2-1; mouse.y=-(e.clientY/innerHeight)*2+1;
  ray.setFromCamera(mouse, camera);
  // cele wg skali: Sol → ciała Sol + Słońce; obcy układ (C) → ciała obce (NIE ukryte Słońce Sol,
  // które inaczej dawałoby kursor „pointer" wszędzie); interstellar → picking ekranowy, bez hintu.
  let targets;
  if(cosmos.scale==='system' && cosmos.systemId==='sol'){
    const moonMeshes = bodies.flatMap(b=>(b.data._moons||[]).map(m=>m.mesh));
    targets = bodies.map(b=>b.mesh).concat(moonMeshes).concat([sun]);
  } else if(cosmos.scale==='system'){
    targets = (alienStar?[alienStar]:[]).concat(alienBodies.map(b=>b.mesh).filter(Boolean));
  } else targets = [];
  let hit = targets.length ? ray.intersectObjects(targets,false)[0] : null;
  // towarzysze: punktowy mesh nie łapie taniego raycastu — hint ekranowy (spójny z gałęzią C pickAt)
  if(!hit && cosmos.scale==='system' && cosmos.systemId!=='sol' && alienCompanions.length){
    for(const b of alienCompanions){
      const sp = b.mesh.getWorldPosition(tmpV).project(camera);
      if(sp.z<=1 && Math.hypot((sp.x*0.5+0.5)*innerWidth-e.clientX, (-sp.y*0.5+0.5)*innerHeight-e.clientY) < 14){ hit=b; break; }
    }
  }
  renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
});
window.addEventListener('pointerup', ()=>{ if(_nodeDrag) endNodeDrag(); if(_handleDrag) endHandleDrag(); });
window.addEventListener('pointercancel', ()=>{ if(_nodeDrag) endNodeDrag(); if(_handleDrag) endHandleDrag(); });
renderer.domElement.addEventListener('lostpointercapture', ()=>{ if(_nodeDrag) endNodeDrag(); if(_handleDrag) endHandleDrag(); });

/* ============================================================
   Menu kontekstowe (prawy przycisk)
   ============================================================ */
const ctxMenuEl=document.getElementById('ctxMenu');
function closeContextMenu(){ ctxMenuEl.classList.remove('show'); }
function openContextMenu(x, y, obj){
  ctxMenuEl.textContent='';                              // wyczyść bez innerHTML
  const head=document.createElement('div'); head.className='ctx-head';
  head.textContent=obj.name||'Obiekt';
  const btn=document.createElement('button'); btn.className='ctx-item'; btn.id='ctxInfo';
  btn.textContent='ℹ Informacje';
  ctxMenuEl.appendChild(head); ctxMenuEl.appendChild(btn);
  ctxMenuEl.style.left = Math.min(x, innerWidth-180)+'px';
  ctxMenuEl.style.top  = Math.min(y, innerHeight-90)+'px';
  ctxMenuEl.classList.add('show');
  btn.onclick=()=>{ closeContextMenu();
    if(typeof openInfoModal==='function') openInfoModal(obj); };
}
renderer.domElement.addEventListener('contextmenu', e=>{
  e.preventDefault();
  const o=pickAt(e.clientX, e.clientY);
  if(!o || o.name==null){ closeContextMenu(); return; }   // pusto → brak menu
  openContextMenu(e.clientX, e.clientY, o);
});
// zamknięcia
addEventListener('pointerdown', e=>{ if(!ctxMenuEl.contains(e.target)) closeContextMenu(); }, true);
renderer.domElement.addEventListener('wheel', ()=>{ if(cosmos.transitioning) return; closeContextMenu(); }, {passive:true});
addEventListener('keydown', e=>{ if(e.key==='Escape') closeContextMenu(); });

/* ============================================================
   Modal „Informacje"
   ============================================================ */
const omEl=document.getElementById('objModal');
function closeInfoModal(){ omEl.classList.remove('show'); deselectConstellation(); }
function omBuildStats(facts){
  if(!facts) return;
  const grid=document.getElementById('omStats');
  Object.entries(facts).forEach(([k,v])=>{
    const div=document.createElement('div'); div.className='stat';
    const l=document.createElement('div'); l.className='l'; l.textContent=k;
    const vEl=document.createElement('div'); vEl.className='v'; vEl.textContent=v;
    div.appendChild(l); div.appendChild(vEl);
    grid.appendChild(div);
  });
}
// zwraca Promise<{extract,thumbnail,url}|null> z fallbackiem pl→en
function fetchWikiSummary(wiki){
  const tryLang=(lang,title)=> fetch(WikiInfo.summaryUrl(lang,title))
    .then(r=>r.ok?r.json():null).then(j=>WikiInfo.acceptSummary(j)).catch(()=>null);
  return tryLang(wiki.lang, wiki.title)
    .then(x=> x || (wiki.lang==='pl' ? tryLang('en', wiki.title) : null));
}
function openInfoModal(obj){
  closeContextMenu();
  document.getElementById('omEye').textContent = Selectables.label(KINDS, obj.kind);
  document.getElementById('omName').textContent = obj.name || 'Obiekt';
  const thumb=document.getElementById('omThumb'); thumb.hidden=true; thumb.src='';
  const extract=document.getElementById('omExtract'); extract.textContent='';
  const stats=document.getElementById('omStats'); stats.textContent='';
  omBuildStats(obj.facts);
  const link=document.getElementById('omLink'); link.hidden=true;
  omEl.classList.add('show');
  if(obj.wiki){
    extract.textContent='Ładowanie opisu z Wikipedii…';
    link.hidden=false; link.textContent='Czytaj więcej na Wikipedii →';
    link.href=WikiInfo.pageUrl(obj.wiki.lang, obj.wiki.title);
    const reqFor=obj;                                   // ochrona przed wyścigiem
    fetchWikiSummary(obj.wiki).then(res=>{
      if(!omEl.classList.contains('show') || document.getElementById('omName').textContent!==(reqFor.name||'Obiekt')) return;
      if(res){ extract.textContent=res.extract;
        if(res.url) link.href=res.url;
        if(res.thumbnail){ thumb.src=res.thumbnail; thumb.hidden=false; } }
      else extract.textContent='Brak opisu w Wikipedii — otwórz link poniżej.';
    });
  } else if(obj.kind==='sat' && obj.ref && obj.ref.satrec){
    const facts = SatInfo.satTechFacts(obj.ref.satrec);
    stats.textContent=''; omBuildStats(facts);
    extract.textContent='Satelita z katalogu orbitalnego — parametry policzone z TLE (model SGP4).';
    link.hidden=false; link.textContent='Pełna karta satelity → N2YO ↗';
    link.href=WikiInfo.catalogUrl(obj.ref.satrec.satnum);
  } else {
    // lokalne fakty (jeśli są) lub komunikat
    extract.textContent = obj.facts ? '' : 'Brak opisu encyklopedycznego dla tego obiektu.';
  }
}
// zamknięcia
omEl.querySelector('.modal-x').onclick=closeInfoModal;
omEl.querySelector('.modal-backdrop').onclick=closeInfoModal;
addEventListener('keydown', e=>{ if(e.key==='Escape') closeInfoModal(); });

/* ============================================================
   Animation loop
   ============================================================ */
const clock = new THREE.Clock();
const sunDirTmp = new THREE.Vector3();
// temp-wektory scenicznego oświetlenia księżyców (zaćmienie w cieniu planety + planetshine)
const _ppos = new THREE.Vector3(), _eclAxis = new THREE.Vector3(), _eclMp = new THREE.Vector3();
// temp-wektory orientacji ogonów komet (anty-słoneczna oś + odchylenie pyłu)
const cometAnti = new THREE.Vector3(), cometTang = new THREE.Vector3(), cometAxis = new THREE.Vector3();
const COMET_DOWN = new THREE.Vector3(0,-1,0), SCENE_UP = new THREE.Vector3(0,1,0);

function tickTween(now){
  if(!tween) return;
  const k = Math.min((now - tween.t0)/tween.dur, 1), e = easeInOut(k);
  camera.position.lerpVectors(tween.fromP, tween.toP, e);
  controls.target.lerpVectors(tween.fromT, tween.toT, e);
  if(k>=1){
    tween=null; controls.enabled=true;
    if(focused){ const b=bodies.find(x=>x.data===focused); prevTarget.copy(worldPos(b)); }
    else if(focusedMoon){ prevTarget.copy(moonWorldPos(focusedMoon)); }
    else if(focusedShip && ship.mesh){ prevTarget.copy(ship.mesh.getWorldPosition(_shipWP)); }
  }
}

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // === Kosmiczny zoom: gate skali ===
  // Gdy NIE jesteśmy w Układzie Słonecznym (interstellar lub obcy układ) — render osobną ścieżką.
  // Gałąź pasywna 1:1 poniżej (Rzeczywistość/lot) uruchamia się WYŁĄCZNIE dla (system + sol) → bit-w-bit.
  if(!(cosmos.scale==='system' && cosmos.systemId==='sol')){
    animateCosmos(dt);
    controls.update();                       // PRZED rzutem etykiet — inaczej etykiety rzutowane kamerą sprzed damping = lag o klatkę („pływanie")
    // Kopuła galaktyk = tło „w nieskończoności": w interstellar podąża za kamerą (stały dist=GALAXY_R →
    // wszystkie galaktyki widoczne/klikalne i w zasięgu far-plane; bez tego kadr klastra zostawia je poza
    // ekranem albo — po obrocie „na wprost" — za far-plane). W obcym układzie (C) origin, jak w Sol.
    if(galaxyGroup) galaxyGroup.position.copy(cosmos.scale==='interstellar' ? camera.position : ZERO3);
    applyDomeGalaxyScale(cosmos.scale==='interstellar' ? DOME_GAL_BOOST_B : 1);   // wiry czytelne w B; 1× indziej
    updateCosmosLabels();                     // rzut etykiet TĄ SAMĄ kamerą co render → brak pływania
    renderer.render(scene, camera);
    return;
  }
  // W Układzie: próg zoom-out → wejście w interstellar (histereza; nie w locie/tweenie/przejściu).
  // Dystans od CELU kamery, nie od Słońca: focus na Voyagerze 1 (~8000 j. od Słońca) wyrzucał do B (2026-11).
  if(!cosmos.transitioning && !flight.active && !tween &&
     CosmoScale.nextScale(camera.position.distanceTo(controls.target), 'system', COSMO_ENTER, COSMO_EXIT) === 'interstellar'){
    enterInterstellar();
  }

  bodies.forEach(b=>{
    const p=b.data;
    // update Earth shader sun direction (world space)
    if(p.earth){
      const wp = worldPos(b);
      sunDirTmp.copy(sun.position).sub(wp).normalize();
      const dCam = camera.position.distanceTo(wp), rr = effRadius(p);
      _nearEarth = dCam < rr * GEO_NEAR_MUL;                 // bliskość Ziemi → auto-aktywacja geo
      setGeoActive(eduOn || (_nearEarth && !kino.active));   // SSOT geoActive (override eduOn || auto-nearEarth; w filmie bez auto-budzenia — przestój przy 1. najeździe)
      const reliefVal = reliefOn ? THREE.MathUtils.clamp((rr*8 - dCam)/(rr*6), 0, 1) : 0;
      const approach = EarthFX.approachT(dCam, rr);                 // 0 z daleka → 1 blisko (niezależne od reliefOn)
      const tNow = performance.now() * 0.001;
      // zaktualizuj WSZYSTKIE aktywne materiały Ziemi (powierzchnia + chmury + atmosfera) — guard po istnieniu uniformu
      const eMats = [b.mesh.material, p._clouds && p._clouds.material, p._atmo && p._atmo.material];
      for(let i=0;i<eMats.length;i++){ const u = eMats[i] && eMats[i].uniforms; if(!u) continue;
        if(u.sunDir) u.sunDir.value.copy(sunDirTmp);
        if(u.relief) u.relief.value = reliefVal;
        if(u.uApproach) u.uApproach.value = approach;
        if(u.uTime) u.uTime.value = tNow;
      }
    } else if(b.mesh.material.uniforms && b.mesh.material.uniforms.uMode !== undefined){   // fantastyczny shader planety
      const wp = worldPos(b);
      b.mesh.material.uniforms.sunDir.value.copy(sunDirTmp.copy(sun.position).sub(wp).normalize());
      b.mesh.material.uniforms.uTime.value = performance.now() * 0.001;
    }
  });

  if(reality.active || flight.active){
    const inFlight = flight.active;
    let dtScene, clockMs;
    if(inFlight){
      const wc = FlightCore.warpCapInputs(ship);
      const tNodeRel = ship.nodes.length ? (ship.nodes[0].t - flight.clockMs/1000) : Infinity;   // warp-do-węzła celuje CZOŁOWY (nodes[0])
      const effTtp = ManeuverNode.effFeatureTime(wc.timeToPeri, tNodeRel, !!flight._warpToNode);   // węzeł zawęża cap tylko gdy uzbrojone
      const effWarp = ship.coe ? SoiEvents.adaptiveWarpCap(wc.distToSOI, wc.speedRel, effTtp, dt, flight.warp) : flight.warp;
      if(flight._warpToNode && tNodeRel < 0.5){ flight.warpIdx = 0; flight._warpToNode = false; updateWarpHud(); refreshNodeButtons(); }   // dotarł (lub minął) → snap ×1, rozbroj (refreshNodeButtons zdejmie .on)
      flight._effWarp = effWarp;                                                  // dla HUD (czy ścięty); pin ×1 wejdzie w następnej klatce po snapie warpIdx=0
      dtScene = dt * CLOCK_SCALE * effWarp;                                       // efektywny warp (≤ żądany)
      flight.clockMs += dtScene * 1000; clockMs = flight.clockMs;
    }
    else        { dtScene = dt * CLOCK_SCALE;               reality.clockMs += dtScene * 1000; clockMs = reality.clockMs; }
    const flowT = performance.now() * 0.001;                 // zegar wizualizacji [s]
    for(let i=0;i<flowOrbitMats.length;i++) flowOrbitMats[i].uniforms.uTime.value = flowT;
    const jdNow = Ephemeris.julianDate(clockMs);
    const sceneHours = dtScene / 3600;
    // §4.5 — pod warpem przesuwaj planety i komety na pozycje analityczne dla jdNow,
    // żeby orbita statku (live ephemeris) i przejścia SOI nie rozjechały się z meshami.
    // TYLKO w locie (inFlight) — pasywny render zostaje BIT-W-BIT (przy warp=1 pozycje
    // analityczne = startReality; planety i tak ledwo drgają w czasie rzeczywistym).
    if(inFlight){
      bodies.forEach(b=>{
        const el = Ephemeris.REAL_PLANETS.find(p=>p.id===b.data.id);
        if(el) b.group.position.copy(eclToScene(Ephemeris.positionAt(el, jdNow)));
      });
      reality.cometMarkers.forEach(mk=>{
        const c = COMETS.find(x=>x.id===mk.userData.cometId);
        if(c) mk.position.copy(eclToScene(Ephemeris.positionAt(c, jdNow)));
      });
      if(trueDots && trueDots.visible) trueDots.geometry.setFromPoints(bodies.map(worldPos));   // białe markery planet też pod warpem
    }
    bodies.forEach(b=>{
      if(b.data.id === 'earth'){
        // Ziemia: obróć tak, by długość lokalnego południa (z UTC) ORAZ szerokość podsłoneczna
        // (deklinacja Słońca, z nachylenia osi) zgadzały się z rzeczywistością — poprawny
        // terminator dzień/noc i pory roku. Doba słoneczna ≈ 24 h.
        const wp = worldPos(b);
        const eps = b.data.tilt * Math.PI/180;                    // nachylenie osi (oś ku +Z)
        // kierunek Ziemia→Słońce skorygowany o nachylenie osi (Rx(−eps)):
        const sx = sun.position.x - wp.x, sy = sun.position.y - wp.y, sz = sun.position.z - wp.z;
        const szA = -sy*Math.sin(eps) + sz*Math.cos(eps);
        const phiSun = Math.atan2(szA, sx);
        const d = new Date(kino.earthMs || clockMs);                // film „Mrugnięcie” obraca Ziemię zegarem filmu
        const utcH = d.getUTCHours() + d.getUTCMinutes()/60 + d.getUTCSeconds()/3600;
        const subSolarLon = (15 * (12 - utcH)) * Math.PI/180;     // długość podsłoneczna (E, rad)
        b.mesh.rotation.y = -subSolarLon - phiSun;
      } else {
        // pozostałe planety: realny okres rotacji (faza poglądowa — tekstury nie są kalibrowane)
        b.mesh.rotation.y = Ephemeris.rotationPhase(b.data.rotH, jdNow);
      }
      // księżyce krążą w tempie rzeczywistym (znak m.days = kierunek)
      if(b.data._moons) b.data._moons.forEach(m=>{
        m.pivot.rotation.y += (2*Math.PI / (m.days*24)) * sceneHours;
        const mat = m.mesh.material;
        if(mat && mat.uniforms && mat.uniforms.sunDir){                 // każdy księżyc ma teraz ShaderMaterial (też Księżyc Ziemi)
          m.mesh.getWorldPosition(tmpV);
          mat.uniforms.sunDir.value.copy(sunDirTmp.copy(sun.position).sub(tmpV).normalize());
          mat.uniforms.uTime.value = flowT;                             // wspólny zegar wizualizacji (puls lawy Io) — mała skala, bez zamrożenia float
          // sceniczne oświetlenie: zaćmienie w cieniu planety-rodzica + planetshine
          if(mat.uniforms.uEclipse){
            b.mesh.getWorldPosition(_ppos);                             // pozycja planety-rodzica
            _eclAxis.copy(_ppos).sub(sun.position).normalize();         // oś cienia: Słońce→planeta
            _eclMp.copy(tmpV).sub(_ppos);                               // planeta→księżyc
            const along = _eclMp.dot(_eclAxis);                         // >0: księżyc za planetą (po ciemnej stronie)
            let ecl = 0;
            if(along > 0){
              const perp = Math.sqrt(Math.max(_eclMp.lengthSq() - along*along, 0));
              const pr = effRadius(b.data);                            // promień planety w skali sceny (umbra ≈ cylinder)
              ecl = THREE.MathUtils.clamp((pr*1.15 - perp)/(pr*0.6), 0, 1);  // miękka półcień→pełny cień
            }
            mat.uniforms.uEclipse.value = ecl;
            mat.uniforms.uPlanetDir.value.copy(_ppos).sub(tmpV).normalize();   // księżyc→planeta
            if(!b.data._shine3) b.data._shine3 = new THREE.Color(b.data.color);
            mat.uniforms.uPlanetColor.value.set(b.data._shine3.r, b.data._shine3.g, b.data._shine3.b);
            mat.uniforms.uPlanetAmt.value = 0.16;                       // subtelne wypełnienie odbitym światłem planety
          }
          if(m.data.bump){                                              // relief kraterów Księżyca: 0 z daleka → pełny przy zbliżeniu (jak Ziemia, bez migotania na dystansie)
            const rr = m.data.r * m.mesh.scale.x;
            mat.uniforms.relief.value = THREE.MathUtils.clamp((rr*10 - camera.position.distanceTo(tmpV))/(rr*7), 0, 1) * 0.5;
          }
        }
      });
    });
    if(inFlight) advanceShip(dtScene, jdNow);
    if(inFlight && ship.mesh){
      const centerScene = shipCenterScenePos();                 // = b.group.position (już przesunięte w tej klatce)
      ship.mesh.position.copy(kmToScene(ship.r, centerScene));
      ship.mesh.scale.setScalar(shipMeshScale());
      const vdir = kmDirToScene(ship.v);                        // orientuj nos wzdłuż prędkości (prograde)
      if(vdir.lengthSq() > 1e-12) ship.mesh.quaternion.setFromUnitVectors(SHIP_FWD, vdir.normalize());
    }
    if(inFlight && ship.coe){
      if(shipOrbitSig() !== _orbitSig) rebuildShipOrbit();        // odbuduj tylko gdy zmienił się kształt (SOI/manewr)
      if(ship.orbitLine){ ship.orbitLine.position.copy(shipCenterScenePos()); ship.orbitLine.visible = true; }
      if(ship.nodes.length) anchorPredict();                                    // kolejka: repozycja predykcji per-frame (tani; recompute on-edit). KSP: brak burn-now-per-frame.
      pushShipTrail();
      if(ship.trail) ship.trail.position.copy(shipCenterScenePos());
      updateNodeMarker(); updateNodeGizmo();
    }
    if(inFlight){ updateShipHud(); updateWarpHud(); updateNodeHud(); }
    // Komety: uTime (puls/migotanie) + orientacja ogonów anty-słonecznie + koziołkowanie ʻOumuamua
    for(let i=0;i<cometMats.length;i++) cometMats[i].uniforms.uTime.value = flowT;
    reality.cometMarkers.forEach(cv=>{
      if(cv.userData.cometKind === 'rock'){
        cv.rotation.y += 0.5*dt; cv.rotation.z += 0.33*dt;             // koziołkowanie odłamka
        if(cv.material.uniforms) cv.material.uniforms.sunDir.value.copy(sunDirTmp.copy(sun.position).sub(cv.position).normalize());
        return;
      }
      cometAnti.copy(cv.position).sub(sun.position).normalize();        // kierunek anty-słoneczny (od Słońca) — ogon jonowy
      if(cv.userData.ion) cv.userData.ion.quaternion.setFromUnitVectors(COMET_DOWN, cometAnti);
      if(cv.userData.dust){                                             // ogon pyłowy: ziarna zostają w tyle orbity → krzywizna ku anty-prędkości
        const vd = cv.userData.velDir;
        if(vd){ cometTang.copy(vd).multiplyScalar(-1);                  // „za" kometą (anty-prędkość)
                cometTang.addScaledVector(cometAnti, -cometTang.dot(cometAnti)); }  // składowa ⟂ do osi anty-słonecznej
        else cometTang.copy(cometAnti).cross(SCENE_UP);                 // fallback gdy brak velDir
        if(cometTang.lengthSq() < 1e-4){ cometTang.copy(cometAnti).cross(SCENE_UP); if(cometTang.lengthSq() < 1e-4) cometTang.set(1,0,0); }
        cometTang.normalize();
        cometAxis.copy(cometAnti).addScaledVector(cometTang, cv.userData.curve).normalize();
        cv.userData.dust.quaternion.setFromUnitVectors(COMET_DOWN, cometAxis);
      }
    });
    // Słońce: pełny obrót ~25,38 dnia (609,12 h); pas planetoid: ~5 lat — w czasie rzeczywistym
    sun.rotation.y = Ephemeris.rotationPhase(609.12, jdNow);
    beltGroup.rotation.y += (2*Math.PI / (5.0*365*24)) * sceneHours;
    // satelity „płyną" — throttlowana re-propagacja (~0,25 s wall-clock)
    if(sats.active && (!inFlight || flight.warp < WARP_SAT_FREEZE)){
      const eb=bodies.find(x=>x.data.earth), camD=camera.position.distanceTo(worldPos(eb));
      sats.points.material.size = THREE.MathUtils.clamp(camD/eb.data.radius*0.5, 0.9, 3.2);   // im bliżej Ziemi → mniejsze kropki
      reality.satAccum += dt;
      if(reality.satAccum >= 0.25){ repropagateSatellites(new Date(clockMs)); reality.satAccum = 0; }
    }
  }

  // focus follow: keep camera locked relative to the moving planet
  const now=performance.now();
  // flythrough tour: advance to next body after its dwell
  if(tour && now>=tour.next){
    tour.i++;
    if(tour.i>=tour.seq.length){ stopTour(); }
    else { focusBody(tour.seq[tour.i]); tour.next = now + 1300 + 3800; }
  }
  if(focused && !tween){
    const b=bodies.find(x=>x.data===focused);
    const wp=worldPos(b);
    tmpV.copy(wp).sub(prevTarget);            // how far the planet moved this frame
    camera.position.add(tmpV);
    controls.target.copy(wp);
    prevTarget.copy(wp);
  } else if(focusedMoon && !tween){
    const wp=moonWorldPos(focusedMoon);
    tmpV.copy(wp).sub(prevTarget);            // jak daleko księżyc przeleciał w tej klatce
    camera.position.add(tmpV);
    controls.target.copy(wp);
    prevTarget.copy(wp);
  } else if(focusedShip && ship.mesh && !tween){
    const wp = ship.mesh.getWorldPosition(_shipWP);
    tmpV.copy(wp).sub(prevTarget);            // jak daleko statek przeleciał w tej klatce
    camera.position.add(tmpV);
    controls.target.copy(wp);
    prevTarget.copy(wp);
  }
  tickTween(now);
  // galaktyki: powolny obrót wokół WŁASNEGO centrum (points.position=center, oś=normal)
  if(galaxyGroup && galaxyGroup.visible){ const gs = GALAXY_SPIN * dt;
    for(let i = 0; i < galaxies.length; i++) galaxies[i].points.rotateOnAxis(galaxies[i].normal, gs); }
  updateLOD();                     // dociąga ostrzejszą teksturę im bliżej planety

  // pan (prawy przycisk) wolniej przy dużym zbliżeniu — precyzja u powierzchni
  if(focused || focusedMoon){
    const fr = focused ? effRadius(focused) : focusedMoon.data.r;
    const ratio = camera.position.distanceTo(controls.target) / fr;   // ~1.03 u powierzchni … duże z daleka
    controls.panSpeed = THREE.MathUtils.clamp((ratio - 1) * 0.5, 0.16, 1);
  } else controls.panSpeed = 1;

  controls.update();
  renderer.render(scene, camera);
  updateLabels();
  updateAsterismLabels();
  updateEduLabels(now);
  updateEduTip();
  updateSatTip();
}

/* ---------- HTML labels projected from 3D ---------- */
const projV=new THREE.Vector3();
function placeLabel(el, world3){
  projV.copy(world3).project(camera);
  const behind = projV.z>1;
  if(behind){ el.style.opacity=0; return; }
  const x=(projV.x*0.5+0.5)*innerWidth, y=(-projV.y*0.5+0.5)*innerHeight;
  el.style.left=x+'px'; el.style.top=y+'px';
}
function updateLabels(){
  if(!showLabels){ return; }
  // fade labels when focused on a planet
  const baseOp = focused ? 0 : 1;
  bodies.forEach(b=>{
    const el=labelEls[b.data.id];
    const wp=worldPos(b);
    // offset label slightly above the planet
    placeLabel(el, tmpV.copy(wp).add(new THREE.Vector3(0, b.data.radius+0.6, 0)));
    if(el.style.opacity!=='0' || !focused) el.style.opacity = baseOp;
  });
  placeLabel(sunLabel, new THREE.Vector3(0, SUN_RADIUS+2, 0));
  if(focused) sunLabel.style.opacity=0; else if(sunLabel.style.opacity!=='0') sunLabel.style.opacity=1;
}

animate();

/* Smoke/CI: gdy ?smoke w URL — wymuś skin „Żywa Ziemia" (kompilacja jej shaderów),
   przerenderuj i wypisz marker gotowości. Brak markera = crash inicjalizacji. */
if(/[?&]smoke\b/.test(location.search)){
  try{ const ei = SKINS.earth.findIndex(s=>s.live); if(ei>0) applySkin('earth', ei); }
  catch(e){ console.error('smoke applySkin', e); }
  try{ setGeoActive(true); }catch(e){ console.error('smoke geo', e); }   // wymuś build warstwy geo + granic
  requestAnimationFrame(()=>{
    try{ renderer.render(scene, camera); }catch(e){ console.error('smoke render', e); }
    console.log('SMOKE_READY '+bodies.length);
  });
}

/* Smoke/CI ?cosmo: wejdź w interstellar (pole gwiazd + reveal-shader) i wymuś kompilację shaderów
   + render headless. Czeka aż fetch cosmo/systems.json dojdzie. buildStarSystem = Task 5 → guard. */
if(/[?&]cosmo\b/.test(location.search)){
  const boot = ()=>{
    if(!SYSTEMS.length){ setTimeout(boot, 40); return; }        // poczekaj na fetch systems.json
    binariesGate.then(()=>{                                     // + gate binaries (finding #12: smoke nie wykonywał ścieżki towarzyszy)
      try{ buildInterstellar(); interstellarGroup.visible = true;
           camera.position.set(0, 1350, 4230); controls.target.set(0,0,0);   // kadr klastra (~clusterRadius·1,9 przy LY_SCENE=44); |cam|≈4440 ≫ EXIT=150 → bez auto-exit
           cosmos.scale = 'interstellar'; }
      catch(e){ console.error('cosmo interstellar', e); }
      try{ buildRevealFX(); revealFX.mesh.visible = true; _placeRevealPlane(); revealFX.mat.uniforms.uProgress.value = 0.7; }
      catch(e){ console.error('cosmo reveal', e); }
      try{ buildStarSystem(SYSTEMS.find(s=>s.id==='trappist1')); }catch(e){ console.error('cosmo buildStarSystem', e); }
      // ścieżka towarzyszy (podwójne + biały karzeł): Syriusz — mesh+glow+orbita+etykieta towarzysza (finding #12)
      try{ buildStarSystem(SYSTEMS.find(s=>s.id==='sirius'));
           if(!alienCompanions.length) console.error('cosmo companions: 0 (oczekiwany ≥1 dla sirius)'); }
      catch(e){ console.error('cosmo companions', e); }
      requestAnimationFrame(()=>{
        try{ renderer.render(scene, camera); }catch(e){ console.error('cosmo render', e); }
        console.log('COSMO_READY '+SYSTEMS.length);
      });
    });
  };
  boot();
}

/* Smoke/CI ?galactic: zbuduj dysk MW + pokaż + reveal-shader, render headless, marker gotowości.
   Build-only: cosmos.scale='galactic' kieruje gate animate do gałęzi cosmos (pod-gałąź D = Task 5;
   do tego czasu 'galactic' wpada w gałąź C, która bez alienGroup/exitDist jest no-opem — bezpieczne). */
if(/[?&]galactic\b/.test(location.search)){
  const bootG = ()=>{
    if(!MILKY_WAY){ setTimeout(bootG, 40); return; }        // poczekaj na fetch milky-way.json
    try{ buildMilkyWay(); mw.group.visible = true;
         setSceneVisible('sol', false);
         starfieldPts.visible = false;                      // jak w docelowym wejściu B→D (spec §4.5)
         cosmos.scale = 'galactic';
         camera.position.set(0, 5200, 3000); controls.target.set(0,0,0); }
    catch(e){ console.error('galactic build', e); }
    try{ buildRevealFX(); revealFX.mesh.visible = true; _placeRevealPlane(); revealFX.mat.uniforms.uProgress.value = 0.7; }
    catch(e){ console.error('galactic reveal', e); }
    requestAnimationFrame(()=>{
      try{ renderer.render(scene, camera); }catch(e){ console.error('galactic render', e); }
      console.log('GALACTIC_READY ' + mw.objects.length + ' ' + mw.anchors.length);
    });
  };
  bootG();
}

/* Smoke/CI ?exgalaxy: zbuduj god-view zewnętrznej galaktyki (dysk+jądro+landmarki) headless.
   cosmos.scale='exgalaxy' kieruje gate animate do gałęzi E — weryfikuje brak błędów w nowej gałęzi.
   Pełny flow A→E→A / B→E→B w eye-check shot-exgalaxy (Task 6). */
if(/[?&]exgalaxy\b/.test(location.search)){
  const tryBuild = ()=>{
    if(!GALAXIES_DETAIL){ setTimeout(tryBuild, 200); return; }
    try{ const g = buildGalaxyScene('m31'); if(g) g.visible = true;
         cosmos.scale = 'exgalaxy'; cosmos.galaxyId = 'm31';  // aktywuje gałąź E w animateCosmos/updateCosmosLabels
         setSceneVisible('sol', false); starfieldPts.visible = false;
         if(galaxyGroup) galaxyGroup.visible = false;
         camera.position.set(0, GALAXIES_DETAIL['m31'].disk.size * 2.2, GALAXIES_DETAIL['m31'].disk.size * 1.4);
         controls.target.set(0, 0, 0); }
    catch(e){ console.error('exgalaxy build', e); }
    requestAnimationFrame(()=>{
      try{ renderer.render(scene, camera); }catch(e){ console.error('exgalaxy render', e); }
      console.log('EXGALAXY_READY ' + (gxCache['m31'] ? gxCache['m31'].landmarks.length : 0));
    });
  };
  tryBuild();
}

/* ============================================================
   Wejście w tryb lotu: przycisk HUD „Lot orbitalny"
   ============================================================ */
// „Lot" = przycisk HUD (zastąpił klawisz `l`); toggle wejście/wyjście
document.getElementById('flightBtn').onclick = ()=>{ if(flight.active) { exitFlight(); goSystem(); } else startFlight(); };
addEventListener('keydown', e=>{ if(e.key==='c' && flight.active) focusShip(); });   // chase-cam na statek (§5.2)
addEventListener('keydown', e=>{ if(!flight.active) return;
  if(e.key===','){ flight.warpIdx = Math.max(0, flight.warpIdx - 1); flight._warpToNode = false; refreshNodeButtons(); updateWarpHud(); }
  else if(e.key==='.'){ flight.warpIdx = Math.min(WARP_STEPS.length - 1, flight.warpIdx + 1); flight._warpToNode = false; refreshNodeButtons(); updateWarpHud(); }
});   // §5.2 warp dół/góra (tylko w locie)
addEventListener('keydown', e=>{ if(!flight.active) return;
  if(e.key==='Enter'){ if(e.target && e.target.tagName==='BUTTON') return; fireImpulse(); }   // focus na przycisku → natywny click odpala (bez podwójnego fire / obejścia bramki warp §4.6)
  else if(e.key==='['){ nudgePro(-10); }
  else if(e.key===']'){ nudgePro(10); }
});   // §5.2: Enter=Wykonaj, [ / ] = dialuj prograde ∓10 m/s (normal/radial: fokus suwaka + ←/→)
// `?flight` = TEST-ONLY (jak ?smoke): auto-start + ekspozycja stanu dla headless probe; niewidoczne dla użytkownika
if(new URLSearchParams(location.search).has('flight')){
  startFlight();
  if(typeof window!=='undefined'){ window.__startFlight = startFlight; window.__ship = ship; window.__flight = flight; }
}

/* ============================================================
   Resize
   ============================================================ */
addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* keyboard: Esc → exit flight (if active) + system view; w exgalaxy: wyjdź z god-view (spec §5) */
addEventListener('keydown', e=>{ if(e.key==='Escape'){
  if(cosmos.scale==='exgalaxy'){ exitToSystem(); return; }   // Esc wychodzi z god-view (spec §5; exitToSystem→exitExgalaxy = powrót kontekstowy)
  if(flight.active) exitFlight(); goSystem(); } });

/* ============================================================
   Tryb filmowy ?film — „Voyager 1 na granicy dnia świetlnego"
   Oś czasu i kamera: kino.js (czysta matematyka, testowana). Tu: kotwice ze sceny, zegar filmu
   (sondy przez probeClockMs, planety przez placeBodiesAt — jednorazowe zapisy poza animate, gałąź
   pasywna nietknięta), napisy, letterbox, dźwięk z Web Audio. Pętla kamery = własny rAF po animate
   (controls wyłączone, min/maxDistance zdjęte → controls.update() nie zmienia pozy).
   ============================================================ */
Object.assign(kino, { t0:0, raf:0, crossMs:0, downMs:0, ld:null, mk:null, saved:null, cues:null,
  lastClock:NaN, lastHour:-1, audio:null, ready:false });
const KINO_PROBE = 'voyager1';
// Akcja NASA „Shine Bright for Voyager's Light-Day" (17.11.2026 po zmroku) — zaproszenie na karcie końcowej
// znika po 19.11, żeby film nie wołał do akcji, która się skończyła. Źródło: science.nasa.gov/…/shine-bright-for-voyagers-light-day/
const KINO_VGR_UNTIL = Date.UTC(2026, 10, 19);

function placeBodiesAt(ms){
  const jd = Ephemeris.julianDate(ms);
  bodies.forEach(b=>{ const el = Ephemeris.REAL_PLANETS.find(p=>p.id===b.data.id);
    if(el) b.group.position.copy(eclToScene(Ephemeris.positionAt(el, jd))); });
  if(trueDots && trueDots.visible) trueDots.geometry.setFromPoints(bodies.map(worldPos));
}

function kinoAnchors(){
  const e = worldPos(bodies.find(b=>b.data.id==='earth')), v = kino.mk.position;
  return { S:[0,0,0], E:[e.x,e.y,e.z], V:[v.x,v.y,v.z], R:kino.ld.R };
}

const _kfmt = (ms, sec) => new Date(ms).toLocaleString('pl-PL', {timeZone:'UTC', day:'numeric', month:'long', year:'numeric',
  hour:'2-digit', minute:'2-digit', second: sec ? '2-digit' : undefined}) + ' UTC';

// Napisy: [ujęcie, od, do (s w ujęciu), slot, treść | fn(t) → treść]
function kinoCues(){
  const P = PROBES.find(p=>p.id===KINO_PROBE), e = probeEphem(P);
  const st = id => Kino.shotStart(id), tc = st('granica') + Kino.crossFraction()*Kino.shotDur('granica');
  const facts = ()=>{
    const jd = Ephemeris.julianDate(kino.clockMs), p = ProbeEphem.positionAt(e.samples, jd), p2 = ProbeEphem.positionAt(e.samples, jd+1);
    const earth = Ephemeris.positionAt(Ephemeris.REAL_PLANETS.find(x=>x.id==='earth'), jd);
    return { dkm: ProbeEphem.dist(p, earth)*ProbeEphem.AU_KM/1e9, v: ProbeEphem.dist(p, p2)*ProbeEphem.AU_KM/86400,
             yrs: Kino.yearsSince(kino.clockMs, Kino.LAUNCH_MS) };
  };
  const c = [];
  const add = (shot, a, b, slot, html) => c.push({ a: (shot ? st(shot) : 0) + a, b: (shot ? st(shot) : 0) + b, slot, html });
  add('uklad', 1.2, 9.2, 'title', '<div class="k-eye">Symulacja · efemerydy NASA/JPL Horizons</div><div class="k-h1">Voyager 1</div><div class="k-sub">na granicy jednego dnia świetlnego</div>');
  ['ziemia','droga','sonda','granica','echo'].forEach(id=>{ const s = Kino.SHOTS.find(x=>x.id===id);
    add(id, 0.3, 4.6, 'chapter', `<span>${s.chapter}</span>`); });
  add('ziemia', 3.2, 7.0, 'line', 'Stąd wystartował 5 września 1977 roku.');
  add('ziemia', 7.2, 10.9, 'line', 'Sygnał radiowy z Ziemi leci do niego prawie całą dobę.');
  add('droga', 1.6, 14.4, 'counter', ()=>{
    const A = kinoAnchors(), d = Kino._v.len(Kino._v.sub([camera.position.x,camera.position.y,camera.position.z], A.E));
    const h = Math.max(0, Math.min(24, d/AU_SCALE/(ProbeEphem.LIGHT_DAY_AU/24)));
    return `<div class="k-big">${Kino.fmtDec(h,1)} h</div><div class="k-cap">lotu światła od Ziemi</div>`; });
  add('droga', 5.0, 11.5, 'line', 'Każdy błysk na promieniu to sygnał wysłany z Ziemi o pełnej godzinie.');
  add('sonda', 3.0, 8.4, 'line', ()=>{ const f = facts();
    return `${Kino.fmtDec(f.dkm,1)} mld km od Ziemi · ${Kino.fmtDec(f.v,1)} km/s względem Słońca`; });
  add('sonda', 8.6, 13.6, 'line', ()=>`${Math.floor(facts().yrs)} lat w drodze. Wciąż nadaje — nadajnikiem o mocy ok. 23 W.`);
  add('granica', 3.0, tc - st('granica') - 0.5, 'line', 'Błona: każdy jej punkt leży dokładnie 1 dzień świetlny od Ziemi — 173 AU.');
  add('granica', tc - st('granica') - 0.2, tc - st('granica') + 5.2, 'title',
    `<div class="k-eye">${_kfmt(kino.crossMs)}</div><div class="k-h1">1 dzień świetlny</div><div class="k-sub">Pierwszy obiekt zbudowany przez człowieka tak daleko od Ziemi.</div>`);
  add('echo', 3.0, 8.4, 'line', 'Odpowiedź z tej odległości leci do nas ponad dobę.');
  add('echo', 8.6, 14.6, 'line', `Pierwszy sygnał, który poleciał ponad dobę, odbiorą anteny Deep Space Network ${_kfmt(kino.downMs)}.`);
  return c;
}

function kinoBuildDom(){
  if(document.getElementById('kino')) return;
  const el = document.createElement('div'); el.id = 'kino';
  el.innerHTML = `<div class="k-bar k-top"><div class="k-date" id="kDate"></div></div><div class="k-bar k-bot"><div class="k-prog"><i id="kProg"></i></div></div>
    <div class="k-vig"></div><div class="k-grain"></div><div class="k-flash" id="kFlash"></div><div class="k-fade" id="kFade"></div>
    <div class="k-slot k-title" data-slot="title"></div><div class="k-slot k-chapter" data-slot="chapter"></div>
    <div class="k-slot k-line" data-slot="line"></div><div class="k-slot k-counter" data-slot="counter"></div>
    <div class="k-ctl"><button id="kFull" type="button" hidden>⛶ Pełny ekran</button><button id="kPause" type="button">⏸ Pauza</button><button id="kSound" type="button">🔈 Dźwięk</button><button id="kSkip" type="button">Pomiń ⏭</button></div>
    <div class="k-end" id="kEnd"><div class="k-eye">Koniec</div><div class="k-h1">Voyager 1</div>
      <div class="k-sub">Dane: NASA/JPL Horizons · film i scena na żywo: <a href="https://voyager.kodownik.co/">voyager.kodownik.co</a></div>
      ${Date.now() < KINO_VGR_UNTIL ? `<div class="k-sub k-vgr">17 listopada po zachodzie słońca NASA zaprasza: wymrugaj w niebo znak Voyagera <span class="k-morse">V-G-R</span> alfabetem Morse'a
        (<span class="k-morse">···– ––· ·–·</span>) — latarką albo migaczem w telefonie: <a href="https://go.nasa.gov/vgr" target="_blank" rel="noopener">go.nasa.gov/vgr</a></div>` : ''}
      <div class="k-sub k-next">Film 2: <a href="https://voyager.kodownik.co/?mrugniecie">Mrugnięcie — V-G-R z Ziemi do Voyagera 1</a></div>
      <div class="k-btns"><button id="kAgain" type="button">↻ Jeszcze raz</button><button id="kStay" type="button">Zostań w scenie</button></div></div>
    <div class="k-load" id="kLoad">wczytywanie sceny…</div>
    <div class="k-rot">↻ obróć telefon poziomo — cały kadr</div>`;
  document.body.appendChild(el);
  document.getElementById('kSkip').onclick = ()=>kinoEnd(true);
  document.getElementById('kAgain').onclick = ()=>kinoStart();
  document.getElementById('kStay').onclick = ()=>{ document.getElementById('kino').classList.remove('end');
    document.body.classList.remove('kino-on'); };
  document.getElementById('kSound').onclick = ()=>kinoAudioToggle();
  document.getElementById('kPause').onclick = ()=>kinoPauseToggle();
  // pełny ekran: tylko gdzie przeglądarka go daje (iPhone Safari nie — tam przycisk się nie pokazuje)
  const kFull = document.getElementById('kFull');
  kFull.hidden = !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  kFull.onclick = ()=>kinoFullscreenToggle();
  ['fullscreenchange','webkitfullscreenchange'].forEach(ev=>document.addEventListener(ev, kinoFullscreenLabel));
}

function kinoSlots(t){
  const want = {};
  kino.cues.forEach(c=>{ if(t >= c.a && t < c.b) want[c.slot] = c; });
  document.querySelectorAll('#kino .k-slot').forEach(s=>{
    const c = want[s.dataset.slot];
    if(!c){ if(s.classList.contains('show')) s.classList.remove('show'); return; }
    const html = typeof c.html === 'function' ? c.html(t) : c.html;
    if(s._cue !== c){ s._cue = c; s.innerHTML = html; s.classList.remove('show'); void s.offsetWidth; s.classList.add('show'); }
    else if(typeof c.html === 'function' && s._html !== html) s.innerHTML = html;
    s._html = html;
  });
}

const _kUp = new THREE.Vector3();
function kinoLoop(now){
  if(!kino.active) return;
  kino.raf = requestAnimationFrame(kinoLoop);
  if(kino.paused) return;                                              // pauza: kadr, zegar filmu i napisy stoją
  const t = (now - kino.t0)/1000, T = Kino.total();
  if(t >= T){ kinoEnd(false); return; }
  // zegar filmu → sondy/membrana (updateProbes) i planety (Ziemia = środek membrany)
  const clk = Kino.clockMs(t, kino.crossMs);
  if(clk !== kino.lastClock){ kino.clockMs = clk; kino.lastClock = clk; placeBodiesAt(clk); updateProbes(); }
  // kamera
  const p = Kino.pose(t, kinoAnchors());
  camera.position.set(p.pos[0], p.pos[1], p.pos[2]);
  controls.target.set(p.target[0], p.target[1], p.target[2]);
  const dir = Kino._v.norm(Kino._v.sub(p.target, p.pos)), up = Kino.rotate([0,1,0], dir, p.roll);
  camera.up.copy(_kUp.set(up[0], up[1], up[2]));
  if(Math.abs(camera.fov - p.fov) > 1e-3){ camera.fov = p.fov; camera.updateProjectionMatrix(); }
  camera.lookAt(controls.target);
  // błysk przebicia
  const tc = Kino.shotStart('granica') + Kino.crossFraction()*Kino.shotDur('granica');
  const fl = Math.exp(-Math.pow((t - tc)/(t < tc ? 0.25 : 0.9), 2));
  kino.ld.film.material.color.setScalar(1 + 7*fl + (t > tc ? 0.6 : 0));
  document.getElementById('kFlash').style.opacity = (0.55*fl).toFixed(3);
  kino.ld.label.visible = !(t > tc - 0.4 && t < tc + 5.6) && Kino.locate(t).shot.id !== 'echo';
  // HUD: data i tempo czasu (od ujęcia „granica")
  const L = Kino.locate(t), dEl = document.getElementById('kDate');
  if(L.shot.id === 'granica' || L.shot.id === 'echo'){
    const r = Kino.clockRate(t);
    dEl.textContent = _kfmt(clk, true) + (r > 1.5 ? `  ·  czas ×${Kino.fmtInt(r)}` : '');
    dEl.classList.add('show');
  } else dEl.classList.remove('show');
  document.getElementById('kProg').style.width = (100*t/T).toFixed(2) + '%';
  document.getElementById('kFade').style.opacity = Math.max(1 - t/1.6, Math.max(0, (t - (T - 1.2))/1.2)).toFixed(3);
  kinoSlots(t);
  kinoAudioTick(t, tc);
}

function kinoStart(){
  if(kino.film === 'vgr') return vgrStart();
  if(!kino.ready) return;
  const P = PROBES.find(p=>p.id===KINO_PROBE), e = probeEphem(P);
  kino.crossMs = Date.parse(e.lightDay.geometric); kino.downMs = Date.parse(e.lightDay.downlink);
  kino.mk = probes.byId[KINO_PROBE].mk;
  kino.ld = probes.lightDay.find(m=>m.id===KINO_PROBE);
  if(!kino.ld){ kino.ld = buildLightDayMembrane(P); probes.lightDay.push(kino.ld); }   // poza oknem ±1 rok — film i tak ją pokazuje
  if(!kino.saved) kino.saved = { min:controls.minDistance, max:controls.maxDistance, fov:camera.fov };
  focused = null; focusedMoon = null; focusedShip = false; tween = null; if(tour) stopTour();
  elInfo.classList.remove('show'); elBack.classList.remove('show');
  controls.enabled = false; controls.minDistance = 0; controls.maxDistance = Infinity;
  renderer.domElement.style.pointerEvents = 'none';
  PROBES.forEach(p=>{ if(p.atBody && probes.byId[p.id]) probes.byId[p.id].mk.visible = false; });   // JWST siedziałby w Ziemi w zbliżeniu
  kino.cues = kinoCues();
  document.querySelectorAll('#kino .k-slot').forEach(s=>{ s._cue = null; s.classList.remove('show'); });
  document.getElementById('kino').classList.remove('end', 'loading');
  document.body.classList.add('kino-on', 'kino-run');
  kino.active = true; kino.lastClock = NaN; kino.lastHour = -1;
  kinoPauseSet(false); kino.t0 = performance.now();
  if(kino.audio && kino.audio.on) kinoAudioStart();
  cancelAnimationFrame(kino.raf); kino.raf = requestAnimationFrame(kinoLoop);
}

function kinoEnd(skipped){
  if(!kino.active) return;
  if(kino.film === 'vgr') vgrCleanup();
  kinoPauseSet(false);
  kino.active = false; cancelAnimationFrame(kino.raf);
  placeBodiesAt(reality.clockMs); updateProbes();                       // z powrotem na „teraz" 1:1
  kino.ld.film.material.color.setScalar(1); kino.ld.label.visible = true;
  PROBES.forEach(p=>{ if(p.atBody && probes.byId[p.id]) probes.byId[p.id].mk.visible = true; });
  camera.up.set(0,1,0); camera.fov = kino.saved.fov; camera.updateProjectionMatrix(); camera.lookAt(controls.target);
  controls.minDistance = 2; controls.maxDistance = 60000; controls.enabled = true;   // jak focusProbe: można krążyć przy sondzie
  renderer.domElement.style.pointerEvents = '';
  document.getElementById('kFlash').style.opacity = 0; document.getElementById('kFade').style.opacity = 0;
  document.getElementById('kDate').classList.remove('show');
  document.querySelectorAll('#kino .k-slot').forEach(s=>s.classList.remove('show'));
  document.body.classList.remove('kino-run');
  document.getElementById('kino').classList.add('end');
  kinoAudioStop(skipped ? 0.4 : 3);
}

/* ---------- pauza (przycisk i spacja): t0 przesuwane o czas postoju, więc oś czasu filmu się nie rozjeżdża ---------- */
function kinoPauseSet(on){
  if(!!kino.paused === on) return;
  if(on) kino.pausedAt = performance.now(); else if(kino.pausedAt) kino.t0 += performance.now() - kino.pausedAt;
  kino.paused = on;
  const b = document.getElementById('kPause'); if(b) b.textContent = on ? '▶ Wznów' : '⏸ Pauza';
  const el = document.getElementById('kino'); if(el) el.classList.toggle('paused', on);
  const A = kino.audio; if(A && A.ctx && A.live){ if(on) A.ctx.suspend(); else A.ctx.resume(); }
}
function kinoPauseToggle(){ if(kino.active) kinoPauseSet(!kino.paused); }

/* ---------- pełny ekran (przycisk w filmie; gest użytkownika wymagany przez przeglądarki) ---------- */
function kinoFsElement(){ return document.fullscreenElement || document.webkitFullscreenElement || null; }
function kinoFullscreenLabel(){
  const b = document.getElementById('kFull'); if(b) b.textContent = kinoFsElement() ? '✕ Zamknij pełny ekran' : '⛶ Pełny ekran';
}
function kinoFullscreenToggle(){
  const d = document, el = d.documentElement;
  if(kinoFsElement()){ (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
  const req = el.requestFullscreen || el.webkitRequestFullscreen; if(!req) return;
  Promise.resolve(req.call(el, {navigationUI:'hide'})).then(()=>{
    // telefon: kadr 2.39:1 → poziomo, jeśli przeglądarka pozwala zablokować orientację (Android Chrome w pełnym ekranie)
    if(matchMedia('(pointer: coarse)').matches && screen.orientation && screen.orientation.lock)
      screen.orientation.lock('landscape').catch(()=>{});
  }).catch(e=>console.warn('kino: pełny ekran odrzucony', e && e.message));
}

/* ---------- dźwięk: generatywna faktura (Web Audio), włączana przyciskiem (autoplay blokuje audio) ---------- */
function kinoAudioToggle(){
  if(!kino.audio) kino.audio = { on:false };
  kino.audio.on = !kino.audio.on;
  document.getElementById('kSound').textContent = kino.audio.on ? '🔊 Dźwięk' : '🔈 Dźwięk';
  if(kino.audio.on && kino.active) kinoAudioStart(); else if(!kino.audio.on) kinoAudioStop(0.5);
}
function kinoAudioStart(){
  const A = kino.audio; if(A.ctx && A.live) return;
  const ctx = A.ctx || new (window.AudioContext || window.webkitAudioContext)(); A.ctx = ctx; ctx.resume();
  const out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.connect(out);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 2.5; lp.connect(comp);
  const pad = ctx.createGain(); pad.gain.value = 0.07; pad.connect(lp);
  const oscs = [73.42, 110.0, 146.83, 164.81, 220.0].map((f, i)=>{        // D2 A2 D3 E3 A3 — pusta kwinta + nona
    const o = ctx.createOscillator(); o.type = i < 3 ? 'sawtooth' : 'triangle'; o.frequency.value = f; o.detune.value = (i%2 ? 7 : -6);
    o.connect(pad); o.start(); return o; });
  const sub = ctx.createOscillator(); sub.frequency.value = 36.71; const sg = ctx.createGain(); sg.gain.value = 0.16;
  sub.connect(sg); sg.connect(comp); sub.start(); oscs.push(sub);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 90;
  lfo.connect(lg); lg.connect(lp.frequency); lfo.start(); oscs.push(lfo);
  out.gain.setTargetAtTime(0.9, ctx.currentTime, 1.2);
  Object.assign(A, { out, lp, oscs, live:true, swelled:false });
}
function kinoAudioStop(fade){
  const A = kino.audio; if(!A || !A.live) return;
  A.live = false; const ctx = A.ctx, now = ctx.currentTime;
  A.out.gain.cancelScheduledValues(now); A.out.gain.setTargetAtTime(0, now, Math.max(0.05, fade/4));
  const oscs = A.oscs; setTimeout(()=>oscs.forEach(o=>{ try{ o.stop(); }catch(e){} }), fade*1000 + 600);
}
function kinoPing(freq, gain, dur){
  const A = kino.audio, ctx = A.ctx, now = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(gain, now + 0.01); g.gain.exponentialRampToValueAtTime(1e-4, now + dur);
  o.connect(g); g.connect(A.out); o.start(now); o.stop(now + dur + 0.1);
}
function kinoAudioTick(t, tc){
  const A = kino.audio; if(!A || !A.live) return;
  const L = Kino.locate(t), ctx = A.ctx;
  // filtr otwiera się z każdym ujęciem; najszerzej w pustce „drogi" i w chwili przebicia
  const open = { uklad:260, ziemia:420, droga:900, sonda:650, granica:520, echo:1100 }[L.shot.id] +
               (L.shot.id === 'droga' ? 1300*Math.sin(Math.PI*L.f) : 0) + 2600*Math.exp(-Math.pow((t-tc)/1.5, 2));
  A.lp.frequency.setTargetAtTime(open, ctx.currentTime, 0.35);
  if(L.shot.id === 'droga'){                                        // dźwięk znacznika godzinowego przy każdej mijanej godzinie świetlnej
    const d = camera.position.distanceTo(worldPos(bodies.find(b=>b.data.id==='earth')));
    const h = Math.floor(d/AU_SCALE/(ProbeEphem.LIGHT_DAY_AU/24));
    if(h !== kino.lastHour && h >= 0 && h < 24){ if(kino.lastHour >= 0) kinoPing([587.3, 659.3, 880, 987.8, 1174.7][h%5], 0.05, 1.6); kino.lastHour = h; }
  }
  if(!A.swelled && t >= tc - 0.05){                                 // przebicie: dzwon D-dur(9)
    A.swelled = true; [293.66, 440, 587.33, 739.99, 1318.5].forEach((f, i)=>kinoPing(f, 0.09/(1+i*0.4), 7 + i));
  }
}

/* ---------- start z URL ---------- */
if(/[?&](film|kino)\b/.test(location.search)){
  kinoBuildDom(); document.body.classList.add('kino-on', 'kino-run'); document.getElementById('kino').classList.add('loading');
  // Kino w capture: Esc pomija film (bez goSystem z globalnego handlera)
  addEventListener('keydown', e=>{ if(e.key==='Escape' && kino.active){ kinoEnd(true); e.stopImmediatePropagation(); } }, true);
  addEventListener('keydown', e=>{ if(e.key===' ' && kino.active && !(e.target.closest && e.target.closest('button'))){ kinoPauseToggle(); e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  const boot = ()=>{
    if(!document.getElementById('loader').classList.contains('hide') || !PROBE_EPHEM){ setTimeout(boot, 120); return; }
    if(!probes.active){ startProbes(); setToggle('tProbes', true); }
    const wait = ()=>{
      if(!probes.byId[KINO_PROBE]){ setTimeout(wait, 80); return; }
      try{ const ei = SKINS.earth.findIndex(s=>s.live); if(ei > 0) applySkin('earth', ei); }catch(e){ console.error('kino skin', e); }
      // film: etykiety i chmury Ziemi domyślnie wyłączone (przełączniki w panelu pokazują ten stan), shadery
      // skompilowane za ekranem wczytywania — bez tego pierwsze odtworzenie przycinało przy najeździe na Ziemię
      showLabels = false; labelLayer.style.display = 'none'; setToggle('tLabels', false);
      showClouds = false; { const ec = PLANETS.find(p=>p.earth); if(ec && ec._clouds) ec._clouds.visible = false; } setToggle('tClouds', false);
      try{ renderer.compile(scene, camera); }catch(e){ console.error('kino compile', e); }
      kino.ready = true; kinoStart();
    };
    wait();
  };
  boot();
  if(typeof window !== 'undefined') window.__kino = kino;
}

/* ============================================================
   Film „Mrugnięcie" (?mrugniecie) — V-G-R alfabetem Morse'a z Ziemi do Voyagera 1
   (akcja NASA „Shine Bright for Voyager's Light-Day", 17.11.2026 po zachodzie słońca).
   Oś czasu, zegar czoła światła, zmierzch per miasto i pozy kamery: mrugniecie.js (Mrug, testowane).
   Tu: miasta mrugające o zmierzchu (geo/edu-data.json), latarka w Warszawie, pociąg błysków na promieniu
   Ziemia→sonda w PRAWDZIWEJ skali (jednostka Morse'a = 0,22 s światła), kropka Ziemi zza sondy.
   Wspólne z filmem 1: DOM #kino, napisy (kinoSlots), pauza, dźwięk, sprzątanie (kinoEnd → vgrCleanup).
   ============================================================ */
const VGR_PL = { lon:21.01, lat:52.23 };                       // Warszawa — latarka, którą śledzimy
const vgr = { built:false, n:0, lon:null, sLat:null, cLat:null, pop:null, ph:null, names:null, pts:null, col:null,
  hero:null, train:null, offs:null, dot:null, glint:null, K:null, Es:null, seq:Mrug.morseSeq('VGR'),
  arrMs:0, tCross:NaN, tPass:0, passed:false, lastFront:0, rE:1, pr:1, city:'' };
const _vV = new THREE.Vector3();
const _va = v => [v.x, v.y, v.z];

function vgrBuild(d){
  const e = bodies.find(b=>b.data.earth), r = e.data.radius * 1.004;
  const cs = d.cities.filter(c=>(c[3]||0) >= 150000);
  const n = cs.length; vgr.n = n;
  vgr.lon = new Float32Array(n); vgr.sLat = new Float32Array(n); vgr.cLat = new Float32Array(n);
  vgr.pop = new Float32Array(n); vgr.ph = new Float32Array(n); vgr.names = cs.map(c=>c[2]);
  const pos = new Float32Array(n*3);
  cs.forEach((c, i)=>{
    vgr.lon[i] = c[0]*Math.PI/180; vgr.sLat[i] = Math.sin(c[1]*Math.PI/180); vgr.cLat[i] = Math.cos(c[1]*Math.PI/180);
    vgr.pop[i] = c[3];
    vgr.ph[i] = (moonSeed(c[2]) % 3800) / 100;                 // każdy mruga po swojemu (faza 0..38 jednostek)
    const p = lonlatToLocal(c[0], c[1], r); pos[i*3] = p.x; pos[i*3+1] = p.y; pos[i*3+2] = p.z;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  vgr.col = new THREE.BufferAttribute(new Float32Array(n*3), 3); g.setAttribute('color', vgr.col);
  const warm = glowTexture('rgba(255,250,236,1)', 'rgba(255,190,110,0.42)');
  vgr.pts = new THREE.Points(g, new THREE.PointsMaterial({map:warm, size:22, sizeAttenuation:false, vertexColors:true,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
  vgr.pts.visible = false; e.mesh.add(vgr.pts);
  const spr = (tex, color, att) => new THREE.Sprite(new THREE.SpriteMaterial({map:tex, color, sizeAttenuation:att,
    transparent:true, depthWrite:false, depthTest:att, blending:THREE.AdditiveBlending}));
  // latarka w Warszawie (stały rozmiar na ekranie)
  vgr.hero = spr(glowTexture('rgba(255,255,255,1)', 'rgba(255,196,110,0.55)'), 0xffe2b0, false);
  vgr.hero.position.copy(lonlatToLocal(VGR_PL.lon, VGR_PL.lat, e.data.radius*1.01)); vgr.hero.visible = false; e.mesh.add(vgr.hero);
  // pociąg błysków: koraliki wzdłuż promienia (kropka = 1, kreska = 5), offset w jednostkach Morse'a od czoła
  vgr.offs = [];
  vgr.seq.forEach(el=>{ if(!el.on) return;
    if(el.u === 1) vgr.offs.push(el.at + 0.5); else for(let k=0; k<5; k++) vgr.offs.push(el.at + 0.3 + k*0.6); });
  vgr.train = new THREE.Group();
  const bead = glowTexture('rgba(255,252,240,1)', 'rgba(255,214,150,0.4)');
  vgr.offs.forEach(()=>{ const s = spr(bead, 0xfff0d8, true); vgr.train.add(s); });
  vgr.train.visible = false; scene.add(vgr.train);
  // kropka Ziemi widziana zza sondy + błysk na sondzie, gdy mija ją pociąg
  vgr.dot = spr(glowTexture('rgba(220,240,255,1)', 'rgba(120,180,255,0.45)'), 0xb9dcff, false); vgr.dot.visible = false; scene.add(vgr.dot);
  vgr.glint = spr(glowTexture('rgba(255,255,255,1)', 'rgba(255,220,160,0.45)'), 0xfff3dc, false); vgr.glint.visible = false; scene.add(vgr.glint);
  vgr.built = true;
}

function vgrShow(on){
  if(!vgr.built) return;
  vgr.pts.visible = on; vgr.hero.visible = false; vgr.train.visible = false; vgr.dot.visible = false; vgr.glint.visible = false;
}
function vgrCleanup(){ vgrShow(false); vgrDark(false); kino.earthMs = 0; }
// V · Kropka: ciemne niebo jak na „Pale Blue Dot" — chowa linie orbit/torów i błonę, potem przywraca dokładnie te same
function vgrDark(on){
  if(on === !!vgr.hidden) return;
  if(on){
    vgr.hidden = [];
    scene.traverse(o=>{ if((o.isLine || o.isLineSegments) && o.visible && !vgr.train.children.includes(o)) { o.visible = false; vgr.hidden.push(o); } });
    const g = kino.ld && kino.ld.film.parent; if(g && g.visible){ g.visible = false; vgr.hidden.push(g); }
  } else { vgr.hidden.forEach(o=>{ o.visible = true; }); vgr.hidden = null; }
}

const _vfmtPL = ms => new Date(ms).toLocaleTimeString('pl-PL', {timeZone:'Europe/Warsaw', hour:'2-digit', minute:'2-digit'});
function vgrCues(){
  const st = id => Mrug.shotStart(id), K = vgr.K, c = [];
  const add = (shot, a, b, slot, html) => c.push({ a: st(shot) + a, b: st(shot) + b, slot, html });
  add('zmierzch', 1.0, 8.2, 'title', '<div class="k-eye">Akcja NASA · 17 listopada 2026</div><div class="k-h1">Mrugnięcie</div><div class="k-sub">V-G-R alfabetem Morse\'a — z Ziemi do Voyagera 1</div>');
  Mrug.SHOTS.forEach(s=>{ if(s.id !== 'zmierzch') add(s.id, 0.3, 4.3, 'chapter', `<span>${s.chapter}</span>`); });
  add('zmierzch', 5.0, 14.6, 'counter', ()=> vgr.city ? `<div class="k-big k-city">${vgr.city}</div><div class="k-cap">mruga teraz V-G-R</div>` : '');
  add('zmierzch', 8.6, 14.7, 'line', 'Gdzie zachodzi słońce, ludzie świecą w niebo latarkami. Fala mrugnięć idzie za zmierzchem na zachód.');
  add('nadawanie', 0.8, 11.8, 'counter', vgrMorseHtml);
  add('nadawanie', 2.0, 6.8, 'line', `Warszawa, 17 listopada, ${_vfmtPL(K.sendMs)} — chwilę po zachodzie słońca.`);
  add('nadawanie', 7.1, 11.9, 'line', 'Każde mignięcie odlatuje z prędkością światła: 300 000 km na sekundę.');
  add('poscig', 1.5, 17.2, 'counter', t=>`<div class="k-big">${Kino.fmtDec(Math.max(0, (Mrug.clockMs(t, K) - K.sendMs)/3.6e6), 1)} h</div><div class="k-cap">lotu światła z Warszawy</div>`);
  add('poscig', 4.2, 9.6, 'line', 'Prawdziwa skala: kropka to 66 tys. km światła, kreska — 198 tys. km.');
  if(Number.isFinite(vgr.tCross)){
    const a = vgr.tCross - st('poscig');
    add('poscig', a - 0.4, Math.min(a + 4.6, Mrug.shotDur('poscig')), 'line',
      `${_kfmt(kino.crossMs)}: Voyager przekracza granicę dnia świetlnego. Mrugnięcie leci ${Kino.fmtDec((vgr.arrMs - kino.crossMs)/3.6e6, 1)} h za nim.`);
  }
  const tp = vgr.tPass - st('przylot');
  add('przylot', 0.6, tp - 0.3, 'line', `Ostatnie ${Kino.fmtDec(K.dEnd/AU_SCALE*ProbeEphem.AU_KM/1e6, 1)} mln km. Czas płynie normalnie.`);
  add('przylot', tp - 0.1, tp + 5.2, 'title', `<div class="k-eye">${_kfmt(vgr.arrMs, true)}</div><div class="k-h1">Doleciało</div><div class="k-sub">Mrugnięcie z Polski mija Voyagera 1 — po dobie lotu.</div>`);
  add('przylot', tp + 5.4, 13.9, 'line', 'Sonda leci 17 km/s. Światło mija ją, jakby stała w miejscu.');
  add('kropka', 2.0, 7.8, 'line', ()=>{
    const V = kino.mk.position, E = worldPos(bodies.find(b=>b.data.earth));
    const ang = E.clone().sub(V).angleTo(sun.position.clone().sub(V)) * 180/Math.PI;
    return `Stąd Ziemia jest ${Kino.fmtDec(ang, 2)}° od Słońca — bladą kropką. To światło wyleciało dobę temu.`; });
  add('kropka', 8.2, 15.7, 'line', 'Voyager tego nie zobaczy — kamery wyłączono w 1990 roku. Światło leci dalej, między gwiazdy.');
  return c;
}
function vgrMorseHtml(t){
  const m = Mrug.morseAt((t - Mrug.shotStart('nadawanie'))/Mrug.UNIT_S, vgr.seq);
  const L = ['V','G','R'].map((ch, i)=>`<span class="${i===m.letter ? 'on' : ''}">${ch}</span>`).join('');
  const sym = vgr.seq.map((el, i)=> el.on ? `<i class="${i===m.el ? 'on' : ''}">${el.u === 1 ? '·' : '–'}</i>` : (el.u > 1 ? '<b> </b>' : '')).join('');
  return `<div class="k-big k-vgrL">${L}</div><div class="k-cap k-vgrS">${sym}</div>`;
}

function vgrAnchors(){
  const E = worldPos(bodies.find(b=>b.data.earth));
  vgr.hero.getWorldPosition(_vV);
  return { E:_va(E), Es:vgr.Es, V:_va(kino.mk.position), S:_va(sun.position), rE:vgr.rE, pr:vgr.pr,
           pl: Kino._v.norm([_vV.x - E.x, _vV.y - E.y, _vV.z - E.z]) };
}

function vgrCities(t, clk, on){
  vgr.pts.visible = on; if(!on) return;
  const dec = Mrug.sunDecl(clk)*Math.PI/180, sd = Math.sin(dec), cd = Math.cos(dec), ls = Mrug.subSolarLon(clk)*Math.PI/180;
  const a = vgr.col.array, u = t/Mrug.UNIT_S; let best = 0, name = '';
  for(let i=0; i<vgr.n; i++){
    const H = vgr.lon[i] - ls;                                        // kąt godzinny: wieczór gdy sin H > 0 (świt odpada)
    const w = Math.sin(H) > 0 ? Mrug.dusk(vgr.sLat[i]*sd + vgr.cLat[i]*cd*Math.cos(H)) : 0;
    let b = 0;
    if(w > 0){
      b = w * (Mrug.morseAt(u + vgr.ph[i], vgr.seq).on ? 1 : 0.08) * Math.min(1, 0.35 + Math.log10(vgr.pop[i]/150000)*0.45);
      if(w > 0.6 && vgr.pop[i] > best){ best = vgr.pop[i]; name = vgr.names[i]; }
    }
    a[i*3] = b; a[i*3+1] = b*0.78; a[i*3+2] = b*0.42;                // bursztyn latarek — odróżnia się od białych świateł miast
  }
  vgr.col.needsUpdate = true; vgr.city = name;
}

function vgrLoop(now){
  if(!kino.active) return;
  kino.raf = requestAnimationFrame(vgrLoop);
  if(kino.paused) return;
  const t = (now - kino.t0)/1000, T = Mrug.total(), K = vgr.K;
  if(t >= T){ kinoEnd(false); return; }
  const clk = Mrug.clockMs(t, K);
  if(clk !== kino.lastClock){ kino.clockMs = clk; kino.earthMs = clk; kino.lastClock = clk; placeBodiesAt(clk); updateProbes(); }
  const A = vgrAnchors(), p = Mrug.pose(t, A, K);
  camera.position.set(p.pos[0], p.pos[1], p.pos[2]);
  controls.target.set(p.target[0], p.target[1], p.target[2]);
  const dir = Kino._v.norm(Kino._v.sub(p.target, p.pos)), up = Kino.rotate([0,1,0], dir, p.roll);
  camera.up.copy(_kUp.set(up[0], up[1], up[2]));
  if(Math.abs(camera.fov - p.fov) > 1e-3){ camera.fov = p.fov; camera.updateProjectionMatrix(); }
  camera.lookAt(controls.target);
  const L = Mrug.locate(t), id = L.shot.id;
  let gate = 0, flash = 0;
  // I–II: miasta o zmierzchu; II: latarka w Warszawie (Morse w czasie rzeczywistym)
  vgrCities(t, clk, id === 'zmierzch' || id === 'nadawanie');
  const heroOn = id === 'nadawanie' && Mrug.morseAt(L.local/Mrug.UNIT_S, vgr.seq).on;
  vgr.hero.visible = id === 'nadawanie' || (id === 'poscig' && L.f < 0.12);
  { const s = heroOn ? 0.16 : 0.035; vgr.hero.scale.set(s, s, 1); }
  if(heroOn){ gate = 0.07; flash = 0.10; }
  // III–IV: pociąg błysków na promieniu (czoło jedzie z prędkością światła)
  const dF = Mrug.front(t, K);
  vgr.train.visible = dF !== null && id !== 'kropka';
  if(vgr.train.visible){
    const u = Kino._v.norm(Kino._v.sub(A.V, vgr.Es)), ul = Mrug.UNIT_S*1000*K.c;
    vgr.train.children.forEach((s, j)=>{ const d = dF - vgr.offs[j]*ul;
      s.visible = d > vgr.rE*1.02;
      s.position.set(vgr.Es[0] + u[0]*d, vgr.Es[1] + u[1]*d, vgr.Es[2] + u[2]*d);
      const k = 0.018 + 0.0025*Math.sin(now*0.02 + j); s.scale.set(k, k, 1); });
    // przelot przez sondę: każdy element Morse'a błyska na sondzie i brzmi
    const x = (dF - K.D)/ul;
    if(x >= 0 && x < Mrug.seqUnits(vgr.seq) - 7){
      const m = Mrug.morseAt(x, vgr.seq);
      vgr.glint.visible = m.on; vgr.glint.position.copy(kino.mk.position); vgr.glint.scale.set(0.09, 0.09, 1);
      if(m.on) gate = 0.08;
    } else vgr.glint.visible = false;
    if(!vgr.passed && x >= 0){ vgr.passed = true; vgrBell(); }
  } else vgr.glint.visible = false;
  // błona dnia świetlnego rozbłyska, gdy przechodzi przez nią czoło (w przylocie)
  const tp = vgr.tPass;
  const fl = id === 'przylot' ? Math.exp(-Math.pow((t - tp)/(t < tp ? 0.3 : 1.1), 2)) : 0;
  kino.ld.film.material.color.setScalar(1 + 5*fl); flash = Math.max(flash, 0.45*fl);
  kino.ld.label.visible = id !== 'kropka' && !(t > tp - 0.5 && t < tp + 5.4);
  // V: kropka Ziemi zza sondy mruga V-G-R (światło sprzed doby); ciemne niebo od połowy odjazdu
  vgr.dot.visible = id === 'kropka';
  vgrDark(id === 'kropka' && L.f > 0.22);
  if(vgr.dot.visible){
    const on = Mrug.morseAt(L.local/Mrug.UNIT_S, vgr.seq).on, s = on ? 0.03 : 0.011;
    vgr.dot.position.copy(worldPos(bodies.find(b=>b.data.earth))); vgr.dot.scale.set(s, s, 1);
    if(on && L.f > 0.5) gate = 0.045;
  }
  document.getElementById('kFlash').style.opacity = flash.toFixed(3);
  // HUD: data + tempo czasu
  const r = Mrug.clockRate(t, K), dEl = document.getElementById('kDate');
  dEl.textContent = _kfmt(clk, true) + (r > 1.5 ? `  ·  czas ×${Kino.fmtInt(r)}` : '  ·  czas ×1');
  dEl.classList.add('show');
  document.getElementById('kProg').style.width = (100*t/T).toFixed(2) + '%';
  document.getElementById('kFade').style.opacity = Math.max(1 - t/1.6, Math.max(0, (t - (T - 1.2))/1.2)).toFixed(3);
  kinoSlots(t);
  vgr.snd = { gate, open: vgrAudioOpen(L) };                         // stan dźwięku klatki (nagranie wideo: scripts/video-mrug.mjs)
  vgrAudioTick(L, gate);
}

function vgrBell(){
  const A = kino.audio; if(!A || !A.live) return;
  [293.66, 440, 587.33, 739.99, 1318.5].forEach((f, i)=>kinoPing(f, 0.08/(1+i*0.4), 6 + i));
}
function vgrAudioOpen(L){                                          // filtr otwiera się z ujęciem; najszerzej w pościgu
  return { zmierzch:300, nadawanie:520, poscig:900, przylot:650, kropka:420 }[L.shot.id] +
         (L.shot.id === 'poscig' ? 1300*Math.sin(Math.PI*L.f) : 0);
}
function vgrAudioTick(L, gate){
  const A = kino.audio; if(!A || !A.live) return;
  const ctx = A.ctx;
  A.lp.frequency.setTargetAtTime(vgrAudioOpen(L), ctx.currentTime, 0.35);
  if(A.vgrBeepFor !== A.oscs){                                      // ton Morse'a (bramkowany), na nowo po każdym starcie dźwięku
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = 660; g.gain.value = 0;
    o.connect(g); g.connect(A.out); o.start(); A.oscs.push(o); A.vgrBeep = g; A.vgrBeepFor = A.oscs;
  }
  A.vgrBeep.gain.setTargetAtTime(gate, ctx.currentTime, 0.006);
}

function vgrStart(){
  if(!kino.ready || !vgr.built) return;
  kino.film = 'vgr';
  const P = PROBES.find(p=>p.id===KINO_PROBE), e = probeEphem(P);
  kino.crossMs = Date.parse(e.lightDay.geometric); kino.downMs = Date.parse(e.lightDay.downlink);
  kino.mk = probes.byId[KINO_PROBE].mk;
  kino.ld = probes.lightDay.find(m=>m.id===KINO_PROBE);
  if(!kino.ld){ kino.ld = buildLightDayMembrane(P); probes.lightDay.push(kino.ld); }
  // kotwice: Warszawa nadaje chwilę po zachodzie (Słońce 3° pod horyzontem); czoło leci od Ziemi z chwili nadania
  const sendMs = Mrug.sendTime(VGR_PL.lon, VGR_PL.lat, Date.UTC(2026, 10, 17, 12), -3);
  const earthEl = Ephemeris.REAL_PLANETS.find(x=>x.id==='earth');
  vgr.Es = _va(eclToScene(Ephemeris.positionAt(earthEl, Ephemeris.julianDate(sendMs))));
  const c = ProbeEphem.LIGHT_DAY_AU*AU_SCALE/86400000;
  let arr = sendMs + 86400000, D = 0;
  for(let i=0; i<4; i++){ D = Kino._v.len(Kino._v.sub(_va(eclToScene(ProbeEphem.positionAt(e.samples, Ephemeris.julianDate(arr)))), vgr.Es)); arr = sendMs + D/c; }
  const em = bodies.find(b=>b.data.earth).mesh; if(!em.geometry.boundingSphere) em.geometry.computeBoundingSphere();
  vgr.rE = em.geometry.boundingSphere.radius * em.getWorldScale(_vV).x;
  vgr.pr = Math.max(0.05, new THREE.Box3().setFromObject(kino.mk).getBoundingSphere(new THREE.Sphere()).radius);
  vgr.K = { startMs: Date.UTC(2026, 10, 17, 6, 30), sendMs, D, c, rE: vgr.rE, dEnd: 0.4 };
  vgr.arrMs = arr; vgr.tCross = Mrug.tAtClock(kino.crossMs, vgr.K); vgr.tPass = Mrug.tPass(vgr.K); vgr.passed = false;
  if(!kino.saved) kino.saved = { min:controls.minDistance, max:controls.maxDistance, fov:camera.fov };
  focused = null; focusedMoon = null; focusedShip = false; tween = null; if(tour) stopTour();
  elInfo.classList.remove('show'); elBack.classList.remove('show');
  controls.enabled = false; controls.minDistance = 0; controls.maxDistance = Infinity;
  renderer.domElement.style.pointerEvents = 'none';
  PROBES.forEach(p=>{ if(p.atBody && probes.byId[p.id]) probes.byId[p.id].mk.visible = false; });
  vgrShow(true);
  kino.cues = vgrCues();
  document.querySelectorAll('#kino .k-slot').forEach(s=>{ s._cue = null; s.classList.remove('show'); });
  document.getElementById('kino').classList.remove('end', 'loading');
  document.body.classList.add('kino-on', 'kino-run');
  kino.active = true; kino.lastClock = NaN;
  kinoPauseSet(false); kino.t0 = performance.now();
  if(kino.audio && kino.audio.on) kinoAudioStart();
  cancelAnimationFrame(kino.raf); kino.raf = requestAnimationFrame(vgrLoop);
}

if(/[?&]mrugniecie\b/.test(location.search)){
  kino.film = 'vgr';
  kinoBuildDom(); document.body.classList.add('kino-on', 'kino-run'); document.getElementById('kino').classList.add('loading');
  { const end = document.getElementById('kEnd');                       // karta końcowa tego filmu
    end.querySelector('.k-h1').textContent = 'Mrugnięcie';
    end.querySelector('.k-sub').innerHTML = 'Dane: NASA/JPL Horizons · film 1: <a href="https://voyager.kodownik.co/">Voyager 1 na granicy dnia świetlnego</a>';
    end.querySelector('.k-next').remove(); }                           // link „Film 2” tylko na karcie filmu 1
  addEventListener('keydown', e=>{ if(e.key==='Escape' && kino.active){ kinoEnd(true); e.stopImmediatePropagation(); } }, true);
  addEventListener('keydown', e=>{ if(e.key===' ' && kino.active && !(e.target.closest && e.target.closest('button'))){ kinoPauseToggle(); e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  fetch('geo/edu-data.json?v='+APP_VER).then(r=>r.json()).then(vgrBuild).catch(err=>console.error('mrugniecie: edu-data', err));
  const boot = ()=>{
    if(!document.getElementById('loader').classList.contains('hide') || !PROBE_EPHEM || !vgr.built){ setTimeout(boot, 120); return; }
    if(!probes.active){ startProbes(); setToggle('tProbes', true); }
    const wait = ()=>{
      if(!probes.byId[KINO_PROBE]){ setTimeout(wait, 80); return; }
      try{ const ei = SKINS.earth.findIndex(s=>s.live); if(ei > 0) applySkin('earth', ei); }catch(e){ console.error('kino skin', e); }
      showLabels = false; labelLayer.style.display = 'none'; setToggle('tLabels', false);
      showClouds = false; { const ec = PLANETS.find(p=>p.earth); if(ec && ec._clouds) ec._clouds.visible = false; } setToggle('tClouds', false);
      vgr.pts.visible = true; try{ renderer.compile(scene, camera); }catch(e){ console.error('kino compile', e); }
      kino.ready = true; vgrStart();
    };
    wait();
  };
  boot();
  window.__kino = kino; window.__vgr = vgr;
}
