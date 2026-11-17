/* ============================================================
   system-render.js — wspólne helpery renderu ciał układu (Task 3)
   Ekstrakcja 1:1 z inline kodu solar.js (PLANETS.forEach, linie ~803-899),
   by przyszły buildStarSystem (Task 5) mógł je reużyć.
   Zależy od THREE (global) + DOM — dual-export pominięty celowo
   (funkcje operują na THREE/document, więc nie są testowane w node --test).
   ============================================================ */
(function (root) {
  'use strict';

  // Sfera ciała (planeta/księżyc) — SphereGeometry(radius,64,64) jak solar.js:822.
  function buildBodyMesh(radius, material){
    return new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 64), material);
  }

  // Pierścień orbity — DOSŁOWNIE kod z solar.js:882-887 (BufferGeometry koła + LineBasicMaterial).
  function buildOrbitLine(distScene, colorHex){
    const seg=128, op=new Float32Array((seg+1)*3);
    for(let i=0;i<=seg;i++){ const a=i/seg*Math.PI*2; op[i*3]=Math.cos(a)*distScene; op[i*3+2]=Math.sin(a)*distScene; }
    const og=new THREE.BufferGeometry(); og.setAttribute('position',new THREE.BufferAttribute(op,3));
    const orbitLine=new THREE.Line(og,new THREE.LineBasicMaterial({color:colorHex,transparent:true,opacity:0.28}));
    return orbitLine;
  }

  // Etykieta 2D — div.lab dopięty do przekazanego labelLayer, jak solar.js:895-898.
  function buildLabel(text, colorHex, onClick, labelLayer){
    const el=document.createElement('div'); el.className='lab'; el.textContent=text;
    el.style.color = '#'+new THREE.Color(colorHex).getHexString();
    if(onClick) el.onclick = onClick;
    labelLayer.appendChild(el);
    return el;
  }

  var SystemRender = { buildBodyMesh: buildBodyMesh, buildOrbitLine: buildOrbitLine, buildLabel: buildLabel };
  root.SystemRender = SystemRender;
})(typeof window !== 'undefined' ? window : globalThis);
