/* Selectables — rejestr rodzajów obiektów, które można wybrać (kliknięciem, z paska, z menu).
   JEDNO źródło prawdy dla: etykiety w oknie „Informacje", akcji kliknięcia i modelu karty #info.
   Nowy rodzaj = jeden wpis w KINDS (solar.js) + cel raycastu w pickAt; konsumenci (klik, modal,
   karta) wyprowadzają się z rejestru. Rodzaj bez obsługi NIE dostaje wartości zastępczej —
   rejestr rzuca błąd z komunikatem, co dopisać.
   Czysta logika, bez DOM/THREE. Dual-export: CommonJS (node --test) + window.Selectables. */
(function (root) {
  'use strict';

  const fail = (msg) => { throw new Error('Selectables: ' + msg); };

  // Waliduje i zamraża rejestr. Pola wpisu:
  //   label  (string, wymagane)       — nagłówek w oknie „Informacje"
  //   select (function|null, wymagane) — akcja kliknięcia select(ref, obj, ctx); null = jawnie „bez akcji"
  //   card   (function, opcjonalne)   — card(ref) → {eye, name, sub, facts?, rail?, skins?} dla karty #info
  function defineKinds(specs) {
    if (!specs || typeof specs !== 'object') fail('defineKinds oczekuje obiektu {rodzaj: wpis}');
    const out = {};
    for (const [kind, s] of Object.entries(specs)) {
      if (!s || typeof s !== 'object') fail(`rodzaj „${kind}” nie jest obiektem`);
      if (typeof s.label !== 'string' || !s.label)
        fail(`rodzaj „${kind}” nie ma pola label (nagłówek okna „Informacje”) — dopisz je w KINDS`);
      if (!('select' in s) || (s.select !== null && typeof s.select !== 'function'))
        fail(`rodzaj „${kind}” nie ma select(ref) — dopisz funkcję albo jawne select:null (klik bez akcji)`);
      if ('card' in s && typeof s.card !== 'function')
        fail(`rodzaj „${kind}”: card musi być funkcją card(ref) → {eye, name, sub, facts}`);
      out[kind] = Object.freeze(Object.assign({}, s));
    }
    return Object.freeze(out);
  }

  function spec(kinds, kind) {
    const s = kinds[kind];
    if (!s) fail(`nieznany rodzaj „${kind}” — dodaj wpis w KINDS (solar.js)`);
    return s;
  }

  const kindsOf = (kinds) => Object.keys(kinds);
  const label = (kinds, kind) => spec(kinds, kind).label;
  const hasCard = (kinds, kind) => typeof spec(kinds, kind).card === 'function';

  // Wykonuje akcję kliknięcia dla ObjDesc {kind, ref}. ctx = kontekst zdarzenia (np. {e} — pointerType
  // dla dwustopniowego dotyku). true = wykonano, false = rodzaj jawnie bez akcji.
  function select(kinds, obj, ctx) {
    if (!obj) return false;
    const s = spec(kinds, obj.kind);
    if (s.select === null) return false;
    s.select(obj.ref, obj, ctx || {});
    return true;
  }

  // Znormalizowany model karty #info: {eye, name, sub, stats:[[etykieta, wartość]], rail, skins}.
  function cardModel(kinds, kind, ref) {
    const s = spec(kinds, kind);
    if (typeof s.card !== 'function')
      fail(`rodzaj „${kind}” nie ma card(ref) — karta #info wymaga {eye, name, sub, facts}`);
    const m = s.card(ref);
    if (!m || typeof m !== 'object') fail(`card(„${kind}”) nie zwróciła obiektu`);
    for (const f of ['eye', 'name', 'sub'])
      if (typeof m[f] !== 'string') fail(`card(„${kind}”) nie zwraca pola ${f} (string)`);
    const facts = m.facts || {};
    return {
      eye: m.eye, name: m.name, sub: m.sub,
      stats: Object.keys(facts).map((k) => [k, String(facts[k])]),
      rail: m.rail || null,
      skins: m.skins || null,
    };
  }

  const api = { defineKinds, kindsOf, label, hasCard, select, cardModel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Selectables = api;
})(typeof window !== 'undefined' ? window : globalThis);
