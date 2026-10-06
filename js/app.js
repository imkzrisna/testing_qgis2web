const CONFIG = {"basemap":{"attribution":"&copy; OpenStreetMap contributors","url":"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"},"labelFontSize":16.0,"layers":[{"categories":null,"categoryField":null,"color":"#ffffff","file":"data/rumah_sakit_terdampak.geojson","geometryType":"Point","isBoundary":false,"labeling":null,"layerIndex":1,"name":"Rumah Sakit Terdampak","opacity":0.3,"pointSize":19.0,"ranges":null,"showAttributeTable":false,"visibleFields":null},{"categories":null,"categoryField":null,"color":"#fa0048","file":"data/buffer_kebakaran_di_israel.geojson","geometryType":"Polygon","isBoundary":false,"labeling":null,"layerIndex":0,"name":"BUFFER Kebakaran di Israel","opacity":0.35,"pointSize":5.0,"ranges":null,"showAttributeTable":false,"visibleFields":null},{"categories":[{"color":"#81c0e2","value":"HaDarom"},{"color":"#d9bf62","value":"Haifa"},{"color":"#562bf0","value":"HaMerkaz"},{"color":"#29dc83","value":"HaZafon"},{"color":"#e136d3","value":"Jerusalem"},{"color":"#74d73a","value":"Tel Aviv"},{"color":"#cc7a80","value":"NULL"}],"categoryField":"name","color":"#f97316","file":"data/batas_administrasi_israel.geojson","geometryType":"Polygon","isBoundary":true,"labeling":{"field":"name","groupByField":null},"layerIndex":7,"name":"Batas Administrasi Israel","opacity":0.35,"pointSize":5.0,"ranges":null,"showAttributeTable":false,"visibleFields":null}],"maxZoom":20,"minZoom":8};

const map = L.map('map', { zoomControl: false, doubleClickZoom: false, minZoom: CONFIG.minZoom, maxZoom: CONFIG.maxZoom });
L.control.zoom({ position: 'bottomright' }).addTo(map);

const FocusBoundaryControl = L.Control.extend({
  onAdd: function () {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    const button = L.DomUtil.create('a', '', container);
    button.href = '#';
    button.title = 'Fokus ke Boundary Layer';
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', 'Fokus ke Boundary Layer');
    button.style.fontSize = '18px';
    button.style.lineHeight = '30px';
    button.style.textAlign = 'center';
    button.innerHTML = '&#8982;';
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(button, 'click', function (ev) {
      L.DomEvent.preventDefault(ev);
      const boundaryCfg = CONFIG.layers.find(function (l) { return l.isBoundary; });
      if (!boundaryCfg) return;
      const gLayer = layerRefs[boundaryCfg.layerIndex];
      if (!gLayer) return;
      const bounds = gLayer.getBounds();
      if (!bounds.isValid()) return;
      const mapEl = map.getContainer();
      mapEl.classList.add('map-flying');
      map.once('moveend', function () { mapEl.classList.remove('map-flying'); });
      if (map.getBoundsZoom(bounds) < CONFIG.minZoom) {
        map.flyTo(bounds.getCenter(), CONFIG.minZoom, { duration: 1.6 });
      } else {
        map.flyToBounds(bounds, { maxZoom: CONFIG.maxZoom, duration: 1.6 });
      }
    });
    return container;
  },
});
new FocusBoundaryControl({ position: 'bottomright' }).addTo(map);

