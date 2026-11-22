'use strict';
/* Zakładka Geologia → makieta — warstwa „Wulkany” (Task 8c). Dual-export: czysta część w node (module.exports),
   w przeglądarce window.GeologiaWulkanyScena. Wzorzec: geologia/turystyka-scena.js.
   Czysta część:
     WYGLAD[grupa] → { px, prio } — wielkość pinu (px CSS) i kolejność rozrzedzania etykiet;
     stalaEtykieta(pin) → true dla grup `strato` i `historyczne` (pozostałe: etykieta tylko na wskazanie / wybór);
     tekstEtykiety(pin) → napis pinu (etykieta wpisu, nazwa OSM albo „stożek bez nazwy”).
   Przeglądarka: utworzWarstwe(T, sc, piny, opcje) — warstwa przez hak sceny `sc.dodajWarstwe` (zasoby GPU przez helper
   z() sceny, G-L: zwalnia je sc.zwolnij()). Piny = trójkąty (kształt odróżnia je od okrągłych pinów turystyki) w barwie
   grupy (opcje.kolory), stałej wielkości w pikselach, rysowane na wierzchu; wysokość z powierzchni BIEŻĄCEJ chwili
   i bieżącego przewyższenia (ctx.wysokosc — G-D), przeliczana przy zmianie przewyższenia albo czasu. Etykiety stałe
   (strato, historyczne) rozrzedzane w kolejności priorytetu i omijające prostokąty innych warstw (opcje.zajeteInne());
   etykieta pozostałego stożka — jeden wspólny sprite przerysowywany przy wskazaniu (liczba tekstur stała).
   Widok (widok.js) pokazuje warstwę tylko przy czasie = dziś, bez przekroju i animacji. */
