'use strict';
/* Lista zjawisk naukowych na stronie /uklad/filmy/ — budowana z rejestru zjawisk (zjawiska/rejestr.js), nie wpisywana
   ręcznie: nowe zjawisko w rejestrze pojawia się tu samo. Adres kroku buduje ZjawiskaLogika.budujHash (jedno źródło
   formatu hasha). Dual-export: `pozycje` testowana w node (test/filmy.test.js), w przeglądarce rysuje listę. */
(function (root) {
  // rejestr + budujHash → [{href, tytul, opis}]; wpis bez id albo tytułu = błąd (nie zgadujemy etykiety)
  function pozycje(rejestr, budujHash) {
    if (!Array.isArray(rejestr)) throw new Error('lista-zjawisk: rejestr nie jest tablicą');
    return rejestr.map(function (z, i) {
      if (!z || !z.id || !z.tytul) throw new Error('lista-zjawisk: wpis ' + i + ' rejestru bez id albo tytułu');
      return { href: '../' + budujHash(z.id, 1), tytul: z.tytul, opis: z.opis || '' };
    });
  }

  function rysuj(doc, ul, lista) {
    lista.forEach(function (p) {
      var li = doc.createElement('li'), a = doc.createElement('a');
      a.href = p.href; a.textContent = p.tytul; li.appendChild(a);
      if (p.opis) { var o = doc.createElement('div'); o.className = 'zj-opis'; o.textContent = p.opis; li.appendChild(o); }
      ul.appendChild(li);
    });
  }

  var api = { pozycje: pozycje, rysuj: rysuj };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.FilmyListaZjawisk = api;
  var ul = root.document && root.document.getElementById('zjawiskaLista');
  if (ul && root.ZjawiskaRejestr && root.ZjawiskaLogika) {
    rysuj(root.document, ul, pozycje(root.ZjawiskaRejestr, root.ZjawiskaLogika.budujHash));
  }
})(typeof self !== 'undefined' ? self : this);
