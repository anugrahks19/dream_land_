/**
 * Dreamback Texture Kit — Public Registry API (T0 + T9)
 *
 * Exact public API required by Workspace A (the game) & Gallery:
 *   export async function initTextures({ quality, seed, onProgress })
 *   export function tex(id)       // THREE.Texture, cached, never throws, flat fallback
 *   export function mat(id, over) // THREE.Material from tex/materials.js recipe table
 *   export function css(id)       // data URL string for CSS backgrounds
 *   export function sprite(id)    // THREE.SpriteMaterial
 *   export function manifest()    // [{ id, size, tiles, space, usage, ... }]
 *
 * Imports nothing from outside tex/ (except 'three' via importmap).
 */

import * as THREE from 'three';
import { PALETTE, PIP_COLORS, TIME_KEYFRAMES } from './palette.js';
import { DEFAULT_SEED, resolveQuality, scaleSize, getWorldRepeat } from './config.js';
import {
  deriveSeed,
  toTexture,
  flatFallback,
  seamDiff,
  checkLuminance,
  estimateGpuBytes,
} from './core.js';
import {
  register,
  getDef,
  getAllDefs,
  getMaterialRecipe,
  clearSharedFields,
} from './store.js';

// Register all T1..T9 modules on import so lazy tex(id) works even if initTextures() is skipped
import { buildMacro, DEFAULT_WORLD_REGIONS } from './land.js';
import './build.js';
import './nature.js';
import './fx.js';
import './char.js';
import './sky.js';
import { UI_TOKENS, mapRegionWash, mapPaths } from './ui.js';
import { STORY_TOKENS } from './story.js';
import './materials.js';

export {
  register,
  PALETTE,
  PIP_COLORS,
  TIME_KEYFRAMES,
  UI_TOKENS,
  STORY_TOKENS,
  DEFAULT_WORLD_REGIONS,
  buildMacro,
  mapRegionWash,
  mapPaths,
};

let activeTier = resolveQuality('high');
let activeSeed = DEFAULT_SEED;
let initialized = false;

const canvasCache = new Map();
const textureCache = new Map();
const cssCache = new Map();
const materialCache = new Map();
const spriteCache = new Map();
const metricsCache = new Map(); // id -> { ms, bytes, w, h, gpuBytes, fallback, seam, luma }
const warnedUnknown = new Set();

function yieldFrame() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function isGpuKind(def) {
  // UI skins (except ui.map & ui.map.icons) and story pages are CSS-delivered unless tex(id) is explicitly called
  if (def.kind === 'story') return false;
  if (def.kind === 'ui') return false;
  return true;
}

/**
 * Internal builder for a single registered id, wrapped in try/catch with guaranteed 4x4 fallback.
 */
function buildEntry(id, { runQa = false } = {}) {
  const def = getDef(id);
  if (!def) {
    if (!warnedUnknown.has(id)) {
      warnedUnknown.add(id);
      console.warn(`[Dreamback Tex] Unknown texture id "${id}", returning flat fallback.`);
    }
    const fb = flatFallback(PALETTE.cream);
    return { canvas: fb.canvas, texture: fb.texture, fallback: true };
  }

  if (canvasCache.has(id)) {
    return { canvas: canvasCache.get(id), fallback: Boolean(metricsCache.get(id)?.fallback) };
  }

  const [w, h] = scaleSize(def.size, def.kind, activeTier);
  // Paired data maps share their base id's seed so cached noise fields match 1:1
  const seedKey = id.replace(/\.(normal|rough|glow|emissive)$/, '');
  const seed = deriveSeed(activeSeed, seedKey);
  const t0 = performance.now();

  try {
    const canvas = def.build(w, h, seed, {
      tier: activeTier,
      dabMult: activeTier.dabMult,
      masterSeed: activeSeed,
    });
    const ms = Number((performance.now() - t0).toFixed(2));
    const isGpu = isGpuKind(def);
    const bytes = estimateGpuBytes(canvas.width, canvas.height, def.kind !== 'lut');

    const tileX = def.tileX ?? Boolean(def.tile);
    const tileY = def.tileY ?? Boolean(def.tile);
    const isSprite = def.kind === 'sprite' || def.kind === 'fx' || def.kind === 'ui';
    const isData = def.space === 'linear' || def.kind === 'data' || def.kind === 'lut';

    const seam = runQa ? seamDiff(canvas, { wrapX: tileX, wrapY: tileY }) : null;
    const luma = runQa ? checkLuminance(canvas, isSprite, isData) : null;

    canvasCache.set(id, canvas);
    metricsCache.set(id, {
      id,
      w: canvas.width,
      h: canvas.height,
      ms,
      bytes,
      gpuBytes: isGpu ? bytes : 0,
      isGpu,
      fallback: false,
      seam,
      luma,
    });
    return { canvas, fallback: false };
  } catch (err) {
    console.warn(`[Dreamback Tex] Build failed for "${id}", falling back to 4x4:`, err);
    const fb = flatFallback(def.baseColor || PALETTE.cream, {
      space: def.space,
      tile: Boolean(def.tile),
      aniso: activeTier.anisotropy,
    });
    const ms = Number((performance.now() - t0).toFixed(2));
    canvasCache.set(id, fb.canvas);
    textureCache.set(id, fb.texture);
    metricsCache.set(id, {
      id,
      w: 4,
      h: 4,
      ms,
      bytes: estimateGpuBytes(4, 4, true),
      gpuBytes: estimateGpuBytes(4, 4, true),
      isGpu: true,
      fallback: true,
      error: String(err),
      seam: { pass: true, meanSeam: 0, meanInterior: 0, maxSeam: 0, ratio: 1 },
      luma: { pass: true, pureBlack: 0, pureWhite: 0, fringePx: 0, minL: 0, maxL: 0 },
    });
    return { canvas: fb.canvas, texture: fb.texture, fallback: true };
  }
}