function addBasemap() {
  L.tileLayer(CONFIG.basemap.url, {
    attribution: CONFIG.basemap.attribution,
    minZoom: CONFIG.minZoom,
    maxZoom: CONFIG.maxZoom,
    updateWhenIdle: true,
    keepBuffer: 2,
  }).addTo(map);
}
if (window.requestIdleCallback) {
  window.requestIdleCallback(addBasemap, { timeout: 800 });
} else {
  setTimeout(addBasemap, 150);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Warna final feature: kalau layer punya kategori (categoryField diisi saat
// konfigurasi di GIS2Web Studio), pakai warna per-kategori; kalau tidak,
// pakai warna solid layer. Ini nilai FINAL, tidak ada UI untuk mengubahnya
// di hasil export.
function resolveFeatureColor(layer, feature) {
  if (layer.categoryField && layer.categories && layer.categories.length > 0) {
    const raw = feature && feature.properties ? feature.properties[layer.categoryField] : undefined;
    const valueKey = raw === null || raw === undefined ? 'NULL' : String(raw);
    const match = layer.categories.find((c) => c.value === valueKey);
    return match ? match.color : layer.color;
  }

  if (layer.categoryField && layer.ranges && layer.ranges.length > 0) {
    const raw = feature && feature.properties ? feature.properties[layer.categoryField] : undefined;
    const numericValue = typeof raw === 'number' ? raw : parseFloat(raw);
    if (!Number.isNaN(numericValue)) {
      const match = layer.ranges.find((r) => numericValue >= r.lower && numericValue <= r.upper);
      if (match) return match.color;
    }
    return layer.color;
  }

  return layer.color;
}

function buildFieldsTable(properties, visibleFields) {
  if (!properties || Object.keys(properties).length === 0) return null;
  const allKeys = Object.keys(properties);
  const fieldsToShow = visibleFields && visibleFields.length > 0
    ? visibleFields.filter((f) => allKeys.includes(f))
    : allKeys;
  if (fieldsToShow.length === 0) return null;

  return fieldsToShow.map((key) => {
    const value = properties[key];
    return { key, value: value === null || value === undefined ? '-' : String(value) };
  });
}

// ---- Feature Information card (mode 'card' / 'both') ----
const cardEl = document.getElementById('feature-info-card');
const cardTitleEl = document.getElementById('feature-info-card-title');
const cardSubtitleEl = document.getElementById('feature-info-card-subtitle');
const cardTableEl = document.getElementById('feature-info-card-table');
const cardCloseBtn = document.getElementById('feature-info-card-close');

function showFeatureCard(layerName, rows) {
  cardTitleEl.textContent = 'Feature Information';
  cardSubtitleEl.textContent = layerName;
  cardTableEl.innerHTML = rows
    ? rows.map((r) => `<tr><th>${escapeHtml(r.key)}</th><td>${escapeHtml(r.value)}</td></tr>`).join('')
    : '<tr><td>Tidak ada atribut.</td></tr>';
  cardEl.hidden = false;
}

function hideFeatureCard() {
  cardEl.hidden = true;
}

cardCloseBtn.addEventListener('click', hideFeatureCard);

const layerRefs = {};
const layerGeojsonData = {};
const featureLayerRefs = {};
const layerStyleFns = {};
let boundaryFitted = false;
let activeFeatureKey = null;
const clickCycle = { point: null, matches: [], index: -1 };

// ---- Highlight seleksi: strong (feature diklik) / subtle (feature lain di
// layer yang sama). Sama persis dengan getStrongHighlightStyle/
// getSubtleHighlightStyle di layerStyle.ts pada aplikasi. ----
function getStrongHighlightStyle(base) {
  return Object.assign({}, base, {
    weight: (base.weight || 1.5) + 3,
    color: '#facc15',
    fillOpacity: Math.min((base.fillOpacity || 0.35) + 0.25, 0.85),
  });
}
function getSubtleHighlightStyle(base) {
  return Object.assign({}, base, {
    weight: (base.weight || 1.5) + 1.5,
    fillOpacity: Math.min((base.fillOpacity || 0.35) + 0.1, 0.7),
  });
}

// ---- Prioritas hit-test: Point > Line > Polygon. Sama persis dengan
// geometryPriority() di MapView.tsx. ----
function geometryPriority(geomType) {
  if (geomType === 'Point' || geomType === 'MultiPoint') return 0;
  if (geomType === 'LineString' || geomType === 'MultiLineString') return 1;
  if (geomType === 'Polygon' || geomType === 'MultiPolygon') return 2;
  return 3;
}

const NEAREST_FEATURE_PIXEL_TOLERANCE = 18;

function getVisibleZOrderedFeatureCandidates(latlng) {
  const pt = turf.point([latlng.lng, latlng.lat]);
  const candidates = [];
  const nearestByDistance = [];

  const clickPoint = map.latLngToContainerPoint(latlng);
  const toleranceProbe = L.point(clickPoint.x + NEAREST_FEATURE_PIXEL_TOLERANCE, clickPoint.y);
  const toleranceLatLng = map.containerPointToLatLng(toleranceProbe);
  const toleranceMeters = latlng.distanceTo(toleranceLatLng);

  // CONFIG.layers sudah terurut sesuai layerOrder final (layer atas dulu).
  CONFIG.layers.forEach((layerCfg) => {
    const gLayer = layerRefs[layerCfg.layerIndex];
    if (!gLayer || !map.hasLayer(gLayer)) return;
    const geojsonData = layerGeojsonData[layerCfg.layerIndex];
    if (!geojsonData) return;

    const features = geojsonData.features || [];
    features.forEach((feature, featureIndex) => {
      const geomType = feature.geometry ? feature.geometry.type : undefined;
      const key = layerCfg.layerIndex + ':' + featureIndex;

      if (geomType === 'Point' || geomType === 'MultiPoint') {
        const coordsList = geomType === 'Point' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        for (const c of coordsList) {
          const d = latlng.distanceTo(L.latLng(c[1], c[0]));
          if (d <= toleranceMeters) {
            const layerInstance = featureLayerRefs[key];
            if (layerInstance) {
              nearestByDistance.push({ layerIndex: layerCfg.layerIndex, featureIndex, layerInstance, geomType, distanceMeters: d });
            }
            break;
          }
        }
        return;
      }

      if (geomType === 'LineString' || geomType === 'MultiLineString') {
        try {
          const lines = geomType === 'MultiLineString'
            ? feature.geometry.coordinates.map((coords) => turf.lineString(coords))
            : [turf.lineString(feature.geometry.coordinates)];
          for (const line of lines) {
            const d = turf.pointToLineDistance(pt, line, { units: 'meters' });
            if (d <= toleranceMeters) {
              const layerInstance = featureLayerRefs[key];
              if (layerInstance) {
                nearestByDistance.push({ layerIndex: layerCfg.layerIndex, featureIndex, layerInstance, geomType, distanceMeters: d });
              }
              break;
            }
          }
        } catch (e) { /* geometry tidak valid, skip */ }
        return;
      }

      if (geomType !== 'Polygon' && geomType !== 'MultiPolygon') return;

      try {
        if (turf.booleanPointInPolygon(pt, feature)) {
          const layerInstance = featureLayerRefs[key];
          if (layerInstance) {
            candidates.push({ layerIndex: layerCfg.layerIndex, featureIndex, layerInstance, geomType, distanceMeters: 0 });
          }
          return;
        }
      } catch (e) { /* geometry tidak valid, coba fallback jarak */ }

      try {
        const boundary = turf.polygonToLine(feature);
        const lineFeatures = boundary.type === 'FeatureCollection' ? boundary.features : [boundary];
        const singleLines = [];
        lineFeatures.forEach((lf) => {
          if (lf.geometry.type === 'LineString') {
            singleLines.push(lf);
          } else if (lf.geometry.type === 'MultiLineString') {
            lf.geometry.coordinates.forEach((coords) => singleLines.push(turf.lineString(coords)));
          }
        });
        for (const line of singleLines) {
          const d = turf.pointToLineDistance(pt, line, { units: 'meters' });
          if (d <= toleranceMeters) {
            const layerInstance = featureLayerRefs[key];
            if (layerInstance) {
              nearestByDistance.push({ layerIndex: layerCfg.layerIndex, featureIndex, layerInstance, geomType, distanceMeters: d });
            }
            break;
          }
        }
      } catch (e) { /* geometry tidak valid untuk fallback juga, skip */ }
    });
  });

  const merged = candidates.concat(nearestByDistance);
  if (merged.length === 0) return [];
  merged.sort((a, b) => {
    const p = geometryPriority(a.geomType) - geometryPriority(b.geomType);
    if (p !== 0) return p;
    return a.distanceMeters - b.distanceMeters;
  });
  return merged;
}

function applyHighlightForActive() {
  Object.keys(featureLayerRefs).forEach((key) => {
    const layerIndexStr = key.split(':')[0];
    const layerIndex = Number(layerIndexStr);
    const layerInstance = featureLayerRefs[key];
    const styleFn = layerStyleFns[layerIndex];
    if (!styleFn || typeof layerInstance.setStyle !== 'function') return;
    const baseStyle = styleFn(layerInstance.feature);

    if (!activeFeatureKey || activeFeatureKey.split(':')[0] !== layerIndexStr) {
      layerInstance.setStyle(baseStyle);
      return;
    }
    if (key === activeFeatureKey) {
      layerInstance.setStyle(getStrongHighlightStyle(baseStyle));
      if (typeof layerInstance.bringToFront === 'function') layerInstance.bringToFront();
    } else {
      layerInstance.setStyle(getSubtleHighlightStyle(baseStyle));
    }
  });
}

function closeAllPopups() {
  Object.keys(featureLayerRefs).forEach((key) => {
    const l = featureLayerRefs[key];
    if (typeof l.closePopup === 'function') l.closePopup();
  });
}

// Fungsi terpusat untuk "memilih" sebuah feature, dipakai baik dari klik
// peta maupun klik row di Attribute Table, supaya highlight/popup/card dan
// sinkronisasi selalu konsisten dari kedua sumber. latlng opsional (row
// Attribute Table tidak selalu punya titik klik di peta).
function selectFeature(layerIndex, featureIndex, latlng) {
  const key = layerIndex + ':' + featureIndex;
  const layerInstance = featureLayerRefs[key];
  if (!layerInstance) return;

  activeFeatureKey = key;
  applyHighlightForActive();
  closeAllPopups();

  const layerConfig = CONFIG.layers.find((l) => l.layerIndex === layerIndex);
  const geojsonData = layerGeojsonData[layerIndex];
  const feature = geojsonData ? geojsonData.features[featureIndex] : null;
  const rows = layerConfig && feature ? buildFieldsTable(feature.properties, layerConfig.visibleFields) : null;

  showFeatureCard(layerConfig ? layerConfig.name : '', rows);

  syncAttributeTableToActiveFeature();
}

function handleMapClick(e) {
  const candidates = getVisibleZOrderedFeatureCandidates(e.latlng);
  if (candidates.length === 0) return;

  const clickPoint = map.latLngToContainerPoint(e.latlng);
  const sameKeys = clickCycle.matches.length === candidates.length &&
    clickCycle.matches.every((m, i) => m.layerIndex === candidates[i].layerIndex && m.featureIndex === candidates[i].featureIndex);
  const closeToPrev = clickCycle.point ? clickCycle.point.distanceTo(clickPoint) < 15 : false;
  const nextIndex = sameKeys && closeToPrev ? (clickCycle.index + 1) % candidates.length : 0;

  clickCycle.point = clickPoint;
  clickCycle.matches = candidates.map((c) => ({ layerIndex: c.layerIndex, featureIndex: c.featureIndex }));
  clickCycle.index = nextIndex;

  const selected = candidates[nextIndex];
  selectFeature(selected.layerIndex, selected.featureIndex, e.latlng);
}

map.on('click', handleMapClick);

// ---- Smart Hover: feature teratas di bawah kursor (hit-test sama dengan
// klik) diberi highlight ringan. Dinonaktifkan di perangkat sentuh. ----
let hoveredFeatureKey = null;

// Port dari getPreviewHighlightStyle (layerStyle.ts): hover berbeda dari
// highlight seleksi (kuning) supaya terbedakan dari feature yang dipilih.
function getPreviewHighlightStyle(base) {
  return Object.assign({}, base, {
    weight: (base.weight != null ? base.weight : 1.5) + 2,
    color: '#3b82f6',
    dashArray: '4 3',
    fillOpacity: Math.min((base.fillOpacity != null ? base.fillOpacity : 0.35) + 0.1, 0.65),
  });
}

function clearHover() {
  const key = hoveredFeatureKey;
  if (!key) return;
  hoveredFeatureKey = null;
  if (key === activeFeatureKey) return;
  const inst = featureLayerRefs[key];
  if (!inst) return;
  const parts = key.split(':');
  const li = Number(parts[0]);
  const fi = Number(parts[1]);
  const geojsonData = layerGeojsonData[li];
  const feat = geojsonData ? geojsonData.features[fi] : null;
  const gt = feat && feat.geometry ? feat.geometry.type : undefined;
  if ((gt === 'Point' || gt === 'MultiPoint') && typeof inst.setRadius === 'function') {
    const lc = CONFIG.layers.find((l) => l.layerIndex === li);
    inst.setRadius((lc && lc.pointSize) || 5);
  }
  const styleFn = layerStyleFns[li];
  if (!styleFn || typeof inst.setStyle !== 'function') return;
  const base = styleFn(inst.feature);
  const sameLayerAsActive = activeFeatureKey && activeFeatureKey.split(':')[0] === String(li);
  inst.setStyle(sameLayerAsActive ? getSubtleHighlightStyle(base) : base);
}

function applyHover(key) {
  if (key === hoveredFeatureKey) return;
  clearHover();
  if (!key || key === activeFeatureKey) return;
  const inst = featureLayerRefs[key];
  if (!inst) return;
  const parts = key.split(':');
  const li = Number(parts[0]);
  const fi = Number(parts[1]);
  const geojsonData = layerGeojsonData[li];
  const feat = geojsonData ? geojsonData.features[fi] : null;
  const gt = feat && feat.geometry ? feat.geometry.type : undefined;
  if ((gt === 'Point' || gt === 'MultiPoint') && typeof inst.setRadius === 'function') {
    const lc = CONFIG.layers.find((l) => l.layerIndex === li);
    inst.setRadius(((lc && lc.pointSize) || 5) + 4);
  }
  const styleFn = layerStyleFns[li];
  if (styleFn && typeof inst.setStyle === 'function') {
    inst.setStyle(getPreviewHighlightStyle(styleFn(inst.feature)));
  }
  hoveredFeatureKey = key;
}

if (!(window.matchMedia && window.matchMedia('(hover: none)').matches && window.matchMedia('(pointer: coarse)').matches)) {
  let hoverRaf = null;
  map.on('mousemove', (e) => {
    if (hoverRaf !== null) return;
    hoverRaf = window.requestAnimationFrame(() => {
      hoverRaf = null;
      try {
        const top = getVisibleZOrderedFeatureCandidates(e.latlng)[0];
        applyHover(top ? top.layerIndex + ':' + top.featureIndex : null);
      } catch (err) { /* abaikan error hit-test saat hover */ }
    });
  });
  map.on('mouseout', () => {
    if (hoverRaf !== null) { window.cancelAnimationFrame(hoverRaf); hoverRaf = null; }
    clearHover();
  });
}

// Point/MultiPoint selalu tampak di atas Polygon/Buffer (murni z-order).
function bringPointFeaturesToFront() {
  Object.keys(featureLayerRefs).forEach((key) => {
    const parts = key.split(':');
    const layerIndex = Number(parts[0]);
    const featureIndex = Number(parts[1]);
    const geojsonData = layerGeojsonData[layerIndex];
    const feat = geojsonData ? geojsonData.features[featureIndex] : null;
    const geomType = feat && feat.geometry ? feat.geometry.type : undefined;
    if (geomType !== 'Point' && geomType !== 'MultiPoint') return;
    const layerInstance = featureLayerRefs[key];
    if (layerInstance && typeof layerInstance.bringToFront === 'function') {
      layerInstance.bringToFront();
    }
  });
}

// ---- Attribute Table: hanya layer dengan showAttributeTable=true yang
// muncul di dropdown, sesuai konfigurasi yang sudah diatur di GIS2Web
// Studio. Klik row -> selectFeature() (fungsi yang sama dipakai klik peta).
// Saat feature dipilih dari peta, tabel ikut sync (ganti layer dropdown +
// highlight row aktif). ----
const attrPanelEl = document.getElementById('attribute-table-panel');
const attrLayerSelectEl = document.getElementById('attribute-table-layer-select');
const attrCountEl = document.getElementById('attribute-table-count');
const attrToggleBtn = document.getElementById('attribute-table-toggle-btn');
const attrBodyEl = document.getElementById('attribute-table-body');
const attrDataTableEl = document.getElementById('attribute-data-table');

const attributeTableLayers = CONFIG.layers.filter((l) => l.showAttributeTable);
let attrSelectedLayerIndex = attributeTableLayers.length > 0 ? attributeTableLayers[0].layerIndex : null;
let attrCollapsed = true;

function renderAttributeTableOptions() {
  attrLayerSelectEl.innerHTML = '';
  attributeTableLayers.forEach((l) => {
    const opt = document.createElement('option');
    opt.value = String(l.layerIndex);
    opt.textContent = l.name;
    attrLayerSelectEl.appendChild(opt);
  });
  if (attrSelectedLayerIndex !== null) {
    attrLayerSelectEl.value = String(attrSelectedLayerIndex);
  }
  attrLayerSelectEl.style.display = attributeTableLayers.length > 1 ? '' : 'none';
}

function renderAttributeTableRows() {
  if (attrSelectedLayerIndex === null) {
    attrDataTableEl.innerHTML = '';
    attrCountEl.textContent = '';
    return;
  }
  const geojsonData = layerGeojsonData[attrSelectedLayerIndex];
  if (!geojsonData) {
    attrDataTableEl.innerHTML = '<tbody><tr><td>Memuat data...</td></tr></tbody>';
    return;
  }
  const features = geojsonData.features || [];
  const fieldSet = [];
  features.forEach((f) => {
    if (f.properties) {
      Object.keys(f.properties).forEach((k) => {
        if (fieldSet.indexOf(k) === -1) fieldSet.push(k);
      });
    }
  });

  attrCountEl.textContent = features.length + ' fitur';

  if (fieldSet.length === 0) {
    attrDataTableEl.innerHTML = '<tbody><tr><td>Tidak ada data atribut pada layer ini.</td></tr></tbody>';
    return;
  }

  const theadHtml = '<thead><tr>' + fieldSet.map((f) => '<th>' + escapeHtml(f) + '</th>').join('') + '</tr></thead>';
  const tbodyRows = features.map((f, featureIndex) => {
    const isActive = activeFeatureKey === (attrSelectedLayerIndex + ':' + featureIndex);
    const cells = fieldSet.map((field) => {
      const v = f.properties ? f.properties[field] : undefined;
      return '<td>' + escapeHtml(v === null || v === undefined ? '-' : String(v)) + '</td>';
    }).join('');
    return '<tr data-feature-index="' + featureIndex + '" class="' + (isActive ? 'active-row' : '') + '">' + cells + '</tr>';
  }).join('');

  attrDataTableEl.innerHTML = theadHtml + '<tbody>' + tbodyRows + '</tbody>';

  const rows = attrDataTableEl.querySelectorAll('tbody tr');
  rows.forEach((tr) => {
    tr.addEventListener('click', () => {
      const fi = Number(tr.getAttribute('data-feature-index'));
      selectFeature(attrSelectedLayerIndex, fi);
    });
  });
}

function setAttributeTableCollapsed(collapsed) {
  attrCollapsed = collapsed;
  attrBodyEl.hidden = collapsed;
  attrToggleBtn.innerHTML = collapsed ? '&#9650;' : '&#9660;';
}

attrToggleBtn.addEventListener('click', () => setAttributeTableCollapsed(!attrCollapsed));

attrLayerSelectEl.addEventListener('change', (e) => {
  attrSelectedLayerIndex = Number(e.target.value);
  renderAttributeTableRows();
});

function syncAttributeTableToActiveFeature() {
  if (!activeFeatureKey) return;
  const layerIndex = Number(activeFeatureKey.split(':')[0]);
  const isTrackedLayer = attributeTableLayers.some((l) => l.layerIndex === layerIndex);
  if (!isTrackedLayer) return;

  if (attrSelectedLayerIndex !== layerIndex) {
    attrSelectedLayerIndex = layerIndex;
    attrLayerSelectEl.value = String(layerIndex);
  }
  renderAttributeTableRows();
}

if (attributeTableLayers.length > 0) {
  attrPanelEl.hidden = false;
  renderAttributeTableOptions();
  setAttributeTableCollapsed(true);
}

// ---- Layer visibility toggle: on/off tampil di peta, murni interaksi
// end-user. TIDAK mengubah warna/opacity/order/konfigurasi lain - itu
// semua sudah final dari GIS2Web Studio dan tidak diedit di sini. ----
const layerTogglePanelEl = document.getElementById('layer-toggle-panel');
const layerToggleListEl = document.getElementById('layer-toggle-list');
const layerToggleCollapseBtn = document.getElementById('layer-toggle-collapse-btn');
let layerToggleCollapsed = false;

function setLayerToggleCollapsed(collapsed) {
  layerToggleCollapsed = collapsed;
  layerToggleListEl.hidden = collapsed;
  layerToggleCollapseBtn.innerHTML = collapsed ? '&#9650;' : '&#9660;';
}

layerToggleCollapseBtn.addEventListener('click', () => setLayerToggleCollapsed(!layerToggleCollapsed));

function renderLayerTogglePanel() {
  if (CONFIG.layers.length === 0) return;
  layerTogglePanelEl.hidden = false;
  layerToggleListEl.innerHTML = '';

  CONFIG.layers.forEach((layerCfg) => {
    const gLayer = layerRefs[layerCfg.layerIndex];
    if (!gLayer) return;

    const item = document.createElement('label');
    item.className = 'layer-toggle-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = map.hasLayer(gLayer);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        map.addLayer(gLayer);
      } else {
        map.removeLayer(gLayer);
        // Kalau feature yang sedang aktif ada di layer yang disembunyikan,
        // bersihkan seleksi supaya tidak ada popup/card 'menggantung' untuk
        // feature yang sudah tidak terlihat.
        if (activeFeatureKey && Number(activeFeatureKey.split(':')[0]) === layerCfg.layerIndex) {
          activeFeatureKey = null;
          closeAllPopups();
          hideFeatureCard();
        }
      }
    });

    const label = document.createElement('span');
    label.textContent = layerCfg.name + (layerCfg.isBoundary ? ' (Boundary)' : '');

    item.appendChild(checkbox);
    item.appendChild(label);
    layerToggleListEl.appendChild(item);
  });
}

