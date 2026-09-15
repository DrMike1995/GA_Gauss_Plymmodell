/* Samma statiska pedagogiska fysik som Pythonmodellen. SI internt. */
(function (root) {
  'use strict';
  const PASQUILL = { A: 60, B: 45, C: 30, D: 20, E: 15, F: 10 };
  const DEFAULTS = Object.freeze({ wind: 5, direction: 270, hours: 1, angle: 20,
    variability: 0, maxRadius: 100, activity: 1, dry: 10, rain: 0,
    mixing: 500, exposure: 8, breathing: 1, indoor: 1, leave: 8,
    effectiveCoefficient: 1e-8, thyroidCoefficient: 2e-7 });
  function calculate(p) {
    for (const [key, value] of Object.entries(p)) {
      if (!Number.isFinite(value) || value < 0) throw new Error(`${key}: ange ett ändligt, icke negativt tal.`);
    }
    if (p.wind <= 0 || p.hours <= 0 || p.angle <= 0 || p.mixing <= 0 || p.maxRadius <= 0)
      throw new Error('Vind, tid, vinkel, radie och blandningshöjd måste vara positiva.');
    if (p.indoor > 1) throw new Error('Inomhusfaktorn måste vara 0–1.');
    const radius = Math.min(p.wind * p.hours * 3600, p.maxRadius * 1000);
    const angle = Math.min(360, p.angle + p.variability);
    const area = angle * Math.PI / 180 / 2 * radius ** 2;
    const released = p.activity * 1e12; // Reglaget anges i TBq.
    const fraction = Math.max(0, Math.min(1, (p.dry + p.rain) / 100));
    const deposited = released * fraction;
    const airborne = released - deposited;
    const volume = area * p.mixing;
    const concentration = airborne / volume;
    const time = Math.min(p.exposure, p.leave) * 3600;
    const inhaled = concentration * (p.breathing / 3600) * time * p.indoor;
    return { radius, angle, area, released, deposited, airborne, volume, fraction,
      concentration, ground: deposited / area, time, inhaled,
      effective: inhaled * p.effectiveCoefficient * 1000,
      thyroid: inhaled * p.thyroidCoefficient * 1000 };
  }
  // Storcirkelpunkter för kartvisning. Arean ovan förblir MVP:ns plana sektorarea.
  function destination(origin, bearing, distance) {
    const rad = Math.PI / 180, earthRadius = 6371000;
    const lat = origin[0] * rad, lon = origin[1] * rad;
    const b = bearing * rad, d = distance / earthRadius;
    const lat2 = Math.asin(Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(b));
    const lon2 = lon + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat), Math.cos(d) - Math.sin(lat) * Math.sin(lat2));
    return [lat2 / rad, lon2 / rad];
  }
  function sectorPoints(origin, directionFrom, radius, angle) {
    const points = angle < 360 ? [origin] : [];
    for (let i = 0; i <= 180; i++) points.push(destination(origin, directionFrom + 180 - angle / 2 + angle * i / 180, radius));
    if (angle < 360) points.push(origin);
    return points;
  }
  const api = { PASQUILL, DEFAULTS, calculate, destination, sectorPoints };
  if (typeof module !== 'undefined') module.exports = api;
  root.SectorModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