(function (root) {
  var Teren = root.Teren || (typeof require === 'function' ? require('./teren.js') : null);
  var RAD = Math.PI / 180;
  var WYGLAD = { strato: { px: 22, prio: 100 }, historyczne: { px: 17, prio: 80 }, pozostale: { px: 11, prio: 10 } };

  /* ---------- czysta część ---------- */
  function stalaEtykieta(p) { return !!p && (p.grupa === 'strato' || p.grupa === 'historyczne'); }
  function tekstEtykiety(p) { return (p && (p.etykieta || p.nazwa)) || 'stożek bez nazwy'; }

  var api = { WYGLAD: WYGLAD, stalaEtykieta: stalaEtykieta, tekstEtykiety: tekstEtykiety, utworzWarstwe: null };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---------- przeglądarka: warstwa 3D ---------- */
  var SKALA_ET = 0.56;
  function plotno(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  var FONT = function (F) { return '600 ' + F + 'px system-ui, "Segoe UI", sans-serif'; };
  // Napis etykiety na płótnie (ciemny podkład, pasek w barwie grupy z lewej) — zwraca [szer, wys] w px płótna.
  function rysujEtykiete(c, tekst, kolor) {
    var F = 26, pad = 10, x = c.getContext('2d');
    x.font = FONT(F);
    var szer = Math.ceil(x.measureText(tekst).width) + pad * 2 + 6, wys = F + 16;
    if (c.width !== szer || c.height !== wys) { c.width = szer; c.height = wys; x = c.getContext('2d'); }
    x.clearRect(0, 0, szer, wys);
    x.fillStyle = 'rgba(8,11,15,0.78)'; x.fillRect(0, 0, szer, wys);
    x.fillStyle = kolor; x.fillRect(0, 0, 6, wys);
    x.font = FONT(F); x.fillStyle = '#ffffff'; x.textBaseline = 'middle'; x.fillText(tekst, pad + 6, wys / 2 + 1);
    return [szer, wys];
  }

  function utworzWarstwe(T, sc, piny, opcje) {
    opcje = opcje || {};
    var kolory = opcje.kolory || {};
    return sc.dodajWarstwe(function (ctx) {
      var z = ctx.z, grupa = new T.Group();
      grupa.name = 'wulkany'; grupa.visible = false;
      ctx.scena.add(grupa);
      // trójkąt (wierzchołek do góry) z ciemną obwódką — biały, barwę daje materiał grupy
      var trojkat = (function () {
        var c = plotno(64, 64), x = c.getContext('2d');
        x.beginPath(); x.moveTo(32, 6); x.lineTo(59, 56); x.lineTo(5, 56); x.closePath();
        x.fillStyle = '#ffffff'; x.fill(); x.lineJoin = 'round'; x.lineWidth = 7; x.strokeStyle = 'rgba(8,11,15,0.92)'; x.stroke();
        var t = z(new T.CanvasTexture(c)); t.encoding = T.sRGBEncoding; return t;
      })();
      var materialy = {};
      Object.keys(WYGLAD).forEach(function (g) {
        materialy[g] = z(new T.SpriteMaterial({ map: trojkat, color: new T.Color(kolory[g] || '#ffffff'), sizeAttenuation: false, depthTest: false,
          fog: false, toneMapped: false }));
      });
      var lista = [];
      piny.forEach(function (p) {
        var w = WYGLAD[p.grupa] || WYGLAD.pozostale, q = Teren.doLokalnych(null, p.lon, p.lat);
        var glowa = new T.Sprite(materialy[p.grupa] || materialy.pozostale);
        glowa.center.set(0.5, 0.06); glowa.renderOrder = 13; glowa.name = 'wulkan-' + p.id;   // pod pinami (14) i napisami (15) Turystyki
        grupa.add(glowa);
        var P = { p: p, x: q[0], z: q[1], glowa: glowa, w: w, et: null, px: null, widoczna: false, poz: new T.Vector3(), q: new T.Vector3() };
        if (stalaEtykieta(p)) {
          var c = plotno(8, 8), wym = rysujEtykiete(c, tekstEtykiety(p), kolory[p.grupa] || '#ffffff');
          var tEt = z(new T.CanvasTexture(c)); tEt.encoding = T.sRGBEncoding; tEt.minFilter = T.LinearFilter; tEt.generateMipmaps = false;
          var et = new T.Sprite(z(new T.SpriteMaterial({ map: tEt, sizeAttenuation: false, depthTest: false, fog: false, toneMapped: false })));
          et.center.set(0.5, -0.2); et.renderOrder = 17; et.visible = false;
          grupa.add(et);
          P.et = et; P.px = wym;
        }
        lista.push(P);
      });
      // wspólna etykieta wskazanego / wybranego stożka bez stałej etykiety (jedna tekstura, przerysowywana)
      var cH = plotno(8, 8), tH = z(new T.CanvasTexture(cH)); tH.encoding = T.sRGBEncoding; tH.minFilter = T.LinearFilter; tH.generateMipmaps = false;
      var etH = new T.Sprite(z(new T.SpriteMaterial({ map: tH, sizeAttenuation: false, depthTest: false, fog: false, toneMapped: false })));
      etH.center.set(0.5, -0.2); etH.renderOrder = 18; etH.visible = false;
      grupa.add(etH);
      var hPx = [1, 1], hDla = null;
      var wybrany = null, najechany = null, nInneOst = 0;

      var klucz = null;
      function ustawPiny() {
        var k = ctx.przewyzszenie() + '|' + ctx.czasMa();
        if (k === klucz) return;
        klucz = k;
        lista.forEach(function (P) {
          var y = Math.max(0, ctx.wysokosc(P.x, P.z) || 0) + 0.01;
          P.poz.set(P.x, y, P.z); P.glowa.position.copy(P.poz); if (P.et) P.et.position.copy(P.poz);
        });
      }
      function znajdz(id) { return lista.filter(function (P) { return P.p.id === id; })[0] || null; }

      var rozm = new T.Vector2(), wek = new T.Vector3(), zajete = [];
      function rzut(v, q) { wek.copy(v).project(ctx.kamera); q.set((wek.x + 1) / 2 * rozm.x, (1 - wek.y) / 2 * rozm.y, wek.z); return q; }
      function rozmiar(P) { return P.p.id === wybrany ? P.w.px + 6 : P.p.id === najechany ? P.w.px + 4 : P.w.px; }
      // klatka: wielkość pinów, rozrzedzanie etykiet; zwraca prostokąty zajęte przez warstwę [x0,y0,x1,y1,…] (px CSS)
      function animuj() {
        zajete.length = 0;
        if (!grupa.visible) return zajete;
        ctx.renderer.getSize(rozm);
        ustawPiny();
        var kk = 2 * Math.tan(ctx.kamera.fov * RAD / 2) / Math.max(1, rozm.y);
        var inne = opcje.zajeteInne ? opcje.zajeteInne() : null, nInne = inne ? inne.length : 0;
        nInneOst = nInne / 4;
        var zaj = function (x0, y0, x1, y1) {
          for (var j = 0; j < nInne; j += 4) if (x0 < inne[j + 2] && x1 > inne[j] && y0 < inne[j + 3] && y1 > inne[j + 1]) return true;
          for (j = 0; j < zajete.length; j += 4) if (x0 < zajete[j + 2] && x1 > zajete[j] && y0 < zajete[j + 3] && y1 > zajete[j + 1]) return true;
          return false;
        };
        var kolej = lista.slice().sort(function (a, b) {
          return (b.p.id === wybrany) - (a.p.id === wybrany) || (b.p.id === najechany) - (a.p.id === najechany) || b.w.prio - a.w.prio;
        });
        // najpierw piny (trójkąty grup z etykietą zajmują miejsce przed etykietami), potem etykiety w kolejności priorytetu
        for (var i = 0; i < kolej.length; i++) {
          var P = kolej[i], s = rozmiar(P);
          P.glowa.scale.set(s * kk, s * kk, 1);
          rzut(P.poz, P.q);
          // miejsce zajmują tylko piny z etykietą stałą (i wskazany) — gęste drobne stożki nie gaszą napisów Teide czy Chinyero
          if (P.q.z < 1 && (P.et || P.p.id === wybrany || P.p.id === najechany)) zajete.push(P.q.x - s / 2, P.q.y - s, P.q.x + s / 2, P.q.y);
        }
        var hover = null;
        for (i = 0; i < kolej.length; i++) {
          P = kolej[i];
          if (!P.et) { if (!hover && (P.p.id === wybrany || P.p.id === najechany)) hover = P; continue; }
          var w = P.px[0] * SKALA_ET, h = P.px[1] * SKALA_ET, s2 = rozmiar(P);
          // dolna krawędź napisu 3 px nad wierzchołkiem trójkąta (center w ułamkach wysokości sprite'a) — ten sam prostokąt
          // trafia do zajętych, więc rozrzedzanie widzi napis tam, gdzie jest narysowany
          P.et.scale.set(w * kk, h * kk, 1); P.et.center.y = -(s2 + 3) / h;
          var x0 = P.q.x - w / 2, y1 = P.q.y - s2 - 3, y0 = y1 - h;
          var ok = P.q.z < 1 && x0 + w > 0 && x0 < rozm.x && y0 > 0 && P.q.y < rozm.y;
          if (ok && P.p.id !== wybrany && P.p.id !== najechany) ok = !zaj(x0 - 2, y0, x0 + w + 2, y1);
          P.et.visible = P.widoczna = ok;
          if (ok) zajete.push(x0 - 4, y0 - 2, x0 + w + 4, y1 + 2);
        }
        if (hover && hover.q.z < 1) {
          if (hDla !== hover.p.id) { hPx = rysujEtykiete(cH, tekstEtykiety(hover.p), kolory[hover.p.grupa] || '#ffffff'); tH.needsUpdate = true; hDla = hover.p.id; }
          var wh = hPx[0] * SKALA_ET, hh = hPx[1] * SKALA_ET;
          etH.position.copy(hover.poz); etH.scale.set(wh * kk, hh * kk, 1); etH.center.y = -(rozmiar(hover) + 3) / hh; etH.visible = true;
          var hy1 = hover.q.y - rozmiar(hover) - 3;
          zajete.push(hover.q.x - wh / 2 - 4, hy1 - hh - 2, hover.q.x + wh / 2 + 4, hy1 + 2);
        } else etH.visible = false;
        return zajete;
      }

      // wskazywanie: pin ≤ max(14 px, pół pinu + 4) od środka trójkąta; przy nakładaniu wygrywa wyższy priorytet grupy
      function pick(nx, ny) {
        if (!grupa.visible) return null;
        ctx.kamera.updateMatrixWorld(); ctx.renderer.getSize(rozm);
        ustawPiny();
        var kx = (nx + 1) / 2 * rozm.x, ky = (1 - ny) / 2 * rozm.y, najl = null, ocena = Infinity;
        lista.forEach(function (P) {
          rzut(P.poz, P.q);
          if (P.q.z >= 1) return;
          var s = rozmiar(P), d = Math.hypot(P.q.x - kx, P.q.y - s / 2 - ky);
          if (d > Math.max(14, s / 2 + 4)) return;
          var o = d - P.w.prio / 15;
          if (o < ocena) { ocena = o; najl = { typ: 'wulkan', id: P.p.id }; }
        });
        return najl;
      }

      return {
        grupa: grupa, animuj: animuj, pick: pick,
        widoczna: function (wl) { if (wl != null) { grupa.visible = !!wl; klucz = null; } return grupa.visible; },
        wybierz: function (id) { wybrany = id || null; },
        najedz: function (id) { najechany = id || null; },
        // hak widoku i sondy: rzut środka trójkąta pinu na kanwę (px CSS)
        rzutPinu: function (id) {
          var P = znajdz(id);
          if (!P) return null;
          klucz = null; ustawPiny(); ctx.kamera.updateMatrixWorld(); ctx.renderer.getSize(rozm);
          rzut(P.poz, P.q);
          return { x: P.q.x, y: P.q.y - rozmiar(P) / 2, z: P.q.z };
        },
        pozycja: function (id) { var P = znajdz(id); if (!P) return null; ustawPiny(); return [P.poz.x, P.poz.y, P.poz.z]; },
        stan: function () {
          var n = { strato: 0, historyczne: 0, pozostale: 0 };
          lista.forEach(function (P) { n[P.p.grupa] = (n[P.p.grupa] || 0) + 1; });
          return { widoczna: grupa.visible, piny: lista.length, prostokatyInnych: nInneOst, grupy: n, wybrany: wybrany, najechany: najechany, etykietaWskazania: etH.visible ? hDla : null,
            etykiety: lista.filter(function (P) { return P.widoczna; }).map(function (P) { return P.p.id; }) };
        }
      };
    });
  }
  api.utworzWarstwe = utworzWarstwe;
  root.GeologiaWulkanyScena = api;
})(typeof window !== 'undefined' ? window : globalThis);