// Meniru filter QGIS "$area = maximum($area, group_by:=...)": hanya 1
// feature per grup (yang luasnya paling besar) yang diberi label. Kalau
// layer tidak punya groupByField, semua feature yang bernilai dianggap
// berhak (labeling QGIS type="simple" tampil di semua feature).
function computeLabeledFeatureIndexes(layer, geojson) {
  const result = new Set();
  if (!layer.labeling) return result;

  const groupByField = layer.labeling.groupByField;
  if (!groupByField) {
    geojson.features.forEach((_, idx) => result.add(idx));
    return result;
  }

  const largestByGroup = {};
  geojson.features.forEach((feature, idx) => {
    const rawGroupValue = feature.properties ? feature.properties[groupByField] : undefined;
    const groupKey = rawGroupValue === null || rawGroupValue === undefined ? 'NULL' : String(rawGroupValue);

    let featureArea = 0;
    try {
      featureArea = turf.area(feature);
    } catch (e) {
      featureArea = 0;
    }

    const current = largestByGroup[groupKey];
    if (!current || featureArea > current.area) {
      largestByGroup[groupKey] = { index: idx, area: featureArea };
    }
  });

  Object.values(largestByGroup).forEach(({ index }) => result.add(index));
  return result;
}

function loadLayer(layer) {
  return fetch(layer.file)
    .then((res) => res.json())
    .then((geojson) => {
      layerGeojsonData[layer.layerIndex] = geojson;

      const styleFn = (feature) => ({
        color: resolveFeatureColor(layer, feature),
        weight: layer.isBoundary ? 2 : 1.5,
        fillOpacity: layer.isBoundary ? 0 : layer.opacity,
      });
      layerStyleFns[layer.layerIndex] = styleFn;

      const labeledFeatureIndexes = computeLabeledFeatureIndexes(layer, geojson);

      const gLayer = L.geoJSON(geojson, {
        style: styleFn,
        pointToLayer: (feature, latlng) =>
          L.circleMarker(latlng, {
            radius: layer.pointSize || 5,
            color: resolveFeatureColor(layer, feature),
            fillOpacity: layer.opacity,
          }),
        onEachFeature: (feature, layerInstance) => {
          const featureIndex = geojson.features.indexOf(feature);
          const properties = feature.properties || null;


          if (!layer.isBoundary && featureIndex !== -1) {
            featureLayerRefs[layer.layerIndex + ':' + featureIndex] = layerInstance;
          }

          if (layer.labeling && featureIndex !== -1 && labeledFeatureIndexes.has(featureIndex)) {
            const labelValue = properties ? properties[layer.labeling.field] : undefined;
            const labelText = labelValue === null || labelValue === undefined ? '' : String(labelValue);
            if (labelText) {
              layerInstance.bindTooltip(escapeHtml(labelText), {
                permanent: true,
                direction: 'center',
                className: 'layer-feature-label',
              });
              layerInstance.once('tooltipopen', (e) => {
                const tooltipEl = e.tooltip.getElement();
                if (tooltipEl) {
                  tooltipEl.style.fontSize = (CONFIG.labelFontSize || 13) + 'px';
                }
              });
            }
          }
        },
      }).addTo(map);

      layerRefs[layer.layerIndex] = gLayer;

      if (layer.isBoundary) {
        map.fitBounds(gLayer.getBounds());
        boundaryFitted = true;
      } else if (!boundaryFitted) {
        map.fitBounds(gLayer.getBounds());
      }
    })
    .catch((err) => console.error('Gagal memuat layer:', layer.file, err));
}

Promise.all(CONFIG.layers.map(loadLayer)).then(() => {
  // Urutan stacking final: CONFIG.layers[0] adalah layer paling atas (sesuai
  // urutan yang sudah diatur user di GIS2Web Studio / layerOrder). Sama
  // seperti applyStackingOrder di aplikasi: reverse dulu, lalu bringToFront
  // satu-satu, supaya elemen pertama di array yang menang paling atas.
  [...CONFIG.layers].reverse().forEach((layer) => {
    const gLayer = layerRefs[layer.layerIndex];
    if (gLayer && typeof gLayer.bringToFront === 'function') {
      gLayer.bringToFront();
    }
  });
  bringPointFeaturesToFront();
  if (attributeTableLayers.length > 0) {
    renderAttributeTableRows();
  }
  renderLayerTogglePanel();
});
