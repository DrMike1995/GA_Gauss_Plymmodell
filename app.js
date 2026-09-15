'use strict';
const { DEFAULTS, PASQUILL, calculate, sectorPoints } = SectorModel;
let state = { ...DEFAULTS };
const origin = [57.259722, 12.110833];
const el = id => document.getElementById(id);
const format = (n, digits = 2) => n.toLocaleString('sv-SE', { maximumFractionDigits: digits });
const precise = n => n === 0 ? '0' : (Math.abs(n) < 0.01 || Math.abs(n) >= 1e7)
  ? n.toExponential(3).replace('.', ',') : n.toLocaleString('sv-SE', { maximumSignificantDigits: 5 });
const controls = [
  ['weather-controls', 'wind', 'Vindhastighet', 2, 10, 1, 'm/s', 'geometry'],
  ['weather-controls', 'direction', 'Vind från', 0, 359, 1, '°', 'geometry'],
  ['weather-controls', 'hours', 'Utsläpps- / transporttid', .25, 8, .25, 'h', 'geometry'],
  ['geometry-controls', 'angle', 'Sektorns grundvinkel', 5, 180, 1, '°', 'geometry'],
  ['geometry-controls', 'variability', 'Vindvariation ±', 0, 90, 1, '°', 'geometry'],
  ['geometry-controls', 'maxRadius', 'Maximal beräkningsradie', 10, 200, 5, 'km', 'geometry'],
  ['deposition-controls', 'activity', 'Utsläppt aktivitet · exempel', 0, 10, .1, 'TBq', 'ground'],
  ['deposition-controls', 'dry', 'Torrdepositionsandel', 0, 100, 1, '%', 'ground'],
  ['deposition-controls', 'rain', 'Regnets extra deposition', 0, 100, 5, '%', 'ground'],
  ['deposition-controls', 'mixing', 'Blandningshöjd', 100, 2000, 50, 'm', 'concentration'],
  ['person-controls', 'exposure', 'Exponeringstid', 0, 8, .25, 'h', 'effective'],
  ['person-controls', 'breathing', 'Andningshastighet', .25, 3, .25, 'm³/h', 'effective'],
  ['person-controls', 'indoor', 'Inomhusfaktor', 0, 1, .05, '', 'effective'],
  ['person-controls', 'leave', 'Lämnar efter', 0, 8, .25, 'h', 'effective'],
];
for (const [group, key, label, min, max, step, unit, metric] of controls) {
  const wrapper = document.createElement('div');
  wrapper.className = 'control';
  wrapper.innerHTML = `<div class="control-top"><label for="${key}">${label}</label><output id="${key}-value" for="${key}"></output></div><input type="range" id="${key}" min="${min}" max="${max}" step="${step}" value="${state[key]}"><div class="bounds"><span>${format(min)} ${unit}</span><span>${format(max)} ${unit}</span></div>`;
  el(group).append(wrapper);
  el(key).addEventListener('input', event => {
    state[key] = Number(event.target.value);
    if (key === 'angle') el('pasquill').value = 'custom';
    if (metric !== 'geometry') el('metric').value = metric;
    update();
  });
}
el('pasquill').addEventListener('change', event => {
  if (PASQUILL[event.target.value]) { state.angle = PASQUILL[event.target.value]; update(); }
});
el('metric').addEventListener('change', () => update());
for (const key of ['effectiveCoefficient', 'thyroidCoefficient']) {
  el(key).addEventListener('input', event => {
    const value = event.target.valueAsNumber;
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      el('input-error').textContent = 'Ange en koefficient mellan 0 och 1 Sv/Bq. Resultatet behåller senast giltiga värde.';
      event.target.setAttribute('aria-invalid', 'true'); return;
    }
    event.target.removeAttribute('aria-invalid');
    el('input-error').textContent = '';
    state[key] = value;
    el('metric').value = key === 'thyroidCoefficient' ? 'thyroid' : 'effective';
    update();
  });
}

