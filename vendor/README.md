# Lokalne kopie bibliotek

| Plik | Źródło | Wersja | Licencja |
|---|---|---|---|
| `three-r128/OrbitControls.js` | `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js` (bajtowo zgodny z `unpkg.com/three@0.128.0/…`) | three.js r128 / 0.128.0 | MIT, © 2010–2021 three.js authors |

Dlaczego lokalnie: skrypt z jsdelivr sporadycznie nie dochodził (w headless smoke ok. 1 na 60 przebiegów:
`THREE.OrbitControls is not a constructor`), a wtedy scena nie startuje. Wersja musi zgadzać się z `three.min.js`
r128 z cdnjs — przy podbiciu three podmień oba naraz. Plików nie edytujemy ręcznie.
