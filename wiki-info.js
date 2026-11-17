/* ============================================================
   wiki-info.js — buildery URL Wikipedii + walidacja odpowiedzi.
   Czysta logika (bez DOM/THREE). UMD jak ephemeris.js.
   Używany przez: tooltip geo (fetchDesc) ORAZ modal „Informacje".
   ============================================================ */
(function (root) {
  'use strict';

  // REST summary. UWAGA: tytuły z '/' psują ten endpoint (HTTP 400) —
  // dla nich podawaj jawny tytuł bez ukośnika (np. en 'Comet NEOWISE').
  function summaryUrl(lang, title) {
    return 'https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/'
      + encodeURIComponent(title);
  }

  function pageUrl(lang, title) {
    return 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(title);
  }

  // Waliduje odpowiedź summary. opts.near OPCJONALNE: tylko geo-tooltip
  // sprawdza bliskość współrzędnych (odrzuca artykuł o tej samej nazwie
  // na innym kontynencie). Bez near → akceptuj bez sprawdzania.
  function acceptSummary(json, opts) {
    if (!json) return null;
    if (json.type === 'disambiguation') return null;
    var extract = json.extract;
    if (!extract || !extract.trim()) return null;
    var near = opts && opts.near;
    if (near && !near(json.coordinates)) return null;
    var thumb = (json.thumbnail && json.thumbnail.source) || null;
    var url = (json.content_urls && json.content_urls.desktop && json.content_urls.desktop.page) || null;
    return { extract: extract, thumbnail: thumb, url: url };
  }

  // Karta satelity w katalogu N2YO (opis + tracking na żywo) po numerze NORAD.
  function catalogUrl(norad) {
    return 'https://www.n2yo.com/satellite/?s=' + encodeURIComponent(String(norad));
  }

  var api = { summaryUrl: summaryUrl, pageUrl: pageUrl,
              acceptSummary: acceptSummary, catalogUrl: catalogUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WikiInfo = api;
})(typeof self !== 'undefined' ? self : this);