/**
 * Progressive async texture kit initializer.
 */
export async function initTextures({ quality = 'high', seed = DEFAULT_SEED, onProgress = null, qa = false, yieldBatch = 6 } = {}) {
  disposeTextures();
  activeTier = resolveQuality(quality);
  activeSeed = seed ?? DEFAULT_SEED;
  clearSharedFields();

  const defs = getAllDefs();
  const total = defs.length;
  const tStart = performance.now();

  for (let i = 0; i < total; i++) {
    const def = defs[i];
    buildEntry(def.id, { runQa: qa });
    // Pre-create Three.js texture handle for GPU-bound entries
    if (isGpuKind(def)) {
      tex(def.id);
    }

    if (typeof onProgress === 'function') {
      onProgress({
        index: i + 1,
        total,
        progress: (i + 1) / total,
        id: def.id,
        ms: metricsCache.get(def.id)?.ms ?? 0,
      });
    }

    if (yieldBatch > 0 && (i + 1) % yieldBatch === 0 && i < total - 1) {
      await yieldFrame();
    }
  }

  clearSharedFields();
  initialized = true;

  const wallMs = Number((performance.now() - tStart).toFixed(1));
  const summary = qaReport(wallMs);
  return summary;
}

/**
 * Return cached THREE.Texture for id. Lazy-builds if initTextures was skipped.
 * Never throws; returns 4x4 flat fallback for unknown ids and logs once.
 */
export function tex(id) {
  if (textureCache.has(id)) return textureCache.get(id);

  const def = getDef(id);
  if (!def) {
    if (!warnedUnknown.has(id)) {
      warnedUnknown.add(id);
      console.warn(`[Dreamback Tex] Unknown texture id "${id}", returning flat fallback.`);
    }
    const fb = flatFallback(PALETTE.cream);
    textureCache.set(id, fb.texture);
    return fb.texture;
  }

  const { canvas } = buildEntry(id, { runQa: false });
  if (textureCache.has(id)) return textureCache.get(id);

  const tileX = def.tileX ?? Boolean(def.tile);
  const tileY = def.tileY ?? Boolean(def.tile);
  const t = toTexture(canvas, {
    space: def.space || 'srgb',
    tileX,
    tileY,
    aniso: activeTier.anisotropy,
    mipmaps: def.kind !== 'lut',
  });
  t.name = id;
  textureCache.set(id, t);
  return t;
}

/**
 * Return a THREE.Material built from the T9 recipe table (with optional overrides).
 */
export function mat(id, over = null) {
  const cacheKey = over ? null : id;
  if (cacheKey && materialCache.has(cacheKey)) return materialCache.get(cacheKey);

  const recipe = getMaterialRecipe(id);
  if (!recipe) {
    const fallbackMat = new THREE.MeshStandardMaterial({
      map: tex(id),
      roughness: 0.85,
      metalness: 0.0,
      ...(over || {}),
    });
    if (cacheKey) materialCache.set(cacheKey, fallbackMat);
    return fallbackMat;
  }

  const baseProps = {
    map: recipe.map ? tex(recipe.map) : tex(id),
    transparent: Boolean(recipe.transparent),
    depthWrite: recipe.depthWrite !== false,
    side: recipe.side ?? THREE.FrontSide,
  };
  if (recipe.opacity !== undefined) baseProps.opacity = recipe.opacity;
  if (recipe.alphaTest !== undefined) baseProps.alphaTest = recipe.alphaTest;
  if (recipe.additive) baseProps.blending = THREE.AdditiveBlending;

  let m;
  if (recipe.unlit) {
    m = new THREE.MeshBasicMaterial({
      ...baseProps,
      color: recipe.tint ?? 0xffffff,
      ...(over || {}),
    });
  } else {
    const stdProps = {
      ...baseProps,
      color: recipe.tint ?? 0xffffff,
      roughness: recipe.roughness ?? 0.85,
      metalness: recipe.metalness ?? 0.0,
      flatShading: Boolean(recipe.flatShading),
    };
    if (recipe.normalMap) {
      stdProps.normalMap = tex(recipe.normalMap);
      const ns = recipe.normalScale ?? 0.8;
      stdProps.normalScale = new THREE.Vector2(ns, ns);
    }
    if (recipe.roughnessMap) stdProps.roughnessMap = tex(recipe.roughnessMap);
    if (recipe.emissiveMap) {
      stdProps.emissiveMap = tex(recipe.emissiveMap);
      stdProps.emissive = new THREE.Color(recipe.emissive || '#FFC77A');
      stdProps.emissiveIntensity = recipe.emissiveIntensity ?? 1.0;
    }
    m = new THREE.MeshStandardMaterial({ ...stdProps, ...(over || {}) });
  }

  m.userData.texId = id;
  m.userData.worldRepeat = recipe.worldRepeat ?? getWorldRepeat(id);
  if (cacheKey) materialCache.set(cacheKey, m);
  return m;
}

