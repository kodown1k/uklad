/* sky-groups.js — czysta logika grup asteryzmów + serializacja stanu UI.
   Bez DOM/THREE. Dual-export (CommonJS + window). */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SkyGroups = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // [{id,label,hemi,asterisms:[name…]}] w kolejności data.groups; bucket 'other' na końcu jeśli niepusty.
  function groupModel(data) {
    const groups = (data && data.groups) || [];
    const asters = (data && data.asterisms) || [];
    const byId = new Map(groups.map(g => [g.id, { id:g.id, label:g.label, hemi:g.hemi || 'N', asterisms:[] }]));
    const other = { id:'other', label:'Inne', hemi:'N', asterisms:[] };
    asters.forEach(a => {
      const g = byId.get(a.group);
      (g ? g.asterisms : other.asterisms).push(a.name);
    });
    const out = groups.map(g => byId.get(g.id));
    if (other.asterisms.length) out.push(other);
    return out;
  }

  function groupState(visibleSet, names) {
    let shown = 0;
    for (const n of names) if (visibleSet.has(n)) shown++;
    const total = names.length;
    const state = shown === 0 ? 'off' : (shown === total ? 'on' : 'indet');
    return { state, shown, total };
  }

  function isolate(name, allNames) {
    return new Set([name]);
  }

  // Zapis: {known:[…wszystkie nazwy w chwili zapisu], on:[…widoczne]}.
  function serializeVis(visibleSet, allNames) {
    return JSON.stringify({ known: allNames.slice(), on: Array.from(visibleSet) });
  }

  // Brak/uszkodzony zapis → wszystkie z allNames widoczne.
  // Nazwy spoza zapisanego `known` (nowy roster) → on. Znane → wg `on`.
  function deserializeVis(str, allNames) {
    const all = new Set(allNames);
    if (!str) return new Set(allNames);
    let obj;
    try { obj = JSON.parse(str); } catch (_) { return new Set(allNames); }
    if (!obj || !Array.isArray(obj.known) || !Array.isArray(obj.on)) return new Set(allNames);
    const known = new Set(obj.known);
    const on = new Set(obj.on.filter(n => all.has(n)));
    for (const n of allNames) if (!known.has(n)) on.add(n);   // nowy roster → on
    return on;
  }

  function serializeOpen(openSet) { return JSON.stringify(Array.from(openSet)); }
  function deserializeOpen(str) {
    if (!str) return new Set();
    try { const a = JSON.parse(str); return new Set(Array.isArray(a) ? a : []); }
    catch (_) { return new Set(); }
  }

  return { groupModel, groupState, isolate, serializeVis, deserializeVis, serializeOpen, deserializeOpen };
});