let map, polygon;
if (typeof L !== 'undefined') {
  map = L.map('map', { scrollWheelZoom: false }).setView([57.27, 12.28], 9);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsgivare'
  }).addTo(map);
  tiles.on('tileerror', () => { el('map-status').textContent = 'Kartbakgrunden kunde inte laddas. Sektorn och beräkningarna fungerar fortfarande.'; });
  L.control.scale({ imperial: false }).addTo(map);
  polygon = L.polygon([], { color: '#087781', weight: 2, fillOpacity: .55 }).addTo(map);
  L.circleMarker(origin, { radius: 5, color: '#102d3a', fillColor: '#fff', fillOpacity: 1, weight: 3 }).addTo(map)
    .bindTooltip('Ringhals · origo', { permanent: true, direction: 'left' });
  new ResizeObserver(() => map.invalidateSize()).observe(el('map'));
} else {
  el('map').hidden = true;
  el('fallback').hidden = false;
  el('map-status').textContent = 'Kartan kunde inte hämtas. Här visas en schematisk sektor i lokala koordinater. Beräkningarna fungerar.';
}
const metrics = {
  ground: { label: 'Markbeläggning', unit: 'Bq/m²', max: 1e6 },
  concentration: { label: 'Luftkoncentration', unit: 'Bq/m³', max: 1e4 },
  effective: { label: 'Effektiv inhalationsdos', unit: 'mSv', max: 1 },
  thyroid: { label: 'Ekvivalent sköldkörteldos', unit: 'mSv', max: 10 },
};
function sectorColor(value, max) {
  const fraction = Math.min(1, Math.max(0, Math.log10(1 + 999 * value / max) / 3));
  const start = [220, 244, 243], end = [8, 119, 129];
  return `rgb(${start.map((n, i) => Math.round(n + (end[i] - n) * fraction)).join(',')})`;
}
let fallbackExtent = 50000;
function drawFallback(result, color) {
  const scale = 205 / fallbackExtent;
  const points = [[400, 250]];
  for (let i = 0; i <= 180; i++) {
    const bearing = (state.direction + 180 - result.angle / 2 + result.angle * i / 180) * Math.PI / 180;
    points.push([400 + result.radius * scale * Math.sin(bearing), 250 - result.radius * scale * Math.cos(bearing)]);
  }
  let grid = '';
  for (let x = 0; x <= 800; x += 50) grid += `<path d="M${x} 0V500"/>`;
  for (let y = 0; y <= 500; y += 50) grid += `<path d="M0 ${y}H800"/>`;
  el('fallback').innerHTML = `<g stroke="#ccdadd" stroke-width="1">${grid}</g><polygon points="${points.map(p => p.join(',')).join(' ')}" fill="${color}" fill-opacity=".7" stroke="#087781" stroke-width="2"/><circle cx="400" cy="250" r="5" fill="#102d3a"/><g fill="#102d3a" font-family="sans-serif" font-size="16"><text x="400" y="232" text-anchor="middle">Ringhals</text><text x="400" y="28" text-anchor="middle">N</text><text x="735" y="250">Ö</text><text x="20" y="470">Rutnät: ${format(50 / scale / 1000)} km</text></g>`;
}
function update() {
  for (const [, key, , , , , unit] of controls) {
    el(key).value = state[key];
    const value = `${format(state[key])}${unit === '°' ? '' : ' '}${unit}`.trim();
    el(`${key}-value`).textContent = value;
    el(key).setAttribute('aria-valuetext', value);
  }
  const result = readResult();
  const metric = el('metric').value;
  const descriptor = metrics[metric];
  const color = sectorColor(result[metric], descriptor.max);
  const areaText = `${format(result.area / 1e6)} km²`;
  el('map-area').textContent = areaText;
  el('area').textContent = areaText;
  el('geometry-note').textContent = `${format(result.radius / 1000)} km radie · ${format(result.angle)}° vinkel`;
  el('ground').textContent = precise(result.ground);
  el('concentration').textContent = precise(result.concentration);
  el('legend-title').textContent = `${descriptor.label} · ${precise(result[metric])} ${descriptor.unit}`;
  el('legend-mid').textContent = precise(descriptor.max * (Math.sqrt(1000) - 1) / 999);
  el('legend-max').textContent = `≥ ${precise(descriptor.max)} ${descriptor.unit}`;
  el('ground-bar').style.width = `${result.fraction * 100}%`;
  el('budget-caption').textContent = `${format(result.fraction * 100)} % på marken · ${format((1 - result.fraction) * 100)} % i luften`;
  const rows = [
    ['Utsläppt aktivitet', `${precise(result.released)} Bq`],
    ['Luftburen aktivitet', `${precise(result.airborne)} Bq`],
    ['Deponerad aktivitet', `${precise(result.deposited)} Bq`],
    ['Effektiv vistelsetid', `${format(result.time / 3600)} h`],
    ['Inhalerad aktivitet', `${precise(result.inhaled)} Bq`],
    ['Effektiv inhalationsdos', `${precise(result.effective)} mSv`],
    ['Ekvivalent sköldkörteldos', `${precise(result.thyroid)} mSv`],
  ];
  el('result-list').innerHTML = rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  const capped = result.radius >= state.maxRadius * 1000;
  el('insight').textContent = capped
    ? `Maxradien ${format(state.maxRadius)} km är nådd. Mer vind eller längre utsläppstid gör därför inte sektorn större. Arean är ${areaText}.`
    : `${format(state.wind)} m/s × ${format(state.hours)} h ger ${format(result.radius / 1000)} km radie. Grundvinkeln ${format(state.angle)}° + vindvariation ${format(2 * state.variability)}° ger ${format(result.angle)}°. Större yta späder ut samma aktivitet.`;
  if (map) {
    polygon.setLatLngs(sectorPoints(origin, state.direction, result.radius, result.angle));
    polygon.setStyle({ fillColor: color });
    polygon.bindTooltip(`${areaText} · ${descriptor.label}: ${precise(result[metric])} ${descriptor.unit}`, { sticky: true });
  } else drawFallback(result, color);
}
// Gränssnittet anger ± variation; modellen tar den extra totala bredden.
function readResult() { return calculate({ ...state, variability: state.variability * 2 }); }
el('fit').addEventListener('click', () => {
  if (map) map.fitBounds(polygon.getBounds(), { padding: [45, 45], maxZoom: 12 });
  else { fallbackExtent = readResult().radius * 1.15; update(); }
});
el('reset').addEventListener('click', () => {
  state = { ...DEFAULTS };
  el('pasquill').value = 'D';
  el('metric').value = 'ground';
  el('input-error').textContent = '';
  for (const key of ['effectiveCoefficient', 'thyroidCoefficient']) {
    el(key).value = state[key]; el(key).removeAttribute('aria-invalid');
  }
  fallbackExtent = 50000;
  update();
  if (map) map.setView([57.27, 12.28], 9);
});
update();
