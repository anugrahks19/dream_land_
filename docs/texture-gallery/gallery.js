/**
 * Dreamback Texture Kit â€” Interactive Gallery (T0..T9)
 * - Grouped catalog by id prefix + QA badges
 * - Design Bible Golden-Hour 3D preview (sphere + plane, sun #FFC77A at 12..18 deg, warm hemisphere)
 * - 3x3 tile preview + seamDiff + luminance/fringe QA + Download PNG + Export all PNGs
 * - Sky 5-column strip (T6), UI cream sheet (T7), Story picture book (T8)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  initTextures,
  tex,
  mat,
  css,
  sprite,
  manifest,
  qaReport,
  getCanvas,
  PALETTE,
  PIP_COLORS,
  TIME_KEYFRAMES,
  UI_TOKENS,
  STORY_TOKENS,
  buildMacro,
  mapRegionWash,
  mapPaths,
} from '../../src/tex/registry.js';

// Expose full T0 API on window for direct console inspection
window.DreambackTex = {
  initTextures,
  tex,
  mat,
  css,
  sprite,
  manifest,
  qaReport,
  getCanvas,
  PALETTE,
  PIP_COLORS,
  TIME_KEYFRAMES,
  UI_TOKENS,
  STORY_TOKENS,
  buildMacro,
  mapRegionWash,
  mapPaths,
};

const els = {
  qualitySelect: document.getElementById('qualitySelect'),
  seedInput: document.getElementById('seedInput'),
  regenBtn: document.getElementById('regenBtn'),
  exportAllBtn: document.getElementById('exportAllBtn'),
  progressWrap: document.getElementById('progressWrap'),
  progressLabel: document.getElementById('progressLabel'),
  progressPct: document.getElementById('progressPct'),
  progressFill: document.getElementById('progressFill'),
  mTime: document.getElementById('mTime'),
  mGpu: document.getElementById('mGpu'),
  mSeam: document.getElementById('mSeam'),
  mLuma: document.getElementById('mLuma'),
  mCount: document.getElementById('mCount'),
  inspId: document.getElementById('inspId'),
  inspUsage: document.getElementById('inspUsage'),
  inspBadges: document.getElementById('inspBadges'),
  downloadPngBtn: document.getElementById('downloadPngBtn'),
  threeCanvas: document.getElementById('threeCanvas'),
  stageOverlay: document.getElementById('stageOverlay'),
  todSlider: document.getElementById('todSlider'),
  todLabel: document.getElementById('todLabel'),
  elevSlider: document.getElementById('elevSlider'),
  elevLabel: document.getElementById('elevLabel'),
  bgButtons: document.getElementById('bgButtons'),
  tile3Canvas: document.getElementById('tile3Canvas'),
  tile3Heading: document.getElementById('tile3Heading'),
  seamGuideToggle: document.getElementById('seamGuideToggle'),
  seamStats: document.getElementById('seamStats'),
  viewTabs: document.getElementById('viewTabs'),
  prefixTabs: document.getElementById('prefixTabs'),
  catalogView: document.getElementById('catalogView'),
  skyView: document.getElementById('skyView'),
  uiView: document.getElementById('uiView'),
  storyView: document.getElementById('storyView'),
};

const params = new URLSearchParams(window.location.search);
let activeSummary = null;
let metricsById = new Map();
let manifestById = new Map();
let selectedId = params.get('select') || 'land.marsh';
let activePrefix = params.get('prefix') || 'all';
let activeView = params.get('view') || 'catalog';
let activeBg = params.get('bg') || 'golden';
if (params.get('quality')) els.qualitySelect.value = params.get('quality');
if (params.get('seed')) els.seedInput.value = params.get('seed');

// =========================================================================
// Three.js Design Bible Golden-Hour Preview (Sphere + Plane simultaneously!)
// =========================================================================
const renderer = new THREE.WebGLRenderer({ canvas: els.threeCanvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1.18, 0.1, 40);
camera.position.set(0, 1.15, 3.6);

const controls = new OrbitControls(camera, els.threeCanvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.1, 0);

const hemiLight = new THREE.HemisphereLight(0xFFF4DC, 0x2C4A47, 1.05);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xFFC77A, 1.65);
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0xCFE8DC, 0.35);
fillLight.position.set(-2.5, 1.4, -2.0);
scene.add(fillLight);

// Preview Sphere + Ground Plane (both always visible for tiles/chars; plane/billboard for sprites)
const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(0.76, 40, 28), new THREE.MeshStandardMaterial());
sphereMesh.position.set(0, 0.48, 0);
scene.add(sphereMesh);

const planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshStandardMaterial());
planeMesh.rotation.x = -Math.PI / 2;
planeMesh.position.set(0, -0.32, 0);
scene.add(planeMesh);

const spritePlane = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide }));
spritePlane.position.set(0, 0.2, 0);
spritePlane.visible = false;
scene.add(spritePlane);

let checkerBgTex = null;
function getCheckerTex() {
  if (checkerBgTex) return checkerBgTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#4A3B2A'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#B79A74'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  checkerBgTex = new THREE.CanvasTexture(c);
  checkerBgTex.wrapS = checkerBgTex.wrapT = THREE.RepeatWrapping;
  checkerBgTex.repeat.set(8, 7);
  checkerBgTex.colorSpace = THREE.SRGBColorSpace;
  return checkerBgTex;
}

function lerpColorHex(hexA, hexB, t) {
  const ca = new THREE.Color(hexA);
  const cb = new THREE.Color(hexB);
  return ca.lerp(cb, t);
}

function updateLighting() {
  const v = parseFloat(els.todSlider.value);
  const i0 = Math.min(TIME_KEYFRAMES.length - 1, Math.floor(v));
  const i1 = Math.min(TIME_KEYFRAMES.length - 1, i0 + 1);
  const frac = v - i0;
  const kf0 = TIME_KEYFRAMES[i0], kf1 = TIME_KEYFRAMES[i1];

  const sunCol = lerpColorHex(kf0.sunColor, kf1.sunColor, frac);
  const skyCol = lerpColorHex(kf0.horizon, kf1.horizon, frac);
  const midCol = lerpColorHex(kf0.mid, kf1.mid, frac);

  const elevDeg = parseFloat(els.elevSlider.value);
  const elevRad = (elevDeg * Math.PI) / 180;
  const azimRad = 0.65;
  sunLight.color.copy(sunCol);
  sunLight.position.set(Math.cos(elevRad) * Math.sin(azimRad) * 6, Math.sin(elevRad) * 6, Math.cos(elevRad) * Math.cos(azimRad) * 6);
  hemiLight.color.copy(skyCol);

  els.todLabel.textContent = `${kf0.label} (${elevDeg}Â°)`;
  els.elevLabel.textContent = `${elevDeg}Â°`;

  if (activeBg === 'golden') scene.background = midCol.clone().lerp(skyCol, 0.55);
  else if (activeBg === 'light') scene.background = new THREE.Color(PALETTE.paper);
  else if (activeBg === 'dark') scene.background = new THREE.Color(PALETTE.darkest);
  else scene.background = getCheckerTex();
}

function resizeRenderer() {
  const rect = els.threeCanvas.parentElement.getBoundingClientRect();
  const w = Math.max(220, Math.round(rect.width));
  const h = Math.max(180, Math.round(rect.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  if (sphereMesh.visible) sphereMesh.rotation.y += 0.004;
  controls.update();
  renderer.render(scene, camera);
}

// =========================================================================
// Inspector & 3x3 Tile Preview
// =========================================================================
function renderInspector() {
  const meta = manifestById.get(selectedId) || manifest()[0];
  if (!meta) return;
  selectedId = meta.id;
  const m = metricsById.get(selectedId);
  const canvas = getCanvas(selectedId);

  els.inspId.textContent = meta.id;
  els.inspUsage.textContent = meta.usage || meta.mergeTarget;

  // QA Badges
  const badges = [];
  badges.push(`<span class="badge">${meta.size[0]}Ã—${meta.size[1]}</span>`);
  badges.push(`<span class="badge">${meta.space === 'linear' ? 'NoColorSpace' : 'sRGB'}</span>`);
  if (m) {
    badges.push(`<span class="badge">${m.ms} ms</span>`);
    badges.push(`<span class="badge">${(m.bytes / (1024 * 1024)).toFixed(2)} MB${m.isGpu ? ' GPU' : ' CSS'}</span>`);
    if (m.seam && !m.seam.skipped) {
      badges.push(`<span class="badge ${m.seam.pass ? 'pass' : 'fail'}">Seam ${m.seam.pass ? 'PASS' : 'FAIL'} (${m.seam.ratio}Ã—)</span>`);
    }
    if (m.luma && !m.luma.dataMap) {
      badges.push(`<span class="badge ${m.luma.pass ? 'pass' : 'fail'}">Luma ${m.luma.pass ? 'PASS' : 'FAIL'}</span>`);
    }
    if (m.fallback) badges.push(`<span class="badge fail">FALLBACK</span>`);
  }
  els.inspBadges.innerHTML = badges.join('');

  // Update 3D preview
  const isFlatCard = meta.kind === 'sprite' || meta.kind === 'fx' || meta.kind === 'ui' || meta.kind === 'story' || meta.kind === 'lut';
  const t = tex(selectedId);

  if (isFlatCard) {
    sphereMesh.visible = false;
    planeMesh.visible = false;
    spritePlane.visible = true;
    const aspect = meta.size[0] / Math.max(1, meta.size[1]);
    spritePlane.scale.set(aspect >= 1 ? 1.15 : 1.15 * aspect, aspect >= 1 ? 1.15 / aspect : 1.15, 1);

    const isAdditive = selectedId.startsWith('fx.halo') || selectedId === 'fx.godray' || selectedId === 'fx.firefly' || selectedId === 'fx.sparkle' || selectedId === 'fx.ring' || selectedId === 'fx.fragment' || selectedId === 'sky.sun';
    spritePlane.material.dispose();
    spritePlane.material = new THREE.MeshBasicMaterial({
      map: t,
      transparent: true,
      side: THREE.DoubleSide,
      blending: isAdditive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
  } else {
    sphereMesh.visible = true;
    planeMesh.visible = true;
    spritePlane.visible = false;

    const previewMat = mat(selectedId, {});
    if (previewMat.map && meta.tiles === 'xy') {
      previewMat.map.repeat.set(2, 2);
      if (previewMat.normalMap) previewMat.normalMap.repeat.set(2, 2);
      if (previewMat.roughnessMap) previewMat.roughnessMap.repeat.set(2, 2);
    }
    sphereMesh.material.dispose();
    planeMesh.material.dispose();
    sphereMesh.material = previewMat;
    planeMesh.material = previewMat.clone();
  }

  els.stageOverlay.innerHTML = `<span>${meta.flatShading ? 'Flat Facets' : 'Smooth'} Â· repeat ${meta.worldRepeat}u</span><span>${meta.tiles ? 'Tile: ' + meta.tiles : 'Clamp'}</span>`;

  // 3x3 Tile Preview (T0 requirement)
  const tc = els.tile3Canvas;
  const tg = tc.getContext('2d');
  const tw = tc.width, th = tc.height;
  tg.clearRect(0, 0, tw, th);

  if (meta.tiles) {
    els.tile3Heading.textContent = `3Ã—3 Tile Preview (${meta.tiles})`;
    const cellW = tw / 3, cellH = th / 3;
    for (let ry = 0; ry < 3; ry++) {
      for (let rx = 0; rx < 3; rx++) {
        tg.drawImage(canvas, rx * cellW, ry * cellH, cellW, cellH);
      }
    }
    if (els.seamGuideToggle.checked) {
      tg.save();
      tg.strokeStyle = 'rgba(255, 244, 220, 0.55)';
      tg.setLineDash([4, 4]);
      tg.lineWidth = 1;
      for (let k = 1; k <= 2; k++) {
        tg.beginPath();
        tg.moveTo(k * cellW, 0); tg.lineTo(k * cellW, th);
        tg.moveTo(0, k * cellH); tg.lineTo(tw, k * cellH);
        tg.stroke();
      }
      tg.restore();
    }
  } else {
    els.tile3Heading.textContent = 'Full Texture Preview (Non-Tiling)';
    const scale = Math.min(tw / canvas.width, th / canvas.height);
    const dw = canvas.width * scale, dh = canvas.height * scale;
    tg.drawImage(canvas, (tw - dw) * 0.5, (th - dh) * 0.5, dw, dh);
  }

  const seamText = m?.seam && !m.seam.skipped
    ? `Seam: <strong>${m.seam.pass ? 'PASS' : 'FAIL'}</strong> (edge Î”${m.seam.meanSeam} vs int Î”${m.seam.meanInterior}, ratio ${m.seam.ratio}Ã—)`
    : 'Non-tiling (ClampToEdge)';
  const lumaText = m?.luma && !m.luma.dataMap
    ? ` Â· Luma: <strong>${m.luma.pass ? 'PASS' : 'FAIL'}</strong> (${m.luma.minL}..${m.luma.maxL}, black=${m.luma.pureBlack}, white=${m.luma.pureWhite}, fringe=${m.luma.fringePx})`
    : ' Â· Linear data map';
  els.seamStats.innerHTML = seamText + lumaText;

  for (const el of els.catalogView.querySelectorAll('.swatch-card')) {
    el.classList.toggle('selected', el.dataset.id === selectedId);
  }
}

// =========================================================================
// Catalog Grid (Grouped by ID Prefix) & Special Views (T6 Sky, T7 UI, T8 Story)
// =========================================================================
function getPrefix(id) {
  return id.split('.')[0];
}

function renderPrefixTabs() {
  const all = manifest();
  const counts = new Map();
  for (const item of all) {
    const p = getPrefix(item.id);
    counts.set(p, (counts.get(p) || 0) + 1);
  }
  const prefixes = ['all', ...counts.keys()];
  els.prefixTabs.innerHTML = '';
  for (const p of prefixes) {
    const btn = document.createElement('button');
    btn.dataset.prefix = p;
    btn.className = p === activePrefix ? 'active' : '';
    btn.textContent = p === 'all' ? `All (${all.length})` : `${p}. (${counts.get(p)})`;
    btn.addEventListener('click', () => {
      activePrefix = p;
      renderPrefixTabs();
      renderCatalog();
    });
    els.prefixTabs.appendChild(btn);
  }
}

function renderCatalog() {
  els.catalogView.innerHTML = '';
  const items = manifest().filter((it) => activePrefix === 'all' || getPrefix(it.id) === activePrefix);

  const groups = new Map();
  for (const it of items) {
    const p = getPrefix(it.id);
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(it);
  }

  for (const [prefix, list] of groups.entries()) {
    const sec = document.createElement('section');
    sec.className = 'group-block';
    sec.innerHTML = `<h3 class="group-title">${prefix}.* <span>${list.length} textures</span></h3>`;
    const grid = document.createElement('div');
    grid.className = 'swatch-grid';

    for (const item of list) {
      const m = metricsById.get(item.id);
      const hasFail = (m?.seam && !m.seam.skipped && !m.seam.pass) || (m?.luma && !m.luma.dataMap && !m.luma.pass) || m?.fallback;
      const card = document.createElement('article');
      card.className = 'swatch-card' + (item.id === selectedId ? ' selected' : '') + (hasFail ? ' has-fail' : '');
      card.dataset.id = item.id;

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'swatch-thumb';
      const src = getCanvas(item.id);
      const tc = document.createElement('canvas');
      tc.width = 128; tc.height = 128;
      const sc = Math.min(128 / src.width, 128 / src.height);
      const dw = src.width * sc, dh = src.height * sc;
      tc.getContext('2d').drawImage(src, (128 - dw) * 0.5, (128 - dh) * 0.5, dw, dh);
      thumbWrap.appendChild(tc);

      const idEl = document.createElement('div');
      idEl.className = 'swatch-id';
      idEl.textContent = item.id;

      const metaEl = document.createElement('div');
      metaEl.className = 'swatch-meta';
      const qaTag = hasFail ? 'FAIL!' : item.tiles ? 'Seam âœ“' : 'OK âœ“';
      metaEl.innerHTML = `<span>${item.size[0]}Ã—${item.size[1]}</span><span>${m ? m.ms + 'ms' : ''} Â· ${qaTag}</span>`;

      card.append(thumbWrap, idEl, metaEl);
      card.addEventListener('click', () => {
        selectedId = item.id;
        renderInspector();
      });
      grid.appendChild(card);
    }
    sec.appendChild(grid);
    els.catalogView.appendChild(sec);
  }
}

function renderSkyView() {
  els.skyView.innerHTML = '<h3 class="group-title">T6 â€” Five Time-of-Day Sky Keyframes (Golden â†’ Rose â†’ Lavender â†’ Peach â†’ Dawn)</h3>';
  const row = document.createElement('div');
  row.className = 'sky-columns';
  const lutCanvas = getCanvas('sky.lut');

  TIME_KEYFRAMES.forEach((kf, idx) => {
    const card = document.createElement('div');
    card.className = 'sky-col-card';
    const c = document.createElement('canvas');
    c.width = 160; c.height = 240;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(lutCanvas, idx, 0, 1, lutCanvas.height, 0, 0, 160, 240);
    card.appendChild(c);
    const cap = document.createElement('div');
    cap.className = 'sky-col-cap';
    cap.innerHTML = `${kf.label}<br/><small>Sun ${kf.sunColor} Â· ${kf.sunElevationDeg}Â° Â· Grade ${kf.gradeStrength}</small>`;
    card.appendChild(cap);
    row.appendChild(card);
  });
  els.skyView.appendChild(row);

  const gradeWrap = document.createElement('div');
  gradeWrap.style.marginTop = '16px';
  gradeWrap.innerHTML = '<h4 style="margin:0 0 6px;">post.grade â€” Five 256Ã—16 Color-Grade LUT Strips</h4>';
  const gradeImg = document.createElement('img');
  gradeImg.src = css('post.grade');
  gradeImg.style.width = '100%';
  gradeImg.style.maxWidth = '640px';
  gradeImg.style.imageRendering = 'pixelated';
  gradeImg.style.borderRadius = '8px';
  gradeWrap.appendChild(gradeImg);
  els.skyView.appendChild(gradeWrap);
}

function renderUiView() {
  els.uiView.innerHTML = '<h3 class="group-title">T7 â€” Storybook UI & HUD Cream Sheet (css() Data URLs + UI_TOKENS)</h3>';
  els.uiView.style.backgroundImage = `url(${css('ui.paper')})`;
  const wrap = document.createElement('div');
  wrap.className = 'ui-sheet-grid';

  for (const item of manifest().filter((m) => m.id.startsWith('ui.'))) {
    const box = document.createElement('div');
    box.className = 'ui-item';
    const img = document.createElement('img');
    img.src = css(item.id);
    img.alt = item.id;
    const lbl = document.createElement('span');
    lbl.textContent = `${item.id} (${item.size[0]}Ã—${item.size[1]})`;
    box.append(img, lbl);
    box.addEventListener('click', () => { selectedId = item.id; renderInspector(); });
    wrap.appendChild(box);
  }
  els.uiView.appendChild(wrap);
}

function renderStoryView() {
  els.storyView.innerHTML = '<h3 class="group-title">T8 â€” Picture-Book Menu & Storytelling Pages (Zero Baked Text)</h3>';
  const grid = document.createElement('div');
  grid.className = 'story-book-grid';

  for (const item of manifest().filter((m) => m.id.startsWith('story.'))) {
    const card = document.createElement('div');
    card.className = 'story-card';
    const img = document.createElement('img');
    img.src = css(item.id);
    img.alt = item.id;
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.innerHTML = `<span>${item.id}</span><span>${item.size[0]}Ã—${item.size[1]}</span>`;
    card.append(img, cap);
    card.addEventListener('click', () => { selectedId = item.id; renderInspector(); });
    grid.appendChild(card);
  }
  els.storyView.appendChild(grid);
}

function switchView(view) {
  activeView = view;
  for (const b of els.viewTabs.querySelectorAll('button')) b.classList.toggle('active', b.dataset.view === view);
  els.catalogView.hidden = view !== 'catalog';
  els.prefixTabs.hidden = view !== 'catalog';
  els.skyView.hidden = view !== 'sky';
  els.uiView.hidden = view !== 'ui';
  els.storyView.hidden = view !== 'story';

  if (view === 'sky') renderSkyView();
  if (view === 'ui') renderUiView();
  if (view === 'story') renderStoryView();
}

// =========================================================================
// Build / Rebuild Lifecycle
// =========================================================================
async function rebuild() {
  const quality = els.qualitySelect.value;
  const seed = parseInt(els.seedInput.value, 10) || 1337;

  els.regenBtn.disabled = true;
  els.progressWrap.classList.remove('done');
  els.progressFill.style.width = '0%';
  els.progressPct.textContent = '0%';
  els.progressLabel.textContent = `Generating ${quality} Dreamback Texture Kit (seed ${seed})â€¦`;

  const yieldBatch = params.get('yield') === '0' ? 0 : 8;
  const summary = await initTextures({
    quality,
    seed,
    qa: true,
    yieldBatch,
    onProgress({ index, total, progress, id, ms }) {
      const pct = Math.round(progress * 100);
      els.progressFill.style.width = `${pct}%`;
      els.progressPct.textContent = `${pct}%`;
      els.progressLabel.textContent = `Painted ${index}/${total}: ${id} (${ms} ms)`;
    },
  });

  activeSummary = summary;
  metricsById = new Map(summary.items.map((it) => [it.id, it]));
  manifestById = new Map(manifest().map((it) => [it.id, it]));

  els.progressWrap.classList.add('done');
  els.progressLabel.textContent = `Ready Â· ${summary.count} textures generated in ${summary.computeMs} ms compute (${summary.wallMs} ms wall)`;

  els.mTime.textContent = `${summary.computeMs} ms / ${summary.timeBudgetMs} ms`;
  els.mTime.className = summary.withinTimeBudget ? 'ok' : 'fail';

  els.mGpu.textContent = `${summary.gpuMb} MB / ${summary.memoryBudgetMb} MB`;
  els.mGpu.className = summary.withinMemoryBudget ? 'ok' : 'fail';

  const seamOk = summary.seamPass === summary.seamTotal;
  els.mSeam.textContent = `${summary.seamPass} / ${summary.seamTotal} PASS`;
  els.mSeam.className = seamOk ? 'ok' : 'fail';

  const lumaOk = summary.lumaPass === summary.lumaTotal;
  els.mLuma.textContent = `${summary.lumaPass} / ${summary.lumaTotal} clean`;
  els.mLuma.className = lumaOk ? 'ok' : 'fail';

  els.mCount.textContent = `${summary.count} ids (${summary.fallbacks} fallback)`;
  els.mCount.className = summary.fallbacks === 0 ? 'ok' : 'fail';

  // Fail loudly in the gallery console if any QA badge fails (T9 rule)
  if (!seamOk || !lumaOk || summary.fallbacks > 0) {
    const failures = summary.items.filter((it) => (it.seam && !it.seam.skipped && !it.seam.pass) || (it.luma && !it.luma.dataMap && !it.luma.pass) || it.fallback);
    console.error('[Dreamback Gallery QA] Failures detected:', failures);
  }

  // Expose compact telemetry JSON in DOM for automated QA checks
  let tele = document.getElementById('kitTelemetry');
  if (!tele) {
    tele = document.createElement('script');
    tele.id = 'kitTelemetry';
    tele.type = 'application/json';
    document.body.appendChild(tele);
  }
  tele.textContent = JSON.stringify({
    stats: {
      quality: summary.quality,
      seed: summary.seed,
      count: summary.count,
      computeMs: summary.computeMs,
      wallMs: summary.wallMs,
      gpuMb: summary.gpuMb,
      cssMb: summary.cssMb,
      memoryBudgetMb: summary.memoryBudgetMb,
      withinTimeBudget: summary.withinTimeBudget,
      withinMemoryBudget: summary.withinMemoryBudget,
      seamPass: summary.seamPass,
      seamTotal: summary.seamTotal,
      lumaPass: summary.lumaPass,
      lumaTotal: summary.lumaTotal,
      fallbacks: summary.fallbacks,
    },
    failures: summary.items.filter((it) => (it.seam && !it.seam.skipped && !it.seam.pass) || (it.luma && !it.luma.dataMap && !it.luma.pass) || it.fallback),
  });

  els.regenBtn.disabled = false;
  renderPrefixTabs();
  renderCatalog();
  switchView(activeView);
  renderInspector();
}

// =========================================================================
// Downloads & Event Listeners
// =========================================================================
function downloadCanvas(id) {
  const a = document.createElement('a');
  a.href = css(id);
  a.download = `${id}.png`;
  a.click();
}

els.downloadPngBtn.addEventListener('click', () => downloadCanvas(selectedId));
els.exportAllBtn.addEventListener('click', async () => {
  const all = manifest();
  els.exportAllBtn.disabled = true;
  for (let i = 0; i < all.length; i++) {
    downloadCanvas(all[i].id);
    els.exportAllBtn.textContent = `Exporting ${i + 1}/${all.length}â€¦`;
    await new Promise((r) => setTimeout(r, 90));
  }
  els.exportAllBtn.textContent = 'Export all PNGs';
  els.exportAllBtn.disabled = false;
});

els.regenBtn.addEventListener('click', rebuild);
els.qualitySelect.addEventListener('change', rebuild);
els.seedInput.addEventListener('change', rebuild);
els.todSlider.addEventListener('input', updateLighting);
els.elevSlider.addEventListener('input', updateLighting);
els.seamGuideToggle.addEventListener('change', renderInspector);

els.bgButtons.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-bg]');
  if (!btn) return;
  activeBg = btn.dataset.bg;
  for (const b of els.bgButtons.querySelectorAll('button')) b.classList.toggle('active', b.dataset.bg === activeBg);
  updateLighting();
});

els.viewTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (!btn) return;
  switchView(btn.dataset.view);
});

window.addEventListener('resize', resizeRenderer);

updateLighting();
resizeRenderer();
animate();
rebuild();

