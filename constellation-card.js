/* constellation-card.js — czysta logika karty opisu konstelacji.
   Bez DOM/THREE. Dual-export (CommonJS + window). */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ConstellationCard = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function cardFacts(asterism, groups) {
    const g = (groups || []).find(x => x.id === asterism.group);
    const brightest = (asterism.stars || [])
      .filter(s => s && s.n)
      .slice()
      .sort((a, b) => a.m - b.m)
      .map(s => ({ n: s.n, m: s.m }));
    return {
      name: asterism.name,
      groupId: asterism.group,
      groupLabel: g ? g.label : 'Inne',
      hemi: g ? g.hemi : 'N',
      brightest,
      wiki: asterism.wiki
    };
  }

  function hemiLabel(hemi) {
    return hemi === 'S' ? 'Niebo południowe' : 'Widoczna z Polski';
  }

  return { cardFacts, hemiLabel };
});