/**
 * Return cached PNG data URL string for CSS backgrounds. Never throws.
 */
export function css(id) {
  if (cssCache.has(id)) return cssCache.get(id);
  const { canvas } = buildEntry(id, { runQa: false });
  try {
    const url = canvas.toDataURL('image/png');
    cssCache.set(id, url);
    return url;
  } catch {
    return '';
  }
}

/**
 * Return cached THREE.SpriteMaterial for sprite/fx id. Never throws.
 */
export function sprite(id) {
  if (spriteCache.has(id)) return spriteCache.get(id);
  const recipe = getMaterialRecipe(id);
  const isAdditive = Boolean(recipe?.additive);
  const sm = new THREE.SpriteMaterial({
    map: tex(id),
    transparent: true,
    depthWrite: false,
    blending: isAdditive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  sm.userData.texId = id;
  spriteCache.set(id, sm);
  return sm;
}

/**
 * Return full manifest array: [{ id, size, tiles, space, usage, kind, worldRepeat, mergeTarget }].
 */
export function manifest() {
  return getAllDefs().map((d) => {
    const [bw, bh] = Array.isArray(d.size) ? d.size : [d.size, d.size];
    const [sw, sh] = scaleSize(d.size, d.kind, activeTier);
    const recipe = getMaterialRecipe(d.id);
    const tileX = d.tileX ?? Boolean(d.tile);
    const tileY = d.tileY ?? Boolean(d.tile);
    return {
      id: d.id,
      baseSize: [bw, bh],
      size: [sw, sh],
      tiles: tileX && tileY ? 'xy' : tileX ? 'x' : tileY ? 'y' : false,
      space: d.space || 'srgb',
      kind: d.kind,
      usage: d.usage || '',
      worldRepeat: getWorldRepeat(d.id),
      flatShading: Boolean(recipe?.flatShading),
      mergeTarget: recipe?.mergeTarget || (d.kind === 'ui' ? 'CSS UI skin (ui.js / index.html)' : d.kind === 'story' ? 'CSS Story/Menu page (story.*)' : 'Game asset'),
    };
  });
}

/**
 * Inspect canvas for gallery preview / PNG export.
 */
export function getCanvas(id) {
  if (!canvasCache.has(id)) buildEntry(id, { runQa: false });
  return canvasCache.get(id);
}

/**
 * Run/retrieve QA report across all built entries.
 */
export function qaReport(wallMs = 0) {
  let computeMs = 0;
  let gpuBytes = 0;
  let cssBytes = 0;
  let seamPass = 0, seamTotal = 0;
  let lumaPass = 0, lumaTotal = 0;
  let fallbacks = 0;
  const items = [];

  for (const def of getAllDefs()) {
    const m = metricsCache.get(def.id);
    if (!m) continue;
    computeMs += m.ms;
    gpuBytes += m.gpuBytes;
    if (!m.isGpu) cssBytes += m.bytes;
    if (m.fallback) fallbacks++;

    if (m.seam && !m.seam.skipped) {
      seamTotal++;
      if (m.seam.pass) seamPass++;
    }
    if (m.luma && !m.luma.dataMap) {
      lumaTotal++;
      if (m.luma.pass) lumaPass++;
    }
    items.push(m);
  }

  const gpuMb = Number((gpuBytes / (1024 * 1024)).toFixed(2));
  const cssMb = Number((cssBytes / (1024 * 1024)).toFixed(2));
  const totalComputeMs = Number(computeMs.toFixed(1));

  return {
    quality: activeTier.id,
    seed: activeSeed,
    initialized,
    count: items.length,
    computeMs: totalComputeMs,
    wallMs: wallMs || totalComputeMs,
    gpuBytes,
    gpuMb,
    cssMb,
    memoryBudgetMb: activeTier.memoryBudgetMb,
    timeBudgetMs: activeTier.timeBudgetMs,
    withinTimeBudget: totalComputeMs < activeTier.timeBudgetMs,
    withinMemoryBudget: gpuMb < activeTier.memoryBudgetMb,
    seamPass,
    seamTotal,
    lumaPass,
    lumaTotal,
    fallbacks,
    items,
  };
}

export function disposeTextures() {
  for (const t of textureCache.values()) t.dispose?.();
  for (const m of materialCache.values()) m.dispose?.();
  for (const s of spriteCache.values()) s.dispose?.();
  textureCache.clear();
  materialCache.clear();
  spriteCache.clear();
  canvasCache.clear();
  cssCache.clear();
  metricsCache.clear();
  metricsCache.clear();
  clearSharedFields();
  initialized = false;
}
