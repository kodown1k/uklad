/* dsn-feed.js — parser publicznego feedu Deep Space Network (https://eyes.nasa.gov/dsn/data/dsn.xml,
   CORS „*", odświeżany co kilka sekund): które anteny DSN rozmawiają teraz z którymi sondami.
   Schemat feedu: <station> to znacznik pusty, a anteny (<dish>) należą do OSTATNIEGO <station> przed nimi;
   antena ma ≥0 <upSignal>/<downSignal> (moc: up w kW, down w dBm; dataRate w bit/s) i ≥1 <target>
   (rtlt = czas lotu sygnału tam i z powrotem w s, −1 dla prac serwisowych; zasięgi w km).
   Czysta logika, bez DOM/THREE (regex, bo w node --test nie ma DOMParser). Dual-export IIFE. */
(function (root) {
  'use strict';

  // Kody sond w feedzie DSN → id w PROBES (solar.js). Sonda spoza mapy dostaje probeId null.
  var PROBE_IDS = { VGR1: 'voyager1', VGR2: 'voyager2', NHPC: 'newhorizons', JNO: 'juno', M20: 'perseverance', JWST: 'jwst' };

  // Wartości atrybutów z zewnętrznego feedu: tylko litery, cyfry, spacja, kropka, przecinek, myślnik, ukośnik, nawias
  // (nazwy trafiają do innerHTML karty i paska stanu — nic, co da się zinterpretować jako HTML/encję)
  function attrs(s) {
    var o = {}, re = /(\w+)="([^"]*)"/g, m;
    while ((m = re.exec(s))) o[m[1]] = m[2].replace(/[^\p{L}\p{N} .,\-\/()]/gu, '');
    return o;
  }

  function parseDsn(xml) {
    xml = String(xml || '');
    var out = { timeMs: null, dishes: [] }, station = null, dish = null, m;
    var re = /<(station|dish|\/dish|upSignal|downSignal|target)\b([^>]*)>/g;
    while ((m = re.exec(xml))) {
      var tag = m[1], a = attrs(m[2]);
      if (tag === 'station') station = { site: a.name, siteName: a.friendlyName };
      else if (tag === 'dish') {
        dish = { dish: a.name, site: station ? station.site : null, siteName: station ? station.siteName : null,
          azimuth: +a.azimuthAngle, elevation: +a.elevationAngle, activity: a.activity || '', up: [], down: [], targets: [] };
        out.dishes.push(dish);
      } else if (tag === '/dish') dish = null;
      else if (dish && (tag === 'upSignal' || tag === 'downSignal')) {
        (tag === 'upSignal' ? dish.up : dish.down).push({ craft: a.spacecraft, active: a.active === 'true' && a.signalType !== 'none',
          band: a.band, rate: +a.dataRate || 0, power: +a.power });
      } else if (dish && tag === 'target') {
        dish.targets.push({ name: a.name, rtlt: +a.rtlt, rangeKm: +a.downlegRange });
      }
    }
    var ts = /<timestamp>(\d+)<\/timestamp>/.exec(xml);
    if (ts) out.timeMs = +ts[1];
    return out;
  }

  // Aktywne łącza: jedno na parę antena–sonda. Downlink = sygnał o największej przepływności (dBm z niego);
  // para bez żadnego aktywnego sygnału albo z celem serwisowym (rtlt ≤ 0) odpada.
  function links(feed) {
    var res = [];
    (feed && feed.dishes || []).forEach(function (d) {
      d.targets.forEach(function (t) {
        if (!(t.rtlt > 0)) return;
        var down = d.down.filter(function (s) { return s.active && s.craft === t.name; });
        var up = d.up.some(function (s) { return s.active && s.craft === t.name; });
        if (!down.length && !up) return;
        var best = down.reduce(function (b, s) { return !b || s.rate > b.rate ? s : b; }, null);
        res.push({ craft: t.name, probeId: PROBE_IDS[t.name] || null, dish: d.dish, site: d.site, siteName: d.siteName,
          azimuth: d.azimuth, elevation: d.elevation, downRate: best ? best.rate : 0, dBm: best ? best.power : null,
          uplink: up, rtlt: t.rtlt, rangeKm: t.rangeKm });
      });
    });
    return res;
  }

  // Bity „w drodze" na odcinku sonda→Ziemia: przepływność · czas lotu w jedną stronę.
  function bitsInFlight(rateBps, rtltSec) { return rtltSec > 0 ? rateBps * rtltSec / 2 : 0; }

  function dbmToWatts(dBm) { return Math.pow(10, (dBm - 30) / 10); }

  function fmtBits(bits) {
    var b = bits / 8, units = ['B', 'kB', 'MB', 'GB', 'TB'], i = 0;
    while (b >= 1000 && i < units.length - 1) { b /= 1000; i++; }
    return (i === 0 ? String(Math.round(b)) : b.toPrecision(3)).replace('.', ',') + ' ' + units[i];
  }

  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function fmtWatts(w) {
    var e = Math.floor(Math.log10(w)), m = w / Math.pow(10, e);
    if (m >= 9.95) { m /= 10; e++; }
    return m.toFixed(1).replace('.', ',') + '·10' + String(e).replace(/./g, function (c) { return SUP[c]; }) + ' W';
  }

  // Paczki danych na odcinku sonda→Ziemia: n paczek równo rozłożonych w czasie lotu oneWaySec, każda leci
  // z prędkością światła ku Ziemi. Zwraca ułamki drogi liczone OD ZIEMI (0 = dotarła), w (0,1].
  // Uproszczenie: strumień ciągły na całej długości (feed mówi tylko, co antena odbiera TERAZ).
  function packetFractions(oneWaySec, nowMs, n) {
    if (!(oneWaySec > 0) || !(n > 0)) return [];
    var step = oneWaySec / n, phase = (((nowMs / 1000) % step) + step) % step / step, out = [];
    for (var i = 0; i < n; i++) out.push((i + 1 - phase) / n);
    return out;
  }

  // Fakty karty sondy z aktywnego łącza (klucze = etykiety karty)
  function linkFacts(l) {
    var f = {};
    f['Łącze DSN'] = l.siteName + ' · ' + l.dish + ' · ' + String(l.downRate).replace('.', ',') + ' bit/s';
    f['Dane w drodze do Ziemi'] = fmtBits(bitsInFlight(l.downRate, l.rtlt));
    if (l.dBm != null) f['Moc odbierana'] = fmtWatts(dbmToWatts(l.dBm));
    return f;
  }

  var DsnFeed = { PROBE_IDS: PROBE_IDS, parseDsn: parseDsn, links: links,
    bitsInFlight: bitsInFlight, dbmToWatts: dbmToWatts, fmtBits: fmtBits, fmtWatts: fmtWatts,
    packetFractions: packetFractions, linkFacts: linkFacts };
  if (typeof module !== 'undefined' && module.exports) module.exports = DsnFeed;
  else root.DsnFeed = DsnFeed;
})(typeof window !== 'undefined' ? window : globalThis);
